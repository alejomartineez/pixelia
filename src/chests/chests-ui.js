// UI de cofres: panel (Cofres / Mochila / Tienda), flujo de apertura y animación.
//   openChestsPanel(ctx, {tab})      -> Promise que resuelve al cerrar el panel
//   openChestFlow(ctx, type)         -> Promise<drops|null> abre un cofre del inventario con la animación
//   playChestOpening(ctx, type, drops) -> Promise (solo la animación; ver chests-ui-opening.js)
import * as C from './chests.js';
import { icon } from '../core/icons.js';
import { esc } from '../core/ui.js';
import { injectStyle, rarityVars, chestVars, thumbImg, fillThumbs, chestThumbs } from './chests-ui-common.js';
import { playChestOpening } from './chests-ui-opening.js';
import { stickerDropsForChest } from '../album/album.js';
import { packIcon } from '../season/season-ui-common.js';

export { playChestOpening };

const { CHESTS, RARITIES, RARITY_LIST, ITEMS } = C;
const ORDER = ['madera', 'plata', 'oro', 'real'];

// ---------- Abrir un cofre ----------
let flowBusy = false;
/** Abre un cofre del inventario (si hay) y muestra la animación. Devuelve los premios o null. */
export async function openChestFlow(ctx, type) {
  if (flowBusy) return null;
  const def = CHESTS[type];
  if (!def || !C.chestCount(type)) {
    ctx.audio.sfx('error');
    ctx.ui.toast(def ? `No tenés ningún ${def.name}` : 'Ese cofre no existe', { icon: 'gift', type: 'bad' });
    return null;
  }
  flowBusy = true;
  try {
    const drops = C.openChest(type);
    if (!drops) return null;
    await playChestOpening(ctx, type, drops);
    return drops;
  } finally { flowBusy = false; }
}

// ---------- HTML reutilizable ----------
const pct = (def) => {
  const total = Object.values(def.odds).reduce((a, b) => a + b, 0) || 1;
  return RARITY_LIST.filter(r => def.odds[r.id] > 0).map(r => ({ r, p: def.odds[r.id] / total * 100 }));
};
const fmtPct = (p) => (p < 10 && p % 1 ? p.toFixed(1) : Math.round(p)) + '%';
function oddsHtml(def) {
  const list = pct(def);
  return `<div class="chx-odds" aria-hidden="true">${list.map(({ r, p }) => `<i style="flex:${p};background:${r.color}"></i>`).join('')}</div>
    <div class="chx-oddleg">${list.map(({ r, p }) => `<span><i style="background:${r.color}"></i>${esc(r.name)} <b>${fmtPct(p)}</b></span>`).join('')}</div>`;
}
function guaranteeChip(def) {
  if (!def.guarantee) return '';
  const r = RARITIES[def.guarantee];
  const txt = def.guarantee === 'legendaria' ? 'Legendaria asegurada' : `Garantiza ${r.name} o más`;
  return `<span class="chx-rchip" style="${rarityVars(r.id)}"><i></i>${txt}</span>`;
}
const slotsChip = (def) => {
  const st = stickerDropsForChest(def.id);
  return `<span class="chx-rchip" style="--rcl:#fff">${icon('gift', 14)}${def.slots} premios</span>`
    + (st.n ? `<span class="chx-rchip" style="--rcl:#fbf6ef">${packIcon(16)}+${st.n} hallazgos</span>` : '');
};

