'use client'

// ── Base viva: Tone.js player ────────────────────────────────────────────────
// The game says what it wants (apply); the player makes it live on the next
// downbeat so every layer enters in time. Safe to call before start: apply()
// queues, the rest no-op. Any failure leaves the game silent, never broken.

import { Sound, loadTone } from '@/lib/sound'
import type { Phase } from '@/types/game'
import { CHORD, recipeFor, type Env, type Recipe, type Voice } from './recipes'
import { notesAt, type NoteEvent, type VoiceId } from './sequencer'
import type { MusicMix } from './mix'

type ToneModule = typeof import('tone')

const CUTOFF: Record<Phase, number> = { ARRANGEMENT: 850, SOUNDCHECK: 1700, 'LIVE SHOW': 16000, RESULTS: 3500 }
const LIVE_DB = -10   // music master in the Live Show; effects play on top
const PREP_DB = -13   // Arrangement, Soundcheck, Results
const DRIVE = [0, 0.12, 0.25, 0.4]
const DEFAULT_ENV: Env = { attack: 0.005, decay: 0.1, sustain: 0.2, release: 0.1 }

let T: ToneModule | null = null
let M: Record<string, any> | null = null
let V: Partial<Record<VoiceId, any>> = {}
let extras: any[] = []
let recipe: Recipe = recipeFor('Synthwave')
let built = ''
let want: MusicMix | null = null
let live: MusicMix | null = null
let step = 0, phraseStart = -1, barsInPhase = 0
let started = false, starting = false, muted = false, stopWhenStarted = false
let glitchUntil = 0
let repeatId: number | null = null
let stopTimer: ReturnType<typeof setTimeout> | null = null

// ── graph ───────────────────────────────────────────────────────────────────

function buildMaster(Tn: ToneModule) {
  const limiter = new Tn.Limiter(-2).toDestination()
  const mute = new Tn.Gain(muted ? 0 : 1).connect(limiter)
  const vol = new Tn.Volume(PREP_DB).connect(mute)
  const verb = new Tn.Reverb({ decay: 2.2, preDelay: 0.01 }).connect(vol)
  const filt = new Tn.Filter(CUTOFF.ARRANGEMENT, 'lowpass').connect(verb)
  const pump = new Tn.Gain(1).connect(filt)
  const drive = new Tn.Distortion(0.5).connect(pump)
  drive.wet.value = 0
  const bus = new Tn.Gain(1).connect(drive)
  const crashHp = new Tn.Filter(4500, 'highpass').connect(vol)
  const crash = new Tn.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.005, decay: 1.6, sustain: 0, release: 0.4 } }).connect(crashHp)
  crash.volume.value = -14
  const crusher = new Tn.BitCrusher(3).connect(vol)
  const glitch = new Tn.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 0.005, decay: 0.04, sustain: 0, release: 0.01 } }).connect(crusher)
  glitch.volume.value = -8
  const sting = new Tn.PolySynth(Tn.Synth, { oscillator: { type: 'square' }, envelope: { attack: 0.005, decay: 0.2, sustain: 0.3, release: 0.6 } }).connect(verb)
  sting.volume.value = -14
  return { limiter, mute, vol, verb, filt, pump, drive, bus, crashHp, crash, crusher, glitch, sting }
}

function voice(Tn: ToneModule, spec: Voice, poly: boolean): any {
  const opts = { oscillator: { type: spec.osc }, envelope: spec.e ?? DEFAULT_ENV } as any
  const s: any = poly ? new Tn.PolySynth(Tn.Synth, opts) : new Tn.Synth(opts)
  if (spec.porta) s.portamento = spec.porta
  s.volume.value = spec.vol
  if (spec.dist) {
    const d = new Tn.Distortion(spec.dist).connect(M!.bus)
    s.connect(d)
    extras.push(d)
  } else s.connect(M!.bus)
  return s
}

function disposeVoices() {
  for (const v of Object.values(V)) { try { v.releaseAll?.(); v.dispose() } catch {} }
  for (const e of extras) { try { e.dispose() } catch {} }
  V = {}; extras = []
}

