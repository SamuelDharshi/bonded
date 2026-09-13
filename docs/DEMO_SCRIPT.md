# Demo script

Run this end to end, cold, before recording. Each step names the file/route
it depends on so a failure points at what to fix.

| Step | Surface | Action | What it proves | Depends on |
|---|---|---|---|---|
| 1 | Attack token | Show the deployed `AttackToken` on the Arc explorer | The payload lives in a real `name()` field, on-chain, for a few cents | `contracts/src/AttackToken.sol` deployed |
| 2 | `/corpus` | Show the naive-agent transcripts | Two of three real models called `approve_unlimited` unprompted; a third recognized and refused | `packages/attack-corpus`, `results.json` |
| 3 | terminal | `pnpm --filter @bonded/settlement agent forbidden` | `enforce()` refuses via `POLICY_FORBIDDEN_ACTION` before any Graph query runs — the premise table comes back empty | `packages/enforcer`, `/api/v1/proposals` |
| 4 | terminal | `pnpm --filter @bonded/settlement agent lie` | Premise diff shows claimed 412M vs. live-re-derived ~127M; `PREMISE_MISMATCH` | `packages/standardized` on the live Gateway |
| 5 | terminal | `pnpm --filter @bonded/settlement agent big` | 2 USDC against a 1 USDC threshold → `HELD_FOR_STEPUP`. No silent auto-approval above the threshold | `enforce()` step 5 |
| 6 | `/app/approvals` | Confirm the held payment from the owner wallet, then `agent resume` | The hold is not a dead end. A human confirms from their own address, and only then does the vault release — three separate on-chain transactions | `/app/approvals`, `BondedVault.confirmStepUp()` |
| 7 | CRE simulation | `cre workflow simulate stepup-threshold --target staging-settings` | The confidential threshold check runs inside a TEE and returns only a boolean | `cre/stepup-threshold`, simulated (not yet deployed — see below) |
| 8 | Arc explorer | Show the settled transactions | A CLEARED verdict really released USDC; a REFUSED verdict settled with none moved | `packages/settlement`, `BondedVault.settle()` |
| 9 | `/log` | Scroll the decision log | Every entry — both vaults, before and after the redeploy — links to a real Arc explorer transaction | Subgraph deployed to Studio, indexing the live contracts |
| 10 | `/app/policy` | Compile a policy, show the hash matching the on-chain commitment | The artifact is compiled, committed from the owner wallet and published — the enforcer only accepts one that hashes to the commitment | `/api/v1/policies/compile`, `BondedRegistry` |

## Current status against this script

