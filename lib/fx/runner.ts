'use client'

// ── Animation runner ─────────────────────────────────────────────────────────
// The store has already applied the new state; this only *shows* it. prepare()
// measures where cards come from and hides where they go (before React re-renders),
// run() schedules each step, skip() jumps to the final picture. A hidden card is
// always un-hidden: on landing, on a missing anchor, on skip, or by the watchdog.

import { create } from 'zustand'
import { Music } from '@/lib/music/player'
import { skinFor, TYPE_COLORS } from '@/lib/skins'
import type { Card, StageKey, StageSlot } from '@/types/game'
import { landingDelay } from './beat'
import { ParticleSystem } from './particles'
import type { FxStep, Side } from './queue'

export interface Rect { left: number; top: number; width: number; height: number }
export interface Flight { id: number; card: Card; genre: string; from: Rect; to: Rect; ms: number }

export const useFx = create<{ hidden: Record<string, true>; flights: Flight[]; playing: boolean }>(() => ({ hidden: {}, flights: [], playing: false }))
export const particles = new ParticleSystem()

export const slotKey = (owner: Side, sk: StageKey, slot: StageSlot) => `${owner}-${sk}-${slot}`
export const handKey = (id: number) => `hand-${id}`

const RETURN_MS = 250
const MOVE_MS = 300
const FADE_MS = 150
const FX_CLASSES = ['fx-land', 'fx-shake', 'fx-shield', 'fx-dim', 'fx-live-hit', 'fx-fade']

let timers: ReturnType<typeof setTimeout>[] = []
let sources = new Map<FxStep, Rect>()
let kick: (() => void) | null = null
let flown = 0
let nextId = 1

const reduced = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
const q = (sel: string) => (typeof document === 'undefined' ? null : document.querySelector(sel))
function rectOf(sel: string): Rect | null {
  const el = q(sel)
  if (!el) return null
  const r = el.getBoundingClientRect()
  return r.width > 0 ? { left: r.left, top: r.top, width: r.width, height: r.height } : null
}
const center = (r: Rect) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 })
const fieldSel = (owner: Side, sk: StageKey, slot: StageSlot) => `[data-testid="field-card-${owner}-${sk}-${slot}"]`
const handSel = (id: number) => `[data-card-id="${id}"]`

function later(ms: number, fn: () => void) { timers.push(setTimeout(fn, ms)) }
// two frames: React has committed the new state and the browser has laid it out
function afterPaint(fn: () => void) { requestAnimationFrame(() => requestAnimationFrame(fn)) }
function flash(sel: string, cls: string, ms: number) {
  const el = q(sel)
  if (!el) return
  el.classList.remove(cls)
  void (el as HTMLElement).offsetWidth   // restart the CSS animation
  el.classList.add(cls)
  later(ms, () => el.classList.remove(cls))
}
function setHidden(keys: string[], on: boolean) {
  if (!keys.length) return
  useFx.setState(s => {
    const hidden = { ...s.hidden }
    for (const k of keys) { if (on) hidden[k] = true; else delete hidden[k] }
    return { hidden }
  })
}
function spawn(fn: () => void) {
  if (reduced()) return
  fn()
  kick?.()
}

function destKey(s: FxStep): string | null {
  if (s.kind === 'fly' || s.kind === 'move') return slotKey(s.owner, s.sk, s.slot)
  if (s.kind === 'return' && s.owner === 'me') return handKey(s.card.id)
  return null
}

function travel(s: Extract<FxStep, { kind: 'fly' | 'return' | 'move' }>, genres: { me: string; ai: string }) {
  const key = destKey(s)
  const toSel = s.kind === 'return' ? handSel(s.card.id) : fieldSel(s.owner, s.sk, s.slot)
  afterPaint(() => {
    const from = sources.get(s) ?? null, to = rectOf(toSel)
    const ms = s.kind === 'fly' ? landingDelay(Music.nextBeatIn()) : s.kind === 'return' ? RETURN_MS : MOVE_MS
    if (!from || !to || reduced()) {
      if (key) setHidden([key], false)
      flash(toSel, 'fx-fade', FADE_MS + 50)
      return
    }
    const f: Flight = { id: nextId++, card: s.card, genre: s.owner === 'me' ? genres.me : genres.ai, from, to, ms }
    flown++
    useFx.setState(st => ({ flights: [...st.flights, f] }))
    later(ms, () => {
      useFx.setState(st => ({ flights: st.flights.filter(x => x.id !== f.id) }))
      if (key) setHidden([key], false)
      if (s.kind !== 'fly') return
      flash(toSel, 'fx-land', 320)
      const c = center(to)
      spawn(() => particles.burst('ring', c.x, c.y, [skinFor(f.genre).main]))
    })
  })
}

