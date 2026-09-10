import Navbar from '@/components/site/Navbar';
import Hero from '@/components/site/Hero';
import AttackCompare from '@/components/site/AttackCompare';
import ThreeLayers from '@/components/site/ThreeLayers';
import Logos from '@/components/site/Logos';
import Footer from '@/components/site/Footer';

import { ExplorerEvidenceStrip } from '@/components/landing/ExplorerEvidenceStrip';

/**
 * Landing page — scoped to exactly what BONDED_PRD.md §6 specifies for `/`:
 *
 *   "Hero is the `Compare` slider with the two videos, headline stating the
 *    mechanism, one line of subcopy. Below: explorer screenshot with the
 *    payload highlighted; the receipt number via `Count Up`; the three-layer
 *    summary as plain type on `hairline` rules; sponsor strip. Nothing here
 *    requires a wallet."
 *
 * Everything the imported template contributed beyond that list — features
 * grid, how-it-works steps, stats band, bento, comparison table, showcase
 * carousel, FAQ, final CTA — has been removed rather than kept, because the
 * PRD doesn't ask for it.
 *
 * ONE DELIBERATE OMISSION from the PRD's list: the receipt counter. The corpus
 * hasn't been run, so the only honest thing it can render right now is a
 * pending banner and a 0 that isn't a result — which is a poor use of the
 * landing page's most valuable space. `ReceiptCounter` is kept in
 * components/landing/ and `/corpus` still carries the full table; drop it back
 * into this page once results.json holds a real N-of-M.
 *
 * ExplorerEvidenceStrip reads live state rather than rendering static markup —
 * an eth_call against the deployed AttackToken on Arc testnet — which is why
 * this route is dynamic. It renders an honest failure state rather than
 * falling back to a hardcoded copy of the expected string.
 */
export const dynamic = 'force-dynamic';

export default function Home() {
  // No top padding, deliberately: the navbar is transparent until you scroll,
  // so the hero has to start at y=0 and run behind it. Hero's own top padding
  // keeps the badge clear of the bar.
  //
  // Background and text colour are inherited now rather than set here — the
  // whole site moved to the white + light-blue theme, so bg-harbor /
  // text-manifest on <body> already resolve to it.
  return (
    <main className="flex flex-col w-full min-h-screen">
      <Navbar />

      {/* Headline stating the mechanism + one line of subcopy */}
      <Hero />

      {/* ...and the Compare slider the PRD makes the hero's centrepiece.
          Real recordings when they exist on disk; an explicit "recording
          pending" panel until then, never fabricated video. */}
      <AttackCompare />

      {/* The payload, on a real explorer — read live on every request */}
      <ExplorerEvidenceStrip />

      {/* Three-layer summary, plain type on hairline rules */}
      <ThreeLayers />

      {/* Sponsor strip */}
      <Logos />

      <Footer />
    </main>
  );
}
