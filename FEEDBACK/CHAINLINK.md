# Feedback — Chainlink CRE

Bonded uses Chainlink CRE's confidential `handlerInTee` as the active
authority layer (see `docs/FUTURE.md` for why this replaces the originally
planned Ledger implementation). Findings land here only after being
independently reproduced against the real CRE CLI/SDK.

No findings recorded yet — `packages/authority/src/chainlink/tee.ts` is
written against the documented `handlerInTee` shape and a local
`CRESimulationAuthority` fallback, but has not been run against a live CRE
simulation or DON deployment in this environment.

## Open questions we expect to generate findings once run

- Exact `@chainlink/cre-sdk` import path and `handlerInTee` signature —
  written from the qualification text, not yet verified against a live
  package.
- `cre simulate` CLI invocation and output shape for a workflow with a
  confidential handler plus a pause/confirm step-up gate.
- Whether the step-up confirmation flow (arm → poll → release signature) is
  the idiomatic CRE pattern for a human-in-the-loop gate, or whether CRE has
  a more direct webhook-driven primitive for this that
  `ChainlinkCREAuthority.pollForConfirmation` should use instead.
