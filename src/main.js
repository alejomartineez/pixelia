// Arranque, router de escenas y contexto compartido (ctx) que reciben todas las escenas.
//
// Orden de arranque: store.load → applyDebugParams → initChests → initAlbum → initSeason → initEvents → initQuests
// → HUD → (online) initSync → social.initSocial. Al entrar a la ciudad se muestran, de a uno y sin pisarse:
// regalo de bienvenida ("Bienvenida de vuelta") → premio diario → subidas de nivel.
import { bus } from './core/bus.js';
import { store } from './core/state.js';
import * as data from './core/data.js';
import * as economy from './core/economy.js';
import * as quests from './core/quests.js';
import { ui, h, esc, toast, rewardModal, closeAllModals, hasModal, rewardArt, applyA11y } from './core/ui.js';
import { icon } from './core/icons.js';
import { audio } from './core/audio.js';
import { hud } from './core/hud.js';
import * as chests from './chests/chests.js';
import * as album from './album/album.js';
import * as season from './season/season.js';
import * as events from './season/events.js';
import { chestIcon, packIcon } from './season/season-ui-common.js';
import { net } from './online/net.js';
import * as home from './home/furniture.js';

const SCENES = {
  city: () => import('./scenes/city.js'),
  wardrobe: () => import('./scenes/wardrobe.js'),
  onboarding: () => import('./scenes/onboarding.js'),   // primera vez: elegir personaje, nombre y ciudad
  match3: () => import('./games/match3.js'),
  blocks: () => import('./games/blocks.js'),
  parking: () => import('./games/parking.js'),
  driving: () => import('./games/driving.js'),
  home: () => import('./scenes/home.js'),   // Mi Casa por dentro (también la de una amistad: {visit})
};

const sceneEl = document.getElementById('scene');
const fadeEl = document.getElementById('fade');
let current = null;       // { id, instance, params }
let navigating = false;
const pendingLevelUps = [];

const params = new URLSearchParams(location.search);

// ---------- Router ----------
const router = {
  get current() { return current?.id; },
  /** Parámetros con los que se montó la escena actual (p.ej. {visit: friendId} en la ciudad). */
  get params() { return current?.params || {}; },
  /** ¿La ciudad está en modo visita (ciudad de una amistad)? */
  get visiting() { return current?.id === 'city' && !!current?.params?.visit; },
  /** Cambia de escena. params se pasa a mount(). Ciudad de una amistad: go('city', {visit: friendId}). */
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
      current = { id, instance, params: p || {} };
      const container = document.createElement('div');
      container.className = 'scene-root scene-' + id;
      sceneEl.append(container);
      if (instance.hud === false) hud.hide(); else hud.show();
      audio.music(instance.music ?? (id === 'city' ? 'city' : 'game'));
      await instance.mount(container, p);
      bus.emit('scene:changed', { id, params: p || {} });
    } catch (e) {
      console.error('Error cargando escena', id, e);
      toast('Ups, algo falló cargando ' + id, { icon: 'info', type: 'bad' });
      failed = true;
    } finally {
      fadeEl.classList.remove('show');
      navigating = false;
    }
    // volver a la ciudad recién cuando terminó el finally (si no, el candado de navegación se libera a mitad de camino)
    if (failed) return id !== 'city' || p?.visit ? router.go('city') : false;
    if (id === 'city' && !p?.visit) runArrival();
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

// ---------- Fin de partida ----------
/**
 * Fin de partida de cualquier minijuego.
 * result: { game, score, stars(0..3), won(bool), coins(base), gems, xp, title?, subtitle?, lines?:[html], newBest?, againLabel? }
 * Las monedas base se multiplican por rewardScale(nivel) y por el evento activo del juego (eventMult(game+'Rewards')).
 * Además: cofre (rollGameChest, con segunda tirada en "Lluvia de Cofres"), figurita (35% al ganar, x eventMult('stickers'))
 * y chispas del Pase (las suma season.js al escuchar minigame:finished). Devuelve 'again' | 'city'.
 */
