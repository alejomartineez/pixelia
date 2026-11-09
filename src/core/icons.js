// Íconos pixel-art dibujados a mano (src/core/icons/*.js), nítidos a cualquier tamaño.
// Cada ícono tiene una grilla de 16×16 y otra de 24×24 con la paleta oscura de palette.js (las láminas de Hallazgos,
// una sola de 32×32: icons/finds/). Para mostrarlo a `dev`
// pixeles físicos se elige la grilla y el factor entero k que más llenan sin pasarse (16×2 a 32 px, 24×1 a 30 px…), se
// le agrega el contorno de tinta y se agranda k veces sin suavizado. Si el CSS lo muestra a otro tamaño, un
// ResizeObserver lo regenera a ese tamaño.
// También se pueden registrar canvases ya pixelados (miniaturas 3D, banderas) con registerIcon.
// Uso: icon('coin', 20) -> '<img class="pi" ...>'  |  iconUrl('gem', 32) -> dataURL
import { PAL, INK } from './icons/palette.js';
import { SPRITES, FAMILIES, FIND_SETS } from './icons/index.js';
import { LEGACY } from './icons/legacy.js';

export { FAMILIES, SPRITES, FIND_SETS };

// ---------- color ----------
function rgb(hex) { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function mix(a, b, t) {
  const x = rgb(a), y = rgb(b);
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('');
}
const INK_RGB = rgb(INK);
const PAL_RGB = Object.fromEntries(Object.entries(PAL).map(([c, hex]) => [c, rgb(hex)]));

/** Rampa claro · base · oscuro a partir de un color base (para teñir con registerTint). */
export function rampOf(hex) { return [mix(hex, '#fff6e4', 0.38), hex, mix(hex, INK, 0.36)]; }

// ---------- registro ----------
const EXTRA = {};        // id → canvas ya pixelado (registerIcon) o { base, map } (registerTint)
const cache = new Map();
function clearCache(name) { for (const k of [...cache.keys()]) if (k.startsWith(name + '|')) cache.delete(k); }

/** Registra (o reemplaza) un ícono hecho de un canvas o imagen ya pixelado (p. ej. una miniatura 3D). */
export function registerIcon(name, src) {
  EXTRA[name] = src;
  if (!ICON_NAMES.includes(name)) ICON_NAMES.push(name);
  clearCache(name);
}
/**
 * Registra `name` como una copia de `base` con otros colores: map es { carácter: '#hex' } (p. ej. el cofre con la
 * madera de cada rareza: { O, u, z } = rampOf(color)).
 */
export function registerTint(name, base, map) {
  EXTRA[name] = { base, map };
  if (!ICON_NAMES.includes(name)) ICON_NAMES.push(name);
  clearCache(name);
}
/** ¿Hay un ícono dibujado o registrado con ese id? */
export const hasIcon = (name) => !!(SPRITES[name] || EXTRA[name]);

// ---------- rasterizado ----------
function canvas(n) { const cv = document.createElement('canvas'); cv.width = cv.height = n; return cv; }

/** ImageData N×N de una grilla, con el contorno de tinta alrededor de la silueta. */
function drawGrid(rows, map) {
  const N = rows.length, img = new ImageData(N, N), d = img.data;
  const col = map ? Object.fromEntries(Object.entries(map).map(([c, hex]) => [c, rgb(hex)])) : null;
  const filled = (x, y) => x >= 0 && y >= 0 && x < N && y < N && rows[y][x] !== '.';
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const ch = rows[y][x], i = (y * N + x) * 4;
    if (ch === '.') {
      if (filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1)) { d.set(INK_RGB, i); d[i + 3] = 255; }
      continue;
    }
    d.set(col?.[ch] || PAL_RGB[ch] || INK_RGB, i); d[i + 3] = 255;
  }
  return img;
}

/** Grilla y factor entero que mejor llenan `dev` pixeles (empate: la más grande, que tiene más detalle). */
function pickGrid(def, dev) {
  let best = null;
  for (const n of [32, 24, 16]) {
    const rows = def['s' + n];
    if (!rows) continue;
    const k = Math.floor(dev / n);
    if (k >= 1 && (!best || n * k > best.n * best.k)) best = { rows, n, k };
  }
  const rows = def.s16 || def.s24 || def.s32;
  return best || { rows, n: rows.length, k: 0 };
}

/** Canvas de la grilla de un ícono a 1 pixel por pixel de arte (lo usa la galería). */
export function spriteCanvas(name, n = 16) {
  const { def, map } = spriteOf(name) || {};
  const rows = def?.['s' + n];
  if (!rows) return null;
  const cv = canvas(rows.length);
  cv.getContext('2d').putImageData(drawGrid(rows, map), 0, 0);
  return cv;
}

function spriteOf(name) {
  const ex = EXTRA[name];
  if (ex && ex.base) { const b = spriteOf(ex.base); return b && { def: b.def, map: { ...(b.map || {}), ...ex.map } }; }
  return SPRITES[name] ? { def: SPRITES[name], map: null } : null;
}

