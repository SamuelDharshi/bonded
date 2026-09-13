"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

/**
 * The hero's copy of the logo.
 *
 * Paired with the navbar's copy: this one is visible while the hero is in view
 * and fades out as you scroll past it; the navbar's does the exact opposite.
 * The mark is therefore never on screen twice and never absent — it reads as one
 * logo moving up into the bar, rather than two logos blinking in and out.
 *
 * Both halves are driven by `window.scrollY` against the same constants below,
 * so they cannot disagree part-way through the handover. An intersection
 * observer on the hero would have been the obvious alternative and is worse
 * here: two observers with different thresholds produce a window where both
 * logos are half-visible, which is exactly the "weird" a crossfade has to avoid.
 *
 * Kept as its own client component so Hero stays a server component.
 */

/** Below this scroll offset the hero owns the logo outright. */
export const LOGO_HANDOVER_START = 40;
/** Above this the navbar owns it outright. Between the two, they crossfade. */
export const LOGO_HANDOVER_END = 160;

/** 1 while the hero should show the mark, 0 once the navbar has taken it. */
export function heroLogoVisibility(scrollY: number): number {
  if (scrollY <= LOGO_HANDOVER_START) return 1;
  if (scrollY >= LOGO_HANDOVER_END) return 0;
  return 1 - (scrollY - LOGO_HANDOVER_START) / (LOGO_HANDOVER_END - LOGO_HANDOVER_START);
}

export function HeroLogo() {
  // Starts at 1 so the logo is present in the server-rendered markup and on the
  // first client frame — a logo that pops in after hydration is worse than one
  // that never animates.
  const [visibility, setVisibility] = useState(1);

  useEffect(() => {
    const onScroll = () => setVisibility(heroLogoVisibility(window.scrollY));
    onScroll(); // a reload partway down the page must not start with it visible
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      aria-hidden={visibility === 0}
      className="relative z-10 will-change-[opacity,transform,filter]"
      style={{
        opacity: visibility,
        // Rises slightly and loses a little scale on the way out, so it travels
        // toward the bar instead of simply dimming in place.
        transform: `translateY(${(1 - visibility) * -14}px) scale(${0.965 + visibility * 0.035})`,
        // A small blur on the outgoing frames keeps the edges from strobing
        // against the video behind it. More than ~4px reads as a focus pull.
        filter: `blur(${(1 - visibility) * 3.5}px)`,
        transition: "opacity 120ms linear, transform 120ms linear, filter 120ms linear",
      }}
    >
      <Image
        src="/media/bonded_logo.png"
        alt="Bonded"
        width={132}
        height={132}
        priority
        className="w-[88px] h-[88px] md:w-[128px] md:h-[128px] object-contain rounded-[26px] md:rounded-[32px]"
      />
    </div>
  );
}

export default HeroLogo;
