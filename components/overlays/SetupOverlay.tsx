'use client'
import { useState } from 'react'
import { useGameStore } from '@/store/gameStore'
import { SUBS } from '@/lib/data'

const PLAYER_GENRES = ['Synthwave', 'Rock', 'Electronica', 'Hip-Hop', 'Punk', 'Jazz', 'Reggae', 'Classical']
const AI_GENRES = ['Industrial', 'Electronica', 'Jazz-Fusion', 'Metal', 'Punk-AI', 'Drone', 'Trap-AI']

export default function SetupOverlay() {
  const { showSetup, startGame, showTut } = useGameStore()
  const [pGenre, setPGenre] = useState('Synthwave')
  const [pSub, setPSub] = useState('Darksynth')
  const [aiGenre, setAiGenre] = useState('Industrial')

  if (!showSetup) return null

  const subs = SUBS[pGenre] ?? []

  function handleGenreChange(g: string) {
    setPGenre(g)
    setPSub(SUBS[g]?.[0] ?? '')
  }

  function handleStart() {
    startGame(pGenre, pSub, aiGenre)
  }

  function handleRandom() {
    const pg = PLAYER_GENRES[Math.floor(Math.random() * PLAYER_GENRES.length)]
    const sg = SUBS[pg]?.[0] ?? ''
    const ag = AI_GENRES[Math.floor(Math.random() * AI_GENRES.length)]
    startGame(pg, sg, ag)
  }

  const sel: React.CSSProperties = {
    background: '#04040c', color: 'var(--text)',
    border: '2px solid var(--border)', padding: '8px 10px',
    fontFamily: "'VT323',monospace", fontSize: 18, width: '100%',
    cursor: 'pointer', outline: 'none',
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 8000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(4,4,12,0.97)' }}>
      <div style={{ background: 'var(--panel)', border: '3px solid var(--cyan)', padding: 28, width: 480, position: 'relative' }}>
        <div style={{ fontFamily: "'Press Start 2P',monospace", color: 'var(--yel)', textAlign: 'center', fontSize: 10, letterSpacing: 2, textShadow: '0 0 10px var(--yel)', marginBottom: 20 }}>
          ◀ DECK CONFIG ▶
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontFamily: "'Press Start 2P',monospace", color: 'var(--cyan)', display: 'block', marginBottom: 8, fontSize: 7 }}>▶ YOUR GENRE</label>
          <select style={sel} value={pGenre} onChange={e => handleGenreChange(e.target.value)}>
            {PLAYER_GENRES.map(g => <option key={g}>{g}</option>)}
          </select>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontFamily: "'Press Start 2P',monospace", color: 'var(--cyan)', display: 'block', marginBottom: 8, fontSize: 7 }}>▶ YOUR SUB-GENRE</label>
          <select style={sel} value={pSub} onChange={e => setPSub(e.target.value)}>
            {subs.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div style={{ marginBottom: 14, borderTop: '2px dashed #1a1a30', paddingTop: 12 }}>
          <label style={{ fontFamily: "'Press Start 2P',monospace", color: 'var(--mag)', display: 'block', marginBottom: 8, fontSize: 7 }}>▶ AI OPPONENT GENRE</label>
          <select style={{ ...sel, border: '2px solid var(--mag)' }} value={aiGenre} onChange={e => setAiGenre(e.target.value)}>
            {AI_GENRES.map(g => <option key={g}>{g}</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
          <button className="btn btn-g" style={{ flex: 1 }} onClick={handleStart}>▶ INITIALIZE</button>
          <button className="btn btn-x" onClick={handleRandom}>RANDOM</button>
          <button className="btn btn-x" onClick={showTut}>? HELP</button>
        </div>
      </div>
    </div>
  )
}
