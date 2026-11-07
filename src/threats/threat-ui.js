// Interfaz de las amenazas (DESIGN-CORE.md §3): cartel de la ciudad ("Crecida · en 4 días"), panel con la preparación y
// lo que está en riesgo, resultado de la defensa, "Mientras no estabas" y las cajas de la ficha de un edificio
// (dañado → reparar; defensa → contra qué y radio). Textos: Guía de tono de DESIGN.md (cálido y sobrio, sin reproches).
import { icon } from '../core/icons.js';
import { BUILDING_BY_ID, DEFENSES, RESERVES } from '../core/data.js';
import * as T from './threats.js';
import { THREAT_TYPES, effOf, defenseRadius, HOSPITAL_BONUS, AUTO_REPAIR_H } from './threat-data.js';
import { autoResolve } from './threat-rules.js';

export const STYLE = `
.th-chip { display: flex; align-items: center; gap: 6px; padding: 6px 10px 6px 8px; background: #fff; border: 3px solid var(--ink); border-radius: 14px;
  box-shadow: 0 3px 0 var(--ink); font: inherit; font-size: 14px; font-weight: 700; color: var(--ink); cursor: pointer; white-space: nowrap; max-width: 210px; }
.th-chip span { overflow: hidden; text-overflow: ellipsis; }
.th-chip.today { background: #fff3df; animation: th-pulse 1.6s ease-in-out infinite; }
.th-chip.signs { background: #f4f1ea; }
.th-chip:active { transform: translateY(3px); box-shadow: 0 0 0 var(--ink); }
@keyframes th-pulse { 50% { box-shadow: 0 3px 0 var(--ink), 0 0 0 5px rgba(238, 138, 92, 0.25); } }
.th-panel { display: flex; flex-direction: column; gap: 10px; }
.th-modal .modal-foot { flex-wrap: wrap; }
.th-modal .modal-foot .btn { flex: 1 1 140px; min-width: 0; white-space: normal; line-height: 1.1; }
.th-when { margin: 0; color: var(--ink-soft, #6b5d52); font-size: 14px; }
.th-prep { display: flex; flex-direction: column; gap: 4px; }
.th-prep .line, .th-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 14px; }
.th-list { display: flex; flex-direction: column; gap: 4px; max-height: 210px; overflow: auto; }
.th-row { padding: 5px 8px; border: 2px solid var(--ink); border-radius: 10px; background: #fff; cursor: pointer; text-align: left; font: inherit; font-size: 14px; color: var(--ink); }
.th-row b { font-weight: 700; }
.th-row .ok { color: #3d8a5a; } .th-row .no { color: #b8553f; }
.th-tip { margin: 0; font-size: 13px; color: var(--ink-soft, #6b5d52); }
.th-bar { position: absolute; left: 50%; transform: translateX(-50%); bottom: calc(var(--safe-b, 0px) + 12px); z-index: 30; display: flex; flex-direction: column; gap: 6px;
  background: #fff; border: 3px solid var(--ink); border-radius: 16px; box-shadow: 0 4px 0 var(--ink); padding: 8px 10px; width: min(420px, calc(100vw - 24px)); box-sizing: border-box; }
.th-bar h3 { margin: 0; font-size: 16px; display: flex; align-items: center; gap: 6px; justify-content: space-between; }
.th-bar .th-btns { display: flex; gap: 6px; }
.th-bar .th-btns .btn { flex: 1; min-width: 0; padding-left: 6px; padding-right: 6px; font-size: 14px; }
.th-bar .th-btns .btn.on { outline: 3px solid #ee8a5c; outline-offset: 1px; }
.th-bar .th-msg { font-size: 13px; color: var(--ink-soft, #6b5d52); min-height: 17px; }
.th-badge { font: 700 12px/1 inherit; background: #fff; border: 2px solid var(--ink); border-radius: 9px; padding: 3px 5px; display: flex; gap: 3px; align-items: center;
  white-space: nowrap; pointer-events: none; box-shadow: 0 2px 0 var(--ink); }
.th-badge.hit { background: #ffe4d6; } .th-badge.dead { background: #e8e2da; color: #6b5d52; } .th-badge.cov { background: #e3f4e8; }
.th-ray { font-size: 22px; pointer-events: none; animation: th-blink 0.8s steps(2) infinite; }
@keyframes th-blink { 50% { opacity: 0.35; } }
.th-tint { position: absolute; inset: 0; pointer-events: none; z-index: 1; transition: background 1.2s; }
.th-flash { position: absolute; inset: 0; pointer-events: none; z-index: 2; background: #fff; opacity: 0; }
.th-dmg { font-size: 18px; pointer-events: none; filter: drop-shadow(0 2px 0 rgba(0,0,0,0.25)); }
@media (max-width: 520px) { .th-chip { font-size: 13px; max-width: 170px; } }
`;
let styleEl = null;
export function ensureStyle() {
  if (styleEl && document.head.contains(styleEl)) return;
  styleEl = document.createElement('style');
  styleEl.id = 'threat-style';
  styleEl.textContent = STYLE;
  document.head.append(styleEl);
}

