// HUD de la ciudad, en 3 capas (DESIGN-CORE.md §10, Fase 5b): lo de hoy, lo de la temporada y lo de largo plazo.
//  arriba:      perfil (nivel, nombre, xp; abre Ajustes) · monedas y gemas
//  izquierda:   [largo plazo] rango y época (abre "Tu ciudad") · población / felicidad / constructoras · efectos activos ·
//               misión actual · [hoy] chips: amenaza que viene, diarias y "N edificios para renovar"
//  derecha:     [hoy] Expedición (con las provisiones), Cofres · [temporada] Pase y eventos en un botón ·
//               [largo plazo] Obras (monumentos), Hallazgos
//  abajo:       Vestidor · Construir (al centro) · Contactos
// Metas: ≤ 14 controles y ≤ 4 globitos a la vez (los de más prioridad; ver BADGE_ORDER). Cada función aparece cuando se
// abre (apertura escalonada, unlocks.js). Los globitos se refrescan con eventos del bus y cada 30 s; los números, cada segundo.
import { bus } from './bus.js';
import { store } from './state.js';
import { icon } from './icons.js';
import { esc, progressHtml } from './ui.js';
import { audio } from './audio.js';
import { population, happiness, buildersBusy, fmtNum, fmtTime, rankStatus, monumentStatus, renovateInfo, cityEra } from './economy.js';
import { MONUMENT_IDS, eraDef } from './data.js';
import { mainQuest, dailyQuests, dailyBonusStatus, claimableCount } from './quests.js';
import { isOpen } from './unlocks.js';
import { chestBadge, activeBoosts } from '../chests/chests.js';
import { albumBadge } from '../album/album.js';
import { seasonBadge, seasonInfo, fmtLeft } from '../season/season.js';
import { activeEvents, eventBannerInfo } from '../season/events.js';
import { chestIcon } from '../season/season-ui-common.js';
import { expeditionBadge, expState } from '../expedition/expedition.js';
import { threatStatus } from '../threats/threats.js';
import { chipText } from '../threats/threat-ui.js';

export const MAX_BADGES = 4;
// prioridad de los globitos: si hay más de 4 con algo, se ven los primeros
export const BADGE_ORDER = ['quests', 'expedition', 'rank', 'pass', 'chests', 'works', 'album', 'social'];

let root = null, ctxRef = null, timer = null, badgeTimer = null;
const safe = (fn, def) => { try { return fn(); } catch (e) { console.error(e); return def; } };
/** Tiempo corto para los chips: "1h 05m" · "29m" · "45s" */
function shortTime(ms) {
  const sec = Math.max(0, Math.ceil(ms / 1000));
  if (sec >= 3600) return fmtTime(sec);
  if (sec >= 60) return Math.ceil(sec / 60) + 'm';
  return sec + 's';
}
const show = (el, on) => { if (el && (el.style.display === 'none') === !!on) el.style.display = on ? '' : 'none'; };

