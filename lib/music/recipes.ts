// ── Base viva: genre recipes ─────────────────────────────────────────────────
// Pure data, no Tone import. Ported verbatim from the approved prototype
// (docs/superpowers/specs/assets/base-viva.html, object G).
// root = bass-octave MIDI note of the key. prog = 4 bars [semitones from root, quality].
// parts = drum layers unlocked by stage 1, 2, 3. 'x' hit, 'o' ghost note.
// Voice patterns (16 steps): bass 'x' root 'o' octave 'f' fifth 'w' walk; '-' sustains.
// lead digits = chord-tone index. Motifs: "step:degree:length" over 2 bars (32 steps).

export type ChordQuality = 'maj' | 'min' | '5' | '7' | 'm7' | 'maj7'
export type ScaleName = 'minor' | 'major' | 'minpent' | 'harm'
export type DrumVoice = 'kick' | 'snare' | 'hat'

export interface Env { attack: number; decay: number; sustain: number; release: number }
export interface Voice { osc: string; e?: Env; vol: number; dist?: number; porta?: number; p?: string }
type PatternVoice = Voice & { p: string }

export interface Recipe {
  icon: string
  color: string
  bpm: number
  swing: number
  sub?: '8n' | '16n'
  root: number
  scale: ScaleName
  verb: number
  blurb: string
  prog: [number, ChordQuality][]
  kit: {
    kick: { note: string; decay: number; vol: number }
    snare: { decay: number; vol: number; hp: number }
    hat: { decay: number; vol: number }
  }
  parts: { v: DrumVoice; n: string; p: string }[]
  names: string[]
  v: { base: Voice; bass: PatternVoice; chords: PatternVoice; lead: PatternVoice; counter: PatternVoice; melody: Voice; sparkle: Voice }
  A: string
  B: string
}

export const CHORD: Record<ChordQuality, number[]> = { maj: [0, 4, 7], min: [0, 3, 7], '5': [0, 7, 12], '7': [0, 4, 7, 10], m7: [0, 3, 7, 10], maj7: [0, 4, 7, 11] }
export const SCALE: Record<ScaleName, number[]> = { minor: [0, 2, 3, 5, 7, 8, 10], major: [0, 2, 4, 5, 7, 9, 11], minpent: [0, 3, 5, 7, 10], harm: [0, 2, 3, 5, 7, 8, 11] }

const env = (attack: number, decay: number, sustain: number, release: number): Env => ({ attack, decay, sustain, release })

