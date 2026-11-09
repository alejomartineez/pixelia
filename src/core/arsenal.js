// Arsenal (La Travesía, paso 2a): las armas como objetos, la maestría por tipo de arma y por objeto del Taller.
// Puro: sin DOM, sin store ni bus (se importa desde Node). El estado vive en state.arsenal y quien llama le pasa el
// state; pagar, avisar y dar lo desarmado lo hace src/core/gear.js. Diseño: DESIGN-COMBAT.md §18.
//
// state.arsenal = {
//   v: 1, nextUid,
//   items: [{ uid, type, rarity 0..4, traits: [{ id, el? }], src, at }],
//   equipped: { lider: uid, guerrero: uid, … },   // quién lleva qué (el 2b suma a los reclutas)
//   filter: −1..3,                                 // desarme automático: lo que cae con rareza ≤ filter se desarma solo
//   mastery: { espada: xp, … }, itemMastery: { botiquin: xp, … },
//   luck: n,                                       // peleas seguidas sin un arma rara o mejor (contador de suerte)
// }
import { MASTERY_STEPS, REGION_MAT_IDS } from './data.js';
import { ITEM_IDS, ELEMENTS } from '../combat/combat-data.js';
import { CLASS_IDS } from '../combat/classes.js';
import { t } from './i18n.js';

/** Los textos (claves arsenal.* de src/i18n/es.js): getters, para que salgan en el idioma de ese momento. */
export const TXT = {
  get noWeapon() { return t('arsenal.noWeapon'); }, get locked() { return t('arsenal.locked'); },
  get notFound() { return t('arsenal.notFound'); }, get equipped() { return t('arsenal.equippedLocked'); },
  get noTrait() { return t('arsenal.noTrait'); },
};
/**
 * Pone getters de texto en cada dato de una tabla (name → `${prefix}.${id}.name`, …): las tablas se arman al cargar el
 * módulo, antes de elegir idioma, así que el texto se resuelve al leerlo. Enumerables: un spread copia el texto.
 */
function withText(table, prefix, fields = { name: 'name', text: 'text' }) {
  for (const o of Object.values(table)) {
    for (const [field, sub] of Object.entries(fields)) {
      Object.defineProperty(o, field, { get: () => t(sub ? `${prefix}.${o.id}.${sub}` : `${prefix}.${o.id}`), enumerable: true, configurable: true });
    }
  }
  return table;
}

// ---------- tipos, rarezas y rasgos ----------
/**
 * Tipos de arma. gear: la pieza de GEAR (src/avatar/figure.js) que se ve en el modelo. classes: quién la puede llevar
 * (el líder lleva cualquiera). techs: la técnica propia que abre la maestría en el 3, el 6 y el 10.
 */
