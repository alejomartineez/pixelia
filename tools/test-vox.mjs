// Prueba sin navegador del mallado (greedy meshing) y del lector de MagicaVoxel `.vox`.
//   node tools/test-vox.mjs
// 1) Greedy: en grillas al azar y en el farol de muestra, cada cara de un vóxel queda cubierta por exactamente un
//    rectángulo con los mismos colores por esquina que sin unir (se ve igual), con menos vértices.
// 2) .vox: assets/models/farol.vox (lo arma tools/make-vox.mjs) se lee con su paleta, materiales, escena y giro.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { meshPacked, packVoxels } from '../src/core/voxel-mesh.js';
import { parseVox, voxToVoxels, rotMatrix } from '../src/core/vox-loader.js';
import { existsSync } from 'node:fs';
import { writeVox, farolModels, mirrorVoxels, rotateVoxels, looseParts, checkVox, Lienzo, kitFiles, loadKits, checkFiles, RULES } from './make-vox.mjs';
import { assembleKit, kitKind, KIT_WINDOW } from '../src/core/vox-kit.js';
import { MADERA_PARTS, CASA_MADERA_A } from '../src/city/kits/madera.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (c, msg, extra) => { if (c) { pass++; console.log('  ✔', msg); } else { fail++; console.log('  ✘', msg, extra !== undefined ? JSON.stringify(extra) : ''); } return !!c; };

// Voxels mínimo (el de verdad trae three.js, que en Node no se resuelve)
class MiniVoxels {
  constructor() { this.map = new Map(); }
  set(x, y, z, c) { this.map.set(x + ',' + y + ',' + z, c); return this; }
  get size() { return this.map.size; }
}

// ---------- 1) Greedy meshing ----------
/**
 * Muestrea la malla: 4 puntos por cara unitaria (fuera de las diagonales) → color interpolado del triángulo que lo
 * cubre. Devuelve Map "normal|punto" → color, cuántos puntos quedaron cubiertos dos veces y cuántas uniones en T hay
 * (un vértice de la malla apoyado en el medio del lado de un triángulo: deja agujeritos al rasterizar).
 */
