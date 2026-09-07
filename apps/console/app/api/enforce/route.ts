import { NextResponse } from 'next/server';
import {
  enforce,
  createFixtureQueryFn,
  hashPolicy,
  DEFAULT_FIXTURE,
  LOW_TVL_FIXTURE,
} from '@bonded/enforcer';
import type { Policy, Proposal } from '@bonded/seam';

/**
 * Runs the REAL enforce() from @bonded/enforcer. No heuristic, no canned
 * verdict string — this route calls the same function packages/enforcer's
 * own unit tests call. Premise re-derivation runs against the documented
 * fixture query path (packages/enforcer/src/fixture.ts), the same
 * pre-Graph-Gateway path used across this repo until a live Subgraph
 * Studio API key is provisioned — see .env.example and README.md.
 */

const POLICY: Policy = {
  version: 1,
  budget: { asset: 'USDC', period: '7d', max: '500000000' },
  premises: [
    {
      id: 'tvl',
      schema: 'messari-dex-amm',
      field: 'liquidityPool.totalValueLockedUSD',
      op: 'gte',
      value: '50000000000000000000000000',
      tolerance_bps: 200,
    },
    {
      id: 'pool_age',
      schema: 'messari-dex-amm',
      field: 'liquidityPool.createdTimestamp',
      op: 'older_than',
      value: '2592000',
    },
  ],
  forbid: ['approve_unlimited', 'delegatecall', 'selfdestruct'],
  irreversible_above: '100000000',
};

const POLICY_HASH = hashPolicy(POLICY);

type ScenarioId = 'legit' | 'forbidden-action' | 'tvl-lie' | 'irreversible';

function buildProposal(scenario: ScenarioId): Proposal {
  const now = Math.floor(Date.now() / 1000);
  const base = {
    id: `0x${scenario.padEnd(64, '0')}` as `0x${string}`,
    agent: '0x000000000000000000000000000000000000a9' as `0x${string}`,
    createdAt: now,
  };

  switch (scenario) {
    case 'legit':
      return {
        ...base,
        action: {
          kind: 'swap',
          target: '0x0000000000000000000000000000000000dead' as `0x${string}`,
          calldata: '0x',
          valueUSDC: '50000000', // 50 USDC
        },
        premises: [
          { premiseId: 'tvl', claimedValue: DEFAULT_FIXTURE['tvl'] ?? '0' },
          { premiseId: 'pool_age', claimedValue: DEFAULT_FIXTURE['pool_age'] ?? '0' },
        ],
      };

    case 'forbidden-action':
      // The injected-token scenario: the agent was talked into attempting
      // approve_unlimited. Refused at the cheapest check, before any Graph
      // query even runs.
      return {
        ...base,
        action: {
          kind: 'approve_unlimited',
          target: '0x000000000000000000000000000000000badbad' as `0x${string}`,
          calldata: '0x',
          valueUSDC: '10000000',
        },
        premises: [
          { premiseId: 'tvl', claimedValue: DEFAULT_FIXTURE['tvl'] ?? '0' },
          { premiseId: 'pool_age', claimedValue: DEFAULT_FIXTURE['pool_age'] ?? '0' },
        ],
      };

    case 'tvl-lie':
      // The agent claims a healthy 412M TVL pool, but re-derivation shows
      // the real pool has 5M — either a lie, or the agent was fed a fake
      // pool ID. Either way, claim and reality disagree.
      return {
        ...base,
        action: {
          kind: 'swap',
          target: '0x0000000000000000000000000000000000dead' as `0x${string}`,
          calldata: '0x',
          valueUSDC: '50000000',
        },
        premises: [
          { premiseId: 'tvl', claimedValue: DEFAULT_FIXTURE['tvl'] ?? '0' }, // claims 412M
          { premiseId: 'pool_age', claimedValue: LOW_TVL_FIXTURE['pool_age'] ?? '0' },
        ],
      };

    case 'irreversible':
      return {
        ...base,
        action: {
          kind: 'swap',
          target: '0x0000000000000000000000000000000000dead' as `0x${string}`,
          calldata: '0x',
          valueUSDC: '150000000', // 150 USDC > 100 USDC irreversible_above
        },
        premises: [
          { premiseId: 'tvl', claimedValue: DEFAULT_FIXTURE['tvl'] ?? '0' },
          { premiseId: 'pool_age', claimedValue: DEFAULT_FIXTURE['pool_age'] ?? '0' },
        ],
      };
  }
}

// The fixture each scenario's re-derivation should resolve against — the
// "tvl-lie" scenario intentionally resolves against LOW_TVL_FIXTURE so the
// claimed value (412M) disagrees with what re-derivation actually finds (5M).
const SCENARIO_FIXTURE: Record<ScenarioId, typeof DEFAULT_FIXTURE> = {
  legit: DEFAULT_FIXTURE,
  'forbidden-action': DEFAULT_FIXTURE,
  'tvl-lie': LOW_TVL_FIXTURE,
  irreversible: DEFAULT_FIXTURE,
};

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { scenario?: string };
  const scenario = body.scenario as ScenarioId | undefined;

  if (!scenario || !(scenario in SCENARIO_FIXTURE)) {
    return NextResponse.json(
      { error: 'scenario must be one of: legit, forbidden-action, tvl-lie, irreversible' },
      { status: 400 },
    );
  }

  const proposal = buildProposal(scenario);
  const query = createFixtureQueryFn(SCENARIO_FIXTURE[scenario]);

  const { verdict, record } = await enforce(
    proposal,
    POLICY,
    {
      onchainPolicyHash: POLICY_HASH,
      currentBlock: 0n,
      currentTimestamp: Math.floor(Date.now() / 1000),
      spentThisPeriod: 0n,
    },
    query,
  );

  const OUTCOME_NAME = ['CLEARED', 'REFUSED', 'HELD_FOR_STEPUP'] as const;

  return NextResponse.json({
    scenario,
    proposal,
    verdict: {
      ...verdict,
      blockChecked: verdict.blockChecked.toString(),
      outcomeName: OUTCOME_NAME[verdict.outcome],
    },
    // PremiseRecord.blockChecked is a bigint (seam's fixed-point discipline —
    // see packages/seam/src/types.ts) and JSON.stringify can't serialize
    // those; convert at the API boundary, same pattern as enforcer's own
    // buildLogRef.
    premises: record.premises.map((p) => ({ ...p, blockChecked: p.blockChecked.toString() })),
    queryPath: 'fixture' as const,
  });
}
