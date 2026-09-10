import SectionHeader from "./SectionHeader";

export default function Bento() {
  return (
    <section className="flex flex-col w-full bg-[#0D0D0D] py-16 px-6 md:py-[100px] md:px-[120px] gap-10 md:gap-[48px]">
      <SectionHeader
        label="[05] // Capabilities"
        title={"What actually\nstops the attack."}
        titleWidth="w-full max-w-[800px]"
      />

      <div className="flex flex-col w-full gap-[2px]">
        {/* Row 1 */}
        <div className="flex flex-col md:flex-row w-full gap-[2px]">
          {/* Bento A — Yellow */}
          <div className="flex flex-col gap-5 p-8 md:p-[40px] md:h-[320px] bg-[#FFD600] w-full md:flex-1">
            <span className="font-mono text-[11px] font-bold text-[#1A1A1A] tracking-[0.5px]">[01]</span>
            <h3 className="font-grotesk text-[24px] md:text-[28px] font-bold text-[#0A0A0A] tracking-[-1px] leading-[1.1] whitespace-pre-line">
              {"Quarantine\nboundary"}
            </h3>
            <p className="font-mono text-[12px] text-[#1A1A1A] tracking-[1px] leading-[1.6]">
              Attacker-writable fields are tagged and structurally separated — never concatenated into instruction context. Unknown fields default to quarantined.
            </p>
            <div className="flex items-center justify-center h-[28px] px-[12px] bg-[#0A0A0A] w-fit">
              <span className="font-mono text-[10px] font-bold text-[#FFD600] tracking-[0.5px]">Fail-safe</span>
            </div>
          </div>

          {/* Bento B */}
          <div className="flex flex-col gap-5 p-8 md:p-[40px] md:h-[320px] bg-[#111111] border border-[#2D2D2D] w-full md:flex-1">
            <span className="font-mono text-[11px] font-bold text-[#FFD600] tracking-[0.5px]">[02]</span>
            <h3 className="font-grotesk text-[24px] md:text-[28px] font-bold text-[#F5F5F0] tracking-[-1px] leading-[1.1] whitespace-pre-line">
              {"Pinned-block\nre-derivation"}
            </h3>
            <p className="font-mono text-[12px] text-[#666666] tracking-[1px] leading-[1.6]">
              All premises for one proposal are queried at a single pinned block — not once per premise at &quot;now&quot; — so a fast-moving attacker gets no race window between checks.
            </p>
          </div>

          {/* Bento C */}
          <div className="flex flex-col gap-5 p-8 md:p-[40px] md:h-[320px] bg-[#0A0A0A] border border-[#2D2D2D] w-full md:flex-1">
            <span className="font-mono text-[11px] font-bold text-[#FFD600] tracking-[0.5px]">[03]</span>
            <h3 className="font-grotesk text-[24px] md:text-[28px] font-bold text-[#F5F5F0] tracking-[-1px] leading-[1.1] whitespace-pre-line">
              {"Confidential\nthreshold"}
            </h3>
            <p className="font-mono text-[12px] text-[#666666] tracking-[1px] leading-[1.6]">
              500+ OFFICIAL PLUGINS. REST API. WEBHOOKS. INTEGRATE WITH YOUR ENTIRE STACK.
            </p>
            <div className="flex items-center justify-center h-[28px] px-[12px] bg-[#1A1A1A] border border-[#FF6B35] w-fit">
              <span className="font-mono text-[10px] font-bold text-[#FF6B35] tracking-[0.5px]">TEE</span>
            </div>
          </div>
        </div>

        {/* Row 2 */}
        <div className="flex flex-col md:flex-row w-full gap-[2px]">
          {/* Bento D */}
          <div className="flex flex-col gap-5 p-8 md:p-[40px] md:h-[260px] bg-[#111111] border border-[#2D2D2D] w-full md:flex-1">
            <span className="font-mono text-[11px] font-bold text-[#FFD600] tracking-[0.5px]">[04]</span>
            <h3 className="font-grotesk text-[24px] md:text-[28px] font-bold text-[#F5F5F0] tracking-[-1px] leading-[1.1] whitespace-pre-line">
              {"Fail-closed\nby default"}
            </h3>
            <p className="font-mono text-[12px] text-[#666666] tracking-[1px] leading-[1.6]">
              Stale policy, unresolvable premise, failed query — every uncertain path returns REFUSED. The vault opens only on an explicit pass.
            </p>
          </div>

          {/* Bento E */}
          <div className="flex flex-col gap-5 p-8 md:p-[40px] md:h-[260px] bg-[#0F0F0F] border-2 border-[#FF6B35] w-full md:flex-1">
            <span className="font-mono text-[11px] font-bold text-[#FF6B35] tracking-[0.5px]">[05]</span>
            <h3 className="font-grotesk text-[24px] md:text-[28px] font-bold text-[#F5F5F0] tracking-[-1px] leading-[1.1] whitespace-pre-line">
              {"Human gate on\nirreversible"}
            </h3>
            <p className="font-mono text-[12px] text-[#666666] tracking-[1px] leading-[1.6]">
              Above the irreversible threshold, no autonomous signature is enough. Settlement arms a step-up gate and waits for a separate human confirmation.
            </p>
            <div className="flex items-center justify-center h-[28px] px-[12px] bg-[#1A1A1A] border border-[#FF6B35] w-fit">
              <span className="font-mono text-[10px] font-bold text-[#FF6B35] tracking-[0.5px]">Human</span>
            </div>
          </div>

          {/* Bento F */}
          <div className="flex flex-col gap-5 p-8 md:p-[40px] md:h-[260px] bg-[#0A0A0A] border border-[#2D2D2D] w-full md:flex-1">
            <span className="font-mono text-[11px] font-bold text-[#FFD600] tracking-[0.5px]">[06]</span>
            <h3 className="font-grotesk text-[24px] md:text-[28px] font-bold text-[#F5F5F0] tracking-[-1px] leading-[1.1] whitespace-pre-line">
              {"On-chain\ndecision log"}
            </h3>
            <p className="font-mono text-[12px] text-[#666666] tracking-[1px] leading-[1.6]">
              Every proposal, premise, re-derivation and verdict is emitted on Arc and indexed by our own subgraph — a decision record, not a database.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
