// Arte de figuritas estilo "Panini" pixel: marco del color del set, número, nombre y estrellas.
// 1★ marco liso · 2★ filete plateado · 3★ marco dorado · 4★ dorado con brillo que pasa · 5★ holográfica arcoíris animada.
// Las cartas se escalan solas (container queries): basta con darles un ancho.
// El CSS se inyecta una sola vez (<style id="album-art-css">) y queda: lo usan también las UIs de cofres/premios.
import { iconUrl } from '../core/icons.js';

const CSS = `
.stk { --c: #ff7eb6; --cd: #e0528f; --cl: #ffd6e8; position: relative; display: block; width: 100%; aspect-ratio: 3 / 4; container-type: inline-size;
  border: 3px solid var(--ink); border-radius: 10px; background: #fff; box-shadow: 0 3px 0 var(--ink); overflow: hidden; color: var(--ink);
  font-family: var(--font); padding: 0; text-align: center; line-height: 1; isolation: isolate; }
button.stk { cursor: pointer; }
button.stk:active { transform: translateY(2px); box-shadow: 0 1px 0 var(--ink); }
.stk-in { position: absolute; inset: 0; display: flex; flex-direction: column; padding: 6cqw 6cqw 5cqw; background: var(--c);
  box-shadow: inset 0 -3cqw 0 var(--cd), inset 0 2cqw 0 rgba(255,255,255,.45); }
.stk-win { position: relative; flex: 1; min-height: 0; display: grid; place-items: center; border: 2px solid var(--ink); border-radius: 6px; overflow: hidden;
  background-color: var(--cl); background-image: radial-gradient(rgba(255,255,255,.85) 1.4cqw, transparent 1.6cqw); background-size: 11cqw 11cqw; }
.stk-win::before { content: ''; position: absolute; left: -10%; right: -10%; bottom: -24cqw; height: 52cqw; border-radius: 50%; background: rgba(255,255,255,.55); }
.stk-art { position: relative; z-index: 0; width: 66cqw; height: 66cqw; margin-top: -7cqw; image-rendering: pixelated; filter: drop-shadow(0 2.5cqw 0 rgba(59,35,64,.22)); }
.stk-num { position: absolute; top: 2.5cqw; left: 2.5cqw; z-index: 2; padding: 1.2cqw 3cqw 0.6cqw; font-size: 10.5cqw; font-weight: 700; background: #fff;
  border: 2px solid var(--ink); border-radius: 5px; line-height: 1; }
.stk-stars { position: absolute; left: 0; right: 0; bottom: 2.5cqw; z-index: 2; display: flex; justify-content: center; gap: 0.5cqw; }
.stk-stars img { width: 13cqw; height: 13cqw; filter: drop-shadow(0 1cqw 0 rgba(59,35,64,.3)); }
.stk-name { margin-top: 4cqw; min-height: 22cqw; display: grid; place-items: center; padding: 1.8cqw 2cqw 1.2cqw; background: #fff; border: 2px solid var(--ink); border-radius: 5px;
  font-size: 10.6cqw; font-weight: 700; line-height: .95; overflow: hidden; word-break: break-word; hyphens: auto; }
.stk-name span { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.stk-cnt { position: absolute; top: 2cqw; right: 2cqw; z-index: 4; min-width: 20cqw; padding: 1.5cqw 2.5cqw 0.8cqw; background: var(--pink); color: #fff; font-size: 12cqw; font-weight: 700;
  font-style: normal; border: 2px solid var(--ink); border-radius: 99px; text-shadow: 0 1px 0 rgba(59,35,64,.4); line-height: 1; }
.stk-new { position: absolute; z-index: 5; top: 13cqw; right: -15cqw; width: 64cqw; padding: 1.5cqw 0 0.8cqw; transform: rotate(35deg); background: var(--coral); color: #fff;
  font-size: 9.5cqw; font-weight: 700; border-top: 2px solid var(--ink); border-bottom: 2px solid var(--ink); text-shadow: 0 1px 0 rgba(59,35,64,.4); letter-spacing: .04em; }

/* 2★: filete plateado */
.stk.s2 .stk-in { box-shadow: inset 0 0 0 2cqw #f4f7ff, inset 0 0 0 3cqw #a9b6cf, inset 0 -4cqw 0 var(--cd); }
/* 3★ y 4★: marco dorado */
.stk.s3 .stk-in, .stk.s4 .stk-in { background: repeating-linear-gradient(135deg, #ffd166 0 6cqw, #ffe08f 6cqw 12cqw);
  box-shadow: inset 0 0 0 1.6cqw #fff3c4, inset 0 0 0 2.6cqw #e8a93a, inset 0 -4cqw 0 #e8a93a; }
.stk.s3 .stk-win, .stk.s4 .stk-win { border-color: #a8701c; }
.stk.s3 .stk-num, .stk.s4 .stk-num { background: var(--c); color: #fff; text-shadow: 0 1px 0 rgba(59,35,64,.45); }
.stk.s4 { box-shadow: 0 3px 0 var(--ink), 0 0 0 2px #ffe08f; }
/* 5★: holográfica */
.stk.s5 .stk-in { background: linear-gradient(135deg, #ff9ecf, #ffd166, #a6f0c6, #8fd3ff, #c9a2ff, #ff9ecf, #ffd166, #a6f0c6, #8fd3ff, #c9a2ff, #ff9ecf);
  background-size: 200% 200%; animation: stkHolo 4s linear infinite; box-shadow: inset 0 0 0 1.6cqw rgba(255,255,255,.7), inset 0 0 0 2.6cqw #fff; }
.stk.s5 .stk-win { border-color: var(--ink); }
.stk.s5 .stk-win::after { content: ''; position: absolute; inset: 0; z-index: 1; pointer-events: none; mix-blend-mode: color-dodge; opacity: .45;
  background: linear-gradient(135deg, #ff7eb6, #ffd166, #6fe3c1, #8fd3ff, #b58cff, #ff7eb6, #ffd166, #6fe3c1, #8fd3ff, #b58cff, #ff7eb6); background-size: 200% 200%; animation: stkHolo 4s linear infinite reverse; }
.stk.s5 .stk-num { background: linear-gradient(90deg, #ff7eb6, #b58cff); color: #fff; text-shadow: 0 1px 0 rgba(59,35,64,.45); }
.stk.s5 { animation: stkGlow 1.6s steps(2) infinite; }
@keyframes stkHolo { from { background-position: 0% 0%; } to { background-position: 100% 100%; } }
@keyframes stkGlow { 50% { box-shadow: 0 3px 0 var(--ink), 0 0 0 3px #fff, 0 0 0 5px #ffd166; } }
/* brillo que cruza (4★ y 5★) */
.stk-shine { position: absolute; inset: 0; z-index: 1; pointer-events: none;
  background: linear-gradient(115deg, transparent 38%, rgba(255,255,255,.8) 38% 44%, transparent 44% 48%, rgba(255,255,255,.6) 48% 50%, transparent 50%);
  background-size: 300% 100%; animation: stkShine 3.2s steps(16) infinite; }
@keyframes stkShine { 0% { background-position: 100% 0; } 55%, 100% { background-position: -50% 0; } }
.stk-tw { position: absolute; z-index: 3; width: 3cqw; height: 3cqw; background: #fff; pointer-events: none;
  box-shadow: 3cqw 0 #fff, -3cqw 0 #fff, 0 3cqw #fff, 0 -3cqw #fff; animation: stkTw 1.4s steps(2) infinite; }
.stk-tw.b { animation-delay: .45s; } .stk-tw.c { animation-delay: .9s; }
@keyframes stkTw { 0% { opacity: 0; } 50% { opacity: 1; } }

/* casillero vacío (no la tenés) */
.stk.miss { background: #f3ecf6; box-shadow: inset 0 3px 0 rgba(59,35,64,.12); animation: none; }
.stk.miss .stk-in { background: transparent; box-shadow: none; border: 2px dashed var(--ink-ll); border-radius: 7px; inset: 4cqw; padding: 4cqw; }
.stk.miss .stk-win { background: transparent; border: 0; }
.stk.miss .stk-win::before, .stk.miss .stk-win::after { display: none; }
.stk.miss .stk-art { filter: brightness(0); opacity: .1; }
.stk.miss .stk-bign { position: absolute; inset: 0; display: grid; place-items: center; font-size: 26cqw; font-weight: 700; color: var(--ink-ll); margin-top: -8cqw; }
.stk.miss .stk-name { background: transparent; border-color: transparent; color: var(--ink-ll); }
.stk.miss .stk-num { display: none; }
.stk.miss .stk-stars img { opacity: .8; filter: none; }

/* animación de "pegar" */
.stk.stk-stick { animation: stkStick .7s cubic-bezier(.3,1.5,.6,1) both; }
.stk.s5.stk-stick { animation: stkStick .7s cubic-bezier(.3,1.5,.6,1) both, stkGlow 1.6s steps(2) .7s infinite; }
@keyframes stkStick {
  0% { transform: translateY(-30px) rotate(-10deg) scale(1.45); opacity: 0; box-shadow: 0 18px 0 rgba(59,35,64,.25); }
  45% { transform: translateY(-6px) rotate(3deg) scale(1.12); opacity: 1; box-shadow: 0 12px 0 rgba(59,35,64,.2); }
  70% { transform: scale(.94, 1.04); box-shadow: 0 1px 0 var(--ink); }
  100% { transform: none; }
}
.stk-flash { position: absolute; inset: 0; z-index: 6; background: #fff; pointer-events: none; animation: stkFlash .5s steps(4) both; }
@keyframes stkFlash { from { opacity: .95; } to { opacity: 0; } }
.stk-burst { position: absolute; left: 50%; top: 50%; width: 0; height: 0; z-index: 7; pointer-events: none; }
.stk-burst i { position: absolute; width: 8px; height: 8px; margin: -4px; background: var(--gold); border: 2px solid var(--ink); animation: stkBurst .75s cubic-bezier(.2,.8,.4,1) both; }
.stk-burst i:nth-child(2n) { background: var(--pink); } .stk-burst i:nth-child(3n) { background: var(--mint); width: 6px; height: 6px; }
@keyframes stkBurst { from { transform: translate(0, 0) scale(1); opacity: 1; } to { transform: translate(var(--dx), var(--dy)) scale(.3); opacity: 0; } }

/* sobres */
.pk { --pc: #ff7eb6; --pd: #e0528f; position: relative; width: 100%; aspect-ratio: 3 / 4.1; container-type: inline-size; font-family: var(--font); color: var(--ink); }
.pk-body { position: absolute; left: 0; right: 0; top: 13cqw; bottom: 0; border: 3px solid var(--ink); border-radius: 6px 6px 10px 10px; overflow: hidden;
  background: repeating-linear-gradient(135deg, var(--pc) 0 9cqw, color-mix(in srgb, var(--pc) 82%, #fff) 9cqw 18cqw);
  box-shadow: inset -5cqw 0 0 var(--pd), inset 4cqw 0 0 rgba(255,255,255,.35), 0 4px 0 var(--ink); }
.pk-top { position: absolute; left: 0; right: 0; top: 0; height: 17cqw; z-index: 2; border: 3px solid var(--ink); border-bottom-style: dashed; border-radius: 6px 6px 0 0;
  background: var(--pd); box-shadow: inset 0 3cqw 0 rgba(255,255,255,.35); transform-origin: 8% 100%; }
.pk-top::after { content: ''; position: absolute; left: 4cqw; right: 4cqw; top: 5cqw; height: 3cqw; background: repeating-linear-gradient(90deg, rgba(255,255,255,.6) 0 4cqw, transparent 4cqw 8cqw); }
.pk-label { position: absolute; left: 9cqw; right: 9cqw; top: 26%; padding: 6cqw 3cqw 5cqw; background: #fff; border: 3px solid var(--ink); border-radius: 10px; text-align: center;
  box-shadow: 0 3px 0 var(--ink); display: flex; flex-direction: column; align-items: center; gap: 2cqw; }
.pk-label img { width: 40cqw; height: 40cqw; image-rendering: pixelated; filter: drop-shadow(0 2cqw 0 rgba(59,35,64,.2)); }
.pk-label b { font-size: 12.5cqw; line-height: .95; }
.pk-label small { font-size: 9cqw; color: var(--ink-l); font-weight: 700; }
.pk-shine { position: absolute; inset: 0; pointer-events: none; z-index: 1;
  background: linear-gradient(115deg, transparent 40%, rgba(255,255,255,.55) 40% 46%, transparent 46%); background-size: 300% 100%; animation: stkShine 3s steps(14) infinite; }
.pk.holo .pk-body { background: linear-gradient(135deg, #ffc2dc, #fff0c2, #c4f7e8, #d4efff, #dcc9ff, #ffc2dc, #fff0c2, #c4f7e8, #d4efff, #dcc9ff, #ffc2dc); background-size: 200% 200%; animation: stkHolo 4s linear infinite; }
.pk.gold .pk-body { background: repeating-linear-gradient(135deg, #ffd166 0 9cqw, #ffe9a6 9cqw 18cqw); }
@media (prefers-reduced-motion: reduce) {
  .stk.s5, .stk.s5 .stk-in, .stk.s5 .stk-win::after, .stk-shine, .stk-tw, .pk-shine, .pk.holo .pk-body { animation: none !important; }
}
`;

