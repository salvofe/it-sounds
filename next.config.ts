import type { NextConfig } from 'next'
import { basePathFrom } from './lib/basePath'
import { editionFrom } from './lib/edition'

// Static export served under /it-sounds/ on the Buddy Games Studio site (BASE_PATH changes it:
// the site builds the full game with BASE_PATH=/it-sounds/completo).
const config: NextConfig = {
  reactStrictMode: true,
  output: 'export',
  basePath: basePathFrom(process.env.BASE_PATH),
  trailingSlash: true,
  // always inlined, so the full build carries "full" (and drops the demo-only code) instead of reading it at run time
  env: { NEXT_PUBLIC_EDITION: editionFrom(process.env.NEXT_PUBLIC_EDITION) },
}

export default config
