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
      },
      fontFamily: {
        sans: ['Instrument Sans', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
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
