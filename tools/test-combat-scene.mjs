// Escena de combate (DESIGN-COMBAT.md §11) en Chrome headless con SwiftShader (no usa la GPU):
// monta ?scene=combat → la grilla, el grupo y los enemigos → teclado (Tab, 1, Esc) → mueve con un clic real del mouse →
// vista previa del golpe al pasar el mouse → Espacio pide confirmar el fin de turno → turno enemigo con las casillas
// marcadas → alto contraste → gana un encuentro fácil (líder de nivel 30) jugando por los mismos caminos del clic →
// pantalla de resultado con estrellas → Esc abre el menú y Retirarse muestra la retirada.
//
//   node tools/test-combat-scene.mjs [--out carpeta] [--no-shots]
import http from 'node:http';
import { readFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { join, extname, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : d; };
const OUT = resolve(opt('out', join(ROOT, 'shots', 'combat')));
const SHOTS = !opt('no-shots', false);
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
  while (Date.now() - t0 < ms) { if (!(await C(c => c.busy))) return true; await sleep(150); }
  return false;
}
async function shot(name) { if (SHOTS) { await page.screenshot({ path: join(OUT, name) }); console.log('  captura', join(OUT, name)); } }

try {
  console.log('1. montar la escena');
  await page.goto(BASE + '?scene=combat&enc=bosque_claro&seed=7&level=30&nosplash&nosw&reset&quality=low', { waitUntil: 'load' });
  await page.waitForFunction(() => !!document.querySelector('.scene-combat')?.__combat?.view, { timeout: 30000 });
  await page.evaluate(() => { const s = window.__pixelia.store.state.settings; s.combatSpeed = 3; s.confirmEnd = true; s.hiContrast = false; });
  await sleep(1500);
  let v = await C(c => c.view);
  check(v.tiles.length === 64 && v.w === 8 && v.h === 8, 'grilla de 8×8');
  check(v.units.filter(u => u.side === 'ally').length === 4 && v.units.filter(u => u.side === 'enemy').length === 2, 'el líder, 3 del grupo y 2 lobos');
  check(await page.$('.scene-combat canvas') !== null, 'hay canvas 3D');
  check((await page.$$('.cb-tag')).length === 6, 'una barra de vida por unidad');
  check(/Ojos en el monte/i.test(await page.$eval('.cb-goal', e => e.textContent)), 'arriba se ve el encuentro');
  check((await page.$$('.cb-order .cb-o')).length === 6, 'orden del turno: 4 del grupo y 2 enemigos');

  console.log('2. teclado');
  const sel0 = (await C(c => c.sel)).id;
  await page.keyboard.press('Tab'); await sleep(200);
  const sel1 = (await C(c => c.sel)).id;
  check(sel1 && sel1 !== sel0, 'Tab pasa a la siguiente unidad');
  await page.keyboard.press('Tab'); await page.keyboard.press('Tab'); await page.keyboard.press('Tab'); await sleep(200);
  check((await C(c => c.sel)).id === sel0, 'Tab da la vuelta');
  await page.keyboard.press('1'); await sleep(200);
  let s = await C(c => c.sel);
  check(s.mode === 'ability' && s.ability === 'golpe', '1 elige la primera habilidad (Golpe)');
  check(!!(await page.$('.cb-act.on')), 'el botón de la habilidad queda marcado');
  await page.keyboard.press('Escape'); await sleep(200);
  s = await C(c => c.sel);
  check(s.mode === 'move' && !(await C(c => c.modal)), 'Esc suelta la habilidad sin abrir el menú');

  console.log('3. mouse: mover con un clic real');
  const lead = await C(c => { const b = c.raw(); const u = b.units.find(x => x.type === 'lider'); return { id: u.id, x: u.x, y: u.y }; });
  await C((c, a) => c.select(a[0]), lead.id);
  const dest = await C((c, a) => { const b = c.raw(); const r = c.rules.reachable(b, a[0]).filter(t => !(t.x === a[1] && t.y === a[2])); r.sort((p, q) => p.y - q.y || p.x - q.x); return r[0]; }, lead.id, lead.x, lead.y);
  let sp = await C((c, a) => c.cellScreen(a[0], a[1]), dest.x, dest.y);
  await page.mouse.move(sp.x, sp.y); await sleep(250);
  check(/Llano|Lo alto|Agua|Salida/.test(await page.$eval('.cb-hover', e => e.textContent)), 'al pasar el mouse por una casilla se ve qué es');
  await page.mouse.click(sp.x, sp.y);
  await idle();
  const lead2 = await C((c, a) => { const u = c.raw().units.find(x => x.id === a[0]); return { x: u.x, y: u.y, moved: u.moved }; }, lead.id);
  check(lead2.x === dest.x && lead2.y === dest.y && lead2.moved, `el líder caminó a (${dest.x}, ${dest.y})`);

  console.log('4. ficha del enemigo al pasar el mouse');
  const wolf = await C(c => { const e = c.raw().units.find(u => u.side === 'enemy' && u.alive); return { id: e.id, x: e.x, y: e.y }; });
  sp = await C((c, a) => c.unitScreen(a[0]), wolf.id);
  await page.mouse.move(sp.x, sp.y); await sleep(300);
  check(/Lobo de ojos brillantes/.test(await page.$eval('.cb-hover', e => e.textContent)), 'la ficha del lobo aparece a la derecha');
  await shot('pelea-comun.png');

  console.log('5. fin de turno con confirmación y turno enemigo');
  await page.mouse.move(10, 400);
  await page.keyboard.press('Space'); await sleep(300);
  check(!!(await page.$('.cb-modal')) && /Terminar el turno/.test(await page.$eval('.cb-modal', e => e.textContent)), 'Espacio pide confirmar (quedan acciones)');
  await page.keyboard.press('Space');
  await idle(60000);
  v = await C(c => c.view);
  check(v.turn === 2 && v.phase === 'player', 'pasó el turno enemigo y empieza el 2');
  // un turno más, para que los lobos marquen
  await C(c => c.endTurn(true)); await idle(60000);
  v = await C(c => c.view);
  const marked = v.tiles.filter(t => t.danger > 0).length;
  check(marked > 0, `los lobos marcaron ${marked} casillas`);
  check((await page.$$('.cb-chips .cb-chip.danger')).length === marked, 'cada casilla marcada muestra su daño');
  await shot('casillas-marcadas-test.png');

  console.log('5b. vista previa del golpe (alcance y daño)');
  const pv = await C(c => {
    const R = c.rules, b = c.raw();
    for (const u of b.units.filter(x => x.alive && x.side === 'ally' && !x.captive)) {
      const ab = R.abilitiesOf(b, u.id).findIndex(a => a.def.kind === 'attack' && a.ready);
      if (ab < 0) continue;
      const id = R.abilitiesOf(b, u.id)[ab].id;
      const t = R.targets(b, u.id, id).find(p => R.unitAt(b, p.x, p.y)?.side === 'enemy');
      if (t) return { uid: u.id, key: String(ab + 1), tid: R.unitAt(b, t.x, t.y).id, hp: R.unitAt(b, t.x, t.y).hp };
    }
    return null;
  });
  if (pv) {
    await C((c, a) => c.select(a[0]), pv.uid);
    await page.keyboard.press(pv.key); await sleep(200);
    check((await C(c => c.sel)).mode === 'ability', `la tecla ${pv.key} elige el ataque`);
    sp = await C((c, a) => c.unitScreen(a[0]), pv.tid);
    await page.mouse.move(sp.x, sp.y); await sleep(200); await page.mouse.move(sp.x + 2, sp.y + 1); await sleep(400);
    const prev = await page.$$eval('.cb-prev .cb-chip', els => els.map(e => e.textContent));
    check(prev.some(x => /−\d/.test(x)), `vista previa del daño sobre el enemigo: ${prev.join(', ')}`);
    const hpBefore = await C((c, a) => c.raw().units.find(u => u.id === a[0]).hp, pv.tid);
    check(hpBefore === pv.hp, 'la vista previa no toca la pelea');
    await shot('vista-previa.png');
    await page.keyboard.press('Escape'); await sleep(150);
  } else check(true, 'nadie llega a un lobo en este turno (se saltea la vista previa)');

  console.log('6. alto contraste');
  await page.evaluate(() => window.__pixelia.ctx.setSetting({ hiContrast: true }));
  await sleep(500);
  check(await page.evaluate(() => document.documentElement.classList.contains('hi-contrast')), 'la clase hi-contrast está puesta');
  await shot('alto-contraste.png');
  await page.evaluate(() => window.__pixelia.ctx.setSetting({ hiContrast: false }));

  console.log('7. ganar el encuentro');
  // bot simple por los mismos caminos del clic: cada uno se acerca al lobo más cercano y le pega con lo básico
  let guard = 0;
  while (!(await C(c => c.raw().ended)) && guard++ < 14) {
    for (let k = 0; k < 4; k++) {
      const plan = await C(c => {
        const R = c.rules, b = c.raw();
        const al = b.units.filter(u => u.alive && !u.safe && u.side === 'ally' && !u.acted && !(u.captive && !u.freed));
        const foes = b.units.filter(u => u.alive && u.side === 'enemy');
        if (!al.length || !foes.length) return null;
        const u = al[0];
        const atk = R.abilitiesOf(b, u.id).find(a => a.def.kind === 'attack' && a.ready);
        if (!atk) return { id: u.id, skip: true };
        const now = R.targets(b, u.id, atk.id);
        if (now.length) return { id: u.id, act: atk.id, x: now[0].x, y: now[0].y };
        if (u.moved) return { id: u.id, skip: true };
        let best = null;
        for (const t of R.reachable(b, u.id)) {
          const tg = R.targets(b, u.id, atk.id, t.x, t.y);
          const d = Math.min(...foes.map(e => Math.abs(e.x - t.x) + Math.abs(e.y - t.y)));
          const score = (tg.length ? 100 : 0) - d;
          if (!best || score > best.score) best = { score, x: t.x, y: t.y };
        }
        return best && (best.x !== u.x || best.y !== u.y) ? { id: u.id, move: [best.x, best.y] } : { id: u.id, skip: true };
      });
      if (!plan) break;
      if (plan.skip) { await C((c, a) => { c.raw().units.find(u => u.id === a[0]).acted = true; }, plan.id); continue; }
      await C((c, a) => c.select(a[0]), plan.id);
      if (plan.move) { await C((c, a) => c.click(a[0], a[1]), ...plan.move); await idle(); k--; continue; }
      await C((c, a) => { c.ability(a[0]); c.click(a[1], a[2]); }, plan.act, plan.x, plan.y);
      await idle();
      if (await C(c => c.raw().ended)) break;
    }
    if (await C(c => c.raw().ended)) break;
    await C(c => c.endTurn(true));
    await idle(60000);
  }
  const res = await C(c => c.rules.result(c.raw()));
  check(res.outcome === 'win', `ganó en ${res.turns} turnos (${res.stars} estrellas)`);
  await page.waitForSelector('.cb-result', { timeout: 10000 }).catch(() => {});
  await sleep(1200);
  const txt = await page.$eval('.cb-result', e => e.textContent).catch(() => '');
  check(/Victoria/.test(txt), 'pantalla de resultado: Victoria');
  check((await page.$$('.cb-result .cb-star')).length === 3, 'tres estrellas (victoria y los dos desafíos)');
  check(/experiencia/.test(txt) && (await page.$$('.cb-result .cb-loot span')).length > 0, 'muestra el botín y la experiencia');
  await shot('resultado.png');

  console.log('8. retirada desde el menú');
  await page.goto(BASE + '?scene=combat&enc=bosque_manada&seed=3&nosplash&nosw&quality=low', { waitUntil: 'load' });
  await page.waitForFunction(() => !!document.querySelector('.scene-combat')?.__combat?.view, { timeout: 30000 });
  await sleep(800);
  await page.keyboard.press('Escape'); await sleep(250);
  check(/Pausa/.test(await page.$eval('.cb-modal', e => e.textContent)), 'Esc abre el menú');
  await page.click('.cb-modal [data-a="retreat"]'); await sleep(150);
  await page.click('.cb-modal [data-a="yes"]'); await sleep(600);
  const rt = await page.$eval('.cb-result', e => e.textContent).catch(() => '');
  check(/Retirada/.test(rt) && /20 %|experiencia/.test(rt), 'la retirada muestra su resultado');
  check((await C(c => c.raw().outcome)) === 'retreat', 'el motor quedó en retirada');
} catch (e) {
  bad++; console.log('  ERROR', e.stack || e.message);
}

await browser.close();
server.close();
if (errors.length) { bad++; console.log('\n=== ERRORES DE PÁGINA ===\n' + [...new Set(errors)].join('\n')); }
console.log(`\ntest-combat-scene: ${ok} bien, ${bad} mal`);
process.exit(bad ? 1 : 0);
