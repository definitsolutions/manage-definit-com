import prisma from '@/lib/prisma';
import { rulesEngine } from './rules-engine.service';
import { aiService } from './ai.service';
import { delegationService } from './delegation.service';
import { ticketService } from './ticket.service';
import { configService } from './config.service';
import { extractDomain } from '@/lib/utils';
import type { DashboardStats, ThreadListItem, ThreadDetailView, ThreadFilter } from '@/types';
import type { FlagType } from '@prisma/client';

/**
 * ThreadAnalysisService orchestrates the full analysis pipeline:
 * 1. Delegation detection (forwards, ticket matches)
 * 2. Rules engine (deterministic flags)
 * 3. AI analysis (summaries, recommendations)
 */
export class ThreadAnalysisService {
  /**
   * Run the full V2 analysis pipeline:
   * delegation → ticket match → rules → AI
   */
  async runFullAnalysis(userId: string, includeAI = true): Promise<{
    flags: number;
    aiAnalyzed: number;
    delegationsFound: number;
    ticketsMatched: number;
  }> {
    // Step 1: Detect delegations (forwards to helpdesk, team, etc.)
    let delegationsFound = 0;
    let ticketsMatched = 0;
    try {
      const delegationResult = await delegationService.detectDelegations(userId);
      delegationsFound = delegationResult.delegationsFound;
    } catch (err) {
      console.error('Delegation detection failed:', err);
    }

    // Step 2: Match against ticket system
    try {
      ticketsMatched = await ticketService.matchTicketsForAllThreads(userId);
    } catch (err) {
      console.error('Ticket matching failed:', err);
    }

    // Step 3: Run rules engine (only on non-delegated threads)
    const flags = await rulesEngine.analyzeAllThreads(userId);

    // Step 4: AI analysis on flagged threads
    let aiAnalyzed = 0;
    if (includeAI && process.env.OPENAI_API_KEY) {
      try {
        aiAnalyzed = await aiService.analyzeAllFlaggedThreads(userId);
      } catch (err) {
        console.error('AI analysis batch failed:', err);
      }
    }

    return { flags, aiAnalyzed, delegationsFound, ticketsMatched };
  }

  /**
   * Get dashboard summary stats.
   */
  async getDashboardStats(userId: string): Promise<DashboardStats> {
    const [needsReply, waitingOnTeam, staleThreads, promisesMade, vipHighPriority, totalFlagged, delegated, hasTicket] =
      await Promise.all([
        prisma.threadFlag.count({
          where: {
            thread: { userId, status: 'OPEN' },
            flagType: { in: ['CLIENT_AWAITING_REPLY', 'NO_INTERNAL_REPLY'] },
            isResolved: false,
          },
        }),
        prisma.thread.count({
          where: {
            userId,
            status: 'OPEN',
            lastSenderIsClient: false,
            clientMessageCount: { gt: 0 },
            flags: { some: { isResolved: false } },
          },
        }),
        prisma.threadFlag.count({
          where: {
            thread: { userId, status: 'OPEN' },
            flagType: 'STALE_THREAD',
            isResolved: false,
          },
        }),
        prisma.threadFlag.count({
          where: {
            thread: { userId, status: 'OPEN' },
            flagType: 'COMMITMENT_NO_FOLLOWUP',
            isResolved: false,
          },
        }),
        prisma.threadFlag.count({
          where: {
            thread: { userId, status: 'OPEN' },
            flagType: 'VIP_NEEDS_ATTENTION',
            isResolved: false,
          },
        }),
        prisma.thread.count({
          where: {
            userId,
            status: 'OPEN',
            flags: { some: { isResolved: false } },
          },
        }),
        prisma.thread.count({
          where: { userId, status: 'DELEGATED' },
        }),
        prisma.thread.count({
          where: { userId, hasTicket: true },
        }),
      ]);

    return { needsReply, waitingOnTeam, staleThreads, promisesMade, vipHighPriority, totalFlagged, delegated, hasTicket };
  }

