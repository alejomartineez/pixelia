// Modelos vóxel de Pixelia: edificios, obras, naturaleza, nubes y miniaturas.
// API (ver DESIGN.md):
//   buildingModel(id, level, opts) -> THREE.Group   (origen centro del footprint, base y=0, frente +Z)
//   constructionModel(w, d) / natureModel(kind, seed) / cloudModel(seed) / thumbnail(id, level)
// Las geometrías se construyen una sola vez por id+nivel y se reusan en cada Group nuevo.
import * as THREE from 'three';
import { voxelMaterial, glowMaterial, windowMaterial, addLights, setIsoCamera, Voxels, shade, outlineCanvas } from '../core/voxel.js';
import { BUILDING_BY_ID, OUTFIT_COLORS, MONUMENTS, eraOfRank } from '../core/data.js';
import { Model, P, C, rng, pick, bush, cone, flower, FLOWER_COLORS, eraRecolor, clampEra } from './models-kit.js';
import { SPECIAL_BUILDERS } from './models-special.js';
import { HOUSE_BUILDERS } from './models-houses.js';
import { SHOP_BUILDERS } from './models-shops.js';
import { DECO_BUILDERS } from './models-deco.js';
import { MONUMENT_BUILDERS } from './models-monuments.js';
import { TOWN_BUILDERS } from './models-town.js';
import { CYCLE_BUILDERS } from './models-cycle.js';
import { RAIZ_BUILDERS } from './models-raiz.js';
import { DEFENSE_BUILDERS } from './models-defense.js';
import { DEFAULT_THEME, themeOf, mapColor, isGlass } from './themes.js';

export const VOXELS_PER_TILE = 8;
const S = 1 / VOXELS_PER_TILE;
const BUILDERS = { ...SPECIAL_BUILDERS, ...TOWN_BUILDERS, ...HOUSE_BUILDERS, ...SHOP_BUILDERS, ...DECO_BUILDERS, ...MONUMENT_BUILDERS, ...CYCLE_BUILDERS, ...DEFENSE_BUILDERS, ...RAIZ_BUILDERS };

// ---------- Materiales ----------
let _light = null, _ghost = null;
function lightMaterial() { return _light || (_light = new THREE.MeshBasicMaterial({ vertexColors: true })); }
function ghostMaterial() {
  return _ghost || (_ghost = new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.55, depthWrite: false }));
}
function matFor(kind, opts) {
  if (opts.ghost) return ghostMaterial();
  if (kind === 'light') return lightMaterial();
  if (kind === 'glow') return glowMaterial();
  if (kind === 'win') return windowMaterial();
  return voxelMaterial();
}

// ---------- Tema (re-mapeo de colores al compilar) ----------
/** Ruido fijo por vóxel (0..1) para la nieve a manchones. */
const snowAt = (x, y, z) => (((x * 73856093) ^ (y * 19349663) ^ (z * 83492791)) >>> 0) % 997 / 997;
/**
 * Pasa los colores de un modelo al tema. En la grilla principal además:
 * nieve sobre las caras de arriba expuestas (temas con `snow`) y vidrios a la capa sin luz (`litWindows`).
 */
function applyTheme(model, themeId) {
  const t = themeOf(themeId);
  // los vidrios van a su capa: de noche se prenden (ambience-fx.js, setNightGlow). El tema de noche ya los prende siempre.
  if (!t.litWindows) {
    const win = model.win || (model.win = new Voxels());
    for (const [k, c] of [...model.v.map]) if (isGlass(t.id, c)) { model.v.map.delete(k); win.map.set(k, c); }
  }
  if (t.identity) return;
  const recolor = (v) => { for (const [k, c] of v.map) v.map.set(k, mapColor(t.id, c)); };
  const v = model.v;
  if (t.snow || t.litWindows) {
    const snow = [], lit = [];
    for (const [k, c] of v.map) {
      const [x, y, z] = k.split(',').map(Number);
      if (t.litWindows && isGlass(t.id, c)) { lit.push([k, x, y, z, c]); continue; }
      if (t.snow && y >= 2 && !v.map.has(x + ',' + (y + 1) + ',' + z) && snowAt(x, y, z) < (t.snowAmount ?? 1)) snow.push(k);
    }
    recolor(v);
    for (const k of snow) { const [x, , z] = k.split(','); v.map.set(k, parseInt(t.snow[(+x * 3 + +z * 5) % 7 === 0 ? 1 : 0].slice(1), 16)); }
    for (const [k, x, y, z, c] of lit) { v.map.delete(k); model.light.set(x, y, z, mapColor(t.id, c)); }
  } else recolor(v);
  recolor(model.glow);
  if (model.win) recolor(model.win);
  if (!t.litWindows) recolor(model.light);
  for (const p of model.parts) recolor(p.v);
}

