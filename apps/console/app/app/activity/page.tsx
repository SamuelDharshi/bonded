'use client';

import { Gate } from '../../../components/console/owner/Gate';
import { ActivityPanel } from '../../../components/console/owner/ActivityPanel';

/** /app/activity — settled verdicts, and what the rules evaluate to right now. */
export default function ActivityPage() {
  return (
    <>
      <div>
        <h1 className="text-h1 text-manifest">Activity</h1>
        <p className="text-body text-manifest/60 mt-2 max-w-2xl">
          What happened, and what your premises resolve to against live data. Nothing here is
          replayed or scripted.
        </p>
      </div>

      <Gate requireOnboarded={false}>{(state) => <ActivityPanel state={state} />}</Gate>
    </>
  );
}
