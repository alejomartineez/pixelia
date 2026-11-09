// Prueba de Ajustes completos (docs/PLAN-QUIEBRE.md §G, src/core/settings.js), en Chrome headless.
//
//   node tools/test-settings.mjs
//
// Cubre: valores por defecto y migración de un save viejo (lowQuality, music), cada pestaña del panel, que los gráficos
// se apliquen en vivo a la escena montada (escala de resolución, sombras, contorno, antialias, partículas) y a una escena
// nueva, el limitador de FPS medido, el contador de FPS, la escala de la interfaz, los volúmenes, la velocidad de la
// cámara, los atajos reasignados (también en la ciudad), accesibilidad, exportar/importar la partida como archivo .json,
// los créditos de Dezings y que todo sobreviva al reabrir.
import http from 'node:http';
import { readFileSync, writeFileSync, existsSync, statSync, mkdtempSync } from 'node:fs';
import { join, extname, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
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
await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', e => errors.push('PAGEERROR: ' + (e.stack || e.message)));
page.on('console', m => { if (m.type() === 'error' && !/supabase|Failed to load resource/i.test(m.text())) errors.push('CONSOLE.ERROR: ' + m.text()); });
await page.setRequestInterception(true);
page.on('request', r => (/supabase\.co/.test(r.url()) ? r.abort() : r.continue()));

let pass = 0, fail = 0;
const ok = (c, msg, extra) => { if (c) { pass++; console.log('  ✔', msg); } else { fail++; console.log('  ✘', msg, extra !== undefined ? JSON.stringify(extra) : ''); } };
const section = t => console.log('\n■', t);
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function waitFor(code, ms = 10000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { try { if (await page.evaluate(code)) return true; } catch {} await sleep(120); }
  return false;
}
const AsyncFn = Object.getPrototypeOf(async function () {}).constructor;
/** Corre código en la página con store, ctx, bus, V (voxel.js), A (audio) y S (settings.js). */
const run = (body) => page.evaluate(new AsyncFn(`const { store, ctx, bus } = window.__pixelia; const V = await import('/src/core/voxel.js'); const S = await import('/src/core/settings.js'); const A = ctx.audio; ${body}`));
const settings = () => run('return JSON.parse(JSON.stringify(ctx.state.settings));');
/** Canvas de la ciudad: ancho del buffer de dibujo / ancho en pantalla. */
const cityScale = () => run(`const r = window.__pixelia.city?.r; if (!r) return null; return { ratio: r.canvas.width / r.canvas.clientWidth, outline: r.outline, samples: r.samples, shadows: r.shadows };`);
async function openCity(query = '') {
  await page.goto(`${BASE}?scene=city&nosplash&nosw${query}`, { waitUntil: 'load' });
  await page.evaluate(() => history.replaceState(null, '', location.pathname + '?nosplash&nosw'));
  return waitFor(`window.__pixelia?.ctx.router.current === 'city' && !!window.__pixelia.city?.r`, 25000);
}
async function closeModals() {
  for (let i = 0; i < 8; i++) {
    if (!(await page.evaluate(() => !!document.querySelector('.modal')))) return;
    await page.evaluate(() => document.querySelector('.modal .modal-x')?.click() || document.querySelector('.modal .modal-foot .btn:last-child')?.click());
    await sleep(350);
  }
}
async function openSettings(tab) {
  await closeModals();
  await run(`ctx.openPanel('settings', { tab: '${tab}' }); return true;`);
  return waitFor(`document.querySelector('.set-tab.on')?.dataset.tab === '${tab}'`, 4000);
}
const click = (sel) => page.evaluate((sel) => { const e = document.querySelector(sel); e?.scrollIntoView({ block: 'center' }); e?.click(); return !!e; }, sel);
/** Mueve un deslizador y dispara input + change (como al soltarlo). */
const slide = (key, v) => page.evaluate((key, v) => {
  const i = document.querySelector(`.set-range[data-key="${key}"]`);
  if (!i) return false;
  i.value = String(v); i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}, key, v);
/** FPS dibujados durante ms, moviendo el mouse para que la ciudad no baje al tope de reposo. */
async function measureFps(ms = 2400) {
  // ventana chica: el dibujo por software de headless no llega a 60 FPS a 1280×720
  await page.setViewport({ width: 360, height: 240, deviceScaleFactor: 1 }); await sleep(300);
  const n0 = await run('return V.frameStats.frames;');
  const t0 = Date.now();
  for (let t = 0; t < ms; t += 300) { await page.mouse.move(100 + (t % 600) / 10, 120); await sleep(300); }
  const n1 = await run('return V.frameStats.frames;');
  const fps = (n1 - n0) * 1000 / (Date.now() - t0);
  await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 }); await sleep(300);
  return fps;
}

