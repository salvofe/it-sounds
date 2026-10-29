'use client'
import { getSprite, cardPhaseLabel } from '@/lib/data'
import { skinFor, cardStyles, cardStats, triggersGenreBonus, TYPE_COLORS, type CardStyles } from '@/lib/skins'
import type { Card as CardT } from '@/types/game'

export type CardSize = 'hand' | 'field' | 'preview'

const ANIM_BY_TYPE: Record<string, string> = {
  stage: 'anim-pulse', artist: 'anim-bounce', track: 'anim-float',
  hardware: 'anim-pulse', attack: 'anim-shake', defense: 'anim-pulse',
  collab: 'anim-bounce', sponsor: 'anim-float', viral: 'anim-shake', draw: 'anim-float',
}

interface Props {
  card: CardT
  genre: string      // owner's genre: picks the skin
  size: CardSize
  playable?: boolean // hand: false dims the art and shows the phase it belongs to
  selected?: boolean
}

// Every card on screen: same information layout in every skin (type + main stat,
// art, name, description, long stat); `field` is the compact version for stages.
export default function Card({ card, genre, size, playable = true, selected = false }: Props) {
  const st = cardStyles(skinFor(genre))
  if (size === 'field') return <FieldFace card={card} st={st} />
  const face = <FullFace card={card} st={st} genre={genre} playable={playable} selected={selected} />
  if (size === 'hand') return face
  return (
    <div style={{ width: 252, height: 444 }}>
      <div style={{ transform: 'scale(1.5)', transformOrigin: 'top left' }}>{face}</div>
    </div>
  )
}

function FullFace({ card, st, genre, playable, selected }: { card: CardT; st: CardStyles; genre: string; playable: boolean; selected: boolean }) {
  const stats = cardStats(card)
  const bonus = triggersGenreBonus(genre, card)
  return (
    <div style={{ position: 'relative', width: 168, height: 296 }}>
      {st.vinyl && <div aria-hidden="true" style={st.vinyl}><div style={st.vinylLabel} /></div>}
      <div className="card-face" style={{
        ...st.card, position: 'relative', width: '100%', height: '100%', boxSizing: 'border-box',
        padding: 10, display: 'flex', flexDirection: 'column', gap: 6, textAlign: 'left',
        outline: selected ? '3px solid #ffee00' : 'none', outlineOffset: 3,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: 48, flexShrink: 0, opacity: playable ? 1 : 0.6 }}>
          <span style={{ ...st.chip, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span aria-hidden="true" style={{ width: 8, height: 8, background: TYPE_COLORS[card.type] ?? '#fff', border: '1px solid #000' }} />
            {card.type.toUpperCase()}
          </span>
          <span style={{ ...st.badge, display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box', flexShrink: 0 }}>
            <span style={st.badgeText}>{stats.main}</span>
          </span>
        </div>
        <div style={{ ...st.art, position: 'relative', overflow: 'hidden', height: 92, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className={ANIM_BY_TYPE[card.type] ?? 'anim-float'} aria-hidden="true"
            style={{ ...st.sprite, width: 80, height: 80, opacity: playable ? 1 : 0.35, filter: playable ? st.sprite.filter : 'grayscale(80%)' }}
            dangerouslySetInnerHTML={{ __html: getSprite(card) }} />
          {st.holo && playable && <div className="holo" aria-hidden="true" />}
          {bonus && <span className="card-bonus-tag" style={st.bonus} title="Feeds your genre bonus">BONUS</span>}
          {!playable && <span className="card-phase-tag">{cardPhaseLabel(card.type)}</span>}
        </div>
        <div style={{ ...st.name, minHeight: 36, display: 'flex', alignItems: 'center' }}>{card.name}</div>
        <div style={{ ...st.desc, flexGrow: 1, overflow: 'hidden' }}>{card.desc}</div>
        <div style={{ ...st.foot, minHeight: 20, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{stats.long}</div>
      </div>
    </div>
  )
}

function FieldFace({ card, st }: { card: CardT; st: CardStyles }) {
  const stats = cardStats(card)
  return (
    <div className="card-face" style={{
      ...st.card, boxShadow: '0 4px 10px rgba(0,0,0,0.6)', width: 88, height: 132, boxSizing: 'border-box',
      padding: 5, display: 'flex', flexDirection: 'column', gap: 3, overflow: 'hidden', position: 'relative',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: 28 }}>
        <span aria-hidden="true" style={{ width: 10, height: 10, background: TYPE_COLORS[card.type] ?? '#fff', border: '1px solid #000' }} />
        <span style={{ ...st.badge, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box' }}>
          <span style={{ fontFamily: "'VT323', monospace", fontSize: 20, lineHeight: 1 }}>{stats.main}</span>
        </span>
      </div>
      <div style={{ ...st.art, height: 42, flexShrink: 0, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 34, height: 34 }} aria-hidden="true" dangerouslySetInnerHTML={{ __html: getSprite(card) }} />
      </div>
      <div style={{ fontFamily: "'VT323', monospace", fontSize: 20, lineHeight: 0.9, color: st.name.color, overflow: 'hidden', maxHeight: 36 }}>{card.name}</div>
    </div>
  )
}
