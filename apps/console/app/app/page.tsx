import { Shell } from '../../components/shared/Shell';
import { OwnerDashboard } from '../../components/console/owner/OwnerDashboard';

export const dynamic = 'force-dynamic';

/**
 * /app — the owner's console.
 *
 * Distinct from /live, /log and /policy, which show what the enforcer did. This
 * is where the human sets the authority it operates under: what the rules are,
 * how much money is behind them, which agents may spend it, and which payments
 * need a hand on them.
 *
 * Every control on this page is a transaction from the owner's own wallet. The
 * server reads and reports; it never acts. That split is the point — a backend
 * that cannot move funds does not need to be trusted not to.
 */
export default function AppPage() {
  return (
    <Shell>
      <div className="max-w-content mx-auto px-8 py-10">
        <h1 className="text-h1 text-manifest">Your account</h1>
        <p className="text-body text-manifest/60 mt-2 max-w-2xl">
          Set the authority your agents operate under. You are never asked for a private key — not
          yours and not your agent&apos;s. Authorizing an agent names an address; proving a proposal
          is a signature the agent makes with the key it already has.
        </p>

        <div className="mt-8">
          <OwnerDashboard />
        </div>
      </div>
    </Shell>
  );
}
