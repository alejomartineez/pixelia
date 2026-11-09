// Motor de historia (DESIGN-STORY.md, plan §D): estado, disparadores por el bus, cola de escenas y capítulos.
//
// state.story = { v, seen: {id: ms}, pages: {id: ms}, elements: [id], act, chapter, flags: {} } y state.introSeen.
// Las partidas viejas lo reciben en initStory sin subir la versión del guardado (defaultState trae story: {} y deepFill).
// Una partida que ya venía jugando (onboarded al crear la historia) no ve de golpe los contactos de lo que ya conoce:
// quedan dados por vistos y le llega un aviso corto que lleva al prólogo.
//
// Las escenas se encolan y salen cuando la ciudad está libre (hooks.idle: sin modales, sin llegada ni subidas de nivel
// pendientes). Las líneas de la cartógrafa al cobrar el tutorial (barks) piden estar en la ciudad y sin
// un aviso de premio ni una subida de nivel por salir; si el aviso llega con la línea a la vista, la hoja espera escondida.
// Lo que se ve en pantalla está en story-ui.js; la Bitácora, en scenes/panels-story.js.
import { bus } from '../core/bus.js';
import { store } from '../core/state.js';
import { isOpen } from '../core/unlocks.js';
import { SCENES, SCENE_BY_ID, ACTS, PAGES, PAGE_BY_ID, QUEST_LINES, AUTO_CLAIM, PROLOGUE, OLD_PROLOGUE, CHARACTERS, RAIZ_LINES } from './story-data.js';
import { raizState } from '../core/raiz.js';

const S = () => store.state;
let ctxRef = null, hooks = {};
let ui = null;               // story-ui.js (carga diferida)
const queue = [];            // ids de escenas esperando
const barks = [];            // {text, who}
let playing = false, pumpTimer = 0;
let raizUi = null;           // raiz-ui.js (la elección de extracción, carga diferida)

// ---------- Estado ----------
export function storyState(s = S()) {
  if (!s.story || typeof s.story !== 'object') s.story = {};
  const st = s.story;
  if (!st.seen || typeof st.seen !== 'object' || Array.isArray(st.seen)) st.seen = Object.fromEntries((Array.isArray(st.seen) ? st.seen : []).map(id => [id, 1]));
  if (!st.pages || typeof st.pages !== 'object') st.pages = {};
  if (!Array.isArray(st.elements)) st.elements = [];
  if (!st.flags || typeof st.flags !== 'object') st.flags = {};
  if (!st.act) st.act = 1;
  if (!st.chapter) st.chapter = 'prologo';
  return st;
}
export const hasSeen = (id, s = S()) => !!storyState(s).seen[id];
export function markSeen(id) {
  const st = storyState();
  if (st.seen[id]) return false;
  st.seen[id] = Date.now();
  store.markDirty();
  bus.emit('story:seen', { id });
  return true;
}
/** Texto de una línea con {name} y {city}. */
export function fill(text, s = S()) {
  return String(text).replace(/\{name\}/g, s.player?.name || '').replace(/\{city\}/g, s.player?.cityName || 'tu ciudad');
}

// ---------- Capítulos ----------
export function currentAct(s = S()) { return ACTS.find(a => a.id === storyState(s).act) || ACTS[0]; }
function computeChapter(s) {
  const act = currentAct(s);
  let ch = act.chapters[0];
  for (const c of act.chapters) { try { if (c.when(s)) ch = c; } catch {} }
  return ch;
}
/** {act, chapter, index, total, next} para la Bitácora. */
export function chapterInfo(s = S()) {
  const act = currentAct(s);
  const st = storyState(s);
  const index = Math.max(0, act.chapters.findIndex(c => c.id === st.chapter));
  return { act, chapter: act.chapters[index], index, total: act.chapters.length, next: act.chapters[index + 1] || null };
}
function updateChapter(quiet = false) {
  const s = S();
  const st = storyState(s);
  const act = currentAct(s);
  const ch = computeChapter(s);
  if (!ch || ch.id === st.chapter) return;
  // solo avanza (un capítulo no vuelve atrás aunque el rango baje en una prueba)
  const iNew = act.chapters.indexOf(ch), iOld = act.chapters.findIndex(c => c.id === st.chapter);
  if (iOld >= 0 && iNew <= iOld) return;
  st.chapter = ch.id;
  store.markDirty();
  bus.emit('story:chapter', { act: act.id, chapter: ch.id });
  if (!quiet) trigger('chapter:' + ch.id);
}

