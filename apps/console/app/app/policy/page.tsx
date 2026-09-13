'use client';

import { Gate } from '../../../components/console/owner/Gate';
import { PolicyPanel } from '../../../components/console/owner/PolicyPanel';
import { useOwner } from '../../../components/console/owner/OwnerProvider';

/** /app/policy — the rules, and changing them. */
export default function PolicyPage() {
  const { wrongChain, busy, refresh, setMessage } = useOwner();

  return (
    <>
      <div>
        <h1 className="text-h1 text-manifest">Policy</h1>
        <p className="text-body text-manifest/60 mt-2 max-w-2xl">
          What your agents may do. Committed by you, enforced against facts nobody here supplies.
        </p>
      </div>

      <Gate>
        {(state, account) => (
          <PolicyPanel
            account={account}
            status={state.policy.status}
            onchainHash={state.policy.onchainHash}
            publishedHash={state.policy.publishedHash}
            wrongChain={wrongChain}
            busy={busy !== null}
            setBusy={(b) => { if (!b) setMessage(null); }}
            onChanged={() => void refresh()}
          />
        )}
      </Gate>
    </>
  );
}
