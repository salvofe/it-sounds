'use client'
import { useEffect } from 'react'
import { useGameStore } from '@/store/gameStore'
import SidePanel from '@/components/game/SidePanel'
import TutorialOverlay from '@/components/overlays/TutorialOverlay'
import SetupOverlay from '@/components/overlays/SetupOverlay'
import ResultsOverlay from '@/components/overlays/ResultsOverlay'
import PhaseTransition from '@/components/overlays/PhaseTransition'
import CardToast from '@/components/overlays/CardToast'
import ComboReveal from '@/components/overlays/ComboReveal'
import Board from '@/components/board/Board'

export default function GamePage() {
  const { isStarted, targetMode } = useGameStore()

  // test hook: board-check.mjs drives the store through window.__itsounds (only with ?e2e=1)
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has('e2e')) {
      (window as unknown as { __itsounds?: typeof useGameStore }).__itsounds = useGameStore
    }
  }, [])

  return (
    <>
      {/* ── Overlays ── */}
      <TutorialOverlay />
      <SetupOverlay />
      <ResultsOverlay />
      <PhaseTransition />
      <CardToast />
      <ComboReveal />

      {/* ── Target mode banner ── */}
      {targetMode && (
        <div className="target-banner">
          🎯 TARGET MODE ACTIVE — CLICK AN AI STAGE TO LAUNCH YOUR ATTACK
        </div>
      )}

      {/* ── Main UI (only shown once game started) ── */}
      {isStarted && (
        <>
          <Board />
          <SidePanel />
        </>
      )}
    </>
  )
}
