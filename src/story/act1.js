// Acto 1, segunda parte (paso 6b; DESIGN-STORY.md §5 "Estado (paso 6b…)", plan §C, §I y "Actos"): los jefes en sus
// lugares, el faro de la Costa y el primer abordaje pirata, que cierra el acto.
//   - La bestia del Bañado espera en "la poza honda", al fondo de la salida normal al Bañado, desde el rango 3 (el
//     capítulo "El agua que respira", en el orden en que se abren las regiones: DESIGN-STORY §4) y hasta vencerla.
//   - El faro viejo es el objetivo de la salida normal a la Costa desde el rango 6 hasta encenderlo. `faroDue`.
//     Al volver con el objetivo cumplido: `lightFaro` → story.flags.faro y 'story:faro'.
//   - El abordaje llega un rato después de encender el faro (ABORDAJE.delayMs): un dirigible se arrima al borde de la
//     isla y se pelea en la ciudad (encuentro costa_capitana), con revancha. Ganarlo cierra el Acto 1.
// La lógica es pura sobre `state` (sirve para Node); `startAbordaje` usa el router de ctx.
import { bus } from '../core/bus.js';
import { store } from '../core/state.js';
import * as E from '../core/economy.js';
import * as K from '../core/classes.js';
import { ENCOUNTERS, ELEMENTS as C_ELEMENTS, ITEMS, TUTORIAL_PARTY, COMBAT } from '../combat/combat-data.js';
import * as C from '../combat/combat-rules.js';
import { combatConditions, cityHour, cityWeather, isNightHour } from '../core/ambience.js';

const S = () => store.state;
export const BOSS_LAIRS = { banado: { enc: 'banado_bestia', name: 'la poza honda', flag: 'bestia_vencida', rank: 3 } };
export const FARO = { region: 'costa', rank: 6, name: 'el faro viejo' };
/** El abordaje: a cuánto de encender el faro llega el dirigible, y su encuentro. */
export const ABORDAJE = { delayMs: 15 * 60e3, enc: 'costa_capitana', flag: 'capitana_vencida' };

function flags(s) {
  if (!s.story || typeof s.story !== 'object') s.story = {};
  if (!s.story.flags || typeof s.story.flags !== 'object') s.story.flags = {};
  return s.story.flags;
}
const losses = (s, enc) => Math.max(0, Number(s.combat?.losses?.[enc]) || 0);
/** Intento contra un jefe (revancha, DESIGN-COMBAT §6): 1 + las derrotas de antes, hasta 3. */
export const bossAttempt = (s, enc, extra = 0) => 1 + Math.min(COMBAT.revancha?.max ?? 2, losses(s, enc) + extra);

// ---------- jefes en sus lugares ----------
/** El jefe que espera en la salida normal a esa región (o null). */
export function lairFor(s = S(), region) {
  const L = BOSS_LAIRS[region];
  if (!L || flags(s)[L.flag]) return null;
  if (E.townRank(s) < L.rank) return null;
  return L.enc;
}
/** ¿La salida normal a la Costa va al faro viejo? */
export function faroDue(s = S(), region) {
  return region === FARO.region && !flags(s).faro && E.townRank(s) >= FARO.rank;
}
/** Se encendió el faro (al volver con el objetivo cumplido). Idempotente. */
export function lightFaro(s = S(), now = Date.now()) {
  const f = flags(s);
  if (f.faro) return false;
  f.faro = now;
  const a = abordajeState(s);
  a.at = now + ABORDAJE.delayMs;
  store.markDirty();
  bus.emit('story:flag', { id: 'faro' });
  bus.emit('story:faro', { at: now });
  return true;
}

// ---------- el abordaje ----------
/** state.story.abordaje = { at (cuándo llega), arrived (ms), tries, won (ms) } (se completa solo en partidas viejas). */
export function abordajeState(s = S()) {
  flags(s);
  const st = s.story;
  if (!st.abordaje || typeof st.abordaje !== 'object') st.abordaje = {};
  const a = st.abordaje;
  a.tries = Math.max(0, Number(a.tries) || 0);
  if (st.flags.faro && !a.at) a.at = st.flags.faro + ABORDAJE.delayMs;
  return a;
}
/** 'none' (sin faro) · 'waiting' (el dirigible viene) · 'ready' (en el borde, esperando pelea) · 'done'. */
export function abordajeStatus(s = S(), now = Date.now()) {
  const f = flags(s);
  if (f[ABORDAJE.flag]) return 'done';
  if (!f.faro) return 'none';
  const a = abordajeState(s);
  return now >= a.at ? 'ready' : 'waiting';
}
/** Revisa si llegó el dirigible: la primera vez emite 'abordaje:arrive'. Devuelve el estado. */
export function syncAbordaje(s = S(), now = Date.now()) {
  const st = abordajeStatus(s, now);
  if (st === 'ready') {
    const a = abordajeState(s);
    if (!a.arrived) { a.arrived = now; store.markDirty(); bus.emit('abordaje:arrive', { at: now }); }
  }
  return st;
}
/** Para pruebas y para el atajo ?abordaje=1: trae el dirigible ya. */
export function rushAbordaje(s = S(), now = Date.now()) {
  if (!flags(s).faro) flags(s).faro = now;
  abordajeState(s).at = now;
  store.markDirty();
  return syncAbordaje(s, now);
}

