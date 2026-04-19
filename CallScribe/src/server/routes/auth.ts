import { FastifyInstance } from 'fastify';

export async function authRoutes(fastify: FastifyInstance) {
  fastify.get('/me', async (request) => {
    return { user: request.user || null };
  });
}
