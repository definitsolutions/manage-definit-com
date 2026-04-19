import { createApp } from './app.js';
import { config } from './config.js';

async function main() {
  const app = await createApp();
  await app.listen({ port: config.port, host: '0.0.0.0' });
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
