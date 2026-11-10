// Armado de piezas con kits modulares `.vox` (PLAN-FOTO, paso M2). Cada kit trae una tabla de módulos (su huella
// nominal y cuánto sobresale el dibujo) y recetas: listas de pasos que ubican, giran y espejan módulos en una grilla
// común. El resultado es una sola grilla (el mallado une las caras y la oclusión ve los encuentros entre módulos),
// separada en una malla por tipo de material.
//
//   const kit = await loadKit(MADERA_BASE, MADERA_PARTS);
//   const casa = await kitGroup(assembleKit(kit, MADERA_PARTS, CASA_MADERA_A), { light: r.light });
//
// assembleKit no usa three.js (corre en Node para las pruebas).

/** Índices reservados de la paleta (Regla de modelos de DESIGN.md). */
export const KIT_WINDOW = 245;

/**
 * Arma una receta. parts: { nombre: parseVox(...) }; table: { nombre: { size: [ancho, fondo], pad: { l, r, b, f, d } } };
 * recipe: pasos { part, at, rot, mirror } o { fill: [x, y, z, ancho, alto, fondo], index }.
 * Devuelve { data: Int32Array [x, y, z, color, ...], indices: Uint8Array, min, size, palette, materials } con la
 * grilla tal cual la receta (puede tener coordenadas negativas: aleros y zócalos que sobresalen).
 */
export function assembleKit(parts, table, recipe) {
  const cells = new Map(); // "x,y,z" → [x, y, z, índice]
  const put = (x, y, z, ci) => cells.set(x + ',' + y + ',' + z, [x, y, z, ci]);
  let ref = null;
  for (const step of recipe) {
    if (step.fill) {
      const [x0, y0, z0, w, h, d] = step.fill;
      for (let x = x0; x < x0 + w; x++) for (let y = y0; y < y0 + h; y++) for (let z = z0; z < z0 + d; z++) put(x, y, z, step.index);
      continue;
    }
    const p = parts[step.part], def = table[step.part];
    if (!p || !def) throw new Error('vox-kit: falta la pieza ' + step.part);
    ref = ref || p;
    const [nu, nw] = def.size, pad = def.pad || {};
    const q = (((step.rot || 0) % 4) + 4) % 4;
    const [ax, ay, az] = step.at;
    const { data, indices } = p;
    for (let i = 0; i < indices.length; i++) {
      // a coordenadas de la huella nominal
      let u = data[i * 4] - (pad.l || 0), w = data[i * 4 + 2] - (pad.b || 0);
      const y = data[i * 4 + 1] - (pad.d || 0);
      if (step.mirror) u = nu - 1 - u;
      const x = q === 0 ? u : q === 1 ? w : q === 2 ? nu - 1 - u : nw - 1 - w;
      const z = q === 0 ? w : q === 1 ? nu - 1 - u : q === 2 ? nw - 1 - w : u;
      put(ax + x, ay + y, az + z, indices[i]);
    }
  }
  if (!ref) throw new Error('vox-kit: la receta no usa ninguna pieza');
  const n = cells.size, data = new Int32Array(n * 4), indices = new Uint8Array(n);
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  let i = 0;
  for (const [x, y, z, ci] of cells.values()) {
    data[i * 4] = x; data[i * 4 + 1] = y; data[i * 4 + 2] = z; data[i * 4 + 3] = ref.palette[ci]; indices[i++] = ci;
    if (x < min[0]) min[0] = x; if (y < min[1]) min[1] = y; if (z < min[2]) min[2] = z;
    if (x > max[0]) max[0] = x; if (y > max[1]) max[1] = y; if (z > max[2]) max[2] = z;
  }
  return { data, indices, min, size: [max[0] - min[0] + 1, max[1] - min[1] + 1, max[2] - min[2] + 1], palette: ref.palette, materials: ref.materials };
}

/** Tipo de material de un índice de la paleta: 'window' por índice reservado; el resto, por los flags del archivo. */
export function kitKind(index, materials) {
  if (index === KIT_WINDOW) return 'window';
  const m = materials[index];
  return !m ? 'solid' : m.emissive > 0 ? 'glow' : m.water ? 'water' : m.glass ? 'glass' : m.metal > 0.5 && (m.rough ?? 1) < 0.7 ? 'metal' : 'solid';
}

/** Baja los `.vox` de un kit (en el navegador). Devuelve { nombre: parseVox(...) }. */
export async function loadKit(base, table, names = Object.keys(table)) {
  const { parseVox } = await import('./vox-loader.js');
  const out = {};
  await Promise.all(names.map(async (name) => {
    const res = await fetch(base + name + '.vox');
    if (!res.ok) throw new Error(`vox-kit: no se pudo bajar ${base}${name}.vox (${res.status})`);
    out[name] = parseVox(await res.arrayBuffer());
  }));
  return out;
}

/**
 * De una pieza armada a un THREE.Group con una malla por tipo de material, en unidades de mundo (o.scale, 1/16 por
 * defecto). El origen del grupo es el (0, 0, 0) de la receta, o el centro de `o.footprint` [ancho, fondo] en x/z
 * si se pasa. o.light: el volumen del render fotográfico (r.light) para metal y vidrio; sin él van como sólidos.
 */
export async function kitGroup(asm, o = {}) {
  const THREE = await import('three');
  const { Voxels, voxelMaterial, glowMaterial, windowMaterial } = await import('./voxel.js');
  const scale = o.scale ?? 1 / 16, L = o.light || null;
  const byKind = new Map();
  for (let i = 0; i < asm.indices.length; i++) {
    let kind = kitKind(asm.indices[i], asm.materials);
    if (!L && (kind === 'metal' || kind === 'glass')) kind = 'solid';
    let v = byKind.get(kind);
    if (!v) byKind.set(kind, v = new Voxels());
    v.set(asm.data[i * 4], asm.data[i * 4 + 1], asm.data[i * 4 + 2], asm.data[i * 4 + 3]);
  }
  const mats = { solid: voxelMaterial(), glow: glowMaterial(), window: windowMaterial() };
  const g = new THREE.Group();
  const [fx, fz] = o.footprint || [0, 0];
  for (const [kind, v] of byKind) {
    const mesh = new THREE.Mesh(v.toGeometry({ scale }), mats[kind] || L.material(kind));
    mesh.position.set(-fx / 2 * scale, 0, -fz / 2 * scale);
    mesh.castShadow = kind === 'solid' || kind === 'metal'; mesh.receiveShadow = true;
    mesh.userData.kitKind = kind;
    g.add(mesh);
  }
  g.userData.kit = { voxels: asm.indices.length, size: asm.size, kinds: [...byKind.keys()] };
  return g;
}
