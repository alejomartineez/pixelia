// Prueba de las métricas anónimas (src/online/telemetry.js), la tarjeta de instalar y los ajustes de accesibilidad,
// en Chrome headless. Nunca toca el Supabase real: en modo "live" todas las llamadas a supabase.co se interceptan.
//
//   node tools/test-telemetry.mjs
//
// Cubre: modo mock (tandas en localStorage), eventos del bus (también los futuros expedition:* / threat:*),
// aperturas de panel, errores no capturados, interruptor de Ajustes, sin conexión (cola guardada y mandada después),
// respuestas 4xx/5xx, config vacío, migración de settings, tarjeta de instalar y tamaño de texto / reducir movimiento.
import http from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, dirname, resolve } from 'node:path';
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
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

let pass = 0, fail = 0;
const ok = (c, msg, extra) => { if (c) { pass++; console.log('  ✔', msg); } else { fail++; console.log('  ✘', msg, extra !== undefined ? JSON.stringify(extra) : ''); } };
const section = t => console.log('\n■', t);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/**
 * Abre el juego. live: intercepta supabase.co (events → `events`, el resto → {}), emptyConfig: config.js vacío.
 * status(): código con el que se responde a /rest/v1/events (o 'abort' para simular que no hay red).
 */
async function open(query, { live = false, emptyConfig = false, ua = null, status = () => 201 } = {}) {
  // cada apertura en su propio contexto: localStorage limpio (anon_id, cola, tarjeta de instalar)
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  // Chrome headless dispara beforeinstallprompt de verdad (el manifest es válido): se frena para que las pruebas
  // decidan cuándo hay aviso del navegador
  await page.evaluateOnNewDocument(() => addEventListener('beforeinstallprompt', e => e.stopImmediatePropagation(), true));
  const posts = [];
  const errors = [];
  if (ua) await page.setUserAgent(ua);
  await page.setRequestInterception(true);
  page.on('request', r => {
    const url = r.url();
    if (emptyConfig && url.endsWith('/src/online/config.js'))
      return r.respond({ contentType: 'text/javascript', body: "export const SUPABASE_URL = ''; export const SUPABASE_ANON_KEY = '';" });
    if (/supabase\.co/.test(url)) {
      if (!live) return r.abort();
      if (r.method() === 'OPTIONS') return r.respond({ status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' } });
      if (url.includes('/rest/v1/events')) {
        const st = status();
        if (st === 'abort') return r.abort('internetdisconnected');
        posts.push({ url, method: r.method(), headers: r.headers(), body: JSON.parse(r.postData() || 'null'), status: st });
        return r.respond({ status: st, contentType: 'application/json', body: st < 300 ? '' : '{"message":"bad"}', headers: { 'Access-Control-Allow-Origin': '*' } });
      }
      return r.respond({ status: 200, contentType: 'application/json', body: '{}', headers: { 'Access-Control-Allow-Origin': '*' } });
    }
    return r.continue();
  });
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(BASE + query + '&nosplash&nosw', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__pixelia && window.__pixeliaTelemetry && window.__pixeliaInstall, { timeout: 20000 });
  await sleep(400);
  return { page, posts, errors };
}
const T = (page, fn, ...a) => page.evaluate(fn, ...a);
const queueNames = page => T(page, () => window.__pixeliaTelemetry.queue.map(e => e.n));

try {
  // ---------------------------------------------------------------
  section('Modo mock: cola y tandas locales');
  let { page: P } = await open('?scene=city&mock=1&mockuser=tel&reset');
  ok((await T(P, () => window.__pixeliaTelemetry.sink)) === 'local', '?mock=1 → sink local (no sale nada a la red)');
  await T(P, () => localStorage.removeItem('pixelia.mock.events'));
  let q = await queueNames(P);
  ok(q[0] === 'session_start', 'la sesión arranca con session_start', q);
  const start = await T(P, () => window.__pixeliaTelemetry.queue.find(e => e.n === 'session_start').p);
  ok(start.days === 0 && typeof start.standalone === 'boolean' && start.level >= 1, 'session_start trae días desde la instalación, nivel y standalone', start);
  ok(q.includes('scene:changed'), 'el cambio de escena se registra');
  const ids = await T(P, () => ({ anon: window.__pixeliaTelemetry.anonId, ses: window.__pixeliaTelemetry.sessionId, stored: JSON.parse(localStorage.getItem('pixelia.anon.v1')), save: localStorage.getItem(window.__pixelia.store.state && 'pixelia.save.v1.mock.tel') || '' }));
  ok(UUID.test(ids.anon) && UUID.test(ids.ses) && ids.anon !== ids.ses, 'anon_id y session_id son uuid v4 distintos');
  ok(ids.stored?.id === ids.anon && !ids.save.includes(ids.anon), 'anon_id se guarda aparte de la partida (pixelia.anon.v1)');

  await T(P, () => {
    const { bus } = window.__pixelia;
    bus.emit('level:up', { level: 4, reward: { coins: 99 } });
    bus.emit('town:rankup', { rank: 2, def: { name: 'Pueblo' } });
    bus.emit('minigame:finished', { game: 'match3', score: 1234, stars: 3, won: true });
    bus.emit('building:built', { b: { id: 'casita', x: 3, z: 4 } });
    bus.emit('onboarding:step', { step: 0 }); bus.emit('onboarding:step', { step: 0 }); bus.emit('onboarding:step', { step: 1 });
    bus.emit('onboarding:done', {});
    bus.emit('expedition:start', { zone: 'bosque', days: 2, nested: { no: 1 } });
    bus.emit('threat:spawn', { kind: 'tormenta', level: 3 });
    bus.emit('coins:earned', { n: 5 });   // no está en TRACKED_EVENTS
  });
  const evs = await T(P, () => window.__pixeliaTelemetry.queue);
  const by = n => evs.filter(e => e.n === n);
  ok(by('level:up')[0]?.p.level === 4 && by('level:up')[0].p.reward === undefined, 'level:up con el nivel (sin objetos anidados)');
  ok(by('town:rankup')[0]?.p.rank === 2, 'town:rankup');
  ok(JSON.stringify(by('minigame:finished')[0]?.p) === JSON.stringify({ game: 'match3', stars: 3, won: true, score: 1234 }), 'minigame:finished con juego, estrellas, ganó y puntaje');
  ok(by('building:built')[0]?.p.id === 'casita', 'building:built con el id del edificio');
  ok(by('onboarding:step').map(e => e.p.step).join() === '0,1' && by('onboarding:done').length === 1, 'pasos del onboarding (sin repetir el mismo paso)');
  ok(by('expedition:start')[0]?.p.zone === 'bosque' && by('expedition:start')[0].p.nested === undefined, 'expedition:* se registra solo (eventos futuros)');
  ok(by('threat:spawn')[0]?.p.kind === 'tormenta', 'threat:* se registra solo (eventos futuros)');
  ok(!by('coins:earned').length, 'los eventos que no están en TRACKED_EVENTS no se registran');

  await T(P, () => { window.__pixelia.ctx.ui.closeAllModals(); window.__pixelia.ctx.openPanel('settings'); window.__pixelia.ctx.openAlbum(); });
  await sleep(600);
  const panels = await T(P, () => window.__pixeliaTelemetry.queue.filter(e => e.n === 'panel_open').map(e => e.p.panel));
  ok(panels.includes('settings') && panels.includes('album'), 'aperturas de panel (Ajustes, Álbum)', panels);

  // script del mismo origen (lo que evalúa puppeteer cuenta como de otro origen y llega como "Script error.")
  await T(P, () => { const sc = document.createElement('script'); sc.textContent = "setTimeout(() => { throw new Error('boom '.repeat(80)); }, 0);"; document.head.append(sc); });
  await sleep(200);
  const err = await T(P, () => window.__pixeliaTelemetry.queue.find(e => e.n === 'error')?.p);
  ok(err && err.msg.startsWith('Error: boom') && err.msg.length <= 160 && typeof err.where === 'string', 'error no capturado: mensaje recortado y dónde pasó', err);

  const big = await T(P, () => { window.__pixeliaTelemetry.track('Prueba Rara!', { a: 'x'.repeat(500), f: () => 1, o: { deep: 1 } }); return window.__pixeliaTelemetry.queue.at(-1); });
  ok(big.n === 'prueba_rara_' && big.p.a.length <= 60 && big.p.f === undefined && big.p.o === undefined, 'track limpia el nombre y deja solo valores simples y cortos', big);

  const fl = await T(P, () => window.__pixeliaTelemetry.flush());
  const sunk = await T(P, () => JSON.parse(localStorage.getItem('pixelia.mock.events') || '[]'));
  ok(fl.sent > 10 && (await T(P, () => window.__pixeliaTelemetry.queue.length)) === 0, `flush manda la cola (${fl.sent} eventos) y la vacía`);
  ok(sunk.length === fl.sent && sunk.every(r => r.anon_id === ids.anon && UUID.test(r.session_id) && r.version && typeof r.props === 'object'), 'las filas tienen anon_id, session_id, name, props y version');
  ok(sunk.every(r => Object.keys(r).sort().join() === 'anon_id,at,name,props,session_id,version'), 'las filas no llevan nada más (ni email ni nombre)');
  ok(!JSON.stringify(sunk).includes('Pixelín') && !JSON.stringify(sunk).includes('@'), 'no viaja el nombre del personaje ni un email');

  // ---------------------------------------------------------------
  section('Interruptor de Ajustes');
  await T(P, () => window.__pixelia.ctx.ui.closeAllModals());
  await sleep(400);
  await T(P, () => { window.__pixelia.ctx.openPanel('settings'); });
  await P.waitForSelector('.a11y-stats');
  ok((await T(P, () => document.querySelector('.a11y-stats').getAttribute('aria-checked'))) === 'true', 'el interruptor arranca prendido');
  await T(P, () => window.__pixeliaTelemetry.track('antes_de_apagar'));
  await P.click('.a11y-stats');
  await sleep(300);
  ok((await T(P, () => window.__pixelia.store.state.settings.telemetry)) === false, 'tocarlo guarda settings.telemetry = false');
  ok((await T(P, () => window.__pixeliaTelemetry.queue.length)) === 0 && (await T(P, () => localStorage.getItem('pixelia.events.queue.v1'))) === null, 'apagarlo vacía la cola (memoria y localStorage)');
  await T(P, () => { window.__pixelia.bus.emit('level:up', { level: 5 }); window.__pixeliaTelemetry.track('x'); });
  ok((await T(P, () => window.__pixeliaTelemetry.queue.length)) === 0, 'apagado no se encola nada');
  const before = (await T(P, () => JSON.parse(localStorage.getItem('pixelia.mock.events') || '[]'))).length;
  await T(P, () => window.__pixeliaTelemetry.flush());
  ok((await T(P, () => JSON.parse(localStorage.getItem('pixelia.mock.events') || '[]'))).length === before, 'apagado no se manda nada');
  await P.click('.a11y-stats');
  await sleep(200);
  ok((await T(P, () => window.__pixelia.store.state.settings.telemetry)) === true && (await T(P, () => window.__pixeliaTelemetry.track('de_vuelta'))), 'al prenderlo vuelve a registrar');
  await P.close();

  // ---------------------------------------------------------------
  section('Servidor (interceptado): tandas, sin conexión y reintentos');
  let mode = 201;
  const L = await open('?scene=city&telemetry=live&reset', { live: true, status: () => mode });
  P = L.page;
  ok((await T(P, () => window.__pixeliaTelemetry.sink)) === 'supabase', '?telemetry=live en localhost → sink supabase');
  await T(P, () => window.__pixeliaTelemetry.flush());
  ok(L.posts.length === 1, 'flush hace un POST');
  const post = L.posts[0];
  ok(post && post.method === 'POST' && /\/rest\/v1\/events$/.test(post.url), 'POST a /rest/v1/events', post?.url);
  ok(post && post.headers.apikey?.startsWith('sb_publishable_') && !post.headers.authorization, 'usa solo la clave publishable (sin Authorization ni sesión)', post?.headers);
  ok(post && post.headers.prefer === 'return=minimal', 'Prefer: return=minimal (el rol no puede leer la tabla)');
  ok(post && Array.isArray(post.body) && post.body[0].name === 'session_start' && post.body.every(r => Object.keys(r).sort().join() === 'anon_id,name,props,session_id,version'), 'el cuerpo es una tanda de filas con solo las columnas permitidas', post?.body?.[0]);

  // sin conexión
  await P.setOfflineMode(true);
  await T(P, () => { for (let i = 0; i < 3; i++) window.__pixeliaTelemetry.track('offline_ev', { i }); });
  const off = await T(P, () => window.__pixeliaTelemetry.flush());
  ok(off.offline === true && L.posts.length === 1, 'sin conexión no se intenta mandar');
  const stored = await T(P, () => JSON.parse(localStorage.getItem('pixelia.events.queue.v1') || '[]').map(e => e.n));
  ok(stored.filter(n => n === 'offline_ev').length === 3, 'los eventos quedan guardados en localStorage');
  await P.setOfflineMode(false);
  await P.waitForFunction(() => window.__pixeliaTelemetry.queue.length === 0, { timeout: 5000 }).catch(() => {});
  ok(L.posts.length === 2 && L.posts[1].body.filter(r => r.name === 'offline_ev').length === 3, 'al volver la conexión se mandan solos');

  // la red falla (onLine sigue en true): quedan en la cola y sobreviven a una recarga
  mode = 'abort';
  await T(P, () => window.__pixeliaTelemetry.track('sin_red', { n: 1 }));
  const r1 = await T(P, () => window.__pixeliaTelemetry.flush());
  ok(r1.sent === 0 && r1.left >= 1, 'si el fetch falla, los eventos quedan en la cola');
  mode = 503;
  await T(P, () => window.__pixeliaTelemetry.flush());
  ok((await T(P, () => window.__pixeliaTelemetry.queue.some(e => e.n === 'sin_red'))), 'un 503 también se reintenta después');
  const anon1 = await T(P, () => window.__pixeliaTelemetry.anonId);
  mode = 201;
  const n0 = L.posts.length;
  await P.goto(BASE + '?scene=city&telemetry=live&nosplash&nosw', { waitUntil: 'load' });
  await P.waitForFunction(() => window.__pixeliaTelemetry, { timeout: 20000 });
  await sleep(300);
  ok((await T(P, () => window.__pixeliaTelemetry.anonId)) === anon1, 'el anon_id se mantiene entre aperturas');
  ok((await T(P, () => window.__pixeliaTelemetry.queue.some(e => e.n === 'sin_red'))), 'después de recargar, la cola pendiente sigue ahí');
  await T(P, () => window.__pixeliaTelemetry.flush());
  ok(L.posts.slice(n0).some(p => p.status === 201 && p.body.some(r => r.name === 'sin_red')), 'y se manda en la próxima tanda');

  // 4xx = el servidor rechaza la tanda: se descarta (no reintentar para siempre)
  mode = 400;
  await T(P, () => window.__pixeliaTelemetry.track('rechazado'));
  await T(P, () => window.__pixeliaTelemetry.flush());
  ok((await T(P, () => window.__pixeliaTelemetry.queue.length)) === 0, 'una tanda rechazada (400) se descarta');
  mode = 201;

  // tandas de 50 y tope de la cola
  await T(P, () => { for (let i = 0; i < 420; i++) window.__pixeliaTelemetry.track('muchos', { i }); });
  ok((await T(P, () => window.__pixeliaTelemetry.queue.length)) === 300, 'la cola guarda como mucho 300 eventos (los más nuevos)');
  const n1 = L.posts.length;
  await T(P, () => window.__pixeliaTelemetry.flush());
  const sizes = L.posts.slice(n1).map(p => p.body.length);
  ok(sizes.length === 6 && sizes.every(s => s <= 50), 'se manda en tandas de hasta 50', sizes);

  // segundo plano → session_end con duración y envío inmediato
  const n2 = L.posts.length;
  await T(P, () => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await sleep(500);
  const endRow = L.posts.slice(n2).flatMap(p => p.body).find(r => r.name === 'session_end');
  ok(endRow && typeof endRow.props.dur === 'number' && endRow.props.scene === 'city', 'al pasar a segundo plano se manda session_end con la duración', endRow);
  await P.close();

  // ---------------------------------------------------------------
  section('Config vacío');
  const E = await open('?scene=city&reset', { emptyConfig: true });
  ok((await T(E.page, () => window.__pixeliaTelemetry.sink)) === 'off', 'sin config.js → sink off');
  ok((await T(E.page, () => window.__pixeliaTelemetry.track('x'))) === false && (await T(E.page, () => window.__pixeliaTelemetry.queue.length)) === 0
    && (await T(E.page, () => localStorage.getItem('pixelia.events.queue.v1'))) === null, 'no se junta nada');
  await E.page.close();

  // ---------------------------------------------------------------
  section('Migración de ajustes');
  const M = await open('?scene=city&mock=1&mockuser=mig&reset');
  P = M.page;
  await T(P, () => {
    const { store } = window.__pixelia;
    store.state.settings = { music: false, sfx: true };   // save viejo, sin los ajustes nuevos
    store.save();
  });
  await P.goto(BASE + '?scene=city&mock=1&mockuser=mig&nosplash&nosw', { waitUntil: 'load' });
  await P.waitForFunction(() => window.__pixelia?.store?.state, { timeout: 20000 });
  const st = await T(P, () => window.__pixelia.store.state.settings);
  ok(st.music === false && st.telemetry === true && st.textSize === 'normal' && st.motion === 'auto', 'un save viejo recibe telemetry=true, textSize y motion sin perder lo suyo', st);
  await P.close();

  // ---------------------------------------------------------------
  section('Accesibilidad');
  const A = await open('?scene=city&mock=1&mockuser=a11y&reset');
  P = A.page;
  ok((await T(P, () => document.querySelector('meta[name=viewport]').content)) === 'width=device-width, initial-scale=1, viewport-fit=cover', 'el viewport permite el zoom con pellizco');
  const ta = await T(P, () => ({ body: getComputedStyle(document.body).touchAction, scene: getComputedStyle(document.getElementById('scene')).touchAction, canvas: getComputedStyle(document.querySelector('#scene canvas')).touchAction }));
  ok(ta.body === 'manipulation' && ta.scene === 'none' && ta.canvas === 'none', 'pellizco permitido en menús/HUD y bloqueado sobre la escena', ta);
  await T(P, () => { const { store, ctx } = window.__pixelia; store.state.settings.textSize = 'xlarge'; store.state.settings.motion = 'on'; ctx.ui.applyA11y(store.state.settings); ctx.ui.closeAllModals(); });
  await sleep(300);
  await T(P, () => { window.__pixelia.ctx.openPanel('settings'); });
  await P.waitForSelector('.a11y-seg');
  const a1 = await T(P, () => ({
    cls: document.documentElement.className, scale: getComputedStyle(document.documentElement).getPropertyValue('--text-scale').trim(),
    zoom: getComputedStyle(document.querySelector('.modal-body')).zoom, rm: window.__pixelia.ctx.ui.reducedMotion(),
    dur: getComputedStyle(document.querySelector('.modal-back')).transitionDuration,
    on: [...document.querySelectorAll('.a11y-opt.on')].map(b => b.dataset.v),
  }));
  ok(a1.cls.includes('text-xl') && a1.scale === '1.3' && Number(a1.zoom) === 1.3, 'Muy grande: clase text-xl y los menús se agrandan', a1);
  ok(a1.cls.includes('reduce-motion') && a1.rm === true && parseFloat(a1.dur) < 0.001, 'Reducir movimiento "Sí": clase reduce-motion, reducedMotion() y transiciones apagadas', a1);
  ok(a1.on.includes('xlarge') && a1.on.includes('on'), 'Ajustes marca las opciones elegidas');
  const confettiCount = await T(P, () => { window.__pixelia.ctx.ui.confetti(); return document.querySelectorAll('canvas.confetti').length; });
  ok(confettiCount === 0, 'sin confeti con reducir movimiento');
  await P.click('.a11y-opt[data-v=normal]');
  await P.click('.a11y-opt[data-v=off]');
  await sleep(200);
  const a2 = await T(P, () => ({ cls: document.documentElement.className, rm: window.__pixelia.ctx.ui.reducedMotion(), st: window.__pixelia.store.state.settings }));
  ok(!a2.cls.includes('text-xl') && a2.cls.includes('motion-full') && !a2.cls.includes('reduce-motion') && a2.rm === false && a2.st.textSize === 'normal' && a2.st.motion === 'off', 'tocar Normal / No lo cambia al toque y lo guarda', a2);
  const confetti2 = await T(P, () => { window.__pixelia.ctx.ui.confetti(); return document.querySelectorAll('canvas.confetti').length; });
  ok(confetti2 === 1, 'con movimiento, el confeti vuelve');
  await P.close();

  // ---------------------------------------------------------------
  section('Invitación a instalar');
  const I = await open('?scene=city&mock=1&mockuser=inst&reset&cheat=3', { ua: IPHONE_UA });
  P = I.page;
  await T(P, () => localStorage.removeItem('pixelia.install.v1'));
  ok((await T(P, () => window.__pixeliaInstall.eligible())) === true, 'nivel 3 en Safari de iPhone → corresponde mostrarla');
  await T(P, () => { window.__pixelia.ctx.ui.closeAllModals(); window.__pixeliaInstall.show(); });
  await P.waitForSelector('.inst-card.show', { timeout: 3000 }).catch(() => {});
  const card = await T(P, () => ({ steps: document.querySelectorAll('.inst-card .inst-steps li').length, modal: !!document.querySelector('#modal-root .inst-card'), ev: window.__pixeliaTelemetry.queue.find(e => e.n === 'install_prompt_shown')?.p }));
  ok(card.steps === 2 && !card.modal, 'iPhone: tarjeta con los pasos (no es un modal)', card);
  ok(card.ev?.platform === 'ios', 'install_prompt_shown en la telemetría', card.ev);
  await T(P, () => document.querySelector('.inst-x').click());   // (el premio diario puede estar encima)
  await sleep(300);
  const dis = await T(P, () => ({ card: !!document.querySelector('.inst-card'), st: window.__pixeliaInstall.state, ev: window.__pixeliaTelemetry.queue.find(e => e.n === 'install_prompt_dismissed')?.p, el: window.__pixeliaInstall.eligible() }));
  ok(!dis.card && dis.st.dismissed === 1 && dis.ev?.via === 'card', 'se puede cerrar (install_prompt_dismissed)', dis);
  ok(dis.el === false, 'no vuelve en la misma apertura');
  // una semana después vuelve una vez más, y nunca una tercera
  await T(P, () => { const s = JSON.parse(localStorage.getItem('pixelia.install.v1')); s.lastShown -= 8 * 864e5; localStorage.setItem('pixelia.install.v1', JSON.stringify(s)); });
  await P.goto(BASE + '?scene=city&mock=1&mockuser=inst&nosplash&nosw', { waitUntil: 'load' });
  await P.waitForFunction(() => window.__pixeliaInstall, { timeout: 20000 });
  ok((await T(P, () => window.__pixeliaInstall.eligible())) === true, 'una semana después puede volver');
  await T(P, () => { window.__pixelia.ctx.ui.closeAllModals(); window.__pixeliaInstall.show(); });
  await T(P, () => { const s = JSON.parse(localStorage.getItem('pixelia.install.v1')); s.lastShown -= 30 * 864e5; localStorage.setItem('pixelia.install.v1', JSON.stringify(s)); });
  await P.goto(BASE + '?scene=city&mock=1&mockuser=inst&nosplash&nosw', { waitUntil: 'load' });
  await P.waitForFunction(() => window.__pixeliaInstall, { timeout: 20000 });
  ok((await T(P, () => window.__pixeliaInstall.eligible())) === false, 'después de dos veces no vuelve más');
  await P.close();

  // PC con beforeinstallprompt: botón Instalar
  const D = await open('?scene=city&mock=1&mockuser=pc&reset&cheat=3');
  P = D.page;
  await T(P, () => localStorage.removeItem('pixelia.install.v1'));
  ok((await T(P, () => window.__pixeliaInstall.eligible())) === false, 'PC sin aviso del navegador → no se muestra');
  await T(P, () => { window.__pixeliaInstallPrompt = { prompt: () => Promise.resolve(), userChoice: Promise.resolve({ outcome: 'accepted' }) }; });
  ok((await T(P, () => window.__pixeliaInstall.eligible())) === true, 'con beforeinstallprompt sí');
  await T(P, () => { window.__pixelia.ctx.ui.closeAllModals(); window.__pixeliaInstall.show(); });
  await P.waitForSelector('.inst-card .btn');
  await T(P, () => document.querySelector('.inst-card .btn').click());
  await sleep(400);
  const acc = await T(P, () => ({ st: window.__pixeliaInstall.state, ev: window.__pixeliaTelemetry.queue.find(e => e.n === 'install_prompt_accepted')?.p, el: window.__pixeliaInstall.eligible(), card: !!document.querySelector('.inst-card') }));
  ok(acc.st.accepted && acc.ev?.via === 'prompt' && !acc.card && acc.el === false, 'Instalar → install_prompt_accepted y no vuelve', acc);
  // modo standalone: nunca
  await T(P, () => { localStorage.removeItem('pixelia.install.v1'); });
  await P.evaluateOnNewDocument(() => { const mm = window.matchMedia.bind(window); window.matchMedia = q => (q.includes('standalone') ? { matches: true, media: q, addEventListener() {}, removeEventListener() {} } : mm(q)); });
  await P.goto(BASE + '?scene=city&mock=1&mockuser=pc&nosplash&nosw', { waitUntil: 'load' });
  await P.waitForFunction(() => window.__pixeliaInstall, { timeout: 20000 });
  await T(P, () => { window.__pixeliaInstallPrompt = { prompt: () => Promise.resolve(), userChoice: Promise.resolve({ outcome: 'accepted' }) }; });
  ok((await T(P, () => window.__pixeliaInstall.eligible())) === false, 'abierta como app instalada (standalone) → nunca');
  await P.close();
} catch (e) {
  fail++;
  console.log('  ✘ excepción', e.stack || e.message);
}

await browser.close();
server.close();
console.log(`\n${fail ? '✘' : '✔'} ${pass} OK, ${fail} fallas`);
process.exit(fail ? 1 : 0);
