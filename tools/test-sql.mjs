// Valida supabase/schema.sql en PGlite (Postgres en Node) simulando Supabase:
// esquema auth mínimo, auth.uid() desde request.jwt.claim.sub y roles anon/authenticated.
//
//   node tools/test-sql.mjs
//
// Las consultas "como usuaria" corren con `set role authenticated` para que RLS aplique de verdad
// (PGlite corre como superusuario, que se saltea RLS).
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SCHEMA = readFileSync(resolve(ROOT, 'supabase/schema.sql'), 'utf8');

const db = new PGlite();
let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; console.log('  ✔', msg); } else { fail++; console.log('  ✘', msg); } };
const section = t => console.log('\n■', t);

// --- Simulación de Supabase ---
await db.exec(`
  create schema if not exists auth;
  create table if not exists auth.users (id uuid primary key, email text);
  create or replace function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
  do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
  grant usage on schema auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  grant usage on schema public to anon, authenticated;
`);

await db.exec(SCHEMA);
await db.exec(SCHEMA); // idempotente: correrlo dos veces no debe fallar
console.log('schema.sql cargado dos veces (idempotente) ✔');

const U = {
  ana: '11111111-1111-4111-8111-111111111111',
  bea: '22222222-2222-4222-8222-222222222222',
  cami: '33333333-3333-4333-8333-333333333333',
};
for (const [n, id] of Object.entries(U)) await db.query('insert into auth.users (id, email) values ($1, $2)', [id, n + '@test.com']);

/** Corre una consulta como la usuaria `who` (rol authenticated). Devuelve {rows} o {error}. */
async function as(who, sql, params = []) {
  try {
    await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [who ? U[who] : '']);
    await db.exec('set role authenticated');
    const r = await db.query(sql, params);
    return { rows: r.rows };
  } catch (e) {
    return { error: e.message };
  } finally {
    await db.exec('reset role');
  }
}
/** Llama una RPC escalar (jsonb) y devuelve su valor o {error}. */
async function rpc(who, fn, args = []) {
  const ph = args.map((_, i) => '$' + (i + 1)).join(', ');
  const r = await as(who, `select public.${fn}(${ph}) as v`, args);
  return r.error ? { error: r.error } : r.rows[0].v;
}
/** RPC que devuelve tabla. */
async function rows(who, fn, args = []) {
  const ph = args.map((_, i) => '$' + (i + 1)).join(', ');
  const r = await as(who, `select * from public.${fn}(${ph})`, args);
  return r.error ? { error: r.error } : r.rows;
}
const su = (sql, p) => db.query(sql, p); // superusuaria (para "viajar en el tiempo")

// ---------------------------------------------------------------------
section('Perfiles');
ok((await rpc(null, 'ensure_profile', ['x'])).error?.includes('iniciar sesión'), 'sin sesión: ensure_profile pide iniciar sesión');
const pa = await rpc('ana', 'ensure_profile', ['Ana']);
const pb = await rpc('bea', 'create_profile', ['Bea']);
const pc = await rpc('cami', 'ensure_profile', ['Cami']);
ok(/^[A-HJ-NP-Z2-9]{6}$/.test(pa.code) && /^[A-HJ-NP-Z2-9]{6}$/.test(pb.code), `códigos válidos sin 0/O/1/I (${pa.code}, ${pb.code}, ${pc.code})`);
ok(new Set([pa.code, pb.code, pc.code]).size === 3, 'códigos únicos');
ok((await rpc('ana', 'ensure_profile', ['Otra'])).code === pa.code, 'ensure_profile es idempotente');
// muchos códigos: sin caracteres ambiguos
const codes = (await su(`select public.gen_code() c from generate_series(1, 2000)`)).rows.map(r => r.c).join('');
ok(!/[01OI]/.test(codes), 'gen_code nunca usa 0/O/1/I (2000 muestras)');
const pub = await rpc('ana', 'publish_profile', [{ name: 'Ana', cityName: 'Rosalandia', level: 7, look: { hair: 'largo' }, car: { body: 'convertible' }, city: { buildings: [{ id: 'castillo', x: 1, z: 1, rot: 0, level: 2 }], expansions: 1, flagColor: 'rosa' }, stats: { pop: 30, week: { id: '2026-W45', match3: 3, stars: 9 } } }]);
ok(pub.level === 7 && pub.city_name === 'Rosalandia', 'publish_profile actualiza nivel y ciudad');
await rpc('bea', 'publish_profile', [{ level: 3, stats: { week: { id: '2026-W45', stars: 4 } } }]);
ok((await rpc('ana', 'publish_profile', [{ city: { big: 'x'.repeat(70000) } }])).error?.includes('demasiado grande'), 'publish_profile rechaza ciudades enormes');
const fbc = await rows('bea', 'find_by_code', [pa.code.toLowerCase()]);
ok(fbc.length === 1 && fbc[0].name === 'Ana' && fbc[0].city === undefined, 'find_by_code (minúsculas) devuelve solo datos públicos');
let gp = await rows('bea', 'get_profiles', [[U.ana]]);
ok(gp[0].name === 'Ana' && gp[0].city === null && gp[0].look === null, 'get_profiles: no amiga → sin columnas sensibles');
ok((await as('bea', 'select * from profiles where id = $1', [U.ana])).rows.length === 0, 'RLS: no amiga no lee la fila de profiles');
ok((await as('ana', `update profiles set level = 99 where id = $1`, [U.ana])).error?.includes('permission denied'), 'no se puede escribir profiles directo (solo por RPC)');

