// Escritor mínimo de MagicaVoxel `.vox` y herramientas de autor de los kits (PLAN-FOTO, paso M2).
//   node tools/make-vox.mjs                 → escribe assets/models/farol.vox y los kits de tools/kits/ (madera/…)
//   node tools/make-vox.mjs --check [rutas] → revisa los .vox de assets/models/ (o las rutas dadas) contra la Regla de
//                                             modelos de DESIGN.md: piezas sueltas, tamaño, tonos por material, negro
//                                             y blanco puros. Sale con 1 si hay errores. (`npm run check:vox`)
//       --protagonista=a,b                    nombres de archivo que son piezas protagonistas (4 tonos, hasta 126)
// Coordenadas de MagicaVoxel: z arriba, el frente mira a -y. writeVox({ models, palette, materials, scene }):
//   models: [{ size: [x, y, z], voxels: [[x, y, z, índice], ...] }] · palette: { índice: 0xRRGGBB }
//   materials: { índice: { _type, _emit, _metal, _rough, _ior, ... } } · scene: [{ model, t: [x, y, z], r }] (opcional)
// Herramientas (todas sobre listas [[x, y, z, índice], ...]):
//   Lienzo                        grilla de autor: set, box, del, add(lista), model() → { size, voxels } con el mínimo en 0
//   mirrorVoxels(v, eje, o)       espeja una región ('x' | 'y' | 'z'); o.keep = deja también el original (simetría)
//   rotateVoxels(v, giros, o)     gira una región 90° × giros alrededor de z (1 = 90°, 2 = 180°, 3 = 270°)
//   looseParts(v, { up })         componentes conectados por caras; `floating` = los que no tocan el piso
//   checkVox(parsed, o)           chequeos de la regla sobre lo que devuelve parseVox
import { writeFileSync, mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, resolve, relative, basename, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseVox } from '../src/core/vox-loader.js';

const enc = new TextEncoder();
const i32 = (v) => { const b = Buffer.alloc(4); b.writeInt32LE(v); return b; };
const str = (s) => { const b = Buffer.from(enc.encode(String(s))); return Buffer.concat([i32(b.length), b]); };
const dict = (o) => Buffer.concat([i32(Object.keys(o).length), ...Object.entries(o).flatMap(([k, v]) => [str(k), str(v)])]);
const chunk = (id, content, children = Buffer.alloc(0)) => Buffer.concat([Buffer.from(id, 'ascii'), i32(content.length), i32(children.length), content, children]);

export function writeVox({ models, palette = {}, materials = {}, scene = null }) {
  const parts = [];
  for (const m of models) {
    parts.push(chunk('SIZE', Buffer.concat(m.size.map(i32))));
    const xyzi = Buffer.alloc(4 + m.voxels.length * 4);
    xyzi.writeInt32LE(m.voxels.length);
    m.voxels.forEach(([x, y, z, c], i) => { xyzi[4 + i * 4] = x; xyzi[5 + i * 4] = y; xyzi[6 + i * 4] = z; xyzi[7 + i * 4] = c; });
    parts.push(chunk('XYZI', xyzi));
  }
  if (scene) {
    // nTRN 0 → nGRP 1 → (nTRN → nSHP) por modelo
    parts.push(chunk('nTRN', Buffer.concat([i32(0), dict({}), i32(1), i32(-1), i32(-1), i32(1), dict({})])));
    const kids = scene.map((_, k) => 2 + k * 2);
    parts.push(chunk('nGRP', Buffer.concat([i32(1), dict({}), i32(kids.length), ...kids.map(i32)])));
    scene.forEach((s, k) => {
      const f = { _t: s.t.join(' ') };
      if (s.r != null) f._r = String(s.r);
      parts.push(chunk('nTRN', Buffer.concat([i32(2 + k * 2), dict({}), i32(3 + k * 2), i32(-1), i32(0), i32(1), dict(f)])));
      parts.push(chunk('nSHP', Buffer.concat([i32(3 + k * 2), dict({}), i32(1), i32(s.model), dict({})])));
    });
  }
  const rgba = Buffer.alloc(1024);
  for (let i = 1; i < 256; i++) {
    const c = palette[i] ?? 0x808080;
    rgba[(i - 1) * 4] = (c >> 16) & 255; rgba[(i - 1) * 4 + 1] = (c >> 8) & 255; rgba[(i - 1) * 4 + 2] = c & 255; rgba[(i - 1) * 4 + 3] = 255;
  }
  parts.push(chunk('RGBA', rgba));
  for (const [id, d] of Object.entries(materials)) parts.push(chunk('MATL', Buffer.concat([i32(+id), dict(d)])));
  const main = chunk('MAIN', Buffer.alloc(0), Buffer.concat(parts));
  return Buffer.concat([Buffer.from('VOX ', 'ascii'), i32(200), main]);
}

