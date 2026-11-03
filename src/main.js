// Arranque, router de escenas y contexto compartido (ctx) que reciben todas las escenas.
import { bus } from './core/bus.js';
import { store } from './core/state.js';
import * as data from './core/data.js';
import * as economy from './core/economy.js';
import * as quests from './core/quests.js';
import { ui, toast, rewardModal, closeAllModals, hasModal } from './core/ui.js';
import { audio } from './core/audio.js';
import { hud } from './core/hud.js';

const SCENES = {
  city: () => import('./scenes/city.js'),
  wardrobe: () => import('./scenes/wardrobe.js'),
  match3: () => import('./games/match3.js'),
  blocks: () => import('./games/blocks.js'),
  parking: () => import('./games/parking.js'),
  driving: () => import('./games/driving.js'),
};

const sceneEl = document.getElementById('scene');
const fadeEl = document.getElementById('fade');
let current = null;       // { id, instance }
let navigating = false;
const pendingLevelUps = [];

const params = new URLSearchParams(location.search);

// ---------- Router ----------
const router = {
  get current() { return current?.id; },
  /** Cambia de escena. params se pasa a mount(). */
  async go(id, p = {}) {
    if (navigating) return false;   // doble toque / navegación en curso: se ignora
    if (!SCENES[id]) { console.error('escena desconocida', id); return false; }
    navigating = true;
    closeAllModals();
    fadeEl.classList.add('show');
    await new Promise(r => setTimeout(r, 180));
    let failed = false;
    try {
      if (current?.instance) { try { current.instance.unmount(); } catch (e) { console.error(e); } }
      sceneEl.innerHTML = '';
      const mod = await SCENES[id]();
      const instance = mod.default(ctx);
      current = { id, instance };
      const container = document.createElement('div');
      container.className = 'scene-root scene-' + id;
      sceneEl.append(container);
      if (instance.hud === false) hud.hide(); else hud.show();
      audio.music(instance.music ?? (id === 'city' ? 'city' : 'game'));
      await instance.mount(container, p);
      bus.emit('scene:changed', { id });
    } catch (e) {
      console.error('Error cargando escena', id, e);
      toast('Ups, algo falló cargando ' + id, { icon: 'info', type: 'bad' });
      failed = true;
    } finally {
      fadeEl.classList.remove('show');
      navigating = false;
    }
    // volver a la ciudad recién cuando terminó el finally (si no, el candado de navegación se libera a mitad de camino)
    if (failed) return id !== 'city' ? router.go('city') : false;
    if (id === 'city') { flushLevelUps(); maybeShowLogin(); }
    return true;
  },
  /** Abre un minijuego verificando que esté desbloqueado. */
  openGame(gameId, p = {}) {
    const st = gameStatus(gameId);
    if (!st.ok) { audio.sfx('error'); toast(st.reason, { icon: 'lock' }); return false; }
    router.go(gameId, p);
    return true;
  },
};

/** {ok, reason} — un juego está disponible si el nivel alcanza y su edificio está construido. */
function gameStatus(gameId) {
  const g = data.GAME_BY_ID[gameId];
  if (!g) return { ok: false, reason: '???' };
  if (store.state.player.level < g.unlock) return { ok: false, reason: `Se desbloquea en nivel ${g.unlock}`, locked: true };
  if (!economy.hasBuilt(g.building)) return { ok: false, reason: `Construí ${data.BUILDING_BY_ID[g.building].name} para jugar`, needsBuilding: g.building };
  return { ok: true };
}

/**
 * Fin de partida de cualquier minijuego.
 * result: { game, score, stars(0..3), won(bool), coins(base), gems, xp, title?, lines?:[html], newBest? }
 * Las monedas base se multiplican por rewardScale(nivel). Devuelve 'again' | 'city'.
 */
let ending = null;
function endGame(result) {
  // si un juego llama dos veces seguidas (doble toque, timers), no duplicar premios ni apilar modales
  if (ending) return ending;
  ending = finishGame(result).finally(() => { ending = null; });
  return ending;
}
async function finishGame(result) {
  const s = store.state;
  const scale = data.rewardScale(s.player.level);
  const reward = {
    coins: Math.round((result.coins || 0) * scale),
    gems: result.gems || 0,
    xp: Math.round((result.xp ?? 10) * Math.sqrt(scale)),
  };
  store.grant(reward, 'game:' + result.game);
  store.inc('played_' + result.game);
  store.inc('gamesPlayed');
  bus.emit('minigame:finished', { game: result.game, score: result.score || 0, stars: result.stars || 0, won: !!result.won });
  store.save();
  audio.sfx(result.won === false ? 'lose' : 'win');
  const choice = await rewardModal({
    title: result.title || (result.won === false ? '¡Casi!' : '¡Muy bien!'),
    subtitle: result.subtitle || (result.score != null ? `Puntaje: ${result.score.toLocaleString('es-AR')}` : ''),
    stars: result.stars,
    lines: [...(result.newBest ? ['🏆 <b>¡Nuevo récord!</b>'] : []), ...(result.lines || [])],
    reward,
    buttons: [{ label: 'Ciudad', value: 'city', cls: 'ghost' }, { label: result.againLabel || 'Otra vez', value: 'again', cls: 'pink' }],
  });
  if (choice === 'city') router.go('city');
  return choice;
}

