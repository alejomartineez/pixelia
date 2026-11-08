// Mi Casa por dentro: cuarto vóxel con tus muebles, tu personaje que pasea y se sienta, y el modo Decorar
// (poner, mover arrastrando, rotar, guardar; tienda de muebles; paredes y pisos). El ropero abre el Equipaje.
// "Ampliar" agranda la casa (mejora del edificio mi_casa, con constructora y materiales).
// Con params.visit (id de una amistad) muestra su casa en modo solo mirar (datos de su perfil: city.home).
import * as THREE from 'three';
import { createPixelRenderer, addLights, setIsoCamera, disposeObject } from '../core/voxel.js';
import { icon } from '../core/icons.js';
import { voxelModel, objectThumbnail } from '../city/models.js';
import { avatarModel, normalizeLook } from '../avatar/avatar.js';
import {
  FURNITURE, FURNITURE_BY_ID, WALLS, FLOORS, HOME_LEVELS, homeLevelDef, homeState, homeLevel, roomLayout, footprint,
  canPlaceItem, freeSpot, placeItem, moveItem, storeItem, buyFurniture, canBuyFurniture, setWall, setFloor, comfortInfo,
} from '../home/furniture.js';
import { furnitureModel } from '../home/furniture-models.js';

const SEAT_Y = { silla: 0.5, sillon: 0.55, puff: 0.5, trono: 0.55, cama: 0.55 };

const HM_CSS = `
.scene-home { position:absolute; inset:0; overflow:hidden; background:var(--surface-2); }
.scene-home .hm-stage { position:absolute; inset:0; touch-action:none; }
.scene-home .hm-top { position:absolute; z-index:3; top:calc(var(--safe-t) + 8px); left:calc(var(--safe-l) + 8px); right:calc(var(--safe-r) + 8px);
  display:flex; align-items:flex-start; gap:8px; pointer-events:none; }
.scene-home .hm-top > * { pointer-events:auto; }
.scene-home .hm-title { display:flex; flex-direction:column; gap:2px; padding:6px 12px; background:var(--panel, var(--surface)); border:var(--line, 3px) solid var(--edge);
  border-radius:16px; box-shadow:0 3px 0 var(--shade); min-width:0; }
.scene-home .hm-title b { font-size:18px; line-height:1.1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.scene-home .hm-title small { display:flex; align-items:center; gap:4px; font-size:13px; color:var(--ink-l); font-weight:700; flex-wrap:wrap; }
.scene-home .hm-grow { flex:1; }
.scene-home .hm-btns { display:flex; flex-direction:column; gap:8px; align-items:flex-end; }
.scene-home .hm-btns .btn { min-height:44px; padding:6px 12px; font-size:16px; gap:4px; }
.scene-home .hm-hint { position:absolute; z-index:2; left:50%; transform:translateX(-50%); bottom:calc(var(--safe-b) + 16px); padding:6px 14px; font-size:14px; font-weight:700;
  background:var(--panel, var(--surface)); border:2px solid var(--edge); border-radius:99px; box-shadow:0 2px 0 var(--shade); white-space:nowrap; transition:opacity .4s; pointer-events:none; }
.scene-home .hm-hint.gone { opacity:0; }
.scene-home .hm-deco { position:absolute; z-index:4; left:0; right:0; bottom:0; padding:8px calc(var(--safe-r) + 8px) calc(var(--safe-b) + 8px) calc(var(--safe-l) + 8px);
  background:var(--panel, var(--surface)); border-top:var(--line, 3px) solid var(--edge); border-radius:20px 20px 0 0; box-shadow:0 -4px 0 rgba(8, 6, 5,.15);
  display:flex; flex-direction:column; gap:8px; max-height:44vh; transform:translateY(110%); transition:transform .28s cubic-bezier(.3,1.2,.6,1); }
.scene-home.editing .hm-deco { transform:none; }
.scene-home .hm-tabs { display:flex; gap:6px; overflow-x:auto; scrollbar-width:none; }
.scene-home .hm-tabs .tab { flex:none; }
.scene-home .hm-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(92px, 1fr)); gap:8px; overflow-y:auto; padding:2px 2px 6px; min-height:120px; }
.scene-home .hm-card { position:relative; display:flex; flex-direction:column; align-items:center; gap:2px; padding:6px 4px; background:var(--surface); border:2px solid var(--edge);
  border-radius:14px; box-shadow:0 3px 0 var(--shade); font:inherit; color:inherit; cursor:pointer; min-width:0; }
.scene-home .hm-card:active { transform:translateY(2px); box-shadow:0 1px 0 var(--shade); }
.scene-home .hm-card.locked { opacity:.55; }
.scene-home .hm-card .th { width:64px; height:64px; display:grid; place-items:center; }
.scene-home .hm-card .th img { width:64px; height:64px; image-rendering:pixelated; }
.scene-home .hm-card .nm { font-size:12px; font-weight:700; text-align:center; line-height:1.1; max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.scene-home .hm-card .pr { font-size:12px; display:flex; align-items:center; gap:2px; }
.scene-home .hm-card .ct { position:absolute; top:-6px; right:-6px; min-width:22px; height:22px; padding:0 5px; display:grid; place-items:center; font-size:12px; font-weight:700;
  color:#fff; background:var(--primary, #ee8a5c); border:2px solid var(--edge); border-radius:11px; }
.scene-home .hm-sw { width:64px; height:64px; border-radius:12px; border:2px solid var(--edge); }
.scene-home .hm-card.on { outline:3px solid var(--gold, #ffd166); outline-offset:2px; }
.scene-home .hm-empty { grid-column:1 / -1; text-align:center; font-size:14px; color:var(--ink-l); padding:12px; }
.scene-home .hm-sel { position:absolute; z-index:5; left:50%; transform:translateX(-50%); bottom:calc(44vh + 12px); display:none; align-items:center; gap:6px; padding:6px;
  background:var(--panel, var(--surface)); border:var(--line, 3px) solid var(--edge); border-radius:16px; box-shadow:0 3px 0 var(--shade); }
.scene-home.selecting .hm-sel { display:flex; }
.scene-home .hm-sel b { padding:0 6px; font-size:15px; white-space:nowrap; }
.scene-home .hm-sel .btn { min-height:40px; padding:4px 10px; font-size:15px; gap:3px; }
@media (min-width: 900px) {
  .scene-home .hm-deco { left:auto; right:calc(var(--safe-r) + 12px); bottom:calc(var(--safe-b) + 12px); width:420px; max-height:70vh; border:var(--line, 3px) solid var(--edge); border-radius:20px; transform:translateX(120%); }
  .scene-home.editing .hm-deco { transform:none; }
  .scene-home .hm-sel { bottom:calc(var(--safe-b) + 16px); left:calc(50% - 210px); }
}
`;

