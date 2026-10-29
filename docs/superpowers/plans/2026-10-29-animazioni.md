# Animazioni a tempo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cards fly and land on the beat, attacks shatter into pixels, the Live Show and the results become a party, and the AI's moves play one at a time, skippably.

**Architecture:** Three pure modules in `lib/fx/` (beat maths, event → animation steps, particle physics) are unit-tested. A client runner (`lib/fx/runner.ts`) measures DOM anchors, hides destination cards until they land, schedules the steps and drives one canvas plus Motion-animated flying cards (`components/board/FxLayer.tsx`, `FlyingCard.tsx`). The store keeps applying engine state immediately; the runner only shows it. Landing times come from `Music.nextBeatIn()`.

**Tech Stack:** Next.js 15, React 19, TypeScript, Zustand, Motion (`motion/react`, pinned `motion@12.42.2`), Canvas 2D, Vitest, headless-Chrome board check.

**Spec:** `docs/superpowers/specs/2026-10-29-animazioni-design.md`

## Global Constraints

- `lib/engine/` and the game rules do not change. The game never waits for animations: the store applies state immediately.
- New dependency: `motion` only, pinned to `12.42.2` (no `^`).
- Landing, layer flash and attack impact fall on the next beat; if less than 180 ms remain, on the beat after. Without music (off or muted) a fixed 320 ms is used.
- Return to hand ≈ 250 ms; move between stages ≈ 300 ms; AI moves ≈ 500 ms apart, cards before attacks; shake ≈ 300 ms; confetti ≈ 2 s.
- Live Show flash peaks at opacity 0.35, never a full white screen.
- At most 400 live particles; new ones replace the oldest.
- `prefers-reduced-motion: reduce` → no flights (150 ms fade instead), no particles, no shake, no flash.
- A player action during the AI sequence skips it first; a click or key press also skips it; hiding the tab ends running animations.
- If an anchor is missing, the card appears with a short fade instead of flying. A card must never stay hidden.
- No new vertical scroll at 1280×800 (existing checks L1–L3 must keep passing).
- Comments in English in the existing style; commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; branch `animazioni`.

## Review Focus

1. A destination card that never gets un-hidden (missing anchor, error, tab switch) → it must appear anyway. Pinned by board check A5.
2. The player clicks or acts while the AI sequence is running → sequence skipped, nothing left hidden or flying. Pinned by board check A4.
3. Many bursts in a row (confetti + fireworks + shards) → particle count stays ≤ 400. Pinned by the particles cap test in Task 3.
4. Reduced motion → no particles, no flights, the card still lands on the stage. Pinned by board check A3.
5. A draw at results → no confetti (counted as not a win). Pinned by the queue results test in Task 2.

---

### Task 1: Beat timing

**Files:**
- Create: `lib/fx/beat.ts`
- Test: `lib/fx/beat.test.ts`
- Modify: `lib/music/player.ts` (add `nextBeatIn` to the `Music` object)

**Interfaces:**
- Produces:
  - `interface BeatInfo { msToBeat: number; beatMs: number }`
  - `const MIN_LEAD_MS = 180`, `const FALLBACK_MS = 320`
  - `function landingDelay(beat: BeatInfo | null, min = MIN_LEAD_MS, fallback = FALLBACK_MS): number`
  - `Music.nextBeatIn(): BeatInfo | null` (null when music is not started or muted)

- [ ] **Step 1: Write the failing test**

`lib/fx/beat.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { FALLBACK_MS, landingDelay } from './beat'

describe('landingDelay', () => {
  it('uses a fixed duration without music', () => {
    expect(landingDelay(null)).toBe(FALLBACK_MS)
    expect(landingDelay({ msToBeat: 100, beatMs: 0 })).toBe(FALLBACK_MS)
  })
  it('lands on the next beat when there is time', () => {
    expect(landingDelay({ msToBeat: 300, beatMs: 600 })).toBe(300)
  })
  it('skips to the beat after when the next one is too close', () => {
    expect(landingDelay({ msToBeat: 100, beatMs: 600 })).toBe(700)
    expect(landingDelay({ msToBeat: -50, beatMs: 600 })).toBe(550)
  })
  it('rounds to whole milliseconds', () => {
    expect(landingDelay({ msToBeat: 250.6, beatMs: 600 })).toBe(251)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/fx/beat.test.ts`
