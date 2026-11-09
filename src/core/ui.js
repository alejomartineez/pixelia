// Componentes de interfaz compartidos (DOM). Ver DESIGN.md para clases CSS.
import { icon } from './icons.js';
import { audio } from './audio.js';
import { fmtNum } from './economy.js';
import { t, tn } from './i18n.js';
import { MATERIAL_BY_ID, RESOURCES, RESERVES } from './data.js';
import { EQUIPMENT } from '../expedition/exp-data.js';

const $ = (sel, root = document) => root.querySelector(sel);

/** Crea un elemento: h('div.panel.big', {onclick}, 'texto', otroNodo) */
export function h(tag, attrs = {}, ...children) {
  const [name, ...classes] = tag.split('.');
  const el = document.createElement(name || 'div');
  if (classes.length) el.className = classes.join(' ');
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'class') el.className += ' ' + v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c)));
  return el;
}
export const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/**
 * Íconos de premios especiales. main.js registra los dibujos pixel de cofres y sobres
 * (rewardArt.chest(type, size) / rewardArt.pack(size)); si no, se usa un regalo/emoji.
 */
export const rewardArt = { chest: null, pack: null, chestName: null };
/**
 * HTML de un costo/premio: {coins, gems, xp}. Con opts.extras = true también dibuja {chest, chests, stickers}
 * (por defecto no, porque los paneles muestran el cofre aparte con su nombre).
 */
export function costHtml(cost = {}, size = 16, opts = {}) {
  const parts = [];
  if (cost.coins) parts.push(`<span class="cost">${icon('coin', size)}${fmtNum(cost.coins)}</span>`);
  if (cost.gems) parts.push(`<span class="cost">${icon('gem', size)}${fmtNum(cost.gems)}</span>`);
  if (cost.xp) parts.push(`<span class="cost">${icon('xp', size)}${fmtNum(cost.xp)}</span>`);
  // materiales de región: { madera: n, piedra: n, mineral: n, hierbas: n }
  if (cost.mats) for (const [id, n] of Object.entries(cost.mats)) {
    const m = MATERIAL_BY_ID[id];
    if (m && n) parts.push(`<span class="cost cost-mat" title="${esc(m.name)}" aria-label="${n} ${esc(m.name.toLowerCase())}">${icon(m.icon, size)}${fmtNum(n)}</span>`);
  }
  // recursos del ciclo: provisiones, planos, colonos, equipo { id: n } y reservas { id: n }
  for (const key of ['prov', 'planos', 'colonos']) {
    const n = cost[key], r = RESOURCES[key];
    if (n) parts.push(`<span class="cost cost-res" title="${esc(r.name)}" aria-label="${n} ${esc(n === 1 ? r.one : r.name.toLowerCase())}">${icon(r.icon, size)}${fmtNum(n)}</span>`);
  }
  for (const [kind, cat] of [['equip', EQUIPMENT], ['reserves', RESERVES]]) if (cost[kind]) for (const [id, n] of Object.entries(cost[kind])) {
    const it = cat[id];
    if (it && n) parts.push(`<span class="cost cost-res" title="${esc(it.name)}" aria-label="${n} ${esc(it.name.toLowerCase())}">${icon(it.icon, size)}${fmtNum(n)}</span>`);
  }
  if (opts.extras && cost.chest) {
    const type = typeof cost.chest === 'object' ? cost.chest.type : cost.chest;
    const n = (typeof cost.chest === 'object' ? cost.chest.n : cost.chests) || 1;
    const name = rewardArt.chestName?.(type) || t('ui.chest');
    const art = rewardArt.chest ? rewardArt.chest(type, Math.round(size * 1.15)) : icon('gift', size);
    parts.push(`<span class="cost cost-chest" title="${esc(name)}" aria-label="${esc(name)}">${art}${n > 1 ? '×' + n : ''}</span>`);
  }
  if (opts.extras && cost.stickers) {
    const n = typeof cost.stickers === 'object' ? cost.stickers.n : cost.stickers;
    const art = rewardArt.pack ? rewardArt.pack(Math.round(size * 1.15)) : icon('pack', size);
    parts.push(`<span class="cost cost-pack" title="${esc(t('hud.findings'))}" aria-label="${esc(tn('ui.findings', n))}">${art}×${n}</span>`);
  }
  return parts.join(' ') || `<span class="cost">${t('city.build.gratis')}</span>`;
}

