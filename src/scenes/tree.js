// Árbol de habilidades (PLAN-FOTO, paso A3): pantalla mínima, sin arte (cubos y líneas). Se navega con el mouse o con
// las flechas; Enter toma el nodo, R reinicia y Esc vuelve. El motor es src/core/tree.js. La pantalla definitiva la
// trae U2 (interfaz de PC). Prueba: ?scene=tree&veta=600 (veta de regalo para tener puntos).
import * as T from '../core/tree.js';
import { TREE, TREE_SIZE, TREE_BRANCHES } from '../core/tree-data.js';
import { t } from '../core/i18n.js';

const CSS = `
.tree-wrap { position: absolute; inset: 0; display: flex; flex-direction: column; gap: 10px; padding: 16px 20px; background: #0d0f12; color: #cfc8ba; font-size: 18px; overflow: auto; }
.tree-top { display: flex; flex-wrap: wrap; gap: 8px 24px; align-items: baseline; }
.tree-top h1 { margin: 0; font-size: 28px; color: #e8dfcc; font-weight: normal; }
.tree-top .sp { flex: 1; }
.tree-main { display: flex; flex-wrap: wrap; gap: 16px; flex: 1; min-height: 0; }
.tree-board { position: relative; flex: 3 1 420px; aspect-ratio: ${TREE_SIZE.w} / ${TREE_SIZE.h}; max-height: 100%; background: #14171c; border: 1px solid #2a2f38; }
.tree-board svg { position: absolute; inset: 0; width: 100%; height: 100%; }
.tree-board line { stroke: #2f3540; stroke-width: 0.06; }
.tree-board line.on { stroke: #c99a3a; }
.tree-node { position: absolute; width: 5.4%; aspect-ratio: 1; transform: translate(-50%, -50%); padding: 0; border: 2px solid #3a414d; background: #1b1f26; cursor: pointer; }
.tree-node.key { width: 7.6%; transform: translate(-50%, -50%) rotate(45deg); }
.tree-node.open { border-color: #9aa3b2; background: #232a34; }
.tree-node.taken { border-color: #f0c66a; background: #c99a3a; box-shadow: 0 0 12px #c99a3a88; }
.tree-node.sel { outline: 3px solid #e8dfcc; outline-offset: 3px; }
.tree-lab { position: absolute; transform: translate(-50%, 0); color: #7d8696; white-space: nowrap; }
.tree-info { flex: 1 1 240px; display: flex; flex-direction: column; gap: 8px; padding: 12px; background: #14171c; border: 1px solid #2a2f38; }
.tree-info h2 { margin: 0; font-size: 22px; color: #e8dfcc; font-weight: normal; }
.tree-info .tag { color: #c99a3a; }
.tree-info .st { color: #7d8696; }
.tree-info .why { color: #b0584a; min-height: 1.2em; }
.tree-btns { display: flex; flex-wrap: wrap; gap: 8px; margin-top: auto; }
.tree-btns button, .tree-top button { font: inherit; padding: 6px 14px; background: #232a34; color: #e8dfcc; border: 1px solid #3a414d; cursor: pointer; }
.tree-btns button:disabled { opacity: 0.4; cursor: default; }
.tree-hint { color: #5d6573; }
`;

