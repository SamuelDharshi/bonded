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
