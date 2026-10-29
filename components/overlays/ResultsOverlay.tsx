'use client'
import { useGameStore } from '@/store/gameStore'

export default function ResultsOverlay() {
  const { showResults, playerBestRound, aiBestRound, gameOver, closeResults, restartGame } = useGameStore()
  if (!showResults) return null

  const pt = playerBestRound
  const at = aiBestRound
  const playerWins = pt >= 20 && pt >= at
  const aiWins = at >= 20

  let title: string
  let msg: string
  if (playerWins) { title = '🏆 VICTORY!'; msg = 'You hit 20k fans in one round — you win the festival!' }
  else if (aiWins) { title = '💀 DEFEAT'; msg = `The AI reached ${at.toFixed(1)}k fans in one round and stole the crowd. You lost!` }
  else if (pt > at) { title = 'ROUND RESULTS'; msg = `You lead this round by ${(pt - at).toFixed(1)}k fans. Keep pushing to 20k!` }
  else if (at > pt) { title = 'ROUND RESULTS'; msg = `AI leads by ${(at - pt).toFixed(1)}k — they're closing on 20k. Sabotage them!` }
  else { title = 'ROUND RESULTS'; msg = 'Dead heat! Use attacks to break the tie next round.' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(2,0,8,0.94)', zIndex: 5000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'var(--panel)', border: '3px solid var(--yel)', padding: 28, width: 400, textAlign: 'center', position: 'relative' }}>
        <div style={{ fontFamily: "'Press Start 2P',monospace", color: 'var(--yel)', fontSize: 16, marginBottom: 14, textShadow: '0 0 10px var(--yel)' }}>
          {title}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, margin: '12px 0' }}>
          <div style={{ padding: 12, border: '2px solid var(--grn)', background: '#021208' }}>
            <div style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 9, color: 'var(--muted)' }}>YOUR BEST</div>
            <div style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 20, color: 'var(--grn)', marginTop: 6 }}>{pt.toFixed(1)}k</div>
          </div>
          <div style={{ padding: 12, border: '2px solid var(--mag)', background: '#120208' }}>
            <div style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 9, color: 'var(--muted)' }}>AI BEST</div>
            <div style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 20, color: 'var(--mag)', marginTop: 6 }}>{at.toFixed(1)}k</div>
          </div>
        </div>

        <div style={{ fontSize: 20, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.5 }}>{msg}</div>

        {gameOver ? (
          <button className="btn btn-y" style={{ width: '100%' }} onClick={restartGame}>▶ PLAY AGAIN</button>
        ) : (
          <button className="btn btn-y" style={{ width: '100%' }} onClick={closeResults}>▶ NEXT ROUND</button>
        )}
      </div>
    </div>
  )
}