// ---------- "¿Qué puede salir?" ----------
function showWhat(ctx, type) {
  const def = CHESTS[type];
  const rows = pct(def).slice().reverse().map(({ r, p }) => {
    const items = Object.values(ITEMS).filter(i => i.rarity === r.id);
    return `<div class="chx-wrow" style="${rarityVars(r.id)}">
      <header><span>${esc(r.name)}</span><em>${fmtPct(p)}</em></header>
      <div class="chx-witems">${items.map(i => `<span>${icon(i.icon, 20)}${esc(i.name)}</span>`).join('')}</div></div>`;
  }).join('');
  const g = def.guarantee ? `Trae <b>${def.slots} premios</b> y al menos uno es <b>${esc(RARITIES[def.guarantee].name)}</b>${def.guarantee === 'legendaria' ? '' : ' o mejor'}.` : `Trae <b>${def.slots} premios</b>.`;
  ctx.ui.modal({
    title: def.name, icon: 'gift', className: 'chx-whatmodal',
    content: `<p class="center">${g}</p><p class="center small muted">Probabilidad de cada premio:</p>
      <div class="chx-whatlist">${rows}</div>
      <p class="center small muted" style="margin-top:10px">${packIcon(16)} Además trae <b>${stickerDropsForChest(type).n} hallazgos</b> para tus Hallazgos${stickerDropsForChest(type).minStars > 1 ? ` (uno de ${stickerDropsForChest(type).minStars}★ o más)` : ''}.</p>
      <p class="center small muted">${icon('sparkle', 16)} Racha de suerte: nunca pasan más de ${C.PITY_LEGENDARY} cofres sin una Legendaria.</p>`,
    actions: [{ label: 'Entendido', cls: 'primary' }],
  });
}

// ---------- Martillo: elegir obra ----------
function pickBuilding(ctx, busy) {
  const E = ctx.economy;
  return new Promise(res => {
    let chosen = null;
    const list = ctx.ui.h('div.chx-picklist');
    const times = [];
    for (const b of busy) {
      const d = E.def(b);
      const kind = b.buildEnd > Date.now() ? 'Construcción' : `Mejora a nivel ${(b.level || 1) + 1}`;
      const t = ctx.ui.h('b', {}, '');
      times.push([t, b]);
      const btn = ctx.ui.h('button.btn.mint.small', { html: `${icon('hammer', 18)} Terminar`, onclick: () => { chosen = b.uid; m.close(); } });
      list.append(ctx.ui.h('div.card.chx-pick', {},
        ctx.ui.h('span', { html: icon('build', 32) }),
        ctx.ui.h('div.chx-info', {}, ctx.ui.h('b', {}, d?.name || b.id), ctx.ui.h('small', {}, kind, ' · faltan ', t)),
        btn));
    }
    const tick = () => { for (const [t, b] of times) t.textContent = E.fmtTime(E.remainingMs(b) / 1000); };
    tick();
    const iv = setInterval(tick, 1000);
    const m = ctx.ui.modal({
      title: '¿Qué obra terminás?', icon: 'hammer', content: list,
      onClose: () => { clearInterval(iv); res(chosen); },
    });
  });
}

// ---------- Panel ----------
let current = null;

/**
 * Panel de cofres. params.tab: 'cofres' | 'mochila' | 'tienda'.
 * Devuelve una Promise que resuelve cuando se cierra. Si ya está abierto, cambia de pestaña.
 */
