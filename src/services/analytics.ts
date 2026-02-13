import { getOrderbook, OrderbookSnapshot } from './orderbook';
import { getTrades } from './trades';
import { derivativesApi } from './injective';
import { getCache, setCache } from '../plugins/cache';
import { config } from '../config';
import { safeParseFloat } from '../utils/decimals';
import { getAllMarkets, getMarketType, MarketSummary } from './markets';

export interface SpreadAnalysis {
  marketId: string;
  bestBid: string | null;
  bestAsk: string | null;
  absoluteSpread: string | null;
  spreadPercentage: string | null;
  midPrice: string | null;
}

export interface DepthAnalysis {
  marketId: string;
  levels: {
    percentage: number;
    bidDepth: string;
    askDepth: string;
    totalDepth: string;
  }[];
}

export interface VolatilityData {
  marketId: string;
  volatility: string;
  historyMetadata: any;
}

export interface MarketHealth {
  marketId: string;
  ticker: string;
  score: number;
  components: {
    spreadScore: number;
    depthScore: number;
    activityScore: number;
  };
  rating: 'excellent' | 'good' | 'fair' | 'poor';
}

export interface FundingData {
  marketId: string;
  fundingRates: {
    rate: string;
    timestamp: number;
  }[];
}

export async function getSpreadAnalysis(marketId: string): Promise<SpreadAnalysis | null> {
  const cacheKey = `analytics:spread:${marketId}`;
  const cached = getCache<SpreadAnalysis>(cacheKey);
  if (cached) return cached.data;

  const orderbook = await getOrderbook(marketId);
  if (!orderbook) return null;

  let midPrice: string | null = null;
  if (orderbook.bestBid && orderbook.bestAsk) {
    const bid = safeParseFloat(orderbook.bestBid);
    const ask = safeParseFloat(orderbook.bestAsk);
    midPrice = ((bid + ask) / 2).toString();
  }

  const result: SpreadAnalysis = {
    marketId,
    bestBid: orderbook.bestBid,
    bestAsk: orderbook.bestAsk,
    absoluteSpread: orderbook.spread,
    spreadPercentage: orderbook.spreadPercentage,
    midPrice,
  };

  setCache(cacheKey, result, config.cache.analyticsTTL);
  return result;
}

export async function getDepthAnalysis(marketId: string): Promise<DepthAnalysis | null> {
  const cacheKey = `analytics:depth:${marketId}`;
  const cached = getCache<DepthAnalysis>(cacheKey);
  if (cached) return cached.data;

  const orderbook = await getOrderbook(marketId);
  if (!orderbook || !orderbook.bestBid || !orderbook.bestAsk) return null;

  const midPrice = (safeParseFloat(orderbook.bestBid) + safeParseFloat(orderbook.bestAsk)) / 2;
  if (midPrice === 0) return null;

  const percentages = [1, 2, 5, 10];
  const levels = percentages.map((pct) => {
    const lowerBound = midPrice * (1 - pct / 100);
    const upperBound = midPrice * (1 + pct / 100);

    let bidDepth = 0;
    for (const buy of orderbook.buys) {
      const price = safeParseFloat(buy.price);
      if (price >= lowerBound) {
        bidDepth += safeParseFloat(buy.quantity) * price;
      }
    }

    let askDepth = 0;
    for (const sell of orderbook.sells) {
      const price = safeParseFloat(sell.price);
      if (price <= upperBound) {
        askDepth += safeParseFloat(sell.quantity) * price;
      }
    }

    return {
      percentage: pct,
      bidDepth: bidDepth.toFixed(4),
      askDepth: askDepth.toFixed(4),
      totalDepth: (bidDepth + askDepth).toFixed(4),
    };
  });

  const result: DepthAnalysis = { marketId, levels };
  setCache(cacheKey, result, config.cache.analyticsTTL);
  return result;
}

