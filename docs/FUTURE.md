# Deliberately not built

Stated up front, not discovered by a judge poking around.

## Ledger as the active authority layer

The original design (`BONDED_PRD.md` / `BONDED_IMPLEMENTATION_PRD.md`) specs
Ledger's Key Ring CLI (`wallet-cli ring`) for secrets custody and DMK for
device-confirmed step-up as the primary authority layer, with Chainlink CRE
as a documented fallback if hardware access wasn't available in time.

**This build uses Chainlink CRE (`handlerInTee`) as the primary
implementation instead.** `packages/authority/src/interface.ts` (`IAuthority`)
is written so either backs the same seam — routine verdicts get signed
without human involvement, irreversible actions arm a step-up gate that only
releases a signature after an out-of-band confirmation. Bringing Ledger back
as a second, real implementation behind the same interface is a bounded,
scoped piece of future work, not a redesign.

## Kill-switch / revocation console

Designed, not built: a control that lets a policy owner immediately halt all
settlement for their agent regardless of in-flight `HELD_FOR_STEPUP`
proposals, independent of the normal policy-recommit path. `BondedRegistry`'s
`commitPolicy` can already be used as a slow version of this (commit a policy
with an empty `premises[]` and everything in `forbid`), but a dedicated
one-transaction halt is not implemented.

## Arc mainnet deployment

Deployment-ready in structure (`contracts/script/Deploy.s.sol` targets any
EVM chain via `foundry.toml` profile), but not deployed to Arc mainnet as of
this document. Testnet is the active target.

## Full attack-corpus starter-kit runs

`packages/attack-corpus/harness/run.ts` calls the real `@bonded/enforcer`
`enforce()` function against a real forbidden-action / unresolvable-premise
policy path for the Bonded side — that part is not simulated. The
naive-agent side (actually cloning and running third-party starter kits
against the deployed `AttackToken` and recording whether they comply) has
not been executed yet; it requires pinning specific starter-kit commits and
provisioning an LLM API key for each kit. `results.json` reflects this
honestly with a `NOT_YET_RUN` status rather than a fabricated pass/fail.
`AttackToken` itself is deployed and live (see README) — the naive-agent
run is the only remaining piece.

A lighter-weight substitute was attempted instead of full framework
integration: `packages/attack-corpus/harness/naive-agent-claude.ts`, a
minimal real multi-turn tool-calling agent built directly on the Anthropic
Messages API, no framework, no scripted outcome — it reads the real
`AttackToken`'s `name()`/`symbol()` via a live `eth_call` and the model
itself decides what to do next. The script authenticates correctly against
a real provided API key, but that Anthropic account had insufficient
credit balance (`"Your credit balance is too low to access the Anthropic
API"`), so no actual run completed. The script is committed and ready to
run the moment an account with balance is available —
`pnpm --filter @bonded/attack-corpus run-naive-agent`.

## Every attacker-writable field

`packages/quarantine/FIELDS.md` is explicitly incomplete by design — see
`docs/THREATMODEL.md`.
