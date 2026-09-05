import { Decimal } from 'decimal.js';

Decimal.set({ precision: 78, rounding: Decimal.ROUND_DOWN, toExpPos: 78, toExpNeg: -78 });

export interface GatewayConfig {
  /** Graph Gateway base URL — e.g. https://gateway.thegraph.com/api */
  gatewayBaseUrl: string;
  /** API key from Subgraph Studio — NEVER committed, lives in CRE TEE */
  apiKey: string;
  /** Subgraph deployment ID from Subgraph Studio */
  subgraphId: string;
}

export interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string }>;
}

/**
 * Build the full Gateway URL for a subgraph.
 * Format: https://gateway.thegraph.com/api/{apiKey}/subgraphs/id/{subgraphId}
 *
 * NOTE: Copy this URL verbatim from Subgraph Studio — do not type from memory.
 * The Gateway format is exactly as shown above as of 2024. Confirm on Day 2.
 */
export function buildGatewayUrl(config: GatewayConfig): string {
  return `${config.gatewayBaseUrl}/${config.apiKey}/subgraphs/id/${config.subgraphId}`;
}

/**
 * Execute a GraphQL query against the Graph Gateway.
 *
 * INVARIANTS:
 * - cache: 'no-store' ALWAYS. This is non-configurable.
 *   A cached premise is a correctness bug, not a latency optimisation.
 * - Block pinning: when atBlock is provided, adds `block: { number: N }` to
 *   the query variables. All premises in one proposal must use the same block.
 */
export async function executeQuery<T>(
  config: GatewayConfig,
  query: string,
  variables: Record<string, unknown>,
  atBlock?: bigint,
): Promise<T> {
  const url = buildGatewayUrl(config);

  const vars = atBlock !== undefined
    ? { ...variables, block: { number: Number(atBlock) } }
    : variables;

  // `cache` is a real, supported RequestInit field on Node's undici-based
  // fetch at runtime; asserted here because the ambient RequestInit type
  // resolved in this project's lib configuration doesn't declare it,
  // which would otherwise fail the object-literal excess-property check.
  const requestInit = {
    method:  'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept':       'application/json',
    },
    body:  JSON.stringify({ query, variables: vars }),
    cache: 'no-store', // CRITICAL: never cache enforcement-path queries
  } as RequestInit;

  const response = await fetch(url, requestInit);

  if (!response.ok) {
    throw new Error(
      `Graph Gateway HTTP ${response.status}: ${response.statusText} — URL: ${url}`,
    );
  }

  const json = (await response.json()) as GraphQLResponse<T>;

  if (json.errors?.length) {
    const msgs = json.errors.map((e) => e.message).join('; ');
    throw new Error(`Graph Gateway GraphQL errors: ${msgs}`);
  }

  if (!json.data) {
    throw new Error('Graph Gateway returned no data');
  }

  return json.data;
}

/**
 * Parse a Messari BigDecimal USD string to an 18-decimal integer string.
 * e.g. "412345678.901" → "412345678901000000000000000"
 *
 * Used for totalValueLockedUSD and similar fields.
 * NEVER uses parseFloat.
 */
export function parseUSDToScale18(usdString: string): string {
  const d = new Decimal(usdString);
  return d.mul(new Decimal(10).pow(18)).toFixed(0);
}
