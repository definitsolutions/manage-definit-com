import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { config } from '../config.js';

declare module 'fastify' {
  interface FastifyRequest {
    user?: { id: string; email: string; displayName: string | null };
  }
}

export default async function authPlugin(fastify: FastifyInstance) {
  const prisma = (fastify as any).prisma as PrismaClient;
  const expectedApiKey = Buffer.from(config.apiKey);

  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    // Health check is always public
    if (request.url === '/api/health') return;

    // Mobile upload auth: Bearer token
    const authHeader = request.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = Buffer.from(authHeader.slice(7));
      if (expectedApiKey.length === token.length && crypto.timingSafeEqual(expectedApiKey, token)) {
        request.user = { id: 'mobile-client', email: 'mobile@callscribe', displayName: 'Mobile Client' };
        return;
      }
      return reply.code(401).send({ error: 'Invalid API key' });
    }

    // Web UI auth: Cloudflare Access header
    const cfEmail = request.headers['cf-access-authenticated-user-email'] as string;
    if (cfEmail) {
      let user = await prisma.user.findUnique({ where: { email: cfEmail } });
      if (!user) {
        user = await prisma.user.create({
          data: { email: cfEmail, displayName: cfEmail.split('@')[0] },
        });
      }
      request.user = { id: user.id, email: user.email, displayName: user.displayName };
      return;
    }

    // Dev mode: allow unauthenticated with a fake user
    if (config.nodeEnv === 'development') {
      request.user = { id: 'dev-user', email: 'dev@definit.com', displayName: 'Dev User' };
      return;
    }

    return reply.code(401).send({ error: 'Authentication required' });
  });
}
