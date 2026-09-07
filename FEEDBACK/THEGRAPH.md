# Feedback — The Graph

Findings land here only after being independently reproduced against the
live Subgraph Studio / Gateway, with the exact query and response that
triggers them. No findings recorded yet — the subgraph has not been deployed
to Studio in this environment.

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
