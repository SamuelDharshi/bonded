import { describe, expect } from 'bun:test'
import type { HTTPPayload, TeeRuntime } from '@chainlink/cre-sdk'
import { test } from '@chainlink/cre-sdk/test'
import { initWorkflow, onStepUpCheck } from './workflow'

const THRESHOLD_USDC = '100000000' // 100 USDC, matches BONDED_PRD.md's example policy

const makeConfig = () => ({
	authorizedKeys: [] as string[],
	secretId: 'IRREVERSIBLE_THRESHOLD_USDC',
})

// The public test surface does not yet ship a TEE runtime factory
// (`newTestRuntime` returns a DON `Runtime`), so we stand up the small slice
// of `TeeRuntime` the handler actually uses: config, getSecret, log, and
// usingTheDons. Same pattern the scaffolded template used for its HTTP-fetch
// handler, adapted to a handler with no outbound capability call.
const makeFakeTeeRuntime = (threshold: string = THRESHOLD_USDC) => {
	const reports: unknown[] = []
	const logs: string[] = []

	const runtime = {
		config: makeConfig(),
		getSecret: (request: { id?: string }) => ({
			result: () => ({ id: request.id, value: threshold }),
		}),
		log: (message: string) => logs.push(message),
		usingTheDons: () => ({
			report: (input: unknown) => {
				reports.push(input)
				return { result: () => ({}) }
			},
		}),
	}

	return { runtime: runtime as unknown as TeeRuntime<ReturnType<typeof makeConfig>>, reports, logs }
}

const makeTrigger = (body: Record<string, unknown>) =>
	({ input: new TextEncoder().encode(JSON.stringify(body)) } as unknown as HTTPPayload)

describe('onStepUpCheck', () => {
	test('requiresStepUp is true when the proposal exceeds the confidential threshold', () => {
		const { runtime } = makeFakeTeeRuntime(THRESHOLD_USDC)
		const trigger = makeTrigger({ proposalHash: '0x' + 'ab'.repeat(32), proposalValueUSDC: '150000000' })

		const result = JSON.parse(onStepUpCheck(runtime, trigger))

		expect(result.requiresStepUp).toBe(true)
	})

	test('requiresStepUp is false when the proposal is under the confidential threshold', () => {
		const { runtime } = makeFakeTeeRuntime(THRESHOLD_USDC)
		const trigger = makeTrigger({ proposalHash: '0x' + 'ab'.repeat(32), proposalValueUSDC: '50000000' })

		const result = JSON.parse(onStepUpCheck(runtime, trigger))

		expect(result.requiresStepUp).toBe(false)
	})

	test('requiresStepUp is false at the exact threshold boundary (strictly greater-than, matching enforce.ts)', () => {
		const { runtime } = makeFakeTeeRuntime(THRESHOLD_USDC)
		const trigger = makeTrigger({ proposalHash: '0x' + 'ab'.repeat(32), proposalValueUSDC: THRESHOLD_USDC })

		const result = JSON.parse(onStepUpCheck(runtime, trigger))

		expect(result.requiresStepUp).toBe(false)
	})

	test('crosses back to the DON to generate a report', () => {
		const { runtime, reports } = makeFakeTeeRuntime()
		const trigger = makeTrigger({ proposalHash: '0x' + 'ab'.repeat(32), proposalValueUSDC: '150000000' })

		onStepUpCheck(runtime, trigger)

		expect(reports).toHaveLength(1)
		expect(reports[0]).toMatchObject({
			encoderName: 'evm',
			signingAlgo: 'ecdsa',
			hashingAlgo: 'keccak256',
		})
	})

	test('never logs the confidential threshold value', () => {
		const { runtime, logs } = makeFakeTeeRuntime('999999999999')
		const trigger = makeTrigger({ proposalHash: '0x' + 'ab'.repeat(32), proposalValueUSDC: '150000000' })

		onStepUpCheck(runtime, trigger)

		for (const line of logs) {
			expect(line).not.toContain('999999999999')
		}
	})

	test('throws when proposalHash is missing -- never silently defaults', () => {
		const { runtime } = makeFakeTeeRuntime()
		const trigger = makeTrigger({ proposalValueUSDC: '150000000' })

		expect(() => onStepUpCheck(runtime, trigger)).toThrow('proposalHash')
	})

	test('throws when proposalValueUSDC is missing -- never silently defaults', () => {
		const { runtime } = makeFakeTeeRuntime()
		const trigger = makeTrigger({ proposalHash: '0x' + 'ab'.repeat(32) })

		expect(() => onStepUpCheck(runtime, trigger)).toThrow('proposalValueUSDC')
	})
})

describe('initWorkflow', () => {
	test('registers the HTTP handler with a Nitro TEE constraint', () => {
		const handlers = initWorkflow(makeConfig())

		expect(handlers).toHaveLength(1)
		expect(handlers[0].fn).toBe(onStepUpCheck)

		// handlerInTee attaches TEE requirements; cre.handler does not.
		expect(handlers[0].requirements).toBeDefined()
	})
})
