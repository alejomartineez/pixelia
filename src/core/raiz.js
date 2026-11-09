// Núcleo de Raíz, la elección de extracción y la Grieta (PLAN-QUIEBRE L1, DESIGN-STORY §5).
//
// state.world.grieta: de 0 a 100. Las amenazas pegan más fuerte y llegan más seguido (src/threats/), la isla muestra
// grietas que brillan (src/scenes/city-grieta.js) y Vera lo nota (src/story/story.js).
// state.world.raiz = { found, mode, at, last, changes, revisit, pending, sutura, sutures, peak, total, log }
//   found: ms en que se encontró el Núcleo (0 = todavía no) · mode: 'sellar' | 'medida' | 'exprimir' | null
//   pending: hay una elección abierta (al encontrarlo o al volver a la mina) · revisit: la próxima salida al Cerro va a la mina
//   last: hasta cuándo se corrió la Grieta · sutura: obra de Raíz en curso { start, end, heal } · sutures: obras terminadas
//   peak / total: lo más alto que llegó y la Grieta acumulada (grieta × días), para el final del Acto 4
// Las partidas viejas reciben estos campos acá (raizState), sin subir la versión del guardado: no se pisa nada que exista.
// Sin DOM ni three.js: lo usan la economía, las amenazas, la simulación en Node y las pruebas.
import { bus } from './bus.js';
import { store } from './state.js';

const S = () => store.state;
const DAY = 864e5, H = 3600e3;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---------- Las tres opciones (L1) ----------
// mult: cuánto rinde la Raíz en la isla (resistencia e Invernadero) · add: Grieta al elegirla · perDay / cap: cuánto sube
// sola por día y hasta dónde. "Sellar" no baja la Grieta que ya hay: eso solo lo hace la obra de Raíz.
export const EXTRACTION = {
  sellar: {
    id: 'sellar', name: 'Sellar', ic: 'lock', mult: 0.5, add: 0, perDay: 0, cap: 0,
    gives: 'Bonus chico: la Raíz rinde a media fuerza.', costs: 'Nada. La isla queda estable.',
    vera: 'Lo cerramos y que duerma. Alguien tiene que ser el primero en no tocarlo.',
  },
  medida: {
    id: 'medida', name: 'Con medida', ic: 'sparkle', mult: 1, add: 4, perDay: 0.15, cap: 15,
    gives: 'Bonus normal.', costs: 'Poca Grieta: sube despacio y se queda cerca de 15.',
    vera: 'Lo justo para vivir. Así sacaban los viejos, antes de las Casas.',
  },
  exprimir: {
    id: 'exprimir', name: 'Exprimir', ic: 'bolt', mult: 2, add: 15, perDay: 0.9, cap: 100,
    gives: 'El doble de bonus.', costs: 'La Grieta sube cada día: las amenazas pegan más fuerte y llegan más seguido.',
    vera: 'Así empezaron las Casas: con un poco más cada vez. No te digo que no. Te digo que ya lo vi.',
  },
};
export const EXTRACTION_IDS = ['sellar', 'medida', 'exprimir'];

// ---------- Lo que hace la Grieta ----------
/** Fuerza extra de las amenazas: +1 desde 15, +2 desde 35, +3 desde 60 (antes 25, 50 y 75; DESIGN-CORE §8.z). */
export const grietaPower = (g) => (g >= 60 ? 3 : g >= 35 ? 2 : g >= 15 ? 1 : 0);
/** Amenazas extra por temporada: +1 desde 30, +2 desde 60 (los miércoles, EXTRA_DAYS de threat-data.js). Umbrales del rebalanceo con varias semillas (antes 40 y 75; DESIGN-CORE §8.z). */
export const grietaExtra = (g) => (g >= 60 ? 2 : g >= 30 ? 1 : 0);
/** Resistencia de la Raíz (eficacia extra de la preparación) contra la sequía y la helada, con rinde ×1. */
export const RESIST = { sequia: 0.1, helada: 0.1 };
/** Obra de Raíz que cose la Grieta: lenta y cara, más cara cada vez. Pide el Invernadero de Raíz. */
export const SUTURA = { cost: { coins: 6000, mats: { madera: 6, piedra: 6, hierbas: 4 } }, grow: 0.35, hours: 12, heal: 12 };
/** Cómo se lee la Grieta acumulada al final del Acto 4 (L1). El final mismo se escribe en el Acto 4. */
export const LEGACY = [
  { id: 'entera', max: 300, text: 'La isla aguantó entera.' },
  { id: 'remendada', max: 1500, text: 'La isla se partió y se cosió.' },
  { id: 'partida', max: Infinity, text: 'La isla repitió el Quiebre.' },
];

