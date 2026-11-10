// Pestaña "Progreso" de la Bitácora (El Quiebre, paso 5b segunda parte: L5; DESIGN-COMBAT.md §15; La Travesía, paso 2a).
// Junta en un solo lugar todo lo que sube y en cada fila dice qué falta para el próximo nivel. Orden (paso 2a):
//  - Nivel: el Nivel único con su barra, lo que abre el próximo Nivel clave, el paragon pasado el 50 y quien lidera
//    (clase, subclase y habilidades).
//  - Talentos: las 3 ramas (Mando, Supervivencia, Oficio), los puntos libres, el paragon y "Devolver puntos" (gear.js).
//  - Maestrías: los 7 tipos de arma (1–20) y los objetos del Taller (1–10), con lo próximo que abre cada una.
//  - Fuerza: la de la escuadra que sale por defecto en la Expedición, con su desglose, y el acceso al Arsenal.
//  - Después, como antes: rango y Época, las clases de la ciudad, la gente con su Vínculo y su herramienta, elementos,
//    la Grieta y las páginas del diario.
import { icon } from '../core/icons.js';
import * as E from '../core/economy.js';
import * as K from '../core/classes.js';
import * as PE from '../core/people.js';
import * as G from '../core/gear.js';
import * as A from '../core/arsenal.js';
import * as T from '../core/talents.js';
import { POWER_W } from '../core/power.js';
import { BOND_MAX, TOOL_MAX, TOOLS } from '../core/people-data.js';
import { CLASSES, SUBCLASSES, LEADER, NIVEL } from '../combat/classes.js';
import { ABILITIES, ITEMS, ITEM_IDS } from '../combat/combat-data.js';
import { eraDef } from '../core/data.js';
import { PAGES, ELEMENTS } from '../story/story-data.js';
import * as RZ from '../core/raiz.js';
import { openClassPicker, openKitPicker } from './class-pick.js';
import { t, tn } from '../core/i18n.js';

/**
 * Los textos de las secciones del 2a (claves progress.*, talents.*, power.* y arsenal.* de src/i18n/es.js): getters y
 * funciones, se resuelven al dibujar. El resto del archivo (rango, clases de la ciudad, gente, mundo) todavía tiene el
 * texto escrito en el código: se pasa a claves en el 4b.
 */
const TXT = {
  get nav() { return { nivel: t('progress.nav.nivel'), talentos: t('progress.nav.talentos'), maestrias: t('progress.nav.maestrias'), fuerza: t('progress.nav.fuerza'), ciudad: t('progress.nav.ciudad') }; },
  get nivel() { return t('progress.level'); }, get nivelMax() { return t('progress.levelMax'); }, combat: (n) => t('progress.combat', { n }),
  nextKey: (lv, text) => t('progress.nextKey', { lv, text }),
  get xpFrom() { return t('progress.xpFrom'); },
  get noClass() { return t('progress.noClass'); }, get noClassYet() { return t('progress.noClassYet'); },
  get pickClass() { return t('progress.pickClass'); }, get changeClass() { return t('progress.changeClass'); },
  get abilities() { return t('progress.abilities'); },
  get paragon() { return t('progress.paragon'); }, paragonText: (n) => tn('progress.paragonText', n, { max: NIVEL.max, step: NIVEL.paragonStep }),
  get arsenal() { return t('arsenal.title'); },
  get talents() { return t('progress.nav.talentos'); }, free: (n) => tn('progress.free', n),
  talentsHelp: (tot) => t('progress.talentsHelp', { n: tot }),
  spent: (n) => tn('progress.spent', n),
  get learn() { return t('progress.learn'); }, get reset() { return t('progress.reset'); }, get resetTitle() { return t('progress.resetTitle'); },
  get resetText() { return t('progress.resetText'); },
  get resetOk() { return t('progress.resetOk'); }, get resetNo() { return t('common.cancel'); }, get resetDone() { return t('progress.resetDone'); },
  paragonFree: (n) => t('progress.paragonFree', { n }), paragonAdd: '+1',
  get paragonLocked() { return t('progress.paragonLocked', { max: NIVEL.max }); },
  learned: (name, r) => `${name} ${r}`,
  get mastery() { return t('progress.nav.maestrias'); }, get masteryHelp() { return t('progress.masteryHelp'); },
  get weapons() { return t('progress.weapons'); }, get items() { return t('progress.items'); }, get itemsHelp() { return t('progress.itemsHelp'); },
  next: (lv, text) => t('progress.next', { lv, text }), get maxed() { return t('progress.maxed'); }, get uses() { return t('progress.uses'); },
  itemNext: (lv) => t('progress.itemNext', { lv }), itemFrame: (lv) => t('progress.itemFrame', { lv }),
  get power() { return t('power.name'); }, get powerHelp() { return t('power.help'); },
  get leader() { return t('arsenal.leader'); }, get tools() { return t('power.tools'); }, nivelPart: (n) => t('power.nivel', { n }),
  get noParty() { return t('power.noParty'); }, get noClassLow() { return t('power.noClass'); },
};

