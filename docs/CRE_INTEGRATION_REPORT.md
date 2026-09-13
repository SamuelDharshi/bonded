# Chainlink CRE integration — what happened, and what is provable

A record of the Chainlink CRE integration: what was built, what blocked it, how
long each thing took to clear, and the evidence for every claim. Written because
"deployment pending" appeared on this project's own architecture page for five
days and a reader is entitled to know whether that was our problem or the
platform's. Some of it was neither, and one of the worst parts was ours.

**Outcome, up front.** The confidential threshold workflow is **deployed and
ACTIVE** on the CRE DON. The threshold lives in the Vault DON inside an AWS
Nitro enclave. The enforcer does **not** call it yet — that is stated plainly
everywhere it could be misread, and it is checkable: `cre execution list` returns
zero executions.

---

## 1. What was built

Not the hello-world template. `cre/stepup-threshold/workflow.ts` is a real
`handlerInTee` confidential workflow:

- Fetches the policy's `irreversible_above` as a **Vault DON secret**, released
  only into an attested enclave.
- Compares by strict `BigInt` — no floats anywhere on the money path.
- Returns **only a boolean**. The threshold never leaves the enclave and is
  never logged, including in the enclave's own debug output.

The point is not encryption for its own sake. A firewall whose threshold is
public is a firewall an attacker can binary-search: propose 0.9, propose 1.0,
propose 1.1, and the refusals tell you exactly where the gate sits. Keeping the
threshold in the enclave means probing the enforcer reveals only the answer, not
the boundary.

**Proof:** `cre/stepup-threshold/workflow.ts`, and
`docs/evidence/cre-stepup-threshold-simulation.txt` for a full simulation
transcript showing both branches.

---

## 2. The blockers, in the order they hit

### 2.1 Early Access approval — the queue

CRE deployment requires approval for the Early Access programme. `cre account
access` reports org status and prompts for a use-case description. Until that
cleared, `cre workflow deploy` was not available at all — no amount of correct
code changes that.

This is the "waiting queue" part, and it is worth being fair about: it is a
gated beta, and gating a beta is a reasonable thing to do. The cost to us was
that the *entire* deployment path — link, secrets, deploy, activate — could not
be tested even once until access flipped. Everything had to be built against
simulation and held ready.

**What we did about it:** built the whole thing anyway, verified it by
simulation, and stated on the architecture page that the layer was simulated
rather than deployed. At no point did the project claim enclave custody it did
not have.

### 2.2 Address linking sat PENDING, with no actionable signal

Once access was enabled, `cre account link-key` needs a wallet linked to the
org. The CRE Addresses tab showed the address as **PENDING** for days. There was
no error, no reason code, and no documented expected duration — the same screen
on day one and day four. An org limit of 1/1 owner meant the apparently-stuck
entry also blocked trying a different address.

That opacity is the single most expensive thing in this log. A failure with a
reason is a task; a pending state with no reason is a guess about whether to
wait or to escalate.

**What we did about it:** escalated to Chainlink support rather than retrying
blindly, and kept building the parts that did not depend on it.

### 2.3 Linking transacts on Ethereum **mainnet** — for a testnet workflow

This is the finding most likely to surprise someone reproducing this work.

The workflow targets `staging-settings`. The Workflow Registry that ownership is
recorded in is on **Ethereum mainnet** (`0x4Ac54353FA4Fa961AfcC5ec4B118596d3305E7e5`),
so `LinkOwner` and `UpsertWorkflow` are both **real mainnet transactions costing
real ETH**. A developer reasonably reading "staging" as "testnet" will not expect
to need mainnet gas.

The amounts turned out small — 0.00000670 ETH to link, 0.00004504 ETH to
register, at ~0.05 gwei. The surprise was the category, not the cost.

**Documented here because the docs we had did not say it**, and because
`project.yaml` needed a mainnet RPC added purely so account operations could
resolve (commit `8a40487`).

