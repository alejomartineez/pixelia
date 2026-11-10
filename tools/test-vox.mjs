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
import { writeVox, farolModels } from './make-vox.mjs';

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

console.log(`\n${fail ? '✘' : '✔'} ${pass} OK, ${fail} fallas`);
process.exit(fail ? 1 : 0);
