import { FastifyInstance } from 'fastify';
import { getCacheStats } from '../plugins/cache';
import { successResponse } from '../utils/response';
import { config } from '../config';

const startedAt = new Date();

export async function statusRoutes(app: FastifyInstance) {
  // GET /api/v1/status — API health + cache stats
  app.get('/api/v1/status', {
    schema: {
      tags: ['Utility'],
      summary: 'API health check, cache stats, and uptime',
    },
    handler: async (request, reply) => {
      const start = Date.now();
      const cacheStats = getCacheStats();
      const uptimeMs = Date.now() - startedAt.getTime();

      return successResponse({
        status: 'healthy',
        version: '1.0.0',
        network: config.network,
        uptime: {
          ms: uptimeMs,
          human: formatUptime(uptimeMs),
        },
        cache: {
          hits: cacheStats.hits,
          misses: cacheStats.misses,
          keys: cacheStats.keys,
          hitRate: cacheStats.hits + cacheStats.misses > 0
            ? ((cacheStats.hits / (cacheStats.hits + cacheStats.misses)) * 100).toFixed(1) + '%'
            : '0%',
        },
        startedAt: startedAt.toISOString(),
      }, false, start);
    },
  });
}

function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
  if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}
