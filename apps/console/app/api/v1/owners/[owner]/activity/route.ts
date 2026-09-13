import { NextResponse } from 'next/server';
import { getAddress, isAddress } from 'viem';
import { loadPolicy } from '../../../../../../lib/bonded/policyStore';
import { createLiveContext, LIVE_POOL_ID } from '../../../../../../lib/bonded/graph';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/owners/:owner/activity
 *
 * Two things, both real:
 *
 *  1. Every verdict that settled for this owner's agents, from the subgraph.
 *  2. What the enforcer's premises evaluate to RIGHT NOW, re-derived from The
 *     Graph at a pinned block and compared against the owner's own committed
 *     thresholds.
 *
 * The second is what /live was trying to be. /live ran four scripted scenarios,
 * and scripted scenarios read as a mock however real the query underneath is —
 * there is no way for a reader to tell the difference. This asks the same
 * question without inventing a proposal to hang it on: here is your rule, here is
 * what the pool reports, here is whether that passes. Nothing is fabricated and
 * nothing has to be taken on trust.
 */

interface SubgraphVerdict {
  id: string;
  proposalHash: string;
  agent: string;
  outcome: number;
  reasonCode: number;
  valueUSDC: string;
  blockNumber: string;
  timestamp: string;
  transactionHash: string;
}

const OUTCOME_NAME = ['CLEARED', 'REFUSED', 'HELD_FOR_STEPUP'] as const;
const REASON_NAME: Record<number, string> = {
  0: 'OK',
  1: 'PREMISE_MISMATCH',
  2: 'PREMISE_UNRESOLVABLE',
  3: 'POLICY_FORBIDDEN_ACTION',
  4: 'BUDGET_EXCEEDED',
  5: 'STALE_POLICY',
  6: 'IRREVERSIBLE_UNCONFIRMED',
  7: 'ATTESTATION_MISSING',
};

async function verdictsFor(
  agents: string[],
): Promise<{ verdicts: SubgraphVerdict[]; error: string | null }> {
  const url = process.env.GRAPH_GATEWAY_URL;
  if (!url) return { verdicts: [], error: 'GRAPH_GATEWAY_URL not set' };
  if (agents.length === 0) return { verdicts: [], error: null };

  const list = agents.map((a) => `"${a.toLowerCase()}"`).join(', ');
  const query = `{
    verdictRecords(where: { agent_in: [${list}] }, orderBy: timestamp, orderDirection: desc, first: 50) {
      id proposalHash agent outcome reasonCode valueUSDC blockNumber timestamp transactionHash
    }
  }`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({ query }),
    });
    const json = (await res.json()) as {
      data?: { verdictRecords: SubgraphVerdict[] };
      errors?: Array<{ message: string }>;
    };
    return {
      verdicts: json.data?.verdictRecords ?? [],
      error: json.errors?.[0]?.message ?? null,
    };
  } catch (err) {
    return { verdicts: [], error: err instanceof Error ? err.message : 'subgraph unreachable' };
  }
}

/** Compare a re-derived value against a policy premise, the way the enforcer does. */
function evaluate(
  op: string,
  derived: string,
  required: string,
  nowSeconds: number,
): { passes: boolean; explanation: string } | null {
  switch (op) {
    case 'gte':
      return {
        passes: BigInt(derived) >= BigInt(required),
        explanation: `must be at least ${required}`,
      };
    case 'lte':
      return {
        passes: BigInt(derived) <= BigInt(required),
        explanation: `must be at most ${required}`,
      };
    case 'older_than': {
      const ageSeconds = BigInt(nowSeconds) - BigInt(derived);
      return {
        passes: ageSeconds >= BigInt(required),
        explanation: `must be at least ${required}s old; it is ${ageSeconds}s old`,
      };
    }
    default:
      // An op this endpoint does not model is reported as unevaluated rather
      // than guessed at. The enforcer is the authority on every op it supports.
      return null;
  }
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ owner: string }> },
): Promise<NextResponse> {
  const { owner: raw } = await params;
  if (!isAddress(raw)) {
    return NextResponse.json({ error: 'owner must be an address' }, { status: 400 });
  }
  const owner = getAddress(raw);

  const agentsParam = new URL(req.url).searchParams.get('agents') ?? '';
  const agents = agentsParam
    .split(',')
    .map((a) => a.trim())
    .filter((a) => isAddress(a));

  const { verdicts, error: subgraphError } = await verdictsFor(agents);

  // ── The live premise check ────────────────────────────────────────────────
  const lookup = await loadPolicy(owner);
  const apiKey = process.env.GRAPH_API_KEY;

  let premiseCheck:
    | {
        available: true;
        pinnedBlock: string;
        poolId: string;
        premises: Array<{
          premiseId: string;
          field: string;
          op: string;
          required: string;
          derived: string | null;
          passes: boolean | null;
          explanation: string;
        }>;
      }
    | { available: false; reason: string };

  if (lookup.status !== 'ok') {
    premiseCheck = {
      available: false,
      reason:
        lookup.status === 'not-committed'
          ? 'No policy is committed for this address, so there are no premises to check.'
          : lookup.status === 'not-published'
            ? 'A policy hash is committed but its artifact has not been published, so the premises cannot be read.'
            : 'The published artifact no longer matches the on-chain commitment, so it is not used.',
    };
  } else if (!apiKey) {
    premiseCheck = {
      available: false,
      reason:
        'GRAPH_API_KEY is not configured, so premises cannot be re-derived. Nothing is substituted for them.',
    };
  } else {
    try {
      const live = await createLiveContext(apiKey);
      const nowSeconds = Math.floor(Date.now() / 1000);

      const premises = await Promise.all(
        lookup.stored.policy.premises.map(async (p) => {
          const derived = await live.query(p.schema, p.field, { premiseId: p.id }, live.block);
          const verdict = derived === null ? null : evaluate(p.op, derived, p.value, nowSeconds);

          return {
            premiseId: p.id,
            field: p.field,
            op: p.op,
            required: p.value,
            derived,
            passes: verdict?.passes ?? null,
            explanation:
              derived === null
                ? 'could not be re-derived — the enforcer treats this as unresolvable and refuses'
                : (verdict?.explanation ?? `op '${p.op}' is not evaluated here`),
          };
        }),
      );

      premiseCheck = {
        available: true,
        pinnedBlock: live.block.toString(),
        poolId: LIVE_POOL_ID,
        premises,
      };
    } catch (err) {
      premiseCheck = {
        available: false,
        reason: `The Graph Gateway could not be reached: ${
          err instanceof Error ? err.message : 'unknown error'
        }. An unreachable fact is not an approval.`,
      };
    }
  }

  return NextResponse.json({
    owner,
    verdicts: verdicts.map((v) => ({
      proposalHash: v.proposalHash,
      agent: getAddress(v.agent),
      outcome: v.outcome,
      outcomeName: OUTCOME_NAME[v.outcome] ?? `UNKNOWN_${v.outcome}`,
      reasonCode: v.reasonCode,
      reasonName: REASON_NAME[v.reasonCode] ?? `UNKNOWN_${v.reasonCode}`,
      valueUSDC: v.valueUSDC,
      blockNumber: v.blockNumber,
      timestamp: v.timestamp,
      transactionHash: v.transactionHash,
    })),
    premiseCheck,
    subgraphError,
  });
}
