import { produce } from 'immer'
import type { Card, Combo, Phase, StageKey, StageSlot, StageState } from '@/types/game'
import {
  TEMPLATES, DECK_LIST, DECK_SIZE, FILLER_TEMPLATE, PHASES,
  detectCombos, genreBonus, stageCostMod, isBonus, isPhaseOk,
} from '@/lib/data'
import { RULES, actionBudget, type Mode, type Rules, type ShopRules } from './config'
import type { Action, ActionResult, GameEvent, GameState, PlayerId, PlayerState } from './types'

// ── Constants ────────────────────────────────────────────────────────────────

export const STAGE_KEYS: StageKey[] = ['s1', 's2', 's3']
export const ARTIST_SLOTS = ['artist1', 'artist2', 'artist3'] as const
export const TRACK_SLOTS = ['track', 'track2', 'track3'] as const
export const ALL_SLOTS: StageSlot[] = ['stage', 'artist1', 'artist2', 'artist3', 'hardware', 'track', 'track2', 'track3', 'guest']
export const MAX_ACTIONS = 3
export const START_HAND = 10
export const ROUND_DRAW = 7
export const WIN_SCORE = 20

class RuleError extends Error {}
function fail(msg: string): never { throw new RuleError(msg) }

// ── Random (seeded, so a server and a replay produce the same game) ──────────