// ---------- Toast ----------
const TOAST_MAX = 3;
// Con un cartel de premio abierto (Subiste de nivel, Premio diario, rango…) los avisos esperan a que se cierre: arriba
// del todo tapaban su título («Misión cumplida» sobre «Subiste de nivel», docs/RECORRIDO-NOCHE.md). Salen después, de a uno.
const heldToasts = [];
let heldTimer = 0;
const rewardOpen = () => !!document.querySelector('#modal-root .reward-modal');
function releaseHeld() {
  if (rewardOpen()) return;
  clearInterval(heldTimer); heldTimer = 0;
  heldToasts.splice(0).forEach(([text, opts], i) => setTimeout(() => showToast(text, opts), i * 300));
}
export function toast(text, opts = {}) {
  if (rewardOpen()) {
    heldToasts.push([text, opts]);
    if (heldToasts.length > TOAST_MAX) heldToasts.shift();
    if (!heldTimer) heldTimer = setInterval(releaseHeld, 300);
    return;
  }
  showToast(text, opts);
}
function showToast(text, { icon: ic, type = '' } = {}) {
  const root = $('#toast-root');
  if (!root) return;
  // como mucho 3 a la vez: el más viejo se va
  const live = [...root.children].filter(t => !t.classList.contains('gone'));
  while (live.length >= TOAST_MAX) { const old = live.shift(); old.classList.add('gone'); old.classList.remove('show'); setTimeout(() => old.remove(), 200); }
  const el = h('div.toast' + (type ? '.' + type : ''), { html: (ic ? icon(ic, 20) : '') + `<span>${esc(text)}</span>` });
  root.append(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 2200);
}

// ---------- Modal ----------
const openModals = [];
/**
 * modal({ title, content: Node|string(html), actions: [{label, cls, onClick, close=true}], closable=true, onClose, className })
 * Devuelve { el, body, close }.
 */
export function modal({ title = '', content = '', actions = [], closable = true, onClose, className = '', icon: ic } = {}) {
  const root = $('#modal-root');
  const back = h('div.modal-back');
  const box = h('div.modal' + (className ? '.' + className.split(' ').join('.') : ''));
  const head = h('div.modal-head', { html: (ic ? icon(ic, 24) : '') + `<h2>${esc(title)}</h2>` });
  if (closable) head.append(h('button.icon-btn.modal-x', { 'aria-label': t('common.close'), html: icon('close', 18), onclick: () => close() }));
  const body = h('div.modal-body');
  if (typeof content === 'string') body.innerHTML = content; else if (content) body.append(content);
  box.append(head, body);
  if (actions.length) {
    const foot = h('div.modal-foot');
    for (const a of actions) {
      foot.append(h('button.btn.' + (a.cls || 'primary').split(' ').join('.'), {
        html: a.html || esc(a.label),
        disabled: a.disabled,
        onclick: async () => { audio.sfx('tap'); const r = await a.onClick?.(); if (a.close !== false && r !== false) close(); },
      }));
    }
    box.append(foot);
  }
  back.append(box);
  if (closable) back.addEventListener('pointerdown', e => { if (e.target === back) close(); });
  root.append(back);
  requestAnimationFrame(() => back.classList.add('show'));
  let closed = false;
  function close() {
    if (closed) return; closed = true;
    back.classList.remove('show');
    setTimeout(() => back.remove(), 220);
    openModals.splice(openModals.indexOf(api), 1);
    onClose?.();
  }
  const api = { el: box, body, close, closable };
  openModals.push(api);
  audio.sfx('open');
  return api;
}
export function closeAllModals() { [...openModals].forEach(m => m.close()); }
export const hasModal = () => openModals.length > 0;

// Esc cierra el modal de arriba (si se puede cerrar) y no deja que la tecla llegue al juego de abajo.
// Va en la fase de captura de `document`: las animaciones de pantalla completa (cofres, sobres) escuchan en
// la captura de `window`, que corre antes, y frenan la tecla ellas mismas.
if (typeof document !== 'undefined') {
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !openModals.length) return;
    e.stopPropagation();
    e.preventDefault();
    const top = openModals[openModals.length - 1];
    if (top.closable && !e.repeat) { audio.sfx('close'); top.close(); }
  }, true);
}

export function confirm(title, text, okLabel = t('common.yes'), cancelLabel = t('common.no')) {
  return new Promise(res => {
    let v = false;
    modal({ title, content: `<p class="center">${text}</p>`, onClose: () => res(v),
      actions: [{ label: cancelLabel, cls: 'ghost' }, { label: okLabel, cls: 'primary', onClick: () => { v = true; } }] });
  });
}