// ---------------------------------------------------------------------
section('Partida en la nube (saves) y RLS');
ok((await rpc('ana', 'pull_save')) === null, 'pull_save sin partida → null');
let ps = await rpc('ana', 'push_save', [{ coins: 100 }, null, false]);
ok(ps.ok && ps.rev === 1, 'push_save primera vez → rev 1');
ps = await rpc('ana', 'push_save', [{ coins: 200 }, 1, false]);
ok(ps.ok && ps.rev === 2, 'push_save con rev correcta → rev 2');
ps = await rpc('ana', 'push_save', [{ coins: 300 }, 1, false]);
ok(ps.conflict === true && ps.rev === 2, 'push_save con rev vieja → conflicto');
ps = await rpc('ana', 'push_save', [{ coins: 300 }, 1, true]);
ok(ps.ok && ps.rev === 3, 'push_save forzado pisa la nube');
const pl = await rpc('ana', 'pull_save');
ok(pl.data.coins === 300 && pl.rev === 3, 'pull_save devuelve data y rev');
await rpc('bea', 'push_save', [{ coins: 5 }, null, false]);
ok((await as('bea', 'select * from saves')).rows.length === 1, 'RLS: bea ve solo su propia partida');
ok((await as('bea', 'select * from saves where user_id = $1', [U.ana])).rows.length === 0, 'RLS: bea NO lee la partida de ana');
ok((await as('bea', `update saves set data = '{"hack":1}' where user_id = $1`, [U.ana])).rows !== undefined
   && (await su('select data from saves where user_id = $1', [U.ana])).rows[0].data.coins === 300, 'RLS: bea no puede modificar la partida de ana');
ok((await as('bea', `insert into saves (user_id, data) values ($1, '{}')`, [U.cami])).error?.includes('row-level security'), 'RLS: no se puede insertar partida ajena');
ok((await as(null, 'select * from saves')).rows.length === 0, 'sin sesión no se ve ninguna partida');

// ---------------------------------------------------------------------
section('Amistad');
ok((await rpc('ana', 'request_friend', [pa.code])).error?.includes('propio código'), 'no podés agregarte a vos misma');
ok((await rpc('ana', 'request_friend', ['ZZZZZZ'])).error?.includes('No encontramos'), 'código inexistente → error amable');
let rf = await rpc('ana', 'request_friend', [pb.code]);
ok(rf.status === 'pending' && rf.name === 'Bea', 'ana pide amistad a bea (pendiente)');
ok((await rpc('ana', 'request_friend', [pb.code])).error?.includes('Ya le mandaste'), 'no se duplica la solicitud');
let fv = await rows('bea', 'friends_view');
ok(fv.length === 1 && fv[0].incoming === true && fv[0].status === 'pending' && fv[0].name === 'Ana', 'bea ve la solicitud entrante');
ok((await rows('ana', 'friends_view'))[0].incoming === false, 'ana la ve como saliente');
ok((await rpc('ana', 'respond_friend', [U.bea, true])).error, 'quien pidió no puede aceptarse a sí misma');
ok((await rpc('bea', 'send_gift', [U.ana, 'gift', { coins: 50 }])).error?.includes('contactos'), 'antes de aceptar no se pueden mandar regalos');
ok((await rpc('bea', 'respond_friend', [U.ana, true])).status === 'accepted', 'bea acepta');
ok((await rpc('cami', 'request_friend', [pa.code])).status === 'pending', 'cami pide amistad a ana');
ok((await rpc('ana', 'request_friend', [pc.code])).status === 'accepted', 'si las dos se piden, se acepta sola');
ok((await rpc('bea', 'request_friend', [pc.code])).status === 'pending', 'bea pide a cami');
ok((await rpc('cami', 'respond_friend', [U.bea, false])).status === 'declined', 'cami rechaza a bea');
ok((await rows('bea', 'friends_view')).length === 1, 'tras rechazar la solicitud desaparece');
ok((await rpc('ana', 'is_friend', [U.ana, U.bea])) === true && (await rpc('bea', 'is_friend', [U.bea, U.cami])) === false, 'is_friend');
ok((await rpc('cami', 'is_friend', [U.ana, U.bea])) === false, 'is_friend no responde sobre pares ajenos');
gp = await rows('bea', 'get_profiles', [[U.ana]]);
ok(gp[0].city?.expansions === 1 && gp[0].look?.hair === 'largo' && gp[0].friend === true, 'amiga: get_profiles trae ciudad y look');
ok((await as('bea', 'select city from profiles where id = $1', [U.ana])).rows.length === 1, 'RLS: amiga lee el perfil completo');
ok((await as('bea', 'select * from profiles where id = $1', [U.cami])).rows.length === 0, 'RLS: no amiga (cami) sigue oculta');
ok((await as('cami', 'select * from friendships')).rows.length === 1, 'RLS friendships: cami ve solo sus filas');
ok((await rpc('bea', 'bump_friendship', [U.ana, U.bea, 1000])).error?.includes('permission denied'), 'bump_friendship no es llamable desde el cliente');
ok((await rpc('bea', 'pair_lock', [U.ana, U.bea])).error?.includes('permission denied'), 'pair_lock no es llamable desde el cliente');