  /**
   * Get filtered thread list for the dashboard.
   */
  async getThreadList(userId: string, filter: ThreadFilter = 'flagged', statusFilter?: string): Promise<ThreadListItem[]> {
    const flagTypeFilter = this.getFilterFlagTypes(filter);

    const where: Record<string, unknown> = { userId };

    // Status filter
    if (statusFilter === 'reviewed') {
      where.status = 'REVIEWED';
    } else if (statusFilter === 'dismissed') {
      where.status = 'DISMISSED';
    } else if (statusFilter === 'delegated') {
      where.status = 'DELEGATED';
    } else {
      // Default: show OPEN threads (and REVIEWED if filter is 'all')
      where.status = filter === 'all' ? { in: ['OPEN', 'REVIEWED'] } : 'OPEN';
    }

    if (!statusFilter && filter !== 'all') {
      where.flags = {
        some: {
          isResolved: false,
          ...(flagTypeFilter ? { flagType: { in: flagTypeFilter } } : {}),
        },
      };
    }

    const threads = await prisma.thread.findMany({
      where,
      include: {
        flags: { where: { isResolved: false } },
        aiAnalyses: { orderBy: { analyzedAt: 'desc' }, take: 1 },
        delegations: { orderBy: { detectedAt: 'desc' }, take: 1 },
        messages: {
          orderBy: { receivedAt: 'desc' },
          take: 1,
          select: { senderEmail: true },
        },
      },
      orderBy: { priorityScore: 'desc' },
      take: 100,
    });

    // Load client domain mapping for company names
    const clientDomains = await prisma.clientDomain.findMany({ where: { isActive: true } });
    const domainToCompany = new Map(clientDomains.map((d) => [d.domain, d.companyName]));

    return threads.map((t): ThreadListItem => {
      const lastSenderDomain = t.lastSenderEmail ? extractDomain(t.lastSenderEmail) : null;
      const companyName = lastSenderDomain ? domainToCompany.get(lastSenderDomain) ?? null : null;
      const latestAI = t.aiAnalyses[0] ?? null;

      return {
        id: t.id,
        conversationId: t.conversationId,
        subject: t.subject,
        lastMessageAt: t.lastMessageAt.toISOString(),
        lastClientMessageAt: t.lastClientMessageAt?.toISOString() ?? null,
        lastSenderEmail: t.lastSenderEmail,
        lastSenderIsClient: t.lastSenderIsClient,
        messageCount: t.messageCount,
        clientMessageCount: t.clientMessageCount,
        priorityScore: t.priorityScore,
        status: t.status,
        companyName,
        flags: t.flags.map((f) => ({
          id: f.id,
          flagType: f.flagType,
          severity: f.severity,
          description: f.description,
        })),
        aiSummary: latestAI?.summary ?? null,
        suggestedAction: latestAI?.suggestedAction ?? null,
        hasDelegation: t.hasDelegation,
        hasTicket: t.hasTicket,
        delegationInfo: t.delegations[0]?.notes ?? null,
      };
    });
  }

