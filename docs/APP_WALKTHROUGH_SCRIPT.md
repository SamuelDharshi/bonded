# App walkthrough — what to say on every page

Companion to [`DECK_SCRIPT.md`](DECK_SCRIPT.md). That one covers the slides; this
covers the product. **[Brackets]** are actions, everything else is spoken.

Use the whole thing for a product-focused walkthrough (~3 min), or pull the two
starred pages into the main demo and skip the rest.

**★ `/app/approvals` and ★ `/app/activity` are the two that carry the argument.**
If you only show two pages, show those.

---

## `/` — the landing page · 15s

**[scroll slowly past the hero]**

> "The claim up front: the model proposes, and it cannot approve itself."

**[keep scrolling to the sponsor strip]**

> "Three sponsor technologies, each load-bearing — remove any one and a layer
> stops working. I'll show you where each of them actually does its job."

Don't linger. The landing page is the argument; the app is the evidence.

---

## `/app` — Overview · 25s

**[the page shown in the screenshot]**

> "This is my account. My address is my account — there's no signup, no password,
> and I'm never asked for a private key."

**[point at the amber panel]**

> "Three payments are waiting for my signature. That's the only thing in this
> product that's urgent, so it's the first thing on the page and it's the only
> tab with a badge."

**[point at the four cards]**

> "What I have credited. What my agents have spent this period against the
> budget. The amount above which I have to confirm by hand. And how many agents
> can spend at all."

> "Every one of those numbers is read from the chain, not from a database."

**Why it's built this way** — mention only if you have room:

> "This page isn't a control surface. Every action lives on its own page. A
> dashboard that repeats every control is just a long scroll with tabs."

---

## `/app/policy` — Policy · 35s

> "These are the rules my agents are held to."

**[point at the two hashes]**

> "The top one is what I committed on-chain. The bottom is the artifact the
> enforcer actually reads. If those two ever disagree, nothing is enforced — it
> says so rather than quietly using the stale one."

**[click "Change your policy"]**

> "Setting it is three deliberate steps, and they're separate on purpose."

**[point at each as you say it]**

> "**Compile** turns what I want into a canonical artifact and shows me its hash.
> **Commit** puts that hash on-chain **from my own wallet** — which is the step
> that matters, because it means nobody, including this service, can change what's
> being enforced. **Publish** hands over the artifact, and it's only accepted if
> it hashes to what I just committed."

> "One 'Save' button would have hidden the middle step, and the middle step is the
> whole arrangement."

**If the red mismatch panel is showing:**

> "And this is the vault telling me it disagrees with my policy. The enforcer
> judges against the policy; the vault decides what it actually releases. While
> those differ, a payment can be cleared and then rejected — so it's caught here
> with one button to fix it, rather than surfacing as a failed transaction later."

---

## `/app/funds` — Funds · 20s

> "Money my agents can spend."

**[point at the balances]**

> "Deposited USDC is credited to my address, and only my address can withdraw it.
> Agents are never credited anything — there's no path from an agent key to my
> money."

**[point at the two deposit buttons]**

> "Deposit is two transactions because ERC-20 is: an approval, then the deposit
> that pulls against it. They're two buttons rather than one that silently pops
> your wallet twice."

> "And a plain transfer into the vault is credited to nobody and can't be spent —
> which is why there's a deposit function at all."

---

## `/app/agents` — Agents · 25s

**This is the page that surprises people. Slow down.**

> "These are the addresses allowed to propose against my policy."

**[point at the authorize field]**

> "Authorising an agent means pasting its **public address**. That's it. Its
> private key never moves, and nothing in this product ever asks for one."

> "People expect to paste a secret somewhere. There's nowhere to paste one. The
> agent proves each proposal by signing it with the key it already has — so
> there's no API key to leak, and revoking is one transaction."

**[point at a revoked entry, if there is one]**

> "Revoked agents stay visible. That an agent once had access is part of the
> record, not noise to hide."

---

## ★ `/app/approvals` — Approvals · 40s

**The most important page in the app. Do not rush it.**

> "This is the human gate."

**[point at one held payment]**

> "This is the amount, and this is where it would go."

> "Both of those were decoded from the transaction that armed the hold, and then
> checked against the action hash the vault recorded. So what I'm approving is
> **provably** what will move — not a number a server is telling me. If that check
> ever failed, this panel would say so instead of showing me a figure it can't
> stand behind."

**[point at the reason line]**

> "And it tells me why this one stopped. Either the amount is over my threshold,
> or the confirmation check couldn't be completed and the enforcer held rather
> than cleared. It doesn't guess between the two."

**[click "Confirm this payment", sign]**

> "That's my wallet. Not the enforcer's key, not the agent's. The vault only
> accepts this from my address — and the confirmation is bound to this one exact
> action, so a different payment can't ride on it."

---

## ★ `/app/activity` — Activity · 30s

> "Two things here, and both are live."

**[point at the premise table]**

> "This is what my rules evaluate to **right now**. My policy says the pool needs
> at least fifty million in TVL — it's re-deriving that from The Graph, at a
> pinned block, and telling me whether it passes."

> "That's the same check the enforcer runs before it will sign anything. Asked
> directly, with no proposal invented to trigger it."

**[scroll to the verdicts]**

> "And every verdict that's settled for my agents. Including the refusals —
> those settle on-chain too, so there's a permanent record that nothing moved and
> why."

**[click a transaction hash]**

> "Each one links to the real transaction on Arc."

---

## `/log` and `/corpus` — if asked · 20s

**`/log`** — *"Every verdict across every vault this project has deployed. Three
deployments, one continuous history — each migration added a subgraph source
rather than re-pointing the old one, because re-pointing would rewrite history."*

**`/corpus`** — *"The baseline. Three real models, run against the real attack
token with no defences. Two called `approve_unlimited` on the injected
instruction. One recognised it and refused. That's the problem this exists to
fix."*

---

## `/architecture` — if asked · 15s

> "Three layers and an honest status on each. The Graph and Arc are live.
> Chainlink CRE is deployed and the enforcer calls it — the invocations are
> visible in `cre execution list` — but their enclave DON isn't provisioned yet,
> so the verdict falls back to the policy artifact, and every response says which
> path decided it."

---

## Three sentences that do the most work

If you remember nothing else from this file:

1. *"Authorising an agent means pasting its public address. Its private key never
   moves, and nothing here ever asks for one."*
2. *"What I'm approving is provably what will move — decoded from the arming
   transaction and checked against the hash the vault recorded."*
3. *"That's my wallet signing. Not the enforcer's, not the agent's."*

---

## One thing not to say

Do not describe a held payment as "held because it's over your threshold" unless
you have checked that it is. Some of the current holds are **0.5 USDC against a
1 USDC threshold** — they were held because the threshold check couldn't complete
and the enforcer failed closed. The page now distinguishes the two; make sure your
narration does too, because a judge reading the screen will notice if it doesn't.
