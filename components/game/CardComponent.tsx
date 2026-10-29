'use client'
import { getSprite, isPhaseOk, cardPhaseLabel } from '@/lib/data'
import { useGameStore } from '@/store/gameStore'
import { skinFor, cardStyles, cardStats, triggersGenreBonus, TYPE_COLORS } from '@/lib/skins'
import type { Card, Phase } from '@/types/game'

const ANIM_BY_TYPE: Record<string, string> = {
  stage: 'anim-pulse', artist: 'anim-bounce', track: 'anim-float',
  hardware: 'anim-pulse', attack: 'anim-shake', defense: 'anim-pulse',
  collab: 'anim-bounce', sponsor: 'anim-float', viral: 'anim-shake', draw: 'anim-float',
}

interface Props {
  card: Card
  index: number
  selected: boolean
  phase: Phase
}

// the side panel registers this so hovering a card shows its full details
function inspect(card: Card | null) {
  const fn = (window as unknown as { __setInspected?: (c: Card | null) => void }).__setInspected
  fn?.(card)
}

// Shared layout for every skin: type + main stat / art / name / description /
// long stat. The skin (from the owner's genre) only changes the look.
export default function CardComponent({ card, index, selected, phase }: Props) {
  const { selectCard, trashCard, playerGenre } = useGameStore()
  const ok = isPhaseOk(card.type, phase)
  const st = cardStyles(skinFor(playerGenre))
  const stats = cardStats(card)
  const bonus = triggersGenreBonus(playerGenre, card)

  return (
    <div style={{ position: 'relative', width: 168, height: 296, flexShrink: 0 }}>
      {st.vinyl && (
        <div aria-hidden="true" style={st.vinyl}><div style={st.vinylLabel} /></div>
      )}
      <button
        type="button"
        className={`game-card${selected ? ' selected' : ''}`}
        style={{
          ...st.card,
          position: 'relative', width: '100%', height: '100%', boxSizing: 'border-box',
          padding: 10, display: 'flex', flexDirection: 'column', gap: 6, textAlign: 'left',
          cursor: ok ? 'pointer' : 'not-allowed',
          outline: selected ? '3px solid #ffee00' : 'none', outlineOffset: 3,
        }}
        onClick={() => ok && selectCard(index)}
        onMouseEnter={() => inspect(card)}
        onFocus={() => inspect(card)}
        aria-label={`${card.name}, ${card.type}, ${stats.long}${ok ? '' : `, playable in ${cardPhaseLabel(card.type)}`}`}
        aria-pressed={selected}
        aria-disabled={!ok}
      >
        {/* 1 · type + main stat */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: 48, flexShrink: 0, opacity: ok ? 1 : 0.6 }}>
          <span style={{ ...st.chip, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span aria-hidden="true" style={{ width: 8, height: 8, background: TYPE_COLORS[card.type] ?? '#fff', border: '1px solid #000' }} />
            {card.type.toUpperCase()}
          </span>
          <span style={{ ...st.badge, display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box', flexShrink: 0 }}>
            <span style={st.badgeText}>{stats.main}</span>
          </span>
        </div>

        {/* 2 · art (dims when the card belongs to another phase; the text doesn't) */}
        <div style={{ ...st.art, position: 'relative', overflow: 'hidden', height: 92, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className={anim(card)} style={{ ...st.sprite, width: 80, height: 80, opacity: ok ? 1 : 0.35, filter: ok ? st.sprite.filter : 'grayscale(80%)' }} aria-hidden="true"
            dangerouslySetInnerHTML={{ __html: getSprite(card) }}
          />
          {st.holo && ok && <div className="holo" aria-hidden="true" />}
          {bonus && <span className="card-bonus-tag" style={st.bonus} title="Feeds your genre bonus">BONUS</span>}
          {!ok && <span className="card-phase-tag">{cardPhaseLabel(card.type)}</span>}
        </div>

        {/* 3 · name */}
        <div style={{ ...st.name, minHeight: 36, display: 'flex', alignItems: 'center' }}>{card.name}</div>

        {/* 4 · description */}
        <div style={{ ...st.desc, flexGrow: 1, overflow: 'hidden' }}>{card.desc}</div>

        {/* 5 · long stat */}
        <div style={{ ...st.foot, minHeight: 20, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{stats.long}</div>
      </button>

      {/* discard */}
      <button
        type="button"
        className="card-trash"
        onClick={e => { e.stopPropagation(); trashCard(index) }}
        aria-label={`Discard ${card.name}`}
        title="Discard"
      >🗑</button>
    </div>
  )
}

function anim(card: Card) {
  return ANIM_BY_TYPE[card.type] ?? 'anim-float'
}
