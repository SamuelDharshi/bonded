/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  THE ONE DELIBERATELY CONTROLLED DATA SOURCE IN THIS PROJECT.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Read this before using anything in this package.
 *
 * There is no universal, hackathon-accessible API for primary-ticket-issuer
 * truth. No public endpoint answers "what is the real face value of this event,
 * is it still scheduled, and is this seller authorised to sell it". So this is a
 * **controlled reference service seeded with known data**, standing in for what
 * a production integration with a real issuer's inventory API would provide.
 *
 * We would rather say that plainly than dress a fixture up as a live feed.
 *
 * What is real, and what is not:
 *
 *   NOT real   the ticket truth below. These records are written by us.
 *   Real       everything downstream of them. The enforcer re-derives against
 *              this source without knowing it is a fixture, compares by the
 *              same tolerance rules, and refuses on mismatch identically to how
 *              it refuses against a live Graph query.
 *   Real       the payment-risk half of the truth check, which runs live
 *              against Intercepta and has no fixture anywhere on its path.
 *
 * Isolated in its own file on purpose, so the honesty question has a one-file
 * answer: this file is the fixture, and nothing else in the repository is.
 *
 * A production version replaces `TRUTH` with a call to a real issuer's API. The
 * `QueryFn` signature, the `Premise` shape and `enforce()` do not change when
 * that swap happens — which is the point worth making about the architecture,
 * and is why the fixture being a fixture does not weaken the mechanism.
 */

export interface TicketTruth {
  eventId: string;
  /** 6-decimal fixed point, per the seam's money discipline. Never a float. */
  faceValueUSD: string;
  status: 'scheduled' | 'cancelled' | 'postponed';
  /** Allowlist: the primary issuer plus verified resale partners only. */
  authorizedSellers: string[];
  /** Human-readable, for the console. Never used in a comparison. */
  displayName: string;
}

/**
 * Seeded to cover every refusal reason the demo needs to show, plus one honest
 * case. Each exists so a specific branch of `enforce()` is reachable against
 * real data rather than only in a unit test.
 */
const TRUTH: Record<string, TicketTruth> = {
  // The demo's main event. Face value $45.00; the scalper page lists $89.00.
  'evt-tokyo-showcase': {
    eventId: 'evt-tokyo-showcase',
    displayName: 'Tokyo Showcase — Main Hall',
    faceValueUSD: '45000000',
    status: 'scheduled',
    authorizedSellers: ['issuer-primary', 'resale-verified-1'],
  },

  // Price drift: genuinely repriced by the issuer. Exists so "claimed differs
  // from derived" is not automatically fraud — a policy's tolerance band has to
  // absorb honest movement, and a demo that only shows fraud never proves that.
  'evt-osaka-night': {
    eventId: 'evt-osaka-night',
    displayName: 'Osaka Night — Second Stage',
    faceValueUSD: '62500000',
    status: 'scheduled',
    authorizedSellers: ['issuer-primary'],
  },

  // Cancelled: the item is not purchasable at any price from any seller. Tests
  // the premise that is not about money at all.
  'evt-kyoto-cancelled': {
    eventId: 'evt-kyoto-cancelled',
    displayName: 'Kyoto Evening — CANCELLED',
    faceValueUSD: '38000000',
    status: 'cancelled',
    authorizedSellers: ['issuer-primary'],
  },

  // Correct price, real event, unauthorised seller. The case that proves price
  // agreement alone is not sufficient — the seller allowlist is a separate
  // premise and refuses on its own.
  'evt-nagoya-resale': {
    eventId: 'evt-nagoya-resale',
    displayName: 'Nagoya Matinee — Balcony',
    faceValueUSD: '29000000',
    status: 'scheduled',
    authorizedSellers: ['issuer-primary'],
  },
};

/** Null for an unknown event — the enforcer treats that as unresolvable and refuses. */
export async function fetchTicketTruth(eventId: string): Promise<TicketTruth | null> {
  return TRUTH[eventId] ?? null;
}

/** Every seeded event, for the console's catalogue. Not part of the enforcement path. */
export async function listTicketTruth(): Promise<TicketTruth[]> {
  return Object.values(TRUTH);
}

/**
 * Stated where a reader will meet it, not only in a threat model they may not
 * open. The console renders this next to any verdict decided by this schema.
 */
export const ISSUER_ORACLE_DISCLOSURE =
  'Ticket truth comes from a controlled reference service we run, seeded with known data. ' +
  'There is no universal primary-issuer API a hackathon team can call, so rather than ' +
  'present a fixture as a live feed we are saying what it is. Everything downstream — the ' +
  're-derivation, the comparison, the refusal — behaves identically to a production ' +
  'integration, and the payment-risk half of the check runs live against Intercepta with no ' +
  'fixture on its path.';
