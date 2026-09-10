// Not customer logos — Bonded has no customers, it's a hackathon build. These
// are the three sponsor stacks it's actually built on, each load-bearing:
// remove any one and a layer of the architecture stops working.
const logos = ["THE GRAPH", "ARC", "CHAINLINK CRE"];

export default function Logos() {
  return (
    <section className="flex flex-col items-center w-full bg-[#0F0F0F] py-[48px] px-6 md:px-[120px] gap-[32px]">
      <span className="font-ibm-mono text-[11px] text-[#444444] tracking-[3px]">
        BUILT ON — ETHONLINE 2026
      </span>
      <div className="flex flex-wrap items-center justify-center gap-8 md:gap-[64px] w-full">
        {logos.map((logo) => (
          <span
            key={logo}
            className="font-grotesk text-[13px] md:text-[14px] font-bold text-[#333333] tracking-[2px]"
          >
            {logo}
          </span>
        ))}
      </div>
    </section>
  );
}
