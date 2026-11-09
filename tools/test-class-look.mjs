// Pruebas de la clase de quien lidera y del aspecto de cada clase (El Quiebre, paso 5b tercera parte; DESIGN-COMBAT.md
// §16). Todo en Chrome headless (SwiftShader), porque los modelos usan three.js:
//   - classLook y avatarModel(look, { cls }) para los 5 pueblos × 6 clases; opts.clsGear cambia solo lo que va en la mano;
//   - el aviso de una partida vieja sin clase; elegir y cambiar la clase desde la pestaña Progreso y desde el panel de
//     Expedición;
//   - el aspecto en la ciudad (el arma de la clase), en el combate (el kit del líder y de cada integrante) y en la
//     expedición;
//   - el paso de la clase en el onboarding.
//   node test-class-look.mjs [--shots]   (las capturas van a shots/clase-*.png)
import http from 'node:http';
import { readFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';
import puppeteer from 'puppeteer-core';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = process.argv.includes('--shots');
let pass = 0, fail = 0;
const ok = (c, msg, extra) => { if (c) { pass++; console.log('  ok  ', msg); } else { fail++; console.log('  MAL ', msg, extra !== undefined ? JSON.stringify(extra) : ''); } };
const section = (t) => console.log('\n' + t);

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
// los avisos duran 2 s: se anotan todos desde que carga la página
await page.evaluateOnNewDocument(() => {
  window.__toasts = [];
  addEventListener('DOMContentLoaded', () => new MutationObserver(() => { for (const t of document.querySelectorAll('.toast')) if (!window.__toasts.includes(t.textContent)) window.__toasts.push(t.textContent); }).observe(document.body, { childList: true, subtree: true }));
});
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function waitFor(src, ms = 20000) { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (await page.evaluate(src)) return true; } catch {} await sleep(200); } return false; }
const run = (src) => page.evaluate(new Function(`return (async () => { const P = window.__pixelia; const S = P.store.state; const K = await import('./src/core/classes.js'); const A = await import('./src/avatar/avatar.js'); ${src} })()`));
const shot = async (name) => { if (!SHOTS) return; mkdirSync(join(ROOT, 'shots'), { recursive: true }); await page.screenshot({ path: join(ROOT, 'shots', `clase-${name}.png`) }); console.log(`  captura shots/clase-${name}.png`); };
const clearCards = async () => { for (let k = 0; k < 10 && await page.evaluate(() => !!document.querySelector('.st-card:not(.bark), .st-epic')); k++) { await page.evaluate(() => document.querySelector('.st-card .st-next, .st-epic button')?.click()); await sleep(500); } };

