import Image from "next/image";
import Link from "next/link";

import SectionHeader from "./SectionHeader";

/**
 * The villain-token demo: the same attack, given to an unprotected agent and
 * to Bonded, side by side.
 *
 * This is the in-design replacement for components/landing/CompareDemo.tsx.
 *
 * There is deliberately no video slot. An earlier version checked disk for
 * screen recordings and rendered a "recording pending" notice when they were
 * absent; the recordings are not going to be made, so the notice was
 * advertising a gap rather than filling one.
 *
 * What remains carries no evidential claim. The two stills (media/naive.jpeg,
 * media/bonded.jpeg) are ARTWORK — reaching hands, and a handshake stamped
 * trust001/approved — and their alt text says so. The load-bearing content of
 * this section is the captions, which describe what each side does, and the
 * link to /live, where the reader can run the real thing against live Graph
 * data instead of watching a recording of someone else doing it.
 */
function Panel({
  side,
  label,
  still,
  stillAlt,
  caption,
  accent,
  accentOnStill,
  borderColor,
}: {
  side: string;
  label: string;
  /** Decorative artwork. Never a capture, never presented as one. */
  still: string;
  stillAlt: string;
  caption: string;
  accent: string;
  /** Lightened accent — the stills are near-black, so the on-canvas accent
      loses too much contrast once it sits on top of one. */
  accentOnStill: string;
  borderColor: string;
}) {
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

      {/* Artwork + the one thing worth clicking. */}
      <div className="relative flex items-center justify-center aspect-video overflow-hidden bg-[#0B1A22]">
        <Image
          src={still}
          alt={stillAlt}
          fill
          sizes="(max-width: 768px) 100vw, 50vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-[rgba(6,19,27,0.55)]" />
        <Link
          href="/app/start"
          className="relative font-mono text-[11px] font-bold tracking-[0.5px] hover:underline"
          style={{ color: accentOnStill }}
        >
          Put your own rules behind it &gt;
        </Link>
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
