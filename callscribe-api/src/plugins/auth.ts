import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'crypto';

export async function authPlugin(fastify: FastifyInstance) {
  const expectedKey = Buffer.from(fastify.config.API_KEY);

  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    // Skip health check
    if (request.url === '/api/health') return;

    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      reply.code(401).send({ error: 'Missing authorization' });
      return;
    }

    const token = Buffer.from(authHeader.slice(7));
    if (expectedKey.length !== token.length || !crypto.timingSafeEqual(expectedKey, token)) {
      reply.code(401).send({ error: 'Invalid API key' });
      return;
    }
  });
}
