// Animación de apertura de cofre: overlay de pantalla completa con el cofre 3D, toques para abrir,
// explosión de luz del color de la mejor rareza, cartas de premio una por una y resumen final.
// playChestOpening(ctx, type, drops) -> Promise (resuelve al tocar "¡Genial!")
import * as THREE from 'three';
import { createPixelRenderer, addLights } from '../core/voxel.js';
import { icon } from '../core/icons.js';
import { audio } from '../core/audio.js';
import { h, esc, reducedMotion } from '../core/ui.js';
import { CHESTS, RARITIES } from './chests.js';
import { chestModel } from './chest-model.js';
import { injectStyle, rarityVars, chestVars, bestRarity, dropAmountHtml, dropNote, dropKindLabel, mix } from './chests-ui-common.js';
import { renderStickerCard, stickerDef } from '../album/album.js';
import { packIcon } from '../season/season-ui-common.js';

/** Ícono de un premio (las figuritas usan el sobrecito pixel). */
const dropIcon = (d, size) => d.kind === 'stickers' ? packIcon(size) : icon(d.icon || 'gift', size);
/** Abanico de figuritas (cartas del álbum) para la carta "Figuritas". */
function stickerFan(d) {
  const fan = h('div.chx-stkfan');
  const list = d.stickers || [];
  const n = list.length;
  list.forEach((g, i) => {
    const card = renderStickerCard(stickerDef(g.id), { isNew: g.isNew, count: g.count, showCount: false });
    const mid = (n - 1) / 2;
    const w = h('span.chx-stkw', {}, card);
    w.style.setProperty('--rot', ((i - mid) * (n > 4 ? 7 : 9)).toFixed(1) + 'deg');
    w.style.setProperty('--dy', (Math.abs(i - mid) * (n > 4 ? 4 : 6)).toFixed(0) + 'px');
    w.style.setProperty('--i', String(i));
    fan.append(w);
  });
  if (n > 3) fan.classList.add('many');
  return fan;
}

const TAPS = 3;
const AUTO_OPEN_MS = 2500;
const easeOutBounce = (x) => {
  const n = 7.5625, d = 2.75;
  if (x < 1 / d) return n * x * x;
  if (x < 2 / d) return n * (x -= 1.5 / d) * x + 0.75;
  if (x < 2.5 / d) return n * (x -= 2.25 / d) * x + 0.9375;
  return n * (x -= 2.625 / d) * x + 0.984375;
};
const lerp = (a, b, t) => a + (b - a) * t;

