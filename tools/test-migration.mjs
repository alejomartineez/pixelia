// Migración del guardado v2 → v3 (DESIGN-CORE.md §7.2, Fase 5) y v3 → v4 (fuera lo tierno, PLAN-QUIEBRE §J7), en
// Chrome headless con el juego real.
// Carga un guardado v2 armado a mano como el de alguien que ya jugaba (minijuegos jugados, álbum a medias, materiales
// viejos, un monumento a medio juntar, potenciadores en la mochila, Mi Casa, contactos, tema y ropa) y comprueba que:
//   materiales cristal/ladrillo/tuerca/mapa → mineral/piedra/madera/hierbas (sumados) y la etapa del Faro con lo ya juntado ·
//   Joyería/Torre de Bloques/Garaje/Pista → Taller/Dispensario/Establo/Casa de Expediciones (uid, lugar, rotación, nivel) ·
//   compensación en gemas y hallazgos de 2★ o más con el aviso "Los minijuegos se retiraron" (una sola vez) ·
//   álbum (Hallazgos) con lo pegado, recortes y sets cobrados · potenciadores → equipo · épocas · planos · diarias nuevas ·
//   logros de minijuegos como Recuerdos · monumentos, Mi Casa, rango, contactos, temas y ropa intactos ·
//   una segunda carga no cambia nada. Además: Joyería + Taller a la vez, partida sin Pista (la Casa de Expediciones
//   aparece sola), el mismo guardado entrando por importCode (la nube) y una partida nueva que no ve el aviso.
//   v4: un guardado v3 con el oso (persona con sus colores, piezas retiradas devueltas, playa → bruma, aviso único,
//   idempotente) y perfiles de contactos viejos que se ven como personas.
//   v5 (personajes serios, PLAN-QUIEBRE §M): chica y chico pasan a humanos, las piezas a su equivalente (las repetidas y
//   las que ahora son gratis se devuelven, lo puesto queda tuyo), el look del otro tipo se guarda, aviso único, idempotente;
//   el auto pasa a ser el esquife (M5): casco, pintura, vela y proa, con lo comprado traducido.
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
    // la semana de hoy (antes estaba fija en 2026-W45 y la prueba fallaba al cambiar de semana)
    social: { giftDay: { 'f-bea': '2026-11-06' }, coop: { week: weekKey(now), local: 120, pending: 0, claimed: [1], reached: 1, carry: [] }, rank: { hist: { [weekKey(now - 7 * 864e5)]: { match3: 900, blocks: 0, parking: 0, driving: 0, stars: 6, played: 4 } }, claimed: [] } },
    online: { week: { id: weekKey(now), match3: 1500, blocks: 0, parking: 0, driving: 0, stars: 6 } },
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
    login: S.login, settings: S.settings, expansions: S.city.expansions, level: S.player.level, name: S.player.name, city: S.player.cityName,
    // una amenaza del calendario que cae justo hoy se resuelve sola al cargar y paga gemas: se descuenta para que no dependa del día
    threatGems: Object.values(S.threats?.results || {}).reduce((a, r) => a + (r.reward?.gems || 0), 0) };`);
/** Clave de semana ISO como isoWeek de src/online/net.js (en UTC: la usan Contactos y la Obra en Equipo). */
function weekKey(ms) {
  const d = new Date(ms);
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dow);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const wk = Math.ceil(((t - y0) / 864e5 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(wk).padStart(2, '0')}`;
}
const sumHave = (h) => Object.values(h || {}).reduce((a, b) => a + b, 0);

