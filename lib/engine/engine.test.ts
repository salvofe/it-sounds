import { describe, expect, it } from 'vitest'
import { produce } from 'immer'
import { TEMPLATES } from '@/lib/data'
import type { Card } from '@/types/game'
import { applyAction, createGame, playBotPhase, viewFor, type Action, type GameState, type PlayerId } from './index'
import { scoreStage, emptyStage } from './rules'
import { RULES } from './config'

const SHOP = RULES.short.shop!
const BUDGET = (RULES.short.actions as { byRound: number[] }).byRound // actions per round, rounds 1-4

const T = (name: string, id: number): Card => {
  const t = TEMPLATES.find(x => x.name === name)
  if (!t) throw new Error(`no template ${name}`)
  return { ...t, id }
}

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

function setHand(s: GameState, pid: PlayerId, cards: Card[], wallet = 0): GameState {
  return produce(s, d => { d.players[pid].hand = cards; d.players[pid].wallet = wallet })
}

function ok(s: GameState, pid: PlayerId, a: Action) {
  const r = applyAction(s, pid, a)
  if (!r.ok) throw new Error(`expected ok, got: ${r.error}`)
  return r
}

function err(s: GameState, pid: PlayerId, a: Action): string {
  const r = applyAction(s, pid, a)
  if (r.ok) throw new Error('expected an error')
  return r.error
}

const readyBoth = (s: GameState) => ok(ok(s, 0, { type: 'ready' }).state, 1, { type: 'ready' }).state

// advance both players to the given phase index with nothing played
function toPhase(s: GameState, idx: number) {
  while (s.phaseIdx !== idx) s = readyBoth(s)
  return s
}

describe('setup', () => {
  it('deals the same deck to both players, deterministically', () => {
    const a = game(), b = game()
    expect(a).toEqual(b)
    for (const p of a.players) {
      expect(p.hand).toHaveLength(10)
      expect(p.deck).toHaveLength(87) // 97-card list
    }
    const names = (p: GameState['players'][number]) => [...p.hand, ...p.deck].map(c => c.name).sort()
    expect(names(a.players[0])).toEqual(names(a.players[1]))
  })

  it('state is plain JSON (safe to send over the network)', () => {
    const s = game()
    expect(JSON.parse(JSON.stringify(s))).toEqual(s)
  })
})

describe('placing cards', () => {
  it('Punk discount applies whichever way the stage is played', () => {
    let s = setHand(game(['Punk', 'Rock']), 0, [T('Medium Stage', 900), T('Medium Stage', 901)], 1)
    s = ok(s, 0, { type: 'play', handIdx: 0, sk: 's1', slot: 'stage' }).state
    expect(s.players[0].wallet).toBe(0) // cost 2 - 1
    s = setHand(game(['Punk', 'Rock']), 0, [T('Medium Stage', 900)], 1)
    s = ok(s, 0, { type: 'play', handIdx: 0, sk: 's1' }).state
    expect(s.players[0].wallet).toBe(0)
  })

  it('Viral Hit needs a 30+ talent artist even when dropped on the slot', () => {
    let s = setHand(game(), 0, [T('Small Stage', 900), T('Synth Wizard', 901), T('Viral Hit', 902)])
    s = ok(s, 0, { type: 'play', handIdx: 0, sk: 's1' }).state
    s = ok(s, 0, { type: 'play', handIdx: 0, sk: 's1' }).state
    expect(err(s, 0, { type: 'play', handIdx: 0, sk: 's1', slot: 'guest' })).toMatch(/30\+ talent/)
  })

  it('hardware never silently overwrites an occupied slot', () => {
    let s = setHand(game(), 0, [T('Small Stage', 900), T('Beat Machine', 901)])
    s = ok(s, 0, { type: 'play', handIdx: 0, sk: 's1' }).state
    s = ok(s, 0, { type: 'play', handIdx: 0, sk: 's1' }).state
    s = readyBoth(s)
    s = setHand(s, 0, [T('Valve Pre-Amp', 902), T('Eurorack Drive', 903)])
    s = ok(s, 0, { type: 'play', handIdx: 0, sk: 's1' }).state
    expect(err(s, 0, { type: 'play', handIdx: 0, sk: 's1' })).toMatch(/occupied/)
  })

  it('cannot use a track slot the stage does not have', () => {
    let s = setHand(game(), 0, [T('Small Stage', 900), T('Beat Machine', 901)])
    s = ok(s, 0, { type: 'play', handIdx: 0, sk: 's1' }).state
    s = ok(s, 0, { type: 'play', handIdx: 0, sk: 's1' }).state
    s = readyBoth(s)
    s = setHand(s, 0, [T('Data Stream', 902)])
    expect(err(s, 0, { type: 'play', handIdx: 0, sk: 's1', slot: 'track2' })).toMatch(/no such slot/)
  })
})

