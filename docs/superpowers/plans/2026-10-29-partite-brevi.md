# Partite brevi — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Short" game mode (best of 5 rounds, one action budget per round, spendable Hype) next to the current rules, which become "Classic".

**Architecture:** All rule numbers move into a `RULES` config with two presets (`classic`, `short`) in `lib/engine/config.ts`; the pure engine (`lib/engine/rules.ts`) reads `RULES[state.mode]`. Four new engine actions (`buyAction`, `buyDraw`, `boost`, `upgrade`) and new events feed the Zustand store, which the React components read. A bot-vs-bot simulator tunes the Short numbers.

**Tech Stack:** Next.js 15, React 19, TypeScript (strict), Zustand, Immer, Vitest 3, tsx (new dev dependency, for the simulator).

**Spec:** `docs/superpowers/specs/2026-10-29-partite-brevi-design.md`

## Global Constraints

- Classic mode must behave exactly as today: the 19 existing tests in `lib/engine/engine.test.ts` must pass, with only their `game()` helper changed to request `'classic'`.
- `createGame` defaults to `'short'`.
- The engine stays pure: no React, DOM, `Math.random` or timers in `lib/engine/*` (randomness only via the seeded `rand(state)`).
- `GameState` stays plain JSON (no functions, classes or `Map`s inside it). `RULES` is static config and is NOT stored in the state; the state stores only `mode`.
- Every illegal move returns `{ ok: false, error }` with a human-readable English message; it never throws to the caller.
- UI copy is English, like the rest of the game.
- Every commit message ends with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Commands run from the repo root `C:\Users\salva\Documents\it-sounds-terminal`. Test: `npm test`. Types: `npx tsc --noEmit`. Build: `npx next build`.

## Review Focus

- Picking a card back up (or undo) in Short must never push `actionsLeft` above the round budget plus actions bought — tested in Task 2.
- Mulligan in Short must restore the starting Hype (3, +0.5 Hip-Hop) and the round-1 budget (7), not Classic's 0 and 3 — tested in Task 2.
- While a player must discard (after Bootleg), shop moves must be refused like every other move — tested in Task 4.
- Threshold upgrade on a Small Stage (threshold 1.5) must stop at 0.5, not go to 0.5−… or below — tested in Task 4.
- A round that ends 0–0 must give the comeback bonus to nobody — tested in Task 2.

---

## File map

| File | Responsibility | Change |
|---|---|---|
| `lib/engine/config.ts` | `Mode`, `Rules`, `RULES` presets, `actionBudget()` | create |
| `lib/engine/types.ts` | state, actions, events | modify |
| `types/game.ts` | `StageState` gets boost/upgrade fields | modify |
| `lib/engine/rules.ts` | rules read from config; Short round flow; scoring; shop moves | modify |
| `lib/engine/bot.ts` | shop moves, lookahead, round-win weight | modify |
| `lib/engine/index.ts` | exports | modify |
| `lib/engine/engine.test.ts` | Classic tests (helper → classic) + Short tests | modify |
| `scripts/simulate.ts` | bot-vs-bot statistics for tuning | create |
| `store/gameStore.ts` | mode, new fields, shop actions, new events | modify |
| `components/overlays/SetupOverlay.tsx` | mode picker | modify |
| `components/game/RaceTracker.tsx` | round wins in Short | modify |
| `components/game/HypeShop.tsx` | buy action / buy draw buttons | create |
| `components/game/Hand.tsx` | mount HypeShop | modify |
| `components/game/PlayerStages.tsx` | boost / upgrade buttons, boost in score bar | modify |
| `components/overlays/ResultsOverlay.tsx` | round result + match result in Short | modify |

---

### Task 1: Rules config, game mode, new state fields (Classic unchanged)

**Files:**
- Create: `lib/engine/config.ts`
- Modify: `lib/engine/types.ts`, `types/game.ts`, `lib/engine/rules.ts`, `lib/engine/index.ts`, `store/gameStore.ts` (only `emptyStageState`)
- Test: `lib/engine/engine.test.ts`

**Interfaces:**
- Produces: `type Mode = 'classic' | 'short'`; `interface Rules`; `RULES: Record<Mode, Rules>`; `actionBudget(rules: Rules, round: number): number`; `rulesOf(state: GameState): Rules`; `actionCap(state: GameState, p: PlayerState): number`; `createGame(setup, seed?, mode: Mode = 'short')`; `GameState.mode | roundWins | totalFans | lastRoundWinner`; `PlayerState.extraActionsBought`; `StageState.boost | thresholdCut | multBonus | upgraded`.

- [ ] **Step 1: Point the existing tests at Classic and add the mode tests**

In `lib/engine/engine.test.ts`, change the `game()` helper (currently near the top) to:

```ts
function game(genres: [string, string] = ['Synthwave', 'Industrial'], seed = 42): GameState {
  return createGame([{ name: 'A', genre: genres[0] }, { name: 'B', genre: genres[1] }], seed, 'classic').state
}

function shortGame(genres: [string, string] = ['Rock', 'Jazz'], seed = 42): GameState {
  return createGame([{ name: 'A', genre: genres[0] }, { name: 'B', genre: genres[1] }], seed).state
}

// replace the hand but keep everything else (unlike setHand, which also sets the wallet)
function hand(s: GameState, pid: PlayerId, cards: Card[]): GameState {
  return produce(s, d => { d.players[pid].hand = cards })
}
```

Append at the end of the file:

```ts
describe('modes', () => {
  it('createGame defaults to short mode with its own starting setup', () => {
    const s = shortGame()
    expect(s.mode).toBe('short')
    expect(s.roundWins).toEqual([0, 0])
    expect(s.totalFans).toEqual([0, 0])
    expect(s.lastRoundWinner).toBeNull()
    expect(s.players[0].wallet).toBe(3)
    expect(s.players[0].actionsLeft).toBe(7)
    expect(s.players[0].extraActionsBought).toBe(0)
    expect(s.players[0].unlocked).toEqual({ s1: true, s2: true, s3: true })
  })

  it('Hip-Hop gets its +0.5 on round 1 in short mode', () => {
    expect(shortGame(['Hip-Hop', 'Jazz']).players[0].wallet).toBe(3.5)
  })

  it('classic mode keeps the old setup', () => {
    const s = game()
    expect(s.mode).toBe('classic')
    expect(s.players[0].wallet).toBe(0)
    expect(s.players[0].actionsLeft).toBe(3)
    expect(s.players[0].unlocked.s2).toBe(false)
  })

  it('new stage fields start at zero', () => {
    const st = shortGame().players[0].stages.s1
    expect([st.boost, st.thresholdCut, st.multBonus, st.upgraded]).toEqual([0, 0, 0, false])
  })
})
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `npm test`
Expected: FAIL — TypeScript/vitest errors such as `Expected 1-2 arguments, but got 3` for `createGame`, and `expected undefined to be 'short'`.

- [ ] **Step 3: Create `lib/engine/config.ts`**

```ts
// Rule presets. The state stores only `mode`; everything else is read from here,
// so Classic (the original rules) and Short can share one engine.

export type Mode = 'classic' | 'short'

export interface ShopRules {
  extraAction: { cost: number; maxPerRound: number }
  draw: { cost: number; cards: number }
  boost: { cost: number; amount: number; maxPerStage: number }
  upgrade: { cost: number; thresholdCut: number; minThreshold: number; multBonus: number }
}

export interface Rules {
  // perPhase: the budget refills at every phase; perRound: one budget per round (byRound[i] = round i+1, last value repeats)
  actions: { kind: 'perPhase'; amount: number } | { kind: 'perRound'; byRound: number[] }
  win: { kind: 'singleRound'; score: number } | { kind: 'bestOf'; wins: number; maxRounds: number }
  roundIncome: (round: number) => number
  incomeOnFirstRound: boolean
  hipHopRoundBonus: number
  comebackBonus: number
  fansToHype: boolean
  unlockAllFromStart: boolean
  startHand: number
  roundDraw: number
  shop: ShopRules | null
}