export function playChestOpening(ctx, type, drops = []) {
  injectStyle();
  const sfx = (n, a) => (ctx?.audio || audio).sfx(n, a);
  return new Promise(resolve => {
    const def = CHESTS[type] || CHESTS.madera;
    const best = bestRarity(drops);
    const bestR = RARITIES[best];
    const timers = new Set();
    const later = (ms, fn) => { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); return id; };

    // ---------- DOM ----------
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur?.();
    const root = h('div.chx-open.enter', { style: rarityVars(best) + chestVars(type), role: 'dialog', 'aria-label': def.name });
    const shake = h('div.chx-shake');
    const stage = h('div.chx-stage');
    const flash = h('div.chx-flash');
    const head = h('div.chx-head', {},
      h('h2', {}, def.name),
      h('div.chx-sub', { html: `${icon('gift', 20)}<span>${drops.length} premios</span>` }));
    const pips = h('div.chx-pips', {}, ...Array.from({ length: TAPS }, () => h('i')));
    const hint = h('div.chx-hint', {}, h('span', {}, 'Hacé clic en el cofre'), pips);
    const got = h('div.chx-got');
    const deckNum = h('b', {}, String(drops.length));
    const deck = h('div.chx-deck', {}, h('div.chx-stack', {}, h('i'), h('i'), h('i')), h('div', {}, deckNum, h('small', {}, 'quedan')));
    const tapNext = h('div.chx-tapnext', {}, 'Hacé clic para seguir ›');
    const cardZone = h('div.chx-cardzone');
    const skipBtn = h('button.btn.ghost.small.chx-skip', { 'aria-label': 'Saltar al resumen', html: `Saltar ${icon('play', 16)}` });
    shake.append(h('div.chx-bg'), h('div.chx-stars'), h('div.chx-rays'), h('div.chx-halo'), stage, flash, head, got, cardZone, hint, deck, tapNext);
    root.append(shake, skipBtn);
    (document.getElementById('app') || document.body).append(root);

    // ---------- 3D ----------
    const R = createPixelRenderer(stage, { ortho: false, background: null, shadows: false, fov: 30, outline: true });
    const { scene, camera } = R;
    const lights = addLights(scene);
    lights.sun.castShadow = false;
    const holder = new THREE.Group();
    const chest = chestModel(type);
    chest.rotation.y = -0.38;
    holder.add(chest);
    scene.add(holder);
    const lid = chest.userData.lid;
    const chestMat = chest.userData.materials?.[0];
    const rc = new THREE.Color(bestR.color);

    // sombra en el piso
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.62, 20), new THREE.MeshBasicMaterial({ color: 0x191310, transparent: true, opacity: 0.45, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.scale.set(1.15, 0.85, 1); shadow.position.y = 0.002;
    scene.add(shadow);

    // luz de rareza (delante del cofre mientras está cerrado, adentro al abrirse)
    const glow = new THREE.PointLight(rc, 0, 4, 1.6);
    glow.position.set(0, 0.5, 0.9);
    scene.add(glow);

    // haz de luz
    const beamTex = (() => {
      const cv = document.createElement('canvas'); cv.width = 32; cv.height = 64;
      const g = cv.getContext('2d');
      const gh = g.createLinearGradient(0, 0, 32, 0);
      gh.addColorStop(0, 'rgba(255,255,255,0)'); gh.addColorStop(0.5, 'rgba(255,255,255,1)'); gh.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gh; g.fillRect(0, 0, 32, 64);
      g.globalCompositeOperation = 'destination-in';
      const gv = g.createLinearGradient(0, 0, 0, 64);
      gv.addColorStop(0, 'rgba(0,0,0,0)'); gv.addColorStop(1, 'rgba(0,0,0,1)');
      g.fillStyle = gv; g.fillRect(0, 0, 32, 64);
      const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
      return t;
    })();
    const beamMat = new THREE.MeshBasicMaterial({ map: beamTex, color: new THREE.Color(mix(bestR.color, '#ffffff', 0.35)), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const beamGeo = new THREE.PlaneGeometry(0.72, 3.4); beamGeo.translate(0, 1.7, 0);
    const beam = new THREE.Group();
    for (let i = 0; i < 3; i++) { const m = new THREE.Mesh(beamGeo, beamMat); m.rotation.y = i * Math.PI / 3; beam.add(m); }
    beam.position.y = 0.5; beam.scale.y = 0; beam.visible = false;
    holder.add(beam);

    // partículas (cubitos) — InstancedMesh sin alocaciones por frame
    const PN = 180;
    const pGeo = new THREE.BoxGeometry(0.07, 0.07, 0.07);
    const pMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const parts = new THREE.InstancedMesh(pGeo, pMat, PN);
    parts.frustumCulled = false;
    const P = { x: new Float32Array(PN), y: new Float32Array(PN), z: new Float32Array(PN), vx: new Float32Array(PN), vy: new Float32Array(PN), vz: new Float32Array(PN),
      life: new Float32Array(PN), max: new Float32Array(PN), size: new Float32Array(PN), grav: new Float32Array(PN) };
    const M4 = new THREE.Matrix4();
    const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
    const white = new THREE.Color(0xffffff);
    for (let i = 0; i < PN; i++) { parts.setMatrixAt(i, ZERO); parts.setColorAt(i, white); }
    scene.add(parts);
    let pNext = 0;
    const colorsFor = (rid) => {
      const r = RARITIES[rid] || bestR;
      return [new THREE.Color(r.color), new THREE.Color(r.color), new THREE.Color(r.dark), new THREE.Color(0xffffff), new THREE.Color(0xffd166)];
    };
    const bestCols = colorsFor(best);
    function spawn(n, cols, { y = 0.5, spread = 0.35, up = [1.6, 3.4], out = 1.6, life = [0.7, 1.3], size = [0.6, 1.2], grav = 5, z = 0 } = {}) {
      for (let k = 0; k < n; k++) {
        const i = pNext; pNext = (pNext + 1) % PN;
        const a = Math.random() * Math.PI * 2, r = Math.random();
        P.x[i] = holder.position.x + Math.cos(a) * spread * r;
        P.z[i] = holder.position.z + z + Math.sin(a) * spread * r * 0.6;
        P.y[i] = holder.position.y + y;
        const sp = out * (0.3 + Math.random() * 0.7);
        P.vx[i] = Math.cos(a) * sp; P.vz[i] = Math.sin(a) * sp * 0.7 + 0.4;
        P.vy[i] = lerp(up[0], up[1], Math.random());
        P.max[i] = P.life[i] = lerp(life[0], life[1], Math.random());
        P.size[i] = lerp(size[0], size[1], Math.random());
        P.grav[i] = grav;
        parts.setColorAt(i, cols[Math.floor(Math.random() * cols.length)]);
      }
      parts.instanceColor.needsUpdate = true;
    }
    function updateParts(dt) {
      for (let i = 0; i < PN; i++) {
        if (P.life[i] <= 0) continue;
        P.life[i] -= dt;
        if (P.life[i] <= 0) { parts.setMatrixAt(i, ZERO); continue; }
        P.vy[i] -= P.grav[i] * dt;
        P.x[i] += P.vx[i] * dt; P.y[i] += P.vy[i] * dt; P.z[i] += P.vz[i] * dt;
        const s = P.size[i] * Math.min(1, P.life[i] / P.max[i] * 1.6);
        M4.makeScale(s, s, s); M4.setPosition(P.x[i], P.y[i], P.z[i]);
        parts.setMatrixAt(i, M4);
      }
      parts.instanceMatrix.needsUpdate = true;
    }

    // ---------- Estado de la animación ----------
    let phase = 'enter', phaseT = 0, time = 0;
    let taps = 0, impulse = 0, squash = 0, squashV = 0, flashI = 0;
    let lidAng = 0, lidTarget = 0, lidV = 0;
    let zoom = 0, zoomTarget = 0;   // 0 = cofre centrado, 1 = cofre abajo (cartas)
    let hop = 0, hopV = 0;
    let landed = false, finished = false;
    let idleTimer = 0, autoTimer = 0;
    let lastCx = -1, lastCy = -1;
    const tmpV = new THREE.Vector3();
    const setPhase = (p) => {
      phase = p; phaseT = 0;
      root.classList.remove('enter', 'idle', 'opening', 'cards', 'summary');
      root.classList.add(p);
    };

    const offFrame = R.onFrame((dt, tSec) => {
      time += dt; phaseT += dt;
      // entrada rebotando
      if (phase === 'enter') {
        const p = Math.min(1, phaseT / 0.75);
        holder.position.y = (1 - easeOutBounce(p)) * 2.6;
        if (!landed && p > 0.36) { landed = true; sfx('bump'); squashV = -3.5; spawn(16, [white, new THREE.Color(0xddd5c8)], { y: 0.05, spread: 0.6, up: [0.6, 1.4], out: 1.4, life: [0.4, 0.7], size: [0.5, 0.9], grav: 3 }); }
        if (p >= 1) { holder.position.y = 0; setPhase('idle'); armAuto(); }
      }
      // resortes: aplastado, salto, tapa
      squashV += (-squash * 160 - squashV * 11) * dt; squash += squashV * dt;
      hopV -= 14 * dt; hop = Math.max(0, hop + hopV * dt); if (hop === 0 && hopV < 0) hopV = 0;
      lidV += ((lidTarget - lidAng) * 220 - lidV * 15) * dt; lidAng += lidV * dt;
      lid.rotation.x = -lidAng;
      impulse *= Math.exp(-dt * 7);
      flashI *= Math.exp(-dt * 3.2);
      zoom += (zoomTarget - zoom) * Math.min(1, dt * 4);

      // temblor (crece con los toques, antes de abrir)
      const tremble = (phase === 'idle' ? taps * 0.022 : 0) + impulse;
      chest.rotation.z = Math.sin(time * 41) * tremble;
      chest.rotation.x = Math.cos(time * 33) * tremble * 0.5;
      chest.rotation.y = -0.38 + Math.sin(time * 0.9) * 0.06;
      if (phase !== 'enter') holder.position.y = hop;
      const sq = Math.max(-0.3, Math.min(0.3, squash));
      chest.scale.set(1 + sq * 0.6, 1 - sq, 1 + sq * 0.6);
      if (phase === 'idle' && !taps) chest.scale.y *= 1 + Math.sin(time * 3.2) * 0.015;
      chest.userData.update?.(dt, tSec);

      // brillo
      const opened = lidTarget > 0;
      glow.position.set(0, opened ? 0.8 : 0.55, opened ? 0.2 : 1.25);
      glow.intensity = (opened ? 2.2 : taps * 0.55) + flashI * 9;
      if (chestMat) chestMat.emissive.copy(rc).multiplyScalar(Math.min(0.4, flashI * 0.3 + (phase === 'idle' ? taps * 0.025 : 0)));
      if (phase === 'idle' && taps && Math.random() < taps * 0.12) spawn(1, bestCols, { y: 0.52, spread: 0.45, up: [0.5, 1.2], out: 0.3, life: [0.5, 0.9], size: [0.4, 0.7], grav: -0.4, z: 0.3 });
      if (opened && Math.random() < 0.35) spawn(1, bestCols, { y: 0.6, spread: 0.3, up: [1.2, 2.2], out: 0.25, life: [0.8, 1.4], size: [0.4, 0.8], grav: -0.2 });
      if (beam.visible) {
        beam.scale.y += (1 - beam.scale.y) * Math.min(1, dt * 5);
        beamMat.opacity = 0.38 + Math.sin(time * 9) * 0.06 + flashI * 0.3;
        beam.rotation.y += dt * 0.7;
      }
      updateParts(dt);

      // cámara: encuadra según el aspecto (celu vertical o PC apaisada)
      const k = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
      const vh = Math.max(lerp(3.0, 4.4, zoom), lerp(2.25, 3.3, zoom) / camera.aspect);
      const dist = vh / k;
      const lookY = 0.42 + vh * lerp(0.03, 0.36, zoom);
      camera.position.set(0, lookY + Math.sin(0.42) * dist, Math.cos(0.42) * dist);
      camera.lookAt(0, lookY, 0);

      // centro del cofre en pantalla -> variables CSS (rayos, halo, flash)
      tmpV.set(0, holder.position.y + 0.45, 0);
      const sp = R.toScreen(tmpV); // el overlay cubre #app entero (origen 0,0)
      const cx = Math.round(sp.x), cy = Math.round(sp.y);
      if (cx !== lastCx || cy !== lastCy) { lastCx = cx; lastCy = cy; root.style.setProperty('--cx', cx + 'px'); root.style.setProperty('--cy', cy + 'px'); }
    });
    R.start();
    sfx('swoosh');

    // ---------- Toques en el cofre ----------
    function armAuto() {
      clearTimeout(idleTimer); timers.delete(idleTimer);
      idleTimer = later(AUTO_OPEN_MS, () => autoTap());
    }
    function autoTap() {
      if (phase !== 'idle') return;
      tapChest();
      if (phase === 'idle') autoTimer = later(420, autoTap);
    }
    function tapChest() {
      if (phase !== 'idle') return;
      taps++;
      pips.children[taps - 1]?.classList.add('on');
      root.style.setProperty('--glow', String(taps / TAPS));
      impulse = 0.12 + taps * 0.05;
      squashV = -4 - taps * 1.5;
      hopV = 1.6 + taps * 0.5;
      sfx('combo', taps * 2);
      spawn(6 + taps * 4, bestCols, { y: 0.55, spread: 0.5, up: [0.8, 1.8], out: 1.0, life: [0.4, 0.8], size: [0.4, 0.8], grav: 2, z: 0.3 });
      if (taps >= TAPS) openLid();
      else armAuto();
    }
    function openLid(instant = false) {
      clearTimeout(idleTimer); clearTimeout(autoTimer);
      setPhase('opening');
      lidTarget = 1.95;
      if (instant) { lidAng = lidTarget; lidV = 0; } else lidV = 18;
      beam.visible = true; if (instant) beam.scale.y = 1;
      root.classList.add('lit');
      if (instant) return;
      squashV = 6; hopV = 2.6; flashI = 1;
      flash.classList.remove('go'); void flash.offsetWidth; flash.classList.add('go');
      spawn(90, bestCols, { y: 0.55, spread: 0.4, up: [2.2, 4.2], out: 2.0, life: [0.9, 1.6], size: [0.6, 1.3], grav: 5.5 });
      sfx('swoosh'); sfx('star');
      if (best === 'legendaria') { later(160, () => sfx('win')); shakeScreen(); }
      else if (best === 'epica') later(160, () => sfx('gem'));
      later(1000, () => { if (phase === 'opening') { zoomTarget = 1; setPhase('cards'); nextCard(); } });
    }

    // ---------- Cartas ----------
    let idx = -1, cardEl = null, revealed = false, revealAt = 0, revealTimer = 0;
    function cardFor(d) {
      const r = RARITIES[d.rarity] || RARITIES.comun;
      const sparkles = r.order >= 2 ? [[12, 18], [82, 10], [88, 62], [8, 70]].map(([x, y], i) =>
        `<i class="chx-sparkle" style="left:${x}%;top:${y}%;animation-delay:${i * 0.2}s"></i>`).join('') : '';
      const el = h('div.chx-card.r' + r.order, { style: rarityVars(d.rarity), html: `
        <div class="chx-cardglow"></div>
        <div class="chx-flipper">
          <div class="chx-face chx-back">${icon('medal', 84)}<b>?</b></div>
          <div class="chx-face chx-front">
            <div class="chx-banner">${esc(d.kind === 'stickers' ? 'Hallazgos' : r.name)}</div>
            <div class="chx-icwrap">${d.kind === 'stickers' ? '' : icon(d.icon || 'gift', 96)}</div>
            <div class="chx-klabel">${esc(dropKindLabel(d))}</div>
            <div class="chx-cname">${esc(d.name)}</div>
            <div class="chx-amt">${d.kind === 'stickers' ? '' : dropAmountHtml(d, 36)}</div>
            <div class="chx-note">${esc(dropNote(d))}</div>
            ${sparkles}
          </div>
        </div>` });
      if (d.kind === 'stickers') {
        el.classList.add('chx-stickers');
        el.querySelector('.chx-icwrap').append(stickerFan(d));
      }
      return el;
    }
    function nextCard() {
      if (cardEl) {
        const old = cardEl, d = drops[idx];
        // la carta vuela a la fila de "conseguidos"
        const slot = h('span', { style: rarityVars(d.rarity), html: dropIcon(d, 26) });
        got.append(slot);
        const a = old.getBoundingClientRect(), b = slot.getBoundingClientRect();
        old.style.setProperty('--tox', Math.round(b.left + b.width / 2 - (a.left + a.width / 2)) + 'px');
        old.style.setProperty('--toy', Math.round(b.top + b.height / 2 - (a.top + a.height / 2)) + 'px');
        old.classList.add('out');
        later(320, () => old.remove());
      }
      idx++;
      root.classList.remove('revealed');
      if (idx >= drops.length) { cardEl = null; showSummary(); return; }
      const d = drops[idx], r = RARITIES[d.rarity] || RARITIES.comun;
      deckNum.textContent = String(drops.length - idx - 1);
      cardEl = cardFor(d);
      // sale desde el cofre
      const zr = cardZone.getBoundingClientRect();
      const fromY = (lastCy > 0 ? lastCy : innerHeight * 0.8) - (zr.top + zr.height / 2);
      cardEl.style.setProperty('--from', Math.round(fromY) + 'px');
      cardZone.append(cardEl);
      revealed = false;
      sfx('swoosh');
      hopV = 2; squashV = 3;
      spawn(14, colorsFor(d.rarity), { y: 0.6, spread: 0.3, up: [2, 3.5], out: 0.9, life: [0.6, 1.0], size: [0.5, 1], grav: 5 });
      const suspense = r.order >= 3 ? 1150 : r.order === 2 ? 700 : 430;
      if (r.order >= 2) { cardEl.classList.add('suspense'); later(380, () => sfx('combo', r.order * 3)); }
      revealTimer = later(suspense, reveal);
    }
    function reveal() {
      if (revealed || !cardEl) return;
      revealed = true; revealAt = performance.now();
      clearTimeout(revealTimer);
      cardEl.classList.add('flip');
      root.classList.add('revealed');
      tapNext.textContent = idx >= drops.length - 1 ? 'Hacé clic para ver todo ›' : 'Hacé clic para seguir ›';
      const d = drops[idx], r = RARITIES[d.rarity] || RARITIES.comun;
      if (d.kind === 'coins') sfx('coin'); else if (d.kind === 'gems') sfx('gem'); else if (d.kind === 'xp') sfx('star');
      else if (d.kind === 'stickers') { sfx('swoosh'); later(120, () => sfx('pop')); } else sfx('pop');
      if (r.order === 2) later(90, () => sfx('star'));
      if (r.order >= 3) {
        later(60, () => sfx('levelup'));
        shakeScreen();
        flashI = 1; flash.classList.remove('go'); void flash.offsetWidth; flash.classList.add('go');
      }
    }

    // ---------- Resumen ----------
    let sumEl = null;
    function showSummary() {
      clearTimeout(idleTimer); clearTimeout(autoTimer); clearTimeout(revealTimer);
      if (lidTarget === 0) openLid(true);
      for (const c of cardZone.querySelectorAll('.chx-card')) c.remove();
      cardEl = null;
      zoomTarget = 1;
      setPhase('summary');
      root.classList.add('lit');
      const grid = h('div.chx-sumgrid');
      drops.forEach((d, i) => {
        const r = RARITIES[d.rarity] || RARITIES.comun;
        grid.append(h('div.chx-mini', { style: rarityVars(d.rarity) + `animation-delay:${0.08 + i * 0.07}s`, html:
          `<small>${esc(d.kind === 'stickers' ? 'Hallazgos' : r.name)}</small>${dropIcon(d, 48)}<b>${esc(d.name)}</b><em>${d.kind === 'stickers' ? (d.fresh ? `¡${d.fresh} nuevo${d.fresh > 1 ? 's' : ''}!` : 'Repetidos') : dropAmountHtml(d, 18)}</em>` }));
      });
      const okBtn = h('button.btn.primary.block', { html: `${icon('check', 22)} Listo` });
      okBtn.addEventListener('pointerdown', e => e.stopPropagation());
      okBtn.addEventListener('click', e => { e.stopPropagation(); finish(); });
      const hasBuild = drops.some(d => d.kind === 'build'), hasItem = drops.some(d => d.kind === 'item');
      const hasStk = drops.some(d => d.kind === 'stickers' && d.fresh);
      const tip = hasBuild ? 'Las construcciones gratis se colocan desde Construir.' : hasItem ? 'Los objetos quedaron en tu mochila.'
        : hasStk ? 'Los hallazgos nuevos ya están en Hallazgos.' : '';
      sumEl = h('div.chx-sum', {},
        h('div.chx-sumbox', {},
          h('div.chx-sumhead', { html: `${icon('medal', 32)}<h2>Lo que había adentro</h2>${icon('medal', 32)}` }),
          grid,
          h('div.chx-sumfoot', {}, tip ? h('p', {}, tip) : null, okBtn)));
      sumEl.addEventListener('pointerdown', e => e.stopPropagation());
      shake.append(sumEl);
      sfx('win');
      later(250, () => okBtn.focus({ preventScroll: true }));
    }

    // ---------- Efectos de pantalla ----------
    function shakeScreen() {
      if (reducedMotion()) return;   // Ajustes → Reducir movimiento (o el sistema)
      root.classList.remove('quake'); void root.offsetWidth; root.classList.add('quake');
      later(600, () => root.classList.remove('quake'));
      try { navigator.vibrate?.([70, 40, 110]); } catch {}
    }
    // (sin confeti: abrir un cofre es cotidiano; el confeti queda para rango, monumentos y logros grandes)

    // ---------- Entrada (toque / teclado) ----------
    function advance() {
      if (finished) return;
      if (phase === 'enter') return;
      if (phase === 'idle') { tapChest(); return; }
      if (phase === 'opening') { if (phaseT > 0.4) { zoomTarget = 1; setPhase('cards'); nextCard(); } return; }
      if (phase === 'cards') {
        if (!revealed) { reveal(); return; }
        if (performance.now() - revealAt < 260) return; // evita saltear la carta por un doble toque
        sfx('tap');
        nextCard();
      }
    }
    function skip() {
      if (finished) return;
      if (phase === 'summary') { finish(); return; }
      sfx('tap');
      showSummary();
    }
    const onPointer = (e) => { if (e.button > 0) return; e.preventDefault(); advance(); };
    root.addEventListener('pointerdown', onPointer);
    skipBtn.addEventListener('pointerdown', e => e.stopPropagation());
    skipBtn.addEventListener('click', e => { e.stopPropagation(); skip(); });
    const onKey = (e) => {
      if (finished) return;
      const k = e.key;
      if (k === ' ' || k === 'Enter' || k === 'Escape' || k === 'Spacebar') {
        e.preventDefault(); e.stopImmediatePropagation();
        if (e.repeat) return;
        if (k === 'Escape') skip();
        else if (phase === 'summary') finish();
        else advance();
      }
    };
    addEventListener('keydown', onKey, true);

    // ---------- Fin ----------
    function finish() {
      if (finished) return;
      finished = true;
      sfx('tap');
      for (const id of timers) clearTimeout(id);
      timers.clear();
      removeEventListener('keydown', onKey, true);
      root.removeEventListener('pointerdown', onPointer);
      root.classList.add('closing');
      setTimeout(() => {
        offFrame();
        parts.dispose();
        R.dispose(); // libera escena (cofre, haz, partículas, sombra), renderer y contexto WebGL
        root.remove();
        // monedas/gemas que vuelan al HUD
        const tot = { coins: 0, gems: 0, xp: 0 };
        for (const d of drops) if (d.kind in tot) tot[d.kind] += d.amount;
        const ui = ctx?.ui;
        if (ui?.flyCurrency) {
          const x = innerWidth / 2, y = innerHeight / 2;
          if (tot.coins) ui.flyCurrency(x, y, 'coins', 4 + Math.min(6, tot.coins / 150));
          if (tot.gems) setTimeout(() => ui.flyCurrency(x, y, 'gems', 3 + Math.min(6, tot.gems / 4)), 120);
        }
        resolve();
      }, 320);
    }
  });
}
