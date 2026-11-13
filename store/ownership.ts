import { create } from 'zustand'
import { EDITION, askOwnership } from '@/lib/edition'

// Whether the visitor owns the full game (demo edition only). Starts as "no"; the full edition never asks.
export const useOwnership = create<{ owner: boolean }>(() => ({ owner: false }))

let asked = false
export function checkOwnership(): void {
  if (EDITION !== 'demo' || asked || typeof window === 'undefined') return
  asked = true
  askOwnership((url, init) => fetch(url, init)).then(owner => useOwnership.setState({ owner }))
}