const CSS = `
.pnl-story .pg-row { display: grid; grid-template-columns: 44px 1fr auto; gap: 2px 12px; align-items: center; padding: 10px 12px; background: var(--surface); border: 2px solid var(--edge); border-radius: 12px; }
.pnl-story .pg-row + .pg-row { margin-top: 6px; }
.pnl-story .pg-row .pg-ic { grid-row: span 3; display: grid; place-items: center; width: 44px; height: 44px; background: var(--panel-2); border: 2px solid var(--edge); border-radius: 10px; }
.pnl-story .pg-row b { font-size: 16px; }
.pnl-story .pg-row b .pg-same { grid-column: auto; display: inline; font-size: 13px; font-weight: 700; color: var(--ink-l); }
.pnl-story .pg-row .pg-lv { font-weight: 700; color: var(--gold-t); font-size: 15px; white-space: nowrap; }
.pnl-story .pg-row small { grid-column: 2 / -1; color: var(--ink-l); font-size: 13px; line-height: 1.25; }
.pnl-story .pg-row .pnl-prog { grid-column: 2 / -1; }
.pnl-story .pg-row .pg-acts { grid-column: 1 / -1; display: flex; gap: 6px; flex-wrap: wrap; margin-top: 6px; }
.pnl-story .pg-row.locked { border-style: dashed; border-color: var(--rule); color: var(--ink-ll); }
.pnl-story .pg-row.locked b { color: var(--ink-l); }
.pnl-story .pg-pips { display: inline-flex; gap: 3px; vertical-align: middle; margin-left: 6px; }
.pnl-story .pg-pips i { width: 9px; height: 9px; border-radius: 2px; background: var(--track); border: 1px solid var(--edge); }
.pnl-story .pg-pips i.on { background: var(--gold); }
.pnl-story .pnl-pane { isolation: isolate; }   /* la barra fija no se sube a los modales de arriba (Arsenal) */
.pnl-story .pg-nav { position: sticky; top: -14px; z-index: 2; display: flex; gap: 6px; flex-wrap: wrap; margin: -14px -14px 0; padding: 10px 14px 8px; background: var(--panel); border-bottom: 2px solid var(--rule); }
.pnl-story .pg-nav button { padding: 3px 10px; font-family: inherit; font-size: 15px; color: var(--ink-l); background: var(--surface); border: 2px solid var(--edge); border-radius: 999px; cursor: pointer; }
.pnl-story .pg-nav button:hover { color: var(--ink); background: var(--surface-hover); }
.pnl-story .pg-nav button .badge { position: static; display: inline-block; margin-left: 4px; }
.pnl-story .pg-sec { scroll-margin-top: 54px; }
.pnl-story .pg-sub { margin: -4px 2px 8px; font-size: 13px; color: var(--ink-ll); line-height: 1.25; }
/* Nivel */
.pnl-story .pg-hero { display: grid; grid-template-columns: auto 1fr; gap: 4px 16px; align-items: center; padding: 12px 14px; background: var(--panel-2); border: var(--line) solid var(--edge); border-radius: 14px; box-shadow: inset 0 0 0 2px var(--metal); }
.pnl-story .pg-big { grid-row: span 3; display: flex; flex-direction: column; align-items: center; justify-content: center; min-width: 84px; padding: 4px 8px 6px; background: var(--surface); border: 2px solid var(--edge); border-radius: 12px; }
.pnl-story .pg-big small { font-size: 13px; letter-spacing: .1em; text-transform: uppercase; color: var(--ink-ll); }
.pnl-story .pg-big b { font-size: 48px; line-height: .95; color: var(--gold-t); }
.pnl-story .pg-hero .pg-who { font-size: 18px; }
.pnl-story .pg-hero .pg-who small { font-size: 14px; color: var(--ink-l); }
.pnl-story .pg-hero > small { color: var(--ink-l); font-size: 13px; line-height: 1.25; }
.pnl-story .pg-hero .pg-acts { grid-column: 1 / -1; display: flex; gap: 6px; flex-wrap: wrap; margin-top: 6px; }
.pnl-story .pg-hero .pg-key { grid-column: 1 / -1; display: flex; align-items: center; gap: 8px; margin-top: 4px; padding: 6px 10px; font-size: 14px; color: var(--ink); background: var(--surface); border: 2px solid var(--edge); border-radius: 10px; }
.pnl-story .pg-hero .pg-key.paragon { color: var(--gold-t); }
.pnl-story .pg-hero .pg-key .pnl-prog { flex: 1; min-width: 120px; }
/* Talentos */
.pnl-story .pg-tal-top { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; }
.pnl-story .pg-tal-top .pg-free { padding: 3px 10px; font-size: 16px; font-weight: 700; color: var(--ink-dark); background: var(--gold); border: 2px solid var(--edge); border-radius: 999px; }
.pnl-story .pg-tal-top .pg-free.zero { color: var(--ink-l); background: var(--surface-2); }
.pnl-story .pg-tal-top .pg-free.par { background: var(--sky); }
.pnl-story .pg-tal-top .btn { margin-left: auto; }
.pnl-story .pg-branches { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
@media (max-width: 640px) { .pnl-story .pg-branches { grid-template-columns: 1fr; } }
.pnl-story .pg-branch { display: flex; flex-direction: column; gap: 6px; min-width: 0; padding: 8px; background: var(--surface); border: 2px solid var(--edge); border-radius: 12px; }
.pnl-story .pg-branch > header { display: flex; align-items: baseline; gap: 6px; padding: 0 2px 4px; border-bottom: 2px solid var(--rule); }
.pnl-story .pg-branch > header b { font-size: 18px; color: var(--gold-t); }
.pnl-story .pg-branch > header small { margin-left: auto; font-size: 13px; color: var(--ink-l); white-space: nowrap; }
.pnl-story .pg-branch > p { margin: 0 2px; font-size: 13px; color: var(--ink-ll); line-height: 1.2; }
.pnl-story .pg-tal { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; gap: 2px 6px; align-items: center; padding: 6px 8px; background: var(--surface-2); border: 2px solid var(--edge); border-radius: 10px; }
.pnl-story .pg-tal b { font-size: 15px; min-width: 0; }
.pnl-story .pg-tal .pg-rank { font-size: 14px; font-weight: 700; color: var(--ink-l); white-space: nowrap; }
.pnl-story .pg-tal.full .pg-rank { color: var(--gold-t); }
.pnl-story .pg-tal small { grid-column: 1 / -1; font-size: 13px; color: var(--ink-l); line-height: 1.2; }
.pnl-story .pg-tal small.need { color: var(--ink-ll); }
.modal.pnl-story .pg-tal .btn { grid-column: 3; grid-row: 1; min-height: 28px; height: 28px; min-width: 34px; justify-content: center; padding: 0 8px; font-size: 14px; }
.pnl-story .pg-tal.locked { border-style: dashed; border-color: var(--rule); background: transparent; }
.pnl-story .pg-tal.locked b { color: var(--ink-l); }
.pnl-story .pg-tal.par { background: var(--sky-l); }
/* Maestrías */
.pnl-story .pg-mast { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; }
@media (max-width: 640px) { .pnl-story .pg-mast { grid-template-columns: 1fr; } }
.pnl-story .pg-m { display: grid; grid-template-columns: 1fr auto; gap: 2px 8px; align-items: center; padding: 7px 10px; background: var(--surface); border: 2px solid var(--edge); border-radius: 10px; min-width: 0; }
.pnl-story .pg-m b { font-size: 16px; }
.pnl-story .pg-m b small { font-size: 13px; font-weight: 700; color: var(--mint-t); margin-left: 4px; }
.pnl-story .pg-m .pg-lv { font-size: 15px; font-weight: 700; color: var(--gold-t); white-space: nowrap; }
.pnl-story .pg-m .pnl-prog, .pnl-story .pg-m small { grid-column: 1 / -1; }
.pnl-story .pg-m small { font-size: 13px; color: var(--ink-l); line-height: 1.2; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pnl-story .pg-m.uses { box-shadow: inset 4px 0 0 var(--mint); }
.pnl-story .pg-h4 { margin: 12px 2px 6px; font-size: 15px; color: var(--ink-l); display: flex; align-items: baseline; gap: 8px; }
.pnl-story .pg-h4 small { font-size: 13px; color: var(--ink-ll); font-weight: 400; }
/* Fuerza */
.pnl-story .pg-pow { display: grid; grid-template-columns: auto 1fr; gap: 6px 16px; align-items: center; padding: 12px 14px; background: var(--panel-2); border: var(--line) solid var(--edge); border-radius: 14px; box-shadow: inset 0 0 0 2px var(--metal); }
.pnl-story .pg-pow .pg-big b { font-size: 40px; }
.pnl-story .pg-pow ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 3px; }
.pnl-story .pg-pow li { display: flex; align-items: baseline; gap: 8px; font-size: 15px; padding: 2px 0; border-bottom: 1px dashed var(--rule); }
.pnl-story .pg-pow li span { flex: 1; min-width: 0; color: var(--ink-l); }
.pnl-story .pg-pow li span small { color: var(--ink-ll); font-size: 13px; }
.pnl-story .pg-pow li b { font-size: 16px; color: var(--ink); }
.pnl-story .pg-pow > small { grid-column: 1 / -1; color: var(--ink-ll); font-size: 13px; line-height: 1.25; }
.pnl-story .pg-pow .pg-acts { grid-column: 1 / -1; display: flex; gap: 6px; flex-wrap: wrap; }
`;
let styleEl = null;
const pips = (n, max) => `<span class="pg-pips">${Array.from({ length: max }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</span>`;
const REQ = { charm: 'Encanto', planos: 'planos', level: 'nivel', monuments: 'monumentos', buildings: 'edificios', zones: 'zonas', pop: 'población', happy: 'felicidad', shops: 'comercios' };
const fmt = (n) => (E.fmtNum ? E.fmtNum(n) : String(n));

