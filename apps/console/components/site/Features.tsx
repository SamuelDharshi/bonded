import SectionHeader from "./SectionHeader";

interface FeatureCardProps {
  iconColor: string;
  title: string;
  description: string;
  tag: string;
  tagColor: string;
  bgColor?: string;
  borderColor?: string;
}

function FeatureCard({
  iconColor,
  title,
  description,
  tag,
  tagColor,
  bgColor = "#111111",
  borderColor = "#2D2D2D",
}: FeatureCardProps) {
  return (
    <div
      className="flex flex-col gap-5 p-8 md:p-[32px] border w-full md:flex-1 md:h-[320px]"
      style={{ backgroundColor: bgColor, borderColor }}
    >
      <div className="w-[40px] h-[40px] shrink-0" style={{ backgroundColor: iconColor }} />
      <h3 className="font-grotesk text-[18px] font-bold text-[#F5F5F0] tracking-[1px] leading-[1.2] whitespace-pre-line">
        {title}
      </h3>
      <p className="font-ibm-mono text-[12px] text-[#666666] tracking-[1px] leading-[1.6]">
        {description}
      </p>
      <div
        className="flex items-center justify-center h-[28px] px-[12px] bg-[#1A1A1A] border w-fit"
        style={{ borderColor: tagColor }}
      >
        <span className="font-ibm-mono text-[11px] tracking-[2px]" style={{ color: tagColor }}>
          {tag}
        </span>
      </div>
    </div>
  );
}

export default function Features() {
  return (
    <section
      id="features"
      className="flex flex-col w-full bg-[#0A0A0A] py-16 px-6 md:py-[100px] md:px-[120px] gap-12 md:gap-[64px]"
    >
      <SectionHeader
        label="[01] // THREE LAYERS"
        title={"NO SINGLE LAYER CAN\nAPPROVE A PAYMENT."}
        subtitle="TRUTH, MONEY AND AUTHORITY ARE SEPARATE SYSTEMS. THEY MEET ONLY AT A FROZEN VERDICT STRUCT."
      />

      <div className="flex flex-col md:flex-row w-full gap-[2px]">
        <FeatureCard
          iconColor="#FFD600"
          title={"TRUTH\nTHE GRAPH"}
          description="EVERY PREMISE RE-DERIVED AT THE CURRENT BLOCK VIA MESSARI STANDARDIZED SUBGRAPHS. CACHE TTL = 0. A STALE READ IS A CORRECTNESS BUG, NOT AN OPTIMISATION."
          tag="RE-DERIVE"
          tagColor="#FFD600"
          borderColor="#FFD600"
        />
        <FeatureCard
          iconColor="#FF6B35"
          title={"MONEY\nARC"}
          description="BONDEDVAULT HOLDS USDC AND RELEASES IT ONLY AGAINST A SIGNED VERDICT. USDC-NATIVE GAS — THE AGENT NEVER ACQUIRES A SECOND TOKEN TO PAY FOR ITSELF."
          tag="SETTLE"
          tagColor="#FF6B35"
          bgColor="#0F0F0F"
          borderColor="#FF6B35"
        />
        <FeatureCard
          iconColor="#F5F5F0"
          title={"AUTHORITY\nCHAINLINK CRE"}
          description="THE IRREVERSIBLE THRESHOLD IS EVALUATED INSIDE A TEE AND NEVER LEAVES IT. A THRESHOLD YOU CAN READ IS A THRESHOLD YOU CAN BINARY-SEARCH."
          tag="CONFIDENTIAL"
          tagColor="#888888"
          borderColor="#555555"
        />
      </div>
    </section>
  );
}
