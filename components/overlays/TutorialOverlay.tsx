'use client'
import { useGameStore } from '@/store/gameStore'

const steps = [
  {
    title: '🎯 YOUR GOAL',
    content: (
      <>
        <p style={{ fontSize: 24, lineHeight: 1.6, color: 'var(--text)', marginTop: 12 }}>
          Build the most hyped music festival by filling your{' '}
          <span style={{ color: 'var(--cyan)' }}>Stages</span> with{' '}
          <span style={{ color: 'var(--cyan)' }}>Artists</span>,{' '}
          <span style={{ color: 'var(--cyan)' }}>Tracks</span> and{' '}
          <span style={{ color: 'var(--cyan)' }}>Hardware</span> — then score{' '}
          <span style={{ color: 'var(--yel)' }}>20k fans</span> in a single round to{' '}
          <span style={{ color: 'var(--grn)' }}>WIN</span>.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, marginTop: 14 }}>
          {[
            { n: '01', c: 'var(--yel)', label: 'ARRANGEMENT', sub: 'Place Stages & Artists' },
            { n: '02', c: 'var(--cyan)', label: 'SOUNDCHECK', sub: 'Add Tracks & Gear' },
            { n: '03', c: 'var(--grn)', label: 'LIVE SHOW', sub: 'Attack the AI' },
            { n: '04', c: 'var(--mag)', label: 'RESULTS', sub: 'Score your Hype' },
          ].map(p => (
            <div key={p.n} style={{ padding: 8, border: `2px solid ${p.c}`, background: '#06060f', textAlign: 'center', fontSize: 17, lineHeight: 1.6 }}>
              <div style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 10, marginBottom: 4 }}>{p.n}</div>
              <span style={{ color: p.c }}>{p.label}</span><br />{p.sub}
            </div>
          ))}
        </div>
      </>
    ),
  },
  {
    title: '🃏 CARD TYPES',
    content: (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
        {[
          { type: 'STAGE', icon: '🎪', desc: 'The foundation. Place first. Bigger stages = more fan capacity but need a higher score.' },
          { type: 'ARTIST', icon: '🎤', desc: 'Adds Talent points. Up to 3 per stage. Need at least 1 artist + 1 track to score fans.' },
          { type: 'TRACK', icon: '💿', desc: 'Adds audio Power (fans). Small stages hold 1; Large stages hold 2–3.' },
          { type: 'HARDWARE', icon: '🔊', desc: 'A multiplier (×2 or ×3) applied to the whole stage score. Protect it!' },
          { type: 'ATTACK', icon: '💣', desc: 'Destroys AI hardware, corrupts tracks, or steals artists. Play in LIVE SHOW phase.' },
          { type: 'DEFENSE', icon: '🛡', desc: 'Permanently shields a stage. Blocks ALL incoming attacks. Play in SOUNDCHECK.' },
        ].map(c => (
          <div key={c.type} style={{ flex: '1 1 140px', background: 'var(--panel2)', border: '2px solid var(--border)', padding: '8px 10px', fontSize: 18, lineHeight: 1.5 }}>
            <div style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 10, color: 'var(--cyan)', marginBottom: 4 }}>{c.type}</div>
            <div style={{ color: '#fff', marginBottom: 2 }}>{c.icon} {c.type}</div>
            <div style={{ color: 'var(--muted)', fontSize: 17 }}>{c.desc}</div>
          </div>
        ))}
      </div>
    ),
  },
  {
    title: '📊 HOW FANS ARE SCORED',
    content: (
      <>
        <div style={{ margin: '12px 0', padding: 12, borderLeft: '3px solid var(--cyan)', background: '#06060f', fontSize: 20, lineHeight: 1.6 }}>
          Each stage: <span style={{ color: 'var(--cyan)' }}>(Artist Talents ÷ 100 + Track Powers) × Hardware Multiplier</span>
        </div>
        <div style={{ padding: 12, borderLeft: '3px solid var(--grn)', background: '#020f04', fontSize: 20, lineHeight: 1.6 }}>
          Example: 2 artists (25+30 talent) + 1 track (+1.0k) + ×2 hardware = <span style={{ color: 'var(--grn)' }}>(0.25+0.30+1.0)×2 = 3.1k fans ✓</span>
        </div>
        <div style={{ margin: '8px 0', padding: 12, borderLeft: '3px solid var(--red)', background: '#0f0204', fontSize: 20, lineHeight: 1.6 }}>
          A stage only scores if it meets its <span style={{ color: 'var(--red)' }}>Threshold</span>. Below threshold = <span style={{ color: 'var(--red)' }}>0 fans earned</span>.
        </div>
        <div style={{ padding: 12, borderLeft: '3px solid var(--yel)', background: '#0a0900', fontSize: 20, lineHeight: 1.6 }}>
          <span style={{ color: 'var(--yel)' }}>💡 Genre bonus:</span> your chosen genre gives a passive boost every round. Build around it!
        </div>
      </>
    ),
  },
  {
    title: '🕹 HOW TO PLAY CARDS',
    content: (
      <>
        {[
          { head: '1. Click a card in your hand', body: 'It highlights yellow (selected).' },
          { head: '2. It auto-places on the focused stage', body: 'Yellow-bordered stage = focused. Or click a specific slot manually.' },
          { head: 'ATTACK cards', body: 'Activate TARGET MODE — red banner appears. Click any AI stage to hit it.' },
          { head: 'Phase hint bar', body: 'Always tells you which cards you can play and what to do next.' },
        ].map((s, i) => (
          <div key={i} style={{ margin: '8px 0', padding: 10, background: '#06060f', borderLeft: `3px solid ${i === 2 ? 'var(--red)' : i === 3 ? 'var(--grn)' : 'var(--cyan)'}`, fontSize: 20, lineHeight: 1.5 }}>
            <strong style={{ color: i === 2 ? 'var(--red)' : i === 3 ? 'var(--grn)' : 'var(--cyan)' }}>{s.head}: </strong>{s.body}
          </div>
        ))}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
          {[
            { icon: '↩', text: 'Click ↩ on a placed card — returns it to hand (free)' },
            { icon: '🗑', text: 'Click 🗑 on a hand card — discards it permanently' },
            { icon: '↔', text: 'Click ↔ on a placed card — move it to another slot (FREE action)' },
            { icon: '↩', text: 'UNDO button — reverses your last move and refunds the action' },
          ].map((t, i) => (
            <div key={i} style={{ flex: '1 1 150px', background: '#060614', border: '1px solid var(--border)', padding: '6px 8px', fontSize: 18, lineHeight: 1.4 }}>
              <span style={{ fontSize: 20 }}>{t.icon}</span> {t.text}
            </div>
          ))}
        </div>
      </>
    ),
  },
]

