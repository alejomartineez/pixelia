// UI del Álbum de figuritas: portada con progreso, grilla de sets, páginas de 9 casilleros con animación de "pegar",
// repetidas (→ brillitos / intercambio) y tienda de brillitos con apertura de sobres.
// openAlbum(ctx, {tab:'album'|'dupes'|'shop', set}) · playPackOpening(ctx, stickers, {pack, title}) · closeAlbum()
import { h, esc, modal, toast, confirm, rewardModal, floatText, progressHtml } from '../core/ui.js';
import { icon } from '../core/icons.js';
import { audio } from '../core/audio.js';
import { bus } from '../core/bus.js';
import { fmtNum } from '../core/economy.js';
import * as A from './album.js';
import { renderStickerCard, renderPack, burstAt, ensureArtCss } from './album-art.js';
import { chestIcon } from '../season/season-ui-common.js';

const CHEST_NAMES = { madera: 'Cofre de Madera', plata: 'Cofre de Plata', oro: 'Cofre de Oro', real: 'Cofre Real' };

const CSS = `
.modal.alb { position: relative; width: min(1060px, 100%); height: min(800px, 100%); }
.modal-back:has(.modal.alb) { padding: calc(var(--safe-t) + 8px) calc(var(--safe-r) + 8px) calc(var(--safe-b) + 8px) calc(var(--safe-l) + 8px); }
.modal.alb .modal-head { background: linear-gradient(#c79bff, #9a63e6); padding: 10px 10px 9px 14px; }
.modal.alb .modal-head h2 { font-size: 22px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.modal.alb .modal-body { padding: 0; display: flex; flex-direction: column; flex: 1 1 auto; min-height: 0; overflow: hidden;
  background-color: #fffaf3; background-image: linear-gradient(rgba(181,140,255,.13) 2px, transparent 2px); background-size: 100% 28px; }
.alb-bri { display: inline-flex; align-items: center; gap: 4px; padding: 2px 10px 2px 5px; background: #fff; color: var(--ink); border: var(--line) solid var(--ink); border-radius: 99px;
  box-shadow: 0 3px 0 var(--ink); font-size: 18px; text-shadow: none; flex: none; }
.alb-bri b { min-width: 22px; text-align: right; }
.alb-bar { flex: none; display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; padding: 10px 12px 12px; background: var(--panel-2); border-bottom: 3px solid var(--ink); }
.alb-bar .tab { position: relative; justify-content: center; font-size: 16px; min-height: 42px; padding: 6px 4px; }
.alb-bar .tab.active { background: var(--lilac); }
.alb-bar .tab .badge { top: -10px; right: -6px; }
.alb-pane { flex: 1 1 auto; min-height: 0; overflow-y: auto; -webkit-overflow-scrolling: touch; touch-action: pan-y; overscroll-behavior: contain; padding: 14px 14px 22px; }
.alb-in { animation: albIn .25s cubic-bezier(.3,1.4,.6,1) both; }
@keyframes albIn { from { opacity: 0; transform: translateY(8px); } }
.alb-h { display: flex; align-items: center; gap: 6px; font-size: 18px; margin: 4px 0 10px; }
.alb-hint { display: flex; align-items: center; justify-content: center; gap: 6px; text-align: center; font-size: 14px; color: var(--ink-l); margin: 12px 0 0; }

/* ---------- Portada ---------- */
.alb-home { display: flex; flex-direction: column; gap: 14px; }
.alb-cover { position: relative; padding: 14px 14px 14px 30px; color: #fff; border: 3px solid var(--ink); border-radius: 8px 16px 16px 8px;
  background: linear-gradient(135deg, #ffa8d2, #ff7eb6 55%, #f0679f); box-shadow: inset 0 -6px 0 rgba(224,82,143,.7), 0 4px 0 var(--ink); overflow: hidden; }
.alb-cover::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 16px; background: #c94a82; border-right: 3px solid var(--ink);
  background-image: repeating-linear-gradient(transparent 0 8px, rgba(255,255,255,.75) 8px 12px); background-size: 4px 100%; background-repeat: no-repeat; background-position: center; }
.alb-cover::after { content: ''; position: absolute; right: -2px; top: -2px; width: 26px; height: 26px; background: var(--gold); border-left: 3px solid var(--ink); border-bottom: 3px solid var(--ink);
  border-radius: 0 0 0 10px; box-shadow: inset 3px -3px 0 #fff3c4; }
.alb-cover-top { display: flex; align-items: center; gap: 10px; }
.alb-cover-top small { display: block; font-size: 13px; letter-spacing: .12em; opacity: .95; text-shadow: 0 2px 0 rgba(59,35,64,.35); }
.alb-cover-top h3 { font-size: 34px; letter-spacing: .03em;
  text-shadow: 3px 0 var(--ink), -3px 0 var(--ink), 0 3px var(--ink), 0 -3px var(--ink), 3px 3px var(--ink), -3px 3px var(--ink), 3px -3px var(--ink), -3px -3px var(--ink), 0 6px 0 var(--pink-d); }
.alb-cover-num { display: flex; align-items: baseline; gap: 6px; margin: 10px 0 6px; text-shadow: 0 2px 0 rgba(59,35,64,.4); }
.alb-cover-num b { font-size: 40px; line-height: .9; }
.alb-cover-num span { font-size: 20px; }
.alb-cover-num em { margin-left: auto; font-style: normal; font-size: 15px; }
.alb-cover .progress { height: 16px; background: rgba(255,255,255,.6); }
.alb-final { margin-top: 12px; padding: 8px 10px; background: rgba(255,255,255,.92); color: var(--ink); border: 2px solid var(--ink); border-radius: 10px; display: flex; flex-direction: column; gap: 4px; }
.alb-final small { font-size: 12px; letter-spacing: .1em; color: var(--ink-l); }
.alb-final span { display: flex; align-items: center; gap: 5px; flex-wrap: wrap; font-size: 15px; }
.alb-final.done { background: var(--gold-l); }
.alb-sets { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.alb-tile { --c: #ff7eb6; --cd: #e0528f; --cl: #ffd6e8; position: relative; display: flex; flex-direction: column; align-items: center; gap: 5px; padding: 9px 5px 8px;
  background: var(--cl); border: 3px solid var(--ink); border-radius: 12px; box-shadow: inset 0 -5px 0 rgba(59,35,64,.1), 0 3px 0 var(--ink); text-align: center; }
.alb-tile:active { transform: translateY(2px); box-shadow: inset 0 -3px 0 rgba(59,35,64,.1), 0 1px 0 var(--ink); }
.alb-tile-em { width: 50px; height: 50px; display: grid; place-items: center; background: var(--c); border: 3px solid var(--ink); border-radius: 50%; box-shadow: inset 0 -5px 0 var(--cd), inset 0 4px 0 rgba(255,255,255,.4); }
.alb-tile-name { min-height: 30px; display: grid; place-items: center; font-size: 15px; font-weight: 700; line-height: .95; }
.alb-tile-prog { display: flex; align-items: center; gap: 6px; font-size: 15px; font-weight: 700; }
.alb-mini { display: grid; grid-template-columns: repeat(3, 8px); gap: 2px; padding: 2px; background: #fff; border: 2px solid var(--ink); border-radius: 4px; }
.alb-mini i { width: 8px; height: 8px; background: #eadcf0; }
.alb-mini i.on { background: var(--c); box-shadow: inset 0 -2px 0 var(--cd); }
.alb-mini i.gold { background: var(--gold); box-shadow: inset 0 -2px 0 var(--gold-d); }
.alb-tile .btn.small { min-height: 30px; padding: 2px 10px; font-size: 14px; width: 100%; }
.alb-tile.claimable { background: linear-gradient(var(--gold-l), #fff); animation: albGlow 1.1s steps(2) infinite; }
@keyframes albGlow { 50% { box-shadow: inset 0 -5px 0 rgba(59,35,64,.1), 0 3px 0 var(--ink), 0 0 0 4px rgba(255,209,102,.8); } }
.alb-done-chip { display: inline-flex; align-items: center; gap: 3px; padding: 1px 8px; background: var(--mint); border: 2px solid var(--ink); border-radius: 99px; font-size: 13px; font-weight: 700; }
.alb-tile .badge { top: -9px; right: -7px; animation: none; background: var(--pink); }
@media (min-width: 560px) { .alb-sets { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
@media (min-width: 860px) {
  .alb-home { display: grid; grid-template-columns: 300px minmax(0, 1fr); align-items: start; gap: 18px; }
  .alb-cover { position: sticky; top: 0; padding: 20px 18px 18px 34px; }
  .alb-cover-top h3 { font-size: 42px; }
  .alb-tile-em { width: 58px; height: 58px; }
}

/* ---------- Página de set ---------- */
.alb-page { --c: #ff7eb6; --cd: #e0528f; --cl: #ffd6e8; display: flex; flex-direction: column; gap: 12px; }
.alb-page-head { display: flex; align-items: center; gap: 8px; }
.alb-page-head .icon-btn { flex: none; }
.alb-page-title { flex: 1; min-width: 0; display: flex; align-items: center; gap: 8px; }
.alb-page-title .alb-tile-em { width: 46px; height: 46px; flex: none; }
.alb-page-title div { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.alb-page-title b { font-size: 22px; line-height: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.alb-page-title small { font-size: 13px; color: var(--ink-l); font-weight: 700; }
.alb-sheet { position: relative; padding: 12px; background-color: #fff; border: 3px solid var(--ink); border-radius: 14px;
  box-shadow: inset 0 0 0 5px var(--cl), 0 4px 0 var(--ink); background-image: radial-gradient(var(--cl) 1.6px, transparent 2px); background-size: 16px 16px; }
.alb-slots { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.alb-slot { position: relative; }
.alb-side { display: flex; flex-direction: column; gap: 10px; }
.alb-rew { display: flex; flex-direction: column; gap: 8px; padding: 12px; }
.alb-rew.claimable { background: linear-gradient(var(--gold-l), #fff); }
.alb-rew.claimed { background: var(--mint-l); }
.alb-rew-lbl { font-size: 13px; letter-spacing: .08em; color: var(--ink-l); font-weight: 700; }
.alb-rew-items { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 14px; font-size: 18px; }
.alb-rew-items .cost { gap: 4px; }
.alb-legend { display: flex; flex-wrap: wrap; gap: 6px; }
.alb-miss { display: flex; flex-direction: column; gap: 6px; }
.alb-miss-row { display: flex; align-items: center; gap: 8px; font-size: 15px; padding: 3px 0; border-bottom: 2px dotted #eadcf0; }
.alb-miss-row:last-child { border-bottom: 0; }
.alb-miss-row b { min-width: 34px; color: var(--ink-l); }
.alb-miss-name { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.alb-miss-st { color: var(--gold-d); font-size: 13px; letter-spacing: -1px; }
.alb-miss-row .btn.small { min-height: 28px; padding: 1px 10px; font-size: 14px; }
.alb-legend .chip { font-size: 12px; }
@media (min-width: 860px) {
  .alb-page { display: grid; grid-template-columns: minmax(0, 430px) minmax(0, 1fr); gap: 14px 22px; align-items: start; }
  .alb-page-head { grid-column: 1 / -1; }
  .alb-page-title b { font-size: 28px; }
}
@media (min-width: 860px) and (max-height: 720px) { .alb-page { grid-template-columns: minmax(0, 360px) minmax(0, 1fr); } }

/* ---------- Detalle ---------- */
.alb-pop { position: absolute; inset: 0; z-index: 20; display: grid; place-items: center; padding: 16px; background: rgba(59,35,64,.55); animation: albFade .15s both; }
.alb-pop-box { width: min(330px, 100%); max-height: 100%; overflow-y: auto; display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 18px 16px 16px; text-align: center;
  background: var(--panel); border: 3px solid var(--ink); border-radius: 16px; box-shadow: 0 6px 0 var(--ink); animation: albPop .35s cubic-bezier(.3,1.6,.6,1) both; }
.alb-pop-card { width: 168px; }
.alb-pop-box h3 { font-size: 24px; }
.alb-pop-meta { font-size: 14px; color: var(--ink-l); font-weight: 700; }
.alb-pop-status { font-size: 16px; }
.alb-pop-btns { display: flex; flex-direction: column; gap: 8px; width: 100%; margin-top: 4px; }
@keyframes albFade { from { opacity: 0; } }
@keyframes albPop { from { transform: scale(.6); opacity: 0; } }

/* ---------- Repetidas ---------- */
.alb-dhead { display: flex; flex-direction: column; gap: 10px; padding: 14px; background: linear-gradient(135deg, #fff, var(--lilac-l)); }
.alb-dhead-top { display: flex; align-items: center; gap: 12px; }
.alb-dhead-ic { flex: none; width: 60px; height: 60px; display: grid; place-items: center; background: var(--gold-l); border: 3px solid var(--ink); border-radius: 14px; box-shadow: inset 0 -4px 0 var(--gold); }
.alb-dhead-txt { display: flex; flex-direction: column; gap: 3px; font-size: 18px; }
.alb-dhead-txt span { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
.alb-toggle { align-self: flex-start; cursor: pointer; }
.alb-toggle.on { background: var(--mint-l); }
.alb-dgrid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px 10px; margin-top: 14px; }
.alb-dupe { display: flex; flex-direction: column; gap: 6px; align-items: stretch; }
.alb-dupe-foot { display: flex; align-items: center; justify-content: space-between; gap: 4px; font-size: 14px; font-weight: 700; }
.alb-dupe .btn.small { min-height: 30px; padding: 2px 8px; font-size: 14px; }
.alb-melt { animation: albMelt .5s ease-in both; }
@keyframes albMelt { to { transform: translateY(-40px) scale(.4) rotate(12deg); opacity: 0; } }
.alb-empty { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 26px 10px; text-align: center; font-size: 17px; }
@media (min-width: 560px) { .alb-dgrid { grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); } }
@media (min-width: 860px) { .alb-dhead { flex-direction: row; align-items: center; justify-content: space-between; flex-wrap: wrap; } .alb-dhead .btn.block { width: auto; } }

/* ---------- Tienda ---------- */
.alb-shead { display: flex; align-items: center; gap: 12px; padding: 12px 14px; background: linear-gradient(135deg, var(--gold-l), #fff); }
.alb-shead b { font-size: 30px; }
.alb-sgrid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-top: 14px; }
.alb-sitem { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 12px 10px; text-align: center; }
.alb-sitem .pk { width: min(118px, 80%); }
.alb-sitem b { font-size: 18px; }
.alb-sitem small { font-size: 13px; color: var(--ink-l); min-height: 30px; line-height: 1.1; }
.alb-sitem .btn { width: 100%; }
.alb-chestart { width: min(118px, 80%); aspect-ratio: 3 / 4.1; display: grid; place-items: center; background: linear-gradient(#e7eef9, #c9d6ea); border: 3px solid var(--ink); border-radius: 12px; box-shadow: 0 4px 0 var(--ink); }
.alb-values { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; margin-top: 14px; }
@media (min-width: 700px) { .alb-sgrid { grid-template-columns: repeat(4, minmax(0, 1fr)); } }

/* ---------- Apertura de sobre ---------- */
.alb-open { position: absolute; inset: 0; z-index: 5; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; overflow: hidden;
  padding: calc(var(--safe-t) + 16px) 12px calc(var(--safe-b) + 16px); background: radial-gradient(circle at 50% 45%, #7a5585, #3b2340 72%); animation: albFade .2s both; touch-action: none; }
.alb-open.out { animation: albFadeOut .25s both; }
@keyframes albFadeOut { to { opacity: 0; } }
.alb-open-rays { position: absolute; left: 50%; top: 46%; width: 1600px; height: 1600px; margin: -800px 0 0 -800px; pointer-events: none;
  background: repeating-conic-gradient(rgba(255,255,255,.07) 0 9deg, transparent 9deg 18deg); animation: albSpin 30s linear infinite; }
@keyframes albSpin { to { transform: rotate(360deg); } }
.alb-open-title { position: relative; color: #fff; font-size: 30px; text-align: center;
  text-shadow: 3px 0 var(--ink), -3px 0 var(--ink), 0 3px var(--ink), 0 -3px var(--ink), 0 6px 0 var(--lilac-d); }
.alb-open-stage { position: relative; display: grid; place-items: center; width: 100%; min-height: 320px; }
.alb-open-stage > * { grid-area: 1 / 1; }
.alb-open-pack { width: 190px; cursor: pointer; animation: albPackIn .55s cubic-bezier(.3,1.6,.6,1) both; }
.alb-open-pack .pk { animation: albWobble 1.5s ease-in-out .6s infinite; }
.alb-open-pack.shake .pk { animation: albShake .5s steps(8); }
.alb-open-pack.torn .pk-top { animation: albTear .6s cubic-bezier(.3,.6,.5,1) forwards; }
.alb-open-pack.gone { animation: albPackOut .45s ease-in forwards; }
@keyframes albPackIn { from { transform: translateY(-60vh) rotate(-20deg); } }
@keyframes albWobble { 0%, 100% { transform: rotate(-3deg); } 50% { transform: rotate(3deg) translateY(-6px); } }
@keyframes albShake { 0% { transform: none; } 25% { transform: rotate(-7deg) scale(1.04); } 50% { transform: rotate(7deg) scale(1.08); } 75% { transform: rotate(-5deg) scale(1.1); } 100% { transform: scale(1.12); } }
@keyframes albTear { to { transform: translate(90px, -120px) rotate(40deg); opacity: 0; } }
@keyframes albPackOut { to { transform: translateY(45vh) scale(.8); opacity: 0; } }
.alb-open-cards.few .alb-open-card { width: clamp(100px, 29vw, 190px); }
.alb-open-cards { display: flex; flex-wrap: wrap; justify-content: center; align-content: center; gap: 14px 12px; width: min(100%, 800px); perspective: 900px; }
.alb-open-card { position: relative; z-index: 0; width: clamp(96px, 27vw, 168px); animation: albCardOut .65s cubic-bezier(.3,1.4,.6,1) both; }
.alb-open-card.rare::before { content: ''; position: absolute; z-index: -1; left: 50%; top: 50%; width: 220%; aspect-ratio: 1; transform: translate(-50%, -50%);
  background: repeating-conic-gradient(rgba(255,209,102,.5) 0 12deg, transparent 12deg 24deg); border-radius: 50%; animation: albSpinC 7s linear infinite;
  -webkit-mask: radial-gradient(closest-side, #000 30%, transparent); mask: radial-gradient(closest-side, #000 30%, transparent); }
.alb-open-card.r5::before { background: repeating-conic-gradient(rgba(255,158,207,.55) 0 8deg, rgba(143,211,255,.5) 8deg 16deg, transparent 16deg 24deg); }
@keyframes albSpinC { to { transform: translate(-50%, -50%) rotate(360deg); } }
@keyframes albCardOut { 0% { transform: translateY(170px) scale(.25) rotateY(100deg); opacity: 0; } 60% { transform: translateY(-16px) scale(1.08) rotateY(0); opacity: 1; } 100% { transform: none; } }
.alb-open-hint { position: relative; color: #fff; font-size: 19px; text-align: center; animation: albBlink 1.1s steps(2) infinite; }
@keyframes albBlink { 50% { opacity: .35; } }
.alb-open-sum { position: relative; display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; min-height: 26px; }
.alb-open-foot { position: relative; min-height: 50px; }
.alb-open-foot .btn { min-width: 220px; animation: albPop .35s cubic-bezier(.3,1.6,.6,1) both; }
@media (max-height: 700px) { .alb-open-card { width: clamp(84px, 22vw, 112px); } .alb-open-stage { min-height: 260px; } }
@media (prefers-reduced-motion: reduce) { .alb-open-rays, .alb-open-card.rare::before, .alb-tile.claimable { animation: none; } }
`;