try {
  // ===================================================================
  section('Guardado v2 con minijuegos jugados → v3');
  const V2 = saveV2();
  const { page, errors } = await openWithSave(V2);
  const s1 = await snapshot(page);
  ok(s1.v === 5, 'la partida queda en v5 (pasa por la v3 y la v4)', s1.v);
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
  ok(s1.v3?.gems === gems && s1.gems === 40 + gems + s1.threatGems, `+${gems} gemas por los minijuegos (2×22 + 3×10 + 5 + 12)`, { v3: s1.v3, gems: s1.gems, threatGems: s1.threatGems });
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
  const a1 = s1.avatar;
  ok(a1.type === 'humano' && a1.build === 'esbelto' && a1.hair === 'coleta' && a1.dress === 'viajero' && a1.crown === 'gorra' && a1.acc === 'mochila' && a1.face === 'ninguna' && a1.skin === 3 && a1.dressColor === 'azul',
    'la chica pasa a humana esbelta con su ropa traducida (v5)', a1);
  const want = { hair: ['coleta', 'corto'], dress: ['viajero'], crown: ['ninguna', 'gorra'], acc: ['mochila', 'ninguno'], body: ['bote', 'balandra'] };
  ok(JSON.stringify(s1.car) === JSON.stringify({ ...V2.car, body: 'balandra', wheels: 'vela' }) && Object.entries(want).every(([k, list]) => list.every(id => s1.owned[k]?.includes(id))),
    'el auto pasa a su esquife y la ropa comprada queda (con sus ids nuevos)', { car: s1.car, owned: s1.owned });
  ok(s1.theme === 'musgo' && s1.flag === 'verde', 'el tema bosque pasa a musgo (v4) y la bandera queda intacta', { theme: s1.theme, flag: s1.flag });
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
  // v3.shown queda afuera: pasa a 1 cuando se arma el aviso de llegada, que con la máquina cargada sale después de
  // tomar s1 (se chequea aparte en «el aviso queda marcado como visto»)
  const pick = (s) => JSON.stringify({ v: s.v, materials: s.materials, buildings: s.buildings, gems: s.gems, equipment: s.equipment, items: s.items, have: s.have, brillitos: s.brillitos, planos: s.planos, v3: { ...s.v3, shown: undefined }, avatar: s.avatar, car: s.car, home: s.home, theme: s.theme });
  // entre las dos cargas se pegaron 8 hallazgos de prueba (Sierras): se comparan contra el estado ya guardado
  const s1b = { ...s1, have: (await run(page, `return S.album.have`)) };
  ok(pick(s2) === pick(s1b), 'materiales, edificios, gemas, equipo, Hallazgos y recursos iguales en la segunda carga', Object.keys(JSON.parse(pick(s2))).filter(k => JSON.stringify(JSON.parse(pick(s2))[k]) !== JSON.stringify(JSON.parse(pick(s1b))[k])).map(k => [k, JSON.parse(pick(s1b))[k], JSON.parse(pick(s2))[k]]));
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
      return { v: T.v, mats: T.materials, ids: T.city.buildings.map(b => b.id), gems: T.gems, eq: T.equipment, threatGems: Object.values(T.threats?.results || {}).reduce((a, r) => a + (r.reward?.gems || 0), 0) };`, V2);
    ok(r.v === 5 && r.mats.mineral === 7 && r.ids.includes('casa_exp') && !r.ids.includes('pista') && r.gems === 40 + gems + r.threatGems && r.eq.cuerda === 2, 'importCode migra igual que la carga local', r);
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
  section('Guardado v3 con un personaje animal → v4 (fuera lo tierno, plan §J7)');
  {
    // base: una partida nueva real, llevada a mano a la v3 de alguien que ya jugaba con el oso
    const { page: p0, context: c0 } = await openWithSave(null, '?nosplash&nosw&reset&scene=city');
    const base = await run(p0, 'return JSON.parse(JSON.stringify(S))');
    await c0.close();
    const V3 = { ...base, v: 3, coins: 1000, gems: 10, onboarded: true,
      player: { ...base.player, level: 9, xp: 40 }, stats: { ...base.stats, coinsEarned: 9000 },
      avatar: { type: 'osito', skin: 0, hair: 'medias', hairColor: 'castano', dress: 'capita', dressColor: 'rojo', crown: 'orejitas', acc: 'mochila' },
      avatarLooks: { gatito: { skin: 0, hair: 'pancita', hairColor: 'blanco', dress: 'remerita', dressColor: 'rosa', crown: 'lacito', acc: 'ninguno' },
        chica: { skin: 2, hair: 'trenzas', hairColor: 'rubio', dress: 'camisa', dressColor: 'verde', crown: 'gorro', acc: 'ninguno' } },
      owned: { ...base.owned, hair: [...base.owned.hair, 'pancita', 'medias', 'brillitos', 'trenzas'], dress: [...base.owned.dress, 'remerita', 'capita', 'frac', 'camisa'],
        crown: [...base.owned.crown, 'orejitas', 'lacito'], acc: [...base.owned.acc, 'alas_hada'] },
      city: { ...base.city, theme: 'playa' } };
    delete V3.v4;
    const { page: p5, context, errors: e5 } = await openWithSave(V3);
    const r = await run(p5, `return { v: S.v, avatar: S.avatar, looks: S.avatarLooks, owned: S.owned, coins: S.coins, gems: S.gems, theme: S.city.theme, v4: S.v4, v5: S.v5,
      threatGems: Object.values(S.threats?.results || {}).reduce((a, r) => a + (r.reward?.gems || 0), 0) }`);
    ok(r.v === 5, 'la partida queda en v5', r.v);
    ok(r.avatar.type === 'humano' && r.avatar.build === 'recio' && r.avatar.hairColor === 'castano' && r.avatar.dressColor === 'rojo', 'el oso pasa a ser un humano recio con el mismo color de pelo (el del pelaje) y de ropa', r.avatar);
    ok(r.avatar.hair !== 'medias' && r.avatar.dress !== 'capita' && r.avatar.crown !== 'orejitas' && r.avatar.acc === 'mochila', 'lo que no le sirve a una persona vuelve a lo de arranque; la mochila se queda', r.avatar);
    ok(!('gatito' in r.looks) && !('chica' in r.looks) && r.v5?.looks?.chica?.hair === 'trenzas', 'el look guardado del gato se va y el de la chica queda guardado (v5.looks)', { looks: r.looks, v5: r.v5 });
    const RET = ['pancita', 'medias', 'brillitos', 'remerita', 'capita', 'frac', 'orejitas', 'lacito', 'alas_hada'];
    ok(!Object.values(r.owned).flat().some(id => RET.includes(id)) && r.owned.hair.includes('trenzas') && r.owned.dress.includes('jubon') && !r.owned.dress.includes('camisa'), 'las piezas retiradas salen de lo comprado; lo demás queda (la camisa ahora es el jubón)', r.owned);
    ok(r.coins === 1000 + 250 + 700 + 900 + 450 && r.v4.coins === 1850 && r.v5.coins === 450, 'se devuelven 1.850 monedas (patas blancas, capa de héroe y orejas de gato) y 450 por la camisa, que ahora es gratis', { coins: r.coins, v4: r.v4, v5: r.v5 });
    ok(r.gems === 10 + 12 + 15 + r.threatGems && r.v4.gems === 27, 'y 27 gemas (pelaje con destellos y chaleco)', { gems: r.gems, v4: r.v4 });
    ok(r.theme === 'bruma' && r.v4.theme === 'playa' && r.v4.from === 'osito', 'el estilo playa pasa a bruma', r.v4);
    ok(await p5.waitForFunction(() => !!document.querySelector('.modal.v3-notice'), { timeout: 15000 }).then(() => true, () => false), 'aparece el aviso único');
    const txt = await p5.evaluate(() => document.querySelector('.modal.v3-notice')?.textContent.replace(/\s+/g, ' ') || '');
    ok(/La isla cambió/.test(txt) && /Equipaje/.test(txt) && /Bruma/.test(txt) && /devolvimos/.test(txt) && !/minijuegos/.test(txt), 'el aviso cuenta el personaje, el estilo nuevo y la devolución (y no habla de minijuegos)', txt.slice(0, 400));
    await p5.evaluate(() => document.querySelector('.modal.v3-notice .modal-foot .btn')?.click());
    await sleep(800);
    ok(await run(p5, 'return S.v4.shown === 1'), 'el aviso queda marcado como visto');
    await run(p5, 'P.store.save(); return true;');
    await p5.reload({ waitUntil: 'load' });
    await p5.waitForFunction(() => window.__pixelia?.store?.state && window.__pixelia.ctx.router.current === 'city', { timeout: 30000 });
    await sleep(1500);
    const r2 = await run(p5, 'return { avatar: S.avatar, coins: S.coins, theme: S.city.theme, owned: S.owned }');
    ok(JSON.stringify(r2.avatar) === JSON.stringify(r.avatar) && r2.theme === 'bruma' && JSON.stringify(r2.owned) === JSON.stringify(r.owned) && r2.coins < r.coins + 1850,
      'la segunda carga no devuelve de nuevo ni cambia nada', { r2, coins: r.coins });
    ok(!(await p5.evaluate(() => !!document.querySelector('.modal.v3-notice'))), 'el aviso no vuelve a salir');
    const friend = await p5.evaluate(async () => {
      const A = await import('/src/avatar/avatar.js'); const T = await import('/src/city/themes.js');
      return { a: A.normalizeLook({ type: 'zorrito', hairColor: 'pelirrojo', dress: 'pelito' }), t: T.currentThemeId({ city: { theme: 'invierno' } }) };
    });
    ok(friend.a.type === 'humano' && friend.a.build === 'recio' && friend.a.hairColor === 'pelirrojo' && friend.a.dress !== 'pelito' && friend.t === 'escarcha', 'un perfil de contacto viejo (zorro, invierno) se ve como persona y con Escarcha', friend);
    ok(e5.length === 0, 'sin errores de página', e5);
    await context.close();
  }

  // ===================================================================
  section('Guardado v4 con ropa repetida → v5 (personajes serios y pueblos, plan §M)');
  {
    const { page: p0, context: c0 } = await openWithSave(null, '?nosplash&nosw&reset&scene=city');
    const base = await run(p0, 'return JSON.parse(JSON.stringify(S))');
    await c0.close();
    const V4 = { ...base, v: 4, v4: { shown: 1 }, coins: 500, gems: 5, onboarded: true,
      player: { ...base.player, level: 9, xp: 40 }, stats: { ...base.stats, coinsEarned: 9000 },
      avatar: { type: 'chico', skin: 2, hair: 'barba', hairColor: 'negro', dress: 'capa_real', dressColor: 'rojo', crown: 'galera', acc: 'gatito' },
      avatarLooks: { chica: { skin: 1, hair: 'ondas', hairColor: 'rubio', dress: 'sirena', dressColor: 'violeta', crown: 'flores', acc: 'bolso' } },
      owned: { ...base.owned, hair: ['largo', 'coleta', 'cortito', 'despeinado', 'barba', 'ondas'],
        dress: ['clasico', 'corto', 'buzo', 'remera', 'chaqueta', 'capa_real', 'gala', 'sirena', 'pollera', 'camisa', 'estrellas_p'],
        crown: ['ninguna', 'vincha', 'laurel', 'gorra', 'gorro', 'flores', 'galera', 'sombrero_estrellas'], acc: ['ninguno', 'mochila', 'espada', 'gatito', 'buho', 'bolso'],
        body: ['convertible', 'mini', 'jeep'], wheels: ['clasica', 'estrella'], topper: ['ninguno', 'moño', 'corazon'] },
      car: { body: 'jeep', color: 'rojo', wheels: 'estrella', topper: 'corazon' } };
    delete V4.v5;
    const { page: p6, context, errors: e6 } = await openWithSave(V4);
    const r = await run(p6, `return { v: S.v, avatar: S.avatar, looks: S.avatarLooks, owned: S.owned, coins: S.coins, gems: S.gems, v5: S.v5, car: S.car,
      threatGems: Object.values(S.threats?.results || {}).reduce((a, r) => a + (r.reward?.gems || 0), 0) }`);
    ok(r.v === 5, 'la partida queda en v5', r.v);
    const a = r.avatar;
    ok(a.type === 'humano' && a.build === 'recio' && a.face === 'barba_larga' && a.hair === 'cortito' && a.dress === 'capa_viaje' && a.crown === 'galera' && a.acc === 'buho',
      'el chico pasa a humano recio: la barba de sabio es su cara, la capa de gala es la capa de viaje y el gato, el cuervo', a);
    ok(!Object.keys(r.looks).length && r.v5.looks?.chica?.dress === 'vestido_noble' && r.v5.looks.chica.crown === 'vincha' && r.v5.looks.chica.build === 'esbelto',
      'el look de la chica queda guardado, traducido', { looks: r.looks, v5: r.v5 });
    const OLD = ['barba', 'clasico', 'corto', 'buzo', 'remera', 'chaqueta', 'capa_real', 'gala', 'sirena', 'pollera', 'camisa', 'estrellas_p', 'laurel', 'flores', 'sombrero_estrellas', 'gatito'];
    const oldIn = (id) => ['dress', 'crown', 'acc'].some(k => r.owned[k].includes(id)) || (id === 'barba' && r.owned.hair.includes(id));
    ok(['capa_viaje', 'vestido_noble', 'placas'].every(id => r.owned.dress.includes(id)) && r.owned.crown.includes('yelmo') && r.owned.crown.includes('galera')
      && r.owned.acc.includes('buho') && r.owned.acc.includes('bolso') && r.owned.hair.includes('ondas') && !OLD.some(oldIn),
      'lo comprado pasa a su equivalente y lo puesto queda tuyo (la capa de viaje, aunque ahora se paga)', r.owned);
    // M5: el auto pasa a ser el esquife; cada pieza a su equivalente, sin perder nada
    ok(r.car.body === 'balandra' && r.car.color === 'rojo' && r.car.wheels === 'globo' && r.car.topper === 'mascaron',
      'el jeep pasa a balandra, las ruedas estrella al globo y el corazón al mascarón (el color queda)', r.car);
    ok(['bote', 'chalupa', 'balandra'].every(id => r.owned.body.includes(id)) && ['vela', 'globo'].every(id => r.owned.wheels.includes(id))
      && ['ninguno', 'farol', 'mascaron'].every(id => r.owned.topper.includes(id))
      && !['convertible', 'mini', 'jeep', 'clasica', 'estrella', 'moño', 'corazon'].some(id => [...r.owned.body, ...r.owned.wheels, ...r.owned.topper].includes(id)),
      'las piezas del auto que tenías pasan a las del esquife', { body: r.owned.body, wheels: r.owned.wheels, topper: r.owned.topper });
    ok(r.coins === 500 + 600 + 1000 + 300 + 450 + 400 && r.v5.coins === 2750, 'se devuelven 2.750 monedas: barba de sabio, el vestido largo repetido, pollera, camisa y flores', { coins: r.coins, v5: r.v5 });
    ok(r.gems === 5 + 20 + r.threatGems && r.v5.gems === 20, 'y 20 gemas por el búho (el gato ya es el cuervo)', { gems: r.gems, v5: r.v5 });
    ok(await p6.waitForFunction(() => !!document.querySelector('.modal.v3-notice'), { timeout: 15000 }).then(() => true, () => false), 'aparece el aviso único');
    const txt = await p6.evaluate(() => document.querySelector('.modal.v3-notice')?.textContent.replace(/\s+/g, ' ') || '');
    ok(/esquife/.test(txt), 'el aviso cuenta que el auto ahora es un esquife', txt.slice(0, 400));
    ok(/pueblos/.test(txt) && /devolvimos/.test(txt) && !/Bruma/.test(txt), 'el aviso cuenta lo de los pueblos y la devolución (y no repite lo de la v4)', txt.slice(0, 400));
    await p6.evaluate(() => document.querySelector('.modal.v3-notice .modal-foot .btn')?.click());
    await sleep(800);
    ok(await run(p6, 'return S.v5.shown === 1'), 'el aviso queda marcado como visto');
    await run(p6, 'P.store.save(); return true;');
    await p6.reload({ waitUntil: 'load' });
    await p6.waitForFunction(() => window.__pixelia?.store?.state && window.__pixelia.ctx.router.current === 'city', { timeout: 30000 });
    await sleep(1500);
    const r2 = await run(p6, 'return { avatar: S.avatar, coins: S.coins, owned: S.owned }');
    ok(JSON.stringify(r2.avatar) === JSON.stringify(r.avatar) && JSON.stringify(r2.owned) === JSON.stringify(r.owned) && r2.coins < r.coins + 2750,
      'la segunda carga no devuelve de nuevo ni cambia nada', { r2, coins: r.coins });
    ok(!(await p6.evaluate(() => !!document.querySelector('.modal.v3-notice'))), 'el aviso no vuelve a salir');
    const model = await p6.evaluate(async () => {
      const A = await import('/src/avatar/avatar.js');
      const m = A.avatarModel({ type: 'chica', hair: 'colitas', dress: 'estrellas', crown: 'sombrero_luna', acc: 'globo' });
      const K = await import('/src/avatar/car.js');
      const sk = K.carModel({ body: 'limusina', wheels: 'flor', topper: 'alas' });
      return { look: m.userData.look, h: m.userData.height, skiff: sk.userData.car };
    });
    ok(model.look.type === 'humano' && model.look.dress === 'archimago' && model.look.crown === 'sombrero_mago' && model.look.acc === 'farolito' && model.h > 0.8 && model.h < 1.4,   // los humanos miden ~3,8 cabezas desde la tercera pasada; con el sombrero de mago llegan a ~1,33
      'un perfil de contacto de antes de v5 se arma con las piezas nuevas', model);
    ok(model.skiff.body === 'barcaza' && model.skiff.wheels === 'vela_doble' && model.skiff.topper === 'cristal',
      'un auto de antes de v5 (de un contacto) se arma como su esquife', model.skiff);
    ok(e6.length === 0, 'sin errores de página', e6);
    await context.close();
  }

  // ===================================================================
  section('Partida nueva: sin aviso ni compensación');
  {
    const { page: p4, context } = await openWithSave(null, '?nosplash&nosw&reset&scene=city');
    const r = await run(p4, `return { v: S.v, v3: S.v3 || null, v4: S.v4 || null, v5: S.v5 || null, mats: Object.keys(S.materials), games: S.games || null }`);
    ok(r.v === 5 && !r.v3 && !r.v4 && !r.v5 && !r.games && r.mats.join() === 'madera,piedra,mineral,hierbas', 'v5 de entrada, solo materiales de región y sin state.games', r);
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
