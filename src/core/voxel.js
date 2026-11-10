// Motor visual "3D pixel art": modelos de vóxeles + render a baja resolución escalado sin suavizado.
// Todos los módulos 3D deben usar esto para que el juego se vea coherente.
import * as THREE from 'three';
import { frameCap, FPS_PARAM } from './frame-cap.js';
import { createVoxelLight } from './voxel-light.js';

import { hexToInt, shade, packVoxels, meshPacked, MESH_VERSION } from './voxel-mesh.js';
export { hexToInt, shade, AO_LEVELS, packVoxels } from './voxel-mesh.js';

const key = (x, y, z) => `${x},${y},${z}`;

/**
 * Grilla de vóxeles. Coordenadas enteras; y es "arriba".
 *   const v = new Voxels();
 *   v.box(0,0,0, 16,1,16, '#8fdc7a');  // x,y,z, ancho(x), alto(y), prof(z)
 *   v.set(3,1,3,'#ee8a5c');
 *   const mesh = v.toMesh({ scale: 1/8, center: 'xz' });
 */
export class Voxels {
  constructor() { this.map = new Map(); }
  set(x, y, z, color) { if (color == null) this.map.delete(key(x, y, z)); else this.map.set(key(x, y, z), hexToInt(color)); return this; }
  get(x, y, z) { return this.map.get(key(x, y, z)); }
  has(x, y, z) { return this.map.has(key(x, y, z)); }
  remove(x, y, z) { this.map.delete(key(x, y, z)); return this; }
  /** Caja rellena. color puede ser función (x,y,z) => color|null */
  box(x, y, z, w, h, d, color) {
    for (let i = x; i < x + w; i++) for (let j = y; j < y + h; j++) for (let k = z; k < z + d; k++)
      this.set(i, j, k, typeof color === 'function' ? color(i, j, k) : color);
    return this;
  }
  /** Caja hueca (solo paredes, sin techo ni piso) */
  walls(x, y, z, w, h, d, color) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) for (let k = z; k < z + d; k++)
      if (i === x || i === x + w - 1 || k === z || k === z + d - 1) this.set(i, j, k, typeof color === 'function' ? color(i, j, k) : color);
    return this;
  }
  clear(x, y, z, w, h, d) { return this.box(x, y, z, w, h, d, null); }
  /** Esfera/elipsoide rellena centrada en (cx,cy,cz) */
  sphere(cx, cy, cz, rx, ry = rx, rz = rx, color) {
    for (let i = Math.floor(cx - rx); i <= Math.ceil(cx + rx); i++)
      for (let j = Math.floor(cy - ry); j <= Math.ceil(cy + ry); j++)
        for (let k = Math.floor(cz - rz); k <= Math.ceil(cz + rz); k++) {
          const dx = (i - cx) / rx, dy = (j - cy) / ry, dz = (k - cz) / rz;
          if (dx * dx + dy * dy + dz * dz <= 1) this.set(i, j, k, typeof color === 'function' ? color(i, j, k) : color);
        }
    return this;
  }
  /** Cilindro vertical (eje y) */
  cylinder(cx, y, cz, r, h, color) {
    for (let i = Math.floor(cx - r); i <= Math.ceil(cx + r); i++)
      for (let k = Math.floor(cz - r); k <= Math.ceil(cz + r); k++) {
        const dx = i - cx, dz = k - cz;
        if (dx * dx + dz * dz <= r * r) for (let j = y; j < y + h; j++) this.set(i, j, k, typeof color === 'function' ? color(i, j, k) : color);
      }
    return this;
  }
  /** Techo a dos aguas a lo largo de x */
  roofX(x, y, z, w, d, color, overhang = 0) {
    const half = Math.ceil(d / 2);
    for (let s = 0; s < half; s++)
      this.box(x - overhang, y + s, z + s, w + overhang * 2, 1, d - s * 2, typeof color === 'function' ? color : (s % 2 ? shade(color, -0.08) : color));
    return this;
  }
  /** Pirámide (techo de torre) */
  pyramid(x, y, z, w, d, color) {
    let s = 0;
    while (w - s * 2 > 0 && d - s * 2 > 0) { this.box(x + s, y + s, z + s, w - s * 2, 1, d - s * 2, color); s++; }
    return this;
  }
  /** Copia otra grilla con desplazamiento */
  merge(other, ox = 0, oy = 0, oz = 0) {
    for (const [k, c] of other.map) { const [x, y, z] = k.split(',').map(Number); this.map.set(key(x + ox, y + oy, z + oz), c); }
    return this;
  }
  bounds() {
    let mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
    for (const k of this.map.keys()) {
      const p = k.split(',').map(Number);
      for (let i = 0; i < 3; i++) { mn[i] = Math.min(mn[i], p[i]); mx[i] = Math.max(mx[i], p[i] + 1); }
    }
    return { min: mn, max: mx };
  }
  get size() { return this.map.size; }

  /**
   * Genera BufferGeometry con caras ocultas eliminadas y colores por vértice.
   * opts.scale: tamaño de un vóxel en unidades de mundo (ej 1/8 => 8 vóxeles por tile)
   * opts.center: 'xz' centra en x/z (base en y=0) | 'xyz' | false
   * opts.jitter: variación de brillo por vóxel (textura pixel), default 0.015 (con pixeles de render
   *   chicos, más variación se ve como estática)
   */
  toGeometry(opts = {}) {
    const t0 = performance.now();
    const r = meshPacked(packVoxels(this.map), meshOpts(opts));
    meshStats.ms += performance.now() - t0;
    meshStats.builds++; meshStats.quads += r.quads; meshStats.faces += r.faces; meshStats.verts += r.verts;
    return buildGeometry(r);
  }
  /**
   * Igual que toGeometry pero arma la malla en un Web Worker (voxel-worker.js) y la guarda en IndexedDB: la segunda
   * vez que se pide la misma grilla con las mismas opciones sale del caché. Si no hay worker, la arma acá.
   */
  toGeometryAsync(opts = {}) { return geometryAsync(packVoxels(this.map), meshOpts(opts)); }
  toMesh(opts = {}) {
    const m = new THREE.Mesh(this.toGeometry(opts), opts.material || voxelMaterial());
    m.castShadow = opts.castShadow ?? true;
    m.receiveShadow = opts.receiveShadow ?? true;
    return m;
  }
}