let styleEl = null, styleRefs = 0;
function addStyle() {
  ensureArtCss();
  if (styleRefs++ === 0) { styleEl = document.createElement('style'); styleEl.id = 'album-ui-css'; styleEl.textContent = CSS; document.head.append(styleEl); }
}
function releaseStyle() { if (--styleRefs <= 0) { styleRefs = 0; styleEl?.remove(); styleEl = null; } }

const starsTxt = (n) => '★'.repeat(n);
const setVars = (el, set) => { el.style.setProperty('--c', set.color); el.style.setProperty('--cd', set.dark); el.style.setProperty('--cl', set.light); return el; };
const modalRoot = () => document.getElementById('modal-root');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function rewardItemsHtml(rew, size = 22) {
  return `<span class="cost">${icon('gem', size)}${fmtNum(rew.gems)}</span><span class="cost">${icon('coin', size)}${fmtNum(rew.coins)}</span>`
    + `<span class="cost">${icon('🎁', size)}${CHEST_NAMES[rew.chest] || 'Cofre'}</span>`;
}

// ---------------------------------------------------------------------------------------------
let current = null;

/** Cierra el álbum si está abierto. */
export function closeAlbum() { current?.close(); }
/** Navega dentro del álbum abierto: {tab, set} */
export function albumGo(params = {}) { current?.go(params); }

