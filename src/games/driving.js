// Paseo Real — minijuego de manejar sin fin por las rutas de Pixelia.
// 3 carriles, tránsito lento, conos, charcos, monedas, gemas y poderes. Mundo vóxel por tramos reciclados.
import * as THREE from 'three';
import { createPixelRenderer, addLights } from '../core/voxel.js';
import { icon } from '../core/icons.js';
import { CAR_BODIES, CAR_WHEELS, CAR_TOPPERS, OUTFIT_COLORS } from '../core/data.js';
import * as carMod from '../avatar/car.js';
import * as princessMod from '../avatar/princess.js';
import {
  LANES, LANE_W, CHUNK_LEN, BIOME_LEN, BIOMES, BIOME_DECO, DECO_INFO, biomeIndexAt, rng, pickWeighted,
  applyBend, makeMaterials, groundGeo, outerGeo, decoGeo, decoExtraGeo, itemGeo, obstacleGeo, shieldGeo, particleGeo, warmup,
} from './driving-world.js';
import { Sky } from './driving-sky.js';

const STYLE_ID = 'driving-scene-style';
const MAX_LIVES = 3;
const INVULN_TIME = 1.5;
const TURBO_TIME = 2.2;
const MAGNET_TIME = 8;
const SPAWN_AHEAD = 112;
const N_CHUNKS = 8;
const COIN_POOL = 90;
const PARTICLES = 150;
const PETALS = 36;
const COIN_CHARGE = 0.04;      // carga de turbo por moneda (25 monedas = 1 turbo)

const CSS = `
.scene-driving { overflow: hidden; touch-action: none; background: #ffe2f1; }
.scene-driving .drv-stage { position: absolute; inset: 0; transition: opacity .25s; }
.scene-driving .drv-stage.fade { opacity: 0; transition: none; }
.scene-driving .drv-stage canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; image-rendering: pixelated; image-rendering: crisp-edges; }
.scene-driving .drv-sky { z-index: 0; }
.scene-driving .pixel-canvas { z-index: 1; }
.scene-driving .drv-fx { position: absolute; inset: 0; pointer-events: none; z-index: 3; }
.scene-driving .drv-flash { background: radial-gradient(ellipse at center, rgba(255,120,140,0) 45%, rgba(255,90,120,.6)); opacity: 0; transition: opacity .35s; }
.scene-driving .drv-flash.on { opacity: 1; transition: none; }
.scene-driving .drv-speed { opacity: 0; transition: opacity .3s;
  background: repeating-conic-gradient(from 0deg at 50% 52%, rgba(255,255,255,0) 0deg 6deg, rgba(255,255,255,.75) 6deg 6.8deg, rgba(255,255,255,0) 6.8deg 13deg);
  -webkit-mask-image: radial-gradient(ellipse at 50% 52%, transparent 34%, #000 78%); mask-image: radial-gradient(ellipse at 50% 52%, transparent 34%, #000 78%); }
.scene-driving .drv-speed.on { opacity: 1; animation: drv-spin .18s steps(2) infinite; }
@keyframes drv-spin { 50% { transform: rotate(3deg) scale(1.03); } }

.scene-driving .game-bar { gap: 6px; transition: opacity .3s; }
.scene-driving .game-bar.dim .drv-runstat { opacity: 0; pointer-events: none; }
.scene-driving .game-stat { min-width: 0; padding: 2px 9px; }
.scene-driving .game-stat b { display: flex; align-items: center; gap: 3px; font-variant-numeric: tabular-nums; white-space: nowrap; }
.scene-driving .drv-lives b { gap: 1px; }
.scene-driving .drv-lives img.off { filter: grayscale(1) opacity(.35); }
.scene-driving .drv-lives img.pop { animation: drv-pop .35s; }
.scene-driving .game-stat.bump { animation: drv-bump .22s; }
.scene-driving .drv-title { display: none; margin-left: 4px; }
@media (min-width: 760px) { .scene-driving .drv-title { display: block; } .scene-driving .game-stat { padding: 2px 12px; min-width: 84px; } }
@keyframes drv-bump { 45% { transform: scale(1.15); } }
@keyframes drv-pop { 0% { transform: scale(.2); } 60% { transform: scale(1.4); } }

.scene-driving .drv-powers { position: absolute; z-index: 9; top: calc(var(--safe-t) + 66px); left: calc(var(--safe-l) + 8px); display: flex; flex-direction: column; gap: 6px; pointer-events: none; }
.scene-driving .drv-power { display: flex; align-items: center; gap: 6px; background: #fff; border: var(--line) solid var(--ink); border-radius: 12px; padding: 2px 9px 2px 4px; box-shadow: 0 3px 0 var(--ink); font-weight: 700; font-size: 14px; animation: drv-in .3s cubic-bezier(.3,1.6,.6,1); }
.scene-driving .drv-power .progress { width: 54px; height: 9px; }
.scene-driving .drv-power.mint { background: var(--mint-l); }
@keyframes drv-in { from { transform: translateX(-30px); opacity: 0; } }

.scene-driving .drv-turbo { position: absolute; z-index: 9; left: 50%; bottom: calc(var(--safe-b) + 14px); transform: translateX(-50%); transition: opacity .3s, transform .3s; }
.scene-driving .drv-turbo.hide { opacity: 0; pointer-events: none; transform: translate(-50%, 30px); }
.scene-driving .drv-turbo button { display: flex; align-items: center; gap: 8px; min-height: 48px; padding: 6px 14px 6px 8px; background: #fff; color: var(--ink); border: var(--line) solid var(--ink); border-radius: 16px;
  box-shadow: inset 0 -5px 0 #eadcf0, 0 4px 0 var(--ink); font-size: 17px; font-weight: 700; touch-action: none; }
.scene-driving .drv-turbo button.ready { background: var(--gold); box-shadow: inset 0 -5px 0 var(--gold-d), 0 4px 0 var(--ink); animation: drv-ready .9s steps(2) infinite; }
.scene-driving .drv-turbo button.on { background: var(--pink); color: #fff; box-shadow: inset 0 -5px 0 var(--pink-d), 0 4px 0 var(--ink); text-shadow: 0 2px 0 rgba(59,35,64,.35); }
.scene-driving .drv-turbo button:active { transform: translateY(3px); box-shadow: inset 0 -2px 0 #eadcf0, 0 1px 0 var(--ink); }
.scene-driving .drv-turbo kbd { font: inherit; font-size: 12px; padding: 0 5px; border: 2px solid var(--ink); border-radius: 6px; background: #fff; color: var(--ink); text-shadow: none; }
@keyframes drv-ready { 50% { transform: scale(1.05); } }
.scene-driving .drv-turbo button.nope { animation: drv-nope .3s steps(4); }
@keyframes drv-nope { 25% { transform: translateX(-6px); } 75% { transform: translateX(6px); } }
.scene-driving .drv-segs { display: flex; gap: 3px; }
.scene-driving .drv-segs i { width: 22px; height: 13px; border: 2px solid var(--ink); background: #f2e3ee; border-radius: 4px; position: relative; overflow: hidden; }
.scene-driving .drv-segs i u { position: absolute; left: 0; top: 0; bottom: 0; width: 0; background: repeating-linear-gradient(90deg, #ffd166 0 4px, #e8a93a 4px 6px); }
.scene-driving .drv-turbo .ready .drv-segs i { background: #fff7dc; }

.scene-driving .drv-banner { position: absolute; z-index: 8; left: 50%; top: calc(var(--safe-t) + 120px); transform: translateX(-50%); pointer-events: none; white-space: nowrap;
  display: flex; align-items: center; gap: 8px; font-size: 30px; font-weight: 700; color: #fff; opacity: 0;
  text-shadow: 3px 0 var(--ink), -3px 0 var(--ink), 0 3px var(--ink), 0 -3px var(--ink), 3px 3px var(--ink), -3px 3px var(--ink), 3px -3px var(--ink), -3px -3px var(--ink), 0 6px 0 var(--pink-d); }
.scene-driving .drv-banner.show { animation: drv-banner 2.4s cubic-bezier(.2,.9,.3,1) forwards; }
.scene-driving .drv-banner.gold { color: var(--gold); }
.scene-driving .drv-banner small { display: block; font-size: 16px; }
@keyframes drv-banner { 0% { opacity: 0; transform: translate(-50%, -10px) scale(.4); } 12% { opacity: 1; transform: translate(-50%, 0) scale(1.12); } 22% { transform: translate(-50%, 0) scale(1); }
  80% { opacity: 1; transform: translate(-50%, 0) scale(1); } 100% { opacity: 0; transform: translate(-50%, -30px) scale(.95); } }

.scene-driving .drv-count { position: absolute; z-index: 11; left: 50%; top: 40%; transform: translate(-50%, -50%); pointer-events: none; font-size: 150px; font-weight: 700; color: #fff; opacity: 0;
  text-shadow: 5px 0 var(--ink), -5px 0 var(--ink), 0 5px var(--ink), 0 -5px var(--ink), 5px 5px var(--ink), -5px 5px var(--ink), 5px -5px var(--ink), -5px -5px var(--ink), 0 12px 0 var(--pink-d); }
.scene-driving .drv-count.go { color: var(--gold); font-size: 110px; }
.scene-driving .drv-count.show { animation: drv-count .8s cubic-bezier(.2,1.4,.4,1) forwards; }
@keyframes drv-count { 0% { opacity: 0; transform: translate(-50%, -50%) scale(2.2); } 25% { opacity: 1; transform: translate(-50%, -50%) scale(1); } 80% { opacity: 1; } 100% { opacity: 0; transform: translate(-50%, -50%) scale(.8); } }

.scene-driving .drv-hint { position: absolute; z-index: 4; left: 0; right: 0; bottom: calc(var(--safe-b) + 84px); display: flex; justify-content: space-between; padding: 0 calc(var(--safe-l) + 14px) 0 calc(var(--safe-r) + 14px);
  pointer-events: none; opacity: 0; transition: opacity .5s; }
.scene-driving .drv-hint.show { opacity: 1; }
.scene-driving .drv-hint span { display: flex; align-items: center; gap: 6px; padding: 6px 12px; background: rgba(255,255,255,.88); border: var(--line) solid var(--ink); border-radius: 14px; box-shadow: 0 3px 0 var(--ink); font-weight: 700; font-size: 16px; animation: drv-ready 1s steps(2) infinite; }
.scene-driving .drv-hint kbd { font: inherit; padding: 0 6px; border: 2px solid var(--ink); border-radius: 6px; background: #fff; box-shadow: 0 2px 0 var(--ink); }

.scene-driving .drv-intro { position: absolute; inset: 0; z-index: 12; display: flex; align-items: flex-end; justify-content: center;
  padding: calc(var(--safe-t) + 64px) calc(var(--safe-r) + 12px) calc(var(--safe-b) + 12px) calc(var(--safe-l) + 12px);
  background: linear-gradient(rgba(59,35,64,0) 35%, rgba(59,35,64,.28)); transition: opacity .35s; }
.scene-driving .drv-intro.hide { opacity: 0; pointer-events: none; }
.scene-driving .drv-card { width: min(430px, 100%); max-height: 100%; overflow-y: auto; touch-action: pan-y; background: var(--panel); border: var(--line) solid var(--ink); border-radius: 18px;
  box-shadow: 0 6px 0 var(--ink), 0 18px 40px rgba(59,35,64,.3); padding: 12px 14px 14px; display: flex; flex-direction: column; gap: 10px; animation: drv-card .45s cubic-bezier(.3,1.5,.6,1); }
@keyframes drv-card { from { transform: translateY(40px) scale(.94); opacity: 0; } }
.scene-driving .drv-logo { display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 40px; font-weight: 700; color: #fff; line-height: 1; margin-top: 2px;
  text-shadow: 3px 0 var(--ink), -3px 0 var(--ink), 0 3px var(--ink), 0 -3px var(--ink), 3px 3px var(--ink), -3px 3px var(--ink), 3px -3px var(--ink), -3px -3px var(--ink), 0 7px 0 var(--pink-d); }
.scene-driving .drv-logo img { filter: drop-shadow(0 3px 0 rgba(59,35,64,.3)); }
.scene-driving .drv-sub { text-align: center; margin: 0; font-size: 15px; color: var(--ink-l); }
.scene-driving .drv-rec { align-self: center; display: flex; gap: 8px; }
.scene-driving .drv-rec .chip { font-size: 15px; padding: 3px 10px; }
.scene-driving .drv-ctrls { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.scene-driving .drv-ctrl { display: flex; flex-direction: column; align-items: center; gap: 4px; text-align: center; background: #fff; border: var(--line) solid var(--ink); border-radius: 12px; padding: 8px 6px; box-shadow: 0 3px 0 var(--ink); font-size: 13px; font-weight: 700; line-height: 1.15; }
.scene-driving .drv-ill { height: 46px; display: flex; align-items: center; justify-content: center; gap: 4px; }
.scene-driving .drv-phone { width: 66px; height: 44px; border: 3px solid var(--ink); border-radius: 8px; display: grid; grid-template-columns: 1fr 1fr; overflow: hidden; background: #fff; position: relative; }
.scene-driving .drv-phone i { display: grid; place-items: center; font-style: normal; font-size: 14px; }
.scene-driving .drv-phone i:first-child { background: var(--pink-l); border-right: 2px dashed var(--ink-ll); }
.scene-driving .drv-phone i:last-child { background: var(--lilac-l); }
.scene-driving .drv-phone.up { grid-template-columns: 1fr; background: var(--gold-l); }
.scene-driving .drv-phone.up i { background: none !important; border: 0 !important; }
.scene-driving .drv-swipe { animation: drv-swipe 1.2s steps(4) infinite; }
@keyframes drv-swipe { 0% { transform: translateY(8px); opacity: .4; } 60% { transform: translateY(-8px); opacity: 1; } 100% { transform: translateY(-8px); opacity: 0; } }
.scene-driving .drv-key { display: inline-grid; place-items: center; min-width: 28px; height: 28px; padding: 0 6px; border: 2px solid var(--ink); border-radius: 7px; background: #fff; box-shadow: inset 0 -3px 0 #eadcf0, 0 2px 0 var(--ink); font-size: 14px; font-weight: 700; }
.scene-driving .drv-key.wide { min-width: 64px; }
.scene-driving .drv-ctrl small { font-weight: 400; color: var(--ink-l); font-size: 12px; }
.scene-driving .drv-legend { display: grid; grid-template-columns: repeat(3, 1fr); gap: 5px; }
.scene-driving .drv-legend span { display: flex; align-items: center; gap: 4px; font-size: 13px; font-weight: 700; background: rgba(255,255,255,.75); border-radius: 9px; padding: 3px 5px; line-height: 1.05; }
.scene-driving .drv-legend span.bad { background: #ffe1e6; }
.scene-driving .drv-go { font-size: 24px; min-height: 56px; }
.scene-driving .drv-go img { margin-right: 2px; }
.scene-driving:not(.touch) .drv-only-touch, .scene-driving.touch .drv-only-kb { display: none !important; }
@media (min-width: 900px) and (min-aspect-ratio: 1/1) {
  .scene-driving .drv-intro { align-items: center; justify-content: flex-end; padding-right: calc(var(--safe-r) + 7vw); background: linear-gradient(90deg, rgba(59,35,64,0) 40%, rgba(59,35,64,.22)); }
  .scene-driving .drv-logo { font-size: 48px; }
}
@media (max-height: 700px) and (max-width: 600px) {
  .scene-driving .drv-ill { height: 36px; }
  .scene-driving .drv-logo { font-size: 32px; }
}
`;

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function lerp(a, b, t) { return a + (b - a) * t; }
function smooth(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }

