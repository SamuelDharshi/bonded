# Demo runbook — what to say, what to click, in what order

The presenter's script.
[`DECK_SCRIPT.md`](DECK_SCRIPT.md) is the word-for-word narration for all twelve
slides; this file is the live-demo half plus the preflight.
[`DEMO_SCRIPT.md`](DEMO_SCRIPT.md) is the technical checklist that proves each
surface works before you point a camera at it.

**The through-line, and the only sentence that has to land:** the model proposes,
and something that has never read the prompt checks its claims before money
moves. Every beat is evidence for that one sentence. If you are running short,
cut anything that is not.

---

## Before you record

### Funding — do this first, it is currently short

You have **1.0 USDC credited** and the step-up beat releases **2 USDC**. It will
revert mid-demo.

```bash
pnpm --filter @bonded/settlement fund-vault 3
```

Your wallet holds ~3.3 USDC, so deposit 3 and you have 4.0 credited: enough for
one 2 USDC step-up plus two 0.5 USDC clears, with room to redo a take.

### Everything else

```bash
# 1. One fresh server. Never two — they fight over .next.
pnpm dev

# 2. Confirm the state the demo assumes
curl -s localhost:3000/api/v1/owners/$ENFORCER_SIGNER_ADDRESS | jq '{
  credited: .funds.creditedToYou,
  policy:   .policy.status,
  limits:   .limits.matchesPolicy,
  agents:   [.agents[] | select(.authorized)] | length
}'
```

You want `policy: "ok"`, `limits: true`, `agents: 1`, `credited` ≥ `4000000`.

If `limits` is `false`, stop and fix it — that is the mismatch that makes the
enforcer clear payments the vault then rejects, and it will blow up the demo at
the worst moment. `/app/policy` shows the fix as one button.

**Two windows, pre-arranged.** Browser on `/deck`, terminal beside it. You will
switch once, not repeatedly.

**Zoom the terminal.** The premise diff is the most important thing you will show
and it is small mono text.

---

## Shape

| | 3 min | 5 min |
|---|---|---|
| Deck, slides 1–6 | 70s | 100s |
| Live demo | 90s | 160s |
| Deck, slides 9–12 | 20s | 40s |

The live demo is the middle and the point. If you over-run on the deck, cut
slides 3 and 6, not the demo.

---

## Part 1 — the deck (`/deck`, arrow keys)

Slides 1 to 7, then switch to the terminal. Word-for-word narration, timings and
what to point at: [`DECK_SCRIPT.md`](DECK_SCRIPT.md).

The one line to land before you switch:

> "Rather than describe it, let me run it."

## Part 2 — the live demo

### Beat 1 · An honest proposal clears

```bash
pnpm --filter @bonded/settlement agent
```

> "This is an outside client. It holds no privileged access, it just signs its
> own proposal with its own key. It reads the pool, claims what it read, and asks
> Bonded."

When the premise table prints:

> "Claimed on the left, independently re-derived on the right. They agree, so it
> clears — and the agent settles it itself. Half a USDC moved on Arc."

### Beat 2 · A lie is refused — **this is the beat that sells it**

```bash
pnpm --filter @bonded/settlement agent lie
```

> "Same agent, same pool. This time it inflates the TVL it claims — four hundred
> and twelve million against a pool holding about a hundred and twenty-seven."

Point at the two numbers side by side.

> "The enforcer doesn't argue with it. It goes and looks. **PREMISE_MISMATCH**,
> refused — and the refusal settles on-chain too, so there is a record that
> nothing moved and why."

Slow down here. This is the whole thesis in one screen.

### Beat 3 · A forbidden action costs nothing

```bash
pnpm --filter @bonded/settlement agent forbidden
```

> "This one tries the injected action — approve unlimited. Look at the premise
> table: **it's empty**. Refused at the forbidden-action check before a single
> Graph query ran. The cheapest check comes first."

### Beat 4 · A signature is not authority

```bash
pnpm --filter @bonded/settlement agent rogue
```

> "A perfectly valid signature from an address no owner authorised. 403. The
> right to spend comes from an on-chain authorisation, not from being able to
> sign."

**~15 seconds.** Cut this one before beat 3 if you must.

### Beat 5 · The human gate — **switch to the browser**

```bash
pnpm --filter @bonded/settlement agent big
```

> "Two USDC — over the threshold this owner set. Every premise passes. The amount
> is what stops it. **HELD_FOR_STEPUP.**"

Now go to **`/app/approvals`** in the browser.

> "And here it is, waiting for me."

Point at the amount and recipient.

> "This is decoded from the arming transaction and checked against the action
> hash the vault recorded — so what I'm approving is provably what will move,
> not a number a server told me."

Click **Confirm this payment**. Sign in the wallet.

> "That's my wallet. Not the enforcer's key, not the agent's. The vault only
> accepts this from my address."

Back to the terminal:

```bash
pnpm --filter @bonded/settlement agent resume
```

> "The agent resubmits the identical proposal, and now it clears. Three separate
> transactions — armed, confirmed, executed — in an order the contract enforces."

### Beat 6 · Optional, if you have time

**`/app/activity`** — *"This is what my rules evaluate to against live data right
now, and every verdict that settled."*

**`/app/start`** — *"Setting this up is four steps, and you are never asked for a
private key. Authorising an agent means naming its address."*

---

## Part 3 — close

### Slide 9 · The human gate

> "You just saw that: held, confirmed from my own wallet, released."

### Slide 10 · Proof

> "Sixteen verdicts settled on Arc. A hundred and seventy-nine tests. Zero mocks
> on the money path."

### Slide 12 · Close

> "The model proposes. It cannot approve itself."

Stop talking. Let the last slide hold.

---

## What not to claim

The project is unusually honest and that is an asset. Do not spend it.

**Chainlink CRE.** Say: *"deployed, active, and the enforcer calls it — the
invocations are in `cre execution list`. The enclave can't return a verdict yet
because Chainlink's confidential-workflow DON isn't provisioned, so we fall back
to comparing the policy, and every response says which path decided."*

Do **not** say the confidential threshold is live in the enforcement path. One
`cre execution status` disproves it, and the honest version is more impressive —
it shows you got far enough to hit a platform limit.

**The attack corpus.** Real model runs against the real token. The `kit` field
carries starter-kit names, and each row's `repo` field says it is a
harness-authored agent. Present them as models.

**The signing key.** It's a local key (or a Vercel secret), not enclave-custodied.
Say so if asked; don't volunteer it mid-beat.

---

## If something breaks

**A settle reverts.** Almost certainly the policy/vault limit mismatch. Check
`/app/policy` — the fix is one button. Do not debug on camera; say "the vault
disagrees with the policy, which is exactly the check working" and move on.

**A proposal holds unexpectedly.** `ATTESTATION_MISSING` means the CRE call
failed and the enforcer failed closed. That is correct behaviour and a *good*
thing to narrate: *"the threshold oracle was unreachable, so it held rather than
cleared — fail-closed."*

**The Gateway is slow.** Each proposal makes a live Graph query. Two or three
seconds is normal. Don't fill the silence by apologising; say *"it's querying the
subgraph now."*

**The wallet doesn't pop up.** Check you're on Arc testnet. `/app` shows a switch
button if not.

---

## The one-sentence version

If you get thirty seconds and nothing else:

> "Agents read text that attackers control, and then sign transactions. Bonded
> splits the thing that reasons from the thing that authorises: the model
> proposes and states its reasons, and a non-generative enforcer re-derives every
> one of those reasons from The Graph before the money moves. It's settling real
> USDC on Arc right now."