// ---------------------------------------------------------------------
section('Regalos y buzón');
let g1 = await rpc('ana', 'send_gift', [U.bea, 'gift', { coins: 50, items: { hammer: 1 } }]);
ok(g1.ok && g1.id, 'ana manda regalo diario a bea');
ok((await rpc('ana', 'send_gift', [U.bea, 'gift', { coins: 50 }])).error?.includes('Ya le mandaste el regalo de hoy'), 'el segundo regalo del día falla');
ok((await rpc('ana', 'send_gift', [U.cami, 'gift', { coins: 50 }])).ok, 'pero a otra amiga sí');
ok((await rpc('ana', 'send_gift', [U.bea, 'gift', { coins: -5 }])).error?.includes('no son válidos'), 'payload con montos negativos rechazado');
ok((await rpc('ana', 'send_gift', [U.bea, 'trade', { coins: 5 }])).error?.includes('no existe'), 'no se pueden fabricar entregas de intercambio');
ok((await rpc('ana', 'send_gift', [U.ana, 'gift', {}])).error, 'no te podés regalar a vos misma');
ok((await as('ana', `insert into gifts (from_id, to_id, kind) values ($1, $2, 'gift')`, [U.ana, U.bea])).error?.includes('permission denied'), 'no se puede insertar gifts directo');
for (let i = 0; i < 3; i++) await rpc('bea', 'send_gift', [U.ana, 'help', { minutes: 15, uid: 1 + i }]);
ok((await rpc('bea', 'send_gift', [U.ana, 'help', { minutes: 15 }])).error?.includes('3 veces'), 'ayuda: la 4ª del día falla');
let inbox = await rows('bea', 'my_inbox');
ok(inbox.length === 1 && inbox[0].from_name === 'Ana' && inbox[0].kind === 'gift', 'bea tiene 1 regalo en el buzón');
ok((await as('cami', 'select * from gifts where to_id = $1', [U.bea])).rows.length === 0, 'RLS gifts: cami no ve regalos de otras');
const c1 = await rpc('bea', 'claim_gift', [inbox[0].id]);
ok(c1?.coins === 50 && c1.items.hammer === 1, 'claim_gift devuelve el payload');
ok((await rpc('bea', 'claim_gift', [inbox[0].id])) === null, 'claim_gift la segunda vez → null');
const ainbox = await rows('ana', 'my_inbox');
ok((await rpc('cami', 'claim_gift', [ainbox[0].id])) === null, 'otra usuaria no puede cobrar un regalo ajeno');
// día siguiente: se puede regalar de nuevo
await su(`update gifts set day = day - 1`);
ok((await rpc('ana', 'send_gift', [U.bea, 'gift', { coins: 50 }])).ok, 'al día siguiente se puede regalar otra vez');
ok((await rpc('ana', 'send_gift', [U.bea, 'sticker', { stickers: { s1: 1 } }])).ok, 'regalo de hallazgo');

