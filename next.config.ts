import type { NextConfig } from 'next';

const githubPages = process.env.GITHUB_PAGES === 'true';

const nextConfig: NextConfig = {
  output: githubPages ? 'export' : undefined,
  basePath: githubPages ? '/FantasyStacks' : '',
  assetPrefix: githubPages ? '/FantasyStacks/' : undefined,
  trailingSlash: githubPages,
};

export default nextConfig;
