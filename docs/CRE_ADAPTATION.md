# Adapting when Chainlink CRE approval lands

What actually has to change to move the irreversible-threshold check from a
local plaintext comparison into the deployed enclave. Written against the
real code, not an optimistic sketch — an earlier draft of the README claimed
this was "a constructor change," and that was wrong.

## Current blocker

`cre account link-key` fails: the org's single owner slot is held by a stale
`PENDING` entry for an address whose link transaction never actually landed
on-chain. `cre account unlink-key` reports "not linked, nothing to do"
because, from the chain's view, it never was. Reported to Chainlink support;
nothing in this repo can clear it.

Once cleared, link the current key (`cre/.env`, address
`0x0f450674CE97dE6E35CD26043F84D2826F193340`, funded on mainnet for the
one-time registration), then `cre workflow deploy` + `activate`.

## What is already done

| Piece | State |
|---|---|
| Workflow logic | Real `handlerInTee`, simulates correctly on both branches |
| `authorizedKeys` | Set to the enforcer address; not left empty |
| Workflow name | `bonded-stepup-threshold-*`, not the scaffold default |
| `project.yaml` | Mainnet lookup RPC present (account ops need it) |
| Enforcer seam | `EnforceContext.requiresStepUp` — step 5 delegates when supplied |
| Client method | `ChainlinkCREAuthority.requiresStepUp()` matches that port exactly |
| Fail-closed behaviour | Oracle throw ⇒ `HELD_FOR_STEPUP` / `ATTESTATION_MISSING`, tested |

So the **threshold-confidentiality path** is genuinely close to config-level.

## What still costs real work

### 1. The trigger URL — small, but do not guess it

`ChainlinkCREAuthority.httpTriggerUrl()` returns a path invented before
deploy access existed. After deploying, take the real URL from
`cre workflow show stepup-threshold --target staging-settings` and correct
that one method. Requests must be signed by a key in `authorizedKeys`.

### 2. Wiring the port at the call sites — small

Nothing constructs `ChainlinkCREAuthority` yet. Two call sites build an
`EnforceContext` and would pass `requiresStepUp`:

- `apps/console/app/api/enforce/route.ts`
- `packages/settlement/src/settle.ts`

Gate it on `CRE_WORKFLOW_ID` being set, so absence keeps today's local
comparison and the console keeps reporting which path it used.

### 3. Verdict signing — NOT a configuration change

`IAuthority.signVerdict()` cannot be satisfied by the current workflow. The
workflow computes a boolean; it never holds the enforcer's signing key. Today
that key is a local env key (`packages/settlement/src/chain.ts`), which is why
the threshold check and the *signing* custody are separate problems.

Moving signing into the enclave means changing `cre/stepup-threshold` itself —
holding the signing key as a Vault DON secret and returning a real ECDSA
signature over the same digest `BondedVault.settle()` recomputes:

```
keccak256(abi.encodePacked(proposalHash, policyHash, outcome,
                           reasonCode, blockChecked, logRef))
```
then EIP-191. That is new workflow code, not a flag.

### 4. `enrolledSigner` is immutable — redeploy required

`BondedVault.enrolledSigner` is set at construction. Adopting an
enclave-custodied key means redeploying the vault and re-pointing
`BONDED_VAULT_ADDRESS`, the subgraph manifest, and the console's addresses.
Cheap on testnet, but it is a redeploy, not a setter.

That path is not theoretical — it has already been walked once, to lower
`IRREVERSIBLE_ABOVE`. `contracts/script/DeployVault.s.sol` deploys a vault
against the existing registry, `packages/settlement`'s `recover` script
drains the outgoing vault through `settle()` first (there is no withdraw
function, so recovery is the ordinary enforced path pointed at the signer),
and the subgraph keeps the superseded address as a second data source so
`/log` does not lose its history. Swapping in an enclave key reuses exactly
that sequence with a different `ENFORCER_SIGNER_ADDRESS`.

### 5. `confirmStepUp` expects a plain signature, not a DON report

The contract recovers ECDSA over `keccak256("STEPUP:" || proposalHash)` and
compares to `enrolledSigner`. The workflow emits a **DON report** instead,
which arrives through a KeystoneForwarder with different verification. Either
the contract learns to verify a forwarded report, or a relay turns a confirmed
report into a signature from the enrolled key. Decide which before wiring
step-up execution end to end.

## Honest summary

Threshold confidentiality — the headline CRE claim — is one URL and one
constructor away once linking is unblocked.

Enclave *custody of the signing key* is further out: it needs workflow
changes, a vault redeploy, and a decision on report-vs-signature verification.
The seam is real and tested, so none of this is a rewrite — but it is more
than configuration, and the README should not say otherwise.