// ---------- Mallas: opciones, estadísticas, worker y caché ----------
// ?greedy=0 apaga la unión de caras (para comparar capturas y medir)
const greedyParam = typeof location !== 'undefined' ? (/[?&]greedy=([01])\b/.exec(location.search) || [])[1] : null;
let GREEDY = greedyParam !== '0';
/** Prende o apaga la unión de caras para las mallas que se armen desde ahora (lo usan las pruebas). */
export function setGreedy(on) { GREEDY = !!on; }
/** Cuántas mallas se armaron, cuántos rectángulos (quads) y vértices (verts) salieron de cuántas caras al aire (faces) y en cuántos ms. */
export const meshStats = { builds: 0, quads: 0, faces: 0, verts: 0, ms: 0, cacheHits: 0, workerBuilds: 0 };
function meshOpts(o) {
  const { scale = 1, center = false, jitter = 0.015, ao = true, aoLevels, greedy = GREEDY } = o;
  return aoLevels ? { scale, center, jitter, ao, aoLevels: [...aoLevels], greedy } : { scale, center, jitter, ao, greedy };
}
function buildGeometry(r) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(r.position, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(r.normal, 3));
  g.setAttribute('color', new THREE.BufferAttribute(r.color, 3));
  g.setIndex(new THREE.BufferAttribute(r.index, 1));
  g.computeBoundingSphere(); g.computeBoundingBox();
  return g;
}
let worker = null, workerSeq = 0;
const waiting = new Map();
function getWorker() {
  if (worker !== null) return worker || null;
  try {
    if (typeof Worker !== 'function') throw new Error('sin Worker');
    worker = new Worker(new URL('./voxel-worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => {
      const w = waiting.get(e.data.id); if (!w) return;
      waiting.delete(e.data.id);
      e.data.error ? w.reject(new Error(e.data.error)) : w.resolve(e.data.r);
    };
    worker.onerror = (e) => {
      console.warn('[voxel] worker de mallas no disponible, se arman en el hilo principal', e.message || e);
      worker = false;
      for (const w of waiting.values()) w.fallback();
      waiting.clear();
    };
  } catch { worker = false; }
  return worker || null;
}
function meshInWorker(data, o) {
  const local = () => meshPacked(data, o);
  const w = getWorker();
  if (!w) return Promise.resolve(local());
  return new Promise((resolve, reject) => {
    const id = ++workerSeq;
    // si el worker se cae, la copia local de los datos sigue acá para armarla sin él
    const copy = data.slice();
    waiting.set(id, { resolve: (r) => { meshStats.workerBuilds++; resolve(r); }, reject, fallback: () => resolve(meshPacked(copy, o)) });
    w.postMessage({ id, data, opts: o }, [data.buffer]);
  });
}
// caché en IndexedDB: clave = versión del mallado + opciones + huella de la grilla
const IDB_NAME = 'pixelia-mesh', IDB_STORE = 'mesh', IDB_MAX = 600;
let dbp = null;
function db() {
  if (dbp) return dbp;
  dbp = new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null);
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch { resolve(null); }
  });
  return dbp;
}
const idb = (mode, fn) => db().then(d => d && new Promise((resolve) => {
  try {
    const tx = d.transaction(IDB_STORE, mode), st = tx.objectStore(IDB_STORE);
    const req = fn(st);
    tx.oncomplete = () => resolve(req && req.result);
    tx.onerror = tx.onabort = () => resolve(null);
  } catch { resolve(null); }
}));
/** Huella de la grilla (dos hash de 32 bits) más las opciones. */
export function meshKey(data, o) {
  let h1 = 0x811c9dc5, h2 = 0x9747b28c;
  for (let i = 0; i < data.length; i++) {
    const v = data[i];
    h1 = Math.imul(h1 ^ v, 0x01000193);
    h2 = Math.imul(h2 ^ (v + i), 0x5bd1e995); h2 ^= h2 >>> 15;
  }
  return `v${MESH_VERSION}|${JSON.stringify(o)}|${data.length}|${(h1 >>> 0).toString(36)}${(h2 >>> 0).toString(36)}`;
}
let idbCount = -1;
async function geometryAsync(data, o) {
  const k = meshKey(data, o);
  const hit = await idb('readonly', st => st.get(k));
  if (hit && hit.position) { meshStats.cacheHits++; return buildGeometry(hit); }
  const r = await meshInWorker(data, o);
  meshStats.builds++; meshStats.quads += r.quads; meshStats.faces += r.faces; meshStats.verts += r.verts;
  const g = buildGeometry(r);
  // guardar sin esperar; si se pasa del tope, se vacía entero (las mallas se vuelven a armar solas)
  (async () => {
    if (idbCount < 0) idbCount = (await idb('readonly', st => st.count())) || 0;
    if (idbCount >= IDB_MAX) { await idb('readwrite', st => st.clear()); idbCount = 0; }
    await idb('readwrite', st => st.put({ position: r.position, normal: r.normal, color: r.color, index: r.index }, k));
    idbCount++;
  })();
  return g;
}
/** Borra el caché de mallas (pruebas, o al cambiar el mallado). */
export function clearMeshCache() { idbCount = 0; return idb('readwrite', st => st.clear()); }

let _mat = null, _matEmissive = null, _matWindow = null;
/** Material compartido de vóxeles (colores por vértice, sombreado plano). */
export function voxelMaterial() {
  return _mat || (_mat = new THREE.MeshLambertMaterial({ vertexColors: true }));
}
/** Variante que brilla un poco (ventanas, luces, gemas). */
export function glowMaterial() {
  return _matEmissive || (_matEmissive = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x332722 }));
}

/**
 * Vidrios de las ventanas (models.js los separa en su capa): de día son vidrio; de noche se prenden (ambience-fx.js,
 * `setNightGlow`). Sin la noche se ven igual que el material de siempre.
 */
export function windowMaterial() {
  return _matWindow || (_matWindow = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0xffc46a, emissiveIntensity: 0 }));
}
/** Cuánto brillan de noche ventanas (0..1) y luces de los modelos. Vale para todas las escenas: la escena lo vuelve a 0. */
export function setNightGlow(k = 0) {
  k = Math.max(0, Math.min(1, k));
  windowMaterial().emissiveIntensity = k * 0.95;
  glowMaterial().emissiveIntensity = 1 + k * 2.2;
}

// ---------- Render nítido ----------
// Estilo "vóxel nítido": los pixeles del arte son los VÓXELES, no los pixeles de pantalla. Se dibuja a
// resolución alta (2 pixeles de render por px CSS) con antialias, oclusión ambiental por vértice y un
// contorno tinta suave, así los bordes diagonales no hacen serrucho y los detalles chicos se leen.
const screenDpr = () => Math.min(4, Math.max(1, (typeof devicePixelRatio === 'number' && devicePixelRatio) || 1));
// ?quality=low fuerza calidad baja; ?quality=high apaga el ajuste automático (para capturas y comparar)
const qParam = typeof location !== 'undefined' ? (/[?&]quality=(low|high)\b/.exec(location.search) || [])[1] : null;
const forcedLow = qParam === 'low';
/** Sin tocar nada durante este tiempo, las escenas con opts.idleFps bajan a ese tope. */
const IDLE_MS = 12000;
let lastInput = typeof performance !== 'undefined' ? performance.now() : 0;
if (typeof addEventListener === 'function') {
  const mark = () => { lastInput = performance.now(); };
  for (const ev of ['pointerdown', 'pointermove', 'wheel', 'keydown', 'touchstart']) addEventListener(ev, mark, { passive: true, capture: true });
}
/** Factores sobre la escala elegida que prueba el ajuste automático si los cuadros vienen lentos (2 → 1,5 → 1,2). */
const SCALES = [1, 0.75, 0.6];
/** Máximo de pixeles de render (en monitores enormes la escala baja para no ahogar la GPU). */
const MAX_BUFFER_PX = 4.6e6;

// ---------- Ajustes de gráficos (src/core/settings.js) ----------
// Valen para todos los renderers: los montados se actualizan en vivo con setGraphics y los nuevos arrancan así.
//   scale: pixeles de render por px CSS (0,5–2) · aa: MSAA · shadows · outline: contorno tinta · particles: multiplicador
//   maxFps (0 = sin tope) · bgFps: tope con la ventana sin foco · autoRes: bajar la resolución sola si va lento
//   uiZoom: zoom de la interfaz del juego de PC (el WebView agranda los px CSS; se compensa para no perder nitidez)
//   post: bloom, curva de tonos, viñeteado y desenfoque de profundidad (se apaga en calidad baja)
let GFX = { scale: 2, aa: true, shadows: true, outline: true, particles: 1, maxFps: 60, bgFps: 30, autoRes: true, uiZoom: 1, post: true };
// ?post=0 / ?post=1 lo fuerza en todas las escenas (para comparar)
const postParam = typeof location !== 'undefined' ? (/[?&]post=([01])\b/.exec(location.search) || [])[1] : null;
/**
 * Acabado de cámara por defecto (setPost lo cambia por escena o por plano):
 *   bloom: cuánto brillan las luces (0 = nada) · thr: desde qué brillo (0..1) · vignette: bordes oscuros (0..1)
 *   contrast: curva en S (0..1) · split: sombras frías y luces cálidas (0..1) · dof: { focus, range, amt } o null
 *   (focus = distancia a la cámara en unidades de mundo, range = cuánto alrededor queda nítido).
 */