Expected: FAIL with "Cannot find module './beat'"

- [ ] **Step 3: Write the implementation**

`lib/fx/beat.ts`:

```ts
// ── Animations on the beat ───────────────────────────────────────────────────
// How long a flight lasts so that its impact lands on a beat of the music.

export interface BeatInfo { msToBeat: number; beatMs: number }

export const MIN_LEAD_MS = 180   // shorter than this looks like a teleport: wait one more beat
export const FALLBACK_MS = 320   // no music (off or muted)

export function landingDelay(beat: BeatInfo | null, min = MIN_LEAD_MS, fallback = FALLBACK_MS): number {
  if (!beat || !(beat.beatMs > 0)) return fallback
  let d = beat.msToBeat
  while (d < min) d += beat.beatMs
  return Math.round(d)
}
```

In `lib/music/player.ts` add the import next to the others:

```ts
import type { BeatInfo } from '@/lib/fx/beat'
```

and add this method to the `Music` object, right after `setMuted`:

```ts
  nextBeatIn(): BeatInfo | null {
    if (!started || muted || !T) return null
    try {
      const tr = T.getTransport(), ctx = T.getContext()
      return { msToBeat: (tr.nextSubdivision('4n') - ctx.currentTime) * 1000, beatMs: 60000 / tr.bpm.value }
    } catch { return null }
  },
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npx vitest run lib/fx/beat.test.ts && npx tsc --noEmit`
Expected: PASS (4 tests), no type errors

- [ ] **Step 5: Commit**

```bash
git add lib/fx/beat.ts lib/fx/beat.test.ts lib/music/player.ts
git commit -m "FX: landing delay on the beat, Music.nextBeatIn

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: From engine events to animation steps

**Files:**
- Create: `lib/fx/queue.ts`
- Test: `lib/fx/queue.test.ts`

**Interfaces:**
- Consumes: `GameEvent`, `PlayerId` from `@/lib/engine`; `Card`, `StageKey`, `StageSlot` from `@/types/game`.
- Produces:
  ```ts
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
  export function buildSteps(events: GameEvent[], me: PlayerId): FxStep[]
  ```
  `at` = ms after the commit. Your own moves at 0; AI cards then AI attacks at 0, 500, 1000…; `live` and `results` after the last AI move + 300 (or at 0 if the AI did nothing); `gameOver` 1200 after `results`. Shields (`defended`) and returns to the defence slot have no step.

- [ ] **Step 1: Write the failing test**

`lib/fx/queue.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { TEMPLATES } from '@/lib/data'
import type { GameEvent } from '@/lib/engine'
import type { Card } from '@/types/game'
import { AFTER_MOVES_MS, AI_GAP_MS, GAME_OVER_AFTER_MS, buildSteps } from './queue'

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
    expect(steps.at(-1)).toEqual({ kind: 'live', at: AI_GAP_MS + AFTER_MOVES_MS })
    expect(buildSteps([{ type: 'phase', phase: 'SOUNDCHECK', round: 1 }], 0)).toEqual([])
    expect(buildSteps([{ type: 'phase', phase: 'LIVE SHOW', round: 1 }], 0)).toEqual([{ kind: 'live', at: 0 }])
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
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/fx/queue.test.ts`
Expected: FAIL with "Cannot find module './queue'"

- [ ] **Step 3: Write the implementation**

`lib/fx/queue.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/fx/queue.test.ts && npx tsc --noEmit`
Expected: PASS (7 tests), no type errors

- [ ] **Step 5: Commit**

```bash
git add lib/fx/queue.ts lib/fx/queue.test.ts
git commit -m "FX: build timed animation steps from engine events

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Particle system

