import fp from 'fastify-plugin';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/db.js';
import { User } from '@prisma/client';

declare module 'fastify' {
  interface FastifyRequest {
    user: User;
  }
}

async function authPlugin(app: FastifyInstance) {
  app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.url.startsWith('/api') || request.url === '/api/health') {
      return;
    }

    // Cloudflare Access provides the authenticated email
    const email = (request.headers['cf-access-authenticated-user-email'] as string)?.toLowerCase();
    if (request.url.startsWith('/api/auth/me')) {
    }
    if (!email) {
      return;
    }

    // Look up or create user by email
    let user = await prisma.user.findFirst({ where: { email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          portalUserId: email,
          email,
          displayName: email,
        },
      });
    }

    request.user = user;
  });
}

export default fp(authPlugin);
