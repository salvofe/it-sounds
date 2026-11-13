import { afterEach, describe, expect, it, vi } from 'vitest'

// The edition is read at import time (as Next inlines NEXT_PUBLIC_EDITION), so each test loads a fresh store.
async function storeFor(edition: string | undefined) {
  vi.resetModules()
  vi.stubEnv('NEXT_PUBLIC_EDITION', edition as string)
  return (await import('./gameStore')).useGameStore
}

afterEach(() => { vi.unstubAllEnvs() })

describe('store: demo edition', () => {
  it('a Classic request starts a Short game in the demo', async () => {
    const store = await storeFor('demo')
    store.getState().startGame('Synthwave', 'Darksynth', 'Industrial', 'classic')
    expect(store.getState().mode).toBe('short')
    expect(store.getState().game?.mode).toBe('short')
  })
  it('defaults to Short', async () => {
    const store = await storeFor('demo')
    expect(store.getState().mode).toBe('short')
  })
  it('refuses to play a Classic state injected into the demo store', async () => {
    const store = await storeFor('demo')
    store.getState().startGame('Synthwave', 'Darksynth', 'Industrial', 'short')
    const g = store.getState().game!
    store.setState({ game: { ...g, mode: 'classic' } })
    const before = store.getState().game
    store.getState().nextPhase()
    store.getState().undo()
    expect(store.getState().game).toBe(before)
  })
  it('the full game still starts Classic', async () => {
    const store = await storeFor(undefined)
    store.getState().startGame('Synthwave', 'Darksynth', 'Industrial', 'classic')
    expect(store.getState().mode).toBe('classic')
    store.getState().nextPhase()
    expect(store.getState().game?.mode).toBe('classic')
  })
})
