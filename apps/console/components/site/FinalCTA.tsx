"use client";

import Link from "next/link";

import GlitchText from "@/components/site/GlitchText";

export default function FinalCTA() {
  return (
    <section className="flex flex-col items-center w-full bg-[#0A0A0A] py-16 px-6 md:p-[120px] gap-10 md:gap-[48px] border-t-2 border-t-[#FFD600]">
      {/* Badge */}
      <div className="flex items-center justify-center gap-[8px] h-[32px] px-[16px] bg-[#1A1A1A] border-2 border-[#FFD600]">
        <span className="font-mono text-[11px] font-bold text-[#FFD600] tracking-[0.5px]">
          <GlitchText text="See it refuse" speed={30} />
        </span>
      </div>

      {/* Title */}
      <h2 className="font-grotesk text-[44px] md:text-[80px] font-bold text-[#F5F5F0] tracking-[-2px] leading-none text-center w-full max-w-[1000px] whitespace-pre-line">
        <GlitchText text={"The model proposes.\nIt cannot approve itself."} speed={40} delay={200} />
      </h2>

      {/* Subtitle */}
      <p className="font-mono text-[10px] md:text-[14px] text-[#666666] tracking-[0.5px] md:tracking-[0.5px] text-center text-pretty w-full max-w-[700px] px-2">
        <GlitchText text="Run the attack yourself. No wallet, no faucet, no signature required." speed={20} delay={450} />
      </p>

      {/* CTAs */}
      <div className="flex flex-col sm:flex-row items-center gap-4 md:gap-[16px] w-full sm:w-auto">
        <Link
          href="/live"
          className="flex items-center justify-center w-full sm:w-[260px] h-[64px] bg-[#FFD600] hover:bg-[#e6c200] transition-colors"
        >
          <span className="font-grotesk text-[13px] font-bold text-[#0A0A0A] tracking-[0.5px]">
            Watch it refuse
          </span>
        </Link>
        <Link
          href="/architecture"
          className="flex items-center justify-center w-full sm:w-[220px] h-[64px] bg-[#0A0A0A] border-2 border-[#3D3D3D] hover:border-[#888888] transition-colors"
        >
          <span className="font-mono text-[12px] text-[#666666] tracking-[0.5px]">
            Read the architecture
          </span>
        </Link>
      </div>
    </section>
  );
}