async function openPanel(name, p = {}) {
  try {
    const mod = await import('./scenes/panels.js');
    return await mod.openPanel(ctx, name, p);
  } catch (e) { console.error(e); toast('No se pudo abrir el panel'); }
}

export const ctx = {
  store, bus, ui, audio, data, economy, quests, router, hud,
  get state() { return store.state; },
  endGame, openPanel, gameStatus,
};

// ---------- Subidas de nivel ----------
bus.on('level:up', (ev) => {
  pendingLevelUps.push(ev);
  audio.sfx('levelup');
  if (router.current === 'city' && !navigating) setTimeout(flushLevelUps, 400);
});
const cityIdle = () => router.current === 'city' && !navigating && !hasModal() && !flushing && !pendingLevelUps.length;
let flushing = false;
async function flushLevelUps() {
  if (flushing) return;
  flushing = true;
  try {
    while (pendingLevelUps.length && router.current === 'city' && !navigating) {
      if (hasModal()) { setTimeout(() => { flushing = false; flushLevelUps(); }, 800); return; }
      const ev = pendingLevelUps.shift();
      await openPanel('levelup', ev);
    }
  } finally { if (!pendingLevelUps.length || router.current !== 'city' || navigating) flushing = false; }
}

// ---------- Premio diario ----------
// Se muestra en la ciudad cuando no hay otro modal (p.ej. después de las subidas de nivel),
// y también al volver a la app en un día nuevo (iOS deja la PWA abierta en segundo plano).
let loginOpen = false, loginWait = 0;
function maybeShowLogin() {
  if (loginOpen || loginWait || !quests.loginStatus()) return;
  let tries = 0;
  const attempt = () => {
    loginWait = 0;
    if (loginOpen || !quests.loginStatus()) return;
    if (!cityIdle()) { if (++tries < 40 && router.current === 'city') loginWait = setTimeout(attempt, 700); return; }
    loginOpen = true;
    Promise.resolve(openPanel('login')).finally(() => { loginOpen = false; });
  };
  loginWait = setTimeout(attempt, 600);
}

// ---------- Arranque ----------
function applyDebugParams() {
  if (params.has('reset')) store.reset();
  if (params.has('cheat')) {
    const s = store.state;
    s.coins += 100000; s.gems += 1000;
    const lv = Number(params.get('cheat')) || 0;
    if (lv > s.player.level) s.player.level = Math.min(data.MAX_LEVEL, lv);
    store.markDirty();
  }
}

async function boot() {
  store.load();
  applyDebugParams();
  audio.configure(store.state.settings);
  quests.initQuests();
  hud.init(document.getElementById('hud'), ctx);
  economy.tick();
  setInterval(() => economy.tick(), 1000);

  // iOS solo habilita el audio dentro de un gesto; touchend/click son los más confiables en Safari
  const unlock = () => audio.unlock();
  for (const ev of ['pointerdown', 'touchend', 'click', 'keydown']) addEventListener(ev, unlock, { passive: true, capture: true });
  addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    economy.tick();
    if (router.current === 'city') maybeShowLogin();
  });

  // Evitar zoom con doble toque/pinch del navegador en iOS
  document.addEventListener('gesturestart', e => e.preventDefault());
  document.addEventListener('gesturechange', e => e.preventDefault());
  document.addEventListener('dblclick', e => e.preventDefault(), { passive: false });

  const splash = document.getElementById('splash');
  const startScene = params.get('scene') || 'city';
  const skipSplash = params.has('scene') || params.has('nosplash');

  let started = false;
  const begin = async () => {
    if (started) return;
    started = true;
    audio.unlock();
    splash.classList.add('hide');
    setTimeout(() => splash.remove(), 500);
    await router.go(startScene, Object.fromEntries(params));   // en la ciudad, go() ya muestra el premio diario
  };
  if (skipSplash) begin();
  else {
    splash.classList.add('ready');
    splash.addEventListener('click', begin, { once: true });
    addEventListener('keydown', function k(e) { if (e.key === 'Enter' || e.key === ' ') { removeEventListener('keydown', k); begin(); } });
  }

  if ('serviceWorker' in navigator && location.protocol !== 'file:' && !params.has('nosw') && !['localhost', '127.0.0.1'].includes(location.hostname)) {
    navigator.serviceWorker.register('./sw.js').catch(e => console.warn('SW', e));
  }
  addEventListener('beforeinstallprompt', e => { e.preventDefault(); window.__pixeliaInstallPrompt = e; });
  window.__pixelia = { ctx, store, bus, economy, quests, data };
}

boot();
