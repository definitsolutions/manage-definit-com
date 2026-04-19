import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/db.js';

export async function departmentRoutes(app: FastifyInstance) {
  // GET /api/departments — user's departments with member count and role
  app.get('/', async (request) => {
    const memberships = await prisma.departmentMembership.findMany({
      where: { userId: request.user.id },
      include: {
        department: {
          include: {
            _count: {
              select: {
                memberships: true,
                taskTemplates: true,
                taskInstances: true,
              },
            },
          },
        },
      },
    });

    const departments = memberships.map((m) => ({
      id: m.department.id,
      name: m.department.name,
      role: m.role,
      memberCount: m.department._count.memberships,
      templateCount: m.department._count.taskTemplates,
      taskCount: m.department._count.taskInstances,
    }));

    return { departments };
  });

  // GET /api/departments/:id/members
  app.get('/:id/members', async (request) => {
    const { id } = request.params as { id: string };

    const memberships = await prisma.departmentMembership.findMany({
      where: { departmentId: id },
      include: { user: true },
      orderBy: { user: { displayName: 'asc' } },
    });

    const members = memberships.map((m) => ({
      id: m.user.id,
      displayName: m.user.displayName,
      email: m.user.email,
      role: m.role,
    }));

    return { members };
  });
}
