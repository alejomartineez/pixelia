// Mallado de vóxeles sin three.js: lo usan Voxels.toGeometry (hilo principal) y voxel-worker.js (segundo plano).
// Entra una grilla empaquetada (Int32Array x,y,z,color por vóxel) y salen arreglos tipados listos para BufferGeometry.
//
// Greedy meshing: las caras al aire que están en el mismo plano, con el mismo color final (ya con el jitter) y con la
// misma oclusión en las 4 esquinas se unen en un solo rectángulo. Las caras con oclusión despareja (rincones, pie de
// paredes) quedan sueltas, porque estirarlas cambiaría el degradé: así se ve igual que antes, con menos vértices.

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
// sRGB → lineal, igual que THREE.Color.setHex (ColorManagement de three r187)
const LIN = new Float64Array(256);
for (let i = 0; i < 256; i++) { const c = i / 255; LIN[i] = c < 0.04045 ? c * 0.0773993808 : Math.pow(c * 0.9478672986 + 0.0521327014, 2.4); }

// ---------- Caras ----------
export const DIRS = [
  { n: [1, 0, 0], c: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]] },
  { n: [-1, 0, 0], c: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]] },
  { n: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] },
  { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
  { n: [0, 0, 1], c: [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]] },
  { n: [0, 0, -1], c: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]] },
];
// eje de la normal (ax) y ejes tangentes (u, w) de cada cara
for (const d of DIRS) { d.ax = d.n.findIndex(v => v !== 0); [d.u, d.w] = [0, 1, 2].filter(i => i !== d.ax); }
/** Brillo por esquina según cuántos vecinos la tapan (0 = rincón cerrado .. 3 = libre). En lineal. */
export const AO_LEVELS = [0.5, 0.66, 0.83, 1];
/** Sube cuando cambia el mallado: invalida el caché de IndexedDB. */
export const MESH_VERSION = 3;

/** Map "x,y,z" → color de Voxels a Int32Array [x, y, z, color, ...] (se puede pasar al worker sin copiar). */
export function packVoxels(map) {
  const out = new Int32Array(map.size * 4);
  let i = 0;
  for (const [k, c] of map) {
    const a = k.indexOf(','), b = k.indexOf(',', a + 1);
    out[i++] = +k.slice(0, a); out[i++] = +k.slice(a + 1, b); out[i++] = +k.slice(b + 1); out[i++] = c;
  }
  return out;
}

/**
 * Malla de una grilla empaquetada. Opciones iguales a Voxels.toGeometry, más:
 *   aoLevels: brillo de cada nivel de oclusión (default AO_LEVELS) · greedy: unir caras (default true)
 * Devuelve { position, normal, color, index, quads, faces, verts } (faces = caras al aire antes de unir).
 */
