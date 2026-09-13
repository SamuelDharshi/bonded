import Image from "next/image";

/**
 * The footer is the wordmark, and nothing else.
 *
 * It used to carry three link columns, a tagline, social buttons and a bottom
 * bar of copyright and chain metadata. Every one of those links already exists
 * in the navigation, so the footer was repeating the site's own map underneath
 * every page. What is left is the brand device: the name, oversized, fading
 * downward into the page edge.
 */
export default function Footer() {
  return (
    <footer className="relative flex flex-col w-full overflow-hidden bg-[#FFFFFF]">
      {/* Backdrop. Purely decorative, so it is hidden from assistive tech and
          its image carries an empty alt.

          media/end.png is a glyph globe — the same visual family as the hero
          footage and near-black in the same way — so it gets the same
          conversion (`.glyph-art-light` + the #2E7FBF colour blend) instead of
          being dropped in as a dark slab at the bottom of a white page. The two
          bookend the landing page: world map at the top, globe at the end. See
          globals.css for what the filter chain does, and why the opacity has to
          sit on a wrapper rather than on the image itself. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 opacity-[0.5]"
      >
        <Image
          src="/media/end.png"
          alt=""
          fill
          sizes="100vw"
          className="glyph-art-light object-cover object-center"
        />
      </div>

      {/* ── Wordmark ──
          Sans and lowercase on purpose: at this size the mono face's fixed
          advance widths open ugly gaps between letters, and the tight negative
          tracking is what keeps the word reading as one shape rather than six
          characters.

          Text rather than an image so it stays crisp at any width, sized in vw
          and clipped by the footer's overflow, so it fills the width on a phone
          and on a 32-inch display without a breakpoint. */}
      <div
        aria-hidden
        className="relative z-10 w-full overflow-hidden select-none pointer-events-none pt-16 md:pt-24"
      >
        <span
          className="block font-sans font-bold lowercase leading-[0.78] text-center whitespace-nowrap
                     text-[23vw] tracking-[-0.055em]"
          style={{
            // Fades out downward — solid at the top of the glyphs, gone by the
            // baseline, so the word appears to sink into the page.
            backgroundImage:
              "linear-gradient(to bottom, rgba(16,49,74,0.16) 0%, rgba(16,49,74,0.07) 48%, rgba(16,49,74,0) 90%)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
          }}
        >
          bonded
        </span>
      </div>
    </footer>
  );
}
