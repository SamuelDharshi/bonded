'use client';

import { Gate } from '../../../components/console/owner/Gate';
import { FundsPanel } from '../../../components/console/owner/FundsPanel';

/** /app/funds — deposits, withdrawals, and what the week has used. */
export default function FundsPage() {
  return (
    <>
      <div>
        <h1 className="text-h1 text-manifest">Funds</h1>
        <p className="text-body text-manifest/60 mt-2 max-w-2xl">
          Money your agents can spend against your rules. Credited to your address, and withdrawable
          only by it.
        </p>
      </div>

      <Gate requireOnboarded={false}>
        {(state, account) => <FundsPanel state={state} account={account} />}
      </Gate>
    </>
  );
}