### 2.4 `cre secrets create` — wrong argument shape in the reference we had

Our reference material gave:

```bash
cre secrets create <workflow-dir> --target <target-name>
```

The installed CLI (1.32.0) rejects that:

```
✗ expected a YAML file; for MSIG step 2 use `cre secrets execute <bundle.json>`
```

`cre secrets create --help` shows it takes the **secrets YAML path**:

```bash
cre secrets create secrets.yaml --target staging-settings
```

### 2.5 The flag that actually unblocked everything, and how easy it was to miss

`cre secrets create --help` also revealed `--secrets-auth`:

| Mode | Registry | Owner | Needs a linked key? |
|---|---|---|---|
| `onchain` (**default**) | on-chain registry | the address you defined | **yes** |
| `browser` | **private** registry | registry-assigned | **no** |

With `--secrets-auth browser`, the secret was created immediately under a
registry-assigned owner (`0x953102…`) — no linking, no mainnet transaction, no
dependency on the PENDING entry at all.

This is what Chainlink's support message meant by *"when you are deploying to
the private registry, you are not using the address you defined, so this will not
affect."* Accurate, and only legible once you know the `--secrets-auth`
distinction exists. Neither the default nor the alternative is mentioned in the
integration docs we were working from; it is discoverable only from `--help`.

**One caveat we got wrong first, and correcting it matters:** that message is
true for **secrets**, not for **deploy**. `cre workflow deploy` uses the on-chain
registry and does require the linked key. We briefly assumed the private-registry
result generalised; the deploy output said otherwise:

```
Registry:      onchain:ethereum-mainnet
Owner Address: 0x0f450674…
Workflow owner link status: linked=false
```

### 2.6 Interactive prompts block automation, silently

`cre workflow deploy` auto-links an unlinked owner, and that path **prompts for
a label**. In a non-TTY environment the process simply hangs — it produced no
output for ten minutes before we identified the cause. `--owner-label` exists and
avoids it, but nothing in the failure suggests that; you have to read `--help`
and guess which prompt you hit.

### 2.7 Invoking a **deployed** HTTP-triggered workflow is undocumented

Still open. The references cover testing an HTTP trigger *in simulation* via
`curl http://localhost:8080/trigger`. Nothing covers the endpoint or request
signing for a deployed workflow, and there is no `cre workflow invoke` command in
1.32.0. This is exactly why the workflow is deployed but not yet called: the
remaining work is finding the invocation contract, not writing enforcement logic.

---

## 3. The mistake that was ours, not Chainlink's

Early on, the deploying key was going to be derived from an existing environment
variable, and the address it produced — `0x7E5F4552091A69125d5DfCb7b8C2659029395Bdf`
— was recommended for funding **without checking its on-chain history first**,
which is precisely the check that had been asked for.

That address is the public key of private key `0x00…01`, one of the most
well-known trivial keys in existence. It had nonce 3869 and an EIP-7702
delegation designator pointing at a sweeper contract. The ETH sent to it was
swept within seconds and is unrecoverable.

This was an agent error in this repository's own workflow, not a Chainlink
defect, and it is recorded here so the rest of this document cannot be read as
deflection. The lesson was applied: the replacement address
(`0x0f450674CE97dE6E35CD26043F84D2826F193340`, generated with `cast wallet new`)
was verified **before** being funded — nonce `0`, code `0x`, no delegation — and
again before the linking transaction.

---

## 4. What we did right

**Never mocked the CRE path.** Through five days of "deployment pending", the
architecture page said *simulated*, the README said *not deployed*, and the demo
script's what-not-to-claim list said so explicitly. There was an obvious
temptation to describe the layer as live; it was not taken.

**Verified SDK types against the installed package, not the docs.** The
reference material shows `authorizedKeys` as plain strings. The installed
`@chainlink/cre-sdk@1.18.0` requires `AuthorizedKeyJson` — `{ type, publicKey }`,
with `KeyTypeJson` a string union and not the numeric `KeyType` enum. The
workflow maps plain addresses from config into that shape, with the mismatch
noted in the code where a future reader will hit it.

