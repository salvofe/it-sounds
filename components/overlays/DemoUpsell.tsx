'use client'
import { FULL_GAME_URL, UNLOCK_URL } from '@/lib/edition'
import { useOwnership } from '@/store/ownership'

// Demo edition only. The link to the full game: "Unlock" for visitors, "Continue" for owners.
export function FullGameLink({ style }: { style?: React.CSSProperties }) {
  const owner = useOwnership(s => s.owner)
  return owner ? (
    <a className="btn btn-c demo-link" data-testid="demo-continue" href={FULL_GAME_URL} style={style}>▶ CONTINUE IN THE FULL GAME</a>
  ) : (
    <a className="btn btn-c demo-link" data-testid="demo-unlock" href={UNLOCK_URL} style={style}>🔓 UNLOCK THE FULL GAME</a>
  )
}

export function DemoBadge() {
  return <span className="demo-badge" data-testid="demo-badge">DEMO</span>
}

// Shown at the end of a Short game in the demo.
export function DemoEndBox() {
  const owner = useOwnership(s => s.owner)
  return (
    <div className="demo-box" data-testid="demo-end-box">
      <div className="demo-box-title">{owner ? 'CLASSIC IS WAITING' : 'TRY CLASSIC'}</div>
      <p>
        {owner
          ? 'You own the full game: play Classic — first to 20k fans in one long round.'
          : 'The full game adds Classic: first to 20k fans in one long round.'}
      </p>
      <FullGameLink style={{ width: '100%' }} />
    </div>
  )
}
