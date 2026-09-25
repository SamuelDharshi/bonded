/**
 * The premise schema vocabulary.
 *
 * A `PolicyPremise.schema` is a plain string, and deliberately so: the enforcer
 * never switches on it. It passes the schema and field straight to the injected
 * `QueryFn` and compares whatever comes back. That is why moving Bonded from
 * DeFi to commerce required **no change to the enforcer at all** — not a new
 * dispatch case, not a new branch. The adapter behind the function changed; the
 * function's shape did not.
 *
 * These constants exist so the vocabulary is declared in one place rather than
 * spelled out as string literals across policies, adapters and tests, where a
 * typo would silently produce PREMISE_UNRESOLVABLE — a refusal, so fail-closed
 * and safe, but for the wrong reason and hard to trace.
 *
 * Nothing here is required by the type system. A `QueryFn` may serve any schema
 * string it recognises; this is documentation the compiler can check.
 */

// ─── DeFi (ETHOnline: The Graph · Arc · Chainlink CRE) ──────────────────────

/**
 * Messari standardized DEX-AMM subgraphs, read through The Graph's
 * decentralised Gateway. One definition resolves across any DEX-AMM protocol,
 * which is what makes a policy portable between them.
 */
export const SCHEMA_MESSARI_DEX_AMM = 'messari-dex-amm' as const;

// ─── Commerce (ETHGlobal Tokyo: Intercepta · World · Sui) ───────────────────

/**
 * Payment and counterparty risk, from Intercepta's live API.
 *
 * Screens the payment itself rather than the item: is the recipient sanctioned
 * or scam-exposed, is the token a lookalike of the one intended. Never cached —
 * a stale risk verdict is a correctness bug, not a latency saving, and the same
 * `cache: 'no-store'` rule that governs the Graph path governs this one.
 */
export const SCHEMA_INTERCEPTA_RISK = 'intercepta-risk' as const;

/**
 * Item truth for ticketing: face value, event status, authorised sellers.
 *
 * Served by a disclosed reference oracle. There is no universal primary-issuer
 * API a hackathon team can call, and this project does not pretend otherwise —
 * see `packages/issuer-oracle` and `docs/THREATMODEL.md`, where what it is and
 * is not is stated on the first screen rather than left to be discovered.
 */
export const SCHEMA_ISSUER_ORACLE_TICKETS = 'issuer-oracle-tickets' as const;

/**
 * Item truth for general e-commerce: listed price against the merchant's own
 * inventory, and whether the seller is authorised to sell the item at all.
 */
export const SCHEMA_ISSUER_ORACLE_ECOMM = 'issuer-oracle-ecomm' as const;

/** Every schema this repository ships an adapter for. */
export const KNOWN_SCHEMAS = [
  SCHEMA_MESSARI_DEX_AMM,
  SCHEMA_INTERCEPTA_RISK,
  SCHEMA_ISSUER_ORACLE_TICKETS,
  SCHEMA_ISSUER_ORACLE_ECOMM,
] as const;

export type KnownSchema = (typeof KNOWN_SCHEMAS)[number];

/**
 * Whether a schema string has an adapter in this repository.
 *
 * Useful when compiling a policy, where an unrecognised schema can be reported
 * as an authoring mistake. It is NOT a guard the enforcement path should use:
 * at enforcement time an unknown schema must resolve to null and refuse through
 * PREMISE_UNRESOLVABLE like any other unreachable fact, rather than throwing.
 */
export function isKnownSchema(schema: string): schema is KnownSchema {
  return (KNOWN_SCHEMAS as readonly string[]).includes(schema);
}
