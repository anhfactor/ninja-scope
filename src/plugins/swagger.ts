import { FastifyInstance } from 'fastify';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';

export async function registerSwagger(app: FastifyInstance) {
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'NinjaScope API',
        description:
          'A developer-friendly REST API that gives x-ray vision into Injective on-chain markets. Aggregated data, computed analytics, and developer utilities — all in clean JSON.',
        version: '1.0.0',
        contact: {
          name: 'NinjaScope',
        },
      },
      servers: [
        { 
          url: process.env.NODE_ENV === 'production' 
            ? `https://${process.env.RENDER_EXTERNAL_HOSTNAME || 'ninja-scope.onrender.com'}` 
            : 'http://localhost:3000', 
          description: process.env.NODE_ENV === 'production' ? 'Production' : 'Local' 
        },
      ],
      tags: [
        { name: 'Markets', description: 'Market data aggregation endpoints' },
        { name: 'Analytics', description: 'Computed market analytics' },
        { name: 'Oracle', description: 'Oracle price feeds' },
        { name: 'Utility', description: 'Developer utility endpoints' },
        { name: 'Wallet', description: 'Wallet portfolio and positions' },
        { name: 'Rankings', description: 'Market rankings and signals' },
      ],
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
    },
  });
}
