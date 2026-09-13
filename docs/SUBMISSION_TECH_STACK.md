# Submission — tech stack fields

Read off the repo, not recalled. Where an option list differs from these names,
pick the nearest match and put the rest in the free-text "other" field.

**Note:** the repo vendors OpenZeppelin's own source under `contracts/lib/`, which
drags in Hardhat, Changesets, solhint and others as *its* devDependencies. Those
are not ours — do not list them. The lists below are only what this project uses.

---

## Ethereum developer tools

- **Foundry** — `forge` for contracts and tests, `cast` for every on-chain read
  and the wallet generation
- **viem** — all TypeScript chain interaction: clients, signing, ABI encoding
- **The Graph** — our own subgraph, plus Messari standardized subgraphs through
  the decentralised Gateway
- **OpenZeppelin Contracts** — ECDSA, MessageHashUtils, ReentrancyGuard,
  SafeERC20, IERC20 (v5)
- **Chainlink** — CRE confidential workflow (`@chainlink/cre-sdk`), Vault DON
  secrets
- **Etherscan** — the CRE owner-link and workflow registration are real Ethereum
  mainnet transactions; Arcscan is the equivalent for Arc

**Not used, despite being in the lockfile:** Hardhat, ethers.js, wagmi,
Alchemy/Infura. All of those arrive via the vendored OpenZeppelin tree.

---

## Blockchain networks

- **Arc testnet** (chain id 5042002) — where everything settles. Vault,
  registry, attack token, all 23 verdicts. Gas paid in USDC.
- **Ethereum mainnet** — not incidental. Chainlink's CRE Workflow Registry lives
  here, so linking the owner key and registering the workflow were real mainnet
  transactions costing real ETH, even though the workflow targets staging.
- **Base** — read-only. Premises re-derive against a real Uniswap V3 WETH/USDC
  pool on Base through a Messari subgraph. We never transact there, but every
  verdict depends on reading it.

*Ethereum Sepolia appears in `cre/project.yaml` but nothing transacts on it —
leave it off unless the form wants configured networks.*

---

## Programming languages

- **TypeScript** — everything: enforcer, API, console, settlement scripts, the
  CRE workflow. Strict mode with `noUncheckedIndexedAccess` and
  `exactOptionalPropertyTypes`.
- **Solidity** — 0.8.26, `via_ir`. `BondedVault`, `BondedRegistry`,
  `AttackToken`.
- **AssemblyScript** — the subgraph mappings (`@graphprotocol/graph-ts` compiles
  to WASM through AssemblyScript, not plain TypeScript — different enough to be
  worth listing).
- **GraphQL** — the subgraph schema and every Gateway query.
- **JavaScript** — a couple of vendored react-bits WebGL components and config
  files.

---

## Web frameworks

- **Next.js 15.5** — App Router, server components, route handlers for the API
- **React 19**
- **Tailwind CSS 3.4**

---

## Databases

**None.** Worth answering plainly rather than reaching for one:

- Policy artifacts are **JSON files**, content-addressed against the on-chain
  hash — an artifact is only ever served if it hashes to what the owner
  committed, so the integrity comes from the chain rather than from the store.
- Everything else that looks like a database is **the subgraph**, which is an
  index over chain events, not a datastore we write to.

If the form insists on a selection, **The Graph** is the honest one.

---

## Design tools

**I cannot answer this one for you — you made these choices, not me.**

What is visible in the repo: Tailwind for the design system, **react-bits**
components (`GradientWaves`, `Grainient`) pulled in via the **shadcn** CLI,
**Geist** and **IBM Plex Mono** as typefaces, **Mermaid** for the architecture
diagram, and **Framer Motion** for transitions.

Add whatever you actually used for the logo and the backdrop art — the README
already states that the decorative art is AI-assisted illustration, so if that
came from an image model, name it.

---

## Other technologies / libraries / tools

```
Chainlink CRE SDK · AWS Nitro Enclaves (via CRE) · The Graph Subgraph Studio ·
Messari standardized subgraphs · Turborepo · pnpm workspaces · Jest · ts-jest ·
tsx · Zod · decimal.js · Framer Motion · OGL (WebGL) · Mermaid · react-bits ·
shadcn · lucide-react · Geist · Vercel · Groq API
```

---

## Describe how AI tools were used in your project

> Two separate things here, and they are worth keeping apart: AI used to **build**
> the project, and AI used **inside** it. Edit the first paragraph to match what
> you actually did — I can only speak to the sessions I was in.

**Claude Code (Anthropic) — used heavily, for most of the implementation.** It
wrote the Solidity contracts, the non-generative enforcer and its test suite, the
Next.js console and agent-facing API, the subgraph schema and mappings, the
Chainlink CRE confidential workflow, the settlement and agent scripts, and the
documentation. Direction, product decisions, design judgement and every on-chain
transaction involving real funds stayed with me.

Two things worth calling out, because they show what the tool was actually good
for. It found a **real exploitable vulnerability in our own vault** during a
review — the signed verdict digest covered the decision but not the action, so a
signed verdict authorised a *decision* rather than a *payment*. It wrote the
proof-of-concept that demonstrated a 0.50 USDC authorisation draining a 10,000
USDC balance, fixed the digest, and left the exploit tests in the repo as
permanent regressions. It also caught a policy/vault threshold mismatch that was
silently reverting settlements, by running the whole flow end to end rather than
by reading the code.

It also made an expensive mistake worth being honest about: it recommended
funding a deploying address without checking its on-chain history first, and that
address turned out to be a well-known trivial key with a sweeper attached. The
ETH was gone in seconds. Recorded in `docs/CRE_INTEGRATION_REPORT.md` rather than
quietly dropped.

**Groq API — AI as the subject, not the tool.** The attack corpus
(`packages/attack-corpus`) runs real LLM agents against the real deployed attack
token with no defences, to establish the baseline the enforcer exists to fix.
Three models were run: `openai/gpt-oss-120b` and `openai/gpt-oss-20b` both called
`approve_unlimited` on the injected instruction; `qwen/qwen3.6-27b` recognised it
and refused. Those transcripts are real runs, not synthesised.

**AI-assisted illustration** was used for decorative backdrop art on the landing
page. No piece of evidence on the site is AI-generated — the token's `name()`
read, the premise diffs and the settled transactions are all live data.
