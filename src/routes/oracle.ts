import { FastifyInstance } from 'fastify';
import { getOraclePrices } from '../services/oracle';
import { successResponse, errorResponse } from '../utils/response';
import { wasCacheHit } from '../plugins/cache';

export async function oracleRoutes(app: FastifyInstance) {
  // GET /api/v1/oracle/prices — All oracle price feeds
  app.get('/api/v1/oracle/prices', {
    schema: {
      tags: ['Oracle'],
      summary: 'Get all oracle price feeds, normalized',
      querystring: {
        type: 'object',
        properties: {
          symbol: { type: 'string', description: 'Filter by symbol (case-insensitive)' },
        },
      },
    },
    handler: async (request, reply) => {
      const start = Date.now();
      try {
        const { symbol } = request.query as { symbol?: string };
        let prices = await getOraclePrices();
        if (symbol) {
          const query = symbol.toLowerCase();
          prices = prices.filter(
            (p) =>
              p.symbol.toLowerCase().includes(query) ||
              p.baseSymbol.toLowerCase().includes(query)
          );
        }
        return successResponse(prices, wasCacheHit(), start);
      } catch (err: any) {
        reply.status(500);
        return errorResponse('ORACLE_ERROR', err.message || 'Failed to fetch oracle prices');
      }
    },
  });
}
