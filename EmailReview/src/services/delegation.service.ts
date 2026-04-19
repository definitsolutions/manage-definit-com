import prisma from '@/lib/prisma';
import { extractDomain } from '@/lib/utils';
import type { Thread, Message } from '@prisma/client';

/**
 * DelegationService detects when threads have been handled through
 * other channels: forwarded to helpdesk, forwarded to team members,
 * matched to tickets, or discussed in Teams.
 *
 * This reduces false positives in the rules engine — if a thread
 * is delegated, it shouldn't be flagged as "needs reply."
 */
export class DelegationService {
  /**
   * Run delegation detection for all open client threads.
   * Returns count of newly detected delegations.
   */
  async detectDelegations(userId: string): Promise<{ delegationsFound: number; ticketsMatched: number }> {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const userDomain = extractDomain(user.email);

    // Load team members for internal forward detection
    const teamMembers = await prisma.teamMember.findMany({ where: { isActive: true } });
    const teamEmailSet = new Set(teamMembers.map(t => t.email.toLowerCase()));
    // Also treat any @definit.com address as internal team
    const helpdeskEmail = 'helpdesk@definit.com';

    // Get all open threads with client messages
    const threads = await prisma.thread.findMany({
      where: { userId, status: 'OPEN', clientMessageCount: { gt: 0 } },
      include: {
        messages: { orderBy: { receivedAt: 'asc' } },
        delegations: true,
      },
    });

    // Get ALL outbound messages for this user (for forward detection across threads)
    const allSentMessages = await prisma.message.findMany({
      where: { userId, direction: 'OUTBOUND' },
      select: { id: true, subject: true, recipientEmails: true, ccEmails: true, receivedAt: true, senderEmail: true },
      orderBy: { receivedAt: 'desc' },
    });

    let delegationsFound = 0;
    let ticketsMatched = 0;

    for (const thread of threads) {
      // Skip if already has delegation records
      if (thread.delegations.length > 0) continue;

      const result = await this.detectThreadDelegation(
        thread,
        thread.messages,
        allSentMessages,
        userDomain,
        helpdeskEmail,
        teamEmailSet,
        userId,
      );

      if (result.delegated) {
        delegationsFound++;
        if (result.hasTicket) ticketsMatched++;
      }
    }

    return { delegationsFound, ticketsMatched };
  }

