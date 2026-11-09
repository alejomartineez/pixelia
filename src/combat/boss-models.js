// Jefes del Acto 1 en low-poly facetado (plan §M1 y §M2; paso 6b): la bestia del Bañado y la capitana pirata, gente-zorro
// del Céfiro. Caras planas en ángulo para que se distingan de inmediato de las unidades vóxel y se sientan pesados. Usan
// el mismo material que los vóxeles (voxelMaterial: luz plana y colores por vértice), así el contorno tinta de
// createPixelRenderer sale solo. Los ojos y las vetas de Marea brillan (MeshBasicMaterial).
//
//   bossModel(type, { phase }) -> THREE.Group | null   (null si el tipo no es jefe: la escena usa enemyModel)
//     origen en el centro de la casilla, base en y = 0, mira a +Z (mismo contrato que enemy-models.js)
//     group.userData.update(dt, moving, t)   respira y mueve la cabeza
//     group.userData.setPhase(k)             fase 2 del jefe (≤ 50 % de vida): la bestia se enciende, la capitana alza el sable
//     group.userData.height / .scale
//
// Se arma en "vóxeles" (8 por casilla, como el resto) y se escala al final, con el kit facetado del 4a
// (src/avatar/lowpoly.js: rampa de tono por orientación y oclusión falsa abajo). enemyModel('bestia') devuelve esta misma.
import * as THREE from 'three';
import { Facets } from '../avatar/lowpoly.js';

const VOX = 1 / 8;

// ---------- paletas (terrosas y apagadas, M1; un acento por jefe) ----------
const P = {
  ink: '#16110e', bone: '#d8cfb8', bone_d: '#a89e86',
  moss: '#3d5236', moss_d: '#2b3a27', moss_l: '#55703f', mud: '#4a3b2a', mud_d: '#33281c', reed: '#7c7440', reed_l: '#9a8e52',
  marea: '#7fe8d8', marea_hot: '#c8fff4', beast_eye: '#d8ff7a',
  fox: '#a8562c', fox_d: '#7d3d1f', fox_l: '#c47a45', cream: '#e2d6bd', coat: '#5a1c22', coat_d: '#3d1217', gold: '#c9a04a', gold_d: '#94732f',
  brass: '#a98a45', iron: '#7c8086', iron_d: '#4f5257', leather: '#3a2a20', boot: '#1f1814', shirt: '#2c2529', hat: '#231b1c',
  feather: '#d6cec0', fox_eye: '#ffc35a',
};

