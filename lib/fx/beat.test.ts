import { describe, expect, it } from 'vitest'
import { FALLBACK_MS, landingDelay } from './beat'

describe('landingDelay', () => {
  it('uses a fixed duration without music', () => {
    expect(landingDelay(null)).toBe(FALLBACK_MS)
    expect(landingDelay({ msToBeat: 100, beatMs: 0 })).toBe(FALLBACK_MS)
  })
  it('lands on the next beat when there is time', () => {
    expect(landingDelay({ msToBeat: 300, beatMs: 600 })).toBe(300)
  })
  it('skips to the beat after when the next one is too close', () => {
    expect(landingDelay({ msToBeat: 100, beatMs: 600 })).toBe(700)
    expect(landingDelay({ msToBeat: -50, beatMs: 600 })).toBe(550)
  })
  it('rounds to whole milliseconds', () => {
    expect(landingDelay({ msToBeat: 250.6, beatMs: 600 })).toBe(251)
  })
})
