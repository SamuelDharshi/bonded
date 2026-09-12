import { NextResponse } from 'next/server';
import {
  enforce,
  createFixtureQueryFn,
  hashPolicy,
  DEFAULT_FIXTURE,
  LOW_TVL_FIXTURE,
  type QueryFn,
} from '@bonded/enforcer';
import {
  createStandardizedQueryFn,
  executeQuery,
  KNOWN_DEPLOYMENTS,
  type GatewayConfig,
} from '@bonded/standardized';
import type { Policy, Proposal } from '@bonded/seam';

/**
 * Runs the REAL enforce() from @bonded/enforcer. No heuristic, no canned
 * verdict string — this route calls the same function packages/enforcer's
 * own unit tests call.
 *
 * Premise re-derivation runs against the LIVE Graph Gateway when GRAPH_API_KEY
 * is set: a real Messari DEX-AMM subgraph, a real Uniswap V3 pool on Base, at
 * a real pinned block. Without a key it falls back to the fixture path
 * (packages/enforcer/src/fixture.ts) and says so in the response, because a
 * demo that silently substitutes canned data for the thing it claims to prove
 * would be worse than one that admits which path it took.
 *
 * If the key IS set and the Gateway then fails, there is deliberately no
 * fallback: the query returns null, the enforcer records PREMISE_UNRESOLVABLE
 * and refuses. Fail-closed is the whole thesis — an unreachable premise is
 * not an approval.
 */

/**
 * Uniswap V3 WETH/USDC 0.3% on Base. Verified live 2026-09-11: ~$125M TVL,
 * created 2023-11-18, which clears both premises in POLICY below with room to
 * spare. Chosen over the higher-TVL pools on this deployment deliberately —
 * several of those are meme pairs reporting absurd numbers, and a demo pool a
 * judge cannot recognise is worth less than one they can.
 */
const LIVE_POOL_ID = '0x6c561b446416e1a00e8e93e221854d6ea4171372';

/** Base URL for the decentralised Gateway — NOT this project's own subgraph. */
const GATEWAY_BASE_URL =
  process.env.GRAPH_GATEWAY_BASE_URL ?? 'https://gateway.thegraph.com/api';

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
  irreversible_above: '1000000',
};

const POLICY_HASH = hashPolicy(POLICY);

type ScenarioId = 'legit' | 'forbidden-action' | 'tvl-lie' | 'irreversible';

interface LiveContext {
  query: QueryFn;
  /** Subgraph head at the moment this request started. */
  block: bigint;
}

/**
 * Build a query function bound to the live Gateway, pinned to one block.
 *
 * Two things this has to do that the fixture path does not:
 *
 *  - Supply the pool id. The enforcer passes only `{ premiseId }` to the
 *    query function, because packages/seam is frozen and Premise has nowhere
 *    to carry a pool. So the pool is injected here, by the caller that knows
 *    which pool the scenario is about, rather than by widening the seam.
 *
 *  - Pin the block. `_meta { block { number } }` is the subgraph's own head,
 *    which is the only block number that is meaningful to this data source —
 *    an Arc block number would be nonsense against a Base subgraph. Every
 *    premise in the request then resolves at that same block, which is what
 *    makes the set internally consistent rather than a handful of reads
 *    taken at slightly different times.
 */
async function createLiveContext(apiKey: string): Promise<LiveContext> {
  const config: GatewayConfig = {
    gatewayBaseUrl: GATEWAY_BASE_URL,
    apiKey,
    subgraphId: KNOWN_DEPLOYMENTS['uniswap-v3-base'],
  };

  const meta = await executeQuery<{ _meta: { block: { number: number } } }>(
    config,
    'query Head { _meta { block { number } } }',
    {},
  );
  const block = BigInt(meta._meta.block.number);

  const standardized = createStandardizedQueryFn({ 'messari-dex-amm': config });

  const query: QueryFn = (schema, field, params, atBlock) =>
    standardized(schema, field, { ...params, poolId: LIVE_POOL_ID }, atBlock);

  return { query, block };
}

