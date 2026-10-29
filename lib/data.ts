import type { Card, Combo, GenreDef, SpriteDef, Phase } from '@/types/game'
import { sprite32Svg } from '@/lib/sprites'

// ── Sub-genres ───────────────────────────────────────────────────────────────

export const SUBS: Record<string, string[]> = {
  Synthwave: ['Darksynth', 'Outrun', 'Cyber-Synth'],
  Rock: ['Cyber Punk', 'Hard Rock', 'Garage'],
  Electronica: ['Glitchcore', 'IDM', 'Ambient-Tech'],
  'Hip-Hop': ['Trap', 'Boom Bap', 'Lo-Fi'],
  Punk: ['Hardcore', 'Pop-Punk', 'Riot'],
  Jazz: ['Bebop', 'Smooth', 'Free-Jazz'],
  Reggae: ['Dub', 'Roots', 'Ska'],
  Classical: ['Baroque', 'Neo-Classical', 'Cinematic'],
}

// ── Genre Definitions ────────────────────────────────────────────────────────

export const GENRES: Record<string, GenreDef> = {
  Synthwave: { name: 'Retro Wave', desc: 'Each Hardware multiplier adds +0.5k extra to its stage', icon: '🎹' },
  Rock: { name: 'Crowd Energy', desc: '+0.4k fans per artist on a stage', icon: '🎸' },
  Electronica: { name: 'Layered Sound', desc: '+0.3k fans per track on a stage', icon: '🎛' },
  'Hip-Hop': { name: 'Hype Machine', desc: 'Sponsors give +1k extra; +0.5k Hype each round', icon: '🎤' },
  Punk: { name: 'Fast & Loud', desc: 'Stages cost 1k less; +0.2k per artist', icon: '🤬' },
  Jazz: { name: 'Virtuoso', desc: '+0.5k per artist with 30+ talent', icon: '🎷' },
  Reggae: { name: 'Good Vibes', desc: '+0.3k per active stage you control', icon: '🌿' },
  Classical: { name: 'Grand Composition', desc: '+1k if a stage has 3 tracks', icon: '🎻' },
  Industrial: { name: 'Brute Force', desc: 'AI bonus: +0.4k per artist', icon: '⚙' },
  'Jazz-Fusion': { name: 'Improv', desc: 'AI bonus: +0.3k per track', icon: '🎺' },
  Metal: { name: 'Wall of Sound', desc: 'AI bonus: hardware +0.5k', icon: '🤘' },
  'Punk-AI': { name: 'Riot Mode', desc: 'AI bonus: +0.3k per artist', icon: '🔥' },
  Drone: { name: 'Hypnotic', desc: 'AI bonus: +0.4k per track', icon: '🔊' },
  'Trap-AI': { name: '808 Power', desc: 'AI bonus: hardware +0.6k', icon: '🔢' },
}

// ── Card Templates (source of truth for deck building) ───────────────────────

