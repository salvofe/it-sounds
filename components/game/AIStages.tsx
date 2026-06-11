'use client'
import { useGameStore } from '@/store/gameStore'
import { getSprite } from '@/lib/data'
import type { StageKey, StageState, Card } from '@/types/game'

function AISlot({ card, label, hw = false }: { card: Card | null; label: string; hw?: boolean }) {
  return (
    <div className={`slot${hw ? ' hw' : ''}${card ? ' filled' : ' empty'}`} style={{ cursor: 'default' }}>
      {card && <div className="slot-thumb" dangerouslySetInnerHTML={{ __html: getSprite(card) }} />}
      <span className="slot-txt">{label}</span>
    </div>
  )
}

function AIStagePanel({ sk }: { sk: StageKey }) {
  const { aiStages, targetMode, aiClick } = useGameStore()
  const s: StageState = aiStages[sk]

  return (
    <div
      style={{
        background: 'var(--panel2)',
        border: `2px solid ${targetMode ? 'var(--red)' : 'var(--border)'}`,
        borderTop: '3px solid var(--mag)',
        padding: 10,
        position: 'relative',
        cursor: targetMode ? 'crosshair' : 'default',
        boxShadow: targetMode ? '0 0 8px var(--red)' : 'none',
      }}
      onClick={() => targetMode && aiClick(sk)}
    >
      {s.protected && (
        <div style={{ position: 'absolute', top: 6, left: 6, background: '#021408', border: '1px solid var(--grn)', color: 'var(--grn)', fontFamily: "'Press Start 2P',monospace", fontSize: 4, padding: '2px 4px', zIndex: 5 }}>
          🛡 SHIELDED
        </div>
      )}

      <div style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 6, color: 'var(--mag)', textAlign: 'right', marginBottom: 4 }}>
        AI {sk.toUpperCase()}{targetMode ? ' — CLICK TO ATTACK' : ''}
      </div>

      {s.stage ? (
        <div style={{ width: '100%', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)', marginBottom: 6, background: '#03030a', padding: 4 }}
          dangerouslySetInnerHTML={{ __html: getSprite(s.stage) }}
        />
      ) : (
        <div style={{ width: '100%', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed var(--border)', marginBottom: 6, background: '#03030a', fontFamily: "'Press Start 2P',monospace", fontSize: 6, color: 'var(--muted)' }}>
          AI STAGE EMPTY
        </div>
      )}

      <AISlot card={s.stage} label={s.stage ? s.stage.name : 'empty'} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 4, marginTop: 4 }}>
        {(['artist1', 'artist2', 'artist3'] as const).map(sl => (
          <AISlot key={sl} card={s[sl]} label={s[sl] ? s[sl]!.name : `A${sl.slice(-1)}:—`} />
        ))}
      </div>

      <AISlot card={s.hardware} label={s.hardware ? `${s.hardware.name} ×${s.hardware.multiplier}` : 'HW: empty'} hw />
      <AISlot card={s.track} label={s.track ? s.track.name : 'T1: empty'} />

      <div style={{
        marginTop: 6, padding: '4px 5px', textAlign: 'center',
        fontFamily: "'Press Start 2P',monospace", fontSize: 6,
        background: s.current >= s.threshold && s.threshold > 0 ? '#041a0a' : '#1a0505',
        color: s.current >= s.threshold && s.threshold > 0 ? 'var(--grn)' : 'var(--red)',
        border: `1px solid ${s.current >= s.threshold && s.threshold > 0 ? '#0a3a1a' : '#3a0a0a'}`,
      }}>
        {s.threshold > 0 ? `FANS: ${s.current.toFixed(1)}k / ${s.threshold.toFixed(1)}k` : 'NO STAGE'}
      </div>
    </div>
  )
}

export default function AIStages() {
  return (
    <div className="panel" style={{ borderColor: '#2a0a1a' }}>
      <div className="px-corner tl" style={{ borderColor: 'var(--mag)' }} />
      <div className="px-corner tr" style={{ borderColor: 'var(--mag)' }} />
      <div className="px-corner bl" style={{ borderColor: 'var(--mag)' }} />
      <div className="px-corner br" style={{ borderColor: 'var(--mag)' }} />
      <div className="panel-title pt-m">▶ AI OPPONENT STAGES — Play Attack cards here during Live Show ▶</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
        {(['s1', 's2', 's3'] as StageKey[]).map(sk => <AIStagePanel key={sk} sk={sk} />)}
      </div>
    </div>
  )
}