export const RULES: Record<Mode, Rules> = {
  classic: {
    actions: { kind: 'perPhase', amount: 3 },
    win: { kind: 'singleRound', score: 20 },
    roundIncome: round => Math.min(round, 5),
    incomeOnFirstRound: false,
    hipHopRoundBonus: 0.5,
    comebackBonus: 0,
    fansToHype: true,
    unlockAllFromStart: false,
    startHand: 10,
    roundDraw: 7,
    shop: null,
  },
  short: {
    actions: { kind: 'perRound', byRound: [7, 8, 9, 10] },
    win: { kind: 'bestOf', wins: 3, maxRounds: 5 },
    roundIncome: () => 3,
    incomeOnFirstRound: true,
    hipHopRoundBonus: 0.5,
    comebackBonus: 2,
    fansToHype: false,
    unlockAllFromStart: true,
    startHand: 10,
    roundDraw: 7,
    shop: {
      extraAction: { cost: 3, maxPerRound: 2 },
      draw: { cost: 2, cards: 2 },
      boost: { cost: 2, amount: 1, maxPerStage: 3 },
      upgrade: { cost: 4, thresholdCut: 1, minThreshold: 0.5, multBonus: 1 },
    },
  },
}

export function actionBudget(rules: Rules, round: number): number {
  if (rules.actions.kind === 'perPhase') return rules.actions.amount
  const t = rules.actions.byRound
  return t[Math.min(round, t.length) - 1]
}
```

- [ ] **Step 4: Extend the types**

In `types/game.ts`, inside `interface StageState`, after `combos: Combo[]` add:

```ts
  // Short mode, reset every round
  boost: number         // flat fans added on top of the stage score
  thresholdCut: number  // fans removed from the stage threshold
  multBonus: number     // added to the hardware multiplier (or to 1 without hardware)
  upgraded: boolean     // one upgrade per stage per round
```

In `lib/engine/types.ts`:
- add `import type { Mode } from './config'` and `export type { Mode }` after the existing imports;
- in `PlayerState` add `extraActionsBought: number` after `actionsLeft: number`;
- in `GameState` add after `nextId: number`:

```ts
  mode: Mode
  roundWins: [number, number]
  totalFans: [number, number]
  lastRoundWinner: PlayerId | 'draw' | null
```

- [ ] **Step 5: Read the rules from the config in `lib/engine/rules.ts`**

1. Imports: add `import { RULES, actionBudget, type Mode, type Rules } from './config'`.
2. Keep the exported constants `MAX_ACTIONS`, `START_HAND`, `ROUND_DRAW`, `WIN_SCORE` (the store still imports `MAX_ACTIONS` until Task 7), but stop using `START_HAND`, `ROUND_DRAW`, `WIN_SCORE` and `MAX_ACTIONS` inside the engine.
3. Add after `function fail`:

```ts
export function rulesOf(state: GameState): Rules {
  return RULES[state.mode]
}

// most actions a player can hold right now (refunds never go above this)
export function actionCap(state: GameState, p: PlayerState): number {
  return actionBudget(rulesOf(state), state.round) + p.extraActionsBought
}

function startingWallet(rules: Rules, genre: string): number {
  return rules.incomeOnFirstRound ? rules.roundIncome(1) + (genre === 'Hip-Hop' ? rules.hipHopRoundBonus : 0) : 0
}
```

4. `emptyStage()` returns, in addition to the current fields: `boost: 0, thresholdCut: 0, multBonus: 0, upgraded: false`.
5. Replace `createGame` with:

```ts
export function createGame(setup: [PlayerSetup, PlayerSetup], seed = Date.now(), mode: Mode = 'short'): { state: GameState; events: GameEvent[] } {
  const rules = RULES[mode]
  const events: GameEvent[] = []
  const base = {
    players: [] as unknown, round: 1, phaseIdx: 0, gameOver: false, winner: null, seed: seed | 0, nextId: 1,
    mode, roundWins: [0, 0], totalFans: [0, 0], lastRoundWinner: null,
  } as GameState
  const state = produce(base, s => {
    s.players = setup.map(ps => ({
      name: ps.name, genre: ps.genre, subGenre: ps.subGenre ?? '',
      deck: [], hand: [], trash: [], stages: emptyStages(),
      unlocked: { s1: true, s2: rules.unlockAllFromStart, s3: rules.unlockAllFromStart },
      wallet: startingWallet(rules, ps.genre), bestRound: 0, lastRoundScore: 0,
      actionsLeft: actionBudget(rules, 1), extraActionsBought: 0,
      mustDiscard: 0, ready: false, hasAttacked: false, mulliganUsed: false,
      placedThisPhase: [], history: [],
    }) as PlayerState) as [PlayerState, PlayerState]
    for (const pid of [0, 1] as PlayerId[]) {
      s.players[pid].deck = buildDeck(s)
      draw(s, pid, rules.startHand, events)
    }
    events.push({ type: 'phase', phase: PHASES[0], round: 1 })
  })
  return { state, events }
}
```

6. In `spend`, `takeBack`, `undo`, `mulligan` and `advancePhase`, replace every use of `MAX_ACTIONS` as follows (full new bodies for these functions come in Task 2; for now make the minimal change so Classic stays identical):
   - `spend`: unchanged.
   - `takeBack` and `undo`: `Math.min(p.actionsLeft + 1, MAX_ACTIONS)` → `Math.min(p.actionsLeft + 1, actionCap(state, p))`. To have `state` available, change the signatures to `takeBack(state: GameState, p: PlayerState, pid: PlayerId, sk: StageKey, slot: StageSlot, events: GameEvent[])` and `undo(state: GameState, p: PlayerState, pid: PlayerId, events: GameEvent[])`, and update the three call sites (`undo` → `takeBack(state, p, …)`; in `applyAction`: `case 'pickup': takeBack(s, p, pid, action.sk, action.slot, events)` and `case 'undo': undo(s, p, pid, events)`).
   - `mulligan`: `p.wallet = 0` → `p.wallet = startingWallet(rulesOf(state), p.genre)`; `p.actionsLeft = MAX_ACTIONS` → `p.actionsLeft = actionCap(state, p)`; `draw(state, pid, START_HAND, events)` → `draw(state, pid, rulesOf(state).startHand, events)`.
   - `advancePhase`: `p.actionsLeft = MAX_ACTIONS` → `p.actionsLeft = actionBudget(rulesOf(state), state.round)`; `draw(state, pid, ROUND_DRAW, events)` → `draw(state, pid, rulesOf(state).roundDraw, events)`; `scores.some(x => x >= WIN_SCORE)` → `scores.some(x => x >= 20)` temporarily (Task 2 replaces this block).

7. In `store/gameStore.ts`, `emptyStageState()` returns the four new fields too: `boost: 0, thresholdCut: 0, multBonus: 0, upgraded: false`.

8. In `lib/engine/index.ts` add:

```ts
export { RULES, actionBudget, type Rules, type ShopRules } from './config'
export { rulesOf, actionCap } from './rules'
```

- [ ] **Step 6: Run tests and types**

Run: `npm test` then `npx tsc --noEmit`
Expected: all tests PASS (19 old + 4 new = 23), tsc prints nothing.

- [ ] **Step 7: Commit**

```bash
git add lib/engine types/game.ts store/gameStore.ts
git commit -m "Engine: rule presets (classic/short) and game mode

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Short round flow — budget per round, best of 5, Hype income

**Files:**
- Modify: `lib/engine/rules.ts` (`advancePhase`)
- Test: `lib/engine/engine.test.ts`

**Interfaces:**
- Consumes: `rulesOf`, `actionBudget`, `actionCap`, `startingWallet` (Task 1).
- Produces: event `{ type: 'roundWon'; winner: PlayerId | 'draw'; scores: [number, number]; roundWins: [number, number] }`; the `results` event gains `roundWins: [number, number]`.