export const TEMPLATES: Omit<Card, 'id'>[] = [
  // 0-3: stages
  { type: 'stage', name: 'Small Stage', threshold: 1.5, cost: 0, maxTracks: 1, desc: 'Threshold 1.5k | 1 track slot' },
  { type: 'stage', name: 'Medium Stage', threshold: 3.5, cost: 2, maxTracks: 1, desc: 'Cost 2k | Threshold 3.5k' },
  { type: 'stage', name: 'Large Stage', threshold: 6.0, cost: 4.5, maxTracks: 2, desc: 'Cost 4.5k | 2 tracks' },
  { type: 'stage', name: 'Festival Main', threshold: 10.0, cost: 7.5, maxTracks: 3, desc: 'Cost 7.5k | 3 tracks' },
  // 4-7: artists
  { type: 'artist', name: 'Synth Wizard', talent: 25, desc: 'Talent 25 | Synth specialist' },
  { type: 'artist', name: 'Beat Machine', talent: 30, desc: 'Talent 30 | Drums powerhouse' },
  { type: 'artist', name: 'Neural Vocalist', talent: 35, desc: 'Talent 35 | Crowd favourite' },
  { type: 'artist', name: 'Bass Controller', talent: 28, desc: 'Talent 28 | Low-end anchor' },
  // 8-10: tracks
  { type: 'track', name: 'Data Stream', power: 1.0, desc: '+1.0k fans audio power' },
  { type: 'track', name: 'Bit Residue', power: 0.5, desc: '+0.5k fans audio power' },
  { type: 'track', name: 'Hypnotic Loop', power: 1.5, desc: '+1.5k fans audio power' },
  // 11-12: hardware
  { type: 'hardware', name: 'Valve Pre-Amp', multiplier: 2, desc: 'Stage score multiplier x2' },
  { type: 'hardware', name: 'Eurorack Drive', multiplier: 3, desc: 'Stage score multiplier x3' },
  // 13-15: attacks
  { type: 'attack', name: 'Malware Worm', attackPower: 55, effect: 'hardware', desc: 'Destroys enemy hardware' },
  { type: 'attack', name: 'Track Corruptor', attackPower: 60, effect: 'track', desc: 'Corrupts enemy track slot' },
  { type: 'attack', name: 'Artist Poacher', attackPower: 70, effect: 'artist', desc: 'Steals enemy artist to trash' },
  // 16: defense
  { type: 'defense', name: 'Firewall Shield', desc: 'Permanent stage protection – blocks all attacks' },
  // 17-19: special
  { type: 'collab', name: 'Guest Feature', bonus: 0.8, desc: '+0.8k fans – needs 2+ artists' },
  { type: 'sponsor', name: 'Brand Deal', income: 1.5, desc: '+1.5k Hype currency now' },
  { type: 'viral', name: 'Viral Hit', power: 2.0, desc: '+2.0k fans – needs 30+ talent artist' },
  // 20: draw
  { type: 'draw', name: 'Demo Tape', draw: 2, desc: 'Draw 2 cards from your deck' },
  // 21-23: premium
  { type: 'artist', name: 'The Manager', talent: 40, desc: 'Talent 40 | Star headliner' },
  { type: 'track', name: 'Megahit', power: 2.5, desc: '+2.5k fans – premium track' },
  { type: 'hardware', name: 'Studio Engineer', multiplier: 4, desc: 'Stage score multiplier x4 (rare!)' },
  // 24-28: more
  { type: 'attack', name: 'EMP Blast', attackPower: 90, effect: 'emp', desc: 'Destroys enemy hardware AND track' },
  { type: 'defense', name: 'Decoy Booth', decoy: true, desc: 'One-time shield: absorbs next attack then breaks' },
  { type: 'collab', name: 'Encore', bonus: 1.5, encore: true, desc: '+1.5k fans – no condition needed' },
  { type: 'sponsor', name: 'Radio Play', income: 2, desc: '+2k Hype currency now' },
  { type: 'draw', name: 'Bootleg', draw: 3, discard: 1, desc: 'Draw 3 cards, then discard 1' },
]

// ── Deck composition ─────────────────────────────────────────────────────────
// [template index, copies] — both players use the same list (built in lib/engine)

export const DECK_LIST: [number, number][] = [
  [0, 10], [1, 4], [2, 2], [3, 2],
  [4, 5], [5, 5], [6, 4], [7, 4],
  [8, 8], [9, 5], [10, 3],
  [11, 5], [12, 4],
  [13, 3], [14, 2], [15, 2],
  [16, 5], [17, 2], [18, 2],
  [19, 2], [20, 3],
  [21, 2], [22, 2], [23, 1],
  [24, 2], [25, 2], [26, 2],
  [27, 2], [28, 2],
]
export const DECK_SIZE = 88
export const FILLER_TEMPLATE = 9

// ── Phase metadata ────────────────────────────────────────────────────────────

export const PHASES: Phase[] = ['ARRANGEMENT', 'SOUNDCHECK', 'LIVE SHOW', 'RESULTS']

