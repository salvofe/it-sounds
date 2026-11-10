// ── Base viva: what should sound ─────────────────────────────────────────────
// Pure: game state in, layer levels out. Only `me`'s own unlocked stages count;
// the opponent's cards never add layers (their attacks remove ours by changing state).

import { PHASES } from '@/lib/data'
import type { GameState, PlayerId } from '@/lib/engine'
import type { Phase, StageKey } from '@/types/game'
import { DEFAULT_GENRE, RECIPES } from './recipes'

export interface MusicMix {
  genre: string
  phase: Phase
  drums: 0 | 1 | 2 | 3
  artists: 0 | 1 | 2 | 3 | 4
  tracks: 0 | 1 | 2 | 3
  energy: 0 | 1 | 2 | 3
  sparkle: boolean
  result: 'win' | 'lose' | null
}

const KEYS: StageKey[] = ['s1', 's2', 's3']

export function mixFor(g: GameState, me: PlayerId): MusicMix {
  const p = g.players[me], opp = g.players[me === 0 ? 1 : 0]
  let drums = 0, artists = 0, tracks = 0, energy = 0, sparkle = false
  for (const k of KEYS) {
    if (!p.unlocked[k]) continue
    const s = p.stages[k]
    if (s.stage) drums++
    artists += [s.artist1, s.artist2, s.artist3].filter(Boolean).length
    tracks += [s.track, s.track2, s.track3].filter(Boolean).length
    if (s.hardware) energy++
    if (s.guest) sparkle = true
  }
  const phase = PHASES[g.phaseIdx]
  return {
    genre: RECIPES[p.genre] ? p.genre : DEFAULT_GENRE,
    phase,
    drums: Math.min(drums, 3) as MusicMix['drums'],
    artists: Math.min(artists, 4) as MusicMix['artists'],
    tracks: Math.min(tracks, 3) as MusicMix['tracks'],
    energy: Math.min(energy, 3) as MusicMix['energy'],
    sparkle,
    result: phase === 'RESULTS' ? (p.lastRoundScore > opp.lastRoundScore ? 'win' : 'lose') : null,
  }
}