const SAMPLES = [[0.2137, 0.3391], [0.7919, 0.3113], [0.6841, 0.8317], [0.3307, 0.7411]];
function surface(r) {
  const out = new Map();
  const P = r.position, N = r.normal, C = r.color, I = r.index;
  let overlap = 0, tjunctions = 0;
  const verts = new Set();
  for (let v = 0; v < P.length; v += 3) verts.add(P[v] + ',' + P[v + 1] + ',' + P[v + 2]);
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t], b = I[t + 1], c = I[t + 2];
    const n = [N[a * 3], N[a * 3 + 1], N[a * 3 + 2]], ax = n.findIndex(x => x !== 0);
    const [u, w] = [0, 1, 2].filter(x => x !== ax);
    const A = [P[a * 3 + u], P[a * 3 + w]], B = [P[b * 3 + u], P[b * 3 + w]], D = [P[c * 3 + u], P[c * 3 + w]];
    const den = (B[1] - D[1]) * (A[0] - D[0]) + (D[0] - B[0]) * (A[1] - D[1]);
    if (Math.abs(den) < 1e-9) continue; // triángulo sin área
    // uniones en T: puntos enteros en el medio de cada lado que son vértices de la malla
    for (const [i, j] of [[a, b], [b, c], [c, a]]) {
      const p0 = [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]], p1 = [P[j * 3], P[j * 3 + 1], P[j * 3 + 2]];
      const len = Math.max(...p0.map((x, k) => Math.abs(p1[k] - x)));
      const axisAligned = p0.filter((x, k) => p1[k] !== x).length === 1;
      if (!axisAligned) continue; // diagonales y radios del abanico: no pasan por puntos de la grilla compartidos con bordes
      for (let s = 1; s < len; s++) { const m = p0.map((x, k) => x + Math.sign(p1[k] - x) * s); if (verts.has(m.join(','))) tjunctions++; }
    }
    const u0 = Math.floor(Math.min(A[0], B[0], D[0])), u1 = Math.ceil(Math.max(A[0], B[0], D[0]));
    const w0 = Math.floor(Math.min(A[1], B[1], D[1])), w1 = Math.ceil(Math.max(A[1], B[1], D[1]));
    for (let i = u0; i < u1; i++) for (let j = w0; j < w1; j++) for (const [su, sw] of SAMPLES) {
      const x = i + su, y = j + sw;
      const l1 = ((B[1] - D[1]) * (x - D[0]) + (D[0] - B[0]) * (y - D[1])) / den;
      const l2 = ((D[1] - A[1]) * (x - D[0]) + (A[0] - D[0]) * (y - D[1])) / den;
      const l3 = 1 - l1 - l2;
      if (l1 < 0 || l2 < 0 || l3 < 0) continue;
      const col = [0, 1, 2].map(k => (C[a * 3 + k] * l1 + C[b * 3 + k] * l2 + C[c * 3 + k] * l3).toFixed(5)).join(',');
      const k = n.join(',') + '|' + P[a * 3 + ax] + '|' + x.toFixed(4) + "," + y.toFixed(4);
      if (out.has(k)) overlap++;
      out.set(k, col);
    }
  }
  return { out, overlap, tjunctions };
}
function sameLook(data, opts, label) {
  const a = meshPacked(data, { ...opts, greedy: false }), b = meshPacked(data, { ...opts, greedy: true });
  const A = surface(a), B = surface(b);
  let diff = 0;
  for (const [k, c] of A.out) if (B.out.get(k) !== c) diff++;
  ok(!diff && A.out.size === B.out.size && A.out.size === a.faces * 4 && !A.overlap && !B.overlap && a.faces === b.faces,
    `${label}: misma superficie y colores (${a.faces} caras), vértices ${a.verts} → ${b.verts}`,
    { diff, sizes: [A.out.size, B.out.size, a.faces * 4], overlap: [A.overlap, B.overlap] });
  ok(B.tjunctions === 0, `${label}: sin uniones en T`, B.tjunctions);
  return [a, b];
}
console.log('■ Greedy meshing');
let seed = 7;
const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
for (let t = 0; t < 6; t++) {
  const v = new MiniVoxels();
  const cols = [0xa0522d, 0x8fdc7a, 0xd0d0d0];
  const W = 6 + t * 3;
  for (let x = 0; x < W; x++) for (let z = 0; z < W; z++) {
    const h = 1 + Math.floor(rnd() * 4);
    for (let y = 0; y < h; y++) if (rnd() > 0.08) v.set(x, y, z, cols[(x >> 2) % cols.length]);
  }
  sameLook(packVoxels(v.map), { jitter: t % 2 ? 0.015 : 0 }, `grilla al azar ${t + 1}`);
}
{
  const v = new MiniVoxels();
  for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) v.set(x, 0, z, 0x8fdc7a);
  const [a, b] = sameLook(packVoxels(v.map), { jitter: 0 }, 'piso liso 16×16');
  ok(b.quads === 6 && b.verts === 24, `piso liso: ${a.quads} → ${b.quads} rectángulos (uno por cara de la losa)`);
}
ok(meshPacked(new Int32Array(0)).position.length === 0, 'grilla vacía: malla vacía');

