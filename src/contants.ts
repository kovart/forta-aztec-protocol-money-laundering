import BigNumber from 'bignumber.js';
import { Network } from 'forta-agent';

export const DEPOSIT_EVENT_ABI =
  'event Deposit(uint256 indexed assetId, address indexed depositorAddress, uint256 depositValue)';

export const ETHER_NOMINATOR = new BigNumber(10).pow(18);

export const NATIVE_TOKEN_SYMBOL: { [chainId: number]: string } = {
  [Network.MAINNET]: 'ETH',
  [Network.POLYGON]: 'MATIC',
  [Network.BSC]: 'BSC',
};
