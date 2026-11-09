// Lo que se ve de la historia (plan §D): hoja de diálogo con retrato pixel, líneas sueltas de la cartógrafa y escenas
// épicas a pantalla completa.
//  - showScene(ctx, scene): hoja abajo a la izquierda, arriba del HUD y debajo de los menús. No bloquea: se sigue
//    jugando con ella abierta. Clic en el texto termina la línea; "Seguir" pasa a la próxima; "Saltar" la cierra.
//  - bark(ctx, {who, text}): una línea que se va sola (al cobrar el tutorial).
//  - showEpic(ctx, scenes): pantalla completa, con las vetas de fondo. Clic, Enter o Espacio siguen; Esc saltea todo.
// Los retratos son 16×16 dibujados en un canvas sin suavizado (story-data.js). La velocidad del texto sale de
// Ajustes → Juego (textSpeed) y con "reducir movimiento" el texto aparece entero.
import { icon } from '../core/icons.js';
import { thumbnail } from '../avatar/wardrobe-stage.js';
import { CHARACTERS } from './story-data.js';
import { fill } from './story.js';

const CSS = `
#story-root { position: absolute; inset: 0; z-index: 45; pointer-events: none; }
/* con el HUD escondido (colocando un edificio, defendiendo una amenaza) la hoja espera sin tapar nada */
body.no-hud #story-root .st-card { display: none; }
/* un aviso de premio (subida de nivel, premio diario, rango) va primero: la hoja espera escondida y en pausa detrás */
body:has(.reward-modal) #story-root .st-card { opacity: 0; pointer-events: none; transition: opacity .15s; }
.st-card { position: absolute; left: calc(var(--safe-l) + 12px); bottom: calc(var(--safe-b) + 96px); width: min(420px, calc(100% - 24px));
  display: grid; grid-template-columns: 72px 1fr; gap: 0 12px; padding: 12px 14px 10px 12px; pointer-events: auto;
  background: var(--panel); color: var(--ink); border: var(--line) solid var(--edge); border-radius: 14px;
  box-shadow: 0 0 0 2px var(--metal) inset, 0 5px 0 var(--shade); animation: stIn .28s cubic-bezier(.3,1.4,.6,1); }
.st-card.out { animation: stOut .2s ease-in forwards; }
.st-card.bark { grid-template-columns: 52px 1fr; padding: 9px 12px 9px 10px; width: min(380px, calc(100% - 24px)); cursor: pointer; }
.st-art { grid-column: 1 / -1; display: flex; justify-content: center; align-items: center; gap: 14px; margin: 0 0 10px; padding: 10px 0 8px;
  background: var(--surface-2); border: 2px solid var(--edge); border-radius: 10px; box-shadow: inset 0 -3px 0 var(--rule); }
.st-art img { filter: drop-shadow(0 3px 0 var(--shade)); }
.st-art .st-art-title { font-size: 15px; font-weight: 700; color: var(--gold-t); letter-spacing: .03em; }
.st-face { width: 72px; height: 72px; align-self: start; border: 2px solid var(--edge); border-radius: 10px; background: var(--surface-2);
  box-shadow: inset 0 0 0 2px var(--rule); image-rendering: pixelated; }
.st-card.bark .st-face { width: 52px; height: 52px; }
.st-main { min-width: 0; display: flex; flex-direction: column; }
.st-who { font-size: 14px; font-weight: 700; color: var(--gold-t); line-height: 1.1; }
.st-who small { color: var(--ink-ll); font-weight: 700; }
.st-txt { margin: 4px 0 6px; font-size: 17px; line-height: 1.25; min-height: 2.5em; cursor: pointer; }
.st-card.bark .st-txt { min-height: 0; margin: 2px 0 0; font-size: 16px; }
.st-foot { display: flex; align-items: center; gap: 8px; }
.st-dots { display: flex; gap: 4px; margin-right: auto; }
.st-dots i { width: 7px; height: 7px; border-radius: 2px; background: var(--track); border: 1px solid var(--edge); }
.st-dots i.on { background: var(--gold); }
.st-foot .btn { min-height: 34px; padding: 4px 12px; font-size: 15px; }
@keyframes stIn { from { transform: translateY(14px); opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes stOut { to { transform: translateY(10px); opacity: 0; } }

.st-epic { position: absolute; inset: 0; z-index: 65; display: flex; flex-direction: column; align-items: center; justify-content: center;
  background: radial-gradient(ellipse at 50% 55%, var(--surface) 0%, var(--page) 62%, var(--shade) 100%); color: var(--ink);
  pointer-events: auto; cursor: pointer; animation: stFade .5s ease-out; user-select: none; }
.st-epic.out { animation: stFadeOut .45s ease-in forwards; }
/* la llegada (see): las ruinas de la ciudad se ven detrás y Vera habla desde abajo */
.st-epic.see { justify-content: flex-end; padding-bottom: calc(9vh + 54px);
  background: linear-gradient(to bottom, rgba(6,6,9,.1) 0%, rgba(6,6,9,.25) 40%, rgba(6,6,9,.82) 72%, rgba(6,6,9,.94) 100%); }
.st-epic.see .st-veins { display: none; }
/* mientras habla Vera, el HUD y la pista de la ciudad no se ven detrás (se tapaban con Saltar y con la ayuda de abajo) */
body.st-seeing #hud, body.st-seeing .cx-tip { opacity: 0 !important; pointer-events: none !important; transition: opacity .3s; }
.st-epic.see .st-head { margin-bottom: 12px; }
.st-epic.see .st-face { width: 96px; height: 96px; margin-bottom: 12px; }
.st-epic::before, .st-epic::after { content: ''; position: absolute; left: 0; right: 0; height: 9vh; background: var(--shade); z-index: 1; }
.st-epic::before { top: 0; } .st-epic::after { bottom: 0; }
.st-veins { position: absolute; inset: 0; width: 100%; height: 100%; image-rendering: pixelated; opacity: .55; animation: stPulse 4s ease-in-out infinite; }
.st-epic .st-head { position: relative; z-index: 2; font-size: 15px; font-weight: 700; letter-spacing: .3em; text-transform: uppercase; color: var(--gold-t); margin-bottom: 18px; }
.st-epic .st-face { position: relative; z-index: 2; width: 112px; height: 112px; margin-bottom: 18px; border-width: 3px; }
.st-epic .st-line { position: relative; z-index: 2; max-width: min(760px, calc(100% - 48px)); min-height: 3.6em; text-align: center;
  font-size: clamp(22px, 2.6vw, 30px); line-height: 1.3; text-shadow: 0 2px 0 var(--shade); }
.st-epic .st-hint { position: absolute; z-index: 2; bottom: calc(9vh + 14px); left: 0; right: 0; text-align: center; font-size: 14px; color: var(--ink-ll); }
.st-epic .st-skip { position: absolute; z-index: 3; top: calc(9vh + 12px); right: 18px; }
.st-epic .st-dots { position: relative; z-index: 2; margin: 18px 0 0; }
@keyframes stFade { from { opacity: 0; } to { opacity: 1; } }
@keyframes stFadeOut { to { opacity: 0; } }
@keyframes stPulse { 0%, 100% { opacity: .4; } 50% { opacity: .7; } }
html.reduce-motion .st-card, html.reduce-motion .st-epic, html.reduce-motion .st-veins { animation: none; }
`;
let styled = false;
function ensureStyle() {
  if (styled) return;
  styled = true;
  const el = document.createElement('style');
  el.id = 'story-style';
  el.textContent = CSS;
  document.head.append(el);
}
function root() {
  let r = document.getElementById('story-root');
  if (!r) {
    r = document.createElement('div');
    r.id = 'story-root';
    (document.getElementById('app') || document.body).append(r);
  }
  return r;
}