// ---------- Limpieza de "ruido" ----------
// Con pixeles de render chicos cada vóxel ocupa 1-2 pixeles: los dameros de tonos casi iguales
// (ladrillos, rayas de techo, manchitas) se ven como estática. Se unifican los tonos muy parecidos
// al más usado del modelo; los detalles con contraste real (ventanas, flores, bordes) quedan.
const CALM = 26;
function calmColors(v) {
  if (!v.size) return;
  const freq = new Map();
  for (const c of v.map.values()) freq.set(c, (freq.get(c) || 0) + 1);
  if (freq.size < 2) return;
  const reps = [], to = new Map();
  const near = (a, b) => Math.abs((a >> 16) - (b >> 16)) <= CALM && Math.abs(((a >> 8) & 255) - ((b >> 8) & 255)) <= CALM && Math.abs((a & 255) - (b & 255)) <= CALM;
  for (const [c] of [...freq].sort((p, q) => q[1] - p[1])) {
    const r = reps.find(x => near(x, c));
    if (r === undefined) reps.push(c); else to.set(c, r);
  }
  if (to.size) for (const [k, c] of v.map) { const r = to.get(c); if (r !== undefined) v.map.set(k, r); }
}

// ---------- Mallado con oclusión en los rincones ----------
// Voxels.toGeometry con una oclusión un poco más suave y menos jitter: las formas se leen sin agregar ruido.
const AO = [0.6, 0.74, 0.88, 1];
const JITTER = 0.01;
const meshAO = (v, scale) => v.toGeometry({ scale, jitter: JITTER, aoLevels: AO });

// ---------- Compilación y caché ----------
function compile(model, themeId = DEFAULT_THEME, o = {}) {
  // el arte por época dibuja sus juntas y hiladas a propósito: no se "calma"
  if (o.calm !== false) {
    calmColors(model.v); calmColors(model.glow);
    for (const p of model.parts) calmColors(p.v);
  }
  applyTheme(model, themeId);
  const ox = model.W / 2, oz = model.D / 2;
  const parts = [];
  let maxY = 0;
  const add = (v, name, pivot, mat, cast) => {
    if (!v.size) return;
    const b = v.bounds();
    maxY = Math.max(maxY, b.max[1]);
    const g = mat === 'light' ? v.toGeometry({ scale: S, jitter: 0 }) : meshAO(v, S);
    const px = pivot ? pivot[0] : ox, py = pivot ? pivot[1] : 0, pz = pivot ? pivot[2] : oz;
    g.translate(-px * S, -py * S, -pz * S);
    g.computeBoundingSphere(); g.computeBoundingBox();
    parts.push({ geo: g, name, mat, cast, pos: new THREE.Vector3((px - ox) * S, py * S, (pz - oz) * S) });
  };
  add(model.v, null, null, 'std', true);
  add(model.glow, null, null, 'glow', true);
  add(model.light, null, null, 'light', false);
  if (model.win) add(model.win, null, null, 'win', true);
  for (const p of model.parts) add(p.v, p.name, p.pivot, p.mat, p.cast);
  return { parts, anims: model.anims, height: (model.height ?? maxY) * S, size: [model.W * S, model.D * S] };
}

function instantiate(tpl, opts = {}, extra = {}) {
  const g = new THREE.Group();
  const named = {};
  for (const p of tpl.parts) {
    const m = new THREE.Mesh(p.geo, matFor(p.mat, opts));
    m.position.copy(p.pos);
    m.castShadow = opts.ghost ? false : p.cast;
    m.receiveShadow = !opts.ghost;
    // las partes sin nombre no se animan: la ciudad puede dibujarlas instanciadas (pocas llamadas de dibujo)
    m.userData.static = !p.name;
    if (p.name) (named[p.name] || (named[p.name] = [])).push(m);
    g.add(m);
  }
  g.userData.height = tpl.height;
  Object.assign(g.userData, extra);
  if (tpl.anims.length) {
    const phase = (instanceCounter++ * 2.399) % 12;
    const fns = tpl.anims.map(fn => fn(named, phase)).filter(Boolean);
    g.userData.update = fns.length === 1 ? fns[0] : (dt, t) => { for (const f of fns) f(dt, t); };
  }
  return g;
}
let instanceCounter = 0;

const tplCache = new Map();
function flagHex(c) {
  if (!c) return P.clay;
  if (typeof c === 'number') return c;
  if (c[0] === '#') return c;
  return OUTFIT_COLORS.find(o => o.id === c)?.hex || P.clay;
}

