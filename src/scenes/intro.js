// Cinemática "El Quiebre" (PLAN-QUIEBRE §B y §M4): seis planos en vóxel que cuentan el colapso con imágenes que se
// entienden solas, con un subtítulo de una línea por plano.
//  1. El continente, con las cuatro vetas latiendo por dentro.
//  2. Las torres de las Casas sacando la veta; enanos de la Veta empujando las vagonetas.
//  3. De noche, gente sin nada (humanos y gente-zorro) roba cristales y la guardia la persigue con faroles.
//  4. La tierra se agrieta y se abre; abajo, la Brasa.
//  5. Los pedazos con Céfiro suben entre las nubes; abajo quedan la oscuridad, la lava y los orcos mirando.
//  6. Tu fragmento en ruinas al atardecer y un esquife que llega.
// Es la primera escena de una partida nueva (main.js, `!state.introSeen`) y se vuelve a ver desde la Bitácora
// ({replay: 1, back: 'city'}). Clic, Enter o Espacio pasan al plano siguiente; Esc o "Saltar" la terminan.
// Calidad: el renderer respeta ?quality=low y los Ajustes (sombras, contorno, tope de FPS).
import * as THREE from 'three';
import { Voxels, createPixelRenderer, addLights, voxelMaterial } from '../core/voxel.js';
import { avatarModel } from '../avatar/avatar.js';
import { skiffModel } from '../avatar/skiff.js';
import { natureModel } from '../city/models.js';

