// Pestaña "Progreso" de la Bitácora (El Quiebre, paso 5b segunda parte: L5; DESIGN-COMBAT.md §15). Junta en un solo
// lugar todo lo que sube, y en cada fila dice qué falta para el próximo nivel: rango y Época, nivel del líder, clases,
// la gente de la ciudad con su Vínculo y su herramienta, elementos, la Grieta y las páginas del diario.
import { icon } from '../core/icons.js';
import * as E from '../core/economy.js';
import * as K from '../core/classes.js';
import * as PE from '../core/people.js';
import { BOND_MAX, TOOL_MAX, TOOLS } from '../core/people-data.js';
import { CLASSES, SUBCLASSES, LEADER } from '../combat/classes.js';
import { eraDef } from '../core/data.js';
import { PAGES, ELEMENTS } from '../story/story-data.js';
import * as RZ from '../core/raiz.js';
import { openClassPicker } from './class-pick.js';

const CSS = `
.pnl-story .pg-row { display: grid; grid-template-columns: 44px 1fr auto; gap: 2px 12px; align-items: center; padding: 10px 12px; background: var(--surface); border: 2px solid var(--edge); border-radius: 12px; }
.pnl-story .pg-row + .pg-row { margin-top: 6px; }
.pnl-story .pg-row .pg-ic { grid-row: span 3; display: grid; place-items: center; width: 44px; height: 44px; background: var(--panel-2); border: 2px solid var(--edge); border-radius: 10px; }
.pnl-story .pg-row b { font-size: 16px; }
.pnl-story .pg-row .pg-lv { font-weight: 700; color: var(--gold-t); font-size: 15px; white-space: nowrap; }
.pnl-story .pg-row small { grid-column: 2 / -1; color: var(--ink-l); font-size: 13px; line-height: 1.25; }
.pnl-story .pg-row .pnl-prog { grid-column: 2 / -1; }
.pnl-story .pg-row .pg-acts { grid-column: 1 / -1; display: flex; gap: 6px; flex-wrap: wrap; margin-top: 6px; }
.pnl-story .pg-row.locked { border-style: dashed; border-color: var(--rule); color: var(--ink-ll); }
.pnl-story .pg-row.locked b { color: var(--ink-l); }
.pnl-story .pg-pips { display: inline-flex; gap: 3px; vertical-align: middle; margin-left: 6px; }
.pnl-story .pg-pips i { width: 9px; height: 9px; border-radius: 2px; background: var(--track); border: 1px solid var(--edge); }
.pnl-story .pg-pips i.on { background: var(--gold); }
`;
let styled = false;
const pips = (n, max) => `<span class="pg-pips">${Array.from({ length: max }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</span>`;
const REQ = { charm: 'Encanto', planos: 'planos', level: 'nivel', monuments: 'monumentos', buildings: 'edificios', zones: 'zonas', pop: 'población', happy: 'felicidad', shops: 'comercios' };

