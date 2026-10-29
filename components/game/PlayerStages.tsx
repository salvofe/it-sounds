'use client'
import { useGameStore } from '@/store/gameStore'
import { getSprite } from '@/lib/data'
import { skinFor } from '@/lib/skins'
import type { StageKey, StageSlot, StageState, Card } from '@/types/game'

function SlotView({
  sk, sl, card, label, hw = false, guest = false, moving = false,
}: {
  sk: StageKey; sl: StageSlot; card: Card | null; label: string
  hw?: boolean; guest?: boolean; moving?: boolean
}) {
  const { slotClick, pickup, startMove } = useGameStore()

  return (
    <div
      className={`slot${hw ? ' hw' : ''}${card ? ' filled' : ' empty'}`}
      style={moving ? { borderColor: 'var(--cyan)', boxShadow: '0 0 8px var(--cyan)' } : guest ? { borderColor: '#ff88ff', borderStyle: 'dashed' } : undefined}
      onClick={e => { e.stopPropagation(); slotClick(sk, sl) }}
    >
      {card && (
        <div className="slot-thumb" dangerouslySetInnerHTML={{ __html: getSprite(card) }} />
      )}
      <span className="slot-txt">{label}</span>
      {card && sl !== 'stage' && (
        <span
          style={{ color: 'var(--cyan)', fontSize: 16, cursor: 'pointer', flexShrink: 0 }}
          title="Move (free)"
          onClick={e => { e.stopPropagation(); startMove(sk, sl) }}
        >↔</span>
      )}
      {card && (
        <span
          style={{ color: 'var(--red)', fontSize: 16, cursor: 'pointer', flexShrink: 0 }}
          title="Return to hand"
          onClick={e => { e.stopPropagation(); pickup(sk, sl) }}
        >↩</span>
      )}
    </div>
  )
}

