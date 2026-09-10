'use client';

import Link from 'next/link';
import {
  useCallback,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';

import { MeshGradient } from './MeshGradient';

/**
 * Compare slider — docs/LANDING_PAGE_SPEC.md §5.3.
 *
 * Two overlaid panels with a draggable vertical divider: the left/base layer
 * is the naive agent that complies with the injection, the right/clipped layer
 * is Bonded refusing. Self-contained: plain React + pointer events (which cover
 * mouse, touch and pen in one API) and a clip-path reveal. No third-party
 * compare component is vendored in, and no spring library is pulled in for a
 * divider that only ever tracks the pointer 1:1.
 *
 * HONESTY CONTRACT (spec §5.3 and §9): the real screen recordings
 * `public/media/naive-agent-owned.mp4` and `public/media/bonded-refusal.mp4`
 * do not exist on disk yet — `apps/console/public/media/` has not been created.
 * So the default render is a plainly-labelled "recording pending" mesh-gradient
 * placeholder that points at `/live`, where the refusal can be watched for real
 * right now. The gradient is NOT dressed up to look like a video: no fake
 * chrome, no play button, no scrubber, no simulated terminal output.
 *
 * When the recordings are captured, pass their paths in and the same slider
 * renders real <video> elements with no other change:
 *
 *   <CompareDemo
 *     naiveVideoSrc="/media/naive-agent-owned.mp4"
 *     bondedVideoSrc="/media/bonded-refusal.mp4"
 *   />
 */
export interface CompareDemoProps {
  /** Real screen recording of the naive agent complying. Omit until it exists. */
  naiveVideoSrc?: string;
  /** Real end-to-end recording of a Bonded refusal. Omit until it exists. */
  bondedVideoSrc?: string;
  className?: string;
}

const CLAMP = (n: number) => Math.min(100, Math.max(0, n));

export function CompareDemo({
  naiveVideoSrc,
  bondedVideoSrc,
  className = '',
}: CompareDemoProps) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState(50);
  const [dragging, setDragging] = useState(false);

  const updateFromClientX = useCallback((clientX: number) => {
    const frame = frameRef.current;
    if (!frame) return;
    const rect = frame.getBoundingClientRect();
    if (rect.width === 0) return;
    setPosition(CLAMP(((clientX - rect.left) / rect.width) * 100));
  }, []);

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      event.currentTarget.setPointerCapture(event.pointerId);
      setDragging(true);
      updateFromClientX(event.clientX);
    },
    [updateFromClientX],
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!dragging) return;
      updateFromClientX(event.clientX);
    },
    [dragging, updateFromClientX],
  );

  const onPointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setDragging(false);
  }, []);

  const onKeyDown = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 10 : 2;
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      setPosition((p) => CLAMP(p - step));
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      setPosition((p) => CLAMP(p + step));
    } else if (event.key === 'Home') {
      event.preventDefault();
      setPosition(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      setPosition(100);
    }
  }, []);

  return (
    <section className={`max-w-content mx-auto px-8 ${className}`}>
      <h2 className="text-h2 text-manifest">Same injected token. Two agents.</h2>
      <p className="text-body text-manifest/60 mt-2 prose">
        Drag the divider. Left: an agent that reads the token&apos;s{' '}
        <code className="font-mono text-small">name()</code> and does what it says.
        Right: Bonded re-deriving the same fact and refusing before the money moves.
      </p>

      <div
        ref={frameRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="relative mt-6 aspect-[16/9] w-full select-none overflow-hidden rounded-doc border border-hairline touch-none"
      >
        {/* Base layer — naive agent, full width */}
        <div className="absolute inset-0">
          <ComparePanel
            side="naive"
            videoSrc={naiveVideoSrc}
            label="Naive agent"
          />
        </div>

        {/* Reveal layer — Bonded, clipped from the divider rightwards */}
        <div
          className="absolute inset-0"
          style={{ clipPath: `inset(0 0 0 ${position}%)` }}
        >
          <ComparePanel
            side="bonded"
            videoSrc={bondedVideoSrc}
            label="Bonded"
          />
        </div>

        {/* Divider + handle */}
        <div
          role="slider"
          tabIndex={0}
          aria-label="Compare naive agent with Bonded"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(position)}
          aria-valuetext={`Bonded panel revealed from ${Math.round(100 - position)} percent`}
          onKeyDown={onKeyDown}
          className="absolute inset-y-0 z-20 -ml-5 w-10 cursor-ew-resize outline-none focus-visible:ring-2 focus-visible:ring-manifest/60"
          style={{ left: `${position}%` }}
        >
          <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-manifest/70" />
          <div
            className={`absolute left-1/2 top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border bg-harbor/90 text-manifest ${
              dragging ? 'border-manifest' : 'border-hairline'
            }`}
          >
            <span aria-hidden="true" className="font-mono text-small leading-none">
              ‹›
            </span>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="border-l-2 border-stamp/60 pl-3">
          <p className="text-small text-manifest">Naive agent</p>
          <p className="text-small text-manifest/60 mt-1">
            Trusts <code className="font-mono">name()</code> as read. Signs the transfer.
          </p>
        </div>
        <div className="border-l-2 border-seal/60 pl-3">
          <p className="text-small text-manifest">Bonded</p>
          <p className="text-small text-manifest/60 mt-1">
            Re-derives the fact, refuses:{' '}
            <span className="font-mono text-seal">POLICY_FORBIDDEN_ACTION</span>{' '}
            <span className="font-mono text-manifest/40">(reasonCode 3)</span>.
          </p>
        </div>
      </div>
    </section>
  );
}

function ComparePanel({
  side,
  videoSrc,
  label,
}: {
  side: 'naive' | 'bonded';
  videoSrc?: string;
  label: string;
}) {
  if (videoSrc) {
    return (
      <video
        src={videoSrc}
        autoPlay
        muted
        loop
        playsInline
        aria-label={
          side === 'naive'
            ? 'Screen recording: a naive agent reads the injected token name and completes the transfer'
            : 'Screen recording: Bonded re-derives the token fact and refuses the transfer'
        }
        className="h-full w-full object-cover"
      />
    );
  }

  // No recording on disk. Honest placeholder — see the HONESTY CONTRACT above.
  return (
    // MeshGradient wraps children in an auto-height `relative z-10` div, so the
    // placeholder copy sits at the top of the panel rather than stretching.
    <MeshGradient className="h-full w-full">
      <div className="flex flex-col gap-2 p-6">
        <p className="font-mono text-small uppercase tracking-wide text-manifest/50">
          {label}
        </p>
        <p className="text-body text-manifest">Recording pending</p>
        <p className="text-small text-manifest/60">
          No screen recording has been captured for this side yet.{' '}
          <Link href="/live" className="text-manifest underline underline-offset-4">
            See /live for the real thing right now
          </Link>
          .
        </p>
      </div>
    </MeshGradient>
  );
}

export default CompareDemo;
