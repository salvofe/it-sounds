'use client'
import { useEffect, useRef, useState } from 'react'
import { useGameStore } from '@/store/gameStore'
import { getSprite, TEMPLATES, COMBOS, PHASES, PHASE_HINTS, PHASE_HINTS_SHORT } from '@/lib/data'
import type { Card, Phase } from '@/types/game'

// ── Combo list ────────────────────────────────────────────────────────────────

function ComboList() {
  const { discovered } = useGameStore()
  return (
    <div style={{ fontSize: 20, lineHeight: 1.15 }}>
      {COMBOS.map(c => {
        const found = !!discovered[c.id]
        const fx = c.mult > 1 ? `×${c.mult}` : `+${c.bonus}k`
        return (
          <div key={c.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, padding: '3px 0', borderBottom: '1px solid #14142a', opacity: found ? 1 : 0.5 }}>
              <span style={{ color: found ? 'var(--yel)' : 'var(--muted)' }}>{found ? c.name : '??? COMBO'}</span>
              <span style={{ color: found ? 'var(--grn)' : 'var(--muted)', flexShrink: 0 }}>{found ? fx : '???'}</span>
            </div>
            {found && <div style={{ fontSize: 20, lineHeight: 1.1, color: '#b4bdd4', marginBottom: 4 }}>{c.desc}</div>}
          </div>
        )
      })}
    </div>
  )
}

// ── Card Database ─────────────────────────────────────────────────────────────

function CardDatabase() {
  const [open, setOpen] = useState(false)
  const [hovered, setHovered] = useState<(typeof TEMPLATES)[0] | null>(null)

  return (
    <div className="panel">
      <button type="button" aria-expanded={open}
        className="panel-title pt-c"
        style={{ background: 'none', border: 0, padding: '0 0 6px', boxSizing: 'border-box', width: '100%', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: open ? 10 : 0, borderBottom: open ? '2px dashed var(--border)' : '0' }}
        onClick={() => setOpen(v => !v)}
      >
        <span>CARD DATABASE</span>
        <span style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 11, color: 'var(--cyan)', whiteSpace: 'nowrap' }}>
          {open ? '− HIDE' : '+ SHOW'}
        </span>
      </button>
      {open && (
        <div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 20 }}>
            <thead>
              <tr>
                {['IMG', 'NAME', 'TYPE', 'EFFECT'].map(h => (
                  <th key={h} style={{ background: '#08081a', fontFamily: "'Press Start 2P',monospace", fontSize: 9, color: 'var(--cyan)', padding: 5, textAlign: 'left', borderBottom: '2px solid var(--border)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TEMPLATES.map((c, i) => (
                <tr key={i}
                  style={{ background: hovered === c ? '#0e0e24' : 'transparent', cursor: 'pointer' }}
                  onMouseEnter={() => setHovered(c)}
                  onMouseLeave={() => setHovered(null)}
                >
                  <td style={{ padding: '4px 5px', borderBottom: '1px solid #0e0e20', verticalAlign: 'middle' }}>
                    <div style={{ width: 26, height: 26, imageRendering: 'pixelated', border: '1px solid var(--border)', background: '#03030a', overflow: 'hidden' }}
                      dangerouslySetInnerHTML={{ __html: getSprite(c as Card) }}
                    />
                  </td>
                  <td style={{ padding: '4px 5px', borderBottom: '1px solid #0e0e20', color: '#fff', fontSize: 20, lineHeight: 1.05, verticalAlign: 'middle' }}>{c.name}</td>
                  <td style={{ padding: '4px 5px', borderBottom: '1px solid #0e0e20', color: 'var(--yel)', fontSize: 20, lineHeight: 1.05, verticalAlign: 'middle' }}>{c.type}</td>
                  <td style={{ padding: '4px 5px', borderBottom: '1px solid #0e0e20', color: '#b4bdd4', fontSize: 20, lineHeight: 1.05, verticalAlign: 'middle' }}>{c.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// Everything that used to sit in the side column, one click away from the table.
export default function Drawer() {
  const { drawerOpen, toggleDrawer, logEntries, commentary, phaseIdx, mode } = useGameStore()
  const logRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const wasOpen = useRef(false)
  useEffect(() => {
    if (drawerOpen) closeRef.current?.focus()
    else if (wasOpen.current) document.querySelector<HTMLElement>('[data-testid="drawer-toggle"]')?.focus()
    wasOpen.current = drawerOpen
  }, [drawerOpen])
  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight }, [logEntries, drawerOpen])
  const phase = PHASES[phaseIdx] as Phase
  const hint = (mode === 'short' && PHASE_HINTS_SHORT[phase]) || PHASE_HINTS[phase]
  return (
    <aside className={`drawer${drawerOpen ? ' open' : ''}`} data-testid="drawer" aria-hidden={!drawerOpen} aria-label="Game info">
      <div className="drawer-head">
        <span className="panel-title pt-c" style={{ border: 'none', margin: 0, padding: 0 }}>INFO</span>
        <button type="button" ref={closeRef} className="btn btn-x" onClick={toggleDrawer} aria-label="Close info">✕</button>
      </div>
      <section className="panel" data-testid="drawer-hint">
        <div className="panel-title pt-y">THIS PHASE</div>
        <div style={{ fontSize: 20, lineHeight: 1.4 }} dangerouslySetInnerHTML={{ __html: hint }} />
      </section>
      <section className="panel" data-testid="drawer-log">
        <div className="panel-title pt-g">TERMINAL LOG</div>
        <div className="log-box" ref={logRef}>{logEntries.map((e, i) => <div key={i}>&gt; {e}</div>)}</div>
      </section>
      <section className="panel" data-testid="drawer-commentary">
        <div className="panel-title pt-m">AI LIVE COMMENTARY</div>
        <div style={{ fontSize: 20, lineHeight: 1.4, color: '#ff88cc', fontStyle: 'italic' }}>{commentary}</div>
      </section>
      <section className="panel" data-testid="drawer-combos">
        <div className="panel-title pt-y">COMBOS<span className="panel-hint">Build stages to discover them.</span></div>
        <ComboList />
      </section>
      <section data-testid="drawer-db"><CardDatabase /></section>
    </aside>
  )
}
