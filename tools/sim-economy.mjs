// Simulación de la economía del ciclo nuevo (DESIGN-CORE.md §8, Fase 5b) con el código real del juego cargado en Node:
// economy, state, data, misiones, Pase, eventos, cofres, Hallazgos, expedición (motor + bot "medio" de exp-bots.mjs)
// y amenazas (calendario, preparación, defensa con el bot del motor, daño y reparación). Sin navegador ni DOM.
//
//   node tools/sim-economy.mjs                 60 días, 2 ratos por día (9:00 y 20:00, 10 min), tabla por día + metas
//   node tools/sim-economy.mjs --days 90       más días (tabla por semana; con ≥ 70 días mide también el rango 8)
//   node tools/sim-economy.mjs --sessions 4    4 ratos por día (8, 12, 17 y 21 h): chequeo del Pase (nivel 30 ≥ día 16)
//   node tools/sim-economy.mjs --seed 7        otra suerte (expediciones, cofres, amenazas)
//   node tools/sim-economy.mjs --runs 4        además corre 4 semillas más (en procesos aparte) para las metas "por corrida"
//   node tools/sim-economy.mjs --quiet         sin la tabla (fuentes, subidas y metas) · --goals: solo las metas
//   node tools/sim-economy.mjs --json          resumen en JSON (lo usan --runs y el chequeo de 4 ratos)
//   node tools/sim-economy.mjs --seeds 1-6     una corrida completa por semilla (en paralelo) y la tasa de cada meta:
//                                              en cuántas semillas pasa. Sale con error si alguna meta falla en alguna
//                                              (npm run sim:seeds). --seeds 1,3,7 también vale. Los demás flags pasan igual
//   node tools/sim-economy.mjs --no-tools      sin la gente de la ciudad ni sus herramientas (como antes del paso 7)
//     diagnóstico: --no-tool-city (sin Martillo ni Farol en la ciudad) · --no-tool-exp (sin sus efectos en la expedición)
//     · --no-tool-buy (la gente llega, pero el bot no entrega encargos ni mejora herramientas)
//   node tools/sim-economy.mjs --greedy        sin guardar para lo próximo (gasta todo lo que puede, en orden)
//   node tools/sim-economy.mjs --trace         una línea por rato con las monedas y el próximo gasto grande
//   node tools/sim-economy.mjs --k 0.8         escala la producción de monedas (para explorar; 1 = los números del juego)
//   node tools/sim-economy.mjs --no-check4     sin la corrida extra de 4 ratos (más rápido)
//   node tools/sim-economy.mjs --raiz exprimir la extracción que se elige al encontrar el Núcleo de Raíz (sellar, medida
//                                              o exprimir; por defecto medida). Sin --json corre además las tres opciones
//                                              en procesos aparte y mide la meta de L1 (--no-raiz3 para saltearla)
//   node tools/sim-economy.mjs --adv          (paso 2a) una línea con los avances de cada rato (Nivel, maestría, arma)
//     diagnóstico: --no-gear (el bot no aprende talentos, no equipa ni desarma, y no farmea) · --no-farm (rodea las
//     peleas como antes) · --farm-reach 4 (pasos que camina para ir a una pelea) · --enemies 0.07,0.13,2 (casillas
//     enemigo por salida: chance en la banda media y en la lejana, y tope; para explorar)
//   (desde tools/: npm run sim:economy)
//
// Cómo juega (una persona razonable en ratos cortos): al entrar cobra todo (login, cofre gratis, cofres, Pase, misiones,
// diarias, logros, sets de Hallazgos), repara, se prepara para la amenaza que se viene (reservas en el Taller y una defensa
// de ese tipo donde cubre lo que está en riesgo), la enfrenta el día que llega (bot del motor con 25% de cuadrillas mal
// puestas), sale de expedición (la corta gratis del día y normales cuando el depósito tiene ≥ 80% de lo que lleva la Casa),
// y gasta en este orden: reparar → obra de rango → misión principal → amenaza → edificios base del ciclo → monumento →
// expediente del próximo rango → provisiones → mejoras del ciclo → defensas → negocios y casas → renovaciones → terreno.
// Guarda para lo próximo: las monedas del primer gasto grande que no pudo hacer y los materiales de la etapa de monumento
// que persigue (lo de menor prioridad no los toca). Sin lugar, reacomoda la ciudad y guarda deco chica para lo importante
// (expediente, monumento, base del ciclo, defensa); acomoda las defensas donde cubren lo que está en riesgo. Las
// provisiones se dimensionan para 2 normales por día (3 desde el rango 5) con lo que de verdad gasta una salida.
// Cada rato dura 10 minutos de reloj: lo que termina en el rato se vuelve a gastar; "cobrar todo" se toca al entrar, al
// volver de cada salida y antes de irse.
//
// "Próximo gasto grande" (meta de monedas): la primera construcción, mejora, renovación, terreno u obra de rango de la
// lista que quedó sin hacer, sin contar lo que espera solo materiales (salvo monumento y obra de rango).
// Meta de monedas (pulido): al llegar a cada rato, el saldo contra lo que se quería comprar al irse del anterior; y al
// irse, que no sobre más de 3× el próximo gasto. Medido solo al irse, la sim (que compra todo lo que le alcanza) queda
// < 1× siempre que las monedas son lo que frena, así que esa versión no se podía cumplir.
// Comercio con las aldeas (economy.buyMissing): si a la etapa del monumento le faltan materiales y después de comprarlos
// le quedan ≥ 2,5× las monedas de la etapa (--trade-keep), los compra (hasta lo que tengan las aldeas en el día).
//   perillas para explorar: --no-trade · --trade-keep 2 · --trade-price 1.5 · --mon-coins 0.8 (o faro=1,jardin=0.7…)
import { pathToFileURL, fileURLToPath } from 'node:url';
import { spawnSync, spawn } from 'node:child_process';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : d; };
const DAYS = Number(opt('days', 60));
const NSESS = Number(opt('sessions', 2));
const SEED = Number(opt('seed', 1));
const RUNS = Number(opt('runs', 0));
const QUIET = args.includes('--quiet');
const JSON_OUT = args.includes('--json');
const TRACE = args.includes('--trace');   // una línea por rato: monedas y próximo gasto grande
const CHECK4 = !args.includes('--no-check4') && !JSON_OUT && NSESS === 2;
const SESSION_MIN = Number(opt('min', 10));

