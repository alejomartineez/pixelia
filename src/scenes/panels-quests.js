// Panel de Misiones: Principal / Diarias / Logros.
import { icon } from '../core/icons.js';
import { todayStr } from '../core/state.js';
import { MAIN_QUESTS } from '../core/data.js';
import { openShell, rewardFx, burst, goalIcon, goalAction, progressLabel, art } from './panels-common.js';

const ACH_ICON = {
  a_coins: () => icon('coin', 32), a_build: () => icon('hammer', 32), a_upgrade: () => icon('up', 32),
  a_match3: () => art('match3', 32), a_blocks: () => art('blocks', 32), a_parking: () => art('parking', 32),
  a_driving: () => art('driving', 32), a_fashion: () => icon('dress', 32), a_streak: () => icon('fire', 32),
};
// "3 h 39 min" / "39 min" (un "03:39" se confundía con minutos:segundos)
function untilMidnight() {
  const now = new Date();
  const mid = new Date(now); mid.setHours(24, 0, 0, 0);
  const mins = Math.max(1, Math.ceil((mid - now) / 60000));
  const hh = Math.floor(mins / 60), mm = mins % 60;
  return hh ? `${hh} h ${mm} min` : `${mm} min`;
}

export function openQuests(ctx, params = {}) {
  const sh = openShell(ctx, 'quests', { title: 'Misiones', ic: 'quest', sheet: true, className: 'pnl-flex pnl-quests' });
  if (!sh) return;
  const { ui, quests, economy, audio } = ctx;
  const { h, esc, costHtml, progressHtml } = ui;
  const fmt = economy.fmtNum;
  const close = () => sh.close();

  const TABS = [
    { id: 'main', label: 'Principal', ic: 'crown' },
    { id: 'daily', label: 'Diarias', ic: 'calendar' },
    { id: 'ach', label: 'Logros', ic: 'trophy' },
  ];
  function counts() {
    const mq = quests.mainQuest();
    const daily = quests.dailyQuests().filter(q => q.done && !q.claimed).length + (quests.dailyBonusStatus().ready ? 1 : 0);
    return { main: mq?.done ? 1 : 0, daily, ach: quests.achievements().filter(a => a.ready).length };
  }
  let tab = TABS.some(t => t.id === params.tab) ? params.tab : null;
  if (!tab) { const c = counts(); tab = c.main ? 'main' : c.daily ? 'daily' : c.ach ? 'ach' : 'main'; }

  const tabsEl = h('div.pnl-tabs', { role: 'tablist' });
  const pane = h('div.pnl-pane');
  sh.body.append(tabsEl, pane);

  function renderTabs() {
    const c = counts();
    tabsEl.innerHTML = '';
    for (const t of TABS) {
      const b = h('button.tab' + (t.id === tab ? '.active' : ''), {
        role: 'tab', 'aria-selected': t.id === tab ? 'true' : 'false',
        html: `${icon(t.ic, 20)}<span>${t.label}</span>` + (c[t.id] ? `<i class="badge">${c[t.id]}</i>` : ''),
        onclick: () => { if (tab !== t.id) { audio.sfx('select'); tab = t.id; render(true); } },
      });
      tabsEl.append(b);
    }
  }

  // ---------- Principal ----------
  function mainPane() {
    const wrap = h('div.pnl-main');
    const q = quests.mainQuest();
    if (!q) {
      wrap.append(h('div.card.pnl-mq.pnl-allDone', { html: `
        <div class="pnl-mq-icon pnl-bob">${icon('crown', 72)}</div>
        <h3 class="pnl-mq-title">¡Completaste todas las misiones!</h3>
        <p class="muted">Sos oficialmente la reina de Pixelia. Seguí con las diarias y los logros para juntar más gemas.</p>
        <div class="pnl-chips"><span class="chip gold">${icon('star', 16)} ${MAIN_QUESTS.length}/${MAIN_QUESTS.length}</span></div>` }));
      return wrap;
    }
    const pct = q.progress / q.goal.count;
    const card = h('div.card.pnl-mq' + (q.done ? '.ready' : ''));
    card.innerHTML = `
      <div class="pnl-mq-ribbon"><span>Misión ${q.index + 1} de ${q.total}</span></div>
      <div class="pnl-mq-icon ${q.done ? 'pnl-bob' : ''}">${q.done ? icon('gift', 64) : goalIcon(q.goal, 56)}</div>
      <h3 class="pnl-mq-title">${esc(q.title)}</h3>
      <p class="pnl-mq-text">${esc(q.text)}</p>
      <div class="pnl-prog">${progressHtml(pct, q.done ? 'gold' : '')}<b>${q.done ? '¡Lista!' : progressLabel(q.progress, q.goal.count, fmt)}</b></div>
      <div class="pnl-reward"><span class="pnl-reward-lbl">Premio</span>${costHtml(q.reward, 22)}</div>`;
    const foot = h('div.pnl-mq-foot');
    if (q.done) {
      const btn = h('button.btn.gold.block.pnl-glow', { html: `${icon('gift', 24)} ¡Cobrar premio!` });
      btn.onclick = () => {
        // un cobro por botón: si no, un doble toque cobraba también la misión siguiente (si ya estaba lista)
        if (btn.disabled) return;
        btn.disabled = true;
        const reward = quests.claimMain();
        if (!reward) { btn.disabled = false; return; }
        audio.sfx('done');
        hold(900);
        card.classList.add('claimed');
        card.append(h('div.pnl-stamp', {}, '¡Cumplida!'));
        rewardFx(btn, reward);
      };
      foot.append(btn);
    } else {
      const act = goalAction(ctx, q.goal, close);
      if (act) foot.append(h('button.btn.sky.block', { html: `${icon(act.ic, 22)} ${act.label}`, onclick: () => { audio.sfx('tap'); act.run(); } }));
      else foot.append(h('p.pnl-hint', { html: `${icon('info', 16)} ${hintFor(q.goal)}` }));
    }
    card.append(foot);
    wrap.append(card);

    // camino: próximas misiones bloqueadas
    const next = MAIN_QUESTS.slice(q.index + 1, q.index + 4);
    const path = h('div.pnl-path');
    path.append(h('div.pnl-path-head', { html: `<span>${icon('map', 20)} Lo que viene</span><span class="chip lilac">${q.index}/${q.total} cumplidas</span>` }));
    path.append(h('div.pnl-path-bar', { html: progressHtml(q.index / q.total, 'xp') }));
    next.forEach((nq, i) => {
      path.append(h('div.pnl-step', { style: { opacity: String(1 - i * 0.18) }, html: `
        <span class="pnl-step-dot">${icon('lock', 18)}</span>
        <span class="pnl-step-body"><span class="pnl-step-txt"><small>Misión ${q.index + 2 + i}</small><b class="pnl-blur">${esc(nq.title)}</b></span>
        <span class="pnl-step-rew">${costHtml({ coins: nq.reward.coins, gems: nq.reward.gems }, 16)}</span></span>` }));
    });
    if (!next.length) path.append(h('div.pnl-step.last', { html: `<span class="pnl-step-dot">${icon('crown', 18)}</span><span class="pnl-step-body"><span class="pnl-step-txt"><b>¡Última misión!</b><small>Después sos la reina total.</small></span></span>` }));
    wrap.append(path);
    return wrap;
  }
  function hintFor(goal) {
    switch (goal.type) {
      case 'collect': return 'Tocá los edificios con monedas arriba para cobrar.';
      case 'earn': return 'Cobrá edificios y jugá minijuegos.';
      case 'upgrade': return 'Tocá una casa o negocio y elegí Mejorar.';
      case 'castle': return 'Tocá el castillo y elegí Mejorar.';
      case 'expand': return 'Tocá el cartel de terreno en el borde de tu ciudad.';
      case 'level': return 'Ganás experiencia construyendo, cobrando y jugando.';
      case 'play': case 'stars': case 'score': return 'Primero construí el edificio del minijuego.';
      default: return '¡Vos podés!';
    }
  }

  // ---------- Diarias ----------
  function dailyPane() {
    const wrap = h('div.col.pnl-gap');
    wrap.append(h('div.pnl-timer', { html: `${icon('clock', 20)}<span>Nuevas misiones en <b data-timer>${untilMidnight()}</b></span>` }));
    const list = quests.dailyQuests();
    for (const q of list) {
      const pct = q.progress / q.goal.count;
      const row = h('div.card.pnl-q' + (q.claimed ? '.claimed' : q.done ? '.ready' : ''));
      row.innerHTML = `
        <div class="pnl-q-ic">${goalIcon(q.goal, 32)}</div>
        <div class="pnl-q-main">
          <b class="pnl-q-title">${esc(q.title)}</b>
          <div class="pnl-prog sm">${progressHtml(pct, q.done ? 'gold' : '')}<b>${progressLabel(q.progress, q.goal.count, fmt)}</b></div>
          <div class="pnl-q-rew">${costHtml(q.reward, 16)}</div>
        </div>`;
      const side = h('div.pnl-q-side');
      if (q.claimed) side.innerHTML = `<span class="pnl-done">${icon('check', 28)}</span>`;
      else if (q.done) {
        const b = h('button.btn.gold.small.pnl-glow', {}, 'Cobrar');
        b.onclick = () => { if (b.disabled) return; b.disabled = true; const r = quests.claimDaily(q.id); if (r) { audio.sfx('done'); hold(450); rewardFx(b, r, { confetti: false }); burst(...center(b), 40); } };
        side.append(b);
      } else {
        const act = goalAction(ctx, q.goal, close);
        if (act) side.append(h('button.btn.ghost.small', { 'aria-label': act.label, html: `${icon(act.ic, 18)}<span class="pnl-hide-xs">Ir</span>`, onclick: () => { audio.sfx('tap'); act.run(); } }));
      }
      row.append(side);
      wrap.append(row);
    }
    // cofre bonus
    const bonus = quests.dailyBonusStatus();
    const claimedN = list.filter(q => q.claimed).length;
    const chest = h('div.card.pnl-chest' + (bonus.ready ? '.ready' : bonus.claimed ? '.claimed' : ''));
    chest.innerHTML = `
      <div class="pnl-chest-ic ${bonus.ready ? 'pnl-shake' : ''}">${icon(bonus.claimed ? 'sparkle' : 'gift', 52)}</div>
      <div class="pnl-q-main">
        <b class="pnl-q-title">${bonus.claimed ? '¡Cofre abierto!' : 'Cofre del día'}</b>
        <small class="muted">${bonus.claimed ? 'Mañana hay otro. ¡Te espero!' : 'Cobrá las 3 diarias para abrirlo.'}</small>
        <div class="pnl-pips">${list.map((_, i) => `<i class="${i < claimedN ? 'on' : ''}"></i>`).join('')}</div>
        <div class="pnl-q-rew">${costHtml(bonus.reward, 18)}</div>
      </div>`;
    if (bonus.ready) {
      const b = h('button.btn.pink.small.pnl-glow', {}, 'Abrir');
      b.onclick = () => {
        if (b.disabled) return;
        b.disabled = true;
        const r = quests.claimDailyBonus();
        if (!r) { b.disabled = false; return; }
        audio.sfx('win');
        hold(700);
        chest.querySelector('.pnl-chest-ic')?.classList.add('pnl-pop');
        rewardFx(b, r);
      };
      chest.append(h('div.pnl-q-side', {}, b));
    }
    wrap.append(chest);
    return wrap;
  }

  // ---------- Logros ----------
  function achPane() {
    const wrap = h('div.col.pnl-gap');
    const list = quests.achievements();
    const order = (a) => (a.ready ? 0 : a.maxed ? 2 : 1);
    const sorted = list.map((a, i) => ({ a, i })).sort((x, y) => order(x.a) - order(y.a) || x.i - y.i).map(o => o.a);
    const totalStars = list.reduce((s, a) => s + a.tier, 0), maxStars = list.reduce((s, a) => s + a.tiers.length, 0);
    wrap.append(h('div.pnl-timer.lilac', { html: `${icon('trophy', 20)}<span>Estrellas de logro: <b>${totalStars}/${maxStars}</b></span>` }));
    for (const a of sorted) {
      const pct = a.maxed ? 1 : Math.min(1, a.value / a.target);
      const stars = a.tiers.map((_, i) => icon(i < a.tier ? 'star' : 'starOff', 14)).join('');
      const row = h('div.card.pnl-q' + (a.ready ? '.ready' : a.maxed ? '.maxed' : ''));
      row.innerHTML = `
        <div class="pnl-q-ic">${(ACH_ICON[a.id] || (() => icon('trophy', 32)))()}</div>
        <div class="pnl-q-main">
          <div class="pnl-q-top"><b class="pnl-q-title">${esc(a.name)}</b><span class="pnl-stars" aria-label="Nivel ${a.tier} de ${a.tiers.length}">${stars}</span></div>
          <small class="pnl-q-desc">${a.maxed ? '¡Lo completaste todo!' : esc(a.label)}</small>
          <div class="pnl-prog sm">${progressHtml(pct, a.ready || a.maxed ? 'gold' : 'pink')}<b>${a.maxed ? 'MAX' : progressLabel(a.value, a.target, fmt)}</b></div>
        </div>`;
      const side = h('div.pnl-q-side');
      if (a.maxed) side.innerHTML = `<span class="pnl-done">${icon('crown', 30)}</span>`;
      else {
        side.append(h('span.pnl-gemrew', { html: costHtml({ gems: a.reward }, 18) }));
        if (a.ready) {
          const b = h('button.btn.gold.small.pnl-glow', {}, 'Cobrar');
          // un tier por toque: un doble toque no debe cobrar el tier siguiente sin que se vea
          b.onclick = () => { if (b.disabled) return; b.disabled = true; const r = quests.claimAchievement(a.id); if (r) { audio.sfx('star'); hold(450); rewardFx(b, r, { confetti: false }); burst(...center(b), 50); } };
          side.append(b);
        }
      }
      row.append(side);
      wrap.append(row);
    }
    return wrap;
  }

  function center(el) { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }

  // ---------- Render con refresco en vivo ----------
  let holdUntil = 0, pending = 0;
  function hold(ms) { holdUntil = Date.now() + ms; }
  function render(resetScroll = false) {
    if (sh.closed) return;
    const top = resetScroll ? 0 : pane.scrollTop;
    renderTabs();
    pane.innerHTML = '';
    const content = tab === 'main' ? mainPane() : tab === 'daily' ? dailyPane() : achPane();
    if (resetScroll) content.classList.add('pnl-enter');
    pane.append(content);
    pane.scrollTop = top;
  }
  function schedule() {
    if (pending) return;
    const wait = Math.max(16, holdUntil - Date.now());
    pending = setTimeout(() => { pending = 0; if (Date.now() < holdUntil) return schedule(); render(); }, wait);
  }
  sh.onCleanup(() => clearTimeout(pending));
  sh.on(ctx.bus, 'quests:changed', schedule);
  sh.on(ctx.bus, 'stats:changed', () => { if (tab === 'ach') schedule(); });

  let day = todayStr();
  sh.every(15000, () => {
    if (todayStr() !== day) { day = todayStr(); render(); return; }
    const t = pane.querySelector('[data-timer]');
    if (t) t.textContent = untilMidnight();
  });

  // teclado en PC: flechas o 1/2/3 cambian de pestaña
  sh.keyHandler = (e) => {
    const i = TABS.findIndex(t => t.id === tab);
    let n = -1;
    if (e.key === 'ArrowRight') n = (i + 1) % TABS.length;
    else if (e.key === 'ArrowLeft') n = (i + TABS.length - 1) % TABS.length;
    else if (['1', '2', '3'].includes(e.key)) n = Number(e.key) - 1;
    if (n >= 0 && n !== i) { e.preventDefault(); audio.sfx('select'); tab = TABS[n].id; render(true); }
  };

  render(true);
  return sh.done;
}
