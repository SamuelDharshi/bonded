# ETHGlobal Tokyo 2026 — corrected migration plan

`BONDED_COMMERCE_MIGRATION_PRD.md` was written against an earlier Bonded than the
one in this repository. Following it literally would mean editing files that do
not exist and preserving a design system that was replaced. This document is the
audit, the corrections, and the build order that actually applies.

Baseline tagged as **`ethonline-v1`**. `git diff ethonline-v1..HEAD --stat` is the
migration's own proof of what moved.

---

## Part 1 — Audit: where the PRD and the codebase disagree

### 1.1 The authority layer is Chainlink CRE, not Ledger

The PRD's single largest error. It describes `packages/authority` as
"Ledger `ring` + DMK step-up" and prescribes replacing a WebHID device flow.

**Reality:** `packages/authority/src/chainlink/tee.ts`. There is no Ledger
anywhere in this repository and there never was. The step-up gate is:

- `BondedVault.confirmStepUp(proposalHash)` — a direct transaction from the
  owner's wallet, no signature accepted in its place
- `/app/approvals` in the console — the human-facing surface
- `EnforceContext.requiresStepUp` — an optional port the enforcer calls

`/api/stepup/route.ts`, which the PRD tells us to rewrite, was **deleted** — it
was the only place the web tier held the enforcer signing key, and removing it
was a deliberate security improvement.

**Consequence for the migration:** this is *better* news than the PRD thinks.
World ID for Agents does not replace a hardware dependency; it plugs into a port
that already exists, is already tested fail-closed, and already has a UI. The
swap is `creRequiresStepUp` → `worldRequiresStepUp` at one call site.

### 1.2 `resolvePremise()` does not exist

The PRD calls it "the only touchpoint" and shows a dispatch on `def.schema`.

**Reality:** `enforce()` takes an injected `QueryFn`:

```ts
export type QueryFn = (
  schema: string, field: string,
  params: Record<string, string>, atBlock: bigint,
) => Promise<string | null>;
```

The enforcer makes **no network calls of its own** and never imports an adapter.
Whoever builds the context supplies the function.

**Consequence:** the PRD's central claim — that the core generalises across
domains — is *mostly* true and provable cheaply. There is no dispatch to extend;
a commerce `QueryFn` is a new function in a new package.

**Corrected after building it.** "The enforcer is not edited at all" was wrong,
and I claimed it here before testing it. See 1.7.

### 1.3 `enforce()` has six steps, not five

Policy hash → forbidden action → premise re-derivation → budget → irreversible
threshold → **CLEARED**. The PRD's five-step description omits the terminal step.
Cosmetic, but the demo script quotes it.

### 1.7 The enforcer DID need one change — found by running it

The claim above, and the PRD's, was that `enforce()` moves domains untouched.
Building the commerce adapter disproved it.

`withinTolerance()` routed every value through `parseBigInt`, because every DeFi
premise was numeric — TVL, timestamps. Commerce premises are not: a seller is on
an allowlist or is not (`'true'`/`'false'`), an event is `'scheduled'` or
`'cancelled'`. So `sellerAuthorized eq 'true'` threw
`Cannot convert true to a BigInt`.

A throw there is worse than a wrong answer. It **escapes the fail-closed path**:
`enforce()` converts unresolvable facts into refusals, but an exception
propagates out and becomes a 500. Silence stops being a refusal at exactly the
moment that property matters most.

Fixed with one branch in `withinTolerance` — non-numeric `eq` compares strings,
and still requires both conditions independently (reality satisfies the policy,
AND the claim matches reality), so the scalper case where the agent *claims*
authorisation still fails. Six regression tests added; the enforcer suite is 50,
up from 44, with all 44 originals unchanged.

**What the corrected claim is, and it is still strong:** the enforcer's control
flow, its six steps, its fail-closed structure and every existing test survived
the domain change untouched. One comparison primitive had a latent gap that only
a non-numeric premise could expose. That is a far more credible story than "not
one line changed", and it comes with a test proving the gap is closed.

### 1.4 The design system was replaced, and the PRD preserves the wrong one

PRD Part F says "unchanged" and then specifies a **dark** palette
(`harbor #0B1A22`) with Instrument Sans + JetBrains Mono.

**Reality:** a **light** theme — `harbor #FFFFFF`, `deepwater #F2F8FD`,
`manifest #10314A`, accent `#1E7BB8`, with Space Grotesk + IBM Plex Mono + Geist
Pixel. The verdict colours did survive in spirit but not in value:
`seal #1E7A55`, `stamp #B03A22`, `hold #9A6B12`.

**Consequence:** "carry the design over unchanged" is the right instruction and
the PRD's own colour values must be ignored. Use `tailwind.config.ts`.

### 1.5 Paths the PRD builds on that do not exist

| PRD path | Reality |
|---|---|
| `app/live/page.tsx` | **Deleted.** Scripted scenarios read as a mock; replaced by `/app/activity` |
| `app/api/propose/route.ts` | Never existed |
| `app/api/enforce/route.ts` | **Deleted** with `/live` |
| `app/api/stepup/route.ts` | **Deleted** — see 1.1 |
| `app/api/compile-policy/route.ts` | Now `/api/v1/policies/compile` |
| `apps/replay/` | Never existed |
| `lib/arc-client.ts` | Now `lib/bonded/chain.ts` |
| `packages/seam/src/money.ts` | Never existed; fixed-point lives in `compiler/src/compile.ts` and `seam/src/types.ts` |