// ---------- Retratos ----------
/**
 * Retrato del personaje: el busto de su modelo vóxel (thumbnail de wardrobe-stage.js, encuadre 'bust') sobre un fondo
 * oscuro con viñeta. Se dibuja una vez por personaje y se copia (es síncrono: panels-story lo pasa a imagen al toque).
 * Sin WebGL, el dibujo de 16×16. null si el personaje no tiene retrato.
 */
const busts = new Map();
const PORTRAIT_PX = 128;
function bust(ch) {
  if (busts.has(ch.id)) return busts.get(ch.id);
  let src = null;
  try { src = thumbnail({ type: 'avatar', look: ch.look, frame: 'bust', raw: true }); } catch (e) { console.warn('retrato', e); }
  let out = null;
  if (src) {
    out = document.createElement('canvas');
    out.width = out.height = PORTRAIT_PX;
    const g = out.getContext('2d');
    const bg = g.createRadialGradient(PORTRAIT_PX * 0.5, PORTRAIT_PX * 0.42, 8, PORTRAIT_PX * 0.5, PORTRAIT_PX * 0.5, PORTRAIT_PX * 0.72);
    bg.addColorStop(0, '#3a332c'); bg.addColorStop(1, '#151210');
    g.fillStyle = bg; g.fillRect(0, 0, PORTRAIT_PX, PORTRAIT_PX);
    g.imageSmoothingEnabled = false;
    g.drawImage(src, 0, 0, PORTRAIT_PX, PORTRAIT_PX);
  }
  busts.set(ch.id, out);
  return out;
}
export function portrait(who, cls = 'st-face') {
  const ch = CHARACTERS[who];
  const b = ch?.look ? bust(ch) : null;
  if (b) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = PORTRAIT_PX;
    cv.className = cls;
    cv.getContext('2d').drawImage(b, 0, 0);
    return cv;
  }
  if (!ch?.portrait) return null;
  const rows = ch.portrait;
  const cv = document.createElement('canvas');
  cv.width = 16; cv.height = 16;
  cv.className = cls;
  const g = cv.getContext('2d');
  rows.forEach((row, y) => [...row].forEach((c, x) => { if (c !== '.' && ch.pal[c]) { g.fillStyle = ch.pal[c]; g.fillRect(x, y, 1, 1); } }));
  return cv;
}
const whoHtml = (who) => {
  const ch = CHARACTERS[who];
  return ch?.name ? `${ch.name}${ch.title ? ` <small>· ${ch.title}</small>` : ''}` : '';
};

