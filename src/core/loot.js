// Botín y construcción de personaje (PLAN-FOTO, paso A3): el motor. Puro: sin DOM, sin store ni bus (se importa desde
// Node); el azar siempre sale de una semilla. Las tablas están en src/core/loot-data.js.
//
//   1. Objetos: rollItem arma un arma con rareza y de 1 a 4 rasgos (w.affixes) que cambian habilidades. Van al arsenal
//      de siempre (state.arsenal.items); las armas viejas, con w.traits, siguen valiendo.
//   2. "Sos lo que llevás puesto": loadout() arma lo que cada uno lleva a la pelea. El arma define las habilidades
//      activas (WEAPON_SKILLS + maestría) y sus rasgos, el árbol y las reliquias las cambian. El resultado va tal cual a
//      newBattle({ ...cfg, gear, rules }).
//   3. Reliquias de salida: newRun, relicOffer, takeRelic. Viven en el objeto de la salida (lo guarda la Travesía).
//   4. Botín: battleLoot(resultado de la pelea o de la resolución automática) → materiales, armas y veta para el árbol,
//      mejor cuanto más alta la Marea. applyLoot lo guarda.
//
// Enganche con la Travesía (src/voyage/): al entrar a un nodo de pelea, `const L = loadout(state, { party, leaderCls,
// run })` y `newBattle({ encounter, seed, marea: run.marea, party, gear: L.gear, rules: L.rules, … })`; al terminar,
// `applyLoot(state, battleLoot({ result, source, marea: run.marea, seed, mods: L.loot, luck: state.arsenal.luck,
// wins: run.wins }))` y `noteWin(run, result)`. En un nodo de reliquia: relicOffer(run) y takeRelic(run, id).
import * as A from './arsenal.js';
import { FX, AFFIXES, AFFIX_IDS, AFFIX_COUNT, WEAPON_SKILLS, SKILL_AT, SKILL_SLOTS, LOOT, RELICS, RELIC_IDS, RELIC_OFFER, RELIC_MAX } from './loot-data.js';
import { treeEffects, addTreeXp, fxText } from './tree.js';
import { ABILITIES, MAREA_MAX } from '../combat/combat-data.js';
import { hashSeed } from '../combat/combat-rules.js';
import { t } from './i18n.js';

export { fxText };
export const relicName = (id) => t(`relic.${id}.name`);
export const relicText = (id) => t(`relic.${id}.text`);