// ---------- Estado ----------
export function raizState(s = S()) {
  if (!s.world || typeof s.world !== 'object') s.world = {};
  const w = s.world;
  if (typeof w.grieta !== 'number' || !Number.isFinite(w.grieta)) w.grieta = 0;
  if (!w.raiz || typeof w.raiz !== 'object') w.raiz = {};
  const r = w.raiz;
  r.found ||= 0;
  if (!EXTRACTION[r.mode]) r.mode = null;
  r.at ||= 0; r.last ||= 0; r.changes ||= 0; r.sutures ||= 0; r.peak ||= 0; r.total ||= 0;
  r.revisit = !!r.revisit; r.pending = !!r.pending;
  if (r.sutura && !(r.sutura.end > 0)) r.sutura = null;
  r.sutura ||= null;
  if (!Array.isArray(r.log)) r.log = [];
  return r;
}
export const raizFound = (s = S()) => !!raizState(s).found;
export const extraction = (s = S()) => raizState(s).mode;
/** Cuánto rinde la Raíz en la isla: 0 sin Núcleo o sin elegir, 0,5 / 1 / 2 según la extracción. */
export const raizMult = (s = S()) => { const r = raizState(s); return r.found && r.mode ? EXTRACTION[r.mode].mult : 0; };
/**
 * Eficacia extra contra un tipo de amenaza (0 si no es sequía ni helada). Es de la isla y no depende de la extracción
 * (rebalanceo con varias semillas, DESIGN-CORE §8.z): si escalaba con el rinde, exprimir también defendía el doble y traía
 * menos daño que sellar. La extracción cambia lo que da el Invernadero.
 */
export const raizResist = (type, s = S()) => { const r = raizState(s); return r.found && r.mode ? RESIST[type] || 0 : 0; };

/**
 * Corre la Grieta hasta `now`: sube sola según la extracción y termina la obra de Raíz si ya está. Idempotente.
 * Devuelve el valor (0..100).
 */
export function syncGrieta(s = S(), now = Date.now()) {
  const r = raizState(s), w = s.world;
  if (!r.found) { r.last = now; return w.grieta; }
  const from = w.grieta;
  let t = r.last || now;
  // la obra de Raíz que terminó en el medio corta el tramo: antes sube, después cose
  const step = (to) => {
    const days = Math.max(0, to - t) / DAY;
    if (days <= 0) return;
    const E = EXTRACTION[r.mode];
    const g0 = w.grieta;
    if (E && E.perDay && g0 < E.cap) w.grieta = Math.min(E.cap, g0 + E.perDay * days);
    r.total += ((g0 + w.grieta) / 2) * days;
    t = to;
  };
  if (r.sutura && r.sutura.end <= now) {
    step(Math.max(t, r.sutura.end));
    w.grieta = Math.max(0, w.grieta - (r.sutura.heal || SUTURA.heal));
    r.sutures++;
    const done = r.sutura;
    r.sutura = null;
    queueMicrotask(() => bus.emit('raiz:sutura', { heal: done.heal, grieta: w.grieta }));
  }
  step(now);
  r.last = now;
  w.grieta = Math.round(clamp(w.grieta, 0, 100) * 100) / 100;
  r.peak = Math.max(r.peak, w.grieta);
  if (Math.floor(from / 5) !== Math.floor(w.grieta / 5) || grietaPower(from) !== grietaPower(w.grieta)) {
    store.markDirty();
    bus.emit('world:grieta', { from, to: w.grieta });
  }
  return w.grieta;
}
export const grieta = (s = S(), now = Date.now()) => syncGrieta(s, now);

// ---------- El Núcleo y la elección ----------
/**
 * Se encontró el Núcleo de Raíz en la mina (o se volvió a la mina): abre la elección. La primera vez acredita el
 * elemento (store.grant → reward:element → la historia lo anota y dispara el contacto). Emite 'raiz:found'.
 */
export function foundNucleo(s = S(), now = Date.now(), { revisit = false } = {}) {
  const r = raizState(s);
  const first = !r.found;
  if (first) { r.found = now; r.last = now; store.grant({ element: 'raiz' }, 'story'); }
  r.pending = true;
  r.revisit = false;
  store.markDirty();
  bus.emit('raiz:found', { first, revisit: revisit || !first });
  return { first };
}
/**
 * Elige cuánto sacarle a la Raíz. Solo con la elección abierta (en la mina). Devuelve { ok, mode, grieta } o { error }.
 * Elegir otra vez lo mismo cierra la elección sin costo; subir la extracción suma la Grieta de la opción.
 */
