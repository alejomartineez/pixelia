// Modelos vóxel de los enemigos del Acto 1 (DESIGN-COMBAT.md §5): lobos de ojos brillantes, el lobo viejo, bichos de
// veta, grumetes y tiradores piratas, la bestia del Bañado y la capitana. Tono oscuro, nada tierno (plan §J7): pelajes
// gastados, ojos que brillan en la penumbra, corazas de mineral y ropa de cielo remendada.
//
//   enemyModel(type, opts) -> THREE.Group   (origen en el centro de la casilla, base en y=0, mira a +Z)
//     opts.broken: el bicho sin coraza (después de Romper)
//     group.userData.update(dt, t)  respira y mueve la cabeza (lo llama la escena en cada cuadro)
//     group.userData.height          alto en unidades de mundo (para la barra de vida)
//     group.userData.scale           escala sugerida para la casilla (los jefes son más grandes)
//
// Usa voxelModel de src/city/models.js: las geometrías se arman una vez por tipo y se reusan.
import { voxelModel } from '../city/models.js';

// ---------- paletas ----------
const P = {
  ink: '#141010', bone: '#d6cfbe', bone_d: '#b1a993', iron: '#6f7378', iron_l: '#9aa0a6', brass: '#b0883a', gold: '#d9a94e',
  wolf: '#4a4d52', wolf_d: '#34363a', wolf_l: '#62656a', wolf_belly: '#575a5f', wolf_eye: '#ffd56a',
  old: '#6d6a64', old_d: '#4f4c47', old_l: '#8a867e', old_eye: '#ff9a3d', scar: '#7a3b36',
  stone: '#3b3631', stone_d: '#2a2622', stone_l: '#4d4741', vein: '#5fe0d0', vein_d: '#2f9e94', bug_eye: '#ff5a4a',
  skin: '#a87f62', skin_d: '#8a664d', cloth: '#2c2f38', cloth_l: '#4a4f5c', vest: '#5a2e2a', boot: '#1c1816', band: '#7a1f1f',
  coat: '#3a3f2e', coat_d: '#2a2e21', hat: '#201c1a', lens: '#9fe8ff',
  cap: '#5e1b20', cap_d: '#3f1216', feather: '#d9d2c2',
  moss: '#2f3d2c', moss_d: '#243021', moss_l: '#3f5236', mud: '#3a3024', reed: '#6f6a3a', beast_eye: '#d6ff70',
};

// ---------- piezas ----------
/** Cuadrúpedo: cuerpo, patas, cabeza (parte animada con los ojos que brillan) y cola. */
function quadruped(m, c, o = {}) {
  const v = m.v;
  const W = o.w || 4, x0 = (8 - W) / 2, H = o.h || 2, legH = o.legH || 2;
  for (const [x, z] of [[x0, 0], [x0 + W - 1, 0], [x0, 4], [x0 + W - 1, 4]]) v.box(x, 0, z, 1, legH, 1, c.d);
  v.box(x0, legH, 0, W, H, 5, (x, y, z) => (y === legH && z > 0 && z < 4 ? c.belly : (x + z) % 5 === 0 ? c.d : c.base));
  // pelo erizado sobre el lomo
  for (let z = 0; z < 5; z++) v.set(3 + (z % 2), legH + H, z, c.d);
  if (o.scar) for (const [x, y, z] of o.scar) v.set(x, y, z, P.scar);
  // cola caída
  v.box(3, legH + H - 1, -1, 2, 1, 1, c.d); v.set(3, legH + H - 2, -2, c.d);
  // cabeza: parte animada (gira sobre el cuello)
  const hy = legH + H - 1;
  const head = m.part('head', [4, hy + 1, 5]);
  head.box(x0, hy, 5, W, 3, 2, (x, y) => (y === hy + 2 ? c.d : c.base));
  head.box(3, hy, 7, 2, 2, 1, c.muzzle || c.d);
  head.set(3, hy - 1, 7, P.bone); head.set(4, hy - 1, 7, P.bone);   // colmillos
  head.set(x0, hy + 3, 5, c.d); head.set(x0 + W - 1, hy + 3, 5, c.d);   // orejas
  head.set(x0, hy + 4, 5, c.d); head.set(x0 + W - 1, hy + 4, 5, c.d);
  const eyes = m.part('eyes', [4, hy + 1, 5], { mat: 'light', cast: false });
  eyes.set(x0, hy + 2, 7, c.eye); eyes.set(x0 + W - 1, hy + 2, 7, c.eye);
  m.animate((parts, ph) => {
    const hs = [...(parts.head || []), ...(parts.eyes || [])];
    if (!hs.length) return null;
    return (dt, t) => { for (const h of hs) { h.rotation.x = Math.sin(t * 1.6 + ph) * 0.06; h.rotation.y = Math.sin(t * 0.7 + ph * 2) * 0.12; } };
  });
}

