import { privateKeyToAccount } from 'viem/accounts';
import { recoverMessageAddress } from 'viem';
import {
  PROPOSAL_TYPEHASH,
  PROPOSAL_TYPEHASH_STRING,
  premisesHash,
  proposalDigest,
  type ProposalDigestInput,
} from '../proposal.js';

/**
 * The proposal digest is what stops one agent spending another owner's budget,
 * so every field that decides authority has to be inside it. These tests assert
 * that changing any of them changes the digest — a field left out would be a
 * field an attacker can edit after the signature is made.
 */

const AGENT = '0x00000000000000000000000000000000000000b2' as const;
const VAULT = '0x027C61c1418157b112B82F30894F8aC1F074AF85' as const;

const base: ProposalDigestInput = {
  chainId: 5042002n,
  vault: VAULT,
  agent: AGENT,
  proposalId: `0x${'11'.repeat(32)}`,
  action: {
    kind: 'swap',
    target: '0x00000000000000000000000000000000000000a1',
    calldata: '0x',
    valueUSDC: '500000',
  },
  premises: [
    { premiseId: 'tvl', claimedValue: '127000000000000000000000000' },
    { premiseId: 'pool_age', claimedValue: '1700287149' },
  ],
  createdAt: 1789283000,
};

describe('proposalDigest — determinism', () => {
  it('is stable for identical input', () => {
    expect(proposalDigest(base)).toBe(proposalDigest({ ...base }));
  });

  it('names every bound field in the typehash string', () => {
    for (const field of [
      'chainId', 'vault', 'agent', 'proposalId', 'actionKind',
      'target', 'calldataHash', 'valueUSDC', 'premisesHash', 'createdAt',
    ]) {
      expect(PROPOSAL_TYPEHASH_STRING).toContain(field);
    }
  });

  it('has a typehash derived from that string', () => {
    expect(PROPOSAL_TYPEHASH).toMatch(/^0x[0-9a-f]{64}$/);
  });
});

describe('proposalDigest — what an attacker cannot change after signing', () => {
  const changed: Array<[string, ProposalDigestInput]> = [
    ['the agent', { ...base, agent: '0x00000000000000000000000000000000000000ff' }],
    ['the vault', { ...base, vault: '0x00000000000000000000000000000000000000ff' }],
    ['the chain', { ...base, chainId: 1n }],
    ['the proposal id', { ...base, proposalId: `0x${'22'.repeat(32)}` }],
    ['the createdAt', { ...base, createdAt: base.createdAt + 1 }],
    ['the action kind', { ...base, action: { ...base.action, kind: 'approve_unlimited' } }],
    [
      'the recipient',
      { ...base, action: { ...base.action, target: '0x00000000000000000000000000000000000000ff' } },
    ],
    ['the amount', { ...base, action: { ...base.action, valueUSDC: '500001' } }],
    ['the calldata', { ...base, action: { ...base.action, calldata: '0xdeadbeef' } }],
    [
      'a claimed premise value',
      {
        ...base,
        premises: [
          { premiseId: 'tvl', claimedValue: '412000000000000000000000000' },
          { premiseId: 'pool_age', claimedValue: '1700287149' },
        ],
      },
    ],
    [
      'a premise id',
      {
        ...base,
        premises: [
          { premiseId: 'tvl_spoofed', claimedValue: '127000000000000000000000000' },
          { premiseId: 'pool_age', claimedValue: '1700287149' },
        ],
      },
    ],
    [
      'the premise order',
      {
        ...base,
        premises: [
          { premiseId: 'pool_age', claimedValue: '1700287149' },
          { premiseId: 'tvl', claimedValue: '127000000000000000000000000' },
        ],
      },
    ],
    ['dropping a premise', { ...base, premises: [base.premises[0]!] }],
  ];

  it.each(changed)('changes when %s changes', (_label, mutated) => {
    expect(proposalDigest(mutated)).not.toBe(proposalDigest(base));
  });
});

describe('premisesHash', () => {
  it('distinguishes a swapped id and value', () => {
    // Hashing a concatenation instead of both arrays separately would let
    // {id: "a", value: "bc"} collide with {id: "ab", value: "c"}.
    expect(premisesHash([{ premiseId: 'a', claimedValue: 'bc' }])).not.toBe(
      premisesHash([{ premiseId: 'ab', claimedValue: 'c' }]),
    );
  });

  it('is stable for an empty list', () => {
    expect(premisesHash([])).toBe(premisesHash([]));
  });
});

describe('proposalDigest — end to end recovery', () => {
  it('recovers the signing agent, and only that agent', async () => {
    const account = privateKeyToAccount(`0x${'ab'.repeat(32)}`);
    const input = { ...base, agent: account.address };
    const digest = proposalDigest(input);

    const signature = await account.signMessage({ message: { raw: digest } });
    const recovered = await recoverMessageAddress({ message: { raw: digest }, signature });
    expect(recovered).toBe(account.address);

    // The same signature against a tampered proposal recovers somebody else,
    // which is what the API compares against proposal.agent and rejects.
    const tampered = proposalDigest({
      ...input,
      action: { ...input.action, valueUSDC: '999999999' },
    });
    const recoveredFromTampered = await recoverMessageAddress({
      message: { raw: tampered },
      signature,
    });
    expect(recoveredFromTampered).not.toBe(account.address);
  });
});