// ---------- 2) .vox ----------
console.log('\n■ Lector .vox');
const buf = readFileSync(resolve(ROOT, 'assets/models/farol.vox'));
const fresh = writeVox(farolModels());
ok(Buffer.compare(buf, fresh) === 0, 'assets/models/farol.vox está al día con tools/make-vox.mjs');
const vx = parseVox(buf);
const src = farolModels();
ok(vx.version === 200 && vx.models === 2, `versión ${vx.version}, ${vx.models} modelos`);
ok(vx.indices.length === src.models[0].voxels.length + src.models[1].voxels.length, `${vx.indices.length} vóxeles`);
ok(vx.size[1] === 18, `y es arriba: tamaño ${vx.size.join('×')}`);
ok(vx.palette[5] === 0xffc46a && vx.palette[1] === 0x8a8f96, 'paleta: índice i = entrada i-1 de RGBA');
const M = vx.materials;
ok(M[3].metal === 0.9 && M[3].rough === 0.35, 'metal y rugosidad', M[3]);
ok(M[4].glass && !M[4].water, 'vidrio', M[4]);
ok(M[5].emissive === 2, 'emisivo (emit × 2^flux)', M[5]);
ok(M[7].water && !M[7].glass, 'agua (vidrio con ior 1,33)', M[7]);
ok(M[1].rough === 0.8 && !M[1].metal && !M[1].emissive && M[2].rough === 0.95, 'difuso por defecto y rugosidad propia');
const O = parseVox(buf, { materials: { 1: { rough: 0.5 } } }).materials;
ok(O[1].rough === 0.5 && O[3].metal === 0.9, 'opts.materials pisa un índice');
// dónde quedó cada cosa
const at = (pred) => { const r = []; for (let i = 0; i < vx.indices.length; i++) if (pred(vx.indices[i])) r.push([vx.data[i * 4], vx.data[i * 4 + 1], vx.data[i * 4 + 2]]); return r; };
const light = at(i => i === 5), water = at(i => i === 7);
ok(light.length === 3 && light.every(p => p[1] >= 13 && p[1] <= 15), 'la luz del farol está arriba (y = 13..15)', light);
const ext = (pts, a) => Math.max(...pts.map(p => p[a])) - Math.min(...pts.map(p => p[a])) + 1;
ok(water.every(p => p[1] === 0) && ext(water, 0) === 3 && ext(water, 2) === 4, 'el charco está en el piso y girado 90° por nTRN (3 × 4)', { x: ext(water, 0), z: ext(water, 2) });
ok(Math.min(...vx.data.filter((_, i) => i % 4 === 1)) === 0, 'la base queda en y = 0');
const det = (m) => m[0] * (m[4] * m[8] - m[5] * m[7]) - m[1] * (m[3] * m[8] - m[5] * m[6]) + m[2] * (m[3] * m[7] - m[4] * m[6]);
ok(det(rotMatrix(17)) === 1 && det(rotMatrix(4)) === 1 && det(rotMatrix(1)) === -1, '_r: giros (det 1) y espejos (det -1)');
const flat = parseVox(buf, { scene: false });
ok(flat.indices.length < vx.indices.length && flat.size[1] === 18 && flat.size[0] === 5, 'scene: false apila los modelos en el origen (el charco pisa la base)', flat.size);
const V = voxToVoxels(vx, MiniVoxels);
ok(V.voxels.size === vx.indices.length && V.materialAt(...light[0]).emissive === 2, 'voxToVoxels: Voxels y materialAt');
const [glow, rest] = V.split(m => m.emissive > 0);
ok(glow.size === 3 && rest.size === vx.indices.length - 3, 'split separa lo emisivo');
sameLook(vx.data, { jitter: 0.015 }, 'farol');
let bad = 0;
for (const b of [new Uint8Array(4), Buffer.from('VOX \x96\0\0\0XXXX')]) { try { parseVox(b); } catch { bad++; } }
ok(bad === 2, 'archivos que no son .vox tiran error');

