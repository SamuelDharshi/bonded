# Feedback — Arc

Findings land here only after being independently reproduced against Arc
testnet. No findings recorded yet — contracts are written and unit-tested
locally (Foundry) but not yet deployed to Arc testnet in this environment.

## Open questions we expect to generate findings once deployed

- Exact Arc testnet chain ID and RPC URL (`docs.arc.io`) — not yet confirmed
  against a live source; `.env.example` leaves `ARC_CHAIN_ID`/`ARC_RPC_URL`
  blank rather than guess.
- Exact Circle Agent Stack / Circle Wallets package names and current import
  paths — Circle's SDK surface has moved between product names historically
  (Programmable Wallets → Circle Wallets); not yet verified against
  `developers.circle.com` or `circlefin/agent-stack-starter-kits`.
- Whether USDC-native gas behaves as expected for a contract call that both
  pays gas and transfers USDC in the same transaction, or whether these
  need to be sequenced.
