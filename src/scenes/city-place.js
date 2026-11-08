// Colocar y mover edificios en la ciudad: fantasma, casillas, botones junto al edificio, arrastre, paneo en los
// bordes, caminos/deco seguidos, deshacer el último movimiento y teclado.
//
// La escena (city.js) maneja los gestos (tocar, paneo, pellizco, toque largo) y le pasa a este módulo lo que le toca:
//   tap(x,y,tipo) · hitGhost(x,y) · dragStart/dragMove/dragEnd · key(ev) · frame(dt,t)
//
// Gancho para otras capas (p. ej. la Fase 3 con el radio de cobertura de las defensas):
//   const off = placer.onGhostMove(info => { ... })   // info = null al terminar
//     info = { id, mode:'new'|'move', uid, x, z, rot, w, d, cx, cz, valid, reason, paint }
//     (x,z = esquina en casillas; cx,cz = centro en coordenadas del mundo). Llega en cada cambio del fantasma.
//   const layer = placer.tileLayer('cobertura')         // capa de casillas propia, se dibuja debajo del fantasma
//     layer.set([{ x, z, tone: 'cover'|'ok'|'bad'|'warn' }]) · layer.clear()   (se limpia sola al terminar)
//   También sale por el bus: 'city:placing' {active, id, mode, uid} y 'city:ghost' (mismo info que onGhostMove).
import * as THREE from 'three';
import { buildingModel, constructionModel } from '../city/models.js';
import { icon } from '../core/icons.js';
import { HALF, ROAD_H, footCenter, clamp, makeGhost } from './city-common.js';
import { freeCount } from './city-ui.js';

export const LONG_PRESS_MS = 420;
const EDGE_PX = 46;        // franja del borde donde arrastrar el fantasma mueve la cámara
const EDGE_SPEED = 520;    // px/s de paneo en el borde (al fondo de la franja)
const EDGE_DWELL = 0.25;   // s quieto en la franja antes de que la cámara empiece a moverse
const LIFT_PX = 62;        // con el dedo, el fantasma queda esta distancia por encima (que no lo tape)
const UNDO_MS = 8000;

/**
 * Botón flotante sobre la ciudad: responde al soltar el dedo/mouse (no espera el "click", que el navegador a veces no
 * manda cuando el botón se reubica cuadro a cuadro siguiendo al edificio). El click queda para el teclado.
 */
function onPress(el, fn) {
  let downAt = null;
  el.addEventListener('pointerdown', (ev) => { ev.stopPropagation(); downAt = { x: ev.clientX, y: ev.clientY, t: performance.now() }; });
  el.addEventListener('pointerup', (ev) => {
    ev.stopPropagation();
    const d = downAt; downAt = null;
    if (!d || el.disabled || Math.hypot(ev.clientX - d.x, ev.clientY - d.y) > 24) return;
    fn();
  });
  el.addEventListener('pointercancel', () => { downAt = null; });
  // con mouse que no se quede con el foco: si no, Enter/Espacio después "apretaría" este botón en vez de colocar
  el.addEventListener('mousedown', (ev) => ev.preventDefault());
  // el click de un toque/clic (detail ≥ 1) ya lo atendió pointerup; el del teclado o de .click() llega con detail 0
  el.addEventListener('click', (ev) => { ev.stopPropagation(); if (ev.detail > 0) return; fn(); });
}

