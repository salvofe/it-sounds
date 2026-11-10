import type { NextConfig } from 'next'

// Static export served under /it-sounds/ on the Buddy Games Studio site.
const config: NextConfig = {
  reactStrictMode: true,
  output: 'export',
  basePath: '/it-sounds',
  trailingSlash: true,
}

export default config
