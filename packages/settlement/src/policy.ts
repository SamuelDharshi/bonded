import type { Policy, Proposal } from '@bonded/seam';
import { createStandardizedQueryFn, executeQuery, KNOWN_DEPLOYMENTS, type GatewayConfig } from '@bonded/standardized';
import type { QueryFn } from '@bonded/enforcer';

/**
 * The policy artifact, and the live premise resolution, shared by every script
 * in this package.
 *
 * This POLICY must stay byte-identical to the one in
 * apps/console/app/api/enforce/route.ts. `enforce()` refuses with STALE_POLICY
 * unless hashPolicy(policy) equals the hash committed on-chain, so a stray
 * whitespace difference here does not produce a subtle bug — it produces a
 * refusal, loudly. That is the intended behaviour of a frozen policy, and the
 * reason a shared copy lives here rather than being re-typed per script.
 */
export const POLICY: Policy = {
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

/** Uniswap V3 WETH/USDC 0.3% on Base — see route.ts for why this pool. */
export const LIVE_POOL_ID = '0x6c561b446416e1a00e8e93e221854d6ea4171372';

export type ScenarioId = 'legit' | 'forbidden-action' | 'tvl-lie' | 'irreversible';

/** The lie: 412M USD at 18-decimal scale, against a pool holding ~125M. */
const CLAIMED_TVL_LIE = '412000000000000000000000000';

export interface LiveContext {
  query: QueryFn;
  block: bigint;
}

/**
 * A query function bound to the live Gateway and pinned to the subgraph's own
 * head. Identical in shape to the console route's — the pool id is injected
 * here because the enforcer passes only `{ premiseId }` and packages/seam is
 * frozen.
 */
export async function createLiveContext(apiKey: string): Promise<LiveContext> {
  const config: GatewayConfig = {
    gatewayBaseUrl: process.env.GRAPH_GATEWAY_BASE_URL ?? 'https://gateway.thegraph.com/api',
    apiKey,
    subgraphId: KNOWN_DEPLOYMENTS['uniswap-v3-base'],
  };

  const meta = await executeQuery<{ _meta: { block: { number: number } } }>(
    config,
    'query Head { _meta { block { number } } }',
    {},
  );

  const standardized = createStandardizedQueryFn({ 'messari-dex-amm': config });
  const query: QueryFn = (schema, field, params, atBlock) =>
    standardized(schema, field, { ...params, poolId: LIVE_POOL_ID }, atBlock);

  return { query, block: BigInt(meta._meta.block.number) };
}

export interface Claims {
  tvl: string;
  pool_age: string;
}

export function buildProposal(scenario: ScenarioId, claims: Claims, agent: `0x${string}`): Proposal {
  const now = Math.floor(Date.now() / 1000);

  // Distinct per run: the vault's anti-replay guard rejects a proposalHash it
  // has already settled, so a fixed id would settle once and revert forever
  // after. A real agent's proposals are naturally distinct; this makes the
  // script's proposals distinct for the same reason.
  const nonce = `${scenario}-${now}`;
  const id = `0x${Buffer.from(nonce).toString('hex').padEnd(64, '0').slice(0, 64)}` as `0x${string}`;

  const base = { id, agent, createdAt: now };
  const recipient = '0x000000000000000000000000000000000000dEaD' as `0x${string}`;

  switch (scenario) {
    case 'legit':
      return {
        ...base,
        action: { kind: 'swap', target: recipient, calldata: '0x', valueUSDC: '1000000' }, // 1 USDC
        premises: [
          { premiseId: 'tvl', claimedValue: claims.tvl },
          { premiseId: 'pool_age', claimedValue: claims.pool_age },
        ],
      };

    case 'forbidden-action':
      return {
        ...base,
        action: { kind: 'approve_unlimited', target: recipient, calldata: '0x', valueUSDC: '1000000' },
        premises: [
          { premiseId: 'tvl', claimedValue: claims.tvl },
          { premiseId: 'pool_age', claimedValue: claims.pool_age },
        ],
      };

    case 'tvl-lie':
      return {
        ...base,
        action: { kind: 'swap', target: recipient, calldata: '0x', valueUSDC: '1000000' },
        premises: [
          { premiseId: 'tvl', claimedValue: CLAIMED_TVL_LIE },
          { premiseId: 'pool_age', claimedValue: claims.pool_age },
        ],
      };

    case 'irreversible':
      return {
        ...base,
        action: { kind: 'swap', target: recipient, calldata: '0x', valueUSDC: '150000000' }, // 150 USDC
        premises: [
          { premiseId: 'tvl', claimedValue: claims.tvl },
          { premiseId: 'pool_age', claimedValue: claims.pool_age },
        ],
      };
  }
}