// ---------- Farol de muestra (16 vóxeles por tile) ----------
export const FAROL_PALETTE = { 1: 0x8a8f96, 2: 0x6f747b, 3: 0x2f3236, 4: 0xc4d9e3, 5: 0xffc46a, 6: 0x8a5a3a, 7: 0x4f8fb0 };
export const FAROL_MATERIALS = {
  2: { _type: '_diffuse', _rough: '0.95' },
  3: { _type: '_metal', _metal: '0.9', _rough: '0.35' },
  4: { _type: '_glass', _rough: '0.05', _ior: '0.5' },
  5: { _type: '_emit', _emit: '1', _flux: '1' },
  7: { _type: '_glass', _rough: '0.1', _ior: '0.33' }, // agua
};
export function farolModels() {
  const post = [];
  const add = (a, x, y, z, c) => a.push([x, y, z, c]);
  // base de piedra 5×5×2 (con el borde más oscuro), poste de hierro, farol de vidrio con la luz adentro y sombrero
  for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) for (let z = 0; z < 2; z++) add(post, x, y, z, (x % 4 === 0 || y % 4 === 0) && z === 0 ? 2 : 1);
  for (let z = 2; z < 12; z++) add(post, 2, 2, z, 3);
  for (let x = 1; x < 4; x++) for (let y = 1; y < 4; y++) { add(post, x, y, 12, 3); add(post, x, y, 16, 3); }
  for (let z = 13; z < 16; z++) for (let x = 1; x < 4; x++) for (let y = 1; y < 4; y++) {
    const edge = (x !== 2) + (y !== 2);
    add(post, x, y, z, x === 2 && y === 2 ? 5 : edge === 2 ? 3 : 4);
  }
  add(post, 2, 2, 17, 3);
  // charco al lado (otro modelo, ubicado y girado por la escena)
  const puddle = [];
  for (let x = 0; x < 4; x++) for (let y = 0; y < 3; y++) if (!(x === 3 && y === 2)) add(puddle, x, y, 0, 7);
  return {
    models: [{ size: [5, 5, 18], voxels: post }, { size: [4, 3, 1], voxels: puddle }],
    palette: FAROL_PALETTE, materials: FAROL_MATERIALS,
    // el charco se gira 90° (filas: -y, x, z → _r = 1 | 16) y queda delante del farol
    scene: [{ model: 0, t: [0, 0, 9] }, { model: 1, t: [5, -1, 0], r: 17 }],
  };
}

// ---------- Herramientas de autor ----------
const AX = { x: 0, y: 1, z: 2 };
const boundsOf = (voxels) => {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const v of voxels) for (let k = 0; k < 3; k++) { if (v[k] < min[k]) min[k] = v[k]; if (v[k] > max[k]) max[k] = v[k]; }
  return { min, max };
};
const inside = (v, r) => v[0] >= r.min[0] && v[0] <= r.max[0] && v[1] >= r.min[1] && v[1] <= r.max[1] && v[2] >= r.min[2] && v[2] <= r.max[2];
/** Junta listas de vóxeles: si dos caen en la misma celda gana el último. */
const merge = (...lists) => { const m = new Map(); for (const l of lists) for (const v of l) m.set(v[0] + ',' + v[1] + ',' + v[2], v); return [...m.values()]; };

/**
 * Espeja los vóxeles de una región sobre un eje. o.region: { min: [x, y, z], max: [x, y, z] } (bordes incluidos;
 * por defecto, la caja de todo). o.keep: true deja también los originales (para armar una mitad y copiarla): donde
 * se pisan gana el original. Lo que está fuera de la región no se toca.
 */
