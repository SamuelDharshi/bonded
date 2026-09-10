# Noisy mesh gradient — implementation spec

Companion to `docs/LANDING_PAGE_SPEC.md`. This replaces the earlier
AI-generated-media plan entirely (the previous `docs/MEDIA_PROMPTS.md` is
gone — no video/photo generation anywhere on this page anymore). Every
slot that used to want a hero video, a recorded clip, or a generated
still now gets a **noisy mesh gradient**: pure CSS + SVG, zero external
asset files, fully code-defined and reviewable like any other component.

> **Scope note — the hero is the exception.** The hero now uses the React
> Bits `Grainient` WebGL component (`components/landing/Grainient.tsx`,
> `ogl` dependency) rather than the CSS gradient described here; see
> `docs/LANDING_PAGE_SPEC.md` §5.1 for its color mapping and required
> scrim. Everything in *this* file still applies to the **section panels**
> (evidence strip, three-layer band, receipt strip, compare placeholders),
> and the `.mesh-gradient` class additionally serves as the hero's
> no-WebGL fallback layer.

This is a stronger fit for this project than AI media was: nothing here
makes a factual claim, so there's no real-vs-generated tension to manage
— but it's also not a black-box asset someone generated once and dropped
in; it's a deterministic component with values you can read in a diff.

## 1. Palette

Five stops, as specified. `mesh-dark` reuses the site's existing `harbor`
token so the gradient's darkest end blends into the rest of the page
rather than introducing a sixth, disconnected color:

```css
/* apps/console/tailwind.config.ts — extend theme.colors */
'mesh-white':      '#F5F7FA',  /* off-white, not pure #FFF — pure white overpowers a dark-canvas site */
'mesh-light-blue':  '#8FCFEA',
'mesh-blue':         '#2E6FD9',
'mesh-dark':          '#0B1A22',  /* = harbor, reused, not a new value */
'mesh-black':         '#050608',
```

**[VERIFY before implementing]**: these are starting values, not
pantone-matched to anything — tune `mesh-light-blue` and `mesh-blue`
by eye once the gradient is actually rendering; noisy mesh gradients read
very differently on-screen than as flat hex swatches.

Existing semantic tokens (`seal`, `stamp`, `hold`) stay exactly as they
are and stay out of the mesh gradient palette — they remain reserved for
actual verdict states in the product UI (`/live`, `/log`). Don't blend
them into decorative backgrounds; that would dilute the one place on the
site where color carries meaning.

## 2. The mesh layer — CSS only, no canvas/WebGL needed

A mesh gradient is just several large, soft-edged radial gradients
layered and positioned so their blur zones overlap and blend. No library
needed:

```css
/* apps/console/app/globals.css, or a dedicated .module.css */
.mesh-gradient {
  position: relative;
  background-color: var(--mesh-dark);
  background-image:
    radial-gradient(at 15% 20%, var(--mesh-light-blue) 0px, transparent 50%),
    radial-gradient(at 85% 10%, var(--mesh-white) 0px, transparent 45%),
    radial-gradient(at 70% 65%, var(--mesh-blue) 0px, transparent 55%),
    radial-gradient(at 20% 80%, var(--mesh-black) 0px, transparent 50%),
    radial-gradient(at 90% 90%, var(--mesh-blue) 0px, transparent 40%);
  background-size: 180% 180%;
}
```

- `radial-gradient(at X% Y%, color 0px, transparent N%)` — the `0px`
  start keeps the color solid at its center, `transparent N%` controls
  how far it bleeds before fading. Larger `N%` = softer, more diffuse
  blob. Tune per-stop; 40–55% is a reasonable starting range.
- Five blobs (one per palette color plus a repeat) is enough for a
  "mesh" feel without becoming muddy — more than ~6 layered radials
  tends to average out to a flat wash rather than reading as distinct
  color regions.
- `background-size: 180% 180%` oversizes the gradient relative to its
  container so blob edges never show a hard container boundary, and gives
  room for the animation in §3 to pan without revealing empty edges.

### Per-section variants

Same technique, different blob position/size recipes, so each section
feels related but not identical:

