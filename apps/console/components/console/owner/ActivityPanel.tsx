'use client';

import { useCallback, useEffect, useState } from 'react';
import { formatUSDC } from '../../../lib/bonded/wallet';
import { Addr, Button, Panel, TxLink } from './primitives';
import type { OwnerState } from './OwnerProvider';

/**
 * What happened, and what the rules evaluate to right now.
 *
 * This replaces /live. That page ran four scripted scenarios against the real
 * Gateway, and a reader had no way to tell that apart from a mock — the scripting
 * was the problem, not the plumbing. Here the same check runs against the owner's
 * own committed policy with nothing invented to hang it on: your rule, what the
 * pool reports, whether that passes.
 */

interface Verdict {
  proposalHash: string;
  agent: string;
  outcome: number;
  outcomeName: string;
  reasonName: string;
  valueUSDC: string;
  blockNumber: string;
  timestamp: string;
  transactionHash: string;
}

type PremiseCheck =
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

interface ActivityData {
  verdicts: Verdict[];
  premiseCheck: PremiseCheck;
  subgraphError: string | null;
}

const OUTCOME_TONE: Record<number, string> = {
  0: 'text-seal',
  1: 'text-stamp',
  2: 'text-hold',
};

export function ActivityPanel({ state }: { state: OwnerState }) {
  const [data, setData] = useState<ActivityData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const agents = state.agents.map((a) => a.agent).join(',');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/v1/owners/${state.owner}/activity?agents=${encodeURIComponent(agents)}`,
        { cache: 'no-store' },
      );
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? `read failed (${res.status})`);
        return;
      }
      setData(body as ActivityData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'could not read activity');
    } finally {
      setLoading(false);
    }
  }, [state.owner, agents]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-5">
      <Panel
        title="What your rules say right now"
        note="Re-derived from The Graph at a pinned block, against the policy you committed. This is the same check the enforcer runs before it will sign anything — asked directly, with no proposal invented to trigger it."
      >
        {loading && !data && <p className="text-small text-manifest/40 font-mono">checking…</p>}
        {error && <p className="text-small text-stamp font-mono">{error}</p>}

        {data?.premiseCheck.available === false && (
          <p className="text-small text-hold">{data.premiseCheck.reason}</p>
        )}

        {data?.premiseCheck.available === true && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-small border-collapse">
                <thead>
                  <tr className="border-b border-hairline text-manifest/50 text-left">
                    <th className="py-2 pr-4">premise</th>
                    <th className="py-2 pr-4">your rule</th>
                    <th className="py-2 pr-4">re-derived now</th>
                    <th className="py-2">result</th>
                  </tr>
                </thead>
                <tbody className="font-mono">
                  {data.premiseCheck.premises.map((p) => (
                    <tr key={p.premiseId} className="border-b border-hairline/50">
                      <td className="py-2 pr-4 text-manifest align-top">
                        {p.premiseId}
                        <span className="block text-manifest/40">{p.field}</span>
                      </td>
                      <td className="py-2 pr-4 text-manifest/60 align-top break-all">
                        {p.explanation}
                      </td>
                      <td className="py-2 pr-4 text-manifest align-top break-all">
                        {p.derived ?? '—'}
                      </td>
                      <td className="py-2 align-top">
                        {p.passes === null ? (
                          <span className="text-hold">unresolved</span>
                        ) : p.passes ? (
                          <span className="text-seal">passes</span>
                        ) : (
                          <span className="text-stamp">fails</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-small text-manifest/40 mt-3">
              Pinned at subgraph block {data.premiseCheck.pinnedBlock}, pool{' '}
              {data.premiseCheck.poolId.slice(0, 10)}…. Every premise in one check resolves at the
              same block, so the set is internally consistent rather than several reads taken moments
              apart.
            </p>
            <div className="mt-3">
              <Button onClick={() => void load()} disabled={loading}>
                {loading ? 'Checking…' : 'Check again'}
              </Button>
            </div>
          </>
        )}
      </Panel>

      <Panel
        title="Settled verdicts"
        note="Every decision that reached the chain for your agents, read from the subgraph. A refusal settles too — it records that nothing moved and why."
      >
        {data && data.verdicts.length === 0 && (
          <p className="text-small text-manifest/50">
            Nothing settled yet. Verdicts appear here once your agent starts proposing — including
            the refusals, which are the ones worth reading.
          </p>
        )}

        {data && data.verdicts.length > 0 && (
          <div className="space-y-2">
            {data.verdicts.map((v) => (
              <div
                key={v.proposalHash}
                className="flex flex-wrap items-baseline justify-between gap-3 py-2 border-b border-hairline/50 last:border-0"
              >
                <div className="text-small">
                  <span className={`font-mono ${OUTCOME_TONE[v.outcome] ?? 'text-manifest'}`}>
                    {v.outcomeName}
                  </span>
                  <span className="text-manifest/40 font-mono ml-2">{v.reasonName}</span>
                  <span className="text-manifest/50 ml-3">
                    {v.outcome === 0
                      ? `${formatUSDC(v.valueUSDC)} USDC released`
                      : v.outcome === 1
                        ? 'no USDC moved'
                        : `${formatUSDC(v.valueUSDC)} USDC held`}
                  </span>
                  <span className="text-manifest/40 ml-3">
                    by <Addr value={v.agent} />
                  </span>
                </div>
                <span className="text-small font-mono text-manifest/40">
                  block {v.blockNumber} · <TxLink hash={v.transactionHash} />
                </span>
              </div>
            ))}
          </div>
        )}

        {data?.subgraphError && (
          <p className="text-small text-hold mt-3">
            The index reported: {data.subgraphError}. Settled verdicts may be incomplete; the chain
            remains the record.
          </p>
        )}
      </Panel>
    </div>
  );
}

export default ActivityPanel;
