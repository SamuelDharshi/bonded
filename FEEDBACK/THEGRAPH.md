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

## Hardcoded Messari DEX-AMM subgraph IDs are stale (reproduced 2026-09-08)

`packages/standardized/schemas/messari-dex-amm.ts`'s `KNOWN_DEPLOYMENTS`
carried three subgraph IDs with a comment noting "verify these are current
... IDs can change." They weren't current. Queried directly against the
production Gateway with a real API key:

| Deployment | Result |
|---|---|
| `uniswap-v3-ethereum` (`ELUcwgpm14LKPLrBRuVvPvNKHQ9HvwmtKgKSH5XNovGR`) | `{"errors":[{"message":"subgraph not found: ..."}]}` |
| `curve-ethereum` (`OfqMDDMPZjgjMjgCkRMbZfMLxBMDFNfGaYzVqv5Uo7b`) | `{"errors":[{"message":"subgraph not found: invalid subgraph ID: ..."}]}` |
| `balancer-v2-ethereum` (`H9oPAbXnobBRq1cB3HDmbZ1E8MWQyJYQjT1QDJMrdbNp`) | Resolves to *a* real subgraph (`_meta` succeeds, block 93449063) — but querying `liquidityPools` returns `"Type 'Query' has no field 'liquidityPools'"`. This ID exists but is not a Messari DEX-AMM deployment; it was likely valid for something else at some point and got reused/miscopied. |

**Could not find current replacement IDs through available tooling**, after
trying: The Graph Explorer's search (client-rendered SPA, not fetchable
without a real browser), Messari's own subgraph status dashboard at
`subgraphs.messari.io` (returned `503 no healthy upstream` on every
attempt, not a transient blip — checked twice), GitHub code search (requires
authentication this environment doesn't have), and the legacy hosted-service
naming convention (`api.thegraph.com/subgraphs/name/...`, now `301`
redirected — deprecated).

**This blocks the Composable-track cross-protocol proof
(`packages/standardized/scripts/proof.ts`) from running against real data
right now** — not because the query pattern is wrong (that part is real and
tested), but because the specific subgraph IDs it targets don't exist
anymore. Escalated rather than guessed at replacement IDs, per this
project's own rule against pattern-matching a plausible-looking value.

**Needs a human with a browser**: look up the current Messari DEX-AMM
subgraph IDs for Uniswap V3 / Curve / Balancer V2 on Ethereum at
`https://thegraph.com/explorer` (search each protocol name, filter by
Messari as publisher, copy the deployment ID from the subgraph's page),
and update `KNOWN_DEPLOYMENTS` accordingly.

## Subgraph MCP is a generic hosted server, not a custom-tool config file (reproduced 2026-09-08)

Implementation PRD §D.4 specs `subgraph/mcp/config.ts` as a file exporting
custom named tools (`get_agent_standing`, `explain_refusal`) with their own
GraphQL queries baked in — modeled on a plugin-style "register your own MCP
tools" mechanism. **That mechanism does not exist for Subgraph MCP.**

Verified against the live docs (`thegraph.com/docs/en/subgraphs/tooling/subgraph-mcp/`):
Subgraph MCP is a single hosted server at `https://subgraphs.mcp.thegraph.com/sse`
(confirmed reachable, `200` on the SSE endpoint) exposing a **fixed** set of
generic tools — get a subgraph's schema, run an arbitrary GraphQL query
against a given deployment, discover subgraphs by keyword/contract address,
get 30-day query volumes. There is no config surface for registering
custom-named tools; any MCP client (Claude Desktop, Cursor, etc.) connects
via `mcp-remote` with a Bearer token built from the same Subgraph Studio API
key already used elsewhere in this project:

```json
{
  "mcpServers": {
    "subgraph": {
      "command": "npx",
      "args": ["mcp-remote", "--header", "Authorization:${AUTH_HEADER}", "https://subgraphs.mcp.thegraph.com/sse"],
      "env": { "AUTH_HEADER": "Bearer GATEWAY_API_KEY" }
    }
  }
}
```

**Practical effect for Bonded**: a judge's own MCP-connected agent can
already query `bonded-subgraph` directly through Subgraph MCP's generic
"run a GraphQL query" tool once the subgraph is indexing real data (see the
Arc-testnet-indexing finding above) — no `subgraph/mcp/config.ts` file
needs to exist for that to work. `get_verdict`/`explain_refusal` as
*named, judge-facing* shortcuts would need to live as an actual API route
in `apps/console` (e.g. `/api/mcp/explain-refusal`) that itself runs a
GraphQL query and formats the result — a real, buildable thing, just not
"Subgraph MCP config" in the sense the PRD assumed.

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