function render() {
  const s = store.state;
  const xp = store.xpProgress();
  root.innerHTML = `
    <div class="hud-top">
      <button class="hud-profile" data-act="settings" aria-label="Tu perfil y ajustes" title="Perfil y ajustes">
        <span class="lvl-star">${icon('star', 40)}<b data-hud="level">${xp.level}</b></span>
        <span class="hud-name">
          <b data-hud="name">${esc(s.player.name)}</b>
          <span class="hud-xp" data-hud="xp">${progressHtml(xp.pct, 'xp')}</span>
        </span>
        <span class="hud-gear">${icon('gear', 18)}</span>
      </button>
      <div class="hud-res">
        <div class="pill" data-hud="coins">${icon('coin', 20)}<b>${fmtNum(s.coins)}</b></div>
        <div class="pill gem" data-hud="gems">${icon('gem', 20)}<b>${fmtNum(s.gems)}</b></div>
      </div>
    </div>
    <div class="hud-left">
      <button class="hud-rank" data-act="rank" data-hud="rank" aria-label="Rango y época de tu ciudad"></button>
      <div class="hud-stats">
        <div class="pill sm" data-hud="pop" title="Población">${icon('people', 16)}<b></b></div>
        <div class="pill sm" data-hud="happy" title="Felicidad">${icon('smile', 16)}<b></b></div>
        <div class="pill sm" data-hud="builders" title="Constructoras">${icon('hammer', 16)}<b></b></div>
      </div>
      <div class="hud-fx" data-hud="fx"></div>
      <button class="hud-quest" data-act="quests"></button>
      <div class="hud-today" data-layer="hoy">
        <button class="hud-chip threat" data-act="threat" data-hud="threat" aria-label="Amenaza de la temporada" style="display:none"></button>
        <button class="hud-chip daily" data-act="daily" data-hud="daily" aria-label="Misiones diarias" style="display:none"></button>
        <button class="hud-chip renov" data-act="renovate" data-hud="renov" aria-label="Edificios para renovar" style="display:none"></button>
      </div>
    </div>
    <div class="hud-rail">
      <div class="rail-group" data-layer="hoy">
        <button class="rail-btn exp" data-act="expedition" data-hud="prov" aria-label="Expedición" style="display:none">${icon('🧭', 30)}<span>Expedición</span><em class="rail-tag" data-hud="provtag"></em><i class="badge" data-badge="expedition"></i></button>
        <button class="rail-btn" data-act="chests" aria-label="Cofres" style="display:none">${chestIcon('madera', 34)}<span>Cofres</span><i class="badge" data-badge="chests"></i></button>
      </div>
      <div class="rail-group" data-layer="temporada">
        <button class="rail-btn pass" data-act="pass" aria-label="Temporada: Pase y eventos" style="display:none"><span class="rail-ic" data-hud="passic">${icon('sparkle', 30)}</span><span>Temporada</span><em class="rail-tag" data-hud="passlv"></em><i class="rail-ev" data-hud="evdot"></i><i class="badge" data-badge="pass"></i></button>
      </div>
      <div class="rail-group" data-layer="largo">
        <button class="rail-btn works" data-act="works" data-hud="works" aria-label="Obras: monumentos" style="display:none">${icon('monument', 30)}<span>Obras</span><i class="badge" data-badge="works"></i></button>
        <button class="rail-btn" data-act="album" aria-label="Hallazgos" style="display:none">${icon('album', 30)}<span>Hallazgos</span><i class="badge" data-badge="album"></i></button>
      </div>
    </div>
    <nav class="hud-bottom">
      <button class="hud-btn" data-act="wardrobe">${icon('wardrobe', 30)}<span>Vestidor</span></button>
      <button class="hud-btn big" data-act="build">${icon('hammer', 38)}<span>Construir</span></button>
      <button class="hud-btn" data-act="social" style="display:none">${icon('people', 30)}<span>Contactos</span><i class="badge" data-badge="social"></i></button>
    </nav>`;
  // el globito de las misiones va en la tarjeta de la misión actual (ya no hay botón Misiones abajo)
  lastFx = lastEv = lastPass = lastQuest = lastRank = lastExp = lastThreat = lastDaily = lastRenov = null;
  lastGates = ''; rankReady = false;
  refreshDynamic();
  refreshBadges();
}

function setText(sel, txt) { const el = root.querySelector(`[data-hud="${sel}"] b`); if (el && el.textContent !== txt) el.textContent = txt; }
function setBadge(key, n) {
  const el = root?.querySelector(`[data-badge="${key}"]`);
  if (!el) return;
  n = Math.max(0, Math.floor(Number(n) || 0));
  const txt = key === 'rank' ? '!' : n > 99 ? '99+' : String(n);
  if (el.textContent !== txt) el.textContent = txt;
  el.style.display = n ? '' : 'none';
}

