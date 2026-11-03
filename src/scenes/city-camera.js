// Cámara isométrica de la ciudad: arrastrar, pellizcar, rueda, inercia, rotación 90° y teclado.
import * as THREE from 'three';
import { setIsoCamera } from '../core/voxel.js';
import { HALF, clamp, angleDelta } from './city-common.js';

export const U_MIN = 6;    // unidades de mundo visibles en el lado corto (zoom máximo)
export const U_MAX = 34;   // zoom mínimo (se ve toda la isla)
const PITCH = 0.62;
const LIMIT = HALF + 1.5;

/** limit(): medio lado (en unidades) del área donde puede quedar el centro de la cámara (el terreno + un margen). */
export function createCameraCtl(r, saved, { onChange, limit } = {}) {
  const cam = r.camera;
  const size = () => ({ w: r.canvas.clientWidth || innerWidth, h: r.canvas.clientHeight || innerHeight });
  const phone = Math.min(innerWidth, innerHeight) < 600;
  const st = {
    x: Number.isFinite(saved?.x) ? saved.x : 0.5,
    z: Number.isFinite(saved?.z) ? saved.z : 1.5,
    u: clamp(Number.isFinite(saved?.u) ? saved.u : (phone ? 11 : 17), U_MIN, U_MAX),
    rot: ((saved?.rot | 0) % 4 + 4) % 4,
  };
  st.angle = Math.PI / 4 + st.rot * Math.PI / 2;
  let targetAngle = st.angle;
  const vel = { x: 0, z: 0 };
  const target = new THREE.Vector3();
  let grab = null, grabT = 0;
  let pinch = null;
  let fly = null;
  const keys = new Set();
  let changed = false, changeTimer = 0;

  function applyProj() {
    const { w, h } = size();
    const vs = st.u * h / Math.min(w, h);
    const aspect = w / h;
    cam.userData.viewSize = vs;
    cam.left = -vs * aspect / 2; cam.right = vs * aspect / 2; cam.top = vs / 2; cam.bottom = -vs / 2;
    cam.updateProjectionMatrix();
  }
  function apply() {
    const L = Math.min(LIMIT, limit?.() ?? LIMIT);
    st.x = clamp(st.x, -L, L);
    st.z = clamp(st.z, -L, L);
    applyProj();
    target.set(st.x, 0, st.z);
    setIsoCamera(cam, target, st.angle, 60, PITCH);
    cam.updateMatrixWorld();
    changed = true;
  }
  const pick = (cx, cy) => r.pickGround(cx, cy, 0);

  function beginGrab(cx, cy) {
    fly = null;
    vel.x = vel.z = 0;
    grab = pick(cx, cy);
    grabT = performance.now();
  }
  function moveGrab(cx, cy) {
    if (!grab) return;
    const p = pick(cx, cy);
    if (!p) return;
    const dx = grab.x - p.x, dz = grab.z - p.z;
    st.x += dx; st.z += dz;
    const now = performance.now();
    const dt = Math.max(1, now - grabT) / 1000;
    grabT = now;
    vel.x = vel.x * 0.6 + (dx / dt) * 0.4;
    vel.z = vel.z * 0.6 + (dz / dt) * 0.4;
    apply();
  }
  function endGrab() {
    if (performance.now() - grabT > 90) { vel.x = vel.z = 0; }
    const sp = Math.hypot(vel.x, vel.z), max = st.u * 2.5;
    if (sp > max) { vel.x *= max / sp; vel.z *= max / sp; }
    grab = null;
  }

  function zoomAt(cx, cy, factor) {
    fly = null;
    const before = pick(cx, cy);
    st.u = clamp(st.u * factor, U_MIN, U_MAX);
    apply();
    const after = pick(cx, cy);
    if (before && after) { st.x += before.x - after.x; st.z += before.z - after.z; apply(); }
  }
  function beginPinch(a, b) {
    grab = null; fly = null; vel.x = vel.z = 0;
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    pinch = { d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, u0: st.u, anchor: pick(mx, my) };
  }
  function movePinch(a, b) {
    if (!pinch) return;
    const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
    st.u = clamp(pinch.u0 * pinch.d0 / d, U_MIN, U_MAX);
    apply();
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    const p = pick(mx, my);
    if (p && pinch.anchor) { st.x += pinch.anchor.x - p.x; st.z += pinch.anchor.z - p.z; apply(); }
  }
  function endPinch() { pinch = null; }

  function rotate(dir = 1) {
    st.rot = ((st.rot + dir) % 4 + 4) % 4;
    targetAngle += dir * Math.PI / 2;
    changed = true;
  }
  /** Vuela suavemente hasta (x,z) y opcionalmente a un zoom. */
  function flyTo(x, z, u = null) {
    fly = { x, z, u: u == null ? st.u : clamp(u, U_MIN, U_MAX) };
    vel.x = vel.z = 0;
  }

  function update(dt) {
    let moved = false;
    if (Math.abs(angleDelta(st.angle, targetAngle)) > 0.0005) {
      st.angle += (targetAngle - st.angle) * Math.min(1, dt * 9);
      moved = true;
    } else if (st.angle !== targetAngle) { st.angle = targetAngle; moved = true; }
    if (!grab && !pinch && (Math.abs(vel.x) > 0.01 || Math.abs(vel.z) > 0.01)) {
      st.x += vel.x * dt; st.z += vel.z * dt;
      const k = Math.exp(-5 * dt);
      vel.x *= k; vel.z *= k;
      moved = true;
    }
    if (fly) {
      const k = Math.min(1, dt * 5);
      st.x += (fly.x - st.x) * k; st.z += (fly.z - st.z) * k; st.u += (fly.u - st.u) * k;
      if (Math.abs(fly.x - st.x) + Math.abs(fly.z - st.z) + Math.abs(fly.u - st.u) < 0.01) fly = null;
      moved = true;
    }
    if (keys.size) {
      let fwd = 0, right = 0, zoom = 0;
      if (keys.has('up')) fwd += 1;
      if (keys.has('down')) fwd -= 1;
      if (keys.has('left')) right -= 1;
      if (keys.has('right')) right += 1;
      if (keys.has('in')) zoom -= 1;
      if (keys.has('out')) zoom += 1;
      const a = st.angle, sp = st.u * 0.9 * dt;
      // adelante en pantalla = (-sin a, -cos a) sobre el piso; derecha = (cos a, -sin a)
      st.x += (-Math.sin(a) * fwd + Math.cos(a) * right) * sp;
      st.z += (-Math.cos(a) * fwd - Math.sin(a) * right) * sp;
      if (zoom) st.u = clamp(st.u * Math.exp(zoom * dt * 1.4), U_MIN, U_MAX);
      if (fwd || right || zoom) { fly = null; moved = true; }
    }
    if (moved) apply();
    if (changed) {
      changeTimer += dt;
      if (changeTimer > 0.6 && !grab && !pinch) { changed = false; changeTimer = 0; onChange?.(save()); }
    }
  }
  function save() { return { x: +st.x.toFixed(2), z: +st.z.toFixed(2), u: +st.u.toFixed(2), rot: st.rot }; }

  apply();
  return {
    st, target, apply, applyProj, update, save,
    beginGrab, moveGrab, endGrab, zoomAt, beginPinch, movePinch, endPinch, rotate, flyTo,
    get angle() { return st.angle; },
    get dragging() { return !!grab || !!pinch; },
    key(name, down) { if (down) keys.add(name); else keys.delete(name); },
    clearKeys() { keys.clear(); },
    stop() { vel.x = vel.z = 0; fly = null; },
  };
}