// ---------- Texto que se escribe ----------
/** Hay un aviso de premio abierto: la hoja no se escribe ni se va mientras tanto (no queda trabada a medias detrás). */
export const held = () => !!document.querySelector('.reward-modal');
const SPEED = { slow: 34, normal: 20, fast: 9, instant: 0 };
function typer(el, ctx) {
  let timer = 0, full = '', done = true;
  const ms = () => (ctx.ui.reducedMotion?.() ? 0 : SPEED[ctx.state.settings?.textSpeed] ?? SPEED.normal);
  return {
    get done() { return done; },
    set(text) {
      clearInterval(timer);
      full = text;
      const step = ms();
      if (!step) { el.textContent = full; done = true; return; }
      done = false;
      let i = 0;
      el.textContent = '';
      timer = setInterval(() => {
        if (held()) return;
        i += 1;
        el.textContent = full.slice(0, i);
        if (i >= full.length) { clearInterval(timer); done = true; }
      }, step);
    },
    finish() { clearInterval(timer); el.textContent = full; done = true; },
    stop() { clearInterval(timer); },
  };
}

// ---------- Hoja de diálogo ----------
let card = null;   // {el, close}
export const busy = () => !!card && !card.bark || !!document.querySelector('.st-epic');

function dropCard(v) {
  if (!card) return;
  const c = card;
  card = null;
  c.cleanup?.(v);
  c.el.classList.add('out');
  setTimeout(() => c.el.remove(), 220);
}

/**
 * Muestra una escena en la hoja de diálogo. Resuelve 'done' (llegó al final), 'skip' (Saltar o se cerró) o 'action'
 * (el botón extra de la escena).
 */
