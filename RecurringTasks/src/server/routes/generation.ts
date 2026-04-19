import { FastifyInstance } from 'fastify';
import { taskGenerationService } from '../services/task-generation.js';

export async function generationRoutes(app: FastifyInstance) {
  // POST /api/generate — trigger idempotent task generation
  app.post('/', async (request) => {
    const result = await taskGenerationService.generateAll(request.user.id);
    return { ...result, message: `Created ${result.created} tasks, skipped ${result.skipped} duplicates` };
  });
}
