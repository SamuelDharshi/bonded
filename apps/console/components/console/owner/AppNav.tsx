'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useOwner } from './OwnerProvider';

/**
 * Sub-navigation for /app.
 *
 * Management lives on separate routes rather than in one scroll, so this is what
 * tells you where you are and what still needs doing. Approvals carries a count
 * because a payment waiting on a human is the only thing here that is urgent —
 * everything else can be done whenever.
 *
 * Before onboarding finishes the management tabs are shown but muted and
 * unlinked: reachable is misleading when depositing before there is a policy, or
 * authorizing an agent before there is money, just produces a later failure.
 * The one live destination at that point is the setup itself.
 */

const tabs = [
  { label: 'Overview', href: '/app' },
  { label: 'Policy', href: '/app/policy' },
  { label: 'Funds', href: '/app/funds' },
  { label: 'Agents', href: '/app/agents' },
  { label: 'Approvals', href: '/app/approvals' },
  { label: 'Activity', href: '/app/activity' },
] as const;

export function AppNav() {
  const pathname = usePathname();
  const { state, progress, account } = useOwner();

  const pending = state?.holds.filter((h) => h.awaitingYourConfirmation).length ?? 0;
  const onboarding = account !== null && !progress.done;

  return (
    <nav className="border-b border-hairline">
      <ul className="flex flex-wrap items-center gap-x-6 gap-y-2 -mb-px">
        {tabs.map((t) => {
          const active = pathname === t.href;
          // Overview stays reachable throughout; it is where the next step is.
          const locked = onboarding && t.href !== '/app';

          const content = (
            <span className="inline-flex items-center gap-2">
              {t.label}
              {t.href === '/app/approvals' && pending > 0 && (
                <span className="font-mono text-[10px] leading-none px-1.5 py-1 rounded-full bg-hold/15 text-hold">
                  {pending}
                </span>
              )}
            </span>
          );

          return (
            <li key={t.href}>
              {locked ? (
                <span
                  title="Finish setting up first — these need a policy, funds and an agent to act on."
                  className="block font-mono text-small py-3 border-b-2 border-transparent text-manifest/25 cursor-not-allowed"
                >
                  {content}
                </span>
              ) : (
                <Link
                  href={t.href}
                  aria-current={active ? 'page' : undefined}
                  className={`block font-mono text-small py-3 border-b-2 transition-colors ${
                    active
                      ? 'border-[#1E7BB8] text-manifest'
                      : 'border-transparent text-manifest/50 hover:text-manifest'
                  }`}
                >
                  {content}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export default AppNav;
