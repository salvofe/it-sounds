// Board checks: starts `next start`, drives headless Chrome over the DevTools protocol,
// runs one check per player action and layout requirement, saves screenshots.
// Usage: npx next build && npm run check:board [-- --only=C1,C2]
import { spawn, execSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const only = (process.argv.find(a => a.startsWith('--only='))?.slice(7) ?? '').split(',').filter(Boolean)
const PORT = 3030
const CDP_PORT = 9334
const CHROME = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const OUT = join(process.cwd(), '.board-check')
mkdirSync(OUT, { recursive: true })
const sleep = ms => new Promise(r => setTimeout(r, ms))
const killTree = p => { try { if (process.platform === 'win32') execSync(`taskkill /pid ${p.pid} /T /F`, { stdio: 'ignore' }); else p.kill('SIGTERM') } catch {} }

// ── server and browser ──────────────────────────────────────────────────────
const URL = `http://localhost:${PORT}/?e2e=1`
let server = null, chrome = null, ws = null, profile = null
let msgId = 0
const pending = new Map()
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const i = ++msgId
    const t = setTimeout(() => { pending.delete(i); reject(new Error(`CDP timeout: ${method}`)) }, 15000)
    pending.set(i, d => { clearTimeout(t); resolve(d) })
    ws.send(JSON.stringify({ id: i, method, params }))
  })
}
async function js(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })
  if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description ?? 'page error')
  return r.result?.result?.value
}
async function viewport(width, height) {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 600 })
  await sleep(300)
}
async function shot(name) {
  const r = await send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(join(OUT, `${name}.png`), Buffer.from(r.result.data, 'base64'))
}
function cleanup() {
  try { ws?.close() } catch {}
  if (chrome) killTree(chrome)
  if (server) killTree(server)
  if (profile) { try { rmSync(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 }) } catch {} }
}
const watchdog = setTimeout(() => { console.error('watchdog: 10 min exceeded'); cleanup(); process.exit(2) }, 10 * 60 * 1000)

// ── page helpers ────────────────────────────────────────────────────────────
const S = expr => js(`(() => { const s = window.__itsounds.getState(); return (${expr}) })()`)
const exists = id => js(`!!document.querySelector('[data-testid="${id}"]')`)
async function click(id) {
  const ok = await js(`(() => { const el = document.querySelector('[data-testid="${id}"]'); if (!el) return false; el.click(); return true })()`)
  if (!ok) throw new Error(`missing [data-testid="${id}"]`)
  await sleep(250)
}
async function clickHandCard(i) {
  if (i < 0) throw new Error('card not in hand')
  const ok = await js(`(() => { const el = document.querySelectorAll('[data-testid="hand-card"]')[${i}]; if (!el) return false; el.click(); return true })()`)
  if (!ok) throw new Error(`missing hand-card #${i}`)
  await sleep(300)
}
async function hoverHandCard(i) {
  const p = await js(`(() => { const el = document.querySelectorAll('[data-testid="hand-card"]')[${i}]; if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + 30 } })()`)
  if (!p) throw new Error(`missing hand-card #${i}`)
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p.x, y: p.y })
  await sleep(300)
}
// deal new games until the hand satisfies `want` (an expression over `h`)
async function newGame(mode = 'short', want = 'true') {
  for (let i = 0; i < 40; i++) {
    await js(`(() => { const st = window.__itsounds; st.setState({ showTutorial: false, showSetup: false, showResults: false }); st.getState().startGame('Synthwave', 'Darksynth', 'Industrial', '${mode}') })()`)
    await sleep(150)
    if (await S(`(h => ${want})(s.playerHand)`)) { await sleep(300); return }
  }
  throw new Error(`no ${mode} deal with: ${want}`)
}
const idxOf = test => S(`s.playerHand.findIndex(c => ${test})`)
const nextPhase = async () => { await click('next-phase'); await sleep(400) }
const SMALL = `c.name === 'Small Stage'`
const ARTIST = `c.type === 'artist'`
const noVerticalScroll = () => js(`(() => {
  const q = id => document.querySelector('[data-testid="' + id + '"]')
  const board = q('board'), zones = [...document.querySelectorAll('[data-testid^="zone-"]')]
  const bottomOk = id => { const el = q(id); return !!el && el.getBoundingClientRect().bottom <= innerHeight + 1 }
  return document.documentElement.scrollHeight <= innerHeight + 1
    && !!board && board.scrollHeight <= board.clientHeight + 1
    && zones.length > 0 && zones.every(z => z.scrollHeight <= z.clientHeight + 1)
    && bottomOk('center-band') && bottomOk('ticker')
})()`)

