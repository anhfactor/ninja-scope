import { FastifyInstance } from 'fastify';
import { getPortfolio, getPositions } from '../services/account';
import { successResponse, errorResponse } from '../utils/response';
import { wasCacheHit } from '../plugins/cache';

export async function accountRoutes(app: FastifyInstance) {
  // GET /api/v1/accounts/:address/portfolio — Wallet portfolio overview
  app.get('/api/v1/accounts/:address/portfolio', {
    schema: {
      tags: ['Wallet'],
      summary: 'Get wallet portfolio: bank balances, subaccounts, positions count',
      params: {
        type: 'object',
        properties: {
          address: { type: 'string', description: 'Injective address (inj1...)' },
        },
        required: ['address'],
      },
    },
    handler: async (request, reply) => {
      const start = Date.now();
      try {
        const { address } = request.params as { address: string };
        if (!address.startsWith('inj1')) {
          reply.status(400);
          return errorResponse('INVALID_ADDRESS', 'Address must start with inj1');
        }
        const portfolio = await getPortfolio(address);
        return successResponse(portfolio, wasCacheHit(), start);
      } catch (err: any) {
        reply.status(500);
        return errorResponse('PORTFOLIO_ERROR', err.message || 'Failed to fetch portfolio');
      }
    },
  });

  // GET /api/v1/accounts/:address/positions — Open derivative positions
  app.get('/api/v1/accounts/:address/positions', {
    schema: {
      tags: ['Wallet'],
      summary: 'Get open derivative positions for a wallet',
      params: {
        type: 'object',
        properties: {
          address: { type: 'string', description: 'Injective address (inj1...)' },
        },
        required: ['address'],
      },
    },
    handler: async (request, reply) => {
      const start = Date.now();
      try {
        const { address } = request.params as { address: string };
        if (!address.startsWith('inj1')) {
          reply.status(400);
          return errorResponse('INVALID_ADDRESS', 'Address must start with inj1');
        }
        const positions = await getPositions(address);
        return successResponse(positions, wasCacheHit(), start);
      } catch (err: any) {
        reply.status(500);
        return errorResponse('POSITIONS_ERROR', err.message || 'Failed to fetch positions');
      }
    },
  });
}