export const PLACE_STYLE = `
.cx-placebar { position: absolute; left: 50%; transform: translateX(-50%); bottom: calc(var(--safe-b) + 10px); z-index: 30; width: min(460px, calc(100% - 16px));
  background: var(--panel); border: 3px solid var(--edge); border-radius: 14px; box-shadow: 0 4px 0 var(--shade), 0 10px 24px rgba(8, 6, 5,.2); padding: 7px 10px 8px;
  display: flex; align-items: center; gap: 10px; animation: cx-slideup .22s ease-out; }
@keyframes cx-slideup { from { transform: translate(-50%, 30px); opacity: 0; } }
.cx-pb-txt { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.cx-pb-top { display: flex; align-items: center; gap: 8px; min-height: 24px; }
.cx-pb-top b { font-size: 16px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cx-pb-top .cost { font-size: 14px; }
.cx-pb-top .grow { flex: 1; }
.cx-pb-hint { font-size: 13px; color: var(--ink-l); line-height: 1.2; }
.cx-pb-hint.bad { color: var(--coral); font-weight: 700; }
.cx-pb-done { flex: none; padding: 6px 12px; font-size: 16px; }

.cx-pc { position: absolute; left: 0; top: 0; z-index: 29; display: flex; flex-direction: column; align-items: center; gap: 6px; pointer-events: none;
  transform: translate(-9999px, 0); transition: opacity .12s; will-change: transform; }
.cx-pc.drag { opacity: 0; }
.cx-pc.drag .cx-pc-b { pointer-events: none; }
.cx-pc-why { background: var(--surface); border: 3px solid var(--edge); border-radius: 10px; box-shadow: 0 3px 0 var(--shade); padding: 2px 9px; font-weight: 700; font-size: 13px;
  white-space: nowrap; color: var(--coral); max-width: 78vw; overflow: hidden; text-overflow: ellipsis; }
.cx-pc-why:empty { display: none; }
.cx-pc-row { display: flex; gap: 10px; }
.cx-pc-b { pointer-events: auto; width: 46px; height: 46px; padding: 0; display: grid; place-items: center; border: 3px solid var(--edge); border-radius: 50%;
  background: var(--surface); box-shadow: inset 0 -4px 0 var(--surface-2), 0 3px 0 var(--shade); cursor: pointer; }
.cx-pc-b:active:not(:disabled) { transform: translateY(2px); box-shadow: inset 0 -2px 0 var(--surface-2), 0 1px 0 var(--shade); }
.cx-pc-b.cx-pc-ok { background: var(--mint); box-shadow: inset 0 -4px 0 var(--mint-d), 0 3px 0 var(--shade); width: 54px; height: 54px; margin-top: -4px; color: var(--ink-dark); }
.cx-pc-b:disabled { filter: grayscale(.8) opacity(.6); cursor: default; }
.cx-pc-b img.pi { width: 24px; height: 24px; }
.cx-pc-ok img.pi { width: 28px; height: 28px; }

.cx-undo { pointer-events: auto; display: flex; align-items: center; gap: 5px; padding: 4px 11px 4px 7px; background: var(--surface); border: 3px solid var(--edge); border-radius: 12px;
  box-shadow: 0 3px 0 var(--shade); font: inherit; font-weight: 700; font-size: 14px; color: var(--ink); white-space: nowrap; margin-bottom: 6px; cursor: pointer;
  animation: cx-undo-in .2s ease-out; }
.cx-undo:active { transform: translateY(2px); box-shadow: 0 1px 0 var(--shade); }
@keyframes cx-undo-in { from { opacity: 0; margin-bottom: 0; } }
`;

/**
 * host = { ctx, r, ov, cam, container, entries, S, safe, modelOpts(), themeId(), raycastBuilding(x,y),
 *          onStart(), onEnd() }   (onStart/onEnd: la escena oculta/muestra HUD, globitos y carteles)
 */
