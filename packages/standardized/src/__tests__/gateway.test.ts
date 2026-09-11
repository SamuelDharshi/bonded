import { buildGatewayUrl, isDeploymentId, parseUSDToScale18 } from '../gateway.js';

/**
 * These cover the two things that actually went wrong in this package, plus
 * the fixed-point conversion everything downstream depends on.
 *
 * The URL cases are not padding. Both of the bugs that kept /live on fixtures
 * were URL-construction bugs that surfaced as GraphQL errors — "invalid
 * subgraph ID" and "Type `Query` has no field `liquidityPool`" — neither of
 * which points at the URL. A wrong URL here is not a 404 you can read; it is
 * a plausible-looking error about the wrong subgraph.
 */

const BASE = 'https://gateway.thegraph.com/api';
const API_KEY = 'testkey000000000000000000000000';

/** A real deployment ID: 'Qm' + 44 base58 chars. */
const DEPLOYMENT_ID = 'QmawEzRNeDyaTgjPKb1eRrbyzxczgSHUYzvTMaMnN8jyuh';
/** A subgraph ID — shorter, no Qm prefix. */
const SUBGRAPH_ID = 'ELUcwgpm14LKPLrBRuVvPvNKHQ9HvwmtKgKSH5XNovGR';

describe('isDeploymentId', () => {
  it('recognises an IPFS CIDv0 deployment ID', () => {
    expect(isDeploymentId(DEPLOYMENT_ID)).toBe(true);
  });

  it('rejects a subgraph ID', () => {
    expect(isDeploymentId(SUBGRAPH_ID)).toBe(false);
  });

  it('rejects a Qm-prefixed string of the wrong length', () => {
    expect(isDeploymentId('Qmtooshort')).toBe(false);
    expect(isDeploymentId(`Qm${'a'.repeat(50)}`)).toBe(false);
  });

  it('rejects base58-invalid characters (0, O, I, l)', () => {
    expect(isDeploymentId(`Qm${'0'.repeat(44)}`)).toBe(false);
    expect(isDeploymentId(`Qm${'O'.repeat(44)}`)).toBe(false);
    expect(isDeploymentId(`Qm${'I'.repeat(44)}`)).toBe(false);
    expect(isDeploymentId(`Qm${'l'.repeat(44)}`)).toBe(false);
  });
});

describe('buildGatewayUrl', () => {
  it('routes a deployment ID to /deployments/id/', () => {
    const url = buildGatewayUrl({
      gatewayBaseUrl: BASE,
      apiKey: API_KEY,
      subgraphId: DEPLOYMENT_ID,
    });
    expect(url).toBe(`${BASE}/${API_KEY}/deployments/id/${DEPLOYMENT_ID}`);
  });

  it('routes a subgraph ID to /subgraphs/id/', () => {
    const url = buildGatewayUrl({
      gatewayBaseUrl: BASE,
      apiKey: API_KEY,
      subgraphId: SUBGRAPH_ID,
    });
    expect(url).toBe(`${BASE}/${API_KEY}/subgraphs/id/${SUBGRAPH_ID}`);
  });

  it('never sends a deployment ID down the subgraphs path', () => {
    // The Gateway answers this with "invalid subgraph ID", which reads as a
    // dead subgraph rather than a malformed request. Three deployments were
    // written off as stale on exactly that evidence.
    const url = buildGatewayUrl({
      gatewayBaseUrl: BASE,
      apiKey: API_KEY,
      subgraphId: DEPLOYMENT_ID,
    });
    expect(url).not.toContain('/subgraphs/id/');
  });

  it('passes a Studio dev endpoint through verbatim', () => {
    const studio = 'https://api.studio.thegraph.com/query/1758829/bonded/v0.0.2';
    const url = buildGatewayUrl({
      gatewayBaseUrl: studio,
      apiKey: API_KEY,
      subgraphId: DEPLOYMENT_ID,
    });
    expect(url).toBe(studio);
  });

  it('does not leak the api key into a Studio dev endpoint URL', () => {
    // Studio dev endpoints carry their own auth in the path. Appending the
    // key would both break the URL and put a secret somewhere it does not go.
    const studio = 'https://api.studio.thegraph.com/query/1758829/bonded/v0.0.2';
    const url = buildGatewayUrl({
      gatewayBaseUrl: studio,
      apiKey: API_KEY,
      subgraphId: SUBGRAPH_ID,
    });
    expect(url).not.toContain(API_KEY);
  });
});

describe('parseUSDToScale18', () => {
  it('scales a whole number to 18 decimals', () => {
    expect(parseUSDToScale18('1')).toBe('1000000000000000000');
  });

  it('scales a realistic Messari BigDecimal', () => {
    // The exact shape the Base subgraph returns for the demo pool.
    expect(parseUSDToScale18('125018317.3394176506271685371915027'))
      .toBe('125018317339417650627168537');
  });

  it('truncates rather than rounds beyond 18 decimals', () => {
    // Rounding up could push a value across a policy threshold it did not
    // actually cross. Fixed-point discipline: always round down.
    expect(parseUSDToScale18('0.9999999999999999999')).toBe('999999999999999999');
  });

  it('handles zero', () => {
    expect(parseUSDToScale18('0')).toBe('0');
  });

  it('never returns a decimal point or exponent', () => {
    // Downstream is BigInt(), which throws on either. A subgraph returning a
    // very large or very small number must not produce '1e+27'.
    for (const input of ['1000000000000000000000000000', '0.000000000000000001', '412000000']) {
      const out = parseUSDToScale18(input);
      expect(out).not.toMatch(/[.eE]/);
      expect(() => BigInt(out)).not.toThrow();
    }
  });
});
