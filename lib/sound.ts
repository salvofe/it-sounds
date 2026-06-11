'use client'

// ── Sound service (Tone.js wrapper) ──────────────────────────────────────────
// Initialized lazily on first user interaction.
// All methods are safe to call before init (they silently no-op).

type ToneModule = typeof import('tone')
type PolySynth = InstanceType<ToneModule['PolySynth']>
type Synth = InstanceType<ToneModule['Synth']>
type Reverb = InstanceType<ToneModule['Reverb']>

let Tone: ToneModule | null = null
let poly: PolySynth | null = null
let blip: Synth | null = null
let reverb: Reverb | null = null
let ready = false
let muted = false

async function init(): Promise<void> {
  if (ready || typeof window === 'undefined') return
  try {
    Tone = await import('tone')
    await Tone.start()
    poly = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 0.02, decay: 0.2, sustain: 0.3, release: 0.8 },
    }).toDestination() as PolySynth
    ;(poly as any).volume.value = -14
    reverb = new Tone.Reverb(1.5).toDestination() as Reverb
    ;(poly as any).connect(reverb)
    blip = new Tone.Synth({
      oscillator: { type: 'square' },
      envelope: { attack: 0.01, decay: 0.1, sustain: 0, release: 0.1 },
    }).toDestination() as Synth
    ;(blip as any).volume.value = -18
    ready = true
  } catch (e) {
    console.warn('Sound init failed', e)
  }
}

function sweep(notes: string[], dur = 0.12): void {
  if (!ready || !poly || !Tone) return
  const now = Tone.now()
  notes.forEach((n, i) => {
    try { (poly as any).triggerAttackRelease(n, dur * 1.6, now + i * dur) } catch {}
  })
}

const PHASE_NOTES: Record<string, string[]> = {
  ARRANGEMENT: ['C3', 'E3', 'G3', 'C4'],
  SOUNDCHECK: ['D3', 'F3', 'A3', 'D4'],
  'LIVE SHOW': ['E3', 'G3', 'B3', 'E4', 'G4'],
  RESULTS: ['C4', 'G3', 'E3', 'C3'],
}

const CARD_NOTES: Record<string, string[]> = {
  stage: ['C4', 'G4'],
  artist: ['E4', 'B4'],
  track: ['G4', 'D5'],
  hardware: ['C3', 'C4'],
  defense: ['A3', 'E4'],
  attack: ['C2', 'F#2'],
  collab: ['E4', 'G4', 'C5'],
  sponsor: ['C5', 'E5', 'G5'],
  viral: ['G4', 'C5', 'E5', 'G5'],
  draw: ['D5', 'A4'],
}

export const Sound = {
  get muted() { return muted },
  get ready() { return ready },

  async unlock(): Promise<void> {
    await init()
  },

  toggle(): boolean {
    muted = !muted
    if (poly) (poly as any).volume.value = muted ? -Infinity : -14
    if (blip) (blip as any).volume.value = muted ? -Infinity : -18
    return muted
  },

  phase(phase: string): void {
    if (!ready || muted) return
    sweep(PHASE_NOTES[phase] ?? ['C3', 'E3', 'G3'])
  },

  card(type: string): void {
    if (!ready || muted || !blip || !Tone) return
    if (type === 'attack') { this.attack(); return }
    const notes = CARD_NOTES[type] ?? ['C5']
    const now = Tone.now()
    notes.forEach((n, i) => {
      try { (blip as any).triggerAttackRelease(n, '32n', now + i * 0.06) } catch {}
    })
  },

  click(): void {
    if (!ready || muted || !blip || !Tone) return
    try { (blip as any).triggerAttackRelease('C5', '16n') } catch {}
  },

  place(): void {
    if (!ready || muted || !blip || !Tone) return
    try { (blip as any).triggerAttackRelease('E5', '16n') } catch {}
  },

  attack(): void {
    if (!ready || muted || !poly || !Tone) return
    const n = Tone.now()
    try {
      ;(poly as any).triggerAttackRelease('C2', 0.3, n)
      ;(poly as any).triggerAttackRelease('F#2', 0.2, n + 0.08)
    } catch {}
  },

  win(): void {
    if (!ready || muted) return
    sweep(['C4', 'E4', 'G4', 'C5', 'E5', 'G5'], 0.1)
  },

  lose(): void {
    if (!ready || muted) return
    sweep(['C4', 'A3', 'F3', 'D3', 'C3'], 0.15)
  },

  combo(): void {
    if (!ready || muted) return
    sweep(['E4', 'A4', 'C5', 'E5', 'A5'], 0.07)
  },
}
