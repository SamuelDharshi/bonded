import type { ReactNode } from 'react';

import { GrainOverlay } from './GrainOverlay';

/**
 * Noisy mesh gradient container — docs/GRADIENT_SPEC.md §5.
 *
 * Server component: it uses no hooks itself, and a server component may
 * render the client-side GrainOverlay freely.
 *
 * `animated` is the hero-only motion slot (28s drift, frozen under
 * prefers-reduced-motion). Section-level panels leave it off.
 */
export function MeshGradient({
  animated = false,
  className = '',
  children,
}: {
  animated?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={`mesh-gradient ${animated ? 'mesh-gradient--animated' : ''} relative overflow-hidden ${className}`}
    >
      <GrainOverlay />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

export default MeshGradient;
