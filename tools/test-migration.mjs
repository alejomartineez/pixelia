// Migración del guardado v2 → v3 (DESIGN-CORE.md §7.2, Fase 5), en Chrome headless con el juego real.
// Carga un guardado v2 armado a mano como el de alguien que ya jugaba (minijuegos jugados, álbum a medias, materiales
// viejos, un monumento a medio juntar, potenciadores en la mochila, Mi Casa, contactos, tema y ropa) y comprueba que:
//   materiales cristal/ladrillo/tuerca/mapa → mineral/piedra/madera/hierbas (sumados) y la etapa del Faro con lo ya juntado ·
//   Joyería/Torre de Bloques/Garaje/Pista → Taller/Dispensario/Establo/Casa de Expediciones (uid, lugar, rotación, nivel) ·
//   compensación en gemas y hallazgos de 2★ o más con el aviso "Los minijuegos se retiraron" (una sola vez) ·
//   álbum (Hallazgos) con lo pegado, recortes y sets cobrados · potenciadores → equipo · épocas · planos · diarias nuevas ·
//   logros de minijuegos como Recuerdos · monumentos, Mi Casa, rango, contactos, temas y ropa intactos ·
//   una segunda carga no cambia nada. Además: Joyería + Taller a la vez, partida sin Pista (la Casa de Expediciones
//   aparece sola), el mismo guardado entrando por importCode (la nube) y una partida nueva que no ve el aviso.
//
//   node tools/test-migration.mjs
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

let pass = 0, fail = 0;
const ok = (c, msg, extra) => { if (c) { pass++; console.log('  ✔', msg); } else { fail++; console.log('  ✘', msg, extra !== undefined ? JSON.stringify(extra) : ''); } };
const section = t => console.log('\n■', t);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const KEY = 'pixelia.save.v1';
const HOUR = 3600e3, DAY = 24 * HOUR;

