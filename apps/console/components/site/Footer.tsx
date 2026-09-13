import Image from "next/image";

/**
 * The footer is the globe and the wordmark, and nothing else.
 *
 * It used to carry three link columns, a tagline, social buttons and a bottom
 * bar of copyright and chain metadata. Every one of those links already exists
 * in the navigation, so the footer was repeating the site's own map underneath
 * every page.
 *
 * Removing them cost the globe, which is worth recording: the backdrop was
 * `absolute inset-0` with `object-cover`, and once the link columns were gone
 * the footer collapsed to the height of the wordmark. Covering a short, wide box
 * crops a round image to a horizontal band through its middle — the image was
 * still rendering, it just had nothing left to render into. The fix is height
 * and `object-contain`, not a different image.
 */
export default function Footer() {
  return (
    <footer className="relative flex flex-col justify-end w-full overflow-hidden bg-[#FFFFFF] min-h-[440px] md:min-h-[72vh]">
      {/* ── Globe ──
          media/end.png is a glyph globe — the same visual family as the hero
          footage, and near-black in the same way — so it gets the same
          conversion (`.glyph-art-light` plus the #2E7FBF colour blend) rather
          than being dropped in as a dark slab at the bottom of a white page.
          The two bookend the landing page: world map at the top, globe at the
          end. See globals.css for what the filter chain does, and why the
          opacity has to sit on a wrapper rather than on the image itself.

          `object-contain` in a box that stops short of the bottom, so the whole
          sphere is visible and the wordmark below overlaps its lower edge
          instead of being laid across its equator. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[74%] z-0 opacity-[0.55]"
      >
        <Image
          src="/media/end.png"
          alt=""
          fill
          sizes="100vw"
          className="glyph-art-light object-contain object-center"
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
        className="relative z-10 w-full overflow-hidden select-none pointer-events-none"
      >
        <span
          className="block font-sans font-bold lowercase leading-[0.78] text-center whitespace-nowrap
                     text-[23vw] tracking-[-0.055em]"
          style={{
            // Fades out downward — solid at the top of the glyphs, gone by the
            // baseline, so the word appears to sink into the page.
            backgroundImage:
              "linear-gradient(to bottom, rgba(16,49,74,0.17) 0%, rgba(16,49,74,0.075) 48%, rgba(16,49,74,0) 90%)",
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