/**
 * What the agent SAYS it saw. On the live path these are the values just read
 * from the subgraph, which is what an honest agent would report; the enforcer
 * then re-derives them independently and compares. `tvl-lie` overrides the TVL
 * with a figure the agent did not read anywhere.
 */
interface Claims {
  tvl: string;
  pool_age: string;
}

/** The lie: 412M USD at 18-decimal scale, against a pool holding ~125M. */
const CLAIMED_TVL_LIE = '412000000000000000000000000';

function buildProposal(scenario: ScenarioId, claims: Claims): Proposal {
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
          valueUSDC: '500000', // 0.5 USDC — under irreversible_above
        },
        premises: [
          { premiseId: 'tvl', claimedValue: claims.tvl },
          { premiseId: 'pool_age', claimedValue: claims.pool_age },
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
          valueUSDC: '500000',
        },
        premises: [
          { premiseId: 'tvl', claimedValue: claims.tvl },
          { premiseId: 'pool_age', claimedValue: claims.pool_age },
        ],
      };

    case 'tvl-lie':
      // The agent claims a 412M TVL pool. On the live path re-derivation
      // reads ~125M from the real Base pool; on the fixture path it reads 5M.
      // Either a lie or a fake pool id was fed in — either way, claim and
      // reality disagree and the premise fails.
      return {
        ...base,
        action: {
          kind: 'swap',
          target: '0x0000000000000000000000000000000000dead' as `0x${string}`,
          calldata: '0x',
          valueUSDC: '500000',
        },
        premises: [
          { premiseId: 'tvl', claimedValue: CLAIMED_TVL_LIE },
          { premiseId: 'pool_age', claimedValue: claims.pool_age },
        ],
      };

    case 'irreversible':
      return {
        ...base,
        action: {
          kind: 'swap',
          target: '0x0000000000000000000000000000000000dead' as `0x${string}`,
          calldata: '0x',
          valueUSDC: '2000000', // 2 USDC > 1 USDC irreversible_above
        },
        premises: [
          { premiseId: 'tvl', claimedValue: claims.tvl },
          { premiseId: 'pool_age', claimedValue: claims.pool_age },
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

  const apiKey = process.env.GRAPH_API_KEY;

  let query: QueryFn;
  let block = 0n;
  let queryPath: 'live-gateway' | 'fixture';
  let claims: Claims;

  if (apiKey) {
    const live = await createLiveContext(apiKey);
    query = live.query;
    block = live.block;
    queryPath = 'live-gateway';

    // Read what an honest agent would have read, at the pinned block, and let
    // it claim exactly that. The enforcer re-derives independently a moment
    // later; the policy's 200bps tolerance absorbs any drift between the two
    // reads. Nothing here is fed to the enforcer — it queries for itself.
    const [tvl, poolAge] = await Promise.all([
      query('messari-dex-amm', 'liquidityPool.totalValueLockedUSD', { premiseId: 'tvl' }, block),
      query('messari-dex-amm', 'liquidityPool.createdTimestamp', { premiseId: 'pool_age' }, block),
    ]);

    // A null here means the Gateway is unreachable or the pool is gone. Claim
    // '0' rather than substituting a fixture: the enforcer will fail to
    // re-derive it too and refuse with PREMISE_UNRESOLVABLE, which is the
    // correct outcome and an honest one.
    claims = { tvl: tvl ?? '0', pool_age: poolAge ?? '0' };
  } else {
    const fixture = SCENARIO_FIXTURE[scenario];
    query = createFixtureQueryFn(fixture);
    queryPath = 'fixture';
    claims = { tvl: fixture['tvl'] ?? '0', pool_age: fixture['pool_age'] ?? '0' };
  }

  const proposal = buildProposal(scenario, claims);

  const { verdict, record } = await enforce(
    proposal,
    POLICY,
    {
      onchainPolicyHash: POLICY_HASH,
      currentBlock: block,
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
    queryPath,
    // Surfaced so the UI can state which path produced this verdict rather
    // than asserting one.
    pinnedBlock: block.toString(),
    poolId: queryPath === 'live-gateway' ? LIVE_POOL_ID : null,
  });
}
