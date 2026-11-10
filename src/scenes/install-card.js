// Invitación a instalar: una tarjeta chiquita (no un modal) en la ciudad, después de una primera sesión buena
// (nivel 3 o tercera vez que se abre el juego) y solo si no está instalada.
//   - PC/Android con beforeinstallprompt (main.js lo guarda en window.__pixeliaInstallPrompt): botón Instalar.
//   - iPhone/iPad en Safari: los pasos Compartir → Agregar a inicio, con íconos.
//   - Se puede cerrar. Aparece como mucho dos veces: la segunda, una semana después de la primera. Nunca en standalone.
// Estado por dispositivo (no viaja con la partida): localStorage 'pixelia.install.v1'.
// Telemetría: install_prompt_shown / install_prompt_accepted / install_prompt_dismissed.
import { h, hasModal } from '../core/ui.js';
import { icon } from '../core/icons.js';
import { audio } from '../core/audio.js';
import { track } from '../online/telemetry.js';
import { levelOf } from '../core/state.js';

const KEY = 'pixelia.install.v1';
const WEEK = 7 * 864e5;
const MIN_LEVEL = 3;
const MIN_OPENS = 3;
const MAX_SHOWS = 2;
// .cx-placebar (colocando algo) y .th-bar (defensa de una amenaza): la tarjeta los taparía en iPhone, así que espera
const OVERLAYS = '.chx-open, .alb-open, .cx-placebar, .th-bar, #splash';

const load = () => { try { return { opens: 0, shows: 0, lastShown: 0, dismissed: 0, accepted: false, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { opens: 0, shows: 0, lastShown: 0, dismissed: 0, accepted: false }; } };
const save = (st) => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch {} };

export const isStandalone = () => { try { return !!(navigator.standalone || matchMedia('(display-mode: standalone)').matches); } catch { return false; } };
const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
// en iOS solo Safari instala de forma confiable (Chrome, Firefox y los navegadores dentro de otras apps no)
const isIOSSafari = () => isIOS() && /Safari\//.test(navigator.userAgent) && !/CriOS|FxiOS|EdgiOS|OPiOS|FBAN|FBAV|Instagram|Line\//.test(navigator.userAgent);
const deferredPrompt = () => { const p = window.__pixeliaInstallPrompt; return p && typeof p.prompt === 'function' ? p : null; };

/** 'prompt' (botón Instalar) | 'ios' (pasos) | null (este navegador no sabe instalar). */
function platform() {
  if (deferredPrompt()) return 'prompt';
  if (isIOSSafari()) return 'ios';
  return null;
}

let ctx = null;
let st = null;
let card = null;
let shownNow = false;   // como mucho una vez por apertura
let waiting = 0;

/** ¿Toca mostrarla? (sin mirar si la ciudad está libre) */
export function installEligible(now = Date.now()) {
  if (!st || isStandalone() || st.accepted || shownNow) return false;
  if (st.shows >= MAX_SHOWS) return false;
  if (st.shows > 0 && now - st.lastShown < WEEK) return false;
  const level = levelOf(ctx?.state);
  if (level < MIN_LEVEL && st.opens < MIN_OPENS) return false;
  return !!platform();
}

const cityFree = () => ctx?.router?.current === 'city' && !ctx.router.visiting && !hasModal() && !document.querySelector(OVERLAYS);

/** Espera a que la ciudad esté tranquila y muestra la tarjeta si corresponde. */
function maybeShow(delay = 4000) {
  if (!installEligible() || waiting) return;
  const t0 = Date.now();
  const check = () => {
    waiting = 0;
    if (!installEligible()) return;
    if (cityFree()) { show(); return; }
    if (Date.now() - t0 < 90e3 && ctx?.router?.current === 'city') waiting = setTimeout(check, 2500);
  };
  waiting = setTimeout(check, delay);
}

function hide() {
  if (!card) return;
  const el = card;
  card = null;
  el.classList.remove('show');
  setTimeout(() => el.remove(), 250);
}

/** La esconde sin contarla como vista (se tapó con la colocación o la defensa): puede volver a salir en esta apertura. */
let prevShown = 0;
function retract() {
  if (!card) return;
  hide();
  shownNow = false;
  st.shows = Math.max(0, st.shows - 1); st.lastShown = prevShown; save(st);
}