// ---------- Efectos activos (poción, perfume, evento de producción) ----------
let lastFx = null;
function refreshFx() {
  const el = root.querySelector('[data-hud="fx"]');
  if (!el) return;
  const now = Date.now();
  const chips = [];
  const b = safe(() => activeBoosts(now), {});
  if (b.prod) chips.push(`<button class="fx-chip gold" data-act="backpack" aria-label="Poción de producción">${icon('🧪', 16)}<b>x${b.prod.mult}</b><small>${shortTime(b.prod.leftMs)}</small></button>`);
  if (b.happy) chips.push(`<button class="fx-chip primary" data-act="backpack" aria-label="Felicidad al máximo">${icon('🌸', 16)}<b>Feliz</b><small>${shortTime(b.happy.leftMs)}</small></button>`);
  for (const e of safe(() => activeEvents(now), [])) {
    const m = e.mult?.production;
    if (m && m > 1) chips.push(`<button class="fx-chip mint" data-act="events" aria-label="${esc(e.title)}">${icon(e.emoji || '⚡', 16)}<b>x${String(m).replace('.', ',')}</b><small>${fmtLeft(e.endsInMs)}</small></button>`);
  }
  const html = chips.join('');
  if (html !== lastFx) { lastFx = html; el.innerHTML = html; el.style.display = html ? '' : 'none'; }
}

let lastEv = null, lastPass = null, lastQuest = null, lastRank = null;

// ---------- Largo plazo: rango y época (emblema + nombre + época + Encanto; "!" si se puede subir) ----------
let rankReady = false;
function refreshRank() {
  const el = root.querySelector('[data-hud="rank"]');
  if (!el) return;
  const st = safe(() => rankStatus(), null);
  if (!st) { el.style.display = 'none'; return; }
  const ready = st.allOk && st.levelOk;
  if (rankReady !== !!ready) { rankReady = !!ready; badgeCounts.rank = ready ? 1 : 0; applyBadges(); }
  const era = safe(() => eraDef(cityEra()), null);
  const key = `${st.rank}|${st.charm}|${st.stars}|${ready}|${era?.name}`;
  if (key === lastRank) return;
  lastRank = key;
  let stars = '';
  for (let i = 0; i < 5; i++) stars += icon(i < st.stars ? 'star' : 'starOff', 12);
  el.innerHTML = `<span class="hud-rank-ic">${icon(st.def.emoji, 26)}</span><span class="hud-rank-txt"><b>${esc(st.def.name)}</b>`
    + `<small>${era ? `<span class="hud-era">${esc(era.name)}</span>` : ''}${icon('sparkle', 12)}${fmtNum(st.charm)}<span class="hud-rank-stars">${stars}</span></small></span>`
    + `<i class="badge" data-badge="rank"></i>`;
  el.classList.toggle('ready', ready);
  el.title = ready ? `¡Ya podés subir a ${st.next.name}!` : `Rango ${st.def.name}${era ? ` · época de ${era.name}` : ''} · ${st.charm} de Encanto`;
  applyBadges();
}

// ---------- Temporada: Pase + eventos ----------
function refreshSeason() {
  const btn = root.querySelector('[data-act="pass"]');
  if (!btn) return;
  show(btn, safe(() => isOpen('pase'), true));
  const ev = safe(() => isOpen('eventos') ? eventBannerInfo() : null, null);
  const key = ev ? `${ev.key}|${ev.endsIn}|${ev.count}` : '';
  if (key !== lastEv) {
    lastEv = key;
    const dot = root.querySelector('[data-hud="evdot"]');
    dot.innerHTML = ev ? icon(ev.emoji, 16) : '';
    dot.style.display = ev ? '' : 'none';
    btn.classList.toggle('live', !!ev);
  }
  const si = safe(() => seasonInfo(), null);
  const pk = si ? `${si.theme?.id}|${si.level}|${key}` : '';
  if (pk !== lastPass && si) {
    lastPass = pk;
    root.querySelector('[data-hud="passic"]').innerHTML = icon(si.theme?.emoji || 'sparkle', 30);
    root.querySelector('[data-hud="passlv"]').textContent = 'Nv ' + si.level;
    btn.style.setProperty('--ec', ev?.color || si.theme?.accent || '');
    btn.style.setProperty('--ecd', ev?.dark || si.theme?.dark || '');
    btn.title = `${si.theme?.name || 'Pase de Temporada'} · nivel ${si.level}` + (ev ? ` · ${ev.title}, termina en ${ev.endsIn}` : '');
  }
}

