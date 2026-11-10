'use client'
import { useEffect, useRef } from 'react'
import { Fx, particles, useFx } from '@/lib/fx/runner'
import FlyingCard from './FlyingCard'

// One canvas over the table for pixels, plus the cards in flight. The frame loop
// only runs while particles are alive. A click or key press skips the AI sequence.
export default function FxLayer() {
  const flights = useFx(s => s.flights)
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const cv = ref.current
    const ctx = cv?.getContext('2d')
    if (!cv || !ctx) return
    let raf = 0, last = 0
    const fit = () => {
      const d = window.devicePixelRatio || 1
      cv.width = Math.round(window.innerWidth * d); cv.height = Math.round(window.innerHeight * d)
      ctx.setTransform(d, 0, 0, d, 0, 0)
    }
    const frame = (t: number) => {
      const dt = last ? Math.min(50, t - last) : 16
      last = t
      particles.step(dt)
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)
      for (const p of particles.particles) {
        ctx.globalAlpha = Math.max(0, Math.min(1, p.life / p.max))
        ctx.fillStyle = p.color
        ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size)
      }
      ctx.globalAlpha = 1
      if (particles.particles.length) raf = requestAnimationFrame(frame)
      else { raf = 0; last = 0 }
    }
    const kick = () => { if (!raf) raf = requestAnimationFrame(frame) }
    const skipIfPlaying = () => { if (useFx.getState().playing) Fx.skip() }
    const onVis = () => { if (document.hidden) Fx.skip() }
    fit()
    window.addEventListener('resize', fit)
    Fx.onParticles(kick)
    document.addEventListener('pointerdown', skipIfPlaying, true)
    document.addEventListener('keydown', skipIfPlaying, true)
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.removeEventListener('resize', fit)
      Fx.onParticles(null)
      document.removeEventListener('pointerdown', skipIfPlaying, true)
      document.removeEventListener('keydown', skipIfPlaying, true)
      document.removeEventListener('visibilitychange', onVis)
      cancelAnimationFrame(raf)
      particles.clear()
    }
  }, [])
  return (
    <>
      <canvas ref={ref} className="fx-canvas" aria-hidden="true" />
      {flights.map(f => <FlyingCard key={f.id} f={f} />)}
    </>
  )
}