export const WEAPON_TYPES = {
  espada: { id: 'espada', gear: 'espada', classes: ['guerrero', 'saqueador'], techs: [
    { id: 'guardia_alta', flag: 'guardAdj' },
    { id: 'estocada', atk: 1 },
    { id: 'parada', armor: 1 }] },
  hacha: { id: 'hacha', gear: 'hacha', classes: ['guerrero', 'saqueador', 'forjador'], techs: [
    { id: 'tala', flag: 'lootKill' },
    { id: 'hachazo', atk: 1 },
    { id: 'leñador', hp: 3 }] },
  arco: { id: 'arco', gear: 'arco', classes: ['cazador', 'saqueador'], techs: [
    { id: 'ojo_largo', flag: 'intentPlus' },
    { id: 'tiro_marcado', flag: 'markPlus' },
    { id: 'cuerda_tensa', atk: 1 }] },
  baston: { id: 'baston', gear: 'baston', classes: ['monje', 'curandero'], techs: [
    { id: 'pulso', flag: 'healPlus' },
    { id: 'paso_firme', flag: 'noStuck' },
    { id: 'raiz_honda', hp: 3 }] },
  martillo: { id: 'martillo', gear: 'martillo', classes: ['forjador', 'guerrero'], techs: [
    { id: 'remache', flag: 'trapPlus' },
    { id: 'apuntalar', flag: 'wallPlus' },
    { id: 'mazazo', atk: 1 }] },
  lanza: { id: 'lanza', gear: 'lanza', classes: ['guerrero', 'monje', 'cazador'], techs: [
    { id: 'distancia', flag: 'noStuck' },
    { id: 'punta', flag: 'markPlus' },
    { id: 'embestida', atk: 1 }] },
  escudo: { id: 'escudo', gear: 'escudo', classes: ['guerrero', 'forjador', 'curandero'], techs: [
    { id: 'muralla', flag: 'guardAdj' },
    { id: 'bloqueo', armor: 1 },
    { id: 'aguante', hp: 3 }] },
};
// name: arsenal.type.<id>; cada técnica, arsenal.tech.<id>.name y .text
withText(WEAPON_TYPES, 'arsenal.type', { name: null });
for (const T of Object.values(WEAPON_TYPES)) withText(T.techs, 'arsenal.tech');
export const WEAPON_IDS = Object.keys(WEAPON_TYPES);
/** El arma que cada clase lleva cuando no tiene una equipada (la de su kit, CLASS_KIT de figure.js). */
export const CLASS_WEAPON = { guerrero: 'espada', cazador: 'arco', forjador: 'martillo', curandero: 'baston', monje: 'baston', saqueador: 'hacha' };
/** Quiénes llevan armas: el líder y las 6 clases (el Cuartel del 2b suma a los reclutas). */
export const WIELDERS = ['lider', ...CLASS_IDS];

/**
 * Rarezas. stats: lo que da el arma sola; traits: cuántos rasgos al azar; affinity: chance de afinidad elemental.
 * scrap: materiales al desarmar (1, 2, 4, 7, 12 desde el balance del 2a: con el doble, lo desarmado adelantaba los
 * monumentos en sim:economy).
 */
export const RARITIES = [
  { id: 'comun', color: '#a39a8c', stats: {}, traits: 1, affinity: 0, scrap: 1 },
  { id: 'poco_comun', color: '#6f9a5b', stats: { hp: 1 }, traits: 1, affinity: 0, scrap: 2 },
  { id: 'rara', color: '#4f7fb0', stats: { hp: 2 }, traits: 2, affinity: 0.5, scrap: 4 },
  { id: 'epica', color: '#8a5ab0', stats: { hp: 2, atk: 1 }, traits: 2, affinity: 1, scrap: 7 },
  { id: 'reliquia', color: '#c99a3a', stats: { hp: 3, atk: 1 }, traits: 2, affinity: 1, scrap: 12 },
];
withText(RARITIES, 'arsenal.rarity', { name: null });
/** Chances de rareza (en %) según de dónde sale. */
export const DROP_ODDS = {
  pelea: [62, 27, 8, 2.5, 0.5],
  jefe: [0, 45, 38, 14, 3],
  cofre: [40, 38, 16, 5, 1],
};
/** Contador de suerte: tras `after` peleas seguidas sin un arma rara o mejor, la próxima es rara como mínimo. */
export const LUCK = { after: 12, min: 2 };
/** Probabilidad de que una pelea ganada deje un arma (los jefes dejan siempre). */
export const DROP_CHANCE = { pelea: 0.45, jefe: 1 };
/** Lugar en el arsenal: lo que se pasa se desarma solo (lo de menos fuerza primero, nunca lo equipado). */
export const ARSENAL_CAP = 40;

/**
 * Rasgos al azar (1 o 2 según la rareza). Cada uno es chico y se ve: vida, coraza, una pasiva del combate (flag) o algo
 * de la travesía (maestría, hallazgo). minRarity: desde qué rareza puede salir. La afinidad elemental (`afinidad`) es
 * el rasgo de rareza: sale aparte, en raras (50 %) y épicas o reliquias (siempre), y suma 1 de daño a las
 * habilidades de su elemento (combat-rules: affinity). La maestría del arma con su elemento abre la reacción en el 2d.
 */
