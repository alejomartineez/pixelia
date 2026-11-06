// HUD de la ciudad.
//  arriba:     perfil (nivel, nombre, xp; tocarlo abre Ajustes) + botón de Ajustes + monedas y gemas
//  izquierda:  rango de la ciudad + Encanto (abre "Tu ciudad"), población / felicidad / constructoras, efectos activos con tiempo, misión actual
//  derecha:    botones redondos con globito: Cofres, Pase, Álbum, Evento
//  abajo:      Juegos · Misiones · Construir · Vestidor · Amigos
// Los globitos se refrescan con eventos del bus y cada 30 s; los números y los efectos, cada segundo.
import { bus } from './bus.js';
import { store } from './state.js';
import { icon } from './icons.js';
import { esc, progressHtml } from './ui.js';
import { audio } from './audio.js';
import { population, happiness, buildersBusy, fmtNum, fmtTime, rankStatus } from './economy.js';
import { mainQuest, claimableCount } from './quests.js';
import { chestBadge, activeBoosts } from '../chests/chests.js';
import { albumBadge } from '../album/album.js';
import { seasonBadge, seasonInfo, fmtLeft } from '../season/season.js';
import { activeEvents, eventBannerInfo } from '../season/events.js';
import { chestIcon } from '../season/season-ui-common.js';

let root = null, ctxRef = null, timer = null, badgeTimer = null;
const safe = (fn, def) => { try { return fn(); } catch (e) { console.error(e); return def; } };
/** Tiempo corto para los chips: "1h 05m" · "29m" · "45s" */
function shortTime(ms) {
  const sec = Math.max(0, Math.ceil(ms / 1000));
  if (sec >= 3600) return fmtTime(sec);
  if (sec >= 60) return Math.ceil(sec / 60) + 'm';
  return sec + 's';
}

function render() {
  const s = store.state;
  const xp = store.xpProgress();
  root.innerHTML = `
    <div class="hud-top">
      <button class="hud-profile" data-act="settings" aria-label="Tu perfil y ajustes">
        <span class="lvl-star">${icon('star', 40)}<b data-hud="level">${xp.level}</b></span>
        <span class="hud-name">
          <b data-hud="name">${esc(s.player.name)}</b>
          <span class="hud-xp" data-hud="xp">${progressHtml(xp.pct, 'xp')}</span>
        </span>
      </button>
      <button class="hud-cfg" data-act="settings" aria-label="Ajustes" title="Ajustes">${icon('gear', 28)}<span>Ajustes</span></button>
      <div class="hud-res">
        <div class="pill" data-hud="coins">${icon('coin', 20)}<b>${fmtNum(s.coins)}</b></div>
        <div class="pill gem" data-hud="gems">${icon('gem', 20)}<b>${fmtNum(s.gems)}</b></div>
      </div>
    </div>
    <div class="hud-left">
      <button class="hud-rank" data-act="rank" data-hud="rank" aria-label="Rango de tu ciudad"></button>
      <div class="hud-stats">
        <div class="pill sm" data-hud="pop" title="Población">${icon('people', 16)}<b></b></div>
        <div class="pill sm" data-hud="happy" title="Felicidad">${icon('smile', 16)}<b></b></div>
        <div class="pill sm" data-hud="builders" title="Constructoras">${icon('hammer', 16)}<b></b></div>
      </div>
      <div class="hud-fx" data-hud="fx"></div>
      <button class="hud-quest" data-act="quests"></button>
    </div>
    <div class="hud-rail">
      <button class="rail-btn" data-act="chests" aria-label="Cofres">${chestIcon('madera', 34)}<span>Cofres</span><i class="badge" data-badge="chests"></i></button>
      <button class="rail-btn pass" data-act="pass" aria-label="Pase de Temporada"><span class="rail-ic" data-hud="passic">${icon('sparkle', 30)}</span><span>Pase</span><em class="rail-tag" data-hud="passlv"></em><i class="badge" data-badge="pass"></i></button>
      <button class="rail-btn" data-act="album" aria-label="Álbum de figuritas">${icon('album', 30)}<span>Álbum</span><i class="badge" data-badge="album"></i></button>
      <button class="rail-btn event" data-act="events" aria-label="Eventos"><span class="rail-ic" data-hud="evic">${icon('calendar', 30)}</span><span data-hud="evname">Eventos</span><em class="rail-tag" data-hud="evtime"></em></button>
    </div>
    <nav class="hud-bottom">
      <button class="hud-btn" data-act="games">${icon('games', 30)}<span>Juegos</span></button>
      <button class="hud-btn" data-act="quests">${icon('quest', 30)}<span>Misiones</span><i class="badge" data-badge="quests"></i></button>
      <button class="hud-btn big" data-act="build">${icon('hammer', 38)}<span>Construir</span></button>
      <button class="hud-btn" data-act="wardrobe">${icon('wardrobe', 30)}<span>Vestidor</span></button>
      <button class="hud-btn" data-act="social">${icon('people', 30)}<span>Amigos</span><i class="badge" data-badge="social"></i></button>
    </nav>`;
  lastFx = lastEv = lastPass = lastQuest = lastRank = null;
  refreshDynamic();
  refreshBadges();
}

