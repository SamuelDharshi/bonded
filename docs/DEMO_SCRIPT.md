# Demo script

Run this end to end, cold, before every submission checkpoint. Each step
names the file/route it depends on so a failure points at what to fix.

| Step | Surface | Action | What it proves | Depends on |
|---|---|---|---|---|
| 1 | Attack token | Show the deployed `AttackToken` on the Arc explorer | The payload lives in a real `name()` field, on-chain, for a few cents | `contracts/src/AttackToken.sol` deployed (see §"Not yet done" below) |
| 2 | `/live` or CLI | Submit a proposal whose action is `approve_unlimited` against the attack token | `enforce()` refuses via `POLICY_FORBIDDEN_ACTION` before any Graph query runs | `packages/enforcer`, `packages/compiler` example policy |
| 3 | `/live` | Submit a proposal claiming a TVL premise the real pool doesn't have | Premise diff shows claimed vs. re-derived; `PREMISE_MISMATCH` | `packages/standardized` wired to a live Gateway URL + API key |
| 4 | `/live` | Submit a large, otherwise-valid proposal above `irreversible_above` | `HELD_FOR_STEPUP` — no silent auto-approval | Chainlink CRE workflow deployed and reachable |
| 5 | CRE / device | Confirm the step-up | `StepUpConfirmed` fires on `BondedVault`, action executes | Deployed `BondedVault`, live CRE authority |
| 6 | `/log` | Scroll the decision log | Every hash links to a real Arc explorer transaction | Subgraph deployed to Studio, indexing the deployed contracts |
| 7 | `/corpus` | View results | `results.json`-driven table | Attack-corpus harness run against pinned starter-kit commits |

## Current status against this script

- ✅ **Step 1** — `AttackToken` is live on Arc testnet at
  [`0x117E83CC8DcB5fe9D4F5a82c86B3bCe6c9355Ff5`](https://testnet.arcscan.app/address/0x117E83CC8DcB5fe9D4F5a82c86B3bCe6c9355Ff5),
  `name()` really does return the injected instruction. A real screenshot of
  the explorer page is still needed (`docs/evidence/attack-token-explorer.png`)
  — someone with a browser needs to grab it; this environment has no
  screenshot capability.
- ✅ **Step 2** — runnable now, both locally (`/live`, fixture path) and as
  the real `POLICY_FORBIDDEN_ACTION` refusal.
- ⏳ **Step 3** — `/live`'s premise re-derivation still runs on the fixture
  path, not a live Gateway query. `packages/standardized` can query real
  Messari subgraphs once `KNOWN_DEPLOYMENTS` IDs are refreshed (see
  `FEEDBACK/THEGRAPH.md` — the hardcoded ones are confirmed stale).
- ⏳ **Step 4/5** — blocked on Chainlink CRE Confidential Workflows deploy
  access (submitted, waitlisted — see `FEEDBACK/CHAINLINK.md`). Simulation
  evidence exists and is accepted for hackathon eligibility per Chainlink
  staff's own statement (also in `FEEDBACK/CHAINLINK.md`).
- ✅ **Step 6** — fully live: `/log` queries the real deployed, syncing
  subgraph. Verified end-to-end by calling `commitPolicy()` on-chain and
  watching the entity appear on the page.
- ⏳ **Step 7** — `results.json` still honestly reports `NOT_YET_RUN` for
  all three starter kits. Needs either a full framework integration (hours
  each) or a lighter real-LLM-agent substitute — see `docs/FUTURE.md`.