**Files:**
- Create: `lib/fx/particles.ts`
- Test: `lib/fx/particles.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type BurstKind = 'ring' | 'shards' | 'confetti' | 'firework'
  export interface Particle { x: number; y: number; vx: number; vy: number; g: number; life: number; max: number; size: number; color: string }
  export const MAX_PARTICLES = 400
  export const BURST_SIZE: Record<BurstKind, number>   // ring 24, shards 36, confetti 120, firework 60
  export class ParticleSystem {
    particles: Particle[]
    spawned: number                                     // total ever added
    constructor(rand?: () => number)
    burst(kind: BurstKind, x: number, y: number, colors: string[], width?: number): number  // returns count added
    bolt(x1: number, y1: number, x2: number, y2: number, color: string): number             // 20 sparks along a line
    step(dtMs: number): void
    clear(): void
  }
  ```
  Units: pixels and milliseconds (velocities in px/ms, gravity in px/ms²). `width` is the spread for confetti (defaults to 800).

- [ ] **Step 1: Write the failing test**

`lib/fx/particles.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { BURST_SIZE, MAX_PARTICLES, ParticleSystem } from './particles'

const seeded = () => { let s = 1; return () => (s = (s * 16807) % 2147483647) / 2147483647 }

describe('ParticleSystem', () => {
  it('adds a burst of the documented size, in the given colours', () => {
    const p = new ParticleSystem(seeded())
    expect(p.burst('ring', 100, 100, ['#ff00aa'])).toBe(BURST_SIZE.ring)
    expect(p.particles).toHaveLength(BURST_SIZE.ring)
    expect(p.particles.every(q => q.color === '#ff00aa' && q.life > 0)).toBe(true)
    expect(p.spawned).toBe(BURST_SIZE.ring)
  })

  it('draws a bolt as 20 sparks between two points', () => {
    const p = new ParticleSystem(seeded())
    expect(p.bolt(0, 0, 100, 0, '#fff')).toBe(20)
    expect(p.particles.every(q => q.x >= -8 && q.x <= 108)).toBe(true)
  })

  it('never keeps more than MAX_PARTICLES, dropping the oldest', () => {
    const p = new ParticleSystem(seeded())
    p.burst('shards', 0, 0, ['#111'])
    for (let i = 0; i < 6; i++) p.burst('confetti', 0, 0, ['#222'], 1000)
    expect(p.particles.length).toBeLessThanOrEqual(MAX_PARTICLES)
    expect(p.particles.some(q => q.color === '#111')).toBe(false)
    expect(p.spawned).toBe(BURST_SIZE.shards + 6 * BURST_SIZE.confetti)
  })

  it('moves particles and removes them when their life ends', () => {
    const p = new ParticleSystem(seeded())
    p.burst('firework', 50, 50, ['#0f0'])
    const before = p.particles.map(q => [q.x, q.y])
    p.step(16)
    expect(p.particles.some((q, i) => q.x !== before[i][0] || q.y !== before[i][1])).toBe(true)
    p.step(5000)
    expect(p.particles).toHaveLength(0)
  })

  it('clears everything', () => {
    const p = new ParticleSystem(seeded())
    p.burst('ring', 0, 0, ['#fff'])
    p.clear()
    expect(p.particles).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/fx/particles.test.ts`
Expected: FAIL with "Cannot find module './particles'"

- [ ] **Step 3: Write the implementation**

`lib/fx/particles.ts`:

