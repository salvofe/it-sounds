'use client'
import { PHASES } from '@/lib/data'
import { RULES } from '@/lib/engine'
import { useGameStore } from '@/store/gameStore'
import type { Phase } from '@/types/game'

const NEXT_LABELS: Record<Phase, string> = {
  ARRANGEMENT: 'SOUNDCHECK ▶', SOUNDCHECK: 'START SHOW ▶', 'LIVE SHOW': 'CALCULATE ▶', RESULTS: 'NEW ROUND ▶',
}
const PHASE_SHORT: Record<Phase, string> = {
  ARRANGEMENT: 'ARRANGE', SOUNDCHECK: 'SOUNDCHECK', 'LIVE SHOW': 'LIVE SHOW', RESULTS: 'RESULTS',
}

// The strip between the two halves of the table: where the match stands and what you can do now.
export default function CenterBand() {
  const st = useGameStore()
  const phase = PHASES[st.phaseIdx] as Phase
  const shop = st.shop
  const win = RULES.short.win
  const need = win.kind === 'bestOf' ? win.wins : 3
  const maxRounds = win.kind === 'bestOf' ? win.maxRounds : 5
  const pips = (n: number) => '●'.repeat(n) + '○'.repeat(Math.max(0, need - n))
  const actionWhy = !shop ? null
    : st.extraActionsBought >= shop.extraAction.maxPerRound ? `Max ${shop.extraAction.maxPerRound} per round`
    : st.playerWallet < shop.extraAction.cost ? `Need ${shop.extraAction.cost} Hype` : null
  const drawWhy = !shop ? null
    : st.playerWallet < shop.draw.cost ? `Need ${shop.draw.cost} Hype`
    : st.actionsLeft <= 0 ? 'No actions left' : null
  const lastLog = st.logEntries[st.logEntries.length - 1] ?? ''

  return (
    <div className="band" data-testid="center-band">
      <div className="band-row band-row-info">
        <span className="band-round" data-testid="round-info">
          {st.mode === 'short'
            ? <>ROUND {st.round}/{maxRounds}<span className="band-pips">YOU {pips(st.roundWins[0])} · AI {pips(st.roundWins[1])}</span></>
            : <>RACE TO 20k<span className="band-pips num">YOU {st.playerBestRound.toFixed(1)}k · AI {st.aiBestRound.toFixed(1)}k</span></>}
        </span>
        <ol className="band-phases" aria-label="Phases">
          {PHASES.map((p, i) => (
            <li key={p} className={i < st.phaseIdx ? 'done' : i === st.phaseIdx ? 'now' : ''} aria-current={i === st.phaseIdx ? 'step' : undefined}>
              {PHASE_SHORT[p]}
            </li>
          ))}
        </ol>
        <span className="band-stat num" data-testid="actions-left">ACTIONS {st.actionsLeft}/{st.maxActions}</span>
        <span className="band-stat num">HYPE {st.playerWallet.toFixed(1)}k</span>
        {st.mustDiscard > 0 && <span className="band-warn">DISCARD {st.mustDiscard}</span>}
        <p className="band-ticker" data-testid="ticker" aria-live="polite">{lastLog}</p>
      </div>
      <div className="band-row band-row-actions">
        <div className="band-buttons">
          {shop && phase !== 'RESULTS' && (
            <>
              <button type="button" className="btn btn-y" data-testid="buy-action" disabled={!!actionWhy} title={actionWhy ?? 'Costs no action'}
                aria-label={`Buy 1 action for ${shop.extraAction.cost} Hype${actionWhy ? `: ${actionWhy}` : ''}`} onClick={st.buyAction}>
                +1 ACTION · {shop.extraAction.cost}
              </button>
              <button type="button" className="btn btn-y" data-testid="buy-draw" disabled={!!drawWhy} title={drawWhy ?? 'Costs 1 action'}
                aria-label={`Draw ${shop.draw.cards} cards for ${shop.draw.cost} Hype${drawWhy ? `: ${drawWhy}` : ''}`} onClick={st.buyDraw}>
                DRAW {shop.draw.cards} · {shop.draw.cost}
              </button>
            </>
          )}
          {st.round === 1 && st.phaseIdx === 0 && !st.mulliganUsed && (
            <button type="button" className="btn btn-y" data-testid="mulligan" onClick={st.mulligan}>MULLIGAN</button>
          )}
          <button type="button" className="btn btn-x" data-testid="undo" onClick={st.undo}>↩ UNDO</button>
          {st.targetMode && <button type="button" className="btn btn-r" data-testid="cancel-attack" onClick={st.cancelTarget}>✖ CANCEL</button>}
          <button type="button" className="btn btn-g" data-testid="next-phase" onClick={st.nextPhase}>{NEXT_LABELS[phase]}</button>
        </div>
        <div className="band-system">
          <button type="button" className="btn btn-c" data-testid="drawer-toggle" aria-expanded={st.drawerOpen}
            aria-label={st.drawerOpen ? 'Close info' : 'Open log, combos and card list'} onClick={st.toggleDrawer}>☰ INFO</button>
          <button type="button" className="btn btn-x" data-testid="help" aria-label="Help" onClick={st.showTut}>?</button>
          <button type="button" className="btn btn-x" data-testid="sound" aria-label={st.soundMuted ? 'Sound off' : 'Sound on'} onClick={st.toggleSound}>{st.soundMuted ? '🔇' : '🔊'}</button>
          <button type="button" className="btn btn-r" data-testid="restart" aria-label="Restart"
            onClick={() => { if (confirm('Restart? Progress will be lost.')) st.restartGame() }}>↺</button>
        </div>
      </div>
    </div>
  )
}
