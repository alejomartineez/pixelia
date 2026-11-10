// Jefes del Acto 1 (plan §M1 y §M2; paso 6b): la bestia del Bañado y la capitana pirata, gente-zorro del Céfiro.
// La bestia es vóxel, con el mismo tamaño de vóxel que el grupo (pasada visual del combate: el facetado rompía el estilo);
// la capitana sigue en low-poly facetado. Los dos usan voxelMaterial (luz plana y colores por vértice), así el contorno
// tinta de createPixelRenderer sale solo. Los ojos y las vetas de Marea brillan (MeshBasicMaterial).
//
//   bossModel(type, { phase }) -> THREE.Group | null   (null si el tipo no es jefe: la escena usa enemyModel)
//     origen en el centro de la casilla, base en y = 0, mira a +Z (mismo contrato que enemy-models.js)
//     group.userData.update(dt, moving, t)   respira y mueve la cabeza
//     group.userData.setPhase(k)             fase 2 del jefe (≤ 50 % de vida): la bestia se enciende, la capitana alza el sable
//     group.userData.height / .scale
//
// La capitana se arma en unidades de 1/8 de casilla y se escala al final, con el kit facetado del 4a
// (src/avatar/lowpoly.js: rampa de tono por orientación y oclusión falsa abajo). enemyModel('bestia') devuelve esta misma.
import * as THREE from 'three';
import { Facets } from '../avatar/lowpoly.js';
import { Voxels, voxelMaterial, hexToInt } from '../core/voxel.js';
import { AVATAR_VOXEL, hash3 } from '../avatar/avatar-kit.js';

const VOX = 1 / 8;

// ---------- paletas (terrosas y apagadas, M1; un acento por jefe) ----------
const P = {
  ink: '#16110e', bone: '#d8cfb8', bone_d: '#a89e86',
  moss: '#3d5236', moss_d: '#2b3a27', moss_l: '#55703f', mud: '#4a3b2a', mud_d: '#33281c', reed: '#7c7440', reed_l: '#9a8e52',
  marea: '#7fe8d8', marea_hot: '#c8fff4', beast_eye: '#d8ff7a', maw: '#2a1712',
  fox: '#a8562c', fox_d: '#7d3d1f', fox_l: '#c47a45', cream: '#e2d6bd', coat: '#5a1c22', coat_d: '#3d1217', gold: '#c9a04a', gold_d: '#94732f',
  brass: '#a98a45', iron: '#7c8086', iron_d: '#4f5257', leather: '#3a2a20', boot: '#1f1814', shirt: '#2c2529', hat: '#231b1c',
  feather: '#d6cec0', fox_eye: '#ffc35a',
};

