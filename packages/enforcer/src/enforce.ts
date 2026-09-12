import { createHash } from 'crypto';
import type {
  Proposal,
  Policy,
  Verdict,
  PremiseRecord,
  DecisionRecord,
  Hash32,
} from '@bonded/seam';
import { ReasonCode, OUTCOME } from '@bonded/seam';
import { hashPolicy, canonicalJson } from './policyHash.js';
import { withinTolerance } from './withinTolerance.js';

/**
 * QueryFn — the interface between the enforcer and The Graph.
 *
 * On the test path: use createFixtureQueryFn() from fixture.ts.
 * On the live path: use createStandardizedQueryFn() from @bonded/standardized.
 *
 * Returns the derived value as a string, or null if the query fails / entity not found.
 * The string is the canonical form for the field's type:
 *   - USD fields: 18-decimal scaled integer string (e.g. "412000000000000000000000000")
 *   - Timestamp fields: unix seconds string (e.g. "1609459200")
 */
export type QueryFn = (
  schema: string,
  field: string,
  params: Record<string, string>,
  atBlock: bigint,
) => Promise<string | null>;

export interface EnforceContext {
  /** On-chain policy hash for the agent — fetched once before enforce() */
  onchainPolicyHash: Hash32;
  /** Current block number — pinned once at top of enforce(). All premises queried at this block. */
  currentBlock: bigint;
  /** Current unix timestamp in seconds — for older_than / younger_than comparisons */
  currentTimestamp: number;
  /** Total USDC spent by this agent in the current budget period (6 decimals, bigint) */
  spentThisPeriod: bigint;
  /**
   * OPTIONAL confidential threshold oracle — step 5's delegation seam.
   *
   * When absent (the default, and what every existing test exercises), step 5
   * compares valueUSDC against policy.irreversible_above locally, in
   * plaintext. That is correct but it is NOT confidential: the threshold sits
   * in the policy artifact, so anyone holding the artifact knows exactly where
   * the step-up boundary is and can binary-search right up to it.
   *
   * When present, step 5 asks this instead and never reads
   * policy.irreversible_above at all. The intended implementation is the
   * deployed Chainlink CRE handlerInTee workflow (cre/stepup-threshold),
   * which holds the threshold as a Vault DON secret inside an AWS Nitro
   * enclave and returns only this boolean — the number itself never leaves.
   *
   * This is a port, not an implementation: the enforcer stays non-generative
   * and makes no network calls of its own. Whoever constructs the context
   * decides what answers.
   */
  requiresStepUp?: (input: {
    proposalHash: Hash32;
    valueUSDC: bigint;
  }) => Promise<boolean>;
}

function buildVerdict(
  proposal: Proposal,
  policyHash: Hash32,
  outcome: Verdict['outcome'],
  reasonCode: ReasonCode,
  blockChecked: bigint,
  logRef: Hash32,
): Verdict {
  return {
    proposalHash: proposal.id,
    policyHash,
    outcome,
    reasonCode,
    blockChecked,
    logRef,
  };
}

function buildLogRef(record: Omit<DecisionRecord, 'verdict'>): Hash32 {
  // canonicalJson deliberately rejects BigInt (see policyHash.ts) to force
  // explicit string conversion at every call site rather than an implicit
  // one — PremiseRecord.blockChecked and Verdict.blockChecked are bigint by
  // type, so they're converted here before hashing, not inside canonicalJson.
  const serializable = {
    ...record,
    premises: record.premises.map((p) => ({
      ...p,
      blockChecked: p.blockChecked.toString(),
    })),
  };
  const content = canonicalJson(serializable as unknown);
  const hash    = createHash('sha256').update(content, 'utf8').digest('hex');
  return `0x${hash}`;
}

/**
 * enforce() — the re-derivation algorithm.
 *
 * 6-step evaluation in exact order:
 * 1. Policy hash check
 * 2. Forbidden action check
 * 3. Per-premise re-derivation at pinned block
 * 4. Budget check
 * 5. Irreversible threshold check
 * 6. CLEARED
 *
 * INVARIANTS:
 * - currentBlock is pinned at the call site before this function runs
 * - All premises queried at ctx.currentBlock — not "now"
 * - cache: 'no-store' is enforced in the QueryFn implementation, not here
 * - No LLM calls
 * - No floats
 */