// ---------------------------------------------------------------------
section('Intercambios');
let t1 = await rpc('ana', 'propose_trade', [U.bea, { coins: 100 }, { items: { hammer: 1 } }]);
ok(t1.ok, 'ana propone intercambio a bea');
ok((await rpc('ana', 'respond_trade', [t1.id, true])).error?.includes('No encontramos'), 'quien propone no puede aceptar su propio intercambio');
let r1 = await rpc('bea', 'respond_trade', [t1.id, true]);
ok(r1.status === 'accepted' && r1.request.items.hammer === 1, 'bea acepta (devuelve lo que tiene que descontar)');
ok((await rpc('bea', 'respond_trade', [t1.id, true])).error?.includes('ya fue aceptado'), 'no se puede aceptar dos veces');
ok((await rpc('ana', 'cancel_trade', [t1.id])).error?.includes('no se puede cancelar'), 'no se puede cancelar uno aceptado');
let bi = (await rows('bea', 'my_inbox')).filter(g => g.kind === 'trade');
let ai = (await rows('ana', 'my_inbox')).filter(g => g.kind === 'trade');
ok(bi.length === 1 && bi[0].payload.coins === 100 && ai.length === 1 && ai[0].payload.items.hammer === 1, 'entregas creadas para ambas partes');
let t2 = await rpc('ana', 'propose_trade', [U.bea, { gems: 5 }, { coins: 10 }]);
ok((await rpc('bea', 'respond_trade', [t2.id, false])).status === 'declined', 'bea rechaza');
ai = (await rows('ana', 'my_inbox')).filter(g => g.ref === t2.id);
ok(ai.length === 1 && ai[0].payload.gems === 5 && ai[0].note.includes('rechazado'), 'rechazo → devolución a ana');
ok((await rpc('bea', 'respond_trade', [t2.id, true])).error?.includes('rechazado'), 'no se puede aceptar uno rechazado');
let t3 = await rpc('ana', 'propose_trade', [U.bea, { coins: 7 }, { coins: 8 }]);
ok((await rpc('bea', 'cancel_trade', [t3.id])).error, 'la destinataria no puede cancelar');
ok((await rpc('ana', 'cancel_trade', [t3.id])).status === 'cancelled', 'ana cancela');
ok((await rpc('bea', 'respond_trade', [t3.id, true])).error?.includes('cancelado'), 'no se puede aceptar uno cancelado');
ok((await rows('ana', 'my_inbox')).some(g => g.ref === t3.id && g.payload.coins === 7), 'cancelación → devolución');
ok((await rpc('ana', 'propose_trade', [U.cami, {}, {}])).error?.includes('vacío'), 'intercambio vacío rechazado');
const pend = [];
for (let i = 0; i < 5; i++) pend.push(await rpc('ana', 'propose_trade', [U.cami, { coins: 1 }, { coins: 1 }]));
ok(pend.every(p => p.ok), '5 intercambios pendientes OK');
ok((await rpc('ana', 'propose_trade', [U.cami, { coins: 1 }, { coins: 1 }])).error?.includes('5 intercambios'), 'el 6º pendiente falla');
let lt = await rows('cami', 'list_trades');
ok(lt.length === 5 && lt[0].other_name === 'Ana' && lt[0].outgoing === false, 'list_trades para cami');
for (const p of pend) await rpc('ana', 'cancel_trade', [p.id]);
ok((await as('bea', 'select * from trades where to_id = $1', [U.cami])).rows.length === 0, 'RLS trades: bea no ve intercambios ajenos');

// ---------------------------------------------------------------------
section('Hallazgos');
const S = (id, stars) => ({ stickers: { [id]: 1 }, stars });
ok((await rpc('ana', 'propose_trade', [U.bea, { ...S('a', 3), coins: 5 }, S('b', 3)])).error?.includes('solo van hallazgos'), 'no se mezcla con monedas');
ok((await rpc('ana', 'propose_trade', [U.bea, S('a', 3), { coins: 5 }])).error, 'hallazgo por monedas rechazado');
ok((await rpc('ana', 'propose_trade', [U.bea, { stickers: { a: 2 }, stars: 3 }, S('b', 3)])).error?.includes('de a un hallazgo'), 'solo 1 hallazgo por lado');
ok((await rpc('ana', 'propose_trade', [U.bea, S('a', 2), S('b', 4)])).error?.includes('parecidas'), 'estrellas fuera de ±1 rechazado');
ok((await rpc('ana', 'propose_trade', [U.bea, S('a', 5), S('b', 4)])).error?.includes('14 días'), '5 estrellas exige 14 días de amistad');
{ const g = await rpc('ana', 'propose_trade', [U.bea, { ...S('g', 5), golden: true }, S('h', 5)]);
  ok(g.ok === true, '5 estrellas con golden (Semana Dorada) no exige 14 días');
  if (g.ok) await rpc('ana', 'cancel_trade', [g.id]); }
await su(`update friendships set days = 14 where a = least($1::uuid, $2::uuid) and b = greatest($1::uuid, $2::uuid)`, [U.ana, U.bea]);
const st1 = await rpc('ana', 'propose_trade', [U.bea, S('a', 5), S('b', 4)]);
ok(st1.ok, 'con 14 días sí se puede 5★');
ok((await rpc('bea', 'respond_trade', [st1.id, true])).status === 'accepted', 'bea acepta el hallazgo');
for (let i = 0; i < 4; i++) { const t = await rpc('ana', 'propose_trade', [U.bea, S('x' + i, 2), S('y' + i, 2)]); if (t.ok) await rpc('ana', 'cancel_trade', [t.id]); }
ok((await rpc('ana', 'propose_trade', [U.bea, S('z', 2), S('w', 2)])).error?.includes('5 intercambios de hallazgos'), 'límite 5 intercambios de hallazgos por día');

