'use client';

import { useState } from 'react';
import { Shell } from '../../components/shared/Shell';
import { Play, Loader2 } from 'lucide-react';

interface PremiseRecord {
  premiseId: string;
  schema: string;
  field: string;
  op: string;
  claimedValue: string;
  derivedValue: string | null;
  toleranceBps: number;
  passed: boolean;
  blockChecked: string;
}

interface EnforceResult {
  scenario: string;
  proposal: { action: { kind: string; valueUSDC: string; target: string } };
  verdict: { outcomeName: 'CLEARED' | 'REFUSED' | 'HELD_FOR_STEPUP'; reasonCode: number; blockChecked: string };
  premises: PremiseRecord[];
  queryPath: string;
}

const SCENARIOS = [
  {
    id: 'legit',
    label: 'Legitimate swap',
    description: 'A real, well-established pool. Every premise checks out.',
  },
  {
    id: 'forbidden-action',
    label: 'Injected token — approve_unlimited',
    description: 'The attack scenario: an injected instruction drives the agent toward approve_unlimited. Forbidden outright.',
  },
  {
    id: 'tvl-lie',
    label: 'Claimed vs. real TVL disagree',
    description: 'Agent claims a 412M TVL pool; re-derivation finds 5M. Claim and reality disagree.',
  },
  {
    id: 'irreversible',
    label: 'Large, otherwise-valid transfer',
    description: 'Every premise passes, but the amount exceeds the irreversible threshold — held, not auto-approved.',
  },
] as const;

const OUTCOME_STYLES: Record<string, string> = {
  CLEARED: 'text-seal border-seal',
  REFUSED: 'text-stamp border-stamp',
  HELD_FOR_STEPUP: 'text-hold border-hold',
};

const REASON_NAMES: Record<number, string> = {
  0: 'OK',
  1: 'PREMISE_MISMATCH',
  2: 'PREMISE_UNRESOLVABLE',
  3: 'POLICY_FORBIDDEN_ACTION',
  4: 'BUDGET_EXCEEDED',
  5: 'STALE_POLICY',
  6: 'IRREVERSIBLE_UNCONFIRMED',
  7: 'ATTESTATION_MISSING',
};

export default function LivePage() {
  const [loading, setLoading] = useState<string | null>(null);
  const [result, setResult] = useState<EnforceResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(scenario: string) {
    setLoading(scenario);
    setError(null);
    try {
      const res = await fetch('/api/enforce', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ scenario }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      setResult(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setResult(null);
    } finally {
      setLoading(null);
    }
  }

  return (
    <Shell>
      <div className="max-w-content mx-auto px-8 py-10">
        <h1 className="text-h1 text-manifest">Live proposal stream</h1>
        <p className="text-body text-manifest/60 mt-2 max-w-xl">
          Each scenario below calls the real <code className="font-mono text-small">enforce()</code> from{' '}
          <code className="font-mono text-small">@bonded/enforcer</code> — the same function its own unit tests call.
          Re-derivation runs against the documented fixture path (no live Graph Gateway key configured yet).
        </p>

        <div className="grid grid-cols-2 gap-4 mt-8">
          {SCENARIOS.map((s) => (
            <button
              key={s.id}
              onClick={() => run(s.id)}
              disabled={loading !== null}
              className="text-left border border-hairline rounded-control p-4 bg-deepwater hover:border-manifest/30 transition-colors disabled:opacity-50"
            >
              <div className="flex items-center justify-between">
                <p className="text-body text-manifest font-medium">{s.label}</p>
                {loading === s.id ? (
                  <Loader2 size={16} className="animate-spin text-manifest/50" />
                ) : (
                  <Play size={16} className="text-manifest/40" strokeWidth={1.5} />
                )}
              </div>
              <p className="text-small text-manifest/50 mt-2">{s.description}</p>
            </button>
          ))}
        </div>

        {error && (
          <div className="mt-8 border border-stamp/40 rounded-control p-4 bg-stamp/10">
            <p className="text-small text-stamp">Enforcer error: {error}</p>
          </div>
        )}

        {result && (
          <div className="mt-8 document rounded-doc p-6 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-small text-ink/50">Proposal</p>
                <p className="text-body text-ink font-medium mt-1">
                  {result.proposal.action.kind} — {(Number(result.proposal.action.valueUSDC) / 1e6).toFixed(2)} USDC
                </p>
              </div>
              <span
                className={`text-small font-mono border px-3 py-1 rounded-control ${OUTCOME_STYLES[result.verdict.outcomeName]}`}
              >
                {result.verdict.outcomeName}
              </span>
            </div>

            <p className="text-small text-ink/50 mt-2 font-mono">
              reasonCode {result.verdict.reasonCode} — {REASON_NAMES[result.verdict.reasonCode]} · block{' '}
              {result.verdict.blockChecked} · {result.queryPath} path
            </p>

            <table className="w-full mt-6 text-small font-mono border-collapse">
              <thead>
                <tr className="border-b border-ink/20 text-ink/50 text-left">
                  <th className="py-2 pr-4">premise</th>
                  <th className="py-2 pr-4">claimed</th>
                  <th className="py-2 pr-4">derived</th>
                  <th className="py-2 pr-4">tolerance</th>
                  <th className="py-2">ok?</th>
                </tr>
              </thead>
              <tbody>
                {result.premises.map((p) => (
                  <tr key={p.premiseId} className="border-b border-ink/10">
                    <td className="py-2 pr-4 text-ink">{p.premiseId}</td>
                    <td className="py-2 pr-4 text-ink/70">{p.claimedValue}</td>
                    <td className="py-2 pr-4 text-ink/70">{p.derivedValue ?? 'NULL'}</td>
                    <td className="py-2 pr-4 text-ink/50">{p.toleranceBps} bps</td>
                    <td className="py-2">{p.passed ? '✓' : '✕'}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {result.verdict.outcomeName === 'REFUSED' && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-manifest/60">
                <span
                  key={result.scenario}
                  className="stamp-animate inline-block text-stamp font-sans font-semibold text-3xl border-4 border-stamp px-6 py-3"
                >
                  REFUSED
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </Shell>
  );
}