export default function create(ctx) {
  const { store, ui, audio, bus, economy: E } = ctx;
  let root, r, styleEl, params = {};
  const offs = [];
  let alive = false;
  let visit = null;          // { name, home:{wall, floor, items:[[id,x,z,rot]]}, level, look }
  let editing = false, tab = 'mine';
  let roomObj = null;
  const itemObjs = new Map();   // uid -> group
  let sel = null;               // { uid, it, drag:{...} }
  let player = null;
  let markers = [];
  const camState = { angle: Math.PI / 4, view: 10, target: new THREE.Vector3() };

  // ---------- datos (propios o de la visita) ----------
  const level = () => (visit ? visit.level : homeLevel());
  const size = () => homeLevelDef(level()).size;
  const H = () => (visit ? visit.home : homeState());
  const items = () => (visit ? (visit.home.items || []).map((a, i) => ({ uid: -1 - i, id: a[0], x: a[1], z: a[2], rot: a[3] || 0 })) : homeState().items);
  const layout = () => { const [W, D] = size(); return roomLayout(level(), W, D); };

  // ---------- coordenadas ----------
  function itemWorld(it) {
    const [W, D] = size();
    const f = FURNITURE_BY_ID[it.id];
    if (f?.wall) {
      const len = f.size[0];
      return it.rot % 2 ? new THREE.Vector3(-W / 2 + 0.5, 0, it.z - D / 2 + len / 2) : new THREE.Vector3(it.x - W / 2 + len / 2, 0, -D / 2 + 0.5);
    }
    const [w, d] = footprint(it.id, it.rot);
    return new THREE.Vector3(it.x - W / 2 + w / 2, f?.rug ? 0.01 : 0, it.z - D / 2 + d / 2);
  }
  const tileCenter = (x, z) => { const [W, D] = size(); return new THREE.Vector3(x - W / 2 + 0.5, 0, z - D / 2 + 0.5); };
  function worldToTile(p) { const [W, D] = size(); return [Math.floor(p.x + W / 2), Math.floor(p.z + D / 2)]; }

  // ---------- cuarto ----------
  function buildRoom() {
    if (roomObj) { r.scene.remove(roomObj); roomObj = null; }
    const [W, D] = size();
    const lv = level();
    const wl = WALLS.find(w => w.id === H().wall) || WALLS[0];
    const fl = FLOORS.find(f => f.id === H().floor) || FLOORS[0];
    const key = ['room', lv, W, D, wl.id, fl.id].join(':');
    roomObj = voxelModel(key, W * 8, D * 8, (m) => drawRoom(m, lv, W, D, wl, fl));
    r.scene.add(roomObj);
  }
  function drawRoom(m, lv, W, D, wl, fl) {
    const v = m.v, X = W * 8, Z = D * 8, WH = 24;
    const lay = roomLayout(lv, W, D);
    // piso
    for (let x = 0; x < X; x++) for (let z = 0; z < Z; z++) {
      let c;
      if (fl.checker) c = (Math.floor(x / 8) + Math.floor(z / 8)) % 2 ? fl.a : fl.b;
      else if (fl.id === 'pasto') c = (x * 3 + z * 7) % 11 === 0 ? fl.b : fl.a;
      else { const row = Math.floor(z / 4); const seam = (x + row * 13) % 24 === 0; c = seam || z % 4 === 0 ? fl.b : fl.a; }
      v.set(x, 0, z, c);
    }
    // paredes del fondo y de la izquierda (2 vóxeles de grosor), zócalo de madera y moldura arriba
    const wallC = (u, y) => (y <= 1 ? '#b57d4c' : y === WH ? '#ffffff' : wl.stripes ? (Math.floor(u / 3) % 2 ? wl.a : wl.b) : (y % 6 === 0 ? wl.b : wl.a));
    for (let x = -2; x < X; x++) for (let y = 0; y <= WH; y++) for (const z of [-2, -1]) v.set(x, y, z, wallC(x, y));
    for (let z = 0; z < Z; z++) for (let y = 0; y <= WH; y++) for (const x of [-2, -1]) v.set(x, y, z, wallC(z, y));
    // puerta en la pared izquierda
    const dz = lay.door * 8;
    for (let z = dz + 1; z < dz + 7; z++) for (let y = 1; y <= 13; y++) v.set(-1, y, z, z === dz + 1 || z === dz + 6 || y === 13 ? '#ffffff' : '#c98a52');
    v.set(0, 7, dz + 5, '#ffd166');
    // ventanita en el fondo (nivel 1) o ventanal (2+), con cielo
    const sky = (x, y) => (y > 15 ? '#cfe9ff' : y > 11 ? '#e3f3ff' : '#bfe6a8');
    const big = lv >= 2;
    const winRange = [lay.win[0] * 8 + 1, lay.win[lay.win.length - 1] * 8 + 7];
    const wy0 = big ? 6 : 9, wy1 = 19;
    for (let x = winRange[0]; x < winRange[1]; x++) for (let y = wy0; y <= wy1; y++) {
      const frame = x === winRange[0] || x === winRange[1] - 1 || y === wy0 || y === wy1 || (big && (x - winRange[0]) % 7 === 0);
      if (frame) v.set(x, y, -1, '#ffffff'); else { v.set(x, y, -1, null); m.glow.set(x, y, -2, sky(x, y)); }
    }
    for (let x = winRange[0] - 1; x <= winRange[1]; x++) v.set(x, wy0 - 1, 0, '#ffffff');   // alféizar
    if (lv >= 2) for (let x = winRange[0]; x < winRange[1]; x += 2) v.set(x, wy0, 0, x % 4 ? '#f28ca0' : '#5fc46a');   // macetitas
    // 3+: cocina en el fondo, a la derecha: piso de cocina, azulejos, mesada con pileta, alacenas y estante con frascos
    if (lay.kitchen) {
      const kx = X - 24;
      for (let x = kx; x < X; x++) for (let z = 0; z < 16; z++) v.set(x, 0, z, (Math.floor(x / 4) + Math.floor(z / 4)) % 2 ? '#ffffff' : '#f2a7a0');
      for (let x = kx; x < X; x++) for (let y = 2; y <= 20; y++) v.set(x, y, -1, (Math.floor(x / 2) + Math.floor(y / 2)) % 2 ? '#ffffff' : '#8fd3ff');
      // mueble bajo con puertitas y manijas
      v.box(kx, 1, 0, 24, 7, 6, '#7fc8a9');
      for (let x = kx; x < X; x += 6) { v.box(x, 1, 6, 1, 7, 1, '#5aa889'); v.set(x + 3, 6, 6, '#ffd166'); }
      v.box(kx, 1, 6, 24, 1, 1, '#4d8f75');                                                     // zócalo
      v.box(kx, 8, 0, 24, 1, 7, '#c98a52');                                                     // mesada de madera
      // pileta con canilla
      v.box(kx + 13, 8, 1, 8, 1, 4, '#c9d2df'); v.box(kx + 14, 8, 2, 6, 1, 2, '#8fd3ff');
      v.box(kx + 16, 9, 0, 2, 4, 1, '#a9b4c2'); v.box(kx + 16, 12, 1, 2, 1, 2, '#a9b4c2');
      // tabla con verduras y un frutero
      v.box(kx + 3, 9, 2, 6, 1, 4, '#e6b17a'); v.set(kx + 4, 10, 3, '#ff8c42'); v.set(kx + 6, 10, 4, '#5fc46a'); v.set(kx + 7, 10, 3, '#e05a4f');
      v.box(kx + 9, 9, 3, 3, 1, 3, '#ffffff'); v.set(kx + 10, 10, 4, '#ffd166'); v.set(kx + 9, 10, 3, '#e05a4f');
      // alacenas arriba, con puertitas
      v.box(kx, 15, 0, 24, 6, 4, '#7fc8a9'); v.box(kx, 21, 0, 24, 1, 4, '#ffffff');
      for (let x = kx; x < X; x += 6) { v.box(x, 15, 4, 1, 6, 1, '#5aa889'); v.set(x + 3, 16, 4, '#ffd166'); }
      // estante con frascos y cucharones colgando
      v.box(kx + 1, 13, 0, 11, 1, 2, '#9a6438');
      [['#ffd166', 2], ['#f28ca0', 5], ['#9fdc8a', 8]].forEach(([c, dx]) => { v.box(kx + dx, 14, 0, 2, 1, 2, c); });
      for (const dx of [14, 17, 20]) { v.box(kx + dx, 10, 0, 1, 3, 1, '#7a5a3a'); v.set(kx + dx, 10, 1, '#a9b4c2'); }
      m.light.box(kx + 2, 14, 4, 20, 1, 1, '#fff3b0');                                          // luz bajo la alacena
    }
    // 4+: tabique con arco que separa dos ambientes
    if (lay.part >= 0) {
      const px = lay.part * 8 + 3;
      for (let z = 0; z < 24; z++) for (let y = 0; y <= WH; y++) for (const x of [px, px + 1]) {
        if (z >= 6 && z < 18 && y < 15 && !(y >= 13 && (z === 6 || z === 17))) continue;   // arco
        v.set(x, y, z, y <= 1 ? '#b57d4c' : y === WH ? '#ffffff' : wl.a);
      }
    }
    // 5: altillo con columnas, baranda y escalera
    if (lay.loft) {
      const lx = (lay.loft.x1 + 1) * 8, lz = (lay.loft.z1 + 1) * 8, ly = 16;
      for (let x = 0; x < lx; x++) for (let z = 0; z < lz; z++) v.set(x, ly, z, (x + z) % 4 ? '#c98a52' : '#b57d4c');
      for (const [x, z] of [[lx - 1, lz - 1], [lx - 1, 0], [0, lz - 1]]) v.box(x, 1, z, 1, ly - 1, 1, '#9a6438');
      for (let x = 0; x < lx; x++) if (x % 2 === 0) v.box(x, ly + 1, lz - 1, 1, 4, 1, '#ffffff'); else v.set(x, ly + 4, lz - 1, '#ffffff');
      for (let z = 0; z < lz; z++) if (z % 2 === 0) v.box(lx - 1, ly + 1, z, 1, 4, 1, '#ffffff'); else v.set(lx - 1, ly + 4, z, '#ffffff');
      for (let i = 0; i < 16; i++) v.box(0, i + 1, lz + 31 - i * 2, 8, 1, 2, i % 2 ? '#c98a52' : '#b57d4c');   // escalera
      v.box(2, ly + 1, 2, 12, 3, 8, '#ffffff'); v.box(2, ly + 4, 2, 12, 1, 8, '#b58cff');   // camita del altillo
      m.light.box(lx - 12, 22, -1, 8, 1, 1, '#fff3b0');                                       // claraboya
    }
    m.height = WH + 2;
  }

  // ---------- muebles ----------
  function buildItems() {
    for (const g of itemObjs.values()) r.scene.remove(g);
    itemObjs.clear();
    for (const it of items()) addItemObj(it);
  }
  function addItemObj(it) {
    const g = new THREE.Group();
    const mdl = furnitureModel(it.id);
    g.add(mdl);
    g.position.copy(itemWorld(it));
    g.rotation.y = (it.rot % 4) * Math.PI / 2 * (FURNITURE_BY_ID[it.id]?.wall ? 1 : 1);
    if (FURNITURE_BY_ID[it.id]?.wall) g.rotation.y = it.rot % 2 ? Math.PI / 2 : 0;
    g.userData.uid = it.uid;
    g.traverse(o => { o.userData.uid = it.uid; });
    r.scene.add(g);
    itemObjs.set(it.uid, g);
    return g;
  }
  function refreshItem(it) {
    const g = itemObjs.get(it.uid);
    if (!g) return;
    g.position.copy(itemWorld(it));
    g.rotation.y = FURNITURE_BY_ID[it.id]?.wall ? (it.rot % 2 ? Math.PI / 2 : 0) : (it.rot % 4) * Math.PI / 2;
  }

  // ---------- personaje ----------
  function occupied() {
    const [W, D] = size();
    const lay = layout();
    const occ = new Set(lay.floor);
    for (const it of items()) {
      const f = FURNITURE_BY_ID[it.id];
      if (!f || f.wall || f.rug) continue;
      const [w, d] = footprint(it.id, it.rot);
      for (let x = it.x; x < it.x + w; x++) for (let z = it.z; z < it.z + d; z++) occ.add(x + ',' + z);
    }
    return { occ, W, D };
  }
  function path(from, to) {
    const { occ, W, D } = occupied();
    const key = (x, z) => x + ',' + z;
    const prev = new Map([[key(...from), null]]);
    const q = [from];
    while (q.length) {
      const [x, z] = q.shift();
      if (x === to[0] && z === to[1]) break;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, nz = z + dz, k = key(nx, nz);
        if (nx < 0 || nz < 0 || nx >= W || nz >= D || prev.has(k) || (occ.has(k) && !(nx === to[0] && nz === to[1]))) continue;
        prev.set(k, [x, z]); q.push([nx, nz]);
      }
    }
    if (!prev.has(key(...to))) return null;
    const out = [];
    for (let p = to; p; p = prev.get(key(...p))) out.unshift(p);
    return out;
  }
  function freeTiles() {
    const { occ, W, D } = occupied();
    const out = [];
    for (let x = 0; x < W; x++) for (let z = 0; z < D; z++) if (!occ.has(x + ',' + z)) out.push([x, z]);
    return out;
  }
  function buildPlayer() {
    if (player) { r.scene.remove(player.obj); disposeObject(player.obj); }
    const look = visit ? normalizeLook(visit.look || {}) : store.state.avatar;
    const obj = avatarModel(look, { player: true });
    obj.scale.setScalar(0.95);
    const tiles = freeTiles();
    const [W, D] = size();
    const start = tiles.find(([x, z]) => z === D - 2 && x <= 1) || tiles.sort((a, b) => Math.hypot(a[0] - W / 2, a[1] - D / 2) - Math.hypot(b[0] - W / 2, b[1] - D / 2))[0] || [0, 0];
    obj.position.copy(tileCenter(...start));
    r.scene.add(obj);
    player = { obj, tile: start, route: [], idle: 1.5, sit: null };
  }
  function goTo(tile, sitOn = null) {
    if (!player) return false;
    if (player.sit) standUp();
    const p = path(player.tile, tile);
    if (!p) return false;
    player.route = p.slice(1);
    player.sitTarget = sitOn;
    return true;
  }
  function standUp() {
    if (!player?.sit) return;
    player.obj.position.copy(tileCenter(...player.tile));
    player.sit = null;
  }
  function trySit(it) {
    const f = FURNITURE_BY_ID[it.id];
    const [w, d] = footprint(it.id, it.rot);
    const { occ } = occupied();
    // tile libre al lado del mueble (preferentemente adelante)
    const cand = [];
    for (let x = it.x - 1; x <= it.x + w; x++) for (let z = it.z - 1; z <= it.z + d; z++) {
      const inside = x >= it.x && x < it.x + w && z >= it.z && z < it.z + d;
      if (inside || occ.has(x + ',' + z)) continue;
      cand.push([x, z]);
    }
    cand.sort((a, b) => Math.hypot(a[0] - player.tile[0], a[1] - player.tile[1]) - Math.hypot(b[0] - player.tile[0], b[1] - player.tile[1]));
    for (const c of cand) if (goTo(c, f.sit || f.bed ? it : null)) return true;
    return false;
  }
  function updatePlayer(dt) {
    if (!player) return;
    const o = player.obj;
    if (player.sit) {
      o.userData.update?.(dt, false);
      player.sit.t -= dt;
      if (player.sit.t <= 0 && !editing) { standUp(); player.idle = 1 + Math.random() * 2; }
      return;
    }
    if (player.route.length) {
      const next = player.route[0];
      const tgt = tileCenter(...next);
      const d = tgt.clone().sub(o.position); d.y = 0;
      const len = d.length();
      const step = 1.7 * dt;
      if (len <= step) { o.position.x = tgt.x; o.position.z = tgt.z; player.tile = next; player.route.shift(); }
      else { d.normalize(); o.position.addScaledVector(d, step); o.rotation.y = Math.atan2(d.x, d.z); }
      o.userData.update?.(dt, true);
      if (!player.route.length && player.sitTarget) {
        const it = player.sitTarget; player.sitTarget = null;
        const c = itemWorld(it);
        o.position.set(c.x, SEAT_Y[it.id] ?? 0.5, c.z);
        o.rotation.y = (it.rot % 4) * Math.PI / 2;
        player.sit = { uid: it.uid, t: 5 + Math.random() * 6 };
      }
      return;
    }
    o.userData.update?.(dt, false);
    player.idle -= dt;
    if (player.idle <= 0) {
      player.idle = 2.5 + Math.random() * 4;
      const seats = items().filter(it => FURNITURE_BY_ID[it.id]?.sit);
      if (seats.length && Math.random() < 0.35) { trySit(seats[Math.floor(Math.random() * seats.length)]); return; }
      const tiles = freeTiles();
      if (tiles.length) goTo(tiles[Math.floor(Math.random() * tiles.length)]);
    }
  }
  function settlePlayer() {
    if (!player) return;
    const { occ } = occupied();
    if (player.sit && !items().some(it => it.uid === player.sit.uid)) standUp();
    if (!player.sit && occ.has(player.tile.join(','))) {
      const tiles = freeTiles();
      const t = tiles.sort((a, b) => Math.hypot(a[0] - player.tile[0], a[1] - player.tile[1]) - Math.hypot(b[0] - player.tile[0], b[1] - player.tile[1]))[0];
      if (t) { player.tile = t; player.obj.position.copy(tileCenter(...t)); player.route = []; }
    }
  }

  // ---------- cámara ----------
  function placeCamera() {
    camState.target.set(0, 1, 0);
    setIsoCamera(r.camera, camState.target, camState.angle, 60, 0.6);
    let view = camState.view;
    // decorando, el panel tapa un costado (PC) o la parte de abajo (celu): el cuarto se aleja lo justo para entrar
    // entero en el lugar que queda libre y se corre ahí, así se ve todo mientras elegís muebles
    if (editing && root) {
      const el = root.querySelector('.hm-stage');
      const Wpx = el.clientWidth || innerWidth, Hpx = el.clientHeight || innerHeight;
      const asp = Wpx / Hpx;
      const deco = root.querySelector('.hm-deco');
      const right = new THREE.Vector3().setFromMatrixColumn(r.camera.matrixWorld, 0);
      const up = new THREE.Vector3().setFromMatrixColumn(r.camera.matrixWorld, 1);
      const { isoW = 10, isoH = 8 } = camState;
      if (innerWidth >= 900) {
        const pw = Math.min(Wpx * 0.6, (deco?.offsetWidth || 420) + 24);
        view = Math.max(view, isoW / asp * Wpx / Math.max(200, Wpx - pw), isoH);
        camState.target.addScaledVector(right, (pw / 2) * view / Hpx);
      } else {
        const ph = Math.min(Hpx * 0.6, (deco?.offsetHeight || Hpx * 0.44) + 12);
        view = Math.max(view, isoW / asp, isoH * Hpx / Math.max(200, Hpx - ph));
        camState.target.addScaledVector(up, -(ph / 2) * view / Hpx);
      }
      setIsoCamera(r.camera, camState.target, camState.angle, 60, 0.6);
    }
    r.setViewSize(view);
  }
  function fitView() {
    const [W, D] = size();
    const el = root.querySelector('.hm-stage');
    const asp = (el.clientWidth || innerWidth) / (el.clientHeight || innerHeight);
    // a 45° el cuarto ocupa (W + D)·cos45 de ancho; de alto, el piso inclinado más las paredes (y el altillo)
    camState.isoW = (W + D) * 0.71 + 2.5;
    camState.isoH = (W + D) * 0.71 * Math.sin(0.6) + 5;
    camState.view = Math.max(6, camState.isoW / asp, camState.isoH);
    camState.minView = 4; camState.maxView = camState.view * 1.4;
    placeCamera();
  }

  // ---------- selección y arrastre (Decorar) ----------
  const raycaster = new THREE.Raycaster();
  function pickItem(cx, cy) {
    raycaster.setFromCamera(r.toNDC(cx, cy), r.camera);
    const objs = [...itemObjs.values()];
    const hits = raycaster.intersectObjects(objs, true);
    for (const h of hits) { let o = h.object; while (o && o.userData.uid == null) o = o.parent; if (o) return items().find(it => it.uid === o.userData.uid) || null; }
    return null;
  }
  function select(it) {
    sel = it ? { uid: it.uid } : null;
    root.classList.toggle('selecting', !!sel);
    for (const [uid, g] of itemObjs) g.position.y = itemWorld(items().find(i => i.uid === uid) || { id: 'x', x: 0, z: 0, rot: 0 }).y + (sel && uid === sel.uid ? 0.12 : 0);
    renderSel();
    showMarkers(it, true);
  }
  function selItem() { return sel ? homeState().items.find(i => i.uid === sel.uid) : null; }
  function clearMarkers() { for (const mk of markers) { r.scene.remove(mk); mk.geometry.dispose(); } markers = []; }
  const okMat = new THREE.MeshBasicMaterial({ color: 0x6fe3c1, transparent: true, opacity: 0.45, depthWrite: false });
  const badMat = new THREE.MeshBasicMaterial({ color: 0xff6f6f, transparent: true, opacity: 0.5, depthWrite: false });
  function showMarkers(it, ok) {
    clearMarkers();
    if (!it) return;
    const f = FURNITURE_BY_ID[it.id];
    if (f?.wall) return;
    const [w, d] = footprint(it.id, it.rot);
    const geo = new THREE.PlaneGeometry(w - 0.08, d - 0.08);
    const mk = new THREE.Mesh(geo, ok ? okMat : badMat);
    mk.rotation.x = -Math.PI / 2;
    const c = itemWorld(it);
    mk.position.set(c.x, 0.14, c.z);
    mk.renderOrder = 5;
    r.scene.add(mk); markers.push(mk);
  }
  function dragTo(cx, cy) {
    const it = selItem();
    if (!it) return;
    const f = FURNITURE_BY_ID[it.id];
    const [W, D] = size();
    let cand;
    if (f.wall) {
      // la pared más cercana al puntero: fondo (x libre) o izquierda (z libre)
      const p = r.pickGround(cx, cy, 1.5);
      if (!p) return;
      const tx = p.x + W / 2, tz = p.z + D / 2;
      const len = f.size[0];
      cand = tz < tx ? { x: Math.max(0, Math.min(W - len, Math.round(tx - len / 2))), z: 0, rot: 0 } : { x: 0, z: Math.max(0, Math.min(D - len, Math.round(tz - len / 2))), rot: 1 };
    } else {
      const p = r.pickGround(cx, cy, 0);
      if (!p) return;
      const [w, d] = footprint(it.id, it.rot);
      cand = { x: Math.max(0, Math.min(W - w, Math.round(p.x + W / 2 - w / 2))), z: Math.max(0, Math.min(D - d, Math.round(p.z + D / 2 - d / 2))), rot: it.rot };
    }
    const drag = sel.drag;
    if (drag.x === cand.x && drag.z === cand.z && drag.rot === cand.rot) return;
    Object.assign(drag, cand);
    const ghost = { ...it, ...cand };
    const g = itemObjs.get(it.uid);
    g.position.copy(itemWorld(ghost)); g.position.y += 0.12;
    g.rotation.y = f.wall ? (cand.rot % 2 ? Math.PI / 2 : 0) : (cand.rot % 4) * Math.PI / 2;
    drag.ok = canPlaceItem(it.id, cand.x, cand.z, cand.rot, it.uid).ok;
    showMarkers(ghost, drag.ok);
    audio.sfx('tap');
  }
  function endDrag() {
    const it = selItem();
    if (!it || !sel.drag) return;
    const d = sel.drag; sel.drag = null;
    if (d.x == null) return;
    if (d.ok) { moveItem(it.uid, d.x, d.z, d.rot); audio.sfx('place'); }
    else { audio.sfx('error'); ui.toast('Ahí no entra', { icon: 'info' }); }
    refreshItem(it); select(it); settlePlayer();
  }
  function rotateSel() {
    const it = selItem();
    if (!it) return;
    const f = FURNITURE_BY_ID[it.id];
    if (f.wall) {
      // los de pared cambian de pared
      const other = it.rot % 2 ? 0 : 1;
      const [W, D] = size();
      const len = f.size[0];
      let done = false;
      for (let a = 0; a + len <= (other ? D : W) && !done; a++) {
        const [x, z] = other ? [0, a] : [a, 0];
        if (canPlaceItem(it.id, x, z, other, it.uid).ok) { moveItem(it.uid, x, z, other); done = true; }
      }
      if (!done) { audio.sfx('error'); ui.toast('No hay lugar en la otra pared', { icon: 'info' }); return; }
    } else {
      const rot = (it.rot + 1) % 4;
      const [W, D] = size();
      const [w, d] = footprint(it.id, rot);
      const x = Math.min(it.x, W - w), z = Math.min(it.z, D - d);
      if (canPlaceItem(it.id, x, z, rot, it.uid).ok) moveItem(it.uid, x, z, rot);
      else { audio.sfx('error'); ui.toast('No hay lugar para girarlo ahí', { icon: 'info' }); return; }
    }
    audio.sfx('swoosh');
    refreshItem(it); select(it); settlePlayer();
  }
  function storeSel() {
    const it = selItem();
    if (!it) return;
    storeItem(it.uid);
    const g = itemObjs.get(it.uid);
    if (g) { r.scene.remove(g); itemObjs.delete(it.uid); }
    audio.sfx('pop');
    select(null); settlePlayer(); renderDeco();
  }
  function putFromInventory(id) {
    const f = FURNITURE_BY_ID[id];
    const spot = freeSpot(id, 0);
    if (!spot) { audio.sfx('error'); ui.toast('No hay lugar. Guardá algo o ampliá la casa', { icon: 'home' }); return; }
    const it = placeItem(id, spot[0], spot[1], spot[2]);
    if (it.error) { audio.sfx('error'); ui.toast(it.error); return; }
    addItemObj(it);
    audio.sfx('place');
    select(it); settlePlayer(); renderDeco(); refreshTitle();
    if (f) ui.toast(`${f.name}: arrastralo para moverlo`, { icon: 'move' });
  }

  // ---------- input ----------
  const pointers = new Map();
  let gesture = null, down = null, pinch0 = null;
  function onDown(ev) {
    pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY, sx: ev.clientX, sy: ev.clientY });
    try { ev.target.setPointerCapture(ev.pointerId); } catch {}
    if (pointers.size === 1) {
      gesture = 'pending';
      const it = editing && !visit ? pickItem(ev.clientX, ev.clientY) : null;
      down = { x: ev.clientX, y: ev.clientY, it, angle: camState.angle };
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch0 = { d: Math.hypot(a.x - b.x, a.y - b.y), view: camState.view };
      gesture = 'pinch';
    }
  }
  function onMove(ev) {
    const p = pointers.get(ev.pointerId);
    if (!p) return;
    p.x = ev.clientX; p.y = ev.clientY;
    if (gesture === 'pinch' && pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      camState.view = Math.max(camState.minView, Math.min(camState.maxView, pinch0.view * pinch0.d / Math.max(20, d)));
      placeCamera();
      return;
    }
    if (gesture === 'pending' && Math.hypot(p.x - p.sx, p.y - p.sy) > 8) {
      if (down?.it && sel && down.it.uid === sel.uid) { gesture = 'drag'; sel.drag = { x: null, z: null, rot: null }; }
      else if (down?.it) { select(down.it); gesture = 'drag'; sel.drag = { x: null, z: null, rot: null }; }
      else gesture = 'orbit';
    }
    if (gesture === 'drag') dragTo(p.x, p.y);
    else if (gesture === 'orbit') {
      // giro suave (las paredes del fondo siempre quedan atrás)
      camState.angle = Math.max(Math.PI / 4 - 0.55, Math.min(Math.PI / 4 + 0.55, down.angle - (p.x - p.sx) * 0.006));
      placeCamera();
    }
  }
  function onUp(ev) {
    const p = pointers.get(ev.pointerId);
    pointers.delete(ev.pointerId);
    if (!p) return;
    if (gesture === 'drag') endDrag();
    else if (gesture === 'pending') onTap(p.x, p.y);
    if (!pointers.size) gesture = null;
  }
  function onWheel(ev) {
    ev.preventDefault();
    camState.view = Math.max(camState.minView, Math.min(camState.maxView, camState.view * Math.exp(Math.max(-200, Math.min(200, ev.deltaY)) * 0.0015)));
    placeCamera();
  }
  function onTap(cx, cy) {
    const it = pickItem(cx, cy);
    if (editing && !visit) { select(it); return; }
    if (it) {
      const f = FURNITURE_BY_ID[it.id];
      if (f?.wardrobe && !visit) { audio.sfx('pop'); ctx.router.go('wardrobe', { back: 'home' }); return; }
      if ((f?.sit || f?.bed) && player) { if (trySit(it)) audio.sfx('tap'); return; }
      audio.sfx('pop');
      ui.floatText(cx, cy - 30, `${icon('heart', 20)} ${ui.esc(f?.name || '')}`);
      return;
    }
    const pg = r.pickGround(cx, cy, 0);
    if (pg && player) {
      const [x, z] = worldToTile(pg);
      const [W, D] = size();
      if (x >= 0 && z >= 0 && x < W && z < D && goTo([x, z])) audio.sfx('tap');
    }
  }

  // ---------- UI ----------
  function refreshTitle() {
    const t = root.querySelector('.hm-title');
    if (!t) return;
    const lv = level(), def = homeLevelDef(lv);
    if (visit) { t.innerHTML = `<b>Casa de ${ui.esc(visit.name || 'tu amistad')}</b><small>${icon('home', 14)}${ui.esc(def.name)}</small>`; return; }
    const ci = comfortInfo();
    t.innerHTML = `<b>Mi Casa</b><small>${icon('home', 14)}${ui.esc(def.name)} · ${icon('heart', 14)}${E.fmtNum(ci.value)} Confort</small>`;
    t.title = `Confort: +${Math.round(ci.xpBonus * 100)}% de XP en partidas, +${Math.round(ci.loginBonus * 100)}% en el premio diario y +${ci.charm} de Encanto para la ciudad`;
  }
  const thumbs = new Map();
  function thumbEl(id) {
    const span = document.createElement('span');
    span.className = 'th';
    const url = thumbs.get(id);
    if (url) span.innerHTML = `<img src="${url}" alt="">`;
    else {
      span.innerHTML = icon('home', 34);
      objectThumbnail('furn:' + id, () => furnitureModel(id)).then(u => { if (!u) return; thumbs.set(id, u); if (span.isConnected) span.innerHTML = `<img src="${u}" alt="">`; });
    }
    return span;
  }
  function renderDeco() {
    const box = root.querySelector('.hm-deco');
    if (!box || visit) return;
    const tabs = [['mine', 'Mis muebles', 'home'], ['shop', 'Tienda', 'bag'], ['walls', 'Paredes', 'palette'], ['floors', 'Pisos', 'map']];
    const tb = box.querySelector('.hm-tabs');
    tb.innerHTML = '';
    for (const [id, label, ic] of tabs) {
      const b = ui.h('button.tab' + (tab === id ? '.active' : ''), { html: icon(ic, 16) + label, 'data-tab': id });
      b.onclick = () => { audio.sfx('select'); tab = id; renderDeco(); };
      tb.append(b);
    }
    const grid = box.querySelector('.hm-grid');
    grid.innerHTML = '';
    const h = homeState();
    if (tab === 'mine') {
      const own = FURNITURE.filter(f => (h.owned[f.id] || 0) > 0);
      if (!own.length) grid.append(ui.h('div.hm-empty', { html: `Todos tus muebles están puestos. Hay más en la <b>Tienda</b>.` }));
      for (const f of own) {
        const c = ui.h('button.hm-card', { 'data-id': f.id });
        c.append(thumbEl(f.id), ui.h('span.nm', {}, f.name), ui.h('span.pr', { html: `${icon('heart', 12)}+${f.comfort}` }), ui.h('i.ct', {}, String(h.owned[f.id])));
        c.onclick = () => putFromInventory(f.id);
        grid.append(c);
      }
    } else if (tab === 'shop') {
      for (const f of FURNITURE.filter(f => f.shop !== false)) {
        const can = canBuyFurniture(f.id);
        const c = ui.h('button.hm-card' + (can.locked ? '.locked' : ''), { 'data-id': f.id });
        c.append(thumbEl(f.id), ui.h('span.nm', {}, f.name), ui.h('span.pr', { html: can.locked ? `${icon('lock', 12)}${ui.esc(can.reason)}` : ui.costHtml(f.price, 12) }));
        c.onclick = () => {
          const res = buyFurniture(f.id);
          if (!res.ok) { audio.sfx('error'); ui.toast(res.poor ? 'No te alcanza todavía' : res.reason, { icon: res.locked ? 'lock' : 'coin' }); return; }
          audio.sfx('buy');
          putFromInventory(f.id);
        };
        grid.append(c);
      }
    } else {
      const list = tab === 'walls' ? WALLS : FLOORS;
      const cur = tab === 'walls' ? h.wall : h.floor;
      for (const o of list) {
        const c = ui.h('button.hm-card' + (o.id === cur ? '.on' : ''), { 'data-id': o.id });
        const bg = o.stripes ? `repeating-linear-gradient(90deg, ${o.a} 0 8px, ${o.b} 8px 14px)` : o.checker ? `repeating-conic-gradient(${o.a} 0 25%, ${o.b} 0 50%) 0 0 / 22px 22px` : `linear-gradient(${o.a}, ${o.b})`;
        c.append(ui.h('span.hm-sw', { style: { background: bg } }), ui.h('span.nm', {}, o.name));
        c.onclick = () => { audio.sfx('select'); (tab === 'walls' ? setWall : setFloor)(o.id); buildRoom(); renderDeco(); };
        grid.append(c);
      }
    }
  }
  function renderSel() {
    const el = root.querySelector('.hm-sel');
    const it = selItem();
    if (!el) return;
    el.innerHTML = '';
    if (!it) return;
    const f = FURNITURE_BY_ID[it.id];
    el.append(ui.h('b', {}, f?.name || ''),
      ui.h('button.btn.second', { html: icon('rotate', 18) + (f?.wall ? 'Otra pared' : 'Rotar'), onclick: rotateSel }),
      ui.h('button.btn.ghost', { html: icon('bag', 18) + 'Guardar', onclick: storeSel }),
      ui.h('button.btn.mint', { html: icon('check', 18) + 'Listo', onclick: () => { audio.sfx('tap'); select(null); } }));
  }
  function setEditing(on) {
    editing = on && !visit;
    root.classList.toggle('editing', editing);
    const b = root.querySelector('[data-hm="deco"]');
    if (b) b.innerHTML = editing ? `${icon('check', 20)}Listo` : `${icon('palette', 20)}Decorar`;
    if (!editing) select(null);
    else { tab = homeState().items.length && Object.values(homeState().owned).some(n => n > 0) ? 'mine' : tab; renderDeco(); }
    hint(editing ? 'Hacé clic en un mueble para elegirlo y arrastralo' : null);
    setTimeout(() => { if (r) placeCamera(); }, 300);   // cuando el panel terminó de entrar o salir
  }
  let hintT = 0;
  function hint(txt) {
    const el = root.querySelector('.hm-hint');
    if (!el) return;
    clearTimeout(hintT);
    if (!txt) { el.classList.add('gone'); return; }
    el.textContent = txt; el.classList.remove('gone');
    hintT = setTimeout(() => el.classList.add('gone'), 4500);
  }
  function openUpgrade() {
    const b = store.state.city.buildings.find(o => o.id === 'mi_casa');
    if (!b) return;
    const now = Date.now();
    const body = ui.h('div.hm-up', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } });
    const cur = homeLevelDef(b.level);
    body.append(ui.h('p', { style: { margin: 0 }, html: `Ahora: <b>${ui.esc(cur.name)}</b> (${cur.size.join('×')})` }));
    let actions = [{ label: 'Cerrar', cls: 'ghost' }];
    if (E.isUpgrading(b, now)) {
      body.append(ui.h('p', { style: { margin: 0 }, html: `${icon('hammer', 18)} Ampliando: falta <b>${E.fmtTime(E.remainingMs(b, now) / 1000)}</b>` }));
    } else if (b.level >= HOME_LEVELS.length) {
      body.append(ui.h('p', { style: { margin: 0 }, html: `${icon('trophy', 18)} Tu casa ya es la más grande` }));
    } else {
      const nx = HOME_LEVELS[b.level];
      const info = E.upgradeInfo(b);
      const can = E.canUpgrade(b);
      body.append(ui.h('p', { style: { margin: 0 }, html: `Próxima: <b>${ui.esc(nx.name)}</b> (${nx.size.join('×')}) · ${icon('sparkle', 14)} ${ui.esc(nx.look || '')}` }),
        ui.h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', fontSize: '18px' }, html: `<span class="cost">${ui.costHtml(info.cost, 20)}</span><span class="muted">${icon('clock', 14)} ${E.fmtTime(info.time)}</span>` }));
      if (!can.ok) body.append(ui.h('div.req', { html: `${icon(can.mats ? 'monument' : can.poor ? 'coin' : 'lock', 14)}${ui.esc(can.mats ? 'Faltan materiales: se ganan jugando.' : can.poor ? 'Te faltan monedas' : can.rank ? `Necesitás el rango ${E.rankName(can.rank)}` : can.reason)}` }));
      actions = [{ label: 'Más tarde', cls: 'ghost' }, { label: 'Ampliar', cls: 'primary', html: `${icon('up', 18)} Ampliar`, value: 'up' }];
      const m = ui.modal({ title: 'Ampliar la casa', icon: 'home', content: body, className: 'hm-up-modal',
        actions: actions.map(a => ({ ...a, onClick: () => {
          if (a.value !== 'up') return;
          const c = E.canUpgrade(b);
          if (!c.ok) { audio.sfx('error'); ui.toast(c.mats ? 'Te faltan materiales: salen jugando.' : c.poor ? 'No te alcanza todavía' : c.reason, { icon: 'info' }); return false; }
          const res = E.startUpgrade(b.uid);
          if (res?.error) { audio.sfx('error'); ui.toast(res.error); return false; }
          audio.sfx('build');
          ui.toast(`Empezó la obra. En ${E.fmtTime(info.time)} tu casa crece`, { icon: 'hammer', type: 'good' });
        } })) });
      return m;
    }
    return ui.modal({ title: 'Ampliar la casa', icon: 'home', content: body, className: 'hm-up-modal', actions });
  }

  function buildDom(container) {
    root = container;
    root.innerHTML = `
      <div class="hm-stage"></div>
      <div class="hm-top">
        <button class="icon-btn hm-back" aria-label="Volver">${icon('back', 22)}</button>
        <div class="hm-title"></div>
        <span class="hm-grow"></span>
        <div class="hm-btns">
          ${visit ? '' : `<button class="btn primary" data-hm="deco">${icon('palette', 20)}Decorar</button>
          <button class="btn second" data-hm="up">${icon('up', 20)}Ampliar</button>`}
        </div>
      </div>
      <div class="hm-hint gone"></div>
      <div class="hm-sel"></div>
      <div class="hm-deco"><div class="tabs hm-tabs"></div><div class="hm-grid"></div></div>`;
    root.querySelector('.hm-back').onclick = () => {
      audio.sfx('close');
      if (visit) ctx.router.go('city', { visit: params.visit }); else ctx.router.go('city');
    };
    root.querySelector('[data-hm="deco"]')?.addEventListener('click', () => { audio.sfx('tap'); setEditing(!editing); });
    root.querySelector('[data-hm="up"]')?.addEventListener('click', () => { audio.sfx('tap'); openUpgrade(); });
  }

  async function loadVisit(id) {
    let prof = null;
    try {
      const res = await ctx.net.getProfiles([id]);
      prof = Array.isArray(res) ? res.find(x => x && x.id === id) || null : null;
    } catch (e) { console.warn('[home] perfil', e); }
    const city = prof?.city || {};
    const lv = (city.buildings || []).find(b => b.id === 'mi_casa')?.level || 1;
    return { name: prof?.name || params.name, look: prof?.look, level: lv, home: city.home || { wall: 'crema', floor: 'madera', items: [] } };
  }

  return {
    hud: false,
    music: 'calm',
    async mount(container, p = {}) {
      params = p || {};
      alive = true;
      styleEl = document.createElement('style');
      styleEl.id = 'home-style';
      styleEl.textContent = HM_CSS;
      document.head.append(styleEl);
      if (params.visit) {
        visit = await loadVisit(params.visit);
        if (!alive) return;
      }
      buildDom(container);
      const stage = root.querySelector('.hm-stage');
      r = createPixelRenderer(stage, { ortho: true, viewSize: 10, background: 0xf6eee2, outline: true, idleFps: 30 });
      const { sun } = addLights(r.scene, { shadowSize: 12, shadowRes: 1024 });
      sun.position.set(9, 15, 11);   // la luz entra desde adelante: las dos paredes del fondo quedan iluminadas
      buildRoom(); buildItems(); buildPlayer(); fitView(); refreshTitle();
      r.onFrame((dt) => {
        updatePlayer(dt);
        for (const g of itemObjs.values()) g.children[0]?.userData.update?.(dt, performance.now() / 1000);
      });
      r.start();
      // para las pruebas (tools/test-home.mjs): dónde cae en pantalla un mueble o una baldosa
      container.__home = {
        itemScreen(uid) { const it = items().find(i => i.uid === uid); if (!it || !r) return null; const p = itemWorld(it); p.y += FURNITURE_BY_ID[it.id]?.wall ? 1.8 : 0.3; return r.toScreen(p); },
        tileScreen(x, z) { return r ? r.toScreen(tileCenter(x, z)) : null; },
        get debug() { return { items: items(), sel: sel?.uid ?? null, editing, size: size(), level: level(), player: player && { tile: player.tile, sit: !!player.sit }, visit: !!visit, title: root?.querySelector('.hm-title')?.textContent || '' }; },
      };
      stage.addEventListener('pointerdown', onDown);
      stage.addEventListener('pointermove', onMove);
      stage.addEventListener('pointerup', onUp);
      stage.addEventListener('pointercancel', onUp);
      stage.addEventListener('wheel', onWheel, { passive: false });
      const onResize = () => fitView();
      addEventListener('resize', onResize);
      offs.push(() => removeEventListener('resize', onResize));
      if (!visit) {
        offs.push(bus.on('home:changed', () => { refreshTitle(); if (editing) renderDeco(); }));
        offs.push(bus.on('currency:changed', () => { if (editing && tab === 'shop') renderDeco(); }));
        offs.push(bus.on('building:upgraded', ({ b } = {}) => {
          if (b?.id !== 'mi_casa') return;
          buildRoom(); buildItems(); settlePlayer(); fitView(); refreshTitle();
          ui.toast(`Tu casa creció: ahora es ${homeLevelDef(b.level).name}`, { icon: 'home', type: 'good' });
        }));
        hint(params.decorate ? null : 'Hacé clic en el ropero para vestirte · Decorar para mover muebles');
        if (params.decorate) setEditing(true);
      } else hint('Estás de visita: se mira, no se toca.');
      ctx.state.tutorial && (ctx.state.tutorial.homeVisited = true);
    },
    unmount() {
      alive = false;
      clearTimeout(hintT);
      for (const off of offs.splice(0)) { try { off(); } catch {} }
      clearMarkers();
      okMat.dispose(); badMat.dispose();
      if (r) { r.stop(); r.dispose(); r = null; }
      itemObjs.clear(); player = null; roomObj = null;
      styleEl?.remove(); styleEl = null;
      root?.replaceChildren(); root = null;
    },
  };
}
