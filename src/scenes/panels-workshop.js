// Panel "Taller" (DESIGN-CORE.md §5.1): fabricar equipo de expedición (1 uso por salida) y, desde el rango Caserío,
// reservas para las amenazas (tope 10 por tipo). Fabricar es al instante. La lógica está en expedition.js (craft).
import { icon } from '../core/icons.js';
import { EQUIP_RECIPES, RESERVES, REGION_MATERIALS, RESERVES_RANK, RESERVE_CAP } from '../core/data.js';
import { EQUIPMENT } from '../expedition/exp-data.js';
import { openShell } from './panels-common.js';
import { arsenalState } from '../core/arsenal.js';
import { t } from '../core/i18n.js';

/** Los textos nuevos juntos (paso 2a; el paso de idiomas los pasa a t()). */
const TXT = { get arsenal() { return t('arsenal.title'); }, get arsenalHelp() { return t('arsenal.workshopHelp'); } };

const CSS = `
.pnl-ws .pnl-ws-sec { margin-top: 10px; }
.pnl-ws h4.pnl-ws-h { display: flex; align-items: center; gap: 6px; margin: 0 0 6px; font-size: 19px; }
.pnl-ws h4.pnl-ws-h small { margin-left: auto; font-size: 14px; color: var(--ink-l); font-weight: 700; }
.pnl-ws .pnl-ws-list { display: flex; flex-direction: column; gap: 6px; }
.pnl-ws .pnl-ws-item { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 2px 8px; padding: 6px 8px; background: var(--surface);
  border: 2px solid var(--edge); border-radius: 12px; }
.pnl-ws .pnl-ws-item.lock { background: var(--panel-2); color: var(--ink-l); }
.pnl-ws .pnl-ws-item .ic { grid-row: span 2; }
.pnl-ws .pnl-ws-item b { font-size: 17px; }
.pnl-ws .pnl-ws-item b small { font-size: 14px; color: var(--ink-l); font-weight: 700; }
.pnl-ws .pnl-ws-item .txt { font-size: 13px; color: var(--ink-l); grid-column: 2; }
.pnl-ws .pnl-ws-item .btn { grid-row: span 2; grid-column: 3; display: flex; flex-direction: column; align-items: center; gap: 1px; min-width: 104px; padding: 4px 8px; }
.pnl-ws .pnl-ws-item .btn .cost { font-size: 13px; }
.pnl-ws .pnl-ws-wallet { display: flex; flex-wrap: wrap; gap: 6px 12px; font-size: 18px; }
.pnl-ws .pnl-ws-wallet span { display: inline-flex; align-items: center; gap: 3px; }
.pnl-ws .pnl-ws-tip { margin: 6px 0 0; font-size: 14px; color: var(--ink-l); display: flex; gap: 6px; }
.pnl-ws .pnl-ws-ars { display: flex; align-items: center; gap: 10px; margin-top: 10px; }
.pnl-ws .pnl-ws-ars small { flex: 1; font-size: 14px; color: var(--ink-l); line-height: 1.2; }
`;
let styleEl = null;
function injectStyle() {
  if (styleEl?.isConnected) return;
  styleEl = document.createElement('style');
  styleEl.textContent = CSS;
  document.head.append(styleEl);
}

export function openWorkshop(ctx) {
  const { ui, audio, bus } = ctx;
  const X = ctx.expedition;
  const { h, esc } = ui;
  injectStyle();
  const sh = openShell(ctx, 'workshop', { title: 'Taller', ic: 'hammer', sheet: true, className: 'pnl-md pnl-ws' });
  if (!sh) return;
  const fmt = ctx.economy.fmtNum;

  function row(kind, id, it) {
    const st = X.craftStatus(kind, id);
    const lock = st.locked || (st.reason === 'Hace falta el Taller');
    const el = h('div.pnl-ws-item' + (lock ? '.lock' : ''), { 'data-craft': id });
    el.append(h('span.ic', { html: icon(it.icon, 30) }),
      h('b', { html: `${esc(it.name)} <small>×${fmt(st.have)}${st.max ? `/${st.max}` : ''}</small>` }),
      h('span.txt', {}, kind === 'equip' ? X.equipText(id) : it.text || ''));
    const btn = h('button.btn.' + (st.ok ? 'mint' : 'ghost'), { disabled: lock || st.reason?.startsWith('Tope'),
      html: `<span>${lock ? icon('lock', 14) + esc(st.reason) : 'Fabricar'}</span><span class="cost">${ui.costHtml(st.cost, 14)}</span>` });
    btn.onclick = () => {
      const res = X.craft(kind, id);
      if (res.error) { audio.sfx('error'); ui.toast(res.error === 'Faltan materiales' ? 'Faltan materiales: los trae la expedición' : res.error, { icon: 'info' }); return; }
      audio.sfx('buy');
      ui.toast(`${it.name}: listo`, { icon: it.icon, type: 'good' });
      render();
    };
    el.append(btn);
    return el;
  }

  function render() {
    const body = sh.body;
    body.innerHTML = '';
    const mats = ctx.state.materials || {};
    const lvT = ctx.economy.cycleLevel('taller');
    const w = h('div.card');
    w.append(h('h4.pnl-ws-h', { html: `${icon('bag', 20)}<span>Materiales</span><small>${lvT ? `Taller nivel ${lvT} · ${X.equipSlots()} por salida` : 'Sin Taller'}</small>` }));
    w.append(h('div.pnl-ws-wallet', { html: REGION_MATERIALS.map(m => `<span title="${esc(m.name)}">${icon(m.icon, 20)}${fmt(mats[m.id] || 0)}</span>`).join('') + `<span>${icon('coin', 20)}${fmt(ctx.state.coins)}</span>` }));
    // el Arsenal (paso 2a): las armas de las peleas se ven y se trabajan acá
    const n = arsenalState(ctx.state).items.length;
    const ab = h('button.btn.small.sky', { 'data-open-arsenal': '1', html: `${icon('sword', 18)} ${esc(TXT.arsenal)}${n ? ` (${n})` : ''}` });
    ab.onclick = () => { audio.sfx('tap'); ctx.openPanel('arsenal'); };
    w.append(h('div.pnl-ws-ars', {}, ab, h('small', {}, TXT.arsenalHelp)));
    body.append(w);
    const eq = h('div.card.pnl-ws-sec');
    eq.append(h('h4.pnl-ws-h', { html: `${icon('rope', 20)}<span>Equipo de expedición</span><small>1 uso por salida</small>` }));
    const list = h('div.pnl-ws-list');
    for (const id of Object.keys(EQUIP_RECIPES)) list.append(row('equip', id, EQUIPMENT[id]));
    eq.append(list);
    body.append(eq);
    const rs = h('div.card.pnl-ws-sec');
    const open = ctx.economy.townRank() >= RESERVES_RANK;
    rs.append(h('h4.pnl-ws-h', { html: `${icon('sandbags', 20)}<span>Reservas para las amenazas</span><small>tope ${RESERVE_CAP}</small>` }));
    if (!open) rs.append(h('p.pnl-ws-tip', { html: `${icon('lock', 16)}<span>Se abren en el rango ${esc(ctx.economy.rankName(RESERVES_RANK))}, cuando empiezan a llegar las amenazas de la temporada.</span>` }));
    else {
      const l2 = h('div.pnl-ws-list');
      for (const [id, r] of Object.entries(RESERVES)) l2.append(row('reserve', id, r));
      rs.append(l2);
    }
    body.append(rs);
  }
  render();
  sh.on(bus, 'resources:changed', () => render());
  sh.on(bus, 'materials:changed', () => render());
  return sh.done;
}