// ---------- Premios de historia (páginas y elementos; store.grant los acredita) ----------
/** Acredita una página del diario (una sola vez). Devuelve true si es nueva. */
export function addPage(id) {
  const st = storyState();
  if (!PAGE_BY_ID[id] || st.pages[id]) return false;
  st.pages[id] = Date.now();
  store.markDirty();
  bus.emit('story:page', { id, page: PAGE_BY_ID[id] });
  return true;
}
export function addElement(id) {
  const st = storyState();
  if (st.elements.includes(id)) return false;
  st.elements.push(id);
  store.markDirty();
  bus.emit('story:element', { id });
  if (st.elements.length === 1) trigger('element:first');
  return true;
}

// ---------- Disparadores ----------
/** Encola las escenas que responden a una clave (las que ya se vieron, no). */
export function trigger(key) {
  for (const sc of SCENES) {
    if (!sc.trigger?.includes(key)) continue;
    if (hasSeen(sc.id) || queue.includes(sc.id)) continue;
    queue.push(sc.id);
  }
  for (const p of PAGES) if (p.trigger === key && addPage(p.id)) toast(`Página nueva del diario: ${p.title}`, 'journal');
  schedule();
}
/** Encola una escena por id (aunque ya se haya visto si force). */
export function play(id, { force = false } = {}) {
  if (!SCENE_BY_ID[id]) return false;
  if (!force && (hasSeen(id) || queue.includes(id))) return false;
  queue.push(id);
  schedule();
  return true;
}
function toast(text, ic) { try { ctxRef?.ui.toast(text, { icon: ic, type: 'good' }); } catch {} }

