import { describe, expect, it } from 'vitest'
import { basePathFrom, DEFAULT_BASE_PATH } from './basePath'

describe('basePath config', () => {
  it('defaults to /it-sounds (the build is unchanged without BASE_PATH)', () => {
    expect(DEFAULT_BASE_PATH).toBe('/it-sounds')
    expect(basePathFrom(undefined)).toBe('/it-sounds')
    expect(basePathFrom('')).toBe('/it-sounds')
  })
  it('takes BASE_PATH as given', () => {
    expect(basePathFrom('/it-sounds/completo')).toBe('/it-sounds/completo')
    expect(basePathFrom('/it-sounds')).toBe('/it-sounds')
  })
  it('refuses a path Next would bake in wrongly', () => {
    for (const bad of ['it-sounds', '/it-sounds/', '/', '//x', '/a b', '/it-sounds/../x', 'https://x.com/it-sounds', '/it-sounds?x=1']) {
      expect(() => basePathFrom(bad), bad).toThrow(/BASE_PATH/)
    }
  })
})
