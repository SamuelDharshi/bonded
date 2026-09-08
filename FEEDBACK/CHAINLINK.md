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

## Not yet exercised

- Deployment (private beta, requires separate enrollment per
  `confidential-workflows.md` — access requested via `cre account access`,
  org `org_lgyLfW5Ebah6miLW`, pending Chainlink's team as of this writing).
- The real DMK-equivalent confirmation flow wiring this workflow's output
  into `BondedVault.confirmStepUp()` — out of scope until deployment access
  and Arc contract addresses both exist.
- `packages/authority/src/chainlink/tee.ts`'s `ChainlinkCREAuthority` class
  (the HTTP-polling `pollForConfirmation` design) hasn't been reconciled
  against this newly-built real workflow yet — worth revisiting whether CRE
  has a more direct primitive once deploy access lands.
