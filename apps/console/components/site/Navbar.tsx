"use client";

import { useState, useEffect } from "react";

/**
 * Two in-page anchors for the sections that exist on this page, then straight
 * into the console. The landing page is short by design (BONDED_PRD.md §6
 * specifies five sections), so a long anchor list would mostly point at
 * nothing — every entry here resolves to something real.
 */
const links: { label: string; section?: string; href?: string }[] = [
  { label: "Compare", section: "compare" },
  { label: "Layers",  section: "layers"  },
  { label: "Live",    href: "/live"      },
  { label: "Log",     href: "/log"       },
  { label: "Policy",  href: "/policy"    },
  { label: "Corpus",  href: "/corpus"    },
];

function scrollTo(id: string) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

export default function Navbar() {
  const [scrolled, setScrolled]           = useState(false);
  const [active, setActive]               = useState("");
  const [menuOpen, setMenuOpen]           = useState(false);

  /* ── scroll detection ── */
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* ── active section via IntersectionObserver ── */
  useEffect(() => {
    const ids = links.map((l) => l.section).filter((v): v is string => Boolean(v));
    const obs: IntersectionObserver[] = [];

    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      const o = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setActive(id); },
        { rootMargin: "-35% 0px -60% 0px" }
      );
      o.observe(el);
      obs.push(o);
    });

    return () => obs.forEach((o) => o.disconnect());
  }, []);

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
      /* Transparent over the hero so the footage runs behind it, then a
         translucent white pane on scroll. 0.72 alpha rather than a solid fill:
         the blur only reads as glass if some of the page shows through it.
         `saturate` keeps colour passing under the pane from going flat, which
         is the usual giveaway of a cheap-looking blur. */
      style={{
        background:           scrolled ? "rgba(255,255,255,0.72)" : "transparent",
        backdropFilter:       scrolled ? "blur(16px) saturate(160%)" : "none",
        WebkitBackdropFilter: scrolled ? "blur(16px) saturate(160%)" : "none",
        borderBottom:         scrolled ? "1px solid #CFE3F2" : "1px solid transparent",
      }}
    >
      <div className="flex items-center justify-between h-[60px] px-6 md:px-[48px] max-w-[1400px] mx-auto">

        {/* ── Logo ── */}
        <a href="/" className="flex items-center gap-[10px] shrink-0 group">
          <span className="w-[10px] h-[10px] bg-[#1E7BB8] group-hover:scale-110 transition-transform" />
          <span className="font-mono text-[13px] font-bold text-[#10314A] tracking-[0.5px]">
            Bonded
          </span>
        </a>

        {/* ── Desktop nav ── */}
        <nav className="hidden md:flex items-center gap-[36px]">
          {links.map(({ label, section, href }) => {
            const isActive = !!section && active === section;
            if (href) {
              return (
                <a
                  key={label}
                  href={href}
                  className="font-mono text-[10px] tracking-[0.5px] transition-colors duration-150"
                  style={{ color: "#6E8CA5" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "#10314A"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "#6E8CA5"; }}
                >
                  {label}
                </a>
              );
            }
            return (
              <button
                key={label}
                onClick={() => section && scrollTo(section)}
                className="relative font-mono text-[10px] tracking-[0.5px] transition-colors duration-150 bg-transparent border-none cursor-pointer"
                style={{ color: isActive ? "#1E7BB8" : "#6E8CA5" }}
                onMouseEnter={(e) => {
                  if (!isActive) (e.currentTarget as HTMLButtonElement).style.color = "#10314A";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.color = isActive ? "#1E7BB8" : "#6E8CA5";
                }}
              >
                {label}
                <span
                  className="absolute left-0 -bottom-[3px] h-[1.5px] bg-[#1E7BB8] transition-all duration-300"
                  style={{ width: isActive ? "100%" : "0%" }}
                />
              </button>
            );
          })}
        </nav>

        {/* ── Desktop CTA ── */}
        <div className="hidden md:flex items-center gap-[14px]">
          <a
            href="https://github.com/SamuelDharshi/bonded"
            target="_blank"
            rel="noreferrer"
            className="font-mono text-[10px] text-[#6E8CA5] tracking-[0.5px] hover:text-[#10314A] transition-colors"
          >
            Source
          </a>
          <a
            href="/live"
            className="font-mono text-[11px] font-bold text-[#FFFFFF] bg-[#1E7BB8] tracking-[0.5px] px-[18px] py-[9px] hover:bg-[#17618F] transition-colors"
          >
            Watch it refuse
          </a>
        </div>

        {/* ── Mobile burger ── */}
        <button
          className="md:hidden flex flex-col gap-[5px] p-2 -mr-2"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          <span
            className="block w-[20px] h-[1.5px] bg-[#10314A] transition-transform duration-200 origin-center"
            style={{ transform: menuOpen ? "translateY(6.5px) rotate(45deg)" : "none" }}
          />
          <span
            className="block w-[20px] h-[1.5px] bg-[#10314A] transition-opacity duration-200"
            style={{ opacity: menuOpen ? 0 : 1 }}
          />
          <span
            className="block w-[20px] h-[1.5px] bg-[#10314A] transition-transform duration-200 origin-center"
            style={{ transform: menuOpen ? "translateY(-6.5px) rotate(-45deg)" : "none" }}
          />
        </button>
      </div>

      {/* ── Mobile drawer ── */}
      <div
        className="md:hidden overflow-hidden transition-all duration-300"
        style={{
          maxHeight:      menuOpen ? "400px" : "0px",
          background:     "rgba(255,255,255,0.94)",
          backdropFilter: "blur(16px) saturate(160%)",
          WebkitBackdropFilter: "blur(16px) saturate(160%)",
          borderBottom:   menuOpen ? "1px solid #CFE3F2" : "none",
        }}
      >
        <nav className="flex flex-col px-6 py-5 gap-0">
          {links.map(({ label, section, href }) => {
            const isActive = !!section && active === section;
            if (href) {
              return (
                <a
                  key={label}
                  href={href}
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2 w-full font-mono text-[12px] tracking-[0.5px] py-[14px] border-b border-[#E7F1FA] transition-colors"
                  style={{ color: "#6E8CA5" }}
                >
                  <span className="w-[4px] h-[4px] rounded-full shrink-0" style={{ background: "#CFE3F2" }} />
                  {label}
                </a>
              );
            }
            return (
              <button
                key={label}
                onClick={() => { if (section) scrollTo(section); setMenuOpen(false); }}
                className="flex items-center gap-2 w-full font-mono text-[12px] tracking-[0.5px] py-[14px] border-b border-[#E7F1FA] transition-colors bg-transparent border-x-0 border-t-0 cursor-pointer"
                style={{ color: isActive ? "#1E7BB8" : "#6E8CA5" }}
              >
                <span
                  className="w-[4px] h-[4px] rounded-full shrink-0 transition-colors"
                  style={{ background: isActive ? "#1E7BB8" : "#CFE3F2" }}
                />
                {label}
              </button>
            );
          })}
          <div className="flex flex-col gap-[10px] pt-5">
            <a href="https://github.com/SamuelDharshi/bonded" target="_blank" rel="noreferrer" className="font-mono text-[12px] text-[#6E8CA5] tracking-[0.5px]">Source</a>
            <a
              href="/live"
              className="font-mono text-[11px] font-bold text-[#FFFFFF] bg-[#1E7BB8] tracking-[0.5px] px-[18px] py-[11px] text-center hover:bg-[#17618F] transition-colors"
            >
              Watch it refuse
            </a>
          </div>
        </nav>
      </div>
    </header>
  );
}
