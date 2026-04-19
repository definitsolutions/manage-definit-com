import { AuditAction, AuditEntityType } from '@prisma/client';
import { prisma } from '../lib/db.js';

interface AuditLogParams {
  entityType: AuditEntityType;
  entityId: string;
  action: AuditAction;
  changedFields?: Record<string, { old: unknown; new: unknown }>;
  actorUserId: string;
}

export class AuditService {
  async log(params: AuditLogParams) {
    return prisma.auditLog.create({
      data: {
        entityType: params.entityType,
        entityId: params.entityId,
        action: params.action,
        changedFields: params.changedFields ? JSON.parse(JSON.stringify(params.changedFields)) : undefined,
        actorUserId: params.actorUserId,
      },
    });
  }

  diff(oldObj: Record<string, unknown>, newObj: Record<string, unknown>, fields: string[]): Record<string, { old: unknown; new: unknown }> | null {
    const changes: Record<string, { old: unknown; new: unknown }> = {};

    for (const field of fields) {
      const oldVal = oldObj[field];
      const newVal = newObj[field];
      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        changes[field] = { old: oldVal, new: newVal };
      }
    }

    return Object.keys(changes).length > 0 ? changes : null;
  }
}

export const auditService = new AuditService();
