'use client'
import { skinFor } from '@/lib/skins'
import { useGameStore } from '@/store/gameStore'

// The AI's hand, face down: one card back per card it holds.
export default function OpponentHand() {
  const { aiHand, aiGenre } = useGameStore()
  const main = skinFor(aiGenre).main
  const n = aiHand.length
  return (
    <div className="opp-hand" data-testid="opponent-hand" data-count={n} aria-label={`AI hand: ${n} cards`}>
      {aiHand.map((_, i) => (
        <span key={i} aria-hidden="true" className="card-back" style={{
          background: `repeating-linear-gradient(45deg, ${main} 0 6px, rgba(0,0,0,0.35) 6px 12px)`,
          marginLeft: i ? (n > 8 ? -34 : -22) : 0,
          transform: `rotate(${(i - (n - 1) / 2) * 3}deg)`,
        }} />
      ))}
    </div>
  )
}
