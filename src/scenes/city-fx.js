// Efectos de la ciudad: partículas vóxel (confeti, polvo, brillitos) y capa de overlays DOM
// anclados a posiciones del mundo (timers, burbujas de producción, carteles).
import * as THREE from 'three';

export function createParticles(scene) {
  const MAX = 320;
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const mesh = new THREE.InstancedMesh(geo, mat, MAX);
  mesh.frustumCulled = false;
  mesh.castShadow = false; mesh.receiveShadow = false;
  mesh.renderOrder = 6;
  const P = Array.from({ length: MAX }, () => ({ life: 0, max: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, g: 0, size: 0.1, rx: 0, ry: 0, spin: 0, drag: 0 }));
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), ps = new THREE.Vector3(), col = new THREE.Color();
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  for (let i = 0; i < MAX; i++) { mesh.setMatrixAt(i, zero); mesh.setColorAt(i, col.set(0xffffff)); }
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(mesh);
  let cursor = 0, alive = 0, dirty = false;

  function emit(o) {
    const i = cursor;
    const p = P[i];
    cursor = (cursor + 1) % MAX;
    if (p.life <= 0) alive++;
    Object.assign(p, o);
    p.max = p.life;
    mesh.setColorAt(i, col.set(o.color));
    mesh.instanceColor.needsUpdate = true;
  }
  /** Ráfaga de partículas en (x,y,z). */
  function burst(x, y, z, { n = 20, colors = ['#ff7eb6', '#b58cff', '#6fe3c1', '#8fd3ff', '#ffd166', '#ffffff'], speed = 2, up = 3, gravity = 7, size = 0.09, life = 1.1, spread = 0.3, drag = 0.6 } = {}) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = speed * (0.4 + Math.random() * 0.8);
      emit({
        x: x + (Math.random() - 0.5) * spread, y: y + Math.random() * spread * 0.5, z: z + (Math.random() - 0.5) * spread,
        vx: Math.cos(a) * s, vz: Math.sin(a) * s, vy: up * (0.5 + Math.random() * 0.7),
        g: gravity, size: size * (0.7 + Math.random() * 0.6), life: life * (0.7 + Math.random() * 0.5),
        rx: Math.random() * 6, ry: Math.random() * 6, spin: (Math.random() - 0.5) * 12, drag,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }
  }
  function update(dt) {
    if (!alive && !dirty) return;
    dirty = false;
    let count = 0;
    for (let i = 0; i < MAX; i++) {
      const p = P[i];
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) { mesh.setMatrixAt(i, zero); alive--; dirty = true; continue; }
      count++;
      p.vy -= p.g * dt;
      const k = Math.exp(-p.drag * dt);
      p.vx *= k; p.vz *= k;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y < 0.02 && p.g > 0) { p.y = 0.02; p.vy *= -0.35; p.vx *= 0.6; p.vz *= 0.6; }
      p.rx += p.spin * dt; p.ry += p.spin * 0.7 * dt;
      const f = Math.min(1, (p.life / p.max) * 3);
      sc.setScalar(p.size * f);
      e.set(p.rx, p.ry, 0);
      q.setFromEuler(e);
      ps.set(p.x, p.y, p.z);
      m4.compose(ps, q, sc);
      mesh.setMatrixAt(i, m4);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (!count) alive = 0;
  }
  return {
    burst, update, mesh,
    confetti(x, y, z) { burst(x, y, z, { n: 46, speed: 2.4, up: 5, gravity: 7, size: 0.1, life: 1.6, spread: 0.6 }); },
    dust(x, y, z, r = 0.5) { burst(x, y, z, { n: 16, colors: ['#ffffff', '#fff4e6', '#f3e6d6', '#e9dcf5'], speed: 1.6 + r, up: 0.9, gravity: 1.5, size: 0.11, life: 0.7, spread: r, drag: 3 }); },
    sparkle(x, y, z, colors = ['#ffd166', '#ffffff', '#fff0c2']) { burst(x, y, z, { n: 18, colors, speed: 1.1, up: 1.6, gravity: -0.6, size: 0.07, life: 1.1, spread: 0.7, drag: 1.5 }); },
    poof(x, y, z) { burst(x, y, z, { n: 10, colors: ['#ffffff', '#e8f7e0', '#c4f7e8'], speed: 1.2, up: 1.2, gravity: 0.8, size: 0.12, life: 0.6, spread: 0.4, drag: 3 }); },
    dispose() { scene.remove(mesh); geo.dispose(); mat.dispose(); mesh.dispose?.(); },
  };
}

/** Capa de elementos DOM pegados a puntos del mundo. */
export function createOverlays(container, r) {
  const layer = document.createElement('div');
  layer.className = 'cx-layer';
  container.append(layer);
  const items = new Set();
  const v = new THREE.Vector3();
  let W = container.clientWidth || innerWidth, H = container.clientHeight || innerHeight;

  function add(el, pos, { cls = '' } = {}) {
    const wrap = document.createElement('div');
    wrap.className = 'cx-ov' + (cls ? ' ' + cls : '');
    wrap.append(el);
    layer.append(wrap);
    const it = { wrap, el, pos: pos.clone(), hidden: false, sx: -9999, sy: -9999, onScreen: false, _x: -1e9, _y: -1e9, _vis: true };
    items.add(it);
    return it;
  }
  function remove(it) { if (!it) return; it.wrap.remove(); items.delete(it); }
  function project(pos, out = {}) {
    v.copy(pos).project(r.camera);
    out.x = (v.x + 1) / 2 * W; out.y = (1 - v.y) / 2 * H;
    return out;
  }
  let scale = 1, lastScale = 1;
  function update() {
    const vs = r.camera.userData.viewSize || 14;
    scale = Math.max(0.6, Math.min(1, (H / vs) / 42));
    const scaleChanged = Math.abs(scale - lastScale) > 0.01;
    if (scaleChanged) lastScale = scale;
    for (const it of items) {
      const vis = !it.hidden;
      if (vis) {
        project(it.pos, it);
        it.sx = it.x; it.sy = it.y;
        it.onScreen = it.x > -60 && it.x < W + 60 && it.y > -60 && it.y < H + 60;
        if (it.onScreen && (scaleChanged || Math.abs(it.x - it._x) > 0.4 || Math.abs(it.y - it._y) > 0.4)) {
          it._x = it.x; it._y = it.y;
          it.wrap.style.transform = `translate3d(${it.x.toFixed(1)}px, ${it.y.toFixed(1)}px, 0) scale(${lastScale.toFixed(2)})`;
        }
      } else it.onScreen = false;
      const show = vis && it.onScreen;
      if (show !== it._vis) { it._vis = show; it.wrap.style.display = show ? '' : 'none'; }
    }
  }
  return {
    layer, add, remove, update, project, items,
    get scale() { return lastScale; },
    resize() { W = container.clientWidth || innerWidth; H = container.clientHeight || innerHeight; },
    dispose() { layer.remove(); items.clear(); },
  };
}
