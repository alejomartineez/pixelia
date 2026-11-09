// Arranque, router de escenas y contexto compartido (ctx) que reciben todas las escenas.
//
// Orden de arranque: store.load (con la migración v3) → applyDebugParams → initChests → initAlbum → initSeason
// → initEvents → initExpedition → initThreats → initQuests → initUnlocks → initStory → HUD → (online) initSync → social.initSocial.
// Al entrar a la ciudad sale un solo modal "Mientras no estabas…" (scenes/arrival.js) con todo lo pendiente: regalo de
// bienvenida, "Los minijuegos se retiraron" (una vez, partidas de antes de la v3), amenazas que se resolvieron solas,
// premio del día y la función que se abre hoy (apertura escalonada, core/unlocks.js). Después, las subidas de nivel.
import { bus } from './core/bus.js';
import { store, todayStr } from './core/state.js';
import * as data from './core/data.js';
import * as economy from './core/economy.js';
import * as quests from './core/quests.js';
import { ui, toast, rewardModal, closeAllModals, hasModal, rewardArt, applyA11y } from './core/ui.js';
import { icon } from './core/icons.js';
import { themeOf } from './city/themes.js';
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
import { initRaiz } from './core/raiz.js';   // Núcleo de Raíz y Grieta (PLAN-QUIEBRE L1)
import { initAct1 } from './story/act1.js';   // jefes, faro y abordaje del Acto 1 (paso 6b)
import * as act1 from './story/act1.js';
import * as unlocks from './core/unlocks.js';      // apertura escalonada (Fase 5b)
import { isDesktop, initDesktop } from './core/desktop.js';
import { initSettings } from './core/settings.js';   // juego de PC (Tauri)
import * as story from './story/story.js';
import { initWorldLight } from './core/ambience.js';   // la luz como progreso (PLAN-QUIEBRE §J2)
import { initTips } from './core/tips.js';   // pistas al pasar el mouse (data-tip)      // historia "El Quiebre" (DESIGN-STORY.md)

