'use client'
import type { MouseEvent } from 'react'
import { PHASES } from '@/lib/data'
import { useGameStore } from '@/store/gameStore'
import Card from './Card'
import { anchorOf } from './anchor'
import type { Card as CardT, StageKey, StageSlot, StageState } from '@/types/game'

const ORDER: StageSlot[] = ['stage', 'artist1', 'artist2', 'artist3', 'hardware', 'track', 'track2', 'track3', 'guest']

// One stage on the table: its cards stacked, score, defences; yours can be focused,
// the AI's become targets in attack mode.
export default function StageZone({ owner, sk }: { owner: 'me' | 'ai'; sk: StageKey }) {
  const st = useGameStore()
  const s: StageState = owner === 'me' ? st.playerStages[sk] : st.aiStages[sk]
  const genre = owner === 'me' ? st.playerGenre : st.aiGenre
  const locked = owner === 'me' && !st.unlockedStages[sk]
  const focused = owner === 'me' && st.focusedStage === sk
  const target = owner === 'ai' && st.targetMode
  const passes = s.threshold > 0 && s.current >= s.threshold
  const cards = ORDER.flatMap(sl => (s[sl] ? [{ sl, card: s[sl] as CardT }] : []))

  function activate() {
    if (owner === 'ai') { if (st.targetMode) st.aiClick(sk); return }
    if (locked) return
    if (st.moveMode) { st.dropOnStage(sk); return }
    st.setFocus(sk)
  }
  const name = owner === 'me' ? sk.toUpperCase() : `AI ${sk.toUpperCase()}`
  const score = s.threshold > 0 ? `${s.current.toFixed(1)}k / ${s.threshold.toFixed(1)}k${passes ? ' ✓' : ''}${s.boost > 0 ? ` (+${s.boost}k boost)` : ''}`
    : locked ? 'Opens in round 2' : owner === 'me' ? 'Drop a STAGE here' : 'Empty'
  const headLabel = owner === 'ai'
    ? (target ? `Attack ${name}` : `${name}, ${score}`)
    : (locked ? `${name} locked` : st.moveMode ? `Move card to ${name}` : `Focus ${name}, ${score}`)

  return (
    <div data-testid={`zone-${owner}-${sk}`}
      className={`zone zone-${owner}${focused ? ' focused' : ''}${target ? ' target' : ''}${passes ? ' passes' : ''}${locked ? ' locked' : ''}`}
      onClick={activate}>
      <button type="button" className="zone-head" aria-label={headLabel} aria-pressed={owner === 'me' ? focused : undefined}
        disabled={locked || (owner === 'ai' && !target)} onClick={e => { e.stopPropagation(); activate() }}>
        <span className="zone-label">{name}{focused ? ' · FOCUS' : ''}</span>
        {(s.protected || s.decoy) && <span className="zone-shield">{s.protected ? 'SHIELD' : 'DECOY'}</span>}
        <span className="zone-score num">{score}</span>
      </button>
      <div className="zone-cards">
        {cards.map(({ sl, card }) => (
          <FieldSlot key={sl} owner={owner} sk={sk} sl={sl} card={card} genre={genre}
            moving={!!st.moveMode && st.moveMode.sk === sk && st.moveMode.sl === sl} />
        ))}
      </div>
      {s.combos.length > 0 && <div className="zone-combos">⚡ {s.combos.map(c => c.name).join(' + ')}</div>}
      {owner === 'me' && st.shop && s.stage && <ZoneShop sk={sk} s={s} />}
    </div>
  )
}

function FieldSlot({ owner, sk, sl, card, genre, moving }: { owner: 'me' | 'ai'; sk: StageKey; sl: StageSlot; card: CardT; genre: string; moving: boolean }) {
  const { pickup, startMove, setPreview } = useGameStore()
  const show = (e: MouseEvent<HTMLDivElement>) => setPreview({ card, owner, anchor: anchorOf(e.currentTarget) })
  return (
    <div className={`field-slot${moving ? ' moving' : ''}`} data-testid={`field-card-${owner}-${sk}-${sl}`}
      onMouseEnter={show} onMouseLeave={() => setPreview(null)}>
      <div className="field-card-inner"><Card card={card} genre={genre} size="field" /></div>
      {owner === 'me' && (
        <div className="field-actions" onClick={e => e.stopPropagation()}>
          {sl !== 'stage' && (
            <button type="button" data-testid={`move-me-${sk}-${sl}`} aria-label={`Move ${card.name}`} title="Move (free)"
              onClick={() => startMove(sk, sl)}>↔</button>
          )}
          <button type="button" data-testid={`pickup-me-${sk}-${sl}`} aria-label={`Return ${card.name} to hand`} title="Return to hand"
            onClick={() => pickup(sk, sl)}>↩</button>
        </div>
      )}
    </div>
  )
}

function ZoneShop({ sk, s }: { sk: StageKey; s: StageState }) {
  const { shop, playerWallet, actionsLeft, phaseIdx, boost, upgrade } = useGameStore()
  if (!shop) return null
  const phase = PHASES[phaseIdx]
  const noAct = actionsLeft <= 0 ? 'No actions left' : null
  const boostWhy = phase !== 'LIVE SHOW' ? 'Live Show only'
    : !(s.artist1 || s.artist2 || s.artist3) ? 'Needs an artist'
    : s.boost + shop.boost.amount > shop.boost.maxPerStage ? `Max +${shop.boost.maxPerStage}k`
    : playerWallet < shop.boost.cost ? `Need ${shop.boost.cost} Hype` : noAct
  const upWhy = phase !== 'SOUNDCHECK' && phase !== 'LIVE SHOW' ? 'Soundcheck / Live Show'
    : s.upgraded ? 'Already upgraded'
    : playerWallet < shop.upgrade.cost ? `Need ${shop.upgrade.cost} Hype` : noAct
  const K = sk.toUpperCase()
  return (
    <div className="zone-shop" onClick={e => e.stopPropagation()}>
      <button type="button" className="btn btn-m" data-testid={`boost-${sk}`} disabled={!!boostWhy} title={boostWhy ?? ''}
        aria-label={`Boost ${K} +${shop.boost.amount}k for ${shop.boost.cost} Hype${boostWhy ? `: ${boostWhy}` : ''}`} onClick={() => boost(sk)}>
        BOOST +{shop.boost.amount}k · {shop.boost.cost}
      </button>
      <button type="button" className="btn btn-c" data-testid={`upgrade-threshold-${sk}`} disabled={!!upWhy} title={upWhy ?? `Fans needed −${shop.upgrade.thresholdCut}k`}
        aria-label={`${K}: fans needed −${shop.upgrade.thresholdCut}k for ${shop.upgrade.cost} Hype${upWhy ? `: ${upWhy}` : ''}`} onClick={() => upgrade(sk, 'threshold')}>
        −{shop.upgrade.thresholdCut}k NEED · {shop.upgrade.cost}
      </button>
      <button type="button" className="btn btn-c" data-testid={`upgrade-mult-${sk}`} disabled={!!upWhy} title={upWhy ?? `Multiplier +${shop.upgrade.multBonus}`}
        aria-label={`${K}: multiplier +${shop.upgrade.multBonus} for ${shop.upgrade.cost} Hype${upWhy ? `: ${upWhy}` : ''}`} onClick={() => upgrade(sk, 'mult')}>
        ×+{shop.upgrade.multBonus} · {shop.upgrade.cost}
      </button>
    </div>
  )
}
