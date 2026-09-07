'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Radio, ScrollText, FileText, ShieldAlert, Network, Home } from 'lucide-react';

const NAV_ITEMS = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/live', label: 'Live', icon: Radio },
  { href: '/log', label: 'Log', icon: ScrollText },
  { href: '/policy', label: 'Policy', icon: FileText },
  { href: '/corpus', label: 'Corpus', icon: ShieldAlert },
  { href: '/architecture', label: 'Architecture', icon: Network },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen">
      <aside className="w-[240px] shrink-0 border-r border-hairline bg-deepwater flex flex-col">
        <div className="px-5 py-6 border-b border-hairline">
          <p className="text-h2 text-manifest">Bonded</p>
          <p className="text-small text-manifest/40 mt-1">Agent spending authority</p>
        </div>

        <nav className="flex-1 py-4">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = href === '/' ? pathname === '/' : pathname?.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-5 py-2.5 text-small transition-colors ${
                  active
                    ? 'text-manifest bg-harbor border-l-2 border-seal'
                    : 'text-manifest/50 border-l-2 border-transparent hover:text-manifest/80'
                }`}
              >
                <Icon size={18} strokeWidth={1.5} />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="px-5 py-4 border-t border-hairline">
          <p className="text-small text-manifest/40 mb-2">Authority layer</p>
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-hold" />
            <span className="text-small text-manifest/70">Chainlink CRE — not deployed</span>
          </div>
        </div>
      </aside>

      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
