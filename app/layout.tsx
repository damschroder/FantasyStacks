import type { Metadata } from 'next';
import './globals.css';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://fantasy-stacks-alpha.jdams.chatgpt.site';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: 'FantasyStacks \u2014 Opportunity made visible',
  description: 'A visual opportunity-to-production comparison tool for fantasy football skill players.',
  openGraph: {
    title: 'FantasyStacks \u2014 Opportunity made visible',
    description: 'Compare the complete path from team opportunity to fantasy production for receivers and running backs.',
    images: [{ url: `${siteUrl}/og.png`, width: 1792, height: 896, alt: 'FantasyStacks \u2014 Opportunity made visible' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'FantasyStacks \u2014 Opportunity made visible',
    description: 'Compare the complete path from team opportunity to fantasy production for receivers and running backs.',
    images: [`${siteUrl}/og.png`],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