/** Quiénes defienden la isla: el líder y las 3 clases de nivel más alto de la ciudad (cansadas o no: es tu casa). */
export function defenders(s = S()) {
  const list = K.cityClasses(s).slice().sort((a, b) => (b.classLevel || 0) - (a.classLevel || 0) || (b.level || 0) - (a.level || 0)).map(r => r.id);
  const out = list.slice(0, 3);
  for (const r of TUTORIAL_PARTY) { if (out.length >= 3) break; if (!out.includes(r)) out.push(r); }
  return out;
}
/** Consumibles del depósito que llegan a la pelea (uno de cada, hasta 2; se gastan solo si se usan). */
export function defenseItems(s = S()) {
  const have = s.equipment || {};
  return ['botiquin', 'farol', 'lona', 'cuerda', 'pala'].filter(id => ITEMS[id] && (have[id] || 0) > 0).slice(0, 2);
}
/** La pelea del abordaje con la gente de la ciudad (JSON puro, como las de la expedición). */
export function abordajeBattle(s = S(), { seed = null } = {}) {
  const a = abordajeState(s);
  const party = defenders(s);
  const lm = K.leaderMods(s);
  const elements = (s.story?.elements || []).filter(id => !!C_ELEMENTS[id]);
  const classLevel = {}, picks = {};
  for (const id of party) { classLevel[id] = Math.max(1, K.memberLevel(id, s)); picks[id] = K.memberInfo(id, s).picks; }
  const b = C.newBattle({
    encounter: ABORDAJE.enc, seed: seed ?? C.hashSeed('abordaje', s.created || 1, a.tries),
    party, level: lm?.level ?? ENCOUNTERS[ABORDAJE.enc].expected.level,
    leader: lm ? { cls: lm.cls, sub: lm.sub, picks: lm.picks || [] } : null,
    element: elements[0] || null, elements, classLevel, picks, tools: {}, equip: defenseItems(s),
    attempt: bossAttempt(s, ABORDAJE.enc),
  });
  b.abordaje = true;
  return b;
}
/** Lo que deja la pelea del abordaje en la ciudad (cuenta la pelea, botín, página, marca y eventos). */
export function creditAbordaje(res, b = null, s = S(), credit = null) {
  const a = abordajeState(s);
  a.tries++;
  const f = {
    enc: res.enc || ABORDAJE.enc, outcome: res.outcome, reason: res.reason, turns: res.turns, stars: res.stars, xp: res.xp,
    mats: { ...(res.loot?.mats || {}) }, page: res.page || null, flag: res.flag || null, attempt: res.attempt || b?.attempt || 1,
    combos: res.comboCount || 0, downs: res.downs || 0,
  };
  // consumibles usados (se gastan del depósito)
  const used = {};
  for (const [id, n] of Object.entries(b?.items || {})) if (n <= 0) used[id] = 1;
  if (Object.keys(used).length) store.spend({ equip: used }, 'combat');
  const pseudo = { region: 'costa', party: defenders(s), mods: { escort: [] } };
  const out = credit ? credit(pseudo, f, s) : null;
  if (res.outcome === 'win') {
    if (Object.keys(f.mats).length) store.grant({ mats: f.mats }, 'combat');
    a.won = Date.now();
    bus.emit('abordaje:won', { tries: a.tries });
  } else bus.emit('abordaje:lost', { outcome: res.outcome, tries: a.tries });
  store.markDirty();
  return { fight: f, payload: out };
}
/** Condiciones de la pelea en la ciudad: la hora y el clima de la isla. */
export function abordajeConditions(s = S()) {
  const h = s.settings?.dayNight === false ? 12 : cityHour();
  let w = 'despejado';
  try { w = cityWeather() || 'despejado'; } catch {}
  return combatConditions({ hour: h, night: isNightHour(h), weather: w, place: 'faros' });
}
/** Abre la pelea del abordaje (la vuelta es a la ciudad). */
export async function startAbordaje(ctx, { seed = null } = {}) {
  const s = ctx.state;
  if (abordajeStatus(s) !== 'ready') return false;
  const { creditFight } = await import('../expedition/expedition.js');
  const battle = abordajeBattle(s, { seed });
  bus.emit('abordaje:start', { attempt: battle.attempt });
  ctx.router.go('combat', {
    battle, noRetry: true, conditions: abordajeConditions(s),
    onSave: () => store.markDirty(),
    onEnd: (res, b) => {
      try { creditAbordaje(res, b, s, creditFight); } catch (e) { console.error('[abordaje] acreditar', e); }
      ctx.router.go('city');
    },
  });
  return true;
}

// ---------- reloj ----------
let timer = 0;
export function initAct1() {
  clearInterval(timer);
  const tick = () => { try { syncAbordaje(); } catch {} };
  tick();
  timer = setInterval(tick, 5000);
  try {
    const q = new URLSearchParams(location.search);
    if (q.get('abordaje') === '1') rushAbordaje();
  } catch {}
}
