# Prize application fields — copy-paste

Permalinks are pinned to commit `aee33f6`. If you push again before submitting,
either re-pin or swap `aee33f6…` for `main` — a `main` link drifts, a pinned one
does not, and judges click these.

Base: `https://github.com/SamuelDharshi/bonded/blob/aee33f6d911210a8204fddd3dd1ec2e5b2a9fc92/`

The ease ratings below are **suggestions with reasons**, not answers. They are
your ratings — but each one is argued from something that actually happened, so
you can defend whatever you pick.

---

# The Graph — $15,000

## Why you're applicable

> Bonded uses The Graph as its **truth layer** — the thing that makes the whole
> project possible rather than a nice-to-have. An agent claims facts; a
> non-generative enforcer re-derives every one of them from **Messari
> standardized subgraphs** through the **decentralised Gateway** before any money
> moves. Standardization is what makes a policy portable: one premise definition
> (`messari-dex-amm`, `liquidityPool.totalValueLockedUSD`) resolves against any
> DEX-AMM protocol instead of being rewritten per-protocol. Every premise in a
> single decision resolves at **one pinned block**, so the facts behind a verdict
> are internally consistent rather than several reads taken moments apart. We
> also ship our **own subgraph**, which indexes the vault and registry across
> three deployments and answers the questions the contracts cannot — "which
> agents can spend my money", "what is waiting for my signature" — because
> `ownerOf` is a mapping and a mapping has no keys.

## Link to the line of code

**Primary — block pinning, the heart of it:**
`apps/console/lib/bonded/graph.ts#L41-L58`
→ https://github.com/SamuelDharshi/bonded/blob/aee33f6d911210a8204fddd3dd1ec2e5b2a9fc92/apps/console/lib/bonded/graph.ts#L41-L58

**Supporting:**
- Gateway URL construction, incl. deployment-vs-subgraph IDs — `packages/standardized/src/gateway.ts#L62-L70`
- `cache: 'no-store'` on the enforcement path — `packages/standardized/src/gateway.ts#L102`
- Messari standardized schema mapping — `packages/standardized/src/schemas/messari-dex-amm.ts#L37-L60`
- Our subgraph manifest (3 vault sources, one history) — `subgraph/subgraph.yaml`
- Mappings — `subgraph/src/mappings.ts`

## Ease rating

**Suggest 7.** The Gateway is genuinely good and standardized subgraphs are the
reason this project works at all. Two specific things cost real hours, both
below.

## Feedback for the sponsor

> The standardized subgraphs are the best thing here — being able to write one
> premise against `messari-dex-amm` and have it resolve across protocols is
> exactly what made a portable policy possible. Two pieces of friction cost us
> hours each, and both are documentation rather than product:
>
> **1. Deployment IDs and subgraph IDs need different paths, and the error does
> not say so.** A `Qm…` deployment ID sent to `/subgraphs/id/` returns
> `"invalid subgraph ID"`, which reads exactly like a subgraph that has been
> removed. It actually belongs under `/deployments/id/`. We lost time assuming
> the subgraph was dead. A one-line note on the Gateway page, or an error that
> says "this looks like a deployment ID, try /deployments/id/", would remove this
> entirely.
>
> **2. "Gateway URL" means two different things.** Our own Studio query endpoint
> and the decentralised Gateway base for third-party subgraphs are both naturally
> called the gateway URL, and we had them in one environment variable. Every
> Messari lookup silently hit our own subgraph and failed with
> `Type 'Query' has no field 'liquidityPool'` — a schema error, which sends you
> looking at your query rather than your URL. Naming them distinctly in the docs
> (`STUDIO_QUERY_URL` vs `GATEWAY_BASE_URL`) would prevent it.
>
> **3. A smaller one:** `_meta { block { number } }` as the way to pin a
> consistent read set deserves to be more prominent. It is the difference between
> a decision made against one block and a decision made against several, and we
> found it by reading around rather than from a guide.

---

# Arc — $10,000

## Why you're applicable

> Arc is where Bonded's money actually lives. `BondedVault` holds USDC and
> releases it only against a verdict signed by the enrolled enforcer — with
> per-owner credited balances, per-owner rolling 7-day budgets, hard anti-replay,
> and a step-up gate that only the owner's own wallet can clear. 23 verdicts have
> settled on Arc testnet so far, refusals included, because a refusal settles
> on-chain too and leaves a permanent record that nothing moved and why.
> **Arc's USDC-denominated gas is load-bearing for the product, not incidental:**
> an autonomous agent with a USDC spending balance never has to acquire a second
> asset just to pay for its own transactions, which removes an entire class of
> operational problem from running one.

