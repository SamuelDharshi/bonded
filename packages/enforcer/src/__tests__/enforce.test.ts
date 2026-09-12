import { enforce } from '../enforce.js';
import {
  createFixtureQueryFn,
  DEFAULT_FIXTURE,
  LOW_TVL_FIXTURE,
  NEW_POOL_FIXTURE,
} from '../fixture.js';
import { hashPolicy } from '../policyHash.js';
import { ReasonCode, OUTCOME } from '@bonded/seam';
import type { Proposal, Policy } from '@bonded/seam';
import type { EnforceContext } from '../enforce.js';

// ─── Canonical test policy ────────────────────────────────────────────────────

const TEST_POLICY: Policy = {
  version: 1,
  budget: { asset: 'USDC', period: '7d', max: '500000000' }, // 500 USDC
  premises: [
    {
      id: 'tvl',
      schema: 'messari-dex-amm',
      field: 'liquidityPool.totalValueLockedUSD',
      op: 'gte',
      value: '50000000000000000000000000', // 50M USD at 18 decimals
      tolerance_bps: 200,
    },
    {
      id: 'pool_age',
      schema: 'messari-dex-amm',
      field: 'liquidityPool.createdTimestamp',
      op: 'older_than',
      value: '2592000', // 30 days in seconds
    },
  ],
  forbid: ['approve_unlimited', 'delegatecall', 'selfdestruct'],
  irreversible_above: '100000000', // 100 USDC
};

const POLICY_HASH = hashPolicy(TEST_POLICY);
const NOW         = Math.floor(Date.now() / 1000);

function makeCtx(overrides?: Partial<EnforceContext>): EnforceContext {
  return {
    onchainPolicyHash: POLICY_HASH,
    currentBlock:      BigInt(20_000_000),
    currentTimestamp:  NOW,
    spentThisPeriod:   0n,
    ...overrides,
  };
}

