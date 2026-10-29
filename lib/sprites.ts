// 32×32 pixel-art card sprites. Each sprite is drawn with a few primitives on a
// shared 24-colour palette, then gets an automatic dark outline so they all
// read as one set. Rendered once to SVG and cached (see getSprite in lib/data).

export const SIZE = 32

export const PALETTE: Record<string, string> = {
  k: '#1b0b2e', w: '#ffffff', e: '#e8e8f0', n: '#9aa0b8', N: '#4a4a60', m: '#3a3a5a',
  y: '#ffee00', Y: '#c9a100', l: '#fff3a8', o: '#ff8800', r: '#ff2244', R: '#9a1030',
  p: '#ff2fa8', P: '#ff8fd2', c: '#00e5ff', C: '#b8fbff', b: '#2f6bff', B: '#1a2f7a',
  g: '#00ff66', G: '#0a8a3a', v: '#8f5cff', V: '#5b23c9', s: '#f6c9a8', S: '#d9967a',
  t: '#8a5a2b', T: '#5a3518',
}

class Pix {
  g: string[][] = Array.from({ length: SIZE }, () => Array(SIZE).fill('.'))
  px(x: number, y: number, c: string) {
    x = Math.round(x); y = Math.round(y)
    if (x >= 0 && y >= 0 && x < SIZE && y < SIZE) this.g[y][x] = c
  }
  rect(x: number, y: number, w: number, h: number, c: string) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.px(i, j, c)
  }
  clear(x: number, y: number, w: number, h: number) { this.rect(x, y, w, h, '.') }
  ellipse(cx: number, cy: number, rx: number, ry: number, c: string) {
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      const dx = (x - cx) / (rx + 0.4), dy = (y - cy) / (ry + 0.4)
      if (dx * dx + dy * dy <= 1) this.px(x, y, c)
    }
  }
  circle(cx: number, cy: number, r: number, c: string) { this.ellipse(cx, cy, r, r, c) }
  ring(cx: number, cy: number, r: number, c: string, th = 1) {
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      const d = Math.hypot(x - cx, y - cy)
      if (d <= r + 0.4 && d > r - th + 0.4) this.px(x, y, c)
    }
  }
  tri(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, c: string) {
    const area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0)
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      const px = x + 0.5, py = y + 0.5
      const a = ((x1 - px) * (y2 - py) - (x2 - px) * (y1 - py)) / area
      const b = ((x2 - px) * (y0 - py) - (x0 - px) * (y2 - py)) / area
      if (a >= 0 && b >= 0 && a + b <= 1) this.px(x, y, c)
    }
  }
  line(x0: number, y0: number, x1: number, y1: number, c: string, th = 1) {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1)
    for (let i = 0; i <= steps; i++) {
      const x = x0 + ((x1 - x0) * i) / steps, y = y0 + ((y1 - y0) * i) / steps
      if (th === 1) this.px(x, y, c)
      else this.rect(Math.round(x - th / 2), Math.round(y - th / 2), th, th, c)
    }
  }
  // spotlight cone from a lamp at (cx, top) widening to half-width w at bottom
  cone(cx: number, top: number, bottom: number, w: number, c: string) {
    for (let y = top; y <= bottom; y++) {
      const hw = ((y - top) / Math.max(1, bottom - top)) * w
      this.rect(Math.round(cx - hw), y, Math.round(hw * 2) + 1, 1, c)
    }
  }
  star(cx: number, cy: number, r: number, c: string) {
    this.tri(cx, cy - r, cx - r * 0.95, cy + r * 0.55, cx + r * 0.95, cy + r * 0.55, c)
    this.tri(cx, cy + r * 0.9, cx - r * 0.95, cy - r * 0.3, cx + r * 0.95, cy - r * 0.3, c)
  }
  // dark outline around everything drawn so far
  outline(c = 'k') {
    const src = this.g.map(r => [...r])
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      if (src[y][x] !== '.') continue
      const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
        const v = src[y + dy]?.[x + dx]
        return v !== undefined && v !== '.' && v !== c
      })
      if (near) this.g[y][x] = c
    }
  }
}

interface Spec { draw: (d: Pix) => void; after?: (d: Pix) => void }

