// Estacionamiento Real — minijuego 3D: estacioná tu auto en el lugar que brilla sin chocar.
// Escena 'parking'. Controles: botones táctiles (multi-touch) o teclado (flechas/WASD, espacio, Esc).
import { createPixelRenderer, addLights } from '../core/voxel.js';
import { icon } from '../core/icons.js';
import { CAR_BODIES } from '../core/data.js';
import * as carLib from '../avatar/car.js';
import { LEVELS, LEVEL_COUNT } from './parking-levels.js';
import { buildWorld } from './parking-world.js';
import { PARKING_CSS } from './parking-style.js';
import { boosterRow, consumeSelected, eventChipHtml, boosterIcon } from './boosters.js';
import {
  makeCar, placeCar, stepCar, makeBox, setBox, collideBoxes, circleVsBox, spotCheck,
  CAR_HW, CAR_HL, CONE_R, DEG, clamp,
} from './parking-physics.js';

const MAX_TOUCHES = 5;
const BOOST_ID = 'park_time';  // Reloj Extra (mochila de cofres): +30 s y 2 toques gratis
const BOOST_TIME = 30, BOOST_FREE = 2;
const HOLD_TIME = 1.0;     // segundos quieta adentro para ganar
const FOV = 34;
const PITCH = 58 * DEG;

const ARROW_SVG = (dir) => {
  // flecha pixelada (10x10) apuntando a la izquierda o derecha
  const rows = ['....##....', '...###....', '..####....', '.#########', '##########', '##########', '.#########', '..####....', '...###....', '....##....'];
  let rects = '';
  rows.forEach((r, y) => [...r].forEach((c, x) => { if (c === '#') rects += `<rect x="${dir < 0 ? x : 9 - x}" y="${y}" width="1.02" height="1.02"/>`; }));
  return `<svg viewBox="0 0 10 10" width="40" height="40" shape-rendering="crispEdges" fill="currentColor" aria-hidden="true">${rects}</svg>`;
};
const PEDAL_SVG = (up) => {
  const rows = ['....##....', '...####...', '..######..', '.########.', '##########', '...####...', '...####...', '...####...'];
  let rects = '';
  rows.forEach((r, y) => [...r].forEach((c, x) => { if (c === '#') rects += `<rect x="${x}" y="${up ? y : 7 - y}" width="1.02" height="1.02"/>`; }));
  return `<svg viewBox="0 0 10 8" width="36" height="29" shape-rendering="crispEdges" fill="currentColor" aria-hidden="true">${rects}</svg>`;
};

