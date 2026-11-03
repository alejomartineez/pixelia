// Vestidor + Taller: elegí tu personaje (princesa, príncipe, chica, chico, hada, mago o animalito), probá peinados,
// ropa, cosas para la cabeza, accesorios y tuneá tu auto.
// Arriba (o a la izquierda en PC) un escenario 3D giratorio; abajo (o a la derecha) el panel con categorías.
// Tocar una pieza la prueba al instante; si no es tuya aparece "Comprar". Los colores y el tipo de personaje son gratis.
import * as THREE from 'three';
import { createPixelRenderer, addLights } from '../core/voxel.js';
import { icon } from '../core/icons.js';
import { fmtNum } from '../core/economy.js';
import {
  HAIR_STYLES, HAIR_COLORS, SKIN_TONES, DRESS_STYLES, OUTFIT_COLORS, CROWNS, ACCESSORIES,
  CAR_BODIES, CAR_WHEELS, CAR_TOPPERS, BUILDING_BY_ID, CUSTOM_CATALOG,
  AVATAR_TYPES, AVATAR_FAMILIES, avatarType, fitsType,
} from '../core/data.js';
import { avatarModel, normalizeLook } from '../avatar/avatar.js';
import { carModel, carStats, normalizeCar } from '../avatar/car.js';
import { buildBoutique, buildGarage, buildPlatform, thumbnail, hasThumb, disposeThumbs } from '../avatar/wardrobe-stage.js';

const COLOR_NAMES = {
  castano: 'Castaño', negro: 'Negro', rubio: 'Rubio', pelirrojo: 'Colorado', rosa: 'Rosa', lila: 'Lila', celeste: 'Celeste',
  menta: 'Menta', blanco: 'Blanco', chocolate: 'Chocolate', fucsia: 'Fucsia', violeta: 'Violeta', azul: 'Azul', verde: 'Verde',
  dorado: 'Dorado', durazno: 'Durazno', rojo: 'Rojo', gris: 'Gris',
};
const colorList = (list) => list.map(c => ({ id: c.id, hex: c.hex, name: COLOR_NAMES[c.id] || c.id }));

// Categorías del personaje. Las etiquetas cambian según el tipo (label(t) recibe la definición del tipo).
const AVATAR_CATS = [
  { id: 'type', label: () => 'Personaje', icon: 'sparkle', types: true },
  { id: 'hair', label: (t) => (t.animal ? 'Pelaje' : 'Peinado'), icon: 'ribbon', kind: 'hair', list: HAIR_STYLES, frame: 'head' },
  { id: 'hairColor', label: (t) => (t.animal ? 'Color de pelaje' : 'Color de pelo'), icon: 'palette', colors: colorList(HAIR_COLORS) },
  { id: 'skin', label: () => 'Piel', icon: '🖐️', colors: SKIN_TONES.map((hex, i) => ({ id: i, hex, name: `Tono ${i + 1}` })), humans: true },
  { id: 'dress', label: () => 'Ropa', icon: 'dress', kind: 'dress', list: DRESS_STYLES, frame: 'body' },
  { id: 'dressColor', label: () => 'Color de ropa', icon: '🎨', colors: colorList(OUTFIT_COLORS) },
  { id: 'crown', label: () => 'Cabeza', icon: 'crown', kind: 'crown', list: CROWNS, frame: 'head' },
  { id: 'acc', label: () => 'Accesorio', icon: 'wand', kind: 'acc', list: ACCESSORIES, frame: 'body' },
];
// piezas que se ven mejor de espaldas o enteras en la miniatura
const BACK_ITEMS = new Set(['alas', 'alas_hada', 'alas_mariposa', 'mochila']);
const TALL_ITEMS = new Set(['sombrero_mago', 'sombrero_luna', 'sombrero_estrellas', 'galera', 'casco', 'corona_rey', 'antenitas', 'gorrito', 'estrella']);
const BODY_ITEMS = new Set(['barba', 'globo', 'baston', 'patineta', 'farolito']);
const CAR_CATS = [
  { id: 'body', label: 'Modelo', icon: 'car', kind: 'body', list: CAR_BODIES, frame: 'car', stats: true },
  { id: 'color', label: 'Color', icon: 'palette', colors: colorList(OUTFIT_COLORS) },
  { id: 'wheels', label: 'Ruedas', icon: 'gear', kind: 'wheels', list: CAR_WHEELS, frame: 'wheel' },
  { id: 'topper', label: 'Adorno', icon: 'heart', kind: 'topper', list: CAR_TOPPERS, frame: 'car' },
];
// ángulo del escenario que mejor muestra cada pieza
const FOCUS = {
  acc: { alas: Math.PI * 0.85, alas_hada: Math.PI * 0.85, alas_mariposa: Math.PI * 0.85, mochila: Math.PI * 0.9, buho: -0.6 },
  dress: { capa: Math.PI * 0.8, capa_real: Math.PI * 0.8, tunica_capa: Math.PI * 0.8, archimago: Math.PI * 0.8, capita: Math.PI * 0.8, futbol: Math.PI },
  hair: { coleta: 1.3, rodete: 1.1, trenzas: 0.7, colitas: 0.6, ondas: 1.0, largo: 0.9 },
};

