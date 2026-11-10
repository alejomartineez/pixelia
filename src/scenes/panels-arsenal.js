// Panel "Arsenal" (La Travesía, paso 2a; DESIGN-COMBAT.md §18): las armas que se trajeron de las peleas. Se abre desde
// la Bitácora (Progreso: Nivel y Fuerza) y desde el Taller. Ver cada arma (nombre, rareza, Fuerza, rasgos y quién la
// lleva), equiparla a quien lidera o a una clase que la pueda llevar, sacarla, rehacer un rasgo (cuesta), desarmarla
// (da materiales, con confirmación) y el filtro de desarme automático. Las reglas están en src/core/arsenal.js y el
// cobro y los avisos en src/core/gear.js.
import { icon } from '../core/icons.js';
import * as A from '../core/arsenal.js';
import * as G from '../core/gear.js';
import * as T from '../core/talents.js';
import { CLASSES } from '../combat/classes.js';
import { ELEMENTS } from '../combat/combat-data.js';
import { openShell } from './panels-common.js';
import { t } from '../core/i18n.js';

/** Los textos (claves arsenal.* de src/i18n/es.js): getters y funciones, se resuelven al dibujar. */
const TXT = {
  get title() { return t('arsenal.title'); },
  count: (n, max) => t('arsenal.count', { n, max }),
  get all() { return t('arsenal.all'); },
  get filter() { return t('arsenal.filter'); },
  get filterHelp() { return t('arsenal.filterHelp'); },
  get filters() { return [[-1, t('arsenal.filter.off')], [0, t('arsenal.filter.common')], [1, t('arsenal.filter.uncommon')], [2, t('arsenal.filter.rare')]]; },
  get who() { return t('arsenal.who'); }, get lider() { return t('arsenal.leader'); },
  classWeapon: (name) => t('arsenal.classWeapon', { name }), get noWeapon() { return t('arsenal.noWeapon'); },
  get list() { return t('arsenal.list'); }, get power() { return t('power.name'); }, carriedBy: (who) => t('arsenal.carriedBy', { who }),
  get gives() { return t('arsenal.gives'); }, get nothing() { return t('arsenal.nothing'); },
  stats: { hp: (n) => t('arsenal.stat.hp', { n }), atk: (n) => t('arsenal.stat.atk', { n }), armor: (n) => t('arsenal.stat.armor', { n }) },
  get traits() { return t('arsenal.traits'); }, get reroll() { return t('arsenal.reroll'); }, rerolled: (name) => t('arsenal.rerolled', { name }),
  get noMoney() { return t('gear.noMoney'); },
  get equipTo() { return t('arsenal.equipTo'); }, equipped: (weapon, who) => t('arsenal.equipped', { weapon, who }),
  get unequip() { return t('arsenal.unequip'); }, unequipped: (who) => t('arsenal.unequipped', { who }),
  get scrap() { return t('arsenal.scrap'); }, get scrapTitle() { return t('arsenal.scrapTitle'); },
  scrapText: (name, mats) => t('arsenal.scrapText', { name, mats }),
  get scrapOk() { return t('arsenal.scrap'); }, get scrapNo() { return t('common.cancel'); },
  get scrapped() { return t('arsenal.scrapped'); }, get scrapLocked() { return t('arsenal.equippedLocked'); },
  get empty() { return t('arsenal.empty'); },
  get emptyType() { return t('arsenal.emptyType'); },
  get less() { return t('arsenal.close'); },
  affinity: (el) => t('arsenal.affinity', { el }),
};