const SCENES = {
  city: () => import('./scenes/city.js'),
  wardrobe: () => import('./scenes/wardrobe.js'),
  onboarding: () => import('./scenes/onboarding.js'),   // primera vez: elegir personaje, nombre y ciudad
  home: () => import('./scenes/home.js'),   // Mi Casa por dentro (también la de una amistad: {visit})
  expedition: () => import('./expedition/exp-scene.js'),   // Expedición (DESIGN-CORE.md §2)
  combat: () => import('./combat/combat-scene.js'),   // Combate táctico (DESIGN-COMBAT.md; ?scene=combat abre un encuentro de prueba)
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
      audio.enterScene(id, instance.music ?? (id === 'city' ? 'city' : id === 'expedition' ? 'expedition' : 'calm'));
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
  store, bus, ui, audio, data, economy, quests, router, hud, home, expedition, threats, story, act1,
  get state() { return store.state; },
  desktop: isDesktop,
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
const OVERLAYS = '.chx-open, .alb-open, .cx-placebar, .th-bar, .st-epic';   // .th-bar: defensa de una amenaza en curso · .st-epic: historia a pantalla completa
const cityReady = () => router.current === 'city' && !navigating && !router.visiting;
const cityIdle = () => cityReady() && !hasModal() && !document.querySelector(OVERLAYS) && !story.blocking();
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
// ¿Llegada de verdad o la app siguió abierta? Al abrir la app, al volver después de AWAY_MS en segundo plano o con la
// bienvenida de la temporada, lo pendiente sale en el modal "Mientras no estabas…". Con la app abierta (pasó la
// medianoche, volviste de una expedición, llegaron cuadrillas) sale un aviso liviano, sin modal ni ese título.
const AWAY_MS = 10 * 60e3;
let freshArrival = true, hiddenAt = 0;
addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') { hiddenAt = Date.now(); return; }
  if (hiddenAt && Date.now() - hiddenAt >= AWAY_MS) freshArrival = true;
  hiddenAt = 0;
});
async function arrivalSteps() {
  if (!(await waitIdle())) return false;
  const fresh = freshArrival;   // la primera pasada después de llegar se lo queda, aunque no haya nada que mostrar
  freshArrival = false;
  const first = firstSession;   // solo la llegada que sigue al onboarding
  firstSession = false;
  const parts = {};
  let any = false;
  const welcome = season.welcomeBackStatus();
  if (welcome) { parts.welcome = welcome; any = true; }
  if (v3Pending()) { const v = v3Lines(); parts.v3Lines = v.lines; parts.v3Gems = v.gems; any = true; }
  if (v4Pending()) { const v = v4Lines(); parts.v4Lines = v.lines; parts.v4Reward = v.reward; any = true; }
  // amenazas que se resolvieron solas (src/threats/threat-ui.js)
  if (threats.reportStatus()) {
    parts.threats = await import('./threats/threat-ui.js').then(m => m.reportParts(ctx)).catch(e => { console.warn('[threats] aviso', e); return null; });
    if (parts.threats) any = true;
  }
  const login = quests.loginStatus();
  if (login) { parts.login = login; any = true; }
  const unlock = unlocks.sessionUnlock();
  if (unlock) { parts.unlock = unlock; any = true; }
  if (!any) return true;
  parts.next = unlocks.nextUnlock();
  parts.firstDay = unlocks.playDay() === 1 && !welcome && !parts.v3Lines && !parts.v4Lines && !parts.threats;
  parts.light = !fresh && !welcome && !parts.v3Lines && !parts.v4Lines && !parts.firstDay;
  // primera sesión (plan §E7): después del personaje, el prólogo y el estilo no se apila otro modal; el premio del día
  // se cobra solo con un aviso y la cartógrafa presenta la ciudad
  if (first && !welcome && !parts.threats) parts.light = true;
  const arrival = await import('./scenes/arrival.js');
  await arrival.openArrival(ctx, parts, {
    claimWelcome: () => season.claimWelcomeBack(),
    claimLogin: () => { quests.claimLogin(); audio.sfx('buy'); },
  });
  hud.refresh();
  if (!(await waitIdle())) return false;
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
      // si se pidió otra llegada mientras esta esperaba y se rindió (60 s sin quedar libre), no se pierde
      if (arrivalAgain) { arrivalAgain = false; if (cityReady()) setTimeout(runArrival, 800); }
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
bus.on('season:welcome', () => { freshArrival = true; if (cityReady()) runArrival(); });
// cuadrillas de contactos que llegaron para tu amenaza (Fase 7b): se cuentan en "Mientras no estabas…"
bus.on('social:crews', () => { if (cityReady()) runArrival(); });

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
/** Lo que cuenta el aviso "Los minijuegos se retiraron" (va dentro de "Mientras no estabas…"). Lo da por visto. */
function v3Lines() {
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
  return { lines, gems: v.gems || 0 };
}

// ---------- Migración v4: fuera lo tierno (El Quiebre, plan §J7) ----------
const v4Only = () => { const v = store.state.v4; return !!v && !v.shown; };
const v5Pending = () => { const v = store.state.v5; return !!v && !v.shown; };
const v4Pending = () => v4Only() || v5Pending();
const V4_THEMES = { moderna: 'Ciudad Moderna', playa: 'Playa Tropical', bosque: 'Bosque', invierno: 'Invierno Nevado' };
const V4_ANIMALS = { gatito: 'el gato', zorrito: 'el zorro', conejito: 'el conejo', osito: 'el oso' };
/** Lo que cuenta el aviso "La isla cambió" (va dentro de "Mientras no estabas…"). Lo da por visto. */
function v4Lines() {
  const li = (ic, html) => `${icon(ic, 22)} <span>${html}</span>`;
  const lines = [], reward = {};
  const v5 = store.state.v5;
  if (v5Pending()) {   // v5: personajes serios y pueblos (plan §M)
    v5.shown = 1;
    lines.push(li('dress', 'Los personajes cambiaron: ahora hay <b>pueblos</b> (humanos, enanos, anuros, gente-zorro y orcos) y ropa de viaje. Tu ropa pasó a su equivalente; elegí tu pueblo en el <b>Equipaje</b>.'));
    if (v5.skiff) lines.push(li('car', 'Tu auto ahora es un <b>esquife</b> que flota con Céfiro y amarra en el muelle del Establo. Cada pieza pasó a la suya: casco, pintura, aparejo y proa.'));
    if (v5.coins || v5.gems) { lines.push(li('coin', 'Algunas prendas ahora son la misma: te devolvimos lo que pagaste por las repetidas.')); if (v5.coins) reward.coins = v5.coins; if (v5.gems) reward.gems = v5.gems; }
  }
  if (!v4Only()) { store.save(); return { lines, reward }; }
  const v = store.state.v4;
  v.shown = 1;
  store.save();
  if (v.from) lines.push(li('dress', `Los personajes ahora son solo personas: ${V4_ANIMALS[v.from] || 'tu personaje'} pasó a ser una persona con los mismos colores. Lo cambiás gratis en el <b>Equipaje</b> (el Vestidor de antes).`));
  else lines.push(li('dress', 'El Vestidor ahora se llama <b>Equipaje</b>.'));
  if (v.theme) lines.push(li('palette', `Tu ciudad pasó de ${V4_THEMES[v.theme] || 'su estilo'} a <b>${themeOf(store.state.city.theme).name}</b>. Hay estilos nuevos para elegir: Ceniza, Musgo, Bruma, Ocaso y Escarcha.`));
  if (v.coins) reward.coins = (reward.coins || 0) + v.coins;
  if (v.gems) reward.gems = (reward.gems || 0) + v.gems;
  if (v.coins || v.gems) lines.push(li('coin', 'Algunas prendas se retiraron (pelajes, ropa de animales y algún disfraz): te devolvimos lo que pagaste por ellas.'));
  return { lines, reward };
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
    unlocks._openAll();   // atajo de pruebas: Pase, Contactos y Eventos abiertos desde el principio
  }
}