export const PHASE_HINTS: Record<Phase, string> = {
  ARRANGEMENT: `<strong>ARRANGEMENT PHASE</strong> – Play <span style="color:var(--yel)">STAGE</span> cards first, then add <span style="color:var(--cyan)">ARTIST</span> cards. Place <span style="color:#ff88ff">BONUS</span> cards (Collab/Viral/Sponsor) in the ⭐ bonus slot. Click a stage to focus it first.`,
  SOUNDCHECK: `<strong>SOUNDCHECK PHASE</strong> – Add <span style="color:var(--purple)">TRACK</span> cards and <span style="color:var(--orange)">HARDWARE</span> multipliers. Play <span style="color:var(--grn)">FIREWALL SHIELD</span> (defense) NOW to protect a stage.`,
  'LIVE SHOW': `<strong>LIVE SHOW – SABOTAGE PHASE</strong> – Play <span style="color:var(--red)">ATTACK</span> cards only! Click an attack card, then click an AI stage to hit it.`,
  RESULTS: `<strong>RESULTS PHASE</strong> – Scores are shown now! Click <span style="color:var(--yel)">NEXT ROUND</span> to bank your Hype and start fresh. Reach <span style="color:var(--yel)">20k fans in one round</span> to win!`,
}

// ── Combos ────────────────────────────────────────────────────────────────────

import type { StageState } from '@/types/game'

export interface ComboWithTest extends Combo {
  test: (s: StageState) => boolean
}

export const COMBOS: ComboWithTest[] = [
  {
    id: 'power_trio', name: 'POWER TRIO', desc: '3 artists on one stage', bonus: 3, mult: 1,
    test: s => [s.artist1, s.artist2, s.artist3].filter(Boolean).length >= 3,
  },
  {
    id: 'wall_of_sound', name: 'WALL OF SOUND', desc: 'Hardware x3 + 2 or more tracks', bonus: 4, mult: 1,
    test: s => !!(s.hardware && s.hardware.multiplier! >= 3 && [s.track, s.track2, s.track3].filter(Boolean).length >= 2),
  },
  {
    id: 'retro_fusion', name: 'RETRO FUSION', desc: 'Synth Wizard + any hardware', bonus: 0, mult: 1.5,
    test: s => !!(s.hardware && [s.artist1, s.artist2, s.artist3].some(a => a?.name === 'Synth Wizard')),
  },
  {
    id: 'drop_the_beat', name: 'DROP THE BEAT', desc: 'Beat Machine + Hypnotic Loop', bonus: 2.5, mult: 1,
    test: s => [s.artist1, s.artist2, s.artist3].some(a => a?.name === 'Beat Machine') &&
      [s.track, s.track2, s.track3].some(t => t?.name === 'Hypnotic Loop'),
  },
  {
    id: 'headliner', name: 'FESTIVAL HEADLINER', desc: 'Festival Main + 30+ talent artist + Viral guest', bonus: 6, mult: 1,
    test: s => !!(s.stage?.name === 'Festival Main' &&
      [s.artist1, s.artist2, s.artist3].some(a => a && a.talent! >= 30) &&
      s.guest?.type === 'viral'),
  },
  {
    id: 'full_stack', name: 'FULL STACK', desc: 'Every slot on a stage filled', bonus: 3, mult: 1,
    test: s => !!(s.stage && s.artist1 && s.artist2 && s.artist3 && s.hardware && s.track && s.guest &&
      (s.stage.maxTracks! < 2 || s.track2) && (s.stage.maxTracks! < 3 || s.track3)),
  },
  {
    id: 'supergroup', name: 'SUPERGROUP', desc: 'The Manager + 2 other artists', bonus: 4, mult: 1,
    test: s => [s.artist1, s.artist2, s.artist3].some(a => a?.name === 'The Manager') &&
      [s.artist1, s.artist2, s.artist3].filter(Boolean).length >= 3,
  },
  {
    id: 'platinum', name: 'PLATINUM RECORD', desc: 'Megahit track + x4 hardware', bonus: 0, mult: 2,
    test: s => !!(s.hardware?.multiplier! >= 4 && [s.track, s.track2, s.track3].some(t => t?.name === 'Megahit')),
  },
]

export function detectCombos(s: StageState): { bonus: number; mult: number; active: Combo[] } {
  let bonus = 0; let mult = 1; const active: Combo[] = []
  for (const c of COMBOS) {
    if (c.test(s)) { bonus += c.bonus; mult *= c.mult; active.push(c) }
  }
  return { bonus, mult, active }
}

// ── Genre bonus calc ──────────────────────────────────────────────────────────

