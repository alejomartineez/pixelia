// Enemigos del combate en el estilo "mezcla" (plan §M1, DESIGN-COMBAT.md §5):
//   - gente (piratas del cielo, que son gente-zorro del Céfiro, y los Vaciados de la mina): vóxel detallado con
//     avatarModel, igual que el grupo;
//   - criaturas grandes, gólems y jefes (lobos, bichos de veta, la bestia del Bañado, el gólem de Raíz, el orco de
//     la Brasa): low-poly facetado (src/avatar/lowpoly.js), con la misma luz y el mismo contorno tinta.
//
//   enemyModel(type, opts) -> THREE.Group   (origen en el centro de la casilla, base en y=0, mira a +Z)
//     opts.broken: el bicho sin coraza (después de Romper)
//     group.userData.update(dt, moving?)  respira, mueve la cabeza (la escena lo llama en cada cuadro)
//     group.userData.height               alto en unidades de mundo (para la barra de vida)
//     group.userData.scale                escala que ya trae el modelo
// La firma es la de siempre: combat-scene.js no cambia.
import * as THREE from 'three';
import { avatarModel } from '../avatar/avatar.js';
import { Facets } from '../avatar/lowpoly.js';
import { bossModel } from './boss-models.js';

// ---------- paletas (terrosas, con ojos que brillan en la penumbra) ----------
const P = {
  // más claros que el piso de la grilla y con un vientre o lomo de otro valor: la silueta se lee contra lo oscuro
  wolf: '#66625c', wolf_d: '#45423f', wolf_l: '#9a9286', wolf_eye: '#ffd56a',
  old: '#7e7870', old_d: '#57534d', old_l: '#a59d8f', old_eye: '#ff9a3d', scar: '#8a3b34',
  stone: '#5a5148', stone_d: '#3c3631', stone_l: '#7e7262', vein: '#5fe0d0', vein_d: '#2f9e94', bug_eye: '#ff5a4a',
  bone: '#cfc6b0', bone_d: '#a89f8a', ink: '#161210',
  rock: '#7a7468', rock_d: '#54504a', rock_l: '#a19a8a', root: '#5e4630', rootL: '#86683e', golem_eye: '#8ff0a0', lichen: '#6e8a4a',
  orc: '#6c7a4e', orc_d: '#55613d', iron: '#4a4b4e', iron_d: '#333437', iron_l: '#6e7074', ember: '#ff8a3a', leather: '#4a3426',
};

// ---------- piezas ----------
/** Grupo con partes animadas. parts: { name: Facets } → mallas; las que tienen glow usan el material sin luz. */
function assemble(def) {
  const g = new THREE.Group();
  const parts = {};
  for (const [name, p] of Object.entries(def.parts)) {
    const holder = new THREE.Group();
    if (p.at) holder.position.set(...p.at);
    if (p.f.pos.length) holder.add(p.f.mesh());
    if (p.glow && p.glow.pos.length) holder.add(p.glow.mesh({ glow: true }));
    g.add(holder);
    parts[name] = holder;
  }
  return { g, parts };
}

// lobo: cuerpo largo, pecho alto, cabeza que olfatea, cola caída
function wolf(c, o = {}) {
  const k = o.k || 1;
  const body = new Facets(), head = new Facets(), eyes = new Facets({ ao: false, vary: 0 });
  const fur = (y) => (y > 0.53 * k ? c.d : y < 0.34 * k ? c.l : c.base);   // lomo oscuro, vientre claro
  body.blob(0, 0.42 * k, -0.05, 0.2 * k, 0.17 * k, 0.4 * k, fur, { seed: 2 });
  body.blob(0, 0.47 * k, 0.2 * k, 0.21 * k, 0.21 * k, 0.2 * k, (y) => (y < 0.5 * k ? c.l : c.base), { seed: 5 });   // pecho claro
  if (o.mane) body.blob(0, 0.6 * k, 0.12 * k, 0.24 * k, 0.15 * k, 0.24 * k, c.l, { seed: 8, jit: 0.25 });
  for (const [x, z] of [[-0.11, 0.24], [0.11, 0.24], [-0.1, -0.3], [0.1, -0.3]]) {
    body.limb([x * k, 0.4 * k, z * k], [x * k, 0.18 * k, (z + 0.02) * k], 0.06 * k, 0.045 * k, c.d, 4);
    body.limb([x * k, 0.18 * k, (z + 0.02) * k], [x * k, 0.01, (z + 0.06) * k], 0.045 * k, 0.04 * k, c.d, 4);
  }
  body.limb([0, 0.46 * k, -0.42 * k], [0, 0.26 * k, -0.68 * k], 0.06 * k, 0.025 * k, c.d, 4);   // cola
  if (o.scar) body.limb([0.2 * k, 0.5 * k, 0.05], [0.18 * k, 0.4 * k, -0.15 * k], 0.012, 0.012, P.scar, 3);
  // cabeza (pivote en el cuello)
  head.blob(0, 0, 0.05 * k, 0.13 * k, 0.12 * k, 0.14 * k, c.base, { seed: 4, detail: 0 });
  head.box(0, -0.03 * k, 0.2 * k, 0.11 * k, 0.09 * k, 0.18 * k, (y) => (y < -0.04 * k ? c.l : c.d), { taper: 0.75 });   // hocico, la quijada clara
  head.box(0, -0.075 * k, 0.29 * k, 0.04 * k, 0.03 * k, 0.03 * k, P.ink);
  for (const s of [-1, 1]) {
    head.spike([s * 0.07 * k, 0.07 * k, -0.02], [s * 0.1 * k, 0.21 * k, -0.03], 0.04 * k, c.d, 3);   // orejas
    head.spike([s * 0.03 * k, -0.07 * k, 0.24 * k], [s * 0.03 * k, -0.11 * k, 0.25 * k], 0.012 * k, P.bone, 3);   // colmillos
    eyes.box(s * 0.06 * k, 0.03 * k, 0.15 * k, 0.03 * k, 0.018 * k, 0.02 * k, c.eye);
  }
  return assemble({ parts: { body: { f: body }, head: { f: head, glow: eyes, at: [0, 0.58 * k, 0.3 * k] } } });
}