/** Plantas y adornos que se ven igual en cualquier época (comparten la caché). */
const ERA_FREE = new Set(['arbol', 'arbusto', 'cerezo', 'unicornio']);
/**
 * Época con la que se dibuja un edificio. La Municipalidad sigue al rango (su nivel). Deco, caminos y
 * monumentos no se renuevan: la escena les pasa la época de la ciudad (city.js drawEra).
 */
export function modelEra(id, level, era) {
  if (id === 'castillo') return eraOfRank(level);
  if (!BUILDING_BY_ID[id] || ERA_FREE.has(id)) return 1;
  return clampEra(era);
}

function buildTemplate(id, level, opts, themeId) {
  const def = BUILDING_BY_ID[id];
  const W = (def ? def.size[0] : 1) * VOXELS_PER_TILE, D = (def ? def.size[1] : 1) * VOXELS_PER_TILE;
  const m = new Model(W, D);
  const fn = BUILDERS[id];
  const era = opts.era || 1;
  const eraArt = !!(fn && def?.eraArt);
  if (eraArt) fn(m, level, { era, flag: opts.flag });
  else if (fn) {
    fn(m, level, opts);
    // respaldo para un builder sin arte por época: recoloreo hacia la paleta de la época
    if (era > 1) eraRecolor(m, era);
  } else { // id desconocido: cajita neutra (no debería pasar)
    m.v.box(1, 0, 1, W - 2, 6, D - 2, P.clayL);
    m.v.box(1, 6, 1, W - 2, 1, D - 2, P.clay);
  }
  const tpl = compile(m, themeId, { calm: !eraArt });
  // caminos: baldosa de 1 vóxel, su sombra no se ve y cuesta una pasada extra por baldosa
  if (def?.cat === 'camino') for (const p of tpl.parts) p.cast = false;
  return tpl;
}

/** Nivel máximo con modelo propio: la Municipalidad tiene uno por rango (8), los monumentos uno por etapa; el resto, 5. */
const modelMaxLevel = (id) => (id === 'castillo' ? 8 : MONUMENTS[id] ? MONUMENTS[id].stages.length : 5);

/**
 * Modelo de un edificio del catálogo. opts: { era (1..5, la de b.era; default 1), flagColor (id de OUTFIT_COLORS o hex),
 * ghost, theme }. Caché por id|nivel|época|bandera|tema.
 */
export function buildingModel(id, level = 1, opts = {}) {
  const lv = Math.max(1, Math.min(modelMaxLevel(id), Math.round(level) || 1));
  const def = BUILDING_BY_ID[id];
  const flag = id === 'castillo' ? flagHex(opts.flagColor) : null;
  const th = themeOf(opts.theme).id;
  const era = modelEra(id, lv, opts.era);
  const key = id + '|' + lv + '|' + era + (flag ? '|' + flag : '') + '|' + th;
  let tpl = tplCache.get(key);
  if (!tpl) { tpl = buildTemplate(id, lv, { flag, era }, th); tplCache.set(key, tpl); }
  const g = instantiate(tpl, opts, { id, level: lv, era, size: def ? def.size.slice() : [1, 1] });
  g.name = 'building:' + id;
  return g;
}

// ---------- Modelos propios (armados por otros módulos) ----------
const customCache = new Map();
/**
 * Modelo vóxel armado por otro módulo con el mismo kit y el mismo mallado (oclusión, partes animadas, luces).
 * build(m) dibuja sobre un Model(W, D) de models-kit.js. Se cachea por `key`. Origen: centro del footprint, base y=0.
 */
export function voxelModel(key, W, D, build, opts = {}) {
  let tpl = customCache.get(key);
  if (!tpl) {
    const m = new Model(W, D);
    build(m);
    tpl = compile(m, DEFAULT_THEME);
    customCache.set(key, tpl);
  }
  const g = instantiate(tpl, opts, { key });
  g.name = 'voxel:' + key;
  return g;
}

