'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Shell } from '../../components/shared/Shell';
import { NextStep } from '../../components/shared/NextStep';
import { StepUpGate } from '../../components/console/StepUpGate';
import { ChevronRight, Pause, Play } from 'lucide-react';

/**
 * /live — BONDED_PRD.md §6:
 *
 *   "Left rail, proposal stream, expandable premise diff per proposal. Verdict
 *    badge in `seal` / `hold` / `stamp`. Expanding a refusal plays the stamp.
 *    Ledger ring status is a persistent dot in the rail — connected, or not."
 *
 * Four things that spec asks for and the previous version did not do:
 *
 *  - A STREAM. Proposals arrive on their own and accumulate; they are not four
 *    buttons replacing one result panel.
 *  - A DIFF PER PROPOSAL, collapsed by default. Every entry in the feed keeps
 *    its own premise table — the evidence stays attached to the proposal it
 *    belongs to instead of being overwritten by the next run.
 *  - THE STAMP ON EXPAND, not on arrival. §5.4 gives the entire motion budget
 *    to this one moment, so it has to fire when the reader opens a refusal.
 *  - AUTHORITY STATUS as a persistent dot. That lives in Shell's bar, above
 *    this page, so it is visible on every console route rather than only here.
 *
 * §5.6 is explicit that the feed must NOT auto-scroll away from the reader
 * (it names Fade Content, "entry only", over Infinite Moving Cards). So new
 * entries prepend, nothing scrolls, expanded rows stay expanded as the feed
 * grows, and the stream pauses itself once the feed is full rather than
 * running forever in a background tab.
 *
 * Every entry is a real enforce() call against the live Graph Gateway. The
 * stream interval is 6s and self-limiting because each proposal costs three
 * Gateway queries (_meta, TVL, createdTimestamp) and the key has a quota.
 */

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

type Outcome = 'CLEARED' | 'REFUSED' | 'HELD_FOR_STEPUP';

interface EnforceResult {
  scenario: string;
  proposal: { id: string; action: { kind: string; valueUSDC: string; target: string } };
  verdict: { outcomeName: Outcome; reasonCode: number; blockChecked: string };
  premises: PremiseRecord[];
  queryPath: string;
  pinnedBlock: string;
  poolId: string | null;
}

/** A stream entry: one enforce() call, plus when it arrived here. */
interface Entry extends EnforceResult {
  key: string;
  at: Date;
}

const SCENARIOS = ['legit', 'forbidden-action', 'tvl-lie', 'irreversible'] as const;
type ScenarioId = (typeof SCENARIOS)[number];

const SCENARIO_LABEL: Record<ScenarioId, string> = {
  legit: 'Legitimate swap',
  'forbidden-action': 'Injected token — approve_unlimited',
  'tvl-lie': 'Claimed vs. re-derived TVL disagree',
  irreversible: 'Large, otherwise-valid transfer',
};

