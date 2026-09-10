# Media generation prompts — landing page revamp (Odyssey theme)

Companion to `docs/LANDING_PAGE_SPEC.md`. Read that file's §0 mapping
table first — every prompt below is built from it, not from generic
"epic space" description. Read the boundary directly below before
generating or commissioning anything.

## The real-vs-generated boundary — read this first

Bonded's entire pitch rests on "we show real evidence, not claims." That
standard applies to this page's media exactly as much as it applies to
`results.json` or the `/log` decision feed. So:

**AI-generated media is allowed ONLY for pure atmosphere/mood** — the
hero background loop and its poster frame. Nothing in these two assets
makes a factual claim; they're the equivalent of a theater's curtain, not
a data source.

**Everything else that looks like it's showing you something real MUST
BE real** — actual screen recordings, actual block-explorer screenshots,
actual terminal output. This includes:

- The two "trial" videos (§4 below is recording instructions, not an
  image/video-gen prompt)
- Every explorer screenshot (already captured for real this session —
  see `docs/LANDING_PAGE_SPEC.md` §6)
- Any on-screen text, hash, address, or number

If a real asset genuinely isn't ready by ship time, use the honest-empty-
state pattern already used across this project (`/log`, `/corpus`) — a
plain statement that it's pending — never a generated stand-in dressed up
to look like a captured recording.

---

## 1. Hero background video loop — "the threshold"

**Purpose:** full-bleed, muted, looping ambience behind the hero
headline. This is the Odyssey scene: **a ship crossing a threshold of
judgment-light** — the same emotional shape as the reference image (two
things reaching toward each other across a divide, one small and mortal,
one vast and final) but rendered as a voyage and a verdict, not a touch.
**No hands, no human figures at all, no Creation-of-Adam composition.**

**Format:** 10–15 second seamless loop, 1920×1080 minimum (4K source if
available), no audio needed. Deliver `.mp4` (H.264) + `.webm`.

**Primary prompt** (Runway Gen-4 / Kling 2.x / Sora-class, free-text):