export function meshPacked(data, { scale = 1, center = false, jitter = 0.015, ao = true, aoLevels = AO_LEVELS, greedy = true } = {}) {
  const n = data.length >> 2;
  const pos = [], nor = [], col = [], idx = [];
  if (!n) return finish(pos, nor, col, idx, 0, 0);
  let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
  for (let i = 0; i < data.length; i += 4) {
    const x = data[i], y = data[i + 1], z = data[i + 2];
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (z < z0) z0 = z; if (z > z1) z1 = z;
  }
  let off = [0, 0, 0];
  if (center) off = [-(x0 + x1 + 1) / 2, center === 'xyz' ? -(y0 + y1 + 1) / 2 : -y0, -(z0 + z1 + 1) / 2];
  // ocupación: grilla densa con un borde de 1 (si la caja es enorme y rala, un Set)
  const ox = x0 - 1, oy = y0 - 1, oz = z0 - 1, NX = x1 - x0 + 3, NY = y1 - y0 + 3, NZ = z1 - z0 + 3;
  let occ;
  if (NX * NY * NZ <= 16e6) {
    const grid = new Uint8Array(NX * NY * NZ);
    for (let i = 0; i < data.length; i += 4) grid[((data[i] - ox) * NY + data[i + 1] - oy) * NZ + data[i + 2] - oz] = 1;
    occ = (x, y, z) => (x <= ox || y <= oy || z <= oz || x >= ox + NX - 1 || y >= oy + NY - 1 || z >= oz + NZ - 1) ? 0 : grid[((x - ox) * NY + y - oy) * NZ + z - oz];
  } else {
    const set = new Set();
    for (let i = 0; i < data.length; i += 4) set.add(data[i] + ',' + data[i + 1] + ',' + data[i + 2]);
    occ = (x, y, z) => set.has(x + ',' + y + ',' + z) ? 1 : 0;
  }

  const p = [0, 0, 0], aoV = [3, 3, 3, 3], q = [0, 0, 0], xyz = [0, 0, 0];
  let faces = 0;
  // rectángulos a dibujar, 11 números cada uno: cara, capa (coordenada del vóxel en el eje de la normal), u0, w0,
  // du, dw, color y la oclusión de las 4 esquinas
  const Q = [];
  // caras parejas esperando unirse: por cara y capa, celdas (u, w, clave = color * 4 + oclusión)
  const buckets = greedy ? new Map() : null;
  for (let i = 0; i < data.length; i += 4) {
    const x = data[i], y = data[i + 1], z = data[i + 2], c = data[i + 3];
    let h = (x * 73856093) ^ (y * 19349663) ^ (z * 83492791);
    h = ((h >>> 0) % 1000) / 1000;
    const cc = jitter ? shade(c, (h - 0.5) * 2 * jitter) : c;
    xyz[0] = x; xyz[1] = y; xyz[2] = z;
    for (let di = 0; di < 6; di++) {
      const d = DIRS[di];
      const nx = x + d.n[0], ny = y + d.n[1], nz = z + d.n[2];
      if (occ(nx, ny, nz)) continue;
      faces++;
      // oclusión ambiental por vértice: cada esquina mira sus 3 vecinos en la capa de afuera de la cara
      // (dos lados y la diagonal). Oscurece rincones, aleros y el pie de las paredes = volumen y lectura.
      for (let k = 0; k < 4; k++) {
        const v = d.c[k];
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
        aoV[k] = a;
      }
      if (greedy && aoV[0] === aoV[1] && aoV[1] === aoV[2] && aoV[2] === aoV[3]) {
        const bk = di * 8388608 + xyz[d.ax] + 4194304; // capas hasta ±4 M: alcanza de sobra
        let B = buckets.get(bk);
        if (!B) buckets.set(bk, B = []);
        B.push(xyz[d.u], xyz[d.w], cc * 4 + aoV[0]);
      } else Q.push(di, xyz[d.ax], xyz[d.u], xyz[d.w], 1, 1, cc, aoV[0], aoV[1], aoV[2], aoV[3]);
    }
  }
  if (greedy) {
    for (const [bk, B] of buckets) {
      const di = Math.floor(bk / 8388608), d = DIRS[di], L = bk % 8388608 - 4194304;
      let u0 = Infinity, w0 = Infinity, u1 = -Infinity, w1 = -Infinity;
      for (let i = 0; i < B.length; i += 3) {
        if (B[i] < u0) u0 = B[i]; if (B[i] > u1) u1 = B[i]; if (B[i + 1] < w0) w0 = B[i + 1]; if (B[i + 1] > w1) w1 = B[i + 1];
      }
      const W = u1 - u0 + 1, H = w1 - w0 + 1;
      const cell = new Int32Array(W * H).fill(-1);
      for (let i = 0; i < B.length; i += 3) cell[(B[i + 1] - w0) * W + B[i] - u0] = B[i + 2];
      for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
        const kk = cell[j * W + i];
        if (kk < 0) continue;
        let du = 1;
        while (i + du < W && cell[j * W + i + du] === kk) du++;
        let dw = 1;
        grow: while (j + dw < H) {
          const row = (j + dw) * W + i;
          for (let t = 0; t < du; t++) if (cell[row + t] !== kk) break grow;
          dw++;
        }
        for (let s = 0; s < dw; s++) cell.fill(-1, (j + s) * W + i, (j + s) * W + i + du);
        const a = kk & 3;
        Q.push(di, L, u0 + i, w0 + j, du, dw, kk >> 2, a, a, a, a);
      }
    }
  }

  // Uniones en T: si el borde de un rectángulo unido pasa por la esquina de otro, el rasterizado deja agujeritos de un
  // pixel entre los dos. Para que no pase, esas esquinas se agregan al borde y el rectángulo se dibuja en abanico.
  const KY = y1 - y0 + 2, KZ = z1 - z0 + 2;
  const vkey = (a, b, c) => ((a - x0) * KY + (b - y0)) * KZ + (c - z0);
  let corners = null;
  if (greedy) {
    corners = new Set();
    for (let i = 0; i < Q.length; i += 11) {
      const d = DIRS[Q[i]];
      for (let k = 0; k < 4; k++) {
        const v = d.c[k];
        q[d.ax] = Q[i + 1] + v[d.ax]; q[d.u] = Q[i + 2] + v[d.u] * Q[i + 4]; q[d.w] = Q[i + 3] + v[d.w] * Q[i + 5];
        corners.add(vkey(q[0], q[1], q[2]));
      }
    }
  }
  const ring = [];
  let quads = 0;
  const vert = (d, r, g, b) => {
    pos.push((q[0] + off[0]) * scale, (q[1] + off[1]) * scale, (q[2] + off[2]) * scale);
    nor.push(d.n[0], d.n[1], d.n[2]);
    col.push(r, g, b);
  };
  for (let i = 0; i < Q.length; i += 11) {
    const d = DIRS[Q[i]], L = Q[i + 1], u0 = Q[i + 2], w0 = Q[i + 3], du = Q[i + 4], dw = Q[i + 5], cc = Q[i + 6];
    const r = LIN[(cc >> 16) & 255], g = LIN[(cc >> 8) & 255], b = LIN[cc & 255];
    quads++;
    let extra = 0;
    if (du > 1 || dw > 1) {
      // recorrer el borde en el orden de las esquinas, juntando las esquinas ajenas que caen sobre él
      ring.length = 0;
      for (let k = 0; k < 4; k++) {
        const v = d.c[k], v2 = d.c[(k + 1) & 3];
        const cu = u0 + v[d.u] * du, cw = w0 + v[d.w] * dw;
        ring.push(cu, cw);
        const su = Math.sign(v2[d.u] - v[d.u]), sw = Math.sign(v2[d.w] - v[d.w]);
        const len = su ? du : dw;
        q[d.ax] = L + v[d.ax];
        for (let s = 1; s < len; s++) {
          q[d.u] = cu + su * s; q[d.w] = cw + sw * s;
          if (corners.has(vkey(q[0], q[1], q[2]))) { ring.push(q[d.u], q[d.w]); extra++; }
        }
      }
    }
    const base = pos.length / 3;
    if (extra) {
      // abanico desde el centro (el color es parejo: estos rectángulos tienen la misma oclusión en las 4 esquinas)
      const f = aoLevels[Q[i + 7]], n = ring.length / 2;
      q[d.ax] = L + d.c[0][d.ax];
      q[d.u] = u0 + du / 2; q[d.w] = w0 + dw / 2; vert(d, r * f, g * f, b * f);
      for (let k = 0; k < n; k++) { q[d.u] = ring[k * 2]; q[d.w] = ring[k * 2 + 1]; vert(d, r * f, g * f, b * f); }
      for (let k = 0; k < n; k++) idx.push(base, base + 1 + k, base + 1 + (k + 1) % n);
      continue;
    }
    for (let k = 0; k < 4; k++) {
      const v = d.c[k], f = aoLevels[Q[i + 7 + k]];
      q[d.ax] = L + v[d.ax]; q[d.u] = u0 + v[d.u] * du; q[d.w] = w0 + v[d.w] * dw;
      vert(d, r * f, g * f, b * f);
    }
    // partir el cuadrado por la diagonal más clara para que la sombra no se estire en diagonal
    if (Q[i + 7] + Q[i + 9] < Q[i + 8] + Q[i + 10]) idx.push(base + 1, base + 2, base + 3, base + 1, base + 3, base);
    else idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  return finish(pos, nor, col, idx, quads, faces);
}

function finish(pos, nor, col, idx, quads, faces) {
  const nv = pos.length / 3;
  return {
    position: new Float32Array(pos), normal: new Float32Array(nor), color: new Float32Array(col),
    index: nv > 65535 ? new Uint32Array(idx) : new Uint16Array(idx), quads, faces, verts: nv,
  };
}