let cssEl = null;
export function ensureArtCss() {
  if (cssEl && cssEl.isConnected) return;
  cssEl = document.getElementById('album-art-css');
  if (!cssEl) {
    cssEl = document.createElement('style');
    cssEl.id = 'album-art-css';
    cssEl.textContent = CSS;
    document.head.append(cssEl);
  }
}

function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}
const escTxt = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/**
 * Carta de figurita.
 * def: definición (stickerDef(id)) — necesita {id, n, name, emoji, stars, color, dark, light}.
 * opts: { owned=true, count=1, isNew=false, stick=false, delay=0 (s), onClick, showCount=true, flash=false, className, title }
 * Devuelve un HTMLElement (div o button si hay onClick). Darle ancho desde afuera (la altura sale sola, 3:4).
 */
export function renderStickerCard(def, opts = {}) {
  ensureArtCss();
  if (!def) return el('div', 'stk miss');
  const { owned = true, count = 1, isNew = false, stick = false, delay = 0, onClick, showCount = true, flash = false, className = '' } = opts;
  const root = el(onClick ? 'button' : 'div', `stk s${def.stars}${owned ? '' : ' miss'}${stick ? ' stk-stick' : ''}${className ? ' ' + className : ''}`);
  if (onClick) { root.type = 'button'; root.addEventListener('click', onClick); }
  root.style.setProperty('--c', def.color);
  root.style.setProperty('--cd', def.dark);
  root.style.setProperty('--cl', def.light);
  if (delay) root.style.animationDelay = delay + 's';
  root.dataset.id = def.id;
  root.setAttribute('aria-label', owned ? `${def.name}, ${def.stars} estrellas${count > 1 ? `, tenés ${count}` : ''}` : `Figurita ${def.n}: te falta`);

  const inner = el('div', 'stk-in');
  const win = el('div', 'stk-win');
  win.append(el('span', 'stk-num', '#' + def.n));
  const art = document.createElement('img');
  art.className = 'stk-art';
  // data-pi: icons.js lo regenera a su tamaño real en pantalla (pixeles enteros, sin deformar)
  art.dataset.pi = def.emoji;
  art.src = iconUrl(def.emoji, 64);
  art.alt = ''; art.draggable = false;
  win.append(art);
  if (!owned) win.append(el('span', 'stk-bign', String(def.n)));
  const stars = el('span', 'stk-stars');
  const starIc = owned ? 'star' : 'starOff', starUrl = iconUrl(starIc, 14);
  for (let i = 0; i < def.stars; i++) { const im = document.createElement('img'); im.className = 'pi'; im.dataset.pi = starIc; im.src = starUrl; im.alt = ''; im.draggable = false; stars.append(im); }
  win.append(stars);
  inner.append(win);
  const name = el('div', 'stk-name');
  name.append(el('span', '', escTxt(def.name)));
  inner.append(name);
  root.append(inner);

  if (owned && def.stars >= 4) win.append(el('i', 'stk-shine'));
  if (owned && def.stars >= 5) {
    for (const [c, x, y] of [['a', 16, 30], ['b', 80, 18], ['c', 74, 56]]) {
      const tw = el('i', 'stk-tw ' + c);
      tw.style.left = x + '%'; tw.style.top = y + '%';
      root.append(tw);
    }
  }
  if (owned && showCount && count > 1 && !isNew) root.append(el('b', 'stk-cnt', 'x' + count));
  if (owned && isNew) root.append(el('span', 'stk-new', '¡NUEVA!'));
  if (flash) {
    const f = el('i', 'stk-flash');
    if (delay) f.style.animationDelay = (delay + 0.3) + 's';
    root.append(f);
  }
  return root;
}

