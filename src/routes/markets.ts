import { FastifyInstance } from 'fastify';
import { getAllMarkets, getMarketById, getMarketByTicker } from '../services/markets';
import { getOrderbook } from '../services/orderbook';
import { getTrades } from '../services/trades';
import {
  getSpreadAnalysis,
  getDepthAnalysis,
  getVolatility,
  getMarketHealth,
  getFundingRates,
  getMarketRankings,
  getMarketComparison,
  getWhaleTrades,
  getMarketSnapshot,
} from '../services/analytics';
import { successResponse, errorResponse } from '../utils/response';
import { wasCacheHit } from '../plugins/cache';

export async function marketRoutes(app: FastifyInstance) {
  // GET /api/v1/markets — List all markets
  app.get('/api/v1/markets', {
    schema: {
      tags: ['Markets'],
      summary: 'List all spot and derivative markets',
      querystring: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['spot', 'derivative'] },
        },
      },
    },
    handler: async (request, reply) => {
      const start = Date.now();
      try {
        const { type } = request.query as { type?: string };
        let markets = await getAllMarkets();
        if (type) {
          markets = markets.filter((m) => m.type === type);
        }
        return successResponse(markets, wasCacheHit(), start);
      } catch (err: any) {
        reply.status(500);
        return errorResponse('MARKETS_ERROR', err.message || 'Failed to fetch markets');
      }
    },
  });

  // GET /api/v1/markets/summary — Aggregated stats across all markets
  app.get('/api/v1/markets/summary', {
    schema: {
      tags: ['Utility'],
      summary: 'Aggregated overview across all markets',
    },
    handler: async (request, reply) => {
      const start = Date.now();
      try {
        const markets = await getAllMarkets();
        const spotCount = markets.filter((m) => m.type === 'spot').length;
        const derivativeCount = markets.filter((m) => m.type === 'derivative').length;

        return successResponse({
          totalMarkets: markets.length,
          spotMarkets: spotCount,
          derivativeMarkets: derivativeCount,
          markets: markets.map((m) => ({ marketId: m.marketId, ticker: m.ticker, type: m.type })),
        }, wasCacheHit(), start);
      } catch (err: any) {
        reply.status(500);
        return errorResponse('SUMMARY_ERROR', err.message || 'Failed to generate summary');
      }
    },
  });

  // GET /api/v1/markets/search — Search markets by ticker
  app.get('/api/v1/markets/search', {
    schema: {
      tags: ['Utility'],
      summary: 'Search markets by ticker, base, or quote',
      querystring: {
        type: 'object',
        properties: {
          q: { type: 'string', description: 'Search query' },
        },
        required: ['q'],
      },
    },
    handler: async (request, reply) => {
      const start = Date.now();
      try {
        const { q } = request.query as { q: string };
        const query = q.toLowerCase();
        const markets = await getAllMarkets();
        const results = markets.filter(
          (m) =>
            m.ticker.toLowerCase().includes(query) ||
            m.baseDenom.toLowerCase().includes(query) ||
            m.quoteDenom.toLowerCase().includes(query) ||
            m.baseTokenMeta?.symbol.toLowerCase().includes(query) ||
            m.quoteTokenMeta?.symbol.toLowerCase().includes(query)
        );
        return successResponse(results, wasCacheHit(), start);
      } catch (err: any) {
        reply.status(500);
        return errorResponse('SEARCH_ERROR', err.message || 'Search failed');
      }
    },
  });

  // GET /api/v1/markets/rankings — Rank all markets by health, spread, or depth
  app.get('/api/v1/markets/rankings', {
    schema: {
      tags: ['Rankings'],
      summary: 'Rank markets by health score, spread, or depth',
      querystring: {
        type: 'object',
        properties: {
          sort: { type: 'string', enum: ['health', 'spread', 'depth'], default: 'health' },
          limit: { type: 'integer', default: 20, minimum: 1, maximum: 100 },
          type: { type: 'string', enum: ['spot', 'derivative'] },
        },
      },
    },
    handler: async (request, reply) => {
      const start = Date.now();
      try {
        const { sort = 'health', limit = 20, type } = request.query as {
          sort?: string;
          limit?: number;
          type?: string;
        };
        const rankings = await getMarketRankings(sort, limit, type);
        return successResponse(rankings, wasCacheHit(), start);
      } catch (err: any) {
        reply.status(500);
        return errorResponse('RANKINGS_ERROR', err.message || 'Failed to compute rankings');
      }
    },
  });

  // GET /api/v1/markets/compare — Side-by-side market comparison
  app.get('/api/v1/markets/compare', {
    schema: {
      tags: ['Rankings'],
      summary: 'Compare multiple markets side-by-side (spread, depth, health, volatility)',
      querystring: {
        type: 'object',
        properties: {
          ids: { type: 'string', description: 'Comma-separated market IDs (max 5)' },
        },
        required: ['ids'],
      },
    },
    handler: async (request, reply) => {
      const start = Date.now();
      try {
        const { ids } = request.query as { ids: string };
        const marketIds = ids.split(',').map((id) => id.trim()).filter(Boolean);
        if (marketIds.length === 0) {
          reply.status(400);
          return errorResponse('INVALID_IDS', 'Provide at least one market ID via ?ids=');
        }
        if (marketIds.length > 5) {
          reply.status(400);
          return errorResponse('TOO_MANY_IDS', 'Maximum 5 markets can be compared at once');
        }
        const comparison = await getMarketComparison(marketIds);
        return successResponse(comparison, wasCacheHit(), start);
      } catch (err: any) {
        reply.status(500);
        return errorResponse('COMPARE_ERROR', err.message || 'Failed to compare markets');
      }
    },
  });

  // GET /api/v1/markets/ticker/:ticker — Lookup market by ticker (e.g., INJ-USDT, BTC/USDT)
  app.get('/api/v1/markets/ticker/:ticker', {
    schema: {
      tags: ['Markets'],
      summary: 'Lookup a market by its ticker (e.g., INJ-USDT, BTC-USDT)',
      description: 'Accepts tickers with / or - as separator. Case-insensitive. For derivatives like BTC/USDT PERP, use BTC-USDT and add ?type=derivative to disambiguate.',
      params: {
        type: 'object',
        properties: {
          ticker: { type: 'string', description: 'Ticker like INJ-USDT or BTC-USDT' },
        },
        required: ['ticker'],
      },
      querystring: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['spot', 'derivative'], description: 'Filter by market type' },
        },
      },
    },
    handler: async (request, reply) => {
      const start = Date.now();
      try {
        const { ticker } = request.params as { ticker: string };
        const { type } = request.query as { type?: string };
        const market = await getMarketByTicker(ticker, type);
        if (!market) {
          reply.status(404);
          return errorResponse('NOT_FOUND', `Market with ticker "${ticker}" not found. Try /markets/search?q=${ticker}`);
        }
        return successResponse(market, wasCacheHit(), start);
      } catch (err: any) {
        reply.status(500);
        return errorResponse('TICKER_ERROR', err.message || 'Failed to lookup by ticker');
      }
    },
  });

  // GET /api/v1/markets/:marketId — Single market detail
  app.get('/api/v1/markets/:marketId', {
    schema: {
      tags: ['Markets'],
      summary: 'Get single market detail',
      params: {
        type: 'object',
        properties: {
          marketId: { type: 'string' },
        },
        required: ['marketId'],
      },
    },
    handler: async (request, reply) => {
      const start = Date.now();
      try {
        const { marketId } = request.params as { marketId: string };
        const market = await getMarketById(marketId);
        if (!market) {
          reply.status(404);
          return errorResponse('NOT_FOUND', `Market ${marketId} not found`);
        }
        return successResponse(market, wasCacheHit(), start);
      } catch (err: any) {
        reply.status(500);
        return errorResponse('MARKET_ERROR', err.message || 'Failed to fetch market');
      }
    },
  });

  // GET /api/v1/markets/:marketId/orderbook — Orderbook snapshot
  app.get('/api/v1/markets/:marketId/orderbook', {
    schema: {
      tags: ['Markets'],
      summary: 'Get orderbook snapshot with bid/ask arrays',
      params: {
        type: 'object',
        properties: { marketId: { type: 'string' } },
        required: ['marketId'],
      },
    },
    handler: async (request, reply) => {
      const start = Date.now();
      try {
        const { marketId } = request.params as { marketId: string };
        const orderbook = await getOrderbook(marketId);
        if (!orderbook) {
          reply.status(404);
          return errorResponse('NOT_FOUND', `Orderbook for market ${marketId} not found`);
        }
        return successResponse(orderbook, wasCacheHit(), start);
      } catch (err: any) {
        reply.status(500);
        return errorResponse('ORDERBOOK_ERROR', err.message || 'Failed to fetch orderbook');
      }
    },
  });

  // GET /api/v1/markets/:marketId/trades — Recent trades
  app.get('/api/v1/markets/:marketId/trades', {
    schema: {
      tags: ['Markets'],
      summary: 'Get recent trades (paginated)',
      params: {
        type: 'object',
        properties: { marketId: { type: 'string' } },
        required: ['marketId'],
      },
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer', default: 20, minimum: 1, maximum: 100 },
          skip: { type: 'integer', default: 0, minimum: 0 },
        },
      },
    },
    handler: async (request, reply) => {
      const start = Date.now();
      try {
        const { marketId } = request.params as { marketId: string };
        const { limit = 20, skip = 0 } = request.query as { limit?: number; skip?: number };
        const trades = await getTrades(marketId, limit, skip);
        if (!trades) {
          reply.status(404);
          return errorResponse('NOT_FOUND', `Trades for market ${marketId} not found`);
        }
        return successResponse(trades, wasCacheHit(), start);
      } catch (err: any) {
        reply.status(500);
        return errorResponse('TRADES_ERROR', err.message || 'Failed to fetch trades');
      }
    },
  });

  // GET /api/v1/markets/:marketId/spread — Spread analysis
  app.get('/api/v1/markets/:marketId/spread', {
    schema: {
      tags: ['Analytics'],
      summary: 'Get bid-ask spread analysis',
      params: {
        type: 'object',
        properties: { marketId: { type: 'string' } },
        required: ['marketId'],
      },
    },
    handler: async (request, reply) => {
      const start = Date.now();
      try {
        const { marketId } = request.params as { marketId: string };
        const spread = await getSpreadAnalysis(marketId);
        if (!spread) {
          reply.status(404);
          return errorResponse('NOT_FOUND', `Spread data for market ${marketId} not found`);
        }
        return successResponse(spread, wasCacheHit(), start);
      } catch (err: any) {
        reply.status(500);
        return errorResponse('SPREAD_ERROR', err.message || 'Failed to compute spread');
      }
    },
  });

  // GET /api/v1/markets/:marketId/depth — Orderbook depth analysis
  app.get('/api/v1/markets/:marketId/depth', {
    schema: {
      tags: ['Analytics'],
      summary: 'Get orderbook depth at 1%, 2%, 5%, 10% levels',
      params: {
        type: 'object',
        properties: { marketId: { type: 'string' } },
        required: ['marketId'],
      },
    },
    handler: async (request, reply) => {
      const start = Date.now();
      try {
        const { marketId } = request.params as { marketId: string };
        const depth = await getDepthAnalysis(marketId);
        if (!depth) {
          reply.status(404);
          return errorResponse('NOT_FOUND', `Depth data for market ${marketId} not found`);
        }
        return successResponse(depth, wasCacheHit(), start);
      } catch (err: any) {
        reply.status(500);
        return errorResponse('DEPTH_ERROR', err.message || 'Failed to compute depth');
      }
    },
  });

  // GET /api/v1/markets/:marketId/volatility — Volatility metrics
  app.get('/api/v1/markets/:marketId/volatility', {
    schema: {
      tags: ['Analytics'],
      summary: 'Get volatility metrics computed from recent trades',
      params: {
        type: 'object',
        properties: { marketId: { type: 'string' } },
        required: ['marketId'],
      },
    },
    handler: async (request, reply) => {
      const start = Date.now();
      try {
        const { marketId } = request.params as { marketId: string };
        const volatility = await getVolatility(marketId);
        if (!volatility) {
          reply.status(404);
          return errorResponse('NOT_FOUND', `Volatility data for market ${marketId} not found`);
        }
        return successResponse(volatility, wasCacheHit(), start);
      } catch (err: any) {
        reply.status(500);
        return errorResponse('VOLATILITY_ERROR', err.message || 'Failed to compute volatility');
      }
    },
  });

  // GET /api/v1/markets/:marketId/health — Market health score
  app.get('/api/v1/markets/:marketId/health', {
    schema: {
      tags: ['Analytics'],
      summary: 'Get composite market health score',
      params: {
        type: 'object',
        properties: { marketId: { type: 'string' } },
        required: ['marketId'],
      },
    },
    handler: async (request, reply) => {
      const start = Date.now();
      try {
        const { marketId } = request.params as { marketId: string };
        const health = await getMarketHealth(marketId);
        if (!health) {
          reply.status(404);
          return errorResponse('NOT_FOUND', `Health data for market ${marketId} not found`);
        }
        return successResponse(health, wasCacheHit(), start);
      } catch (err: any) {
        reply.status(500);
        return errorResponse('HEALTH_ERROR', err.message || 'Failed to compute health');
      }
    },
  });

  // GET /api/v1/markets/:marketId/funding — Funding rate (derivatives only)
  app.get('/api/v1/markets/:marketId/funding', {
    schema: {
      tags: ['Analytics'],
      summary: 'Get funding rate data (derivatives only)',
      params: {
        type: 'object',
        properties: { marketId: { type: 'string' } },
        required: ['marketId'],
      },
    },
    handler: async (request, reply) => {
      const start = Date.now();
      try {
        const { marketId } = request.params as { marketId: string };
        const funding = await getFundingRates(marketId);
        if (!funding) {
          reply.status(400);
          return errorResponse('NOT_DERIVATIVE', 'Funding rates are only available for derivative markets');
        }
        return successResponse(funding, wasCacheHit(), start);
      } catch (err: any) {
        reply.status(500);
        return errorResponse('FUNDING_ERROR', err.message || 'Failed to fetch funding rates');
      }
    },
  });

  // GET /api/v1/markets/:marketId/whales — Large trades detection
  app.get('/api/v1/markets/:marketId/whales', {
    schema: {
      tags: ['Rankings'],
      summary: 'Detect large (whale) trades by notional value',
      description: 'Returns top trades by notional value. Auto-selects top 10% if no minValue specified.',
      params: {
        type: 'object',
        properties: { marketId: { type: 'string' } },
        required: ['marketId'],
      },
      querystring: {
        type: 'object',
        properties: {
          minValue: { type: 'number', description: 'Minimum notional value threshold' },
        },
      },
    },
    handler: async (request, reply) => {
      const start = Date.now();
      try {
        const { marketId } = request.params as { marketId: string };
        const { minValue } = request.query as { minValue?: number };
        const whales = await getWhaleTrades(marketId, minValue);
        return successResponse(whales, wasCacheHit(), start);
      } catch (err: any) {
        reply.status(500);
        return errorResponse('WHALES_ERROR', err.message || 'Failed to detect whale trades');
      }
    },
  });

  // GET /api/v1/markets/:marketId/snapshot — All-in-one market view
  app.get('/api/v1/markets/:marketId/snapshot', {
    schema: {
      tags: ['Rankings'],
      summary: 'All-in-one market snapshot: detail + top orderbook + recent trades + health',
      params: {
        type: 'object',
        properties: { marketId: { type: 'string' } },
        required: ['marketId'],
      },
    },
    handler: async (request, reply) => {
      const start = Date.now();
      try {
        const { marketId } = request.params as { marketId: string };
        const snapshot = await getMarketSnapshot(marketId);
        if (!snapshot) {
          reply.status(404);
          return errorResponse('NOT_FOUND', `Market ${marketId} not found`);
        }
        return successResponse(snapshot, wasCacheHit(), start);
      } catch (err: any) {
        reply.status(500);
        return errorResponse('SNAPSHOT_ERROR', err.message || 'Failed to create snapshot');
      }
    },
  });
}