const fmtTime = (s) => { s = Math.max(0, Math.ceil(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

export default function create(ctx) {
  const { store, audio, ui } = ctx;
  let root = null, r = null, world = null, styleEl = null;
  let dead = false;
  const cleanups = [];
  const listen = (target, ev, fn, opts) => { target.addEventListener(ev, fn, opts); cleanups.push(() => target.removeEventListener(ev, fn, opts)); };

  // ---- estado del juego ----
  let lvNum = 1, level = null;
  let phase = 'intro';          // intro | play | paused | won | lost
  let elapsed = 0, touches = 0, hold = 0, lastShownSec = -1;
  let shake = 0, puffT = 0, hitFlash = 0, globalCool = 0;
  // potenciador: elegido en la tarjeta / activo en el intento / nivel ya pagado (Reiniciar lo conserva)
  const boostSel = new Set();
  let timeBonus = 0, freeTouches = 0, paidLevel = 0;
  const status = { inside: false, aligned: false, fill: 0, angleOff: 0, hold: 0, done: false };
  const keys = { gas: false, rev: false, left: false, right: false, brake: false };
  const touch = { gas: new Set(), rev: new Set(), left: new Set(), right: new Set() };
  const input = { gas: false, rev: false, brake: false, steer: 0 };

  const carData = () => ctx.state.car;
  const stats = (() => {
    const c = ctx.state.car;
    if (typeof carLib.carStats === 'function') { try { return carLib.carStats(c); } catch (e) { console.warn(e); } }
    const b = CAR_BODIES.find(x => x.id === c.body) || CAR_BODIES[0];
    return { speed: b.speed, handling: b.handling };
  })();
  const car = makeCar(stats);
  const carBox = makeBox(0, 0, CAR_HW, CAR_HL, 0);
  const colOut = { nx: 0, nz: 0 };

  // camara
  const cam = { x: 0, z: 0, d: 14, init: false };
  let viewKey = '';

  // DOM refs
  const $ = {};

  function save() { store.markDirty(); }
  function pstate() {
    const g = ctx.state.games;
    if (!g.parking) g.parking = { level: 1, stars: {} };
    if (!g.parking.stars) g.parking.stars = {};
    if (!g.parking.level) g.parking.level = 1;
    return g.parking;
  }
  const unlocked = () => clamp(pstate().level, 1, LEVEL_COUNT);
  const bestStars = (n) => pstate().stars[n] || 0;

  // ---------- UI ----------
  function buildUI(container) {
    root = document.createElement('div');
    root.className = 'pk-ui';
    root.innerHTML = `
      <div class="game-bar">
        <button class="icon-btn pk-back" aria-label="Volver a la ciudad">${icon('back', 22)}</button>
        <div class="game-title pk-title">Nivel 1</div>
        <div class="spacer"></div>
        <div class="game-stat pk-time"><small>Tiempo</small><b>0:00</b></div>
        <div class="game-stat pk-hits"><small>Toques</small><b>0/${MAX_TOUCHES}</b><i class="pk-freeb" hidden></i></div>
        <button class="icon-btn pk-pause" aria-label="Pausa">${icon('pause', 22)}</button>
      </div>
      <div class="pk-goal"></div>
      <div class="pk-hint"><span></span><div class="progress"><i></i></div></div>
      <div class="pk-controls">
        <div class="pk-steer">
          <button class="pk-btn pk-left" data-k="left" aria-label="Doblar a la izquierda">${ARROW_SVG(-1)}</button>
          <button class="pk-btn pk-right" data-k="right" aria-label="Doblar a la derecha">${ARROW_SVG(1)}</button>
        </div>
        <div class="pk-pedals">
          <button class="pk-btn pk-rev" data-k="rev" aria-label="Reversa">${PEDAL_SVG(false)}<span>Reversa</span></button>
          <button class="pk-btn pk-gas" data-k="gas" aria-label="Acelerar">${PEDAL_SVG(true)}<span>Acelerar</span></button>
        </div>
      </div>
      <div class="game-help pk-keys"><b>↑ W</b> acelerar · <b>↓ S</b> reversa · <b>← → A D</b> doblar · <b>Espacio</b> frenar · <b>Esc</b> pausa</div>
      <div class="pk-pointer" aria-hidden="true"><i></i><b>P</b></div>
      <div class="pk-intro"></div>
    `;
    container.append(root);
    for (const k of ['title', 'goal', 'hint', 'intro']) $[k] = root.querySelector('.pk-' + k);
    $.time = root.querySelector('.pk-time');
    $.hits = root.querySelector('.pk-hits');
    $.hintText = $.hint.querySelector('span');
    $.hintBar = $.hint.querySelector('.progress i');
    $.controls = root.querySelector('.pk-controls');
    $.pointer = root.querySelector('.pk-pointer');
    $.pointerArrow = $.pointer.querySelector('i');

    root.querySelector('.pk-back').addEventListener('click', () => { audio.sfx('tap'); ctx.router.go('city'); });
    root.querySelector('.pk-pause').addEventListener('click', () => { audio.sfx('tap'); openPause(); });

    // botones mantenidos (multi-touch con pointer capture)
    for (const btn of root.querySelectorAll('.pk-btn')) {
      const k = btn.dataset.k;
      const set = touch[k];
      const on = (e) => {
        e.preventDefault();
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        try { btn.setPointerCapture(e.pointerId); } catch {}
        set.add(e.pointerId);
        btn.classList.add('on');
        if (phase === 'intro' && !ui.hasModal()) startPlay();
      };
      const off = (e) => {
        set.delete(e.pointerId);
        if (!set.size) btn.classList.remove('on');
      };
      btn.addEventListener('pointerdown', on);
      btn.addEventListener('pointerup', off);
      btn.addEventListener('pointercancel', off);
      btn.addEventListener('lostpointercapture', off);
      btn.addEventListener('contextmenu', e => e.preventDefault());
    }
  }
  // red de seguridad: si la captura falló (o el navegador no la soporta), un dedo que se suelta
  // fuera del botón igual llega acá y no deja el auto acelerando para siempre
  function releasePointer(e) {
    for (const k in touch) {
      if (touch[k].delete(e.pointerId) && !touch[k].size) root?.querySelector(`.pk-btn[data-k="${k}"]`)?.classList.remove('on');
    }
  }

  function setStat(el, text, warn) {
    const b = el.querySelector('b');
    if (b.textContent !== text) b.textContent = text;
    el.classList.toggle('pk-warn', !!warn);
  }
  function bump(el) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }

  function refreshBar() {
    $.title.textContent = `Nivel ${lvNum}`;
    setStat($.hits, `${touches}/${MAX_TOUCHES}`, touches >= 3);
    const fb = $.hits.querySelector('.pk-freeb');
    fb.hidden = freeTouches <= 0;
    if (freeTouches > 0) fb.innerHTML = `${boosterIcon(BOOST_ID, 14)}${freeTouches} gratis`;
    const left = level.limit + timeBonus - elapsed;
    setStat($.time, fmtTime(left), phase === 'play' && left <= 15);
  }

  function starRow(n, size = 28) {
    let s = '';
    for (let i = 0; i < 3; i++) s += icon(i < n ? 'star' : 'starOff', size);
    return s;
  }

  function showIntro() {
    const best = bestStars(lvNum);
    $.goal.textContent = level.goal;
    $.goal.classList.remove('show');
    $.intro.innerHTML = `
      <div class="panel pk-card">
        <div class="pk-card-top"><span class="chip mint">${icon('car', 16)} Estacionamiento Real</span><span class="chip">${lvNum} / ${LEVEL_COUNT}</span></div>
        <h2>Nivel ${lvNum}</h2>
        <h3>${ui.esc(level.name)}</h3>
        <div class="pk-card-stars">${starRow(best, 30)}</div>
        <p class="pk-card-goal">${ui.esc(level.goal)}</p>
        <p class="pk-card-tip">${icon('sparkle', 18)}<span>${ui.esc(level.tip)}</span></p>
        <div class="pk-card-meta">
          <span>${icon('clock', 16)} ${fmtTime(level.limit)}</span>
          <span>${icon('star', 16)}${icon('star', 16)}${icon('star', 16)} sin toques y en menos de ${level.par} s</span>
        </div>
        ${eventChipHtml('parking', ui.esc) ? `<div class="pk-card-event">${eventChipHtml('parking', ui.esc)}</div>` : ''}
        <div class="pk-card-boost"></div>
        <div class="pk-card-btns">
          <button class="btn ghost pk-levels">${icon('map', 20)} Niveles</button>
          <button class="btn pink pk-play">${icon('play', 20)} ¡Jugar!</button>
        </div>
        <small class="pk-card-keys">Enter o ↑ para jugar</small>
      </div>`;
    $.intro.querySelector('.pk-card-boost').append(boosterRow([BOOST_ID], boostSel, { audio, title: 'Potenciador' }));
    $.intro.classList.add('show');
    $.intro.querySelector('.pk-play').addEventListener('click', () => { audio.sfx('select'); startPlay(); });
    $.intro.querySelector('.pk-levels').addEventListener('click', () => { audio.sfx('tap'); openLevels(); });
  }

  let goalTimer = 0;
  function hideIntro() {
    $.intro.classList.remove('show');
    $.goal.classList.add('show');
    goalTimer = 6; // el objetivo se ve unos segundos y después se esconde para no tapar el lugar
  }

  let levelsModal = null;
  function openLevels() {
    if (levelsModal) return;
    const wrap = document.createElement('div');
    wrap.className = 'pk-lvgrid';
    const max = unlocked();
    let m = null;
    for (let i = 1; i <= LEVEL_COUNT; i++) {
      const locked = i > max;
      const b = document.createElement('button');
      b.className = 'pk-lv' + (locked ? ' locked' : '') + (i === lvNum ? ' current' : '');
      b.innerHTML = locked
        ? `<b>${i}</b><span>${icon('lock', 18)}</span>`
        : `<b>${i}</b><span class="pk-lv-stars">${starRow(bestStars(i), 14)}</span>`;
      b.title = LEVELS[i - 1].name;
      b.addEventListener('click', () => {
        if (locked) { audio.sfx('error'); ui.toast('Completá el nivel anterior para desbloquearlo', { icon: 'lock' }); return; }
        audio.sfx('select');
        m?.close();
        loadLevel(i);
      });
      wrap.append(b);
    }
    const total = Object.values(pstate().stars).reduce((a, b) => a + b, 0);
    const head = document.createElement('p');
    head.className = 'center pk-lv-total';
    head.innerHTML = `${icon('star', 20)} <b>${total}</b> / ${LEVEL_COUNT * 3} estrellas`;
    const box = document.createElement('div');
    box.append(head, wrap);
    m = levelsModal = ui.modal({ title: 'Niveles', content: box, icon: 'car', className: 'pk-levels-modal', onClose: () => { levelsModal = null; } });
  }

  let pauseModal = null;
  function openPause() {
    if (phase !== 'play' && phase !== 'intro') return;
    if (pauseModal) return;
    const prev = phase;
    phase = 'paused';
    clearKeys();
    dropFocus();
    let action = 'resume';
    pauseModal = ui.modal({
      title: 'Pausa', icon: 'pause',
      content: `<p class="center"><b>Nivel ${lvNum}</b> · ${ui.esc(level.name)}</p><p class="center muted">${ui.esc(level.goal)}</p>`,
      actions: [
        { label: 'Salir', cls: 'ghost', onClick: () => { action = 'exit'; } },
        { label: 'Reiniciar', cls: 'lilac', onClick: () => { action = 'restart'; } },
        { label: 'Seguir', cls: 'pink', onClick: () => { action = 'resume'; } },
      ],
      onClose: () => {
        pauseModal = null;
        if (dead) return;
        if (action === 'exit') ctx.router.go('city');
        else if (action === 'restart') loadLevel(lvNum, true);
        else phase = prev;
      },
    });
  }

  // ---------- Niveles ----------
  function loadLevel(n, autoStart = false) {
    lvNum = clamp(n | 0, 1, LEVEL_COUNT);
    level = LEVELS[lvNum - 1];
    world?.dispose();
    world = buildWorld(r.scene, level, lvNum, { car: carData(), princess: ctx.state.princess });
    placeCar(car, level.start[0], level.start[1], level.start[2] * DEG);
    setBox(carBox, car.x, car.z, car.a);
    elapsed = 0; touches = 0; hold = 0; shake = 0; hitFlash = 0; globalCool = 0; lastShownSec = -1;
    status.inside = status.aligned = status.done = false; status.hold = 0; status.fill = 0;
    for (const o of world.statics) o.cool = 0;
    clearKeys();
    syncPlayer(0);
    cam.init = false;
    hintTimer = 0; hintSticky = '';
    timeBonus = 0; freeTouches = 0;
    // siempre volver a 'intro' antes de arrancar: si venía de 'paused' (Reiniciar), startPlay no hacía nada y el juego quedaba congelado
    phase = 'intro';
    refreshBar();
    showHint('');
    // Reiniciar (pausa / R) el mismo nivel conserva el Reloj Extra que ya se gastó en este nivel
    if (autoStart) { $.goal.textContent = level.goal; startPlay(paidLevel === lvNum ? new Set([BOOST_ID]) : new Set()); }
    else { paidLevel = 0; showIntro(); }
  }

  // que un botón con foco (¡Jugar!, pausa) no se active con Espacio/Enter mientras manejás
  function dropFocus() { const a = document.activeElement; if (a && root?.contains(a)) a.blur(); }

  /** boosts: potenciadores para este intento (por defecto, los elegidos en la tarjeta: se gastan acá) */
  function startPlay(boosts) {
    if (phase !== 'intro') return;
    if (!boosts) boosts = consumeSelected(boostSel);
    dropFocus();
    hideIntro();
    phase = 'play';
    audio.sfx('horn');
    const p = screenOf(car.x, 0.6, car.z);
    if (p) ui.floatText(p.x, p.y - 30, '¡Vamos!', 'pk-go');
    if (boosts.has(BOOST_ID)) {
      timeBonus = BOOST_TIME; freeTouches = BOOST_FREE; paidLevel = lvNum;
      lastShownSec = -1;
      refreshBar();
      bump($.time); bump($.hits);
      setTimeout(() => { if (!dead) audio.sfx('star'); }, 200);
      const r = $.time.getBoundingClientRect();
      ui.floatText(r.left + r.width / 2, r.bottom + 16, `${boosterIcon(BOOST_ID, 22)} +${BOOST_TIME} s`, 'pk-go');
      showHint(`¡Reloj Extra! +${BOOST_TIME} s y ${BOOST_FREE} toques gratis`, 0, 'good', 2.6);
    }
  }

  // ---------- Entrada ----------
  const KEYMAP = {
    ArrowUp: 'gas', KeyW: 'gas', ArrowDown: 'rev', KeyS: 'rev',
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', Space: 'brake',
  };
  function clearKeys() {
    for (const k in keys) keys[k] = false;
    for (const k in touch) touch[k].clear();
    root?.querySelectorAll('.pk-btn.on').forEach(b => b.classList.remove('on'));
  }
  function onKeyDown(e) {
    const k = KEYMAP[e.code];
    if (e.code === 'Escape') {
      if (phase === 'paused') { pauseModal?.close(); }
      else if (levelsModal) levelsModal.close();
      else if (!ui.hasModal()) openPause();
      e.preventDefault();
      return;
    }
    if (ui.hasModal()) return;
    if (phase === 'intro' && (e.code === 'Enter' || e.code === 'NumpadEnter' || ((k === 'gas' || k === 'rev') && !e.repeat))) {
      e.preventDefault();
      startPlay();
      if (!k) return;
    }
    if (e.code === 'KeyR' && phase === 'play' && !e.repeat) { loadLevel(lvNum, true); return; }
    if (k) { keys[k] = true; e.preventDefault(); }
  }
  function onKeyUp(e) {
    const k = KEYMAP[e.code];
    if (k) { keys[k] = false; e.preventDefault(); }
  }

  // ---------- Simulación ----------
  function readInput() {
    input.gas = keys.gas || touch.gas.size > 0;
    input.rev = keys.rev || touch.rev.size > 0;
    input.brake = keys.brake || (input.gas && input.rev);
    const l = keys.left || touch.left.size > 0, rr = keys.right || touch.right.size > 0;
    input.steer = (l ? 1 : 0) - (rr ? 1 : 0);
  }

  function registerTouch(x, z, strong) {
    if (freeTouches > 0) {
      // toque gratis del Reloj Extra: no cuenta (ni para perder ni para las estrellas)
      freeTouches--;
      globalCool = 0.35; shake = 0.15; hitFlash = 0.2;
      audio.sfx('bump');
      world.fx.burst(x, 0.3, z, 6, 1.2);
      const p = screenOf(x, 0.5, z);
      if (p) ui.floatText(p.x, p.y, '¡Toque gratis!', 'pk-go');
      bump($.hits);
      refreshBar();
      return;
    }
    touches++;
    globalCool = 0.35;
    shake = strong ? 0.3 : 0.2;
    hitFlash = 0.35;
    audio.sfx('bump');
    bump($.hits);
    world.fx.burst(x, 0.3, z, 8, 1.4);
    const p = screenOf(x, 0.5, z);
    if (p) ui.floatText(p.x, p.y, touches >= MAX_TOUCHES ? '¡Ay!' : '¡Toc!', 'pk-toc');
    refreshBar();
    if (touches === MAX_TOUCHES - 1) showHint('¡Cuidado! Un toque más y se termina', 0, 'warn', 2.2);
    if (touches >= MAX_TOUCHES) lose('touches');
  }

  function simulate(dt) {
    elapsed += dt;
    readInput();
    if (globalCool > 0) globalCool -= dt;
    const steps = 3, h = dt / steps;
    for (let s = 0; s < steps; s++) {
      stepCar(car, input, h);
      setBox(carBox, car.x, car.z, car.a);
      // obstáculos fijos
      for (let it = 0; it < 2; it++) {
        let any = false;
        for (const o of world.statics) {
          const d = collideBoxes(carBox, o.box, colOut);
          if (d <= 0) continue;
          any = true;
          car.x += colOut.nx * (d + 0.001); car.z += colOut.nz * (d + 0.001);
          setBox(carBox, car.x, car.z, car.a);
          const vx = Math.sin(car.a) * car.v, vz = Math.cos(car.a) * car.v;
          const vn = vx * colOut.nx + vz * colOut.nz;
          if (vn < 0) {
            const impact = -vn;
            // choque de frente: rebote; roce en ángulo: frena un poco y se desliza (el empuje ya quitó la parte normal)
            const head = impact / Math.max(Math.abs(car.v), 1e-3);
            car.v = head > 0.55 ? -car.v * 0.32 : car.v * (0.92 - head * 0.6);
            if (impact > 0.18 && (o.cool || 0) <= 0 && globalCool <= 0 && phase === 'play') {
              o.cool = 0.8;
              o.wob = 0.45;
              const cx = carBox.x - colOut.nx * 0.3, cz = carBox.z - colOut.nz * 0.3;
              registerTouch(cx, cz, impact > 1);
              if (phase !== 'play') return;
            }
          }
        }
        if (!any) break;
      }
      // conos
      for (const c of world.cones) {
        if (c.down || c.flying) continue;
        const d = circleVsBox(c.x, c.z, CONE_R, carBox, colOut);
        if (d <= 0) continue;
        const sp = Math.abs(car.v);
        c.flying = true;
        c.vx = colOut.nx * (sp * 1.4 + 0.8) + Math.sin(car.a) * car.v * 0.6;
        c.vz = colOut.nz * (sp * 1.4 + 0.8) + Math.cos(car.a) * car.v * 0.6;
        c.vy = 1.6 + sp * 0.9;
        c.spin = (6 + Math.random() * 6) * (Math.random() < 0.5 ? -1 : 1);
        c.mesh.rotation.order = 'YXZ';
        c.mesh.rotation.y = Math.atan2(c.vx, c.vz);
        car.v *= 0.8;
        audio.sfx('pop');
        // varios conos en el mismo golpe cuentan como un solo toque
        if (phase === 'play' && globalCool <= 0) registerTouch(c.x, c.z, false);
        if (phase !== 'play') return;
      }
    }
    for (const o of world.statics) if (o.cool > 0) o.cool -= dt;

    // ¿estacionada?
    spotCheck(carBox, world.spot, status);
    const still = Math.abs(car.v) < 0.12 && !input.gas && !input.rev;
    if (status.inside && status.aligned && still) hold += dt;
    else hold = Math.max(0, hold - dt * 3);
    status.hold = clamp(hold / HOLD_TIME, 0, 1);
    updateHint();
    if (hold >= HOLD_TIME) { win(); return; }

    const left = level.limit + timeBonus - elapsed;
    const sec = Math.ceil(left);
    if (sec !== lastShownSec) { lastShownSec = sec; refreshBar(); if (sec <= 10 && sec > 0) audio.sfx('tap'); }
    if (left <= 0) lose('time');
  }

  // ---------- Pistas ----------
  let hintTimer = 0, hintSticky = '';
  function showHint(text, progress = 0, cls = '', sticky = 0) {
    if (!text) { $.hint.classList.remove('show'); return; }
    if ($.hintText.textContent !== text) $.hintText.textContent = text;
    $.hint.classList.add('show');
    $.hint.classList.toggle('warn', cls === 'warn');
    $.hint.classList.toggle('good', cls === 'good');
    $.hint.classList.toggle('with-bar', progress > 0);
    $.hintBar.style.width = Math.round(progress * 100) + '%';
    if (sticky) { hintTimer = sticky; hintSticky = text; }
  }
  function updateHint() {
    if (hintTimer > 0) return;
    if (status.inside && status.aligned) {
      if (hold > 0.02) showHint('¡Perfecto! Quedate quietita…', status.hold, 'good');
      else showHint('¡Adentro! Soltá todo para frenar', 0, 'good');
    } else if ((status.inside || status.fill >= 0.5) && !status.aligned) showHint('Enderezá un poquito el auto', 0, '');
    else if (status.fill >= 0.5) showHint('¡Casi! Metete un poquito más', 0, '');
    else showHint('');
  }

  // ---------- Fin ----------
  function computeStars() {
    if (touches === 0 && elapsed <= level.par) return 3;
    if (touches <= 2) return 2;
    return 1;
  }

  function win() {
    phase = 'won';
    car.v = 0;
    status.done = true;
    hold = HOLD_TIME; status.hold = 1;
    showHint('');
    audio.sfx('done');
    const s = world.spot;
    world.fx.burst(s.x, 0.4, s.z, 40, 2.6);
    setTimeout(() => { if (!dead && world) { world.fx.burst(s.x - 0.3, 0.5, s.z, 25, 2.2); audio.sfx('star'); } }, 260);
    setTimeout(() => { if (!dead && world) world.fx.burst(s.x + 0.3, 0.5, s.z, 25, 2.2); }, 520);
    const p = screenOf(car.x, 0.8, car.z);
    if (p) ui.floatText(p.x, p.y - 20, '¡Perfecto!', 'pk-perfect');
    setTimeout(() => finish(true), 1500);
  }

  function lose(reason) {
    if (phase !== 'play') return;
    phase = 'lost';
    showHint('');
    audio.sfx(reason === 'time' ? 'error' : 'crash');
    shake = 0.45;
    const p = screenOf(car.x, 0.8, car.z);
    if (p) ui.floatText(p.x, p.y - 20, reason === 'time' ? '¡Tiempo!' : '¡Uy!', 'pk-toc');
    setTimeout(() => finish(false, reason), 1200);
  }

  async function finish(won, reason) {
    if (dead) return;
    paidLevel = 0;
    const st = pstate();
    const n = lvNum;
    let choice;
    if (won) {
      const stars = computeStars();
      const prev = st.stars[n] || 0;
      const firstPerfect = stars === 3 && prev < 3;
      st.stars[n] = Math.max(prev, stars);
      st.level = Math.max(st.level || 1, Math.min(LEVEL_COUNT, n + 1));
      save();
      store.inc('parkingWins');
      const remaining = Math.max(0, level.limit - elapsed);
      const score = Math.max(100, Math.round(1000 + stars * 250 + remaining * 10 - touches * 100));
      const lines = [
        `${icon('clock', 18)} ${elapsed.toFixed(1)} s &nbsp; · &nbsp; ${touches === 0 ? 'sin toques' : touches === 1 ? '1 toque' : touches + ' toques'}`,
      ];
      if (stars < 3) lines.push(touches > 0 ? `Para ${icon('star', 16)}${icon('star', 16)}${icon('star', 16)}: sin toques y en menos de ${level.par} s` : `Para ${icon('star', 16)}${icon('star', 16)}${icon('star', 16)}: estacioná en menos de ${level.par} s`);
      if (firstPerfect) lines.push(`${icon('gem', 18)} <b>¡Primera vez perfecta en este nivel!</b>`);
      if (n === LEVEL_COUNT) lines.push('👑 <b>¡Completaste todos los niveles!</b>');
      choice = await ctx.endGame({
        game: 'parking', score, stars, won: true,
        coins: 50 + 15 * stars, gems: firstPerfect ? 1 : 0, xp: 20,
        title: stars === 3 ? '¡Estacionamiento perfecto!' : '¡Estacionaste!',
        subtitle: `Nivel ${n} · ${level.name}`,
        lines, newBest: prev > 0 && stars > prev,
        againLabel: n < LEVEL_COUNT ? 'Siguiente' : 'Otra vez',
      });
      if (dead) return;
      if (choice === 'again') loadLevel(n < LEVEL_COUNT ? n + 1 : n);
    } else {
      choice = await ctx.endGame({
        game: 'parking', score: 0, stars: 0, won: false, coins: 5, xp: 5,
        title: reason === 'time' ? '¡Se acabó el tiempo!' : '¡Uy, muchos toques!',
        subtitle: 'Probá de nuevo, ¡ya casi lo tenés!',
        lines: [`${icon('sparkle', 18)} ${ui.esc(level.tip)}`],
        againLabel: 'Reintentar',
      });
      if (dead) return;
      if (choice === 'again') loadLevel(n);
    }
  }

  // ---------- Visual ----------
  function screenOf(x, y, z) {
    if (!r) return null;
    const v = new r.THREE.Vector3(x, y, z);
    const p = r.toScreen(v);
    return p.visible ? p : null;
  }

  function syncPlayer(dt) {
    const pv = world.playerPivot;
    pv.position.set(car.x, 0, car.z);
    pv.rotation.y = car.a;
    const model = pv.userData.model;
    try { model.userData.update?.(dt, car.v, car.maxSteer ? car.steer / car.maxSteer : 0); } catch (e) { console.warn(e); }
    const wob = pv.userData.wobble;
    wob.rotation.z = hitFlash > 0 ? Math.sin(hitFlash * 50) * 0.07 : 0;
    wob.position.y = phase === 'won' ? Math.abs(Math.sin(performance.now() / 120)) * 0.06 : 0;
  }

  let lastIns = null;
  function uiInsets() {
    // píxeles ocupados arriba (barra) y abajo (controles) para centrar la acción en el hueco libre
    const h = root.clientHeight || innerHeight;
    const bar = root.querySelector('.game-bar').getBoundingClientRect();
    const ctr = $.controls.getBoundingClientRect();
    const top = bar.bottom + 30;
    const portrait = (root.clientWidth || innerWidth) < (root.clientHeight || innerHeight);
    const bottom = portrait ? h - ctr.top + 6 : 24;
    return { top, bottom, h };
  }

  function updateCamera(dt) {
    const THREE = r.THREE;
    const w = root.clientWidth || innerWidth, hgt = root.clientHeight || innerHeight;
    const aspect = w / hgt;
    const tanH = Math.tan(FOV / 2 * DEG);
    const ins = lastIns = uiInsets();
    const freeFrac = Math.max(0.4, (ins.h - ins.top - ins.bottom) / ins.h);
    const [W, D] = level.area;
    const fitW = (W + 1.6) / (2 * tanH * aspect);
    const fitD = (D + 2.4) * Math.sin(PITCH) / (2 * tanH * freeFrac);
    let d = Math.max(fitW, fitD);
    // límite de zoom: en celular vertical se ven ~6.8 unidades de ancho; apaisado, ~11 de profundidad
    const maxVisW = aspect < 0.8 ? 6.8 : aspect < 1.2 ? 9 : 99;
    const maxByW = maxVisW / (2 * tanH * aspect);
    const maxByD = 5.6 * Math.sin(PITCH) / (tanH * freeFrac);
    // ...pero si el auto y el lugar no entran juntos, alejar un poco (hasta ~9.2 de ancho) para que el lugar se vea siempre
    const spot = world.spot;
    const MX = 1.05, MZ = 0.95;  // margen alrededor del auto (con su aro) / lugar
    const needByW = (Math.abs(car.x - spot.x) + MX * 2) / (2 * tanH * aspect);
    const needByD = (Math.abs(car.z - spot.z) + MZ * 2) * Math.sin(PITCH) / (2 * tanH * freeFrac);
    const capByW = Math.max(maxVisW, 9.2) / (2 * tanH * aspect);
    const need = Math.min(Math.max(needByW, needByD), capByW);
    d = Math.min(d, Math.max(Math.min(maxByW, maxByD), need, 9));
    // seguir al auto, pero manteniendo el lugar en cuadro cuando se puede; limitado al área
    const hwVis = d * tanH * aspect, hdVis = d * tanH * freeFrac / Math.sin(PITCH);
    const limX = Math.max(0, W / 2 + 0.8 - hwVis), limZ = Math.max(0, D / 2 + 0.9 - hdVis);
    const keepBoth = (c, s, half, m) => {
      const want = c * 0.7 + s * 0.3, r = Math.max(0, half - m);
      // rango de centros que deja al auto en cuadro; dentro de ese rango, el que más acerca al lugar
      const lo = Math.max(c - r, s - r), hi = Math.min(c + r, s + r);
      if (lo <= hi) return clamp(want, lo, hi);
      return clamp(s, c - r, c + r);
    };
    const tx = clamp(keepBoth(car.x, spot.x, hwVis, MX), -limX, limX);
    const tz = clamp(keepBoth(car.z, spot.z, hdVis, MZ), -limZ, limZ);
    if (!cam.init) { cam.x = tx; cam.z = tz; cam.d = d; cam.init = true; }
    const k = 1 - Math.exp(-dt * 3.2);
    cam.x += (tx - cam.x) * k; cam.z += (tz - cam.z) * k; cam.d += (d - cam.d) * k;
    let sx = 0, sz = 0;
    if (shake > 0) { shake -= dt; const a = shake * 0.25; sx = (Math.random() - 0.5) * a; sz = (Math.random() - 0.5) * a; }
    const camera = r.camera;
    camera.position.set(cam.x + sx, Math.sin(PITCH) * cam.d, cam.z + sz + Math.cos(PITCH) * cam.d);
    camera.lookAt(cam.x + sx, 0, cam.z + sz);
    // desplazar la imagen para centrar en el hueco entre la barra y los controles
    const shift = Math.round((ins.bottom - ins.top) / 2);
    const vk = `${w}x${hgt}:${shift}`;
    if (vk !== viewKey) {
      viewKey = vk;
      camera.setViewOffset(w, hgt, 0, shift, w, hgt);
      camera.updateProjectionMatrix();
    }
    void THREE;
  }

  // indicador en el borde de la pantalla cuando el lugar queda fuera de vista
  let projV = null, hintLow = false;
  function updatePointer() {
    if (!projV) projV = new r.THREE.Vector3();
    const show = phase === 'play' || phase === 'paused';
    const w = root.clientWidth, h = root.clientHeight;
    projV.set(world.spot.x, 0.2, world.spot.z).project(r.camera);
    const px = (projV.x + 1) / 2 * w, py = (1 - projV.y) / 2 * h;
    const ins = lastIns || uiInsets();
    const x0 = 34, x1 = w - 34, y0 = ins.top + 10, y1 = h - Math.max(ins.bottom, 30) - 10;
    const inside = projV.z < 1 && px > x0 && px < x1 && py > y0 && py < y1;
    // la pista va en la mitad opuesta al lugar, para no taparlo justo cuando estás estacionando
    if (projV.z < 1 && (hintLow ? py > h * 0.56 : py < h * 0.44)) { hintLow = !hintLow; $.hint.classList.toggle('low', hintLow); }
    if (!show || inside) { if (!$.pointer.hidden) $.pointer.hidden = true; return; }
    const cx = clamp(px, x0, x1), cy = clamp(py, y0, y1);
    const ang = Math.atan2(py - cy, px - cx);
    $.pointer.hidden = false;
    $.pointer.style.transform = `translate(${Math.round(cx)}px, ${Math.round(cy)}px)`;
    $.pointerArrow.style.transform = `rotate(${ang}rad)`;
  }

  function frame(dt, t) {
    if (!world) return;
    if (phase === 'play') simulate(dt);
    if (hintTimer > 0) { hintTimer -= dt; if (hintTimer <= 0) { hintSticky = ''; if (phase !== 'play') showHint(''); } }
    if (hitFlash > 0) hitFlash -= dt;
    if (goalTimer > 0 && phase === 'play') { goalTimer -= dt; if (goalTimer <= 0) $.goal.classList.remove('show'); }
    // humito al acelerar
    if (phase === 'play' && (input.gas || input.rev) && Math.abs(car.v) < car.maxF * 0.9) {
      puffT -= dt;
      if (puffT <= 0) {
        puffT = 0.11;
        world.fx.puff(car.x - Math.sin(car.a) * 0.55, car.z - Math.cos(car.a) * 0.55);
      }
    }
    syncPlayer(dt);
    // autos tocados tiemblan
    for (const o of world.statics) {
      if (o.wob > 0) {
        o.wob -= dt;
        const wg = o.mesh?.userData?.wobble;
        if (wg) wg.rotation.z = o.wob > 0 ? Math.sin(o.wob * 45) * 0.08 * (o.wob / 0.45) : 0;
      }
    }
    // conos voladores
    for (const c of world.cones) {
      if (!c.flying && !(c.down && (c.vx || c.vz))) continue;
      if (c.flying) {
        c.vy -= 9 * dt;
        c.x += c.vx * dt; c.z += c.vz * dt; c.y += c.vy * dt;
        c.mesh.rotation.x += c.spin * dt;
        if (c.y <= 0 && c.vy < 0) {
          if (c.vy < -1.4) { c.vy *= -0.35; c.y = 0; c.vx *= 0.6; c.vz *= 0.6; }
          else { c.flying = false; c.down = true; c.y = 0; c.mesh.rotation.x = 0; c.mesh.rotation.z = Math.PI / 2 * Math.sign(c.spin || 1); }
        }
      } else {
        c.x += c.vx * dt; c.z += c.vz * dt;
        c.vx *= Math.max(0, 1 - dt * 5); c.vz *= Math.max(0, 1 - dt * 5);
        if (Math.abs(c.vx) + Math.abs(c.vz) < 0.02) { c.vx = 0; c.vz = 0; }
      }
      c.mesh.position.set(c.x, c.down ? 0.16 : c.y, c.z);
    }
    world.fx.update(dt);
    world.updateSpot(dt, t, status);
    updateCamera(dt);
    updatePointer();
  }

  return {
    hud: false,
    music: 'game',
    async mount(container, params = {}) {
      styleEl = document.createElement('style');
      styleEl.textContent = PARKING_CSS;
      document.head.append(styleEl);

      r = createPixelRenderer(container, {
        ortho: false, fov: FOV, background: 0xbfe9ff, outline: true, // pixelSize por defecto (≈1.5 celu / 2 PC)
      });
      r.camera.near = 0.5; r.camera.far = 120; r.camera.updateProjectionMatrix();
      const { sun } = addLights(r.scene, { shadowSize: 22, shadowRes: 2048 });
      sun.position.set(7, 20, 9);
      buildUI(container);

      listen(window, 'keydown', onKeyDown);
      listen(window, 'keyup', onKeyUp);
      listen(window, 'blur', clearKeys);
      listen(window, 'pointerup', releasePointer);
      listen(window, 'pointercancel', releasePointer);
      listen(document, 'visibilitychange', () => {
        if (!document.hidden) return;
        clearKeys();
        if (phase === 'play') openPause();
      });

      const wanted = Number(params.level);
      const start = wanted >= 1 && wanted <= LEVEL_COUNT ? wanted : unlocked();
      loadLevel(start);
      r.onFrame(frame);
      r.start();
      // gancho de inspección para pruebas automáticas (tools/smoke.mjs --eval)
      window.__parking = {
        get car() { return car; }, get phase() { return phase; }, get level() { return lvNum; },
        get touches() { return touches; }, get status() { return status; }, get spot() { return world?.spot; },
        get elapsed() { return elapsed; }, get freeTouches() { return freeTouches; }, get timeBonus() { return timeBonus; },
        load: (n) => loadLevel(n), play: () => startPlay(), touch: () => { if (phase === 'play') registerTouch(car.x, car.z, false); },
      };
    },
    unmount() {
      dead = true;
      delete window.__parking;
      pauseModal?.close();
      for (const c of cleanups.splice(0)) c();
      world = null;
      r?.dispose(); r = null;
      root?.remove(); root = null;
      styleEl?.remove(); styleEl = null;
    },
  };
}
