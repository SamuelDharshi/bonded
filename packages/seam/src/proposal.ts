/**
 * How an agent proves a proposal is its own.
 *
 * The enforcer will not evaluate a proposal for an address that did not sign
 * it. That matters because the whole authority model is keyed on the agent: the
 * vault looks up `ownerOf(agent)` to decide whose policy applies and whose
 * deposit is at risk. If anyone could submit a proposal claiming to be someone
 * else's agent, they could spend that owner's budget.
 *
 * There is no API key anywhere in this flow, deliberately. The agent already
 * has a keypair — it needs one to send the settlement transaction — and the
 * owner already authorized that address on-chain. A second, weaker credential
 * handed out by a server would add an attack surface and prove less.
 *
 * Field-wise encoding rather than canonical JSON, for the same reason the
 * verdict digest uses it: JSON has ambiguities (key order, unicode escaping,
 * number formatting) that a signature scheme should not inherit.
 */

import {
  encodeAbiParameters,
  keccak256,
  stringToHex,
  type Address,
  type Hex,
} from 'viem';

export const PROPOSAL_TYPEHASH_STRING =
  'BondedProposal(uint256 chainId,address vault,address agent,bytes32 proposalId,bytes32 actionKind,address target,bytes32 calldataHash,uint256 valueUSDC,bytes32 premisesHash,uint64 createdAt)';

export const PROPOSAL_TYPEHASH: Hex = keccak256(stringToHex(PROPOSAL_TYPEHASH_STRING));

export interface ProposalDigestInput {
  chainId: bigint;
  /** The vault the agent intends to settle against. */
  vault: Address;
  agent: Address;
  /** The agent's own proposal id. */
  proposalId: Hex;
  action: {
    kind: string;
    target: Address;
    calldata: Hex;
    /** 6-decimal USDC as a decimal string. */
    valueUSDC: string;
  };
  premises: ReadonlyArray<{ premiseId: string; claimedValue: string }>;
  /** Unix seconds. Bounds how long a signature stays usable. */
  createdAt: number;
}

/**
 * Hash the premise claims in order.
 *
 * Order is significant and not sorted: the claims are a list the agent stated,
 * and reordering them is a different statement. Both the id and the claimed
 * value are hashed so a claim cannot be edited after signing.
 */
export function premisesHash(
  premises: ReadonlyArray<{ premiseId: string; claimedValue: string }>,
): Hex {
  return keccak256(
    encodeAbiParameters(
      [{ type: 'bytes32[]' }, { type: 'bytes32[]' }],
      [
        premises.map((p) => keccak256(stringToHex(p.premiseId))),
        premises.map((p) => keccak256(stringToHex(p.claimedValue))),
      ],
    ),
  );
}

/**
 * The digest an agent signs to authenticate a proposal.
 *
 * Sign it as EIP-191 — `account.signMessage({ message: { raw: digest } })` —
 * so the same key and the same wallet flow that sends the settlement can
 * produce it, with no typed-data support required.
 */
export function proposalDigest(input: ProposalDigestInput): Hex {
  return keccak256(
    encodeAbiParameters(
      [
        { type: 'bytes32' }, // PROPOSAL_TYPEHASH
        { type: 'uint256' }, // chainId
        { type: 'address' }, // vault
        { type: 'address' }, // agent
        { type: 'bytes32' }, // proposalId
        { type: 'bytes32' }, // keccak256(action.kind)
        { type: 'address' }, // action.target
        { type: 'bytes32' }, // keccak256(action.calldata)
        { type: 'uint256' }, // action.valueUSDC
        { type: 'bytes32' }, // premisesHash
        { type: 'uint64' },  // createdAt
      ],
      [
        PROPOSAL_TYPEHASH,
        input.chainId,
        input.vault,
        input.agent,
        input.proposalId,
        keccak256(stringToHex(input.action.kind)),
        input.action.target,
        keccak256(input.action.calldata),
        BigInt(input.action.valueUSDC),
        premisesHash(input.premises),
        BigInt(input.createdAt),
      ],
    ),
  );
}
