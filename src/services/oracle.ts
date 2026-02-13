import { oracleApi } from './injective';
import { getCache, setCache } from '../plugins/cache';
import { config } from '../config';

export interface OraclePrice {
  symbol: string;
  baseSymbol: string;
  quoteSymbol: string;
  oracleType: string;
  price: string;
}

const ORACLE_CACHE_KEY = 'oracle:prices';

export async function getOraclePrices(): Promise<OraclePrice[]> {
  const cached = getCache<OraclePrice[]>(ORACLE_CACHE_KEY);
  if (cached) return cached.data;

  const oracleList = await oracleApi.fetchOracleList();

  const result: OraclePrice[] = (oracleList || []).map((o: any) => ({
    symbol: o.symbol || `${o.baseSymbol}/${o.quoteSymbol}`,
    baseSymbol: o.baseSymbol || '',
    quoteSymbol: o.quoteSymbol || '',
    oracleType: o.oracleType || '',
    price: String(o.price || '0'),
  }));

  setCache(ORACLE_CACHE_KEY, result, config.cache.oracleTTL);
  return result;
}
