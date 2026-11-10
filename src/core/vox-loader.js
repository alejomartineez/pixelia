// Lector de MagicaVoxel `.vox` (sin dependencias). Lee SIZE/XYZI/RGBA y, si están, MATL y la escena (nTRN/nGRP/nSHP:
// posición y giro de cada modelo). Devuelve un `Voxels` con los colores de la paleta y los flags de material por
// índice de paleta (emisivo, metal, vidrio, agua, rugosidad), que el render físico (Etapa 1 de PLAN-FOTO) va a leer.
//
//   const { voxels, materials, materialAt } = await loadVox('assets/models/farol.vox');
//   const mesh = voxels.toMesh({ scale: 1 / 16, center: 'xz' });
//
// Ejes: MagicaVoxel es z arriba; acá y es arriba. (x, y, z) de MV pasa a (x, z, -y): un giro, sin espejar, así que
// lo que en MV mira a -y (el frente por defecto) acá mira a +z.

/** Material por defecto de un índice de paleta. */
export const MATERIAL_DEFAULT = Object.freeze({ emissive: 0, metal: 0, glass: false, water: false, rough: 0.8 });

/**
 * Parsea un `.vox`. buf: ArrayBuffer o Uint8Array. opts.materials: { [índice]: patch } pisa lo que diga el archivo
 * (para marcar agua o luces sin abrir MagicaVoxel). opts.scene: false = ignorar la escena y apilar los modelos en el origen.
 * Devuelve { version, models, size: [x, y, z] (ya en y arriba), data: Int32Array [x, y, z, color, ...],
 * indices: Uint8Array (índice de paleta por vóxel), palette: Int32Array(256) (0xRRGGBB, índice 1..255),
 * materials: Array(256) de { emissive, metal, glass, water, rough } }.
 */
