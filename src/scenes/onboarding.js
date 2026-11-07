// Primera vez (partida nueva): elegir tipo de personaje y colores, nombre del personaje y de la ciudad.
// Arriba (o a la izquierda en PC) el personaje girando en 3D; abajo (o a la derecha) los pasos.
// Al terminar marca state.onboarded, entra a la ciudad y abre el selector de estilo de ciudad
// (openThemePicker de src/city/themes-ui.js, si existe).
import * as THREE from 'three';
import { createPixelRenderer, addLights } from '../core/voxel.js';
import { icon } from '../core/icons.js';
import { AVATAR_TYPES, AVATAR_FAMILIES, HAIR_COLORS, OUTFIT_COLORS, SKIN_TONES, avatarType } from '../core/data.js';
import { avatarModel, normalizeLook } from '../avatar/avatar.js';
import { buildPlatform, thumbnail, hasThumb, disposeThumbs } from '../avatar/wardrobe-stage.js';

const NAMES = {
  fem: ['Luna', 'Mora', 'Olivia', 'Nina', 'Emma', 'Sofi', 'Cami', 'Abril', 'Lola', 'Pilar', 'Uma', 'Juli'],
  masc: ['Tomi', 'Bruno', 'Simón', 'Benja', 'Joaco', 'Santi', 'Felipe', 'Teo', 'Lautaro', 'Nico', 'Lucas', 'Gael'],
  animal: ['Pipo', 'Kiki', 'Nube', 'Pancho', 'Canela', 'Mostaza', 'Rulo', 'Miel', 'Rocco', 'Chispa', 'Mate', 'Tofu'],
};
const CITY_NAMES = ['Villa del Lago', 'Puerto Sereno', 'Las Acacias', 'Bahía Mansa', 'Valle Viejo', 'Pixelandia',
  'Los Álamos', 'Puerto Piedra', 'San Pixel', 'Cerro Chato', 'Lomas del Sol', 'Paso Hondo'];
const COLOR_NAMES = {
  castano: 'Castaño', negro: 'Negro', rubio: 'Rubio', pelirrojo: 'Colorado', rosa: 'Rosa', lila: 'Lila', celeste: 'Celeste',
  menta: 'Menta', blanco: 'Blanco', chocolate: 'Chocolate', gris: 'Gris', fucsia: 'Fucsia', violeta: 'Violeta', azul: 'Azul',
  verde: 'Verde', dorado: 'Dorado', durazno: 'Durazno', rojo: 'Rojo',
};
const nameKind = (t) => (t.animal ? 'animal' : ['principe', 'chico', 'mago'].includes(t.id) ? 'masc' : 'fem');
const pickOther = (list, cur) => { const opts = list.filter(x => x !== cur); return opts[Math.floor(Math.random() * opts.length)]; };
const isDefaultName = (n) => !n || n === 'Pixelín' || n === 'Princesa'; // nombres por defecto (net.js)
const clean = (s) => [...String(s || '').replace(/\s+/g, ' ').trim()].slice(0, 16).join('').trim();