try {
  await page.goto(BASE + '?nosw&reset', { waitUntil: 'load' });
  await waitFor(`!!window.__pixelia?.store?.state`);
  // una partida vieja: ya empezada, sin la clase de quien lidera (como la que deja la migración de los roles)
  await page.evaluate(() => {
    const st = window.__pixelia.store;
    const raw = JSON.parse(JSON.stringify(st.state));
    delete raw.story; delete raw.introSeen; delete raw.classes; raw.onboarded = true;
    raw.avatar = { ...raw.avatar, type: 'enano', dress: 'jubon', acc: 'libro', crown: 'gorro' };
    st.save = () => {};
    localStorage.setItem('pixelia.save.v1', JSON.stringify(raw));
  });
  await page.goto(BASE + '?nosw&nosplash', { waitUntil: 'load' });
  ok(await waitFor(`window.__pixelia?.ctx.router.current === 'city' && !!window.__pixelia.city?.life?.player`, 25000), 'el juego carga en la ciudad');
  await sleep(1500);
  await clearCards();

  section('Modelos');
  let r = await run(`const out = [];
    for (const type of A.PLAYABLE_PEOPLES) for (const cls of Object.keys(A.CLASS_KIT)) {
      const m = A.avatarModel({ type }, { cls }), l = m.userData.look, k = A.CLASS_KIT[cls];
      const okKit = l.dress === k.dress && l.acc === k.acc && (!k.crown || l.crown === k.crown);
      let meshes = 0; m.traverse(o => { if (o.isMesh) meshes++; });
      out.push({ type, cls, okKit, meshes, look: [l.dress, l.acc, l.crown].join('/') });
    }
    return out;`);
  ok(r.length === 30 && r.every(x => x.okKit && x.meshes > 3), '5 pueblos × 6 clases: cada uno con su ropa, su arma y su casco', r.filter(x => !x.okKit || x.meshes <= 3));
  r = await run(`const base = A.normalizeLook({ type: 'humano', dress: 'abrigo', crown: 'gorro', acc: 'libro' });
    const g = A.avatarModel(base, { clsGear: 'forjador' }).userData.look, n = A.avatarModel(base, { npc: true, cls: 'monje' }).userData.look;
    return { g: [g.dress, g.crown, g.acc], n: [n.dress, n.acc, n.crown] };`);
  ok(r.g.join() === 'abrigo,gorro,martillo', 'clsGear: solo cambia lo que lleva en la mano (la ropa es la del Equipaje)', r.g);
  ok(r.n.join() === 'habito,baston,ninguna', 'la versión liviana (el grupo) también se viste de su clase', r.n);

  section('Partida vieja sin clase');
  // el aviso espera a que la ciudad quede libre: se cierra lo que haya abierto (el premio del día)
  for (let k = 0; k < 4 && await page.evaluate(() => window.__pixelia.ctx.ui.hasModal()); k++) { await page.evaluate(() => window.__pixelia.ctx.ui.closeAllModals()); await sleep(800); await clearCards(); }
  ok(await waitFor(`window.__toasts.some(t => /clase de quien lidera/.test(t))`, 15000), 'un aviso dice dónde se elige la clase', await page.evaluate(() => ({ t: window.__toasts, modal: document.querySelector('.modal')?.textContent?.slice(0, 80), card: document.querySelector('.st-card:not(.bark), .st-epic')?.textContent?.slice(0, 80), ov: !!document.querySelector('.chx-open, .alb-open, .cx-placebar, .th-bar'), route: window.__pixelia.ctx.router.current })));
  r = await run(`const l = P.city.life.player.obj.userData.look; return { acc: l.acc, dress: l.dress, cls: K.classesState(S).leader.cls };`);
  ok(r.cls === null && r.acc === 'libro' && r.dress === 'jubon', 'sin clase, en la ciudad va con lo suyo', r);

  section('Elegir la clase desde la Bitácora');
  await run(`P.ctx.openPanel('story', { tab: 'progreso' }); return true;`);
  ok(await waitFor(`!!document.querySelector('.pnl-story [data-pick-class]')`, 8000), 'la fila de quien lidera tiene "Elegir clase"');
  r = await page.evaluate(() => document.querySelector('.pnl-story [data-pick-class]')?.textContent || '');
  ok(/Elegir clase/.test(r), 'dice "Elegir clase" mientras no tiene', r);
  await page.evaluate(() => document.querySelector('.pnl-story [data-pick-class]').click());
  ok(await waitFor(`document.querySelectorAll('.cls-modal .cls-card').length === 6`, 5000), 'el selector muestra las 6 clases');
  ok(await waitFor(`document.querySelectorAll('.cls-modal .cls-card img.th.ok').length === 6`, 15000), 'cada tarjeta con el personaje vestido de esa clase');
  await page.evaluate(() => document.querySelector('.cls-modal .cls-card[data-cls="forjador"]').click());
  await sleep(200);
  await shot('selector');
  await page.evaluate(() => document.querySelector('.cls-modal .modal-foot .btn.primary').click());
  await sleep(700);
  r = await run(`return { cls: K.classesState(S).leader.cls, row: document.querySelector('.pnl-story [data-pg="lider"]')?.dataset.cls, txt: document.querySelector('.pnl-story [data-pick-class]')?.textContent || '' };`);
  ok(r.cls === 'forjador' && r.row === 'forjador' && /Cambiar clase/.test(r.txt), 'queda Forjador y la fila se vuelve a dibujar', r);
  await sleep(400);
  r = await run(`const l = P.city.life.player.obj.userData.look; return { acc: l.acc, dress: l.dress, crown: l.crown };`);
  ok(r.acc === 'martillo' && r.dress === 'jubon' && r.crown === 'gorro', 'en la ciudad lleva el martillo, con su ropa de siempre', r);
  await page.keyboard.press('Escape'); await sleep(500);

  section('Cambiarla desde el panel de Expedición');
  // el grupo se arma con la Casa de Expediciones (y el Taller)
  r = await run(`S.city.buildings.push({ uid: 9901, id: 'casa_exp', x: 2, z: 2, level: 3 }, { uid: 9902, id: 'taller', x: 4, z: 2, level: 1 });
    K.grantLeaderXp(400); K.setLeaderPicks(['trampa'], S); return K.leaderInfo(S).level;`);
  await run(`P.ctx.openPanel('expedition'); return true;`);
  ok(await waitFor(`!!document.querySelector('.pnl-ex [data-leader-class="forjador"]')`, 8000), 'la ficha de quien lidera muestra la clase');
  r = await page.evaluate(() => document.querySelector('.pnl-ex [data-leader-class]')?.textContent || '');
  ok(/Forjador/.test(r) && /cambiar/.test(r), 'con "cambiar"', r);
  await page.evaluate(() => document.querySelector('.pnl-ex [data-leader-class]').click());
  ok(await waitFor(`document.querySelectorAll('.cls-modal .cls-card').length === 6`, 5000), 'tocarla abre el selector');
  const lvBefore = await run(`return K.leaderInfo(S).level;`);
  await page.evaluate(() => document.querySelector('.cls-modal .cls-card[data-cls="cazador"]').click());
  await page.evaluate(() => document.querySelector('.cls-modal .modal-foot .btn.primary').click());
  await sleep(700);
  r = await run(`const L = K.classesState(S).leader; return { cls: L.cls, picks: L.picks, level: K.leaderInfo(S).level, card: document.querySelector('.pnl-ex [data-leader-class]')?.dataset.leaderClass };`);
  ok(r.cls === 'cazador' && r.card === 'cazador' && !r.picks.length && r.level === lvBefore, 'cambiar a Cazador: el nivel queda, las activas se vuelven a elegir', r);
  await page.keyboard.press('Escape'); await sleep(500);

  section('En el combate');
  await run(`P.ctx.router.go('combat', { encounter: 'bosque_claro', seed: 3, party: ['forjador', 'curandero'], level: 3 }); return true;`);
  ok(await waitFor(`!!document.querySelector('.scene-combat')?.__combat?.view`, 30000), 'entra a una pelea');
  await sleep(800);
  r = await page.evaluate(() => {
    const L = document.querySelector('.scene-combat').__combat.looks;
    return Object.values(L).map(x => ({ type: x.type, acc: x.look?.acc, dress: x.look?.dress, crown: x.look?.crown }));
  });
  const byT = Object.fromEntries(r.map(x => [x.type, x]));
  ok(byT.lider?.acc === 'arco' && byT.lider?.dress === 'cuero' && byT.lider?.crown === 'capucha', 'quien lidera, con el kit de Cazador', byT.lider);
  ok(byT.forjador?.acc === 'martillo' && byT.curandero?.acc === 'bolso' && byT.curandero?.dress === 'habito', 'cada integrante con el de su clase', r);
  r = await page.evaluate(() => document.querySelector('.scene-combat').__combat.battle?.leader?.cls);
  ok(r === 'cazador', 'y la pelea usa la clase de quien lidera', r);
  await shot('combate');

  section('En la expedición');
  r = await run(`const X = await import('./src/expedition/expedition.js');
    S.prov = 200; S.expedition && (S.expedition.active = null);
    const st = X.expeditionStatus(); const party = st.roles.filter(x => !x.tiredMs).map(x => x.id).slice(0, 2);
    const res = X.startExpedition({ region: 'bosque', kind: 'corta', party });
    return { ok: !res?.error, err: res?.error || null, party, roles: st.roles.map(x => x.id) };`);
  ok(r.ok && r.party.length >= 1, 'sale una expedición con parte del grupo', r);
  await run(`P.ctx.router.go('expedition'); return true;`);
  ok(await waitFor(`!!document.querySelector('.scene-expedition')?.__exp?.view`, 30000), 'entra a la expedición');
  await sleep(800);
  const looks = await page.evaluate(() => document.querySelector('.scene-expedition').__exp.looks.map(l => l && [l.dress, l.acc].join('/')));
  const KIT = { guerrero: 'cota/espada', cazador: 'cuero/arco', forjador: 'delantal/martillo', curandero: 'habito/bolso', monje: 'habito/baston', saqueador: 'cuero/hacha' };
  ok(looks[0] === KIT.cazador && r.party.every((c, i) => looks[i + 1] === KIT[c]), 'quien lidera y cada integrante con el kit de su clase', { looks, party: r.party });
  await shot('expedicion');

  section('Onboarding');
  await run(`S.onboarded = false; P.ctx.router.go('onboarding'); return true;`);
  ok(await waitFor(`!!document.querySelector('.scene-onboarding .ob-next')`, 15000), 'el onboarding abre');
  await sleep(600);
  await page.evaluate(() => document.querySelector('.scene-onboarding .ob-next').click());
  ok(await waitFor(`document.querySelectorAll('.scene-onboarding .cls-card').length === 6`, 5000), 'el segundo paso es la clase');
  ok(await page.evaluate(() => document.querySelectorAll('.scene-onboarding .ob-dots i').length === 4), '4 puntos: personaje, clase, nombres y estilo');
  await page.evaluate(() => document.querySelector('.scene-onboarding .cls-card[data-cls="monje"]').click());
  await sleep(500);
  r = await page.evaluate(() => ({ on: document.querySelector('.scene-onboarding .cls-card.on')?.dataset.cls, title: document.querySelector('.scene-onboarding .ob-title b')?.textContent, hint: document.querySelector('.scene-onboarding .ob-cls .ob-hint')?.textContent }));
  ok(r.on === 'monje' && /Monje/.test(r.title) && r.hint.length > 20, 'elegir Monje cambia el título y la explicación', r);
  await waitFor(`document.querySelectorAll('.scene-onboarding .cls-card img.th.ok').length === 6`, 15000);
  await shot('onboarding');
  await page.evaluate(() => document.querySelector('.scene-onboarding .ob-back').click());
  ok(await waitFor(`!!document.querySelector('.scene-onboarding [data-type]')`, 4000), 'Volver lleva al personaje');
  await page.evaluate(() => document.querySelector('.scene-onboarding .ob-next').click());
  await waitFor(`!!document.querySelector('.scene-onboarding .cls-card')`, 4000);
  r = await page.evaluate(() => document.querySelector('.scene-onboarding .cls-card.on')?.dataset.cls);
  ok(r === 'monje', 'y al volver a la clase sigue la elegida', r);
  await page.evaluate(() => document.querySelector('.scene-onboarding .ob-next').click());
  ok(await waitFor(`!!document.querySelector('.scene-onboarding [data-f=name]')`, 4000), 'después vienen los nombres');

  ok(!errors.length, 'sin errores en la página', errors.slice(0, 3));
} catch (e) { ok(false, 'el juego anduvo sin trabarse', String(e && e.stack || e)); }
await browser.close();
server.close();

console.log(`\ntest-class-look: ${pass} bien, ${fail} mal`);
process.exitCode = fail ? 1 : 0;
