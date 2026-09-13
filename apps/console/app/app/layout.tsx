import type { ReactNode } from 'react';
import { Shell } from '../../components/shared/Shell';
import { OwnerProvider } from '../../components/console/owner/OwnerProvider';
import { AppNav } from '../../components/console/owner/AppNav';

export const dynamic = 'force-dynamic';

/**
 * Shell for every /app route.
 *
 * The provider lives here so owner state survives navigation between the
 * management pages — moving from Funds to Agents should not re-read the chain, and
 * an action on one page should be reflected on the next without a reload.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <Shell>
      <OwnerProvider>
        <div className="max-w-content mx-auto px-8 py-10">
          <AppNav />
          <div className="mt-8 space-y-5">{children}</div>
        </div>
      </OwnerProvider>
    </Shell>
  );
}
