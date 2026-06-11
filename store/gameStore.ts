import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type {
  Card, StageState, StageKey, StageSlot, Phase,
  HistoryEntry, MoveMode, CardToastData, ComboRevealData,
} from '@/types/game'
import {
  buildPlayerDeck, buildAIDeck, PHASES, COMBOS, GENRES,
  genreBonus, stageCostMod, detectCombos, isBonus, isPhaseOk,
} from '@/lib/data'
import { Sound } from '@/lib/sound'

// ── Pure helpers ──────────────────────────────────────────────────────────────

function emptyStageState(): StageState {
  return {
    stage: null, artist1: null, artist2: null, artist3: null,
    hardware: null, track: null, track2: null, track3: null, guest: null,
    current: 0, threshold: 0, bonus: 0, protected: false, decoy: false, combos: [],
  }
}

function emptyStages(): Record<StageKey, StageState> {
  return { s1: emptyStageState(), s2: emptyStageState(), s3: emptyStageState() }
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function calcStageScore(stage: StageState, genre: string): StageState {
  if (!stage.stage) return { ...stage, current: 0, threshold: 0, bonus: 0, combos: [] }
  const threshold = stage.stage.threshold ?? 0
  const arts = [stage.artist1, stage.artist2, stage.artist3].filter(Boolean) as Card[]
  const trks = [stage.track, stage.track2, stage.track3].filter(Boolean) as Card[]
  if (!arts.length || !trks.length) return { ...stage, current: 0, threshold, bonus: 0, combos: [] }
  let base = arts.reduce((a, x) => a + (x.talent ?? 0) / 100, 0) +
    trks.reduce((a, t) => a + (t.power ?? t.bonus ?? 0), 0)
  if (stage.hardware) base *= stage.hardware.multiplier ?? 1
  const { bonus: comboBonus, mult: comboMult, active } = detectCombos(stage)
  base = base * comboMult + comboBonus
  const gb = genreBonus(genre, stage)
  let guestB = 0
  if (stage.guest) {
    if (stage.guest.type === 'collab') guestB = stage.guest.bonus ?? 0
    else if (stage.guest.type === 'viral') guestB = stage.guest.power ?? 0
  }
  return { ...stage, current: parseFloat((base + gb + guestB).toFixed(2)), threshold, bonus: gb + guestB, combos: active }
}

function recalcAll(stages: Record<StageKey, StageState>, genre: string): Record<StageKey, StageState> {
  return {
    s1: calcStageScore(stages.s1, genre),
    s2: calcStageScore(stages.s2, genre),
    s3: calcStageScore(stages.s3, genre),
  }
}

// ── State & Actions types ─────────────────────────────────────────────────────

export interface GameState {
  isStarted: boolean
  playerGenre: string; playerSubGenre: string; aiGenre: string
  round: number; phaseIdx: number
  playerDeck: Card[]; playerHand: Card[]; playerTrash: Card[]
  playerStages: Record<StageKey, StageState>
  playerWallet: number; playerBestRound: number
  aiDeck: Card[]; aiHand: Card[]; aiTrash: Card[]
  aiStages: Record<StageKey, StageState>
  aiWallet: number; aiBestRound: number
  selectedCard: number | null; targetMode: boolean
  focusedStage: StageKey
  unlockedStages: Record<StageKey, boolean>
  moveMode: MoveMode | null; mustDiscard: number
  actionsLeft: number; maxActions: number
  history: HistoryEntry[]; discovered: Record<string, boolean>
  commentary: string; logEntries: string[]
  gameOver: boolean; showResults: boolean; showSetup: boolean
  showTutorial: boolean; tutStep: number
  showPhaseTransition: boolean; phaseTransitionName: string
  cardToast: CardToastData | null; comboReveal: ComboRevealData | null
  playerHasAttacked: boolean; soundMuted: boolean
}

export interface GameActions {
  startGame(playerGenre: string, playerSubGenre: string, aiGenre: string): void
  restartGame(): void
  showTut(): void; tutNav(dir: 1 | -1): void
  nextPhase(): void; prevPhase(): void
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
  dismissCardToast(): void; dismissComboReveal(): void
}

// ── Initial state ─────────────────────────────────────────────────────────────

const INITIAL: GameState = {
  isStarted: false, playerGenre: 'Synthwave', playerSubGenre: 'Darksynth', aiGenre: 'Industrial',
  round: 1, phaseIdx: 0,
  playerDeck: [], playerHand: [], playerTrash: [], playerStages: emptyStages(),
  playerWallet: 0, playerBestRound: 0,
  aiDeck: [], aiHand: [], aiTrash: [], aiStages: emptyStages(),
  aiWallet: 0, aiBestRound: 0,
  selectedCard: null, targetMode: false, focusedStage: 's1',
  unlockedStages: { s1: true, s2: false, s3: false },
  moveMode: null, mustDiscard: 0, actionsLeft: 3, maxActions: 3,
  history: [], discovered: {},
  commentary: '"Systems online. 77-node register locked."', logEntries: [],
  gameOver: false, showResults: false, showSetup: false, showTutorial: true, tutStep: 1,
  showPhaseTransition: false, phaseTransitionName: '',
  cardToast: null, comboReveal: null,
  playerHasAttacked: false, soundMuted: false,
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useGameStore = create<GameState & GameActions>()(
  immer((set, get) => {

    // ── Internal helpers (closures, never in returned object) ──────────────────

    function log(msg: string) {
      set(s => { s.logEntries = [...s.logEntries.slice(-99), msg] })
    }

    function addHand(targetLen: number) {
      set(s => {
        const need = Math.max(0, targetLen - s.playerHand.length)
        const drawn = s.playerDeck.slice(-need)
        s.playerDeck = s.playerDeck.slice(0, s.playerDeck.length - need)
        s.playerHand = [...s.playerHand, ...drawn]
      })
    }

    function addAIHand(targetLen: number) {
      set(s => {
        const need = Math.max(0, targetLen - s.aiHand.length)
        const drawn = s.aiDeck.slice(-need)
        s.aiDeck = s.aiDeck.slice(0, s.aiDeck.length - need)
        s.aiHand = [...s.aiHand, ...drawn]
      })
    }

    function recalc() {
      set(s => {
        s.playerStages = recalcAll(s.playerStages, s.playerGenre)
        s.aiStages = recalcAll(s.aiStages, s.aiGenre)
      })
    }

    function comboCheck(stages: Record<StageKey, StageState>) {
      for (const k of ['s1', 's2', 's3'] as StageKey[]) {
        for (const c of stages[k].combos) {
          if (!get().discovered[c.id]) {
            set(s => { s.discovered[c.id] = true; s.comboReveal = { combo: c, isNew: true } })
            Sound.combo()
          }
        }
      }
    }

    function phaseTransition(name: string) {
      set(s => { s.showPhaseTransition = true; s.phaseTransitionName = name })
      setTimeout(() => set(s => { s.showPhaseTransition = false }), 1200)
      Sound.phase(name)
    }

    function resetActions() {
      set(s => { s.actionsLeft = s.maxActions; s.moveMode = null })
    }

    function canAct(): boolean {
      if (get().actionsLeft > 0) return true
      log('✖ No actions left this phase! Move placed cards (free) or advance the phase.')
      return false
    }

    function spendAction() {
      set(s => { s.actionsLeft = Math.max(0, s.actionsLeft - 1) })
    }

    function toast(name: string, dest: string) {
      set(s => { s.cardToast = { name, dest } })
      setTimeout(() => set(s => { s.cardToast = null }), 1400)
    }

    function playerThreatScore(): number {
      return Math.max(...(['s1', 's2', 's3'] as StageKey[]).map(k => get().playerStages[k].current))
    }

    // ── autoPlace: place the selected hand card onto the focused stage ─────────

    function autoPlace(idx: number) {
      const { playerHand, focusedStage, playerStages, playerWallet, playerGenre, phaseIdx, unlockedStages } = get()
      const card = playerHand[idx]
      if (!card) return
      const fk = focusedStage
      const s = playerStages[fk]

      if (card.type === 'stage') {
        if (!canAct()) { set(st => { st.selectedCard = null }); return }
        const cost = Math.max(0, (card.cost ?? 0) + stageCostMod(playerGenre))
        if (cost > playerWallet) {
          log(`✖ Need ${cost}k Hype (you have ${playerWallet.toFixed(1)}k). Play a SPONSOR first!`)
          set(st => { st.selectedCard = null }); return
        }
        let target: StageKey | null = null
        if (unlockedStages[fk] && !playerStages[fk].stage) target = fk
        if (!target) for (const k of ['s1', 's2', 's3'] as StageKey[]) {
          if (unlockedStages[k] && !playerStages[k].stage) { target = k; break }
        }
        if (!target && unlockedStages[fk]) target = fk
        if (!target) { log('✖ No unlocked stage lane available.'); set(st => { st.selectedCard = null }); return }
        const replaced = playerStages[target].stage
        set(st => {
          st.history.push({ type: 'place', sk: target!, slot: 'stage', card, hi: idx, ow: playerWallet, replaced })
          if (replaced) { st.playerWallet += Math.max(0, (replaced.cost ?? 0) + stageCostMod(st.playerGenre)); st.playerTrash.push(replaced) }
          st.playerWallet -= cost
          st.playerStages[target!].stage = card
          st.playerHand.splice(idx, 1)
          st.selectedCard = null
          st.focusedStage = target!
        })
        spendAction(); Sound.place()
        log(`🎪 ${card.name} → ${target!.toUpperCase()} (needs ${card.threshold}k fans)`)
        recalc(); comboCheck(get().playerStages)
        toast(card.name, `Stage ${target!.toUpperCase()}`)
        return
      }

      if (isBonus(card.type)) {
        if (!canAct()) { set(st => { st.selectedCard = null }); return }
        if (!s.stage) { log('✖ Place a STAGE card first'); set(st => { st.selectedCard = null }); return }
        if (s.guest) { log('✖ Bonus slot already filled'); set(st => { st.selectedCard = null }); return }
        if (card.type === 'collab' && !card.encore) {
          if ([s.artist1, s.artist2, s.artist3].filter(Boolean).length < 2) {
            log('✖ Collab needs 2+ artists'); set(st => { st.selectedCard = null }); return
          }
        }
        if (card.type === 'viral') {
          if (![s.artist1, s.artist2, s.artist3].some(a => a && (a.talent ?? 0) >= 30)) {
            log('✖ Viral Hit needs a 30+ talent artist'); set(st => { st.selectedCard = null }); return
          }
        }
        set(st => {
          st.history.push({ type: 'place', sk: fk, slot: 'guest', card, hi: idx, ow: playerWallet })
          st.playerStages[fk].guest = card
          if (card.type === 'sponsor') {
            const hb = st.playerGenre === 'Hip-Hop' ? 1 : 0
            st.playerWallet += (card.income ?? 0) + hb
          }
          st.playerHand.splice(idx, 1); st.selectedCard = null
        })
        spendAction(); Sound.place()
        log(`⭐ ${card.name} → ${fk.toUpperCase()} bonus slot`)
        recalc(); toast(card.name, `Bonus on ${fk.toUpperCase()}`)
        return
      }

      let slot: StageSlot | null = null
      if (card.type === 'artist') {
        slot = !s.artist1 ? 'artist1' : !s.artist2 ? 'artist2' : !s.artist3 ? 'artist3' : null
      } else if (card.type === 'track') {
        slot = !s.track ? 'track' : (s.stage?.maxTracks ?? 1) >= 2 && !s.track2 ? 'track2' : (s.stage?.maxTracks ?? 1) >= 3 && !s.track3 ? 'track3' : null
      } else if (card.type === 'hardware') {
        slot = 'hardware'
      } else if (card.type === 'defense') {
        if (!canAct()) { set(st => { st.selectedCard = null }); return }
        set(st => {
          st.history.push({ type: 'def', sk: fk, card, hi: idx, op: st.playerStages[fk].protected, odecoy: st.playerStages[fk].decoy })
          if (card.decoy) st.playerStages[fk].decoy = true
          else st.playerStages[fk].protected = true
          st.playerHand.splice(idx, 1); st.selectedCard = null
        })
        spendAction()
        log(card.decoy ? `🕵 Decoy Booth on ${fk}` : `🛡 Firewall raised on ${fk}`)
        toast(card.name, `Defense on ${fk.toUpperCase()}`)
        return
      }

      if (!s.stage) { log('✖ Place a STAGE card first'); set(st => { st.selectedCard = null }); return }
      if (slot) {
        if (!canAct()) { set(st => { st.selectedCard = null }); return }
        set(st => {
          st.history.push({ type: 'place', sk: fk, slot, card, hi: idx, ow: st.playerWallet })
          ;(st.playerStages[fk] as unknown as Record<string, unknown>)[slot!] = card
          st.playerHand.splice(idx, 1); st.selectedCard = null
        })
        spendAction(); Sound.place()
        log(`▶ ${card.name} → ${fk} [${slot}]`)
        recalc(); comboCheck(get().playerStages)
        toast(card.name, `${fk.toUpperCase()} [${slot}]`)
      } else {
        if (card.type === 'artist') log('✖ Stage already has 3 artists')
        else if (card.type === 'track') log('✖ No track slot free on this stage')
        else log(`✖ Cannot place ${card.name} here`)
        set(st => { st.selectedCard = null })
      }
    }

    // ── execAttack: resolve an attack card on an AI stage ─────────────────────

    function execAttack(tk: StageKey) {
      const { selectedCard, playerHand, aiStages } = get()
      if (selectedCard === null) return
      const card = playerHand[selectedCard]
      const s = aiStages[tk]
      if (!s.stage) {
        log(`✖ AI has no stage at ${tk}`)
        set(st => { st.targetMode = false; st.selectedCard = null })
        return
      }
      set(st => {
        st.history.push({ type: 'atk', hi: selectedCard, card, tk, snap: JSON.parse(JSON.stringify(s)) })
        st.playerHasAttacked = true
      })
      Sound.attack()

      if (s.protected) {
        log(`🛡 AI firewall on ${tk} blocked your ${card.name}!`)
      } else {
        set(st => {
          const target = st.aiStages[tk]
          if (card.name === 'Malware Worm' && target.hardware) {
            st.aiTrash.push(target.hardware); target.hardware = null
            log(`💥 ${card.name} destroyed AI hardware on ${tk}!`)
          } else if (card.name === 'Track Corruptor' && target.track) {
            st.aiTrash.push(target.track); target.track = null
            log(`💥 Track corrupted on AI ${tk}!`)
          } else if (card.name === 'EMP Blast') {
            if (target.hardware) { st.aiTrash.push(target.hardware); target.hardware = null }
            if (target.track) { st.aiTrash.push(target.track); target.track = null }
            log(`💥 EMP Blast hit AI ${tk}!`)
          } else if (card.name === 'Artist Poacher') {
            const sl = (['artist1', 'artist2', 'artist3'] as const).find(x => target[x])
            if (sl) { st.aiTrash.push(target[sl]!); target[sl] = null; log(`🕵 Artist poached from AI ${tk}!`) }
          } else {
            log(`🛡 Attack hit ${tk} but nothing to destroy there`)
          }
        })
      }
      set(st => { st.playerHand.splice(selectedCard, 1) })
      set(st => { st.targetMode = false; st.selectedCard = null })
      spendAction(); recalc()
    }

    // ── AI moves ───────────────────────────────────────────────────────────────

    async function aiCallCommentary(ctx: string) {
      const { playerStages, aiStages } = get()
      const pb = (['s1', 's2', 's3'] as StageKey[])
        .map(k => `${k}:${playerStages[k].current.toFixed(1)}k${playerStages[k].protected ? ' shielded' : ''}`)
        .join(', ')
      const ab = (['s1', 's2', 's3'] as StageKey[])
        .map(k => `${k}:${aiStages[k].current.toFixed(1)}k`)
        .join(', ')
      try {
        const res = await fetch('/api/commentary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ctx, playerBoard: pb, aiBoard: ab }),
        })
        const data = await res.json() as { text?: string }
        set(s => { s.commentary = `"${data.text ?? 'Analyzing frequencies...'}"` })
      } catch {
        set(s => { s.commentary = '"My algorithms are running hot. Your crowd is already mine."' })
      }
    }

    function aiMoveArrangement() {
      set(s => {
        const aggression = Math.min(0.3 + s.round * 0.12, 0.85)
        for (const k of ['s1', 's2', 's3'] as StageKey[]) {
          const stage = s.aiStages[k]
          if (stage.stage) continue
          const scIdx = s.aiHand.findIndex(c => c.type === 'stage')
          if (scIdx >= 0) { stage.stage = s.aiHand[scIdx]; s.aiHand.splice(scIdx, 1) }
          else stage.stage = { id: 9000, type: 'stage', name: 'Industrial Arena', threshold: 3.5, cost: 0, maxTracks: 2, desc: '' }
          const want = aggression > 0.5 ? 3 : 2
          const arts = s.aiHand.filter(c => c.type === 'artist').slice(0, want)
          arts.forEach((a, i) => {
            const sl = `artist${i + 1}` as 'artist1' | 'artist2' | 'artist3'
            stage[sl] = a; s.aiHand = s.aiHand.filter(c => c !== a)
          })
          if (![stage.artist1, stage.artist2, stage.artist3].some(Boolean)) {
            stage.artist1 = { id: 9001, type: 'artist', name: 'AI Session Pro', talent: 35 + Math.floor(Math.random() * 15), desc: '' }
          }
          break
        }
        s.aiStages = recalcAll(s.aiStages, s.aiGenre)
      })
      aiCallCommentary('arrangement')
    }

    function aiMoveSoundcheck() {
      set(s => {
        for (const k of ['s1', 's2', 's3'] as StageKey[]) {
          const stage = s.aiStages[k]
          if (!stage.stage || stage.track) continue
          const trIdx = s.aiHand.findIndex(c => c.type === 'track')
          stage.track = trIdx >= 0 ? s.aiHand.splice(trIdx, 1)[0] : { id: 9010, type: 'track', name: 'Noise Signal', power: 1.2, desc: '' }
          const hw3 = s.aiHand.find(c => c.type === 'hardware' && (c.multiplier ?? 0) >= 3)
          const hw = hw3 ?? s.aiHand.find(c => c.type === 'hardware')
          if (hw) { stage.hardware = hw; s.aiHand = s.aiHand.filter(c => c !== hw) }
          else stage.hardware = { id: 9011, type: 'hardware', name: 'AI Pre-Amp', multiplier: s.round >= 3 ? 3 : 2, desc: '' }
          if ((stage.stage.maxTracks ?? 1) >= 2 && !stage.track2) {
            const tr2 = s.aiHand.find(c => c.type === 'track')
            stage.track2 = tr2 ? (s.aiHand = s.aiHand.filter(c => c !== tr2), tr2) : { id: 9012, type: 'track', name: 'Sub Layer', power: 1.0, desc: '' }
          }
        }
        if (s.playerHasAttacked || playerThreatScore() >= 4) {
          let best: StageKey | null = null; let bv = -1
          for (const k of ['s1', 's2', 's3'] as StageKey[]) {
            const st = s.aiStages[k]
            if (st.stage && !st.protected && st.current > bv) { bv = st.current; best = k }
          }
          if (best && Math.random() < 0.5 + s.round * 0.1) {
            s.aiStages[best].protected = true
            log(`🛡 AI shielded its ${best.toUpperCase()} — it saw your aggression`)
          }
        }
        s.aiStages = recalcAll(s.aiStages, s.aiGenre)
      })
      aiCallCommentary('soundcheck')
    }

    function aiMoveAttack() {
      set(s => {
        const atkIdx = s.aiHand.findIndex(c => c.type === 'attack')
        if (atkIdx < 0) return
        const atk = s.aiHand[atkIdx]
        let target: StageState | null = null; let tk: StageKey | null = null; let score = -1
        for (const k of ['s1', 's2', 's3'] as StageKey[]) {
          const st = s.playerStages[k]
          if (!st.stage || st.protected) continue
          let v = 0
          if (st.current >= st.threshold && st.threshold > 0) v += st.current * 2
          if (st.hardware) v += (st.hardware.multiplier ?? 0) * 3
          if (st.combos?.length) v += 10
          if (v > score) { score = v; target = st; tk = k }
        }
        if (!target || !tk) { s.aiHand.splice(atkIdx, 1); return }
        if (atk.name === 'Malware Worm' && target.hardware) {
          s.aiTrash.push(target.hardware); target.hardware = null
          log(`💥 AI smashed your ${tk.toUpperCase()} hardware!`)
        } else if ((atk.name === 'Track Corruptor' || atk.name === 'EMP Blast') && target.track) {
          s.aiTrash.push(target.track); target.track = null
          if (atk.name === 'EMP Blast' && target.hardware) { s.aiTrash.push(target.hardware); target.hardware = null }
          log(`💥 AI corrupted your track on ${tk.toUpperCase()}!`)
        } else if (atk.name === 'Artist Poacher') {
          const sl = (['artist1', 'artist2', 'artist3'] as const).find(x => target![x])
          if (sl) { s.aiTrash.push(target[sl]!); target[sl] = null; log(`🕵 AI poached your artist on ${tk.toUpperCase()}!`) }
        } else if (target.hardware) {
          s.aiTrash.push(target.hardware); target.hardware = null
          log(`💥 AI destroyed your hardware on ${tk.toUpperCase()}!`)
        } else if (target.track) {
          s.aiTrash.push(target.track); target.track = null
          log(`💥 AI corrupted your track on ${tk.toUpperCase()}!`)
        }
        s.aiHand.splice(atkIdx, 1); s.aiTrash.push(atk)
        s.playerStages = recalcAll(s.playerStages, s.playerGenre)
      })
      aiCallCommentary('attack')
    }

    // ── Public store ───────────────────────────────────────────────────────────

    return {
      ...INITIAL,

      showTut() { set(s => { s.showTutorial = true; s.tutStep = 1 }) },

      tutNav(dir) {
        if (get().tutStep === 4 && dir === 1) {
          set(s => { s.showTutorial = false; s.showSetup = true }); return
        }
        set(s => { s.tutStep = Math.max(1, Math.min(4, s.tutStep + dir)) })
      },

      startGame(playerGenre, playerSubGenre, aiGenre) {
        Sound.unlock()
        const playerDeck = buildPlayerDeck()
        const aiDeck = buildAIDeck()
        set(s => {
          Object.assign(s, { ...INITIAL, isStarted: true, showSetup: false, showTutorial: false, playerGenre, playerSubGenre, aiGenre })
          s.playerDeck = playerDeck.slice(0, -10); s.playerHand = playerDeck.slice(-10)
          s.aiDeck = aiDeck.slice(0, -10); s.aiHand = aiDeck.slice(-10)
        })
        recalc()
        log('▶ Game started! Arrangement phase — place your Stages first.')
      },

      restartGame() { set(() => ({ ...INITIAL, showSetup: true, showTutorial: false })) },

      nextPhase() {
        const { phaseIdx, playerStages, playerGenre, round } = get()
        const phase = PHASES[phaseIdx]

        if (phase === 'ARRANGEMENT') {
          for (const k of ['s1', 's2', 's3'] as StageKey[]) {
            const s = playerStages[k]
            if (s.stage && !s.artist1 && !s.artist2 && !s.artist3 && (s.track || s.hardware)) {
              alert(`Stage ${k}: has cards but no artist! Add at least one ARTIST.`); return
            }
          }
          aiMoveArrangement()
        }
        if (phase === 'SOUNDCHECK') aiMoveSoundcheck()
        if (phase === 'LIVE SHOW') aiMoveAttack()

        if (phase === 'RESULTS') {
          const newRound = round + 1
          const baseGain = Math.min(newRound, 5)
          const hhBonus = playerGenre === 'Hip-Hop' ? 0.5 : 0
          set(s => {
            s.phaseIdx = 0; s.round = newRound
            s.playerWallet += baseGain + hhBonus
            for (const k of ['s1', 's2', 's3'] as StageKey[]) {
              for (const sl of ['stage', 'artist1', 'artist2', 'artist3', 'hardware', 'track', 'track2', 'track3', 'guest'] as StageSlot[]) {
                const card = (s.playerStages[k] as unknown as Record<string, unknown>)[sl] as Card | null
                if (card) s.playerTrash.push(card)
                ;(s.playerStages[k] as unknown as Record<string, unknown>)[sl] = null
              }
              s.playerStages[k].protected = false; s.playerStages[k].decoy = false
              s.playerStages[k].combos = []
            }
            for (const k of ['s1', 's2', 's3'] as StageKey[]) {
              for (const sl of ['artist1', 'artist2', 'artist3'] as const) {
                if (s.aiStages[k][sl]) { s.aiTrash.push(s.aiStages[k][sl]!); s.aiStages[k][sl] = null }
              }
            }
            s.showResults = false; s.history = []
            if (newRound >= 2) { s.unlockedStages.s2 = true; s.unlockedStages.s3 = true }
          })
          addHand(get().playerHand.length + 7)
          addAIHand(get().aiHand.length + 7)
          recalc(); resetActions(); phaseTransition('ARRANGEMENT')
          log(`▶ Round ${get().round} — income: +${(baseGain + hhBonus).toFixed(1)}k Hype`)
          return
        }

        set(s => { s.phaseIdx += 1 })
        const newPhase = PHASES[get().phaseIdx]
        resetActions(); recalc()

        if (newPhase === 'RESULTS') {
          let pt = 0; let at = 0
          const ps = get().playerStages; const as_ = get().aiStages
          for (const k of ['s1', 's2', 's3'] as StageKey[]) {
            if (ps[k].current >= ps[k].threshold && ps[k].threshold > 0) pt += ps[k].current
            if (as_[k].current >= as_[k].threshold && as_[k].threshold > 0) at += as_[k].current
          }
          set(s => {
            s.playerWallet += pt; s.aiWallet += at
            s.playerBestRound = Math.max(s.playerBestRound, pt)
            s.aiBestRound = Math.max(s.aiBestRound, at)
            if (s.round >= 2) { s.unlockedStages.s2 = true; s.unlockedStages.s3 = true }
            s.gameOver = (pt >= 20 || at >= 20); s.showResults = true
          })
          log(`📊 Results — You: ${pt.toFixed(1)}k | AI: ${at.toFixed(1)}k`)
          if (pt >= 20 && pt >= at) Sound.win()
          else if (at >= 20) Sound.lose()
        }

        phaseTransition(newPhase)
        log(`▶ ${newPhase}`)
        comboCheck(get().playerStages)
      },

      prevPhase() {
        set(s => { if (s.phaseIdx > 0) { s.phaseIdx -= 1; s.actionsLeft = s.maxActions } })
        const phase = PHASES[get().phaseIdx]
        phaseTransition(phase); log(`◀ Back to ${phase}`)
      },

      selectCard(idx) {
        const { playerHand, phaseIdx, mustDiscard } = get()
        const card = playerHand[idx]
        if (!card) return
        const phase = PHASES[phaseIdx] as Phase

        if (mustDiscard > 0) {
          set(s => { s.playerTrash.push(s.playerHand.splice(idx, 1)[0]); s.mustDiscard -= 1 })
          log(`🗑 Discarded ${card.name}`); return
        }
        if (!isPhaseOk(card.type, phase)) {
          log(`✖ ${card.name} can't be played in ${phase} phase`); return
        }
        Sound.card(card.type)

        if (card.type === 'attack') {
          if (!canAct()) return
          set(s => { s.selectedCard = idx; s.targetMode = true })
          log('🎯 ATTACK MODE: click an AI stage to target it'); return
        }
        if (card.type === 'draw') {
          if (!canAct()) return
          set(s => { s.playerHand.splice(idx, 1) })
          addHand(get().playerHand.length + (card.draw ?? 2))
          spendAction()
          if (card.discard) {
            set(s => { s.mustDiscard = card.discard! })
            log(`📼 ${card.name}: drew cards. Now discard ${card.discard} via 🗑`)
          } else {
            log(`📼 ${card.name}: drew ${card.draw} cards!`)
          }
          return
        }
        set(s => { s.selectedCard = idx })
        autoPlace(idx)
      },

      slotClick(sk, sl) {
        const { moveMode, selectedCard, playerHand, phaseIdx, playerStages, playerWallet } = get()
        if (moveMode) { get().tryMoveDrop(sk, sl); return }
        if (selectedCard === null) return
        const card = playerHand[selectedCard]
        if (!card || !isPhaseOk(card.type, PHASES[phaseIdx] as Phase)) return
        const s = playerStages[sk]

        if (sl === 'guest') {
          if (!isBonus(card.type)) { log('✖ Bonus slot only accepts Collab/Viral/Sponsor'); return }
          if (!s.stage) { log('✖ No stage here'); return }
          if (s.guest) { log('✖ Bonus slot already filled'); return }
          if (card.type === 'collab' && !card.encore && [s.artist1, s.artist2, s.artist3].filter(Boolean).length < 2) {
            log('✖ Collab needs 2+ artists'); return
          }
          if (!canAct()) return
          set(st => {
            st.history.push({ type: 'place', sk, slot: 'guest', card, hi: selectedCard, ow: playerWallet })
            st.playerStages[sk].guest = card
            if (card.type === 'sponsor') {
              const hb = st.playerGenre === 'Hip-Hop' ? 1 : 0
              st.playerWallet += (card.income ?? 0) + hb
            }
            st.playerHand.splice(selectedCard, 1); st.selectedCard = null
          })
          spendAction(); Sound.place(); recalc()
          toast(card.name, `Bonus on ${sk.toUpperCase()}`); return
        }

        if (isBonus(card.type)) { log('✖ Bonus cards go in the ⭐ BONUS slot'); return }
        if (card.type === 'stage' && (card.cost ?? 0) > playerWallet) { log(`✖ Need ${card.cost}k Hype`); return }
        if (!s.stage && sl !== 'stage') { log('✖ No stage scene here'); return }
        if (!canAct()) return

        set(st => {
          st.history.push({ type: 'place', sk, slot: sl, card, hi: selectedCard, ow: playerWallet })
          if (card.type === 'stage') st.playerWallet -= card.cost ?? 0
          ;(st.playerStages[sk] as unknown as Record<string, unknown>)[sl] = card
          st.playerHand.splice(selectedCard, 1); st.selectedCard = null
        })
        spendAction(); Sound.place(); recalc(); comboCheck(get().playerStages)
        toast(card.name, `${sk.toUpperCase()} [${sl}]`)
      },

      pickup(sk, sl) {
        const s = get().playerStages[sk]
        const card = (s as unknown as Record<string, unknown>)[sl] as Card | null
        if (!card) return
        set(st => {
          if (sl === 'stage' && (card.cost ?? 0) > 0) st.playerWallet += card.cost ?? 0
          if (sl === 'guest' && card.type === 'sponsor') {
            const hb = st.playerGenre === 'Hip-Hop' ? 1 : 0
            st.playerWallet -= (card.income ?? 0) + hb
          }
          ;(st.playerStages[sk] as unknown as Record<string, unknown>)[sl] = null
          st.playerHand.push(card)
          st.actionsLeft = Math.min(st.actionsLeft + 1, st.maxActions)
        })
        log(`↩ ${card.name} returned to hand`); recalc()
      },

      aiClick(sk) { if (get().targetMode) execAttack(sk) },

      cancelTarget() { set(s => { s.targetMode = false; s.selectedCard = null }) },

      trashCard(idx) {
        set(s => { s.playerTrash.push(s.playerHand.splice(idx, 1)[0]) })
      },

      startMove(sk, sl) {
        const card = (get().playerStages[sk] as unknown as Record<string, unknown>)[sl] as Card | null
        if (!card || sl === 'stage') { log('✖ That card cannot be moved'); return }
        set(s => { s.moveMode = { sk, sl, card } })
        log(`↔ Moving ${card.name} — click an empty matching slot (free)`)
      },

      tryMoveDrop(sk, sl) {
        const { moveMode, playerStages } = get()
        if (!moveMode) return false
        if (moveMode.sk === sk && moveMode.sl === sl) {
          set(s => { s.moveMode = null }); log('Move cancelled'); return true
        }
        const dest = playerStages[sk]
        if (!dest.stage) { log('✖ That stage has no scene'); return true }
        const isArtistSlot = (x: string) => x.startsWith('artist')
        const isTrackSlot = (x: string) => x.startsWith('track')
        const compat =
          moveMode.sl === sl ||
          (isArtistSlot(moveMode.sl) && isArtistSlot(sl)) ||
          (isTrackSlot(moveMode.sl) && isTrackSlot(sl)) ||
          (moveMode.sl === 'hardware' && sl === 'hardware') ||
          (moveMode.sl === 'guest' && sl === 'guest')
        if (!compat) { log('✖ Cards can only move to a matching slot type'); return true }
        if ((dest as unknown as Record<string, unknown>)[sl]) { log('✖ That slot is occupied'); return true }
        set(s => {
          ;(s.playerStages[moveMode.sk] as unknown as Record<string, unknown>)[moveMode.sl] = null
          ;(s.playerStages[sk] as unknown as Record<string, unknown>)[sl] = moveMode.card
          s.moveMode = null
        })
        Sound.click()
        log(`↔ Moved ${moveMode.card.name} → ${sk.toUpperCase()} [${sl}] (free)`)
        recalc(); return true
      },

      undo() {
        const { history } = get()
        if (!history.length) { log('✖ Nothing to undo'); return }
        const m = history[history.length - 1]
        set(s => { s.history.pop() })
        if (m.type === 'place') {
          set(s => {
            ;(s.playerStages[m.sk] as unknown as Record<string, unknown>)[m.slot] = m.replaced ?? null
            if (m.replaced) s.playerTrash = s.playerTrash.filter(c => c !== m.replaced)
            s.playerHand.splice(m.hi, 0, m.card)
            s.playerWallet = m.ow
            s.actionsLeft = Math.min(s.actionsLeft + 1, s.maxActions)
          })
          log(`↩ Undo: removed ${m.card.name}`)
        } else if (m.type === 'def') {
          set(s => {
            s.playerStages[m.sk].protected = m.op; s.playerStages[m.sk].decoy = m.odecoy
            s.playerHand.splice(m.hi, 0, m.card)
            s.actionsLeft = Math.min(s.actionsLeft + 1, s.maxActions)
          })
          log('↩ Undo: defense removed')
        } else if (m.type === 'atk') {
          set(s => {
            s.aiStages[m.tk] = m.snap; s.playerHand.splice(m.hi, 0, m.card)
            s.actionsLeft = Math.min(s.actionsLeft + 1, s.maxActions)
          })
          log('↩ Undo: attack reversed')
        }
        recalc()
      },

      mulligan() {
        const { round, phaseIdx } = get()
        if (round !== 1 || phaseIdx !== 0) { log('✖ Mulligan only on Round 1, Arrangement phase'); return }
        set(s => {
          const cards: Card[] = []
          for (const k of ['s1', 's2', 's3'] as StageKey[]) {
            for (const sl of ['stage', 'artist1', 'artist2', 'artist3', 'hardware', 'track', 'track2', 'track3', 'guest'] as StageSlot[]) {
              const c = (s.playerStages[k] as unknown as Record<string, unknown>)[sl] as Card | null
              if (c) { cards.push(c); (s.playerStages[k] as unknown as Record<string, unknown>)[sl] = null }
            }
          }
          s.playerDeck = shuffle([...s.playerDeck, ...s.playerHand, ...cards])
          s.playerHand = []; s.playerWallet = 0
        })
        addHand(10); recalc(); log('🔀 Mulligan! Hand reshuffled.')
      },

      closeResults() {
        set(s => { s.showResults = false })
        if (!get().gameOver) get().nextPhase()
      },

      setFocus(sk) {
        if (!get().unlockedStages[sk]) return
        set(s => { s.focusedStage = sk }); log(`🎯 Stage ${sk} focused`)
      },

      toggleSound() {
        const nowMuted = Sound.toggle()
        set(s => { s.soundMuted = nowMuted })
      },

      addLog: log,
      setCommentary(txt) { set(s => { s.commentary = txt }) },
      dismissCardToast() { set(s => { s.cardToast = null }) },
      dismissComboReveal() { set(s => { s.comboReveal = null }) },
    }
  }),
)