// ---------- Obra en construcción ----------
const consCache = new Map();
export function constructionModel(w = 2, d = 2, theme = DEFAULT_THEME) {
  w = Math.max(1, w | 0); d = Math.max(1, d | 0);
  const th = themeOf(theme).id;
  const key = w + 'x' + d + '|' + th;
  let tpl = consCache.get(key);
  if (!tpl) {
    const W = w * 8, D = d * 8;
    const m = new Model(W, D);
    const v = m.v;
    // terreno de obra
    for (let x = 0; x < W; x++) for (let z = 0; z < D; z++) v.set(x, 0, z, (x * 7 + z * 3) % 5 === 0 ? shade(P.dirt, -0.1) : (x + z) % 2 ? P.dirt : shade(P.dirt, 0.05));
    const H = Math.min(16, 6 + Math.max(w, d) * 3);
    const x0 = 1, x1 = W - 2, z0 = 1, z1 = D - 2;
    // paredes a medio construir (altura irregular, ladrillo rosado)
    const bw = (x, y, z) => ((y + Math.floor((x + z) / 2)) % 2 ? P.clayL : '#f2aa8d');
    for (let x = x0 + 2; x <= x1 - 2; x++) for (let z = z0 + 2; z <= z1 - 2; z++) {
      const edge = x === x0 + 2 || x === x1 - 2 || z === z0 + 2 || z === z1 - 2;
      if (!edge) continue;
      const h = 1 + Math.max(1, Math.floor(H / 2.4 - ((x * 3 + z * 5) % 4)));
      for (let y = 1; y <= h; y++) v.set(x, y, z, bw(x, y, z));
    }
    // andamio sólo al frente y a la derecha (se ve la obra adentro)
    const step = Math.max(3, Math.min(5, Math.floor((x1 - x0) / 2)));
    const polesF = [], polesR = [];
    for (let x = x0; x <= x1; x += step) polesF.push(x);
    if (polesF[polesF.length - 1] !== x1) polesF.push(x1);
    for (let z = z0; z <= z1; z += step) polesR.push(z);
    if (polesR[polesR.length - 1] !== z1) polesR.push(z1);
    for (const x of polesF) v.box(x, 1, z1, 1, H, 1, P.wood);
    for (const z of polesR) v.box(x1, 1, z, 1, H, 1, P.wood);
    for (let y = 5; y < H; y += 5) {
      for (let x = x0; x <= x1; x++) { v.set(x, y, z1, P.gold); v.set(x, y, z1 - 1, P.goldD); }
      for (let z = z0; z <= z1; z++) { v.set(x1, y, z, P.gold); v.set(x1 - 1, y, z, P.goldD); }
    }
    // escalerita
    for (let y = 1; y < Math.min(H, 10); y++) if (y % 2) v.set(x0 + 1, y, z1 + 1 > D - 1 ? z1 : z1, P.woodD);
    // cinta rayada rosa/blanca alrededor, con postes dorados
    for (let x = 0; x < W; x++) { v.set(x, 2, D - 1, Math.floor(x / 2) % 2 ? '#ffffff' : P.clay); v.set(x, 2, 0, Math.floor(x / 2) % 2 ? '#ffffff' : P.clay); }
    for (let z = 0; z < D; z++) { v.set(0, 2, z, Math.floor(z / 2) % 2 ? '#ffffff' : P.clay); v.set(W - 1, 2, z, Math.floor(z / 2) % 2 ? '#ffffff' : P.clay); }
    for (const [x, z] of [[0, D - 1], [W - 1, D - 1], [0, 0], [W - 1, 0]]) { v.box(x, 1, z, 1, 2, 1, P.gold); v.set(x, 3, z, P.goldL); }
    // pila de ladrillos, caja de herramientas y conito
    if (W >= 16) { v.box(W - 6, 1, D - 5, 3, 2, 2, P.wood); v.box(W - 6, 3, D - 5, 3, 1, 2, P.woodD); v.set(W - 5, 3, D - 4, P.gold); }
    v.box(3, 1, D - 4, 2, 1, 2, P.coral); v.set(3, 2, D - 4, P.coral); v.set(4, 2, D - 3, shade(P.coral, -0.1));
    v.set(W - 2, 1, D - 3, C.orange); v.set(W - 2, 2, D - 3, '#ffffff'); v.set(W - 2, 3, D - 3, C.orange);
    // grúa amarilla con brazo que gira
    const cx = x0 + 1, cz = z0 + 1;
    const CH = H + 3;
    v.box(cx, 1, cz, 1, CH, 1, (x, y) => (y % 2 ? C.yellow : P.goldD));
    v.box(cx - 1, 1, cz - 1, 3, 1, 3, P.stoneD);
    const arm = m.part('crane', [cx + 0.5, CH, cz + 0.5]);
    const L = Math.max(4, Math.min(W - 4, 11));
    for (let i = -2; i <= L; i++) arm.set(cx + i, CH, cz, i % 2 ? C.yellow : P.goldD);
    arm.set(cx, CH + 1, cz, C.yellow); arm.set(cx, CH + 2, cz, P.clay);
    arm.box(cx - 3, CH - 1, cz, 2, 2, 1, P.stoneD); // contrapeso
    arm.box(cx + L - 1, CH - 4, cz, 1, 4, 1, P.inkL); // cable
    arm.set(cx + L - 1, CH - 5, cz, P.gold); // gancho
    arm.box(cx + L - 2, CH - 7, cz - 1, 3, 2, 3, (x, y, z) => ((x + y + z) % 2 ? P.clay : P.clayL)); // ladrillos colgando
    m.animate((parts, ph) => {
      const a = parts.crane[0];
      return (dt, t) => { a.rotation.y = Math.sin((t + ph) * 0.6) * 0.9 - 0.6; };
    });
    tpl = compile(m, th);
    consCache.set(key, tpl);
  }
  const g = instantiate(tpl, {});
  g.name = 'construction';
  return g;
}

