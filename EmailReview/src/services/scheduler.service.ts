import prisma from '@/lib/prisma';
import { syncService } from './sync.service';
import { threadAnalysisService } from './thread-analysis.service';
import { toJson } from '@/lib/utils';

/**
 * SchedulerService runs periodic background tasks:
 * - Auto-sync mailbox every 15 minutes
 * - Auto-categorize flagged messages in Outlook
 *
 * Uses setInterval (not node-cron) because Next.js standalone
 * doesn't reliably support cron imports at the module level.
 */

let syncInterval: ReturnType<typeof setInterval> | null = null;
let isRunning = false;

const SYNC_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

export class SchedulerService {
  /**
   * Start the background sync scheduler.
   * Safe to call multiple times — only starts once.
   */
  start() {
    if (syncInterval) return;

    console.log('[Scheduler] Starting auto-sync every 15 minutes');
    syncInterval = setInterval(() => this.runSync(), SYNC_INTERVAL_MS);

    // Also run immediately on first start (after 30s delay for server boot)
    setTimeout(() => this.runSync(), 30_000);
  }

  stop() {
    if (syncInterval) {
      clearInterval(syncInterval);
      syncInterval = null;
      console.log('[Scheduler] Stopped');
    }
  }

  private async runSync() {
    if (isRunning) {
      console.log('[Scheduler] Sync already running, skipping');
      return;
    }

    isRunning = true;
    console.log(`[Scheduler] Auto-sync starting at ${new Date().toISOString()}`);

    try {
      // Find the first user with a valid refresh token
      const user = await prisma.user.findFirst({
        where: { graphRefreshToken: { not: null } },
      });

      if (!user) {
        console.log('[Scheduler] No users with refresh tokens, skipping sync');
        return;
      }

      // Run full sync
      const syncResult = await syncService.syncMailbox(user.id);

      // Run analysis pipeline
      const analysisResult = await threadAnalysisService.runFullAnalysis(user.id, true);

      console.log(
        `[Scheduler] Sync complete: ${syncResult.messagesProcessed} msgs, ` +
        `${syncResult.threadsUpdated} threads, ${analysisResult.flags} flags, ` +
        `${analysisResult.delegationsFound} delegations, ${analysisResult.ticketsMatched} tickets, ` +
        `${analysisResult.aiAnalyzed} AI analyzed`
      );

      await prisma.auditLog.create({
        data: {
          action: 'auto_sync_completed',
          userId: user.id,
          details: toJson({ ...syncResult, ...analysisResult }),
        },
      });
    } catch (err) {
      console.error('[Scheduler] Auto-sync failed:', err);
      await prisma.auditLog.create({
        data: {
          action: 'auto_sync_failed',
          details: toJson({ error: err instanceof Error ? err.message : String(err) }),
        },
      });
    } finally {
      isRunning = false;
    }
  }
}

export const schedulerService = new SchedulerService();