// ---------- Cola ----------
const loadUi = () => (ui ? Promise.resolve(ui) : import('./story-ui.js').then(m => (ui = m)));
function schedule(ms = 400) {
  if (pumpTimer) return;
  pumpTimer = setTimeout(() => { pumpTimer = 0; pump(); }, ms);
}
const autoOn = () => !!S().onboarded && !hooks.paused?.();
let barkUntil = 0;   // una línea suelta se deja leer un rato antes de la siguiente
async function pump() {
  if (playing) return;
  if (!queue.length && !barks.length && !choicePending()) return;
  if (!autoOn()) { schedule(1500); return; }
  // escenas primero: con la ciudad libre (sin menús, llegada ni subidas de nivel) y nada de la historia en pantalla
  if (queue.length && (hooks.idle?.() ?? true) && !ui?.busy()) {
    const id = queue.shift();
    const sc = SCENE_BY_ID[id];
    if (!sc || hasSeen(id)) { schedule(50); return; }
    playing = true;
    try {
      markSeen(id);   // vista al aparecer: si se recarga a la mitad, no se repite
      if (sc.grant) store.grant(sc.grant, 'story');
      let res;
      if (sc.epic) {
        // pantalla completa desde la cola (con las que encadena: sc.chain); la llegada espera mientras tanto
        const list = [sc, ...(sc.chain || []).map(c => SCENE_BY_ID[c]).filter(Boolean)];
        for (const c of list.slice(1)) { markSeen(c.id); if (c.grant) store.grant(c.grant, 'story'); }
        epicOn = true;
        try { res = await (await loadUi()).showEpic(ctxRef, list); } finally { epicOn = false; }
      } else res = await (await loadUi()).showScene(ctxRef, sc);
      // se fue de la ciudad con la hoja abierta: vuelve a salir al regresar
      if (res === 'away') { delete storyState().seen[id]; queue.unshift(id); return; }
      bus.emit('story:scene', { id, result: res });
      if (res === 'action' && sc.action?.run === 'prologue') await playPrologue({ replay: true });
      if (res === 'action' && sc.action?.run === 'intro') playIntro();
    } catch (e) { console.error('[story] escena', id, e); }
    finally { playing = false; schedule(600); }
    return;
  }
  // la elección de extracción en la mina (L1): después de las escenas, con la ciudad libre
  if (!queue.length && choicePending() && (hooks.idle?.() ?? true) && !ui?.busy()) {
    playing = true;
    try {
      raizUi ||= await import('./raiz-ui.js');
      await raizUi.openExtraction(ctxRef, { first: !raizState().mode });
    } catch (e) { console.error('[story] elección de la Raíz', e); }
    finally { playing = false; schedule(600); }
    return;
  }
  // con un aviso de premio encima, la línea que estaba a la vista se pausa: la próxima le da tiempo al volver
  if (ui?.held?.()) barkUntil = Math.max(barkUntil, Date.now() + 2500);
  // líneas de la cartógrafa: alcanza con estar en la ciudad (no esperan a que se cierren los menús, sí a los avisos de premio)
  if (barks.length && Date.now() >= barkUntil && (hooks.inCity?.() ?? true) && !ui?.busy()) {
    const b = barks.shift();
    try { (await loadUi()).bark(ctxRef, b); } catch (e) { console.warn('[story] bark', e); }
    barkUntil = Date.now() + Math.min(b.ms || 4000, 4000);
  }
  if (queue.length || barks.length || choicePending()) schedule(queue.length || choicePending() ? 700 : Math.max(300, barkUntil - Date.now()));
}
/** Hay una elección de extracción abierta (se encontró el Núcleo o se volvió a la mina) y la escena del Núcleo ya pasó. */
function choicePending() {
  try { const r = raizState(); return !!(r.found && r.pending) && (!!r.mode || hasSeen('nucleo_1')); } catch { return false; }
}
/** Lo que dice Vera después de perder otra vez contra un jefe (la escena de la revancha sale una sola vez). */
const BOSS_RETRY = {
  banado_bestia: 'Otra vez abajo. Cada vuelta se cansa más: la próxima la tenemos.',
  costa_capitana: 'Siguen en el borde. Cortá la pasarela primero y quedan pocos.',
  any: 'La próxima sale mejor.',
};
/** Una línea suelta de la cartógrafa (no bloquea). */
export function say(text, ms = 4800) {
  if (!text) return;
  barks.push({ who: 'cartografa', text: fill(text), ms: Math.max(ms, 3000 + text.length * 30) });
  while (barks.length > 2) barks.shift();
  schedule(300);
}

/**
 * La llegada con Vera (plan §M4, reemplaza al prólogo de texto): a pantalla completa sobre la ciudad, entre el nombre y
 * el estilo de la ciudad. Devuelve una promesa que resuelve al terminar o saltearlo. replay: desde la Bitácora (no
 * acredita de nuevo ni marca nada).
 */
let epicOn = false;
/** Hay una escena a pantalla completa (o cargándose): la llegada y las subidas de nivel esperan. */
export const blocking = () => epicOn;
export async function playPrologue({ replay = false } = {}) {
  epicOn = true;   // antes de cargar la interfaz: la llegada a la ciudad no se cuela en el medio
  playing = true;
  try {
    const m = await loadUi();
    const scenes = PROLOGUE.map(id => SCENE_BY_ID[id]);
    if (!replay) for (const sc of scenes) { markSeen(sc.id); if (sc.grant) store.grant(sc.grant, 'story'); }
    const res = await m.showEpic(ctxRef, scenes);
    bus.emit('story:prologue', { replay, result: res });
    return res;
  } finally { playing = false; epicOn = false; if (!replay) { bus.emit('story:prologueDone', {}); } schedule(800); }
}
/** La cinemática "El Quiebre" (src/scenes/intro.js), de nuevo: al terminar vuelve a la ciudad propia. */
export function playIntro() {
  const r = ctxRef?.router;
  if (!r) return Promise.resolve(false);
  return r.go('intro', { replay: 1, back: 'city' });
}
/** Vuelve a mostrar una escena ya vista (Bitácora). */
export async function replay(id) {
  const sc = SCENE_BY_ID[id];
  if (!sc) return null;
  if (PROLOGUE.includes(id) || OLD_PROLOGUE.includes(id)) return playPrologue({ replay: true });
  const m = await loadUi();
  return sc.epic ? m.showEpic(ctxRef, [sc]) : m.showScene(ctxRef, sc, { replay: true });
}

