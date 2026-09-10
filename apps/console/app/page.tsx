import Navbar from '@/components/site/Navbar';
import Hero from '@/components/site/Hero';
import AttackCompare from '@/components/site/AttackCompare';
import ThreeLayers from '@/components/site/ThreeLayers';
import Logos from '@/components/site/Logos';
import Footer from '@/components/site/Footer';

import { ExplorerEvidenceStrip } from '@/components/landing/ExplorerEvidenceStrip';
import { ReceiptCounter } from '@/components/landing/ReceiptCounter';

/**
 * Landing page — scoped to exactly what BONDED_PRD.md §6 specifies for `/`:
 *
 *   "Hero is the `Compare` slider with the two videos, headline stating the
 *    mechanism, one line of subcopy. Below: explorer screenshot with the
 *    payload highlighted; the receipt number via `Count Up`; the three-layer
 *    summary as plain type on `hairline` rules; sponsor strip. Nothing here
 *    requires a wallet."
 *
 * Five sections, in that order, plus nav and footer as chrome. Everything the
 * imported template contributed beyond that list — features grid, how-it-works
 * steps, stats band, bento, comparison table, showcase carousel, FAQ, final
 * CTA — has been removed rather than kept, because the PRD doesn't ask for it.
 *
 * Two of these sections read live state rather than rendering static markup,
 * which is why the route is dynamic: ExplorerEvidenceStrip does an eth_call
 * against the deployed AttackToken on Arc testnet, and ReceiptCounter reads
 * packages/attack-corpus/results.json. Both render honest failure/pending
 * states instead of falling back to hardcoded values.
 */
export const dynamic = 'force-dynamic';

export default function Home() {
  return (
    <main className="flex flex-col w-full bg-[#0A0A0A] pt-[60px]">
      <Navbar />

      {/* Headline stating the mechanism + one line of subcopy */}
      <Hero />

      {/* ...and the Compare slider the PRD makes the hero's centrepiece.
          Real recordings when they exist on disk; an explicit "recording
          pending" panel until then, never fabricated video. */}
      <AttackCompare />

      {/* The payload, on a real explorer — read live on every request */}
      <ExplorerEvidenceStrip />

      {/* The receipt number, via Count Up, straight out of results.json */}
      <ReceiptCounter />

      {/* Three-layer summary, plain type on hairline rules */}
      <ThreeLayers />

      {/* Sponsor strip */}
      <Logos />

      <Footer />
    </main>
  );
}
