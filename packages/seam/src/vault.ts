/**
 * The on-chain settlement seam: the exact digest BondedVault verifies, and the
 * ABI needed to talk to it.
 *
 * This lives in @bonded/seam and nowhere else on purpose. The digest was
 * previously recomputed by hand in the settlement scripts and again in the
 * console route, and that duplication is precisely how a real vulnerability
 * stayed invisible: the digest omitted the action, so a signed verdict
 * authorized a decision but not a payment, and no single place was obviously
 * wrong. One definition, imported by every signer and every caller.
 *
 * Any change to VERDICT_TYPEHASH_STRING below must be made identically in
 * BondedVault.sol. contracts/test/BondedVault.t.sol recomputes the hash from
 * the literal string, so a drift fails there rather than at runtime.
 */

import {
  encodeAbiParameters,
  keccak256,
  stringToHex,
  type Address,
  type Hex,
} from 'viem';

/** Mirrors BondedVault.VERDICT_TYPEHASH. */
export const VERDICT_TYPEHASH_STRING =
  'BondedVerdict(uint256 chainId,address vault,address agent,bytes32 proposalHash,bytes32 policyHash,uint8 outcome,uint16 reasonCode,uint64 blockChecked,bytes32 logRef,bytes32 actionHash)';

export const VERDICT_TYPEHASH: Hex = keccak256(stringToHex(VERDICT_TYPEHASH_STRING));

export interface VerdictDigestInput {
  /** Chain the vault is deployed on. Binds the verdict to one network. */
  chainId: bigint;
  /** The vault address. Binds the verdict to one deployment. */
  vault: Address;
  /** The agent that will call settle(). Binds the verdict to one caller. */
  agent: Address;
  proposalHash: Hex;
  policyHash: Hex;
  /** 0 = CLEARED, 1 = REFUSED, 2 = HELD_FOR_STEPUP */
  outcome: number;
  reasonCode: number;
  blockChecked: bigint;
  logRef: Hex;
  /** keccak256 of the abi-encoded action — see encodeTransferAction. */
  actionHash: Hex;
}

/**
 * Compute the digest BondedVault.settle() recovers against.
 *
 * The result still has to be signed as EIP-191, i.e.
 * `account.signMessage({ message: { raw: digest } })`, because the contract
 * applies toEthSignedMessageHash before recovering.
 */
export function verdictDigest(input: VerdictDigestInput): Hex {
  return keccak256(
    encodeAbiParameters(
      [
        { type: 'bytes32' }, // VERDICT_TYPEHASH
        { type: 'uint256' }, // chainId
        { type: 'address' }, // vault
        { type: 'address' }, // agent
        { type: 'bytes32' }, // proposalHash
        { type: 'bytes32' }, // policyHash
        { type: 'uint8' },   // outcome
        { type: 'uint16' },  // reasonCode
        { type: 'uint64' },  // blockChecked
        { type: 'bytes32' }, // logRef
        { type: 'bytes32' }, // actionHash
      ],
      [
        VERDICT_TYPEHASH,
        input.chainId,
        input.vault,
        input.agent,
        input.proposalHash,
        input.policyHash,
        input.outcome,
        input.reasonCode,
        input.blockChecked,
        input.logRef,
        input.actionHash,
      ],
    ),
  );
}

/**
 * Encode a plain USDC transfer as the vault's `action` parameter.
 *
 * The tuple keeps its `bytes` slot for shape compatibility with the decision
 * record, but the vault rejects a non-empty value: it only performs transfers,
 * because a policy cannot reason about the effects of an arbitrary call, and a
 * zero-value call would consume no budget.
 */
export function encodeTransferAction(target: Address, valueUSDC: bigint): Hex {
  return encodeAbiParameters(
    [{ type: 'address' }, { type: 'bytes' }, { type: 'uint256' }],
    [target, '0x', valueUSDC],
  );
}

export function actionHash(action: Hex): Hex {
  return keccak256(action);
}

