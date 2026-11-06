// Simulación de economía: 7 días de juego con el código real de economy.js (sin navegador).
//   node tools/sim-economy.mjs . new        (siesta actual)
//   node tools/sim-economy.mjs . old        (almacén viejo de 6 tandas, para comparar)
//   node tools/sim-economy.mjs . new 1 7,9,11,13,15,18,20,23 5 2   (k=escala de producción, horas de sesión, minutos, partidas)
//   SIM_DAYS=90 node tools/sim-economy.mjs .   (más días: muestra una fila por semana y el día en que llega a cada rango)
// Columnas: lvl nivel, rank rango de la ciudad, charm Encanto, coins saldo, prod monedas cobradas acumuladas, games/quests/lvlRw otras fuentes, n edificios,
//   mon monumentos terminados, mats materiales guardados (cristal/ladrillo/tuerca/mapa).
// Las partidas dan el material de su juego (como main.js finishGame); la jugadora juega lo que más le falta para sus obras.
// Simulación de 7 días de juego casual: node sim.mjs <raizProyecto> [modo] [k]
//  modo: old (topes viejos de 6 ciclos) | new (siesta 3-4 h)   k: escala de producción de monedas
import { pathToFileURL } from 'node:url';
const root = process.argv[2];
const mode = process.argv[3] || 'new';
const K = Number(process.argv[4] || 1);
const SESS = (process.argv[5] || '8,13,19,23').split(',').map(Number);   // horas de sesión
const SESSION_MIN = Number(process.argv[6] || 10);
const GAMES_PER_SESSION = Number(process.argv[7] || 3);
const DAYS = Number(process.env.SIM_DAYS || 7);

let T = new Date(2026, 10, 2, 8, 0, 0).getTime();
const realNow = Date.now;
Date.now = () => T;
const store_ = {};
globalThis.localStorage = { getItem: k => store_[k] ?? null, setItem: (k, v) => { store_[k] = String(v); }, removeItem: k => { delete store_[k]; } };
globalThis.addEventListener = () => {};
globalThis.removeEventListener = () => {};
globalThis.location = { search: '', hostname: 'x', protocol: 'http:' };
globalThis.document = { visibilityState: 'visible', addEventListener() {}, querySelector() { return null; }, createElement() { return { getContext() { return null; }, style: {} }; } };
globalThis.requestAnimationFrame = () => 0;
const imp = (p) => import(pathToFileURL(root + '/' + p).href);
const { store } = await imp('src/core/state.js');
const data = await imp('src/core/data.js');
const E = await imp('src/core/economy.js');
const { bus } = await imp('src/core/bus.js');

if (mode === 'old') { E.STORAGE_HOURS.negocio = 1e-9; E.STORAGE_HOURS.casa = 1e-9; E.STORAGE_HOURS.especial = 1e-9; }
for (const b of data.BUILDINGS) if (b.prod?.coins) b.prod.coins = Math.max(1, Math.round(b.prod.coins * K));

store.load(); store.reset();
const s = store.state;
let levelUps = 0;
bus.on('level:up', () => levelUps++);
const tally = { prod: 0, games: 0, quests: 0, level: 0 };
bus.on("production:collected", ({ b, amount, currency }) => { if (currency === "coins") { tally.prod += amount; } });
bus.on('level:up', ({ reward }) => { tally.level += reward.coins; });

