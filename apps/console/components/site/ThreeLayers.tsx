import Image from "next/image";
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
      className="relative flex flex-col w-full overflow-hidden bg-[#FFFFFF] py-16 px-6 md:py-[100px] md:px-[120px]"
    >
      {/* Backdrop. Purely decorative — aria-hidden, empty alt.

          media/three-layers.jpg is two wireframe hands reaching for each
          other: fine bright lines on near-black, which is the same kind of
          asset as the hero footage and the footer globe, so it takes
          `.glyph-art-light` rather than the softer `.photo-art-light` the
          flower field needs. Inverting sparse lines gives sparse dark lines;
          inverting large solid shapes gives blobs, which is the distinction
          those two classes exist to make. See globals.css.

          Anchored right: the source is portrait (960x1200) in a wide section,
          so most of it is cropped either way. Keeping the right edge puts the
          open space between the two hands behind the left-hand column, where
          the layer names and sponsors sit. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[#FFFFFF]"
      >
        <div className="absolute inset-0 opacity-[0.6]">
          <div className="absolute inset-0 isolate bg-[#FFFFFF]">
            <Image
              src="/media/three-layers.jpg"
              alt=""
              fill
              sizes="100vw"
              className="object-cover object-right glyph-art-light"
            />
            <div className="absolute inset-0 bg-[#2E7FBF] mix-blend-color" />
          </div>
        </div>

        {/* Reading veil. This section is three rows of 12-13px mono on hairline
            rules — the lightest type on the page and the least able to survive
            a busy backdrop. Heavier on the left, where the detail paragraphs
            run, thinning to the right where the drawing is worth seeing. */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#FFFFFF_0%,rgba(255,255,255,0.92)_45%,rgba(255,255,255,0.68)_75%,rgba(255,255,255,0.5)_100%)]" />

        {/* Soften both edges into the sections above and below. */}
        <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-[#FFFFFF] to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#FFFFFF] to-transparent" />
      </div>

      <span className="relative z-10 font-mono text-[10px] md:text-[12px] font-bold text-[#1E7BB8] tracking-[1px]">
        Three layers, one frozen seam
      </span>

      <div className="h-8 md:h-[40px]" />

      <div className="relative z-10 flex flex-col w-full">
        {layers.map(({ layer, sponsor, detail, cta, href, external }) => (
          <div
            key={layer}
            className="flex flex-col md:flex-row gap-3 md:gap-[64px] w-full py-8 md:py-[40px] border-t border-t-[#CFE3F2]"
          >
            <div className="md:w-[220px] md:shrink-0">
              <p className="font-mono text-[11px] text-[#6E8CA5] tracking-[0.5px]">
                {layer}
              </p>
              <p className="font-grotesk text-[22px] md:text-[26px] font-bold text-[#10314A] tracking-[-0.5px] mt-1">
                {sponsor}
              </p>
            </div>

            <div className="flex-1">
              <p className="font-mono text-[12px] md:text-[13px] text-[#52738D] tracking-[0.5px] leading-[1.7] max-w-[620px]">
                {detail}
              </p>
              {external ? (
                <a
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block font-mono text-[12px] text-[#1E7BB8] tracking-[0.5px] mt-4 hover:underline"
                >
                  {cta} ↗
                </a>
              ) : (
                <Link
                  href={href}
                  className="inline-block font-mono text-[12px] text-[#1E7BB8] tracking-[0.5px] mt-4 hover:underline"
                >
                  {cta} →
                </Link>
              )}
            </div>
          </div>
        ))}
        <div className="border-t border-t-[#CFE3F2]" />
      </div>
    </section>
  );
}
