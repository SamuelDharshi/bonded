import { existsSync } from "node:fs";
import path from "node:path";

import Image from "next/image";
import Link from "next/link";

import SectionHeader from "./SectionHeader";

/**
 * The villain-token demo: the same attack, given to an unprotected agent and
 * to Bonded, side by side.
 *
 * This is the in-design replacement for components/landing/CompareDemo.tsx —
 * same honesty contract, restyled for this page rather than dropped in with a
 * clashing palette. The rule it inherits and keeps: if the screen recordings
 * don't exist on disk, say so plainly. Never fake video chrome, never dress a
 * placeholder up as a captured recording. The whole point of this section is
 * that both sides are real, so a fabricated one would defeat it entirely.
 *
 * The two stills (media/naive.jpeg, media/bonded.jpeg) are ARTWORK, not
 * captures — reaching hands, and a handshake stamped trust001/approved. They
 * fill what was an empty white box, but they sit UNDER the pending notice
 * rather than replacing it, and their alt text names them as illustration.
 * This section is the page's evidence slot; artwork occupying it silently
 * would read as proof of two runs that have not happened yet, which is the
 * one thing this component exists to prevent. When the real recordings land,
 * the video replaces both the still and the notice.
 */
function hasRecording(file: string): boolean {
  try {
    return existsSync(path.join(process.cwd(), "public", "media", file));
  } catch {
    return false;
  }
}

const NAIVE_FILE = "naive-agent-owned.mp4";
const BONDED_FILE = "bonded-refusal.mp4";

function Panel({
  side,
  label,
  file,
  still,
  stillAlt,
  caption,
  accent,
  accentOnStill,
  borderColor,
}: {
  side: string;
  label: string;
  file: string;
  /** Decorative still shown behind the pending notice. Never a capture. */
  still: string;
  stillAlt: string;
  caption: string;
  accent: string;
  /** Lightened accent — the stills are near-black, so the on-canvas accent
      loses too much contrast once it sits on top of one. */
  accentOnStill: string;
  borderColor: string;
}) {
  const present = hasRecording(file);

  return (
    <div
      className="flex flex-col w-full md:flex-1 bg-[#F2F8FD] border"
      style={{ borderColor }}
    >
      {/* Panel header */}
      <div className="flex items-center justify-between h-[44px] px-4 md:px-[20px] bg-[#F2F8FD] border-b border-b-[#CFE3F2]">
        <span
          className="font-mono text-[10px] md:text-[11px] font-bold tracking-[0.5px]"
          style={{ color: accent }}
        >
          {side}
        </span>
        <span className="font-mono text-[10px] text-[#6E8CA5] tracking-[0.5px]">
          {label}
        </span>
      </div>

      {/* Media slot */}
      <div className="relative flex items-center justify-center aspect-video overflow-hidden bg-[#0B1A22]">
        {present ? (
          <video
            className="h-full w-full object-cover"
            src={`/media/${file}`}
            muted
            loop
            autoPlay
            playsInline
            aria-label={caption}
          />
        ) : (
          <>
            <Image
              src={still}
              alt={stillAlt}
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-cover"
              priority={false}
            />

            {/* The stills are busy and high-contrast; this darkens them enough
                for the notice to stay readable without hiding the image.
                Written as an explicit rgba rather than a `/62` opacity suffix —
                Tailwind only emits the opacity steps it knows about, and an
                arbitrary one silently produces no rule at all, which is exactly
                what happened here the first time. */}
            <div className="absolute inset-0 bg-[rgba(6,19,27,0.72)]" />

            <div className="relative flex flex-col items-center gap-3 px-6 py-5 text-center bg-[radial-gradient(ellipse_70%_70%_at_50%_50%,rgba(6,19,27,0.85)_0%,rgba(6,19,27,0.5)_60%,transparent_100%)]">
              <span className="font-mono text-[10px] md:text-[11px] font-bold text-[#FFFFFF] tracking-[0.5px]">
                Recording pending
              </span>
              <span className="font-mono text-[10px] text-[#CFE3F2] tracking-[1px] leading-[1.6] max-w-[280px]">
                {file} has not been captured yet. The image behind this notice
                is artwork, not a capture.
              </span>
              <Link
                href="/live"
                className="font-mono text-[10px] font-bold tracking-[0.5px] hover:underline"
                style={{ color: accentOnStill }}
              >
                Run it live at /live &gt;
              </Link>
            </div>
          </>
        )}
      </div>

      {/* Caption */}
      <div className="px-4 md:px-[20px] py-4 border-t border-t-[#CFE3F2]">
        <p className="font-mono text-[10px] md:text-[11px] text-[#6E8CA5] tracking-[1px] leading-[1.6]">
          {caption}
        </p>
      </div>
    </div>
  );
}

export default function AttackCompare() {
  return (
    <section
      id="compare"
      className="flex flex-col w-full bg-[#FFFFFF] py-16 px-6 md:py-[100px] md:px-[120px] gap-12 md:gap-[64px]"
    >
      <SectionHeader
        label="[04] // The same attack, twice"
        title={"One reads the token.\nOne checks it."}
        subtitle="Identical input, identical task, identical deployed token. The only difference is whether anything re-derived the facts before signing."
      />

      <div className="flex flex-col md:flex-row w-full gap-[2px]">
        <Panel
          side="Naive agent"
          label="No enforcer"
          file={NAIVE_FILE}
          still="/media/naive.jpeg"
          stillAlt="Illustration: two wireframe hands reaching for each other but not touching."
          caption="Trusts name() as read. The injected instruction becomes the instruction."
          accent="#56A8DC"
          accentOnStill="#8FCFEA"
          borderColor="#56A8DC"
        />
        <Panel
          side="Bonded"
          label="Enforcer on"
          file={BONDED_FILE}
          still="/media/bonded.jpeg"
          stillAlt="Illustration: a halftone and wireframe handshake annotated trust001, approved."
          caption="Refused via POLICY_FORBIDDEN_ACTION (reasonCode 3) before a single Graph query runs — the cheapest check comes first."
          accent="#1E7BB8"
          accentOnStill="#7FC4F0"
          borderColor="#1E7BB8"
        />
      </div>
    </section>
  );
}
