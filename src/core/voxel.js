// Motor visual "3D pixel art": modelos de vóxeles + render a baja resolución escalado sin suavizado.
// Todos los módulos 3D deben usar esto para que el juego se vea coherente.
import * as THREE from 'three';
import { frameCap, FPS_PARAM } from './frame-cap.js';

// ---------- Colores ----------
export function hexToInt(c) { return typeof c === 'number' ? c : parseInt(c.replace('#', ''), 16); }
/** Aclara (amt>0) u oscurece (amt<0) un color. amt en -1..1 */
export function shade(c, amt) {
  const n = hexToInt(c);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (amt >= 0) { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; }
  else { r *= 1 + amt; g *= 1 + amt; b *= 1 + amt; }
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
}

// ---------- Constructor de vóxeles ----------
const DIRS = [
  { n: [1, 0, 0], c: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]] },
  { n: [-1, 0, 0], c: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]] },
  { n: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] },
  { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
  { n: [0, 0, 1], c: [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]] },
  { n: [0, 0, -1], c: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]] },
];
// ejes tangentes (u, w) de cada cara, para la oclusión ambiental por vértice
for (const d of DIRS) { const ax = d.n.findIndex(v => v !== 0); [d.u, d.w] = [0, 1, 2].filter(i => i !== ax); }
/** Brillo por esquina según cuántos vecinos la tapan (0 = rincón cerrado .. 3 = libre). En lineal. */
const AO_LEVELS = [0.5, 0.66, 0.83, 1];
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
  toGeometry({ scale = 1, center = false, jitter = 0.015, ao = true } = {}) {
    const pos = [], nor = [], col = [], idx = [];
    let off = [0, 0, 0];
    if (center && this.map.size) {
      const b = this.bounds();
      off = [-(b.min[0] + b.max[0]) / 2, center === 'xyz' ? -(b.min[1] + b.max[1]) / 2 : -b.min[1], -(b.min[2] + b.max[2]) / 2];
    }
    const tmp = new THREE.Color();
    const map = this.map;
    const occ = (x, y, z) => map.has(key(x, y, z)) ? 1 : 0;
    const p = [0, 0, 0], aoV = [3, 3, 3, 3];
    for (const [k, c] of map) {
      const [x, y, z] = k.split(',').map(Number);
      let h = (x * 73856093) ^ (y * 19349663) ^ (z * 83492791);
      h = ((h >>> 0) % 1000) / 1000;
      const cc = jitter ? shade(c, (h - 0.5) * 2 * jitter) : c;
      tmp.setHex(cc); // setHex ya convierte sRGB -> lineal
      for (const d of DIRS) {
        const nx = x + d.n[0], ny = y + d.n[1], nz = z + d.n[2];
        if (map.has(key(nx, ny, nz))) continue;
        const base = pos.length / 3;
        // oclusión ambiental por vértice: cada esquina mira sus 3 vecinos en la capa de afuera de la cara
        // (dos lados y la diagonal). Oscurece rincones, aleros y el pie de las paredes = volumen y lectura.
        for (let i = 0; i < 4; i++) {
          const v = d.c[i];
          let a = 3;
          if (ao) {
            p[0] = nx; p[1] = ny; p[2] = nz;
            const u = d.u, w = d.w;
            const su = v[u] ? 1 : -1, sw = v[w] ? 1 : -1;
            p[u] += su; const s1 = occ(p[0], p[1], p[2]); p[u] -= su;
            p[w] += sw; const s2 = occ(p[0], p[1], p[2]);
            p[u] += su; const cr = occ(p[0], p[1], p[2]);
            a = s1 && s2 ? 0 : 3 - (s1 + s2 + cr);
          }
          aoV[i] = a;
          const f = AO_LEVELS[a];
          pos.push((x + v[0] + off[0]) * scale, (y + v[1] + off[1]) * scale, (z + v[2] + off[2]) * scale);
          nor.push(d.n[0], d.n[1], d.n[2]);
          col.push(tmp.r * f, tmp.g * f, tmp.b * f);
        }
        // partir el cuadrado por la diagonal más clara para que la sombra no se estire en diagonal
        if (aoV[0] + aoV[2] < aoV[1] + aoV[3]) idx.push(base + 1, base + 2, base + 3, base + 1, base + 3, base);
        else idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeBoundingSphere(); g.computeBoundingBox();
    return g;
  }
  toMesh(opts = {}) {
    const m = new THREE.Mesh(this.toGeometry(opts), opts.material || voxelMaterial());
    m.castShadow = opts.castShadow ?? true;
    m.receiveShadow = opts.receiveShadow ?? true;
    return m;
  }
}

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
let GFX = { scale: 2, aa: true, shadows: true, outline: true, particles: 1, maxFps: 60, bgFps: 30, autoRes: true, uiZoom: 1 };
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
  const samples = () => (low || !GFX.aa || !renderer.capabilities.isWebGL2) ? 0 : 4;
  const wantOutline = () => (forced ? forced[1] === '1' : !!sceneOutline && GFX.outline);
  let outline = null, outlineKey = '';
  // corrección de color del ambiente (saturación, tono y niebla por profundidad): va en el mismo pase final
  let grade = null;
  function buildOutline() {
    const lines = wantOutline(), n = samples();
    const key = lines || n || grade ? `${lines}|${n}|${JSON.stringify(sceneOutline ?? null)}` : '';
    if (key === outlineKey) return false;
    outline?.dispose(); outline = null; outlineKey = key;
    if (key) outline = createOutlinePass(renderer, typeof sceneOutline === 'object' ? sceneOutline : true, n, lines);
    if (outline && grade) outline.setGrade(grade);
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
    const sh = shadows && GFX.shadows;
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
function createOutlinePass(renderer, o, samples = 0, lines = true) {
  const cfg = typeof o === 'object' ? o : {};
  // RGBA8 en sRGB (no float16): la mitad de memoria y ancho de banda con MSAA, ~25% menos de GPU por
  // cuadro, y la imagen sale igual (la GPU guarda en sRGB y lee de vuelta en lineal, sin bandas).
  const rt = new THREE.WebGLRenderTarget(1, 1, {
    type: THREE.UnsignedByteType, colorSpace: THREE.SRGBColorSpace,
    minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true, samples,
  });
  rt.depthTexture = new THREE.DepthTexture(1, 1);
  rt.depthTexture.type = THREE.UnsignedIntType;
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      tColor: { value: rt.texture }, tDepth: { value: rt.depthTexture }, texel: { value: new THREE.Vector2(1, 1) },
      near: { value: 0.1 }, far: { value: 100 }, ink: { value: new THREE.Color(0x3d2f2a) }, lineW: { value: 2 },
      strength: { value: cfg.strength ?? 0.85 }, lines: { value: lines ? 1 : 0 }, thrAbs: { value: 0.3 }, thrLin: { value: 0 }, thrSq: { value: 0 },
      sat: { value: 1 }, tint: { value: new THREE.Vector3(1, 1, 1) }, fogColor: { value: new THREE.Color(0xc8c2b4) },
      fogAmt: { value: 0 }, fogNear: { value: 50 }, fogFar: { value: 90 },
    },
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: `
      #include <packing>
      uniform sampler2D tColor; uniform sampler2D tDepth; uniform vec2 texel; uniform float lineW;
      uniform float near; uniform float far; uniform vec3 ink; uniform float strength; uniform float lines;
      uniform float thrAbs; uniform float thrLin; uniform float thrSq;
      uniform float sat; uniform vec3 tint; uniform vec3 fogColor; uniform float fogAmt; uniform float fogNear; uniform float fogFar;
      varying vec2 vUv;
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
        float dc = dist(vUv);
        float thr = thrAbs + dc * thrLin + dc * dc * thrSq;
        float k = 0.0;
        if (dc - nearest(vUv, 1.0) > thr) k = 1.0;
        else if (lineW > 1.5 && dc - nearest(vUv, lineW) > thr) k = 1.0;
        else if (dc - nearest(vUv, lineW + 1.0) > thr) k = 0.4;
        k *= (c.a > 0.99 ? strength : 1.0) * lines;
        // c viene premultiplicado (fondo transparente): tinta encima y de vuelta a sRGB sin premultiplicar
        vec4 o = vec4(mix(c.rgb, ink, k), mix(c.a, 1.0, k));
        vec3 rgb = o.a > 0.0 ? o.rgb / o.a : vec3(0.0);
        // ambiente: niebla por profundidad (lo lejano se pierde), saturación y tono (noche, clima, la isla gris)
        float f = fogAmt * smoothstep(fogNear, fogFar, dc) * (1.0 - k);
        rgb = mix(rgb, fogColor, f);
        float lum = dot(rgb, vec3(0.2126, 0.7152, 0.0722));
        rgb = max(mix(vec3(lum), rgb, sat) * tint, 0.0);
        gl_FragColor = vec4(rgb, 1.0);
        #include <colorspace_fragment>
        gl_FragColor = vec4(gl_FragColor.rgb * o.a, o.a);
      }`,
    depthTest: false, depthWrite: false, transparent: true, blending: THREE.NoBlending,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  quad.frustumCulled = false;
  const postScene = new THREE.Scene(); postScene.add(quad);
  const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  let ortho = null;
  return {
    setSize(w, h, scale = 2) {
      rt.setSize(w, h); mat.uniforms.texel.value.set(1 / w, 1 / h);
      mat.uniforms.lineW.value = Math.max(1, Math.round((cfg.width ?? 1.1) * scale));
    },
    render(scene, camera) {
      if (ortho !== !!camera.isOrthographicCamera) {
        ortho = !!camera.isOrthographicCamera;
        mat.defines = ortho ? { ORTHO: '' } : {};
        mat.needsUpdate = true;
        const u = mat.uniforms;
        if (ortho) { u.thrAbs.value = cfg.threshold ?? 0.3; u.thrLin.value = 0; u.thrSq.value = 0; }
        else { u.thrAbs.value = cfg.threshold ?? 0.15; u.thrLin.value = 0.03; u.thrSq.value = 0.0015; }
      }
      mat.uniforms.near.value = camera.near; mat.uniforms.far.value = camera.far;
      const prev = renderer.getRenderTarget();
      renderer.setRenderTarget(rt);
      renderer.render(scene, camera);
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
    },
    dispose() { rt.depthTexture.dispose(); rt.dispose(); quad.geometry.dispose(); mat.dispose(); },
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
