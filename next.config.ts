import type { NextConfig } from 'next';
import { resolveBuildNumber } from './lib/resolve-build-number';

process.env.NEXT_PUBLIC_APP_BUILD ??= String(resolveBuildNumber());

const githubPages = process.env.GITHUB_PAGES === 'true';

const nextConfig: NextConfig = {
  output: githubPages ? 'export' : undefined,
  basePath: githubPages ? '/FantasyStacks' : '',
  assetPrefix: githubPages ? '/FantasyStacks/' : undefined,
  trailingSlash: githubPages,
  images: {
    remotePatterns: [{ protocol: 'https', hostname: 'a.espncdn.com', pathname: '/i/teamlogos/nfl/**' }],
  },
};

export default nextConfig;
