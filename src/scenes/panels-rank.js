// Panel "Tu ciudad": rango de la ciudad (nivel de la Municipalidad), Encanto con estrellas, el expediente para
// el próximo rango (checklist con barras), qué desbloquea y el botón para mejorar la Municipalidad.
// Con params.celebrate (número de rango) abre en modo festejo: emblema con rayos, premio y lo que se desbloqueó.
import { icon } from '../core/icons.js';
import { BUILDINGS, TOWN_RANKS, RANK_REQ_LABELS, CASTLE_BONUS_PER_LEVEL } from '../core/data.js';
import { openShell, burst, rewardHtml } from './panels-common.js';

const CAT_ICON = { casa: 'home', negocio: 'shop', deco: 'flower', especial: 'castle', camino: 'map', monumento: 'monument' };
const CAT_NAME = { casa: 'Casa', negocio: 'Negocio', deco: 'Deco', especial: 'Especial', camino: 'Camino', monumento: 'Monumento' };

/** Lo que trae un rango: [{kind, name, ic, building?}] (edificios, terreno, constructora y bonus de producción). */
export function rankUnlocks(rank) {
  const r = TOWN_RANKS[rank - 1];
  if (!r) return [];
  const prev = TOWN_RANKS[rank - 2];
  const list = [];
  for (const b of BUILDINGS.filter(b => b.rank === rank)) list.push({ kind: CAT_NAME[b.cat] || 'Edificio', name: b.name, ic: icon(CAT_ICON[b.cat] || 'home', 40), building: b.id });
  if (prev && r.land > prev.land) list.push({ kind: 'Terreno', name: r.land - prev.land > 1 ? `${r.land - prev.land} expansiones más` : 'Una expansión más', ic: icon('map', 40) });
  if (r.builders) list.push({ kind: 'Equipo', name: `+${r.builders} constructora`, ic: icon('hammer', 40), hot: true });
  if (rank > 1) list.push({ kind: 'Bonus', name: `+${Math.round(CASTLE_BONUS_PER_LEVEL * 100)}% de producción`, ic: icon('coin', 40) });
  if (r.look) list.push({ kind: 'Municipalidad', name: r.look[0].toUpperCase() + r.look.slice(1), ic: icon('castle', 40), building: 'castillo', level: rank, hot: rank >= 6 });
  return list;
}

/** Fila de 5 estrellas de Encanto. */
export function charmStarsHtml(stars, size = 18) {
  let s = '';
  for (let i = 0; i < 5; i++) s += icon(i < stars ? 'star' : 'starOff', size);
  return s;
}