function makeProposal(overrides?: Partial<Proposal>): Proposal {
  return {
    id: '0xdeadbeef00000000000000000000000000000000000000000000000000000000',
    agent: '0xagent000000000000000000000000000000000000',
    action: {
      kind:      'swap',
      target:    '0xtarget00000000000000000000000000000000',
      calldata:  '0x',
      valueUSDC: '50000000', // 50 USDC
    },
    premises: [
      { premiseId: 'tvl',      claimedValue: DEFAULT_FIXTURE['tvl'] ?? '0' },
      { premiseId: 'pool_age', claimedValue: DEFAULT_FIXTURE['pool_age'] ?? '0' },
    ],
    createdAt: NOW,
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('enforce()', () => {
  it('CLEARED when all premises pass', async () => {
    const query   = createFixtureQueryFn(DEFAULT_FIXTURE);
    const { verdict } = await enforce(makeProposal(), TEST_POLICY, makeCtx(), query);

    expect(verdict.outcome).toBe(OUTCOME.CLEARED);
    expect(verdict.reasonCode).toBe(ReasonCode.OK);
  });

  it('REFUSED / STALE_POLICY when policy hash mismatches', async () => {
    const query = createFixtureQueryFn(DEFAULT_FIXTURE);
    const ctx   = makeCtx({ onchainPolicyHash: '0xdeadbeef' as `0x${string}` });
    const { verdict } = await enforce(makeProposal(), TEST_POLICY, ctx, query);

    expect(verdict.outcome).toBe(OUTCOME.REFUSED);
    expect(verdict.reasonCode).toBe(ReasonCode.STALE_POLICY);
  });

  it('REFUSED / POLICY_FORBIDDEN_ACTION when action is in forbid list', async () => {
    const query    = createFixtureQueryFn(DEFAULT_FIXTURE);
    const proposal = makeProposal({ action: { ...makeProposal().action, kind: 'approve_unlimited' } });
    const { verdict } = await enforce(proposal, TEST_POLICY, makeCtx(), query);

    expect(verdict.outcome).toBe(OUTCOME.REFUSED);
    expect(verdict.reasonCode).toBe(ReasonCode.POLICY_FORBIDDEN_ACTION);
  });

  it('REFUSED / PREMISE_MISMATCH when TVL is below threshold', async () => {
    const query    = createFixtureQueryFn(LOW_TVL_FIXTURE);
    const proposal = makeProposal({
      premises: [
        { premiseId: 'tvl',      claimedValue: LOW_TVL_FIXTURE['tvl'] ?? '0' },
        { premiseId: 'pool_age', claimedValue: LOW_TVL_FIXTURE['pool_age'] ?? '0' },
      ],
    });
    const { verdict, record } = await enforce(proposal, TEST_POLICY, makeCtx(), query);

    expect(verdict.outcome).toBe(OUTCOME.REFUSED);
    expect(verdict.reasonCode).toBe(ReasonCode.PREMISE_MISMATCH);
    // Both claimed and derived values must be recorded in the premise record
    const tvlRecord = record.premises.find((p) => p.premiseId === 'tvl');
    expect(tvlRecord?.claimedValue).toBeDefined();
    expect(tvlRecord?.derivedValue).toBeDefined();
    expect(tvlRecord?.passed).toBe(false);
  });

  it('REFUSED / PREMISE_MISMATCH when pool is too new', async () => {
    const query    = createFixtureQueryFn(NEW_POOL_FIXTURE);
    const proposal = makeProposal({
      premises: [
        { premiseId: 'tvl',      claimedValue: NEW_POOL_FIXTURE['tvl'] ?? '0' },
        { premiseId: 'pool_age', claimedValue: NEW_POOL_FIXTURE['pool_age'] ?? '0' },
      ],
    });
    const { verdict } = await enforce(proposal, TEST_POLICY, makeCtx(), query);

    expect(verdict.outcome).toBe(OUTCOME.REFUSED);
    expect(verdict.reasonCode).toBe(ReasonCode.PREMISE_MISMATCH);
  });

  it('REFUSED / PREMISE_UNRESOLVABLE when query returns null', async () => {
    const query = createFixtureQueryFn({}); // empty fixture — all queries return null
    const { verdict } = await enforce(makeProposal(), TEST_POLICY, makeCtx(), query);

    expect(verdict.outcome).toBe(OUTCOME.REFUSED);
    expect(verdict.reasonCode).toBe(ReasonCode.PREMISE_UNRESOLVABLE);
  });

  it('REFUSED / PREMISE_UNRESOLVABLE when premiseId not in policy', async () => {
    const query    = createFixtureQueryFn(DEFAULT_FIXTURE);
    const proposal = makeProposal({
      premises: [{ premiseId: 'nonexistent', claimedValue: '0' }],
    });
    const { verdict } = await enforce(proposal, TEST_POLICY, makeCtx(), query);

    expect(verdict.outcome).toBe(OUTCOME.REFUSED);
    expect(verdict.reasonCode).toBe(ReasonCode.PREMISE_UNRESOLVABLE);
  });

  it('REFUSED / BUDGET_EXCEEDED when over spending limit', async () => {
    const query = createFixtureQueryFn(DEFAULT_FIXTURE);
    const ctx   = makeCtx({ spentThisPeriod: 480_000_000n }); // 480 USDC already spent
    const proposal = makeProposal({
      action: { ...makeProposal().action, valueUSDC: '50000000' }, // +50 USDC = 530 > 500 max
    });
    const { verdict } = await enforce(proposal, TEST_POLICY, ctx, query);

    expect(verdict.outcome).toBe(OUTCOME.REFUSED);
    expect(verdict.reasonCode).toBe(ReasonCode.BUDGET_EXCEEDED);
  });

  it('HELD_FOR_STEPUP when valueUSDC exceeds irreversible_above', async () => {
    const query    = createFixtureQueryFn(DEFAULT_FIXTURE);
    const proposal = makeProposal({
      action: { ...makeProposal().action, valueUSDC: '150000000' }, // 150 USDC > 100 threshold
      premises: [
        { premiseId: 'tvl',      claimedValue: DEFAULT_FIXTURE['tvl'] ?? '0' },
        { premiseId: 'pool_age', claimedValue: DEFAULT_FIXTURE['pool_age'] ?? '0' },
      ],
    });
    const { verdict } = await enforce(proposal, TEST_POLICY, makeCtx(), query);

    expect(verdict.outcome).toBe(OUTCOME.HELD_FOR_STEPUP);
    expect(verdict.reasonCode).toBe(ReasonCode.IRREVERSIBLE_UNCONFIRMED);
  });

  it('verdict includes blockChecked matching ctx.currentBlock', async () => {
    const query = createFixtureQueryFn(DEFAULT_FIXTURE);
    const ctx   = makeCtx({ currentBlock: 99_999_999n });
    const { verdict } = await enforce(makeProposal(), TEST_POLICY, ctx, query);

    expect(verdict.blockChecked).toBe(99_999_999n);
  });

  it('record includes both claimed and derived premise values on mismatch', async () => {
    const query    = createFixtureQueryFn(LOW_TVL_FIXTURE);
    const claimed  = '412000000000000000000000000'; // agent claims 412M
    const proposal = makeProposal({
      premises: [
        { premiseId: 'tvl', claimedValue: claimed },
        { premiseId: 'pool_age', claimedValue: DEFAULT_FIXTURE['pool_age'] ?? '0' },
      ],
    });
    const { record } = await enforce(proposal, TEST_POLICY, makeCtx(), query);

    const tvl = record.premises.find((p) => p.premiseId === 'tvl');
    expect(tvl?.claimedValue).toBe(claimed);
    expect(tvl?.derivedValue).toBe(LOW_TVL_FIXTURE['tvl']);
    expect(tvl?.passed).toBe(false);
  });
});

// ─── Step 5 delegation seam (confidential threshold oracle) ───────────────────
//
// These cover ctx.requiresStepUp, the port that lets the irreversible
// threshold live inside a TEE instead of in the policy artifact. The risk
// being tested is fail-OPEN: a threshold oracle that errors, or that the
// enforcer forgets to consult, silently clears money it should have held.

describe('enforce() — step 5 threshold delegation', () => {
  it('uses the oracle instead of policy.irreversible_above when supplied', async () => {
    const query = createFixtureQueryFn(DEFAULT_FIXTURE);
    // 50 USDC is BELOW the policy's 100 USDC threshold, so the local path
    // would clear. The oracle says hold — the oracle must win.
    const { verdict } = await enforce(
      makeProposal(),
      TEST_POLICY,
      makeCtx({ requiresStepUp: async () => true }),
      query,
    );

    expect(verdict.outcome).toBe(OUTCOME.HELD_FOR_STEPUP);
    expect(verdict.reasonCode).toBe(ReasonCode.IRREVERSIBLE_UNCONFIRMED);
  });

  it('clears when the oracle says no step-up is needed, even above the local threshold', async () => {
    const query = createFixtureQueryFn(DEFAULT_FIXTURE);
    // 150 USDC is ABOVE the policy's 100 USDC threshold. With the oracle
    // present, policy.irreversible_above must not be consulted at all.
    const { verdict } = await enforce(
      makeProposal({
        action: {
          kind: 'swap',
          target: '0xtarget00000000000000000000000000000000',
          calldata: '0x',
          valueUSDC: '150000000',
        },
      }),
      TEST_POLICY,
      makeCtx({ requiresStepUp: async () => false }),
      query,
    );

    expect(verdict.outcome).toBe(OUTCOME.CLEARED);
    expect(verdict.reasonCode).toBe(ReasonCode.OK);
  });

  it('receives the proposal hash and value the enforcer actually evaluated', async () => {
    const query = createFixtureQueryFn(DEFAULT_FIXTURE);
    const seen: { proposalHash: string; valueUSDC: bigint }[] = [];

    await enforce(
      makeProposal(),
      TEST_POLICY,
      makeCtx({
        requiresStepUp: async (input) => {
          seen.push(input);
          return false;
        },
      }),
      query,
    );

    expect(seen).toHaveLength(1);
    expect(seen[0]?.valueUSDC).toBe(50_000_000n);
    expect(seen[0]?.proposalHash).toBe(
      '0xdeadbeef00000000000000000000000000000000000000000000000000000000',
    );
  });

  it('HOLDS, never clears, when the oracle is unreachable', async () => {
    const query = createFixtureQueryFn(DEFAULT_FIXTURE);
    // An enclave we cannot reach has not said yes. Fail-closed: this is the
    // whole thesis, and it is the one branch where a thrown error could
    // plausibly have been swallowed into a CLEARED.
    const { verdict } = await enforce(
      makeProposal(),
      TEST_POLICY,
      makeCtx({
        requiresStepUp: async () => {
          throw new Error('enclave unreachable');
        },
      }),
      query,
    );

    expect(verdict.outcome).toBe(OUTCOME.HELD_FOR_STEPUP);
    expect(verdict.reasonCode).toBe(ReasonCode.ATTESTATION_MISSING);
  });

  it('still refuses forbidden actions before ever consulting the oracle', async () => {
    const query = createFixtureQueryFn(DEFAULT_FIXTURE);
    let consulted = false;

    const { verdict } = await enforce(
      makeProposal({
        action: {
          kind: 'approve_unlimited',
          target: '0xtarget00000000000000000000000000000000',
          calldata: '0x',
          valueUSDC: '50000000',
        },
      }),
      TEST_POLICY,
      makeCtx({
        requiresStepUp: async () => {
          consulted = true;
          return false;
        },
      }),
      query,
    );

    expect(verdict.reasonCode).toBe(ReasonCode.POLICY_FORBIDDEN_ACTION);
    expect(consulted).toBe(false);
  });
});
