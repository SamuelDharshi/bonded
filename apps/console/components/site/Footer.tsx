import Image from "next/image";

// Every link here resolves to something real — a working console route or the
// public repo. No placeholder "#" hrefs, no pages that don't exist.
const productLinks = [
  { label: "Live enforcement", href: "/live" },
  { label: "Decision log", href: "/log" },
  { label: "Policy", href: "/policy" },
  { label: "Attack corpus", href: "/corpus" },
];
const resourceLinks = [
  { label: "Architecture", href: "/architecture" },
  { label: "Source", href: "https://github.com/SamuelDharshi/bonded" },
];
const chainLinks = [
  { label: "BONDEDVAULT", href: "https://testnet.arcscan.app/address/0x9d2a0Fbf98E9e2F3B2EE2C1A8E9525B3001614A8" },
  { label: "BONDEDREGISTRY", href: "https://testnet.arcscan.app/address/0xB825225163aEf4353d0110BA63d0d811A17B8205" },
  { label: "ATTACKTOKEN", href: "https://testnet.arcscan.app/address/0x117E83CC8DcB5fe9D4F5a82c86B3bCe6c9355Ff5" },
];

export default function Footer() {
  return (
    <footer className="relative flex flex-col w-full overflow-hidden bg-[#FFFFFF]">
      {/* Backdrop for the whole footer. Purely decorative, so it is hidden
          from assistive tech and its image carries an empty alt.

          media/end.png is a glyph globe — the same visual family as the hero
          footage and near-black in the same way — so it gets the same
          conversion (`.glyph-art-light` + the #2E7FBF colour blend) instead of
          being dropped in as a dark slab at the bottom of a white page. The
          two bookend the landing page: world map at the top, globe at the end.
          See globals.css for what the filter chain does, and why the opacity
          has to sit on a wrapper rather than on the image itself. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[#FFFFFF]"
      >
        <div className="absolute inset-0 opacity-[0.72]">
          <div className="absolute inset-0 isolate bg-[#FFFFFF]">
            <Image
              src="/media/end.png"
              alt=""
              fill
              sizes="100vw"
              /* Anchored to the bottom edge, which slides the visible window
                 DOWN the source and so moves the globe UP in the frame. With a
                 1008x449 source covering a ~440px-tall box there is about
                 200px of vertical slack, so this is a real shift rather than
                 the near-no-op it was when the footer still had its tail. */
              className="object-cover object-bottom glyph-art-light"
            />
            <div className="absolute inset-0 bg-[#2E7FBF] mix-blend-color" />
          </div>
        </div>

        {/* Reading veil. The footer is now exactly as tall as its content, so
            the globe sits behind the columns rather than in empty space below
            them — which means the veil has to do real work. It stays white
            across the top edge so the section above hands over cleanly, then
            settles to a constant ~0.62 through the body: enough for 11-12px
            mono to hold, light enough that the globe is still an image and not
            a rumour. */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#FFFFFF] from-2% via-[rgba(255,255,255,0.66)] via-30% to-[rgba(255,255,255,0.6)]" />
      </div>

      {/* Top */}
      <div className="relative z-10 flex flex-col md:flex-row gap-12 md:gap-[80px] px-6 md:px-[120px] py-12 md:py-[64px]">
        {/* Brand */}
        <div className="flex flex-col gap-6 md:w-[280px] md:shrink-0">
          <div className="flex items-center gap-[12px]">
            <div className="w-[32px] h-[32px] bg-[#1E7BB8] shrink-0" />
            <span className="font-grotesk text-[16px] font-bold text-[#1E7BB8] tracking-[1px]">
              Bonded
            </span>
          </div>
          <p className="font-mono text-[11px] text-[#52738D] tracking-[1px] leading-[1.6] max-w-[260px]">
            The spending account for agents that aren&apos;t trusted to report
            the world — only to propose.
          </p>
          <div className="flex gap-[12px]">
            {[{ label: "X" }, { label: "GH" }, { label: "LI" }].map((s) => (
              <button
                key={s.label}
                className="flex items-center justify-center w-[36px] h-[36px] bg-[#F2F8FD] border border-[#CFE3F2] hover:border-[#52738D] transition-colors"
              >
                <span                   className="font-grotesk text-[10px] font-bold text-[#52738D]">
                  {s.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Link columns */}
        <div className="grid grid-cols-3 md:flex md:flex-1 gap-8 md:gap-[80px]">
          {[
            { heading: "Console", links: productLinks },
            { heading: "Project", links: resourceLinks },
            { heading: "On-chain", links: chainLinks },
          ].map((col) => (
            <div key={col.heading} className="flex flex-col gap-4 md:gap-[20px]">
              <span className="font-grotesk text-[11px] font-bold text-[#10314A] tracking-[0.5px]">
                {col.heading}
              </span>
              {col.links.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  {...(link.href.startsWith("http")
                    ? { target: "_blank", rel: "noreferrer" }
                    : {})}
                  className="font-mono text-[12px] text-[#52738D] tracking-[1px] hover:text-[#2C4E68] transition-colors"
                >
                  {link.label}
                </a>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between w-full px-6 md:px-[120px] py-4 md:h-[56px] border-t border-t-[#CFE3F2] gap-3 sm:gap-0">
        <span className="font-mono text-[11px] text-[#6E8CA5] tracking-[1px]">
          © 2026 Bonded. Built at ETHOnline 2026. MIT licensed.
        </span>
        <div className="flex items-center gap-6 md:gap-[32px]">
          <a
            href="https://github.com/SamuelDharshi/bonded"
            target="_blank"
            rel="noreferrer"
            className="font-mono text-[11px] text-[#6E8CA5] tracking-[1px] hover:text-[#52738D] transition-colors"
          >
            GitHub
          </a>
          <span className="font-mono text-[11px] font-bold text-[#1E7BB8] tracking-[1px]">
            Arc testnet // 5042002
          </span>
        </div>
      </div>

    </footer>
  );
}
