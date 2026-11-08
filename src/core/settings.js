// Ajustes del juego (docs/PLAN-QUIEBRE.md §G). Los valores viven en state.settings (los completa deepFill) y se
// aplican en vivo: gráficos a todos los renderers montados (setGraphics de voxel.js), sonido (audio.configure),
// texto y movimiento (applyA11y), escala de la interfaz, contador de FPS y la ventana del juego de PC.
// Cada cambio emite 'settings:changed' por el bus con { key, settings } para las escenas que quieran reaccionar.
import { setGraphics, frameStats } from './voxel.js';
import { audio } from './audio.js';
import { applyA11y, setParticles } from './ui.js';
import { SETTINGS_DEFAULTS } from './state.js';
import { setKeyMap } from './keys.js';
import { applyWindow } from './desktop.js';

export { SETTINGS_DEFAULTS };

/** Presets de gráficos. 'custom' es cualquier combinación que no coincide con uno de estos. */
export const PRESETS = {
  low: { renderScale: 100, aa: false, shadows: false, outline: true, particles: 'few' },
  medium: { renderScale: 150, aa: true, shadows: true, outline: true, particles: 'normal' },
  high: { renderScale: 200, aa: true, shadows: true, outline: true, particles: 'normal' },
};
export const PRESET_KEYS = Object.keys(PRESETS.high);
export const PARTICLES = { few: 0.4, normal: 1, many: 1.8 };
export const FPS_CAPS = [30, 60, 120, 144, 0];
export const WIN_RES = [[1280, 720], [1600, 900], [1920, 1080], [2560, 1440]];

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const num = (v, def, a, b) => (typeof v === 'number' && isFinite(v) ? clamp(v, a, b) : def);

/** Corrige valores fuera de rango o de tipo (saves editados a mano, versiones viejas). Muta y devuelve s. */
export function normalize(s) {
  const D = SETTINGS_DEFAULTS;
  for (const k of Object.keys(D)) if (s[k] === undefined) s[k] = typeof D[k] === 'object' ? { ...D[k] } : D[k];
  if (s.lowQuality && s.gfxPreset === 'auto') Object.assign(s, PRESETS.low, { gfxPreset: 'low' });
  s.lowQuality = false;
  if (!['auto', 'custom', ...Object.keys(PRESETS)].includes(s.gfxPreset)) s.gfxPreset = 'high';
  s.renderScale = Math.round(num(s.renderScale, D.renderScale, 50, 200) / 10) * 10;
  if (!PARTICLES[s.particles]) s.particles = 'normal';
  if (!FPS_CAPS.includes(s.maxFps)) s.maxFps = 60;
  if (![10, 15, 30, 60].includes(s.bgFps)) s.bgFps = 30;
  for (const k of ['volMaster', 'volMusic', 'volSfx', 'volAmb', 'volUi', 'volVoice']) s[k] = num(s[k], D[k], 0, 1);
  s.uiScale = Math.round(num(s.uiScale, 100, 80, 150) / 5) * 5;
  if (!['window', 'fullscreen', 'borderless'].includes(s.winMode)) s.winMode = 'window';
  if (!['slow', 'normal', 'fast', 'instant'].includes(s.textSpeed)) s.textSpeed = 'normal';
  if (![1, 2, 3].includes(s.combatSpeed)) s.combatSpeed = 1;
  s.camSpeed = num(s.camSpeed, 1, 0.5, 2);
  if (!s.keys || typeof s.keys !== 'object' || Array.isArray(s.keys)) s.keys = {};
  return s;
}

/** Qué preset coincide con los valores de ahora ('custom' si ninguno). */
export function matchPreset(s) {
  for (const [id, p] of Object.entries(PRESETS)) if (PRESET_KEYS.every(k => s[k] === p[k])) return id;
  return 'custom';
}

/** Configuración de gráficos que entiende voxel.js a partir de los ajustes. */
export function graphicsFrom(s) {
  return {
    scale: s.renderScale / 100, aa: !!s.aa, shadows: !!s.shadows, outline: !!s.outline,
    particles: PARTICLES[s.particles] ?? 1, maxFps: s.maxFps, bgFps: s.bgFps,
    // con 'auto' (todavía sin medir) o un preset, si los cuadros vienen lentos la resolución baja sola
    autoRes: s.gfxPreset !== 'custom',
    uiZoom: s.uiScale / 100,
  };
}

let ctxRef = null;

/** Aplica todo (al arrancar). */
export function initSettings(ctx) {
  ctxRef = ctx;
  ctx.setSetting = setSetting;
  normalize(ctx.state.settings);
  applyAll(ctx.state.settings);
  watchBackground();
  if (ctx.state.settings.gfxPreset === 'auto') scheduleAutoPreset(ctx);
}

function applyAll(s) {
  const g = graphicsFrom(s);
  setGraphics(g);
  setParticles(g.particles);
  audio.configure(s);
  applyA11y(s);
  setKeyMap(s.keys);
  applyUiScale(s);
  fpsMeter(s.showFps);
  document.documentElement.classList.toggle('hi-contrast', !!s.hiContrast);
}

