// Cinemática "El Quiebre" (PLAN-TRAVESIA §3b): once planos, unos dos minutos, que cuentan el mundo y su colapso con un
// narrador (planos 1 a 9) y con Vera (10 y 11). Los planos grandes van en vóxel 3D; la acción entre personajes, en
// viñetas 2D en pixel art (src/cinema/vignettes-intro.js). La primera vez que aparece cada cosa, un cartel la presenta.
//   1. el mundo y las cuatro vetas (3D, carteles de color)      7. las islas que suben (3D)
//   2. las torres de las Casas (3D)                              8. el Bajo Mundo: orcos de la Brasa y Vaciados (3D)
//   3. los enanos de la Veta empujando las vagonetas (3D)        9. la Cofradía mira desde lejos (2D)
//   4. la orden: una noble y el capataz (2D)                     10. Vera en su esquife llega a tu fragmento (3D)
//   5. el robo: forcejeo, el cristal cambia de mano (2D)         11. tu personaje despierta; Vera le habla (3D)
//   6. el Quiebre: la tierra se parte, gente que cae (2D)
// Textos por t() (intro.line.NN, intro.label.*); voces en assets/audio/voice/intro/NN.m4a (src/cinema/narration.js).
// Es la primera escena de una partida nueva (main.js, `!state.introSeen`) y se vuelve a ver desde la Bitácora
// ({replay: 1, back: 'city'}). Clic, Enter o Espacio pasan al plano siguiente; Esc o "Saltar" la terminan.
// Música: la pista grabada 'intro' (audio.track: The Illusionist, de Scott Buckley) si está en el manifest; si no,
// el modo épico de siempre.
// Calidad: el renderer respeta ?quality=low y los Ajustes (sombras, contorno, tope de FPS).
import * as THREE from 'three';
import { Voxels, createPixelRenderer, addLights, voxelMaterial } from '../core/voxel.js';
import { avatarModel } from '../avatar/avatar.js';
import { skiffModel } from '../avatar/skiff.js';
import { natureModel } from '../city/models.js';
import { createCinema } from '../cinema/player.js';
import { travel } from '../cinema/timeline.js';
import { createVignette } from '../cinema/pixel2d.js';
import { ORDEN, ROBO, CAIDA, COFRADIA } from '../cinema/vignettes-intro.js';
import { applyPose, poseWeight } from '../cinema/poses.js';
import { CHARACTERS } from '../story/story-data.js';
import { t } from '../core/i18n.js';

// ---------- Texto: claves de src/i18n/es.js (intro.line.NN y intro.label.<id>) ----------
export const INTRO_VOICES = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13', '14', '15', '16'];

// ---------- Despertar (planos 10 y 11): dónde está tirado tu personaje y dónde se para Vera ----------
const HERO = { pos: [-1.9, 0.125, 1.9], rot: -1.05 };
const VERA = { pos: [-2.85, 0.125, 2.45] };

// ---------- Colores ----------
const VEIN = { raiz: 0x86c96a, marea: 0x4f9fd6, brasa: 0xe8703a, cefiro: 0xd4ecf2 };
const C = {
  grass: ['#4f6a3a', '#56713e', '#4a6236', '#5d7642'], dirt: ['#6b5236', '#5e4830', '#735a3c'],
  rock: ['#5c5650', '#544e48', '#4a4540'], deep: ['#3a3532', '#332e2b', '#2b2725'], core: '#221e1c',
  stone: ['#77706a', '#6c655f', '#625b55'], stoneD: '#4d4741', mortar: '#57514b',
  wood: '#5a4430', woodD: '#3e2e20', cloth: '#7a2e2a', clothD: '#5a201e', gold: '#b8923e',
  cobble: ['#4a4744', '#42403d', '#3a3836', '#504c48'], night: '#2a2c33',
  ash: ['#1f1b1a', '#191615', '#25201e'], lava: 0xf06a2a, cloud: ['#8e95a2', '#9aa1ad', '#848b98'],
  ruin: ['#827a70', '#766e65', '#6a635b'], moss: '#4c5e38',
};

// ---------- Ruido y azar ----------
function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function h2(x, z, s = 0) {
  let n = (Math.imul(x | 0, 374761393) + Math.imul(z | 0, 668265263) + Math.imul(s | 0, 1442695041)) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x, z, s) {
  const xi = Math.floor(x), zi = Math.floor(z), fx = x - xi, fz = z - zi;
  const u = fx * fx * (3 - 2 * fx), w = fz * fz * (3 - 2 * fz);
  const a = h2(xi, zi, s), b = h2(xi + 1, zi, s), c = h2(xi, zi + 1, s), d = h2(xi + 1, zi + 1, s);
  return a + (b - a) * u + (c - a) * w + (a - b - c + d) * u * w;
}
const fbm = (x, z, s) => vnoise(x, z, s) * 0.6 + vnoise(x * 2.1, z * 2.1, s + 7) * 0.3 + vnoise(x * 4.3, z * 4.3, s + 13) * 0.1;
const pick = (list, x, y, z) => list[Math.floor(h2(x * 7 + y, z * 13 - y, 5) * list.length) % list.length];
const ease = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const lerp = (a, b, t) => a + (b - a) * t;
const lerp3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