## Link to the line of code

**Primary — `settle()`, where money moves or does not:**
`contracts/src/BondedVault.sol#L282-L380`
→ https://github.com/SamuelDharshi/bonded/blob/aee33f6d911210a8204fddd3dd1ec2e5b2a9fc92/contracts/src/BondedVault.sol#L282

**Supporting:**
- The verdict digest binding chain, vault, agent and action — `contracts/src/BondedVault.sol#L247`
- Arc chain definition, USDC as native currency — `packages/settlement/src/chain.ts#L23`
- Policy commitments per owner — `contracts/src/BondedRegistry.sol`

**Live:** [`BondedVault`](https://testnet.arcscan.app/address/0x027C61c1418157b112B82F30894F8aC1F074AF85) ·
[`BondedRegistry`](https://testnet.arcscan.app/address/0xB825225163aEf4353d0110BA63d0d811A17B8205) ·
[`AttackToken`](https://testnet.arcscan.app/address/0x117E83CC8DcB5fe9D4F5a82c86B3bCe6c9355Ff5)

## Ease rating

**Suggest 8.** Standard EVM tooling worked without modification — Foundry, viem,
`cast`, all of it. Three redeployments and a subgraph across them, no surprises.

## Feedback for the sponsor

> USDC-denominated gas is the most interesting thing about Arc for this use case,
> and we would lead with it harder. For autonomous agents specifically it removes
> a genuine operational problem: an agent holding a spending balance can pay for
> its own transactions without anyone topping it up with a separate gas asset.
> That deserves to be framed as an agent-infrastructure feature, not just a
> convenience.
>
> Everything else was unremarkable in the best way — Foundry, viem and `cast`
> worked unmodified, and we deployed the vault three times over the course of the
> build without hitting anything Arc-specific.
>
> Two small things that would have helped:
>
> **1. Gas estimation with USDC-denominated fees is initially confusing.** Seeing
> a cost quoted with 18 decimals for a chain whose native unit is USDC made us
> double-check we had not misconfigured the chain. A short note on the
> distinction between the 18-decimal native unit and the 6-decimal USDC token
> would settle it immediately.
>
> **2. Explorer verification.** We linked contracts by address throughout, and
> source verification on Arcscan being more discoverable would make those links
> far more useful to anyone auditing a submission like this one.

---

# Chainlink — $3,000

## Why you're applicable

> We built a real `handlerInTee` **Confidential Workflow** — not the hello-world
> template. The enclave fetches the policy's confirmation threshold as a
> **Vault DON secret** inside an AWS Nitro enclave, compares by strict `BigInt`,
> and returns **only a boolean**. The threshold never leaves the enclave and is
> never logged. The reason that matters: a firewall whose threshold is public is
> one an attacker can binary-search — propose 0.9, 1.0, 1.1, and the refusals
> tell you exactly where the gate sits. Sealing it means probing reveals the
> answer, never the boundary. The workflow is **deployed and ACTIVE**, and the
> enforcer calls it on every proposal over the line, authenticating with a
> JWT signed by the enrolled key.

## Link to the line of code

**Primary — the secret read inside the enclave:**
`cre/stepup-threshold/workflow.ts#L76`
→ https://github.com/SamuelDharshi/bonded/blob/aee33f6d911210a8204fddd3dd1ec2e5b2a9fc92/cre/stepup-threshold/workflow.ts#L76

**Supporting:**
- `cre.handlerInTee` registration — `cre/stepup-threshold/workflow.ts#L136`
- Our gateway client (JWT, sorted-key digest, EIP-191) — `apps/console/lib/bonded/cre.ts#L89`
- The enforcer port it plugs into, fail-closed — `packages/enforcer/src/enforce.ts#L60`
- Deployment evidence — `docs/evidence/cre-stepup-threshold-deployment.txt`

**On-chain:** owner link [`0x1ca93364…`](https://etherscan.io/tx/0x1ca933647b7b25a0fe5d3e7b47fa7ffb0f28c770b16a06fdcb14ad7c70ef160a) ·
registration [`0x9a7a7967…`](https://etherscan.io/tx/0x9a7a796783cafc485a43c17b174ccb74b4c98384aece1b48f7aa919505b9b60b)

**Be upfront:** the executions currently fail inside Chainlink's infrastructure
with `DON members not set` — confidential workflows are in private beta and the
enclave DON is not provisioned for our org. The enforcer falls back to comparing
the policy artifact and **every API response reports which path decided**.

## Ease rating

**Suggest 4.** The SDK and the confidential-workflow model are genuinely
impressive and the simulator is excellent. Getting from a working simulation to a
working deployment took days, almost entirely on documentation gaps — every one
listed below.

## Feedback for the sponsor

> The confidential-workflow model is the most interesting thing we used in this
> hackathon, and `cre workflow simulate` is excellent — fast, clear, and it told
> us the truth about both branches of our logic. Getting from a passing
> simulation to a working deployment took days, and every obstacle was
> documentation rather than product. In rough order of cost:
>
> **1. Address linking sits PENDING with no reason and no expected duration.**
> Ours showed PENDING for days — same screen on day one and day four, no error,
> no diagnostic. An org limit of 1/1 owner meant we could not try a different
> address either. A failure with a reason is a task; a pending state with no
> reason is a guess about whether to wait or escalate. This was by far the most
> expensive thing.
>
> **2. The Workflow Registry is on Ethereum mainnet, and nothing says so.**
> Our workflow targets `staging-settings`, so we did not expect `LinkOwner` and
> `UpsertWorkflow` to be **real mainnet transactions costing real ETH**. The
> amounts were small (~0.00005 ETH total) — the surprise was the category, not
> the cost. This belongs in the deployment prerequisites in bold.
>
> **3. `--secrets-auth browser` is the flag that unblocked us, and it is only in
> `--help`.** The default `onchain` mode needs a linked key; `browser` uses the
> private registry, assigns its own owner, and needs no linking at all. That
> distinction was the difference between blocked and not, and we found it by
> reading `--help` after exhausting the guides.
>
> **4. `cre secrets create` takes a YAML path, not a workflow directory.** The
> docs we had showed the directory form, which fails with
> `expected a YAML file; for MSIG step 2 use cre secrets execute <bundle.json>`
> — an error that points somewhere unrelated to the actual mistake.
>
> **5. Secret namespaces default inconsistently.** `cre secrets create` stores
> under `main`; `runtime.getSecret({ id })` resolves `default` unless you pass a
> namespace. The mismatch surfaces only at execution time as
> `secret retrieval failed … (namespace: default)`, long after the thing that
> caused it. Defaulting both to the same namespace, or warning at deploy time,
> would remove a whole class of confusion.
>
> **6. `cre workflow deploy` prompts interactively when it auto-links**, and in a
> non-TTY environment it simply hangs with no output. `--owner-label` avoids it,
> but nothing in the failure suggests that. Failing fast with "this needs a TTY,
> pass --owner-label" would be much kinder to CI and to agentic tooling.
>
> **7. Invoking a deployed HTTP-triggered workflow is hard to find**, and the
> shape is surprising when you do. The guides cover `curl localhost:8080/trigger`
> for simulation; the deployed path needs a JWT whose payload carries a SHA-256
> digest of the **lexicographically key-sorted** body, signed EIP-191. Worth
> noting too that `workflows.execute` is **asynchronous** — it returns `ACCEPTED`
> and an execution id, not a result. For a confidential threshold check, which is
> the obvious use, the caller needs the answer synchronously and has to poll. A
> synchronous mode, or a prominent note that one is needed, would help.
>
> **8. Confidential workflows need private-beta enrollment to execute**, and
> nothing in the deploy path says so. We deployed successfully, invoked
> successfully, and then hit `DON members not set` at execution — which reads
> like our bug. Surfacing enrollment status at deploy time would have saved a
> day of looking in the wrong place.
>
> None of this is a complaint about the design — the model is right, and we built
> our whole authority layer around it on the assumption it will work. We wrote
> the full account up at `docs/CRE_INTEGRATION_REPORT.md` in case it is useful.

---

# Other partner technologies used (no prize applied for)

Select whatever appears in the list that matches:

- **Vercel** — the console is deployed there
- **Foundry** — contracts and tests
- **OpenZeppelin** — ECDSA, ReentrancyGuard, SafeERC20 (v5)
- **viem** — all TypeScript chain interaction
- **Groq** — ran the real LLM agents in the attack corpus

Do not select anything you cannot point at in the repo. The lockfile contains
Hardhat, ethers.js and Changesets because `contracts/lib/` vendors OpenZeppelin's
own source tree — none of those are ours.