- **Hero**: the full five-stop recipe above, largest blob spread, slowly
  animated (§3).
- **Evidence card backgrounds** (behind the real `AttackToken` data card,
  behind the three-layer band, behind the receipt counter): a **static**
  (non-animated — see motion budget in the landing spec) two-or-three-stop
  subset, smaller blob spread, lower opacity (~15–25% blended under the
  `deepwater` panel color via `background-blend-mode: soft-light` or
  similar) so it reads as texture behind real content, not competing with
  it.

## 3. Motion — the hero gradient is the site's one ambient motion slot

Per `docs/LANDING_PAGE_SPEC.md`'s motion budget (still three items, still
disciplined — this replaces "the hero video loop" as motion slot #2,
doesn't add a fourth):

```css
@keyframes mesh-drift {
  0%   { background-position: 0% 0%; }
  50%  { background-position: 100% 60%; }
  100% { background-position: 0% 0%; }
}

.mesh-gradient--animated {
  animation: mesh-drift 28s ease-in-out infinite;
}

@media (prefers-reduced-motion: reduce) {
  .mesh-gradient--animated {
    animation: none;
  }
}
```

- 28s is deliberately slow — this is ambience, the same "quiet, not an
  attention grab" requirement the video loop had. If it's noticeable as
  motion within the first second of looking at it, slow it down further.
- Evidence-card static variants get **no** `mesh-drift` animation at
  all — motion stays reserved for the hero, exactly as the video-based
  plan reserved it for the hero loop.
- `prefers-reduced-motion` freezes the hero gradient on its initial
  `background-position`, same principle as freezing a video on its poster
  frame.

## 4. The noise — SVG `feTurbulence`, no PNG texture file

Grain on top of the mesh, so it reads as "noisy mesh gradient" and not a
smooth, slightly-plasticky CSS gradient. Pure SVG filter, inlined, zero
binary assets:

```tsx
// apps/console/components/landing/GrainOverlay.tsx
export function GrainOverlay() {
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.05] mix-blend-overlay">
      <filter id="grain">
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" stitchTiles="stitch" />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width="100%" height="100%" filter="url(#grain)" />
    </svg>
  );
}
```

- `baseFrequency="0.85"` gives a fine, film-grain-scale noise; lower
  values (e.g. `0.1`–`0.3`) produce large blotchy noise, which reads as
  "broken image" rather than "grain" — stay in the `0.6`–`1.0` range.
  Tune by eye once rendering.
- `feColorMatrix type="saturate" values="0"` strips any color the
  turbulence noise would otherwise carry, keeping it a pure luminance
  grain that works over any of the mesh colors underneath.
- `opacity-[0.05]` (5%) is a starting point — noise this subtle should
  be felt more than seen. Push toward 8–10% only if the gradient
  underneath still looks too clean/digital at 5%.
- One `<GrainOverlay />` instance, absolutely positioned, stacked over
  every `.mesh-gradient` container (hero and the smaller section
  variants) — same component, reused, not regenerated per section.

## 5. Full component sketch

```tsx
// apps/console/components/landing/MeshGradient.tsx
import { GrainOverlay } from './GrainOverlay';

export function MeshGradient({
  animated = false,
  className = '',
  children,
}: {
  animated?: boolean;
  className?: string;
  children?: React.ReactNode;
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
```

Usage:

```tsx
// Hero
<MeshGradient animated className="min-h-screen">
  <TypewriterHeadline />
  {/* subcopy, CTAs */}
</MeshGradient>

// Evidence card background
<MeshGradient className="rounded-doc">
  <AttackTokenCard />
</MeshGradient>
```

## 6. Performance notes

- This is all CSS/SVG, rendered by the GPU compositor — no video decode,
  no large file download, no layout shift waiting for media to load. This
  is meaningfully cheaper than the video-hero plan it replaces, both in
  page weight and in implementation complexity.
- `background-size: 180% 180%` plus a 28s animation is a `background-
  position` tween, which is compositor-friendly and won't jank even on
  low-end devices — no need for `will-change` tricks unless profiling
  says otherwise.
- The SVG noise filter is computed once and composited as a blend mode;
  cost is negligible at the opacity levels specified here.
