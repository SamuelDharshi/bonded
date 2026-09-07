import type { Metadata } from 'next';
import { Instrument_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const instrumentSans = Instrument_Sans({
  subsets:  ['latin'],
  variable: '--font-sans',
  display:  'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets:  ['latin'],
  variable: '--font-mono',
  display:  'swap',
});

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
    <html lang="en" className={`${instrumentSans.variable} ${jetbrainsMono.variable}`}>
      <body className="font-sans bg-harbor text-manifest min-h-screen">
        {children}
      </body>
    </html>
  );
}
