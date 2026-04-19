import { prisma } from '../lib/db.js';
import { recurrenceService, RecurrenceRule } from './recurrence.js';
import { auditService } from './audit.js';
import { logger } from '../lib/logger.js';

export class TaskGenerationService {
  async generateAll(actorUserId: string): Promise<{ created: number; skipped: number }> {
    const templates = await prisma.taskTemplate.findMany({
      where: { active: true },
    });

    let totalCreated = 0;
    let totalSkipped = 0;

    for (const template of templates) {
      const result = await this.generateForTemplate(template.id, actorUserId);
      totalCreated += result.created;
      totalSkipped += result.skipped;
    }

    return { created: totalCreated, skipped: totalSkipped };
  }

  async generateForTemplate(
    templateId: string,
    actorUserId: string,
    rangeStart?: Date,
    rangeEnd?: Date
  ): Promise<{ created: number; skipped: number }> {
    const template = await prisma.taskTemplate.findUnique({
      where: { id: templateId },
    });

    if (!template || !template.active) {
      return { created: 0, skipped: 0 };
    }

    const now = new Date();
    const start = rangeStart ?? now;
    const end = rangeEnd ?? new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000); // +60 days

    const dueDates = recurrenceService.calculateDueDates(
      template.cadence,
      template.recurrenceRule as unknown as RecurrenceRule,
      start,
      end
    );

    let created = 0;
    let skipped = 0;

    for (const dueDate of dueDates) {
      try {
        const instance = await prisma.taskInstance.create({
          data: {
            templateId: template.id,
            departmentId: template.departmentId,
            title: template.title,
            description: template.description,
            dueDate,
            cadence: template.cadence,
            recurrenceRule: template.recurrenceRule ?? undefined,
            ownerId: template.defaultOwnerId,
            backupOwnerId: template.defaultBackupOwnerId,
            proofRequired: template.proofRequired,
            sopUrl: template.sopUrl,
            createdById: actorUserId,
            updatedById: actorUserId,
          },
        });

        await auditService.log({
          entityType: 'task',
          entityId: instance.id,
          action: 'create',
          actorUserId,
        });

        created++;
      } catch (error: any) {
        // P2002 = unique constraint violation (templateId + dueDate already exists)
        if (error.code === 'P2002') {
          skipped++;
        } else {
          logger.error({ error: error.message, templateId, dueDate }, 'Failed to create task instance');
          throw error;
        }
      }
    }

    logger.info({ templateId, created, skipped }, 'Task generation complete for template');
    return { created, skipped };
  }
}

export const taskGenerationService = new TaskGenerationService();
