// Escena principal: la ciudad isométrica en 3D pixel art.
// Mundo + edificios + vida + cámara + construir/mover + cobrar + tutorial suave.
import * as THREE from 'three';
import { createPixelRenderer, addLights } from '../core/voxel.js';
import { buildingModel, constructionModel } from '../city/models.js';
import { icon } from '../core/icons.js';
import { MAP, HALF, ROAD_H, footCenter, clamp, easeOutElastic, makeGhost } from './city-common.js';
import { createWorld } from './city-world.js';
import { createCameraCtl } from './city-camera.js';
import { createLife } from './city-life.js';
import { createParticles, createOverlays } from './city-fx.js';
import { STYLE, openBuildMenu, openInfo, openExpand, makePlaceBar, questBuildIds } from './city-ui.js';

const TAP_PX = 8;

/** Crea un modelo sin que un error de un modelo rompa la ciudad entera. */
function safe(fn, fallbackSize = [2, 2]) {
  try { const g = fn(); if (g && g.isObject3D) return g; } catch (err) { console.warn('[city] modelo con error', err); }
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.BoxGeometry(fallbackSize[0] * 0.8, 0.6, fallbackSize[1] * 0.8), new THREE.MeshLambertMaterial({ color: 0xffc2dc }));
  m.position.y = 0.3; m.castShadow = true; m.receiveShadow = true;
  g.add(m); g.userData.height = 0.6;
  return g;
}

function easeOutBounce(t) {
  const n = 7.5625, d = 2.75;
  if (t < 1 / d) return n * t * t;
  if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
  if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
  return n * (t -= 2.625 / d) * t + 0.984375;
}

