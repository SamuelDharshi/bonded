'use client';

import { useState } from 'react';
import { Check, Loader2, RefreshCw, X } from 'lucide-react';

/**
 * The Multi Step Loader for policy recompilation — BONDED_PRD.md §5.6.
 *
 * Steps arrive over NDJSON from /api/policy/recompile as each one actually
 * finishes, and render the moment they arrive. There is no scripted timing
 * here: the first four steps are pure computation and land almost together,
 * the fifth is a real RPC call and lands when the chain answers. That uneven
 * pacing is the honest shape of the work, and faking a smooth cadence would
 * turn a verification tool into an animation.
 *
 * Every step shows the artifact it produced — the intent, the resolved
 * fields, the canonical JSON, the digest, and both hashes being compared —
 * because §5.6's requirement is that each step show its real artifact, not
 * that each step show a tick.
 *
 * §5.4 reserves the whole motion budget for the refusal stamp, so nothing
 * here overshoots or slides; steps appear, and the spinner is a spinner.
 */

interface Step {
  n: number;
  name: string;
  ok: boolean;
  detail: string;
  artifact: string | null;
}

export function PolicyRecompile() {
  const [steps, setSteps] = useState<Step[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function recompile() {
    setRunning(true);
    setSteps([]);
    setError(null);

    try {
      const res = await fetch('/api/policy/recompile', { method: 'POST' });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      // NDJSON: a chunk can split a line, so hold the remainder back rather
      // than JSON.parse-ing a half-written object.
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.trim()) continue;
          setSteps((prev) => [...prev, JSON.parse(line) as Step]);
        }
      }

      if (buffer.trim()) setSteps((prev) => [...prev, JSON.parse(buffer) as Step]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  }

  const failed = steps.some((s) => !s.ok);

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-small text-manifest/50">Recompile</p>
          <p className="text-small text-manifest/40 mt-1 max-w-xl">
            Re-derives the artifact from its intent and checks it still matches what
            BondedRegistry holds. Read-only — committing a new hash is a separate,
            explicit CLI step.
          </p>
        </div>
        <button
          onClick={recompile}
          disabled={running}
          className="shrink-0 flex items-center gap-2 border border-hairline rounded-control px-3 py-2 text-small font-mono text-manifest/70 hover:text-manifest hover:border-manifest/30 transition-colors disabled:opacity-50"
        >
          {running ? (
            <Loader2 size={14} strokeWidth={1.5} className="animate-spin" />
          ) : (
            <RefreshCw size={14} strokeWidth={1.5} />
          )}
          {running ? 'Recompiling…' : 'Recompile'}
        </button>
      </div>

      {error && (
        <div className="mt-4 border border-stamp/40 rounded-control p-4 bg-stamp/10">
          <p className="text-small text-stamp">Recompile failed: {error}</p>
        </div>
      )}

      {steps.length > 0 && (
        <div className="mt-5 flex flex-col gap-3">
          {steps.map((step) => (
            <div
              key={`${step.n}-${step.name}`}
              className="border border-hairline rounded-control overflow-hidden"
            >
              <div className="flex items-start gap-3 px-4 py-3">
                <span className="mt-0.5 shrink-0">
                  {step.ok ? (
                    <Check size={15} strokeWidth={2} className="text-seal" />
                  ) : (
                    <X size={15} strokeWidth={2} className="text-stamp" />
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block text-small font-mono text-manifest">
                    {step.n > 0 ? `${step.n}. ` : ''}
                    {step.name}
                  </span>
                  <span
                    className={`block text-small mt-0.5 ${step.ok ? 'text-manifest/50' : 'text-stamp'}`}
                  >
                    {step.detail}
                  </span>
                </span>
              </div>

              {step.artifact && (
                <pre className="document rounded-none px-4 py-3 text-small font-mono text-ink overflow-x-auto whitespace-pre-wrap break-all border-t border-hairline">
                  {step.artifact}
                </pre>
              )}
            </div>
          ))}

          {!running && (
            <p className={`text-small font-mono ${failed ? 'text-stamp' : 'text-seal'}`}>
              {failed
                ? 'Recompile finished with a failing step — the artifact and the chain disagree.'
                : 'Recompile clean — artifact reproduces the committed hash exactly.'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default PolicyRecompile;