const WD_CSS = `
.scene-wardrobe .wd { position:absolute; inset:0; display:flex; flex-direction:column; background:linear-gradient(#ffd9ec,#efe0ff); }
.scene-wardrobe .wd-stage { position:relative; flex:0 0 46%; min-height:0; min-width:0; overflow:hidden; touch-action:none; cursor:grab; }
.scene-wardrobe .wd-stage.drag { cursor:grabbing; }
.scene-wardrobe .wd-stage canvas { position:absolute; inset:0; }
.scene-wardrobe .wd-top { position:absolute; z-index:3; top:calc(var(--safe-t) + 8px); left:calc(var(--safe-l) + 8px); right:8px; display:flex; align-items:flex-start; gap:8px; pointer-events:none; }
.scene-wardrobe .wd-top > * { pointer-events:auto; }
.scene-wardrobe .wd-namebox { flex:1 1 auto; max-width:250px; min-width:0; display:flex; align-items:center; gap:6px; height:42px; padding:0 10px 0 8px; background:#fff;
  border:var(--line) solid var(--ink); border-radius:12px; box-shadow:0 3px 0 var(--ink); cursor:text; }
.scene-wardrobe .wd-namebox input[type=text] { flex:1; min-width:0; width:100%; border:0; padding:0; margin:0; background:transparent; font-size:18px; font-weight:700; color:var(--ink); box-shadow:none; }
.scene-wardrobe .wd-namebox:focus-within { border-color:var(--pink-d); }
.scene-wardrobe .wd-res { margin-left:auto; display:flex; flex-direction:column; gap:5px; align-items:flex-end; }
.scene-wardrobe .wd-res .pill { min-width:86px; font-size:16px; padding:2px 10px 2px 5px; }
.scene-wardrobe .wd-stagebar { position:absolute; z-index:2; left:calc(var(--safe-l) + 10px); right:10px; bottom:26px; display:flex; align-items:flex-end; justify-content:space-between; gap:8px; pointer-events:none; }
.scene-wardrobe .wd-stagebar > button { pointer-events:auto; }
.scene-wardrobe .wd-hint { font-size:13px; font-weight:700; padding:3px 10px; border-radius:99px; background:rgba(255,255,255,.88); border:2px solid var(--ink); transition:opacity .6s; white-space:nowrap; }
.scene-wardrobe .wd-hint.gone { opacity:0; }
.scene-wardrobe .wd-panel { position:relative; z-index:4; flex:1 1 auto; min-height:0; min-width:0; display:flex; flex-direction:column; margin-top:-16px; padding:12px 12px 0;
  background:var(--panel); border-top:var(--line) solid var(--ink); border-radius:20px 20px 0 0; box-shadow:0 -4px 0 rgba(59,35,64,.12); }
.scene-wardrobe .wd-seg { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:4px; }
.scene-wardrobe .wd-segbtn { display:flex; align-items:center; justify-content:center; gap:6px; min-height:44px; border:var(--line) solid var(--ink); border-radius:12px; background:#fff;
  font-size:17px; font-weight:700; box-shadow:inset 0 -4px 0 #eadcf0, 0 3px 0 var(--ink); }
.scene-wardrobe .wd-segbtn:active { transform:translateY(2px); box-shadow:inset 0 -2px 0 #eadcf0, 0 1px 0 var(--ink); }
.scene-wardrobe .wd-segbtn.active { background:var(--lilac); color:#fff; text-shadow:0 2px 0 rgba(59,35,64,.35); box-shadow:inset 0 -4px 0 var(--lilac-d), 0 3px 0 var(--ink); }
.scene-wardrobe .wd-segbtn.locked { background:#f1e9f3; color:var(--ink-l); }
.scene-wardrobe .wd-cats { min-width:0; flex:none; margin:0 -12px; padding:6px 12px 10px; }
.scene-wardrobe .wd-cats .tab { min-height:38px; }
.scene-wardrobe .wd-list { flex:1 1 auto; min-height:0; margin:0 -12px; padding:4px 12px 16px; }
.scene-wardrobe .wd-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(100px, 1fr)); gap:12px 10px; }
.scene-wardrobe .wd-card { position:relative; display:flex; flex-direction:column; align-items:center; gap:3px; padding:6px 4px 7px; min-width:0; background:#fff; color:var(--ink);
  border:var(--line) solid var(--ink); border-radius:12px; box-shadow:0 3px 0 var(--ink); font-family:inherit; }
.scene-wardrobe .wd-card:active { transform:translateY(2px); box-shadow:0 1px 0 var(--ink); }
.scene-wardrobe .wd-card.on { background:var(--gold-l); }
.scene-wardrobe .wd-card.trying { background:#ffe9f4; outline:3px dashed var(--pink-d); outline-offset:-8px; }
.scene-wardrobe .wd-thumb { position:relative; width:72px; height:72px; border-radius:10px; display:grid; place-items:center; background:radial-gradient(circle at 50% 42%, #fff 0 38%, #ffe3f1 72%); }
.scene-wardrobe .wd-card.on .wd-thumb { background:radial-gradient(circle at 50% 42%, #fff 0 38%, #ffe4a3 72%); }
.scene-wardrobe .wd-thumb img.th { width:64px; height:64px; image-rendering:pixelated; image-rendering:crisp-edges; opacity:0; transition:opacity .2s; }
.scene-wardrobe .wd-thumb img.th.ok { opacity:1; }
.scene-wardrobe .wd-card.locked .wd-thumb img.th { filter:saturate(.55) brightness(.97); }
.scene-wardrobe .wd-lock { position:absolute; right:-4px; bottom:-4px; }
.scene-wardrobe .wd-name { font-size:13px; font-weight:700; line-height:1.1; text-align:center; min-height:2.2em; display:flex; align-items:center; justify-content:center; padding:0 2px; }
.scene-wardrobe .wd-mini { display:flex; align-items:center; gap:2px; font-size:13px; font-weight:700; color:var(--ink-l); line-height:1; }
.scene-wardrobe .wd-mini i { width:6px; }
.scene-wardrobe .wd-foot { font-size:13px; min-height:20px; display:flex; align-items:center; justify-content:center; }
.scene-wardrobe .wd-foot .chip { font-size:12px; padding:1px 7px; }
.scene-wardrobe .wd-check { position:absolute; top:-9px; right:-7px; width:26px; height:26px; display:grid; place-items:center; border-radius:50%; background:var(--mint); border:var(--line) solid var(--ink); }
.scene-wardrobe .wd-swatches { display:grid; grid-template-columns:repeat(auto-fill, minmax(68px, 1fr)); gap:10px 6px; }
.scene-wardrobe .wd-sw { display:flex; flex-direction:column; align-items:center; gap:5px; padding:4px 0; border:0; background:none; font-size:12px; font-weight:700; color:var(--ink); }
.scene-wardrobe .wd-sw i { position:relative; display:block; width:50px; height:50px; border:var(--line) solid var(--ink); border-radius:12px;
  box-shadow:inset -6px -6px 0 rgba(59,35,64,.16), inset 5px 5px 0 rgba(255,255,255,.5), 0 3px 0 var(--ink); transition:transform .12s; }
.scene-wardrobe .wd-sw:active i { transform:translateY(2px) scale(.96); }
.scene-wardrobe .wd-sw.on i { transform:translateY(-3px); outline:3px solid var(--gold-d); outline-offset:3px; }
.scene-wardrobe .wd-sw i img { position:absolute; left:50%; top:50%; transform:translate(-50%,-50%); }
.scene-wardrobe .wd-note { margin:12px 2px 0; font-size:13px; color:var(--ink-l); text-align:center; }
.scene-wardrobe .wd-fam { margin:14px 2px 8px; font-size:14px; font-weight:700; color:var(--ink-l); display:flex; align-items:center; gap:6px; }
.scene-wardrobe .wd-fam:first-child { margin-top:2px; }
.scene-wardrobe .wd-typeinfo { margin:0 0 10px; padding:8px 12px; background:#fff; border:var(--line) solid var(--ink); border-radius:12px; box-shadow:0 3px 0 var(--ink); font-size:14px; line-height:1.25; }
.scene-wardrobe .wd-typeinfo b { font-size:16px; }
.scene-wardrobe .wd-stats { display:flex; gap:12px; padding:8px 12px; margin:0 0 12px; background:#fff; border:var(--line) solid var(--ink); border-radius:12px; box-shadow:0 3px 0 var(--ink); }
.scene-wardrobe .wd-stat { flex:1; display:flex; flex-direction:column; gap:4px; font-size:13px; font-weight:700; }
.scene-wardrobe .wd-stat span { display:flex; align-items:center; gap:4px; }
.scene-wardrobe .wd-pips { display:flex; gap:3px; }
.scene-wardrobe .wd-pips i { flex:1; height:12px; border:2px solid var(--ink); border-radius:3px; background:#f2e3ee; transition:background .2s; }
.scene-wardrobe .wd-pips.sp i.on { background:var(--pink); }
.scene-wardrobe .wd-pips.hd i.on { background:var(--mint); }
.scene-wardrobe .wd-buy { display:flex; align-items:center; gap:8px; margin:0 -12px; padding:10px 12px calc(var(--safe-b) + 10px); background:var(--gold-l); border-top:var(--line) solid var(--ink);
  animation:wdUp .25s cubic-bezier(.3,1.5,.6,1); }
.scene-wardrobe .wd-buy[hidden] { display:none; }
.scene-wardrobe .wd-buy-info { flex:1; min-width:0; display:flex; flex-direction:column; line-height:1.15; }
.scene-wardrobe .wd-buy-info small { font-size:12px; color:var(--ink-l); font-weight:700; }
.scene-wardrobe .wd-buy-info b { font-size:16px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.scene-wardrobe .wd-buy .btn { min-height:44px; }
.scene-wardrobe .wd-buy .btn.gold .cost { gap:2px; }
.scene-wardrobe .wd-safe { flex:none; height:var(--safe-b); }
@keyframes wdUp { from { transform:translateY(30px); opacity:0; } }
@keyframes wdPop { 40% { transform:scale(1.12); } }
.scene-wardrobe .wd-pop { animation:wdPop .3s; }
@media (orientation: landscape) and (min-width: 700px) {
  .scene-wardrobe .wd { flex-direction:row; }
  .scene-wardrobe .wd-stage { flex:1 1 auto; }
  .scene-wardrobe .wd-top { right:12px; }
  .scene-wardrobe .wd-stagebar { bottom:calc(var(--safe-b) + 14px); }
  .scene-wardrobe .wd-panel { flex:0 0 min(500px, 44%); margin:0; padding:calc(var(--safe-t) + 12px) calc(var(--safe-r) + 14px) 0 14px; border-top:0; border-left:var(--line) solid var(--ink);
    border-radius:20px 0 0 20px; box-shadow:-4px 0 0 rgba(59,35,64,.12); }
  .scene-wardrobe .wd-cats, .scene-wardrobe .wd-list { margin:0 -14px; padding-left:14px; padding-right:14px; }
  .scene-wardrobe .wd-buy { margin:0 calc(-14px - var(--safe-r)) 0 -14px; padding-left:14px; padding-right:calc(var(--safe-r) + 14px); }
  .scene-wardrobe .wd-grid { grid-template-columns:repeat(auto-fill, minmax(108px, 1fr)); }
}
@media (orientation: landscape) and (max-height: 500px) {
  .scene-wardrobe .wd-thumb { width:60px; height:60px; } .scene-wardrobe .wd-thumb img.th { width:56px; height:56px; }
  .scene-wardrobe .wd-name { min-height:0; }
}
`;

