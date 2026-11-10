// Cámara de cine (PLAN-FOTO §R2). Matemática pura, sin three.js ni DOM: se prueba en node (tools/test-cinema.mjs) y la
// usa el reproductor (player.js) con los datos de cada plano. Los puntos y vectores son arreglos [x, y, z].
//
//   lente:        LENSES, resolveLens('tele' | { preset, focal, f, match }), fovOf(focal), matchDolly, dofOf
//   foco:         focusAt(keys, t, distOf)            cambio de foco entre sujetos
//   en mano:      handheldAt(t, amp, seed), breathAt(t, b)
//   encuadre:     project(...), frameThirds({ pos, subject, fov, aspect, third, line, gaze })
//   diálogo:      shotReverse(a, b, { side }), axisSide(a, b, cam)   plano y contraplano sin saltar el eje
//   fundido:      blendCam(a, b, u)                   cámara del juego ↔ cámara del plano
//   luz:          threePoint({ pos, subject, key, fill, rim })
import { EASE } from './timeline.js';

const RAD = Math.PI / 180;
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const mix = (a, b, u) => a + (b - a) * u;
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const easeOf = (e) => (typeof e === 'function' ? e : EASE[e] || EASE.smooth);
export const V = { add, sub, mul, dot, cross, len, norm };

/** Parte de la pantalla que queda entre las barras de cine (9 % arriba y abajo): los tercios se miden ahí. */
export const SAFE = 0.82;

// ---------- 1 · lente ----------
/** Alto del sensor (mm): el de 35 mm de siempre. La distancia focal da el campo de visión vertical. */
export const SENSOR_H = 24;
/**
 * Lentes: focal (mm), f (apertura; más chico = menos profundidad de campo) y scale (metros por unidad del mundo: una
 * maqueta es chica, así que lo borroso llega antes que en un paisaje de verdad).
 */
export const LENSES = {
  wide: { focal: 24, f: 8, scale: 0.2 },       // gran angular: paisaje, todo en foco
  normal: { focal: 35, f: 5.6, scale: 0.2 },   // normal: lo que ve alguien parado ahí
  portrait: { focal: 50, f: 2.8, scale: 0.2 }, // retrato: separa a la gente del fondo
  tele: { focal: 85, f: 4, scale: 0.2 },       // tele: aplasta la distancia
  macro: { focal: 60, f: 2.8, scale: 0.1 },    // macro de maqueta: foco muy fino, como una miniatura fotografiada
};
export const fovOf = (focal) => 2 * Math.atan(SENSOR_H / 2 / focal) / RAD;
/**
 * Lente del plano: un nombre de LENSES o { preset, focal, f, scale, match }. match (true por defecto) conserva en
 * pantalla el tamaño de lo que mira la cámara: al cambiar la focal la cámara se acerca o se aleja (como al cambiar de
 * lente en un rodaje), así un plano ya encuadrado solo cambia de perspectiva.
 */
export function resolveLens(l) {
  if (!l) return null;
  const o = typeof l === 'string' ? { preset: l } : l;
  const L = { ...LENSES.normal, match: true, ...(LENSES[o.preset] || {}), ...o };
  L.fov = fovOf(L.focal);
  return L;
}
/** Cuánto hay que multiplicar la distancia al sujeto para que con `fov` se vea del tamaño que tenía con `ref`. */
export const matchDolly = (fov, ref) => Math.tan(ref * RAD / 2) / Math.tan(fov * RAD / 2);
/**
 * Profundidad de campo del lente enfocado a `dist` unidades: { focus, range, amt } para setPost({ dof }).
 * range = 2·N·c·s² / f² (círculo de confusión c = 0,03 mm), en unidades del mundo y acotado; amt sube al abrir.
 */
export function dofOf(lens, dist) {
  const s = Math.max(0.05, dist) * lens.scale, f = lens.focal / 1000;
  const total = (2 * lens.f * 0.00003 * s * s) / (f * f) / lens.scale;
  return { focus: dist, range: clamp(total, 0.8, 40), amt: clamp(0.3 + 1.7 / lens.f, 0.3, 1) };
}

// ---------- 2 · cambio de foco ----------
/**
 * Distancia de foco en t con claves [{ t, on, ease? }]: hasta la primera queda en su sujeto, entre dos claves el foco
 * viaja del anterior al siguiente (ease del que llega) y después de la última queda ahí. distOf(on) da la distancia de
 * la cámara a ese sujeto en este cuadro (los sujetos se pueden mover).
 */