/**
 * Abre el álbum. params: { tab: 'album'|'dupes'|'shop', set: setId }
 * Devuelve una promesa que se resuelve al cerrarlo.
 */
export function openAlbum(ctx, params = {}) {
  A.albumState();
  if (current) { current.go(params); return current.done; }
  addStyle();
  let resolveDone;
  const done = new Promise(r => { resolveDone = r; });
  const cleanups = [];
  const timers = new Set();
  const later = (ms, fn) => { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); return id; };
  let closed = false;
  let view = { tab: params.tab || 'album', set: A.SET_BY_ID[params.set] ? params.set : null };
  let keep45 = false;
  let pop = null;

  const m = modal({
    title: 'Álbum de Figuritas', icon: '📒', className: 'alb',
    onClose: () => {
      closed = true;
      for (const id of timers) clearTimeout(id);
      timers.clear();
      for (const fn of cleanups.splice(0).reverse()) { try { fn(); } catch (e) { console.error('[album] cleanup', e); } }
      current = null;
      audio.sfx('close');
      releaseStyle();
      resolveDone();
    },
  });

  // brillitos en la cabecera
  const bri = h('div.alb-bri', { title: 'Brillitos' });
  const head = m.el.querySelector('.modal-head');
  head.insertBefore(bri, head.querySelector('.modal-x'));

  const tabs = [
    ['album', 'Álbum', '📒'],
    ['dupes', 'Repetidas', '🔁'],
    ['shop', 'Tienda', 'sparkle'],
  ];
  const bar = h('div.alb-bar');
  const tabEls = {};
  for (const [id, label, ic] of tabs) {
    tabEls[id] = h('button.tab', { html: `${icon(ic, 20)}<span>${label}</span>`, onclick: () => { if (view.tab === id && !view.set) return; audio.sfx('select'); go({ tab: id, set: null }); } });
    bar.append(tabEls[id]);
  }
  const pane = h('div.alb-pane');
  m.body.append(bar, pane);

  function go(p = {}) {
    if (p.tab) view.tab = p.tab;
    if ('set' in p) view.set = A.SET_BY_ID[p.set] ? p.set : null;
    closePop();
    render(true);
  }

  // ---------- render ----------
  let rafId = 0;
  function scheduleRender() {
    if (rafId || closed) return;
    rafId = requestAnimationFrame(() => { rafId = 0; if (!closed) render(false); });
  }
  cleanups.push(() => cancelAnimationFrame(rafId));

  function renderTop() {
    bri.innerHTML = `${icon('sparkle', 20)}<b>${fmtNum(A.brillitos())}</b>`;
    for (const [id] of tabs) tabEls[id].classList.toggle('active', view.tab === id);
    const nAlbum = A.claimableSets().length + A.unseenCount();
    tabEls.album.querySelector('.badge')?.remove();
    if (nAlbum) tabEls.album.append(h('i.badge', {}, String(nAlbum)));
  }

  function render(fresh) {
    renderTop();
    const keepScroll = fresh ? 0 : pane.scrollTop;
    pane.innerHTML = '';
    const content = view.tab === 'dupes' ? renderDupes() : view.tab === 'shop' ? renderShop() : view.set ? renderSet(view.set) : renderHome();
    if (fresh) content.classList.add('alb-in');
    pane.append(content);
    pane.scrollTop = keepScroll;
  }

  // ---------- Portada + sets ----------
  function renderHome() {
    const p = A.albumProgress();
    const wrap = h('div.alb-home');
    const cover = h('div.alb-cover');
    cover.append(
      h('div.alb-cover-top', { html: `${icon('crown', 44)}<div><small>MI ÁLBUM DE</small><h3>Pixelia</h3></div>` }),
      h('div.alb-cover-num', { html: `<b>${p.have}</b><span>/ ${p.total}</span><em>${p.setsComplete}/${p.sets} sets</em>` }),
      h('div', { html: progressHtml(p.pct, 'gold') }),
    );
    if (p.albumDone) {
      cover.append(h('div.alb-final.done', { html: `<small>¡ÁLBUM COMPLETO!</small><span>${icon('crown', 20)} Sos <b>${esc(p.title || A.ALBUM_TITLE)}</b></span>` }));
    } else {
      cover.append(h('div.alb-final', {
        html: `<small>PREMIO POR COMPLETARLO</small><span>${icon('🎁', 20)} <b>2 Cofres Reales</b> + ${icon('gem', 18)}${A.ALBUM_REWARD.gems}</span>`
          + `<span>${icon('crown', 18)} Título <b>${A.ALBUM_TITLE}</b></span>`,
      }));
    }
    const grid = h('div.alb-sets');
    for (const set of A.STICKER_SETS) grid.append(renderTile(set));
    const right = h('div', {}, grid, h('p.alb-hint', { html: `${icon('🎁', 18)} Las figuritas salen de cofres, minijuegos y de la Tienda de brillitos` }));
    wrap.append(cover, right);
    return wrap;
  }

  function renderTile(set) {
    const p = A.setProgress(set.id);
    const unseen = A.unseenCount(set.id);
    const tile = setVars(h('button.alb-tile' + (p.claimable ? '.claimable' : '') + (p.claimed ? '.claimed' : ''), {
      'aria-label': `${set.name}: ${p.have} de 9`,
      onclick: (e) => { if (e.target.closest('.btn')) return; audio.sfx('open'); go({ set: set.id }); },
    }), set);
    const mini = h('span.alb-mini');
    for (const s of set.stickers) mini.append(h('i' + (A.hasSticker(s.id) ? (p.claimed ? '.on.gold' : '.on') : '')));
    tile.append(
      h('span.alb-tile-em', { html: icon(set.emoji, 30) }),
      h('span.alb-tile-name', {}, set.name),
      h('span.alb-tile-prog', {}, mini, `${p.have}/9`),
    );
    if (p.claimable) tile.append(h('span.btn.gold.small', { role: 'button', html: `${icon('gift', 16)} ¡Reclamar!`, onclick: (e) => { e.stopPropagation(); doClaim(set.id); } }));
    else if (p.claimed) tile.append(h('span.alb-done-chip', { html: `${icon('check', 14)} Completo` }));
    else tile.append(h('span.alb-rew-items', { style: { fontSize: '13px', gap: '6px', justifyContent: 'center' }, html: `<span class="cost">${icon('gem', 14)}${p.reward.gems}</span><span class="cost">${icon('🎁', 14)}</span>` }));
    if (unseen) tile.append(h('i.badge', { title: 'Figuritas nuevas para pegar' }, String(unseen)));
    return tile;
  }

  // ---------- Página de un set ----------
  function renderSet(setId) {
    const set = A.SET_BY_ID[setId];
    const p = A.setProgress(setId);
    const idx = set.index;
    const page = setVars(h('div.alb-page'), set);
    const nav = (d) => { audio.sfx('swoosh'); go({ set: A.STICKER_SETS[(idx + d + A.STICKER_SETS.length) % A.STICKER_SETS.length].id }); };
    page.append(h('div.alb-page-head', {},
      h('button.icon-btn', { 'aria-label': 'Volver al álbum', html: icon('back', 22), onclick: () => { audio.sfx('close'); go({ set: null }); } }),
      h('div.alb-page-title', { html: `<span class="alb-tile-em">${icon(set.emoji, 28)}</span><div><b>${esc(set.name)}</b><small>Set ${idx + 1} de ${A.STICKER_SETS.length} · ${p.have}/9</small></div>` }),
      h('button.icon-btn', { 'aria-label': 'Set anterior', html: '<b style="font-size:22px">‹</b>', onclick: () => nav(-1) }),
      h('button.icon-btn', { 'aria-label': 'Set siguiente', html: '<b style="font-size:22px">›</b>', onclick: () => nav(1) }),
    ));

    const sheet = h('div.alb-sheet');
    const slots = h('div.alb-slots');
    const fresh = [];
    for (const def of set.stickers) {
      const count = A.stickerCount(def.id);
      const unseen = A.isUnseen(def.id);
      const delay = unseen ? 0.15 + fresh.length * 0.26 : 0;
      const slot = h('div.alb-slot');
      slot.append(renderStickerCard(def, { owned: count > 0, count, isNew: unseen, stick: unseen, flash: unseen, delay, onClick: () => showDetail(def) }));
      slots.append(slot);
      if (unseen) fresh.push({ def, slot, delay });
    }
    sheet.append(slots);
    page.append(sheet);
    // "pegar" las nuevas: sonido + chispas, y quedan como vistas
    if (fresh.length) {
      for (const f of fresh) {
        later(f.delay * 1000 + 330, () => { audio.sfx(f.def.stars >= 4 ? 'star' : 'place'); burstAt(f.slot, { n: f.def.stars >= 4 ? 14 : 9, dist: f.def.stars >= 4 ? 80 : 55 }); });
      }
      A.markSeen(fresh.map(f => f.def.id));
      later(fresh[fresh.length - 1].delay * 1000 + 700, () => renderTop());
    }

    // lateral: premio y rarezas
    const side = h('div.alb-side');
    const rew = h('div.card.alb-rew' + (p.claimable ? '.claimable' : p.claimed ? '.claimed' : ''));
    rew.append(h('div.alb-rew-lbl', {}, p.claimed ? 'PREMIO COBRADO' : 'PREMIO DEL SET'));
    rew.append(h('div.alb-rew-items', { html: rewardItemsHtml(p.reward) }));
    rew.append(h('div', { html: progressHtml(p.have / 9, p.complete ? 'gold' : 'pink') }));
    if (p.claimable) rew.append(h('button.btn.gold.block', { html: `${icon('gift', 20)} ¡Reclamar premio!`, onclick: () => doClaim(setId) }));
    else if (p.claimed) rew.append(h('div.row', { html: `${icon('check', 20)} <b>¡Set completo!</b>` }));
    else rew.append(h('div.muted.small', {}, `Te ${9 - p.have === 1 ? 'falta 1 figurita' : `faltan ${9 - p.have} figuritas`}. Tocá una para pedírsela a tus amigos.`));
    side.append(rew);
    const legend = h('div.alb-legend');
    for (let s = 1; s <= 5; s++) legend.append(h('span.chip' + (s >= 5 ? '.pink' : s >= 3 ? '.gold' : s === 2 ? '.sky' : ''), {}, `${starsTxt(s)} ${A.RARITY_NAMES[s]}`));
    const missing = set.stickers.filter(s => !A.hasSticker(s.id));
    if (missing.length) {
      const list = h('div.alb-miss');
      for (const s of missing) {
        list.append(h('div.alb-miss-row', {},
          h('b', {}, '#' + s.n), h('span.alb-miss-name', {}, s.name), h('span.alb-miss-st', {}, starsTxt(s.stars)),
          h('button.btn.sky.small', { onclick: () => trade(s.id, 'ask') }, 'Pedir'),
        ));
      }
      side.append(h('div.card', {}, h('div.alb-rew-lbl', { style: { marginBottom: '8px' } }, 'TE FALTAN'), list));
    }
    side.append(h('div.card', {}, h('div.alb-rew-lbl', { style: { marginBottom: '6px' } }, 'RAREZAS'), legend));
    page.append(side);
    return page;
  }

  // ---------- Detalle de figurita ----------
  function closePop() { pop?.remove(); pop = null; }
  function showDetail(def) {
    closePop();
    audio.sfx('pop');
    const count = A.stickerCount(def.id);
    const owned = count > 0;
    const box = h('div.alb-pop-box');
    const cardWrap = h('div.alb-pop-card');
    cardWrap.append(renderStickerCard(def, { owned, count, showCount: false }));
    box.append(cardWrap,
      h('h3', {}, owned ? def.name : '¿?'),
      h('div.alb-pop-meta', {}, `${def.setName} · #${def.n} · ${A.RARITY_NAMES[def.stars]} ${starsTxt(def.stars)}`),
      h('div.alb-pop-status', { html: owned ? `Tenés <b>${count}</b>${count > 1 ? ` (${count - 1} repetida${count > 2 ? 's' : ''})` : ''}` : 'Todavía no la tenés' }),
    );
    const btns = h('div.alb-pop-btns');
    if (owned && count > 1) {
      const val = (count - 1) * A.BRILLO_VALUE[def.stars];
      btns.append(h('button.btn.sky', { html: `${icon('people', 20)} Ofrecer a amigos`, onclick: () => trade(def.id, 'offer') }));
      btns.append(h('button.btn.gold', {
        html: `Cambiar por ${icon('sparkle', 18)}${val}`,
        onclick: () => { const r = A.convertDuplicates({ ids: [def.id] }); celebrateBrillitos(r); closePop(); },
      }));
    } else if (!owned) {
      btns.append(h('button.btn.pink', { html: `${icon('people', 20)} Pedir a amigos`, onclick: () => trade(def.id, 'ask') }));
    }
    btns.append(h('button.btn.ghost', { onclick: () => { audio.sfx('close'); closePop(); } }, 'Listo'));
    box.append(btns);
    pop = h('div.alb-pop', { onpointerdown: (e) => { if (e.target === pop) { closePop(); } } }, box);
    m.el.append(pop);
  }

  function trade(id, mode) {
    audio.sfx('tap');
    const payload = { id, mode, handled: false };
    bus.emit('album:trade', payload);
    if (!payload.handled) toast(mode === 'ask' ? 'Pedido anotado: los intercambios con amigos se activan con tu cuenta online' : 'Los intercambios con amigos se activan con tu cuenta online', { icon: 'people' });
    closePop();
  }

  // ---------- Reclamar set ----------
  let claiming = false;
  async function doClaim(setId) {
    if (claiming) return;
    claiming = true;
    try {
      const res = A.claimSet(setId);
      if (!res) return;
      const set = A.SET_BY_ID[setId];
      audio.sfx('win');
      await rewardModal({
        title: '¡Set completo!', subtitle: `${set.name} · 9 de 9`,
        reward: { coins: res.coins, gems: res.gems },
        lines: [`<span style="display:inline-block;padding:6px;background:${set.color};border:3px solid var(--ink);border-radius:50%">${icon(set.emoji, 48)}</span>`, `${icon('🎁', 24)} <b>+1 ${CHEST_NAMES[res.chest]}</b>`],
        buttons: [{ label: '¡Genial!', value: 'ok', cls: 'gold' }],
      });
      if (res.album) {
        audio.sfx('levelup');
        await rewardModal({
          title: '¡Álbum completo!', subtitle: `¡Sos ${res.album.title}!`,
          reward: { gems: res.album.gems },
          lines: [icon('crown', 60), `${icon('🎁', 24)} <b>2 Cofres Reales</b>`, `Nuevo título: <b>${esc(res.album.title)}</b>`],
          buttons: [{ label: '¡Soy una estrella!', value: 'ok', cls: 'gold' }],
        });
      }
    } finally { claiming = false; }
  }

  // ---------- Repetidas ----------
  function renderDupes() {
    const wrap = h('div');
    const dups = A.duplicates();
    const maxStars = keep45 ? 3 : 5;
    const v = A.duplicatesValue({ maxStars });
    const total = A.duplicatesValue();
    const head = h('div.card.alb-dhead');
    head.append(h('div.alb-dhead-top', {},
      h('span.alb-dhead-ic', { html: icon('sparkle', 40) }),
      h('div.alb-dhead-txt', { html: `<span>Tenés <b>${total.count}</b> repetida${total.count === 1 ? '' : 's'}</span><span>Valen <b>${v.brillitos}</b> ${icon('sparkle', 18)} brillitos</span>` }),
    ));
    const tog = h('button.chip.alb-toggle' + (keep45 ? '.on' : ''), {
      html: `${icon(keep45 ? 'check' : 'lock', 14)} Guardar las de 4★ y 5★ para intercambiar`,
      onclick: () => { audio.sfx('select'); keep45 = !keep45; render(false); },
    });
    const convBtn = h('button.btn.gold.block', {
      disabled: !v.count,
      html: `${icon('rotate', 20)} Cambiar repetidas por brillitos`,
      onclick: async () => {
        const ok = await confirm('Cambiar repetidas', `¿Cambiar <b>${v.count}</b> repetida${v.count === 1 ? '' : 's'} por <b>${v.brillitos}</b> brillitos?<br><small>Siempre te quedás con una de cada figurita.</small>`, '¡Dale!', 'Mejor no');
        if (!ok || closed) return;
        const ids = new Set(dups.filter(d => d.stars <= maxStars).map(d => d.id));
        pane.querySelectorAll('.alb-dupe').forEach((el, i) => { if (ids.has(el.dataset.id)) { el.style.animationDelay = (i * 0.04) + 's'; el.classList.add('alb-melt'); } });
        later(450, () => celebrateBrillitos(A.convertDuplicates({ maxStars })));
      },
    });
    head.append(tog, convBtn);
    wrap.append(head);
    if (!dups.length) {
      wrap.append(h('div.alb-empty', { html: `${icon('🔁', 48)}<b>Todavía no tenés repetidas</b><span class="muted">Abrí cofres y sobres: las repetidas se cambian por brillitos o se intercambian con amigos.</span>` }));
    } else {
      const grid = h('div.alb-dgrid');
      for (const d of dups) {
        const def = A.stickerDef(d.id);
        const it = h('div.alb-dupe', { 'data-id': d.id });
        it.append(renderStickerCard(def, { count: d.count, onClick: () => showDetail(def) }));
        it.append(h('div.alb-dupe-foot', {},
          h('span.cost', { html: `+${d.value}${icon('sparkle', 14)}` }),
          h('button.btn.sky.small', { onclick: () => trade(d.id, 'offer') }, 'Ofrecer'),
        ));
        grid.append(it);
      }
      wrap.append(grid);
    }
    const vals = h('div.alb-values');
    for (let s = 1; s <= 5; s++) vals.append(h('span.chip.gold', { html: `${starsTxt(s)} = ${A.BRILLO_VALUE[s]}${icon('sparkle', 12)}` }));
    wrap.append(h('p.alb-hint', {}, 'Cada repetida vale brillitos según sus estrellas:'), vals);
    return wrap;
  }

  function celebrateBrillitos(r) {
    if (!r?.brillitos) return;
    audio.sfx('gem');
    const rc = bri.getBoundingClientRect();
    floatText(rc.left + rc.width / 2, rc.bottom + 16, `+${r.brillitos} ${icon('sparkle', 22)}`);
    bri.classList.remove('bump'); void bri.offsetWidth; bri.classList.add('bump');
    toast(`¡${r.count} repetida${r.count === 1 ? '' : 's'} → ${r.brillitos} brillitos!`, { icon: 'sparkle', type: 'good' });
  }

  // ---------- Tienda ----------
  function renderShop() {
    const wrap = h('div');
    const b = A.brillitos();
    wrap.append(h('div.card.alb-shead', { html: `${icon('sparkle', 44)}<div><b>${fmtNum(b)}</b><div class="muted small">brillitos · conseguilos cambiando repetidas</div></div>` }));
    const grid = h('div.alb-sgrid');
    for (const it of A.SHOP) {
      const card = h('div.card.alb-sitem');
      if (it.kind === 'pack') card.append(renderPack(it, { small: true }));
      else card.append(h('div.alb-chestart', { html: it.chest ? chestIcon(it.chest, 72) : icon('🎁', 72) })); // el mismo cofre que en Cofres
      card.append(h('b', {}, it.name), h('small', {}, it.desc));
      card.append(h('button.btn.gold', {
        disabled: b < it.cost,
        html: `${icon('sparkle', 18)}${it.cost}`,
        onclick: () => buy(it.id),
      }));
      grid.append(card);
    }
    wrap.append(grid);
    if (b < 10) wrap.append(h('p.alb-hint', { html: `${icon('🔁', 18)} Cambiá tus repetidas por brillitos en la pestaña Repetidas` }));
    return wrap;
  }

  let buying = false;
  async function buy(itemId) {
    if (buying) return;
    buying = true;
    try {
      const res = A.buyShopItem(itemId);
      if (!res) { audio.sfx('error'); toast('Te faltan brillitos', { type: 'bad', icon: 'sparkle' }); return; }
      audio.sfx('buy');
      if (res.item.kind === 'chest') { toast(`¡${res.item.name} a tus cofres!`, { icon: '🎁', type: 'good' }); return; }
      await playPackOpening(ctx, res.stickers, { pack: res.item });
    } finally { buying = false; }
  }

  // ---------- teclado ----------
  const isTop = () => modalRoot()?.lastElementChild === m.el.parentElement;
  const onKey = (e) => {
    if (closed || !isTop()) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      if (pop) closePop();
      else if (view.tab === 'album' && view.set) go({ set: null });
      else m.close();
    } else if (!pop && view.tab === 'album' && view.set && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      const i = A.SET_BY_ID[view.set].index + (e.key === 'ArrowLeft' ? -1 : 1);
      audio.sfx('swoosh');
      go({ set: A.STICKER_SETS[(i + A.STICKER_SETS.length) % A.STICKER_SETS.length].id });
    }
  };
  addEventListener('keydown', onKey);
  cleanups.push(() => removeEventListener('keydown', onKey));
  cleanups.push(bus.on('album:changed', scheduleRender));

  current = { close: () => m.close(), go, done };
  render(true);
  return done;
}

