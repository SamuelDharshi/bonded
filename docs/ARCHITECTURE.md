# Architecture

**The model proposes. It cannot approve itself.**

## The seam

Every layer in Bonded meets exactly one other layer, at exactly one typed
boundary: the `Verdict` struct (`packages/seam/src/types.ts`). It is frozen
after the `seam-v1` tag. No layer downstream of the enforcer ever sees a raw
LLM output, a raw prompt, or a free-string reason — only enumerated,
typed data.

```
Layer A            Layer B                Layer C            Layer D
Proposer     -->    Enforcer        -->    Authority   -->    Settlement
(untrusted)         (trusted,              (signs the         (BondedVault
                     non-generative)        Verdict)           on Arc)
     |                    |                      |                  |
  Proposal            Verdict                Signature          Executed /
  + premises[]      (typed, enum'd)                             Refused /
                                                                 Held
```

## Layer A — Proposer (untrusted)

`packages/proposer`. Receives a task plus **quarantined** observations
(`packages/quarantine` — see `FIELDS.md`). Emits a `Proposal`: an intended
action plus a `premises[]` array of claimed facts. No RPC access, no signer,
no network egress beyond its model endpoint. The model choice is deliberately
uninteresting — the entire design bets that it doesn't matter which model
runs here, because nothing downstream trusts its output.

## Layer B — Enforcer (trusted, non-generative) — **this is the product**

`packages/enforcer`. Plain TypeScript. Zero LLM calls. Never sees prompt
text — only the structured `Proposal`. For every premise the agent claimed,
it independently re-queries the same fact from The Graph
(`packages/standardized`, Messari-standardized schemas, through the Graph
Gateway) at a single pinned block, and compares against the claim within a
declared tolerance. See `enforce.ts` for the exact six-step order:

1. Policy hash check (fail closed if the policy has moved since the proposal
   was made)
2. Forbidden-action check (cheapest check, before any network call)
3. Per-premise re-derivation at one pinned block
4. Rolling budget check
5. Irreversible-threshold check → `HELD_FOR_STEPUP`
6. `CLEARED`

## Layer C — Authority

`packages/authority`. Two implementations behind one interface
(`IAuthority` in `interface.ts`), so swapping costs hours, not days:

- **Primary: Chainlink CRE (`handlerInTee`).** The enforcer's signing key and
  the policy threshold (`irreversible_above`) live only inside the
  confidential TEE handler. Keeping the threshold itself confidential, not
  just the key, is deliberate: a firewall whose rule boundary is public is a
  firewall an attacker can binary-search. Routine `CLEARED`/`REFUSED`
  verdicts are signed inside the TEE without human involvement; proposals
  above the threshold arm a step-up gate that only releases a signature once
  a human confirms out of band (`ChainlinkCREAuthority.confirmStepUp`).
- **Alternate: Ledger Key Ring + DMK.** Documented in the PRD as the original
  design. Not the active implementation for this build — see
  `docs/FUTURE.md` for why, and the `IAuthority` interface for what it would
  take to bring it back.

## Layer D — Settlement

`contracts/BondedVault.sol` on Arc. Holds USDC. `settle()` accepts only a
verdict signed by the enrolled authority key, in strict
**mark → check → call → settle → emit** order (checks-effects-interactions
applied specifically to the budget ledger, not just reentrancy). `CLEARED`
executes the action, `REFUSED` records and halts, `HELD_FOR_STEPUP` arms
`confirmStepUp()` and does **not** execute until a separate, independently
verified device/TEE confirmation signature arrives — the contract never
accepts the enforcer's own signature as a substitute for that second
confirmation.

`contracts/BondedRegistry.sol` stores each agent's current policy hash
on-chain. The enforcer and the vault both check against it independently, so
a compromised enforcer alone cannot evaluate a stale or attacker-substituted
policy and still get a settlement through.

## Data flow for one proposal

1. Proposer emits `Proposal` (action + claimed premises), quarantined fields
   never entering instruction context directly.
2. Enforcer pins the current block, re-derives every premise from The Graph
   through the Gateway (`cache: 'no-store'` — never cached on this path),
   evaluates the compiled `Policy`, and emits a `Verdict`.
3. Authority (CRE) signs the verdict inside the TEE, or arms a step-up gate
   if the action is irreversible and above threshold.
4. `BondedVault.settle()` on Arc accepts the signed verdict and executes,
   refuses, or holds.
5. Our own subgraph indexes `PolicyCommitted`, `VerdictSettled`,
   `StepUpArmed`, and `StepUpConfirmed` events — this is the decision log.

## Current build status

See the root `README.md` "Current state" section for what is implemented,
tested, and deployed as of the latest commit versus what is designed but
not yet live. This document describes the target architecture; it does not
assert that every piece described here is deployed.