// ---------------------------------------------------------------------
section('Visitas, likes y notas');
let v = await rpc('cami', 'visit', [U.ana]);
ok(v.first === true, 'primera visita del día → first');
ok((await rpc('cami', 'visit', [U.ana])).first === false, 'segunda visita → no first');
ok((await rpc('bea', 'visit', [U.cami])).error?.includes('contactos'), 'no se puede visitar a una no amiga');
ok((await rpc('cami', 'give_like', [U.ana])).ok, 'like');
ok((await rpc('cami', 'give_like', [U.ana])).error?.includes('Ya le diste'), 'segundo like del día falla');
ok((await rpc('cami', 'leave_note', [U.ana, 'x'.repeat(81)])).error?.includes('80'), 'nota de más de 80 letras rechazada');
ok((await rpc('cami', 'leave_note', [U.ana, '¡Qué linda ciudad!'])).ok, 'deja nota');
ok((await rpc('cami', 'leave_note', [U.ana, 'otra'])).error?.includes('Ya le dejaste'), 'una nota por día');
let vt = await rows('ana', 'visitors_to_me', [null]);
ok(vt.length >= 1 && vt.find(x => x.id === U.cami)?.liked && vt.find(x => x.id === U.cami)?.note === '¡Qué linda ciudad!', 'visitors_to_me trae likes y notas');
ok((await rows('ana', 'my_inbox')).some(g => g.kind === 'like' && g.from_name === 'Cami'), 'el like llega al buzón');
ok((await as('bea', 'select * from visits where host = $1 and visitor = $2', [U.ana, U.cami])).rows.length === 0, 'RLS visits: bea no ve visitas ajenas');
await su(`update visits set day = day - 1`);
ok((await rpc('cami', 'visit', [U.ana])).first === true && (await rpc('cami', 'give_like', [U.ana])).ok, 'al día siguiente: visita y like de nuevo');

// ---------------------------------------------------------------------
section('Puntos y días de amistad');
const fr = (await su(`select * from friendships where a = least($1::uuid, $2::uuid) and b = greatest($1::uuid, $2::uuid)`, [U.ana, U.cami])).rows[0];
ok(fr.points > 0 && fr.days === 1, `ana-cami: points=${fr.points}, days=${fr.days} (1 día aunque haya muchas interacciones)`);
await su(`update friendships set last_day = current_date - 1`);
await rpc('cami', 'leave_note', [U.ana, 'hola de nuevo']);
const fr2 = (await su(`select days from friendships where a = least($1::uuid, $2::uuid) and b = greatest($1::uuid, $2::uuid)`, [U.ana, U.cami])).rows[0];
ok(fr2.days === 2, 'otro día calendario suma otro día de amistad');
const fva = await rows('ana', 'friends_view');
ok(fva.every(f => typeof f.days === 'number') && fva.find(f => f.id === U.cami).days === 2, 'friends_view devuelve days');

// ---------------------------------------------------------------------
section('Pedidos de ayuda');
const rq = await rpc('bea', 'create_request', ['item', { items: { hammer: 1 } }, 1]);
ok(rq.ok && rq.id, 'bea pide un martillo');
await rpc('bea', 'create_request', ['coins', { coins: 200 }, 1]);
await rpc('bea', 'create_request', ['speedup', { minutes: 30, uid: 2 }, 1]);
ok((await rpc('bea', 'create_request', ['coins', { coins: 1 }, 1])).error?.includes('3 manos'), 'máx 3 pedidos por día');
ok((await rpc('bea', 'create_request', ['magia', {}, 1])).error, 'tipo de pedido inválido');
let frq = await rows('ana', 'list_friend_requests');
ok(frq.length === 3 && frq[0].from_name === 'Bea', 'ana ve los 3 pedidos de bea');
ok((await rows('cami', 'list_friend_requests')).length === 0, 'cami (no amiga de bea) no los ve');
ok((await as('cami', 'select * from requests')).rows.length === 0, 'RLS requests: cami no lee pedidos de no amigas');
ok((await rpc('bea', 'fill_request', [rq.id])).error?.includes('propio'), 'no podés llenar tu propio pedido');
ok((await rpc('cami', 'fill_request', [rq.id])).error?.includes('contactos'), 'una no amiga no puede llenarlo');
const fl = await rpc('ana', 'fill_request', [rq.id]);
ok(fl.ok && fl.payload.items.hammer === 1, 'ana completa el pedido');
ok((await rpc('ana', 'fill_request', [rq.id])).error?.includes('ya completó'), 'no se puede completar dos veces');
const bfill = (await rows('bea', 'my_inbox')).find(g => g.kind === 'request_fill');
ok(bfill && bfill.payload.items.hammer === 1 && bfill.payload.request.id === rq.id, 'a bea le llega request_fill al buzón');
const mr = await rows('bea', 'my_requests');
ok(mr.length === 3 && mr.find(r => r.id === rq.id).filled_by_name === 'Ana', 'my_requests muestra quién ayudó');
await su(`update requests set expires_at = now() - interval '1 minute' where id <> $1`, [rq.id]);
ok((await rows('ana', 'list_friend_requests')).length === 0, 'los vencidos no aparecen');
ok((await rpc('ana', 'fill_request', [frq.find(r => r.id !== rq.id).id])).error?.includes('venció'), 'no se puede llenar un pedido vencido');

