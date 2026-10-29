// ── Animations on the beat ───────────────────────────────────────────────────
// How long a flight lasts so that its impact lands on a beat of the music.

export interface BeatInfo { msToBeat: number; beatMs: number }

export const MIN_LEAD_MS = 180   // shorter than this looks like a teleport: wait one more beat
export const FALLBACK_MS = 320   // no music (off or muted)

export function landingDelay(beat: BeatInfo | null, min = MIN_LEAD_MS, fallback = FALLBACK_MS): number {
  if (!beat || !(beat.beatMs > 0)) return fallback
  let d = beat.msToBeat
  while (d < min) d += beat.beatMs
  return Math.round(d)
}