function findSpot(id) {
  const { min, max } = E.landBounds();
  for (let z = min; z < max; z++) for (let x = min; x < max; x++) if (E.canPlace(id, x, z, 0).ok) return [x, z];
  return null;
}
/** Reacomoda todos los edificios (menos la Municipalidad) dejando lugar para `id`. Devuelve el lugar o null. */
function repackFor(id) {
  const keep = s.city.buildings.slice();
  const castle = keep.find(b => b.id === 'castillo');
  const area = (b) => data.BUILDING_BY_ID[b.id].size[0] * data.BUILDING_BY_ID[b.id].size[1];
  const others = keep.filter(b => b !== castle).sort((a, b) => area(b) - area(a));
  s.city.buildings = [castle];
  const spot = findSpot(id);
  if (!spot) { s.city.buildings = keep; return null; }
  const dummy = { uid: -1, id, x: spot[0], z: spot[1], rot: 0, level: 1 };
  s.city.buildings.push(dummy);
  const pos = new Map();
  for (const b of others) {
    const p = findSpot(b.id);
    if (!p) { s.city.buildings = keep; return null; }
    pos.set(b, p);
    s.city.buildings.push({ ...b, x: p[0], z: p[1], rot: 0 });
  }
  for (const [b, p] of pos) { b.x = p[0]; b.z = p[1]; b.rot = 0; }
  s.city.buildings = keep;
  return spot;
}
// prioridad de compra: juegos > casas si falta población > negocios > mejoras > deco > castillo > expandir
function spend() {
  for (let guard = 0; guard < 40; guard++) {
    const L = s.player.level;
    // con el expediente completo, la Municipalidad (subir de rango) va primero
    const castle = s.city.buildings.find(b => b.id === 'castillo');
    if (castle && E.canUpgrade(castle).ok) { E.startUpgrade(castle.uid); continue; }
    // monumentos: la próxima etapa apenas alcanza (materiales + monedas)
    let mon = false;
    for (const id of data.MONUMENT_IDS) {
      const st = E.monumentStatus(id);
      if (!st.unlocked || !st.can.ok) continue;
      if (st.b) { if (!E.startUpgrade(st.b.uid).error) { mon = true; break; } continue; }
      // sin lugar: como haría una jugadora, reacomoda la ciudad (mueve todo, de lo más grande a lo más chico)
      const spot = findSpot(id) || repackFor(id);
      if (spot && !E.placeBuilding(id, spot[0], spot[1], 0).error) { mon = true; break; }
    }
    if (mon) continue;
    const want = [];
    for (const g of data.GAMES) if (L >= g.unlock && !E.countOf(g.building)) want.push(g.building);
    if (L >= 2 && !E.countOf('boutique_real')) want.push('boutique_real');
    const biz = data.BUILDINGS.filter(b => b.cat === 'negocio' && b.prod?.coins && b.unlock <= L);
    const houses = data.BUILDINGS.filter(b => b.cat === 'casa' && b.unlock <= L);
    const pop = E.population();
    const nextBiz = biz.filter(b => E.countOf(b.id) < 2).sort((a, b) => b.cost.coins - a.cost.coins);
    const blocked = nextBiz.find(b => b.popReq > pop);
    if (blocked) want.push(houses.sort((a, b) => b.pop / b.cost.coins - a.pop / a.cost.coins)[0].id);
    for (const b of nextBiz) if (b.popReq <= pop) want.push(b.id);
    const hp = E.happiness();
    if (hp.pct < 70) {
      const deco = data.BUILDINGS.filter(b => b.cat === 'deco' && b.unlock <= L && b.cost.coins && !b.cost.gems && E.countOf(b.id) < 8).sort((a, b) => b.happy / b.cost.coins - a.happy / a.cost.coins);
      if (deco[0]) want.push(deco[0].id);
    }
    if (houses.length && E.countOf(houses[0].id) < 6) want.push(houses.sort((a, b) => b.pop - a.pop)[0].id);
    // expediente del próximo rango: tipos de negocio que faltan, encanto (deco variada) y población
    const rs = E.rankStatus();
    const need = Object.fromEntries(rs.reqs.filter(r => !r.ok).map(r => [r.key, true]));
    if (need.shops) for (const b of data.BUILDINGS.filter(b => b.cat === 'negocio' && b.unlock <= L && !E.countOf(b.id) && (b.popReq || 0) <= pop)) want.push(b.id);
    if (need.pop) want.push(houses.sort((a, b) => b.pop / b.cost.coins - a.pop / a.cost.coins)[0].id);
    if (need.charm || need.happy) {
      const deco = data.BUILDINGS.filter(b => b.cat === 'deco' && b.unlock <= L && b.cost.coins && !b.max && E.countOf(b.id) < 8)
        .sort((a, b) => E.charmGain(b.id) / b.cost.coins - E.charmGain(a.id) / a.cost.coins);
      if (deco[0]) want.push(deco[0].id);
    }
    let did = false;
    for (const id of want) {
      const c = E.canBuild(id);
      if (!c.ok) continue;
      const spot = findSpot(id);
      if (!spot) {
        const ex = E.expansionStatus();
        if (ex && ex.ok && store.canAfford(ex.cost)) { E.expand(); did = true; break; }
        continue;
      }
      const r = E.placeBuilding(id, spot[0], spot[1], 0);
      if (!r.error) { did = true; break; }
    }
    if (did) continue;
    // mejoras: castillo primero, después el productor más barato de mejorar
    const ups = s.city.buildings.filter(b => E.canUpgrade(b).ok).sort((a, b) => (a.id === 'castillo' ? -1 : 0) - (b.id === 'castillo' ? -1 : 0) || E.upgradeInfo(a).cost.coins - E.upgradeInfo(b).cost.coins);
    if (ups[0] && store.canAfford({ coins: E.upgradeInfo(ups[0]).cost.coins + 200 })) { E.startUpgrade(ups[0].uid); continue; }
    break;
  }
}
const hasGame = (g) => s.player.level >= g.unlock && E.hasBuilt(g.building);
function pickGame() {
  const games = data.GAMES.filter(hasGame);
  // la mitad de las veces juega lo que más le falta para su próxima etapa; si no, cualquiera
  if (Math.random() < 0.5) {
    for (const g of games) { const h = E.materialHint(data.MATERIAL_BY_GAME[g.id].id); if (h && h.missing > 0) return g; }
  }
  return games[Math.floor(Math.random() * games.length)] || data.GAMES[0];
}
function playGame() {
  const scale = data.rewardScale(s.player.level);
  const won = Math.random() < 0.75;
  const base = won ? 60 : 5;
  const coins = Math.round(base * scale);
  tally.games += coins;
  const g = pickGame();
  const stars = won ? 1 + Math.floor(Math.random() * 3) : 0;
  const mat = data.MATERIAL_BY_GAME[g.id];
  store.grant({ coins, xp: Math.round((won ? 16 : 5) * Math.sqrt(scale) * (1 + E.monumentBonus('gameXp'))), mats: { [mat.id]: Math.max(1, stars) + (won ? 1 : 0) } }, 'game');
  if (won && Math.random() < 0.3) { const c = Math.round(170 * scale); tally.games += c; store.grant({ coins: c }, 'chest'); }
}
const rnd = (() => { let h = 12345; return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 10000) / 10000; }; })();
Math.random = rnd;
const out = [];
const day0 = new Date(2026, 10, 2).getTime();
let lastDay = -1;
const rankDay = {};
for (let day = 0; day < DAYS; day++) {
  for (const hr of SESS) {
    T = day0 + day * 864e5 + hr * 3600e3;
    E.tick();
    if (day !== lastDay) {   // premio diario + diarias (aprox.)
      lastDay = day;
      const sc = data.rewardScale(s.player.level);
      const q = Math.round(150 * sc + 120 + 200 + 280);
      tally.quests += q;
      // una de las diarias suele ser "jugá X": 3 de su material
      const dm = data.MATERIALS[day % data.MATERIALS.length];
      store.grant({ coins: q, xp: 70 + 50, mats: hasGame(data.GAME_BY_ID[dm.game]) ? { [dm.id]: 3 } : null }, 'quest');
    }
    E.collectAll();
    spend();
    for (let g = 0; g < GAMES_PER_SESSION; g++) { T += (SESSION_MIN / GAMES_PER_SESSION) * 60e3; E.tick(); playGame(); }
    E.collectAll();
    spend();
  }
  const prodPerHour = s.city.buildings.reduce((a, b) => { const st = E.producerStatus(b, T); return a + (st.producer && !st.paused && st.currency === 'coins' ? st.perCycle * 3600 / st.cycleSec : 0); }, 0);
  const rk = E.townRank();
  for (let r = 2; r <= rk; r++) if (!rankDay[r]) rankDay[r] = day + 1;
  if (DAYS > 14 && (day + 1) % 7 && day + 1 !== DAYS) continue;
  const rs = E.rankStatus();
  out.push({ day: day + 1, lvl: s.player.level, rank: rk, charm: E.cityCharm(), happy: E.happiness().pct, shops: E.shopKinds(), gems: s.gems,
    falta: rs.reqs.filter(r => !r.ok).map(r => r.key + ' ' + r.have + '/' + r.need).join(' ') + (rs.next && !rs.levelOk ? ' nivel' + rs.next.reqLevel : ''),    mon: E.monumentsDone(), mats: data.MATERIALS.map(m => s.materials[m.id] || 0).join('/'),
 coins: s.coins, prod: tally.prod, games: tally.games, quests: tally.quests, lvlRw: tally.level, n: s.city.buildings.length, castle: E.castleLevel(), exp: s.city.expansions, pop: E.population(), prodH: Math.round(prodPerHour) });
}
console.log(mode, 'k=' + K, 'sesiones', SESS.join(','));
console.table(out);
console.log('día en que llega a cada rango:', JSON.stringify(rankDay));
const ids = {}; for (const b of s.city.buildings) ids[b.id] = (ids[b.id] || 0) + 1;
console.log(JSON.stringify(ids));
console.log('monumentos:', data.MONUMENT_IDS.map(id => { const st = E.monumentStatus(id); return `${id} ${st.stagesDone}/${st.N}`; }).join(' · '));
Date.now = realNow;
process.exit(0);
