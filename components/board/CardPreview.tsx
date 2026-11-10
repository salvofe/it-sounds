'use client'
import { useGameStore } from '@/store/gameStore'
import Card from './Card'

const W = 252, H = 444

// Enlarged copy of the card under the pointer (or keyboard focus), placed beside it.
export default function CardPreview() {
  const { previewCard, playerGenre, aiGenre } = useGameStore()
  if (!previewCard) return null
  const { card, owner, anchor } = previewCard
  const vw = window.innerWidth, vh = window.innerHeight
  const left = Math.max(8, Math.min(vw - W - 8, anchor.left + anchor.width / 2 - W / 2))
  const above = anchor.top > vh / 2
  const top = above ? Math.max(8, anchor.top - H - 12) : Math.min(vh - H - 8, anchor.top + anchor.height + 12)
  return (
    <div className="card-preview" data-testid="card-preview" style={{ left, top }} aria-hidden="true">
      <Card card={card} genre={owner === 'me' ? playerGenre : aiGenre} size="preview" />
    </div>
  )
}