const GAME_STICKER_CHANCE = 0.35;
let ending = null;
function endGame(result) {
  // si un juego llama dos veces seguidas (doble toque, timers), no duplicar premios ni apilar modales
  if (ending) return ending;
  ending = finishGame(result).finally(() => { ending = null; });
  return ending;
}
async function finishGame(result) {
  const s = store.state;
  const t0 = Date.now();
  const stars = Math.max(0, Math.min(3, result.stars || 0));
  const scale = data.rewardScale(s.player.level);
  const mult = safe(() => events.eventMult(result.game + 'Rewards'), 1);
  const reward = {
    coins: Math.round((result.coins || 0) * scale * mult),
    gems: Math.round((result.gems || 0) * mult),
    // Observatorio terminado: +XP en las partidas
    xp: Math.round((result.xp ?? 10) * Math.sqrt(scale) * (1 + safe(() => economy.monumentBonus('gameXp'), 0) + safe(() => home.comfortInfo().xpBonus, 0))),
  };
  // material del juego para los monumentos: 1 por estrella (mínimo 1) y +1 si ganaste, con el evento del juego
  const mat = data.MATERIAL_BY_GAME[result.game];
  if (mat) reward.mats = { [mat.id]: Math.max(1, Math.round((Math.max(1, stars) + (result.won ? 1 : 0)) * mult)) };
  store.grant(reward, 'game:' + result.game);
  store.inc('played_' + result.game);
  store.inc('gamesPlayed');

  // cofre por ganar (+ tiradas extra si hay evento de cofres)
  const chestsWon = [];
  if (result.won) {
    const rolls = Math.max(1, Math.round(safe(() => events.eventMult('chestDrop'), 1)));
    for (let i = 0; i < rolls; i++) { const t = safe(() => chests.rollGameChest({ won: true, stars }), null); if (t) chestsWon.push(t); }
  }
  // figurita
  let sticker = null;
  // Museo terminado: más chance de figurita
  const stickerChance = GAME_STICKER_CHANCE * safe(() => events.eventMult('stickers'), 1) * (1 + safe(() => economy.monumentBonus('stickers'), 0));
  if (result.won && Math.random() < stickerChance) {
    const p = { n: 1, minStars: 1, source: 'game' };
    bus.emit('reward:stickers', p);
    sticker = p.result?.[0] || null;
  }
  bus.emit('minigame:finished', { game: result.game, score: result.score || 0, stars, won: !!result.won });
  store.save();
  audio.sfx(result.won === false ? 'lose' : 'win');

  const sp = safe(() => season.lastMinigamePoints(), null);
  const chispas = sp && sp.at >= t0 ? sp.pts : 0;
  const lines = [];
  if (result.newBest) lines.push(`${icon('trophy', 22)} <b>¡Nuevo récord!</b>`);
  lines.push(...(result.lines || []));
  if (mult > 1 && (reward.coins || reward.gems)) lines.push(`${icon('⚡', 18)} ¡Premio x${String(mult).replace('.', ',')} por el evento!`);
  const extras = h('div.rw-extras');
  for (const type of chestsWon) {
    const def = chests.CHESTS[type];
    extras.append(h('div.rw-extra.rw-chest', { style: `--c:${def?.color || '#ffd166'}`, html:
      `<span class="rw-art">${chestIcon(type, 46)}</span><span class="rw-txt"><small>¡Ganaste un cofre!</small><b>${esc(def?.name || 'Cofre')}</b><em>Abrilo desde Cofres</em></span>` }));
  }
  if (sticker) {
    const def = album.stickerDef(sticker.id);
    const card = h('span.rw-art.rw-stk');
    if (def) card.append(album.renderStickerCard(def, { isNew: sticker.isNew, showCount: false }));
    extras.append(h('div.rw-extra.rw-sticker', { style: `--c:${def?.color || '#ee8a5c'}` }, card,
      h('span.rw-txt', { html: `<small>${sticker.isNew ? '¡Figurita nueva!' : 'Figurita repetida'}</small><b>${esc(def?.name || 'Figurita')}</b><em>${'★'.repeat(sticker.stars)}${sticker.isNew ? ' · ya está en tu Álbum' : ' · cambiala por brillitos'}</em>` })));
  }
  if (chispas) extras.append(h('div.rw-chispas', { html: `${icon('sparkle', 20)}<b>+${chispas}</b> chispas del Pase` }));
  // cuánto falta de este material para la próxima etapa de un monumento
  const hint = mat ? safe(() => economy.materialHint(mat.id), null) : null;
  if (hint) {
    const txt = hint.missing > 0
      ? `Te ${hint.missing === 1 ? 'falta' : 'faltan'} <b>${hint.missing} ${esc(hint.missing === 1 ? hint.mat.one : hint.mat.name.toLowerCase())}</b> para ${hint.stage === 1 ? 'empezar ' + esc(hint.the) : 'la etapa ' + hint.stage + ' ' + esc(hint.of)}`
      : `¡Ya tenés los ${esc(hint.mat.name.toLowerCase())} para ${hint.stage === 1 ? 'empezar ' + esc(hint.the) : 'la etapa ' + hint.stage + ' ' + esc(hint.of)}!`;
    extras.append(h('div.rw-mathint' + (hint.missing > 0 ? '' : '.ok'), { html: `${icon('monument', 20)}<span>${txt}</span>` }));
  }
  if (extras.childElementCount) lines.push(extras);

  const choice = await rewardModal({
    title: result.title || (result.won === false ? '¡Casi!' : '¡Muy bien!'),
    subtitle: result.subtitle || (result.score != null ? `Puntaje: ${Number(result.score).toLocaleString('es-AR')}` : ''),
    stars: result.stars,
    lines,
    reward,
    buttons: [{ label: 'Ciudad', value: 'city', cls: 'ghost' }, { label: result.againLabel || 'Otra vez', value: 'again', cls: 'primary' }],
    dismissValue: 'city',
    className: 'game-reward',
  });
  if (choice === 'city') router.go('city');
  return choice;
}
function safe(fn, def) { try { return fn(); } catch (e) { console.error(e); return def; } }