// ---------- Hoy: amenaza, diarias, renovar ----------
let lastThreat = null, lastDaily = null, lastRenov = null, threatAt = 0, threatSt = null;
function refreshToday() {
  const now = Date.now();
  // amenaza (el estado de preparación es caro: cada 2 s o cuando algo cambia)
  if (now - threatAt > 2000) { threatAt = now; threatSt = safe(() => isOpen('amenazas') || store.state.threats?.sim ? threatStatus() : null, null); }
  const tEl = root.querySelector('[data-hud="threat"]');
  const st = threatSt && threatSt.visible ? threatSt : null;
  const tk = st ? [st.t.id, st.phase, st.when, !!st.active].join('|') : '';
  if (tk !== lastThreat) {
    lastThreat = tk;
    show(tEl, !!st);
    if (st) {
      tEl.className = 'hud-chip threat' + (st.phase === 'hoy' ? ' today' : st.phase === 'señales' ? ' signs' : '');
      tEl.innerHTML = `${icon(st.def.icon, 18)}<span>${esc(chipText(st))}</span>`;
      tEl.title = `${st.name} · ${st.when}`;
    }
  }
  // diarias
  const dEl = root.querySelector('[data-hud="daily"]');
  const dOpen = safe(() => isOpen('diarias'), false);
  const list = dOpen ? safe(() => dailyQuests(), []) : [];
  const done = list.filter(q => q.done).length;
  const bonus = dOpen ? safe(() => dailyBonusStatus(), null) : null;
  const dk = dOpen ? `${done}/${list.length}|${list.filter(q => q.done && !q.claimed).length}|${bonus?.ready}|${bonus?.claimed}` : '';
  if (dk !== lastDaily) {
    lastDaily = dk;
    show(dEl, dOpen && list.length > 0);
    if (dOpen) {
      const all = list.length && list.every(q => q.claimed) && (!bonus || bonus.claimed);
      const ready = list.some(q => q.done && !q.claimed) || bonus?.ready;
      dEl.className = 'hud-chip daily' + (ready ? ' ready' : all ? ' all' : '');
      dEl.innerHTML = `${icon(all ? 'check' : 'calendar', 18)}<span>${all ? 'Diarias al día' : `Diarias ${done}/${list.length}`}</span>`;
    }
  }
  // edificios para renovar a la época de la ciudad (aviso fuera del festejo de cambio de época)
  const rEl = root.querySelector('[data-hud="renov"]');
  const n = safe(() => store.state.city.buildings.filter(b => !b.buildEnd && renovateInfo(b)).length, 0);
  if (String(n) !== lastRenov) {
    lastRenov = String(n);
    show(rEl, n > 0);
    if (n > 0) rEl.innerHTML = `${icon('hammer', 18)}<span>${n} ${n === 1 ? 'edificio para renovar' : 'edificios para renovar'}</span>`;
  }
}

