// ── Card Types ──────────────────────────────────────────────────────────────

export type CardType =
  | 'stage'
  | 'artist'
  | 'track'
  | 'hardware'
  | 'attack'
  | 'defense'
  | 'collab'
  | 'sponsor'
  | 'viral'
  | 'draw'

// what an attack card destroys on the target stage
export type AttackEffect = 'hardware' | 'track' | 'artist' | 'emp'

export interface Card {
  id: number
  type: CardType
  name: string
  desc: string
  // stage
  threshold?: number
  cost?: number
  maxTracks?: number
  // artist
  talent?: number
  // track / collab / viral
  power?: number
  bonus?: number
  encore?: boolean
  // hardware
  multiplier?: number
  // attack
  attackPower?: number
  effect?: AttackEffect
  // defense
  decoy?: boolean
  // sponsor
  income?: number
  // draw
  draw?: number
  discard?: number
}

// ── Stage State ──────────────────────────────────────────────────────────────

export type ArtistSlot = 'artist1' | 'artist2' | 'artist3'
export type TrackSlot = 'track' | 'track2' | 'track3'
export type StageSlot = 'stage' | ArtistSlot | 'hardware' | TrackSlot | 'guest'
export type StageKey = 's1' | 's2' | 's3'

export interface StageState {
  stage: Card | null
  artist1: Card | null
  artist2: Card | null
  artist3: Card | null
  hardware: Card | null
  track: Card | null
  track2: Card | null
  track3: Card | null
  guest: Card | null
  // computed
  current: number
  threshold: number
  bonus: number
  protected: boolean
  decoy: boolean
  combos: Combo[]
}

// ── Genres ───────────────────────────────────────────────────────────────────

export interface GenreDef {
  name: string
  desc: string
  icon: string
}

// ── Combos ───────────────────────────────────────────────────────────────────

export interface Combo {
  id: string
  name: string
  desc: string
  bonus: number
  mult: number
}

// ── Move Mode ────────────────────────────────────────────────────────────────

export interface MoveMode {
  sk: StageKey
  sl: StageSlot
  card: Card
}

// ── UI Toasts ────────────────────────────────────────────────────────────────

export interface CardToastData {
  name: string
  dest: string
}

export interface ComboRevealData {
  combo: Combo
  isNew: boolean
}

// ── Phase ─────────────────────────────────────────────────────────────────────

export type Phase = 'ARRANGEMENT' | 'SOUNDCHECK' | 'LIVE SHOW' | 'RESULTS'

// ── Sprite ───────────────────────────────────────────────────────────────────

export interface SpriteDef {
  p: Record<string, string>  // char → color
  g: string[]                // pixel rows
}