export const POST_DEFAULT = { bloom: 0.32, thr: 0.8, vignette: 0.1, contrast: 0.1, split: 0.12, dof: null };
/**
 * Lo que suma el render fotográfico (opts.photo, cadena HDR) al acabado de cámara:
 *   exposure: exposición de la escena (multiplica la luz antes del mapeo de tonos AgX) · punch: contraste del AgX
 *   (1 = neutro) · agxSat: saturación después del AgX. En HDR, thr es el brillo (ya expuesto) desde el que algo florece.
 *   Lente de maqueta: lensVig = caída de luz hacia los bordes (antes del AgX, como en un lente) · ca = aberración
 *   cromática en los bordes (fracción del ancho) · grain = grano de película. Con dof, lo borroso sale en discos (bokeh).
 */
export const PHOTO_DEFAULT = { exposure: 1, punch: 1.25, agxSat: 1.15, thr: 1.0, bloom: 0.5, lensVig: 0.3, ca: 0.0012, grain: 0.03 };
const live = new Set();
/** Cuadros dibujados en total por todos los renderers (lo usa el contador de FPS de Ajustes). */
export const frameStats = { frames: 0 };
export function setGraphics(cfg) {
  GFX = { ...GFX, ...cfg };
  for (const r of live) { try { r(); } catch (e) { console.warn('[voxel] ajustes', e); } }
}
export function graphics() { return GFX; }
/**
 * Crea renderer + escena + cámara.
 * container: elemento donde se agrega el canvas (ocupa 100%).
 * opts.lowQuality: menos resolución interna (≤1,5 pixeles de render por px CSS) y sin MSAA. (opts.pixelSize ≥ 2.5,
 *   del motor viejo, también cuenta como baja calidad.)
 * opts.ortho: true = cámara ortográfica isométrica (ciudad); false = perspectiva (juegos de manejo)
 * opts.viewSize: alto visible del mundo para la ortográfica
 * opts.background: color de fondo (hex) o null para transparente
 * opts.shadows: sombras (default true)
 * opts.outline: contorno tinta alrededor de las siluetas (saltos de profundidad), ≈1 px CSS de ancho.
 *   true | { strength (0..1, default 0.85), threshold (unidades de mundo, default 0.3 en ortográfica), width (px CSS) }.
 *   Los transparentes que escriben profundidad (sprites, planos con alfa) también se contornean: usar depthWrite:false.
 * opts.maxFps: tope de cuadros por segundo (default 60; 0 = sin tope). Con la ventana sin foco, 30.
 * opts.idleFps: tope más bajo cuando nadie toca nada hace un rato (escenas tranquilas como la ciudad).
 */
