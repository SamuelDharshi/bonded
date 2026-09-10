import Link from "next/link";

/**
 * Three-layer summary — BONDED_PRD.md §6 specifies this as "plain type on
 * `hairline` rules", so it is deliberately not a row of bordered cards: just
 * type, separated by 1px rules. §5.2 reserves `hairline` for structural rules
 * only, never decoration, which is exactly what it is doing here.
 *
 * Each layer names its sponsor and what breaks without it (PRD §2.1), and
 * links to the real thing rather than to a description of it.
 */
const layers = [
  {
    layer: "Truth",
    sponsor: "The Graph",
    detail:
      "Every premise re-derived at the current block through Messari standardized subgraphs, cache TTL zero. Without it there is no enforcement mechanism — nothing to check the model's claims against.",
    cta: "How re-derivation works",
    href: "/architecture",
    external: false,
  },
  {
    layer: "Money",
    sponsor: "Arc",
    detail:
      "BondedVault holds USDC and releases it only against a signed Verdict. USDC-native gas, so the agent never acquires a second token to pay for itself. Without it there is no spending account to protect.",
    cta: "BondedVault on the explorer",
    href: "https://testnet.arcscan.app/address/0xBA3387ea45a2F21d52830d60aaeC8E98B1bA37BE",
    external: true,
  },
  {
    layer: "Authority",
    sponsor: "Chainlink CRE",
    detail:
      "The irreversible threshold is evaluated inside a TEE and never leaves it. Without it the authority layer is a soft target — the threshold becomes probeable and the key sits in plaintext on a compromisable host.",
    cta: "Inside the enclave",
    href: "/architecture",
    external: false,
  },
];

export default function ThreeLayers() {
  return (
    <section
      id="layers"
      className="flex flex-col w-full bg-[#0A0A0A] py-16 px-6 md:py-[100px] md:px-[120px]"
    >
      <span className="font-mono text-[10px] md:text-[12px] font-bold text-[#FFD600] tracking-[1px]">
        Three layers, one frozen seam
      </span>

      <div className="h-8 md:h-[40px]" />

      <div className="flex flex-col w-full">
        {layers.map(({ layer, sponsor, detail, cta, href, external }) => (
          <div
            key={layer}
            className="flex flex-col md:flex-row gap-3 md:gap-[64px] w-full py-8 md:py-[40px] border-t border-t-[#1E3A47]"
          >
            <div className="md:w-[220px] md:shrink-0">
              <p className="font-mono text-[11px] text-[#555555] tracking-[0.5px]">
                {layer}
              </p>
              <p className="font-grotesk text-[22px] md:text-[26px] font-bold text-[#F5F5F0] tracking-[-0.5px] mt-1">
                {sponsor}
              </p>
            </div>

            <div className="flex-1">
              <p className="font-mono text-[12px] md:text-[13px] text-[#888888] tracking-[0.5px] leading-[1.7] max-w-[620px]">
                {detail}
              </p>
              {external ? (
                <a
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block font-mono text-[12px] text-[#FFD600] tracking-[0.5px] mt-4 hover:underline"
                >
                  {cta} ↗
                </a>
              ) : (
                <Link
                  href={href}
                  className="inline-block font-mono text-[12px] text-[#FFD600] tracking-[0.5px] mt-4 hover:underline"
                >
                  {cta} →
                </Link>
              )}
            </div>
          </div>
        ))}
        <div className="border-t border-t-[#1E3A47]" />
      </div>
    </section>
  );
}