describe('pickup and undo', () => {
  it('picking up refunds exactly the action that was spent, no free actions', () => {
    let s = setHand(game(), 0, [T('Small Stage', 900)])
    s = ok(s, 0, { type: 'play', handIdx: 0, sk: 's1' }).state
    expect(s.players[0].actionsLeft).toBe(2)
    s = ok(s, 0, { type: 'pickup', sk: 's1', slot: 'stage' }).state
    expect(s.players[0].actionsLeft).toBe(3)
    expect(s.players[0].hand.map(c => c.id)).toEqual([900])
  })

  it('cards from an earlier phase cannot be picked up', () => {
    let s = setHand(game(), 0, [T('Small Stage', 900)])
    s = ok(s, 0, { type: 'play', handIdx: 0, sk: 's1' }).state
    s = readyBoth(s)
    expect(err(s, 0, { type: 'pickup', sk: 's1', slot: 'stage' })).toMatch(/this phase/)
  })

  it('undo of a sponsor gives the Hype back', () => {
    let s = setHand(game(['Hip-Hop', 'Rock']), 0, [T('Small Stage', 900), T('Brand Deal', 901)])
    s = ok(s, 0, { type: 'play', handIdx: 0, sk: 's1' }).state
    s = ok(s, 0, { type: 'play', handIdx: 0, sk: 's1' }).state
    expect(s.players[0].wallet).toBe(2.5)
    s = ok(s, 0, { type: 'undo' }).state
    expect(s.players[0].wallet).toBe(0)
    expect(s.players[0].stages.s1.guest).toBeNull()
  })

  it('mulligan only once', () => {
    let s = ok(game(), 0, { type: 'mulligan' }).state
    expect(s.players[0].hand).toHaveLength(10)
    expect(err(s, 0, { type: 'mulligan' })).toMatch(/already/)
  })
})

describe('attacks', () => {
  function boardWithHardware(defense?: string) {
    let s = setHand(game(), 1, [T('Small Stage', 800), T('Beat Machine', 801)])
    s = ok(s, 1, { type: 'play', handIdx: 0, sk: 's1' }).state
    s = ok(s, 1, { type: 'play', handIdx: 0, sk: 's1' }).state
    s = readyBoth(s)
    s = setHand(s, 1, [T('Valve Pre-Amp', 802), T('Data Stream', 803), ...(defense ? [T(defense, 804)] : [])])
    s = ok(s, 1, { type: 'play', handIdx: 0, sk: 's1' }).state
    s = ok(s, 1, { type: 'play', handIdx: 0, sk: 's1' }).state
    if (defense) s = ok(s, 1, { type: 'play', handIdx: 0, sk: 's1' }).state
    s = readyBoth(s)
    return setHand(s, 0, [T('Malware Worm', 900), T('Malware Worm', 901)])
  }

  it('Malware Worm destroys hardware', () => {
    const r = ok(boardWithHardware(), 0, { type: 'attack', handIdx: 0, target: 's1' })
    expect(r.state.players[1].stages.s1.hardware).toBeNull()
    expect(r.events).toContainEqual(expect.objectContaining({ type: 'attacked', blocked: null }))
  })

  it('Decoy Booth absorbs exactly one attack', () => {
    let s = boardWithHardware('Decoy Booth')
    let r = ok(s, 0, { type: 'attack', handIdx: 0, target: 's1' })
    expect(r.events).toContainEqual(expect.objectContaining({ type: 'attacked', blocked: 'decoy' }))
    expect(r.state.players[1].stages.s1.hardware).not.toBeNull()
    r = ok(r.state, 0, { type: 'attack', handIdx: 0, target: 's1' })
    expect(r.state.players[1].stages.s1.hardware).toBeNull()
  })

  it('Firewall blocks every attack', () => {
    let s = boardWithHardware('Firewall Shield')
    s = ok(s, 0, { type: 'attack', handIdx: 0, target: 's1' }).state
    s = ok(s, 0, { type: 'attack', handIdx: 0, target: 's1' }).state
    expect(s.players[1].stages.s1.hardware).not.toBeNull()
  })
})

