'use client'
import PhaseBar from '@/components/game/PhaseBar'
import RaceTracker from '@/components/game/RaceTracker'
import Hand from '@/components/game/Hand'
import CardPreview from './CardPreview'
import OpponentHand from './OpponentHand'
import PlayerSide from './PlayerSide'
import StageZone from './StageZone'
import type { StageKey } from '@/types/game'

const KEYS: StageKey[] = ['s1', 's2', 's3']

// The card table: AI edge, AI stages, centre band, your stages, your edge with the hand.
export default function Board() {
  return (
    <div className="board" data-testid="board">
      <div className="board-lights" aria-hidden="true" />
      <PlayerSide who="ai"><OpponentHand /></PlayerSide>
      <div className="board-field">{KEYS.map(k => <StageZone key={k} owner="ai" sk={k} />)}</div>
      <div className="board-center"><PhaseBar /><RaceTracker /></div>
      <div className="board-field">{KEYS.map(k => <StageZone key={k} owner="me" sk={k} />)}</div>
      <PlayerSide who="me"><Hand /></PlayerSide>
      <CardPreview />
    </div>
  )
}