// ---------- Guardado v2 de alguien que ya jugaba (rango Villa, nivel 14) ----------
const now = Date.now();
const B = (uid, id, x, z, level = 1, rot = 0, extra = {}) => ({ uid, id, x, z, rot, level, buildEnd: 0, upgradeEnd: 0, lastCollect: now - HOUR, ...extra });
function saveV2({ withPista = true, withTaller = false } = {}) {
  const buildings = [
    B(1, 'castillo', 12, 12, 4),
    B(2, 'joyeria', 8, 9, 3, 1),
    B(3, 'torre_bloques', 17, 9, 2, 0),
    B(4, 'garaje', 8, 17, 2, 2),
    B(5, 'mi_casa', 13, 17, 2),
    B(6, 'casita', 17, 12, 3), B(7, 'panaderia', 17, 15, 2), B(8, 'heladeria', 9, 13, 1),
    B(9, 'faro', 6, 5, 2),                       // monumento: 2 etapas hechas de 4
    B(10, 'arbol', 11, 7), B(11, 'camino', 12, 11),
  ];
  if (withPista) buildings.push(B(12, 'pista', 14, 5, 2, 3));
  if (withTaller) buildings.push(B(13, 'taller', 20, 18, 1));
  return {
    v: 2, created: now - 40 * DAY, lastSeen: now - 2 * HOUR,
    player: { name: 'Lu', cityName: 'Villa Sauce', level: 14, xp: 120 },
    onboarded: true, coins: 5000, gems: 40,
    avatar: { type: 'chica', skin: 3, hair: 'coleta', hairColor: 'castano', dress: 'buzo', dressColor: 'azul', crown: 'gorra', acc: 'mochila' },
    avatarLooks: { chico: { skin: 3, hair: 'corto', hairColor: 'negro', dress: 'remera', dressColor: 'rojo', crown: 'ninguna', acc: 'ninguno' } },
    car: { body: 'jeep', color: 'verde', wheels: 'clasica', topper: 'ninguno' },
    owned: { hair: ['coleta', 'corto'], dress: ['buzo', 'remera'], crown: ['ninguna', 'gorra'], acc: ['mochila', 'ninguno'], body: ['convertible', 'jeep'], wheels: ['clasica'], topper: ['ninguno'] },
    city: { buildings, nextUid: 20, expansions: 2, flagColor: 'verde', theme: 'bosque', camera: null },
    builders: 3,
    // materiales de minijuego + algo de región (ya había expediciones en la v20)
    materials: { cristal: 7, ladrillo: 9, tuerca: 4, mapa: 3, madera: 5, piedra: 0, mineral: 0, hierbas: 2 },
    quests: { main: 18, mainProgress: 0, done: { t1: 1, t2: 1, t3: 1, t4: 1 }, chain: 2, achTier: { a_match3: 2, a_build: 3 },
      daily: { date: '2026-11-01', list: [{ id: 'd_match3', progress: 1, claimed: false, count: 2 }, { id: 'd_parking', progress: 0, claimed: false, count: 3 }, { id: 'd_build', progress: 1, claimed: true, count: 2 }], bonusClaimed: false } },
    login: { last: '2026-11-06', streak: 12 },
    stats: { match3Wins: 22, parkingWins: 10, gamesPlayed: 80, built: 40, coinsEarned: 90000, rankBest: 4, stickersNew: 31 },
    games: { match3: { level: 23, stars: { 1: 3, 2: 2 } }, blocks: { best: 5400 }, parking: { level: 11, stars: { 1: 3 } }, driving: { best: 12800 } },
    tutorial: { game_match3: true },
    settings: { music: false, sfx: true, lowQuality: false, telemetry: true, textSize: 'large', motion: 'auto' },
    chests: { inv: { madera: 1 }, items: { hammer: 2, m3_moves: 2, m3_bomb: 1, blk_bomb: 1, park_time: 1, drv_shield: 1, potion_prod: 1 }, freeBuilds: {}, boosts: {}, freeBase: now - 10 * HOUR, sinceLegend: 4, opened: 30, winsSinceChest: 2 },
    album: {
      have: { 'princesas-1': 2, 'princesas-2': 1, 'princesas-3': 1, 'princesas-4': 1, 'princesas-5': 1, 'princesas-6': 1, 'princesas-7': 1, 'princesas-8': 1, 'princesas-9': 1, 'joyas-1': 3, 'joyas-4': 1, 'playa-2': 1 },
      claimedSets: ['princesas'], brillitos: 37, seen: ['princesas-1', 'joyas-1'], done: ['princesas'], since5: 12,
    },
    home: { items: [{ uid: 1, id: 'cama', x: 1, z: 1, rot: 0 }, { uid: 2, id: 'trofeo_joyas', x: 3, z: 1, rot: 0 }], wall: 'menta', floor: 'nogal', nextUid: 3, owned: { silla: 1 }, trophies: { trofeo_joyas: true }, started: true },
    social: { giftDay: { 'f-bea': '2026-11-06' }, coop: { week: '2026-W45', local: 120, pending: 0, claimed: [1], reached: 1, carry: [] }, rank: { hist: { '2026-W44': { match3: 900, blocks: 0, parking: 0, driving: 0, stars: 6, played: 4 } }, claimed: [] } },
    online: { week: { id: '2026-W45', match3: 1500, blocks: 0, parking: 0, driving: 0, stars: 6 } },
    season: {}, events: {},
  };
}

