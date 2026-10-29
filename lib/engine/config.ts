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
