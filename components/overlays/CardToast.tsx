'use client'
import { useGameStore } from '@/store/gameStore'

export default function CardToast() {
  const { cardToast } = useGameStore()
  if (!cardToast) return null

  return (
    <div style={{
      position: 'fixed', top: '50%', left: '50%',
      transform: 'translate(-50%,-50%)',
      zIndex: 6500,
      background: '#0c0c1e', border: '3px solid var(--cyan)',
      padding: '14px 22px',
      fontFamily: "'Press Start 2P',monospace",
      fontSize: 9, color: '#fff', letterSpacing: 1,
      textAlign: 'center',
      boxShadow: '0 0 24px rgba(0,255,255,0.4)',
      animation: 'toast-pop 1.3s ease-out forwards',
      pointerEvents: 'none',
    }}>
      <div>{cardToast.name}</div>
      <div style={{ fontSize: 7, color: 'var(--cyan)', marginTop: 8 }}>{cardToast.dest}</div>
    </div>
  )
}
