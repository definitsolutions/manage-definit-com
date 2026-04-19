import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/db.js';

export async function labelRoutes(app: FastifyInstance) {
  app.get('/', async (request) => {
    const labels = await prisma.label.findMany({
      where: { userId: request.user.id },
      orderBy: { name: 'asc' },
      include: { _count: { select: { noteLabels: true } } },
    });
    return { labels };
  });

  app.post('/', async (request, reply) => {
    const body = request.body as any;
    if (!body.name) {
      return reply.status(400).send({ error: 'name is required' });
    }
    const label = await prisma.label.create({
      data: { userId: request.user.id, name: body.name },
    });
    return reply.status(201).send({ label });
  });

  app.patch('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    const existing = await prisma.label.findUnique({ where: { id } });
    if (!existing || existing.userId !== request.user.id) {
      return reply.status(404).send({ error: 'Label not found' });
    }
    const label = await prisma.label.update({
      where: { id },
      data: { name: body.name },
    });
    return { label };
  });

  app.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const existing = await prisma.label.findUnique({ where: { id } });
    if (!existing || existing.userId !== request.user.id) {
      return reply.status(404).send({ error: 'Label not found' });
    }
    await prisma.label.delete({ where: { id } });
    return { success: true };
  });
}