async function openPanel(name, p = {}) {
  try {
    const mod = await import('./scenes/panels.js');
    return await mod.openPanel(ctx, name, p);
  } catch (e) { console.error(e); toast('No se pudo abrir el panel'); }
}

// ---------- Social (src/online/social.js, carga diferida) ----------
let socialP = null;
/** Carga social.js una sola vez y llama initSocial(ctx). Devuelve el módulo o null si todavía no existe. */
function loadSocial() {
  return (socialP ||= import('./online/social.js').then(m => {
    ctx.social = m;
    try { m.initSocial?.(ctx); } catch (e) { console.error('[social] init', e); }
    hud.refreshBadges();
    return m;
  }).catch(e => { console.warn('[social] no disponible', e); socialP = null; return null; }));
}
async function openSocial(tab = 'amigas') {
  const m = await loadSocial();
  if (!m?.openSocial) { toast('Muy pronto vas a poder jugar con más gente', { icon: 'people' }); return; }
  try { return await m.openSocial(ctx, tab); } catch (e) { console.error(e); toast('No se pudo abrir Contactos', { type: 'bad' }); }
}
async function openAccount() {
  const m = await loadSocial();
  if (!m?.openAccount) { toast('Las cuentas online llegan muy pronto', { icon: 'people' }); return; }
  try { return await m.openAccount(ctx); } catch (e) { console.error(e); }
}
// Intercambiar desde el álbum antes de que social.js esté cargado: se carga y se reenvía el pedido.
bus.on('album:trade', (p) => {
  if (ctx.social || !p || p.handled) return;
  p.handled = true;
  loadSocial().then(m => {
    if (m) bus.emit('album:trade', { ...p, handled: false });
    else toast('Los intercambios con tus contactos se activan con tu cuenta online', { icon: 'people' });
  });
});

// ---------- Paneles de progresión ----------
const lazyUi = (loader, fail) => async (...args) => {
  try { return await loader(...args); } catch (e) { console.error(e); toast(fail, { type: 'bad' }); }
};
const openChests = lazyUi(p => import('./chests/chests-ui.js').then(m => m.openChestsPanel(ctx, p || {})), 'No se pudieron abrir los cofres');
const openAlbum = lazyUi(p => import('./album/album-ui.js').then(m => m.openAlbum(ctx, p || {})), 'No se pudo abrir el álbum');
const openSeasonPass = lazyUi(() => season.openSeasonPass(ctx), 'No se pudo abrir el Pase');
const openEvents = lazyUi(() => events.openEventsPanel(ctx), 'No se pudieron abrir los eventos');

export const ctx = {
  store, bus, ui, audio, data, economy, quests, router, hud, home,
  get state() { return store.state; },
  endGame, openPanel, gameStatus,
  // progresión y social
  chests, album, season, events, net,
  social: null,      // módulo social.js cuando está cargado
  sync: null,        // módulo sync.js cuando hay modo online
  openChests, openAlbum, openSeasonPass, openEvents, openSocial, openAccount,
};