export const TRAITS = {
  vida: { id: 'vida', hp: 1 },
  vida2: { id: 'vida2', hp: 2, minRarity: 2 },
  coraza: { id: 'coraza', armor: 1, minRarity: 3 },
  vigia: { id: 'vigia', flag: 'intentPlus' },
  curas: { id: 'curas', flag: 'healPlus' },
  botin: { id: 'botin', flag: 'lootWin' },
  temple: { id: 'temple', mastery: 0.25 },
  hallazgo: { id: 'hallazgo', find: 0.05 },
  afinidad: { id: 'afinidad', affinity: true, rarityOnly: true },
};
withText(TRAITS, 'arsenal.trait');   // arsenal.trait.<id>.name y .text
export const TRAIT_POOL = Object.values(TRAITS).filter(t => !t.rarityOnly).map(t => t.id);

// ---------- azar (las funciones reciben rng: () => [0, 1)) ----------
const pickWeighted = (rng, weights) => {
  const tot = weights.reduce((a, w) => a + w, 0);
  let x = rng() * tot;
  for (let i = 0; i < weights.length; i++) { x -= weights[i]; if (x < 0) return i; }
  return weights.length - 1;
};
const pickOne = (rng, arr) => arr[Math.min(arr.length - 1, Math.floor(rng() * arr.length))];
/** Un rasgo al azar que la rareza permite y que el arma no tenga. */
function rollTrait(rng, rarity, has = []) {
  const pool = TRAIT_POOL.filter(id => (TRAITS[id].minRarity || 0) <= rarity && !has.includes(id));
  return pool.length ? { id: pickOne(rng, pool) } : null;
}
/** Elementos que pueden salir como afinidad (los de combat-data). */
export const AFFINITY_ELEMENTS = () => Object.keys(ELEMENTS);

/**
 * Arma nueva (sin uid: la pone addWeapon). opts: { source 'pelea'|'jefe'|'cofre', type, rarity (fija), minRarity,
 * element (afinidad preferida: la de la isla) }.
 */
export function rollWeapon(rng, opts = {}) {
  const odds = DROP_ODDS[opts.source] || DROP_ODDS.pelea;
  let rarity = opts.rarity != null ? opts.rarity : pickWeighted(rng, odds);
  rarity = Math.max(opts.minRarity || 0, Math.min(RARITIES.length - 1, rarity | 0));
  const type = WEAPON_TYPES[opts.type] ? opts.type : pickOne(rng, WEAPON_IDS);
  const traits = [];
  for (let i = 0; i < RARITIES[rarity].traits; i++) { const t = rollTrait(rng, rarity, traits.map(x => x.id)); if (t) traits.push(t); }
  if (rng() < RARITIES[rarity].affinity) {
    const els = AFFINITY_ELEMENTS();
    traits.push({ id: 'afinidad', el: ELEMENTS[opts.element] && rng() < 0.6 ? opts.element : pickOne(rng, els) });
  }
  return { type, rarity, traits, src: opts.source || 'pelea' };
}

