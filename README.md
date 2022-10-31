# Money Laundering through Aztec Protocol

## Description

This bot detects when an account makes a deposit to Aztec Protocol
and also detects numerous large transfers to it, which may indicate money laundering activity after the hack.

## Supported Chains

- Ethereum

## Alerts

- AK-AZTEC-PROTOCOL-DEPOSIT-EVENT
  - Fired when an account makes a deposit to Aztec Protocol
  - Severity is always set to "info"
  - Type is always set to "info"
  - metadata:
    - `depositValue` value deposited to Aztec Protocol

- AK-AZTEC-PROTOCOL-POSSIBLE-MONEY-LAUNDERING-NATIVE
  - Fired when the deposited funds of the native token have exceeded the specified threshold
  - Severity is always set to "high"
  - Type is always set to "suspicious"
  - metadata:
    - `totalDepositValue` total amount of deposited funds
    - `deposits` JSON-stringified array of deposit events with their value and timestamp

## Test Data

#### AK-AZTEC-PROTOCOL-DEPOSIT-EVENT

The bot should detect a deposit action to Aztec Protocol with the following command (Mainnet):

```bash
$ npm run tx 0x986c4cd37961941b3bb208ac152905594ee501b814939a8f88da67ca851aacca
```

#### AK-AZTEC-PROTOCOL-POSSIBLE-MONEY-LAUNDERING-NATIVE

No data yet
