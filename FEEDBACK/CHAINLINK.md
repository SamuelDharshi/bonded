# Feedback — Chainlink CRE

Bonded uses Chainlink CRE's confidential `handlerInTee` as the active
authority layer (see `docs/FUTURE.md` for why this replaces the originally
planned Ledger implementation). Findings land here only after being
independently reproduced against the real CRE CLI/SDK.

## `cre/stepup-threshold`: real handlerInTee workflow, simulated (2026-09-08)

Implemented Bonded's actual irreversible-threshold check as a Confidential
Workflow, not the hello-world template: `cre/stepup-threshold/workflow.ts`.
An HTTP trigger receives `{ proposalHash, proposalValueUSDC }` (not
confidential — arrives on Workflow DON nodes per `confidential-workflows.md`),
the enclave fetches the policy's `irreversible_above` threshold as a Vault
DON secret (`IRREVERSIBLE_THRESHOLD_USDC`), computes `requiresStepUp` via a
strict `BigInt` comparison, and crosses back only the boolean — the
threshold itself never leaves the enclave, never gets logged, never gets
returned. This is Implementation PRD §D.6's argument implemented for real:
a threshold an attacker can binary-search from outside is not a threshold.

**Simulated successfully, twice** (above and below threshold), full
transcript at `docs/evidence/cre-stepup-threshold-simulation.txt`:

```
[USER LOG] stepup-threshold: proposal=0xabab...ab requiresStepUp=true
✓ Workflow Simulation Result:
"{\"proposalHash\":\"0xabab...ab\",\"requiresStepUp\":true}"
```

**Real API mismatches found between the skill's `triggers.md` reference and
the installed `@chainlink/cre-sdk@1.18.0`** — verified by reading the
package's own `.d.ts` files, not by trusting the doc:

1. `HTTPTriggerPayload` (the type name `triggers.md`'s example imports)
   **does not exist** in this SDK version. The real exported type is
   `HTTPPayload` (aliased from `Payload` in
   `generated/capabilities/networking/http/v1alpha/trigger_pb.d.ts`), and
   its shape is completely different from what the doc shows:
   - Doc claims: `{ body: object, headers: Record<string,string>, url: string }`
   - Actual: `{ input: Uint8Array, key?: AuthorizedKey }` — `input` is raw
     JSON bytes with **no built-in decode helper**. The SDK's `json()`/
     `text()` helpers in `http-helpers.d.ts` are for outbound `HTTPClient`
     *responses*, a different type, not this inbound trigger payload.
     Decoded manually: `JSON.parse(new TextDecoder().decode(trigger.input))`.
2. `authorizedKeys` in the HTTP trigger config is documented as
   `string[]` (plain addresses). The actual type is
   `AuthorizedKeyJson[]`, i.e. `{ type?: 'KEY_TYPE_ECDSA_EVM' | 'KEY_TYPE_UNSPECIFIED', publicKey?: string }[]`.
   Passing plain strings fails `tsc` with a real type error, not a runtime
   surprise — caught before ever reaching simulation.

Neither of these blocked the work — the actual installed `.d.ts` files were
authoritative and let me write correct code — but they mean an agent (or a
person) following `triggers.md` literally for an HTTP trigger, without
cross-checking the installed package, ships code that doesn't compile.

## Confidential Workflows Private Beta access — requested via both paths (2026-09-10)

Initially requested via `cre account access` (CLI), org `org_lgyLfW5Ebah6miLW`.
Also found and submitted Chainlink's actual Google Form for this (separate
from `cre account access` — the CLI prompt and the form appear to be two
paths to the same review queue; the form asks for the same org ID and adds
a use-case description plus a Private Beta Terms acceptance). Confirmation
received same day: **on the waitlist**, "under
review," no ETA given beyond "we'll notify you by email." Explicitly told
we don't need to wait for access to keep developing — local simulation is
sufficient, which matches what Chainlink staff told the ETHGlobal NYC
Discord repeatedly (see below).

## Chainlink staff confirm: simulation is sufficient for hackathon eligibility (reproduced from ETHGlobal NYC #partner-chainlink, dates April–June 2026)

Not our own finding, but directly relevant and worth recording since it
confirms our own approach without us having to guess:

> "You do not need to deploy the CRE project to mainnet — definitely not a
> requirement for this hackathon. To be eligible for prizes, you should
> simply run a local simulation of your workflow using the `cre workflow
> simulate` command. If your workflow includes the Chain Write capability,
> running the simulation with the `cre workflow simulate --broadcast` flag
> will result in the state changing transaction on testnet, so you will
> have a legit transaction hash, etc." — Solange Gueiros, Chainlink Labs

Also confirmed: no API key needed for the hackathon (production only), and
(from Andrej, Chainlink Labs) CLI v1.19.0+ supports `--listen` on
`cre workflow simulate` for HTTP/Log triggers, starting a local listener at
`http://localhost:2000/trigger` instead of requiring `--http-payload`
upfront — useful for interactive testing, not yet tried against
`stepup-threshold`. Our installed CLI (v1.32.0) is well above this minimum.

## Unreproduced community report: MockKeystoneForwarder may not forward writes on Arc (2026-04-05, ETHGlobal NYC Discord)

From a fellow builder, Francesco Vlacancich, not verified by us:

> "personally i had to deploy and override my own implementation of a
> MockForwarder on Arc cause the chainlink mock forwarder that the
> simulation was calling was not actually forwarding my write requests"

Relevant because it's exactly the Arc + simulation-forwarder intersection
this project would hit if `cre workflow simulate --broadcast` is ever run
against an on-chain write path. Flagging now, before we've reproduced it
ourselves, so it doesn't cost a debugging session later if we do hit it.
Also relevant to the Forwarder-address question generally: CRE's own
`evm-client.md` reference confirms simulation always uses a *different*
`MockKeystoneForwarder` address than the real network's production
`KeystoneForwarder` — they are never the same contract, by design, and no
Arc forwarder address is documented in the reference we have access to.
Do not hardcode one; verify against Chainlink's live forwarder directory
(`docs.chain.link/cre/guides/workflow/using-evm-client/forwarder-directory-ts.md`)
at the point an Arc production deployment actually happens.

## Not yet exercised

- Deployment itself — waitlisted, see above.
- The real DMK-equivalent confirmation flow wiring this workflow's output
  into `BondedVault.confirmStepUp()` — out of scope until deployment access
  and a verified Arc forwarder address both exist.
- `packages/authority/src/chainlink/tee.ts`'s `ChainlinkCREAuthority` class
  (the HTTP-polling `pollForConfirmation` design) hasn't been reconciled
  against this newly-built real workflow yet — worth revisiting whether CRE
  has a more direct primitive once deploy access lands.
- `--listen` mode and `--broadcast` against `stepup-threshold` specifically
  — not yet tried, would strengthen the simulation evidence further.