// ---------------------------------------------------------------------------------------------
/**
 * Animación de abrir un sobre y mostrar las figuritas que salieron.
 * stickers: [{id, stars, isNew, count}] (lo que devuelve grantStickers). opts: { pack: item de SHOP | id, title }
 * Devuelve una promesa que se resuelve cuando la jugadora la cierra.
 */
export function playPackOpening(ctx, stickers = [], opts = {}) {
  addStyle();
  const pack = typeof opts.pack === 'string' ? A.SHOP_BY_ID[opts.pack] : opts.pack
    || A.PACK_FOR_STARS(Math.max(1, ...stickers.map(s => s.stars)) >= 4 ? 4 : 1);
  return new Promise(resolve => {
    const timers = new Set();
    const later = (ms, fn) => { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); };
    let phase = 'idle', finished = false;
    const root = h('div.alb-open');
    const packWrap = h('div.alb-open-pack', { role: 'button', 'aria-label': 'Abrir sobre' });
    packWrap.append(renderPack(pack));
    const cards = h('div.alb-open-cards' + (stickers.length <= 3 ? '.few' : ''));
    const stage = h('div.alb-open-stage', {}, cards, packWrap);
    const hint = h('div.alb-open-hint', {}, 'Tocá el sobre para abrirlo');
    const sum = h('div.alb-open-sum');
    const foot = h('div.alb-open-foot');
    root.append(h('div.alb-open-rays'), h('div.alb-open-title', {}, opts.title || pack.name), stage, hint, sum, foot);
    modalRoot().append(root);
    audio.sfx('open');

    function open() {
      if (phase !== 'idle') return;
      phase = 'opening';
      hint.style.visibility = 'hidden';
      packWrap.classList.add('shake');
      audio.sfx('swoosh');
      later(450, () => { packWrap.classList.add('torn'); audio.sfx('clear'); burstAt(packWrap, { n: 12, dist: 90 }); });
      later(900, () => { packWrap.classList.add('gone'); reveal(); });
    }
    function reveal() {
      phase = 'reveal';
      const step = stickers.length > 4 ? 0.3 : 0.38;
      stickers.forEach((s, i) => {
        const def = A.stickerDef(s.id);
        if (!def) return;
        const w = h('div.alb-open-card' + (def.stars >= 4 ? '.rare' : '') + (def.stars >= 5 ? '.r5' : ''));
        w.style.animationDelay = (i * step) + 's';
        w.append(renderStickerCard(def, { count: s.count, isNew: s.isNew, showCount: !s.isNew }));
        cards.append(w);
        later(i * step * 1000 + 250, () => {
          audio.sfx(def.stars >= 4 ? 'star' : 'pop');
          if (def.stars >= 4) burstAt(w, { n: 14, dist: 90 });
        });
      });
      later(stickers.length * step * 1000 + 500, () => {
        phase = 'done';
        const nNew = stickers.filter(s => s.isNew).length;
        const nRep = stickers.length - nNew;
        if (nNew) sum.append(h('span.chip.mint', {}, `¡${nNew} nueva${nNew === 1 ? '' : 's'}!`));
        if (nRep) sum.append(h('span.chip', {}, `${nRep} repetida${nRep === 1 ? '' : 's'}`));
        if (nNew) audio.sfx('done');
        foot.append(h('button.btn.pink', { html: `${icon('📒', 20)} ${nNew ? '¡A pegarlas!' : '¡Genial!'}`, onclick: finish }));
      });
    }
    function finish() {
      if (finished) return;
      finished = true;
      audio.sfx('tap');
      for (const id of timers) clearTimeout(id);
      removeEventListener('keydown', onKey);
      root.classList.add('out');
      setTimeout(() => { root.remove(); releaseStyle(); resolve(stickers); }, 240);
    }
    const onKey = (e) => {
      if (modalRoot()?.lastElementChild !== root) return;
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault(); e.stopPropagation();
        if (phase === 'idle') open(); else if (phase === 'done') finish();
      }
    };
    addEventListener('keydown', onKey);
    packWrap.addEventListener('click', open);
    root.addEventListener('pointerdown', (e) => { if (phase === 'done' && e.target === root) finish(); });
    if (!stickers.length) { phase = 'done'; finish(); }
  });
}