- [ ] **Step 1: Write the failing tests**

Append to `lib/engine/engine.test.ts`:

```ts
// a Small Stage that passes its 1.5k threshold: 0.3 talent + 1.5 track (+0.4 Rock bonus)
function winningStage(s: GameState, pid: PlayerId): GameState {
  s = hand(s, pid, [T('Small Stage', 700 + pid * 10), T('Beat Machine', 701 + pid * 10)])
  s = ok(s, pid, { type: 'play', handIdx: 0, sk: 's1' }).state
  s = ok(s, pid, { type: 'play', handIdx: 0, sk: 's1' }).state
  s = readyBoth(s)
  s = hand(s, pid, [T('Hypnotic Loop', 702 + pid * 10)])
  return ok(s, pid, { type: 'play', handIdx: 0, sk: 's1' }).state
}

describe('short mode: actions', () => {
  it('one budget for the whole round, not refilled per phase', () => {
    let s = hand(shortGame(), 0, [T('Small Stage', 900)])
    s = ok(s, 0, { type: 'play', handIdx: 0, sk: 's1' }).state
    expect(s.players[0].actionsLeft).toBe(6)
    s = readyBoth(s)
    expect(s.phaseIdx).toBe(1)
    expect(s.players[0].actionsLeft).toBe(6)
  })

  it('budget grows 7, 8, 9, 10 and unspent actions are lost', () => {
    let s = shortGame()
    const seen: number[] = []
    for (let r = 1; r <= 4; r++) { seen.push(s.players[0].actionsLeft); s = toPhase(s, 3); s = readyBoth(s) }
    expect(seen).toEqual([7, 8, 9, 10])
  })

  it('picking a card back up never goes above the budget', () => {
    let s = hand(shortGame(), 0, [T('Small Stage', 900)])
    s = ok(s, 0, { type: 'play', handIdx: 0, sk: 's1' }).state
    s = ok(s, 0, { type: 'pickup', sk: 's1', slot: 'stage' }).state
    expect(s.players[0].actionsLeft).toBe(7)
  })

  it('mulligan keeps the short-mode starting Hype and budget', () => {
    let s = hand(shortGame(['Hip-Hop', 'Jazz']), 0, [T('Small Stage', 900)])
    s = ok(s, 0, { type: 'play', handIdx: 0, sk: 's1' }).state
    s = ok(s, 0, { type: 'mulligan' }).state
    expect(s.players[0].wallet).toBe(3.5)
    expect(s.players[0].actionsLeft).toBe(7)
  })
})

describe('short mode: rounds', () => {
  it('the higher score wins the round; fans do not become Hype', () => {
    let s = winningStage(shortGame(), 0)
    const r = ok(ok(toPhase(s, 2), 0, { type: 'ready' }).state, 1, { type: 'ready' })
    s = r.state
    expect(s.phaseIdx).toBe(3)
    expect(s.roundWins).toEqual([1, 0])
    expect(s.lastRoundWinner).toBe(0)
    expect(s.players[0].wallet).toBe(3)
    expect(s.totalFans[0]).toBeGreaterThan(0)
    expect(r.events).toContainEqual(expect.objectContaining({ type: 'roundWon', winner: 0, roundWins: [1, 0] }))
  })

  it('next round: +3 to both, +2 comeback to the loser', () => {
    let s = toPhase(winningStage(shortGame(), 0), 3)
    s = readyBoth(s)
    expect(s.round).toBe(2)
    expect(s.players[0].wallet).toBe(6)
    expect(s.players[1].wallet).toBe(8)
  })

  it('a 0-0 round is won by nobody and gives no comeback bonus', () => {
    let s = toPhase(shortGame(), 3)
    expect(s.roundWins).toEqual([0, 0])
    expect(s.lastRoundWinner).toBe('draw')
    s = readyBoth(s)
    expect(s.players[0].wallet).toBe(6)
    expect(s.players[1].wallet).toBe(6)
  })

  it('first to 3 round wins takes the match', () => {
    let s = produce(shortGame(), d => { d.roundWins = [2, 0] })
    s = toPhase(winningStage(s, 0), 3)
    expect(s.gameOver).toBe(true)
    expect(s.winner).toBe(0)
  })

  it('after round 5 the most round wins takes it, then total fans, else draw', () => {
    const at5 = (wins: [number, number], fans: [number, number]) =>
      toPhase(produce(shortGame(), d => { d.round = 5; d.roundWins = wins; d.totalFans = fans }), 3)
    expect(at5([2, 1], [0, 50]).winner).toBe(0)
    expect(at5([1, 1], [10, 4]).winner).toBe(0)
    expect(at5([1, 1], [4, 10]).winner).toBe(1)
    const d = at5([1, 1], [5, 5])
    expect(d.gameOver).toBe(true)
    expect(d.winner).toBe('draw')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — e.g. `expected 3 to be 6` (budget refilled per phase), `expected undefined to deeply equal [1, 0]`.

- [ ] **Step 3: Add the event types**

In `lib/engine/types.ts`, in `GameEvent`:
- change the `results` member to `{ type: 'results'; scores: [number, number]; gameOver: boolean; winner: PlayerId | 'draw' | null; roundWins: [number, number] }`;
- add `| { type: 'roundWon'; winner: PlayerId | 'draw'; scores: [number, number]; roundWins: [number, number] }`.

- [ ] **Step 4: Replace `advancePhase` in `lib/engine/rules.ts`**

```ts
function advancePhase(state: GameState, events: GameEvent[]) {
  const rules = rulesOf(state)
  for (const p of state.players) {
    p.ready = false; p.placedThisPhase = []; p.history = []
    if (rules.actions.kind === 'perPhase') p.actionsLeft = rules.actions.amount
  }

  if (currentPhase(state) === 'RESULTS') {
    state.round += 1
    state.phaseIdx = 0
    state.players.forEach((p, i) => {
      const pid = i as PlayerId
      const lost = state.lastRoundWinner !== null && state.lastRoundWinner !== 'draw' && state.lastRoundWinner !== pid
      const gain = rules.roundIncome(state.round) + (p.genre === 'Hip-Hop' ? rules.hipHopRoundBonus : 0) + (lost ? rules.comebackBonus : 0)
      p.wallet += gain
      events.push({ type: 'income', player: pid, amount: gain })
      clearStages(p)
      if (state.round >= 2) p.unlocked = { s1: true, s2: true, s3: true }
      p.extraActionsBought = 0
      p.actionsLeft = actionBudget(rules, state.round)
      draw(state, pid, rules.roundDraw, events)
    })
    events.push({ type: 'phase', phase: 'ARRANGEMENT', round: state.round })
    return
  }

  state.phaseIdx += 1
  const phase = currentPhase(state)
  events.push({ type: 'phase', phase, round: state.round })
  if (phase !== 'RESULTS') return

  const scores = state.players.map(roundScore) as [number, number]
  state.players.forEach((p, i) => {
    if (rules.fansToHype) p.wallet += scores[i]
    p.lastRoundScore = scores[i]
    p.bestRound = Math.max(p.bestRound, scores[i])
    state.totalFans[i] = parseFloat((state.totalFans[i] + scores[i]).toFixed(2))
  })

  if (rules.win.kind === 'singleRound') {
    if (scores.some(x => x >= (rules.win as { score: number }).score)) {
      state.gameOver = true
      state.winner = scores[0] === scores[1] ? 'draw' : scores[0] > scores[1] ? 0 : 1
    }
  } else {
    const roundWinner: PlayerId | 'draw' = scores[0] === scores[1] ? 'draw' : scores[0] > scores[1] ? 0 : 1
    if (roundWinner !== 'draw') state.roundWins[roundWinner] += 1
    state.lastRoundWinner = roundWinner
    events.push({ type: 'roundWon', winner: roundWinner, scores, roundWins: [...state.roundWins] as [number, number] })
    const [w0, w1] = state.roundWins
    if (Math.max(w0, w1) >= rules.win.wins || state.round >= rules.win.maxRounds) {
      state.gameOver = true
      const [f0, f1] = state.totalFans
      state.winner = w0 !== w1 ? (w0 > w1 ? 0 : 1) : f0 !== f1 ? (f0 > f1 ? 0 : 1) : 'draw'
    }
  }
  events.push({ type: 'results', scores, gameOver: state.gameOver, winner: state.winner, roundWins: [...state.roundWins] as [number, number] })
}
```

- [ ] **Step 5: Run tests and types**

Run: `npm test` then `npx tsc --noEmit`
Expected: all PASS (32 tests), no type errors.

- [ ] **Step 6: Commit**

```bash
git add lib/engine
git commit -m "Engine: short mode round flow (round budget, best of 5, Hype income)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Scoring with boost and upgrades