// ---------- Naturaleza fuera del terreno ----------
const natCache = new Map();
const NAT_VARIANTS = 6;
export function natureModel(kind = 'tree', seed = 0, theme = DEFAULT_THEME) {
  const s = Math.abs(Math.floor(seed)) % NAT_VARIANTS;
  const th = themeOf(theme).id;
  const key = kind + '|' + s + '|' + th;
  let tpl = natCache.get(key);
  if (!tpl) {
    const m = new Model(8, 8);
    const v = m.v, r = rng(s * 31 + kind.length * 7 + 1);
    switch (kind) {
      case 'pine': {
        const h = 2 + Math.floor(r() * 2);
        v.box(3, 0, 3, 2, h, 2, C.trunkD);
        const layers = 4 + Math.floor(r() * 2);
        let y = h;
        for (let i = 0; i < layers; i++) {
          const rad = 3.6 - i * 0.7;
          const col = i % 2 ? '#3a9a62' : '#5ccb80'; // capas bien distintas: se leen como escalones
          v.cylinder(3.5, y, 3.5, rad, 2, (x, yy, z) => (yy === y + 1 && (x + z) % 3 === 0 ? shade(col, 0.15) : col));
          y += 2;
        }
        v.set(3, y, 3, '#5ccb80'); v.set(4, y, 4, '#5ccb80');
        if (r() < 0.5) { v.set(3, y + 1, 3, '#ffffff'); }
        break;
      }
      case 'bush': {
        bush(v, 3.5, 0, 3.5, 2.6 + r() * 0.6, pick(r, [C.leaf, '#6dcf74', C.leafD]), r() < 0.6 ? pick(r, [[P.clay, '#ffffff'], [C.yellow], [P.slate, P.clayL]]) : null, s + 11);
        break;
      }
      case 'rock': {
        const col = pick(r, [P.stone, '#ded5c8', '#efe7dc']);
        v.sphere(3.5, 1, 3.5, 2.6 + r(), 1.8 + r() * 0.6, 2.2 + r() * 0.5, (x, y, z) => (y >= 2 ? shade(col, 0.1) : (x + z + y) % 4 === 0 ? shade(col, -0.12) : col));
        v.clear(0, -3, 0, 8, 3, 8);
        if (r() < 0.6) { v.set(1, 0, 6, C.leaf); v.set(6, 0, 1, C.leaf); v.set(6, 1, 1, P.clay); }
        break;
      }
      case 'flowers': { // matita de hojas con flores de dos colores (no confeti de siete)
        const a = pick(r, FLOWER_COLORS), b = r() < 0.5 ? '#ffffff' : pick(r, FLOWER_COLORS);
        const cx = 2 + Math.floor(r() * 3), cz = 2 + Math.floor(r() * 3);
        v.box(cx - 1, 0, cz - 1, 4, 1, 3, C.leaf); v.box(cx, 0, cz + 2, 2, 1, 1, C.leaf);
        for (let i = 0; i < 7; i++) {
          const x = cx - 1 + Math.floor(r() * 4), z = cz - 1 + Math.floor(r() * 4);
          if (!v.has(x, 0, z)) continue;
          flower(v, x, 1, z, i % 3 ? a : b, 0);
        }
        break;
      }
      case 'mushroom': {
        const cap = pick(r, [P.coral, P.clay, P.slate]);
        const mk = (x, z, h, rad) => {
          v.box(x, 0, z, 1, h, 1, P.cream);
          v.sphere(x, h + 0.2, z, rad, 1.2, rad, (xx, y, zz) => (y >= h + 1 && (xx + zz) % 2 === 0 ? '#ffffff' : cap));
          v.clear(x - 3, h - 2, z - 3, 7, 2, 7); v.box(x, 0, z, 1, h, 1, P.cream);
        };
        mk(3, 3, 3, 2.2); mk(6, 5, 2, 1.4);
        v.set(1, 0, 6, C.leaf); v.set(2, 0, 6, C.leaf);
        break;
      }
      case 'palm': { // tronco anillado que se curva + hojas que caen + cocos
        const h = 8 + Math.floor(r() * 3), lean = r() < 0.5 ? 1 : -1;
        let x = 3, z = 3;
        for (let y = 0; y < h; y++) {
          if (y === Math.floor(h * 0.45) || y === Math.floor(h * 0.8)) x += lean;
          v.set(x, y, z, y % 2 ? '#a87c46' : '#c79a5e');
        }
        const ty = h;
        v.set(x, ty, z, '#3fae5a');
        const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]];
        const n = 6 + Math.floor(r() * 2);
        for (let i = 0; i < n; i++) {
          const [dx, dz] = dirs[i];
          const len = (dx && dz) ? 3 : 4;
          for (let k = 1; k <= len; k++) {
            const yy = ty - (k >= 3 ? k - 2 : 0);
            v.set(x + dx * k, yy, z + dz * k, k === len ? '#2f9a4c' : (k + i) % 2 ? '#4cbd60' : '#3fae5a');
            if (k === 2) v.set(x + dx * k, yy + 1, z + dz * k, '#6fd27a');
          }
        }
        v.set(x + 1, ty - 1, z, '#7a5230'); v.set(x, ty - 1, z + 1, '#8a5f38');
        if (r() < 0.6) v.set(x - 1, ty - 1, z, '#7a5230');
        break;
      }
      case 'hedge': { // seto recortado (ciudad moderna)
        const w = 4 + Math.floor(r() * 3), hh = 3 + Math.floor(r() * 2);
        const x0 = 4 - Math.floor(w / 2);
        v.box(x0, 0, x0, w, hh, w, (xx, yy, zz) => (yy === hh - 1 ? ((xx + zz) % 3 === 0 ? '#7cc576' : '#6ab865') : (xx + yy + zz) % 4 === 0 ? '#4a9a52' : '#57a95c'));
        v.box(x0 - 1, 0, x0 - 1, w + 2, 1, w + 2, (xx, yy, zz) => (v.has(xx, 0, zz) ? v.get(xx, 0, zz) : '#cfc8bd'));
        break;
      }
      case 'roundtree': { // arbolito "chupetín" con cantero (ciudad moderna)
        const h = 3 + Math.floor(r() * 2);
        v.box(2, 0, 2, 4, 1, 4, '#bdb6aa'); v.box(3, 1, 3, 2, 1, 2, '#6a5040');
        v.box(3, 1, 3, 1, h + 1, 1, '#7a6a5c');
        const leaf = pick(r, ['#58a86a', '#4f9e62', '#62b072']);
        v.sphere(3.5, h + 2.6, 3.5, 2.5, 2.6, 2.5, (x, y, z) => (y >= h + 4 && (x + z) % 2 === 0 ? shade(leaf, 0.14) : (x * 3 + y + z * 5) % 7 === 0 ? shade(leaf, -0.12) : leaf));
        break;
      }
      case 'glowshroom': { // hongos con pintitas que brillan + luciérnagas (bosque mágico)
        const L = m.light;
        const cap = pick(r, ['#5a78c4', '#3cbf9a', '#c8673d']);
        const mk = (x, z, hh, rad) => {
          v.box(x, 0, z, 1, hh, 1, '#fdf6e3');
          v.sphere(x, hh + 0.2, z, rad, 1.3, rad, cap);
          v.clear(x - 3, hh - 2, z - 3, 7, 2, 7); v.box(x, 0, z, 1, hh, 1, '#fdf6e3');
          for (let i = Math.floor(x - rad); i <= Math.ceil(x + rad); i++) for (let k = Math.floor(z - rad); k <= Math.ceil(z + rad); k++) {
            for (let y = hh + 2; y >= hh - 1; y--) if (v.has(i, y, k)) { if ((i * 7 + k * 3) % 4 === 0) { v.remove(i, y, k); L.set(i, y, k, '#c8fff4'); } break; }
          }
        };
        mk(3, 3, 4, 2.4); mk(6, 6, 2, 1.4); mk(1, 6, 1, 1);
        L.set(6, 6, 2, '#fff3a0'); L.set(1, 8, 1, '#fff3a0'); L.set(5, 9, 5, '#fff3a0');
        v.set(2, 0, 1, C.leaf); v.set(5, 0, 2, C.leaf);
        break;
      }
      case 'snowman': {
        v.sphere(3.5, 1.6, 3.5, 2.2, 1.8, 2.2, '#ffffff');
        v.sphere(3.5, 4.4, 3.5, 1.6, 1.4, 1.6, '#f4f8ff');
        v.sphere(3.5, 6.6, 3.5, 1.2, 1.2, 1.2, '#ffffff');
        v.clear(0, -3, 0, 8, 3, 8);
        v.box(2, 5, 2, 4, 1, 4, (x, y, z) => (v.has(x, y, z) ? '#d8433f' : null)); // bufanda
        v.set(4, 5, 6, '#d8433f'); v.set(4, 4, 6, '#d8433f');
        v.set(3, 7, 5, P.ink); v.set(4, 7, 5, P.ink); v.set(3, 6, 6, '#ffa64d'); v.set(3, 6, 5, '#ffa64d');
        v.set(3, 4, 6, P.ink); v.set(3, 3, 6, P.ink);
        v.box(2, 8, 2, 4, 1, 4, P.ink); v.box(3, 9, 3, 2, 2, 2, P.ink); v.box(3, 9, 4, 2, 1, 1, '#d8433f');
        v.set(0, 4, 3, C.trunkD); v.set(1, 4, 3, C.trunkD); v.set(6, 4, 4, C.trunkD); v.set(7, 5, 4, C.trunkD);
        break;
      }
      case 'lamp': { // farolito de plaza con luz cálida
        v.box(3, 0, 3, 2, 1, 2, P.inkL);
        v.box(3, 1, 3, 1, 7, 1, P.ink);
        v.box(2, 8, 2, 3, 1, 3, P.ink);
        m.light.box(2, 9, 2, 3, 2, 3, '#ffd77a');
        v.box(2, 11, 2, 3, 1, 3, P.ink); v.set(3, 12, 3, P.ink);
        v.set(5, 0, 5, C.leaf); v.set(1, 0, 4, C.leaf);
        break;
      }
      default: { // tree
        const h = 2 + Math.floor(r() * 2);
        v.box(3, 0, 3, 2, h + 1, 2, C.trunk);
        v.set(5, 1, 3, C.trunk);
        const leaf = pick(r, [C.leaf, '#6dcf74', '#58bf73']);
        const fruit = r() < 0.4 ? [P.clay, C.red] : r() < 0.5 ? ['#ffffff', P.clayL] : null;
        bush(v, 3.5, h, 3.5, 3.1 + r() * 0.5, leaf, fruit, s + 3);
        if (r() < 0.5) bush(v, 2, h + 3, 4.5, 1.8, shade(leaf, 0.08), null, s + 9);
      }
    }
    tpl = compile(m, th);
    natCache.set(key, tpl);
  }
  const g = instantiate(tpl, {});
  g.name = 'nature:' + kind;
  return g;
}