// ---------- 3) Herramientas de autor ----------
console.log('\n■ Herramientas de autor (espejar, girar, piezas sueltas, regla)');
const set = (v) => new Set(v.map(p => p.join(',')));
const same = (a, b) => { const A = set(a), B = set(b); return A.size === B.size && [...A].every(k => B.has(k)); };
{
  // una L de 3 × 2 en planta, con dos colores
  const Lv = [[0, 0, 0, 1], [1, 0, 0, 1], [2, 0, 0, 2], [0, 1, 0, 1]];
  ok(same(mirrorVoxels(Lv, 'x'), [[2, 0, 0, 1], [1, 0, 0, 1], [0, 0, 0, 2], [2, 1, 0, 1]]), 'espejar en x dentro de la caja');
  ok(same(mirrorVoxels(mirrorVoxels(Lv, 'x'), 'x'), Lv) && same(mirrorVoxels(mirrorVoxels(Lv, 'z'), 'z'), Lv), 'espejar dos veces devuelve lo mismo');
  ok(same(mirrorVoxels(Lv, 'y'), [[0, 1, 0, 1], [1, 1, 0, 1], [2, 1, 0, 2], [0, 0, 0, 1]]), 'espejar en y');
  const half = mirrorVoxels([[0, 0, 0, 1], [1, 0, 0, 2], [9, 5, 0, 3]], 'x', { region: { min: [0, 0, 0], max: [5, 0, 0] }, keep: true });
  ok(same(half, [[0, 0, 0, 1], [1, 0, 0, 2], [5, 0, 0, 1], [4, 0, 0, 2], [9, 5, 0, 3]]), 'región con keep: copia la mitad y no toca lo de afuera', half);
  const clash = mirrorVoxels([[0, 0, 0, 1], [2, 0, 0, 2]], 'x', { keep: true });
  ok(same(clash, [[0, 0, 0, 1], [2, 0, 0, 2]]), 'keep: donde se pisan gana el original', clash);
  let threw = 0; try { mirrorVoxels(Lv, 'w'); } catch { threw++; }
  const r1 = rotateVoxels(Lv, 1), r2 = rotateVoxels(Lv, 2), r3 = rotateVoxels(Lv, 3);
  ok(same(r1, [[1, 0, 0, 1], [1, 1, 0, 1], [1, 2, 0, 2], [0, 0, 0, 1]]), 'girar 90° (antihorario visto de arriba), apoyado en la misma esquina', r1);
  ok(same(r2, [[2, 1, 0, 1], [1, 1, 0, 1], [0, 1, 0, 2], [2, 0, 0, 1]]), 'girar 180°', r2);
  ok(same(rotateVoxels(r1, 1), r2) && same(rotateVoxels(r2, 1), r3) && same(rotateVoxels(r3, 1), Lv) && same(rotateVoxels(Lv, -1), r3), '90° cuatro veces da la vuelta; -1 = 270°');
  ok(same(rotateVoxels(r1, 2), r3) && same(rotateVoxels(Lv, 4), Lv), '90° + 180° = 270°; 360° no cambia nada');
  const reg = rotateVoxels([[0, 0, 0, 1], [1, 0, 0, 2], [7, 7, 3, 3]], 1, { region: { min: [0, 0, 0], max: [1, 1, 0] } });
  ok(same(reg, [[1, 0, 0, 1], [1, 1, 0, 2], [7, 7, 3, 3]]), 'girar una región cuadrada: lo de afuera queda', reg);
  try { rotateVoxels(Lv, 1, { region: { min: [0, 0, 0], max: [2, 1, 0] } }); } catch { threw++; }
  try { rotateVoxels(Lv, 0.5); } catch { threw++; }
  ok(threw === 3, 'eje desconocido, región no cuadrada a 90° y giro no entero tiran error', threw);
  // piezas sueltas
  const tower = new Lienzo().box(0, 0, 0, 3, 3, 4, 1);
  ok(looseParts(tower.voxels()).parts.length === 1 && !looseParts(tower.voxels()).floating.length, 'un bloque: una pieza, nada suelto');
  tower.set(1, 1, 6, 2).set(5, 0, 0, 3).set(3, 3, 4, 2);
  const lp = looseParts(tower.voxels());
  ok(lp.parts.length === 4 && lp.parts[0].size === 36 && lp.floating.length === 2, 'un vóxel flotando y otro unido solo en diagonal se avisan; uno apoyado aparte, no', lp);
  ok(lp.floating.some(p => p.min.join() === '1,1,6') && lp.floating.some(p => p.min.join() === '3,3,4'), 'dice dónde están');
  ok(looseParts([]).parts.length === 0, 'lista vacía: sin piezas');
  ok(same(new Lienzo().set(-2, 3, 5, 1).set(0, 4, 5, 2).model().voxels, [[0, 0, 0, 1], [2, 1, 0, 2]]), 'Lienzo.model lleva la esquina mínima a 0');
  // regla
  const chk = (model, palette, o, materials) => checkVox(parseVox(writeVox({ models: [model], palette, materials })), o);
  const cube = new Lienzo().box(0, 0, 0, 4, 4, 4, (x, y, z) => 1 + (z % 3));
  const good = chk(cube.model(), { 1: 0xb89466, 2: 0xa07e58, 3: 0x7d6250 }, { kit: true });
  ok(!good.errors.length && good.info.materials === 1 && good.info.colors === 3, 'modelo sano: sin errores', good);
  const black = chk(cube.model(), { 1: 0x000000, 2: 0x1a1a1a, 3: 0xffffff }, { kit: true });
  ok(black.errors.length === 3 && black.errors.some(e => e.includes('#000000')) && black.errors.some(e => e.includes('#ffffff')), 'negro puro, casi negro (10 %) y blanco puro son errores', black.errors);
  const four = new Lienzo().box(0, 0, 0, 4, 4, 4, (x, y, z) => 1 + z).model();
  const P4 = { 1: 0xb89466, 2: 0xa07e58, 3: 0x7d6250, 4: 0x8a6a50 };
  ok(chk(four, P4, { kit: true }).errors.length === 1 && !chk(four, P4, { kit: true, hero: true }).errors.length && !chk(four, P4, {}).errors.length, '4 tonos en un material: error en el kit, vale en protagonistas y fuera del kit');
  const six = new Lienzo().box(0, 0, 0, 6, 1, 1, (x) => 1 + x * 8).model();
  ok(chk(six, Object.fromEntries([0, 1, 2, 3, 4, 5].map(i => [1 + i * 8, 0x808890])), { kit: true }).errors.some(e => e.includes('6 materiales')), 'más de 5 materiales: error');
  const big = new Lienzo().box(0, 0, 0, 40, 2, 2, 1).model();
  ok(chk(big, { 1: 0x808890 }, { kit: true }).errors.length === 1 && !chk(big, { 1: 0x808890 }, { kit: true, hero: true }).errors.length, 'módulo de kit de más de 32 en planta: error (protagonista, no)');
  const huge = new Lienzo().box(0, 0, 0, 127, 1, 1, 1).model();
  ok(chk(huge, { 1: 0x808890 }, { hero: true }).errors.some(e => e.includes(String(RULES.maxSide))), 'más de 126 por lado: error siempre');
  const fly = new Lienzo().box(0, 0, 0, 2, 2, 2, 1).set(0, 0, 4, 1).model();
  ok(chk(fly, { 1: 0x808890 }, {}).errors.some(e => e.includes('pieza suelta')), 'pieza suelta: error');
  const emit = new Lienzo().box(0, 0, 0, 2, 2, 2, 1).set(0, 0, 2, 241).model();
  ok(!chk(emit, { 1: 0x808890, 241: 0xffc46a }, { kit: true }, { 241: { _type: '_emit', _emit: '1' } }).errors.length, 'lo emisivo puede pasar de 90 % de valor');
  ok(chk(new Lienzo().box(0, 0, 0, 2, 2, 2, 5).model(), { 5: 0xffc46a }, { kit: true }, { 5: { _type: '_emit', _emit: '1' } }).errors.length === 1, 'emisivo fuera de los índices reservados: error en el kit');
}