export default function create(ctx) {
  let r = null, root = null, alive = false, offFrame = null, onKey = null, params = {};
  const own = [];        // geometrías y materiales propios (los modelos de gente y árboles se comparten: no se tocan)
  const sets = {};       // decorados 3D por nombre (world, towers, rise, frag); un decorado puede servir a dos planos
  let shot = 0, cin = null;
  let lights = null;
  const shake = { amp: 0 };

  // ---------- Ayudas de armado ----------
  const glowMats = {};
  function glow(hex) {
    if (!glowMats[hex]) { glowMats[hex] = new THREE.MeshBasicMaterial({ vertexColors: true, color: 0xffffff }); own.push(glowMats[hex]); }
    return glowMats[hex];
  }
  function mesh(v, scale, mat = voxelMaterial(), { shadow = true } = {}) {
    const g = v.toGeometry({ scale, jitter: 0.03 });
    own.push(g);
    const m = new THREE.Mesh(g, mat);
    m.castShadow = shadow; m.receiveShadow = true;
    return m;
  }
  function person(look, opts = {}) {
    const p = avatarModel(look, opts);
    p.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return p;
  }
  function tree(kind, seed, scale = 1) {
    const n = natureModel(kind, seed);
    n.scale.setScalar(scale);
    return n;
  }
  function cube(size, hex, basic = true) {
    const g = new THREE.BoxGeometry(size, size, size);
    const m = basic ? new THREE.MeshBasicMaterial({ color: hex }) : new THREE.MeshLambertMaterial({ color: hex });
    own.push(g, m);
    return new THREE.Mesh(g, m);
  }
  /** Isla flotante: tapa de pasto y cono de roca para abajo (como los islotes de la ciudad). */
  function islandVox(v, R, depth, seed, { top = C.grass, ox = 0, oz = 0 } = {}) {
    for (let j = 0; j < depth; j++) {
      const rr = j === 0 ? R : Math.max(0.8, R * (1 - j / depth) ** 0.8 + (h2(j, seed, 1) - 0.5) * 1.6);
      for (let x = Math.floor(-rr); x <= Math.ceil(rr); x++) for (let z = Math.floor(-rr); z <= Math.ceil(rr); z++) {
        const d = Math.hypot(x, z) + (fbm((x + seed) * 0.25, z * 0.25, seed) - 0.5) * 2.2;
        if (d > rr) continue;
        const y = -j;
        const col = j === 0 ? pick(top, x, y, z) : j <= 2 ? pick(C.dirt, x, y, z) : j < depth * 0.45 ? pick(C.rock, x, y, z) : pick(C.deep, x, y, z);
        v.set(x + ox, y, z + oz, col);
      }
    }
  }

  // ---------- Plano 1: el continente con las vetas ----------
  function buildContinent() {
    const g = new THREE.Group();
    const V = 1 / 4, W = 96, D = 60, TH = 12;
    const v = new Voxels();
    const veins = Object.fromEntries(Object.keys(VEIN).map(k => [k, new Voxels()]));
    const tops = [];
    for (let x = 0; x < W; x++) for (let z = 0; z < D; z++) {
      // bordes de atrás y de los costados mordidos; el frente es el corte recto donde se ven las vetas
      const edge = Math.min(x, W - 1 - x, z * 1.4);
      if (edge < 7 && fbm(x * 0.15, z * 0.15, 11) * 7 > edge + 0.5) continue;
      const hTop = 1 + Math.floor(fbm(x * 0.06, z * 0.06, 3) * 7);
      tops.push([x, hTop, z]);
      for (let y = -TH; y <= hTop; y++) {
        const dTop = hTop - y;
        const col = dTop === 0 ? pick(C.grass, x, y, z) : dTop <= 2 ? pick(C.dirt, x, y, z) : y > -5 ? pick(C.rock, x, y, z) : y > -9 ? pick(C.deep, x, y, z) : C.core;
        v.set(x, y, z, col);
      }
    }
    // cuatro vetas serpenteando por el corte del frente (y unas vueltas hacia adentro para que tengan cuerpo)
    const names = Object.keys(VEIN);
    names.forEach((k, i) => {
      const y0 = -3 - i * 2.2;
      for (let x = 0; x < W; x++) {
        const y = Math.round(y0 + Math.sin(x * 0.11 + i * 1.7) * 1.6 + Math.sin(x * 0.045 + i) * 1.2);
        const th = 1 + (vnoise(x * 0.18, i * 3, 17) > 0.55 ? 1 : 0) + (vnoise(x * 0.31, i * 5, 19) > 0.78 ? 1 : 0);
        for (const dz of [0, 1, 2]) for (let dy = 0; dy < th; dy++) {
          const z = D - 1 - dz;
          if (!v.has(x, y + dy, z)) continue;
          v.remove(x, y + dy, z); veins[k].set(x, y + dy, z, VEIN[k]);
        }
        // una rama que sube hasta la superficie cada tanto: ahí afloran cristales
        if ((x + i * 17) % 31 === 0) {
          for (let yy = y + 2; yy < 10; yy++) {
            const xx = x + Math.round(Math.sin(yy * 0.7 + i) * 1.2);
            if (!v.has(xx, yy, D - 1)) {
              if (v.has(xx, yy - 1, D - 1) || veins[k].has(xx, yy - 1, D - 1)) {
                veins[k].set(xx, yy, D - 2, VEIN[k]);
                veins[k].set(xx, yy + 1, D - 2, VEIN[k]);
              }
              break;
            }
            v.remove(xx, yy, D - 1); veins[k].set(xx, yy, D - 1, VEIN[k]);
          }
        }
      }
    });
    const land = mesh(v, V);
    g.add(land);
    const vm = {};
    for (const k of names) {
      const mat = new THREE.MeshBasicMaterial({ vertexColors: true, color: 0xffffff });
      own.push(mat);
      vm[k] = mat;
      g.add(mesh(veins[k], V, mat, { shadow: false }));
    }
    // bosques y cerros
    const rnd = rng(4);
    for (const [x, hTop, z] of tops) {
      if (z > D - 5 || rnd() > 0.035) continue;
      if (fbm(x * 0.08, z * 0.08, 21) < 0.45) continue;
      const tr = tree(rnd() < 0.7 ? 'pine' : 'tree', Math.floor(rnd() * 99), 0.42 + rnd() * 0.15);
      tr.position.set((x + 0.5) * V, (hTop + 1) * V, (z + 0.5) * V);
      g.add(tr);
    }
    // centrado: el corte del frente queda en z = +7,5
    g.children.forEach(c => { c.position.x -= W * V / 2; c.position.z -= D * V / 2; });
    g.userData.update = (dt, tt) => {
      names.forEach((k, i) => {
        const p = 0.72 + 0.28 * Math.sin(tt * 2.2 + i * 1.6);
        vm[k].color.setScalar(p * 1.15);
      });
    };
    return g;
  }

  // ---------- Planos 2 y 3: las torres de las Casas y los enanos de la Veta ----------
  function buildTowers() {
    const g = new THREE.Group();
    const V = 1 / 8, W = 112, D = 72;
    const v = new Voxels(), gv = new Voxels();
    const pits = [[30, 58, 7], [84, 56, 6]];   // x, z, radio de los pozos de extracción
    for (let x = 0; x < W; x++) for (let z = 0; z < D; z++) {
      const hTop = Math.floor(fbm(x * 0.05, z * 0.05, 8) * 2.2);
      let pit = 0;
      for (const [px, pz, pr] of pits) { const d = Math.hypot(x - px, (z - pz) * 1.2); if (d < pr) pit = Math.max(pit, Math.ceil((pr - d) * 1.1)); }
      const top = hTop - pit;
      for (let y = -6 - (pit ? 4 : 0); y <= top; y++) {
        const dTop = top - y;
        const track = Math.abs(z - 40 - Math.round(Math.sin(x * 0.06) * 3)) <= 1;
        const col = dTop === 0 ? (pit ? pick(C.rock, x, y, z) : track ? pick(C.dirt, x, y, z) : h2(x, z, 2) < 0.55 ? pick(C.dirt, x, y, z) : pick(C.grass, x, y, z)) : pick(dTop < 2 ? C.dirt : C.rock, x, y, z);
        v.set(x, y, z, col);
      }
      // veta al fondo del pozo
      if (pit > 3 && h2(x, z, 9) < 0.5) gv.set(x, hTop - pit, z, VEIN.raiz);
    }
    // torres: piedra con hiladas, almenas, estandarte de la Casa y un balcón
    const tower = (x0, z0, w, h) => {
      for (let y = 0; y < h; y++) for (let x = x0; x < x0 + w; x++) for (let z = z0; z < z0 + w; z++) {
        const edge = x === x0 || x === x0 + w - 1 || z === z0 || z === z0 + w - 1;
        if (!edge) continue;
        const win = (y % 14 > 8 && y % 14 < 12) && ((x - x0) % 5 === 2 || (z - z0) % 5 === 2) && y > 8;
        v.set(x, y, z, win ? '#1a1514' : y % 6 === 0 ? C.mortar : pick(C.stone, x, y, z));
      }
      for (let x = x0 - 1; x <= x0 + w; x++) for (let z = z0 - 1; z <= z0 + w; z++) {
        const edge = x === x0 - 1 || x === x0 + w || z === z0 - 1 || z === z0 + w;
        if (!edge) continue;
        v.set(x, h, z, C.stoneD); v.set(x, h + 1, z, C.stoneD);
        if ((x + z) % 2 === 0) v.set(x, h + 2, z, C.stoneD);
      }
      v.box(x0, h, z0, w, 1, w, C.stoneD);
      // estandarte en la cara de adelante
      const bx = x0 + Math.floor(w / 2) - 2;
      for (let y = h - 4; y > h - 24; y--) for (let x = bx; x < bx + 4; x++) {
        const tip = y < h - 21 && (x === bx || x === bx + 3);
        if (!tip) v.set(x, y, z0 + w, y === h - 4 ? C.gold : x === bx + 1 && (y - h) % 5 === 0 ? C.gold : (x === bx ? C.clothD : C.cloth));
      }
    };
    tower(18, 6, 14, 60);
    tower(70, 10, 12, 50);
    // brazo de la grúa: sale de la torre grande y cuelga sobre el pozo
    for (let i = 0; i < 34; i++) { v.set(25, 47 - Math.floor(i * 0.12), 20 + i, C.woodD); v.set(25, 48 - Math.floor(i * 0.12), 20 + i, C.wood); }
    v.box(24, 38, 53, 3, 6, 1, C.woodD);
    // vagoneta con cristales
    const cart = new Voxels();
    cart.box(0, 1, 0, 10, 4, 7, (x, y, z) => (x === 0 || x === 9 || z === 0 || z === 6 || y === 1) ? (y === 4 ? '#3c3f45' : C.wood) : null);
    for (const [x, z] of [[1, 0], [8, 0], [1, 6], [8, 6]]) cart.box(x, 0, z, 1, 2, 1, '#2a2c30');
    const cg = new Voxels();
    for (let x = 1; x < 9; x++) for (let z = 1; z < 6; z++) { const hh = 3 + Math.floor(h2(x, z, 4) * 3); for (let y = 2; y < 2 + hh; y++) if (y < 6 || h2(x, y, z) < 0.5) cg.set(x, y, z, VEIN.raiz); }
    const land = mesh(v, V); g.add(land);
    g.add(mesh(gv, V, glow('pit'), { shadow: false }));
    const carts = [];
    const dwarfLooks = [
      { type: 'enano', build: 'recio', skin: 1, hair: 'cortito', hairColor: 'pelirrojo', face: 'barba_larga', dress: 'minero', dressColor: 'durazno', crown: 'casco', acc: 'ninguno' },
      { type: 'enano', build: 'recio', skin: 3, hair: 'trenzas', hairColor: 'negro', face: 'barba_larga', dress: 'minero', dressColor: 'negro', crown: 'vincha', acc: 'ninguno' },
      { type: 'enano', build: 'recio', skin: 2, hair: 'rapado', hairColor: 'gris', face: 'barba_corta', dress: 'cuero', dressColor: 'verde', crown: 'ninguna', acc: 'ninguno' },
    ];
    for (let i = 0; i < 2; i++) {
      const cgrp = new THREE.Group();
      cgrp.add(mesh(cart, V)); cgrp.add(mesh(cg, V, glow('cart'), { shadow: false }));
      const pusher = person(dwarfLooks[i]);
      pusher.position.set(-0.32, 0, 0.44); pusher.rotation.y = Math.PI / 2;
      cgrp.add(pusher);
      cgrp.position.set(-2.4 - i * 2.4, 0.13, 0.35 + i * 0.1);
      cgrp.rotation.y = 0;
      cgrp.userData = { pusher, x0: cgrp.position.x };
      carts.push(cgrp);
      g.add(cgrp);
    }
    const digger = person(dwarfLooks[2]);
    digger.position.set(3.9 - 7, -0.5, 5.4 - 4.5);
    // la gente de la Casa: una noble en el balcón y un guardia
    const noble = person({ type: 'humano', build: 'esbelto', skin: 0, hair: 'rodete', hairColor: 'rubio', face: 'ninguna', dress: 'vestido_noble', dressColor: 'rojo', crown: 'ninguna', acc: 'collar' });
    const guard = person({ type: 'humano', build: 'recio', skin: 3, hair: 'cortito', hairColor: 'negro', face: 'barba_corta', dress: 'tabardo', dressColor: 'rojo', crown: 'casco', acc: 'lanza' });
    g.add(digger, noble, guard);
    // balcón de madera en la torre grande
    const bal = new Voxels(); bal.box(0, 0, 0, 16, 1, 6, C.woodD); bal.box(0, 1, 5, 16, 3, 1, (x, y) => (x % 3 === 0 || y === 3) ? C.wood : null);
    const balM = mesh(bal, V); g.add(balM);
    // la veta sube por un caño de luz del pozo a la torre: cuentas que viajan
    const beads = [];
    const path = [[30 * V, -0.4, 58 * V], [27 * V, 4.0, 52 * V], [25 * V, 5.6, 34 * V], [25 * V, 5.7, 20 * V]];
    for (let i = 0; i < 14; i++) { const b = cube(0.09, VEIN.raiz); beads.push(b); g.add(b); }
    // centrado (la parcela va de -7 a +7 en x)
    const ox = -W * V / 2, oz = -D * V / 2;
    for (const c of [land, g.children[1]]) { c.position.x += ox; c.position.z += oz; }
    balM.position.set(ox + 17 * V, 32 * V, oz + 20 * V);
    noble.position.set(ox + 24 * V, 33 * V, oz + 22 * V);
    guard.position.set(ox + 36 * V, 0.25, oz + 24 * V); guard.rotation.y = -0.4;
    digger.position.set(ox + 38 * V, 0.08, oz + 60 * V); digger.rotation.y = -1.7;
    g.userData.carts = carts; g.userData.noble = noble;
    g.userData.update = (dt, tt, st) => {
      for (const c of carts) {
        c.position.x = c.userData.x0 + st * 0.36;
        c.userData.pusher.userData.update?.(dt, true);
      }
      digger.userData.update?.(dt, false);
      noble.userData.update?.(dt, false); guard.userData.update?.(dt, false);
      // las cuentas recorren el caño
      const segs = path.length - 1;
      beads.forEach((b, i) => {
        const u = ((tt * 0.16 + i / beads.length) % 1) * segs, s = Math.floor(u), f = u - s;
        const [x, y, z] = lerp3(path[s], path[s + 1], f);
        b.position.set(x + ox, y, z + oz);
      });
      glowMats.pit.color.setScalar(0.8 + 0.2 * Math.sin(tt * 3));
    };
    return g;
  }

  // ---------- Planos 7 y 8: las islas suben; abajo, el Bajo Mundo ----------
  function buildRise() {
    const g = new THREE.Group();
    // el Bajo Mundo: llanura de ceniza con ríos de lava y un volcán
    const V = 1 / 4, W = 100, D = 100;
    const v = new Voxels(), lv = new Voxels();
    for (let x = 0; x < W; x++) for (let z = 0; z < D; z++) {
      const dv = Math.hypot(x - 70, z - 22);
      const cone = Math.max(0, 16 - dv * 0.9);
      const hTop = Math.floor(fbm(x * 0.07, z * 0.07, 41) * 3 + cone);
      const river = Math.abs(z - 60 - Math.sin(x * 0.09) * 8) < 1.3 || (Math.abs(x - 40 - Math.sin(z * 0.12) * 6) < 1 && z > 30);
      for (let y = -3; y <= hTop; y++) v.set(x, y, z, pick(C.ash, x, y, z));
      if (river && cone < 1) { v.remove(x, hTop, z); lv.set(x, hTop, z, C.lava); }
      if (dv < 3) { for (let y = hTop - 2; y <= hTop; y++) v.remove(x, y, z); lv.set(x, hTop - 2, z, C.lava); }
    }
    const ground = mesh(v, V), lava = mesh(lv, V, glow('lava5'), { shadow: false });
    for (const m of [ground, lava]) m.position.set(-W * V / 2, -6, -D * V / 2);
    g.add(ground, lava);
    // los que quedaron abajo: orcos de la Brasa y un vaciado, mirando para arriba
    const below = [
      { type: 'orco', build: 'recio', skin: 0, hair: 'jopo', hairColor: 'negro', face: 'cicatriz', dress: 'cuero', dressColor: 'negro', crown: 'ninguna', acc: 'hacha' },
      { type: 'orco', build: 'recio', skin: 3, hair: 'rapado', hairColor: 'negro', face: 'barba_corta', dress: 'pieles', dressColor: 'rojo', crown: 'ninguna', acc: 'ninguno' },
      { type: 'vaciado', build: 'esbelto', skin: 0, hair: 'rapado', hairColor: 'gris', face: 'ninguna', dress: 'minero', dressColor: 'negro', crown: 'ninguna', acc: 'ninguno' },
    ].map((look, i) => {
      const p = person(look);
      const px = [1.6, 2.6, 0.7][i], pz = [5.2, 4.6, 4.2][i];
      const hx = Math.round((px + W * V / 2) / V), hz = Math.round((pz + D * V / 2) / V);
      const top = Math.floor(fbm(hx * 0.07, hz * 0.07, 41) * 3 + Math.max(0, 16 - Math.hypot(hx - 70, hz - 22) * 0.9));
      p.position.set(px, -6 + (top + 1) * V, pz);
      p.rotation.y = [Math.PI + 0.3, Math.PI - 0.2, Math.PI + 0.6][i];
      g.add(p);
      return p;
    });
    // nubes: una capa entre el Bajo Mundo y el cielo
    const cl = new Voxels();
    const rc = rng(9);
    for (let i = 0; i < 16; i++) {
      const a = rc() * Math.PI * 2, d = 18 + rc() * 40;
      const cx = Math.cos(a) * d, cz = Math.sin(a) * d, rx = 3 + rc() * 4;
      for (let k = 0; k < 3; k++) cl.sphere(Math.round(cx + (k - 1) * rx * 0.9), Math.round(rc() * 2), Math.round(cz + (rc() - 0.5) * 3), rx * (k === 1 ? 1 : 0.7), 2 + rc() * 1.5, rx * 0.8, (x, y, z) => pick(C.cloud, x, y, z));
    }
    const cloudMat = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x1a2030 });
    own.push(cloudMat);
    const clouds = mesh(cl, 1 / 4, cloudMat, { shadow: false });
    clouds.position.y = 2.6;
    g.add(clouds);
    // los pedazos con Céfiro
    const isles = [];
    const spec = [[0, -1.4, 0, 18, 12, 0.85], [-5.5, -2.5, -3, 11, 8, 0.6], [5, -3.4, -5, 13, 9, 0.7], [-3, -4.2, -8, 9, 7, 0.55], [7.5, -2.8, 1.5, 8, 6, 0.5]];
    spec.forEach(([x, y, z, R, depth, speed], i) => {
      const iv = new Voxels(), cv = new Voxels();
      islandVox(iv, R, depth, 50 + i);
      // un cristal de Céfiro asomando debajo de cada uno
      cv.box(-1, -depth - 1, -1, 2, 3, 2, VEIN.cefiro);
      const grp = new THREE.Group();
      grp.add(mesh(iv, 1 / 8), mesh(cv, 1 / 8, glow('cef5'), { shadow: false }));
      const rnd = rng(70 + i);
      for (let k = 0; k < Math.max(1, Math.floor(R / 5)); k++) {
        const tr = tree('pine', i * 10 + k, 0.9);
        tr.position.set((rnd() - 0.5) * R / 8 * 1.1, 1 / 8, (rnd() - 0.5) * R / 8 * 1.1);
        grp.add(tr);
      }
      grp.position.set(x, y, z);
      grp.userData = { y0: y, speed, spin: (rnd() - 0.5) * 0.15 };
      isles.push(grp); g.add(grp);
    });
    g.userData.update = (dt, tt, st) => {
      for (const p of below) p.userData.update?.(dt, false);
      for (const is of isles) {
        const u = is.userData;
        is.position.y = u.y0 + ease(st / 8.5) * 9 * u.speed + Math.sin(tt * 0.9 + u.y0) * 0.05;
        is.rotation.y = st * u.spin;
      }
      clouds.position.x = st * 0.15;
      glowMats.lava5.color.setScalar(0.8 + 0.2 * Math.sin(tt * 1.7));
      glowMats.cef5.color.setScalar(0.8 + 0.2 * Math.sin(tt * 2.6));
    };
    g.userData.isles = isles; g.userData.below = below;
    return g;
  }

  // ---------- Planos 10 y 11: tu fragmento, el esquife de Vera y el despertar ----------
  function buildFragment() {
    const g = new THREE.Group();
    const v = new Voxels(), R = 30;
    islandVox(v, R, 26, 88, { top: [...C.grass, C.moss] });
    // ruinas: paredes rotas, una torre caída, un arco y piedras sueltas
    const wall = (x0, z0, len, axis, hMax, seed) => {
      for (let i = 0; i < len; i++) {
        const hh = Math.max(1, Math.round(hMax * (0.35 + 0.65 * vnoise(i * 0.35, seed, seed))));
        for (let y = 1; y <= hh; y++) {
          const x = axis === 'x' ? x0 + i : x0, z = axis === 'z' ? z0 + i : z0;
          if (y === hh && h2(i, y, seed) < 0.3) continue;
          v.set(x, y, z, y === 1 && h2(x, z, 4) < 0.4 ? C.moss : pick(C.ruin, x, y, z));
        }
      }
    };
    wall(-14, -10, 16, 'x', 9, 1); wall(-14, -10, 12, 'z', 7, 2); wall(4, -16, 10, 'z', 11, 3); wall(6, 2, 9, 'x', 5, 4);
    // torre caída: un tambor parado y los otros tirados
    v.cylinder(12, 1, -8, 4, 14, (x, y, z) => (y > 11 && h2(x, z, y) < 0.5) ? null : pick(C.ruin, x, y, z));
    for (let i = 0; i < 4; i++) v.sphere(18 + i * 4, 2, -2 + i * 2, 2.3, 1.8, 2.3, (x, y, z) => pick(C.ruin, x, y, z));
    // arco
    for (let y = 1; y <= 10; y++) { v.box(-4, y, 8, 2, 1, 2, pick(C.ruin, -4, y, 8)); v.box(4, y, 8, 2, 1, 2, pick(C.ruin, 4, y, 8)); }
    for (let x = -4; x <= 5; x++) { const y = 10 + Math.round(2 * Math.sin(((x + 4) / 9) * Math.PI)); if (x !== 1) v.box(x, y, 8, 1, 2, 2, pick(C.ruin, x, y, 8)); }
    for (let i = 0; i < 22; i++) { const x = Math.round((h2(i, 1, 7) - 0.5) * 44), z = Math.round((h2(i, 2, 7) - 0.5) * 44); if (Math.hypot(x, z) < 26) v.set(x, 1, z, pick(C.ruin, x, 1, z)); }
    // muelle viejo en el borde
    for (let i = 0; i < 9; i++) for (let z = 0; z < 4; z++) v.set(-R - 6 + i, 0, 12 + z, (i + z) % 3 ? C.wood : C.woodD);
    v.box(-R - 6, -4, 12, 1, 5, 1, C.woodD); v.box(-R - 6, -4, 15, 1, 5, 1, C.woodD);
    const isle = mesh(v, 1 / 8);
    g.add(isle);
    const cv = new Voxels(); cv.box(-2, -28, -2, 4, 4, 4, VEIN.cefiro);
    g.add(mesh(cv, 1 / 8, glow('cef6'), { shadow: false }));
    const rnd = rng(12);
    for (const [x, z] of [[-1.2, -2.6], [2.4, 1.6], [-2.8, 0.6], [0.6, 3.0], [3.0, -1.0]]) {
      const tr = tree('pine', Math.floor(rnd() * 50), 0.62 + rnd() * 0.18);
      tr.position.set(x, 1 / 8, z); g.add(tr);
    }
    // dos islotes chicos alrededor
    const islets = [[-6, -1.2, -5, 8], [6.5, -2, 3.5, 6]].map(([x, y, z, rr], i) => {
      const iv = new Voxels(); islandVox(iv, rr, 7, 140 + i);
      const m = mesh(iv, 1 / 8); m.position.set(x, y, z); g.add(m); return m;
    });
    // el esquife de Vera llega (plano 10); en el 11 queda amarrado y vacío, y ella está de pie junto a tu personaje
    const veraLook = CHARACTERS.cartografa.look;
    const skiff = skiffModel(ctx.state?.car || {}, { driver: veraLook });
    const moored = skiffModel(ctx.state?.car || {}, {});
    skiff.scale.setScalar(1.25); moored.scale.setScalar(1.25);
    g.add(skiff, moored);
    const from = [-9.5, -0.6, 9], to = [-4.35, 0.05, 1.75], heading = Math.atan2(to[0] - from[0], to[2] - from[2]);
    moored.position.set(...to); moored.rotation.y = heading;
    // tu personaje, tirado entre las ruinas: la primera vez alguien con capucha; al volver a verla, el tuyo
    const look = params.replay && ctx.state?.onboarded && ctx.state.avatar ? ctx.state.avatar
      : { type: 'humano', build: 'recio', skin: 2, hair: 'cortito', hairColor: 'castano', face: 'ninguna', dress: 'capa_viaje', dressColor: 'verde', crown: 'capucha', acc: 'ninguno' };
    const hero = person(look), vera = person(veraLook);
    hero.position.set(...HERO.pos); hero.rotation.y = HERO.rot;
    vera.position.set(...VERA.pos); vera.rotation.y = Math.atan2(HERO.pos[0] - VERA.pos[0], HERO.pos[2] - VERA.pos[2]);
    g.add(hero, vera);
    // las poses mezclan con lo que hay: cada cuadro se vuelve a la postura de reposo (si no, el que cae queda tirado)
    const restOf = (m) => {
      const P = m.userData.parts || {};
      const snap = [P.body, P.upper, P.head, P.armL, P.armR, ...(P.legs || [])].filter(Boolean).map(o => [o, o.rotation.clone(), o.position.clone()]);
      return () => { for (const [o, r0, p0] of snap) { o.rotation.copy(r0); o.position.copy(p0); } };
    };
    const heroRest = restOf(hero), veraRest = restOf(vera);
    let mode = 'arrive';
    g.userData.hero = hero; g.userData.vera = vera; g.userData.skiff = skiff;
    g.userData.mode = (m) => { mode = m; skiff.visible = m === 'arrive'; moored.visible = vera.visible = m === 'wake'; };
    g.userData.mode('arrive');
    g.userData.update = (dt, tt, st) => {
      if (mode === 'arrive') {
        const u = ease(st / 8.2);
        const [x, y, z] = lerp3(from, to, u);
        skiff.position.set(x, y + Math.sin(tt * 1.6) * 0.04, z);
        skiff.rotation.y = heading + (1 - u) * 0.2;
        skiff.userData.update?.(dt, (1 - u) * 1.6, -0.2 * (1 - u));
      } else moored.position.y = to[1] + Math.sin(tt * 1.6) * 0.03;
      heroRest(); veraRest();
      hero.userData.update?.(dt, false);
      vera.userData.update?.(dt, false);
      // tu personaje: tirado boca abajo; en el 11 se arrodilla (3,8–6,2 s) y se pone de pie (7,4–9,4 s)
      if (mode === 'arrive' || st < 3.8) applyPose(hero, 'caer', { w: 1, p: 1 });
      else if (st < 7.4) {
        const a = ease((st - 3.8) / 2.4);
        applyPose(hero, 'caer', { w: 1 - a, p: 1 });
        applyPose(hero, 'arrodillarse', { w: a, p: 1 });
      } else applyPose(hero, 'arrodillarse', { w: 1 - ease((st - 7.4) / 2), p: 1 });
      // Vera le tiende la mano mientras se levanta y después lo mira
      if (mode === 'wake') {
        applyPose(vera, 'entregar', { w: poseWeight(st, 2.4, 8.6, 0.6), side: 'R', t: st });
        applyPose(vera, 'mirar', { w: poseWeight(st, 8.6, 30, 0.6), look: 0.1, up: -0.1 });
      }
      islets[0].position.y = -1.2 + Math.sin(tt * 0.7) * 0.06;
      islets[1].position.y = -2 + Math.sin(tt * 0.6 + 2) * 0.05;
      glowMats.cef6.color.setScalar(0.8 + 0.2 * Math.sin(tt * 2));
    };
    return g;
  }

  // ---------- Planos: duración, cámara, luz, voz y carteles ----------
  const L = {
    world: { bg: 0x0b0d13, sky: 0x9fb0d0, ground: 0x2a2420, hemi: 1.15, sun: 0xffe2b8, sunI: 2.0, sunPos: [-10, 20, 12], fog: [0x0b0d13, 30, 60] },
    towers: { bg: 0x1d1a1c, sky: 0xb5a796, ground: 0x2e2620, hemi: 1.0, sun: 0xffc890, sunI: 2.2, sunPos: [14, 16, 10], fog: [0x1d1a1c, 14, 34] },
    rise: { bg: 0x0d1018, sky: 0x8e9cb8, ground: 0x3a1a10, hemi: 0.85, sun: 0xd6e2ff, sunI: 1.5, sunPos: [6, 26, 4], fog: [0x0d1018, 16, 42] },
    below: { bg: 0x120c0c, sky: 0x9a8a9e, ground: 0x5a2614, hemi: 1.3, sun: 0xffb080, sunI: 1.9, sunPos: [-4, 18, 14], fog: [0x120c0c, 8, 26] },
    dusk: { bg: 0x2a2028, sky: 0xe0a888, ground: 0x2e2430, hemi: 1.05, sun: 0xffa868, sunI: 2.3, sunPos: [-14, 8, 10], fog: [0x2a2028, 16, 34] },
  };
  const line = (at, k) => ({ at, text: t('intro.line.' + k), voice: 'intro/' + k });
  const VCOL = { raiz: '#86c96a', marea: '#4f9fd6', brasa: '#e8703a', cefiro: '#d4ecf2' };
  /** Cartel: id de intro.label.<id>; where: { pos } (3D), { follow, off } (algo que se mueve) o { px } (viñeta 2D). */
  const label = (at, id, where, o = {}) => ({ at, label: { id, name: () => t('intro.label.' + id), line: () => t('intro.label.' + id + '.line'), dur: 4.4, ...where, ...o } });
  const keys = (...k) => ({ keys: k.map(([tt, pos, look]) => ({ t: tt, pos, look })), ease: 'smooth' });
  // un punto sobre la veta i en el corte del frente (la misma curva que buildContinent), en la columna de vóxeles x
  const veinAt = (i, x) => { const y = Math.round(-3 - i * 2.2 + Math.sin(x * 0.11 + i * 1.7) * 1.6 + Math.sin(x * 0.045 + i) * 1.2); return [(x + 0.5) / 4 - 12, (y + 0.5) / 4, 7.55]; };
  const VEIN_COL = [30, 42, 54, 66];
  const SHOTS = [
    // 1 · el mundo y las cuatro vetas: de lejos, y de frente al corte; cada veta con su cartel en su color
    { set: 'world', dur: 21, light: L.world, shadow: 34,
      cam: keys([0, [-3, 13, 26], [0, -0.5, 0]], [8.5, [0, 4.4, 21], [0, -0.8, 7]], [21, [0.8, 2.2, 18.4], [0.4, -1.3, 7.4]]),
      subs: [line(0.6, '01'), line(8.9, '02')],
      events: ['raiz', 'marea', 'brasa', 'cefiro'].map((id, i) => label(12.6 + i * 1.2, id, { pos: veinAt(i, VEIN_COL[i]) }, { color: VCOL[id], dur: 21 - 12.6 - i * 1.2 - 0.6 })) },
    // 2 · las torres de las Casas, con la noble en el balcón
    { set: 'towers', dur: 9.8, light: L.towers, shadow: 22,
      cam: travel(9.8, [[-7.4, 1.6, 7.6], [-3.4, 1.4, 0.2]], [[4.6, 3.0, 9.6], [-1.6, 3.4, -2]]),
      subs: [line(0.6, '03')],
      events: [label(2.6, 'casas', { follow: () => sets.towers.userData.noble, off: [0, 1.0, 0] })] },
    // 3 · los enanos de la Veta empujando las vagonetas (mismo decorado, cámara baja)
    { set: 'towers', dur: 10, light: L.towers, shadow: 22,
      cam: travel(10, [[-5.6, 1.8, 5.2], [-4.8, 0.5, 0.4]], [[-4.6, 1.6, 5.0], [-3.9, 0.5, 0.4]]),
      subs: [line(0.6, '04')],
      events: [label(2.2, 'enanos', { follow: () => sets.towers.userData.carts[1], off: [0, 1.1, 0] })] },
    // 4 · la orden (viñeta)
    { vig: 'orden', dur: 12, subs: [line(0.8, '05')],
      events: [label(0.9, 'noble', { px: [ORDEN.noble, ORDEN.GROUND - ORDEN.DAIS - 32] }, { dur: 4 }), label(2.7, 'capataz', { px: (v) => [v.state.actors[2].x, ORDEN.GROUND - 30] }, { dur: 3.6 })] },
    // 5 · el robo (viñeta)
    { vig: 'robo', dur: 11.2, subs: [line(0.6, '06'), line(6.4, '07')],
      events: [label(0.7, 'ladrones', { px: [102, ROBO.GROUND - 34] }, { dur: 2.6 }), label(3.2, 'guardia', { px: (v) => [v.state.actors[2].x, ROBO.GROUND - 34] }, { dur: 2.8 })] },
    // 6 · el Quiebre (viñeta)
    { vig: 'caida', dur: 16.2, subs: [line(0.6, '08'), line(9.6, '09')] },
    // 7 · las islas que suben: desde abajo, mirando para arriba
    { set: 'rise', dur: 8.6, light: L.rise, shadow: 30,
      cam: travel(8.6, [[2.6, -4.2, 7.8], [0.8, -2.6, 0]], [[3.4, -3.4, 9.4], [0, 3.2, -1.5]]),
      subs: [line(0.6, '10')],
      events: [label(4.4, 'islas', { follow: () => sets.rise.userData.isles[1], off: [0, 0.5, 0] }, { color: VCOL.cefiro, dur: 3.8 })] },
    // 8 · el Bajo Mundo: orcos de la Brasa y un vaciado miran subir lo que se va
    { set: 'rise', dur: 9.8, light: L.below, shadow: 20,
      cam: travel(9.8, [[-0.2, -4.75, 0.3], [1.4, -5.05, 4.8]], [[2.6, -4.7, 0.9], [1.8, -5.0, 4.6]]),
      subs: [line(0.6, '11')],
      events: [label(0.9, 'bajo', { pos: [3.6, -5.0, 6.8] }, { dur: 3.2, color: VCOL.brasa }),
        label(4.3, 'orcos', { follow: () => sets.rise.userData.below[1], off: [0, 1.15, 0] }, { dur: 3.6 }),
        label(6.4, 'vaciados', { follow: () => sets.rise.userData.below[2], off: [0, 1.1, 0] }, { dur: 3.2 })] },
    // 9 · la Cofradía mira desde lejos (viñeta)
    { vig: 'cofradia', dur: 11.8, subs: [line(0.8, '12')],
      events: [label(3.9, 'cofradia', { px: [90, COFRADIA.GROUND - 34] }, { dur: 3.6 })] },
    // 10 · Vera llega en su esquife a tu fragmento
    { set: 'frag', mode: 'arrive', dur: 11.4, light: L.dusk, shadow: 18,
      cam: travel(11.4, [[7.5, 3.2, 13.5], [0, 0.3, 0]], [[0.6, 1.5, 6.2], [-2.0, 0.3, 1.9]]),
      subs: [line(1.2, '13'), line(7.6, '14')],
      events: [label(2.4, 'vera', { follow: () => sets.frag.userData.skiff, off: [0, 1.7, 0] }, { dur: 3.8 }),
        label(7.8, 'fragmento', { follow: () => sets.frag.userData.hero, off: [0, 0.9, 0] }, { dur: 3.4 })] },
    // 11 · tu personaje despierta; Vera le tiende la mano. Título.
    { set: 'frag', mode: 'wake', dur: 12.6, light: L.dusk, shadow: 14, title: true, hold: 1.4,
      cam: travel(12.6, [[HERO.pos[0] + 1.5, 1.25, HERO.pos[2] + 2.8], [HERO.pos[0] - 0.45, 0.4, HERO.pos[2] + 0.1]], [[HERO.pos[0] + 1.25, 1.1, HERO.pos[2] + 2.6], [HERO.pos[0] - 0.45, 0.8, HERO.pos[2] + 0.1]]),
      subs: [line(1.8, '15'), line(6.4, '16')] },
  ];

  function applyLight(Li, size) {
    r.scene.background = new THREE.Color(Li.bg);
    r.scene.fog = new THREE.Fog(Li.fog[0], Li.fog[1], Li.fog[2]);
    lights.hemi.color.setHex(Li.sky); lights.hemi.groundColor.setHex(Li.ground); lights.hemi.intensity = Li.hemi;
    lights.sun.color.setHex(Li.sun); lights.sun.intensity = Li.sunI;
    lights.sun.position.set(...Li.sunPos); lights.sun.target.position.set(0, 0, 0);
    const sz = size / 2, cam = lights.sun.shadow.camera;
    Object.assign(cam, { left: -sz, right: sz, top: sz, bottom: -sz, near: 1, far: 90 });
    cam.updateProjectionMatrix();
  }

  // ---------- Planos sobre el motor de cinemáticas (src/cinema/) ----------
  function cinemaShots() {
    return SHOTS.map((S) => {
      const out = { dur: S.dur, tail: 0.5, subs: S.subs, events: S.events || [] };
      // los carteles que siguen algo: la función se resuelve al disparar (los decorados ya están armados)
      for (const e of out.events) if (e.label && typeof e.label.follow === 'function') { const fn = e.label.follow; e.label = { ...e.label, follow: undefined, followFn: fn }; }
      if (S.vig) out.vignette = () => createVignette(S.vig);
      else Object.assign(out, { set: sets[S.set], cam: S.cam, light: S.light, shadow: S.shadow, title: !!S.title, hold: S.hold || 0 });
      return out;
    });
  }
  function onShot(i) {
    shot = i;
    const S = SHOTS[i];
    if (S.mode) sets[S.set].userData.mode(S.mode);
  }
  async function finish(how) {
    const s = ctx.state;
    if (!params.replay) {
      s.introSeen = true;
      try { ctx.store.markDirty(); ctx.store.save(); } catch {}
    }
    ctx.bus.emit('intro:done', { how, replay: !!params.replay });
    await new Promise(res => setTimeout(res, 380));
    if (!alive) return;
    const to = params.replay ? (params.back || 'city') : (s.onboarded ? 'city' : 'onboarding');
    ctx.router.go(to);
  }

  return {
    hud: false,
    music: 'intro',
    async mount(container, p = {}) {
      alive = true; params = p || {};
      r = createPixelRenderer(container, { ortho: false, fov: 42, background: 0x0b0d13, outline: true });
      lights = addLights(r.scene, { shadowSize: 30, shadowRes: 2048 });
      // faroles de la guardia y el brillo de lo robado (siempre en la escena: así no se recompilan los materiales)
      const BUILD = { world: buildContinent, towers: buildTowers, rise: buildRise, frag: buildFragment };
      for (const [k, fn] of Object.entries(BUILD)) { const g = fn(); g.visible = false; sets[k] = g; r.scene.add(g); }
      // la pista grabada de El Quiebre ('The Illusionist' de Scott Buckley, CC BY 4.0, recortada para que el cierre
      // caiga en el título del plano 11; tools/audio/sources.mjs → TRACKS). Una sola vez: después sigue su coda.
      // Si no está en el manifest, sigue el modo épico.
      try { ctx.audio?.track?.('intro', { loop: false }); } catch {}
      cin = createCinema(ctx, container, { r, shots: cinemaShots(), prefix: 'in', title: t('intro.title'), applyLight, onShot, onFinish: finish, shake, advanceSfx: 'select' });
      cin.go(Math.max(0, Math.min(SHOTS.length - 1, Number(params.shot) || 0)));
      offFrame = r.onFrame((dt, tt) => cin.frame(dt, tt));
      onKey = (e) => {
        if (cin.finished) return;
        if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); try { ctx.audio.sfx('close'); } catch {} cin.finish('skip'); return; }
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight') { e.preventDefault(); e.stopImmediatePropagation(); if (!e.repeat) cin.next(); return; }
        e.stopImmediatePropagation();
      };
      addEventListener('keydown', onKey, true);
      r.start();
      if (window.__pixelia) window.__pixelia.intro = { get shot() { return cin.shot; }, get t() { return cin.t; }, get count() { return SHOTS.length; }, go: (i) => cin.go(i), seek: (s) => cin.seek(s), next: () => cin.next(), skip: () => cin.finish('skip'), cinema: cin, r };
    },
    unmount() {
      alive = false;
      if (onKey) removeEventListener('keydown', onKey, true);
      offFrame?.();
      if (r) { r.stop(); r.dispose(); }
      for (const o of own.splice(0)) o.dispose?.();
      for (const k of Object.keys(sets)) delete sets[k];
      cin?.dispose(); cin = null;
      if (window.__pixelia) delete window.__pixelia.intro;
      try { if (ctx.audio?.trackId === 'intro') ctx.audio.track(null); } catch {}
      r = null;
    },
  };
}
