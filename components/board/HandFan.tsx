'use client'
import { useEffect, useRef, type CSSProperties, type MouseEvent, type PointerEvent } from 'react'
import { isPhaseOk, PHASES, cardPhaseLabel } from '@/lib/data'
import { cardStats } from '@/lib/skins'
import { handKey, useFx } from '@/lib/fx/runner'
import { useGameStore } from '@/store/gameStore'
import Card from './Card'
import { anchorOf } from './anchor'
import type { Phase } from '@/types/game'

const LIFT = 34 // keep in sync with .fan-card hover lift in globals.css
const liftedAnchor = (el: Element) => { const a = anchorOf(el); return { ...a, top: a.top - LIFT } }

// Your hand, fanned along the bottom edge. Hover/focus lifts a card and shows its preview.
export default function HandFan() {
  const { playerHand, selectedCard, phaseIdx, playerGenre, selectCard, trashCard, setPreview } = useGameStore()
  const hidden = useFx(s => s.hidden)
  const phase = PHASES[phaseIdx] as Phase
  const n = playerHand.length
  // When the hand changes under a resting pointer (a card was played), the neighbour that slides under it
  // must not pop up a preview until the pointer actually moves.
  const still = useRef(false)
  const pointer = useRef<{ x: number; y: number } | null>(null)
  const prevIds = useRef<Set<string | number>>(new Set())
  useEffect(() => {
    const ids = new Set<string | number>(playerHand.map(c => c.id))
    // only when cards left the hand (played, discarded): a fresh deal is not "the hand moved under the pointer"
    if (prevIds.current.size > ids.size && [...ids].every(id => prevIds.current.has(id))) still.current = true
    prevIds.current = ids
  }, [playerHand])
  const enter = (e: PointerEvent<HTMLElement>, card: (typeof playerHand)[number]) => {
    if (e.pointerType === 'mouse' && !still.current) setPreview({ card, owner: 'me', anchor: liftedAnchor(e.currentTarget) })
  }
  const move = (e: MouseEvent<HTMLElement>, card: (typeof playerHand)[number]) => {
    const p = pointer.current
    pointer.current = { x: e.clientX, y: e.clientY }
    if (!still.current || (p && p.x === e.clientX && p.y === e.clientY)) return
    still.current = false
    setPreview({ card, owner: 'me', anchor: liftedAnchor(e.currentTarget) })
  }
  if (!n) return <div className="hand-empty">Hand is empty — advance to the next round to draw.</div>
  const overlap = n > 9 ? -112 : n > 6 ? -96 : -50
  const mid = (n - 1) / 2
  return (
    <div className="hand-fan" role="list" aria-label="Your hand">
      {playerHand.map((card, i) => {
        const ok = isPhaseOk(card.type, phase)
        const selected = selectedCard === i
        const style = {
          '--rot': `${(i - mid) * Math.min(4, 28 / n)}deg`,
          '--lift': `${Math.abs(i - mid) * 3}px`,
          marginLeft: i ? overlap : 0,
          zIndex: selected ? 60 : i,
        } as CSSProperties
        return (
          <div key={card.id} role="listitem" data-card-id={card.id} className={`fan-card${selected ? ' selected' : ''}${hidden[handKey(card.id)] ? ' fx-hidden' : ''}`} style={style}
            onPointerEnter={e => enter(e, card)} onMouseMove={e => move(e, card)}
            onPointerLeave={e => { if (e.pointerType === 'mouse') setPreview(null) }}>
            <div className="fan-card-lift">
            <button type="button" data-testid="hand-card" className={`hand-card-btn game-card${selected ? ' selected' : ''}`}
              onClick={() => ok && selectCard(i)}
              onFocus={e => setPreview({ card, owner: 'me', anchor: liftedAnchor(e.currentTarget) })}
              onBlur={() => setPreview(null)}
              aria-label={`${card.name}, ${card.type}, ${cardStats(card).long}${ok ? '' : `, playable in ${cardPhaseLabel(card.type)}`}`}
              aria-pressed={selected} aria-disabled={!ok}
              style={{ cursor: ok ? 'pointer' : 'not-allowed' }}>
              <Card card={card} genre={playerGenre} size="hand" playable={ok} selected={selected} />
            </button>
            <button type="button" className="card-trash" data-testid={`discard-${i}`}
              onClick={() => trashCard(i)} aria-label={`Discard ${card.name}`} title="Discard">🗑</button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