// ---------- Nubes ----------
const cloudCache = new Map();
export function cloudModel(seed = 0, theme = DEFAULT_THEME) {
  const s = Math.abs(Math.floor(seed)) % 5;
  const [cTop, cMid, cBot] = themeOf(theme).cloud;
  const ck = s + '|' + themeOf(theme).id;
  let geo = cloudCache.get(ck);
  if (!geo) {
    const r = rng(s * 13 + 5);
    const v = new Voxels();
    const n = 3 + Math.floor(r() * 3);
    let x = 0;
    for (let i = 0; i < n; i++) {
      const rad = 1.8 + r() * 1.8;
      v.sphere(x, rad * 0.6, (r() - 0.5) * 2, rad, rad * 0.75, rad * 0.9, (xx, y) => (y <= 0 ? cBot : y >= rad ? cTop : cMid));
      x += rad * 1.1 + r();
    }
    v.clear(-10, -10, -10, 40, 10, 30);
    geo = v.toGeometry({ scale: 1 / 4, center: 'xyz', jitter: 0.015 });
    cloudCache.set(ck, geo);
  }
  const m = new THREE.Mesh(geo, voxelMaterial());
  m.castShadow = false; m.receiveShadow = false;
  const g = new THREE.Group();
  g.add(m);
  g.name = 'cloud';
  return g;
}