function refreshDynamic() {
  if (!root) return;
  const s = store.state;
  setText('coins', fmtNum(s.coins));
  setText('gems', fmtNum(s.gems));
  setText('pop', fmtNum(population()));
  const hp = happiness();
  setText('happy', hp.pct + '%');
  root.querySelector('[data-hud="happy"]')?.classList.toggle('boosted', !!hp.boosted);
  setText('builders', `${s.builders - buildersBusy()}/${s.builders}`);
  refreshGates();
  refreshExpedition();
  const xp = store.xpProgress();
  const lv = root.querySelector('[data-hud="level"]'); if (lv && lv.textContent !== String(xp.level)) lv.textContent = xp.level;
  const nm = root.querySelector('[data-hud="name"]'); if (nm && nm.textContent !== s.player.name) nm.textContent = s.player.name;
  const bar = root.querySelector('[data-hud="xp"] .progress i'); if (bar) bar.style.width = (xp.pct * 100).toFixed(1) + '%';
  const q = mainQuest();
  const qEl = root.querySelector('.hud-quest');
  if (qEl) {
    if (!q) qEl.style.display = 'none';
    else {
      qEl.style.display = '';
      qEl.classList.toggle('done', q.done);
      const html = `${icon(q.done ? 'gift' : 'quest', 24)}<span><b>${esc(q.title)}</b><small>${q.done ? '¡Tocá para cobrar!' : esc(q.text)}</small>${q.done ? '' : progressHtml(q.progress / q.goal.count)}</span><i class="badge" data-badge="quests"></i>`;
      if (html !== lastQuest) { lastQuest = html; qEl.innerHTML = html; applyBadges(); }
    }
  }
  refreshFx();
  refreshSeason();
  refreshRank();
  refreshToday();
}

// ---------- Globitos: como mucho MAX_BADGES a la vez, por prioridad ----------
let badgeCounts = {};
/** Qué globitos se ven: {key: n} (0 = escondido). Lo usa la prueba e2e. */
export function badgeState() {
  const vis = (key) => {
    const el = root?.querySelector(`[data-badge="${key}"]`);
    if (!el) return false;
    const btn = el.closest('button');
    return !!btn && btn.style.display !== 'none' && !btn.closest('[style*="display: none"]');
  };
  const out = {};
  let shown = 0;
  for (const k of BADGE_ORDER) {
    const n = vis(k) ? badgeCounts[k] || 0 : 0;
    out[k] = n > 0 && shown < MAX_BADGES ? (shown++, n) : 0;
  }
  return { want: { ...badgeCounts }, shown: out };
}
function applyBadges() {
  if (!root) return;
  const { shown } = badgeState();
  for (const k of BADGE_ORDER) setBadge(k, shown[k]);
}
function refreshBadges() {
  if (!root) return;
  badgeCounts = {
    quests: safe(() => claimableCount(), 0),
    expedition: safe(() => expeditionBadge(), 0),
    rank: rankReady ? 1 : 0,
    pass: safe(() => isOpen('pase') ? seasonBadge() : 0, 0),
    chests: safe(() => chestBadge(), 0),
    works: safe(() => worksBadge(), 0),
    album: safe(() => albumBadge(), 0),
    social: safe(() => isOpen('contactos') ? ctxRef?.social?.socialBadge?.() || 0 : 0, 0),
  };
  applyBadges();
}
/** Obras: el globito cuenta las etapas que se pueden empezar. */
function worksBadge() {
  const now = Date.now();
  return MONUMENT_IDS.filter(id => { const st = monumentStatus(id, store.state, now); return st.unlocked && st.can.ok; }).length;
}
/** Apertura escalonada: cada botón aparece cuando se abre su función (unlocks.js, DESIGN-CORE.md §6.2). */
let lastGates = '';
function refreshGates() {
  const g = {
    works: safe(() => isOpen('obras'), false),
    album: safe(() => isOpen('hallazgos'), false),
    chests: safe(() => isOpen('cofres'), false),
    social: safe(() => isOpen('contactos'), false),
  };
  const key = JSON.stringify(g);
  if (key === lastGates) return;
  lastGates = key;
  for (const [act, on] of Object.entries(g)) show(root.querySelector(`[data-act="${act}"]`), on);
  applyBadges();
}

