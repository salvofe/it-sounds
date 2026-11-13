import { describe, expect, it, vi } from 'vitest'
import {
  editionFrom, playableModes, playableMode, ownsFullGame, askOwnership,
  GAME_ID, UNLOCK_URL, FULL_GAME_URL,
} from './edition'

describe('edition switch', () => {
  it('is the demo only for NEXT_PUBLIC_EDITION=demo', () => {
    expect(editionFrom('demo')).toBe('demo')
  })
  it('is the full game for anything else', () => {
    for (const v of [undefined, '', 'full', 'DEMO', ' demo', 'classic', 'true']) expect(editionFrom(v)).toBe('full')
  })
})

describe('modes per edition', () => {
  it('the full game plays both modes', () => {
    expect(playableModes('full')).toEqual(['short', 'classic'])
    expect(playableMode('classic', 'full')).toBe('classic')
    expect(playableMode('short', 'full')).toBe('short')
  })
  it('the demo plays only Short, whatever is asked', () => {
    expect(playableModes('demo')).toEqual(['short'])
    expect(playableMode('classic', 'demo')).toBe('short')
    expect(playableMode('short', 'demo')).toBe('short')
    expect(playableMode('anything' as never, 'demo')).toBe('short')
  })
  it('an unknown mode falls back to Short in the full game too', () => {
    expect(playableMode('bogus' as never, 'full')).toBe('short')
  })
})

describe('site links', () => {
  it('points at the site pages, root-absolute', () => {
    expect(GAME_ID).toBe('it-sounds')
    expect(UNLOCK_URL).toBe('/en/unlock/?game=it-sounds')
    expect(FULL_GAME_URL).toBe('/it-sounds/completo/')
  })
})

describe('ownership', () => {
  it('owner = signed in and this game or * among the games', () => {
    expect(ownsFullGame({ signedIn: true, games: ['it-sounds'] })).toBe(true)
    expect(ownsFullGame({ signedIn: true, games: ['ottone', '*'] })).toBe(true)
  })
  it('anything else is not an owner', () => {
    const no = [
      null, undefined, 0, 'yes', [], {}, { signedIn: false }, { signedIn: false, games: ['it-sounds'] },
      { signedIn: 'true', games: ['it-sounds'] }, { signedIn: true }, { signedIn: true, games: 'it-sounds' },
      { signedIn: true, games: ['ottone'] }, { signedIn: true, games: [] }, { signedIn: true, games: ['It-Sounds'] },
      { signedIn: true, games: { 0: 'it-sounds', length: 1 } },
    ]
    for (const io of no) expect(ownsFullGame(io)).toBe(false)
  })
  it('asks /api/io on the same origin with credentials', async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ signedIn: true, games: ['it-sounds'] }), { status: 200 }))
    await expect(askOwnership(f)).resolves.toBe(true)
    expect(f).toHaveBeenCalledWith('/api/io', { credentials: 'include' })
  })
  it('any failure is a no', async () => {
    await expect(askOwnership(async () => { throw new Error('offline') })).resolves.toBe(false)
    await expect(askOwnership(async () => new Response('nope', { status: 200 }))).resolves.toBe(false)
    await expect(askOwnership(async () => new Response('{"signedIn":true,"games":["*"]}', { status: 500 }))).resolves.toBe(false)
    await expect(askOwnership(async () => new Response('<html>', { status: 404 }))).resolves.toBe(false)
    await expect(askOwnership((() => null) as never)).resolves.toBe(false)
  })
})