export function genreBonus(genre: string, s: StageState, activeStages = 0): number {
  let b = 0
  const arts = [s.artist1, s.artist2, s.artist3].filter(Boolean)
  const artN = arts.length
  const trks = [s.track, s.track2, s.track3].filter(Boolean).length
  if (genre === 'Synthwave' && s.hardware) b += 0.5
  if ((genre === 'Rock' || genre === 'Industrial') && artN) b += 0.4 * artN
  if ((genre === 'Electronica' || genre === 'Jazz-Fusion' || genre === 'Drone') && trks) b += 0.3 * trks
  if (genre === 'Metal' && s.hardware) b += 0.5
  if (genre === 'Trap-AI' && s.hardware) b += 0.6
  if ((genre === 'Punk' || genre === 'Punk-AI') && artN) b += (genre === 'Punk' ? 0.2 : 0.3) * artN
  if (genre === 'Jazz') b += 0.5 * arts.filter(a => a && a.talent! >= 30).length
  if (genre === 'Classical' && trks >= 3) b += 1
  if (genre === 'Reggae') b += 0.3 * activeStages
  return b
}

export function stageCostMod(genre: string): number {
  return genre === 'Punk' ? -1 : 0
}

// ── Pixel-art Sprites ─────────────────────────────────────────────────────────

function px(grid: string[], palette: Record<string, string>): string {
  const cell = 10
  const w = grid[0].length * cell
  const h = grid.length * cell
  let rects = ''
  for (let y = 0; y < grid.length; y++) {
    const row = grid[y]
    for (let x = 0; x < row.length; x++) {
      const ch = row[x]
      if (ch === '.' || !palette[ch]) continue
      rects += `<rect x="${x * cell}" y="${y * cell}" width="${cell}" height="${cell}" fill="${palette[ch]}"/>`
    }
  }
  return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;image-rendering:pixelated;display:block">${rects}</svg>`
}

