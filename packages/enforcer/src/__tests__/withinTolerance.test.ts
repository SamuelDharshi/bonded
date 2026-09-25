import { withinTolerance } from '../withinTolerance.js';

/**
 * withinTolerance enforces TWO independent conditions for gte/lte/eq:
 *   1. meetsPolicy      — derived satisfies op(derived, policyValue)
 *   2. claimAgreesWithReality — claimed is within toleranceBps of derived
 * Both must hold. Testing them independently is the point: a pool that's
 * honestly reported but genuinely too small must fail (meetsPolicy false),
 * and a pool that's big enough but whose stats were misreported must also
 * fail (claimAgreesWithReality false) — collapsing either check into the
 * other reopens the exact bug this function exists to prevent.
 */
describe('withinTolerance — exhaustive unit tests', () => {
  const now = Math.floor(Date.now() / 1000);

  // ── gte ──────────────────────────────────────────────────────────────────

  describe('gte', () => {
    it('passes when derived meets policy and claimed matches derived exactly', () => {
      // policy: field gte 1000. derived = 1000 (meets it). claimed = 1000 (honest).
      expect(withinTolerance('1000', '1000', 'gte', 0, '1000')).toBe(true);
    });

    it('passes when derived exceeds policy threshold and claimed matches derived', () => {
      // policy: field gte 500. derived = 1000 (comfortably meets it). claimed = 1000.
      expect(withinTolerance('1000', '1000', 'gte', 0, '500')).toBe(true);
    });

    it('fails when derived does not meet policy threshold, even if claim is honest', () => {
      // The pool is genuinely too small — an honest agent must still be refused.
      expect(withinTolerance('900', '900', 'gte', 0, '1000')).toBe(false);
    });

    it('fails when derived meets policy but claim disagrees with derived (lying)', () => {
      // policy: field gte 500. derived = 900 (meets it). claimed = 1500 (agent lied upward).
      expect(withinTolerance('1500', '900', 'gte', 0, '500')).toBe(false);
    });

    it('passes when claimed is within the tolerance window of derived', () => {
      // 200 bps = 2%, so lower = 1000 * 9800/10000 = 980
      expect(withinTolerance('980', '1000', 'gte', 200, '500')).toBe(true);
    });

    it('fails when claimed is outside the tolerance window of derived', () => {
      expect(withinTolerance('979', '1000', 'gte', 200, '500')).toBe(false);
    });

    it('handles very large 18-decimal USD values', () => {
      const largeUSD = '412000000000000000000000000';
      const threshold50M = '50000000000000000000000000';
      // Exactly equal, comfortably above threshold
      expect(withinTolerance(largeUSD, largeUSD, 'gte', 0, threshold50M)).toBe(true);
      // 1% below derived, with 200 bps tolerance — should still agree with reality
      const slightlyLess = '407880000000000000000000000'; // ~99% of largeUSD
      expect(withinTolerance(slightlyLess, largeUSD, 'gte', 200, threshold50M)).toBe(true);
    });

    it('handles zero derived value against a zero threshold', () => {
      expect(withinTolerance('0', '0', 'gte', 0, '0')).toBe(true);
    });

    it('throws when policyValue is missing', () => {
      expect(() => withinTolerance('1000', '1000', 'gte', 0)).toThrow('policyValue');
    });
  });

  // ── lte ──────────────────────────────────────────────────────────────────

  describe('lte', () => {
    it('passes when derived meets policy and claimed matches derived exactly', () => {
      expect(withinTolerance('1000', '1000', 'lte', 0, '1000')).toBe(true);
    });

    it('fails when derived exceeds the policy ceiling, even if claim is honest', () => {
      expect(withinTolerance('1500', '1500', 'lte', 0, '1000')).toBe(false);
    });

    it('fails when derived meets policy but claim disagrees with derived (lying)', () => {
      expect(withinTolerance('500', '800', 'lte', 0, '1000')).toBe(false);
    });

    it('passes when claimed is within the tolerance window above derived', () => {
      // 200 bps, upper = 1000 * 10200/10000 = 1020
      expect(withinTolerance('1020', '1000', 'lte', 200, '1000')).toBe(true);
    });

    it('fails when claimed exceeds the upper tolerance window', () => {
      expect(withinTolerance('1021', '1000', 'lte', 200, '1000')).toBe(false);
    });
  });

  // ── eq ───────────────────────────────────────────────────────────────────

  describe('eq', () => {
    it('passes on exact match against policy value', () => {
      expect(withinTolerance('1000', '1000', 'eq', 0, '1000')).toBe(true);
    });

    it('fails when derived does not equal the policy value', () => {
      expect(withinTolerance('1000', '1000', 'eq', 0, '999')).toBe(false);
    });

    it('fails on any claim deviation with zero tolerance', () => {
      expect(withinTolerance('1001', '1000', 'eq', 0, '1000')).toBe(false);
      expect(withinTolerance('999', '1000', 'eq', 0, '1000')).toBe(false);
    });

    it('passes within bps window', () => {
      // 200 bps: [980, 1020]
      expect(withinTolerance('980', '1000', 'eq', 200, '1000')).toBe(true);
      expect(withinTolerance('1020', '1000', 'eq', 200, '1000')).toBe(true);
    });

    it('fails outside bps window', () => {
      expect(withinTolerance('979', '1000', 'eq', 200, '1000')).toBe(false);
      expect(withinTolerance('1021', '1000', 'eq', 200, '1000')).toBe(false);
    });
  });

  // ── older_than ────────────────────────────────────────────────────────────

  describe('older_than', () => {
    const OLD_TIMESTAMP = String(now - 40 * 24 * 3600); // 40 days ago
    const NEW_TIMESTAMP = String(now - 10 * 24 * 3600); // 10 days ago
    const MIN_AGE_30D   = String(30 * 24 * 3600);       // 30 days in seconds

    it('passes when pool is older than required age', () => {
      expect(
        withinTolerance(OLD_TIMESTAMP, OLD_TIMESTAMP, 'older_than', 0, MIN_AGE_30D, now),
      ).toBe(true);
    });

    it('fails when pool is younger than required age', () => {
      expect(
        withinTolerance(NEW_TIMESTAMP, NEW_TIMESTAMP, 'older_than', 0, MIN_AGE_30D, now),
      ).toBe(false);
    });

    it('passes on exact boundary (age == minAge)', () => {
      const exactTs = String(now - 30 * 24 * 3600);
      expect(
        withinTolerance(exactTs, exactTs, 'older_than', 0, MIN_AGE_30D, now),
      ).toBe(true);
    });
  });

  // ── younger_than ──────────────────────────────────────────────────────────

  describe('younger_than', () => {
    const OLD_TIMESTAMP = String(now - 40 * 24 * 3600);
    const NEW_TIMESTAMP = String(now - 10 * 24 * 3600);
    const MAX_AGE_30D   = String(30 * 24 * 3600);

    it('passes when pool is younger than max age', () => {
      expect(
        withinTolerance(NEW_TIMESTAMP, NEW_TIMESTAMP, 'younger_than', 0, MAX_AGE_30D, now),
      ).toBe(true);
    });

    it('fails when pool is older than max age', () => {
      expect(
        withinTolerance(OLD_TIMESTAMP, OLD_TIMESTAMP, 'younger_than', 0, MAX_AGE_30D, now),
      ).toBe(false);
    });
  });

  // ── edge cases ────────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('handles maximum safe BigInt-adjacent values', () => {
      const huge = '999999999999999999999999999999';
      expect(withinTolerance(huge, huge, 'eq', 0, huge)).toBe(true);
    });

    it('throws on unknown op', () => {
      expect(() =>
        withinTolerance('1', '1', 'unknown' as never, 0, '1'),
      ).toThrow('Unknown op');
    });

    it('throws when policyValue missing for older_than', () => {
      expect(() =>
        withinTolerance('1', '1', 'older_than', 0, undefined, now),
      ).toThrow('policyValue required');
    });

    it('throws when policyValue missing for gte/lte/eq', () => {
      expect(() => withinTolerance('1', '1', 'gte', 0)).toThrow('policyValue');
      expect(() => withinTolerance('1', '1', 'lte', 0)).toThrow('policyValue');
      expect(() => withinTolerance('1', '1', 'eq', 0)).toThrow('policyValue');
    });
  });
});

