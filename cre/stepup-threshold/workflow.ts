import {
	cre,
	hexToBase64,
	type HTTPPayload,
	type TeeRuntime,
} from '@chainlink/cre-sdk'
import { encodeAbiParameters, parseAbiParameters } from 'viem'
import { z } from 'zod'

// ─── Config Schema ──────────────────────────────────────────
// authorizedKeys stays a plain address list for humans editing config.*.json;
// initWorkflow below maps it into the SDK's AuthorizedKeyJson shape
// ({ type, publicKey }), which is what HTTPCapability.trigger() actually
// requires -- the skill reference's triggers.md shows plain strings, which
// does not match @chainlink/cre-sdk@1.18.0's installed type
// (capabilities/networking/http/v1alpha/trigger_pb.d.ts). Verified against
// the installed package's .d.ts, not assumed from the doc. Empty for
// simulation (see triggers.md); in production it's the enforcer's address.
export const configSchema = z.object({
	authorizedKeys: z.array(z.string()),
	secretId: z.string(),
})
type Config = z.infer<typeof configSchema>

// ─── Request shape ──────────────────────────────────────────
// The proposal's requested USDC amount is NOT confidential -- it arrives in
// the HTTP trigger payload, which per confidential-workflows.md always
// executes on Workflow DON nodes (visible to operators), never inside the
// enclave. That's fine: hiding the proposal amount was never the goal.
//
// What IS confidential is the policy's irreversible_above threshold itself
// (BONDED_IRREVERSIBLE_THRESHOLD_USDC, released into the enclave as a Vault
// DON secret -- see secrets.yaml). Implementation PRD Part D.6's argument:
// a firewall whose threshold is public is a firewall an attacker can
// binary-search. Keeping the threshold in the enclave means an attacker
// probing the enforcer from outside can never determine the exact boundary
// by trial and error -- only the boolean verdict crosses back out, never
// the threshold value it was computed against.
interface StepUpRequest {
	proposalHash: string
	proposalValueUSDC: string // 6-decimal fixed-point string, per seam's money discipline -- never a float
}

// ─── TEE HTTP Callback ──────────────────────────────────────
// Receives a TeeRuntime, not a Runtime. Everything here runs inside the
// enclave until we explicitly cross back with usingTheDons().
export const onStepUpCheck = (
	runtime: TeeRuntime<Config>,
	trigger: HTTPPayload,
): string => {
	const config = runtime.config

	// The trigger payload's `input` is raw JSON bytes (see trigger_pb.d.ts) --
	// there is no built-in JSON-decode helper for trigger payloads (the SDK's
	// json()/text() helpers in http-helpers.d.ts are for outbound HTTPClient
	// *responses*, a different type, not this inbound trigger payload).
	const body = JSON.parse(new TextDecoder().decode(trigger.input)) as StepUpRequest

	if (!body.proposalHash || !body.proposalValueUSDC) {
		throw new Error('stepup-threshold: request body must include proposalHash and proposalValueUSDC')
	}

	// ── Fetch the confidential threshold inside the enclave ──
	// The Vault DON releases this secret only into an attested enclave,
	// decrypted at the moment getSecret() runs -- it never touches Workflow
	// DON node memory, matching the same "encrypted at rest, decrypted only
	// behind a hardware/enclave gate" discipline packages/authority already
	// documents for the ring-custody path.
	const thresholdUSDC = runtime.getSecret({ id: config.secretId }).result().value

	// BigInt comparison, never a float -- same fixed-point discipline as
	// packages/seam/src/types.ts and packages/enforcer/src/withinTolerance.ts.
	// A comparison bug here would be exactly the kind of thing this project's
	// own test suite exists to catch elsewhere; keep this function tiny and
	// obviously correct rather than clever.
	const requiresStepUp = BigInt(body.proposalValueUSDC) > BigInt(thresholdUSDC)

	// Simulation-only logging. MUST be removed before production deployment --
	// per confidential-workflows.md, anything logged leaves the enclave and is
	// no longer confidential. Never log thresholdUSDC itself, even here.
	runtime.log(
		`stepup-threshold: proposal=${body.proposalHash} requiresStepUp=${requiresStepUp}`,
	)

	// ── Cross back to the DON for anything that needs consensus ──
	// Only the boolean verdict and a timestamp cross over -- never
	// thresholdUSDC, which stays inside the enclave for the lifetime of this
	// invocation and is never returned, logged, or reported.
	const donRuntime = runtime.usingTheDons()

	const encodedPayload = encodeAbiParameters(
		parseAbiParameters('bytes32 proposalHash, bool requiresStepUp, uint64 evaluatedAt'),
		[body.proposalHash as `0x${string}`, requiresStepUp, BigInt(Math.floor(Date.now() / 1000))],
	)

	donRuntime
		.report({
			encodedPayload: hexToBase64(encodedPayload),
			encoderName: 'evm',
			signingAlgo: 'ecdsa',
			hashingAlgo: 'keccak256',
		})
		.result()

	// The signed report is a normal CRE report from here -- passing it to
	// BondedVault.confirmStepUp() (or an equivalent forwarder call) is the
	// deploy-time integration, out of scope for simulation.
	return JSON.stringify({ proposalHash: body.proposalHash, requiresStepUp })
}

// ─── Workflow Init ──────────────────────────────────────────
export function initWorkflow(config: Config) {
	const http = new cre.capabilities.HTTPCapability()

	// Map plain addresses (human-friendly in config.*.json) to the SDK's
	// AuthorizedKeyJson shape -- verified against the installed
	// @chainlink/cre-sdk's trigger_pb.d.ts, not assumed. KeyTypeJson is a
	// plain string union ('KEY_TYPE_ECDSA_EVM' | 'KEY_TYPE_UNSPECIFIED'),
	// distinct from the numeric KeyType enum -- do not reverse-index the enum.
	const authorizedKeys = config.authorizedKeys.map((publicKey) => ({
		type: 'KEY_TYPE_ECDSA_EVM' as const,
		publicKey,
	}))

	return [
		// AWS Nitro in us-west-2 is currently the only registered TEE type and
		// region (confidential-workflows.md) -- not invented here.
		cre.handlerInTee(
			http.trigger({ authorizedKeys }),
			onStepUpCheck,
			[{ tee: 'nitro', regions: ['us-west-2'] }],
		),
	]
}
