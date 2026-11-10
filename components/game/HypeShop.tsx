'use client'
import { useGameStore } from '@/store/gameStore'

// Short mode only: spend Hype on an extra action or 2 cards.
export default function HypeShop() {
  const { shop, playerWallet, actionsLeft, extraActionsBought, phaseIdx, buyAction, buyDraw } = useGameStore()
  if (!shop || phaseIdx === 3) return null

  const actionWhy =
    extraActionsBought >= shop.extraAction.maxPerRound ? `Max ${shop.extraAction.maxPerRound} per round`
      : playerWallet < shop.extraAction.cost ? `Need ${shop.extraAction.cost} Hype` : null
  const drawWhy =
    playerWallet < shop.draw.cost ? `Need ${shop.draw.cost} Hype`
      : actionsLeft <= 0 ? 'No actions left' : null

  return (
    <div role="group" aria-label="Hype shop" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
      <span style={{ fontSize: 20, color: 'var(--yel)' }}>Hype {playerWallet.toFixed(1)}k:</span>
      <button className="btn btn-y" disabled={!!actionWhy} title={actionWhy ?? 'Costs no action'} onClick={buyAction}
        style={actionWhy ? { opacity: 0.45, cursor: 'not-allowed' } : undefined}>
        +1 ACTION · {shop.extraAction.cost}
      </button>
      <button className="btn btn-y" disabled={!!drawWhy} title={drawWhy ?? 'Costs 1 action'} onClick={buyDraw}
        style={drawWhy ? { opacity: 0.45, cursor: 'not-allowed' } : undefined}>
        DRAW {shop.draw.cards} · {shop.draw.cost}
      </button>
      {(actionWhy || drawWhy) && <span style={{ fontSize: 18, color: 'var(--muted)' }}>{actionWhy ?? drawWhy}</span>}
    </div>
  )
}
