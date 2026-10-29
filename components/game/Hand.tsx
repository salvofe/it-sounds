'use client'
import { useGameStore } from '@/store/gameStore'
import { PHASES } from '@/lib/data'
import type { Phase } from '@/types/game'
import CardComponent from './CardComponent'

export default function Hand() {
  const {
    playerHand, selectedCard, phaseIdx,
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
        ▶ YOUR HAND — Click a card to play it ▶
      </div>

      {/* card row */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, minHeight: 130, padding: '4px 0' }}>
        {playerHand.map((card, i) => (
          <CardComponent
            key={card.id}
            card={card}
            index={i}
            selected={selectedCard === i}
            phase={phase}
          />
        ))}
        {playerHand.length === 0 && (
          <div style={{ color: 'var(--muted)', fontSize: 19, padding: '20px 0' }}>Hand is empty — advance to next round to draw more cards.</div>
        )}
      </div>

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
      </div>
    </div>
  )
}