export function createPixelRenderer(container, opts = {}) {
  const { ortho = true, viewSize = 14, background = 0xbfe9ff, shadows = true, fov = 50 } = opts;
  const low = forcedLow || !!opts.lowQuality || (opts.pixelSize || 0) >= 2.5;
  // render fotográfico (PLAN-FOTO R1): cadena HDR en float16 con AgX. En calidad baja queda el render clásico.
  let photo = !!opts.photo && !low;
  let scale = 2, dpr = 1, level = 0;
  // ?outline=1 / ?outline=0 en la URL lo fuerza en todas las escenas (para comparar)
  const forced = typeof location !== 'undefined' && /[?&]outline=([01])/.exec(location.search);
  let sceneOutline = opts.outline;   // lo que pidió la escena (los Ajustes lo pueden apagar)
  // La escena se dibuja (con MSAA) en el target del contorno y al canvas solo va un cuadro plano. El mismo pase
  // sirve de antialias sin contorno (líneas apagadas): así el antialias y el contorno se cambian en vivo.
  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: background == null, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = shadows && GFX.shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const canvas = renderer.domElement;
  canvas.className = 'pixel-canvas voxel-canvas';
  // render fotográfico: el antialias es temporal (TAA con reproyección) y reemplaza al MSAA. opts.taa: false lo apaga
  const taa = () => photo && opts.taa !== false;
  const samples = () => (low || !GFX.aa || !renderer.capabilities.isWebGL2 || taa()) ? 0 : 4;
  const wantOutline = () => (forced ? forced[1] === '1' : !!sceneOutline && GFX.outline);
  let outline = null, outlineKey = '';
  // corrección de color del ambiente (saturación, tono y niebla por profundidad): va en el mismo pase final
  let grade = null;
  // acabado de cámara (bloom, tonos, viñeteado, desenfoque): también en el pase final
  const postBase = () => ({ ...POST_DEFAULT, ...(photo ? PHOTO_DEFAULT : {}), ...(opts.post || {}) });
  let post = postBase();
  // opts.post: false apaga el acabado en esta escena (el render "classic" de tools/lookdev.html)
  if (photo && !renderer.capabilities.isWebGL2) photo = false;
  const wantPost = () => photo || (opts.post !== false && (postParam ? postParam === '1' : !low && GFX.post !== false) && renderer.capabilities.isWebGL2);
  // luz con rayos en el volumen de la escena (voxel-light.js); solo con el render fotográfico
  const light = photo ? createVoxelLight(renderer, {
    cell: opts.lightCell,
    classify: (m) => m === _mat ? 'solid' : m === _matEmissive ? 'glow' : m === _matWindow ? 'window'
      : (m.isMeshLambertMaterial && m.vertexColors && !m.transparent ? 'solid' : null),
  }) : null;
  if (light) renderer.shadowMap.enabled = false;
  function buildOutline() {
    const lines = wantOutline(), n = samples(), pp = wantPost();
    const key = lines || n || grade || pp ? `${lines}|${n}|${pp}|${photo}|${JSON.stringify(sceneOutline ?? null)}` : '';
    if (key === outlineKey) return false;
    outline?.dispose(); outline = null; outlineKey = key;
    if (key) outline = createOutlinePass(renderer, typeof sceneOutline === 'object' ? sceneOutline : true, n, lines, pp, photo, light, taa());
    if (outline && grade) outline.setGrade(grade);
    outline?.setPost(post);
    return true;
  }
  buildOutline();
  container.append(canvas);

  const scene = new THREE.Scene();
  if (background != null) scene.background = new THREE.Color(background);

  let camera;
  if (ortho) {
    camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -200, 400);
    camera.userData.viewSize = viewSize;
  } else camera = new THREE.PerspectiveCamera(fov, 1, 0.1, 500);

  if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
  container.style.overflow = 'hidden';
  Object.assign(canvas.style, { position: 'absolute', left: '0', top: '0', width: '100%', height: '100%' });

  function resize() {
    const w = container.clientWidth || innerWidth, h = container.clientHeight || innerHeight;
    dpr = screenDpr();
    // 2 pixeles de render por px CSS: en celular (dpr 2-3) es casi la resolución nativa y en PC (dpr 1)
    // es supersampleo 2×2 que el navegador promedia al achicar = bordes suaves también en el contorno.
    const base = (low ? Math.min(dpr, 1.5) : GFX.scale) * (GFX.uiZoom || 1);
    scale = base * (GFX.autoRes ? SCALES[level] : 1);
    scale = Math.min(scale, Math.sqrt(MAX_BUFFER_PX / Math.max(1, w * h)));
    scale = Math.max(Math.min(1, base), scale);
    const bw = Math.max(1, Math.round(w * scale)), bh = Math.max(1, Math.round(h * scale));
    renderer.setPixelRatio(1);
    renderer.setSize(bw, bh, false);
    outline?.setSize(bw, bh, scale);
    const aspect = bw / bh;
    if (camera.isOrthographicCamera) {
      const vs = camera.userData.viewSize;
      camera.left = -vs * aspect / 2; camera.right = vs * aspect / 2; camera.top = vs / 2; camera.bottom = -vs / 2;
    } else camera.aspect = aspect;
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  let mq = null;
  const onDpr = () => { resize(); watchDpr(); };
  function watchDpr() {
    mq?.removeEventListener?.('change', onDpr);
    mq = typeof matchMedia === 'function' ? matchMedia(`(resolution: ${screenDpr()}dppx)`) : null;
    mq?.addEventListener?.('change', onDpr);
  }
  resize();
  watchDpr();

  let raf = 0, running = false, last = 0;
  // ajuste automático: si en una tanda de 90 cuadros más del 60% tarda >24 ms (<42 fps), baja un escalón
  // de resolución interna. Solo baja (nunca sube) para no oscilar; se saltean los primeros cuadros (carga).
  let warm = 0, batch = 0, slow = 0;
  function watchPerf(ms) {
    if (low || !GFX.autoRes || qParam === 'high' || level >= SCALES.length - 1 || document.hidden) return;
    if (++warm < 60 || ms <= 0 || ms > 250) return;
    batch++; if (ms > 24) slow++;
    if (batch < 90) return;
    if (slow > batch * 0.6) { level++; resize(); warm = 30; }
    batch = slow = 0;
  }
  // Tope de cuadros: sin esto se dibuja a la frecuencia del monitor (144/165 Hz en PC) y la GPU queda
  // al máximo aunque la escena apenas se mueva. 60 alcanza para todo el juego; con la ventana sin foco
  // (otra app adelante) bastan 30, y opts.idleFps baja más cuando nadie toca nada hace IDLE_MS.
  let maxFps = null;   // null = lo de los Ajustes (setMaxFps lo fija para esta escena)
  let idleFps = opts.idleFps ?? 0;
  function targetFps() {
    let f = (FPS_PARAM ?? maxFps ?? opts.maxFps ?? GFX.maxFps) || Infinity;
    if (typeof document !== 'undefined' && document.hasFocus && !document.hasFocus()) f = Math.min(f, GFX.bgFps || 30);
    if (idleFps && performance.now() - lastInput > IDLE_MS) f = Math.min(f, idleFps);
    return f;
  }
  const gate = frameCap();
  const loops = new Set();
  function frame(t) {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    const fps = targetFps();
    if (!gate(t, fps)) return;
    if (last && fps >= 50) watchPerf(t - last);
    const dt = Math.min(0.05, (t - (last || t)) / 1000); last = t;
    for (const fn of loops) fn(dt, t / 1000);
    draw();
    frameStats.frames++;
  }
  function draw() {
    if (outline) outline.render(scene, camera);
    else renderer.render(scene, camera);
  }

  // ajustes en vivo: contorno/antialias, sombras (los materiales se recompilan), resolución y tope de cuadros
  let shadowsOn = renderer.shadowMap.enabled;
  function applyGfx() {
    if (level && !GFX.autoRes) level = 0;
    buildOutline();
    const sh = shadows && GFX.shadows && !light;
    if (sh !== shadowsOn) {
      shadowsOn = renderer.shadowMap.enabled = sh;
      scene.traverse(o => { const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : []; for (const m of ms) m.needsUpdate = true; });
      if (_mat) _mat.needsUpdate = true;
      if (_matEmissive) _matEmissive.needsUpdate = true;
      if (_matWindow) _matWindow.needsUpdate = true;
    }
    resize();
    gate.reset();
  }
  live.add(applyGfx);

  return {
    THREE, renderer, scene, camera, canvas,
    /** Tamaño (px CSS) de un pixel de render. */
    get pixelSize() { return 1 / scale; },
    /** Pixeles de render por px CSS. */
    get renderScale() { return scale; },
    get devicePixels() { return Math.max(1, Math.round(dpr / scale)); },
    /** Compatibilidad con el motor viejo: ≥2,5 = baja calidad. */
    setPixelSize() { resize(); },
    /** Cambia el zoom de la ortográfica (alto visible en unidades de mundo) */
    setViewSize(vs) { camera.userData.viewSize = vs; resize(); },
    resize,
    /** Agrega función (dt, timeSec) llamada cada frame antes de renderizar. Devuelve función para quitarla. */
    onFrame(fn) { loops.add(fn); return () => loops.delete(fn); },
    start() { if (running) return; running = true; last = 0; gate.reset(); raf = requestAnimationFrame(frame); },
    stop() { running = false; cancelAnimationFrame(raf); },
    render: draw,
    /** Prende/apaga el contorno tinta de esta escena (true | {strength, threshold, width} | false). */
    setOutline(o) { sceneOutline = o; if (buildOutline()) resize(); },
    /**
     * Corrección de color del ambiente (src/core/ambience-fx.js): { sat, tint: [r,g,b], fog: { color, amt, near, far } }
     * o null. Con un valor, el pase final queda aunque no haya contorno ni antialias.
     */
    setGrade(g) {
      const had = !!grade;
      grade = g || null;
      if (had !== !!grade && buildOutline()) resize();
      if (grade) outline?.setGrade(grade);
    },
    get grade() { return grade; },
    /**
     * Acabado de cámara (ver POST_DEFAULT): mezcla lo que se pasa con lo de ahora. setPost(null) vuelve a lo de la escena.
     * dof: { focus, range, amt } o null.
     */
    setPost(p) {
      post = p === null ? postBase() : { ...post, ...p };
      outline?.setPost(post);
    },
    get post() { return { ...post }; },
    /** ¿Hay bloom y demás (no en calidad baja)? */
    get postOn() { return !!outline?.post; },
    /** ¿Render fotográfico (cadena HDR)? */
    get photo() { return photo; },
    /** Luz del render fotográfico (volumen, materiales, ambiente): ver voxel-light.js. null en el render clásico. */
    light,
    /** ¿Se dibuja el contorno tinta? */
    get outline() { return !!outline && wantOutline(); },
    /** Muestras de antialias (0 = sin antialias). */
    get samples() { return outline ? samples() : 0; },
    get shadows() { return renderer.shadowMap.enabled; },
    /** Tope de cuadros por segundo para esta escena (0 = sin tope, null = el de Ajustes) y tope sin tocar nada. */
    setMaxFps(fps, idle = idleFps) { maxFps = fps; idleFps = idle; },
    get fps() { return targetFps(); },
    /** Convierte coordenadas de pantalla (clientX/Y) a NDC */
    toNDC(clientX, clientY) {
      const r = canvas.getBoundingClientRect();
      return new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    },
    /** Punto del plano y=planeY bajo el puntero (o null) */
    pickGround(clientX, clientY, planeY = 0) {
      const ray = new THREE.Raycaster();
      ray.setFromCamera(this.toNDC(clientX, clientY), camera);
      const p = new THREE.Vector3();
      return ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -planeY), p) ? p : null;
    },
    /** Proyecta un punto del mundo a coordenadas de pantalla (px CSS) */
    toScreen(v3) {
      const p = v3.clone().project(camera);
      const r = canvas.getBoundingClientRect();
      return { x: r.left + (p.x + 1) / 2 * r.width, y: r.top + (1 - p.y) / 2 * r.height, visible: p.z < 1 };
    },
    dispose() {
      this.stop(); ro.disconnect(); loops.clear(); live.delete(applyGfx);
      mq?.removeEventListener?.('change', onDpr);
      outline?.dispose();
      light?.dispose();
      disposeObject(scene);
      renderer.dispose();
      renderer.forceContextLoss?.();
      canvas.remove();
    },
  };
}