const CSS = `
.pnl-ars .ars-top { flex: none; display: flex; flex-direction: column; gap: 8px; padding: 12px 14px 10px; background: var(--panel-2); border-bottom: 3px solid var(--edge); }
.pnl-ars .ars-line { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.pnl-ars .ars-line > b { font-size: 15px; color: var(--ink-l); margin-right: 4px; }
.pnl-ars .ars-count { margin-left: auto; font-size: 15px; color: var(--ink-l); white-space: nowrap; }
.pnl-ars .ars-chip { padding: 3px 10px; font-family: inherit; font-size: 15px; color: var(--ink-l); background: var(--surface); border: 2px solid var(--edge); border-radius: 999px; cursor: pointer; white-space: nowrap; }
.pnl-ars .ars-chip:hover { color: var(--ink); background: var(--surface-hover); }
.pnl-ars .ars-chip.on { color: var(--ink-dark); background: var(--gold); }
.pnl-ars .ars-chip small { opacity: .75; margin-left: 2px; }
.pnl-ars .ars-help { margin: 0; font-size: 13px; color: var(--ink-ll); line-height: 1.2; }
.pnl-ars .ars-h { margin: 12px 2px 6px; font-size: 15px; font-weight: 700; color: var(--ink-l); display: flex; align-items: center; gap: 6px; }
.pnl-ars .ars-h:first-child { margin-top: 0; }
.pnl-ars .ars-who { display: grid; grid-template-columns: repeat(auto-fill, minmax(196px, 1fr)); gap: 6px; }
.pnl-ars .ars-wh { display: grid; grid-template-columns: 1fr auto; gap: 1px 6px; align-items: center; padding: 6px 8px; background: var(--surface); border: 2px solid var(--rc, var(--edge)); border-radius: 10px; min-width: 0; }
.pnl-ars .ars-wh b { font-size: 15px; }
.pnl-ars .ars-wh small { grid-column: 1; font-size: 13px; color: var(--ink-l); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pnl-ars .ars-wh small.none { color: var(--ink-ll); }
.modal.pnl-ars .ars-wh .btn { grid-column: 2; grid-row: 1 / span 2; min-height: 30px; padding: 2px 8px; font-size: 14px; }
.pnl-ars .ars-list { display: flex; flex-direction: column; gap: 6px; }
.pnl-ars .ars-w { display: grid; grid-template-columns: 1fr auto; gap: 3px 10px; padding: 8px 10px; background: var(--surface); border: 2px solid var(--rc, var(--edge)); border-radius: 12px; cursor: pointer; }
.pnl-ars .ars-w:hover { background: var(--surface-hover); }
.pnl-ars .ars-w.open { cursor: default; background: var(--surface); box-shadow: 0 0 0 2px var(--rc) inset; }
.pnl-ars .ars-w .ars-name { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; min-width: 0; font-size: 17px; }
.pnl-ars .ars-rar { padding: 0 7px; font-size: 13px; font-weight: 700; border-radius: 6px; background: var(--rc); color: var(--rt); border: 1px solid var(--edge); white-space: nowrap; }
.pnl-ars .ars-pow { font-size: 15px; color: var(--gold-t); font-weight: 700; white-space: nowrap; text-align: right; }
.pnl-ars .ars-pow small { color: var(--ink-ll); font-weight: 400; font-size: 13px; }
.pnl-ars .ars-sum { grid-column: 1 / -1; display: flex; align-items: center; gap: 4px 10px; flex-wrap: wrap; font-size: 13px; color: var(--ink-l); }
.pnl-ars .ars-sum .ars-by { color: var(--mint-t); font-weight: 700; }
.pnl-ars .ars-body { grid-column: 1 / -1; display: flex; flex-direction: column; gap: 8px; margin-top: 4px; padding-top: 8px; border-top: 2px solid var(--rule); cursor: default; }
.pnl-ars .ars-gives { font-size: 14px; color: var(--ink); }
.pnl-ars .ars-gives b { color: var(--ink-l); font-weight: 700; margin-right: 4px; }
.pnl-ars .ars-tr { display: grid; grid-template-columns: 1fr auto; gap: 1px 10px; align-items: center; padding: 6px 8px; background: var(--surface-2); border: 2px solid var(--edge); border-radius: 10px; }
.pnl-ars .ars-tr b { font-size: 15px; }
.pnl-ars .ars-tr small { grid-column: 1; font-size: 13px; color: var(--ink-l); line-height: 1.2; }
.modal.pnl-ars .ars-tr .btn { grid-column: 2; grid-row: 1 / span 2; display: flex; flex-direction: column; align-items: center; gap: 0; min-height: 34px; padding: 2px 10px; font-size: 14px; }
.pnl-ars .ars-tr .btn .cost { font-size: 13px; }
.pnl-ars .ars-cost { display: flex; gap: 6px; align-items: center; }
.pnl-ars .ars-cost .cost { display: inline-flex; align-items: center; gap: 2px; }
.pnl-ars .ars-acts { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.pnl-ars .ars-acts > b { font-size: 14px; color: var(--ink-l); margin-right: 2px; }
.pnl-ars .ars-acts .grow { flex: 1; }
.pnl-ars .ars-acts .btn.on { box-shadow: inset 0 0 0 2px var(--mint); }
.pnl-ars .ars-empty { padding: 18px 12px; text-align: center; color: var(--ink-ll); border: 2px dashed var(--rule); border-radius: 12px; }
@media (max-width: 560px) { .pnl-ars .ars-count { margin-left: 0; width: 100%; } }
`;
let styleEl = null;
function injectStyle() {
  if (styleEl?.isConnected) return;
  styleEl = document.createElement('style');
  styleEl.id = 'pnl-arsenal-style';
  styleEl.textContent = CSS;
  document.head.append(styleEl);
}
/** Color del texto sobre el color de cada rareza (contraste). */
const RARITY_TEXT = ['#1c1714', '#1c1714', '#fff', '#fff', '#1c1714'];
const whoName = (who) => who === 'lider' ? TXT.lider : CLASSES[who]?.name || who;
const traitName = (t) => t.id === 'afinidad' ? TXT.affinity(ELEMENTS[t.el]?.name || t.el || '') : A.TRAITS[t.id]?.name || t.id;

