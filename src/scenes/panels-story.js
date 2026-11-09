// Bitácora (plan §D y §H): la historia, el diario y el Manual. Se abre con J o el botón del riel del HUD.
//  - Historia: el acto y el capítulo, "Qué sigue" (el objetivo del capítulo y la misión actual con su botón), las escenas
//    vistas (se vuelven a leer) y "Volver a ver el prólogo".
//  - Diario: las páginas del diario del último intendente y los cuatro elementos.
//  - Progreso (paso 5b): rango y Época, nivel del líder, clases, la gente con su Vínculo y su herramienta, elementos,
//    Grieta y páginas, con lo que falta para el próximo nivel (src/scenes/panels-progress.js).
//  - Manual: capítulos que se abren al llegar a cada sistema, con buscador. Reemplaza el "Cómo jugar" viejo.
import { icon } from '../core/icons.js';
import { isOpen as featureOpen } from '../core/unlocks.js';
import { keyLabel, codeFor } from '../core/keys.js';
import { openShell, goalIcon, goalAction, progressLabel } from './panels-common.js';
import { ACTS, PAGES, ELEMENTS, MANUAL, CHARACTERS } from '../story/story-data.js';
import * as story from '../story/story.js';
import { portrait } from '../story/story-ui.js';
import * as RZ from '../core/raiz.js';
import { seenEchoes, ECHOES } from '../story/echoes.js';
import { progressPane } from './panels-progress.js';

