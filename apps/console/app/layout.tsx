import type { Metadata } from 'next';
import type { CSSProperties } from 'react';
import { Space_Grotesk, IBM_Plex_Mono } from 'next/font/google';
import { GeistPixelSquare } from 'geist/font/pixel';
import './globals.css';

const spaceGrotesk = Space_Grotesk({
  subsets:  ['latin'],
  variable: '--font-sans',
  display:  'swap',
});

// IBM Plex Mono is not a variable font on Google Fonts, so the weights the
// site actually uses have to be listed explicitly — unlike JetBrains Mono,
// which it replaces, next/font cannot infer them.
const ibmPlexMono = IBM_Plex_Mono({
  subsets:  ['latin'],
  weight:   ['400', '500', '600', '700'],
  variable: '--font-mono',
  display:  'swap',
});


// Geist Pixel ships as a next/font/local wrapper inside the `geist` package
// (`geist/font/pixel`, exports GeistPixelSquare | Circle | Grid | Triangle |
// Line). Its own CSS variable name is hard-coded to `--font-geist-pixel-square`,
// so we alias it onto `--font-pixel` for Tailwind's `font-pixel` family.
const pixelFontVariables = {
  '--font-pixel': GeistPixelSquare.style.fontFamily,
} as CSSProperties;

export const metadata: Metadata = {
  title:       'Bonded — Agent Spending Authority',
  description: 'Agents can\'t spend on their own word. Bonded re-derives every fact before money moves.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${ibmPlexMono.variable} ${GeistPixelSquare.variable}`}
      style={pixelFontVariables}
    >
      <body className="font-sans bg-harbor text-manifest min-h-screen">
        {children}
      </body>
    </html>
  );
}
