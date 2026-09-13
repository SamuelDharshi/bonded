'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useOwner } from './OwnerProvider';
import { Gate } from './Gate';
import { PolicyPanel } from './PolicyPanel';
import { FundsPanel } from './FundsPanel';
import { AgentsPanel } from './AgentsPanel';
import { formatUSDC } from '../../../lib/bonded/wallet';

/**
 * Onboarding, one step at a time.
 *
 * The first version put all four setup panels on one page. Everything was
 * technically present and nothing told you where to start — a page that shows
 * four simultaneous demands is a page that answers none of them. Here each step
 * is alone on screen, and the step you are on is decided by what is actually
 * true on-chain rather than by which button you last pressed. Reload, switch
 * accounts, come back tomorrow: it resumes where the chain says you are.
 *
 * Steps cannot be skipped forward past incomplete work, because the order is not
 * a convention. Depositing before there is a committed policy leaves money behind
 * rules nobody wrote; authorizing an agent before there are funds gives it
 * nothing to spend and produces a revert much later, far from the cause.
 */

const STEPS = [
  { key: 'policy', title: 'Write your rules', blurb: 'What your agents may do, committed by you.' },
  { key: 'funds', title: 'Add spending money', blurb: 'Credited to your address, withdrawable by you alone.' },
  { key: 'agent', title: 'Authorize an agent', blurb: 'Name an address. Never hand over a key.' },
  { key: 'done', title: 'Ready', blurb: 'Point your agent at the API.' },
] as const;

export function Wizard() {
  const { progress, state } = useOwner();
  const [step, setStep] = useState(0);

  // Follow the chain, not the clicks. When a step's work lands the wizard
  // advances on its own, so the visible step and the on-chain truth cannot drift
  // apart — which is what makes reloading or switching accounts safe.
  useEffect(() => {
    setStep(progress.nextStep >= 3 ? 3 : progress.nextStep);
  }, [progress.nextStep]);

  const completed = [progress.policyReady, progress.funded, progress.hasAgent, progress.done];

  return (
    <div className="space-y-6">
      {/* ── Progress rail ── */}
      <ol className="flex flex-wrap gap-x-2 gap-y-3">
        {STEPS.map((s, i) => {
          const isDone = completed[i];
          const isCurrent = i === step;
          const reachable = i <= progress.nextStep;

          return (
            <li key={s.key} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => reachable && setStep(i)}
                disabled={!reachable}
                aria-current={isCurrent ? 'step' : undefined}
                className={`flex items-center gap-2 px-3 py-2 rounded-control border transition-colors ${
                  isCurrent
                    ? 'border-[#1E7BB8] bg-[#1E7BB8]/5'
                    : isDone
                      ? 'border-seal/40 hover:bg-deepwater'
                      : 'border-hairline'
                } ${reachable ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}
              >
                <span
                  className={`font-mono text-small w-5 h-5 grid place-items-center rounded-full border ${
                    isDone ? 'border-seal text-seal' : isCurrent ? 'border-[#1E7BB8] text-[#1E7BB8]' : 'border-hairline text-manifest/40'
                  }`}
                >
                  {isDone ? '✓' : i + 1}
                </span>
                <span
                  className={`font-mono text-small ${
                    isCurrent ? 'text-manifest' : isDone ? 'text-manifest/70' : 'text-manifest/40'
                  }`}
                >
                  {s.title}
                </span>
              </button>
              {i < STEPS.length - 1 && (
                <span aria-hidden className="w-4 h-px bg-hairline hidden sm:block" />
              )}
            </li>
          );
        })}
      </ol>

      <p className="text-small text-manifest/50 max-w-2xl">{STEPS[step]!.blurb}</p>

      {/* ── The one step you are on ── */}
      <Gate>
        {(s, account) => (
          <div className="space-y-5">
            {step === 0 && (
              <PolicyPanel
                account={account}
                status={s.policy.status}
                onchainHash={s.policy.onchainHash}
                publishedHash={s.policy.publishedHash}
                wrongChain={false}
                busy={false}
                setBusy={() => {}}
                onChanged={() => {}}
                startOpen
              />
            )}

            {step === 1 && <FundsPanel state={s} account={account} compact />}

            {step === 2 && <AgentsPanel state={s} account={account} compact />}

            {step === 3 && <Done state={s} />}

            {/* Backwards only. Forward movement is earned by the chain, not by a
                button, so there is no "next" to press past unfinished work. */}
            {step > 0 && step < 3 && (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setStep(step - 1)}
                  className="font-mono text-small text-manifest/50 underline underline-offset-4 decoration-hairline hover:text-manifest transition-colors"
                >
                  Back
                </button>
                <span className="text-small text-manifest/40">
                  This step completes on its own once the transaction lands.
                </span>
              </div>
            )}
          </div>
        )}
      </Gate>
    </div>
  );
}

function Done({ state }: { state: ReturnType<typeof useOwner>['state'] }) {
  if (!state) return null;
  const agent = state.agents.find((a) => a.authorized)?.agent ?? '0x…';

  return (
    <div className="border border-seal/40 rounded-doc bg-seal/5 px-5 py-5">
      <h2 className="font-mono text-small uppercase tracking-wide text-seal">Ready</h2>
      <p className="text-body text-manifest/70 mt-2 max-w-2xl">
        Your rules are committed, {formatUSDC(state.funds.creditedToYou)} USDC is credited to you, and{' '}
        <span className="font-mono">
          {agent.slice(0, 6)}…{agent.slice(-4)}
        </span>{' '}
        may spend against them. Anything above{' '}
        <span className="font-mono">{formatUSDC(state.limits.irreversibleAbove)} USDC</span> will stop
        and wait for your signature.
      </p>

      <p className="text-small text-manifest/60 mt-4 max-w-2xl">
        Your agent now posts what it wants to do, plus the facts it claims justify it. Nothing else is
        needed from you — no API key, and no secret of your agent&apos;s.
      </p>

      <pre className="font-mono text-small text-manifest/70 overflow-x-auto leading-relaxed mt-3">
{`POST /api/v1/proposals
{
  "proposal": { "id": "0x…", "agent": "${agent}",
                "action": { "kind": "swap", "target": "0x…",
                            "calldata": "0x", "valueUSDC": "500000" },
                "premises": [{ "premiseId": "tvl", "claimedValue": "…" }],
                "createdAt": ${Math.floor(Date.now() / 1000)} },
  "signature": "0x…"   // EIP-191 over proposalDigest(), by the agent key
}`}
      </pre>

      <div className="flex flex-wrap items-center gap-4 mt-5">
        <Link
          href="/app"
          className="font-mono text-small font-bold text-harbor bg-[#1E7BB8] tracking-wide px-4 py-2.5 rounded-control hover:bg-[#17618F] transition-colors"
        >
          Go to your dashboard
        </Link>
        <Link
          href="/app/activity"
          className="font-mono text-small text-manifest/60 underline underline-offset-4 decoration-hairline hover:text-manifest transition-colors"
        >
          See what your rules evaluate to now
        </Link>
      </div>
    </div>
  );
}

export default Wizard;