/** Abre el juego con un guardado puesto antes de que arranque (solo en la primera carga del contexto). */
async function openWithSave(save, query = '?nosplash&nosw') {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.evaluateOnNewDocument((key, json) => {
    if (sessionStorage.getItem('__seeded')) return;
    sessionStorage.setItem('__seeded', '1');
    if (json) localStorage.setItem(key, json); else localStorage.removeItem(key);
  }, KEY, save ? JSON.stringify(save) : '');
  await page.goto(BASE + query, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__pixelia?.store?.state && window.__pixelia.ctx.router.current === 'city', { timeout: 30000 });
  await sleep(800);
  return { page, context, errors };
}
const run = (page, body, ...args) => page.evaluate(new Function('...args', `const P = window.__pixelia, S = P.store.state, E = P.economy, Q = P.quests, A = P.album; return (async () => { ${body} })();`), ...args);
const snapshot = (page) => run(page, `
  const b = S.city.buildings.map(b => [b.uid, b.id, b.x, b.z, b.rot, b.level, b.era]).sort((x, y) => x[0] - y[0]);
  return { v: S.v, materials: S.materials, buildings: b, gems: S.gems, coins: S.coins, equipment: S.equipment, items: S.chests.items,
    have: S.album.have, brillitos: S.album.brillitos, claimedSets: S.album.claimedSets, planos: S.planos, v3: S.v3, games: S.games,
    avatar: S.avatar, avatarLooks: S.avatarLooks, car: S.car, owned: S.owned, theme: S.city.theme, flag: S.city.flagColor,
    home: S.home && { items: S.home.items, wall: S.home.wall, floor: S.home.floor }, social: S.social && { giftDay: S.social.giftDay, coop: S.social.coop },
    login: S.login, settings: S.settings, expansions: S.city.expansions, level: S.player.level, name: S.player.name, city: S.player.cityName };`);
const sumHave = (h) => Object.values(h || {}).reduce((a, b) => a + b, 0);