- ✅ **Step 1** — `AttackToken` is live on Arc testnet at
  [`0x117E83CC8DcB5fe9D4F5a82c86B3bCe6c9355Ff5`](https://testnet.arcscan.app/address/0x117E83CC8DcB5fe9D4F5a82c86B3bCe6c9355Ff5),
  `name()` really does return the injected instruction. A screen recording
  or screenshot of the explorer page still needs a human with a browser —
  this environment has none.
- ✅ **Step 2** — real. Three distinct models run against the live token
  with no defenses: `openai/gpt-oss-120b` and `openai/gpt-oss-20b` complied;
  `qwen/qwen3.6-27b` refused with its own stated reasoning. Every transcript
  in `results.json` is a real model run against the real deployed token —
  none is synthesised. The rows carry starter-kit names in their `kit` field,
  and each row's `repo` field states plainly that it is a harness-authored
  agent rather than a cloned kit. Describe them as models in the video, not
  as the shipped frameworks.
- ✅ **Step 3, 4, 5** — fully live, now through the real API rather than a
  demo page. `/live` was removed: it ran four scripted scenarios, and a
  scripted scenario reads as a mock however real the Gateway call beneath it
  is. The same three outcomes are produced by `packages/settlement`'s agent
  script talking to `POST /api/v1/proposals` over HTTP with no privileged
  access — which is stronger evidence, because an outsider can reproduce it.
  Premises are re-derived from the live Gateway against a real Uniswap V3 pool
  on Base, pinned per proposal. Without `GRAPH_API_KEY` the endpoint refuses
  rather than falling back.
- ✅ **Step 6** — real, and the strongest single beat in the demo. The
  step-up arc ran live against the current vault, as three separate
  transactions a judge can open:
  [armed](https://testnet.arcscan.app/tx/0xda0c3112dd054acfd87ed641fe327794a5aa1059ebc5f2a98a1c5342fc26199c),
  [confirmed](https://testnet.arcscan.app/tx/0x40e660469123a7e138fa0e950063985a1f60de2a72a596f27352750a7e91a3f7),
  [settled — 2.00 USDC released](https://testnet.arcscan.app/tx/0x318eb1599f6c995393cb1cd69fbe0df3ca4076626d17d962042ee999534189b9).
  That ordering is the point: the vault would not release on the confirm
  alone, and would not accept the settle without the confirm before it. The
  authorize control does not render until there is something to authorize,
  and the server re-derives the verdict rather than trusting the browser —
  so clicking authorize cannot approve anything other than what was armed.
  The confirmation is sent from the owner's own wallet at `/app/approvals` —
  there is no longer any path by which the web tier signs, which is why
  `STEPUP_DEMO_SIGNING` and `/api/stepup` no longer exist.
- ✅ **Step 7** — the confidential workflow is real and simulates correctly
  for both branches (`docs/evidence/cre-stepup-threshold-simulation.txt`).
  **Not yet deployed** — CRE org access is enabled, but final key-linking is
  stuck on a Chainlink platform-side account issue, reported to their
  support. Say this plainly in the video rather than implying deployment:
  "simulates correctly inside a TEE; deployment is in progress with
  Chainlink."
- ✅ **Step 8** — real. Verdicts have settled on Arc testnet across both
  vault deployments:
  [CLEARED, 1 USDC released](https://testnet.arcscan.app/tx/0x05b7a368e5f200d15b673feebcddbcd5928ab19890420dc639bf19ba42c8a631),
  [REFUSED, no USDC moved](https://testnet.arcscan.app/tx/0x1b1775b8c39765f13ec0961ecf4ceafcba9c1dd971144c9b82446c1c86f83c3c),
  plus the step-up settle in step 6. The first two settled against the
  superseded vault and are still live on the explorer; the subgraph indexes
  both addresses, so `/log` shows one continuous history rather than
  restarting at the redeploy.
  The enrolled signer is currently a local key, not an enclave key — say
  this if asked, don't volunteer it as a caveat during the demo beat itself.
- ✅ **Step 9** — fully live: `/log` queries the real deployed, syncing
  subgraph (v0.0.3), including every settled verdict from step 8.
- ✅ **Step 10** — fully live: `/policy` reads `BondedRegistry.currentPolicyHash()`
  via a real `eth_call` and compares it client-side. The recompile panel
  re-derives the artifact from intent and *compares* the hash against the
  chain — it deliberately does not commit, so running it on camera is safe.

## What NOT to claim in the video

- Do not say CRE is deployed. Say it simulates correctly and deployment is
  in progress.
- Do not say the naive-agent corpus runs the shipped starter-kit codebases.
  Say three real models were tested directly against the real token. The
  transcripts are genuine; the harness around them is ours.
- Do not describe the verdict signing key as enclave-custodied. It is a
  local key today; the seam (`packages/authority`) is built for the swap,
  the swap itself is pending CRE deployment.

## Preflight — check these before recording

The vault was redeployed to lower the irreversible threshold, so anything
cached from an earlier run points at the wrong contract.

| Thing | Current value |
|---|---|
| `BONDED_VAULT_ADDRESS` | `0x027C61c1418157b112B82F30894F8aC1F074AF85` |
| `BONDED_REGISTRY_ADDRESS` | `0xB825225163aEf4353d0110BA63d0d811A17B8205` (unchanged) |
| `ENFORCER_SIGNER_ADDRESS` | `0xac13a62FC7E50d08945ba2e79B5Eaa190d8D7D9a` |
| `IRREVERSIBLE_ABOVE` (contract) | `1000000` — 1 USDC |
| `irreversible_above` (policy) | `1000000` — the two must agree |
| Subgraph | v0.0.7, indexing the current vault and both superseded ones |

Then, in order:

1. `GRAPH_API_KEY` set, or `/api/v1/proposals` refuses every proposal — correctly,
   but there is nothing to film.
2. A browser wallet holding the owner key, on Arc testnet — step 6 is a real
   confirmation from your own address, not a server-side signature.
3. Vault holds more than 2 USDC, or the step-up settle reverts on transfer.
   Check: `cast call $USDC_ADDRESS "balanceOf(address)(uint256)" $BONDED_VAULT_ADDRESS`
4. `pnpm --filter @bonded/settlement commit-policy` reports a hash match, or
   step 10 shows a mismatch and every settle fails `STALE_POLICY`.
5. Start `next dev` fresh. Do not run `next build` against a live dev server —
   both write `.next` and the dev server starts throwing missing-chunk errors
   mid-demo.