export async function enforce(
  proposal: Proposal,
  policy: Policy,
  ctx: EnforceContext,
  query: QueryFn,
): Promise<{ verdict: Verdict; record: DecisionRecord }> {
  const policyHash = hashPolicy(policy);
  const premiseRecords: PremiseRecord[] = [];

  // Helper to build final DecisionRecord + Verdict
  function finalize(
    outcome: Verdict['outcome'],
    reasonCode: ReasonCode,
  ): { verdict: Verdict; record: DecisionRecord } {
    const partialRecord = {
      proposal,
      policyVersion: policy.version,
      premises: premiseRecords,
      evaluatedAt: ctx.currentTimestamp,
    };
    const logRef  = buildLogRef(partialRecord);
    const verdict = buildVerdict(proposal, policyHash, outcome, reasonCode, ctx.currentBlock, logRef);
    const record: DecisionRecord = { ...partialRecord, verdict };
    return { verdict, record };
  }

  // ── STEP 1: Policy hash check ─────────────────────────────────────────────
  if (policyHash !== ctx.onchainPolicyHash) {
    return finalize(OUTCOME.REFUSED, ReasonCode.STALE_POLICY);
  }

  // ── STEP 2: Forbidden action check (cheapest, before any network calls) ───
  if (policy.forbid.includes(proposal.action.kind)) {
    return finalize(OUTCOME.REFUSED, ReasonCode.POLICY_FORBIDDEN_ACTION);
  }

  // ── STEP 3: Per-premise re-derivation at pinned block ─────────────────────
  for (const claimedPremise of proposal.premises) {
    const def = policy.premises.find((p) => p.id === claimedPremise.premiseId);

    if (!def) {
      premiseRecords.push({
        premiseId:    claimedPremise.premiseId,
        schema:       'unknown',
        field:        'unknown',
        op:           'eq',
        claimedValue: claimedPremise.claimedValue,
        derivedValue: null,
        toleranceBps: 0,
        passed:       false,
        blockChecked: ctx.currentBlock,
      });
      return finalize(OUTCOME.REFUSED, ReasonCode.PREMISE_UNRESOLVABLE);
    }

    // Query at pinned block — params include premiseId for fixture compatibility
    const derived = await query(
      def.schema,
      def.field,
      { premiseId: def.id },
      ctx.currentBlock,
    );

    const toleranceBps = def.tolerance_bps ?? 0;

    if (derived === null) {
      premiseRecords.push({
        premiseId:    def.id,
        schema:       def.schema,
        field:        def.field,
        op:           def.op,
        claimedValue: claimedPremise.claimedValue,
        derivedValue: null,
        toleranceBps,
        passed:       false,
        blockChecked: ctx.currentBlock,
      });
      return finalize(OUTCOME.REFUSED, ReasonCode.PREMISE_UNRESOLVABLE);
    }

    // Determine if this is a USD-denominated field (18-decimal BigInt)
    const isUSD = def.field.toLowerCase().includes('usd');

    const passed = withinTolerance(
      claimedPremise.claimedValue,
      derived,
      def.op,
      toleranceBps,
      def.value,
      ctx.currentTimestamp,
      isUSD,
    );

    premiseRecords.push({
      premiseId:    def.id,
      schema:       def.schema,
      field:        def.field,
      op:           def.op,
      claimedValue: claimedPremise.claimedValue,
      derivedValue: derived,
      toleranceBps,
      passed,
      blockChecked: ctx.currentBlock,
    });

    if (!passed) {
      return finalize(OUTCOME.REFUSED, ReasonCode.PREMISE_MISMATCH);
    }
  }

  // ── STEP 4: Budget check ──────────────────────────────────────────────────
  const valueUSDC    = BigInt(proposal.action.valueUSDC);
  const budgetMax    = BigInt(policy.budget.max);

  if (ctx.spentThisPeriod + valueUSDC > budgetMax) {
    return finalize(OUTCOME.REFUSED, ReasonCode.BUDGET_EXCEEDED);
  }

  // ── STEP 5: Irreversible threshold check ──────────────────────────────────
  // Delegated when ctx.requiresStepUp is supplied (confidential path: the
  // threshold lives in a TEE and only the boolean crosses back), otherwise
  // compared locally against the policy artifact. See EnforceContext.
  //
  // Fail-closed on both paths: if the oracle is unreachable we hold rather
  // than clear. An authority we cannot ask is not an authority that said yes.
  let needsStepUp: boolean;
  if (ctx.requiresStepUp) {
    try {
      needsStepUp = await ctx.requiresStepUp({
        proposalHash: proposal.id,
        valueUSDC,
      });
    } catch {
      return finalize(OUTCOME.HELD_FOR_STEPUP, ReasonCode.ATTESTATION_MISSING);
    }
  } else {
    needsStepUp = valueUSDC > BigInt(policy.irreversible_above);
  }

  if (needsStepUp) {
    return finalize(OUTCOME.HELD_FOR_STEPUP, ReasonCode.IRREVERSIBLE_UNCONFIRMED);
  }

  // ── STEP 6: CLEARED ───────────────────────────────────────────────────────
  return finalize(OUTCOME.CLEARED, ReasonCode.OK);
}
