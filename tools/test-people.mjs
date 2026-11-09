// Pruebas de la gente de la ciudad, el Vínculo, las herramientas y la pestaña Progreso (El Quiebre, paso 5b segunda
// parte; DESIGN-COMBAT.md §15).
//   1. node: datos (src/core/people-data.js) y los efectos de las herramientas en la expedición y en el combate.
//   2. Chrome headless (SwiftShader): llegadas, encargos, Vínculo, mejorar en el Taller, las herramientas en la salida,
//      la pestaña Progreso de la Bitácora y el nivel del líder en el panel de Expedición.
//   node test-people.mjs [--quick]
import http from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';
import * as PD from '../src/core/people-data.js';
import * as X from '../src/expedition/exp-rules.js';
import { HAZARDS } from '../src/expedition/exp-data.js';
import * as R from '../src/combat/combat-rules.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const QUICK = process.argv.includes('--quick');
let pass = 0, fail = 0;
const ok = (c, msg, extra) => { if (c) { pass++; console.log('  ok  ', msg); } else { fail++; console.log('  MAL ', msg, extra !== undefined ? JSON.stringify(extra) : ''); } };
const section = (t) => console.log('\n' + t);

section('Datos');
ok(PD.PEOPLE_IDS.length === 5 && PD.PEOPLE_IDS.every(id => PD.PEOPLE[id].tasks.length === PD.BOND_MAX - 1), '5 personas, 4 encargos cada una (Vínculo 1 → 5)');
ok(new Set(PD.PEOPLE_IDS.map(id => PD.PEOPLE[id].tool)).size === 5 && PD.TOOL_IDS.every(t => PD.TOOLS[t]), 'una herramienta distinta cada una');
ok(PD.PEOPLE_IDS.filter(id => !PD.PEOPLE[id].arrive.start).every(id => PD.PEOPLE[id].lines.length === 2 && PD.PEOPLE[id].fact), 'cada una dice 2 líneas al llegar y trae un dato del mundo');
ok(PD.PEOPLE.vera.arrive.start && PD.PEOPLE.brigida.arrive.rank === 2 && PD.PEOPLE.olga.arrive.rank === 3 && PD.PEOPLE.ramiro.arrive.rank === 5 && PD.PEOPLE.nahuel.arrive.zone.region === 'bosque', 'llegan como dice el plan (L5)');
const allText = PD.PEOPLE_IDS.flatMap(id => [...PD.PEOPLE[id].lines, PD.PEOPLE[id].fact, ...PD.PEOPLE[id].tasks.map(t => t.text)]).join(' ');
ok(!/\b\w+(ito|ita|itos|itas)\b/.test(allText.replace(/\b(cuchillito)\b/g, '')), 'sin diminutivos (guía de tono)');
ok(JSON.stringify(PD.toolCost('cuerda', 3)) === JSON.stringify({ coins: 180, mats: { madera: 4 } }), 'mejorar cuesta monedas y material de región');