/** Línea de la cartógrafa al cumplir una misión del tutorial. */
function questBark(id) {
  const text = QUEST_LINES[id];
  if (!text) return;
  barks.push({ who: 'cartografa', text: fill(text), ms: 4200 + text.length * 30 });
  while (barks.length > 2) barks.shift();   // si se cumplen varias juntas, se oye la última
  schedule(300);
}

// ---------- Cobro automático del tutorial (t1–t20, plan §E4) ----------
let claiming = false;
function autoClaim() {
  if (claiming || !ctxRef || !(hooks.inCity?.() ?? true)) return;
  const Q = ctxRef.quests;
  claiming = true;
  try {
    for (let i = 0; i < 6; i++) {
      const q = Q.mainQuest();
      if (!q || !q.done || !AUTO_CLAIM.includes(q.id)) break;
      const reward = Q.claimMain({ auto: true });
      if (!reward) break;
      claimFx(q, reward);
    }
  } catch (e) { console.error('[story] cobro automático', e); }
  finally { claiming = false; }
}

/** Aviso del cobro automático: el premio vuela desde la tarjeta de la misión. */
function claimFx(q, reward) {
  const ui0 = ctxRef.ui;
  try { ctxRef.audio.sfx('done'); } catch {}
  ui0.toast(`Misión cumplida: ${q.title}`, { icon: 'quest', type: 'good' });
  const el = document.querySelector('#hud:not(.hidden) .hud-quest');
  const r = el?.getBoundingClientRect();
  if (!r || !r.width) return;
  const x = r.left + r.width / 2, y = r.top + r.height / 2;
  if (reward.coins) ui0.flyCurrency(x, y, 'coins', Math.min(8, 3 + Math.round(reward.coins / 60)));
  if (reward.gems) setTimeout(() => ui0.flyCurrency(x, y, 'gems', Math.min(4, 1 + Math.round(reward.gems / 2))), 140);
}

// ---------- Arranque ----------
/**
 * hooks: { idle(): la ciudad está libre para una escena, inCity(): estamos en la ciudad propia, paused(): no mostrar }
 */
