// Línea de tiempo de las cinemáticas (PLAN-TRAVESIA §3a). Sin three.js ni DOM: matemática pura, así se prueba en node
// (tools/test-cinema.mjs) y la usan igual los planos 3D (player.js) y las viñetas 2D (pixel2d.js).
//
// Un plano es { dur, cam, subs, lights, events } con pistas:
//   cam:    { keys: [{ t, pos: [x,y,z], look: [x,y,z], fov?, ease? }], curve: 'smooth' | 'linear', ease: 'smooth' }
//           con dos puntos es un travelling; con más, una curva Catmull-Rom que pasa por todos. `ease` de toda la pista
//           (el tiempo del plano se curva antes de buscar el tramo) o por punto (curva el tramo que llega a ese punto).
//   subs:   [{ at, text | lines: ['…', '…'], dur?, voice?: 'intro/01' }] subtítulos de una o varias líneas. Con `voice`
//           la duración sale del audio grabado (opts.voiceDur) más un respiro, y el plano se estira si hace falta.
//   lights: [{ at, dur, to: { sunI, hemi, sky, … } }] fundidos de la luz del plano (números y colores 0xRRGGBB).
//   events: [{ at, sfx | stinger | voice | label | shake | run, … }] se disparan una vez al cruzar `at`.
export const EASE = {
  linear: (u) => u,
  smooth: (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u)),
  in: (u) => u * u * u,
  out: (u) => 1 - (1 - u) ** 3,
  inOut: (u) => (u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2),
  back: (u) => { const c = 1.4; return 1 + (c + 1) * (u - 1) ** 3 + c * (u - 1) ** 2; },
};
const easeOf = (e) => (typeof e === 'function' ? e : EASE[e] || EASE.linear);
const clamp01 = (u) => (u < 0 ? 0 : u > 1 ? 1 : u);
export const lerp = (a, b, u) => a + (b - a) * u;

/** Catmull-Rom centrípeta simple (uniforme) entre p1 y p2, con p0 y p3 de vecinos. */
function cr(p0, p1, p2, p3, u) {
  const u2 = u * u, u3 = u2 * u;
  return 0.5 * (2 * p1 + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u2 + (-p0 + 3 * p1 - 3 * p2 + p3) * u3);
}

/**
 * Valor de una pista de puntos [{ t, v: number[] , ease? }] en el instante t. curve 'smooth' = Catmull-Rom (pasa por
 * todos los puntos, sin quiebres); 'linear' = tramos rectos. Antes del primero y después del último queda quieto.
 */
export function sampleKeys(keys, t, { curve = 'smooth', field = 'v' } = {}) {
  const n = keys.length;
  if (!n) return null;
  const val = (k) => keys[k][field];
  if (n === 1 || t <= keys[0].t) return val(0).slice();
  if (t >= keys[n - 1].t) return val(n - 1).slice();
  let i = 0;
  while (i < n - 2 && t >= keys[i + 1].t) i++;
  const a = keys[i], b = keys[i + 1];
  const u = easeOf(b.ease)(clamp01((t - a.t) / Math.max(1e-6, b.t - a.t)));
  const A = val(i), B = val(i + 1);
  if (curve === 'linear' || n === 2) return A.map((x, k) => lerp(x, B[k], u));
  const P = val(Math.max(0, i - 1)), Q = val(Math.min(n - 1, i + 2));
  return A.map((x, k) => cr(P[k], x, B[k], Q[k], u));
}

/**
 * Un plano puede cortar de cámara sin cambiar de plano (plano y contraplano): cam = { segs: [{ from, keys, … }, …] }.
 * Devuelve el tramo que corre en t (o la pista misma si no hay tramos); cada tramo puede llevar además su lente,
 * foco, encuadre y luz (ver player.js).
 */
export function camSeg(cam, t) {
  if (!cam?.segs) return cam || null;
  let s = cam.segs[0];
  for (const x of cam.segs) if (t >= (x.from || 0)) s = x;
  return s;
}
/** Cámara del plano en t: { pos, look, fov }. */
export function camAt(cam, t, dur) {
  if (cam?.segs) return camAt(camSeg(cam, t), t, dur);
  if (!cam?.keys?.length) return null;
  const keys = cam.keys;
  const t0 = keys[0].t, t1 = keys[keys.length - 1].t;
  // ease de toda la pista: curva el tiempo del primer al último punto (así un travelling de dos puntos queda igual que
  // el lerp con ease de antes)
  let tt = t;
  if (cam.ease && t1 > t0) tt = t0 + easeOf(cam.ease)(clamp01((t - t0) / (t1 - t0))) * (t1 - t0);
  const curve = cam.curve || 'smooth';
  const pos = sampleKeys(keys, tt, { curve, field: 'pos' });
  const look = sampleKeys(keys, tt, { curve, field: 'look' });
  const fovs = keys.filter(k => k.fov != null);
  const fov = fovs.length ? sampleKeys(fovs.map(k => ({ t: k.t, v: [k.fov] })), tt, { curve: 'linear' })[0] : null;
  return { pos, look, fov, dur };
}
/** Atajo para el travelling de siempre: de [pos, look] a [pos, look] en dur segundos, con ease. */
export const travel = (dur, from, to, ease = 'smooth') => ({ ease, curve: 'linear', keys: [{ t: 0, pos: from[0], look: from[1] }, { t: dur, pos: to[0], look: to[1] }] });