section('Herramientas en la expedición');
const opt = (hz, id) => HAZARDS[hz].options.find(o => o.id === id);
const base = X.newRun({ region: 'bosque', zone: 1, seed: 3, party: ['forjador'] });
const withT = X.newRun({ region: 'bosque', zone: 1, seed: 3, party: ['forjador'], mods: { tools: { cuerda: 3, botiquin: 4, catalejo: 3 } } });
const p0 = X.optionChance(base, HAZARDS.rio, opt('rio', 'cruzar')).p, p1 = X.optionChance(withT, HAZARDS.rio, opt('rio', 'cruzar')).p;
ok(p1 === Math.min(95, p0 + 9), 'Cuerda 3: +9 al cruzar un río', [p0, p1]);
ok(X.optionChance(withT, HAZARDS.rio, opt('rio', 'cruzar')).parts.some(([, t]) => /Cuerda 3/.test(t)), 'y se ve en el detalle de la decisión');
ok(withT.moraleMax === base.moraleMax + 2, 'Botiquín 4: +2 de ánimo máximo', [base.moraleMax, withT.moraleMax]);
ok(PD.toolVision({ catalejo: 2 }) === 0 && PD.toolVision({ catalejo: 3 }) === 1, 'Catalejo 3: una casilla más de visión');
const fr = X.newRun({ region: 'bosque', zone: 1, seed: 3, party: ['cazador'], mods: { tools: { catalejo: 4, martillo: 2 } } });
const fb = X.makeBattle(fr, 'bosque_claro', 1, 1);
ok(fb.tools.catalejo === 4 && fb.tools.martillo === 2, 'las herramientas llegan a la pelea');
const b0 = R.newBattle({ encounter: 'cerro_veta', seed: 2, party: ['forjador'] }), b5 = R.newBattle({ encounter: 'cerro_veta', seed: 2, party: ['forjador'], tools: { catalejo: 5 } });
R.endTurn(b0); R.enemyTurn(b0); R.endTurn(b5); R.enemyTurn(b5);
ok(R.visibleIntentIds(b5).size > R.visibleIntentIds(b0).size, 'Catalejo: más intenciones a la vista en combate');

