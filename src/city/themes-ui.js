// Selector de tema de la ciudad: tarjetas con una maqueta 3D en miniatura de cada estilo.
//   openThemePicker(ctx) -> Promise<themeId>   (resuelve al cerrar con el tema que quedó elegido)
// Elegir es gratis y se aplica en vivo: guarda state.city.theme, marca el guardado y emite bus 'city:theme'.
import * as THREE from 'three';
import { Voxels, addLights, setIsoCamera } from '../core/voxel.js';
import { icon } from '../core/icons.js';
import { THEMES, themeOf, currentThemeId } from './themes.js';
import { buildingModel, natureModel } from './models.js';

const STYLE = `
.modal-back:has(.tp-modal) { background: rgba(61,47,42,.22); }
@media (max-width: 640px) { .modal-back:has(.tp-modal) { align-items: end; } .tp-modal { max-height: 72%; } }
.tp-modal { width: min(560px, 100%); }
.tp-greet { margin: 0 0 6px; font-size: 16px; font-weight: 700; text-align: center; display: flex; align-items: center; justify-content: center; gap: 6px; }
.tp-sub { margin: 0 0 10px; font-size: 14px; color: var(--ink-l); text-align: center; }
.tp-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; }
.tp-card { position: relative; display: flex; flex-direction: column; padding: 0; overflow: hidden; text-align: left; font: inherit; color: var(--ink);
  background: #fff; border: 3px solid var(--ink); border-radius: 14px; box-shadow: 0 4px 0 var(--ink); cursor: pointer; transition: transform .12s; }
.tp-card:active { transform: translateY(2px); box-shadow: 0 2px 0 var(--ink); }
.tp-card.on { outline: 4px solid var(--gold); outline-offset: 1px; }
.tp-pic { position: relative; aspect-ratio: 4 / 3; border-bottom: 3px solid var(--ink); overflow: hidden; }
.tp-pic img { position: absolute; inset: 0; width: 100%; height: 100%; }
.tp-pic .ph { position: absolute; inset: 0; display: grid; place-items: center; opacity: .6; }
.tp-pic.stars::before { content: ''; position: absolute; inset: 0; pointer-events: none;
  background-image: radial-gradient(circle at 14% 16%, #fff 0 1.5px, transparent 2px), radial-gradient(circle at 78% 10%, #fff 0 1.5px, transparent 2px),
  radial-gradient(circle at 46% 26%, #fff 0 1px, transparent 1.5px), radial-gradient(circle at 90% 34%, #fff 0 1px, transparent 1.5px); }
.tp-txt { padding: 6px 8px 8px; display: flex; flex-direction: column; gap: 3px; }
.tp-txt b { font-size: 15px; line-height: 1.1; display: flex; align-items: center; gap: 4px; }
.tp-txt small { font-size: 12px; line-height: 1.2; color: var(--ink-l); }
.tp-sw { display: flex; gap: 3px; margin-top: 2px; }
.tp-sw i { width: 14px; height: 14px; border: 2px solid var(--ink); border-radius: 4px; }
.tp-ok { position: absolute; top: 6px; right: 6px; z-index: 2; display: none; align-items: center; gap: 2px; padding: 1px 7px 1px 3px; font-size: 12px; font-weight: 700;
  background: var(--gold); border: 2px solid var(--ink); border-radius: 99px; box-shadow: 0 2px 0 var(--ink); }
.tp-card.on .tp-ok { display: flex; }
`;

// ---------- Maquetas en miniatura (un solo renderer para todas; quedan cacheadas) ----------
const PW = 160, PH = 120, PX = 3; // maqueta 160×120 px CSS, dibujada a 3× para retina
const previews = new Map();
let queue = Promise.resolve(), R = null, freeT = 0;

