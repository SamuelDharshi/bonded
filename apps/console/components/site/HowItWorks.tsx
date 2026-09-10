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
      <p className="font-mono text-[11px] text-[#555555] tracking-[1px] leading-[1.5]">
        {description}
      </p>
    </div>
  );
}

export default function HowItWorks() {
  return (
    <section className="flex flex-col w-full bg-[#0D0D0D] py-16 px-6 md:py-[100px] md:px-[120px] gap-12 md:gap-[64px]">
      <SectionHeader
        label="[02] // The mechanism"
        title={"The model proposes.\nCode disposes."}
        subtitle="The enforcer never reads the prompt. It re-derives every premise itself, at one pinned block, and fails closed at the first disagreement."
      />

      <div className="flex flex-col md:flex-row w-full gap-[2px]">
        <StepCard
          number="01"
          title={"The agent\nproposes"}
          description="It emits an action plus the typed premises it claims justify it. No signer. No RPC. No path to the money."
        />
        <StepCard
          number="02"
          title={"The enforcer\nre-derives"}
          description="A non-generative program queries The Graph for those same facts, at one pinned block, without ever seeing the prompt."
          bgColor="#111111"
          borderColor="#FFD600"
          borderWidth={1}
        />
        <StepCard
          number="03"
          title={"Disagreement\nmeans refusal"}
          description="Claim ≠ reality, or reality misses the policy threshold — either way the vault never opens. Anything irreversible pauses for a human."
        />
      </div>
    </section>
  );
}