export function focusAt(keys, t, distOf) {
  const n = keys?.length;
  if (!n) return null;
  if (n === 1 || t <= keys[0].t) return distOf(keys[0].on);
  if (t >= keys[n - 1].t) return distOf(keys[n - 1].on);
  let i = 0;
  while (i < n - 2 && t >= keys[i + 1].t) i++;
  const a = keys[i], b = keys[i + 1];
  return mix(distOf(a.on), distOf(b.on), easeOf(b.ease)(clamp((t - a.t) / Math.max(1e-6, b.t - a.t), 0, 1)));
}

// ---------- 3 · cámara en mano ----------
function hash1(i, seed) {
  let n = (Math.imul(i | 0, 374761393) + Math.imul(seed | 0, 668265263)) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
/** Ruido coherente en 1D, de -1 a 1: dos instantes cercanos dan valores cercanos (no es azar por cuadro). */
export function noise1(x, seed = 0) {
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return mix(hash1(i, seed), hash1(i + 1, seed), u) * 2 - 1;
}
const fbm1 = (x, seed) => noise1(x, seed) * 0.65 + noise1(x * 2.3, seed + 31) * 0.35;
/**
 * Temblor de cámara en mano en el segundo t: { dx, dy (unidades, sobre el plano de la imagen), yaw, pitch, roll (rad) }.
 * amp 1 = alguien caminando con la cámara; 0,3 = pulso firme. Depende solo de t y seed: el mismo instante da lo mismo.
 */
export function handheldAt(t, amp = 1, seed = 0) {
  const x = t * 0.9;
  return {
    dx: fbm1(x, seed + 1) * 0.035 * amp, dy: fbm1(x * 1.1, seed + 2) * 0.03 * amp,
    yaw: fbm1(x * 1.3, seed + 3) * 0.011 * amp, pitch: fbm1(x * 1.2, seed + 4) * 0.009 * amp, roll: fbm1(x * 0.7, seed + 5) * 0.006 * amp,
  };
}
/** Respiración de un plano quieto: la cámara sube y baja apenas, cada unos 4 segundos. */
export function breathAt(t, b = 1, seed = 0) {
  const w = (t * Math.PI * 2) / 4.2;
  return { dx: noise1(t * 0.25, seed + 7) * 0.006 * b, dy: Math.sin(w) * 0.011 * b, yaw: noise1(t * 0.3, seed + 8) * 0.0016 * b, pitch: Math.sin(w + 0.6) * 0.0018 * b, roll: 0 };
}
/** Largo del recorrido de una pista de cámara (para saber si el plano es quieto). */
export function camTravel(cam) {
  const k = cam?.keys || [];
  let d = 0;
  for (let i = 1; i < k.length; i++) d += len(sub(k[i].pos, k[i - 1].pos)) + len(sub(k[i].look, k[i - 1].look));
  return d;
}

// ---------- 4 · encuadre por tercios ----------
/** Ejes de una cámara sin inclinación lateral: f (adelante), r (derecha de pantalla), u (arriba de pantalla). */
export function basis(pos, look) {
  const f = norm(sub(look, pos));
  let r = cross(f, [0, 1, 0]);
  r = len(r) < 1e-6 ? [1, 0, 0] : norm(r);
  return { f, r, u: cross(r, f) };
}
/** Dónde cae un punto en pantalla: [x, y] de -1 a 1 (y hacia arriba) y z = distancia hacia adelante. */
export function project(pos, look, fov, aspect, p) {
  const { f, r, u } = basis(pos, look), v = sub(p, pos), z = dot(v, f), ty = Math.tan(fov * RAD / 2);
  return [dot(v, r) / (z * ty * aspect), dot(v, u) / (z * ty), z];
}
const THIRD_X = { left: -1 / 3, center: 0, right: 1 / 3 }, THIRD_Y = { top: 1 / 3, mid: 0, bottom: -1 / 3 };
/**
 * Hacia dónde tiene que mirar la cámara (en pos) para que el sujeto quede en un tercio de la pantalla.
 *   third: 'left' | 'right' | 'center' | 'auto' | número (-1 a 1). 'auto' con gaze (hacia dónde mira o va el sujeto,
 *          vector del mundo) deja el aire adelante: si mira a la derecha de la pantalla, va en el tercio izquierdo.
 *   line:  'top' | 'mid' | 'bottom' | número: la línea horizontal (los ojos, en la de arriba).
 *   safe:  parte del alto que se ve entre las barras (los tercios verticales se miden ahí).
 * Devuelve { look, nx, ny } con look a la distancia del sujeto.
 */
export function frameThirds({ pos, subject, fov, aspect = 16 / 9, third = 'auto', line = 'top', gaze = null, safe = SAFE }) {
  let nx = typeof third === 'number' ? third : THIRD_X[third];
  if (nx == null) nx = gaze ? (dot(gaze, basis(pos, subject).r) >= 0 ? -1 / 3 : 1 / 3) : 0;
  const ny = (typeof line === 'number' ? line : THIRD_Y[line] ?? 0) * safe;
  const d = len(sub(subject, pos)), ty = Math.tan(fov * RAD / 2);
  let look = subject.slice();
  for (let i = 0; i < 12; i++) {
    const { r, u } = basis(pos, look), [x, y] = project(pos, look, fov, aspect, subject);
    const ex = nx - x, ey = ny - y;
    if (Math.abs(ex) + Math.abs(ey) < 1e-5) break;
    look = sub(look, add(mul(r, ex * ty * aspect * d), mul(u, ey * ty * d)));
    look = add(pos, mul(norm(sub(look, pos)), d));
  }
  return { look, nx, ny };
}

// ---------- 5 · plano y contraplano ----------
/**
 * Dos cámaras para un diálogo entre a y b (puntos a la altura del piso), las dos del mismo lado del eje que los une
 * (regla de los 180°): así a queda siempre de un lado de la pantalla y b del otro, y las miradas se cruzan.
 *   side: +1 o -1, de qué lado del eje va la cámara · back: cuánto por detrás del que da la espalda ·
 *   shoulder: cuánto hacia el costado · height: altura de la cámara · lookH: altura a la que mira.
 * Devuelve { ab: { pos, look } (por sobre el hombro de a, mirando a b), ba: { pos, look } (el contraplano), n }.
 */
export function shotReverse(a, b, { side = 1, back = 1.1, shoulder = 0.45, height = 1.0, lookH = 0.85 } = {}) {
  const dir = norm([b[0] - a[0], 0, b[2] - a[2]]);
  const n = mul([dir[2], 0, -dir[0]], side);
  const up = (p, h) => [p[0], p[1] + h, p[2]];
  return {
    ab: { pos: up(add(sub(a, mul(dir, back)), mul(n, shoulder)), height), look: up(b, lookH) },
    ba: { pos: up(add(add(b, mul(dir, back)), mul(n, shoulder)), height), look: up(a, lookH) },
    n,
  };
}
/** De qué lado del eje a→b está una cámara: +1 o -1. Dos planos de un mismo diálogo tienen que dar lo mismo. */
export function axisSide(a, b, cam) {
  const dir = [b[0] - a[0], 0, b[2] - a[2]];
  return Math.sign(dot(sub(cam, a), [dir[2], 0, -dir[0]])) || 1;
}

// ---------- 6 · fundido de cámara ----------
/** Cámara intermedia entre a y b ({ pos, look, fov }), u de 0 a 1 ya con su curva. */
export function blendCam(a, b, u) {
  return { pos: a.pos.map((x, i) => mix(x, b.pos[i], u)), look: a.look.map((x, i) => mix(x, b.look[i], u)), fov: mix(a.fov ?? b.fov, b.fov ?? a.fov, u) };
}

// ---------- 7 · luz de tres puntos ----------
const RIG = {
  key: { az: -42, el: 38 },                               // principal: a un costado de la cámara, desde arriba
  fill: { az: 55, el: 10, ratio: 0.3, color: 0x8fa3c8 },  // relleno: del otro lado, baja, fría y sin sombra
  rim: { az: 150, el: 42, ratio: 0.85, color: 0xffe6c4 }, // contra: desde atrás del sujeto, le recorta el borde
};
/**
 * Luz de tres puntos alrededor de un sujeto, vista desde la cámara. az = grados alrededor del sujeto (0 = desde la
 * cámara, positivo = hacia la derecha de la pantalla, 180 = desde atrás); el = grados de altura. key lleva i y color
 * (si faltan, los de la luz del plano); fill y rim llevan ratio (fracción de la principal) o i, y color.
 * Devuelve { key, fill, rim } con { pos, i, color } cada una; las tres apuntan al sujeto.
 */
export function threePoint({ pos, subject, key = {}, fill = {}, rim = {}, dist = 22, keyI = 2, keyColor = 0xffffff }) {
  const h = norm([pos[0] - subject[0], 0, pos[2] - subject[2]]);
  const at = (az, el) => {
    const a = az * RAD, e = el * RAD, c = Math.cos(a), s = Math.sin(a);
    const d = [h[0] * c + h[2] * s, 0, -h[0] * s + h[2] * c];
    return add(subject, mul([d[0] * Math.cos(e), Math.sin(e), d[2] * Math.cos(e)], dist));
  };
  const K = { ...RIG.key, ...key }, F = { ...RIG.fill, ...fill }, R = { ...RIG.rim, ...rim };
  const ki = K.i ?? keyI;
  return {
    key: { pos: at(K.az, K.el), i: ki, color: K.color ?? keyColor },
    fill: { pos: at(F.az, F.el), i: F.i ?? ki * F.ratio, color: F.color },
    rim: { pos: at(R.az, R.el), i: R.i ?? ki * R.ratio, color: R.color },
  };
}