// hand-made, pixel by pixel
const NEURAL_VOCALIST = ["................................","...y............................","..yyy.....kkkkkkkkkkkk..........","...y....kkhhhhhhhhhhhhkk........",".......khhHHhhhhhhhhHHhhk...y...","......khhHHhhhhhhhhhhHHhhk.yyy..",".....khhHhhhhhhhhhhhhhhHhhk.y...",".....khhhhhhhhhhhhhhhhhhhhk.....","....khhhhkkkkkkkkkkkkkkhhhhk....",".y..khhhkSssssssssssssSkhhhk....","....khhkSssssssssssssssSkhhk....","..kkkhhkvvvvvvvvvvvvvvvvkhhkkk..",".kmmmkkvVVwvvvvvvvvvvwVVvkkmmmk.",".kmMmkkvVvvvvvvvvvvvvvvVvkkmMmk.",".kmMmkkvvvvvvvvvvvvvvvvvvkkmMmk.",".kmmmkkSkkkkkkkkkkkkkkkkSkkmmmk.","..kkkhkSssssssssssssssssSkhkkk..","....khkSsssssskkkkssskkkkkhk....","....khhkSssssssssssskGgggkhk....",".....khkkSsssssssssskgGgdkk.....","......kk.kSSSssssssSkggddk......","..........kkSssssssSkkkkk.......",".........kkjkSssssSkjkdgk.......",".......kkjjjjkkkkkkjjkdgk.......",".....kkjjJJjjjjyyjjjkkdgkkk.....","....kjjJJjjjjjjyyjjjssdgssjk....","...kjjJjjjjjjjjjjjjjssdgssjjk...","..kjjJjjjjjjjjjjjjjjkkdgkkJjjk..","..kjjjjjjjjjjjjjjjjjjkdgkjjjjy..",".kjjjjjjjjjjjjjjjjjjjjjjjjjjjyy.",".kjjjjjjjjjjjjjjjjjjjjjjjjjjjjk.",".kjjjjjjjjjjjjjjjjjjjjjjjjjjjjk."]
// its own letters → shared palette
const NV_MAP: Record<string, string> = { h: 'p', H: 'P', v: 'c', V: 'C', M: 'c', j: 'V', J: 'v', g: 'n', G: 'e', d: 'N' }