function rand(state: GameState): number {
  // mulberry32
  state.seed = (state.seed + 0x6d2b79f5) | 0
  let t = state.seed
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

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

function shuffleInPlace<T>(state: GameState, a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand(state) * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function buildDeck(state: GameState): Card[] {
  const deck: Card[] = []
  const add = (t: number) => deck.push({ ...TEMPLATES[t], id: state.nextId++ })
  for (const [t, n] of DECK_LIST) for (let i = 0; i < n; i++) add(t)
  while (deck.length < DECK_SIZE) add(FILLER_TEMPLATE)
  return shuffleInPlace(state, deck)
}

// ── Stage helpers ────────────────────────────────────────────────────────────

export function emptyStage(): StageState {
  return {
    stage: null, artist1: null, artist2: null, artist3: null,
    hardware: null, track: null, track2: null, track3: null, guest: null,
    current: 0, threshold: 0, bonus: 0, protected: false, decoy: false, combos: [],
    boost: 0, thresholdCut: 0, multBonus: 0, upgraded: false,
  }
}

function emptyStages(): Record<StageKey, StageState> {
  return { s1: emptyStage(), s2: emptyStage(), s3: emptyStage() }
}

export function artists(s: StageState): Card[] {
  return ARTIST_SLOTS.map(k => s[k]).filter(Boolean) as Card[]
}

export function tracks(s: StageState): Card[] {
  return TRACK_SLOTS.map(k => s[k]).filter(Boolean) as Card[]
}

export function stageCost(card: Card, genre: string): number {
  return Math.max(0, (card.cost ?? 0) + stageCostMod(genre))
}

export function sponsorIncome(card: Card, genre: string): number {
  return (card.income ?? 0) + (genre === 'Hip-Hop' ? 1 : 0)
}

function slotExists(s: StageState, slot: StageSlot): boolean {
  const max = s.stage?.maxTracks ?? 1
  if (slot === 'track2') return max >= 2
  if (slot === 'track3') return max >= 3
  return true
}

function slotAccepts(card: Card, slot: StageSlot): boolean {
  if (slot === 'stage') return card.type === 'stage'
  if (slot === 'hardware') return card.type === 'hardware'
  if (slot === 'guest') return isBonus(card.type)
  if (slot.startsWith('artist')) return card.type === 'artist'
  if (slot.startsWith('track')) return card.type === 'track'
  return false
}

// conditions a bonus card needs on the stage it sits on
function bonusProblem(card: Card, s: StageState): string | null {
  if (card.type === 'collab' && !card.encore && artists(s).length < 2) return 'Collab needs 2+ artists'
  if (card.type === 'viral' && !artists(s).some(a => (a.talent ?? 0) >= 30)) return 'Viral Hit needs a 30+ talent artist'
  return null
}

// ── Scoring ──────────────────────────────────────────────────────────────────

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

export function stagePasses(s: StageState): boolean {
  return s.threshold > 0 && s.current >= s.threshold
}

export function roundScore(p: PlayerState): number {
  return parseFloat(STAGE_KEYS.reduce((a, k) => a + (stagePasses(p.stages[k]) ? p.stages[k].current : 0), 0).toFixed(2))
}

function recalc(p: PlayerState, pid: PlayerId, events: GameEvent[]) {
  const active = STAGE_KEYS.filter(k => p.stages[k].stage).length
  for (const k of STAGE_KEYS) {
    const before = new Set(p.stages[k].combos.map(c => c.id))
    p.stages[k] = scoreStage(p.stages[k], p.genre, active)
    for (const c of p.stages[k].combos) {
      if (!before.has(c.id)) events.push({ type: 'combo', player: pid, sk: k, combo: c })
    }
  }
}

// combos carry a test function in lib/data; keep state serialisable
function stripCombo(c: Combo): Combo {
  return { id: c.id, name: c.name, desc: c.desc, bonus: c.bonus, mult: c.mult }
}

// ── Deck ─────────────────────────────────────────────────────────────────────

function draw(state: GameState, pid: PlayerId, n: number, events: GameEvent[]) {
  const p = state.players[pid]
  const drawn: number[] = []
  for (let i = 0; i < n; i++) {
    if (!p.deck.length) {
      if (!p.trash.length) break
      p.deck = shuffleInPlace(state, p.trash)
      p.trash = []
      events.push({ type: 'reshuffled', player: pid, count: p.deck.length })
    }
    const c = p.deck.pop()!
    p.hand.push(c); drawn.push(c.id)
  }
  if (drawn.length) events.push({ type: 'drew', player: pid, cards: drawn })
}

// ── Setup ────────────────────────────────────────────────────────────────────

export interface PlayerSetup { name: string; genre: string; subGenre?: string }

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

// ── Phase flow ───────────────────────────────────────────────────────────────

export function currentPhase(state: GameState): Phase {
  return PHASES[state.phaseIdx]
}

function clearStages(p: PlayerState) {
  for (const k of STAGE_KEYS) {
    for (const sl of ALL_SLOTS) {
      const c = p.stages[k][sl] as Card | null
      if (c) p.trash.push(c)
    }
    p.stages[k] = emptyStage()
  }
}

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

// ── Action handlers ──────────────────────────────────────────────────────────

function spend(p: PlayerState) {
  if (p.actionsLeft <= 0) fail('No actions left this phase! Move placed cards (free) or advance the phase.')
  p.actionsLeft -= 1
}

function handCard(p: PlayerState, idx: number): Card {
  const c = p.hand[idx]
  if (!c) fail('No such card in hand')
  return c
}

function play(state: GameState, pid: PlayerId, a: Extract<Action, { type: 'play' }>, events: GameEvent[]) {
  const p = state.players[pid]
  const card = handCard(p, a.handIdx)
  const phase = currentPhase(state)
  if (!isPhaseOk(card.type, phase)) fail(`${card.name} can't be played in ${phase} phase`)
  if (card.type === 'attack') fail('Attack cards need a target')

  if (card.type === 'draw') {
    spend(p)
    p.hand.splice(a.handIdx, 1); p.trash.push(card)
    draw(state, pid, card.draw ?? 2, events)
    if (card.discard) p.mustDiscard = card.discard
    return
  }

  if (card.type === 'stage') {
    let sk: StageKey | undefined
    if (a.slot === 'stage') sk = p.unlocked[a.sk] ? a.sk : undefined
    else if (a.slot) fail('Stage cards go in the stage slot')
    else {
      sk = (p.unlocked[a.sk] && !p.stages[a.sk].stage) ? a.sk
        : STAGE_KEYS.find(k => p.unlocked[k] && !p.stages[k].stage)
          ?? (p.unlocked[a.sk] ? a.sk : undefined)
    }
    if (!sk) fail('No unlocked stage lane available.')
    const replaced = p.stages[sk].stage
    const refund = replaced ? stageCost(replaced, p.genre) : 0
    const cost = stageCost(card, p.genre)
    if (cost > p.wallet + refund) fail(`Need ${cost}k Hype (you have ${p.wallet.toFixed(1)}k). Play a SPONSOR first!`)
    spend(p)
    if (replaced) p.trash.push(replaced)
    p.wallet += refund - cost
    p.stages[sk].stage = card
    p.hand.splice(a.handIdx, 1)
    p.placedThisPhase.push(card.id)
    p.history.push({ type: 'place', cardId: card.id, replaced, dw: refund - cost })
    events.push({ type: 'placed', player: pid, card, sk, slot: 'stage' })
    recalc(p, pid, events)
    return
  }

  const s = p.stages[a.sk]
  if (!p.unlocked[a.sk]) fail('That stage lane is locked until round 2')
  if (!s.stage) fail('Place a STAGE card first')

  if (card.type === 'defense') {
    if (card.decoy ? s.decoy : s.protected) fail('That stage already has this defense')
    spend(p)
    p.history.push({ type: 'def', sk: a.sk, card, op: s.protected, odecoy: s.decoy })
    if (card.decoy) s.decoy = true
    else s.protected = true
    p.hand.splice(a.handIdx, 1)
    events.push({ type: 'defended', player: pid, card, sk: a.sk, decoy: !!card.decoy })
    return
  }

  let slot: StageSlot | undefined = a.slot
  if (!slot) {
    if (isBonus(card.type)) slot = 'guest'
    else if (card.type === 'hardware') slot = 'hardware'
    else if (card.type === 'artist') slot = ARTIST_SLOTS.find(k => !s[k])
    else if (card.type === 'track') slot = TRACK_SLOTS.find(k => slotExists(s, k) && !s[k])
    if (!slot) fail(card.type === 'artist' ? 'Stage already has 3 artists' : 'No track slot free on this stage')
  }
  if (!slotAccepts(card, slot)) fail(isBonus(card.type) ? 'Bonus cards go in the ⭐ BONUS slot' : `${card.name} doesn't fit that slot`)
  if (!slotExists(s, slot)) fail('This stage has no such slot')
  if (s[slot]) fail(slot === 'guest' ? 'Bonus slot already filled' : 'That slot is occupied')
  if (isBonus(card.type)) {
    const problem = bonusProblem(card, s)
    if (problem) fail(problem)
  }

  spend(p)
  ;(s as unknown as Record<StageSlot, Card | null>)[slot] = card
  p.hand.splice(a.handIdx, 1)
  let dw = 0
  if (card.type === 'sponsor') {
    dw = sponsorIncome(card, p.genre)
    p.wallet += dw
    events.push({ type: 'income', player: pid, amount: dw })
  }
  p.placedThisPhase.push(card.id)
  p.history.push({ type: 'place', cardId: card.id, replaced: null, dw })
  events.push({ type: 'placed', player: pid, card, sk: a.sk, slot })
  recalc(p, pid, events)
}

function attack(state: GameState, pid: PlayerId, a: Extract<Action, { type: 'attack' }>, events: GameEvent[]) {
  const p = state.players[pid]
  const opid = (1 - pid) as PlayerId
  const opp = state.players[opid]
  const card = handCard(p, a.handIdx)
  if (card.type !== 'attack') fail('Not an attack card')
  if (currentPhase(state) !== 'LIVE SHOW') fail('Attacks only in LIVE SHOW phase')
  const t = opp.stages[a.target]
  if (!t.stage) fail(`Opponent has no stage at ${a.target}`)
  spend(p)
  p.hand.splice(a.handIdx, 1); p.trash.push(card)
  p.hasAttacked = true

  const destroyed: { slot: StageSlot; card: Card }[] = []
  let blocked: 'shield' | 'decoy' | null = null
  const kill = (slot: StageSlot | undefined) => {
    if (!slot) return
    const c = t[slot] as Card | null
    if (!c) return
    opp.trash.push(c)
    ;(t as unknown as Record<StageSlot, Card | null>)[slot] = null
    destroyed.push({ slot, card: c })
  }
  const lastTrack = () => [...TRACK_SLOTS].reverse().find(k => t[k])
  if (t.protected) blocked = 'shield'
  else if (t.decoy) { blocked = 'decoy'; t.decoy = false }
  else {
    const effect = card.effect ?? 'hardware'
    if (effect === 'hardware' || effect === 'emp') kill('hardware')
    if (effect === 'track' || effect === 'emp') kill(lastTrack())
    if (effect === 'artist') kill(ARTIST_SLOTS.find(k => t[k]))
    // a bonus that loses its condition goes too (e.g. collab after an artist is poached)
    if (t.guest && isBonus(t.guest.type) && bonusProblem(t.guest, t)) kill('guest')
  }
  events.push({ type: 'attacked', player: pid, card, sk: a.target, blocked, destroyed })
  recalc(opp, opid, events)
}

function findPlaced(p: PlayerState, cardId: number): { sk: StageKey; slot: StageSlot } | null {
  for (const sk of STAGE_KEYS) for (const slot of ALL_SLOTS) {
    if ((p.stages[sk][slot] as Card | null)?.id === cardId) return { sk, slot }
  }
  return null
}

// take a card placed this phase back to hand, refunding action and wallet
function takeBack(state: GameState, p: PlayerState, pid: PlayerId, sk: StageKey, slot: StageSlot, events: GameEvent[]) {
  const s = p.stages[sk]
  const card = s[slot] as Card | null
  if (!card) fail('Nothing there')
  if (!p.placedThisPhase.includes(card.id)) fail('Only cards placed this phase can be picked up')
  const hi = p.history.findIndex(h => h.type === 'place' && h.cardId === card.id)
  const entry = hi >= 0 ? p.history[hi] as Extract<typeof p.history[number], { type: 'place' }> : null
  if (slot === 'stage' && ALL_SLOTS.some(k => k !== 'stage' && s[k]) && !entry?.replaced) {
    fail('Remove the other cards on this stage first')
  }
  const dw = entry?.dw ?? 0
  if (p.wallet - dw < 0) fail('Not enough Hype left to give this sponsor back')
  p.wallet -= dw
  ;(s as unknown as Record<StageSlot, Card | null>)[slot] = null
  if (slot === 'stage' && entry?.replaced) {
    s.stage = entry.replaced
    p.trash = p.trash.filter(c => c.id !== entry.replaced!.id)
  }
  if (slot === 'stage' && !s.stage) { s.protected = false; s.decoy = false }
  p.hand.push(card)
  p.placedThisPhase = p.placedThisPhase.filter(id => id !== card.id)
  if (hi >= 0) p.history.splice(hi, 1)
  p.actionsLeft = Math.min(p.actionsLeft + 1, actionCap(state, p))
  events.push({ type: 'returned', player: pid, card, sk, slot })
  recalc(p, pid, events)
}

function move(p: PlayerState, pid: PlayerId, a: Extract<Action, { type: 'move' }>, events: GameEvent[]) {
  const src = p.stages[a.from.sk]
  const card = src[a.from.slot] as Card | null
  if (!card) fail('Nothing to move')
  if (a.from.slot === 'stage') fail('That card cannot be moved')
  const dest = p.stages[a.to.sk]
  if (!dest.stage) fail('That stage has no scene')
  if (!slotAccepts(card, a.to.slot)) fail('Cards can only move to a matching slot type')
  if (!slotExists(dest, a.to.slot)) fail('This stage has no such slot')
  if (dest[a.to.slot]) fail('That slot is occupied')
  ;(src as unknown as Record<StageSlot, Card | null>)[a.from.slot] = null
  ;(dest as unknown as Record<StageSlot, Card | null>)[a.to.slot] = card
  if (isBonus(card.type)) {
    const problem = bonusProblem(card, dest)
    if (problem) fail(problem)
  }
  events.push({ type: 'moved', player: pid, card, from: a.from.sk, fromSlot: a.from.slot, sk: a.to.sk, slot: a.to.slot })
  recalc(p, pid, events)
}

function undo(state: GameState, p: PlayerState, pid: PlayerId, events: GameEvent[]) {
  const m = p.history[p.history.length - 1]
  if (!m) fail('Nothing to undo')
  if (m.type === 'def') {
    p.history.pop()
    p.stages[m.sk].protected = m.op; p.stages[m.sk].decoy = m.odecoy
    p.hand.push(m.card)
    p.actionsLeft = Math.min(p.actionsLeft + 1, actionCap(state, p))
    events.push({ type: 'returned', player: pid, card: m.card, sk: m.sk, slot: 'defense' })
    return
  }
  const at = findPlaced(p, m.cardId)
  if (!at) fail('That card is no longer on the board')
  takeBack(state, p, pid, at.sk, at.slot, events)
}

function mulligan(state: GameState, pid: PlayerId, events: GameEvent[]) {
  const p = state.players[pid]
  if (state.round !== 1 || state.phaseIdx !== 0) fail('Mulligan only on Round 1, Arrangement phase')
  if (p.mulliganUsed) fail('Mulligan already used')
  const back: Card[] = []
  for (const k of STAGE_KEYS) {
    for (const sl of ALL_SLOTS) { const c = p.stages[k][sl] as Card | null; if (c) back.push(c) }
    p.stages[k] = emptyStage()
  }
  p.deck = shuffleInPlace(state, [...p.deck, ...p.hand, ...back])
  p.hand = []; p.wallet = startingWallet(rulesOf(state), p.genre); p.mustDiscard = 0
  p.actionsLeft = actionCap(state, p); p.placedThisPhase = []; p.history = []
  p.mulliganUsed = true
  events.push({ type: 'mulligan', player: pid })
  draw(state, pid, rulesOf(state).startHand, events)
}

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

// ── Entry point ──────────────────────────────────────────────────────────────

export function applyAction(state: GameState, pid: PlayerId, action: Action): ActionResult {
  const events: GameEvent[] = []
  try {
    const next = produce(state, s => {
      const p = s.players[pid]
      if (s.gameOver) fail('Game over')
      if (p.ready && action.type !== 'ready') fail('Waiting for the other player…')
      if (p.ready) fail('Already ready')
      if (p.mustDiscard > 0 && action.type !== 'discard') fail(`Discard ${p.mustDiscard} card(s) first`)
      if (currentPhase(s) === 'RESULTS' && action.type !== 'ready') fail('Round is over')

      switch (action.type) {
        case 'play': play(s, pid, action, events); break
        case 'attack': attack(s, pid, action, events); break
        case 'discard': {
          const card = handCard(p, action.handIdx)
          p.hand.splice(action.handIdx, 1); p.trash.push(card)
          if (p.mustDiscard > 0) p.mustDiscard -= 1
          events.push({ type: 'discarded', player: pid, card })
          break
        }
        case 'pickup': takeBack(s, p, pid, action.sk, action.slot, events); break
        case 'move': move(p, pid, action, events); break
        case 'undo': undo(s, p, pid, events); break
        case 'mulligan': mulligan(s, pid, events); break
        case 'buyAction': buyAction(s, pid, events); break
        case 'buyDraw': buyDraw(s, pid, events); break
        case 'boost': boost(s, pid, action.sk, events); break
        case 'upgrade': upgrade(s, pid, action.sk, action.kind, events); break
        case 'ready':
          p.ready = true
          events.push({ type: 'ready', player: pid })
          if (s.players.every(x => x.ready)) advancePhase(s, events)
          break
      }
    })
    return { ok: true, state: next, events }
  } catch (e) {
    if (e instanceof RuleError) return { ok: false, error: e.message }
    throw e
  }
}

// What a given player is allowed to see: the opponent's hand and both decks are
// hidden (cards replaced by their count). Use this when sending state to clients.
export function viewFor(state: GameState, pid: PlayerId): GameState {
  return produce(state, s => {
    const opp = s.players[1 - pid]
    const hidden = (n: number) => Array.from({ length: n }, (_, i) => ({ id: -1 - i, type: 'draw', name: '?', desc: '' }) as Card)
    opp.hand = hidden(opp.hand.length)
    opp.deck = hidden(opp.deck.length)
    s.players[pid].deck = hidden(s.players[pid].deck.length)
    opp.history = []
    s.seed = 0
  })
}