function attack(s: Extract<FxStep, { kind: 'attack' }>) {
  const target: Side = s.attacker === 'me' ? 'ai' : 'me'
  const zoneSel = `[data-testid="zone-${target}-${s.sk}"]`
  const zone = rectOf(zoneSel), side = rectOf(`[data-testid="side-${s.attacker}"]`)
  if (!zone) return
  const z = center(zone)
  if (side) { const a = center(side); spawn(() => particles.bolt(a.x, a.y, z.x, z.y, '#ffee00')) }
  later(landingDelay(Music.nextBeatIn()), () => {
    if (s.blocked === 'shield') {
      flash(zoneSel, 'fx-shield', 520)
      spawn(() => particles.burst('ring', z.x, z.y, ['#00ffff']))
      return
    }
    const colors = s.blocked === 'decoy' ? ['#ff88ff', '#ffffff'] : [...s.destroyed.map(c => TYPE_COLORS[c.type] ?? '#ffffff'), '#ffffff']
    if (s.blocked === 'decoy' || s.destroyed.length) {
      spawn(() => particles.burst('shards', z.x, z.y, colors))
      if (!reduced()) flash(zoneSel, 'fx-shake', 320)
    }
  })
}

function live() {
  later(landingDelay(Music.nextBeatIn()), () => { if (!reduced()) flash('[data-testid="board"]', 'fx-live-hit', 950) })
}

function results(win: boolean, genre: string) {
  if (win) {
    const colors = [skinFor(genre).main, ...Object.values(TYPE_COLORS)]
    for (let i = 0; i < 3; i++) later(i * 400, () => spawn(() => particles.burst('confetti', window.innerWidth / 2, 0, colors, window.innerWidth)))
    return
  }
  ;(['s1', 's2', 's3'] as StageKey[]).forEach((sk, i) => later(i * 250, () => flash(`[data-testid="zone-me-${sk}"]`, 'fx-dim', 2600)))
}

function gameOver(win: boolean, genre: string) {
  if (!win) return
  const colors = [skinFor(genre).main, '#ffee00', '#ffffff', '#00ffff']
  for (let i = 0; i < 5; i++) later(i * 450, () => spawn(() =>
    particles.burst('firework', window.innerWidth * (0.2 + Math.random() * 0.6), window.innerHeight * (0.15 + Math.random() * 0.3), colors)))
}

export const Fx = {
  prepare(steps: FxStep[]): void {
    if (typeof document === 'undefined') return
    sources = new Map()
    const hide: string[] = []
    for (const s of steps) {
      if (s.kind === 'fly') {
        const r = s.from === 'hand' ? rectOf(handSel(s.card.id)) : rectOf('[data-testid="pile-ai-deck"]')
        if (r) sources.set(s, r)
      } else if (s.kind === 'return') {
        const r = rectOf(fieldSel(s.owner, s.sk, s.slot))
        if (r) sources.set(s, r)
      } else if (s.kind === 'move') {
        const r = rectOf(fieldSel(s.owner, s.fromSk, s.fromSlot))
        if (r) sources.set(s, r)
      }
      const k = destKey(s)
      if (k) hide.push(k)
    }
    setHidden(hide, true)
  },

  run(steps: FxStep[], genres: { me: string; ai: string }): void {
    if (typeof window === 'undefined' || !steps.length) return
    const lastAt = Math.max(...steps.map(s => s.at))
    const aiSequence = steps.some(s => s.at > 0 || ('owner' in s && s.owner === 'ai') || (s.kind === 'attack' && s.attacker === 'ai'))
    if (aiSequence) useFx.setState({ playing: true })
    for (const s of steps) {
      later(s.at, () => {
        if (s.kind === 'fly' || s.kind === 'return' || s.kind === 'move') travel(s, genres)
        else if (s.kind === 'attack') attack(s)
        else if (s.kind === 'live') live()
        else if (s.kind === 'results') results(s.win, genres.me)
        else gameOver(s.win, genres.me)
      })
    }
    if (aiSequence) later(lastAt + 900, () => useFx.setState({ playing: false }))
    // watchdog: whatever happened, nothing stays hidden or in flight
    later(lastAt + 2500, () => useFx.setState({ hidden: {}, flights: [] }))
  },

  skip(): void {
    for (const t of timers) clearTimeout(t)
    timers = []
    sources = new Map()
    particles.clear()
    useFx.setState({ hidden: {}, flights: [], playing: false })
    if (typeof document !== 'undefined') {
      for (const c of FX_CLASSES) document.querySelectorAll(`.${c}`).forEach(el => el.classList.remove(c))
    }
  },

  onParticles(cb: (() => void) | null): void {
    kick = cb
  },

  debug() {
    const s = useFx.getState()
    return { playing: s.playing, flights: s.flights.length, hidden: Object.keys(s.hidden).length, particles: particles.particles.length, spawned: particles.spawned, flown }
  },
}