// ---------- la bestia del Bañado ----------
// La Madre del Agua de los Anuros: lomo encorvado de barro y musgo, juncos en la espalda, cuatro ojos y vetas de Marea
// suelta que le corren por el lomo (en la fase 2 se encienden y le brilla la boca).
function beast() {
  const g = new THREE.Group();
  const body = new Facets();
  const skin = (y, x, z) => (y < 2.2 ? P.mud : (Math.abs(x) * 3 + z * 2 + y) % 7 < 1.4 ? P.moss_l : (Math.abs(x) + z) % 5 < 1.6 ? P.moss_d : P.moss);
  body.blob(0, 4.4, -0.2, 5.4, 3.8, 6, skin, { seed: 3, flat: 0.95, jit: 0.16 });
  body.blob(0, 6.9, -1.8, 4.2, 2.9, 4.2, skin, { seed: 7, jit: 0.18 });
  // patas: adelante con garras de hueso, atrás más cortas
  for (const s of [-1, 1]) {
    body.limb([s * 3.9, 3.4, 3.2], [s * 4.9, 0.4, 5.4], 1.5, 1.0, P.moss_d, 6);
    body.blob(s * 4.9, 0.6, 5.6, 1.3, 0.7, 1.4, P.mud_d, { seed: 11 + s, detail: 0 });
    for (const k of [-1, 0, 1]) body.spike([s * 4.9 + k * 0.6, 0.5, 6.4], [s * 4.9 + k * 0.8, 0.1, 7.6], 0.28, P.bone);
    body.limb([s * 3.6, 3.0, -3.6], [s * 4.3, 0.3, -4.2], 1.6, 1.1, P.moss_d, 6);
  }
  // cola gruesa que se arrastra
  body.limb([0, 3.0, -5.6], [0.6, 1.4, -8.6], 1.9, 1.0, P.moss_d, 6);
  body.limb([0.6, 1.4, -8.6], [1.6, 0.6, -10.4], 1.0, 0.3, P.mud, 5);
  // juncos que le crecen en el lomo
  for (const [x, z, h, lean] of [[-1.8, -2.6, 4.2, -0.6], [0.6, -3.4, 5.0, 0.4], [2.2, -1.4, 3.4, 0.9], [-0.6, -0.2, 3.0, -0.3], [1.4, -4.6, 3.6, 0.2]]) {
    body.limb([x, 8.4, z], [x + lean, 8.4 + h, z - 0.4], 0.2, 0.08, P.reed, 4);
    body.spike([x + lean, 8.4 + h - 0.2, z - 0.4], [x + lean * 1.1, 8.4 + h + 0.9, z - 0.5], 0.26, P.reed_l);
  }
  const bodyMesh = body.mesh();
  g.add(bodyMesh);
  // vetas de Marea suelta sobre el lomo (brillan; en la fase 2, más)
  const veins = new Facets({ ao: false, vary: 0, tone: false });
  for (const [x, y, z, r] of [[-1.2, 9.2, -1.2, 0.42], [0.9, 9.4, -2.4, 0.5], [-0.4, 9.0, -3.8, 0.38], [2.6, 7.8, 0.2, 0.36], [-2.8, 7.6, -0.6, 0.34], [0.2, 8.4, 0.8, 0.3]])
    veins.blob(x, y, z, r, r * 0.6, r * 1.6, '#ffffff', { detail: 0, seed: x * 3 + z, jit: 0.2 });
  const veinMesh = new THREE.Mesh(veins.geometry(), new THREE.MeshBasicMaterial({ color: P.marea, transparent: true, opacity: 0.85 }));
  g.add(veinMesh);
  // cabeza: parte animada con la boca abierta y cuatro ojos
  const head = new THREE.Group();
  head.position.set(0, 4.6, 4.6);
  const hf = new Facets();
  hf.blob(0, 0.2, 1.8, 3.3, 2.2, 2.9, (y, x, z) => (y > 1.2 ? P.moss_d : P.moss), { seed: 5, jit: 0.14 });
  hf.box(0, -1.6, 2.9, 5.0, 1.0, 3.2, P.moss_d, { rot: [0.32, 0, 0] });   // mandíbula, abierta
  hf.box(0, -0.75, 3.4, 4.2, 0.6, 2.4, P.ink, { rot: [0.16, 0, 0] });      // boca
  for (const x of [-1.6, -0.6, 0.6, 1.6]) hf.spike([x, -0.4, 4.2], [x * 1.05, -1.4, 4.5], 0.26, P.bone);
  for (const x of [-1.2, 1.2]) hf.spike([x, -1.4, 4.0], [x, -0.5, 4.3], 0.22, P.bone_d);
  // ceño pesado sobre los ojos
  hf.box(0, 1.5, 3.4, 4.8, 0.8, 1.2, P.moss_d, { rot: [-0.25, 0, 0] });
  head.add(hf.mesh());
  const eyes = new Facets({ ao: false, vary: 0, tone: false });
  for (const [x, y, z] of [[-1.3, 0.95, 4.3], [1.3, 0.95, 4.3], [-2.2, 0.35, 3.8], [2.2, 0.35, 3.8]]) eyes.blob(x, y, z, 0.36, 0.3, 0.2, '#ffffff', { detail: 0, jit: 0 });
  const eyeMat = new THREE.MeshBasicMaterial({ color: P.beast_eye });
  head.add(new THREE.Mesh(eyes.geometry(), eyeMat));
  // brillo de la boca en la fase 2
  const maw = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.3, 1.6), new THREE.MeshBasicMaterial({ color: P.marea, transparent: true, opacity: 0 }));
  maw.position.set(0, -0.6, 3.6); maw.rotation.x = 0.16;
  head.add(maw);
  g.add(head);
  let phase = 0;
  g.userData.setPhase = (k) => { phase = k; };
  g.userData.update = (dt, moving, t) => {
    const br = Math.sin(t * 1.1) * 0.025;
    bodyMesh.scale.y = 1 + br;
    head.rotation.x = -0.05 + Math.sin(t * 0.9) * 0.07 + (phase ? Math.sin(t * 3.2) * 0.04 : 0);
    head.rotation.y = Math.sin(t * 0.5) * 0.1;
    const glow = phase ? 0.75 + Math.sin(t * 4.0) * 0.25 : 0.55 + Math.sin(t * 1.6) * 0.15;
    veinMesh.material.opacity = glow;
    veinMesh.material.color.set(phase ? P.marea_hot : P.marea);
    maw.material.opacity = phase ? 0.55 + Math.sin(t * 4.0) * 0.3 : 0;
  };
  return { g, height: 12.5, footprint: 13 };
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
/** Escala por jefe: la bestia ocupa más que su casilla (se sale un poco), la capitana como una persona alta. */
const SCALE = { bestia: 1.12, capitana: 0.98 };
export const BOSS_TYPES = Object.keys(BUILD);

/** Modelo low-poly de un jefe, o null si `type` no es uno. */
export function bossModel(type, { phase = 0 } = {}) {
  const build = BUILD[type];
  if (!build) return null;
  const { g: inner, height } = build();
  const g = new THREE.Group();
  inner.scale.setScalar(VOX);
  g.add(inner);
  const s = SCALE[type] || 1;
  g.scale.setScalar(s);
  g.userData.scale = s;
  g.userData.height = height * VOX * s;
  g.userData.type = type;
  g.userData.lowpoly = true;
  g.userData.update = (dt, moving, t) => inner.userData.update?.(dt, moving, t ?? performance.now() / 1000);
  g.userData.setPhase = (k) => inner.userData.setPhase?.(k);
  if (phase) inner.userData.setPhase(phase);
  g.name = 'boss:' + type;
  return g;
}
