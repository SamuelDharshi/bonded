'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Hero background video.
 *
 * A client component rather than a plain <video> tag because
 * docs/LANDING_PAGE_SPEC.md §4/§8 requires the hero's motion to honour
 * prefers-reduced-motion, and autoplay can't be gated from CSS — it has to be
 * decided in JS before the element starts playing.
 *
 * Under reduced motion the video is rendered but held on its first frame
 * (paused, never played), so the composition is unchanged and only the motion
 * is removed. If the file fails to load entirely, `onError` hides the element
 * and the `.mesh-gradient` fallback on the parent shows through instead of a
 * blank block.
 */
export function HeroVideo({
  src = '/media/hero-background.mp4',
  className = '',
}: {
  src?: string;
  className?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    const apply = () => {
      if (motionQuery.matches) {
        video.pause();
        video.currentTime = 0; // hold the first frame
      } else {
        // play() rejects on some browsers/policies; a failed autoplay just
        // leaves a static frame, which is an acceptable degradation.
        void video.play().catch(() => undefined);
      }
    };

    apply();
    motionQuery.addEventListener('change', apply);
    return () => motionQuery.removeEventListener('change', apply);
  }, []);

  if (failed) return null;

  return (
    <video
      ref={videoRef}
      className={`h-full w-full object-cover ${className}`.trim()}
      src={src}
      muted
      loop
      playsInline
      preload="metadata"
      // autoPlay is intentionally omitted: the effect above starts playback
      // only when reduced motion is off.
      aria-hidden
      onError={() => setFailed(true)}
    />
  );
}

export default HeroVideo;
