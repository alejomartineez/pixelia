// Utilidades compartidas por los paneles: estilos inyectados, "cáscara" de modal con limpieza,
// teclado (Esc / Enter en PC), capa de efectos por encima de los modales e íconos pixel propios.
import { audio } from '../core/audio.js';
import { icon, registerIcon, ICON_NAMES } from '../core/icons.js';
import { chestIcon } from '../season/season-ui-common.js';
import { costHtml, esc } from '../core/ui.js';
import { CHESTS, ITEMS } from '../chests/chests.js';
import { PANEL_CSS } from './panels-style.js';

// ---------- Estilos (con conteo de referencias: se quitan cuando no queda ningún panel) ----------
let styleRefs = 0;
function retainStyle() {
  styleRefs++;
  if (!document.getElementById('panels-style')) {
    const st = document.createElement('style');
    st.id = 'panels-style';
    st.textContent = PANEL_CSS;
    document.head.append(st);
  }
}
function releaseStyle() {
  styleRefs = Math.max(0, styleRefs - 1);
  // esperar a que termine la animación de cierre del modal antes de sacar los estilos
  setTimeout(() => {
    if (styleRefs === 0) document.getElementById('panels-style')?.remove();
    maybeRemoveFx();
  }, 320);
}

// ---------- Capa de efectos (arriba de los modales; #fx-root queda debajo) ----------
function fxLayer() {
  let l = document.getElementById('pnl-fx');
  if (!l) {
    l = document.createElement('div');
    l.id = 'pnl-fx';
    Object.assign(l.style, { position: 'absolute', inset: '0', zIndex: '60', pointerEvents: 'none', overflow: 'hidden' });
    (document.getElementById('app') || document.body).append(l);
  }
  return l;
}
function maybeRemoveFx() {
  const l = document.getElementById('pnl-fx');
  if (l && styleRefs === 0 && !l.childElementCount) l.remove();
}

