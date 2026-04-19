import prisma from '@/lib/prisma';
import { syncService } from './sync.service';
import { taskDetectionService } from './task-detection.service';
import { aiService } from './ai.service';
import { toJson } from '@/lib/utils';

let syncInterval: ReturnType<typeof setInterval> | null = null;
let isRunning = false;

const SYNC_INTERVAL_MS = 15 * 60 * 1000;

export class SchedulerService {
  start() {
    if (syncInterval) return;
    console.log('[Scheduler] Starting Teams auto-sync every 15 minutes');
    syncInterval = setInterval(() => this.runSync(), SYNC_INTERVAL_MS);
    setTimeout(() => this.runSync(), 30_000);
  }

  stop() {
    if (syncInterval) { clearInterval(syncInterval); syncInterval = null; }
  }

  private async runSync() {
    if (isRunning) return;
    isRunning = true;
    console.log(`[Scheduler] Teams sync starting at ${new Date().toISOString()}`);

    try {
      const user = await prisma.user.findFirst({
        where: { graphRefreshToken: { not: null } },
      });
      if (!user) { console.log('[Scheduler] No users with tokens'); return; }

      const syncResult = await syncService.syncChats(user.id);
      const tasksDetected = await taskDetectionService.detectTasks(user.id);
      const completions = await taskDetectionService.detectCompletions(user.id);

      let aiClassified = 0;
      if (process.env.OPENAI_API_KEY) {
        try { aiClassified = await aiService.classifyNewTasks(user.id); } catch {}
      }

      console.log(
        `[Scheduler] Teams sync done: ${syncResult.chatsProcessed} chats, ` +
        `${syncResult.messagesProcessed} msgs, ${tasksDetected} tasks detected, ` +
        `${completions} completions, ${aiClassified} AI classified`
      );

      await prisma.auditLog.create({
        data: {
          action: 'auto_sync_completed', userId: user.id,
          details: toJson({ ...syncResult, tasksDetected, completions, aiClassified }),
        },
      });
    } catch (err) {
      console.error('[Scheduler] Teams sync failed:', err);
    } finally {
      isRunning = false;
    }
  }
}

export const schedulerService = new SchedulerService();