function initProgression() {
  const steps = [['chests', chests.initChests], ['album', album.initAlbum], ['season', season.initSeason], ['events', events.initEvents], ['expedition', expedition.initExpedition], ['raiz', initRaiz], ['act1', initAct1], ['threats', threats.initThreats], ['quests', quests.initQuests], ['unlocks', unlocks.initUnlocks],
    ['home', () => home.initHome({ monumentDone: (s) => economy.monumentsDone(s) > 0 })], ['v3', grantV3Finds],
    ['story', () => story.initStory(ctx, { idle: () => cityIdle() && !arrival && !flushing && !pendingLevelUps.length, inCity: () => cityReady() && !document.body.classList.contains('no-hud') })],
    ['light', () => initWorldLight({ state: () => store.state, bus, rank: () => economy.townRank(store.state), markDirty: () => store.markDirty(),
      notify: (t) => setTimeout(() => toast(t, { icon: 'sparkle' }), 1800) })]];
  for (const [name, fn] of steps) { try { fn(); } catch (e) { console.error('[init] ' + name, e); } }
  // íconos pixel de cofres y sobres en los premios (costHtml)
  rewardArt.chest = (type, size) => chestIcon(type, size);
  rewardArt.pack = (size) => packIcon(size);
  rewardArt.chestName = (type) => chests.CHESTS[type]?.name || 'Cofre';
}

// preloader inline de index.html (window.__boot); en páginas de herramientas puede no existir
const bootUi = window.__boot || null;

let firstSession = false;   // se acaba de hacer el onboarding: la próxima llegada no abre modal
bus.on('onboarding:done', () => { firstSession = true; });
async function boot() {
  bootUi?.started();
  store.load();
  applyDebugParams();
  audio.connect(bus);   // stingers, trueno y noche por eventos (DESIGN-AUDIO.md)
  initSettings(ctx);   // gráficos, sonido, texto, escala de la interfaz y atajos (src/core/settings.js)
  initTips();
  initProgression();
  hud.init(document.getElementById('hud'), ctx);
  import('./online/telemetry.js').then(m => m.initTelemetry(ctx)).catch(e => console.warn('[telemetry]', e));
  // en el juego de PC no hay nada que instalar: ni tarjeta de instalación ni service worker
  if (isDesktop) initDesktop(ctx);
  else import('./scenes/install-card.js').then(m => m.initInstallCard(ctx)).catch(e => console.warn('[install]', e));
  economy.tick();
  setInterval(() => economy.tick(), 1000);
  // pasó la medianoche con la app abierta: el premio del día y lo que se abre salen en un aviso liviano
  let lastDay = todayStr();
  setInterval(() => { const d = todayStr(); if (d !== lastDay) { lastDay = d; if (cityReady()) runArrival(); } }, 30e3);

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

  if (!isDesktop && 'serviceWorker' in navigator && location.protocol !== 'file:' && !params.has('nosw') && !['localhost', '127.0.0.1'].includes(location.hostname)) {
    navigator.serviceWorker.register('./sw.js').catch(e => console.warn('SW', e));
  }
  addEventListener('beforeinstallprompt', e => { e.preventDefault(); window.__pixeliaInstallPrompt = e; });
  window.__pixelia = { ctx, store, bus, economy, quests, data, chests, album, season, events, net, home };
}

boot();
