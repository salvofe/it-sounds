import { describe, expect, it } from 'vitest'
import { TEMPLATES } from '@/lib/data'
import type { GameEvent } from '@/lib/engine'
import type { Card } from '@/types/game'
import { AFTER_MOVES_MS, AI_GAP_MS, GAME_OVER_AFTER_MS, PHASE_OVERLAY_MS, RESULTS_SHOW_MS, buildSteps, resultsOverlayDelay } from './queue'

const T = (name: string, id: number): Card => {
  const t = TEMPLATES.find(x => x.name === name)
  if (!t) throw new Error(`no template ${name}`)
  return { ...t, id }
}
const placed = (player: 0 | 1, card: Card, sk: 's1' | 's2' | 's3' = 's1', slot: 'stage' | 'artist1' = 'stage'): GameEvent =>
  ({ type: 'placed', player, card, sk, slot })
const attacked = (player: 0 | 1, destroyed: Card[], blocked: 'shield' | 'decoy' | null = null): GameEvent =>
  ({ type: 'attacked', player, card: T('Malware Worm', 99), sk: 's2', blocked, destroyed: destroyed.map(card => ({ slot: 'hardware', card })) })

describe('buildSteps', () => {
  it('is empty without events', () => {
    expect(buildSteps([], 0)).toEqual([])
  })

  it('flies your card from the hand right away', () => {
    const c = T('Small Stage', 1)
    expect(buildSteps([placed(0, c)], 0)).toEqual([{ kind: 'fly', owner: 'me', card: c, sk: 's1', slot: 'stage', from: 'hand', at: 0 }])
  })

  it('plays the AI moves one at a time, cards before attacks', () => {
    const a = T('Small Stage', 1), b = T('Synth Wizard', 2), hw = T('Valve Pre-Amp', 3)
    const steps = buildSteps([placed(1, a), attacked(1, [hw]), placed(1, b, 's1', 'artist1')], 0)
    expect(steps.map(s => [s.kind, s.at])).toEqual([['fly', 0], ['fly', AI_GAP_MS], ['attack', 2 * AI_GAP_MS]])
    expect(steps[0]).toMatchObject({ owner: 'ai', from: 'deck' })
    expect(steps[2]).toMatchObject({ kind: 'attack', attacker: 'ai', sk: 's2', blocked: null, destroyed: [hw] })
  })

  it('keeps your attack at 0 and marks blocks', () => {
    const steps = buildSteps([attacked(0, [], 'shield')], 0)
    expect(steps).toEqual([{ kind: 'attack', attacker: 'me', sk: 's2', blocked: 'shield', destroyed: [], at: 0 }])
  })

  it('maps returns and moves, and ignores shields', () => {
    const c = T('Synth Wizard', 5)
    const steps = buildSteps([
      { type: 'returned', player: 0, card: c, sk: 's1', slot: 'artist1' },
      { type: 'returned', player: 0, card: T('Firewall Shield', 6), sk: 's1', slot: 'defense' },
      { type: 'moved', player: 0, card: c, from: 's1', fromSlot: 'artist1', sk: 's2', slot: 'artist1' },
      { type: 'defended', player: 0, card: T('Firewall Shield', 7), sk: 's3', decoy: false },
    ], 0)
    expect(steps).toEqual([
      { kind: 'return', owner: 'me', card: c, sk: 's1', slot: 'artist1', at: 0 },
      { kind: 'move', owner: 'me', card: c, fromSk: 's1', fromSlot: 'artist1', sk: 's2', slot: 'artist1', at: 0 },
    ])
  })

  it('opens the Live Show after the AI moves', () => {
    const steps = buildSteps([placed(1, T('Small Stage', 1)), placed(1, T('Synth Wizard', 2), 's1', 'artist1'), { type: 'phase', phase: 'LIVE SHOW', round: 1 }], 0)
    expect(steps.at(-1)).toEqual({ kind: 'live', at: PHASE_OVERLAY_MS + AI_GAP_MS + AFTER_MOVES_MS })
    expect(buildSteps([{ type: 'phase', phase: 'SOUNDCHECK', round: 1 }], 0)).toEqual([])
    expect(buildSteps([{ type: 'phase', phase: 'LIVE SHOW', round: 1 }], 0)).toEqual([{ kind: 'live', at: PHASE_OVERLAY_MS }])
  })

  it('celebrates only a won round, and the match at game over', () => {
    const res = (scores: [number, number], gameOver = false, winner: 0 | 1 | 'draw' | null = null): GameEvent =>
      ({ type: 'results', scores, gameOver, winner, roundWins: [0, 0] })
    expect(buildSteps([res([5, 2])], 0)).toEqual([{ kind: 'results', win: true, at: 0 }])
    expect(buildSteps([res([2, 5])], 0)).toEqual([{ kind: 'results', win: false, at: 0 }])
    expect(buildSteps([res([4, 4])], 0)).toEqual([{ kind: 'results', win: false, at: 0 }])
    expect(buildSteps([res([5, 2], true, 0)], 0)).toEqual([
      { kind: 'results', win: true, at: 0 },
      { kind: 'gameOver', win: true, at: GAME_OVER_AFTER_MS },
    ])
    expect(buildSteps([res([5, 2], true, 'draw')], 0).at(-1)).toEqual({ kind: 'gameOver', win: false, at: GAME_OVER_AFTER_MS })
  })

  it('waits for the phase transition overlay before showing anything', () => {
    const steps = buildSteps([placed(1, T('Small Stage', 1)), { type: 'phase', phase: 'SOUNDCHECK', round: 1 }], 0)
    expect(steps).toEqual([expect.objectContaining({ kind: 'fly', owner: 'ai', at: PHASE_OVERLAY_MS })])
    expect(buildSteps([placed(0, T('Small Stage', 2))], 0)[0].at).toBe(0)
  })

  it('opens the results overlay only after the results moment has played', () => {
    expect(resultsOverlayDelay([])).toBe(0)
    expect(resultsOverlayDelay([{ kind: 'results', win: true, at: 1600 }])).toBe(1600 + RESULTS_SHOW_MS)
    expect(resultsOverlayDelay([{ kind: 'results', win: true, at: 1600 }, { kind: 'gameOver', win: true, at: 2800 }])).toBe(2800 + RESULTS_SHOW_MS)
  })
})
