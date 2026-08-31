import type { NextConfig } from 'next';

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