  /**
   * Get full thread detail with messages and AI analysis.
   */
  async getThreadDetail(threadId: string): Promise<ThreadDetailView | null> {
    const thread = await prisma.thread.findUnique({
      where: { id: threadId },
      include: {
        flags: { where: { isResolved: false } },
        aiAnalyses: { orderBy: { analyzedAt: 'desc' }, take: 1 },
        delegations: { orderBy: { detectedAt: 'desc' }, take: 1 },
        messages: { orderBy: { receivedAt: 'asc' } },
      },
    });

    if (!thread) return null;

    const clientDomains = await prisma.clientDomain.findMany({ where: { isActive: true } });
    const domainToCompany = new Map(clientDomains.map((d) => [d.domain, d.companyName]));
    const lastSenderDomain = thread.lastSenderEmail ? extractDomain(thread.lastSenderEmail) : null;
    const companyName = lastSenderDomain ? domainToCompany.get(lastSenderDomain) ?? null : null;
    const latestAI = thread.aiAnalyses[0] ?? null;

    return {
      id: thread.id,
      conversationId: thread.conversationId,
      subject: thread.subject,
      lastMessageAt: thread.lastMessageAt.toISOString(),
      lastClientMessageAt: thread.lastClientMessageAt?.toISOString() ?? null,
      lastSenderEmail: thread.lastSenderEmail,
      lastSenderIsClient: thread.lastSenderIsClient,
      messageCount: thread.messageCount,
      clientMessageCount: thread.clientMessageCount,
      priorityScore: thread.priorityScore,
      status: thread.status,
      companyName,
      reviewNote: thread.reviewNote,
      reviewedAt: thread.reviewedAt?.toISOString() ?? null,
      flags: thread.flags.map((f) => ({
        id: f.id,
        flagType: f.flagType,
        severity: f.severity,
        description: f.description,
      })),
      aiSummary: latestAI?.summary ?? null,
      suggestedAction: latestAI?.suggestedAction ?? null,
      hasDelegation: thread.hasDelegation,
      hasTicket: thread.hasTicket,
      delegationInfo: thread.delegations[0]?.notes ?? null,
      messages: thread.messages.map((m) => ({
        id: m.id,
        subject: m.subject,
        senderName: m.senderName,
        senderEmail: m.senderEmail,
        recipientEmails: m.recipientEmails,
        receivedAt: m.receivedAt.toISOString(),
        isRead: m.isRead,
        bodyPreview: m.bodyPreview,
        direction: m.direction,
        isExternal: m.isExternal,
        isClientRelated: m.isClientRelated,
        categories: m.categories,
        importance: m.importance,
      })),
      aiAnalysis: latestAI
        ? {
            id: latestAI.id,
            summary: latestAI.summary,
            classification: latestAI.classification,
            priority: latestAI.priority,
            suggestedAction: latestAI.suggestedAction,
            explanation: latestAI.explanation,
            draftReply: latestAI.draftReply,
            model: latestAI.model,
            analyzedAt: latestAI.analyzedAt.toISOString(),
          }
        : null,
    };
  }

  /**
   * Mark a thread as reviewed with an optional note.
   */
  async reviewThread(threadId: string, note?: string): Promise<void> {
    await prisma.thread.update({
      where: { id: threadId },
      data: {
        status: 'REVIEWED',
        reviewedAt: new Date(),
        reviewNote: note ?? null,
      },
    });

    await prisma.auditLog.create({
      data: { action: 'thread_reviewed', details: JSON.parse(JSON.stringify({ threadId, note })) },
    });
  }

  /**
   * Dismiss a thread — mark it as not needing attention.
   */
  async dismissThread(threadId: string, note?: string): Promise<void> {
    await prisma.thread.update({
      where: { id: threadId },
      data: { status: 'DISMISSED', reviewedAt: new Date(), reviewNote: note },
    });

    // Resolve all flags
    await prisma.threadFlag.updateMany({
      where: { threadId, isResolved: false },
      data: { isResolved: true, resolvedAt: new Date() },
    });
  }

  /**
   * Reopen a dismissed/reviewed thread.
   */
  async reopenThread(threadId: string): Promise<void> {
    await prisma.thread.update({
      where: { id: threadId },
      data: { status: 'OPEN', reviewedAt: null, reviewNote: null },
    });
  }

  private getFilterFlagTypes(filter: ThreadFilter): FlagType[] | null {
    switch (filter) {
      case 'needs_reply':
        return ['CLIENT_AWAITING_REPLY', 'NO_INTERNAL_REPLY'];
      case 'waiting_on_team':
        return ['NO_INTERNAL_REPLY'];
      case 'stale':
        return ['STALE_THREAD'];
      case 'promises':
        return ['COMMITMENT_NO_FOLLOWUP'];
      case 'vip':
        return ['VIP_NEEDS_ATTENTION'];
      case 'flagged':
      case 'all':
        return null;
    }
  }
}

export const threadAnalysisService = new ThreadAnalysisService();