const OB_CSS = `
.scene-onboarding .ob { position:absolute; inset:0; display:flex; flex-direction:column; background:linear-gradient(#fdebdb,#f9f1e6); }
.scene-onboarding .ob-stage { position:relative; flex:0 0 40%; min-height:0; overflow:hidden; touch-action:none; }
.scene-onboarding .ob-stage canvas { position:absolute; inset:0; }
.scene-onboarding .ob-title { position:absolute; z-index:2; top:calc(var(--safe-t) + 12px); left:0; right:0; text-align:center; pointer-events:none; }
.scene-onboarding .ob-title b { display:inline-block; padding:6px 16px; font-size:22px; background:#fff; border:var(--line) solid var(--ink); border-radius:14px;
  box-shadow:0 3px 0 var(--ink); animation:obPop .5s cubic-bezier(.3,1.6,.6,1); }
.scene-onboarding .ob-title small { display:block; margin-top:6px; font-size:14px; font-weight:700; color:var(--ink-l); text-shadow:0 1px 0 #fff; }
.scene-onboarding .ob-panel { position:relative; z-index:3; flex:1 1 auto; min-height:0; display:flex; flex-direction:column; margin-top:-16px;
  background:var(--panel); border-top:var(--line) solid var(--ink); border-radius:20px 20px 0 0; box-shadow:0 -4px 0 rgba(61,47,42,.12); }
.scene-onboarding .ob-dots { display:flex; justify-content:center; gap:8px; padding:12px 0 2px; }
.scene-onboarding .ob-dots i { width:10px; height:10px; border-radius:50%; border:2px solid var(--ink); background:#fff; transition:background .2s, transform .2s; }
.scene-onboarding .ob-dots i.on { background:var(--primary); transform:scale(1.25); }
.scene-onboarding .ob-body { flex:1 1 auto; min-height:0; padding:8px 14px 14px; }
.scene-onboarding .ob-h { margin:6px 2px 10px; font-size:19px; }
.scene-onboarding .ob-fam { margin:12px 2px 6px; font-size:14px; font-weight:700; color:var(--ink-l); display:flex; align-items:center; gap:6px; }
.scene-onboarding .ob-types { display:grid; grid-template-columns:repeat(2, 1fr); gap:10px 8px; }
.scene-onboarding .ob-type { position:relative; display:flex; flex-direction:column; align-items:center; gap:2px; padding:5px 3px 7px; background:#fff; color:var(--ink);
  border:var(--line) solid var(--ink); border-radius:12px; box-shadow:0 3px 0 var(--ink); font-family:inherit; font-size:14px; font-weight:700; }
.scene-onboarding .ob-type:active { transform:translateY(2px); box-shadow:0 1px 0 var(--ink); }
.scene-onboarding .ob-type.on { background:var(--gold-l); outline:3px solid var(--gold-d); outline-offset:2px; }
.scene-onboarding .ob-type .th { width:64px; height:64px; border-radius:10px; opacity:0; transition:opacity .2s;
  background:radial-gradient(circle at 50% 42%, #fff 0 38%, #f9f3e9 72%); }
.scene-onboarding .ob-type .th.ok { opacity:1; }
.scene-onboarding .ob-type.on .th { background:radial-gradient(circle at 50% 42%, #fff 0 38%, #ffe4a3 72%); }
.scene-onboarding .ob-row { margin:14px 2px 4px; font-size:14px; font-weight:700; color:var(--ink-l); }
.scene-onboarding .ob-sw { display:flex; gap:8px; overflow-x:auto; padding:4px 2px 8px; scrollbar-width:none; }
.scene-onboarding .ob-sw::-webkit-scrollbar { display:none; }
.scene-onboarding .ob-sw button { flex:none; width:38px; height:38px; border:var(--line) solid var(--ink); border-radius:10px; padding:0;
  box-shadow:inset -4px -4px 0 rgba(61,47,42,.16), inset 3px 3px 0 rgba(255,255,255,.5), 0 2px 0 var(--ink); }
.scene-onboarding .ob-sw button.on { outline:3px solid var(--gold-d); outline-offset:2px; transform:translateY(-2px); }
.scene-onboarding .ob-field { display:flex; align-items:center; gap:8px; margin:0 0 16px; }
.scene-onboarding .ob-field label { display:block; margin:0 2px 6px; font-size:15px; font-weight:700; }
.scene-onboarding .ob-input { flex:1; min-width:0; height:50px; padding:0 12px; font-family:inherit; font-size:20px; font-weight:700; color:var(--ink); background:#fff;
  border:var(--line) solid var(--ink); border-radius:12px; box-shadow:inset 0 3px 0 #f3eee6; }
.scene-onboarding .ob-input:focus { outline:none; border-color:var(--primary-d); }
.scene-onboarding .ob-dice { flex:none; width:50px; height:50px; }
.scene-onboarding .ob-hint { margin:-8px 2px 14px; font-size:13px; color:var(--ink-l); }
.scene-onboarding .ob-foot { display:flex; gap:8px; padding:10px 14px calc(var(--safe-b) + 12px); border-top:2px dashed #efe6d8; }
.scene-onboarding .ob-foot .btn { min-height:50px; font-size:18px; }
.scene-onboarding .ob-foot .ob-next { flex:1; }
.scene-onboarding .ob-step { animation:obIn .3s ease-out; }
@keyframes obIn { from { opacity:0; transform:translateX(24px); } }
@keyframes obPop { from { transform:scale(.6); opacity:0; } }
@media (orientation: landscape) and (min-width: 700px) {
  .scene-onboarding .ob { flex-direction:row; }
  .scene-onboarding .ob-stage { flex:1 1 auto; }
  .scene-onboarding .ob-panel { flex:0 0 min(500px, 46%); margin:0; padding-top:var(--safe-t); border-top:0; border-left:var(--line) solid var(--ink);
    border-radius:20px 0 0 20px; box-shadow:-4px 0 0 rgba(61,47,42,.12); }
  .scene-onboarding .ob-foot { padding-right:calc(var(--safe-r) + 14px); }
  .scene-onboarding .ob-title b { font-size:28px; }
}
`;