const RAW_SPRITES: Record<string, SpriteDef> = {
  'Small Stage': { p: { a: '#ffee00', b: '#ff8800', c: '#1c1c38', s: '#00ffff' }, g: ['ssssssssss', 's........s', 's.aaaaaa.s', 's.a....a.s', 's.a.bb.a.s', 's.aaaaaa.s', 'cccccccccc', 'c.c.c.c.cc', 'cccccccccc', 'cccccccccc'] },
  'Medium Stage': { p: { a: '#00ffff', b: '#ff00aa', c: '#1c1c38', s: '#ffee00' }, g: ['s.s.s.s.s.', 'ssssssssss', 's.aaaaaa.s', 's.abbbba.s', 's.abbbba.s', 's.aaaaaa.s', 'cccccccccc', 'c.cc.cc.cc', 'cccccccccc', 'cccccccccc'] },
  'Large Stage': { p: { a: '#ff00aa', b: '#ffee00', c: '#1c1c38', s: '#00ff66' }, g: ['s.s.s.s.s.', 'ssssssssss', 'saaaaaaaas', 'sabbbbbbas', 'sabb..bbas', 'sabbbbbbas', 'saaaaaaaas', 'cccccccccc', 'cc.cc.cc.c', 'cccccccccc'] },
  'Festival Main': { p: { a: '#ffee00', b: '#ff00aa', c: '#00ffff', d: '#1c1c38', s: '#ff8800' }, g: ['s.c.s.c.s.', 'cssssssscc', 'caaaaaaaac', 'cabbbbbbac', 'cab.cc.bac', 'cabbccbbac', 'caaaaaaaac', 'dddddddddd', 'dd.dd.dd.d', 'dddddddddd'] },
  'Synth Wizard': { p: { a: '#cc44ff', b: '#ffffff', c: '#ffee00', s: '#00ffff' }, g: ['.s.aaaa.s.', '..aaaaaa..', '..abbbba..', '..ab..ba..', '..aaaaaa..', '...cccc...', '..cccccc..', '..c.cc.c..', '..c....c..', '..cc..cc..'] },
  'Beat Machine': { p: { a: '#ff8800', b: '#1c1c38', c: '#ffee00', s: '#ff2244' }, g: ['..aaaaaa..', '.aaaaaaaa.', 'aa.cc.cc.a', 'aabbbbbbaa', 'aabsssbsaa', 'aabbbbbbaa', '.aaaaaaaa.', '..a.aa.a..', '..a....a..', '..aa..aa..'] },
  'Neural Vocalist': { p: { a: '#ff00aa', b: '#ffffff', c: '#ffee00', s: '#cc44ff' }, g: ['...aaaa...', '..aaaaaa..', '..abbbba..', '..abssba..', '..aaaaaa..', '....cc....', '....cc....', '...cccc...', '..c.cc.c..', '..cc..cc..'] },
  'Bass Controller': { p: { a: '#00ffff', b: '#1c1c38', c: '#ffee00', s: '#ff00aa' }, g: ['..aaaa....', '.aaaaaa...', '..abba....', '..aaaa....', '...cc..s..', '...cc.ss..', '...cccsss.', '...c.cc.s.', '...c..c...', '...cc.cc..'] },
  'The Manager': { p: { a: '#ffee00', b: '#ffffff', c: '#ff8800', s: '#1c1c38' }, g: ['...aaaa...', '..aaaaaa..', '..abssba..', '..abbbba..', '..aaaaaa..', '...c..c...', '..cccccc..', '..c.cc.c..', '..c....c..', '..cc..cc..'] },
  'Data Stream': { p: { a: '#00ffff', b: '#00ff66', c: '#ffee00' }, g: ['..a....a..', '.a.b..b.a.', 'a.b.cc.b.a', 'a..bccb..a', '.a.bccb.a.', '..abccba..', '...bccb...', '..abccba..', '.a.bccb.a.', 'a..b..b..a'] },
  'Bit Residue': { p: { a: '#00ff66', b: '#1c1c38' }, g: ['a.a.a.a.a.', '.a...a...a', 'a..a...a..', '.a.a.a.a.a', 'a.....a..a', '.a.a...a.a', 'a...a.a..a', '.a.a...a.a', 'a..a.a..a.', '.a...a.a.a'] },
  'Hypnotic Loop': { p: { a: '#cc44ff', b: '#ff00aa', c: '#ffffff' }, g: ['..aaaaaa..', '.a......a.', 'a..bbbb..a', 'a.b....b.a', 'a.b.cc.b.a', 'a.b.cc.b.a', 'a.b....b.a', 'a..bbbb..a', '.a......a.', '..aaaaaa..'] },
  'Megahit': { p: { a: '#ff00aa', b: '#ffffff', c: '#ffee00' }, g: ['..a....a..', '.aabbbbaa.', 'a.bccccb.a', 'a.bcaacb.a', 'a.bcaacb.a', 'a.bccccb.a', '.aabbbbaa.', '..a.cc.a..', '...cccc...', '..a....a..'] },
  'Valve Pre-Amp': { p: { a: '#ff8800', b: '#ffee00', c: '#1c1c38', s: '#ffffff' }, g: ['..aaaaaa..', '..a....a..', '..a.bb.a..', '..a.bb.a..', '..absba...', '..abbba...', 'cccccccccc', 'c.s.s.s.cc', 'c......ccc', 'cccccccccc'] },
  'Eurorack Drive': { p: { a: '#ffee00', b: '#ff2244', c: '#00ffff', d: '#1c1c38' }, g: ['dddddddddd', 'd.a.a.a.ad', 'd.a.a.a.ad', 'd.b.c.b.cd', 'd.c.b.c.bd', 'd.a.a.a.ad', 'd......ccd', 'd.bcbcbc.d', 'd......ccd', 'dddddddddd'] },
  'Studio Engineer': { p: { a: '#00ff66', b: '#ffee00', c: '#1c1c38', s: '#ff8800' }, g: ['cccccccccc', 'c.a.a.a.ac', 'c.s.s.s.sc', 'c.a.a.a.ac', 'c.bbbbbb.c', 'c.b.cc.b.c', 'c.bbbbbb.c', 'c.a.a.a.ac', 'c.s.s.s.sc', 'cccccccccc'] },
  'Malware Worm': { p: { a: '#ff2244', b: '#1c1c38', c: '#ffee00' }, g: ['a........a', '.a.aaaa.a.', '..acccca..', '.acbbbbca.', 'aacb..bcaa', 'aacb..bcaa', '.acbbbbca.', '..acccca..', '.a.aaaa.a.', 'a........a'] },
  'Track Corruptor': { p: { a: '#ff2244', b: '#ff00aa', c: '#1c1c38' }, g: ['a.b.c.a.b.', '..ab.c.a.c', 'a.c.ab.c.b', '.b.a.c.ab.', 'ab.c.a.b.c', 'c.b.ab.c.a', '.a.cb.a.b.', 'b.c.a.cb.a', 'a.b.c.ab.c', '.c.a.b.c.a'] },
  'Artist Poacher': { p: { a: '#cc44ff', b: '#1c1c38', c: '#ff2244' }, g: ['...aaaa...', '..a....a..', '..a.cc.a..', '..a....a..', '...aaaa...', '....bb....', '..bbbbbb..', '.b.bbbb.b.', '...b..b...', '..bb..bb..'] },
  'EMP Blast': { p: { a: '#00ffff', b: '#ffffff', c: '#ff2244' }, g: ['....b.....', '..b.b.b...', '.b..c..b..', 'b..ccc..b.', 'bccaaaccb.', 'b..ccc..b.', '.b..c..b..', '..b.b.b..b', '....b....b', '....b.....'] },
  'Firewall Shield': { p: { a: '#00ff66', b: '#ffffff', c: '#1c1c38' }, g: ['..aaaaaa..', '.aaaaaaaa.', 'aa.bbbb.aa', 'aabb..bbaa', 'aab.cc.baa', 'aab.cc.baa', 'aabb..bbaa', '.aabbbbaa.', '..aaaaaa..', '...aaaa...'] },
  'Decoy Booth': { p: { a: '#00ff66', b: '#1c1c38', c: '#ffee00' }, g: ['..aaaaaa..', '..a....a..', '..acccca..', '..ac..ca..', '..ac..ca..', '..acccca..', '..a....a..', '..aaaaaa..', '..a.bb.a..', '..aaaaaa..'] },
  'Guest Feature': { p: { a: '#ff88ff', b: '#ffffff', c: '#00ffff' }, g: ['.aa....cc.', 'aaaa..cccc', '.aa....cc.', '..a....c..', '..aaaacc..', '..a.cc.c..', '..a....c..', '..aa..cc..', '..a....c..', '..aa..cc..'] },
  'Encore': { p: { a: '#ff88ff', b: '#ffee00', c: '#ffffff' }, g: ['b..b..b..b', '.b.b.b.b.b', '..aaaaaa..', '.aaaaaaaa.', 'aa.cc.cc.a', 'aacccccca', 'aa.cccc.aa', '.aaaaaaaa.', '..aaaaaa..', '..a....a..'] },
  'Brand Deal': { p: { a: '#ffee00', b: '#ff8800', c: '#1c1c38' }, g: ['..aaaaaa..', '.aaaaaaaa.', 'aa.cccc.aa', 'aacbbbbcaa', 'aac.bb.caa', 'aacbbbbcaa', 'aac.bb.caa', 'aacbbbbcaa', '.aaaaaaaa.', '..aaaaaa..'] },
  'Radio Play': { p: { a: '#44eeff', b: '#ffee00', c: '#1c1c38' }, g: ['....a.....', '...aaa....', '..a.a.a...', '.a.aaa.a..', 'a.a.a.a.a.', '..aaaaa...', '....a.....', '...bbb....', '...bbb....', '..bbbbb..'] },
  'Viral Hit': { p: { a: '#ff8800', b: '#ff2244', c: '#ffee00' }, g: ['....c.....', '..b.c.b...', '.b..c..b..', 'b..ccc..b.', 'bccaaaccb.', 'b..ccc..b.', '.b..c..b..', '..b.c.b...', '....c.....', '....c.....'] },
  'Demo Tape': { p: { a: '#00ffff', b: '#1c1c38', c: '#ffee00', s: '#ffffff' }, g: ['aaaaaaaaaa', 'a........a', 'a.bb..bb.a', 'a.bb..bb.a', 'a.b.cc.b.a', 'a.bccccb.a', 'a.b.cc.b.a', 'a.bb..bb.a', 'a........a', 'aaaaaaaaaa'] },
  'Bootleg': { p: { a: '#ff8800', b: '#1c1c38', c: '#ffee00', s: '#ff2244' }, g: ['aaaaaaaaaa', 'a.s....s.a', 'a.bb..bb.a', 'a.b.cc.b.a', 'a.bccccb.a', 'a.b.cc.b.a', 'a.bb..bb.a', 'a.s....s.a', 'a........a', 'aaaaaaaaaa'] },
  'Industrial Arena': { p: { a: '#ff00aa', b: '#1c1c38', c: '#00ffff' }, g: ['c.c.c.c.c.', 'cccccccccc', 'caaaaaaaac', 'cabbbbbbac', 'cabbbbbbac', 'caaaaaaaac', 'bbbbbbbbbb', 'bb.bb.bb.b', 'bbbbbbbbbb', 'bbbbbbbbbb'] },
}

