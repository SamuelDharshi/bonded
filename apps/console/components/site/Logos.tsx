// Not customer logos — Bonded has no customers, it's a hackathon build. These
// are the three sponsor stacks it's actually built on, each load-bearing:
// remove any one and a layer of the architecture stops working.
const logos = ["The Graph", "Arc", "Chainlink CRE"];

export default function Logos() {
  return (
    <section className="flex flex-col items-center w-full bg-[#F2F8FD] py-[48px] px-6 md:px-[120px] gap-[32px]">
      <span className="font-mono text-[11px] text-[#93B2CA] tracking-[1px]">
        Built on — ETHOnline 2026
      </span>
      <div className="flex flex-wrap items-center justify-center gap-8 md:gap-[64px] w-full">
        {logos.map((logo) => (
          <span
            key={logo}
            className="font-grotesk text-[13px] md:text-[14px] font-bold text-[#93B2CA] tracking-[0.5px]"
          >
            {logo}
          </span>
        ))}
      </div>
    </section>
  );
}
