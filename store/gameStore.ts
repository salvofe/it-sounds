import { create } from 'zustand'
import type { Card, StageState, StageKey, StageSlot, Phase, MoveMode, CardToastData, ComboRevealData } from '@/types/game'
import { PHASES, isPhaseOk } from '@/lib/data'
import {
  applyAction, createGame, playBotPhase, actionCap, rulesOf,
  type Action, type GameEvent, type GameState as EngineState, type PlayerId, type Mode, type ShopRules,
} from '@/lib/engine'
import { Sound } from '@/lib/sound'

// The rules live in lib/engine (pure, symmetric, server-ready). This store only
// holds the engine state, exposes it under the names the components read, and
// turns engine events into log lines, sounds and overlays.

const ME: PlayerId = 0
const BOT: PlayerId = 1

function emptyStageState(): StageState {
  return {
    stage: null, artist1: null, artist2: null, artist3: null,
    hardware: null, track: null, track2: null, track3: null, guest: null,
    current: 0, threshold: 0, bonus: 0, protected: false, decoy: false, combos: [],
    boost: 0, thresholdCut: 0, multBonus: 0, upgraded: false,
  }
}

function emptyStages(): Record<StageKey, StageState> {
  return { s1: emptyStageState(), s2: emptyStageState(), s3: emptyStageState() }
}

export interface PreviewAnchor { left: number; top: number; width: number; height: number }

// ── State & Actions types ─────────────────────────────────────────────────────

export interface GameState {
  game: EngineState | null
  // projected from the engine (read-only for components)
  isStarted: boolean
  playerGenre: string; playerSubGenre: string; aiGenre: string
  round: number; phaseIdx: number
  playerDeck: Card[]; playerHand: Card[]; playerTrash: Card[]
  playerStages: Record<StageKey, StageState>
  playerWallet: number; playerBestRound: number
  aiDeck: Card[]; aiHand: Card[]; aiTrash: Card[]
  aiStages: Record<StageKey, StageState>
  aiWallet: number; aiBestRound: number
  unlockedStages: Record<StageKey, boolean>
  mustDiscard: number; actionsLeft: number; maxActions: number
  mulliganUsed: boolean; gameOver: boolean
  mode: Mode
  roundWins: [number, number]
  lastRoundWinner: PlayerId | 'draw' | null
  winner: PlayerId | 'draw' | null
  playerRoundScore: number; aiRoundScore: number
  extraActionsBought: number
  shop: ShopRules | null
  // UI only
  selectedCard: number | null; targetMode: boolean
  focusedStage: StageKey
  moveMode: MoveMode | null
  discovered: Record<string, boolean>
  commentary: string; logEntries: string[]
  showResults: boolean; showSetup: boolean
  showTutorial: boolean; tutStep: number
  showPhaseTransition: boolean; phaseTransitionName: string
  cardToast: CardToastData | null; comboReveal: ComboRevealData | null
  soundMuted: boolean
  previewCard: { card: Card; owner: 'me' | 'ai'; anchor: PreviewAnchor } | null
}

export interface GameActions {
  startGame(playerGenre: string, playerSubGenre: string, aiGenre: string, mode: Mode): void
  restartGame(): void
  showTut(): void; tutNav(dir: 1 | -1): void
  nextPhase(): void
  buyAction(): void; buyDraw(): void
  boost(sk: StageKey): void; upgrade(sk: StageKey, kind: 'threshold' | 'mult'): void
  selectCard(idx: number): void
  slotClick(sk: StageKey, sl: StageSlot): void
  pickup(sk: StageKey, sl: StageSlot): void
  aiClick(sk: StageKey): void; cancelTarget(): void
  trashCard(idx: number): void
  startMove(sk: StageKey, sl: StageSlot): void
  tryMoveDrop(sk: StageKey, sl: StageSlot): boolean
  undo(): void; mulligan(): void; closeResults(): void
  setFocus(sk: StageKey): void; toggleSound(): void
  addLog(msg: string): void; setCommentary(txt: string): void
  setPreview(p: GameState['previewCard']): void
  dismissCardToast(): void; dismissComboReveal(): void
}

// ── Initial state ─────────────────────────────────────────────────────────────