export function parseVox(buf, opts = {}) {
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  let p = 0;
  const id = () => { const s = String.fromCharCode(u8[p], u8[p + 1], u8[p + 2], u8[p + 3]); p += 4; return s; };
  const i32 = () => { const v = dv.getInt32(p, true); p += 4; return v; };
  const str = () => { const n = i32(); let s = ''; for (let i = 0; i < n; i++) s += String.fromCharCode(u8[p + i]); p += n; return s; };
  const dict = () => { const n = i32(), o = {}; for (let i = 0; i < n; i++) { const k = str(); o[k] = str(); } return o; };
  if (u8.length < 8 || id() !== 'VOX ') throw new Error('vox: no es un archivo MagicaVoxel');
  const version = i32();
  if (id() !== 'MAIN') throw new Error('vox: falta el chunk MAIN');
  const mainContent = i32(), mainChildren = i32();
  p += mainContent;
  const end = Math.min(u8.length, p + mainChildren);

  const models = []; // { size: [x, y, z], xyzi: Uint8Array }
  let rgba = null;
  const matl = new Map();
  const nodes = new Map();
  while (p + 12 <= end) {
    const cid = id(), n = i32(), m = i32(), start = p;
    if (cid === 'SIZE') models.push({ size: [i32(), i32(), i32()], xyzi: null });
    else if (cid === 'XYZI') {
      const count = i32();
      const last = models[models.length - 1];
      if (last) last.xyzi = u8.subarray(p, p + count * 4);
    } else if (cid === 'RGBA') rgba = u8.subarray(p, p + 1024);
    else if (cid === 'MATL') { const mid = i32(); matl.set(mid, dict()); }
    else if (cid === 'nTRN') {
      const nid = i32(); const attr = dict(); const child = i32(); i32(); i32(); const frames = i32();
      const f = frames > 0 ? dict() : {};
      nodes.set(nid, { type: 'T', attr, child, t: (f._t || '0 0 0').split(/\s+/).map(Number), r: f._r != null ? +f._r : null });
    } else if (cid === 'nGRP') {
      const nid = i32(); dict(); const k = i32(); const children = []; for (let i = 0; i < k; i++) children.push(i32());
      nodes.set(nid, { type: 'G', children });
    } else if (cid === 'nSHP') {
      const nid = i32(); dict(); const k = i32(); const ms = []; for (let i = 0; i < k; i++) { ms.push(i32()); dict(); }
      nodes.set(nid, { type: 'S', models: ms });
    }
    p = start + n + m; // los chunks se recorren planos: sus hijos (si hay) quedan salteados
  }

  // paleta: el color de índice i (1..255) es la entrada i-1 del chunk RGBA
  const palette = new Int32Array(256);
  for (let i = 1; i < 256; i++) {
    if (rgba) { const o = (i - 1) * 4; palette[i] = (rgba[o] << 16) | (rgba[o + 1] << 8) | rgba[o + 2]; }
    else { const g = Math.round(40 + (i / 255) * 200); palette[i] = (g << 16) | (g << 8) | g; } // sin paleta: grises
  }
  const materials = new Array(256);
  for (let i = 0; i < 256; i++) {
    const d = matl.get(i);
    const mat = { ...MATERIAL_DEFAULT };
    if (d) {
      const type = d._type || '_diffuse';
      if (d._rough != null) mat.rough = clamp01(+d._rough);
      if (type === '_metal') mat.metal = clamp01(d._metal != null ? +d._metal : 1);
      if (type === '_emit') mat.emissive = Math.max(0, (d._emit != null ? +d._emit : 1) * Math.pow(2, +(d._flux || 0)));
      if (type === '_glass' || type === '_blend') {
        mat.glass = true;
        // MagicaVoxel no tiene agua: un vidrio con índice de refracción de agua (≈1,33) cuenta como agua
        const ior = d._ior != null ? +d._ior : 0.5; // MV guarda ior - 1
        if (Math.abs(ior - 0.33) < 0.04 || Math.abs(ior - 1.33) < 0.04) { mat.water = true; mat.glass = false; }
      }
    }
    const over = opts.materials && opts.materials[i];
    materials[i] = over ? { ...mat, ...over } : mat;
  }

  // ubicar cada modelo: recorrer la escena desde el nodo 0 juntando giros y posiciones
  const placed = []; // { model, rot: matriz 3×3 (filas), t: [x, y, z] }
  if (opts.scene !== false && nodes.has(0)) {
    const walk = (nid, R, T, depth) => {
      const nd = nodes.get(nid);
      if (!nd || depth > 64) return;
      if (nd.type === 'T') {
        const r = nd.r != null ? rotMatrix(nd.r) : [1, 0, 0, 0, 1, 0, 0, 0, 1];
        walk(nd.child, mul3(R, r), add3(T, mulv(R, nd.t)), depth + 1);
      } else if (nd.type === 'G') for (const c of nd.children) walk(c, R, T, depth + 1);
      else if (nd.type === 'S') for (const mi of nd.models) if (models[mi]) placed.push({ model: models[mi], rot: R, t: T });
    };
    walk(0, [1, 0, 0, 0, 1, 0, 0, 0, 1], [0, 0, 0], 0);
  }
  if (!placed.length) for (const model of models) placed.push({ model, rot: null, t: [0, 0, 0] });

  // vóxeles en coordenadas MV (z arriba) y después a y arriba
  const out = new Map(); // "x,y,z" → índice (el último gana, como en MV)
  for (const { model, rot, t } of placed) {
    if (!model.xyzi) continue;
    const [sx, sy, sz] = model.size, b = model.xyzi;
    // MV centra cada modelo en su nodo: el origen local es floor(size / 2)
    const cx = Math.floor(sx / 2), cy = Math.floor(sy / 2), cz = Math.floor(sz / 2);
    for (let i = 0; i + 3 < b.length; i += 4) {
      let x = b[i], y = b[i + 1], z = b[i + 2];
      const ci = b[i + 3];
      if (!ci) continue;
      if (rot) {
        const lx = x - cx, ly = y - cy, lz = z - cz;
        x = rot[0] * lx + rot[1] * ly + rot[2] * lz + t[0];
        y = rot[3] * lx + rot[4] * ly + rot[5] * lz + t[1];
        z = rot[6] * lx + rot[7] * ly + rot[8] * lz + t[2];
      }
      out.set(x + ',' + y + ',' + z, ci);
    }
  }
  // a y arriba, con la base en y = 0 y la esquina mínima en x = z = 0
  let mx = Infinity, my = Infinity, mz = Infinity, Mx = -Infinity, My = -Infinity, Mz = -Infinity;
  const pts = [];
  for (const [k, ci] of out) {
    const [x, y, z] = k.split(',').map(Number);
    const X = x, Y = z, Z = -y;
    pts.push(X, Y, Z, ci);
    if (X < mx) mx = X; if (Y < my) my = Y; if (Z < mz) mz = Z; if (X > Mx) Mx = X; if (Y > My) My = Y; if (Z > Mz) Mz = Z;
  }
  const n = pts.length / 4;
  const data = new Int32Array(n * 4), indices = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    data[i * 4] = pts[i * 4] - mx; data[i * 4 + 1] = pts[i * 4 + 1] - my; data[i * 4 + 2] = pts[i * 4 + 2] - mz;
    indices[i] = pts[i * 4 + 3]; data[i * 4 + 3] = palette[indices[i]];
  }
  const size = n ? [Mx - mx + 1, My - my + 1, Mz - mz + 1] : [0, 0, 0];
  return { version, models: models.length, size, data, indices, palette, materials };
}

