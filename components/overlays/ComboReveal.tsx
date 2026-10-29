'use client'
import { useGameStore } from '@/store/gameStore'

export default function ComboReveal() {
  const { comboReveal, dismissComboReveal } = useGameStore()
  if (!comboReveal) return null

  const { combo, isNew } = comboReveal
  const fx = combo.mult > 1 ? `×${combo.mult} multiplier` : `+${combo.bonus}k fans`

  return (
    <div
      onClick={dismissComboReveal}
      style={{
        position: 'fixed', top: '38%', left: '50%',
        transform: 'translate(-50%,-50%)',
        zIndex: 6600,
        animation: 'combo-pop 1.8s cubic-bezier(0.2,1.2,0.3,1) forwards',
        cursor: 'pointer',
      }}
    >
      <div style={{
        background: 'linear-gradient(135deg,#1a0030,#0a0020)',
        border: '3px solid var(--yel)',
        padding: '20px 36px',
        textAlign: 'center',
        boxShadow: '0 0 40px rgba(255,238,0,0.5)',
      }}>
        <div style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 12, color: 'var(--cyan)', letterSpacing: 2, marginBottom: 10 }}>
          {isNew ? '⚡ COMBO DISCOVERED!' : '⚡ COMBO ACTIVE'}
        </div>
        <div style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 24, color: 'var(--yel)', letterSpacing: 3, textShadow: '0 0 16px var(--yel)', marginBottom: 8 }}>
          {combo.name}
        </div>
        <div style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 16, color: 'var(--grn)', textShadow: '0 0 10px var(--grn)' }}>
          {fx}
        </div>
        <div style={{ fontSize: 16, color: 'var(--muted)', marginTop: 6 }}>{combo.desc}</div>
      </div>
    </div>
  )
}
