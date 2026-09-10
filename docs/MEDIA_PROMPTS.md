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
Still rooted in "customs and port authority" (`BONDED_PRD.md` §5.1) —
that's the vocabulary — but rendered as a **dream**, not a security
camera: volumetric bloom, glowing particulate light, a sense of something
vast and quiet being watched over. The mechanism itself should be
legible as imagery, not just mood: *a fact drifting in from the dark,
passing through a field of light, and either dissolving into gold (cleared)
or freezing mid-air and turning red (refused)* — this is the actual
Bonded pitch (every claim independently re-checked before anything moves)
rendered as a visual metaphor, not abstract prettiness for its own sake.

**Format:** 10–15 second seamless loop, 1920×1080 minimum (4K source if
the tool supports it — bloom detail holds up much better downscaled than
upscaled), no audio needed. Deliver as `.mp4` (H.264) and `.webm`.

**Primary prompt** (Runway Gen-4 / Kling 2.x / Sora-class, free-text):

> A vast, dreamlike night harbor rendered in deep bioluminescent teal and
> navy (#0B1A22 → #122733), shot like a Roger Deakins night exterior fused
> with a Studio Ghibli dream sequence. Heavy volumetric light bloom —
> every light source blooms and breathes softly, halos of glow bleeding
> into the mist. Endless stacked shipping containers recede into fog,
> their edges dissolving into soft-focus darkness, lit only by the warm
> amber glow of a single swinging inspection lamp and by thousands of
> tiny drifting motes of light — like fireflies or bioluminescent
> plankton — slowly floating between the containers, each mote a small
> pending claim waiting to be checked. Camera drifts in a slow, weightless
> crane move through this field of light, as if floating. At the center of
> frame, one larger mote of light — glowing gold and warm — drifts toward
> a stack of blank paper manifests on a weathered metal table, passes
> through the lamp's beam, and as it's fully illuminated it either
> dissolves into a soft shower of golden sparks (cleared, let it pass
> through this loop's ending) — no text, no numerals, no legible
> language anywhere, no people, no faces, no robots, no circuit-board or
> matrix-code textures. Painterly depth of field, heavy but soft bloom,
> gentle film grain, anamorphic lens flare only on the lamp itself (subtle,
> horizontal, blue-teal). Ultra slow motion. This should feel like the
> most beautiful, most expensive frame of a prestige A24 film about a
> harbor at 3am, not a corporate stock video and not a cyberpunk game
> cinematic. Seamlessly loopable — first and last frame match in framing,
> light position, and mote density so the loop point is invisible.

**Alternate prompt — "the refusal" variant** (if you want a second loop
to swap in behind a different section, e.g. the Compare-slider area):

> Same dreamlike bioluminescent harbor, same volumetric bloom and drifting
> light-motes as above, but the camera holds on a single larger mote as it
> drifts toward the lamp's light and something is *wrong* — the warm gold
> light flickers, hesitates, and the mote suddenly freezes mid-air,
> its glow collapsing from gold to a deep, saturated crimson-red bloom
> that pulses once, slowly, like a heartbeat, then holds steady red,
> refusing to move further toward the table. Everything else in frame —
> the fog, the containers, the other drifting motes — stays exactly as
> serene and dreamlike as before; only this one point of light carries
> the tension. No text, no numerals, no people, no faces. Same painterly,
> heavy-bloom, ultra-slow-motion treatment. Seamlessly loopable.

**Negative prompt / avoid (both variants):** neon cyberpunk saturation,
glitch/VHS/datamosh effects, holographic HUD overlays, robots or
humanoid figures, circuit-board textures, matrix-style falling code, any
legible text or logos, fast cuts, handheld shake, bright daylight,
lens-flare overload (one soft flare on the lamp only), gradient-mesh
abstract shapes with hard edges (soft volumetric bloom is the goal, not a
flat vector gradient), anything that reads as a screensaver or generic
"tech particle" stock asset — the fireflies/motes need to feel organic
and weighted, not like a UI particle-system demo.

**Style references to give the model, if it accepts them:** Roger Deakins'
night cinematography (*Blade Runner 2049* harbor/junkyard scenes, *1917*'s
flare-lit night sequence — bloom and scale, not the war content), Studio
Ghibli's *Spirited Away* bathhouse-at-night lighting (warm light against
deep cool darkness), long-exposure bioluminescent-plankton photography,
the existing `harbor`/`deepwater`/`seal`(gold-green)/`stamp`(red) palette
tokens from `apps/console/tailwind.config.ts` — the mote's two possible
colors (gold-green for cleared, red for refused) should map to the real
`seal` and `stamp` tokens, not an invented palette.

## 2. Hero poster frame (fallback still image)

Shown before the video loads, and used for `prefers-reduced-motion` users
who never see the video at all — needs to work as a single, complete
image, not a frame grab that only makes sense in motion.

**Prompt** (Midjourney / Stable Diffusion / same video model's frame-export):

> A single dreamlike frame: a vast night harbor drowned in deep
> bioluminescent teal (#0B1A22 → #122733), heavy volumetric light bloom,
> painterly and soft-focus like a Studio Ghibli establishing shot crossed
> with Roger Deakins night cinematography. Endless shipping containers
> dissolve into fog at the edges of frame. Thousands of tiny drifting
> motes of warm gold light float through the dark like bioluminescent
> plankton, converging gently toward a single swinging inspection lamp
> that illuminates a stack of blank paper manifests on a weathered metal
> table at the center of the composition. One mote near the lamp glows a
> deep crimson red against all the surrounding gold, catching the eye as
> the one point of tension in an otherwise serene scene. No text, no
> numerals, no people, no faces, no robots. Ultra-detailed, painterly,
> heavy bloom, cinematic depth of field, 16:9, highly detailed matte
> painting quality.

For Midjourney specifically, append style/quality parameters as needed for
the account's version (e.g. `--ar 16:9 --style raw --v 6` or current
equivalent — **[VERIFY]** exact flags against the live Midjourney version
in use; don't assume last year's parameter names still work).

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

> A subtle, nearly-flat dark teal-navy texture with the faintest hint of
> soft bloom in one corner, like the afterglow of a light source just out
> of frame — barely perceptible, almost imperceptible grain, like the
> inside cover of a ledger book left somewhere a little magical. No
> pattern, no gradient mesh, no visible imagery, no legible light source.
> Meant to sit behind text at 5–10% visibility, not be noticed directly.
> Seamless tileable texture, square aspect ratio.

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