const warned = new Set();
/** Último recurso: un emoji "pixelado". Avisa en consola, porque cada id de la interfaz tiene que estar dibujado. */
function drawEmoji(em, N) {
  if (!warned.has(em)) {
    warned.add(em);
    console.warn(`[icons] "${em}" no tiene ícono dibujado: sale como emoji (src/core/icons/)`);
    if (typeof window !== 'undefined') (window.__iconMisses ||= []).push(em);
  }
  const cv = canvas(N), g = cv.getContext('2d', { willReadFrequently: true });
  const s = N - 2;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `${Math.round(s * 0.92)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
  g.fillText(em, N / 2, N / 2 + s * 0.06);
  const img = g.getImageData(0, 0, N, N), d = img.data;
  const solid = new Uint8Array(N * N);
  for (let i = 0; i < N * N; i++) {
    if (d[i * 4 + 3] > 110) { solid[i] = 1; d[i * 4 + 3] = 255; } else d[i * 4 + 3] = 0;
  }
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = y * N + x;
    if (solid[i]) continue;
    if ((x > 0 && solid[i - 1]) || (x < N - 1 && solid[i + 1]) || (y > 0 && solid[i - N]) || (y < N - 1 && solid[i + N])) {
      d.set(INK_RGB, i * 4); d[i * 4 + 3] = 255;
    }
  }
  return img;
}

const dpr = () => Math.min(4, Math.max(1, (typeof devicePixelRatio === 'number' && devicePixelRatio) || 1));

function resolve(name) { return hasIcon(name) ? name : LEGACY[name] || name; }
function urlFor(name, dev) {
  name = resolve(name);
  const key = name + '|' + dev;
  if (cache.has(key)) return cache.get(key);
  const ex = EXTRA[name];
  if (ex && !ex.base) return cacheSet(key, rasterUrl(ex, dev));
  const sp = spriteOf(name);
  const out = canvas(dev), g = out.getContext('2d');
  g.imageSmoothingEnabled = false;
  if (sp) {
    const { rows, n, k } = pickGrid(sp.def, dev);
    const art = canvas(n);
    art.getContext('2d').putImageData(drawGrid(rows, sp.map), 0, 0);
    if (k >= 1) { const off = Math.floor((dev - n * k) / 2); g.drawImage(art, off, off, n * k, n * k); }
    else {   // más chico que la grilla: se achica (una lámina de 32 se suaviza, para que no pierda pixeles enteros)
      g.imageSmoothingEnabled = n > 24;
      if (n > 24) g.imageSmoothingQuality = 'high';
      g.drawImage(art, 0, 0, dev, dev);
    }
  } else {
    const N = Math.max(12, Math.min(40, Math.round(dev / dpr() / 1.2)));
    const art = canvas(N);
    art.getContext('2d').putImageData(drawEmoji(name, N), 0, 0);
    const k = Math.max(1, Math.floor(dev / N)), off = Math.floor((dev - N * k) / 2);
    g.drawImage(art, off, off, N * k, N * k);
  }
  return cacheSet(key, out.toDataURL());
}
function cacheSet(key, url) { cache.set(key, url); return url; }
/**
 * Imagen pixelada a dev×dev. Si un factor entero llena casi todo (≥ 78%), bloques enteros nítidos centrados
 * (sin tonos intermedios en los bordes); si no, bloques enteros hasta pasarse y una sola reducción suave.
 */
function rasterUrl(src, dev) {
  const W = src.width, H = src.height;
  let s = dev / Math.max(W, H);
  if (s >= 1 && !Number.isInteger(s) && Math.floor(s) / s >= 0.78) s = Math.floor(s);
  const out = canvas(dev), g = out.getContext('2d');
  const w = Math.round(W * s), hh = Math.round(H * s), x = (dev - w) >> 1, y = (dev - hh) >> 1;
  if (Number.isInteger(s)) {
    g.imageSmoothingEnabled = false;
    g.drawImage(src, x, y, w, hh);
  } else {
    const k = Math.ceil(s), big = document.createElement('canvas');
    big.width = W * k; big.height = H * k;
    const bg = big.getContext('2d');
    bg.imageSmoothingEnabled = false;
    bg.drawImage(src, 0, 0, big.width, big.height);
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(big, x, y, w, hh);
  }
  return out.toDataURL();
}

/** dataURL del ícono para mostrarlo a `size` px CSS. name: id de src/core/icons/ o de un ícono registrado. */
export function iconUrl(name, size = 24) {
  return urlFor(name, Math.max(8, Math.round(size * dpr())));
}
const escAttr = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
/** HTML de un ícono a `size` px CSS (se adapta solo si el CSS lo muestra a otro tamaño). */
export function icon(name, size = 20, cls = '') {
  return `<img class="pi ${cls}" data-pi="${escAttr(name)}" src="${iconUrl(name, size)}" width="${size}" height="${size}" alt="" draggable="false">`;
}
export const ICON_NAMES = Object.keys(SPRITES);
/** Empieza a ajustar un <img data-pi> que ya estaba en la página (si se le puso data-pi después). */
export let watchIcon = () => {};

// ---------- ajuste automático al tamaño real ----------
// Cualquier <img data-pi="nombre"> se regenera a sus pixeles físicos exactos cuando cambia de tamaño.
if (typeof ResizeObserver === 'function' && typeof document !== 'undefined') {
  const ro = new ResizeObserver(entries => {
    for (const e of entries) {
      const img = e.target;
      if (!img.isConnected) { ro.unobserve(img); continue; }
      // mismo cálculo que iconUrl() (contentRect × devicePixelRatio) para que coincidan
      const dev = Math.round(e.contentRect.width * dpr());
      if (dev < 8 || img._piDev === dev) continue;
      img._piDev = dev;
      const url = urlFor(img.dataset.pi, dev);
      if (img.getAttribute('src') !== url) img.src = url;
    }
  });
  watchIcon = (img) => ro.observe(img);
  const watch = (n) => {
    if (n.nodeType !== 1) return;
    if (n.dataset.pi) ro.observe(n);
    if (n.firstElementChild) for (const el of n.querySelectorAll('img[data-pi]')) ro.observe(el);
  };
  new MutationObserver(recs => { for (const r of recs) for (const n of r.addedNodes) watch(n); })
    .observe(document.documentElement, { childList: true, subtree: true });
  watch(document.documentElement);
}