// bicho de veta: caparazón de piedra, seis patas, mandíbulas y cristales que brillan (sin coraza si está roto)
function bug(broken) {
  const body = new Facets(), glow = new Facets({ ao: false, vary: 0.15 });
  body.blob(0, 0.2, 0, 0.32, 0.17, 0.36, (y) => (y > 0.28 ? (broken ? P.stone_d : P.stone_l) : y < 0.15 ? P.stone_d : P.stone), { seed: 7, flat: 0.5 });
  for (const z of [-0.18, 0.02, 0.22]) for (const s of [-1, 1]) {
    body.limb([s * 0.26, 0.17, z], [s * 0.44, 0.22, z + 0.04], 0.03, 0.025, P.stone, 4);
    body.limb([s * 0.44, 0.22, z + 0.04], [s * 0.5, 0.0, z + 0.08], 0.025, 0.015, P.stone_d, 4);
  }
  for (const s of [-1, 1]) {
    body.spike([s * 0.08, 0.13, 0.32], [s * 0.03, 0.08, 0.5], 0.04, P.bone_d, 3);
    glow.box(s * 0.09, 0.22, 0.34, 0.04, 0.03, 0.03, P.bug_eye);
  }
  if (!broken) [[0, 0.36, 0.0, 0.2], [-0.13, 0.33, -0.12, 0.15], [0.12, 0.33, 0.1, 0.16], [0.05, 0.32, -0.22, 0.12], [-0.12, 0.3, 0.16, 0.1]]
    .forEach(([x, y, z, h], i) => glow.spike([x, y - 0.02, z], [x + (i % 2 ? 0.03 : -0.03), y + h, z], 0.045, i % 2 ? P.vein : P.vein_d, 4));
  else for (const [x, z] of [[0, 0], [-0.1, 0.1], [0.12, -0.08]]) body.box(x, 0.36, z, 0.08, 0.02, 0.03, P.ink, { rot: [0, x * 5, 0] });
  return assemble({ parts: { body: { f: body, glow }, crystals: { f: new Facets() } } });
}

// la bestia del Bañado es un jefe: la arma src/combat/boss-models.js (una sola bestia para el combate y la galería)