export default function create(ctx) {
  const { store, ui, audio } = ctx;
  let root, r, styleEl;
  let alive = false, step = 0, finishing = false;
  const offs = [];
  let thumbRaf = 0, thumbQueue = [];
  // tema de ciudad: se precarga para abrirlo apenas se llega a la ciudad
  let themesMod = null;

  const S = () => store.state;
  const look = normalizeLook(S().avatar);
  // partida nueva: el personaje arranca con un tipo de "Gente" al azar (los animales quedan como opción en la lista)
  if (JSON.stringify(look) === JSON.stringify(normalizeLook({ ...avatarType(look.type).look, type: look.type }))) {
    const people = AVATAR_TYPES.filter(t => t.family === 'casual');
    const ty = people[Math.floor(Math.random() * people.length)];
    Object.assign(look, normalizeLook({ ...ty.look, type: ty.id }));
  }
  // colores que tocó el jugador (se conservan al cambiar de tipo; los demás vienen del look del tipo)
  const touched = new Set();
  // si la partida ya tenía nombres propios, se precargan (no se pisan)
  let name = isDefaultName(S().player.name) ? '' : clean(S().player.name);
  let city = !S().player.cityName || S().player.cityName === 'Pixelia' ? '' : clean(S().player.cityName);
  // sugerencias: lo que se ve en el campo vacío es lo que se guarda si no escribe nada
  const sugg = { name: '', kind: '', city: CITY_NAMES[Math.floor(Math.random() * CITY_NAMES.length)] };
  const suggestedName = () => {
    const k = nameKind(avatarType(look.type));
    if (sugg.kind !== k) { sugg.kind = k; sugg.name = NAMES[k][Math.floor(Math.random() * NAMES[k].length)]; }
    return sugg.name;
  };

  // ---------- 3D ----------
  let turntable, holder, model = null, plat, rot = 0.3, hopT = 1, dragging = false, rotVel = 0;
  const sparkles = [];
  function buildStage(el) {
    // mismo pixel y contorno tinta que el vestidor y la ciudad (2.5 en baja calidad)
    const lowQ = !!S().settings?.lowQuality;
    r = createPixelRenderer(el, { ortho: false, fov: 30, background: 0xf9f3e9, lowQuality: lowQ, outline: true, idleFps: 30 });
    const { sun } = addLights(r.scene, { shadowSize: 6, shadowRes: 1024 });
    sun.position.set(5, 12, 9);
    const fill = new THREE.DirectionalLight(0xfde9d8, 0.7);
    fill.position.set(-4, 3, 6);
    r.scene.add(fill);
    turntable = new THREE.Group();
    plat = buildPlatform('boutique');
    holder = new THREE.Group();
    holder.position.y = plat.userData.top;
    turntable.add(plat, holder);
    r.scene.add(turntable);
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const cols = [0xffffff, 0xffe066, 0xf1a181, 0xc5d3f2, 0x9ff0ff];
    for (let i = 0; i < 24; i++) {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: cols[i % cols.length], transparent: true, opacity: 0, depthWrite: false }));
      m.visible = false; r.scene.add(m);
      sparkles.push({ m, life: 0, max: 1, v: new THREE.Vector3() });
    }
    rebuild(false);
    r.onFrame(frame);
    r.start();
  }
  function rebuild(animate = true) {
    if (model) holder.remove(model);
    model = avatarModel(look);
    holder.add(model);
    if (animate) { hopT = 0; burst(); }
  }
  function burst(n = 16) {
    let k = 0;
    for (const s of sparkles) {
      if (s.life > 0) continue;
      const a = Math.random() * Math.PI * 2, rr = 0.35 + Math.random() * 0.3;
      s.m.position.set(Math.cos(a) * rr, 0.15 + Math.random() * 0.9, Math.sin(a) * rr);
      s.v.set(Math.cos(a) * 0.5, 0.6 + Math.random() * 0.9, Math.sin(a) * 0.5);
      s.life = s.max = 0.7 + Math.random() * 0.5;
      s.m.visible = true;
      if (++k >= n) break;
    }
  }
  function frame(dt, t) {
    if (!alive || !model) return;
    if (!dragging) {
      if (Math.abs(rotVel) > 0.02) { rot += rotVel * dt; rotVel *= Math.pow(0.04, dt); }
      else rot += dt * 0.45;
    }
    turntable.rotation.y = rot;
    if (hopT < 1) {
      hopT = Math.min(1, hopT + dt * 2.4);
      const sq = Math.sin(hopT * Math.PI * 2) * 0.06 * (1 - hopT);
      model.position.y = Math.sin(hopT * Math.PI) * 0.16;
      model.scale.set(1 + sq, 1 - sq, 1 + sq);
    } else { model.position.y = 0; model.scale.set(1, 1, 1); }
    model.userData.update(dt, false);
    plat.userData.update(dt);
    for (const s of sparkles) {
      if (s.life <= 0) continue;
      s.life -= dt;
      s.m.position.addScaledVector(s.v, dt);
      s.v.y -= dt * 1.2;
      const k = s.life / s.max;
      s.m.scale.setScalar(0.05 * (0.4 + Math.sin(k * Math.PI)));
      s.m.rotation.set(0.8, t * 2, 0.6);
      s.m.material.opacity = Math.min(1, Math.sin(k * Math.PI) * 1.4);
      if (s.life <= 0) s.m.visible = false;
    }
    // cámara: el personaje entero (con orejas/sombreros) entra en el escenario, debajo del título
    const w = r.canvas.clientWidth || 1, h = r.canvas.clientHeight || 1;
    const tEl = root?.querySelector('.ob-title');
    const tFrac = tEl ? Math.min(0.5, (tEl.offsetTop + tEl.offsetHeight + 4) / h) : 0.2;
    const TOP = 1.62, BOTTOM = -0.3; // copa del sombrero más alto / borde de la tarima en perspectiva
    let half = (TOP - BOTTOM) / (2 * (1 - tFrac));
    half = Math.max(half, 0.82 / (w / h), h < 500 ? 1.1 : 1.32); // la tarima entra a lo ancho; nunca demasiado cerca
    const dist = half / Math.tan(THREE.MathUtils.degToRad(15)); // fov 30
    const ly = BOTTOM + half;
    r.camera.position.set(0, ly + 0.45 * (dist / 4), dist);
    r.camera.lookAt(0, ly, 0);
  }
  function bindStage(el) {
    let lastX = 0, lastT = 0, id = null;
    el.addEventListener('pointerdown', (e) => { id = e.pointerId; lastX = e.clientX; lastT = performance.now(); dragging = true; rotVel = 0; el.setPointerCapture?.(id); });
    el.addEventListener('pointermove', (e) => {
      if (e.pointerId !== id) return;
      const dx = e.clientX - lastX, now = performance.now();
      rot += dx * 0.012; rotVel = dx * 0.012 / Math.max(0.008, (now - lastT) / 1000);
      lastX = e.clientX; lastT = now;
    });
    const up = (e) => {
      if (e.pointerId !== id) return;
      id = null; dragging = false;
      if (performance.now() - lastT > 90) rotVel = 0;
      rotVel = Math.max(-8, Math.min(8, rotVel));
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  }

  // ---------- UI ----------
  function setTitle(big, small) {
    const el = root.querySelector('.ob-title');
    el.innerHTML = `<b>${big}</b>${small ? `<small>${small}</small>` : ''}`;
  }
  function renderDots() {
    // 3 puntos: personaje, nombres y (ya en la ciudad) el estilo de la ciudad
    root.querySelector('.ob-dots').innerHTML = [0, 1, 2].map(i => `<i class="${i === step ? 'on' : ''}"></i>`).join('');
  }
  function swatches(list, cur, key) {
    return `<div class="ob-sw" data-key="${key}">${list.map(c => `<button class="${String(c.id) === String(cur) ? 'on' : ''}" data-id="${c.id}" style="background:${c.hex}" aria-label="${c.name}"></button>`).join('')}</div>`;
  }
  function renderStep() {
    const body = root.querySelector('.ob-body');
    const foot = root.querySelector('.ob-foot');
    const t = avatarType(look.type);
    renderDots();
    if (step === 0) {
      setTitle('Te damos la bienvenida', 'Elegí tu personaje. Lo cambiás gratis en el Vestidor.');
      let html = `<div class="ob-step"><h2 class="ob-h">${icon('sparkle', 20)} ¿Quién vas a ser?</h2>`;
      for (const fam of AVATAR_FAMILIES) {
        html += `<div class="ob-fam">${icon(fam.emoji, 18)}${ui.esc(fam.name)}</div><div class="ob-types">`;
        for (const ty of AVATAR_TYPES.filter(x => x.family === fam.id)) {
          const spec = { type: 'avatar', look: normalizeLook({ ...ty.look, type: ty.id }), frame: ty.id === 'conejito' ? 'tallbody' : 'body' };
          const ok = hasThumb(spec);
          html += `<button class="ob-type${ty.id === look.type ? ' on' : ''}" data-type="${ty.id}"><img class="th${ok ? ' ok' : ''}" alt="" draggable="false" ${ok ? `src="${thumbnail(spec)}"` : ''} data-k="${encodeURIComponent(JSON.stringify(spec))}">${ui.esc(ty.name)}</button>`;
        }
        html += '</div>';
      }
      html += `<div class="ob-row">${t.animal ? 'Color de pelaje' : 'Color de pelo'}</div>${swatches(HAIR_COLORS.map(c => ({ ...c, name: COLOR_NAMES[c.id] || c.id })), look.hairColor, 'hairColor')}`;
      if (!t.animal) html += `<div class="ob-row">Piel</div>${swatches(SKIN_TONES.map((hex, i) => ({ id: i, hex, name: `Tono ${i + 1}` })), look.skin, 'skin')}`;
      html += `<div class="ob-row">Color de ropa</div>${swatches(OUTFIT_COLORS.map(c => ({ ...c, name: COLOR_NAMES[c.id] || c.id })), look.dressColor, 'dressColor')}`;
      html += '</div>';
      body.innerHTML = html;
      foot.innerHTML = `<button class="btn primary ob-next">Siguiente ${icon('play', 18)}</button>`;
      queueThumbs();
    } else {
      setTitle(`¡Hola, ${ui.esc(name || suggestedName())}!`, 'Ponele nombre a tu personaje y a tu ciudad.');
      body.innerHTML = `<div class="ob-step">
        <h2 class="ob-h">${icon(t.emoji, 22)} Tu nombre</h2>
        <div class="ob-field"><input class="ob-input" data-f="name" type="text" maxlength="16" autocomplete="off" spellcheck="false" placeholder="${ui.esc(suggestedName())}" aria-label="Nombre de tu personaje">
          <button class="icon-btn ob-dice" data-dice="name" aria-label="Nombre al azar">${icon('🎲', 24)}</button></div>
        <h2 class="ob-h">${icon('🏡', 22)} Tu ciudad</h2>
        <div class="ob-field"><input class="ob-input" data-f="city" type="text" maxlength="16" autocomplete="off" spellcheck="false" placeholder="${ui.esc(sugg.city)}" aria-label="Nombre de tu ciudad">
          <button class="icon-btn ob-dice" data-dice="city" aria-label="Ciudad al azar">${icon('🎲', 24)}</button></div>
        <p class="ob-hint">Los podés cambiar cuando quieras en Ajustes.</p>
      </div>`;
      const ni = body.querySelector('[data-f=name]'), ci = body.querySelector('[data-f=city]');
      ni.value = name; ci.value = city;
      foot.innerHTML = `<button class="btn ghost ob-back" aria-label="Volver">${icon('back', 20)}</button><button class="btn primary ob-next">${icon('sparkle', 20)}Empezar</button>`;
    }
    body.scrollTop = 0;
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
      try { img.src = thumbnail(JSON.parse(decodeURIComponent(img.dataset.k))); img.classList.add('ok'); } catch (e) { console.warn('miniatura', e); }
    }
    if (thumbQueue.length) thumbRaf = requestAnimationFrame(processThumbs);
  }

  function chooseType(id) {
    if (id === look.type) { hopT = 0; audio.sfx('pop'); return; }
    const t = avatarType(id);
    // al cambiar de tipo se usa su look inicial (igual que la tarjeta), salvo los colores que el jugador ya tocó
    const animalSwitch = !!t.animal !== !!avatarType(look.type).animal;
    if (animalSwitch) touched.delete('hairColor'); // pelo ≠ pelaje
    const keep = Object.fromEntries([...touched].map(k => [k, look[k]]));
    Object.assign(look, normalizeLook({ ...t.look, type: id, ...keep }));
    audio.sfx('combo', 2);
    rebuild();
    const body = root.querySelector('.ob-body'), y = body.scrollTop;
    renderStep();
    body.scrollTop = y; // no saltar arriba si eligió un animal al fondo de la lista
  }

  function onClick(e) {
    const ty = e.target.closest('[data-type]');
    if (ty) { chooseType(ty.dataset.type); return; }
    const sw = e.target.closest('.ob-sw button');
    if (sw) {
      const key = sw.parentElement.dataset.key;
      look[key] = key === 'skin' ? Number(sw.dataset.id) : sw.dataset.id;
      touched.add(key);
      audio.sfx('select');
      rebuild();
      for (const b of sw.parentElement.children) b.classList.toggle('on', b === sw);
      return;
    }
    const dice = e.target.closest('[data-dice]');
    if (dice) {
      const input = root.querySelector(`[data-f=${dice.dataset.dice}]`);
      const list = dice.dataset.dice === 'name' ? NAMES[nameKind(avatarType(look.type))] : CITY_NAMES;
      input.value = pickOther(list, input.value);
      readInputs();
      audio.sfx('pop');
      if (dice.dataset.dice === 'name') setTitle(`¡Hola, ${ui.esc(name)}!`, 'Ponele nombre a tu personaje y a tu ciudad.');
      return;
    }
    if (e.target.closest('.ob-back')) { audio.sfx('close'); readInputs(); step = 0; renderStep(); return; }
    if (e.target.closest('.ob-next')) next();
  }
  function readInputs() {
    const ni = root.querySelector('[data-f=name]'), ci = root.querySelector('[data-f=city]');
    if (ni) name = clean(ni.value);
    if (ci) city = clean(ci.value);
  }
  function next() {
    if (step === 0) {
      audio.sfx('swoosh');
      step = 1;
      renderStep();
      setTimeout(() => { if (alive && innerWidth >= 700) root?.querySelector('[data-f=name]')?.focus(); }, 350);
      return;
    }
    readInputs();
    finish();
  }

  async function finish() {
    if (finishing) return;
    finishing = true;
    const t = avatarType(look.type);
    const s = S();
    s.player.name = name || suggestedName();
    s.player.cityName = city || sugg.city;
    // directo al estado (sin customize:changed: elegir el primer personaje no cuenta como misión de vestidor)
    s.avatar = { ...look };
    s.onboarded = true;
    store.markDirty();
    store.save();
    audio.sfx('win');
    hopT = -0.15; burst(24);
    ctx.hud?.refresh?.();
    await new Promise(res => setTimeout(res, 700));
    await ctx.router.go('city');
    // estilo de la ciudad (lo agrega otra parte del juego; si todavía no existe, se sigue sin él)
    try {
      const m = await themesMod;
      // el saludo va dentro del selector (un toast tapaba el HUD y el título del selector o del premio diario)
      const greet = `¡${s.player.cityName} te da la bienvenida, ${s.player.name}!`;
      if (m && typeof m.openThemePicker === 'function') await m.openThemePicker(ctx, { first: true, greet });
      else ui.toast(greet, { icon: t.emoji, type: 'good' });
    } catch (e) { console.warn('[onboarding] selector de estilo', e); }
  }

  function onKey(e) {
    if (e.key !== 'Enter' || finishing) return;
    if (e.target.closest?.('input')) e.target.blur();
    e.preventDefault();
    next();
  }

  return {
    hud: false,
    music: 'calm',
    async mount(container) {
      alive = true;
      styleEl = document.createElement('style');
      styleEl.id = 'onboarding-style';
      styleEl.textContent = OB_CSS;
      document.head.append(styleEl);
      themesMod = import('../city/themes-ui.js').catch(() => null);
      root = ui.h('div.ob');
      root.innerHTML = `<div class="ob-stage"><div class="ob-title"></div></div>
        <div class="ob-panel"><div class="ob-dots"></div><div class="ob-body scroll"></div><div class="ob-foot"></div></div>`;
      container.append(root);
      root.addEventListener('click', onClick);
      root.addEventListener('input', (e) => { if (e.target.dataset.f === 'name') { name = clean(e.target.value); setTitle(`¡Hola, ${ui.esc(name || suggestedName())}!`, 'Ponele nombre a tu personaje y a tu ciudad.'); } });
      addEventListener('keydown', onKey);
      offs.push(() => removeEventListener('keydown', onKey));
      const stage = root.querySelector('.ob-stage');
      buildStage(stage);
      bindStage(stage);
      renderStep();
    },
    unmount() {
      alive = false;
      for (const off of offs.splice(0)) { try { off(); } catch {} }
      cancelAnimationFrame(thumbRaf); thumbRaf = 0; thumbQueue = [];
      if (r) { r.dispose(); r = null; }
      disposeThumbs();
      model = null;
      styleEl?.remove(); styleEl = null;
      root?.remove(); root = null;
    },
  };
}
