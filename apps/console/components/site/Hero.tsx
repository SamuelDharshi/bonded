import Link from "next/link";

import { HeroVideo } from "@/components/landing/HeroVideo";
import { TypewriterHeadline } from "@/components/landing/TypewriterHeadline";

/**
 * Hero — BONDED_PRD.md §6: "headline stating the mechanism, one line of
 * subcopy", and nothing here requires a wallet.
 *
 * The Compare slider the PRD makes the centrepiece of this section is rendered
 * directly beneath it by app/page.tsx (components/site/AttackCompare), so the
 * two read as one unit.
 *
 * The supplied footage sits behind all of it as a backdrop. It is near-black
 * in its original form, so it is inverted into the white + light-blue theme
 * rather than dropped in as a dark band — see `.glyph-art-light` in
 * globals.css for how, and why the wrapper owns the opacity.
 */
export default function Hero() {
  return (
    <section className="relative flex flex-col items-center justify-center w-full min-h-[560px] md:min-h-[720px] bg-[#FFFFFF] pt-16 pb-16 px-6 md:pt-[100px] md:pb-[100px] md:px-[120px] overflow-hidden">
      {/* Backdrop. Purely decorative, so it is hidden from assistive tech and
          sits behind everything; the wrapper carries the white ground that the
          video's multiply blend composites onto, and the opacity that keeps
          the glyphs strong enough to read as an image without swamping the
          type sitting on them. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[#FFFFFF] overflow-hidden"
      >
        <div className="absolute inset-0 opacity-[0.78]">
          {/* `isolate` keeps the two blends below scoped to this group: the
              video multiplies onto the group's own white, and the tint then
              recolours the result without either reaching the page. */}
          <div className="absolute inset-0 isolate bg-[#FFFFFF]">
            <HeroVideo className="glyph-art-light" />

            {/* Inverting the footage leaves its glyphs neutral grey, and turns
                the handful of amber marks in the original a faint orange —
                off-palette. A `color` blend takes hue and saturation from this
                layer and luminosity from the video, so every glyph lands in
                the light-blue family and the orange goes with it. White has no
                luminosity to shift, so the ground is unaffected. */}
            <div className="absolute inset-0 bg-[#2E7FBF] mix-blend-color" />
          </div>
        </div>

        {/* Dissolve the bottom edge into the page so the footage has no visible
            cut-off line where the hero meets the Compare slider. */}
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-b from-transparent to-[#FFFFFF]" />

        {/* Reading scrim. Deliberately partial: an opaque white plateau would
            make the footage invisible exactly where the viewer is looking, so
            this only lifts contrast under the text rather than erasing what is
            behind it. Peak alpha 0.62 in the centre, gone by the edges — the
            map stays legible as an image through the whole section. Contrast
            for the small type is bought back by darkening it below instead. */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_62%_72%_at_50%_46%,rgba(255,255,255,0.62)_0%,rgba(255,255,255,0.5)_45%,rgba(255,255,255,0.22)_74%,transparent_100%)]" />
      </div>

      {/* Badge */}
      <div className="relative z-10 flex items-center justify-center gap-[8px] h-[32px] px-[12px] md:px-[16px] bg-[#E7F1FA] border-2 border-[#1E7BB8]">
        <div className="w-[8px] h-[8px] bg-[#1E7BB8] shrink-0" />
        <span className="font-mono text-[9px] md:text-[11px] font-bold text-[#1E7BB8] tracking-[0.5px] whitespace-nowrap">
          Live on Arc testnet · ETHOnline 2026
        </span>
      </div>

      <div className="h-8 md:h-[32px]" />

      {/* Headline — Geist Pixel typewriter, cycling the six taglines. One of
          them is the real on-chain injection string, set apart in a deeper
          blue (the theme has no red — see TypewriterHeadline's doc). */}
      <TypewriterHeadline className="relative z-10 max-w-[1100px]" />

      <div className="h-6 md:h-[24px]" />

      {/* One line of subcopy, per the PRD.
          The 13-15px mono is the only text on this page small enough to lose
          against the glyph field, and it happens to land on the busiest band
          of the footage. It gets a local plate rather than a bigger global
          scrim — dimming the whole map to rescue two lines would undo the
          point of having the video there at all. The plate is wider and taller
          than the text so it reads as a soft bloom, not a box. */}
      <div className="relative z-10 w-full max-w-[980px] px-4 py-6 bg-[radial-gradient(ellipse_50%_60%_at_50%_50%,#FFFFFF_0%,rgba(255,255,255,0.96)_40%,rgba(255,255,255,0.75)_65%,transparent_100%)]">
        <p className="font-mono text-[13px] md:text-[15px] text-[#2C4E68] tracking-[0.5px] leading-[1.6] text-center mx-auto max-w-[820px]">
          The model proposes and states its reasons; an enforcer that never reads
          the prompt re-derives every one of them before the money moves.
        </p>
      </div>

      <div className="h-10 md:h-[48px]" />

      {/* CTAs
          Two paths, in the order people actually want them: set up the thing, or
          watch it work first. "Watch it refuse" was the only primary action for a
          long time, which pointed every visitor at a demo and left the product
          undiscoverable. It keeps equal visual weight as the second button
          because it is still the fastest way to understand what an account does.

          "Read the architecture" drops to a text link below. It is the right
          third step and the wrong third button. */}
      <div className="relative z-10 flex flex-col sm:flex-row items-center gap-4 md:gap-[16px] w-full sm:w-auto">
        <Link
          href="/app"
          className="flex items-center justify-center w-full sm:w-[220px] h-[56px] bg-[#1E7BB8] hover:bg-[#17618F] transition-colors"
        >
          <span className="font-grotesk text-[12px] font-bold text-[#FFFFFF] tracking-[0.5px]">
            Open your account
          </span>
        </Link>
        <Link
          href="/live"
          className="flex items-center justify-center w-full sm:w-[220px] h-[56px] bg-[#FFFFFF] border-2 border-[#B4D3E9] hover:border-[#52738D] transition-colors"
        >
          <span className="font-mono text-[12px] text-[#52738D] tracking-[0.5px]">
            Watch it refuse
          </span>
        </Link>
      </div>

      <div className="h-6 md:h-[24px]" />

      {/* The old line here read "No wallet, no faucet, no signature required."
          That was true when the only button was a demo. It would now sit under
          "Open your account", which does need a wallet — so it says which path
          needs what, and states the part that stays true either way. */}
      <p className="relative z-10 font-mono text-[11px] text-[#52738D] tracking-[0.5px] text-center max-w-[520px]">
        Watching it work needs nothing. An account needs a wallet — never a private key,
        yours or your agent&apos;s.
      </p>

      <div className="h-4" />

      <Link
        href="/architecture"
        className="relative z-10 font-mono text-[11px] text-[#52738D] tracking-[0.5px] underline underline-offset-4 decoration-[#B4D3E9] hover:decoration-[#52738D] transition-colors"
      >
        Read the architecture
      </Link>
    </section>
  );
}
