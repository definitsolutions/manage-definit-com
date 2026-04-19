import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/db.js';
import { authorizationService } from '../services/authorization.js';
import { auditService } from '../services/audit.js';

export async function taskRoutes(app: FastifyInstance) {
  // GET /api/tasks?departmentId=&status=&from=&to=&page=&limit=
  app.get('/', async (request, reply) => {
    const { departmentId, status, from, to, page = '1', limit = '50' } = request.query as Record<string, string>;

    if (!departmentId) {
      return reply.status(400).send({ error: 'departmentId is required' });
    }

    await authorizationService.assertMember(request.user.id, departmentId);

    const where: any = { departmentId };
    if (status) where.status = status;
    if (from || to) {
      where.dueDate = {};
      if (from) where.dueDate.gte = new Date(from);
      if (to) where.dueDate.lte = new Date(to);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [tasks, total] = await Promise.all([
      prisma.taskInstance.findMany({
        where,
        include: {
          owner: { select: { id: true, displayName: true, email: true } },
          backupOwner: { select: { id: true, displayName: true, email: true } },
          template: { select: { id: true, title: true } },
        },
        orderBy: { dueDate: 'asc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.taskInstance.count({ where }),
    ]);

    return { tasks, total, page: parseInt(page), limit: parseInt(limit) };
  });

  // GET /api/tasks/mine?status=&from=&to=&page=&limit=
  app.get('/mine', async (request) => {
    const { status, from, to, page = '1', limit = '50' } = request.query as Record<string, string>;

    const where: any = { ownerId: request.user.id };
    if (status) where.status = status;
    if (from || to) {
      where.dueDate = {};
      if (from) where.dueDate.gte = new Date(from);
      if (to) where.dueDate.lte = new Date(to);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [tasks, total] = await Promise.all([
      prisma.taskInstance.findMany({
        where,
        include: {
          owner: { select: { id: true, displayName: true, email: true } },
          backupOwner: { select: { id: true, displayName: true, email: true } },
          department: { select: { id: true, name: true } },
          template: { select: { id: true, title: true } },
        },
        orderBy: { dueDate: 'asc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.taskInstance.count({ where }),
    ]);

    return { tasks, total, page: parseInt(page), limit: parseInt(limit) };
  });

  // GET /api/tasks/:id
  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const task = await prisma.taskInstance.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, displayName: true, email: true } },
        backupOwner: { select: { id: true, displayName: true, email: true } },
        department: { select: { id: true, name: true } },
        template: { select: { id: true, title: true } },
        createdBy: { select: { id: true, displayName: true } },
        updatedBy: { select: { id: true, displayName: true } },
      },
    });

    if (!task) {
      return reply.status(404).send({ error: 'Task not found' });
    }

    await authorizationService.assertMember(request.user.id, task.departmentId);

    // Fetch audit logs for this task
    const auditLogs = await prisma.auditLog.findMany({
      where: { entityType: 'task', entityId: id },
      include: { actor: { select: { id: true, displayName: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return { task, auditLogs };
  });

  // POST /api/tasks — create one-off task
  app.post('/', async (request, reply) => {
    const body = request.body as any;

    if (!body.departmentId || !body.title || !body.dueDate) {
      return reply.status(400).send({ error: 'departmentId, title, and dueDate are required' });
    }

    await authorizationService.assertMember(request.user.id, body.departmentId);

    const task = await prisma.taskInstance.create({
      data: {
        departmentId: body.departmentId,
        title: body.title,
        description: body.description || null,
        dueDate: new Date(body.dueDate),
        ownerId: body.ownerId || null,
        backupOwnerId: body.backupOwnerId || null,
        proofRequired: body.proofRequired || false,
        sopUrl: body.sopUrl || null,
        createdById: request.user.id,
        updatedById: request.user.id,
      },
      include: {
        owner: { select: { id: true, displayName: true, email: true } },
        department: { select: { id: true, name: true } },
      },
    });

    await auditService.log({
      entityType: 'task',
      entityId: task.id,
      action: 'create',
      actorUserId: request.user.id,
    });

    return reply.status(201).send({ task });
  });

  // PATCH /api/tasks/:id
  app.patch('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;

    const existing = await prisma.taskInstance.findUnique({ where: { id } });
    if (!existing) {
      return reply.status(404).send({ error: 'Task not found' });
    }

    await authorizationService.assertMember(request.user.id, existing.departmentId);

    const updateData: any = { updatedById: request.user.id };
    const trackFields = ['title', 'description', 'ownerId', 'backupOwnerId', 'status', 'proofRequired', 'sopUrl', 'dueDate'];

    for (const field of trackFields) {
      if (body[field] !== undefined) {
        updateData[field] = field === 'dueDate' ? new Date(body[field]) : body[field];
      }
    }

    const task = await prisma.taskInstance.update({
      where: { id },
      data: updateData,
      include: {
        owner: { select: { id: true, displayName: true, email: true } },
        department: { select: { id: true, name: true } },
      },
    });

    const changedFields = auditService.diff(existing as any, task as any, trackFields);
    await auditService.log({
      entityType: 'task',
      entityId: task.id,
      action: 'update',
      changedFields: changedFields ?? undefined,
      actorUserId: request.user.id,
    });

    return { task };
  });

  // POST /api/tasks/:id/complete
  app.post('/:id/complete', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;

    const existing = await prisma.taskInstance.findUnique({ where: { id } });
    if (!existing) {
      return reply.status(404).send({ error: 'Task not found' });
    }

    await authorizationService.assertMember(request.user.id, existing.departmentId);

    if (existing.proofRequired && !body.proofLink) {
      return reply.status(400).send({ error: 'Proof link is required to complete this task' });
    }

    const task = await prisma.taskInstance.update({
      where: { id },
      data: {
        status: 'done',
        proofLink: body.proofLink || null,
        completionNote: body.completionNote || null,
        completedAt: new Date(),
        updatedById: request.user.id,
      },
      include: {
        owner: { select: { id: true, displayName: true, email: true } },
        department: { select: { id: true, name: true } },
      },
    });

    await auditService.log({
      entityType: 'task',
      entityId: task.id,
      action: 'complete',
      actorUserId: request.user.id,
    });

    return { task };
  });

  // POST /api/tasks/:id/reopen
  app.post('/:id/reopen', async (request, reply) => {
    const { id } = request.params as { id: string };

    const existing = await prisma.taskInstance.findUnique({ where: { id } });
    if (!existing) {
      return reply.status(404).send({ error: 'Task not found' });
    }

    await authorizationService.assertMember(request.user.id, existing.departmentId);

    const task = await prisma.taskInstance.update({
      where: { id },
      data: {
        status: 'not_started',
        completedAt: null,
        updatedById: request.user.id,
      },
      include: {
        owner: { select: { id: true, displayName: true, email: true } },
        department: { select: { id: true, name: true } },
      },
    });

    await auditService.log({
      entityType: 'task',
      entityId: task.id,
      action: 'reopen',
      actorUserId: request.user.id,
    });

    return { task };
  });

  // DELETE /api/tasks/:id
  app.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const task = await prisma.taskInstance.findUnique({ where: { id } });
    if (!task) {
      return reply.status(404).send({ error: 'Task not found' });
    }

    await authorizationService.assertMember(request.user.id, task.departmentId);

    await auditService.log({
      entityType: 'task',
      entityId: id,
      action: 'delete',
      actorUserId: request.user.id,
    });

    await prisma.taskInstance.delete({ where: { id } });

    return { success: true };
  });

  // POST /api/tasks/bulk-delete
  app.post('/bulk-delete', async (request, reply) => {
    const { ids } = request.body as { ids: string[] };

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return reply.status(400).send({ error: 'ids array is required' });
    }

    const tasks = await prisma.taskInstance.findMany({
      where: { id: { in: ids } },
      select: { id: true, departmentId: true },
    });

    if (tasks.length === 0) {
      return reply.status(404).send({ error: 'No tasks found' });
    }

    const deptIds = [...new Set(tasks.map(t => t.departmentId))];
    for (const deptId of deptIds) {
      await authorizationService.assertMember(request.user.id, deptId);
    }

    for (const task of tasks) {
      await auditService.log({
        entityType: 'task',
        entityId: task.id,
        action: 'delete',
        actorUserId: request.user.id,
      });
    }

    await prisma.taskInstance.deleteMany({ where: { id: { in: ids } } });

    return { deleted: tasks.length };
  });
}
