// Prueba del ambiente (docs/PLAN-QUIEBRE.md §J1–J5, src/core/ambience.js), en Node y en Chrome headless.
//
//   node tools/test-ambience.mjs [--shots]
//
// Node: reloj de la ciudad, fases del día, mezcla (noche, tormenta, la isla gris), la luz como progreso, el clima y la
// noche de la expedición como reglas (visión, costo del paso, Farol y Lona, pronóstico, salidas viejas sin reloj).
// Chrome: la ciudad de noche (ventanas, estrellas, corrección de color), la tormenta con lluvia, reducir movimiento sin
// partículas, el ajuste "Día y noche", state.world.light, la expedición de noche (visión −1, chip de hora y clima),
// polvo y huellas al caminar, y que al salir de la ciudad las ventanas se apaguen.
// Con --shots deja capturas en shots/ambience/.
import http from 'node:http';
import { readFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { join, extname, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer-core';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = process.argv.includes('--shots');
let pass = 0, fail = 0;
const ok = (c, msg, extra) => { if (c) { pass++; console.log('  ✔', msg); } else { fail++; console.log('  ✘', msg, extra !== undefined ? JSON.stringify(extra) : ''); } };
const section = t => console.log('\n■', t);
const imp = (p) => import(pathToFileURL(join(ROOT, p)).href);

// =====================================================================
// Node: lo puro
// =====================================================================
const A = await imp('src/core/ambience.js');
const R = await imp('src/expedition/exp-rules.js');
const { EXP } = await imp('src/expedition/exp-data.js');

section('Reloj y fases del día');
{
  const t = Date.UTC(2026, 10, 8, 12);
  const h = A.cityHour(t);
  ok(h >= 0 && h < 24 && A.cityHour(t) === h, 'la hora de la ciudad sale de la hora real y es estable', h);
  ok(Math.abs(((A.cityHour(t + A.CITY_DAY_MS / 24) - h + 24) % 24) - 1) < 1e-6, 'una hora de la ciudad dura 50 s reales (20 min por día)');
  ok(A.cityHour(t + A.CITY_DAY_MS) === h, 'el día de la ciudad da la vuelta en 20 minutos');
  ok(A.dayPhase(12).day === 1 && A.dayPhase(0).night === 1, 'mediodía es de día y medianoche es de noche');
  ok(A.dayPhase(19).warm > 0.8 && A.dayPhase(12).warm < 0.05, 'el atardecer es dorado');
  ok(A.isNightHour(20) && A.isNightHour(5.5) && !A.isNightHour(6) && !A.isNightHour(19.9), 'la noche de las reglas va de 20 a 6');
  ok(A.hourText(21.5) === '21:30' && A.hourText(6) === '06:00', 'la hora se escribe 21:30');
}

section('Mezcla del ambiente');
{
  const base = { sky: 'linear-gradient(180deg, #a9daff 0%, #cdeaff 36%, #eef6f0 70%, #fdf0d4 100%)', stars: 0.3, hemiSky: 0xffffff, hemiGround: 0xd6c8a6, hemiI: 1.15, sun: 0xfff1de, sunI: 2.48 };
  const day = A.resolveLook({ base, hour: 12, light: 1 });
  const night = A.resolveLook({ base, hour: 23, light: 1 });
  const storm = A.resolveLook({ base, hour: 12, weather: 'tormenta', light: 1 });
  const gray = A.resolveLook({ base, hour: 12, light: 0 });
  const lum = (h) => { const [r, g, b] = A.hexToRgb(h); return 0.3 * r + 0.59 * g + 0.11 * b; };
  ok(day.sky.length === 4 && day.sky[0][0] === '#a9daff', 'de día y con la isla viva el cielo es el del estilo');
  ok(night.hemiI < day.hemiI * 0.5 && night.sunI < day.sunI * 0.3, 'de noche baja la luz', [night.hemiI, night.sunI]);
  ok(lum(night.sky[0][0]) < 40 && night.stars > 0.8 && night.glow > 0.9, 'de noche el cielo es oscuro, con estrellas y ventanas prendidas');
  ok(day.glow < 0.05, 'de día las ventanas no brillan');
  ok(storm.flash && storm.fx?.kind === 'rain' && storm.sat < day.sat && storm.hemiI < day.hemiI, 'la tormenta trae lluvia, relámpagos y apaga el color');
  ok(gray.sat < day.sat && gray.sat >= 0.7, 'la isla gris está desaturada pero se lee', gray.sat);
  ok(A.resolveLook({ base, place: 'exp:lejos', hour: 12 }).fog.amt > A.resolveLook({ base, place: 'exp:cerca', hour: 12 }).fog.amt, 'lejos hay más niebla que cerca');
  ok(A.resolveLook({ base, place: 'mina', hour: 12 }).sunI < 0.5 && A.PLACES.mina.veins, 'la mina es oscura y tiene vetas que brillan');
  ok(A.resolveLook({ base, place: 'bajo', hour: 12 }).night === true, 'el Bajo Mundo no tiene sol');
  ok(Object.values(A.THREAT_WEATHER).every(w => A.WEATHER[w]), 'cada amenaza tiene su clima');
  ok(A.parseSky('').length === 4 && A.skyCss([['#000000', 0], ['#ffffff', 100]]).startsWith('linear-gradient'), 'se lee y se arma el degradé del cielo');
  const ws = new Set(); for (let d = 0; d < 400; d++) ws.add(A.cityWeather(d * A.CITY_DAY_MS));
  ok(ws.has('despejado') && ws.has('lluvia') && ws.size >= 4, 'el clima de la ciudad cambia de un día al otro', [...ws]);
  ok(![...Array(400).keys()].some(d => A.cityWeather(d * A.CITY_DAY_MS, { snowy: true }) === 'lluvia'), 'con un estilo nevado no llueve: nieva');
  ok(A.combatConditions({ hour: 22, night: true, weather: 'niebla' }).weather === 'niebla', 'el combate hereda la hora y el clima de la casilla');
}

section('La luz como progreso');
{
  const s0 = { story: { chapter: 'prologo' }, city: { buildings: [] } };
  const s1 = { story: { chapter: 'sierras' }, city: { buildings: Array(10).fill({}) } };
  const s2 = { story: { chapter: 'costa', flags: { faro: true }, elements: ['a', 'b'] }, city: { buildings: Array(40).fill({}) } };
  const l0 = A.lightFor(s0, 1), l1 = A.lightFor(s1, 3), l2 = A.lightFor(s2, 8);
  ok(l0 < 0.2, 'la isla arranca gris', l0);
  ok(l0 < l1 && l1 < l2 && l2 <= 1, 'capítulos, rango, casas, elementos y el faro la iluminan', [l0, l1, l2]);
  ok(A.lightFor({ story: { chapter: 'abordaje', act: 3, flags: { faro: true }, elements: [1, 2, 3, 4] }, city: { buildings: Array(80) } }, 10) === 1, 'tope en 1');
  const st = { story: { chapter: 'bosque' }, city: { buildings: [] } };
  const r = A.updateWorldLight(st, 2);
  ok(st.world.light === r.to && r.changed && !A.updateWorldLight(st, 2).changed, 'state.world.light se guarda y solo cambia cuando hay algo nuevo');
}

section('Expedición: día, noche y clima como reglas');
{
  const mk = (o = {}) => R.newRun({ region: 'sierras', zone: 1, seed: 1234, party: ['cazador'], ...o });
  const a = mk(), b = mk();
  ok(JSON.stringify(a.front) === JSON.stringify(b.front) && a.clock.start === EXP.dawn, 'se sale al alba y el frente sale de la semilla');
  let fronts = 0, early = 0;
  for (let i = 0; i < 2000; i++) { const f = R.makeFront('sierras', i); if (f) { fronts++; if (f.from < EXP.weatherFrom[0]) early++; } }
  ok(Math.abs(fronts / 2000 - EXP.weather.sierras.p) < 0.05 && !early, 'la chance de un frente es la de la región', fronts / 2000);
  ok(R.makeFront('nada', 1) === null, 'sin datos de la región no hay clima');
  // los mapas y peligros no cambian: el clima usa otra suerte
  ok(a.rs === b.rs && JSON.stringify(a.cells) === JSON.stringify(b.cells), 'las mismas semillas dan el mismo mapa');
  const run = mk(); run.front = null;
  const v0 = R.conditions(run);
  ok(v0.hour === 6 && !v0.night && v0.nightIn === 14 && v0.vision === 0, 'a la mañana no pesa nada y avisa en cuántos pasos se hace de noche', v0);
  run.steps = 14;
  const vn = R.conditions(run);
  ok(vn.night && vn.vision === -1 && vn.why.some(t => /Farol/.test(t)), 'de noche: visión −1 y dice que el Farol la devuelve');
  run.equip = ['farol'];
  ok(R.conditions(run).vision === 0, 'con el Farol la noche no quita visión');
  run.equip = []; run.steps = 2;
  run.front = { kind: 'tormenta', from: 4, len: 3 };
  const fc = R.conditions(run);
  ok(fc.forecast?.kind === 'tormenta' && fc.forecast.in === 2 && fc.step === 0, 'el frente se anuncia antes de llegar', fc.forecast);
  const cell = { terrain: 'colina' }, flat = { terrain: 'llano' };
  const before = R.stepCost(run, cell), beforeFlat = R.stepCost(run, flat);
  run.steps = 4;
  const st = R.conditions(run);
  ok(st.weather === 'tormenta' && st.vision === -1 && st.step === 1 && R.stepCost(run, cell) === before + 1, 'la tormenta baja la visión y encarece la colina');
  ok(R.stepCost(run, flat) === beforeFlat, 'en el llano el paso cuesta lo mismo');
  run.equip = ['lona'];
  ok(R.conditions(run).step === 0 && R.stepCost(run, cell) === before, 'la Lona cubre la tormenta');
  run.steps = 7;
  ok(R.conditions(run).weather === 'despejado', 'el frente pasa');
  run.front = { kind: 'niebla', from: 0, len: 5 }; run.steps = 1;
  ok(R.conditions(run).vision === -1 && R.conditions(run).step === 0, 'la niebla tapa casillas');
  const old = mk(); delete old.clock; delete old.front; old.steps = 20;
  const co = R.conditions(old);
  ok(co.hour === 12 && !co.night && co.weather === 'despejado' && co.nightIn === null, 'una salida guardada antes (sin reloj) sigue igual');
  ok(R.view(mk()).cond?.hourText === '06:00', 'la vista trae la hora y el clima');
  // la noche se nota en lo que se ve
  const day = mk({ seed: 77 }); day.front = null;
  const nightRun = mk({ seed: 77 }); nightRun.front = null; nightRun.clock.start = 22;
  for (const c of nightRun.cells) c.seen = false;
  const nb = nightRun.cells[(nightRun.pos[1] - 1) * nightRun.w + nightRun.pos[0]];
  const res = R.move(nightRun, nightRun.pos[0], nightRun.pos[1] - 1);
  const revealed = res.events.filter(e => e.type === 'reveal').reduce((n, e) => n + e.cells.length, 0);
  const res2 = R.move(day, day.pos[0], day.pos[1] - 1);
  const revealedDay = res2.events.filter(e => e.type === 'reveal').reduce((n, e) => n + e.cells.length, 0);
  ok(nb && revealed < revealedDay + 6, 'de noche se abre menos niebla al caminar', [revealed, revealedDay]);
  ok(A.expEchoSpots({ w: 2, cells: [{ content: 'ruina', visited: true }, { content: 'ruina', visited: false }] }).length === 1, 'los ecos de noche van en las ruinas ya pisadas');
  ok(A.cityEchoSpots(12).length === 3, 'y en el borde de la isla de la ciudad');
}

// =====================================================================
// Chrome
// =====================================================================
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
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', e => errors.push('PAGEERROR: ' + (e.stack || e.message)));
page.on('console', m => { if (m.type() === 'error' && !/supabase|Failed to load resource/i.test(m.text())) errors.push('CONSOLE.ERROR: ' + m.text()); });
await page.setRequestInterception(true);
page.on('request', r => (/supabase\.co/.test(r.url()) ? r.abort() : r.continue()));
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function waitFor(code, ms = 15000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { try { if (await page.evaluate(code)) return true; } catch {} await sleep(150); }
  return false;
}
const AsyncFn = Object.getPrototypeOf(async function () {}).constructor;
const run = (body) => page.evaluate(new AsyncFn(`const { store, ctx, bus } = window.__pixelia; const V = await import('/src/core/voxel.js'); ${body}`));
const shot = async (name) => { if (!SHOTS) return; mkdirSync(join(ROOT, 'shots/ambience'), { recursive: true }); await page.screenshot({ path: join(ROOT, 'shots/ambience', name) }); };
async function city(q) {
  await page.goto(`${BASE}?scene=city&nosplash&nosw${q}`, { waitUntil: 'load' });
  return waitFor(`window.__pixelia?.ctx.router.current === 'city' && !!window.__pixelia.city?.ambience?.amb.look`, 30000);
}

section('Ciudad de noche');
ok(await city('&reset&cheat=8&hour=22.5&weather=despejado'), 'la ciudad abre con ?hour=22.5');
await sleep(2500);
{
  const s = await run(`const a = window.__pixelia.city.ambience, r = window.__pixelia.city.r;
    return { night: a.night, hour: a.hourText, glow: a.amb.look.glow, win: V.windowMaterial().emissiveIntensity, grade: r.grade, sky: getComputedStyle(document.querySelector('.scene-city')).getPropertyValue('--cx-sky'), light: store.state.world?.light, stars: a.amb.look.stars };`);
  ok(s.night && s.hour === '22:30', 'es de noche a las 22:30', s.hour);
  ok(s.glow > 0.85 && s.win > 0.7, 'las ventanas se prenden', [s.glow, s.win]);
  ok(s.grade && s.grade.sat < 1 && s.grade.tint[2] > s.grade.tint[0], 'la noche apaga el color y tira a azul', s.grade);
  ok(/#[01][0-9a-f]/.test(s.sky) && s.stars > 0.8, 'el cielo es de noche y con estrellas', s.sky.slice(0, 60));
  ok(typeof s.light === 'number' && s.light > 0 && s.light < 1, 'state.world.light está guardado', s.light);
  const wins = await run(`let n = 0; window.__pixelia.city.r.scene.traverse(o => { if (o.material === V.windowMaterial()) n++; }); return n;`);
  ok(wins > 0, 'los vidrios de las casas van en su capa', wins);
  await shot('ciudad-noche.png');
}

section('Tormenta, reducir movimiento y el ajuste Día y noche');
{
  await run(`window.__pixelia.city.ambience.debug({ hour: 15, weather: 'tormenta', now: true });`);
  await sleep(2500);
  const s = await run(`const a = window.__pixelia.city.ambience.amb; return { w: a.look.weather, p: a.particles, flash: a.look.flash, sat: a.look.sat };`);
  ok(s.w === 'tormenta' && s.p > 50 && s.flash, 'la tormenta llueve y tiene relámpagos', s);
  await shot('ciudad-tormenta.png');
  await run(`ctx.setSetting({ motion: 'on' });`);
  await sleep(600);
  ok(await run(`return window.__pixelia.city.ambience.amb.particles;`) === 0, 'con reducir movimiento no cae nada');
  await run(`ctx.setSetting({ motion: 'auto', particles: 'few' });`);
  await sleep(600);
  const few = await run(`return window.__pixelia.city.ambience.amb.particles;`);
  ok(few > 0 && few < s.p, 'con pocas partículas llueve menos', [few, s.p]);
  await run(`ctx.setSetting({ particles: 'normal' }); window.__pixelia.city.ambience.debug({ hour: null, weather: 'despejado', now: true }); ctx.setSetting({ dayNight: false });`);
  ok(await run(`return window.__pixelia.city.ambience.hour;`) === 12, 'con "Día y noche" apagado la ciudad queda de día');
  await run(`ctx.setSetting({ dayNight: true }); window.__pixelia.city.ambience.debug({ hour: 12, now: true });`);
  await sleep(1200);
  await shot('ciudad-dia.png');
  // una amenaza en señales trae su clima
  const tw = await run(`const d = window.__pixelia.city.decor; return typeof Object.getOwnPropertyDescriptor(d, 'weather')?.get === 'function';`);
  ok(tw, 'la decoración de amenazas le pasa su clima al ambiente');
  // la luz sube con el rango
  const l0 = await run(`return store.state.world.light;`);
  await run(`bus.emit('story:chapter', {}); store.state.story.chapter = 'costa'; bus.emit('story:chapter', {});`);
  ok(await run(`return store.state.world.light;`) > l0, 'un capítulo nuevo ilumina la isla');
}

section('Expedición de noche');
await page.goto(`${BASE}?scene=expedition&proto=1&region=bosque&seed=11&new=1&hour=21&nosplash&nosw`, { waitUntil: 'load' });
ok(await waitFor(`!!document.querySelector('.scene-expedition')?.__exp?.cond`, 30000), 'la expedición abre');
await sleep(1500);
{
  const s = await page.evaluate(() => { const X = document.querySelector('.scene-expedition').__exp; return { cond: X.cond, look: X.look && { night: X.look.night, fog: X.look.fog.amt }, chip: document.querySelector('[data-ex=clock]')?.textContent, tip: document.querySelector('[data-ex=clock]')?.dataset.tip }; });
  ok(s.cond.night && s.cond.vision === -1, 'de noche la expedición ve menos', s.cond);
  ok(/21:00/.test(s.chip) && /visión/.test(s.chip + s.tip), 'el chip dice la hora y lo que pesa', s.chip);
  ok(s.look?.night, 'se ve de noche');
  await shot('expedicion-noche.png');
  const mv = await page.evaluate(() => { const X = document.querySelector('.scene-expedition').__exp; const m = X.view.moves.find(m => m.ok); if (m) X.move(m.x, m.y); return !!m; });
  ok(mv, 'el grupo da un paso');
  await waitFor(`!document.querySelector('.scene-expedition').__exp.busy`, 8000);
  const after = await page.evaluate(() => document.querySelector('.scene-expedition').__exp.cond.hourText);
  ok(after === '22:00', 'cada paso es una hora', after);
}
ok(await run(`ctx.router.go('city'); return true;`), 'vuelve a la ciudad');
await waitFor(`window.__pixelia?.ctx.router.current === 'city' && !!window.__pixelia.city?.ambience?.amb.look`, 20000);
await sleep(1500);
ok(await run(`return V.windowMaterial().emissiveIntensity;`) > 0.5, 'la ciudad sigue a la hora (?hour=21): ventanas prendidas');
await run(`ctx.router.go('wardrobe');`);
await waitFor(`window.__pixelia?.ctx.router.current === 'wardrobe'`, 20000);
await sleep(800);
ok(await run(`return V.windowMaterial().emissiveIntensity;`) === 0, 'fuera de la ciudad y la expedición las ventanas no brillan');

console.log(`\n${pass} bien, ${fail} mal`);
if (errors.length) { console.log('\n=== ERRORES ===\n' + [...new Set(errors)].join('\n')); fail++; }
await browser.close(); server.close();
process.exit(fail ? 1 : 0);
