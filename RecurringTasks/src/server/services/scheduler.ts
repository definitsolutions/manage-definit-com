import cron from 'node-cron';
import { config } from '../config.js';
import { logger } from '../lib/logger.js';
import { prisma } from '../lib/db.js';
import { taskGenerationService } from './task-generation.js';

class SchedulerService {
  private task: cron.ScheduledTask | null = null;

  start(): void {
    if (this.task) {
      logger.warn('Scheduler already running');
      return;
    }

    logger.info({ schedule: config.generationSchedule }, 'Starting task generation scheduler');

    this.task = cron.schedule(config.generationSchedule, async () => {
      await this.runGeneration();
    });

    // Run initial generation on startup (after a short delay)
    setTimeout(() => {
      this.runGeneration().catch((err) => {
        logger.error({ error: err.message }, 'Initial task generation failed');
      });
    }, 5000);
  }

  stop(): void {
    if (this.task) {
      this.task.stop();
      this.task = null;
      logger.info('Scheduler stopped');
    }
  }

  async runGeneration(): Promise<void> {
    logger.info('Starting scheduled task generation');

    try {
      // Ensure system user exists for audit trail
      const systemUser = await this.getOrCreateSystemUser();
      const result = await taskGenerationService.generateAll(systemUser.id);
      logger.info(result, 'Scheduled task generation completed');
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : 'Unknown error' },
        'Scheduled task generation failed'
      );
    }
  }

  private async getOrCreateSystemUser() {
    let user = await prisma.user.findUnique({
      where: { portalUserId: 'system' },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          portalUserId: 'system',
          email: 'system@recurring-tasks.internal',
          displayName: 'System',
        },
      });
    }

    return user;
  }
}

export const schedulerService = new SchedulerService();