export function mirrorVoxels(voxels, axis, o = {}) {
  const a = AX[axis];
  if (a == null) throw new Error('mirrorVoxels: eje ' + axis);
  if (!voxels.length) return [];
  const r = o.region || boundsOf(voxels);
  const out = [], moved = [], kept = [];
  for (const v of voxels) {
    if (!inside(v, r)) { out.push(v); continue; }
    const m = [...v]; m[a] = r.min[a] + r.max[a] - v[a];
    moved.push(m); kept.push(v);
  }
  return o.keep ? merge(out, moved, kept) : merge(out, moved);
}

/**
 * Gira los vóxeles de una región alrededor de z (arriba en MagicaVoxel), `turns` cuartos de vuelta en sentido
 * antihorario visto desde arriba. Sin o.region gira todo y deja la caja apoyada en la misma esquina mínima. Con
 * región, 90° y 270° piden que sea cuadrada en planta (si no, se saldría de la región).
 */
export function rotateVoxels(voxels, turns, o = {}) {
  if (!Number.isInteger(turns)) throw new Error('rotateVoxels: giros ' + turns);
  const q = ((turns % 4) + 4) % 4;
  if (!voxels.length || q === 0) return voxels.map(v => [...v]);
  const r = o.region || boundsOf(voxels);
  const w = r.max[0] - r.min[0] + 1, h = r.max[1] - r.min[1] + 1;
  if (o.region && q % 2 && w !== h) throw new Error(`rotateVoxels: la región tiene que ser cuadrada en planta para girar ${q * 90}° (es ${w} × ${h})`);
  const out = [], moved = [];
  for (const v of voxels) {
    if (!inside(v, r)) { out.push(v); continue; }
    const u = v[0] - r.min[0], t = v[1] - r.min[1];
    const [nu, nt] = q === 1 ? [h - 1 - t, u] : q === 2 ? [w - 1 - u, h - 1 - t] : [t, w - 1 - u];
    const m = [...v]; m[0] = r.min[0] + nu; m[1] = r.min[1] + nt;
    moved.push(m);
  }
  return merge(out, moved);
}

/**
 * Piezas sueltas: componentes conectados por caras. o.up: eje de arriba (2 en MagicaVoxel, 1 en lo que devuelve
 * parseVox). Devuelve { parts: [{ size, min, max, grounded }] de mayor a menor, floating: los que no tocan el piso
 * (la capa más baja del modelo) }. Un modelo sano tiene floating vacío.
 */
export function looseParts(voxels, o = {}) {
  const up = o.up ?? 2;
  const key = (x, y, z) => x + ',' + y + ',' + z;
  const left = new Map();
  for (const v of voxels) left.set(key(v[0], v[1], v[2]), v);
  if (!left.size) return { parts: [], floating: [] };
  let floor = Infinity;
  for (const v of left.values()) if (v[up] < floor) floor = v[up];
  const parts = [];
  const N = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  while (left.size) {
    const [k0, v0] = left.entries().next().value;
    left.delete(k0);
    const stack = [v0], part = { size: 0, min: [v0[0], v0[1], v0[2]], max: [v0[0], v0[1], v0[2]], grounded: false };
    while (stack.length) {
      const v = stack.pop();
      part.size++;
      for (let k = 0; k < 3; k++) { if (v[k] < part.min[k]) part.min[k] = v[k]; if (v[k] > part.max[k]) part.max[k] = v[k]; }
      if (v[up] === floor) part.grounded = true;
      for (const [dx, dy, dz] of N) {
        const k = key(v[0] + dx, v[1] + dy, v[2] + dz), n = left.get(k);
        if (n) { left.delete(k); stack.push(n); }
      }
    }
    parts.push(part);
  }
  parts.sort((a, b) => b.size - a.size);
  return { parts, floating: parts.filter(p => !p.grounded) };
}

