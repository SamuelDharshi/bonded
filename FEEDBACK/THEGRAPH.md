# Feedback — The Graph

Findings land here only after being independently reproduced against the
live Subgraph Studio / Gateway, with the exact query and response that
triggers them.

## Arc testnet is not a supported indexing network (reproduced 2026-09-08)

`subgraph/` deployed successfully to Studio
(`https://thegraph.com/studio/subgraph/bonded-subgraph`, deployment
`QmYYtse1wYNeLJLy3uDdHVTn4qSFeBnCc1AG1kC6dX7dzB`) with `network: arc-testnet`
in `subgraph.yaml`. `graph deploy` did not reject the network name. Querying
the resulting endpoint (`https://api.studio.thegraph.com/query/1758829/bonded-subgraph/v0.0.1`)
consistently returns:

```json
{"errors":[{"message":"Store error: query execution failed: Subgraph `Qm...` has not started syncing yet. Wait for it to ingest a few blocks before querying it"}]}
```

with no progress after several minutes. Cross-checked against
`https://thegraph.com/docs/en/supported-networks/` — **only `arc` (Arc
mainnet, chain id `eip155:5042`) is listed as a supported network; no Arc
testnet/Sepolia identifier is documented.** This is consistent with the
subgraph silently never being picked up by an indexer rather than a
`graph deploy`-time validation error.

**Impact, scoped correctly:** this only blocks the decision-log subgraph
(`subgraph/` indexing our own `BondedRegistry`/`BondedVault` events, i.e.
the `/log` console screen) — it does **not** block the enforcer's premise
re-derivation, which queries external Messari-standardized subgraphs
(Uniswap/Curve/Balancer, etc.) on their own established networks via
`packages/standardized`, unrelated to which chain Bonded's own contracts
live on.

**Not yet resolved.** Options once Arc testnet contracts exist: keep
`/log` on its honest "not deployed" empty state until The Graph adds Arc
testnet support, or point the decision-log subgraph at Arc mainnet once/if
a mainnet deployment happens (see `docs/FUTURE.md`).

## Open questions we expect to generate findings once live

- Exact Gateway URL shape returned by Subgraph Studio on API key creation
  (`packages/standardized/src/gateway.ts` assumes
  `https://gateway.thegraph.com/api/{apiKey}/subgraphs/id/{subgraphId}` —
  unverified against a live dashboard as of this commit).
- Whether `block: { number: N }` pinning is honored consistently across
  Messari Standardized Subgraph deployments for different protocols, or
  whether indexing lag varies enough between them to matter for the
  cross-protocol leverage proof (`packages/standardized/schemas/messari-dex-amm.ts`).
- Subgraph MCP config schema — newer surface, more likely to have moved
  since documentation was last read.
