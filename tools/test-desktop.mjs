// Prueba del juego de PC: abre el .exe compilado (desktop/src-tauri/target/release) con depuración remota de WebView2,
// se conecta por CDP y revisa que el juego arranque como app de escritorio (Tauri, sin service worker, guardado, online).
//   npm run desktop:build && node test-desktop.mjs [--shots ../shots/desktop]
// Solo Windows (WebView2). En macOS lo cubre el modo manual de .github/workflows/desktop.yml.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const exe = join(ROOT, 'desktop/src-tauri/target/release/pixelia.exe');
if (!existsSync(exe)) { console.error('No está el .exe: corré npm run desktop:build'); process.exit(1); }
const si = process.argv.indexOf('--shots');
const shotDir = si > 0 ? resolve(process.argv[si + 1]) : join(ROOT, 'shots');
mkdirSync(shotDir, { recursive: true });
const out = join(shotDir, 'desktop');
const child = spawn(exe, [], { env: { ...process.env, WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: '--remote-debugging-port=9333' }, stdio: 'ignore' });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let browser;
for (let i = 0; i < 30 && !browser; i++) { await sleep(500); try { browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9333', defaultViewport: null }); } catch {} }
if (!browser) { console.log('no CDP'); child.kill(); process.exit(1); }
const [page] = (await browser.pages()).filter(p => !p.url().startsWith('devtools'));
await sleep(2500);
await page.screenshot({ path: out + '-splash.png' });
const info = await page.evaluate(() => ({ url: location.href, desktop: window.__pixelia?.ctx?.desktop, tauri: !!window.__TAURI__, updater: !!window.__TAURI__?.updater, sw: !!navigator.serviceWorker?.controller, cls: document.documentElement.className, splashReady: document.getElementById('splash')?.className, ls: (() => { try { localStorage.setItem('probe', '1'); return localStorage.getItem('probe'); } catch (e) { return String(e); } })() }));
console.log(JSON.stringify(info));
await page.mouse.click(400, 400);
await sleep(5000);
await page.screenshot({ path: out + '-after.png' });
console.log('scene', await page.evaluate(() => document.querySelector('.scene-root')?.className));
// online: ¿llega Supabase desde este origen?
console.log('net', await page.evaluate(async () => { try { const m = await import('./src/online/config.js'); const url = m.SUPABASE_URL; const r = await fetch(url + '/auth/v1/health', { headers: { apikey: m.SUPABASE_ANON_KEY } }); return r.status + ' ' + url; } catch (e) { return 'ERR ' + e; } }));
// Ajustes → Pantalla (paso 2c): la ventana entra en el monitor; sin bordes, pantalla completa y ventana; zoom de la interfaz
console.log('ventana', await page.evaluate(async () => {
  const D = await import('./src/core/desktop.js'), S = await import('./src/core/settings.js');
  const w = window.__TAURI__.window.getCurrentWindow();
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  const size = async () => { const s = await w.outerSize(), f = await w.scaleFactor(); return [Math.round(s.width / f), Math.round(s.height / f)]; };
  const m = await D.monitorInfo();
  const r = { monitor: m && [m.w, m.h, 'útil', m.aw, m.ah], inicio: await size() };
  r.entra = !!m && r.inicio[0] <= m.aw && r.inicio[1] <= m.ah;
  S.setSetting({ winMode: 'borderless' }); await wait(1500); r.sinBordes = [await size(), 'deco', await w.isDecorated()];
  S.setSetting({ winMode: 'fullscreen' }); await wait(1800); r.completa = await w.isFullscreen();
  S.setSetting({ winMode: 'window', winRes: '1280x720' }); await wait(1800); r.ventana = [await size(), 'fs', await w.isFullscreen(), 'deco', await w.isDecorated()];
  S.setSetting({ uiScale: 125 }); await wait(700); r.zoom125 = devicePixelRatio;
  S.setSetting({ uiScale: 100, winRes: 'auto' }); await wait(700); r.zoom100 = devicePixelRatio;
  return JSON.stringify(r);
}));
await page.screenshot({ path: out + '-ventana.png' });
browser.disconnect(); child.kill();