/**
 * Non-numeric equality.
 *
 * Regression for a crash found when Bonded moved from DeFi to commerce premises.
 * Every value went through parseBigInt, so `sellerAuthorized eq 'true'` threw
 * `Cannot convert true to a BigInt`. A throw here is worse than a wrong answer:
 * it escapes enforce()'s fail-closed path instead of becoming a refusal.
 *
 * The DeFi vocabulary was entirely numeric — TVL, timestamps — so nothing
 * exercised it until a second domain arrived.
 */
describe('withinTolerance — non-numeric eq', () => {
  it('accepts a matching string on both conditions', () => {
    expect(withinTolerance('true', 'true', 'eq', 0, 'true')).toBe(true);
    expect(withinTolerance('scheduled', 'scheduled', 'eq', 0, 'scheduled')).toBe(true);
  });

  it('refuses when reality does not satisfy the policy', () => {
    // The agent honestly reports an unauthorised seller. Claim matches reality,
    // but reality fails the policy.
    expect(withinTolerance('false', 'false', 'eq', 0, 'true')).toBe(false);
    expect(withinTolerance('cancelled', 'cancelled', 'eq', 0, 'scheduled')).toBe(false);
  });

  it('refuses when the claim disagrees with reality', () => {
    // The agent claims authorised; re-derivation says otherwise. This is the
    // scalper case, and it must fail even though the claim matches the policy.
    expect(withinTolerance('true', 'false', 'eq', 0, 'true')).toBe(false);
    expect(withinTolerance('scheduled', 'cancelled', 'eq', 0, 'scheduled')).toBe(false);
  });

  it('does not throw on a non-numeric value', () => {
    // The actual bug. Anything other than a clean boolean return would escape
    // the fail-closed path.
    expect(() => withinTolerance('true', 'true', 'eq', 0, 'true')).not.toThrow();
    expect(() => withinTolerance('issuer-primary', 'issuer-primary', 'eq', 0, 'issuer-primary')).not.toThrow();
  });

  it('still compares numeric eq numerically, ignoring leading zeros', () => {
    // '045' and '45' are the same number and must stay so — routing numerics
    // through string equality would silently break this.
    expect(withinTolerance('045', '45', 'eq', 0, '45')).toBe(true);
  });

  it('ignores tolerance on a non-numeric premise rather than failing', () => {
    // A tolerance band on a boolean is a harmless authoring mistake; refusing a
    // purchase over a field that cannot change the answer would not be.
    expect(withinTolerance('true', 'true', 'eq', 500, 'true')).toBe(true);
  });
});