/**
 * Post-proceso de contorno: renderiza la escena (con MSAA si se puede) a un target con profundidad y pinta
 * de tinta el borde de afuera de cada silueta (pixeles de fondo pegados a algo bastante más cerca).
 * Mira vecinos a 1 y a `width` pixeles en 8 direcciones y suaviza el borde exterior, así la línea
 * mide ≈1 px CSS a cualquier resolución y no hace escalones duros.
 * En perspectiva el umbral crece con la distancia para no rayar el piso lejano en ángulo rasante.
 */
function createOutlinePass(renderer, o, samples = 0, lines = true, withPost = false, hdr = false, light = null, taa = false) {
  const cfg = typeof o === 'object' ? o : {};
  // RGBA8 en sRGB (no float16): la mitad de memoria y ancho de banda con MSAA, ~25% menos de GPU por
  // cuadro, y la imagen sale igual (la GPU guarda en sRGB y lee de vuelta en lineal, sin bandas).
  // Con hdr (render fotográfico) sí va en float16 lineal: la luz pasa de 1 y el AgX la baja al final.
  const rt = new THREE.WebGLRenderTarget(1, 1, {
    ...(hdr ? { type: THREE.HalfFloatType } : { type: THREE.UnsignedByteType, colorSpace: THREE.SRGBColorSpace }),
    minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true, samples,
  });
  rt.depthTexture = new THREE.DepthTexture(1, 1);
  rt.depthTexture.type = THREE.UnsignedIntType;
  // ---------- acabado de cámara: bloom y desenfoque a 1/4 de resolución (float16, sin bandas en el halo) ----------
  const small = () => new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false });
  const pp = withPost ? { a: small(), b: small(), c: small(), d: small() } : null;
  const quadVS = `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
  // extracción: promedia 4×4 pixeles de la imagen completa y se queda con lo que pasa el umbral (thr < 0 = todo)
  const extract = withPost ? new THREE.ShaderMaterial({
    defines: hdr ? { HDR: '' } : {},
    uniforms: { tColor: { value: rt.texture }, texel: { value: new THREE.Vector2(1, 1) }, thr: { value: 0.8 }, exposure: { value: 1 } },
    vertexShader: quadVS,
    fragmentShader: `
      uniform sampler2D tColor; uniform vec2 texel; uniform float thr; uniform float exposure; varying vec2 vUv;
      void main() {
        vec3 s = vec3(0.0);
        for (int i = 0; i < 4; i++) for (int j = 0; j < 4; j++) {
          vec4 c = texture2D(tColor, vUv + vec2(float(i) - 1.5, float(j) - 1.5) * texel);
          #ifdef HDR
          // luz real: se expone y se le pone techo (un pixel de sol no tiene que quemar todo el halo)
          c.rgb = min(c.rgb * exposure, vec3(24.0));
          if (thr >= 0.0) { float hb = max(c.r, max(c.g, c.b)); c.rgb *= smoothstep(thr, thr * 1.6 + 0.05, hb); }
          #else
          if (thr >= 0.0) {
            vec3 u = c.a > 0.0 ? c.rgb / c.a : vec3(0.0);
            float b = max(u.r, max(u.g, u.b));
            c.rgb *= smoothstep(thr, thr + 0.2, b);
          }
          #endif
          s += c.rgb;
        }
        gl_FragColor = vec4(s / 16.0, 1.0);
      }`,
    depthTest: false, depthWrite: false, blending: THREE.NoBlending,
  }) : null;
  const blur = withPost ? new THREE.ShaderMaterial({
    uniforms: { tSrc: { value: null }, dir: { value: new THREE.Vector2(1, 0) } },
    vertexShader: quadVS,
    fragmentShader: `
      uniform sampler2D tSrc; uniform vec2 dir; varying vec2 vUv;
      void main() {
        vec3 s = texture2D(tSrc, vUv).rgb * 0.227;
        s += (texture2D(tSrc, vUv + dir * 1.385).rgb + texture2D(tSrc, vUv - dir * 1.385).rgb) * 0.316;
        s += (texture2D(tSrc, vUv + dir * 3.231).rgb + texture2D(tSrc, vUv - dir * 3.231).rgb) * 0.070;
        gl_FragColor = vec4(s, 1.0);
      }`,
    depthTest: false, depthWrite: false, blending: THREE.NoBlending,
  }) : null;
  // ---------- render fotográfico: historia (TAA), niebla y bokeh ----------
  // El pase de historia mezcla el cuadro nuevo (con la niebla volumétrica ya sumada) con los anteriores, reproyectados
  // con la profundidad. La cámara se corre menos de un pixel por cuadro: al promediar, los bordes quedan suaves.
  const histRT = () => new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false });
  const hist = hdr ? [histRT(), histRT()] : null;
  let hi = 0, histOk = false, frameN = 0;
  const prevVP = new THREE.Matrix4(), curVP = new THREE.Matrix4(), tmpM = new THREE.Matrix4();
  const resolve = hdr ? new THREE.ShaderMaterial({
    uniforms: { tCur: { value: rt.texture }, tHist: { value: null }, tDepth: { value: rt.depthTexture }, tFog: { value: null }, fogOn: { value: 0 }, reproj: { value: new THREE.Matrix4() }, texel: { value: new THREE.Vector2(1, 1) }, blend: { value: 1 } },
    vertexShader: quadVS,
    fragmentShader: `
      uniform sampler2D tCur; uniform sampler2D tHist; uniform sampler2D tDepth; uniform sampler2D tFog;
      uniform mat4 reproj; uniform vec2 texel; uniform float blend; uniform float fogOn; varying vec2 vUv;
      float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
      void main() {
        vec4 c = texture2D(tCur, vUv);
        vec3 a = texture2D(tCur, vUv + vec2(texel.x, 0.0)).rgb, b = texture2D(tCur, vUv - vec2(texel.x, 0.0)).rgb;
        vec3 d = texture2D(tCur, vUv + vec2(0.0, texel.y)).rgb, e = texture2D(tCur, vUv - vec2(0.0, texel.y)).rgb;
        vec3 mn = min(c.rgb, min(min(a, b), min(d, e))), mx = max(c.rgb, max(max(a, b), max(d, e)));
        if (fogOn > 0.0) {
          vec4 f = texture2D(tFog, vUv);
          c.rgb = c.rgb * f.a + f.rgb; mn = mn * f.a + f.rgb; mx = mx * f.a + f.rgb;
        }
        float w = blend;
        vec3 o = c.rgb;
        if (w < 1.0) {
          vec4 h = reproj * vec4(vUv * 2.0 - 1.0, texture2D(tDepth, vUv).x * 2.0 - 1.0, 1.0);
          vec2 p = h.xy / h.w * 0.5 + 0.5;
          if (p.x < 0.0 || p.y < 0.0 || p.x > 1.0 || p.y > 1.0) w = 1.0;
          else {
            // la historia no puede salirse de lo que hay alrededor en el cuadro nuevo: así no deja estelas
            vec3 ext = (mx - mn) * 0.25 + 0.02 * c.rgb;
            vec3 hc = clamp(texture2D(tHist, p).rgb, mn - ext, mx + ext);
            float wc = w / (1.0 + luma(c.rgb)), wh = (1.0 - w) / (1.0 + luma(hc));
            o = (c.rgb * wc + hc * wh) / (wc + wh);
          }
        }
        gl_FragColor = vec4(max(o, vec3(0.0)), c.a);
      }`,
    depthTest: false, depthWrite: false, blending: THREE.NoBlending,
  }) : null;
  // desenfoque en discos: 16 muestras en espiral, donde lo más brillante pesa más (las luces fuera de foco hacen círculos)
  const bokeh = withPost && hdr ? new THREE.ShaderMaterial({
    uniforms: { tSrc: { value: null }, px: { value: new THREE.Vector2(1, 1) }, rad: { value: 5 }, rot: { value: 0 } },
    vertexShader: quadVS,
    fragmentShader: `
      uniform sampler2D tSrc; uniform vec2 px; uniform float rad; uniform float rot; varying vec2 vUv;
      void main() {
        vec3 s = vec3(0.0); float ws = 0.0;
        for (int i = 0; i < 16; i++) {
          float r = sqrt((float(i) + 0.5) / 16.0) * rad, a = float(i) * 2.39996 + rot;
          vec3 c = texture2D(tSrc, vUv + vec2(cos(a), sin(a)) * r * px).rgb;
          float w = 1.0 + dot(c, vec3(0.6));
          s += c * w; ws += w;
        }
        gl_FragColor = vec4(s / ws, 1.0);
      }`,
    depthTest: false, depthWrite: false, blending: THREE.NoBlending,
  }) : null;
  const HALTON = [[0.5, 0.3333], [0.25, 0.6667], [0.75, 0.1111], [0.125, 0.4444], [0.625, 0.7778], [0.375, 0.2222], [0.875, 0.5556], [0.0625, 0.8889]];
  const mat = new THREE.ShaderMaterial({
    defines: withPost ? { POST: '' } : {},
    uniforms: {
      exposure: { value: 1 }, punch: { value: 1.25 }, agxSat: { value: 1.15 }, lensVig: { value: 0 }, ca: { value: 0 }, grain: { value: 0 }, grainPx: { value: 2 }, seed: { value: 0 },
      tColor: { value: rt.texture }, tDepth: { value: rt.depthTexture }, texel: { value: new THREE.Vector2(1, 1) },
      near: { value: 0.1 }, far: { value: 100 }, ink: { value: new THREE.Color(0x3d2f2a) }, lineW: { value: 2 },
      strength: { value: cfg.strength ?? 0.85 }, lines: { value: lines ? 1 : 0 }, thrAbs: { value: 0.3 }, thrLin: { value: 0 }, thrSq: { value: 0 },
      sat: { value: 1 }, tint: { value: new THREE.Vector3(1, 1, 1) }, fogColor: { value: new THREE.Color(0xc8c2b4) },
      fogAmt: { value: 0 }, fogNear: { value: 50 }, fogFar: { value: 90 },
      tBloom: { value: pp?.a.texture ?? null }, bloomAmt: { value: 0 }, tBlur: { value: pp?.c.texture ?? null },
      dofAmt: { value: 0 }, dofFocus: { value: 10 }, dofRange: { value: 4 }, vig: { value: 0 }, aspect: { value: 1 },
      contrast: { value: 0 }, splitAmt: { value: 0 },
      splitLo: { value: new THREE.Vector3(0.9, 0.97, 1.12) }, splitHi: { value: new THREE.Vector3(1.08, 1.0, 0.9) },
    },
    vertexShader: quadVS,
    fragmentShader: `
      #include <packing>
      uniform sampler2D tColor; uniform sampler2D tDepth; uniform vec2 texel; uniform float lineW;
      uniform float near; uniform float far; uniform vec3 ink; uniform float strength; uniform float lines;
      uniform float thrAbs; uniform float thrLin; uniform float thrSq;
      uniform float sat; uniform vec3 tint; uniform vec3 fogColor; uniform float fogAmt; uniform float fogNear; uniform float fogFar;
      uniform sampler2D tBloom; uniform float bloomAmt; uniform sampler2D tBlur;
      uniform float dofAmt; uniform float dofFocus; uniform float dofRange; uniform float vig; uniform float aspect;
      uniform float contrast; uniform float splitAmt; uniform vec3 splitLo; uniform vec3 splitHi;
      varying vec2 vUv;
      #ifdef HDR
      uniform float exposure; uniform float punch; uniform float agxSat;
      uniform float lensVig; uniform float ca; uniform float grain; uniform float grainPx; uniform float seed;
      // AgX (Troy Sobotka; aproximación de Benjamin Wrensch): entra luz lineal sin techo, sale lineal de pantalla 0..1
      vec3 agx(vec3 v) {
        const mat3 inM = mat3(0.842479062253094, 0.0423282422610123, 0.0423756549057051, 0.0784335999999992, 0.878468636469772, 0.0784336, 0.0792237451477643, 0.0791661274605434, 0.879142973793104);
        const mat3 outM = mat3(1.19687900512017, -0.0528968517574562, -0.0529716355144438, -0.0980208811401368, 1.15190312990417, -0.0980434501171241, -0.0990297440797205, -0.0989611768448433, 1.15107367264116);
        v = inM * max(v, vec3(0.0));
        v = (clamp(log2(max(v, vec3(1e-10))), -12.47393, 4.026069) + 12.47393) / 16.5;
        vec3 v2 = v * v, v4 = v2 * v2;
        v = 15.5 * v4 * v2 - 40.14 * v4 * v + 31.96 * v4 - 6.868 * v2 * v + 0.4298 * v2 + 0.1191 * v - 0.00232;
        // "look": más contraste (los negros bajan de verdad) y algo de saturación
        v = pow(max(v, vec3(0.0)), vec3(punch));
        float l = dot(v, vec3(0.2126, 0.7152, 0.0722));
        v = l + agxSat * (v - l);
        return pow(clamp(outM * v, 0.0, 1.0), vec3(2.2));
      }
      #endif
      float dist(vec2 uv) {
        float d = texture2D(tDepth, uv).x;
        #ifdef ORTHO
        return -orthographicDepthToViewZ(d, near, far);
        #else
        return -perspectiveDepthToViewZ(d, near, far);
        #endif
      }
      // vecino más cercano a la cámara en 8 direcciones a r pixeles
      float nearest(vec2 uv, float r) {
        vec2 a = texel * r, b = texel * r * 0.7071;
        float m = min(min(dist(uv + vec2(a.x, 0.0)), dist(uv - vec2(a.x, 0.0))), min(dist(uv + vec2(0.0, a.y)), dist(uv - vec2(0.0, a.y))));
        float n = min(min(dist(uv + b), dist(uv - b)), min(dist(uv + vec2(b.x, -b.y)), dist(uv + vec2(-b.x, b.y))));
        return min(m, n);
      }
      void main() {
        vec4 c = texture2D(tColor, vUv);
        #ifdef HDR
        // lente: aberración cromática (rojo y azul se separan hacia los bordes) y caída de luz, antes del mapeo de tonos
        vec2 lq = (vUv - 0.5) * vec2(aspect, 1.0);
        float lr2 = dot(lq, lq) / (0.25 * (aspect * aspect + 1.0));
        if (ca > 0.0) {
          vec2 off = (vUv - 0.5) * (ca * lr2);
          c.r = texture2D(tColor, vUv + off).r; c.b = texture2D(tColor, vUv - off).b;
        }
        float lensFall = 1.0 / ((1.0 + lensVig * lr2) * (1.0 + lensVig * lr2));
        c.rgb *= exposure * lensFall;
        #endif
        float dc = dist(vUv);
        float coc = 0.0;
        #ifdef POST
        // desenfoque de profundidad: lo que está lejos del foco se mezcla con la versión borrosa (y pierde la tinta)
        if (dofAmt > 0.0) {
          coc = dofAmt * smoothstep(dofRange * 0.5, dofRange * 1.6, abs(dc - dofFocus));
          vec3 blurC = texture2D(tBlur, vUv).rgb;
          #ifdef HDR
          blurC *= lensFall;
          #endif
          c = mix(c, vec4(blurC, 1.0), coc);
        }
        #endif
        float thr = thrAbs + dc * thrLin + dc * dc * thrSq;
        float k = 0.0;
        if (dc - nearest(vUv, 1.0) > thr) k = 1.0;
        else if (lineW > 1.5 && dc - nearest(vUv, lineW) > thr) k = 1.0;
        else if (dc - nearest(vUv, lineW + 1.0) > thr) k = 0.4;
        k *= (c.a > 0.99 ? strength : 1.0) * lines * (1.0 - coc);
        // c viene premultiplicado (fondo transparente): tinta encima y de vuelta a sRGB sin premultiplicar
        vec4 o = vec4(mix(c.rgb, ink, k), mix(c.a, 1.0, k));
        vec3 rgb = o.a > 0.0 ? o.rgb / o.a : vec3(0.0);
        // ambiente: niebla por profundidad (lo lejano se pierde), saturación y tono (noche, clima, la isla gris)
        float f = fogAmt * smoothstep(fogNear, fogFar, dc) * (1.0 - k);
        rgb = mix(rgb, fogColor, f);
        float a = o.a;
        #ifdef POST
        // bloom: el halo de las luces se suma (sobre el cielo transparente de la ciudad también se ve)
        if (bloomAmt > 0.0) {
          vec3 bl = texture2D(tBloom, vUv).rgb * bloomAmt;
          #ifdef HDR
          bl *= lensFall;
          #endif
          vec3 lin = rgb * a + bl;
          a = clamp(a + max(bl.r, max(bl.g, bl.b)), 0.0, 1.0);
          rgb = a > 0.0 ? lin / a : vec3(0.0);
        }
        #endif
        #ifdef HDR
        rgb = agx(rgb);
        #endif
        float lum = dot(rgb, vec3(0.2126, 0.7152, 0.0722));
        rgb = max(mix(vec3(lum), rgb, sat) * tint, 0.0);
        #ifdef POST
        // curva en S (en un espacio cercano al perceptual) y sombras frías / luces cálidas
        vec3 pc = sqrt(clamp(rgb, 0.0, 1.0));
        pc = mix(pc, pc * pc * (3.0 - 2.0 * pc), contrast);
        rgb = max(rgb - 1.0, 0.0) + pc * pc;
        float l2 = dot(rgb, vec3(0.2126, 0.7152, 0.0722));
        rgb = mix(rgb, rgb * mix(splitLo, splitHi, smoothstep(0.03, 0.45, l2)), splitAmt);
        vec2 q = (vUv - 0.5) * vec2(aspect, 1.0);
        float vd = length(q) / length(vec2(aspect, 1.0) * 0.5);
        rgb *= 1.0 - vig * smoothstep(0.4, 1.05, vd);
        #endif
        #ifdef HDR
        // grano de película: del tamaño de un pixel de pantalla, más visible en los medios y las sombras
        if (grain > 0.0) {
          vec2 gp = floor(gl_FragCoord.xy / grainPx) + seed * 17.0;
          float gn = fract(sin(dot(gp, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
          vec3 gs = sqrt(clamp(rgb, 0.0, 1.0)) + gn * grain * (1.0 - 0.6 * dot(rgb, vec3(0.333)));
          rgb = max(gs, 0.0) * max(gs, 0.0);
        }
        #endif
        gl_FragColor = vec4(rgb, 1.0);
        #include <colorspace_fragment>
        gl_FragColor = vec4(gl_FragColor.rgb * a, a);
      }`,
    depthTest: false, depthWrite: false, transparent: true, blending: THREE.NoBlending,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  quad.frustumCulled = false;
  const postScene = new THREE.Scene(); postScene.add(quad);
  const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  let ortho = null, P = { ...POST_DEFAULT }, bloomBoost = 0, sw = 1, sh = 1;
  function pass(material, target) { quad.material = material; renderer.setRenderTarget(target); renderer.render(postScene, postCam); }
  function blurInto(src, tmp, spread) {
    blur.uniforms.tSrc.value = src.texture; blur.uniforms.dir.value.set(spread / sw, 0); pass(blur, tmp);
    blur.uniforms.tSrc.value = tmp.texture; blur.uniforms.dir.value.set(0, spread / sh); pass(blur, src);
  }
  const bloomOn = () => P.bloom * (1 + bloomBoost) > 0.001;
  const dofOn = () => !!(P.dof && (P.dof.amt ?? 1) > 0);
  return {
    get post() { return withPost; },
    setSize(w, h, scale = 2) {
      rt.setSize(w, h); mat.uniforms.texel.value.set(1 / w, 1 / h);
      light?.setSize(w, h);
      if (hist) { hist[0].setSize(w, h); hist[1].setSize(w, h); resolve.uniforms.texel.value.set(1 / w, 1 / h); histOk = false; }
      mat.uniforms.grainPx.value = Math.max(1, Math.round(scale));
      mat.uniforms.lineW.value = Math.max(1, Math.round((cfg.width ?? 1.1) * scale));
      mat.uniforms.aspect.value = w / Math.max(1, h);
      if (pp) {
        sw = Math.max(1, Math.round(w / 4)); sh = Math.max(1, Math.round(h / 4));
        for (const t of Object.values(pp)) t.setSize(sw, sh);
        extract.uniforms.texel.value.set(1 / w, 1 / h);
      }
    },
    render(scene, camera) {
      if (ortho !== !!camera.isOrthographicCamera) {
        ortho = !!camera.isOrthographicCamera;
        mat.defines = { ...(withPost ? { POST: '' } : {}), ...(hdr ? { HDR: '' } : {}), ...(ortho ? { ORTHO: '' } : {}) };
        mat.needsUpdate = true;
        const u = mat.uniforms;
        if (ortho) { u.thrAbs.value = cfg.threshold ?? 0.3; u.thrLin.value = 0; u.thrSq.value = 0; }
        else { u.thrAbs.value = cfg.threshold ?? 0.15; u.thrLin.value = 0.03; u.thrSq.value = 0.0015; }
      }
      mat.uniforms.near.value = camera.near; mat.uniforms.far.value = camera.far;
      const prev = renderer.getRenderTarget();
      // TAA: la proyección se corre una fracción de pixel distinta en cada cuadro (y se devuelve a su lugar al final)
      let jx = 0, jy = 0;
      const pe = camera.projectionMatrix.elements, ji = ortho ? 12 : 8;
      if (hist) {
        if (camera.parent === null) camera.updateMatrixWorld();
        curVP.multiplyMatrices(camera.projectionMatrix, tmpM.copy(camera.matrixWorld).invert());
        if (taa) {
          const j = HALTON[frameN++ % 8];
          jx = (j[0] - 0.5) * 2 / rt.width; jy = (j[1] - 0.5) * 2 / rt.height;
          pe[ji] += jx; pe[ji + 1] += jy;
          camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
        }
      }
      light?.prepare(scene, camera);
      renderer.setRenderTarget(rt);
      renderer.render(scene, camera);
      const u = mat.uniforms;
      if (hist) {
        if (taa) { pe[ji] -= jx; pe[ji + 1] -= jy; camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert(); }
        const ru = resolve.uniforms, out = hist[hi ^= 1];
        ru.tHist.value = hist[hi ^ 1].texture;
        ru.tFog.value = light?.fogTexture ?? null; ru.fogOn.value = light?.fogOn ? 1 : 0;
        ru.reproj.value.copy(prevVP).multiply(tmpM.copy(curVP).invert());
        ru.blend.value = taa && histOk ? 0.1 : 1;
        pass(resolve, out);
        prevVP.copy(curVP); histOk = true;
        u.tColor.value = out.texture; if (extract) extract.uniforms.tColor.value = out.texture;
        u.seed.value = frameN % 61;
      }
      u.bloomAmt.value = 0; u.dofAmt.value = 0;
      if (pp && bloomOn()) {
        extract.uniforms.thr.value = P.thr ?? 0.8;
        pass(extract, pp.a);
        blurInto(pp.a, pp.b, 1); blurInto(pp.a, pp.b, 2.2);
        u.bloomAmt.value = P.bloom * (1 + bloomBoost);
      }
      if (pp && dofOn()) {
        extract.uniforms.thr.value = -1;
        pass(extract, pp.c);
        if (bokeh) {
          const bu = bokeh.uniforms; bu.px.value.set(1 / sw, 1 / sh);
          bu.tSrc.value = pp.c.texture; bu.rad.value = P.dof.bokeh ?? 5; bu.rot.value = 0; pass(bokeh, pp.d);
          bu.tSrc.value = pp.d.texture; bu.rad.value = (P.dof.bokeh ?? 5) * 0.4; bu.rot.value = 1.2; pass(bokeh, pp.c);
        } else { blurInto(pp.c, pp.d, 1); blurInto(pp.c, pp.d, 1.8); }
        u.dofAmt.value = Math.min(1, P.dof.amt ?? 1); u.dofFocus.value = P.dof.focus ?? 10; u.dofRange.value = Math.max(0.05, P.dof.range ?? 4);
      }
      quad.material = mat;
      renderer.setRenderTarget(prev);
      renderer.render(postScene, postCam);
    },
    setGrade(g) {
      const u = mat.uniforms;
      u.sat.value = g.sat ?? 1;
      const t = g.tint || [1, 1, 1]; u.tint.value.set(t[0], t[1], t[2]);
      const f = g.fog || {};
      u.fogAmt.value = f.amt || 0; if (f.color != null) u.fogColor.value.set(f.color);
      u.fogNear.value = f.near ?? 50; u.fogFar.value = f.far ?? 90;
      // en HDR lo emisivo ya brilla de verdad de noche: no hace falta inflar el halo
      bloomBoost = hdr ? 0 : g.bloomBoost || 0;
    },
    setPost(p) {
      P = { ...POST_DEFAULT, ...(p || {}) };
      const u = mat.uniforms;
      u.vig.value = P.vignette || 0; u.contrast.value = P.contrast || 0; u.splitAmt.value = P.split || 0;
      u.exposure.value = P.exposure ?? 1; u.punch.value = P.punch ?? 1.25; u.agxSat.value = P.agxSat ?? 1.15;
      if (extract) extract.uniforms.exposure.value = hdr ? (P.exposure ?? 1) : 1;
      if (hdr) { u.lensVig.value = P.lensVig || 0; u.ca.value = P.ca || 0; u.grain.value = P.grain || 0; }
    },
    dispose() {
      rt.depthTexture.dispose(); rt.dispose(); quad.geometry.dispose(); mat.dispose();
      if (hist) { hist[0].dispose(); hist[1].dispose(); resolve.dispose(); }
      bokeh?.dispose();
      if (pp) { for (const t of Object.values(pp)) t.dispose(); extract.dispose(); blur.dispose(); }
    },
  };
}

/** Luces estándar del juego: cielo pastel + sol cálido con sombras. Devuelve { hemi, sun }. */
export function addLights(scene, { shadowSize = 30, shadowRes = 2048 } = {}) {
  const hemi = new THREE.HemisphereLight(0xffffff, 0xa5b9ea, 1.5);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff3e6, 2.0);
  sun.position.set(12, 22, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(shadowRes, shadowRes);
  const s = shadowSize / 2;
  Object.assign(sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 1, far: 80 });
  sun.shadow.bias = -0.0015;
  sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target);
  return { hemi, sun };
}

/** Coloca una cámara ortográfica en vista isométrica mirando a `target`. angle en radianes alrededor de Y. */
export function setIsoCamera(camera, target = new THREE.Vector3(), angle = Math.PI / 4, dist = 60, pitch = 0.62) {
  camera.position.set(target.x + Math.sin(angle) * dist * Math.cos(pitch), target.y + Math.sin(pitch) * dist, target.z + Math.cos(angle) * dist * Math.cos(pitch));
  camera.lookAt(target);
}

/** Libera geometrías/materiales/texturas de un objeto (no toca los materiales compartidos). */
export function disposeObject(obj) {
  obj.traverse?.(o => {
    o.geometry?.dispose?.();
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) {
      if (m === _mat || m === _matEmissive) continue;
      for (const v of Object.values(m)) if (v && v.isTexture) v.dispose();
      m.dispose?.();
    }
  });
}

/** Sprite de texto/ícono pixelado que mira a cámara (para burbujas sobre edificios). */
export function makeBillboard(drawFn, w = 32, h = 32, worldHeight = 1) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  drawFn(cv.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(cv);
  tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false }));
  sp.scale.set(worldHeight * w / h, worldHeight, 1);
  sp.renderOrder = 10;
  sp.userData.redraw = (fn) => { fn(cv.getContext('2d'), w, h); tex.needsUpdate = true; };
  return sp;
}

/** Carga una imagen (dataURL) en un sprite pixelado. */
export function imageSprite(url, worldHeight = 1) {
  const tex = new THREE.TextureLoader().load(url);
  tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false }));
  sp.scale.set(worldHeight, worldHeight, 1);
  sp.renderOrder = 10;
  return sp;
}

/**
 * Contorno tinta suave alrededor de la silueta de un render con fondo transparente (miniaturas).
 * Estampa la silueta en tinta corrida en 16 direcciones y dibuja el render encima: el borde sale
 * antialiaseado (combina con el contorno del 3D en vivo). width en pixeles del canvas.
 */
export function outlineCanvas(src, width = 3, ink = '#3d2f2a') {
  const w = src.width, h = src.height;
  const sil = document.createElement('canvas');
  sil.width = w; sil.height = h;
  const sg = sil.getContext('2d');
  sg.drawImage(src, 0, 0);
  sg.globalCompositeOperation = 'source-in';
  sg.fillStyle = ink; sg.fillRect(0, 0, w, h);
  const out = document.createElement('canvas');
  out.width = w; out.height = h;
  const g = out.getContext('2d');
  for (const r of [width * 0.5, width]) for (let i = 0; i < 16; i++) {
    const a = i / 16 * Math.PI * 2;
    g.drawImage(sil, Math.cos(a) * r, Math.sin(a) * r);
  }
  g.drawImage(src, 0, 0);
  return out;
}