// ---------- Llegada a la ciudad: bienvenida → premio diario → subidas de nivel ----------
// .cx-placebar: colocando un edificio (pintando árboles, caminos…): un modal ahí taparía la barra y el próximo
// toque en "Colocar" caería sobre él. Las subidas de nivel esperan a que termine (city:placing {active:false}).
const OVERLAYS = '.chx-open, .alb-open, .cx-placebar';
const cityReady = () => router.current === 'city' && !navigating && !router.visiting;
const cityIdle = () => cityReady() && !hasModal() && !document.querySelector(OVERLAYS);
/** Espera a que la ciudad esté libre (sin modales ni animaciones). false si se fue de la ciudad o pasó maxMs. */
function waitIdle(maxMs = 60e3) {
  return new Promise(res => {
    const t0 = Date.now();
    const check = () => {
      if (!cityReady() || Date.now() - t0 > maxMs) return res(false);
      if (cityIdle()) return res(true);
      setTimeout(check, 350);
    };
    setTimeout(check, 250);
  });
}
let arrival = null, arrivalAgain = false;
async function arrivalSteps() {
  if (!(await waitIdle())) return false;
  if (season.welcomeBackStatus()) {
    await season.openWelcomeBack(ctx);
    if (!(await waitIdle())) return false;
  }
  if (quests.loginStatus()) {
    await openPanel('login');
    if (!(await waitIdle())) return false;
  }
  return true;
}
/** Muestra en orden lo pendiente al llegar a la ciudad. Si se pide de nuevo mientras corre, repasa al terminar. */
function runArrival() {
  if (arrival) { arrivalAgain = true; return arrival; }
  arrival = (async () => {
    try {
      let ok = true;
      do { arrivalAgain = false; ok = await arrivalSteps(); } while (ok && arrivalAgain);
    } catch (e) { console.error(e); }
    finally {
      arrival = null;
      if (pendingLevelUps.length && cityReady()) setTimeout(flushLevelUps, 300);
    }
  })();
  return arrival;
}

bus.on('level:up', (ev) => {
  pendingLevelUps.push(ev);
  audio.sfx('levelup');
  if (cityReady() && !arrival) setTimeout(flushLevelUps, 400);
});
let flushing = false;
async function flushLevelUps() {
  if (flushing || arrival) return;
  flushing = true;
  try {
    while (pendingLevelUps.length && cityReady()) {
      if (!cityIdle() && !(await waitIdle())) break;
      const ev = pendingLevelUps.shift();
      await openPanel('levelup', ev);
    }
  } catch (e) { console.error(e); }
  finally { flushing = false; }
}
// si una subida de nivel se quedó esperando (waitIdle se rinde a los 60 s) mientras se colocaba algo, sale al terminar
bus.on('city:placing', ({ active } = {}) => {
  if (!active && pendingLevelUps.length && cityReady() && !arrival) setTimeout(flushLevelUps, 400);
});
// bienvenida que aparece al volver a la app después de días en segundo plano (iPhone deja la PWA abierta)
bus.on('season:welcome', () => { if (cityReady()) runArrival(); });

