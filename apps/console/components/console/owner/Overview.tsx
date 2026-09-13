'use client';

import Link from 'next/link';
import { formatUSDC } from '../../../lib/bonded/wallet';
import { Addr, Panel } from './primitives';
import { Gate } from './Gate';
import { useOwner, type OwnerState } from './OwnerProvider';

/**
 * /app — status, and the single next action.
 *
 * Not a control surface. Every write lives on its own page, so the job here is to
 * answer two questions on arrival: is anything waiting on me, and if I am not
 * finished setting up, what is the next thing. A dashboard that repeats every
 * control is the one-long-scroll problem wearing a different name.
 *
 * Ordering is by urgency, not by topic: a held payment first, because it is the
 * only item in the product where someone is waiting.
 */
export function Overview() {
  const { progress } = useOwner();

  return (
    <>
      <div>
        <h1 className="text-h1 text-manifest">Your account</h1>
        <p className="text-body text-manifest/60 mt-2 max-w-2xl">
          The authority your agents operate under: your rules, your money, your confirmation when it
          matters.
        </p>
      </div>

      <Gate>
        {(state) => (
          <div className="space-y-5">
            {!progress.done ? <SetupCallout state={state} /> : <Ready state={state} />}
            <Holdings state={state} />
          </div>
        )}
      </Gate>
    </>
  );
}

/** What is left, and one button that goes there. */
function SetupCallout({ state }: { state: OwnerState }) {
  const { progress } = useOwner();

  const items = [
    { done: progress.policyReady, label: 'Rules committed and published', href: '/app/policy' },
    { done: progress.funded, label: 'Spending money deposited', href: '/app/funds' },
    { done: progress.hasAgent, label: 'An agent authorized', href: '/app/agents' },
  ];
  const remaining = items.filter((i) => !i.done).length;

  return (
    <div className="border border-[#1E7BB8]/40 rounded-doc bg-[#1E7BB8]/5 px-5 py-5">
      <h2 className="font-mono text-small uppercase tracking-wide text-[#1E7BB8]">
        {remaining} step{remaining > 1 ? 's' : ''} to go
      </h2>
      <p className="text-body text-manifest/70 mt-2 max-w-2xl">
        Nothing can be spent until all three are true. Until then every proposal your agents make is
        refused — which is the correct answer, not a fault.
      </p>

      <ul className="mt-4 space-y-2">
        {items.map((i) => (
          <li key={i.label} className="flex items-center gap-3 text-small">
            <span
              className={`font-mono w-5 h-5 grid place-items-center rounded-full border shrink-0 ${
                i.done ? 'border-seal text-seal' : 'border-hairline text-manifest/30'
              }`}
            >
              {i.done ? '✓' : ''}
            </span>
            <span className={i.done ? 'text-manifest/50 line-through' : 'text-manifest'}>
              {i.label}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-5">
        <Link
          href="/app/start"
          className="inline-block font-mono text-small font-bold text-harbor bg-[#1E7BB8] tracking-wide px-4 py-2.5 rounded-control hover:bg-[#17618F] transition-colors"
        >
          {progress.nextStep === 0 ? 'Start setting up' : 'Continue setting up'}
        </Link>
      </div>

      <p className="text-small text-manifest/40 mt-3 font-mono">
        vault <Addr value={state.vault} />
      </p>
    </div>
  );
}

/** Set up, running. Surface only what is actionable or worth knowing. */
function Ready({ state }: { state: OwnerState }) {
  const pending = state.holds.filter((h) => h.awaitingYourConfirmation);
  const held = pending.reduce((t, h) => t + BigInt(h.valueUSDC ?? '0'), 0n);

  if (pending.length > 0) {
    return (
      <div className="border border-hold/50 rounded-doc bg-hold/5 px-5 py-5">
        <h2 className="font-mono text-small uppercase tracking-wide text-hold">
          {pending.length} payment{pending.length > 1 ? 's' : ''} waiting for you
        </h2>
        <p className="text-body text-manifest/70 mt-2 max-w-2xl">
          {formatUSDC(held)} USDC is held because it exceeds your{' '}
          {formatUSDC(state.limits.irreversibleAbove)} USDC threshold. Every claimed fact was
          re-derived and passed — the amount is what stopped it. Nothing moves until you sign.
        </p>
        <div className="mt-4">
          <Link
            href="/app/approvals"
            className="inline-block font-mono text-small font-bold text-harbor bg-[#1E7BB8] tracking-wide px-4 py-2.5 rounded-control hover:bg-[#17618F] transition-colors"
          >
            Review and confirm
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-seal/40 rounded-doc bg-seal/5 px-5 py-5">
      <h2 className="font-mono text-small uppercase tracking-wide text-seal">Running</h2>
      <p className="text-body text-manifest/70 mt-2 max-w-2xl">
        Your rules are live and nothing is waiting on you. Proposals are being judged against facts
        re-derived from The Graph; anything over {formatUSDC(state.limits.irreversibleAbove)} USDC will
        stop here for your signature.
      </p>
      <div className="mt-4">
        <Link
          href="/app/activity"
          className="inline-block font-mono text-small text-manifest/70 underline underline-offset-4 decoration-hairline hover:text-manifest transition-colors"
        >
          See what your rules evaluate to right now
        </Link>
      </div>
    </div>
  );
}

/** The numbers, with each one linking to the page that changes it. */
function Holdings({ state }: { state: OwnerState }) {
  const credited = BigInt(state.funds.creditedToYou);
  const spent = BigInt(state.limits.spentThisPeriod);
  const budget = BigInt(state.limits.budgetMax);
  const live = state.agents.filter((a) => a.authorized).length;

  const cells = [
    { label: 'credited to you', value: `${formatUSDC(credited)} USDC`, href: '/app/funds' },
    {
      label: 'spent this period',
      value: `${formatUSDC(spent)} / ${formatUSDC(budget)} USDC`,
      href: '/app/funds',
    },
    {
      label: 'confirm above',
      value: `${formatUSDC(state.limits.irreversibleAbove)} USDC`,
      href: '/app/policy',
    },
    { label: 'authorized agents', value: String(live), href: '/app/agents' },
  ];

  return (
    <Panel title="At a glance">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cells.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className="block border border-hairline rounded-control p-4 bg-deepwater hover:border-manifest/30 transition-colors"
          >
            <p className="text-small text-manifest/50">{c.label}</p>
            <p className="font-mono text-manifest mt-1 break-all">{c.value}</p>
          </Link>
        ))}
      </div>
    </Panel>
  );
}

export default Overview;
