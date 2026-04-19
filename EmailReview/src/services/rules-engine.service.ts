import prisma from '@/lib/prisma';
import { configService } from './config.service';
import { extractDomain, hoursSince, containsAny } from '@/lib/utils';
import type { FlagType, FlagSeverity, Thread, Message } from '@prisma/client';

interface FlagCandidate {
  flagType: FlagType;
  severity: FlagSeverity;
  description: string;
  metadata?: Record<string, unknown>;
}

/**
 * RulesEngine applies deterministic detection rules to threads.
 * This is the source of truth — AI enhances but doesn't replace these checks.
 */
export class RulesEngine {
  /**
   * Analyze all open threads for a user and generate/update flags.
   * Returns the number of new flags generated.
   */
  async analyzeAllThreads(userId: string): Promise<number> {
    const config = await configService.getConfig();
    const vipContacts = await prisma.vipContact.findMany({ where: { isActive: true } });
    const vipEmailSet = new Set(vipContacts.map((v) => v.email));
    const vipDomainMap = new Map(vipContacts.map((v) => [v.email, v]));

    const threads = await prisma.thread.findMany({
      where: { userId, status: { in: ['OPEN', 'REVIEWED'] }, clientMessageCount: { gt: 0 } },
      include: { messages: { orderBy: { receivedAt: 'asc' } } },
    });

    let flagCount = 0;

    for (const thread of threads) {
      const flags = this.evaluateThread(thread, thread.messages, config, vipEmailSet, vipDomainMap);

      // Clear old unresolved flags for this thread and replace
      await prisma.threadFlag.deleteMany({
        where: { threadId: thread.id, isResolved: false },
      });

      for (const flag of flags) {
        await prisma.threadFlag.create({
          data: {
            threadId: thread.id,
            flagType: flag.flagType,
            severity: flag.severity,
            description: flag.description,
            metadata: flag.metadata ? (JSON.parse(JSON.stringify(flag.metadata)) as object) : undefined,
          },
        });
        flagCount++;
      }

      // Update thread priority score
      const score = this.calculatePriorityScore(flags);
      await prisma.thread.update({
        where: { id: thread.id },
        data: { priorityScore: score },
      });
    }

    return flagCount;
  }

