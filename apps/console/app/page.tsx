import Link from 'next/link';

import { CompareDemo } from '../components/landing/CompareDemo';
import { ExplorerEvidenceStrip } from '../components/landing/ExplorerEvidenceStrip';
import { Grainient } from '../components/landing/Grainient';
import { MeshGradient } from '../components/landing/MeshGradient';
import { ReceiptCounter } from '../components/landing/ReceiptCounter';
import { TypewriterHeadline } from '../components/landing/TypewriterHeadline';

/**
 * Landing page — /
 *
 * Composed per docs/LANDING_PAGE_SPEC.md §5. Zero wallet connection required;
 * every number and address on this page comes from §6 or is read live on-chain
 * by the section that renders it.
 *
 * Motion budget (§4): the hero mesh gradient is the ONLY animated gradient on
 * this page. Every other MeshGradient below is static.
 */

const NAV_LINKS: ReadonlyArray<readonly [string, string]> = [
  ['/live', 'Live'],
  ['/log', 'Log'],
  ['/policy', 'Policy'],
  ['/corpus', 'Corpus'],
  ['/architecture', 'Architecture'],
];

/** §5.4 — three-layer band. Copy preserved from the previous landing page. */
const LAYERS: ReadonlyArray<{
  layer: string;
  sponsor: string;
  detail: string;
  href: string;
  external: boolean;
  cta: string;
}> = [
  {
    layer: 'Truth',
    sponsor: 'The Graph',
    detail:
      'Every premise re-derived at current block via Messari standardized subgraphs. Cache TTL = 0.',
    href: '/architecture',
    external: false,
    cta: 'How re-derivation works',
  },
  {
    layer: 'Money',
    sponsor: 'Arc',
    detail:
      'BondedVault releases USDC only against signed Verdict structs. USDC-native — no separate gas token.',
    href: 'https://testnet.arcscan.app/address/0xBA3387ea45a2F21d52830d60aaeC8E98B1bA37BE',
    external: true,
    cta: 'BondedVault on the explorer',
  },
  {
    layer: 'Authority',
    sponsor: 'Chainlink CRE',
    detail:
      'Policy thresholds evaluated inside handlerInTee. Enforcer key never leaves the enclave.',
    href: '/architecture',
    external: false,
    cta: 'Inside the enclave',
  },
];