/**
 * Pasa lo parseado a un `Voxels` (la clase va como parámetro para no arrastrar three.js a las pruebas en Node).
 * Devuelve { voxels, size, palette, materials, materialAt(x, y, z), indexAt(x, y, z) }.
 */
export function voxToVoxels(parsed, Voxels) {
  const v = new Voxels();
  const idx = new Map();
  const { data, indices } = parsed;
  for (let i = 0; i < indices.length; i++) {
    const x = data[i * 4], y = data[i * 4 + 1], z = data[i * 4 + 2];
    v.set(x, y, z, data[i * 4 + 3]);
    idx.set(x + ',' + y + ',' + z, indices[i]);
  }
  const indexAt = (x, y, z) => idx.get(x + ',' + y + ',' + z) || 0;
  return {
    voxels: v, size: parsed.size, palette: parsed.palette, materials: parsed.materials, indexAt,
    materialAt: (x, y, z) => parsed.materials[indexAt(x, y, z)] || MATERIAL_DEFAULT,
    /** Un Voxels por cada índice que cumpla `pred(material, índice)` (ej. separar lo emisivo en su capa). */
    split(pred) {
      const a = new Voxels(), b = new Voxels();
      for (let i = 0; i < indices.length; i++) {
        const target = pred(parsed.materials[indices[i]], indices[i]) ? a : b;
        target.set(data[i * 4], data[i * 4 + 1], data[i * 4 + 2], data[i * 4 + 3]);
      }
      return [a, b];
    },
  };
}

/** Baja y arma un `.vox` (en el navegador). opts igual que parseVox. */
export async function loadVox(url, opts = {}) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`vox: no se pudo bajar ${url} (${res.status})`);
  const parsed = parseVox(await res.arrayBuffer(), opts);
  const { Voxels } = await import('./voxel.js');
  return voxToVoxels(parsed, Voxels);
}

// ---------- matemática de giros (_r de nTRN) ----------
// _r: bits 0-1 = columna del 1 en la fila 1, bits 2-3 = en la fila 2 (la fila 3 usa la que queda),
// bits 4, 5 y 6 = signo negativo de cada fila.
export function rotMatrix(r) {
  const a = r & 3, b = (r >> 2) & 3, c = 3 - a - b;
  const m = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  m[a] = r & 16 ? -1 : 1; m[3 + b] = r & 32 ? -1 : 1; m[6 + c] = r & 64 ? -1 : 1;
  return m;
}
const mul3 = (A, B) => {
  const o = new Array(9);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) o[i * 3 + j] = A[i * 3] * B[j] + A[i * 3 + 1] * B[3 + j] + A[i * 3 + 2] * B[6 + j];
  return o;
};
const mulv = (A, v) => [A[0] * v[0] + A[1] * v[1] + A[2] * v[2], A[3] * v[0] + A[4] * v[1] + A[5] * v[2], A[6] * v[0] + A[7] * v[1] + A[8] * v[2]];
const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const clamp01 = (x) => Math.max(0, Math.min(1, x || 0));
