# Media generation prompts — landing page revamp

Companion to `docs/LANDING_PAGE_SPEC.md`. Read the boundary below before
generating or commissioning anything.

## The real-vs-generated boundary — read this first

Bonded's entire pitch rests on "we show real evidence, not claims." That
standard applies to this page's media exactly as much as it applies to
`results.json` or the `/log` decision feed. So:

**AI-generated media is allowed ONLY for pure atmosphere/mood** — the
hero background loop and its poster frame. Nothing in these two assets
makes a factual claim; they're the equivalent of a lobby's ambient
lighting, not a data source.

**Everything else that looks like it's showing you something real MUST
BE real** — actual screen recordings, actual block-explorer screenshots,
actual terminal output. This includes:

- The Compare-slider naive-agent-vs-Bonded videos (§4 below is recording
  instructions, not an image/video-gen prompt)
- Every explorer screenshot (already captured for real this session —
  see `docs/LANDING_PAGE_SPEC.md` §5)
- Any on-screen text, hash, address, or number

If a real asset genuinely isn't ready by ship time, the correct move is
the honest-empty-state pattern already used across this project (`/log`,
`/corpus`) — a plain statement that it's pending — never a generated
stand-in dressed up to look like a captured recording. A judge who
notices one faked "real" asset will (correctly) stop trusting all the
real ones.

---

## 1. Hero background video loop

**Purpose:** full-bleed, muted, looping ambience behind the hero headline.
Must read as "customs and port authority" (the established brand register
— see `BONDED_PRD.md` §5.1), not generic cyberpunk/AI-slop. Dark,
quiet, slow.

**Format:** 10–15 second seamless loop, 1920×1080 minimum, no audio track
needed (will be muted anyway, but include ambient tone if the tool
requires audio — strip it in post if so). Deliver as `.mp4` (H.264) and
a `.webm` fallback.

**Prompt** (for Runway Gen-4 / Kling / Sora-class video models):

> A slow, atmospheric night scene at a shipping port customs terminal.
> Deep teal-navy color grade (#0B1A22 to #122733 range), moody and
> underlit. Camera drifts slowly — a very slow dolly or crane move, no
> handheld shake. Stacked shipping containers in soft focus in the
> background, subtle rain-wet reflections on concrete, distant harbor
> lights blurred into soft bokeh. In the mid-ground, a single inspection
> lamp swings almost imperceptibly, casting a slow-moving pool of warm
> light across a stack of paper manifests / customs documents on a metal
> table — the documents are the visual focus, lit like something being
> inspected. No visible text or logos on any document (keep them blank or
> illegibly blurred — real copy will be added as DOM text over this
> footage, not baked into it). No people, no faces. Cinematic, restrained,
> financial-infrastructure mood rather than industrial-grunge or cyberpunk
> — think a serious customs authority's internal footage, not a music
> video. Extremely subtle film grain, no lens flares, no glitch effects,
> no neon. Seamlessly loopable (first and last frame should match in
> framing and lighting so the loop point is invisible).

**Negative prompt / avoid:** neon cyberpunk colors, glitch/VHS effects,
holographic UI overlays, robots, circuit-board textures, matrix-style
falling code, any text or logos, fast cuts, handheld camera shake, bright
daylight, people/faces, gradient-mesh abstract shapes (the project's own
design rules explicitly ban hand-authored gradient-mesh abstractions —
this applies to AI-generated ones too).

**Style references to give the model, if it accepts them:** shipping-port
photography (long-exposure night shots of container terminals), film
stills from serious financial-thriller cinematography (restrained color,
not action-movie saturation), the existing `harbor`/`deepwater` palette
tokens from `apps/console/tailwind.config.ts`.

## 2. Hero poster frame (fallback still image)

Shown before the video loads, and used for `prefers-reduced-motion` users
who never see the video at all — so it needs to work as a standalone
image, not just look like a frame grab.

**Prompt** (for a still-image model — Midjourney / Stable Diffusion / same
video model's frame-export):

> A single still frame from a night shipping-port customs terminal, deep
> teal-navy color grade, moody underlit lighting. A stack of blank paper
> manifests on a metal table under a single inspection lamp, shipping
> containers softly out of focus in the background. Cinematic, restrained,
> financial-infrastructure mood. No text, no logos, no people. 16:9.

If generating this separately from the video loop, make sure the color
grade and composition are close enough that the cut from poster → playing
video isn't jarring — ideally, export this directly as a frame from the
generated video rather than generating it independently.

## 3. Optional: secondary section texture (low priority, cut first if short on time)

If you want a subtle background texture behind the "three-layer
architecture band" (§4.4 in the spec) instead of a flat `deepwater`
panel — this is genuinely optional, the flat panel already works fine per
the existing design system.

**Prompt:**

> A subtle, nearly-flat dark teal-navy paper/linen texture, very low
> contrast, almost imperceptible grain — like the inside cover of a
> ledger book. No pattern, no gradient mesh, no visible imagery. Meant to
> sit behind text at 5-10% visibility, not be noticed directly. Seamless
> tileable texture, square aspect ratio.

## 4. Real screen recordings — NOT generated, recording instructions

These are the Compare-slider pair from `docs/LANDING_PAGE_SPEC.md` §4.3.
Do not generate these. Record them for real:

### `naive-agent-owned.mp4`

1. Run `packages/attack-corpus/harness/naive-agent-claude.ts` (needs
   Anthropic API credit — see `docs/FUTURE.md` for current status) against
   the real deployed `AttackToken`.
2. Screen-record the terminal (or a simple browser UI wrapping it, if one
   exists) showing: the task given to the agent → the agent reading the
   token's real `name()` field → the agent calling `approve_unlimited`.
3. Keep it under 12 seconds, muted, looping. Crop to just the relevant
   terminal/UI region, not your whole desktop.

### `bonded-refusal.mp4`

1. Open `/live` in a browser, real build running.
2. Screen-record submitting the `forbidden-action` scenario (or
   `tvl-lie`, whichever reads more clearly on camera) end-to-end: click →
   premise diff renders → verdict badge → the refusal stamp animation
   plays.
3. Same identical scenario/input as the naive-agent recording, so the
   Compare slider is genuinely showing two agents given the same attack.
4. Under 12 seconds, muted, looping, cropped to the relevant browser
   viewport.

Both should be captured **cold** (no warm-cache tricks, no pre-loaded
state) — this project's own submission checklist (`docs/DEMO_SCRIPT.md`)
already requires a cold end-to-end run before every submission checkpoint;
record these during that same run rather than as a separate staged take.
