import { FastifyInstance } from 'fastify';

export async function healthRoutes(fastify: FastifyInstance) {
  fastify.get('/', async () => ({
    status: 'ok',
    service: 'callscribe',
    uptime: process.uptime(),
  }));
}