// ── checks ──────────────────────────────────────────────────────────────────
const CHECKS = {
  C1: ['select one of your stages', async () => {
    await newGame()
    await click('zone-me-s2')
    return (await S('s.focusedStage')) === 's2'
  }],
  C2: ['play a card on the focused stage (and its preview goes away)', async () => {
    await newGame('short', `h.some(c => ${SMALL})`)
    await click('zone-me-s2')
    const i = await idxOf(SMALL)
    await hoverHandCard(i)
    await clickHandCard(i)
    return (await S(`s.playerStages.s2.stage?.name`)) === 'Small Stage'
      && await exists('field-card-me-s2-stage')
      && !(await exists('card-preview'))
  }],
  C3: ['discard a card from hand', async () => {
    await newGame()
    const [n, t] = await S('[s.playerHand.length, s.playerTrash.length]')
    await click('discard-0')
    const [n2, t2] = await S('[s.playerHand.length, s.playerTrash.length]')
    return n2 === n - 1 && t2 === t + 1
  }],
  C4: ['return a placed card to hand (without refocusing its stage)', async () => {
    await newGame('short', `h.some(c => ${SMALL})`)
    await click('zone-me-s1')
    await clickHandCard(await idxOf(SMALL))
    await click('zone-me-s2')
    await click('pickup-me-s1-stage')
    return (await S('s.playerStages.s1.stage')) === null
      && (await S(`s.playerHand.some(c => ${SMALL})`))
      && (await S('s.focusedStage')) === 's2'
  }],
  C5: ['move a card between stages', async () => {
    await newGame('short', `h.filter(c => ${SMALL}).length >= 2 && h.some(c => ${ARTIST})`)
    await click('zone-me-s1'); await clickHandCard(await idxOf(SMALL))
    await click('zone-me-s2'); await clickHandCard(await idxOf(SMALL))
    await click('zone-me-s1'); await clickHandCard(await idxOf(ARTIST))
    await click('move-me-s1-artist1')
    await click('zone-me-s2')
    return await S('s.playerStages.s2.artist1 !== null && s.playerStages.s1.artist1 === null')
  }],
  C6: ['attack an AI stage; cancel an attack; AI stages inert otherwise', async () => {
    for (let attempt = 0; attempt < 6; attempt++) {
      await newGame('short', `h.some(c => c.type === 'attack')`)
      await nextPhase(); await nextPhase()
      const target = await S(`['s1', 's2', 's3'].find(k => s.aiStages[k].stage)`)
      if (!target || (await idxOf(`c.type === 'attack'`)) < 0) continue
      const before = await S('s.playerHand.length')
      const focus = await S('s.focusedStage')
      await click(`zone-ai-${target}`)
      if ((await S('s.playerHand.length')) !== before || (await S('s.focusedStage')) !== focus) return false
      await clickHandCard(await idxOf(`c.type === 'attack'`))
      if (!(await S('s.targetMode'))) return false
      await click('cancel-attack')
      if (await S('s.targetMode')) return false
      await clickHandCard(await idxOf(`c.type === 'attack'`))
      await click(`zone-ai-${target}`)
      return (await S('s.playerHand.length')) === before - 1 && !(await S('s.targetMode'))
    }
    throw new Error('no deal reached Live Show with an attack card and an AI stage')
  }],
  C7: ['mulligan', async () => {
    await newGame()
    await click('mulligan')
    return await S('s.mulliganUsed')
  }],
  C8: ['undo', async () => {
    await newGame('short', `h.some(c => ${SMALL})`)
    await click('zone-me-s1')
    await clickHandCard(await idxOf(SMALL))
    await click('undo')
    return (await S('s.playerStages.s1.stage')) === null
  }],
  C9: ['advance phases, see results, start the next round', async () => {
    await newGame()
    await nextPhase(); await nextPhase(); await nextPhase()
    if (!(await S('s.showResults'))) return false
    await js(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('NEXT ROUND'))?.click()`)
    await sleep(500)
    return (await S('s.round === 2 && s.phaseIdx === 0'))
  }],
  C10: ['restart the game', async () => {
    await newGame()
    await click('restart')
    return await S('s.showSetup')
  }],
  C11: ['buy an extra action and buy cards', async () => {
    await newGame('short')
    const a = await S('s.actionsLeft')
    await click('buy-action')
    if (!(await S(`s.extraActionsBought === 1 && s.actionsLeft === ${a + 1}`))) return false
    await newGame('short')
    const n = await S('s.playerHand.length')
    await click('buy-draw')
    return (await S('s.playerHand.length')) === n + 2
  }],
  C12: ['upgrade a stage and boost a stage', async () => {
    const want = `h.some(c => ${SMALL}) && h.some(c => ${ARTIST})`
    await newGame('short', want)
    await click('zone-me-s1'); await clickHandCard(await idxOf(SMALL)); await clickHandCard(await idxOf(ARTIST))
    await nextPhase()
    await click('upgrade-threshold-s1')
    if (!(await S('s.playerStages.s1.upgraded'))) return false
    await newGame('short', want)
    await click('zone-me-s1'); await clickHandCard(await idxOf(SMALL)); await clickHandCard(await idxOf(ARTIST))
    await nextPhase(); await nextPhase()
    await click('boost-s1')
    return (await S('s.playerStages.s1.boost')) === 1
  }],
  C13: ['open and close the info drawer', async () => {
    await newGame()
    await click('drawer-toggle')
    const open = await js(`document.querySelector('[data-testid="drawer"]')?.classList.contains('open') === true`)
    const parts = await js(`['drawer-hint', 'drawer-log', 'drawer-commentary', 'drawer-combos', 'drawer-db'].every(id => document.querySelector('[data-testid="' + id + '"]'))`)
    await click('drawer-toggle')
    const closed = await js(`document.querySelector('[data-testid="drawer"]')?.classList.contains('open') === false`)
    return open && parts && closed
  }],
  C14: ['enlarged preview of a hovered card', async () => {
    await newGame()
    const last = (await S('s.playerHand.length')) - 1
    await hoverHandCard(last)
    const name = await S(`s.playerHand[${last}].name`)
    return await js(`document.querySelector('[data-testid="card-preview"]')?.textContent.includes(${JSON.stringify(name)}) === true`)
  }],
  C15: ['Classic: 20k race, locked s2, no Hype shop', async () => {
    await newGame('classic')
    const race = await js(`document.querySelector('[data-testid="round-info"]')?.textContent.includes('20k') === true`)
    await click('zone-me-s2')
    const locked = (await S('s.focusedStage')) === 's1'
    const noShop = !(await exists('buy-action')) && !(await exists('buy-draw'))
    return race && locked && noShop
  }],
  L1: ['1440×900: no vertical scroll, nothing clipped', async () => {
    await viewport(1440, 900)
    await newGame('short', `h.some(c => ${SMALL})`)
    await click('zone-me-s1'); await clickHandCard(await idxOf(SMALL))
    await shot('board-1440x900')
    return await noVerticalScroll()
  }],
  L2: ['1280×800: no vertical scroll, nothing clipped', async () => {
    await viewport(1280, 800)
    await newGame('short', `h.some(c => ${SMALL})`)
    await click('zone-me-s1'); await clickHandCard(await idxOf(SMALL))
    await shot('board-1280x800')
    const ok = await noVerticalScroll()
    await newGame('classic')
    await shot('board-classic-1280x800')
    return ok
  }],
  L3: ['390 wide: no horizontal page scroll', async () => {
    try {
      await viewport(390, 844)
      await newGame()
      await shot('board-390')
      return await js(`(() => {
        const drawer = document.querySelector('[data-testid="drawer"]')
        return !!document.querySelector('[data-testid="board"]')
          && document.documentElement.scrollWidth <= innerWidth + 1
          && document.body.scrollWidth <= innerWidth + 1
          && !(drawer && drawer.classList.contains('open'))
          && [...document.querySelectorAll('[data-testid]')].every(el => el.closest('.hand-fan') || el.closest('.drawer') || el.getBoundingClientRect().right <= innerWidth + 1)
      })()`)
    } finally {
      await viewport(1440, 900)
    }
  }],
}

// ── run ─────────────────────────────────────────────────────────────────────
let failed = 0
try {
  let stale = false
  try { await fetch(`http://localhost:${PORT}/`); stale = true } catch {}
  if (stale) throw new Error(`port ${PORT} already answers (stale server?); stop it first`)
  server = spawn('npx', ['next', 'start', '-p', String(PORT)], { shell: true, stdio: 'ignore' })
  let up = false
  for (let i = 0; i < 60 && !up; i++) { try { up = (await fetch(URL)).ok } catch {} if (!up) await sleep(500) }
  if (!up) throw new Error('next start did not come up (did you run next build?)')

  profile = mkdtempSync(join(tmpdir(), 'board-check-'))
  chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${CDP_PORT}`, '--hide-scrollbars', `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  let pages = []
  for (let i = 0; i < 50 && !pages.length; i++) {
    try { pages = (await (await fetch(`http://127.0.0.1:${CDP_PORT}/json`)).json()).filter(t => t.type === 'page') } catch {}
    if (!pages.length) await sleep(200)
  }
  if (!pages.length) throw new Error(`Chrome page target never appeared on port ${CDP_PORT} (CHROME_PATH=${CHROME})`)
  ws = new WebSocket(pages[0].webSocketDebuggerUrl)
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('CDP websocket error')) })
  ws.onmessage = m => {
    const d = JSON.parse(m.data)
    if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id) }
    if (d.method === 'Page.javascriptDialogOpening') send('Page.handleJavaScriptDialog', { accept: true }).catch(() => {})
  }

  await send('Page.enable'); await send('Runtime.enable')
  await viewport(1440, 900)
  await send('Page.navigate', { url: URL })
  for (let i = 0; i < 40; i++) { if (await js('!!window.__itsounds').catch(() => false)) break; await sleep(250) }

  for (const [id, [name, fn]] of Object.entries(CHECKS)) {
    if (only.length && !only.includes(id)) continue
    let pass = false, detail = ''
    try { pass = await fn() } catch (e) { detail = e.message }
    if (!pass) failed++
    console.log(`${pass ? 'PASS' : 'FAIL'}  ${id.padEnd(4)} ${name}${detail ? `  (${detail})` : ''}`)
  }
  console.log(`screenshots: ${OUT}`)
} catch (e) {
  console.error('board-check error:', e.message)
  failed = failed || 1
} finally {
  clearTimeout(watchdog)
  cleanup()
}
process.exit(failed ? 1 : 0)
