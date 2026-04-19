import prisma from '@/lib/prisma';
import { threadAnalysisService } from './thread-analysis.service';
import { configService } from './config.service';
import { hoursSince, severityFromScore, toJson } from '@/lib/utils';
import type { DigestContent, DigestItem } from '@/types';

/**
 * DigestService generates daily executive digest reports.
 */
export class DigestService {
  /**
   * Generate a digest for a user. Returns structured content and plain text.
   */
  async generateDigest(userId: string): Promise<{ id: string; content: DigestContent; plainText: string }> {
    const config = await configService.getConfig();
    const stats = await threadAnalysisService.getDashboardStats(userId);

    // Get top flagged threads sorted by priority
    const threads = await prisma.thread.findMany({
      where: {
        userId,
        status: 'OPEN',
        flags: { some: { isResolved: false } },
      },
      include: {
        flags: { where: { isResolved: false } },
        aiAnalyses: { orderBy: { analyzedAt: 'desc' }, take: 1 },
        messages: {
          orderBy: { receivedAt: 'desc' },
          take: 1,
          select: { senderEmail: true, senderName: true },
        },
      },
      orderBy: { priorityScore: 'desc' },
      take: config.digestTopN,
    });

    // Resolve company names
    const clientDomains = await prisma.clientDomain.findMany({ where: { isActive: true } });
    const domainToCompany = new Map(clientDomains.map((d) => [d.domain, d.companyName]));

    const items: DigestItem[] = threads.map((t) => {
      const senderDomain = t.lastSenderEmail?.split('@')[1] ?? '';
      const companyName = domainToCompany.get(senderDomain) ?? null;
      const latestAI = t.aiAnalyses[0];
      const topFlag = t.flags.sort((a, b) => severityRank(b.severity) - severityRank(a.severity))[0];

      return {
        threadId: t.id,
        subject: t.subject,
        companyName,
        urgency: severityFromScore(t.priorityScore),
        summary: latestAI?.summary ?? `${t.messageCount} messages, last activity ${hoursSince(t.lastMessageAt)}h ago`,
        reasonFlagged: topFlag?.description ?? 'Multiple flags detected',
        recommendedAction: latestAI?.suggestedAction ?? 'Review thread and respond',
        hoursSinceLastClient: t.lastClientMessageAt ? hoursSince(t.lastClientMessageAt) : null,
        flagTypes: t.flags.map((f) => f.flagType),
      };
    });

    // Sort by urgency
    const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    items.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]);

    const content: DigestContent = {
      generatedAt: new Date().toISOString(),
      items,
      stats,
    };

    const plainText = this.renderPlainText(content);

    // Save the digest run
    const digestRun = await prisma.digestRun.create({
      data: {
        userId,
        itemCount: items.length,
        content: JSON.parse(JSON.stringify(content)),
        plainText,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: 'digest_generated',
        userId,
        details: toJson({ digestRunId: digestRun.id, itemCount: items.length }),
      },
    });

    return { id: digestRun.id, content, plainText };
  }

  /**
   * Get past digest runs for a user.
   */
  async getDigestHistory(userId: string, limit = 10) {
    return prisma.digestRun.findMany({
      where: { userId },
      orderBy: { generatedAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Mark a digest as viewed.
   */
  async markViewed(digestId: string): Promise<void> {
    await prisma.digestRun.update({
      where: { id: digestId },
      data: { status: 'VIEWED', viewedAt: new Date() },
    });
  }

  /**
   * Render the digest as plain text suitable for email.
   */
  private renderPlainText(digest: DigestContent): string {
    const lines: string[] = [];
    const date = new Date(digest.generatedAt).toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });

    lines.push(`EXECUTIVE EMAIL DIGEST — ${date}`);
    lines.push('='.repeat(60));
    lines.push('');

    // Stats summary
    lines.push('OVERVIEW');
    lines.push('-'.repeat(30));
    lines.push(`  Needs Reply:      ${digest.stats.needsReply}`);
    lines.push(`  Waiting on Team:  ${digest.stats.waitingOnTeam}`);
    lines.push(`  Stale Threads:    ${digest.stats.staleThreads}`);
    lines.push(`  Promises Made:    ${digest.stats.promisesMade}`);
    lines.push(`  VIP / High:       ${digest.stats.vipHighPriority}`);
    lines.push(`  Total Flagged:    ${digest.stats.totalFlagged}`);
    lines.push('');

    if (digest.items.length === 0) {
      lines.push('No items require immediate attention. All clear.');
      return lines.join('\n');
    }

    lines.push(`TOP ${digest.items.length} ITEMS REQUIRING ATTENTION`);
    lines.push('='.repeat(60));

    let currentUrgency = '';
    for (let i = 0; i < digest.items.length; i++) {
      const item = digest.items[i];

      if (item.urgency !== currentUrgency) {
        currentUrgency = item.urgency;
        lines.push('');
        lines.push(`── ${currentUrgency.toUpperCase()} ──`);
      }

      lines.push('');
      lines.push(`${i + 1}. ${item.subject}`);
      if (item.companyName) lines.push(`   Client: ${item.companyName}`);
      if (item.hoursSinceLastClient !== null) {
        lines.push(`   Last client message: ${item.hoursSinceLastClient}h ago`);
      }
      lines.push(`   Why flagged: ${item.reasonFlagged}`);
      lines.push(`   Summary: ${item.summary}`);
      lines.push(`   Recommended: ${item.recommendedAction}`);
    }

    lines.push('');
    lines.push('='.repeat(60));
    lines.push('Generated by Executive Email Review');

    return lines.join('\n');
  }
}

function severityRank(severity: string): number {
  switch (severity) {
    case 'CRITICAL': return 4;
    case 'HIGH': return 3;
    case 'MEDIUM': return 2;
    case 'LOW': return 1;
    default: return 0;
  }
}

export const digestService = new DigestService();
