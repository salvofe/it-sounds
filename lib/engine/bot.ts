import { isPhaseOk } from '@/lib/data'
import { RULES } from './config'
import { applyAction, artists, currentPhase, roundScore, tracks, STAGE_KEYS } from './rules'
import type { Action, GameEvent, GameState, PlayerId, PlayerState } from './types'

// Greedy bot: it plays through the same applyAction as a human, so it can't
// cheat. Each step it tries every legal action and keeps the one that improves
// its position the most, until nothing helps or it runs out of actions.

function potential(p: PlayerState): number {
  let v = p.wallet * 0.25 + p.hand.length * 0.2
  for (const k of STAGE_KEYS) {
    const s = p.stages[k]
    if (!s.stage) continue
    const filled = artists(s).length + tracks(s).length > 0
    v += 1.5 + (s.stage.threshold ?? 0) * 0.15
    v += artists(s).reduce((a, x) => a + (x.talent ?? 0) / 12, 0)
    v += tracks(s).reduce((a, t) => a + (t.power ?? 0) * 1.2, 0)
    if (s.hardware) v += ((s.hardware.multiplier ?? 1) - 1) * 1.5
    if (s.guest) v += 1.5
    // score and threshold check without Hype boost: a boost is valued only through the round-win term in evaluate
    const base = s.current - s.boost
    v += base
    if (s.threshold > 0 && base >= s.threshold) v += base + 3
    if (filled && s.protected) v += 1.5
    if (filled && s.decoy) v += 1
  }
  return v
}

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

export function candidateActions(state: GameState, pid: PlayerId): Action[] {
  const p = state.players[pid]
  const opp = state.players[1 - pid]
  if (p.mustDiscard > 0) return p.hand.map((_, i) => ({ type: 'discard', handIdx: i }) as Action)
  const phase = currentPhase(state)
  const out: Action[] = []
  p.hand.forEach((c, i) => {
    if (!isPhaseOk(c.type, phase)) return
    if (c.type === 'attack') {
      for (const k of STAGE_KEYS) if (opp.stages[k].stage) out.push({ type: 'attack', handIdx: i, target: k })
    } else if (c.type === 'draw') {
      out.push({ type: 'play', handIdx: i, sk: 's1' })
    } else {
      for (const k of STAGE_KEYS) if (p.unlocked[k]) out.push({ type: 'play', handIdx: i, sk: k, ...(c.type === 'stage' ? { slot: 'stage' as const } : {}) })
    }
  })
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
  return out
}

export function playBotPhase(state: GameState, pid: PlayerId): { state: GameState; events: GameEvent[]; actions: Action[] } {
  const events: GameEvent[] = []
  const actions: Action[] = []
  for (let step = 0; step < 40; step++) {
    const base = evaluate(state, pid)
    let best: { a: Action; s: GameState; ev: GameEvent[]; d: number } | null = null
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
    // a forced discard must happen even if every option looks bad
    const forced = state.players[pid].mustDiscard > 0
    if (!best || (!forced && best.d <= 0.05)) break
    state = best.s; events.push(...best.ev); actions.push(best.a)
  }
  const r = applyAction(state, pid, { type: 'ready' })
  if (r.ok) { state = r.state; events.push(...r.events); actions.push({ type: 'ready' }) }
  return { state, events, actions }
}
