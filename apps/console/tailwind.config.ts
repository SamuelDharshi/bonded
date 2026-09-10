import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      /* The console's semantic tokens, re-pointed at the white + light-blue
         theme the landing page uses. The NAMES are load-bearing and stay:
         every page refers to `manifest` / `deepwater` / `hairline` by role,
         often with an opacity modifier (text-manifest/40), so retheming the
         site is a matter of changing what the roles resolve to rather than
         rewriting five pages hex by hex.

         harbor    page canvas          (was the darkest value, now the lightest)
         deepwater raised panel
         hairline  1px structural rules
         manifest  primary text on the canvas
         ink       text on `.document` surfaces

         seal / stamp / hold are NOT part of the repaint. They encode verdict
         outcomes — CLEARED, REFUSED, HELD_FOR_STEPUP — and a console that
         renders REFUSED in light blue would be a worse product. They keep
         their hues and are only darkened enough to stay legible now that they
         sit on white instead of on a dark canvas. */
      colors: {
        harbor:    '#FFFFFF',
        deepwater: '#F2F8FD',
        hairline:  '#CFE3F2',
        manifest:  '#10314A',
        ink:       '#10314A',
        seal:      '#1E7A55',
        stamp:     '#B03A22',
        hold:      '#9A6B12',

        /* ── Mesh gradient palette (decorative only — docs/GRADIENT_SPEC.md §1)
           Never blended with seal/stamp/hold, which stay reserved for verdicts. */
        'mesh-white':      '#F5F7FA',
        'mesh-light-blue': '#8FCFEA',
        'mesh-blue':       '#2E6FD9',
        'mesh-dark':       '#0B1A22', /* = harbor, reused, not a new value */
        'mesh-black':      '#050608',
      },
      fontFamily: {
        sans:  ['var(--font-sans)', 'Space Grotesk', 'sans-serif'],
        mono:  ['var(--font-mono)', 'IBM Plex Mono', 'monospace'],
        pixel: ['var(--font-pixel)', 'monospace'],
      },
      borderRadius: {
        doc:     '4px',
        control: '8px',
        none:    '0px',
      },
      maxWidth: {
        content: '1160px',
      },
    },
  },
  plugins: [],
};

export default config;
