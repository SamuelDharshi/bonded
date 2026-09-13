'use client';

import { Gate } from '../../../components/console/owner/Gate';
import { AgentsPanel } from '../../../components/console/owner/AgentsPanel';

/** /app/agents — who may spend, and revoking who may not. */
export default function AgentsPage() {
  return (
    <>
      <div>
        <h1 className="text-h1 text-manifest">Agents</h1>
        <p className="text-body text-manifest/60 mt-2 max-w-2xl">
          Addresses allowed to propose against your policy. Authorizing one names an address; it
          never involves its key.
        </p>
      </div>

      <Gate requireOnboarded={false}>
        {(state, account) => <AgentsPanel state={state} account={account} />}
      </Gate>
    </>
  );
}
