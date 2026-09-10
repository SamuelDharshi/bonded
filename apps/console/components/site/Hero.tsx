import Link from "next/link";

import { TypewriterHeadline } from "@/components/landing/TypewriterHeadline";

/**
 * Hero — BONDED_PRD.md §6: "headline stating the mechanism, one line of
 * subcopy", and nothing here requires a wallet.
 *
 * The Compare slider the PRD makes the centrepiece of this section is rendered
 * directly beneath it by app/page.tsx (components/site/AttackCompare), so the
 * two read as one unit. No showpiece graphic — the PRD doesn't specify one,
 * and this page is meant to contain only what it specifies.
 */
export default function Hero() {
  return (
    <section className="relative flex flex-col items-center w-full bg-[#FFFFFF] pt-16 px-6 md:pt-[100px] md:px-[120px] overflow-hidden">
      {/* Badge */}
      <div className="flex items-center justify-center gap-[8px] h-[32px] px-[12px] md:px-[16px] bg-[#E7F1FA] border-2 border-[#1E7BB8]">
        <div className="w-[8px] h-[8px] bg-[#1E7BB8] shrink-0" />
        <span className="font-mono text-[9px] md:text-[11px] font-bold text-[#1E7BB8] tracking-[0.5px] whitespace-nowrap">
          Live on Arc testnet · ETHOnline 2026
        </span>
      </div>

      <div className="h-8 md:h-[32px]" />

      {/* Headline — Geist Pixel typewriter, cycling the six taglines. One of
          them is the real on-chain injection string, shown in stamp red. */}
      <TypewriterHeadline className="max-w-[1100px]" />

      <div className="h-6 md:h-[24px]" />

      {/* One line of subcopy, per the PRD. */}
      <p className="font-mono text-[13px] md:text-[15px] text-[#52738D] tracking-[0.5px] leading-[1.6] text-center w-full max-w-[820px]">
        The model proposes and states its reasons; an enforcer that never reads
        the prompt re-derives every one of them before the money moves.
      </p>

      <div className="h-10 md:h-[48px]" />

      {/* CTAs */}
      <div className="flex flex-col sm:flex-row items-center gap-4 md:gap-[16px] w-full sm:w-auto">
        <Link
          href="/live"
          className="flex items-center justify-center w-full sm:w-[220px] h-[56px] bg-[#1E7BB8] hover:bg-[#17618F] transition-colors"
        >
          <span className="font-grotesk text-[12px] font-bold text-[#FFFFFF] tracking-[0.5px]">
            Watch it refuse
          </span>
        </Link>
        <Link
          href="/architecture"
          className="flex items-center justify-center w-full sm:w-[200px] h-[56px] bg-[#FFFFFF] border-2 border-[#B4D3E9] hover:border-[#52738D] transition-colors"
        >
          <span className="font-mono text-[12px] text-[#52738D] tracking-[0.5px]">
            Read the architecture
          </span>
        </Link>
      </div>

      <div className="h-6 md:h-[24px]" />

      <p className="font-mono text-[11px] text-[#6E8CA5] tracking-[0.5px] text-center">
        No wallet, no faucet, no signature required.
      </p>
    </section>
  );
}
