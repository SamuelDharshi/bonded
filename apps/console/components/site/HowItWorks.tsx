import SectionHeader from "./SectionHeader";

interface StepCardProps {
  number: string;
  title: string;
  description: string;
  bgColor?: string;
  borderColor?: string;
  borderWidth?: number;
}

function StepCard({
  number,
  title,
  description,
  bgColor = "#0A0A0A",
  borderColor = "#2D2D2D",
  borderWidth = 1,
}: StepCardProps) {
  return (
    <div
      className="flex flex-col gap-4 p-8 md:p-[40px] border w-full md:flex-1 md:h-[260px]"
      style={{ backgroundColor: bgColor, borderColor, borderWidth }}
    >
      <span className="font-grotesk text-[48px] font-bold text-[#FFD600] tracking-[-2px]">
        {number}
      </span>
      <h3 className="font-grotesk text-[20px] font-bold text-[#F5F5F0] tracking-[1px] leading-[1.2] whitespace-pre-line">
        {title}
      </h3>
      <p className="font-ibm-mono text-[11px] text-[#555555] tracking-[1px] leading-[1.5]">
        {description}
      </p>
    </div>
  );
}

export default function HowItWorks() {
  return (
    <section className="flex flex-col w-full bg-[#0D0D0D] py-16 px-6 md:py-[100px] md:px-[120px] gap-12 md:gap-[64px]">
      <SectionHeader
        label="[02] // THE MECHANISM"
        title={"THE MODEL PROPOSES.\nCODE DISPOSES."}
        subtitle="THE ENFORCER NEVER READS THE PROMPT. IT RE-DERIVES EVERY PREMISE ITSELF, AT ONE PINNED BLOCK, AND FAILS CLOSED AT THE FIRST DISAGREEMENT."
      />

      <div className="flex flex-col md:flex-row w-full gap-[2px]">
        <StepCard
          number="01"
          title={"THE AGENT\nPROPOSES"}
          description="IT EMITS AN ACTION PLUS THE TYPED PREMISES IT CLAIMS JUSTIFY IT. NO SIGNER. NO RPC. NO PATH TO THE MONEY."
        />
        <StepCard
          number="02"
          title={"THE ENFORCER\nRE-DERIVES"}
          description="A NON-GENERATIVE PROGRAM QUERIES THE GRAPH FOR THOSE SAME FACTS, AT ONE PINNED BLOCK, WITHOUT EVER SEEING THE PROMPT."
          bgColor="#111111"
          borderColor="#FFD600"
          borderWidth={1}
        />
        <StepCard
          number="03"
          title={"DISAGREEMENT\nMEANS REFUSAL"}
          description="CLAIM ≠ REALITY, OR REALITY MISSES THE POLICY THRESHOLD — EITHER WAY THE VAULT NEVER OPENS. ANYTHING IRREVERSIBLE PAUSES FOR A HUMAN."
        />
      </div>
    </section>
  );
}
