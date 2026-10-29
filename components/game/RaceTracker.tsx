'use client'
import { useGameStore } from '@/store/gameStore'

export default function RaceTracker() {
  const { playerBestRound, aiBestRound } = useGameStore()
  const TARGET = 20
  const pPct = Math.min(100, (playerBestRound / TARGET) * 100)
  const aPct = Math.min(100, (aiBestRound / TARGET) * 100)

  return (
    <div className="race-bar-wrap">
      <div style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 10, color: 'var(--muted)', marginBottom: 6, textAlign: 'center' }}>
        ◀ RACE TO 20k FANS (best single round) ▶
      </div>
      {[
        { label: 'YOU', pct: pPct, val: playerBestRound, col: 'var(--grn)' },
        { label: 'AI', pct: aPct, val: aiBestRound, col: 'var(--mag)' },
      ].map(({ label, pct, val, col }) => (
        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
          <span style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 10, color: col, width: 38 }}>{label}</span>
          <div style={{ flex: 1, height: 14, background: '#0a0a18', border: '1px solid var(--border)', position: 'relative' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: col, transition: 'width 0.4s' }} />
            <div style={{ position: 'absolute', right: 4, top: 0, fontSize: 16, color: '#fff', lineHeight: '14px' }}>
              {val.toFixed(1)}k
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