export async function getVolatility(marketId: string): Promise<VolatilityData | null> {
  const cacheKey = `analytics:volatility:${marketId}`;
  const cached = getCache<VolatilityData>(cacheKey);
  if (cached) return cached.data;

  try {
    // Compute volatility from recent trades (standard deviation of log returns)
    const tradesResult = await getTrades(marketId, 100, 0);
    if (!tradesResult || tradesResult.trades.length < 2) {
      return { marketId, volatility: '0', historyMetadata: null };
    }

    const prices = tradesResult.trades
      .map((t) => safeParseFloat(t.executionPrice))
      .filter((p) => p > 0)
      .reverse(); // oldest first

    if (prices.length < 2) {
      return { marketId, volatility: '0', historyMetadata: null };
    }

    // Calculate log returns
    const logReturns: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      logReturns.push(Math.log(prices[i] / prices[i - 1]));
    }

    // Standard deviation of log returns
    const mean = logReturns.reduce((a, b) => a + b, 0) / logReturns.length;
    const variance = logReturns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / logReturns.length;
    const stdDev = Math.sqrt(variance);

    const result: VolatilityData = {
      marketId,
      volatility: stdDev.toFixed(8),
      historyMetadata: {
        tradeCount: prices.length,
        method: 'log_return_stddev',
      },
    };

    setCache(cacheKey, result, config.cache.analyticsTTL);
    return result;
  } catch (err) {
    return { marketId, volatility: '0', historyMetadata: null };
  }
}

export async function getMarketHealth(marketId: string): Promise<MarketHealth | null> {
  const cacheKey = `analytics:health:${marketId}`;
  const cached = getCache<MarketHealth>(cacheKey);
  if (cached) return cached.data;

  const [markets, orderbook, depth] = await Promise.all([
    getAllMarkets(),
    getOrderbook(marketId),
    getDepthAnalysis(marketId),
  ]);

  const market = markets.find((m) => m.marketId === marketId);
  if (!market) return null;

  // Spread score: tighter spread = higher score (0-100)
  let spreadScore = 0;
  if (orderbook?.spreadPercentage) {
    const spreadPct = safeParseFloat(orderbook.spreadPercentage);
    if (spreadPct <= 0.01) spreadScore = 100;
    else if (spreadPct <= 0.05) spreadScore = 90;
    else if (spreadPct <= 0.1) spreadScore = 80;
    else if (spreadPct <= 0.5) spreadScore = 60;
    else if (spreadPct <= 1) spreadScore = 40;
    else if (spreadPct <= 5) spreadScore = 20;
    else spreadScore = 10;
  }

  // Depth score: more depth = higher score (0-100)
  let depthScore = 0;
  if (depth && depth.levels.length > 0) {
    const depth2pct = safeParseFloat(depth.levels[1]?.totalDepth || '0');
    if (depth2pct > 1000000) depthScore = 100;
    else if (depth2pct > 100000) depthScore = 80;
    else if (depth2pct > 10000) depthScore = 60;
    else if (depth2pct > 1000) depthScore = 40;
    else if (depth2pct > 100) depthScore = 20;
    else depthScore = 10;
  }

  // Activity score based on orderbook entries
  let activityScore = 0;
  if (orderbook) {
    const totalOrders = orderbook.buys.length + orderbook.sells.length;
    if (totalOrders > 100) activityScore = 100;
    else if (totalOrders > 50) activityScore = 80;
    else if (totalOrders > 20) activityScore = 60;
    else if (totalOrders > 10) activityScore = 40;
    else if (totalOrders > 0) activityScore = 20;
  }

  const score = Math.round(spreadScore * 0.4 + depthScore * 0.3 + activityScore * 0.3);

  let rating: MarketHealth['rating'];
  if (score >= 80) rating = 'excellent';
  else if (score >= 60) rating = 'good';
  else if (score >= 40) rating = 'fair';
  else rating = 'poor';

  const result: MarketHealth = {
    marketId,
    ticker: market.ticker,
    score,
    components: { spreadScore, depthScore, activityScore },
    rating,
  };

  setCache(cacheKey, result, config.cache.analyticsTTL);
  return result;
}

export async function getFundingRates(marketId: string): Promise<FundingData | null> {
  const cacheKey = `analytics:funding:${marketId}`;
  const cached = getCache<FundingData>(cacheKey);
  if (cached) return cached.data;

  const markets = await getAllMarkets();
  const type = getMarketType(marketId, markets);
  if (type !== 'derivative') return null;

  try {
    const fundingResponse = await derivativesApi.fetchFundingRates({
      marketId,
      pagination: { limit: 50 },
    });

    const result: FundingData = {
      marketId,
      fundingRates: (fundingResponse.fundingRates || []).map((f: any) => ({
        rate: String(f.rate || '0'),
        timestamp: f.timestamp || 0,
      })),
    };

    setCache(cacheKey, result, config.cache.analyticsTTL);
    return result;
  } catch (err) {
    return { marketId, fundingRates: [] };
  }
}

