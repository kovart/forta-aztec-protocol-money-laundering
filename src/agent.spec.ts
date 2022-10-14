import { ethers } from 'ethers';
import BigNumber from 'bignumber.js';
import { HandleTransaction, Network } from 'forta-agent';
import { parseEther } from 'ethers/lib/utils';
import { createAddress } from 'forta-agent-tools';
import { TestTransactionEvent } from 'forta-agent-tools/lib/test';
import { BotConfig, DataContainer } from './types';
import { Logger, LoggerLevel } from './logger';
import { DEPOSIT_EVENT_ABI, ETHER_NOMINATOR } from './contants';
import { createNativeTokenLaunderingFinding } from './findings';
import agent from './agent';

const { provideInitialize, provideHandleTransaction } = agent;

describe('Forta agent', () => {
  describe('initialize()', () => {
    it('should initialize properly', async () => {
      const data: DataContainer = {} as any;
      const chainId = Network.FANTOM;
      const mockProvider: jest.MockedObject<ethers.providers.JsonRpcProvider> = {
        getNetwork: jest.fn().mockResolvedValue({ chainId }),
      } as any;
      const logger = new Logger();
      const aztecAddress1 = createAddress('0x1');
      const aztecAddress2 = createAddress('0x2');
      const config: BotConfig = {
        etherThresholdByChainId: { [chainId]: '100' },
        aztecAddressesByChainId: { [chainId]: [aztecAddress1, aztecAddress2] },
        developerAbbreviation: 'TEST',
        observationWindowInMinutes: 60,
      };
      const initialize = provideInitialize(data, config, mockProvider, logger, true);

      await initialize();

      expect(data.isInitialized).toStrictEqual(true);
      expect(data.isDevelopment).toStrictEqual(true);
      expect(data.logger).toStrictEqual(logger);
      expect(data.provider).toStrictEqual(mockProvider);
      expect(data.developerAbbreviation).toStrictEqual(config.developerAbbreviation);
      expect(data.chainId).toStrictEqual(chainId);
      expect(data.aztecAddresses).toStrictEqual([aztecAddress1, aztecAddress2]);
      expect(data.depositThresholdInWei.toString()).toStrictEqual(parseEther('100').toString());
      expect(data.observationWindowInSeconds).toStrictEqual(config.observationWindowInMinutes * 60);
    });
  });

  describe('handleTransaction()', () => {
    let mockData: DataContainer;
    let mockProvider: jest.MockedObject<ethers.providers.JsonRpcProvider>;
    let handleTransaction: HandleTransaction;

    const defaultChainId: number = Network.POLYGON;
    const defaultThresholdInWei = new BigNumber(4).multipliedBy(ETHER_NOMINATOR);
    const defaultAztecAddress1 = createAddress('0xf0f0');
    const defaultConfig: BotConfig = {
      etherThresholdByChainId: {
        [defaultChainId]: defaultThresholdInWei.div(ETHER_NOMINATOR).toString(),
      },
      aztecAddressesByChainId: {
        [defaultChainId]: [defaultAztecAddress1],
      },
      observationWindowInMinutes: 20,
      developerAbbreviation: 'TEST',
    };
    const eoaAddress1 = createAddress('0x1111');
    const eoaAddress2 = createAddress('0x2222');

    async function mockInitialization(
      config: Partial<BotConfig>,
      chainId: Network = defaultChainId,
    ) {
      config = {
        ...defaultConfig,
        ...config,
      };

      mockData = {} as any;
      mockProvider = {
        getNetwork: jest.fn().mockResolvedValue({ chainId: chainId }),
      } as any;

      const initialize = provideInitialize(
        mockData,
        <BotConfig>config,
        mockProvider,
        new Logger(LoggerLevel.ERROR),
        false,
      );
      handleTransaction = provideHandleTransaction(mockData);

      await initialize();
    }

    function addDepositEventLog(
      tx: TestTransactionEvent,
      depositorAddress: string,
      depositValue: number | BigNumber,
    ) {
      tx.addEventLog(DEPOSIT_EVENT_ABI, tx.to!, [0, depositorAddress, depositValue.toString()]);
    }

    beforeEach(async () => {
      await mockInitialization(defaultConfig);
    });

    it('returns empty findings if there are no deposit events', async () => {
      const tx = new TestTransactionEvent();
      tx.setFrom(eoaAddress1);
      tx.setTo(defaultAztecAddress1);
      tx.setTimestamp(0);
      // send value that exceed threshold
      tx.setValue(defaultThresholdInWei.plus(1).toString());

      const findings = await handleTransaction(tx);

      // no deposit events so it should not fire any alerts
      expect(findings).toStrictEqual([]);
    });

    it("returns empty findings if deposited funds don't exceed threshold #1", async () => {
      const tx = new TestTransactionEvent();
      tx.setTimestamp(0);
      tx.setFrom(eoaAddress1);
      tx.setTo(defaultAztecAddress1);

      // add a deposit equal to the threshold value but not exceeding it
      addDepositEventLog(tx, eoaAddress1, defaultThresholdInWei);

      const findings = await handleTransaction(tx);

      // should not fire any alerts
      expect(findings).toStrictEqual([]);
    });

    it("returns empty findings if deposited funds don't exceed threshold #2", async () => {
      let tx = new TestTransactionEvent();
      tx.setTimestamp(1);
      tx.setFrom(eoaAddress2);
      tx.setTo(defaultAztecAddress1);

      // add a deposit equal to half of the threshold value
      addDepositEventLog(tx, eoaAddress2, defaultThresholdInWei.div(2).decimalPlaces(0));

      let findings = await handleTransaction(tx);

      expect(findings).toStrictEqual([]);

      tx = new TestTransactionEvent();
      tx.setTimestamp(2);
      tx.setFrom(eoaAddress2);
      tx.setTo(defaultAztecAddress1);

      // add a deposit equal to another half of the threshold value
      addDepositEventLog(tx, eoaAddress2, defaultThresholdInWei.div(2).decimalPlaces(0));

      findings = await handleTransaction(tx);

      // should not fire any alerts because the sum of the deposits does not exceed the threshold
      expect(findings).toStrictEqual([]);
    });

    it('returns empty findings if deposited funds exceed threshold, but observation window is over', async () => {
      let tx = new TestTransactionEvent();
      tx.setTimestamp(0);
      tx.setFrom(eoaAddress2);
      tx.setTo(defaultAztecAddress1);

      // add a deposit equal to the threshold value but not exceeding it
      addDepositEventLog(tx, eoaAddress1, defaultThresholdInWei);

      let findings = await handleTransaction(tx);

      expect(findings).toStrictEqual([]);

      tx = new TestTransactionEvent();
      // emulate transaction that occurs after observation window is over
      tx.setTimestamp(mockData.observationWindowInSeconds + 1);
      tx.setFrom(eoaAddress1);
      tx.setTo(defaultAztecAddress1);

      // add a deposit equal to the threshold value but not exceeding it
      addDepositEventLog(tx, eoaAddress2, defaultThresholdInWei);

      findings = await handleTransaction(tx);

      // should not fire any alerts because the sum of the deposits does not exceed the threshold within the observation window
      expect(findings).toStrictEqual([]);
    });

    it('returns a finding if deposited funds exceed threshold within observation window #1', async () => {
      const tx = new TestTransactionEvent();
      const timestamp = 12345;
      const value = defaultThresholdInWei.plus(1);
      tx.setTimestamp(timestamp);
      tx.setFrom(eoaAddress1);
      tx.setTo(defaultAztecAddress1);

      // add a deposit that exceeds the threshold value
      addDepositEventLog(tx, eoaAddress1, value);

      const findings = await handleTransaction(tx);

      expect(findings).toStrictEqual([
        createNativeTokenLaunderingFinding(
          eoaAddress1,
          value,
          [{ timestamp, value }],
          defaultChainId,
          defaultConfig.developerAbbreviation,
        ),
      ]);
    });

    it('returns a finding if deposited funds exceed threshold within observation window #2', async () => {
      const firstDepositTimestamp = 100;
      const secondDepositTimestamp =
        firstDepositTimestamp + mockData.observationWindowInSeconds - 1;
      const firstDepositValue = defaultThresholdInWei;
      const secondDepositValue = new BigNumber(1);

      let tx = new TestTransactionEvent();
      tx.setTimestamp(firstDepositTimestamp);
      tx.setFrom(eoaAddress1);
      tx.setTo(defaultAztecAddress1);

      // add a deposit equal to the threshold value but not exceeding it
      addDepositEventLog(tx, eoaAddress1, firstDepositValue);

      let findings = await handleTransaction(tx);

      expect(findings).toStrictEqual([]);

      tx = new TestTransactionEvent();
      tx.setTimestamp(secondDepositTimestamp);
      tx.setFrom(eoaAddress1);
      tx.setTo(defaultAztecAddress1);

      // add a deposit so that the sum exceeds the threshold
      addDepositEventLog(tx, eoaAddress1, secondDepositValue);

      findings = await handleTransaction(tx);

      // should fire an alert
      expect(findings).toStrictEqual([
        createNativeTokenLaunderingFinding(
          eoaAddress1,
          firstDepositValue.plus(secondDepositValue),
          [
            { timestamp: firstDepositTimestamp, value: firstDepositValue },
            { timestamp: secondDepositTimestamp, value: secondDepositValue },
          ],
          defaultChainId,
          defaultConfig.developerAbbreviation,
        ),
      ]);
    });
  });
});