const CSS = `
.pnl-story .pnl-tabs { grid-template-columns: repeat(4, 1fr); }
.pnl-story .st-chap { position: relative; padding: 14px 14px 12px; background: var(--panel-2); border: var(--line) solid var(--edge); border-radius: 14px; box-shadow: inset 0 0 0 2px var(--metal); }
.pnl-story .st-chap small { display: block; font-size: 13px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: var(--ink-ll); }
.pnl-story .st-chap h3 { margin: 2px 0 4px; font-size: 22px; color: var(--gold-t); }
.pnl-story .st-chap p { margin: 0; color: var(--ink-l); font-size: 15px; line-height: 1.25; }
.pnl-story .st-steps { display: flex; gap: 4px; margin-top: 10px; }
.pnl-story .st-steps i { flex: 1; height: 6px; border-radius: 3px; background: var(--track); border: 1px solid var(--edge); }
.pnl-story .st-steps i.on { background: var(--gold); }
.pnl-story .st-next { display: grid; grid-template-columns: 52px 1fr; gap: 4px 12px; align-items: center; padding: 12px; background: var(--surface); border: 2px solid var(--edge); border-radius: 12px; }
.pnl-story .st-next-ic { grid-row: span 2; display: grid; place-items: center; width: 52px; height: 52px; background: var(--panel-2); border: 2px solid var(--edge); border-radius: 12px; }
.pnl-story .st-next b { font-size: 17px; }
.pnl-story .st-next small { color: var(--ink-l); font-size: 14px; line-height: 1.2; }
.pnl-story .st-next .btn { grid-column: 1 / -1; margin-top: 6px; }
.pnl-story .st-next .pnl-prog { grid-column: 2; }
.pnl-story .st-h { margin: 16px 2px 8px; font-size: 15px; font-weight: 700; color: var(--ink-l); display: flex; align-items: center; gap: 6px; }
.pnl-story .st-scene { display: flex; align-items: center; gap: 10px; width: 100%; padding: 8px 10px; text-align: left; background: var(--surface); color: var(--ink);
  border: 2px solid var(--edge); border-radius: 12px; font-family: inherit; font-size: 15px; cursor: pointer; }
.pnl-story .st-scene:hover { background: var(--surface-hover); }
.pnl-story .st-scene canvas, .pnl-story .st-scene .st-noface { flex: none; width: 36px; height: 36px; image-rendering: pixelated; border: 2px solid var(--edge); border-radius: 8px; background: var(--surface-2); }
.pnl-story .st-scene span { display: flex; flex-direction: column; min-width: 0; }
.pnl-story .st-scene small { color: var(--ink-ll); font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pnl-story .st-acts { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
.pnl-story .st-act { padding: 8px; border: 2px dashed var(--rule); border-radius: 10px; color: var(--ink-ll); font-size: 13px; line-height: 1.2; }
.pnl-story .st-act b { display: block; color: var(--ink-l); font-size: 14px; }
.pnl-story .st-page { padding: 12px 14px; background: var(--surface); border: 2px solid var(--edge); border-radius: 12px; box-shadow: inset 4px 0 0 var(--gold-d); }
.pnl-story .st-page b { display: block; color: var(--gold-t); font-size: 16px; margin-bottom: 4px; }
.pnl-story .st-page p { margin: 0; font-size: 15px; line-height: 1.3; font-style: italic; color: var(--ink); }
.pnl-story .st-page.locked { box-shadow: none; border-style: dashed; border-color: var(--rule); color: var(--ink-ll); }
.pnl-story .st-page.locked b { color: var(--ink-ll); }
.pnl-story .st-page.locked p { color: var(--ink-ll); font-style: normal; }
.pnl-story .st-els { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
.pnl-story .st-el { display: grid; grid-template-columns: 40px 1fr; gap: 2px 10px; align-items: center; padding: 10px; background: var(--surface); border: 2px solid var(--edge); border-radius: 12px; }
.pnl-story .st-el.locked { opacity: .7; border-style: dashed; border-color: var(--rule); }
.pnl-story .st-el .pi { grid-row: span 2; }
.pnl-story .st-el small { color: var(--ink-l); font-size: 13px; line-height: 1.2; }
.pnl-story .st-search { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; padding: 6px 10px; background: var(--surface); border: 2px solid var(--edge); border-radius: 12px; }
.pnl-story .st-search input { flex: 1; min-width: 0; border: 0; outline: 0; background: transparent; color: var(--ink); font-family: inherit; font-size: 17px; }
.pnl-story .st-man-h { margin: 14px 2px 8px; display: flex; align-items: center; gap: 8px; font-size: 17px; }
.pnl-story .st-man-h:first-child { margin-top: 2px; }
.pnl-story .st-man-lock { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border: 2px dashed var(--rule); border-radius: 12px; color: var(--ink-ll); font-size: 14px; margin-bottom: 6px; }
.pnl-story .st-keys { display: grid; grid-template-columns: repeat(2, 1fr); gap: 4px 12px; font-size: 14px; color: var(--ink-l); }
.pnl-story .st-keys kbd { display: inline-block; min-width: 26px; padding: 1px 6px; margin-right: 6px; text-align: center; font-family: inherit; font-weight: 700; color: var(--ink);
  background: var(--surface-2); border: 2px solid var(--edge); border-radius: 6px; box-shadow: 0 2px 0 var(--shade); }
.pnl-story .st-empty { padding: 14px; text-align: center; color: var(--ink-ll); }
`;
let styleEl = null;
function injectStyle() {
  if (styleEl?.isConnected) return;
  styleEl = document.createElement('style');
  styleEl.id = 'pnl-story-style';
  styleEl.textContent = CSS;
  document.head.append(styleEl);
}

const TABS = [
  { id: 'historia', label: 'Historia', ic: '📖' },
  { id: 'diario', label: 'Diario', ic: 'quest' },
  { id: 'progreso', label: 'Progreso', ic: 'star' },
  { id: 'manual', label: 'Manual', ic: 'info' },
];

/** ¿Qué capítulos del Manual están abiertos? */
export function manualChapters(s) {
  const X = { isOpen: (id) => { try { return featureOpen(id, s); } catch { return false; } }, seen: (id) => story.hasSeen(id, s) };
  return MANUAL.map(c => { let open = false; try { open = !!c.open(s, X); } catch {} return { ...c, open }; });
}

