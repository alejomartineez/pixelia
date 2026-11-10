// Escritor mínimo de MagicaVoxel `.vox` (para pruebas y modelos de ejemplo) y el farol de muestra de assets/models/.
//   node tools/make-vox.mjs        → escribe assets/models/farol.vox
// Coordenadas de MagicaVoxel: z arriba. writeVox({ models, palette, materials, scene }):
//   models: [{ size: [x, y, z], voxels: [[x, y, z, índice], ...] }] · palette: { índice: 0xRRGGBB }
//   materials: { índice: { _type, _emit, _metal, _rough, _ior, ... } } · scene: [{ model, t: [x, y, z], r }] (opcional)
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

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
export const FAROL_PALETTE = { 1: 0x8a8f96, 2: 0x6f747b, 3: 0x2f3236, 4: 0xcfe4ee, 5: 0xffc46a, 6: 0x8a5a3a, 7: 0x4f8fb0 };
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

if (resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) {
  const out = resolve(dirname(fileURLToPath(import.meta.url)), '../assets/models/farol.vox');
  mkdirSync(dirname(out), { recursive: true });
  const buf = writeVox(farolModels());
  writeFileSync(out, buf);
  console.log('escrito', out, buf.length, 'bytes');
}