// ---------- color y luz ----------
const hexLerp = (a, b, u) => {
  const ch = (x, s) => (x >> s) & 255;
  return (Math.round(lerp(ch(a, 16), ch(b, 16), u)) << 16) | (Math.round(lerp(ch(a, 8), ch(b, 8), u)) << 8) | Math.round(lerp(ch(a, 0), ch(b, 0), u));
};
const COLOR_KEYS = new Set(['bg', 'sky', 'ground', 'sun']);
/** Luz del plano en t: la base con los fundidos de la pista lights aplicados en orden. */
export function lightAt(base = {}, lights = [], t = 0) {
  const L = { ...base };
  for (const k of lights) {
    if (t < k.at) continue;
    const u = easeOf(k.ease || 'smooth')(clamp01((t - k.at) / Math.max(1e-6, k.dur ?? 1)));
    for (const [key, to] of Object.entries(k.to || {})) {
      const from = L[key];
      if (Array.isArray(to)) L[key] = to.map((x, i) => (typeof x === 'number' && Array.isArray(from) ? (key === 'fog' && i === 0 ? hexLerp(from[0], x, u) : lerp(from[i], x, u)) : x));
      else if (typeof to === 'number' && typeof from === 'number') L[key] = COLOR_KEYS.has(key) ? hexLerp(from, to, u) : lerp(from, to, u);
      else L[key] = u >= 1 ? to : from;
    }
  }
  return L;
}

// ---------- subtítulos ----------
const WPS = 2.6;   // palabras por segundo de lectura, para los subtítulos sin voz
/** Duración de lectura de un texto (s). */
export const readTime = (text) => Math.max(2.2, String(text).split(/\s+/).filter(Boolean).length / WPS + 0.8);
const subText = (s) => (s.lines ? s.lines.join('\n') : s.text || '');

/**
 * Arma el plano: calcula la duración de cada subtítulo (voz grabada > dur escrita > tiempo de lectura) y estira el
 * plano si un subtítulo no entra. opts.voiceDur(id) → segundos o null. Devuelve una copia.
 */
export function prepareShot(shot, { voiceDur = () => null, tail = 0.6 } = {}) {
  const S = { ...shot, subs: (shot.subs || []).map(s => ({ ...s })), events: (shot.events || []).map(e => ({ ...e })) };
  let end = 0;
  for (const s of S.subs) {
    const vd = s.voice ? voiceDur(s.voice) : null;
    s.voiced = vd != null;
    s.dur = vd != null ? vd + 0.45 : s.dur ?? readTime(subText(s));
    s.out = s.at + s.dur;
    end = Math.max(end, s.out);
    if (s.voice) S.events.push({ at: s.at, voice: s.voice, sub: true });
  }
  S.dur = Math.max(S.dur || 0, end + (shot.tail ?? tail));
  S.events.sort((a, b) => a.at - b.at);
  return S;
}
/** Subtítulo visible en t (o null): { text, lines, sub }. */
export function subAt(S, t) {
  for (let i = S.subs.length - 1; i >= 0; i--) {
    const s = S.subs[i];
    if (t >= s.at && t < s.out) return { text: subText(s), lines: s.lines || [s.text], sub: s, i };
  }
  return null;
}
/** Eventos que cruzó el reloj entre prev (excluido) y t (incluido). En t=0 entran los de at=0. */
export function eventsBetween(S, prev, t) {
  return S.events.filter(e => (prev < 0 ? e.at <= t : e.at > prev && e.at <= t));
}

/**
 * Reloj de una lista de planos. No dibuja nada: dice en qué plano y en qué segundo se está, y qué disparar.
 *   const tl = createTimeline(shots, { voiceDur }); tl.update(dt) → { shot, t, S, fired: [eventos], changed, done }
 */
export function createTimeline(shots, opts = {}) {
  const prepared = shots.map(s => prepareShot(s, opts));
  let i = 0, t = 0, prev = -1, done = false;
  const tlObj = {
    get shots() { return prepared; },
    get index() { return i; },
    get t() { return t; },
    get S() { return prepared[i]; },
    get done() { return done; },
    /** Duración total (s), sumando la cola de cada plano (hold). */
    get total() { return prepared.reduce((a, s) => a + s.dur + (s.hold || 0), 0); },
    go(k) { i = Math.max(0, Math.min(prepared.length - 1, k)); t = 0; prev = -1; done = false; return prepared[i]; },
    /** Vuelve a calcular las duraciones (por ejemplo, cuando terminó de bajar el manifest con las voces). */
    refit(o2 = {}) { const k = i; prepared.splice(0, prepared.length, ...shots.map(s => prepareShot(s, { ...opts, ...o2 }))); i = k; },
    update(dt) {
      if (done) return { shot: i, t, S: prepared[i], fired: [], changed: false, done };
      t += dt;
      const S = prepared[i];
      const fired = eventsBetween(S, prev, t);
      prev = t;
      let changed = false;
      if (t >= S.dur + (S.hold || 0) && !S.wait) {
        if (i < prepared.length - 1) { i++; t = 0; prev = -1; changed = true; } else done = true;
      }
      return { shot: i, t, S: prepared[i], fired, changed, done };
    },
    next() { if (i < prepared.length - 1) { tlObj.go(i + 1); return true; } done = true; return false; },
  };
  return tlObj;
}