// ---------- estado ----------
/** Completa state.arsenal (idempotente). */
export function arsenalState(state) {
  if (!state.arsenal || typeof state.arsenal !== 'object') state.arsenal = {};
  const a = state.arsenal;
  a.v = 1;
  if (!Array.isArray(a.items)) a.items = [];
  a.items = a.items.filter(w => w && WEAPON_TYPES[w.type]);
  for (const w of a.items) {
    w.rarity = Math.max(0, Math.min(RARITIES.length - 1, w.rarity | 0));
    if (!Array.isArray(w.traits)) w.traits = [];
    w.traits = w.traits.filter(t => t && TRAITS[t.id]);
  }
  a.nextUid = Math.max(Number(a.nextUid) || 1, 1 + a.items.reduce((m, w) => Math.max(m, w.uid | 0), 0));
  for (const w of a.items) if (!w.uid) w.uid = a.nextUid++;
  if (!a.equipped || typeof a.equipped !== 'object') a.equipped = {};
  for (const [who, uid] of Object.entries(a.equipped)) if (!a.items.some(w => w.uid === uid)) delete a.equipped[who];
  a.filter = Number.isInteger(a.filter) ? Math.max(-1, Math.min(3, a.filter)) : -1;
  for (const k of ['mastery', 'itemMastery']) if (!a[k] || typeof a[k] !== 'object') a[k] = {};
  a.luck = Math.max(0, a.luck | 0);
  return a;
}
export const weaponByUid = (state, uid) => arsenalState(state).items.find(w => w.uid === uid) || null;
export const equippedOn = (state, who) => { const a = arsenalState(state); return a.items.find(w => w.uid === a.equipped[who]) || null; };
const whoHas = (state, uid) => Object.entries(arsenalState(state).equipped).find(([, u]) => u === uid)?.[0] || null;
export const isEquipped = (state, uid) => !!whoHas(state, uid);
/** ¿Esa persona (lider o una clase) puede llevar ese tipo? */
export const canWield = (who, type) => !!WEAPON_TYPES[type] && (who === 'lider' || WEAPON_TYPES[type].classes.includes(who));
/** El tipo de arma que usa: la equipada o la de su clase (el líder sin arma, la de su clase o ninguna). */
export function wieldType(state, who, leaderCls = null) {
  const w = equippedOn(state, who);
  if (w) return w.type;
  return CLASS_WEAPON[who === 'lider' ? leaderCls : who] || null;
}

// ---------- lo que da un arma ----------
/** { hp, atk, armor, flags, mastery (multiplicador extra), find, affinity: [elementos] } de un arma (o de nada). */
export function weaponStats(w) {
  const out = { hp: 0, atk: 0, armor: 0, flags: {}, mastery: 0, find: 0, affinity: [] };
  if (!w || !WEAPON_TYPES[w.type]) return out;
  const r = RARITIES[w.rarity] || RARITIES[0];
  out.hp += r.stats.hp || 0; out.atk += r.stats.atk || 0;
  if (w.type === 'escudo' && out.atk) { out.armor += out.atk; out.atk = 0; }   // el escudo no pega: cubre
  for (const t of w.traits || []) {
    const T = TRAITS[t.id];
    if (!T) continue;
    out.hp += T.hp || 0; out.armor += T.armor || 0; out.mastery += T.mastery || 0; out.find += T.find || 0;
    if (T.flag) out.flags[T.flag] = (out.flags[T.flag] || 0) + 1;
    if (T.affinity && t.el) out.affinity.push(t.el);
  }
  return out;
}
/** Fuerza de un arma (el número que se muestra): lo que suma al combate, con el mismo peso que powerOf. */
export function weaponPower(w) {
  if (!w) return 0;
  const s = weaponStats(w);
  return 10 + 10 * s.hp + 30 * s.atk + 40 * s.armor + 15 * Object.values(s.flags).reduce((a, n) => a + n, 0)
    + 20 * s.affinity.length + Math.round(40 * s.mastery + 200 * s.find) + 5 * (w.rarity | 0);
}
/** Nombre para mostrar: "Hacha rara afín a la Raíz". */
export function weaponName(w) {
  if (!w) return TXT.noWeapon;
  const T = WEAPON_TYPES[w.type], r = RARITIES[w.rarity] || RARITIES[0];
  // el adjetivo concuerda con el género del tipo en cada idioma (arsenal.gender.<tipo>: f o m)
  const adj = t(`arsenal.adj.${t(`arsenal.gender.${w.type}`)}.${r.id}`);
  const aff = (w.traits || []).find(x => x.id === 'afinidad' && x.el);
  const el = aff ? ELEMENTS[aff.el]?.name : null;
  return el ? t('arsenal.weaponNameEl', { type: T.name, adj, el }) : t('arsenal.weaponName', { type: T.name, adj });
}