function slab(T) {
  // terreno de 4×3 baldosas con esquinas comidas, pasto a cuadros y dos capas de acantilado
  const v = new Voxels(), W = 32, D = 24, g = T.ground, cl = T.cliff;
  const corner = (x, z) => Math.min(x, W - 1 - x) + Math.min(z, D - 1 - z) < 3;
  for (let x = 0; x < W; x++) for (let z = 0; z < D; z++) {
    if (corner(x, z)) continue;
    const tile = ((x >> 3) + (z >> 3)) & 1, n = (x * 7 + z * 13) % 11;
    const inside = x >= 4 && x < W - 4 && z >= 4 && z < D - 4;
    const top = n === 0 ? (inside ? g.tuftIn : g.tuftOut) : n === 5 ? (inside ? g.lightIn : g.lightOut) : inside ? (tile ? g.inA : g.inB) : (tile ? g.outA : g.outB);
    v.set(x, -1, z, top);
    const edge = x === 0 || z === 0 || x === W - 1 || z === D - 1 || corner(x - 1, z) || corner(x + 1, z) || corner(x, z - 1) || corner(x, z + 1);
    if (!edge) continue;
    v.set(x, -2, z, cl.top);
    v.set(x, -3, z, (x + z) % 3 ? cl.dirt : cl.grass);
    for (let y = 4; y <= 7; y++) v.set(x, -y, z, cl.bands[Math.min(4, (y - 4) >> 1)][(x + y) & 1]);
  }
  for (let x = 1; x < W - 1; x++) for (let z = 1; z < D - 1; z++) if (!corner(x, z) && !v.has(x, -2, z)) v.set(x, -7, z, cl.bands[1][0]);
  return v.toMesh({ scale: 1 / 8 });
}