// ---------- 4) Kits ----------
console.log('\n■ Kits (assets/models/<kit>/)');
const kits = await loadKits();
const parts = {};
for (const kit of kits) {
  const files = kitFiles(kit);
  const stale = files.filter(f => !existsSync(f.path) || Buffer.compare(readFileSync(f.path), f.buf) !== 0).map(f => f.name);
  ok(!stale.length, `${kit.folder}/: ${files.length} archivos al día con tools/kits/${kit.folder}.mjs`, stale);
  if (kit.folder === 'madera') for (const f of files) parts[f.name] = parseVox(f.buf);
}
ok(checkFiles(undefined, { quiet: true }) === 0, 'todos los .vox de assets/models/ pasan la regla (npm run check:vox)');
{
  const bad = Object.entries(MADERA_PARTS).filter(([name, def]) => {
    const p = parts[name], pad = def.pad || {};
    return !p || p.size[0] !== def.size[0] + (pad.l || 0) + (pad.r || 0) || p.size[2] !== def.size[1] + (pad.b || 0) + (pad.f || 0);
  }).map(([name]) => name);
  ok(!bad.length && Object.keys(parts).every(n => MADERA_PARTS[n]), 'madera: el tamaño de cada archivo es su huella más lo que sobresale (MADERA_PARTS)', bad);
  ok(Object.values(MADERA_PARTS).every(d => d.size[0] % 4 === 0 && d.size[1] % 4 === 0) && ['pared-a', 'pared-ventana-a', 'pared-puerta-a', 'techo-tramo-a'].every(n => MADERA_PARTS[n].size.every(s => s % 8 === 0)), 'madera: huellas en múltiplos de 8 (postes y cumbrera, de 4)');
  const casa = assembleKit(parts, MADERA_PARTS, CASA_MADERA_A);
  ok(casa.size.join('×') === '36×49×38' && casa.min.join() === '-2,0,-3', `casa de Madera: ${casa.size.join('×')} (32 × 32 más aleros y escalón; 42 a la cumbrera y 49 con la chimenea)`, { size: casa.size, min: casa.min });
  const pts = []; for (let i = 0; i < casa.indices.length; i++) pts.push([casa.data[i * 4], casa.data[i * 4 + 1], casa.data[i * 4 + 2]]);
  const lp = looseParts(pts, { up: 1 });
  ok(lp.parts.length === 1, `casa de Madera: una sola pieza (${casa.indices.length} vóxeles), nada suelto`, lp.parts.slice(1));
  const at = new Map(); for (let i = 0; i < casa.indices.length; i++) at.set(pts[i].join(','), casa.indices[i]);
  const win = [...at].filter(([, ci]) => kitKind(ci, casa.materials) === 'window').map(([k]) => k.split(',').map(Number));
  ok(win.length === 3 * 48 + 2 * 16 && win.every(p => p[1] >= 10), `ventanas: 3 de 6 × 8 y 2 del altillo de 4 × 4 (índice ${KIT_WINDOW}), del antepecho para arriba`, win.length);
  ok(win.some(p => p[2] === 30) && win.some(p => p[0] === 30) && win.some(p => p[0] === 1), 'ventanas al frente y a los dos costados, hundidas 1 en la pared');
  ok(kitKind(248, casa.materials) === 'metal' && kitKind(2, casa.materials) === 'solid', 'el hierro de la puerta sale como metal');
  ok(at.get('5,10,30') === 9 && !at.has('5,10,31') && at.get('-1,10,31') === 10, 'la puerta está al frente a la izquierda, hundida, y el poste de esquina sobresale 1');
  ok(!at.has('16,10,-2') && at.has('16,22,-1'), 'atrás: pared lisa girada 180° (la solera sobresale hacia -z)');
  let threw = 0; try { assembleKit(parts, MADERA_PARTS, [{ part: 'no-existe', at: [0, 0, 0] }]); } catch { threw++; }
  ok(threw === 1, 'una pieza que no está en el kit tira error');
}

console.log(`\n${fail ? '✘' : '✔'} ${pass} OK, ${fail} fallas`);
process.exit(fail ? 1 : 0);