export const RECIPES: Record<string, Recipe> = {
  Synthwave: { icon:'🎹', color:'#ff4fd8', bpm:100, swing:0, root:45, scale:'minor', verb:.35,
    blurb:'Arpeggi a dente di sega, batteria con riverbero lungo.',
    prog:[[0,'min'],[8,'maj'],[3,'maj'],[10,'maj']],
    kit:{ kick:{ note:'A1', decay:.45, vol:-4 }, snare:{ decay:.28, vol:-12, hp:1200 }, hat:{ decay:.04, vol:-24 } },
    parts:[{ v:'kick', n:'CASSA', p:'x.......x.......' }, { v:'snare', n:'RULLANTE', p:'....x.......x...' }, { v:'hat', n:'HI-HAT', p:'..x...x...x...x.' }],
    names:['BASSO SAW','PAD LARGO','ARPEGGIO','LEAD VETRO'],
    v:{ base:{ osc:'sine', vol:-22 },
        bass:{ osc:'sawtooth', e:env(.005,.15,.4,.08), vol:-14, p:'xoxoxoxoxoxoxoxo' },
        chords:{ osc:'fatsawtooth', e:env(.06,.3,.7,1.2), vol:-24, p:'x---------------' },
        lead:{ osc:'square', e:env(.005,.08,.2,.1), vol:-24, p:'0.1.2.3.2.1.0.1.' },
        counter:{ osc:'triangle', e:env(.04,.2,.6,.9), vol:-20, p:'x-------x-------' },
        melody:{ osc:'sawtooth', e:env(.01,.2,.5,.3), vol:-17 },
        sparkle:{ osc:'sine', vol:-26 } },
    A:'0:4:4 4:2:4 8:0:6 14:1:2 16:2:4 20:4:4 24:3:8', B:'0:4:4 4:5:4 8:7:6 14:6:2 16:4:4 20:2:4 24:0:8' },
  Rock: { icon:'🎸', color:'#ff6a3d', bpm:130, swing:0, root:40, scale:'minpent', verb:.15,
    blurb:'Power chord distorti, basso in ottavi.',
    prog:[[0,'5'],[8,'5'],[10,'5'],[5,'5']],
    kit:{ kick:{ note:'E1', decay:.3, vol:-3 }, snare:{ decay:.2, vol:-9, hp:900 }, hat:{ decay:.05, vol:-22 } },
    parts:[{ v:'kick', n:'CASSA', p:'x.....x.x.......' }, { v:'snare', n:'RULLANTE', p:'....x.......x..o' }, { v:'hat', n:'CHARLESTON', p:'x.x.x.x.x.x.x.x.' }],
    names:['BASSO','CHITARRA RITMICA','RIFF','CORO'],
    v:{ base:{ osc:'triangle', vol:-24 },
        bass:{ osc:'square', e:env(.005,.15,.5,.05), vol:-15, p:'x.x.x.x.x.x.x.x.' },
        chords:{ osc:'sawtooth', e:env(.005,.15,.6,.1), vol:-22, dist:.7, p:'x-.x-.x-x-.x-.x-' },
        lead:{ osc:'square', e:env(.005,.1,.3,.1), vol:-24, dist:.4, p:'0..1..2.3..2..1.' },
        counter:{ osc:'triangle', e:env(.03,.2,.7,.5), vol:-20, p:'x-------x-------' },
        melody:{ osc:'sawtooth', e:env(.01,.1,.7,.2), vol:-18, dist:.5 },
        sparkle:{ osc:'square', vol:-30 } },
    A:'0:0:2 2:1:2 4:2:4 8:1:2 10:0:2 12:1:4 16:3:2 18:2:2 20:1:4 24:0:8', B:'0:4:2 2:3:2 4:2:4 8:3:2 10:4:2 12:5:4 16:4:6 24:2:8' },
  Electronica: { icon:'🎛', color:'#3df2ff', bpm:125, swing:0, root:41, scale:'minor', verb:.25,
    blurb:'Cassa dritta, onde quadre, basso in levare.',
    prog:[[0,'m7'],[0,'m7'],[8,'maj7'],[10,'maj']],
    kit:{ kick:{ note:'F1', decay:.35, vol:-2 }, snare:{ decay:.12, vol:-12, hp:1800 }, hat:{ decay:.03, vol:-22 } },
    parts:[{ v:'kick', n:'CASSA DRITTA', p:'x...x...x...x...' }, { v:'snare', n:'CLAP', p:'....x.......x...' }, { v:'hat', n:'HAT APERTO', p:'..x...x...x.o.x.' }],
    names:['BASSO IN LEVARE','STAB','ARPEGGIO 16','PAD'],
    v:{ base:{ osc:'sine', vol:-22 },
        bass:{ osc:'square', e:env(.005,.12,.3,.05), vol:-15, p:'..x...x...x...x.' },
        chords:{ osc:'square', e:env(.005,.15,.0,.1), vol:-22, p:'...x.....x..x...' },
        lead:{ osc:'square', e:env(.005,.06,.1,.05), vol:-26, p:'0123012301230123' },
        counter:{ osc:'fattriangle', e:env(.08,.3,.7,1), vol:-22, p:'x---------------' },
        melody:{ osc:'pulse', e:env(.01,.1,.5,.2), vol:-19 },
        sparkle:{ osc:'sine', vol:-27 } },
    A:'0:0:2 3:2:2 6:4:2 10:3:2 12:2:4 16:0:2 19:2:2 22:6:2 26:4:6', B:'0:7:2 3:6:2 6:4:2 10:3:2 12:4:4 16:2:2 19:3:2 22:1:2 26:0:6' },
  'Hip-Hop': { icon:'🎤', color:'#ffd23d', bpm:88, swing:.35, sub:'16n', root:36, scale:'minpent', verb:.2,
    blurb:'Groove con swing, 808 lungo, accordi di settima.',
    prog:[[0,'m7'],[5,'m7'],[8,'maj7'],[7,'7']],
    kit:{ kick:{ note:'C1', decay:.6, vol:-2 }, snare:{ decay:.18, vol:-9, hp:1400 }, hat:{ decay:.03, vol:-22 } },
    parts:[{ v:'kick', n:'KICK', p:'x.....x...x....o' }, { v:'snare', n:'SNARE', p:'....x.......x...' }, { v:'hat', n:'HAT', p:'x.xox.x.x.xox.x.' }],
    names:['808','RHODES','PLUCK','VOCE PAD'],
    v:{ base:{ osc:'triangle', vol:-24 },
        bass:{ osc:'sine', e:env(.005,.6,.6,.3), vol:-8, porta:.04, p:'x-----x---x-----' },
        chords:{ osc:'fmsine', e:env(.01,.6,.3,.8), vol:-20, p:'x-------..x-----' },
        lead:{ osc:'triangle', e:env(.005,.15,0,.1), vol:-20, p:'..2...1...3...0.' },
        counter:{ osc:'amsine', e:env(.06,.3,.6,1), vol:-24, p:'x---------------' },
        melody:{ osc:'triangle', e:env(.01,.2,.4,.3), vol:-16 },
        sparkle:{ osc:'sine', vol:-28 } },
    A:'2:4:2 4:3:2 8:2:4 14:1:2 16:2:6 26:0:4', B:'2:5:2 4:4:2 8:3:4 14:2:2 16:1:6 26:0:4' },
  Punk: { icon:'🤬', color:'#ff3d6e', bpm:170, swing:0, root:38, scale:'major', verb:.08,
    blurb:'Veloce, tutto in ottavi, chitarre sature.',
    prog:[[0,'5'],[7,'5'],[9,'5'],[5,'5']],
    kit:{ kick:{ note:'D1', decay:.25, vol:-3 }, snare:{ decay:.16, vol:-8, hp:900 }, hat:{ decay:.04, vol:-22 } },
    parts:[{ v:'kick', n:'CASSA', p:'x...x...x...x...' }, { v:'snare', n:'RULLANTE', p:'..x...x...x...x.' }, { v:'hat', n:'PIATTI', p:'x.x.x.x.x.x.x.x.' }],
    names:['BASSO','CHITARRA','SECONDA CHIT.','CORI'],
    v:{ base:{ osc:'triangle', vol:-24 },
        bass:{ osc:'square', e:env(.005,.1,.5,.05), vol:-15, p:'x.x.x.x.x.x.x.x.' },
        chords:{ osc:'sawtooth', e:env(.005,.1,.6,.05), vol:-22, dist:.8, p:'x.x.x.x.x.x.x.x.' },
        lead:{ osc:'square', e:env(.005,.08,.4,.05), vol:-25, dist:.5, p:'0.0.1.1.2.2.1.1.' },
        counter:{ osc:'triangle', e:env(.05,.2,.8,.3), vol:-20, p:'x---x---x---x---' },
        melody:{ osc:'sawtooth', e:env(.01,.1,.7,.1), vol:-18, dist:.4 },
        sparkle:{ osc:'square', vol:-30 } },
    A:'0:4:4 4:4:4 8:5:4 12:4:4 16:2:8 24:0:8', B:'0:4:4 4:5:4 8:6:4 12:7:4 16:5:8 24:4:8' },
  Jazz: { icon:'🎷', color:'#ffb347', bpm:120, swing:.55, sub:'8n', root:41, scale:'major', verb:.3,
    blurb:'Swing, basso walking, ii-V-I con settime.',
    prog:[[2,'m7'],[7,'7'],[0,'maj7'],[9,'7']],
    kit:{ kick:{ note:'F1', decay:.25, vol:-14 }, snare:{ decay:.22, vol:-20, hp:2500 }, hat:{ decay:.18, vol:-24 } },
    parts:[{ v:'hat', n:'RIDE', p:'x...x.xox...x.xo' }, { v:'snare', n:'SPAZZOLE', p:'....x.......x...' }, { v:'kick', n:'CASSA PIUMA', p:'x...x...x...x...' }],
    names:['CONTRABBASSO','COMP PIANO','VIBRAFONO','SEZIONE FIATI'],
    v:{ base:{ osc:'sine', vol:-24 },
        bass:{ osc:'triangle', e:env(.01,.3,.3,.2), vol:-10, p:'w...w...w...w...' },
        chords:{ osc:'fmsine', e:env(.005,.4,.2,.4), vol:-21, p:'...x-.....x-....' },
        lead:{ osc:'sine', e:env(.005,.5,0,.4), vol:-20, p:'0.2.1.3...2.1...' },
        counter:{ osc:'fatsawtooth', e:env(.03,.3,.6,.5), vol:-28, p:'x-------....x---' },
        melody:{ osc:'fmsquare', e:env(.02,.2,.5,.2), vol:-22 },
        sparkle:{ osc:'sine', vol:-28 } },
    A:'0:4:3 3:5:1 4:6:2 6:7:2 8:9:4 12:7:2 14:6:2 16:4:4 20:2:2 22:1:2 24:0:8', B:'0:2:2 2:3:2 4:4:2 6:6:2 8:8:3 11:7:1 12:6:4 16:5:4 20:4:4 24:3:8' },
  Reggae: { icon:'🌿', color:'#5be37a', bpm:75, swing:.15, sub:'16n', root:43, scale:'minor', verb:.4,
    blurb:'One drop sul terzo tempo, accordi in levare, basso profondo.',
    prog:[[0,'min'],[5,'min'],[0,'min'],[7,'maj']],
    kit:{ kick:{ note:'G1', decay:.4, vol:-3 }, snare:{ decay:.1, vol:-12, hp:3000 }, hat:{ decay:.03, vol:-23 } },
    parts:[{ v:'kick', n:'ONE DROP', p:'........x.......' }, { v:'snare', n:'RIMSHOT', p:'........x.......' }, { v:'hat', n:'HAT', p:'x.x.x.x.x.x.x.x.' }],
    names:['BASSO DUB','SKANK','ORGANO BUBBLE','FIATI'],
    v:{ base:{ osc:'sine', vol:-22 },
        bass:{ osc:'sine', e:env(.01,.4,.6,.2), vol:-7, p:'x-----f-x.......' },
        chords:{ osc:'square', e:env(.005,.08,0,.05), vol:-20, p:'....x.......x...' },
        lead:{ osc:'triangle', e:env(.005,.06,0,.05), vol:-22, p:'..0.1...2.1.....' },
        counter:{ osc:'sawtooth', e:env(.05,.2,.6,.3), vol:-24, p:'x---....x---....' },
        melody:{ osc:'square', e:env(.02,.2,.5,.3), vol:-20 },
        sparkle:{ osc:'sine', vol:-28 } },
    A:'4:4:4 12:3:4 16:2:4 20:0:8', B:'4:4:2 6:5:2 8:7:4 12:6:4 16:4:8 24:2:8' },
  Classical: { icon:'🎻', color:'#c9b8ff', bpm:90, swing:0, root:38, scale:'harm', verb:.45,
    blurb:'Niente batteria vera: timpani, archi e clavicembalo.',
    prog:[[0,'min'],[5,'min'],[7,'7'],[0,'min']],
    kit:{ kick:{ note:'D2', decay:1.1, vol:-6 }, snare:{ decay:.35, vol:-26, hp:4000 }, hat:{ decay:.02, vol:-28 } },
    parts:[{ v:'kick', n:'TIMPANI', p:'x.......x...o.o.' }, { v:'snare', n:'RULLO SOFFICE', p:'x...x...x...x...' }, { v:'hat', n:'TRIANGOLO', p:'..x...x...x...x.' }],
    names:['VIOLONCELLI','ARCHI','CLAVICEMBALO','CORNO'],
    v:{ base:{ osc:'sine', vol:-22 },
        bass:{ osc:'triangle', e:env(.02,.3,.8,.6), vol:-12, p:'x-------x-------' },
        chords:{ osc:'fatsawtooth', e:env(.08,.4,.6,1.4), vol:-27, p:'x---------------' },
        lead:{ osc:'square', e:env(.005,.12,0,.1), vol:-27, p:'0212021202120212' },
        counter:{ osc:'fattriangle', e:env(.05,.3,.7,.8), vol:-21, p:'x-------x-------' },
        melody:{ osc:'triangle', e:env(.05,.2,.6,.5), vol:-15 },
        sparkle:{ osc:'sine', vol:-28 } },
    A:'0:4:4 4:3:2 6:2:2 8:1:4 12:0:4 16:2:4 20:4:4 24:6:4 28:7:4', B:'0:7:4 4:6:2 6:5:2 8:4:4 12:3:4 16:2:4 20:1:4 24:0:8' },
}

export const DEFAULT_GENRE = 'Synthwave'

export function recipeFor(genre: string): Recipe {
  return RECIPES[genre] ?? RECIPES[DEFAULT_GENRE]
}

// step → [scale degree, length in sixteenths]
export type Motif = Record<number, [number, number]>
const motifs = new Map<string, Motif>()

export function parseMotif(src: string): Motif {
  const hit = motifs.get(src)
  if (hit) return hit
  const m: Motif = {}
  for (const t of src.split(' ')) {
    const [s, d, l] = t.split(':').map(Number)
    m[s] = [d, l]
  }
  motifs.set(src, m)
  return m
}