**Built the delegation seam properly, and tested it fail-closed.**
`EnforceContext.requiresStepUp` is a port, not an implementation: the enforcer
makes no network calls of its own. Five tests cover it, including the one that
matters — an unreachable oracle **holds**, never clears
(`ATTESTATION_MISSING`). Absent the port, step 5 compares locally, which is
correct but not confidential, and the code says so.

**Validated the threshold secret without ever reading it.** Before upload, the
value was confirmed by boundary behaviour alone:

| Amount | `requiresStepUp` |
|---|---|
| `500000` | `false` |
| `1000000` | `false` |
| `1000001` | `true` |
| `2000000` | `true` |

The flip between `1000000` and `1000001` pins the secret at exactly 1 USDC.

**Confirmed enclave and contract agree at the boundary.** `BondedVault.settle`
uses `valueUSDC > irreversibleAbove`; the enclave uses `BigInt(value) >
BigInt(threshold)`. Both treat exactly 1 USDC as routine. Had one used `>=`, the
enforcer would have cleared amounts the vault then rejected — a divergence that
surfaces as an enforcer bug and is miserable to trace.

---

## 5. Proofs

| Claim | Evidence |
|---|---|
| Workflow is real `handlerInTee`, not a template | `cre/stepup-threshold/workflow.ts` |
| Simulates correctly on both branches | `docs/evidence/cre-stepup-threshold-simulation.txt` |
| Deployed and ACTIVE | `docs/evidence/cre-stepup-threshold-deployment.txt` |
| Owner linked on-chain | [`0x1ca93364…`](https://etherscan.io/tx/0x1ca933647b7b25a0fe5d3e7b47fa7ffb0f28c770b16a06fdcb14ad7c70ef160a) |
| Workflow registered on-chain | [`0x9a7a7967…`](https://etherscan.io/tx/0x9a7a796783cafc485a43c17b174ccb74b4c98384aece1b48f7aa919505b9b60b) |
| Workflow Registry contract | [`0x4Ac54353…`](https://etherscan.io/address/0x4Ac54353FA4Fa961AfcC5ec4B118596d3305E7e5) |
| Threshold held by the Vault DON | `secret_id=IRREVERSIBLE_THRESHOLD_USDC, namespace=main` |
| Seam tested, fails closed | `packages/enforcer/src/__tests__/enforce.test.ts` |
| Nothing has called it yet | `cre execution list bonded-stepup-threshold-staging` → no executions |

Workflow id: `00771462b003b4e3aaf0fa3d1ee25b147afd36b7e239dd0951c6e33a0c04af8b`

---

## 6. Recommendations for Chainlink

Offered as a report from one integration, not a complaint:

1. **Say that the Workflow Registry is on Ethereum mainnet**, prominently, in the
   deployment prerequisites. "Staging target, mainnet registry, real ETH" is a
   surprising combination and cheap to state.
2. **Give the PENDING address state a reason and an expected duration.** A
   pending state with no diagnostic turns a support question into days of
   guessing.
3. **Document `--secrets-auth browser`** alongside the default. It removes the
   linking requirement entirely for secrets, and it was the thing that unblocked
   us — found in `--help`, not in the guides.
4. **Fix the `cre secrets create` argument shape in the docs** — the guides say
   workflow directory, the CLI wants a YAML path.
5. **Fail fast on interactive prompts in non-TTY environments**, or warn.
   Hanging with no output is the least debuggable failure mode available.
6. **Document how to invoke a deployed HTTP-triggered workflow** — endpoint and
   request signing. It is the last mile of the whole feature, and it is missing.

---

## 7. What remains

One item: wire `requiresStepUp` to the deployed workflow, which needs §2.7
resolved. Until then the threshold comparison stays local — correct, tested,
fail-closed, and not confidential — and every surface in the project says so.