describe('flow', () => {
  it('phase advances only when both players are ready', () => {
    let s = ok(game(), 0, { type: 'ready' }).state
    expect(s.phaseIdx).toBe(0)
    expect(err(s, 0, { type: 'mulligan' })).toMatch(/Waiting/)
    s = ok(s, 1, { type: 'ready' }).state
    expect(s.phaseIdx).toBe(1)
  })

  it('both boards are cleared at the end of a round', () => {
    let s = setHand(game(), 1, [T('Small Stage', 800)])
    s = ok(s, 1, { type: 'play', handIdx: 0, sk: 's1' }).state
    s = toPhase(s, 3)
    s = readyBoth(s)
    expect(s.round).toBe(2)
    expect(s.players[1].stages.s1.stage).toBeNull()
    expect(s.players[1].unlocked.s3).toBe(true)
  })

  it('an empty deck is refilled from the trash', () => {
    let s = produce(game(), d => {
      d.players[0].trash = d.players[0].deck.splice(0, 75)
      d.players[0].deck = d.players[0].deck.slice(0, 2)
    })
    s = toPhase(s, 3)
    const r = ok(ok(s, 0, { type: 'ready' }).state, 1, { type: 'ready' })
    expect(r.events).toContainEqual(expect.objectContaining({ type: 'reshuffled', player: 0 }))
    expect(r.state.players[0].hand).toHaveLength(17)
  })

  it('viewFor hides the opponent hand and decks', () => {
    const v = viewFor(game(), 0)
    expect(v.players[1].hand.every(c => c.name === '?')).toBe(true)
    expect(v.players[0].hand.every(c => c.name !== '?')).toBe(true)
    expect(v.players[0].deck.every(c => c.name === '?')).toBe(true)
  })
})

describe('bot', () => {
  it('two bots finish a full game without illegal moves', () => {
    // games currently run long (often 20-100 rounds): 3 actions per phase
    // only builds about one stage a round. That's a balance issue, not an engine one.
    for (const seed of [1, 3]) {
      let s = game(['Rock', 'Jazz'], seed)
      for (let i = 0; i < 1000 && !s.gameOver; i++) {
        for (const pid of [0, 1] as PlayerId[]) if (!s.gameOver && !s.players[pid].ready) s = playBotPhase(s, pid).state
      }
      expect(s.gameOver).toBe(true)
      expect(s.winner).not.toBeNull()
    }
  }, 60_000)

  it('the bot actually builds and scores stages', () => {
    let s = game(['Rock', 'Industrial'], 7)
    s = playBotPhase(s, 1).state
    expect(s.players[1].stages.s1.stage).not.toBeNull()
    expect(s.players[1].stages.s1.artist1).not.toBeNull()
  })
})