// ---------------------------------------------------------------------
section('Obra en Equipo');
let cp = await rpc('ana', 'add_coop_points', [500]);
ok(cp.added === 500 && /^\d{4}-W\d{2}$/.test(cp.week), `ana suma 500 (semana ${cp.week})`);
cp = await rpc('ana', 'add_coop_points', [1800]);
ok(cp.added === 1500 && cp.capped === true, 'tope 2000 por día');
await rpc('bea', 'add_coop_points', [300]);
await rpc('cami', 'add_coop_points', [100]);
let cs = await rpc('ana', 'coop_status', [null]);
ok(cs.mine === 2000 && cs.total === 2400 && cs.members.length === 3, `coop_status de ana: total=${cs.total} (ella + bea + cami)`);
cs = await rpc('bea', 'coop_status', [null]);
ok(cs.total === 2300 && cs.members.length === 2, 'coop_status de bea: solo ella + ana (cami no es amiga)');
ok((await rpc('ana', 'add_coop_points', [-5])).error, 'puntos negativos rechazados');
ok((await as('bea', 'select * from coop where user_id = $1', [U.cami])).rows.length === 0, 'RLS coop: bea no ve a cami');

// ---------------------------------------------------------------------
section('Ranking semanal');
let lb = await rows('ana', 'friends_leaderboard', ['2026-W45']);
ok(lb.length === 3 && lb.find(x => x.me).week.stars === 9 && lb.find(x => x.id === U.bea).week.stars === 4, 'ranking con stats.week de amigas');
lb = await rows('ana', 'friends_leaderboard', ['2026-W01']);
ok(lb.every(x => x.week === null), 'semana distinta → week null');
ok((await rows('bea', 'friends_leaderboard', [null])).length === 2, 'bea ve solo a sus amigas');

// ---------------------------------------------------------------------
section('Expedición del día');
{
  const { d: today, y: yest, o: old } = (await su(`select current_date::text d, (current_date - 1)::text y, (current_date - 2)::text o`)).rows[0];
  const loot = { mats: { madera: 4, piedra: 2 }, planos: 1, finds: 1 };
  ok((await rpc('ana', 'submit_daily', [today, 'bosque', 42, 2, loot])).ok, 'ana manda su botín de hoy');
  ok((await rpc('ana', 'submit_daily', [today, 'bosque', 99, 3, {}])).error?.includes('Ya mandaste'), 'una sola vez por día (la primera manda)');
  ok((await rpc('ana', 'submit_daily', [old, 'bosque', 10, 1, {}])).error?.includes('ya cerró'), 'de anteayer → ya cerró');
  ok((await rpc('bea', 'submit_daily', [yest, 'sierras', 30, 1, {}])).ok, 'la de ayer todavía se acepta (terminó después de medianoche)');
  ok((await rpc('bea', 'submit_daily', [today, 'bosque', 5000, 1, {}])).error?.includes('no es válido'), 'botín fuera de rango rechazado');
  ok((await rpc('bea', 'submit_daily', [today, 'Bosque!', 5, 1, {}])).error?.includes('región'), 'región inválida rechazada');
  ok((await rpc('bea', 'submit_daily', [today, 'bosque', 5, 4, {}])).error?.includes('estrellas'), 'estrellas fuera de 0..3 rechazadas');
  ok((await rpc('bea', 'submit_daily', [today, 'bosque', 50, 3, { coins: -1 }])).error, 'loot con números negativos rechazado');
  ok((await rpc('bea', 'submit_daily', [today, 'bosque', 50, 3, {}])).ok, 'bea manda el suyo');
  ok((await rpc('cami', 'submit_daily', [today, 'bosque', 10, 0, {}])).ok, 'cami manda el suyo');
  let db = await rows('ana', 'daily_board', [null]);
  ok(db.length === 3 && db[0].name === 'Bea' && db[1].me && db[1].score === 42 && db[1].loot.planos === 1, 'ana ve el ranking de hoy ordenado por botín (ella + sus contactos)', db.map(r => [r.name, r.score]));
  db = await rows('bea', 'daily_board', [null]);
  ok(db.length === 2 && !db.some(r => r.name === 'Cami'), 'bea no ve a cami (no es su contacto)');
  db = await rows('ana', 'daily_board', [yest]);
  ok(db.length === 1 && db[0].score === 30 && db[0].region === 'sierras', 'ranking de ayer');
  ok((await as('bea', 'select * from daily_runs where user_id = $1', [U.cami])).rows.length === 0, 'RLS daily_runs: bea no ve las filas de cami');
  ok((await as('ana', `insert into daily_runs (user_id, day, region, score) values ($1, current_date + 1, 'bosque', 1)`, [U.ana])).error?.includes('permission denied'), 'nadie inserta directo en daily_runs');
}