/** Arma el panel. rerender(): vuelve a dibujar la pestaña (después de entregar o mejorar). */
export function progressPane(ctx, rerender) {
  if (!styled) { styled = true; const st = document.createElement('style'); st.textContent = CSS; document.head.append(st); }
  const { ui, audio } = ctx;
  const { h, esc, progressHtml } = ui;
  const s = ctx.state;
  const wrap = h('div.col.pnl-gap.pg');
  const bar = (into, need, label) => `<div class="pnl-prog sm">${progressHtml(need ? into / need : 1)}<b>${esc(label)}</b></div>`;
  const row = (ic, title, lv, body, cls = '', attrs = {}) => h('div.pg-row' + cls, { ...attrs, html: `<span class="pg-ic">${icon(ic, 30)}</span><b>${title}</b><span class="pg-lv">${lv}</span>${body}` });
  const sec = (ic, t) => wrap.append(h('div.st-h', { html: `${icon(ic, 18)} ${esc(t)}` }));

  // rango y Época
  sec('crown', 'La ciudad');
  try {
    const rs = E.rankStatus(s), era = eraDef(E.cityEra(s));
    const miss = (rs.reqs || []).filter(r => !r.ok).map(r => `${REQ[r.key] || r.key} ${E.fmtNum ? E.fmtNum(r.have) : r.have}/${r.need}`);
    const next = rs.next ? (miss.length ? `Para ${esc(rs.next.name)} falta: ${esc(miss.join(' · '))}` : `Ya se puede pasar a ${esc(rs.next.name)} desde la Municipalidad`) : 'Rango máximo';
    wrap.append(row('castle', esc(rs.def?.name || 'Aldea'), `Rango ${rs.rank}`, `<small>Época de ${esc(era.name)}. ${next}.</small>`, '', { 'data-pg': 'rango' }));
  } catch (e) { console.warn('[progreso] rango', e); }

  // quien lidera
  sec('star', 'Quien lidera');
  const li = K.leaderInfo(s);
  const cls = li.cls ? CLASSES[li.cls].name : 'Sin clase';
  const sub = li.sub ? SUBCLASSES[li.sub].name : '';
  const nextKey = li.next ? `En el nivel ${li.next.level}: ${esc(li.next.text)}.` : '';
  const lead = row('xp', `${esc(s.player?.name || 'Quien lidera')} · ${esc(cls)}${sub ? ' · ' + esc(sub) : ''}`, `Nivel ${li.level}`,
    (li.xp.max ? '<small>Nivel máximo.</small>' : bar(li.xp.into, li.xp.need, `${li.xp.into}/${li.xp.need}`))
    + `<small>${li.cls ? '' : 'Todavía no tiene clase: elegila acá abajo. '}Experiencia de salidas, peleas y amenazas aguantadas. ${nextKey}</small>`, '', { 'data-pg': 'lider', 'data-level': String(li.level), 'data-cls': li.cls || '' });
  // elegir o cambiar la clase (paso 5b, tercera parte)
  const la = h('div.pg-acts');
  const cb = h('button.btn.small' + (li.cls ? '' : '.primary'), { 'data-pick-class': '1', html: `${icon('people', 18)} ${li.cls ? 'Cambiar clase' : 'Elegir clase'}` });
  cb.onclick = async () => { audio.sfx('tap'); if (await openClassPicker(ctx)) rerender(); };
  la.append(cb);
  lead.append(la);
  wrap.append(lead);

  // clases de la ciudad
  const cc = K.cityClasses(s);
  if (cc.length) {
    sec('people', 'El grupo');
    for (const c of cc) {
      const m = K.memberInfo(c.id, s);
      const capTxt = m.level >= m.cap && m.cap < 10 ? `Tope del edificio: mejoralo para pasar del nivel ${m.cap}.` : '';
      wrap.append(row('people', esc(m.name), `Nivel ${m.level}`, (m.xp.max ? '' : bar(m.xp.into, m.xp.need, `${m.xp.into}/${m.xp.need}`))
        + `<small>${esc(CLASSES[c.id].combat)} ${capTxt}</small>`, '', { 'data-pg': 'clase', 'data-cls': c.id }));
    }
  }

  // la gente de la ciudad y sus herramientas
  sec('hammer', 'La gente y sus herramientas');
  for (const p of PE.peopleInfo(s)) {
    const T = TOOLS[p.tool];
    if (!p.arrived) {
      wrap.append(row('lock', esc(p.name), '', `<small>${esc(p.arriveText)}. Trae: ${esc(T.name)}.</small>`, '.locked', { 'data-person': p.id }));
      continue;
    }
    let body = `<small>${esc(p.title[0].toUpperCase() + p.title.slice(1))}. Vínculo ${p.bond}${pips(p.bond, BOND_MAX)}</small>`;
    if (p.task) {
      body += `<small>Encargo: ${esc(p.task.text)}.</small>`;
      if (p.task.type !== 'deliver' && p.task.type !== 'flag') body += bar(p.task.have, p.task.need, `${p.task.have}/${p.task.need}`);
    } else body += '<small>Vínculo completo.</small>';
    body += `<small>${esc(T.name)} ${p.toolLevel}/${TOOL_MAX}: en combate, ${esc(T.combat)}; en la salida, ${esc(T.exp)}.</small>`;
    const el = row('hammer', esc(p.name), `${esc(T.name)} ${p.toolLevel}`, body, '', { 'data-person': p.id, 'data-bond': String(p.bond), 'data-tool': String(p.toolLevel) });
    const acts = h('div.pg-acts');
    if (p.task?.type === 'deliver') {
      const b = h('button.btn.small' + (p.task.canDeliver ? '.sky' : ''), { 'data-deliver': p.id, html: `${icon('gift', 18)} Entregar ${ui.costHtml ? ui.costHtml({ mats: p.task.mats }) : ''}` });
      b.onclick = () => { const r = PE.deliver(p.id); audio.sfx(r.ok ? 'reward' : 'error'); if (!r.ok) ui.toast(r.why, { icon: 'info' }); rerender(); };
      acts.append(b);
    }
    if (p.toolLevel < TOOL_MAX) {
      const u = p.upgrade;
      const b = h('button.btn.small' + (u.ok ? '.primary' : ''), { 'data-upgrade': p.id,
        html: `${icon('hammer', 18)} Mejorar a ${u.to || p.toolLevel + 1}${u.cost && ui.costHtml ? ' ' + ui.costHtml(u.cost) : ''}` });
      b.title = u.ok ? 'Se mejora en el Taller' : u.why;
      b.onclick = () => { const r = PE.upgradeTool(p.id); audio.sfx(r.ok ? 'build' : 'error'); if (!r.ok) ui.toast(r.why, { icon: 'info' }); rerender(); };
      acts.append(b);
      if (!u.ok) acts.append(h('small', { style: 'align-self:center;color:var(--ink-ll)' }, u.why));
    }
    if (acts.children.length) el.append(acts);
    wrap.append(el);
  }

  // elementos, Grieta y páginas
  sec('sparkle', 'El mundo');
  const els = s.story?.elements || [];
  wrap.append(row('sparkle', 'Elementos', `${els.length}/${ELEMENTS.length}`, `<small>${els.length ? esc(ELEMENTS.filter(e => els.includes(e.id)).map(e => e.name).join(', ')) + '. ' : ''}El próximo está en otra isla.</small>`, '', { 'data-pg': 'elementos' }));
  try {
    if (RZ.raizFound(s)) { const g = Math.round(RZ.grieta(s)); wrap.append(row('bolt', 'La Grieta', `${g}/100`, `<small>${esc(RZ.grietaText(g))}</small>`, '', { 'data-pg': 'grieta' })); }
    else wrap.append(row('lock', 'La Grieta', '', '<small>Se abre cuando encuentres el Núcleo de Raíz.</small>', '.locked', { 'data-pg': 'grieta' }));
  } catch {}
  const got = PAGES.filter(p => s.story?.pages?.[p.id]).length;
  wrap.append(row('quest', 'Páginas del diario', `${got}/${PAGES.length}`, bar(got, PAGES.length, `${got}/${PAGES.length}`) + '<small>Salen de la historia, las peleas grandes y los lugares de cada región.</small>', '', { 'data-pg': 'paginas' }));
  return wrap;
}
export { LEADER };