```ts
// ── Pixel particles ──────────────────────────────────────────────────────────
// Plain physics, no DOM: FxLayer draws `particles` on a canvas every frame.
// Pixels and milliseconds throughout.

export type BurstKind = 'ring' | 'shards' | 'confetti' | 'firework'
export interface Particle { x: number; y: number; vx: number; vy: number; g: number; life: number; max: number; size: number; color: string }

export const MAX_PARTICLES = 400
export const BURST_SIZE: Record<BurstKind, number> = { ring: 24, shards: 36, confetti: 120, firework: 60 }

export class ParticleSystem {
  particles: Particle[] = []
  spawned = 0
  constructor(private rand: () => number = Math.random) {}

  private add(list: Particle[]): number {
    this.particles.push(...list)
    this.spawned += list.length
    const over = this.particles.length - MAX_PARTICLES
    if (over > 0) this.particles.splice(0, over)
    return list.length
  }

  burst(kind: BurstKind, x: number, y: number, colors: string[], width = 800): number {
    const r = this.rand, n = BURST_SIZE[kind], out: Particle[] = []
    const pick = () => colors[Math.floor(r() * colors.length) % colors.length]
    for (let i = 0; i < n; i++) {
      if (kind === 'ring') {
        const a = (i / n) * Math.PI * 2
        out.push({ x, y, vx: Math.cos(a) * 0.28, vy: Math.sin(a) * 0.28, g: 0, life: 450, max: 450, size: 4, color: pick() })
      } else if (kind === 'shards') {
        const a = r() * Math.PI * 2, v = 0.12 + r() * 0.3
        out.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 0.15, g: 0.0009, life: 700, max: 700, size: 3 + Math.floor(r() * 4), color: pick() })
      } else if (kind === 'confetti') {
        const life = 1600 + r() * 600
        out.push({ x: x + (r() - 0.5) * width, y: y - r() * 60, vx: (r() - 0.5) * 0.08, vy: 0.05 + r() * 0.12, g: 0.00006, life, max: life, size: 4 + Math.floor(r() * 3), color: pick() })
      } else {
        const a = r() * Math.PI * 2, v = 0.1 + r() * 0.22
        out.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 0.0003, life: 1100, max: 1100, size: 3, color: pick() })
      }
    }
    return this.add(out)
  }

  bolt(x1: number, y1: number, x2: number, y2: number, color: string): number {
    const r = this.rand, out: Particle[] = []
    for (let i = 0; i < 20; i++) {
      const t = i / 19
      out.push({ x: x1 + (x2 - x1) * t + (r() - 0.5) * 12, y: y1 + (y2 - y1) * t + (r() - 0.5) * 12, vx: 0, vy: 0, g: 0, life: 260 + t * 120, max: 380, size: 4, color })
    }
    return this.add(out)
  }

  step(dtMs: number): void {
    for (const p of this.particles) {
      p.x += p.vx * dtMs
      p.y += p.vy * dtMs
      p.vy += p.g * dtMs
      p.life -= dtMs
    }
    this.particles = this.particles.filter(p => p.life > 0)
  }

  clear(): void {
    this.particles = []
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/fx && npx tsc --noEmit`
Expected: PASS (beat, queue, particles suites), no type errors

- [ ] **Step 5: Commit**

```bash
git add lib/fx/particles.ts lib/fx/particles.test.ts
git commit -m "FX: pixel particle system with a 400-particle cap

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Runner, canvas layer and flying cards

**Files:**
- Modify: `package.json`, `package-lock.json` (add `motion` 12.42.2)
- Create: `lib/fx/runner.ts`
- Create: `components/board/FxLayer.tsx`
- Create: `components/board/FlyingCard.tsx`
- Modify: `app/globals.css` (append the FX block at the end of the file)

**Interfaces:**
- Consumes: `FxStep` from `./queue`; `ParticleSystem` from `./particles`; `landingDelay` from `./beat`; `Music.nextBeatIn()`; `skinFor`, `TYPE_COLORS` from `@/lib/skins`; `Card` component from `components/board/Card`.
- Produces:
  ```ts
  // lib/fx/runner.ts
  export interface Rect { left: number; top: number; width: number; height: number }
  export interface Flight { id: number; card: Card; genre: string; from: Rect; to: Rect; ms: number }
  export const useFx: UseBoundStore<StoreApi<{ hidden: Record<string, true>; flights: Flight[]; playing: boolean }>>
  export const particles: ParticleSystem
  export const slotKey: (owner: Side, sk: StageKey, slot: StageSlot) => string   // `${owner}-${sk}-${slot}`
  export const handKey: (id: number) => string                                    // `hand-${id}`
  export const Fx: {
    prepare(steps: FxStep[]): void                    // call BEFORE the store applies the new state
    run(steps: FxStep[], genres: { me: string; ai: string }): void
    skip(): void
    onParticles(cb: (() => void) | null): void        // FxLayer registers its frame kicker
    debug(): { playing: boolean; flights: number; hidden: number; particles: number; spawned: number; flown: number }
  }
  ```
  DOM anchors used: hand cards `[data-card-id="<id>"]` (added in Task 5), field cards `[data-testid="field-card-<owner>-<sk>-<slot>"]`, AI deck `[data-testid="pile-ai-deck"]`, zones `[data-testid="zone-<owner>-<sk>"]`, sides `[data-testid="side-<me|ai>"]`, board `[data-testid="board"]`.

This task has no unit test (DOM and canvas); it is verified by `tsc`, `next build` and the board checks in Task 5.

- [ ] **Step 1: Install Motion**

Run: `npm install motion@12.42.2 --save-exact`
Expected: `package.json` lists `"motion": "12.42.2"`.

- [ ] **Step 2: Write the runner**

`lib/fx/runner.ts`:

```ts
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
```

- [ ] **Step 3: Write the flying card and the canvas layer**

`components/board/FlyingCard.tsx`:

```tsx
'use client'
import { motion } from 'motion/react'
import type { Flight } from '@/lib/fx/runner'
import Card from './Card'

