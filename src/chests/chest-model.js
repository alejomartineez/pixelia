// Modelos vóxel de los cofres (madera, plata, oro, real).
// chestModel(type) -> THREE.Group con base en y=0, ~1 unidad de ancho, frente (cerradura) hacia +Z.
//   group.userData.lid      pivote de la tapa (en la bisagra de atrás): lid.rotation.x = -ángulo abre el cofre
//   group.userData.height   alto total en unidades de mundo
//   group.userData.update(dt, t)  brillos animados (solo el cofre real tiene)
import * as THREE from 'three';
import { Voxels, shade } from '../core/voxel.js';
import { CHESTS } from './chests.js';

const S = 1 / 16;          // 16 vóxeles de ancho = 1 unidad
const W = 16, D = 12, BH = 8; // ancho, profundidad, alto de la base (en vóxeles)
const INK = '#3b2340';

// pseudo-aleatorio determinístico (mismo cofre siempre igual)
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

// perfil arqueado de la tapa: alto extra por fila de profundidad z (0 = atrás, D-1 = adelante)
const LID_TOP = [3, 4, 4, 5, 5, 5, 5, 5, 5, 4, 4, 3]; // altura de la tapa (y relativo a BH) por z

function palette(type) {
  const def = CHESTS[type] || CHESTS.madera;
  const body = def.color, trim = def.trim;
  return {
    type, body, trim,
    bodyD: shade(body, -0.2), bodyDD: shade(body, -0.38), bodyL: shade(body, 0.18),
    trimD: shade(trim, -0.25), trimL: shade(trim, 0.4),
    inside: shade(body, -0.55),
  };
}

function buildBase(p) {
  const v = new Voxels();
  const wood = p.type === 'madera';
  // patas
  for (const [fx, fz] of [[0, 0], [W - 2, 0], [0, D - 2], [W - 2, D - 2]]) v.box(fx, 0, fz, 2, 1, 2, p.trimD);
  // cuerpo
  v.box(0, 1, 0, W, BH - 1, D, (x, y, z) => {
    if (wood) {
      // tablones horizontales con juntas
      if (y % 3 === 0) return p.bodyD;
      if ((x + y * 5) % 11 === 0 && (z === 0 || z === D - 1)) return p.bodyD;
      return p.body;
    }
    // metal: paneles con borde claro arriba y sombra abajo
    if (y === BH - 2) return p.bodyL;
    if (y === 2) return p.bodyD;
    return p.body;
  });
  // hueco interior + tesoro
  v.clear(1, 3, 1, W - 2, BH - 3, D - 2);
  v.box(1, 2, 1, W - 2, 1, D - 2, p.inside);
  const r = rng(7 + p.type.length);
  const gemCols = ['#ff7eb6', '#8fd3ff', '#b58cff', '#6fe3c1', '#ffffff'];
  for (let x = 1; x < W - 1; x++) for (let z = 1; z < D - 1; z++) {
    const dx = (x - (W - 1) / 2) / (W / 2), dz = (z - (D - 1) / 2) / (D / 2);
    const hgt = Math.round(3 + 2.6 * (1 - dx * dx - dz * dz * 0.8) + r() * 0.8);
    for (let y = 3; y < Math.min(BH, 3 + hgt - 2); y++) v.set(x, y, z, (x + z + y) % 3 ? '#ffd166' : '#e8a93a');
    const top = Math.min(BH - 1, 3 + hgt - 3);
    if (r() < 0.12 && top >= 3) v.set(x, top, z, gemCols[Math.floor(r() * gemCols.length)]);
  }
  // aros de metal: arriba y abajo (sobresalen 1 vóxel)
  for (const y of [1, BH - 1]) {
    for (let x = 0; x < W; x++) { v.set(x, y, D, p.trim); v.set(x, y, -1, p.trim); }
    for (let z = 0; z < D; z++) { v.set(-1, y, z, p.trim); v.set(W, y, z, p.trim); }
  }
  // bandas verticales (frente y atrás)
  for (const bx of [3, W - 4]) for (let y = 1; y < BH; y++) {
    v.set(bx, y, D, p.trim);
    v.set(bx, y, -1, p.trimD);
  }
  // remaches (solo madera y plata: en los metálicos claros ensucian)
  if (p.type === 'madera' || p.type === 'plata') for (const bx of [3, W - 4]) v.set(bx, 4, D + 1, p.trimL);
  // manijas laterales
  for (const sx of [-2, W + 1]) {
    v.box(sx, 4, 4, 1, 1, 4, p.trimD);
    v.set(sx, 3, 4, p.trimD); v.set(sx, 3, 7, p.trimD);
    v.set(sx - Math.sign(sx) * 0, 4, 5, p.trimL);
  }
  // cerradura
  v.box(6, 2, D, 4, 5, 1, p.trim);
  v.box(6, 2, D + 1, 4, 1, 1, p.trimD);
  v.box(6, 3, D, 4, 3, 1, p.trimD);
  v.set(7, 4, D + 1, INK); v.set(8, 4, D + 1, INK); v.set(7, 3, D + 1, p.trimD); v.set(8, 3, D + 1, p.trimD);
  if (p.type === 'oro' || p.type === 'real') {
    v.set(7, 5, D + 1, p.type === 'real' ? '#8fd3ff' : '#ff7eb6');
    v.set(8, 5, D + 1, p.type === 'real' ? '#8fd3ff' : '#ff7eb6');
  }
  // brillito en el frente (pixel de luz)
  if (!wood) { v.set(1, BH - 2, D, p.trimL); v.set(W - 2, 3, D, p.trimL); }
  return v;
}

