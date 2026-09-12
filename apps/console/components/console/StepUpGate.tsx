'use client';

import { useState } from 'react';
import { Check, ExternalLink, Loader2, Lock, ShieldCheck, X } from 'lucide-react';

/**
 * The step-up authorization gate — the one place a human is in the loop.
 *
 * Deliberately two acts, because the point is the pause between them:
 *
 *   Act 1  Submit an action above the irreversible threshold. The enforcer
 *          holds it and the gate arms on-chain. Nothing moves.
 *   Act 2  A human reads what is being asked and authorizes it. Only then
 *          can the vault execute.
 *
 * The gap between the two is the product. So the UI does not collapse them
 * into one button: act 1 ends in a visibly stopped state, the authorize
 * control does not exist until there is something to authorize, and the
 * held amount and threshold are stated in the same view as the control that
 * releases them.
 *
 * §5.4 gives the entire motion budget to the refusal stamp, so nothing here
 * animates beyond a spinner while a transaction is actually in flight.
 */

interface Step {
  n: number;
  name: string;
  ok: boolean;
  detail: string;
  artifact: string | null;
  tx?: string;
}

const EXPLORER_TX = (hash: string) => `https://testnet.arcscan.app/tx/${hash}`;

export function StepUpGate() {
  const [steps, setSteps] = useState<Step[]>([]);
  const [phase, setPhase] = useState<'idle' | 'holding' | 'held' | 'authorizing' | 'done'>('idle');
  const [proposalHash, setProposalHash] = useState<string | null>(null);
  const [disabled, setDisabled] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(body: Record<string, unknown>, onStep: (s: Step) => void) {
    const res = await fetch('/api/stepup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

    // The route refuses up front when signing is not enabled, as JSON
    // rather than a stream — surface that as guidance, not as a failure.
    if (res.status === 503) {
      const j = (await res.json()) as { reason?: string };
      setDisabled(j.reason ?? 'signing disabled');
      return;
    }
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (line.trim()) onStep(JSON.parse(line) as Step);
      }
    }
    if (buffer.trim()) onStep(JSON.parse(buffer) as Step);
  }

  async function hold() {
    setPhase('holding');
    setSteps([]);
    setError(null);
    setDisabled(null);
    setProposalHash(null);

    try {
      let armed: string | null = null;
      await run({ phase: 'hold' }, (s) => {
        setSteps((prev) => [...prev, s]);
        // The armed gate carries the proposal hash act 2 needs.
        if (s.n === 3 && s.ok && s.artifact) armed = s.artifact;
      });
      setProposalHash(armed);
      setPhase(armed ? 'held' : 'idle');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPhase('idle');
    }
  }

  async function authorize() {
    if (!proposalHash) return;
    setPhase('authorizing');
    try {
      await run({ phase: 'authorize', proposalHash }, (s) =>
        setSteps((prev) => [...prev, s]),
      );
      setPhase('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPhase('held');
    }
  }

  const busy = phase === 'holding' || phase === 'authorizing';

  return (
    <div className="mt-10 border-t border-hairline pt-8">
      <div className="flex items-start justify-between gap-6">
        <div>
          <h2 className="text-h2 text-manifest">Step-up authorization</h2>
          <p className="text-body text-manifest/60 mt-2 max-w-2xl">
            Actions above the policy&apos;s irreversible threshold are never auto-approved.
            The enforcer holds them, the vault records the hold on-chain, and nothing moves
            until a human authorizes that specific proposal. This runs the whole sequence
            against Arc testnet for real.
          </p>
        </div>

        {phase === 'idle' && (
          <button
            onClick={hold}
            className="shrink-0 flex items-center gap-2 border border-hairline rounded-control px-4 py-2 text-small font-mono text-manifest/70 hover:text-manifest hover:border-manifest/30 transition-colors"
          >
            Submit a 150 USDC transfer
          </button>
        )}
      </div>

      {disabled && (
        <div className="mt-6 border border-hold/40 rounded-control p-4 bg-hold/10">
          <p className="text-small text-hold font-medium">Signing is disabled on this server.</p>
          <p className="text-small text-manifest/60 mt-2">{disabled}</p>
        </div>
      )}

      {error && (
        <div className="mt-6 border border-stamp/40 rounded-control p-4 bg-stamp/10">
          <p className="text-small text-stamp">Step-up failed: {error}</p>
        </div>
      )}

      {steps.length > 0 && (
        <div className="mt-6 flex flex-col gap-3">
          {steps.map((step) => (
            <div key={`${step.n}-${step.name}`} className="border border-hairline rounded-control overflow-hidden">
              <div className="flex items-start gap-3 px-4 py-3">
                <span className="mt-0.5 shrink-0">
                  {step.ok ? (
                    <Check size={15} strokeWidth={2} className="text-seal" />
                  ) : (
                    <X size={15} strokeWidth={2} className="text-hold" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-small font-mono text-manifest">
                    {step.n}. {step.name}
                  </span>
                  <span className={`block text-small mt-0.5 ${step.ok ? 'text-manifest/50' : 'text-hold'}`}>
                    {step.detail}
                  </span>
                  {step.tx && (
                    <a
                      href={EXPLORER_TX(step.tx)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-small font-mono text-seal mt-2 hover:underline break-all"
                    >
                      {step.tx.slice(0, 18)}...
                      <ExternalLink size={12} strokeWidth={1.5} aria-hidden />
                    </a>
                  )}
                </span>
              </div>
              {step.artifact && (
                <pre className="document rounded-none px-4 py-3 text-small font-mono text-ink overflow-x-auto whitespace-pre-wrap break-all border-t border-hairline">
                  {step.artifact}
                </pre>
              )}
            </div>
          ))}
        </div>
      )}

      {busy && (
        <p className="flex items-center gap-2 text-small font-mono text-manifest/50 mt-4">
          <Loader2 size={14} strokeWidth={1.5} className="animate-spin" />
          {phase === 'holding' ? 'Enforcing and arming on-chain…' : 'Recording authorization on-chain…'}
        </p>
      )}

      {/* The pause. This panel exists only between the hold and the release,
          and says plainly what authorizing will do before offering to do it. */}
      {phase === 'held' && proposalHash && (
        <div className="mt-6 border-2 border-hold rounded-control p-5 bg-hold/5">
          <div className="flex items-start gap-3">
            <Lock size={18} strokeWidth={1.5} className="text-hold shrink-0 mt-0.5" aria-hidden />
            <div className="min-w-0">
              <p className="text-body text-manifest font-medium">Awaiting human authorization</p>
              <p className="text-small text-manifest/60 mt-1 max-w-2xl">
                The enforcer cleared every premise and still refused to release this on its own,
                because 150.00 USDC is above the 100.00 USDC irreversible threshold. Authorizing
                records your confirmation on-chain for this proposal hash alone — it does not
                raise the threshold, and it does not apply to any other proposal.
              </p>
              <p className="text-small font-mono text-manifest/40 mt-3 break-all">{proposalHash}</p>
            </div>
          </div>

          <button
            onClick={authorize}
            className="mt-5 flex items-center gap-2 bg-hold text-ink font-medium rounded-control px-4 py-2.5 text-small hover:opacity-90 transition-opacity"
          >
            <ShieldCheck size={16} strokeWidth={2} aria-hidden />
            Authorize this action
          </button>
        </div>
      )}

      {phase === 'done' && (
        <div className="mt-6 flex items-center justify-between gap-4">
          <p className="text-small font-mono text-seal">
            Sequence complete — every step above is a real transaction on Arc testnet.
          </p>
          <button
            onClick={hold}
            className="shrink-0 text-small font-mono text-manifest/50 hover:text-manifest transition-colors"
          >
            Run it again
          </button>
        </div>
      )}
    </div>
  );
}

export default StepUpGate;
