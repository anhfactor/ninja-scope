import { spotApi, derivativesApi } from './injective';
import { getCache, setCache } from '../plugins/cache';
import { config } from '../config';

export interface MarketSummary {
  marketId: string;
  ticker: string;
  type: 'spot' | 'derivative';
  baseDenom: string;
  quoteDenom: string;
  baseTokenMeta?: { name: string; symbol: string; decimals: number };
  quoteTokenMeta?: { name: string; symbol: string; decimals: number };
  makerFeeRate: string;
  takerFeeRate: string;
  minPriceTickSize: string;
  minQuantityTickSize: string;
  serviceProviderFee: string;
}

const SPOT_CACHE_KEY = 'markets:spot';
const DERIV_CACHE_KEY = 'markets:derivative';

export async function getSpotMarkets(): Promise<MarketSummary[]> {
  const cached = getCache<MarketSummary[]>(SPOT_CACHE_KEY);
  if (cached) return cached.data;

  const markets = await spotApi.fetchMarkets();

  const result: MarketSummary[] = markets.map((m) => ({
    marketId: m.marketId,
    ticker: m.ticker,
    type: 'spot' as const,
    baseDenom: m.baseDenom,
    quoteDenom: m.quoteDenom,
    baseTokenMeta: m.baseToken
      ? { name: m.baseToken.name, symbol: m.baseToken.symbol, decimals: m.baseToken.decimals }
      : undefined,
    quoteTokenMeta: m.quoteToken
      ? { name: m.quoteToken.name, symbol: m.quoteToken.symbol, decimals: m.quoteToken.decimals }
      : undefined,
    makerFeeRate: m.makerFeeRate,
    takerFeeRate: m.takerFeeRate,
    minPriceTickSize: String(m.minPriceTickSize),
    minQuantityTickSize: String(m.minQuantityTickSize),
    serviceProviderFee: m.serviceProviderFee,
  }));

  setCache(SPOT_CACHE_KEY, result, config.cache.marketsTTL);
  return result;
}

export async function getDerivativeMarkets(): Promise<MarketSummary[]> {
  const cached = getCache<MarketSummary[]>(DERIV_CACHE_KEY);
  if (cached) return cached.data;

  const markets = await derivativesApi.fetchMarkets();

  const result: MarketSummary[] = markets.map((m) => ({
    marketId: m.marketId,
    ticker: m.ticker,
    type: 'derivative' as const,
    baseDenom: (m as any).oracleBase || '',
    quoteDenom: m.quoteDenom,
    quoteTokenMeta: m.quoteToken
      ? { name: m.quoteToken.name, symbol: m.quoteToken.symbol, decimals: m.quoteToken.decimals }
      : undefined,
    makerFeeRate: m.makerFeeRate,
    takerFeeRate: m.takerFeeRate,
    minPriceTickSize: String(m.minPriceTickSize),
    minQuantityTickSize: String(m.minQuantityTickSize),
    serviceProviderFee: m.serviceProviderFee,
  }));

  setCache(DERIV_CACHE_KEY, result, config.cache.marketsTTL);
  return result;
}

export async function getAllMarkets(): Promise<MarketSummary[]> {
  const [spot, derivative] = await Promise.all([
    getSpotMarkets(),
    getDerivativeMarkets(),
  ]);
  return [...spot, ...derivative];
}

export async function getMarketById(marketId: string): Promise<MarketSummary | null> {
  const all = await getAllMarkets();
  return all.find((m) => m.marketId === marketId) || null;
}

export function getMarketType(marketId: string, markets: MarketSummary[]): 'spot' | 'derivative' | null {
  const market = markets.find((m) => m.marketId === marketId);
  return market ? market.type : null;
}

export function getMarketDecimals(marketId: string, markets: MarketSummary[]): { baseDecimals: number; quoteDecimals: number } | null {
  const market = markets.find((m) => m.marketId === marketId);
  if (!market) return null;
  return {
    baseDecimals: market.baseTokenMeta?.decimals ?? 18,
    quoteDecimals: market.quoteTokenMeta?.decimals ?? 6,
  };
}

export async function getMarketByTicker(ticker: string, type?: string): Promise<MarketSummary | null> {
  const all = await getAllMarkets();
  const normalized = ticker.replace(/[-_]/g, '/').toUpperCase();

  let candidates = all.filter((m) => {
    const t = m.ticker.toUpperCase();
    return t === normalized || t.startsWith(normalized + ' ');
  });

  if (type) {
    candidates = candidates.filter((m) => m.type === type);
  }

  // Prefer exact match, then first partial match
  return candidates.find((m) => m.ticker.toUpperCase() === normalized) || candidates[0] || null;
}
