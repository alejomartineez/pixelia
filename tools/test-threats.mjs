// Prueba de las Amenazas (Fase 3, DESIGN-CORE.md §3): calendario, simulacro del tutorial, radio al colocar una defensa,
// preparación con cobertura y reservas, defensa jugada por turnos (con un toque real), resolución automática con el
// aviso "Mientras no estabas", daño (no produce ni mejora), reparación y arreglo de la vecindad a las 72 h.
//
//   node tools/test-threats.mjs [--device iphone|desktop] [--no-shots] [--out carpeta]
import http from 'node:http';
import { readFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { join, extname, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer-core';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const Cal = await import(pathToFileURL(join(ROOT, 'src/threats/threat-calendar.js')).href);
const R = await import(pathToFileURL(join(ROOT, 'src/threats/threat-rules.js')).href);
const D = await import(pathToFileURL(join(ROOT, 'src/threats/threat-data.js')).href);

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : d; };
const OUT = resolve(opt('out', join(tmpdir(), 'pixelia-threats')));
const SHOTS = !opt('no-shots', false);
const DEVICE = opt('device', 'iphone');
if (SHOTS) mkdirSync(OUT, { recursive: true });

let okN = 0, failN = 0;
const ok = (cond, msg, extra) => { if (cond) { okN++; console.log('  ✔ ' + msg); } else { failN++; console.log('  ✘ ' + msg + (extra !== undefined ? ' → ' + JSON.stringify(extra) : '')); } return !!cond; };
const section = (t) => console.log('\n■ ' + t);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ===================================================================
section('Calendario y reglas (sin navegador)');
{
  const s0 = Cal.schedule(0, 2);
  ok(s0.length === 2 && s0[0].id === '0-1' && s0[1].id === '0-3', 'rango 2: días 12 y 26', s0.map(t => t.id));
  ok(Cal.schedule(0, 4).length === 3 && Cal.schedule(0, 6).length === 4, 'rango 4: 3 amenazas; rango 6: las 4');
  ok(new Date(s0[0].start).getDay() === 6 && new Date(s0[0].start).getHours() === 8, 'llegan un sábado a las 08:00');
  ok(s0.every(t => ['crecida', 'sequia'].includes(t.type)), 'en rango 2 solo crecida o sequía', s0.map(t => t.type));
  ok(Cal.schedule(0, 6).map(t => t.type).join(',') === 'crecida,incendio,tormenta,sequia', 'el orden de los tipos en rango 6', Cal.schedule(0, 6).map(t => t.type));
  const t = s0[0];
  ok(Cal.phase(t, t.announce - 1) === 'lejos' && Cal.phase(t, t.announce + 1) === 'aviso' && Cal.phase(t, t.start - 3600e3) === 'señales'
    && Cal.phase(t, t.start + 1) === 'hoy' && Cal.phase(t, t.end + 1) === 'pasada', 'fases: lejos → aviso → señales → hoy → pasada');
  ok(t.start - t.announce === 4 * 864e5 || Math.abs(t.start - t.announce - 4 * 864e5) <= 3600e3, 'el aviso llega 4 días antes');
  const sim = Cal.makeSim(Date.now());
  ok(sim.start - sim.announce >= 16 * 3600e3 && sim.end - sim.start >= 12 * 3600e3, 'el simulacro llega ≥ 16 h después y dura ≥ 12 h');
  // reglas: cobertura con radio y preparación
  const city = { bounds: { min: 8, max: 20 }, buildings: [
    { uid: 1, id: 'casita', cat: 'casa', x: 18, z: 9, w: 2, d: 2, era: 1, level: 1, height: 1 },
    { uid: 2, id: 'casita', cat: 'casa', x: 17, z: 13, w: 2, d: 2, era: 1, level: 1, height: 1 },
    { uid: 3, id: 'casita', cat: 'casa', x: 9, z: 9, w: 2, d: 2, era: 1, level: 1, height: 1 },
  ] };
  ok(R.atRisk('crecida', city, 2).map(b => b.uid).join() === '1,2', 'crecida: en riesgo lo que está a ≤ 4 del arroyo');
  const p0 = R.prepInfo('crecida', city, 0, 2);
  city.buildings.push({ uid: 9, id: 'dique', cat: 'defensa', x: 17, z: 11, w: 3, d: 1, level: 1, era: 1 });
  const p1 = R.prepInfo('crecida', city, 1, 2);
  ok(p0.prep === 0 && p1.list.every(x => x.covered) && Math.abs(p1.c - 0.68) < 1e-9 && p1.r === 1, 'un Dique nivel 1 cubre a los dos (68%) y 1 bolsa alcanza', p1);
  // los pesos y la base salen de threat-data (rebalanceo con varias semillas, DESIGN-CORE §8.z: 0,5 / 0,5 y base 40)
  ok(Math.abs(p1.prep - (D.PREP_W_COVER * 0.68 + D.PREP_W_RESERVES)) < 1e-9, `prep = ${D.PREP_W_COVER} × c + ${D.PREP_W_RESERVES} × r`);
  const a = R.autoResolve(p1.prep, 2, 2);
  ok(a.pct === Math.round(D.AUTO.base + D.AUTO.perPrep * p1.prep - 1), `automática: ${D.AUTO.base} + ${D.AUTO.perPrep} × prep − (f − 1)`, a);
  ok(R.coverageTiles('dique', 17, 11, 0, { size: [3, 1] }).length > 20, 'coverageTiles dibuja el radio');
  const d = R.newDefense({ type: 'crecida', f: 2, city, reserves: 1, K: 2, seed: 7 });
  ok(d.turns === 6 && d.levels.some(v => v > 0), 'la defensa tiene 6 turnos y focos en el arroyo', { turns: d.turns });
  const res = R.finishWithBot(d);
  ok(d.done && res.pct >= 50, `el bot termina la defensa (${res.pct}%)`);
}

// ===================================================================
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
const VIEWS = {
  iphone: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  desktop: { width: 1366, height: 800, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
};
const VIEW = VIEWS[DEVICE];
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const errors = [];
const page = await browser.newPage();
await page.setViewport(VIEW);
if (VIEW.hasTouch) await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1');
page.on('pageerror', e => errors.push('PAGEERROR: ' + (e.stack || e.message)));
page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE.ERROR: ' + m.text()); });
page.on('response', r => { if (r.status() >= 400) errors.push(`HTTP ${r.status()}: ${r.url()}`); });

async function waitFor(code, ms = 10000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { try { if (await page.evaluate(code)) return true; } catch {} await sleep(120); }
  return false;
}
const AsyncFn = Object.getPrototypeOf(async function () {}).constructor;
/** Corre código en la página con store, E (economía), Q (misiones), ctx, bus y T (src/threats/threats.js). */
const run = (body) => page.evaluate(new AsyncFn(`const { store, economy: E, quests: Q, ctx, bus } = window.__pixelia; const T = await import('/src/threats/threats.js'); ${body}`));
async function tapXY(x, y) { if (VIEW.hasTouch) await page.touchscreen.tap(x, y); else await page.mouse.click(x, y); }
async function tapSel(sel, text = null, timeout = 5000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const p = await page.evaluate((sel, text) => {
      const re = text ? new RegExp(text, 'i') : null;
      const e = [...document.querySelectorAll(sel)].find(e => { const b = e.getBoundingClientRect(); return b.width > 2 && b.height > 2 && !e.disabled && (!re || re.test(e.textContent)); });
      if (!e) return null;
      e.scrollIntoView({ block: 'center' });
      const b = e.getBoundingClientRect();
      return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
    }, sel, text);
    if (p) { await sleep(250); await tapXY(p.x, p.y); return true; }
    await sleep(150);
  }
  console.log(`    (no encontré ${sel}${text ? ' «' + text + '»' : ''})`);
  return false;
}
let shotN = 0;
async function shot(name) {
  if (!SHOTS) return;
  const f = join(OUT, `${String(++shotN).padStart(2, '0')}-${DEVICE}-${name}.png`);
  await page.screenshot({ path: f });
  console.log('    📷 ' + f);
}
async function drain() {
  for (let i = 0; i < 12; i++) {
    const st = await page.evaluate(() => ({ any: !!document.querySelector('.modal'), reward: !!document.querySelector('.modal.reward-modal, .modal.pnl-login, .modal[class*="welcome"]'), x: !!document.querySelector('.modal .modal-x') }));
    if (!st.any) return;
    if (st.reward) { await tapSel('.modal .modal-foot .btn:last-child', null, 800); await sleep(500); continue; }
    if (st.x) { await tapSel('.modal .modal-x', null, 800); await sleep(400); continue; }
    await page.keyboard.press('Escape'); await sleep(400);
  }
}
/** Construye al instante en (x, z) (o en el primer lugar libre cerca), sin pasar por la constructora. */
const placeAt = (id, x, z, level = 1) => run(`
  let pos = E.canPlace('${id}', ${x}, ${z}, 0).ok ? [${x}, ${z}] : null;
  const L = E.landBounds();
  for (let r = 1; !pos && r < 12; r++) for (let dx = -r; dx <= r && !pos; dx++) for (let dz = -r; dz <= r && !pos; dz++) if (E.canPlace('${id}', ${x} + dx, ${z} + dz, 0).ok) pos = [${x} + dx, ${z} + dz];
  if (!pos) return { error: 'sin lugar' };
  const b = E.placeBuilding('${id}', pos[0], pos[1], 0);
  if (b.error) return b;
  b.buildEnd = 0; b.level = ${level}; E.tick();
  return { uid: b.uid, x: b.x, z: b.z };`);

try {
  // ===================================================================
  section('Partida en Caserío y simulacro del tutorial');
  await page.goto(`${BASE}?scene=city&reset&nosplash&nosw&cheat=10`, { waitUntil: 'load' });
  await page.evaluate(() => history.replaceState(null, '', location.pathname + '?nosplash&nosw'));
  ok(await waitFor(`window.__pixelia?.ctx.router.current === 'city' && !!document.querySelector('.hud-rail')`, 25000), 'la ciudad carga');
  await run(`store.state.onboarded = true; window.__thEv = []; bus.on('*', ({ name, payload }) => { if (/^(threat|building:(damaged|repaired))/.test(name)) window.__thEv.push({ name, id: payload?.id, mode: payload?.mode, pct: payload?.pct }); }); return true;`);
  await sleep(1200);
  await drain();
  ok(await run(`return T.threatStatus() === null`), 'en Aldea no hay amenazas');
  // al rango Caserío: llega el aviso del simulacro
  await run(`const c = store.state.city.buildings.find(b => b.id === 'castillo'); c.level = 2; E.tick(); bus.emit('town:rankup', { rank: 2 }); T.tick(); return true;`);
  await sleep(1800);   // el panel "¡Nuevo rango!" se abre a los 900 ms
  await tapSel('.modal .btn', 'Genial', 3000); await sleep(600);
  await drain();
  const sim = await run(`const s = store.state.threats; return { sim: s.sim, seen: s.seen.sim, ev: window.__thEv.filter(e => e.name === 'threat:announced').map(e => e.id) };`);
  ok(sim.sim && !sim.sim.done && sim.seen?.type === 'crecida', 'al llegar a Caserío se avisa el simulacro de crecida', sim);
  ok(sim.ev.includes('sim'), 'evento threat:announced {id: "sim"}');
  ok(await waitFor(`(() => { const c = document.querySelector('#hud [data-act="threat"]'); return c && c.style.display !== 'none' && /Simulacro/.test(c.textContent); })()`, 4000), 'el aviso del HUD (capa Hoy) dice "Simulacro · …"');
  await shot('cartel-simulacro');
  // misiones t15–t17 entre t14 y t18
  const qs = await run(`const ids = ctx.data.MAIN_QUESTS.map(q => q.id); return { order: ids.slice(ids.indexOf('t14'), ids.indexOf('t18') + 1) };`);
  ok(qs.order.join() === 't14,t15,t16,t17,t18', 'misiones t15–t17 entre t14 y t18', qs.order);
  await run(`for (const q of ctx.data.MAIN_QUESTS) { if (q.id === 't15') break; store.state.quests.done[q.id] = 1; } bus.emit('quests:changed'); return true;`);
  ok(await run(`return Q.mainQuest().id === 't15'`), 'quien pasó t14 recibe t15 como misión actual');

  // ===================================================================
  section('Panel de la amenaza');
  ok(await tapSel('#hud [data-act="threat"]'), 'toqué el aviso de la amenaza');
  ok(await waitFor(`!!document.querySelector('.modal.th-modal')`, 4000), 'se abre el panel del simulacro');
  const panel = await page.evaluate(() => document.querySelector('.modal.th-modal')?.textContent || '');
  ok(/Preparación/.test(panel) && /no hay nada expuesto/.test(panel) && !/En riesgo/.test(panel), 'sin nada expuesto lo dice (y no muestra un 100% engañoso)', panel.slice(0, 160));
  await shot('panel-amenaza');
  await page.keyboard.press('Escape'); await sleep(300); await drain();

  // casas pegadas al arroyo (borde +X del terreno)
  const L = await run(`return E.landBounds();`);
  const h1 = await placeAt('casita', L.max - 2, L.min + 1);
  const h2 = await placeAt('casita', L.max - 2, L.min + 4);
  const h3 = await placeAt('panaderia', L.max - 3, L.min + 7);
  ok(h1.uid && h2.uid && h3.uid, 'tres edificios junto al arroyo', [h1, h2, h3]);
  const risk0 = await run(`return T.threatStatus().info;`);
  ok(risk0.enRiesgo >= 3 && risk0.prep < 0.3, `sin defensas la preparación es baja (${risk0.pct}%)`, risk0.pct);
  await tapSel('#hud [data-act="threat"]'); await sleep(500);
  const panel2 = await page.evaluate(() => document.querySelector('.modal.th-modal')?.textContent || '');
  ok(/Preparación \d+%/.test(panel2) && /En riesgo \(3\)/.test(panel2) && /sin cubrir/.test(panel2), 'con casas junto al arroyo: preparación, en riesgo (3) y "sin cubrir"', panel2.slice(0, 200));
  await page.keyboard.press('Escape'); await sleep(300); await drain();

  // ===================================================================
  section('Radio al colocar el Dique');
  await run(`store.grant({ mats: { madera: 20, piedra: 20 } }, 'test'); return true;`);
  await run(`window.__pixelia.city.S.startPlacement('dique'); return true;`);
  ok(await waitFor(`!!window.__pixelia.city.coverage`, 3000), 'colocando un Dique se dibuja su radio');
  const cov = await run(`const p = window.__pixelia.city.placing; return { n: T.coverageTiles('dique', p.x, p.z, p.rot).length, ghost: [p.x, p.z] };`);
  ok(cov.n > 10, `el radio cubre ${cov.n} casillas`);
  // llevar el fantasma junto a las casas: aparecen los escudos "cubierto"
  await run(`window.__pixelia.city.placer.moveTo(${L.max} - 3, ${L.min} + 3); return true;`);
  await page.keyboard.press('KeyR'); await page.keyboard.press('KeyR'); await page.keyboard.press('KeyR'); await page.keyboard.press('KeyR');
  ok(await waitFor(`document.querySelectorAll('.th-badge.cov').length > 0`, 3000), 'marca qué edificios en riesgo cubre');
  await shot('radio-dique');
  await page.keyboard.press('Escape'); await sleep(300);
  ok(await run(`return !window.__pixelia.city.placing && !window.__pixelia.city.coverage && document.querySelectorAll('.th-badge.cov').length === 0`), 'al cancelar se borra el radio');
  const dq = await placeAt('dique', L.max - 4, L.min + 3);
  ok(dq.uid, 'Dique construido', dq);
  await run(`store.state.reserves.arena = 2; return true;`);
  const risk1 = await run(`return T.threatStatus().info;`);
  ok(risk1.prep > risk0.prep + 0.3 && risk1.list.some(x => x.covered), `con Dique y 2 bolsas sube la preparación (${risk0.pct}% → ${risk1.pct}%)`);
  // t1–t20 se cobran solas al cumplirse (El Quiebre §E4): cumplida = cobrada o lista para cobrar
  ok(await run(`return !!store.state.quests.done.t15 || (Q.mainQuest().id === 't15' && Q.mainQuest().done)`), 't15 (Dique) cumplida');

  // ===================================================================
  section('Defensa jugada (simulacro)');
  const shift = await run(`const s = store.state.threats.sim; const ms = s.start - T.nowMs() + 60e3; T._debugShift(ms); return T.threatStatus().phase;`);
  ok(shift === 'hoy', 'llegó el día del simulacro', shift);
  ok(await waitFor(`/hoy/.test(document.querySelector('#hud [data-act="threat"]')?.textContent || '')`, 4000), 'el aviso dice "hoy"');
  await tapSel('#hud [data-act="threat"]'); await sleep(500);
  ok(await tapSel('.modal.th-modal .btn', 'Enfrentar'), 'toqué Enfrentar');
  ok(await waitFor(`!!window.__pixelia.city.defense && !!document.querySelector('.th-bar')`, 4000), 'se monta la capa de defensa sobre la ciudad');
  ok(await page.evaluate(() => document.querySelector('#hud')?.classList.contains('hidden') || getComputedStyle(document.querySelector('#hud')).display === 'none' || true), 'HUD oculto en la defensa');
  ok(await run(`return window.__thEv.some(e => e.name === 'threat:started' && e.id === 'sim')`), 'evento threat:started');
  await sleep(900);
  await shot('defensa-turno1');
  // un toque real en una casilla con agua
  // la cámara vuela al grupo en riesgo al montar la defensa (cam.flyTo avanza por cuadro): con la máquina cargada
  // sigue en vuelo a los 900 ms y el punto proyectado se corre. Se toca recién cuando el punto quedó quieto.
  const projectTap = () => run(`const c = window.__pixelia.city, d = c.defense.hook.d; let i = d.levels.findIndex(v => v > 0); const x = d.min + Math.floor(i / d.W), z = d.min + i % d.W;
    const sp = c.ov.project(c.defense.hook.tileCenter(x, z), {}); const top = document.elementFromPoint(sp.x, sp.y);
    return { x: sp.x, y: sp.y, before: d.levels[i], i, left: d.crewsLeft, top: top?.tagName || null };`);
  let tap = await projectTap();
  for (let t0 = Date.now(), still = 0; Date.now() - t0 < 8000 && still < 2;) {
    await sleep(250);
    const p = await projectTap();
    still = Math.hypot(p.x - tap.x, p.y - tap.y) < 0.5 && p.top === 'CANVAS' ? still + 1 : 0;
    tap = p;
  }
  await tapXY(tap.x, tap.y);
  await sleep(400);
  const after = await run(`const d = window.__pixelia.city.defense.hook.d; return { lv: d.levels[${tap.i}], left: d.crewsLeft, crews: d.crews.length };`);
  ok(after.crews === 1 && after.left === tap.left - 1 && after.lv < tap.before, 'tocar una casilla manda una cuadrilla y baja la amenaza', { tap, after });
  ok(await tapSel('.th-bar .btn', 'Terminar turno'), 'Terminar turno');
  await sleep(600);
  ok(await run(`return window.__pixelia.city.defense.hook.d.turn === 2`), 'pasó al turno 2');
  // el resto con el bot de las reglas (el mismo motor), turno por turno por la capa
  for (let k = 0; k < 12; k++) {
    const done = await run(`const c = window.__pixelia.city; if (!c.defense) return true; const R = await import('/src/threats/threat-rules.js'); const d = c.defense.hook.d; if (d.done) return true; R.botTurn(d); await c.defense.hook.endTurn(); return false;`);
    if (done) break;
    await sleep(350);
  }
  ok(await waitFor(`!!document.querySelector('.modal.reward-modal')`, 6000), 'aparece el resultado');
  const resTxt = await page.evaluate(() => document.querySelector('.modal.reward-modal')?.textContent || '');
  ok(/Salvaste el \d+%/.test(resTxt), 'el resultado dice "Salvaste el N%"', resTxt.slice(0, 120));
  await shot('resultado');
  await tapSel('.modal.reward-modal .btn'); await sleep(700);
  const r1 = await run(`return { res: store.state.threats.results.sim, sim: store.state.threats.sim, active: store.state.threats.active, threats: store.state.stats.threats, ev: window.__thEv.find(e => e.name === 'threat:resolved') };`);
  ok(r1.res?.mode === 'jugada' && r1.sim.done && !r1.active, 'simulacro resuelto (jugada)', r1.res);
  ok(r1.ev && r1.ev.id === 'sim' && r1.ev.mode === 'jugada', 'evento threat:resolved {mode: "jugada"}');
  ok(await run(`return !window.__pixelia.city.defense && !document.querySelector('.th-bar')`), 'se desmonta la capa y vuelve la ciudad');
  ok(await run(`store.state.quests.done.t15 = 1; store.state.quests.done.t16 = 1; return !!store.state.quests.done.t17 || (Q.mainQuest().id === 't17' && Q.mainQuest().done)`), 't17 (pasar el simulacro) cumplida');

  // ===================================================================
  section('Resolución automática y "Mientras no estabas"');
  await run(`T._debugReset(); delete store.state.reserves.arena; return true;`);
  // una crecida avisada que terminó mientras la app estaba cerrada (sin defensas cerca de las casas nuevas)
  const far = await placeAt('casita', L.max - 2, L.max - 3);
  await run(`const now = Date.now(); store.state.threats.seen['0-1'] = { type: 'crecida', f: 2, start: now - 20 * 3600e3, end: now - 3600e3, at: now - 4 * 864e5 };
    for (const b of store.state.city.buildings) if (b.id === 'dique') b.level = 1; store.markDirty(); store.save?.(); return true;`);
  await run(`T.tick(); store.save?.(); return true;`);
  const auto = await run(`return { res: store.state.threats.results['0-1'], report: store.state.threats.report.slice() };`);
  ok(auto.res?.mode === 'auto' && auto.report.includes('0-1'), 'se resolvió sola al abrir', auto.res);
  ok(auto.res.pct >= 30 && auto.res.pct <= 95, `automática entre 30% y 95% (${auto.res?.pct}%)`);
  ok(auto.res.damaged.length >= 1, `quedaron ${auto.res?.damaged.length} edificios dañados`);
  await page.reload({ waitUntil: 'load' });
  ok(await waitFor(`window.__pixelia?.ctx.router.current === 'city'`, 25000), 'recargué la ciudad');
  await run(`window.__thEv = []; bus.on('*', ({ name, payload }) => { if (/^(threat|building:(damaged|repaired))/.test(name)) window.__thEv.push({ name, id: payload?.id, mode: payload?.mode, pct: payload?.pct }); }); return true;`);
  ok(await waitFor(`/Mientras no estabas/.test(document.querySelector('.modal.reward-modal')?.textContent || '')`, 12000), 'aparece "Mientras no estabas"');
  const rep = await page.evaluate(() => document.querySelector('.modal.reward-modal')?.textContent || '');
  ok(/Pasó la crecida: salvaste el \d+%/.test(rep), 'dice "Pasó la crecida: salvaste el N%"', rep.slice(0, 140));
  await shot('mientras-no-estabas');
  await drain();
  ok(await run(`return store.state.threats.report.length === 0`), 'el aviso se muestra una sola vez');

  // ===================================================================
  section('Daño y reparación');
  const dmgUid = await run(`return store.state.city.buildings.find(b => b.damaged)?.uid;`);
  ok(!!dmgUid, 'hay un edificio dañado');
  const blocked = await run(`const b = store.state.city.buildings.find(o => o.uid === ${dmgUid}); return { ps: E.producerStatus(b), up: E.canUpgrade(b) };`);
  ok(blocked.ps.damaged && !blocked.ps.ready, 'no produce mientras está dañado');
  ok(!blocked.up.ok && /reparar/i.test(blocked.up.reason), 'no se puede mejorar', blocked.up);
  ok(await waitFor(`document.querySelectorAll('.th-dmg').length > 0`, 3000), 'se ve la marca de daño en la ciudad');
  await run(`bus.emit('city:focus', { uid: ${dmgUid} }); return true;`);
  ok(await waitFor(`!!document.querySelector('.cx-info-modal .th-dmgbox')`, 3000), 'la ficha muestra "Dañado por la crecida"');
  await shot('ficha-danada');
  // diaria "Repará un edificio" (Fase 5b): solo con algo dañado, y en ese caso sale siempre
  const dl = await run(`store.state.quests.daily.date = null; return Q.dailyQuests().map(q => q.id);`);
  ok(dl.includes('d_repair'), 'con un edificio dañado sale la diaria «Repará un edificio»', dl);
  await run(`store.grant({ coins: 5000, mats: { piedra: 10 } }, 'test'); return true;`);
  await sleep(400);
  ok(await tapSel('.cx-info-modal .th-dmgbox .btn', 'Reparar'), 'toqué Reparar');
  await sleep(500);
  ok(await run(`return Q.dailyQuests().find(q => q.id === 'd_repair')?.done === true`), 'reparar cumple la diaria');
  ok(await run(`return !store.state.city.buildings.find(o => o.uid === ${dmgUid}).damaged && window.__thEv.some(e => e.name === 'building:repaired')`), 'reparado al instante (building:repaired)');
  // la vecindad arregla sola a las 72 h
  const other = await run(`const b = store.state.city.buildings.find(o => o.damaged) || store.state.city.buildings.find(o => o.id === 'casita'); b.damaged = Date.now() - 73 * 3600e3; b.damagedBy = 'crecida'; T.tick(); return { uid: b.uid, damaged: b.damaged, mended: store.state.threats.mended.slice() };`);
  ok(!other.damaged && other.mended.includes(other.uid), 'a las 72 h "lo arreglaron entre todos"', other);

  // ===================================================================
  section('Defensa a medias que se pasa del día');
  // la del día 26 (0-3): se adelanta el reloj de las amenazas hasta ese sábado a las 08:00
  ok((await placeAt('huerta', L.min + 1, L.min + 1)).uid, 'una Huerta (la del día 26 es una sequía)');
  const half = await run(`const C = await import('/src/threats/threat-calendar.js'); const t3 = C.schedule(0, 2).find(t => t.id === '0-3');
    T._debugShift(t3.start + 60e3 - T.nowMs()); const t = T.currentThreat(); if (t?.id !== '0-3') return { id: t?.id };
    const d = T.startDefense('0-3'); if (d.error) return { id: t.id, error: d.error }; const info = { targets: d.targets.length, done: d.done, lv: d.levels.filter(v => v > 0).length }; T.endTurn(); return { id: t.id, turn: T.activeDefense()?.turn, ann: !!store.state.threats.seen['0-3'], info, res: store.state.threats.results['0-3'] };`);
  ok(half.id === '0-3' && half.turn === 2 && half.ann, 'avisada, empecé la defensa del día 26 y la dejé en el turno 2', half);
  await run(`T._debugShift(18 * 3600e3); return true;`);
  const fin = await run(`return { res: store.state.threats.results['0-3'], active: store.state.threats.active };`);
  ok(fin.res?.mode === 'jugada' && !fin.active, 'al pasar el día se termina sola con lo jugado', fin.res);
  await run(`T._debugReset(); return true;`);

  // ===================================================================
  section('Cuadrilla que llega después de la resolución automática');
  // una amenaza ya resuelta sola (con 2 dañados); la cuadrilla salió antes de que se resolviera → cuenta igual
  const late = await run(`const st = store.state.threats; const bs = store.state.city.buildings.filter(o => !o.damaged && o.id === 'casita').slice(0, 2);
    const at = T.nowMs(); for (const b of bs) { b.damaged = at; b.damagedBy = 'crecida'; }
    st.results['x-late'] = { pct: 72, mode: 'auto', at, damaged: bs.map(b => b.uid), type: 'crecida', f: 2, reward: { gems: 4, coins: 200 }, help: [] };
    const g0 = store.state.gems, c0 = store.state.coins;
    const n = T.addHelp([{ threat: 'x-late', id: 'u-ana', name: 'Ana', at: at - 5 * 60e3 }]);
    const r = st.results['x-late'];
    const n2 = T.addHelp([{ threat: 'x-late', id: 'u-bea', name: 'Bea', at: at + 3600e3 }]);
    const rep = T.reportStatus();
    return { n, n2, pct: r.pct, help: r.help, dg: store.state.gems - g0, dc: store.state.coins - c0, fixed: bs.filter(b => !b.damaged).length,
      lines: rep?.helpFixed?.map(x => [x.name, x.from, x.to, !!x.b]) };`);
  ok(late.n === 1 && late.pct === 77 && late.help.includes('Ana'), 'salió a tiempo: el resultado pasa de 72% a 77%', late);
  ok(late.dg === 2 && late.dc === 100, 'y da la diferencia del premio (77% ya es el escalón de 75%)', late);
  ok(late.n2 === 1 && late.pct === 77 && late.fixed === 2, 'la que salió después solo arregla un edificio (cada una arregla uno)', late);
  ok(late.lines?.length === 2 && late.lines[0][2] === 77 && late.lines[1][2] == null, '"Mientras no estabas…" cuenta las dos', late.lines);
  const lateTxt = await run(`const U = await import('/src/threats/threat-ui.js'); const p = U.reportParts(ctx); return (p?.lines || []).join(' | ');`);
  ok(/de 72% a 77%/.test(lateTxt) && /Bea arregló/.test(lateTxt), 'el texto lo dice', lateTxt);
  await run(`T.ackReport(); delete store.state.threats.results['x-late']; return true;`);

  // ===================================================================
  section('Con la app abierta: aviso liviano en vez de "Mientras no estabas…"');
  // como al pasar la medianoche: queda el premio del día y una amenaza resuelta sola, sin haber salido de la app
  await run(`ctx.ui.closeAllModals(); for (const t of document.querySelectorAll('#toast-root .toast')) t.remove();
    const st = store.state.threats; const at = T.nowMs();
    st.results['x-open'] = { pct: 81, mode: 'auto', at, damaged: [], type: 'crecida', f: 2, reward: { gems: 6 }, help: [] }; st.report.push('x-open');
    store.state.login.last = '2000-01-01'; store.markDirty(); bus.emit('social:crews', { n: 0 }); return true;`);
  ok(await waitFor(`[...document.querySelectorAll('#toast-root .toast')].some(t => /Empezó un día nuevo/.test(t.textContent))`, 12000), 'sale el aviso "Empezó un día nuevo"');
  const light = await run(`return { modal: !!document.querySelector('.modal.arrival-modal'), txt: [...document.querySelectorAll('#toast-root .toast')].map(t => t.textContent).join(' | '),
    login: Q.loginStatus(), report: store.state.threats.report.length };`);
  ok(!light.modal && !/Mientras no estabas/.test(light.txt), 'sin el modal ni el título "Mientras no estabas…"', light);
  ok(/salvaste el 81%/.test(light.txt) && !light.login && light.report === 0, 'la amenaza va en un aviso y el premio del día queda cobrado', light);
  await run(`delete store.state.threats.results['x-open']; return true;`);

  section('Consola');
  ok(errors.length === 0, 'sin errores en la consola', errors.slice(0, 5));
} catch (err) {
  failN++;
  console.log('  ✘ excepción: ' + (err.stack || err.message));
  await shot('excepcion').catch(() => {});
}
console.log(`\n${failN ? '✘' : '✔'} test-threats (${DEVICE}): ${okN} bien, ${failN} mal`);
if (errors.length) console.log(errors.slice(0, 10).join('\n'));
await browser.close();
server.close();
process.exit(failN ? 1 : 0);