// ---------- Texto (M4: una línea por plano, que dé ganas de ver la siguiente) ----------
export const INTRO_LINES = [
  'Antes del cielo hubo una sola tierra. Y por dentro estaba viva.',
  'Las Casas la cavaron para tener más. Siempre un poco más.',
  'Los de abajo robaban lo que quedaba. Alguien tenía que comer.',
  'Nadie paró. Ni los de arriba ni los de abajo.',
  'Lo que tenía Céfiro subió. Lo demás se quedó abajo, a oscuras.',
  'De uno de esos pedazos nadie se acordó. Hasta hoy.',
];
export const INTRO_TITLE = 'El Quiebre';

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
  const sets = [];       // un grupo por plano
  let shot = 0, t = 0, finished = false, titleT = -1;
  let lights = null, lamps = [];
  const shake = { amp: 0 };
  const reduce = () => document.documentElement.classList.contains('reduce-motion');

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

  // ---------- Plano 2: las torres de las Casas ----------
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

  // ---------- Plano 3: de noche, el robo ----------
  function buildTheft() {
    const g = new THREE.Group();
    const V = 1 / 8, W = 176, D = 44;
    const v = new Voxels(), gv = new Voxels();
    for (let x = 0; x < W; x++) for (let z = 0; z < D; z++) {
      for (let y = -3; y <= 0; y++) v.set(x, y, z, y === 0 ? ((x + (z >> 1)) % 4 === 0 || z % 4 === 0 ? '#2e2c2a' : pick(C.cobble, x, y, z)) : C.deep[0]);
    }
    // depósito de las Casas al fondo: pared con portones, un portón roto
    for (let x = 0; x < W; x++) for (let y = 1; y < 34; y++) for (let z = 0; z < 4; z++) {
      const gate = (x % 44 > 16 && x % 44 < 28) && y < 20;
      if (gate && z > 0) continue;
      const broken = x >= 104 && x < 116 && y < 20;
      if (broken && z > 0) continue;
      v.set(x, y, z, gate ? (broken ? null : (x % 2 ? C.woodD : C.wood)) : y % 7 === 0 ? C.mortar : pick(C.stone, x, y, z));
    }
    // cajones con cristales a la vista (los que se cayeron del portón roto)
    const crate = (x0, z0, s) => {
      v.box(x0, 1, z0, s, s - 1, s, (x, y, z) => (x === x0 || x === x0 + s - 1 || z === z0 || z === z0 + s - 1) && y % 3 !== 0 ? C.woodD : C.wood);
      for (let x = x0 + 1; x < x0 + s - 1; x++) for (let z = z0 + 1; z < z0 + s - 1; z++) if (h2(x, z, 3) < 0.6) gv.set(x, s, z, VEIN.cefiro);
    };
    crate(100, 8, 7); crate(110, 12, 6); crate(92, 14, 5); crate(36, 9, 7); crate(150, 10, 6);
    for (let i = 0; i < 18; i++) { const x = 96 + Math.floor(h2(i, 1, 2) * 26), z = 18 + Math.floor(h2(i, 2, 2) * 14); gv.set(x, 1, z, h2(i, 3, 3) < 0.5 ? VEIN.cefiro : VEIN.marea); }
    const land = mesh(v, V), gm = mesh(gv, V, glow('loot'), { shadow: false });
    g.add(land, gm);
    for (const c of [land, gm]) { c.position.x -= W * V / 2; c.position.z -= 2.4; }
    const thieves = [
      { type: 'humano', build: 'esbelto', skin: 4, hair: 'despeinado', hairColor: 'negro', face: 'ninguna', dress: 'viajero', dressColor: 'negro', crown: 'capucha', acc: 'bolso' },
      { type: 'zorro', build: 'esbelto', skin: 0, hair: 'coleta', hairColor: 'blanco', face: 'ninguna', dress: 'cuero', dressColor: 'azul', crown: 'bandana', acc: 'ninguno' },
      { type: 'humano', build: 'recio', skin: 1, hair: 'corto', hairColor: 'castano', face: 'barba_corta', dress: 'pieles', dressColor: 'verde', crown: 'gorro', acc: 'mochila' },
    ].map((look, i) => {
      const p = person(look);
      const loot = cube(0.12, i === 1 ? VEIN.marea : VEIN.cefiro);
      loot.position.set(i === 1 ? -0.2 : 0.22, 0.55, 0.12);
      p.add(loot);
      p.userData.ox = [0, -0.7, -1.3][i]; p.userData.oz = [0.9, 1.6, 0.5][i];
      g.add(p);
      return p;
    });
    const guards = [0, 1].map(i => {
      const p = person({ type: 'humano', build: 'recio', skin: 2 + i, hair: 'cortito', hairColor: i ? 'gris' : 'negro', face: i ? 'cicatriz' : 'barba_corta', dress: 'tabardo', dressColor: 'rojo', crown: 'casco', acc: i ? 'lanza' : 'farolito' });
      p.userData.ox = 2.6 + i * 0.9; p.userData.oz = [1.0, 1.9][i];
      g.add(p);
      return p;
    });
    g.userData.people = { thieves, guards };
    g.userData.update = (dt, tt, st) => {
      const lead = 4.5 - st * 1.15;
      for (const p of thieves) { p.position.set(lead + p.userData.ox, 0.13, p.userData.oz); p.rotation.y = -Math.PI / 2; p.userData.update?.(dt, true); }
      guards.forEach((p, i) => { p.position.set(lead + p.userData.ox, 0.13, p.userData.oz); p.rotation.y = -Math.PI / 2; p.userData.update?.(dt, true); });
      // los faroles de la guardia y el brillo de lo robado
      if (lamps.length) {
        lamps[0].position.set(guards[0].position.x - 0.25, 0.9, guards[0].position.z + 0.3);
        lamps[1].position.set(guards[1].position.x - 0.2, 1.1, guards[1].position.z + 0.2);
        lamps[2].position.set(thieves[0].position.x, 0.7, thieves[0].position.z + 0.3);
        lamps[0].intensity = 2.6 + Math.sin(tt * 13) * 0.25;
        lamps[1].intensity = 1.8 + Math.sin(tt * 11 + 1) * 0.2;
      }
      glowMats.loot.color.setScalar(0.85 + 0.15 * Math.sin(tt * 4));
    };
    return g;
  }

  // ---------- Plano 4: la grieta ----------
  function buildCrack() {
    const g = new THREE.Group();
    const V = 1 / 8, W = 112, D = 80, TH = 14;
    const left = new Voxels(), right = new Voxels();
    const crackX = (z) => 56 + Math.round(Math.sin(z * 0.22) * 4 + Math.sin(z * 0.61) * 1.5);
    const huts = [[22, 18], [30, 52], [80, 24], [88, 56], [70, 40]];
    for (let x = 0; x < W; x++) for (let z = 0; z < D; z++) {
      const cx = crackX(z);
      if (Math.abs(x - cx) < 1) continue;
      const side = x < cx ? left : right;
      const hTop = Math.floor(fbm(x * 0.05, z * 0.05, 31) * 2.5);
      for (let y = -TH; y <= hTop; y++) {
        const dTop = hTop - y;
        // cerca del corte la roca se pone caliente
        const near = Math.abs(x - cx) < 3 && y < -6;
        const col = near ? (h2(x, y, z) < 0.5 ? '#6a3524' : '#4e2a20') : dTop === 0 ? pick(C.grass, x, y, z) : dTop <= 2 ? pick(C.dirt, x, y, z) : y > -7 ? pick(C.rock, x, y, z) : pick(C.deep, x, y, z);
        side.set(x, y, z, col);
      }
    }
    // chozas de piedra con techo de paja
    for (const [hx, hz] of huts) {
      const side = hx < crackX(hz) ? left : right;
      const base = Math.floor(fbm(hx * 0.05, hz * 0.05, 31) * 2.5) + 1;
      side.box(hx, base, hz, 9, 7, 8, (x, y, z) => (x === hx || x === hx + 8 || z === hz || z === hz + 7) ? ((y === base + 3 && (x === hx + 4 || z === hz + 3)) ? '#1a1514' : pick(C.stone, x, y, z)) : null);
      for (let s = 0; s < 5; s++) side.box(hx - 1 + s, base + 7 + s, hz - 1, 11 - s * 2, 1, 10, s % 2 ? '#8a7448' : '#7a6640');
    }
    const ox = -W * V / 2, oz = -D * V / 2;
    const L = new THREE.Group(), R = new THREE.Group();
    const lm = mesh(left, V), rm = mesh(right, V);
    lm.position.set(ox, 0, oz); rm.position.set(ox, 0, oz);
    L.add(lm); R.add(rm);
    g.add(L, R);
    // la Brasa abajo: un plano que brilla en el fondo de la grieta
    const lavaG = new THREE.PlaneGeometry(4, 11);
    const lavaM = new THREE.MeshBasicMaterial({ color: C.lava });
    own.push(lavaG, lavaM);
    const lava = new THREE.Mesh(lavaG, lavaM);
    lava.rotation.x = -Math.PI / 2; lava.position.set(0, -1.6, 0);
    g.add(lava);
    // gente que retrocede del borde
    const folks = [
      [{ type: 'humano', build: 'recio', skin: 2, hair: 'despeinado', hairColor: 'castano', face: 'barba_corta', dress: 'viajero', dressColor: 'verde', crown: 'ninguna', acc: 'ninguno' }, L, -0.6, 1.4, -1],
      [{ type: 'enano', build: 'recio', skin: 4, hair: 'cortito', hairColor: 'negro', face: 'barba_larga', dress: 'minero', dressColor: 'negro', crown: 'ninguna', acc: 'martillo' }, L, -1.3, -0.4, -1],
      [{ type: 'zorro', build: 'esbelto', skin: 2, hair: 'coleta', hairColor: 'gris', face: 'ninguna', dress: 'abrigo', dressColor: 'azul', crown: 'ninguna', acc: 'ninguno' }, R, 0.9, 0.8, 1],
      [{ type: 'humano', build: 'esbelto', skin: 0, hair: 'largo', hairColor: 'rubio', face: 'ninguna', dress: 'vestido', dressColor: 'durazno', crown: 'ninguna', acc: 'ninguno' }, R, 1.4, -1.1, 1],
    ].map(([look, side, x, z, dir]) => {
      const p = person(look);
      const y = (Math.floor(fbm((x / V + 56) * 0.05, (z / V + 40) * 0.05, 31) * 2.5) + 1) * V;
      p.position.set(x, y, z); p.rotation.y = dir < 0 ? Math.PI / 2 : -Math.PI / 2;
      p.userData = { ...p.userData, x0: x, dir };
      side.add(p);
      return p;
    });
    // piedras que caen en la grieta
    const debris = [];
    for (let i = 0; i < 26; i++) {
      const d = cube(0.11 + h2(i, 1, 1) * 0.1, i % 3 ? 0x4a4540 : 0x6b5236, false);
      d.castShadow = true;
      const z = (h2(i, 2, 1) - 0.5) * 9;
      d.userData = { x: (crackX(Math.round(z / V + 40)) - 56) * V + (h2(i, 3, 1) - 0.5) * 0.3, z, t0: 1.7 + h2(i, 4, 1) * 4, vy: 0 };
      d.visible = false;
      debris.push(d); g.add(d);
    }
    let cracked = false;
    g.userData.update = (dt, tt, st) => {
      const open = ease((st - 1.6) / 3.6);
      L.position.set(-open * 0.75, -open * 0.12, 0); L.rotation.z = open * 0.05;
      R.position.set(open * 0.55, -open * 0.35, 0); R.rotation.z = -open * 0.035;
      shake.amp = st < 1.6 ? 0.012 + st * 0.01 : Math.max(0, 0.06 * (1 - (st - 1.6) / 4)) + 0.01;
      if (!cracked && st >= 1.6) { cracked = true; try { ctx.audio.sfx('crash'); } catch {} }
      for (const p of folks) {
        const back = ease((st - 1.2) / 2.4);
        p.position.x = p.userData.x0 + p.userData.dir * back * 0.9;
        p.userData.update?.(dt, st > 1.2 && st < 3.8);
      }
      for (const d of debris) {
        const u = d.userData;
        if (st < u.t0) continue;
        if (!d.visible) { d.visible = true; d.position.set(u.x, 0.2, u.z); u.vy = 0; }
        u.vy -= 9 * dt; d.position.y += u.vy * dt; d.rotation.x += dt * 3; d.rotation.z += dt * 2;
        if (d.position.y < -2.2) d.visible = false;
      }
      lavaM.color.setHex(C.lava).multiplyScalar(0.35 + open * 0.75 + Math.sin(tt * 5) * 0.05);
    };
    g.userData.reset = () => { cracked = false; for (const d of debris) d.visible = false; };
    return g;
  }

  // ---------- Plano 5: las islas suben ----------
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
    return g;
  }

  // ---------- Plano 6: tu fragmento y el esquife que llega ----------
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
    // el esquife: en la primera vez llega alguien con capucha; al volver a verla, tu personaje
    const look = params.replay && ctx.state?.onboarded && ctx.state.avatar ? ctx.state.avatar
      : { type: 'humano', build: 'recio', skin: 2, hair: 'cortito', hairColor: 'castano', face: 'ninguna', dress: 'capa_viaje', dressColor: 'verde', crown: 'capucha', acc: 'ninguno' };
    const skiff = skiffModel(ctx.state?.car || {}, { driver: look });
    skiff.scale.setScalar(1.25);
    g.add(skiff);
    const from = [-9.5, -0.6, 9], to = [-4.35, 0.05, 1.75];
    g.userData.update = (dt, tt, st) => {
      const u = ease(st / 8.2);
      const [x, y, z] = lerp3(from, to, u);
      skiff.position.set(x, y + Math.sin(tt * 1.6) * 0.04, z);
      skiff.rotation.y = Math.atan2(to[0] - from[0], to[2] - from[2]) + (1 - u) * 0.2;
      skiff.userData.update?.(dt, (1 - u) * 1.6, -0.2 * (1 - u));
      islets[0].position.y = -1.2 + Math.sin(tt * 0.7) * 0.06;
      islets[1].position.y = -2 + Math.sin(tt * 0.6 + 2) * 0.05;
      glowMats.cef6.color.setScalar(0.8 + 0.2 * Math.sin(tt * 2));
    };
    return g;
  }

  // ---------- Planos: duración, cámara y luz ----------
  // cam: [desde, hasta] (posición), look: [desde, hasta] (a dónde mira). light: cielo, piso, intensidades y niebla.
  const SHOTS = [
    { build: buildContinent, dur: 8, cam: [[-3, 13, 26], [3.5, 3.6, 14]], look: [[0, -0.5, 0], [1, -1.6, 4]], shadow: 34,
      light: { bg: 0x0b0d13, sky: 0x9fb0d0, ground: 0x2a2420, hemi: 1.15, sun: 0xffe2b8, sunI: 2.0, sunPos: [-10, 20, 12], fog: [0x0b0d13, 30, 60] } },
    { build: buildTowers, dur: 8.5, cam: [[-7.4, 1.6, 7.6], [4.6, 3.0, 9.6]], look: [[-3.4, 1.4, 0.2], [-1.6, 3.4, -2]], shadow: 22,
      light: { bg: 0x1d1a1c, sky: 0xb5a796, ground: 0x2e2620, hemi: 1.0, sun: 0xffc890, sunI: 2.2, sunPos: [14, 16, 10], fog: [0x1d1a1c, 14, 34] } },
    { build: buildTheft, dur: 8.5, cam: [[5.5, 1.8, 6.6], [-4.5, 1.6, 6.2]], look: [[3.2, 0.6, 0.8], [-5.6, 0.6, 0.8]], shadow: 24, night: true,
      light: { bg: 0x07090f, sky: 0x3a4a6e, ground: 0x0a0a10, hemi: 0.55, sun: 0x8aa0d0, sunI: 0.45, sunPos: [-6, 14, 10], fog: [0x07090f, 6, 16] } },
    { build: buildCrack, dur: 7.5, cam: [[0.5, 6.2, 9.5], [0.2, 4.2, 6.2]], look: [[0, 0, 0], [0, -0.6, 0]], shadow: 20,
      light: { bg: 0x140f0e, sky: 0xa79888, ground: 0x3a2018, hemi: 0.95, sun: 0xffb070, sunI: 1.7, sunPos: [8, 14, 6], fog: [0x140f0e, 12, 26] } },
    { build: buildRise, dur: 8.5, cam: [[2.6, -4.6, 7.8], [3.4, -3.4, 9.4]], look: [[0.8, -4.4, 0], [0, 3.2, -1.5]], shadow: 30,
      light: { bg: 0x0d1018, sky: 0x8e9cb8, ground: 0x3a1a10, hemi: 0.85, sun: 0xd6e2ff, sunI: 1.5, sunPos: [6, 26, 4], fog: [0x0d1018, 16, 42] } },
    { build: buildFragment, dur: 9.5, cam: [[7.5, 3.2, 13.5], [3.2, 1.7, 8.6]], look: [[0, 0.3, 0], [-2.2, 0.5, 1.2]], shadow: 18, title: true,
      light: { bg: 0x2a2028, sky: 0xe0a888, ground: 0x2e2430, hemi: 1.05, sun: 0xffa868, sunI: 2.3, sunPos: [-14, 8, 10], fog: [0x2a2028, 16, 34] } },
  ];

  function applyLight(L, size) {
    r.scene.background = new THREE.Color(L.bg);
    r.scene.fog = new THREE.Fog(L.fog[0], L.fog[1], L.fog[2]);
    lights.hemi.color.setHex(L.sky); lights.hemi.groundColor.setHex(L.ground); lights.hemi.intensity = L.hemi;
    lights.sun.color.setHex(L.sun); lights.sun.intensity = L.sunI;
    lights.sun.position.set(...L.sunPos); lights.sun.target.position.set(0, 0, 0);
    const s = size / 2, cam = lights.sun.shadow.camera;
    Object.assign(cam, { left: -s, right: s, top: s, bottom: -s, near: 1, far: 90 });
    cam.updateProjectionMatrix();
  }

  // ---------- Interfaz ----------
  let ui = null;
  function buildUi(container) {
    const { h } = ctx.ui;
    const el = h('div.in-root');
    const fade = h('div.in-fade');
    const sub = h('p.in-sub', { 'aria-live': 'polite' });
    const title = h('div.in-title', {}, INTRO_TITLE);
    const skip = h('button.btn.ghost.small.in-skip', { html: 'Saltar <small>(Esc)</small>' });
    const dots = h('div.in-dots', { html: SHOTS.map(() => '<i></i>').join('') });
    el.append(h('div.in-bar.top'), h('div.in-bar.bot'), fade, sub, title, dots, skip);
    container.append(el);
    skip.addEventListener('click', (e) => { e.stopPropagation(); try { ctx.audio.sfx('close'); } catch {} finish('skip'); });
    el.addEventListener('click', () => next());
    return { el, fade, sub, title, dots };
  }
  function showShot(i) {
    shot = i; t = 0;
    sets.forEach((s, k) => { s.visible = k === i; });
    const S = SHOTS[i];
    applyLight(S.light, S.shadow);
    for (const l of lamps) l.intensity = 0;
    if (S.night && lamps.length) lamps[2].intensity = 1.2;
    sets[i].userData.reset?.();
    shake.amp = 0;
    ui.sub.textContent = INTRO_LINES[i];
    ui.sub.classList.remove('on');
    ui.dots.querySelectorAll('i').forEach((d, k) => d.classList.toggle('on', k <= i));
    ui.title.classList.remove('on');
    titleT = -1;
  }
  function next() {
    if (finished) return;
    if (shot < SHOTS.length - 1) { try { ctx.audio.sfx('select'); } catch {} showShot(shot + 1); }
    else finish('done');
  }
  async function finish(how) {
    if (finished) return;
    finished = true;
    ui?.el.classList.add('out');
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

  // ---------- Bucle ----------
  const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
  function frame(dt, tt) {
    if (finished) return;
    dt = Math.min(dt, 0.05);
    t += dt;
    const S = SHOTS[shot];
    const set = sets[shot];
    set.userData.update?.(dt, tt, t);
    const u = ease(t / S.dur);
    camPos.set(...lerp3(S.cam[0], S.cam[1], u));
    camLook.set(...lerp3(S.look[0], S.look[1], u));
    if (shake.amp > 0 && !reduce()) {
      camPos.x += (Math.random() - 0.5) * shake.amp * 2; camPos.y += (Math.random() - 0.5) * shake.amp * 2;
    }
    // el plano del robo sigue a los que corren
    if (S.night && set.userData.people) {
      const lead = set.userData.people.thieves[0].position.x;
      camPos.x = lead + 0.4 + (1 - u) * 0.6; camLook.x = lead + 0.7;
    }
    // los encuadres están pensados para 16:9: en una ventana más angosta (16:10, 4:3) la cámara se aleja un poco para
    // que no se corten los costados
    const wide = 16 / 9, asp = r.camera.aspect || wide;
    if (asp < wide) camPos.sub(camLook).multiplyScalar(Math.min(1.5, wide / asp)).add(camLook);
    r.camera.position.copy(camPos);
    r.camera.lookAt(camLook);
    // fundido a negro entre planos y el subtítulo
    const fadeIn = Math.max(0, 1 - t / 0.6), fadeOut = S.title ? 0 : Math.max(0, (t - (S.dur - 0.5)) / 0.5);
    ui.fade.style.opacity = String(Math.min(1, Math.max(fadeIn, fadeOut)));
    ui.sub.classList.toggle('on', t > 0.7 && t < S.dur - 0.5);
    if (S.title && t > S.dur - 3.6 && titleT < 0) { titleT = t; ui.title.classList.add('on'); }
    if (t >= S.dur + (S.title ? 1.4 : 0)) next();
  }

  return {
    hud: false,
    music: 'intro',
    async mount(container, p = {}) {
      alive = true; params = p || {};
      ensureStyle();
      r = createPixelRenderer(container, { ortho: false, fov: 42, background: 0x0b0d13, outline: true });
      lights = addLights(r.scene, { shadowSize: 30, shadowRes: 2048 });
      // faroles de la guardia y el brillo de lo robado (siempre en la escena: así no se recompilan los materiales)
      lamps = [new THREE.PointLight(0xffb060, 0, 5, 1.6), new THREE.PointLight(0xffb060, 0, 4.5, 1.6), new THREE.PointLight(0xa8e0ff, 0, 3, 1.6)];
      r.scene.add(...lamps);
      for (const S of SHOTS) { const g = S.build(); g.visible = false; sets.push(g); r.scene.add(g); }
      ui = buildUi(container);
      showShot(Math.max(0, Math.min(SHOTS.length - 1, Number(params.shot) || 0)));
      offFrame = r.onFrame(frame);
      onKey = (e) => {
        if (finished) return;
        if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); try { ctx.audio.sfx('close'); } catch {} finish('skip'); return; }
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight') { e.preventDefault(); e.stopImmediatePropagation(); if (!e.repeat) next(); return; }
        e.stopImmediatePropagation();
      };
      addEventListener('keydown', onKey, true);
      r.start();
      if (window.__pixelia) window.__pixelia.intro = { get shot() { return shot; }, get t() { return t; }, get count() { return SHOTS.length; }, go: (i) => showShot(i), seek: (s) => { const S = sets[shot]; S.userData.reset?.(); t = 0; let k = 0; while (t < s && k++ < 2000) frame(1 / 30, t); }, next, skip: () => finish('skip'), r };
    },
    unmount() {
      alive = false; finished = true;
      if (onKey) removeEventListener('keydown', onKey, true);
      offFrame?.();
      if (r) { r.stop(); r.dispose(); }
      for (const o of own.splice(0)) o.dispose?.();
      sets.length = 0; lamps = [];
      ui?.el.remove(); ui = null;
      if (window.__pixelia) delete window.__pixelia.intro;
      r = null;
    },
  };
}

