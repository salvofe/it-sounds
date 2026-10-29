// Bot-vs-bot statistics for short mode. Usage: npm run simulate -- [games=300]
import { createGame, playBotPhase, type PlayerId } from '@/lib/engine'

const GENRES = ['Synthwave', 'Rock', 'Electronica', 'Hip-Hop', 'Punk', 'Jazz', 'Reggae', 'Classical']
const SHOP = ['buyAction', 'buyDraw', 'boost', 'upgrade'] as const
const N = Number(process.argv[2] ?? 300)

let rounds = 0, toFive = 0, comebacks = 0, p0wins = 0, draws = 0
const gamesUsing: Record<string, number> = Object.fromEntries(SHOP.map(k => [k, 0]))
const started = Date.now()

for (let i = 0; i < N; i++) {
  let s = createGame([{ name: 'A', genre: GENRES[i % 8] }, { name: 'B', genre: GENRES[(i * 3 + 1) % 8] }], 1000 + i, 'short').state
  const used = new Set<string>()
  const down02 = [false, false]
  for (let step = 0; step < 200 && !s.gameOver; step++) {
    for (const pid of [0, 1] as PlayerId[]) {
      if (s.gameOver || s.players[pid].ready) continue
      const r = playBotPhase(s, pid)
      r.actions.forEach(a => used.add(a.type))
      s = r.state
    }
    if (s.roundWins[0] === 0 && s.roundWins[1] === 2) down02[0] = true
    if (s.roundWins[1] === 0 && s.roundWins[0] === 2) down02[1] = true
  }
  rounds += s.round
  if (s.round === 5) toFive++
  if (s.winner === 'draw') draws++
  else if (s.winner !== null) { if (s.winner === 0) p0wins++; if (down02[s.winner]) comebacks++ }
  SHOP.forEach(k => { if (used.has(k)) gamesUsing[k]++ })
}

const pct = (x: number) => `${((x / N) * 100).toFixed(1)}%`
const avg = rounds / N
const rows: [string, string, boolean][] = [
  ['avg rounds (target 3.5–4.5)', avg.toFixed(2), avg >= 3.5 && avg <= 4.5],
  ['games reaching round 5 (target ≥25%)', pct(toFive), toFive / N >= 0.25],
  ...SHOP.map(k => [`games using ${k} (target ≥20%)`, pct(gamesUsing[k]), gamesUsing[k] / N >= 0.2] as [string, string, boolean]),
  ['comebacks from 0-2', pct(comebacks), true],
  ['first player wins', pct(p0wins), true],
  ['draws', pct(draws), true],
]
for (const [label, value, okv] of rows) console.log(`${okv ? 'PASS' : 'FAIL'}  ${label.padEnd(40)} ${value}`)
console.log(`${N} games in ${((Date.now() - started) / 1000).toFixed(1)}s`)
