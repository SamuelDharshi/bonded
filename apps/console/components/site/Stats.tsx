/**
 * Every figure here is verifiable, not marketing.
 *  - 102 = 86 TypeScript unit tests + 16 Foundry tests, `pnpm test` and
 *    `pnpm contracts:test`.
 *  - 3 = BondedRegistry, BondedVault, AttackToken, all live on Arc testnet.
 *  - 0 = the enforcer package contains no LLM call of any kind. That is the
 *    whole thesis, stated as a number.
 *  - 6 = enumerated ReasonCode branches in packages/seam, each independently
 *    reachable and covered by the enforcer test suite.
 */
const stats = [
  { value: "102", label: "TESTS PASSING", border: true },
  { value: "3", label: "CONTRACTS LIVE ON ARC", border: true },
  { value: "0", label: "LLM CALLS IN THE ENFORCER", border: true },
  { value: "6", label: "FAIL-CLOSED REASON CODES", border: false },
];

export default function Stats() {
  return (
    <section className="flex flex-col w-full bg-[#FFD600] py-12 px-6 md:py-[80px] md:px-[120px]">
      <span className="font-ibm-mono text-[12px] font-bold text-[#0A0A0A] tracking-[3px]">
        [03] // BY THE NUMBERS // ALL INDEPENDENTLY VERIFIABLE
      </span>
      <div className="h-8 md:h-[32px]" />
      <div className="grid grid-cols-2 md:flex w-full gap-[2px] md:gap-0">
        {stats.map((stat, i) => (
          <div
            key={stat.label}
            className={`flex flex-col gap-2 items-center justify-center py-6 md:py-0 md:h-[160px] md:flex-1
              ${stat.border ? "md:border-r-2 md:border-r-[#0A0A0A]" : ""}
              ${i === 0 ? "md:pr-[40px]" : i === stats.length - 1 ? "md:pl-[40px]" : "md:px-[40px]"}
              ${i % 2 === 0 ? "border-r-2 border-r-[#0A0A0A] pr-4 md:border-r-0 md:pr-0" : "pl-4 md:pl-0"}
              ${i >= 2 ? "border-t-2 border-t-[#0A0A0A] pt-4 md:border-t-0 md:pt-0" : ""}
            `}
          >
            <span className="font-grotesk text-[40px] md:text-[64px] font-bold text-[#0A0A0A] tracking-[-2px] leading-none">
              {stat.value}
            </span>
            <span className="font-ibm-mono text-[10px] md:text-[12px] font-bold text-[#1A1A1A] tracking-[2px]">
              {stat.label}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
