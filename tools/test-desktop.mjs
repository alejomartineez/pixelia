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
browser.disconnect(); child.kill();
