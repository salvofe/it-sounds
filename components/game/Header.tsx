'use client'
import { useGameStore } from '@/store/gameStore'
import { GENRES } from '@/lib/data'

export default function Header() {
  const {
    playerGenre, playerSubGenre, aiGenre,
    playerWallet, aiWallet, round,
    soundMuted, showTut, toggleSound, restartGame,
  } = useGameStore()

  const pg = GENRES[playerGenre]
  const ag = GENRES[aiGenre]

  return (
    <header style={{
      background: 'var(--panel)',
      borderBottom: '3px solid var(--cyan)',
      padding: '10px 16px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 8,
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      <div>
        <div style={{ fontFamily: "'Press Start 2P',monospace", color: 'var(--cyan)', fontSize: 13, letterSpacing: 2, textShadow: '0 0 10px var(--cyan)' }}>
          ──▶ IT SOUNDS // TERMINAL MASTER v2.0
        </div>
        <div style={{ fontSize: 18, color: 'var(--muted)', marginTop: 3 }}>
          YOU: <span style={{ color: 'var(--cyan)' }}>{playerGenre}/{playerSubGenre}</span>{' '}
          {pg && <>— <span style={{ color: 'var(--yel)' }}>{pg.icon} {pg.name}: {pg.desc}</span></>}{' '}
          | AI: <span style={{ color: 'var(--mag)' }}>{aiGenre}</span>{' '}
          {ag && <span>{ag.icon}</span>}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, fontFamily: "'Press Start 2P',monospace", fontSize: 11, alignItems: 'center' }}>
        <span style={{ color: 'var(--grn)' }}>YOU: <span style={{ fontSize: 13 }}>{playerWallet.toFixed(1)}k</span></span>
        <span style={{ color: 'var(--muted)' }}>RND {String(round).padStart(2, '0')}</span>
        <span style={{ color: 'var(--mag)' }}>AI: <span style={{ fontSize: 13 }}>{aiWallet.toFixed(1)}k</span></span>
        <button className="btn btn-x" style={{ fontSize: 9, padding: '4px 8px' }} onClick={showTut}>? HELP</button>
        <button className="btn btn-r" style={{ fontSize: 9, padding: '4px 8px' }} onClick={() => { if (confirm('Restart? Progress will be lost.')) restartGame() }}>↺ RESTART</button>
        <button className="btn btn-x" style={{ fontSize: 9, padding: '4px 8px' }} onClick={toggleSound}>
          {soundMuted ? '🔇 OFF' : '🔊 ON'}
        </button>
      </div>
    </header>
  )
}
