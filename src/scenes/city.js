// Escena principal: la ciudad isométrica en 3D pixel art.
// Mundo + edificios + vida + cámara + construir/mover + cobrar + tutorial suave.
import * as THREE from 'three';
import { createPixelRenderer, addLights } from '../core/voxel.js';
import { buildingModel, constructionModel } from '../city/models.js';
import { icon } from '../core/icons.js';
import { PALETTE } from '../core/palette.js';
import { HALF, footCenter, clamp, easeOutElastic, greeting } from './city-common.js';
import { createWorld } from './city-world.js';
import { createCameraCtl } from './city-camera.js';
import { codeFor, actionFor, keyLabel } from '../core/keys.js';
import { createLife } from './city-life.js';
import { createParticles, createOverlays } from './city-fx.js';
import { createCityAmbience } from './city-ambience.js';
import { createCityGrieta } from './city-grieta.js';
import { createCityAct1 } from './city-act1.js';
import { STYLE, openBuildMenu, openInfo, openExpand, questBuildIds, setThumbTheme } from './city-ui.js';
import { createPlacer, PLACE_STYLE, LONG_PRESS_MS } from './city-place.js';
import { currentThemeId, themeOf } from '../city/themes.js';
import { openThemePicker } from '../city/themes-ui.js';
import { createBatcher } from './city-batch.js';
import { createVisit } from './city-visit.js';
import { activeBoosts } from '../chests/chests.js';
import { eventMult } from '../season/events.js';
import { t } from '../core/i18n.js';
import { heldGear } from '../core/gear.js';
// Amenazas (Fase 3): capa de defensa por turnos, cartel/señales/daño y radio al colocar una defensa
import { attach as attachDefense, createDecor, createCoverage, openPanel as openThreatPanel } from '../threats/threat-scene.js';
// ícono de lo que produce cada edificio (globito y cobro): monedas, gemas o provisiones (Huerta, Tambo…)
const CUR_ICON = { coins: 'coin', gems: 'gem', prov: 'prov', hierbas: 'herbs' };

const TAP_PX = 8;

