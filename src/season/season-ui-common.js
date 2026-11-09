// Utilidades de UI compartidas por el Pase de Temporada, la bienvenida y el panel de eventos:
// estilos inyectados (.ssn-*), íconos pixel de cofres/sobres y HTML de premios.
import { icon, registerIcon, chestLayers } from '../core/icons.js';
import { esc } from '../core/ui.js';
import { fmtNum } from '../core/economy.js';
import { CHESTS } from '../chests/chests.js';
import { HAIR_STYLES, avatarType } from '../core/data.js';

// ---------- Íconos de cofres y sobres (dibujados en icons.js, nítidos a cualquier tamaño) ----------
const chestDone = new Set();
/** Ícono de un cofre con los colores de su tipo. */
export function chestIcon(type = 'madera', size = 40) {
  if (!CHESTS[type]) type = 'madera';
  const name = 'chest-' + type;
  if (!chestDone.has(type)) {
    chestDone.add(type);
    const d = CHESTS[type] || { color: '#b07a52', trim: '#ddd5c8' };
    registerIcon(name, chestLayers(type === 'oro' ? '#ffd166' : d.color, d.trim, type === 'oro' ? '#ee8a5c' : '#ffd166'));
  }
  return icon(name, size);
}
/** Ícono de un sobre de figuritas. */
export function packIcon(size = 40) {
  return icon('pack', size);
}
// pelajes (diseños de pelo de los animalitos) se nombran como tales; el resto, por su nombre
const isFur = (id) => !!HAIR_STYLES.find(h => h.id === id)?.types?.every(t => avatarType(t).animal);
const COSMETIC_NAME = { hair: (n, id) => `${isFur(id) ? 'Pelaje' : 'Peinado'} ${n}`, body: n => `Esquife: ${n}`, wheels: n => `Aparejo: ${n}`, topper: n => `Proa: ${n}` };
const COSMETIC_IC = { hair: '💇', dress: 'dress', crown: 'crown', acc: 'wand', body: 'car', wheels: 'car', topper: 'car' };

/** Ícono grande de una parte de premio. */
export function partIcon(p, size = 40) {
  switch (p.kind) {
    case 'coins': return icon('coin', size);
    case 'gems': return icon('gem', size);
    case 'chest': return chestIcon(p.type, size);
    case 'stickers': return packIcon(size);
    case 'item': case 'equip': return icon(p.icon || 'gift', size);
    case 'mats': case 'planos': return icon(p.icon || 'gift', size);
    case 'cosmetic': return icon(COSMETIC_IC[p.target] || 'ribbon', size);
    default: return icon('gift', size);
  }
}
/** Texto corto de una parte de premio. */
export function partLabel(p) {
  switch (p.kind) {
    case 'coins': return `${fmtNum(p.amount)} monedas`;
    case 'gems': return `${fmtNum(p.amount)} gemas`;
    case 'chest': return (p.n > 1 ? `${p.n}× ` : '') + (p.name || CHESTS[p.type]?.name || 'Cofre');
    case 'stickers': return `${p.n} hallazgo${p.n > 1 ? 's' : ''}${p.minStars > 1 ? ` (${p.minStars}★+)` : ''}`;
    case 'item': case 'equip': return (p.n > 1 ? `${p.n}× ` : '') + p.name;
    case 'mats': return `${p.n} ${(p.name || '').toLowerCase()}`;
    case 'planos': return p.n === 1 ? '1 plano' : `${p.n} planos`;
    case 'cosmetic': return COSMETIC_NAME[p.target] ? COSMETIC_NAME[p.target](p.name, p.id) : p.name;
    default: return 'Regalo';
  }
}
/** Fila compacta (ícono + texto) para listas de premios. */
export function partChip(p, size = 22) {
  return `<span class="ssn-part">${partIcon(p, size)}<span>${esc(partLabel(p))}</span></span>`;
}

