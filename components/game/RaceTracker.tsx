'use client'
import { useGameStore } from '@/store/gameStore'
import { RULES } from '@/lib/engine'

export default function RaceTracker() {
  const { playerBestRound, aiBestRound, mode, roundWins, round } = useGameStore()
  if (mode === 'short') {
    const w = RULES.short.win
    const need = w.kind === 'bestOf' ? w.wins : 3
    const maxRounds = w.kind === 'bestOf' ? w.maxRounds : 5
    const pips = (n: number, col: string) => Array.from({ length: need }, (_, i) => (
      <span key={i} aria-hidden="true" style={{ width: 18, height: 18, display: 'inline-block', border: `2px solid ${col}`, background: i < n ? col : 'transparent', marginRight: 6 }} />
    ))
    return (
      <div className="race-bar-wrap" aria-label={`Round ${round} of ${maxRounds}. You ${roundWins[0]}, AI ${roundWins[1]} round wins. First to ${need} wins.`}>
        <div style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 11, color: 'var(--muted)', marginBottom: 8, textAlign: 'center' }}>
          ROUND {round} / {maxRounds} · FIRST TO {need} WINS
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 40, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 11, color: 'var(--grn)' }}>YOU</span>{pips(roundWins[0], 'var(--grn)')}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 11, color: 'var(--mag)' }}>AI</span>{pips(roundWins[1], 'var(--mag)')}
          </div>
        </div>
      </div>
    )
  }
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
