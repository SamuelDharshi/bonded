/**
 * Messari DEX-AMM Standardized Schema
 *
 * This is the Composable track proof artifact.
 * ONE query function resolves against ANY protocol implementing the Messari schema.
 * Zero protocol-specific code changes between protocols.
 *
 * Documented leverage: the same premise definition checks TVL across Uniswap v3,
 * Curve, Balancer, and any other Messari DEX-AMM subgraph — with identical code.
 */

export const MESSARI_DEX_AMM_SCHEMA = 'messari-dex-amm' as const;

/**
 * Known Messari DEX-AMM standardized deployment IDs.
 *
 * VERIFIED LIVE 2026-09-11 against the production Gateway: the entry below
 * answers `liquidityPools { totalValueLockedUSD createdTimestamp }` with real
 * data. These are IPFS deployment IDs, so they resolve under the Gateway's
 * /deployments/id/ path — see isDeploymentId() in gateway.ts.
 *
 * There is one entry, and that is an honest reflection of what exists rather
 * than a shortened list. The three that used to sit here (Uniswap v3, Curve
 * and Balancer on Ethereum) are dead: two return "subgraph not found" and the
 * third resolves to a subgraph with no `liquidityPools` field. Messari's
 * hosted-service deployments largely went with the hosted service, and on
 * Base specifically there is no Curve or Balancer DEX-AMM deployment to point
 * at — Curve's is Arbitrum-only.
 *
 * The Composable claim is unchanged in kind but should be stated honestly:
 * the query in this file is written against the Messari schema, not against
 * Uniswap, so any DEX-AMM deployment can be added to this map and resolved by
 * the same code. What cannot be claimed today is that it has been *proven*
 * across three protocols simultaneously — one live deployment is what there
 * is to stand on.
 */
export const KNOWN_DEPLOYMENTS = {
  'uniswap-v3-base': 'QmawEzRNeDyaTgjPKb1eRrbyzxczgSHUYzvTMaMnN8jyuh',
} as const;

export type MessariDexAmmField =
  | 'liquidityPool.totalValueLockedUSD'
  | 'liquidityPool.createdTimestamp'
  | 'liquidityPool.totalLiquidity';

/**
 * Build the GraphQL query for a given Messari DEX-AMM field.
 *
 * NOTE: The `$block` variable is injected by executeQuery() when atBlock is set.
 * Do not add block: { number: N } here — it's handled centrally in gateway.ts.
 */
export function buildQuery(field: MessariDexAmmField): string {
  switch (field) {
    case 'liquidityPool.totalValueLockedUSD':
      return `
        query TVL($id: ID!, $block: Block_height) {
          liquidityPool(id: $id, block: $block) {
            totalValueLockedUSD
          }
        }
      `;

    case 'liquidityPool.createdTimestamp':
      return `
        query Age($id: ID!, $block: Block_height) {
          liquidityPool(id: $id, block: $block) {
            createdTimestamp
          }
        }
      `;

    case 'liquidityPool.totalLiquidity':
      return `
        query Liquidity($id: ID!, $block: Block_height) {
          liquidityPool(id: $id, block: $block) {
            totalLiquidity
          }
        }
      `;

    default: {
      const exhaustive: never = field;
      throw new Error(`Unknown Messari DEX-AMM field: ${String(exhaustive)}`);
    }
  }
}

interface TVLResponse {
  liquidityPool: { totalValueLockedUSD: string } | null;
}

interface AgeResponse {
  liquidityPool: { createdTimestamp: string } | null;
}

interface LiquidityResponse {
  liquidityPool: { totalLiquidity: string } | null;
}

/**
 * Parse the raw GraphQL response for a field into a canonical string value.
 *
 * For USD fields: returns as-is (the BigDecimal string from the subgraph).
 *   gateway.ts callers use parseUSDToScale18() to convert for comparison.
 * For timestamp fields: returns unix seconds as string.
 */
export function parseResponse(field: MessariDexAmmField, data: unknown): string | null {
  switch (field) {
    case 'liquidityPool.totalValueLockedUSD': {
      const d = data as TVLResponse;
      return d.liquidityPool?.totalValueLockedUSD ?? null;
    }
    case 'liquidityPool.createdTimestamp': {
      const d = data as AgeResponse;
      return d.liquidityPool?.createdTimestamp ?? null;
    }
    case 'liquidityPool.totalLiquidity': {
      const d = data as LiquidityResponse;
      return d.liquidityPool?.totalLiquidity ?? null;
    }
    default: {
      const exhaustive: never = field;
      throw new Error(`Unknown field: ${String(exhaustive)}`);
    }
  }
}