// ---------- la bestia del Bañado (vóxel) ----------
// La Madre del Agua de los Anuros: lomo encorvado de barro y musgo, juncos en la espalda, cuatro ojos y vetas de Marea
// suelta que le corren por el lomo (en la fase 2 se encienden y le brilla la boca). Se arma en vóxeles del mismo tamaño
// que los de la gente (AVATAR_VOXEL, 24 por casilla) con voxelMaterial: el contorno tinta y la oclusión salen iguales que
// en el grupo. Las geometrías se arman una vez y se comparten; cada bestia tiene sus propios materiales que brillan.
const BV = AVATAR_VOXEL;
let beastGeo = null;
function beastGeometry() {
  if (beastGeo) return beastGeo;
  const body = new Voxels(), head = new Voxels(), veins = new Voxels(), eyes = new Voxels(), maw = new Voxels();
  const skin = (x, y, z) => {
    if (y < 6) return hash3(x >> 1, y >> 1, z >> 1) < 0.5 ? P.mud : P.mud_d;
    const h = hash3(x >> 2, y >> 2, z >> 2);
    if (y > 27 && h < 0.35) return P.moss_d;
    return h < 0.16 ? P.moss_l : h < 0.42 ? P.moss_d : P.moss;
  };
  const limb = (v, a, b, r0, r1, color) => {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]), n = Math.max(2, Math.ceil(L / 1.5));
    for (let i = 0; i <= n; i++) {
      const t = i / n, r = r0 + (r1 - r0) * t;
      v.sphere(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, r, r, r, color);
    }
  };
  // cuerpo: panza ancha y baja, joroba atrás
  body.sphere(0, 14, -1, 17, 11.5, 19, skin);
  body.sphere(0, 22, -6, 13, 9.5, 13, skin);
  // patas: adelante con garras de hueso, atrás más cortas y gruesas
  for (const s of [-1, 1]) {
    limb(body, [s * 13, 11, 10], [s * 16, 2, 17], 5, 3.4, skin);
    body.sphere(s * 16, 2, 18.5, 4.5, 2.4, 4.8, (x, y, z) => (hash3(x, y, z) < 0.5 ? P.mud_d : P.mud));
    body.clear(s * 16 - 6, -4, 12, 12, 4, 14);
    for (const k of [-1, 0, 1]) { const x = Math.round(s * 16 + k * 2.4); body.box(x, 0, 22, 1, 2, 2, P.bone); body.set(x, 0, 24, P.bone_d); }
    limb(body, [s * 12, 10, -12], [s * 14, 2, -14], 5.4, 3.8, skin);
    body.sphere(s * 14, 2, -13.5, 4.4, 2.4, 4.4, P.mud_d);
  }
  body.clear(-24, -6, -40, 48, 6, 70);
  // cola gruesa que se arrastra
  limb(body, [0, 10, -18], [2, 4.5, -28], 6.2, 3.4, skin);
  limb(body, [2, 4.5, -28], [5, 1.5, -34], 3.4, 1.2, P.mud);
  // juncos que le crecen en el lomo (con la punta clara)
  for (const [x, z, h, lean] of [[-6, -9, 13, -2], [2, -11, 16, 1], [7, -5, 11, 3], [-2, -1, 10, -1], [5, -15, 12, 1], [-9, -3, 8, -3]]) {
    let y0 = 34; while (y0 > 0 && !body.has(x, y0, z)) y0--;
    for (let i = 0; i < h; i++) {
      const xx = x + Math.round(lean * i / h);
      body.set(xx, y0 + 1 + i, z, i > h - 4 ? P.reed_l : P.reed);
    }
    body.set(x + lean + (lean >= 0 ? 1 : -1), y0 + h - 1, z, P.reed_l);
  }
  // vetas de Marea: se cavan en la superficie del lomo (la celda pasa del cuerpo a la malla que brilla)
  const carveTop = (x, z) => { let y = 36; while (y > 4 && !body.has(x, y, z)) y--; if (y > 4 && body.get(x, y, z) !== hexToInt(P.reed) && body.get(x, y, z) !== hexToInt(P.reed_l)) { body.remove(x, y, z); veins.set(x, y, z, '#ffffff'); } };
  for (const [x0, z0, dx, dz, n] of [[-4, 2, 0.5, -1, 12], [3, 0, -0.3, -1, 14], [8, -2, 0.6, -0.8, 8], [-9, -4, -0.6, -0.8, 8], [0, -16, 0.4, -1, 6]]) {
    for (let i = 0; i < n; i++) { const x = Math.round(x0 + dx * i + Math.sin(i * 0.9) * 0.8), z = Math.round(z0 + dz * i); carveTop(x, z); if (i % 3 === 0) carveTop(x + 1, z); }
  }
  // cabeza (pivote en el cuello, mira a +Z): cráneo ancho, ceño pesado y la boca abierta con colmillos
  const hs = (x, y, z) => (y > 3 ? (hash3(x >> 2, y >> 2, z >> 2) < 0.4 ? P.moss_d : P.moss) : P.moss);
  head.sphere(0, 1, 5, 11, 6.5, 9.5, hs);
  head.box(-8, 4, 10, 16, 3, 4, P.moss_d);   // ceño
  head.sphere(0, -5, 8, 9.5, 3.2, 8, P.moss_d);   // mandíbula
  // boca: la raja entre el cráneo y la mandíbula, oscura y con la lengua (que brilla en la fase 2)
  for (let x = -7; x <= 7; x++) for (let z = 6; z <= 16; z++) for (let y = -3; y <= -1; y++) {
    if (!head.has(x, y, z)) continue;
    const inside = Math.abs(x) < 7 - (z > 13 ? (z - 13) : 0);
    if (!inside) continue;
    head.remove(x, y, z);
    if (y === -3 && z < 14 && Math.abs(x) < 5) maw.set(x, y, z, '#ffffff'); else head.set(x, y, z, P.ink);
  }
  // colmillos: arriba bajan, abajo suben
  for (const x of [-6, -3, 3, 6]) { head.set(x, -1, 15, P.bone); head.set(x, -2, 15, P.bone); }
  for (const x of [-5, 5]) { head.set(x, -3, 15, P.bone_d); head.set(x, -2, 14, P.bone_d); }
  // cuatro ojos: dos grandes al frente y dos chicos a los costados
  for (const [x, y, z] of [[-4, 4, 13], [3, 4, 13], [-8, 2, 11], [7, 2, 11]]) for (let dx = 0; dx < 2; dx++) {
    let zz = z + 4; while (zz > z - 4 && !head.has(x + dx, y, zz)) zz--;
    head.remove(x + dx, y, zz); eyes.set(x + dx, y, zz, '#ffffff');
  }
  head.clear(-1, 7, 0, 2, 2, 4);   // muesca en la frente
  const geo = (v, ao = true) => v.toGeometry({ scale: BV, ao, jitter: ao ? 0.02 : 0 });
  beastGeo = { body: geo(body), veins: geo(veins, false), head: geo(head), eyes: geo(eyes, false), maw: geo(maw, false) };
  return beastGeo;
}
function beast() {
  const G = beastGeometry();
  const g = new THREE.Group();
  const mesh = (geo, mat) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; return m; };
  const torso = new THREE.Group();
  torso.add(mesh(G.body, voxelMaterial()));
  const veinMat = new THREE.MeshBasicMaterial({ color: P.marea });
  torso.add(mesh(G.veins, veinMat));
  g.add(torso);
  const head = new THREE.Group();
  head.position.set(0, 15 * BV, 15 * BV);
  head.add(mesh(G.head, voxelMaterial()));
  const eyeMat = new THREE.MeshBasicMaterial({ color: P.beast_eye });
  head.add(mesh(G.eyes, eyeMat));
  const mawMat = new THREE.MeshBasicMaterial({ color: P.maw });
  head.add(mesh(G.maw, mawMat));
  g.add(head);
  const cDim = new THREE.Color(P.marea), cHot = new THREE.Color(P.marea_hot), cMaw = new THREE.Color(P.maw), cVein = new THREE.Color();
  let phase = 0;
  g.userData.setPhase = (k) => { phase = k; };
  g.userData.update = (dt, moving, t) => {
    torso.scale.y = 1 + Math.sin(t * 1.1) * 0.02;
    head.rotation.x = -0.04 + Math.sin(t * 0.9) * 0.06 + (phase ? Math.sin(t * 3.2) * 0.04 : 0);
    head.rotation.y = Math.sin(t * 0.5) * 0.1;
    const glow = phase ? 0.7 + Math.sin(t * 4.0) * 0.3 : 0.35 + Math.sin(t * 1.6) * 0.15;
    cVein.copy(cMaw).lerp(phase ? cHot : cDim, Math.min(1, 0.45 + glow * 0.55));
    veinMat.color.copy(cVein);
    mawMat.color.copy(cMaw).lerp(cHot, phase ? glow : 0);
  };
  return { g, height: 43, unit: BV };
}