export default function create(ctx) {
  const { store, ui, audio } = ctx;
  let root = null, stage = null, r = null, sky = null, mats = null;
  let unmounted = false;
  const offs = [];                 // funciones de limpieza
  const bendU = { value: new THREE.Vector2(0, 0.0011) };

  // ---------- estado de juego ----------
  let phase = 'intro';             // intro | countdown | run | crash | ended
  let paused = false, pauseModal = null, resumeT = 0, resumeShown = 0, queuedDir = 0;
  const lastSky = [0, 0, 0];
  let p = 0, v = 0, runStart = 0, cd = 0, cdShown = -1, crashT = 0, time = 0;
  let lane = 1, carX = 0, steer = 0, lives = MAX_LIVES, coins = 0, gems = 0;
  let charge = 0, turboT = 0, magnetT = 0, shield = false, invulnT = 0, skidT = 0, wobbleT = 0, shake = 0;
  let nextRowZ = 0, lastPowerM = 0, lastGemM = 0, lastStatic = [-1e9, -1e9, -1e9];
  let camBlend = 0, bestAtStart = 0, recordPassed = false, lastBiome = 0, hintT = 0, exhaustT = 0, coinSfxT = 0;
  let stats = { speed: 3, handling: 3 }, vBase = 11, vMax = 25, laneRate = 11;
  let debugStart = 0;

  // ---------- objetos 3D ----------
  let rig, carHolder, carObj, carSize = { w: 0.55, l: 1, h: 0.5 }, shieldMesh, recordMesh, lights, outerL, outerR;
  const chunks = [];
  const obstacles = [];  // {kind, mesh, active, lane, x, z, w, l, y, fly..., meet, k}
  const items = [];      // poderes / gemas
  const coinList = [];   // {active, x, z, y, lane, magnet, phase}
  let coinIM = null, partIM = null, petalIM = null;
  const parts = [];
  const petals = [];
  let partCursor = 0;
  const dummy = new THREE.Object3D();
  const tmpColor = new THREE.Color();
  const tmpV = new THREE.Vector3();
  const camPos = new THREE.Vector3(), camTarget = new THREE.Vector3(), camPos2 = new THREE.Vector3(), camTarget2 = new THREE.Vector3();
  const fogColor = new THREE.Color(), hemiSky = new THREE.Color(), hemiGround = new THREE.Color(), colA = new THREE.Color(), colB = new THREE.Color();
  const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

  // ---------- DOM ----------
  const el = {};
  let isTouch = false;

  // =====================================================================
  // Construcción de escena
  // =====================================================================
  function bendify(obj, cache) {
    obj.traverse(o => {
      if (!o.isMesh || !o.material) return;
      const swap = (m) => {
        if (!m || !(m.isMeshLambertMaterial || m.isMeshStandardMaterial || m.isMeshPhongMaterial || m.isMeshBasicMaterial || m.isMeshToonMaterial)) return m;
        if (!cache.has(m)) cache.set(m, applyBend(m.clone(), bendU));
        return cache.get(m);
      };
      o.material = Array.isArray(o.material) ? o.material.map(swap) : swap(o.material);
      o.frustumCulled = false;
    });
  }

  /**
   * Autos del tránsito: funde carrocería + conductora + adorno en una sola malla (las ruedas siguen girando aparte).
   * Pasa de ~12 a 5 draw calls por auto (x2 con sombras). Las geometrías originales son compartidas: no se liberan.
   */
  function flattenCar(car) {
    car.updateMatrixWorld(true);
    const wheels = new Set(car.userData.wheels || []);
    const parts = [];
    let mat = null;
    car.traverseVisible(o => {
      if (!o.isMesh || wheels.has(o) || Array.isArray(o.material)) return;
      const g = o.geometry;
      if (!g.index || !g.attributes.normal || !g.attributes.color) return;
      if (mat && o.material !== mat) return;
      mat = o.material;
      parts.push(o);
    });
    if (parts.length < 2) return;
    let nv = 0, ni = 0;
    for (const m of parts) { nv += m.geometry.attributes.position.count; ni += m.geometry.index.count; }
    const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), col = new Float32Array(nv * 3), idx = new Uint32Array(ni);
    const inv = new THREE.Matrix4().copy(car.matrixWorld).invert(), mtx = new THREE.Matrix4(), nm = new THREE.Matrix3(), v = new THREE.Vector3();
    let vo = 0, io = 0;
    for (const m of parts) {
      mtx.multiplyMatrices(inv, m.matrixWorld); nm.getNormalMatrix(mtx);
      const { position: P, normal: N, color: C } = m.geometry.attributes, I = m.geometry.index;
      for (let i = 0; i < P.count; i++) {
        v.fromBufferAttribute(P, i).applyMatrix4(mtx); pos[(vo + i) * 3] = v.x; pos[(vo + i) * 3 + 1] = v.y; pos[(vo + i) * 3 + 2] = v.z;
        v.fromBufferAttribute(N, i).applyMatrix3(nm).normalize(); nor[(vo + i) * 3] = v.x; nor[(vo + i) * 3 + 1] = v.y; nor[(vo + i) * 3 + 2] = v.z;
        col[(vo + i) * 3] = C.getX(i); col[(vo + i) * 3 + 1] = C.getY(i); col[(vo + i) * 3 + 2] = C.getZ(i);
      }
      const flip = mtx.determinant() < 0;   // piezas espejadas (alas): invertir el orden para no perder las caras
      for (let i = 0; i < I.count; i += 3) {
        idx[io + i] = I.getX(i) + vo;
        idx[io + i + 1] = I.getX(flip ? i + 2 : i + 1) + vo;
        idx[io + i + 2] = I.getX(flip ? i + 1 : i + 2) + vo;
      }
      vo += P.count; io += I.count;
      m.parent.remove(m);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.computeBoundingSphere();
    const merged = new THREE.Mesh(g, mat);
    merged.castShadow = true; merged.receiveShadow = true;
    car.add(merged);
  }

  function buildScene() {
    const { scene } = r;
    scene.fog = new THREE.Fog(0xffe2f1, 34, 98);
    lights = addLights(scene, { shadowSize: 28, shadowRes: 1024 });
    const sc = lights.sun.shadow.camera;
    Object.assign(sc, { left: -13, right: 13, top: 15, bottom: -15, near: 1, far: 60 });
    sc.updateProjectionMatrix();
    lights.hemi.intensity = 1.55;
    lights.sun.intensity = 1.9;

    // planos laterales grandes
    outerL = new THREE.Mesh(outerGeo(), mats.outerL); outerL.scale.x = -1; outerL.position.x = -14; outerL.receiveShadow = false; outerL.frustumCulled = false;
    outerR = new THREE.Mesh(outerGeo(), mats.outerR); outerR.position.x = 14; outerR.frustumCulled = false;
    mats.outerL.side = THREE.DoubleSide;
    scene.add(outerL, outerR);

    // tramos: piso + todo el decorado estático fusionado en 1 malla (y otra para lo brillante) por tramo
    for (let i = 0; i < N_CHUNKS; i++) {
      const group = new THREE.Group();
      const ground = new THREE.Mesh(groundGeo(0, 0), mats.base);
      ground.receiveShadow = true; ground.castShadow = false; ground.frustumCulled = false;
      const base = mergedMesh(mats.base), glow = mergedMesh(mats.glow);
      group.add(ground, base, glow);
      scene.add(group);
      chunks.push({ group, ground, base, glow, extras: [], z0: 0, bi: -1, shadow: true });
    }

    // auto propio con la princesa
    const st = ctx.state;
    rig = new THREE.Group();
    carHolder = new THREE.Group();
    carHolder.rotation.y = Math.PI;
    carObj = carMod.carModel(st.car, { driver: st.princess });
    carObj.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    carSize = Object.assign({ w: 0.55, l: 1, h: 0.5 }, carObj.userData.size || {});
    carHolder.add(carObj);
    rig.add(carHolder);
    shieldMesh = new THREE.Mesh(shieldGeo(), mats.shield);
    shieldMesh.position.y = 0.38; shieldMesh.scale.set(0.95, 0.75, 1.15); shieldMesh.visible = false;
    rig.add(shieldMesh);
    scene.add(rig);

    // tránsito: autitos de otras princesas
    const bendCache = new Map();
    const bodies = CAR_BODIES.map(b => b.id), colors = OUTFIT_COLORS.map(c => c.id).filter(c => c !== 'negro');
    const R = rng(4242);
    for (let i = 0; i < 7; i++) {
      const spec = {
        body: bodies[i % bodies.length], color: colors[(i * 5 + 3) % colors.length],
        wheels: R.pick(CAR_WHEELS).id, topper: R() < 0.4 ? R.pick(CAR_TOPPERS).id : 'ninguno',
      };
      const look = typeof princessMod.randomLook === 'function' ? princessMod.randomLook(1000 + i * 37) : null;
      const car = carMod.carModel(spec, look ? { driver: look } : {});
      flattenCar(car);
      car.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      bendify(car, bendCache);
      const holder = new THREE.Group();
      holder.rotation.y = Math.PI;
      holder.add(car);
      const g = new THREE.Group(); g.add(holder); g.visible = false;
      scene.add(g);
      const size = Object.assign({ w: 0.55, l: 1, h: 0.5 }, car.userData.size || {});
      obstacles.push({ kind: 'car', mesh: g, car, active: false, lane: 0, x: 0, z: 0, y: 0, w: size.w, l: size.l, meet: 0, k: 0.25 });
    }
    // obstáculos fijos
    const addObst = (kind, n, w, l) => {
      for (let i = 0; i < n; i++) {
        const m = new THREE.Mesh(obstacleGeo(kind), kind === 'puddle' ? mats.bright : mats.base);
        m.castShadow = kind !== 'puddle'; m.receiveShadow = true; m.frustumCulled = false; m.visible = false;
        if (kind === 'puddle') { m.scale.y = 0.3; m.position.y = 0.01; }
        r.scene.add(m);
        obstacles.push({ kind, mesh: m, active: false, lane: 0, x: 0, z: 0, y: 0, w, l });
      }
    };
    addObst('barrier', 10, 1.05, 0.38);   // hitbox <= modelo (1.25 x 0.375)
    addObst('cones', 10, 1.0, 0.75);
    addObst('puddle', 6, 0.95, 1.6);

    // poderes / gemas
    const addItem = (kind, n) => {
      for (let i = 0; i < n; i++) {
        const m = new THREE.Mesh(itemGeo(kind), mats.bright);
        m.castShadow = true; m.frustumCulled = false; m.visible = false;
        r.scene.add(m);
        items.push({ kind, mesh: m, active: false, lane: 0, x: 0, z: 0 });
      }
    };
    addItem('gem', 3); addItem('heart', 2); addItem('magnet', 2); addItem('shield', 2); addItem('turbo', 3);

    // monedas (una sola malla instanciada)
    coinIM = new THREE.InstancedMesh(itemGeo('coin'), mats.coin, COIN_POOL);
    coinIM.frustumCulled = false; coinIM.castShadow = true;
    for (let i = 0; i < COIN_POOL; i++) { coinIM.setMatrixAt(i, ZERO); coinList.push({ active: false, x: 0, z: 0, lane: 0, magnet: false, ph: i * 0.37 }); }
    r.scene.add(coinIM);

    // partículas
    partIM = new THREE.InstancedMesh(particleGeo(), mats.base, PARTICLES);
    partIM.frustumCulled = false;
    for (let i = 0; i < PARTICLES; i++) { partIM.setMatrixAt(i, ZERO); partIM.setColorAt(i, tmpColor.set(0xffffff)); parts.push({ life: 0, max: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, g: 0, s: 1, world: true }); }
    r.scene.add(partIM);
    petalIM = new THREE.InstancedMesh(particleGeo(), mats.bright, PETALS);
    petalIM.frustumCulled = false;
    for (let i = 0; i < PETALS; i++) {
      petalIM.setMatrixAt(i, ZERO); petalIM.setColorAt(i, tmpColor.set(0xffb3d4));
      petals.push({ x: (Math.random() - 0.5) * 16, y: Math.random() * 6, z: -Math.random() * 34 + 3, ph: Math.random() * 6, sp: 0.4 + Math.random() * 0.6 });
    }
    r.scene.add(petalIM);

    // arco del récord
    recordMesh = new THREE.Mesh(decoGeo('recordArch'), mats.glow);
    recordMesh.frustumCulled = false; recordMesh.castShadow = true; recordMesh.visible = false;
    r.scene.add(recordMesh);
  }

  // =====================================================================
  // Tramos de ruta
  // =====================================================================
  // Malla "fusionada" reutilizable: buffers preasignados que se reescriben al reciclar el tramo
  // (1 draw call por tramo en vez de ~20). Solo crece si un tramo necesita más vértices que nunca.
  function mergedMesh(mat) {
    const mesh = new THREE.Mesh(new THREE.BufferGeometry(), mat);
    mesh.frustumCulled = false; mesh.castShadow = true; mesh.receiveShadow = true; mesh.visible = false;
    mesh.userData.cap = 0;
    return mesh;
  }
  function ensureCap(mesh, n) {
    if (n <= mesh.userData.cap) return;
    let cap = 8192;
    while (cap < n) cap *= 2;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(cap * 3), 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('normal', new THREE.BufferAttribute(new Int8Array(cap * 3), 3, true).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(cap * 3), 3).setUsage(THREE.DynamicDrawUsage));
    // todas las geometrías vóxel son quads (4 vértices + 6 índices en el mismo orden): el índice es fijo
    const idx = new Uint32Array(cap / 4 * 6);
    for (let q = 0, v = 0; q < idx.length; q += 6, v += 4) { idx[q] = v; idx[q + 1] = v + 1; idx[q + 2] = v + 2; idx[q + 3] = v; idx[q + 4] = v + 2; idx[q + 5] = v + 3; }
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.setDrawRange(0, 0);
    mesh.geometry.dispose();
    mesh.geometry = g;
    mesh.userData.cap = cap;
  }
  function writeMerged(mesh, list) {
    let n = 0;
    for (const it of list) n += decoGeo(it.kind).attributes.position.count;
    mesh.visible = n > 0;
    if (!n) return;
    ensureCap(mesh, n);
    const g = mesh.geometry;
    const P = g.attributes.position.array, N = g.attributes.normal.array, C = g.attributes.color.array;
    let o = 0;
    for (const it of list) {
      const src = decoGeo(it.kind);
      const sp = src.attributes.position.array, sn = src.attributes.normal.array, sc = src.attributes.color.array;
      // las rotaciones son siempre múltiplos de 90° alrededor de Y
      const c = Math.round(Math.cos(it.rot)), s = Math.round(Math.sin(it.rot)), k = it.scale;
      const end = src.attributes.position.count * 3;
      for (let i = 0; i < end; i += 3, o += 3) {
        const px = sp[i], pz = sp[i + 2], nx = sn[i], nz = sn[i + 2];
        P[o] = (c * px + s * pz) * k + it.x; P[o + 1] = sp[i + 1] * k; P[o + 2] = (c * pz - s * px) * k + it.z;
        N[o] = (c * nx + s * nz) * 127; N[o + 1] = sn[i + 1] * 127; N[o + 2] = (c * nz - s * nx) * 127;
        C[o] = sc[i]; C[o + 1] = sc[i + 1]; C[o + 2] = sc[i + 2];
      }
    }
    g.setDrawRange(0, n / 4 * 6);
    for (const a of [g.attributes.position, g.attributes.normal, g.attributes.color]) { a.clearUpdateRanges(); a.addUpdateRange(0, n * 3); a.needsUpdate = true; }
  }
  function chunkExtra(ch, i) {
    if (!ch.extras[i]) {
      const pivot = new THREE.Group();
      const blade = new THREE.Mesh(decoGeo('tree0'), mats.base);
      blade.frustumCulled = false; blade.castShadow = ch.shadow;
      pivot.add(blade);
      ch.group.add(pivot);
      ch.extras[i] = { pivot, blade };
    }
    return ch.extras[i];
  }
  const decoBase = [], decoGlow = [];

  function dressChunk(ch) {
    const idx = Math.round(ch.z0 / CHUNK_LEN);
    const R = rng(idx * 7919 + 13);
    const m = ch.z0 - runStart;
    const bi = biomeIndexAt(m);
    ch.bi = bi;
    ch.ground.geometry = groundGeo(bi, ((idx % 2) + 2) % 2);
    const biome = BIOMES[bi];
    const deco = BIOME_DECO[biome.id];
    let si = 0, ei = 0;
    decoBase.length = 0; decoGlow.length = 0;
    const put = (kind, x, z, side) => {
      if (si++ >= 21) return;
      const info = DECO_INFO[kind];
      let rot = 0;
      if (info.orient === 'face') rot = side < 0 ? Math.PI / 2 : side > 0 ? -Math.PI / 2 : 0;
      else if (info.orient === 'along') rot = Math.PI / 2 + (R() < 0.5 ? Math.PI : 0);
      else if (info.orient === 'any') rot = R.int(4) * Math.PI / 2;
      const scale = info.scale || 1;
      (info.glow ? decoGlow : decoBase).push({ kind, x, z, rot, scale });
      if (info.extra) {
        const ex = chunkExtra(ch, ei++);
        ex.pivot.position.set(x, 0, z); ex.pivot.rotation.set(0, rot, 0); ex.pivot.scale.setScalar(scale); ex.pivot.visible = true;
        ex.blade.geometry = decoExtraGeo(kind);
        ex.blade.position.set(info.extra.pos[0], info.extra.pos[1], info.extra.pos[2]);
      }
    };
    for (const side of [-1, 1]) {
      const key = side < 0 ? 'L' : 'R';
      const beachSea = biome.id === 'playa' && side > 0;
      if (deco.lampChance && R() < deco.lampChance) { put('lamp', side * 2.78, -4.5, side); put('lamp', side * 2.78, -14.5, side); }
      for (const z of [-3.3, -10, -16.7]) {
        const kind = pickWeighted(deco.near[key] || deco.near.L, R);
        if (!kind) continue;
        const w = DECO_INFO[kind].w;
        const x = beachSea ? 3.05 + w * 0.4 + R() * 0.3 : 3.55 + w / 2 + R() * 0.45;
        put(kind, side * x, z + (R() - 0.5) * 2, side);
      }
      for (const z of [-5, -15]) {
        const kind = pickWeighted(deco.mid[key] || deco.mid.L, R);
        if (!kind) continue;
        const w = DECO_INFO[kind].w;
        put(kind, side * ((beachSea ? 6.5 : 5.0) + w / 2 + R() * 0.6), z + (R() - 0.5) * 1.5, side);
      }
      for (const z of [-1.5, -8.2, -14.8]) {
        const kind = pickWeighted(deco.far[key] || deco.far.L, R);
        if (!kind) continue;
        const w = DECO_INFO[kind].w * (DECO_INFO[kind].scale || 1);
        put(kind, side * (9.4 + w / 2 + R() * 5), z + (R() - 0.5) * 2.5, side);
      }
    }
    if (m > 30 && R() < deco.overChance) put(pickWeighted(deco.over, R), 0, -10, 0);
    for (; ei < ch.extras.length; ei++) ch.extras[ei].pivot.visible = false;
    writeMerged(ch.base, decoBase);
    writeMerged(ch.glow, decoGlow);
  }

  function resetChunks() {
    chunks.forEach((ch, i) => { ch.z0 = Math.floor(p / CHUNK_LEN) * CHUNK_LEN + (i - 1) * CHUNK_LEN; dressChunk(ch); });
  }

  function updateChunks(dt) {
    let maxZ = -Infinity;
    for (const ch of chunks) maxZ = Math.max(maxZ, ch.z0);
    for (const ch of chunks) {
      if (ch.z0 + CHUNK_LEN < p - 7) { ch.z0 = maxZ + CHUNK_LEN; maxZ = ch.z0; dressChunk(ch); }
      ch.group.position.z = p - ch.z0;
      ch.group.visible = ch.z0 - p < 104;
      const near = ch.z0 - p < 24;
      if (near !== ch.shadow) { ch.shadow = near; ch.base.castShadow = near; ch.glow.castShadow = near; for (const e of ch.extras) e.blade.castShadow = near; }
      for (const e of ch.extras) if (e.pivot.visible) e.blade.rotation.z += dt * 1.3;
    }
  }

  // =====================================================================
  // Generación de obstáculos y premios
  // =====================================================================
  function speedTarget(m) {
    const t = Math.min(1, Math.max(0, m) / 2800);
    return vBase + (vMax - vBase) * Math.pow(t, 0.8);
  }
  function acquire(list, kind) { return list.find(e => !e.active && (!kind || e.kind === kind)) || null; }
  function deactivate(e) { e.active = false; if (e.mesh) e.mesh.visible = false; e.fly = false; }
  function deactivateCoin(i) { const c = coinList[i]; c.active = false; coinIM.setMatrixAt(i, ZERO); }

  function clearCollectibles(ln, z0, z1) {
    coinList.forEach((c, i) => { if (c.active && c.lane === ln && c.z >= z0 && c.z <= z1) deactivateCoin(i); });
    for (const it of items) if (it.active && it.lane === ln && it.z >= z0 && it.z <= z1) deactivate(it);
  }
  function spawnCoin(x, z, ln, y = 0.48) {
    const i = coinList.findIndex(c => !c.active);
    if (i < 0) return;
    Object.assign(coinList[i], { active: true, x, z, lane: ln, magnet: false, y });
  }
  function coinLine(ln, z, n, spacing = 1.7) { for (let i = 0; i < n; i++) spawnCoin(LANES[ln], z + i * spacing, ln); }
  function coinWave(z, n) {
    const start = Math.floor(Math.random() * 3);
    const dir = start === 2 ? -1 : start === 0 ? 1 : (Math.random() < 0.5 ? -1 : 1);
    for (let i = 0; i < n; i++) {
      const t = i / Math.max(1, n - 1);
      const x = LANES[start] + dir * LANE_W * (1 - Math.cos(t * Math.PI)) * (start === 1 ? 0.5 : 1);
      const ln = clamp(Math.round(x / LANE_W) + 1, 0, 2);
      spawnCoin(x, z + i * 1.6, ln, 0.48 + Math.sin(t * Math.PI) * 0.5);
    }
  }
  function spawnObstacle(kind, ln, z) {
    const e = acquire(obstacles, kind);
    if (!e) return false;
    Object.assign(e, { active: true, lane: ln, x: LANES[ln] + (kind === 'puddle' ? (Math.random() - 0.5) * 0.2 : 0), z, y: 0, fly: false, hit: false });
    e.mesh.visible = true;
    e.mesh.rotation.set(0, kind === 'cones' ? (Math.random() < 0.5 ? 0 : Math.PI) : 0, 0);
    lastStatic[ln] = Math.max(lastStatic[ln], z + e.l / 2);
    clearCollectibles(ln, z - e.l / 2 - 1, z + e.l / 2 + 1);
    return true;
  }
  function trafficStart(meet) { return meet - 0.3 * (meet - p); }
  function spawnTraffic(ln, meet) {
    const e = acquire(obstacles, 'car');
    if (!e) return false;
    const k = 0.2 + Math.random() * 0.1;
    Object.assign(e, { active: true, lane: ln, x: LANES[ln], meet, k, y: 0, fly: false, hit: false });
    e.z = meet - k * (meet - p);
    e.mesh.visible = true;
    e.mesh.rotation.set(0, 0, 0);
    clearCollectibles(ln, e.z - 2, meet + 1.5);
    return true;
  }
  function spawnItem(kind, ln, z) {
    const e = acquire(items, kind);
    if (!e) return false;
    Object.assign(e, { active: true, lane: ln, x: LANES[ln], z });
    e.mesh.visible = true;
    return true;
  }
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  function pickPower(m) {
    if (m - lastGemM > 160 && Math.random() < 0.07) { lastGemM = m; return 'gem'; }
    if (m - lastPowerM < 120 || Math.random() > 0.16) return null;
    lastPowerM = m;
    return pickWeighted([['turbo', 3], ['magnet', 3], ['shield', 2.4], ['heart', lives < MAX_LIVES ? 3.2 : 0.4]], Math.random);
  }

  function genRow(z) {
    const m = z - runStart;
    const d = clamp(m / 2600, 0, 1);
    const gap = Math.max(12, speedTarget(m) * lerp(1.7, 0.98, d));
    if (m < 70) { coinLine(1, z, 5); return gap; }
    const R = Math.random;
    // tramo de respiro: ola de monedas
    if (R() < 0.12) {
      coinWave(z + 1, Math.min(10, Math.floor((gap - 3) / 1.6)));
      return gap;
    }
    const nBlock = R() < 0.2 + 0.45 * d ? 2 : 1;
    const order = shuffle([0, 1, 2]);
    const blocked = order.slice(0, nBlock), free = order.slice(nBlock);
    for (const ln of blocked) {
      const canCar = m > 130 && lastStatic[ln] < trafficStart(z) - 2 && R() < 0.42 + 0.18 * d;
      if (!(canCar && spawnTraffic(ln, z))) spawnObstacle(R() < 0.5 ? 'barrier' : 'cones', ln, z);
    }
    if (m > 220 && free.length >= 2 && R() < 0.28) {
      const pl = free.splice(Math.floor(R() * free.length), 1)[0];
      spawnObstacle('puddle', pl, z + (R() - 0.5) * 3);
    }
    const cl = free[Math.floor(R() * free.length)];
    const pw = pickPower(m);
    let cz = z + 3;
    if (pw) { spawnItem(pw, cl, z + 1.5); cz = z + 4.5; }
    if (R() < 0.6) coinLine(cl, cz, Math.max(2, Math.min(6, Math.floor((z + gap - 2.5 - cz) / 1.7))));
    return gap;
  }

  function runSpawner() {
    while (nextRowZ < p + SPAWN_AHEAD) nextRowZ += genRow(nextRowZ);
  }

  // =====================================================================
  // Partículas
  // =====================================================================
  function emit(x, y, z, vx, vy, vz, color, life, s = 1, g = 9, world = true) {
    const i = partCursor; partCursor = (partCursor + 1) % PARTICLES;
    Object.assign(parts[i], { life, max: life, x, y, z, vx, vy, vz, g, s, world });
    partIM.setColorAt(i, tmpColor.set(color));
    partIM.instanceColor.needsUpdate = true;
  }
  function burst(x, y, z, colors, n = 8, speed = 3, life = 0.6, s = 1) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      emit(x, y, z, Math.cos(a) * speed * (0.4 + Math.random() * 0.6), 1.5 + Math.random() * speed, Math.sin(a) * speed * 0.6, colors[i % colors.length], life * (0.7 + Math.random() * 0.5), s);
    }
  }
  function updateParticles(dt) {
    for (let i = 0; i < PARTICLES; i++) {
      const q = parts[i];
      if (q.life <= 0) continue;
      q.life -= dt;
      if (q.life <= 0) { partIM.setMatrixAt(i, ZERO); continue; }
      q.vy -= q.g * dt;
      q.x += q.vx * dt; q.y = Math.max(0.05, q.y + q.vy * dt); q.z += (q.vz + (q.world ? v : 0)) * dt;
      dummy.position.set(q.x, q.y, q.z);
      dummy.rotation.set(q.life * 7, q.life * 5, 0);
      dummy.scale.setScalar(q.s * (0.35 + 0.65 * (q.life / q.max)));
      dummy.updateMatrix();
      partIM.setMatrixAt(i, dummy.matrix);
    }
    partIM.instanceMatrix.needsUpdate = true;
  }
  function updatePetals(dt, biomeId, tBlend) {
    const on = biomeId === 'cerezos' || biomeId === 'flores';
    const cols = biomeId === 'flores' ? [0xffffff, 0xffe9a8, 0xffc2dc] : [0xffb3d4, 0xff9ccb, 0xffe0ef];
    for (let i = 0; i < PETALS; i++) {
      const q = petals[i];
      if (!on || (i / PETALS) > tBlend) { petalIM.setMatrixAt(i, ZERO); continue; }
      q.ph += dt * (1.5 + q.sp);
      q.y -= dt * (biomeId === 'flores' ? -0.1 : 0.7) * q.sp;
      q.z += v * dt + dt * 0.6;
      q.x += Math.sin(q.ph) * dt * 0.8;
      if (q.z > 4 || q.y < 0 || q.y > 7) { q.z = -30 - Math.random() * 6; q.y = 1 + Math.random() * 5; q.x = (Math.random() - 0.5) * 16; }
      dummy.position.set(q.x, q.y + (biomeId === 'flores' ? Math.sin(q.ph * 2) * 0.3 : 0), q.z);
      dummy.rotation.set(q.ph, q.ph * 0.7, 0);
      dummy.scale.set(biomeId === 'flores' ? 0.9 : 0.8, 0.25, biomeId === 'flores' ? 0.6 : 0.8);
      dummy.updateMatrix();
      petalIM.setMatrixAt(i, dummy.matrix);
      if (q.c !== cols[i % 3]) { q.c = cols[i % 3]; petalIM.setColorAt(i, tmpColor.set(q.c)); petalIM.instanceColor.needsUpdate = true; }
    }
    petalIM.instanceMatrix.needsUpdate = true;
  }

  // =====================================================================
  // Acciones del jugador
  // =====================================================================
  function steerTo(dir) {
    if (phase !== 'run' || paused || resumeT > 0) return;
    // patinando no se puede doblar, pero el toque no se pierde: se aplica apenas termina
    if (skidT > 0) { queuedDir = dir; return; }
    const nl = lane + dir;
    if (nl < 0 || nl > 2) { wobbleT = 0.25; return; }
    lane = nl;
    audio.sfx('swoosh');
  }
  function useTurbo() {
    if (phase !== 'run' || paused || resumeT > 0) return;
    if (turboT > 0) return;
    if (charge < 1) { audio.sfx('error'); el.turboBtn.classList.remove('nope'); void el.turboBtn.offsetWidth; el.turboBtn.classList.add('nope'); return; }
    charge -= 1; turboT = TURBO_TIME;
    audio.sfx('swoosh'); audio.sfx('horn');
    updateTurboUI(true);
  }

  // =====================================================================
  // Choques y premios
  // =====================================================================
  function screenOf(x, y, z) { tmpV.set(x, y, z); return r.toScreen(tmpV); }
  function knock(e, strong) {
    e.fly = true; e.flyT = 0;
    const side = Math.sign(e.x - carX) || (Math.random() < 0.5 ? -1 : 1);
    e.vx = side * (strong ? 5 : 3) + (Math.random() - 0.5);
    e.vy = strong ? 6 : 4.5;
    e.vz = strong ? 9 : 5;
    e.spin = (Math.random() < 0.5 ? -1 : 1) * (5 + Math.random() * 4);
  }
  function hitObstacle(e) {
    if (e.kind === 'puddle') {
      if (e.hit) return;
      e.hit = true;
      if (turboT > 0) return;
      skidT = 0.7;
      audio.sfx('bump');
      for (let i = 0; i < 8; i++) emit(carX + (Math.random() - 0.5) * 0.6, 0.15, 0.2, (Math.random() - 0.5) * 3, 2 + Math.random() * 2, Math.random() * 2, i % 2 ? 0xa9dcff : 0xffffff, 0.5);
      const s = screenOf(carX, 1.2, 0);
      ui.floatText(s.x, s.y, '¡Patinaste!');
      return;
    }
    if (turboT > 0) {
      knock(e, true); audio.sfx('pop'); shake = 0.25;
      burst(e.x, 0.5, p - e.z, [0xffd166, 0xff7eb6, 0xffffff], 10, 4, 0.6);
      return;
    }
    if (invulnT > 0) { knock(e, false); return; }
    if (shield) {
      shield = false; shieldMesh.visible = false;
      knock(e, true); invulnT = 1.0; shake = 0.35;
      audio.sfx('pop');
      burst(carX, 0.6, 0, [0x9ff5dc, 0xffffff, 0x6fe3c1], 14, 4, 0.7);
      const s = screenOf(carX, 1.3, 0);
      ui.floatText(s.x, s.y, `${icon('🛡️', 22)} ¡Te salvó el escudo!`);
      renderPowers();
      return;
    }
    // choque de verdad
    lives--;
    knock(e, false);
    audio.sfx('crash');
    shake = 0.7; invulnT = INVULN_TIME; v *= 0.55;
    el.flash.classList.add('on'); setTimeout(() => el.flash?.classList.remove('on'), 120);
    burst(carX, 0.5, -0.4, [0xffffff, 0xffd166, 0xff7eb6, 0xb58cff], 16, 4.5, 0.7);
    renderLives(true);
    if (lives <= 0) startCrash();
    else { const s = screenOf(carX, 1.3, 0); ui.floatText(s.x, s.y, `-1 ${icon('heart', 22)}`); }
  }

  function collectItem(it) {
    deactivate(it);
    const s = screenOf(it.x, 0.9, p - it.z);
    switch (it.kind) {
      case 'gem':
        gems++; audio.sfx('gem');
        burst(it.x, 0.6, 0, [0x8fd3ff, 0xd4efff, 0xb58cff, 0xffffff], 14, 3.5, 0.8);
        ui.floatText(s.x, s.y, `+1 ${icon('gem', 22)}`);
        renderCounters();
        break;
      case 'heart':
        if (lives < MAX_LIVES) { lives++; renderLives(true); ui.floatText(s.x, s.y, `+1 ${icon('heart', 22)}`); }
        else { coins += 5; renderCounters(); ui.floatText(s.x, s.y, `+5 ${icon('coin', 22)}`); }
        audio.sfx('star');
        burst(it.x, 0.6, 0, [0xff7eb6, 0xffc2dc, 0xffffff], 12, 3, 0.7);
        break;
      case 'magnet':
        magnetT = MAGNET_TIME; audio.sfx('star');
        ui.floatText(s.x, s.y, `${icon('🧲', 22)} ¡Imán!`);
        burst(it.x, 0.6, 0, [0xff5a7e, 0xffffff], 10, 3, 0.6);
        renderPowers();
        break;
      case 'shield':
        shield = true; shieldMesh.visible = true; audio.sfx('star');
        ui.floatText(s.x, s.y, `${icon('🛡️', 22)} ¡Escudo!`);
        burst(it.x, 0.6, 0, [0x6fe3c1, 0xffffff], 10, 3, 0.6);
        renderPowers();
        break;
      case 'turbo':
        charge = 3; audio.sfx('star');
        ui.floatText(s.x, s.y, `${icon('bolt', 22)} ¡Turbo lleno!`);
        burst(it.x, 0.6, 0, [0xffd166, 0xffb347, 0xffffff], 12, 3, 0.6);
        updateTurboUI(true);
        break;
    }
  }

  function collectCoin(i) {
    const c = coinList[i];
    deactivateCoin(i);
    coins++;
    charge = Math.min(3, charge + COIN_CHARGE);
    if (coinSfxT <= 0) { audio.sfx('coin'); coinSfxT = 0.05; }
    emit(c.x, c.y + 0.1, p - c.z, (Math.random() - 0.5) * 2, 2.5, 0.5, 0xffd166, 0.35, 0.9);
    emit(c.x, c.y + 0.1, p - c.z, (Math.random() - 0.5) * 2, 3, 0.5, 0xfff0c2, 0.35, 0.7);
    renderCounters(true);
  }

  // =====================================================================
  // Bucle principal
  // =====================================================================
  function update(dt) {
    time += dt;
    const running = phase === 'run';
    const m = p - runStart;

    // --- velocidad
    let target = 0;
    if (phase === 'intro') target = 5;
    else if (phase === 'countdown') target = 0;
    else if (running) {
      target = speedTarget(m);
      if (turboT > 0) target *= 1.6;
      if (skidT > 0) target *= 0.72;
    }
    const acc = v < target ? (turboT > 0 ? 34 : phase === 'run' ? 8 : 4) : (phase === 'crash' ? 9 : 12);
    v = v < target ? Math.min(target, v + acc * dt) : Math.max(target, v - acc * dt);
    p += v * dt;

    // --- timers
    if (turboT > 0) { turboT -= dt; if (turboT <= 0) { turboT = 0; updateTurboUI(true); } }
    if (magnetT > 0) { magnetT -= dt; if (magnetT <= 0) { magnetT = 0; renderPowers(); } }
    if (invulnT > 0) invulnT = Math.max(0, invulnT - dt);
    if (skidT > 0) { skidT = Math.max(0, skidT - dt); if (skidT === 0 && queuedDir) { const d = queuedDir; queuedDir = 0; steerTo(d); } }
    if (wobbleT > 0) wobbleT = Math.max(0, wobbleT - dt);
    if (coinSfxT > 0) coinSfxT -= dt;
    shake = Math.max(0, shake - dt * 1.6);

    // --- cuenta regresiva
    if (phase === 'countdown') {
      cd += dt;
      const step = Math.floor(cd / 0.8);
      if (step !== cdShown && step <= 3) {
        cdShown = step;
        showCount(step < 3 ? String(3 - step) : '¡Ya!', step === 3);
        audio.sfx(step < 3 ? 'select' : 'horn');
        if (step === 3) { phase = 'run'; hintT = 3.2; el.hint.classList.add('show'); }
      }
    }
    if (hintT > 0) { hintT -= dt; if (hintT <= 0) el.hint.classList.remove('show'); }

    // --- carril / dirección
    const tx = LANES[lane];
    carX += (tx - carX) * (1 - Math.exp(-dt * laneRate));
    steer = clamp((tx - carX) / LANE_W, -1, 1);
    rig.position.x = carX;
    let yaw = -steer * 0.3, roll = steer * 0.08;
    if (skidT > 0) yaw += (1 - skidT / 0.7) * Math.PI * 2;
    if (wobbleT > 0) yaw += Math.sin(wobbleT * 40) * 0.08;
    if (phase === 'crash') { crashT += dt; yaw += Math.min(1, crashT) * Math.PI * 3; }
    carHolder.rotation.set(0, Math.PI + yaw, 0);
    rig.rotation.z = roll;
    rig.position.y = turboT > 0 ? Math.abs(Math.sin(time * 30)) * 0.03 : 0;
    carObj.userData.update?.(dt, v, steer);
    rig.visible = !(invulnT > 0 && phase === 'run' && Math.floor(invulnT * 10) % 2 === 0);
    if (shield) { shieldMesh.rotation.y += dt * 1.5; shieldMesh.material.opacity = 0.3 + Math.sin(time * 6) * 0.08; }

    // escape / chispas
    exhaustT -= dt;
    if (exhaustT <= 0 && v > 0.5) {
      exhaustT = turboT > 0 ? 0.02 : 0.14;
      if (turboT > 0) {
        emit(carX + (Math.random() - 0.5) * 0.3, 0.25, 0.6, (Math.random() - 0.5), 0.5, 2, Math.random() < 0.5 ? 0xffd166 : 0xff7eb6, 0.35, 1.3, -1, false);
      } else emit(carX + 0.18, 0.18, 0.55, 0, 0.6, 1.2, 0xffffff, 0.5, 0.9, -0.6, false);
    }

    updateChunks(dt);
    if (running) runSpawner();

    // --- obstáculos
    const pw = carSize.w / 2 * 0.82, pl = carSize.l / 2 * 0.8;
    for (const e of obstacles) {
      if (!e.active) continue;
      if (e.kind === 'car' && !e.fly) {
        e.z = e.meet - e.k * (e.meet - p);
        e.car.userData.update?.(dt, v * e.k, 0);
      }
      if (e.fly) {
        e.flyT += dt;
        e.x += e.vx * dt; e.y += e.vy * dt; e.vy -= 16 * dt; e.z += e.vz * dt;
        if (e.y < 0) { e.y = 0; e.vy = Math.abs(e.vy) * 0.35; e.vx *= 0.6; }
        e.mesh.rotation.y += e.spin * dt * 0.4; e.mesh.rotation.z += e.spin * dt * 0.15;
        if (e.flyT > 1.3) { deactivate(e); continue; }
      }
      const dz = e.z - p;
      if (dz < -8) { deactivate(e); continue; }
      e.mesh.position.set(e.x, e.y, -dz);
      if (!e.fly && (phase === 'run') && Math.abs(dz) < (e.l / 2 + pl) && Math.abs(e.x - carX) < (e.w / 2 + pw)) hitObstacle(e);
    }

    // --- poderes
    for (const it of items) {
      if (!it.active) continue;
      const dz = it.z - p;
      if (dz < -4) { deactivate(it); continue; }
      it.mesh.position.set(it.x, 0.62 + Math.sin(time * 3 + it.z) * 0.08, -dz);
      it.mesh.rotation.y = time * 2.4;
      if (phase === 'run' && Math.abs(dz) < 0.9 && Math.abs(it.x - carX) < 0.85) collectItem(it);
    }

    // --- monedas
    const magnetOn = magnetT > 0 && phase === 'run';
    for (let i = 0; i < COIN_POOL; i++) {
      const c = coinList[i];
      if (!c.active) continue;
      let dz = c.z - p;
      if (magnetOn && !c.magnet && dz < 13 && dz > -1) c.magnet = true;
      if (c.magnet) {
        const f = 1 - Math.exp(-dt * 9);
        c.z += (p - c.z) * f; c.x += (carX - c.x) * f; c.y += (0.5 - c.y) * f;
        dz = c.z - p;
      }
      // las que quedaron atrás se achican y desaparecen (si no, pasan gigantes y borrosas junto a la cámara)
      const cs = dz < -0.75 ? 1 + (dz + 0.75) / 1.2 : 1;
      if (cs <= 0.05) { deactivateCoin(i); continue; }
      if (phase === 'run' && Math.abs(dz) < 0.75 && Math.abs(c.x - carX) < 0.72) { collectCoin(i); continue; }
      dummy.position.set(c.x, c.y + Math.sin(time * 4 + c.ph) * 0.05, -dz);
      dummy.rotation.set(0, time * 3.2 + c.ph, 0);
      dummy.scale.setScalar(cs);
      dummy.updateMatrix();
      coinIM.setMatrixAt(i, dummy.matrix);
    }
    coinIM.instanceMatrix.needsUpdate = true;

    // --- arco del récord
    if (bestAtStart > 60 && phase !== 'intro') {
      const dz = runStart + bestAtStart - p;
      recordMesh.visible = dz > -6 && dz < 120;
      recordMesh.position.set(0, 0, -dz);
      if (!recordPassed && dz < 0 && phase === 'run') {
        recordPassed = true;
        audio.sfx('levelup'); ui.confetti(50);
        showBanner(`${icon('trophy', 30)} ¡Nuevo récord!`, 'gold');
      }
    } else recordMesh.visible = false;

    // --- crash final
    if (phase === 'crash' && crashT > 1.5) finishRun();

    // --- biomas, cielo, luces
    const mm = Math.max(0, m);
    const bA = biomeIndexAt(mm);
    const nb = (Math.floor(mm / BIOME_LEN) + 1) * BIOME_LEN;
    const tB = smooth((mm - (nb - 90)) / 90);
    const bB = biomeIndexAt(nb);
    if (phase === 'run' && bA !== lastBiome) {
      lastBiome = bA;
      const b = BIOMES[bA];
      showBanner(`${icon(b.icon, 30)} ${b.name}`);
      audio.sfx('done');
    }
    applyBiomeColors(bA, bB, tB);
    updatePetals(dt, tB > 0.5 ? BIOMES[bB].id : BIOMES[bA].id, tB > 0.5 ? (tB - 0.5) * 2 : 1 - tB * 2);
    updateParticles(dt);

    // --- curva del mundo
    const curve = phase === 'intro' ? 0.4 : 1;
    bendU.value.set(0.0017 * Math.sin(p / 160) * curve, 0.00115);

    updateCamera(dt);
    drawSky(bA, bB, tB, dt);
    renderRunUI();
  }

  function applyBiomeColors(a, b, t) {
    const A = BIOMES[a], B = BIOMES[b];
    fogColor.set(A.fog).lerp(colB.set(B.fog), t);
    r.scene.fog.color.copy(fogColor);
    hemiSky.set(A.hemiSky).lerp(colB.set(B.hemiSky), t);
    hemiGround.set(A.hemiGround).lerp(colB.set(B.hemiGround), t);
    lights.hemi.color.copy(hemiSky); lights.hemi.groundColor.copy(hemiGround);
    mats.outerL.color.set(A.outerL).lerp(colA.set(B.outerL), t);
    mats.outerR.color.set(A.outerR).lerp(colA.set(B.outerR), t);
  }

  // cámara
  function updateCamera(dt) {
    const w = root.clientWidth || innerWidth, h = root.clientHeight || innerHeight;
    const aspect = w / h;
    const portrait = aspect < 0.8;
    // persecución
    const shx = shake > 0 ? (Math.random() - 0.5) * shake * 0.5 : 0, shy = shake > 0 ? (Math.random() - 0.5) * shake * 0.35 : 0;
    camPos.set(carX * 0.6 + shx, (portrait ? 3.5 : 2.95) + shy, portrait ? 4.6 : 4.3);
    camTarget.set(carX * 0.8, portrait ? -0.5 : 0.3, portrait ? -8 : -7.5);
    // intro: vista de costado-frente que gira despacio
    // la transición gira alrededor del auto mientras sube hasta quedar detrás
    const k = smooth(camBlend);
    const a = (2.25 + Math.sin(time * 0.35) * 0.35) * (1 - k);
    const rad = lerp(portrait ? 3.6 : 3.3, camPos.z, k);
    camPos2.set(carX + Math.sin(a) * rad, lerp(1.35, camPos.y, k), Math.cos(a) * rad);
    camTarget2.set(carX, 0.42, 0);
    const cam = r.camera;
    cam.position.copy(camPos2).lerp(camPos, k * k);
    tmpV.copy(camTarget2).lerp(camTarget, k);
    const roll = (-steer * 0.035 + bendU.value.x * 10) * k;
    cam.up.set(Math.sin(roll), Math.cos(roll), 0);
    cam.lookAt(tmpV);
    let fov = portrait ? 64 : aspect < 1.25 ? 58 : 50;
    fov += (turboT > 0 ? 9 : 0) * k;
    if (Math.abs(cam.fov - fov) > 0.05) { cam.fov += (fov - cam.fov) * Math.min(1, dt * 6); cam.updateProjectionMatrix(); }
    // encuadre del menú: el auto queda arriba (celu) o a la izquierda (PC)
    const off = 1 - k;
    if (off > 0.001) {
      const ox = portrait ? 0 : 0.17 * w * off, oy = portrait ? 0.25 * h * off : -0.02 * h * off;
      cam.setViewOffset(w, h, ox, oy, w, h);
    } else if (cam.view && cam.view.enabled) cam.clearViewOffset();
    if (phase === 'countdown' || phase === 'run') camBlend = Math.min(1, camBlend + dt / 1.5);
    // sol que sigue al auto
    lights.sun.position.set(carX + 6, 15, -9);
    lights.sun.target.position.set(carX, 0, -5);
  }

  function drawSky(a, b, t, dt) {
    lastSky[0] = a; lastSky[1] = b; lastSky[2] = t;
    const w = root.clientWidth || innerWidth, h = root.clientHeight || innerHeight;
    sky.resize(w, h, r.pixelSize);
    // horizonte: proyección de un punto lejano del piso con la misma curva que el shader
    const cam = r.camera;
    cam.updateMatrixWorld();
    tmpV.set(cam.position.x, 0, cam.position.z - 92).applyMatrix4(cam.matrixWorldInverse);
    const bz = Math.min(tmpV.z, 0);
    tmpV.x += bendU.value.x * bz * bz; tmpV.y -= bendU.value.y * bz * bz;
    tmpV.applyMatrix4(cam.projectionMatrix);
    const hy = (1 - tmpV.y) / 2;
    sky.draw(a, b, t, hy, tmpV.x * sky.W / 2, time, dt);
  }

  // =====================================================================
  // UI
  // =====================================================================
  const shown = { m: -1, coins: -1, gems: -1, lives: -1, charge: -1, turbo: null, mag: -1 };
  function renderLives(pop) {
    el.lives.innerHTML = Array.from({ length: MAX_LIVES }, (_, i) => icon('heart', 20, i < lives ? (pop && i === lives - 1 ? 'pop' : '') : 'off')).join('');
    shown.lives = lives;
  }
  function renderCounters(bump) {
    if (shown.coins !== coins) { el.coins.textContent = coins; shown.coins = coins; if (bump) { el.coinsStat.classList.remove('bump'); void el.coinsStat.offsetWidth; el.coinsStat.classList.add('bump'); } }
  }
  function renderPowers() {
    let html = '';
    if (magnetT > 0) html += `<div class="drv-power">${icon('🧲', 20)}<div class="progress pink"><i data-mag style="width:${(magnetT / MAGNET_TIME * 100).toFixed(1)}%"></i></div></div>`;
    if (shield) html += `<div class="drv-power mint">${icon('🛡️', 20)} Escudo</div>`;
    el.powers.innerHTML = html;
    el.magBar = el.powers.querySelector('[data-mag]');
  }
  function updateTurboUI(force) {
    const c = Math.round(charge * 20) / 20;
    const st = turboT > 0 ? 'on' : charge >= 1 ? 'ready' : '';
    if (!force && c === shown.charge && st === shown.turbo) return;
    shown.charge = c; shown.turbo = st;
    el.turboBtn.className = st;
    el.segs.forEach((s, i) => { s.style.width = (clamp(charge - i, 0, 1) * 100).toFixed(0) + '%'; });
    el.speed.classList.toggle('on', turboT > 0);
  }
  function renderRunUI() {
    if (phase === 'intro' || phase === 'ended') return;   // al terminar, el HUD queda con lo que se acreditó
    const m = Math.max(0, Math.floor(p - runStart));
    if (m !== shown.m) { el.dist.textContent = m.toLocaleString('es-AR') + ' m'; shown.m = m; }
    if (shown.lives !== lives) renderLives();
    renderCounters();
    updateTurboUI(false);
    if (el.magBar && magnetT > 0) el.magBar.style.width = (magnetT / MAGNET_TIME * 100).toFixed(1) + '%';
  }
  let bannerTimer = 0;
  function showBanner(html, cls = '') {
    el.banner.className = 'drv-banner ' + cls;
    el.banner.innerHTML = html;
    void el.banner.offsetWidth;
    el.banner.classList.add('show');
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => el.banner?.classList.remove('show'), 2500);
  }
  function showCount(text, go) {
    el.count.className = 'drv-count' + (go ? ' go' : '');
    el.count.textContent = text;
    void el.count.offsetWidth;
    el.count.classList.add('show');
  }

  function buildDOM(container) {
    const best = ctx.state.games.driving?.best || 0;
    container.innerHTML = `
      <div class="drv-stage"></div>
      <div class="drv-fx drv-speed"></div>
      <div class="drv-fx drv-flash"></div>
      <div class="game-bar dim">
        <button class="icon-btn" data-act="back" aria-label="Volver">${icon('back', 22)}</button>
        <div class="game-title drv-title">Paseo Real</div>
        <div class="game-stat drv-lives drv-runstat"><small>Vidas</small><b></b></div>
        <div class="spacer"></div>
        <div class="game-stat drv-runstat"><small>Distancia</small><b data-v="dist">0 m</b></div>
        <div class="game-stat drv-runstat" data-v="coinsStat"><small>Monedas</small><b>${icon('coin', 18)}<span data-v="coins">0</span></b></div>
        <button class="icon-btn drv-runstat" data-act="pause" aria-label="Pausa">${icon('pause', 22)}</button>
      </div>
      <div class="drv-powers"></div>
      <div class="drv-banner"></div>
      <div class="drv-count"></div>
      <div class="drv-hint">
        <span class="drv-only-touch">${icon('👈', 20)} Tocá</span><span class="drv-only-touch">Tocá ${icon('👉', 20)}</span>
        <span class="drv-only-kb"><kbd>←</kbd> <kbd>A</kbd></span><span class="drv-only-kb"><kbd>D</kbd> <kbd>→</kbd></span>
      </div>
      <div class="drv-turbo hide"><button aria-label="Turbo">${icon('bolt', 26)}<span>Turbo</span><span class="drv-segs"><i><u></u></i><i><u></u></i><i><u></u></i></span><kbd class="drv-only-kb">Espacio</kbd></button></div>
      <div class="drv-intro">
        <div class="drv-card">
          <div class="drv-logo">${icon('car', 44)}<span>Paseo Real</span></div>
          <p class="drv-sub">Salí a pasear por Pixelia: esquivá el tránsito, juntá monedas y llegá lo más lejos que puedas.</p>
          <div class="drv-rec"><span class="chip gold">${icon('trophy', 18)} ${best ? `Récord: <b>${best.toLocaleString('es-AR')} m</b>` : '¡Primer paseo!'}</span><span class="chip lilac">${icon('star', 18)} 400 · 1000 · 2000 m</span></div>
          <div class="drv-ctrls">
            <div class="drv-ctrl drv-only-touch"><div class="drv-ill"><div class="drv-phone"><i>${icon('👈', 18)}</i><i>${icon('👉', 18)}</i></div></div>Tocá un costado o deslizá<small>para cambiar de carril</small></div>
            <div class="drv-ctrl drv-only-touch"><div class="drv-ill"><div class="drv-phone up"><i class="drv-swipe">${icon('👆', 20)}</i></div>${icon('bolt', 26)}</div>Deslizá hacia arriba<small>o tocá el botón Turbo</small></div>
            <div class="drv-ctrl drv-only-kb"><div class="drv-ill"><span class="drv-key">←</span><span class="drv-key">→</span><span class="drv-key">A</span><span class="drv-key">D</span></div>Cambiar de carril<small>flechas o A / D</small></div>
            <div class="drv-ctrl drv-only-kb"><div class="drv-ill"><span class="drv-key wide">Espacio</span>${icon('bolt', 26)}</div>Turbo<small>Esc para pausar</small></div>
          </div>
          <div class="drv-legend">
            <span>${icon('coin', 20)} Monedas</span><span>${icon('gem', 20)} Gemas</span><span>${icon('heart', 20)} +1 vida</span>
            <span>${icon('🧲', 20)} Imán</span><span>${icon('🛡️', 20)} Escudo</span><span>${icon('bolt', 20)} Turbo</span>
            <span class="bad">${icon('🚗', 20)} Tránsito</span><span class="bad">${icon('🚧', 20)} Conos</span><span class="bad">${icon('💧', 20)} Charcos</span>
          </div>
          <button class="btn pink block drv-go" data-act="go">${icon('🏁', 26)}¡Arrancar!</button>
        </div>
      </div>`;
    const q = (s) => container.querySelector(s);
    stage = q('.drv-stage');
    Object.assign(el, {
      bar: q('.game-bar'), lives: q('.drv-lives b'), dist: q('[data-v="dist"]'), coins: q('[data-v="coins"]'), coinsStat: q('[data-v="coinsStat"]'),
      powers: q('.drv-powers'), banner: q('.drv-banner'), count: q('.drv-count'), hint: q('.drv-hint'), turbo: q('.drv-turbo'), turboBtn: q('.drv-turbo button'),
      segs: [...container.querySelectorAll('.drv-segs u')], intro: q('.drv-intro'), flash: q('.drv-flash'), speed: q('.drv-speed'),
    });
    renderLives();
  }

  // =====================================================================
  // Flujo de partida
  // =====================================================================
  function resetRun() {
    for (const e of obstacles) deactivate(e);
    for (const it of items) deactivate(it);
    for (let i = 0; i < COIN_POOL; i++) deactivateCoin(i);
    p = 0; runStart = -debugStart; v = 0;
    lane = 1; carX = 0; steer = 0;
    lives = MAX_LIVES; coins = 0; gems = 0; charge = 1; turboT = 0; magnetT = 0; shield = false; invulnT = 0; skidT = 0; crashT = 0; shake = 0;
    resumeT = 0; queuedDir = 0; wobbleT = 0;
    shieldMesh.visible = false;
    nextRowZ = 26; lastPowerM = 0; lastGemM = 0; lastStatic = [-1e9, -1e9, -1e9];
    lastBiome = -1; recordPassed = false;
    bestAtStart = ctx.state.games.driving?.best || 0;
    resetChunks();
    renderLives(); renderPowers(); updateTurboUI(true);
    shown.m = -1;
  }

  function startRun() {
    if (unmounted || !(phase === 'intro' || phase === 'ended')) return;
    stage.classList.add('fade');
    resetRun();
    requestAnimationFrame(() => stage?.classList.remove('fade'));
    phase = 'countdown'; cd = 0; cdShown = -1;
    el.intro.classList.add('hide');
    el.bar.classList.remove('dim');
    el.turbo.classList.remove('hide');
    audio.sfx('tap');
  }

  function startCrash() {
    phase = 'crash'; crashT = 0;
    el.turbo.classList.add('hide');
    el.hint.classList.remove('show');
    showBanner('¡Ay, chocaste!<small>Fin del paseo</small>');
  }

  async function finishRun() {
    if (phase === 'ended') return;
    phase = 'ended';
    turboT = 0; updateTurboUI(true);
    el.turbo.classList.add('hide');
    el.hint.classList.remove('show');
    const meters = Math.max(0, Math.floor(p - runStart));
    const st = ctx.state;
    if (meters > 0) store.inc('drivingMeters', meters);
    const prevBest = st.games.driving?.best || 0;
    const newBest = meters > prevBest && meters > 0;
    if (newBest) { st.games.driving.best = meters; store.markDirty(); }
    const stars = meters >= 2000 ? 3 : meters >= 1000 ? 2 : meters >= 400 ? 1 : 0;
    const lines = [];
    if (coins) lines.push(`${icon('coin', 20)} Juntaste <b>${coins}</b> ${coins === 1 ? 'moneda' : 'monedas'} en el camino`);
    if (gems) lines.push(`${icon('gem', 20)} ${coins ? '¡Y' : '¡Encontraste'} <b>${gems}</b> ${gems === 1 ? 'gema' : 'gemas'}!`);
    if (!newBest && prevBest) lines.push(`${icon('trophy', 20)} Récord: ${prevBest.toLocaleString('es-AR')} m`);
    const nextStar = [400, 1000, 2000][stars];
    if (nextStar) lines.push(`${icon('star', 20)} Próxima estrella: <b>${nextStar.toLocaleString('es-AR')} m</b>`);
    const choice = await ctx.endGame({
      game: 'driving', score: meters, stars, won: true,
      coins: coins + Math.floor(meters / 50), gems, xp: 10 + Math.floor(meters / 100), newBest,
      title: stars >= 2 ? '¡Qué paseo!' : '¡Lindo paseo!',
      subtitle: `Recorriste ${meters.toLocaleString('es-AR')} m`, lines, againLabel: 'Otra vuelta',
    });
    if (unmounted) return;
    if (choice === 'again') startRun();
  }

  function pause() {
    if (paused || !(phase === 'run' || phase === 'countdown')) return;
    paused = true;
    const meters = Math.max(0, Math.floor(p - runStart));
    let action = 'resume';
    pauseModal = ui.modal({
      title: 'Pausa', icon: 'pause', closable: false,
      content: `<p class="center">Vas <b>${meters.toLocaleString('es-AR')} m</b> y juntaste <b>${coins}</b> ${icon('coin', 18)}</p><p class="center muted small">Si terminás ahora, te llevás lo que juntaste.</p>`,
      actions: [
        { label: 'Terminar', cls: 'ghost', onClick: () => { action = 'finish'; } },
        { label: 'Seguir', cls: 'pink', onClick: () => { action = 'resume'; } },
      ],
      onClose: () => {
        pauseModal = null;
        if (unmounted) return;
        if (action === 'finish') { paused = false; quitRun(); }
        else resume();
      },
    });
  }
  // al volver de la pausa: 3-2-1 cortito para no chocar de golpe con lo que venía
  function resume() {
    paused = false;
    if (phase === 'run') { resumeT = 1.5; resumeShown = 0; }
  }
  function tickResume(dt) {
    resumeT -= dt;
    const n = Math.ceil(resumeT / 0.5);
    if (n > 0 && n !== resumeShown) { resumeShown = n; showCount(String(n)); audio.sfx('select'); }
    if (resumeT <= 0) resumeT = 0;
  }
  // terminar antes de tiempo: si todavía no arrancó (cuenta regresiva) no hay premio que dar
  function quitRun() {
    if (phase === 'countdown') { ctx.router.go('city'); return; }
    finishRun();
  }
  async function askBack() {
    if (phase === 'intro' || phase === 'countdown') { audio.sfx('tap'); ctx.router.go('city'); return; }
    if (phase === 'ended' || phase === 'crash') return;
    if (paused) return;
    paused = true;
    const ok = await ui.confirm('¿Terminar el paseo?', 'Volvés a la ciudad con lo que juntaste hasta acá.', 'Terminar', 'Seguir');
    if (unmounted) return;
    if (ok) { paused = false; quitRun(); }
    else resume();
  }

  // =====================================================================
  // Entrada (touch / mouse / teclado)
  // =====================================================================
  function bindInput() {
    // un registro por dedo: tocar rápido con los dos pulgares (izq. y der. superpuestos) no pierde toques
    const ptrs = new Map();
    const onDown = (e) => {
      if (e.target.closest('button, .drv-intro, .game-bar, .modal-back')) return;
      if (phase !== 'run' || paused) return;
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, t: performance.now(), fired: false });
      try { root.setPointerCapture(e.pointerId); } catch {}
    };
    const onMove = (e) => {
      const ptr = ptrs.get(e.pointerId);
      if (!ptr || ptr.fired) return;
      const dx = e.clientX - ptr.x, dy = e.clientY - ptr.y;
      if (Math.abs(dx) > 26 || Math.abs(dy) > 26) {
        ptr.fired = true;
        if (Math.abs(dx) > Math.abs(dy)) steerTo(dx > 0 ? 1 : -1);
        else if (dy < 0) useTurbo();
      }
    };
    const onUp = (e) => {
      const ptr = ptrs.get(e.pointerId);
      if (!ptr) return;
      ptrs.delete(e.pointerId);
      if (!ptr.fired && performance.now() - ptr.t < 450) steerTo(e.clientX < (root.getBoundingClientRect().left + root.clientWidth / 2) ? -1 : 1);
    };
    const onCancel = (e) => { ptrs.delete(e.pointerId); };
    root.addEventListener('pointerdown', onDown);
    root.addEventListener('pointermove', onMove);
    root.addEventListener('pointerup', onUp);
    root.addEventListener('pointercancel', onCancel);

    const onKey = (e) => {
      const k = e.code || e.key;
      // con un modal abierto, Espacio/Enter tienen que poder activar sus botones
      if (!ui.hasModal() && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(k)) e.preventDefault();
      if (e.repeat) return;
      if (k === 'Escape' || k === 'KeyP') {
        if (pauseModal) { pauseModal.close(); return; }
        if (ui.hasModal()) return;
        if (phase === 'intro') { if (k === 'Escape') ctx.router.go('city'); return; }
        pause();
        return;
      }
      if (ui.hasModal()) return;
      if (phase === 'intro' && (k === 'Enter' || k === 'Space' || k === 'NumpadEnter')) { startRun(); return; }
      if (k === 'ArrowLeft' || k === 'KeyA') steerTo(-1);
      else if (k === 'ArrowRight' || k === 'KeyD') steerTo(1);
      else if (k === 'ArrowUp' || k === 'KeyW' || k === 'Space') useTurbo();
    };
    addEventListener('keydown', onKey);
    const onVis = () => { if (document.visibilityState === 'hidden') pause(); };
    document.addEventListener('visibilitychange', onVis);
    const onBlur = () => pause();
    addEventListener('blur', onBlur);
    offs.push(() => {
      removeEventListener('keydown', onKey);
      document.removeEventListener('visibilitychange', onVis);
      removeEventListener('blur', onBlur);
    });

    root.querySelector('[data-act="back"]').addEventListener('click', () => askBack());
    root.querySelector('[data-act="pause"]').addEventListener('click', () => { audio.sfx('tap'); pause(); });
    root.querySelector('[data-act="go"]').addEventListener('click', () => startRun());
    el.turboBtn.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); useTurbo(); });
  }

  // =====================================================================
  // Ciclo de vida
  // =====================================================================
  return {
    hud: false,
    music: 'drive',
    async mount(container, params = {}) {
      root = container;
      debugStart = Math.max(0, Number(params.drvStart) || 0);
      if (!document.getElementById(STYLE_ID)) {
        const s = document.createElement('style'); s.id = STYLE_ID; s.textContent = CSS; document.head.append(s);
      }
      isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
      container.classList.toggle('touch', isTouch);
      buildDOM(container);

      const st = ctx.state;
      stats = typeof carMod.carStats === 'function' ? carMod.carStats(st.car) : (() => { const b = CAR_BODIES.find(x => x.id === st.car.body) || CAR_BODIES[0]; return { speed: b.speed, handling: b.handling }; })();
      vBase = 11 + (stats.speed - 3) * 0.7;
      vMax = 25 + (stats.speed - 3) * 1.3;
      laneRate = 11 + (stats.handling - 3) * 1.8;

      const low = !!st.settings?.lowQuality;
      sky = new Sky(stage);
      r = createPixelRenderer(stage, { ortho: false, background: null, fov: 58, shadows: !low, pixelSize: low ? 4 : undefined });
      r.renderer.setClearColor(0x000000, 0);
      mats = makeMaterials(bendU);
      warmup();
      buildScene();
      resetRun();
      v = 5;
      bindInput();
      r.onFrame((dt) => {
        if (unmounted) return;
        if (!paused && resumeT > 0) tickResume(dt);
        if (!paused && resumeT <= 0) update(dt);
        else drawSky(lastSky[0], lastSky[1], lastSky[2], 0);   // congelado: mismo cielo (sin saltos de bioma)
      });
      r.start();
      root.drvDebug = () => {
        let nodes = 0; r.scene.traverse(() => nodes++);
        return { phase, p, m: p - runStart, v, lives, coins, gems, charge, calls: r.renderer.info.render.calls, tris: r.renderer.info.render.triangles, biome: BIOMES[biomeIndexAt(p - runStart)].id,
          nodes, children: r.scene.children.length, mem: { ...r.renderer.info.memory }, programs: r.renderer.info.programs?.length,
          active: { obst: obstacles.filter(e => e.active).length, items: items.filter(e => e.active).length, coins: coinList.filter(c => c.active).length } };
      };
      // simulación rápida para pruebas (smoke): avanza `sec` segundos de juego; god = no pierde vidas
      root.drvSim = (sec, god = true) => { for (let t = 0; t < sec; t += 1 / 60) { if (god) lives = MAX_LIVES; if (!paused) update(1 / 60); } return root.drvDebug(); };
    },
    unmount() {
      unmounted = true;
      clearTimeout(bannerTimer);
      for (const off of offs.splice(0)) { try { off(); } catch (e) { console.error(e); } }
      try { pauseModal?.close(); } catch {}
      r?.dispose();
      sky?.dispose();
      mats && Object.values(mats).forEach(m => m.dispose?.());
      document.getElementById(STYLE_ID)?.remove();
      chunks.length = 0; obstacles.length = 0; items.length = 0; coinList.length = 0; parts.length = 0; petals.length = 0;
      r = null; sky = null; root = null; stage = null;
    },
  };
}
