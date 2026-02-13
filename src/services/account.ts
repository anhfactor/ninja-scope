import {
  IndexerGrpcAccountPortfolioApi,
  IndexerGrpcDerivativesApi,
  getEthereumAddress,
} from '@injectivelabs/sdk-ts';
import { getNetworkEndpoints } from '@injectivelabs/networks';
import { config } from '../config';
import { getCache, setCache } from '../plugins/cache';

const endpoints = getNetworkEndpoints(config.network);
const portfolioApi = new IndexerGrpcAccountPortfolioApi(endpoints.indexer);
const derivativesApi = new IndexerGrpcDerivativesApi(endpoints.indexer);

export interface BankBalance {
  denom: string;
  amount: string;
}

export interface SubaccountBalance {
  subaccountId: string;
  denom: string;
  deposit: {
    totalBalance: string;
    availableBalance: string;
  };
}

export interface PositionInfo {
  marketId: string;
  ticker: string;
  direction: string;
  quantity: string;
  entryPrice: string;
  markPrice: string;
  margin: string;
  unrealizedPnl: string;
  subaccountId: string;
}

export interface PortfolioSummary {
  address: string;
  bankBalances: BankBalance[];
  subaccounts: SubaccountBalance[];
  positionsCount: number;
}

export interface PositionsResult {
  address: string;
  positions: PositionInfo[];
  total: number;
}

export async function getPortfolio(address: string): Promise<PortfolioSummary> {
  const cacheKey = `account:portfolio:${address}`;
  const cached = getCache<PortfolioSummary>(cacheKey);
  if (cached) return cached.data;

  const portfolio = await portfolioApi.fetchAccountPortfolio(address);

  const bankBalances: BankBalance[] = (portfolio.bankBalancesList || []).map((b: any) => ({
    denom: b.denom || '',
    amount: b.amount || '0',
  }));

  const subaccounts: SubaccountBalance[] = [];
  for (const sub of portfolio.subaccountsList || []) {
    subaccounts.push({
      subaccountId: sub.subaccountId || '',
      denom: sub.denom || '',
      deposit: {
        totalBalance: sub.deposit?.totalBalance || '0',
        availableBalance: sub.deposit?.availableBalance || '0',
      },
    });
  }

  const result: PortfolioSummary = {
    address,
    bankBalances,
    subaccounts,
    positionsCount: (portfolio.positionsWithUpnlList || []).length,
  };

  setCache(cacheKey, result, 30);
  return result;
}

export async function getPositions(address: string): Promise<PositionsResult> {
  const cacheKey = `account:positions:${address}`;
  const cached = getCache<PositionsResult>(cacheKey);
  if (cached) return cached.data;

  // Convert bech32 inj address to hex subaccount ID
  const ethAddress = getEthereumAddress(address);
  const subaccountId = ethAddress + '0'.repeat(24);

  const response = await derivativesApi.fetchPositionsV2({
    subaccountId,
  });

  const positions: PositionInfo[] = (response.positions || []).map((p: any) => ({
    marketId: p.marketId || '',
    ticker: p.ticker || '',
    direction: p.direction || '',
    quantity: String(p.quantity || '0'),
    entryPrice: String(p.entryPrice || '0'),
    markPrice: String(p.markPrice || '0'),
    margin: String(p.margin || '0'),
    unrealizedPnl: String(p.unrealizedPnl || '0'),
    subaccountId: p.subaccountId || subaccountId,
  }));

  const result: PositionsResult = {
    address,
    positions,
    total: positions.length,
  };

  setCache(cacheKey, result, 15);
  return result;
}
