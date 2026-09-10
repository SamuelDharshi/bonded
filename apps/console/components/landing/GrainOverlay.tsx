'use client';

import { useId } from 'react';

/**
 * SVG feTurbulence grain, stacked over a `.mesh-gradient` container so the
 * gradient reads as a *noisy* mesh rather than a smooth, plasticky CSS wash.
 * See docs/GRADIENT_SPEC.md §4. Zero binary assets.
 *
 * `baseFrequency="0.85"` is film-grain scale; values below ~0.6 read as
 * "broken image" blotches rather than grain.
 *
 * The filter id is generated per instance via useId() so that multiple
 * overlays on one page (hero + each evidence panel) never collide on a
 * duplicate SVG id.
 */
export function GrainOverlay() {
  const filterId = `grain-${useId().replace(/:/g, '')}`;

  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.05] mix-blend-overlay"
    >
      <filter id={filterId}>
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.85"
          numOctaves={3}
          stitchTiles="stitch"
        />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width="100%" height="100%" filter={`url(#${filterId})`} />
    </svg>
  );
}

export default GrainOverlay;