function buildVoices(genre: string) {
  const Tn = T!, r = recipeFor(genre)
  disposeVoices()
  recipe = r; built = genre
  Tn.getTransport().bpm.value = r.bpm
  Tn.getTransport().swing = 0          // swing is applied by the sequencer to the whole grid
  M!.verb.wet.value = r.verb
  V.base = voice(Tn, { ...r.v.base, e: { attack: 0.05, decay: 0.5, sustain: 0.8, release: 1.5 } }, true)
  const bass: any = new Tn.MonoSynth({
    oscillator: { type: r.v.bass.osc }, envelope: r.v.bass.e ?? DEFAULT_ENV,
    filter: { Q: 2, type: 'lowpass' },
    filterEnvelope: { attack: 0.005, decay: 0.25, sustain: 0.4, release: 0.2, baseFrequency: 140, octaves: 3.5 },
  } as any)
  bass.volume.value = r.v.bass.vol
  if (r.v.bass.porta) bass.portamento = r.v.bass.porta
  bass.connect(M!.bus)
  V.bass = bass
  V.chords = voice(Tn, r.v.chords, true)
  V.lead = voice(Tn, r.v.lead, false)
  V.counter = voice(Tn, r.v.counter, true)
  V.mel = voice(Tn, r.v.melody, false)
  V.harm = voice(Tn, { ...r.v.melody, vol: r.v.melody.vol - 5 }, false)
  V.spk = voice(Tn, { osc: r.v.sparkle.osc, e: { attack: 0.005, decay: 0.08, sustain: 0, release: 0.05 }, vol: r.v.sparkle.vol }, false)
  const kick: any = new Tn.MembraneSynth({ pitchDecay: 0.04, octaves: 6, envelope: { attack: 0.005, decay: r.kit.kick.decay, sustain: 0, release: 0.1 } } as any)
  kick.volume.value = r.kit.kick.vol
  kick.connect(M!.bus)
  V.kick = kick
  const snareHp = new Tn.Filter(r.kit.snare.hp, 'highpass').connect(M!.bus)
  const snare: any = new Tn.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.005, decay: r.kit.snare.decay, sustain: 0, release: 0.05 } } as any)
  snare.volume.value = r.kit.snare.vol
  snare.connect(snareHp)
  V.snare = snare
  const hatHp = new Tn.Filter(7000, 'highpass').connect(M!.bus)
  const hat: any = new Tn.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.005, decay: r.kit.hat.decay, sustain: 0, release: 0.02 } } as any)
  hat.volume.value = r.kit.hat.vol
  hat.connect(hatHp)
  V.hat = hat
  extras.push(snareHp, hatHp)
}

// ── timing ──────────────────────────────────────────────────────────────────

function stinger(time: number, win: boolean) {
  const Tn = T!, r = recipe.root + 24
  const run = win ? [0, 4, 7, 12, 16, 19] : [12, 8, 5, 3, 0]
  run.forEach((n, i) => M!.sting.triggerAttackRelease(Tn.Frequency(r + n, 'midi').toNote(), '8n', time + i * 0.11, 0.8))
  const chord = CHORD[win ? 'maj' : 'min'].map(x => Tn.Frequency(r + 12 + x, 'midi').toNote())
  M!.sting.triggerAttackRelease(chord, '2n', time + run.length * 0.11, 0.7)
}

function downbeat(time: number) {
  if (!want) return
  if (want.genre !== built) {
    buildVoices(want.genre)
    step = 0
    if (phraseStart >= 0) phraseStart = 0
  }
  const before = live
  live = { ...want }
  const phaseChanged = !before || before.phase !== live.phase
  barsInPhase = phaseChanged ? 0 : barsInPhase + 1
  if (live.tracks >= 1 && (!before || before.tracks === 0)) phraseStart = step
  if (live.tracks === 0) phraseStart = -1
  if (phaseChanged) {
    const cut = live.phase === 'RESULTS' ? (live.result === 'win' ? 5000 : 2200) : CUTOFF[live.phase]
    M!.filt.frequency.rampTo(cut, live.phase === 'LIVE SHOW' ? 0.05 : 1.2, time)
    M!.vol.volume.rampTo(live.phase === 'LIVE SHOW' ? LIVE_DB : PREP_DB, 0.5, time)
    if (before && live.phase === 'LIVE SHOW') M!.crash.triggerAttackRelease('1n', time, 0.9)
    if (live.phase === 'RESULTS' && live.result) stinger(time, live.result === 'win')
  }
  M!.drive.wet.rampTo(DRIVE[live.energy], 0.2, time)
  if (live.energy === 0) { M!.pump.gain.cancelScheduledValues(time); M!.pump.gain.setValueAtTime(1, time) }
}