// ---------- Online ----------
async function startOnline() {
  try {
    const sync = await import('./online/sync.js');
    ctx.sync = sync;
    // las figuritas que llegan/salen por regalos e intercambios pasan por el álbum
    sync.setStickerAdder?.((id, n) => album.giveStickers({ [id]: n }, 'online'));
    sync.setStickerTaker?.((id, n) => album.takeStickers(id, n), (id, n) => album.stickerCount(id) - n >= 1);
    const st = await sync.initSync(ctx);
    const social = await loadSocial();
    if (st?.conflict && social?.handleConflict) await social.handleConflict(ctx, st.conflict);
  } catch (e) { console.warn('[online]', e); }
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

function initProgression() {
  const steps = [['chests', chests.initChests], ['album', album.initAlbum], ['season', season.initSeason], ['events', events.initEvents], ['quests', quests.initQuests],
    ['home', () => home.initHome({ monumentDone: (s) => economy.monumentsDone(s) > 0 })]];
  for (const [name, fn] of steps) { try { fn(); } catch (e) { console.error('[init] ' + name, e); } }
  // íconos pixel de cofres y sobres en los premios (costHtml)
  rewardArt.chest = (type, size) => chestIcon(type, size);
  rewardArt.pack = (size) => packIcon(size);
  rewardArt.chestName = (type) => chests.CHESTS[type]?.name || 'Cofre';
}

// preloader inline de index.html (window.__boot); en páginas de herramientas puede no existir
const bootUi = window.__boot || null;

async function boot() {
  bootUi?.started();
  store.load();
  applyDebugParams();
  applyA11y(store.state.settings);
  audio.configure(store.state.settings);
  initProgression();
  hud.init(document.getElementById('hud'), ctx);
  import('./online/telemetry.js').then(m => m.initTelemetry(ctx)).catch(e => console.warn('[telemetry]', e));
  import('./scenes/install-card.js').then(m => m.initInstallCard(ctx)).catch(e => console.warn('[install]', e));
  economy.tick();
  setInterval(() => economy.tick(), 1000);

  // iOS solo habilita el audio dentro de un gesto; touchend/click son los más confiables en Safari
  const unlock = () => audio.unlock();
  for (const ev of ['pointerdown', 'touchend', 'click', 'keydown']) addEventListener(ev, unlock, { passive: true, capture: true });
  addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    economy.tick();
    if (cityReady()) runArrival();
  });

  // Zoom con pellizco: se puede en el HUD, los menús y los avisos (accesibilidad), pero no sobre la escena,
  // donde el pellizco es de la cámara de la ciudad o del minijuego (#scene tiene touch-action:none; en iOS además gesture*)
  const inScene = (e) => !!e.target?.closest?.('#scene');
  document.addEventListener('gesturestart', e => { if (inScene(e)) e.preventDefault(); });
  document.addEventListener('gesturechange', e => { if (inScene(e)) e.preventDefault(); });
  document.addEventListener('dblclick', e => e.preventDefault(), { passive: false });

  // online: sync primero y después social; sin servidor, social igual se carga (Obra en Equipo personal, buzón vacío)
  if (net.mode !== 'off') startOnline();
  else setTimeout(loadSocial, 1500);

  // Splash = preloader de index.html (mismo fondo y logo): mientras se ve, se baja la primera escena (con three.js).
  // Normal: cuando está todo, pasa a "Tocá para jugar" (el toque desbloquea el audio en iOS) y se va al montar la escena.
  // ?nosplash / ?scene=: no espera el toque; el preloader queda encima (sin capturar toques) hasta que la escena se monta.
  const splash = document.getElementById('splash');
  const startScene = params.get('scene') || 'city';
  const skipSplash = params.has('scene') || params.has('nosplash');
  // partida nueva sin ?scene=: primero el onboarding (al terminar entra a la ciudad)
  const first = !store.state.onboarded && !params.has('scene') ? 'onboarding' : startScene;
  const cssReady = new Promise(r => (bootUi ? bootUi.whenCss(r) : r()));
  // si la primera escena (o three.js) no baja, el preloader muestra "No pudimos abrir Pixelia" + Reintentar
  // en vez de ofrecer "Tocá para jugar" y dejar una pantalla vacía
  let bootFailed = false;
  const failBoot = () => { bootFailed = true; splash.classList.remove('ready', 'passive'); bootUi?.fail(); };
  const scenePrefetch = (SCENES[first]?.() || Promise.resolve())
    .then(() => { bootUi?.tick('scene'); return true; }, e => { console.warn('[boot] precarga de escena', e); return false; });
  // onboarding: la ciudad se baja de fondo mientras se elige personaje
  if (first === 'onboarding') scenePrefetch.then(ok => ok && setTimeout(() => SCENES.city().catch(() => {}), 1500));

  let started = false;
  const begin = async () => {
    if (started || bootFailed) return;
    started = true;
    audio.unlock();
    splash.classList.remove('ready');
    bootUi?.start();
    await cssReady;   // sin estilos, #scene no tiene tamaño y la escena se montaría en 0x0
    const ok = await router.go(first, Object.fromEntries(params));   // en la ciudad, go() ya arranca la bienvenida/premio diario
    if (!ok) { failBoot(); return; }   // no se pudo montar ninguna escena (ni la ciudad de respaldo): el preloader queda con el aviso
    bootUi?.done();
    splash.classList.add('hide');
    setTimeout(() => splash.remove(), 500);
  };
  if (skipSplash) { splash.classList.add('passive'); begin(); }
  else {
    splash.addEventListener('click', begin);
    addEventListener('keydown', function k(e) { if (e.key === 'Enter' || e.key === ' ') { removeEventListener('keydown', k); begin(); } });
    Promise.all([scenePrefetch, cssReady]).then(([ok]) => {
      if (!ok) { failBoot(); return; }
      bootUi?.ready();
      setTimeout(() => { if (!started) splash.classList.add('ready'); }, bootUi ? 300 : 0);   // deja ver la barra llena
    });
  }

  if ('serviceWorker' in navigator && location.protocol !== 'file:' && !params.has('nosw') && !['localhost', '127.0.0.1'].includes(location.hostname)) {
    navigator.serviceWorker.register('./sw.js').catch(e => console.warn('SW', e));
  }
  addEventListener('beforeinstallprompt', e => { e.preventDefault(); window.__pixeliaInstallPrompt = e; });
  window.__pixelia = { ctx, store, bus, economy, quests, data, chests, album, season, events, net, home };
}

boot();