export default async function LandingPage() {
  return (
    <main className="min-h-screen bg-harbor">
      {/* ── Top nav ─────────────────────────────────────────────────────── */}
      <header className="relative z-20 flex items-center justify-between px-6 py-4 border-b border-hairline">
        <span className="text-body text-manifest font-medium">Bonded</span>
        <nav className="flex items-center gap-6">
          {NAV_LINKS.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              className="text-small text-manifest/50 hover:text-manifest transition-colors"
            >
              {label}
            </Link>
          ))}
        </nav>
      </header>

      {/* ── Hero (§5.1) — full-bleed WebGL grainient ──────────────────────
          Colors map the requested white → light blue → blue → dark blue →
          black range onto Grainient's three blend anchors: the shader mixes
          dark↔mid and mid↔light, so light blue and dark blue emerge as the
          intermediate blends rather than needing their own slots.
          The `.mesh-gradient` class stays on the wrapper as the no-WebGL
          fallback — if the context fails to create, the CSS gradient shows
          through instead of a flat empty block. */}
      <section className="mesh-gradient relative min-h-screen overflow-hidden">
        <div className="absolute inset-0">
          <Grainient
            color1="#F5F7FA"
            color2="#2E6FD9"
            color3="#050608"
            timeSpeed={0.18}
            colorBalance={-0.1}
            warpStrength={1.0}
            warpFrequency={4.0}
            warpSpeed={1.4}
            warpAmplitude={60.0}
            blendSoftness={0.12}
            rotationAmount={420.0}
            noiseScale={1.6}
            grainAmount={0.14}
            grainScale={1.6}
            contrast={1.35}
            saturation={1.05}
            zoom={0.85}
          />
        </div>

        {/* Legibility scrim. The pre-Grainient spec said no scrim was needed,
            but that assumed a gradient we kept dark by construction; with
            `mesh-white` in the palette and `manifest` text on top, the hero
            copy needs guaranteed contrast independent of where the warp
            happens to put the light band. */}
        <div className="absolute inset-0 bg-harbor/65" aria-hidden />

        <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 py-24 text-center">
          <p className="text-small text-manifest/60 uppercase tracking-widest mb-8">
            ETHOnline 2026
          </p>

          <TypewriterHeadline className="max-w-4xl" />

          <p className="text-body text-manifest/80 mt-8 max-w-xl prose">
            Bonded re-derives every fact an agent relied on before money moves. The model
            proposes. It cannot approve itself.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/live"
              className="text-small font-medium bg-manifest text-harbor px-5 py-2.5 rounded-control hover:bg-manifest/90 transition-colors"
            >
              Watch it refuse →
            </Link>
            <Link
              href="/architecture"
              className="text-small font-medium text-manifest border border-manifest/40 px-5 py-2.5 rounded-control hover:border-manifest transition-colors"
            >
              Read the architecture
            </Link>
          </div>

          <p className="text-small text-manifest/50 mt-8">No wallet required.</p>
        </div>
      </section>

      {/* ── Explorer evidence strip (§5.2) ──────────────────────────────── */}
      <ExplorerEvidenceStrip />

      {/* ── Compare slider (§5.3) ───────────────────────────────────────── */}
      <CompareDemo className="py-16" />

      {/* ── Three-layer band (§5.4) ─────────────────────────────────────── */}
      <section className="max-w-content mx-auto px-8 py-16">
        <p className="text-small text-manifest/50 uppercase tracking-wider">Three layers</p>
        <h2 className="text-h1 text-manifest mt-2">
          Truth, money, and authority are separate systems.
        </h2>
        <p className="text-body text-manifest/60 mt-3 max-w-xl prose">
          No single layer can approve a payment on its own. Each one is a real deployment you
          can check.
        </p>

        <div className="grid gap-4 md:grid-cols-3 mt-8">
          {LAYERS.map(({ layer, sponsor, detail, href, external, cta }) => (
            <MeshGradient key={layer} className="rounded-doc border border-hairline">
              <div className="flex h-full flex-col p-6">
                <p className="text-small text-manifest/50 uppercase tracking-wider">{layer}</p>
                <p className="text-h2 text-manifest mt-1">{sponsor}</p>
                <p className="text-body text-manifest/70 mt-3 grow prose">{detail}</p>

                {external ? (
                  <a
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    className="text-small text-seal mt-6 hover:underline"
                  >
                    {cta} ↗
                  </a>
                ) : (
                  <Link href={href} className="text-small text-seal mt-6 hover:underline">
                    {cta} →
                  </Link>
                )}
              </div>
            </MeshGradient>
          ))}
        </div>
      </section>

      {/* ── Live receipt strip (§5.5) ───────────────────────────────────── */}
      <ReceiptCounter />

      {/* ── Sponsor strip + footer (§5.6) ───────────────────────────────── */}
      <section className="max-w-content mx-auto px-8 py-8 border-t border-hairline">
        <p className="text-small text-manifest/30 mb-4">Built with</p>
        <div className="flex flex-wrap items-center gap-8">
          {['The Graph', 'Arc', 'Chainlink'].map((name) => (
            <div
              key={name}
              className="text-small text-manifest/50 border border-hairline px-3 py-1.5 rounded-control"
            >
              {name}
            </div>
          ))}
        </div>
        <p className="text-small text-manifest/20 mt-8">
          © Bonded 2026. Built at ETHOnline 2026.
        </p>
      </section>
    </main>
  );
}
