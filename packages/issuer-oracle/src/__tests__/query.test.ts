import { SCHEMA_ISSUER_ORACLE_ECOMM, SCHEMA_ISSUER_ORACLE_TICKETS } from '@bonded/seam';
import { createIssuerOracleQueryFn } from '../query.js';

const query = createIssuerOracleQueryFn();
const AT_BLOCK = 0n;

describe('ticket truth', () => {
  it('returns face value as a 6-decimal string, not a number', async () => {
    const v = await query(
      SCHEMA_ISSUER_ORACLE_TICKETS,
      'ticket.faceValueUSD',
      { eventId: 'evt-tokyo-showcase' },
      AT_BLOCK,
    );
    expect(v).toBe('45000000');
    expect(typeof v).toBe('string');
  });

  it('reports a cancelled event', async () => {
    expect(
      await query(
        SCHEMA_ISSUER_ORACLE_TICKETS,
        'ticket.status',
        { eventId: 'evt-kyoto-cancelled' },
        AT_BLOCK,
      ),
    ).toBe('cancelled');
  });

  it('answers seller authorisation both ways', async () => {
    const authorized = await query(
      SCHEMA_ISSUER_ORACLE_TICKETS,
      'ticket.sellerAuthorized',
      { eventId: 'evt-tokyo-showcase', seller: 'resale-verified-1' },
      AT_BLOCK,
    );
    const scalper = await query(
      SCHEMA_ISSUER_ORACLE_TICKETS,
      'ticket.sellerAuthorized',
      { eventId: 'evt-tokyo-showcase', seller: 'scalper-unknown' },
      AT_BLOCK,
    );
    expect(authorized).toBe('true');
    expect(scalper).toBe('false');
  });
});

describe('e-commerce truth', () => {
  it('returns the merchant price, which the bait-and-switch page contradicts', async () => {
    expect(
      await query(
        SCHEMA_ISSUER_ORACLE_ECOMM,
        'product.listedPriceUSD',
        { sku: 'sku-headphones-x' },
        AT_BLOCK,
      ),
    ).toBe('120000000');
  });

  it('reports stock as a string boolean', async () => {
    expect(
      await query(SCHEMA_ISSUER_ORACLE_ECOMM, 'product.inStock', { sku: 'sku-console-y' }, AT_BLOCK),
    ).toBe('false');
  });
});

/**
 * Everything here must resolve to null rather than throw.
 *
 * This is the fail-closed contract, and it is the one property the whole design
 * rests on: an unresolvable premise has to reach the enforcer as null so it
 * refuses with PREMISE_UNRESOLVABLE. A thrown error would escape that path and
 * surface as a 500 — at which point silence has stopped being a refusal.
 */
describe('unresolvable inputs return null, never throw', () => {
  const cases: Array<[string, Parameters<typeof query>]> = [
    ['unknown event', [SCHEMA_ISSUER_ORACLE_TICKETS, 'ticket.faceValueUSD', { eventId: 'nope' }, AT_BLOCK]],
    ['missing eventId', [SCHEMA_ISSUER_ORACLE_TICKETS, 'ticket.faceValueUSD', {}, AT_BLOCK]],
    [
      'seller check with no seller',
      [SCHEMA_ISSUER_ORACLE_TICKETS, 'ticket.sellerAuthorized', { eventId: 'evt-tokyo-showcase' }, AT_BLOCK],
    ],
    ['unknown field', [SCHEMA_ISSUER_ORACLE_TICKETS, 'ticket.nonsense', { eventId: 'evt-tokyo-showcase' }, AT_BLOCK]],
    ['unknown sku', [SCHEMA_ISSUER_ORACLE_ECOMM, 'product.listedPriceUSD', { sku: 'nope' }, AT_BLOCK]],
    ['a schema this adapter does not serve', ['messari-dex-amm', 'liquidityPool.totalValueLockedUSD', {}, AT_BLOCK]],
  ];

  it.each(cases)('%s', async (_label, args) => {
    await expect(query(...args)).resolves.toBeNull();
  });
});

describe('money discipline', () => {
  it('never returns a value containing a decimal point', async () => {
    for (const [schema, field, params] of [
      [SCHEMA_ISSUER_ORACLE_TICKETS, 'ticket.faceValueUSD', { eventId: 'evt-osaka-night' }],
      [SCHEMA_ISSUER_ORACLE_ECOMM, 'product.listedPriceUSD', { sku: 'sku-lens-z' }],
    ] as const) {
      const v = await query(schema, field, params as Record<string, string>, AT_BLOCK);
      expect(v).not.toBeNull();
      // A '.' here would mean a float leaked onto the money path, which the
      // compiler's fixed-point rules exist to prevent.
      expect(v!).not.toContain('.');
      expect(v!).toMatch(/^\d+$/);
    }
  });
});