const FALLBACK_SPRITE: SpriteDef = {
  p: { a: '#445566', b: '#00ffff' },
  g: ['..bbbb....', '.b....b...', 'b..bb..b..', '...b...b..', '..b....b..', '..b....b..', '..bbbb....', '..........', '..b.......', '..b.......'],
}

const spriteCache = new Map<string, string>()

export function getSprite(card: { name: string } | null | undefined): string {
  if (!card) return ''
  const name = card.name
  if (spriteCache.has(name)) return spriteCache.get(name)!
  // 32×32 art first (lib/sprites), the old 10×10 grids as fallback
  const def = RAW_SPRITES[name] ?? FALLBACK_SPRITE
  const svg = sprite32Svg(name) ?? px(def.g, def.p)
  spriteCache.set(name, svg)
  return svg
}

// ── Phase transition sprites ───────────────────────────────────────────────────

const PHASE_SPRITES: Record<string, SpriteDef> = {
  ARRANGEMENT: { p: { a: '#ffee00', b: '#00ffff', c: '#ff00aa' }, g: ['..a....a..', '.aaa..aaa.', '..a....a..', '.aaa..aaa.', 'b.b.b.b.b.', 'bbbbbbbbbb', 'b.c.c.c.cb', 'b.c.c.c.cb', 'bbbbbbbbbb', 'b.b..b..bb'] },
  SOUNDCHECK: { p: { a: '#00ffff', b: '#00ff66', c: '#cc44ff' }, g: ['....aa....', '...a..a...', '..a....a..', 'cb......bc', 'cba....abc', 'cba....abc', 'cb......bc', '..a....a..', '...a..a...', '....aa....'] },
  'LIVE SHOW': { p: { a: '#ff2244', b: '#ffee00', c: '#ffffff' }, g: ['....c.....', '..c.c.c...', '.c.cbc.c..', 'c.cbabc.c.', 'cbaa cabc.', 'cbaaaaabc.', 'c.cbabc.c.', '.c.cbc.c..', '..c.c.c...', '....c.....'] },
  RESULTS: { p: { a: '#ffee00', b: '#ff8800', c: '#1c1c38', s: '#ffffff' }, g: ['..aaaaaa..', 'a.aaaaaa.a', 'a.aaaaaa.a', 'aa.aaaa.aa', '.aa.aa.aa.', '...aaaa...', '....aa....', '...cccc...', '..cccccc..', '.cccccccc.'] },
}

export function getPhaseSprite(phase: string): string {
  const def = PHASE_SPRITES[phase] ?? FALLBACK_SPRITE
  return px(def.g, def.p)
}

// ── Card phase eligibility ────────────────────────────────────────────────────

// must agree with isPhaseOk below — that is what the engine enforces
export function cardPhaseLabel(type: string): string {
  if (['stage', 'artist', 'draw', 'collab', 'viral', 'sponsor'].includes(type)) return 'ARRANGEMENT'
  if (['track', 'hardware', 'defense'].includes(type)) return 'SOUNDCHECK'
  if (type === 'attack') return 'LIVE SHOW'
  return '—'
}

export function isPhaseOk(type: string, phase: Phase): boolean {
  const bonus = ['collab', 'viral', 'sponsor'].includes(type)
  if (phase === 'ARRANGEMENT') return ['stage', 'artist', 'draw'].includes(type) || bonus
  if (phase === 'SOUNDCHECK') return ['track', 'hardware', 'defense'].includes(type)
  if (phase === 'LIVE SHOW') return type === 'attack'
  return false
}

export function isBonus(type: string): boolean {
  return ['collab', 'viral', 'sponsor'].includes(type)
}
