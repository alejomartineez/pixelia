// HUD de la ciudad: recursos arriba, botones abajo, misión actual a la izquierda.
import { bus } from './bus.js';
import { store } from './state.js';
import { icon } from './icons.js';
import { esc, progressHtml } from './ui.js';
import { audio } from './audio.js';
import { population, happiness, buildersBusy, fmtNum } from './economy.js';
import { mainQuest, claimableCount } from './quests.js';

let root = null, ctxRef = null, timer = null;

function render() {
  const s = store.state;
  const xp = store.xpProgress();
  root.innerHTML = `
    <div class="hud-top">
      <button class="hud-profile" data-act="wardrobe" aria-label="Vestidor">
        <span class="lvl-star">${icon('star', 40)}<b data-hud="level">${xp.level}</b></span>
        <span class="hud-name">
          <b>${esc(s.player.name)}</b>
          <span class="hud-xp" data-hud="xp">${progressHtml(xp.pct, 'xp')}</span>
        </span>
      </button>
      <div class="hud-res">
        <div class="pill" data-hud="coins">${icon('coin', 20)}<b>${fmtNum(s.coins)}</b></div>
        <div class="pill gem" data-hud="gems">${icon('gem', 20)}<b>${fmtNum(s.gems)}</b></div>
      </div>
    </div>
    <div class="hud-stats">
      <div class="pill sm" data-hud="pop" title="Población">${icon('people', 16)}<b></b></div>
      <div class="pill sm" data-hud="happy" title="Felicidad">${icon('smile', 16)}<b></b></div>
      <div class="pill sm" data-hud="builders" title="Constructoras">${icon('hammer', 16)}<b></b></div>
    </div>
    <button class="hud-quest" data-act="quests"></button>
    <nav class="hud-bottom">
      <button class="hud-btn" data-act="games">${icon('games', 30)}<span>Juegos</span></button>
      <button class="hud-btn" data-act="quests">${icon('quest', 30)}<span>Misiones</span><i class="badge" data-hud="badge"></i></button>
      <button class="hud-btn big" data-act="build">${icon('hammer', 38)}<span>Construir</span></button>
      <button class="hud-btn" data-act="wardrobe">${icon('dress', 30)}<span>Vestidor</span></button>
      <button class="hud-btn" data-act="settings">${icon('gear', 30)}<span>Ajustes</span></button>
    </nav>`;
  refreshDynamic();
}

function setText(sel, txt) { const el = root.querySelector(`[data-hud="${sel}"] b`); if (el && el.textContent !== txt) el.textContent = txt; }

function refreshDynamic() {
  if (!root) return;
  const s = store.state;
  setText('coins', fmtNum(s.coins));
  setText('gems', fmtNum(s.gems));
  setText('pop', fmtNum(population()));
  const hp = happiness();
  setText('happy', hp.pct + '%');
  setText('builders', `${s.builders - buildersBusy()}/${s.builders}`);
  const xp = store.xpProgress();
  const lv = root.querySelector('[data-hud="level"]'); if (lv) lv.textContent = xp.level;
  const bar = root.querySelector('[data-hud="xp"] .progress i'); if (bar) bar.style.width = (xp.pct * 100).toFixed(1) + '%';
  const n = claimableCount();
  const badge = root.querySelector('[data-hud="badge"]');
  if (badge) { badge.textContent = n; badge.style.display = n ? '' : 'none'; }
  const q = mainQuest();
  const qEl = root.querySelector('.hud-quest');
  if (qEl) {
    if (!q) qEl.style.display = 'none';
    else {
      qEl.style.display = '';
      qEl.classList.toggle('done', q.done);
      qEl.innerHTML = `${icon(q.done ? 'gift' : 'quest', 24)}<span><b>${esc(q.title)}</b><small>${q.done ? '¡Tocá para cobrar!' : esc(q.text)}</small>${q.done ? '' : progressHtml(q.progress / q.goal.count)}</span>`;
    }
  }
}

export const hud = {
  init(el, ctx) {
    root = el; ctxRef = ctx;
    render();
    root.addEventListener('click', e => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      audio.sfx('tap');
      const act = b.dataset.act;
      if (act === 'build') bus.emit('hud:build');
      else if (act === 'wardrobe') ctxRef.router.go('wardrobe');
      else ctxRef.openPanel(act);
    });
    for (const ev of ['currency:changed', 'xp:changed', 'level:up', 'quests:changed', 'building:built', 'building:placed', 'building:upgraded', 'building:upgradeStarted', 'building:removed', 'builders:changed'])
      bus.on(ev, () => requestAnimationFrame(refreshDynamic));
    timer = setInterval(refreshDynamic, 1000);
  },
  show() { root?.classList.remove('hidden'); refreshDynamic(); },
  hide() { root?.classList.add('hidden'); },
  refresh() { render(); },
};