// A card travelling between two anchors: drawn at its destination size, offset back
// to where it came from, then released along an arc with a small spin.
export default function FlyingCard({ f }: { f: Flight }) {
  const dx = f.from.left - f.to.left, dy = f.from.top - f.to.top
  const s = f.to.width > 0 ? f.from.width / f.to.width : 1
  const lift = Math.min(80, Math.abs(dy) * 0.25 + 30)
  return (
    <motion.div className="flying-card" data-testid="flying-card" aria-hidden="true"
      style={{ left: f.to.left, top: f.to.top, width: f.to.width, height: f.to.height, transformOrigin: '0 0' }}
      initial={{ x: dx, y: dy, scale: s, rotate: -8 }}
      animate={{ x: [dx, dx * 0.5, 0], y: [dy, Math.min(dy, 0) * 0.5 - lift, 0], scale: [s, ((s + 1) / 2) * 1.08, 1], rotate: [-8, 4, 0] }}
      transition={{ duration: f.ms / 1000, ease: 'easeOut', times: [0, 0.55, 1] }}>
      <div className="field-card-inner" style={{ width: '100%', height: '100%' }}>
        <Card card={f.card} genre={f.genre} size="field" />
      </div>
    </motion.div>
  )
}
```

`components/board/FxLayer.tsx`:

```tsx
'use client'
import { useEffect, useRef } from 'react'
import { Fx, particles, useFx } from '@/lib/fx/runner'
import FlyingCard from './FlyingCard'