export default function TutorialOverlay() {
  const { showTutorial, tutStep, tutNav } = useGameStore()
  if (!showTutorial) return null

  const step = steps[tutStep - 1]
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 8000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(4,4,12,0.97)' }}>
      <div style={{ background: 'var(--panel)', border: '3px solid var(--yel)', padding: 28, width: 680, maxHeight: '90vh', overflowY: 'auto', position: 'relative' }}>
        {/* title */}
        <div style={{ fontFamily: "'Press Start 2P',monospace", color: 'var(--yel)', textAlign: 'center', fontSize: 14, letterSpacing: 2, textShadow: '0 0 10px var(--yel)', marginBottom: 20 }}>
          ◀ HOW TO PLAY ▶
        </div>

        {/* step title */}
        <div style={{ fontFamily: "'Press Start 2P',monospace", color: 'var(--cyan)', fontSize: 13, marginBottom: 10 }}>
          {step.title}
        </div>

        {/* step content */}
        {step.content}

        {/* navigation */}
        <div style={{ display: 'flex', gap: 8, marginTop: 20, alignItems: 'center' }}>
          {tutStep > 1 ? (
            <button className="btn btn-x" onClick={() => tutNav(-1)}>◀ BACK</button>
          ) : <div />}
          <div style={{ flex: 1 }}>
            <div style={{ height: 6, background: '#1a1a30', border: '1px solid var(--border)' }}>
              <div style={{ height: '100%', background: 'var(--yel)', width: `${tutStep / 4 * 100}%`, transition: 'width 0.3s' }} />
            </div>
            <div style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 9, color: 'var(--muted)', marginTop: 4 }}>
              STEP {tutStep} OF 4
            </div>
          </div>
          <button className="btn btn-y" onClick={() => tutNav(1)}>
            {tutStep === 4 ? 'START GAME ▶' : 'NEXT ▶'}
          </button>
        </div>
      </div>
    </div>
  )
}