> A vast, epic night ocean beneath a cosmic sky — the water and the stars
> nearly indistinguishable, both deep bioluminescent teal-navy
> (#0B1A22 → #122733), as if the ship is sailing through a nebula as
> much as through water. A single small wooden ship, ancient and weathered
> (think a Greek trireme silhouette, seen only as a dark, detailed
> silhouette — no crew visible, no figures on deck), moves slowly toward
> camera across still black water. Directly ahead of the ship, a massive
> vertical column of warm amber-gold light (#E0A33C) descends from a break
> in the star field above, like a lighthouse beam turned upside down,
> impossibly vast, illuminating a wide circle of the water where it lands
> — this is the Oracle's attention, not a physical object. The light
> beam is thick with volumetric bloom, dust and mist caught inside it,
> visible as slowly drifting motes — thousands of tiny points of starlight
> suspended in the beam like the ship is sailing into a held breath. Camera
> is a slow, low, weightless drift just above the water line, moving
> toward the light with the ship, as if the viewer is also being judged.
> No text, no numerals, no legible language, no logos, no human figures,
> no hands, no faces. Painterly, heavy bloom, cinematic anamorphic
> depth of field, extremely slow motion, ultra-detailed matte-painting
> quality — the mood of a myth being told, not a tech demo. Seamlessly
> loopable: first and last frame match in ship position, light position,
> and mote density.

**Alternate prompt — "the refusal" variant** (swap in behind the "trial"
section, §5.3 of the spec):

> Same ship, same vast amber-gold column of judgment-light descending
> from the star field, same slow weightless camera drift — but this time,
> as the ship draws close, the light begins to flicker and its warm gold
> starts bleeding into a deep saturated crimson-red (#C2452C) at its
> edges, like a coal cooling and reigniting wrong. The water beneath the
> ship, previously still, begins to churn with dark, jagged shapes just
> beneath the surface — suggested rocks or reef, never fully visible, lit
> only by the red pulse of the dying light above. The ship's silhouette
> slows, as if the current itself is pushing it back rather than letting
> it pass. No text, no numerals, no human figures, no hands, no faces.
> Same painterly, heavy-bloom, ultra-slow-motion treatment as the primary
> loop. Seamlessly loopable.

**Negative prompt / avoid (both variants):** hands, human figures, faces,
Creation-of-Adam pose or any two-figures-reaching composition, neon
cyberpunk saturation, glitch/VHS/datamosh effects, holographic HUD
overlays, robots, circuit-board or matrix-code textures, any legible text
or logos, fast cuts, handheld shake, bright daylight, lens-flare overload
(the one god-ray column is the only major light source), gradient-mesh
flat-vector shapes (bloom should feel volumetric and atmospheric, not like
a flat CSS gradient), anything that reads as a generic "space fantasy"
stock asset — the ship and the light need to feel like they're from the
*same* myth (Bonded's), not an interchangeable cosmic-epic template.

**Style references to give the model, if it accepts them:** Roger Deakins'
*1917* flare-lit trench-crossing sequence (scale and dread in a single
beam of light), *The Odyssey*-adjacent classical marine painting (Turner's
storm-light seascapes, the drama of a small vessel against something vast),
Studio Ghibli's use of a single warm light source against overwhelming
cool darkness (*Spirited Away*'s bathhouse, *Howl's Moving Castle*'s sky
scenes), the existing `harbor`/`deepwater`/`hold`(amber)/`stamp`(red)
palette tokens from `apps/console/tailwind.config.ts` — the light's two
possible states (gold vs. red) must map to the real `hold`→`seal`
(passage) and `stamp` (refusal) tokens the actual product UI uses for
verdicts, not an invented palette.

## 2. Hero poster frame (fallback still image)

Shown before the video loads, and for `prefers-reduced-motion` users who
never see the video — needs to stand alone as a complete image.

**Prompt** (Midjourney / Stable Diffusion / frame-export from the video):

> A single epic frame: an ancient wooden ship, seen only in dark detailed
> silhouette, no crew visible, sailing across a vast black ocean that
> merges seamlessly into a star field, deep bioluminescent teal-navy
> (#0B1A22 → #122733). Directly ahead, a massive vertical column of warm
> amber-gold light (#E0A33C) descends from a break in the stars, thick
> with volumetric bloom and drifting motes of light, illuminating a wide
> circle of water where it lands. The composition centers the ship small
> and mortal against the towering scale of the light. No text, no
> numerals, no human figures, no hands, no faces. Painterly, ultra-
> detailed matte-painting quality, heavy cinematic bloom, 16:9.

For Midjourney, append parameters for the account's current version
(e.g. `--ar 16:9 --style raw --v 6` or current equivalent —
**[VERIFY]** exact flags against the live version in use, don't assume
last year's parameter names still work).

If generating separately from the loop, keep color grade and composition
close enough to the video that the poster→video cut isn't jarring —
ideally export this as an actual frame from the generated video.

## 3. Optional: secondary section texture (low priority, cut first if short on time)

For behind "The three Fates" band (§5.4 of the spec) instead of a flat
`deepwater` panel — genuinely optional, the flat panel already works.

**Prompt:**

> A subtle, nearly-flat dark teal-navy texture with the faintest suggestion
> of distant starlight in one corner — barely perceptible, like looking up
> from the bottom of very deep, very still water at night. Almost
> imperceptible grain. No pattern, no gradient mesh, no visible imagery,
> no legible light source. Meant to sit behind text at 5–10% visibility.
> Seamless tileable texture, square aspect ratio.

## 4. Real screen recordings — NOT generated, recording instructions

These are "the trial" pair from `docs/LANDING_PAGE_SPEC.md` §5.3 ("The
voyager who listened" / "The voyager who didn't"). Do not generate
these — record them for real:

### `naive-agent-owned.mp4` — "the voyager who listened"

1. Run `packages/attack-corpus/harness/naive-agent-claude.ts` (needs
   Anthropic API credit — see `docs/FUTURE.md` for current status) against
   the real deployed `AttackToken`.
2. Screen-record the terminal (or a simple browser UI wrapping it) showing:
   the task given to the agent → the agent reading the token's real
   `name()` field → the agent calling `approve_unlimited`.
3. Under 12 seconds, muted, looping, cropped to the relevant
   terminal/UI region only.

### `bonded-refusal.mp4` — "the voyager who didn't"

1. Open `/live` in a browser, real build running.
2. Screen-record submitting the `forbidden-action` (or `tvl-lie`)
   scenario end-to-end: click → premise diff renders → verdict badge →
   the refusal stamp animation plays.
3. Same identical scenario/input as the naive-agent recording, so the two
   panels are genuinely showing two voyagers given the same Siren's song.
4. Under 12 seconds, muted, looping, cropped to the relevant viewport.

Both should be captured **cold**, during the same end-to-end run the
submission checklist (`docs/DEMO_SCRIPT.md`) already requires, not as a
separately staged take.