// ---------------------------------------------------------------- varias semillas (--seeds 1-6)
// Cada semilla corre en su proceso (el juego es un singleton), con sus metas completas (también la Raíz y los 4 ratos),
// y devuelve la lista de metas por --goals-json. Acá se cuentan.
if (opt('seeds', false)) {
  const spec = String(opt('seeds', '1-4'));
  const seeds = spec.includes('-') ? (() => { const [a, b] = spec.split('-').map(Number); return Array.from({ length: b - a + 1 }, (_, i) => a + i); })() : spec.split(',').map(Number);
  const pass = args.filter((a, i) => !['--seeds', '--seed'].includes(a) && !['--seeds', '--seed'].includes(args[i - 1]));
  const t0 = Date.now();
  const runOne = (sd) => new Promise(res => {
    const ch = spawn(process.execPath, [fileURLToPath(import.meta.url), '--seed', String(sd), '--quiet', '--goals', '--goals-json', ...pass], { stdio: ['ignore', 'pipe', 'ignore'] });
    let out = '';
    ch.stdout.on('data', d => { out += d; });
    ch.on('close', () => { const line = out.split('\n').find(l => l.startsWith('GOALS ')); try { res({ seed: sd, goals: JSON.parse(line.slice(6)) }); } catch { res({ seed: sd, goals: null }); } });
  });
  const results = await Promise.all(seeds.map(runOne));
  const names = results.find(r => r.goals)?.goals.map(g => g.key) || [];
  console.log(`Metas de balance (DESIGN-CORE.md §8) en ${seeds.length} semillas (${seeds.join(', ')}) · ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  let bad = 0;
  for (const key of names) {
    const per = results.map(r => r.goals?.find(g => g.key === key));
    const measured = per.filter(g => g && g.ok != null);
    const okN = measured.filter(g => g.ok).length;
    const fails = results.filter((r, i) => per[i] && per[i].ok === false).map(r => r.seed);
    if (fails.length) bad++;
    const mk = !measured.length ? '·' : fails.length ? '✘' : '✔';
    console.log(`  ${mk} ${String(okN).padStart(2)}/${measured.length}  ${key}${fails.length ? `  · falla en ${fails.join(', ')}: ${per.filter(g => g && g.ok === false).map(g => g.val).join(' | ')}` : ''}`);
  }
  for (const r of results) if (!r.goals) { console.log(`  ✘ la semilla ${r.seed} no terminó`); bad++; }
  console.log(`  ${bad ? bad + ' meta(s) con alguna falla' : 'todas las metas en todas las semillas'}`);
  process.exit(bad ? 1 : 0);
}
// L1 (PLAN-QUIEBRE): la extracción elegida en la mina. La sim encuentra el Núcleo al llegar a la mina o, si el bot no fue
// al Cerro, 3 días después del rango 5 (como si hubiera ido).
const RAIZ = ['sellar', 'medida', 'exprimir'].includes(opt('raiz', 'medida')) ? opt('raiz', 'medida') : 'medida';
const RAIZ3 = !args.includes('--no-raiz3') && !JSON_OUT && NSESS === 2;
const MAT_V = 250, PROV_V = 20;   // valor en monedas de un material y de una provisión (para la ventaja neta de L1)
const HOURS = NSESS >= 4 ? [8, 12, 17, 21] : NSESS === 3 ? [9, 14, 20] : NSESS === 1 ? [20] : [9, 20];
const STEP_SEC = 12;                 // segundos por paso de expedición (≈ 3–6 min por salida normal)
// peleas de la casilla `enemigo` (DESIGN-COMBAT.md §13): jugada ≈ 4 min (el plan dice 3–6), resuelta rápido ≈ 10 s.
// El bot juega como mucho una por salida y solo si el rato tiene tiempo; las demás las rodea o las resuelve rápido.
const FIGHT_SEC = 240, QUICK_SEC = 10;

// ---------------------------------------------------------------- entorno: reloj controlado, localStorage y DOM mínimos
let T = new Date(2026, 10, 2, HOURS[0], 0, 0).getTime();   // día 0 = lunes 2026-11-02 = inicio de la temporada 1
// new Date() sin argumentos también tiene que dar la hora de la sim (todayStr, diarias, login)
const RealDate = Date;
class SimDate extends RealDate { constructor(...a) { if (a.length) super(...a); else super(T); } static now() { return T; } }
globalThis.Date = SimDate;
const ls = {};
globalThis.localStorage = { getItem: k => ls[k] ?? null, setItem: (k, v) => { ls[k] = String(v); }, removeItem: k => { delete ls[k]; } };
globalThis.addEventListener = () => {};
globalThis.removeEventListener = () => {};
globalThis.location = { search: '', hostname: 'sim', protocol: 'http:', href: 'http://sim/' };
const fakeEl = () => ({ style: {}, dataset: {}, classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, append() {}, appendChild() {}, remove() {},
  setAttribute() {}, addEventListener() {}, removeEventListener() {}, querySelector: () => null, querySelectorAll: () => [], getContext: () => null, children: [] });
globalThis.document = { visibilityState: 'visible', addEventListener() {}, removeEventListener() {}, querySelector: () => null, querySelectorAll: () => [],
  createElement: fakeEl, createTextNode: () => ({}), body: fakeEl(), documentElement: fakeEl() };
globalThis.requestAnimationFrame = () => 0;
globalThis.setInterval = () => 0;        // los módulos se refrescan solos con setInterval: acá los llama la sim
globalThis.clearInterval = () => {};
// suerte reproducible (cofres, hallazgos, amenazas, Museo)
const mulberry = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
Math.random = mulberry(SEED * 7919 + 13);
const silence = console.warn; console.warn = () => {};

const imp = (p) => import(pathToFileURL(path.join(ROOT, p)).href);
const { store } = await imp('src/core/state.js');
const data = await imp('src/core/data.js');
const E = await imp('src/core/economy.js');
// perillas para explorar (1 = los números del juego): --mon-coins 0.8 o --mon-coins faro=0.8,jardin=0.6 · --trade-price 1.2
{ const mc = String(opt('mon-coins', '')); if (mc) for (const id of data.MONUMENT_IDS) { const m = mc.includes('=') ? Number((mc.split(',').find(x => x.startsWith(id + '=')) || '=1').split('=')[1]) : Number(mc); for (const st of data.MONUMENTS[id].stages) st.cost.coins = Math.round(st.cost.coins * m / 500) * 500; } }
{ const tp = Number(opt('trade-price', 1)); if (tp !== 1) E.TRADE.price.forEach((p, i) => { E.TRADE.price[i] = Math.round(p * tp); }); }
const { bus } = await imp('src/core/bus.js');
const Q = await imp('src/core/quests.js');
const SE = await imp('src/season/season.js');
const SD = await imp('src/season/season-data.js');
const EV = await imp('src/season/events.js');
const CH = await imp('src/chests/chests.js');
const AL = await imp('src/album/album.js');
const X = await imp('src/expedition/expedition.js');
const XD = await imp('src/expedition/exp-data.js');
const CL = await imp('src/combat/classes.js');   // nivel del líder (paso 5b; lo balancea el paso 7)
const leaderLog = [];
const TH = await imp('src/threats/threats.js');
const TR = await imp('src/threats/threat-rules.js');
const TD = await imp('src/threats/threat-data.js');
const RZ = await imp('src/core/raiz.js');
// la gente de la ciudad y sus herramientas (L5, paso 7): llegadas, encargos (Vínculo) y mejoras en el Taller.
// --no-tools: sin gente ni herramientas (para comparar el efecto del Martillo y el Farol en la ciudad)
const PE = await imp('src/core/people.js');
const PD = await imp('src/core/people-data.js');
const KC = await imp('src/core/classes.js');
const NO_TOOLS = !!opt('no-tools', false);
// --no-tool-city: con la gente y las herramientas en la expedición, pero sin el Martillo ni el Farol en la ciudad
const TC = await imp('src/core/tools-city.js');
if (opt('no-tool-city', false)) { TC.TOOL_CITY.martillo.discount = 0; TC.TOOL_CITY.farol.prep = 0; }
// --no-tool-exp: sin los efectos de las herramientas en la expedición (para medir cuánto mueven la economía)
if (opt('no-tool-exp', false)) { for (const t of Object.values(PD.TOOL_EXP)) { if (t.opt) for (const k of Object.keys(t.opt)) t.opt[k] = 0; t.vision = 99; t.morale = false; } }
const BOTS = await import(pathToFileURL(path.join(HERE, 'exp-bots.mjs')).href);
// --enemies 0.12,0.2,3: casillas enemigo por salida (chance en la banda media, en la lejana y tope; para explorar)
{ const en = String(opt('enemies', '')); if (en) { const [a, b, m] = en.split(',').map(Number); XD.EXP.enemy.chance = [a, b]; if (m) XD.EXP.enemy.max = m; } }
const D = data.BUILDING_BY_ID;
// --k 0.5: escala la producción de monedas de todos los edificios (para explorar; 1 = los números del juego)
const K = Number(opt('k', 1));
if (K !== 1) for (const b of data.BUILDINGS) if (b.prod?.coins) b.prod.coins = Math.max(1, Math.round(b.prod.coins * K));

store.load(); store.reset();
const s = store.state;
s.onboarded = true;
for (const f of [CH.initChests, AL.initAlbum, SE.initSeason, EV.initEvents, X.initExpedition, TH.initThreats, Q.initQuests]) f();
const flush = () => new Promise(r => setImmediate(r));   // las chispas de amenaza llegan por import() dinámico
// la gente: los mismos eventos que engancha initPeople (sin la interfaz)
const peopleCheck = () => { if (NO_TOOLS) return; PE.checkArrivals(); PE.checkFlags(); };
if (!NO_TOOLS) {
  PE.peopleState();
  bus.on('town:rankup', peopleCheck);
  bus.on('expedition:zone', () => { PE.progress('zone'); peopleCheck(); });
  bus.on('expedition:finished', (p) => { if (!p?.prototype) PE.progress('expedition', { region: p?.region || null }); peopleCheck(); });
  bus.on('combat:won', () => PE.progress('combatWin'));
  bus.on('threat:resolved', (p) => { if (p && p.id !== 'sim') PE.progress('threat'); });
  bus.on('quests:changed', () => PE.checkFlags());
}
// lo que tiene la ciudad en cada subida de rango: nivel del líder, nivel de clase de los 3 mejores y herramientas
// (sim-combat arma con esto sus escenarios "de la partida": la bestia en el rango 3 y la capitana en el abordaje)
const progLog = [];
let toolSpend = 0, toolSession = null;
const T0 = () => sessionStart;   // una mejora de herramienta por rato
bus.on('town:rankup', ({ rank }) => {
  const lv = CL.leaderLevelFromXp(s.classes?.leader?.xp || 0);
  const cls = KC.cityClasses(s).map(r => r.classLevel || 1).sort((a, b) => b - a).slice(0, 3);
  progLog.push({ rank, day: dayOf() + 1, leader: lv, classLevel: cls, tools: NO_TOOLS ? {} : PE.toolLevels(s) });
});

// ---------------------------------------------------------------- arsenal, talentos y Fuerza (La Travesía, paso 2a)
// Como lo usaría alguien: al subir de Nivel pone el punto en un orden razonable (lo que se ve en la pelea y lo que trae
// armas primero), equipa la mejor arma (Fuerza del arma + lo que da su maestría) a quien la puede llevar (el líder y la
// gente de la ciudad, que rota en la escuadra), desarma lo que sobra (se queda con 4 de repuesto) y, cuando todos
// llevan algo mejor que una común, prende el filtro de comunes. --no-gear: no toca nada de eso (para comparar).
const A = await imp('src/core/arsenal.js');
const TL = await imp('src/core/talents.js');
const G = await imp('src/core/gear.js');
const PW = await imp('src/core/power.js');
const CD = await imp('src/combat/combat-data.js');
const NO_GEAR = !!opt('no-gear', false);
const TALENT_PLAN = ['of_hallazgo', 'mando_vida', 'sup_animo', 'mando_maestria', 'of_hallazgo', 'sup_cuero', 'mando_vida', 'of_hallazgo',
  'mando_maestria', 'sup_animo', 'mando_vida', 'sup_cuero', 'mando_voz', 'sup_cuero', 'sup_vigia', 'mando_voz', 'sup_curas', 'mando_voz',
  'mando_filo', 'of_taller', 'sup_curas', 'sup_coraza', 'mando_maestria', 'of_desarme', 'sup_botin', 'mando_muro', 'of_jefe'];
function learnTalents() {
  if (NO_GEAR) return;
  for (let g = 0; g < 60 && TL.talentPoints(s).free > 0; g++) {
    const id = TALENT_PLAN.find(t => TL.canLearn(s, t).ok) || TL.TALENT_IDS.find(t => TL.canLearn(s, t).ok);
    if (!id || !G.learn(id).ok) break;
  }
  for (let g = 0; g < 60 && TL.talentPoints(s).paragon.free > 0; g++) G.learnParagon(TL.BRANCH_IDS[g % TL.BRANCH_IDS.length]);
}
bus.on('level:up', learnTalents);
/** Lo que vale la maestría de un tipo (con los pesos de la Fuerza). */
const perkPower = (type) => { const m = A.masteryPerks(type, A.arsenalState(s).mastery[type] || 0); return 10 * m.hp + 30 * m.atk + 40 * m.armor + 15 * Object.values(m.flags).reduce((a, n) => a + n, 0); };
const wScore = (w) => A.weaponPower(w) + perkPower(w.type);
function gearUp() {
  if (NO_GEAR) return;
  learnTalents();
  const a = A.arsenalState(s);
  const L = s.classes?.leader || {};
  const who = ['lider', ...KC.cityClasses(s).sort((x, y) => y.classLevel - x.classLevel).map(r => r.id)];
  const taken = new Set();
  for (const w of who) {
    const cur = A.equippedOn(s, w);
    const base = cur ? wScore(cur) : perkPower(A.wieldType(s, w, L.cls)) - 1;
    const best = a.items.filter(x => !taken.has(x.uid) && A.canWield(w, x.type) && (!A.isEquipped(s, x.uid) || x.uid === cur?.uid))
      .sort((x, y) => wScore(y) - wScore(x))[0];
    if (best && best.uid !== cur?.uid && wScore(best) > base) G.equip(w, best.uid);
    const now = A.equippedOn(s, w);
    if (now) taken.add(now.uid);
  }
  // lo que sobra: se desarma (quedan 4 de repuesto, las de más Fuerza)
  const loose = a.items.filter(x => !A.isEquipped(s, x.uid)).sort((x, y) => wScore(y) - wScore(x));
  for (const w of loose.slice(4)) G.scrap(w.uid);
  // todos los que pelean llevan algo mejor que una común: lo que caiga común se desarma solo
  if (a.filter < 0 && who.every(w => (A.equippedOn(s, w)?.rarity || 0) >= 1)) G.setFilter(0);
  rerollUp(who);
}
// Rehacer rasgos (PLAN-TRAVESIA: lo farmeado tiene dónde ir): en un arma equipada poco común o mejor, el rasgo que no
// es de los que el bot busca se rehace. Una vez por día y hasta 3 por arma; paga con lo mismo que el monumento
// (mineral y madera), como haría quien juega. --no-reroll lo apaga.
const REROLL = !args.includes('--no-reroll');
const REROLL_WANT = new Set(['temple', 'hallazgo', 'vida2', 'coraza', 'afinidad']);
const rerollStats = { n: 0, coins: 0, mats: 0, day: -1, by: new Map() };
function rerollUp(who) {
  const day = Math.floor((T - day0) / DAY);
  if (!REROLL || rerollStats.day === day) return;
  for (const w of who) {
    const x = A.equippedOn(s, w);
    if (!x || x.rarity < 1 || (rerollStats.by.get(x.uid) || 0) >= 3) continue;
    const idx = x.traits.findIndex(t => !REROLL_WANT.has(t.id));
    if (idx < 0) continue;
    const r = G.reroll(x.uid, idx);
    if (!r.ok) continue;
    rerollStats.n++; rerollStats.day = day; rerollStats.coins += r.cost.coins; rerollStats.mats += Object.values(r.cost.mats).reduce((p, n) => p + n, 0);
    rerollStats.by.set(x.uid, (rerollStats.by.get(x.uid) || 0) + 1);
    return;
  }
}
// avances por rato (meta "al menos un avance por rato"): subir de Nivel, una maestría (arma u objeto) o un arma nueva
const advLog = [];
let adv = null;
let weaponsIn = 0;
bus.on('level:up', () => { if (adv) adv.level++; });
bus.on('mastery:up', (p) => { if (adv) adv[p?.kind === 'objeto' ? 'item' : 'mastery']++; });
bus.on('arsenal:drop', () => { weaponsIn++; if (adv) adv.drop++; });
const masteryMax = () => { const m = A.arsenalState(s).mastery; return Math.max(1, ...Object.values(m).map(x => A.masteryLevel(x))); };
const masteryLog = [];
// Fuerza al llegar a cada rango contra la recomendada de los encuentros de la región que se abre (o la última abierta)
const powerLog = [];
bus.on('town:rankup', ({ rank }) => {
  const party = X.expeditionStatus().party;
  const reg = XD.REGION_IDS.map(id => XD.REGIONS[id]).filter(g => (g.rank || 1) <= rank && Object.values(CD.ENCOUNTERS).some(e => e.region === g.id)).sort((x, y) => y.rank - x.rank)[0];
  const recs = reg ? Object.values(CD.ENCOUNTERS).filter(e => e.region === reg.id).map(e => PW.recPower(e.id)) : [];
  powerLog.push({ rank, day: dayOf() + 1, power: G.currentPower(party).total, region: reg?.id || '-', rec: recs.length ? [Math.min(...recs), Math.max(...recs)] : null });
});

// ---------------------------------------------------------------- registro (bus)
const DAY = 864e5;
const day0 = new Date(2026, 10, 2).getTime();
const dayOf = (t = T) => Math.floor((t - day0) / DAY);
const per = [];   // por día: { gems, chests:{src:n}, sparks:{reason:n}, coinsIn:{src:n}, normals, shorts, ... }
const P = (d = dayOf()) => (per[d] ||= { gems: 0, gemsBy: {}, chests: 0, chestsBy: {}, sparks: 0, sparksBy: {}, coinsIn: 0, coinsBy: {}, normals: 0, shorts: 0, mats: 0, planos: 0, finds: 0, threats: [], xp: 0, xpBy: {}, matIn: {}, matOut: {} });
// materiales: de dónde vienen y en qué se gastan (la razón sin el id: 'upgrade:faro' → 'upgrade:monumento')
bus.on('materials:changed', ({ delta, reason }) => {
  const r = String(reason || '?').replace(/^(w+):(.+)$/, (m, a, id) => a + ':' + (D[id]?.cat === 'monumento' ? 'monumento' : D[id]?.cat || id));
  for (const n of Object.values(delta || {})) { const p = P(); if (n > 0) p.matIn[r] = (p.matIn[r] || 0) + n; else p.matOut[r] = (p.matOut[r] || 0) - n; }
});
bus.on('currency:changed', ({ delta, reason }) => {
  if (delta?.gems > 0) { P().gems += delta.gems; P().gemsBy[reason || '?'] = (P().gemsBy[reason || '?'] || 0) + delta.gems; }
  if (delta?.coins > 0) { P().coinsIn += delta.coins; P().coinsBy[reason || '?'] = (P().coinsBy[reason || '?'] || 0) + delta.coins; }
});
// monedas cobradas por tipo de edificio (para ver quién sostiene la economía)
const coinsById = {};
bus.on('production:collected', ({ b, amount, currency }) => { if (currency === 'coins') coinsById[b.id] = (coinsById[b.id] || 0) + amount; });
// experiencia por fuente: store.grant marca de dónde viene; lo demás (obras, mejoras, terreno) es 'obra'
let xpCtx = 'obra';
const grant0 = store.grant, addXp0 = store.addXp;
store.grant = (r, src) => { const prev = xpCtx; xpCtx = src || '?'; try { return grant0.call(store, r, src); } finally { xpCtx = prev; } };
store.addXp = (n) => { const p = P(); p.xp = (p.xp || 0) + Math.round(n); p.xpBy[xpCtx] = (p.xpBy[xpCtx] || 0) + Math.round(n); return addXp0.call(store, n); };
bus.on('chests:changed', (p) => { if (p?.added) { P().chests += p.n || 1; const k = p.source || '?'; P().chestsBy[k] = (P().chestsBy[k] || 0) + (p.n || 1); } });
bus.on('season:points', ({ added, reason }) => { P().sparks += added; P().sparksBy[reason] = (P().sparksBy[reason] || 0) + added; });
bus.on('expedition:finished', ({ kind, loot }) => {
  const p = P();
  if (kind === 'corta') p.shorts++; else p.normals++;
  p.mats += Object.values(loot?.mats || {}).reduce((a, n) => a + n, 0); p.planos += loot?.planos || 0; p.finds += (loot?.finds || []).length;
});
const rankAt = {}, rankStartAt = {};
const eraLast = [];   // en cada cambio de época: qué fue lo último del expediente
const rankLast = [];  // en cada subida: { rank, last, waitLevelMs, spanMs }
let firstMonumentDay = null;
const threatLog = [];
bus.on('threat:resolved', ({ id, type, pct, mode, damaged }) => threatLog.push({ id, type, pct, mode, damaged: damaged.length, day: dayOf() }));
bus.on('town:rankup', ({ rank }) => { rankAt[rank] = T; });
// ---- L1: el Núcleo de Raíz, la extracción y lo que gana y pierde la isla desde ese día (monedas, materiales y
// provisiones que entran, menos reparaciones y obras de Raíz)
const rz = { mode: RAIZ, foundDay: null, how: null, coinsIn: 0, matsIn: 0, provIn: 0, invMats: 0, repairCoins: 0, repairMats: 0, suturaCoins: 0, suturaMats: 0, suturas: 0, threats: 0, damaged: 0, grietaByDay: [] };
bus.on('raiz:found', ({ first }) => { if (!first) return; rz.foundDay = dayOf() + 1; rz.how ||= 'mina'; RZ.chooseExtraction(RAIZ, s, T); });
bus.on('raiz:sutura', () => { rz.suturas++; });
bus.on('currency:changed', ({ delta, reason }) => {
  if (!rz.foundDay) return;
  if (delta?.coins > 0) rz.coinsIn += delta.coins;
  if (delta?.coins < 0 && reason === 'repair') rz.repairCoins -= delta.coins;
  if (delta?.coins < 0 && reason === 'sutura') rz.suturaCoins -= delta.coins;
});
bus.on('materials:changed', ({ delta, reason }) => {
  if (!rz.foundDay) return;
  for (const n of Object.values(delta || {})) {
    if (n > 0) rz.matsIn += n;
    else if (reason === 'repair') rz.repairMats -= n;
    else if (reason === 'sutura') rz.suturaMats -= n;
  }
});
bus.on('production:collected', ({ b, amount, currency }) => { if (!rz.foundDay) return; if (currency === 'prov') rz.provIn += amount; if (b.id === 'invernadero') rz.invMats += amount; });
bus.on('threat:resolved', ({ damaged, g }) => { if (rz.foundDay) { rz.threats++; rz.damaged += damaged.length; rz.gSum = (rz.gSum || 0) + (g || 0); } });
const monDone = {};
bus.on('building:upgraded', ({ b }) => { if (D[b.id]?.cat === 'monumento' && b.level >= data.MONUMENTS[b.id].stages.length && !monDone[b.id]) monDone[b.id] = dayOf() + 1; });

// ---------------------------------------------------------------- utilidades de lugar
const isBusy = (b) => E.isBusy(b, T);
function spots(id) {
  const [w, d] = E.footprint(id, 0);
  const { min, max } = E.landBounds();
  const c = s.city.buildings.find(b => b.id === 'castillo');
  const cx = c ? c.x + 2 : 14, cz = c ? c.z + 2 : 14;
  const out = [];
  for (let x = min; x <= max - w; x++) for (let z = min; z <= max - d; z++) if (E.canPlace(id, x, z, 0).ok) out.push([x, z, Math.hypot(x + w / 2 - cx, z + d / 2 - cz)]);
  return out;
}
const noSpot = new Set();
const spaceTried = new Set();
let roomWanted = null;                // edificio importante que espera lugar (se deja de llenar el terreno con cosas chicas)         // edificios para los que ya se intentó hacer lugar en este rato             // tamaños sin lugar en este paso (se limpia en cada paso)
function findSpot(id) {
  const key = E.footprint(id, 0).join('x');
  if (noSpot.has(key)) return null;
  const all = spots(id);
  if (!all.length) { noSpot.add(key); return null; }
  all.sort((a, b) => a[2] - b[2]);    // cerca de la Municipalidad, como lo hace una persona
  return all[0];
}
/** Lugar para una defensa: el que más cubre de lo que está en riesgo para su tipo. */
function defenseSpot(id) {
  const all = spots(id);
  let best = null, bc = -1;
  for (const [x, z, dist] of all) {
    const n = TH.wouldCover(id, x, z, 0, 1).length;
    if (n > bc || (n === bc && dist < best[2])) { bc = n; best = [x, z, dist]; }
  }
  // una defensa de 1×1 (Pararrayos) que no cubre nada donde hay lugar: se cambia por una deco chica que esté cerca de lo que corre riesgo
  if (bc <= 0 && D[id].size[0] * D[id].size[1] === 1) {
    let pick = null, pc = 0;
    for (const b of s.city.buildings) {
      if (!E.canRemove(b) || D[b.id].size[0] * D[b.id].size[1] !== 1) continue;
      const n = TH.wouldCover(id, b.x, b.z, 0, 1).length;
      if (n > pc) { pc = n; pick = b; }
    }
    if (pick) { const at = [pick.x, pick.z, 0]; E.removeBuilding(pick.uid); noSpot.clear(); return at; }
  }
  return best;
}
/** Mueve una defensa al lugar donde cubre más de lo que está en riesgo (si gana algo). */
const movedFor = new Set();
function moveDefense(b) {
  const id = b.id, [w, d] = E.footprint(id, 0), { min, max } = E.landBounds();
  const here = TH.wouldCover(id, b.x, b.z, b.rot || 0, b.level || 1).length;
  let best = null, bc = here;
  for (let x = min; x <= max - w; x++) for (let z = min; z <= max - d; z++) {
    if (!E.canPlace(id, x, z, 0, b.uid).ok) continue;
    const n = TH.wouldCover(id, x, z, 0, b.level || 1).length;
    if (n > bc) { bc = n; best = [x, z]; }
  }
  if (best) { E.moveBuilding(b.uid, best[0], best[1], 0); noSpot.clear(); }
}
/** Reacomoda la ciudad (todo menos la Municipalidad y las defensas, de lo más grande a lo más chico) para hacerle lugar a `id`. */
function repackFor(id) {
  const keep = s.city.buildings.slice();
  const castle = keep.find(b => b.id === 'castillo');
  const area = (b) => D[b.id].size[0] * D[b.id].size[1];
  // la Municipalidad y las defensas se quedan donde están (las defensas cubren lo que tienen cerca)
  const fixed = keep.filter(b => b === castle || D[b.id].cat === 'defensa');
  const others = keep.filter(b => !fixed.includes(b)).sort((a, b) => area(b) - area(a));
  const firstFree = (bid) => { const { min, max } = E.landBounds(); const [w, d] = E.footprint(bid, 0); for (let z = min; z <= max - d; z++) for (let x = min; x <= max - w; x++) if (E.canPlace(bid, x, z, 0).ok) return [x, z]; return null; };
  s.city.buildings = fixed.slice();
  const spot = firstFree(id);
  if (!spot) { s.city.buildings = keep; return null; }
  s.city.buildings.push({ uid: -1, id, x: spot[0], z: spot[1], rot: 0, level: 1 });
  const pos = new Map();
  for (const b of others) {
    const p = firstFree(b.id);
    if (!p) { s.city.buildings = keep; return null; }
    pos.set(b, p);
    s.city.buildings.push({ ...b, x: p[0], z: p[1], rot: 0 });
  }
  for (const [b, p] of pos) { b.x = p[0]; b.z = p[1]; b.rot = 0; }
  s.city.buildings = keep;
  noSpot.clear();
  movedFor.clear();   // la ciudad cambió de lugar: las defensas se vuelven a acomodar
  return spot;
}

// ---------------------------------------------------------------- costos con reserva
// Lo de menor prioridad no puede usar las monedas/materiales que se guardan para la obra de rango o la etapa de monumento.
let reserved = { coins: 0, gems: 0, mats: {} };
const addMats = (a = {}, b = {}) => { const o = { ...a }; for (const [k, n] of Object.entries(b || {})) o[k] = (o[k] || 0) + n; return o; };
function afford(cost = {}) {
  if (!store.canAfford(cost)) return false;
  if ((cost.coins || 0) + reserved.coins > s.coins) return false;
  if ((cost.gems || 0) + reserved.gems > s.gems) return false;
  if (cost.mats && !store.hasMats(addMats(cost.mats, reserved.mats))) return false;
  return true;
}
function reserve(cost = {}, { coins = true, mats = true } = {}) {
  if (coins) { reserved.coins += cost.coins || 0; reserved.gems += cost.gems || 0; }
  if (mats && cost.mats) reserved.mats = addMats(reserved.mats, cost.mats);
}
/** Faltantes de materiales de lo que se quiso hacer y no alcanzó (guía la elección de región). */
let matWant = {};
function wantMats(m) { for (const [k, n] of Object.entries(m || {})) { const miss = n + (reserved.mats[k] || 0) - (s.materials[k] || 0); if (miss > 0) matWant[k] = Math.max(matWant[k] || 0, miss); } }

// ---------------------------------------------------------------- acciones
// Cada acción devuelve 'done' o un motivo. bigCost: la primera acción grande que no se pudo hacer (meta de monedas).
let bigNext = null;
// La primera acción grande que no se pudo hacer es "lo próximo": se le guardan las monedas (lo de menor prioridad solo
// usa lo que sobra por encima), como hace una persona que junta para lo que viene.
// Para la meta de monedas, lo que espera materiales no es un gasto de monedas que se esté juntando (salvo la etapa de
// monumento y la obra de rango): "el próximo gasto grande" (bigMetric) es el primero que no está frenado solo por materiales.
let bigMetric = null;
// metric: false cuando lo frena otra cosa que no son monedas ni materiales (constructoras ocupadas, un plano): se le
// guardan monedas igual, pero no es "lo que se está juntando" (rebalanceo con varias semillas, DESIGN-CORE §8.z: el Granero
// con las constructoras ocupadas quedaba como el gasto grande con el saldo 10× arriba)
const noteBig = (what, cost, { metric = true } = {}) => {
  if (!(cost?.coins > 0)) return;
  if (!bigNext) { bigNext = { what, coins: cost.coins }; if (CUSHION) reserved.coins += cost.coins; }
  if (bigMetric || !metric) return;
  const id = what.split(' ')[1];
  const goal = id === 'castillo' || D[id]?.cat === 'monumento';
  if (!goal && cost.mats && !store.hasMats(addMats(cost.mats, reserved.mats))) return;
  bigMetric = { what, coins: cost.coins };
};
const CUSHION = !args.includes('--greedy');
const TRADE_ON = !args.includes('--no-trade');          // comercio con las aldeas (economy.buyMissing)
const TRADE_KEEP = Number(opt('trade-keep', 2.5));      // compra si después le quedan ≥ N × las monedas de la etapa
const tradeLog = [];
function build(id, { big = true, place = null, room = false } = {}) {
  const d = D[id];
  if (!d) return 'x';
  const c = E.canBuild(id, s, T);
  const cost = E.placeCost(id);
  if (!c.ok) {
    if (c.locked || c.reason === 'Ya lo tenés') return 'locked';
    if (c.mats) wantMats(cost.mats);
    if (big) noteBig('construir ' + id, cost, { metric: !!(c.mats || c.poor) });
    return c.reason;
  }
  if (!c.free && !afford(cost)) { wantMats(cost.mats); if (big) noteBig('construir ' + id, cost); return 'reservado'; }
  // si algo importante está esperando lugar, no se ocupa el terreno con cosas chicas (si no, se libera y se vuelve a llenar)
  if (roomWanted && roomWanted !== id && !room && ['deco', 'casa', 'negocio'].includes(d.cat)) return 'sin lugar';
  let spot = place ? place(id) : findSpot(id);
  if (!spot) {
    const ex = E.expansionStatus();
    if (ex?.ok && afford(ex.cost)) { E.expand(); noSpot.clear(); spot = place ? place(id) : findSpot(id); }
    else if (ex?.ok && big) noteBig('terreno', ex.cost);
  }
  // sin lugar: lo que importa (room: expediente, monumento, base del ciclo, defensa de la amenaza que viene) se hace lugar
  // como lo haría una persona: reacomoda la ciudad y, si no alcanza, guarda deco chica (devuelve la mitad) hasta que entre
  if (!spot && room && (d.cat !== 'deco' || room === 'deco') && d.cat !== 'camino' && !spaceTried.has(id)) {
    spaceTried.add(id);   // una vez por rato y por edificio (reacomodar es caro)
    spot = repackFor(id);
    for (let k = 0; !spot && k < 12; k++) {
      const deco = s.city.buildings.filter(b => E.canRemove(b) && D[b.id].size[0] * D[b.id].size[1] === 1 && (room !== 'deco' || (D[b.id].happy || 0) < (d.happy || 0) / (d.size[0] * d.size[1])))
        .sort((a, b) => E.charmBase(D[a.id]) - E.charmBase(D[b.id]))[0];
      if (!deco) break;
      E.removeBuilding(deco.uid); noSpot.clear();
      spot = findSpot(id) || (k % 3 === 2 ? repackFor(id) : null);
    }
  }
  if (!spot) { if (room === true) roomWanted = id; return 'sin lugar'; }
  if (roomWanted === id) roomWanted = null;
  const r = E.placeBuilding(id, spot[0], spot[1], 0);
  if (r.error) return r.error;
  noSpot.clear();
  return 'done';
}
function upgrade(b, { big = true } = {}) {
  if (!b) return 'x';
  const info = E.upgradeInfo(b);
  if (!info) return 'max';
  const c = E.canUpgrade(b, s, T);
  if (!c.ok) {
    if (c.locked || c.reason === 'Está en obra' || c.damaged) return 'locked';
    if (c.mats) wantMats(info.cost.mats);
    if (big) noteBig('mejorar ' + b.id, info.cost, { metric: !!(c.mats || c.poor) });
    return c.reason;
  }
  if (!afford(info.cost)) { wantMats(info.cost.mats); if (big) noteBig('mejorar ' + b.id, info.cost); return 'reservado'; }
  const r = E.startUpgrade(b.uid);
  return r.error || 'done';
}
function renovate(b) {
  const info = E.renovateInfo(b);
  if (!info) return 'x';
  const c = E.canRenovate(b, s, T);
  if (!c.ok) { if (c.mats) wantMats(info.cost.mats); if (!c.damaged && c.reason !== 'Está en obra') noteBig('renovar ' + b.id, info.cost, { metric: !!(c.mats || c.poor) }); return c.reason; }
  if (!afford(info.cost)) { wantMats(info.cost.mats); noteBig('renovar ' + b.id, info.cost); return 'reservado'; }
  const r = E.startRenovate(b.uid);
  return r.error || 'done';
}
function craft(kind, id) {
  const st = X.craftStatus(kind, id);
  if (!st.ok) { if (st.mats) wantMats(st.cost.mats); return st.reason; }
  if (!afford(st.cost)) { wantMats(st.cost.mats); return 'reservado'; }
  const r = X.craft(kind, id);
  return r.error || 'done';
}
const all = (id) => s.city.buildings.filter(b => b.id === id);
const one = (id) => s.city.buildings.find(b => b.id === id) || null;
const lvl = (id) => E.cycleLevel(id, s, T);
const rank = () => E.townRank();
const L = () => store.level();   // el Nivel (v7: state.classes.leader)

/** Provisiones por día que dan los productores con este ritmo de ratos (cada productor se llena entre rato y rato). */
function provPerDay() {
  const gaps = HOURS.map((h, i) => ((i + 1 < HOURS.length ? HOURS[i + 1] : HOURS[0] + 24) - h) * 3600);
  let tot = 0;
  for (const b of s.city.buildings) {
    const d = D[b.id];
    if (!d.prod?.prov) continue;   // lo que está en obra también cuenta (si no, se construyen de más)
    const perC = E.cycleValue(b.id, 'prov', b.level || 1, d.prod.prov);
    for (const g of gaps) tot += Math.min(d.prod.cap, Math.floor(g / d.prod.cycle)) * perC;
  }
  return tot;
}
/** Tandas por día de un productor con este ritmo de ratos. */
function tandas(id) {
  const d = D[id], gaps = HOURS.map((h, i) => ((i + 1 < HOURS.length ? HOURS[i + 1] : HOURS[0] + 24) - h) * 3600);
  return gaps.reduce((a, g) => a + Math.min(d.prod.cap, Math.floor(g / d.prod.cycle)), 0);
}
const normalsWanted = () => (rank() >= 5 ? 3 : 2);

// ---------------------------------------------------------------- gastar (en orden de prioridad)
function wishlist() {
  const W = [];
  const add = (f) => W.push(f);
  const r = rank();
  // 1. reparar (barato, al instante)
  add(() => { for (const b of TH.damagedBuildings()) { const info = TH.repairInfo(b); if (afford(info.cost)) { TH.repair(b.uid); return 'done'; } wantMats(info.cost.mats); } return 'x'; });
  // 2. obra de rango: con el expediente y el nivel listos va primero (y se guardan monedas para ella)
  add(() => {
    const c = one('castillo'); const rs = E.rankStatus();
    if (!rs.next || isBusy(c)) return 'x';
    const info = E.upgradeInfo(c);
    if (!rs.allOk || !rs.levelOk) return 'x';
    const res = upgrade(c);
    if (res !== 'done') reserve(info.cost);
    return res;
  });
  // 3. misión principal: lo que pide
  add(() => {
    const mq = Q.mainQuest(); if (!mq || mq.done) return 'x';
    const g = mq.goal;
    if (g.type === 'build' && g.id) return build(g.id);
    if (g.type === 'craft') return craft(data.EQUIP_RECIPES[g.id] ? 'equip' : 'reserve', g.id || 'cuerda');
    if (g.type === 'expand') { const ex = E.expansionStatus(); if (ex?.ok) { if (afford(ex.cost)) { E.expand(); noSpot.clear(); return 'done'; } noteBig('terreno', ex.cost); } return 'x'; }
    return 'x';
  });
  // 4. amenaza que se viene: reservas y una defensa de su tipo
  add(() => {
    const st = TH.threatStatus(); if (!st || !st.visible || st.phase === 'pasada') return 'x';
    const info = st.info;
    if (info.have < info.need && st.reserve) { const res = craft('reserve', st.reserve); if (res === 'done') return 'done'; }
    const defId = TD.THREAT_TYPES[st.type].defense;
    const uncovered = info.list.filter(x => !x.covered).length;
    if (uncovered >= 2 && all(defId).length < D[defId].max) { const res = build(defId, { place: defenseSpot, room: true }); if (res === 'done') return 'done'; }
    // las que ya están, donde más cubren (la ciudad cambió desde que se pusieron) y mejoradas si se puede
    if (uncovered >= 2 && !movedFor.has(st.t.id)) { movedFor.add(st.t.id); for (const b of all(defId)) moveDefense(b); }
    for (const b of all(defId)) if ((b.level || 1) < Math.min(5, 1 + Math.ceil(r / 2))) { const res = upgrade(b); if (res === 'done') return res; }
    return 'x';
  });
  // 5. base del ciclo: Casa de Expediciones, Huerta, Taller, Establo, Dispensario (y el Equipaje del t-algo)
  for (const id of ['huerta', 'casa_exp', 'taller', 'establo', 'dispensario']) add(() => (all(id).length ? 'x' : build(id, { room: true })));
  // 5a. la gente (L5): entregar lo que pide un encargo y mejorar herramientas en el Taller (Martillo y Farol primero:
  // los que rinden en la ciudad). Como un jugador prudente: con lo que sobra después del próximo gasto grande (monedas y
  // materiales) y una mejora por rato.
  if (!NO_TOOLS && !opt('no-tool-buy', false)) {
    const spare = (cost) => s.coins - (cost.coins || 0) >= (lastBig?.coins || 0)
      && Object.entries(cost.mats || {}).every(([m, n]) => (s.materials[m] || 0) - n >= 6);
    add(() => { for (const id of PD.PEOPLE_IDS) { const t = PE.currentTask(id, s); if (t?.type === 'deliver' && afford({ mats: t.mats }) && spare({ mats: t.mats })) { if (PE.deliver(id, s).ok) return 'done'; } } return 'x'; });
    add(() => {
      if (toolSession === T0()) return 'x';
      for (const id of ['brigida', 'ramiro', 'nahuel', 'vera', 'olga']) {
        const inf = PE.toolUpgradeInfo(id, s);
        if (inf.ok && afford(inf.cost) && spare(inf.cost)) {
          const c0 = s.coins; if (PE.upgradeTool(id, s).ok) { toolSpend += c0 - s.coins; toolSession = T0(); return 'done'; }
        }
      }
      return 'x';
    });
  }
  // 5b. la Raíz (L1): el Invernadero apenas se encuentra el Núcleo, y la obra de Raíz cuando la Grieta pasa de 40
  add(() => (RZ.raizFound(s) && !all('invernadero').length ? build('invernadero', { room: true }) : 'x'));
  add(() => {
    if (RZ.grieta(s, T) < 40) return 'x';
    const i = RZ.suturaInfo(s, T);
    if (i.can.ok) { RZ.startSutura(s, T); return 'done'; }
    if (i.can.reason === 'Faltan materiales') wantMats(i.cost.mats);
    return 'x';
  });
  // 6. monumento: la primera etapa pendiente del primero abierto sin terminar (se guardan materiales y, con ellos, monedas)
  add(() => {
    for (const id of data.MONUMENT_IDS) {
      const st = E.monumentStatus(id);
      if (!st.unlocked || st.done) continue;
      if (st.busy) return 'x';
      const cost = st.next.cost;
      // sobran monedas y faltan materiales: lo que falta se compra a las aldeas si después queda un colchón
      if (TRADE_ON && !store.hasMats(cost.mats)) {
        const q = E.tradeQuote(cost.mats);
        if (q.ok && s.coins - q.coins >= cost.coins * TRADE_KEEP) { E.buyMissing(cost.mats); tradeLog.push({ day: dayOf(), units: q.units, coins: q.coins }); }
      }
      const res = st.b ? upgrade(st.b) : build(id, { room: true });
      if (res !== 'done') { const matsOk = store.hasMats(addMats(cost.mats, reserved.mats)); reserve(cost, { coins: matsOk, mats: true }); }
      return res;
    }
    return 'x';
  });
  // 7. expediente del próximo rango
  add(() => {
    const rs = E.rankStatus(); if (!rs.next) return 'x';
    const need = Object.fromEntries(rs.reqs.filter(x => !x.ok).map(x => [x.key, x]));
    const pop = E.population();
    const houses = data.BUILDINGS.filter(b => b.cat === 'casa' && !(b.rank > r) && b.unlock <= L());
    if (need.pop) {
      const h = houses.sort((a, b) => b.pop / E.placeCost(b.id).coins - a.pop / E.placeCost(a.id).coins)[0];
      if (h) { const res = build(h.id, { room: true }); if (res === 'done') return res; }
      const up = s.city.buildings.filter(b => D[b.id].cat === 'casa' && E.upgradeInfo(b)).sort((a, b) => E.upgradeInfo(a).cost.coins - E.upgradeInfo(b).cost.coins)[0];
      if (up && upgrade(up) === 'done') return 'done';
    }
    if (need.shops) {
      for (const b of data.BUILDINGS.filter(b => b.cat === 'negocio' && b.unlock <= L() && !(b.rank > r) && !E.countOf(b.id) && (b.popReq || 0) <= pop)) { const res = build(b.id, { room: true }); if (res === 'done') return res; }
    }
    if (need.charm || need.happy) {
      const key = need.happy ? (d) => (d.happy || 0) : (d) => E.charmGain(d.id);
      // por moneda y por lote: en una ciudad llena rinde más lo que da mucho en poco lugar
      const val = (d) => key(d) / (E.placeCost(d.id).coins + 30 * (E.placeCost(d.id).gems || 0) + 150 * d.size[0] * d.size[1]);
      const deco = data.BUILDINGS.filter(b => b.cat === 'deco' && b.unlock <= L() && !(b.rank > r) && E.countOf(b.id) < 8 && (b.cost.coins || b.cost.gems < 20))
        .sort((a, b) => val(b) - val(a));
      // si falta felicidad y no hay lugar, se cambia deco chica por otra que rinda más por lote
      for (const dd of deco.slice(0, 3)) { const res = build(dd.id, { big: false, room: need.happy && (dd.happy || 0) / (dd.size[0] * dd.size[1]) >= 3 ? 'deco' : false }); if (res === 'done') return res; }
    }
    return 'x';
  });
  // 8. provisiones para las salidas del día
  add(() => {
    const want = normalsWanted() * Math.min(X.provMax(), Math.max(XD.EXP.provMinNormal, provUsed));
    const deficit = want - provPerDay();
    if (deficit <= 0.1 * want) return 'x';   // un 10% de menos no amerita otro productor (después sobra y llena el depósito)
    // de a poco: lo que suma menos pero alcanza (mejorar una Huerta, otra Huerta, un Tambo…); si nada alcanza, lo que más suma
    const cands = [];
    for (const b of s.city.buildings) {
      if (!D[b.id].prod?.prov || !E.upgradeInfo(b)) continue;
      const c = E.canUpgrade(b, s, T);
      if (c.locked) continue;
      cands.push({ gain: tandas(b.id) * (E.cycleValue(b.id, 'prov', (b.level || 1) + 1) - E.cycleValue(b.id, 'prov', b.level || 1)), go: () => upgrade(b) });
    }
    for (const id of ['huerta', 'tambo', 'molino', 'conservera'])
      if (all(id).length < D[id].max && !(D[id].rank > r) && D[id].unlock <= L()) cands.push({ gain: tandas(id) * E.cycleValue(id, 'prov', 1), go: () => build(id) });
    if (!cands.length) return 'x';
    cands.sort((a, b) => a.gain - b.gain);
    const pick = cands.find(c => c.gain >= deficit) || cands[cands.length - 1];
    return pick.go();
  });
  // 9. mejoras del ciclo hasta un nivel acorde al rango; Equipaje y defensas abiertas (una de cada tipo)
  add(() => {
    const target = Math.min(5, Math.max(1, r));
    for (const id of ['casa_exp', 'establo', 'taller', 'dispensario']) { const b = one(id); if (b && (b.level || 1) < target) { const res = upgrade(b); if (res === 'done') return res; } }
    return 'x';
  });
  add(() => {
    for (const [id, dd] of Object.entries(data.DEFENSES)) {
      if (all(id).length || (D[id].rank || 1) > r) continue;
      if (dd.threat !== '*' && TD.THREAT_TYPES[dd.threat].rank > r) continue;
      const res = build(id, { place: defenseSpot }); if (res === 'done') return res;
    }
    return 'x';
  });
  // 10. ingresos: negocios que faltan (hasta 2 de cada uno), casas para la población que piden, mejoras de lo que produce
  add(() => {
    const pop = E.population();
    const biz = data.BUILDINGS.filter(b => b.cat === 'negocio' && b.prod?.coins && b.unlock <= L() && !(b.rank > r) && E.countOf(b.id) < 2)
      .sort((a, b) => b.cost.coins - a.cost.coins);
    for (const b of biz) {
      if ((b.popReq || 0) > pop) {
        const h = data.BUILDINGS.filter(x => x.cat === 'casa' && x.unlock <= L() && !(x.rank > r)).sort((a, c) => c.pop / E.placeCost(c.id).coins - a.pop / E.placeCost(a.id).coins)[0];
        if (h && build(h.id) === 'done') return 'done';
        continue;
      }
      const res = build(b.id); if (res === 'done') return res;
    }
    // las casas suman gente al mejorarlas: si la felicidad está justa para el próximo rango, se mejoran solo los negocios
    const rsx = E.rankStatus(), happyTight = rsx.next?.req?.happy && E.happiness().pct < rsx.next.req.happy + 8;
    const ups = s.city.buildings.filter(b => (D[b.id].cat === 'negocio' || (D[b.id].cat === 'casa' && !happyTight)) && D[b.id].prod?.coins && E.upgradeInfo(b))
      .sort((a, b) => E.upgradeInfo(a).cost.coins / (D[a.id].prod.coins / D[a.id].prod.cycle) - E.upgradeInfo(b).cost.coins / (D[b.id].prod.coins / D[b.id].prod.cycle));
    for (const b of ups.slice(0, 2)) { const res = upgrade(b); if (res === 'done') return res; }
    return 'x';
  });
  // 11. renovar a la época actual (lo que produce primero)
  add(() => {
    const list = E.outdatedBuildings().filter(b => !isBusy(b) && !b.damaged).sort((a, b) => (D[b.id].prod ? 1 : 0) - (D[a.id].prod ? 1 : 0) || E.renovateInfo(a).cost.coins - E.renovateInfo(b).cost.coins);
    for (const b of list.slice(0, 2)) { const res = renovate(b); if (res === 'done') return res; }
    return 'x';
  });
  // 12. defensas al nivel del rango
  add(() => {
    const target = Math.ceil(r / 2);
    for (const id of Object.keys(data.DEFENSES)) for (const b of all(id)) if ((b.level || 1) < target) { const res = upgrade(b); if (res === 'done') return res; }
    return 'x';
  });
  // 13. terreno cuando ya se puede
  add(() => { const ex = E.expansionStatus(); if (!ex?.ok) return 'x'; if (afford(ex.cost)) { E.expand(); noSpot.clear(); return 'done'; } noteBig('terreno', ex.cost); return 'x'; });
  return W;
}
let lastBig = null;
function spend() {
  for (let guard = 0; guard < 60; guard++) {
    reserved = { coins: 0, gems: 0, mats: {} };
    bigNext = null; bigMetric = null; matWant = {};
    let did = false;
    for (const f of wishlist()) if (f() === 'done') { did = true; break; }
    if (!did) { lastBig = bigMetric; break; }   // la primera acción grande que quedó sin hacer = el próximo gasto grande
    E.tick();
  }
  // constructoras con gemas (las que se compran) cuando sobran
  const bi = E.builderInfo();
  if (bi && s.gems >= bi.cost.gems + 40 && rank() >= 3) E.buyBuilder();
}

// ---------------------------------------------------------------- cobrar y misiones
function claimAll() {
  Q.claimLogin();
  for (let g = 0; g < 10 && Q.claimMain(); g++) ;
  for (const d of Q.dailyQuests()) if (d.done && !d.claimed) Q.claimDaily(d.id);
  Q.claimDailyBonus();
  for (const a of Q.achievements()) if (a.ready) Q.claimAchievement(a.id);
  CH.claimFreeChest(T);
  for (let g = 0; g < 30; g++) { const t = CH.CHEST_LIST.find(c => CH.chestCount(c.id) > 0); if (!t) break; CH.openChest(t.id); }
  SE.claimAllTiers(T);
  for (const id of AL.claimableSets()) AL.claimSet(id);
  // objetos de la mochila: martillo y reloj de arena sobre la obra más larga
  for (const it of ['hammer', 'hourglass']) {
    if (!CH.itemCount(it)) continue;
    const b = s.city.buildings.filter(o => isBusy(o)).sort((a, c) => E.remainingMs(c, T) - E.remainingMs(a, T))[0];
    if (b && E.remainingMs(b, T) > (it === 'hammer' ? 20 : 50) * 60e3) CH.useCityItem(it, { uid: b.uid });
  }
}
/** Diarias que se cumplen en un toque (cambiar el look, construir 3 cosas chicas, fabricar 2 cosas). */
function dailyHelpers() {
  for (const d of Q.dailyQuests()) {
    if (d.done || d.claimed) continue;
    if (d.goal.type === 'customize') store.setLook('avatar', 'dressColor', s.avatar.dressColor === 'verde' ? 'celeste' : 'verde');
    if (d.goal.type === 'build') for (let k = d.progress; k < d.goal.count; k++) if (build('arbol', { big: false }) !== 'done') break;
    if (d.goal.type === 'craft') for (let k = d.progress; k < d.goal.count; k++) if (craft('equip', 'cuerda') !== 'done' && craft('reserve', 'lena') !== 'done') break;
  }
}

// ---------------------------------------------------------------- expediciones
let expSeed = SEED * 100003;
function regionScore(id, kind) {
  const rg = XD.REGIONS[id], st = X.regionInfo(id);
  let sc = 0;
  for (const [m, pct] of Object.entries(rg.mats)) sc += Math.min(30, matWant[m] || 0) * pct / 100;
  sc += Object.values(rg.mats).reduce((a, p) => a + p, 0) / 100;   // algo trae siempre
  if (kind === 'normal' && !st.done) sc += 6 - 0.6 * st.zone;      // explorar abre terreno y chispas
  return sc - 0.8 * (rg.tier - 1) * (kind === 'normal' && !st.done ? st.zone / 3 : 1);
}
function pickRegion(kind) {
  const open = XD.REGION_IDS.filter(id => X.regionOpen(id));
  const mq = Q.mainQuest();
  if (mq && !mq.done && (mq.goal.type === 'zone' || mq.goal.type === 'expedition') && mq.goal.region && open.includes(mq.goal.region)) {
    if (mq.goal.type === 'zone' ? kind === 'normal' : (!mq.goal.kind || mq.goal.kind === kind)) return mq.goal.region;
  }
  return open.sort((a, b) => regionScore(b, kind) - regionScore(a, kind))[0];
}
/** Materiales de la próxima etapa del monumento que se está juntando ({} si no hay). */
function monumentMats() {
  for (const id of data.MONUMENT_IDS) {
    const st = E.monumentStatus(id);
    if (!st.unlocked || st.done) continue;
    return st.busy ? {} : { ...(st.next.cost.mats || {}) };
  }
  return {};
}
function equipFor() {
  const slots = X.equipSlots();
  if (!slots) return;
  for (const id of ['cuerda', 'carreta', 'lona', 'pala']) {
    if ((s.equipment[id] || 0) > 0) continue;
    if (Object.values(s.equipment).filter(n => n > 0).length >= slots) break;
    craft('equip', id);
  }
}
// Salida con farmeo (paso 2a): el bot "medio" de exp-bots, pero como alguien que junta armas y maestría. Una pelea que
// ya ganó una vez la resuelve rápido (10 s) siempre que la encuentra, y va a buscarla si está a FARM_REACH pasos o menos
// por casillas vistas y le alcanzan las provisiones para volver; una pelea nueva la juega si el rato tiene tiempo
// (maxFights, como antes). --no-farm: el bot de antes (rodea casi todas las peleas).
const XR = await imp('src/expedition/exp-rules.js');
const XG = await imp('src/expedition/exp-gen.js');
const CR = await imp('src/combat/combat-rules.js');
const FARM = !args.includes('--no-farm') && !NO_GEAR;
const FARM_REACH = Number(opt('farm-reach', 4));
const PASS = new Set(['vacio', 'recurso', 'mirador']);
function wantEnemy(run, mem, c) {
  if (!c || !c.seen || c.done || c.content !== 'enemigo' || mem.blocked.has(c.x + ',' + c.y)) return false;
  return CR.canQuickResolve(c.sub, XR.combatWins(run, c.sub)) || mem.maxFights == null || mem.fights < mem.maxFights;
}
/** Primer paso hacia la pelea más cercana que interesa (o null). */
function enemyStep(run, mem) {
  const v = XR.view(run);
  if (v.morale <= 4) return null;
  const N = v.w * v.h, s0 = v.pos[1] * v.w + v.pos[0], dist = new Array(N).fill(-1), prev = new Array(N).fill(-1);
  dist[s0] = 0;
  const q = [s0];
  let target = -1;
  while (q.length && target < 0) {
    const u = q.shift();
    if (dist[u] >= FARM_REACH) continue;
    const ux = u % v.w, uy = (u / v.w) | 0;
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      const x = ux + dx, y = uy + dy;
      if (x < 0 || y < 0 || x >= v.w || y >= v.h) continue;
      const i = y * v.w + x, c = v.cells[i];
      if (dist[i] >= 0 || !c.seen || mem.blocked.has(x + ',' + y)) continue;
      dist[i] = dist[u] + 1; prev[i] = u;
      if (wantEnemy(run, mem, c)) { target = i; break; }
      if (c.done || !c.content || PASS.has(c.content)) q.push(i);
    }
  }
  if (target < 0) return null;
  let i = target;
  while (prev[i] !== s0) i = prev[i];
  const mv = v.moves.find(m => m.x === i % v.w && m.y === ((i / v.w) | 0));
  // tiene que poder volver con la reserva del bot medio después de llegar y pelear
  const left = v.prov - mv?.cost - (dist[target] - 1) * 2 - XD.EXP.enemy.fightProv;
  if (!mv || !mv.ok || left < mv.returnAfter + dist[target] + 1) return null;
  return [mv.x, mv.y];
}
function playFarm(run, seed, opts = {}) {
  const bot = 'medio';
  const r = XG.rng(seed ^ 0x5bd1e995);
  const mem = { blocked: new Set(), party: run.party, wander: 0, bot, fights: 0, maxFights: opts.maxFights ?? null };
  for (let guard = 0; !run.ended && guard < 400; guard++) {
    if (run.pending?.kind === 'combate') { const pd = run.pending, res = BOTS.simFight(run, bot); mem.fights++; XR.endCombat(run, res); if (res.outcome !== 'win') mem.blocked.add(pd.x + ',' + pd.y); continue; }
    if (run.pending?.kind === 'enemigo') {
      const pd = run.pending;
      const ret = XR.returnCostFrom(run, pd.x, pd.y, pd.y * run.w + pd.x);
      const ok = (id) => pd.options.find(o => o.id === id && o.can && run.prov - pd.step - o.prov >= ret + 1);
      const pick = ok('resolver') ? 'resolver' : ok('pelear') && (mem.maxFights == null || mem.fights < mem.maxFights) && run.morale >= 4 ? 'pelear' : null;
      if (pick) { XR.choose(run, pick); continue; }
      mem.blocked.add(pd.x + ',' + pd.y); XR.choose(run, 'retroceder'); continue;
    }
    if (run.pending) { XR.choose(run, BOTS.pickOption(run, bot, mem, r)); continue; }
    const step = enemyStep(run, mem);
    const a = step ? { move: step } : BOTS.decide(run, bot, mem, r);
    if (a.home) { XR.goHome(run); break; }
    const before = run.steps;
    const res = XR.move(run, a.move[0], a.move[1]);
    if (!res.ok) { mem.blocked.add(a.move.join(',')); if (mem.blocked.size > 30) { XR.goHome(run); break; } }
    else if (run.steps === before && !run.pending) mem.blocked.add(a.move.join(','));
  }
  if (!run.ended) XR.goHome(run);
  return XR.result(run);
}
let budget = 0;   // segundos que quedan en el rato
const fightStats = { played: 0, quick: 0, won: 0, mats: 0 };   // peleas de la expedición en los 60 días
let provUsed = 14; // provisiones netas por salida normal (lo que se lleva menos lo que vuelve), promedio móvil
function expedition(kind) {
  const st = X.expeditionStatus();
  if (kind === 'corta' ? !st.canShort : !st.canNormal) return false;
  if (kind === 'normal' && (s.prov || 0) < Math.max(XD.EXP.provMinNormal, Math.ceil(0.8 * X.provMax()))) return false;
  if (budget < (kind === 'corta' ? 90 : 200)) return false;
  reserved = { coins: 0, gems: 0, mats: monumentMats() };   // el equipo no toca lo juntado para el monumento
  if (kind === 'normal') equipFor();
  const region = pickRegion(kind);
  const prov0 = s.prov || 0;
  const r = X.startExpedition({ region, kind });
  if (r.error) return false;
  // una pelea nueva por salida si el rato tiene tiempo (con farmeo alcanza con lo que dura una salida más la pelea)
  const fopt = { maxFights: kind === 'normal' && budget >= 200 + FIGHT_SEC + (FARM ? 0 : 120) ? 1 : 0 };
  const res = FARM ? playFarm(r.run, expSeed++, fopt) : BOTS.play(r.run, 'medio', expSeed++, fopt);
  X.finishExpedition(r.run);
  if (kind === 'normal') provUsed = 0.8 * provUsed + 0.2 * Math.max(0, prov0 - (s.prov || 0));   // lo que de verdad gasta una salida
  const played = (res.fights || []).filter(f => !f.quick).length, quick = (res.fights || []).filter(f => f.quick).length;
  if (adv) { adv.fights = (adv.fights || 0) + played + quick; adv.ex = (adv.ex || '') + (kind === 'corta' ? 'c' : 'n'); }
  fightStats.played += played; fightStats.quick += quick; fightStats.won += (res.fights || []).filter(f => f.outcome === 'win' && !f.quick).length;
  for (const f of res.fights || []) for (const n of Object.values(f.mats || {})) fightStats.mats += n;
  const sec = res.steps * STEP_SEC + 40 + played * FIGHT_SEC + quick * QUICK_SEC;
  budget -= sec;
  T += sec * 1000;
  return true;
}

// ---------------------------------------------------------------- amenazas
const prepSeen = [];   // preparación al enfrentarla (o al resolverse sola) y lo que daría la automática
function threats() {
  TH.tick();
  const st = TH.threatStatus();
  if (!st || !st.canFace || budget < 90) return;
  const auto = TR.autoResolve(st.info.prep, st.f, st.info.enRiesgo);
  prepSeen.push({ id: st.t.id, type: st.type, f: st.f, prep: st.info.prep, enRiesgo: st.info.enRiesgo, auto: auto.pct, autoDamaged: auto.damaged, c: st.info.c, r: st.info.r, have: st.info.have, need: st.info.need, cov: st.info.list.filter(x => x.covered).length });
  const d = TH.startDefense(st.t.id);
  if (d.error) { prepSeen.pop(); return; }
  for (let g = 0; g < 30 && TH.activeDefense(); g++) { TR.botTurn(TH.activeDefense(), { slip: 0.25 }); TH.endTurn(); }
  budget -= 120; T += 120e3;
}

// ---------------------------------------------------------------- expediente (para la meta de rango)
let rk = { rank: 1, okSince: {}, since: T, waitLevel: 0, lastT: T, onlyLevel: false };
function sampleRank() {
  const r = rank();
  const c = one('castillo');
  if (r !== rk.rank) rk = { rank: r, okSince: {}, since: T, waitLevel: 0, lastT: T, onlyLevel: false };
  if (rk.onlyLevel) rk.waitLevel += T - rk.lastT;
  rk.lastT = T;
  if (c && E.isUpgrading(c, T)) return;   // obra de rango en curso (la registra rankStarted)
  const rs = E.rankStatus();
  if (!rs.next) return;
  const st = { level: rs.levelOk };
  for (const q of rs.reqs) st[q.key] = q.ok;
  for (const [k, ok] of Object.entries(st)) { if (ok && !rk.okSince[k]) rk.okSince[k] = T; if (!ok) delete rk.okSince[k]; }
  rk.onlyLevel = !rs.levelOk && rs.reqs.every(q => q.ok);
}

/** Al empezar la obra de rango: qué requisito se cumplió último y cuánto se esperó solo por nivel. */
bus.on('building:upgradeStarted', ({ b, renovate }) => {
  if (b?.id !== 'castillo' || renovate) return;
  const r = b.level;
  if (rk.rank !== r || rankStartAt[r + 1]) return;
  if (rk.onlyLevel) rk.waitLevel += T - rk.lastT;
  rk.lastT = T;
  const rs = E.rankStatus();
  // todo estaba cumplido justo antes de empezar (los planos ya se gastaron): lo que no tenía fecha se cumplió recién
  for (const k of ['level', ...rs.reqs.map(q => q.key)]) if (!rk.okSince[k]) rk.okSince[k] = T;
  const last = Object.entries(rk.okSince).sort((a, c) => c[1] - a[1])[0]?.[0] || '?';
  rankLast.push({ rank: r + 1, last, waitLevel: rk.waitLevel, span: T - rk.since, day: dayOf() });
  rankStartAt[r + 1] = T;
  if (data.eraOfRank(r + 1) !== data.eraOfRank(r)) eraLast.push({ rank: r + 1, last, planosLast: last === 'planos' });
  rk.onlyLevel = false;
});

// ---------------------------------------------------------------- un rato
const sessions = [];
const multMax = { base: 0, boost: 0, sum: 0 };   // { day, hour, coins, big, ratio, provFull }
let sessionStart = null;
async function session(day, hour) {
  T = day0 + day * DAY + hour * 3600e3;
  sessionStart = T;
  budget = SESSION_MIN * 60;
  spaceTried.clear(); movedFor.clear(); roomWanted = null;
  adv = { day, hour, level: 0, mastery: 0, item: 0, drop: 0 };
  const end = T + SESSION_MIN * 60e3;
  E.tick(); TH.tick();
  // el bot no fue al Cerro: a los 3 días del rango 5 encuentra el Núcleo igual
  if (!RZ.raizFound(s) && rankAt[5] && T - rankAt[5] >= 3 * DAY) { rz.how = 'forzado'; RZ.foundNucleo(s, T); }
  peopleCheck();
  claimAll();
  gearUp();
  E.collectAll();
  const provFull = (s.prov || 0) >= E.provCap();
  const arrCoins = s.coins, prevBig = lastBig;
  let step = 0;
  while (T < end || step === 0) {
    noSpot.clear();
    E.tick(); TH.tick(); sampleRank();
    claimAll();
    threats();
    spend();
    dailyHelpers();
    let went = expedition('corta');
    if (!went) for (let k = 0; k < 2; k++) if (expedition('normal')) { went = true; gearUp(); } else break;
    if (went) gearUp();
    // "cobrar todo" se toca al entrar, al volver de una salida y antes de irse (no a cada minuto)
    if (went || T + 60e3 >= end) E.collectAll();
    spend();
    claimAll();
    sampleRank();
    step++;
    if (T < end) { T = Math.min(end, T + 60e3); budget -= 60; }
    if (step > 40) break;
  }
  await flush();
  gearUp();
  advLog.push(adv); adv = null;
  const big = lastBig;
  // multiplicadores de producción (sumados con tope y temporales con tope): el mayor de cualquier edificio que produce monedas
  if (E.productionMult) for (const b of s.city.buildings) if (D[b.id].prod?.coins) { const m = E.productionMult(b.id, s, T); multMax.base = Math.max(multMax.base, m.base); multMax.boost = Math.max(multMax.boost, m.boost); multMax.sum = Math.max(multMax.sum, 1 + m.happy + m.rank + m.mastery + m.monuments); }
  sessions.push({ day, hour, coins: s.coins, big, ratio: big ? s.coins / big.coins : null, provFull, ratioArr: prevBig ? arrCoins / prevBig.coins : null });
  if (TRACE) console.log('rato', 'día', day + 1, hour + ':00', 'llegó', arrCoins + (prevBig ? ' (×' + (arrCoins / prevBig.coins).toFixed(1) + ' de ' + prevBig.what + ')' : ''), 'monedas', s.coins, 'próximo', big ? big.what + ' ' + big.coins + ' (×' + (s.coins / big.coins).toFixed(1) + ')' : '-', 'constructoras libres', E.buildersFree() + '/' + s.builders, 'prov', (s.prov || 0) + '/' + E.provCap(), 'prov/día', provPerDay(), 'por salida', Math.round(provUsed));
  if (!firstMonumentDay && E.monumentsDone() > 0) firstMonumentDay = day + 1;
}

// ---------------------------------------------------------------- correr
const rows = [];
let pass30Day = null;
for (let day = 0; day < DAYS; day++) {
  for (const h of HOURS) await session(day, h);
  rz.grietaByDay[day] = Math.round(RZ.grieta(s, T) * 10) / 10;
  const p = P(day);
  if ([6, 24, 59].includes(day)) leaderLog.push(`día ${day + 1}: nivel ${CL.leaderLevelFromXp(s.classes?.leader?.xp || 0)}`);
  if ([6, 24, 59].includes(day)) masteryLog.push(`día ${day + 1}: ${masteryMax()}`);
  const si = SE.seasonInfo(T);
  if (si.id === 1 && si.level >= 30 && !pass30Day) pass30Day = day + 1;
  const rs = E.rankStatus();
  rows.push({
    día: day + 1, nv: L(), rango: rank(), pase: `${si.id}·${si.level}`, chispas: p.sparks,
    monedas: s.coins, 'próx.': sessions.at(-1).big ? sessions.at(-1).big.coins : '-', gemas: s.gems, '+gem': p.gems, cofres: p.chests,
    prov: `${s.prov}/${E.provCap()}`, salidas: `${p.shorts}+${p.normals}`, mats: Object.values(s.materials).reduce((a, n) => a + n, 0), planos: s.planos,
    mon: E.monumentsDone(), época: E.cityEra(), pob: E.population(), encanto: E.cityCharm(), zonas: E.zonesExplored(), terreno: s.city.expansions, colonos: s.colonos || 0, feliz: E.happiness().pct,
    falta: rs.next ? rs.reqs.filter(q => !q.ok).map(q => `${q.key} ${q.have}/${q.need}`).join(' ') + (rs.levelOk ? '' : ` nv${rs.next.reqLevel}`) : '—',
  });
}
globalThis.Date = RealDate;
console.warn = silence;

// ---------------------------------------------------------------- reporte
const pct = (a, n) => (n ? (100 * a / n) : 0);
const f1 = (x) => (Math.round(x * 10) / 10).toFixed(1);
const mark = (ok) => (ok == null ? '·' : ok ? '✔' : '✘');
const dayOfRank = (r) => (rankAt[r] ? dayOf(rankAt[r]) + 1 : null);
const inRange = (x, a, b) => x != null && x >= a && x <= b;
const S2 = sessions.filter(x => x.day >= 1 && x.day < 60);
const ratioOk = S2.filter(x => x.ratio != null && x.ratio >= 1 && x.ratio <= 3).length;
const ratioLow = S2.filter(x => x.ratio != null && x.ratio < 1).length, ratioHigh = S2.filter(x => x.ratio != null && x.ratio > 3).length;
const seasonDay30 = pass30Day;
// al llegar: el saldo después de cobrar contra lo que se quería comprar al irse del rato anterior (la meta de monedas)
const A2 = S2.filter(x => x.ratioArr != null);
const arrOk = A2.filter(x => x.ratioArr >= 1 && x.ratioArr <= 3).length;
const arrLow = A2.filter(x => x.ratioArr < 1).length, arrHigh = A2.filter(x => x.ratioArr > 3).length;
const tradeUnits = tradeLog.reduce((a, x) => a + x.units, 0), tradeCoins = tradeLog.reduce((a, x) => a + x.coins, 0);
const d60 = Math.min(DAYS, 60);
const sumDays = (k, n = d60) => { let t = 0; for (let d = 0; d < n; d++) t += per[d]?.[k] || 0; return t; };
const chestsPerDay = sumDays('chests') / d60, gemsPerDay = sumDays('gems') / d60;
const lastLevel = rankLast.filter(x => x.last === 'level').length;
const waitFrac = rankLast.length ? rankLast.reduce((a, x) => a + x.waitLevel, 0) / Math.max(1, rankLast.reduce((a, x) => a + x.span, 0)) : 0;
const provFullPct = pct(sessions.filter(x => x.provFull).length, sessions.length);
const planosLastPct = pct(eraLast.filter(x => x.planosLast).length, eraLast.length);
const normalsBy = (lo, hi) => { const ds = rows.filter(r => r.rango >= lo && r.rango <= hi && r.día > 1); return ds.length ? ds.reduce((a, r) => a + per[r.día - 1].normals, 0) / ds.length : null; };
const prepAvg = prepSeen.length ? prepSeen.reduce((a, x) => a + x.prep, 0) / prepSeen.length : null;
const autoAvg = prepSeen.length ? prepSeen.reduce((a, x) => a + x.auto, 0) / prepSeen.length : null;
const real = threatLog.filter(x => x.id !== 'sim');
const dmgAvg = real.length ? real.reduce((a, x) => a + x.damaged, 0) / real.length : null;
// avances por rato (paso 2a): días 1–60
// La meta es por rato de 20 min (PLAN-TRAVESIA.md, 2a): los ratos seguidos se juntan hasta sumar 20 min (con 2 ratos de
// 10 min, un bloque por día; con --min 20, cada rato). La tasa por rato suelto se muestra aparte.
const ADV_MIN = 20;
const ADV1 = advLog.filter(x => x.day < 60);
const ADV = [];
{ let cur = null; for (const x of ADV1) { if (!cur) cur = { day: x.day, min: 0, level: 0, mastery: 0, item: 0, drop: 0, fights: 0 }; for (const k of ['level', 'mastery', 'item', 'drop', 'fights']) cur[k] += x[k] || 0; cur.min += SESSION_MIN; if (cur.min >= ADV_MIN) { ADV.push(cur); cur = null; } } }
const anyAdv = (x) => x.level + x.mastery + x.item + x.drop > 0;
const advAny = ADV.filter(anyAdv).length;
const advPct = pct(advAny, ADV.length);
const adv1Pct = pct(ADV1.filter(anyAdv).length, ADV1.length);
const advBy = (k) => f1(pct(ADV.filter(x => x[k] > 0).length, ADV.length));
if (args.includes('--adv') && !JSON_OUT) { console.log(`avances por rato (+ con avance, − sin; peleas; c corta, n normal), ${advBy('fights')}% de los ratos con pelea:`, Array.from({ length: 60 }, (_, d) => ADV1.filter(x => x.day === d).map(x => (x.level + x.mastery + x.item + x.drop > 0 ? '+' : '-') + (x.fights || 0) + (x.ex || '')).join('/')).join(' ')); }
const summary = {
  seed: SEED, sessions: NSESS, days: DAYS, advPct,
  ratioPct: pct(ratioOk, S2.filter(x => x.ratio != null).length), ratioLow, ratioHigh,
  arrPct: pct(arrOk, A2.length), arrLow, arrHigh, endHighPct: pct(ratioHigh, S2.filter(x => x.ratio != null).length), tradeUnits, tradeCoins,
  pass30: seasonDay30, rankDays: Object.fromEntries([2, 3, 4, 5, 6, 7, 8].map(r => [r, dayOfRank(r)])),
  lastLevelPct: pct(lastLevel, rankLast.length), waitFrac, chestsPerDay, gemsPerDay, firstMonumentDay, provFullPct,
  eraLast, planosLastPct, prepAvg, autoAvg, dmgAvg, normals12: normalsBy(1, 2), normals5: normalsBy(5, 8),
  raiz: (() => {
    const repair = rz.repairCoins + MAT_V * rz.repairMats, sutura = rz.suturaCoins + MAT_V * rz.suturaMats;
    const income = rz.coinsIn + MAT_V * rz.matsIn + PROV_V * rz.provIn;
    return { ...rz, grietaByDay: undefined, grieta: rz.grietaByDay[Math.min(DAYS, 60) - 1] ?? 0, income, repair, sutura, net: income - repair - sutura,
      bonus: MAT_V * rz.invMats, invernadero: !!all('invernadero').length, legacy: RZ.grietaLegacy(s, T) };
  })(),
};
if (JSON_OUT) { console.log(JSON.stringify(summary)); process.exit(0); }

if (!args.includes('--goals')) {
  const show = DAYS > 31 ? rows.filter(r => r.día <= 7 || r.día % 7 === 0 || r.día === DAYS) : rows;
  console.log(`Pixelia · economía del ciclo · ${DAYS} días · ${HOURS.length} ratos por día (${HOURS.map(h => h + ':00').join(', ')}, ${SESSION_MIN} min) · semilla ${SEED}`);
  console.log('Columnas: nv nivel · pase nivel del Pase (acumulado entre temporadas) · chispas del día · monedas al final del día · próx. el próximo gasto grande ·');
  console.log('  +gem gemas ganadas en el día · cofres recibidos en el día · prov depósito · salidas corta+normales · mats materiales guardados · mon monumentos');
  if (!QUIET) console.table(show);
  else console.log('día rango nv pase mon: ' + rows.filter(r => r.día % 2 === 0 || r.día <= 6).map(r => `${r.día}:${r.rango}/${r.nv}/${r.pase.split('·')[1]}/${r.mon}`).join(' '));
  const tot = (k) => { const o = {}; for (let d = 0; d < d60; d++) for (const [a, n] of Object.entries(per[d]?.[k] || {})) o[a] = (o[a] || 0) + n; return Object.entries(o).sort((a, b) => b[1] - a[1]).map(([a, n]) => `${a} ${f1(n / d60)}`).join(' · '); };
  console.log(`chispas por día por fuente (días 1–${d60}): ${tot('sparksBy')}`);
  console.log(`gemas por día por fuente: ${tot('gemsBy')}`);
  console.log(`cofres por día por fuente: ${tot('chestsBy')}`);
  console.log(`monedas por día por fuente: ${tot('coinsBy')}`);
  console.log(`experiencia por día por fuente: ${tot('xpBy')}`);
  { const t = Object.entries(coinsById).sort((a, b) => b[1] - a[1]), all = t.reduce((a, x) => a + x[1], 0) || 1; console.log(`monedas cobradas por edificio: ${t.slice(0, 12).map(([k, v]) => `${k} ${Math.round(100 * v / all)}%`).join(' · ')}`); }
  console.log(`materiales por día, entran: ${tot('matIn')}`);
  console.log(`materiales por día, salen: ${tot('matOut')}`);
  console.log(`subidas de rango (último requisito · espera solo por nivel): ${rankLast.map(x => `${x.rank}@d${x.day + 1} ${x.last} ${f1(x.waitLevel / 36e5)}h/${f1(x.span / 36e5)}h`).join(' · ')}`);
  console.log(`amenazas: ${threatLog.map(x => `${x.id} ${x.type} ${x.pct}% ${x.mode} ${x.damaged}d`).join(' · ')}`);
  console.log(`preparación al llegar: ${prepSeen.map(x => `${x.id} ${x.type} ${Math.round(x.prep * 100)}% (cubiertos ${x.cov}/${x.enRiesgo}, c ${f1(x.c)}, reservas ${x.have}/${x.need}, auto ${x.auto}%)`).join(" · ")}`);
  const ids = {}; for (const b of s.city.buildings) ids[b.id] = (ids[b.id] || 0) + 1;
  console.log('ciudad al final:', Object.entries(ids).map(([k, n]) => `${k}${n > 1 ? '×' + n : ''}`).join(' '));
  console.log('monumentos:', data.MONUMENT_IDS.map(id => { const st = E.monumentStatus(id); return `${id} ${st.stagesDone}/${st.N}${monDone[id] ? ' (día ' + monDone[id] + ')' : ''}`; }).join(' · '));
  const lo = S2.filter(x => x.ratio != null && x.ratio < 1).length;
  console.log(`saldo / próximo gasto grande al final de cada rato (días 2–60): p10 ${f1(q(S2.map(x => x.ratio ?? 0), 0.1))} · p50 ${f1(q(S2.map(x => x.ratio ?? 0), 0.5))} · p90 ${f1(q(S2.map(x => x.ratio ?? 0), 0.9))} · < 1× en ${lo} ratos, > 3× en ${ratioHigh}`);
  console.log(`peleas de la expedición: ${fightStats.played} jugadas (${fightStats.won} ganadas) y ${fightStats.quick} resueltas rápido en ${DAYS} días · ${fightStats.mats} materiales de botín (${f1(fightStats.mats / d60)} por día)`);
  console.log(`comercio con las aldeas: ${tradeLog.length} compras, ${tradeUnits} materiales por ${tradeCoins} monedas (${f1(tradeCoins / d60)} por día)`);
}
function q(a, p) { const t = a.slice().sort((x, y) => x - y); return t.length ? t[Math.min(t.length - 1, Math.floor(p * t.length))] : 0; }

// corridas extra (procesos aparte: el juego es un singleton)
const child = (extra) => {
  const r = spawnSync(process.execPath, [fileURLToPath(import.meta.url), '--json', ...extra], { encoding: 'utf8', maxBuffer: 1 << 24 });
  try { return JSON.parse(r.stdout.trim().split('\n').pop()); } catch { return null; }
};
const s4 = CHECK4 ? child(['--sessions', '4', '--days', '30', '--seed', String(SEED)]) : null;
const raiz3 = RAIZ3 ? ['sellar', 'medida', 'exprimir'].map(m => (m === RAIZ ? summary : child(['--days', String(DAYS), '--seed', String(SEED), '--raiz', m]))) : null;
let raizAdv = null;
if (raiz3 && raiz3.every(x => x?.raiz?.foundDay)) {
  const nets = raiz3.map(x => x.raiz.net), lo = Math.min(...nets);
  raizAdv = lo > 0 ? (Math.max(...nets) - lo) / lo : null;
  if (!args.includes('--goals')) {
    console.log(`\nRaíz (L1) · desde el día en que se encuentra el Núcleo hasta el ${Math.min(DAYS, 60)} · valor neto = monedas + ${MAT_V} × material + ${PROV_V} × provisión que entran − reparaciones − obras de Raíz`);
    for (const x of raiz3) {
      const r = x.raiz;
      console.log(`  ${r.mode.padEnd(8)} Núcleo día ${r.foundDay} (${r.how}) · Grieta al final ${f1(r.grieta)} · amenazas ${r.threats} (${r.damaged} dañados) · Invernadero ${r.invernadero ? 'sí' : 'no'}, ${r.invMats} hierbas · reparaciones ${r.repair} · obras de Raíz ${r.suturas} (${r.sutura}) · neto ${r.net} · rango 7 día ${x.rankDays[7] ?? '—'} · final del Acto 4: ${r.legacy.ending}`);
    }
  }
}
const others = [];
for (let k = 1; k <= RUNS; k++) { const o = child(['--days', String(DAYS), '--seed', String(SEED + k)]); if (o) others.push(o); }
const runsAll = [summary, ...others];
const eraAll = runsAll.flatMap(x => x.eraLast || []);
const planosRunPct = pct(runsAll.filter(x => (x.eraLast || []).some(e => e.planosLast)).length, runsAll.length);

const goals = [
  ['Monedas', A2.length ? summary.arrPct >= 75 : null, `al llegar, saldo entre 1× y 3× de lo que se quería comprar al irse (días 2–60) en ≥ 75%: ${f1(summary.arrPct)}% (< 1×: ${arrLow}, > 3×: ${arrHigh})`],
  ['Monedas', S2.length ? summary.endHighPct <= 10 : null, `al irse, saldo > 3× el próximo gasto grande en ≤ 10% de los ratos: ${f1(summary.endHighPct)}% (${ratioHigh} ratos; entre 1× y 3×: ${f1(summary.ratioPct)}%, < 1×: ${ratioLow})`],
  ['Pase', NSESS === 2 ? inRange(seasonDay30, 22, 25) : NSESS >= 4 ? (seasonDay30 == null || seasonDay30 >= 16) : null, `nivel 30 del Pase entre el día 22 y el 25 (${HOURS.length} ratos): día ${seasonDay30 ?? '> 28'}`],
  ['Pase', s4 ? (s4.pass30 == null || s4.pass30 >= 16) : null, `con 4 ratos por día, nivel 30 no antes del día 16: ${s4 ? 'día ' + (s4.pass30 ?? '> 28') : '(sin correr)'}`],
  ['Rango', dayOfRank(2) != null ? dayOfRank(2) <= 1 : false, `rango 2 el día 1: día ${dayOfRank(2) ?? '—'}`],
  ['Rango', inRange(dayOfRank(3), 4, 6), `rango 3 entre los días 4 y 6: día ${dayOfRank(3) ?? '—'}`],
  ['Rango', DAYS >= 25 ? inRange(dayOfRank(5), 18, 25) : null, `rango 5 entre los días 18 y 25: día ${dayOfRank(5) ?? '—'}`],
  ['Rango', DAYS >= 70 ? inRange(dayOfRank(8), 70, 90) : null, `rango 8 entre los días 70 y 90: ${DAYS >= 70 ? 'día ' + (dayOfRank(8) ?? '—') : '(hace falta --days 90)'}`],
  ['Rango', rankLast.length ? summary.lastLevelPct <= 25 : null, `el último requisito es el nivel en ≤ 25% de las subidas: ${f1(summary.lastLevelPct)}% (${lastLevel} de ${rankLast.length})`],
  ['Rango', rankLast.length ? waitFrac < 0.10 : null, `esperando solo por nivel < 10% del tiempo entre rangos: ${f1(waitFrac * 100)}%`],
  ['Prov.', summary.normals12 != null ? summary.normals12 >= 1.8 : null, `rango 1–2: 2 salidas normales por día + la corta: ${summary.normals12 != null ? f1(summary.normals12) : '—'} normales`],
  ['Prov.', summary.normals5 != null ? summary.normals5 >= 2.7 : null, `rango 5+: 3 normales por día: ${summary.normals5 != null ? f1(summary.normals5) : '—'}`],
  ['Prov.', provFullPct < 30, `depósito al tope al llegar en < 30% de los ratos: ${f1(provFullPct)}%`],
  ['Amen.', prepAvg != null ? prepAvg >= 0.7 : null, `preparación al llegar ≥ 70%: ${prepAvg != null ? Math.round(prepAvg * 100) + '%' : '—'}`],
  ['Amen.', autoAvg != null ? autoAvg >= 75 && autoAvg <= 95 : null, `la automática daría 75–95%: ${autoAvg != null ? f1(autoAvg) + '%' : '—'}`],
  ['Amen.', dmgAvg != null ? dmgAvg <= 2 : null, `≤ 2 edificios dañados en promedio: ${dmgAvg != null ? f1(dmgAvg) : '—'}`],
  ['Mult.', !E.productionMult ? false : multMax.base <= E.PROD_MULT_CAP + 1e-9 && multMax.boost <= E.BOOST_MULT_CAP + 1e-9, `producción: 1 + felicidad + rango + maestría + monumentos con tope ×${E.PROD_MULT_CAP} y pociones × eventos con tope ×${E.BOOST_MULT_CAP}: máximo visto ×${multMax.base.toFixed(2)} (sin tope daría ×${multMax.sum.toFixed(2)}) · temporales ×${multMax.boost.toFixed(2)}`],
  ['Otros', chestsPerDay <= 1.5, `cofres ≤ 1,5 por día: ${f1(chestsPerDay)}`],
  ['Otros', gemsPerDay >= 15 && gemsPerDay <= 25, `gemas 15–25 por día: ${f1(gemsPerDay)}`],
  ['Otros', inRange(firstMonumentDay, 10, 14), `primer monumento terminado entre los días 10 y 14: día ${firstMonumentDay ?? '—'}`],
  ['Raíz', raiz3 ? (raizAdv != null && raizAdv <= 0.15) : null, `ninguna extracción saca más de 15 % de ventaja neta a los ${Math.min(DAYS, 60)} días contando las amenazas: ${raizAdv != null ? f1(raizAdv * 100) + '%' : raiz3 ? '(falta el Núcleo en alguna)' : '(sin correr)'}`],
  // L1: exprimir sube la Grieta y con ella la fuerza o la cantidad de amenazas (Σ g de cada aviso, o más avisos). El daño
  // que queda depende de cómo se defiende quien juega (con el doble de bonus se defiende mejor): se muestra, no se pide.
  ['Raíz', raiz3 ? (() => { const [a, , c] = raiz3.map(x => x?.raiz); return !!(a && c && c.bonus > a.bonus && c.grieta > a.grieta && ((c.gSum || 0) > (a.gSum || 0) || c.threats > a.threats)); })() : null, `exprimir da más bonus y trae más Grieta y amenazas más fuertes o más seguido que sellar: ${raiz3 ? raiz3.map(x => `${x?.raiz?.mode} bonus ${x?.raiz?.bonus} · Grieta ${f1(x?.raiz?.grieta ?? 0)} · amenazas ${x?.raiz?.threats} (fuerza de la Grieta +${x?.raiz?.gSum || 0}, dañados ${x?.raiz?.damaged})`).join(' | ') : '(sin correr)'}`],
  ['Avance', ADV.length ? advPct >= 90 : null, `al menos un avance cada ${ADV_MIN} min de juego (subir de Nivel, una maestría de arma u objeto o un arma nueva; días 1–60) en ≥ 90 %: ${f1(advPct)}% (${ADV.length - advAny} de ${ADV.length} sin nada · con Nivel ${advBy('level')}%, maestría de arma ${advBy('mastery')}%, de objeto ${advBy('item')}%, arma ${advBy('drop')}% · por rato de ${SESSION_MIN} min ${f1(adv1Pct)}%)`],
  ['Otros', eraAll.length ? planosRunPct <= 30 : null, `los planos son lo último que falta para un cambio de época en ≤ 30% de las corridas: ${f1(planosRunPct)}% de ${runsAll.length} corrida(s) (${eraAll.filter(e => e.planosLast).length} de ${eraAll.length} cambios)`],
];
console.log(`\nMetas de balance (DESIGN-CORE.md §8) · ${HOURS.length} ratos/día · ${DAYS} días · semilla ${SEED}${RUNS ? ` (+${RUNS} corridas)` : ''}`);
for (const [g, ok, t] of goals) console.log(`  ${mark(ok)} ${g.padEnd(6)} ${t}`);
if (others.length) console.log(`  corridas extra: ${others.map(o => `semilla ${o.seed}: rango 3 d${o.rankDays[3] ?? "—"} · 5 d${o.rankDays[5] ?? "—"} · 8 d${o.rankDays[8] ?? "—"} · monumento d${o.firstMonumentDay ?? "—"} · Pase d${o.pass30 ?? "> 28"} · monedas al llegar ${f1(o.arrPct)}% · cofres ${f1(o.chestsPerDay)} · gemas ${f1(o.gemsPerDay)}`).join(' | ')}`);
console.log(`  (info) nivel del líder: ${leaderLog.join(' · ')} — meta del paso 7: 6 o 7 al llegar a la Costa`);
console.log(`  (info) en cada rango (líder · clases · herramientas)${NO_TOOLS ? ' · sin herramientas' : ''}: ${progLog.map(p => `r${p.rank} d${p.day}: nv ${p.leader} · cl ${p.classLevel.join('/') || '-'} · ${Object.entries(p.tools).filter(([, n]) => n).map(([k, n]) => k.slice(0, 3) + n).join(' ') || '-'}`).join(' | ')}`);
{
  const a = A.arsenalState(s), eq = A.WIELDERS.map(w => [w, A.equippedOn(s, w)]).filter(([, w]) => w);
  console.log(`  (info) armas: ${f1(weaponsIn / d60)} por día (${weaponsIn} en ${d60} días; ${fightStats.played} peleas jugadas y ${fightStats.quick} resueltas rápido) · en el arsenal ${a.items.length}, filtro ${a.filter} · equipadas: ${eq.map(([w, x]) => `${w} ${x.type} ${A.RARITIES[x.rarity].id}`).join(', ') || '-'}`);
  console.log(`  (info) rasgos rehechos: ${rerollStats.n} (${f1(rerollStats.mats / d60)} materiales y ${Math.round(rerollStats.coins / d60)} monedas por día)`);
  console.log(`  (info) maestría más alta: ${masteryLog.join(' · ')} · por tipo al final: ${Object.entries(a.mastery).map(([k, x]) => `${k} ${A.masteryLevel(x)}`).join(' · ')} · objetos: ${Object.entries(a.itemMastery).map(([k, x]) => `${k} ${A.masteryLevel(x, A.ITEM_MASTERY_MAX)}`).join(' · ') || '-'}`);
  const tp = TL.talentPoints(s);
  console.log(`  (info) talentos: ${tp.spent}/${tp.total} puntos (${Object.entries(tp.byBranch).map(([b, n]) => `${b} ${n}`).join(' · ')}), paragon ${tp.paragon.spent}`);
  console.log(`  (info) Fuerza al llegar a cada rango (escuadra de la salida) contra la recomendada de la región: ${powerLog.map(p => `r${p.rank} d${p.day}: ${p.power} · ${p.region} ${p.rec ? p.rec.join('–') : '-'}${p.rec ? ` (×${(p.power / p.rec[1]).toFixed(2)}, enemigos ×${PW.foeScale(p.power, p.rec[1]).hp.toFixed(2)})` : ''}`).join(' | ')}`);
}
if (!NO_TOOLS) { const tl = PE.toolLevels(s); console.log(`  (info) herramientas al final: ${Object.entries(tl).map(([k, n]) => `${k} ${n}`).join(' · ')} · monedas gastadas en mejorarlas ${toolSpend}`); }
if (args.includes('--goals-json')) {
  // para --seeds: la meta (grupo y texto hasta los dos puntos) y el valor medido (lo que sigue)
  const out = goals.map(([g, ok, t]) => { const i = t.indexOf(': '); return { key: g + ' ' + (i > 0 ? t.slice(0, i) : t), ok, val: i > 0 ? t.slice(i + 2).slice(0, 220) : '' }; });
  console.log('GOALS ' + JSON.stringify(out));
  process.exit(0);
}
const failed = goals.filter(g => g[1] === false).length;
console.log(`  ${goals.filter(g => g[1] === true).length} ✔ · ${failed} ✘ · ${goals.filter(g => g[1] == null).length} sin medir`);
process.exit(0);
