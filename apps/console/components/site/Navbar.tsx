"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * The site's single navigation bar, used by the landing page and by every
 * console route through components/shared/Shell.
 *
 * It used to be landing-only, with the console carrying a separate sidebar of
 * its own. That made /live, /log, /policy and /corpus feel like a different
 * site rather than pages of this one — different chrome, different link set,
 * no way back to the sections you came from. One component now serves both.
 *
 * The complication that makes this more than a copy-paste: two of the entries
 * are in-page anchors that only exist on `/`. Scrolling to #compare from
 * /policy would scroll to nothing, so off the landing page they become real
 * links to `/#compare` and the browser handles the jump after navigation.
 * `section` and `href` are therefore both present on those two, and which one
 * is used depends on where you are.
 */
type NavLink = {
  label: string;
  /** In-page anchor id — only resolvable on the landing page. */
  section?: string;
  /** Route, or the fallback target for an anchor when off the landing page. */
  href?: string;
};

const links: NavLink[] = [
  { label: "Compare", section: "compare", href: "/#compare" },
  { label: "Layers", section: "layers", href: "/#layers" },
  { label: "Live", href: "/live" },
  { label: "Log", href: "/log" },
  { label: "Policy", href: "/policy" },
  { label: "Corpus", href: "/corpus" },
  { label: "Architecture", href: "/architecture" },
  // The owner's own console. Last in the list but first in the actual flow:
  // nothing on the other pages can happen until someone has set a policy,
  // funded a vault and authorized an agent here.
  { label: "Your account", href: "/app" },
];

function scrollTo(id: string) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

export default function Navbar() {
  const pathname = usePathname();
  const onLanding = pathname === "/";

  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  /* ── scroll detection ── */
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* ── active section via IntersectionObserver. Landing page only: off it
        there are no sections to observe, and the route match below decides
        what is highlighted instead. ── */
  useEffect(() => {
    if (!onLanding) {
      setActive("");
      return;
    }

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
  }, [onLanding, pathname]);

  /** True when this entry represents where the reader currently is. */
  function isActive(link: NavLink): boolean {
    if (onLanding) return !!link.section && active === link.section;
    return !!link.href && !link.section && pathname === link.href;
  }

  /** An anchor behaves as a scroll button only where its target exists. */
  function isScrollAnchor(link: NavLink): boolean {
    return onLanding && !!link.section;
  }

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
        <Link href="/" className="flex items-center gap-[10px] shrink-0 group">
          <span className="w-[10px] h-[10px] bg-[#1E7BB8] group-hover:scale-110 transition-transform" />
          <span className="font-mono text-[13px] font-bold text-[#10314A] tracking-[0.5px]">
            Bonded
          </span>
        </Link>

        {/* ── Desktop nav ── */}
        <nav className="hidden md:flex items-center gap-[28px]">
          {links.map((link) => {
            const activeNow = isActive(link);

            if (!isScrollAnchor(link)) {
              return (
                <Link
                  key={link.label}
                  href={link.href!}
                  aria-current={activeNow ? "page" : undefined}
                  className="relative font-mono text-[10px] tracking-[0.5px] transition-colors duration-150"
                  style={{ color: activeNow ? "#1E7BB8" : "#6E8CA5" }}
                >
                  {link.label}
                  <span
                    className="absolute left-0 -bottom-[3px] h-[1.5px] bg-[#1E7BB8] transition-all duration-300"
                    style={{ width: activeNow ? "100%" : "0%" }}
                  />
                </Link>
              );
            }

            return (
              <button
                key={link.label}
                onClick={() => link.section && scrollTo(link.section)}
                className="relative font-mono text-[10px] tracking-[0.5px] transition-colors duration-150 bg-transparent border-none cursor-pointer"
                style={{ color: activeNow ? "#1E7BB8" : "#6E8CA5" }}
              >
                {link.label}
                <span
                  className="absolute left-0 -bottom-[3px] h-[1.5px] bg-[#1E7BB8] transition-all duration-300"
                  style={{ width: activeNow ? "100%" : "0%" }}
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
          <Link
            href="/live"
            className="font-mono text-[11px] font-bold text-[#FFFFFF] bg-[#1E7BB8] tracking-[0.5px] px-[18px] py-[9px] hover:bg-[#17618F] transition-colors"
          >
            Watch it refuse
          </Link>
        </div>

        {/* ── Mobile burger ── */}
        <button
          className="md:hidden flex flex-col gap-[5px] p-2 -mr-2"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Toggle menu"
          aria-expanded={menuOpen}
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
          maxHeight:      menuOpen ? "460px" : "0px",
          background:     "rgba(255,255,255,0.94)",
          backdropFilter: "blur(16px) saturate(160%)",
          WebkitBackdropFilter: "blur(16px) saturate(160%)",
          borderBottom:   menuOpen ? "1px solid #CFE3F2" : "none",
        }}
      >
        <nav className="flex flex-col px-6 py-5 gap-0">
          {links.map((link) => {
            const activeNow = isActive(link);

            if (!isScrollAnchor(link)) {
              return (
                <Link
                  key={link.label}
                  href={link.href!}
                  onClick={() => setMenuOpen(false)}
                  aria-current={activeNow ? "page" : undefined}
                  className="flex items-center gap-2 w-full font-mono text-[12px] tracking-[0.5px] py-[14px] border-b border-[#E7F1FA] transition-colors"
                  style={{ color: activeNow ? "#1E7BB8" : "#6E8CA5" }}
                >
                  <span
                    className="w-[4px] h-[4px] rounded-full shrink-0"
                    style={{ background: activeNow ? "#1E7BB8" : "#CFE3F2" }}
                  />
                  {link.label}
                </Link>
              );
            }

            return (
              <button
                key={link.label}
                onClick={() => { if (link.section) scrollTo(link.section); setMenuOpen(false); }}
                className="flex items-center gap-2 w-full font-mono text-[12px] tracking-[0.5px] py-[14px] border-b border-[#E7F1FA] transition-colors bg-transparent border-x-0 border-t-0 cursor-pointer"
                style={{ color: activeNow ? "#1E7BB8" : "#6E8CA5" }}
              >
                <span
                  className="w-[4px] h-[4px] rounded-full shrink-0 transition-colors"
                  style={{ background: activeNow ? "#1E7BB8" : "#CFE3F2" }}
                />
                {link.label}
              </button>
            );
          })}
          <div className="flex flex-col gap-[10px] pt-5">
            <a href="https://github.com/SamuelDharshi/bonded" target="_blank" rel="noreferrer" className="font-mono text-[12px] text-[#6E8CA5] tracking-[0.5px]">Source</a>
            <Link
              href="/live"
              onClick={() => setMenuOpen(false)}
              className="font-mono text-[11px] font-bold text-[#FFFFFF] bg-[#1E7BB8] tracking-[0.5px] px-[18px] py-[11px] text-center hover:bg-[#17618F] transition-colors"
            >
              Watch it refuse
            </Link>
          </div>
        </nav>
      </div>
    </header>
  );
}
