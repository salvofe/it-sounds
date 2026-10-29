'use client'
import { useGameStore } from '@/store/gameStore'
import { PHASES } from '@/lib/data'
import type { Phase } from '@/types/game'
import HandFan from '@/components/board/HandFan'
import HypeShop from './HypeShop'

export default function Hand() {
  const {
    phaseIdx,
    round, nextPhase, undo, mulligan, mulliganUsed,
    targetMode, cancelTarget,
  } = useGameStore()

  const phase = PHASES[phaseIdx] as Phase

  const NEXT_LABELS: Record<Phase, string> = {
    ARRANGEMENT: 'SOUNDCHECK▶',
    SOUNDCHECK: 'START SHOW▶',
    'LIVE SHOW': 'CALCULATE▶',
    RESULTS: 'NEW ROUND▶',
  }

  return (
    <div className="panel">
      <div className="panel-title pt-y">
        YOUR HAND<span className="panel-hint">Click a card to play it on the focused stage. Dimmed art = playable in another phase.</span>
      </div>

      {/* card row */}
      <div style={{ minHeight: 330 }}><HandFan /></div>

      {/* controls */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
        {round === 1 && phaseIdx === 0 && !mulliganUsed && (
          <button className="btn btn-y" onClick={mulligan}>MULLIGAN</button>
        )}
        <button className="btn btn-x" onClick={undo}>↩ UNDO</button>
        <button className="btn btn-g" style={{ fontSize: 12, padding: '8px 16px' }} onClick={nextPhase}>
          {NEXT_LABELS[phase]}
        </button>
        {targetMode && (
          <button className="btn btn-r" onClick={cancelTarget}>✖ CANCEL ATTACK</button>
        )}
        <HypeShop />
      </div>
    </div>
  )
}
