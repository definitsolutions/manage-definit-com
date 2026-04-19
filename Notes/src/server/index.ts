import { createApp } from './app.js';
import { config } from './config.js';
import { logger } from './lib/logger.js';

const start = async () => {
  try {
    const app = await createApp();
    await app.listen({ port: config.port, host: '0.0.0.0' });
    logger.info(`Notes server running on http://localhost:${config.port}`);

    const shutdown = async () => {
      logger.info('Shutting down...');
      await app.close();
      process.exit(0);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (err) {
    logger.error(err);
    process.exit(1);
  }
};

start();
