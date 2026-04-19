import prisma from '@/lib/prisma';
import { toJson } from '@/lib/utils';

/**
 * TicketService integrates with the apps_definit_tickets system
 * to check if email threads have been converted to tickets and
 * whether those tickets have active team engagement.
 *
 * The tickets API is on apps-definit-com, accessed via Cloudflare
 * tunnel at https://apps.definit.com/tickets/api/
 *
 * Auth: x-portal-secret header
 */

interface TicketSearchResult {
  tickets: Array<{
    id: string;
    ticketNumber: number;
    title: string;
    status: string;
    priority: string;
    contact: { id: string; name: string; email: string; company?: string } | null;
    assignedTo: { id: string; name: string } | null;
    createdAt: string;
    updatedAt: string;
    firstResponseAt: string | null;
    resolvedAt: string | null;
  }>;
  pagination: { total: number };
}

interface TicketDetail {
  id: string;
  ticketNumber: number;
  title: string;
  status: string;
  priority: string;
  assignedTo: { id: string; name: string } | null;
  contact: { id: string; name: string; email: string } | null;
  comments: Array<{
    id: string;
    content: string;
    isInternal: boolean;
    source: string;
    createdAt: string;
    author: { id: string; name: string } | null;
  }>;
  createdAt: string;
  updatedAt: string;
}

export class TicketService {
  private baseUrl: string;
  private secret: string;

  constructor() {
    // Tickets API endpoint — configurable via env, defaults to apps.definit.com
    this.baseUrl = process.env.TICKETS_API_URL ?? 'https://apps.definit.com/tickets';
    this.secret = process.env.TICKETS_API_SECRET ?? '';
  }

