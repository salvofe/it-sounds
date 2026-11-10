'use client'
import { useEffect } from 'react'
import { PHASES } from '@/lib/data'
import { useGameStore } from '@/store/gameStore'
import CenterBand from './CenterBand'
import HandFan from './HandFan'
import CardPreview from './CardPreview'
import Drawer from './Drawer'
import FxLayer from './FxLayer'
import OpponentHand from './OpponentHand'
import PlayerSide from './PlayerSide'
import StageZone from './StageZone'
import type { StageKey } from '@/types/game'

const KEYS: StageKey[] = ['s1', 's2', 's3']

// The card table: AI edge, AI stages, centre band, your stages, your edge with the hand.
export default function Board() {
  const phaseIdx = useGameStore(s => s.phaseIdx)
  // Escape backs out of whatever is in progress: move, attack targeting, preview, drawer.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      const st = useGameStore.getState()
      if (st.moveMode || st.targetMode || st.selectedCard !== null) useGameStore.setState({ moveMode: null, targetMode: false, selectedCard: null })
      if (st.previewCard) st.setPreview(null)
      if (st.drawerOpen) st.toggleDrawer()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])
  return (
    <div className="board" data-testid="board" data-phase={PHASES[phaseIdx]}>
      <div className="board-lights" aria-hidden="true" />
      <PlayerSide who="ai"><OpponentHand /></PlayerSide>
      <div className="board-field">{KEYS.map(k => <StageZone key={k} owner="ai" sk={k} />)}</div>
      <CenterBand />
      <div className="board-field">{KEYS.map(k => <StageZone key={k} owner="me" sk={k} />)}</div>
      <PlayerSide who="me"><HandFan /></PlayerSide>
      <CardPreview />
      <Drawer />
      <FxLayer />
    </div>
  )
}
