'use client'
import { useGameStore } from '@/store/gameStore'
import { PHASES, PHASE_HINTS, PHASE_HINTS_SHORT } from '@/lib/data'
import type { Phase } from '@/types/game'

const NEXT_LABELS: Record<Phase, string> = {
  ARRANGEMENT: 'SOUNDCHECK▶',
  SOUNDCHECK: 'START SHOW▶',
  'LIVE SHOW': 'CALCULATE▶',
  RESULTS: 'NEW ROUND▶',
}

const PHASE_COLORS: Record<Phase, string> = {
  ARRANGEMENT: 'var(--yel)',
  SOUNDCHECK: 'var(--cyan)',
  'LIVE SHOW': 'var(--grn)',
  RESULTS: 'var(--mag)',
}

export default function PhaseBar() {
  const { phaseIdx, nextPhase, actionsLeft, maxActions, mode } = useGameStore()
  const phase = PHASES[phaseIdx] as Phase
  const col = PHASE_COLORS[phase]

  const actionDots = Array.from({ length: maxActions }, (_, i) =>
    i < actionsLeft ? '▣' : '▢'
  ).join('')

  return (
    <>
      {/* Phase strip */}
      <div style={{
        background: 'var(--panel2)',
        borderBottom: `2px solid ${col}`,
        padding: '7px 14px',
        display: 'flex',
        gap: 8,
        alignItems: 'center',
        flexWrap: 'wrap',
      }}>
        <span style={{ fontFamily: "'Press Start 2P',monospace", color: col, fontSize: 12, flex: 1, letterSpacing: 1 }}>
          PHASE: {phase}
        </span>

        {/* pip indicators */}
        <div style={{ display: 'flex', gap: 4 }}>
          {PHASES.map((p, i) => (
            <div key={p} style={{
              width: 10, height: 10,
              border: `2px solid ${i < phaseIdx ? 'var(--grn)' : i === phaseIdx ? col : 'var(--muted)'}`,
              background: i < phaseIdx ? 'var(--grn)' : i === phaseIdx ? col : 'transparent',
              boxShadow: i === phaseIdx ? `0 0 6px ${col}` : 'none',
            }} title={p} />
          ))}
        </div>

        {/* actions */}
        <span style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 11, color: actionsLeft > 0 ? 'var(--grn)' : 'var(--red)' }}>
          ACT: {actionDots}
        </span>

        <button className="btn btn-y" style={{ fontSize: 10, padding: '5px 12px' }} onClick={nextPhase}>
          {NEXT_LABELS[phase]}
        </button>
      </div>

      {/* Hint bar */}
      <div style={{
        background: '#04040e',
        borderBottom: `2px solid ${col}`,
        padding: '8px 14px',
        fontSize: 20,
        lineHeight: 1.5,
        display: 'flex',
        gap: 10,
        alignItems: 'flex-start',
      }}>
        <span style={{ fontSize: 26, flexShrink: 0, marginTop: 2 }}>💡</span>
        <span dangerouslySetInnerHTML={{ __html: (mode === 'short' && PHASE_HINTS_SHORT[phase]) || PHASE_HINTS[phase] }} />
      </div>
    </>
  )
}