export default function create(ctx) {
  const { store, bus, ui, audio, economy: E } = ctx;
  let container, r, cam, world, life, fx, ov, styleEl, bGroup, placeBar, sideEl, collectBtn, tipEl, ro;
  const entries = new Map();
  const offs = [];
  const myModals = new Set();
  let placing = null;
  let syncAcc = 0, disposed = false, batchCollect = false;
  let okMat, badMat, tileGeo, tileTex;
  const raycaster = new THREE.Raycaster();
  const tmpV = new THREE.Vector3();
  let hoverPos = null, hoverDirty = false;
  let gameTip = null, signItems = [], collectTip = null, worldTip = null;
  const modelOpts = () => ({ flagColor: ctx.state.city.flagColor });
  const T = () => ctx.state.tutorial;
  function setFlag(k) { if (!T()[k]) { T()[k] = true; store.markDirty(); } }

  // API compartida con city-ui
  const S = {
    ctx,
    lastPointer: null,
    trackModal(m) { myModals.add(m); },
    untrackModal(m) { myModals.delete(m); },
    startPlacement: (id) => startPlacement(id),
    startMove: (uid) => startMove(uid),
    rotateBuilding: (uid) => rotateBuilding(uid),
    removeBuilding: (uid) => { if (E.removeBuilding(uid)) audio.sfx('swoosh'); },
    collect: (uid) => E.collect(uid),
    doExpand,
  };

  // =====================================================================
  // Edificios
  // =====================================================================
  function topPos(e, extra = 0.15) {
    return tmpV.set(e.root.position.x, (e.height || 1) + extra, e.root.position.z);
  }
  function createEntry(b, anim = null) {
    const root = new THREE.Group();
    root.userData.uid = b.uid;
    bGroup.add(root);
    const e = { b, root, model: null, scaffold: null, mode: null, level: 0, rot: -1, anim: anim ? { type: anim, t: 0 } : null, timer: null, bubble: null, height: 1, placedAt: 0 };
    entries.set(b.uid, e);
    refreshEntry(e);
    return e;
  }
  function refreshEntry(e, force = false) {
    const b = e.b, now = Date.now();
    const mode = E.isConstructing(b, now) ? 'build' : E.isUpgrading(b, now) ? 'upgrade' : 'done';
    const c = footCenter(b.id, b.x, b.z, b.rot);
    e.root.position.x = c.x; e.root.position.z = c.z;
    if (!force && mode === e.mode && b.level === e.level && b.rot === e.rot) return false;
    if (e.model) { e.root.remove(e.model); e.model = null; }
    if (e.scaffold) { e.root.remove(e.scaffold); e.scaffold = null; }
    if (mode === 'build') {
      e.scaffold = safe(() => constructionModel(c.w, c.d), [c.w, c.d]);
      e.root.add(e.scaffold);
      e.height = e.scaffold.userData.height || 0.8;
    } else {
      e.model = safe(() => buildingModel(b.id, b.level, modelOpts()), [c.w, c.d]);
      e.model.rotation.y = b.rot * Math.PI / 2;
      e.root.add(e.model);
      e.height = e.model.userData.height || 1;
      if (mode === 'upgrade') {
        e.scaffold = safe(() => constructionModel(c.w, c.d), [c.w, c.d]);
        e.root.add(e.scaffold);
        e.height = Math.max(e.height, e.scaffold.userData.height || 0.8);
      }
    }
    e.mode = mode; e.level = b.level; e.rot = b.rot;
    if (e.timer) e.timer.pos.copy(topPos(e, 0.1));
    if (e.bubble) e.bubble.pos.copy(topPos(e, 0.2));
    return true;
  }
  function removeEntry(uid) {
    const e = entries.get(uid);
    if (!e) return;
    bGroup.remove(e.root);
    ov.remove(e.timer); ov.remove(e.bubble);
    entries.delete(uid);
  }

  function ensureTimer(e) {
    if (e.timer) return e.timer;
    const el = ui.h('div.cx-timer', { html: `${icon('hammer', 18)}<span><b></b><i><u></u></i></span>` });
    e.timer = ov.add(el, topPos(e, 0.1));
    e.timer.b = el.querySelector('b'); e.timer.u = el.querySelector('u');
    return e.timer;
  }
  function ensureBubble(e, ps) {
    const cls = 'cx-bubble' + (ps.currency === 'gems' ? ' gem' : '') + (ps.full ? ' full' : '');
    if (e.bubble) { if (e.bubble.el.className !== cls) e.bubble.el.className = cls; return; }
    const el = ui.h('div', { class: cls, html: `<div class="cx-bb">${icon(ps.currency === 'gems' ? 'gem' : 'coin', 24)}</div>` });
    el.className = cls;
    e.bubble = ov.add(el, topPos(e, 0.2));
    e.bubble.uid = e.b.uid;
    audio.sfx('pop');
  }
  function removeBubble(e, animate = false) {
    if (!e.bubble) return;
    const it = e.bubble;
    e.bubble = null;
    if (animate) { it.el.classList.add('pop'); it.hit = false; setTimeout(() => ov.remove(it), 260); }
    else ov.remove(it);
  }

  function syncStatus() {
    const now = Date.now();
    let ready = 0;
    for (const e of entries.values()) {
      if (refreshEntry(e)) life.refreshGrid();
      const b = e.b;
      const busy = E.isBusy(b, now);
      const hidden = !!placing;
      if (busy && !hidden) {
        const t = ensureTimer(e);
        const total = (E.isConstructing(b, now) ? E.def(b).time : (E.upgradeInfo(b)?.time || 1)) * 1000;
        const rem = E.remainingMs(b, now);
        const txt = E.fmtTime(rem / 1000);
        if (t.b.textContent !== txt) t.b.textContent = txt;
        t.u.style.width = clamp((1 - rem / Math.max(1, total)) * 100, 0, 100).toFixed(1) + '%';
        t.el.classList.toggle('up', E.isUpgrading(b, now));
      } else if (e.timer) { ov.remove(e.timer); e.timer = null; }
      const ps = E.producerStatus(b, now);
      if (ps.producer && ps.ready && !busy && !hidden) { ensureBubble(e, ps); ready++; }
      else removeBubble(e);
    }
    for (const it of signItems) it.hidden = !!placing;
    if (collectBtn) {
      collectBtn.style.display = ready >= 3 && !placing ? '' : 'none';
      const bd = collectBtn.querySelector('.badge');
      if (bd && bd.textContent !== String(ready)) bd.textContent = ready;
    }
    updateTutorial();
  }

  function animateEntry(e, dt) {
    const a = e.anim;
    a.t += dt;
    const R = e.root;
    let done = false;
    if (a.type === 'drop') {
      const k = Math.min(1, a.t / 0.55);
      R.position.y = (1 - easeOutBounce(k)) * 1.4;
      const sq = k > 0.35 ? Math.sin((k - 0.35) / 0.65 * Math.PI) * 0.12 * (1 - k) * 3 : 0;
      R.scale.set(1 + sq * 0.5, 1 - sq, 1 + sq * 0.5);
      done = k >= 1;
    } else if (a.type === 'pop') {
      const k = Math.min(1, a.t / 0.9);
      const s = 0.35 + 0.65 * easeOutElastic(k);
      R.scale.set(s, s * (1 + 0.12 * Math.sin(k * Math.PI)), s);
      done = k >= 1;
    } else if (a.type === 'squish') {
      const k = Math.min(1, a.t / 0.28);
      const s = Math.sin(k * Math.PI);
      R.scale.set(1 + s * 0.06, 1 - s * 0.1, 1 + s * 0.06);
      done = k >= 1;
    } else if (a.type === 'hop') {
      const k = Math.min(1, a.t / 0.35);
      R.position.y = Math.sin(k * Math.PI) * 0.35;
      done = k >= 1;
    } else done = true;
    if (done) { R.position.y = 0; R.scale.set(1, 1, 1); e.anim = null; }
  }

  // =====================================================================
  // Colocación / mover
  // =====================================================================
  const paintable = (id) => { const d = E.def(id); return (d.cat === 'camino' || d.cat === 'deco') && d.size[0] === 1 && d.size[1] === 1; };

  function landClampCorner(id, x, z, rot) {
    const [w, d] = E.footprint(id, rot);
    const L = E.landBounds();
    return [clamp(x, L.min, L.max - w), clamp(z, L.min, L.max - d)];
  }
  function cornerFromWorld(id, rot, wx, wz) {
    const [w, d] = E.footprint(id, rot);
    return landClampCorner(id, Math.round(wx + HALF - w / 2), Math.round(wz + HALF - d / 2), rot);
  }
  function chainVisible(o) { for (; o; o = o.parent) if (!o.visible) return false; return true; }
  /** ¿Hay un edificio tapando este punto del piso desde la cámara? */
  function occluded(wx, wz) {
    tmpV.set(wx, 0.05, wz);
    const from = tmpV.clone();
    const dir = new THREE.Vector3();
    r.camera.getWorldDirection(dir);
    raycaster.set(from.addScaledVector(dir, -80), dir);
    const hits = raycaster.intersectObjects(bGroup.children, true);
    const dGround = 80;
    return hits.some(h => h.distance < dGround - 0.3 && chainVisible(h.object));
  }
  function findFreeSpot(id, rot, ignoreUid = null) {
    const W = r.canvas.clientWidth || innerWidth, H = r.canvas.clientHeight || innerHeight;
    const tx = W / 2, ty = H * 0.56;
    const p = r.pickGround(tx, ty) || new THREE.Vector3();
    const [cx, cz] = cornerFromWorld(id, rot, p.x, p.z);
    const [w, d] = E.footprint(id, rot);
    let best = null, bestScore = Infinity;
    const L = E.landBounds();
    for (let x = L.min; x <= L.max - w; x++) for (let z = L.min; z <= L.max - d; z++) {
      if (Math.abs(x - cx) > 12 || Math.abs(z - cz) > 12) continue;
      if (!E.canPlace(id, x, z, rot, ignoreUid).ok) continue;
      const fc = footCenter(id, x, z, rot);
      const sp = ov.project(tmpV.set(fc.x, 0, fc.z), {});
      const score = Math.hypot(sp.x - tx, sp.y - ty);
      if (score < bestScore + 160) {
        const occ = occluded(fc.x, fc.z) || occluded(fc.x - w / 2 + 0.5, fc.z - d / 2 + 0.5) || occluded(fc.x + w / 2 - 0.5, fc.z - d / 2 + 0.5);
        const sc = score + (occ ? 160 : 0);
        if (sc < bestScore) { bestScore = sc; best = [x, z]; }
      }
    }
    return best;
  }
  function startPlacement(id) {
    endPlacement(true);
    const can = E.canBuild(id);
    if (!can.ok) { audio.sfx('error'); ui.toast(can.reason, { icon: 'info' }); return; }
    const spot = findFreeSpot(id, 0);
    if (!spot) { audio.sfx('error'); ui.toast('¡No queda lugar libre! Expandí tu terreno', { icon: 'map' }); return; }
    beginPlacing({ mode: 'new', id, rot: 0, x: spot[0], z: spot[1], level: 1, uid: null });
  }
  function startMove(uid) {
    endPlacement(true);
    const e = entries.get(uid);
    if (!e) return;
    const b = e.b;
    e.root.visible = false;
    removeBubble(e); if (e.timer) { ov.remove(e.timer); e.timer = null; }
    beginPlacing({ mode: 'move', id: b.id, rot: b.rot, x: b.x, z: b.z, level: E.isConstructing(b) ? 1 : b.level, uid });
  }
  function beginPlacing(p) {
    const movingB = p.uid != null ? entries.get(p.uid)?.b : null;
    const isCon = !!movingB && E.isConstructing(movingB);
    const fp = E.footprint(p.id, 0);
    const model = isCon ? safe(() => constructionModel(...fp), fp) : safe(() => buildingModel(p.id, p.level, modelOpts()), fp);
    const mats = makeGhost(model, 0.62);
    const root = new THREE.Group();
    root.add(model);
    r.scene.add(root);
    placing = { ...p, ghost: root, model, mats, tiles: [], valid: false, reason: '', paint: false, count: 0, lastPaint: null, t: 0, isConstructionGhost: isCon };
    world.showGrid(true);
    ctx.hud.hide();
    sideEl.classList.add('hide');
    placing.pin = ov.add(ui.h('div.cx-pin', { html: icon('👇', 36) }), new THREE.Vector3());
    placeBar = makePlaceBar(S, { onCancel: () => endPlacement(), onRotate: rotatePlacing, onConfirm: confirmPlacement });
    container.append(placeBar.el);
    updateGhost();
    if (!T().place) setTimeout(() => setFlag('place'), 4000);
  }
  function endPlacement(silent = false) {
    if (!placing) return;
    const p = placing;
    placing = null;
    r.scene.remove(p.ghost);
    for (const m of p.mats) m.dispose();
    for (const t of p.tiles) r.scene.remove(t);
    ov.remove(p.pin);
    if (p.uid != null) { const e = entries.get(p.uid); if (e) { e.root.visible = true; } }
    world.showGrid(false);
    placeBar?.el.remove(); placeBar = null;
    ctx.hud.show();
    sideEl.classList.remove('hide');
    if (!silent) audio.sfx('close');
    syncStatus();
  }
  function rotatePlacing() {
    if (!placing) return;
    audio.sfx('swoosh');
    placing.rot = (placing.rot + 1) % 4;
    const [x, z] = landClampCorner(placing.id, placing.x, placing.z, placing.rot);
    placing.x = x; placing.z = z;
    placing.t = 0;
    updateGhost();
  }
  function moveGhostTo(x, z) {
    if (!placing) return;
    [x, z] = landClampCorner(placing.id, x, z, placing.rot);
    if (x === placing.x && z === placing.z) return false;
    placing.x = x; placing.z = z;
    audio.sfx('tap');
    updateGhost();
    return true;
  }
  function updateGhost() {
    const p = placing;
    if (!p) return;
    const [w, d] = E.footprint(p.id, p.rot);
    const c = footCenter(p.id, p.x, p.z, p.rot);
    p.ghost.position.set(c.x, 0, c.z);
    p.model.rotation.y = p.rot * Math.PI / 2;
    if (p.pin) { p.pin.pos.set(c.x, (p.model.userData.height || 0.6) + 0.35, c.z); p.pin.el.classList.toggle('bad', false); }
    let res = E.canPlace(p.id, p.x, p.z, p.rot, p.uid);
    if (res.ok && p.mode === 'new') { const cb = E.canBuild(p.id); if (!cb.ok) res = cb; }
    p.valid = res.ok; p.reason = res.reason || '';
    // baldosas del footprint
    while (p.tiles.length < w * d) { const m = new THREE.Mesh(tileGeo, okMat); m.rotation.x = -Math.PI / 2; m.renderOrder = 6; r.scene.add(m); p.tiles.push(m); }
    while (p.tiles.length > w * d) r.scene.remove(p.tiles.pop());
    const L = E.landBounds();
    let i = 0;
    for (let dx = 0; dx < w; dx++) for (let dz = 0; dz < d; dz++) {
      const x = p.x + dx, z = p.z + dz;
      const other = ctx.state.city.buildings.find(b => b.uid !== p.uid && (() => { const [bw, bd] = E.footprint(b.id, b.rot); return x >= b.x && x < b.x + bw && z >= b.z && z < b.z + bd; })());
      const free = !other && x >= L.min && x < L.max && z >= L.min && z < L.max;
      const m = p.tiles[i++];
      m.material = free && p.valid ? okMat : free && !p.valid && p.reason !== 'Hay algo ahí' && p.reason !== 'Fuera del terreno' ? badMat : free ? okMat : badMat;
      m.position.set(x + 0.5 - HALF, other && E.def(other).cat === 'camino' ? ROAD_H + 0.02 : 0.03, z + 0.5 - HALF);
    }
    if (p.pin) p.pin.el.classList.toggle('bad', !p.valid);
    placeBar?.update(p);
  }
  function confirmPlacement() {
    const p = placing;
    if (!p) return;
    if (!p.valid) { audio.sfx('error'); shakeGhost(); ui.toast(p.reason || 'No se puede ahí', { icon: 'info' }); return; }
    if (p.mode === 'new') {
      const res = E.placeBuilding(p.id, p.x, p.z, p.rot);
      if (res.error) { audio.sfx('error'); ui.toast(res.error, { icon: 'info' }); updateGhost(); return; }
      audio.sfx('place');
      if (E.def(p.id).time > 0) setTimeout(() => audio.sfx('build'), 160);
      setFlag('place');
      if (paintable(p.id)) {
        p.paint = true; p.count++;
        const cb = E.canBuild(p.id);
        if (!cb.ok) { ui.toast(cb.poor ? '¡Se terminaron las monedas para más!' : cb.reason, { icon: 'coin' }); endPlacement(true); return; }
        updateGhost();
      } else endPlacement(true);
    } else {
      const e = entries.get(p.uid);
      const res = E.moveBuilding(p.uid, p.x, p.z, p.rot);
      if (res.error) { audio.sfx('error'); ui.toast(res.error, { icon: 'info' }); return; }
      audio.sfx('place');
      endPlacement(true);
      if (e) e.anim = { type: 'drop', t: 0 };
    }
  }
  function shakeGhost() { if (placing) placing.shake = 0.35; }
  function pointerOnGhost(cx, cy) {
    if (!placing) return false;
    const p = r.pickGround(cx, cy);
    if (p) {
      const [w, d] = E.footprint(placing.id, placing.rot);
      const x = p.x + HALF, z = p.z + HALF, m = w * d === 1 ? 0.6 : 0.25;
      if (x >= placing.x - m && x <= placing.x + w + m && z >= placing.z - m && z <= placing.z + d + m) return true;
    }
    raycaster.setFromCamera(r.toNDC(cx, cy), r.camera);
    return raycaster.intersectObject(placing.ghost, true).length > 0;
  }
  let ghostDrag = null;
  function beginGhostDrag(cx, cy) {
    const p = r.pickGround(cx, cy);
    if (!p || !placing) return;
    const c = footCenter(placing.id, placing.x, placing.z, placing.rot);
    ghostDrag = { ox: c.x - p.x, oz: c.z - p.z };
    if (placing.paint) paintAtScreen(cx, cy, true);
  }
  function moveGhostDrag(cx, cy) {
    if (!placing || !ghostDrag) return;
    if (placing.paint) { paintAtScreen(cx, cy); return; }
    const p = r.pickGround(cx, cy);
    if (!p) return;
    const [x, z] = cornerFromWorld(placing.id, placing.rot, p.x + ghostDrag.ox, p.z + ghostDrag.oz);
    moveGhostTo(x, z);
  }
  function paintAtScreen(cx, cy, first = false) {
    const p = r.pickGround(cx, cy);
    if (!p || !placing) return;
    const x = Math.floor(p.x + HALF), z = Math.floor(p.z + HALF);
    const key = x + ',' + z;
    if (!first && placing.lastPaint === key) return;
    placing.lastPaint = key;
    moveGhostTo(x, z);
    if (placing.valid) confirmPlacement();
  }
  function hoverGhost(cx, cy) {
    const p = r.pickGround(cx, cy);
    if (!p || !placing) return;
    if (placing.paint) moveGhostTo(Math.floor(p.x + HALF), Math.floor(p.z + HALF));
    else { const [x, z] = cornerFromWorld(placing.id, placing.rot, p.x, p.z); moveGhostTo(x, z); }
  }

  function rotateBuilding(uid) {
    const e = entries.get(uid);
    if (!e) return;
    const b = e.b;
    const res = E.moveBuilding(uid, b.x, b.z, (b.rot + 1) % 4);
    if (res.error) { audio.sfx('error'); ui.toast('No hay lugar para rotarlo ahí', { icon: 'info' }); return; }
    audio.sfx('swoosh');
  }

  function doExpand() {
    const ex = E.expansionInfo();
    if (!ex) { ui.toast('¡Tu terreno ya está al máximo!', { icon: 'map' }); return false; }
    if (ctx.state.player.level < ex.reqLevel) { audio.sfx('error'); ui.toast(`Se desbloquea en nivel ${ex.reqLevel}`, { icon: 'lock' }); return false; }
    if (!store.canAfford(ex.cost)) { audio.sfx('error'); ui.toast('No te alcanza todavía', { icon: 'coin' }); return false; }
    const res = E.expand();
    if (res.error) { audio.sfx('error'); ui.toast(res.error); return false; }
    return true;
  }

  // =====================================================================
  // Toques
  // =====================================================================
  function screenOf(v3) { return ov.project(v3, {}); }
  function hitBubble(x, y) {
    const k = ov.scale;
    let best = null, bd = (36 * k) ** 2;
    for (const e of entries.values()) {
      const it = e.bubble;
      if (!it || !it.onScreen) continue;
      const dx = it.sx - x, dy = (it.sy - 32 * k) - y, dd = dx * dx + dy * dy;
      if (dd < bd) { bd = dd; best = e; }
    }
    return best;
  }
  function hitSign(x, y) {
    for (const it of signItems) {
      if (!it.onScreen) continue;
      const dx = it.sx - x, dy = it.sy - 16 - y;
      if (it.label && Math.abs(dx) < 56 && Math.abs(dy) < 30) return true;
      const dy2 = it.sy + 30 - y;
      if (Math.abs(dx) < 26 && Math.abs(dy2) < 30) return true;
    }
    return false;
  }
  function hitWalker(w, x, y, rad) {
    if (!w || !w.obj.visible) return false;
    const s = screenOf(tmpV.copy(w.obj.position).setY(w.obj.position.y + 0.35));
    return (s.x - x) ** 2 + (s.y - y) ** 2 < rad * rad;
  }
  function raycastBuilding(x, y) {
    raycaster.setFromCamera(r.toNDC(x, y), r.camera);
    raycaster.camera = r.camera;
    const hits = raycaster.intersectObjects(bGroup.children, true);
    for (const h of hits) {
      let o = h.object;
      while (o && o.userData.uid == null) o = o.parent;
      if (o && chainVisible(o)) return o.userData.uid;
    }
    const p = r.pickGround(x, y);
    if (p) { const b = E.buildingAt(Math.floor(p.x + HALF), Math.floor(p.z + HALF)); if (b) return b.uid; }
    return null;
  }
  function onTap(x, y, type) {
    if (placing) {
      if (type === 'mouse') {
        hoverGhost(x, y);
        confirmPlacement();
      } else if (placing.paint) {
        const p = r.pickGround(x, y);
        if (p) { moveGhostTo(Math.floor(p.x + HALF), Math.floor(p.z + HALF)); if (placing.valid) confirmPlacement(); }
      } else {
        const p = r.pickGround(x, y);
        if (p) { const [cx, cz] = cornerFromWorld(placing.id, placing.rot, p.x, p.z); moveGhostTo(cx, cz); }
      }
      return;
    }
    const be = hitBubble(x, y);
    if (be) { E.collect(be.b.uid); return; }
    if (hitSign(x, y)) { audio.sfx('tap'); openExpand(S); return; }
    if (hitWalker(life.player, x, y, 30)) {
      audio.sfx('pop');
      ui.floatText(x, y - 30, icon('heart', 26));
      setTimeout(() => ctx.router.go('wardrobe'), 260);
      return;
    }
    for (const w of life.npcs) if (hitWalker(w, x, y, 22)) {
      audio.sfx('pop');
      ui.floatText(x, y - 26, icon('heart', 22));
      w.idle = 1.6; w.t = 1; w.tx = w.fx; w.tz = w.fz;
      return;
    }
    if (life.car && life.car.obj.visible && hitWalker(life.car, x, y, 26)) { audio.sfx('horn'); return; }
    const uid = raycastBuilding(x, y);
    if (uid != null) { tapBuilding(uid); return; }
  }
  function tapBuilding(uid) {
    const e = entries.get(uid);
    if (!e) return;
    const ps = E.producerStatus(e.b);
    if (ps.ready) { E.collect(uid); return; }
    audio.sfx('tap');
    e.anim = { type: 'squish', t: 0 };
    const d = E.def(e.b);
    if (d.game) { setFlag('game_' + d.game); if (gameTip?.uid === uid) clearGameTip(); }
    openInfo(S, uid);
  }

  // ----- Pointer events -----
  const pointers = new Map();
  let gesture = null, down = null;
  function onDown(ev) {
    if (ev.button !== undefined && ev.button > 0 && ev.pointerType === 'mouse') { if (ev.button === 2 && placing) endPlacement(); return; }
    S.lastPointer = ev.pointerType === 'mouse' ? 'mouse' : 'touch';
    try { r.canvas.setPointerCapture(ev.pointerId); } catch {}
    pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY, sx: ev.clientX, sy: ev.clientY });
    if (pointers.size === 1) {
      gesture = 'pending';
      down = { x: ev.clientX, y: ev.clientY, onGhost: pointerOnGhost(ev.clientX, ev.clientY), type: ev.pointerType };
      cam.stop();
    } else if (pointers.size === 2) {
      if (gesture === 'pan') cam.endGrab();
      ghostDrag = null;
      const [a, b] = [...pointers.values()];
      gesture = 'pinch';
      cam.beginPinch(a, b);
    }
  }
  function onMove(ev) {
    const p = pointers.get(ev.pointerId);
    if (!p) {
      if (ev.pointerType === 'mouse') {
        S.lastPointer = 'mouse';
        if (placing) hoverGhost(ev.clientX, ev.clientY);
        else { hoverPos = { x: ev.clientX, y: ev.clientY }; hoverDirty = true; }
      }
      return;
    }
    p.x = ev.clientX; p.y = ev.clientY;
    if (gesture === 'pinch') {
      if (pointers.size >= 2) { const [a, b] = [...pointers.values()]; cam.movePinch(a, b); }
    } else if (gesture === 'pending') {
      if (Math.hypot(p.x - p.sx, p.y - p.sy) > TAP_PX) {
        if (down?.onGhost) { gesture = 'ghost'; beginGhostDrag(p.sx, p.sy); moveGhostDrag(p.x, p.y); }
        else { gesture = 'pan'; cam.beginGrab(p.sx, p.sy); cam.moveGrab(p.x, p.y); r.canvas.style.cursor = 'grabbing'; }
      }
    } else if (gesture === 'pan') cam.moveGrab(p.x, p.y);
    else if (gesture === 'ghost') moveGhostDrag(p.x, p.y);
  }
  function onUp(ev) {
    const p = pointers.get(ev.pointerId);
    if (!p) return;
    pointers.delete(ev.pointerId);
    try { r.canvas.releasePointerCapture(ev.pointerId); } catch {}
    if (gesture === 'pinch') {
      cam.endPinch();
      if (pointers.size === 1) { const [q] = [...pointers.values()]; gesture = 'pan'; cam.beginGrab(q.x, q.y); }
      else if (!pointers.size) gesture = null;
      return;
    }
    if (gesture === 'pending' && ev.type === 'pointerup') onTap(ev.clientX, ev.clientY, ev.pointerType);
    else if (gesture === 'pan') cam.endGrab();
    else if (gesture === 'ghost') ghostDrag = null;
    if (!pointers.size) { gesture = null; r.canvas.style.cursor = ''; }
  }
  function onWheel(ev) {
    ev.preventDefault();
    const dy = ev.deltaMode === 1 ? ev.deltaY * 30 : ev.deltaY;
    cam.zoomAt(ev.clientX, ev.clientY, Math.exp(clamp(dy, -200, 200) * 0.0018));
  }
  const keyMap = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', Equal: 'in', NumpadAdd: 'in', Minus: 'out', NumpadSubtract: 'out' };
  function onKey(ev) {
    const tag = ev.target?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    const isDown = ev.type === 'keydown';
    if (isDown && ev.key === 'Escape') {
      if (myModals.size) { [...myModals].pop().close(); ev.preventDefault(); return; }
      if (placing && !ui.hasModal()) { endPlacement(); ev.preventDefault(); return; }
    }
    if (ui.hasModal()) { cam.clearKeys(); return; }
    if (keyMap[ev.code]) { cam.key(keyMap[ev.code], isDown); ev.preventDefault(); return; }
    if (!isDown || ev.repeat) return;
    if (placing) {
      if (ev.code === 'KeyR') rotatePlacing();
      else if (ev.code === 'Enter' || ev.code === 'Space') confirmPlacement();
      return;
    }
    if (ev.code === 'KeyQ') { cam.rotate(-1); audio.sfx('swoosh'); }
    else if (ev.code === 'KeyE') { cam.rotate(1); audio.sfx('swoosh'); }
    else if (ev.code === 'KeyB') { audio.sfx('tap'); openBuildMenu(S); }
    else if (ev.code === 'KeyC') collectAll();
    else if (ev.code === 'KeyH' || ev.code === 'Home') focusCastle();
  }
  function onBlur() { cam?.clearKeys(); }
  function onVisibility() { if (document.hidden) r.stop(); else r.start(); }

  function collectAll() {
    const ready = [...entries.values()].filter(e => E.producerStatus(e.b).ready);
    if (!ready.length) return;
    batchCollect = ready.length > 3;
    E.collectAll();
    batchCollect = false;
  }
  function focusCastle() {
    const c = ctx.state.city.buildings.find(b => b.id === 'castillo');
    if (!c) return;
    const fc = footCenter(c.id, c.x, c.z, c.rot);
    cam.flyTo(fc.x, fc.z + 0.5);
    audio.sfx('swoosh');
  }

  // =====================================================================
  // Tutorial suave
  // =====================================================================
  function showTip(html, x, y) {
    if (!tipEl) {
      tipEl = ui.h('div.cx-tip', { html: '<span></span><i></i>' });
      container.append(tipEl);
    }
    const sp = tipEl.firstChild;
    if (sp.innerHTML !== html) sp.innerHTML = html;
    tipEl.style.left = clamp(x, 120, innerWidth - 120) + 'px';
    tipEl.style.top = y + 'px';
    tipEl.querySelector('i').style.marginLeft = ((x - clamp(x, 120, innerWidth - 120)) * 2) + 'px';
    tipEl.style.display = '';
  }
  function hideTip() { if (tipEl) tipEl.style.display = 'none'; }
  function clearGameTip() { if (gameTip) { ov.remove(gameTip.item); gameTip = null; } }
  function setWorldTip(kind, e, html) {
    if (worldTip && worldTip.kind === kind && worldTip.e === e) return;
    if (worldTip) ov.remove(worldTip.item);
    const el = ui.h('div.cx-tag', { html });
    el.style.marginBottom = kind === 'collect' ? '70px' : '10px';
    worldTip = { kind, e, item: ov.add(el, topPos(e, 0.2)) };
  }
  function clearWorldTip() { if (worldTip) { ov.remove(worldTip.item); worldTip = null; } }
  function updateTutorial() {
    const blocked = placing || myModals.size || ui.hasModal();
    // flecha al botón Construir
    let tipText = null;
    if (!T().cityIntro && ctx.state.city.buildings.length <= 1) tipText = `${icon('hammer', 20)}¡Tocá <b>Construir</b> para empezar!`;
    else {
      const q = ctx.quests.mainQuest();
      const ids = questBuildIds(ctx).filter(id => E.canBuild(id).ok);
      if (q && ids.length && !T()['q_' + q.id] && !(q.goal.type === 'pop' || q.goal.type === 'happy')) tipText = `${icon('quest', 20)}Misión: construí <b>${ui.esc(E.def(ids[0]).name)}</b>`;
    }
    const btn = document.querySelector('#hud:not(.hidden) .hud-btn.big');
    if (tipText && !blocked && btn) {
      const rc = btn.getBoundingClientRect();
      if (rc.width) showTip(tipText, rc.left + rc.width / 2, rc.top - 6); else hideTip();
    } else hideTip();
    // cobrar
    const firstBubble = [...entries.values()].find(e => e.bubble && e.bubble.onScreen);
    if (!T().collect && firstBubble && !blocked) setWorldTip('collect', firstBubble, `${icon('coin', 18)}¡Tocá para cobrar!`);
    else if (gameTip && !blocked && entries.has(gameTip.uid)) setWorldTip('game', entries.get(gameTip.uid), `${icon('games', 18)}¡Tocala para jugar!`);
    else clearWorldTip();
    if (gameTip && performance.now() > gameTip.until) gameTip = null;
  }

  // =====================================================================
  // Eventos
  // =====================================================================
  function floatAt(e, html, cls = '') {
    const s = screenOf(topPos(e, 0.3));
    ui.floatText(s.x, s.y, html, cls);
  }
  function bindEvents() {
    offs.push(bus.on('hud:build', (p) => { if (placing) endPlacement(true); setFlag('cityIntro'); const q = ctx.quests.mainQuest(); if (q) setFlag('q_' + q.id); openBuildMenu(S, p?.focus || null); }));
    offs.push(bus.on('building:placed', ({ b }) => {
      const e = createEntry(b, 'drop');
      e.placedAt = performance.now();
      setTimeout(() => { if (!disposed && entries.get(b.uid) === e) { const c = e.root.position; fx.dust(c.x, 0.05, c.z, Math.max(...E.footprint(b.id, b.rot)) * 0.45); } }, 300);
      life.refreshGrid();
      syncStatus();
    }));
    offs.push(bus.on('building:built', ({ b }) => {
      const e = entries.get(b.uid);
      if (!e) return;
      const instant = e.placedAt && performance.now() - e.placedAt < 500;
      refreshEntry(e, true);
      life.refreshGrid();
      if (instant) { syncStatus(); return; }
      e.anim = { type: 'pop', t: 0 };
      audio.sfx('done');
      const c = e.root.position;
      fx.confetti(c.x, e.height * 0.8, c.z);
      fx.sparkle(c.x, e.height * 0.5, c.z);
      setTimeout(() => !disposed && floatAt(e, '¡Listo!'), 120);
      const d = E.def(b);
      if (d.game && !T()['game_' + d.game]) gameTip = { uid: b.uid, until: performance.now() + 12000 };
      syncStatus();
    }));
    offs.push(bus.on('building:upgradeStarted', ({ b }) => {
      const e = entries.get(b.uid);
      if (!e) return;
      refreshEntry(e, true);
      e.anim = { type: 'squish', t: 0 };
      audio.sfx('build');
      fx.dust(e.root.position.x, 0.05, e.root.position.z, 0.8);
      syncStatus();
    }));
    offs.push(bus.on('building:upgraded', ({ b, level }) => {
      const e = entries.get(b.uid);
      if (!e) return;
      refreshEntry(e, true);
      e.anim = { type: 'pop', t: 0 };
      audio.sfx('done');
      const c = e.root.position;
      fx.confetti(c.x, e.height * 0.8, c.z);
      fx.sparkle(c.x, e.height * 0.6, c.z, ['#b58cff', '#ffffff', '#ffd166']);
      setTimeout(() => !disposed && floatAt(e, `${icon('star', 22)}¡Nivel ${level}!`), 120);
      if (b.id === 'castillo') ui.confetti();
      life.refreshGrid();
      syncStatus();
    }));
    offs.push(bus.on('building:moved', ({ b }) => {
      const e = entries.get(b.uid);
      if (!e) return;
      refreshEntry(e, true);
      if (!e.anim) e.anim = { type: 'hop', t: 0 };
      fx.dust(e.root.position.x, 0.05, e.root.position.z, 0.6);
      life.refreshGrid();
      syncStatus();
    }));
    offs.push(bus.on('building:removed', ({ b }) => {
      const e = entries.get(b.uid);
      if (e) fx.poof(e.root.position.x, 0.3, e.root.position.z);
      removeEntry(b.uid);
      life.refreshGrid();
      syncStatus();
    }));
    offs.push(bus.on('production:collected', ({ b, amount, currency }) => {
      const e = entries.get(b.uid);
      if (!e) return;
      const s = screenOf(topPos(e, 0.5));
      const n = batchCollect ? 2 : clamp(Math.round(amount / 12) + 3, 3, 8);
      ui.flyCurrency(s.x, s.y, currency, currency === 'gems' ? Math.min(n, 4) : n);
      ui.floatText(s.x, s.y - 18, `+${E.fmtNum(amount)} ${icon(currency === 'gems' ? 'gem' : 'coin', 22)}`);
      removeBubble(e, true);
      if (!e.anim) e.anim = { type: 'squish', t: 0 };
      fx.sparkle(e.root.position.x, e.height + 0.2, e.root.position.z, currency === 'gems' ? ['#8fd3ff', '#ffffff', '#d4efff'] : ['#ffd166', '#ffffff', '#fff0c2']);
      setFlag('collect');
      if (worldTip?.kind === 'collect') clearWorldTip();
    }));
    offs.push(bus.on('city:expanded', ({ bounds }) => {
      world.animateExpand(bounds, !!E.expansionInfo());
      rebuildSignLabels();
      life.refreshGrid();
      audio.sfx('clear');
      setTimeout(() => !disposed && audio.sfx('done'), 500);
      cam.flyTo(0.5, 1, Math.max(cam.st.u, Math.min(26, bounds.side * 0.95)));
      if (placing) updateGhost();
    }));
    offs.push(bus.on('level:up', () => { rebuildSignLabels(); }));
    offs.push(bus.on('customize:changed', ({ target }) => {
      if (target === 'princess') life.rebuildPlayer();
      else if (target === 'car') life.rebuildCar();
    }));
    offs.push(bus.on('builders:changed', () => syncStatus()));
    offs.push(bus.on('city:flag', () => {
      for (const e of entries.values()) if (e.b.id === 'castillo') refreshEntry(e, true);
    }));
  }

  function rebuildSignLabels() {
    for (const it of signItems) ov.remove(it);
    signItems = [];
    const ex = E.expansionInfo();
    if (!ex) { world.refreshSigns(false); return; }
    if (world.signs.length === 0) world.refreshSigns(true);
    const lvOk = ctx.state.player.level >= ex.reqLevel;
    for (const s of world.signs) {
      const el = ui.h('div.cx-sign', { html: `${icon('plus', 16)}¡Expandir!` });
      const it = ov.add(el, s.pos);
      it.label = lvOk;
      if (!lvOk) el.style.visibility = 'hidden';
      signItems.push(it);
    }
  }

  // =====================================================================
  // Loop
  // =====================================================================
  function frame(dt, t) {
    cam.update(dt);
    world.setCamAngle(cam.angle);
    world.update(dt, t);
    for (const e of entries.values()) {
      e.model?.userData.update?.(dt, t);
      e.scaffold?.userData.update?.(dt, t);
      if (e.anim) animateEntry(e, dt);
    }
    life.setCamAngle(cam.angle);
    life.update(dt, t);
    fx.update(dt);
    if (placing) {
      const p = placing;
      p.t += dt;
      let y = 0.08 + Math.sin(p.t * 5) * 0.05;
      p.ghost.position.y = y;
      if (p.shake > 0) { p.shake -= dt; p.model.position.x = Math.sin(p.shake * 60) * 0.08 * (p.shake / 0.35); } else p.model.position.x = 0;
      const pulse = 0.62 + Math.sin(p.t * 6) * 0.14;
      okMat.opacity = pulse + 0.1; badMat.opacity = pulse + 0.15;
      p.model.userData.update?.(dt, t);
    }
    if (hoverDirty && !placing && !cam.dragging) {
      hoverDirty = false;
      const hv = hoverPos && (hitBubble(hoverPos.x, hoverPos.y) || hitSign(hoverPos.x, hoverPos.y) || hitWalker(life.player, hoverPos.x, hoverPos.y, 30) || raycastBuilding(hoverPos.x, hoverPos.y) != null);
      r.canvas.style.cursor = hv ? 'pointer' : '';
    }
    syncAcc += dt;
    if (syncAcc > 0.25) { syncAcc = 0; syncStatus(); }
    ov.update();
  }

  // =====================================================================
  // Montaje
  // =====================================================================
  return {
    hud: true,
    music: 'city',
    async mount(el, params = {}) {
      container = el;
      styleEl = document.createElement('style');
      styleEl.id = 'city-style';
      styleEl.textContent = STYLE;
      document.head.append(styleEl);
      const lowQ = !!ctx.state.settings?.lowQuality;
      r = createPixelRenderer(container, { background: null, viewSize: 14, pixelSize: lowQ ? 3.5 : undefined });
      r.renderer.setClearColor(0x000000, 0);
      const { hemi, sun } = addLights(r.scene, { shadowSize: 50, shadowRes: lowQ ? 1024 : 2048 });
      hemi.intensity = 1.55;
      sun.shadow.camera.far = 120;
      sun.position.set(14, 26, 10);
      sun.shadow.camera.updateProjectionMatrix();

      fx = createParticles(r.scene);
      const lb = E.landBounds();
      world = createWorld(r, { bounds: { ...lb, canExpand: !!E.expansionInfo() }, hooks: {
        onPoof: (x, z) => fx.poof(x, 0.3, z),
        onTileReveal: (x, z) => { if (Math.random() < 0.5) fx.sparkle(x, 0.1, z, ['#c4f7e8', '#ffffff', '#ffd166']); },
      } });
      bGroup = new THREE.Group();
      bGroup.name = 'buildings';
      r.scene.add(bGroup);
      for (const b of ctx.state.city.buildings) createEntry(b);
      life = createLife(r, ctx);

      // materiales de baldosas del fantasma
      const tcv = document.createElement('canvas');
      tcv.width = tcv.height = 16;
      const tg = tcv.getContext('2d');
      tg.fillStyle = 'rgba(255,255,255,0.28)'; tg.fillRect(0, 0, 16, 16);
      tg.fillStyle = '#ffffff'; tg.fillRect(0, 0, 16, 2); tg.fillRect(0, 14, 16, 2); tg.fillRect(0, 0, 2, 16); tg.fillRect(14, 0, 2, 16);
      tg.fillStyle = 'rgba(255,255,255,0.6)'; tg.fillRect(2, 2, 12, 1); tg.fillRect(2, 2, 1, 12);
      tileTex = new THREE.CanvasTexture(tcv);
      tileTex.magFilter = THREE.NearestFilter; tileTex.minFilter = THREE.NearestFilter; tileTex.colorSpace = THREE.SRGBColorSpace;
      okMat = new THREE.MeshBasicMaterial({ map: tileTex, color: 0x6fe3c1, transparent: true, opacity: 0.6, depthWrite: false, depthTest: false });
      badMat = new THREE.MeshBasicMaterial({ map: tileTex, color: 0xff6f6f, transparent: true, opacity: 0.6, depthWrite: false, depthTest: false });
      tileGeo = new THREE.PlaneGeometry(0.96, 0.96);

      cam = createCameraCtl(r, ctx.state.city.camera, { onChange: (c) => { ctx.state.city.camera = c; store.markDirty(); } });
      ov = createOverlays(container, r);
      ro = new ResizeObserver(() => { cam.applyProj(); ov.resize(); });
      ro.observe(container);

      // botones flotantes
      sideEl = ui.h('div.cx-side');
      collectBtn = ui.h('button.cx-collect', { html: `${icon('coin', 24)}Cobrar todo<i class="badge">0</i>`, 'aria-label': 'Cobrar todo' });
      collectBtn.style.display = 'none';
      collectBtn.addEventListener('click', () => collectAll());
      const homeBtn = ui.h('button.cx-fab', { html: icon('castle', 30), 'aria-label': 'Ir al castillo', title: 'Ir al castillo (H)' });
      homeBtn.addEventListener('click', focusCastle);
      const rotBtn = ui.h('button.cx-fab', { html: icon('rotate', 30), 'aria-label': 'Girar la vista', title: 'Girar la vista (Q / E)' });
      rotBtn.addEventListener('click', () => { cam.rotate(1); audio.sfx('swoosh'); });
      sideEl.append(collectBtn, homeBtn, rotBtn);
      container.append(sideEl);

      // entrada
      const cv = r.canvas;
      cv.addEventListener('pointerdown', onDown);
      cv.addEventListener('pointermove', onMove);
      cv.addEventListener('pointerup', onUp);
      cv.addEventListener('pointercancel', onUp);
      cv.addEventListener('lostpointercapture', (ev) => { if (pointers.has(ev.pointerId)) onUp({ pointerId: ev.pointerId, type: 'pointercancel', clientX: 0, clientY: 0 }); });
      cv.addEventListener('pointerleave', () => { hoverPos = null; });
      cv.addEventListener('wheel', onWheel, { passive: false });
      cv.addEventListener('contextmenu', (ev) => ev.preventDefault());
      addEventListener('keydown', onKey);
      addEventListener('keyup', onKey);
      addEventListener('blur', onBlur);
      document.addEventListener('visibilitychange', onVisibility);

      bindEvents();
      rebuildSignLabels();
      syncStatus();
      r.onFrame(frame);
      r.start();
      if (params.build) setTimeout(() => !disposed && openBuildMenu(S, typeof params.build === 'string' && E.def(params.build) ? params.build : null), 300);
    },
    unmount() {
      disposed = true;
      offs.forEach(f => f()); offs.length = 0;
      removeEventListener('keydown', onKey);
      removeEventListener('keyup', onKey);
      removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibility);
      ro?.disconnect();
      for (const m of [...myModals]) m.close();
      if (placing) { const p = placing; placing = null; for (const m of p.mats) m.dispose(); ctx.hud.show(); }
      if (cam) { ctx.state.city.camera = cam.save(); store.markDirty(); }
      ov?.dispose();
      tipEl?.remove();
      sideEl?.remove();
      life?.dispose();
      world?.dispose();
      fx?.dispose();
      entries.clear();
      okMat?.dispose(); badMat?.dispose(); tileGeo?.dispose(); tileTex?.dispose();
      r?.dispose();
      styleEl?.remove();
    },
  };
}