/** Íconos que vuelan desde (x,y) al contador del HUD. kind: coins | gems | xp */
export function flyTo(x, y, kind = 'coins', count = 6) {
  const layer = fxLayer();
  const target = document.querySelector(`[data-hud="${kind}"]`);
  const r = target?.getBoundingClientRect();
  const visible = r && r.width > 0;
  const tx = visible ? r.left + 16 : innerWidth / 2, ty = visible ? r.top + r.height / 2 : -20;
  const name = kind === 'gems' ? 'gem' : kind === 'xp' ? 'xp' : 'coin';
  count = Math.min(10, Math.max(1, Math.round(count)));
  for (let i = 0; i < count; i++) {
    const el = document.createElement('div');
    el.innerHTML = icon(name, 26);
    Object.assign(el.style, { position: 'absolute', left: x + 'px', top: y + 'px', filter: 'drop-shadow(0 2px 0 rgba(8, 6, 5,.35))' });
    layer.append(el);
    const dx = (Math.random() - 0.5) * 110, dy = (Math.random() - 0.5) * 90 - 20;
    const anim = el.animate([
      { transform: 'translate(-50%,-50%) scale(.4)', opacity: 1 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(1.25)`, opacity: 1, offset: 0.32 },
      { transform: `translate(calc(-50% + ${tx - x}px), calc(-50% + ${ty - y}px)) scale(.7)`, opacity: 0.95 },
    ], { duration: 720 + i * 60, easing: 'cubic-bezier(.5,0,.6,1)' });
    anim.onfinish = () => {
      el.remove();
      if (i === 0 || i === count - 1) audio.sfx(kind === 'gems' ? 'gem' : kind === 'xp' ? 'select' : 'coin');
      if (target) { target.classList.remove('bump'); void target.offsetWidth; target.classList.add('bump'); }
      maybeRemoveFx();
    };
  }
}

/** Confeti pixelado (con estrellitas) que sale desde (ox, oy) en px de pantalla. */
export function burst(ox = innerWidth / 2, oy = innerHeight * 0.4, n = 90) {
  const layer = fxLayer();
  const cv = document.createElement('canvas');
  Object.assign(cv.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', imageRendering: 'pixelated' });
  layer.append(cv);
  const scale = 4;
  cv.width = Math.ceil(innerWidth / scale); cv.height = Math.ceil(innerHeight / scale);
  const g = cv.getContext('2d');
  const cols = ['#ee8a5c', '#7f9ee8', '#6fe3c1', '#8fd3ff', '#ffd166', '#ffffff', '#ffd8c4'];
  const parts = Array.from({ length: n }, () => {
    const a = Math.random() * Math.PI * 2, sp = 1.2 + Math.random() * 3.2;
    return { x: ox / scale, y: oy / scale, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 2.2, c: cols[(Math.random() * cols.length) | 0], s: Math.random() < 0.25 ? 2 : 1, star: Math.random() < 0.18 };
  });
  let t = 0;
  (function frame() {
    if (!cv.isConnected) return;
    g.clearRect(0, 0, cv.width, cv.height);
    for (const p of parts) {
      p.vy += 0.085; p.x += p.vx; p.y += p.vy; p.vx *= 0.985;
      const x = Math.round(p.x), y = Math.round(p.y);
      g.fillStyle = p.c;
      if (p.star) { g.fillRect(x - 1, y, 3, 1); g.fillRect(x, y - 1, 1, 3); }
      else g.fillRect(x, y, p.s, p.s);
    }
    if (++t < 150) requestAnimationFrame(frame); else { cv.remove(); maybeRemoveFx(); }
  })();
}

/** Texto flotante arriba de todo. */
export function floatUp(x, y, html) {
  const layer = fxLayer();
  const el = document.createElement('div');
  el.className = 'float-text';
  el.innerHTML = html;
  Object.assign(el.style, { left: x + 'px', top: y + 'px' });
  layer.append(el);
  setTimeout(() => { el.remove(); maybeRemoveFx(); }, 1100);
}

/** Efecto de premio desde un elemento: íconos volando (+ confeti solo si se pide: es para momentos grandes). */
export function rewardFx(fromEl, reward = {}, { confetti = false, chestText = true } = {}) {
  const r = fromEl?.getBoundingClientRect?.();
  const x = r && r.width ? r.left + r.width / 2 : innerWidth / 2;
  const y = r && r.width ? r.top + r.height / 2 : innerHeight / 2;
  let delay = 0;
  if (reward.coins) { setTimeout(() => flyTo(x, y, 'coins', 3 + reward.coins / 60), delay); delay += 120; }
  if (reward.gems) { setTimeout(() => flyTo(x, y, 'gems', 2 + reward.gems / 2), delay); delay += 120; }
  if (reward.xp) setTimeout(() => flyTo(x, y, 'xp', 3), delay);
  const chests = chestList(reward);
  if (chests.length && chestText) setTimeout(() => floatUp(x, y - 30, `${chestArt(chests[0].type, 30)} ${esc(CHESTS[chests[0].type].name)}`), delay + 150);
  if (confetti) burst(x, y, 70);
}

// ---------- Premios con cofres, figuritas y objetos ----------
/** Cofres de un premio: reward.chest puede ser 'plata' | {type, n} | ['madera', 'plata']; reward.chests = cantidad. */
export function chestList(reward = {}) {
  const raw = reward?.chest;
  if (!raw) return [];
  const list = Array.isArray(raw) ? raw : [raw];
  const out = [];
  for (const c of list) {
    const type = typeof c === 'string' ? c : c?.type;
    if (!CHESTS[type]) continue;
    const n = Math.max(1, Math.round((typeof c === 'object' ? c.n : null) ?? (list.length === 1 ? reward.chests : 1) ?? 1) || 1);
    const prev = out.find(o => o.type === type);
    if (prev) prev.n += n; else out.push({ type, n });
  }
  return out;
}
/** Cantidad de figuritas de un premio: número | {n, minStars} | {id: cantidad}. */
export function stickerCount(st) {
  if (!st) return 0;
  if (typeof st === 'number') return Math.max(0, Math.round(st));
  if (typeof st === 'object') {
    if (typeof st.n === 'number') return Math.max(0, Math.round(st.n));
    return Object.values(st).reduce((s, v) => s + (Number(v) || 0), 0);
  }
  return 0;
}
/**
 * HTML de un premio completo: monedas/gemas/xp + cofres (con su nombre) + figuritas + objetos de mochila.
 * names=false: solo íconos y cantidades (para celdas chicas).
 */
export function rewardHtml(reward = {}, size = 16, { names = true } = {}) {
  if (!reward || typeof reward !== 'object') return '';
  const parts = [];
  if (reward.coins || reward.gems || reward.xp || reward.mats) parts.push(costHtml({ coins: reward.coins, gems: reward.gems, xp: reward.xp, mats: reward.mats }, size));
  for (const { type, n } of chestList(reward)) {
    const nm = CHESTS[type].name;
    parts.push(`<span class="cost pnl-rw" title="${esc(nm)}">${chestArt(type, Math.round(size * 1.25))}${names ? `<span>${esc(nm)}</span>` : ''}${n > 1 || !names ? `<span>×${n}</span>` : ''}</span>`);
  }
  const st = stickerCount(reward.stickers);
  if (st) parts.push(`<span class="cost pnl-rw" title="Hallazgos">${icon('🃏', size)}<span>${names ? `${st} hallazgo${st === 1 ? '' : 's'}` : '×' + st}</span></span>`);
  if (reward.items && typeof reward.items === 'object') {
    for (const [id, n] of Object.entries(reward.items)) {
      const it = ITEMS[id];
      if (!it || !n) continue;
      parts.push(`<span class="cost pnl-rw" title="${esc(it.name)}">${icon(it.icon, size)}<span>${names ? esc(it.name) + (n > 1 ? ' ×' + n : '') : '×' + n}</span></span>`);
    }
  }
  return parts.join(' ');
}

// ---------- Cáscara de panel ----------
const active = new Map();
export const isOpen = (name) => active.has(name);
export function getOpen(name) { return active.get(name); }

function isTop(box) {
  const root = document.getElementById('modal-root');
  if (!root) return false;
  // los modales que se están cerrando pierden la clase .show (y quedan 220ms en el DOM)
  const backs = [...root.children].filter(c => c.classList.contains('modal-back') && c.classList.contains('show') && !c.dataset.closing);
  return backs.length > 0 && backs[backs.length - 1] === box.parentElement;
}

/**
 * Abre un modal/sheet del núcleo con limpieza automática.
 * Devuelve shell: { body, el, close, done(Promise), onCleanup(fn), on(bus, ev, fn), every(ms, fn), keys(fn), escAction }
 */
export function openShell(ctx, name, { title = '', ic, sheet = false, className = '', closable = true, actions = [] } = {}) {
  if (active.has(name)) return null;
  retainStyle();
  // en PC, sacar el foco de lo que estaba atrás (Enter/Espacio no deben re-tocar botones del HUD)
  if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur?.();
  const cleanups = [];
  let resolveDone;
  const done = new Promise(r => { resolveDone = r; });
  let closed = false;
  const m = ctx.ui.modal({
    title, icon: ic, closable, actions,
    className: [sheet ? 'sheet' : '', 'pnl', className].filter(Boolean).join(' '),
    onClose: () => {
      closed = true;
      if (m?.el?.parentElement) m.el.parentElement.dataset.closing = '1';
      for (const fn of cleanups.splice(0).reverse()) { try { fn(); } catch (e) { console.error('[panels] cleanup', e); } }
      active.delete(name);
      audio.sfx('close');
      releaseStyle();
      resolveDone(shell.result);
    },
  });
  const shell = {
    name, m, body: m.body, el: m.el, done, result: undefined,
    get closed() { return closed; },
    close(result) { if (result !== undefined) shell.result = result; m.close(); },
    onCleanup(fn) { cleanups.push(fn); },
    on(bus, ev, fn) { cleanups.push(bus.on(ev, fn)); },
    every(ms, fn) { const id = setInterval(fn, ms); cleanups.push(() => clearInterval(id)); return id; },
    later(ms, fn) { const id = setTimeout(() => { if (!closed) fn(); }, ms); cleanups.push(() => clearTimeout(id)); return id; },
    keyHandler: null,
    escAction: closable ? () => m.close() : null,
    isTop: () => isTop(m.el),
  };
  const onKey = (e) => {
    if (closed || !isTop(m.el)) return;
    const tag = e.target?.tagName;
    const typing = tag === 'INPUT' || tag === 'TEXTAREA';
    if (e.key === 'Escape') {
      if (typing) { e.target.blur(); e.preventDefault(); return; }
      if (shell.escAction) { e.preventDefault(); shell.escAction(); }
      return;
    }
    if (!typing) shell.keyHandler?.(e);
  };
  addEventListener('keydown', onKey);
  cleanups.push(() => removeEventListener('keydown', onKey));
  active.set(name, shell);
  return shell;
}

/**
 * Confirmación (Sí/No) con la misma cáscara: Esc o tocar afuera = cancelar (el confirm del núcleo no escucha Esc).
 * Si ya hay una igual abierta (doble toque) resuelve false en vez de apilar otra.
 */
export function askConfirm(ctx, { title, html, ok = 'Sí', cancel = 'No', okCls = 'primary', ic } = {}) {
  return new Promise(res => {
    let v = false;
    const sh = openShell(ctx, 'confirm:' + title, {
      title, ic, className: 'pnl-confirm',
      actions: [{ label: cancel, cls: 'ghost' }, { label: ok, cls: okCls, onClick: () => { v = true; } }],
    });
    if (!sh) { res(false); return; }
    sh.body.innerHTML = `<p class="pnl-confirm-txt">${html}</p>`;
    sh.done.then(() => res(v));
  });
}

// ---------- Íconos pixel propios (minijuegos, bandera, compartir) ----------
const PAL = {
  k: '#3d2f2a', w: '#ffffff', p: '#ee8a5c', P: '#c8673d', q: '#ffd8c4', l: '#7f9ee8', L: '#5a78c4', m: '#6fe3c1', M: '#3cbf9a',
  s: '#8fd3ff', S: '#4fa8e0', y: '#ffd166', Y: '#e8a93a', g: '#ddd5c8', G: '#ada190', r: '#ff6f6f', c: '#fdf6e3', o: '#6e5a4f',
};
/** Mapa de caracteres -> canvas de 1 px por celda (icons.js lo agranda nítido al tamaño de pantalla). */
function gridToCanvas(rows, pal = PAL) {
  const h = rows.length, w = Math.max(...rows.map(r => r.length));
  const n = Math.max(w, h);
  const cv = document.createElement('canvas');
  cv.width = cv.height = n;
  const g = cv.getContext('2d');
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch !== '.' && pal[ch]) { g.fillStyle = pal[ch]; g.fillRect(x + Math.floor((n - w) / 2), y + Math.floor((n - h) / 2), 1, 1); }
  }));
  return cv;
}

const ART = {
  share: () => [
    '.......kk.......',
    '......kssk......',
    '.....kssssk.....',
    '....kkkssskk....',
    '.......ss.......',
    '..kkk..ss..kkk..',
    '..ks...ss...sk..',
    '..ks...ss...sk..',
    '..ks........sk..',
    '..ks........sk..',
    '..ks........sk..',
    '..kssssssssssk..',
    '..kkkkkkkkkkkk..',
  ],
  addHome: () => [
    'kkkkkkkkkkkkkk',
    'kwwwwwwwwwwwwk',
    'kwwwwwkkwwwwwk',
    'kwwwwwkkwwwwwk',
    'kwwwwwkkwwwwwk',
    'kwwkkkkkkkkwwk',
    'kwwkkkkkkkkwwk',
    'kwwwwwkkwwwwwk',
    'kwwwwwkkwwwwwk',
    'kwwwwwkkwwwwwk',
    'kwwwwwwwwwwwwk',
    'kkkkkkkkkkkkkk',
  ],
};
const artDone = new Set();
/** <img> de un ícono propio dibujado acá: 'share' | 'addHome' */
export function art(name, size = 48, cls = '') {
  if (!artDone.has(name)) { artDone.add(name); registerIcon('art-' + name, gridToCanvas(ART[name]())); }
  return icon('art-' + name, size, cls);
}
/** Cofre pixel (sin WebGL) con los colores de CHESTS[type]. */
export function chestArt(type, size = 32) {
  return chestIcon(CHESTS[type] ? type : 'madera', size);
}

/** Banderita pixel del castillo con el color elegido. */
export function flagArt(hex, size = 48) {
  const rows = [
    '.kk.........',
    'kyyk........',
    '.kk.........',
    '.kokkkkkkk..',
    '.kocccccck..',
    '.kocccccccck',
    '.koccccccck.',
    '.kocccccck..',
    '.kokkkkkk...',
    '.ko.........',
    '.ko.........',
    '.kk.........',
  ];
  const name = 'flag-' + hex;
  if (!ICON_NAMES.includes(name)) registerIcon(name, gridToCanvas(rows, { ...PAL, c: hex, o: '#b07a52' }));
  return icon(name, size);
}

// ---------- Helpers de misiones ----------
/** Ícono (HTML) para un objetivo de misión. */
export function goalIcon(goal, size = 32) {
  if (goal.type === 'chest' || goal.type === 'chests' || goal.type === 'openChest') return chestArt(goal.chest || 'madera', size);
  const map = {
    build: 'hammer', upgrade: 'up', collect: 'coin', earn: 'coin',
    customize: 'dress', buy: 'shop', level: 'xp', pop: 'people', happy: 'smile', expand: 'map', castle: 'castle', charm: 'sparkle', rank: 'castle',
    sticker: '🃏', stickers: '🃏', album: '🃏', season: 'sparkle', friend: 'people', friends: 'people', help: 'heart', gift: 'gift', visit: 'home',
    prov: '🍞', craft: 'hammer', expedition: '🧭', zone: 'map', expStars: 'star', expFar: 'map', threat: 'bolt', repair: 'hammer', combat: '⚔️', story: '📖',
  };
  return icon(map[goal.type] || 'quest', size);
}

/**
 * Acción sugerida para avanzar un objetivo: {label, ic, run} o null (plan §E1: todos los tipos). close() cierra el panel
 * desde el que se pide. La ciudad escucha city:highlight {id} (cámara al edificio), city:sign (cámara al cartel de
 * terreno), city:collect (cobrar todo) y city:focus {uid} (ficha del edificio).
 */
export function goalAction(ctx, goal, close) {
  const econ = ctx.economy;
  const st = ctx.state;
  const later = (fn) => { close(); setTimeout(fn, 260); };
  const buildFocus = (id) => ({ label: 'Construir', ic: 'hammer', run: () => { close(); ctx.bus.emit('hud:build', id ? { focus: id } : {}); } });
  const has = (id) => st.city.buildings.some(b => b.id === id && !b.buildEnd);
  const placed = (id) => st.city.buildings.some(b => b.id === id);
  const expOpen = () => { try { return ctx.expedition && (placed('casa_exp') || !!st.expedition?.active); } catch { return false; } };
  const toExpedition = (region) => (expOpen()
    ? { label: 'Expedición', ic: '🧭', run: () => later(() => ctx.openPanel('expedition', region ? { region } : {})) }
    : buildFocus('casa_exp'));
  switch (goal.type) {
    case 'build': {
      const id = goal.id || goal.ids?.[0];
      return buildFocus(id);
    }
    case 'pop': return buildFocus('casita');
    case 'happy': return buildFocus('arbusto');
    // Encanto: deco variada (la que todavía no tiene suma más); rango: el panel "Tu ciudad" con el expediente
    case 'charm': return buildFocus(['banco', 'fuente', 'cerezo', 'macetas', 'farol', 'arbusto'].find(id => econ.canBuild(id).ok && econ.countOf(id) === 0) || 'arbusto');
    case 'castle': case 'rank': return { label: 'Ver ciudad', ic: 'castle', run: () => later(() => ctx.openPanel('rank')) };
    case 'customize': case 'buy':
      if (!econ.hasBuilt('boutique_real') && !placed('boutique_real')) return buildFocus('boutique_real');
      return { label: 'Equipaje', ic: 'dress', run: () => { close(); ctx.router.go('wardrobe'); } };
    case 'upgrade': {
      const b = st.city.buildings.find(x => x.id !== 'castillo' && !x.buildEnd && !x.upgradeEnd && (() => { try { return econ.upgradeInfo(x) && econ.canUpgrade(x).ok; } catch { return false; } })())
        || st.city.buildings.find(x => x.id !== 'castillo' && !x.buildEnd && (() => { try { return !!econ.upgradeInfo(x); } catch { return false; } })());
      return b ? { label: 'Mejorar', ic: 'up', run: () => { close(); ctx.bus.emit('city:focus', { uid: b.uid }); } } : buildFocus('casita');
    }
    case 'collect': case 'earn': return { label: 'Cobrar todo', ic: 'coin', run: () => { close(); ctx.bus.emit('city:collect'); } };
    case 'prov': return has('huerta') ? { label: 'Ver la Huerta', ic: '🍞', run: () => { close(); ctx.bus.emit('city:highlight', { id: 'huerta' }); } } : buildFocus('huerta');
    case 'craft': return has('taller') ? { label: 'Taller', ic: 'hammer', run: () => later(() => ctx.openPanel('workshop')) } : buildFocus('taller');
    case 'expedition': case 'zone': return toExpedition(goal.region);
    case 'expStars': case 'expFar': case 'combat': return toExpedition();
    case 'expand': return { label: 'Ver el cartel', ic: 'map', run: () => { close(); ctx.bus.emit('city:sign'); } };
    case 'threat': {
      let visible = false;
      try { visible = !!ctx.threats?.threatStatus?.()?.visible; } catch {}
      return visible ? { label: 'Ver la amenaza', ic: 'bolt', run: () => { close(); ctx.bus.emit('threat:panel'); } } : null;
    }
    case 'repair': {
      const b = st.city.buildings.find(x => x.damaged);
      return b ? { label: 'Reparar', ic: 'hammer', run: () => { close(); ctx.bus.emit('city:focus', { uid: b.uid }); } } : null;
    }
    case 'story': return { label: 'Bitácora', ic: '📖', run: () => later(() => ctx.openPanel('story')) };
    default: return null;
  }
}

/** Texto "3/5" con números lindos. */
export function progressLabel(cur, max, fmtNum) {
  return `${fmtNum(Math.min(cur, max))}/${fmtNum(max)}`;
}
