// Escena `combat` (DESIGN-COMBAT.md §11): el combate táctico en 3D sobre el motor puro de combat-rules.js.
// Grilla de 8×8 con el terreno del encuentro, el grupo con avatarModel, los enemigos de enemy-models.js, las casillas que
// el enemigo marca antes de pegar (con el modo alto contraste de Ajustes) y los eventos del motor animados en orden, a la
// velocidad de Ajustes → Juego (combatSpeed). La interfaz DOM está en combat-ui.js.
//
//   router.go('combat', { battle, onEnd, onSave })   retoma una pelea guardada (state.expedition.active.battle)
//   router.go('combat', { encounter, seed, party, level, element, tools, equip, roleLevel, attempt, conditions, onEnd, onSave })
//   ?scene=combat                      encuentro de prueba (Ojos en el monte con el grupo del tutorial)
//   &enc=banado_bestia&seed=3&party=exploracion,guia,sanidad&level=5&element=raiz&tools=cuerda:3&equip=botiquin,farol
//
// onSave(b) se llama después de cada acción y de cada turno (la pelea es JSON puro); onEnd(result) al cerrar la pantalla
// de resultado. Sin onEnd vuelve a la ciudad. El traspaso con la expedición (casilla `enemigo`) va aparte.
// Ambiente (plan §J3, paso 3b): el combate hereda la hora y el clima de la casilla. Se le pasa `conditions` (lo que da
// combatConditions de src/core/ambience.js: { hour, weather, place }) y la escena lo dibuja con createAmbience
// (src/core/ambience-fx.js) sobre la paleta oscura de cada región. Para las capturas: &hour=21&weather=lluvia.
import * as THREE from 'three';
import { createPixelRenderer, addLights, setIsoCamera } from '../core/voxel.js';
import { createAmbience } from '../core/ambience-fx.js';
import { combatConditions, WEATHER } from '../core/ambience.js';
import { actionFor } from '../core/keys.js';
import { voxelModel } from '../city/models.js';
import { avatarModel, randomLook } from '../avatar/avatar.js';
import * as C from './combat-rules.js';
import { ENCOUNTERS, ENEMIES, ABILITIES, ITEMS, COMBAT, TUTORIAL_PARTY } from './combat-data.js';
import { enemyModel } from './enemy-models.js';
import { bossModel } from './boss-models.js';
import { buildCombatUi } from './combat-ui.js';
import { SCENE_BY_ID } from '../story/story-data.js';
import { markSeen } from '../story/story.js';

// ---------------------------------------------------------------- primera pelea guiada (plan §E6)
// Pistas de un solo uso (state.tutorial.combatTips) con la voz de Vera: el contacto del combate (c_combate) repartido
// en los momentos en que sirve, más lo justo para jugar el primer turno. when: start | moved | acted | wave | marks | roles.
const CONTACT = SCENE_BY_ID.c_combate?.lines || [];
export const GUIDE_TIPS = [
  { id: 'intro', when: 'start', text: `${CONTACT[0] || 'Se pelea por turnos: primero mueve tu grupo, después ellos.'} Elegí a alguien del grupo (clic o Tab) y movelo a una casilla azul.` },
  { id: 'act', when: 'moved', text: 'Después de moverse, cada uno actúa una vez. Con un clic en un lobo que esté al alcance, le pega. Las habilidades están abajo, con su número.' },
  { id: 'end', when: 'acted', text: 'Cuando el grupo termine, Fin de turno (Espacio). Después juegan ellos.' },
  { id: 'wave', when: 'wave', text: 'Viene otro lobo: la casilla rayada que dice "Llega" marca por dónde entra. Mejor no estar ahí.' },
  { id: 'marks', when: 'marks', text: CONTACT[1] || 'Las casillas marcadas son las que van a atacar. Salí de ahí o hacé que les cueste.' },
  { id: 'roles', when: 'roles', text: `${CONTACT[2] || 'Cada integrante tiene habilidades según su rol.'} Exploración marca a un lobo y el próximo golpe le hace +3.` },
];

// ---------------------------------------------------------------- arte del campo
// Cada región con su paleta oscura (plan §J1): monte de noche, mina, bañado con bruma y costa de dirigibles.
const REG = {
  bosque: { bg: 0x141a17, grass: ['#3f5a35', '#37502f', '#466340'], dirt: '#3d2f24', dirt_d: '#2f241b', rock: ['#55524b', '#48453f'],
    tree: 'pino', water: ['#24414a', '#2c4d57'], hemi: [0xaab8c8, 0x2a2622, 1.05], sun: [0xffe2c0, 1.5] },
  cerro: { bg: 0x131215, grass: ['#4e4840', '#45403a', '#57514a'], dirt: '#36302a', dirt_d: '#2a2520', rock: ['#5e574e', '#514b43'],
    tree: 'seco', vein: '#5fe0d0', water: ['#24414a', '#2c4d57'], hemi: [0xa8acbc, 0x1e1c20, 0.95], sun: [0xf0d8c0, 1.35] },
  banado: { bg: 0x121a1b, grass: ['#3a4a34', '#33422e', '#41533a'], dirt: '#33291f', dirt_d: '#271f18', rock: ['#4d5048', '#43463f'],
    tree: 'sauce', water: ['#22424a', '#2a5059', '#1d3940'], hemi: [0x9fb6b8, 0x1d2420, 1.0], sun: [0xe0e6d0, 1.25] },
  costa: { bg: 0x16171e, grass: ['#6a5d49', '#615541', '#72654f'], dirt: '#3f3328', dirt_d: '#30271f', rock: ['#5b5a58', '#4e4d4b'],
    tree: 'poste', plank: ['#5a3f2c', '#4c3525'], water: ['#24414a', '#2c4d57'], hemi: [0xb0b8cc, 0x24202a, 1.05], sun: [0xffd8b0, 1.45] },
};
const LIGHT_FLOOR = { hemi: 0.95, sun: 0.7 };
const TOP = { llano: 2, salida: 2, pasarela: 2, roca: 2, arbol: 2, agua: 1, alto: 6, vacio: 0 };
const topOf = (t) => (TOP[t] ?? 2) / 8;

