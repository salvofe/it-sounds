import type { CSSProperties } from 'react'
import type { Card } from '@/types/game'

// Card skins by music genre. Every skin shows the same information in the same
// place (type + main stat, art, name, description, long stat + BONUS mark);
// only the look changes. Three families, one palette per genre.

export type SkinFamily = 'neon' | 'collect' | 'poster'

export interface Skin {
  family: SkinFamily
  main: string      // frame / chip colour
  rgb?: string      // main as "r,g,b" (neon glow)
  alt?: string      // neon: medallion colour
  bg?: string       // neon: card ground
  paper?: string    // collect: card paper
  art?: string      // collect: art window ground
  label?: string    // collect: vinyl label
  ground?: string   // poster: chip + art ground
}

export const SKINS: Record<string, Skin> = {
  // A · Neon
  Synthwave: { family: 'neon', main: '#ff00aa', rgb: '255,0,170', alt: '#00ffff', bg: '#16061a' },
  Electronica: { family: 'neon', main: '#00ff66', rgb: '0,255,102', alt: '#ffee00', bg: '#041a0c' },
  Drone: { family: 'neon', main: '#3d7bff', rgb: '61,123,255', alt: '#a0f0ff', bg: '#060a1e' },
  // B · Collezionabile
  Jazz: { family: 'collect', main: '#b8862e', art: '#1f2a44', label: '#d4a24c', paper: '#f3e9d2' },
  Reggae: { family: 'collect', main: '#1f8a43', art: '#1f3a22', label: '#e8c33a', paper: '#f1ead0' },
  Classical: { family: 'collect', main: '#7a1f2b', art: '#3a1418', label: '#c9a34a', paper: '#f7f1e3' },
  'Jazz-Fusion': { family: 'collect', main: '#c2452d', art: '#2b1a14', label: '#e8a33d', paper: '#f0e6d0' },
  // C · Poster
  Rock: { family: 'poster', main: '#e63946', ground: '#111111' },
  Punk: { family: 'poster', main: '#ff2e88', ground: '#ffe14d' },
  'Hip-Hop': { family: 'poster', main: '#ffb703', ground: '#6a3ec2' },
  Industrial: { family: 'poster', main: '#d9622b', ground: '#1a1a1a' },
  Metal: { family: 'poster', main: '#a9adb5', ground: '#1a1a1a' },
  'Punk-AI': { family: 'poster', main: '#c6ff1a', ground: '#111111' },
  'Trap-AI': { family: 'poster', main: '#ff5a5a', ground: '#2a0a3a' },
}

export function skinFor(genre: string): Skin {
  return SKINS[genre] ?? SKINS.Synthwave
}

// colour per card type, shown as a small square in the type chip so types stay
// recognisable whatever the skin
export const TYPE_COLORS: Record<string, string> = {
  stage: '#ffee00', artist: '#00ffff', track: '#cc44ff', hardware: '#ff8800',
  attack: '#ff2244', defense: '#00ff66', collab: '#ff88ff', sponsor: '#44eeff',
  viral: '#ff8800', draw: '#ffee00',
}

const ATTACK_SHORT: Record<string, [string, string]> = {
  hardware: ['HW', 'DESTROYS HARDWARE'],
  track: ['TRK', 'DESTROYS A TRACK'],
  artist: ['ART', 'REMOVES AN ARTIST'],
  emp: ['EMP', 'HARDWARE + TRACK'],
}