const INITIAL: GameState = {
  game: null,
  previewCard: null,
  isStarted: false, playerGenre: 'Synthwave', playerSubGenre: 'Darksynth', aiGenre: 'Industrial',
  round: 1, phaseIdx: 0,
  playerDeck: [], playerHand: [], playerTrash: [], playerStages: emptyStages(),
  playerWallet: 0, playerBestRound: 0,
  aiDeck: [], aiHand: [], aiTrash: [], aiStages: emptyStages(),
  aiWallet: 0, aiBestRound: 0,
  unlockedStages: { s1: true, s2: false, s3: false },
  mustDiscard: 0, actionsLeft: 3, maxActions: 3,
  mulliganUsed: false, gameOver: false,
  mode: 'short', roundWins: [0, 0], lastRoundWinner: null, winner: null, playerRoundScore: 0, aiRoundScore: 0, extraActionsBought: 0, shop: null,
  selectedCard: null, targetMode: false, focusedStage: 's1',
  moveMode: null, discovered: {},
  commentary: '"Systems online. 77-node register locked."', logEntries: [],
  showResults: false, showSetup: false, showTutorial: true, tutStep: 1,
  showPhaseTransition: false, phaseTransitionName: '',
  cardToast: null, comboReveal: null,
  soundMuted: false,
}

function project(g: EngineState): Partial<GameState> {
  const me = g.players[ME], ai = g.players[BOT]
  return {
    game: g, isStarted: true,
    playerGenre: me.genre, playerSubGenre: me.subGenre, aiGenre: ai.genre,
    round: g.round, phaseIdx: g.phaseIdx,
    playerDeck: me.deck, playerHand: me.hand, playerTrash: me.trash, playerStages: me.stages,
    playerWallet: me.wallet, playerBestRound: me.bestRound,
    aiDeck: ai.deck, aiHand: ai.hand, aiTrash: ai.trash, aiStages: ai.stages,
    aiWallet: ai.wallet, aiBestRound: ai.bestRound,
    unlockedStages: me.unlocked,
    mustDiscard: me.mustDiscard, actionsLeft: me.actionsLeft, maxActions: actionCap(g, me),
    mulliganUsed: me.mulliganUsed, gameOver: g.gameOver,
    mode: g.mode, roundWins: g.roundWins, lastRoundWinner: g.lastRoundWinner, winner: g.winner,
    playerRoundScore: me.lastRoundScore, aiRoundScore: ai.lastRoundScore,
    extraActionsBought: me.extraActionsBought, shop: rulesOf(g).shop,
  }
}

const label = (sk: StageKey) => sk.toUpperCase()

// ── Store ─────────────────────────────────────────────────────────────────────

