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

/**
 * Two clusters, because they answer different questions.
 *
 * The anchors explain the idea and only exist on the landing page. The evidence
 * pages show what the enforcer actually did. The product itself — /app, where an
 * owner sets the authority everything else operates under — is not in this list
 * at all: it is the call to action, because burying the one page that does
 * something among six that describe it was the original problem.
 */
const anchorLinks: NavLink[] = [
  { label: "Compare", section: "compare", href: "/#compare" },
  { label: "Layers", section: "layers", href: "/#layers" },
];

const evidenceLinks: NavLink[] = [
  { label: "Log", href: "/log" },
  { label: "Policy", href: "/policy" },
  { label: "Corpus", href: "/corpus" },
  { label: "Architecture", href: "/architecture" },
];

const APP_HREF = "/app";

function scrollTo(id: string) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

export default function Navbar() {
  const pathname = usePathname();
  const onLanding = pathname === "/";
  // Any /app route, not just /app itself: the sub-pages are the same place.
  const inApp = pathname.startsWith(APP_HREF);

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

    const ids = anchorLinks.map((l) => l.section).filter((v): v is string => Boolean(v));
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
        <nav className="hidden md:flex items-center gap-[22px]">
          {onLanding &&
            anchorLinks.map((link) => {
              const activeNow = isActive(link);
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

          {/* Separates "what this is" from "what it did". Purely a reading cue —
              five evidence links in one undifferentiated row was why the product
              entry got lost among them. */}
          {onLanding && <span aria-hidden className="w-px h-[11px] bg-[#CFE3F2]" />}

          {evidenceLinks.map((link) => {
            const activeNow = isActive(link);
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
          })}
        </nav>

        {/* ── Desktop CTA ──
             The product, not the demo. "Watch it refuse" was the primary action
             for a long time, which made the strongest page in the app the one
             nobody was pointed at. It survives as the secondary link, because it
             is still the best way to understand what the account is for.

             On /app itself the pair swaps: someone already in their account does
             not need a button to get there, and the useful next step is seeing
             the thing work. */}
        <div className="hidden md:flex items-center gap-[14px]">
          <a
            href="https://github.com/SamuelDharshi/bonded"
            target="_blank"
            rel="noreferrer"
            className="font-mono text-[10px] text-[#6E8CA5] tracking-[0.5px] hover:text-[#10314A] transition-colors"
          >
            Source
          </a>

          {inApp ? (
            <Link
              href="/app/start"
              className="font-mono text-[11px] font-bold text-[#FFFFFF] bg-[#1E7BB8] tracking-[0.5px] px-[18px] py-[9px] hover:bg-[#17618F] transition-colors"
            >
              Set up your account
            </Link>
          ) : (
            <>
              <Link
                href="/log"
                className="font-mono text-[10px] text-[#6E8CA5] tracking-[0.5px] hover:text-[#10314A] transition-colors"
              >
                See what it settled
              </Link>
              <Link
                href={APP_HREF}
                className="font-mono text-[11px] font-bold text-[#FFFFFF] bg-[#1E7BB8] tracking-[0.5px] px-[18px] py-[9px] hover:bg-[#17618F] transition-colors"
              >
                Connect &amp; get started
              </Link>
            </>
          )}
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
          maxHeight:      menuOpen ? "620px" : "0px",
          background:     "rgba(255,255,255,0.94)",
          backdropFilter: "blur(16px) saturate(160%)",
          WebkitBackdropFilter: "blur(16px) saturate(160%)",
          borderBottom:   menuOpen ? "1px solid #CFE3F2" : "none",
        }}
      >
        <nav className="flex flex-col px-6 py-5 gap-0">
          {/* Your account first on mobile. On a phone the list is scrolled, not
              scanned, so the one entry that does something has to be reachable
              without reading past five that describe it. */}
          <Link
            href={APP_HREF}
            onClick={() => setMenuOpen(false)}
            aria-current={inApp ? "page" : undefined}
            className="flex items-center gap-2 w-full font-mono text-[12px] font-bold tracking-[0.5px] py-[14px] border-b border-[#E7F1FA] transition-colors"
            style={{ color: inApp ? "#1E7BB8" : "#10314A" }}
          >
            <span
              className="w-[4px] h-[4px] rounded-full shrink-0"
              style={{ background: "#1E7BB8" }}
            />
            Your account
          </Link>

          {onLanding &&
            anchorLinks.map((link) => {
              const activeNow = isActive(link);
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

          <span className="font-mono text-[9px] tracking-[1px] text-[#9DB4C7] pt-4 pb-1">
            WHAT IT DID
          </span>

          {evidenceLinks.map((link) => {
            const activeNow = isActive(link);
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
          })}

          <div className="flex flex-col gap-[10px] pt-5">
            <a
              href="https://github.com/SamuelDharshi/bonded"
              target="_blank"
              rel="noreferrer"
              className="font-mono text-[12px] text-[#6E8CA5] tracking-[0.5px]"
            >
              Source
            </a>
            <Link
              href={inApp ? "/app/start" : APP_HREF}
              onClick={() => setMenuOpen(false)}
              className="font-mono text-[11px] font-bold text-[#FFFFFF] bg-[#1E7BB8] tracking-[0.5px] px-[18px] py-[11px] text-center hover:bg-[#17618F] transition-colors"
            >
              {inApp ? "Set up your account" : "Connect & get started"}
            </Link>
          </div>
        </nav>
      </div>
    </header>
  );
}
