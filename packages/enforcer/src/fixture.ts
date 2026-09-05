/**
 * Hardcoded JSON fixture for the enforcer.
 * Used BEFORE The Graph is wired in to prove logic correctness independently.
 * Replace with real queryStandardizedField() calls once Gateway is live.
 */

export interface FixturePremiseData {
  [premiseId: string]: string;
}

/**
 * DEFAULT_FIXTURE — simulates a healthy pool.
 * tvl: 412M USD at 18-decimal scale (412_000_000 * 1e18)
 * pool_age: unix timestamp old enough to satisfy older_than: 30d
 */
export const DEFAULT_FIXTURE: FixturePremiseData = {
  tvl: '412000000000000000000000000', // 412M USD (18 decimals)
  pool_age: '1609459200',            // 2021-01-01 00:00:00 UTC — a very old pool
};

/**
 * LOW_TVL_FIXTURE — simulates a pool below the $50M TVL threshold.
 * Used in tests to produce PREMISE_MISMATCH on the tvl premise.
 */
export const LOW_TVL_FIXTURE: FixturePremiseData = {
  tvl: '5000000000000000000000000', // 5M USD (18 decimals)
  pool_age: '1609459200',
};

/**
 * NEW_POOL_FIXTURE — simulates a pool created too recently.
 * Used in tests to produce PREMISE_MISMATCH on the pool_age premise.
 */
export const NEW_POOL_FIXTURE: FixturePremiseData = {
  tvl: '412000000000000000000000000',
  pool_age: String(Math.floor(Date.now() / 1000) - 3600), // created 1 hour ago
};

/**
 * Create a QueryFn that returns from a fixture instead of hitting The Graph.
 * Signature matches the real QueryFn interface so the enforcer is oblivious.
 */
export function createFixtureQueryFn(
  fixture: FixturePremiseData,
): (schema: string, field: string, params: Record<string, string>, atBlock: bigint) => Promise<string | null> {
  return async (_schema, _field, params, _atBlock) => {
    const premiseId = params['premiseId'];
    if (premiseId === undefined) return null;
    return fixture[premiseId] ?? null;
  };
}
