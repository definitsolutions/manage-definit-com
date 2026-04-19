import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config } from './config.js';
import authPlugin from './middleware/auth.js';
import { authRoutes } from './routes/auth.js';
import { noteRoutes } from './routes/notes.js';
import { labelRoutes } from './routes/labels.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function createApp() {
  const app = Fastify({ logger: true });

  await app.register(cors, {
    origin: config.nodeEnv === 'development' ? true : false,
    credentials: true,
  });

  await app.register(authPlugin);

  app.get('/api/health', async () => ({ status: 'ok', service: 'notes' }));

  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(noteRoutes, { prefix: '/api/notes' });
  await app.register(labelRoutes, { prefix: '/api/labels' });

  const clientPath = __dirname.includes('src/server') || __dirname.includes('src\\server')
    ? join(__dirname, '../../dist/client')
    : join(__dirname, '../../client');

  await app.register(fastifyStatic, {
    root: clientPath,
    prefix: '/',
  });

  app.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith('/api')) {
      return reply.status(404).send({ error: 'Not found' });
    }
    return reply.sendFile('index.html');
  });

  return app;
}
