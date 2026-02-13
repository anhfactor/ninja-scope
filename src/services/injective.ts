import {
  IndexerGrpcSpotApi,
  IndexerGrpcDerivativesApi,
  IndexerGrpcOracleApi,
} from '@injectivelabs/sdk-ts';
import { getNetworkEndpoints } from '@injectivelabs/networks';
import { config } from '../config';

const endpoints = getNetworkEndpoints(config.network);

export const spotApi = new IndexerGrpcSpotApi(endpoints.indexer);
export const derivativesApi = new IndexerGrpcDerivativesApi(endpoints.indexer);
export const oracleApi = new IndexerGrpcOracleApi(endpoints.indexer);

export { endpoints };