// ---------- la capitana ----------
// Gente-zorro del Céfiro (M2): saco largo rojo oscuro con dorado, tricornio con pluma, brazo de bronce con la pistola y el
// sable en la otra mano. En la fase 2 (el abordaje) alza el sable y se le encienden los ojos.
function captain() {
  const g = new THREE.Group();
  const f = new Facets();
  // piernas y botas
  for (const s of [-1, 1]) {
    f.limb([s * 0.95, 4.4, 0], [s * 1.0, 1.4, 0.1], 0.75, 0.62, P.shirt, 5);
    f.box(s * 1.0, 0.75, 0.35, 1.5, 1.5, 2.2, P.boot, { taper: 0.9 });
    f.box(s * 1.0, 1.75, 0.15, 1.6, 0.5, 1.7, P.leather);
  }
  // saco largo: falda abierta adelante, torso, solapas y ruedo dorado
  f.box(0, 4.0, -0.1, 4.6, 3.4, 2.8, (y) => (y < 2.6 ? P.coat_d : P.coat), { taper: 0.82 });
  f.box(0, 2.45, -0.1, 4.9, 0.4, 3.0, P.gold_d);
  f.box(0, 7.3, 0, 4.0, 3.6, 2.4, P.coat, { taper: 0.92 });
  f.box(0, 7.1, 1.15, 1.5, 3.0, 0.3, P.shirt);
  for (const s of [-1, 1]) f.box(s * 0.95, 7.6, 1.2, 0.5, 2.6, 0.32, P.gold, { rot: [0, 0, s * 0.18] });
  f.box(0, 5.6, 0.05, 4.2, 0.6, 2.6, P.leather);
  f.box(0, 5.6, 1.35, 0.8, 0.7, 0.2, P.gold);
  // charreteras
  for (const s of [-1, 1]) f.blob(s * 2.15, 9.0, 0, 0.95, 0.42, 0.95, P.gold, { detail: 0, seed: 4 + s });
  g.add(f.mesh());
  // brazo izquierdo de bronce con la pistola (fijo)
  const left = new Facets();
  left.limb([2.35, 8.6, 0], [2.7, 6.0, 0.6], 0.62, 0.5, P.brass, 5);
  left.limb([2.7, 6.0, 0.6], [2.6, 5.6, 2.3], 0.5, 0.42, P.brass, 5);
  left.box(2.6, 5.7, 3.2, 0.5, 0.6, 1.8, P.iron_d);
  left.box(2.6, 5.15, 2.6, 0.42, 0.9, 0.5, P.leather);
  g.add(left.mesh());
  // brazo derecho con el sable: parte animada (lo alza en la fase 2)
  const arm = new THREE.Group();
  arm.position.set(-2.35, 8.6, 0);
  const af = new Facets();
  af.limb([0, 0, 0], [-0.3, -2.6, 0.6], 0.66, 0.52, P.coat, 5);
  af.box(-0.3, -2.75, 0.6, 1.0, 0.5, 1.0, P.gold_d);
  af.limb([-0.3, -2.9, 0.6], [-0.35, -3.7, 1.2], 0.46, 0.4, P.fox_d, 5);
  af.box(-0.35, -3.85, 1.4, 1.2, 0.3, 0.5, P.gold);                       // guarda
  af.box(-0.35, -3.85, 4.0, 0.16, 0.5, 4.8, P.iron, { rot: [0.18, 0, 0] }); // hoja
  arm.add(af.mesh());
  g.add(arm);
  // cabeza de zorro: parte animada
  const head = new THREE.Group();
  head.position.set(0, 10.1, 0.1);
  const hf = new Facets();
  hf.blob(0, 0.9, 0, 1.75, 1.6, 1.6, (y) => (y < 10.4 ? P.fox_d : P.fox), { seed: 9, detail: 1, jit: 0.08 });
  hf.limb([0, 0.55, 1.0], [0, 0.25, 3.0], 0.95, 0.26, P.fox_l, 5);            // hocico
  hf.blob(0, 0.05, 1.7, 1.15, 0.6, 1.0, P.cream, { detail: 0, seed: 2 });     // quijada clara
  hf.blob(0, 0.42, 3.05, 0.26, 0.22, 0.22, P.ink, { detail: 0 });             // nariz
  for (const s of [-1, 1]) {
    hf.spike([s * 1.0, 2.0, -0.1], [s * 1.35, 3.6, -0.3], 0.55, P.fox_d);     // orejas
    hf.box(s * 1.1, 1.3, 1.15, 0.9, 0.24, 0.4, P.fox_d, { rot: [0, 0, s * -0.25] });   // ceño
  }
  // cicatriz en el hocico
  hf.box(0.45, 0.75, 2.2, 0.12, 0.12, 1.1, P.cream, { rot: [0, 0.35, 0] });
  // tricornio con pluma
  hf.box(0, 2.6, 0, 4.0, 0.42, 3.6, P.hat, { taper: 0.92 });
  hf.box(0, 3.2, -0.1, 2.3, 1.1, 2.1, P.hat, { taper: 0.8 });
  hf.box(0, 2.85, 0, 2.4, 0.22, 2.2, P.gold_d);
  hf.limb([0.9, 3.1, -0.4], [2.4, 4.6, -1.6], 0.28, 0.08, P.feather, 4);
  head.add(hf.mesh());
  const eyes = new Facets({ ao: false, vary: 0, tone: false });
  for (const s of [-1, 1]) eyes.blob(s * 0.72, 1.0, 1.35, 0.22, 0.16, 0.1, '#ffffff', { detail: 0, jit: 0 });
  const eyeMat = new THREE.MeshBasicMaterial({ color: P.fox_eye });
  head.add(new THREE.Mesh(eyes.geometry(), eyeMat));
  g.add(head);
  // cola de zorro que asoma bajo el saco
  const tail = new Facets();
  tail.limb([0, 3.4, -1.4], [0.4, 1.8, -3.2], 0.9, 0.7, P.fox, 6);
  tail.limb([0.4, 1.8, -3.2], [0.9, 1.4, -4.2], 0.7, 0.2, P.cream, 6);
  const tailMesh = tail.mesh();
  g.add(tailMesh);
  let phase = 0, raise = 0;
  g.userData.setPhase = (k) => { phase = k; };
  g.userData.update = (dt, moving, t) => {
    raise += ((phase ? 1 : 0) - raise) * Math.min(1, (dt || 0.016) * 3);
    arm.rotation.x = -raise * 1.6 + Math.sin(t * 1.4) * 0.05;
    arm.rotation.z = -raise * 0.25;
    head.rotation.y = Math.sin(t * 0.6) * 0.16;
    head.rotation.x = Math.sin(t * 1.3) * 0.03;
    tailMesh.rotation.y = Math.sin(t * 1.8) * 0.12;
    eyeMat.color.set(phase ? '#ffe08a' : P.fox_eye);
  };
  return { g, height: 15, footprint: 8 };
}

