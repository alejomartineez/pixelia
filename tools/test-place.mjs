// Colocar y mover edificios con gestos reales, en iPhone (toque) y PC (mouse):
//   arrastrar el fantasma a un lugar y colocar con el ✓ que está junto al edificio · arrastrar fuera del fantasma mueve
//   la cámara (no el edificio) · girar (botón y R) · lugar ocupado: casillas rojas, motivo en texto y ✓ apagado ·
//   cancelar (✕ y Esc) sin gastar · toque largo sobre un edificio para levantarlo y soltarlo en otro lugar · Deshacer
//   (botón y Ctrl+Z) · Mover desde la ficha · caminos seguidos arrastrando · paneo automático en el borde · flechas.
//
//   node tools/test-place.mjs [--device iphone|desktop|both] [--out carpeta] [--no-shots]
import http from 'node:http';
import { readFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { join, extname, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : d; };
const OUT = resolve(opt('out', join(tmpdir(), 'pixelia-place')));
const SHOTS = !opt('no-shots', false);
const DEVICES = opt('device', 'both') === 'both' ? ['iphone', 'desktop'] : [opt('device')];
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
const VIEWS = {
  iphone: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  desktop: { width: 1366, height: 800, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
};
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });

let okN = 0, failN = 0;
const ok = (cond, msg, extra) => { if (cond) { okN++; console.log('  ✔ ' + msg); } else { failN++; console.log('  ✘ ' + msg + (extra !== undefined ? ' → ' + JSON.stringify(extra) : '')); } return !!cond; };
const section = (t) => console.log('\n■ ' + t);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const LIFT = 62; // city-place.js: con el dedo el fantasma queda esta distancia por encima