export const useGameStore = create<GameState & GameActions>()((set, get) => {

  function log(msg: string) {
    set(s => ({ logEntries: [...s.logEntries.slice(-99), msg] }))
  }

  function toast(name: string, dest: string) {
    set({ cardToast: { name, dest } })
    setTimeout(() => set({ cardToast: null }), 1400)
  }

  function phaseTransition(name: string) {
    set({ showPhaseTransition: true, phaseTransitionName: name })
    setTimeout(() => set({ showPhaseTransition: false }), 1200)
    Sound.phase(name)
  }

  // ── engine events → log / sound / overlays ─────────────────────────────────

  function handle(ev: GameEvent) {
    const mine = 'player' in ev && ev.player === ME
    switch (ev.type) {
      case 'placed':
        if (mine) {
          Sound.place(); toast(ev.card.name, ev.slot === 'guest' ? `Bonus on ${label(ev.sk)}` : `${label(ev.sk)} [${ev.slot}]`)
          if (ev.slot === 'stage') { set({ focusedStage: ev.sk }); log(`🎪 ${ev.card.name} → ${label(ev.sk)} (needs ${ev.card.threshold}k fans)`) }
          else log(`▶ ${ev.card.name} → ${label(ev.sk)} [${ev.slot}]`)
        }
        break
      case 'returned':
        if (mine) log(`↩ ${ev.card.name} returned to hand`)
        break
      case 'moved':
        if (mine) { Sound.click(); log(`↔ Moved ${ev.card.name} → ${label(ev.sk)} [${ev.slot}] (free)`) }
        break
      case 'defended':
        if (mine) { toast(ev.card.name, `Defense on ${label(ev.sk)}`); log(ev.decoy ? `🕵 Decoy Booth on ${label(ev.sk)}` : `🛡 Firewall raised on ${label(ev.sk)}`) }
        else log(`🛡 AI ${ev.decoy ? 'set a decoy on' : 'shielded'} its ${label(ev.sk)}`)
        break
      case 'attacked': {
        Sound.attack()
        const who = mine ? 'Your' : 'AI'
        const whose = mine ? 'AI' : 'your'
        if (ev.blocked === 'shield') log(mine ? `🛡 AI firewall on ${label(ev.sk)} blocked your ${ev.card.name}!` : `🛡 Your firewall on ${label(ev.sk)} blocked the AI's ${ev.card.name}!`)
        else if (ev.blocked === 'decoy') log(`🕵 ${who} ${ev.card.name} hit a decoy on ${label(ev.sk)} — decoy broken`)
        else if (!ev.destroyed.length) log(`💨 ${who} ${ev.card.name} hit ${label(ev.sk)} but found nothing to destroy`)
        else log(`💥 ${who} ${ev.card.name} destroyed ${ev.destroyed.map(d => d.card.name).join(' + ')} on ${whose} ${label(ev.sk)}!`)
        break
      }
      case 'drew':
        if (mine && get().isStarted) log(`📼 Drew ${ev.cards.length} card${ev.cards.length === 1 ? '' : 's'}`)
        break
      case 'discarded':
        if (mine) log(`🗑 Discarded ${ev.card.name}`)
        break
      case 'reshuffled':
        if (mine) log(`🔀 Deck empty — trash reshuffled (${ev.count} cards)`)
        break
      case 'combo':
        if (mine && !get().discovered[ev.combo.id]) {
          set(s => ({ discovered: { ...s.discovered, [ev.combo.id]: true }, comboReveal: { combo: ev.combo, isNew: true } }))
          Sound.combo()
        } else if (!mine) log(`⚡ AI combo on ${label(ev.sk)}: ${ev.combo.name}`)
        break
      case 'income':
        if (mine && get().phaseIdx === 0 && get().isStarted) log(`💰 +${ev.amount.toFixed(1)}k Hype`)
        break
      case 'phase':
        set({ selectedCard: null, targetMode: false, moveMode: null })
        phaseTransition(ev.phase)
        log(ev.phase === 'ARRANGEMENT' ? `▶ Round ${ev.round} — ARRANGEMENT` : `▶ ${ev.phase}`)
        break
      case 'results': {
        const [pt, at] = ev.scores
        set({ showResults: true })
        log(`📊 Results — You: ${pt.toFixed(1)}k | AI: ${at.toFixed(1)}k`)
        if (ev.gameOver) { if (ev.winner === ME) Sound.win(); else if (ev.winner === 'draw') Sound.phase('RESULTS'); else Sound.lose() }
        break
      }
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
      case 'mulligan':
        if (mine) log('🔀 Mulligan! Hand reshuffled.')
        break
    }
  }

  function commit(g: EngineState, events: GameEvent[]) {
    set({ ...project(g), previewCard: null })
    for (const ev of events) handle(ev)
  }

  function dispatch(action: Action): boolean {
    const g = get().game
    if (!g) return false
    const r = applyAction(g, ME, action)
    if (!r.ok) { log(`✖ ${r.error}`); return false }
    commit(r.state, r.events)
    return true
  }

  async function aiCommentary(ctx: string) {
    const { playerStages, aiStages } = get()
    const board = (st: Record<StageKey, StageState>) => (['s1', 's2', 's3'] as StageKey[])
      .map(k => `${k}:${st[k].current.toFixed(1)}k${st[k].protected ? ' shielded' : ''}`).join(', ')
    try {
      const res = await fetch('/api/commentary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ctx, playerBoard: board(playerStages), aiBoard: board(aiStages) }),
      })
      const data = await res.json() as { text?: string }
      set({ commentary: `"${data.text ?? 'Analyzing frequencies...'}"` })
    } catch {
      set({ commentary: '"My algorithms are running hot. Your crowd is already mine."' })
    }
  }

  // ── Public store ───────────────────────────────────────────────────────────

  return {
    ...INITIAL,

    showTut() { set({ showTutorial: true, tutStep: 1 }) },

    tutNav(dir) {
      if (get().tutStep === 4 && dir === 1) { set({ showTutorial: false, showSetup: true }); return }
      set(s => ({ tutStep: Math.max(1, Math.min(4, s.tutStep + dir)) }))
    },

    startGame(playerGenre, playerSubGenre, aiGenre, mode) {
      Sound.unlock()
      const { state } = createGame([
        { name: 'YOU', genre: playerGenre, subGenre: playerSubGenre },
        { name: 'AI', genre: aiGenre },
      ], Date.now(), mode)
      set({ ...INITIAL, discovered: get().discovered, soundMuted: get().soundMuted, showSetup: false, showTutorial: false, logEntries: [] })
      set(project(state))
      log('▶ Game started! Arrangement phase — place your Stages first.')
    },

    restartGame() { set({ ...INITIAL, discovered: get().discovered, soundMuted: get().soundMuted, showSetup: true, showTutorial: false }) },

    nextPhase() {
      const g = get().game
      if (!g || g.gameOver) return
      const phase = PHASES[g.phaseIdx]
      const r = applyAction(g, ME, { type: 'ready' })
      if (!r.ok) { log(`✖ ${r.error}`); return }
      let state = r.state
      const events = [...r.events]
      if (!state.players[BOT].ready && state.phaseIdx === g.phaseIdx) {
        const bot = playBotPhase(state, BOT)
        state = bot.state; events.push(...bot.events)
        const acted = bot.actions.some(a => a.type !== 'ready')
        if (acted && phase !== 'RESULTS') aiCommentary(phase === 'ARRANGEMENT' ? 'arrangement' : phase === 'SOUNDCHECK' ? 'soundcheck' : 'attack')
      }
      commit(state, events)
    },

    buyAction() { dispatch({ type: 'buyAction' }) },
    buyDraw() { dispatch({ type: 'buyDraw' }) },
    boost(sk) { dispatch({ type: 'boost', sk }) },
    upgrade(sk, kind) { dispatch({ type: 'upgrade', sk, kind }) },

    selectCard(idx) {
      const { playerHand, phaseIdx, mustDiscard, focusedStage } = get()
      const card = playerHand[idx]
      if (!card) return
      if (mustDiscard > 0) { dispatch({ type: 'discard', handIdx: idx }); return }
      const phase = PHASES[phaseIdx] as Phase
      if (!isPhaseOk(card.type, phase)) { log(`✖ ${card.name} can't be played in ${phase} phase`); return }
      Sound.card(card.type)
      if (card.type === 'attack') {
        if (get().actionsLeft <= 0) { log('✖ No actions left!'); return }
        set({ selectedCard: idx, targetMode: true })
        log('🎯 ATTACK MODE: click an AI stage to target it'); return
      }
      dispatch({ type: 'play', handIdx: idx, sk: focusedStage })
      set({ selectedCard: null })
    },

    slotClick(sk, sl) {
      const { moveMode, selectedCard, targetMode } = get()
      if (moveMode) { get().tryMoveDrop(sk, sl); return }
      if (selectedCard === null || targetMode) return
      if (dispatch({ type: 'play', handIdx: selectedCard, sk, slot: sl })) set({ selectedCard: null })
    },

    pickup(sk, sl) { dispatch({ type: 'pickup', sk, slot: sl }) },

    aiClick(sk) {
      const { targetMode, selectedCard } = get()
      if (!targetMode || selectedCard === null) return
      dispatch({ type: 'attack', handIdx: selectedCard, target: sk })
      set({ targetMode: false, selectedCard: null })
    },

    cancelTarget() { set({ targetMode: false, selectedCard: null }) },

    setPreview(p) { set({ previewCard: p }) },

    trashCard(idx) { dispatch({ type: 'discard', handIdx: idx }) },

    startMove(sk, sl) {
      const card = get().playerStages[sk][sl] as Card | null
      if (!card || sl === 'stage') { log('✖ That card cannot be moved'); return }
      set({ moveMode: { sk, sl, card } })
      log(`↔ Moving ${card.name} — click an empty matching slot (free)`)
    },

    tryMoveDrop(sk, sl) {
      const { moveMode } = get()
      if (!moveMode) return false
      set({ moveMode: null })
      if (moveMode.sk === sk && moveMode.sl === sl) { log('Move cancelled'); return true }
      dispatch({ type: 'move', from: { sk: moveMode.sk, slot: moveMode.sl }, to: { sk, slot: sl } })
      return true
    },

    undo() { dispatch({ type: 'undo' }) },
    mulligan() { dispatch({ type: 'mulligan' }) },

    closeResults() {
      set({ showResults: false })
      if (!get().gameOver) get().nextPhase()
    },

    setFocus(sk) {
      if (!get().unlockedStages[sk]) return
      set({ focusedStage: sk }); log(`🎯 Stage ${sk} focused`)
    },

    toggleSound() { set({ soundMuted: Sound.toggle() }) },

    addLog: log,
    setCommentary(txt) { set({ commentary: txt }) },
    dismissCardToast() { set({ cardToast: null }) },
    dismissComboReveal() { set({ comboReveal: null }) },
  }
})
