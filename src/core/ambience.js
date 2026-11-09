// Ambiente de cada lugar (PLAN-QUIEBRE §J1–J5): perfil por lugar, reloj de día y noche, clima y la luz como progreso.
// Puro: sin DOM ni three.js (lo importan la ciudad, la expedición, el combate, la cinemática y las pruebas en Node).
// Lo que se dibuja (luces, cielo, niebla, partículas) lo aplica src/core/ambience-fx.js con `resolveLook`.
//
//   hour 0..24 · weather: id de WEATHER · light: state.world.light (0 gris y apagada → 1 la isla viva)
//   resolveLook({ base, place, hour, weather, light }) → colores e intensidades listos para aplicar

// ---------- Reloj ----------
/** Un día de la ciudad dura 20 minutos reales (J3). El reloj sale de la hora real: es el mismo al volver. */
export const CITY_DAY_MS = 20 * 60 * 1000;
/** La noche va de NIGHT_FROM a NIGHT_TO (para las reglas: visión de la expedición, ecos). */
export const NIGHT_FROM = 20, NIGHT_TO = 6;
/** Hora de la ciudad (0..24) para un instante. Arranca a las 9 cuando el contador da la vuelta. */
export function cityHour(now = Date.now()) {
  const f = ((now % CITY_DAY_MS) + CITY_DAY_MS) % CITY_DAY_MS / CITY_DAY_MS;
  return (9 + f * 24) % 24;
}
/** Número de día de la ciudad (para elegir el clima del día). */
export const cityDay = (now = Date.now()) => Math.floor((now + CITY_DAY_MS * 9 / 24) / CITY_DAY_MS);
/** ¿Es de noche a esta hora? (corte duro, para las reglas) */
export const isNightHour = (h) => { h = ((h % 24) + 24) % 24; return h >= NIGHT_FROM || h < NIGHT_TO; };
export const hourText = (h) => { h = ((h % 24) + 24) % 24; const hh = Math.floor(h), mm = Math.floor((h - hh) * 60 / 15) * 15; return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`; };

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
/**
 * Fases suaves del día: day 1 de 7 a 18, rampas al amanecer (5–7) y al atardecer (18–20,5).
 * warm: el dorado del amanecer y del atardecer (pico a las 6 y a las 19). night = 1 − day.
 */
export function dayPhase(hour) {
  const h = ((hour % 24) + 24) % 24;
  const day = h < 12 ? smooth(5, 7, h) : 1 - smooth(18, 20.5, h);
  const warm = Math.max(Math.exp(-((h - 6.2) ** 2) / 1.2), Math.exp(-((h - 19) ** 2) / 1.6));
  return { day, night: 1 - day, warm: clamp01(warm), hour: h };
}

// ---------- Clima ----------
// sat: saturación (×) · dark: cuánto baja la luz (0..1) · fog: niebla extra (0..1) · fogColor · sky: color al que va el cielo
// fx: partículas { kind, rate (0..1), wind } · flash: relámpagos · exp: efecto en la expedición (siempre a la vista)
export const WEATHER = {
  despejado: { id: 'despejado', name: 'Despejado', icon: 'sun', sat: 1, dark: 0, fog: 0, fx: null },
  nublado: { id: 'nublado', name: 'Nublado', icon: 'cloud', sat: 0.85, dark: 0.18, fog: 0.08, fogColor: '#9aa3a8', sky: '#8e979c', fx: null },
  lluvia: { id: 'lluvia', name: 'Lluvia', icon: 'rain', sat: 0.78, dark: 0.3, fog: 0.16, fogColor: '#7d8a94', sky: '#6f7b86', fx: { kind: 'rain', rate: 0.6, wind: 0.25 } },
  tormenta: { id: 'tormenta', name: 'Tormenta', icon: 'storm', sat: 0.62, dark: 0.5, fog: 0.22, fogColor: '#4f5866', sky: '#3c4452', fx: { kind: 'rain', rate: 1, wind: 0.8 }, flash: true,
    exp: { vision: -1, step: 1, guard: 'lona', text: 'Visión −1, y colinas, bañados y rocas cuestan 1 provisión más (la Lona lo evita).' } },
  niebla: { id: 'niebla', name: 'Niebla', icon: 'fog', sat: 0.7, dark: 0.15, fog: 0.55, fogColor: '#b9c0c0', sky: '#aab2b3', fx: null,
    exp: { vision: -1, text: 'La niebla tapa las casillas: visión −1.' } },
  nieve: { id: 'nieve', name: 'Nieve', icon: 'snow', sat: 0.75, dark: 0.12, fog: 0.2, fogColor: '#dfe6ec', sky: '#c9d3dc', fx: { kind: 'snow', rate: 0.7, wind: 0.2 },
    exp: { step: 1, guard: 'lona', text: 'La nieve frena: colinas, bañados y rocas cuestan 1 provisión más (la Lona lo evita).' } },
  ceniza: { id: 'ceniza', name: 'Ceniza', icon: 'ash', sat: 0.6, dark: 0.32, fog: 0.3, fogColor: '#7a6f68', sky: '#5e534e', fx: { kind: 'ash', rate: 0.7, wind: 0.3 },
    exp: { vision: -1, text: 'La ceniza no deja ver: visión −1.' } },
  // las de las amenazas (J4: "las Amenazas se ven")
  humo: { id: 'humo', name: 'Humo', icon: 'smoke', sat: 0.72, dark: 0.22, fog: 0.26, fogColor: '#8a7466', sky: '#a0715a', tint: [1.06, 0.95, 0.86], fx: { kind: 'ember', rate: 0.7, wind: 0.4 } },
  helada: { id: 'helada', name: 'Helada', icon: 'frost', sat: 0.7, dark: 0.1, fog: 0.18, fogColor: '#d6e6f2', sky: '#b9cfe0', tint: [0.94, 0.99, 1.08], frost: 1, fx: { kind: 'snow', rate: 0.35, wind: 0.1 } },
  sequia: { id: 'sequia', name: 'Sequía', icon: 'drought', sat: 0.82, dark: 0, fog: 0.12, fogColor: '#d9c39a', sky: '#e2c891', tint: [1.07, 1.0, 0.86], fx: { kind: 'dust', rate: 0.4, wind: 0.6 } },
};
/** Cómo se ve cada amenaza en las 48 h de señales y el día que llega. */
export const THREAT_WEATHER = { crecida: 'lluvia', tormenta: 'tormenta', incendio: 'humo', helada: 'helada', sequia: 'sequia' };
/** El clima del día en la ciudad (sin amenaza cerca): casi siempre lindo, que es el refugio. */
const CITY_WEATHER = [['despejado', 62], ['nublado', 16], ['lluvia', 12], ['niebla', 6], ['tormenta', 4]];
const hashInt = (n) => { let t = (n | 0) + 0x6d2b79f5; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
export function cityWeather(now = Date.now(), { snowy = false } = {}) {
  let x = hashInt(cityDay(now) * 7919) * 100;
  for (const [id, w] of CITY_WEATHER) { if (x < w) return snowy && id === 'lluvia' ? 'nieve' : id; x -= w; }
  return 'despejado';
}

// ---------- Lugares (J1) ----------
// sat (×) · fog { amt, color } · dim: cuánto más oscuro que la base · tint (× rgb) · sun: si hay sol (el Bajo Mundo no)
// veins: vetas que brillan (mina, Bajo Mundo) · music: pista sugerida para el 3c · night: si el reloj aplica
export const PLACES = {
  city: { id: 'city', name: 'Ciudad', sat: 1, fog: { amt: 0, color: '#c8c2b4' }, dim: 0, music: 'city', night: true },
  'exp:cerca': { id: 'exp:cerca', name: 'Expedición, cerca', sat: 1, fog: { amt: 0.12, color: '#c9d4cc' }, dim: 0, music: 'expedition', night: true },
  'exp:medio': { id: 'exp:medio', name: 'Expedición, a media distancia', sat: 0.86, fog: { amt: 0.32, color: '#a9b4b2' }, dim: 0.1, tint: [0.97, 0.99, 1.02], music: 'expedition', night: true },
  'exp:lejos': { id: 'exp:lejos', name: 'Expedición, lejos', sat: 0.72, fog: { amt: 0.5, color: '#8c9699' }, dim: 0.2, tint: [0.94, 0.97, 1.04], music: 'expedition_far', night: true },
  // lugares de la historia (DESIGN-STORY): cada uno con su clima
  mina: { id: 'mina', name: 'La mina sellada', sat: 0.6, fog: { amt: 0.6, color: '#1c1a1f' }, dim: 0.65, tint: [0.92, 0.9, 1.0], veins: '#ffb347', sun: false, music: 'mine', night: false },
  faros: { id: 'faros', name: 'Costa de los Faros', sat: 0.8, fog: { amt: 0.5, color: '#9fb0b8' }, dim: 0.15, tint: [0.95, 1.0, 1.05], beams: true, music: 'coast', night: true },
  bajo: { id: 'bajo', name: 'El Bajo Mundo', sat: 0.7, fog: { amt: 0.7, color: '#120e14' }, dim: 0.85, tint: [1.0, 0.86, 0.9], veins: '#ff6a3d', sun: false, music: 'under', night: false },
};
/** Lugar de la expedición según el anillo de la casilla donde está el grupo (0 cerca, 1 medio, 2 lejos). */
export const expPlace = (ring = 0) => ['exp:cerca', 'exp:medio', 'exp:lejos'][Math.max(0, Math.min(2, ring | 0))];
/** Ajustes de cada región de la expedición encima del anillo (el Cerro es la mina, la Costa los faros). */
export const REGION_LOOK = {
  bosque: {}, sierras: { tint: [0.98, 0.99, 1.02] }, banado: { fogAdd: 0.08, tint: [0.97, 1.01, 0.98] },
  cerro: { satMul: 0.9, dimAdd: 0.08, tint: [1.02, 0.97, 0.95] }, costa: { fogAdd: 0.1, tint: [0.96, 1.0, 1.04] },
};

// ---------- Luz como progreso (J2) ----------
const CHAPTER_ORDER = ['prologo', 'bosque', 'sierras', 'banado', 'cerro', 'costa', 'abordaje'];
/**
 * state.world.light de 0 a 1: la isla arranca nublada y gris; reconstruir, subir de rango y de Época, el Núcleo de Raíz
 * (los elementos) y reencender el faro la van iluminando. rank = rango de la Municipalidad.
 */
export function lightFor(state, rank = 1) {
  const st = state?.story || {};
  const ch = Math.max(0, CHAPTER_ORDER.indexOf(st.chapter || 'prologo'));
  const act = Math.max(1, st.act || 1);
  const built = (state?.city?.buildings || []).length;
  const els = (st.elements || []).length;
  let l = 0.12 + 0.05 * ch + 0.045 * Math.max(0, Math.min(10, rank) - 1) + 0.06 * Math.min(1, built / 30) + 0.04 * Math.min(4, els);
  if (st.flags?.faro) l += 0.1;
  l += 0.08 * (act - 1);
  return Math.round(clamp01(l) * 1000) / 1000;
}
/** Calcula y guarda state.world.light. Devuelve { from, to, changed }. */
export function updateWorldLight(state, rank) {
  if (!state.world || typeof state.world !== 'object') state.world = {};
  const from = typeof state.world.light === 'number' ? state.world.light : null;
  const to = lightFor(state, rank);
  state.world.light = to;
  return { from, to, changed: from !== to };
}

// ---------- Ecos de noche (L6: la base; los ecos los hace el paso 6) ----------
/**
 * Dónde pueden aparecer ecos: en la ciudad, en el borde de la isla (lo que quedó del Quiebre); en la expedición, en las
 * ruinas ya pisadas. Solo de noche. `echoSpots` devuelve posiciones; el paso 6 elige cuál, el guion y la página.
 */
export const ECHO_RULES = { city: { where: 'borde', max: 1 }, exp: { where: 'ruina', max: 1 } };
/** Tres lugares fijos sobre el borde de la isla de la ciudad (en tiles desde el centro), para un tamaño de terreno. */
export function cityEchoSpots(side = 12) {
  const r = side / 2 + 1.2;
  return [[-r * 0.8, r * 0.55], [r * 0.9, -r * 0.35], [-r * 0.2, -r * 0.95]].map(([x, z], i) => ({ id: `borde${i + 1}`, x, z }));
}
/** Ruinas de la expedición donde puede aparecer un eco (pisadas y ya resueltas). run = la de exp-rules. */
export function expEchoSpots(run) {
  if (!run?.cells) return [];
  const out = [];
  run.cells.forEach((c, i) => { if (c.content === 'ruina' && c.visited) out.push({ id: `ruina${i}`, x: i % run.w, y: (i / run.w) | 0 }); });
  return out;
}

// ---------- Mezcla ----------
const NIGHT_SKY = ['#0b1022', '#151c38', '#222a4a', '#2f3352'];
const DUSK_SKY = ['#33284a', '#6e4a66', '#c8744f', '#eea35e'];
const GRAY_SKY = ['#5d6266', '#7b7f80', '#9a9893', '#aaa49a'];
export const hexToRgb = (h) => { const n = typeof h === 'number' ? h : parseInt(String(h).replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
export const rgbToHex = ([r, g, b]) => '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
export const mixHex = (a, b, t) => { const A = hexToRgb(a), B = hexToRgb(b); t = clamp01(t); return rgbToHex(A.map((v, i) => v + (B[i] - v) * t)); };
const desat = (h, s) => { const [r, g, b] = hexToRgb(h); const l = 0.299 * r + 0.587 * g + 0.114 * b; return rgbToHex([l + (r - l) * s, l + (g - l) * s, l + (b - l) * s]); };
/** Paradas de un `linear-gradient(...)` de CSS: [[hex, pct], ...]. */
export function parseSky(css) {
  const out = [];
  const re = /#([0-9a-f]{6})\s+(\d+(?:\.\d+)?)%/gi;
  let m;
  while ((m = re.exec(css || ''))) out.push(['#' + m[1].toLowerCase(), +m[2]]);
  return out.length ? out : [['#a9daff', 0], ['#cdeaff', 36], ['#eef6f0', 70], ['#fdf0d4', 100]];
}
export const skyCss = (stops) => `linear-gradient(180deg, ${stops.map(([c, p]) => `${c} ${p}%`).join(', ')})`;
const pick4 = (arr, i, n) => arr[Math.min(arr.length - 1, Math.round(i * (arr.length - 1) / Math.max(1, n - 1)))];

/**
 * Lo que se ve, ya mezclado. base = lo del tema o la escena: { sky (css o paradas), stars, hemiSky, hemiGround, hemiI,
 * sun, sunI }. Devuelve { sky: paradas, stars, hemiSky, hemiGround, hemiI, sun, sunI, sunTurn, sat, tint, fog, glow,
 * flash, fx, phase, night, weather, place }.
 */
export function resolveLook({ base = {}, place = 'city', hour = 12, weather = 'despejado', light = 1, region = null, frost = 0 } = {}) {
  const P = PLACES[place] || PLACES.city;
  const W = WEATHER[weather] || WEATHER.despejado;
  const R = (region && REGION_LOOK[region]) || {};
  const ph = P.night === false ? { day: P.sun === false ? 0 : 1, night: P.sun === false ? 1 : 0, warm: 0, hour } : dayPhase(hour);
  const n = ph.night, warm = ph.warm * (1 - W.dark);
  const L = clamp01(light);
  const gray = (1 - L) * 0.55 + W.dark * 0.5;           // cuánto se va el cielo al gris
  const stops = Array.isArray(base.sky) ? base.sky : parseSky(base.sky);
  const sky = stops.map(([c, p], i) => {
    let x = mixHex(c, pick4(GRAY_SKY, i, stops.length), gray);
    if (W.sky) x = mixHex(x, W.sky, 0.25 + W.dark * 0.6);
    x = mixHex(x, pick4(DUSK_SKY, i, stops.length), warm * 0.55);
    x = mixHex(x, pick4(NIGHT_SKY, i, stops.length), n * 0.92);
    return [x, p];
  });
  const dim = Math.min(0.92, (P.dim || 0) + (R.dimAdd || 0));
  const hemiI = (base.hemiI ?? 1.1) * (1 - 0.6 * n) * (1 - 0.55 * W.dark) * (1 - dim) * (0.82 + 0.18 * L);
  let hemiSky = mixHex(base.hemiSky ?? '#ffffff', '#6f84c8', n * 0.65);
  hemiSky = mixHex(hemiSky, '#9aa0a8', W.dark * 0.5 + (1 - L) * 0.25);
  const hemiGround = mixHex(base.hemiGround ?? '#c8b898', '#2a2c44', n * 0.6);
  let sun = mixHex(base.sun ?? '#fff1de', '#ffac6a', warm * 0.7);
  sun = mixHex(sun, '#9fb4ff', n);
  const sunI = (P.sun === false ? 0.15 : 1) * (base.sunI ?? 2.3) * (1 - 0.78 * n) * (1 - 0.85 * W.dark) * (1 - dim) * (0.85 + 0.15 * L);
  const sat = (0.78 + 0.22 * L) * (1 - 0.22 * n) * (W.sat ?? 1) * (P.sat ?? 1) * (R.satMul ?? 1);
  const tint = [1, 1, 1];
  const mulT = (t, k = 1) => { if (t) for (let i = 0; i < 3; i++) tint[i] *= 1 + (t[i] - 1) * k; };
  mulT([0.84, 0.9, 1.1], n * 0.6);                         // la noche es azul
  mulT([1.12, 0.98, 0.82], warm * 0.75);                   // el atardecer es dorado
  mulT([0.97, 0.98, 1.0], 1 - L);                          // la isla gris es un poco fría
  mulT(P.tint); mulT(R.tint); mulT(W.tint);
  for (let i = 0; i < 3; i++) tint[i] *= 1 - 0.32 * (W.dark || 0);   // el cielo cargado apaga todo
  const fogAmt = clamp01((P.fog?.amt || 0) + (R.fogAdd || 0) + (W.fog || 0) + (1 - L) * 0.08);
  let fogColor = W.fogColor && W.fog > (P.fog?.amt || 0) ? mixHex(P.fog?.color || '#c8c2b4', W.fogColor, 0.7) : (P.fog?.color || '#c8c2b4');
  fogColor = mixHex(fogColor, '#1a2036', n * 0.75);
  const glow = clamp01(Math.max(n, ph.day < 0.85 ? (1 - ph.day) * 1.4 : 0) + W.dark * 0.5);
  return {
    sky, stars: clamp01((base.stars ?? 0.3) * (1 - n) * 0.4 + n * (1 - W.dark) * 0.95), hemiSky, hemiGround, hemiI, sun, sunI,
    sunTurn: (ph.hour - 12) / 12, sat: Math.max(0.2, sat), tint, fog: { amt: fogAmt, color: fogColor },
    glow, flash: !!W.flash, fx: W.fx, frost: Math.max(frost, W.frost || 0), phase: ph, night: n > 0.5, weather: W.id, place: P.id, veins: P.veins || null,
  };
}

// ---------- Combate (J3: hereda la hora y el clima de la casilla) ----------
/** Hora y clima para el combate que sale de una casilla de la expedición (lo usa el paso 5, segunda parte). */
export function combatConditions(cond = {}) {
  return { hour: cond.hour ?? 12, night: !!cond.night, weather: cond.weather || 'despejado', place: cond.place || 'exp:cerca' };
}

// ---------- Mantener state.world.light al día ----------
/**
 * Escucha lo que ilumina la isla (capítulo, rango, construir, elementos, el faro) y recalcula state.world.light.
 * deps = { state: () => state, bus, rank: () => número, markDirty, notify(text) }. Al subir la luz avisa una vez
 * (texto corto, sin diminutivos) y emite 'world:light' { from, to }.
 */
export function initWorldLight({ state, bus, rank, markDirty = () => {}, notify = null }) {
  const run = (why) => {
    const s = state();
    if (!s) return;
    const r = updateWorldLight(s, rank());
    if (!r.changed) return;
    markDirty();
    bus.emit('world:light', { from: r.from, to: r.to, why });
    // de a saltos de un décimo: no se avisa cada casa
    if (notify && r.from != null && Math.floor(r.to * 10) > Math.floor(r.from * 10)) notify(lightLine(r.to));
  };
  run('init');
  const evs = ['story:chapter', 'town:rankup', 'building:built', 'reward:element', 'story:flag', 'era:up'];
  const offs = evs.map(ev => bus.on(ev, () => run(ev)));
  return () => offs.forEach(f => f());
}
/** Lo que se dice cuando la isla se aclara. */
export function lightLine(l) {
  return l >= 0.9 ? 'La isla se ve viva de punta a punta.' : l >= 0.6 ? 'El gris se va: la isla recupera el color.' : l >= 0.35 ? 'La isla se aclara un poco más.' : 'Entre las nubes se abre un claro.';
}