  /**
   * Detect delegation for a single thread.
   */
  private async detectThreadDelegation(
    thread: Thread,
    messages: Message[],
    allSentMessages: Array<{ id: string; subject: string; recipientEmails: string[]; ccEmails: string[]; receivedAt: Date; senderEmail: string }>,
    userDomain: string,
    helpdeskEmail: string,
    teamEmails: Set<string>,
    userId: string,
  ): Promise<{ delegated: boolean; hasTicket: boolean }> {
    const clientMessages = messages.filter(m => m.isExternal && m.isClientRelated);
    if (clientMessages.length === 0) return { delegated: false, hasTicket: false };

    const normalizedSubject = normalizeSubject(thread.subject);
    let delegated = false;
    let hasTicket = false;

    // ── Check 1: Was helpdesk@ in the recipients or CC of any inbound client message?
    // This means the client CC'd helpdesk AND the owner — ticket system has it.
    for (const msg of clientMessages) {
      const allRecipients = [...msg.recipientEmails, ...msg.ccEmails].map(e => e.toLowerCase());
      if (allRecipients.includes(helpdeskEmail)) {
        await prisma.delegation.create({
          data: {
            threadId: thread.id,
            type: 'FORWARDED_TO_HELPDESK',
            delegatedTo: helpdeskEmail,
            notes: 'Client CC\'d helpdesk — ticket likely created automatically',
            userId,
          },
        });
        delegated = true;
        hasTicket = true;
        break;
      }
    }

    // ── Check 2: Did the owner forward this thread to helpdesk?
    // Look for outbound messages with "FW:" + matching subject sent to helpdesk
    if (!delegated) {
      const forwardToHelpdesk = allSentMessages.find(sent => {
        const sentSubjectNorm = normalizeSubject(sent.subject);
        const recipients = [...sent.recipientEmails, ...(sent.ccEmails ?? [])].map(e => e.toLowerCase());
        return (
          recipients.includes(helpdeskEmail) &&
          (sentSubjectNorm === normalizedSubject || sent.subject.toLowerCase().includes(normalizedSubject.toLowerCase()))
        );
      });

      if (forwardToHelpdesk) {
        await prisma.delegation.create({
          data: {
            threadId: thread.id,
            type: 'FORWARDED_TO_HELPDESK',
            delegatedTo: helpdeskEmail,
            notes: `Forwarded to helpdesk on ${forwardToHelpdesk.receivedAt.toISOString().slice(0, 10)}`,
            userId,
          },
        });
        delegated = true;
        hasTicket = true;
      }
    }

    // ── Check 3: Did the owner forward to an internal team member?
    if (!delegated) {
      const forwardToTeam = allSentMessages.find(sent => {
        const sentSubjectNorm = normalizeSubject(sent.subject);
        const recipients = sent.recipientEmails.map(e => e.toLowerCase());
        const isRelatedSubject =
          sentSubjectNorm === normalizedSubject ||
          sent.subject.toLowerCase().includes(normalizedSubject.toLowerCase());
        if (!isRelatedSubject) return false;

        // Check if any recipient is a team member or internal (same domain, not the owner)
        return recipients.some(r =>
          (teamEmails.has(r) || extractDomain(r) === userDomain) && r !== sent.senderEmail.toLowerCase()
        );
      });

      if (forwardToTeam) {
        const delegatee = forwardToTeam.recipientEmails.find(r => {
          const rl = r.toLowerCase();
          return (teamEmails.has(rl) || extractDomain(rl) === userDomain) && rl !== forwardToTeam.senderEmail.toLowerCase();
        });

        await prisma.delegation.create({
          data: {
            threadId: thread.id,
            type: 'FORWARDED_TO_TEAM',
            delegatedTo: delegatee ?? 'internal team',
            notes: `Forwarded to team on ${forwardToTeam.receivedAt.toISOString().slice(0, 10)}`,
            userId,
          },
        });
        delegated = true;
      }
    }

    // ── Check 4: Did the owner reply to the client directly? (even in a different thread)
    if (!delegated) {
      const clientEmails = new Set(clientMessages.map(m => m.senderEmail.toLowerCase()));
      const replyToClient = allSentMessages.find(sent => {
        const recipients = sent.recipientEmails.map(e => e.toLowerCase());
        const sentSubjectNorm = normalizeSubject(sent.subject);
        return (
          recipients.some(r => clientEmails.has(r)) &&
          (sentSubjectNorm === normalizedSubject || sent.subject.toLowerCase().includes(normalizedSubject.toLowerCase()))
        );
      });

      // If the owner replied directly, this isn't a "delegation" but it means
      // the thread has been handled — the internal reply check in the same
      // conversationId may have missed it if the reply was in a new thread.
      if (replyToClient) {
        // Check if this reply is already captured within the thread
        const internalRepliesInThread = messages.filter(m => !m.isExternal);
        const lastClientMsg = clientMessages[clientMessages.length - 1];
        const hasReplyAfterLastClient = internalRepliesInThread.some(
          m => m.receivedAt > lastClientMsg.receivedAt
        );

        if (!hasReplyAfterLastClient) {
          // Owner replied in a different thread — mark as handled
          await prisma.delegation.create({
            data: {
              threadId: thread.id,
              type: 'MANUAL',
              notes: `Reply sent in separate thread on ${replyToClient.receivedAt.toISOString().slice(0, 10)}`,
              userId,
            },
          });
          delegated = true;
        }
      }
    }

    // Update thread flags
    if (delegated) {
      await prisma.thread.update({
        where: { id: thread.id },
        data: {
          hasDelegation: true,
          hasTicket,
          status: 'DELEGATED',
        },
      });
    }

    return { delegated, hasTicket };
  }
}

/**
 * Strip FW:, RE:, Fwd:, etc. prefixes from a subject for matching.
 */
function normalizeSubject(subject: string): string {
  return subject
    .replace(/^(re|fw|fwd)\s*:\s*/gi, '')
    .replace(/^(re|fw|fwd)\s*:\s*/gi, '') // double strip for "RE: FW:"
    .trim()
    .toLowerCase();
}

export const delegationService = new DelegationService();
