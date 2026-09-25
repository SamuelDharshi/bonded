import { Decimal } from 'decimal.js';
import type { PremiseOp } from '@bonded/seam';

// Configure Decimal for maximum precision — we never round financial comparisons.
Decimal.set({ precision: 78, rounding: Decimal.ROUND_DOWN, toExpPos: 78, toExpNeg: -78 });

/**
 * Internal scale used for USD-denominated fields.
 * Subgraph BigDecimal strings are parsed and scaled to this many decimal places
 * before comparison as BigInt. Matches the fixture and policy value encoding.
 */
export const USD_SCALE = 18;
export const USD_MULTIPLIER = 10n ** BigInt(USD_SCALE);
export const BPS_DENOMINATOR = 10_000n;

/**
 * Parse a USD-denominated string (e.g. "412345678.901") into a BigInt
 * at USD_SCALE (18) decimal places.
 * e.g. "412.5" → 412_500_000_000_000_000_000n
 *
 * NEVER uses parseFloat. Uses decimal.js for precision.
 */
export function parseUSD(value: string): bigint {
  const d = new Decimal(value);
  const scaled = d.mul(new Decimal(10).pow(USD_SCALE)).toFixed(0);
  return BigInt(scaled);
}

/**
 * Parse a value string as a plain BigInt (for unix timestamps, durations, etc.)
 */
export function parseBigInt(value: string): bigint {
  // Trim decimals if accidentally present (e.g. "1680000000.0")
  const trimmed = value.split('.')[0];
  if (trimmed === undefined) throw new Error(`Cannot parse BigInt from: ${value}`);
  return BigInt(trimmed);
}

/**
 * Is this string a plain integer this module can compare numerically?
 *
 * Deliberately strict: anything that is not digits (with an optional single
 * decimal point, which parseBigInt truncates) is treated as non-numeric and
 * routed to string equality rather than coerced. Guessing here is how 'true'
 * became a BigInt conversion error.
 */
export function isNumericString(value: string): boolean {
  return /^\d+(\.\d+)?$/.test(value.trim());
}

/**
 * Apply tolerance to a derived value, returning the [lower, upper] window.
 * Integer basis-point arithmetic only. No floats.
 *
 * toleranceBps = 200 means ±2% window.
 * lower = derived * (10000 - bps) / 10000
 * upper = derived * (10000 + bps) / 10000
 */
export function toleranceWindow(
  derived: bigint,
  toleranceBps: number,
): { lower: bigint; upper: bigint } {
  const bps = BigInt(toleranceBps);
  const lower = (derived * (BPS_DENOMINATOR - bps)) / BPS_DENOMINATOR;
  const upper = (derived * (BPS_DENOMINATOR + bps)) / BPS_DENOMINATOR;
  return { lower, upper };
}

/**
 * withinTolerance — the single comparison function for all premise evaluation.
 *
 * Written once, tested exhaustively. Called from everywhere in the enforcer.
 * NO FLOATS. BigInt arithmetic only.
 *
 * @param claimed          The agent's stated value (string-encoded)
 * @param derived          The enforcer's re-derived value from The Graph (string-encoded)
 * @param op               The comparison operator from the policy definition
 * @param toleranceBps     Allowed drift in basis points (default 0)
 * @param policyValue      The policy's own required threshold for this field
 *                         (e.g. minimum TVL, minimum age) — checked against
 *                         the re-derived value independently of the claim.
 * @param currentTimestamp Current unix timestamp in seconds (for time-based ops)
 * @param isUSD            If true, parse both values as 18-decimal USD amounts
 */