/** Grilla de autor (coordenadas de MagicaVoxel; admite negativas mientras se dibuja). */
export class Lienzo {
  constructor() { this.m = new Map(); }
  set(x, y, z, c) { if (c) this.m.set(x + ',' + y + ',' + z, [x, y, z, c]); else this.del(x, y, z); return this; }
  get(x, y, z) { const v = this.m.get(x + ',' + y + ',' + z); return v ? v[3] : 0; }
  del(x, y, z) { this.m.delete(x + ',' + y + ',' + z); return this; }
  /** Caja de w × d × h desde (x, y, z). c: índice o función (x, y, z) → índice (0 = vacío, null = no tocar). */
  box(x, y, z, w, d, h, c) {
    for (let i = x; i < x + w; i++) for (let j = y; j < y + d; j++) for (let k = z; k < z + h; k++) {
      const ci = typeof c === 'function' ? c(i, j, k) : c;
      if (ci != null) this.set(i, j, k, ci);
    }
    return this;
  }
  /** Suma una lista de vóxeles (pisa lo que haya), corrida en (dx, dy, dz). */
  add(voxels, dx = 0, dy = 0, dz = 0) { for (const [x, y, z, c] of voxels) this.set(x + dx, y + dy, z + dz, c); return this; }
  voxels() { return [...this.m.values()].map(v => [...v]); }
  /** { size, voxels } listo para writeVox: la esquina mínima va a (0, 0, 0). */
  model() {
    const v = this.voxels();
    if (!v.length) return { size: [1, 1, 1], voxels: [] };
    const { min, max } = boundsOf(v);
    return { size: [0, 1, 2].map(k => max[k] - min[k] + 1), voxels: v.map(([x, y, z, c]) => [x - min[0], y - min[1], z - min[2], c]) };
  }
}

// ---------- Chequeos de la Regla de modelos (DESIGN.md) ----------
export const RULES = {
  maxSide: 126,               // por lado y por archivo
  kitPlan: 32, kitHeight: 64, // módulo de kit (archivos en una subcarpeta de assets/models/)
  tones: 3, tonesHero: 4,     // tonos por material
  materials: 5,               // materiales `solid` por modelo
  minValue: 0.12, maxValue: 0.9, // sin negro ni blanco puros (valor HSV)
  solidMax: 240, freeFrom: 251,  // 241 a 250 son los índices reservados (luz, ventana, agua, vidrio, metal)
};
const hex = (c) => '#' + c.toString(16).padStart(6, '0');
/**
 * Revisa un modelo ya leído con parseVox. o.kit: es un módulo de kit (vale la convención de la paleta, con cada
 * material `solid` en un bloque de 8 índices: 1-8, 9-16…, y el tamaño de módulo). o.hero: pieza protagonista
 * (4 tonos, sin tope de módulo). Devuelve { errors, warnings, info }.
 */
export function checkVox(parsed, o = {}) {
  const errors = [], warnings = [];
  const [sx, sy, sz] = parsed.size;
  const n = parsed.indices.length;
  if (!n) errors.push('el modelo está vacío');
  if (Math.max(sx, sy, sz) > RULES.maxSide) errors.push(`mide ${sx} × ${sy} × ${sz}: el máximo es ${RULES.maxSide} por lado`);
  else if (o.kit && !o.hero && (sx > RULES.kitPlan || sz > RULES.kitPlan || sy > RULES.kitHeight)) errors.push(`mide ${sx} × ${sz} en planta y ${sy} de alto: un módulo de kit llega a ${RULES.kitPlan} × ${RULES.kitPlan} y ${RULES.kitHeight} de alto`);
  // piezas sueltas
  const pts = [];
  for (let i = 0; i < n; i++) pts.push([parsed.data[i * 4], parsed.data[i * 4 + 1], parsed.data[i * 4 + 2]]);
  const loose = looseParts(pts, { up: 1 });
  for (const p of loose.floating) errors.push(`pieza suelta en el aire: ${p.size} ${p.size === 1 ? 'vóxel' : 'vóxeles'} en (${p.min.join(', ')})${p.size > 1 ? ' a (' + p.max.join(', ') + ')' : ''}, en coordenadas del juego (y arriba)`);
  // colores usados
  const used = new Set(parsed.indices);
  const blocks = new Map();
  for (const idx of used) {
    const c = parsed.palette[idx], v = Math.max((c >> 16) & 255, (c >> 8) & 255, c & 255) / 255;
    const emits = parsed.materials[idx]?.emissive > 0;
    if (v < RULES.minValue) errors.push(`índice ${idx} (${hex(c)}): valor ${Math.round(v * 100)} %, por debajo de ${RULES.minValue * 100} % (el negro lo pone el render)`);
    if (v > RULES.maxValue && !emits && idx <= RULES.solidMax) errors.push(`índice ${idx} (${hex(c)}): valor ${Math.round(v * 100)} %, por encima de ${RULES.maxValue * 100} % (sin blanco puro)`);
    if (!o.kit) continue;
    if (idx >= RULES.freeFrom) warnings.push(`índice ${idx}: está en el rango libre (251 a 255), sin uso definido`);
    else if (idx <= RULES.solidMax) {
      const b = (idx - 1) >> 3;
      blocks.set(b, (blocks.get(b) || 0) + 1);
      if (emits) errors.push(`índice ${idx}: emite luz pero no está en los índices reservados (241 a 244)`);
    }
  }
  if (o.kit) {
    const tones = o.hero ? RULES.tonesHero : RULES.tones;
    for (const [b, k] of blocks) if (k > tones) errors.push(`material ${b + 1} (índices ${b * 8 + 1} a ${b * 8 + 8}): ${k} tonos, el máximo es ${tones}`);
    if (blocks.size > RULES.materials) errors.push(`${blocks.size} materiales, el máximo es ${RULES.materials}`);
  }
  return { errors, warnings, info: { size: parsed.size, voxels: n, colors: used.size, materials: blocks.size, parts: loose.parts.length } };
}