// One canvas over the table for pixels, plus the cards in flight. The frame loop
// only runs while particles are alive. A click or key press skips the AI sequence.
export default function FxLayer() {
  const flights = useFx(s => s.flights)
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const cv = ref.current
    const ctx = cv?.getContext('2d')
    if (!cv || !ctx) return
    let raf = 0, last = 0
    const fit = () => {
      const d = window.devicePixelRatio || 1
      cv.width = Math.round(window.innerWidth * d); cv.height = Math.round(window.innerHeight * d)
      ctx.setTransform(d, 0, 0, d, 0, 0)
    }
    const frame = (t: number) => {
      const dt = last ? Math.min(50, t - last) : 16
      last = t
      particles.step(dt)
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)
      for (const p of particles.particles) {
        ctx.globalAlpha = Math.max(0, Math.min(1, p.life / p.max))
        ctx.fillStyle = p.color
        ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size)
      }
      ctx.globalAlpha = 1
      if (particles.particles.length) raf = requestAnimationFrame(frame)
      else { raf = 0; last = 0 }
    }
    const kick = () => { if (!raf) raf = requestAnimationFrame(frame) }
    const skipIfPlaying = () => { if (useFx.getState().playing) Fx.skip() }
    const onVis = () => { if (document.hidden) Fx.skip() }
    fit()
    window.addEventListener('resize', fit)
    Fx.onParticles(kick)
    document.addEventListener('pointerdown', skipIfPlaying, true)
    document.addEventListener('keydown', skipIfPlaying, true)
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.removeEventListener('resize', fit)
      Fx.onParticles(null)
      document.removeEventListener('pointerdown', skipIfPlaying, true)
      document.removeEventListener('keydown', skipIfPlaying, true)
      document.removeEventListener('visibilitychange', onVis)
      cancelAnimationFrame(raf)
    }
  }, [])
  return (
    <>
      <canvas ref={ref} className="fx-canvas" aria-hidden="true" />
      {flights.map(f => <FlyingCard key={f.id} f={f} />)}
    </>
  )
}
```

- [ ] **Step 4: Append the FX styles**

At the end of `app/globals.css`:

```css
/* ── Animations (lib/fx) ─────────────────────────────────────────────────── */
.fx-canvas { position: fixed; inset: 0; width: 100vw; height: 100vh; pointer-events: none; z-index: 90; }
.flying-card { position: fixed; pointer-events: none; z-index: 95; will-change: transform; }
.fx-hidden { visibility: hidden; }
.fx-fade { animation: fx-fade 150ms ease-out; }
@keyframes fx-fade { from { opacity: 0; } to { opacity: 1; } }
.fx-land { animation: fx-land 300ms cubic-bezier(0.2, 0.9, 0.3, 1.3); }
@keyframes fx-land {
  0% { transform: scale(1.12, 0.86); filter: brightness(1.9); }
  60% { transform: scale(0.96, 1.05); filter: brightness(1.2); }
  100% { transform: none; filter: none; }
}
.fx-shake { animation: fx-shake 300ms linear; }
@keyframes fx-shake {
  0%, 100% { transform: none; }
  20% { transform: translate(-6px, 2px); }
  40% { transform: translate(5px, -3px); }
  60% { transform: translate(-4px, 1px); }
  80% { transform: translate(3px, -1px); }
}
.fx-shield { animation: fx-shield 500ms ease-out; }
@keyframes fx-shield { 0% { box-shadow: 0 0 0 0 rgba(0, 255, 255, 0.9); } 100% { box-shadow: 0 0 0 18px rgba(0, 255, 255, 0); } }
.fx-dim { animation: fx-dim 2600ms ease-in-out both; }
@keyframes fx-dim { 0% { filter: none; } 25%, 80% { filter: brightness(0.35) saturate(0.4); } 100% { filter: none; } }
.board.fx-live-hit::after {
  content: ''; position: absolute; inset: 0; pointer-events: none; z-index: 40;
  background: radial-gradient(ellipse at 50% 0%, rgba(255, 255, 255, 0.35), transparent 70%);
  animation: fx-flash 700ms ease-out forwards;
}
@keyframes fx-flash { from { opacity: 1; } to { opacity: 0; } }
.board.fx-live-hit .board-lights { animation: fx-sweep 900ms ease-out; }
@keyframes fx-sweep { 0% { transform: scaleX(0.2); opacity: 0.3; } 60% { transform: scaleX(1.1); opacity: 1; } 100% { transform: none; } }
.board[data-phase="LIVE SHOW"] .board-lights { filter: brightness(1.3) saturate(1.2); }
@media (prefers-reduced-motion: reduce) {
  .fx-land, .fx-shake, .fx-shield, .fx-dim, .board.fx-live-hit .board-lights { animation: none; }
  .board.fx-live-hit::after { display: none; }
}
```

- [ ] **Step 5: Typecheck, test, build**

Run: `npx tsc --noEmit && npm test && npx next build`
Expected: no type errors; all unit tests pass; build compiles.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json lib/fx/runner.ts components/board/FxLayer.tsx components/board/FlyingCard.tsx app/globals.css
git commit -m "FX: runner, canvas layer and flying cards (Motion)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Wire animations into the board and the store

**Files:**
- Modify: `store/gameStore.ts` (imports; `commit`; `dispatch`; `nextPhase`)
- Modify: `components/board/Board.tsx` (mount `FxLayer`, `data-phase`)
- Modify: `components/board/StageZone.tsx` (`FieldSlot` hides while its card is in flight)
- Modify: `components/board/HandFan.tsx` (`data-card-id`; hide while a card flies back)
- Modify: `app/page.tsx` (e2e hook `__itsoundsFx`)
- Modify: `scripts/board-check.mjs` (checks A1–A5)

**Interfaces:**
- Consumes: `buildSteps` from `@/lib/fx/queue`; `Fx`, `useFx`, `slotKey`, `handKey` from `@/lib/fx/runner`; `FxLayer` component.
- Produces: `window.__itsoundsFx` (only with `?e2e=1`).

- [ ] **Step 1: Write the failing board checks**

In `scripts/board-check.mjs`, below the `waitMusic` helper add:

```js
const FX = expr => js(`(() => { const f = window.__itsoundsFx?.debug(); return f ? (${expr}) : null })()`)
const FAKE_ATTACK = `[{ kind: 'attack', attacker: 'ai', sk: 's1', blocked: null, destroyed: [{ id: -9, type: 'artist', name: 'X', desc: '' }], at: 0 }]`
```

and at the end of the `CHECKS` object add:

```js
  A1: ['fx: a played card flies, then sits on the stage', async () => {
    await newGame('short', `h.some(c => ${SMALL})`)
    await sleep(800)
    const f0 = await FX('f.flown')
    if (f0 === null) return false
    await click('zone-me-s1')
    await js(`document.querySelectorAll('[data-testid="hand-card"]')[${await idxOf(SMALL)}].click()`)
    let flew = false
    for (let t = 0; t < 600 && !flew; t += 50) { flew = await exists('flying-card'); if (!flew) await sleep(50) }
    await sleep(1500)
    return flew && (await FX('f.flown')) === f0 + 1 && (await FX('f.flights === 0 && f.hidden === 0')) === true
      && await js(`(() => { const el = document.querySelector('[data-testid="field-card-me-s1-stage"]'); return !!el && !el.classList.contains('fx-hidden') })()`)
  }],
  A2: ['fx: a destroying attack shatters into pixels and shakes the stage', async () => {
    await newGame()
    await sleep(800)
    const s0 = await FX('f.spawned')
    await js(`window.__itsoundsFx.run(${FAKE_ATTACK}, { me: 'Synthwave', ai: 'Industrial' })`)
    let shook = false
    for (let t = 0; t < 1500 && !shook; t += 50) { shook = await js(`document.querySelector('[data-testid="zone-me-s1"]').classList.contains('fx-shake')`); if (!shook) await sleep(50) }
    return shook && (await FX('f.spawned')) > s0
  }],
  A3: ['fx: reduced motion shows no particles and no flight, and the card still lands', async () => {
    await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
    try {
      await newGame('short', `h.some(c => ${SMALL})`)
      await sleep(800)
      const [s0, f0] = await FX('[f.spawned, f.flown]')
      await js(`window.__itsoundsFx.run(${FAKE_ATTACK}, { me: 'Synthwave', ai: 'Industrial' })`)
      await click('zone-me-s1')
      await clickHandCard(await idxOf(SMALL))
      await sleep(1200)
      const [s1, f1, h] = await FX('[f.spawned, f.flown, f.hidden]')
      return s1 === s0 && f1 === f0 && h === 0 && await exists('field-card-me-s1-stage')
    } finally {
      await send('Emulation.setEmulatedMedia', { features: [] })
    }
  }],
  A4: ['fx: a click skips the AI move sequence', async () => {
    for (let k = 0; k < 6; k++) {
      await newGame()
      await sleep(300)
      await click('next-phase')
      if (await FX('f.playing')) {
        await js(`document.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))`)
        await sleep(100)
        return (await FX('!f.playing && f.flights === 0 && f.hidden === 0')) === true
      }
    }
    return false
  }],
  A5: ['fx: a card whose destination is missing is never left hidden', async () => {
    await newGame()
    await sleep(800)
    const step = `[{ kind: 'fly', owner: 'me', card: { id: -7, type: 'artist', name: 'Ghost', desc: '' }, sk: 's3', slot: 'artist3', from: 'hand', at: 0 }]`
    await js(`(() => { window.__itsoundsFx.prepare(${step}); window.__itsoundsFx.run(${step}, { me: 'Synthwave', ai: 'Industrial' }) })()`)
    await sleep(600)
    return (await FX('f.hidden === 0 && f.flights === 0')) === true
  }],