if (!QUICK) {
  section('En el juego (Chrome headless, SwiftShader)');
  const { default: puppeteer } = await import('puppeteer-core');
  const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg' };
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
  await page.setViewport({ width: 1280, height: 760, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + (e.stack || e.message)));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE.ERROR: ' + m.text()); });
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  async function waitFor(src, ms = 20000) { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (await page.evaluate(src)) return true; } catch {} await sleep(200); } return false; }
  const run = (src) => page.evaluate(new Function(`return (async () => { const P = window.__pixelia; const S = P.store.state; const PE = await import('./src/core/people.js'); const K = await import('./src/core/classes.js'); ${src} })()`));
  try {
    await page.goto(BASE + '?nosw&reset', { waitUntil: 'load' });
    await waitFor(`!!window.__pixelia?.store?.state`);
    // una partida ya empezada (sin onboarding ni prólogo), como la de test-story
    await page.evaluate(() => {
      const st = window.__pixelia.store;
      const raw = JSON.parse(JSON.stringify(st.state));
      delete raw.story; delete raw.introSeen; delete raw.people; raw.onboarded = true;
      st.save = () => {};
      localStorage.setItem('pixelia.save.v1', JSON.stringify(raw));
    });
    await page.goto(BASE + '?nosw&nosplash', { waitUntil: 'load' });
    ok(await waitFor(`window.__pixelia?.ctx.router.current === 'city' && !!window.__pixelia.store.state.people`, 25000), 'el juego carga con la gente de la ciudad');
    await sleep(3500);
    for (let k = 0; k < 10 && await page.evaluate(() => !!document.querySelector('.st-card:not(.bark), .st-epic')); k++) { await page.evaluate(() => document.querySelector('.st-card .st-next, .st-epic button')?.click()); await sleep(500); }
    let r = await run(`return { vera: S.people.list.vera, tools: PE.toolLevels(), brig: S.people.list.brigida.arrived };`);
    ok(r.vera.arrived > 0 && r.vera.met && r.tools.catalejo === 1 && !r.brig, 'Vera está desde el inicio con el Catalejo 1; Brígida todavía no', r);
    // encargos y Vínculo
    r = await run(`P.bus.emit('expedition:finished', { region: 'bosque', kind: 'corta' }); const a = S.people.list.vera.n; P.bus.emit('expedition:finished', { region: 'bosque', kind: 'corta', prototype: true }); const b = S.people.list.vera.n;
      P.bus.emit('expedition:finished', { region: 'bosque', kind: 'corta' }); return { a, b, bond: S.people.list.vera.bond, n: S.people.list.vera.n, task: PE.currentTask('vera').type };`);
    ok(r.a === 1 && r.b === 1 && r.bond === 2 && r.n === 0 && r.task === 'zone', 'volver de 2 salidas sube el Vínculo de Vera (la práctica no cuenta)', r);
    r = await run(`P.bus.emit('expedition:zone', { region: 'bosque', zone: 1 }); return { bond: S.people.list.vera.bond, task: PE.currentTask('vera') };`);
    ok(r.bond === 3 && r.task.type === 'deliver', 'explorar una zona: Vínculo 3', r);
    r = await run(`S.materials.mineral = 1; const no = PE.deliver('vera'); S.materials.mineral = 10; const yes = PE.deliver('vera'); return { no, yes, min: S.materials.mineral, bond: S.people.list.vera.bond };`);
    ok(!r.no.ok && r.yes.ok && r.min === 6 && r.bond === 4, 'entregar los materiales del encargo', r);
    r = await run(`S.story ||= {}; S.story.flags ||= {}; S.story.flags.bestia_vencida = Date.now(); P.bus.emit('quests:changed'); return S.people.list.vera.bond;`);
    ok(r === 5, 'el encargo de la historia (vencer a la bestia) se cumple con la marca', r);
    // mejorar en el Taller
    r = await run(`S.coins = 5000; S.materials.mineral = 30; const noT = PE.toolUpgradeInfo('vera');
      S.city.buildings.push({ uid: 9801, id: 'taller', x: 1, z: 1, level: 1 }); const up = PE.upgradeTool('vera'); return { noT, up, lv: PE.toolLevels().catalejo };`);
    ok(!r.noT.ok && /Taller/.test(r.noT.why) && r.up.ok && r.lv === 2, 'la herramienta se mejora en el Taller, pagando', r);
    r = await run(`S.people.list.vera.bond = 2; const i = PE.toolUpgradeInfo('vera'); S.people.list.vera.bond = 5; return i;`);
    ok(!r.ok && /Vínculo 3/.test(r.why), 'el nivel de la herramienta no pasa al Vínculo', r);
    // llegadas (un observador anota las escenas de llegada que se muestran)
    await page.evaluate(() => { window.__llega = []; new MutationObserver(() => { const c = document.querySelector('.st-card[data-scene^="llega_"]'); if (!c) return; let e = window.__llega.find(x => x.id === c.dataset.scene); if (!e) window.__llega.push(e = { id: c.dataset.scene, txt: '' }); if (c.textContent.length > e.txt.length) e.txt = c.textContent; }).observe(document.body, { childList: true, subtree: true, characterData: true }); });
    r = await run(`const id = S.city.buildings.find(b => b.id === 'municipalidad' || b.id === 'castillo'); const E = await import('./src/core/economy.js'); const rank = E.townRank(S);
      if (id) id.level = 3; const got = PE.checkArrivals(); return { got, rank: E.townRank(S), info: PE.personInfo('brigida') };`);
    ok(r.rank >= 3 && r.got.includes('brigida') && r.got.includes('olga') && r.info.toolLevel === 1, 'con el rango llegan Brígida y Olga, con su herramienta en 1', r);
    // lo que haya abierto (el premio del rango, por ejemplo) se cierra: la llegada espera a la ciudad tranquila
    // las escenas de la historia van primero: se pasan y después se pide la llegada (la ciudad la muestra sola cuando está tranquila)
    for (let k = 0; k < 6 && await page.evaluate(() => !!document.querySelector('.st-card')); k++) { await page.evaluate(() => document.querySelector('.st-card .st-next')?.click()); await sleep(400); }
    await run(`P.ctx.ui.closeAllModals?.(); PE.showNextArrival({ force: true }); return true;`);
    ok(await waitFor(`window.__llega.length > 0`, 15000) && await waitFor(`/Me llamo|Olga/.test(window.__llega[0].txt)`, 8000), 'la llegada se cuenta con una escena (2 líneas y un dato)');
    r = await page.evaluate(() => window.__llega[0] || {});
    ok(/llega_(brigida|olga)/.test(r.id || '') && /Me llamo|Olga/.test(r.txt || ''), 'la escena dice quién llegó', r);
    for (let k = 0; k < 8 && await page.evaluate(() => !!document.querySelector('.st-card')); k++) { await page.evaluate(() => document.querySelector('.st-card .st-next, .st-card button')?.click()); await sleep(400); }
    // las herramientas llegan a la salida
    r = await run(`const ex = await import('./src/expedition/expedition.js'); S.city.buildings.push({ uid: 9802, id: 'casa_exp', x: 3, z: 1, level: 2 }); S.prov = 40;
      const res = ex.startExpedition({ region: 'bosque', kind: 'normal' }); const t = res.run?.mods?.tools; const lead = res.run?.mods?.leader; S.expedition.active = null; return { err: res.error, t, lead };`);
    ok(r.t && r.t.catalejo === 2 && r.lead && r.lead.level >= 1, 'la salida lleva las herramientas y el nivel real del líder', r);
    // pestaña Progreso
    await run(`K.grantLeaderXp(300); P.ctx.openPanel('story', { tab: 'progreso' }); return true;`);
    ok(await waitFor(`!!document.querySelector('.pnl-story .pg [data-pg="lider"]')`, 8000), 'la Bitácora tiene la pestaña Progreso');
    r = await page.evaluate(() => {
      const q = (s) => document.querySelector('.pnl-story ' + s);
      return { tab: !!q('[data-tab="progreso"].active'), rango: !!q('[data-pg="rango"]'), lider: q('[data-pg="lider"]')?.dataset.level, vera: q('[data-person="vera"]')?.dataset.bond,
        locked: !!q('[data-person="ramiro"].locked'), els: !!q('[data-pg="elementos"]'), grieta: !!q('[data-pg="grieta"]'), pag: !!q('[data-pg="paginas"]'), txt: q('[data-pg="lider"]')?.textContent || '' };
    });
    ok(r.tab && r.rango && r.lider === '3' && r.vera === '5' && r.locked && r.els && r.grieta && r.pag, 'rango, líder, gente, elementos, Grieta y páginas', r);
    ok(/\d+\/\d+/.test(r.txt) && /nivel/.test(r.txt), 'cada fila dice qué falta para el próximo nivel', r.txt.slice(0, 120));
    if (process.argv.includes('--shots')) { await page.screenshot({ path: join(ROOT, 'shots', 'progreso.png') }); await page.evaluate(() => { const p = document.querySelector('.pnl-story .pnl-pane'); if (p) p.scrollTop = 520; }); await sleep(300); await page.screenshot({ path: join(ROOT, 'shots', 'progreso-gente.png') }); console.log('  capturas en shots/progreso*.png'); }
    r = await run(`S.materials.mineral = 30; S.coins = 5000; return true;`);
    await page.evaluate(() => document.querySelector('.pnl-story [data-upgrade="vera"]')?.click());
    await sleep(400);
    r = await page.evaluate(() => document.querySelector('.pnl-story [data-person="vera"]')?.dataset.tool);
    ok(r === '3', 'mejorar desde la pestaña Progreso', r);
    await page.keyboard.press('Escape'); await sleep(500);
    // nivel del líder en el panel de Expedición
    await run(`P.ctx.openPanel('expedition'); return true;`);
    ok(await waitFor(`!!document.querySelector('.pnl-ex [data-leader-level]')`, 8000), 'el panel de Expedición muestra el nivel de quien lidera');
    r = await page.evaluate(() => document.querySelector('.pnl-ex [data-leader-level]')?.textContent || '');
    ok(/nivel 3/.test(r), 'con su nivel', r);
    ok(!errors.length, 'sin errores en la página', errors.slice(0, 3));
  } catch (e) { ok(false, 'el juego anduvo sin trabarse', String(e && e.stack || e)); }
  await browser.close();
  server.close();
}

console.log(`\ntest-people: ${pass} bien, ${fail} mal`);
process.exitCode = fail ? 1 : 0;
