import BigNumber from 'bignumber.js';
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
import { DEPOSIT_EVENT_ABI, ETHER_NOMINATOR } from './contants';
import { createNativeTokenLaunderingFinding } from './findings';

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
    const { chainId } = await provider.getNetwork();

    data.logger = logger;
    data.provider = provider;
    data.isDevelopment = isDevelopment;
    data.observationWindowInSeconds = config.observationWindowInMinutes * 60;
    data.aztecAddresses = config.aztecAddressesByChainId[chainId];
    data.developerAbbreviation = config.developerAbbreviation;
    data.chainId = chainId;
    data.depositThresholdInWei = new BigNumber(
      config.etherThresholdByChainId[chainId],
    ).multipliedBy(ETHER_NOMINATOR);
    data.depositsByAddress = new Map();
    data.isInitialized = true;

    logger.debug('Initialized');
  };
};

const provideHandleTransaction = (data: DataContainer): HandleTransaction => {
  let lastCleaningTimestamp = 0;

  return async function handleTransaction(txEvent: TransactionEvent) {
    if (!data.isInitialized) throw new Error('DataContainer is not initialized');

    const findings: Finding[] = [];

    // memory cleaning
    if (txEvent.timestamp - lastCleaningTimestamp > 2000) {
      for (const [address, deposits] of data.depositsByAddress.entries()) {
        const records = deposits.filter(
          (record) => record.timestamp >= txEvent.timestamp - data.observationWindowInSeconds,
        );
        if (records.length === 0) {
          data.depositsByAddress.delete(address);
        } else {
          data.depositsByAddress.set(address, records);
        }
      }

      lastCleaningTimestamp = txEvent.timestamp;
    }

    // filter deposit logs
    const depositLogs = txEvent.filterLog(DEPOSIT_EVENT_ABI, data.aztecAddresses);

    for (const log of depositLogs) {
      const assetId = log.args.assetId.toString();
      const depositValue = new BigNumber(log.args.depositValue.toString());
      const depositorAddress = log.args.depositorAddress.toLowerCase();

      // continue if it is not a native token (ETH, MATIC etc)
      if (assetId !== '0') continue;

      const deposits = (data.depositsByAddress.get(depositorAddress) || []).filter(
        (record) => record.timestamp >= txEvent.timestamp - data.observationWindowInSeconds,
      );
      deposits.push({ timestamp: txEvent.timestamp, value: depositValue });
      data.depositsByAddress.set(depositorAddress, deposits);

      // calc sum of all deposit values within observation window
      const totalDepositValue = deposits.reduce(
        (total, item) => total.plus(item.value),
        new BigNumber(0),
      );

      // fire an alert if the total deposit value is greater than the threshold
      if (totalDepositValue.isGreaterThan(data.depositThresholdInWei)) {
        findings.push(
          createNativeTokenLaunderingFinding(
            depositorAddress,
            totalDepositValue,
            deposits,
            data.chainId,
            data.developerAbbreviation,
          ),
        );
      }
    }

    return findings;
  };
};

export default {
  initialize: provideInitialize(data, botConfig, provider, logger, isDevelopment),
  handleTransaction: provideHandleTransaction(data),

  provideInitialize,
  provideHandleTransaction,
};