const BUILD = { bestia: beast, capitana: captain };
/** Escala por jefe: la bestia ya viene a su tamaño (ocupa más que su casilla), la capitana como una persona alta. */
const SCALE = { bestia: 1, capitana: 0.98 };
export const BOSS_TYPES = Object.keys(BUILD);

/** Modelo de un jefe (la bestia en vóxel, la capitana en low-poly), o null si `type` no es uno. */
export function bossModel(type, { phase = 0 } = {}) {
  const build = BUILD[type];
  if (!build) return null;
  const { g: inner, height, unit } = build();
  const g = new THREE.Group();
  const u = unit || VOX;
  if (!unit) inner.scale.setScalar(VOX);   // la capitana se arma en 1/8 y se escala; la bestia ya viene en AVATAR_VOXEL
  g.add(inner);
  const s = SCALE[type] || 1;
  g.scale.setScalar(s);
  g.userData.scale = s;
  g.userData.height = height * u * s;
  g.userData.type = type;
  if (unit) g.userData.voxel = true; else g.userData.lowpoly = true;
  g.userData.update = (dt, moving, t) => inner.userData.update?.(dt, moving, t ?? performance.now() / 1000);
  g.userData.setPhase = (k) => inner.userData.setPhase?.(k);
  if (phase) inner.userData.setPhase(phase);
  g.name = 'boss:' + type;
  return g;
}