function rig() {
  const canvas = document.createElement('canvas');
  canvas.width = PW * PX; canvas.height = PH * PX;
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(1);
  renderer.setSize(PW * PX, PH * PX, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  return { renderer, canvas };
}

function renderPreview(R, T) {
  const scene = new THREE.Scene();
  const { hemi, sun } = addLights(scene, { shadowSize: 8, shadowRes: 512 });
  hemi.color.setHex(T.lights.sky); hemi.groundColor.setHex(T.lights.ground); hemi.intensity = T.lights.hemi;
  sun.color.setHex(T.lights.sun); sun.intensity = T.lights.sunI;
  sun.position.set(6, 12, 5);
  const ground = slab(T);
  ground.position.set(-2, 0, -1.5);
  scene.add(ground);
  const put = (o, x, z, rot = 0) => { o.position.set(x, 0, z); o.rotation.y = rot; o.userData.update?.(0, 0.8); scene.add(o); return o; };
  put(buildingModel('casita', 2, { theme: T.id }), -0.7, -0.45);
  put(buildingModel('panaderia', 1, { theme: T.id }), 1.15, -0.45);
  for (const [x, z] of [[-1.1, 1.1], [-0.1, 1.1], [0.9, 1.1]]) put(buildingModel('camino', 1, { theme: T.id }), x, z);
  put(buildingModel('farol', 1, { theme: T.id }), 1.75, 0.45);
  const kinds = T.nature.map(k => k[0]).filter(k => k !== 'rock' && k !== 'flowers');
  put(natureModel(kinds[0], 2, T.id), -1.55, 0.9);
  put(natureModel(kinds[1] || kinds[0], 4, T.id), -1.45, -1.25);
  put(natureModel('flowers', 1, T.id), 1.55, -1.3);
  const cam = new THREE.OrthographicCamera(-2.9, 2.9, 2.18, -2.18, -50, 100);
  setIsoCamera(cam, new THREE.Vector3(0, 0.5, 0), Math.PI / 4, 30, 0.6);
  cam.updateProjectionMatrix();
  R.renderer.render(scene, cam);
  const url = R.canvas.toDataURL('image/png');
  ground.geometry.dispose(); // el resto son geometrías cacheadas de models.js
  return url;
}

/** Imagen (dataURL) de la maqueta del tema. Se dibujan de a una, cediendo el hilo entre medio. */
function preview(themeId) {
  const T = themeOf(themeId);
  if (previews.has(T.id)) return previews.get(T.id);
  const p = queue = queue.then(() => new Promise(res => {
    requestAnimationFrame(() => {
      clearTimeout(freeT);
      try { R ||= rig(); res(renderPreview(R, T)); } catch (err) { console.warn('[temas] vista previa', err); previews.delete(T.id); res(null); }
      // cuando termina la tanda se libera el contexto WebGL (las imágenes quedan cacheadas)
      freeT = setTimeout(() => { if (R) { R.renderer.dispose(); R.renderer.forceContextLoss?.(); R = null; } }, 1500);
    });
  }));
  previews.set(T.id, p);
  return p;
}

// ---------- Selector ----------
/** Guarda el tema y avisa (la ciudad se actualiza en vivo). */
export function setCityTheme(ctx, id) {
  const T = themeOf(id);
  if (currentThemeId(ctx.state) === T.id && ctx.state.city.theme) return false;
  ctx.state.city.theme = T.id;
  ctx.store.markDirty();
  ctx.bus.emit('city:theme', { theme: T.id });
  return true;
}

/** opts.greet: saludo que va arriba del texto (el onboarding lo usa en vez de un toast que tapaba el HUD). */
export function openThemePicker(ctx, opts = {}) {
  const { ui } = ctx;
  if (!document.getElementById('tp-style')) {
    const st = document.createElement('style');
    st.id = 'tp-style'; st.textContent = STYLE;
    document.head.append(st);
  }
  return new Promise(resolve => {
    let chosen = currentThemeId(ctx.state);
    const body = ui.h('div');
    if (opts.greet) body.append(ui.h('p.tp-greet', { html: `${icon('sparkle', 18)}${ui.esc(opts.greet)}` }));
    body.append(ui.h('p.tp-sub', { html: 'Elegí cómo se ve tu ciudad. Es gratis y lo cambiás cuando quieras con el botón de la paleta o en Ajustes.' }));
    const grid = ui.h('div.tp-grid');
    const cards = new Map();
    for (const T of THEMES) {
      const pic = ui.h('div.tp-pic' + (T.stars >= 0.7 ? '.stars' : ''), { html: `<span class="ph">${icon(T.emoji, 34)}</span>` });
      pic.style.background = T.sky;
      const card = ui.h('button.tp-card', { type: 'button', 'aria-label': T.name, 'data-theme': T.id },
        ui.h('span.tp-ok', { html: `${icon('check', 14)}Elegido` }),
        pic,
        ui.h('div.tp-txt', { html: `<b>${icon(T.emoji, 18)}${ui.esc(T.name)}</b><small>${ui.esc(T.desc)}</small><span class="tp-sw">${T.swatch.map(c => `<i style="background:${c}"></i>`).join('')}</span>` }));
      card.classList.toggle('on', T.id === chosen);
      card.addEventListener('click', () => pick(T.id));
      cards.set(T.id, card);
      grid.append(card);
      preview(T.id).then(url => { if (url) pic.innerHTML = `<img src="${url}" alt="" draggable="false">`; });
    }
    body.append(grid);
    function pick(id) {
      if (id === chosen) { ctx.audio.sfx('tap'); return; }
      chosen = id;
      for (const [k, c] of cards) c.classList.toggle('on', k === id);
      setCityTheme(ctx, id);
      ctx.audio.sfx('pop'); // la tarjeta marcada "Elegido" y la ciudad de fondo ya muestran el cambio (sin toast que tape el título)
    }
    ui.modal({ title: 'Estilo de tu ciudad', icon: 'palette', content: body, className: 'tp-modal',
      actions: [{ label: '¡Listo!', cls: 'primary' }],
      onClose: () => resolve(chosen) });
    // la tarjeta elegida a la vista
    requestAnimationFrame(() => cards.get(chosen)?.scrollIntoView?.({ block: 'nearest' }));
  });
}