export const VAULT_ABI = [
  // ─── Settlement ───────────────────────────────────────────────────────────
  {
    type: 'function',
    name: 'settle',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'proposalHash', type: 'bytes32' },
      { name: 'policyHash', type: 'bytes32' },
      { name: 'outcome', type: 'uint8' },
      { name: 'reasonCode', type: 'uint16' },
      { name: 'blockChecked', type: 'uint64' },
      { name: 'logRef', type: 'bytes32' },
      { name: 'action', type: 'bytes' },
      { name: 'enforcerSig', type: 'bytes' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'confirmStepUp',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'proposalHash', type: 'bytes32' }],
    outputs: [],
  },

  // ─── Owner: funds ─────────────────────────────────────────────────────────
  {
    type: 'function',
    name: 'deposit',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'withdraw',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [],
  },

  // ─── Owner: agents and limits ─────────────────────────────────────────────
  {
    type: 'function',
    name: 'authorizeAgent',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'agent', type: 'address' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'revokeAgent',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'agent', type: 'address' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'setLimits',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'irreversibleAbove', type: 'uint256' },
      { name: 'budgetMax', type: 'uint256' },
    ],
    outputs: [],
  },

  // ─── Views ────────────────────────────────────────────────────────────────
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'ownerOf',
    stateMutability: 'view',
    inputs: [{ name: 'agent', type: 'address' }],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'effectiveLimits',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [
      { name: 'irreversibleAbove', type: 'uint256' },
      { name: 'budgetMax', type: 'uint256' },
    ],
  },
  {
    type: 'function',
    name: 'spentThisPeriod',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'enrolledSigner',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'settled',
    stateMutability: 'view',
    inputs: [{ name: 'proposalHash', type: 'bytes32' }],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'stepUpArmed',
    stateMutability: 'view',
    inputs: [{ name: 'proposalHash', type: 'bytes32' }],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'stepUpConfirmed',
    stateMutability: 'view',
    inputs: [{ name: 'proposalHash', type: 'bytes32' }],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'stepUpOwner',
    stateMutability: 'view',
    inputs: [{ name: 'proposalHash', type: 'bytes32' }],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'totalCredited',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'uncredited',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'DEFAULT_IRREVERSIBLE_ABOVE',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'DEFAULT_BUDGET_MAX',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'VERDICT_TYPEHASH',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'bytes32' }],
  },

  // ─── Events ───────────────────────────────────────────────────────────────
  {
    type: 'event',
    name: 'VerdictSettled',
    inputs: [
      { name: 'proposalHash', type: 'bytes32', indexed: true },
      { name: 'agent', type: 'address', indexed: true },
      { name: 'outcome', type: 'uint8', indexed: false },
      { name: 'reasonCode', type: 'uint16', indexed: false },
      { name: 'valueUSDC', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'StepUpArmed',
    inputs: [
      { name: 'proposalHash', type: 'bytes32', indexed: true },
      { name: 'agent', type: 'address', indexed: true },
    ],
  },
  {
    type: 'event',
    name: 'StepUpConfirmed',
    inputs: [{ name: 'proposalHash', type: 'bytes32', indexed: true }],
  },
  {
    type: 'event',
    name: 'Deposited',
    inputs: [
      { name: 'owner', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'newBalance', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'Withdrawn',
    inputs: [
      { name: 'owner', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'newBalance', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'AgentAuthorized',
    inputs: [
      { name: 'owner', type: 'address', indexed: true },
      { name: 'agent', type: 'address', indexed: true },
    ],
  },
  {
    type: 'event',
    name: 'AgentRevoked',
    inputs: [
      { name: 'owner', type: 'address', indexed: true },
      { name: 'agent', type: 'address', indexed: true },
    ],
  },
  {
    type: 'event',
    name: 'LimitsSet',
    inputs: [
      { name: 'owner', type: 'address', indexed: true },
      { name: 'irreversibleAbove', type: 'uint256', indexed: false },
      { name: 'budgetMax', type: 'uint256', indexed: false },
    ],
  },
] as const;