// ---------------------------------------------------------------------
section('Cuadrillas para la amenaza de un contacto');
{
  const soon = Date.now() + 2 * 864e5;
  await rpc('bea', 'publish_profile', [{ level: 3, stats: { week: { id: '2026-W45', stars: 4 }, threat: { id: '3-1', type: 'crecida', end: soon } } }]);
  const pts = async () => (await su('select points from friendships where a = least($1::uuid, $2::uuid) and b = greatest($1::uuid, $2::uuid)', [U.ana, U.bea])).rows[0].points;
  const p0 = await pts();
  const c1 = await rpc('ana', 'send_crew', [U.bea, '3-1']);
  ok(c1.ok && c1.n === 1, 'ana manda una cuadrilla a la crecida de bea');
  ok((await pts()) === p0 + 3, 'la cuadrilla suma 3 puntos de amistad');
  ok((await rpc('ana', 'send_crew', [U.bea, '3-1'])).error?.includes('Ya mandaste una cuadrilla'), 'una por contacto y amenaza');
  ok((await rpc('ana', 'send_crew', [U.bea, '3-2'])).error?.includes('ya pasó o todavía no'), 'solo para la amenaza que publica el contacto');
  ok((await rpc('ana', 'send_crew', [U.bea, 'hola'])).error?.includes('no existe'), 'id de amenaza inválido');
  ok((await rpc('ana', 'send_crew', [U.ana, '3-1'])).error?.includes('tu ciudad'), 'no a la propia ciudad');
  ok((await rpc('cami', 'send_crew', [U.bea, '3-1'])).error?.includes('contactos'), 'solo entre contactos');
  await rpc('cami', 'publish_profile', [{ level: 2, stats: { threat: { id: '3-1', type: 'incendio', end: Date.now() - 1000 } } }]);
  ok((await rpc('ana', 'send_crew', [U.cami, '3-1'])).error?.includes('ya pasó'), 'amenaza terminada → ya pasó');
  // tope para quien recibe: 3 por amenaza (dos cuadrillas más de otras personas, cargadas directo)
  const X1 = '44444444-4444-4444-8444-444444444444', X2 = '55555555-5555-4555-8555-555555555555';
  await su(`insert into auth.users (id, email) values ($1, 'dani@test.com'), ($2, 'eli@test.com')`, [X1, X2]);
  await su(`insert into crews (helper, host, threat) values ($1, $3, '3-1'), ($2, $3, '3-1')`, [X1, X2, U.bea]);
  await su(`insert into friendships (a, b, status, requested_by) values (least($1::uuid, $2::uuid), greatest($1::uuid, $2::uuid), 'accepted', $1)`, [U.cami, U.bea]);
  ok((await rpc('cami', 'send_crew', [U.bea, '3-1'])).error?.includes('todas las cuadrillas'), 'quien recibe junta como mucho 3 por amenaza');
  // tope para quien ayuda: 3 por día
  await su(`insert into crews (helper, host, threat) values ($1, $2, '9-0'), ($1, $3, '9-1')`, [U.ana, X1, X2]);
  await rpc('cami', 'publish_profile', [{ level: 2, stats: { threat: { id: '3-2', type: 'incendio', end: soon } } }]);
  ok((await rpc('ana', 'send_crew', [U.cami, '3-2'])).error?.includes('3 cuadrillas hoy'), 'quien ayuda manda como mucho 3 por día');
  await su(`delete from friendships where a = least($1::uuid, $2::uuid) and b = greatest($1::uuid, $2::uuid)`, [U.cami, U.bea]);
  const mc = await rows('bea', 'my_crews', [null]);
  ok(mc.length === 3 && mc.some(c => c.helper_name === 'Ana' && c.threat === '3-1'), 'bea ve las cuadrillas que le mandaron', mc);
  ok((await rows('ana', 'my_crews', [null])).length === 0, 'ana no recibió ninguna');
  ok((await as('cami', 'select * from crews where host = $1', [U.bea])).rows.length === 0, 'RLS crews: cami no ve las de bea');
  ok((await as('bea', 'select * from crews where host = $1', [U.bea])).rows.length === 3, 'RLS crews: bea ve las suyas');
  ok((await as('ana', `insert into crews (helper, host, threat) values ($1, $2, '1-0')`, [U.ana, U.bea])).error?.includes('permission denied'), 'nadie inserta directo en crews');
}

// ---------------------------------------------------------------------
section('Fin de amistad');
const tpend = await rpc('ana', 'propose_trade', [U.cami, { gems: 3 }, { coins: 1 }]);
ok((await rpc('cami', 'remove_friend', [U.ana])).ok, 'cami borra a ana');
ok((await su('select status from trades where id = $1', [tpend.id])).rows[0].status === 'cancelled', 'intercambios pendientes se cancelan');
ok((await rows('ana', 'my_inbox')).some(g => g.ref === tpend.id && g.payload.gems === 3), '…con devolución a quien ofreció');
ok((await rpc('ana', 'send_gift', [U.cami, 'gift', {}])).error?.includes('contactos'), 'ya no se pueden mandar regalos');
ok((await rows('ana', 'get_profiles', [[U.cami]]))[0].city === null, 'ya no se ve su ciudad');

