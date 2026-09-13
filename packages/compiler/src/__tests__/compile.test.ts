import { compilePolicy, type PolicyIntent } from '../compile.js';

const BASE_INTENT: PolicyIntent = {
  budgetUSDC: '500',
  budgetPeriod: '7d',
  premises: [
    { id: 'tvl', schema: 'messari-dex-amm', field: 'liquidityPool.totalValueLockedUSD', op: 'gte', value: '50000000', toleranceBps: 200 },
    { id: 'pool_age', schema: 'messari-dex-amm', field: 'liquidityPool.createdTimestamp', op: 'older_than', value: '2592000' },
  ],
  forbiddenActions: ['selfdestruct', 'approve_unlimited', 'delegatecall'],
  irreversibleAboveUSDC: '100',
};

describe('compilePolicy', () => {
  it('converts whole-USDC amounts to 6-decimal fixed point', () => {
    const policy = compilePolicy(BASE_INTENT);
    expect(policy.budget.max).toBe('500000000');
    expect(policy.irreversible_above).toBe('100000000');
  });

  it('scales a plain USD threshold to 18-decimal integer form', () => {
    const policy = compilePolicy(BASE_INTENT);
    const tvl = policy.premises.find((p) => p.id === 'tvl');
    // 50,000,000 (50M USD) -> 50,000,000 * 1e18
    expect(tvl?.value).toBe('50000000000000000000000000');
  });

  it('leaves an already-scaled USD value untouched', () => {
    const intent: PolicyIntent = {
      ...BASE_INTENT,
      premises: [
        { id: 'tvl', schema: 'messari-dex-amm', field: 'liquidityPool.totalValueLockedUSD', op: 'gte', value: '50000000000000000000000000' },
      ],
    };
    const policy = compilePolicy(intent);
    expect(policy.premises[0]?.value).toBe('50000000000000000000000000');
  });

  it('leaves non-USD field values untouched (e.g. duration in seconds)', () => {
    const policy = compilePolicy(BASE_INTENT);
    const age = policy.premises.find((p) => p.id === 'pool_age');
    expect(age?.value).toBe('2592000');
  });

  it('sorts forbidden actions deterministically', () => {
    const policy = compilePolicy(BASE_INTENT);
    expect(policy.forbid).toEqual(['approve_unlimited', 'delegatecall', 'selfdestruct']);
  });

  it('always starts at version 1', () => {
    expect(compilePolicy(BASE_INTENT).version).toBe(1);
  });

  it('preserves toleranceBps when provided, omits when not', () => {
    const policy = compilePolicy(BASE_INTENT);
    const tvl = policy.premises.find((p) => p.id === 'tvl');
    const age = policy.premises.find((p) => p.id === 'pool_age');
    expect(tvl?.tolerance_bps).toBe(200);
    expect(age?.tolerance_bps).toBeUndefined();
  });

  it('is deterministic — same intent always compiles to the same artifact', () => {
    expect(compilePolicy(BASE_INTENT)).toEqual(compilePolicy(BASE_INTENT));
  });
});

describe('fractional USDC amounts', () => {
  const withAmounts = (budget: string, threshold: string) =>
    compilePolicy({ ...BASE_INTENT, budgetUSDC: budget, irreversibleAboveUSDC: threshold });

  it('keeps the fractional part instead of dropping it', () => {
    // '2.5' used to compile to 2000000 — half a USDC gone from a spending
    // limit, silently.
    expect(withAmounts('500', '2.5').irreversible_above).toBe('2500000');
    expect(withAmounts('12.75', '1').budget.max).toBe('12750000');
  });

  it('handles a threshold below one USDC', () => {
    // This used to compile to '0', which reads as "no threshold" while
    // actually meaning "confirm everything".
    expect(withAmounts('500', '0.5').irreversible_above).toBe('500000');
    expect(withAmounts('500', '0.000001').irreversible_above).toBe('1');
  });

  it('is unchanged for whole amounts, so committed hashes still match', () => {
    expect(withAmounts('500', '1').budget.max).toBe('500000000');
    expect(withAmounts('500', '1').irreversible_above).toBe('1000000');
    expect(withAmounts('500', '100').irreversible_above).toBe('100000000');
  });

  it('rejects more precision than USDC can express', () => {
    expect(() => withAmounts('500', '1.0000001')).toThrow(/6 decimals/);
  });

  it('rejects values that are not decimal amounts', () => {
    expect(() => withAmounts('500', '1e6')).toThrow(/decimal USDC amount/);
    expect(() => withAmounts('500', '-1')).toThrow(/decimal USDC amount/);
    expect(() => withAmounts('', '1')).toThrow(/decimal USDC amount/);
  });
});
