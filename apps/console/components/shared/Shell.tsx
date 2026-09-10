'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Radio, ScrollText, FileText, ShieldAlert, Network, Home } from 'lucide-react';

const NAV_ITEMS = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/live', label: 'Live', icon: Radio },
  { href: '/log', label: 'Log', icon: ScrollText },
  { href: '/policy', label: 'Policy', icon: FileText },
  { href: '/corpus', label: 'Corpus', icon: ShieldAlert },
  { href: '/architecture', label: 'Architecture', icon: Network },
];

/** Height of the fixed bar. Also the top padding <main> reserves for it. */
const BAR_H = 60;

/**
 * Console chrome: a fixed top header, transparent over the page until you
 * scroll, then a translucent white pane with a blur behind it — the same
 * treatment as the landing page's navbar, so moving between the marketing page
 * and the console no longer swaps one navigation model for another.
 *
 * This replaces a 240px left sidebar. Two things had to survive that move:
 *
 *  - The active-route indicator. It was a left border on a vertical list; in a
 *    horizontal bar that becomes an underline, which is also what the landing
 *    navbar uses for its in-page anchors.
 *  - The authority-layer status. It sat in the sidebar's footer and reports
 *    something true and load-bearing — Chainlink CRE is not deployed. Dropping
 *    it while rearranging furniture would have quietly removed a caveat the
 *    project is careful to state, so it moves to the right of the bar, and to
 *    its own row on narrow screens rather than being hidden there.
 *
 * The bar is fixed rather than sticky because the pages under it scroll
 * independently and a sticky bar in a flex column would leave a gap at the top
 * of short pages.
 */
export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="flex min-h-screen flex-col">
      <header
        className="fixed inset-x-0 top-0 z-50 transition-all duration-300"
        style={{
          background: scrolled ? 'rgba(255,255,255,0.72)' : 'transparent',
          backdropFilter: scrolled ? 'blur(16px) saturate(160%)' : 'none',
          WebkitBackdropFilter: scrolled ? 'blur(16px) saturate(160%)' : 'none',
          borderBottom: scrolled ? '1px solid #CFE3F2' : '1px solid transparent',
        }}
      >
        <div
          className="mx-auto flex max-w-[1400px] items-center gap-6 px-6 md:px-12"
          style={{ height: BAR_H }}
        >
          {/* Brand */}
          <Link href="/" className="group flex shrink-0 items-center gap-2.5">
            <span className="h-2.5 w-2.5 shrink-0 bg-[#1E7BB8] transition-transform group-hover:scale-110" />
            <span className="font-mono text-[13px] font-bold tracking-[0.5px] text-manifest">
              Bonded
            </span>
          </Link>

          {/* Routes. Scrollable on narrow screens rather than collapsed into a
              burger: six short labels fit, and a menu would hide the console's
              entire navigation behind a tap. */}
          <nav className="-mx-2 flex min-w-0 flex-1 items-center gap-1 overflow-x-auto px-2">
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
              const active = href === '/' ? pathname === '/' : pathname?.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={`relative flex shrink-0 items-center gap-2 whitespace-nowrap px-3 py-2 font-mono text-[11px] tracking-[0.5px] transition-colors ${
                    active ? 'text-[#1E7BB8]' : 'text-[#6E8CA5] hover:text-manifest'
                  }`}
                >
                  <Icon size={15} strokeWidth={1.5} aria-hidden />
                  {label}
                  <span
                    className="absolute inset-x-3 -bottom-px h-[1.5px] bg-[#1E7BB8] transition-opacity duration-200"
                    style={{ opacity: active ? 1 : 0 }}
                  />
                </Link>
              );
            })}
          </nav>

          {/* Authority layer — a real caveat, not decoration. Hidden below md
              only because it gets its own full-width row there. */}
          <div className="hidden shrink-0 items-center gap-2 md:flex">
            <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-hold" />
            <span className="font-mono text-[11px] tracking-[0.5px] text-[#52738D]">
              Chainlink CRE — not deployed
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 px-6 pb-3 md:hidden">
          <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-hold" />
          <span className="font-mono text-[10px] tracking-[0.5px] text-[#52738D]">
            Chainlink CRE — not deployed
          </span>
        </div>
      </header>

      <main className="min-w-0 flex-1" style={{ paddingTop: BAR_H }}>
        {children}
      </main>
    </div>
  );
}