export function createPlacer(host) {
  const { ctx, r, ov, cam, container, entries, S, safe } = host;
  const { bus, ui, audio, economy: E } = ctx;
  const T = () => ctx.state.tutorial;
  const setFlag = (k) => { if (!T()[k]) { T()[k] = true; ctx.store.markDirty(); } };

  let placing = null, bar = null, pc = null, drag = null, undo = null;
  const listeners = new Set();
  const layers = new Map();
  const raycaster = new THREE.Raycaster();
  raycaster.layers.enableAll();
  const tmpV = new THREE.Vector3();

  // ---------- casillas ----------
  const tcv = document.createElement('canvas');
  tcv.width = tcv.height = 16;
  const tg = tcv.getContext('2d');
  tg.fillStyle = 'rgba(255,255,255,0.34)'; tg.fillRect(0, 0, 16, 16);
  tg.fillStyle = '#ffffff'; tg.fillRect(0, 0, 16, 2); tg.fillRect(0, 14, 16, 2); tg.fillRect(0, 0, 2, 16); tg.fillRect(14, 0, 2, 16);
  tg.fillStyle = 'rgba(255,255,255,0.6)'; tg.fillRect(2, 2, 12, 1); tg.fillRect(2, 2, 1, 12);
  const tileTex = new THREE.CanvasTexture(tcv);
  tileTex.magFilter = THREE.NearestFilter; tileTex.minFilter = THREE.NearestFilter; tileTex.colorSpace = THREE.SRGBColorSpace;
  const tileMat = (color, opacity = 0.72) => new THREE.MeshBasicMaterial({ map: tileTex, color, transparent: true, opacity, depthWrite: false, depthTest: false });
  // ok: libre y se puede · bad: ocupado o fuera del terreno · warn: el lugar está bien pero falta otra cosa (monedas,
  // constructoras) · cover: casillas de una capa extra (p. ej. el radio de una defensa)
  const MATS = { ok: tileMat(0x2fbf8f, 0.78), bad: tileMat(0xff6f6f, 0.82), warn: tileMat(0xffc14d, 0.8), cover: tileMat(0x8fd3ff, 0.45) };
  const tileGeo = new THREE.PlaneGeometry(0.96, 0.96);
  // las casillas van antes que el fantasma (renderOrder 4): sin prueba de profundidad, si no lo taparían
  function tileMesh(tone, order = 3) {
    const m = new THREE.Mesh(tileGeo, MATS[tone] || MATS.ok);
    m.rotation.x = -Math.PI / 2; m.renderOrder = order;
    r.scene.add(m);
    return m;
  }
  function roadAt(x, z, ignoreUid) {
    const b = E.buildingAt(x, z);
    return b && b.uid !== ignoreUid && E.def(b).cat === 'camino';
  }

  // ---------- helpers de grilla ----------
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
  const W = () => container.clientWidth || innerWidth;
  const H = () => container.clientHeight || innerHeight;
  function chainVisible(o) { for (; o; o = o.parent) if (!o.visible) return false; return true; }
  function occluded(wx, wz) {
    const dir = new THREE.Vector3();
    r.camera.getWorldDirection(dir);
    const from = new THREE.Vector3(wx, 0.05, wz).addScaledVector(dir, -80);
    raycaster.set(from, dir);
    const bg = r.scene.getObjectByName('buildings');
    const hits = bg ? raycaster.intersectObjects(bg.children, true) : [];
    return hits.some(h => h.distance < 80 - 0.3 && chainVisible(h.object));
  }
  /** Lugar libre cerca del centro de la pantalla que no quede tapado por otro edificio. */
  function findFreeSpot(id, rot) {
    const tx = W() / 2, ty = H() * 0.5;
    const p = r.pickGround(tx, ty) || new THREE.Vector3();
    const [cx, cz] = cornerFromWorld(id, rot, p.x, p.z);
    const [w, d] = E.footprint(id, rot);
    let best = null, bestScore = Infinity;
    const L = E.landBounds();
    for (let x = L.min; x <= L.max - w; x++) for (let z = L.min; z <= L.max - d; z++) {
      if (Math.abs(x - cx) > 12 || Math.abs(z - cz) > 12) continue;
      if (!E.canPlace(id, x, z, rot).ok) continue;
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
  /** Casilla libre más cercana en espiral; prefiere seguir en la misma dirección (caminos seguidos). */
  function nearestFreeTile(id, x0, z0, rot, dir = null) {
    const L = E.landBounds();
    for (let rr = 1; rr <= 10; rr++) {
      let best = null, bestScore = Infinity;
      for (let dx = -rr; dx <= rr; dx++) for (let dz = -rr; dz <= rr; dz++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== rr) continue;
        const x = x0 + dx, z = z0 + dz;
        if (x < L.min || z < L.min || x >= L.max || z >= L.max) continue;
        if (!E.canPlace(id, x, z, rot).ok) continue;
        let sc = Math.hypot(dx, dz);
        if (dir && (dir[0] || dir[1])) sc -= 0.35 * (dx * dir[0] + dz * dir[1]) / Math.max(1, Math.hypot(dx, dz));
        if (sc < bestScore) { bestScore = sc; best = [x, z]; }
      }
      if (best) return best;
    }
    return null;
  }

  // ---------- arrancar / terminar ----------
  function start(id) {
    end(true);
    const can = E.canBuild(id);
    if (!can.ok) { audio.sfx('error'); ui.toast(can.reason, { icon: 'info' }); return false; }
    const spot = findFreeSpot(id, 0);
    if (!spot) { audio.sfx('error'); ui.toast('No queda lugar libre. Ampliá el terreno', { icon: 'map' }); return false; }
    begin({ mode: 'new', id, rot: 0, x: spot[0], z: spot[1], level: 1, uid: null });
    return true;
  }
  /** Levanta un edificio para moverlo. grab = {x, y, type}: viene de un toque largo y sigue al puntero. */
  function startMove(uid, grab = null) {
    end(true);
    const e = entries.get(uid);
    if (!e) return false;
    const b = e.b;
    e.root.visible = false;
    if (e.timer) { ov.remove(e.timer); e.timer = null; }
    begin({ mode: 'move', id: b.id, rot: b.rot, x: b.x, z: b.z, level: E.isConstructing(b) ? 1 : b.level, uid, from: { x: b.x, z: b.z, rot: b.rot } });
    if (grab) { dragStart(grab.x, grab.y, grab.type, true); audio.sfx('pop'); setFlag('moveHint'); }
    else if (!T().moveHint) {
      setFlag('moveHint');
      ui.toast(S.lastPointer === 'mouse' ? 'Atajo: mantené apretado un edificio para levantarlo' : 'Atajo: mantené el dedo sobre un edificio para levantarlo', { icon: 'move' });
    }
    return true;
  }
  function begin(p) {
    clearUndo();
    const movingB = p.uid != null ? entries.get(p.uid)?.b : null;
    const isCon = !!movingB && E.isConstructing(movingB);
    const fp = E.footprint(p.id, 0);
    const model = isCon ? safe(() => constructionModel(...fp, host.themeId()), fp) : safe(() => buildingModel(p.id, p.level, { ...host.modelOpts(), era: movingB && E.hasEra(movingB) ? (movingB.era || 1) : E.cityEra() }), fp);
    const mats = makeGhost(model, 0.84);
    const root = new THREE.Group();
    root.add(model);
    r.scene.add(root);
    placing = { ...p, ghost: root, model, mats, tiles: [], valid: false, reason: '', why: '', tone: 'ok', paint: false, count: 0, lastPaint: null, t: 0, lift: 0, shake: 0, sig: '' };
    host.onStart();
    bar = makeBar();
    container.append(bar.el);
    pc = makeCluster();
    container.append(pc.el);
    update();
    bus.emit('city:placing', { active: true, id: p.id, mode: p.mode, uid: p.uid });
    if (!T().place) setTimeout(() => setFlag('place'), 4000);
  }
  function end(silent = false) {
    if (!placing) return;
    const p = placing;
    placing = null;
    drag = null;
    r.scene.remove(p.ghost);
    for (const m of p.mats) m.dispose();
    for (const t of p.tiles) r.scene.remove(t);
    for (const l of layers.values()) l.clear();
    if (p.uid != null) { const e = entries.get(p.uid); if (e) e.root.visible = true; }
    bar?.el.remove(); bar = null;
    pc?.el.remove(); pc = null;
    host.onEnd();
    if (!silent) audio.sfx('close');
    emitGhost(null);
    bus.emit('city:placing', { active: false });
  }

  // ---------- mover el fantasma ----------
  function rotate() {
    if (!placing) return;
    audio.sfx('swoosh');
    const p = placing;
    // girar alrededor del centro: la esquina se corrige para que el edificio no "salte" de lugar
    const c0 = footCenter(p.id, p.x, p.z, p.rot);
    p.rot = (p.rot + 1) % 4;
    const [x, z] = cornerFromWorld(p.id, p.rot, c0.x, c0.z);
    p.x = x; p.z = z;
    update();
  }
  function moveTo(x, z) {
    if (!placing) return false;
    [x, z] = landClampCorner(placing.id, x, z, placing.rot);
    if (x === placing.x && z === placing.z) return false;
    placing.x = x; placing.z = z;
    audio.sfx('tap');
    update();
    return true;
  }
  /** Por qué no se puede, dicho para la persona (con el nombre de lo que estorba). */
  function explain(p, res) {
    if (res.ok) return '';
    if (res.reason === 'Fuera del terreno') return 'Fuera de tu terreno';
    if (res.reason === 'Hay algo ahí') {
      const [w, d] = E.footprint(p.id, p.rot);
      for (let dx = 0; dx < w; dx++) for (let dz = 0; dz < d; dz++) {
        const b = E.buildingAt(p.x + dx, p.z + dz);
        if (b && b.uid !== p.uid) return `Ahí está ${E.def(b).name}`;
      }
      return 'Ese lugar está ocupado';
    }
    if (res.poor) return 'No te alcanzan las monedas';
    return res.reason || 'Ahí no entra';
  }
  function update() {
    const p = placing;
    if (!p) return;
    const [w, d] = E.footprint(p.id, p.rot);
    const c = footCenter(p.id, p.x, p.z, p.rot);
    p.ghost.position.x = c.x; p.ghost.position.z = c.z;
    p.model.rotation.y = p.rot * Math.PI / 2;
    const pos = E.canPlace(p.id, p.x, p.z, p.rot, p.uid);
    let res = pos;
    if (res.ok && p.mode === 'new') { const cb = E.canBuild(p.id); if (!cb.ok) res = cb; }
    p.valid = res.ok; p.reason = res.reason || '';
    p.why = explain(p, res);
    p.tone = res.ok ? 'ok' : pos.ok ? 'warn' : 'bad';
    // casillas: cada una dice lo suyo (verde libre, roja ocupada o afuera, amarilla si el lugar está bien pero falta otra cosa)
    while (p.tiles.length < w * d) p.tiles.push(tileMesh('ok'));
    while (p.tiles.length > w * d) r.scene.remove(p.tiles.pop());
    const L = E.landBounds();
    let i = 0;
    for (let dx = 0; dx < w; dx++) for (let dz = 0; dz < d; dz++) {
      const x = p.x + dx, z = p.z + dz;
      const other = E.buildingAt(x, z);
      const blocked = (other && other.uid !== p.uid) || x < L.min || x >= L.max || z < L.min || z >= L.max;
      const m = p.tiles[i++];
      m.material = blocked ? MATS.bad : p.valid ? MATS.ok : pos.ok ? MATS.warn : MATS.ok;
      m.position.set(x + 0.5 - HALF, roadAt(x, z, p.uid) ? ROAD_H + 0.02 : 0.03, z + 0.5 - HALF);
    }
    // el fantasma se tiñe apenas cuando no entra (sin perder sus colores)
    const tint = p.valid ? 0x46352e : p.tone === 'warn' ? 0x5a4a1a : 0x7a2424;
    for (const m of p.mats) if (m.emissive) m.emissive.setHex(tint);
    bar?.update(p);
    pc?.update(p);
    emitGhost({ id: p.id, mode: p.mode, uid: p.uid, x: p.x, z: p.z, rot: p.rot, w, d, cx: c.x, cz: c.z, valid: p.valid, reason: p.reason, paint: p.paint });
  }
  function emitGhost(info) {
    const sig = info ? [info.id, info.x, info.z, info.rot, info.valid].join('|') : '';
    if (placing) { if (placing.sig === sig) return; placing.sig = sig; }
    for (const f of listeners) { try { f(info); } catch (err) { console.warn('[place] onGhostMove', err); } }
    bus.emit('city:ghost', info);
  }

  // ---------- confirmar ----------
  function confirm() {
    const p = placing;
    if (!p) return false;
    if (!p.valid) { audio.sfx('error'); p.shake = 0.35; ui.toast(p.why || 'Ahí no entra', { icon: 'info' }); return false; }
    if (p.mode === 'new') {
      const res = E.placeBuilding(p.id, p.x, p.z, p.rot);
      if (res.error) { audio.sfx('error'); ui.toast(res.error, { icon: 'info' }); update(); return false; }
      audio.sfx('place');
      if (E.def(p.id).time > 0) setTimeout(() => audio.sfx('build'), 160);
      setFlag('place');
      if (paintable(p.id)) {
        p.paint = true; p.count++;
        const cb = E.canBuild(p.id);
        if (!cb.ok) { ui.toast(cb.poor ? 'No alcanzan las monedas para más' : cb.reason, { icon: 'coin' }); end(true); return true; }
        // con el botón (no pintando) el fantasma pasa a la casilla libre de al lado, para seguir la fila
        if (!drag) {
          const nx = nearestFreeTile(p.id, p.x, p.z, p.rot, p.lastDir);
          if (nx) { p.lastDir = [Math.sign(nx[0] - p.x), Math.sign(nx[1] - p.z)]; p.x = nx[0]; p.z = nx[1]; }
        }
        update();
      } else end(true);
      return true;
    }
    const from = p.from;
    const res = E.moveBuilding(p.uid, p.x, p.z, p.rot);
    if (res.error) { audio.sfx('error'); ui.toast(res.error, { icon: 'info' }); return false; }
    audio.sfx('place');
    const uid = p.uid;
    end(true);
    const e = entries.get(uid);
    if (e) e.anim = { type: 'drop', t: 0 };
    if (from && (from.x !== res.x || from.z !== res.z || from.rot !== res.rot)) offerUndo(uid, from);
    return true;
  }

  // ---------- deshacer (mover es gratis: volver atrás también) ----------
  function offerUndo(uid, from) {
    clearUndo();
    const e = entries.get(uid);
    if (!e) return;
    const el = ui.h('button.cx-undo', { html: `${icon('back', 16)}Deshacer`, 'aria-label': 'Deshacer el último movimiento', title: 'Deshacer (Ctrl+Z)' });
    onPress(el, doUndo);
    const pos = new THREE.Vector3(e.root.position.x, (e.height || 1) + 0.4, e.root.position.z);
    undo = { uid, from, until: performance.now() + UNDO_MS, item: ov.add(el, pos) };
  }
  function clearUndo() { if (undo) { ov.remove(undo.item); undo = null; } }
  function doUndo() {
    const u = undo;
    if (!u) return false;
    clearUndo();
    const b = ctx.state.city.buildings.find(o => o.uid === u.uid);
    if (!b) return false;
    const res = E.moveBuilding(u.uid, u.from.x, u.from.z, u.from.rot);
    if (res.error) { audio.sfx('error'); ui.toast('Ya no entra donde estaba', { icon: 'info' }); return false; }
    audio.sfx('swoosh');
    const e = entries.get(u.uid);
    if (e) e.anim = { type: 'drop', t: 0 };
    return true;
  }
  /** Rotar un edificio ya puesto (desde su ficha), con deshacer. */
  function rotateBuilding(uid) {
    const b = ctx.state.city.buildings.find(o => o.uid === uid);
    if (!b) return false;
    const from = { x: b.x, z: b.z, rot: b.rot };
    const res = E.moveBuilding(uid, b.x, b.z, (b.rot + 1) % 4);
    if (res.error) { audio.sfx('error'); ui.toast('No hay lugar para rotarlo ahí', { icon: 'info' }); return false; }
    audio.sfx('swoosh');
    offerUndo(uid, from);
    return true;
  }

  // ---------- puntero ----------
  /** ¿El puntero está sobre el fantasma? (con margen generoso para el dedo) */
  function hitGhost(cx, cy, type = 'touch') {
    if (!placing) return false;
    const p = r.pickGround(cx, cy);
    if (p) {
      const [w, d] = E.footprint(placing.id, placing.rot);
      const x = p.x + HALF, z = p.z + HALF, m = type === 'mouse' ? 0.15 : w * d === 1 ? 0.8 : 0.45;
      if (x >= placing.x - m && x <= placing.x + w + m && z >= placing.z - m && z <= placing.z + d + m) return true;
    }
    raycaster.setFromCamera(r.toNDC(cx, cy), r.camera);
    return raycaster.intersectObject(placing.ghost, true).length > 0;
  }
  /** Punto del piso al que apunta el arrastre: con el dedo, un poco más arriba (el fantasma no queda tapado). */
  function dragPoint(cx, cy) {
    const lift = drag?.type === 'mouse' ? 0 : drag ? drag.lift : 0;
    return r.pickGround(cx, cy - lift);
  }
  function dragStart(cx, cy, type = 'touch', auto = false) {
    if (!placing) return;
    const p = r.pickGround(cx, cy);
    const c = footCenter(placing.id, placing.x, placing.z, placing.rot);
    // se respeta de dónde se agarró (también con el toque largo): el edificio no salta, solo sube un poco sobre el dedo
    const ox = p ? c.x - p.x : 0, oz = p ? c.z - p.z : 0;
    drag = { type, ox, oz, cx, cy, lift: 0, liftTo: type === 'mouse' || placing.paint ? 0 : LIFT_PX, auto, moved: false, sx: cx, sy: cy, barTop: bar?.el.getBoundingClientRect().top || H() };
    pc?.el.classList.add('drag');
    if (placing.paint) paintAt(cx, cy, true);
  }
  function dragMove(cx, cy) {
    if (!placing || !drag) return;
    drag.cx = cx; drag.cy = cy;
    if (Math.hypot(cx - drag.sx, cy - drag.sy) > 6) drag.moved = true;
    if (placing.paint) { paintAt(cx, cy); return; }
    const p = dragPoint(cx, cy);
    if (!p) return;
    const [x, z] = cornerFromWorld(placing.id, placing.rot, p.x + drag.ox, p.z + drag.oz);
    moveTo(x, z);
  }
  function dragEnd() {
    if (!drag) return;
    const d = drag;
    drag = null;
    pc?.el.classList.remove('drag');
    if (!placing) return;
    placing.lastPaint = null;
    // levantado con toque largo y soltado en un lugar válido: queda ahí (con Deshacer por las dudas)
    if (d.auto && d.moved && placing.mode === 'move' && placing.valid) { confirm(); return; }
    if (d.auto && d.moved && !placing.valid) { audio.sfx('error'); placing.shake = 0.35; }
    keepVisible();
  }
  function cancelDrag() { drag = null; pc?.el.classList.remove('drag'); }
  /** Caminos y deco seguidos: pinta cada casilla que cruza el dedo (sin saltearse ninguna si va rápido). */
  function paintAt(cx, cy, first = false) {
    const p = dragPoint(cx, cy);
    if (!p || !placing) return;
    const x = Math.floor(p.x + HALF), z = Math.floor(p.z + HALF);
    const key = x + ',' + z;
    if (!first && placing.lastPaint === key) return;
    const prev = placing.lastPaint && placing.lastPaint.split(',').map(Number);
    placing.lastPaint = key;
    const cells = prev && !first ? line(prev[0], prev[1], x, z).slice(1) : [[x, z]];
    for (const [tx, tz] of cells) {
      if (!placing || !placing.paint) return;
      moveTo(tx, tz);
      if (placing.valid) confirm();
    }
  }
  /** Casillas de (x0,z0) a (x1,z1) de a un paso por eje: los caminos quedan unidos por los lados, nunca en diagonal. */
  function line(x0, z0, x1, z1) {
    const out = [[x0, z0]];
    const dx = x1 - x0, dz = z1 - z0, sx = Math.sign(dx), sz = Math.sign(dz);
    let x = x0, z = z0;
    for (let i = 0, n = Math.min(64, Math.abs(dx) + Math.abs(dz)); i < n; i++) {
      // avanza por el eje que queda más cerca de la recta ideal
      const tx = dx ? (x - x0 + sx) / dx : Infinity, tz = dz ? (z - z0 + sz) / dz : Infinity;
      if (tx <= tz) x += sx; else z += sz;
      out.push([x, z]);
    }
    return out;
  }
  /** Toque o clic sin arrastrar. Con mouse, clic sobre el fantasma = colocar. */
  function tap(x, y, type) {
    if (!placing) return;
    if (hitGhost(x, y, type)) {
      if (type === 'mouse') confirm();
      else { placing.shake = 0.2; audio.sfx('tap'); }
      return;
    }
    const p = r.pickGround(x, y);
    if (!p) return;
    if (placing.paint) {
      moveTo(Math.floor(p.x + HALF), Math.floor(p.z + HALF));
      if (placing.valid) confirm();
      return;
    }
    const [cx, cz] = cornerFromWorld(placing.id, placing.rot, p.x, p.z);
    moveTo(cx, cz);
  }
  /** Que el fantasma no quede escondido debajo de la barra o fuera de la pantalla. */
  function keepVisible() {
    if (!placing) return;
    const c = footCenter(placing.id, placing.x, placing.z, placing.rot);
    const s = ov.project(tmpV.set(c.x, 0, c.z), {});
    const bottom = (bar?.el.getBoundingClientRect().top || H()) - 30;
    if (s.x < 40 || s.x > W() - 40 || s.y < 120 || s.y > bottom) cam.flyTo(c.x, c.z);
  }

  // ---------- teclado ----------
  /** Flechas: el fantasma avanza una casilla en la dirección de la pantalla (siguiendo la grilla). */
  function nudge(dir) {
    if (!placing) return;
    const a = cam.angle;
    const U = [-Math.sin(a), -Math.cos(a)], R = [Math.cos(a), -Math.sin(a)];
    const v = dir === 'up' ? [U[0] + R[0], U[1] + R[1]] : dir === 'down' ? [-U[0] - R[0], -U[1] - R[1]] : dir === 'right' ? [R[0] - U[0], R[1] - U[1]] : [U[0] - R[0], U[1] - R[1]];
    const dx = Math.abs(v[0]) > Math.abs(v[1]) ? Math.sign(v[0]) : 0, dz = dx ? 0 : Math.sign(v[1]);
    moveTo(placing.x + dx, placing.z + dz);
    keepVisible();
  }
  const ARROWS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
  /** Devuelve true si la tecla era para la colocación. */
  function key(ev) {
    if (ev.type !== 'keydown') return !!placing && !!ARROWS[ev.code];
    if ((ev.ctrlKey || ev.metaKey) && ev.code === 'KeyZ') { if (placing) return true; return doUndo(); }
    if (!placing) return false;
    if (ARROWS[ev.code]) { nudge(ARROWS[ev.code]); return true; }
    if (ev.repeat) return ev.code === 'KeyR' || ev.code === 'Enter' || ev.code === 'Space';
    if (ev.code === 'KeyR') { rotate(); return true; }
    if (ev.code === 'Enter' || ev.code === 'NumpadEnter' || ev.code === 'Space') { confirm(); return true; }
    return false;
  }

  // ---------- barra y botones junto al edificio ----------
  function makeBar() {
    const el = ui.h('div.cx-placebar', { role: 'status' });
    const txt = ui.h('div.cx-pb-txt');
    const top = ui.h('div.cx-pb-top');
    const hint = ui.h('div.cx-pb-hint');
    const done = ui.h('button.btn.gold.cx-pb-done', { html: icon('check', 18) + 'Listo', onclick: () => { audio.sfx('tap'); end(); } });
    done.style.display = 'none';
    txt.append(top, hint);
    el.append(txt, done);
    let lastKey = '';
    return {
      el,
      update(p) {
        const d = E.def(p.id);
        const cost = p.mode === 'new' ? E.placeCost(p.id) : null;
        const nFree = p.mode === 'new' ? freeCount(p.id) : 0;
        const touch = S.lastPointer === 'touch' || (S.lastPointer !== 'mouse' && matchMedia('(pointer: coarse)').matches);
        const k = [p.id, p.mode, p.valid, p.why, p.paint, p.count, cost?.coins, cost?.gems, cost?.free, nFree, touch].join('|');
        if (k === lastKey) return;
        lastKey = k;
        top.innerHTML = '';
        top.append(ui.h('b', {}, (p.mode === 'move' ? 'Mover: ' : '') + d.name), ui.h('span.grow'));
        if (cost && (nFree > 0 || cost.free)) top.append(ui.h('span.chip.primary', { html: `${icon('🎁', 14)}Gratis${nFree > 1 ? ' x' + nFree : ''}` }));
        else if (cost) top.append(ui.h('span', { html: ui.costHtml(cost, 18) }));
        if (p.count) top.append(ui.h('span.chip.mint', { html: `${icon('check', 12)}${p.count}` }));
        let t;
        if (!p.valid) t = p.why;
        else if (p.paint) t = touch ? 'Tocá el pasto o arrastrá desde la pieza para poner varias' : 'Clic para poner otra · arrastrá desde la pieza para poner varias';
        else if (p.mode === 'move') t = touch ? 'Arrastralo a su lugar nuevo' : 'Arrastralo o hacé clic donde lo querés · R rota · Enter lo deja';
        else t = touch ? 'Arrastralo o tocá donde lo querés' : 'Arrastralo o hacé clic donde lo querés · R rota · Enter coloca';
        hint.textContent = t;
        hint.classList.toggle('bad', !p.valid);
        done.style.display = p.paint && p.count ? '' : 'none';
      },
    };
  }
  function makeCluster() {
    const el = ui.h('div.cx-pc');
    const why = ui.h('div.cx-pc-why');
    const row = ui.h('div.cx-pc-row');
    const b = (cls, ic, label, fn) => {
      const bt = ui.h(`button.cx-pc-b.${cls}`, { html: icon(ic, 24), 'aria-label': label, title: label });
      onPress(bt, fn);
      return bt;
    };
    const bX = b('cx-pc-x', 'close', 'Cancelar (Esc)', () => { audio.sfx('tap'); end(); });
    const bRot = b('cx-pc-rot', 'rotate', 'Rotar (R)', () => rotate());
    const bOk = b('cx-pc-ok', 'check', 'Colocar (Enter)', () => confirm());
    row.append(bX, bRot, bOk);
    el.append(why, row);
    let lx = -1, ly = -1;
    return {
      el,
      update(p) {
        why.textContent = p.valid ? '' : p.why;
        bOk.disabled = !p.valid;
        const ok = p.mode === 'move' ? 'Dejarlo acá (Enter)' : 'Colocar (Enter)';
        bOk.title = ok; bOk.setAttribute('aria-label', ok);
        const x = p.paint && p.count ? 'Terminar (Esc)' : 'Cancelar (Esc)';
        bX.title = x; bX.setAttribute('aria-label', x);
      },
      /** Sigue al fantasma: debajo de la base si entra en pantalla; si no, arriba del techo. */
      place(p) {
        const c = footCenter(p.id, p.x, p.z, p.rot);
        const [w, d] = E.footprint(p.id, p.rot);
        const h = (p.model.userData.height || 0.8) + 0.2;
        // punto más bajo en pantalla de la base y punto más alto del techo
        let low = -Infinity, high = Infinity, sx = 0;
        for (const [ox, oz] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]]) {
          const s = ov.project(tmpV.set(c.x + ox, 0, c.z + oz), {});
          low = Math.max(low, s.y); sx += s.x / 4;
          const t = ov.project(tmpV.set(c.x + ox, h, c.z + oz), {});
          high = Math.min(high, t.y);
        }
        const bw = el.offsetWidth || 170, bh = el.offsetHeight || 60;
        const barTop = bar?.el.offsetTop || H();
        let y = low + 10;
        if (y + bh > barTop - 8) y = high - bh - 8;
        const x = clamp(sx - bw / 2, 8, W() - bw - 8);
        y = clamp(y, 70, barTop - bh - 8);
        if (Math.abs(x - lx) > 0.5 || Math.abs(y - ly) > 0.5) { lx = x; ly = y; el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`; }
      },
    };
  }

  // ---------- cuadro a cuadro ----------
  function frame(dt) {
    if (undo && performance.now() > undo.until) clearUndo();
    const p = placing;
    if (!p) return;
    p.t += dt;
    // paneo automático: arrastrando el fantasma contra un borde, la cámara acompaña
    if (drag) {
      drag.lift += (drag.liftTo - drag.lift) * Math.min(1, dt * 14);
      const ex = drag.cx < EDGE_PX ? -(EDGE_PX - drag.cx) : drag.cx > W() - EDGE_PX ? drag.cx - (W() - EDGE_PX) : 0;
      const topEdge = 60 + EDGE_PX, botEdge = drag.barTop - EDGE_PX * 0.6;
      const ey = drag.cy < topEdge ? -(topEdge - drag.cy) : drag.cy > botEdge ? drag.cy - botEdge : 0;
      // espera un ratito en la franja (pasar de largo por el borde no mueve nada) y arranca suave; con reloj real,
      // no con dt: si los cuadros vienen lentos el renderer recorta dt y la espera no terminaría nunca
      const now = performance.now();
      if (!(ex || ey) || !drag.moved) drag.edgeAt = 0;
      else if (!drag.edgeAt) { drag.edgeAt = now; drag.edgeLast = now; }
      const inEdge = drag.edgeAt ? (now - drag.edgeAt) / 1000 : 0;
      if (inEdge > EDGE_DWELL) {
        const step = Math.min(0.1, (now - drag.edgeLast) / 1000);
        drag.edgeLast = now;
        const k = EDGE_SPEED * step / EDGE_PX * Math.min(1, (inEdge - EDGE_DWELL) / 0.4 + 0.25);
        cam.panScreen(clamp(ex, -EDGE_PX, EDGE_PX) * k, clamp(ey, -EDGE_PX, EDGE_PX) * k);
        dragMove(drag.cx, drag.cy);
      }
    }
    const lifted = drag && !p.paint ? 0.32 : 0.06;
    p.ghost.position.y += (lifted - p.ghost.position.y) * Math.min(1, dt * 16);
    if (p.shake > 0) { p.shake -= dt; p.model.position.x = Math.sin(p.shake * 60) * 0.08 * (p.shake / 0.35); } else p.model.position.x = 0;
    const pulse = 0.66 + Math.sin(p.t * 5) * 0.1;
    MATS.ok.opacity = pulse + 0.06; MATS.bad.opacity = pulse + 0.14; MATS.warn.opacity = pulse + 0.1;
    p.model.userData.update?.(dt);
    pc?.place(p);
  }

  // ---------- capas de casillas (gancho para otras fases) ----------
  function tileLayer(name) {
    if (layers.has(name)) return layers.get(name);
    const meshes = [];
    const L = {
      set(cells = []) {
        while (meshes.length < cells.length) meshes.push(tileMesh('cover', 2));
        while (meshes.length > cells.length) r.scene.remove(meshes.pop());
        cells.forEach((c, i) => {
          const m = meshes[i];
          m.material = MATS[c.tone] || MATS.cover;
          m.position.set(c.x + 0.5 - HALF, roadAt(c.x, c.z) ? ROAD_H + 0.015 : 0.02, c.z + 0.5 - HALF);
        });
      },
      clear() { while (meshes.length) r.scene.remove(meshes.pop()); },
    };
    layers.set(name, L);
    return L;
  }

  return {
    get active() { return !!placing; },
    get state() { return placing; },
    get dragging() { return !!drag; },
    get undoable() { return !!undo; },
    paintable, start, startMove, end, rotate, confirm, moveTo, tap, hitGhost, dragStart, dragMove, dragEnd, cancelDrag,
    key, frame, update, undo: doUndo, clearUndo, rotateBuilding, keepVisible, tileLayer,
    onGhostMove(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    dispose() {
      if (placing) { const p = placing; placing = null; r.scene.remove(p.ghost); for (const m of p.mats) m.dispose(); }
      clearUndo();
      bar?.el.remove(); pc?.el.remove();
      for (const l of layers.values()) l.clear();
      layers.clear(); listeners.clear();
      for (const m of Object.values(MATS)) m.dispose();
      tileGeo.dispose(); tileTex.dispose();
    },
  };
}