// the two stat texts every card shows: short (top-right badge) and long (footer)
export function cardStats(c: Card): { main: string; long: string } {
  switch (c.type) {
    case 'stage': return { main: `${c.threshold}k`, long: `NEEDS ${c.threshold}k · COST ${c.cost}k` }
    case 'artist': return { main: `${c.talent}`, long: `TALENT ${c.talent}` }
    case 'track': return { main: `+${c.power}`, long: `POWER +${c.power}k` }
    case 'hardware': return { main: `×${c.multiplier}`, long: `MULTIPLIER ×${c.multiplier}` }
    case 'attack': { const [m, l] = ATTACK_SHORT[c.effect ?? 'hardware']; return { main: m, long: l } }
    case 'defense': return c.decoy ? { main: '1×', long: 'BLOCKS 1 ATTACK' } : { main: '∞', long: 'BLOCKS ALL ATTACKS' }
    case 'collab': return { main: `+${c.bonus}`, long: c.encore ? 'NO CONDITION' : 'NEEDS 2+ ARTISTS' }
    case 'sponsor': return { main: `+${c.income}`, long: `+${c.income}k HYPE` }
    case 'viral': return { main: `+${c.power}`, long: 'NEEDS 30+ TALENT' }
    case 'draw': return { main: `+${c.draw}`, long: c.discard ? `DRAW ${c.draw}, DISCARD ${c.discard}` : `DRAW ${c.draw}` }
    default: return { main: '', long: '' }
  }
}

// does this card feed the owner's genre bonus? (mirrors genreBonus in lib/data)
export function triggersGenreBonus(genre: string, c: Card): boolean {
  switch (genre) {
    case 'Synthwave': case 'Metal': case 'Trap-AI': return c.type === 'hardware'
    case 'Rock': case 'Industrial': case 'Punk-AI': return c.type === 'artist'
    case 'Electronica': case 'Jazz-Fusion': case 'Drone': case 'Classical': return c.type === 'track'
    case 'Hip-Hop': return c.type === 'sponsor'
    case 'Punk': return c.type === 'artist' || c.type === 'stage'
    case 'Jazz': return c.type === 'artist' && (c.talent ?? 0) >= 30
    case 'Reggae': return c.type === 'stage'
    default: return false
  }
}

// ── Styles for each part of the shared card layout ──────────────────────────

export interface CardStyles {
  card: CSSProperties; chip: CSSProperties; badge: CSSProperties; badgeText: CSSProperties
  art: CSSProperties; sprite: CSSProperties; name: CSSProperties; desc: CSSProperties
  foot: CSSProperties; bonus: CSSProperties
  vinyl?: CSSProperties; vinylLabel?: CSSProperties; holo: boolean
}

const BURST = 'polygon(50% 0%, 61% 18%, 82% 10%, 80% 32%, 100% 40%, 85% 55%, 96% 76%, 74% 78%, 68% 100%, 50% 86%, 32% 100%, 26% 78%, 4% 76%, 15% 55%, 0% 40%, 20% 32%, 18% 10%, 39% 18%)'