/** Expedición: aparece con la Casa de Expediciones (t4) o con una salida en curso; el cartelito muestra las provisiones. */
let lastExp = null;
function refreshExpedition() {
  const el = root.querySelector('[data-act="expedition"]');
  if (!el) return;
  const s = store.state;
  const on = safe(() => isOpen('expedicion') || !!expState(s).active, false);
  const key = on + '|' + (s.prov || 0);
  if (key === lastExp) return;
  lastExp = key;
  show(el, on);
  root.querySelector('[data-hud="provtag"]').textContent = fmtNum(s.prov || 0);
  el.title = `Expedición · ${fmtNum(s.prov || 0)} provisiones en el depósito`;
  applyBadges();
}
/** Renovar: va al próximo edificio que quedó en una época anterior (abre su ficha); de a uno por toque. */
let renovIdx = 0;
function focusRenovate() {
  const list = store.state.city.buildings.filter(b => !b.buildEnd && safe(() => renovateInfo(b), null));
  if (!list.length) return;
  const b = list[renovIdx++ % list.length];
  bus.emit('city:focus', { uid: b.uid });
}
function onAct(act) {
  const c = ctxRef;
  switch (act) {
    case 'build': bus.emit('hud:build'); break;
    case 'wardrobe': c.router.go('wardrobe'); break;
    case 'chests': c.openChests(); break;
    case 'backpack': c.openChests({ tab: 'mochila' }); break;
    case 'album': c.openAlbum(); break;
    case 'pass': c.openSeasonPass(); break;
    case 'events': c.openEvents(); break;
    case 'social': c.openSocial('amigas'); break;
    case 'expedition': c.openPanel('expedition'); break;
    case 'threat': bus.emit('threat:panel'); break;
    case 'daily': c.openPanel('quests', { tab: 'daily' }); break;
    case 'renovate': focusRenovate(); break;
    default: c.openPanel(act);
  }
}

const RAF_EVENTS = ['resources:changed', 'currency:changed', 'xp:changed', 'level:up', 'quests:changed', 'building:built', 'building:placed', 'building:upgraded',
  'building:upgradeStarted', 'building:removed', 'builders:changed', 'boosts:changed', 'city:expanded', 'town:rankup', 'building:moved', 'unlocks:changed',
  'threat:announced', 'threat:resolved', 'threat:started', 'building:damaged', 'building:repaired', 'era:changed', 'building:renovated'];
const BADGE_EVENTS = ['chests:changed', 'album:changed', 'album:seen', 'season:changed', 'events:changed', 'social:badge', 'online:inbox',
  'quests:changed', 'level:up', 'reward:chest', 'materials:changed', 'building:upgraded', 'building:built', 'building:upgradeStarted', 'town:rankup',
  'resources:changed', 'expedition:finished', 'expedition:started', 'unlocks:changed'];

export const hud = {
  init(el, ctx) {
    root = el; ctxRef = ctx;
    render();
    root.addEventListener('click', e => {
      const b = e.target.closest('[data-act]');
      if (!b || !root.contains(b)) return;
      audio.sfx('tap');
      onAct(b.dataset.act);
    });
    let rafDyn = 0, rafBadge = 0;
    for (const ev of RAF_EVENTS) bus.on(ev, () => { threatAt = 0; if (!rafDyn) rafDyn = requestAnimationFrame(() => { rafDyn = 0; refreshDynamic(); }); });
    for (const ev of BADGE_EVENTS) bus.on(ev, () => { if (!rafBadge) rafBadge = requestAnimationFrame(() => { rafBadge = 0; refreshBadges(); }); });
    timer = setInterval(() => { if (!root.classList.contains('hidden')) refreshDynamic(); }, 1000);
    badgeTimer = setInterval(refreshBadges, 30e3);
  },
  show() { root?.classList.remove('hidden'); document.body.classList.remove('no-hud'); refreshDynamic(); refreshBadges(); },
  hide() { root?.classList.add('hidden'); document.body.classList.add('no-hud'); },
  refresh() { render(); },
  refreshBadges() { refreshBadges(); },
  badgeState,
  /** Controles a la vista (botones del HUD que se ven): para la meta de ≤ 14. */
  controls() {
    if (!root) return [];
    return [...root.querySelectorAll('button[data-act]')].filter(b => b.offsetParent !== null && getComputedStyle(b).display !== 'none' && !b.classList.contains('fx-chip')).map(b => b.dataset.act);
  },
};