/** Lo próximo que abre la maestría de un tipo de arma: { lv, name, text } o null. */
function nextWeaponUnlock(type, level) {
  for (let lv = level + 1; lv <= A.MASTERY_MAX; lv++) { const u = A.masteryUnlock(type, lv); if (u) return { lv, ...u }; }
  return null;
}

/**
 * Arma el panel. rerender(): vuelve a dibujar la pestaña (después de entregar o mejorar). opts.focus: sección a la que
 * ir al abrir ('nivel' | 'talentos' | 'maestrias' | 'fuerza' | 'ciudad').
 */
export function progressPane(ctx, rerender, opts = {}) {
  if (!styleEl?.isConnected) { styleEl = document.createElement('style'); styleEl.id = 'pnl-progress-style'; styleEl.textContent = CSS; document.head.append(styleEl); }
  const { ui, audio } = ctx;
  const { h, esc, progressHtml } = ui;
  const s = ctx.state;
  const wrap = h('div.col.pnl-gap.pg');
  const bar = (into, need, label) => `<div class="pnl-prog sm">${progressHtml(need ? into / need : 1)}<b>${esc(label)}</b></div>`;
  const row = (ic, title, lv, body, cls = '', attrs = {}) => h('div.pg-row' + cls, { ...attrs, html: `<span class="pg-ic">${icon(ic, 30)}</span><b>${title}</b><span class="pg-lv">${lv}</span>${body}` });
  const sec = (ic, t, id = null) => { const el = h('div.st-h' + (id ? '.pg-sec' : ''), { html: `${icon(ic, 18)} ${esc(t)}`, ...(id ? { 'data-sec': id } : {}) }); wrap.append(el); return el; };
  const fail = (r) => { audio.sfx('error'); if (r?.why) ui.toast(r.why, { icon: 'info' }); };
  const tp = T.talentPoints(s);

  // ---------- atajos a cada sección ----------
  const nav = h('div.pg-nav', { role: 'navigation' });
  for (const [id, label] of Object.entries(TXT.nav)) {
    const n = id === 'talentos' ? tp.free + tp.paragon.free : 0;
    nav.append(h('button', { type: 'button', 'data-go': id, html: esc(label) + (n ? `<i class="badge">${n}</i>` : ''),
      onclick: () => { audio.sfx('select'); goTo(id); } }));
  }
  wrap.append(nav);
  function goTo(id) {
    const el = wrap.querySelector(`[data-sec="${id}"]`);
    const pane = wrap.parentElement;
    if (!el || !pane) return;
    const top = pane.scrollTop + el.getBoundingClientRect().top - pane.getBoundingClientRect().top - nav.offsetHeight - 2;
    pane.scrollTop = Math.max(0, top);   // sin 'smooth': con la ventana en segundo plano el desplazamiento suave se frena
  }

  // ---------- Nivel (y quien lidera) ----------
  sec('star', TXT.nav.nivel, 'nivel');
  const li = K.leaderInfo(s);
  const cls = li.cls ? CLASSES[li.cls].name : TXT.noClass;
  const sub = li.sub ? SUBCLASSES[li.sub].name : '';
  const nextKey = li.next ? TXT.nextKey(li.next.level, li.next.text) : '';
  const lead = h('div.pg-hero', { 'data-pg': 'lider', 'data-level': String(li.level), 'data-cls': li.cls || '', html:
    `<div class="pg-big"><small>${esc(TXT.nivel)}</small><b>${li.level}</b></div>`
    + `<b class="pg-who">${esc(s.player?.name || TXT.leader)} · ${esc(cls)}${sub ? ' · ' + esc(sub) : ''} <small>(${esc(TXT.combat(li.combat))})</small></b>`
    + (li.xp.max ? `<small>${esc(TXT.nivelMax)}.</small>` : bar(li.xp.into, li.xp.need, `${fmt(li.xp.into)}/${fmt(li.xp.need)}`))
    + `<small>${li.cls ? '' : esc(TXT.noClassYet) + ' '}${esc(TXT.xpFrom)}</small>` });
  if (nextKey) lead.append(h('div.pg-key', { html: `${icon('sparkle', 18)}<span>${esc(nextKey)}</span>` }));
  if (li.xp.max) {
    lead.append(h('div.pg-key.paragon', { 'data-pg': 'paragon', html: `${icon('star', 18)}<span>${esc(TXT.paragon)} ${li.xp.paragon}</span>`
      + bar(li.xp.paragonInto, li.xp.paragonNeed, `${fmt(li.xp.paragonInto)}/${fmt(li.xp.paragonNeed)}`) }));
    lead.append(h('small', { style: 'grid-column: 1 / -1' }, TXT.paragonText(li.xp.paragon)));
  }
  // elegir o cambiar la clase (paso 5b, tercera parte), las activas y la subclase (cuarta parte) y el Arsenal (2a)
  const la = h('div.pg-acts');
  const cb = h('button.btn.small' + (li.cls ? '' : '.primary'), { 'data-pick-class': '1', html: `${icon('people', 18)} ${esc(li.cls ? TXT.changeClass : TXT.pickClass)}` });
  cb.onclick = async () => { audio.sfx('tap'); if (await openClassPicker(ctx)) rerender(); };
  la.append(cb);
  if (li.cls) {
    const kb = h('button.btn.small', { 'data-kit': 'leader', html: `${icon('star', 18)} ${esc(TXT.abilities)}` });
    kb.onclick = async () => { audio.sfx('tap'); if (await openKitPicker(ctx, 'leader')) rerender(); };
    la.append(kb);
  }
  la.append(arsenalButton());
  lead.append(la);
  wrap.append(lead);

  // ---------- Talentos ----------
  sec('sparkle', TXT.talents, 'talentos');
  wrap.append(h('p.pg-sub', {}, TXT.talentsHelp(T.TREE_POINTS)));
  const top = h('div.pg-tal-top', { 'data-pg': 'talentos', 'data-free': String(tp.free), 'data-paragon': String(tp.paragon.free) });
  top.append(h('span.pg-free' + (tp.free ? '' : '.zero'), {}, TXT.free(tp.free)));
  if (tp.paragon.total) top.append(h('span.pg-free.par' + (tp.paragon.free ? '' : '.zero'), {}, TXT.paragonFree(tp.paragon.free)));
  if (tp.spent || tp.paragon.spent) {
    const rb = h('button.btn.small.ghost', { 'data-talent-reset': '1', html: `${icon('rotate', 16)} ${esc(TXT.reset)}` });
    rb.onclick = async () => {
      audio.sfx('tap');
      if (!(await ui.confirm(TXT.resetTitle, esc(TXT.resetText), TXT.resetOk, TXT.resetNo))) return;
      G.resetTalents(); audio.sfx('select'); ui.toast(TXT.resetDone, { icon: 'rotate' }); rerender();
    };
    top.append(rb);
  }
  wrap.append(top);
  const T_ = T.talentsState(s);
  const branches = h('div.pg-branches');
  for (const b of T.BRANCH_IDS) {
    const B = T.BRANCHES[b];
    const col = h('div.pg-branch', { 'data-branch': b, html: `<header><b>${esc(B.name)}</b><small>${esc(TXT.spent(tp.byBranch[b]))}</small></header><p>${esc(B.text)}</p>` });
    for (const id of T.TALENT_IDS.filter(i => T.TALENTS[i].branch === b)) {
      const t = T.TALENTS[id], r = T_.ranks[id] || 0;
      const c = T.canLearn(s, id);
      const locked = tp.byBranch[b] < t.need;
      const el = h('div.pg-tal' + (locked ? '.locked' : '') + (r >= t.max ? '.full' : ''), { 'data-talent': id, 'data-rank': String(r),
        html: `<b>${esc(t.name)}</b><span class="pg-rank">${r}/${t.max}</span><small>${esc(t.text)}</small>`
          + (locked ? `<small class="need">${icon('lock', 12)} ${esc(T.TXT.needBranch(t.need, B.name))}</small>` : '') });
      if (r < t.max && !locked) {
        const btn = h('button.btn.small' + (c.ok ? '.mint' : '.ghost'), { 'data-learn': id, html: `${icon('plus', 14)}`, title: c.ok ? TXT.learn : c.why, 'aria-label': `${TXT.learn} ${t.name}` });
        if (!c.ok) btn.disabled = true;
        btn.onclick = () => { const res = G.learn(id); if (!res.ok) return fail(res); audio.sfx('select'); rerender(); };
        el.append(btn);
      }
      col.append(el);
    }
    // paragon de la rama
    if (tp.paragon.total) {
      const n = T_.paragon[b] || 0;
      const pe = h('div.pg-tal.par', { 'data-paragon': b, html: `<b>${esc(B.paragon.name)}</b><span class="pg-rank">${n}</span><small>${esc(B.paragon.text)}</small>` });
      const pb = h('button.btn.small' + (tp.paragon.free ? '.sky' : '.ghost'), { 'data-learn-paragon': b, html: esc(TXT.paragonAdd), title: tp.paragon.free ? B.paragon.name : T.TXT.noParagon });
      if (!tp.paragon.free) pb.disabled = true;
      pb.onclick = () => { const res = G.learnParagon(b); if (!res.ok) return fail(res); audio.sfx('select'); rerender(); };
      pe.append(pb);
      col.append(pe);
    }
    branches.append(col);
  }
  wrap.append(branches);
  if (!tp.paragon.total) wrap.append(h('p.pg-sub', { style: 'margin-top: 6px' }, TXT.paragonLocked));

  // ---------- Maestrías ----------
  sec('trophy', TXT.mastery, 'maestrias');
  wrap.append(h('p.pg-sub', {}, TXT.masteryHelp));
  const ars = A.arsenalState(s);
  const leadType = A.wieldType(s, 'lider', li.cls);
  wrap.append(h('div.pg-h4', { html: `${esc(TXT.weapons)} <small>1–${A.MASTERY_MAX}</small>` }));
  const mw = h('div.pg-mast');
  for (const type of A.WEAPON_IDS) {
    const W = A.WEAPON_TYPES[type];
    const mi = A.masteryXpInfo(ars.mastery[type] || 0);
    const nx = nextWeaponUnlock(type, mi.level);
    const uses = type === leadType;
    mw.append(h('div.pg-m' + (uses ? '.uses' : ''), { 'data-mastery': type, 'data-level': String(mi.level),
      title: nx ? `${nx.name}: ${nx.text}` : TXT.maxed,
      html: `<b>${esc(W.name)}${uses ? `<small>${esc(TXT.uses)}</small>` : ''}</b><span class="pg-lv">${mi.level}/${A.MASTERY_MAX}</span>`
        + (mi.max ? '' : bar(mi.into, mi.need, `${fmt(mi.into)}/${fmt(mi.need)}`))
        + `<small>${esc(nx ? TXT.next(nx.lv, nx.name) : TXT.maxed)}</small>` }));
  }
  wrap.append(mw);
  wrap.append(h('div.pg-h4', { html: `${esc(TXT.items)} <small>1–${A.ITEM_MASTERY_MAX} · ${esc(TXT.itemsHelp)}</small>` }));
  const mo = h('div.pg-mast');
  for (const id of ITEM_IDS) {
    const it = ITEMS[id];
    if (!it) continue;
    const mi = A.masteryXpInfo(ars.itemMastery[id] || 0, A.ITEM_MASTERY_MAX);
    const plusAt = A.ITEM_MASTERY_PLUS_AT.find(l => l > mi.level);
    const nxt = plusAt ? TXT.itemNext(plusAt) : mi.level < A.ITEM_MASTERY_MAX ? TXT.itemFrame(A.ITEM_MASTERY_MAX) : TXT.maxed;
    const plus = A.itemMasteryPlus(ars.itemMastery[id] || 0);
    mo.append(h('div.pg-m', { 'data-item-mastery': id, 'data-level': String(mi.level), title: it.text,
      html: `<b>${esc(it.name)}${plus ? `<small>+${plus}</small>` : ''}</b><span class="pg-lv">${mi.level}/${A.ITEM_MASTERY_MAX}</span>`
        + (mi.max ? '' : bar(mi.into, mi.need, `${fmt(mi.into)}/${fmt(mi.need)}`))
        + `<small>${esc(nxt)}</small>` }));
  }
  wrap.append(mo);

  // ---------- Fuerza ----------
  sec('bolt', TXT.power, 'fuerza');
  try {
    const party = ctx.expedition?.defaultParty ? ctx.expedition.defaultParty(s) : [];
    const pw = G.currentPower(party, s, { tools: PE.toolLevels(s) });
    const lw = A.equippedOn(s, 'lider');
    const items = [
      [`${esc(TXT.leader)} <small>· ${esc(li.cls ? CLASSES[li.cls].name : TXT.noClassLow)}${lw ? ' · ' + esc(A.weaponName(lw)) : ''}</small>`, Math.round(pw.leader)],
      ...pw.members.map(m => { const w = A.equippedOn(s, m.cls); return [`${esc(CLASSES[m.cls]?.name || m.cls)}${w ? ` <small>· ${esc(A.weaponName(w))}</small>` : ''}`, Math.round(m.power)]; }),
      [esc(TXT.tools), Math.round(pw.tools)],
      [esc(TXT.nivelPart(pw.nivel)), POWER_W.nivel * pw.nivel],
    ];
    const box = h('div.pg-pow', { 'data-pg': 'fuerza', 'data-power': String(pw.total), html:
      `<div class="pg-big"><small>${esc(TXT.power)}</small><b>${fmt(pw.total)}</b></div>`
      + `<ul>${items.map(([k, v]) => `<li><span>${k}</span><b>${fmt(v)}</b></li>`).join('')}</ul>`
      + `<small>${pw.members.length ? '' : esc(TXT.noParty) + ' '}${esc(TXT.powerHelp)}</small>` });
    box.append(h('div.pg-acts', {}, arsenalButton(true)));
    wrap.append(box);
  } catch (e) { console.warn('[progreso] fuerza', e); }

  // ---------- rango y Época ----------
  sec('castle', 'La ciudad', 'ciudad');
  try {
    const rs = E.rankStatus(s), era = eraDef(E.cityEra(s));
    const miss = (rs.reqs || []).filter(r => !r.ok).map(r => `${REQ[r.key] || r.key} ${fmt(r.have)}/${r.need}`);
    const next = rs.next ? (miss.length ? `Para ${esc(rs.next.name)} falta: ${esc(miss.join(' · '))}` : `Ya se puede pasar a ${esc(rs.next.name)} desde la Municipalidad`) : 'Rango máximo';
    wrap.append(row('castle', esc(rs.def?.name || 'Aldea'), `Rango ${rs.rank}`, `<small>Época de ${esc(era.name)}. ${next}.</small>`, '', { 'data-pg': 'rango' }));
  } catch (e) { console.warn('[progreso] rango', e); }

  // clases de la ciudad
  const cc = K.cityClasses(s);
  if (cc.length) {
    sec('people', 'El grupo');
    for (const c of cc) {
      const m = K.memberInfo(c.id, s);
      const capTxt = m.level >= m.cap && m.cap < 10 ? `Tope del edificio: mejoralo para pasar del nivel ${m.cap}.` : '';
      const picks = m.picks.map(id => ABILITIES[id]?.name || id).join(' y ');
      // la de la misma clase que quien lidera es otra persona: "Cazador de la ciudad" (recorrido de la noche, A)
      const same = li.cls === c.id;
      const w = A.equippedOn(s, c.id);
      const mr = row('people', esc(m.name) + (same ? ' <small class="pg-same">de la ciudad</small>' : ''), `Nivel ${m.level}`, (m.xp.max ? '' : bar(m.xp.into, m.xp.need, `${m.xp.into}/${m.xp.need}`))
        + `<small>${esc(CLASSES[c.id].combat)} Activas: ${esc(picks)}.${w ? ` Arma: ${esc(A.weaponName(w))}.` : ''} ${capTxt}</small>`, '', { 'data-pg': 'clase', 'data-cls': c.id, 'data-picks': m.picks.join(',') });
      const ma = h('div.pg-acts');
      const kb = h('button.btn.small', { 'data-kit': c.id, html: `${icon('star', 18)} Habilidades` });
      kb.onclick = async () => { audio.sfx('tap'); if (await openKitPicker(ctx, c.id)) rerender(); };
      ma.append(kb);
      mr.append(ma);
      wrap.append(mr);
    }
  }

  // la gente de la ciudad y sus herramientas
  sec('hammer', 'La gente y sus herramientas');
  for (const p of PE.peopleInfo(s)) {
    const Tl = TOOLS[p.tool];
    if (!p.arrived) {
      wrap.append(row('lock', esc(p.name), '', `<small>${esc(p.arriveText)}. Trae: ${esc(Tl.name)}.</small>`, '.locked', { 'data-person': p.id }));
      continue;
    }
    let body = `<small>${esc(p.title[0].toUpperCase() + p.title.slice(1))}. Vínculo ${p.bond}${pips(p.bond, BOND_MAX)}</small>`;
    if (p.task) {
      body += `<small>Encargo: ${esc(p.task.text)}.</small>`;
      if (p.task.type !== 'deliver' && p.task.type !== 'flag') body += bar(p.task.have, p.task.need, `${p.task.have}/${p.task.need}`);
    } else body += '<small>Vínculo completo.</small>';
    body += `<small>${esc(Tl.name)} ${p.toolLevel}/${TOOL_MAX}: en combate, ${esc(Tl.combat)}; en la salida, ${esc(Tl.exp)}.</small>`;
    const el = row('hammer', esc(p.name), `${esc(Tl.name)} ${p.toolLevel}`, body, '', { 'data-person': p.id, 'data-bond': String(p.bond), 'data-tool': String(p.toolLevel) });
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

  if (opts.focus) for (const ms of [30, 400]) setTimeout(() => goTo(opts.focus), ms);   // ya en el panel (el que llama lo agrega después)
  return wrap;

  function arsenalButton(primary = false) {
    const n = A.arsenalState(s).items.length;
    const b = h('button.btn.small' + (primary ? '.sky' : ''), { 'data-open-arsenal': '1', html: `${icon('sword', 18)} ${esc(TXT.arsenal)}${n ? ` <small>(${n})</small>` : ''}` });
    b.onclick = async () => { audio.sfx('tap'); await ctx.openPanel('arsenal'); rerender(); };
    return b;
  }
}
export { LEADER };