const pct = (v) => Math.round(v * 100) + '%';
const bName = (b) => BUILDING_BY_ID[b?.id]?.name || 'Edificio';
const fmtH = (ms) => { const h = Math.round(ms / 3600e3); return h >= 48 ? `${Math.floor(h / 24)} días` : h >= 24 ? `1 día y ${h - 24} h` : `${Math.max(1, h)} h`; };
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// ---------- cartel en la ciudad ----------
export function chipText(st) {
  if (!st) return '';
  const short = st.t.id === 'sim' ? 'Simulacro' : st.def.short;
  if (st.phase === 'hoy') return st.active ? `${short} · en curso` : `${short} · hoy`;
  return `${short} · ${st.when}`;
}
export function makeChip(onClick) {
  const el = document.createElement('button');
  el.className = 'th-chip';
  el.setAttribute('aria-label', 'Amenaza de la temporada');
  el.addEventListener('click', onClick);
  el.style.display = 'none';
  let sig = '';
  return {
    el,
    update(st) {
      const show = !!st && st.visible;
      el.style.display = show ? '' : 'none';
      if (!show) return;
      const s = [st.t.id, st.phase, st.when, !!st.active].join('|');
      if (s === sig) return;
      sig = s;
      el.className = 'th-chip' + (st.phase === 'hoy' ? ' today' : st.phase === 'señales' ? ' signs' : '');
      el.innerHTML = `${icon(st.def.icon, 20)}<span>${chipText(st)}</span>`;
    },
  };
}

// ---------- panel de la amenaza ----------
/**
 * Panel: cuándo llega, preparación, en riesgo (tocarlos los resalta), reservas, qué conviene construir y "Enfrentar".
 * hooks: { onFace(id), onHighlight(uid), onBuild(defId), onWorkshop() }
 */
