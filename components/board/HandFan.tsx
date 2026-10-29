'use client'
import type { CSSProperties } from 'react'
import { isPhaseOk, PHASES, cardPhaseLabel } from '@/lib/data'
import { cardStats } from '@/lib/skins'
import { useGameStore } from '@/store/gameStore'
import Card from './Card'
import { anchorOf } from './anchor'
import type { Phase } from '@/types/game'

// Your hand, fanned along the bottom edge. Hover/focus lifts a card and shows its preview.
export default function HandFan() {
  const { playerHand, selectedCard, phaseIdx, playerGenre, selectCard, trashCard, setPreview } = useGameStore()
  const phase = PHASES[phaseIdx] as Phase
  const n = playerHand.length
  if (!n) return <div className="hand-empty">Hand is empty — advance to the next round to draw.</div>
  const overlap = n > 9 ? -112 : n > 6 ? -84 : -50
  const mid = (n - 1) / 2
  return (
    <div className="hand-fan" role="list" aria-label="Your hand">
      {playerHand.map((card, i) => {
        const ok = isPhaseOk(card.type, phase)
        const selected = selectedCard === i
        const style = {
          '--rot': `${(i - mid) * Math.min(4, 28 / n)}deg`,
          '--lift': `${Math.abs(i - mid) * 5}px`,
          marginLeft: i ? overlap : 0,
          zIndex: selected ? 60 : i,
        } as CSSProperties
        return (
          <div key={card.id} role="listitem" className={`fan-card${selected ? ' selected' : ''}`} style={style}
            onMouseEnter={e => setPreview({ card, owner: 'me', anchor: anchorOf(e.currentTarget) })}
            onMouseLeave={() => setPreview(null)}>
            <button type="button" data-testid="hand-card" className={`game-card${selected ? ' selected' : ''}`}
              onClick={() => ok && selectCard(i)}
              onFocus={e => setPreview({ card, owner: 'me', anchor: anchorOf(e.currentTarget) })}
              onBlur={() => setPreview(null)}
              aria-label={`${card.name}, ${card.type}, ${cardStats(card).long}${ok ? '' : `, playable in ${cardPhaseLabel(card.type)}`}`}
              aria-pressed={selected} aria-disabled={!ok}
              style={{ all: 'unset', display: 'block', cursor: ok ? 'pointer' : 'not-allowed' }}>
              <Card card={card} genre={playerGenre} size="hand" playable={ok} selected={selected} />
            </button>
            <button type="button" className="card-trash" data-testid={`discard-${i}`}
              onClick={() => trashCard(i)} aria-label={`Discard ${card.name}`} title="Discard">🗑</button>
          </div>
        )
      })}
    </div>
  )
}