export default function create(ctx) {
  let root = null, sel = 'filo1', why = '';
  const state = () => ctx.store.state;
  const saved = () => { ctx.store.markDirty(); ctx.bus.emit('tree:changed', {}); };
  const pos = (n) => ({ left: `${((n.x + 0.5) / TREE_SIZE.w) * 100}%`, top: `${((n.y + 0.5) / TREE_SIZE.h) * 100}%` });

  function render() {
    if (!root) return;
    const v = T.treeView(state());
    const cur = v.nodes.find(n => n.id === sel) || v.nodes[0];
    const taken = new Set(v.nodes.filter(n => n.state === 'taken').map(n => n.id));
    const lines = v.nodes.flatMap(n => n.req.map(r => {
      const a = TREE[r];
      return `<line class="${taken.has(n.id) && taken.has(r) ? 'on' : ''}" x1="${a.x + 0.5}" y1="${a.y + 0.5}" x2="${n.x + 0.5}" y2="${n.y + 0.5}"/>`;
    })).join('');
    const can = T.canTake(state(), cur.id);
    root.innerHTML = `
      <div class="tree-top">
        <h1>${t('tree.title')}</h1>
        <span data-k="points">${t('tree.points', { free: v.free, points: v.points })}</span>
        <span data-k="veta">${v.max ? t('tree.full') : t('tree.veta', { into: v.into, need: v.need })}</span>
        <span class="sp"></span>
        <button data-act="back">${t('tree.back')}</button>
      </div>
      <div class="tree-main">
        <div class="tree-board">
          <svg viewBox="0 0 ${TREE_SIZE.w} ${TREE_SIZE.h}" preserveAspectRatio="none">${lines}</svg>
          ${v.nodes.map(n => { const p = pos(n); return `<button class="tree-node ${n.state}${n.key ? ' key' : ''}${n.id === cur.id ? ' sel' : ''}" data-node="${n.id}" style="left:${p.left};top:${p.top}" aria-label="${n.name}" data-tip="${n.text}"></button>`; }).join('')}
        </div>
        <div class="tree-info">
          <h2 data-k="name">${cur.name}</h2>
          ${cur.key ? `<div class="tag">${t('tree.keyTag')}</div>` : ''}
          <div data-k="text">${cur.text}</div>
          <div class="st" data-k="state">${t('tree.state.' + cur.state)}</div>
          <div class="why" data-k="why">${why}</div>
          <div class="tree-btns">
            <button data-act="take" ${can.ok ? '' : 'disabled'}>${t('tree.take')}</button>
            <button data-act="reset" ${v.spent ? '' : 'disabled'}>${t('tree.reset')}</button>
          </div>
          <div class="tree-hint">${t('tree.hint')}</div>
        </div>
      </div>`;
  }
  function take() {
    const r = T.takeNode(state(), sel);
    why = r.ok ? '' : r.why;
    if (r.ok) saved();
    render();
  }
  function reset() {
    if (T.resetTree(state()).ok) saved();
    why = '';
    render();
  }
  /** Flechas: el nodo más cercano hacia ese lado. */
  function step(dx, dy) {
    const a = TREE[sel];
    let best = null, bd = Infinity;
    for (const n of Object.values(TREE)) {
      const ex = n.x - a.x, ey = n.y - a.y;
      const along = ex * dx + ey * dy, side = Math.abs(ex * dy) + Math.abs(ey * dx);
      if (along <= 0) continue;
      const d = dy ? along * 2 + side : along + side * 3;   // arriba y abajo: la fila de al lado; a los costados: la misma fila
      if (d < bd) { bd = d; best = n.id; }
    }
    if (best) { sel = best; why = ''; render(); }
  }
  const back = () => ctx.router.go(ctx.router.params?.back || 'city');
  function onClick(e) {
    const node = e.target.closest('[data-node]');
    if (node) { if (sel === node.dataset.node && T.canTake(state(), sel).ok) return take(); sel = node.dataset.node; why = ''; return render(); }
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'take') take(); else if (act === 'reset') reset(); else if (act === 'back') back();
  }
  function onKey(e) {
    const k = e.key;
    if (k === 'ArrowLeft') step(-1, 0); else if (k === 'ArrowRight') step(1, 0); else if (k === 'ArrowUp') step(0, -1); else if (k === 'ArrowDown') step(0, 1);
    else if (k === 'Enter' || k === ' ') take(); else if (k === 'r' || k === 'R') reset(); else if (k === 'Escape') back(); else return;
    e.preventDefault();
  }
  const onLang = () => render();

  return {
    hud: false,
    async mount(container) {
      const veta = Number(new URLSearchParams(location.search).get('veta'));
      if (veta > 0 && T.treeState(state()).xp < veta) { state().tree.xp = Math.round(veta); saved(); }
      const style = document.createElement('style');
      style.textContent = CSS;
      root = document.createElement('div');
      root.className = 'tree-wrap';
      container.append(style, root);
      root.addEventListener('click', onClick);
      window.addEventListener('keydown', onKey);
      ctx.bus.on('lang:changed', onLang);
      // para las pruebas (tools/test-tree.mjs)
      window.__tree = { view: () => T.treeView(state()), get sel() { return sel; }, branches: TREE_BRANCHES };
      render();
    },
    unmount() {
      window.removeEventListener('keydown', onKey);
      ctx.bus.off?.('lang:changed', onLang);
      delete window.__tree;
      root = null;
    },
  };
}
