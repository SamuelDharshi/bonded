'use client';

import { Gate } from '../../../components/console/owner/Gate';
import { ApprovalsPanel } from '../../../components/console/owner/ApprovalsPanel';

/** /app/approvals — the human gate, on its own page because it is the only urgent thing here. */
export default function ApprovalsPage() {
  return (
    <>
      <div>
        <h1 className="text-h1 text-manifest">Approvals</h1>
        <p className="text-body text-manifest/60 mt-2 max-w-2xl">
          Payments held because of their size. The vault releases one only when you sign, from this
          address.
        </p>
      </div>

      <Gate requireOnboarded>
        {(state, account) => <ApprovalsPanel state={state} account={account} />}
      </Gate>
    </>
  );
}