export function showScene(ctx, sc, { replay = false } = {}) {
  ensureStyle();
  dropCard();
  const { h } = ctx.ui;
  return new Promise(res => {
    const lines = sc.lines.map(l => fill(l, ctx.state));
    let i = 0, finished = false;
    const el = h('div.st-card', { role: 'dialog', 'aria-label': sc.title || 'Diálogo' });
    el.dataset.scene = sc.id;
    if (sc.art?.length) {
      const art = h('div.st-art', { html: sc.art.map((a, k) => icon(a, k === 1 ? 44 : 36)).join('') });
      art.insertBefore(h('span.st-art-title', {}, sc.title || ''), art.children[1] || null);
      el.append(art);
    }
    const face = portrait(sc.who) || h('div.st-face');
    const main = h('div.st-main');
    const txt = h('p.st-txt');
    const dots = h('div.st-dots', { html: lines.length > 1 ? lines.map(() => '<i></i>').join('') : '' });
    const next = h('button.btn.primary.small.st-next');
    const skip = h('button.btn.ghost.small.st-skip', {}, 'Saltar');
    const act = sc.action && !replay ? h('button.btn.gold.small.st-act', {}, sc.action.label) : null;
    const foot = h('div.st-foot', {}, dots, lines.length > 1 ? skip : null, act, next);
    main.append(h('div.st-who', { html: whoHtml(sc.who) }), txt, foot);
    el.append(face, main);
    root().append(el);
    const t = typer(txt, ctx);
    const show = () => {
      t.set(lines[i]);
      dots.querySelectorAll('i').forEach((d, k) => d.classList.toggle('on', k <= i));
      const last = i >= lines.length - 1;
      next.textContent = last ? (act ? 'Después' : 'Entendido') : 'Seguir';
    };
    const end = (v) => {
      if (finished) return;
      finished = true;
      t.stop();
      if (card?.el === el) dropCard(); else { el.classList.add('out'); setTimeout(() => el.remove(), 220); }
      res(v);
    };
    const advance = () => {
      if (!t.done) { t.finish(); return; }
      if (i < lines.length - 1) { i++; ctx.audio.sfx('select'); show(); } else end('done');
    };
    txt.onclick = advance;
    next.onclick = () => { ctx.audio.sfx('tap'); if (!t.done) t.finish(); if (i < lines.length - 1) { i++; show(); } else end('done'); };
    skip.onclick = () => { ctx.audio.sfx('close'); end('skip'); };
    if (act) act.onclick = () => { ctx.audio.sfx('tap'); end('action'); };
    card = { el, cleanup: (v = 'skip') => { if (!finished) { finished = true; t.stop(); res(v); } } };
    ctx.audio.sfx('open');
    show();
  });
}

/** Una línea suelta que se va sola (o con un clic). */
export function bark(ctx, { who = 'cartografa', text, ms = 5000 } = {}) {
  ensureStyle();
  if (card && !card.bark) return;   // una escena en pantalla manda: la línea se pierde
  dropCard();
  const { h } = ctx.ui;
  const el = h('div.st-card.bark', { role: 'status' });
  const txt = h('p.st-txt');
  el.append(portrait(who) || h('div.st-face'), h('div.st-main', {}, h('div.st-who', { html: whoHtml(who) }), txt));
  root().append(el);
  const t = typer(txt, ctx);
  t.set(text);
  // se va sola a los ms de estar a la vista (con un aviso de premio encima, el reloj se para)
  let left = ms;
  const timer = setInterval(() => {
    if (held()) return;
    left -= 250;
    if (left <= 0 && card?.el === el) dropCard();
  }, 250);
  el.onclick = () => { if (!t.done) t.finish(); else if (card?.el === el) dropCard(); };
  card = { el, bark: true, cleanup: () => { clearInterval(timer); t.stop(); } };
}

/** Se salió de la ciudad: la hoja abierta se guarda (resuelve 'away' para que vuelva a salir) y la línea suelta se va. */
export function leave() { dropCard('away'); }

