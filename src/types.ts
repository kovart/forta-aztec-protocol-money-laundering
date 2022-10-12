import { providers } from 'ethers';
import { Logger } from './logger';

export type DataContainer = {
  logger: Logger;
  provider: providers.JsonRpcProvider;
  isDevelopment: boolean;
  isInitialized: boolean;
};
