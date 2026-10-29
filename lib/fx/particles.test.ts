import { describe, expect, it } from 'vitest'
import { BURST_SIZE, MAX_PARTICLES, ParticleSystem } from './particles'

const seeded = () => { let s = 1; return () => (s = (s * 16807) % 2147483647) / 2147483647 }

describe('ParticleSystem', () => {
  it('adds a burst of the documented size, in the given colours', () => {
    const p = new ParticleSystem(seeded())
    expect(p.burst('ring', 100, 100, ['#ff00aa'])).toBe(BURST_SIZE.ring)
    expect(p.particles).toHaveLength(BURST_SIZE.ring)
    expect(p.particles.every(q => q.color === '#ff00aa' && q.life > 0)).toBe(true)
    expect(p.spawned).toBe(BURST_SIZE.ring)
  })

  it('draws a bolt as 20 sparks between two points', () => {
    const p = new ParticleSystem(seeded())
    expect(p.bolt(0, 0, 100, 0, '#fff')).toBe(20)
    expect(p.particles.every(q => q.x >= -8 && q.x <= 108)).toBe(true)
  })

  it('never keeps more than MAX_PARTICLES, dropping the oldest', () => {
    const p = new ParticleSystem(seeded())
    p.burst('shards', 0, 0, ['#111'])
    for (let i = 0; i < 6; i++) p.burst('confetti', 0, 0, ['#222'], 1000)
    expect(p.particles.length).toBeLessThanOrEqual(MAX_PARTICLES)
    expect(p.particles.some(q => q.color === '#111')).toBe(false)
    expect(p.spawned).toBe(BURST_SIZE.shards + 6 * BURST_SIZE.confetti)
  })

  it('moves particles and removes them when their life ends', () => {
    const p = new ParticleSystem(seeded())
    p.burst('firework', 50, 50, ['#0f0'])
    const before = p.particles.map(q => [q.x, q.y])
    p.step(16)
    expect(p.particles.some((q, i) => q.x !== before[i][0] || q.y !== before[i][1])).toBe(true)
    p.step(5000)
    expect(p.particles).toHaveLength(0)
  })

  it('clears everything', () => {
    const p = new ParticleSystem(seeded())
    p.burst('ring', 0, 0, ['#fff'])
    p.clear()
    expect(p.particles).toHaveLength(0)
  })
})
