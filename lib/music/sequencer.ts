// ── Base viva: one sixteenth of music ────────────────────────────────────────
// Pure port of the prototype's tick(): given a recipe, the live mix and the global
// step counter, list the notes to play. Durations are in sixteenths; the player
// converts to seconds and MIDI to note names.

import { CHORD, SCALE, parseMotif, type DrumVoice, type Recipe } from './recipes'
import type { MusicMix } from './mix'

export type VoiceId = 'base' | 'bass' | 'chords' | 'lead' | 'counter' | 'mel' | 'harm' | 'spk' | DrumVoice
export interface NoteEvent { voice: VoiceId; midi: number[]; dur: number; vel: number }
export interface StepOut { notes: NoteEvent[]; swing: number; pump: number | null }

// delay of each sixteenth within a beat, as a fraction of a sixteenth at full swing
const SWING_SHAPE = { '8n': [0, 0.333, 0.667, 0.333], '16n': [0, 0.5, 0, 0.5] } as const
export const PUMP_DEPTH = [1, 0.72, 0.55, 0.4]

const SILENT = { drums: 0, artists: 0, tracks: 0, energy: 0, sparkle: false }

function durAt(p: string, s: number): number {
  let n = 1
  while (s + n < 16 && p[s + n] === '-') n++
  return n
}

export function scaleNote(r: Recipe, deg: number): number {
  const sc = SCALE[r.scale], len = sc.length
  const o = Math.floor(deg / len), i = ((deg % len) + len) % len
  return r.root + 24 + sc[i] + 12 * o
}

export function notesAt(r: Recipe, mix: MusicMix, step: number, phraseStart: number, outro: boolean): StepOut {
  const s = step % 16, bar = Math.floor(step / 16) % 4
  const L = outro ? SILENT : mix
  const ch = r.prog[bar], nx = r.prog[(bar + 1) % 4]
  const root = r.root + ch[0], tones = CHORD[ch[1]].map(i => root + i)
  const notes: NoteEvent[] = []
  const add = (voice: VoiceId, midi: number[], dur: number, vel: number) => notes.push({ voice, midi, dur, vel })

  if (s === 0) add('base', [root + 12, root + 19], 15, 0.5)
  const dl = L.drums
  if (dl < 3 && s % 4 === 0) add('hat', [], 1, dl === 0 ? 0.3 : 0.18)
  r.parts.forEach((pt, i) => {
    if (i >= dl) return
    if (pt.p[s] === 'x') add(pt.v, [], 1, 0.95)
    else if (pt.p[s] === 'o') add(pt.v, [], 1, 0.4)
  })

  if (L.artists >= 1) {
    const p = r.v.bass.p, c = p[s]
    if (c !== '.' && c !== '-') {
      let n = root
      if (c === 'o') n = root + 12
      else if (c === 'f') n = root + 7
      else if (c === 'w') {
        const q = Math.floor(s / 4)
        n = [root, tones[1], tones[2], r.root + nx[0] - 1][q]
        while (n > r.root + 14) n -= 12
      }
      add('bass', [n], durAt(p, s), 0.9)
    }
  }
  if (L.artists >= 2) {
    const p = r.v.chords.p
    if (p[s] === 'x') add('chords', tones.map(t => t + 12), durAt(p, s), 0.7)
  }
  if (L.artists >= 3) {
    const c = r.v.lead.p[s]
    if (c >= '0' && c <= '9') {
      const i = Number(c)
      add('lead', [tones[i % tones.length] + 12 * Math.floor(i / tones.length) + 24], 1, 0.7)
    }
  }
  if (L.artists >= 4) {
    const p = r.v.counter.p
    if (p[s] === 'x') add('counter', [tones[1] + 24, tones[tones.length - 1] + 24], durAt(p, s), 0.55)
  }

  if (L.tracks >= 1) {
    const pos = phraseStart >= 0 ? (((step - phraseStart) % 64) + 64) % 64 : step % 64
    const motif = parseMotif(L.tracks >= 2 && pos >= 32 ? r.B : r.A)
    const m = motif[pos % 32]
    if (m) {
      add('mel', [scaleNote(r, m[0])], m[1], 0.85)
      if (L.tracks >= 3) add('harm', [scaleNote(r, m[0] - 2)], m[1], 0.7)
    }
  }

  if (L.sparkle) add('spk', [tones[s % tones.length] + 36], 0.5, 0.35)

  const swing = r.swing ? SWING_SHAPE[r.sub ?? '8n'][s % 4] * r.swing : 0
  const pump = L.energy >= 1 && s % 4 === 0 ? PUMP_DEPTH[L.energy] : null
  return { notes, swing, pump }
}
