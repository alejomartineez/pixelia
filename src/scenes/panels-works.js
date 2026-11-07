// Panel "Obras": los monumentos de la ciudad, que se construyen por etapas con materiales de región (madera, piedra,
// mineral y hierbas, los trae la expedición). Muestra los materiales que tenés, cada monumento con su etapa, lo que
// pide la próxima etapa (con "Salir" para ir a buscar lo que falta) y el bonus que da al terminarlo.
import { icon } from '../core/icons.js';
import { REGION_MATERIALS, MATERIAL_BY_ID, MONUMENT_IDS } from '../core/data.js';
import { REGIONS } from '../expedition/exp-data.js';
import { openShell } from './panels-common.js';

export function openWorks(ctx, params = {}) {
  const { ui, audio, economy: E, bus } = ctx;
  const { h, esc } = ui;
  const sh = openShell(ctx, 'works', { title: 'Obras', ic: 'monument', sheet: true, className: 'pnl-md pnl-works' });
  if (!sh) return;
  const fmt = E.fmtNum;

  // la región abierta donde más sale cada material (la de mayor peso en REGIONS[].mats)
  const rank = E.townRank();
  function bestRegion(matId) {
    let best = null;
    for (const r of Object.values(REGIONS)) if ((r.rank || 1) <= rank && (r.mats?.[matId] || 0) > (best?.mats?.[matId] || 0)) best = r;
    return best;
  }
  function goOut() {
    if (!E.hasBuilt('casa_exp')) { audio.sfx('error'); ui.toast('Construí la Casa de Expediciones para salir a buscar materiales', { icon: 'lock' }); return; }
    audio.sfx('tap');
    sh.close();
    setTimeout(() => ctx.openPanel('expedition'), 260);
  }

  function wallet() {
    const mats = E.materials();
    const el = h('div.card.pnl-wk-wallet');
    el.append(h('h4.pnl-rk-h', { html: `${icon('bag', 20)}<span>Tus materiales</span>` }));
    const grid = h('div.pnl-wk-mats');
    const canGo = E.hasBuilt('casa_exp');
    for (const m of REGION_MATERIALS) {
      const r = bestRegion(m.id);
      const cell = h('div.pnl-wk-mat', { style: { '--c': m.color }, html: `
        <span class="pnl-wk-mat-ic">${icon(m.icon, 34)}</span>
        <span class="pnl-wk-mat-txt"><b data-mat="${m.id}">${fmt(mats[m.id] || 0)}</b><small>${esc(m.name)}</small><em>${esc(r?.name || '')}</em></span>` });
      const btn = h('button.btn.second.pnl-wk-play' + (canGo ? '' : '.off'), { html: `${icon('🧭', 14)}Salir`, title: r ? `Sale más en ${r.name}` : 'Salí de expedición' });
      btn.onclick = goOut;
      cell.append(btn);
      grid.append(cell);
    }
    el.append(grid);
    el.append(h('p.pnl-rk-tip', { html: `${icon('info', 16)}<span>Los materiales los trae la expedición: cada región tiene los suyos y las casillas lejanas dan más. También salen en misiones diarias, amenazas y cofres.</span>` }));
    return el;
  }

  function stageDots(done, N) {
    let s = '';
    for (let i = 0; i < N; i++) s += `<i class="${i < done ? 'on' : ''}"></i>`;
    return `<span class="pnl-wk-dots">${s}</span>`;
  }

  function costRows(cost) {
    const mats = E.materials();
    const box = h('div.pnl-wk-cost');
    for (const [id, need] of Object.entries(cost.mats || {})) {
      const m = MATERIAL_BY_ID[id];
      if (!m) continue;
      const have = mats[id] || 0, ok = have >= need;
      const row = h('div.pnl-rk-req' + (ok ? '.ok' : ''), { html: `
        <span class="pnl-rk-req-ic">${icon(m.icon, 24)}</span>
        <span class="pnl-rk-req-body">
          <span class="pnl-rk-req-top"><b>${esc(m.name)}</b><span>${fmt(Math.min(have, need))} / ${fmt(need)}</span></span>
          ${ui.progressHtml(Math.min(1, have / need), ok ? 'mint' : 'gold')}
        </span>` });
      if (ok) row.append(h('span.pnl-rk-req-check', { html: icon('check', 22) }));
      else {
        const b = h('button.btn.second.pnl-wk-get', { html: `${icon('🧭', 14)}Salir` });
        b.onclick = goOut;
        row.append(b);
      }
      box.append(row);
    }
    if (cost.coins || cost.gems) box.append(h('div.pnl-wk-coins', { html: ui.costHtml({ coins: cost.coins, gems: cost.gems }, 18) }));
    return box;
  }

  function card(id) {
    const now = Date.now();
    const st = E.monumentStatus(id, ctx.state, now);
    const { def: d, mon, N } = st;
    const el = h('div.card.pnl-wk-card' + (st.done ? '.done' : '') + (!st.unlocked ? '.locked' : ''), { 'data-mon': id });
    const stageName = st.done ? 'Terminado' : st.busy ? `Obra en curso: ${mon.stageNames[st.nextIdx] || 'etapa ' + (st.nextIdx + 1)}` : st.b ? `Etapa ${st.stagesDone} de ${N}` : 'Sin empezar';
    el.append(h('div.pnl-wk-top', { html: `
      <span class="pnl-wk-thumb" data-building="${id}" data-level="${st.b ? Math.max(1, st.stagesDone) : N}">${icon('monument', 48)}</span>
      <span class="pnl-wk-meta">
        <b class="pnl-wk-name">${esc(d.name)}</b>
        <small>${esc(stageName)} ${stageDots(st.stagesDone, N)}</small>
        <span class="pnl-wk-bonus${st.done ? ' on' : ''}">${icon(mon.bonusIcon || 'sparkle', 16)}${esc(mon.bonusText)}</span>
      </span>` }));
    if (!st.unlocked) {
      el.append(h('div.req.pnl-wk-lock', { html: `${icon('lock', 16)}Se desbloquea en el rango ${esc(E.rankName(d.rank))}` }));
      return el;
    }
    if (st.done) {
      el.append(h('div.pnl-wk-okmsg', { html: `${icon('check', 18)}<span>Bonus activo para siempre. ${icon('sparkle', 14)} +${fmt(E.charmBase(d))} Encanto</span>` }));
      return el;
    }
    if (st.busy) {
      el.append(h('div.pnl-rk-busy', { html: `${icon('hammer', 22)}<span>Falta <b data-wk-left="${st.b.uid}">${E.fmtTime(E.remainingMs(st.b, now) / 1000)}</b></span>` }));
      el.append(h('button.btn.ghost.block', { html: `${icon('map', 18)} Ver la obra`, onclick: () => { audio.sfx('tap'); sh.close(); bus.emit('city:focus', { uid: st.b.uid }); } }));
      return el;
    }
    const next = st.next;
    el.append(h('div.pnl-wk-next', { html: `<small>${st.b ? 'Próxima etapa' : 'Primera etapa'}: <b>${esc(mon.stageNames[st.nextIdx] || '')}</b> · ${icon('clock', 13)} ${E.fmtTime(E.stageTime(next.time))}</small>` }));
    el.append(costRows(next.cost));
    const can = st.can;
    let msg = '';
    if (!can.ok) msg = can.mats ? 'Te faltan materiales' : can.poor ? 'Te faltan monedas' : can.reason;
    if (msg) el.append(h('div.req.pnl-rk-msg', { html: `${icon(can.poor ? 'coin' : 'lock', 14)}${esc(msg)}` }));
    const label = st.b ? `Avanzar a la etapa ${st.nextIdx + 1}` : 'Construir';
    const btn = h('button.btn.block' + (can.ok ? '.primary.pnl-glow' : '.ghost'), { html: `${icon(st.b ? 'up' : 'hammer', 20)} ${label}` });
    btn.onclick = () => {
      const now2 = Date.now();
      const s2 = E.monumentStatus(id, ctx.state, now2);
      if (!s2.can.ok) { audio.sfx('error'); ui.toast(s2.can.mats ? 'Te faltan materiales: salen jugando.' : s2.can.poor ? 'No te alcanza todavía' : s2.can.reason, { icon: 'info' }); return; }
      if (!s2.b) { audio.sfx('tap'); sh.close(); bus.emit('city:place', { id }); return; }
      const res = E.startUpgrade(s2.b.uid);
      if (res?.error) { audio.sfx('error'); ui.toast(res.error); return; }
      audio.sfx('build');
      ui.toast(`Arrancó la etapa ${s2.nextIdx + 1} de ${d.name}`, { icon: 'hammer', type: 'good' });
      render();
    };
    el.append(btn);
    return el;
  }

  async function loadThumbs(root) {
    const els = [...root.querySelectorAll('.pnl-wk-thumb[data-building]')];
    try {
      const mod = await import('../city/models.js');
      for (const el of els) {
        if (sh.closed || !el.isConnected) return;
        try {
          const url = await Promise.race([mod.thumbnail(el.dataset.building, Number(el.dataset.level) || 1), new Promise(r => setTimeout(() => r(null), 5000))]);
          if (url && !sh.closed) el.innerHTML = `<img class="pi pnl-thumb" src="${url}" width="64" height="64" alt="">`;
        } catch (e) { console.warn('thumbnail', e); }
      }
    } catch (e) { console.warn('models', e); }
  }

  function signature() {
    const now = Date.now();
    const mats = E.materials();
    return [E.townRank(), ...REGION_MATERIALS.map(m => mats[m.id] || 0),
      ...MONUMENT_IDS.map(id => { const s = E.monumentStatus(id, ctx.state, now); return [s.stagesDone, s.busy, s.can.ok].join(','); })].join('|');
  }
  let sig = '';
  function render() {
    if (sh.closed) return;
    sig = signature();
    const top = sh.body.scrollTop;
    sh.body.innerHTML = '';
    const wrap = h('div.pnl-wk');
    const done = E.monumentsDone();
    wrap.append(h('p.pnl-rk-tip', { html: `${icon('monument', 18)}<span>Los <b>monumentos</b> se construyen por etapas y dan un bonus para siempre. Terminaste <b>${done}</b> de ${MONUMENT_IDS.length}. Los rangos altos de la ciudad piden monumentos terminados.</span>` }));
    wrap.append(wallet());
    const list = MONUMENT_IDS.slice();
    // primero lo que se puede hacer, después lo que está en obra, lo terminado y al final lo bloqueado
    const now = Date.now();
    const order = (id) => { const s = E.monumentStatus(id, ctx.state, now); return !s.unlocked ? 4 : s.done ? 3 : s.busy ? 2 : s.can.ok ? 0 : 1; };
    list.sort((a, b) => order(a) - order(b) || MONUMENT_IDS.indexOf(a) - MONUMENT_IDS.indexOf(b));
    for (const id of list) wrap.append(card(id));
    sh.body.append(wrap);
    sh.body.scrollTop = top;
    loadThumbs(wrap);
    if (params.focus) {
      const f = wrap.querySelector(`[data-mon="${params.focus}"]`);
      if (f) { f.classList.add('pnl-wk-focus'); f.scrollIntoView({ block: 'center' }); }
      params.focus = null;
    }
  }
  sh.every(1000, () => {
    if (signature() !== sig) { render(); return; }
    for (const el of sh.body.querySelectorAll('[data-wk-left]')) {
      const b = ctx.state.city.buildings.find(o => o.uid === Number(el.dataset.wkLeft));
      if (b) el.textContent = E.fmtTime(E.remainingMs(b) / 1000);
    }
  });
  render();
  return sh.done;
}
