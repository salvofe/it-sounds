import { describe, expect, it } from 'vitest'
import { SUBS } from '@/lib/data'
import { CHORD, RECIPES, SCALE, parseMotif, recipeFor } from './recipes'

const VOICE_PATTERN = /^[xofw.\-0-9]{16}$/

describe('recipes', () => {
  it('has one recipe per player genre', () => {
    expect(Object.keys(RECIPES).sort()).toEqual(Object.keys(SUBS).sort())
  })

  it('falls back to Synthwave for unknown genres', () => {
    expect(recipeFor('Industrial')).toBe(RECIPES.Synthwave)
    expect(recipeFor('Jazz')).toBe(RECIPES.Jazz)
  })

  for (const [name, r] of Object.entries(RECIPES)) {
    describe(name, () => {
      it('has a 4-bar progression of known chords and a known scale', () => {
        expect(r.prog).toHaveLength(4)
        for (const [, q] of r.prog) expect(CHORD[q]).toBeDefined()
        expect(SCALE[r.scale]).toBeDefined()
      })

      it('has 3 drum layers and 4 artist voices with 16-step patterns', () => {
        expect(r.parts).toHaveLength(3)
        for (const pt of r.parts) expect(pt.p).toMatch(/^[xo.]{16}$/)
        for (const v of [r.v.bass, r.v.chords, r.v.lead, r.v.counter]) expect(v.p).toMatch(VOICE_PATTERN)
      })

      it('has motifs A and B inside two bars', () => {
        for (const src of [r.A, r.B]) {
          const m = parseMotif(src)
          const steps = Object.keys(m).map(Number)
          expect(steps.length).toBeGreaterThan(0)
          for (const s of steps) {
            const [, len] = m[s]
            expect(s).toBeGreaterThanOrEqual(0)
            expect(len).toBeGreaterThanOrEqual(1)
            expect(s + len).toBeLessThanOrEqual(32)
          }
        }
      })

      it('never attacks faster than 5 ms (no clicks)', () => {
        for (const v of Object.values(r.v)) if (v.e) expect(v.e.attack).toBeGreaterThanOrEqual(0.005)
      })
    })
  }

  it('parses "step:degree:length" motifs', () => {
    expect(parseMotif('0:4:4 8:0:6')).toEqual({ 0: [4, 4], 8: [0, 6] })
  })
})
