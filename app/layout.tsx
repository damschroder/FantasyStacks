import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://fantasy-stacks-alpha.jdams.chatgpt.site'),
  title: 'FantasyStacks \u2014 See the whole receiver',
  description: 'A visual opportunity-to-production comparison tool for fantasy football receivers.',
  openGraph: {
    title: 'FantasyStacks \u2014 See the whole receiver',
    description: 'Compare the complete path from team opportunity to fantasy production.',
    images: [{ url: '/og.png', width: 1792, height: 896, alt: 'FantasyStacks \u2014 See the whole receiver' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'FantasyStacks \u2014 See the whole receiver',
    description: 'Compare the complete path from team opportunity to fantasy production.',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
