import { Finding, FindingSeverity, FindingType, Network } from 'forta-agent';
import BigNumber from 'bignumber.js';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';
import relativeTime from 'dayjs/plugin/relativeTime';
import { ETHER_NOMINATOR, NATIVE_TOKEN_SYMBOL } from './contants';

dayjs.extend(duration);
dayjs.extend(relativeTime);

export const createNativeTokenLaunderingFinding = (
  address: string,
  totalDepositValue: BigNumber,
  depositRecords: { timestamp: number; value: BigNumber }[],
  chainId: Network,
  developerAbbreviation: string,
) => {
  const formattedDepositValue =
    totalDepositValue.div(ETHER_NOMINATOR).toFormat(3) + ' ' + NATIVE_TOKEN_SYMBOL[chainId];
  const sortedRecords = depositRecords.slice().sort((r1, r2) => r1.timestamp - r2.timestamp);
  const startTimestamp = sortedRecords[0].timestamp;
  const endTimestamp = sortedRecords[sortedRecords.length - 1].timestamp;

  let period = ' ';
  if (startTimestamp === endTimestamp) {
    period += 'in one transaction';
  } else {
    const seconds = endTimestamp - startTimestamp;
    period += 'in ' + dayjs.duration(seconds, 'seconds').humanize();
  }

  return Finding.from({
    alertId: `${developerAbbreviation}-AZTEC-PROTOCOL-POSSIBLE-MONEY-LAUNDERING-NATIVE`,
    name: 'Possible Money Laundering Though Aztec Protocol',
    description:
      `${address} potentially engaged in money laundering. ` +
      `The account deposited ${formattedDepositValue}${period}.`,
    type: FindingType.Suspicious,
    severity: FindingSeverity.High,
    addresses: [address],
    metadata: {
      totalDepositValue: totalDepositValue.toString(),
      deposits: JSON.stringify(sortedRecords),
    },
  });
};
