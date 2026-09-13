import {
  VERDICT_TYPEHASH,
  VERDICT_TYPEHASH_STRING,
  actionHash,
  encodeTransferAction,
  verdictDigest,
} from '../vault.js';

/**
 * Cross-implementation vector.
 *
 * These constants are not hand-written: they are the output of
 * contracts/test/DigestVector.t.sol, which asks the deployed Solidity
 * verdictDigest() for the same inputs. Two implementations of one digest that
 * disagree produce signatures which never verify, and on chain that surfaces
 * only as an opaque BadSigner revert — so it has to be pinned here.
 *
 * Regenerate with:
 *   cd contracts && forge test --match-contract DigestVectorTest -vv
 */
const VECTOR = {
  chainId: 5042002n,
  vault: '0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f' as const,
  agent: '0x00000000000000000000000000000000000000b2' as const,
  target: '0x00000000000000000000000000000000000000a1' as const,
  valueUSDC: 2_000_000n,
  proposalHash: `0x${(0xaaa1).toString(16).padStart(64, '0')}` as `0x${string}`,
  policyHash: `0x${(0xbbb2).toString(16).padStart(64, '0')}` as `0x${string}`,
  logRef: `0x${(0xccc3).toString(16).padStart(64, '0')}` as `0x${string}`,
  blockChecked: 61779770n,
  expectedActionHash:
    '0x99316ed65084cbf82ede684c52a3b9be28b8961c5b12d243bd8d575b7b3a96c2' as const,
  expectedDigest:
    '0xe9493208cff99374a4d2b166c63ad687db04b08897c1b43d10d830d6c6c1199f' as const,
  expectedTypehash:
    '0x7adac6b245cbd8fc2ead9c1ab4beedf016a4e77777614a5c7400b543035d0cd1' as const,
};

describe('verdict digest — parity with BondedVault.sol', () => {
  it('derives the same typehash as the contract', () => {
    expect(VERDICT_TYPEHASH).toBe(VECTOR.expectedTypehash);
  });

  it('encodes an action to the same hash as abi.encode in Solidity', () => {
    const action = encodeTransferAction(VECTOR.target, VECTOR.valueUSDC);
    expect(actionHash(action)).toBe(VECTOR.expectedActionHash);
  });

  it('produces the digest the contract computes for the same inputs', () => {
    const action = encodeTransferAction(VECTOR.target, VECTOR.valueUSDC);
    const digest = verdictDigest({
      chainId: VECTOR.chainId,
      vault: VECTOR.vault,
      agent: VECTOR.agent,
      proposalHash: VECTOR.proposalHash,
      policyHash: VECTOR.policyHash,
      outcome: 0,
      reasonCode: 0,
      blockChecked: VECTOR.blockChecked,
      logRef: VECTOR.logRef,
      actionHash: actionHash(action),
    });
    expect(digest).toBe(VECTOR.expectedDigest);
  });
});

describe('verdict digest — what it binds', () => {
  const base = () => ({
    chainId: VECTOR.chainId,
    vault: VECTOR.vault,
    agent: VECTOR.agent,
    proposalHash: VECTOR.proposalHash,
    policyHash: VECTOR.policyHash,
    outcome: 0,
    reasonCode: 0,
    blockChecked: VECTOR.blockChecked,
    logRef: VECTOR.logRef,
    actionHash: actionHash(encodeTransferAction(VECTOR.target, VECTOR.valueUSDC)),
  });

  it('changes when the amount changes', () => {
    const other = {
      ...base(),
      actionHash: actionHash(encodeTransferAction(VECTOR.target, VECTOR.valueUSDC + 1n)),
    };
    expect(verdictDigest(other)).not.toBe(VECTOR.expectedDigest);
  });

  it('changes when the recipient changes', () => {
    const other = {
      ...base(),
      actionHash: actionHash(
        encodeTransferAction('0x00000000000000000000000000000000000000ff', VECTOR.valueUSDC),
      ),
    };
    expect(verdictDigest(other)).not.toBe(VECTOR.expectedDigest);
  });

  it('changes when the settling agent changes', () => {
    expect(
      verdictDigest({ ...base(), agent: '0x00000000000000000000000000000000000000ff' }),
    ).not.toBe(VECTOR.expectedDigest);
  });

  it('changes when the vault changes', () => {
    expect(
      verdictDigest({ ...base(), vault: '0x00000000000000000000000000000000000000ff' }),
    ).not.toBe(VECTOR.expectedDigest);
  });

  it('changes when the chain changes', () => {
    expect(verdictDigest({ ...base(), chainId: 1n })).not.toBe(VECTOR.expectedDigest);
  });

  it('changes when the outcome changes', () => {
    expect(verdictDigest({ ...base(), outcome: 2 })).not.toBe(VECTOR.expectedDigest);
  });

  it('names every bound field in the typehash string', () => {
    for (const field of [
      'chainId',
      'vault',
      'agent',
      'proposalHash',
      'policyHash',
      'outcome',
      'reasonCode',
      'blockChecked',
      'logRef',
      'actionHash',
    ]) {
      expect(VERDICT_TYPEHASH_STRING).toContain(field);
    }
  });
});

describe('encodeTransferAction', () => {
  it('leaves the calldata slot empty, which is what the vault requires', () => {
    const action = encodeTransferAction(VECTOR.target, VECTOR.valueUSDC);
    // address, offset-to-bytes, value, bytes-length — four 32-byte words, and
    // the trailing length word is zero.
    expect(action.length).toBe(2 + 4 * 64);
    expect(action.endsWith('0'.repeat(64))).toBe(true);
  });

  it('never loses precision on large amounts', () => {
    const big = 123_456_789_012_345n;
    const action = encodeTransferAction(VECTOR.target, big);
    expect(action.includes(big.toString(16))).toBe(true);
  });
});