// ---------- Estilos ----------
let styled = false;
function ensureStyle() {
  if (styled) return;
  styled = true;
  const el = document.createElement('style');
  el.id = 'intro-style';
  el.textContent = `
.in-root { position: absolute; inset: 0; z-index: 5; pointer-events: auto; cursor: pointer; user-select: none; transition: opacity .38s; }
.in-root.out { opacity: 0; }
.in-bar { position: absolute; left: 0; right: 0; height: 9vh; background: #050506; z-index: 2; }
.in-bar.top { top: 0; } .in-bar.bot { bottom: 0; }
.in-fade { position: absolute; inset: 0; background: #050506; opacity: 1; z-index: 1; pointer-events: none; }
.in-sub { position: absolute; z-index: 3; left: 50%; bottom: calc(9vh + 22px); transform: translate(-50%, 6px); margin: 0;
  width: min(900px, calc(100% - 48px)); text-align: center; color: #efe6d8; font-size: clamp(20px, 2.3vw, 28px); line-height: 1.3;
  text-shadow: 0 2px 0 #000, 0 0 18px rgba(0,0,0,.85); opacity: 0; transition: opacity .6s, transform .6s; }
.in-sub.on { opacity: 1; transform: translate(-50%, 0); }
.in-title { position: absolute; z-index: 3; left: 0; right: 0; top: calc(9vh + 7%); text-align: center; color: #e8c676;
  font-size: clamp(42px, 6.5vw, 86px); font-weight: 800; letter-spacing: .28em; text-transform: uppercase;
  text-shadow: 0 4px 0 #000, 0 0 30px rgba(0,0,0,.8); opacity: 0; transform: scale(.96); transition: opacity 1.4s, transform 3s ease-out; }
.in-title.on { opacity: 1; transform: none; }
.in-skip { position: absolute; z-index: 4; top: calc(9vh + 12px); right: 18px; }
.in-dots { position: absolute; z-index: 3; top: calc(9vh + 22px); left: 22px; display: flex; gap: 5px; }
.in-dots i { width: 18px; height: 3px; background: rgba(239,230,216,.22); }
.in-dots i.on { background: #e8c676; }
html.reduce-motion .in-sub, html.reduce-motion .in-title { transition: opacity .2s; transform: translate(-50%, 0); }
html.reduce-motion .in-title { transform: none; }
`;
  document.head.append(el);
}