// ---------------------------------------------------------------------
section('Cobrar todo');
const all = await rpc('ana', 'claim_all_gifts');
ok(Array.isArray(all) && all.length > 0, `claim_all_gifts cobra ${all.length} regalos`);
ok((await rows('ana', 'my_inbox')).length === 0 && (await rpc('ana', 'claim_all_gifts')).length === 0, 'el buzón queda vacío');

// ---------------------------------------------------------------------
section('anon');
ok((await (async () => { try { await db.query(`select set_config('request.jwt.claim.sub', '', false)`); await db.exec('set role anon'); await db.query('select public.friends_view()'); return false; } catch (e) { return e.message.includes('permission denied'); } finally { await db.exec('reset role'); } })()), 'anon no puede llamar RPCs');

// ---------------------------------------------------------------------
section('Métricas anónimas (events)');
/** Corre una consulta con el rol anon (sin sesión). */
async function asAnon(sql, params = []) {
  try {
    await db.query(`select set_config('request.jwt.claim.sub', '', false)`);
    await db.exec('set role anon');
    const r = await db.query(sql, params);
    return { rows: r.rows, affected: r.affectedRows };
  } catch (e) { return { error: e.message }; } finally { await db.exec('reset role'); }
}
const EV = `insert into public.events (anon_id, session_id, name, props, version) values ($1, $2, $3, $4, $5)`;
const A1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', S1 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
ok(!(await asAnon(EV, [A1, S1, 'session_start', { days: 0 }, '1.0.0'])).error, 'anon puede insertar un evento');
ok(!(await as('ana', EV, [A1, S1, 'level:up', { level: 3 }, '1.0.0'])).error, 'con sesión también puede insertar');
ok(!(await asAnon(`insert into public.events (anon_id, session_id, name) values ($1, $2, 'x'), ($1, $2, 'y')`, [A1, S1])).error, 'se insertan tandas de varias filas');
ok((await su('select count(*)::int n from public.events')).rows[0].n === 4, 'las filas quedan guardadas');
const sel = await asAnon('select * from public.events');
ok(sel.error?.includes('permission denied'), 'anon NO puede leer events', sel);
ok((await as('ana', 'select * from public.events')).error?.includes('permission denied'), 'con sesión tampoco puede leer events');
ok((await asAnon(`update public.events set name = 'hack'`)).error?.includes('permission denied'), 'anon NO puede actualizar events');
ok((await as('ana', `update public.events set name = 'hack'`)).error?.includes('permission denied'), 'con sesión tampoco puede actualizar');
ok((await asAnon('delete from public.events')).error?.includes('permission denied'), 'anon NO puede borrar events');
ok((await as('bea', 'delete from public.events')).error?.includes('permission denied'), 'con sesión tampoco puede borrar');
ok((await su('select count(*)::int n from public.events')).rows[0].n === 4, 'nada se borró ni cambió');
ok((await asAnon(`insert into public.events (anon_id, session_id, name, created_at) values ($1, $2, 'x', now() - interval '1 year')`, [A1, S1])).error?.includes('permission denied'), 'no se puede elegir created_at (la hora la pone el servidor)');
ok((await asAnon(`insert into public.events (id, anon_id, session_id, name) values (999999, $1, $2, 'x')`, [A1, S1])).error?.includes('permission denied'), 'no se puede elegir el id');
ok((await asAnon(EV, [A1, S1, 'x'.repeat(40), {}, null])).error?.includes('check'), 'nombre de 40 caracteres o más → rechazado');
ok(!(await asAnon(EV, [A1, S1, 'x'.repeat(39), {}, null])).error, 'nombre de 39 caracteres → ok');
ok((await asAnon(EV, [A1, S1, 'Hola mundo', {}, null])).error?.includes('check'), 'nombre con espacios o mayúsculas → rechazado');
ok((await asAnon(EV, [A1, S1, 'big', { s: 'x'.repeat(2100) }, null])).error?.includes('check'), 'props de 2 KB o más → rechazado');
ok(!(await asAnon(EV, [A1, S1, 'mid', { s: 'x'.repeat(1900) }, null])).error, 'props de casi 2 KB → ok');
ok((await asAnon(EV, [A1, S1, 'arr', [1, 2], null])).error?.includes('check'), 'props tiene que ser un objeto');
ok((await asAnon(EV, [A1, S1, 'ver', {}, 'v'.repeat(41)])).error?.includes('check'), 'versión larguísima → rechazada');
ok((await asAnon(EV, ['no-es-uuid', S1, 'x', {}, null])).error, 'anon_id tiene que ser un uuid');

console.log(`\n${fail ? '✘' : '✔'} ${pass} OK, ${fail} fallas`);
process.exit(fail ? 1 : 0);
