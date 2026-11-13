// The path the static export is served under. The site serves the demo at /it-sounds and the
// full game at /it-sounds/completo (BASE_PATH at build time); Next bakes it into every URL.

export const DEFAULT_BASE_PATH = '/it-sounds'

// One or more "/segment" parts (letters, digits, dots, dashes, underscores; not starting with a dot), no trailing slash.
const VALID = /^(\/[A-Za-z0-9_-][A-Za-z0-9._-]*)+$/

export function basePathFrom(value: string | undefined): string {
  if (value === undefined || value === '') return DEFAULT_BASE_PATH
  if (!VALID.test(value)) {
    throw new Error(`BASE_PATH must look like /it-sounds or /it-sounds/completo (got ${JSON.stringify(value)})`)
  }
  return value
}