// gólem de Raíz: bloques de piedra con raíces y una veta verde que late
function golem() {
  const body = new Facets(), head = new Facets(), glow = new Facets({ ao: false, vary: 0.1 }), eyes = new Facets({ ao: false, vary: 0 });
  const rock = (y, x, z) => ((Math.round(x * 9) + Math.round(z * 7)) % 4 === 0 ? P.rock_d : y > 1.05 ? P.rock_l : P.rock);
  body.box(0, 0.82, 0, 0.82, 0.62, 0.5, rock, { taper: 1.12, jit: 0.06, seed: 2 });
  body.box(0, 0.46, 0, 0.6, 0.2, 0.4, P.rock_d, { jit: 0.04 });
  for (const s of [-1, 1]) {
    body.box(s * 0.24, 0.22, 0, 0.24, 0.42, 0.3, rock, { taper: 0.9, jit: 0.04, seed: 5 + s });   // piernas
    body.blob(s * 0.58, 1.02, 0, 0.2, 0.18, 0.2, rock, { seed: 6 + s, detail: 0 });   // hombros
    body.box(s * 0.62, 0.66, 0.04, 0.2, 0.46, 0.22, rock, { taper: 1.15, jit: 0.05, seed: 9 + s });   // brazos
    body.blob(s * 0.64, 0.36, 0.08, 0.17, 0.15, 0.17, P.rock_d, { seed: 13 + s, detail: 0 });   // puños
    body.limb([s * 0.4, 1.1, 0.25], [s * 0.2, 0.55, 0.27], 0.025, 0.02, P.root, 4);   // raíces que lo atan
  }
  body.limb([-0.3, 0.9, 0.26], [0.3, 0.6, 0.27], 0.022, 0.02, P.rootL, 4);
  for (const s of [-1, 1]) body.blob(s * 0.56, 1.16, -0.02, 0.15, 0.05, 0.14, P.lichen, { seed: 30 + s, detail: 0, flat: 0.2 });   // liquen
  glow.box(0, 0.86, 0.255, 0.1, 0.18, 0.02, P.golem_eye, { rot: [0, 0, 0.3] });
  glow.box(0.12, 0.74, 0.255, 0.16, 0.03, 0.02, P.vein_d, { rot: [0, 0, -0.5] });
  head.box(0, 0.06, 0, 0.3, 0.24, 0.28, rock, { taper: 0.85, jit: 0.05, seed: 21 });
  head.box(0, 0.16, 0.12, 0.32, 0.05, 0.08, P.rock_d);   // ceño de piedra
  head.blob(0.04, 0.19, -0.04, 0.12, 0.035, 0.11, P.lichen, { seed: 33, detail: 0, flat: 0.2 });
  for (const s of [-1, 1]) eyes.box(s * 0.07, 0.08, 0.145, 0.06, 0.03, 0.02, P.golem_eye);
  return assemble({ parts: { body: { f: body, glow }, head: { f: head, glow: eyes, at: [0, 1.16, 0.02] } } });
}

// orco de la Brasa (bruto, jefe): hombros enormes, coraza de hierro, colmillos y una cuchilla con brasas
function orc() {
  const body = new Facets(), head = new Facets(), glow = new Facets({ ao: false, vary: 0.2 }), eyes = new Facets({ ao: false, vary: 0 });
  for (const s of [-1, 1]) {
    body.limb([s * 0.16, 0.6, 0], [s * 0.19, 0.3, 0.04], 0.12, 0.1, P.leather, 5);
    body.limb([s * 0.19, 0.3, 0.04], [s * 0.2, 0.04, 0.02], 0.1, 0.09, P.iron_d, 5);
    body.box(s * 0.2, 0.03, 0.06, 0.16, 0.06, 0.24, P.iron_d);
  }
  body.blob(0, 0.86, 0, 0.36, 0.3, 0.26, P.orc, { seed: 4, detail: 1 });
  body.box(0, 0.82, 0.1, 0.56, 0.36, 0.3, (y) => (y > 0.93 ? P.iron_l : P.iron), { taper: 1.1, jit: 0.03 });   // coraza
  body.box(0, 0.62, 0.05, 0.5, 0.1, 0.36, P.leather);
  for (const s of [-1, 1]) {
    body.blob(s * 0.4, 1.04, 0, 0.17, 0.13, 0.17, P.iron_d, { seed: 7 + s, detail: 0 });   // hombreras
    body.limb([s * 0.42, 1.0, 0], [s * 0.5, 0.72, 0.1], 0.1, 0.085, P.orc, 5);
    body.limb([s * 0.5, 0.72, 0.1], [s * 0.5, 0.5, 0.24], 0.085, 0.08, P.orc_d, 5);
    body.blob(s * 0.5, 0.47, 0.27, 0.07, 0.07, 0.07, P.orc_d, { seed: 2, detail: 0 });
  }
  // la cuchilla en la mano derecha, con el filo al rojo
  body.limb([0.5, 0.47, 0.27], [0.5, 0.47, 0.5], 0.025, 0.025, P.leather, 4);
  body.box(0.5, 0.62, 0.72, 0.03, 0.42, 0.36, P.iron, { taper: 0.8, skew: 0.05 });
  glow.box(0.5, 0.82, 0.84, 0.035, 0.04, 0.3, P.ember);
  glow.box(-0.02, 0.92, 0.26, 0.1, 0.05, 0.02, P.ember);   // brasa en el pecho
  head.blob(0, 0.04, 0, 0.17, 0.16, 0.16, P.orc, { seed: 12, detail: 0 });
  head.box(0, -0.06, 0.1, 0.28, 0.12, 0.14, P.orc_d, { taper: 1.05 });   // mandíbula
  head.box(0, 0.1, 0.13, 0.28, 0.05, 0.06, P.orc_d);   // frente pesada
  for (const s of [-1, 1]) {
    head.spike([s * 0.08, -0.02, 0.17], [s * 0.1, 0.09, 0.2], 0.022, P.bone, 3);   // colmillos
    head.spike([s * 0.15, 0.06, -0.02], [s * 0.28, 0.12, -0.05], 0.035, P.orc_d, 3);   // orejas
    eyes.box(s * 0.065, 0.05, 0.155, 0.04, 0.018, 0.02, P.ember);
  }
  head.box(0, 0.2, -0.02, 0.05, 0.08, 0.26, '#1e1a18');   // cresta
  return assemble({ parts: { body: { f: body, glow }, head: { f: head, glow: eyes, at: [0, 1.2, 0.08] } } });
}