/** §6: verdict badge in seal / hold / stamp. */
const OUTCOME_STYLES: Record<Outcome, string> = {
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

const STREAM_INTERVAL_MS = 6000;
/** The feed stops here rather than growing without bound or burning quota. */
const FEED_LIMIT = 12;

/** USDC is 6-decimal. Never parseFloat a value — see PRD §12.6. */
function formatUSDC(raw: string): string {
  const v = BigInt(raw);
  const whole = v / 1_000_000n;
  const frac = (v % 1_000_000n).toString().padStart(6, '0').slice(0, 2);
  return `${whole.toLocaleString('en-US')}.${frac}`;
}

export default function LivePage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [streaming, setStreaming] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inFlight, setInFlight] = useState(false);

  // Which scenario comes next. A ref, not state: advancing it must not
  // re-trigger the effect that owns the interval.
  const cursor = useRef(0);

  const runOne = useCallback(async (scenario: ScenarioId) => {
    setInFlight(true);
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
      const result = (await res.json()) as EnforceResult;
      setError(null);
      setEntries((prev) =>
        [{ ...result, key: `${scenario}-${Date.now()}`, at: new Date() }, ...prev].slice(0, FEED_LIMIT),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setInFlight(false);
    }
  }, []);

  useEffect(() => {
    if (!streaming) return;

    // Full feed: stop rather than evicting entries the reader may be reading.
    if (entries.length >= FEED_LIMIT) {
      setStreaming(false);
      return;
    }

    const tick = () => {
      const scenario = SCENARIOS[cursor.current % SCENARIOS.length]!;
      cursor.current += 1;
      void runOne(scenario);
    };

    // First proposal immediately, so the page is never empty for 6 seconds.
    if (entries.length === 0) tick();

    const id = setInterval(tick, STREAM_INTERVAL_MS);
    return () => clearInterval(id);
    // entries.length is read to enforce the cap; runOne is stable.
  }, [streaming, entries.length, runOne]);

  function toggle(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <Shell>
      <div className="max-w-content mx-auto px-8 py-10">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="text-h1 text-manifest">Live proposal stream</h1>
            <p className="text-body text-manifest/60 mt-2 max-w-2xl">
              Every entry is a real <code className="font-mono text-small">enforce()</code> call from{' '}
              <code className="font-mono text-small">@bonded/enforcer</code> — the same function its own unit
              tests call. Premises are re-derived from a Messari DEX-AMM subgraph through the Graph Gateway,
              against the live Uniswap V3 WETH/USDC pool on Base, pinned to one block per proposal. Expand any
              entry to see what was claimed against what was re-derived.
            </p>
          </div>

          <button
            onClick={() => setStreaming((v) => !v)}
            className="shrink-0 flex items-center gap-2 border border-hairline rounded-control px-3 py-2 text-small font-mono text-manifest/70 hover:text-manifest hover:border-manifest/30 transition-colors"
          >
            {streaming ? <Pause size={14} strokeWidth={1.5} /> : <Play size={14} strokeWidth={1.5} />}
            {streaming ? 'Pause stream' : entries.length >= FEED_LIMIT ? 'Feed full — resume' : 'Resume stream'}
          </button>
        </div>

        <div className="flex items-center gap-3 mt-6 text-small font-mono text-manifest/40">
          <span
            className={`inline-block w-2 h-2 rounded-full ${
              error ? 'bg-stamp' : streaming ? 'bg-seal' : 'bg-hold'
            }`}
          />
          {error
            ? 'Enforcer unreachable'
            : streaming
              ? inFlight
                ? 'Re-deriving premises…'
                : `Streaming — next proposal in ${STREAM_INTERVAL_MS / 1000}s`
              : 'Stream paused'}
          <span className="text-manifest/25">·</span>
          <span>
            {entries.length}/{FEED_LIMIT} proposals
          </span>
        </div>

        {/* §6 failure state, verbatim. Says what happened and what it means for
            money; does not apologise and is not vague. */}
        {error && (
          <div className="mt-6 border border-stamp/40 rounded-control p-4 bg-stamp/10">
            <p className="text-small text-stamp font-medium">
              Enforcement is offline. All proposals are held, none are executing.
            </p>
            <p className="text-small text-manifest/60 mt-2 font-mono">{error}</p>
          </div>
        )}

        {entries.length === 0 && !error && (
          <div className="mt-8 border border-hairline rounded-control p-8 text-center">
            <p className="text-body text-manifest/50">Waiting for the first proposal.</p>
          </div>
        )}

        <div className="mt-8 flex flex-col gap-3">
          {entries.map((entry) => {
            const isOpen = expanded.has(entry.key);
            const refused = entry.verdict.outcomeName === 'REFUSED';

            return (
              <div key={entry.key} className="border border-hairline rounded-control overflow-hidden">
                <button
                  onClick={() => toggle(entry.key)}
                  aria-expanded={isOpen}
                  className="w-full flex items-center gap-4 px-4 py-3 text-left hover:bg-deepwater transition-colors"
                >
                  <ChevronRight
                    size={16}
                    strokeWidth={1.5}
                    className={`shrink-0 text-manifest/40 transition-transform ${isOpen ? 'rotate-90' : ''}`}
                  />

                  <span className="text-small font-mono text-manifest/40 shrink-0 tabular-nums">
                    {entry.at.toLocaleTimeString('en-GB')}
                  </span>

                  <span className="flex-1 min-w-0">
                    <span className="block text-body text-manifest truncate">
                      {SCENARIO_LABEL[entry.scenario as ScenarioId] ?? entry.scenario}
                    </span>
                    <span className="block text-small font-mono text-manifest/50 truncate">
                      {entry.proposal.action.kind} · {formatUSDC(entry.proposal.action.valueUSDC)} USDC
                    </span>
                  </span>

                  <span
                    className={`shrink-0 text-small font-mono border px-3 py-1 rounded-control ${OUTCOME_STYLES[entry.verdict.outcomeName]}`}
                  >
                    {entry.verdict.outcomeName}
                  </span>
                </button>

                {isOpen && (
                  <div className="relative border-t border-hairline">
                    {/* Extra right padding when refused so the stamp lands on
                        the record rather than on top of its words. */}
                    <div className={`document rounded-none p-5 ${refused ? 'pr-5 md:pr-56' : ''}`}>
                      <p className="text-small font-mono text-ink/60">
                        reasonCode {entry.verdict.reasonCode} — {REASON_NAMES[entry.verdict.reasonCode]} · block{' '}
                        {entry.verdict.blockChecked} · {entry.queryPath} path
                        {entry.poolId ? ` · pool ${entry.poolId.slice(0, 10)}…` : ''}
                      </p>

                      {entry.premises.length === 0 ? (
                        <p className="text-small text-ink/60 mt-4">
                          No premise was re-derived. This proposal was refused at the forbidden-action check,
                          before any Graph query ran — the cheapest check comes first.
                        </p>
                      ) : (
                        /* §5.6: "Claimed vs re-derived vs tolerance vs verdict.
                           Plain, dense, mono values. Do not decorate this." */
                        <table className="w-full mt-4 text-small font-mono border-collapse">
                          <thead>
                            <tr className="border-b border-ink/20 text-ink/50 text-left">
                              <th className="py-2 pr-4 font-medium">premise</th>
                              <th className="py-2 pr-4 font-medium">claimed</th>
                              <th className="py-2 pr-4 font-medium">re-derived</th>
                              <th className="py-2 pr-4 font-medium">tolerance</th>
                              <th className="py-2 font-medium">ok?</th>
                            </tr>
                          </thead>
                          <tbody>
                            {entry.premises.map((p) => (
                              <tr key={p.premiseId} className="border-b border-ink/10 align-top">
                                <td className="py-2 pr-4 text-ink">{p.premiseId}</td>
                                <td className="py-2 pr-4 text-ink/70 break-all">{p.claimedValue}</td>
                                <td className="py-2 pr-4 text-ink/70 break-all">{p.derivedValue ?? 'NULL'}</td>
                                <td className="py-2 pr-4 text-ink/50 whitespace-nowrap">{p.toleranceBps} bps</td>
                                <td className={`py-2 ${p.passed ? 'text-seal' : 'text-stamp'}`}>
                                  {p.passed ? '✓' : '✕'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>

                    {/* §5.4: the entire motion budget. Keyed on open-state so it
                        re-fires each time the reader expands the refusal, which
                        is the moment the spec gives it. Reduced motion turns it
                        into an instant opacity change — see globals.css. */}
                    {refused && (
                      <div className="absolute top-4 right-5 pointer-events-none">
                        <span
                          key={`${entry.key}-stamp`}
                          className="stamp-animate inline-block text-stamp font-sans font-semibold text-xl md:text-2xl border-4 border-stamp px-4 py-2 opacity-90"
                        >
                          REFUSED
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <StepUpGate />
        <NextStep
          lead="That is the enforcer working against a policy someone committed. Set your own and it applies to your agents, against your deposit, with your confirmation threshold."
          secondary={{ label: 'See every verdict that settled', href: '/log' }}
        />
      </div>
    </Shell>
  );
}