for (const DEVICE of DEVICES) {
  const VIEW = VIEWS[DEVICE];
  const touch = VIEW.hasTouch;
  const page = await browser.newPage();
  await page.setViewport(VIEW);
  if (touch) await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1');
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + (e.stack || e.message)));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE.ERROR: ' + m.text()); });

  let shotN = 0;
  const shot = async (name) => { if (!SHOTS) return; const f = join(OUT, `${String(++shotN).padStart(2, '0')}-${DEVICE}-${name}.png`); await page.screenshot({ path: f }); console.log('    📷 ' + f); };
  const ev = (fn, ...a) => page.evaluate(fn, ...a);
  async function waitFor(fn, ms = 4000, ...a) {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) { try { if (await page.evaluate(fn, ...a)) return true; } catch {} await sleep(80); }
    return false;
  }
  // ---- gestos ----
  async function tapXY(x, y) { if (touch) await page.touchscreen.tap(x, y); else await page.mouse.click(x, y); }
  /** Toca un elemento cuando dejó de moverse (los botones junto al edificio lo siguen cuadro a cuadro). */
  async function tapSel(sel) {
    // quieto en tres lecturas seguidas: con la máquina cargada la ciudad va a pocos cuadros por segundo
    let p = null, still = 0;
    for (let k = 0; k < 40 && still < 3; k++) {
      const q = await ev((sel) => { const e = document.querySelector(sel); if (!e) return null; const b = e.getBoundingClientRect(); return b.width ? { x: b.left + b.width / 2, y: b.top + b.height / 2 } : null; }, sel);
      still = q && p && Math.abs(q.x - p.x) < 0.5 && Math.abs(q.y - p.y) < 0.5 ? still + 1 : 0;
      p = q;
      await sleep(110);
    }
    if (!p) return false;
    await tapXY(p.x, p.y);
    await sleep(160);
    return true;
  }
  async function press(x, y) { if (touch) await page.touchscreen.touchStart(x, y); else { await page.mouse.move(x, y); await page.mouse.down(); } }
  async function moveTo(x, y) { if (touch) await page.touchscreen.touchMove(x, y); else await page.mouse.move(x, y); }
  async function release() { if (touch) await page.touchscreen.touchEnd(); else await page.mouse.up(); }
  async function drag(x1, y1, x2, y2, { steps = 14, hold = 0, end = 0 } = {}) {
    await press(x1, y1);
    if (hold) await sleep(hold);
    for (let i = 1; i <= steps; i++) { await moveTo(x1 + (x2 - x1) * i / steps, y1 + (y2 - y1) * i / steps); await sleep(18); }
    if (end) await sleep(end);
    await release();
    await sleep(200);
  }
  // ---- mundo ----
  const city = () => ev(() => { const c = window.__pixelia.city; const p = c.placing; return p ? { id: p.id, mode: p.mode, x: p.x, z: p.z, rot: p.rot, valid: p.valid, why: p.why, paint: p.paint, count: p.count } : null; });
  /** Centro en pantalla de la casilla (x,z) a nivel del piso. */
  const tileXY = (x, z) => ev(async (x, z) => {
    const { HALF } = await import('/src/scenes/city-common.js');
    const c = window.__pixelia.city; const V = c.cam.target.constructor;
    const s = c.r.toScreen(new V(x + 0.5 - HALF, 0, z + 0.5 - HALF));
    return { x: s.x, y: s.y };
  }, x, z);
  /** Centro en pantalla de la base del fantasma o de un edificio. */
  const footXY = (id, x, z, rot, y = 0) => ev(async (id, x, z, rot, y) => {
    const { footCenter } = await import('/src/scenes/city-common.js');
    const c = window.__pixelia.city; const V = c.cam.target.constructor;
    const f = footCenter(id, x, z, rot);
    const s = c.r.toScreen(new V(f.x, y, f.z));
    return { x: s.x, y: s.y };
  }, id, x, z, rot, y);
  /** Un punto sobre el cuerpo de un edificio puesto (no la base: ahí puede haber un cartel de terreno al lado). */
  const bodyXY = (id, x, z, rot) => footXY(id, x, z, rot, 0.7);
  /** Busca un lugar libre para `id` cerca de la casilla (x0,z0) que quede bien a la vista (lejos de los bordes). */
  const freeNear = (id, x0, z0, ignoreUid = null) => ev(async (id, x0, z0, ign) => {
    const { footCenter } = await import('/src/scenes/city-common.js');
    const c = window.__pixelia.city; const V = c.cam.target.constructor;
    const E = window.__pixelia.economy; const L = E.landBounds();
    for (let r = 0; r < 14; r++) for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
      if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
      const x = x0 + dx, z = z0 + dz;
      if (x < L.min || z < L.min || !E.canPlace(id, x, z, 0, ign).ok) continue;
      const f = footCenter(id, x, z, 0); const s = c.r.toScreen(new V(f.x, 0, f.z));
      if (s.x > 90 && s.x < innerWidth - 90 && s.y > 180 && s.y < innerHeight - 260) return { x, z };
    }
    return null;
  }, id, x0, z0, ignoreUid);
  /** Centra la vista en un edificio (sin animación), para que los gestos caigan lejos de los bordes. */
  const centerOn = (id, x, z, rot = 0) => closeModals().then(() => ev(async (id, x, z, rot) => {
    const { footCenter } = await import('/src/scenes/city-common.js');
    const c = window.__pixelia.city; const f = footCenter(id, x, z, rot);
    c.cam.stop(); c.cam.st.x = f.x; c.cam.st.z = f.z; c.cam.apply();
  }, id, x, z, rot)).then(() => sleep(250));
  const coins = () => ev(() => window.__pixelia.store.state.coins);
  const count = (id) => ev((id) => window.__pixelia.economy.countOf(id), id);
  /** Cierra lo que haya abierto (subidas de nivel, premios): espera un poco por si aparece alguno más. */
  async function closeModals() {
    let quiet = 0;
    for (let i = 0; i < 16 && quiet < 2; i++) {
      const any = await ev(() => {
        const m = [...document.querySelectorAll('.modal')].at(-1);
        if (!m) return false;
        const b = m.querySelector('.modal-x') || [...m.querySelectorAll('.btn')].at(-1);
        b?.click();
        return true;
      });
      quiet = any ? 0 : quiet + 1;
      await sleep(any ? 500 : 450);
    }
  }

  section(`${DEVICE}: arranque`);
  await page.goto(BASE + '?cheat=15&scene=city&nosplash&nosw', { waitUntil: 'load' });
  // la tarjeta de "instalar" puede salir sola a los segundos: acá molesta (tapa los botones)
  await page.addStyleTag({ content: '.inst-card { display: none !important; }' });
  ok(await waitFor(() => !!window.__pixelia?.city?.placer, 15000), 'ciudad lista con el módulo de colocación');
  await sleep(1500);
  await closeModals();
  // sin subidas de nivel en el medio (cada casa suma experiencia y la ventana taparía los gestos)
  await ev(() => { window.__pixelia.store.addXp = () => {}; });
  // vista fija para que las cuentas de pantalla no dependan del guardado
  await ev(() => { const c = window.__pixelia.city; c.cam.st.x = 0.5; c.cam.st.z = 1.5; c.cam.st.u = 13; c.cam.apply(); });
  await sleep(300);

  section(`${DEVICE}: colocar arrastrando`);
  const coins0 = await coins();
  const n0 = await count('casita');
  await ev(() => window.__pixelia.city.S.startPlacement('casita'));
  ok(await waitFor(() => !!document.querySelector('.cx-pc .cx-pc-ok') && !!document.querySelector('.cx-placebar')), 'aparecen la barra y los botones junto al edificio');
  let g = await city();
  ok(g && g.mode === 'new' && g.valid, 'el fantasma arranca en un lugar libre', g);
  await shot('fantasma');
  // arrastrar fuera del fantasma: se mueve la cámara, no el edificio
  const cam0 = await ev(() => ({ ...window.__pixelia.city.cam.st }));
  const gs = await footXY(g.id, g.x, g.z, g.rot);
  const emptyY = gs.y > VIEW.height / 2 ? 140 : VIEW.height - 260;
  await drag(VIEW.width * 0.2, emptyY, VIEW.width * 0.2 + 60, emptyY + 30);
  const cam1 = await ev(() => ({ ...window.__pixelia.city.cam.st }));
  let g1 = await city();
  ok(Math.hypot(cam1.x - cam0.x, cam1.z - cam0.z) > 0.3 && g1.x === g.x && g1.z === g.z, 'arrastrar fuera del fantasma mueve la vista y deja el edificio', { cam0, cam1, g, g1 });
  // arrastrar el fantasma a otro lugar libre
  const target = await freeNear('casita', g.x + 4, g.z + 1);
  const from = await footXY('casita', g1.x, g1.z, g1.rot);
  const to = await footXY('casita', target.x, target.z, 0);
  await drag(from.x, from.y, to.x, to.y + (touch ? LIFT : 0), { steps: 18, end: 150 });
  g = await city();
  ok(g && g.x === target.x && g.z === target.z, `el edificio sigue al ${touch ? 'dedo (queda por encima, no tapado)' : 'mouse'}`, { g, target });
  ok(await ev(() => !document.querySelector('.cx-pc.drag')), 'los botones vuelven a aparecer al soltar');
  await shot('arrastrado');
  // girar con el botón (y con R en PC)
  await tapSel('.cx-pc-rot');
  g = await city();
  ok(g.rot === 1, 'el botón Rotar lo rota', g);
  if (!touch) { await page.keyboard.press('KeyR'); g = await city(); ok(g.rot === 2, 'R lo rota otra vez', g); }
  // colocar con el ✓ (o Enter en PC)
  if (touch) await tapSel('.cx-pc-ok'); else { await page.keyboard.press('Enter'); await sleep(200); }
  ok(await waitFor((n) => window.__pixelia.economy.countOf('casita') === n + 1, 3000, n0), `colocado con ${touch ? 'el ✓ junto al edificio' : 'Enter'}`);
  const placedB = await ev((x, z) => { const b = window.__pixelia.economy.buildingAt(x, z); return b && { uid: b.uid, id: b.id, x: b.x, z: b.z, rot: b.rot }; }, target.x, target.z);
  ok(placedB && placedB.id === 'casita' && placedB.x === target.x && placedB.z === target.z, 'quedó en la casilla elegida', placedB);
  ok(await city() === null && await ev(() => !document.querySelector('.cx-placebar')), 'se cierra la colocación');
  ok(await coins() < coins0, 'cobró la casa');

  section(`${DEVICE}: lugar ocupado y cancelar`);
  const coins1 = await coins();
  await centerOn('casita', placedB.x, placedB.z, placedB.rot);
  await ev(() => window.__pixelia.city.S.startPlacement('casita'));
  await waitFor(() => !!document.querySelector('.cx-pc-ok'));
  // arrastrarlo encima de la casa recién puesta: no entra
  const occ = await footXY('casita', placedB.x, placedB.z, placedB.rot);
  g = await city();
  const gs2 = await footXY('casita', g.x, g.z, g.rot);
  await drag(gs2.x, gs2.y, occ.x, occ.y + (touch ? LIFT : 0), { steps: 14, end: 120 });
  g = await city();
  const ui1 = await ev(() => ({ why: document.querySelector('.cx-pc-why')?.textContent, hint: document.querySelector('.cx-pb-hint')?.textContent, dis: document.querySelector('.cx-pc-ok')?.disabled,
    red: window.__pixelia.city.placing.tiles.filter(t => t.material.color.getHex() === 0xff6f6f).length }));
  ok(g && !g.valid && /Ahí está Casa/.test(ui1.why) && ui1.dis, 'en un lugar ocupado: motivo con el nombre, ✓ apagado', { g, ui1 });
  ok(ui1.red >= 1, 'casillas ocupadas en rojo', ui1);
  await shot('ocupado');
  if (touch) await tapSel('.cx-pc-x'); else { await page.keyboard.press('Escape'); await sleep(200); }
  ok(await city() === null && await coins() === coins1 && await count('casita') === n0 + 1, `${touch ? '✕' : 'Esc'} cancela sin gastar`);

  section(`${DEVICE}: levantar un edificio con toque largo`);
  await centerOn('casita', placedB.x, placedB.z, placedB.rot);
  const mv = await freeNear('casita', placedB.x - 3, placedB.z + 3, placedB.uid);
  const a = await bodyXY('casita', placedB.x, placedB.z, placedB.rot);
  const f0 = await footXY('casita', placedB.x, placedB.z, placedB.rot), f1 = await footXY('casita', mv.x, mv.z, placedB.rot);
  const b2 = { x: a.x + f1.x - f0.x, y: a.y + f1.y - f0.y };
  await press(a.x, a.y);
  await sleep(650);
  const lifted = await city();
  ok(lifted && lifted.mode === 'move', 'el toque largo lo levanta', lifted);
  for (let i = 1; i <= 16; i++) { await moveTo(a.x + (b2.x - a.x) * i / 16, a.y + (b2.y + (touch ? LIFT : 0) - a.y) * i / 16); await sleep(18); }
  await sleep(150);
  await release();
  await sleep(300);
  let nb = await ev((uid) => { const b = window.__pixelia.store.state.city.buildings.find(o => o.uid === uid); return b && { x: b.x, z: b.z }; }, placedB.uid);
  ok(await city() === null && nb.x === mv.x && nb.z === mv.z, 'al soltar en un lugar libre queda ahí', { nb, mv });
  ok(await waitFor(() => !!document.querySelector('.cx-undo')), 'aparece Deshacer junto al edificio');
  await shot('movido');
  if (touch) await tapSel('.cx-undo'); else { await page.keyboard.down('Control'); await page.keyboard.press('KeyZ'); await page.keyboard.up('Control'); await sleep(200); }
  nb = await ev((uid) => { const b = window.__pixelia.store.state.city.buildings.find(o => o.uid === uid); return b && { x: b.x, z: b.z }; }, placedB.uid);
  ok(nb.x === placedB.x && nb.z === placedB.z && await ev(() => !document.querySelector('.cx-undo')), `${touch ? 'Deshacer' : 'Ctrl+Z'} lo devuelve a donde estaba`, nb);

  section(`${DEVICE}: Mover desde la ficha`);
  await centerOn('casita', placedB.x, placedB.z, placedB.rot);
  // si tiene monedas listas, el primer toque cobra; el siguiente abre la ficha
  const a2 = await bodyXY('casita', placedB.x, placedB.z, placedB.rot);
  for (let k = 0; k < 3; k++) {
    await tapXY(a2.x, a2.y);
    if (await waitFor(() => !!document.querySelector('.modal'), 2500)) break;
  }
  await sleep(400);
  await shot('ficha');
  ok(await waitFor(() => [...document.querySelectorAll('.modal .btn')].some(b => /Mover/.test(b.textContent)), 8000), 'tocar el edificio abre la ficha con Mover');
  await ev(() => [...document.querySelectorAll('.modal .btn')].find(b => /Mover/.test(b.textContent))?.click());
  await waitFor(() => !document.querySelector('.modal'), 5000);
  await sleep(300);
  g = await city();
  ok(g && g.mode === 'move' && g.x === placedB.x, 'Mover lo levanta en su lugar', g);
  ok(await ev(() => /Mover: Casa/.test(document.querySelector('.cx-placebar')?.textContent || '')), 'la barra dice qué se mueve');
  const mv2 = await freeNear('casita', placedB.x + 2, placedB.z - 3, placedB.uid);
  const c1 = await footXY('casita', g.x, g.z, g.rot), c2 = await footXY('casita', mv2.x, mv2.z, g.rot);
  await drag(c1.x, c1.y, c2.x, c2.y + (touch ? LIFT : 0), { steps: 16, end: 150 });
  g = await city();
  ok(g && g.mode === 'move' && g.x === mv2.x && g.z === mv2.z, 'arrastrado sin soltarlo del todo (espera el ✓)', { g, mv2 });
  await tapSel('.cx-pc-ok');
  nb = await ev((uid) => { const b = window.__pixelia.store.state.city.buildings.find(o => o.uid === uid); return b && { x: b.x, z: b.z }; }, placedB.uid);
  ok(await city() === null && nb.x === mv2.x && nb.z === mv2.z, 'con el ✓ queda en el lugar nuevo', nb);

  section(`${DEVICE}: caminos seguidos`);
  await closeModals();
  const nc0 = await count('camino');
  await ev(() => window.__pixelia.city.S.startPlacement('camino'));
  await waitFor(() => !!document.querySelector('.cx-pc-ok'));
  // un lugar con 5 casillas libres en fila
  const row = await ev(() => {
    // la fila libre más cerca del centro del terreno (en una punta la cámara choca con su límite)
    const E = window.__pixelia.economy; const L = E.landBounds(); const m = (L.min + L.max) / 2;
    let best = null, bd = Infinity;
    for (let z = L.min + 1; z < L.max - 1; z++) for (let x = L.min + 1; x < L.max - 6; x++) {
      let free = true; for (let k = 0; k < 5; k++) if (!E.canPlace('camino', x + k, z, 0).ok) { free = false; break; }
      const d = Math.hypot(x + 2 - m, z - m);
      if (free && d < bd) { bd = d; best = { x, z }; }
    }
    return best;
  });
  await ev((x, z) => window.__pixelia.city.placer.moveTo(x, z), row.x, row.z);
  await centerOn('camino', row.x + 2, row.z, 0);
  await tapSel('.cx-pc-ok');
  g = await city();
  ok(g && g.paint && g.count === 1, 'el primero queda y sigue en modo caminos', g);
  ok(await ev(() => document.querySelector('.cx-pb-done')?.offsetParent != null), 'aparece Listo en la barra');
  // seguir la fila arrastrando desde la pieza (aunque el gesto vaya rápido no se saltea casillas)
  await ev((x, z) => window.__pixelia.city.placer.moveTo(x, z), row.x + 1, row.z);
  const p1 = await tileXY(row.x + 1, row.z), p4 = await tileXY(row.x + 4, row.z);
  await drag(p1.x, p1.y, p4.x, p4.y, { steps: 3, end: 100 });
  const laid = await ev((x, z) => { const E = window.__pixelia.economy; let n = 0; for (let k = 0; k < 5; k++) { const b = E.buildingAt(x + k, z); if (b && b.id === 'camino') n++; } return n; }, row.x, row.z);
  ok(laid === 5, 'arrastrando quedan los cinco en fila, sin huecos', { laid, row });
  await shot('caminos');
  await tapSel('.cx-pb-done');
  ok(await city() === null && await count('camino') === nc0 + 5, 'Listo termina');

  section(`${DEVICE}: paneo en el borde y teclado`);
  await closeModals();
  await ev(() => { const c = window.__pixelia.city; c.cam.stop(); c.cam.st.x = 0.5; c.cam.st.z = 0.5; c.cam.apply(); });
  await sleep(250);
  await ev(() => window.__pixelia.city.S.startPlacement('casita'));
  await waitFor(() => !!document.querySelector('.cx-pc-ok'));
  g = await city();
  const st0 = await ev(() => ({ ...window.__pixelia.city.cam.st }));
  const gp = await footXY('casita', g.x, g.z, g.rot);
  await press(gp.x, gp.y);
  for (let i = 1; i <= 10; i++) { await moveTo(gp.x + (VIEW.width - 12 - gp.x) * i / 10, gp.y + (touch ? LIFT : 0)); await sleep(20); }
  await sleep(1500);
  await release();
  await sleep(200);
  const st1 = await ev(() => ({ ...window.__pixelia.city.cam.st }));
  const g2 = await city();
  ok(Math.hypot(st1.x - st0.x, st1.z - st0.z) > 0.4, 'contra el borde la cámara acompaña', { st0, st1 });
  ok(g2 && (g2.x !== g.x || g2.z !== g.z), 'y el edificio sigue al puntero', { g, g2 });
  if (!touch) {
    const k0 = await city();
    await page.keyboard.press('ArrowUp');
    const k1 = await city();
    ok(Math.abs(k1.x - k0.x) + Math.abs(k1.z - k0.z) <= 1, 'las flechas corren el fantasma de a una casilla', { k0, k1 });
    // clic sobre el fantasma = colocar (si entra)
    if (k1.valid) {
      const gc = await footXY('casita', k1.x, k1.z, k1.rot);
      const nn = await count('casita');
      await page.mouse.click(gc.x, gc.y - 8);
      ok(await waitFor((n) => window.__pixelia.economy.countOf('casita') === n + 1, 2000, nn), 'clic sobre el fantasma lo coloca');
    }
  }
  await ev(() => window.__pixelia.city.placer.end(true));
  await sleep(200);

  section(`${DEVICE}: gancho para otras capas`);
  const hook = await ev(() => {
    const c = window.__pixelia.city; const seen = [];
    const off = c.placer.onGhostMove(i => seen.push(i && { x: i.x, z: i.z, w: i.w, valid: i.valid }));
    c.S.startPlacement('camino');
    const L = c.placer.tileLayer('prueba');
    L.set([{ x: c.placing.x, z: c.placing.z, tone: 'cover' }, { x: c.placing.x + 1, z: c.placing.z, tone: 'cover' }]);
    c.placer.moveTo(c.placing.x + 1, c.placing.z);
    c.placer.end(true);
    off();
    return { n: seen.length, last: seen.at(-1), first: seen[0] };
  });
  ok(hook.n >= 3 && hook.first && hook.first.w === 1 && hook.last === null, 'onGhostMove avisa cada cambio y null al terminar', hook);

  ok(!errors.length, 'sin errores de página', errors.slice(0, 5));
  await page.close();
}

await browser.close();
server.close();
console.log(`\n${okN} ok, ${failN} fallas`);
process.exit(failN ? 1 : 0);
