'use client'
import { getSprite } from '@/lib/data'
import { isPhaseOk } from '@/lib/data'
import { PHASES } from '@/lib/data'
import { useGameStore } from '@/store/gameStore'
import type { Card } from '@/types/game'
import type { Phase } from '@/types/game'

const ANIM_BY_TYPE: Record<string, string> = {
  stage: 'anim-pulse', artist: 'anim-bounce', track: 'anim-float',
  hardware: 'anim-pulse', attack: 'anim-shake', defense: 'anim-pulse',
  collab: 'anim-bounce', sponsor: 'anim-float', viral: 'anim-shake', draw: 'anim-float',
}
const BADGE_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  stage:    { bg: '#1a1500', color: 'var(--yel)',    border: 'var(--yel)' },
  artist:   { bg: '#001a1a', color: 'var(--cyan)',   border: 'var(--cyan)' },
  track:    { bg: '#0d0020', color: 'var(--purple)', border: 'var(--purple)' },
  hardware: { bg: '#1a0a00', color: 'var(--orange)', border: 'var(--orange)' },
  attack:   { bg: '#1a0005', color: 'var(--red)',    border: 'var(--red)' },
  defense:  { bg: '#001a08', color: 'var(--grn)',    border: 'var(--grn)' },
  collab:   { bg: '#1a0018', color: '#ff88ff',       border: '#ff88ff' },
  sponsor:  { bg: '#001a1a', color: '#44eeff',       border: '#44eeff' },
  viral:    { bg: '#1a0800', color: 'var(--orange)', border: 'var(--orange)' },
  draw:     { bg: '#0a0a00', color: 'var(--yel)',    border: 'var(--yel)' },
}

interface Props {
  card: Card
  index: number
  selected: boolean
  phase: Phase
}

export default function CardComponent({ card, index, selected, phase }: Props) {
  const { selectCard, trashCard } = useGameStore()
  const ok = isPhaseOk(card.type, phase)
  const anim = ANIM_BY_TYPE[card.type] ?? 'anim-float'
  const badge = BADGE_COLORS[card.type] ?? { bg: '#111', color: '#fff', border: '#fff' }

  return (
    <div
      style={{
        width: 118, flexShrink: 0,
        background: 'var(--panel2)',
        border: `2px solid ${selected ? 'var(--yel)' : '#2a2a4a'}`,
        cursor: ok ? 'pointer' : 'not-allowed',
        position: 'relative',
        opacity: ok ? 1 : 0.25,
        filter: ok ? 'none' : 'grayscale(70%)',
        transition: 'transform 0.15s, border-color 0.15s',
        transform: selected ? 'translateY(-6px) scale(1.03)' : 'none',
        boxShadow: selected ? '0 0 12px rgba(255,238,0,0.4)' : 'none',
      }}
      onClick={() => ok && selectCard(index)}
      title={ok ? card.name : `Not available in ${phase} phase`}
    >
      {/* corner accents */}
      {[['0 0 0 0', 'border-top: 2px solid; border-left: 2px solid'], ['0 auto 0 0', ''], ['auto 0 0 auto', ''], ['auto auto 0 0', '']].map((_, i) => null)}

      {/* image */}
      <div style={{ height: 76, overflow: 'hidden', background: '#03030a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 6 }}>
        <div className={anim} style={{ width: 60, height: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          dangerouslySetInnerHTML={{ __html: getSprite(card) }}
        />
      </div>

      {/* body */}
      <div style={{ padding: '5px 6px 6px' }}>
        <div style={{
          fontFamily: "'Press Start 2P',monospace",
          fontSize: 5, padding: '2px 4px', marginBottom: 3,
          display: 'inline-block', letterSpacing: 1,
          background: badge.bg, color: badge.color,
          border: `1px solid ${badge.border}`,
        }}>
          {card.type.toUpperCase()}
        </div>
        <div style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 5, color: '#fff', marginBottom: 3, lineHeight: 1.5, minHeight: 18 }}>
          {card.name}
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.2 }}>{card.desc}</div>
      </div>

      {/* trash button */}
      <button
        style={{
          position: 'absolute', top: 3, right: 3,
          background: 'rgba(10,0,5,0.85)', border: '1px solid var(--red)',
          color: 'var(--red)', fontSize: 10, padding: '1px 4px', cursor: 'pointer', zIndex: 5,
        }}
        onClick={e => { e.stopPropagation(); trashCard(index) }}
        title="Discard"
      >🗑</button>
    </div>
  )
}