try {
  // ===================================================================
  section('Valores por defecto');
  ok(await openCity('&reset&cheat=10'), 'la ciudad carga');
  await run('store.state.onboarded = true; return true;');
  await closeModals();
  let s = await settings();
  ok(s.gfxPreset === 'auto' && s.renderScale === 200 && s.maxFps === 60 && s.uiScale === 100 && s.winMode === 'window', 'gráficos y pantalla por defecto (preset automático, 200 %, 60 FPS)', s);
  // juego de PC: la escala por defecto es 115 % (partida nueva o una que seguía en el 100 % de antes, una sola vez)
  ok(await openCity('&reset&cheat=10&desktop'), 'la ciudad carga como juego de PC');
  await run('store.state.onboarded = true; return true;');
  let sd = await settings();
  ok(sd.uiScale === 115 && sd.uiScale115 === true, 'PC: escala por defecto 115 %', sd.uiScale);
  await run(`store.state.settings.uiScale = 100; const SM = await import('/src/core/settings.js'); SM.normalize(store.state.settings); return true;`);
  ok((await settings()).uiScale === 100, 'PC: si después elegís 100 %, queda en 100 % (el salto es una sola vez)');
  await run(`const st = store.state.settings; st.uiScale = 100; delete st.uiScale115; const SM = await import('/src/core/settings.js'); SM.normalize(st); return true;`);
  ok((await settings()).uiScale === 115, 'PC: una partida vieja que seguía en 100 % sube a 115 %');
  ok(await openCity('&reset&cheat=10'), 'la ciudad carga de nuevo en el navegador');
  await run('store.state.onboarded = true; return true;');
  await closeModals();
  s = await settings();
  ok(s.uiScale === 100, 'web: la escala sigue en 100 %', s.uiScale);
  ok(s.volMaster === 0.8 && s.volMusic === 0.7 && s.volSfx === 0.8 && s.volAmb === 0.6 && s.volUi === 0.8 && s.volVoice === 1 && s.muteBg === true, 'volúmenes por defecto (volSfx existe para el logo)');
  ok(s.textSpeed === 'normal' && s.combatSpeed === 1 && s.hints === true && s.camSpeed === 1 && JSON.stringify(s.keys) === '{}', 'juego y controles por defecto');
  ok(s.subtitles === true && s.hiContrast === false && s.textSize === 'normal', 'accesibilidad por defecto');
  const sc0 = await cityScale();
  ok(sc0 && Math.abs(sc0.ratio - 2) < 0.05 && sc0.outline && sc0.shadows, 'la ciudad se dibuja a 2× con contorno y sombras', sc0);
  ok(await run(`return document.querySelector('#hud [data-act="settings"]') !== null`), 'el botón de Ajustes está en el HUD');

  // ===================================================================
  section('Panel: pestañas');
  ok(await openSettings('gfx'), 'Ajustes abre en Gráficos');
  const tabs = await page.evaluate(() => [...document.querySelectorAll('.set-tab')].map(b => b.textContent.trim()));
  ok(tabs.join('|') === 'Gráficos|Pantalla|Sonido|Juego|Idioma|Controles|Accesibilidad|Partida', 'ocho pestañas (con Idioma, paso 4a)', tabs);
  for (const t of ['screen', 'sound', 'game', 'keys', 'a11y', 'save', 'gfx']) {
    await click(`.set-tab[data-tab="${t}"]`);
    ok(await waitFor(`document.querySelector('.set-tab.on')?.dataset.tab === '${t}' && document.querySelector('.set-pane .pnl-sec')`, 2000), `pestaña ${t} se arma`);
  }
  await page.focus('.set-tab.on');
  await page.keyboard.press('ArrowDown');
  ok(await waitFor(`document.querySelector('.set-tab.on')?.dataset.tab === 'screen'`, 1500), 'las flechas pasan de pestaña');
  await click('.set-tab[data-tab="gfx"]');

  // ===================================================================
  section('Gráficos en vivo');
  await click('.set-seg[data-key="gfxPreset"] [data-v="low"]');
  await sleep(300);
  s = await settings();
  let sc = await cityScale();
  ok(s.gfxPreset === 'low' && s.renderScale === 100 && !s.shadows && !s.aa && s.particles === 'few', 'preset Baja: 100 %, sin sombras ni antialias, pocas partículas', s);
  ok(sc && Math.abs(sc.ratio - 1) < 0.05 && !sc.shadows && sc.samples === 0 && sc.outline, 'la ciudad montada pasa a 1× sin sombras ni MSAA (con contorno)', sc);
  ok(await run('return V.graphics().particles === 0.4'), 'partículas a 0,4');
  await click('.set-seg[data-key="gfxPreset"] [data-v="high"]');
  await sleep(300);
  sc = await cityScale();
  ok(sc && Math.abs(sc.ratio - 2) < 0.05 && sc.shadows && sc.samples === 4, 'preset Alta: vuelve a 2× con sombras y MSAA', sc);
  ok(await slide('renderScale', 150), 'deslizador de escala de resolución');
  await sleep(300);
  s = await settings(); sc = await cityScale();
  ok(s.renderScale === 150 && s.gfxPreset === 'medium' && Math.abs(sc.ratio - 1.5) < 0.05, 'a 150 % (coincide con Media) la ciudad se dibuja a 1,5×', { p: s.gfxPreset, sc });
  await slide('renderScale', 50); await sleep(300);
  s = await settings(); sc = await cityScale();
  ok(s.renderScale === 50 && s.gfxPreset === 'custom' && Math.abs(sc.ratio - 0.5) < 0.05, 'a 50 % queda Personalizada y se dibuja a 0,5×', { p: s.gfxPreset, sc });
  await click('.set-switch[data-key="outline"]'); await sleep(250);
  sc = await cityScale();
  ok(!sc.outline && sc.samples === 4, 'sin contorno: sigue el antialias (el mismo pase sin líneas)', sc);
  await click('.set-switch[data-key="aa"]'); await sleep(250);
  sc = await cityScale();
  ok(!sc.outline && sc.samples === 0, 'sin contorno ni antialias: dibujo directo', sc);
  await click('.set-switch[data-key="outline"]'); await click('.set-switch[data-key="aa"]'); await click('.set-switch[data-key="shadows"]'); await sleep(250);
  sc = await cityScale();
  ok(sc.outline && sc.samples === 4 && !sc.shadows, 'contorno y antialias de vuelta, sombras apagadas', sc);
  await click('.set-seg[data-key="particles"] [data-v="many"]');
  ok(await run('return V.graphics().particles === 1.8'), 'muchas partículas: 1,8');
  const burst = await run(`const before = window.__pixelia.city.r.scene.children.length; return true;`);
  ok(burst, 'la ciudad sigue andando después de los cambios');

  // ===================================================================
  section('Limitador de FPS y contador');
  await click('.set-switch[data-key="showFps"]');
  ok(await waitFor(`Number(document.querySelector('#fps-meter')?.dataset.fps) > 0`, 4000), 'el contador de FPS aparece y mide');
  // sin foco de ventana (headless a veces) rige el tope de segundo plano: se lo sube para medir el limitador
  await click('.set-seg[data-key="bgFps"] [data-v="60"]');
  await click('.set-seg[data-key="maxFps"] [data-v="30"]');
  const f30 = await measureFps();
  ok(await run('return window.__pixelia.city.r.fps === 30'), 'el renderer montado apunta a 30');
  await click('.set-seg[data-key="maxFps"] [data-v="60"]');
  const f60 = await measureFps();
  ok(f30 > 12 && f30 < 33.5, `con tope 30 se dibujan ≈30 FPS (${f30.toFixed(1)})`);
  ok(await run('return window.__pixelia.city.r.fps === 60'), 'el renderer montado apunta a 60 con el tope en 60');
  // headless dibuja por software: solo si la máquina pasa holgado de 30 se compara la medición
  if (f60 > 36) ok(f60 > f30 * 1.15, `con tope 60 se dibuja más (${f60.toFixed(1)})`);
  else console.log(`    (la máquina no pasa de ${f60.toFixed(1)} FPS en headless: no se compara 30 contra 60)`);
  await click('.set-seg[data-key="bgFps"] [data-v="10"]');
  const hasFocus = await page.evaluate(() => document.hasFocus());
  if (!hasFocus) {
    const fbg = await measureFps();
    ok(fbg < 12, `sin foco rige el tope de segundo plano: 10 (${fbg.toFixed(1)})`);
  } else console.log('    (la ventana headless tiene foco: no se mide el tope de segundo plano)');
  await click('.set-seg[data-key="bgFps"] [data-v="30"]');
  await click('.set-switch[data-key="showFps"]');
  ok(await waitFor(`!document.querySelector('#fps-meter')`, 2000), 'el contador se va al apagarlo');

  // ===================================================================
  section('Pantalla');
  await click('.set-tab[data-tab="screen"]');
  const modes = await page.evaluate(() => [...document.querySelectorAll('.set-seg[data-key="winMode"] .a11y-opt')].map(b => b.dataset.v));
  ok(modes.join() === 'window,fullscreen', 'en el navegador: ventana o pantalla completa (sin bordes es del juego de PC)', modes);
  await slide('uiScale', 120); await sleep(200);
  const z = await page.evaluate(() => ({ cls: document.documentElement.classList.contains('ui-scaled'), v: getComputedStyle(document.documentElement).getPropertyValue('--ui-scale').trim(), hud: getComputedStyle(document.getElementById('hud')).zoom }));
  ok(z.cls && z.v === '1.2' && Number(z.hud) === 1.2, 'escala de la interfaz 120 %: el HUD se agranda', z);
  await slide('uiScale', 100); await sleep(150);
  ok(await page.evaluate(() => !document.documentElement.classList.contains('ui-scaled')), 'a 100 % vuelve al tamaño normal');

  // ===================================================================
  section('Sonido');
  await click('.set-tab[data-tab="sound"]');
  await slide('volMaster', 50); await slide('volMusic', 0); await slide('volSfx', 40); await slide('volAmb', 20); await slide('volUi', 60);
  s = await settings();
  ok(s.volMaster === 0.5 && s.volMusic === 0 && s.volSfx === 0.4 && s.volAmb === 0.2, 'los deslizadores guardan 0..1', s);
  ok(s.music === false && s.sfx === true, 'música en 0 = música apagada (el sí/no de siempre)');
  const lv = await run(`return { m: A.level('master'), mu: A.level('music'), sfx: A.level('sfx'), amb: A.level('amb'), ui: A.level('ui') };`);
  ok(Math.abs(lv.m - 0.4375) < 1e-6 && lv.mu === 0 && Math.abs(lv.sfx - 0.4) < 1e-6 && Math.abs(lv.amb - 0.2 * 0.7 / 0.6) < 1e-6 && Math.abs(lv.ui - 0.6 * 0.6 / 0.8) < 1e-6, 'el audio aplica los volúmenes por canal (también interfaz)', lv);
  await slide('volMusic', 70);
  ok((await settings()).music === true, 'subir la música la vuelve a prender');
  await click('.set-switch[data-key="muteBg"]');
  ok((await settings()).muteBg === false, 'silenciar en segundo plano se apaga');
  await click('.set-switch[data-key="muteBg"]');

  // ===================================================================
  section('Juego');
  await click('.set-tab[data-tab="game"]');
  for (const [k, v] of [['textSpeed', 'fast'], ['combatSpeed', '3']]) await click(`.set-seg[data-key="${k}"] [data-v="${v}"]`);
  await click('.set-switch[data-key="skipSeen"]'); await click('.set-switch[data-key="confirmEnd"]'); await click('.set-switch[data-key="hints"]');
  s = await settings();
  ok(s.textSpeed === 'fast' && s.combatSpeed === 3 && s.skipSeen === true && s.confirmEnd === false && s.hints === false, 'diálogos, combate x3, saltear vistas, fin de turno y pistas', s);
  await click('.set-switch[data-key="hints"]');
  // velocidad de la cámara: cuánto se mueve con la tecla adelante en 300 ms
  await closeModals();
  // desde el centro (si no, el borde de la isla frena la cámara)
  const center = () => run('const c = window.__pixelia.city.cam; c.stop(); c.st.x = 0; c.st.z = 0; c.apply(); return true;');
  const camMove = async () => {
    await center();
    const a = await run('const c = window.__pixelia.city.cam.st; return [c.x, c.z];');
    await run(`window.__pixelia.city.cam.key('up', true); return true;`);
    await sleep(300);   // corto: a 200 % no llega al borde de la isla (12 unidades)
    await run(`window.__pixelia.city.cam.key('up', false); return true;`);
    const b = await run('const c = window.__pixelia.city.cam.st; return [c.x, c.z];');
    return Math.hypot(b[0] - a[0], b[1] - a[1]);
  };
  const d1 = await camMove();
  await openSettings('game'); await slide('camSpeed', 200); await closeModals();
  const d2 = await camMove();
  ok(d1 > 0 && d2 > d1 * 1.5, `cámara al 200 % se mueve más rápido (${d1.toFixed(2)} → ${d2.toFixed(2)})`);
  await openSettings('game'); await slide('camSpeed', 100);
  await click('.set-switch[data-key="edgeScroll"]');
  ok((await settings()).edgeScroll === true, 'desplazamiento con los bordes se prende');
  await closeModals();
  if (await page.evaluate(() => document.hasFocus())) {
    await center();
    const a = await run('const c = window.__pixelia.city.cam.st; return [c.x, c.z];');
    await page.mouse.move(640, 1); await sleep(700); await page.mouse.move(640, 360);
    const b = await run('const c = window.__pixelia.city.cam.st; return [c.x, c.z];');
    ok(Math.hypot(b[0] - a[0], b[1] - a[1]) > 0.2, 'con el mouse en el borde de arriba la cámara avanza');
  } else console.log('    (sin foco de ventana: no se prueba el borde con el mouse)');
  await openSettings('game'); await click('.set-switch[data-key="edgeScroll"]');

  // ===================================================================
  section('Controles');
  await click('.set-tab[data-tab="keys"]');
  ok(await page.evaluate(() => document.querySelectorAll('.set-key').length >= 14), 'lista de atajos');
  await click('.set-key[data-act="build"]');
  ok(await waitFor(`document.querySelector('.set-key[data-act="build"]')?.classList.contains('wait')`, 1500), 'clic en la tecla: espera una nueva');
  await page.keyboard.press('KeyN');
  s = await settings();
  ok(s.keys.build === 'KeyN', 'Construir pasa a N', s.keys);
  await click('.set-key[data-act="build"]'); await page.keyboard.press('KeyC');
  s = await settings();
  ok(s.keys.build === 'KeyC' && s.keys.collect === 'KeyN', 'C ya era de Cobrar todo: se intercambian', s.keys);
  await click('.set-key[data-act="build"]'); await page.keyboard.press('Escape');
  ok(await waitFor(`document.querySelector('.set-tab.on')?.dataset.tab === 'keys' && !document.querySelector('.set-key.wait')`, 1500), 'Esc cancela la espera sin cerrar Ajustes');
  await click('.set-key[data-act="build"]'); await page.keyboard.press('Space');
  ok((await settings()).keys.build === 'KeyC', 'Espacio está reservada: no se asigna');
  await page.keyboard.press('KeyN');   // termina la espera: Construir → N (Cobrar vuelve a C, la de fábrica)
  s = await settings();
  ok(s.keys.build === 'KeyN' && !s.keys.collect, 'las teclas iguales a las de fábrica no se guardan', s.keys);
  await closeModals();
  await page.keyboard.press('KeyB'); await sleep(500);
  const byB = await page.evaluate(() => !!document.querySelector('.modal'));
  await page.keyboard.press('KeyN');
  ok(!byB && await waitFor(`!!document.querySelector('.modal')`, 3000), 'en la ciudad, N abre Construir y B ya no');
  await closeModals();
  await openSettings('keys');
  await page.evaluate(() => [...document.querySelectorAll('.set-pane .btn')].find(b => /fábrica/.test(b.textContent))?.click());
  ok(JSON.stringify((await settings()).keys) === '{}', 'volver a las teclas de fábrica');

  // ===================================================================
  section('Accesibilidad');
  await click('.set-tab[data-tab="a11y"]');
  await click('.set-seg[data-key="textSize"] [data-v="large"]');
  await click('.set-switch[data-key="hiContrast"]'); await click('.set-switch[data-key="subtitles"]');
  const a11y = await page.evaluate(() => ({ l: document.documentElement.classList.contains('text-l'), hc: document.documentElement.classList.contains('hi-contrast') }));
  s = await settings();
  ok(a11y.l && s.textSize === 'large', 'texto grande al instante');
  ok(a11y.hc && s.hiContrast && s.subtitles === false, 'alto contraste (clase en <html>) y subtítulos');
  await click('.set-switch[data-key="subtitles"]');

  // ===================================================================
  section('Partida: archivo .json y créditos');
  await click('.set-tab[data-tab="save"]');
  const credits = await page.evaluate(() => document.querySelector('.set-credits')?.textContent || '');
  ok(/Un juego de Dezings/.test(credits), 'créditos: "Un juego de Dezings"');
  ok(await waitFor(`/Versión v\\d+/.test(document.querySelector('.set-credits')?.textContent || '')`, 4000), 'créditos con la versión del juego');
  await run(`ctx.state.player.cityName = 'Villa Prueba'; return true;`);
  await page.evaluate(() => {
    window.showSaveFilePicker = undefined;
    const orig = URL.createObjectURL;
    URL.createObjectURL = (b) => { window.__blob = b; return orig.call(URL, b); };
    HTMLAnchorElement.prototype.click = function () { window.__dl = this.download; };
  });
  await click('.set-export');
  ok(await waitFor('!!window.__blob && !!window.__dl', 3000), 'Guardar en un archivo arma la descarga');
  const exp = await page.evaluate(async () => ({ name: window.__dl, txt: await window.__blob.text() }));
  let payload = null;
  try { payload = JSON.parse(exp.txt); } catch {}
  ok(/^pixelia-villa-prueba-\d{4}-\d{2}-\d{2}\.json$/.test(exp.name), `nombre del archivo: ${exp.name}`);
  ok(payload?.juego === 'Pixelia' && payload.formato === 1 && typeof payload.codigo === 'string', 'el archivo trae juego, formato y código');
  const decoded = payload && JSON.parse(Buffer.from(payload.codigo, 'base64').toString('utf8'));
  ok(decoded?.player?.cityName === 'Villa Prueba', 'el código del archivo es la partida actual');
  // cargar: un archivo con otro nombre de ciudad
  decoded.player.cityName = 'Puerto Archivo';
  decoded.settings.renderScale = 130;
  const dir = mkdtempSync(join(tmpdir(), 'pixelia-'));
  const file = join(dir, 'partida.json');
  writeFileSync(file, JSON.stringify({ ...payload, codigo: Buffer.from(JSON.stringify(decoded), 'utf8').toString('base64') }));
  const bad = join(dir, 'roto.json');
  writeFileSync(bad, '{"juego":"Pixelia","codigo":"esto-no-es-una-partida"}');
  const input = await page.$('input.set-file');
  // el confirm que está abierto (no uno que se está cerrando)
  const CONFIRM = `.modal-back:not([data-closing]) .modal.pnl-confirm`;
  const accept = () => page.evaluate((sel) => [...document.querySelectorAll(sel + ' .btn')].find(b => /Cargar/.test(b.textContent))?.click(), CONFIRM);
  await input.uploadFile(bad);
  await waitFor(`!!document.querySelector('${CONFIRM}')`, 3000);
  await accept();
  ok(await waitFor(`[...document.querySelectorAll('.toast')].some(t => /no se pudo leer/.test(t.textContent))`, 3000), 'un archivo roto avisa y no carga nada');
  ok(await run(`return ctx.state.player.cityName === 'Villa Prueba'`), 'la partida sigue igual');
  await (await page.$('input.set-file')).uploadFile(file);
  ok(await waitFor(`!!document.querySelector('${CONFIRM}')`, 3000), 'cargar desde un archivo pide confirmar');
  await accept();
  await page.waitForNavigation({ waitUntil: 'load', timeout: 15000 }).catch(() => {});
  ok(await waitFor(`window.__pixelia?.ctx.state.player.cityName === 'Puerto Archivo'`, 20000), 'después de recargar está la partida del archivo');
  ok(await run(`return ctx.state.settings.renderScale === 130`), 'con sus ajustes');

  // ===================================================================
  section('Sobrevive al reabrir');
  await openCity();
  await openSettings('gfx');
  await click('.set-seg[data-key="gfxPreset"] [data-v="medium"]');
  await click('.set-tab[data-tab="keys"]'); await click('.set-key[data-act="themes"]'); await page.keyboard.press('KeyY');
  await click('.set-tab[data-tab="sound"]'); await slide('volAmb', 35);
  await click('.set-tab[data-tab="a11y"]'); await click('.set-seg[data-key="textSize"] [data-v="xlarge"]');
  await closeModals();
  await page.reload({ waitUntil: 'load' });
  ok(await waitFor(`window.__pixelia?.ctx.router.current === 'city' && !!window.__pixelia.city?.r`, 25000), 'la ciudad vuelve a cargar');
  s = await settings();
  ok(s.gfxPreset === 'medium' && s.renderScale === 150 && s.keys.themes === 'KeyY' && s.volAmb === 0.35 && s.textSize === 'xlarge', 'preset, tecla, volumen y texto quedaron guardados', s);
  sc = await cityScale();
  ok(sc && Math.abs(sc.ratio - 1.5) < 0.05, 'y la escena nueva arranca con ellos (1,5×)', sc);
  ok(await page.evaluate(() => document.documentElement.classList.contains('text-xl')), 'texto muy grande aplicado al abrir');

  // ===================================================================
  section('Save viejo (antes de los Ajustes completos)');
  await page.evaluate(() => {
    const k = 'pixelia.save.v1';
    const st = JSON.parse(localStorage.getItem(k));
    st.settings = { music: false, sfx: true, lowQuality: true, telemetry: true, textSize: 'large', motion: 'auto' };
    localStorage.setItem(k, JSON.stringify(st));
  });
  // sin pagehide: el guardado de la página no pisa el save editado
  await page.evaluate(() => { window.__pixelia.store.save = () => {}; });
  await page.reload({ waitUntil: 'load' });
  ok(await waitFor(`!!window.__pixelia?.ctx.state`, 20000), 'el save viejo abre');
  s = await settings();
  ok(s.gfxPreset === 'low' && s.renderScale === 100 && s.shadows === false && s.lowQuality === false, 'lowQuality: true pasa al preset Baja', s);
  ok(s.music === false && s.volMusic === 0.7 && s.textSize === 'large' && JSON.stringify(s.keys) === '{}' && s.volSfx === 0.8, 'conserva música apagada y texto grande; lo nuevo llega con sus valores');
  ok(await run(`return A.level('music') === 0`), 'la música sigue muda');
} catch (e) {
  fail++;
  console.log('  ✘ excepción', e.stack || e);
}

if (errors.length) { console.log('\nErrores de la página:'); for (const e of errors.slice(0, 12)) console.log('  ', e); }
ok(errors.length === 0, 'sin errores en la consola');
console.log(`\n${pass} bien, ${fail} mal`);
await browser.close();
server.close();
process.exit(fail ? 1 : 0);
