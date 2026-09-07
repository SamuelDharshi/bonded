# Threat model

## What Bonded defends against

An autonomous agent that reads attacker-controlled free text (token
`name()`/`symbol()`, NFT `tokenURI()`, ENS text records, DAO proposal bodies,
raw calldata/event data, subgraph entity strings — see
`packages/quarantine/FIELDS.md` for the full, explicitly incomplete list) and
is manipulated into taking an action it would not take if it independently
verified the facts it was told. The defense is architectural, not a prompt
fix: the model that reads the untrusted text never holds a signing key or
network path to settlement, and every fact it claims is independently
re-derived by a separate, non-generative process before anything executes.

## What Bonded does not defend against — stated directly, not hidden

- **A compromised enforcer.** Bonded moves trust from a large generative
  model to a small, auditable, non-generative component. It does not
  eliminate trust. If the enforcer process itself is compromised, it could
  in principle sign a false verdict. What limits the blast radius: enforcer
  secrets are hardware/TEE-gated (see `docs/ARCHITECTURE.md` Layer C) rather
  than sitting in plaintext on the host, and anything above the irreversible
  threshold requires a *second*, independently verified confirmation that
  the enforcer's own signature cannot substitute for.
- **Premises that are true but misleading.** If an attacker actually
  manipulates real TVL (e.g. a flash-loan-inflated pool at the exact block
  checked), re-derivation confirms the manipulated number, because it *is*
  the current on-chain state. Bonded catches an agent lying about what the
  chain says; it does not catch the chain itself being made to say something
  misleading. Tolerance bands and premise choice narrow this but do not
  close it.
- **Every attacker-writable field.** `packages/quarantine/FIELDS.md` is
  enumerated and explicitly incomplete. New quarantine-worthy fields get
  added as they're identified, not designed for exhaustively up front.
- **Attested inference.** Considered running the proposer in a TEE and
  decided against it: if the model's output is not trusted regardless, its
  execution environment doesn't need to be trusted either. This is a design
  decision, not an omission.

## Fail-closed behavior, enumerated

Every failure mode in `enforce()` refuses or holds — there is no code path
that defaults to `CLEARED` on an error, a timeout, or missing data:

| Condition | Outcome |
|---|---|
| Policy hash on the proposal doesn't match the on-chain commitment | `REFUSED` / `STALE_POLICY` |
| Action kind is in `policy.forbid` | `REFUSED` / `POLICY_FORBIDDEN_ACTION` |
| A claimed premise has no matching policy definition | `REFUSED` / `PREMISE_UNRESOLVABLE` |
| The Graph query for a premise fails or returns no entity | `REFUSED` / `PREMISE_UNRESOLVABLE` |
| Claimed value falls outside tolerance of the re-derived value | `REFUSED` / `PREMISE_MISMATCH` |
| Rolling-window spend would exceed `budget.max` | `REFUSED` / `BUDGET_EXCEEDED` |
| Value exceeds `irreversible_above` | `HELD_FOR_STEPUP` / `IRREVERSIBLE_UNCONFIRMED` — never auto-approved |
| Authority layer (CRE/TEE) unavailable | No signature is produced; `BondedVault.settle()` has nothing to accept |

## On-chain half of the same checks

`BondedVault.settle()` independently re-checks the policy hash and the
budget ceiling rather than trusting the enforcer's off-chain evaluation
alone — a compromised enforcer that signs a verdict against a stale policy,
or that miscounts spend, is still caught on-chain. This is stated explicitly
because "the enforcer checked it" and "the contract checked it" are two
different trust boundaries and the design keeps both.
