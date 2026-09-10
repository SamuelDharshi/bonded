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
 * The authority-layer status that lived in the sidebar's footer is kept below
 * the bar. It reports something true and load-bearing — Chainlink CRE is not
 * deployed — and losing a caveat this project states carefully would be the
 * worst possible casualty of a layout change. It stays on the console routes
 * only, which is where it was and where it is relevant.
 */
export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />

      {/* pt-[60px] clears the fixed bar. */}
      <div className="flex min-w-0 flex-1 flex-col pt-[60px]">
        <div className="flex items-center gap-2 border-b border-hairline bg-deepwater px-6 py-2 md:px-12">
          <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-hold" />
          <span className="font-mono text-[11px] tracking-[0.5px] text-[#52738D]">
            Authority layer — Chainlink CRE not deployed
          </span>
        </div>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
