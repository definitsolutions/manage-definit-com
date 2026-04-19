import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { loadConfig, Config } from './config';
import { healthRoutes } from './routes/health';
import { recordingRoutes, processRecording } from './routes/recordings';
import { TranscriptionService } from './services/transcription';
import { EmailService } from './services/email';
import { StorageService } from './services/storage';

declare module 'fastify' {
  interface FastifyInstance {
    config: Config;
    prisma: PrismaClient;
  }
}

async function main() {
  const config = loadConfig();
  const prisma = new PrismaClient();
  await prisma.$connect();

  const fastify = Fastify({
    logger: {
      level: 'info',
      transport: {
        target: 'pino-pretty',
        options: { translateTime: 'HH:MM:ss Z', ignore: 'pid,hostname' },
      },
    },
  });

  // Decorate root instance directly (no encapsulation issues)
  fastify.decorate('config', config);
  fastify.decorate('prisma', prisma);

  // Cleanup on close
  fastify.addHook('onClose', async () => {
    await prisma.$disconnect();
  });

  // Auth hook on root instance — applies to all routes
  const expectedKey = Buffer.from(config.API_KEY);
  fastify.addHook('onRequest', async (request, reply) => {
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

  // Register multipart
  await fastify.register(multipart, {
    limits: {
      fileSize: 100 * 1024 * 1024, // 100MB max
    },
  });

  // Register routes
  await fastify.register(healthRoutes);
  await fastify.register(recordingRoutes);

  // Start server
  await fastify.listen({ port: config.PORT, host: '0.0.0.0' });

  // Startup sweep: reprocess stuck recordings
  const stuck = await prisma.recording.findMany({
    where: { transcriptStatus: 'processing' },
  });

  if (stuck.length > 0) {
    fastify.log.info(`Found ${stuck.length} stuck recording(s), reprocessing...`);
    const storage = new StorageService(config);
    const transcription = new TranscriptionService(config, storage);
    const email = new EmailService(config);

    for (const rec of stuck) {
      processRecording(fastify, transcription, email, rec.id).catch((err) => {
        fastify.log.error({ err, recordingId: rec.id }, 'Startup reprocessing failed');
      });
    }
  }
}

main().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
