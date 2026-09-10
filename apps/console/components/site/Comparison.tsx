import SectionHeader from "./SectionHeader";

/**
 * Deliberately a fair comparison, not a strawman. Allowlists and human review
 * genuinely do some of this well — allowlists never read attacker text and do
 * fail closed; a human reviewer really does check reasoning. The honest claim
 * isn't "everything else is broken", it's that only re-derivation catches a
 * *plausible lie about facts* without a human in the loop every time.
 */
const rows = [
  { feature: "Never reads attacker-controlled text", pc: "[✓]", figma: "[✗]", sketch: "[✓]", framer: "[✗]" },
  { feature: "Checks stated reasons, not just output", pc: "[✓]", figma: "[✗]", sketch: "[✗]", framer: "[✓]" },
  { feature: "Catches a plausible lie about facts", pc: "[✓]", figma: "[✗]", sketch: "[✗]", framer: "[—]" },
  { feature: "Fails closed by default", pc: "[✓]", figma: "[✗]", sketch: "[✓]", framer: "[✓]" },
  { feature: "Enforced on-chain, not in the app", pc: "[✓]", figma: "[✗]", sketch: "[—]", framer: "[✗]" },
  { feature: "Runs without a human every time", pc: "[✓]", figma: "[✓]", sketch: "[✓]", framer: "[✗]" },
];

function cellStyle(val: string) {
  if (val === "[✓]") return "font-bold text-[14px]";
  if (val === "[✗]") return "text-[#3D3D3D] text-[13px]";
  if (val === "[—]") return "text-[#444444] text-[13px]";
  return "text-[#444444] text-[10px]";
}

function cellColor(val: string) {
  if (val === "[✓]") return "text-[#444444]";
  return "";
}

export default function Comparison() {
  return (
    <section id="comparison" className="flex flex-col w-full bg-[#050505] py-16 px-6 md:py-[100px] md:px-[120px] gap-12 md:gap-[64px]">
      <SectionHeader
        label="[06] // vs. the alternatives"
        title={"Guardrails check output.\nBonded checks reasons."}
        subtitle="A guardrail asks whether the action looks allowed. Re-derivation asks whether the story behind it is true."
      />

      {/* Desktop table */}
      <div className="hidden md:flex flex-col w-full border border-[#2D2D2D]">
        {/* Header */}
        <div className="flex w-full h-[56px] bg-[#111111] border-b-2 border-b-[#FFD600]">
          <div className="flex items-center w-[400px] shrink-0 px-[32px] border-r border-r-[#2D2D2D]">
            <span className="font-grotesk text-[11px] font-bold text-[#888888] tracking-[0.5px]">Property</span>
          </div>
          <div className="flex items-center flex-1 px-[32px] bg-[#1A1A1A] border-r border-r-[#2D2D2D]">
            <span className="font-grotesk text-[11px] font-bold text-[#FFD600] tracking-[0.5px]">BONDED</span>
          </div>
          {["Prompt guardrail", "Allowlist", "Human review"].map((tool, i) => (
            <div key={tool} className={`flex items-center flex-1 px-[32px] ${i < 2 ? "border-r border-r-[#2D2D2D]" : ""}`}>
              <span className="font-grotesk text-[11px] font-bold text-[#555555] tracking-[0.5px]">{tool}</span>
            </div>
          ))}
        </div>

        {/* Data rows */}
        {rows.map((row, i) => (
          <div key={row.feature} className={`flex w-full h-[56px] ${i < rows.length - 1 ? "border-b border-b-[#1D1D1D]" : ""}`}>
            <div className="flex items-center w-[400px] shrink-0 px-[32px] border-r border-r-[#2D2D2D]">
              <span className="font-mono text-[12px] text-[#CCCCCC] tracking-[1px]">{row.feature}</span>
            </div>
            <div className="flex items-center flex-1 px-[32px] bg-[#0D0D0D] border-r border-r-[#2D2D2D]">
              <span className="font-mono tracking-[1px] text-[#FFD600] font-bold text-[14px]">{row.pc}</span>
            </div>
            {[row.figma, row.sketch, row.framer].map((val, j) => (
              <div key={j} className={`flex items-center flex-1 px-[32px] ${j < 2 ? "border-r border-r-[#2D2D2D]" : ""}`}>
                <span className={`font-mono tracking-[1px] ${cellStyle(val)} ${cellColor(val)}`}>{val}</span>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Mobile: card-per-feature layout */}
      <div className="flex flex-col md:hidden w-full gap-[2px]">
        {/* Header row */}
        <div className="grid grid-cols-5 bg-[#111111] border border-[#FFD600] border-b-2">
          <div className="col-span-2 px-3 py-3">
            <span className="font-grotesk text-[9px] font-bold text-[#888888] tracking-[1px]">Property</span>
          </div>
          <div className="px-2 py-3 bg-[#1A1A1A]">
            <span className="font-grotesk text-[9px] font-bold text-[#FFD600] tracking-[1px]">Bonded</span>
          </div>
          <div className="px-2 py-3">
            <span className="font-grotesk text-[9px] font-bold text-[#555555] tracking-[1px]">Guard</span>
          </div>
          <div className="px-2 py-3">
            <span className="font-grotesk text-[9px] font-bold text-[#555555] tracking-[1px]">Allow</span>
          </div>
        </div>
        {rows.map((row, i) => (
          <div key={row.feature} className={`grid grid-cols-5 border border-[#1D1D1D] ${i % 2 === 0 ? "bg-[#0A0A0A]" : "bg-[#0D0D0D]"}`}>
            <div className="col-span-2 flex items-center px-3 py-4">
              <span className="font-mono text-[9px] text-[#CCCCCC] tracking-[1px] leading-[1.4]">{row.feature}</span>
            </div>
            <div className="flex items-center px-2 py-4 bg-[#0D0D0D]">
              <span className="font-mono text-[12px] text-[#FFD600] font-bold">{row.pc}</span>
            </div>
            <div className="flex items-center px-2 py-4">
              <span className={`font-mono text-[11px] ${cellColor(row.figma)}`}>{row.figma}</span>
            </div>
            <div className="flex items-center px-2 py-4">
              <span className={`font-mono text-[11px] ${cellColor(row.sketch)}`}>{row.sketch}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
