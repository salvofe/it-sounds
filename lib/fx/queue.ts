// ── Animations: what to show for one commit ──────────────────────────────────
// Pure: engine events in, timed steps out. Your own moves show at once; the AI's
// play one at a time (cards, then attacks), then phase and results moments.

import type { GameEvent, PlayerId } from '@/lib/engine'
import type { Card, StageKey, StageSlot } from '@/types/game'

export type Side = 'me' | 'ai'
export type FxStep =
  | { kind: 'fly'; owner: Side; card: Card; sk: StageKey; slot: StageSlot; from: 'hand' | 'deck'; at: number }
  | { kind: 'return'; owner: Side; card: Card; sk: StageKey; slot: StageSlot; at: number }
  | { kind: 'move'; owner: Side; card: Card; fromSk: StageKey; fromSlot: StageSlot; sk: StageKey; slot: StageSlot; at: number }
  | { kind: 'attack'; attacker: Side; sk: StageKey; blocked: 'shield' | 'decoy' | null; destroyed: Card[]; at: number }
  | { kind: 'live'; at: number }
  | { kind: 'results'; win: boolean; at: number }
  | { kind: 'gameOver'; win: boolean; at: number }

export const AI_GAP_MS = 500
export const AFTER_MOVES_MS = 300
export const GAME_OVER_AFTER_MS = 1200

export function buildSteps(events: GameEvent[], me: PlayerId): FxStep[] {
  const side = (p: PlayerId): Side => (p === me ? 'me' : 'ai')
  const mine: FxStep[] = [], aiCards: FxStep[] = [], aiAttacks: FxStep[] = []
  const tail: ('live' | { win: boolean } | { over: boolean })[] = []
  for (const ev of events) {
    switch (ev.type) {
      case 'placed': {
        const s: FxStep = { kind: 'fly', owner: side(ev.player), card: ev.card, sk: ev.sk, slot: ev.slot, from: ev.player === me ? 'hand' : 'deck', at: 0 }
        ;(ev.player === me ? mine : aiCards).push(s)
        break
      }
      case 'returned': {
        if (ev.slot === 'defense') break
        const s: FxStep = { kind: 'return', owner: side(ev.player), card: ev.card, sk: ev.sk, slot: ev.slot, at: 0 }
        ;(ev.player === me ? mine : aiCards).push(s)
        break
      }
      case 'moved': {
        const s: FxStep = { kind: 'move', owner: side(ev.player), card: ev.card, fromSk: ev.from, fromSlot: ev.fromSlot, sk: ev.sk, slot: ev.slot, at: 0 }
        ;(ev.player === me ? mine : aiCards).push(s)
        break
      }
      case 'attacked': {
        const s: FxStep = { kind: 'attack', attacker: side(ev.player), sk: ev.sk, blocked: ev.blocked, destroyed: ev.destroyed.map(d => d.card), at: 0 }
        ;(ev.player === me ? mine : aiAttacks).push(s)
        break
      }
      case 'phase':
        if (ev.phase === 'LIVE SHOW') tail.push('live')
        break
      case 'results':
        tail.push({ win: ev.scores[me] > ev.scores[me === 0 ? 1 : 0] })
        if (ev.gameOver) tail.push({ over: ev.winner === me })
        break
    }
  }
  const out: FxStep[] = [...mine]
  const ai = [...aiCards, ...aiAttacks]
  ai.forEach((s, i) => out.push({ ...s, at: i * AI_GAP_MS }))
  const tailAt = ai.length ? (ai.length - 1) * AI_GAP_MS + AFTER_MOVES_MS : 0
  let resultsAt = tailAt
  for (const t of tail) {
    if (t === 'live') out.push({ kind: 'live', at: tailAt })
    else if ('win' in t) { resultsAt = tailAt; out.push({ kind: 'results', win: t.win, at: tailAt }) }
    else out.push({ kind: 'gameOver', win: t.over, at: resultsAt + GAME_OVER_AFTER_MS })
  }
  return out
}