export function openThreatPanel(ctx, hooks = {}) {
  ensureStyle();
  const { ui, audio } = ctx;
  const st = T.threatStatus();
  if (!st) { ui.toast('No hay ninguna amenaza a la vista', { icon: 'info' }); return null; }
  const { def, info, t } = st;
  const body = ui.h('div.th-panel');
  const when = t.id === 'sim'
    ? (st.phase === 'hoy' ? 'Llegó el simulacro: hoy podés enfrentarlo.' : `Un simulacro para practicar, ${st.when}.`)
    : st.phase === 'hoy' ? 'Llegó. Podés enfrentarla hasta las 23:59.' : `Llega el sábado, ${st.when}.`;
  body.append(ui.h('p.th-when', { html: `${ui.esc(when)} Fuerza ${st.f}.` }));
  if (st.phase === 'señales' || st.phase === 'hoy') body.append(ui.h('p.th-tip', {}, def.sign));
  // preparación
  const prep = ui.h('div.cx-box.th-prep');
  if (!info.enRiesgo) {
    prep.append(ui.h('h4', { html: icon('🛡️', 20) + 'Preparación' }), ui.h('div.line', { html: `<span>Por ahora no hay nada expuesto: si pasa así, pasa sola. ${ui.esc(def.risk)}</span>` }));
  } else {
  prep.append(ui.h('h4', { html: icon('🛡️', 20) + `Preparación ${info.pct}%` }), ui.h('div', { html: ui.progressHtml(info.prep, info.prep >= 0.7 ? 'xp' : 'gold') }));
  const resName = RESERVES[st.reserve]?.name || 'Reservas';
  prep.append(ui.h('div.line', { html: `<span>Defensas que cubren</span><b>${pct(info.c)}</b>` }));
  prep.append(ui.h('div.line', { html: `<span>${icon(RESERVES[st.reserve]?.icon || '📦', 16)} ${ui.esc(resName)}</span><b>${info.have}/${info.need}</b>` }));
  const auto = autoResolve(info.prep, st.f, info.enRiesgo);
  prep.append(ui.h('div.line', { html: `<span class="muted">Si no estás, se resuelve sola: salvarías cerca del ${auto.pct}%</span>` }));
  }
  body.append(prep);
  // en riesgo
  const list = ui.h('div.th-list');
  for (const x of info.list) {
    const b = ctx.state.city.buildings.find(o => o.uid === x.uid);
    const by = x.by != null ? ctx.state.city.buildings.find(o => o.uid === x.by) : null;
    const cov = by ? `<span class="ok">${icon('🛡️', 14)} ${ui.esc(bName(by))} · ${pct(x.eff)}</span>` : x.eff > 0 ? `<span class="ok">resiste ${pct(x.eff)}</span>` : '<span class="no">sin cubrir</span>';
    const row = ui.h('button.th-row', { html: `<b>${ui.esc(bName(b))}</b>${cov}` });
    row.addEventListener('click', () => { audio.sfx('tap'); m.close(); hooks.onHighlight?.(x.uid); });
    list.append(row);
  }
  if (info.list.length) {
    body.append(ui.h('h4', { html: icon('home', 18) + `En riesgo (${info.list.length})` }), list);
    body.append(ui.h('p.th-tip', {}, `${def.risk} Un ${BUILDING_BY_ID[def.defense].name} cerca los cubre: lo que queda en su radio resiste solo.`));
  }
  const actions = [];
  if (st.canFace) actions.push({ label: st.active ? 'Seguir la defensa' : 'Enfrentar', cls: 'primary', onClick: () => hooks.onFace?.(t.id) });
  actions.push({ label: `Construir ${def.defense === 'bomberos' ? 'Bomberos' : BUILDING_BY_ID[def.defense].name}`, cls: st.canFace ? 'sky' : 'primary', onClick: () => hooks.onBuild?.(def.defense) });
  actions.push({ label: 'Ir al Taller', cls: 'sky', onClick: () => hooks.onWorkshop?.() });
  const m = ui.modal({ title: T.threatName(t), content: body, className: 'cx-modal th-modal', icon: null, actions });
  return m;
}

// ---------- resultado ----------
export function resultTitle(p) {
  return p >= 100 ? 'Sin un rasguño' : p >= 90 ? 'La ciudad aguantó' : p >= 75 ? 'Bien aguantado' : p >= 50 ? 'Pasó, con algunos golpes' : 'Fue dura';
}
function damagedLine(n) {
  return n ? `Quedó ${n === 1 ? '1 edificio' : n + ' edificios'} para reparar: no producen hasta que los arregles.` : 'No quedó nada para reparar.';
}
/** Modal de resultado de una defensa jugada. */
export function openResult(ctx, res, name) {
  ensureStyle();
  const lines = [`Salvaste el <b>${res.pct}%</b>.`, damagedLine(res.damaged.length)];
  if (res.title) lines.push(`Título nuevo: <b>${ctx.ui.esc(res.title)}</b>.`);
  if (res.sparks) lines.push(`${icon('sparkle', 18)} +${res.sparks} chispas del Pase`);
  return ctx.ui.rewardModal({ title: resultTitle(res.pct), subtitle: name, reward: res.reward || {}, lines, party: res.pct >= 90 && !ctx.ui.reducedMotion(),
    buttons: [{ label: 'Volver a la ciudad', value: 'ok' }] });
}
/** "Mientras no estabas…": todo lo que se resolvió solo, en un solo aviso. */
export async function openReport(ctx) {
  ensureStyle();
  const rep = T.reportStatus();
  if (!rep) return false;
  const lines = [];
  const total = { coins: 0, gems: 0, mats: {}, planos: 0 };
  for (const it of rep.items) {
    const past = it.id === 'sim' ? 'Pasó el simulacro' : THREAT_TYPES[it.type]?.past || 'Pasó la amenaza';
    lines.push(`${icon(THREAT_TYPES[it.type]?.icon || '🌊', 18)} ${past}: salvaste el <b>${it.pct}%</b>. ${damagedLine(it.damaged?.length || 0)}`);
    const r = it.reward || {};
    total.coins += r.coins || 0; total.gems += r.gems || 0; total.planos += r.planos || 0;
    for (const [k, v] of Object.entries(r.mats || {})) total.mats[k] = (total.mats[k] || 0) + v;
  }
  if (rep.mended.length) lines.push(`${icon('🔧', 18)} Lo arreglaron entre todos: ${rep.mended.map(b => ctx.ui.esc(bName(b))).join(', ')}.`);
  T.ackReport();
  await ctx.ui.rewardModal({ title: 'Mientras no estabas', reward: rep.items.length ? total : {}, lines, buttons: [{ label: 'Ver la ciudad', value: 'ok' }] });
  return true;
}