### 1.6 Things the PRD does not know exist

Built after it was written, and all of them matter to the migration:

- **`packages/settlement`** — CLI: agent client, owner-confirm, policy publish
- **`packages/proposer`** — prompt construction
- **Owner/agent multi-tenancy** — `deposit`/`withdraw`, `authorizeAgent`, per-owner
  budgets. The PRD's Move sketch models a single-owner vault and would be a
  regression.
- **The agent-facing v1 API** — no API keys; agents sign proposals with the key
  they already hold
- **The verdict digest** — binds chain, vault, agent and `keccak256(action)`,
  after an exploitable version that did not. The Move port must preserve this.
- **The content-addressed policy store**

---

## Part 2 — Corrected migration map

| Component | Today | Tokyo | Real status |
|---|---|---|---|
| `packages/seam` | DeFi premise vocabulary | + commerce schema strings | **Additive only** |
| `packages/enforcer` | injected `QueryFn` | **untouched** | **Zero changes** — tests prove it |
| `packages/compiler` | policy → artifact → hash | + commerce premise compilation | Extended |
| `packages/standardized` | Messari via Graph Gateway | **kept** (still proves the primitive) | Kept, demoted from sole truth source |
| `packages/intercepta-adapter` | — | payment/counterparty risk | **New** |
| `packages/issuer-oracle` | — | item truth, disclosed fixture | **New** |
| `packages/world-agents` | — | fresh verification | **New**, replaces `authority/chainlink` |
| `packages/authority` | Chainlink CRE TEE | World implementation of the same port | **Rewritten behind an unchanged interface** |
| `contracts/` (Solidity/Arc) | live, 23 verdicts | `move/` on Sui | **Rewritten** |
| `packages/settlement` | viem/Arc | Sui TS SDK | **Rewritten** |
| `apps/console` `/app/*` | owner console | + `/shop` | Extended |
| `packages/attack-corpus` | AttackToken + model runs | + scalper page | Extended |
| Design system | light theme | **unchanged** | Carried as-is |

---

## Part 3 — What must be verified before writing code

The PRD marks several items `[VERIFY]` and forbids guessing a plausible
signature. That rule is right and this repository has a stricter version of it:
**nothing gets mocked to look finished.** These are blocked on real
documentation, not on inference:

1. **Sui TS SDK** — current package name and PTB-building API
2. **Sui testnet stablecoin** — which coin type `Balance<T>` should hold. One
   line that everything else depends on.
3. **Move stdlib surface** — `Coin`/`Balance` split-and-transfer pattern, and the
   `assert!` error-code convention to standardise on
4. **World ID for Agents sandbox** — authorization-request and callback shapes.
   OIDC-shaped, explicitly *not* the IDKit widget.
5. **Intercepta** — exact base URL and response schemas for Scan Token / Scan
   Address / Scan Message, plus the pinned mainnet test addresses from their
   Discord. Their qualification bar says the call must be live and that
   **mainnet** addresses must be screened even when payment runs on testnet.

Until each is read, the corresponding adapter gets an interface and tests against
that interface — never a fabricated response shape.

---

## Part 4 — Build order, against real paths

1. **`packages/seam`** — ✅ done. `schema` was already `string`, so no type
   changed at all; `schemas.ts` declares the vocabulary as constants.
2. **`packages/enforcer`** — ✅ done. One real fix (1.7), 50 tests green.
3. **`packages/issuer-oracle`** — ✅ done. Disclosed fixture, 17 tests, including
   five that run the real `enforce()` against it end to end.
4. **`packages/attack-corpus`** — the scalper page. Needs nothing external.
5. **`packages/intercepta-adapter`** — *after* reading their docs.
6. **`packages/world-agents`** — *after* reading the sandbox docs. Implements the
   existing `Authority` interface, so `requiresStepUp` does not change shape.
7. **`move/`** — *after* resolving the three Sui unknowns. Must preserve
   multi-tenancy and action-binding, which the PRD's sketch drops.
8. **`packages/settlement`** — retarget from viem/Arc to the Sui SDK.
9. **`apps/console/app/shop`** — last, against real deployed objects.

Steps 1–4 are unblocked now. Steps 5–9 each need a documentation pass first.

---

## Part 5 — Corrections to carry into the pitch

Two PRD arguments get **stronger** once corrected, and both are worth saying:

**"The enforcer barely changed, and the one change was a bug it had all along."**
Do not claim zero edits — it is checkable and it is false. The honest version is
better anyway: the control flow, the six steps and all 44 original tests survived
untouched, because the enforcer never knew where facts came from. Moving domains
then exposed a latent crash in one comparison primitive, where a non-numeric
premise escaped the fail-closed path. Finding that is evidence the migration was
real work rather than a reskin.

**"The human gate didn't change either."** The PRD frames World as replacing a
hardware dependency. It is really filling a port that already exists, is already
tested fail-closed (an unreachable oracle **holds**, never clears), and already
has a UI at `/app/approvals`. The same `EnforceContext.requiresStepUp` that
Chainlink CRE plugs into takes World with no change to the enforcer.

One argument gets **weaker** and should be dropped: the PRD's claim that Move's
capability object is stronger than "the EVM version's ECDSA signature check"
overstates the Solidity design it is comparing against. The current vault binds
chain, vault, agent and action hash into the digest — after a real exploit where
it did not. The Move port must reproduce that binding; presenting Move as fixing
a weakness that was already fixed would be an overclaim, and the exploit-and-fix
story is the better one to tell anyway.
