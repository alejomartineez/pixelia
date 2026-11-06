// Potenciadores de los minijuegos (objetos de la mochila de cofres) + chip de evento activo.
// Compartido por las pantallas previas de Joyas Brillantes, Estacionamiento Express y Ruta Pixel, y por el botón
// de bomba de Bloques Pixel. Contrato: los juegos leen chests.itemCount(id) y llaman chests.consumeItem(id)
// al usarlo; el núcleo no interviene. Los premios extra de eventos los aplica ctx.endGame (núcleo).
import { ITEMS, RARITIES, itemCount, consumeItem } from '../chests/chests.js';
import { activeEvents, eventMult } from '../season/events.js';
import { icon } from '../core/icons.js';

const STYLE_ID = 'pix-boosters-style';
const CSS = `
.pxb-row { display: flex; flex-direction: column; gap: 6px; width: 100%; text-align: left; }
.pxb-head { display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 700; color: var(--ink-l); padding-left: 2px; }
.pxb-slots { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px; }
.pxb-slot { --rar: #6fe3c1; --rar-d: #3cbf9a; position: relative; display: flex; align-items: center; gap: 9px; min-height: 56px; padding: 6px 10px 6px 7px;
  background: #fff; color: var(--ink); font: inherit; text-align: left; cursor: pointer; border: var(--line) solid var(--ink); border-radius: 14px;
  box-shadow: 0 3px 0 var(--ink); transition: transform .12s, background-color .15s; -webkit-tap-highlight-color: transparent; }
.pxb-slot:active { transform: translateY(2px); box-shadow: 0 1px 0 var(--ink); }
.pxb-slot:focus-visible { outline: 3px solid var(--primary-d); outline-offset: 2px; }
.pxb-ic { position: relative; flex: none; width: 42px; height: 42px; display: grid; place-items: center; border-radius: 11px;
  background: #fff; background: color-mix(in srgb, var(--rar) 32%, #fff); border: 2px solid var(--rar-d); }
.pxb-ic .pi { image-rendering: pixelated; }
.pxb-n { position: absolute; right: -8px; bottom: -7px; min-width: 22px; height: 20px; padding: 0 5px; border-radius: 10px; display: grid; place-items: center;
  background: var(--ink); color: #fff; font-size: 12px; font-weight: 700; border: 2px solid #fff; font-variant-numeric: tabular-nums; }
.pxb-txt { display: flex; flex-direction: column; min-width: 0; line-height: 1.15; }
.pxb-txt b { font-size: 14px; }
.pxb-txt small { font-size: 12px; color: var(--ink-l); }
.pxb-rar { display: inline-block; margin-top: 2px; align-self: flex-start; font-size: 10px; font-weight: 700; padding: 0 6px; border-radius: 6px;
  background: var(--rar); color: var(--ink); letter-spacing: .3px; text-transform: uppercase; }
.pxb-check { position: absolute; top: -9px; right: -9px; width: 24px; height: 24px; border-radius: 50%; display: none; place-items: center;
  background: var(--mint); border: 2px solid var(--ink); box-shadow: 0 2px 0 var(--ink); }
.pxb-slot.on { background: color-mix(in srgb, var(--rar) 22%, #fff); box-shadow: 0 3px 0 var(--ink), inset 0 0 0 3px var(--rar); }
.pxb-slot.on .pxb-check { display: grid; animation: pxb-pop .3s cubic-bezier(.3,1.8,.6,1); }
.pxb-slot.on .pxb-txt small { color: var(--mint-d); font-weight: 700; }
.pxb-slot.empty { cursor: default; background: #f8f5f0; border-color: var(--ink-ll); box-shadow: 0 2px 0 var(--ink-ll); }
.pxb-slot.empty .pxb-ic { filter: grayscale(1); opacity: .55; border-color: var(--ink-ll); background: #f1ede6; }
.pxb-slot.empty .pxb-txt b { color: var(--ink-l); }
.pxb-slot.empty .pxb-n { background: var(--ink-ll); }
.pxb-slot.empty .pxb-rar { filter: grayscale(1); opacity: .6; }
.pxb-slot.nope { animation: pxb-nope .3s steps(4); }
.pxb-event { --ev: #ffd166; --ev-d: #e8a93a; display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px 4px 6px; border-radius: 99px;
  border: 2px solid var(--ink); background: var(--ev); box-shadow: inset 0 -3px 0 var(--ev-d), 0 2px 0 var(--ink); font-size: 14px; font-weight: 700;
  color: var(--ink); line-height: 1.15; text-align: left; animation: pxb-glow 1.4s steps(2) infinite; }
.pxb-event b { white-space: nowrap; }
@keyframes pxb-pop { from { transform: scale(.2); } }
@keyframes pxb-nope { 25% { transform: translateX(-4px); } 50% { transform: translateX(4px); } 75% { transform: translateX(-2px); } }
@keyframes pxb-glow { 50% { filter: brightness(1.08); } }
@media (prefers-reduced-motion: reduce) { .pxb-event, .pxb-slot.on .pxb-check { animation: none; } }
`;