/**
 * Cambia uno o varios ajustes, lo guarda y lo aplica en vivo. Si toca algo de un preset, pasa a 'custom'
 * (salvo que coincida con otro preset). Devuelve el objeto settings.
 */
export function setSetting(patch, opts = {}) {
  const ctx = ctxRef;
  const s = ctx.state.settings;
  if (patch.gfxPreset && PRESETS[patch.gfxPreset]) Object.assign(s, PRESETS[patch.gfxPreset]);
  Object.assign(s, patch);
  if (!patch.gfxPreset && PRESET_KEYS.some(k => k in patch)) s.gfxPreset = matchPreset(s);
  if ('volMusic' in patch) s.music = s.volMusic > 0;
  if ('volSfx' in patch) s.sfx = s.volSfx > 0;
  normalize(s);
  ctx.store.markDirty();
  applyAll(s);
  if (('winMode' in patch || 'winRes' in patch) && !opts.fromWindow) applyWindow(s);
  ctx.bus.emit('settings:changed', { keys: Object.keys(patch), settings: s });
  return s;
}

// ---------- Escala de la interfaz ----------
// En el juego de PC se usa el zoom del WebView (todo queda coherente: clics, tamaños, canvas). En el navegador,
// zoom CSS sobre el HUD y las ventanas (igual que el tamaño de texto).
function applyUiScale(s) {
  const z = s.uiScale / 100;
  const de = document.documentElement;
  const wv = window.__TAURI__?.webview?.getCurrentWebview?.();
  if (wv?.setZoom) {
    de.style.setProperty('--ui-scale', '1');
    if (applyUiScale.last !== z) { applyUiScale.last = z; wv.setZoom(z).catch(e => console.warn('[ajustes] zoom', e)); }
  } else de.style.setProperty('--ui-scale', String(z));
  de.classList.toggle('ui-scaled', z !== 1);
}

// ---------- Contador de FPS ----------
let meter = null, meterTimer = 0;
function fpsMeter(on) {
  if (!on) { clearInterval(meterTimer); meterTimer = 0; meter?.remove(); meter = null; return; }
  if (meter) return;
  meter = document.createElement('div');
  meter.id = 'fps-meter';
  meter.setAttribute('aria-hidden', 'true');
  document.body.append(meter);
  let lastN = frameStats.frames, lastT = performance.now();
  const tick = () => {
    const n = frameStats.frames, t = performance.now();
    const fps = (n - lastN) * 1000 / Math.max(1, t - lastT);
    lastN = n; lastT = t;
    meter.textContent = `${Math.round(fps)} FPS`;
    meter.dataset.fps = String(Math.round(fps));
  };
  tick();
  meterTimer = setInterval(tick, 500);
}

// ---------- Silenciar en segundo plano ----------
function watchBackground() {
  const upd = () => {
    const s = ctxRef?.state?.settings;
    const away = document.hidden || (s?.muteBg && typeof document.hasFocus === 'function' && !document.hasFocus());
    audio.setBackground(!!(s?.muteBg && away), !!document.hidden && !!s?.muteBg);
  };
  addEventListener('blur', upd);
  addEventListener('focus', upd);
  document.addEventListener('visibilitychange', upd);
}

// ---------- Primer arranque: preset según la compu ----------
// Se mide cuánto tarda cada cuadro en la ciudad (≈8 s de juego con la ventana adelante). Los navegadores de prueba
// (navigator.webdriver) no se miden: dibujan por software y siempre darían Baja.
function scheduleAutoPreset(ctx) {
  if (navigator.webdriver || /[?&](quality|fps)=/.test(location.search)) return;
  let samples = [], lastN = 0, lastT = 0, timer = 0;
  const off = ctx.bus.on('scene:changed', (e) => { if (e?.id === 'city' && !timer) start(); });
  if (ctx.router?.current === 'city') start();
  function start() {
    lastN = frameStats.frames; lastT = performance.now();
    timer = setInterval(() => {
      const s = ctx.state.settings;
      if (s.gfxPreset !== 'auto') return stop();
      const n = frameStats.frames, t = performance.now();
      if (!document.hidden && document.hasFocus?.() !== false && n > lastN) samples.push((n - lastN) * 1000 / (t - lastT));
      lastN = n; lastT = t;
      if (samples.length >= 8) { decide(); stop(); }
    }, 1000);
  }
  function stop() { clearInterval(timer); timer = 1; off?.(); }
  function decide() {
    samples.sort((a, b) => a - b);
    const med = samples[samples.length >> 1];
    const cap = ctx.state.settings.maxFps || 60;
    const ratio = med / Math.min(60, cap);
    const pick = ratio > 0.8 ? 'high' : ratio > 0.55 ? 'medium' : 'low';
    setSetting({ gfxPreset: pick });
    if (pick !== 'high') ctx.ui.toast(`Ajustamos los gráficos a tu compu (${PRESET_NAMES[pick]}). Lo podés cambiar en Ajustes.`, { icon: 'gear' });
  }
}
export const PRESET_NAMES = { low: 'Baja', medium: 'Media', high: 'Alta', custom: 'Personalizada', auto: 'Automática' };