function drawTile(m, reg, t, variant) {
  const v = m.v, R = REG[reg] || REG.bosque;
  const H = TOP[t] ?? 2;
  const g = (x, z) => R.grass[(x * 7 + z * 13 + variant * 5) % 11 < 3 ? 1 : (x * 3 + z * 5 + variant) % 13 === 0 ? 2 : 0];
  if (t === 'vacio') {   // la pasarela cortada: astillas en los bordes
    for (const x of [0, 7]) for (let z = 1; z < 7; z += 2) v.set(x, 0, z, R.dirt_d);
    v.set(1, 0, 2, R.plank?.[1] || R.dirt); v.set(6, 0, 5, R.plank?.[1] || R.dirt);
    m.height = 1; return;
  }
  if (t === 'agua') {
    for (let x = 0; x < 8; x++) for (let z = 0; z < 8; z++) v.set(x, 0, z, R.water[(x * 5 + z * 3 + variant) % 7 === 0 ? 1 : 0]);
    if (reg === 'banado') for (const [x, z] of [[1, 1], [6, 2], [2, 6]].slice(0, 1 + variant)) { v.box(x, 1, z, 1, 2, 1, '#5c5733'); v.set(x, 3, z, '#6e5a33'); }
    m.height = 1; return;
  }
  if (t === 'alto') {   // lo alto: un peñón con el borde gastado y la cima con pasto
    for (let x = 0; x < 8; x++) for (let z = 0; z < 8; z++) {
      const corner = (x === 0 || x === 7) && (z === 0 || z === 7);
      const h = corner ? H - 1 : H;
      for (let y = 0; y < h - 1; y++) v.set(x, y, z, R.rock[(x + y * 2 + z) % 3 === 0 ? 1 : 0]);
      v.set(x, h - 1, z, reg === 'costa' ? R.plank[(x + variant) % 2] : g(x, z));
    }
    if (reg === 'cerro') { m.light.set(0, 2, 3, R.vein); m.light.set(7, 3, 5, R.vein); }
    m.height = H; return;
  }
  for (let x = 0; x < 8; x++) for (let z = 0; z < 8; z++) {
    v.set(x, 0, z, (x + z) % 3 ? R.dirt : R.dirt_d);
    v.set(x, 1, z, t === 'pasarela' ? R.plank[(z >> 1) % 2] : g(x, z));
  }
  if (t === 'pasarela') {   // tablones con soga a los costados
    for (const z of [0, 7]) { for (const x of [0, 4]) v.box(x, 2, z, 1, 2, 1, '#3a2a1e'); for (let x = 0; x < 8; x++) v.set(x, 3, z, '#8a7550'); }
  }
  if (t === 'salida') {   // camino de piedras y dos faroles que marcan por dónde se sale
    for (const [x, z] of [[3, 1], [4, 2], [3, 3], [4, 4], [3, 5], [4, 6]]) v.set(x, 1, z, '#8f8676');
    for (const x of [0, 7]) { v.box(x, 2, 0, 1, 4, 1, '#3a2a1e'); m.light.set(x, 6, 0, '#ffc466'); }
  }
  if (t === 'roca') {
    v.sphere(3.5, 3, 3.5, 3, 2.6, 2.8, (x, y, z) => R.rock[(x * 3 + y + z * 5) % 4 === 0 ? 1 : 0]);
    if (reg === 'cerro') { m.light.set(2, 4, 6, R.vein); m.light.set(5, 3, 6, R.vein); m.light.set(6, 5, 3, R.vein); }
  }
  if (t === 'arbol') drawTree(m, R.tree, variant);
  m.height = H;
}
function drawTree(m, kind, variant) {
  const v = m.v;
  if (kind === 'pino') {   // pino oscuro de monte
    v.box(3, 2, 3, 2, 4, 2, '#3a2a1e');
    for (let i = 0; i < 4; i++) { const r = 3.4 - i * 0.8; v.cylinder(3.5, 5 + i * 2, 3.5, r, 2, (x, y, z) => ((x + y + z + variant) % 5 === 0 ? '#2a4030' : '#24382a')); }
    v.set(3, 13, 3, '#2a4030'); v.set(4, 13, 4, '#2a4030');
  } else if (kind === 'sauce') {   // sauce muerto del bañado, con barba de musgo
    v.box(3, 2, 3, 2, 6, 2, '#3b3328');
    for (const [dx, dz] of [[-2, 0], [2, 1], [0, -2], [1, 2]]) v.box(3 + dx, 7, 3 + dz, 2, 1, 2, '#3b3328');
    for (const [x, z] of [[1, 3], [5, 4], [3, 1], [4, 5]]) for (let y = 4; y < 7; y++) v.set(x, y, z, '#55603e');
  } else if (kind === 'poste') {   // poste de amarre del muelle
    v.box(3, 2, 3, 2, 6, 2, '#4a3525'); v.box(2, 7, 3, 4, 1, 2, '#3a2a1e');
    for (let y = 3; y < 6; y++) v.set(5, y, 3, '#8a7550');
  } else {   // árbol seco
    v.box(3, 2, 3, 2, 5, 2, '#3e3730'); v.box(1, 6, 3, 2, 1, 1, '#3e3730'); v.box(5, 7, 4, 2, 1, 1, '#3e3730'); v.set(4, 8, 3, '#3e3730');
  }
  m.height = 14;
}
function drawWall(m, root) {
  const v = m.v;
  if (root) {   // pared de raíz: raíces trenzadas que brillan apenas
    for (let i = 0; i < 4; i++) { const x = 1 + i * 2; for (let y = 0; y < 7 - (i % 2); y++) v.set(x + (y % 3 === 1 ? 1 : 0), y, 3 + (y % 2), y % 4 === 0 ? '#4b3b25' : '#5c4a2e'); }
    v.box(0, 0, 3, 8, 1, 2, '#4b3b25');
    for (const [x, y] of [[2, 4], [5, 2], [6, 5]]) m.light.set(x, y, 5, '#a6e07a');
  } else {   // barrera de ingeniería: empalizada con travesaño
    for (let x = 0; x < 8; x += 2) v.box(x, 0, 3, 2, 6 + (x % 4 ? 0 : 1), 2, (xx, y) => (y >= 5 ? '#6a5038' : '#55402c'));
    v.box(0, 3, 5, 8, 1, 1, '#3a2a1e');
  }
  m.height = 7;
}
function drawTrap(m) {   // trampa de dientes de hierro
  const v = m.v;
  v.box(1, 0, 1, 6, 1, 6, '#3f3a35');
  for (let i = 1; i < 7; i += 2) { v.set(i, 1, 1, '#9aa0a6'); v.set(i, 1, 6, '#9aa0a6'); v.set(1, 1, i, '#9aa0a6'); v.set(6, 1, i, '#9aa0a6'); }
  v.set(3, 1, 3, '#6f7378'); v.set(4, 1, 4, '#6f7378');
  m.height = 2;
}

