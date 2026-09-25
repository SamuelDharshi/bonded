import { enforce, hashPolicy } from '@bonded/enforcer';
import {
  ReasonCode,
  SCHEMA_ISSUER_ORACLE_TICKETS,
  type Policy,
  type Proposal,
} from '@bonded/seam';
import { createIssuerOracleQueryFn } from '../query.js';

/**
 * The migration's central claim, tested rather than asserted.
 *
 * `packages/enforcer` has not been edited since the `ethonline-v1` tag. It was
 * written to re-derive DeFi premises from The Graph. Here the *same function*,
 * with no changes, judges a ticket purchase against an entirely different truth
 * source — because it never knew where facts came from. It takes a `QueryFn`
 * and compares what comes back.
 *
 * If this file passes, "the core generalises across domains" is a checkable
 * fact and not a pitch line.
 */

const TICKET_POLICY: Policy = {
  version: 1,
  budget: { asset: 'USDC', period: '7d', max: '500000000' },
  premises: [
    {
      id: 'face_value',
      schema: SCHEMA_ISSUER_ORACLE_TICKETS,
      field: 'ticket.faceValueUSD',
      op: 'lte',
      // Pay no more than $50.00 for this ticket.
      value: '50000000',
      // 2% — absorbs honest issuer repricing between the agent reading the page
      // and the enforcer checking it, without absorbing a scalper's markup.
      tolerance_bps: 200,
    },
    {
      id: 'seller_ok',
      schema: SCHEMA_ISSUER_ORACLE_TICKETS,
      field: 'ticket.sellerAuthorized',
      op: 'eq',
      value: 'true',
    },
  ],
  forbid: ['approve_unlimited', 'delegatecall', 'selfdestruct'],
  irreversible_above: '100000000',
};

const AGENT = '0x00000000000000000000000000000000000000b2' as const;

function proposal(overrides: Partial<Proposal> = {}): Proposal {
  return {
    id: `0x${'11'.repeat(32)}`,
    agent: AGENT,
    action: { kind: 'purchase', target: AGENT, calldata: '0x', valueUSDC: '45000000' },
    premises: [
      { premiseId: 'face_value', claimedValue: '45000000' },
      { premiseId: 'seller_ok', claimedValue: 'true' },
    ],
    createdAt: Math.floor(Date.now() / 1000),
    ...overrides,
  } as Proposal;
}

function ctx() {
  return {
    onchainPolicyHash: hashPolicy(TICKET_POLICY),
    currentBlock: 0n,
    currentTimestamp: Math.floor(Date.now() / 1000),
    spentThisPeriod: 0n,
  };
}

const query = createIssuerOracleQueryFn();

describe('the unmodified enforcer, judging a commerce purchase', () => {
  it('clears an honest purchase at face value from an authorised seller', async () => {
    const { verdict } = await enforce(
      proposal({
        premises: [
          { premiseId: 'face_value', claimedValue: '45000000' },
          { premiseId: 'seller_ok', claimedValue: 'true' },
        ],
      } as Partial<Proposal>),
      TICKET_POLICY,
      ctx(),
      (s, f, p, b) => query(s, f, { ...p, eventId: 'evt-tokyo-showcase', seller: 'resale-verified-1' }, b),
    );

    expect(verdict.outcome).toBe(0);
    expect(verdict.reasonCode).toBe(ReasonCode.OK);
  });

  it('refuses the scalper: claimed $89 against a re-derived face value of $45', async () => {
    const { verdict, record } = await enforce(
      proposal({
        action: { kind: 'purchase', target: AGENT, calldata: '0x', valueUSDC: '89000000' },
        premises: [
          { premiseId: 'face_value', claimedValue: '89000000' },
          { premiseId: 'seller_ok', claimedValue: 'true' },
        ],
      } as Partial<Proposal>),
      TICKET_POLICY,
      ctx(),
      (s, f, p, b) => query(s, f, { ...p, eventId: 'evt-tokyo-showcase', seller: 'scalper-unknown' }, b),
    );

    expect(verdict.outcome).toBe(1);
    expect(verdict.reasonCode).toBe(ReasonCode.PREMISE_MISMATCH);

    // The premise diff the demo puts on screen: what was claimed beside what
    // was independently re-derived.
    const faceValue = record.premises.find((p) => p.premiseId === 'face_value');
    expect(faceValue?.claimedValue).toBe('89000000');
    expect(faceValue?.derivedValue).toBe('45000000');
    expect(faceValue?.passed).toBe(false);
  });

  it('refuses an unauthorised seller even when the price is honest', async () => {
    const { verdict } = await enforce(
      proposal({
        action: { kind: 'purchase', target: AGENT, calldata: '0x', valueUSDC: '29000000' },
        premises: [
          { premiseId: 'face_value', claimedValue: '29000000' },
          { premiseId: 'seller_ok', claimedValue: 'true' },
        ],
      } as Partial<Proposal>),
      TICKET_POLICY,
      ctx(),
      (s, f, p, b) => query(s, f, { ...p, eventId: 'evt-nagoya-resale', seller: 'scalper-unknown' }, b),
    );

    // Price agreement alone is not sufficient — the allowlist refuses on its own.
    expect(verdict.outcome).toBe(1);
    expect(verdict.reasonCode).toBe(ReasonCode.PREMISE_MISMATCH);
  });

  it('refuses when the truth source cannot answer, rather than clearing', async () => {
    const { verdict } = await enforce(
      proposal(),
      TICKET_POLICY,
      ctx(),
      (s, f, p, b) => query(s, f, { ...p, eventId: 'evt-does-not-exist', seller: 'issuer-primary' }, b),
    );

    // Fail-closed: an unreachable fact is not an approval.
    expect(verdict.outcome).toBe(1);
    expect(verdict.reasonCode).toBe(ReasonCode.PREMISE_UNRESOLVABLE);
  });

  it('still refuses a forbidden action before any truth source is consulted', async () => {
    let queried = false;
    const { verdict } = await enforce(
      proposal({
        action: { kind: 'approve_unlimited', target: AGENT, calldata: '0x', valueUSDC: '1000000' },
      } as Partial<Proposal>),
      TICKET_POLICY,
      ctx(),
      async (...args) => {
        queried = true;
        return query(...args);
      },
    );

    expect(verdict.reasonCode).toBe(ReasonCode.POLICY_FORBIDDEN_ACTION);
    // The cheapest check comes first — and costs nothing.
    expect(queried).toBe(false);
  });
});
