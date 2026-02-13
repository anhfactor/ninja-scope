import dotenv from 'dotenv';
import { Network } from '@injectivelabs/networks';

dotenv.config();

export const config = {
  network: (process.env.NETWORK === 'testnet' ? Network.Testnet : Network.Mainnet),
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || '0.0.0.0',

  cache: {
    marketsTTL: 60,        // 1 min
    orderbookTTL: 5,       // 5 sec (fast-moving data)
    tradesTTL: 10,         // 10 sec
    oracleTTL: 15,         // 15 sec
    analyticsTTL: 30,      // 30 sec
    summaryTTL: 60,        // 1 min
  },
};
