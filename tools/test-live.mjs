// Prueba contra el Supabase real configurado en src/online/config.js, usando el mismo
// src/online/net.js del juego (corre en Node, sin navegador).
// Crea dos cuentas de prueba nuevas (correo @example.com al azar) y recorre lo social:
// perfil, amistad por código, regalo, visita + like + notita, guardado en la nube y ranking.
//
//   node tools/test-live.mjs
//
// (net.js devuelve el dato directo o {error}.)
// Las cuentas quedan en Authentication → Users del proyecto (se pueden borrar desde ahí).
import { randomBytes } from 'node:crypto';

const mem = new Map();
globalThis.localStorage ??= { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k), clear: () => mem.clear(), key: i => [...mem.keys()][i] ?? null, get length() { return mem.size; } };
globalThis.location ??= new URL('http://127.0.0.1/');

const { net } = await import('../src/online/net.js');
const tag = randomBytes(4).toString('hex');
const pw = randomBytes(12).toString('base64url');
const A = { email: `pixelia-a-${tag}@example.com`, name: 'Prueba A' };
const B = { email: `pixelia-b-${tag}@example.com`, name: 'Prueba B' };

let okN = 0, failN = 0;
const show = (good, name, detail = '') => { good ? okN++ : failN++; console.log(`${good ? 'OK   ' : 'FALLA'} ${name}${detail ? '  · ' + detail : ''}`); };
const step = async (name, p) => { const r = await p; show(r && !r.error, name, r?.error ? String(r.error) : ''); return r; };
const wait = ms => new Promise(r => setTimeout(r, ms));

await net.init();
console.log('modo:', net.mode);
if (net.mode !== 'supabase') { console.log('config.js no tiene URL/clave de Supabase'); process.exit(1); }

await step('A crea cuenta', net.signUp(A.email, pw, A.name));
await wait(800);
await step('A publica perfil', net.publishProfile({ name: A.name, city: 'Villa A', level: 3, look: { type: 'chica' }, theme: 'musgo', buildings: [] }));
const meA = await step('A lee su perfil', net.getMyProfile());
const code = meA?.code, aId = meA?.id;
show(!!code, 'A tiene código de amistad', code || '');
await step('A sube partida', net.pushSave({ coins: 123, test: tag }));
const pulled = await step('A baja partida', net.pullSave());
show(JSON.stringify(pulled ?? '').includes(tag), 'la partida en la nube coincide');
await net.signOut();

await step('B crea cuenta', net.signUp(B.email, pw, B.name));
await wait(800);
await step('B publica perfil', net.publishProfile({ name: B.name, city: 'Villa B', level: 2, look: { type: 'chico' }, theme: 'bruma', buildings: [] }));
const found = await step('B busca a A por código', net.findByCode(code));
show(!!aId && found?.id === aId, 'el código lleva a A');
await step('B pide amistad', net.requestFriend(code));
const bId = (await net.getMyProfile())?.id;
await net.signOut();

await step('A inicia sesión', net.signIn(A.email, pw));
await step('A acepta amistad', net.respondFriend(bId, true));
const fr = await step('A lista amigos', net.listFriends());
show(JSON.stringify(fr ?? []).includes(bId), 'B aparece en amigos de A');
await step('A manda regalo a B', net.sendGift(bId, 'gift', {}));
await net.signOut();

await step('B inicia sesión', net.signIn(B.email, pw));
const inbox = await step('B mira buzón', net.inbox());
show((Array.isArray(inbox) ? inbox : []).length > 0, 'B recibió el regalo', `items: ${(Array.isArray(inbox) ? inbox : []).length}`);
if (inbox?.[0]) await step('B cobra regalo', net.claimGift(inbox[0].id));
await step('B visita a A', net.visit(aId));
await step('B da like', net.like(aId));
await step('B deja notita', net.leaveNote(aId, '¡Linda ciudad!'));
await step('B suma puntos de equipo', net.addCoopPoints(10));
await step('B ve ranking', net.leaderboard());
await net.signOut();

await step('A inicia sesión', net.signIn(A.email, pw));
const vis = await step('A ve visitas', net.visitorsToMe());
show((Array.isArray(vis) ? vis : []).length > 0, 'A ve la visita de B', `items: ${(Array.isArray(vis) ? vis : []).length}`);
await net.signOut();

console.log(`\n${okN} OK, ${failN} fallas (cuentas ${A.email} / ${B.email})`);
process.exit(failN ? 1 : 0);
