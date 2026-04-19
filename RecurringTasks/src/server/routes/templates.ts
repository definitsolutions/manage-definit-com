import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/db.js';
import { authorizationService } from '../services/authorization.js';
import { auditService } from '../services/audit.js';
import { taskGenerationService } from '../services/task-generation.js';

export async function templateRoutes(app: FastifyInstance) {
  // GET /api/templates?departmentId=
  app.get('/', async (request, reply) => {
    const { departmentId } = request.query as { departmentId?: string };

    if (!departmentId) {
      return reply.status(400).send({ error: 'departmentId is required' });
    }

    await authorizationService.assertMember(request.user.id, departmentId);

    const templates = await prisma.taskTemplate.findMany({
      where: { departmentId },
      include: {
        defaultOwner: { select: { id: true, displayName: true, email: true } },
        defaultBackupOwner: { select: { id: true, displayName: true, email: true } },
        createdBy: { select: { id: true, displayName: true } },
        _count: { select: { taskInstances: true } },
      },
      orderBy: { title: 'asc' },
    });

    return { templates };
  });

  // POST /api/templates
  app.post('/', async (request, reply) => {
    const body = request.body as any;

    if (!body.departmentId || !body.title || !body.cadence || !body.recurrenceRule) {
      return reply.status(400).send({ error: 'departmentId, title, cadence, and recurrenceRule are required' });
    }

    await authorizationService.assertManagerOrAdmin(request.user.id, body.departmentId);

    const template = await prisma.taskTemplate.create({
      data: {
        departmentId: body.departmentId,
        title: body.title,
        description: body.description || null,
        cadence: body.cadence,
        recurrenceRule: body.recurrenceRule,
        defaultOwnerId: body.defaultOwnerId || null,
        defaultBackupOwnerId: body.defaultBackupOwnerId || null,
        proofRequired: body.proofRequired || false,
        sopUrl: body.sopUrl || null,
        active: body.active !== false,
        createdById: request.user.id,
        updatedById: request.user.id,
      },
      include: {
        defaultOwner: { select: { id: true, displayName: true, email: true } },
        createdBy: { select: { id: true, displayName: true } },
      },
    });

    await auditService.log({
      entityType: 'template',
      entityId: template.id,
      action: 'create',
      actorUserId: request.user.id,
    });

    // Trigger generation for this template
    const genResult = await taskGenerationService.generateForTemplate(template.id, request.user.id);

    return reply.status(201).send({ template, generated: genResult });
  });

  // PATCH /api/templates/:id
  app.patch('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;

    const existing = await prisma.taskTemplate.findUnique({ where: { id } });
    if (!existing) {
      return reply.status(404).send({ error: 'Template not found' });
    }

    await authorizationService.assertManagerOrAdmin(request.user.id, existing.departmentId);

    const updateData: any = { updatedById: request.user.id };
    const trackFields = ['title', 'description', 'cadence', 'recurrenceRule', 'defaultOwnerId', 'defaultBackupOwnerId', 'proofRequired', 'sopUrl', 'active'];

    for (const field of trackFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    const template = await prisma.taskTemplate.update({
      where: { id },
      data: updateData,
      include: {
        defaultOwner: { select: { id: true, displayName: true, email: true } },
        createdBy: { select: { id: true, displayName: true } },
      },
    });

    const changedFields = auditService.diff(existing as any, template as any, trackFields);
    await auditService.log({
      entityType: 'template',
      entityId: template.id,
      action: 'update',
      changedFields: changedFields ?? undefined,
      actorUserId: request.user.id,
    });

    return { template };
  });

  // DELETE /api/templates/:id
  app.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const existing = await prisma.taskTemplate.findUnique({ where: { id } });
    if (!existing) {
      return reply.status(404).send({ error: 'Template not found' });
    }

    await authorizationService.assertManagerOrAdmin(request.user.id, existing.departmentId);

    // Delete associated task instances first (only future, not-started ones)
    const deleted = await prisma.taskInstance.deleteMany({
      where: { templateId: id, status: 'not_started' },
    });

    await prisma.taskTemplate.delete({ where: { id } });

    await auditService.log({
      entityType: 'template',
      entityId: id,
      action: 'delete',
      changedFields: { title: { old: existing.title, new: null }, deletedInstances: { old: 0, new: deleted.count } },
      actorUserId: request.user.id,
    });

    return { success: true, deletedInstances: deleted.count };
  });
}