// ---------- gente (vóxel detallado) ----------
const PEOPLE = {
  grumete: { look: { type: 'zorro', build: 'esbelto', skin: 1, hair: 'corto', hairColor: 'negro', face: 'cicatriz', dress: 'cuero', dressColor: 'rojo', crown: 'bandana', acc: 'espada' }, k: 0.86 },
  tirador: { look: { type: 'zorro', build: 'recio', skin: 3, hair: 'cortito', hairColor: 'gris', face: 'ninguna', dress: 'abrigo', dressColor: 'verde', crown: 'galera', acc: 'ninguno' }, gear: 'trabuco', k: 0.88 },
  capitana: { look: { type: 'zorro', build: 'esbelto', skin: 0, hair: 'trenzas', hairColor: 'blanco', face: 'parche', dress: 'abrigo', dressColor: 'fucsia', crown: 'galera', acc: 'espada' }, k: 0.98 },
  vaciado: { look: { type: 'vaciado', build: 'esbelto', skin: 0, hair: 'despeinado', hairColor: 'negro', face: 'cicatriz', dress: 'cuero', dressColor: 'negro', crown: 'ninguna', acc: 'ninguno' }, k: 0.88 },
};

// ---------- tipos ----------
const BEASTS = {
  lobo: () => wolf({ base: P.wolf, d: P.wolf_d, l: P.wolf_l, eye: P.wolf_eye }),
  lobo_viejo: () => wolf({ base: P.old, d: P.old_d, l: P.old_l, eye: P.old_eye }, { k: 1.15, mane: true, scar: true }),
  bicho: (o) => bug(!!o.broken),
  golem: () => golem(),
  orco: () => orc(),
};
const SCALE = { lobo: 1, lobo_viejo: 1, bicho: 0.95, golem: 0.9, orco: 0.92 };
const cache = new Map();

/** Modelo de un enemigo (types de ENEMIES en combat-data.js, más los que vienen: vaciado, golem, orco). */
export function enemyModel(type, opts = {}) {
  if (type === 'bestia') return bossModel('bestia', opts);
  const pp = PEOPLE[type];
  if (pp) {
    const g = avatarModel(pp.look, pp.gear ? { gear: pp.gear } : {});
    g.scale.setScalar(pp.k);
    g.userData.scale = pp.k;
    g.userData.height = (g.userData.height || 1) * pp.k;
    g.userData.type = type;
    g.name = 'enemy:' + type;
    return g;
  }
  const build = BEASTS[type] || BEASTS.lobo;
  const key = type + (type === 'bicho' && opts.broken ? ':roto' : '');
  let tpl = cache.get(key);
  if (!tpl) { tpl = build(opts); cache.set(key, tpl); }
  // instancia: las geometrías se comparten, los grupos (para animar) son propios
  const g = tpl.g.clone(true);
  const parts = {};
  Object.keys(tpl.parts).forEach((name, i) => { parts[name] = g.children[i]; });
  const s = SCALE[type] || 1;
  g.scale.setScalar(s);
  g.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(g);
  g.userData.scale = s;
  g.userData.height = box.max.y;
  g.userData.type = type;
  g.name = 'enemy:' + type;
  const ph = Math.random() * 6;
  let t = ph, walk = 0;
  const base = parts.body.position.y;
  g.userData.update = (dt = 0.016, moving = false) => {
    dt = typeof dt === 'number' ? Math.min(dt, 0.1) : 0.016;
    t += dt;
    walk += ((moving === true ? 1 : 0) - walk) * Math.min(1, dt * 8);
    const br = Math.sin(t * 1.8);
    parts.body.scale.set(1 + br * 0.008, 1 + br * 0.014, 1);
    parts.body.position.y = base + Math.abs(Math.sin(t * 9)) * 0.03 * walk;
    if (parts.head) { parts.head.rotation.x = Math.sin(t * 1.5) * 0.06 - 0.04 * walk; parts.head.rotation.y = Math.sin(t * 0.6) * 0.14; }
  };
  g.userData.update(0);
  return g;
}

export const ENEMY_MODEL_TYPES = ['lobo', 'lobo_viejo', 'bicho', 'grumete', 'tirador', 'capitana', 'bestia', 'vaciado', 'golem', 'orco'];