/** Explosión de pixeles (para pegar figuritas / sacarlas del sobre). Se borra sola. */
export function burstAt(parent, { n = 10, dist = 60, delay = 0 } = {}) {
  ensureArtCss();
  const b = el('span', 'stk-burst');
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.4;
    const d = dist * (0.6 + Math.random() * 0.5);
    const p = el('i');
    p.style.setProperty('--dx', Math.round(Math.cos(a) * d) + 'px');
    p.style.setProperty('--dy', Math.round(Math.sin(a) * d) + 'px');
    if (delay) p.style.animationDelay = delay + 's';
    b.append(p);
  }
  parent.append(b);
  setTimeout(() => b.remove(), (delay + 0.9) * 1000);
  return b;
}

/**
 * Sobre de figuritas. item: {name, color, dark, emoji, desc?, id}. opts: {small}
 * Devuelve el elemento; su tapa es .pk-top (para la animación de rasgar).
 */
export function renderPack(item, opts = {}) {
  ensureArtCss();
  const id = item?.id || '';
  const root = el('div', 'pk' + (id === 'sobre_brillante' ? ' holo' : id === 'sobre_dorado' ? ' gold' : ''));
  root.style.setProperty('--pc', item?.color || '#ff7eb6');
  root.style.setProperty('--pd', item?.dark || '#e0528f');
  const body = el('div', 'pk-body');
  body.append(el('i', 'pk-shine'));
  root.append(body);
  root.append(el('div', 'pk-top'));
  const label = el('div', 'pk-label');
  label.innerHTML = `<img data-pi="${item?.emoji || '🌸'}" src="${iconUrl(item?.emoji || '🌸', 40)}" alt="" draggable="false"><b>${escTxt(item?.name || 'Sobre')}</b>${opts.small ? '' : `<small>FIGURITAS</small>`}`;
  root.append(label);
  return root;
}