export function injectBoosterStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const st = document.createElement('style');
  st.id = STYLE_ID;
  st.textContent = CSS;
  document.head.append(st);
}

export const boosterDef = (id) => ITEMS[id];
export const boosterCount = (id) => itemCount(id);
export function boosterIcon(id, size = 28) { return icon(ITEMS[id]?.icon || 'sparkle', size); }

const fmtMult = (m) => String(Math.round(m * 100) / 100).replace('.', ',');

/** Evento activo que mejora los premios de este juego: { title, emoji, color, dark, mult } o null. */
export function gameEvent(game) {
  const key = game + 'Rewards';
  let mult = 1;
  try { mult = eventMult(key); } catch (e) { console.warn(e); return null; }
  if (!(mult > 1)) return null;
  let ev = null;
  try { ev = activeEvents().find(e => (e.mult?.[key] || 1) > 1) || null; } catch (e) { console.warn(e); }
  return { title: ev?.title || 'Evento especial', emoji: ev?.emoji || '✨', color: ev?.color || '#ffd166', dark: ev?.dark || '#e8a93a', mult };
}

/** HTML del chip de evento ("¡Semana de Joyas! premios ×1,5") o '' si no hay evento para este juego. */
export function eventChipHtml(game, esc = (s) => s) {
  const ev = gameEvent(game);
  if (!ev) return '';
  return `<span class="pxb-event" style="--ev:${ev.color};--ev-d:${ev.dark}">${icon(ev.emoji, 20)}<span>¡${esc(ev.title)}! <b>premios ×${fmtMult(ev.mult)}</b></span></span>`;
}

/**
 * Fila de potenciadores con interruptores. sel: Set con los ids elegidos (se modifica).
 * Si no tenés el objeto, el slot aparece apagado con "Conseguilo en cofres" (no abre nada).
 * opts: { audio, title, onChange(sel) }
 */
export function boosterRow(ids, sel, opts = {}) {
  injectBoosterStyle();
  const { audio, onChange, title = 'Potenciadores' } = opts;
  for (const id of [...sel]) if (itemCount(id) <= 0) sel.delete(id);
  const row = document.createElement('div');
  row.className = 'pxb-row';
  row.innerHTML = `<div class="pxb-head">${icon('sparkle', 16)} ${title}</div><div class="pxb-slots"></div>`;
  const slots = row.querySelector('.pxb-slots');
  for (const id of ids) {
    const def = ITEMS[id];
    if (!def) continue;
    const rar = RARITIES[def.rarity] || RARITIES.comun;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pxb-slot';
    b.dataset.boost = id;
    b.style.setProperty('--rar', rar.color);
    b.style.setProperty('--rar-d', rar.dark);
    b.title = def.desc || def.name;
    const paint = () => {
      const n = itemCount(id);
      const on = sel.has(id) && n > 0;
      b.classList.toggle('on', on);
      b.classList.toggle('empty', n <= 0);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.setAttribute('aria-label', `${def.name}: ${n > 0 ? `tenés ${n}${on ? ', activado' : ''}` : 'conseguilo en cofres'}`);
      b.innerHTML = `<span class="pxb-ic">${icon(def.icon, 30)}<span class="pxb-n">×${n}</span></span>
        <span class="pxb-txt"><b>${def.name}</b><small>${n <= 0 ? 'Conseguilo en cofres' : on ? '¡Activado!' : 'Tocá para usar'}</small><span class="pxb-rar">${rar.name}</span></span>
        <span class="pxb-check">${icon('check', 16)}</span>`;
    };
    paint();
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      if (itemCount(id) <= 0) {
        audio?.sfx('error');
        b.classList.remove('nope'); void b.offsetWidth; b.classList.add('nope');
        return;
      }
      if (sel.has(id)) { sel.delete(id); audio?.sfx('tap'); } else { sel.add(id); audio?.sfx('select'); }
      paint();
      onChange?.(sel);
    });
    slots.append(b);
  }
  return row;
}

/** Gasta los potenciadores elegidos. Devuelve un Set con los que realmente se pudieron usar y vacía sel. */
export function consumeSelected(sel) {
  const used = new Set();
  for (const id of sel) if (consumeItem(id)) used.add(id);
  sel.clear();
  return used;
}

export { itemCount, consumeItem };