```

- [ ] **Step 2: Run the checks to verify they fail**

Run: `npx next build && npm run check:board -- --only=A1,A2,A3,A4,A5`
Expected: A1–A5 FAIL (`window.__itsoundsFx` is not exposed yet).

- [ ] **Step 3: Mount the layer and hook the components**

`components/board/Board.tsx`:
1. Add imports: `import { PHASES } from '@/lib/data'` and `import FxLayer from './FxLayer'`.
2. At the top of `Board()`, add `const phaseIdx = useGameStore(s => s.phaseIdx)`.
3. Change the root to `<div className="board" data-testid="board" data-phase={PHASES[phaseIdx]}>` and add `<FxLayer />` right after `<Drawer />`.

`components/board/StageZone.tsx`, in `FieldSlot`:
1. Add `import { slotKey, useFx } from '@/lib/fx/runner'` with the other imports.
2. After the `useGameStore()` line inside `FieldSlot`, add `const inFlight = useFx(s => !!s.hidden[slotKey(owner, sk, sl)])`.
3. Change the root `className` to ``className={`field-slot${moving ? ' moving' : ''}${inFlight ? ' fx-hidden' : ''}`}``.

`components/board/HandFan.tsx`:
1. Add `import { handKey, useFx } from '@/lib/fx/runner'` with the other imports.
2. After the `useGameStore()` line, add `const hidden = useFx(s => s.hidden)`.
3. On the `.fan-card` div add `data-card-id={card.id}` and change its `className` to ``className={`fan-card${selected ? ' selected' : ''}${hidden[handKey(card.id)] ? ' fx-hidden' : ''}`}``.

`app/page.tsx`: add `import { Fx } from '@/lib/fx/runner'` and, inside the `?e2e` branch after the `__itsoundsMusic` line:

```ts
      ;(window as unknown as { __itsoundsFx?: typeof Fx }).__itsoundsFx = Fx
