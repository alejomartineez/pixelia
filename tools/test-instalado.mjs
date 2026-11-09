// Prueba del juego de PC YA INSTALADO (el .exe de NSIS en %LOCALAPPDATA%\Pixelia), como lo abriría otra persona.
// Abre la app con depuración remota de WebView2, la maneja por CDP y la cierra como el botón X (WM_CLOSE, sin /F),
// así se prueba también que el guardado sobreviva al cierre. Una fase por corrida, corta (límites de GPU del HANDOFF).
//   node test-instalado.mjs nueva    → partida limpia: logo, cinemática, onboarding hasta la ciudad, escala 115 %
//   node test-instalado.mjs reabrir  → la partida sigue (nombre y ciudad), va directo a la ciudad; F11 y modos de ventana
//   node test-instalado.mjs mock     → login online con el mock (?mock=1&mockuser=ana), sin cuentas reales
//   [--exe ruta] [--shots ../shots/instalador]
import { spawn, execSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const phase = process.argv[2] || 'nueva';
const exe = resolve(arg('--exe', join(process.env.LOCALAPPDATA || '', 'Pixelia', 'pixelia.exe')));
const shotDir = resolve(arg('--shots', join(ROOT, 'shots/instalador')));
mkdirSync(shotDir, { recursive: true });
if (!existsSync(exe)) { console.error('No está instalado: ' + exe); process.exit(1); }

const NAME = 'Inés Prueba', CITY = 'Puerto Instalado'   // el nombre de la ciudad tiene tope de 16 letras;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let fails = 0;
const ok = (c, m, extra) => { console.log(`${c ? '  ✔' : '  ✘'} ${m}${!c && extra !== undefined ? '  → ' + JSON.stringify(extra) : ''}`); if (!c) fails++; };

const child = spawn(exe, [], { env: { ...process.env, WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: '--remote-debugging-port=9334' }, stdio: 'ignore', detached: false });
let browser;
for (let i = 0; i < 40 && !browser; i++) { await sleep(500); try { browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9334', defaultViewport: null }); } catch {} }
if (!browser) { console.log('no CDP'); child.kill(); process.exit(1); }
let page = (await browser.pages()).find(p => !p.url().startsWith('devtools'));
const errors = [];
const watch = (p) => { p.on('pageerror', e => errors.push('PAGEERROR ' + e.message)); p.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE ' + m.text()); }); };
watch(page);
const ev = (fn, ...a) => page.evaluate(fn, ...a);
const waitFor = async (expr, ms = 8000) => { const t = Date.now(); while (Date.now() - t < ms) { try { if (await page.evaluate(expr)) return true; } catch {} await sleep(200); } return false; };
const tap = (sel) => ev((sel) => { const e = document.querySelector(sel); if (!e) return false; e.scrollIntoView({ block: 'center' }); e.click(); return true; }, sel);
// el splash está listo y arriba de todo (el logo de Dezings ya se fue): recién ahí el clic lo toma
const SPLASH = `(() => { const s = document.getElementById('splash'); if (!s?.classList.contains('ready')) return false; const e = document.elementFromPoint(innerWidth / 2, innerHeight / 2); return !!e && s.contains(e); })()`;
const shot = (n) => page.screenshot({ path: join(shotDir, `${phase}-${n}.png` ) });
const run = (body) => ev(new Function(`return (async () => { const { store, ctx } = window.__pixelia; ${body} })()`));
const winInfo = () => ev(async () => {
  const w = window.__TAURI__.window.getCurrentWindow(), f = await w.scaleFactor(), s = await w.outerSize(), p = await w.outerPosition();
  return { pos: [p.x, p.y], size: [Math.round(s.width / f), Math.round(s.height / f)], fs: await w.isFullscreen(), deco: await w.isDecorated(), dpr: devicePixelRatio };
});
/** Cierra como el botón X: WM_CLOSE a la ventana (taskkill sin /F), y espera que el proceso termine. */
async function closeLikeX() {
  try { browser.disconnect(); } catch {}
  try { execSync(`taskkill /PID ${child.pid}`, { stdio: 'ignore' }); } catch {}
  for (let i = 0; i < 20 && child.exitCode === null; i++) await sleep(300);
  if (child.exitCode === null) { console.log('  ✘ no cerró con WM_CLOSE: lo mato'); fails++; child.kill(); }
}

try {
  // la ventana arranca en about:blank y después carga el juego: esperar a que esté cargado
  for (let i = 0; i < 40 && !page.url().startsWith('http'); i++) await sleep(250);
  await waitFor(`document.readyState === 'complete' && !!window.__TAURI__`, 10000);
  const info =await ev(() => ({ url: location.href, tauri: !!window.__TAURI__, ua: navigator.userAgent.match(/Edg\/[\d.]+/)?.[0] }));
  console.log(phase, JSON.stringify(info));
  if (phase === 'nueva') {
    await sleep(1500); await shot('1-dezings');
    ok(await waitFor(SPLASH, 15000), 'logo de Dezings y después el splash, listo para el clic');
    await shot('1-splash');
    await page.mouse.click(600, 400);
    ok(await waitFor(`window.__pixelia?.ctx?.router?.current === 'intro'`, 12000), 'partida nueva: arranca la cinemática');
    await sleep(3500);
    await shot('2-cinematica');
    await tap('.scene-intro .in-skip');
    ok(await waitFor(`window.__pixelia.ctx.router.current === 'onboarding' && !!document.querySelector('.scene-onboarding .ob-type')`, 9000), 'después de la cinemática, el onboarding');
    await sleep(800);
    await shot('3-onboarding');
    const st = await run(`const s = store.state.settings; return { uiScale: s.uiScale, fps: s.fpsCap ?? s.fps, winMode: s.winMode, dpr: devicePixelRatio }`);
    ok(st.uiScale === 115, 'escala de interfaz por defecto: 115 %', st);
    console.log('  ajustes', JSON.stringify(st), JSON.stringify(await winInfo()));
    await tap('.scene-onboarding .ob-next');
    await waitFor(`document.querySelectorAll('.scene-onboarding .cls-card').length > 0`, 4000);
    await tap('.scene-onboarding .cls-card[data-cls="cazador"]');
    await sleep(300);
    await shot('4-clase');
    await tap('.scene-onboarding .ob-next');
    ok(await waitFor(`!!document.querySelector('.scene-onboarding [data-f=name]')`, 4000), 'paso del nombre');
    await page.click('.scene-onboarding [data-f=name]', { clickCount: 3 }); await page.keyboard.type(NAME, { delay: 20 });
    await page.click('.scene-onboarding [data-f=city]', { clickCount: 3 }); await page.keyboard.type(CITY, { delay: 20 });
    await shot('5-nombre');
    await tap('.scene-onboarding .ob-next');
    ok(await waitFor(`!!document.querySelector('.st-epic')`, 12000), 'llega Vera');
    await sleep(800);
    await shot('6-vera');
    await tap('.st-epic .st-skip');
    ok(await waitFor(`!!document.querySelector('.modal.tp-modal .tp-card')`, 9000), 'estilo de la ciudad');
    await tap('.modal.tp-modal .modal-foot .btn');
    ok(await waitFor(`window.__pixelia.ctx.router.current === 'city' && window.__pixelia.store.state.onboarded === true`, 6000), 'en la ciudad, onboarded');
    await sleep(2500);
    await shot('7-ciudad');
    // algo que se cambia justo antes de cerrar: tiene que sobrevivir al cierre con la X (autoguardado cada 4 s o pagehide)
    await run(`store.state.settings.uiScale115 = true; store.state.__marcaInstalador = Date.now(); store.save(); return true`);
  } else if (phase === 'reabrir') {
    await waitFor(SPLASH, 15000);
    await page.mouse.click(600, 400);
    ok(await waitFor(`window.__pixelia?.ctx?.router?.current === 'city'`, 12000), 'reabre directo en la ciudad (sin cinemática ni onboarding)');
    const s = await run(`return { name: store.state.player?.name, city: store.state.player?.cityName, onboarded: store.state.onboarded, uiScale: store.state.settings.uiScale, marca: store.state.__marcaInstalador ?? null }`);
    ok(s.name === NAME && s.city === CITY && s.onboarded, 'la partida sigue: nombre y ciudad', s);
    console.log('  partida', JSON.stringify(s));
    // el modo de ventana elegido la vez anterior se recupera al abrir (initDesktop)
    const saved = await run(`return store.state.settings.winMode`), w0 = await winInfo();
    ok(saved === 'fullscreen' ? w0.fs : !w0.fs, `abre en el modo guardado (${saved})`, w0);
    console.log('  ventana al abrir', JSON.stringify(w0));
    if (w0.fs) { await run(`const S = await import('./src/core/settings.js'); S.setSetting({ winMode: 'window' }); return true`); await sleep(1500); }
    await sleep(1500);
    await shot('1-ciudad');
    // F11 (lo atiende src/core/desktop.js)
    await page.keyboard.press('F11'); await sleep(1500);
    const f1 = await winInfo(); ok(f1.fs, 'F11 → pantalla completa', f1);
    await shot('2-f11');
    await page.keyboard.press('F11'); await sleep(1500);
    const f2 = await winInfo(); ok(!f2.fs, 'F11 otra vez → ventana', f2);
    ok((await run(`return store.state.settings.winMode`)) === 'window', 'Ajustes recuerda "ventana"');
    // Ajustes → Pantalla, con clics en los botones como lo haría alguien
    await run(`ctx.openPanel('settings', { tab: 'screen' }); return true`);
    ok(await waitFor(`document.querySelector('.set-tab.on')?.dataset.tab === 'screen'`, 4000), 'Ajustes → Pantalla');
    await sleep(500);
    await shot('3-ajustes-pantalla');
    const modes = await ev(() => [...document.querySelectorAll('.set-seg[data-key="winMode"] button')].map(b => b.dataset.v));
    console.log('  modos', modes.join(', '));
    for (const m of ['borderless', 'fullscreen', 'window']) {
      if (!modes.includes(m)) { ok(false, `falta el modo ${m}`); continue; }
      await tap(`.set-seg[data-key="winMode"] button[data-v="${m}"]`); await sleep(1800);
      const w = await winInfo();
      ok(m === 'fullscreen' ? w.fs : m === 'borderless' ? (!w.fs && !w.deco) : (!w.fs && w.deco), `modo ${m}`, w);
      await shot(`4-modo-${m}`);
    }
    const sc = await run(`return { uiScale: store.state.settings.uiScale, dpr: devicePixelRatio }`);
    console.log('  escala', JSON.stringify(sc));
    // se cierra en pantalla completa: la próxima vez tiene que abrir así
    if (!process.argv.includes('--queda-ventana')) { await tap('.set-seg[data-key="winMode"] button[data-v="fullscreen"]'); await sleep(1500); }
  } else if (phase === 'mock') {
    await page.goto(new URL('index.html?mock=1&mockuser=ana&scene=city', page.url()).href, { waitUntil: 'load' });
    await waitFor(SPLASH, 15000);
    await page.mouse.click(600, 400);
    ok(await waitFor(`!!window.__pixelia?.net?.user`, 12000), 'mock: sesión de ana iniciada');
    const u = await ev(() => ({ mode: window.__pixelia.net.mode, user: window.__pixelia.net.user?.email || window.__pixelia.net.user?.id }));
    console.log('  net', JSON.stringify(u));
    await sleep(1500);
    await run(`ctx.openSocial('amigas'); return true`).catch(() => {});
    await sleep(1200);
    await shot('1-contactos');
    // y la conexión al Supabase real (solo /auth/v1/health, sin cuentas)
    console.log('  supabase', await ev(async () => { try { const m = await import('./src/online/config.js'); const r = await fetch(m.SUPABASE_URL + '/auth/v1/health', { headers: { apikey: m.SUPABASE_ANON_KEY } }); return r.status; } catch (e) { return 'ERR ' + e; } }));
    // volver a la partida normal antes de cerrar
    await page.goto(new URL('index.html', page.url()).href, { waitUntil: 'load' });
    await sleep(1500);
  }
} catch (e) { ok(false, 'excepción: ' + e.message); }
for (const e of errors.slice(0, 10)) console.log('  ! ' + e);
await closeLikeX();
console.log(fails ? `${fails} falla(s)` : 'todo bien');
process.exit(fails ? 1 : 0);
