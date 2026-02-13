import Fastify from 'fastify';
import cors from '@fastify/cors';
import { config } from './config';
import { registerSwagger } from './plugins/swagger';
import { marketRoutes } from './routes/markets';
import { oracleRoutes } from './routes/oracle';
import { statusRoutes } from './routes/status';
import { accountRoutes } from './routes/account';

async function main() {
  const app = Fastify({
    logger: {
      level: 'info',
      transport: {
        target: 'pino-pretty',
        options: { colorize: true },
      },
    },
  });

  // Plugins
  await app.register(cors, { origin: true });
  await registerSwagger(app);

  // Routes
  await app.register(marketRoutes);
  await app.register(oracleRoutes);
  await app.register(statusRoutes);
  await app.register(accountRoutes);

  // Root redirect to docs
  app.get('/', async (request, reply) => {
    reply.redirect('/docs');
  });

  // Start
  try {
    await app.listen({ port: config.port, host: config.host });
    console.log(`
╔══════════════════════════════════════════════╗
║           🥷 NinjaScope API v1.0.0           ║
║                                              ║
║  API:  http://localhost:${config.port}/api/v1        ║
║  Docs: http://localhost:${config.port}/docs           ║
║  Network: ${String(config.network).padEnd(33)}║
╚══════════════════════════════════════════════╝
    `);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    app.log.info(`${signal} received, shutting down gracefully...`);
    await app.close();
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main();
