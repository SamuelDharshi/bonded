import type { QueryFn } from '@bonded/enforcer';
import type { GatewayConfig } from './gateway.js';
import { executeQuery, parseUSDToScale18 } from './gateway.js';
import {
  MESSARI_DEX_AMM_SCHEMA,
  buildQuery,
  parseResponse,
  type MessariDexAmmField,
} from './schemas/messari-dex-amm.js';

/**
 * Create a QueryFn that resolves standardized schema fields from The Graph.
 *
 * This is the LIVE implementation wired into the enforcer on the real path.
 * The enforcer fixture.ts handles the hardcoded test path.
 *
 * @param subgraphConfigs  Map from schema name to GatewayConfig.
 *                         e.g. { 'messari-dex-amm': { gatewayBaseUrl, apiKey, subgraphId } }
 * @param poolId           The liquidity pool ID to query (passed via params.poolId)
 */
export function createStandardizedQueryFn(
  subgraphConfigs: Record<string, GatewayConfig>,
): QueryFn {
  return async (schema, field, params, atBlock) => {
    const config = subgraphConfigs[schema];
    if (!config) {
      throw new Error(`No subgraph config for schema: ${schema}`);
    }

    if (schema === MESSARI_DEX_AMM_SCHEMA) {
      const poolId    = params['poolId'] ?? params['id'];
      const gqlField  = field as MessariDexAmmField;
      const query     = buildQuery(gqlField);
      const variables = { id: poolId };

      try {
        const data   = await executeQuery<unknown>(config, query, variables, atBlock);
        const rawVal = parseResponse(gqlField, data);

        if (rawVal === null) return null;

        // USD fields: convert Messari BigDecimal to 18-decimal integer string
        if (field.toLowerCase().includes('usd')) {
          return parseUSDToScale18(rawVal);
        }

        // Timestamp / count fields: return as string directly
        return rawVal;
      } catch (err) {
        // Log for debugging but return null to trigger PREMISE_UNRESOLVABLE
        console.error(`[standardized] Query failed for ${schema}.${field}:`, err);
        return null;
      }
    }

    throw new Error(`Unknown schema: ${schema}`);
  };
}