**Files:**
- Modify: `lib/engine/rules.ts` (`scoreStage`)
- Test: `lib/engine/engine.test.ts`

**Interfaces:**
- Consumes: `StageState.boost | thresholdCut | multBonus` (Task 1).
- Produces: `scoreStage(s, genre, activeStages)` (existing, exported) now applies them.

- [ ] **Step 1: Write the failing tests**

Add `scoreStage, emptyStage` to the import from `./rules` at the top of the test file (`import { scoreStage, emptyStage } from './rules'`), then append:

```ts
describe('scoring with boost and upgrades', () => {
  // 0.30 talent + 1.0 track = 1.3 base; Classical gives no bonus with one track
  const base = () => ({ ...emptyStage(), stage: T('Small Stage', 1), artist1: T('Beat Machine', 2), track: T('Data Stream', 3) })

  it('extra multiplier adds to the hardware multiplier', () => {
    const s = scoreStage({ ...base(), hardware: T('Valve Pre-Amp', 4), multBonus: 1 }, 'Classical', 1)
    expect(s.current).toBe(3.9) // 1.3 × (2 + 1)
  })

  it('extra multiplier without hardware multiplies by 1 + bonus', () => {
    expect(scoreStage({ ...base(), multBonus: 1 }, 'Classical', 1).current).toBe(2.6)
  })

  it('threshold cut lowers the threshold', () => {
    expect(scoreStage({ ...base(), thresholdCut: 1 }, 'Classical', 1).threshold).toBe(0.5)
  })

  it('boost is added on top and counts for the threshold', () => {
    const s = scoreStage({ ...base(), stage: T('Medium Stage', 1), boost: 3 }, 'Classical', 1)
    expect(s.current).toBe(4.3)
    expect(s.current >= s.threshold).toBe(true) // 4.3 ≥ 3.5
  })

  it('boost still counts on a stage with no track yet', () => {
    expect(scoreStage({ ...base(), track: null, boost: 2 }, 'Classical', 1).current).toBe(2)
  })

  it('classic stages (all fields zero) score as before', () => {
    expect(scoreStage(base(), 'Classical', 1).current).toBe(1.3)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — e.g. `expected 2.6 to be 3.9`.

- [ ] **Step 3: Replace `scoreStage` in `lib/engine/rules.ts`**

```ts
export function scoreStage(s: StageState, genre: string, activeStages: number): StageState {
  if (!s.stage) return { ...s, current: 0, threshold: 0, bonus: 0, combos: [] }
  const threshold = parseFloat(((s.stage.threshold ?? 0) - s.thresholdCut).toFixed(2))
  const arts = artists(s)
  const trks = tracks(s)
  if (!arts.length || !trks.length) return { ...s, current: s.boost, threshold, bonus: 0, combos: [] }
  let base = arts.reduce((a, x) => a + (x.talent ?? 0) / 100, 0) +
    trks.reduce((a, t) => a + (t.power ?? t.bonus ?? 0), 0)
  base *= (s.hardware?.multiplier ?? 1) + s.multBonus
  const { bonus: comboBonus, mult: comboMult, active } = detectCombos(s)
  base = base * comboMult + comboBonus
  const gb = genreBonus(genre, s, activeStages)
  let guestB = 0
  if (s.guest?.type === 'collab') guestB = s.guest.bonus ?? 0
  else if (s.guest?.type === 'viral') guestB = s.guest.power ?? 0
  return { ...s, current: parseFloat((base + gb + guestB + s.boost).toFixed(2)), threshold, bonus: gb + guestB, combos: active.map(stripCombo) }
}
```

Note: `(hardware ?? 1) + multBonus` equals the old `hardware ? × multiplier : × 1` when `multBonus` is 0.

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: all PASS (38 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/engine
git commit -m "Engine: stage score applies boost and upgrades

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Hype shop moves (buyAction, buyDraw, boost, upgrade)

**Files:**
- Modify: `lib/engine/types.ts`, `lib/engine/rules.ts`
- Test: `lib/engine/engine.test.ts`

**Interfaces:**
- Consumes: `rulesOf`, `ShopRules` (Task 1), `artists` (existing).
- Produces: actions `{ type: 'buyAction' }`, `{ type: 'buyDraw' }`, `{ type: 'boost'; sk: StageKey }`, `{ type: 'upgrade'; sk: StageKey; kind: 'threshold' | 'mult' }`; events `{ type: 'bought'; player: PlayerId; what: 'action' | 'draw' }`, `{ type: 'boosted'; player: PlayerId; sk: StageKey; amount: number }`, `{ type: 'upgraded'; player: PlayerId; sk: StageKey; kind: 'threshold' | 'mult' }`.

- [ ] **Step 1: Write the failing tests**

```ts
describe('hype shop', () => {
  const stageWithArtist = (s: GameState) => {
    s = hand(s, 0, [T('Small Stage', 900), T('Beat Machine', 901)])
    s = ok(s, 0, { type: 'play', handIdx: 0, sk: 's1' }).state
    return ok(s, 0, { type: 'play', handIdx: 0, sk: 's1' }).state
  }
  const rich = (s: GameState, hype = 20) => produce(s, d => { d.players[0].wallet = hype })

  it('every shop move is refused in classic mode', () => {
    for (const a of [{ type: 'buyAction' }, { type: 'buyDraw' }, { type: 'boost', sk: 's1' }, { type: 'upgrade', sk: 's1', kind: 'mult' }] as Action[]) {
      expect(err(rich(game()), 0, a)).toMatch(/Classic/)
    }
  })

  it('buyAction: +1 action for 3 Hype, no action spent, max 2 per round', () => {
    let s = ok(shortGame(), 0, { type: 'buyAction' }).state
    expect(s.players[0].wallet).toBe(0)
    expect(s.players[0].actionsLeft).toBe(8)
    s = rich(s)
    s = ok(s, 0, { type: 'buyAction' }).state
    expect(err(s, 0, { type: 'buyAction' })).toMatch(/Max 2/)
  })

  it('buyAction needs enough Hype', () => {
    const s = produce(shortGame(), d => { d.players[0].wallet = 2 })
    expect(err(s, 0, { type: 'buyAction' })).toMatch(/Need 3 Hype/)
  })

  it('a bought action can be refunded by a pickup, but not beyond budget + bought', () => {
    let s = hand(rich(shortGame()), 0, [T('Small Stage', 900)])
    s = ok(s, 0, { type: 'buyAction' }).state
    s = ok(s, 0, { type: 'play', handIdx: 0, sk: 's1' }).state
    s = ok(s, 0, { type: 'pickup', sk: 's1', slot: 'stage' }).state
    expect(s.players[0].actionsLeft).toBe(8)
  })

  it('buyDraw: 2 Hype + 1 action for 2 cards', () => {
    const s0 = shortGame()
    const s = ok(s0, 0, { type: 'buyDraw' }).state
    expect(s.players[0].hand).toHaveLength(s0.players[0].hand.length + 2)
    expect(s.players[0].wallet).toBe(1)
    expect(s.players[0].actionsLeft).toBe(6)
  })

  it('boost: only in Live Show, needs an artist, +1k per 2 Hype, max +3k per stage', () => {
    let s = rich(stageWithArtist(shortGame()))
    expect(err(s, 0, { type: 'boost', sk: 's1' })).toMatch(/Live Show/)
    s = toPhase(s, 2)
    expect(err(s, 0, { type: 'boost', sk: 's2' })).toMatch(/artist/)
    for (let i = 0; i < 3; i++) s = ok(s, 0, { type: 'boost', sk: 's1' }).state
    expect(s.players[0].stages.s1.boost).toBe(3)
    expect(s.players[0].stages.s1.current).toBe(3)
    expect(s.players[0].wallet).toBe(14)
    expect(err(s, 0, { type: 'boost', sk: 's1' })).toMatch(/\+3k/)
  })

  it('upgrade: once per stage per round, not in Arrangement, threshold floor 0.5', () => {
    let s = rich(stageWithArtist(shortGame()))
    expect(err(s, 0, { type: 'upgrade', sk: 's1', kind: 'threshold' })).toMatch(/Soundcheck or Live Show/)
    s = toPhase(s, 1)
    s = ok(s, 0, { type: 'upgrade', sk: 's1', kind: 'threshold' }).state
    expect(s.players[0].stages.s1.threshold).toBe(0.5) // 1.5 - 1, and never below 0.5
    expect(s.players[0].wallet).toBe(16)
    expect(err(s, 0, { type: 'upgrade', sk: 's1', kind: 'mult' })).toMatch(/already upgraded/)
  })

  it('upgrades and boosts are gone next round', () => {
    let s = rich(stageWithArtist(shortGame()))
    s = toPhase(s, 2)
    s = ok(s, 0, { type: 'boost', sk: 's1' }).state
    s = ok(s, 0, { type: 'upgrade', sk: 's1', kind: 'mult' }).state
    s = toPhase(s, 3)
    s = readyBoth(s)
    const st = s.players[0].stages.s1
    expect([st.boost, st.multBonus, st.upgraded]).toEqual([0, 0, false])
  })

  it('shop moves are refused while a discard is pending', () => {
    const s = produce(rich(shortGame()), d => { d.players[0].mustDiscard = 1 })
    expect(err(s, 0, { type: 'buyAction' })).toMatch(/Discard/)
  })
})
```

Also add `type Action` to the import from `./index` at the top of the test file if not already present (it is: `type Action` is imported).

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — TypeScript errors on the unknown action types, or `expected an error` / unhandled switch cases.

- [ ] **Step 3: Add the types**

In `lib/engine/types.ts`, `Action` gains:

```ts
  | { type: 'buyAction' }
  | { type: 'buyDraw' }
  | { type: 'boost'; sk: StageKey }
  | { type: 'upgrade'; sk: StageKey; kind: 'threshold' | 'mult' }
