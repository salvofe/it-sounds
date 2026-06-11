'use client'
import { useGameStore } from '@/store/gameStore'
import { getPhaseSprite } from '@/lib/data'

const PHASE_COLORS: Record<string, string> = {
  ARRANGEMENT: '#ffee00',
  SOUNDCHECK: '#00ffff',
  'LIVE SHOW': '#00ff66',
  RESULTS: '#ff00aa',
}
const PHASE_LABELS: Record<string, string> = {
  ARRANGEMENT: 'BUILD YOUR LINEUP',
  SOUNDCHECK: 'TUNE THE SOUND',
  'LIVE SHOW': 'SABOTAGE TIME',
  RESULTS: 'COUNT THE FANS',
}

export default function PhaseTransition() {
  const { showPhaseTransition, phaseTransitionName } = useGameStore()
  if (!showPhaseTransition) return null

  const col = PHASE_COLORS[phaseTransitionName] ?? '#ffee00'
  const lbl = PHASE_LABELS[phaseTransitionName] ?? 'ENTERING'

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 6000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(4,4,12,0.85)',
      animation: 'pt-flash 1.1s ease-out forwards',
      pointerEvents: 'none',
    }}>
      {/* scan line */}
      <div style={{
        position: 'absolute', left: 0, width: '100%', height: 3,
        background: col, opacity: 0.5,
        animation: 'pt-scan 1.1s linear',
      }} />
      {/* banner */}
      <div style={{
        background: `linear-gradient(90deg,transparent,var(--panel) 15%,var(--panel) 85%,transparent)`,
        borderTop: `3px solid ${col}`, borderBottom: `3px solid ${col}`,
        width: '100%', padding: '28px 0', textAlign: 'center',
        animation: 'pt-slide 1.1s cubic-bezier(0.2,0.9,0.2,1)',
      }}>
        {/* sprite */}
        <div style={{ width: 72, height: 72, margin: '0 auto 14px', animation: 'pt-sprite-spin 1.1s ease-out' }}
          dangerouslySetInnerHTML={{ __html: getPhaseSprite(phaseTransitionName) }}
        />
        <div style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 9, color: 'var(--muted)', letterSpacing: 3, marginBottom: 10 }}>{lbl}</div>
        <div style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 20, letterSpacing: 4, color: col, textShadow: `0 0 16px ${col}` }}>
          {phaseTransitionName}
        </div>
      </div>
    </div>
  )
}