// ---------- azar ----------
/** Generador con semilla (mulberry32): () => [0, 1). */
export function rngOf(seed) {
  let a = seed | 0;
  return () => { a = (a + 0x6d2b79f5) | 0; let x = Math.imul(a ^ (a >>> 15), 1 | a); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
}
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const mareaOf = (m) => clamp(m | 0 || 1, 1, MAREA_MAX);
const int = (rng, a, b) => a + Math.min(b - a, Math.floor(rng() * (b - a + 1)));
function weighted(rng, list, weight) {
  const tot = list.reduce((s, x) => s + weight(x), 0);
  let r = rng() * tot;
  for (const x of list) { r -= weight(x); if (r < 0) return x; }
  return list[list.length - 1];
}

// ---------- objetos ----------
/** Rasgos que puede traer ese tipo de arma con esa rareza. */
/** ¿Ese efecto le sirve a ese tipo de arma? (uno de habilidad tiene que tocar alguna de las suyas) */
const usable = (id, type) => {
  const f = FX[id], W = WEAPON_SKILLS[type];
  return !f.abil || !W || [W.basic, ...W.skills].some(s => matches(ABILITIES[s], f.abil));
};
export const affixPool = (type, rarity) => AFFIX_IDS.filter(id => (AFFIXES[id].min || 0) <= rarity && (!AFFIXES[id].types || AFFIXES[id].types.includes(type)) && usable(id, type));
/** De 1 a 4 rasgos sin repetir, con el valor de esa Marea. */
export function rollAffixes(rng, { type, rarity = 0, marea = 1 } = {}) {
  const [mn, mx] = AFFIX_COUNT[clamp(rarity | 0, 0, AFFIX_COUNT.length - 1)];
  const n = int(rng, mn, mx);
  const out = [];
  let pool = affixPool(type, rarity);
  const own = WEAPON_SKILLS[type] ? [WEAPON_SKILLS[type].basic, ...WEAPON_SKILLS[type].skills] : [];
  while (out.length < n && pool.length) {
    const id = weighted(rng, pool, x => AFFIXES[x].w);
    pool = pool.filter(x => x !== id && !(FX[id].affinity && FX[x].affinity));   // una sola afinidad por arma
    const [a, b] = AFFIXES[id].v[mareaOf(marea) - 1];
    const af = { id, v: int(rng, a, b) };
    if (AFFIXES[id].skills) {
      const sk = AFFIXES[id].skills.filter(s => !own.includes(s));
      af.skill = sk[Math.min(sk.length - 1, Math.floor(rng() * sk.length))];
    }
    out.push(af);
  }
  return out;
}
/**
 * Un arma nueva (sin uid: la pone addWeapon). opts: { source 'pelea' | 'elite' | 'jefe', marea, type, rarity (fija),
 * minRarity, quality (puntos de % de subir un escalón de rareza) }.
 */
export function rollItem(rng, opts = {}) {
  const marea = mareaOf(opts.marea);
  const odds = (LOOT.odds[opts.source] || LOOT.odds.pelea)[marea];
  let rarity = opts.rarity | 0;
  if (opts.rarity == null) {
    rarity = weighted(rng, odds.map((_, i) => i), i => odds[i]);
    if (rng() < (opts.quality || 0) / 100) rarity++;
  }
  rarity = clamp(Math.max(rarity, opts.minRarity || 0), 0, A.RARITIES.length - 1);
  const type = A.WEAPON_TYPES[opts.type] ? opts.type : A.WEAPON_IDS[Math.min(A.WEAPON_IDS.length - 1, Math.floor(rng() * A.WEAPON_IDS.length))];
  return { type, rarity, traits: [], affixes: rollAffixes(rng, { type, rarity, marea }), tier: marea, src: opts.source || 'pelea' };
}
/** Los rasgos válidos de un arma (una vieja no trae ninguno). */
export const affixesOf = (w) => (Array.isArray(w?.affixes) ? w.affixes.filter(a => a && FX[a.id] && Number.isFinite(a.v)) : []);
/** Fuerza del objeto: la del arsenal más lo que pesan sus rasgos. Sirve para comparar dos armas. */
export function itemPower(w) {
  if (!w) return 0;
  return A.weaponPower(w) + Math.round(affixesOf(w).reduce((s, a) => s + FX[a.id].pw * a.v, 0));
}
/** Líneas de la ficha del objeto: una por rasgo. */
export const itemLines = (w) => affixesOf(w).map(fxText);

// ---------- efectos ----------
const emptyMods = () => ({ hp: 0, atk: 0, armor: 0, mv: 0, flags: {}, affinity: [], abil: {}, skills: [], loot: { find: 0, quality: 0, veta: 0, mastery: 0, mats: 0 } });
const isBasic = (def) => def.kind === 'attack' && !def.cd && !def.element;
function matches(def, m) {   // (declarada con function: se usa más arriba, en affixPool)
  if (m.basic) return isBasic(def);
  if (m.kind && !m.kind.includes(def.kind)) return false;
  if (m.ranged && !def.ranged) return false;
  if (m.cdMin && (def.cd || 0) < m.cdMin) return false;
  return true;
}
/** Suma un efecto { id, v, skill } a los mods de alguien. */
function addFx(out, e) {
  const f = FX[e.id];
  if (!f || !e.v) return out;
  if (f.stat) out[f.stat] += e.v;
  else if (f.flag) out.flags[f.flag] = (out.flags[f.flag] || 0) + e.v;
  else if (f.loot) out.loot[f.loot] += e.v;
  else if (f.affinity) { if (!out.affinity.includes(f.affinity)) out.affinity.push(f.affinity); }
  else if (f.skill) { if (e.skill && ABILITIES[e.skill]) out.skills.push(e.skill); }
  else if (f.abil) {
    for (const def of Object.values(ABILITIES)) {
      if (!matches(def, f.abil)) continue;
      const p = out.abil[def.id] || (out.abil[def.id] = {});
      p[f.mod] = (p[f.mod] || 0) + e.v * (f.sign || 1);
    }
  }
  return out;
}
/** Junta reglas del combate: foeHp se multiplica, los números se suman y lo demás queda prendido. */
export function mergeRules(list) {
  const out = {};
  for (const r of list) for (const [k, v] of Object.entries(r || {})) {
    if (k === 'foeHp') out[k] = (out[k] || 1) * v;
    else if (typeof v === 'number') out[k] = (out[k] || 0) + v;
    else out[k] = out[k] || v;
  }
  return out;
}
/** Junta reglas del botín: los números se suman (stackMax: el mayor) y lo demás queda prendido. */
function mergeLoot(base, list) {
  const out = { ...base };
  for (const r of list) for (const [k, v] of Object.entries(r || {})) {
    if (k === 'stackMax') out[k] = Math.max(out[k] || 0, v);
    else if (typeof v === 'number') out[k] = (out[k] || 0) + v;
    else out[k] = out[k] || v;
  }
  return out;
}

// ---------- "sos lo que llevás puesto" ----------
/** Habilidades del arma que ya abrió la maestría. */
export function unlockedSkills(type, masteryLv = 1) {
  const W = WEAPON_SKILLS[type];
  return W ? W.skills.filter((_, i) => masteryLv >= SKILL_AT[i]) : [];
}
/** Las activas: el golpe del arma y hasta `slots` de las abiertas (picks elige; si no, las primeras). */
export function weaponSkills(type, masteryLv = 1, picks = [], slots = SKILL_SLOTS) {
  const W = WEAPON_SKILLS[type];
  if (!W) return [];
  const open = unlockedSkills(type, masteryLv);
  const chosen = [...new Set((picks || []).filter(id => open.includes(id)))];
  for (const id of open) if (chosen.length < slots && !chosen.includes(id)) chosen.push(id);
  return [W.basic, ...chosen.slice(0, Math.max(0, slots))];
}
/** Elige qué habilidades del arma lleva alguien (state.arsenal.picks[quién]). → { ok, picks } */
export function pickSkills(state, who, ids) {
  const a = A.arsenalState(state);
  if (!a.picks || typeof a.picks !== 'object') a.picks = {};
  const all = new Set(Object.values(WEAPON_SKILLS).flatMap(W => W.skills));
  a.picks[who] = [...new Set((ids || []).filter(id => all.has(id)))].slice(0, SKILL_SLOTS);
  return { ok: true, picks: a.picks[who] };
}
/** Efectos de la salida: lo que dan las reliquias. { fx, rules, loot, skillCap } */
export function runEffects(run) {
  const out = { fx: [], rules: [], loot: [], skillCap: null };
  for (const id of run?.relics || []) {
    const R = RELICS[id];
    if (!R) continue;
    for (const f of R.fx || []) out.fx.push({ ...f, who: 'all' });
    if (R.rules) out.rules.push(R.rules);
    if (R.loot) out.loot.push(R.loot);
    if (R.skillCap != null) out.skillCap = out.skillCap == null ? R.skillCap : Math.min(out.skillCap, R.skillCap);
  }
  return out;
}
/**
 * Lo que lleva el grupo a una pelea. party: las clases que van; leaderCls: la clase del líder (o null); run: la salida
 * (reliquias); talents: T.talentMods(state) si se quieren sumar los talentos del 2a.
 * → { gear: { lider, <clase>… } (para newBattle), rules, loot (para battleLoot), skills: { quién: [ids] } }
 */
export function loadout(state, { party = [], leaderCls = null, run = null, talents = null } = {}) {
  const a = A.arsenalState(state);
  const tree = treeEffects(state);
  const rel = runEffects(run);
  const shared = [...tree.fx, ...rel.fx];
  const gear = {}, skills = {};
  const loot = { find: 0, quality: 0, veta: 0, mastery: 0, mats: 0 };
  for (const who of ['lider', ...party]) {
    const base = A.gearMods(state, who, { leaderCls, talents });
    const m = emptyMods();
    const w = A.equippedOn(state, who);
    for (const e of affixesOf(w)) addFx(m, e);
    for (const e of shared) if (e.who !== 'lider' || who === 'lider') addFx(m, e);
    const g = { ...base, hp: base.hp + m.hp, atk: base.atk + m.atk, armor: base.armor + m.armor, mv: m.mv, flags: { ...base.flags },
      affinity: [...new Set([...base.affinity, ...m.affinity])], abil: m.abil };
    for (const [k, n] of Object.entries(m.flags)) g.flags[k] = (g.flags[k] || 0) + n;
    if (base.type && WEAPON_SKILLS[base.type]) {
      const lv = A.masteryLevel(a.mastery[base.type] || 0);
      const slots = rel.skillCap != null ? rel.skillCap : SKILL_SLOTS;
      g.skills = [...new Set([...weaponSkills(base.type, lv, a.picks?.[who], slots), ...(rel.skillCap != null ? [] : m.skills)])];
      skills[who] = g.skills;
    }
    gear[who] = g;
    for (const k of Object.keys(loot)) loot[k] += m.loot[k];   // el botín lo suma cada uno que va
  }
  return { gear, rules: mergeRules([...tree.rules, ...rel.rules]), loot: mergeLoot(loot, [...tree.loot, ...rel.loot]), skills };
}
/** Le pone a cada uno la mejor arma que puede llevar (la de más fuerza; nadie repite). → { quién: uid } */
export function equipBest(state, party = [], leaderCls = null) {
  const a = A.arsenalState(state);
  const taken = new Set();
  const out = {};
  for (const who of ['lider', ...party]) {
    const best = a.items
      .filter(w => !taken.has(w.uid) && A.canWield(who, w.type))
      .sort((x, y) => itemPower(y) - itemPower(x))[0];
    if (!best) continue;
    const cur = A.equippedOn(state, who);
    if (cur && !taken.has(cur.uid) && itemPower(cur) >= itemPower(best)) { taken.add(cur.uid); out[who] = cur.uid; continue; }
    // equipWeapon se la saca a quien la tuviera: quien queda sin arma la elige en su turno
    if (A.equipWeapon(state, who, best.uid).ok) { taken.add(best.uid); out[who] = best.uid; }
  }
  return out;
}

// ---------- reliquias de salida ----------
/** Una salida nueva. La Travesía guarda este objeto mientras dura. */
export function newRun({ seed = 1, marea = 1 } = {}) {
  return { v: 1, seed: seed >>> 0, marea: mareaOf(marea), relics: [], wins: 0, offers: 0, best: {} };
}
/** Las reliquias que se ofrecen ahora (misma salida y mismo momento = las mismas). Vacío si ya no entran más. */
export function relicOffer(run, n = RELIC_OFFER) {
  if (!run || run.relics.length >= RELIC_MAX) return [];
  const pool = RELIC_IDS.filter(id => !run.relics.includes(id));
  const rng = rngOf(hashSeed('reliquia', run.seed, run.offers | 0));
  const out = [];
  while (out.length < n && pool.length) out.push(pool.splice(Math.min(pool.length - 1, Math.floor(rng() * pool.length)), 1)[0]);
  return out;
}
/** Se queda con una de las ofrecidas. → { ok } */
export function takeRelic(run, id) {
  if (!run || !RELICS[id] || run.relics.includes(id) || !relicOffer(run).includes(id)) return { ok: false };
  run.relics.push(id);
  run.offers = (run.offers | 0) + 1;
  return { ok: true, relic: RELICS[id] };
}
/** Pasa de largo la oferta (la próxima trae otras). */
export function skipRelic(run) { if (run) run.offers = (run.offers | 0) + 1; }
/** Anota una pelea ganada: cuenta para las reliquias que crecen y guarda las mejores estrellas (resolución automática). */
export function noteWin(run, result) {
  if (!run || result?.outcome !== 'win') return;
  run.wins++;
  run.best[result.enc] = Math.max(run.best[result.enc] || 0, result.stars || 0);
}

// ---------- botín ----------
/**
 * El botín de una pelea ganada, jugada o resuelta sola (el mismo: botín completo). result: lo que devuelve result() o
 * autoResolve() de combat-rules. source: 'pelea' | 'elite' | 'jefe'. mods: loadout().loot. luck: peleas seguidas sin un
 * arma rara o mejor. wins: peleas ganadas en la salida.
 * → { mats, items: [armas], veta, luck, marea }
 */
export function battleLoot({ result, source = 'pelea', marea = 1, seed = 1, mods = {}, luck = 0, wins = 0 } = {}) {
  const M = mareaOf(marea);
  const out = { mats: {}, items: [], veta: 0, luck: Math.max(0, luck | 0), marea: M };
  if (!result || result.outcome !== 'win') return out;
  const src = LOOT.odds[source] ? source : 'pelea';
  const stars = clamp(result.stars | 0, 1, 3);
  const rng = rngOf(hashSeed('botin', result.enc, seed, M, src));
  // materiales: los de la pelea (ya vienen con la Marea y las estrellas) y lo que suman el árbol y las reliquias
  Object.assign(out.mats, result.loot?.mats || {});
  const keys = Object.keys(out.mats);
  const extra = Math.max(0, mods.mats | 0) + Math.min(mods.stackMax || 0, wins | 0) * (mods.stack || 0);
  for (let k = 0; k < extra && keys.length; k++) out.mats[keys[k % keys.length]]++;
  // armas: la Marea del botín (la Vela negra la sube un escalón) decide las chances de rareza y el valor de los rasgos
  const lootM = mareaOf(M + (mods.mareaPlus | 0));
  const tbl = src === 'elite' && mods.eliteAsBoss ? 'jefe' : src;
  let n = src === 'pelea' ? (rng() < LOOT.drop[lootM] + LOOT.starDrop[stars] + (mods.find || 0) / 100 ? 1 : 0) : LOOT.count[src][lootM];
  if (mods.sure) n = Math.max(1, n);
  if (mods.mirror) n *= 2;
  for (let i = 0; i < n; i++) {
    const w = rollItem(rng, { source: tbl, marea: lootM, quality: mods.quality, minRarity: out.luck >= LOOT.luck.after ? LOOT.luck.min : 0 });
    if (mods.mirror && w.rarity > 0) { w.rarity--; w.affixes = w.affixes.slice(0, AFFIX_COUNT[w.rarity][1]); }
    out.items.push(w);
    out.luck = w.rarity >= LOOT.luck.min ? 0 : out.luck;
  }
  if (!out.items.some(w => w.rarity >= LOOT.luck.min)) out.luck++;
  out.veta = Math.round(LOOT.veta[src][M] * LOOT.starVeta[stars] * (1 + (mods.veta || 0) / 100));
  return out;
}
/**
 * Guarda el botín: las armas al arsenal (con el filtro y el tope de siempre), la veta al árbol y el contador de suerte.
 * Los materiales no: los da quien llama (la economía no es de este módulo). → { weapons, scrapped, points, mats }
 */
export function applyLoot(state, loot, { scrapBonus = 0 } = {}) {
  const a = A.arsenalState(state);
  const weapons = [], scrapped = {};
  for (const w of loot?.items || []) {
    const r = A.addWeapon(state, w, { scrapBonus });
    if (!r.auto) weapons.push(r.weapon);
    for (const [k, n] of Object.entries(r.scrapped || {})) scrapped[k] = (scrapped[k] || 0) + n;
  }
  a.luck = Math.max(0, loot?.luck | 0);
  return { weapons, scrapped, points: addTreeXp(state, loot?.veta || 0), mats: { ...(loot?.mats || {}) } };
}