function buildLid(p) {
  const v = new Voxels();
  const wood = p.type === 'madera';
  const yb = BH;
  for (let z = 0; z < D; z++) {
    const top = LID_TOP[z];
    for (let y = 0; y < top; y++) for (let x = 0; x < W; x++) {
      let c;
      if (wood) c = z % 4 === 0 && y === top - 1 ? p.bodyD : (y === 0 ? p.bodyD : p.body);
      else c = y === top - 1 ? p.bodyL : (y === 0 ? p.bodyD : p.body);
      v.set(x, yb + y, z, c);
    }
  }
  // parte de abajo de la tapa (interior oscuro)
  v.box(1, yb, 1, W - 2, 1, D - 2, p.inside);
  // aro inferior de la tapa
  for (let x = 0; x < W; x++) { v.set(x, yb, D, p.trim); v.set(x, yb, -1, p.trimD); }
  for (let z = 0; z < D; z++) { v.set(-1, yb, z, p.trim); v.set(W, yb, z, p.trim); }
  // bandas que siguen el arco
  for (const bx of [3, W - 4]) {
    const col = p.trim;
    for (let z = 0; z < D; z++) v.set(bx, yb + LID_TOP[z], z, col);
    for (let y = 0; y <= LID_TOP[D - 1]; y++) v.set(bx, yb + y, D, col);
    for (let y = 0; y <= LID_TOP[0]; y++) v.set(bx, yb + y, -1, p.trimD);
  }
  // remaches
  // pasador de la cerradura (cuelga sobre la placa)
  v.box(7, yb - 2, D + 2, 2, 4, 1, p.trim);
  v.set(7, yb - 2, D + 2, p.trimD); v.set(8, yb - 2, D + 2, p.trimD);
  v.box(7, yb + 1, D, 2, 2, 2, p.trim);

  // decoración por tipo
  const midTop = (z) => yb + LID_TOP[z];
  if (p.type === 'plata') {
    // gemas celestes en las bandas y una estrella arriba
    for (const bx of [3, W - 4]) v.set(bx, midTop(6) + 1, 6, '#8fd3ff');
    v.set(7, midTop(6), 6, '#ffffff'); v.set(8, midTop(6), 6, '#ffffff');
    v.set(7, midTop(5), 5, '#8fd3ff'); v.set(8, midTop(7), 7, '#8fd3ff');
  }
  if (p.type === 'oro') {
    // corazón rosa sobre la tapa + gemas de colores en las bandas
    const heart = ['.xx..xx.', 'xxxxxxxx', 'xxxxxxxx', '.xxxxxx.', '..xxxx..', '...xx...'];
    heart.forEach((row, i) => [...row].forEach((ch, j) => {
      if (ch === 'x') { const z = 2 + i, x = 4 + j; v.set(x, midTop(z), z, i === 1 && j === 1 ? '#ffffff' : '#ff7eb6'); }
    }));
    const gems = ['#8fd3ff', '#6fe3c1', '#b58cff', '#ff7eb6'];
    [3, W - 4].forEach((bx, i) => { v.set(bx, midTop(3) + 1, 3, gems[i]); v.set(bx, midTop(8) + 1, 8, gems[i + 2]); });
    // gema frontal
    v.set(7, yb + 2, D + 1, '#8fd3ff'); v.set(8, yb + 2, D + 1, '#8fd3ff');
  }
  if (p.type === 'real') {
    // corona dorada arriba
    const gold = '#ffd166', goldD = '#e8a93a';
    const cy = yb + 5;
    for (let x = 4; x < 12; x++) for (let z = 3; z < 9; z++) {
      const edge = x === 4 || x === 11 || z === 3 || z === 8;
      if (edge) { v.set(x, cy, z, goldD); v.set(x, cy + 1, z, gold); }
    }
    // picos
    for (const [x, z] of [[4, 3], [11, 3], [4, 8], [11, 8], [7, 8], [8, 8], [7, 3], [8, 3], [4, 5], [4, 6], [11, 5], [11, 6]]) v.set(x, cy + 2, z, gold);
    for (const [x, z] of [[4, 3], [11, 3], [4, 8], [11, 8]]) v.set(x, cy + 3, z, '#ff7eb6');
    v.set(7, cy + 3, 8, '#8fd3ff'); v.set(8, cy + 3, 8, '#8fd3ff');
    // gemas de la corona
    v.set(7, cy + 1, 8, '#8fd3ff'); v.set(8, cy + 1, 8, '#8fd3ff');
    v.set(5, cy + 1, 8, '#ff7eb6'); v.set(10, cy + 1, 8, '#ff7eb6');
    v.set(4, cy + 1, 5, '#b58cff'); v.set(11, cy + 1, 6, '#6fe3c1');
    v.set(7, yb + 2, D + 1, '#ff7eb6'); v.set(8, yb + 2, D + 1, '#ff7eb6');
  }
  return v;
}

