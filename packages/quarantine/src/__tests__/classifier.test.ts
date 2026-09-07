import { classify, isQuarantined, FIELD_REGISTRY } from '../classifier.js';

describe('classify', () => {
  it('classifies known attacker-writable string fields as QUARANTINED', () => {
    expect(classify('ERC-20.name()')).toBe('QUARANTINED');
    expect(classify('ERC-20.symbol()')).toBe('QUARANTINED');
    expect(classify('ERC-721.tokenURI()')).toBe('QUARANTINED');
    expect(classify('DAO.proposal.description')).toBe('QUARANTINED');
  });

  it('classifies typed numeric/validated fields as TRUSTED', () => {
    expect(classify('ERC-20.balanceOf()')).toBe('TRUSTED');
    expect(classify('block.timestamp')).toBe('TRUSTED');
    expect(classify('msg.sender')).toBe('TRUSTED');
  });

  it('classifies enforcer-computed values as DERIVED', () => {
    expect(classify('enforcer.premise.derived')).toBe('DERIVED');
  });

  it('fails safe: an unrecognized source defaults to QUARANTINED, never TRUSTED', () => {
    expect(classify('some.brand.new.field.nobody.registered')).toBe('QUARANTINED');
  });
});

describe('isQuarantined', () => {
  it('returns true for quarantined sources', () => {
    expect(isQuarantined('ERC-20.name()')).toBe(true);
  });

  it('returns false for trusted sources', () => {
    expect(isQuarantined('block.number')).toBe(false);
  });

  it('fails safe: returns true for an unknown source', () => {
    expect(isQuarantined('totally.unregistered.source')).toBe(true);
  });
});

describe('FIELD_REGISTRY', () => {
  it('has no duplicate source entries', () => {
    const sources = FIELD_REGISTRY.map((f) => f.source);
    expect(new Set(sources).size).toBe(sources.length);
  });

  it('every entry has a non-empty reason', () => {
    for (const entry of FIELD_REGISTRY) {
      expect(entry.reason.length).toBeGreaterThan(0);
    }
  });
});
