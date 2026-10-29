'use client'
import { useGameStore } from '@/store/gameStore'
import { RULES } from '@/lib/engine'

export default function ResultsOverlay() {
  const { showResults, playerBestRound, aiBestRound, gameOver, closeResults, restartGame, mode, roundWins, lastRoundWinner, winner, playerRoundScore, aiRoundScore } = useGameStore()
  if (!showResults) return null

  let title: string, msg: string, left: number, right: number, leftLabel: string, rightLabel: string
  if (mode === 'short') {
    left = playerRoundScore; right = aiRoundScore; leftLabel = 'YOU · THIS ROUND'; rightLabel = 'AI · THIS ROUND'
    const tally = `${roundWins[0]}–${roundWins[1]}`
    if (gameOver) {
      title = winner === 0 ? '🏆 VICTORY!' : winner === 1 ? '💀 DEFEAT' : 'DRAW'
      msg = winner === 'draw' ? `Even on rounds and fans (${tally}).` : `Final score ${tally} in rounds.`
    } else {
      title = lastRoundWinner === 0 ? 'ROUND WON' : lastRoundWinner === 1 ? 'ROUND LOST' : 'ROUND DRAWN'
      msg = `Rounds ${tally} · first to 3 wins.${lastRoundWinner === 1 ? ' You get +${RULES.short.comebackBonus} Hype for the comeback.' : ''}`
    }
  } else {
    left = playerBestRound; right = aiBestRound; leftLabel = 'YOUR BEST'; rightLabel = 'AI BEST'
    const pt = left
    const at = right
    const playerWins = pt >= 20 && pt >= at
    const aiWins = at >= 20
    if (playerWins) { title = '🏆 VICTORY!'; msg = 'You hit 20k fans in one round — you win the festival!' }
    else if (aiWins) { title = '💀 DEFEAT'; msg = `The AI reached ${at.toFixed(1)}k fans in one round and stole the crowd. You lost!` }
    else if (pt > at) { title = 'ROUND RESULTS'; msg = `You lead this round by ${(pt - at).toFixed(1)}k fans. Keep pushing to 20k!` }
    else if (at > pt) { title = 'ROUND RESULTS'; msg = `AI leads by ${(at - pt).toFixed(1)}k — they're closing on 20k. Sabotage them!` }
    else { title = 'ROUND RESULTS'; msg = 'Dead heat! Use attacks to break the tie next round.' }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(2,0,8,0.94)', zIndex: 5000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'var(--panel)', border: '3px solid var(--yel)', padding: 28, width: 400, textAlign: 'center', position: 'relative' }}>
        <div style={{ fontFamily: "'Press Start 2P',monospace", color: 'var(--yel)', fontSize: 16, marginBottom: 14, textShadow: '0 0 10px var(--yel)' }}>
          {title}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, margin: '12px 0' }}>
          <div style={{ padding: 12, border: '2px solid var(--grn)', background: '#021208' }}>
            <div style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 9, color: 'var(--muted)' }}>{leftLabel}</div>
            <div style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 20, color: 'var(--grn)', marginTop: 6 }}>{left.toFixed(1)}k</div>
          </div>
          <div style={{ padding: 12, border: '2px solid var(--mag)', background: '#120208' }}>
            <div style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 9, color: 'var(--muted)' }}>{rightLabel}</div>
            <div style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 20, color: 'var(--mag)', marginTop: 6 }}>{right.toFixed(1)}k</div>
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
