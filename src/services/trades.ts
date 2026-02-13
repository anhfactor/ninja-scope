import { spotApi, derivativesApi } from './injective';
import { getCache, setCache } from '../plugins/cache';
import { config } from '../config';
import { getAllMarkets, getMarketType, getMarketDecimals } from './markets';
import {
  humanReadableSpotPrice,
  humanReadableSpotQuantity,
  humanReadableDerivativePrice,
  humanReadableDerivativeQuantity,
} from '../utils/decimals';

export interface TradeRecord {
  orderHash: string;
  tradeId: string;
  subaccountId: string;
  marketId: string;
  executedAt: number;
  tradeDirection: string;
  tradeExecutionType: string;
  executionSide: string;
  executionPrice: string;
  executionQuantity: string;
  humanPrice: string;
  humanQuantity: string;
  fee: string;
  feeRecipient: string;
}

export interface TradesResult {
  marketId: string;
  trades: TradeRecord[];
  total: number;
}

export async function getTrades(
  marketId: string,
  limit: number = 20,
  skip: number = 0
): Promise<TradesResult | null> {
  const cacheKey = `trades:${marketId}:${limit}:${skip}`;
  const cached = getCache<TradesResult>(cacheKey);
  if (cached) return cached.data;

  const markets = await getAllMarkets();
  const type = getMarketType(marketId, markets);
  if (!type) return null;

  let tradesResponse: any;
  if (type === 'spot') {
    tradesResponse = await spotApi.fetchTrades({
      marketIds: [marketId],
      pagination: { limit, skip },
    });
  } else {
    tradesResponse = await derivativesApi.fetchTrades({
      marketIds: [marketId],
      pagination: { limit, skip },
    });
  }

  const decimals = getMarketDecimals(marketId, markets);
  const isSpot = type === 'spot';

  const trades: TradeRecord[] = (tradesResponse.trades || []).map((t: any) => {
    const rawPrice = String(t.price || '0');
    const rawQty = String(t.quantity || '0');
    return {
      orderHash: t.orderHash || '',
      tradeId: t.tradeId || '',
      subaccountId: t.subaccountId || '',
      marketId: t.marketId || marketId,
      executedAt: t.executedAt || 0,
      tradeDirection: t.tradeDirection || '',
      tradeExecutionType: t.tradeExecutionType || '',
      executionSide: t.executionSide || '',
      executionPrice: rawPrice,
      executionQuantity: rawQty,
      humanPrice: isSpot && decimals
        ? humanReadableSpotPrice(rawPrice, decimals)
        : humanReadableDerivativePrice(rawPrice),
      humanQuantity: isSpot && decimals
        ? humanReadableSpotQuantity(rawQty, decimals.baseDecimals)
        : humanReadableDerivativeQuantity(rawQty),
      fee: String(t.fee || '0'),
      feeRecipient: t.feeRecipient || '',
    };
  });

  const result: TradesResult = {
    marketId,
    trades,
    total: tradesResponse.pagination?.total || trades.length,
  };

  setCache(cacheKey, result, config.cache.tradesTTL);
  return result;
}