/** Crea un modelo sin que un error de un modelo rompa la ciudad entera. */
function safe(fn, fallbackSize = [2, 2]) {
  try { const g = fn(); if (g && g.isObject3D) return g; } catch (err) { console.warn('[city] modelo con error', err); }
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.BoxGeometry(fallbackSize[0] * 0.8, 0.6, fallbackSize[1] * 0.8), new THREE.MeshLambertMaterial({ color: 0xffd8c4 }));
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
  let container, r, cam, world, life, fx, ov, styleEl, bGroup, batch, sideEl, collectBtn, tipEl, ro, lights, themeId;
  const entries = new Map();
  const offs = [];
  const myModals = new Set();
  let placer = null;
  let visit = null;
  let cityAmb = null;                             // ambiente: día y noche, clima, luz (city-ambience.js)
  let act1 = null;                                // ecos de noche y el dirigible del abordaje (city-act1.js, paso 6b)
  let grietaFx = null;                            // la Grieta que brilla en el borde de la isla (city-grieta.js, L1)
  let defense = null, decor = null, TA = null;   // amenazas: defensa en curso, decoración y API para su capa
  let syncAcc = 0, disposed = false, batchCollect = false;
  const raycaster = new THREE.Raycaster();
  raycaster.layers.enableAll(); // las mallas de edificios quietos están en otra capa (se dibujan instanciadas)
  const tmpV = new THREE.Vector3();
  let hoverPos = null, hoverDirty = false, hoverT = 0;
  let gameTip = null, signItems = [], collectTip = null, worldTip = null;
  const modelOpts = () => ({ flagColor: ctx.state.city.flagColor, theme: themeId });
  // deco, caminos, Mi Casa y monumentos no se renuevan: siguen a la época de la ciudad
  const drawEra = (b) => (E.hasEra(b) ? (b.era || 1) : E.cityEra());
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
    const e = { b, root, model: null, scaffold: null, mode: null, level: 0, rot: -1, anim: anim ? { type: anim, t: 0 } : null, timer: null, bubble: null, height: 1, placedAt: 0, live: true };
    entries.set(b.uid, e);
    batch.markDirty();
    refreshEntry(e);
    return e;
  }
  function refreshEntry(e, force = false) {
    const b = e.b, now = Date.now();
    const mode = E.isConstructing(b, now) ? 'build' : E.isUpgrading(b, now) ? 'upgrade' : 'done';
    const c = footCenter(b.id, b.x, b.z, b.rot);
    if (e.root.position.x !== c.x || e.root.position.z !== c.z) { e.root.position.x = c.x; e.root.position.z = c.z; batch.markDirty(); }
    if (!force && mode === e.mode && b.level === e.level && b.rot === e.rot && drawEra(b) === e.era) return false;
    batch.markDirty();
    if (e.model) { e.root.remove(e.model); e.model = null; }
    if (e.scaffold) { e.root.remove(e.scaffold); e.scaffold = null; }
    if (mode === 'build') {
      e.scaffold = safe(() => constructionModel(c.w, c.d, themeId), [c.w, c.d]);
      e.root.add(e.scaffold);
      e.height = e.scaffold.userData.height || 0.8;
    } else {
      e.model = safe(() => buildingModel(b.id, b.level, { ...modelOpts(), era: drawEra(b) }), [c.w, c.d]);
      e.model.rotation.y = b.rot * Math.PI / 2;
      e.root.add(e.model);
      e.height = e.model.userData.height || 1;
      if (mode === 'upgrade') {
        e.scaffold = safe(() => constructionModel(c.w, c.d, themeId), [c.w, c.d]);
        e.root.add(e.scaffold);
        e.height = Math.max(e.height, e.scaffold.userData.height || 0.8);
      }
    }
    e.mode = mode; e.level = b.level; e.rot = b.rot; e.era = drawEra(b);
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
    batch.markDirty();
  }

  function ensureTimer(e) {
    if (e.timer) return e.timer;
    const el = ui.h('div.cx-timer', { html: `${icon('hammer', 18)}<span><b></b><i><u></u></i></span>` });
    e.timer = ov.add(el, topPos(e, 0.1));
    e.timer.b = el.querySelector('b'); e.timer.u = el.querySelector('u');
    return e.timer;
  }
  let popSfx = false, quietPops = true;
  function ensureBubble(e, ps) {
    const cls = 'cx-bubble' + (ps.currency === 'gems' ? ' gem' : '') + (ps.full ? ' full' : '');
    if (e.bubble) { if (e.bubble.el.className !== cls) e.bubble.el.className = cls; return; }
    const el = ui.h('div', { class: cls, html: `<div class="cx-bb">${icon(CUR_ICON[ps.currency] || 'coin', 24)}</div>` });
    el.className = cls;
    e.bubble = ov.add(el, topPos(e, 0.2));
    e.bubble.uid = e.b.uid;
    // un solo "pop" por tanda (al entrar a la ciudad aparecen todas juntas sin sonar)
    if (!quietPops) popSfx = true;
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
      const hidden = !!placer?.active;
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
      if (ps.producer && ps.ready && !busy) {
        // durante la colocación se ocultan (sin destruirlas, así no vuelven a "aparecer" todas con sonido)
        ensureBubble(e, ps);
        e.bubble.hidden = hidden || !e.root.visible;
        if (!e.bubble.hidden) ready++;
      } else removeBubble(e);
    }
    if (popSfx) { popSfx = false; audio.sfx('pop'); }
    decor?.sync();
    quietPops = false;
    for (const it of signItems) it.hidden = !!placer?.active;
    if (collectBtn) {
      collectBtn.style.display = ready >= 3 && !placer?.active ? '' : 'none';
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
  // Colocación / mover (lógica en city-place.js)
  // =====================================================================
  function chainVisible(o) { for (; o; o = o.parent) if (!o.visible) return false; return true; }
  function startPlacement(id) { placer?.start(id); }
  function startMove(uid) { placer?.startMove(uid); }
  function rotateBuilding(uid) { placer?.rotateBuilding(uid); }
  function endPlacement(silent = false) { placer?.end(silent); }
  /** La escena se aparta mientras se coloca: sin HUD, botones laterales, globitos ni carteles. */
  function placingStart() {
    cam.clearKeys(); // las flechas pasan a mover el fantasma: que no quede una tecla de cámara "apretada"
    world.showGrid(true);
    ctx.hud.hide();
    sideEl.classList.add('hide');
    syncStatus();
  }
  function placingEnd() {
    world.showGrid(false);
    ctx.hud.show();
    sideEl.classList.remove('hide');
    syncStatus();
  }

  function doExpand() {
    const ex = E.expansionStatus();
    if (!ex) { ui.toast(t('city.land.atMax'), { icon: 'map' }); return false; }
    if (!ex.ok) { audio.sfx('error'); ui.toast(ex.reason, { icon: 'lock' }); return false; }
    if (!store.canAfford(ex.cost)) { audio.sfx('error'); ui.toast(t('city.info.poor'), { icon: 'coin' }); return false; }
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
      if (it.label && !it.covered && Math.abs(dx) < 56 && Math.abs(dy) < 30) return true;
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
    if (defense) { defense.onTap(x, y); return; }   // en la defensa, tocar el piso manda cuadrillas
    if (placer.active) { placer.tap(x, y, type); return; }
    const be = hitBubble(x, y);
    if (be) { E.collect(be.b.uid); return; }
    if (hitSign(x, y)) { audio.sfx('tap'); openExpand(S); return; }
    if (act1?.hit(x, y)) return;
    if (hitWalker(life.player, x, y, 30)) {
      audio.sfx('pop');
      ui.floatText(x, y - 34, t('city.say.change'), 'say');
      setTimeout(() => ctx.router.go('wardrobe'), 420);
      return;
    }
    for (const w of life.npcs) if (hitWalker(w, x, y, 22)) {
      audio.sfx('pop');
      ui.floatText(x, y - 30, greeting(), 'say');
      w.idle = 1.6; w.t = 1; w.tx = w.fx; w.tz = w.fz;
      return;
    }
    const uid = raycastBuilding(x, y);
    if (uid != null) { tapBuilding(uid); return; }
    // el esquife amarra al lado del Establo: los edificios de al lado tienen prioridad sobre él
    if (life.car && life.car.obj.visible && hitWalker(life.car, x, y, 26)) { audio.sfx('swoosh'); return; }
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
  // Un dedo: tocar · arrastrar (paneo, o el fantasma si se agarra de él) · toque largo sobre un edificio = levantarlo
  // para moverlo. Dos dedos: pellizco. Lo de colocar lo resuelve city-place.js.
  const pointers = new Map();
  let gesture = null, down = null, pressTimer = 0;
  function clearPress() { if (pressTimer) { clearTimeout(pressTimer); pressTimer = 0; } }
  function onDown(ev) {
    if (ev.button !== undefined && ev.button > 0 && ev.pointerType === 'mouse') { if (ev.button === 2 && placer.active) endPlacement(); return; }
    S.lastPointer = ev.pointerType === 'mouse' ? 'mouse' : 'touch';
    try { r.canvas.setPointerCapture(ev.pointerId); } catch {}
    pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY, sx: ev.clientX, sy: ev.clientY });
    clearPress();
    if (pointers.size === 1) {
      gesture = 'pending';
      down = { x: ev.clientX, y: ev.clientY, onGhost: placer.hitGhost(ev.clientX, ev.clientY, ev.pointerType), type: ev.pointerType, ts: ev.timeStamp };
      cam.stop();
      if (!placer.active) pressTimer = setTimeout(() => longPress(ev.pointerId), LONG_PRESS_MS);
    } else if (pointers.size === 2) {
      if (gesture === 'pan') cam.endGrab();
      if (gesture === 'ghost') placer.cancelDrag();
      const [a, b] = [...pointers.values()];
      gesture = 'pinch';
      cam.beginPinch(a, b);
    }
  }
  /** Toque largo quieto sobre un edificio: se levanta y sigue al dedo; al soltarlo en un lugar libre queda ahí. */
  function longPress(id) {
    pressTimer = 0;
    const p = pointers.get(id);
    if (disposed || !p || gesture !== 'pending' || pointers.size !== 1 || placer.active || ui.hasModal() || myModals.size) return;
    if (hitBubble(p.sx, p.sy)) return;
    const uid = raycastBuilding(p.sx, p.sy);
    if (uid == null) return;
    if (placer.startMove(uid, { x: p.x, y: p.y, type: down?.type || 'touch' })) { gesture = 'ghost'; if (down) down.lifted = true; }
  }
  function onMove(ev) {
    const p = pointers.get(ev.pointerId);
    if (!p) {
      if (ev.pointerType === 'mouse') {
        S.lastPointer = 'mouse';
        if (placer.active) r.canvas.style.cursor = placer.hitGhost(ev.clientX, ev.clientY, 'mouse') ? 'grab' : '';
        else { hoverPos = { x: ev.clientX, y: ev.clientY }; hoverDirty = true; }
      }
      return;
    }
    p.x = ev.clientX; p.y = ev.clientY;
    if (gesture === 'pinch') {
      if (pointers.size >= 2) { const [a, b] = [...pointers.values()]; cam.movePinch(a, b); }
    } else if (gesture === 'pending') {
      if (Math.hypot(p.x - p.sx, p.y - p.sy) > TAP_PX) {
        clearPress();
        if (down?.onGhost && placer.active) { gesture = 'ghost'; placer.dragStart(p.sx, p.sy, down.type); placer.dragMove(p.x, p.y); r.canvas.style.cursor = 'grabbing'; }
        else { gesture = 'pan'; cam.beginGrab(p.sx, p.sy); cam.moveGrab(p.x, p.y); r.canvas.style.cursor = 'grabbing'; }
      }
    } else if (gesture === 'pan') cam.moveGrab(p.x, p.y);
    else if (gesture === 'ghost') placer.dragMove(p.x, p.y);
  }
  function onUp(ev) {
    const p = pointers.get(ev.pointerId);
    if (!p) return;
    pointers.delete(ev.pointerId);
    clearPress();
    try { r.canvas.releasePointerCapture(ev.pointerId); } catch {}
    if (gesture === 'pinch') {
      cam.endPinch();
      if (pointers.size === 1) { const [q] = [...pointers.values()]; gesture = 'pan'; cam.beginGrab(q.x, q.y); }
      else if (!pointers.size) gesture = null;
      return;
    }
    // Con el hilo trabado (un cuadro pesado, una carga) el soltar puede procesarse después de que venció el toque largo.
    // La hora real del evento manda: si se soltó antes de LONG_PRESS_MS y sin moverse, fue un toque y abre la ficha.
    if (gesture === 'ghost' && down?.lifted && ev.type === 'pointerup' && ev.timeStamp - down.ts < LONG_PRESS_MS && Math.hypot(p.x - p.sx, p.y - p.sy) <= TAP_PX) {
      placer.cancelDrag(); endPlacement(true); gesture = 'pending';
    }
    if (gesture === 'pending' && ev.type === 'pointerup') onTap(ev.clientX, ev.clientY, ev.pointerType);
    else if (gesture === 'pan') cam.endGrab();
    else if (gesture === 'ghost') { if (ev.type === 'pointerup') placer.dragEnd(); else placer.cancelDrag(); }
    if (!pointers.size) { gesture = null; r.canvas.style.cursor = ''; }
  }
  function onWheel(ev) {
    ev.preventDefault();
    const dy = ev.deltaMode === 1 ? ev.deltaY * 30 : ev.deltaY;
    cam.zoomAt(ev.clientX, ev.clientY, Math.exp(clamp(dy, -200, 200) * 0.0018));
  }
  // flechas fijas; el resto sale de Ajustes → Controles (src/core/keys.js)
  const FIXED_KEYS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', NumpadAdd: 'in', NumpadSubtract: 'out' };
  const CAM_ACTS = { up: 'up', down: 'down', left: 'left', right: 'right', zoomIn: 'in', zoomOut: 'out' };
  const camKey = (code) => FIXED_KEYS[code] || CAM_ACTS[actionFor(code, Object.keys(CAM_ACTS))] || null;
  /** Caja del modal que está arriba de todo (o null). */
  function topModalBox() {
    const root = document.getElementById('modal-root');
    const backs = root ? [...root.children].filter(c => c.classList.contains('modal-back') && c.classList.contains('show')) : [];
    return backs.length ? backs[backs.length - 1].querySelector('.modal') : null;
  }
  function onKey(ev) {
    const tag = ev.target?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    // Enter/Espacio sobre un botón con foco: que lo maneje el botón (si no, se ejecutaría dos veces)
    if (tag === 'BUTTON' && (ev.code === 'Enter' || ev.code === 'Space')) return;
    const isDown = ev.type === 'keydown';
    if (isDown && ev.key === 'Escape') {
      // solo cerramos nuestro modal si es el de arriba (los paneles manejan su propio Esc)
      const top = topModalBox();
      const mine = top && [...myModals].find(m => m.el === top);
      if (mine) { mine.close(); ev.preventDefault(); return; }
      if (placer.active && !ui.hasModal()) { endPlacement(); ev.preventDefault(); return; }
    }
    if (ui.hasModal()) { cam.clearKeys(); return; }
    // colocando: R gira, Enter/Espacio coloca, flechas corren el edificio una casilla · Ctrl+Z deshace el último movimiento
    if (placer.key(ev)) { ev.preventDefault(); return; }
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
    const ck = camKey(ev.code);
    if (ck) { cam.key(ck, isDown); ev.preventDefault(); return; }
    if (!isDown || ev.repeat) return;
    if (placer.active) return;
    const act = ev.code === 'Home' ? 'home' : actionFor(ev.code, ['rotL', 'rotR', 'build', 'collect', 'home', 'themes', 'expedition', 'settings', 'journal']);
    if (act === 'rotL') { cam.rotate(-1); audio.sfx('swoosh'); }
    else if (act === 'rotR') { cam.rotate(1); audio.sfx('swoosh'); }
    else if (act === 'build') { audio.sfx('tap'); openBuildMenu(S); }
    else if (act === 'collect') collectAll();
    else if (act === 'home') focusCastle();
    else if (act === 'themes') { audio.sfx('tap'); openThemes(); }
    else if (act === 'expedition') { audio.sfx('tap'); ctx.openPanel('expedition'); }
    else if (act === 'settings') { audio.sfx('tap'); ctx.openPanel('settings'); }
    else if (act === 'journal') { audio.sfx('tap'); ctx.openPanel('story'); }
  }
  // desplazar la cámara con el mouse en los bordes de la ventana (Ajustes → Juego)
  let edgePos = null;
  function onEdgeMove(ev) { edgePos = ev.pointerType === 'mouse' ? { x: ev.clientX, y: ev.clientY } : null; }
  function onEdgeOut(ev) { if (!ev.relatedTarget) edgePos = null; }
  function edgeScroll() {
    const st = ctx.state.settings;
    if (!st.edgeScroll || !edgePos || placer?.active || ui.hasModal() || cam.dragging || !document.hasFocus()) { cam.setEdge(0, 0); return; }
    const M = 14, w = innerWidth, h = innerHeight;
    const right = edgePos.x <= M ? -1 : edgePos.x >= w - M ? 1 : 0;
    const fwd = edgePos.y <= M ? 1 : edgePos.y >= h - M ? -1 : 0;
    cam.setEdge(fwd, right);
  }
  function applySettings() {
    const st = ctx.state.settings;
    cam?.setSpeed(st.camSpeed || 1);
    if (homeBtnEl) homeBtnEl.title = `${t('city.side.home')} (${keyLabel(codeFor('home'))})`;
    if (rotBtnEl) rotBtnEl.title = `${t('city.side.rotate')} (${keyLabel(codeFor('rotL'))} / ${keyLabel(codeFor('rotR'))})`;
    if (themeBtnEl) themeBtnEl.title = `${t('city.side.style')} (${keyLabel(codeFor('themes'))})`;
  }
  /** Textos de los botones flotantes: al armarlos y cuando cambia el idioma. */
  function applyLang() {
    if (collectBtn) { collectBtn.querySelector('span').textContent = t('city.side.collectAll'); collectBtn.setAttribute('aria-label', t('city.side.collectAll')); }
    homeBtnEl?.setAttribute('aria-label', t('city.side.home'));
    rotBtnEl?.setAttribute('aria-label', t('city.side.rotate'));
    themeBtnEl?.setAttribute('aria-label', t('city.side.style'));
    applySettings();
  }
  let homeBtnEl = null, rotBtnEl = null, themeBtnEl = null;
  function onBlur() { cam?.clearKeys(); }
  function onVisibility() { if (document.hidden) r.stop(); else r.start(); }

  function collectAll() {
    const ready = [...entries.values()].filter(e => E.producerStatus(e.b).ready);
    if (!ready.length) return;
    batchCollect = ready.length > 3;
    E.collectAll();
    batchCollect = false;
  }
  let themesOpen = false;
  function openThemes() {
    if (themesOpen) return;
    themesOpen = true;
    Promise.resolve(openThemePicker(ctx)).catch(err => console.warn('[city] temas', err)).finally(() => { themesOpen = false; });
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
  /** side: 'top' (arriba del punto), 'left' (a la izquierda) o 'right' (a la derecha). */
  function showTip(html, x, y, side = 'top') {
    if (!tipEl) {
      tipEl = ui.h('div.cx-tip', { html: '<span></span><i></i>' });
      container.append(tipEl);
    }
    const sp = tipEl.firstChild;
    if (sp.innerHTML !== html) sp.innerHTML = html;
    const cls = 'cx-tip' + (side === 'top' ? '' : ' ' + side);
    if (tipEl.className !== cls) tipEl.className = cls;
    if (side === 'top') {
      tipEl.style.left = clamp(x, 120, innerWidth - 120) + 'px';
      tipEl.querySelector('i').style.marginLeft = ((x - clamp(x, 120, innerWidth - 120)) * 2) + 'px';
    } else {
      tipEl.style.left = x + 'px';
      tipEl.querySelector('i').style.marginLeft = '';
    }
    tipEl.style.top = y + 'px';
    tipEl.style.display = '';
  }
  function hideTip() { if (tipEl) tipEl.style.display = 'none'; }
  function clearGameTip() { if (gameTip) { ov.remove(gameTip.item); gameTip = null; } }
  function setWorldTip(kind, e, html) {
    if (worldTip && worldTip.kind === kind && worldTip.e === e) { worldTip.item.pos.copy(topPos(e, 0.2)); return; }
    if (worldTip) ov.remove(worldTip.item);
    // el cartelito va arriba de la burbuja (cobrar) o del techo (jugar), sin taparlos
    const el = ui.h('div.cx-tagwrap', {}, ui.h('div.cx-tag', { html }));
    el.style.paddingBottom = kind === 'collect' ? '64px' : '12px';
    worldTip = { kind, e, item: ov.add(el, topPos(e, 0.2)) };
  }
  /** Burbuja para el cartelito "¡Tocá para cobrar!": una cuyo cartel (arriba) no tape otras burbujas. */
  function pickTipBubble() {
    const k = ov.scale;
    const list = [...entries.values()].filter(e => e.bubble && e.bubble.onScreen && !e.bubble.hidden);
    if (!list.length) return null;
    const TW = 190 * k / 2, TOP = (64 + 34) * k, BOT = 58 * k; // cartel: ancho y franja vertical sobre la burbuja
    const covers = (e) => list.some(o => o !== e && Math.abs(o.bubble.sx - e.bubble.sx) < TW + 22 * k
      && o.bubble.sy - 52 * k < e.bubble.sy - BOT && o.bubble.sy > e.bubble.sy - TOP);
    // que el cartel no quede debajo del HUD de arriba ni afuera de la pantalla
    const hb = document.querySelector('#hud:not(.hidden) .hud-stats')?.getBoundingClientRect();
    const minY = (hb && hb.height ? hb.bottom : 110) + 6;
    const W = container.clientWidth || innerWidth;
    const fits = (e) => e.bubble.sy - TOP > minY && e.bubble.sx - TW > 4 && e.bubble.sx + TW < W - 4;
    const good = (e) => fits(e) && !covers(e);
    // la actual se queda mientras siga sirviendo (que no salte de burbuja en burbuja)
    if (worldTip?.kind === 'collect' && list.includes(worldTip.e) && good(worldTip.e)) return worldTip.e;
    let pool = list.filter(good);
    if (!pool.length) pool = list.filter(fits);
    if (!pool.length) return null;
    // la más cercana al centro de la pantalla
    const cx = W / 2, cy = (container.clientHeight || innerHeight) / 2;
    const dist = (e) => Math.hypot(e.bubble.sx - cx, e.bubble.sy - cy);
    return pool.reduce((a, e) => (dist(e) < dist(a) ? e : a), pool[0]);
  }
  function clearWorldTip() { if (worldTip) { ov.remove(worldTip.item); worldTip = null; } }
  // ---------- Flecha guiada (plan §E3): señala lo que pide la misión actual ----------
  const EXP_GOALS = ['expedition', 'zone', 'expStars', 'expFar', 'combat', 'element', 'flag'];
  const entryOf = (id) => [...entries.values()].find(e => e.b.id === id && !e.b.buildEnd);
  /** A dónde apunta la flecha para la misión q: {el, side, text, panel} (botón del HUD), {entry, text} (edificio) o {sign}. */
  function guideTarget(q) {
    const gt = q.goal.type;
    if (EXP_GOALS.includes(gt) && !(gt === 'combat' && q.goal.enc === 'costa_capitana') && entryOf('casa_exp')) return { el: '[data-act="expedition"]', side: 'left', panel: 'expedition', text: icon('expedition', 20) + t('city.guide.expedition') };
    if (gt === 'craft' && entryOf('taller')) return { entry: 'taller', panel: 'workshop', text: icon('hammer', 18) + t('city.guide.workshop') };
    if (gt === 'prov' && entryOf('huerta')) return { entry: 'huerta', text: icon('prov', 18) + t('city.guide.garden') };
    if (gt === 'castle' || gt === 'rank') return { el: '.hud-rank', side: 'right', panel: 'rank', text: icon('castle', 20) + t('city.guide.rank') };
    if (gt === 'threat' && document.querySelector('#hud [data-act="threat"]')?.style.display !== 'none') return { el: '[data-act="threat"]', side: 'right', panel: 'threat', text: icon('bolt', 20) + t('city.guide.threat') };
    if (gt === 'expand') return { sign: true };
    if (gt === 'story') return { el: '[data-act="story"]', side: 'left', panel: 'story', text: icon('journal', 20) + t('city.guide.journal') };
    return null;
  }
  let guideSign = false;
  function updateTutorial() {
    const blocked = placer?.active || myModals.size || ui.hasModal();
    const hints = ctx.state.settings.hints !== false;
    const q = ctx.quests.mainQuest();
    const tgt = hints && q && !q.done && !T()['q_' + q.id] ? guideTarget(q) : null;
    // flecha a un botón del HUD: Construir (por defecto) o el que pida la misión
    let tipText = null, tipSel = '.hud-btn.big', side = 'top';
    if (!T().cityIntro && ctx.state.city.buildings.length <= 1) tipText = icon('hammer', 20) + t('city.guide.build');
    else if (tgt?.el) { tipText = tgt.text; tipSel = tgt.el; side = tgt.side; }
    else if (hints && q && !q.done && !tgt && !T()['q_' + q.id] && !(q.goal.type === 'pop' || q.goal.type === 'happy')) {
      const ids = questBuildIds(ctx).filter(id => E.canBuild(id).ok);
      if (ids.length) tipText = icon('quest', 20) + t('city.guide.questBuild', { name: ui.esc(E.def(ids[0]).name) });
    }
    const btn = document.querySelector(`#hud:not(.hidden) ${tipSel}`);
    const rc = btn?.getBoundingClientRect();
    if (tipText && !blocked && rc?.width && btn.style.display !== 'none') {
      if (side === 'left') showTip(tipText, rc.left - 8, rc.top + rc.height / 2, 'left');
      else if (side === 'right') showTip(tipText, rc.right + 8, rc.top + rc.height / 2, 'right');
      else showTip(tipText, rc.left + rc.width / 2, rc.top - 6);
      // si se pisa con una tarjeta de la historia (Vera presentando la ciudad, a 1280×800), la guía es ella: la flecha espera
      const card = document.querySelector('#story-root .st-card:not(.bark):not(.out)');
      if (card && tipEl) {
        const a = tipEl.getBoundingClientRect(), b = card.getBoundingClientRect();
        if (a.left < b.right + 8 && a.right > b.left - 8 && a.top < b.bottom + 8 && a.bottom > b.top - 8) hideTip();
      }
    } else hideTip();
    // carteles de terreno: se marcan mientras la misión pide ampliar
    const wantSign = !!tgt?.sign && !blocked;
    if (wantSign !== guideSign) { guideSign = wantSign; for (const it of signItems) it.el?.classList.toggle('guide', wantSign); }
    // cartel arriba de un edificio: la Huerta o el Taller que pide la misión, o el primer cobro
    const guideEntry = tgt?.entry && !blocked ? entryOf(tgt.entry) : null;
    const firstBubble = !T().collect && !blocked && !guideEntry ? pickTipBubble() : null;
    if (guideEntry) setWorldTip(guideEntry.bubble ? 'collect' : 'guide', guideEntry, tgt.text);
    else if (firstBubble) setWorldTip('collect', firstBubble, icon('coin', 18) + t('city.guide.collect'));
    else if (gameTip && !blocked && entries.has(gameTip.uid)) setWorldTip('game', entries.get(gameTip.uid), icon('dress', 18) + t('city.guide.wardrobe'));
    else clearWorldTip();
    if (gameTip && performance.now() > gameTip.until) gameTip = null;
  }
  /** La flecha de la misión actual ya cumplió (se abrió lo que señalaba): se apaga hasta la próxima misión. */
  function guideDone(match) {
    const q = ctx.quests.mainQuest();
    if (!q) return;
    const tgt = guideTarget(q);
    if (tgt && match(tgt)) { setFlag('q_' + q.id); syncStatus(); }
  }

  // =====================================================================
  // Eventos
  // =====================================================================
  function floatAt(e, html, cls = '') {
    const s = screenOf(topPos(e, 0.3));
    ui.floatText(s.x, s.y, html, cls);
  }
  function bindEvents() {
    offs.push(bus.on('hud:build', (p) => { if (placer.active) endPlacement(true); setFlag('cityIntro'); const q = ctx.quests.mainQuest(); if (q && !guideTarget(q)) setFlag('q_' + q.id); openBuildMenu(S, p?.focus || null); }));
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
      fx.sparkle(c.x, e.height * 0.5, c.z);
      setTimeout(() => !disposed && floatAt(e, 'Listo'), 120);
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
      // confeti solo en los momentos grandes: subir de rango (Municipalidad) o terminar un monumento
      const big = b.id === 'castillo' || (E.def(b).cat === 'monumento' && level >= E.maxLevel(b));
      if (big) fx.confetti(c.x, e.height * 0.8, c.z);
      fx.sparkle(c.x, e.height * 0.6, c.z, [PALETTE.slate, '#ffffff', PALETTE.gold]);
      // casas y negocios: el cartel cuenta qué cambia en la estructura (arte por época y nivel)
      const d = E.def(b);
      const extra = (d.cat === 'casa' || d.cat === 'negocio') && d.prod && level >= 2 && level <= 5 ? ` · ${t('city.float.new.' + level)}` : b.id === 'castillo' ? ` · ${E.rankName(level)}` : '';
      setTimeout(() => !disposed && floatAt(e, icon('star', 22) + t('city.float.level', { n: level }) + extra), 120);
      if (big) ui.confetti();
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
    offs.push(bus.on('production:full', () => { ui.toast(t('city.toast.provFull'), { icon: 'prov' }); }));
    offs.push(bus.on('production:collected', ({ b, amount, currency }) => {
      const e = entries.get(b.uid);
      if (!e) return;
      const s = screenOf(topPos(e, 0.5));
      const n = batchCollect ? 2 : clamp(Math.round(amount / 12) + 3, 3, 8);
      ui.flyCurrency(s.x, s.y, currency, currency === 'gems' ? Math.min(n, 4) : n);
      ui.floatText(s.x, s.y - 18, `+${E.fmtNum(amount)} ${icon(CUR_ICON[currency] || 'coin', 22)}`);
      removeBubble(e, true);
      if (!e.anim) e.anim = { type: 'squish', t: 0 };
      fx.sparkle(e.root.position.x, e.height + 0.2, e.root.position.z, currency === 'gems' ? ['#8fd3ff', '#ffffff', '#d4efff'] : currency === 'prov' ? ['#d9b46a', '#ffffff', '#9ccf7a'] : ['#ffd166', '#ffffff', '#fff0c2']);
      setFlag('collect');
      if (currency === 'prov') guideDone(t => t.entry === 'huerta');
      if (worldTip?.kind === 'collect' || worldTip?.kind === 'guide') clearWorldTip();
    }));
    offs.push(bus.on('city:expanded', ({ bounds }) => {
      guideDone(t => !!t.sign);
      world.animateExpand(bounds, !!E.expansionInfo());
      rebuildSignLabels();
      life.refreshGrid();
      audio.sfx('clear');
      setTimeout(() => !disposed && audio.sfx('done'), 500);
      cam.flyTo(0.5, 1, Math.max(cam.st.u, Math.min(26, bounds.side * 0.95)));
      if (placer.active) placer.update();
    }));
    offs.push(bus.on('level:up', () => { rebuildSignLabels(); }));
    // nuevo rango: carteles de terreno al día y festejo con el panel "Tu ciudad"
    offs.push(bus.on('town:rankup', ({ rank } = {}) => {
      rebuildSignLabels();
      setTimeout(() => { if (!disposed && !ctx.router.visiting) ctx.openPanel('rank', { celebrate: rank }); }, 900);
    }));
    // otro panel pide abrir la ficha de un edificio (p. ej. "Ver Municipalidad" en el panel de rango)
    // panel de Obras → "Construir" un monumento: arranca la colocación como desde el menú
    offs.push(bus.on('city:place', ({ id } = {}) => { if (!disposed && id) setTimeout(() => { if (!disposed) startPlacement(id); }, 260); }));
    offs.push(bus.on('city:focus', ({ uid } = {}) => { if (!disposed && entries.has(uid)) setTimeout(() => { if (!disposed) openInfo(S, uid); }, 260); }));
    // pedidos de goalAction (panels-common.js): cámara a un edificio, a un cartel de terreno o cobrar todo
    offs.push(bus.on('city:highlight', ({ id, uid } = {}) => {
      if (disposed) return;
      const e = uid != null ? entries.get(uid) : entryOf(id);
      if (e) setTimeout(() => !disposed && highlightBuilding(e.b.uid), 200);
    }));
    offs.push(bus.on('city:sign', () => {
      if (disposed) return;
      const sg = world.signs?.[0];
      if (sg) cam.flyTo(sg.pos.x, sg.pos.z);
      guideDone(t => !!t.sign);
    }));
    offs.push(bus.on('city:collect', () => { if (!disposed) setTimeout(() => !disposed && collectAll(), 200); }));
    // la flecha se apaga cuando se abre lo que señalaba
    offs.push(bus.on('panel:open', ({ name } = {}) => guideDone(t => t.panel === name)));
    offs.push(bus.on('threat:panel', () => guideDone(t => t.panel === 'threat')));
    offs.push(bus.on('leader:changed', () => { if (!disposed) life.rebuildPlayer(); }));   // la clase cambia el arma en la mano
    // el arma equipada del Arsenal también (paso 2a): solo si cambió la que lleva quien lidera
    let heldNow = heldGear('lider', ctx.state);
    offs.push(bus.on('arsenal:changed', () => { const g = heldGear('lider', ctx.state); if (!disposed && g !== heldNow) { heldNow = g; life.rebuildPlayer(); } }));
    offs.push(bus.on('customize:changed', ({ target }) => {
      if (target === 'avatar') life.rebuildPlayer();
      else if (target === 'car') life.rebuildCar();
    }));
    offs.push(bus.on('builders:changed', () => syncStatus()));
    offs.push(bus.on('building:mastery', ({ b, stars } = {}) => {
      const e = b && entries.get(b.uid);
      if (!e) return;
      const c = e.root.position;
      fx.sparkle(c.x, e.height * 0.7, c.z, ['#ffd166', '#ffffff', '#f1a181']);
      setTimeout(() => !disposed && floatAt(e, icon('star', 22) + t('city.float.mastery', { n: stars })), 450);
    }));
    offs.push(bus.on('city:theme', ({ theme } = {}) => setTheme(theme || currentThemeId(ctx.state))));
    offs.push(bus.on('city:flag', () => {
      for (const e of entries.values()) if (e.b.id === 'castillo') refreshEntry(e, true);
    }));
  }

  // =====================================================================
  // Tema de la ciudad
  // =====================================================================
  function makeWorld() {
    return createWorld(r, { theme: themeId, bounds: { ...E.landBounds(), canExpand: !!E.expansionInfo() }, hooks: {
      onPoof: (x, z) => fx.poof(x, 0.3, z),
      onTileReveal: (x, z) => { if (Math.random() < 0.5) fx.sparkle(x, 0.1, z, ['#c4f7e8', '#ffffff', '#ffd166']); },
    } });
  }
  /** Cielo (CSS detrás del canvas) y luces del tema. */
  function applyThemeLook() {
    const T = themeOf(themeId);
    container.style.setProperty('--cx-sky', T.sky);
    container.style.setProperty('--cx-stars', String(T.stars));
    const L = T.lights;
    lights.hemi.color.setHex(L.sky); lights.hemi.groundColor.setHex(L.ground); lights.hemi.intensity = L.hemi;
    lights.sun.color.setHex(L.sun); lights.sun.intensity = L.sunI;
    cityAmb?.setTheme(T);
    setThumbTheme(themeId);
  }
  /** Cambia el tema en vivo: mundo nuevo, edificios recoloreados (geometrías cacheadas por tema). */
  function setTheme(id) {
    const next = themeOf(id).id;
    if (next === themeId) return;
    themeId = next;
    if (placer.active) endPlacement(true);
    world.dispose();
    world = makeWorld();
    world.setCamAngle(cam.angle);
    for (const e of entries.values()) refreshEntry(e, true);
    batch.markDirty();
    rebuildSignLabels();
    applyThemeLook();
    life.refreshGrid();
  }

  function rebuildSignLabels() {
    for (const it of signItems) ov.remove(it);
    signItems = [];
    const ex = E.expansionStatus();
    if (!ex) { world.refreshSigns(false); return; }
    if (world.signs.length === 0) world.refreshSigns(true);
    const lvOk = ex.ok;
    for (const s of world.signs) {
      // si todavía no llega al nivel o al rango, el cartel lo dice (así sabe cuándo podrá crecer)
      const el = ui.h('div.cx-sign' + (lvOk ? '' : '.locked'), { html: lvOk ? `${icon('plus', 16)}Expandir` : `${icon('lock', 14)}${ui.esc(ex.short)}` });
      const it = ov.add(el, s.pos);
      it.label = true;
      it.hidden = !!placer?.active;
      signItems.push(it);
    }
  }

  // =====================================================================
  // Loop
  // =====================================================================
  function frame(dt, t) {
    edgeScroll();
    cam.update(dt);
    world.setCamAngle(cam.angle);
    world.update(dt, t);
    for (const e of entries.values()) {
      e.model?.userData.update?.(dt, t);
      e.scaffold?.userData.update?.(dt, t);
      if (e.anim) animateEntry(e, dt);
      // animándose u oculto (mientras se mueve) -> se dibuja suelto; quieto -> instanciado
      const live = !!e.anim || !e.root.visible;
      if (live !== e.live) { e.live = live; batch.markDirty(); }
    }
    batch.update(entries.values());
    life.setCamAngle(cam.angle);
    life.update(dt, t);
    fx.update(dt);
    cityAmb?.update(dt);
    grietaFx?.update(dt);
    act1?.update(dt);
    decor?.update(dt); defense?.update(dt);
    placer.frame(dt, t);
    hoverT += dt;
    if (hoverDirty && hoverT > 0.08 && !placer.active && !cam.dragging) {
      hoverDirty = false; hoverT = 0; // el raycast contra toda la ciudad es caro: ~12 veces por segundo alcanza
      const hv = hoverPos && (hitBubble(hoverPos.x, hoverPos.y) || hitSign(hoverPos.x, hoverPos.y) || act1?.hover(hoverPos.x, hoverPos.y) || hitWalker(life.player, hoverPos.x, hoverPos.y, 30) || raycastBuilding(hoverPos.x, hoverPos.y) != null);
      r.canvas.style.cursor = hv ? 'pointer' : '';
    }
    syncAcc += dt;
    if (syncAcc > 0.25) { syncAcc = 0; syncStatus(); }
    ov.update();
    declutterSigns();
    boostFx(dt);
  }

  /** Los carteles "Expandir" se esconden si chocan con un reloj de obra o una burbuja (esos tienen prioridad). */
  const elW = (it, def) => it.w || ((it.w = it.el.offsetWidth) || def);
  // los avisos de arriba (#toast-root, p. ej. «Premio de tu primer día») también tapan carteles: se miden cada 200 ms
  let toastRects = [], toastAt = 0;
  function measureToasts() {
    const now = performance.now();
    if (now < toastAt) return toastRects;
    toastAt = now + 200;
    const ts = document.querySelectorAll('#toast-root .toast');
    if (!ts.length) return (toastRects = []);
    const c = container.getBoundingClientRect();
    return (toastRects = [...ts].map(t => { const r = t.getBoundingClientRect(); return { l: r.left - c.left, r: r.right - c.left, t: r.top - c.top, b: r.bottom - c.top }; }));
  }
  function declutterSigns() {
    if (!signItems.length) return;
    const k = ov.scale, toasts = measureToasts();
    for (const sg of signItems) {
      if (!sg.onScreen) continue;
      const sw = elW(sg, 100) * k / 2, sb = sg.sy - 4 * k, st = sb - 30 * k;
      let hit = toasts.some(r => sg.sx + sw > r.l - 6 && sg.sx - sw < r.r + 6 && st < r.b + 6 && sb > r.t - 6);
      for (const e of hit ? [] : entries.values()) {
        for (const it of [e.timer, e.bubble]) {
          if (!it || !it.onScreen) continue;
          const isT = it === e.timer;
          const w = (isT ? elW(it, 90) : 46) * k / 2, b = it.sy - (isT ? 6 : 0) * k, t = b - (isT ? 36 : 52) * k;
          if (Math.abs(it.sx - sg.sx) < w + sw && t < sb && b > st) { hit = true; break; }
        }
        if (hit) break;
      }
      if (hit !== !!sg.covered) { sg.covered = hit; sg.el.style.visibility = hit ? 'hidden' : ''; }
    }
  }

  /** Brillitos dorados suaves sobre los negocios mientras hay poción de producción o evento de doble producción. */
  let boostAcc = 0, boostIdx = 0, boostCheck = 0, boostOn = false;
  function boostFx(dt) {
    boostCheck -= dt;
    if (boostCheck <= 0) {
      boostCheck = 1;
      let on = false;
      try { on = !!activeBoosts().prod || eventMult('production') > 1; } catch { on = false; }
      boostOn = on;
    }
    if (!boostOn || placer?.active || document.hidden) return;
    boostAcc += dt;
    if (boostAcc < 0.32) return;
    boostAcc = 0;
    const now = Date.now();
    const shops = [];
    for (const e of entries.values()) {
      const d = E.def(e.b);
      if (d.cat === 'negocio' && d.prod && e.root.visible && !E.isBusy(e.b, now)) shops.push(e);
    }
    if (!shops.length) return;
    const e = shops[boostIdx++ % shops.length];
    const c = e.root.position;
    fx.burst(c.x, e.height * 0.55, c.z, { n: 4, colors: ['#ffd166', '#ffd166', '#fff0c2', '#ffffff'], speed: 0.35, up: 0.9, gravity: -0.35, size: 0.075, life: 1.6, spread: Math.max(0.6, e.height * 0.6), drag: 2.2 });
  }

  // =====================================================================
  // Amenazas: defensa por turnos sobre la ciudad (src/threats/threat-scene.js)
  // =====================================================================
  function startDefense(id) {
    if (defense || disposed) return;
    if (placer?.active) endPlacement(true);
    for (const m of [...myModals]) m.close();
    const d = attachDefense(TA, id);
    if (!d) return;
    defense = d;
    TA.hidden = true;
    ctx.hud.hide(); sideEl.classList.add('hide'); hideTip(); clearWorldTip();
    for (const e of entries.values()) if (e.bubble) e.bubble.hidden = true;
    decor?.sync();
  }
  function endDefense() {
    if (!defense) return;
    defense.detach(); defense = null;
    TA.hidden = false;
    if (!disposed) { ctx.hud.show(); sideEl.classList.remove('hide'); syncStatus(); }
  }
  function highlightBuilding(uid) {
    const e = entries.get(uid);
    if (!e) return;
    cam.flyTo(e.root.position.x, e.root.position.z + 0.5);
    e.anim = { type: 'hop', t: 0 };
    setTimeout(() => { if (!disposed && entries.get(uid) === e) fx.sparkle(e.root.position.x, e.height + 0.2, e.root.position.z, ['#ffd166', '#ffffff', '#6fe3c1']); }, 350);
  }

  // =====================================================================
  // Montaje
  // =====================================================================
  return {
    hud: true,
    music: 'city',
    async mount(el, params = {}) {
      // modo visita (contrato): ciudad de una amiga, solo lectura
      if (params?.visit) { visit = createVisit(ctx); return visit.mount(el, params); }
      container = el;
      styleEl = document.createElement('style');
      styleEl.id = 'city-style';
      styleEl.textContent = STYLE + PLACE_STYLE;
      document.head.append(styleEl);
      const lowQ = !!ctx.state.settings?.lowQuality;
      // contorno tinta alrededor de las siluetas (voxel.js): separa edificios, árboles y vecinas del pasto
      r = createPixelRenderer(container, { background: null, viewSize: 14, lowQuality: lowQ, outline: true, idleFps: 30 });
      r.renderer.setClearColor(0x000000, 0);
      lights = addLights(r.scene, { shadowSize: 50, shadowRes: lowQ ? 1024 : 2048 });
      const { sun } = lights;
      sun.shadow.camera.far = 120;
      // sol de costado: las dos paredes que se ven quedan con tonos distintos (se lee el volumen)
      sun.position.set(17, 26, 5);
      sun.shadow.camera.updateProjectionMatrix();
      themeId = currentThemeId(ctx.state);
      applyThemeLook();

      fx = createParticles(r.scene);
      world = makeWorld();
      bGroup = new THREE.Group();
      bGroup.name = 'buildings';
      r.scene.add(bGroup);
      batch = createBatcher(r.scene);
      for (const b of ctx.state.city.buildings) createEntry(b);
      life = createLife(r, ctx);

      cam = createCameraCtl(r, ctx.state.city.camera, { onChange: (c) => { ctx.state.city.camera = c; store.markDirty(); }, limit: () => E.landBounds().side / 2 + 2.5 + (act1?.limitBonus || 0) });
      ov = createOverlays(container, r);
      ro = new ResizeObserver(() => { cam.applyProj(); ov.resize(); });
      ro.observe(container);
      placer = createPlacer({ ctx, r, ov, cam, container, entries, S, safe, modelOpts, themeId: () => themeId, onStart: placingStart, onEnd: placingEnd });
      S.place = placer;

      // botones flotantes
      sideEl = ui.h('div.cx-side');
      collectBtn = ui.h('button.cx-collect', { html: `${icon('coin', 24)}<span></span><i class="badge">0</i>` });
      collectBtn.style.display = 'none';
      collectBtn.addEventListener('click', () => collectAll());
      const homeBtn = ui.h('button.cx-fab', { html: icon('castle', 30) });
      homeBtn.addEventListener('click', focusCastle);
      const rotBtn = ui.h('button.cx-fab', { html: icon('rotate', 30) });
      rotBtn.addEventListener('click', () => { cam.rotate(1); audio.sfx('swoosh'); });
      const themeBtn = ui.h('button.cx-fab', { html: icon('palette', 30) });
      themeBtn.addEventListener('click', () => { audio.sfx('tap'); openThemes(); });
      sideEl.append(collectBtn, homeBtn, rotBtn, themeBtn);
      homeBtnEl = homeBtn; rotBtnEl = rotBtn; themeBtnEl = themeBtn;
      applyLang();
      offs.push(bus.on('settings:changed', applySettings), bus.on('lang:changed', applyLang));
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
      addEventListener('pointermove', onEdgeMove, { passive: true });
      document.addEventListener('pointerout', onEdgeOut);
      document.addEventListener('visibilitychange', onVisibility);

      TA = { ctx, r, ov, entries, fx, cam, container, sideEl, HALF, get world() { return world; }, topPos: (e, extra) => topPos(e, extra),
        startDefense, onDefenseEnd: endDefense, highlight: highlightBuilding, hidden: false };
      decor = createDecor(TA);
      cityAmb = createCityAmbience({ ctx, r, lights, container, fx, cam, entries, getTheme: () => themeOf(themeId),
        threatWeather: () => decor?.weather || null, hidden: () => !!placer?.active });
      grietaFx = createCityGrieta({ ctx, r });
      act1 = createCityAct1({ ctx, r, container, cam, screenOf, night: () => !!cityAmb?.night });
      // radio de cobertura al colocar o mover una defensa (Fase 3 sobre el gancho de city-place.js)
      let cov = null;
      const dropCov = () => { cov?.dispose(); cov = null; };
      offs.push(placer.onGhostMove((info) => {
        if (!info || E.def(info.id)?.cat !== 'defensa') return dropCov();
        cov ??= createCoverage(TA);
        const level = info.uid != null ? (entries.get(info.uid)?.b.level || 1) : 1;
        cov.update(info.id, info.x, info.z, info.rot, level);
      }));
      offs.push(dropCov);
      offs.push(bus.on('threat:defend', ({ id } = {}) => { if (id) startDefense(id); }));
      offs.push(bus.on('threat:panel', () => openThreatPanel(TA)));
      bindEvents();
      rebuildSignLabels();
      syncStatus();
      if (params.defense) setTimeout(() => !disposed && startDefense(params.defense), 400);
      r.onFrame(frame);
      r.start();
      // gancho de depuración para pruebas headless (tools/smoke.mjs)
      if (window.__pixelia) window.__pixelia.city = { r, cam, entries, life, get world() { return world; }, ov, S, batch, get placing() { return placer?.state || null; }, get placer() { return placer; }, get theme() { return themeId; }, openThemes, get defense() { return defense; }, get decor() { return decor; }, get coverage() { return cov; }, get ambience() { return cityAmb; }, get grieta() { return grietaFx; }, get act1() { return act1; } };
      if (params.build) setTimeout(() => !disposed && openBuildMenu(S, typeof params.build === 'string' && E.def(params.build) ? params.build : null), 300);
    },
    unmount() {
      disposed = true;
      if (visit) { const v = visit; visit = null; v.unmount(); return; }
      if (window.__pixelia?.city?.r === r) delete window.__pixelia.city;
      if (defense) { defense.detach(); defense = null; }
      decor?.dispose(); decor = null;
      cityAmb?.dispose(); cityAmb = null;
      grietaFx?.dispose(); grietaFx = null;
      act1?.dispose(); act1 = null;
      offs.forEach(f => f()); offs.length = 0;
      removeEventListener('keydown', onKey);
      removeEventListener('keyup', onKey);
      removeEventListener('blur', onBlur);
      removeEventListener('pointermove', onEdgeMove);
      document.removeEventListener('pointerout', onEdgeOut);
      document.removeEventListener('visibilitychange', onVisibility);
      ro?.disconnect();
      for (const m of [...myModals]) m.close();
      if (placer?.active) ctx.hud.show();
      clearPress();
      placer?.dispose();
      if (cam) { ctx.state.city.camera = cam.save(); store.markDirty(); }
      ov?.dispose();
      tipEl?.remove();
      sideEl?.remove();
      life?.dispose();
      world?.dispose();
      fx?.dispose();
      batch?.dispose();
      entries.clear();
      r?.dispose();
      styleEl?.remove();
    },
  };
}
