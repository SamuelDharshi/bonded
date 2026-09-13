import Image from "next/image";

// Not customer logos — Bonded has no customers, it's a hackathon build. These
// are the three sponsor stacks it's actually built on, each load-bearing:
// remove any one and a layer of the architecture stops working.
//
// Rendered as the real marks rather than as their names in text, and blacked
// out: `brightness-0` crushes every logo to solid black regardless of its own
// palette, then opacity lifts it back to the same weight as the caption above.
// That is what lets three logos in three different brand colours — and one JPEG
// with a baked-in white background — sit in a row without one of them shouting.
// Colour belongs on /architecture, where each mark is labelling a specific
// layer; here they are a provenance strip, so they should read as one texture.
const logos = [
  { src: "/media/thegraph_logo.png", alt: "The Graph" },
  { src: "/media/arc_logo.jpg", alt: "Arc" },
  { src: "/media/chainlink_Logo.png", alt: "Chainlink CRE" },
];

export default function Logos() {
  return (
    <section className="flex flex-col items-center w-full bg-[#F2F8FD] py-[48px] px-6 md:px-[120px] gap-[32px]">
      <span className="font-mono text-[11px] text-[#93B2CA] tracking-[1px]">
        Built on — ETHOnline 2026
      </span>

      <div className="flex flex-wrap items-center justify-center gap-10 md:gap-[72px] w-full">
        {logos.map((logo) => (
          <Image
            key={logo.alt}
            src={logo.src}
            alt={logo.alt}
            title={logo.alt}
            width={200}
            height={56}
            className="h-[24px] md:h-[30px] w-auto object-contain rounded-[6px]
                       brightness-0 opacity-30 hover:opacity-55 transition-opacity duration-500"
          />
        ))}
      </div>
    </section>
  );
}
