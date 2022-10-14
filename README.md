# Money Laundering through Aztec Protocol

## Description

This detection bot detects when numerous large transfers are made to Aztec Protocol potentially indicative of money laundering activity post-hack.

## Supported Chains

- Ethereum

## Alerts

- AK-AZTEC-PROTOCOL-POSSIBLE-MONEY-LAUNDERING-NATIVE
  - Fired when the deposited funds of the native token have exceeded the specified threshold
  - Severity is always set to "high"
  - Type is always set to "suspicious"
  - metadata:
    - `totalDepositValue` total amount of deposited funds
    - `deposits` JSON-stringified array of deposit events with their value and timestamp

## Test Data

No data yet