export function cardStyles(s: Skin): CardStyles {
  if (s.family === 'neon') {
    return {
      card: { borderRadius: 12, border: `3px solid ${s.main}`, background: `linear-gradient(180deg, rgba(${s.rgb},0.16), ${s.bg} 45%)`, boxShadow: `0 0 20px rgba(${s.rgb},0.4)` },
      chip: { fontFamily: "'Press Start 2P', monospace", fontSize: 9, padding: '5px 6px', borderRadius: 4, background: s.main, color: '#07071a' },
      badge: { width: 44, height: 44, borderRadius: '50%', background: '#07071a', color: s.alt, border: `3px solid ${s.alt}`, boxShadow: `0 0 10px ${s.alt}` },
      badgeText: { fontFamily: "'Press Start 2P', monospace", fontSize: 10 },
      art: { borderRadius: 8, background: `radial-gradient(circle at 50% 45%, rgba(${s.rgb},0.38), #05051a 70%)`, border: `1px solid rgba(${s.rgb},0.55)` },
      sprite: { filter: 'drop-shadow(0 0 6px rgba(255,255,255,0.35))' },
      name: { fontFamily: "'Press Start 2P', monospace", fontSize: 10, lineHeight: 1.5, color: '#ffffff' },
      desc: { fontFamily: "'VT323', monospace", fontSize: 18, lineHeight: 1.05, color: '#c4c8e8' },
      foot: { fontFamily: "'VT323', monospace", fontSize: 17, color: s.main },
      bonus: { fontFamily: "'Press Start 2P', monospace", fontSize: 8, padding: '4px 5px', borderRadius: 4, background: '#ffee00', color: '#07071a', boxShadow: '0 0 8px #ffee00' },
      holo: true,
    }
  }
  if (s.family === 'collect') {
    return {
      card: { borderRadius: 14, background: s.paper, border: '3px solid #2a1d14', boxShadow: `4px 6px 0 ${s.main}, 0 10px 18px rgba(0,0,0,0.45)` },
      chip: { fontFamily: "'Space Mono', monospace", fontSize: 10, fontWeight: 700, letterSpacing: 1, padding: '4px 8px', borderRadius: 999, background: s.main, color: '#fff6e6' },
      badge: { width: 44, height: 44, borderRadius: 8, background: '#2a1d14', color: s.paper },
      badgeText: { fontFamily: "'Bungee', sans-serif", fontSize: 15, lineHeight: 1 },
      art: { borderRadius: 4, background: s.art, border: '3px solid #2a1d14' },
      sprite: {},
      name: { fontFamily: "'Bungee', sans-serif", fontSize: 14, lineHeight: 1.1, color: '#2a1d14' },
      desc: { fontFamily: "'Space Mono', monospace", fontSize: 11, lineHeight: 1.35, color: '#5a4636' },
      foot: { fontFamily: "'Space Mono', monospace", fontSize: 10, fontWeight: 700, letterSpacing: 1, color: '#6e5230' },
      bonus: { fontFamily: "'Space Mono', monospace", fontSize: 10, fontWeight: 700, padding: '3px 7px', borderRadius: 999, background: '#2a1d14', color: '#ffd23f' },
      vinyl: { position: 'absolute', top: 10, right: -16, width: 112, height: 112, borderRadius: '50%', background: 'repeating-radial-gradient(circle, #141010 0 3px, #221a17 3px 5px)', boxShadow: '0 6px 14px rgba(0,0,0,0.5)' },
      vinylLabel: { position: 'absolute', inset: 39, borderRadius: '50%', background: s.label, border: `5px solid ${s.paper}` },
      holo: false,
    }
  }
  const darkGround = s.ground !== '#ffe14d'
  return {
    card: { borderRadius: 6, background: s.main, border: '4px solid #111111', boxShadow: '0 0 0 5px #ffffff, 6px 8px 0 5px #000000' },
    chip: { fontFamily: "'Rubik Mono One', sans-serif", fontSize: 10, background: s.ground, color: darkGround ? '#ffffff' : '#111111', padding: '4px 6px', transform: 'rotate(-3deg)' },
    badge: { width: 48, height: 48, background: '#ffffff', color: '#111111', clipPath: BURST },
    badgeText: { fontFamily: "'Rubik Mono One', sans-serif", fontSize: 12, transform: 'rotate(-12deg)' },
    art: { background: s.ground, border: '4px solid #111111', backgroundImage: 'radial-gradient(rgba(255,255,255,0.18) 2px, transparent 2.5px)', backgroundSize: '10px 10px' },
    sprite: { filter: 'drop-shadow(3px 3px 0 #111111)' },
    name: { fontFamily: "'Permanent Marker', cursive", fontSize: 19, lineHeight: 1, color: '#111111' },
    desc: { fontFamily: "'Archivo', sans-serif", fontSize: 12, fontWeight: 500, lineHeight: 1.3, color: '#111111' },
    foot: { fontFamily: "'Rubik Mono One', sans-serif", fontSize: 9, color: '#111111' },
    bonus: { fontFamily: "'Rubik Mono One', sans-serif", fontSize: 9, padding: '3px 6px', background: '#ffee00', color: '#111111', border: '2px solid #111111', transform: 'rotate(3deg)' },
    holo: false,
  }
}
