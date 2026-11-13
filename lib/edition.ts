// Demo and full edition, chosen at build time. The Buddy Dive Games site serves the demo at
// /it-sounds/ (NEXT_PUBLIC_EDITION=demo) and the full game at /it-sounds/completo/ (no edition).
import type { Mode } from '@/lib/engine/config'

/** `demo`: only the Short mode. `full`: the whole game, unchanged. */
export type Edition = 'demo' | 'full'

/** Only the exact value "demo" builds the demo; anything else (or nothing) is the full game. */
export function editionFrom(value: string | undefined): Edition {
  return value === 'demo' ? 'demo' : 'full'
}

// Written out in full so Next inlines it at build time.
export const EDITION: Edition = editionFrom(process.env.NEXT_PUBLIC_EDITION)

/** The game's id on the site (its folder, its unlock page, its entry in /api/io). */
export const GAME_ID = 'it-sounds'
/** The site page that unlocks the full game (root-absolute: the game runs under its own base path). */
export const UNLOCK_URL = `/en/unlock/?game=${GAME_ID}`
/** Where the site serves the full game. */
export const FULL_GAME_URL = `/${GAME_ID}/completo/`

const MODES: Record<Edition, readonly Mode[]> = { full: ['short', 'classic'], demo: ['short'] }

export function playableModes(edition: Edition): Mode[] {
  return [...MODES[edition]]
}

/** The mode a game actually starts in: the requested one if this edition plays it, else Short. */
export function playableMode(requested: Mode, edition: Edition): Mode {
  return MODES[edition].includes(requested) ? requested : 'short'
}

/** Whether a /api/io answer says the visitor owns the full game: signed in, and this game or '*' among theirs. */
export function ownsFullGame(io: unknown, game: string = GAME_ID): boolean {
  if (typeof io !== 'object' || io === null) return false
  const { signedIn, games } = io as { signedIn?: unknown; games?: unknown }
  return signedIn === true && Array.isArray(games) && (games.includes(game) || games.includes('*'))
}

type Fetch = (url: string, init: RequestInit) => Promise<Response>

/** Asks the site (same origin, with its cookies) whether the visitor owns the full game. Any failure is a no. */
export async function askOwnership(fetchImpl: Fetch): Promise<boolean> {
  try {
    const r = await fetchImpl('/api/io', { credentials: 'include' })
    return r.ok && ownsFullGame(await r.json())
  } catch {
    return false
  }
}