export default function create(ctx) {
  const { store, ui, audio, bus } = ctx;
  let root, r, styleEl, params = {};
  const offs = [];        // limpiadores (listeners, bus)
  let alive = false;

  // ---------- estado de la escena ----------
  let mode = 'avatar';
  let catId = 'hair';   // la pestaña Personaje queda primera; se abre en Peinado como siempre
  const pv = {};          // look en prueba { avatar, car }
  let pending = [];       // piezas probadas que no son tuyas [{target, key, kind, id}]
  let thumbQueue = [];
  let thumbRaf = 0;

  // escena 3D
  let turntable, holder, model = null, boutique, garage, platP, platG, sparkles = [];
  let rot = 0.35, rotVel = 0, idleT = 0, focus = null, hopT = 1, dragging = false, carSpin = 0;
  const camPos = new THREE.Vector3(0, 1.3, 3.6), camLook = new THREE.Vector3(0, 0.7, 0);
  const camWant = new THREE.Vector3(), lookWant = new THREE.Vector3();

  const target = () => (mode === 'avatar' ? 'avatar' : 'car');
  const tdef = () => avatarType(pv.avatar?.type);
  // sin "Piel" para los animalitos
  const cats = () => (mode === 'avatar' ? AVATAR_CATS.filter(c => !(c.humans && tdef().animal)) : CAR_CATS);
  const catLabel = (c) => (typeof c.label === 'function' ? c.label(tdef()) : c.label);
  const itemsFor = (c) => (mode === 'avatar' ? c.list.filter(i => fitsType(i, pv.avatar.type)) : c.list);
  const cat = () => cats().find(c => c.id === catId) || cats()[0];
  const garageOk = () => ctx.economy.hasBuilt('garaje');
  const S = () => store.state;

  // ---------------- UI ----------------
  function buildDom(container) {
    root = ui.h('div.wd');
    root.innerHTML = `
      <div class="wd-stage">
        <div class="wd-top">
          <button class="icon-btn wd-back" aria-label="Volver">${icon('back', 22)}</button>
          <label class="wd-namebox" title="Nombre de tu personaje"><span class="wd-nameicon"></span><input type="text" maxlength="16" autocomplete="off" spellcheck="false" aria-label="Nombre de tu personaje"></label>
          <div class="wd-res">
            <div class="pill wd-coins">${icon('coin', 20)}<b></b></div>
            <div class="pill wd-gems">${icon('gem', 20)}<b></b></div>
          </div>
        </div>
        <div class="wd-stagebar">
          <button class="btn small lilac wd-random">${icon('sparkle', 18)}Sorpresa</button>
          <span class="wd-hint">Arrastrá para girar</span>
        </div>
      </div>
      <div class="wd-panel">
        <div class="wd-seg">
          <button class="wd-segbtn" data-mode="avatar"></button>
          <button class="wd-segbtn" data-mode="car">${icon('car', 24)}Auto</button>
        </div>
        <div class="tabs wd-cats"></div>
        <div class="wd-list scroll"></div>
        <div class="wd-buy" hidden>
          <div class="wd-buy-info"><small>Probando</small><b></b></div>
          <button class="icon-btn wd-undo" aria-label="Sacármelo">${icon('close', 18)}</button>
          <button class="btn gold wd-buybtn"></button>
        </div>
      </div>`;
    container.append(root);
    const $ = (s) => root.querySelector(s);

    // nombre
    const input = $('.wd-namebox input');
    input.value = S().player.name;
    const commitName = () => {
      // mismo largo que en Ajustes (16); se corta por caracteres, no por unidades UTF-16 (no rompe emojis)
      const v = [...input.value.replace(/\s+/g, ' ').trim()].slice(0, 16).join('').trim() || S().player.name;
      input.value = v;
      if (S().player.name !== v) {
        S().player.name = v;
        store.markDirty();
        ctx.hud.refresh?.();
        audio.sfx('select');
        ui.toast(`¡Hola, ${v}!`, { icon: tdef().emoji, type: 'good' });
      }
    };
    input.addEventListener('change', commitName);
    input.addEventListener('blur', commitName);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === 'Escape') { e.stopPropagation(); input.blur(); } });

    $('.wd-back').addEventListener('click', () => { audio.sfx('close'); goBack(); });
    $('.wd-random').addEventListener('click', surprise);
    $('.wd-seg').addEventListener('click', (e) => {
      const b = e.target.closest('[data-mode]'); if (!b) return;
      setMode(b.dataset.mode);
    });
    $('.wd-cats').addEventListener('click', (e) => {
      const b = e.target.closest('[data-cat]'); if (!b || b.dataset.cat === catId) return;
      audio.sfx('tap');
      catId = b.dataset.cat;
      renderCats(); renderList(true);
    });
    $('.wd-list').addEventListener('click', onListClick);
    $('.wd-undo').addEventListener('click', () => { audio.sfx('close'); undoPending(); });
    $('.wd-buybtn').addEventListener('click', () => buyPending());
  }

  function renderRes() {
    if (!root) return;
    root.querySelector('.wd-coins b').textContent = fmtNum(S().coins);
    root.querySelector('.wd-gems b').textContent = fmtNum(S().gems);
  }
  function bumpRes(kind) {
    const el = root?.querySelector(kind === 'gems' ? '.wd-gems' : '.wd-coins');
    if (!el) return;
    el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
  }

  function renderSeg() {
    const t = tdef();
    root.querySelector('.wd-nameicon').innerHTML = icon(t.emoji, 22);
    for (const b of root.querySelectorAll('.wd-segbtn')) {
      b.classList.toggle('active', b.dataset.mode === mode);
      if (b.dataset.mode === 'avatar') b.innerHTML = `${icon(t.emoji, 24)}${ui.esc(t.name)}`;
      if (b.dataset.mode === 'car') {
        const locked = !garageOk();
        b.classList.toggle('locked', locked);
        b.innerHTML = `${icon('car', 24)}Auto${locked ? icon('lock', 18) : ''}`;
      }
    }
  }
  function renderCats() {
    const el = root.querySelector('.wd-cats');
    el.innerHTML = cats().map(c => `<button class="tab${c.id === catId ? ' active' : ''}" data-cat="${c.id}">${icon(c.types ? tdef().emoji : c.icon, 18)}${catLabel(c)}</button>`).join('');
    el.querySelector('.active')?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }

  function thumbSpec(c, item) {
    if (mode === 'avatar') {
      const look = { ...pv.avatar, [c.id]: item.id };
      let frame = c.frame;
      // peinados sin sombrero que los tape; pelajes sin ropa y más de cerca (se ven manchas, rayas y patitas)
      if (c.id === 'hair') Object.assign(look, { crown: 'ninguna', acc: 'ninguno' }, tdef().animal ? { dress: 'pelito' } : {});
      if (BACK_ITEMS.has(item.id)) frame = 'back';
      else if (c.id === 'hair' && tdef().animal) frame = pv.avatar.type === 'conejito' ? 'furtall' : 'fur';
      else if (BODY_ITEMS.has(item.id)) frame = 'body';
      else if (frame === 'head' && (TALL_ITEMS.has(item.id) || pv.avatar.type === 'conejito' || look.hair === 'barba')) frame = 'tall';
      return { type: 'avatar', look, frame };
    }
    return { type: 'car', car: { ...pv.car, [c.id]: item.id }, frame: c.frame };
  }

  function itemFoot(c, item, owned, equipped) {
    if (equipped) return `<span class="chip mint">Puesto</span>`;
    if (owned) return `<span class="chip">Tuyo</span>`;
    if ((item.unlock || 1) > S().player.level) return `<span class="chip lilac">${icon('lock', 12)}Nivel ${item.unlock}</span>`;
    return ui.costHtml(item.price || {}, 16);
  }

  // look con el que se muestra cada tipo en su tarjeta (el último que usaste con ese tipo, o el inicial)
  function typeLook(t) {
    if (t.id === pv.avatar.type) return pv.avatar;
    return normalizeLook({ ...t.look, ...(S().avatarLooks?.[t.id] || {}), type: t.id });
  }
  function typeCard(t) {
    const on = t.id === pv.avatar.type;
    const spec = { type: 'avatar', look: typeLook(t), frame: t.id === 'conejito' ? 'tallbody' : 'body' };
    const cached = hasThumb(spec);
    return `<button class="wd-card${on ? ' on' : ''}" data-type="${t.id}">
      ${on ? `<span class="wd-check">${icon('check', 14)}</span>` : ''}
      <span class="wd-thumb"><img class="th${cached ? ' ok' : ''}" alt="" draggable="false" ${cached ? `src="${thumbnail(spec)}"` : ''} data-k="${encodeURIComponent(JSON.stringify(spec))}"></span>
      <span class="wd-name">${ui.esc(t.name)}</span>
      <span class="wd-foot">${on ? '<span class="chip mint">Elegido</span>' : '<span class="chip">Gratis</span>'}</span>
    </button>`;
  }

  function renderList(resetScroll = false) {
    const c = cat();
    const el = root.querySelector('.wd-list');
    const t = target();
    let html = '';
    if (c.types) {
      const cur = tdef();
      html += `<div class="wd-typeinfo">${icon(cur.emoji, 20)} <b>${ui.esc(cur.name)}</b> · ${ui.esc(cur.desc)}</div>`;
      for (const fam of AVATAR_FAMILIES) {
        html += `<div class="wd-fam">${icon(fam.emoji, 18)}${ui.esc(fam.name)}</div><div class="wd-grid">`;
        html += AVATAR_TYPES.filter(x => x.family === fam.id).map(typeCard).join('');
        html += '</div>';
      }
      html += `<p class="wd-note">${icon('sparkle', 14)} Cambiar de personaje es gratis. Cada uno guarda su último look.</p>`;
      el.innerHTML = html;
      if (resetScroll) el.scrollTop = 0;
      queueThumbs();
      return;
    }
    if (c.stats) {
      const st = carStats(pv.car);
      const pips = (n, cls) => `<span class="wd-pips ${cls}">${[1, 2, 3, 4, 5].map(i => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}</span>`;
      html += `<div class="wd-stats"><div class="wd-stat"><span>${icon('bolt', 16)}Velocidad</span>${pips(st.speed, 'sp')}</div><div class="wd-stat"><span>${icon('star', 16)}Manejo</span>${pips(st.handling, 'hd')}</div></div>`;
    }
    if (c.colors) {
      const cur = pv[t][c.id];
      html += `<div class="wd-swatches">${c.colors.map(col => `<button class="wd-sw${String(col.id) === String(cur) ? ' on' : ''}" data-id="${col.id}" aria-label="${col.name}"><i style="background:${col.hex}">${String(col.id) === String(cur) ? icon('heart', 24) : ''}</i>${col.name}</button>`).join('')}</div>`;
      html += `<p class="wd-note">${icon('sparkle', 14)} Los colores son gratis: ¡probá todos!</p>`;
    } else {
      html += '<div class="wd-grid">';
      for (const item of itemsFor(c)) {
        const owned = store.owns(c.kind, item.id);
        const equipped = S()[t][c.id] === item.id;
        const trying = pv[t][c.id] === item.id && !owned;
        const locked = !owned && (item.unlock || 1) > S().player.level;
        const spec = thumbSpec(c, item);
        const cached = hasThumb(spec);
        html += `<button class="wd-card${equipped ? ' on' : ''}${trying ? ' trying' : ''}${locked ? ' locked' : ''}" data-id="${item.id}">
          ${equipped ? `<span class="wd-check">${icon('check', 14)}</span>` : ''}
          <span class="wd-thumb"><img class="th${cached ? ' ok' : ''}" alt="" draggable="false" ${cached ? `src="${thumbnail(spec)}"` : ''} data-k="${encodeURIComponent(JSON.stringify(spec))}">${locked ? `<span class="wd-lock">${icon('lock', 24)}</span>` : ''}</span>
          <span class="wd-name">${ui.esc(item.name)}</span>
          ${c.stats ? `<span class="wd-mini" aria-label="Velocidad ${item.speed}, manejo ${item.handling}">${icon('bolt', 12)}${item.speed}<i></i>${icon('star', 12)}${item.handling}</span>` : ''}
          <span class="wd-foot">${itemFoot(c, item, owned, equipped)}</span>
        </button>`;
      }
      html += '</div>';
    }
    el.innerHTML = html;
    if (resetScroll) el.scrollTop = 0;
    queueThumbs();
  }

  function queueThumbs() {
    thumbQueue = [...root.querySelectorAll('img.th:not(.ok)')];
    if (!thumbRaf && thumbQueue.length) thumbRaf = requestAnimationFrame(processThumbs);
  }
  function processThumbs() {
    thumbRaf = 0;
    if (!alive) return;
    const t0 = performance.now();
    while (thumbQueue.length && performance.now() - t0 < 12) {
      const img = thumbQueue.shift();
      if (!img.isConnected) continue;
      try {
        img.src = thumbnail(JSON.parse(decodeURIComponent(img.dataset.k)));
        img.classList.add('ok');
      } catch (e) { console.warn('miniatura', e); }
    }
    if (thumbQueue.length) thumbRaf = requestAnimationFrame(processThumbs);
  }

  function renderBuy() {
    const bar = root.querySelector('.wd-buy');
    const p = pending[pending.length - 1];
    if (!p) { bar.hidden = true; return; }
    const item = itemOf(p);
    bar.hidden = false;
    bar.querySelector('.wd-buy-info b').textContent = item.name + (pending.length > 1 ? ` (+${pending.length - 1})` : '');
    const btn = bar.querySelector('.wd-buybtn');
    const lockLv = (item.unlock || 1) > S().player.level ? item.unlock : 0;
    btn.disabled = !!lockLv;
    btn.innerHTML = lockLv ? `${icon('lock', 18)}Nivel ${lockLv}` : `Comprar ${ui.costHtml(item.price || {}, 18)}`;
  }
  const itemOf = (p) => CUSTOM_CATALOG[p.kind].find(i => i.id === p.id);

  // ---------------- acciones ----------------
  function setMode(m, silent = false) {
    if (m === mode) return;
    if (m === 'car' && !garageOk()) {
      audio.sfx('error');
      const enObra = S().city.buildings.some(b => b.id === 'garaje');
      ui.toast(enObra ? `¡Tu ${BUILDING_BY_ID.garaje.name} está en obra! Cuando termine vas a poder tunear tu auto`
        : `Construí el ${BUILDING_BY_ID.garaje.name} para tunear tu auto`, { icon: enObra ? 'hammer' : 'lock' });
      return;
    }
    if (!silent) audio.sfx('swoosh');
    mode = m;
    catId = cats()[mode === 'avatar' ? 1 : 0].id;
    renderSeg(); renderCats(); renderList(true);
    applyMode();
  }

  /** Cambia el tipo de personaje (gratis, al instante). */
  function setType(typeId) {
    if (typeId === pv.avatar.type) { hop(); audio.sfx('pop'); return; }
    // lo probado sin comprar no pasa al otro tipo
    pending = pending.filter(p => p.target !== 'avatar');
    pv.avatar = normalizeLook(S().avatar);
    store.setAvatarType(typeId);
    pv.avatar = normalizeLook(S().avatar);
    audio.sfx('combo', 2);
    rebuildModel(true);
    burst(0.9, 22);
    spinTo(0.3);
    renderSeg(); renderCats(); renderList(); renderBuy();
  }

  function onListClick(e) {
    const tb = e.target.closest('[data-type]');
    if (tb) { setType(tb.dataset.type); return; }
    const b = e.target.closest('[data-id]');
    if (!b) return;
    const c = cat();
    const raw = b.dataset.id;
    const id = c.id === 'skin' ? Number(raw) : raw;
    tryItem(c, id, b);
  }

  function tryItem(c, id, el) {
    const t = target();
    const owned = c.colors ? true : store.owns(c.kind, id);
    const was = pv[t][c.id];
    pending = pending.filter(p => !(p.target === t && p.key === c.id));
    pv[t][c.id] = id;
    if (owned) {
      if (S()[t][c.id] !== id) store.setLook(t, c.id, id);
      audio.sfx(c.colors ? 'select' : 'pop');
    } else {
      pending.push({ target: t, key: c.id, kind: c.kind, id });
      audio.sfx('pop');
    }
    if (was !== id || !owned) {
      rebuildModel(true);
      const f = FOCUS[c.id]?.[id];
      spinTo(f ?? 0.3);
    } else hop();
    renderList();
    renderBuy();
    if (el) { const n = root.querySelector(`.wd-list [data-id="${CSS.escape(String(id))}"]`); n?.classList.add('wd-pop'); }
  }

  function undoPending() {
    const p = pending.pop();
    if (!p) return;
    pv[p.target][p.key] = S()[p.target][p.key];
    rebuildModel(true);
    renderList(); renderBuy();
  }

  async function buyPending() {
    const p = pending[pending.length - 1];
    if (!p) return;
    const item = itemOf(p);
    const price = item.price || {};
    if ((item.unlock || 1) > S().player.level) { audio.sfx('error'); ui.toast(`Se desbloquea en nivel ${item.unlock}`, { icon: 'lock' }); return; }
    if (!store.canAfford(price)) {
      audio.sfx('error');
      const miss = price.gems && S().gems < price.gems ? `${price.gems - S().gems} gemas` : `${fmtNum((price.coins || 0) - S().coins)} monedas`;
      ui.toast(`Te faltan ${miss}. ¡Jugá minijuegos para ganar más!`, { icon: price.gems ? 'gem' : 'coin', type: 'bad' });
      return;
    }
    audio.sfx('tap');
    const ok = await ui.confirm('¿Lo comprás?', `<b>${ui.esc(item.name)}</b><br><br>${ui.costHtml(price, 22)}`, '¡Comprar!', 'Ahora no');
    if (!ok || !alive) return;
    if (!store.buyItem(p.kind, p.id)) { audio.sfx('error'); ui.toast('No se pudo comprar', { icon: 'info', type: 'bad' }); return; }
    pending = pending.filter(x => x !== p);
    pv[p.target][p.key] = p.id;
    store.setLook(p.target, p.key, p.id);
    audio.sfx('buy');
    ui.confetti();
    const btn = root.querySelector('.wd-buybtn').getBoundingClientRect();
    ui.floatText(btn.left + btn.width / 2, btn.top, `-${ui.costHtml(price, 20)}`);
    bumpRes(price.gems ? 'gems' : 'coins');
    ui.toast(`¡${item.name} ya es tuyo!`, { icon: 'sparkle', type: 'good' });
    hop(true);
    renderList(); renderBuy(); renderRes();
  }

  // Look sorpresa: mezcla al azar entre lo que ya tenés (sin cambiar el tipo de personaje)
  function surprise() {
    const t = target();
    const list = cats();
    for (const c of list) {
      if (c.types || c.id === 'skin') continue; // el tipo y la piel no se cambian solos
      let opts;
      if (c.colors) opts = c.colors.map(x => x.id);
      else opts = itemsFor(c).filter(i => store.owns(c.kind, i.id)).map(i => i.id);
      if (!opts.length) continue;
      const id = opts[Math.floor(Math.random() * opts.length)];
      pv[t][c.id] = id;
      if (S()[t][c.id] !== id) store.setLook(t, c.id, id);
    }
    pending = pending.filter(p => p.target !== t);
    audio.sfx('combo', 3);
    rebuildModel(true);
    spinTo(0.3);
    renderList(); renderBuy();
  }

  function goBack() {
    root?.querySelector('.wd-namebox input')?.blur();
    // lo probado sin comprar no se queda puesto: avisarlo para que no parezca un error
    if (pending.length) ui.toast('Lo que probaste sin comprar quedó en el vestidor', { icon: 'dress' });
    store.save();
    ctx.router.go(params.back && params.back !== 'wardrobe' ? params.back : 'city');
  }

  // ---------------- 3D ----------------
  function buildStage(stageEl) {
    // mismo pixel y contorno tinta que la ciudad (default de createPixelRenderer; 2.5 en baja calidad)
    const lowQ = !!S().settings?.lowQuality;
    r = createPixelRenderer(stageEl, { ortho: false, fov: 30, background: 0xffe3f1, pixelSize: lowQ ? 2.5 : undefined, outline: true });
    const { sun } = addLights(r.scene, { shadowSize: 9, shadowRes: 1024 });
    sun.position.set(5, 12, 9);
    const fill = new THREE.DirectionalLight(0xffd6ec, 0.7);
    fill.position.set(-4, 3, 6);
    r.scene.add(fill);
    r.scene.fog = new THREE.Fog(0xffe3f1, 9, 16);

    boutique = buildBoutique();
    garage = buildGarage();
    r.scene.add(boutique, garage);
    turntable = new THREE.Group();
    platP = buildPlatform('boutique');
    platG = buildPlatform('garage');
    holder = new THREE.Group();
    turntable.add(platP, platG, holder);
    r.scene.add(turntable);

    // brillitos (pool)
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const cols = [0xffffff, 0xffe066, 0xff9cc8, 0xc9b8ff, 0x9ff0ff];
    for (let i = 0; i < 34; i++) {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: cols[i % cols.length], transparent: true, opacity: 0, depthWrite: false }));
      m.visible = false;
      r.scene.add(m);
      sparkles.push({ m, life: 0, max: 1, v: new THREE.Vector3(), ambient: i < 8 });
    }
    applyMode(true);
    r.onFrame(frame);
    r.start();
  }

  function applyMode(instant = false) {
    const car = mode === 'car';
    boutique.visible = !car; platP.visible = !car;
    garage.visible = car; platG.visible = car;
    holder.position.y = (car ? platG : platP).userData.top;
    rebuildModel(false);
    rot = car ? 0.6 : 0.35; rotVel = 0; idleT = 0;
    if (instant) { camTarget(); camPos.copy(camWant); camLook.copy(lookWant); }
  }

  function rebuildModel(animate) {
    if (model) holder.remove(model);
    model = mode === 'avatar' ? avatarModel(pv.avatar) : carModel(pv.car, { driver: pv.avatar });
    holder.add(model);
    if (animate) {
      hop();
      burst(mode === 'car' ? 0.45 : 0.6);
      if (mode === 'car') carSpin = 5;
    }
  }

  function hop(big = false) { hopT = big ? -0.15 : 0; }

  function burst(h = 0.6, n = 16, color = null) {
    let k = 0;
    for (const s of sparkles) {
      if (s.ambient || s.life > 0) continue;
      const a = Math.random() * Math.PI * 2, rr = 0.35 + Math.random() * 0.3;
      s.m.position.set(Math.cos(a) * rr, 0.15 + Math.random() * h * 1.4, Math.sin(a) * rr);
      s.v.set(Math.cos(a) * 0.5, 0.6 + Math.random() * 0.9, Math.sin(a) * 0.5);
      s.life = s.max = 0.7 + Math.random() * 0.5;
      s.m.visible = true;
      if (color != null) s.m.material.color.setHex(color);
      if (++k >= n) break;
    }
  }

  // calcula a dónde tiene que ir la cámara (en camWant / lookWant, sin crear objetos por frame)
  function camTarget() {
    const w = r.canvas.clientWidth || 1, h = r.canvas.clientHeight || 1;
    const aspect = w / h;
    const car = mode === 'car';
    const phone = h < 520;
    const big = h >= 700;
    let dist = car ? (phone ? 4.3 : big ? 4.7 : 4.5) : (phone ? 4.1 : big ? 5.2 : 4.7);
    const look = lookWant.set(0, car ? 0.3 : 0.62, 0);
    if (phone) look.y += car ? 0.1 : 0.08; // la barra de arriba tapa un poco
    const need = car ? 1.1 : 0.85; // ancho mínimo visible
    if (aspect < need) dist *= need / aspect;
    const lift = car ? 1.2 : 0.45;
    camWant.set(0, look.y + lift * (dist / 4), dist);
  }

  function spinTo(angle) {
    // ángulo equivalente más cercano
    const full = Math.PI * 2;
    let a = angle;
    while (a - rot > Math.PI) a -= full;
    while (rot - a > Math.PI) a += full;
    focus = { a, hold: 3.2 };
    rotVel = 0;
  }

  function frame(dt, t) {
    if (!alive) return;
    // giro: arrastre > foco > inercia > automático
    if (!dragging) {
      idleT += dt;
      if (focus) {
        rot += (focus.a - rot) * Math.min(1, dt * 6);
        if (Math.abs(focus.a - rot) < 0.01) { focus.hold -= dt; if (focus.hold <= 0) { focus = null; idleT = 0; } }
      } else if (Math.abs(rotVel) > 0.02) {
        rot += rotVel * dt;
        rotVel *= Math.pow(0.04, dt);
      } else if (idleT > 2.5) {
        rot += dt * 0.38 * Math.min(1, (idleT - 2.5) / 1.5);
      }
    }
    turntable.rotation.y = rot;

    // salto
    if (hopT < 1) {
      hopT = Math.min(1, hopT + dt * 2.4);
      const k = Math.max(0, hopT);
      const y = Math.sin(k * Math.PI) * 0.16;
      const sq = hopT < 0 ? 0.12 : Math.sin(k * Math.PI * 2) * 0.06 * (1 - k);
      model.position.y = y;
      model.scale.set(1 + sq, 1 - sq, 1 + sq);
    } else { model.position.y = 0; model.scale.set(1, 1, 1); }

    if (mode === 'avatar') model.userData.update(dt, false);
    else { carSpin *= Math.pow(0.15, dt); model.userData.update(dt, carSpin, Math.sin(t * 0.8) * 0.4); }
    (mode === 'avatar' ? platP : platG).userData.update(dt);

    // brillitos
    for (const s of sparkles) {
      if (s.ambient) {
        if (s.life <= 0) {
          const a = Math.random() * Math.PI * 2, rr = 0.5 + Math.random() * 0.6;
          s.m.position.set(Math.cos(a) * rr, Math.random() * 0.3, Math.sin(a) * rr);
          s.v.set(0, 0.12 + Math.random() * 0.15, 0);
          s.life = s.max = 3 + Math.random() * 3;
          s.m.visible = true;
        }
      }
      if (s.life <= 0) continue;
      s.life -= dt;
      s.m.position.addScaledVector(s.v, dt);
      if (!s.ambient) s.v.y -= dt * 1.2;
      const k = s.life / s.max;
      const sz = (s.ambient ? 0.035 : 0.05) * (0.4 + Math.sin(k * Math.PI));
      s.m.scale.setScalar(sz);
      s.m.rotation.set(0.8, t * 2, 0.6);
      s.m.material.opacity = Math.min(1, Math.sin(k * Math.PI) * 1.4) * (s.ambient ? 0.8 : 1);
      if (s.life <= 0) s.m.visible = false;
    }

    // cámara suave
    camTarget();
    const f = Math.min(1, dt * 4);
    camPos.lerp(camWant, f); camLook.lerp(lookWant, f);
    r.camera.position.copy(camPos);
    r.camera.lookAt(camLook);
  }

  // arrastrar para girar, tocar para mimos
  function bindStage(stageEl) {
    let start = null, lastX = 0, lastT = 0, moved = 0;
    const down = (e) => {
      if (e.target.closest('button, input, label')) return;
      start = { x: e.clientX, y: e.clientY, id: e.pointerId };
      lastX = e.clientX; lastT = performance.now(); moved = 0;
      dragging = true; focus = null; rotVel = 0;
      stageEl.setPointerCapture?.(e.pointerId);
      stageEl.classList.add('drag');
    };
    const move = (e) => {
      if (!start || e.pointerId !== start.id) return;
      const dx = e.clientX - lastX;
      const now = performance.now();
      moved += Math.abs(dx);
      rot += dx * 0.012;
      rotVel = dx * 0.012 / Math.max(0.008, (now - lastT) / 1000);
      lastX = e.clientX; lastT = now;
      if (moved > 8) root.querySelector('.wd-hint')?.classList.add('gone');
    };
    const up = (e) => {
      if (!start || e.pointerId !== start.id) return;
      dragging = false; idleT = 0;
      stageEl.classList.remove('drag');
      if (performance.now() - lastT > 90) rotVel = 0;
      rotVel = Math.max(-8, Math.min(8, rotVel));
      if (moved < 8) tapModel(e);
      start = null;
    };
    stageEl.addEventListener('pointerdown', down);
    stageEl.addEventListener('pointermove', move);
    stageEl.addEventListener('pointerup', up);
    stageEl.addEventListener('pointercancel', up);
  }
  function tapModel(e) {
    const ray = new THREE.Raycaster();
    ray.setFromCamera(r.toNDC(e.clientX, e.clientY), r.camera);
    if (!ray.intersectObject(model, true).length) return;
    hop();
    if (mode === 'car') { audio.sfx('horn'); carSpin = 6; burst(0.4, 10, 0xffe066); }
    else { audio.sfx('pop'); burst(0.8, 12, 0xff9cc8); ui.floatText(e.clientX, e.clientY - 20, icon('heart', 28)); }
  }

  function onKey(e) {
    if (e.target.closest?.('input, textarea')) return;
    if (e.key === 'Escape') {
      if (ui.hasModal()) ui.closeAllModals(); else { audio.sfx('close'); goBack(); }
      e.preventDefault();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      spinTo(rot + (e.key === 'ArrowLeft' ? -0.8 : 0.8));
      focus.hold = 1.5;
      e.preventDefault();
    }
  }

  return {
    hud: false,
    music: 'calm',
    async mount(container, p = {}) {
      params = p || {};
      alive = true;
      styleEl = document.createElement('style');
      styleEl.id = 'wardrobe-style';
      styleEl.textContent = WD_CSS;
      document.head.append(styleEl);

      pv.avatar = normalizeLook(S().avatar);
      pv.car = normalizeCar(S().car);
      if ((params.tab === 'car' || params.mode === 'car') && garageOk()) { mode = 'car'; catId = CAR_CATS[0].id; }
      else if (params.tab === 'type') catId = 'type'; // desde Ajustes: "Cambiar personaje"

      buildDom(container);
      renderRes(); renderSeg(); renderCats(); renderList(true); renderBuy();
      const stageEl = root.querySelector('.wd-stage');
      buildStage(stageEl);
      bindStage(stageEl);

      addEventListener('keydown', onKey);
      offs.push(() => removeEventListener('keydown', onKey));
      offs.push(bus.on('currency:changed', renderRes));
      offs.push(bus.on('level:up', () => { renderList(); renderBuy(); }));
      offs.push(bus.on('building:built', () => renderSeg()));
      const hintT = setTimeout(() => root?.querySelector('.wd-hint')?.classList.add('gone'), 6000);
      offs.push(() => clearTimeout(hintT));
    },
    unmount() {
      alive = false;
      for (const off of offs.splice(0)) { try { off(); } catch {} }
      cancelAnimationFrame(thumbRaf); thumbRaf = 0; thumbQueue = [];
      if (r) { r.dispose(); r = null; }
      disposeThumbs();
      sparkles = [];
      model = null;
      styleEl?.remove(); styleEl = null;
      root?.remove(); root = null;
      pending = [];
    },
  };
}
