'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Animates 0 → value on mount, then holds at the real value.
 *
 * The honesty property that matters here (docs/LANDING_PAGE_SPEC.md §5.5, §9):
 * the REAL number is what server-renders. Client components still render their
 * initial HTML on the server, so `value` is in the markup before any JS runs —
 * with JS disabled, JS blocked, or prefers-reduced-motion set, the reader sees
 * the true figure and never a fabricated intermediate one. The animation is
 * decoration layered on top of a correct number, never the source of it.
 */
export function CountUp({ value, className }: { value: number; className?: string }) {
  const [display, setDisplay] = useState(value);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    // Nothing to animate toward, or the user asked for no motion — leave the
    // server-rendered real value exactly as it is.
    if (value <= 0) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    const DURATION = 800;
    let start: number | null = null;

    setDisplay(0);

    const step = (ts: number) => {
      if (start === null) start = ts;
      const t = Math.min(1, (ts - start) / DURATION);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      setDisplay(Math.round(value * eased));
      if (t < 1) {
        frameRef.current = window.requestAnimationFrame(step);
      } else {
        setDisplay(value); // always land exactly on the real number
      }
    };

    frameRef.current = window.requestAnimationFrame(step);

    return () => {
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
    };
  }, [value]);

  return <span className={className}>{display}</span>;
}

export default CountUp;