describe('modes', () => {
  it('createGame defaults to short mode with its own starting setup', () => {
    const s = shortGame()
    expect(s.mode).toBe('short')
    expect(s.roundWins).toEqual([0, 0])
    expect(s.totalFans).toEqual([0, 0])
    expect(s.lastRoundWinner).toBeNull()
    expect(s.players[0].wallet).toBe(3)
    expect(s.players[0].actionsLeft).toBe(BUDGET[0])
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
    expect(s.players[0].actionsLeft).toBe(BUDGET[0] - 1)
    s = readyBoth(s)
    expect(s.phaseIdx).toBe(1)
    expect(s.players[0].actionsLeft).toBe(BUDGET[0] - 1)
  })

  it('budget grows by round and unspent actions are lost', () => {
    let s = shortGame()
    const seen: number[] = []
    for (let r = 1; r <= 4; r++) { seen.push(s.players[0].actionsLeft); s = toPhase(s, 3); s = readyBoth(s) }
    expect(seen).toEqual(BUDGET)
  })

  it('picking a card back up never goes above the budget', () => {
    let s = hand(shortGame(), 0, [T('Small Stage', 900)])
    s = ok(s, 0, { type: 'play', handIdx: 0, sk: 's1' }).state
    s = ok(s, 0, { type: 'pickup', sk: 's1', slot: 'stage' }).state
    expect(s.players[0].actionsLeft).toBe(BUDGET[0])
  })

  it('mulligan keeps the short-mode starting Hype and budget', () => {
    let s = hand(shortGame(['Hip-Hop', 'Jazz']), 0, [T('Small Stage', 900)])
    s = ok(s, 0, { type: 'play', handIdx: 0, sk: 's1' }).state
    s = ok(s, 0, { type: 'mulligan' }).state
    expect(s.players[0].wallet).toBe(3.5)
    expect(s.players[0].actionsLeft).toBe(BUDGET[0])
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

  it('a boosted stage whose artists are all gone scores nothing', () => {
    expect(scoreStage({ ...base(), artist1: null, track: null, boost: 2 }, 'Classical', 1).current).toBe(0)
    expect(scoreStage({ ...base(), artist1: null, boost: 2 }, 'Classical', 1).current).toBe(0)
  })

  it('classic stages (all fields zero) score as before', () => {
    expect(scoreStage(base(), 'Classical', 1).current).toBe(1.3)
  })
})

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
    expect(s.players[0].actionsLeft).toBe(BUDGET[0] + 1)
    s = rich(s)
    s = ok(s, 0, { type: 'buyAction' }).state
    expect(err(s, 0, { type: 'buyAction' })).toMatch(/Max 2/)
  })

  it('mulligan after buyAction restores the starting wallet and budget', () => {
    let s = ok(shortGame(), 0, { type: 'buyAction' }).state
    s = ok(s, 0, { type: 'mulligan' }).state
    expect(s.players[0].wallet).toBe(3)
    expect(s.players[0].actionsLeft).toBe(BUDGET[0])
    expect(s.players[0].extraActionsBought).toBe(0)
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
    expect(s.players[0].actionsLeft).toBe(BUDGET[0] + 1)
  })

  it('buyDraw: costs Hype + 1 action for 2 cards', () => {
    const s0 = shortGame()
    const s = ok(s0, 0, { type: 'buyDraw' }).state
    expect(s.players[0].hand).toHaveLength(s0.players[0].hand.length + 2)
    expect(s.players[0].wallet).toBe(3 - SHOP.draw.cost)
    expect(s.players[0].actionsLeft).toBe(BUDGET[0] - 1)
  })

  it('boost: only in Live Show, needs an artist, +1k per boost, max +3k per stage', () => {
    let s = rich(stageWithArtist(shortGame()))
    expect(err(s, 0, { type: 'boost', sk: 's1' })).toMatch(/Live Show/)
    s = toPhase(s, 2)
    expect(err(s, 0, { type: 'boost', sk: 's2' })).toMatch(/artist/)
    for (let i = 0; i < 3; i++) s = ok(s, 0, { type: 'boost', sk: 's1' }).state
    expect(s.players[0].stages.s1.boost).toBe(3)
    expect(s.players[0].stages.s1.current).toBe(3)
    expect(s.players[0].wallet).toBe(20 - 3 * SHOP.boost.cost)
    expect(err(s, 0, { type: 'boost', sk: 's1' })).toMatch(/\+3k/)
  })

  it('upgrade: once per stage per round, not in Arrangement, threshold floor 0.5', () => {
    let s = rich(stageWithArtist(shortGame()))
    expect(err(s, 0, { type: 'upgrade', sk: 's1', kind: 'threshold' })).toMatch(/Soundcheck or Live Show/)
    s = toPhase(s, 1)
    s = ok(s, 0, { type: 'upgrade', sk: 's1', kind: 'threshold' }).state
    expect(s.players[0].stages.s1.threshold).toBe(0.5) // 1.5 - 1, and never below 0.5
    expect(s.players[0].wallet).toBe(20 - SHOP.upgrade.cost)
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

describe('bot boost decisions', () => {
  // Classical gives no genre bonus, so scores are plain.
  // Small Stage (threshold 1.5) + Beat Machine (0.3 talent) + Data Stream (1.0 track) = 1.3: below threshold, scores 0.
  // One +1k boost makes it 2.3 and passes.
  const live = () => {
    let s = toPhase(shortGame(['Classical', 'Classical']), 2)
    expect(s.phaseIdx).toBe(2)
    s = produce(s, d => { d.players[0].wallet = 20; d.players[1].wallet = 20 })
    return s
  }
  const putStage = (s: GameState, pid: PlayerId, extra: object = {}) =>
    produce(s, d => {
      const p = d.players[pid]
      p.stages.s1 = scoreStage({ ...emptyStage(), stage: T('Small Stage', 10 + pid), artist1: T('Beat Machine', 20 + pid), track: T('Data Stream', 30 + pid), ...extra }, p.genre, 1)
    })

  it('boosts when one boost puts its round score ahead', () => {
    // upgraded: true so the cheaper threshold upgrade is not available; boost is the only way to pass
    let s = putStage(putStage(live(), 0, { upgraded: true }), 1) // both 1.3, both fail: 0 vs 0
    s = hand(s, 0, [])
    expect(s.players[0].stages.s1.current).toBe(1.3)
    const r = playBotPhase(s, 0)
    expect(r.actions.some(a => a.type === 'boost')).toBe(true)
  })

  it('does not boost a round it cannot win', () => {
    // opponent: 1.3 x 2 (Valve Pre-Amp) + 3 boost = 5.6, above the bot's best of 1.3 + 3 = 4.3
    let s = putStage(putStage(live(), 0, { upgraded: true }), 1, { hardware: T('Valve Pre-Amp', 40), boost: 3 })
    s = hand(s, 0, [])
    expect(s.players[1].stages.s1.current).toBe(5.6)
    const r = playBotPhase(s, 0)
    expect(r.actions.some(a => a.type === 'boost')).toBe(false)
  })

  it('does not chase a deficit of 4.6k that one stage with max +3k cannot close', () => {
    // opponent: 1.3 x 2 + 2 boost = 4.6; bot's best is 1.3 + 3 = 4.3 (< 4.6), a boost would only close part of the gap
    let s = putStage(putStage(live(), 0, { upgraded: true }), 1, { hardware: T('Valve Pre-Amp', 40), boost: 2 })
    s = hand(s, 0, [])
    expect(s.players[1].stages.s1.current).toBe(4.6)
    expect(playBotPhase(s, 0).actions.some(a => a.type === 'boost')).toBe(false)
  })
})

describe('events', () => {
  it('events stay readable after the action (no revoked draft proxies)', () => {
    let s = setHand(game(), 1, [T('Small Stage', 800), T('Beat Machine', 801)])
    let r = ok(s, 1, { type: 'play', handIdx: 0, sk: 's1' })
    const placed = r.events.find(e => e.type === 'placed')
    expect(placed && placed.type === 'placed' && placed.card.name).toBe('Small Stage')
    r = ok(r.state, 1, { type: 'pickup', sk: 's1', slot: 'stage' })
    const ret = r.events.find(e => e.type === 'returned')
    expect(ret && ret.type === 'returned' && ret.card.name).toBe('Small Stage')
    expect(() => JSON.stringify(r.events)).not.toThrow()

    s = setHand(game(), 1, [T('Small Stage', 810), T('Beat Machine', 811)])
    s = ok(s, 1, { type: 'play', handIdx: 0, sk: 's1' }).state
    s = ok(s, 1, { type: 'play', handIdx: 0, sk: 's1' }).state
    s = readyBoth(s)
    s = setHand(s, 1, [T('Valve Pre-Amp', 812)])
    s = ok(s, 1, { type: 'play', handIdx: 0, sk: 's1' }).state
    s = readyBoth(s)
    s = setHand(s, 0, [T('Malware Worm', 900)])
    const a = ok(s, 0, { type: 'attack', handIdx: 0, target: 's1' })
    const ev = a.events.find(e => e.type === 'attacked')
    if (!ev || ev.type !== 'attacked') throw new Error('no attacked event')
    expect(ev.card.name).toBe('Malware Worm')
    expect(ev.destroyed.length).toBeGreaterThan(0)
    for (const d of ev.destroyed) expect(typeof d.card.name).toBe('string')
    expect(() => JSON.stringify(a.events)).not.toThrow()
  })
})