// ---------- Estilos ----------
let users = 0;
export function useStyle() {
  users++;
  if (!document.getElementById('season-style')) {
    const st = document.createElement('style');
    st.id = 'season-style';
    st.textContent = CSS;
    document.head.append(st);
  }
  let released = false;
  return () => {
    if (released) return; released = true;
    if (--users <= 0) { users = 0; setTimeout(() => { if (!users) document.getElementById('season-style')?.remove(); }, 400); }
  };
}
export function setTheme(el, t) {
  el.style.setProperty('--a', t.accent || t.color);
  el.style.setProperty('--ad', t.dark);
  // los colores claros de los datos se oscurecen acá (interfaz oscura, plan §J6)
  const dark = (c, k) => `color-mix(in srgb, ${c} ${k}%, #1d1916)`;
  el.style.setProperty('--al', dark(t.accent || t.color, 26));
  el.style.setProperty('--s1', dark(t.sky?.[0] || t.color, 34));
  el.style.setProperty('--s2', dark(t.sky?.[1] || t.color, 14));
}

const CSS = `
/* ===== Pase de Temporada / eventos (.ssn) ===== */
.modal.ssn { isolation: isolate; --a: var(--primary); --ad: var(--primary-d); --al: var(--primary-l); --s1: #3d3020; --s2: #26201c; }
.modal.ssn .modal-head { background: linear-gradient(color-mix(in srgb, var(--a) 58%, #1d1916), color-mix(in srgb, var(--ad) 58%, #1d1916)); }
.modal.ssn .modal-body { background-color: var(--panel); background-image: radial-gradient(color-mix(in srgb, var(--a) 22%, transparent) 1.6px, transparent 2px); background-size: 20px 20px; }
.modal.ssn.sheet .modal-body { flex: 1; padding-top: 0; }
.ssn-wrap { max-width: 600px; margin: 0 auto; display: flex; flex-direction: column; gap: 12px; padding-bottom: 8px; }
.ssn-pi { image-rendering: pixelated; }

/* héroe */
.ssn-evbar { --ec: var(--second); --ecd: var(--second-d); width: 100%; margin-top: 10px; display: flex; align-items: center; gap: 10px; padding: 8px 12px; text-align: left;
  background: var(--surface); border: var(--line) solid var(--edge); border-radius: 14px; box-shadow: var(--shadow); font: inherit; color: var(--ink); cursor: pointer; }
.ssn-evbar.live { background: color-mix(in srgb, var(--ec) 22%, var(--surface)); }
.ssn-evbar > span { flex: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.ssn-evbar b { font-size: 15px; } .ssn-evbar small { font-size: 12px; color: var(--ink-l); }
.ssn-evbar:active { transform: translateY(2px); box-shadow: 0 1px 0 var(--shade); }
.ssn-hero { position: relative; display: flex; align-items: center; gap: 12px; margin-top: 14px; padding: 12px 14px; border: var(--line) solid var(--edge); border-radius: 14px;
  background: linear-gradient(160deg, var(--s1), var(--s2)); box-shadow: 0 4px 0 var(--shade); overflow: hidden; }
.ssn-hero::after { content: ''; position: absolute; inset: 0; pointer-events: none; opacity: .55;
  background-image: radial-gradient(circle at 12% 20%, var(--surface) 0 2px, transparent 3px), radial-gradient(circle at 78% 18%, var(--surface) 0 2px, transparent 3px),
  radial-gradient(circle at 92% 70%, #fff 0 3px, transparent 4px), radial-gradient(circle at 40% 85%, #fff 0 2px, transparent 3px); animation: ssnTw 2.4s steps(2) infinite; }
@keyframes ssnTw { 50% { opacity: .2; } }
.ssn-hero-ic { flex: none; width: 76px; height: 76px; display: grid; place-items: center; border: var(--line) solid var(--edge); border-radius: 50%; background: var(--surface); box-shadow: inset 0 -5px 0 var(--al), 0 3px 0 var(--shade); }
.ssn-hero-ic img { animation: ssnBob 1.6s steps(4) infinite; }
@keyframes ssnBob { 50% { transform: translateY(-5px); } }
.ssn-hero-txt { position: relative; z-index: 1; min-width: 0; flex: 1; }
.ssn-hero-txt small { display: inline-block; font-size: 13px; font-weight: 700; background: var(--ink); color: #fff; padding: 1px 8px; border-radius: 99px; }
.ssn-hero-txt h3 { font-size: 26px; margin: 3px 0 1px; color: var(--ink); text-shadow: 0 2px 0 rgba(255,255,255,.7); }
.ssn-hero-txt p { margin: 0 0 6px; font-size: 15px; color: var(--ink-l); }
.ssn-hero-row { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.ssn-howbtn { display: inline-flex; align-items: center; gap: 3px; font-size: 14px; font-weight: 700; background: var(--ink); color: #fff; border: 2px solid var(--edge); border-radius: 99px; padding: 1px 9px 1px 5px; }
.ssn-clock { display: inline-flex; align-items: center; gap: 4px; font-size: 14px; font-weight: 700; background: var(--surface); border: 2px solid var(--edge); border-radius: 99px; padding: 1px 9px 1px 4px; }

/* estado (fijo arriba al scrollear) */
.ssn-status { position: sticky; top: 0; z-index: 5; display: flex; align-items: center; gap: 10px; padding: 10px 12px; margin: 0 -2px;
  background: var(--surface); border: var(--line) solid var(--edge); border-radius: 14px; box-shadow: 0 4px 0 var(--shade), 0 8px 14px rgba(8, 6, 5,.12); }
.ssn-lvl { flex: none; width: 58px; height: 58px; display: grid; place-items: center; align-content: center; border: var(--line) solid var(--edge); border-radius: 14px;
  background: linear-gradient(var(--a), var(--ad)); color: #fff; text-shadow: 0 2px 0 rgba(8, 6, 5,.4); box-shadow: inset 0 -4px 0 rgba(8, 6, 5,.18); line-height: .9; }
.ssn-lvl small { font-size: 12px; } .ssn-lvl b { font-size: 28px; }
.ssn-st-mid { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.ssn-st-mid .row { justify-content: space-between; font-size: 15px; }
.ssn-st-mid .row b { white-space: nowrap; display: inline-flex; align-items: center; gap: 3px; }
.ssn-bar { height: 18px; border: 2px solid var(--edge); border-radius: 9px; background: var(--surface-2); overflow: hidden; position: relative; }
.ssn-bar i { display: block; height: 100%; background: repeating-linear-gradient(90deg, var(--a) 0 6px, var(--ad) 6px 8px); transition: width .4s steps(8); }
.ssn-bar i::after { content: ''; display: block; height: 4px; margin: 2px 3px 0; background: rgba(38, 33, 29, .45); border-radius: 2px; }
.ssn-hint { font-size: 14px; color: var(--ink-l); }
.ssn-deco { opacity: .4; }
.ssn-row.left .ssn-deco { transform: rotate(-12deg); } .ssn-row.right .ssn-deco { transform: rotate(10deg); }
.ssn-link { background: none; border: 0; padding: 0; font-size: 13px; color: color-mix(in srgb, var(--a) 65%, #fff); text-decoration: underline; font-weight: 700; }
.ssn-status .btn { flex: none; min-height: 52px; padding: 6px 12px; font-size: 16px; flex-direction: column; gap: 0; line-height: 1; }
.ssn-status .btn small { font-size: 12px; }

/* fin de temporada */
.ssn-end { border: var(--line) solid var(--edge); border-radius: 14px; background: linear-gradient(var(--gold-l), var(--surface)); box-shadow: 0 4px 0 var(--shade); padding: 12px; text-align: center; }
.ssn-end h4 { margin: 4px 0; font-size: 20px; }
.ssn-parts { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; margin: 8px 0; }
.ssn-part { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px 2px 4px; border: 2px solid var(--edge); border-radius: 99px; background: var(--surface); font-size: 14px; font-weight: 700; }

/* camino */
.ssn-track { position: relative; display: flex; flex-direction: column; padding: 6px 0; }
.ssn-row { display: grid; grid-template-columns: 1fr 56px 1fr; align-items: center; min-height: 96px; position: relative; }
.ssn-rail { position: absolute; left: 50%; top: 0; bottom: 0; width: 12px; transform: translateX(-50%); background: var(--rule); border-left: 3px solid var(--edge); border-right: 3px solid var(--edge); }
.ssn-rail i { position: absolute; left: 0; right: 0; top: 0; background: repeating-linear-gradient(180deg, var(--a) 0 8px, var(--ad) 8px 11px); }
.ssn-row:first-child .ssn-rail { top: 50%; }
.ssn-node { grid-column: 2; justify-self: center; position: relative; z-index: 2; width: 46px; height: 46px; display: grid; place-items: center; border: var(--line) solid var(--edge); border-radius: 50%;
  background: var(--surface); font-size: 20px; font-weight: 700; color: var(--ink-l); box-shadow: 0 3px 0 var(--shade); }
.ssn-row.reached .ssn-node { background: linear-gradient(var(--a), var(--ad)); color: #fff; text-shadow: 0 2px 0 rgba(8, 6, 5,.4); }
.ssn-row.special .ssn-node { width: 54px; height: 54px; background: linear-gradient(var(--gold), var(--gold-d)); color: var(--ink-dark); text-shadow: 0 1px 0 var(--surface); }
.ssn-row.next .ssn-node { animation: ssnRing 1.2s steps(2) infinite; }
@keyframes ssnRing { 50% { box-shadow: 0 3px 0 var(--shade), 0 0 0 6px color-mix(in srgb, var(--a) 45%, transparent); } }
.ssn-node .ssn-ok { position: absolute; right: -8px; bottom: -6px; }
.ssn-card { grid-row: 1; position: relative; z-index: 1; display: flex; align-items: center; gap: 8px; padding: 8px 10px; margin: 6px 0; min-height: 76px; text-align: left;
  background: var(--surface); border: var(--line) solid var(--edge); border-radius: 12px; box-shadow: 0 3px 0 var(--shade); }
.ssn-row.left .ssn-card { grid-column: 1; margin-right: 6px; }
.ssn-row.right .ssn-card { grid-column: 3; margin-left: 6px; }
.ssn-side { grid-row: 1; font-size: 14px; color: var(--ink-ll); font-weight: 700; display: flex; flex-direction: column; gap: 0; line-height: 1.05; }
.ssn-row.left .ssn-side { grid-column: 3; padding-left: 12px; text-align: left; align-items: flex-start; }
.ssn-row.right .ssn-side { grid-column: 1; padding-right: 12px; text-align: right; align-items: flex-end; }
.ssn-card-ic { flex: none; display: grid; place-items: center; width: 46px; height: 46px; position: relative; }
.ssn-card-txt { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 3px; }
.ssn-card-txt b { font-size: 15px; line-height: 1.05; overflow-wrap: anywhere; }
.ssn-card-txt small { display: flex; align-items: center; gap: 3px; font-size: 12px; color: var(--ink-l); line-height: 1.05; }
.ssn-card .btn.small { min-height: 30px; padding: 2px 10px; font-size: 14px; align-self: flex-start; }
.ssn-row.locked .ssn-card { background: var(--surface-2); }
.ssn-row.locked .ssn-card-ic img, .ssn-row.next .ssn-card-ic img { filter: saturate(.55) brightness(1.04); }
.ssn-lock { position: absolute; right: -4px; bottom: -4px; }
.ssn-row.claimed .ssn-card { background: var(--surface); }
.ssn-row.claimed .ssn-card-ic img:first-child { opacity: .55; }
.ssn-row.claimable .ssn-card { background: linear-gradient(var(--surface-2), var(--surface)); animation: ssnGlow 1.1s steps(2) infinite; }
@keyframes ssnGlow { 50% { box-shadow: 0 3px 0 var(--shade), 0 0 0 4px rgba(255,209,102,.8); } }
.ssn-row.special .ssn-card { border-color: var(--edge); background: linear-gradient(160deg, var(--gold-l), var(--surface) 60%); min-height: 96px; }
.ssn-row.special .ssn-card::before { content: '¡ESPECIAL!'; position: absolute; top: -11px; left: 10px; background: var(--gold); border: 2px solid var(--edge); border-radius: 6px; padding: 0 6px; font-size: 12px; font-weight: 700; }
.ssn-row.special.claimable .ssn-card { background: linear-gradient(160deg, #4f4622, var(--surface) 70%); }
.ssn-mini { display: flex; flex-wrap: wrap; gap: 3px; }
.ssn-mini .ssn-part { font-size: 12px; padding: 0 6px 0 2px; border-width: 2px; }
.ssn-pop { animation: ssnPop .5s cubic-bezier(.3,1.8,.6,1); }
@keyframes ssnPop { 0% { transform: scale(1); } 30% { transform: scale(1.12) rotate(-2deg); } 100% { transform: none; } }

/* extra post-30 */
.ssn-bonus { display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: var(--surface); border: var(--line) solid var(--edge); border-radius: 14px; box-shadow: 0 4px 0 var(--shade); }
.ssn-bonus .col { flex: 1; gap: 4px; min-width: 0; }

/* cómo ganar */
.ssn-how { background: var(--surface); border: var(--line) solid var(--edge); border-radius: 14px; box-shadow: 0 4px 0 var(--shade); padding: 10px 12px; }
.ssn-how h4 { margin: 0 0 6px; font-size: 19px; display: flex; align-items: center; gap: 6px; }
.ssn-how ul { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: 1fr; gap: 4px; }
@media (min-width: 640px) { .ssn-how ul { grid-template-columns: 1fr 1fr; column-gap: 12px; } }
.ssn-how li { display: flex; align-items: center; gap: 8px; font-size: 15px; padding: 3px 0; border-bottom: 2px dashed var(--rule); }
.ssn-how li span { flex: 1; line-height: 1.1; }
.ssn-how li b { flex: none; white-space: nowrap; background: var(--al); border: 2px solid var(--edge); border-radius: 99px; padding: 0 7px; font-size: 13px; }
.ssn-how p { font-size: 14px; color: var(--ink-l); margin: 8px 0 0; }

/* bienvenida */
.modal.ssn-welcome { width: min(420px, 100%); }
.ssn-wb { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 8px; }
.ssn-wb-stage { position: relative; width: 100%; height: 150px; display: grid; place-items: center; border: var(--line) solid var(--edge); border-radius: 14px; overflow: hidden;
  background: radial-gradient(circle, var(--surface) 0 22%, transparent 23%), linear-gradient(var(--s1), var(--s2)); }
.ssn-rays { position: absolute; inset: -60%; background: repeating-conic-gradient(rgba(38, 33, 29, .55) 0 12deg, transparent 12deg 30deg); animation: ssnSpin 9s linear infinite; }
@keyframes ssnSpin { to { transform: rotate(360deg); } }
.ssn-wb-stage img { position: relative; animation: ssnBob 1.4s steps(4) infinite; filter: drop-shadow(0 5px 0 rgba(8, 6, 5,.25)); }
.ssn-wb-hearts { position: absolute; inset: 0; pointer-events: none; }
.ssn-wb-hearts img { position: absolute; animation: ssnHeart 2.6s ease-in infinite; opacity: 0; }
@keyframes ssnHeart { 0% { transform: translateY(20px) scale(.6); opacity: 0; } 20% { opacity: 1; } 100% { transform: translateY(-110px) scale(1.1); opacity: 0; } }
.ssn-wb p { margin: 0; font-size: 17px; line-height: 1.25; }
.ssn-wb .ssn-away { font-size: 14px; color: var(--ink-l); }
.ssn-wb-items { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }
.ssn-wb-item { display: flex; flex-direction: column; align-items: center; gap: 2px; min-width: 84px; padding: 8px 10px; background: var(--surface); border: var(--line) solid var(--edge); border-radius: 12px; box-shadow: 0 3px 0 var(--shade); font-size: 17px; font-weight: 700; }
.ssn-wb-item small { font-size: 12px; color: var(--ink-l); font-weight: 400; }

/* eventos */
.modal.ssn-events { width: min(520px, 100%); }
.ssn-ev { position: relative; border: var(--line) solid var(--edge); border-radius: 14px; background: var(--surface); box-shadow: 0 4px 0 var(--shade); overflow: hidden; }
.ssn-ev-head { display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: linear-gradient(var(--ec), var(--ecd)); border-bottom: var(--line) solid var(--edge); }
.ssn-ev-head .ssn-ev-ic { flex: none; width: 56px; height: 56px; display: grid; place-items: center; background: var(--surface); border: var(--line) solid var(--edge); border-radius: 12px; box-shadow: 0 3px 0 var(--shade); }
.ssn-ev-head h3 { font-size: 21px; color: var(--ink); text-shadow: 0 2px 0 rgba(255,255,255,.6); }
.ssn-ev-head .col { gap: 4px; flex: 1; min-width: 0; align-items: flex-start; }
.ssn-ev-body { padding: 10px 12px 12px; display: flex; flex-direction: column; gap: 8px; }
.ssn-ev-body p { margin: 0; font-size: 16px; }
.ssn-race { display: flex; flex-direction: column; gap: 6px; }
.ssn-race-bar { position: relative; height: 20px; margin: 6px 4px 2px; border: 2px solid var(--edge); border-radius: 10px; background: var(--surface-2); }
.ssn-race-bar > i { display: block; height: 100%; border-radius: 7px; background: repeating-linear-gradient(90deg, var(--gold) 0 6px, var(--gold-d) 6px 8px); }
.ssn-race-mk { position: absolute; top: 50%; transform: translate(-50%, -50%); }
.ssn-race-tiers { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
.ssn-race-tier { position: relative; display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 6px 4px; border: 2px solid var(--edge); border-radius: 10px; background: var(--surface); text-align: center; font-size: 13px; }
.ssn-race-tier b { font-size: 15px; display: inline-flex; align-items: center; gap: 2px; }
.ssn-race-tier.done { background: var(--mint-l); }
.ssn-race-tier.done::after { content: ''; position: absolute; inset: 0; }
.ssn-rw { display: flex; flex-wrap: wrap; justify-content: center; gap: 2px 8px; }
.ssn-rw-i { display: inline-flex; align-items: center; gap: 2px; font-size: 15px; }
.ssn-race-tier .ssn-part { font-size: 11px; padding: 0 5px 0 2px; }
.ssn-soon h4 { margin: 4px 0 6px; font-size: 18px; }
.ssn-soon-row { display: flex; align-items: center; gap: 8px; padding: 6px 10px; background: var(--surface); border: 2px solid var(--edge); border-radius: 10px; margin-bottom: 6px; font-size: 15px; }
.ssn-soon-row > span:not(.chip) { flex: 1; line-height: 1.1; }
.ssn-soon-row small { color: var(--ink-l); }
.ssn-empty { text-align: center; padding: 14px; border: var(--line) dashed var(--ink-ll); border-radius: 14px; background: var(--surface); }
.ssn-note { font-size: 13px; color: var(--ink-l); text-align: center; margin: 2px 0 0; }
`;
