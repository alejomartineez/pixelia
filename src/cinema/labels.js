// Etiquetas 3D de las cinemáticas (PLAN-TRAVESIA §3a): la primera vez que aparece algo, un cartel sobrio pegado a su
// lugar en el mundo, con el nombre y una línea ("La Veta: la sangre del continente"). Usa la capa de createOverlays /
// project de scenes/city-fx.js, así el cartel sigue al punto aunque la cámara se mueva.
//   const lb = createLabels(container, r); lb.introduce('veta', pos, 'La Veta', 'la sangre del continente', { dur: 4 });
//   lb.update(dt) en cada cuadro · lb.clear() · lb.dispose() · lb.seen (Set de ids ya presentados)
import * as THREE from 'three';
import { createOverlays } from '../scenes/city-fx.js';

export function createLabels(container, r, { seen = new Set() } = {}) {
  ensureStyle();
  const ov = createOverlays(container, r);
  ov.layer.classList.add('cn-labels');
  const live = [];

  /** Muestra un cartel en pos (Vector3 o [x,y,z]). Si el id ya se presentó, no hace nada (devuelve null). */
  // color: borde y nombre del color de lo presentado (una veta). screen: () => ({ x, y }) en píxeles del contenedor, para
  // carteles sobre una viñeta 2D (no hay punto 3D); host: dónde va ese cartel (encima del canvas 2D).
  function introduce(id, pos, name, line = '', { dur = 4.2, side = 'up', force = false, color = null, screen = null, host = null } = {}) {
    if (id && seen.has(id) && !force) return null;
    if (id) seen.add(id);
    const el = document.createElement('div');
    el.className = 'cn-label cn-' + side;
    el.innerHTML = `<b></b>${line ? '<span></span>' : ''}<i class="cn-tick"></i>`;
    el.querySelector('b').textContent = name;
    if (line) el.querySelector('span').textContent = line;
    if (color) { el.style.borderColor = color; el.querySelector('b').style.color = color; el.querySelector('.cn-tick').style.background = color; }
    let it;
    if (screen) {
      const wrap = document.createElement('div');
      wrap.className = 'cx-ov';
      wrap.append(el);
      (host || ov.layer).append(wrap);
      it = { wrap, el, screen, sx: -9999, sy: -9999, onScreen: true };
      place(it);
    } else it = ov.add(el, Array.isArray(pos) ? new THREE.Vector3(...pos) : pos.clone());
    const L = { id, it, el, t: 0, dur };
    live.push(L);
    requestAnimationFrame(() => el.classList.add('on'));
    return L;
  }
  function place(it) {
    const p = it.screen();
    if (!p) return;
    it.sx = p.x; it.sy = p.y;
    it.wrap.style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0)`;
  }
  function drop(L) { const i = live.indexOf(L); if (i >= 0) live.splice(i, 1); if (L.it.screen) L.it.wrap.remove(); else ov.remove(L.it); }
  return {
    introduce,
    seen,
    get live() { return live.map(L => ({ id: L.id, name: L.el.querySelector('b').textContent, x: L.it.sx, y: L.it.sy, on: L.it.onScreen })); },
    update(dt = 0.016) {
      for (const L of live.slice()) {
        L.t += dt;
        if (L.t > L.dur && !L.out) { L.out = true; L.el.classList.remove('on'); setTimeout(() => drop(L), 500); }
        if (L.it.screen) place(L.it);
      }
      ov.update();
    },
    /** Mueve el punto de un cartel (para seguir algo que camina). */
    move(L, pos) { if (L?.it) (Array.isArray(pos) ? L.it.pos.set(...pos) : L.it.pos.copy(pos)); },
    clear() { for (const L of live.slice()) drop(L); },
    resize() { ov.resize(); },
    dispose() { live.length = 0; ov.dispose(); },
  };
}

let styled = false;
function ensureStyle() {
  if (styled || typeof document === 'undefined') return;
  styled = true;
  const el = document.createElement('style');
  el.id = 'cinema-labels-style';
  el.textContent = `
.cn-labels { position: absolute; inset: 0; pointer-events: none; overflow: hidden; z-index: 2; }
.cn-labels .cx-ov { position: absolute; left: 0; top: 0; will-change: transform; transform-origin: 0 0; }
.cn-label { position: relative; transform: translate(-50%, calc(-100% - 22px)); padding: 6px 12px 7px; min-width: 120px;
  background: rgba(10,10,14,.78); border: 1px solid rgba(232,198,118,.55); color: #efe6d8; text-align: center;
  font-size: clamp(13px, 1.25vw, 17px); line-height: 1.25; white-space: nowrap; opacity: 0; transition: opacity .5s, transform .5s; }
.cn-label.on { opacity: 1; transform: translate(-50%, calc(-100% - 28px)); }
.cn-label b { display: block; color: #e8c676; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; font-size: .92em; }
.cn-label span { display: block; color: #d8cfc0; font-style: italic; }
.cn-label .cn-tick { position: absolute; left: 50%; top: 100%; width: 1px; height: 22px; background: rgba(232,198,118,.55); }
html.reduce-motion .cn-label { transition: opacity .2s; }
`;
  document.head.append(el);
}