// ===== RANKINGS =====

export interface MarketRanking {
  marketId: string;
  ticker: string;
  type: 'spot' | 'derivative';
  healthScore: number;
  rating: string;
  spreadPercentage: string | null;
  orderbookEntries: number;
}

export async function getMarketRankings(
  sortBy: string = 'health',
  limit: number = 50,
  type?: string
): Promise<MarketRanking[]> {
  const cacheKey = `rankings:${sortBy}:${limit}:${type || 'all'}`;
  const cached = getCache<MarketRanking[]>(cacheKey);
  if (cached) return cached.data;

  let markets = await getAllMarkets();
  if (type) {
    markets = markets.filter((m) => m.type === type);
  }

  // Batch compute health for active markets (limit to avoid timeouts)
  const candidates = markets.slice(0, Math.min(markets.length, limit * 2));

  const rankings: MarketRanking[] = [];
  const batchSize = 10;

  for (let i = 0; i < candidates.length; i += batchSize) {
    const batch = candidates.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map(async (m) => {
        const health = await getMarketHealth(m.marketId);
        const orderbook = await getOrderbook(m.marketId);
        return {
          marketId: m.marketId,
          ticker: m.ticker,
          type: m.type,
          healthScore: health?.score ?? 0,
          rating: health?.rating ?? 'unknown',
          spreadPercentage: orderbook?.spreadPercentage ?? null,
          orderbookEntries: orderbook ? orderbook.buys.length + orderbook.sells.length : 0,
        };
      })
    );

    for (const r of results) {
      if (r.status === 'fulfilled') {
        rankings.push(r.value);
      }
    }
  }

  // Sort
  if (sortBy === 'spread') {
    rankings.sort((a, b) => {
      const aSpread = a.spreadPercentage ? safeParseFloat(a.spreadPercentage) : Infinity;
      const bSpread = b.spreadPercentage ? safeParseFloat(b.spreadPercentage) : Infinity;
      return aSpread - bSpread;
    });
  } else if (sortBy === 'depth') {
    rankings.sort((a, b) => b.orderbookEntries - a.orderbookEntries);
  } else {
    rankings.sort((a, b) => b.healthScore - a.healthScore);
  }

  const result = rankings.slice(0, limit);
  setCache(cacheKey, result, config.cache.summaryTTL);
  return result;
}

// ===== COMPARE =====

export interface MarketComparison {
  markets: {
    marketId: string;
    ticker: string;
    type: string;
    spread: SpreadAnalysis | null;
    depth: DepthAnalysis | null;
    health: MarketHealth | null;
    volatility: VolatilityData | null;
  }[];
}

export async function getMarketComparison(marketIds: string[]): Promise<MarketComparison> {
  const cacheKey = `compare:${marketIds.sort().join(',')}`;
  const cached = getCache<MarketComparison>(cacheKey);
  if (cached) return cached.data;

  const allMarkets = await getAllMarkets();

  const comparisons = await Promise.all(
    marketIds.map(async (id) => {
      const market = allMarkets.find((m) => m.marketId === id);
      const [spread, depth, health, volatility] = await Promise.all([
        getSpreadAnalysis(id),
        getDepthAnalysis(id),
        getMarketHealth(id),
        getVolatility(id),
      ]);
      return {
        marketId: id,
        ticker: market?.ticker ?? 'unknown',
        type: market?.type ?? 'unknown',
        spread,
        depth,
        health,
        volatility,
      };
    })
  );

  const result: MarketComparison = { markets: comparisons };
  setCache(cacheKey, result, config.cache.analyticsTTL);
  return result;
}

// ===== WHALES =====

export interface WhaleTrade {
  tradeId: string;
  marketId: string;
  tradeDirection: string;
  executionPrice: string;
  executionQuantity: string;
  humanPrice: string;
  humanQuantity: string;
  notionalValue: string;
  executedAt: number;
}

