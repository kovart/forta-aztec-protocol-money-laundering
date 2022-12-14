import BigNumber from 'bignumber.js';
import { providers } from 'ethers';
import { Logger } from './logger';

export type DataContainer = {
  logger: Logger;
  provider: providers.JsonRpcProvider;
  chainId: number;
  aztecAddresses: string[];
  developerAbbreviation: string;
  depositThresholdInWei: BigNumber;
  observationWindowInSeconds: number;
  depositsByAddress: Map<string, { timestamp: number; value: BigNumber }[]>;
  isDevelopment: boolean;
  isInitialized: boolean;
};

export type BotConfig = {
  developerAbbreviation: string;
  observationWindowInMinutes: number;
  etherThresholdByChainId: {
    [chainId: number]: string;
  };
  aztecAddressesByChainId: {
    [chainId: number]: string[];
  };
};