```

and `GameEvent` gains:

```ts
  | { type: 'bought'; player: PlayerId; what: 'action' | 'draw' }
  | { type: 'boosted'; player: PlayerId; sk: StageKey; amount: number }
  | { type: 'upgraded'; player: PlayerId; sk: StageKey; kind: 'threshold' | 'mult' }
```

- [ ] **Step 4: Implement in `lib/engine/rules.ts`**

Add before `// ── Entry point`:

```ts
// ── Hype shop (short mode) ───────────────────────────────────────────────────

function shopRules(state: GameState): ShopRules {
  const sh = rulesOf(state).shop
  if (!sh) fail('Not available in Classic mode')
  return sh
}

function pay(p: PlayerState, cost: number) {
  if (p.wallet < cost) fail(`Need ${cost} Hype (you have ${p.wallet.toFixed(1)})`)
  p.wallet = parseFloat((p.wallet - cost).toFixed(2))
}

function buyAction(state: GameState, pid: PlayerId, events: GameEvent[]) {
  const p = state.players[pid]
  const rule = shopRules(state).extraAction
  if (p.extraActionsBought >= rule.maxPerRound) fail(`Max ${rule.maxPerRound} extra actions per round`)
  pay(p, rule.cost)
  p.actionsLeft += 1
  p.extraActionsBought += 1
  events.push({ type: 'bought', player: pid, what: 'action' })
}

function buyDraw(state: GameState, pid: PlayerId, events: GameEvent[]) {
  const p = state.players[pid]
  const rule = shopRules(state).draw
  pay(p, rule.cost)
  spend(p)
  events.push({ type: 'bought', player: pid, what: 'draw' })
  draw(state, pid, rule.cards, events)
}

function boost(state: GameState, pid: PlayerId, sk: StageKey, events: GameEvent[]) {
  const p = state.players[pid]
  const rule = shopRules(state).boost
  if (currentPhase(state) !== 'LIVE SHOW') fail('Boost only during the Live Show')
  const s = p.stages[sk]
  if (!s.stage || !artists(s).length) fail('Boost needs a stage with at least one artist')
  if (s.boost + rule.amount > rule.maxPerStage) fail(`Max +${rule.maxPerStage}k boost per stage`)
  pay(p, rule.cost)
  spend(p)
  s.boost += rule.amount
  events.push({ type: 'boosted', player: pid, sk, amount: rule.amount })
  recalc(p, pid, events)
}

function upgrade(state: GameState, pid: PlayerId, sk: StageKey, kind: 'threshold' | 'mult', events: GameEvent[]) {
  const p = state.players[pid]
  const rule = shopRules(state).upgrade
  const phase = currentPhase(state)
  if (phase !== 'SOUNDCHECK' && phase !== 'LIVE SHOW') fail('Upgrades only in Soundcheck or Live Show')
  const s = p.stages[sk]
  if (!s.stage) fail('No stage to upgrade')
  if (s.upgraded) fail('This stage is already upgraded this round')
  pay(p, rule.cost)
  spend(p)
  if (kind === 'threshold') s.thresholdCut = Math.min(rule.thresholdCut, Math.max(0, (s.stage.threshold ?? 0) - rule.minThreshold))
  else s.multBonus = rule.multBonus
  s.upgraded = true
  events.push({ type: 'upgraded', player: pid, sk, kind })
  recalc(p, pid, events)
}
```

Add `type ShopRules` to the import from `./config`. In `applyAction`'s `switch`, add:

```ts
        case 'buyAction': buyAction(s, pid, events); break
        case 'buyDraw': buyDraw(s, pid, events); break
        case 'boost': boost(s, pid, action.sk, events); break
        case 'upgrade': upgrade(s, pid, action.sk, action.kind, events); break
```

- [ ] **Step 5: Run tests and types**

Run: `npm test` then `npx tsc --noEmit`
Expected: all PASS (47 tests), no type errors.

- [ ] **Step 6: Commit**