// ---------------------------------------------------------------- marcas sobre las casillas
// Texturas de 16×16 sin suavizado. 'danger' es lo más importante de la pantalla: relleno rojo y borde; con alto contraste,
// rayado diagonal y borde grueso claro (se lee sin depender del color).
function overlayTexture(kind, hc) {
  const c = document.createElement('canvas'); c.width = c.height = 16;
  const g = c.getContext('2d');
  const fill = (col, a) => { g.globalAlpha = a; g.fillStyle = col; g.fillRect(0, 0, 16, 16); g.globalAlpha = 1; };
  const border = (col, w, a = 1) => { g.globalAlpha = a; g.fillStyle = col; g.fillRect(0, 0, 16, w); g.fillRect(0, 16 - w, 16, w); g.fillRect(0, 0, w, 16); g.fillRect(16 - w, 0, w, 16); g.globalAlpha = 1; };
  const stripes = (col, a, step = 4) => { g.globalAlpha = a; g.fillStyle = col; for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if ((x + y) % step < step / 2) g.fillRect(x, y, 1, 1); g.globalAlpha = 1; };
  switch (kind) {
    case 'move': fill('#3d55b8', 0.38); border('#9aaef0', 1, 0.95); break;
    case 'range': border('#d9a94e', 1, 0.7); fill('#d9a94e', 0.12); break;
    case 'target': fill('#d9a94e', 0.42); border('#f0c96e', 2); break;
    case 'hover': border('#ffffff', 2); break;
    case 'sel': border('#f0c96e', 2); fill('#f0c96e', 0.18); break;
    case 'danger':
      if (hc) { fill('#120f0d', 0.55); stripes('#ff4a3d', 0.95); border('#fff1c2', 3); }
      else { fill('#e2564c', 0.42); border('#ff7a6e', 2); }
      break;
    case 'dangerHot':
      if (hc) { fill('#120f0d', 0.6); stripes('#ffd166', 1); border('#ffffff', 3); }
      else { fill('#ff4a3d', 0.7); border('#ffd0c8', 2); }
      break;
    case 'flood': stripes('#6fa7cc', hc ? 0.95 : 0.6, 6); border('#9dcbe9', hc ? 3 : 1, 0.9); break;
    case 'incoming': fill('#e2564c', 0.18); border('#e2564c', 1); stripes('#e2564c', 0.35, 8); break;
    default: fill('#ffffff', 0.2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
const LIFT = { flood: 0.02, incoming: 0.022, danger: 0.026, dangerHot: 0.027, range: 0.03, move: 0.032, target: 0.034, sel: 0.036, hover: 0.04 };

// ---------------------------------------------------------------- escena
export default function create(ctx) {
  const { store, audio, bus } = ctx;
  let root, r, dom, b = null, opts = {};
  let alive = false, busy = false, modal = null;
  const offs = [];
  const world = new THREE.Group();
  const tilesG = new THREE.Group(), overG = new THREE.Group(), propsG = new THREE.Group(), unitsG = new THREE.Group(), pickG = new THREE.Group();
  world.add(tilesG, overG, propsG, unitsG, pickG);
  const tileObjs = [];          // por casilla: { t, obj }
  const units = new Map();      // id -> { obj, ring, pick, model, side, type, broken }
  const anims = new Set();
  const camState = { angle: 0.42, pitch: 0.78, target: new THREE.Vector3(), view: 10, turn: 0 };
  const sel = { id: null, mode: 'move', ability: null };
  let hover = null;             // [x, y]
  let lastView = null;
  let region = 'bosque';

  const settings = () => store.state.settings || {};
  const speed = () => Math.max(1, Math.min(3, Number(settings().combatSpeed) || 1)) * (ctx.ui?.reducedMotion?.() ? 3 : 1);
  const hc = () => !!settings().hiContrast;
  const D = (ms) => ms / speed();
  const wait = (ms) => new Promise(res => setTimeout(res, D(ms)));
  function tween(ms, fn) {
    // con tiempo real (no el dt del cuadro): si la máquina va lenta, la animación salta pero termina a tiempo
    return new Promise(res => { const a = { t0: performance.now(), t: 0, dur: Math.max(0.001, D(ms) / 1000), fn, done: res }; anims.add(a); fn(0); });
  }

  // ---------- posiciones ----------
  const cellPos = (x, y) => new THREE.Vector3(x - (b.w - 1) / 2, 0, y - (b.h - 1) / 2);
  const tileAt = (x, y) => b.tiles[y * b.w + x];
  const topAt = (x, y) => topOf(tileAt(x, y)) + (b.flood[y * b.w + x] > 0 ? 0.06 : 0);
  function standPos(x, y) { const p = cellPos(x, y); p.y = topAt(x, y); return p; }
  function screenOf(v3) { return r.toScreen(v3); }
  function tileScreen(x, y, lift = 0.05) { const p = cellPos(x, y); p.y = topAt(x, y) + lift; return screenOf(p); }
  /** La esquina de la casilla más cercana a la cámara (abajo en pantalla): ahí va el número, sin tapar a quien está parado. */
  function frontCorner(x, y) {
    const c = cellPos(x, y), top = topAt(x, y) + 0.05;
    let best = null;
    for (const [dx, dz] of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]]) {
      const s = screenOf(new THREE.Vector3(c.x + dx, top, c.z + dz));
      if (!best || s.y > best.y) best = s;
    }
    return best;
  }
  function unitScreen(id, lift = 0.15) {
    const u = units.get(id);
    if (!u) return null;
    const p = u.obj.position.clone(); p.y += (u.obj.userData.height || 0.8) + lift;
    return screenOf(p);
  }

  // ---------- materiales ----------
  const plane = new THREE.PlaneGeometry(0.96, 0.96);
  const pickBox = new THREE.BoxGeometry(1, 1, 1);
  const pickMat = new THREE.MeshBasicMaterial({ visible: false });
  const ringGeo = new THREE.RingGeometry(0.3, 0.38, 24);
  const ringMats = {
    ally: new THREE.MeshBasicMaterial({ color: 0x6f86e0, transparent: true, opacity: 0.85, depthWrite: false }),
    done: new THREE.MeshBasicMaterial({ color: 0x5a5550, transparent: true, opacity: 0.6, depthWrite: false }),
    enemy: new THREE.MeshBasicMaterial({ color: 0xc94a40, transparent: true, opacity: 0.8, depthWrite: false }),
    sel: new THREE.MeshBasicMaterial({ color: 0xf0c96e, transparent: true, opacity: 1, depthWrite: false }),
  };
  const floodMat = new THREE.MeshLambertMaterial({ color: 0x2c5a66, transparent: true, opacity: 0.72, depthWrite: false });
  const floodGeo = new THREE.BoxGeometry(1, 0.12, 1);
  let overMats = {};
  function buildOverMats() {
    for (const m of Object.values(overMats)) { m.map?.dispose(); m.dispose(); }
    overMats = {};
    for (const k of Object.keys(LIFT)) overMats[k] = new THREE.MeshBasicMaterial({ map: overlayTexture(k, hc()), transparent: true, depthWrite: false });
  }
  function overlay(kind, x, y) {
    const m = new THREE.Mesh(plane, overMats[kind]);
    m.rotation.x = -Math.PI / 2;
    const p = cellPos(x, y);
    m.position.set(p.x, topAt(x, y) + LIFT[kind], p.z);
    m.renderOrder = 5 + Math.round(LIFT[kind] * 100);
    overG.add(m);
    return m;
  }

  // ---------- campo ----------
  function buildTile(i) {
    const x = i % b.w, y = (i / b.w) | 0, t = b.tiles[i];
    const old = tileObjs[i];
    if (old?.t === t) return;
    if (old?.obj) tilesG.remove(old.obj);
    const variant = (x * 7 + y * 13) % 3;
    const obj = voxelModel(`cb:${region}:${t}:${variant}`, 8, 8, (m) => drawTile(m, region, t, variant));
    const p = cellPos(x, y);
    obj.position.set(p.x, 0, p.z);
    tilesG.add(obj);
    tileObjs[i] = { t, obj };
  }
  function buildBoard() {
    tilesG.clear(); tileObjs.length = 0;
    for (let i = 0; i < b.w * b.h; i++) buildTile(i);
    // isla bajo la grilla (sin la columna de la pasarela, que cuelga sobre el vacío)
    const R = REG[region] || REG.bosque;
    const bridgeCols = new Set((b.bridge?.tiles || []).map(i => i % b.w));
    const W = b.w * 8 + 4, Dd = b.h * 8 + 4;
    const g = voxelModel(`cb:ground:${region}:${[...bridgeCols].join('')}`, W, Dd, (m) => {
      const v = m.v;
      for (let x = 0; x < W; x++) for (let z = 0; z < Dd; z++) {
        const col = Math.floor((x - 2) / 8);
        if (bridgeCols.has(col) && x >= 2 && x < W - 2) continue;
        const depth = 3 + ((x * 7 + z * 3) % 5 === 0 ? 1 : 0);
        for (let y = 0; y < depth; y++) v.set(x, 3 - y, z, y === 0 ? ((x < 2 || z < 2 || x >= W - 2 || z >= Dd - 2) ? R.grass[1] : R.dirt) : (x + z + y) % 3 ? R.dirt : R.dirt_d);
      }
    });
    g.position.set(0, -4 / 8, 0);
    tilesG.add(g);
    // pickers de casilla (cajas invisibles)
    pickG.clear();
    for (let i = 0; i < b.w * b.h; i++) {
      const x = i % b.w, y = (i / b.w) | 0;
      const m = new THREE.Mesh(pickBox, pickMat);
      const p = cellPos(x, y);
      m.position.set(p.x, 0.25, p.z); m.scale.set(1, 0.5, 1);
      m.userData.cell = [x, y];
      pickG.add(m);
    }
    buildSurroundings();
  }
  function buildSurroundings() {
    propsG.clear();
    const R = REG[region] || REG.bosque;
    const k = R.tree;
    // monte, peñas o juncos alrededor del campo (que no flote en la nada)
    for (let i = 0; i < 20; i++) {
      const side = i % 4, t = ((i * 37) % 100) / 100;
      const x = side === 0 ? -b.w / 2 - 0.9 : side === 1 ? b.w / 2 + 0.9 : (t - 0.5) * (b.w + 1.4);
      const z = side === 2 ? -b.h / 2 - 0.9 : side === 3 ? b.h / 2 + 1.0 : (t - 0.5) * (b.h + 1.4);
      if (b.bridge && side === 0) continue;
      const variant = i % 3;
      const kind = i % 3 === 0 ? 'roca' : 'arbol';
      const o = voxelModel(`cb:${region}:${kind}:${variant}`, 8, 8, (m) => drawTile(m, region, kind, variant));
      o.position.set(x, -2 / 8, z);
      o.scale.setScalar(0.9);
      propsG.add(o);
    }
    if (b.bridge) {   // el dirigible de la capitana, del otro lado de la pasarela
      const ship = voxelModel('cb:dirigible', 24, 40, (m) => {
        const v = m.v;
        v.sphere(12, 22, 20, 10, 7, 19, (x, y) => (y > 24 ? '#4a3a33' : '#3a2d28'));
        v.box(6, 4, 8, 12, 6, 24, (x, y) => (y === 9 ? '#6b4a32' : '#4a3525'));
        for (let z = 10; z < 30; z += 4) m.light.set(18, 7, z, '#ffc466');
        for (const z of [10, 30]) v.box(11, 10, z, 2, 6, 1, '#3a2a1e');
      });
      ship.position.set(-b.w / 2 - 3.2, -1.2, 0);
      propsG.add(ship);
    }
  }
  function syncProps() {
    // paredes, trampas, agua, refuerzos que llegan
    for (const o of [...propsG.children]) if (o.userData.dyn) propsG.remove(o);
    for (const w of b.walls) {
      const o = voxelModel(`cb:wall:${w.root ? 'raiz' : 'barrera'}`, 8, 8, (m) => drawWall(m, w.root));
      const p = standPos(w.x, w.y); o.position.copy(p); o.userData.dyn = true;
      o.rotation.y = (w.x + w.y) % 2 ? Math.PI / 2 : 0;
      propsG.add(o);
    }
    for (const t of b.traps) {
      const o = voxelModel('cb:trap', 8, 8, drawTrap);
      o.position.copy(standPos(t.x, t.y)); o.userData.dyn = true;
      propsG.add(o);
    }
    for (let i = 0; i < b.flood.length; i++) {
      if (b.flood[i] <= 0) continue;
      const x = i % b.w, y = (i / b.w) | 0;
      const m = new THREE.Mesh(floodGeo, floodMat);
      const p = cellPos(x, y); m.position.set(p.x, topOf(b.tiles[i]) + 0.0, p.z); m.userData.dyn = true; m.renderOrder = 4;
      propsG.add(m);
    }
  }

  // ---------- unidades ----------
  function lookFor(u) {
    if (u.type === 'lider') return store.state.avatar || {};
    const seed = C.hashSeed('exp', u.type === 'cautivo' ? 'minero' : u.type, store.state.created || 1) % 9973;
    return randomLook(seed);
  }
  function makeUnit(u) {
    let model;
    if (u.side === 'ally') {
      // con el equipo de su clase (paso 5b, tercera parte): el líder con la de b.leader, el resto con la suya
      const cls = u.type === 'lider' ? (b?.leader?.cls || store.state.classes?.leader?.cls || null) : (u.cls || (u.type !== 'cautivo' ? u.type : null));
      model = avatarModel(lookFor(u), u.type === 'lider' ? { player: true, cls } : { npc: true, cls });
      const k = u.type === 'lider' ? 0.92 : 0.84;
      model.scale.setScalar(k);
      model.userData.height = (model.userData.height || 1) * k;
    } else {
      // los jefes en low-poly facetado (boss-models.js, plan §M1); el resto, vóxel
      model = bossModel(u.type, { phase: u.phase || 0 }) || enemyModel(u.type, { broken: u.type === 'bicho' && u.armor === 0 });
    }
    const obj = new THREE.Group();
    obj.add(model);
    obj.userData.height = model.userData.height || 0.8;
    const ring = new THREE.Mesh(ringGeo, u.side === 'ally' ? ringMats.ally : ringMats.enemy);
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.025; ring.renderOrder = 7;
    if (u.boss) ring.scale.setScalar(1.35);
    obj.add(ring);
    const pick = new THREE.Mesh(pickBox, pickMat);
    pick.scale.set(0.7, Math.max(0.6, obj.userData.height), 0.7); pick.position.y = pick.scale.y / 2;
    pick.userData.unit = u.id;
    obj.add(pick);
    if (u.captive) {   // atado: soga alrededor
      const rope = voxelModel('cb:soga', 8, 8, (m) => { for (let x = 1; x < 7; x++) for (const z of [1, 6]) m.v.set(x, 3, z, '#8a7550'); for (let z = 1; z < 7; z++) for (const x of [1, 6]) m.v.set(x, 3, z, '#8a7550'); m.v.box(1, 5, 1, 6, 1, 6, (x, y, z) => ((x + z) % 2 ? '#8a7550' : null)); });
      rope.scale.setScalar(0.7); rope.userData.rope = true;
      obj.add(rope);
    }
    const rec = { obj, model, ring, pick, side: u.side, type: u.type, broken: u.type === 'bicho' && u.armor === 0, captive: !!u.captive, freed: !!u.freed };
    units.set(u.id, rec);
    unitsG.add(obj);
    return rec;
  }
  const faceOf = (dir) => Math.atan2(dir[0], dir[1]);
  function syncUnits(snap = true) {
    const seen = new Set();
    for (const u of b.units) {
      if (!u.alive || u.safe) continue;
      seen.add(u.id);
      let rec = units.get(u.id);
      const broken = u.type === 'bicho' && u.armor === 0;
      if (rec && rec.broken !== broken) { unitsG.remove(rec.obj); units.delete(u.id); rec = null; }
      if (!rec) rec = makeUnit(u);
      if (rec.captive && u.freed && !rec.freed) { rec.freed = true; for (const c of [...rec.obj.children]) if (c.userData.rope) rec.obj.remove(c); }
      if (snap && !rec.moving) {
        rec.obj.position.copy(standPos(u.x, u.y));
        rec.model.rotation.set(0, faceOf(u.dir || [0, 1]), 0);
        rec.model.position.set(0, 0, 0);
        rec.obj.scale.setScalar(1);
      }
      const isSel = u.id === sel.id;
      rec.ring.material = u.side === 'enemy' ? ringMats.enemy : isSel ? ringMats.sel : (u.acted || (u.captive && !u.freed)) ? ringMats.done : ringMats.ally;
    }
    for (const [id, rec] of [...units]) if (!seen.has(id)) { unitsG.remove(rec.obj); units.delete(id); }
  }

  // ---------- vista ----------
  const unitView = (id) => lastView?.units.find(u => u.id === id) || null;
  const abilityDef = (id) => (id?.startsWith('item:') ? ITEMS[id.slice(5)] : ABILITIES[id]);
  function rangeTiles(u, id, fx = u.x, fy = u.y) {
    const def = abilityDef(id);
    if (!def) return [];
    let [mn, mx] = def.range;
    if (def.ranged && tileAt(fx, fy) === 'alto') mx += COMBAT.highRange;
    const out = [];
    for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) { const d = Math.abs(x - fx) + Math.abs(y - fy); if (d >= mn && d <= mx) out.push([x, y]); }
    return out;
  }
  function canAct(u) { return u && u.side === 'ally' && !u.acted && !(u.captive && !u.freed) && !b.ended && b.phase === 'player'; }
  function canMove(u) { return canAct(u) && !u.moved; }
  function defaultAbility(u) {
    const list = C.abilitiesOf(b, u.id).filter(a => a.ready && !a.item);
    return (list.find(a => a.def.kind === 'attack' && C.targets(b, u.id, a.id).length) || null)?.id || null;
  }

  function refresh() {
    if (!b || !r) return;
    lastView = C.view(b);
    // si la unidad elegida ya no puede hacer nada, pasar a la siguiente
    const su = C.unitById(b, sel.id);
    if (!su || !su.alive || su.safe) sel.id = null;
    if (sel.id && sel.mode === 'ability' && !C.abilitiesOf(b, sel.id).some(a => a.id === sel.ability && a.ready)) { sel.mode = 'move'; sel.ability = null; }
    syncUnits(true);
    syncProps();
    drawOverlays();
    dom.update(lastView, uiState());
    placeTags();
  }
  function uiState() {
    return { sel: sel.id, mode: sel.mode, ability: sel.ability, busy, hover, battle: b, hc: hc() };
  }
  function drawOverlays() {
    overG.clear();
    if (!b) return;
    const v = lastView;
    const hu = hover ? C.unitAt(b, hover[0], hover[1]) : null;
    const hotIntent = hu && hu.side === 'enemy' ? (unitView(hu.id)?.intent?.tiles || []) : [];
    const hot = new Set(hotIntent.map(([x, y]) => x + ',' + y));
    for (const t of v.tiles) {
      if (t.incoming) overlay('incoming', t.x, t.y);
      if (t.floodNext) overlay('flood', t.x, t.y);
      if (t.danger > 0) overlay(hot.has(t.x + ',' + t.y) ? 'dangerHot' : 'danger', t.x, t.y);
    }
    const u = C.unitById(b, sel.id);
    if (u && !busy && !b.ended) {
      overlay('sel', u.x, u.y);
      if (sel.mode === 'move' && canMove(u)) {
        for (const c of C.reachable(b, u.id)) if (c.x !== u.x || c.y !== u.y) overlay('move', c.x, c.y);
        // alcance del ataque básico desde la casilla del mouse (si se puede llegar)
        const ab = defaultAbilityAny(u);
        if (hover && ab && C.reachable(b, u.id).some(c => c.x === hover[0] && c.y === hover[1])) for (const [x, y] of rangeTiles(u, ab, hover[0], hover[1])) overlay('range', x, y);
      }
      if (sel.mode === 'ability' && sel.ability) {
        for (const [x, y] of rangeTiles(u, sel.ability)) overlay('range', x, y);
        for (const c of C.targets(b, u.id, sel.ability)) overlay('target', c.x, c.y);
      }
    }
    if (hover && !busy) overlay('hover', hover[0], hover[1]);
  }
  function defaultAbilityAny(u) { return C.abilitiesOf(b, u.id).find(a => a.def.kind === 'attack')?.id || null; }

  // etiquetas DOM sobre las unidades y las casillas (vida, daño marcado, vista previa)
  function placeTags() {
    if (!dom || !lastView || !r) return;
    const tags = [];
    for (const u of lastView.units) { const s = unitScreen(u.id); if (s) tags.push({ ...u, sx: s.x, sy: s.y, sel: u.id === sel.id }); }
    dom.unitTags(tags);
    const chips = [];
    for (const t of lastView.tiles) {
      if (t.danger > 0) { const s = frontCorner(t.x, t.y); chips.push({ sx: s.x, sy: s.y, text: '−' + t.danger, cls: 'danger' }); }
      if (t.incoming) { const s = tileScreen(t.x, t.y, 0.3); chips.push({ sx: s.x, sy: s.y, text: 'Llega', cls: 'incoming' }); }
    }
    dom.tileChips(busy ? [] : chips);
    dom.preview(busy ? [] : previewChips());
  }
  function previewChips() {
    const u = C.unitById(b, sel.id);
    if (!u || !hover || b.ended) return [];
    let pv = null;
    if (sel.mode === 'ability' && sel.ability && C.targets(b, u.id, sel.ability).some(c => c.x === hover[0] && c.y === hover[1])) pv = C.preview(b, u.id, sel.ability, hover[0], hover[1]);
    else if (sel.mode === 'move' && canAct(u)) {
      const o = C.unitAt(b, hover[0], hover[1]);
      const ab = defaultAbility(u);
      if (o && o.side === 'enemy' && ab && C.targets(b, u.id, ab).some(c => c.x === hover[0] && c.y === hover[1])) pv = C.preview(b, u.id, ab, hover[0], hover[1]);
    }
    if (!pv?.ok) return [];
    const acc = new Map();
    for (const e of pv.events) {
      if (e.type === 'dmg') acc.set(e.id, { ...(acc.get(e.id) || {}), dmg: (acc.get(e.id)?.dmg || 0) + e.amount });
      if (e.type === 'heal') acc.set(e.id, { ...(acc.get(e.id) || {}), heal: (acc.get(e.id)?.heal || 0) + e.amount });
      if (e.type === 'down') acc.set(e.id, { ...(acc.get(e.id) || {}), down: true });
      if (e.type === 'cancel') acc.set(e.id, { ...(acc.get(e.id) || {}), cancel: true });
      if (e.type === 'combo') acc.set('combo:' + e.id, { combo: e.id });
    }
    const out = [];
    for (const [id, a] of acc) {
      if (a.combo) continue;
      const s = unitScreen(id, 0.45);
      if (!s) continue;
      const parts = [];
      if (a.dmg) parts.push('−' + a.dmg);
      if (a.heal) parts.push('+' + a.heal);
      if (a.down) parts.push('cae');
      if (a.cancel) parts.push('sin golpe');
      out.push({ sx: s.x, sy: s.y, text: parts.join(' · '), cls: a.heal && !a.dmg ? 'heal' : 'dmg' });
    }
    return out;
  }

  // ---------- animación de eventos ----------
  async function walk(rec, path, ms = 150) {
    if (!rec || !path || path.length < 2) return;
    rec.moving = true;
    for (let k = 1; k < path.length; k++) {
      const a = rec.obj.position.clone(), z = standPos(path[k][0], path[k][1]);
      rec.model.rotation.y = Math.atan2(path[k][0] - path[k - 1][0], path[k][1] - path[k - 1][1]);
      await tween(ms, (t) => { rec.obj.position.lerpVectors(a, z, t); rec.obj.position.y = a.y + (z.y - a.y) * t + Math.sin(t * Math.PI) * 0.08; });
    }
    rec.moving = false;
  }
  async function lunge(rec, at, ms = 120) {
    if (!rec || !at) return;
    const p = rec.obj.position, tgt = standPos(at[0], at[1]);
    const dx = tgt.x - p.x, dz = tgt.z - p.z, d = Math.hypot(dx, dz);
    if (d < 0.01) { await tween(ms * 1.4, (t) => { rec.model.position.y = Math.sin(t * Math.PI) * 0.14; }); return; }
    rec.model.rotation.y = Math.atan2(dx, dz);
    const k = Math.min(0.35, d * 0.3);
    await tween(ms, (t) => rec.model.position.set(dx / d * k * t, Math.sin(t * Math.PI) * 0.05, dz / d * k * t));
    await tween(ms, (t) => rec.model.position.set(dx / d * k * (1 - t), 0, dz / d * k * (1 - t)));
  }
  async function shake(rec, ms = 200) {
    if (!rec) return;
    await tween(ms, (t) => { const a = Math.sin(t * Math.PI * 6) * 0.06 * (1 - t); rec.model.position.x = a; rec.obj.scale.set(1 + 0.08 * Math.sin(t * Math.PI), 1 - 0.12 * Math.sin(t * Math.PI), 1 + 0.08 * Math.sin(t * Math.PI)); });
    rec.model.position.x = 0; rec.obj.scale.setScalar(1);
  }
  function floatAt(id, html, cls = '', lift = 0.35) {
    const s = unitScreen(id, lift);
    if (s) dom.float(s.x, s.y, html, cls);
  }
  function floatTile(x, y, html, cls = '') { const s = tileScreen(x, y, 0.4); dom.float(s.x, s.y, html, cls); }
  const unitName = (id) => { const u = C.unitById(b, id); return u ? (u.side === 'ally' ? (dom.labelOf(unitView(id)) || u.type) : ENEMIES[u.type]?.name) : ''; };
  const ABIL_SFX = { attack: 'bump', heal: 'pop', healArea: 'pop', mark: 'select', trap: 'place', wall: 'build', push: 'bump', swap: 'swoosh', root: 'place', disarm: 'coin', free: 'pop', dazzle: 'clear', cover: 'place', rope: 'swoosh' };

  async function playOne(e) {
    const rec = e.id ? units.get(e.id) : null;
    switch (e.type) {
      case 'move': case 'enemyMove': audio.sfx('tap'); await walk(rec, e.path, e.type === 'move' ? 140 : 150); break;
      case 'act': {
        const def = abilityDef(e.ability);
        audio.sfx(ABIL_SFX[def?.kind] || 'tap');
        await lunge(rec, e.at);
        if (def && !['attack', 'push', 'disarm'].includes(def.kind)) floatAt(e.id, def.name, 'act');
        break;
      }
      case 'strike': {
        audio.sfx('crash');
        const ex = C.unitById(b, e.id);
        const at = e.tiles?.[0] || (ex ? [ex.x + (ex.dir?.[0] || 0), ex.y + (ex.dir?.[1] || 1)] : null);
        flashTiles(e.tiles || []);
        await lunge(rec, at, 130);
        break;
      }
      case 'dmg': {
        floatAt(e.id, `−${e.amount}`, e.src === 'env' ? 'dmg env' : 'dmg');
        audio.sfx('bump');
        await shake(rec, 220);
        dom.pulseHp(e.id, e.hp);
        break;
      }
      case 'heal': floatAt(e.id, `+${e.amount}`, 'heal'); await wait(160); break;
      case 'down': {
        audio.sfx('lose');
        if (rec) {
          const r0 = rec.model.rotation.z;
          await tween(320, (t) => { rec.model.rotation.z = r0 + t * 1.3; rec.obj.scale.setScalar(1 - t * 0.85); rec.obj.position.y -= 0.002; });
          unitsG.remove(rec.obj); units.delete(e.id);
        }
        break;
      }
      case 'push': {
        if (e.blocked) { await shake(rec, 160); break; }
        const z = standPos(e.to[0], e.to[1]), a = rec?.obj.position.clone();
        if (rec) { rec.moving = true; await tween(170, (t) => rec.obj.position.lerpVectors(a, z, t)); rec.moving = false; }
        break;
      }
      case 'swap': {
        const A = units.get(e.a), B = units.get(e.b);
        if (A && B) {
          const pa = A.obj.position.clone(), pb = B.obj.position.clone();
          A.moving = B.moving = true;
          await tween(240, (t) => { A.obj.position.lerpVectors(pa, pb, t); B.obj.position.lerpVectors(pb, pa, t); A.obj.position.y += Math.sin(t * Math.PI) * 0.3; });
          A.moving = B.moving = false;
        }
        audio.sfx('swoosh');
        break;
      }
      case 'mark': floatAt(e.id, 'Marcado +3', 'mark'); break;
      case 'trap': syncProps(); floatTile(e.at[0], e.at[1], 'Trampa', 'act'); break;
      case 'trapHit': floatTile(e.at[0], e.at[1], '¡Trampa!', 'mark'); audio.sfx('crash'); await wait(120); break;
      case 'root': floatAt(e.id, 'Frenado', 'mark', 0.7); break;
      case 'cancel': floatAt(e.id, 'Sin golpe', 'act', 0.7); break;
      case 'stolen': floatAt(e.id, 'Robado', 'heal', 0.95); audio.sfx('coin'); break;
      case 'explode': audio.sfx('crash'); floatTile(e.at[0], e.at[1], '¡Revienta!', 'dmg'); flashTiles([[e.at[0] - 1, e.at[1]], [e.at[0] + 1, e.at[1]], [e.at[0], e.at[1] - 1], [e.at[0], e.at[1] + 1]]); await wait(160); break;
      case 'nip': floatAt(e.id, 'Acoso', 'act', 0.6); break;
      case 'wall': syncProps(); audio.sfx('build'); break;
      case 'wallGone': syncProps(); break;
      case 'rockBroken': buildTile(e.at[1] * b.w + e.at[0]); audio.sfx('crash'); break;
      case 'flood': syncProps(); audio.sfx('swoosh'); dom.banner('El agua sube', '', 'water'); await wait(380); break;
      case 'bridge': floatTile(b.bridge?.tiles?.[0] % b.w || 0, ((b.bridge?.tiles?.[0] || 0) / b.w) | 0, `Pasarela ${e.hp}`, 'act'); break;
      case 'bridgeCut': for (const i of b.bridge?.tiles || []) buildTile(i); audio.sfx('crash'); dom.banner('Cortaron la pasarela', 'No llegan más refuerzos.', 'good'); await wait(500); break;
      case 'cover': floatAt(e.id, 'Lona', 'act'); break;
      case 'rope': floatAt(e.id, 'Cuerda', 'act'); break;
      case 'spawn': {
        const u = C.unitById(b, e.id);
        if (u && !units.get(e.id)) {
          const nr = makeUnit(u);
          const z = standPos(e.at[0], e.at[1]);
          nr.moving = true;
          nr.model.rotation.y = faceOf(u.dir || [0, 1]);
          await tween(300, (t) => { nr.obj.position.set(z.x, z.y + (1 - t) * 1.2, z.z); nr.obj.scale.setScalar(0.4 + 0.6 * t); });
          nr.moving = false;
        }
        audio.sfx('horn');
        break;
      }
      case 'combo': dom.banner('Combo', comboName(e.id), 'combo'); audio.sfx('combo', 2); await wait(420); break;
      case 'phase': units.get(e.id)?.model.userData.setPhase?.(e.phase); dom.banner(unitName(e.id), e.text, 'boss'); audio.sfx('horn'); await wait(900); break;
      case 'free': floatAt(e.id, 'Libre', 'heal'); syncUnits(false); break;
      case 'rescued': floatAt(e.id, '¡A salvo!', 'heal'); break;
      case 'enemyPhase': dom.banner('Turno enemigo', '', 'enemy'); await wait(500); break;
      case 'turn': dom.banner(`Turno ${e.turn}`, '', ''); break;
      default: break;
    }
  }
  const comboName = (id) => ({ marca: 'Marcar y pegar', empuje_trampa: 'A la trampa', empuje_choque: 'Contra la pared', fuego_amigo: 'Entre ellos', reventon: 'Reventón', desde_alto: 'Desde arriba', sin_coraza: 'Sin coraza' }[id] || id);
  const flashMeshes = new Set();
  function flashTiles(list) {
    for (const [x, y] of list) {
      if (x < 0 || y < 0 || x >= b.w || y >= b.h) continue;
      const m = overlay('dangerHot', x, y);
      flashMeshes.add(m);
      setTimeout(() => { overG.remove(m); flashMeshes.delete(m); }, D(320));
    }
  }
  let playing = null;
  async function play(events) {
    busy = true;
    drawOverlays(); placeTags(); dom.update(lastView, uiState());
    for (const e of events) {
      if (!alive) return;
      playing = e.type;
      await playOne(e);
      if (e.type !== 'intent' && e.type !== 'incoming' && e.type !== 'floodNext') await wait(50);
    }
    busy = false; playing = null;
    if (!alive) return;
    if (b.ended) { refresh(); opts.onSave?.(b); showResult(); return; }
    if (!C.unitById(b, sel.id) || !canAct(C.unitById(b, sel.id))) autoSelect();
    refresh();
    opts.onSave?.(b);
  }

  // ---------- acciones ----------
  function select(id, mode = null) {
    const u = C.unitById(b, id);
    if (!u || u.side !== 'ally') return;
    if (u.captive && !u.freed) return;
    sel.id = id;
    sel.mode = mode || (canMove(u) ? 'move' : 'ability');
    sel.ability = sel.mode === 'ability' ? defaultAbility(u) : null;
    if (sel.mode === 'ability' && !sel.ability) sel.mode = 'move';
    audio.sfx('select');
    refresh();
  }
  function autoSelect() {
    const al = b.units.filter(u => u.alive && !u.safe && u.side === 'ally' && canAct(u));
    const cur = C.unitById(b, sel.id);
    const next = al.find(u => u.id !== cur?.id) || al[0];
    sel.id = next?.id || null; sel.mode = next && canMove(next) ? 'move' : 'ability';
    sel.ability = next && sel.mode === 'ability' ? defaultAbility(next) : null;
    if (sel.mode === 'ability' && !sel.ability) sel.mode = 'move';
  }
  function cycle(dir = 1) {
    const al = b.units.filter(u => u.alive && !u.safe && u.side === 'ally' && !(u.captive && !u.freed));
    if (!al.length) return;
    const i = al.findIndex(u => u.id === sel.id);
    const order = [...al.slice(i + 1), ...al.slice(0, i + 1)];
    const next = order.find(canAct) || order[0];
    select(next.id);
  }
  function chooseAbility(id) {
    const u = C.unitById(b, sel.id);
    if (!canAct(u)) { dom.hint('Esta unidad ya actuó en este turno.'); audio.sfx('error'); return; }
    const av = C.abilitiesOf(b, u.id).find(a => a.id === id);
    if (!av) return;
    if (!av.ready) { dom.hint(`${av.def.name}: falta${av.cd > 1 ? 'n' : ''} ${av.cd} turno${av.cd > 1 ? 's' : ''}.`); audio.sfx('error'); return; }
    if (sel.mode === 'ability' && sel.ability === id) { sel.mode = 'move'; sel.ability = null; refresh(); return; }
    sel.mode = 'ability'; sel.ability = id;
    // las que se usan sobre uno mismo y no tienen otro blanco: se confirman con otro clic o Enter
    const tg = C.targets(b, u.id, id);
    if (!tg.length) dom.hint(`${av.def.name}: no hay a quién apuntar desde acá.`);
    else dom.hint(av.def.range[1] === 0 ? `${av.def.name}: hacé clic en la unidad (o Enter) para usarla.` : `${av.def.name}: elegí el blanco.`);
    audio.sfx('select');
    refresh();
  }
  function doMove(x, y) {
    const res = C.move(b, sel.id, x, y);
    if (!res.ok) { dom.hint(res.why); audio.sfx('error'); return false; }
    guideOn('moved');
    const u = C.unitById(b, sel.id);
    sel.mode = 'ability'; sel.ability = u ? defaultAbility(u) : null;
    if (!sel.ability) sel.mode = 'move';
    play(res.events);
    return true;
  }
  function doAct(id, x, y) {
    const res = C.act(b, sel.id, id, x, y);
    if (!res.ok) { dom.hint(res.why); audio.sfx('error'); return false; }
    guideOn('acted');
    sel.mode = 'move'; sel.ability = null;
    play(res.events);
    return true;
  }
  function clickCell(x, y) {
    if (busy || modal || !b || b.ended) return;
    const u = C.unitById(b, sel.id);
    const o = C.unitAt(b, x, y);
    if (sel.mode === 'ability' && sel.ability && u && C.targets(b, u.id, sel.ability).some(c => c.x === x && c.y === y)) { doAct(sel.ability, x, y); return; }
    if (o && o.side === 'ally' && o.id !== sel.id && !(o.captive && !o.freed)) { select(o.id); return; }
    if (o && o.id === sel.id) { if (sel.mode === 'ability') { sel.mode = 'move'; sel.ability = null; refresh(); } return; }
    if (o && o.side === 'enemy' && u && canAct(u)) {
      const ab = defaultAbility(u);
      if (ab && C.targets(b, u.id, ab).some(c => c.x === x && c.y === y)) { doAct(ab, x, y); return; }
      dom.hint('No llega desde acá: acercate o elegí otra habilidad.');
      return;
    }
    if (u && sel.mode === 'move' && canMove(u) && C.reachable(b, u.id).some(c => c.x === x && c.y === y)) { doMove(x, y); return; }
    if (sel.mode === 'ability') { sel.mode = canMove(u) ? 'move' : 'ability'; if (sel.mode === 'move') sel.ability = null; refresh(); }
  }
  function confirmSelf() {
    const u = C.unitById(b, sel.id);
    if (sel.mode === 'ability' && sel.ability && u && C.targets(b, u.id, sel.ability).some(c => c.x === u.x && c.y === u.y)) doAct(sel.ability, u.x, u.y);
  }
  function pendingAllies() {
    return b.units.filter(u => u.alive && !u.safe && u.side === 'ally' && !(u.captive && !u.freed) && !u.acted);
  }
  async function endTurn(force = false) {
    if (busy || modal || !b || b.ended || b.phase !== 'player') return;
    const left = pendingAllies();
    if (!force && settings().confirmEnd !== false && left.length) {
      modal = dom.confirmEnd(left.map(u => dom.labelOf(unitView(u.id)) || u.type), (ok) => { modal = null; if (ok) endTurn(true); });
      return;
    }
    const r1 = C.endTurn(b);
    if (!r1.ok) return;
    sel.mode = 'move'; sel.ability = null;
    busy = true;
    await play(r1.events);
    const r2 = C.enemyTurn(b);
    if (!r2.ok) { busy = false; refresh(); return; }
    await play(r2.events);
    if (!b.ended) {
      autoSelect(); refresh();
      // después del turno enemigo, la pista que toca: lo que llega, las casillas marcadas o los roles
      if (b.incoming?.length) guideOn('wave');
      else if (C.view(b).units.some(u => u.intent && !u.intent.hidden)) guideOn('marks') || (b.turn >= 3 && guideOn('roles'));
    }
  }
  /** Muestra la pista de ese momento si la pelea es la guiada y todavía no se vio. Devuelve true si mostró una. */
  function guideOn(when) {
    if (!opts.guided || !dom || !b || b.ended) return false;
    const st = store.state;
    st.tutorial ||= {};
    const tips = (st.tutorial.combatTips ||= {});
    const g = GUIDE_TIPS.find(t => t.when === when && !tips[t.id]);
    if (!g) return false;
    tips[g.id] = Date.now();
    store.markDirty();
    dom.guide(g.text);
    // el contacto del combate se cuenta acá: la Bitácora lo muestra y la ciudad no lo repite
    if (g.id === 'intro') { try { markSeen('c_combate'); } catch {} }
    return true;
  }
  function retreat() {
    const res = C.retreat(b);
    if (res.ok) { opts.onSave?.(b); refresh(); showResult(); }
  }
  function showResult() {
    const res = C.result(b);
    audio.sfx(res.outcome === 'win' ? 'win' : 'lose');
    if (modal) modal.close?.();
    dom.guide(null);
    // en la expedición no hay reintento: perder ya cuesta ánimo y la casilla sigue ahí para volver a probar
    modal = dom.openResult(res, { boss: b.kind === 'jefe', bossName: ENEMIES[b.units.find(u => u.side === 'enemy' && ENEMIES[u.type].boss)?.type]?.name, test: !opts.onEnd, noRetry: !!opts.expedition || !!opts.noRetry }, (a) => {
      modal = null;
      if (a === 'retry') { start({ ...opts, battle: null, attempt: res.outcome === 'lose' && b.kind === 'jefe' ? (b.attempt || 1) + 1 : b.attempt || 1, seed: (b.seed + 1) >>> 0 }); return; }
      if (opts.onEnd) opts.onEnd(res, b);
      else ctx.router.go('city');
    });
    try { bus.emit('combat:end', { result: res }); } catch {}
  }
  function openEscMenu() {
    if (modal || !b) return;
    modal = dom.openMenu({ canRetreat: !b.ended, test: !opts.onEnd }, (a) => {
      modal = null;
      if (a === 'retreat') retreat();
      if (a === 'settings') ctx.openPanel?.('settings');
      if (a === 'city') ctx.router.go('city');
    });
  }

  // ---------- entrada ----------
  const ray = new THREE.Raycaster();
  function pickAt(cx, cy) {
    if (!r) return null;
    ray.setFromCamera(r.toNDC(cx, cy), r.camera);
    world.updateMatrixWorld(true);
    const unitPicks = [...units.values()].map(u => u.pick);
    const hu = ray.intersectObjects(unitPicks, false)[0];
    if (hu) { const u = C.unitById(b, hu.object.userData.unit); if (u && u.alive) return [u.x, u.y]; }
    const ht = ray.intersectObjects(pickG.children, false)[0];
    return ht ? ht.object.userData.cell : null;
  }
  let down = null;
  function onMove(e) {
    if (!b) return;
    const c = pickAt(e.clientX, e.clientY);
    const k = c ? c.join(',') : '';
    if (k === (hover ? hover.join(',') : '')) return;
    hover = c;
    drawOverlays(); placeTags();
    dom.hoverCard(c ? unitView(C.unitAt(b, c[0], c[1])?.id) : null, c ? lastView.tiles[c[1] * b.w + c[0]] : null);
  }
  function onDown(e) { down = { x: e.clientX, y: e.clientY, btn: e.button }; }
  function onUp(e) {
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y), btn = down.btn;
    down = null;
    if (moved > 10 || modal) return;
    if (btn === 2) { if (sel.mode === 'ability') { sel.mode = 'move'; sel.ability = null; refresh(); } return; }
    const c = pickAt(e.clientX, e.clientY);
    if (c) clickCell(c[0], c[1]);
  }
  function onKey(e) {
    if (!alive || !b) return;
    if (e.target?.closest?.('input, textarea, select')) return;
    const k = e.key;
    if (k === 'Escape') {
      e.preventDefault();
      if (modal) { modal.cancel?.(); return; }
      if (sel.mode === 'ability') { sel.mode = 'move'; sel.ability = null; refresh(); return; }
      openEscMenu();
      return;
    }
    if (modal) { if (k === 'Enter' || (k === ' ' && modal.space)) { e.preventDefault(); modal.ok?.(); } return; }
    if (busy) return;
    if (k === ' ' || e.code === 'Space') { e.preventDefault(); endTurn(); return; }
    if (/^[1-9]$/.test(k)) {
      e.preventDefault();
      const list = dom.barIds();
      const id = list[Number(k) - 1];
      if (id) chooseAbility(id);
      return;
    }
    if (k === 'Tab') { e.preventDefault(); cycle(e.shiftKey ? -1 : 1); return; }
    if (k === 'Enter') { e.preventDefault(); confirmSelf(); return; }
    const rot = actionFor(e.code, ['rotL', 'rotR']);
    if (rot) { e.preventDefault(); rotate(rot === 'rotL' ? -1 : 1); }
  }

  // ---------- cámara ----------
  function fitCamera(animate = false) {
    if (!r || !root || !b) return;
    const stage = root.querySelector('.cb-stage');
    const W = stage.clientWidth || innerWidth, H = stage.clientHeight || innerHeight;
    const angle = camState.angle + camState.turn * Math.PI / 2;
    const tgt = new THREE.Vector3(0, 0.3, 0);
    setIsoCamera(r.camera, tgt, angle, 60, camState.pitch);
    r.camera.updateMatrixWorld(true);
    const inv = r.camera.matrixWorldInverse, v3 = new THREE.Vector3();
    let mnx = Infinity, mxx = -Infinity, mny = Infinity, mxy = -Infinity;
    for (let i = 0; i < 8; i++) {
      v3.set(i & 1 ? b.w / 2 : -b.w / 2, i & 2 ? 1.2 : -0.4, i & 4 ? b.h / 2 : -b.h / 2).applyMatrix4(inv);
      mnx = Math.min(mnx, v3.x); mxx = Math.max(mxx, v3.x); mny = Math.min(mny, v3.y); mxy = Math.max(mxy, v3.y);
    }
    const ins = dom.insets();   // px tapados por la interfaz arriba, abajo y a los costados
    const freeH = Math.max(200, H - ins.top - ins.bottom), freeW = Math.max(240, W - ins.left - ins.right);
    const view = Math.max((mxy - mny) * H / freeH, (mxx - mnx) * H / freeW) * 1.04;
    const up = new THREE.Vector3().setFromMatrixColumn(r.camera.matrixWorld, 1);
    const right = new THREE.Vector3().setFromMatrixColumn(r.camera.matrixWorld, 0);
    const shiftY = (ins.top - ins.bottom) / 2, shiftX = (ins.left - ins.right) / 2;
    tgt.addScaledVector(up, (mny + mxy) / 2 + shiftY * view / H).addScaledVector(right, (mnx + mxx) / 2 - shiftX * view / H);
    const from = camState.target.clone(), fromView = camState.view, fromA = camState.curAngle ?? angle;
    camState.target.copy(tgt); camState.view = view; camState.curAngle = angle;
    if (!animate) { setIsoCamera(r.camera, tgt, angle, 60, camState.pitch); r.setViewSize(view); return; }
    tween(280, (k) => {
      const e = 1 - (1 - k) * (1 - k);
      setIsoCamera(r.camera, from.clone().lerp(tgt, e), fromA + (angle - fromA) * e, 60, camState.pitch);
      r.setViewSize(fromView + (view - fromView) * e);
      if (k >= 1) placeTags();
    });
  }
  function rotate(dir) { camState.turn += dir; fitCamera(true); audio.sfx('swoosh'); }

  // ---------- armado ----------
  function listParam(s) { return String(s || '').split(',').map(x => x.trim()).filter(Boolean); }
  function toolsParam(s) { const o = {}; for (const kv of listParam(s)) { const [k, n] = kv.split(':'); o[k] = Math.max(0, Math.min(5, Number(n ?? 1) || 0)); } return o; }
  function newFromParams(p) {
    const encounter = ENCOUNTERS[p.encounter] ? p.encounter : 'bosque_claro';
    return C.newBattle({
      encounter, seed: Number(p.seed ?? 7) >>> 0,
      party: Array.isArray(p.party) ? p.party : listParam(p.party).length ? listParam(p.party) : TUTORIAL_PARTY.slice(),
      level: Math.max(1, Math.min(30, Number(p.level) || 1)), element: p.element || null,
      tools: typeof p.tools === 'string' ? toolsParam(p.tools) : p.tools || {},
      equip: Array.isArray(p.equip) ? p.equip : listParam(p.equip),
      roleLevel: p.roleLevel || {}, attempt: Math.max(1, Number(p.attempt) || 1),
      // clases (paso 5b): la del líder viene de la partida si no la manda quien abre la pelea
      leader: p.leader || (() => { const L = store.state.classes?.leader; return L?.cls ? { cls: L.cls, sub: L.sub || null, picks: L.picks || [] } : null; })(),
      classLevel: p.classLevel || null, picks: p.picks || {},
    });
  }
  function start(p) {
    opts = p;
    b = p.battle && p.battle.v === 1 ? p.battle : newFromParams(p);
    region = ENCOUNTERS[b.enc]?.region || 'bosque';
    for (const rec of units.values()) unitsG.remove(rec.obj);
    units.clear(); overG.clear(); propsG.clear();
    const R = REG[region] || REG.bosque;
    r.scene.background = new THREE.Color(R.bg);
    const hex = (n) => '#' + n.toString(16).padStart(6, '0');
    amb.setBase({ sky: [[hex(R.bg), 0], [hex(R.bg), 100]], stars: 0, hemiSky: hex(R.hemi[0]), hemiGround: hex(R.hemi[1]), hemiI: R.hemi[2] * 1.45, sun: hex(R.sun[0]), sunI: R.sun[1] * 1.4 });
    const cond = combatConditions(p.conditions || {});
    const qs = new URLSearchParams(location.search);
    const qHour = qs.has('hour') ? Number(qs.get('hour')) : null, qWeather = WEATHER[qs.get('weather')] ? qs.get('weather') : null;
    amb.set({ hour: qHour ?? cond.hour, weather: qWeather ?? cond.weather, place: cond.place, region, light: store.state.world?.light ?? 1 }, { now: true });
    buildBoard();
    sel.id = null; hover = null; busy = false;
    autoSelect();
    refresh();
    fitCamera();
    placeTags();
    if (b.turn === 1 && b.phase === 'player') dom.banner(ENCOUNTERS[b.enc].name, ENCOUNTERS[b.enc].text, 'intro', 2600);
    if (opts.guided) setTimeout(() => { if (alive && b && !b.ended) guideOn('start') || (b.turn >= 3 && guideOn('roles')); }, b.turn === 1 ? 2400 : 400);
    opts.onSave?.(b);
  }

  let lights = null, amb = null, frameN = 0;
  return {
    hud: false,
    music: audio.songs?.includes?.('threat') ? 'threat' : 'game',
    async mount(container, p = {}) {
      alive = true;
      const params = { ...(p || {}) };
      const qs = new URLSearchParams(location.search);
      const map = { enc: 'encounter', seed: 'seed', party: 'party', level: 'level', element: 'element', tools: 'tools', equip: 'equip', attempt: 'attempt' };
      for (const [q, k] of Object.entries(map)) if (params[k] == null && qs.has(q)) params[k] = qs.get(q);
      root = container;
      dom = buildCombatUi(root, ctx, {
        onAbility: (id) => chooseAbility(id),
        onEnd: () => endTurn(),
        onMenu: () => openEscMenu(),
        onSelect: (id) => { if (!busy && !modal) select(id); },
        onRotate: (d) => rotate(d),
      });
      buildOverMats();
      const stage = root.querySelector('.cb-stage');
      r = createPixelRenderer(stage, { ortho: true, viewSize: 10, background: 0x141a17, outline: true, idleFps: 30 });
      lights = addLights(r.scene, { shadowSize: 14, shadowRes: 1024 });
      lights.sun.position.set(-7, 18, 9);
      amb = createAmbience(r, { lights, sky: null, place: 'exp:cerca', fog: { near: 63, far: 95 },   // niebla detrás del campo, no encima
        onThunder: () => setTimeout(() => bus.emit('ambience:thunder', { place: 'combat' }), 300 + Math.random() * 900) });
      amb.setArea(6, 6, 6);
      r.scene.add(world);
      start(params);
      let tagT = 0;
      r.onFrame((dt, t) => {
        frameN++;
        const now = performance.now();
        for (const a of [...anims]) {
          a.t = (now - a.t0) / 1000;
          const k = Math.min(1, a.t / a.dur);
          a.fn(k);
          if (k >= 1) { anims.delete(a); a.done?.(); }
        }
        for (const [, u] of units) u.model.userData.update?.(dt, !!u.moving, t);
        if (amb) {
          amb.update(dt, { x: 0, z: 0 });
          // en el combate la lectura manda: de noche o con tormenta nunca baja de un piso de luz
          lights.hemi.intensity = Math.max(LIGHT_FLOOR.hemi, lights.hemi.intensity);
          lights.sun.intensity = Math.max(LIGHT_FLOOR.sun, lights.sun.intensity);
        }
        tagT += dt;
        if (busy || anims.size || tagT > 0.25) { tagT = 0; placeTags(); }
      });
      r.start();
      stage.addEventListener('pointermove', onMove);
      stage.addEventListener('pointerdown', onDown);
      stage.addEventListener('pointerup', onUp);
      stage.addEventListener('contextmenu', (e) => e.preventDefault());
      stage.addEventListener('pointerleave', () => { hover = null; drawOverlays(); placeTags(); dom.hoverCard(null); });
      addEventListener('keydown', onKey);
      const onResize = () => { fitCamera(); placeTags(); };
      addEventListener('resize', onResize);
      const offSet = bus.on?.('settings:changed', ({ keys = [] } = {}) => { if (keys.includes('hiContrast')) { buildOverMats(); drawOverlays(); } });
      offs.push(() => removeEventListener('keydown', onKey), () => removeEventListener('resize', onResize));
      if (typeof offSet === 'function') offs.push(offSet);
      // para las pruebas (tools/test-combat-scene.mjs): los mismos caminos que el mouse y el teclado
      container.__combat = {
        get battle() { return b ? JSON.parse(JSON.stringify(b)) : null; },
        get view() { return b ? C.view(b) : null; },
        get busy() { return busy || anims.size > 0; },
        get modal() { return !!modal; },
        get sel() { return { ...sel }; },
        get playing() { return playing; },
        get anims() { return [...anims].map(a => [a.t, a.dur]); },
        get frames() { return frameN; },
        // el look con que se armó cada unidad del grupo (tools/test-class-look.mjs)
        get looks() { const o = {}; for (const [id, rec] of units) if (rec.side === 'ally') o[id] = { type: rec.type, look: rec.model?.userData?.look || rec.obj?.userData?.look || null }; return o; },
        cellScreen(x, y) { return r ? tileScreen(x, y, 0.05) : null; },
        unitScreen(id) { return r ? unitScreen(id, -0.3) : null; },
        click(x, y) { clickCell(x, y); },
        select(id) { select(id); },
        ability(id) { chooseAbility(id); },
        endTurn(force = false) { return endTurn(force); },
        rules: C,
        get guided() { return !!opts.guided; },
        get guide() { const el = root?.querySelector('.cb-guide'); return el && !el.classList.contains('gone') ? el.querySelector('p')?.textContent || '' : ''; },
        get expedition() { return !!opts.expedition; },
        raw() { return b; },
      };
    },
    unmount() {
      alive = false;
      for (const off of offs.splice(0)) { try { off(); } catch {} }
      if (b && !b.ended) opts.onSave?.(b);
      anims.clear();
      modal?.close?.(); modal = null;
      amb?.dispose(); amb = null;
      if (r) { r.stop(); r.dispose(); r = null; }
      for (const m of Object.values(overMats)) { m.map?.dispose(); m.dispose(); }
      overMats = {};
      for (const m of Object.values(ringMats)) m.dispose();
      plane.dispose(); pickBox.dispose(); pickMat.dispose(); ringGeo.dispose(); floodGeo.dispose(); floodMat.dispose();
      units.clear(); tileObjs.length = 0;
      dom?.destroy(); dom = null;
      root?.replaceChildren(); root = null;
    },
  };
}