  private async fetch<T>(path: string): Promise<T | null> {
    if (!this.secret) {
      console.warn('TICKETS_API_SECRET not configured, skipping ticket check');
      return null;
    }

    try {
      const res = await globalThis.fetch(`${this.baseUrl}${path}`, {
        headers: {
          'x-portal-secret': this.secret,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) {
        console.error(`Ticket API ${path}: ${res.status} ${res.statusText}`);
        return null;
      }

      return res.json();
    } catch (err) {
      console.error(`Ticket API error for ${path}:`, err instanceof Error ? err.message : err);
      return null;
    }
  }

  /**
   * Search for tickets matching a subject line.
   */
  async searchBySubject(subject: string): Promise<TicketSearchResult | null> {
    // Strip RE:/FW: prefixes for better search
    const cleanSubject = subject
      .replace(/^(re|fw|fwd)\s*:\s*/gi, '')
      .replace(/^(re|fw|fwd)\s*:\s*/gi, '')
      .trim();

    const encoded = encodeURIComponent(cleanSubject);
    return this.fetch<TicketSearchResult>(`/api/tickets?search=${encoded}&limit=5`);
  }

  /**
   * Search for tickets from a specific contact email.
   */
  async searchByContactEmail(email: string): Promise<TicketSearchResult | null> {
    // First find the contact
    const contactRes = await this.fetch<{ contacts: Array<{ id: string }> }>(
      `/api/contacts?email=${encodeURIComponent(email)}`
    );
    if (!contactRes?.contacts?.[0]) return null;

    const contactId = contactRes.contacts[0].id;
    return this.fetch<TicketSearchResult>(`/api/tickets?contactId=${contactId}&excludeClosed=true&limit=10`);
  }

  /**
   * Get full ticket detail including comments (activity).
   */
  async getTicket(ticketId: string): Promise<TicketDetail | null> {
    return this.fetch<TicketDetail>(`/api/tickets/${ticketId}`);
  }

  /**
   * Check if a ticket has active team engagement.
   * Returns true if the ticket is assigned and has non-email agent comments.
   */
  async isTicketBeingWorked(ticketId: string): Promise<boolean> {
    const detail = await this.getTicket(ticketId);
    if (!detail) return false;

    // Ticket is being worked if:
    // 1. It's assigned to someone AND
    // 2. Status is IN_PROGRESS or has agent comments
    if (!detail.assignedTo) return false;
    if (detail.status === 'IN_PROGRESS') return true;

    // Check if any non-internal, non-email agent comment exists
    const agentComments = detail.comments.filter(
      c => c.source === 'PORTAL' && !c.isInternal && c.author
    );
    return agentComments.length > 0;
  }

  /**
   * For a given thread, check if a matching ticket exists in the ticket system.
   * Matches by subject and/or sender email.
   *
   * Returns ticket info if found, including whether it's actively being worked.
   */
  async findMatchingTicket(
    subject: string,
    clientEmail: string,
  ): Promise<{
    found: boolean;
    ticketId?: string;
    ticketNumber?: number;
    status?: string;
    assignedTo?: string;
    isBeingWorked: boolean;
  }> {
    // Strategy: search by subject first (more specific), then by contact email
    const bySubject = await this.searchBySubject(subject);

    if (bySubject?.tickets && bySubject.tickets.length > 0) {
      // Find the best match — prefer open/in_progress tickets from the same contact
      const match = bySubject.tickets.find(t =>
        t.contact?.email?.toLowerCase() === clientEmail.toLowerCase()
      ) ?? bySubject.tickets[0];

      const isBeingWorked = await this.isTicketBeingWorked(match.id);

      return {
        found: true,
        ticketId: match.id,
        ticketNumber: match.ticketNumber,
        status: match.status,
        assignedTo: match.assignedTo?.name ?? undefined,
        isBeingWorked,
      };
    }

    // Fallback: search by contact email for any open tickets
    const byEmail = await this.searchByContactEmail(clientEmail);

    if (byEmail?.tickets && byEmail.tickets.length > 0) {
      // Check if any of these tickets have a similar subject
      const normalizedSubject = subject.replace(/^(re|fw|fwd)\s*:\s*/gi, '').trim().toLowerCase();
      const match = byEmail.tickets.find(t =>
        t.title.toLowerCase().includes(normalizedSubject) ||
        normalizedSubject.includes(t.title.toLowerCase())
      );

      if (match) {
        const isBeingWorked = await this.isTicketBeingWorked(match.id);
        return {
          found: true,
          ticketId: match.id,
          ticketNumber: match.ticketNumber,
          status: match.status,
          assignedTo: match.assignedTo?.name ?? undefined,
          isBeingWorked,
        };
      }
    }

    return { found: false, isBeingWorked: false };
  }

  /**
   * Run ticket matching for all open client threads.
   * Creates delegation records for threads with matching tickets.
   */
  async matchTicketsForAllThreads(userId: string): Promise<number> {
    if (!this.secret) return 0;

    const threads = await prisma.thread.findMany({
      where: {
        userId,
        status: 'OPEN',
        clientMessageCount: { gt: 0 },
        hasTicket: false,
      },
      include: {
        messages: {
          where: { isExternal: true, isClientRelated: true },
          orderBy: { receivedAt: 'desc' },
          take: 1,
        },
      },
    });

    let matched = 0;

    for (const thread of threads) {
      const clientEmail = thread.messages[0]?.senderEmail;
      if (!clientEmail) continue;

      try {
        const result = await this.findMatchingTicket(thread.subject, clientEmail);

        if (result.found) {
          await prisma.delegation.create({
            data: {
              threadId: thread.id,
              type: 'TICKET_CREATED',
              ticketId: result.ticketId,
              ticketNumber: result.ticketNumber,
              delegatedTo: result.assignedTo ?? 'unassigned',
              notes: result.isBeingWorked
                ? `Ticket #${result.ticketNumber} (${result.status}) — being worked by ${result.assignedTo}`
                : `Ticket #${result.ticketNumber} (${result.status}) — needs attention`,
              userId,
            },
          });

          // If ticket is being actively worked, mark thread as delegated
          // If ticket exists but isn't being worked, flag it but keep thread OPEN
          if (result.isBeingWorked) {
            await prisma.thread.update({
              where: { id: thread.id },
              data: { hasTicket: true, hasDelegation: true, status: 'DELEGATED' },
            });
          } else {
            await prisma.thread.update({
              where: { id: thread.id },
              data: { hasTicket: true },
            });
          }

          matched++;
        }
      } catch (err) {
        console.error(`Ticket match failed for thread ${thread.id}:`, err);
      }
    }

    await prisma.auditLog.create({
      data: { action: 'ticket_match_completed', userId, details: toJson({ matched, total: threads.length }) },
    });

    return matched;
  }
}

export const ticketService = new TicketService();
