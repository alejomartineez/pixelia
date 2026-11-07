// Arranque, router de escenas y contexto compartido (ctx) que reciben todas las escenas.
//
// Orden de arranque: store.load (con la migración v3) → applyDebugParams → initChests → initAlbum → initSeason
// → initEvents → initExpedition → initThreats → initQuests → HUD → (online) initSync → social.initSocial. Al entrar a la
// ciudad se muestran, de a uno y sin pisarse: regalo de bienvenida ("Bienvenida de vuelta") → "Los minijuegos se
// retiraron" (una sola vez, partidas de antes de la v3) → "Mientras no estabas" → premio diario → subidas de nivel.
import { bus } from './core/bus.js';
import { store } from './core/state.js';
import * as data from './core/data.js';
import * as economy from './core/economy.js';
import * as quests from './core/quests.js';
import { ui, toast, rewardModal, closeAllModals, hasModal, rewardArt, applyA11y } from './core/ui.js';
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
import * as expedition from './expedition/expedition.js';
import * as threats from './threats/threats.js';   // Amenazas (Fase 3)

const SCENES = {
  city: () => import('./scenes/city.js'),
  wardrobe: () => import('./scenes/wardrobe.js'),
  onboarding: () => import('./scenes/onboarding.js'),   // primera vez: elegir personaje, nombre y ciudad
  home: () => import('./scenes/home.js'),   // Mi Casa por dentro (también la de una amistad: {visit})
  expedition: () => import('./expedition/exp-scene.js'),   // Expedición (DESIGN-CORE.md §2)
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
};

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
const openAlbum = lazyUi(p => import('./album/album-ui.js').then(m => m.openAlbum(ctx, p || {})), 'No se pudo abrir Hallazgos');
const openSeasonPass = lazyUi(() => season.openSeasonPass(ctx), 'No se pudo abrir el Pase');
const openEvents = lazyUi(() => events.openEventsPanel(ctx), 'No se pudieron abrir los eventos');

export const ctx = {
  store, bus, ui, audio, data, economy, quests, router, hud, home, expedition, threats,
  get state() { return store.state; },
  openPanel,
  // progresión y social
  chests, album, season, events, net,
  social: null,      // módulo social.js cuando está cargado
  sync: null,        // módulo sync.js cuando hay modo online
  openChests, openAlbum, openSeasonPass, openEvents, openSocial, openAccount,
};

// ---------- Llegada a la ciudad: bienvenida → premio diario → subidas de nivel ----------
// .cx-placebar: colocando un edificio (pintando árboles, caminos…): un modal ahí taparía la barra y el próximo
// toque en "Colocar" caería sobre él. Las subidas de nivel esperan a que termine (city:placing {active:false}).
const OVERLAYS = '.chx-open, .alb-open, .cx-placebar, .th-bar';   // .th-bar: defensa de una amenaza en curso
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
  if (v3Pending()) {
    await openV3Notice();
    if (!(await waitIdle())) return false;
  }
  // amenazas que se resolvieron solas: un solo aviso "Mientras no estabas" (src/threats/threat-ui.js)
  if (threats.reportStatus()) {
    await import('./threats/threat-ui.js').then(m => m.openReport(ctx)).catch(e => console.warn('[threats] aviso', e));
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

// ---------- Migración v3: los minijuegos se retiraron (DESIGN-CORE.md §7.2.3) ----------
const v3Pending = () => { const v = store.state.v3; return !!v && !v.shown; };
/** Hallazgos de compensación (de 2★ o más): se acreditan al arrancar, después de initAlbum, una sola vez. */
function grantV3Finds() {
  const v = store.state.v3;
  if (!v || v.findsGiven || !(v.finds > 0)) return;
  v.findsGiven = 1;
  v.got = [];
  for (let i = 0; i < v.finds; i++) v.got.push(...(store.grant({ stickers: { n: 1, minStars: 2 } }, 'migration').stickers || []).map(x => x.id));
  store.markDirty();
}
const V3_NAMES = { joyeria: ['la Joyería', 'el Taller'], torre_bloques: ['la Torre de Bloques', 'el Dispensario'], garaje: ['el Garaje', 'el Establo'], pista: ['la Pista', 'la Casa de Expediciones'] };
async function openV3Notice() {
  const v = store.state.v3;
  v.shown = 1;
  store.save();
  const li = (ic, html) => `${icon(ic, 22)} <span>${html}</span>`;
  const lines = [];
  const conv = (v.conv || []).filter(id => V3_NAMES[id]).map(id => `${V3_NAMES[id][0]} ahora es <b>${V3_NAMES[id][1]}</b>`);
  if (conv.length) lines.push(li('hammer', `Tus edificios quedan donde estaban y con su nivel: ${conv.join(', ')}.`));
  if (v.expPlaced) lines.push(li('🧭', 'La <b>Casa de Expediciones</b> ya está en tu ciudad, cerca de la Municipalidad.'));
  else if (v.expFree) lines.push(li('🧭', 'La <b>Casa de Expediciones</b> te espera gratis en Construir.'));
  lines.push(li('monument', 'Cristales, ladrillos, tuercas y mapas pasaron a ser <b>mineral, piedra, madera y hierbas</b>: las obras a medio juntar siguen igual de cerca.'));
  lines.push(li('album', `Tu álbum ahora se llama <b>Hallazgos</b>, con todo lo que tenías${v.finds ? ` y ${v.finds === 1 ? 'un hallazgo nuevo' : v.finds + ' hallazgos nuevos'} de regalo` : ''}.`));
  lines.push(li('🎒', 'Los potenciadores que guardabas ahora son <b>equipo de expedición</b>.'));
  if (v.refund) lines.push(li('coin', `Tenías dos edificios que ahora serían el mismo: te devolvimos ${v.refund.toLocaleString('es-AR')} monedas.`));
  await rewardModal({
    title: 'Los minijuegos se retiraron',
    subtitle: 'Pixelia ahora gira alrededor de las expediciones: salir, traer lo que hace falta y volver a la ciudad.',
    lines,
    reward: v.gems ? { gems: v.gems } : {},
    buttons: [{ label: 'Vamos', value: 'ok', cls: 'primary' }],
    className: 'v3-notice',
  });
}

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
  const steps = [['chests', chests.initChests], ['album', album.initAlbum], ['season', season.initSeason], ['events', events.initEvents], ['expedition', expedition.initExpedition], ['threats', threats.initThreats], ['quests', quests.initQuests],
    ['home', () => home.initHome({ monumentDone: (s) => economy.monumentsDone(s) > 0 })], ['v3', grantV3Finds]];
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
  // donde el pellizco es de la cámara de la ciudad o de la expedición (#scene tiene touch-action:none; en iOS además gesture*)
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
