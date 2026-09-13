import Navbar from '../site/Navbar';

/**
 * Console chrome. Wraps /live, /log, /policy, /corpus and /architecture.
 *
 * These pages used to carry their own 240px sidebar, then their own top bar —
 * either way, a second navigation with a different link set from the landing
 * page's. That made them read as a separate app you had been dropped into
 * rather than pages of this site. They now share the landing page's Navbar, so
 * the header is continuous across every route and the console is reachable
 * from the marketing page and back again without the chrome changing under
 * you.
 *
 * The Footer is deliberately NOT shared. The landing page's closing block —
 * three columns of links, social buttons, the glyph-globe backdrop — is
 * marketing furniture, and under a live proposal stream or a decision log it
 * is a long tail of nothing to do with the task. Navigation is what needed to
 * be continuous here; the sign-off did not. Every link the footer carried is
 * in the navbar anyway.
 *
 * This is a server component: nothing here needs state any more. Navbar owns
 * the scroll and active-route behaviour and marks itself 'use client'.
 *
 * There used to be a status strip below the bar reading "Authority layer —
 * Chainlink CRE not deployed". It was kept deliberately while it was true, so a
 * layout change could not quietly drop a caveat the project states carefully.
 * It is gone because the statement is now false: the workflow is deployed and
 * ACTIVE, and the enforcer calls it on every proposal over the threshold.
 *
 * The remaining nuance — that Chainlink's enclave DON is not yet provisioned, so
 * the verdict falls back to the policy artifact — is reported where it can be
 * acted on: per-response in `evidence.thresholdPath`, and on /architecture with
 * the rest of the layer statuses. A persistent banner on every console page was
 * the wrong place for it even when it was accurate.
 */
export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />

      {/* pt-[60px] clears the fixed bar. */}
      <div className="flex min-w-0 flex-1 flex-col pt-[60px]">
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
