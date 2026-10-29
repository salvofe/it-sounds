import { describe, expect, it } from 'vitest'
import { produce } from 'immer'
import { TEMPLATES } from '@/lib/data'
import type { Card } from '@/types/game'
import { applyAction, createGame, playBotPhase, viewFor, type Action, type GameState, type PlayerId } from './index'

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
