import { describe, expect, it } from 'vitest'
import { produce } from 'immer'
import { TEMPLATES } from '@/lib/data'
import { applyAction, createGame, type GameState } from '@/lib/engine'
import type { Card } from '@/types/game'
import { mixFor } from './mix'

const T = (name: string, id: number): Card => {
  const t = TEMPLATES.find(x => x.name === name)
  if (!t) throw new Error(`no template ${name}`)
  return { ...t, id }
}
const game = (genre = 'Synthwave', mode: 'classic' | 'short' = 'classic'): GameState =>
  createGame([{ name: 'A', genre }, { name: 'B', genre: 'Industrial' }], 42, mode).state

describe('mixFor', () => {
  it('is silent apart from the base on an empty board', () => {
    expect(mixFor(game(), 0)).toEqual({ genre: 'Synthwave', phase: 'ARRANGEMENT', drums: 0, artists: 0, tracks: 0, energy: 0, sparkle: false, result: null })
  })

  it('counts cards across all three of your stages', () => {
    const g = produce(game(), s => {
      const p = s.players[0]
      p.unlocked = { s1: true, s2: true, s3: true }
      p.stages.s1.stage = T('Small Stage', 900); p.stages.s1.artist1 = T('Synth Wizard', 901); p.stages.s1.track = T('Data Stream', 902)
      p.stages.s2.stage = T('Medium Stage', 903); p.stages.s2.artist1 = T('Beat Machine', 904); p.stages.s2.hardware = T('Valve Pre-Amp', 905)
      p.stages.s3.stage = T('Large Stage', 906); p.stages.s3.track = T('Bit Residue', 907); p.stages.s3.track2 = T('Megahit', 908); p.stages.s3.guest = T('Encore', 909)
    })
    expect(mixFor(g, 0)).toMatchObject({ drums: 3, artists: 2, tracks: 3, energy: 1, sparkle: true })
  })

  it('caps artists at 4 and tracks at 3', () => {
    const g = produce(game(), s => {
      const p = s.players[0]
      p.unlocked = { s1: true, s2: true, s3: true }
      let id = 900
      for (const k of ['s1', 's2'] as const) {
        p.stages[k].stage = T('Small Stage', id++)
        p.stages[k].artist1 = T('Synth Wizard', id++); p.stages[k].artist2 = T('Beat Machine', id++); p.stages[k].artist3 = T('Neural Vocalist', id++)
        p.stages[k].track = T('Data Stream', id++); p.stages[k].track2 = T('Bit Residue', id++)
      }
    })
    expect(mixFor(g, 0)).toMatchObject({ artists: 4, tracks: 3 })
  })

  it('ignores locked stages', () => {
    const g = produce(game(), s => {
      const p = s.players[0]
      p.unlocked = { s1: true, s2: false, s3: false }
      p.stages.s3.stage = T('Small Stage', 900)
    })
    expect(mixFor(g, 0).drums).toBe(0)
  })

  it('ignores the opponent cards', () => {
    const g = produce(game(), s => { s.players[1].stages.s1.stage = T('Small Stage', 900); s.players[1].stages.s1.artist1 = T('Synth Wizard', 901) })
    expect(mixFor(g, 0)).toMatchObject({ drums: 0, artists: 0 })
  })

  it('drops a layer when the card goes back to hand (real engine actions)', () => {
    let g = produce(game(), s => { s.players[0].hand = [T('Small Stage', 900)] })
    const play = applyAction(g, 0, { type: 'play', handIdx: 0, sk: 's1' })
    expect(play.ok).toBe(true)
    g = play.state
    expect(mixFor(g, 0).drums).toBe(1)
    const back = applyAction(g, 0, { type: 'pickup', sk: 's1', slot: 'stage' })
    expect(back.ok).toBe(true)
    expect(mixFor(back.state, 0).drums).toBe(0)
  })

  it('falls back to Synthwave for a genre without a recipe', () => {
    expect(mixFor(game('Industrial'), 0).genre).toBe('Synthwave')
    expect(mixFor(game('Jazz'), 0).genre).toBe('Jazz')
  })

  it('reports the round result only in RESULTS, from the round scores', () => {
    const at = (phaseIdx: number, mine: number, theirs: number, mode: 'classic' | 'short' = 'classic') =>
      mixFor(produce(game('Synthwave', mode), s => { s.phaseIdx = phaseIdx; s.players[0].lastRoundScore = mine; s.players[1].lastRoundScore = theirs }), 0)
    expect(at(2, 9, 1)).toMatchObject({ phase: 'LIVE SHOW', result: null })
    expect(at(3, 9, 1)).toMatchObject({ phase: 'RESULTS', result: 'win' })
    expect(at(3, 1, 9)).toMatchObject({ result: 'lose' })
    expect(at(3, 4, 4)).toMatchObject({ result: 'lose' })   // a draw sounds like a loss
    expect(at(3, 9, 1, 'short')).toMatchObject({ result: 'win' })
  })
})