```bash
git add lib/engine
git commit -m "Engine: Hype shop moves (extra action, draw, boost, upgrade)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Bot plays the Short mode

**Files:**
- Modify: `lib/engine/bot.ts`
- Test: `lib/engine/engine.test.ts`

**Interfaces:**
- Consumes: `RULES` (Task 1), `roundScore` (existing), shop actions (Task 4).
- Produces: `candidateActions` returns shop moves in Short; `playBotPhase` unchanged signature.

- [ ] **Step 1: Write the failing tests**

```ts
describe('bot in short mode', () => {
  it('finishes a short match within 5 rounds, every time', () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      let s = shortGame(['Rock', 'Jazz'], seed)
      for (let i = 0; i < 100 && !s.gameOver; i++) {
        for (const pid of [0, 1] as PlayerId[]) if (!s.gameOver && !s.players[pid].ready) s = playBotPhase(s, pid).state
      }
      expect(s.gameOver).toBe(true)
      expect(s.round).toBeLessThanOrEqual(5)
    }
  })

  it('uses the Hype shop', () => {
    const used = new Set<string>()
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      let s = shortGame(['Synthwave', 'Punk'], seed)
      for (let i = 0; i < 100 && !s.gameOver; i++) {
        for (const pid of [0, 1] as PlayerId[]) {
          if (s.gameOver || s.players[pid].ready) continue
          const r = playBotPhase(s, pid)
          r.actions.forEach(a => used.add(a.type))
          s = r.state
        }
      }
    }
    expect(['buyAction', 'buyDraw', 'boost', 'upgrade'].some(t => used.has(t))).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: the "uses the Hype shop" test FAILS (bot never proposes shop moves). The first one may already pass.

- [ ] **Step 3: Update `lib/engine/bot.ts`**

1. Imports: `import { RULES } from './config'` and add `roundScore` to the import from `./rules`.
2. Replace `evaluate` with:

```ts
function evaluate(state: GameState, pid: PlayerId): number {
  let v = potential(state.players[pid]) - 0.8 * potential(state.players[1 - pid])
  // short mode: winning this round is what counts
  if (RULES[state.mode].win.kind === 'bestOf') {
    const mine = roundScore(state.players[pid]), theirs = roundScore(state.players[1 - pid])
    if (mine > theirs) v += 6
    else if (theirs > mine) v -= 6
  }
  return v
}
```

3. At the end of `candidateActions`, before `return out`, add:

```ts
  const shop = RULES[state.mode].shop
  if (shop) {
    if (p.extraActionsBought < shop.extraAction.maxPerRound) out.push({ type: 'buyAction' })
    out.push({ type: 'buyDraw' })
    for (const k of STAGE_KEYS) {
      if (!p.stages[k].stage) continue
      if (phase === 'LIVE SHOW') out.push({ type: 'boost', sk: k })
      if (phase === 'SOUNDCHECK' || phase === 'LIVE SHOW') {
        out.push({ type: 'upgrade', sk: k, kind: 'threshold' })
        out.push({ type: 'upgrade', sk: k, kind: 'mult' })
      }
    }
  }
```

4. In `playBotPhase`, buying an action or cards only pays off through the move that follows, so score those with one step of lookahead. Replace the inner candidate loop with:

```ts
    for (const a of candidateActions(state, pid)) {
      const r = applyAction(state, pid, a)
      if (!r.ok) continue
      let after = evaluate(r.state, pid)
      if (a.type === 'buyAction' || a.type === 'buyDraw') {
        // worth it only if it enables a good next move
        let bestNext = -Infinity
        for (const n of candidateActions(r.state, pid)) {
          if (n.type === 'buyAction' || n.type === 'buyDraw') continue
          const rn = applyAction(r.state, pid, n)
          if (rn.ok) bestNext = Math.max(bestNext, evaluate(rn.state, pid))
        }
        after = bestNext
      }
      const d = after - base
      if (!best || d > best.d) best = { a, s: r.state, ev: r.events, d }
    }
```

and raise the loop limit from `step < 30` to `step < 40`.

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: all PASS (49 tests). If "finishes … within 5 rounds" is slow (> 20 s), that is acceptable for now; Task 6 measures it.

- [ ] **Step 5: Commit**

```bash
git add lib/engine
git commit -m "Bot: plays short mode (shop moves, lookahead, round-win weight)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Simulator and tuning

**Files:**
- Create: `scripts/simulate.ts`
- Modify: `package.json` (devDependency `tsx`, script `simulate`), `lib/engine/config.ts` (tuned numbers), `docs/superpowers/specs/2026-10-29-partite-brevi-design.md` (final numbers)

**Interfaces:**
- Consumes: `createGame`, `playBotPhase`, `RULES` from `@/lib/engine`.

- [ ] **Step 1: Install tsx and add the script**

Run: `npm install -D tsx@4` then `npm pkg set scripts.simulate="tsx scripts/simulate.ts"`
(tsx resolves the `@/*` path alias from `tsconfig.json`.)

- [ ] **Step 2: Write `scripts/simulate.ts`**

```ts
// Bot-vs-bot statistics for short mode. Usage: npm run simulate -- [games=300]
import { createGame, playBotPhase, type PlayerId } from '@/lib/engine'

const GENRES = ['Synthwave', 'Rock', 'Electronica', 'Hip-Hop', 'Punk', 'Jazz', 'Reggae', 'Classical']
const SHOP = ['buyAction', 'buyDraw', 'boost', 'upgrade'] as const
const N = Number(process.argv[2] ?? 300)

let rounds = 0, toFive = 0, comebacks = 0, p0wins = 0, draws = 0
const gamesUsing: Record<string, number> = Object.fromEntries(SHOP.map(k => [k, 0]))
const started = Date.now()

for (let i = 0; i < N; i++) {
  let s = createGame([{ name: 'A', genre: GENRES[i % 8] }, { name: 'B', genre: GENRES[(i * 3 + 1) % 8] }], 1000 + i, 'short').state
  const used = new Set<string>()
  const down02 = [false, false]
  for (let step = 0; step < 200 && !s.gameOver; step++) {
    for (const pid of [0, 1] as PlayerId[]) {
      if (s.gameOver || s.players[pid].ready) continue
      const r = playBotPhase(s, pid)
      r.actions.forEach(a => used.add(a.type))
      s = r.state
    }
    if (s.roundWins[0] === 0 && s.roundWins[1] === 2) down02[0] = true
    if (s.roundWins[1] === 0 && s.roundWins[0] === 2) down02[1] = true
  }
  rounds += s.round
  if (s.round === 5) toFive++
  if (s.winner === 'draw') draws++
  else if (s.winner !== null) { if (s.winner === 0) p0wins++; if (down02[s.winner]) comebacks++ }
  SHOP.forEach(k => { if (used.has(k)) gamesUsing[k]++ })
}

const pct = (x: number) => `${((x / N) * 100).toFixed(1)}%`
const avg = rounds / N
const rows: [string, string, boolean][] = [
  ['avg rounds (target 3.5–4.5)', avg.toFixed(2), avg >= 3.5 && avg <= 4.5],
  ['games reaching round 5 (target ≥25%)', pct(toFive), toFive / N >= 0.25],
  ...SHOP.map(k => [`games using ${k} (target ≥20%)`, pct(gamesUsing[k]), gamesUsing[k] / N >= 0.2] as [string, string, boolean]),
  ['comebacks from 0-2', pct(comebacks), true],
  ['first player wins', pct(p0wins), true],
  ['draws', pct(draws), true],
]
for (const [label, value, okv] of rows) console.log(`${okv ? 'PASS' : 'FAIL'}  ${label.padEnd(40)} ${value}`)
console.log(`${N} games in ${((Date.now() - started) / 1000).toFixed(1)}s`)
```

- [ ] **Step 3: Run it**

Run: `npm run simulate -- 300`
Expected: a table of PASS/FAIL lines and the timing. Record the output.

- [ ] **Step 4: Tune until every target line is PASS**

Change only numbers in `RULES.short` (`lib/engine/config.ts`) and, if a shop move is never chosen because the bot undervalues it, the weights in `potential`/`evaluate` in `lib/engine/bot.ts`. Rerun after each change. Levers, in order of effect:
- too long (avg > 4.5 or most games hit round 5): raise `byRound` budgets by 1, or lower `upgrade.cost`;
- too short (avg < 3.5, matches decided 3–0): raise `comebackBonus` by 1 so the trailing player wins more rounds, or lower `boost.maxPerStage` so a leader cannot buy every round;
- a shop move under 20%: lower its cost by 1 (minimum 1).
Stop after at most 6 tuning runs. If targets are still missed, keep the best run and report the numbers to the user instead of tuning further.

- [ ] **Step 5: Run the test suite again**

Run: `npm test`
Expected: all PASS (tuning must not break rule tests; if a test asserts an old number, e.g. `wallet` after `buyAction`, update the test to read the cost from `RULES.short.shop` rather than hard-coding the new value).

- [ ] **Step 6: Write the final numbers into the spec**

Update the "Spese" table and the actions line in `docs/superpowers/specs/2026-10-29-partite-brevi-design.md` with the tuned values, and add under "Test e taratura" the final simulator output (the PASS/FAIL table).

- [ ] **Step 7: Commit**

```bash
git add scripts/simulate.ts package.json package-lock.json lib/engine docs/superpowers/specs
git commit -m "Simulator for short mode; tuned rule numbers

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Store and mode picker

**Files:**
- Modify: `store/gameStore.ts`, `components/overlays/SetupOverlay.tsx`

**Interfaces:**
- Consumes: `actionCap`, `rulesOf`, `type Mode`, shop actions and events (Tasks 1–4).
- Produces (store fields read by Task 8; the round number is the existing `round` field): `mode: Mode`, `roundWins: [number, number]`, `lastRoundWinner: 0 | 1 | 'draw' | null`, `winner: 0 | 1 | 'draw' | null`, `playerRoundScore: number`, `aiRoundScore: number`, `extraActionsBought: number`, `shop: ShopRules | null`; store actions `buyAction(): void`, `buyDraw(): void`, `boost(sk: StageKey): void`, `upgrade(sk: StageKey, kind: 'threshold' | 'mult'): void`, `startGame(playerGenre, playerSubGenre, aiGenre, mode: Mode): void`.

- [ ] **Step 1: Store fields and projection**

In `store/gameStore.ts`:
1. Change the engine import to:

```ts
import {
  applyAction, createGame, playBotPhase, actionCap, rulesOf,
  type Action, type GameEvent, type GameState as EngineState, type PlayerId, type Mode, type ShopRules,
} from '@/lib/engine'
```

2. In `interface GameState` add:

```ts
  mode: Mode
  roundWins: [number, number]
  lastRoundWinner: PlayerId | 'draw' | null
  winner: PlayerId | 'draw' | null
  playerRoundScore: number; aiRoundScore: number
  extraActionsBought: number
  shop: ShopRules | null
```

3. In `INITIAL` add: `mode: 'short', roundWins: [0, 0], lastRoundWinner: null, winner: null, playerRoundScore: 0, aiRoundScore: 0, extraActionsBought: 0, shop: null,` and replace `actionsLeft: MAX_ACTIONS, maxActions: MAX_ACTIONS` with `actionsLeft: 3, maxActions: 3`.
4. In `project(g)` replace `maxActions: MAX_ACTIONS` with `maxActions: actionCap(g, me)` and add:

```ts
    mode: g.mode, roundWins: g.roundWins, lastRoundWinner: g.lastRoundWinner, winner: g.winner,
    playerRoundScore: me.lastRoundScore, aiRoundScore: ai.lastRoundScore,
    extraActionsBought: me.extraActionsBought, shop: rulesOf(g).shop,
```

- [ ] **Step 2: Store actions**

1. In `interface GameActions` change `startGame` to `startGame(playerGenre: string, playerSubGenre: string, aiGenre: string, mode: Mode): void` and add `buyAction(): void; buyDraw(): void; boost(sk: StageKey): void; upgrade(sk: StageKey, kind: 'threshold' | 'mult'): void`.
2. In `startGame`, pass the mode: `createGame([...same...], Date.now(), mode)`.
3. Add to the returned store object:

```ts
    buyAction() { dispatch({ type: 'buyAction' }) },
    buyDraw() { dispatch({ type: 'buyDraw' }) },
    boost(sk) { dispatch({ type: 'boost', sk }) },
    upgrade(sk, kind) { dispatch({ type: 'upgrade', sk, kind }) },
```

- [ ] **Step 3: New events in `handle(ev)`**

Add cases:

```ts
      case 'bought':
        if (mine) { Sound.click(); log(ev.what === 'action' ? '💸 Bought an extra action' : '💸 Bought 2 cards') }
        else log(ev.what === 'action' ? '💸 AI bought an extra action' : '💸 AI bought 2 cards')
        break
      case 'boosted':
        if (mine) { Sound.place(); log(`🔊 Boost +${ev.amount}k on ${label(ev.sk)}`) }
        else log(`🔊 AI boosted its ${label(ev.sk)} (+${ev.amount}k)`)
        break
      case 'upgraded':
        if (mine) { Sound.combo(); log(`⬆ ${label(ev.sk)} upgraded: ${ev.kind === 'threshold' ? 'needs 1k fewer fans' : 'multiplier +1'}`) }
        else log(`⬆ AI upgraded its ${label(ev.sk)}`)
        break
      case 'roundWon':
        log(ev.winner === 'draw' ? '🏁 Round drawn — nobody scores it' : ev.winner === ME ? `🏁 You win the round (${ev.roundWins[0]}–${ev.roundWins[1]})` : `🏁 AI wins the round (${ev.roundWins[0]}–${ev.roundWins[1]})`)
        break
```

In the `results` case, change the sound condition to work for both modes (it already uses `ev.winner`; keep it).

- [ ] **Step 4: Mode picker in `SetupOverlay.tsx`**

1. `import type { Mode } from '@/lib/engine'`; add state `const [mode, setMode] = useState<Mode>('short')`.
2. `handleStart`: `startGame(pGenre, pSub, aiGenre, mode)`; `handleRandom`: `startGame(pg, sg, ag, mode)`.
3. Before the YOUR GENRE block insert:

```tsx
        <div style={{ marginBottom: 14 }}>
          <label htmlFor="mode" style={{ fontFamily: "'Press Start 2P',monospace", color: 'var(--yel)', display: 'block', marginBottom: 8, fontSize: 11 }}>▶ MODE</label>
          <select id="mode" style={{ ...sel, border: '2px solid var(--yel)' }} value={mode} onChange={e => setMode(e.target.value as Mode)}>
            <option value="short">Short — best of 5 rounds</option>
            <option value="classic">Classic — first to 20k in one round</option>
          </select>
        </div>
```

- [ ] **Step 5: Types and tests**

Run: `npx tsc --noEmit` then `npm test`
Expected: no type errors; all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add store/gameStore.ts components/overlays/SetupOverlay.tsx
git commit -m "Store and setup: game mode, shop actions, round events

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Short-mode UI — round wins, Hype shop, stage boost/upgrade, results

**Files:**
- Create: `components/game/HypeShop.tsx`
- Modify: `components/game/RaceTracker.tsx`, `components/game/Hand.tsx`, `components/game/PlayerStages.tsx`, `components/overlays/ResultsOverlay.tsx`

**Interfaces:**
- Consumes: store fields/actions from Task 7.

- [ ] **Step 1: `RaceTracker.tsx` — round wins in Short**

At the top of the component, after reading the store, add `mode, roundWins, round` to the destructuring and return early for Short:

```tsx
  if (mode === 'short') {
    const pips = (n: number, col: string) => Array.from({ length: 3 }, (_, i) => (
      <span key={i} aria-hidden="true" style={{ width: 18, height: 18, display: 'inline-block', border: `2px solid ${col}`, background: i < n ? col : 'transparent', marginRight: 6 }} />
    ))
    return (
      <div className="race-bar-wrap" aria-label={`Round ${round} of 5. You ${roundWins[0]}, AI ${roundWins[1]} round wins. First to 3 wins.`}>
        <div style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 11, color: 'var(--muted)', marginBottom: 8, textAlign: 'center' }}>
          ROUND {round} / 5 · FIRST TO 3 WINS
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 40, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 11, color: 'var(--grn)' }}>YOU</span>{pips(roundWins[0], 'var(--grn)')}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 11, color: 'var(--mag)' }}>AI</span>{pips(roundWins[1], 'var(--mag)')}
          </div>
        </div>
      </div>
    )
  }
```

- [ ] **Step 2: Create `components/game/HypeShop.tsx`**

```tsx
'use client'
import { useGameStore } from '@/store/gameStore'

// Short mode only: spend Hype on an extra action or 2 cards.
export default function HypeShop() {
  const { shop, playerWallet, actionsLeft, extraActionsBought, phaseIdx, buyAction, buyDraw } = useGameStore()
  if (!shop || phaseIdx === 3) return null

  const actionWhy =
    extraActionsBought >= shop.extraAction.maxPerRound ? `Max ${shop.extraAction.maxPerRound} per round`
      : playerWallet < shop.extraAction.cost ? `Need ${shop.extraAction.cost} Hype` : null
  const drawWhy =
    playerWallet < shop.draw.cost ? `Need ${shop.draw.cost} Hype`
      : actionsLeft <= 0 ? 'No actions left' : null

  return (
    <div role="group" aria-label="Hype shop" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
      <span style={{ fontSize: 20, color: 'var(--yel)' }}>Hype {playerWallet.toFixed(1)}k:</span>
      <button className="btn btn-y" disabled={!!actionWhy} title={actionWhy ?? 'Costs no action'} onClick={buyAction}
        style={actionWhy ? { opacity: 0.45, cursor: 'not-allowed' } : undefined}>
        +1 ACTION · {shop.extraAction.cost}
      </button>
      <button className="btn btn-y" disabled={!!drawWhy} title={drawWhy ?? 'Costs 1 action'} onClick={buyDraw}
        style={drawWhy ? { opacity: 0.45, cursor: 'not-allowed' } : undefined}>
        DRAW {shop.draw.cards} · {shop.draw.cost}
      </button>
      {(actionWhy || drawWhy) && <span style={{ fontSize: 18, color: 'var(--muted)' }}>{actionWhy ?? drawWhy}</span>}
    </div>
  )
}
```

- [ ] **Step 3: Mount it in `Hand.tsx`**

Add `import HypeShop from './HypeShop'` and, inside the controls row `div` (the one with MULLIGAN / UNDO / next phase), append `<HypeShop />` as the last child.

- [ ] **Step 4: Boost and upgrade buttons in `PlayerStages.tsx`**

In `StagePanel`, read `shop, playerWallet, actionsLeft, phaseIdx, boost, upgrade` from the store (add them to the existing `useGameStore()` destructuring). Add `import { PHASES } from '@/lib/data'`. Right after the score bar `div`, insert:

```tsx
      {shop && s.stage && (() => {
        const phase = PHASES[phaseIdx]
        const noAct = actionsLeft <= 0 ? 'No actions left' : null
        const boostWhy = phase !== 'LIVE SHOW' ? 'Live Show only'
          : !(s.artist1 || s.artist2 || s.artist3) ? 'Needs an artist'
          : s.boost + shop.boost.amount > shop.boost.maxPerStage ? `Max +${shop.boost.maxPerStage}k`
          : playerWallet < shop.boost.cost ? `Need ${shop.boost.cost} Hype` : noAct
        const upWhy = phase !== 'SOUNDCHECK' && phase !== 'LIVE SHOW' ? 'Soundcheck / Live Show'
          : s.upgraded ? 'Already upgraded'
          : playerWallet < shop.upgrade.cost ? `Need ${shop.upgrade.cost} Hype` : noAct
        const btn = (why: string | null): React.CSSProperties => ({ fontSize: 9, padding: '6px 6px', flex: 1, ...(why ? { opacity: 0.45, cursor: 'not-allowed' } : {}) })
        return (
          <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }} onClick={e => e.stopPropagation()}>
            <button className="btn btn-m" style={btn(boostWhy)} disabled={!!boostWhy} title={boostWhy ?? ''} onClick={() => boost(sk)}>
              BOOST +{shop.boost.amount}k · {shop.boost.cost}
            </button>
            <button className="btn btn-c" style={btn(upWhy)} disabled={!!upWhy} title={upWhy ?? 'Fans needed −1k'} onClick={() => upgrade(sk, 'threshold')}>
              −1k NEED · {shop.upgrade.cost}
            </button>
            <button className="btn btn-c" style={btn(upWhy)} disabled={!!upWhy} title={upWhy ?? 'Multiplier +1'} onClick={() => upgrade(sk, 'mult')}>
              ×+1 · {shop.upgrade.cost}
            </button>
          </div>
        )
      })()}
```

In the score bar text, append the boost when present: change the template to
`` `FANS: ${s.current.toFixed(1)}k / NEED: ${s.threshold.toFixed(1)}k${s.bonus > 0 ? ` (+${s.bonus.toFixed(1)} bonus)` : ''}${s.boost > 0 ? ` (+${s.boost}k boost)` : ''}` ``.

- [ ] **Step 5: `ResultsOverlay.tsx` — round and match result in Short**

Read `mode, roundWins, lastRoundWinner, winner, playerRoundScore, aiRoundScore` from the store in addition to the current fields, and compute title/message/scores per mode:

```tsx
  let title: string, msg: string, left: number, right: number, leftLabel: string, rightLabel: string
  if (mode === 'short') {
    left = playerRoundScore; right = aiRoundScore; leftLabel = 'YOU · THIS ROUND'; rightLabel = 'AI · THIS ROUND'
    const tally = `${roundWins[0]}–${roundWins[1]}`
    if (gameOver) {
      title = winner === 0 ? '🏆 VICTORY!' : winner === 1 ? '💀 DEFEAT' : 'DRAW'
      msg = winner === 'draw' ? `Even on rounds and fans (${tally}).` : `Final score ${tally} in rounds.`
    } else {
      title = lastRoundWinner === 0 ? 'ROUND WON' : lastRoundWinner === 1 ? 'ROUND LOST' : 'ROUND DRAWN'
      msg = `Rounds ${tally} · first to 3 wins.${lastRoundWinner === 1 ? ' You get +2 Hype for the comeback.' : ''}`
    }
  } else {
    left = playerBestRound; right = aiBestRound; leftLabel = 'YOUR BEST'; rightLabel = 'AI BEST'
    // existing classic title/msg logic goes here unchanged, using pt = left, at = right
  }
```

Move the existing classic `if/else` chain into the `else` branch (with `pt`/`at` replaced by `left`/`right`), and render `leftLabel`/`left` and `rightLabel`/`right` in the two score boxes instead of the hard-coded `YOUR BEST`/`AI BEST` and `pt`/`at`.

- [ ] **Step 6: Types, tests, build**

Run: `npx tsc --noEmit`, `npm test`, `npx next build`
Expected: no type errors, all tests PASS, `✓ Compiled successfully`.

- [ ] **Step 7: Commit**

```bash
git add components
git commit -m "Short mode UI: round wins, Hype shop, stage boost/upgrade, round results

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Play-through check and deploy

**Files:** none (verification only)

- [ ] **Step 1: Play a Short match in the browser**

Run `npx next build` and `npx next start -p 3020`, open `http://localhost:3020`, pick MODE Short and play to the end. Check, writing down what you saw:
- round counter and pips update after each round;
- actions do not refill between phases and grow 7/8/9/10;
- +1 ACTION and DRAW work and disable with a reason;
- BOOST appears usable only in Live Show, upgrades only in Soundcheck/Live Show;
- results panel says ROUND WON/LOST/DRAWN, final panel VICTORY/DEFEAT/DRAW;
- a Classic match still shows the 20k race.

If no interactive browser is available, capture screenshots with headless Chrome at 1440 and 390 widths after starting a Short game, and say which checks stayed unverified.

- [ ] **Step 2: Deploy**

Run: `vercel deploy --prod --yes`, then confirm `https://it-sounds-terminal.vercel.app` returns 200.

- [ ] **Step 3: Report**

Tell the user: what changed, the final simulator table from Task 6, which checks from Step 1 were verified and which were not.