const MODELS = resolve(dirname(fileURLToPath(import.meta.url)), '../assets/models');
const walk = (dir) => readdirSync(dir).flatMap(f => { const p = resolve(dir, f); return statSync(p).isDirectory() ? walk(p) : p.endsWith('.vox') ? [p] : []; });
/** Revisa archivos .vox (por defecto, todos los de assets/models/). Devuelve cuántos tienen errores. */
export function checkFiles(files = walk(MODELS), o = {}) {
  let bad = 0;
  for (const f of files) {
    const rel = relative(MODELS, f).split(sep).join('/');
    let res;
    try { res = checkVox(parseVox(readFileSync(f)), { kit: rel.includes('/') && !rel.startsWith('..'), hero: (o.heroes || []).includes(basename(f, '.vox')) }); }
    catch (e) { res = { errors: [e.message], warnings: [], info: null }; }
    const i = res.info;
    if (!o.quiet) {
      console.log(`${res.errors.length ? '✘' : '✔'} ${rel}${i ? `  ${i.size.join('×')}, ${i.voxels} vóxeles, ${i.colors} colores${i.parts > 1 ? ', ' + i.parts + ' partes' : ''}` : ''}`);
      for (const e of res.errors) console.log('    error:', e);
      for (const w of res.warnings) console.log('    aviso:', w);
    }
    if (res.errors.length) bad++;
  }
  return bad;
}

/** Los .vox de un kit de tools/kits/: { folder, pieces: { nombre: { size, voxels } }, palette, materials } → [{ path, buf }]. */
export function kitFiles(kit) {
  return Object.entries(kit.pieces).map(([name, model]) => ({ name, path: resolve(MODELS, kit.folder, name + '.vox'), buf: writeVox({ models: [model], palette: kit.palette, materials: kit.materials }) }));
}
/** Los kits de tools/kits/*.mjs. */
export async function loadKits() {
  const dir = resolve(dirname(fileURLToPath(import.meta.url)), 'kits');
  const kits = [];
  for (const f of readdirSync(dir).filter(f => f.endsWith('.mjs')).sort()) kits.push((await import(pathToFileURL(resolve(dir, f)).href)).default);
  return kits;
}

if (resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.includes('--check')) {
    const heroes = (args.find(a => a.startsWith('--protagonista=')) || '=').split('=')[1].split(',').filter(Boolean);
    const paths = args.filter(a => !a.startsWith('--')).map(p => resolve(p));
    const files = paths.length ? paths.flatMap(p => statSync(p).isDirectory() ? walk(p) : [p]) : walk(MODELS);
    const bad = checkFiles(files, { heroes });
    console.log(`\n${bad ? '✘' : '✔'} ${files.length} archivos, ${bad} con errores`);
    process.exit(bad ? 1 : 0);
  }
  const write = (path, buf) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, buf); console.log('escrito', relative(MODELS, path), buf.length, 'bytes'); };
  write(resolve(MODELS, 'farol.vox'), writeVox(farolModels()));
  // sin await acá arriba: los kits importan este módulo, que tiene que terminar de cargar antes
  loadKits().then(kits => { for (const kit of kits) for (const { path, buf } of kitFiles(kit)) write(path, buf); });
}
