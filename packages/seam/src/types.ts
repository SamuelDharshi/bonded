/**
 * @bonded/seam — Canonical Types
 *
 * FROZEN after Day 1. Do not modify after first commit.
 * Zero runtime dependencies by design.
 * Every other package imports exclusively from here.
 *
 * INVARIANT: value fields are strings everywhere.
 * USDC amounts are bigint (6 decimals).
 * Subgraph USD fields parsed with decimal.js at fixed 18-decimal scale.
 * Never use parseFloat for premise comparison.
 */

// ─── Primitives ──────────────────────────────────────────────────────────────

export type Address = `0x${string}`;
export type Hash32 = `0x${string}`;
export type Signature = `0x${string}`;

// ─── Premise ─────────────────────────────────────────────────────────────────

export type PremiseOp = 'gte' | 'lte' | 'eq' | 'older_than' | 'younger_than';

export interface Premise {
  /** Stable identifier referenced in Proposal.premises */
  id: string;
  /** Standardized schema name, e.g. 'messari-dex-amm' */
  schema: string;
  /** Dot-path into the schema's canonical entity, e.g. 'liquidityPool.totalValueLockedUSD' */
  field: string;
  op: PremiseOp;
  /**
   * Always string-encoded. Never a JSON number.
   * USD fields: string representation of 18-decimal scaled integer.
   * Timestamp fields: unix seconds as string.
   * Duration fields (older_than/younger_than): seconds as string.
   */
  value: string;
  /** Basis points of allowed drift between claimed and re-derived value */
  toleranceBps?: number;
}

// ─── Proposal ────────────────────────────────────────────────────────────────

export interface Proposal {
  /** keccak256 of canonical JSON (all fields sorted, minus this 'id' field itself) */
  id: Hash32;
  /** The agent's wallet address */
  agent: Address;
  action: {
    /** Enumerated action kind: 'swap' | 'transfer' | 'approve' */
    kind: string;
    /** Target contract address */
    target: Address;
    /** ABI-encoded calldata */
    calldata: `0x${string}`;
    /**
     * USDC value as 6-decimal fixed-point string.
     * e.g. "250000000" = 250 USDC
     * Never a float.
     */
    valueUSDC: string;
  };
  /** The agent's stated premise values — re-derived by enforcer */
  premises: Array<{
    premiseId: string;
    /** Agent's claimed value for this premise — string encoded, same rules as Premise.value */
    claimedValue: string;
  }>;
  /** Unix seconds */
  createdAt: number;
}

// ─── Reason Codes ────────────────────────────────────────────────────────────

/**
 * ReasonCode — enumerated, never a free string.
 * Free strings are how injected text reaches a UI.
 */
export enum ReasonCode {
  OK = 0,
  PREMISE_MISMATCH = 1,         // claimed vs re-derived exceeded tolerance
  PREMISE_UNRESOLVABLE = 2,     // subgraph query failed or returned no entity
  POLICY_FORBIDDEN_ACTION = 3,  // action.kind in policy.forbid
  BUDGET_EXCEEDED = 4,
  STALE_POLICY = 5,             // policyHash on proposal != current committed hash
  IRREVERSIBLE_UNCONFIRMED = 6, // requires CRE step-up, not yet confirmed
  ATTESTATION_MISSING = 7,      // TEE attestation required but absent (Chainlink CRE path)
}

// ─── Verdict ─────────────────────────────────────────────────────────────────

/**
 * Verdict — the single frozen seam between all layers.
 * Layer A (Proposer) emits Proposal.
 * Layer B (Enforcer) emits Verdict.
 * Layer C (Authority) signs Verdict.
 * Layer D (Settlement) executes on Verdict.
 *
 * FROZEN. Do not modify after seam-v1 tag.
 */
export interface Verdict {
  /** keccak256 of canonical proposal JSON */
  proposalHash: Hash32;
  /** keccak256 of the policy artifact currently committed on-chain */
  policyHash: Hash32;
  /** 0 = CLEARED, 1 = REFUSED, 2 = HELD_FOR_STEPUP */
  outcome: 0 | 1 | 2;
  reasonCode: ReasonCode;
  /** Block number at which all premises were re-derived */
  blockChecked: bigint;
  /** Content hash of the full decision record (for audit log) */
  logRef: Hash32;
}

// ─── Outcome constants (avoids magic numbers in calling code) ────────────────

export const OUTCOME = {
  CLEARED: 0,
  REFUSED: 1,
  HELD_FOR_STEPUP: 2,
} as const satisfies Record<string, Verdict['outcome']>;

// ─── Policy Artifact (compiled, canonical JSON) ───────────────────────────────

export interface PolicyPremise {
  id: string;
  schema: string;
  field: string;
  op: PremiseOp;
  value: string;
  tolerance_bps?: number;
}

export interface PolicyBudget {
  asset: 'USDC';
  /** ISO-8601 duration or shorthand: '7d', '30d' */
  period: string;
  /** 6-decimal USDC as string, e.g. "500000000" = 500 USDC */
  max: string;
}

export interface Policy {
  version: number;
  budget: PolicyBudget;
  premises: PolicyPremise[];
  /** Action kinds that are always REFUSED regardless of premises */
  forbid: string[];
  /**
   * 6-decimal USDC threshold above which CLEARED requires step-up confirmation.
   * e.g. "100000000" = 100 USDC
   */
  irreversible_above: string;
}

// ─── Decision Record (emitted to audit log + subgraph) ───────────────────────

export interface PremiseRecord {
  premiseId: string;
  schema: string;
  field: string;
  op: PremiseOp;
  claimedValue: string;
  derivedValue: string | null;
  toleranceBps: number;
  passed: boolean;
  blockChecked: bigint;
}

export interface DecisionRecord {
  verdict: Verdict;
  proposal: Proposal;
  policyVersion: number;
  premises: PremiseRecord[];
  evaluatedAt: number; // unix seconds
}
