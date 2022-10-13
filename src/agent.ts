import { providers } from 'ethers';
import {
  Finding,
  Initialize,
  HandleTransaction,
  TransactionEvent,
  getEthersProvider,
} from 'forta-agent';
import { Logger, LoggerLevel } from './logger';
import { BotConfig, DataContainer } from './types';

const data: DataContainer = {} as any;
const provider = getEthersProvider();
const isDevelopment = process.env.NODE_ENV !== 'production';
const logger = new Logger(isDevelopment ? LoggerLevel.DEBUG : LoggerLevel.WARN);
const botConfig = require('../bot-config.json');

const provideInitialize = (
  data: DataContainer,
  config: BotConfig,
  provider: providers.JsonRpcProvider,
  logger: Logger,
  isDevelopment: boolean,
): Initialize => {
  return async function initialize() {
    data.logger = logger;
    data.provider = provider;
    data.isDevelopment = isDevelopment;
    data.isInitialized = true;

    logger.debug('Initialized');
  };
};

const provideHandleTransaction = (data: DataContainer): HandleTransaction => {
  return async function handleTransaction(txEvent: TransactionEvent) {
    if (!data.isInitialized) throw new Error('DataContainer is not initialized');

    const findings: Finding[] = [];

    return findings;
  };
};

export default {
  initialize: provideInitialize(data, botConfig, provider, logger, isDevelopment),
  handleTransaction: provideHandleTransaction(data),

  provideInitialize,
  provideHandleTransaction,
};