  /**
   * Evaluate a single thread against all rules.
   */
  private evaluateThread(
    thread: Thread & { messages: Message[] },
    messages: Message[],
    config: { staleHours: number; unreadHours: number; urgencyKeywords: string[]; commitmentPhrases: string[] },
    vipEmails: Set<string>,
    vipMap: Map<string, { priority: number; name: string | null; companyName: string | null }>,
  ): FlagCandidate[] {
    const flags: FlagCandidate[] = [];
    if (messages.length === 0) return flags;

    const clientMessages = messages.filter((m) => m.isExternal && m.isClientRelated);
    const internalMessages = messages.filter((m) => !m.isExternal);
    const lastMessage = messages[messages.length - 1];
    const lastClientMsg = clientMessages[clientMessages.length - 1];

    // Skip threads with no client involvement — nothing to follow up on
    if (clientMessages.length === 0) return flags;

    // ── Rule 1: Unread client email older than threshold ──
    const unreadClientMessages = clientMessages.filter((m) => !m.isRead);
    for (const m of unreadClientMessages) {
      const hours = hoursSince(m.receivedAt);
      if (hours >= config.unreadHours) {
        flags.push({
          flagType: 'UNREAD_AGED',
          severity: hours >= config.unreadHours * 2 ? 'HIGH' : 'MEDIUM',
          description: `Unread client email from ${m.senderEmail} (${Math.round(hours)}h ago)`,
          metadata: { messageId: m.id, senderEmail: m.senderEmail, hoursOld: Math.round(hours) },
        });
      }
    }

    // ── Rule 2: Last sender was client (awaiting reply) ──
    if (lastMessage.isExternal && lastMessage.isClientRelated) {
      const hours = hoursSince(lastMessage.receivedAt);
      if (hours >= 4) { // Flag if no reply for 4+ hours
        flags.push({
          flagType: 'CLIENT_AWAITING_REPLY',
          severity: hours >= 24 ? 'HIGH' : 'MEDIUM',
          description: `Client is waiting for a reply (${Math.round(hours)}h since last client message)`,
          metadata: { lastClientEmail: lastMessage.senderEmail, hoursSince: Math.round(hours) },
        });
      }
    }

    // ── Rule 3: No internal reply after client message ──
    if (lastClientMsg && internalMessages.length > 0) {
      const lastInternal = internalMessages[internalMessages.length - 1];
      if (lastClientMsg.receivedAt > lastInternal.receivedAt) {
        const hours = hoursSince(lastClientMsg.receivedAt);
        if (hours >= 8) {
          flags.push({
            flagType: 'NO_INTERNAL_REPLY',
            severity: hours >= 48 ? 'CRITICAL' : hours >= 24 ? 'HIGH' : 'MEDIUM',
            description: `No internal reply since client message ${Math.round(hours)}h ago`,
            metadata: { hoursSince: Math.round(hours) },
          });
        }
      }
    } else if (lastClientMsg && internalMessages.length === 0) {
      // Thread has client messages but no internal replies at all
      const hours = hoursSince(lastClientMsg.receivedAt);
      flags.push({
        flagType: 'NO_INTERNAL_REPLY',
        severity: hours >= 24 ? 'CRITICAL' : 'HIGH',
        description: `No internal reply at all — client first wrote ${Math.round(hours)}h ago`,
        metadata: { hoursSince: Math.round(hours), noReplyAtAll: true },
      });
    }

    // ── Rule 4: Stale thread ──
    const threadHours = hoursSince(thread.lastMessageAt);
    if (threadHours >= config.staleHours && thread.clientMessageCount > 0) {
      flags.push({
        flagType: 'STALE_THREAD',
        severity: threadHours >= config.staleHours * 2 ? 'HIGH' : 'MEDIUM',
        description: `Thread stale — no activity for ${Math.round(threadHours)}h`,
        metadata: { hoursSinceActivity: Math.round(threadHours) },
      });
    }

    // ── Rule 5: Urgency language in client messages ──
    for (const m of clientMessages) {
      const text = `${m.subject} ${m.bodyPreview}`;
      const matched = containsAny(text, config.urgencyKeywords);
      if (matched.length > 0) {
        flags.push({
          flagType: 'URGENCY_LANGUAGE',
          severity: matched.some((k) => ['outage', 'down', 'emergency', 'critical', 'compromised', 'breach'].includes(k))
            ? 'CRITICAL'
            : 'HIGH',
          description: `Urgency detected: "${matched.join('", "')}"`,
          metadata: { matchedKeywords: matched, messageId: m.id },
        });
        break; // One flag per thread for urgency
      }
    }

    // ── Rule 6: Commitment detection (promises in sent mail) ──
    for (const m of internalMessages) {
      const text = m.bodyPreview.toLowerCase();
      const matched = containsAny(text, config.commitmentPhrases);
      if (matched.length > 0) {
        // Check if a follow-up happened after this message
        const laterMessages = internalMessages.filter(
          (later) => later.receivedAt > m.receivedAt && later.id !== m.id
        );
        const followedUp = laterMessages.length > 0;

        if (!followedUp) {
          const hours = hoursSince(m.receivedAt);
          if (hours >= 24) { // Only flag if commitment is >24h old with no follow-up
            flags.push({
              flagType: 'COMMITMENT_NO_FOLLOWUP',
              severity: hours >= 72 ? 'HIGH' : 'MEDIUM',
              description: `Possible unfulfilled commitment: "${matched[0]}" (${Math.round(hours)}h ago)`,
              metadata: { matchedPhrases: matched, messageId: m.id, hoursSince: Math.round(hours) },
            });
            break; // One commitment flag per thread
          }
        }
      }
    }

    // ── Rule 7: VIP needs attention ──
    const vipSenders = clientMessages.filter((m) => vipEmails.has(m.senderEmail));
    if (vipSenders.length > 0) {
      const lastVipMsg = vipSenders[vipSenders.length - 1];
      const vipInfo = vipMap.get(lastVipMsg.senderEmail);
      const hasRecentReply = internalMessages.some((m) => m.receivedAt > lastVipMsg.receivedAt);

      if (!hasRecentReply) {
        flags.push({
          flagType: 'VIP_NEEDS_ATTENTION',
          severity: (vipInfo?.priority ?? 1) >= 3 ? 'CRITICAL' : 'HIGH',
          description: `VIP ${vipInfo?.name ?? lastVipMsg.senderEmail} (${vipInfo?.companyName ?? 'unknown'}) awaiting response`,
          metadata: {
            vipEmail: lastVipMsg.senderEmail,
            vipName: vipInfo?.name,
            vipPriority: vipInfo?.priority,
          },
        });
      }
    }

    return flags;
  }

  /**
   * Calculate a 0-100 priority score from flags.
   */
  private calculatePriorityScore(flags: FlagCandidate[]): number {
    if (flags.length === 0) return 0;

    let score = 0;

    for (const flag of flags) {
      // Base points by severity
      switch (flag.severity) {
        case 'CRITICAL': score += 30; break;
        case 'HIGH': score += 20; break;
        case 'MEDIUM': score += 10; break;
        case 'LOW': score += 5; break;
      }

      // Bonus points by flag type
      switch (flag.flagType) {
        case 'VIP_NEEDS_ATTENTION': score += 10; break;
        case 'URGENCY_LANGUAGE': score += 8; break;
        case 'COMMITMENT_NO_FOLLOWUP': score += 5; break;
        default: break;
      }
    }

    return Math.min(100, score);
  }
}

export const rulesEngine = new RulesEngine();
