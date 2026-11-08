// Prueba multi-usuaria del adaptador mock (src/online/net-mock.js) en Chrome headless:
// dos páginas del mismo origen (ana y bea) comparten 'pixelia.mockdb' en localStorage.
//
//   node tools/test-mock.mjs
//
// Cubre: modo off, perfiles, amistad, regalos con límite diario, ayuda, buzón y claim único,
// intercambios (aceptar/rechazar/cancelar, no aceptar dos veces), hallazgos, Expedición del día, cuadrillas, visitas/likes/notas,
// pedidos de ayuda, Obra en Equipo, ranking, días de amistad y sync.js (push/pull + applyGiftPayload).
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
const errors = [];
async function open(query, { emptyConfig = false } = {}) {
  const page = await browser.newPage();
  if (emptyConfig) {
    // Simula un config.js vacío (el real ya apunta al Supabase del proyecto).
    await page.setRequestInterception(true);
    page.on('request', r => r.url().endsWith('/src/online/config.js')
      ? r.respond({ contentType: 'text/javascript', body: "export const SUPABASE_URL = ''; export const SUPABASE_ANON_KEY = '';" })
      : r.continue());
  }
  page.on('pageerror', e => errors.push('PAGEERROR: ' + (e.stack || e.message)));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE.ERROR: ' + m.text()); });
  await page.goto(BASE + query + '&nosplash&nosw', { waitUntil: 'load' });
  await booted(page);
  return page;
}
/** Espera a que el juego termine de arrancar (y en mock, a que entre la sesión de ?mockuser). */
async function booted(page) {
  await page.waitForFunction(() => {
    const P = window.__pixelia, q = new URLSearchParams(location.search);
    return P && P.net && (!q.get('mockuser') || P.net.user);
  }, { timeout: 20000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 300));
}
/** Corre código async en la página con `net`, `m` (net.js) y `sync` (sync.js) disponibles. */
const run = (page, code) => page.evaluate(async (code) => {
  const m = await import('/src/online/net.js');
  const sync = await import('/src/online/sync.js');
  await m.net.init();
  return await new Function('net', 'm', 'sync', `return (async () => { ${code} })()`)(m.net, m, sync);
}, code);

let pass = 0, fail = 0;
const ok = (c, msg, extra) => { if (c) { pass++; console.log('  ✔', msg); } else { fail++; console.log('  ✘', msg, extra !== undefined ? JSON.stringify(extra) : ''); } };
const section = t => console.log('\n■', t);