// ---------- Pantalla completa ----------
/** Vetas de los cuatro elementos en un canvas chico (se agranda sin suavizado). */
function veins() {
  const cv = document.createElement('canvas');
  cv.className = 'st-veins';
  cv.width = 160; cv.height = 90;
  const g = cv.getContext('2d');
  const css = getComputedStyle(document.documentElement);
  const cols = ['--mint', '--sky', '--primary', '--second-t'].map(v => css.getPropertyValue(v).trim() || '#888');
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  cols.forEach((c, k) => {
    g.fillStyle = c;
    let x = 10 + k * 40 + rnd() * 10, y = k % 2 ? 0 : 89;
    const dy = k % 2 ? 1 : -1;
    for (let n = 0; n < 120; n++) {
      g.fillRect(Math.round(x), Math.round(y), 1, 1);
      x += (rnd() - 0.5) * 2.4 + (k < 2 ? 0.25 : -0.25);
      y += dy * (0.5 + rnd() * 0.7);
      if (y < 0 || y > 89) break;
    }
  });
  return cv;
}

/**
 * Escenas épicas a pantalla completa, una tras otra. Resuelve 'done' o 'skip' (Esc / Saltar). Las teclas no llegan al
 * juego de abajo.
 */
export function showEpic(ctx, scenes) {
  ensureStyle();
  dropCard();
  const { h } = ctx.ui;
  return new Promise(res => {
    const steps = [];
    for (const sc of scenes) sc.lines.forEach((l, k) => steps.push({ sc, k, text: fill(l, ctx.state) }));
    let i = 0, finished = false;
    const el = h('div.st-epic' + (scenes.some(sc => sc.see) ? '.see' : ''), { role: 'dialog', 'aria-label': scenes[0]?.title || 'Historia' });
    el.append(veins());
    const head = h('div.st-head');
    const faceBox = h('div');
    const line = h('p.st-line', { 'aria-live': 'polite' });
    const dots = h('div.st-dots');
    const skip = h('button.btn.ghost.small.st-skip', { html: `Saltar <small>(Esc)</small>` });
    const hint = h('div.st-hint', {}, 'Hacé clic para seguir');
    el.append(head, faceBox, line, dots, hint, skip);
    root().append(el);
    const see = el.classList.contains('see');
    if (see) document.body.classList.add('st-seeing');
    const t = typer(line, ctx);
    let curScene = null;
    const show = () => {
      const st = steps[i];
      if (st.sc !== curScene) {
        curScene = st.sc;
        head.textContent = st.sc.title || '';
        faceBox.replaceChildren(...[portrait(st.sc.who)].filter(Boolean));
        const n = st.sc.lines.length;
        dots.innerHTML = Array.from({ length: n }, () => '<i></i>').join('');
      }
      dots.querySelectorAll('i').forEach((d, j) => d.classList.toggle('on', j <= st.k));
      t.set(st.text);
    };
    const end = (v) => {
      if (finished) return;
      finished = true;
      t.stop();
      removeEventListener('keydown', onKey, true);
      el.classList.add('out');
      if (see) document.body.classList.remove('st-seeing');
      setTimeout(() => el.remove(), 450);
      res(v);
    };
    const advance = () => {
      if (!t.done) { t.finish(); return; }
      if (i < steps.length - 1) { i++; ctx.audio.sfx('select'); show(); } else end('done');
    };
    function onKey(e) {
      if (finished) return;
      if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); ctx.audio.sfx('close'); end('skip'); return; }
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight') { e.preventDefault(); e.stopImmediatePropagation(); if (!e.repeat) advance(); return; }
      e.stopImmediatePropagation();   // nada de la escena de abajo (WASD, atajos) mientras se lee
    }
    addEventListener('keydown', onKey, true);
    el.addEventListener('click', (e) => { if (e.target.closest('.st-skip')) { ctx.audio.sfx('close'); end('skip'); return; } advance(); });
    ctx.audio.sfx('swoosh');
    show();
  });
}
