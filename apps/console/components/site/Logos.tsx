import Image from "next/image";

// Not customer logos — Bonded has no customers, it's a hackathon build. These
// are the three sponsor stacks it's actually built on, each load-bearing:
// remove any one and a layer of the architecture stops working.
//
// Monochrome via `grayscale`, NOT `brightness-0`. The first attempt used
// brightness-0 to black them out, which works on a transparent PNG and destroys
// a JPEG: arc_logo.jpg has an opaque background, so forcing every pixel to black
// turned the whole rectangle into a black slab with the mark invisible inside
// it. Grayscale desaturates without touching luminance, so a transparent PNG
// stays a mark and an opaque JPEG keeps its own background.
//
// Opacity is 85, not the 30 it was — a provenance strip should be quiet, but
// these were so faint they read as missing. Colour is reserved for
// /architecture, where each mark labels a specific layer.
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
            width={240}
            height={72}
            className="h-[30px] md:h-[40px] w-auto object-contain rounded-[6px]
                       grayscale opacity-85 hover:grayscale-0 hover:opacity-100
                       transition-all duration-500"
          />
        ))}
      </div>
    </section>
  );
}