/** Persona del dirigible pirata: piernas, torso, brazos y cabeza. o.coat: saco largo; o.hat: 'bandana' | 'tricornio'. */
function pirate(m, o = {}) {
  const v = m.v;
  const shirt = o.shirt || P.cloth, coat = o.coat;
  // piernas y botas
  for (const x of [2, 5]) { v.box(x, 0, 3, 1, 1, 2, P.boot); v.box(x, 1, 3, 1, 3, 1, P.cloth); }
  v.box(2, 4, 3, 4, 1, 1, P.cloth);
  // torso (rayado oscuro) y chaleco o saco
  v.box(2, 5, 2, 4, 4, 3, (x, y) => (y % 2 ? shirt : P.cloth_l));
  if (coat) {
    v.box(1, 2, 2, 1, 7, 3, coat); v.box(6, 2, 2, 1, 7, 3, coat); v.box(2, 2, 2, 4, 3, 1, coat);
    v.box(2, 5, 2, 4, 4, 1, coat);
    if (o.trim) for (let y = 3; y < 9; y++) { v.set(1, y, 4, o.trim); v.set(6, y, 4, o.trim); }
  } else {
    v.box(2, 5, 4, 1, 4, 1, P.vest); v.box(5, 5, 4, 1, 4, 1, P.vest); v.box(2, 5, 2, 4, 4, 1, P.vest);
  }
  v.box(2, 5, 4, 4, 1, 1, P.vest);   // cinto
  v.set(4, 5, 5, o.buckle || P.brass);
  // brazos
  v.box(1, 6, 3, 1, 3, 1, coat || shirt); v.box(6, 6, 3, 1, 3, 1, coat || shirt);
  v.set(1, 5, 3, P.skin_d); v.set(6, 5, 3, P.skin_d);
  // cabeza
  v.box(2, 9, 2, 4, 3, 3, P.skin);
  v.box(2, 9, 2, 4, 1, 3, (x, y, z) => (z === 4 && (x === 3 || x === 4) ? P.skin_d : P.skin));
  v.set(3, 10, 5, P.ink); v.set(5, 10, 5, P.ink);   // ojos, sin brillo
  if (o.scar) v.set(5, 11, 5, P.scar);
  if (o.beard) v.box(2, 9, 5, 4, 1, 1, o.beard);
  // antiparras del cielo sobre la frente
  if (o.goggles) { v.box(2, 11, 5, 4, 1, 1, P.hat); m.light.set(3, 11, 5, P.lens); m.light.set(5, 11, 5, P.lens); }
  if (o.hat === 'bandana') { v.box(2, 12, 2, 4, 1, 3, P.band); v.set(2, 11, 1, P.band); v.set(2, 10, 1, P.band); }
  if (o.hat === 'tricornio') {
    v.box(1, 12, 1, 6, 1, 5, o.hatColor || P.hat); v.box(2, 13, 2, 4, 1, 3, o.hatColor || P.hat);
    v.set(1, 13, 1, o.hatColor || P.hat); v.set(6, 13, 1, o.hatColor || P.hat); v.set(4, 13, 5, o.hatColor || P.hat);
    if (o.feather) { v.box(5, 14, 1, 1, 1, 3, o.feather); v.set(5, 15, 1, o.feather); }
    if (o.trim) for (let x = 1; x < 7; x++) v.set(x, 12, 5, o.trim);
  }
}
/** Sable en la mano derecha (x = 6), hoja hacia adelante. */
function saber(v, len = 4) {
  v.set(6, 5, 4, P.brass); v.set(6, 5, 3, P.ink);
  for (let i = 0; i < len; i++) v.set(6, 5 + (i > 1 ? 1 : 0), 5 + i, i === len - 1 ? P.iron : P.iron_l);
}