try {
  // ---------------------------------------------------------------
  section('Modo off');
  const off = await open('?scene=city&reset', { emptyConfig: true });
  const offr = await run(off, `return { mode: net.mode, user: net.user, g: await net.sendGift('x','gift',{}), f: await net.listFriends(), s: await net.signIn('a@b.c','123456') }`);
  ok(offr.mode === 'off' && offr.user === null, 'sin config ni ?mock → modo off, user null');
  ok(offr.g.error === 'Modo sin conexión' && offr.f.error === 'Modo sin conexión' && offr.s.error === 'Modo sin conexión', 'todo devuelve { error: "Modo sin conexión" } sin tirar');
  await off.close();

  // ---------------------------------------------------------------
  section('Dos jugadoras en mock');
  const A = await open('?scene=city&mock=1&mockuser=ana&reset');
  await A.evaluate(() => { localStorage.removeItem('pixelia.mockdb'); localStorage.removeItem('pixelia.sync'); });
  await A.reload({ waitUntil: 'load' });
  await booted(A);
  const B = await open('?scene=city&mock=1&mockuser=bea');
  const a = await run(A, `return { mode: net.mode, user: net.user, p: await net.getMyProfile() }`);
  const b = await run(B, `return { user: net.user, p: await net.getMyProfile() }`);
  ok(a.mode === 'mock' && a.user?.email === 'ana@mock.test' && a.p.name === 'Ana', 'ana entra sola con ?mockuser y tiene perfil');
  ok(b.user?.email === 'bea@mock.test' && b.p.code !== a.p.code && /^[A-HJ-NP-Z2-9]{6}$/.test(b.p.code), 'bea tiene otro código válido');

  section('Cuenta (signUp / signIn / signOut)');
  const C = await open('?scene=city&mock=1');
  ok((await run(C, `return net.user`)) === null, 'sin mockuser no hay sesión');
  ok((await run(C, `return await net.signUp('mal', '123456', 'Cami')`)).error?.includes('email'), 'email inválido → error amable');
  ok((await run(C, `return await net.signUp('cami@x.com', '123', 'Cami')`)).error?.includes('6 caracteres'), 'contraseña corta → error amable');
  ok((await run(C, `return (await net.signUp('cami@x.com', 'secreto1', 'Cami')).user?.email`)) === 'cami@x.com', 'signUp crea la cuenta y entra');
  ok((await run(C, `await net.signOut(); return net.user`)) === null, 'signOut');
  ok((await run(C, `return await net.signIn('cami@x.com', 'mala123')`)).error === 'Email o contraseña incorrectos.', 'contraseña mala → error amable');
  ok((await run(C, `return (await net.signIn('cami@x.com', 'secreto1')).user?.email`)) === 'cami@x.com', 'signIn');
  ok((await run(C, `return await net.signUp('cami@x.com', 'secreto1', 'Cami')`)).error?.includes('Ya hay una cuenta'), 'email repetido → error amable');
  const cId = await run(C, `return net.user.id`);

  section('Amistad');
  ok((await run(A, `return await net.requestFriend('ZZZZZZ')`)).error?.includes('No encontramos'), 'código inexistente → error (sin excepción)');
  ok((await run(A, `return (await net.findByCode(${JSON.stringify(b.p.code.toLowerCase())}))?.name`)) === 'Bea', 'findByCode');
  ok((await run(A, `return (await net.requestFriend(${JSON.stringify(b.p.code)})).status`)) === 'pending', 'ana pide amistad a bea');
  let bf = await run(B, `return await net.listFriends()`);
  ok(bf.length === 1 && bf[0].incoming && bf[0].name === 'Ana', 'bea ve la solicitud entrante');
  ok((await run(B, `return (await net.respondFriend(${JSON.stringify(a.user.id)}, true)).status`)) === 'accepted', 'bea acepta');
  bf = await run(B, `return await net.listFriends()`);
  ok(bf[0].status === 'accepted' && bf[0].friendship.name === 'Saludo', 'lista con nivel de amistad (Saludo)');
  ok((await run(C, `return (await net.requestFriend(${JSON.stringify(a.p.code)})).status`)) === 'pending' &&
     (await run(A, `return (await net.respondFriend(${JSON.stringify(cId)}, true)).status`)) === 'accepted', 'cami y ana amigas');
  const gp = await run(B, `return await net.getProfiles([${JSON.stringify(a.user.id)}, ${JSON.stringify(cId)}])`);
  ok(gp.find(p => p.name === 'Ana').friend === true && gp.find(p => p.name === 'Cami').city === null, 'getProfiles: datos sensibles solo de amigas');

  section('Regalos y buzón');
  ok((await run(A, `return (await net.sendGift(${JSON.stringify(b.user.id)}, 'gift', { coins: 40, items: { hammer: 1 } })).ok`)) === true, 'regalo diario');
  ok((await run(A, `return await net.sendGift(${JSON.stringify(b.user.id)}, 'gift', { coins: 40 })`)).error?.includes('Ya le mandaste'), 'segundo regalo del día falla');
  for (let i = 0; i < 3; i++) await run(B, `return await net.sendGift(${JSON.stringify(a.user.id)}, 'help', { minutes: 15, uid: 1 })`);
  ok((await run(B, `return await net.sendGift(${JSON.stringify(a.user.id)}, 'help', { minutes: 15 })`)).error?.includes('3 veces'), 'ayuda: máximo 3 por día');
  const binbox = await run(B, `return await net.inbox()`);
  ok(binbox.length === 1 && binbox[0].from_name === 'Ana', 'buzón de bea');
  ok((await run(B, `return await net.claimGift(${binbox[0].id})`)).coins === 40, 'claimGift devuelve payload');
  ok((await run(B, `return await net.claimGift(${binbox[0].id})`)) === null, 'claimGift la segunda vez → null');

  section('Intercambios');
  const t1 = await run(A, `return await net.proposeTrade(${JSON.stringify(b.user.id)}, { coins: 100 }, { gems: 2 })`);
  ok(t1.ok, 'ana propone');
  ok((await run(B, `return (await net.listTrades())[0]?.other_name`)) === 'Ana', 'bea lo ve en listTrades');
  // dos aceptaciones simultáneas desde dos pestañas de bea → solo una gana
  const B2 = await open('?scene=city&mock=1&mockuser=bea');
  const [r1, r2] = await Promise.all([run(B, `return await net.respondTrade(${t1.id}, true)`), run(B2, `return await net.respondTrade(${t1.id}, true)`)]);
  ok([r1, r2].filter(r => r.status === 'accepted').length === 1 && [r1, r2].some(r => r.error?.includes('ya fue aceptado')), 'aceptar dos veces a la vez: solo una gana (atómico entre pestañas)', [r1, r2]);
  await B2.close();
  const t2 = await run(A, `return await net.proposeTrade(${JSON.stringify(b.user.id)}, { gems: 3 }, { coins: 5 })`);
  ok((await run(B, `return (await net.respondTrade(${t2.id}, false)).status`)) === 'declined', 'bea rechaza');
  const t3 = await run(A, `return await net.proposeTrade(${JSON.stringify(b.user.id)}, { coins: 9 }, { coins: 1 })`);
  ok((await run(A, `return (await net.cancelTrade(${t3.id})).status`)) === 'cancelled', 'ana cancela');
  ok((await run(B, `return await net.respondTrade(${t3.id}, true)`)).error?.includes('cancelado'), 'no se puede aceptar uno cancelado');
  const ainbox = await run(A, `return await net.inbox()`);
  ok(ainbox.some(g => g.ref === t1.id && g.payload.gems === 2) && ainbox.some(g => g.ref === t2.id && g.payload.gems === 3) && ainbox.some(g => g.ref === t3.id && g.payload.coins === 9), 'entregas y devoluciones en el buzón de ana');

  section('Hallazgos');
  const S = (id, s) => `{ stickers: { ${id}: 1 }, stars: ${s} }`;
  { const g = await run(A, `return await net.proposeTrade(${JSON.stringify(b.user.id)}, { stickers: { g: 1 }, stars: 5, golden: true }, ${S('h', 5)})`);
    ok(g.ok === true, '5★ con golden (Semana Dorada) no exige 14 días');
    if (g.ok) await run(A, `return await net.cancelTrade(${g.id})`); }
  ok((await run(A, `return await net.proposeTrade(${JSON.stringify(b.user.id)}, ${S('a', 2)}, ${S('b', 4)})`)).error?.includes('parecidas'), 'estrellas ±1');
  ok((await run(A, `return await net.proposeTrade(${JSON.stringify(b.user.id)}, ${S('a', 5)}, ${S('b', 5)})`)).error?.includes('14 días'), '5★ requiere 14 días');
  ok((await run(A, `return await net.proposeTrade(${JSON.stringify(b.user.id)}, { stickers: { a: 1 }, stars: 3, coins: 1 }, ${S('b', 3)})`)).error?.includes('solo van hallazgos'), 'no mezclar');
  ok((await run(A, `return (await net.proposeTrade(${JSON.stringify(b.user.id)}, ${S('a', 3)}, ${S('b', 4)})).ok`)) === true, 'hallazgo 3★ por 4★ OK');

  section('Visitas, likes y notas');
  ok((await run(B, `return (await net.visit(${JSON.stringify(a.user.id)})).first`)) === true, 'primera visita → first');
  ok((await run(B, `return (await net.visit(${JSON.stringify(a.user.id)})).first`)) === false, 'segunda → no first');
  ok((await run(B, `return (await net.like(${JSON.stringify(a.user.id)})).ok`)) === true, 'like');
  ok((await run(B, `return await net.like(${JSON.stringify(a.user.id)})`)).error?.includes('Ya le diste'), 'un like por día');
  ok((await run(B, `return (await net.leaveNote(${JSON.stringify(a.user.id)}, '¡Hermosa!')).ok`)) === true, 'nota');
  ok((await run(B, `return await net.leaveNote(${JSON.stringify(a.user.id)}, 'otra')`)).error?.includes('Ya le dejaste'), 'una nota por día');
  const vis = await run(A, `return await net.visitorsToMe()`);
  ok(vis[0]?.name === 'Bea' && vis[0].liked && vis[0].note === '¡Hermosa!' && vis[0].helped === 3, 'visitorsToMe con like, nota y ayudas');
  ok((await run(C, `return await net.visit(${JSON.stringify(b.user.id)})`)).error?.includes('contactos'), 'no se visita a una no amiga');

  section('Pedidos de ayuda');
  const rq = await run(B, `return await net.createRequest('item', { items: { hammer: 1 } }, 1)`);
  ok(rq.ok, 'bea pide un martillo');
  await run(B, `await net.createRequest('coins', { coins: 100 }, 1); await net.createRequest('speedup', { minutes: 30, uid: 1 }, 1);`);
  ok((await run(B, `return await net.createRequest('coins', { coins: 1 }, 1)`)).error?.includes('3 manos'), 'máx 3 por día');
  ok((await run(A, `return (await net.friendRequests()).length`)) === 3, 'ana ve 3 pedidos de bea');
  ok((await run(C, `return (await net.friendRequests()).length`)) === 0, 'cami (no amiga de bea) no ve nada');
  ok((await run(B, `return await net.fillRequest(${rq.id})`)).error?.includes('propio'), 'no podés llenar el tuyo');
  ok((await run(A, `return (await net.fillRequest(${rq.id})).ok`)) === true, 'ana completa el pedido');
  ok((await run(A, `return await net.fillRequest(${rq.id})`)).error?.includes('ya completó'), 'solo una vez');
  ok((await run(B, `return (await net.myRequests()).find(r => r.id === ${rq.id}).filled_by_name`)) === 'Ana', 'myRequests muestra quién ayudó');

  section('Obra en Equipo y ranking');
  ok((await run(A, `return (await net.addCoopPoints(2500)).added`)) === 2000, 'tope 2000 por día');
  await run(B, `return await net.addCoopPoints(300)`);
  const cs = await run(A, `return await net.coopStatus()`);
  ok(cs.total === 2300 && cs.members.length === 3 && cs.week === (await run(A, `return m.isoWeek()`)), 'coopStatus suma ana + amigas', cs);
  await run(B, `return await net.publishProfile({ level: 4, stats: { week: { id: m.isoWeek(), stars: 7 } } })`);
  const lb = await run(A, `return await net.leaderboard()`);
  ok(lb.length === 3 && lb.find(x => x.name === 'Bea').week.stars === 7, 'leaderboard con stats.week');

  section('Expedición del día (espejo de schema.sql)');
  {
    const day = (o = 0) => `new Date(Date.now() + (net._adapter.debug.dump().dayOffset + ${o}) * 864e5).toISOString().slice(0, 10)`;
    ok((await run(A, `return (await net.submitDaily(${day()}, 'bosque', 42, 2, { mats: { madera: 4 }, planos: 1 })).ok`)) === true, 'ana manda su botín de hoy');
    ok((await run(A, `return await net.submitDaily(${day()}, 'bosque', 50, 3)`)).error?.includes('Ya mandaste'), 'una sola vez por día');
    ok((await run(A, `return await net.submitDaily(${day(-2)}, 'bosque', 5)`)).error?.includes('ya cerró'), 'de anteayer → ya cerró');
    ok((await run(B, `return (await net.submitDaily(${day(-1)}, 'sierras', 30, 1)).ok`)) === true, 'la de ayer se acepta');
    ok((await run(B, `return await net.submitDaily(${day()}, 'bosque', 5000, 1)`)).error?.includes('no es válido'), 'botín fuera de rango');
    ok((await run(B, `return await net.submitDaily(${day()}, 'bosque', 5, 4)`)).error?.includes('estrellas'), 'estrellas fuera de 0..3');
    ok((await run(B, `return await net.submitDaily(${day()}, 'Bosque!', 5, 1)`)).error?.includes('región'), 'región inválida');
    ok((await run(B, `return (await net.submitDaily(${day()}, 'bosque', 50, 3)).ok`)) === true, 'bea manda el suyo');
    const db = await run(A, `return await net.dailyBoard()`);
    ok(db.length === 2 && db[0].name === 'Bea' && db[1].me && db[1].score === 42 && db[1].loot.planos === 1, 'ranking del día ordenado por botín', db);
    ok((await run(A, `return (await net.dailyBoard(${day(-1)})).map(r => r.score).join()`)) === '30', 'ranking de ayer');
    ok((await run(C, `return (await net.dailyBoard()).every(r => r.name !== 'Bea')`)) === true, 'cami no ve a bea (no es su contacto)');
  }

  section('Cuadrillas (espejo de schema.sql)');
  {
    const soon = `Date.now() + (net._adapter.debug.dump().dayOffset + 2) * 864e5`;
    await run(B, `return await net.publishProfile({ level: 4, stats: { week: { id: m.isoWeek(), stars: 7 }, threat: { id: '3-1', type: 'crecida', end: ${soon} } } })`);
    const f0 = await run(A, `return (await net.listFriends()).find(f => f.name === 'Bea').points`);
    const c1 = await run(A, `return await net.sendCrew(${JSON.stringify(b.user.id)}, '3-1')`);
    ok(c1.ok && c1.n === 1, 'ana manda una cuadrilla a la crecida de bea', c1);
    ok((await run(A, `return (await net.listFriends()).find(f => f.name === 'Bea').points`)) === f0 + 3, 'suma 3 puntos de amistad');
    ok((await run(A, `return await net.sendCrew(${JSON.stringify(b.user.id)}, '3-1')`)).error?.includes('Ya mandaste una cuadrilla'), 'una por contacto y amenaza');
    ok((await run(A, `return await net.sendCrew(${JSON.stringify(b.user.id)}, '3-2')`)).error?.includes('ya pasó o todavía no'), 'solo la amenaza publicada');
    ok((await run(A, `return await net.sendCrew(${JSON.stringify(b.user.id)}, 'hola')`)).error?.includes('no existe'), 'id inválido');
    ok((await run(A, `return await net.sendCrew(${JSON.stringify(a.user.id)}, '3-1')`)).error?.includes('tu ciudad'), 'no a la propia ciudad');
    ok((await run(C, `return await net.sendCrew(${JSON.stringify(b.user.id)}, '3-1')`)).error?.includes('contactos'), 'solo entre contactos');
    await run(B, `return await net.publishProfile({ level: 4, stats: { week: { id: m.isoWeek(), stars: 7 }, threat: { id: '3-1', type: 'crecida', end: Date.now() - 1000 } } })`);
    ok((await run(A, `return await net.sendCrew(${JSON.stringify(b.user.id)}, '3-1')`)).error?.includes('ya pasó'), 'amenaza terminada → ya pasó (se mira antes que la repetida, como el servidor)');
    await run(B, `return await net.publishProfile({ level: 4, stats: { week: { id: m.isoWeek(), stars: 7 }, threat: { id: '3-2', type: 'crecida', end: Date.now() - 1000 } } })`);
    ok((await run(A, `return await net.sendCrew(${JSON.stringify(b.user.id)}, '3-2')`)).error?.includes('ya pasó'), 'amenaza terminada → ya pasó');
    const mc = await run(B, `return await net.myCrews()`);
    ok(mc.length === 1 && mc[0].helper_name === 'Ana' && mc[0].threat === '3-1', 'bea ve la cuadrilla de ana', mc);
    ok((await run(A, `return (await net.myCrews()).length`)) === 0, 'ana no recibió ninguna');
    await run(B, `return await net.publishProfile({ level: 4, stats: { week: { id: m.isoWeek(), stars: 7 } } })`);
  }

  section('Días de amistad y "mañana"');
  let fa = await run(A, `return (await net.listFriends()).find(f => f.name === 'Bea')`);
  ok(fa.days === 1 && fa.points > 0, `ana-bea: days=${fa.days}, points=${fa.points}`);
  await run(A, `return await net._adapter.debug.advanceDays(1)`);
  ok((await run(A, `return (await net.sendGift(${JSON.stringify(b.user.id)}, 'gift', { coins: 1 })).ok`)) === true, 'al día siguiente se puede regalar de nuevo');
  ok((await run(B, `return (await net.like(${JSON.stringify(a.user.id)})).ok`)) === true, 'y dar like de nuevo');
  fa = await run(A, `return (await net.listFriends()).find(f => f.name === 'Bea')`);
  ok(fa.days === 2, 'días de amistad = 2');

  section('sync.js');
  const sy = await run(A, `
    const st = await sync.initSync({});
    await sync.pushNow();
    const cloud = await net.pullSave();
    const { store } = await import('/src/core/state.js');
    const al = await import('/src/album/album.js');
    const before = { coins: store.state.coins, hammer: store.state.chests?.items?.hammer || 0, st: al.stickerCount('princesas-1') };
    const sum = sync.applyGiftPayload({ coins: 10, gems: 1, items: { hammer: 2, nope: 5 }, stickers: { 'princesas-1': 1 } });
    const after = { coins: store.state.coins, hammer: store.state.chests.items.hammer, st: al.stickerCount('princesas-1') - before.st };
    const ded = sync.deductPayload({ items: { hammer: 1 } });
    const tooMuch = sync.deductPayload({ gems: 1e9 });
    const claimed = await sync.claimAllAndApply();
    const prof = await net.getMyProfile();
    return { st, cloudOk: !!cloud?.data?.city, rev: cloud?.rev, before, after, sum, ded, tooMuch, claimed: claimed.count, likes: claimed.total.likes, prof };
  `);
  ok(sy.st.mode === 'mock' && sy.st.user && sy.st.conflict === null, 'initSync sin conflicto', sy.st);
  ok(sy.cloudOk && sy.rev >= 1, 'la partida se subió a la nube (pullSave)');
  ok(sy.after.coins === sy.before.coins + 10 && sy.after.hammer === sy.before.hammer + 2 && sy.after.st === 1 && !sy.sum.items.nope, 'applyGiftPayload acredita monedas, mochila y figuritas (ignora ids desconocidos)');
  ok(sy.ded === true && sy.tooMuch === false, 'deductPayload descuenta y rechaza si no alcanza');
  ok(sy.claimed > 0 && sy.likes >= 1, `claimAllAndApply cobró ${sy.claimed} regalos`);
  ok(sy.prof.city?.buildings?.length >= 1 && typeof sy.prof.stats?.pop === 'number' && sy.prof.stats.week?.id, 'publishProfile publicó ciudad y stats');

  // conflicto: otro "dispositivo" sube una partida distinta
  const cf = await run(A, `
    const cur = await net.pullSave();
    const other = JSON.parse(JSON.stringify(cur.data)); other.player.level = 30; other.coins = 99999;
    await net.pushSave(other, cur.rev);
    const { store } = await import('/src/core/state.js');
    store.grant({ coins: 1 }); store.save();
    const r = await sync.pushNow();
    return { r, status: sync.getSyncStatus() };
  `);
  ok(cf.r.conflict === true && cf.status.conflict && cf.status.conflictInfo.cloud.level === 30, 'si otro dispositivo guardó, pushNow detecta el conflicto', cf);
  const rs = await run(A, `const r = await sync.resolveConflict('local'); return { r, st: sync.getSyncStatus(), cloud: (await net.pullSave()).data.player.level }`);
  ok(rs.r.ok && !rs.st.conflict && rs.cloud !== 30, 'resolveConflict("local") pisa la nube');
} catch (e) {
  fail++;
  console.log('EXCEPCIÓN', e);
} finally {
  await browser.close();
  server.close();
}
if (errors.length) { console.log('\n=== ERRORES DE PÁGINA ===\n' + [...new Set(errors)].join('\n')); }
console.log(`\n${fail || errors.length ? '✘' : '✔'} ${pass} OK, ${fail} fallas, ${errors.length} errores de página`);
process.exit(fail || errors.length ? 1 : 0);