// ---------- Miniaturas (un solo renderer WebGL para todas) ----------
const THUMB = 288; // se muestra a ~90 px CSS: 3× para que se vea nítido en pantallas retina
const thumbCache = new Map();
let thumbQueue = Promise.resolve();
let T = null;
function thumbRig() {
  if (T) return T;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = THUMB;
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(1);
  renderer.setSize(THUMB, THUMB, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const scene = new THREE.Scene();
  const { sun } = addLights(scene, { shadowSize: 8, shadowRes: 1024 });
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
  const out = document.createElement('canvas');
  out.width = out.height = THUMB;
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); }, false);
  T = { renderer, scene, camera, sun, canvas, out, ctx: out.getContext('2d', { willReadFrequently: true }) };
  return T;
}
const _box = new THREE.Box3(), _v = new THREE.Vector3();
function renderThumb(id, level, theme, era = 1) {
  return renderObjectThumb(buildingModel(id, level, { theme, era }));
}
/** Miniatura de cualquier objeto armado con voxelModel. Promise<dataURL>, cacheada por key. */
export function objectThumbnail(key, make) {
  const k = 'obj|' + key;
  let p = thumbCache.get(k);
  if (p) return p;
  p = thumbQueue = thumbQueue.then(() => new Promise(res => {
    const run = () => { try { res(renderObjectThumb(make())); } catch (e) { console.warn('miniatura', key, e); res(null); } };
    if (typeof requestIdleCallback === 'function') requestIdleCallback(run, { timeout: 120 }); else setTimeout(run, 0);
  }));
  thumbCache.set(k, p);
  return p;
}
function renderObjectThumb(g) {
  const t = thumbRig();
  g.userData.update?.(0, 0.8);
  t.scene.add(g);
  g.updateMatrixWorld(true);
  _box.setFromObject(g);
  const center = _box.getCenter(new THREE.Vector3());
  setIsoCamera(t.camera, center, Math.PI / 4, 40, 0.62);
  t.camera.updateMatrixWorld(true);
  const inv = t.camera.matrixWorldInverse;
  let mnx = Infinity, mxx = -Infinity, mny = Infinity, mxy = -Infinity;
  for (let i = 0; i < 8; i++) {
    _v.set(i & 1 ? _box.max.x : _box.min.x, i & 2 ? _box.max.y : _box.min.y, i & 4 ? _box.max.z : _box.min.z).applyMatrix4(inv);
    mnx = Math.min(mnx, _v.x); mxx = Math.max(mxx, _v.x); mny = Math.min(mny, _v.y); mxy = Math.max(mxy, _v.y);
  }
  const half = Math.max(mxx - mnx, mxy - mny) / 2 * 1.06 + 0.02;
  const cx = (mnx + mxx) / 2, cy = (mny + mxy) / 2;
  Object.assign(t.camera, { left: cx - half, right: cx + half, top: cy + half, bottom: cy - half });
  t.camera.updateProjectionMatrix();
  const span = Math.max(_box.max.x - _box.min.x, _box.max.z - _box.min.z, _box.max.y - _box.min.y) + 2;
  t.sun.position.set(center.x + 12, center.y + 22, center.z + 8);
  t.sun.target.position.copy(center);
  t.sun.target.updateMatrixWorld();
  const sc = t.sun.shadow.camera;
  Object.assign(sc, { left: -span, right: span, top: span, bottom: -span });
  sc.updateProjectionMatrix();
  t.renderer.render(t.scene, t.camera);
  // contorno tinta suave alrededor de la silueta (combina con la UI y con el 3D en vivo)
  const ctx = t.ctx;
  ctx.clearRect(0, 0, THUMB, THUMB);
  ctx.drawImage(outlineCanvas(t.canvas, 4), 0, 0);
  t.scene.remove(g);
  return t.out.toDataURL('image/png');
}
function fallbackThumb(id) {
  const cv = document.createElement('canvas'); cv.width = cv.height = THUMB;
  const g = cv.getContext('2d');
  g.scale(THUMB / 96, THUMB / 96);
  g.fillStyle = BUILDING_BY_ID[id]?.cat === 'camino' ? '#ddd5c8' : '#ee8a5c';
  g.fillRect(20, 30, 56, 46); g.fillStyle = '#3d2f2a'; g.fillRect(20, 26, 56, 4);
  return cv.toDataURL();
}
/**
 * Ícono 288x288 del edificio (dataURL), cacheado. thumbnail(id, level, era = 1, theme) — por compatibilidad también
 * thumbnail(id, level, theme, era) (si el tercero es texto es el tema).
 */
export function thumbnail(id, level = 1, a = 1, b) {
  const [eraIn, theme] = typeof a === 'string' ? [b ?? 1, a] : [a ?? 1, b ?? DEFAULT_THEME];
  const lv = Math.max(1, Math.min(modelMaxLevel(id), Math.round(level) || 1));
  const th = themeOf(theme).id;
  const era = modelEra(id, lv, eraIn);
  const k = id + '|' + lv + '|' + era + '|' + th;
  let p = thumbCache.get(k);
  if (p) return p;
  p = thumbQueue = thumbQueue.then(() => new Promise(res => {
    // cederle el hilo al juego entre miniaturas
    const run = () => { try { res(renderThumb(id, lv, th, era)); } catch (e) { console.warn('miniatura', id, e); res(fallbackThumb(id)); } };
    if (typeof requestIdleCallback === 'function') requestIdleCallback(run, { timeout: 120 }); else setTimeout(run, 0);
  }));
  thumbCache.set(k, p);
  return p;
}
