import {
  createStandardizedQueryFn,
  executeQuery,
  KNOWN_DEPLOYMENTS,
  type GatewayConfig,
} from '@bonded/standardized';
import type { QueryFn } from '@bonded/enforcer';

/**
 * Premise re-derivation against the live Graph Gateway.
 *
 * Extracted so the demo route and the agent API share one definition. They had
 * their own copies, and the copies are how details like block pinning drift
 * apart until two surfaces disagree about what "the same check" means.
 */

/**
 * Uniswap V3 WETH/USDC 0.3% on Base. Verified live 2026-09-11: ~$125M TVL,
 * created 2023-11-18. Chosen over higher-TVL pools on this deployment on
 * purpose — several of those are meme pairs reporting absurd numbers, and a
 * pool a reader cannot recognise is worth less than one they can.
 */
export const LIVE_POOL_ID = '0x6c561b446416e1a00e8e93e221854d6ea4171372';

/** The decentralised Gateway — NOT this project's own subgraph. */
export const GATEWAY_BASE_URL =
  process.env.GRAPH_GATEWAY_BASE_URL ?? 'https://gateway.thegraph.com/api';

export interface LiveContext {
  query: QueryFn;
  /**
   * The subgraph's own head, which is the only block number meaningful to this
   * data source — an Arc block number would be nonsense against a Base
   * subgraph. Every premise in one request resolves at this same block, which
   * is what makes the set internally consistent rather than several reads taken
   * at slightly different times.
   */
  block: bigint;
}

export async function createLiveContext(apiKey: string): Promise<LiveContext> {
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

  const standardized = createStandardizedQueryFn({ 'messari-dex-amm': config });

  const query: QueryFn = (schema, field, params, atBlock) =>
    standardized(schema, field, { ...params, poolId: LIVE_POOL_ID }, atBlock);

  return { query, block: BigInt(meta._meta.block.number) };
}