function StagePanel({ sk }: { sk: StageKey }) {
  const { playerStages, focusedStage, unlockedStages, setFocus, moveMode, playerGenre } = useGameStore()
  const s: StageState = playerStages[sk]
  const skin = skinFor(playerGenre)
  const focused = focusedStage === sk
  const locked = !unlockedStages[sk]

  if (locked) {
    return (
      <div style={{ background: 'var(--panel2)', border: '2px solid var(--border)', borderTop: '3px solid var(--cyan)', padding: 10, opacity: 0.35 }}>
        <div style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 10, color: 'var(--muted)', textAlign: 'right', marginBottom: 4 }}>
          STAGE {sk.toUpperCase()} — LOCKED (round 2)
        </div>
        <div style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed var(--border)', background: '#03030a', fontFamily: "'Press Start 2P',monospace", fontSize: 10, color: 'var(--muted)' }}>
          LOCKED
        </div>
      </div>
    )
  }

  const moving = (sl: StageSlot) => !!moveMode && moveMode.sk === sk && moveMode.sl === sl

  return (
    <div
      style={{
        background: 'var(--panel2)',
        border: `2px solid ${focused ? 'var(--yel)' : 'var(--border)'}`,
        borderTop: `5px solid ${skin.main}`,
        padding: 10,
        cursor: 'pointer',
        position: 'relative',
        boxShadow: focused ? '0 0 0 1px var(--yel)' : 'none',
      }}
      onClick={() => setFocus(sk)}
    >
      {/* shield badge */}
      {(s.protected || s.decoy) && (
        <div style={{ position: 'absolute', top: 6, left: 6, background: '#021408', border: `1px solid ${s.decoy && !s.protected ? 'var(--yel)' : 'var(--grn)'}`, color: s.decoy && !s.protected ? 'var(--yel)' : 'var(--grn)', fontFamily: "'Press Start 2P',monospace", fontSize: 9, padding: '2px 4px', zIndex: 5 }}>
          {s.decoy && !s.protected ? '🕵 DECOY' : 'SHIELDED'}
        </div>
      )}

      <div style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 10, color: 'var(--yel)', textAlign: 'right', marginBottom: 4 }}>
        STAGE {sk.toUpperCase()}{focused ? ' ✦FOCUSED' : ''}
      </div>

      {/* stage banner */}
      {s.stage ? (
        <div style={{ width: '100%', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)', marginBottom: 6, background: '#03030a', padding: 4 }}
          dangerouslySetInnerHTML={{ __html: getSprite(s.stage) }}
        />
      ) : (
        <div style={{ width: '100%', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed var(--border)', marginBottom: 6, background: '#03030a', fontFamily: "'Press Start 2P',monospace", fontSize: 10, color: 'var(--muted)' }}>
          NO STAGE — PLAY A STAGE CARD
        </div>
      )}

      <SlotView sk={sk} sl="stage" card={s.stage} label={s.stage ? s.stage.name : 'EMPTY — play a STAGE card'} />

      {/* artists row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 4, marginTop: 4 }}>
        {(['artist1', 'artist2', 'artist3'] as const).map(sl => (
          <SlotView key={sl} sk={sk} sl={sl} card={s[sl]} label={s[sl] ? s[sl]!.name : `A${sl.slice(-1)}:empty`} moving={moving(sl)} />
        ))}
      </div>

      <SlotView sk={sk} sl="hardware" card={s.hardware} label={s.hardware ? `${s.hardware.name} ×${s.hardware.multiplier}` : 'HW: empty (multiplier)'} hw moving={moving('hardware')} />

      {/* bonus/guest slot */}
      <div
        className={`slot${s.guest ? ' filled' : ' empty'}`}
        style={{ borderColor: '#ff88ff', borderStyle: 'dashed', marginTop: 4 }}
        onClick={e => { e.stopPropagation(); useGameStore.getState().slotClick(sk, 'guest') }}
      >
        {s.guest && <div className="slot-thumb" dangerouslySetInnerHTML={{ __html: getSprite(s.guest) }} />}
        <span className="slot-txt">{s.guest ? `⭐ ${s.guest.name}` : '⭐ BONUS SLOT (Collab/Viral/Sponsor)'}</span>
        {s.guest && (
          <>
            <span style={{ color: 'var(--cyan)', fontSize: 16, cursor: 'pointer', flexShrink: 0 }} onClick={e => { e.stopPropagation(); useGameStore.getState().startMove(sk, 'guest') }}>↔</span>
            <span style={{ color: 'var(--red)', fontSize: 16, cursor: 'pointer', flexShrink: 0 }} onClick={e => { e.stopPropagation(); useGameStore.getState().pickup(sk, 'guest') }}>↩</span>
          </>
        )}
      </div>

      {/* tracks */}
      <SlotView sk={sk} sl="track" card={s.track} label={s.track ? s.track.name : 'T1: empty — play a TRACK'} moving={moving('track')} />
      {s.stage && (s.stage.maxTracks ?? 1) >= 2 && (
        <SlotView sk={sk} sl="track2" card={s.track2} label={s.track2 ? s.track2.name : 'T2: empty'} moving={moving('track2')} />
      )}
      {s.stage && (s.stage.maxTracks ?? 1) >= 3 && (
        <SlotView sk={sk} sl="track3" card={s.track3} label={s.track3 ? s.track3.name : 'T3: empty'} moving={moving('track3')} />
      )}

      {/* score bar */}
      <div style={{
        marginTop: 6, padding: '4px 5px', textAlign: 'center',
        fontFamily: "'Press Start 2P',monospace", fontSize: 10,
        background: s.current >= s.threshold && s.threshold > 0 ? '#041a0a' : '#1a0505',
        color: s.current >= s.threshold && s.threshold > 0 ? 'var(--grn)' : 'var(--red)',
        border: `1px solid ${s.current >= s.threshold && s.threshold > 0 ? '#0a3a1a' : '#3a0a0a'}`,
      }}>
        {s.threshold > 0
          ? `FANS: ${s.current.toFixed(1)}k / NEED: ${s.threshold.toFixed(1)}k${s.bonus > 0 ? ` (+${s.bonus.toFixed(1)} bonus)` : ''}`
          : 'NO STAGE PLACED'}
      </div>

      {/* active combos */}
      {s.combos.length > 0 && (
        <div style={{ marginTop: 4, fontFamily: "'Press Start 2P',monospace", fontSize: 9, color: 'var(--yel)', textAlign: 'center', textShadow: '0 0 6px var(--yel)' }}>
          ⚡ {s.combos.map(c => c.name).join(' + ')}
        </div>
      )}
    </div>
  )
}

export default function PlayerStages() {
  return (
    <div className="panel">
      <div className="px-corner tl" /><div className="px-corner tr" />
      <div className="px-corner bl" /><div className="px-corner br" />
      <div className="panel-title pt-c">▶ YOUR STAGES — Click a stage to focus it, then play cards ▶</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
        {(['s1', 's2', 's3'] as StageKey[]).map(sk => <StagePanel key={sk} sk={sk} />)}
      </div>
    </div>
  )
}
