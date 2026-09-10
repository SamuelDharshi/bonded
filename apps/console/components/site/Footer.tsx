// Every link here resolves to something real — a working console route or the
// public repo. No placeholder "#" hrefs, no pages that don't exist.
const productLinks = [
  { label: "LIVE ENFORCEMENT", href: "/live" },
  { label: "DECISION LOG", href: "/log" },
  { label: "POLICY", href: "/policy" },
  { label: "ATTACK CORPUS", href: "/corpus" },
];
const resourceLinks = [
  { label: "ARCHITECTURE", href: "/architecture" },
  { label: "SOURCE", href: "https://github.com/SamuelDharshi/bonded" },
];
const chainLinks = [
  { label: "BONDEDVAULT", href: "https://testnet.arcscan.app/address/0xBA3387ea45a2F21d52830d60aaeC8E98B1bA37BE" },
  { label: "BONDEDREGISTRY", href: "https://testnet.arcscan.app/address/0xB825225163aEf4353d0110BA63d0d811A17B8205" },
  { label: "ATTACKTOKEN", href: "https://testnet.arcscan.app/address/0x117E83CC8DcB5fe9D4F5a82c86B3bCe6c9355Ff5" },
];

export default function Footer() {
  return (
    <footer className="flex flex-col w-full bg-[#050505]">
      {/* Top */}
      <div className="flex flex-col md:flex-row gap-12 md:gap-[80px] px-6 md:px-[120px] py-12 md:py-[64px]">
        {/* Brand */}
        <div className="flex flex-col gap-6 md:w-[280px] md:shrink-0">
          <div className="flex items-center gap-[12px]">
            <div className="w-[32px] h-[32px] bg-[#FFD600] shrink-0" />
            <span className="font-grotesk text-[16px] font-bold text-[#FFD600] tracking-[3px]">
              BONDED
            </span>
          </div>
          <p className="font-ibm-mono text-[11px] text-[#888888] tracking-[1px] leading-[1.6] max-w-[260px]">
            THE SPENDING ACCOUNT FOR AGENTS THAT AREN&apos;T TRUSTED TO REPORT
            THE WORLD — ONLY TO PROPOSE.
          </p>
          <div className="flex gap-[12px]">
            {[{ label: "X" }, { label: "GH" }, { label: "LI" }].map((s) => (
              <button
                key={s.label}
                className="flex items-center justify-center w-[36px] h-[36px] bg-[#111111] border border-[#2D2D2D] hover:border-[#888888] transition-colors"
              >
                <span                   className="font-grotesk text-[10px] font-bold text-[#AAAAAA]">
                  {s.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Link columns */}
        <div className="grid grid-cols-3 md:flex md:flex-1 gap-8 md:gap-[80px]">
          {[
            { heading: "CONSOLE", links: productLinks },
            { heading: "PROJECT", links: resourceLinks },
            { heading: "ON-CHAIN", links: chainLinks },
          ].map((col) => (
            <div key={col.heading} className="flex flex-col gap-4 md:gap-[20px]">
              <span className="font-grotesk text-[11px] font-bold text-[#F5F5F0] tracking-[2px]">
                {col.heading}
              </span>
              {col.links.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  {...(link.href.startsWith("http")
                    ? { target: "_blank", rel: "noreferrer" }
                    : {})}
                  className="font-ibm-mono text-[12px] text-[#888888] tracking-[1px] hover:text-[#CCCCCC] transition-colors"
                >
                  {link.label}
                </a>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between w-full px-6 md:px-[120px] py-4 md:h-[56px] border-t border-t-[#1D1D1D] gap-3 sm:gap-0">
        <span className="font-ibm-mono text-[11px] text-[#666666] tracking-[1px]">
          © 2026 BONDED. BUILT AT ETHONLINE 2026. MIT LICENSED.
        </span>
        <div className="flex items-center gap-6 md:gap-[32px]">
          <a
            href="https://github.com/SamuelDharshi/bonded"
            target="_blank"
            rel="noreferrer"
            className="font-ibm-mono text-[11px] text-[#666666] tracking-[1px] hover:text-[#AAAAAA] transition-colors"
          >
            GITHUB
          </a>
          <span className="font-ibm-mono text-[11px] font-bold text-[#FFD600] tracking-[1px]">
            ARC TESTNET // 5042002
          </span>
        </div>
      </div>
    </footer>
  );
}
