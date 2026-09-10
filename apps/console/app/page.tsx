import Navbar from '@/components/site/Navbar';
import Hero from '@/components/site/Hero';
import PixelDivider from '@/components/site/PixelDivider';
import Logos from '@/components/site/Logos';
import Features from '@/components/site/Features';
import HowItWorks from '@/components/site/HowItWorks';
import Stats from '@/components/site/Stats';
import Bento from '@/components/site/Bento';
import Comparison from '@/components/site/Comparison';
import AttackCompare from '@/components/site/AttackCompare';
import Showcase from '@/components/site/Showcase';
import FAQ from '@/components/site/FAQ';
import FinalCTA from '@/components/site/FinalCTA';
import Footer from '@/components/site/Footer';

import { ExplorerEvidenceStrip } from '@/components/landing/ExplorerEvidenceStrip';
import { ReceiptCounter } from '@/components/landing/ReceiptCounter';

/**
 * Landing page.
 *
 * Design and layout come from the imported site template; every word of copy
 * is Bonded's. Two sections are not static markup at all — ExplorerEvidenceStrip
 * does a live eth_call against the deployed AttackToken on Arc testnet, and
 * ReceiptCounter reads packages/attack-corpus/results.json from disk. Both
 * render honest failure/pending states rather than falling back to hardcoded
 * values, which is why this route is dynamic.
 *
 * The template's Pricing, Testimonials and fake-collaborator sections were cut
 * rather than rewritten: Bonded has no customers, no pricing and no concurrent
 * users, and inventing them would contradict the thing the project is about.
 */
export const dynamic = 'force-dynamic';

export default function Home() {
  return (
    <main className="flex flex-col w-full bg-[#0A0A0A] pt-[60px]">
      <Navbar />
      <Hero />
      <PixelDivider />
      <Logos />

      {/* [01] the three layers */}
      <Features />

      {/* [02] the mechanism, step by step */}
      <HowItWorks />

      {/* [03] real, verifiable counts */}
      <Stats />

      {/* [04] LIVE — the real deployed AttackToken, read on every request */}
      <section id="evidence" className="w-full bg-[#0A0A0A] py-16 md:py-[100px]">
        <ExplorerEvidenceStrip />
      </section>

      {/* the villain-token demo — real recordings when they exist, honest
          placeholder until then */}
      <AttackCompare />

      <PixelDivider />

      {/* [05] what actually stops the attack */}
      <Bento />

      {/* [06] vs. the alternatives */}
      <Comparison />

      {/* [07] the console screens */}
      <Showcase />

      {/* LIVE — the corpus receipt, read from results.json on every request */}
      <section className="w-full bg-[#0A0A0A] py-16 md:py-[100px]">
        <ReceiptCounter />
      </section>

      {/* [08] the hard questions */}
      <FAQ />

      <FinalCTA />
      <Footer />
    </main>
  );
}
