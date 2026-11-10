// Combate apto para farmear (PLAN-FOTO, paso A2) en la escena de verdad, con Chrome headless:
//   node tools/test-combat-farm-scene.mjs [--no-shots] [--out DIR] [--no-timing]
// monta encuentros de 6×6 del Bosque del Arroyo (con los enemigos nuevos, el matorral, la corriente y la fogata) →
// botón de velocidad ×1/×2/×3 → Espacio saltea la animación del turno enemigo → y mide cuánto dura una pelea común
// jugada entera: el bot de sim-combat.mjs decide cada jugada y la escena la anima; entre jugada y jugada se espera lo
// que tarda una persona en decidir (THINK). La meta del paso: de 1 a 2 minutos a velocidad ×1.
import puppeteer from 'puppeteer-core';
import http from 'node:http';
import { readFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { dirname, resolve, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { botTurn } from './sim-combat.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : d; };
const OUT = resolve(opt('out', join(ROOT, 'shots', 'combat-farm')));
const SHOTS = !opt('no-shots', false);
const TIMING = !opt('no-timing', false);
const THINK = 2500;      // ms que tarda una persona en decidir cada jugada (elegir a quién, dónde y con qué)
if (SHOTS) mkdirSync(OUT, { recursive: true });

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const f = join(ROOT, p);
  if (!f.startsWith(ROOT) || !existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); res.end('404'); return; }
  res.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  res.end(readFileSync(f));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}/`;

const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
await page.setViewport({ width: 1366, height: 800, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', e => errors.push('PAGEERROR: ' + (e.stack || e.message)));
page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE.ERROR: ' + m.text()); });
page.on('response', r => { if (r.status() >= 400) errors.push(`HTTP ${r.status()}: ${r.url()}`); });

let ok = 0, bad = 0;
const check = (cond, msg) => { if (cond) { ok++; console.log('  ok  ', msg); } else { bad++; console.log('  MAL ', msg); } };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const C = (fn, ...a) => page.evaluate((src, a) => { const c = document.querySelector('.scene-combat')?.__combat; return c ? new Function('c', 'a', 'return (' + src + ')(c, a)')(c, a) : null; }, fn.toString(), a);
async function idle(ms = 30000) {
  const t0 = Date.now();
  await sleep(120);
  while (Date.now() - t0 < ms) { if (!(await C(c => c.busy))) return true; await sleep(100); }
  return false;
}
async function shot(name) { if (SHOTS) { await page.screenshot({ path: join(OUT, name) }); console.log('  captura', join(OUT, name)); } }
async function open(enc, extra = '') {
  await page.goto(BASE + `?scene=combat&enc=${enc}&seed=11&level=3&element=raiz&nosplash&nosw&reset&quality=low${extra}`, { waitUntil: 'load' });
  await page.waitForSelector('.scene-combat .cb-end', { timeout: 30000 });
  for (let k = 0; k < 100 && !(await C(c => c.frames > 3 && !!c.view)); k++) await sleep(100);
  await idle();
}
/** Juega la pelea entera con el bot. Devuelve { ms, turns, outcome, plays, enemyMs }. */
async function playTimed(think) {
  const t0 = Date.now();
  let plays = 0, enemyMs = 0;
  for (let turn = 0; turn < 12; turn++) {
    const mirror = await C(c => c.battle);
    if (!mirror || mirror.ended) break;
    const steps = [];
    botTurn(mirror, { noise: 1.2, onAct: (s) => steps.push(s) });
    for (const s of steps) {
      await sleep(think);
      plays++;
      await C((c, [s]) => c.step(s.id, s.move ? s.move[0] : null, s.move ? s.move[1] : null, s.ab, s.at ? s.at[0] : 0, s.at ? s.at[1] : 0), s);
      if (await C(c => c.raw().ended)) break;
    }
    if (await C(c => c.raw().ended)) break;
    const e0 = Date.now();
    await C(c => c.endTurn(true));
    await idle();
    enemyMs += Date.now() - e0;
  }
  await idle();
  const res = await C(c => ({ turn: c.raw().turn, outcome: c.raw().outcome, ended: c.raw().ended }));
  return { ms: Date.now() - t0, turns: res.turn, outcome: res.outcome, ended: res.ended, plays, enemyMs };
}

try {
  console.log('1. un encuentro del farmeo monta en 6×6');
  await open('arroyo_vado');
  const v = await C(c => ({ w: c.view.w, h: c.view.h, n: c.view.tiles.length, farm: c.view.farm, foes: c.view.units.filter(u => u.side === 'enemy').map(u => u.type), flow: c.view.tiles.filter(t => t.flow).length }));
  check(v.w === 6 && v.h === 6 && v.n === 36 && v.farm, `tablero de ${v.w}×${v.h}`);
  check(v.foes.includes('sapo') && v.flow >= 3, `con sapos de marea y ${v.flow} casillas de corriente`);
  const sc = await C(c => { const a = c.cellScreen(0, 0), z = c.cellScreen(5, 5); return [a, z]; });
  check(sc.every(p => p && p.x > 0 && p.x < 1366 && p.y > 0 && p.y < 800), 'el tablero entero entra en pantalla');
  await shot('01-vado.png');

  console.log('2. los enemigos nuevos y el terreno se arman sin errores');
  for (const [enc, extra, name] of [['arroyo_tormenta', '&marea=3&frag=brasa', '02-tormenta-marea3.png'], ['arroyo_enjambre', '', '03-enjambre.png'], ['arroyo_carga', '', '04-carga.png'], ['arroyo_brasas', '&frag=marea', '05-brasas.png'], ['arroyo_elite_manada', '&marea=2', '06-elite.png']]) {
    await open(enc, extra);
    const info = await C(c => ({ foes: c.view.units.filter(u => u.side === 'enemy').map(u => u.type), fire: c.view.tiles.filter(t => t.fire).length, marea: c.view.marea, abil: c.view.units.find(u => u.type === 'lider').abilities.map(a => a.id) }));
    check(info.foes.length >= 3 && !errors.length, `${enc}: ${info.foes.join(', ')}${info.fire ? ' · fogata' : ''}${info.marea > 1 ? ' · Marea ' + info.marea : ''}`);
    if (enc === 'arroyo_tormenta') check(info.abil.includes('ascua') && info.marea === 3, 'el fragmento de Brasa le da Ascua al líder; la Marea llega por la URL');
    if (enc === 'arroyo_brasas') check(info.fire === 1, 'la fogata se ve en el tablero');
    await shot(name);
  }

  console.log('3. velocidad ×1, ×2, ×3 y saltear');
  await open('arroyo_lobos');
  const lbl = () => page.$eval('.cb-speed', e => e.firstChild.textContent);
  check((await lbl()) === '×1', 'el botón de velocidad arranca en ×1');
  await page.click('.cb-speed'); await sleep(150);
  check((await lbl()) === '×2', 'un clic: ×2');
  await page.keyboard.press('+'); await sleep(150);
  check((await lbl()) === '×3', 'la tecla +: ×3');
  await page.click('.cb-speed'); await sleep(150);
  check((await lbl()) === '×1', 'y vuelve a ×1');
  // el turno enemigo entero, sin saltear y salteando
  let t0 = Date.now();
  await C(c => { c.endTurn(true); });
  await idle();
  const full = Date.now() - t0;
  t0 = Date.now();
  await C(c => { c.endTurn(true); });
  await sleep(250);
  await page.keyboard.press('Space');
  await idle();
  const skipped = Date.now() - t0;
  const turn = await C(c => c.raw().turn);
  check(turn === 3 && skipped < full * 0.6 && skipped < 1500, `Espacio saltea el turno enemigo (${full} ms entero, ${skipped} ms salteado) y no termina otro turno`);
  check(!(await C(c => c.skipping)), 'el salteo vale solo para esa tanda');
  await shot('07-velocidad.png');

  if (TIMING) {
    console.log('4. cuánto dura una pelea común jugada entera (bot + animaciones + ' + THINK + ' ms por jugada)');
    const runs = [];
    for (const [enc, speed] of [['arroyo_lobos', 1], ['arroyo_guardian', 1], ['arroyo_lobos', 2]]) {
      await open(enc);
      for (let k = 1; k < speed; k++) await C(c => c.cycleSpeed());
      const r = await playTimed(THINK);
      runs.push({ enc, speed, ...r });
      console.log(`       ${enc} a ×${speed}: ${(r.ms / 1000).toFixed(0)} s, ${r.turns} turnos, ${r.plays} jugadas, turnos enemigos ${(r.enemyMs / 1000).toFixed(1)} s, ${r.outcome}`);
      for (let k = speed; k > 1 && k < 4; k++) await C(c => c.cycleSpeed());   // vuelve a ×1 (los Ajustes se guardan)
    }
    const x1 = runs.filter(r => r.speed === 1);
    check(x1.every(r => r.ended && r.outcome === 'win'), 'el bot gana las peleas en la escena');
    check(x1.every(r => r.ms >= 45000 && r.ms <= 120000), `a ×1 una pelea común dura ${x1.map(r => (r.ms / 1000).toFixed(0) + ' s').join(' y ')} (meta: 1 a 2 minutos)`);
    const a = runs[0], c2 = runs[2];
    check(c2.enemyMs / Math.max(1, c2.turns) < (a.enemyMs / Math.max(1, a.turns)) * 0.75, `a ×2 el turno enemigo también va más rápido (${(a.enemyMs / a.turns / 1000).toFixed(1)} s → ${(c2.enemyMs / c2.turns / 1000).toFixed(1)} s por turno)`);
    await shot('08-resultado.png');
  }
} catch (e) {
  bad++; console.log('  ERROR', e.stack || e.message);
}

await browser.close();
server.close();
if (errors.length) { bad++; console.log('\n=== ERRORES DE PÁGINA ===\n' + [...new Set(errors)].join('\n')); }
console.log(`\ntest-combat-farm-scene: ${ok} bien, ${bad} mal`);
process.exit(bad ? 1 : 0);
