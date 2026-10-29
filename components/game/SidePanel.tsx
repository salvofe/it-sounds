'use client'
import { useState, useRef, useEffect } from 'react'
import { useGameStore } from '@/store/gameStore'
import { getSprite, TEMPLATES, COMBOS, cardPhaseLabel } from '@/lib/data'
import type { Card } from '@/types/game'

// ── Inspector ─────────────────────────────────────────────────────────────────

function Inspector({ card }: { card: Card | null }) {
  if (!card) {
    return <div style={{ padding: 10, color: 'var(--muted)', fontSize: 20 }}>Nothing selected yet.</div>
  }
  return (
    <div>
      <div style={{ width: '100%', height: 88, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#03030a', padding: 8 }}>
        <div style={{ width: 80, height: 80 }} dangerouslySetInnerHTML={{ __html: getSprite(card) }} />
      </div>
      <div style={{ padding: 8, fontSize: 20, lineHeight: 1.3 }}>
        <div style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 12, lineHeight: 1.6, color: 'var(--cyan)', marginBottom: 3 }}>{card.name}</div>
        <div style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 10, color: 'var(--muted)', marginBottom: 6 }}>{card.type.toUpperCase()}</div>
        <div style={{ color: 'var(--text)' }}>{card.desc}</div>
        {card.talent && <div style={{ color: 'var(--yel)', marginTop: 3 }}>Talent: +{(card.talent / 100).toFixed(2)}k fans</div>}
        {card.power && <div style={{ color: 'var(--purple)', marginTop: 3 }}>Track power: +{card.power}k fans</div>}
        {card.multiplier && <div style={{ color: 'var(--orange)', marginTop: 3 }}>Stage multiplier: ×{card.multiplier}</div>}
        {card.threshold && <div style={{ color: 'var(--cyan)', marginTop: 3 }}>Score threshold: {card.threshold}k fans</div>}
        {card.cost != null && card.cost > 0 && <div style={{ color: 'var(--mag)', marginTop: 3 }}>Hype cost: {card.cost}k</div>}
        {card.draw && <div style={{ color: 'var(--cyan)', marginTop: 3 }}>Draws {card.draw} cards</div>}
        <div style={{ color: 'var(--muted)', fontSize: 17, marginTop: 4, borderTop: '1px dashed var(--border)', paddingTop: 4 }}>
          Phase: {cardPhaseLabel(card.type)}
        </div>
      </div>
    </div>
  )
}

// ── Combo list ────────────────────────────────────────────────────────────────

function ComboList() {
  const { discovered } = useGameStore()
  return (
    <div style={{ fontSize: 18 }}>
      {COMBOS.map(c => {
        const found = !!discovered[c.id]
        const fx = c.mult > 1 ? `×${c.mult}` : `+${c.bonus}k`
        return (
          <div key={c.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, padding: '3px 0', borderBottom: '1px solid #14142a', opacity: found ? 1 : 0.5 }}>
              <span style={{ color: found ? 'var(--yel)' : 'var(--muted)' }}>{found ? c.name : '??? COMBO'}</span>
              <span style={{ color: found ? 'var(--grn)' : 'var(--muted)', flexShrink: 0 }}>{found ? fx : '???'}</span>
            </div>
            {found && <div style={{ fontSize: 16, color: 'var(--muted)', marginBottom: 3 }}>{c.desc}</div>}
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
      <div
        className="panel-title pt-c"
        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: open ? 10 : 0, borderBottom: open ? '2px dashed var(--border)' : 'none' }}
        onClick={() => setOpen(v => !v)}
      >
        <span>CARD DATABASE</span>
        <span style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 11, color: 'var(--cyan)', whiteSpace: 'nowrap' }}>
          {open ? '− HIDE' : '+ SHOW'}
        </span>
      </div>
      {open && (
        <div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 18 }}>
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
                  <td style={{ padding: '4px 5px', borderBottom: '1px solid #0e0e20', color: '#fff', fontFamily: "'Press Start 2P',monospace", fontSize: 10, verticalAlign: 'middle' }}>{c.name}</td>
                  <td style={{ padding: '4px 5px', borderBottom: '1px solid #0e0e20', color: 'var(--yel)', fontSize: 17, verticalAlign: 'middle' }}>{c.type}</td>
                  <td style={{ padding: '4px 5px', borderBottom: '1px solid #0e0e20', color: 'var(--muted)', fontSize: 17, verticalAlign: 'middle' }}>{c.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Main SidePanel ────────────────────────────────────────────────────────────

export default function SidePanel() {
  const { playerHand, playerDeck, playerTrash, aiHand, aiDeck, aiTrash, logEntries, commentary } = useGameStore()
  const [inspected, setInspected] = useState<Card | null>(null)
  const logRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [logEntries])

  // expose setInspected globally so CardComponent can call it on hover
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__setInspected = setInspected
  }, [])

  // counts
  let onBoard = 0
  const ps = useGameStore.getState().playerStages
  for (const k of ['s1', 's2', 's3'] as const) {
    for (const sl of ['stage', 'artist1', 'artist2', 'artist3', 'hardware', 'track', 'track2', 'track3', 'guest'] as const) {
      if (ps[k][sl]) onBoard++
    }
  }

  return (
    <div>
      {/* counters */}
      <div className="panel">
        <div className="panel-title pt-c">COUNTERS</div>
        <div className="num" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, fontSize: 20 }}>
          {[
            { label: 'YOU', color: 'var(--cyan)', h: playerHand.length, d: playerDeck.length, t: playerTrash.length },
            { label: 'AI', color: 'var(--mag)', h: aiHand.length, d: aiDeck.length, t: aiTrash.length },
          ].map(({ label, color, h, d, t }) => (
            <div key={label} style={{ background: '#04040e', border: `2px solid var(--border)`, borderTop: `2px solid ${color}`, padding: 6, lineHeight: 1.8 }}>
              <div style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 11, color, marginBottom: 3 }}>{label}</div>
              Hand:<span style={{ color }}>{h}</span> Deck:<span style={{ color }}>{d}</span><br />
              Trash:<span style={{ color }}>{t}</span> Total:<span style={{ color }}>{h + d + t}</span>
            </div>
          ))}
        </div>
      </div>

      {/* log */}
      <div className="panel">
        <div className="panel-title pt-g">TERMINAL LOG</div>
        <div className="log-box" ref={logRef}>
          {logEntries.map((e, i) => <div key={i}>&gt; {e}</div>)}
        </div>
      </div>

      {/* inspector */}
      <div className="panel">
        <div className="panel-title pt-c">CARD INSPECTOR<span className="panel-hint">Point at or focus a card in your hand.</span></div>
        <div style={{ background: '#03030a', border: '2px solid var(--border)', minHeight: 140, overflow: 'hidden' }}>
          <Inspector card={inspected} />
        </div>
      </div>

      {/* AI commentary */}
      <div className="panel" style={{ borderColor: '#1a0028' }}>
        <div className="panel-title pt-m">AI LIVE COMMENTARY</div>
        <div style={{ background: '#080010', border: '2px solid var(--mag)', padding: 8, fontSize: 20, color: '#ff88cc', fontStyle: 'italic', minHeight: 64, lineHeight: 1.4 }}>
          {commentary}
        </div>
      </div>

      {/* Combos */}
      <div className="panel" style={{ borderColor: '#2a2a00' }}>
        <div className="panel-title pt-y">COMBOS<span className="panel-hint">Build stages to discover them.</span></div>
        <ComboList />
      </div>

      {/* card DB (collapsible) */}
      <CardDatabase />
    </div>
  )
}