/** Brillitos (estrellas de 3 vóxeles) que titilan alrededor del cofre real. */
function addSparkles(group) {
  const geo = new THREE.BoxGeometry(S, S, S);
  const matW = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const matG = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  const sparkles = [];
  const spots = [[-0.7, 0.78, 0.3], [0.72, 1.0, 0.1], [0.62, 0.3, 0.55], [-0.45, 1.25, -0.1], [-0.74, 0.25, 0.45]];
  spots.forEach((pos, i) => {
    const s = new THREE.Group();
    const mat = i % 2 ? matG : matW;
    for (const [x, y] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x * S, y * S, 0);
      s.add(m);
    }
    s.position.set(...pos);
    s.userData.phase = i * 1.37;
    sparkles.push(s);
    group.add(s);
  });
  return (dt, t) => {
    for (const s of sparkles) {
      const k = Math.max(0, Math.sin(t * 2.6 + s.userData.phase));
      s.scale.setScalar(0.15 + k * 0.75);
      s.visible = k > 0.05;
    }
  };
}

/** Cofre vóxel. type: 'madera' | 'plata' | 'oro' | 'real' */
export function chestModel(type = 'madera') {
  const p = palette(CHESTS[type] ? type : 'madera');
  const group = new THREE.Group();
  group.name = 'chest-' + p.type;

  const baseGeo = buildBase(p).toGeometry({ scale: S, jitter: p.type === 'madera' ? 0.05 : 0.025 });
  baseGeo.translate(-W / 2 * S, 0, -D / 2 * S);
  const base = new THREE.Mesh(baseGeo, new THREE.MeshLambertMaterial({ vertexColors: true }));
  base.name = 'base';
  group.add(base);

  const lidGeo = buildLid(p).toGeometry({ scale: S, jitter: p.type === 'madera' ? 0.05 : 0.025 });
  lidGeo.translate(-W / 2 * S, -BH * S, 0); // origen en la bisagra (borde de atrás, arriba de la base)
  const lidMesh = new THREE.Mesh(lidGeo, base.material);
  lidMesh.name = 'lid-mesh';
  const lid = new THREE.Group();
  lid.name = 'lid';
  lid.position.set(0, BH * S, -D / 2 * S);
  lid.add(lidMesh);
  group.add(lid);

  group.userData.lid = lid;
  group.userData.height = (BH + 5 + (p.type === 'real' ? 4 : 0)) * S;
  group.userData.type = p.type;
  group.userData.materials = [base.material];
  if (p.type === 'real') group.userData.update = addSparkles(group);
  else group.userData.update = null;
  return group;
}
