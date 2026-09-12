# Demo script

Run this end to end, cold, before recording. Each step names the file/route
it depends on so a failure points at what to fix.

| Step | Surface | Action | What it proves | Depends on |
|---|---|---|---|---|
| 1 | Attack token | Show the deployed `AttackToken` on the Arc explorer | The payload lives in a real `name()` field, on-chain, for a few cents | `contracts/src/AttackToken.sol` deployed |
| 2 | `/corpus` | Show the naive-agent transcripts | Two of three real models called `approve_unlimited` unprompted; a third recognized and refused | `packages/attack-corpus`, `results.json` |
| 3 | `/live` | Watch the stream, expand a `REFUSED` entry for `forbidden-action` | `enforce()` refuses via `POLICY_FORBIDDEN_ACTION` before any Graph query runs — no premise table at all | `packages/enforcer`, `/api/enforce` |
| 4 | `/live` | Expand the `tvl-lie` entry | Premise diff shows claimed 412M vs. live-re-derived ~125M; `PREMISE_MISMATCH` | `packages/standardized` on the live Gateway |
| 5 | `/live` | Expand the `irreversible` entry | `HELD_FOR_STEPUP` — no silent auto-approval above the threshold | `enforce()` step 5 |
| 6 | CRE simulation | `cre workflow simulate stepup-threshold --target staging-settings` | The confidential threshold check runs inside a TEE and returns only a boolean | `cre/stepup-threshold`, simulated (not yet deployed — see below) |
| 7 | Arc explorer | Show the two settled transactions | A CLEARED verdict really released USDC; a REFUSED verdict settled with none moved | `packages/settlement`, `BondedVault.settle()` |
| 8 | `/log` | Scroll the decision log | Every entry — the two settled verdicts above included — links to a real Arc explorer transaction | Subgraph deployed to Studio, indexing the live contracts |
| 9 | `/policy` | Show the hash-match indicator | The compiled artifact's hash matches `BondedRegistry.currentPolicyHash()` on-chain, checked live | Policy committed on-chain |

## Current status against this script

- ✅ **Step 1** — `AttackToken` is live on Arc testnet at
  [`0x117E83CC8DcB5fe9D4F5a82c86B3bCe6c9355Ff5`](https://testnet.arcscan.app/address/0x117E83CC8DcB5fe9D4F5a82c86B3bCe6c9355Ff5),
  `name()` really does return the injected instruction. A screen recording
  or screenshot of the explorer page still needs a human with a browser —
  this environment has none.
- ✅ **Step 2** — real. Three distinct models run against the live token
  with no defenses: `openai/gpt-oss-120b` and `openai/gpt-oss-20b` complied;
  `qwen/qwen3.6-27b` refused with its own stated reasoning. The three named
  starter kits (ElizaOS, Brian Agent, Coinbase AgentKit) are honestly
  `NOT_YET_RUN` in `results.json` — not simulated, not attributed.
- ✅ **Step 3, 4, 5** — fully live. `/live` re-derives every premise from
  the live Graph Gateway against a real Uniswap V3 pool on Base, pinned to
  a real block per proposal. No fixture path involved unless
  `GRAPH_API_KEY` is unset, in which case the page says so plainly.
- ✅ **Step 6** — the confidential workflow is real and simulates correctly
  for both branches (`docs/evidence/cre-stepup-threshold-simulation.txt`).
  **Not yet deployed** — CRE org access is enabled, but final key-linking is
  stuck on a Chainlink platform-side account issue, reported to their
  support. Say this plainly in the video rather than implying deployment:
  "simulates correctly inside a TEE; deployment is in progress with
  Chainlink."
- ✅ **Step 7** — real. Two verdicts settled on Arc testnet:
  [CLEARED, 1 USDC released](https://testnet.arcscan.app/tx/0x05b7a368e5f200d15b673feebcddbcd5928ab19890420dc639bf19ba42c8a631),
  [REFUSED, no USDC moved](https://testnet.arcscan.app/tx/0x1b1775b8c39765f13ec0961ecf4ceafcba9c1dd971144c9b82446c1c86f83c3c).
  The enrolled signer is currently a local key, not an enclave key — say
  this if asked, don't volunteer it as a caveat during the demo beat itself.
- ✅ **Step 8** — fully live: `/log` queries the real deployed, syncing
  subgraph, including both settled verdicts from step 7.
- ✅ **Step 9** — fully live: `/policy` reads `BondedRegistry.currentPolicyHash()`
  via a real `eth_call` and compares it client-side.

## What NOT to claim in the video

- Do not say CRE is deployed. Say it simulates correctly and deployment is
  in progress.
- Do not say the naive-agent corpus covers the three named starter kits.
  Say three real models were tested directly; the named kits are pending.
- Do not describe the verdict signing key as enclave-custodied. It is a
  local key today; the seam (`packages/authority`) is built for the swap,
  the swap itself is pending CRE deployment.