export function openRank(ctx, params = {}) {
  const { ui, audio, economy: E, bus } = ctx;
  const { h, esc, costHtml } = ui;
  let celebrate = Number(params.celebrate) || 0;
  const sh = openShell(ctx, 'rank', {
    title: celebrate ? '¡Nuevo rango!' : 'Tu ciudad', ic: 'castle', sheet: !celebrate,
    className: 'pnl-md pnl-rank' + (celebrate ? ' reward-modal' : ''),
  });
  if (!sh) return;
  const fmt = E.fmtNum;
  const castle = () => ctx.state.city.buildings.find(b => b.id === 'castillo');
  const titleEl = sh.el.querySelector('.modal-head h2');

  /** Emblema: círculo con el emoji del rango (y rayos si festeja). */
  function emblem(def, size, rays) {
    return `<div class="pnl-rk-emblem${rays ? ' big' : ''}">${rays ? '<div class="pnl-rays spin"></div>' : ''}
      <span class="pnl-rk-badge">${icon(def.emoji, size)}</span><em>${def.rank}</em></div>`;
  }

  function unlockGrid(list) {
    const grid = h('div.pnl-unlocks');
    list.forEach((it, i) => {
      const el = h('div.pnl-unlock' + (it.hot ? '.hot' : ''), { style: { animationDelay: (0.1 + i * 0.06) + 's' }, html: `
        <span class="pnl-unlock-ic">${it.ic}</span>
        <span class="pnl-unlock-txt"><small>${esc(it.kind)}</small><b>${esc(it.name)}</b></span>` });
      if (it.building) { el.dataset.building = it.building; if (it.level) el.dataset.level = it.level; }
      grid.append(el);
    });
    loadThumbs(grid);
    return grid;
  }

  // ---------- modo festejo ----------
  function renderCelebrate() {
    const def = E.rankDef(celebrate);
    const wrap = h('div.pnl-lv.pnl-rk-party');
    wrap.append(h('div.pnl-lv-burst', { html: emblem(def, 96, true) }));
    wrap.append(h('h2.pnl-lv-title', {}, def.name));
    wrap.append(h('p.pnl-lv-sub', {}, `¡Tu ciudad subió al rango ${celebrate} de ${TOWN_RANKS.length}!`));
    if (def.reward) wrap.append(h('div.pnl-lv-reward', { html: `<small>Premio</small>${rewardHtml(def.reward, 24)}` }));
    const items = rankUnlocks(celebrate);
    if (items.length) {
      wrap.append(h('h4.pnl-lv-h', { html: `${icon('lock', 18)} ¡Se desbloqueó!` }));
      wrap.append(unlockGrid(items));
    }
    const foot = h('div.pnl-rk-foot');
    const next = celebrate < TOWN_RANKS.length;
    if (next) foot.append(h('button.btn.ghost', { html: `${icon('quest', 20)} Próximo rango`, onclick: () => { audio.sfx('select'); toNormal(); } }));
    foot.append(h('button.btn.primary', { html: `${icon('sparkle', 20)} ¡Genial!`, onclick: () => sh.close() }));
    wrap.append(foot);
    sh.body.append(wrap);
  }
  function toNormal() {
    celebrate = 0;
    sh.el.classList.remove('reward-modal');
    if (titleEl) titleEl.lastChild.textContent = 'Tu ciudad';
    render();
  }

  // ---------- modo normal: rango, encanto y expediente ----------
  function reqRow(key, have, need, ok, label, ic) {
    const pct = need > 0 ? Math.min(1, have / need) : 1;
    const unit = key === 'happy' ? '%' : '';
    return h('div.pnl-rk-req' + (ok ? '.ok' : ''), { html: `
      <span class="pnl-rk-req-ic">${icon(ic, 26)}</span>
      <span class="pnl-rk-req-body">
        <span class="pnl-rk-req-top"><b>${esc(label)}</b><span>${fmt(Math.min(have, need))}${unit} / ${fmt(need)}${unit}</span></span>
        ${ui.progressHtml(pct, ok ? 'mint' : 'gold')}
      </span>
      <span class="pnl-rk-req-check">${icon(ok ? 'check' : 'lock', 22)}</span>` });
  }

  function renderNormal() {
    const now = Date.now();
    const st = E.rankStatus(ctx.state, now);
    const ci = E.charmInfo(ctx.state, now);
    const wrap = h('div.pnl-rk');

    // cabecera
    const cityName = ctx.state.player.cityName;
    const head = h('div.card.pnl-rk-head', { html: `
      ${emblem(st.def, 52, false)}
      <div class="pnl-rk-meta">
        <small>${cityName ? esc(cityName) + ' · ' : ''}Rango ${st.rank} de ${TOWN_RANKS.length}</small>
        <b class="pnl-rk-name">${esc(st.def.name)}</b>
        <span class="pnl-rk-charm" title="Encanto">${icon('sparkle', 18)}<b>${fmt(st.charm)}</b> Encanto <span class="pnl-rk-stars">${charmStarsHtml(st.stars, 16)}</span></span>
        <span class="pnl-rk-bonus">${icon('coin', 14)} +${Math.round((st.rank - 1) * CASTLE_BONUS_PER_LEVEL * 100)}% producción · ${icon('map', 14)} ${E.landBounds().side}×${E.landBounds().side}</span>
      </div>` });
    wrap.append(head);

    // cómo sumar encanto
    wrap.append(h('p.pnl-rk-tip', { html: `${icon('info', 16)}<span>El <b>Encanto</b> sube con deco, negocios y edificios mejorados. ¡Variá! Repetir el mismo suma cada vez menos. Variedad: <b>${ci.kinds}</b> ${ci.kinds === 1 ? 'tipo' : 'tipos'} (×${String(Math.round(ci.variety * 100) / 100).replace('.', ',')}).</span>` }));

    if (!st.next) {
      wrap.append(h('div.pnl-lv-empty', { html: `${icon('trophy', 40)}<span><b>¡Tu ciudad es una Capital!</b> Llegaste al rango máximo. Ahora a decorar y lucirte con tus amistades.</span>` }));
      sh.body.append(wrap);
      return;
    }
    const nx = st.next;
    const b = castle();
    const upgrading = b && E.isUpgrading(b, now);

    // expediente
    const card = h('div.card.pnl-rk-file');
    card.append(h('h4.pnl-rk-h', { html: `${icon('quest', 20)}<span>Expediente para <b>${icon(nx.emoji, 20)} ${esc(nx.name)}</b></span>` }));
    for (const r of st.reqs) {
      const [label, ic] = RANK_REQ_LABELS[r.key] || [r.key, 'info'];
      card.append(reqRow(r.key, r.have, r.need, r.ok, label, ic));
    }
    card.append(reqRow('level', ctx.state.player.level, nx.reqLevel, st.levelOk, 'Tu nivel', 'xp'));
    if (st.reqs.some(r => r.key === 'monuments' && !r.ok)) {
      card.append(h('button.btn.second.block', { html: `${icon('monument', 20)} Ver las Obras`, onclick: () => { audio.sfx('tap'); sh.close(); ctx.openPanel('works'); } }));
    }
    wrap.append(card);

    // qué trae
    const items = rankUnlocks(nx.rank);
    if (items.length || nx.reward) {
      wrap.append(h('h4.pnl-lv-h', { html: `${icon('gift', 18)} El rango ${esc(nx.name)} trae` }));
      if (items.length) wrap.append(unlockGrid(items));
      if (nx.reward) wrap.append(h('div.pnl-reward.pnl-rk-reward', { html: `<span class="pnl-reward-lbl">Premio</span>${rewardHtml(nx.reward, 18)}` }));
    }

    // mejorar
    const foot = h('div.card.pnl-rk-up');
    if (upgrading) {
      foot.append(h('div.pnl-rk-busy', { html: `${icon('hammer', 22)}<span>Subiendo a <b>${esc(nx.name)}</b>: falta <b data-rk-left>${E.fmtTime(E.remainingMs(b, now) / 1000)}</b></span>` }));
      foot.append(h('button.btn.second.block', { html: `${icon('castle', 20)} Ver Municipalidad`, onclick: () => { audio.sfx('tap'); sh.close(); bus.emit('city:focus', { uid: b.uid }); } }));
    } else {
      const can = b ? E.canUpgrade(b, ctx.state, now) : { ok: false, reason: 'Falta la Municipalidad' };
      const info = b ? E.upgradeInfo(b) : null;
      if (info) foot.append(h('div.pnl-rk-cost', { html: `<span class="cost">${costHtml(info.cost, 20)}</span><span class="muted">${icon('clock', 14)} ${E.fmtTime(info.time)}</span>` }));
      let msg = '';
      if (!st.levelOk) msg = `Necesitás nivel ${nx.reqLevel}`;
      else if (!st.allOk) msg = `Completá el expediente (${st.reqs.filter(r => r.ok).length}/${st.reqs.length})`;
      else if (!can.ok && !can.poor) msg = can.reason;
      else if (can.poor) msg = 'Te faltan monedas';
      if (msg) foot.append(h('div.req.pnl-rk-msg', { html: `${icon(can.poor ? 'coin' : 'lock', 14)}${esc(msg)}` }));
      const ready = can.ok;
      const btn = h('button.btn.primary.block' + (ready ? '.pnl-glow' : ''), { html: `${icon('up', 22)} Mejorar a ${esc(nx.name)}`, disabled: !ready && !can.poor });
      btn.onclick = () => {
        const c = b ? E.canUpgrade(b) : can;
        if (!c.ok) { audio.sfx('error'); ui.toast(c.poor ? 'No te alcanza todavía' : c.reason, { icon: c.locked ? 'lock' : 'info' }); return; }
        const res = E.startUpgrade(b.uid);
        if (res?.error) { audio.sfx('error'); ui.toast(res.error); return; }
        audio.sfx('build');
        ui.toast(`¡Empezó la obra! En ${E.fmtTime(info.time)} tu ciudad será ${nx.name}`, { icon: 'hammer', type: 'good' });
        render();
      };
      foot.append(btn);
    }
    wrap.append(foot);
    sh.body.append(wrap);
  }

  async function loadThumbs(grid) {
    const els = [...grid.querySelectorAll('[data-building]')];
    if (!els.length) return;
    try {
      const mod = await import('../city/models.js');
      if (typeof mod.thumbnail !== 'function') return;
      for (const el of els) {
        if (sh.closed || !el.isConnected) return;
        try {
          const url = await Promise.race([mod.thumbnail(el.dataset.building, Number(el.dataset.level) || 1), new Promise(r => setTimeout(() => r(null), 4000))]);
          if (url && !sh.closed) el.querySelector('.pnl-unlock-ic').innerHTML = `<img class="pi pnl-thumb" src="${url}" width="48" height="48" alt="">`;
        } catch (e) { console.warn('thumbnail', e); }
      }
    } catch (e) { console.warn('models', e); }
  }

  // firma de lo que se ve: si cambia, se redibuja (sin redibujar cada segundo, así no parpadean las miniaturas)
  function signature() {
    if (celebrate) return 'party' + celebrate;
    const now = Date.now();
    const st = E.rankStatus(ctx.state, now);
    const b = castle();
    const can = b ? E.canUpgrade(b, ctx.state, now) : {};
    return [st.rank, st.charm, st.stars, st.levelOk, ...st.reqs.map(r => r.have), b && E.isUpgrading(b, now), can.ok, can.poor].join('|');
  }
  let sig = '';
  function render() {
    if (sh.closed) return;
    sig = signature();
    const top = sh.body.scrollTop;
    sh.body.innerHTML = '';
    if (celebrate) renderCelebrate(); else renderNormal();
    sh.body.scrollTop = celebrate ? 0 : top;
  }
  sh.every(1000, () => {
    if (signature() !== sig) { render(); return; }
    const el = sh.body.querySelector('[data-rk-left]');
    const b = castle();
    if (el && b) el.textContent = E.fmtTime(E.remainingMs(b) / 1000);
  });
  sh.on(bus, 'town:rankup', ({ rank } = {}) => {
    celebrate = rank || E.townRank();
    sh.el.classList.add('reward-modal');
    if (titleEl) titleEl.lastChild.textContent = '¡Nuevo rango!';
    render();
    party();
  });
  function party() {
    audio.sfx('star');
    sh.later(250, () => burst(innerWidth / 2, innerHeight * 0.3, 120));
    sh.later(900, () => burst(innerWidth / 2, innerHeight * 0.3, 60));
  }
  sh.keyHandler = (e) => {
    if (celebrate && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); sh.close(); }
  };

  render();
  if (celebrate) party();
  return sh.done;
}
