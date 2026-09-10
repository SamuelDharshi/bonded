import { Decimal } from 'decimal.js';

Decimal.set({ precision: 78, rounding: Decimal.ROUND_DOWN, toExpPos: 78, toExpNeg: -78 });

export interface GatewayConfig {
  /**
   * Either:
   *  (a) the production Graph Gateway base URL, e.g.
   *      https://gateway.thegraph.com/api — combined with apiKey/subgraphId
   *      below into /{apiKey}/subgraphs/id/{subgraphId}, or
   *  (b) a full Studio dev query endpoint, e.g.
   *      https://api.studio.thegraph.com/query/{id}/{name}/{version} — used
   *      as-is. Studio's dev endpoint is directly queryable before a
   *      subgraph is published to the decentralized network, which is the
   *      path this project's testnet build uses; apiKey/subgraphId are
   *      ignored in this mode. Detected by the presence of '/query/' in the
   *      URL — the production Gateway URL never contains that segment.
   */
  gatewayBaseUrl: string;
  /** API key from Subgraph Studio — NEVER committed, lives in CRE TEE. Unused in Studio dev-endpoint mode. */
  apiKey: string;
  /** Subgraph deployment ID from Subgraph Studio. Unused in Studio dev-endpoint mode. */
  subgraphId: string;
}

export interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string }>;
}

/**
 * A deployment ID is an IPFS CIDv0: 'Qm' followed by 44 base58 characters.
 * A subgraph ID is a different, shorter base58 string with no fixed prefix.
 * The Gateway addresses the two under different paths and rejects each ID
 * under the other's path, so the distinction has to be made before the URL
 * is built rather than discovered from a 404.
 */
const DEPLOYMENT_ID_RE = /^Qm[1-9A-HJ-NP-Za-km-z]{44}$/;

export function isDeploymentId(id: string): boolean {
  return DEPLOYMENT_ID_RE.test(id);
}

/**
 * Build the full Gateway URL for a subgraph.
 *
 * Three shapes, in the order they are tested:
 *   1. Studio dev endpoint  — used verbatim, detected by '/query/'.
 *   2. Deployment ID (Qm…)  — {base}/{apiKey}/deployments/id/{id}
 *   3. Subgraph ID          — {base}/{apiKey}/subgraphs/id/{id}
 *
 * Case 2 is why this function exists in its current form. Graph Explorer
 * shows a deployment ID prominently on a subgraph's page, so that is what
 * gets copied — and sending one to /subgraphs/id/ returns
 * "invalid subgraph ID", which reads exactly like a dead subgraph. Three
 * deployments were written off as stale on that evidence before the paths
 * were told apart. They were in fact dead, but the next ID would not have
 * been, and it would have failed identically.
 *
 * NOTE: Copy the ID verbatim from Studio/Explorer — do not type from memory.
 */
export function buildGatewayUrl(config: GatewayConfig): string {
  if (config.gatewayBaseUrl.includes('/query/')) {
    return config.gatewayBaseUrl;
  }
  const path = isDeploymentId(config.subgraphId) ? 'deployments' : 'subgraphs';
  return `${config.gatewayBaseUrl}/${config.apiKey}/${path}/id/${config.subgraphId}`;
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