const SPECS: Record<string, Spec> = {
  // ── stages ────────────────────────────────────────────────────────────────
  'Small Stage': { draw: d => {
    d.cone(16, 4, 21, 8, 'l'); d.rect(13, 1, 7, 3, 'n')
    d.rect(3, 22, 26, 5, 't'); d.rect(3, 22, 26, 1, 'o'); d.rect(3, 26, 26, 1, 'T')
    d.line(16, 13, 16, 21, 'N'); d.circle(16, 12, 1, 'e')
  } },
  'Medium Stage': { draw: d => {
    d.cone(10, 3, 20, 6, 'l'); d.cone(22, 3, 20, 6, 'C')
    d.rect(8, 1, 5, 2, 'n'); d.rect(20, 1, 5, 2, 'n')
    d.rect(2, 21, 28, 6, 't'); d.rect(2, 21, 28, 1, 'o'); d.rect(2, 26, 28, 1, 'T')
    for (const x of [1, 26]) { d.rect(x, 11, 5, 10, 'm'); d.circle(x + 2, 14, 1.5, 'n'); d.circle(x + 2, 18, 1, 'n') }
  } },
  'Large Stage': { draw: d => {
    d.rect(1, 1, 30, 2, 'n'); d.rect(1, 1, 2, 20, 'n'); d.rect(29, 1, 2, 20, 'n')
    d.cone(9, 4, 19, 5, 'P'); d.cone(16, 4, 19, 5, 'C'); d.cone(23, 4, 19, 5, 'l')
    d.rect(1, 20, 30, 7, 't'); d.rect(1, 20, 30, 1, 'o'); d.rect(1, 26, 30, 1, 'T')
    d.ellipse(16, 17, 4, 2, 'r'); d.rect(12, 17, 9, 3, 'R')
  } },
  'Festival Main': { draw: d => {
    d.rect(3, 0, 26, 2, 'n'); d.rect(3, 0, 2, 22, 'n'); d.rect(27, 0, 2, 22, 'n')
    d.rect(7, 3, 18, 9, 'B'); d.rect(8, 4, 16, 7, 'b'); d.rect(8, 6, 16, 1, 'c'); d.rect(8, 9, 16, 1, 'p')
    d.cone(10, 13, 21, 4, 'l'); d.cone(22, 13, 21, 4, 'l')
    d.rect(2, 21, 28, 3, 't'); d.rect(2, 21, 28, 1, 'o')
  }, after: d => {
    for (let x = 1; x < 32; x += 3) { d.circle(x, 29, 1.6, 'V'); d.px(x + 1, 26, 'S'); d.px(x + 1, 27, 'S') }
    d.px(1, 0, 'r'); d.px(30, 0, 'r')
  } },
  // ── artists ───────────────────────────────────────────────────────────────
  'Synth Wizard': { draw: d => {
    d.rect(8, 19, 16, 6, 'v')
    d.tri(16, 0, 8, 13, 24, 13, 'V'); d.rect(6, 12, 20, 2, 'V')
    d.ellipse(16, 16, 5, 3, 's'); d.px(14, 15, 'k'); d.px(18, 15, 'k')
    d.tri(10, 18, 22, 18, 16, 26, 'w')
    d.rect(2, 24, 28, 1, 'N'); d.rect(2, 25, 28, 5, 'w')
  }, after: d => {
    d.px(15, 5, 'y'); d.px(18, 9, 'y'); d.px(13, 10, 'y')
    for (let x = 4; x < 30; x += 3) { d.rect(x, 25, 1, 3, 'k') }
  } },
  'Beat Machine': { draw: d => {
    d.line(16, 1, 16, 3, 'N'); d.rect(10, 3, 12, 10, 'n'); d.rect(11, 6, 10, 3, 'r')
    d.rect(11, 13, 10, 7, 'N')
    d.line(10, 15, 5, 19, 'n', 2); d.line(21, 15, 26, 19, 'n', 2)
    d.line(5, 19, 3, 15, 't'); d.line(26, 19, 28, 15, 't')
    d.rect(2, 22, 12, 6, 'r'); d.ellipse(8, 22, 6, 1, 'e')
    d.circle(23, 25, 6, 'o'); d.circle(23, 25, 3, 'y')
  }, after: d => { d.px(16, 0, 'r'); d.px(13, 7, 'w'); d.px(18, 7, 'w') } },
  'Bass Controller': { draw: d => {
    d.rect(10, 3, 12, 4, 'c'); d.rect(18, 6, 8, 2, 'c')
    d.ellipse(15, 11, 5, 4, 's'); d.px(13, 10, 'k'); d.px(17, 10, 'k')
    d.rect(8, 15, 14, 14, 'B')
    d.line(14, 22, 28, 7, 't', 2); d.rect(27, 4, 3, 4, 'T')
    d.ellipse(11, 24, 6, 4, 'o'); d.circle(11, 24, 1.5, 'k')
  } },
  'Neural Vocalist': { draw: () => {} },
  'The Manager': { draw: d => {
    d.rect(5, 18, 22, 14, 'm'); d.tri(12, 18, 20, 18, 16, 27, 'w'); d.rect(15, 19, 2, 7, 'r')
    d.ellipse(16, 10, 6, 6, 's'); d.rect(10, 3, 12, 4, 'T')
    d.rect(10, 8, 12, 3, 'k'); d.line(14, 14, 18, 13, 'S')
    d.rect(24, 20, 4, 7, 'N')
  }, after: d => {
    d.px(11, 9, 'C'); d.px(18, 9, 'C')
    d.line(11, 19, 16, 24, 'y'); d.line(16, 24, 21, 19, 'y')
    d.rect(25, 21, 2, 4, 'c')
  } },
  // ── tracks ────────────────────────────────────────────────────────────────
  'Data Stream': { draw: d => {
    for (let x = 2; x < 30; x += 3) {
      const h = Math.round(5 + 6 * Math.abs(Math.sin(x / 4)))
      d.rect(x, 16 - h, 2, h * 2, x % 2 ? 'c' : 'g')
    }
  }, after: d => { for (const [x, y] of [[3, 2], [9, 28], [20, 3], [27, 27], [14, 1]]) d.px(x, y, 'w') } },
  // a music note dissolving into bits
  'Bit Residue': { draw: d => {
    d.ellipse(10, 24, 5, 4, 'g'); d.rect(14, 5, 3, 20, 'g'); d.tri(16, 5, 26, 10, 16, 14, 'G')
    d.px(8, 22, 'w'); d.px(9, 21, 'w')
  }, after: d => {
    let s = 7
    const r = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff
    // eat holes into the right side and scatter the bits away
    for (let i = 0; i < 40; i++) d.px(16 + Math.floor(r() * 12), 4 + Math.floor(r() * 12), '.')
    for (let i = 0; i < 18; i++) d.rect(20 + Math.floor(r() * 11), 2 + Math.floor(r() * 26), 1 + Math.floor(r() * 2), 1, r() > 0.6 ? 'w' : 'g')
  } },
  'Hypnotic Loop': { draw: d => {
    const cols = ['p', 'v', 'P', 'V', 'p', 'v', 'P']
    for (let i = 0; i < cols.length; i++) d.circle(16, 16, 14 - i * 2, cols[i])
    d.circle(16, 16, 1.5, 'w')
  } },
  'Megahit': { draw: d => {
    d.circle(16, 16, 14, 'y'); d.ring(16, 16, 11, 'Y'); d.ring(16, 16, 8, 'Y')
    d.circle(16, 16, 5, 'r'); d.circle(16, 16, 1, 'k')
  }, after: d => { d.line(7, 10, 10, 6, 'w'); d.px(28, 3, 'w'); d.px(27, 4, 'w'); d.px(29, 4, 'w'); d.px(28, 5, 'w') } },
  // ── hardware ──────────────────────────────────────────────────────────────
  'Valve Pre-Amp': { draw: d => {
    d.rect(2, 16, 28, 12, 'm'); d.rect(2, 15, 28, 2, 'n')
    for (const x of [8, 16, 24]) { d.rect(x - 3, 4, 6, 11, 'C'); d.rect(x - 3, 3, 6, 2, 'N'); d.rect(x - 1, 8, 2, 6, 'o') }
    for (const x of [8, 16, 24]) d.circle(x, 22, 2, 'n')
  }, after: d => { for (const x of [8, 16, 24]) { d.px(x, 7, 'y'); d.px(x, 21, 'w') } } },
  'Eurorack Drive': { draw: d => {
    d.rect(2, 4, 28, 24, 'N'); d.rect(2, 4, 28, 2, 'n'); d.rect(2, 26, 28, 2, 'n')
    for (let x = 6; x <= 26; x += 5) for (let y = 9; y <= 22; y += 6) d.circle(x, y, 1.5, 'e')
  }, after: d => {
    for (let x = 6; x <= 26; x += 5) for (let y = 9; y <= 22; y += 6) d.px(x, y, 'k')
    d.line(6, 9, 11, 16, 'r'); d.line(11, 16, 16, 21, 'r')
    d.line(21, 9, 26, 21, 'c'); d.line(11, 9, 21, 15, 'y')
  } },
  'Studio Engineer': { draw: d => {
    d.ring(16, 9, 6, 'n', 2); d.clear(8, 10, 17, 6)
    d.rect(8, 7, 3, 5, 'p'); d.rect(21, 7, 3, 5, 'p')
    d.rect(1, 13, 30, 3, 'N'); d.rect(1, 16, 30, 13, 'm')
  }, after: d => {
    for (let x = 4; x <= 28; x += 4) {
      d.line(x, 17, x, 27, 'k'); d.rect(x - 1, 17 + ((x * 7) % 9), 3, 2, 'e')
      d.px(x, 14, x % 8 ? 'g' : 'r')
    }
  } },
  // ── attacks ───────────────────────────────────────────────────────────────
  'Malware Worm': { draw: d => {
    for (let i = 0; i < 6; i++) d.circle(4 + i * 4.2, 20 + Math.round(4 * Math.sin(i * 1.1)), 3.2, i % 2 ? 'g' : 'G')
    d.circle(27, 13, 4, 'g')
  }, after: d => {
    d.px(26, 12, 'r'); d.px(28, 12, 'r'); d.rect(25, 15, 4, 1, 'k')
    for (const [x, y] of [[3, 5], [10, 3], [19, 6], [30, 25], [6, 29]]) d.rect(x, y, 2, 1, 'r')
  } },
  'Track Corruptor': { draw: d => {
    d.rect(3, 6, 26, 17, 'n'); d.rect(6, 8, 20, 6, 'e')
    d.circle(11, 17, 3, 'N'); d.circle(21, 17, 3, 'N')
    d.line(14, 23, 12, 27, 'T'); d.line(12, 27, 16, 30, 'T'); d.line(18, 23, 21, 28, 'T')
  }, after: d => {
    d.line(5, 4, 12, 12, 'r', 2); d.line(12, 12, 9, 17, 'r', 2); d.line(9, 17, 17, 24, 'r', 2)
    d.ring(11, 17, 3, 'w'); d.ring(21, 17, 3, 'w')
  } },
  'Artist Poacher': { draw: d => {
    d.line(0, 2, 9, 9, 'm', 4)
    d.rect(8, 8, 9, 6, 'm'); d.rect(8, 14, 2, 5, 'm'); d.rect(11, 14, 2, 6, 'm'); d.rect(14, 14, 2, 5, 'm')
    d.star(22, 22, 8, 'y')
  }, after: d => { d.line(19, 10, 22, 7, 'w'); d.line(24, 11, 27, 8, 'w'); d.px(22, 20, 'w') } },
  'EMP Blast': { draw: d => {
    d.ring(16, 16, 14, 'c'); d.ring(16, 16, 10, 'C')
    d.tri(19, 1, 8, 18, 17, 18, 'y'); d.tri(14, 14, 24, 14, 12, 31, 'y')
  }, after: d => { for (const [x, y] of [[4, 6], [27, 7], [5, 26], [28, 25], [16, 15]]) d.px(x, y, 'w') } },
  // ── defense ───────────────────────────────────────────────────────────────
  'Firewall Shield': { draw: d => {
    d.tri(2, 30, 6, 12, 10, 30, 'o'); d.tri(22, 30, 26, 10, 30, 30, 'o')
    d.tri(4, 30, 6, 18, 8, 30, 'y'); d.tri(24, 30, 26, 17, 28, 30, 'y')
    d.rect(8, 4, 16, 12, 'g'); d.tri(8, 15, 24, 15, 16, 29, 'g')
    d.rect(11, 7, 10, 8, 'G'); d.tri(11, 14, 21, 14, 16, 25, 'G')
  }, after: d => { for (const y of [10, 13, 16]) d.rect(12, y, 8, 1, 'g'); d.line(16, 7, 16, 9, 'g') } },
  'Decoy Booth': { draw: d => {
    d.line(16, 26, 16, 30, 't', 2); d.rect(10, 30, 12, 2, 'T')
    d.circle(16, 6, 4, 'n'); d.rect(9, 11, 14, 15, 'n')
    d.circle(16, 18, 5, 'w'); d.circle(16, 18, 3.5, 'r'); d.circle(16, 18, 2, 'w'); d.circle(16, 18, 0.8, 'r')
  } },
  // ── bonus ─────────────────────────────────────────────────────────────────
  'Guest Feature': { draw: d => {
    d.rect(3, 18, 12, 14, 'P'); d.rect(17, 18, 12, 14, 'C')
    d.circle(9, 11, 5, 's'); d.rect(4, 5, 10, 3, 'p')
    d.circle(23, 11, 5, 'S'); d.rect(18, 5, 10, 3, 'c')
    d.line(16, 19, 16, 27, 'N'); d.circle(16, 17, 2, 'n')
  }, after: d => {
    d.rect(15, 1, 3, 1, 'y'); d.rect(16, 0, 1, 3, 'y')
    for (const [x, y] of [[7, 11], [10, 11], [21, 11], [24, 11]]) d.px(x, y, 'k')
    d.rect(8, 14, 2, 1, 'S'); d.rect(22, 14, 2, 1, 'T')
  } },
  // star over a crowd with arms up
  'Encore': { draw: d => {
    d.star(16, 9, 9, 'y')
    for (const x of [5, 16, 27]) {
      d.line(x - 2, 27, x - 4, 20, 'V', 2); d.line(x + 2, 27, x + 4, 20, 'V', 2)
      d.circle(x - 4, 19, 1.5, 's'); d.circle(x + 4, 19, 1.5, 's')
      d.circle(x, 27, 3, 'V'); d.rect(x - 4, 29, 9, 3, 'V')
    }
  }, after: d => {
    for (const [x, y, c] of [[3, 3, 'p'], [28, 4, 'c'], [6, 14, 'g'], [26, 15, 'p'], [10, 1, 'c'], [22, 1, 'g']] as [number, number, string][]) d.px(x, y, c)
    d.px(15, 8, 'w'); d.px(16, 7, 'w')
  } },
  'Brand Deal': { draw: d => {
    for (let i = 0; i < 4; i++) { d.rect(3, 26 - i * 4, 14, 4, 'y'); d.rect(3, 26 - i * 4, 14, 1, 'Y') }
    d.circle(22, 11, 8, 'y'); d.ring(22, 11, 6, 'Y')
  }, after: d => {
    d.line(24, 7, 20, 7, 'Y'); d.line(20, 7, 20, 10, 'Y'); d.line(20, 11, 24, 11, 'Y'); d.line(24, 11, 24, 14, 'Y'); d.line(24, 15, 20, 15, 'Y')
    d.line(22, 5, 22, 17, 'Y'); d.px(30, 3, 'w'); d.px(12, 6, 'w')
  } },
  'Radio Play': { draw: d => {
    d.line(20, 11, 27, 3, 'n')
    d.rect(3, 11, 26, 2, 't'); d.rect(3, 13, 26, 15, 'o')
    d.circle(11, 20, 5, 'T'); d.rect(18, 15, 9, 4, 'l')
    d.circle(20, 24, 2, 'n'); d.circle(26, 24, 2, 'n')
  }, after: d => {
    for (let y = 17; y <= 23; y += 2) for (let x = 8; x <= 14; x += 2) d.px(x, y, 'o')
    d.line(22, 15, 23, 18, 'r'); d.px(27, 2, 'r')
    d.px(29, 5, 'c'); d.px(30, 3, 'c'); d.px(24, 1, 'c'); d.px(22, 2, 'c')
  } },
  'Viral Hit': { draw: d => {
    d.rect(8, 2, 14, 27, 'm'); d.rect(9, 5, 12, 20, 'p')
    d.tri(15, 7, 10, 23, 20, 23, 'o'); d.tri(15, 13, 12, 23, 18, 23, 'y')
    d.line(24, 28, 28, 16, 'g', 2); d.tri(24, 17, 31, 17, 28, 9, 'g')
  }, after: d => {
    d.px(15, 27, 'n')
    for (const [x, y] of [[3, 6], [4, 12], [2, 18]]) { d.px(x, y, 'r'); d.px(x + 1, y, 'r'); d.px(x, y + 1, 'r') }
  } },
  // ── draw ──────────────────────────────────────────────────────────────────
  'Demo Tape': { draw: d => {
    d.rect(3, 7, 26, 18, 'c'); d.rect(6, 9, 20, 7, 'w'); d.rect(10, 18, 12, 5, 'B')
    d.circle(11, 20, 2.5, 'w'); d.circle(21, 20, 2.5, 'w')
  }, after: d => {
    d.rect(8, 11, 16, 1, 'n'); d.rect(8, 13, 12, 1, 'n')
    d.px(11, 20, 'k'); d.px(21, 20, 'k'); d.px(4, 8, 'k'); d.px(27, 8, 'k')
  } },
  'Bootleg': { draw: d => {
    d.circle(16, 16, 13, 'e'); d.ring(16, 16, 10, 'C', 2); d.ring(16, 16, 7, 'P', 2); d.ring(16, 16, 5, 'l')
    d.circle(16, 16, 3, 'n'); d.circle(16, 16, 1, 'k')
  }, after: d => { d.line(5, 5, 27, 27, 'r', 2); d.line(27, 5, 5, 27, 'r', 2) } },
}