// ---------- equipar, desarmar, rehacer ----------
/** Suma un arma al arsenal. Con el filtro (o sin lugar) puede desarmarse sola: { weapon, scrapped: mats|null }. */
export function addWeapon(state, w, { scrapBonus = 0 } = {}) {
  const a = arsenalState(state);
  const weapon = { ...w, traits: (w.traits || []).map(t => ({ ...t })), uid: a.nextUid++, at: w.at || 0 };
  if (weapon.rarity <= a.filter) return { weapon, scrapped: scrapValue(weapon, scrapBonus), auto: true };
  a.items.push(weapon);
  let scrapped = null;
  while (a.items.length > ARSENAL_CAP) {   // sin lugar: se desarma lo de menos fuerza que no esté equipado
    const loose = a.items.filter(x => !isEquipped(state, x.uid)).sort((x, y) => weaponPower(x) - weaponPower(y))[0];
    if (!loose) break;
    a.items.splice(a.items.indexOf(loose), 1);
    scrapped = addMats(scrapped || {}, scrapValue(loose, scrapBonus));
  }
  return { weapon, scrapped, auto: false };
}
const addMats = (a, b) => { for (const [k, n] of Object.entries(b || {})) a[k] = (a[k] || 0) + n; return a; };
/** Equipa un arma a alguien (lider o clase). La saca de quien la tuviera. */
export function equipWeapon(state, who, uid) {
  const a = arsenalState(state);
  const w = weaponByUid(state, uid);
  if (!w) return { ok: false, why: TXT.notFound };
  if (!WIELDERS.includes(who) || !canWield(who, w.type)) return { ok: false, why: TXT.locked };
  const prev = whoHas(state, uid);
  if (prev) delete a.equipped[prev];
  a.equipped[who] = uid;
  return { ok: true, weapon: w, from: prev };
}
export function unequipWeapon(state, who) {
  const a = arsenalState(state);
  const had = a.equipped[who] != null;
  delete a.equipped[who];
  return { ok: had };
}
/** Materiales que da desarmar un arma (rareza × 1, repartidos entre los 4 de región; +bonus por talento). */
export function scrapValue(w, bonus = 0) {
  const n = (RARITIES[w?.rarity | 0] || RARITIES[0]).scrap + Math.max(0, bonus | 0);
  const out = {};
  const ids = REGION_MAT_IDS;
  const first = ['mineral', 'madera', 'piedra', 'hierbas'].filter(id => ids.includes(id));
  for (let i = 0; i < n; i++) { const id = first[i % first.length]; out[id] = (out[id] || 0) + 1; }
  return out;
}
/** Desarma un arma que no esté equipada. Devuelve { ok, mats } (los materiales los da gear.js). */
export function scrapWeapon(state, uid, bonus = 0) {
  const a = arsenalState(state);
  const w = weaponByUid(state, uid);
  if (!w) return { ok: false, why: TXT.notFound };
  if (isEquipped(state, uid)) return { ok: false, why: TXT.equipped };
  a.items.splice(a.items.indexOf(w), 1);
  return { ok: true, mats: scrapValue(w, bonus), weapon: w };
}
/** Costo de rehacer un rasgo: monedas y materiales según la rareza (−10 % por punto del talento). */
export function rerollCost(w, discount = 0) {
  const r = (w?.rarity | 0) + 1;
  const k = Math.max(0.5, 1 - discount);
  return { coins: Math.round(150 * r * r * k), mats: { mineral: Math.max(1, Math.round(2 * r * k)), madera: Math.max(1, Math.round(r * k)) } };
}
/** Rehace el rasgo idx de un arma (la afinidad se rehace a otro elemento). No cobra: el costo lo paga gear.js. */
export function rerollTrait(state, uid, idx, rng) {
  const w = weaponByUid(state, uid);
  if (!w) return { ok: false, why: TXT.notFound };
  const t = w.traits[idx];
  if (!t) return { ok: false, why: TXT.noTrait };
  if (t.id === 'afinidad') {
    const els = AFFINITY_ELEMENTS().filter(e => e !== t.el);
    w.traits[idx] = { id: 'afinidad', el: els.length ? pickOne(rng, els) : t.el };
  } else {
    const others = w.traits.filter((_, i) => i !== idx).map(x => x.id);
    const nt = rollTrait(rng, w.rarity, [...others, t.id]) || t;
    w.traits[idx] = nt;
  }
  return { ok: true, trait: w.traits[idx], weapon: w };
}
/** Filtro de desarme automático: −1 apagado; 0 comunes; 1 hasta poco comunes; … */
export function setScrapFilter(state, rarity) {
  const a = arsenalState(state);
  a.filter = Math.max(-1, Math.min(3, rarity | 0));
  return a.filter;
}