/**
 * Pantalla de premio. reward {coins, gems, xp, chest, stickers}, stars (0..3 o undefined).
 * lines: [html | Node]. buttons: [{label, value, cls, html}] -> resuelve con el value elegido.
 * Si el modal se cierra sin tocar un botón (p.ej. al cambiar de escena) resuelve con dismissValue
 * (por defecto 'city' si algún botón la tiene, si no el value del primer botón). party: true tira confeti (solo momentos grandes).
 */
export function rewardModal({ title = t('ui.reward.title'), subtitle = '', reward = {}, stars, lines = [], buttons = [{ label: t('ui.reward.ok'), value: 'ok' }], dismissValue, className = '', party = false } = {}) {
  return new Promise(res => {
    let val = dismissValue !== undefined ? dismissValue : buttons.some(b => b.value === 'city') ? 'city' : buttons[0].value;
    const wrap = h('div.reward');
    if (stars !== undefined) {
      const st = h('div.reward-stars');
      for (let i = 0; i < 3; i++) {
        const s = h('span.rstar', { html: icon(i < stars ? 'star' : 'starOff', 48) });
        s.style.animationDelay = (0.15 + i * 0.25) + 's';
        st.append(s);
      }
      wrap.append(st);
      for (let i = 0; i < stars; i++) setTimeout(() => audio.sfx('star'), 200 + i * 250);
    }
    if (subtitle) wrap.append(h('p.reward-sub', {}, subtitle));
    for (const l of lines) {
      if (l == null || l === '') continue;
      if (l.nodeType) wrap.append(l); else wrap.append(h('p.reward-line', { html: l }));
    }
    if (reward.coins || reward.gems || reward.xp || reward.mats || reward.prov || reward.planos) wrap.append(h('div.reward-items', { html: costHtml({ coins: reward.coins, gems: reward.gems, xp: reward.xp, mats: reward.mats, prov: reward.prov, planos: reward.planos, colonos: reward.colonos, equip: reward.equip }, 28) }));
    modal({ title, content: wrap, closable: false, className: ('reward-modal ' + className).trim(), onClose: () => res(val),
      actions: buttons.map(b => ({ label: b.label, html: b.html, cls: b.cls || 'primary', onClick: () => { val = b.value; } })) });
    if (party && (stars === undefined || stars > 0)) confetti();   // confeti solo en momentos grandes (party: true)
  });
}

// ---------- Accesibilidad (Ajustes → Accesibilidad) ----------
// Tamaño de texto: clase text-l / text-xl en <html> y la variable --text-scale (ver el bloque al final de styles.css).
// Reducir movimiento: 'auto' sigue al sistema (prefers-reduced-motion), 'on' siempre, 'off' nunca. La clase
// reduce-motion en <html> apaga las animaciones CSS; la JS que sacude la pantalla o tira confeti consulta reducedMotion().
export const TEXT_SIZES = { normal: 1, large: 1.15, xlarge: 1.3 };
const MOTION_PREFS = ['auto', 'on', 'off'];
let motionPref = 'auto';
let a11ySettings = null;
const motionMq = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
/** ¿Hay que evitar movimientos grandes (sacudones, confeti, cosas volando)? */
export function reducedMotion() { return motionPref === 'on' || (motionPref === 'auto' && !!motionMq?.matches); }
/** Aplica state.settings.textSize y .motion a <html>. Se llama al arrancar y cada vez que cambian en Ajustes. */
export function applyA11y(settings = {}) {
  a11ySettings = settings;
  const size = TEXT_SIZES[settings.textSize] ? settings.textSize : 'normal';
  motionPref = MOTION_PREFS.includes(settings.motion) ? settings.motion : 'auto';
  const de = typeof document !== 'undefined' ? document.documentElement : null;
  if (!de) return;
  de.classList.toggle('text-l', size === 'large');
  de.classList.toggle('text-xl', size === 'xlarge');
  de.style.setProperty('--text-scale', String(TEXT_SIZES[size]));
  de.classList.toggle('reduce-motion', reducedMotion());
  de.classList.toggle('motion-full', motionPref === 'off');
}
motionMq?.addEventListener?.('change', () => applyA11y(a11ySettings || {}));