export function withinTolerance(
  claimed: string,
  derived: string,
  op: PremiseOp,
  toleranceBps: number = 0,
  policyValue?: string,
  currentTimestamp: number = Math.floor(Date.now() / 1000),
  isUSD = false,
): boolean {
  if (op === 'older_than' || op === 'younger_than') {
    // derived = createdTimestamp (unix seconds, as string)
    // policyValue = minimum age in seconds (from policy definition)
    // claimed = agent's claimed createdTimestamp
    if (policyValue === undefined) {
      throw new Error('policyValue required for older_than / younger_than');
    }

    const createdTs  = parseBigInt(derived);
    const minAgeSecs = parseBigInt(policyValue);
    const now        = BigInt(currentTimestamp);
    const poolAge    = now - createdTs; // seconds since pool creation

    if (op === 'older_than') {
      // Pool must have been created at least minAgeSecs ago
      return poolAge >= minAgeSecs;
    } else {
      // Pool must have been created less than minAgeSecs ago
      return poolAge < minAgeSecs;
    }
  }

  // Non-numeric equality.
  //
  // `eq` is the only operator meaningful on a value that is not a number, and
  // commerce premises need exactly that: a seller is on an allowlist or is not
  // ('true' / 'false'), an event is 'scheduled' or 'cancelled'. There is no
  // ordering on those and no tolerance band that means anything.
  //
  // This branch exists because of a real crash, not a hypothetical one. Every
  // value used to go through parseBigInt, so `sellerAuthorized eq 'true'` threw
  // `Cannot convert true to a BigInt` — and a throw inside enforce() does not
  // become a refusal, it propagates. Fail-closed stopped holding at exactly the
  // moment it matters most. The DeFi premises this was written for were all
  // numeric, so nothing surfaced it until a second domain arrived.
  //
  // Tolerance is ignored rather than rejected here: an author who writes
  // tolerance_bps on a boolean has made a harmless mistake, and refusing an
  // otherwise well-formed premise over a field that cannot change the answer
  // would fail a purchase for a typo.
  if (op === 'eq' && !isNumericString(derived)) {
    if (policyValue === undefined) {
      throw new Error(`policyValue (the policy's own threshold) required for op: eq`);
    }
    // Both conditions, for the same reason they are kept separate below:
    // reality must satisfy the policy, AND the claim must match reality.
    return derived === policyValue && claimed === derived;
  }

  // For numeric comparisons, parse values appropriately
  if (policyValue === undefined) {
    throw new Error(`policyValue (the policy's own threshold) required for op: ${op}`);
  }

  let claimedBig: bigint;
  let derivedBig: bigint;
  let thresholdBig: bigint;

  if (isUSD) {
    claimedBig   = parseUSD(claimed);
    derivedBig   = parseUSD(derived);
    thresholdBig = parseUSD(policyValue);
  } else {
    claimedBig   = parseBigInt(claimed);
    derivedBig   = parseBigInt(derived);
    thresholdBig = parseBigInt(policyValue);
  }

  // Two independent conditions must both hold — conflating them is a real
  // security bug: checking only one lets either a genuinely-too-small pool
  // that's honestly reported (meetsPolicy fails, claim agrees with reality)
  // or an attacker who lies about a real pool's stats (meetsPolicy might
  // pass, claim disagrees with reality) slip through.
  //
  // 1. Reality itself must satisfy what the policy requires, independent of
  //    what the agent claimed.
  let meetsPolicy: boolean;
  switch (op) {
    case 'gte':
      meetsPolicy = derivedBig >= thresholdBig;
      break;
    case 'lte':
      meetsPolicy = derivedBig <= thresholdBig;
      break;
    case 'eq':
      meetsPolicy = derivedBig === thresholdBig;
      break;
    default:
      throw new Error(`Unknown op: ${String(op)}`);
  }

  // 2. The agent's claim must agree with reality within tolerance — this is
  //    the anti-lying check, independent of whether reality happens to
  //    satisfy the policy.
  const { lower, upper } = toleranceWindow(derivedBig, toleranceBps);
  const claimAgreesWithReality = claimedBig >= lower && claimedBig <= upper;

  return meetsPolicy && claimAgreesWithReality;
}
