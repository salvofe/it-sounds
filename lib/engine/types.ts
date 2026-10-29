import type { Card, Combo, Phase, StageKey, StageSlot, StageState } from '@/types/game'

// ── Engine state ─────────────────────────────────────────────────────────────
// Everything here is plain JSON: the same state can live in the browser
// (single player vs bot) or on a server (multiplayer) and be sent over the wire.

export type PlayerId = 0 | 1

// undo stack for the current phase; wallet changes are stored as deltas so
// that picking up an earlier card doesn't corrupt later undos
export type UndoEntry =
  | { type: 'place'; cardId: number; replaced: Card | null; dw: number }
  | { type: 'def'; sk: StageKey; card: Card; op: boolean; odecoy: boolean }

export interface PlayerState {
  name: string
  genre: string
  subGenre: string
  deck: Card[]
  hand: Card[]
  trash: Card[]
  stages: Record<StageKey, StageState>
  unlocked: Record<StageKey, boolean>
  wallet: number
  bestRound: number
  lastRoundScore: number
  actionsLeft: number
  mustDiscard: number
  ready: boolean
  hasAttacked: boolean
  mulliganUsed: boolean
  // card ids placed during the current phase: only these can be picked back up
  placedThisPhase: number[]
  history: UndoEntry[]
}

export interface GameState {
  players: [PlayerState, PlayerState]
  round: number
  phaseIdx: number
  gameOver: boolean
  winner: PlayerId | 'draw' | null
  seed: number
  nextId: number
}

// ── Actions (what a client is allowed to ask for) ────────────────────────────

export type Action =
  | { type: 'play'; handIdx: number; sk: StageKey; slot?: StageSlot }
  | { type: 'attack'; handIdx: number; target: StageKey }
  | { type: 'discard'; handIdx: number }
  | { type: 'pickup'; sk: StageKey; slot: StageSlot }
  | { type: 'move'; from: { sk: StageKey; slot: StageSlot }; to: { sk: StageKey; slot: StageSlot } }
  | { type: 'undo' }
  | { type: 'mulligan' }
  | { type: 'ready' }

// ── Events (what happened — drives log, sound and animation) ─────────────────

export type GameEvent =
  | { type: 'placed'; player: PlayerId; card: Card; sk: StageKey; slot: StageSlot }
  | { type: 'returned'; player: PlayerId; card: Card; sk: StageKey; slot: StageSlot | 'defense' }
  | { type: 'moved'; player: PlayerId; card: Card; from: StageKey; fromSlot: StageSlot; sk: StageKey; slot: StageSlot }
  | { type: 'defended'; player: PlayerId; card: Card; sk: StageKey; decoy: boolean }
  | { type: 'attacked'; player: PlayerId; card: Card; sk: StageKey; blocked: 'shield' | 'decoy' | null; destroyed: { slot: StageSlot; card: Card }[] }
  | { type: 'drew'; player: PlayerId; cards: number[] }
  | { type: 'discarded'; player: PlayerId; card: Card }
  | { type: 'reshuffled'; player: PlayerId; count: number }
  | { type: 'combo'; player: PlayerId; sk: StageKey; combo: Combo }
  | { type: 'income'; player: PlayerId; amount: number }
  | { type: 'ready'; player: PlayerId }
  | { type: 'phase'; phase: Phase; round: number }
  | { type: 'results'; scores: [number, number]; gameOver: boolean; winner: PlayerId | 'draw' | null }
  | { type: 'mulligan'; player: PlayerId }

export type ActionResult =
  | { ok: true; state: GameState; events: GameEvent[] }
  | { ok: false; error: string }
