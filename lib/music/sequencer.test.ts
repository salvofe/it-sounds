import { describe, expect, it } from 'vitest'
import { CHORD, RECIPES } from './recipes'
import type { MusicMix } from './mix'
import { notesAt, scaleNote } from './sequencer'

const EMPTY: MusicMix = { genre: 'Synthwave', phase: 'ARRANGEMENT', drums: 0, artists: 0, tracks: 0, energy: 0, sparkle: false, result: null }
const FULL: MusicMix = { ...EMPTY, phase: 'LIVE SHOW', drums: 3, artists: 4, tracks: 3, energy: 3, sparkle: true }
const SW = RECIPES.Synthwave
const voices = (r = SW, mix = EMPTY, step = 0, ps = -1, outro = false) => notesAt(r, mix, step, ps, outro).notes.map(n => n.voice).sort()

describe('notesAt', () => {
  it('plays only the base and its tick on an empty board', () => {
    expect(voices()).toEqual(['base', 'hat'])
    expect(voices(SW, EMPTY, 1)).toEqual([])
  })

  it('base holds root and fifth of the bar chord', () => {
    const base = notesAt(SW, EMPTY, 0, -1, false).notes.find(n => n.voice === 'base')!
    expect(base.midi).toEqual([SW.root + 12, SW.root + 19])
    const bar2 = notesAt(SW, EMPTY, 16, -1, false).notes.find(n => n.voice === 'base')!
    expect(bar2.midi[0]).toBe(SW.root + SW.prog[1][0] + 12)
  })

  it('unlocks drum layers one stage at a time', () => {
    expect(voices(SW, { ...EMPTY, drums: 1 }, 0)).toContain('kick')
    expect(voices(SW, { ...EMPTY, drums: 1 }, 4)).not.toContain('snare')
    expect(voices(SW, { ...EMPTY, drums: 2 }, 4)).toContain('snare')
    // with all 3 drum layers the base tick goes away
    expect(voices(SW, { ...EMPTY, drums: 3 }, 0)).toEqual(['base', 'kick'])
  })

  it('adds artist voices in order: bass, chords, lead, counter', () => {
    expect(voices(SW, { ...EMPTY, artists: 1 }, 0)).toEqual(['base', 'bass', 'hat'])
    expect(voices(SW, { ...EMPTY, artists: 2 }, 0)).toEqual(['base', 'bass', 'chords', 'hat'])
    const chords = notesAt(SW, { ...EMPTY, artists: 2 }, 0, -1, false).notes.find(n => n.voice === 'chords')!
    expect(chords.midi).toEqual(CHORD.min.map(i => SW.root + i + 12))
    expect(chords.dur).toBe(16)
    expect(voices(SW, { ...EMPTY, artists: 3 }, 0)).toContain('lead')
    expect(voices(SW, { ...EMPTY, artists: 4 }, 0)).toContain('counter')
  })

  it('walks the jazz bass towards the next chord', () => {
    const J = RECIPES.Jazz
    const at = (s: number) => notesAt(J, { ...EMPTY, genre: 'Jazz', artists: 1 }, s, -1, false).notes.find(n => n.voice === 'bass')!.midi[0]
    expect(at(0)).toBe(J.root + J.prog[0][0])
    expect(at(12)).toBe(J.root + J.prog[1][0] - 1)
  })

  it('starts the melody at the beginning of the motif when the first track enters', () => {
    const mix = { ...EMPTY, tracks: 1 as const }
    const mel = notesAt(SW, mix, 37, 37, false).notes.find(n => n.voice === 'mel')!
    expect(mel.midi).toEqual([scaleNote(SW, 4)])
    expect(mel.dur).toBe(4)
    expect(voices(SW, mix, 37, -1)).not.toContain('mel')
  })

  it('uses motif B in bars 3-4 with two tracks and adds a second voice with three', () => {
    const two = notesAt(SW, { ...EMPTY, tracks: 2 }, 32, 0, false).notes.find(n => n.voice === 'mel')!
    expect(two.midi).toEqual([scaleNote(SW, 4)])
    const twoB = notesAt(SW, { ...EMPTY, tracks: 2 }, 36, 0, false).notes.find(n => n.voice === 'mel')!
    expect(twoB.midi).toEqual([scaleNote(SW, 5)])
    const three = notesAt(SW, { ...EMPTY, tracks: 3 }, 0, 0, false).notes.find(n => n.voice === 'harm')!
    expect(three.midi).toEqual([scaleNote(SW, 2)])
  })

  it('adds the sparkle arpeggio with a bonus', () => {
    const spk = notesAt(SW, { ...EMPTY, sparkle: true }, 3, -1, false).notes.find(n => n.voice === 'spk')!
    expect(spk.midi).toEqual([SW.root + CHORD.min[0] + 36])
  })

  it('pumps on each beat by energy level', () => {
    expect(notesAt(SW, { ...EMPTY, energy: 2 }, 4, -1, false).pump).toBe(0.55)
    expect(notesAt(SW, { ...EMPTY, energy: 2 }, 5, -1, false).pump).toBeNull()
    expect(notesAt(SW, EMPTY, 4, -1, false).pump).toBeNull()
  })

  it('swings the whole grid, by eighths for jazz and not at all for synthwave', () => {
    expect(notesAt(RECIPES.Jazz, EMPTY, 2, -1, false).swing).toBeCloseTo(0.667 * 0.55)
    expect(notesAt(RECIPES.Jazz, EMPTY, 1, -1, false).swing).toBeCloseTo(0.333 * 0.55)
    expect(notesAt(RECIPES['Hip-Hop'], EMPTY, 1, -1, false).swing).toBeCloseTo(0.5 * 0.35)
    expect(notesAt(SW, EMPTY, 2, -1, false).swing).toBe(0)
  })

  it('keeps only the base in the results outro', () => {
    expect(voices(SW, FULL, 0, 0, true)).toEqual(['base', 'hat'])
    expect(notesAt(SW, FULL, 4, 0, true).pump).toBeNull()
  })
})