function play(n: NoteEvent, time: number, d16: number) {
  const Tn = T!, v = V[n.voice]
  if (!v) return
  if (n.voice === 'kick') v.triggerAttackRelease(recipe.kit.kick.note, '8n', time, n.vel)
  else if (n.voice === 'snare' || n.voice === 'hat') v.triggerAttackRelease('32n', time, n.vel)
  else {
    const names = n.midi.map(m => Tn.Frequency(m, 'midi').toNote())
    v.triggerAttackRelease(names.length === 1 ? names[0] : names, d16 * n.dur * 0.95, time, n.vel)
  }
}

function tick(time0: number) {
  if (!T || !M) return
  if (step % 16 === 0) downbeat(time0)
  if (!live) { step++; return }
  const d16 = T.Time('16n').toSeconds()
  const outro = live.phase === 'RESULTS' && barsInPhase >= 1
  const out = notesAt(recipe, live, step, phraseStart, outro)
  const time = time0 + out.swing * d16
  if (out.pump !== null) {
    const g = M.pump.gain
    g.cancelScheduledValues(time)
    g.setValueAtTime(1, time)
    g.linearRampToValueAtTime(out.pump, time + 0.01)
    g.linearRampToValueAtTime(1, time + d16 * 3)
  }
  for (const n of out.notes) { try { play(n, time, d16) } catch { /* a dropped note never stops the show */ } }
  step++
}

function teardown() {
  if (stopTimer) { clearTimeout(stopTimer); stopTimer = null }
  const Tn = T
  if (Tn) {
    try { const tr = Tn.getTransport(); tr.stop(); if (repeatId !== null) tr.clear(repeatId) } catch {}
  }
  repeatId = null
  disposeVoices()
  if (M) for (const n of Object.values(M)) { try { n.dispose() } catch {} }
  M = null; built = ''; live = null; started = false
  step = 0; phraseStart = -1; barsInPhase = 0; glitchUntil = 0
}

// ── public API ──────────────────────────────────────────────────────────────

export const Music = {
  async start(): Promise<void> {
    if (typeof window === 'undefined') return
    if (stopTimer) teardown()          // a restart during the fade-out wins
    if (starting) { stopWhenStarted = false; return }   // a start during a pending stop wins
    if (started) return
    starting = true
    try {
      await Sound.unlock()
      const Tn = await loadTone()
      if (Tn.getContext().state !== 'running') await Tn.start()
      T = Tn
      M = buildMaster(Tn)
      step = 0; phraseStart = -1; barsInPhase = 0; live = null; built = ''
      repeatId = Tn.getTransport().scheduleRepeat(tick, '16n')
      Tn.getTransport().start('+0.1')
      started = true
      if (stopWhenStarted) { stopWhenStarted = false; teardown(); want = null }
    } catch (e) {
      console.warn('Music init failed', e)
      teardown()
    } finally {
      starting = false
    }
  },

  apply(mix: MusicMix): void {
    want = mix
  },

  glitch(): void {
    if (!started || !T || !M) return
    const now = T.getTransport().nextSubdivision('16n'), d = T.Time('32n').toSeconds()
    if (now < glitchUntil) return   // one stutter at a time: two attacks in one commit share it
    glitchUntil = now + 6 * d + 0.01
    try {
      const g = M.bus.gain
      g.cancelScheduledValues(now)
      g.setValueAtTime(1, now)
      for (let i = 0; i < 6; i++) {
        M.glitch.triggerAttackRelease('64n', now + i * d + 0.001, 0.9)
        g.linearRampToValueAtTime(i % 2 ? 1 : 0.08, now + i * d + 0.004)
        g.setValueAtTime(i % 2 ? 1 : 0.08, now + (i + 1) * d)
      }
      g.linearRampToValueAtTime(1, now + 6 * d + 0.004)
    } catch { /* a glitch never breaks the game */ }
  },

  stop(afterMs = 0): void {
    if (starting) { stopWhenStarted = true; return }
    if (!started || stopTimer) return
    stopTimer = setTimeout(() => {
      try { M?.vol.volume.rampTo(-60, 2) } catch {}
      stopTimer = setTimeout(() => { stopTimer = null; teardown(); want = null }, 2100)
    }, afterMs)
  },

  setMuted(m: boolean): void {
    muted = m
    try { M?.mute.gain.rampTo(m ? 0 : 1, 0.05) } catch {}
  },

  debug() {
    return { started, muted, step, repeats: repeatId === null ? 0 : 1, live, want }
  },
}