// ---------- tipos ----------
const BUILD = {
  lobo(m) {
    quadruped(m, { base: P.wolf, d: P.wolf_d, belly: P.wolf_belly, eye: P.wolf_eye, muzzle: P.wolf_d });
    m.height = 6;
  },
  lobo_viejo(m) {
    quadruped(m, { base: P.old, d: P.old_d, belly: P.old_l, eye: P.old_eye, muzzle: P.old_l }, { w: 6, h: 3, legH: 2, scar: [[1, 4, 2], [1, 3, 3], [1, 4, 3]] });
    // melena gruesa sobre los hombros
    m.v.box(1, 5, 3, 6, 1, 2, P.old_d);
    m.height = 7;
  },
  bicho(m, o) {
    const v = m.v;
    // seis patas finas
    for (const z of [1, 3, 5]) { v.box(0, 0, z, 2, 1, 1, P.stone_d); v.box(6, 0, z, 2, 1, 1, P.stone_d); v.set(1, 1, z, P.stone_d); v.set(6, 1, z, P.stone_d); }
    // caparazón
    v.sphere(3.5, 1.6, 3.5, 3, 1.6, 3, (x, y, z) => ((x * 3 + z * 5 + y) % 7 === 0 ? P.stone_l : y >= 3 ? P.stone_d : P.stone));
    // mandíbulas
    v.set(2, 1, 7, P.bone_d); v.set(5, 1, 7, P.bone_d); v.set(3, 1, 7, P.stone_d); v.set(4, 1, 7, P.stone_d);
    const eyes = m.part('eyes', [4, 2, 6], { mat: 'light', cast: false });
    eyes.set(2, 2, 7, P.bug_eye); eyes.set(5, 2, 7, P.bug_eye);
    if (!o.broken) {
      // coraza de mineral: cristales de veta que brillan
      const cr = m.part('crystals', [4, 3, 4], { mat: 'light', cast: false });
      for (const [x, y, z] of [[3, 4, 3], [3, 5, 3], [5, 4, 4], [2, 4, 5], [4, 4, 1], [4, 5, 1], [5, 3, 6]]) cr.set(x, y, z, (x + y) % 2 ? P.vein : P.vein_d);
      m.animate((parts, ph) => {
        const c = parts.crystals?.[0];
        if (!c) return null;
        return (dt, t) => { const k = 1 + Math.sin(t * 3 + ph) * 0.06; c.scale.set(k, k, k); };
      });
    } else {
      // coraza partida: grietas oscuras
      for (const [x, y, z] of [[3, 3, 3], [4, 3, 3], [4, 3, 4], [5, 2, 4]]) v.set(x, y, z, P.ink);
    }
    m.height = 5;
  },
  grumete(m) {
    pirate(m, { hat: 'bandana', goggles: true, scar: true });
    saber(m.v, 4);
    m.height = 13;
  },
  tirador(m) {
    const v = m.v;
    pirate(m, { coat: P.coat, hat: 'tricornio', goggles: false, beard: '#3a2a20' });
    // trabuco: culata en la cadera y caño hacia adelante
    v.box(5, 6, 2, 1, 1, 2, '#4a3b2e');
    for (let z = 4; z < 9; z++) v.set(5, 7, z, z === 8 ? P.ink : P.iron);
    v.set(5, 8, 8, P.iron); v.set(5, 6, 8, P.iron);
    m.height = 14;
  },
  capitana(m) {
    const v = m.v;
    pirate(m, { coat: P.cap, trim: P.gold, hat: 'tricornio', hatColor: P.cap_d, feather: P.feather, goggles: true, buckle: P.gold, shirt: '#2a2228' });
    saber(v, 5);
    // brazo izquierdo de bronce, con la pistola
    v.box(1, 6, 3, 1, 3, 1, P.brass); v.set(1, 5, 3, P.brass);
    v.box(1, 5, 4, 1, 1, 3, P.iron); v.set(1, 4, 4, '#4a3b2e');
    // charreteras doradas
    v.set(1, 9, 3, P.gold); v.set(6, 9, 3, P.gold);
    m.height = 16;
  },
  bestia(m) {
    const v = m.v;   // huella de 12×12 (la escena la escala para que entre en la casilla)
    // lomo encorvado de barro y musgo
    v.sphere(6, 4, 5, 5.5, 4.5, 5, (x, y, z) => {
      const n = (x * 7 + y * 3 + z * 11) % 9;
      return y < 2 ? P.mud : n === 0 ? P.moss_l : n < 3 ? P.moss_d : P.moss;
    });
    // juncos que le crecen en el lomo
    for (const [x, z, h] of [[4, 3, 3], [7, 2, 4], [5, 6, 2], [8, 5, 3], [3, 5, 2]]) for (let y = 0; y < h; y++) v.set(x, 8 + y, z, y === h - 1 ? '#8a7f45' : P.reed);
    // garras al frente
    for (const x of [1, 9]) { v.box(x, 0, 8, 2, 3, 3, P.moss_d); v.set(x, 0, 11, P.bone); v.set(x + 1, 0, 11, P.bone); }
    // cola gruesa
    v.box(5, 1, -2, 3, 2, 3, P.moss_d); v.box(6, 1, -4, 1, 1, 2, P.moss_d);
    // cabeza con la boca abierta
    const head = m.part('head', [6, 5, 9]);
    head.box(3, 3, 9, 6, 4, 3, (x, y) => (y === 6 ? P.moss_d : P.moss));
    head.box(3, 2, 11, 6, 1, 1, P.ink);
    for (const x of [3, 5, 6, 8]) head.set(x, 3, 11, P.bone);
    head.box(4, 1, 10, 4, 1, 2, P.moss_d);   // mandíbula
    const eyes = m.part('eyes', [6, 5, 9], { mat: 'light', cast: false });
    for (const [x, y] of [[3, 5], [4, 6], [7, 6], [8, 5]]) eyes.set(x, y, 12, P.beast_eye);
    m.animate((parts, ph) => {
      const hs = [...(parts.head || []), ...(parts.eyes || [])];
      if (!hs.length) return null;
      return (dt, t) => { for (const h of hs) h.rotation.x = -0.04 + Math.sin(t * 0.9 + ph) * 0.07; };
    });
    m.height = 12;
  },
};

const SIZE = { bestia: 12 };
const SCALE = { lobo: 1, lobo_viejo: 1.1, bicho: 0.95, grumete: 0.9, tirador: 0.9, capitana: 0.98, bestia: 1.45 };

/** Modelo vóxel de un enemigo del Acto 1 (types de ENEMIES en combat-data.js). */
export function enemyModel(type, opts = {}) {
  const build = BUILD[type] || BUILD.lobo;
  const n = SIZE[type] || 8;
  const variant = type === 'bicho' && opts.broken ? ':roto' : '';
  const g = voxelModel(`enemy:${type}${variant}`, n, n, (m) => build(m, opts));
  const s = (SCALE[type] || 0.8) * (8 / n);
  g.scale.setScalar(s);
  g.userData.scale = s;
  g.userData.height = (g.userData.height || 1) * s;
  g.userData.type = type;
  g.name = 'enemy:' + type;
  return g;
}

export const ENEMY_MODEL_TYPES = Object.keys(BUILD);