function setText(sel, txt) { const el = root.querySelector(`[data-hud="${sel}"] b`); if (el && el.textContent !== txt) el.textContent = txt; }
function setBadge(key, n) {
  const el = root?.querySelector(`[data-badge="${key}"]`);
  if (!el) return;
  n = Math.max(0, Math.floor(Number(n) || 0));
  const txt = n > 99 ? '99+' : String(n);
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

// ---------- Evento y pase (botones de la derecha) ----------
let lastEv = null, lastPass = null, lastQuest = null, lastRank = null;

// ---------- Rango de la ciudad (emblema + nombre + Encanto con estrellas; brilla si se puede subir) ----------
function refreshRank() {
  const el = root.querySelector('[data-hud="rank"]');
  if (!el) return;
  const st = safe(() => rankStatus(), null);
  if (!st) { el.style.display = 'none'; return; }
  const ready = st.allOk && st.levelOk;
  const key = `${st.rank}|${st.charm}|${st.stars}|${ready}`;
  if (key === lastRank) return;
  lastRank = key;
  let stars = '';
  for (let i = 0; i < 5; i++) stars += icon(i < st.stars ? 'star' : 'starOff', 12);
  el.innerHTML = `<span class="hud-rank-ic">${icon(st.def.emoji, 26)}</span><span class="hud-rank-txt"><b>${esc(st.def.name)}</b>`
    + `<small>${icon('sparkle', 12)}${fmtNum(st.charm)}<span class="hud-rank-stars">${stars}</span></small></span>`
    + (ready ? `<i class="badge">!</i>` : '');
  el.classList.toggle('ready', ready);
  el.title = ready ? `¡Ya podés subir a ${st.next.name}!` : `Rango ${st.def.name} · ${st.charm} de Encanto`;
}
function refreshRail() {
  const ev = safe(() => eventBannerInfo(), null);
  const key = ev ? `${ev.key}|${ev.endsIn}|${ev.count}` : '';
  if (key !== lastEv) {
    lastEv = key;
    const btn = root.querySelector('[data-act="events"]');
    root.querySelector('[data-hud="evic"]').innerHTML = icon(ev ? ev.emoji : 'calendar', 30);
    root.querySelector('[data-hud="evname"]').textContent = ev ? 'Evento' : 'Eventos';
    const t = root.querySelector('[data-hud="evtime"]');
    t.textContent = ev ? ev.endsIn.split(' ')[0] : '';
    t.style.display = ev ? '' : 'none';
    btn.classList.toggle('live', !!ev);
    if (ev) { btn.style.setProperty('--ec', ev.color); btn.style.setProperty('--ecd', ev.dark); btn.title = `${ev.title} · termina en ${ev.endsIn}`; }
    else { btn.style.removeProperty('--ec'); btn.title = 'Eventos de la semana'; }
  }
  const si = safe(() => seasonInfo(), null);
  const pk = si ? `${si.theme?.id}|${si.level}` : '';
  if (pk !== lastPass && si) {
    lastPass = pk;
    root.querySelector('[data-hud="passic"]').innerHTML = icon(si.theme?.emoji || 'sparkle', 30);
    const t = root.querySelector('[data-hud="passlv"]');
    t.textContent = 'Nv ' + si.level;
    const btn = root.querySelector('[data-act="pass"]');
    btn.style.setProperty('--ec', si.theme?.accent || '');
    btn.style.setProperty('--ecd', si.theme?.dark || '');
    btn.title = `${si.theme?.name || 'Pase de Temporada'} · nivel ${si.level}`;
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
  const xp = store.xpProgress();
  const lv = root.querySelector('[data-hud="level"]'); if (lv && lv.textContent !== String(xp.level)) lv.textContent = xp.level;
  const nm = root.querySelector('[data-hud="name"]'); if (nm && nm.textContent !== s.player.name) nm.textContent = s.player.name;
  const bar = root.querySelector('[data-hud="xp"] .progress i'); if (bar) bar.style.width = (xp.pct * 100).toFixed(1) + '%';
  setBadge('quests', claimableCount());
  const q = mainQuest();
  const qEl = root.querySelector('.hud-quest');
  if (qEl) {
    if (!q) qEl.style.display = 'none';
    else {
      qEl.style.display = '';
      qEl.classList.toggle('done', q.done);
      const html = `${icon(q.done ? 'gift' : 'quest', 24)}<span><b>${esc(q.title)}</b><small>${q.done ? '¡Tocá para cobrar!' : esc(q.text)}</small>${q.done ? '' : progressHtml(q.progress / q.goal.count)}</span>`;
      if (html !== lastQuest) { lastQuest = html; qEl.innerHTML = html; }
    }
  }
  refreshFx();
  refreshRail();
  refreshRank();
}

/** Globitos de los botones (cofres, pase, álbum, amigos, misiones). */
function refreshBadges() {
  if (!root) return;
  setBadge('chests', safe(() => chestBadge(), 0));
  setBadge('album', safe(() => albumBadge(), 0));
  setBadge('pass', safe(() => seasonBadge(), 0));
  setBadge('social', safe(() => ctxRef?.social?.socialBadge?.() || 0, 0));
  setBadge('quests', safe(() => claimableCount(), 0));
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
    default: c.openPanel(act);
  }
}

const RAF_EVENTS = ['currency:changed', 'xp:changed', 'level:up', 'quests:changed', 'building:built', 'building:placed', 'building:upgraded',
  'building:upgradeStarted', 'building:removed', 'builders:changed', 'boosts:changed', 'city:expanded', 'town:rankup', 'building:moved'];
const BADGE_EVENTS = ['chests:changed', 'album:changed', 'album:seen', 'season:changed', 'events:changed', 'social:badge', 'online:inbox',
  'quests:changed', 'level:up', 'reward:chest'];

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
    for (const ev of RAF_EVENTS) bus.on(ev, () => { if (!rafDyn) rafDyn = requestAnimationFrame(() => { rafDyn = 0; refreshDynamic(); }); });
    for (const ev of BADGE_EVENTS) bus.on(ev, () => { if (!rafBadge) rafBadge = requestAnimationFrame(() => { rafBadge = 0; refreshBadges(); }); });
    timer = setInterval(() => { if (!root.classList.contains('hidden')) refreshDynamic(); }, 1000);
    badgeTimer = setInterval(refreshBadges, 30e3);
  },
  show() { root?.classList.remove('hidden'); document.body.classList.remove('no-hud'); refreshDynamic(); refreshBadges(); },
  hide() { root?.classList.add('hidden'); document.body.classList.add('no-hud'); },
  refresh() { render(); },
  refreshBadges() { refreshBadges(); },
};
