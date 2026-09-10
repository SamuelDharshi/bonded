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
  { label: "BONDEDVAULT", href: "https://testnet.arcscan.app/address/0xBA3387ea45a2F21d52830d60aaeC8E98B1bA37BE" },
  { label: "BONDEDREGISTRY", href: "https://testnet.arcscan.app/address/0xB825225163aEf4353d0110BA63d0d811A17B8205" },
  { label: "ATTACKTOKEN", href: "https://testnet.arcscan.app/address/0x117E83CC8DcB5fe9D4F5a82c86B3bCe6c9355Ff5" },
];

export default function Footer() {
  return (
    <footer className="flex flex-col w-full bg-[#FFFFFF]">
      {/* Top */}
      <div className="flex flex-col md:flex-row gap-12 md:gap-[80px] px-6 md:px-[120px] py-12 md:py-[64px]">
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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between w-full px-6 md:px-[120px] py-4 md:h-[56px] border-t border-t-[#CFE3F2] gap-3 sm:gap-0">
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
