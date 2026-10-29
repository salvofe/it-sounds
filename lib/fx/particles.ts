// ── Pixel particles ──────────────────────────────────────────────────────────
// Plain physics, no DOM: FxLayer draws `particles` on a canvas every frame.
// Pixels and milliseconds throughout.

export type BurstKind = 'ring' | 'shards' | 'confetti' | 'firework'
export interface Particle { x: number; y: number; vx: number; vy: number; g: number; life: number; max: number; size: number; color: string }

export const MAX_PARTICLES = 400
export const BURST_SIZE: Record<BurstKind, number> = { ring: 24, shards: 36, confetti: 120, firework: 60 }

export class ParticleSystem {
  particles: Particle[] = []
  spawned = 0
  constructor(private rand: () => number = Math.random) {}

  private add(list: Particle[]): number {
    this.particles.push(...list)
    this.spawned += list.length
    const over = this.particles.length - MAX_PARTICLES
    if (over > 0) this.particles.splice(0, over)
    return list.length
  }

  burst(kind: BurstKind, x: number, y: number, colors: string[], width = 800): number {
    const r = this.rand, n = BURST_SIZE[kind], out: Particle[] = []
    const pick = () => colors[Math.floor(r() * colors.length) % colors.length]
    for (let i = 0; i < n; i++) {
      if (kind === 'ring') {
        const a = (i / n) * Math.PI * 2
        out.push({ x, y, vx: Math.cos(a) * 0.28, vy: Math.sin(a) * 0.28, g: 0, life: 450, max: 450, size: 4, color: pick() })
      } else if (kind === 'shards') {
        const a = r() * Math.PI * 2, v = 0.12 + r() * 0.3
        out.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 0.15, g: 0.0009, life: 700, max: 700, size: 3 + Math.floor(r() * 4), color: pick() })
      } else if (kind === 'confetti') {
        const life = 1600 + r() * 600
        out.push({ x: x + (r() - 0.5) * width, y: y - r() * 60, vx: (r() - 0.5) * 0.08, vy: 0.05 + r() * 0.12, g: 0.00006, life, max: life, size: 4 + Math.floor(r() * 3), color: pick() })
      } else {
        const a = r() * Math.PI * 2, v = 0.1 + r() * 0.22
        out.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 0.0003, life: 1100, max: 1100, size: 3, color: pick() })
      }
    }
    return this.add(out)
  }

  bolt(x1: number, y1: number, x2: number, y2: number, color: string): number {
    const r = this.rand, out: Particle[] = []
    for (let i = 0; i < 20; i++) {
      const t = i / 19
      out.push({ x: x1 + (x2 - x1) * t + (r() - 0.5) * 12, y: y1 + (y2 - y1) * t + (r() - 0.5) * 12, vx: 0, vy: 0, g: 0, life: 260 + t * 120, max: 380, size: 4, color })
    }
    return this.add(out)
  }

  step(dtMs: number): void {
    for (const p of this.particles) {
      p.x += p.vx * dtMs
      p.y += p.vy * dtMs
      p.vy += p.g * dtMs
      p.life -= dtMs
    }
    this.particles = this.particles.filter(p => p.life > 0)
  }

  clear(): void {
    this.particles = []
  }
}