export async function getWhaleTrades(
  marketId: string,
  minNotional?: number
): Promise<WhaleTrade[]> {
  const cacheKey = `whales:${marketId}:${minNotional || 'auto'}`;
  const cached = getCache<WhaleTrade[]>(cacheKey);
  if (cached) return cached.data;

  const tradesResult = await getTrades(marketId, 100, 0);
  if (!tradesResult || tradesResult.trades.length === 0) return [];

  // Calculate notional values
  const tradesWithNotional = tradesResult.trades.map((t) => {
    const price = safeParseFloat(t.humanPrice);
    const qty = safeParseFloat(t.humanQuantity);
    const notional = price * qty;
    return { ...t, notionalValue: notional };
  });

  // Auto-threshold: top 10% by notional value if no minNotional specified
  let threshold = minNotional || 0;
  if (!minNotional) {
    const sorted = [...tradesWithNotional].sort((a, b) => b.notionalValue - a.notionalValue);
    const topIndex = Math.max(1, Math.floor(sorted.length * 0.1));
    threshold = sorted[topIndex - 1]?.notionalValue || 0;
  }

  const whales: WhaleTrade[] = tradesWithNotional
    .filter((t) => t.notionalValue >= threshold)
    .map((t) => ({
      tradeId: t.tradeId,
      marketId: t.marketId,
      tradeDirection: t.tradeDirection,
      executionPrice: t.executionPrice,
      executionQuantity: t.executionQuantity,
      humanPrice: t.humanPrice,
      humanQuantity: t.humanQuantity,
      notionalValue: t.notionalValue.toFixed(4),
      executedAt: t.executedAt,
    }))
    .sort((a, b) => safeParseFloat(b.notionalValue) - safeParseFloat(a.notionalValue));

  setCache(cacheKey, whales, config.cache.tradesTTL);
  return whales;
}

// ===== SNAPSHOT =====

export interface MarketSnapshot {
  market: MarketSummary;
  orderbook: {
    bestBid: string | null;
    bestAsk: string | null;
    spreadPercentage: string | null;
    buyLevels: number;
    sellLevels: number;
    topBuys: { humanPrice: string; humanQuantity: string }[];
    topSells: { humanPrice: string; humanQuantity: string }[];
  } | null;
  recentTrades: {
    humanPrice: string;
    humanQuantity: string;
    tradeDirection: string;
    executedAt: number;
  }[];
  health: MarketHealth | null;
  spread: SpreadAnalysis | null;
}

export async function getMarketSnapshot(marketId: string): Promise<MarketSnapshot | null> {
  const cacheKey = `snapshot:${marketId}`;
  const cached = getCache<MarketSnapshot>(cacheKey);
  if (cached) return cached.data;

  const allMarkets = await getAllMarkets();
  const market = allMarkets.find((m) => m.marketId === marketId);
  if (!market) return null;

  const [orderbook, tradesResult, health, spread] = await Promise.all([
    getOrderbook(marketId),
    getTrades(marketId, 5, 0),
    getMarketHealth(marketId),
    getSpreadAnalysis(marketId),
  ]);

  const result: MarketSnapshot = {
    market,
    orderbook: orderbook
      ? {
          bestBid: orderbook.bestBid,
          bestAsk: orderbook.bestAsk,
          spreadPercentage: orderbook.spreadPercentage,
          buyLevels: orderbook.buys.length,
          sellLevels: orderbook.sells.length,
          topBuys: orderbook.buys.slice(0, 5).map((b) => ({
            humanPrice: b.humanPrice,
            humanQuantity: b.humanQuantity,
          })),
          topSells: orderbook.sells.slice(0, 5).map((s) => ({
            humanPrice: s.humanPrice,
            humanQuantity: s.humanQuantity,
          })),
        }
      : null,
    recentTrades: (tradesResult?.trades || []).map((t) => ({
      humanPrice: t.humanPrice,
      humanQuantity: t.humanQuantity,
      tradeDirection: t.tradeDirection,
      executedAt: t.executedAt,
    })),
    health,
    spread,
  };

  setCache(cacheKey, result, config.cache.analyticsTTL);
  return result;
}