// ---------- Efectos ----------
/** Texto flotante en coordenadas de pantalla (px). */
export function floatText(x, y, html, cls = '') {
  const el = h('div.float-text' + (cls ? '.' + cls : ''), { html, style: { left: x + 'px', top: y + 'px' } });
  $('#fx-root').append(el);
  setTimeout(() => el.remove(), cls === 'say' ? 1600 : 1100);
}
/** Íconos que vuelan desde (x,y) hasta el contador del HUD (data-hud="coins"|"gems"|"xp"). */
export function flyCurrency(x, y, kind = 'coins', count = 6) {
  const target = document.querySelector(`[data-hud="${kind}"]`);
  const r = target?.getBoundingClientRect();
  const tx = r ? r.left + 14 : innerWidth / 2, ty = r ? r.top + r.height / 2 : 20;
  const name = kind === 'gems' ? 'gem' : kind === 'xp' ? 'xp' : kind === 'prov' ? 'prov' : kind === 'hierbas' ? 'herbs' : 'coin';
  if (reducedMotion()) {
    // sin íconos volando: solo el sonido y el saltito del contador
    audio.sfx(kind === 'gems' ? 'gem' : 'coin');
    target?.classList.remove('bump'); void target?.offsetWidth; target?.classList.add('bump');
    return;
  }
  count = Math.min(10, Math.max(1, count));
  for (let i = 0; i < count; i++) {
    const el = h('div.fly', { html: icon(name, 24), style: { left: x + 'px', top: y + 'px' } });
    $('#fx-root').append(el);
    const dx = (Math.random() - 0.5) * 70, dy = (Math.random() - 0.5) * 70;
    const anim = el.animate([
      { transform: 'translate(-50%,-50%) scale(.6)', opacity: 1 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(1.1)`, opacity: 1, offset: 0.3 },
      { transform: `translate(calc(-50% + ${tx - x}px), calc(-50% + ${ty - y}px)) scale(.7)`, opacity: 0.9 },
    ], { duration: 650 + i * 55, easing: 'cubic-bezier(.5,0,.6,1)' });
    anim.onfinish = () => {
      el.remove();
      if (i === 0) audio.sfx(kind === 'gems' ? 'gem' : 'coin');
      target?.classList.remove('bump'); void target?.offsetWidth; target?.classList.add('bump');
    };
  }
}
/** Confeti pixelado sobre toda la pantalla. */
/** Multiplicador de partículas de Ajustes (pocas 0,4 · normales 1 · muchas 1,8). */
let particleMul = 1;
export function setParticles(m) { particleMul = m > 0 ? m : 1; }
export function confetti(n = 70) {
  if (reducedMotion()) return;
  n = Math.max(8, Math.round(n * particleMul));
  const cv = h('canvas.confetti');
  $('#fx-root').append(cv);
  const scale = 4;
  cv.width = Math.ceil(innerWidth / scale); cv.height = Math.ceil(innerHeight / scale);
  const g = cv.getContext('2d');
  const cols = ['#ee8a5c', '#7f9ee8', '#6fe3c1', '#8fd3ff', '#ffd166', '#ffffff'];
  const parts = Array.from({ length: n }, () => ({
    x: cv.width / 2 + (Math.random() - 0.5) * cv.width * 0.3, y: cv.height * 0.35,
    vx: (Math.random() - 0.5) * 3.2, vy: -Math.random() * 3.5 - 1, c: cols[Math.floor(Math.random() * cols.length)], s: Math.random() < 0.3 ? 2 : 1,
  }));
  let t = 0;
  (function frame() {
    g.clearRect(0, 0, cv.width, cv.height);
    for (const p of parts) { p.vy += 0.09; p.x += p.vx; p.y += p.vy; p.vx *= 0.99; g.fillStyle = p.c; g.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.s); }
    if (++t < 140) requestAnimationFrame(frame); else cv.remove();
  })();
}

/** Bottom sheet (panel que sube desde abajo; en PC se ve como panel centrado). */
export function sheet({ title = '', content, onClose, className = '' } = {}) {
  return modal({ title, content, onClose, className: ('sheet ' + className).trim() });
}

/** Barra de progreso HTML */
export function progressHtml(pct, cls = '') {
  return `<div class="progress ${cls}"><i style="width:${Math.max(0, Math.min(100, pct * 100)).toFixed(1)}%"></i></div>`;
}

export const ui = { h, esc, icon, costHtml, toast, modal, confirm, rewardModal, floatText, flyCurrency, confetti, sheet, progressHtml, closeAllModals, hasModal, reducedMotion, applyA11y };
