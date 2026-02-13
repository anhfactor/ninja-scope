import { spotApi, derivativesApi } from './injective';
import { getCache, setCache } from '../plugins/cache';
import { config } from '../config';
import { getAllMarkets, getMarketType, getMarketDecimals } from './markets';
import {
  safeParseFloat,
  humanReadableSpotPrice,
  humanReadableSpotQuantity,
  humanReadableDerivativePrice,
  humanReadableDerivativeQuantity,
} from '../utils/decimals';

export interface OrderbookLevel {
  price: string;
  quantity: string;
  humanPrice: string;
  humanQuantity: string;
  timestamp: number;
}

export interface OrderbookSnapshot {
  marketId: string;
  buys: OrderbookLevel[];
  sells: OrderbookLevel[];
  bestBid: string | null;
  bestAsk: string | null;
  spread: string | null;
  spreadPercentage: string | null;
  updatedAt: string;
}

export async function getOrderbook(marketId: string): Promise<OrderbookSnapshot | null> {
  const cacheKey = `orderbook:${marketId}`;
  const cached = getCache<OrderbookSnapshot>(cacheKey);
  if (cached) return cached.data;

  const markets = await getAllMarkets();
  const type = getMarketType(marketId, markets);
  if (!type) return null;

  let orderbook;
  if (type === 'spot') {
    orderbook = await spotApi.fetchOrderbookV2(marketId);
  } else {
    orderbook = await derivativesApi.fetchOrderbookV2(marketId);
  }

  const decimals = getMarketDecimals(marketId, markets);
  const isSpot = type === 'spot';

  const convertPrice = (raw: string) =>
    isSpot && decimals
      ? humanReadableSpotPrice(raw, decimals)
      : humanReadableDerivativePrice(raw);

  const convertQty = (raw: string) =>
    isSpot && decimals
      ? humanReadableSpotQuantity(raw, decimals.baseDecimals)
      : humanReadableDerivativeQuantity(raw);

  const buys: OrderbookLevel[] = (orderbook.buys || []).map((o: any) => ({
    price: String(o.price),
    quantity: String(o.quantity),
    humanPrice: convertPrice(String(o.price)),
    humanQuantity: convertQty(String(o.quantity)),
    timestamp: o.timestamp || 0,
  }));

  const sells: OrderbookLevel[] = (orderbook.sells || []).map((o: any) => ({
    price: String(o.price),
    quantity: String(o.quantity),
    humanPrice: convertPrice(String(o.price)),
    humanQuantity: convertQty(String(o.quantity)),
    timestamp: o.timestamp || 0,
  }));

  const bestBid = buys.length > 0 ? buys[0].price : null;
  const bestAsk = sells.length > 0 ? sells[0].price : null;

  let spread: string | null = null;
  let spreadPercentage: string | null = null;
  if (bestBid && bestAsk) {
    const bidNum = safeParseFloat(bestBid);
    const askNum = safeParseFloat(bestAsk);
    if (bidNum > 0 && askNum > 0) {
      const spreadVal = askNum - bidNum;
      spread = spreadVal.toString();
      const midPrice = (askNum + bidNum) / 2;
      spreadPercentage = ((spreadVal / midPrice) * 100).toFixed(4);
    }
  }

  const result: OrderbookSnapshot = {
    marketId,
    buys,
    sells,
    bestBid,
    bestAsk,
    spread,
    spreadPercentage,
    updatedAt: new Date().toISOString(),
  };

  setCache(cacheKey, result, config.cache.orderbookTTL);
  return result;
}