function show() {
  const kind = platform();
  if (!kind || card) return;
  shownNow = true;
  prevShown = st.lastShown;
  st.shows++; st.lastShown = Date.now(); save(st);
  track('install_prompt_shown', { platform: kind, shows: st.shows, level: levelOf(ctx?.state), opens: st.opens });

  const close = h('button.icon-btn.inst-x', { 'aria-label': 'Ahora no', html: icon('close', 16) });
  close.onclick = () => {
    audio.sfx('close');
    st.dismissed++; save(st);
    track('install_prompt_dismissed', { platform: kind, via: 'card', shows: st.shows });
    hide();
  };
  const head = h('div.inst-head', { html: `<img class="pi inst-ic" src="icons/icon-192.png" width="40" height="40" alt=""><span><b>Llevate Pixelia a tu inicio</b><small>Se abre a pantalla completa y funciona sin internet.</small></span>` }, close);
  card = h('div.inst-card', { role: 'region', 'aria-label': 'Instalar Pixelia' }, head);

  if (kind === 'prompt') {
    const btn = h('button.btn.primary.small.block', { html: `${icon('plus', 18)} Instalar` });
    btn.onclick = async () => {
      const p = deferredPrompt();
      if (!p) { hide(); return; }
      audio.sfx('tap');
      btn.disabled = true;
      let outcome = 'dismissed';
      try { await p.prompt(); outcome = (await p.userChoice)?.outcome || 'dismissed'; } catch (e) { console.warn('[install]', e); }
      window.__pixeliaInstallPrompt = null;   // el aviso del navegador se usa una sola vez
      if (outcome === 'accepted') {
        st.accepted = true; save(st);
        track('install_prompt_accepted', { platform: kind, via: 'prompt' });
        ctx?.ui?.toast?.('¡Listo! Pixelia ya está en tu inicio', { icon: 'check', type: 'good' });
      } else {
        st.dismissed++; save(st);
        track('install_prompt_dismissed', { platform: kind, via: 'browser', shows: st.shows });
      }
      hide();
    };
    card.append(btn);
  } else {
    card.append(h('ol.inst-steps', { html: `
      <li><span class="inst-step-ic">${shareIcon()}</span><span>Tocá <b>Compartir</b></span></li>
      <li><span class="inst-step-ic">${addHomeIcon()}</span><span>Elegí <b>Agregar a inicio</b></span></li>` }));
  }
  (document.getElementById('app') || document.body).append(card);
  requestAnimationFrame(() => card?.classList.add('show'));
}

// íconos chiquitos en SVG pixelado (los de Ajustes viven en panels-common, que trae todos los estilos de paneles)
function shareIcon() {
  return `<svg width="28" height="28" viewBox="0 0 14 14" shape-rendering="crispEdges" aria-hidden="true"><path fill="#4fa8e0" d="M6 1h2v1h-2zM5 2h4v1h-4zM4 3h1v1h-1zM9 3h1v1h-1zM6 3h2v6h-2zM2 6h3v1h-3zM9 6h3v1h-3zM2 7h1v5h-1zM11 7h1v5h-1zM2 12h10v1h-10z"/></svg>`;
}
function addHomeIcon() {
  return `<svg width="28" height="28" viewBox="0 0 14 14" shape-rendering="crispEdges" aria-hidden="true"><path fill="#3d2f2a" d="M2 1h10v1h-10zM1 2h1v10h-1zM12 2h1v10h-1zM2 12h10v1h-10z"/><path fill="#fff" d="M2 2h10v10h-10z"/><path fill="#3d2f2a" d="M6 4h2v6h-2zM4 6h6v2h-6z"/></svg>`;
}

/** Se llama una vez al arrancar (main.js). Cuenta la apertura y escucha la llegada a la ciudad. */
export function initInstallCard(gameCtx) {
  if (ctx) return;
  ctx = gameCtx;
  st = load();
  st.opens++;
  if (isStandalone() && !st.accepted) { st.accepted = true; }   // ya la abrió instalada: no hay nada que ofrecer
  save(st);
  ctx.bus.on('scene:changed', ({ id, params } = {}) => {
    if (id === 'city' && !params?.visit) maybeShow();
    else hide();
  });
  // al empezar a colocar algo o a defender la ciudad se esconde; al terminar, vuelve a esperar su momento
  ctx.bus.on('city:placing', ({ active } = {}) => {
    if (active) retract();
    else if (ctx.router.current === 'city') maybeShow(2500);
  });
  ctx.bus.on('threat:started', retract);
  ctx.bus.on('threat:resolved', () => { if (ctx.router.current === 'city') maybeShow(6000); });
  // llegó a nivel 3 en esta sesión: después de la ventana de subida de nivel
  ctx.bus.on('level:up', () => { if (ctx.router.current === 'city') maybeShow(6000); });
  // en PC el aviso del navegador puede llegar después de entrar a la ciudad
  addEventListener('beforeinstallprompt', () => setTimeout(() => { if (ctx.router.current === 'city') maybeShow(1500); }, 0));
  addEventListener('appinstalled', () => {
    if (!st.accepted) { st.accepted = true; save(st); track('install_prompt_accepted', { platform: 'prompt', via: 'appinstalled' }); }
    hide();
  });
  if (ctx.router.current === 'city' && !ctx.router.visiting) maybeShow();
  if (typeof window !== 'undefined') window.__pixeliaInstall = { get state() { return { ...st }; }, eligible: installEligible, show: () => show(), hide };
}