try {
  // ===================================================================
  section('Guardado v2 con minijuegos jugados → v3');
  const V2 = saveV2();
  const { page, errors } = await openWithSave(V2);
  const s1 = await snapshot(page);
  ok(s1.v === 3, 'la partida queda en v3', s1.v);
  ok(s1.name === 'Lu' && s1.city === 'Villa Sauce' && s1.level === 14 && s1.expansions === 2, 'nombre, ciudad, nivel y terreno intactos');

  // 1. materiales
  const m = s1.materials;
  ok(!['cristal', 'ladrillo', 'tuerca', 'mapa'].some(k => k in m), 'ya no hay materiales de minijuego', m);
  ok(m.mineral === 7 && m.piedra === 9 && m.madera === 5 + 4 && m.hierbas === 2 + 3, 'cristal→mineral, ladrillo→piedra, tuerca→madera, mapa→hierbas (sumados)', m);
  const faro = await run(page, `const st = E.monumentStatus('faro'); return { done: st.stagesDone, cost: st.next?.cost || st.nextStage?.cost || null }`);
  ok(faro.done === 2, 'el Faro sigue con 2 etapas hechas', faro);
  const near = await run(page, `const mo = P.data.MONUMENTS.faro; const c = mo.stages[2].cost.mats; return { c, have: { piedra: S.materials.piedra, mineral: S.materials.mineral } }`);
  // la etapa 3 se renombra a piedra + mineral (los números los recalibró la Fase 5b, sim-economy) y lo juntado no se pierde
  ok(near.c.piedra > 0 && near.c.mineral > 0 && Object.keys(near.c).length === 2 && near.have.piedra === 9 && near.have.mineral === 7, 'la etapa 3 del Faro pide piedra + mineral y lo juntado (9 + 7) sigue ahí', near);

  // 2. edificios
  const byUid = Object.fromEntries(s1.buildings.map(b => [b[0], b]));
  const same = (uid, id, x, z, rot, level) => { const b = byUid[uid]; return b && b[1] === id && b[2] === x && b[3] === z && b[4] === rot && b[5] === level; };
  ok(same(2, 'taller', 8, 9, 1, 3), 'Joyería → Taller (mismo uid, lugar, rotación y nivel 3)', byUid[2]);
  ok(same(3, 'dispensario', 17, 9, 0, 2), 'Torre de Bloques → Dispensario (nivel 2)', byUid[3]);
  ok(same(4, 'establo', 8, 17, 2, 2), 'Garaje → Establo (nivel 2)', byUid[4]);
  ok(same(12, 'casa_exp', 14, 5, 3, 2), 'Pista → Casa de Expediciones (nivel 2)', byUid[12]);
  ok(s1.buildings.length === V2.city.buildings.length && !s1.buildings.some(b => ['joyeria', 'torre_bloques', 'garaje', 'pista'].includes(b[1])), 'mismos edificios, ninguno con id viejo');
  ok(same(9, 'faro', 6, 5, 0, 2) && same(5, 'mi_casa', 13, 17, 0, 2) && same(1, 'castillo', 12, 12, 0, 4), 'monumento, Mi Casa y Municipalidad (rango 4) intactos');
  const era4 = await run(page, `return P.data.eraOfRank(4)`);
  ok(s1.buildings.filter(b => b[1] !== 'castillo').every(b => b[6] === era4), `cada edificio tiene la época del rango (${era4})`, s1.buildings.map(b => b[6]));
  ok(await run(page, `return E.rankStatus ? E.townRank() === 4 : true`), 'el rango sigue en Villa');

  // 3. compensación
  const gems = Math.min(150, 2 * 22 + 3 * 10 + 5 + 12);
  ok(s1.v3?.gems === gems && s1.gems === 40 + gems, `+${gems} gemas por los minijuegos (2×22 + 3×10 + 5 + 12)`, { v3: s1.v3, gems: s1.gems });
  ok(s1.v3?.finds === 6 && s1.v3.findsGiven === 1 && s1.v3.got?.length === 6, '6 hallazgos de regalo (⌊32 niveles / 5⌋)', s1.v3);
  const gotStars = await run(page, `return S.v3.got.map(id => A.stickerDef(id)?.stars || 0)`);
  ok(gotStars.every(x => x >= 2), 'todos de 2★ o más', gotStars);
  ok(JSON.stringify(s1.games) === JSON.stringify(V2.games), 'state.games queda guardado (sin uso)');

  // 4. álbum → Hallazgos
  ok(sumHave(s1.have) === sumHave(V2.album.have) + 6, 'Hallazgos conserva todo lo pegado (+6 de regalo)', { antes: sumHave(V2.album.have), ahora: sumHave(s1.have) });
  ok(Object.entries(V2.album.have).every(([id, n]) => (s1.have[id] || 0) >= n), 'cada hallazgo que tenías sigue (mismos ids)');
  ok(s1.brillitos === 37 && JSON.stringify(s1.claimedSets) === '["princesas"]', 'recortes (album.brillitos) y sets cobrados intactos', { b: s1.brillitos, c: s1.claimedSets });
  const regions = await run(page, `return Object.fromEntries(A.STICKER_SETS.map(s => [s.id, s.region]))`);
  ok(regions.princesas === 'bosque' && regions.postres === 'sierras' && regions.flores === 'banado' && regions.joyas === 'cerro' && regions.fiesta === 'costa', 'los 12 sets repartidos entre las regiones (§7.2.4)', regions);
  const fromRegion = await run(page, `const got = A.grantStickers(8, { region: 'sierras', source: 'test' }); return got.map(g => A.stickerDef(g.id).set)`);
  ok(fromRegion.every(x => x === 'postres' || x === 'mascotas'), 'explorando las Sierras salen hallazgos de sus sets', fromRegion);

  // 5. potenciadores → equipo
  ok(s1.equipment.cuerda === 2 && s1.equipment.pala === 2 && s1.equipment.farol === 1 && s1.equipment.lona === 1, 'potenciadores → equipo: 2 cuerdas, 2 palas, farol y lona', s1.equipment);
  ok(s1.items.hammer === 2 && s1.items.potion_prod === 1 && !['m3_moves', 'm3_bomb', 'blk_bomb', 'park_time', 'drv_shield'].some(k => k in s1.items), 'martillos y pociones se quedan; los potenciadores salen de la mochila', s1.items);

  // 7–9. recursos, misiones, logros
  ok(s1.planos === 2, 'planos = ⌊rango 4 / 2⌋', s1.planos);
  const daily = await run(page, `return Q.dailyQuests().map(q => q.id)`);
  ok(daily.length === 3 && !daily.some(id => /match3|blocks|parking|driving/.test(id)), 'las diarias se sortearon de nuevo, sin minijuegos', daily);
  const ach = await run(page, `return Q.achievements().filter(a => a.retired).map(a => ({ id: a.id, tier: a.tier, memory: a.memory, ready: a.ready }))`);
  ok(ach.length === 1 && ach[0].id === 'a_match3' && ach[0].tier === 2 && ach[0].memory && !ach[0].ready, 'el logro de Joyas queda como Recuerdo con sus 2 escalones (los no ganados no aparecen)', ach);

  // intactos
  ok(JSON.stringify(s1.avatar) === JSON.stringify(V2.avatar) && JSON.stringify(s1.avatarLooks) === JSON.stringify(V2.avatarLooks), 'personaje y looks guardados intactos');
  ok(JSON.stringify(s1.car) === JSON.stringify(V2.car) && Object.entries(V2.owned).every(([k, list]) => list.every(id => s1.owned[k]?.includes(id))), 'auto y ropa comprada intactos', { car: s1.car, owned: s1.owned });
  ok(s1.theme === 'bosque' && s1.flag === 'verde', 'tema y bandera intactos');
  const hi = (list) => JSON.stringify((list || []).map(i => [i.id, i.x, i.z, i.rot || 0]));
  ok(hi(s1.home.items) === hi(V2.home.items) && s1.home.wall === 'menta' && s1.home.floor === 'nogal', 'Mi Casa por dentro intacta (muebles y trofeo)', s1.home);
  ok(JSON.stringify(s1.social.giftDay) === JSON.stringify(V2.social.giftDay) && s1.social.coop.local === 120, 'contactos (regalos del día, Obra en Equipo) intactos');
  ok(s1.login.streak === 12 && s1.settings.textSize === 'large' && s1.settings.music === false, 'racha y ajustes intactos');

  // aviso único
  ok(await page.waitForFunction(() => !!document.querySelector('.modal.v3-notice'), { timeout: 15000 }).then(() => true, () => false), 'aparece el aviso «Los minijuegos se retiraron»');
  const txt = await page.evaluate(() => document.querySelector('.modal.v3-notice')?.textContent.replace(/\s+/g, ' ') || '');
  ok(/Los minijuegos se retiraron/.test(txt) && /Taller/.test(txt) && /Casa de Expediciones/.test(txt) && /Hallazgos/.test(txt) && /equipo/.test(txt), 'el aviso cuenta edificios, materiales, Hallazgos y equipo', txt.slice(0, 300));
  await page.evaluate(() => document.querySelector('.modal.v3-notice .modal-foot .btn')?.click());
  await sleep(800);
  ok(await run(page, `return S.v3.shown === 1`), 'el aviso queda marcado como visto');
  ok(errors.length === 0, 'sin errores de página', errors);

  // ===================================================================
  section('Segunda carga: no cambia nada');
  await run(page, `P.store.save(); return true;`);
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.__pixelia?.store?.state && window.__pixelia.ctx.router.current === 'city', { timeout: 30000 });
  await sleep(1500);
  const s2 = await snapshot(page);
  const pick = (s) => JSON.stringify({ v: s.v, materials: s.materials, buildings: s.buildings, gems: s.gems, equipment: s.equipment, items: s.items, have: s.have, brillitos: s.brillitos, planos: s.planos, v3: s.v3, avatar: s.avatar, car: s.car, home: s.home, theme: s.theme });
  // entre las dos cargas se pegaron 8 hallazgos de prueba (Sierras): se comparan contra el estado ya guardado
  const s1b = { ...s1, have: (await run(page, `return S.album.have`)) };
  ok(pick(s2) === pick(s1b), 'materiales, edificios, gemas, equipo, Hallazgos y recursos iguales en la segunda carga', { s1: pick(s1b).slice(0, 200), s2: pick(s2).slice(0, 200) });
  ok(!(await page.evaluate(() => !!document.querySelector('.modal.v3-notice'))), 'el aviso no vuelve a salir');
  const again = await run(page, `const norm = (o) => JSON.stringify(o, (k, v) => v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map(x => [x, v[x]])) : v);
    const before = JSON.parse(JSON.stringify(S)); P.store.importCode(P.store.exportCode()); const after = JSON.parse(JSON.stringify(P.store.state));
    return Object.keys({ ...before, ...after }).filter(k => k !== 'lastSeen' && norm(before[k]) !== norm(after[k]));`);
  ok(again.length === 0, 'exportar e importar la partida migrada no la cambia (idempotente)', again);
  await page.browserContext().close();

  // ===================================================================
  section('El mismo guardado v2 llegando por la nube (importCode)');
  {
    const { page: p2, context } = await openWithSave(null, '?nosplash&nosw&reset&scene=city');
    const r = await run(p2, `const code = btoa(unescape(encodeURIComponent(JSON.stringify(args[0])))); P.store.importCode(code); E.tick(); const T = P.store.state;
      return { v: T.v, mats: T.materials, ids: T.city.buildings.map(b => b.id), gems: T.gems, eq: T.equipment };`, V2);
    ok(r.v === 3 && r.mats.mineral === 7 && r.ids.includes('casa_exp') && !r.ids.includes('pista') && r.gems === 40 + gems && r.eq.cuerda === 2, 'importCode migra igual que la carga local', r);
    await context.close();
  }

  // ===================================================================
  section('Joyería y Taller a la vez · sin Pista');
  {
    const V = saveV2({ withPista: false, withTaller: true });
    const { page: p3, context } = await openWithSave(V);
    await sleep(800);
    const r = await run(p3, `E.tick(); const t = S.city.buildings.filter(b => b.id === 'taller'); const ce = S.city.buildings.filter(b => b.id === 'casa_exp');
      return { talleres: t.map(b => [b.uid, b.level]), joy: S.city.buildings.some(b => b.id === 'joyeria'), coins: S.coins, refund: S.v3.refund, ce: ce.map(b => [b.x, b.z, b.level]), placed: S.v3.expPlaced, free: S.v3.expFree, freeBuild: P.chests.freeBuildCount('casa_exp') }`);
    ok(r.talleres.length === 1 && r.talleres[0][0] === 13 && r.talleres[0][1] === 3 && !r.joy, 'queda un solo Taller, con el nivel 3 de la Joyería', r.talleres);
    ok(r.refund === 450 && r.coins >= 5000 + 450, 'la Joyería repetida se devuelve en monedas (150 × nivel 3)', { refund: r.refund, coins: r.coins });
    ok((r.ce.length === 1 && r.placed) || (r.free === 1 && r.freeBuild === 1), 'sin Pista: la Casa de Expediciones aparece sola (o queda gratis en Construir)', r);
    const castle = await run(p3, `const c = S.city.buildings.find(b => b.id === 'castillo'); const ce = S.city.buildings.find(b => b.id === 'casa_exp'); return ce ? Math.hypot(ce.x - c.x, ce.z - c.z) : 0`);
    ok(castle < 9, 'colocada cerca de la Municipalidad', castle);
    await context.close();
  }

  // ===================================================================
  section('Partida nueva: sin aviso ni compensación');
  {
    const { page: p4, context } = await openWithSave(null, '?nosplash&nosw&reset&scene=city');
    const r = await run(p4, `return { v: S.v, v3: S.v3 || null, mats: Object.keys(S.materials), games: S.games || null }`);
    ok(r.v === 3 && !r.v3 && !r.games && r.mats.join() === 'madera,piedra,mineral,hierbas', 'v3 de entrada, solo materiales de región y sin state.games', r);
    await sleep(2500);
    ok(!(await p4.evaluate(() => !!document.querySelector('.modal.v3-notice'))), 'no ve el aviso de los minijuegos');
    await context.close();
  }
} catch (e) {
  fail++;
  console.error('✘ error inesperado', e);
} finally {
  await browser.close();
  server.close();
  console.log(`\n${pass} ✔ · ${fail} ✘`);
  process.exit(fail ? 1 : 0);
}