function gridFor(name: string): string[] | null {
  if (name === 'Neural Vocalist') return NEURAL_VOCALIST.map(r => [...r].map(ch => NV_MAP[ch] ?? ch).join(''))
  const spec = SPECS[name]
  if (!spec) return null
  const d = new Pix()
  spec.draw(d)
  d.outline()
  spec.after?.(d)
  return d.g.map(r => r.join(''))
}

// grid → SVG, merging horizontal runs of one colour into a single rect
export function sprite32Svg(name: string): string | null {
  const g = gridFor(name)
  if (!g) return null
  let rects = ''
  for (let y = 0; y < SIZE; y++) {
    let x = 0
    while (x < SIZE) {
      const ch = g[y][x]
      let w = 1
      while (x + w < SIZE && g[y][x + w] === ch) w++
      const fill = PALETTE[ch]
      if (fill) rects += `<rect x="${x}" y="${y}" width="${w}" height="1" fill="${fill}"/>`
      x += w
    }
  }
  return `<svg viewBox="0 0 ${SIZE} ${SIZE}" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" style="width:100%;height:100%;image-rendering:pixelated;display:block">${rects}</svg>`
}

export const SPRITE_NAMES = ['Neural Vocalist', ...Object.keys(SPECS).filter(n => n !== 'Neural Vocalist')]
export { gridFor }