export function initStory(ctx, h = {}) {
  ctxRef = ctx; hooks = h;
  const s = S();
  const st = storyState(s);
  if (!st.v) {
    st.v = 1;
    // partida que ya venía jugando: lo que ya conoce no se le explica de nuevo, y un aviso lleva al prólogo
    if (s.onboarded) {
      s.introSeen = true;
      const known = {
        c_ciudad: true,
        c_expedicion: safe(() => isOpen('expedicion')),
        c_taller: s.city.buildings.some(b => b.id === 'taller'),
        c_rango: !!s.quests?.done?.t13 || rankOf(s) >= 2,
        c_amenazas: safe(() => isOpen('amenazas')),
      };
      for (const [id, on] of Object.entries(known)) if (on) st.seen[id] = 1;
      st.veteran = 1;
      queueMicrotask(() => trigger('story:veteran'));
    }
    store.markDirty();
  }
  if (s.introSeen === undefined) s.introSeen = !!s.onboarded;
  updateChapter(true);

  // bus → disparadores
  bus.on('reward:page', ({ id } = {}) => addPage(id));
  bus.on('reward:element', ({ id } = {}) => addElement(id));
  bus.on('unlocks:changed', ({ id } = {}) => { if (id) trigger('unlock:' + id); });
  bus.on('building:built', ({ b } = {}) => { if (b?.id) trigger('built:' + b.id); });
  bus.on('town:rankup', ({ rank } = {}) => { trigger('rank:' + rank); updateChapter(); });
  bus.on('threat:announced', () => trigger('threat:announced'));
  bus.on('expedition:zone', ({ region } = {}) => trigger('zone:' + region));
  bus.on('expedition:region', ({ region } = {}) => trigger('region:' + region));
  // los jefes (paso 6b): ganar dispara su escena (boss:<enc>) y perder, la de la revancha (bosslost:<enc>)
  bus.on('combat:won', ({ enc, kind } = {}) => { trigger('combat:first'); trigger('combat:won'); if (kind === 'jefe' && enc) { trigger('boss:' + enc); updateChapter(); } });
  bus.on('combat:lost', ({ enc, kind } = {}) => {
    trigger('combat:first');
    if (kind !== 'jefe' || !enc) return;
    if (hasSeen(enc === 'banado_bestia' ? 'bestia_lost' : 'abordaje_lost')) say(BOSS_RETRY[enc] || BOSS_RETRY.any);
    else trigger('bosslost:' + enc);
  });
  bus.on('expedition:lair', ({ enc } = {}) => { if (enc) trigger('lair:' + enc); });
  bus.on('story:faro', () => { trigger('story:faro'); updateChapter(); });
  bus.on('abordaje:arrive', () => trigger('abordaje:arrive'));
  bus.on('quest:claimed', ({ id } = {}) => { questBark(id); trigger('quest:' + id); updateChapter(); });
  bus.on('quests:changed', () => setTimeout(autoClaim, 250));
  // la Raíz (L1): el Núcleo, la elección, la Grieta que Vera nota y la obra que la cose
  bus.on('raiz:found', ({ first } = {}) => { if (first) trigger('raiz:found'); else schedule(900); });
  bus.on('raiz:choice', ({ mode, prev } = {}) => { if (!prev) trigger('raiz:chosen'); else if (mode !== prev) say(RAIZ_LINES[mode]); if (!prev) say(RAIZ_LINES[mode]); });
  bus.on('world:grieta', ({ to } = {}) => { for (const t of [25, 50, 75]) if (to >= t) trigger('grieta:' + t); });
  bus.on('raiz:sutura', () => say(RAIZ_LINES.sutura));
  bus.on('raiz:revisit', ({ on } = {}) => { if (on) say(RAIZ_LINES.revisit); });
  bus.on('stats:changed', ({ key } = {}) => { if (key === 'threats') setTimeout(autoClaim, 250); });
  bus.on('scene:changed', ({ id, params } = {}) => {
    if (id === 'city' && !params?.visit) { setTimeout(autoClaim, 700); updateChapter(); schedule(1200); }
    else ui?.leave();   // la hoja de la cartógrafa es de la ciudad: no queda encima de otra escena
  });
  // red de seguridad: objetivos absolutos (población, rango) que cambian sin evento propio
  setInterval(() => { autoClaim(); updateChapter(); if (choicePending()) schedule(); }, 4000);
}
const safe = (fn) => { try { return !!fn(); } catch { return false; } };
const rankOf = (s) => s.city?.buildings?.find(b => b.id === 'castillo')?.level || 1;

/** El primer contacto de la ciudad: después del prólogo y del estilo (onboarding.js lo pide). */
export function cityIntro() { trigger('story:city'); }

/** Para la Bitácora: escenas vistas en orden, con su personaje. */
export function seenScenes(s = S()) {
  const st = storyState(s);
  return SCENES.filter(sc => st.seen[sc.id]).sort((a, b) => (st.seen[a.id] || 0) - (st.seen[b.id] || 0)).map(sc => ({ ...sc, char: CHARACTERS[sc.who] }));
}
/** Solo pruebas: estado de la cola. */
export const _debug = { get queue() { return queue.slice(); }, get barks() { return barks.slice(); }, get playing() { return playing; }, pump, autoClaim };