export function openStory(ctx, params = {}) {
  injectStyle();
  const sh = openShell(ctx, 'story', { title: 'Bitácora', ic: '📖', sheet: true, className: 'pnl-flex pnl-story' });
  if (!sh) return;
  const { ui, audio, quests, economy } = ctx;
  const { h, esc, progressHtml } = ui;
  const s = ctx.state;
  let tab = TABS.some(t => t.id === params.tab) ? params.tab : 'historia';
  let query = '';

  const tabsEl = h('div.pnl-tabs', { role: 'tablist' });
  const pane = h('div.pnl-pane');
  sh.body.append(tabsEl, pane);
  const newPages = () => PAGES.filter(p => s.story?.pages?.[p.id] && !(s.story.read || {})[p.id]).length;

  function renderTabs() {
    tabsEl.innerHTML = '';
    const badge = { diario: newPages() };
    for (const t of TABS) {
      tabsEl.append(h('button.tab' + (t.id === tab ? '.active' : ''), {
        role: 'tab', 'aria-selected': t.id === tab ? 'true' : 'false', 'data-tab': t.id,
        html: `${icon(t.ic, 20)}<span>${t.label}</span>` + (badge[t.id] ? `<i class="badge">${badge[t.id]}</i>` : ''),
        onclick: () => { if (tab !== t.id) { audio.sfx('select'); tab = t.id; render(true); } },
      }));
    }
  }

  // ---------- Historia ----------
  function historiaPane() {
    const wrap = h('div.col.pnl-gap');
    const info = story.chapterInfo(s);
    const steps = info.act.chapters.map((_, i) => `<i class="${i <= info.index ? 'on' : ''}"></i>`).join('');
    wrap.append(h('div.st-chap', { html: `<small>Acto ${info.act.id} · ${esc(info.act.name)} · Capítulo ${info.index + 1}</small>
      <h3>${esc(info.chapter.name)}</h3><p>${esc(info.chapter.goal)}</p><div class="st-steps">${steps}</div>` }));
    // Qué sigue: la misión actual con su botón (o la pista)
    wrap.append(h('div.st-h', { html: `${icon('quest', 18)} Qué sigue` }));
    const q = quests.mainQuest();
    if (q) {
      const box = h('div.st-next', { html: `<span class="st-next-ic">${q.done ? icon('gift', 36) : goalIcon(q.goal, 36)}</span>
        <b>${esc(q.title)}</b><small>${esc(q.text)}</small>` });
      if (!q.done) box.append(h('div.pnl-prog.sm', { html: `${progressHtml(q.progress / q.goal.count)}<b>${progressLabel(q.progress, q.goal.count, economy.fmtNum)}</b>` }));
      const act = q.done
        ? { label: 'Cobrar en Misiones', ic: 'gift', run: () => { sh.close(); setTimeout(() => ctx.openPanel('quests', { tab: 'main' }), 240); } }
        : goalAction(ctx, q.goal, () => sh.close());
      if (act) box.append(h('button.btn.sky.block.st-go', { html: `${icon(act.ic, 22)} ${esc(act.label)}`, onclick: () => { audio.sfx('tap'); act.run(); } }));
      wrap.append(box);
    } else wrap.append(h('div.st-next', { html: `<span class="st-next-ic">${icon('crown', 36)}</span><b>La ciudad es tuya</b><small>${esc(info.chapter.goal)}</small>` }));
    // escenas vistas
    const seen = story.seenScenes(s);
    wrap.append(h('div.st-h', { html: `${icon('play', 18)} Lo que pasó` }));
    // la cinemática (El Quiebre) y la llegada con Vera se vuelven a ver siempre
    wrap.append(h('button.st-scene.st-intro', {
      html: `${portraitHtml('narrador')}<span><b>${s.introSeen ? 'Volver a ver El Quiebre' : 'Ver El Quiebre'}</b><small>Cómo se rompió la tierra</small></span>`,
      onclick: () => { audio.sfx('tap'); sh.close(); setTimeout(() => story.playIntro(), 240); },
    }));
    if (story.hasSeen('llegada', s) || story.hasSeen('prologo_2', s)) {
      wrap.append(h('button.st-scene.st-prologue', {
        html: `${portraitHtml('cartografa')}<span><b>La llegada</b><small>Vera te recibe entre las ruinas</small></span>`,
        onclick: () => { audio.sfx('tap'); story.playPrologue({ replay: true }); },
      }));
    }
    for (const sc of seen.filter(x => !x.epic && x.id !== 'veterano').reverse()) {
      const btn = h('button.st-scene', { 'data-scene': sc.id, html: `${portraitHtml(sc.who)}<span><b>${esc(sc.title || '')}</b><small>${esc(story.fill(sc.lines[0], s))}</small></span>` });
      btn.onclick = () => { audio.sfx('tap'); sh.close(); setTimeout(() => story.replay(sc.id), 240); };
      wrap.append(btn);
    }
    // lo que viene: los otros actos, cerrados
    wrap.append(h('div.st-h', { html: `${icon('lock', 18)} Más adelante` }));
    wrap.append(h('div.st-acts', { html: ACTS.filter(a => a.id > info.act.id).map(a => `<div class="st-act"><b>Acto ${a.id}</b>${esc(a.name)}</div>`).join('') }));
    return wrap;
  }
  function portraitHtml(who) {
    const cv = portrait(who, '');
    return cv ? `<img src="${cv.toDataURL()}" alt="" style="flex:none;width:36px;height:36px;image-rendering:pixelated;border:2px solid var(--edge);border-radius:8px;background:var(--surface-2)">` : `<i class="st-noface" style="display:grid;place-items:center">${icon('sparkle', 22)}</i>`;
  }

  // ---------- Diario ----------
  function diarioPane() {
    const wrap = h('div.col.pnl-gap');
    const got = PAGES.filter(p => s.story?.pages?.[p.id]);
    wrap.append(h('div.st-h', { html: `${icon('quest', 18)} Diario del último intendente · ${got.length}/${PAGES.length}` }));
    PAGES.forEach((p, i) => {
      const have = !!s.story?.pages?.[p.id];
      wrap.append(h('div.st-page' + (have ? '' : '.locked'), { 'data-page': p.id, html: have ? `<b>${esc(p.title)}</b><p>${esc(p.text)}</p>` : `<b>${icon('lock', 14)} Página ${i + 1}</b><p>Perdida en algún lugar de la isla.</p>` }));
    });
    wrap.append(h('div.st-h', { html: `${icon('sparkle', 18)} Elementos` }));
    const els = h('div.st-els');
    for (const e of ELEMENTS) {
      const have = (s.story?.elements || []).includes(e.id);
      els.append(h('div.st-el' + (have ? '' : '.locked'), { 'data-element': e.id, html: have
        ? `${icon(e.ic, 36)}<b>${esc(e.name)}</b><small>${esc(e.isle)} ${esc(e.leader)}</small>`
        : `${icon('lock', 30)}<b>${esc(e.name)}</b><small>Sin descubrir.</small>` }));
    }
    wrap.append(els);
    // la Raíz y la Grieta (L1): cuánto se le saca y cómo está la isla
    if (RZ.raizFound(s)) {
      const rs = RZ.raizState(s), g = RZ.grieta(s), ex = RZ.EXTRACTION[rs.mode];
      wrap.append(h('div.st-page', { 'data-grieta': String(Math.round(g)), html: `<b>${icon('bolt', 14)} La Grieta · ${Math.round(g)}/100</b><p>${esc(RZ.grietaText(g))} Raíz: ${esc(ex ? ex.name.toLowerCase() : 'sin elegir')}${rs.sutures ? ` · ${rs.sutures} ${rs.sutures === 1 ? 'obra de Raíz terminada' : 'obras de Raíz terminadas'}` : ''}.</p>` }));
    }
    // ecos de noche (L6): los que ya se vieron, con su línea
    const echoes = seenEchoes(s);
    if (echoes.length) {
      wrap.append(h('div.st-h', { html: `${icon('🌙', 18)} Ecos de noche · ${echoes.length}/${ECHOES.length}` }));
      for (const e of echoes) wrap.append(h('div.st-page', { 'data-echo': e.id, html: `<b>${esc(e.title)}</b><p><i>${esc(e.line)}</i></p>` }));
    }
    return wrap;
  }

  // ---------- Manual ----------
  function manualPane() {
    const wrap = h('div.col');
    const search = h('label.st-search', { html: `${icon('info', 18)}` });
    const input = h('input', { type: 'search', placeholder: 'Buscar en el Manual', 'aria-label': 'Buscar en el Manual', value: query });
    search.append(input);
    const list = h('div.st-man');
    wrap.append(search, list);
    const chapters = manualChapters(s);
    const strip = (x) => x.replace(/<[^>]+>/g, '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const paint = () => {
      const qn = strip(query.trim());
      list.innerHTML = '';
      let any = false;
      for (const c of chapters) {
        if (!c.open) {
          if (!qn) list.append(h('div.st-man-lock', { 'data-chapter': c.id, html: `${icon('lock', 18)}<span><b>${esc(c.name)}</b> · se abre al llegar a ese momento</span>` }));
          continue;
        }
        const items = qn ? c.items.filter(([, t, d]) => strip(t + ' ' + d).includes(qn) || strip(c.name).includes(qn)) : c.items;
        if (!items.length) continue;
        any = true;
        list.append(h('h3.st-man-h', { 'data-chapter': c.id, html: `${icon(c.ic, 22)}<span>${esc(c.name)}</span>` }));
        list.append(h('div.pnl-help-list', { html: items.map(([ic, t, d]) => `<div class="pnl-help-item"><span class="pnl-help-ic">${icon(ic, 32)}</span><span><b>${t}</b><small>${d}</small></span></div>`).join('') }));
      }
      // atajos de teclado (con lo que se haya reasignado en Ajustes → Controles)
      if (!qn || /tecl|atajo|control|compu/.test(qn)) {
        any = true;
        const k = (id) => `<kbd>${esc(keyLabel(codeFor(id)))}</kbd>`;
        list.append(h('h3.st-man-h', { html: `${icon('🖱️', 22)}<span>En la compu</span>` }));
        list.append(h('div.st-keys', { html: [
          `${k('build')}Construir`, `${k('journal')}Bitácora`, `${k('expedition')}Expedición`, `${k('collect')}Cobrar todo`,
          `${k('up')}${k('left')}${k('down')}${k('right')}Cámara`, `${k('rotL')}${k('rotR')}Girar`, `${k('themes')}Estilo`, `${k('settings')}Ajustes`,
          '<kbd>Rueda</kbd>Zoom', '<kbd>Esc</kbd>Cerrar o saltear',
        ].map(x => `<span>${x}</span>`).join('') }));
      }
      if (!any) list.append(h('p.st-empty', {}, 'No hay nada con eso todavía.'));
    };
    input.addEventListener('input', () => { query = input.value; paint(); });
    paint();
    if (params.focusSearch) setTimeout(() => input.focus(), 50);
    return wrap;
  }

  function render(resetScroll = false) {
    if (sh.closed) return;
    const top = resetScroll ? 0 : pane.scrollTop;
    // las páginas nuevas quedan leídas al abrir el diario
    if (tab === 'diario' && newPages()) {
      s.story.read ||= {};
      for (const p of PAGES) if (s.story.pages?.[p.id]) s.story.read[p.id] = 1;
      ctx.store.markDirty();
    }
    renderTabs();
    pane.innerHTML = '';
    pane.append(tab === 'historia' ? historiaPane() : tab === 'diario' ? diarioPane() : tab === 'progreso' ? progressPane(ctx, () => render()) : manualPane());
    pane.scrollTop = top;
  }
  sh.on(ctx.bus, 'quests:changed', () => { if (tab === 'historia') render(); });
  sh.on(ctx.bus, 'story:page', () => render());
  for (const ev of ['people:bond', 'people:tool', 'people:arrived', 'leader:levelup']) sh.on(ctx.bus, ev, () => { if (tab === 'progreso') render(); });
  sh.keyHandler = (e) => {
    const i = TABS.findIndex(t => t.id === tab);
    let n = -1;
    if (e.key === 'ArrowRight') n = (i + 1) % TABS.length;
    else if (e.key === 'ArrowLeft') n = (i + TABS.length - 1) % TABS.length;
    else if (['1', '2', '3'].includes(e.key)) n = Number(e.key) - 1;
    else if (e.code === codeFor('journal')) { e.preventDefault(); sh.close(); return; }
    if (n >= 0 && n !== i) { e.preventDefault(); audio.sfx('select'); tab = TABS[n].id; render(true); }
  };
  render(true);
  ctx.bus.emit('story:journal', { tab });
  return sh.done;
}
export { CHARACTERS };
