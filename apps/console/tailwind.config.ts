import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        harbor:    '#0B1A22',
        deepwater: '#122733',
        hairline:  '#1E3A47',
        manifest:  '#ECEEEA',
        ink:       '#0E1614',
        seal:      '#3FA37A',
        stamp:     '#C2452C',
        hold:      '#E0A33C',

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
        mono:  ['var(--font-mono)', 'JetBrains Mono', 'monospace'],
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
