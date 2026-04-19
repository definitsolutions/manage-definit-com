import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config } from './config.js';
import authPlugin from './middleware/auth.js';
import { authRoutes } from './routes/auth.js';
import { departmentRoutes } from './routes/departments.js';
import { taskRoutes } from './routes/tasks.js';
import { templateRoutes } from './routes/templates.js';
import { generationRoutes } from './routes/generation.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function createApp() {
  const app = Fastify({
    logger: true,
  });

  // Register plugins
  await app.register(cors, {
    origin: config.nodeEnv === 'development' ? true : false,
    credentials: true,
  });

  // Auth middleware
  await app.register(authPlugin);

  // Health check endpoint
  app.get('/api/health', async () => {
    return { status: 'ok', service: 'recurring-tasks' };
  });

  // Branding stub (standalone mode - no portal branding service)
  app.get('/api/branding/css', async (_request, reply) => {
    return reply.type('text/css').send('/* standalone mode */');
  });
  app.get('/api/branding/config', async () => {
    return { logoMark: null, logoFull: null, primaryColor: '#ee4823' };
  });
  app.get('/api/apps', async () => {
    return { apps: [] };
  });

  // API routes
  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(departmentRoutes, { prefix: '/api/departments' });
  await app.register(taskRoutes, { prefix: '/api/tasks' });
  await app.register(templateRoutes, { prefix: '/api/templates' });
  await app.register(generationRoutes, { prefix: '/api/generate' });

  // Serve static files in production
  const clientPath = __dirname.includes('src/server') || __dirname.includes('src\\server')
    ? join(__dirname, '../../dist/client')
    : join(__dirname, '../../client');

  await app.register(fastifyStatic, {
    root: clientPath,
    prefix: '/',
  });

  // SPA fallback
  app.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith('/api')) {
      return reply.status(404).send({ error: 'Not found' });
    }
    return reply.sendFile('index.html');
  });

  return app;
}
