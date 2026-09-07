import { canonicalJson, hashPolicy, verifyPolicyHash } from '../hash.js';
import type { Policy } from '@bonded/seam';

const BASE_POLICY: Policy = {
  version: 1,
  budget: { asset: 'USDC', period: '7d', max: '500000000' },
  premises: [
    { id: 'tvl', schema: 'messari-dex-amm', field: 'liquidityPool.totalValueLockedUSD', op: 'gte', value: '50000000000000000000000000', tolerance_bps: 200 },
  ],
  forbid: ['approve_unlimited'],
  irreversible_above: '100000000',
};

describe('canonicalJson', () => {
  it('sorts object keys regardless of insertion order', () => {
    const a = canonicalJson({ b: 1, a: 2 });
    const b = canonicalJson({ a: 2, b: 1 });
    expect(a).toBe(b);
    expect(a).toBe('{"a":2,"b":1}');
  });

  it('sorts keys recursively in nested objects', () => {
    const a = canonicalJson({ z: { d: 1, c: 2 }, a: 1 });
    expect(a).toBe('{"a":1,"z":{"c":2,"d":1}}');
  });

  it('preserves array order (arrays are not sorted)', () => {
    expect(canonicalJson([3, 1, 2])).toBe('[3,1,2]');
  });

  it('rejects non-integer numbers — no floats allowed', () => {
    expect(() => canonicalJson(1.5)).toThrow('float detected');
  });

  it('accepts integer numbers', () => {
    expect(canonicalJson(42)).toBe('42');
  });

  it('rejects bigint — caller must convert to string first', () => {
    expect(() => canonicalJson(10n)).toThrow('BigInt not serializable');
  });

  it('serializes null and booleans', () => {
    expect(canonicalJson(null)).toBe('null');
    expect(canonicalJson(true)).toBe('true');
    expect(canonicalJson(false)).toBe('false');
  });

  it('escapes strings via JSON.stringify', () => {
    expect(canonicalJson('hello "world"')).toBe('"hello \\"world\\""');
  });
});

describe('hashPolicy', () => {
  it('is deterministic for the same policy', () => {
    expect(hashPolicy(BASE_POLICY)).toBe(hashPolicy(BASE_POLICY));
  });

  it('produces the same hash regardless of key insertion order', () => {
    const reordered: Policy = {
      irreversible_above: BASE_POLICY.irreversible_above,
      forbid: BASE_POLICY.forbid,
      premises: BASE_POLICY.premises,
      budget: BASE_POLICY.budget,
      version: BASE_POLICY.version,
    };
    expect(hashPolicy(reordered)).toBe(hashPolicy(BASE_POLICY));
  });

  it('changes when any field changes', () => {
    const changed: Policy = { ...BASE_POLICY, version: 2 };
    expect(hashPolicy(changed)).not.toBe(hashPolicy(BASE_POLICY));
  });

  it('starts with 0x', () => {
    expect(hashPolicy(BASE_POLICY)).toMatch(/^0x[0-9a-f]{64}$/);
  });
});

describe('verifyPolicyHash', () => {
  it('returns true for a matching hash', () => {
    const hash = hashPolicy(BASE_POLICY);
    expect(verifyPolicyHash(BASE_POLICY, hash)).toBe(true);
  });

  it('returns false for a mismatched hash', () => {
    expect(verifyPolicyHash(BASE_POLICY, '0xdeadbeef' as `0x${string}`)).toBe(false);
  });

  it('returns false when the policy has changed since the hash was computed', () => {
    const hash = hashPolicy(BASE_POLICY);
    const mutated: Policy = { ...BASE_POLICY, version: 99 };
    expect(verifyPolicyHash(mutated, hash)).toBe(false);
  });
});
