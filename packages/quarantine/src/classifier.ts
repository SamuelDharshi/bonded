/**
 * Field classifier — tags data sources as QUARANTINED, TRUSTED, or DERIVED.
 *
 * Used by the proposer to separate observations before building the prompt.
 * Quarantined fields are shown to the model in a labelled section,
 * never concatenated raw into instruction context.
 */

export type FieldClass = 'QUARANTINED' | 'TRUSTED' | 'DERIVED';

export interface FieldDescriptor {
  /** Canonical source identifier, e.g. 'ERC-20.name()' */
  source: string;
  fieldClass: FieldClass;
  reason: string;
}

export const FIELD_REGISTRY: FieldDescriptor[] = [
  // ── QUARANTINED ────────────────────────────────────────────────────────────
  {
    source:     'ERC-20.name()',
    fieldClass: 'QUARANTINED',
    reason:     'Token deployer controls this string. Primary prompt injection vector — see AttackToken.',
  },
  {
    source:     'ERC-20.symbol()',
    fieldClass: 'QUARANTINED',
    reason:     'Token deployer controls this string.',
  },
  {
    source:     'ERC-721.tokenURI()',
    fieldClass: 'QUARANTINED',
    reason:     'NFT creator controls this URI and the JSON it resolves to.',
  },
  {
    source:     'ERC-1155.uri()',
    fieldClass: 'QUARANTINED',
    reason:     'Same as ERC-721.tokenURI().',
  },
  {
    source:     'ENS.text()',
    fieldClass: 'QUARANTINED',
    reason:     'ENS registrant controls all text record values.',
  },
  {
    source:     'DAO.proposal.description',
    fieldClass: 'QUARANTINED',
    reason:     'Proposal author controls this field. Arbitrary markdown.',
  },
  {
    source:     'subgraph.entity.name',
    fieldClass: 'QUARANTINED',
    reason:     'Protocol can set arbitrary strings in subgraph entity names.',
  },
  {
    source:     'subgraph.entity.description',
    fieldClass: 'QUARANTINED',
    reason:     'Same as above.',
  },
  {
    source:     'tx.calldata.raw',
    fieldClass: 'QUARANTINED',
    reason:     'Raw calldata bytes may contain arbitrary content.',
  },
  {
    source:     'event.data.raw',
    fieldClass: 'QUARANTINED',
    reason:     'Raw event data may contain arbitrary bytes.',
  },
  {
    source:     'ipfs.metadata',
    fieldClass: 'QUARANTINED',
    reason:     'Off-chain — full arbitrary JSON under content author control.',
  },

  // ── TRUSTED ────────────────────────────────────────────────────────────────
  {
    source:     'ERC-20.balanceOf()',
    fieldClass: 'TRUSTED',
    reason:     'uint256 — type system prevents string injection.',
  },
  {
    source:     'ERC-20.decimals()',
    fieldClass: 'TRUSTED',
    reason:     'uint8 — not a string.',
  },
  {
    source:     'ERC-20.totalSupply()',
    fieldClass: 'TRUSTED',
    reason:     'uint256 — not a string.',
  },
  {
    source:     'UniswapV3Pool.slot0()',
    fieldClass: 'TRUSTED',
    reason:     'Struct with validated numeric types.',
  },
  {
    source:     'block.timestamp',
    fieldClass: 'TRUSTED',
    reason:     'uint256 from EVM — not a string.',
  },
  {
    source:     'block.number',
    fieldClass: 'TRUSTED',
    reason:     'uint256 from EVM — not a string.',
  },
  {
    source:     'msg.sender',
    fieldClass: 'TRUSTED',
    reason:     'address validated by transaction signature.',
  },

  // ── DERIVED ────────────────────────────────────────────────────────────────
  {
    source:     'enforcer.premise.derived',
    fieldClass: 'DERIVED',
    reason:     'Computed from trusted subgraph numeric fields via BigInt arithmetic.',
  },
  {
    source:     'enforcer.budget.spent',
    fieldClass: 'DERIVED',
    reason:     'BigInt arithmetic on 6-decimal USDC amounts. Never a string passthrough.',
  },
];

// Build a lookup map for O(1) classification
const REGISTRY_MAP = new Map<string, FieldClass>(
  FIELD_REGISTRY.map((f) => [f.source, f.fieldClass]),
);

/**
 * Classify a data source.
 * Unknown sources default to QUARANTINED — fail safe.
 */
export function classify(source: string): FieldClass {
  return REGISTRY_MAP.get(source) ?? 'QUARANTINED';
}

/**
 * Returns true if the source should be quarantined from instruction context.
 * Unknown sources return true — fail safe.
 */
export function isQuarantined(source: string): boolean {
  return classify(source) === 'QUARANTINED';
}