export function chooseExtraction(mode, s = S(), now = Date.now()) {
  const r = raizState(s);
  const E = EXTRACTION[mode];
  if (!E) return { error: 'Opción desconocida' };
  if (!r.found) return { error: 'Todavía no encontraste el Núcleo' };
  if (!r.pending) return { error: 'Eso se elige en la mina' };
  syncGrieta(s, now);
  const prev = r.mode;
  r.pending = false;
  if (prev !== mode) {
    const up = !prev || E.mult > EXTRACTION[prev].mult;
    if (up && E.add) s.world.grieta = Math.min(100, s.world.grieta + E.add);
    r.mode = mode;
    r.at = now;
    if (prev) r.changes++;
    r.log.push({ mode, at: now });
    if (r.log.length > 12) r.log.shift();
    r.peak = Math.max(r.peak, s.world.grieta);
  }
  store.markDirty();
  bus.emit('raiz:choice', { mode, prev, grieta: s.world.grieta });
  bus.emit('world:grieta', { from: s.world.grieta, to: s.world.grieta });
  return { ok: true, mode, prev, grieta: s.world.grieta };
}
/** Pide volver a la mina en la próxima salida normal al Cerro (para cambiar la extracción). */
export function setRevisit(on = true, s = S()) {
  const r = raizState(s);
  if (!r.found) return false;
  r.revisit = !!on;
  store.markDirty();
  bus.emit('raiz:revisit', { on: r.revisit });
  return true;
}
/** ¿La próxima salida normal al Cerro va a la mina? (para encontrar el Núcleo o para volver a elegir) */
export function mineObjective(s = S()) {
  const r = raizState(s);
  const rank = s.city?.buildings?.find(b => b.id === 'castillo')?.level || 1;
  if (!r.found) return rank >= 5 ? 'nucleo' : null;
  return r.revisit ? 'revisit' : null;
}

// ---------- Obra de Raíz: coser la Grieta ----------
const hasInvernadero = (s) => s.city?.buildings?.some(b => b.id === 'invernadero' && !(b.buildEnd > Date.now()));
export function suturaCost(s = S()) {
  const k = 1 + SUTURA.grow * raizState(s).sutures;
  const r5 = (n) => Math.round(n * k);
  return { coins: Math.round(SUTURA.cost.coins * k / 100) * 100, mats: Object.fromEntries(Object.entries(SUTURA.cost.mats).map(([m, n]) => [m, r5(n)])) };
}
/** { cost, hours, heal, active, ends, can: {ok, reason} } para la ficha del Invernadero y la Bitácora. */
export function suturaInfo(s = S(), now = Date.now()) {
  syncGrieta(s, now);
  const r = raizState(s);
  const cost = suturaCost(s);
  let reason = '';
  if (!r.found) reason = 'Falta el Núcleo de Raíz';
  else if (!hasInvernadero(s)) reason = 'Hace falta el Invernadero de Raíz';
  else if (r.sutura) reason = 'Ya hay una obra de Raíz en curso';
  else if (s.world.grieta <= 0.5) reason = 'No hay Grieta que coser';
  else if (!store.hasMats(cost.mats)) reason = 'Faltan materiales';
  else if (!store.canAfford(cost)) reason = 'No te alcanza';
  return { cost, hours: SUTURA.hours, heal: SUTURA.heal, active: r.sutura, ends: r.sutura?.end || 0, grieta: s.world.grieta, can: { ok: !reason, reason } };
}
export function startSutura(s = S(), now = Date.now()) {
  const info = suturaInfo(s, now);
  if (!info.can.ok) return { error: info.can.reason };
  store.spend(info.cost, 'sutura');
  raizState(s).sutura = { start: now, end: now + SUTURA.hours * H, heal: SUTURA.heal };
  store.markDirty();
  bus.emit('raiz:suturaStart', { end: now + SUTURA.hours * H });
  return { ok: true, end: now + SUTURA.hours * H };
}

// ---------- Para el final del Acto 4 (L1) ----------
/** La Grieta acumulada y cómo se leería hoy: { grieta, peak, total, sutures, mode, changes, ending }. */
export function grietaLegacy(s = S(), now = Date.now()) {
  const g = syncGrieta(s, now);
  const r = raizState(s);
  const ending = LEGACY.find(e => r.total <= e.max) || LEGACY[LEGACY.length - 1];
  return { grieta: g, peak: r.peak, total: Math.round(r.total), sutures: r.sutures, mode: r.mode, changes: r.changes, ending: ending.id, text: ending.text };
}

/** Texto corto del estado de la Grieta (Bitácora, ficha, HUD). */
export function grietaText(g) {
  return g < 1 ? 'La isla está entera.' : g < 25 ? 'Hay fisuras finas en el borde.' : g < 50 ? 'Las grietas se ven desde la plaza.'
    : g < 75 ? 'La isla cruje de noche.' : 'La isla se está partiendo.';
}

// ---------- Arranque ----------
let inited = false;
export function initRaiz() {
  raizState();
  if (inited) return;
  inited = true;
  syncGrieta();
  setInterval(() => { try { syncGrieta(); } catch (e) { console.warn('[raiz]', e); } }, 30e3);
}
