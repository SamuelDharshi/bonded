import {
  SCHEMA_ISSUER_ORACLE_ECOMM,
  SCHEMA_ISSUER_ORACLE_TICKETS,
} from '@bonded/seam';
import { fetchTicketTruth } from './tickets-fixture.js';
import { fetchProductTruth } from './ecomm-fixture.js';

/**
 * A `QueryFn` over item truth.
 *
 * Shape note worth stating once, because it is the migration's central claim:
 * this is the *same* function signature `packages/standardized` implements for
 * Messari subgraphs. The enforcer takes one of these and never learns which it
 * got. Moving Bonded from DeFi to commerce therefore required no change to
 * `packages/enforcer` at all — not a new branch, not a new dispatch case. The
 * package is untouched since the `ethonline-v1` tag and its 44 tests still pass.
 *
 * Two rules inherited from the Graph adapter, for the same reasons:
 *
 *   Return a STRING or NULL, never throw. An unresolvable premise must reach
 *   the enforcer as null so it refuses with PREMISE_UNRESOLVABLE. A thrown
 *   error would escape the fail-closed path and become a 500 instead of a
 *   refusal — silence would stop being a refusal, which is the one property
 *   the whole design rests on.
 *
 *   Return fixed-point strings, never numbers. Money is 6-decimal USDC as a
 *   decimal string; booleans are 'true'/'false'; timestamps are unix seconds.
 *   Nothing on this path is a float.
 */

/** Field names this adapter answers. Anything else resolves to null. */
export const TICKET_FIELDS = [
  'ticket.faceValueUSD',
  'ticket.status',
  'ticket.sellerAuthorized',
] as const;

export const ECOMM_FIELDS = [
  'product.listedPriceUSD',
  'product.inStock',
  'product.sellerAuthorized',
] as const;

export function createIssuerOracleQueryFn() {
  return async function issuerOracleQuery(
    schema: string,
    field: string,
    params: Record<string, string>,
    _atBlock: bigint,
  ): Promise<string | null> {
    // `atBlock` is deliberately unused. It pins a chain read to one block so a
    // set of premises is internally consistent; an issuer's inventory API has
    // no block height to pin to. Rather than invent one, the parameter is
    // accepted and ignored — and the honest consequence is recorded here: two
    // premises resolved against this source a second apart could in principle
    // disagree, where two resolved against a pinned subgraph cannot.
    if (schema === SCHEMA_ISSUER_ORACLE_TICKETS) {
      const eventId = params['eventId'];
      if (!eventId) return null;

      const truth = await fetchTicketTruth(eventId);
      if (!truth) return null;

      switch (field) {
        case 'ticket.faceValueUSD':
          return truth.faceValueUSD;
        case 'ticket.status':
          return truth.status;
        case 'ticket.sellerAuthorized': {
          // Needs a second parameter, and its absence is a policy-authoring
          // mistake rather than an unknown fact. Still null: at enforcement
          // time every failure is a refusal, and a premise that cannot be
          // evaluated is exactly that.
          const seller = params['seller'];
          if (!seller) return null;
          return truth.authorizedSellers.includes(seller) ? 'true' : 'false';
        }
        default:
          return null;
      }
    }

    if (schema === SCHEMA_ISSUER_ORACLE_ECOMM) {
      const sku = params['sku'];
      if (!sku) return null;

      const truth = await fetchProductTruth(sku);
      if (!truth) return null;

      switch (field) {
        case 'product.listedPriceUSD':
          return truth.listedPriceUSD;
        case 'product.inStock':
          return truth.inStock ? 'true' : 'false';
        case 'product.sellerAuthorized': {
          const seller = params['seller'];
          if (!seller) return null;
          return truth.authorizedSellers.includes(seller) ? 'true' : 'false';
        }
        default:
          return null;
      }
    }

    // Not our schema. Null rather than throwing, so a composed QueryFn can try
    // the next adapter and an unmatched premise still refuses cleanly.
    return null;
  };
}