// ---------- maestría ----------
/**
 * Curva de maestría (experiencia total para cada nivel, 1..20). Sale de MASTERY_STEPS (data.js, la de los edificios):
 * sus 5 umbrales × MASTERY_SCALE caen en los niveles 4, 8, 12, 16 y 20, y en el medio se reparte en proporción
 * geométrica. Una pelea da su xp (20–60) al tipo de arma de cada uno que pelea.
 */
export const MASTERY_SCALE = 0.2;
export const MASTERY_MAX = 20;
export const ITEM_MASTERY_MAX = 10;
export const MASTERY_CURVE = (() => {
  const anchors = [[1, 0], [2, 30], [4, MASTERY_STEPS[0] * MASTERY_SCALE], ...MASTERY_STEPS.slice(1).map((v, i) => [8 + 4 * i, v * MASTERY_SCALE])];
  const out = [0, 0];
  for (let lv = 2; lv <= MASTERY_MAX; lv++) {
    const j = anchors.findIndex(([l]) => l >= lv);
    const [l1, v1] = anchors[j], [l0, v0] = anchors[j - 1];
    const f = (lv - l0) / (l1 - l0);
    out.push(Math.round(v0 > 0 ? v0 * Math.pow(v1 / v0, f) : v0 + (v1 - v0) * f));
  }
  return out;   // out[lv] = xp total para llegar a lv
})();
export function masteryLevel(xp = 0, max = MASTERY_MAX) {
  let lv = 1;
  while (lv < max && (xp || 0) >= MASTERY_CURVE[lv + 1]) lv++;
  return lv;
}
/** { level, xp, into, need, max } */
export function masteryXpInfo(xp = 0, max = MASTERY_MAX) {
  const level = masteryLevel(xp, max);
  const top = level >= max;
  const base = MASTERY_CURVE[level];
  return { level, xp, into: top ? 0 : xp - base, need: top ? 0 : MASTERY_CURVE[level + 1] - base, max: top };
}
/** Marcos del arma (cosméticos): el último que alcanzó la maestría. */
export const MASTERY_FRAMES = [
  { lv: 4, id: 'bronce' }, { lv: 8, id: 'plata' },
  { lv: 10, id: 'oro' }, { lv: 12, id: 'grabado' },
  { lv: 14, id: 'brillo' }, { lv: 16, id: 'estela' },
  { lv: 18, id: 'aura' }, { lv: 20, id: 'nombre' },
];
withText(MASTERY_FRAMES, 'arsenal.frame', { name: null });   // arsenal.frame.<id>
/** Vida que da la maestría (nivel 2, 5 y 8). */
export const MASTERY_HP_AT = [2, 5, 8];
/** Técnicas: niveles que abren las 3 técnicas del tipo. */
export const MASTERY_TECH_AT = [3, 6, 10];
/** Lo que abre cada nivel de maestría de un tipo (para la interfaz). */
export function masteryUnlock(type, lv) {
  const T = WEAPON_TYPES[type];
  if (!T) return null;
  const ti = MASTERY_TECH_AT.indexOf(lv);
  if (ti >= 0) return { kind: 'tech', ...T.techs[ti] };
  if (MASTERY_HP_AT.includes(lv)) return { kind: 'hp', name: t('arsenal.unlock.hp'), text: t('arsenal.unlock.hpText') };
  const fr = MASTERY_FRAMES.find(f => f.lv === lv);
  if (fr) return { kind: 'frame', ...fr, text: t('arsenal.unlock.frameText', { name: fr.name }) };
  return null;
}
/** { hp, atk, armor, flags, techs, frame } que da la maestría de un tipo a quien lo usa. */
export function masteryPerks(type, xp = 0) {
  const lv = masteryLevel(xp);
  const out = { level: lv, hp: MASTERY_HP_AT.filter(l => lv >= l).length, atk: 0, armor: 0, flags: {}, techs: [], frame: null };
  const T = WEAPON_TYPES[type];
  if (!T) return out;
  MASTERY_TECH_AT.forEach((l, i) => {
    if (lv < l) return;
    const t = T.techs[i];
    out.techs.push(t.id);
    out.hp += t.hp || 0; out.atk += t.atk || 0; out.armor += t.armor || 0;
    if (t.flag) out.flags[t.flag] = (out.flags[t.flag] || 0) + 1;
  });
  out.frame = [...MASTERY_FRAMES].reverse().find(f => lv >= f.lv)?.id || null;
  return out;
}
/** Maestría de un objeto del Taller (1..10): +1 a su efecto en el 4 y en el 8; marco en el 10. */
export const ITEM_MASTERY_PLUS_AT = [4, 8];
export const itemMasteryPlus = (xp = 0) => ITEM_MASTERY_PLUS_AT.filter(l => masteryLevel(xp, ITEM_MASTERY_MAX) >= l).length;
/** Experiencia de maestría por usar un objeto del Taller en una pelea. */
export const ITEM_USE_XP = 40;
/** { botiquin: +n, … } para newBattle (itemPlus). */
export function itemPlusOf(state) {
  const a = arsenalState(state);
  return Object.fromEntries(ITEM_IDS.map(id => [id, itemMasteryPlus(a.itemMastery[id] || 0)]).filter(([, n]) => n));
}
/** Suma maestría a un tipo de arma (o a un objeto con item: true). Devuelve { from, to } o null si no subió. */
export function addMastery(state, id, xp, { item = false } = {}) {
  const a = arsenalState(state);
  const bag = item ? a.itemMastery : a.mastery;
  const max = item ? ITEM_MASTERY_MAX : MASTERY_MAX;
  if (item ? !ITEM_IDS.includes(id) : !WEAPON_TYPES[id]) return null;
  const n = Math.max(0, Math.round(xp));
  if (!n) return null;
  const from = masteryLevel(bag[id] || 0, max);
  bag[id] = (bag[id] || 0) + n;
  const to = masteryLevel(bag[id], max);
  return to > from ? { from, to } : null;
}

// ---------- lo que lleva cada uno al combate ----------
const sumInto = (o, s) => {
  o.hp += s.hp || 0; o.atk += s.atk || 0; o.armor += s.armor || 0;
  for (const [k, n] of Object.entries(s.flags || {})) o.flags[k] = (o.flags[k] || 0) + n;
  return o;
};
/**
 * Mods de combate de alguien (lider o clase): arma equipada + maestría del tipo que usa (+ talentos si se pasan).
 * { hp, atk, armor, flags, affinity: [elementos], type }. newBattle los suma al kit (opción gear).
 */
export function gearMods(state, who, { leaderCls = null, talents = null } = {}) {
  const a = arsenalState(state);
  const w = equippedOn(state, who);
  const type = wieldType(state, who, leaderCls);
  const out = { hp: 0, atk: 0, armor: 0, flags: {}, affinity: [], type, uid: w?.uid || null };
  const ws = weaponStats(w);
  sumInto(out, ws);
  out.affinity = ws.affinity.slice();
  if (type) sumInto(out, masteryPerks(type, a.mastery[type] || 0));
  if (talents) sumInto(out, who === 'lider' ? talents.lider : talents.squad);
  return out;
}
