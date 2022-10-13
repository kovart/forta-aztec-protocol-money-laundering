import { ethers } from 'ethers';
import BigNumber from 'bignumber.js';
import { HandleTransaction, Network } from 'forta-agent';
import { parseEther } from 'ethers/lib/utils';
import { createAddress } from 'forta-agent-tools';
import { TestTransactionEvent } from 'forta-agent-tools/lib/test';
import { BotConfig, DataContainer } from './types';
import { Logger, LoggerLevel } from './logger';
import { createFinding } from './findings';
import agent from './agent';

const { provideInitialize, provideHandleTransaction } = agent;

describe('Forta agent', () => {
  describe('initialize()', () => {
    it('should initialize properly', async () => {
      const data: DataContainer = {} as any;
      const provider = new ethers.providers.JsonRpcProvider();
      const logger = new Logger();
      const network = Network.FANTOM;
      const aztecAddress1 = createAddress('0x1');
      const aztecAddress2 = createAddress('0x2');
      const config: BotConfig = {
        etherThresholdByChainId: { [network]: parseEther('100').toString() },
        aztecAddressesByChainId: { [network]: [aztecAddress1, aztecAddress2] },
        developerAbbreviation: 'TEST',
        observationWindowInMinutes: 60,
      };
      const initialize = provideInitialize(data, config, provider, logger, true);

      await initialize();

      expect(data.isInitialized).toStrictEqual(true);
      expect(data.isDevelopment).toStrictEqual(true);
      expect(data.logger).toStrictEqual(logger);
      expect(data.provider).toStrictEqual(provider);
      expect(data.aztecAddresses).toStrictEqual([aztecAddress1, aztecAddress2]);
      expect(data.etherThreshold.toString()).toStrictEqual(parseEther('100').toString());
      expect(data.observationWindowInSeconds).toStrictEqual(config.observationWindowInMinutes * 60);
    });
  });

  describe('handleTransaction()', () => {
    let mockData: DataContainer;
    let mockProvider: jest.MockedObject<ethers.providers.JsonRpcProvider>;
    let handleTransaction: HandleTransaction;

    const defaultChainId: number = Network.POLYGON;
    const defaultThreshold = new BigNumber(parseEther('4').toString());
    const defaultAztecAddress1 = createAddress('0xf0f0');
    const defaultEoaAddress1 = createAddress('0x1111');
    const defaultEoaAddress2 = createAddress('0x2222');
    const defaultConfig: BotConfig = {
      etherThresholdByChainId: {
        [defaultChainId]: defaultThreshold.toString(),
      },
      aztecAddressesByChainId: {
        [defaultChainId]: [defaultAztecAddress1],
      },
      observationWindowInMinutes: 20,
      developerAbbreviation: 'TEST',
    };

    async function mockInitialization(config: Partial<BotConfig>) {
      config = {
        ...defaultConfig,
        ...config,
      };

      mockData = {} as any;
      mockProvider = {} as any;

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
      tx.addEventLog(
        'event Deposit(uint256 indexed assetId, address indexed depositorAddress, uint256 depositValue)',
        tx.to!,
        [0, depositorAddress, depositValue.toString()],
      );
    }

    beforeEach(async () => {
      await mockInitialization(defaultConfig);
    });

    it('returns empty findings if there are no deposit events', async () => {
      const tx = new TestTransactionEvent();
      tx.setFrom(defaultEoaAddress1);
      tx.setTo(defaultAztecAddress1);
      tx.setTimestamp(0);
      // send value that exceed threshold
      tx.setValue(defaultThreshold.plus(1).toString());

      const findings = await handleTransaction(tx);

      // no deposit events so it should not fire any alerts
      expect(findings).toStrictEqual([]);
    });

    it("returns empty findings if deposited funds don't exceed threshold #1", async () => {
      const tx = new TestTransactionEvent();
      tx.setTimestamp(0);
      tx.setFrom(defaultEoaAddress1);
      tx.setTo(defaultAztecAddress1);

      // add a deposit equal to the threshold value but not exceeding it
      addDepositEventLog(tx, defaultEoaAddress1, defaultThreshold);

      const findings = await handleTransaction(tx);

      // should not fire any alerts
      expect(findings).toStrictEqual([]);
    });

    it("returns empty findings if deposited funds don't exceed threshold #2", async () => {
      let tx = new TestTransactionEvent();
      tx.setTimestamp(1);
      tx.setFrom(defaultEoaAddress2);
      tx.setTo(defaultAztecAddress1);

      // add a deposit equal to half of the threshold value
      addDepositEventLog(tx, defaultEoaAddress2, defaultThreshold.div(2).decimalPlaces(0));

      let findings = await handleTransaction(tx);

      expect(findings).toStrictEqual([]);

      tx = new TestTransactionEvent();
      tx.setTimestamp(2);
      tx.setFrom(defaultEoaAddress2);
      tx.setTo(defaultAztecAddress1);

      // add a deposit equal to another half of the threshold value
      addDepositEventLog(tx, defaultEoaAddress2, defaultThreshold.div(2).decimalPlaces(0));

      findings = await handleTransaction(tx);

      // should not fire any alerts because the sum of the deposits does not exceed the threshold
      expect(findings).toStrictEqual([]);
    });

    it('returns empty findings if deposited funds exceed threshold, but observation window is over', async () => {
      let tx = new TestTransactionEvent();
      tx.setTimestamp(0);
      tx.setFrom(defaultEoaAddress2);
      tx.setTo(defaultAztecAddress1);

      // add a deposit equal to the threshold value but not exceeding it
      addDepositEventLog(tx, defaultEoaAddress1, defaultThreshold);

      let findings = await handleTransaction(tx);

      expect(findings).toStrictEqual([]);

      tx = new TestTransactionEvent();
      // emulate transaction that occurs after observation window is over
      tx.setTimestamp(mockData.observationWindowInSeconds + 1);
      tx.setFrom(defaultEoaAddress1);
      tx.setTo(defaultAztecAddress1);

      // add a deposit equal to the threshold value but not exceeding it
      addDepositEventLog(tx, defaultEoaAddress2, defaultThreshold);

      findings = await handleTransaction(tx);

      // should not fire any alerts because the sum of the deposits does not exceed the threshold within the observation window
      expect(findings).toStrictEqual([]);
    });

    it('returns a findings if deposited funds exceed threshold within observation window #1', async () => {
      const tx = new TestTransactionEvent();
      tx.setTimestamp(0);
      tx.setFrom(defaultEoaAddress2);
      tx.setTo(defaultAztecAddress1);

      // add a deposit that exceeds the threshold value
      addDepositEventLog(tx, defaultEoaAddress1, defaultThreshold.plus(1));

      const findings = await handleTransaction(tx);

      expect(findings).toStrictEqual([createFinding()]);
    });

    it('returns a findings if deposited funds exceed threshold within observation window #2', async () => {
      let tx = new TestTransactionEvent();
      tx.setTimestamp(0);
      tx.setFrom(defaultEoaAddress2);
      tx.setTo(defaultAztecAddress1);

      // add a deposit equal to the threshold value but not exceeding it
      addDepositEventLog(tx, defaultEoaAddress1, defaultThreshold);

      let findings = await handleTransaction(tx);

      expect(findings).toStrictEqual([]);

      tx = new TestTransactionEvent();
      tx.setTimestamp(mockData.observationWindowInSeconds - 1);
      tx.setFrom(defaultEoaAddress1);
      tx.setTo(defaultAztecAddress1);

      // add a deposit so that the sum exceeds the threshold
      addDepositEventLog(tx, defaultEoaAddress2, 1);

      findings = await handleTransaction(tx);

      // should fire an alert
      expect(findings).toStrictEqual([createFinding()]);
    });
  });
});