export function openArsenal(ctx, params = {}) {
  const { ui, audio, bus } = ctx;
  const { h, esc, costHtml } = ui;
  injectStyle();
  const sh = openShell(ctx, 'arsenal', { title: TXT.title, ic: 'sword', sheet: true, className: 'pnl-flex pnl-ars' });
  if (!sh) return;
  const s = ctx.state;
  let type = params.type && A.WEAPON_TYPES[params.type] ? params.type : 'all';
  let open = params.uid ?? null;   // el arma desplegada (con sus acciones)

  const topEl = h('div.ars-top');
  const pane = h('div.pnl-pane');
  sh.body.append(topEl, pane);
  const fail = (r, why) => { audio.sfx('error'); ui.toast(why || r?.why || TXT.noMoney, { icon: 'info' }); };
  const holderOf = (uid) => Object.entries(A.arsenalState(s).equipped).find(([, u]) => u === uid)?.[0] || null;
  const rarVars = (w) => `--rc:${A.RARITIES[w.rarity].color};--rt:${RARITY_TEXT[w.rarity]}`;

  function renderTop() {
    const a = A.arsenalState(s);
    topEl.innerHTML = '';
    const types = h('div.ars-line', { role: 'tablist' });
    const counts = {};
    for (const w of a.items) counts[w.type] = (counts[w.type] || 0) + 1;
    const chip = (id, label, n) => h('button.ars-chip' + (type === id ? '.on' : ''), { type: 'button', role: 'tab', 'aria-selected': type === id ? 'true' : 'false', 'data-type': id,
      html: `${esc(label)}${n ? `<small>${n}</small>` : ''}`, onclick: () => { if (type === id) return; audio.sfx('select'); type = id; render(true); } });
    types.append(chip('all', TXT.all, 0));
    for (const id of A.WEAPON_IDS) if (counts[id] || type === id) types.append(chip(id, A.WEAPON_TYPES[id].name, counts[id]));
    types.append(h('span.ars-count', { 'data-count': String(a.items.length) }, TXT.count(a.items.length, A.ARSENAL_CAP)));
    const fl = h('div.ars-line', { 'data-filter': String(a.filter) });
    fl.append(h('b', {}, TXT.filter));
    for (const [v, label] of TXT.filters) {
      fl.append(h('button.ars-chip' + (a.filter === v ? '.on' : ''), { type: 'button', 'data-set-filter': String(v), 'aria-pressed': a.filter === v ? 'true' : 'false',
        onclick: () => { if (a.filter === v) return; audio.sfx('select'); G.setFilter(v); } }, label));
    }
    topEl.append(types, fl, h('p.ars-help', {}, TXT.filterHelp));
  }

  function whoCard(who) {
    const w = A.equippedOn(s, who);
    const L = s.classes?.leader || {};
    const def = A.WEAPON_TYPES[A.wieldType(s, who, L.cls || null)];
    const el = h('div.ars-wh', { 'data-wielder': who, style: w ? rarVars(w) : '',
      html: `<b>${esc(whoName(who))}</b>` + (w ? `<small>${esc(A.weaponName(w))}</small>` : `<small class="none">${esc(def ? TXT.classWeapon(def.name) : TXT.noWeapon)}</small>`) });
    if (w) {
      const b = h('button.btn.small.ghost', { 'data-unequip': who, html: esc(TXT.unequip) });
      b.onclick = (e) => { e.stopPropagation(); doUnequip(who); };
      el.append(b);
    }
    return el;
  }

  function weaponCard(w) {
    const holder = holderOf(w.uid);
    const isOpen = open === w.uid;
    const el = h('div.ars-w' + (isOpen ? '.open' : ''), { 'data-weapon': String(w.uid), 'data-rarity': String(w.rarity), 'data-type': w.type, style: rarVars(w),
      tabindex: isOpen ? null : '0', role: isOpen ? null : 'button', 'aria-expanded': isOpen ? 'true' : 'false',
      html: `<span class="ars-name"><b>${esc(A.weaponName(w))}</b><span class="ars-rar">${esc(A.RARITIES[w.rarity].name)}</span></span>`
        + `<span class="ars-pow"><small>${esc(TXT.power)}</small> ${A.weaponPower(w)}</span>`
        + `<span class="ars-sum">${w.traits.map(t => `<span>${esc(traitName(t))}</span>`).join('<span aria-hidden="true">·</span>')}`
        + (holder ? `<span class="ars-by">${esc(TXT.carriedBy(whoName(holder)))}</span>` : '') + `</span>` });
    const toggle = () => { audio.sfx('select'); open = isOpen ? null : w.uid; render(); };
    if (!isOpen) {
      el.onclick = toggle;
      el.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } };
      return el;
    }
    const body = h('div.ars-body');
    // lo que da
    const st = A.weaponStats(w);
    const gives = [st.hp && TXT.stats.hp(st.hp), st.atk && TXT.stats.atk(st.atk), st.armor && TXT.stats.armor(st.armor)].filter(Boolean);
    body.append(h('div.ars-gives', { html: `<b>${esc(TXT.gives)}</b>${esc(gives.length ? gives.join(', ') : TXT.nothing)}.` }));
    // rasgos (con rehacer)
    const cost = G.rerollCostOf(w.uid);
    w.traits.forEach((t, i) => {
      const def = A.TRAITS[t.id];
      const tr = h('div.ars-tr', { 'data-trait': t.id, html: `<b>${esc(traitName(t))}</b><small>${esc(def?.text || '')}</small>` });
      const rb = h('button.btn.small.ghost', { 'data-reroll': String(i), title: TXT.reroll, html: `<span>${icon('rotate', 14)} ${esc(TXT.reroll)}</span><span class="ars-cost">${costHtml(cost, 13)}</span>` });
      rb.onclick = () => {
        const r = G.reroll(w.uid, i);
        if (!r.ok) return fail(r);
        audio.sfx('buy');
        ui.toast(TXT.rerolled(traitName(r.trait)), { icon: 'rotate', type: 'good' });
      };
      tr.append(rb);
      body.append(tr);
    });
    // equipar a quien la pueda llevar
    const eq = h('div.ars-acts', { html: `<b>${esc(TXT.equipTo)}</b>` });
    for (const who of A.WIELDERS.filter(x => A.canWield(x, w.type))) {
      const on = holder === who;
      const b = h('button.btn.small' + (on ? '.mint.on' : '.ghost'), { 'data-equip': who, 'aria-pressed': on ? 'true' : 'false', html: (on ? icon('check', 14) + ' ' : '') + esc(whoName(who)) });
      if (on) b.disabled = true;
      b.onclick = () => {
        const r = G.equip(who, w.uid);
        if (!r.ok) return fail(r);
        audio.sfx('select');
        ui.toast(TXT.equipped(A.weaponName(w), whoName(who)), { icon: 'sword' });
      };
      eq.append(b);
    }
    body.append(eq);
    // sacar, desarmar y cerrar
    const ft = h('div.ars-acts');
    if (holder) {
      const ub = h('button.btn.small.ghost', { 'data-unequip': holder, html: esc(TXT.unequip) });
      ub.onclick = () => doUnequip(holder);
      ft.append(ub);
    }
    const mats = A.scrapValue(w, T.talentMods(s).scrap);
    const sb = h('button.btn.small' + (holder ? '.ghost' : ''), { 'data-scrap': String(w.uid), title: holder ? TXT.scrapLocked : TXT.scrap, html: `${icon('hammer', 14)} ${esc(TXT.scrap)} ${costHtml({ mats }, 13)}` });
    if (holder) sb.disabled = true;
    sb.onclick = async () => {
      if (holder) return fail(null, TXT.scrapLocked);
      audio.sfx('tap');
      const name = A.weaponName(w);
      if (!(await ui.confirm(TXT.scrapTitle, esc(TXT.scrapText(name, '§')).replace('§', costHtml({ mats }, 18)), TXT.scrapOk, TXT.scrapNo))) return;
      const r = G.scrap(w.uid);
      if (!r.ok) return fail(r);
      audio.sfx('build');
      ui.toast(TXT.scrapped, { icon: 'hammer' });
      open = null;
    };
    ft.append(sb, h('span.grow'));
    const cl = h('button.btn.small.ghost', { 'data-close-weapon': '1', html: esc(TXT.less) });
    cl.onclick = toggle;
    ft.append(cl);
    body.append(ft);
    el.append(body);
    return el;
  }

  function doUnequip(who) {
    const r = G.unequip(who);
    if (!r.ok) return fail(r);
    audio.sfx('select');
    ui.toast(TXT.unequipped(whoName(who)), { icon: 'info' });
  }

  function render(resetScroll = false) {
    if (sh.closed) return;
    const y = resetScroll ? 0 : pane.scrollTop;
    renderTop();
    pane.innerHTML = '';
    const a = A.arsenalState(s);
    pane.append(h('div.ars-h', { html: `${icon('people', 18)} ${esc(TXT.who)}` }));
    const wg = h('div.ars-who');
    for (const who of A.WIELDERS) wg.append(whoCard(who));
    pane.append(wg);
    pane.append(h('div.ars-h', { html: `${icon('sword', 18)} ${esc(TXT.list)}` }));
    const list = h('div.ars-list');
    const eqd = new Set(Object.values(a.equipped));
    const items = a.items.filter(w => type === 'all' || w.type === type)
      .sort((x, y2) => (eqd.has(y2.uid) - eqd.has(x.uid)) || (A.weaponPower(y2) - A.weaponPower(x)) || ((y2.at || 0) - (x.at || 0)));
    for (const w of items) list.append(weaponCard(w));
    if (!items.length) list.append(h('div.ars-empty', {}, a.items.length ? TXT.emptyType : TXT.empty));
    pane.append(list);
    pane.scrollTop = y;
  }

  render(true);
  sh.on(bus, 'arsenal:changed', () => render());
  sh.on(bus, 'talents:changed', () => render());
  return sh.done;
}
