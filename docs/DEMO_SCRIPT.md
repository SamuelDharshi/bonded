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

As of the latest commit: steps 2 is runnable locally against the fixture
query path (`packages/enforcer` + `packages/compiler`). Steps 1, 3–7 require
deployment/credentials not yet provisioned in this environment — see the
root `README.md` "What's next" section for the exact list.
