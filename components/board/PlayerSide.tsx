'use client'
import type { ReactNode } from 'react'
import { GENRES } from '@/lib/data'
import { RULES } from '@/lib/engine'
import { skinFor } from '@/lib/skins'
import { useGameStore } from '@/store/gameStore'

// A player's edge of the table: badge on the left, `children` in the middle
// (your hand / the AI's card backs), deck and trash piles on the right.
export default function PlayerSide({ who, children }: { who: 'me' | 'ai'; children?: ReactNode }) {
  const st = useGameStore()
  const me = who === 'me'
  const genre = me ? st.playerGenre : st.aiGenre
  const skin = skinFor(genre)
  const g = GENRES[genre]
  const wallet = me ? st.playerWallet : st.aiWallet
  const win = RULES.short.win
  const need = win.kind === 'bestOf' ? win.wins : 3
  const wins = st.roundWins[me ? 0 : 1]
  const progress = st.mode === 'short'
    ? `${'●'.repeat(wins)}${'○'.repeat(Math.max(0, need - wins))}`
    : `best ${(me ? st.playerBestRound : st.aiBestRound).toFixed(1)}k`
  return (
    <div className={`side side-${who}`} data-testid={`side-${who}`}>
      <div className="side-badge" style={{ borderColor: skin.main }}>
        <span className="side-name" style={{ color: skin.main }}>{me ? 'YOU' : 'AI'} · {genre.toUpperCase()}</span>
        <span className="side-line num">Hype {wallet.toFixed(1)}k · {progress}</span>
        {g && <span className="side-line side-bonus" title={g.desc}>{g.icon} {g.desc}</span>}
        {!me && <span className="side-line side-comment" title={st.commentary}>{st.commentary}</span>}
      </div>
      <div className="side-center">{children}</div>
      <div className="side-piles">
        <div className="pile" data-testid={`pile-${who}-deck`} style={{ borderColor: skin.main }} aria-label={`${me ? 'Your' : 'AI'} deck: ${(me ? st.playerDeck : st.aiDeck).length} cards`}>
          <span>DECK</span><span className="pile-n num">{(me ? st.playerDeck : st.aiDeck).length}</span>
        </div>
        <div className="pile pile-trash" data-testid={`pile-${who}-trash`} style={{ borderColor: skin.main }} aria-label={`${me ? 'Your' : 'AI'} trash: ${(me ? st.playerTrash : st.aiTrash).length} cards`}>
          <span>TRASH</span><span className="pile-n num">{(me ? st.playerTrash : st.aiTrash).length}</span>
        </div>
      </div>
    </div>
  )
}