// ---------- ficha de un edificio ----------
/** Cajas para la ficha (city-ui openInfo): dañado → reparar; defensa → contra qué, radio y eficacia. */
export function infoBoxes(ctx, b, close) {
  ensureStyle();
  const { ui, audio, store } = ctx;
  const out = [];
  const ri = T.repairInfo(b);
  if (ri) {
    const box = ui.h('div.cx-box.th-dmgbox');
    box.append(ui.h('h4', { html: icon('🔧', 20) + `Dañado por ${ri.type === 'crecida' ? 'la crecida' : ri.type === 'sequia' ? 'la sequía' : ri.type === 'incendio' ? 'el incendio' : ri.type === 'tormenta' ? 'la tormenta' : 'la helada'}` }));
    box.append(ui.h('div.line', { html: '<span>No produce ni se puede mejorar hasta repararlo.</span>' }));
    box.append(ui.h('div.line', { html: `<span class="muted">Si no, la vecindad lo arregla sola en ${fmtH(ri.autoIn)}.</span>` }));
    const can = T.canRepair(b);
    box.append(ui.h('button.btn.gold', { html: `Reparar ${ui.costHtml(ri.cost, 16)}`, disabled: !can.ok, onclick: () => {
      const r = T.repair(b.uid);
      if (r.error) { audio.sfx('error'); ui.toast(r.error, { icon: 'info' }); return; }
      audio.sfx('build'); ui.toast(`${bName(b)} quedó como nuevo`, { icon: '🔧', type: 'good' }); close?.();
    } }));
    if (!can.ok) box.append(ui.h('div.line', { html: `<span class="muted">${ui.esc(can.reason)}</span>` }));
    const all = T.repairAllInfo();
    if (all.list.length > 1) box.append(ui.h('button.btn.sky', { html: `Reparar todo (${all.list.length}) ${ui.costHtml(all.cost, 16)}`, disabled: !all.ok, onclick: () => {
      const n = T.repairAll();
      if (!n) { audio.sfx('error'); ui.toast('No te alcanza para repararlos todos', { icon: 'info' }); return; }
      audio.sfx('build'); ui.toast(`Reparaste ${plural(n, 'edificio', 'edificios')}`, { icon: '🔧', type: 'good' }); close?.();
    } }));
    void store;
    out.push(box);
  }
  const dd = DEFENSES[b.id];
  if (dd && !b.buildEnd) {
    const L = b.level || 1;
    const box = ui.h('div.cx-box.th-defbox');
    box.append(ui.h('h4', { html: icon('🛡️', 20) + 'Defensa' }));
    if (dd.threat === '*') box.append(ui.h('div.line', { html: `<span>Contra todas: +${Math.round(HOSPITAL_BONUS * 100)}% de eficacia en su radio y una cuadrilla más</span>` }));
    else box.append(ui.h('div.line', { html: `<span>Contra ${ui.esc(THREAT_TYPES[dd.threat].name.toLowerCase())}</span><b>eficacia ${pct(effOf(L))}</b>` }));
    box.append(ui.h('div.line', { html: `<span>Radio</span><b>${defenseRadius(b.id, L)} casillas</b>` }));
    if (L < 5) box.append(ui.h('div.line', { html: `<span class="muted">Nivel ${L + 1}: radio ${defenseRadius(b.id, L + 1)}${dd.threat === '*' ? '' : ` · ${pct(effOf(L + 1))}`}</span>` }));
    out.push(box);
  }
  return out;
}
export { AUTO_REPAIR_H };
