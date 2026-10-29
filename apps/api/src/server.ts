import { createApp } from './app.js';
import { rapbot } from './services/rapbot.js';

const port = Number(process.env.PORT ?? 4317);
const host = process.env.HOST ?? '127.0.0.1';

const app = await createApp({ serveWeb: true, logger: true });

try {
  await app.listen({ port, host });
  app.log.info(`LinkVault is running at http://${host}:${port}`);
  
  // Auto-register to RapBot if gateway is available
  const serviceEndpoint = process.env.LINKVAULT_ENDPOINT || `http://localhost:${port}`;
  await rapbot.registerExtension(serviceEndpoint);
} catch (error) {
  app.log.error(error);
  process.exit(1);
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, async () => {
    await app.close();
    process.exit(0);
  });
}
