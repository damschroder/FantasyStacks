import type { Metadata, Viewport } from 'next';
import './globals.css';

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://fantasy-stacks-alpha.jdams.chatgpt.site').replace(/\/$/, '');
const title = 'Fantasy Football Player Comparison | FantasyStacks';
const description = 'Compare NFL fantasy football players by opportunity, efficiency, and production. Visualize snaps, targets, touches, yards, touchdowns, and fantasy points.';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: 'FantasyStacks',
  title,
  description,
  keywords: [
    'fantasy football player comparison',
    'fantasy football rankings',
    'NFL opportunity metrics',
    'snap share',
    'target rate',
    'fantasy football visualization',
    'WR rankings',
    'RB rankings',
    'TE rankings',
    'QB rankings',
  ],
  alternates: { canonical: '/' },
  category: 'sports',
  icons: { icon: '/favicon.svg' },
  manifest: '/site.webmanifest',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: '/',
    siteName: 'FantasyStacks',
    title,
    description,
    images: [{ url: '/og.png', width: 1792, height: 896, alt: 'FantasyStacks fantasy football opportunity-to-production visualization' }],
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
    images: ['/og.png'],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f2f0e9' },
    { media: '(prefers-color-scheme: dark)', color: '#111719' },
  ],
};

const structuredData = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      '@id': `${siteUrl}/#website`,
      url: `${siteUrl}/`,
      name: 'FantasyStacks',
      alternateName: 'Fantasy Stacks',
      description,
      inLanguage: 'en-US',
    },
    {
      '@type': 'WebPage',
      '@id': `${siteUrl}/#webpage`,
      url: `${siteUrl}/`,
      name: title,
      description,
      isPartOf: {
        '@id': `${siteUrl}/#website`,
      },
      primaryImageOfPage: `${siteUrl}/og.png`,
      inLanguage: 'en-US',
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, '\\u003c') }}
        />
        {children}
      </body>
    </html>
  );
}
