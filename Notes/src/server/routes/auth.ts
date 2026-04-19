import { FastifyInstance } from 'fastify';

export async function authRoutes(app: FastifyInstance) {
  app.get('/me', async (request) => {
    return { user: request.user || null };
  });
}
