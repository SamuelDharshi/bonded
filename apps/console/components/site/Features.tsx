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
      <p className="font-mono text-[12px] text-[#666666] tracking-[1px] leading-[1.6]">
        {description}
      </p>
      <div
        className="flex items-center justify-center h-[28px] px-[12px] bg-[#1A1A1A] border w-fit"
        style={{ borderColor: tagColor }}
      >
        <span className="font-mono text-[11px] tracking-[0.5px]" style={{ color: tagColor }}>
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
        label="[01] // Three layers"
        title={"No single layer can\napprove a payment."}
        subtitle="Truth, money and authority are separate systems. They meet only at a frozen Verdict struct."
      />

      <div className="flex flex-col md:flex-row w-full gap-[2px]">
        <FeatureCard
          iconColor="#FFD600"
          title={"Truth\nThe Graph"}
          description="Every premise re-derived at the current block via Messari standardized subgraphs. Cache TTL = 0. A stale read is a correctness bug, not an optimisation."
          tag="Re-derive"
          tagColor="#FFD600"
          borderColor="#FFD600"
        />
        <FeatureCard
          iconColor="#FF6B35"
          title={"Money\nArc"}
          description="BondedVault holds USDC and releases it only against a signed Verdict. USDC-native gas — the agent never acquires a second token to pay for itself."
          tag="Settle"
          tagColor="#FF6B35"
          bgColor="#0F0F0F"
          borderColor="#FF6B35"
        />
        <FeatureCard
          iconColor="#F5F5F0"
          title={"Authority\nChainlink CRE"}
          description="The irreversible threshold is evaluated inside a TEE and never leaves it. A threshold you can read is a threshold you can binary-search."
          tag="Confidential"
          tagColor="#888888"
          borderColor="#555555"
        />
      </div>
    </section>
  );
}
