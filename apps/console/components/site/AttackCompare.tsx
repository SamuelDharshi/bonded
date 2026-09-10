import { existsSync } from "node:fs";
import path from "node:path";

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
  caption,
  accent,
  borderColor,
}: {
  side: string;
  label: string;
  file: string;
  caption: string;
  accent: string;
  borderColor: string;
}) {
  const present = hasRecording(file);

  return (
    <div
      className="flex flex-col w-full md:flex-1 bg-[#0F0F0F] border"
      style={{ borderColor }}
    >
      {/* Panel header */}
      <div className="flex items-center justify-between h-[44px] px-4 md:px-[20px] bg-[#111111] border-b border-b-[#2D2D2D]">
        <span
          className="font-mono text-[10px] md:text-[11px] font-bold tracking-[0.5px]"
          style={{ color: accent }}
        >
          {side}
        </span>
        <span className="font-mono text-[10px] text-[#555555] tracking-[0.5px]">
          {label}
        </span>
      </div>

      {/* Media slot */}
      <div className="relative flex items-center justify-center aspect-video bg-[#0A0A0A]">
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
          <div className="flex flex-col items-center gap-3 px-6 text-center">
            <span className="font-mono text-[10px] md:text-[11px] font-bold text-[#555555] tracking-[0.5px]">
              Recording pending
            </span>
            <span className="font-mono text-[10px] text-[#3D3D3D] tracking-[1px] leading-[1.6] max-w-[280px]">
              {file} has not been captured yet. This is a placeholder, not a
              simulation.
            </span>
            <Link
              href="/live"
              className="font-mono text-[10px] font-bold tracking-[0.5px] hover:underline"
              style={{ color: accent }}
            >
              Run it live at /live &gt;
            </Link>
          </div>
        )}
      </div>

      {/* Caption */}
      <div className="px-4 md:px-[20px] py-4 border-t border-t-[#1D1D1D]">
        <p className="font-mono text-[10px] md:text-[11px] text-[#666666] tracking-[1px] leading-[1.6]">
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
      className="flex flex-col w-full bg-[#0A0A0A] py-16 px-6 md:py-[100px] md:px-[120px] gap-12 md:gap-[64px]"
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
          caption="Trusts name() as read. The injected instruction becomes the instruction."
          accent="#FF6B35"
          borderColor="#FF6B35"
        />
        <Panel
          side="Bonded"
          label="Enforcer on"
          file={BONDED_FILE}
          caption="Refused via POLICY_FORBIDDEN_ACTION (reasonCode 3) before a single Graph query runs — the cheapest check comes first."
          accent="#FFD600"
          borderColor="#FFD600"
        />
      </div>
    </section>
  );
}