```

- [ ] **Step 4: Feed the runner from the store**

In `store/gameStore.ts`:

1. Imports, next to the music imports:

```ts
import { buildSteps } from '@/lib/fx/queue'
import { Fx } from '@/lib/fx/runner'
```

2. Replace `commit`:

```ts
  function commit(g: EngineState, events: GameEvent[]) {
    const steps = buildSteps(events, ME)
    Fx.prepare(steps)   // measure and hide before React shows the new state
    set({ ...project(g), previewCard: null })
    for (const ev of events) handle(ev)
    Music.apply(mixFor(g, ME))
    if (g.gameOver) Music.stop(4000)   // let the results stinger play first
    Fx.run(steps, { me: get().playerGenre, ai: get().aiGenre })
  }
```

3. In `dispatch`, make the first line of the body `Fx.skip()   // your move ends the AI's animation sequence`.
4. In `nextPhase`, make the first line of the body `Fx.skip()`.

- [ ] **Step 5: Run everything**

Run: `npx tsc --noEmit && npm test && npx next build && npm run check:board`
Expected: no type errors; all unit tests pass; all board checks pass (C1–C16, L1–L3, M1–M5, A1–A5). C14 has been seen to fail intermittently only inside the full run; if it fails, re-run `npm run check:board -- --only=C14` three times and report the results.

- [ ] **Step 6: Commit**

```bash
git add store/gameStore.ts components/board/Board.tsx components/board/StageZone.tsx components/board/HandFan.tsx app/page.tsx scripts/board-check.mjs
git commit -m "FX: the board animates every move on the beat (store wiring, e2e checks)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

After the final review the controller deploys with `vercel deploy --prod --yes` and asks the user to play a match and judge fun and timing.
