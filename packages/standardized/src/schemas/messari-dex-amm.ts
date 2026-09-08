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
 * Known Messari DEX-AMM standardized subgraph deployment IDs.
 *
 * CONFIRMED STALE as of 2026-09-08 — see FEEDBACK/THEGRAPH.md for the
 * exact Gateway queries and error responses. Two of the three IDs below
 * don't resolve at all; the third resolves to a real subgraph that is NOT
 * a Messari DEX-AMM deployment (no `liquidityPools` field). Do not treat
 * these as usable without re-verifying against Subgraph Studio / Graph
 * Explorer first — the query PATTERN in this file is real and tested, but
 * these specific IDs are not currently live.
 *
 * These are the deployments used in the Composable track proof script.
 * The SAME query resolves against all of them — that's the proof, once
 * the IDs are current.
 */
export const KNOWN_DEPLOYMENTS = {
  'uniswap-v3-ethereum': 'ELUcwgpm14LKPLrBRuVvPvNKHQ9HvwmtKgKSH5XNovGR',
  'curve-ethereum':      'OfqMDDMPZjgjMjgCkRMbZfMLxBMDFNfGaYzVqv5Uo7b',
  'balancer-v2-ethereum':'H9oPAbXnobBRq1cB3HDmbZ1E8MWQyJYQjT1QDJMrdbNp',
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