export async function openChestsPanel(ctx, params = {}) {
  injectStyle();
  if (current) { current.setTab(params.tab); return current.done; }
  const { h, toast } = ctx.ui;
  const audio = ctx.audio;
  let tab = ['cofres', 'mochila', 'tienda'].includes(params.tab) ? params.tab : 'cofres';
  let busyOpening = false;
  const cleanups = [];
  let resolveDone;
  const done = new Promise(r => { resolveDone = r; });

  const root = h('div.chx-root');
  const top = h('div.chx-top');
  const tabs = h('div.tabs', { role: 'tablist' });
  const gemsPill = h('div.chx-gems', { 'data-chx': 'gems' });
  top.append(tabs);
  const pane = h('div.chx-pane');
  root.append(top, pane);

  const m = ctx.ui.modal({
    title: 'Cofres', icon: 'gift', className: 'sheet chx-sheet', content: root,
    onClose: () => {
      for (const fn of cleanups.splice(0)) { try { fn(); } catch (e) { console.error('[chests-ui]', e); } }
      current = null;
      resolveDone();
    },
  });
  const back = m.el.parentElement;
  const headEl = m.el.querySelector('.modal-head');
  headEl?.insertBefore(gemsPill, headEl.querySelector('.modal-x'));
  const isTop = () => {
    const r = document.getElementById('modal-root');
    const backs = r ? [...r.children].filter(c => c.classList.contains('modal-back') && c.classList.contains('show')) : [];
    return backs[backs.length - 1] === back;
  };

  // ---------- pestañas ----------
  function renderTabs() {
    const badge = C.chestBadge();
    const bagN = C.backpack().reduce((a, i) => a + i.count, 0);
    const defs = [
      ['cofres', 'gift', 'Cofres', badge ? `<i class="badge">${badge}</i>` : ''],
      ['mochila', 'bag', 'Mochila', bagN ? `<i class="badge" style="background:var(--second);animation:none">${bagN}</i>` : ''],
      ['tienda', 'shop', 'Tienda', ''],
    ];
    tabs.innerHTML = defs.map(([id, ic, label, extra]) =>
      `<button class="tab${tab === id ? ' active' : ''}" role="tab" aria-selected="${tab === id}" data-tab="${id}">${icon(ic, 18)}${label}${extra}</button>`).join('');
    gemsPill.innerHTML = `${icon('gem', 20)}<span>${ctx.economy.fmtNum(ctx.state.gems)}</span>`;
  }
  tabs.addEventListener('click', e => {
    const b = e.target.closest('[data-tab]');
    if (!b || b.dataset.tab === tab) return;
    audio.sfx('select');
    setTab(b.dataset.tab);
  });
  function setTab(t) {
    if (!t || !['cofres', 'mochila', 'tienda'].includes(t)) return;
    tab = t;
    m.body.scrollTop = 0;
    render();
  }

  // ---------- contenido ----------
  function render() {
    if (busyOpening) return;
    const st = m.body.scrollTop;
    renderTabs();
    pane.innerHTML = '';
    if (tab === 'cofres') renderCofres();
    else if (tab === 'mochila') renderMochila();
    else renderTienda();
    fillThumbs(pane);
    m.body.scrollTop = st;
    tickLive();
  }

  function renderCofres() {
    const fs = C.freeChestStatus();
    const ready = fs.ready > 0;
    const free = h('div.card.chx-free' + (ready ? '.ready' : ''), { style: chestVars('madera') });
    free.innerHTML = `
      <div class="chx-thumbbox">${thumbImg('madera')}<span class="chx-ribbon">GRATIS</span></div>
      <div class="chx-info">
        <h3>Cofre gratis</h3>
        ${ready
          ? `<div class="chx-chips"><span class="chx-rchip" style="${rarityVars('legendaria')}">${icon('sparkle', 14)}¡${fs.ready > 1 ? `${fs.ready} listos` : 'Listo'}!</span></div>
             <div class="chx-timer">${fs.ready < fs.max ? `Y otro más en <b data-chx-free>…</b>` : `Tenés ${fs.max} guardados: reclamalos.`}</div>`
          : `<div class="chx-timer">El próximo en <b data-chx-free>…</b></div>
             <div class="progress gold"><i data-chx-freebar style="width:0%"></i></div>`}
        <small class="muted">Uno cada 4 horas · se guardan hasta ${fs.max}</small>
      </div>`;
    const claimBtn = h('button.btn.gold' + (ready ? '' : '.small'), { html: ready ? `${icon('gift', 22)}Reclamar y abrir` : `${icon('clock', 18)}Todavía no`, disabled: !ready, 'aria-label': 'Reclamar cofre gratis' });
    claimBtn.addEventListener('click', async () => {
      if (!C.claimFreeChest()) { audio.sfx('error'); return; }
      audio.sfx('buy');
      await openFromPanel('madera');
    });
    free.append(claimBtn);
    pane.append(free);

    pane.append(h('div.chx-sec', { html: `${icon('gift', 16)} Tus cofres` }));
    const list = h('div.chx-list.two');
    const types = ORDER.slice().sort((a, b) => (C.chestCount(b) > 0) - (C.chestCount(a) > 0));
    for (const t of types) {
      const def = CHESTS[t], n = C.chestCount(t);
      const card = h('div.card.chx-chest' + (n ? '' : '.empty'), { style: chestVars(t) });
      card.innerHTML = `
        <div class="chx-thumbbox">${thumbImg(t)}${n ? `<span class="chx-count">x${n}</span>` : ''}</div>
        <div class="chx-info">
          <h3>${esc(def.name)}</h3>
          <div class="chx-chips">${slotsChip(def)}${guaranteeChip(def)}</div>
          ${oddsHtml(def)}
        </div>`;
      const actions = h('div.chx-actions');
      const what = h('button.chx-what', { html: `${icon('info', 14)}¿Qué puede salir?`, onclick: () => { audio.sfx('tap'); showWhat(ctx, t); } });
      if (n) actions.append(h('button.btn.primary', { html: `${icon('sparkle', 20)}Abrir${n > 1 ? ` <small>(${n})</small>` : ''}`, onclick: () => openFromPanel(t) }));
      else if (def.price) actions.append(h('button.btn.ghost.small', { html: `${icon('shop', 16)}Comprar ${icon('gem', 16)}${def.price.gems}`, onclick: () => { audio.sfx('select'); setTab('tienda'); } }));
      else actions.append(h('div.chx-ingame', { html: `${icon('🧭', 16)} Sale en las expediciones de 3★, las amenazas, el Pase y cada 5 niveles` }));
      card.querySelector('.chx-info').append(what);
      card.append(actions);
      list.append(card);
    }
    pane.append(list);
    pane.append(h('p.chx-tip', { html: `${icon('star', 14)} Ganás cofres en las expediciones de 3★, las amenazas, el Pase, cada 5 niveles y con el cofre gratis del día.` }));
  }

  function renderMochila() {
    const boosts = C.activeBoosts();
    const fb = Object.entries(ctx.state.chests?.freeBuilds || {}).filter(([, n]) => n > 0);
    const items = C.backpack();
    if (!items.length && !fb.length && !boosts.prod && !boosts.happy) {
      pane.append(h('div.chx-empty', { html: `${icon('bag', 72)}<b>Tu mochila está vacía</b><span>Abrí cofres para conseguir martillos, pociones, perfumes y más.</span>` },
        h('button.btn.primary', { html: `${icon('gift', 20)}Ver mis cofres`, onclick: () => { audio.sfx('select'); setTab('cofres'); } })));
      return;
    }
    if (boosts.prod || boosts.happy) {
      pane.append(h('div.chx-sec', { html: `${icon('sparkle', 16)} Efectos activos` }));
      const list = h('div.chx-list.two');
      if (boosts.prod) list.append(h('div.card.chx-row.chx-boost', { html:
        `${icon(boosts.prod.mult >= 3 ? '✨' : '🧪', 40)}<div class="chx-info"><b>Producción x${boosts.prod.mult}</b><small>Todos tus negocios producen más</small></div><span class="chx-left">${icon('clock', 16)} <span data-chx-boost="prod"></span></span>` }));
      if (boosts.happy) list.append(h('div.card.chx-row.chx-boost', { html:
        `${icon('🌸', 40)}<div class="chx-info"><b>Ciudad feliz</b><small>Felicidad al máximo (+50%)</small></div><span class="chx-left">${icon('clock', 16)} <span data-chx-boost="happy"></span></span>` }));
      pane.append(list);
    }
    if (fb.length) {
      pane.append(h('div.chx-sec', { html: `${icon('build', 16)} Construcciones gratis` }));
      const list = h('div.chx-list.two');
      const inCity = ctx.router?.current === 'city';
      for (const [id, n] of fb) {
        const bd = ctx.data.BUILDING_BY_ID?.[id];
        const row = h('div.card.chx-row.chx-build', { html:
          `<div class="chx-bthumb" data-bthumb="${esc(id)}">${icon('build', 36)}</div>
           <div class="chx-info"><b>${esc(bd?.name || id)}${n > 1 ? ` x${n}` : ''}</b><small>Colocala desde Construir</small></div>` });
        if (inCity) row.append(h('button.btn.second.small', { html: `${icon('hammer', 16)}Construir`, onclick: () => {
          audio.sfx('tap'); m.close(); setTimeout(() => ctx.bus.emit('hud:build', { focus: id }), 60);
        } }));
        list.append(row);
      }
      pane.append(list);
      // miniaturas de edificios (si el módulo de modelos está disponible)
      import('../city/models.js').then(mod => {
        for (const el of pane.querySelectorAll('[data-bthumb]')) {
          mod.thumbnail?.(el.dataset.bthumb)?.then(url => { if (url && el.isConnected) el.innerHTML = `<img src="${url}" alt="">`; }).catch(() => {});
        }
      }).catch(() => {});
    }
    if (items.length) {
      pane.append(h('div.chx-sec', { html: `${icon('bag', 16)} Objetos` }));
      const grid = h('div.chx-items');
      for (const it of items) {
        const r = RARITIES[it.rarity];
        const card = h('div.chx-item', { style: rarityVars(it.rarity), html: `
          <span class="chx-rar">${esc(r.name)}</span><span class="chx-qty">x${it.count}</span>
          <div class="chx-ic">${icon(it.icon, 60)}</div>
          <b>${esc(it.name)}</b><p>${esc(it.desc || '')}</p>` });
        if (it.use === 'city') card.append(h('button.btn.mint.small', { html: `${icon('wand', 18)}Usar`, onclick: (e) => useItem(it.id, e.currentTarget) }));
        grid.append(card);
      }
      pane.append(grid);
    }
  }

  function renderTienda() {
    const gems = ctx.state.gems;
    pane.append(h('div.card.chx-shophead', { html: `${icon('diamond', 36)}<p>Comprá cofres con gemas. Las gemas se ganan jugando, subiendo de nivel y en los cofres.</p>` }));
    const list = h('div.chx-list');
    for (const t of ORDER) {
      const def = CHESTS[t];
      if (!def.price) continue;
      const can = gems >= (def.price.gems || 0);
      const card = h('div.card.chx-chest.chx-shop', { style: chestVars(t) });
      card.innerHTML = `
        ${t === 'oro' ? '<span class="chx-best">El más elegido</span>' : ''}
        <div class="chx-thumbbox">${thumbImg(t)}</div>
        <div class="chx-info">
          <h3>${esc(def.name)}</h3>
          <div class="chx-chips">${slotsChip(def)}${guaranteeChip(def)}</div>
          ${oddsHtml(def)}
        </div>`;
      card.querySelector('.chx-info').append(h('button.chx-what', { html: `${icon('info', 14)}¿Qué puede salir?`, onclick: () => { audio.sfx('tap'); showWhat(ctx, t); } }));
      const actions = h('div.chx-actions');
      actions.append(h('button.btn.gold', { html: `Comprar ${icon('gem', 22)} ${def.price.gems}`, 'aria-label': `Comprar ${def.name} por ${def.price.gems} gemas`, class: can ? '' : 'chx-cant', onclick: () => buy(t) }));
      card.append(actions);
      list.append(card);
    }
    pane.append(list);
  }

  // ---------- acciones ----------
  async function buy(type) {
    const def = CHESTS[type];
    const need = def.price.gems - ctx.state.gems;
    if (need > 0) {
      audio.sfx('error');
      toast(`Te faltan ${need} gemas. Se ganan jugando.`, { icon: 'gem', type: 'bad' });
      return;
    }
    const ok = await new Promise(res => {
      let v = false;
      ctx.ui.modal({
        title: '¿Comprar cofre?', icon: 'gift',
        content: `<div class="center" style="${chestVars(type)}">
            <div class="chx-thumbbox" style="margin:2px auto 10px;width:110px;height:110px">${thumbImg(type)}</div>
            <p style="font-size:19px">${esc(def.name)} por ${icon('gem', 20)}<b>${def.price.gems}</b></p>
            <div class="chx-chips" style="justify-content:center">${slotsChip(def)}${guaranteeChip(def)}</div>
          </div>`,
        onClose: () => res(v),
        actions: [{ label: 'Ahora no', cls: 'ghost' }, { html: `${icon('sparkle', 20)}Comprar y abrir`, cls: 'gold', onClick: () => { v = true; } }],
      });
      fillThumbs(document.getElementById('modal-root'));
    });
    if (!ok) return;
    if (!C.buyChest(type)) { audio.sfx('error'); toast('No te alcanzan las gemas', { icon: 'gem', type: 'bad' }); return; }
    audio.sfx('buy');
    await openFromPanel(type);
  }

  async function useItem(id, btn) {
    const it = ITEMS[id];
    const E = ctx.economy;
    let opts = {};
    if (id === 'hammer' || id === 'hourglass') {
      const now = Date.now();
      const busy = ctx.state.city.buildings.filter(b => E.isBusy(b, now));
      if (!busy.length) { audio.sfx('error'); toast('No hay ninguna obra en curso', { icon: 'build', type: 'bad' }); return; }
      if (id === 'hammer') {
        let uid = busy[0].uid;
        if (busy.length > 1) { uid = await pickBuilding(ctx, busy); if (uid == null) return; }
        opts = { uid };
      }
    }
    const res = C.useCityItem(id, opts);
    if (!res.ok) { audio.sfx('error'); toast(res.msg, { icon: it.icon, type: 'bad' }); return; }
    E.tick?.();
    audio.sfx(id === 'hammer' ? 'build' : it.boost ? 'levelup' : 'done');
    toast(res.msg, { icon: it.icon, type: 'good' });
    const r = btn?.isConnected ? btn.getBoundingClientRect() : null;
    if (r) ctx.ui.floatText(r.left + r.width / 2, r.top, `${icon(it.icon, 22)}¡Listo!`);
    ctx.store.save?.();
  }

  /** Oculta el panel, muestra la apertura y vuelve con el panel actualizado. */
  async function openFromPanel(type) {
    if (busyOpening) return;
    busyOpening = true;
    back.style.visibility = 'hidden';
    try { await openChestFlow(ctx, type); }
    finally {
      busyOpening = false;
      if (back.isConnected) { back.style.visibility = ''; render(); }
    }
  }

  // ---------- en vivo ----------
  function tickLive() {
    const fs = C.freeChestStatus();
    const el = pane.querySelector('[data-chx-free]');
    if (el) el.textContent = ctx.economy.fmtTime(fs.nextIn / 1000);
    const bar = pane.querySelector('[data-chx-freebar]');
    if (bar) bar.style.width = (100 * (1 - fs.nextIn / C.FREE_CHEST_EVERY_MS)).toFixed(1) + '%';
    const boosts = C.activeBoosts();
    for (const b of pane.querySelectorAll('[data-chx-boost]')) {
      const v = boosts[b.dataset.chxBoost];
      b.textContent = v ? ctx.economy.fmtTime(v.leftMs / 1000) : '¡Terminó!';
    }
  }
  let lastReady = C.freeChestStatus().ready, lastBoosts = Object.keys(C.activeBoosts()).join();
  const iv = setInterval(() => {
    if (busyOpening) return;
    const ready = C.freeChestStatus().ready, bk = Object.keys(C.activeBoosts()).join();
    if (ready !== lastReady || bk !== lastBoosts) { lastReady = ready; lastBoosts = bk; render(); }
    else tickLive();
  }, 1000);
  cleanups.push(() => clearInterval(iv));
  cleanups.push(ctx.bus.on('chests:changed', () => render()));
  cleanups.push(ctx.bus.on('boosts:changed', () => render()));
  cleanups.push(ctx.bus.on('currency:changed', () => { if (tab === 'tienda') render(); else renderTabs(); }));
  const onKey = (e) => {
    if (busyOpening || e.key !== 'Escape' || !isTop()) return;
    e.preventDefault(); m.close();
  };
  addEventListener('keydown', onKey);
  cleanups.push(() => removeEventListener('keydown', onKey));

  current = { setTab, done, close: () => m.close() };
  chestThumbs(); // arranca el render de miniaturas
  render();
  return done;
}

