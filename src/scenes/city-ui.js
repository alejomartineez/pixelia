// Interfaz de la ciudad: menú Construir, ficha de edificio, castillo, expansión,
// barra de colocación, botones flotantes y estilos (prefijo cx-).
import { infoBoxes as threatInfoBoxes } from '../threats/threat-ui.js';
import { thumbnail } from '../city/models.js';
import { CATEGORIES, BUILDINGS, MAP_SIZE, CASTLE_BONUS_PER_LEVEL, RANK_REQ_LABELS, MONUMENTS, ERAS } from '../core/data.js';
import { cycleEffects, cycleUpgradeLines } from '../expedition/expedition.js';
import * as RZ from '../core/raiz.js';
import { HOME_LEVELS, homeLevelDef, comfortInfo } from '../home/furniture.js';
import { icon } from '../core/icons.js';
import * as chests from '../chests/chests.js';

/** Construcciones gratis guardadas (de cofres) para ese edificio. Nunca rompe si el módulo falla. */
export function freeCount(id) { try { return chests.freeBuildCount(id) | 0; } catch { return 0; } }
function hammerCount() { try { return chests.itemCount('hammer') | 0; } catch { return 0; } }

export const STYLE = `
.scene-city { background: var(--cx-sky, linear-gradient(180deg, #523a23 0%, var(--surface-2) 34%, #233653 66%, #224f4d 100%)); overflow: hidden; transition: background .4s; }
.scene-city::before { content: ''; position: absolute; inset: 0; pointer-events: none; opacity: var(--cx-stars, .55);
  background-image: radial-gradient(circle at 12% 18%, var(--surface) 0 2px, transparent 3px), radial-gradient(circle at 82% 12%, var(--surface) 0 2px, transparent 3px),
  radial-gradient(circle at 70% 78%, #fff 0 2px, transparent 3px), radial-gradient(circle at 22% 86%, #fff 0 2px, transparent 3px),
  radial-gradient(circle at 48% 6%, #fff 0 1.5px, transparent 2.5px), radial-gradient(circle at 92% 52%, #fff 0 1.5px, transparent 2.5px);
  animation: cx-twinkle 3s steps(2) infinite; }
@keyframes cx-twinkle { 50% { opacity: calc(var(--cx-stars, .55) * .36); } }
.scene-city .pixel-canvas { position: absolute; inset: 0; }
.cx-layer { position: absolute; inset: 0; pointer-events: none; overflow: hidden; z-index: 2; }
.cx-ov { position: absolute; left: 0; top: 0; will-change: transform; transform-origin: 0 0; }
.cx-ov > * { transform: translate(-50%, -100%); }

.cx-timer { display: flex; align-items: center; gap: 4px; padding: 3px 8px 3px 4px; background: var(--surface); border: 3px solid var(--edge); border-radius: 10px;
  box-shadow: 0 3px 0 var(--shade); white-space: nowrap; margin-bottom: 6px; }
.cx-timer > span { display: flex; flex-direction: column; gap: 2px; }
.cx-timer b { font-size: 13px; line-height: 1; }
.cx-timer i { display: block; width: 50px; height: 8px; border: 2px solid var(--edge); border-radius: 6px; background: var(--surface-2); overflow: hidden; }
.cx-timer i u { display: block; height: 100%; background: repeating-linear-gradient(90deg, var(--mint) 0 4px, var(--mint-d) 4px 6px); }
.cx-timer.up i u { background: repeating-linear-gradient(90deg, var(--second) 0 4px, var(--second-d) 4px 6px); }
.cx-timer img { animation: cx-hammer .5s steps(2) infinite; }
@keyframes cx-hammer { 50% { transform: rotate(-25deg); } }

.cx-bubble { position: relative; padding-bottom: 9px; animation: cx-bob 1.1s steps(4) infinite; }
.cx-bubble .cx-bb { width: 42px; height: 42px; border-radius: 50%; background: var(--surface); border: 3px solid var(--edge); display: grid; place-items: center;
  box-shadow: inset 0 -4px 0 var(--surface-2), 0 3px 0 rgba(8, 6, 5,.3); }
.cx-bubble::after { content: ''; position: absolute; left: 50%; bottom: 1px; width: 10px; height: 10px; background: var(--surface); border: 3px solid var(--edge);
  border-top: 0; border-left: 0; transform: translateX(-50%) rotate(45deg); }
.cx-bubble.full .cx-bb { background: var(--gold-l); box-shadow: inset 0 -4px 0 var(--gold), 0 0 0 3px var(--surface), 0 3px 0 6px rgba(8, 6, 5,.25); }
.cx-bubble.full::after { background: var(--gold-l); }
.cx-bubble.gem .cx-bb { background: var(--sky-l); }
.cx-bubble.gem::after { background: var(--sky-l); }
@keyframes cx-bob { 0%, 100% { transform: translate(-50%, -100%); } 50% { transform: translate(-50%, calc(-100% - 6px)); } }
.cx-bubble.pop { animation: cx-bpop .25s ease-in forwards; }
@keyframes cx-bpop { to { transform: translate(-50%, -100%) scale(1.6); opacity: 0; } }

.cx-sign { display: flex; align-items: center; gap: 4px; padding: 3px 9px 3px 5px; background: var(--primary); color: #fff; border: 3px solid var(--edge);
  border-radius: 10px; box-shadow: inset 0 -4px 0 var(--primary-d), 0 3px 0 var(--shade); font-weight: 700; font-size: 13px; white-space: nowrap;
  text-shadow: 0 2px 0 rgba(8, 6, 5,.35); margin-bottom: 4px; }
.cx-sign.locked { background: var(--surface); color: var(--ink-l); text-shadow: none; box-shadow: inset 0 -4px 0 var(--surface-2), 0 3px 0 var(--shade); }

.cx-tagwrap { padding-bottom: 12px; }
.cx-tag { position: relative; display: flex; align-items: center; gap: 4px; padding: 3px 9px; background: var(--surface); border: 3px solid var(--edge); border-radius: 10px;
  box-shadow: 0 3px 0 var(--shade); font-weight: 700; font-size: 14px; white-space: nowrap; animation: cx-bobY 1.1s steps(4) infinite; }
@keyframes cx-bobY { 50% { transform: translateY(-6px); } }
.cx-tag::after { content: ''; position: absolute; left: 50%; bottom: -8px; width: 8px; height: 8px; background: var(--surface); border: 3px solid var(--edge);
  border-top: 0; border-left: 0; transform: translateX(-50%) rotate(45deg); }

.cx-pin { animation: cx-bob .8s steps(4) infinite; padding-bottom: 2px; }
.cx-pin.bad img { filter: hue-rotate(-40deg) saturate(1.4); }
.cx-side { position: absolute; right: calc(var(--safe-r) + 10px); bottom: calc(var(--safe-b) + 150px); z-index: 25; display: flex; flex-direction: column;
  align-items: flex-end; gap: 10px; pointer-events: none; }
.cx-side > * { pointer-events: auto; }
.cx-fab { width: 50px; height: 50px; display: grid; place-items: center; background: var(--surface); border: 3px solid var(--edge); border-radius: 14px;
  box-shadow: inset 0 -5px 0 var(--surface-2), 0 4px 0 var(--shade); padding: 0; }
.cx-fab:active { transform: translateY(3px); box-shadow: inset 0 -2px 0 var(--surface-2), 0 1px 0 var(--shade); }
.cx-collect { display: flex; align-items: center; gap: 6px; padding: 6px 12px 6px 8px; background: var(--gold); border: 3px solid var(--edge); border-radius: 14px;
  box-shadow: inset 0 -5px 0 var(--gold-d), 0 4px 0 var(--shade); font-weight: 700; font-size: 15px; color: var(--ink-dark); position: relative; animation: cx-wiggle 1.6s steps(2) infinite; }
.cx-collect:active { transform: translateY(3px); box-shadow: inset 0 -2px 0 var(--gold-d), 0 1px 0 var(--shade); }
.cx-collect .badge { top: -10px; right: -10px; animation: none; }
@keyframes cx-wiggle { 0%, 80%, 100% { transform: none; } 85% { transform: rotate(-4deg); } 90% { transform: rotate(4deg); } }
.cx-side.hide { display: none; }
/* pantallas bajas (iPhone SE): la columna de la derecha del HUD llega más abajo → botones más chicos y más pegados a la barra */
@media (max-height: 700px) and (max-width: 759px) {
  .cx-side { bottom: calc(var(--safe-b) + 124px); gap: 8px; }
  .cx-fab { width: 44px; height: 44px; border-radius: 12px; }
  .cx-fab img.pi { width: 26px; height: 26px; }
  .cx-collect { padding: 4px 10px 4px 6px; font-size: 14px; }
}
/* celular apaisado: el HUD va en fila arriba → la columna arranca debajo de monedas/gemas */
@media (max-height: 520px) {
  .cx-side { top: calc(var(--safe-t) + 100px); bottom: auto; gap: 8px; }
  .cx-fab { width: 44px; height: 44px; border-radius: 12px; }
  .cx-fab img.pi { width: 26px; height: 26px; }
  .cx-collect { padding: 4px 10px 4px 6px; font-size: 14px; }
}

.cx-tip { position: absolute; z-index: 30; pointer-events: none; transform: translate(-50%, -100%); display: flex; flex-direction: column; align-items: center; animation: cx-tipbob 1s steps(3) infinite; }
.cx-tip > span { background: var(--surface); border: 3px solid var(--edge); border-radius: 12px; box-shadow: 0 4px 0 var(--shade); padding: 6px 12px; font-weight: 700; font-size: 15px;
  white-space: nowrap; display: flex; align-items: center; gap: 6px; max-width: 86vw; }
.cx-tip > i { width: 0; height: 0; border-left: 12px solid transparent; border-right: 12px solid transparent; border-top: 14px solid var(--edge); margin-top: -1px; }
@keyframes cx-tipbob { 50% { margin-top: -8px; } }
.cx-tip.fade { opacity: 0; transition: opacity .3s; }
/* flecha guiada al costado (plan §E3): a la izquierda de un botón del riel o a la derecha de la tarjeta de rango */
.cx-tip.left, .cx-tip.right { flex-direction: row; animation-name: cx-tipbobx; }
.cx-tip.left { transform: translate(-100%, -50%); }
.cx-tip.right { transform: translate(0, -50%); flex-direction: row-reverse; }
.cx-tip.left > i, .cx-tip.right > i { border-top: 12px solid transparent; border-bottom: 12px solid transparent; margin: 0; }
.cx-tip.left > i { border-left: 14px solid var(--edge); border-right: 0; margin-left: -1px; }
.cx-tip.right > i { border-right: 14px solid var(--edge); border-left: 0; margin-right: -1px; }
@keyframes cx-tipbobx { 50% { margin-left: -8px; } }
.cx-tip.right { animation-name: cx-tipbobr; }
@keyframes cx-tipbobr { 50% { margin-left: 8px; } }
.cx-sign.guide { outline: 3px solid var(--gold); outline-offset: 2px; animation: cx-signpulse 1s steps(2) infinite; }
@keyframes cx-signpulse { 50% { outline-color: transparent; } }
html.reduce-motion .cx-tip, html.reduce-motion .cx-sign.guide { animation: none; }

/* ---------- Modales (fuera de .scene-city) ---------- */
.cx-modal .modal-body { padding: 12px 14px 16px; }
.cx-build .modal-body { padding-top: 0; }
.cx-tabs { position: sticky; top: 0; z-index: 3; background: var(--panel); margin: 0 -14px 6px; padding: 10px 12px 8px; border-bottom: 2px dashed var(--rule); }
.cx-tabs .tab { position: relative; }
/* con mouse no se nota que las pestañas se deslizan: en pantallas anchas van en dos renglones si no entran */
@media (min-width: 900px) { .cx-tabs { flex-wrap: wrap; overflow-x: visible; } }
.cx-tabs .tab .dot { position: absolute; top: -6px; right: -6px; width: 14px; height: 14px; border-radius: 50%; background: var(--gold); border: 2px solid var(--edge); }
@media (max-width: 520px) {
  .cx-tabs { display: grid; grid-template-columns: repeat(5, 1fr); gap: 5px; overflow: visible; padding: 10px 8px 8px; margin: 0 -14px 6px; }
  .cx-tabs .tab { flex-direction: column; gap: 1px; padding: 4px 2px 3px; font-size: 13px; line-height: 1; min-width: 0; white-space: nowrap; }
  .cx-tabs .tab .dot { top: -5px; right: -5px; width: 12px; height: 12px; }
}
.cx-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; padding-bottom: 6px; }
@media (max-width: 420px) { .cx-grid { grid-template-columns: 1fr 1fr; gap: 8px; } }
.cx-card { display: flex; flex-direction: column; gap: 4px; text-align: left; padding: 8px; cursor: pointer; font-family: inherit; color: var(--ink); }
.cx-card:active { transform: translateY(2px); box-shadow: 0 1px 0 var(--shade); }
.cx-card.cx-focus { outline: 4px solid var(--gold); outline-offset: -1px; animation: cx-glow 1s steps(2) infinite; }
@keyframes cx-glow { 50% { outline-color: #fff; } }
.cx-thumb { height: 84px; border-radius: 9px; background: radial-gradient(circle at 50% 70%, var(--surface) 0 30%, var(--surface-2) 31% 55%, var(--surface-2) 56%); display: grid; place-items: center; overflow: hidden; border: 2px solid var(--rule); position: relative; }
.cx-cat-casa .cx-thumb { background: radial-gradient(circle at 50% 70%, var(--surface) 0 30%, var(--surface-2) 31% 55%, #523a23 56%); }
.cx-cat-negocio .cx-thumb { background: radial-gradient(circle at 50% 70%, var(--surface) 0 30%, #524423 31% 55%, #4f4022 56%); }
.cx-cat-especial .cx-thumb { background: radial-gradient(circle at 50% 70%, var(--surface) 0 30%, var(--surface-2) 31% 55%, var(--rule) 56%); }
.cx-cat-deco .cx-thumb { background: radial-gradient(circle at 50% 70%, var(--surface) 0 30%, var(--surface-2) 31% 55%, #224f3d 56%); }
.cx-cat-camino .cx-thumb { background: radial-gradient(circle at 50% 70%, var(--surface) 0 30%, var(--surface-2) 31% 55%, #233c52 56%); }
.cx-thumb img.th { width: 84px; height: 84px; }
.cx-thumb .ph { opacity: .45; animation: pulse 1s steps(2) infinite; }
.cx-card.locked .cx-thumb img.th { filter: grayscale(.85) opacity(.6); }
.cx-card .nm { font-size: 15px; font-weight: 700; line-height: 1.1; min-height: 2.2em; display: flex; align-items: center; }
.cx-gives { display: flex; flex-wrap: wrap; gap: 3px; }
.cx-gives .chip { font-size: 12px; padding: 1px 6px 1px 3px; gap: 2px; border-width: 2px; }
.cx-price { display: flex; align-items: center; justify-content: space-between; gap: 4px; font-size: 15px; }
.cx-price .tm { font-size: 12px; color: var(--ink-l); display: inline-flex; align-items: center; gap: 2px; white-space: nowrap; }
.cx-card.poor .cx-price .cost { color: var(--coral); }
.cx-lock { position: absolute; left: 6px; right: 6px; bottom: 6px; display: flex; justify-content: center; }
.cx-lock span { background: var(--ink); color: #fff; border-radius: 8px; padding: 2px 8px; font-size: 12px; font-weight: 700; display: inline-flex; align-items: center; gap: 3px;
  white-space: nowrap; max-width: 100%; overflow: hidden; text-overflow: ellipsis; }
.cx-lock span img { flex: none; }
.cx-qbadge { position: absolute; top: 6px; left: 6px; background: var(--gold); border: 2px solid var(--edge); border-radius: 8px; padding: 0 6px; font-size: 12px; font-weight: 700; z-index: 1; color: var(--ink-dark); }
.cx-count { position: absolute; top: 6px; right: 6px; background: var(--surface); border: 2px solid var(--edge); border-radius: 8px; padding: 0 6px; font-size: 12px; font-weight: 700; z-index: 1; }
.cx-builders { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--ink-l); margin: 2px 0 8px; }

.cx-info { display: flex; flex-direction: column; gap: 10px; }
.cx-ihead { display: flex; gap: 12px; align-items: center; }
.cx-ithumb { width: 92px; height: 92px; flex: none; border-radius: 12px; border: 3px solid var(--edge); background: radial-gradient(circle at 50% 70%, var(--surface) 0 30%, var(--surface-2) 31% 55%, var(--surface-2) 56%); display: grid; place-items: center; overflow: hidden; }
.cx-ithumb img.th { width: 92px; height: 92px; }
.cx-imeta { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.cx-stars { display: flex; gap: 1px; }
.cx-chips { display: flex; flex-wrap: wrap; gap: 4px; }
.cx-desc { margin: 0; color: var(--ink-l); font-size: 15px; }
.cx-box { background: var(--surface); border: 3px solid var(--edge); border-radius: 12px; padding: 8px 10px; display: flex; flex-direction: column; gap: 6px; box-shadow: 0 3px 0 var(--shade); }
.cx-box h4 { margin: 0; font-size: 16px; display: flex; align-items: center; gap: 6px; }
.cx-box .line { display: flex; align-items: center; justify-content: space-between; gap: 6px; font-size: 14px; flex-wrap: wrap; }
.cx-box .line .muted { font-size: 13px; }
.cx-box.busy { background: var(--mint-l); }
.cx-box.up { background: var(--second-l); }
.cx-box.ready { background: var(--gold-l); }
.cx-box .btn { width: 100%; }
.cx-box .req { color: var(--coral); font-weight: 700; font-size: 13px; display: flex; align-items: center; gap: 4px; }
.cx-reqs { display: flex; flex-direction: column; gap: 3px; }
.cx-reqline { display: flex; align-items: center; gap: 6px; font-size: 14px; padding: 2px 8px; border-radius: 8px; background: var(--surface-2); }
.cx-reqline span { flex: 1; }
.cx-reqline b { font-variant-numeric: tabular-nums; }
.cx-reqline.ok { background: var(--mint-l); }
.cx-actions { display: grid; grid-template-columns: repeat(auto-fit, minmax(90px, 1fr)); gap: 8px; }
.cx-actions .btn { padding: 6px 8px; font-size: 15px; min-height: 42px; }
.cx-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.cx-stat { background: var(--surface); border: 3px solid var(--edge); border-radius: 12px; padding: 6px 8px; display: flex; align-items: center; gap: 8px; box-shadow: 0 3px 0 var(--shade); }
.cx-stat small { display: block; font-size: 12px; color: var(--ink-l); font-weight: 700; }
.cx-stat b { font-size: 18px; }
.cx-free { position: absolute; left: -4px; right: -4px; bottom: 8px; display: flex; justify-content: center; z-index: 2; pointer-events: none; }
.cx-free span { background: var(--primary); color: #fff; border: 2px solid var(--edge); border-radius: 6px; padding: 1px 10px; font-size: 13px; font-weight: 700;
  box-shadow: 0 2px 0 var(--shade); text-shadow: 0 1px 0 rgba(8, 6, 5,.4); transform: rotate(-4deg); white-space: nowrap; animation: cx-freebob 1.2s steps(2) infinite; }
@keyframes cx-freebob { 50% { transform: rotate(-4deg) translateY(-2px); } }
.cx-card.cx-isfree { border-color: var(--primary-d); box-shadow: 0 4px 0 var(--primary-d); }
.cx-card.cx-isfree .cx-thumb { border-color: var(--primary); }
.cx-freecost { color: var(--primary-t); font-weight: 700; }
.cx-tabs .tab .dot.free { background: var(--primary); }
.cx-mastery .cx-stars img { width: 18px; height: 18px; }
.cx-mastery { background: var(--surface); }
.cx-exp-map { display: grid; place-items: center; padding: 6px; }
.cx-exp-map canvas { image-rendering: pixelated; width: 132px; height: 132px; border: 3px solid var(--edge); border-radius: 10px; background: #79bb8c; }
`;

const CAT_ICON = { casa: 'home', ciclo: '🧭', defensa: '🛡️', negocio: 'shop', especial: 'sparkle', monumento: 'monument', deco: 'flower', camino: 'map' };
// lo que mejora a la vista un edificio del ciclo en cada nivel (DESIGN-CORE.md §4.2; models-cycle.js)
const CYCLE_LOOK = { 2: 'un anexo al costado', 3: 'un piso más y techo nuevo', 4: 'chimenea y aberturas más grandes', 5: 'mirador arriba y cerco alrededor' };
const thumbs = new Map();
let thumbTheme = 'pueblo';
/** Tema con el que se dibujan las miniaturas del menú (el de la ciudad). */
export function setThumbTheme(t) { thumbTheme = t || 'pueblo'; }
function thumbImg(id, level, cls = 'th', era = 1) {
  const wrap = document.createElement('span');
  wrap.style.display = 'contents';
  const th = thumbTheme;
  const key = id + ':' + level + ':' + era + ':' + th;
  const put = (url) => { wrap.innerHTML = `<img class="${cls}" src="${url}" alt="" draggable="false">`; };
  if (thumbs.has(key)) put(thumbs.get(key));
  else {
    wrap.innerHTML = icon('hammer', 36, 'ph');
    Promise.resolve().then(() => thumbnail(id, level, era, th)).then(url => { if (!url) return; thumbs.set(key, url); put(url); }).catch(() => {});
  }
  return wrap;
}

const ui_esc = (t) => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function fmtCycle(E, sec) { return E.fmtTime(sec).replace(/ 00s$/, '').replace(/ 00m$/, ''); }

/** Chips de lo que aporta un tipo de edificio (menú). */
function givesHtml(ctx, d) {
  const E = ctx.economy;
  const out = [];
  if (d.pop) out.push(`<span class="chip primary">${icon('people', 14)}+${d.pop}</span>`);
  if (d.prod?.coins) out.push(`<span class="chip gold">${icon('coin', 14)}${d.prod.coins}/${fmtCycle(E, d.prod.cycle)}</span>`);
  if (d.prod?.gems) out.push(`<span class="chip sky">${icon('gem', 14)}${d.prod.gems}/${fmtCycle(E, d.prod.cycle)}</span>`);
  if (d.prod?.prov) out.push(`<span class="chip gold">${icon('🍞', 14)}${d.prod.prov}/${fmtCycle(E, d.prod.cycle)}</span>`);
  if (d.cat === 'ciclo' && !d.prod) { const fx = cycleEffects(d.id, 1)[0]; if (fx) out.push(`<span class="chip second" title="${ui_esc(fx.text)}">${icon('🧭', 14)}${ui_esc(fx.label)}: ${ui_esc(String(fx.value))}</span>`); }
  if (d.happy) out.push(`<span class="chip mint">${icon('smile', 14)}+${d.happy}</span>`);
  if (d.game === 'wardrobe') out.push(`<span class="chip second">${icon('dress', 14)}Equipaje</span>`);
  if (d.cat === 'camino') out.push(`<span class="chip">${icon('paw', 14)}Paseo</span>`);
  if (d.cat === 'monumento') out.push(`<span class="chip second">${icon('monument', 14)}${MONUMENTS[d.id].stages.length} etapas</span>`);
  // Encanto que sumaría otra copia (rinde menos si ya tenés del mismo)
  const ch = E.charmGain(d.id);
  if (ch >= 1) {
    const rep = E.countOf(d.id) > 0;
    out.push(`<span class="chip${rep ? '' : ' gold'}" title="+${Math.round(ch)} Encanto${rep ? ' (menos porque ya tenés)' : ''}">${icon('sparkle', 14)}+${Math.round(ch)}</span>`);
  }
  return out.join('');
}

/** Ids que la misión principal pide construir (para resaltarlos). */
export function questBuildIds(ctx) {
  const q = ctx.quests.mainQuest();
  if (!q || q.done) return [];
  const E = ctx.economy;
  const g = q.goal;
  if (g.type === 'build') {
    const ids = g.ids || (g.id ? [g.id] : []);
    return ids.filter(id => g.ids ? true : E.countOf(id) === 0);
  }
  // personalizar se hace en el vestidor (el personaje o la municipalidad): no hace falta construir la boutique
  if (g.type === 'customize') return [];
  if (g.type === 'pop') return ['casita', 'cabana', 'chalet', 'torre_cristal', 'mansion'].filter(id => E.canBuild(id).ok).slice(-1);
  if (g.type === 'happy') return ['arbol', 'arbusto', 'banco', 'cerezo', 'fuente'].filter(id => E.canBuild(id).ok).slice(-1);
  return [];
}

/** ¿Todas las copias de este edificio están todavía en obra? (para decir "En obra" en vez de "Ya lo tenés") */
function isAllUnderConstruction(ctx, id) {
  const E = ctx.economy, now = Date.now();
  const list = ctx.state.city.buildings.filter(b => b.id === id);
  return list.length > 0 && list.every(b => E.isConstructing(b, now));
}

/** Etiqueta corta del candado de una tarjeta (entra en una línea en el celu). */
function lockLabel(d, can, ctx) {
  if (can.reason === 'Constructoras ocupadas') return `${icon('hammer', 14)}Ocupadas`;
  if (can.reason === 'Ya lo tenés') return isAllUnderConstruction(ctx, d.id) ? `${icon('hammer', 14)}En obra` : `${icon('check', 14)}Ya lo tenés`;
  if (can.poor) return `${icon('coin', 14)}Te faltan monedas`;
  if (can.mats) return `${icon('monument', 14)}Faltan materiales`;
  if (can.locked && d.popReq && !/^Nivel/.test(can.reason)) return `${icon('people', 14)}${d.popReq} habitantes`;
  return `${icon(can.locked ? 'lock' : 'info', 14)}${can.reason}`;
}

// ======================================================================
// Menú Construir
// ======================================================================
let lastTab = 'casa';
export function openBuildMenu(S, focusId = null) {
  const { ctx } = S;
  const { ui, economy: E, store } = ctx;
  S.buildMenu?.close();
  const qids = questBuildIds(ctx);
  if (focusId && (!E.def(focusId) || focusId === 'castillo')) focusId = null;
  if (!focusId) focusId = qids.find(id => E.canBuild(id).ok) || null;
  let tab = focusId ? E.def(focusId).cat : lastTab;
  const body = ui.h('div.cx-buildwrap');
  const m = ui.sheet({ title: 'Construir', content: body, className: 'cx-modal cx-build', onClose: () => { offs.forEach(f => f()); S.untrackModal(m); if (S.buildMenu === m) S.buildMenu = null; } });
  S.trackModal(m);
  S.buildMenu = m;
  const offs = [];
  const rerender = () => render(false);
  offs.push(ctx.bus.on('currency:changed', rerender), ctx.bus.on('building:built', rerender), ctx.bus.on('level:up', rerender), ctx.bus.on('chests:changed', rerender));

  function render(scrollToFocus) {
    const scrollEl = m.body;
    const prevScroll = scrollEl.scrollTop;
    body.innerHTML = '';
    const tabs = ui.h('div.tabs.cx-tabs');
    for (const c of CATEGORIES) {
      const hasQ = qids.some(id => E.def(id).cat === c.id);
      const hasFree = !hasQ && BUILDINGS.some(d => d.cat === c.id && freeCount(d.id) > 0);
      const t = ui.h('button.tab' + (c.id === tab ? '.active' : ''), { html: icon(CAT_ICON[c.id], 18) + c.name + (hasQ ? '<i class="dot"></i>' : hasFree ? '<i class="dot free"></i>' : '') });
      t.addEventListener('click', () => { if (tab === c.id) return; ctx.audio.sfx('select'); tab = c.id; lastTab = tab; focusId = null; render(false); m.body.scrollTop = 0; });
      tabs.append(t);
    }
    body.append(tabs);
    const free = E.buildersFree(), total = ctx.state.builders;
    body.append(ui.h('div.cx-builders', { html: `${icon('hammer', 16)} Constructoras libres: <b>${free}/${total}</b>` }));
    const grid = ui.h('div.cx-grid');
    const list = BUILDINGS.filter(d => d.cat === tab && d.id !== 'castillo' && !d.auto)
      .sort((a, b) => (a.unlock - b.unlock) || ((a.cost.coins || 0) + (a.cost.gems || 0) * 200) - ((b.cost.coins || 0) + (b.cost.gems || 0) * 200))
      // las construcciones gratis (de cofres) primero
      .sort((a, b) => (freeCount(b.id) > 0) - (freeCount(a.id) > 0));
    let focusEl = null;
    for (const d of list) {
      const can = E.canBuild(d.id);
      const cost = E.placeCost(d.id);
      const nFree = freeCount(d.id);
      const isFree = nFree > 0 || !!cost.free;
      // con una construcción gratis no importan el nivel ni los vecinos: la cinta reemplaza al candado
      const showLock = !can.ok && !(isFree && can.locked);
      const lockedHard = !can.ok && !isFree && (can.locked || can.reason === 'Ya lo tenés');
      const card = ui.h(`button.card.cx-card.cx-cat-${d.cat}` + (lockedHard ? '.locked' : '') + (can.poor && !isFree ? '.poor' : '') + (isFree ? '.cx-isfree' : '') + (d.id === focusId ? '.cx-focus' : ''));
      const th = ui.h('div.cx-thumb');
      th.append(thumbImg(d.id, 1, 'th', E.cityEra()));
      if (qids.includes(d.id)) th.append(ui.h('span.cx-qbadge', {}, 'Misión'));
      if (d.max) th.append(ui.h('span.cx-count', {}, `${E.countOf(d.id)}/${d.max}`));
      if (showLock) th.append(ui.h('div.cx-lock', { html: `<span>${lockLabel(d, can, ctx)}</span>` }));
      if (isFree) {
        const rb = ui.h('div.cx-free', { html: `<span>Gratis${nFree > 1 ? ' x' + nFree : ''}</span>` });
        if (showLock) rb.style.bottom = '34px';
        th.append(rb);
      }
      const priceHtml = isFree ? `<span class="cost cx-freecost">${icon('🎁', 16)}Gratis</span>` : ui.costHtml(cost, 16);
      card.append(th,
        ui.h('div.nm', {}, d.name),
        ui.h('div.cx-gives', { html: givesHtml(ctx, d) }),
        ui.h('div.cx-price', { html: priceHtml + (d.time > 0 ? `<span class="tm">${icon('clock', 12)}${fmtCycle(E, d.time)}</span>` : '') }));
      card.addEventListener('click', () => {
        const c2 = E.canBuild(d.id);
        if (!c2.ok && c2.mats) { ctx.audio.sfx('tap'); m.close(); ctx.openPanel('works', { focus: d.id }); return; }
        if (!c2.ok) {
          ctx.audio.sfx('error');
          const msg = c2.reason === 'Constructoras ocupadas' ? 'Tus constructoras están ocupadas. Esperá o terminá una obra.' : c2.poor ? `Te faltan monedas para ${d.name}` : c2.reason === 'Ya lo tenés' ? (isAllUnderConstruction(ctx, d.id) ? `${d.name} ya está en obra` : `Ya tenés ${d.name}`) : `${d.name}: ${c2.reason}`;
          ui.toast(msg, { icon: c2.locked ? 'lock' : 'info' });
          card.classList.remove('bump'); void card.offsetWidth; card.classList.add('bump');
          return;
        }
        ctx.audio.sfx('select');
        m.close();
        S.startPlacement(d.id);
      });
      if (d.id === focusId) focusEl = card;
      grid.append(card);
    }
    body.append(grid);
    if (scrollToFocus && focusEl) setTimeout(() => focusEl.scrollIntoView({ block: 'center', behavior: 'smooth' }), 260);
    else scrollEl.scrollTop = prevScroll;
  }
  render(true);
  return m;
}

/** Confirmación Sí/No que la ciudad registra (Esc o tocar afuera = No). */
function askYesNo(S, title, html, okLabel, cancelLabel) {
  const { ui } = S.ctx;
  return new Promise(res => {
    let v = false;
    const m = ui.modal({ title, content: `<p class="center">${html}</p>`, className: 'cx-modal', onClose: () => { S.untrackModal(m); res(v); },
      actions: [{ label: cancelLabel, cls: 'ghost' }, { label: okLabel, cls: 'primary', onClick: () => { v = true; } }] });
    S.trackModal(m);
  });
}

// ======================================================================
// Ficha de edificio
// ======================================================================
export function openInfo(S, uid) {
  const { ctx } = S;
  const { ui, economy: E, store } = ctx;
  const b = ctx.state.city.buildings.find(o => o.uid === uid);
  if (!b) return null;
  const d = E.def(b);
  const isCastle = b.id === 'castillo';
  const isMon = d.cat === 'monumento';
  const isHome = b.id === 'mi_casa';
  const body = ui.h('div.cx-info');
  let sig = '';
  const refs = {};
  const m = ui.modal({ title: isCastle ? (ctx.state.player.cityName ? `${d.name}` : d.name) : d.name, content: body, className: 'cx-modal cx-info-modal', icon: isCastle ? 'castle' : null,
    onClose: () => { clearInterval(iv); offs.forEach(f => f()); S.untrackModal(m); } });
  S.trackModal(m);
  const offs = [ctx.bus.on('currency:changed', () => { sig = ''; tick(); }), ctx.bus.on('builders:changed', () => { sig = ''; tick(); }),
    ctx.bus.on('building:removed', (p) => { if (p.b.uid === uid) m.close(); }), ctx.bus.on('chests:changed', () => { sig = ''; tick(); })];

  const btn = (label, cls, ic, onClick, disabled = false) => ui.h('button.btn.' + cls.split(' ').join('.'), { html: (ic ? icon(ic, 20) : '') + label, disabled, onclick: () => { ctx.audio.sfx('tap'); onClick(); } });

  function signature() {
    const now = Date.now();
    const ps = E.producerStatus(b, now);
    return [E.isConstructing(b, now), E.isUpgrading(b, now), b.level, ps.ready, ps.full, E.canUpgrade(b).ok, E.skipCost(b) === 0, E.buildersFree(), ctx.state.city.expansions, ctx.state.builders, ctx.state.player.level, hammerCount(), masteryStars(), isCastle ? E.rankStatus().reqs.map(r => r.ok ? 1 : 0).join('') : '', b.era || 1, E.renovateInfo(b) ? E.canRenovate(b).ok : '-', b.damaged ? 1 : 0].join('|');
  }
  function mastery() {
    if (typeof E.masteryInfo !== 'function' || !d.prod) return null;
    try { const mi = E.masteryInfo(b.id); return mi && Number.isFinite(+(mi.stars ?? mi.level)) ? mi : null; } catch { return null; }
  }
  function masteryStars() { const mi = mastery(); return mi ? +(mi.stars ?? mi.level) : -1;
  }

  function render() {
    body.innerHTML = '';
    const now = Date.now();
    const building = E.isConstructing(b, now), upgrading = E.isUpgrading(b, now), busy = building || upgrading;
    // ----- cabecera -----
    const head = ui.h('div.cx-ihead');
    const th = ui.h('div.cx-ithumb');
    th.append(thumbImg(b.id, building ? 1 : b.level, 'th', E.buildingEra(b)));
    const meta = ui.h('div.cx-imeta');
    if (E.canUpgradeType(b)) {
      let st = '';
      const sz = E.maxLevel(b) > 5 ? 17 : 22;
      for (let i = 0; i < E.maxLevel(b); i++) st += icon(i < b.level ? 'star' : 'starOff', sz);
      meta.append(ui.h('div.cx-stars', { html: st }), ui.h('b', {}, isCastle ? `Rango ${b.level}: ${E.rankName(b.level)}` : isMon ? (b.level >= E.maxLevel(b) ? 'Terminado' : `Etapa ${b.level} de ${E.maxLevel(b)}`) : isHome ? `${homeLevelDef(b.level).name}` : `Nivel ${b.level}`));
    } else meta.append(ui.h('span.chip', { html: icon(CAT_ICON[d.cat], 14) + (CATEGORIES.find(c => c.id === d.cat)?.name || '') }));
    const chips = [];
    if (d.pop) chips.push(`<span class="chip primary">${icon('people', 14)}${E.buildingPop(b)} habitantes</span>`);
    if (d.happy) chips.push(`<span class="chip mint">${icon('smile', 14)}+${E.buildingHappy(b)} felicidad</span>`);
    if (d.game === 'wardrobe') chips.push(`<span class="chip second">${icon('dress', 14)}Equipaje</span>`);
    if (isCastle) chips.push(`<span class="chip gold">${icon('sparkle', 14)}${E.fmtNum(E.cityCharm())} Encanto</span>`);
    else if (isHome) { const ci = comfortInfo(); chips.push(`<span class="chip primary">${icon('heart', 14)}${E.fmtNum(ci.value)} Confort</span>`, `<span class="chip gold">${icon('sparkle', 14)}+${ci.charm} Encanto</span>`); }
    else if (!building && !isHome) {
      // Encanto que aporta este edificio (sin contar la repetición: eso lo explica el panel "Tu ciudad")
      const ch = Math.round(E.charmBase(d) * E.charmLevelMult(d, b.level || 1));
      if (ch >= 1) chips.push(`<span class="chip gold" title="Suma Encanto a tu ciudad (menos si repetís el mismo)">${icon('sparkle', 14)}+${ch} Encanto</span>`);
    }
    if (chips.length) meta.append(ui.h('div.cx-chips', { html: chips.join('') }));
    head.append(th, meta);
    body.append(head, ui.h('p.cx-desc', {}, d.desc));

    // ----- en obra -----
    if (busy) {
      const total = building ? d.time * 1000 : (E.upgradeInfo(b)?.time || 1) * 1000;
      const box = ui.h('div.cx-box.' + (building ? 'busy' : 'up'));
      box.append(ui.h('h4', { html: icon('hammer', 20) + (building ? 'En construcción' : isMon ? `Etapa ${b.level + 1}: ${MONUMENTS[d.id].stageNames[b.level] || ''}` : isHome ? `Ampliando: ${HOME_LEVELS[b.level]?.name || ''}` : b.renovating ? `Renovando a ${ERAS[b.renovating - 1]?.name || ''}` : `Mejorando a nivel ${b.level + 1}`) }));
      refs.busyTime = ui.h('b');
      refs.busyBar = ui.h('div', { html: ui.progressHtml(0, building ? '' : 'xp') });
      box.append(ui.h('div.line', {}, ui.h('span.muted', {}, 'Falta'), refs.busyTime), refs.busyBar);
      refs.busyTotal = total;
      const cost = E.skipCost(b);
      refs.skipBtn = btn(cost ? `Terminar ya ${icon('gem', 18)}${cost}` : 'Terminar gratis', cost ? 'sky' : 'mint', 'bolt', () => {
        const c = E.skipCost(b);
        if (c > ctx.state.gems) { ctx.audio.sfx('error'); ui.toast('Te faltan gemas', { icon: 'gem' }); return; }
        if (E.skip(b.uid)) { ctx.audio.sfx('gem'); m.close(); }
      });
      box.append(refs.skipBtn);
      const nh = hammerCount();
      if (nh > 0) {
        box.append(btn(`Martillo Mágico (${nh})`, 'gold', '🔨', () => {
          let res;
          try { res = chests.useCityItem('hammer', { uid: b.uid }); } catch (err) { console.warn('[city] martillo', err); res = { ok: false, msg: 'No se pudo usar el martillo' }; }
          if (!res?.ok) { ctx.audio.sfx('error'); ui.toast(res?.msg || 'No se pudo usar el martillo', { icon: 'info' }); return; }
          store.markDirty();
          ctx.audio.sfx('build');
          m.close();
          E.tick();
          ui.toast(res.msg || 'Obra terminada', { icon: '🔨', type: 'good' });
        }));
      }
      body.append(box);
    }

    // ----- producción -----
    const ps = E.producerStatus(b, now);
    if (ps.producer && !busy && !ps.damaged) {   // dañado: lo explica la caja de amenazas (más abajo)
      const cur = ps.currency === 'gems' ? 'gem' : ps.currency === 'prov' ? '🍞' : ps.currency === 'hierbas' ? '🌿' : 'coin';
      const box = ui.h('div.cx-box' + (ps.ready ? '.ready' : ''));
      box.append(ui.h('h4', { html: icon(cur, 20) + 'Producción' }));
      box.append(ui.h('div.line', { html: `<span>Cada <b>${E.fmtTime(ps.cycleSec)}</b></span><span class="cost">+${E.fmtNum(ps.perCycle)} ${icon(cur, 16)}</span>` }));
      box.append(ui.h('div.line', { html: `<span class="muted">Guarda hasta ${ps.cap * ps.cycleSec >= 3600 ? Math.round(ps.cap * ps.cycleSec / 3600) + ' h' : E.fmtTime(ps.cap * ps.cycleSec)}</span><span class="muted">${isCastle ? '' : ps.currency === 'prov' ? `Depósito ${E.fmtNum(ctx.state.prov || 0)}/${E.fmtNum(E.provCap())}` : 'Bonus ciudad x' + E.globalMultiplier().toFixed(2)}</span>` }));
      refs.prodBar = ui.h('div', { html: ui.progressHtml(ps.progress, 'gold') });
      refs.prodTxt = ui.h('span.muted');
      box.append(refs.prodBar, ui.h('div.line', {}, refs.prodTxt));
      if (ps.ready) box.append(btn(`Cobrar ${E.fmtNum(ps.amount)} ${icon(cur, 18)}`, 'gold', null, () => { m.close(); S.collect(b.uid); }));
      body.append(box);
    }

    // ----- amenazas: dañado → reparar; defensa → contra qué y radio (src/threats/threat-ui.js) -----
    if (!building) for (const n of threatInfoBoxes(ctx, b, () => m.close())) body.append(n);

    // ----- edificios del ciclo: qué dan hoy en la expedición -----
    if (d.cat === 'ciclo' && !building) {
      const fx = cycleEffects(d.id, b.level || 1);
      if (fx.length) {
        const box = ui.h('div.cx-box.cx-cycle');
        box.append(ui.h('h4', { html: icon('🧭', 20) + 'En la expedición' }));
        for (const f of fx) box.append(ui.h('div.line', { html: `<span>${ui.esc(f.text)}</span>` }));
        body.append(box);
      }
    }

    // ----- maestría (si la economía ya la tiene) -----
    const mi = d.cat !== 'ciclo' && !isCastle && mastery();
    if (mi) {
      const stars = Math.max(0, Math.min(5, Math.round(+(mi.stars ?? mi.level) || 0)));
      let st = '';
      for (let i = 0; i < 5; i++) st += icon(i < stars ? 'star' : 'starOff', 18);
      const pct = Number.isFinite(+mi.bonusPct) ? Math.round(+mi.bonusPct) : Math.round((Number.isFinite(+mi.bonus) ? +mi.bonus : stars * 0.03) * 100);
      const box = ui.h('div.cx-box.cx-mastery');
      box.append(ui.h('h4', { html: icon('🏅', 20) + 'Maestría' }));
      box.append(ui.h('div.line', { html: `<span class="cx-stars">${st}</span><span class="muted">${pct ? `+${pct}% producción` : 'Producí para ganar estrellas'}</span>` }));
      const prog = Number.isFinite(+mi.progress) ? Math.max(0, Math.min(1, +mi.progress)) : null;
      if (stars < 5 && prog != null) box.append(ui.h('div', { html: ui.progressHtml(prog, 'gold') }));
      const made = Number.isFinite(+(mi.total ?? mi.produced)) ? +(mi.total ?? mi.produced) : null;
      const next = Number.isFinite(+mi.next) ? +mi.next : null;
      if (made != null) box.append(ui.h('div.line', { html: `<span class="muted">Producido por tus ${ui.esc(d.name)}: <b>${E.fmtNum(made)}</b>${next && stars < 5 ? ` / ${E.fmtNum(next)}` : ''}</span>` }));
      body.append(box);
    }

    // ----- castillo: estadísticas -----
    if (isCastle) {
      const hp = E.happiness();
      const stats = ui.h('div.cx-stats');
      const stat = (ic, label, val) => ui.h('div.cx-stat', { html: `${icon(ic, 26)}<span><small>${label}</small><b>${val}</b></span>` });
      stats.append(stat('people', 'Población', E.fmtNum(E.population())), stat('smile', 'Felicidad', hp.pct + '%'),
        stat('coin', 'Bonus producción', '+' + Math.round((E.globalMultiplier() - 1) * 100) + '%'), stat('hammer', 'Constructoras', `${E.buildersFree()}/${ctx.state.builders}`));
      body.append(stats);
      body.append(ui.h('p.cx-desc', { html: `La felicidad (deco) da hasta <b>+50%</b> de producción y cada rango de la ciudad suma <b>+${Math.round(CASTLE_BONUS_PER_LEVEL * 100)}%</b> más.` }));
    }

    // ----- mejora -----
    const info = E.upgradeInfo(b);
    if (E.canUpgradeType(b) && !busy) {
      const box = ui.h('div.cx-box.up');
      if (!info) {
        if (isMon) box.append(ui.h('h4', { html: icon('trophy', 20) + '¡Monumento terminado!' }), ui.h('div.line', { html: `<span>${icon(MONUMENTS[d.id].bonusIcon || 'sparkle', 16)} ${ui.esc(MONUMENTS[d.id].bonusText)} (para siempre)</span>` }));
        else box.append(ui.h('h4', { html: icon('crown', 20) + 'Nivel máximo' }), ui.h('span.muted', {}, 'No hay más mejoras para este edificio.'));
      } else {
        const can = E.canUpgrade(b);
        box.append(ui.h('h4', { html: icon('up', 20) + (isCastle ? `Subir a rango ${E.rankName(b.level + 1)}` : isMon ? `Etapa ${b.level + 1}: ${MONUMENTS[d.id].stageNames[b.level] || ''}` : isHome ? `Ampliar: ${HOME_LEVELS[b.level].name}` : `Mejorar a nivel ${b.level + 1}`) }));
        const fx = [];
        if (isCastle) {
          fx.push(`+${Math.round(CASTLE_BONUS_PER_LEVEL * 100)}% producción en toda la ciudad`);
          const look = E.rankDef(b.level + 1).look;
          if (look) fx.push(`La Municipalidad estrena: ${look}`);
        }
        else if (isHome) {
          const nx = HOME_LEVELS[b.level];
          fx.push(`Cuarto de ${nx.size[0]}×${nx.size[1]} (ahora ${homeLevelDef(b.level).size.join('×')})`);
          if (nx.look) fx.push(`Se estrena: ${nx.look}`);
        }
        else if (isMon) {
          const N = E.maxLevel(b);
          fx.push(b.level + 1 >= N ? `Al terminarlo: ${MONUMENTS[d.id].bonusText}` : 'La obra crece y se ve desde toda la ciudad');
          fx.push(`Encanto ${Math.round(E.charmBase(d) * E.charmLevelMult(d, b.level))} → ${Math.round(E.charmBase(d) * E.charmLevelMult(d, b.level + 1))}`);
        }
        else if (d.cat === 'ciclo') {
          // lo que el próximo nivel cambia en la expedición (probabilidades, lugares, carga, provisiones)
          fx.push(...cycleUpgradeLines(b).map(t => ui.esc(t)));
          const look = CYCLE_LOOK[b.level + 1];
          if (look) fx.push(`Se ve de lejos: ${look}`);
        }
        else {
          if (d.prod?.coins) fx.push(`Producción ${E.fmtNum(ps.perCycle || 0)} → ${E.fmtNum(Math.round((ps.perCycle || 0) * (1 + 0.5 * b.level) / (1 + 0.5 * (b.level - 1))))}`);
          if (d.pop) fx.push(`Vecinos ${E.buildingPop(b)} → ${Math.round(d.pop * (1 + 0.4 * b.level))}`);
          // lo que cambia a la vista: estructura por nivel (arte por época)
          const VERT = { madera: 'chimenea de piedra', piedra: 'torre de piedra', ladrillo: 'chimenea alta', hierro: 'tanque de agua', vidrio: 'antena' };
          const eraId = ERAS[E.buildingEra(b) - 1]?.id;
          const look = d.eraArt
            ? { 2: d.cat === 'negocio' ? 'galería y depósito al costado' : 'un anexo al costado', 3: 'un piso más y otro techo', 4: `${VERT[eraId] || 'elemento alto'} y ventanas más grandes`, 5: d.cat === 'negocio' ? 'letrero iluminado y cerco' : 'remate en el techo y cerco' }[b.level + 1]
            : { 2: 'cantero de flores', 3: 'faroles encendidos y macetas', 4: 'mástil con bandera', 5: 'borde dorado y estrella girando' }[b.level + 1];
          if (look && d.prod) fx.push(`Se le suma: ${look}`);
        }
        for (const f of fx) box.append(ui.h('div.line', { html: `<span>${icon('sparkle', 14)} ${f}</span>` }));
        box.append(ui.h('div.line', { html: `<span class="cost">${ui.costHtml(info.cost, 18)}</span><span class="muted">${icon('clock', 14)} ${E.fmtTime(info.time)}</span>` }));
        if (can.reqs) {
          // expediente del próximo rango: lo que falta, con sus números
          const rs = E.rankStatus();
          const list = ui.h('div.cx-reqs');
          for (const r of rs.reqs) {
            const [label, ic] = RANK_REQ_LABELS[r.key] || [r.key, 'info'];
            const unit = r.key === 'happy' ? '%' : '';
            list.append(ui.h('div.cx-reqline' + (r.ok ? '.ok' : ''), { html: `${icon(r.ok ? 'check' : ic, 16)}<span>${ui.esc(label)}</span><b>${E.fmtNum(Math.min(r.have, r.need))}${unit}/${E.fmtNum(r.need)}${unit}</b>` }));
          }
          box.append(ui.h('div.req', { html: icon('lock', 14) + 'Falta completar el expediente:' }), list);
        } else if (can.mats) {
          box.append(ui.h('div.req', { html: icon('monument', 14) + (d.cat === 'ciclo' ? 'Faltan materiales: los trae la expedición.' : 'Faltan materiales: se ganan jugando.') }));
        } else if (!can.ok && can.reason !== 'No te alcanza') box.append(ui.h('div.req', { html: icon(can.locked ? 'lock' : 'info', 14) + (can.rank ? `Necesitás el rango ${ui.esc(E.rankName(can.rank))}` : can.era ? `Necesitás la ${ui.esc(can.reason.replace(/^É/, 'é'))}` : can.locked ? `Necesitás nivel ${info.reqLevel}` : ui.esc(can.reason)) }));
        box.append(btn(isMon ? 'Avanzar obra' : isHome ? 'Ampliar' : 'Mejorar', 'second', 'up', () => {
          const c = E.canUpgrade(b);
          if (!c.ok) { ctx.audio.sfx('error'); ui.toast(c.poor ? 'No te alcanza todavía' : c.reason, { icon: c.locked ? 'lock' : 'info' }); return; }
          const res = E.startUpgrade(b.uid);
          if (res.error) { ctx.audio.sfx('error'); ui.toast(res.error); return; }
          m.close();
        }, !can.ok && !can.poor));
      }
      body.append(box);
    }

    // ----- renovar a la época de la ciudad (DESIGN-CORE.md §4.1) -----
    const ren = !busy && E.renovateInfo(b);
    if (ren) {
      const box = ui.h('div.cx-box.up');
      const cr = E.canRenovate(b);
      box.append(ui.h('h4', { html: icon('hammer', 20) + `Renovar a ${ui.esc(ren.name)}` }));
      box.append(ui.h('div.line', { html: `<span>${icon('sparkle', 14)} Pasa de ${ui.esc(ERAS[E.buildingEra(b) - 1].name)} a ${ui.esc(ren.name)} y conserva el nivel ${b.level}</span>` }));
      box.append(ui.h('div.line', { html: `<span class="cost">${ui.costHtml(ren.cost, 18)}</span><span class="muted">${icon('clock', 14)} ${E.fmtTime(ren.time)}</span>` }));
      if (!cr.ok && cr.reason !== 'No te alcanza') box.append(ui.h('div.req', { html: icon(cr.mats ? 'monument' : 'info', 14) + (cr.mats ? 'Faltan materiales: se traen de las expediciones.' : ui.esc(cr.reason)) }));
      box.append(btn('Renovar', 'second', 'hammer', () => {
        const c = E.canRenovate(b);
        if (!c.ok) { ctx.audio.sfx('error'); ui.toast(c.poor ? 'No te alcanza todavía' : c.reason, { icon: 'info' }); return; }
        const res = E.startRenovate(b.uid);
        if (res.error) { ctx.audio.sfx('error'); ui.toast(res.error); return; }
        ctx.audio.sfx('build');
        m.close();
      }, !cr.ok && !cr.poor));
      body.append(box);
    }

    // ----- Invernadero de Raíz: extracción, Grieta y la obra de Raíz que la cose (L1) -----
    if (d.id === 'invernadero' && !building) {
      const ri = RZ.suturaInfo(ctx.state);
      const rs = RZ.raizState(ctx.state);
      const box = ui.h('div.cx-box.up');
      box.append(ui.h('h4', { html: icon('🌱', 20) + 'La Raíz y la Grieta' }));
      const ex = RZ.EXTRACTION[rs.mode];
      box.append(ui.h('div.line', { html: `<span>${icon(ex?.ic || 'lock', 14)} Extracción: <b>${ui.esc(ex?.name || 'sin elegir')}</b> · rinde ×${String(RZ.raizMult(ctx.state)).replace('.', ',')}</span>` }));
      box.append(ui.h('div.line', { html: `<span>${icon('bolt', 14)} Grieta <b>${Math.round(ri.grieta)}</b>/100: ${ui.esc(RZ.grietaText(ri.grieta))}</span>` }));
      const pw = RZ.grietaPower(ri.grieta), xt = RZ.grietaExtra(ri.grieta);
      if (pw || xt) box.append(ui.h('div.line', { html: `<span class="muted">Las amenazas llegan con +${pw} de fuerza${xt ? ` y hay ${xt} más por temporada` : ''}.</span>` }));
      if (ri.active) box.append(ui.h('div.line', { html: `<span>${icon('clock', 14)} La raíz está cosiendo: −${ri.heal} de Grieta en ${E.fmtTime(Math.max(1, Math.round((ri.ends - Date.now()) / 1000)))}</span>` }));
      else {
        box.append(ui.h('div.line', { html: `<span>${icon('sparkle', 14)} Obra de Raíz: cose ${ri.heal} de Grieta</span><span class="cost">${ui.costHtml(ri.cost, 18)}</span><span class="muted">${icon('clock', 14)} ${ri.hours} h</span>` }));
        if (!ri.can.ok && ri.can.reason !== 'No te alcanza') box.append(ui.h('div.req', { html: icon(ri.can.reason === 'Faltan materiales' ? 'monument' : 'info', 14) + ui.esc(ri.can.reason) }));
        box.append(btn('Coser la Grieta', 'second', 'hammer', () => {
          const res = RZ.startSutura(ctx.state);
          if (res.error) { ctx.audio.sfx('error'); ui.toast(res.error, { icon: 'info' }); return; }
          ctx.audio.sfx('build');
          ui.toast('La raíz empezó a coser la Grieta', { icon: '🌱', type: 'good' });
          m.close();
        }, !ri.can.ok && ri.can.reason !== 'No te alcanza'));
      }
      body.append(box);
    }

    // ----- castillo: expandir + constructoras -----
    if (isCastle) {
      const ex = E.expansionStatus();
      const box = ui.h('div.cx-box');
      const bnd = E.landBounds();
      box.append(ui.h('h4', { html: icon('map', 20) + 'Terreno' }));
      if (!ex) box.append(ui.h('span.muted', {}, `Tu terreno ya es enorme (${bnd.side}×${bnd.side})`));
      else {
        box.append(ui.h('div.line', { html: `<span>${bnd.side}×${bnd.side} → <b>${bnd.side + 2}×${bnd.side + 2}</b></span><span class="cost">${ui.costHtml(ex.cost, 18)}</span>` }));
        const lvOk = ex.ok;
        if (!lvOk) box.append(ui.h('div.req', { html: icon('lock', 14) + ui.esc(ex.reason) }));
        box.append(btn('Expandir', 'mint', 'plus', () => { if (S.doExpand()) m.close(); }, !lvOk));
      }
      body.append(box);
      const bi = E.builderInfo();
      const box2 = ui.h('div.cx-box');
      box2.append(ui.h('h4', { html: icon('hammer', 20) + `Constructoras: ${ctx.state.builders}` }));
      if (!bi) box2.append(ui.h('span.muted', {}, 'Tenés el equipo completo'));
      else {
        box2.append(ui.h('div.line', { html: `<span>Más obras al mismo tiempo</span><span class="cost">${ui.costHtml(bi.cost, 18)}</span>` }));
        box2.append(btn('Contratar', 'sky', 'plus', async () => {
          if (!store.canAfford(bi.cost)) { ctx.audio.sfx('error'); ui.toast('Te faltan gemas', { icon: 'gem' }); return; }
          const ok = await askYesNo(S, 'Contratar constructora', `¿Contratar otra constructora por ${icon('gem', 16)} ${bi.cost.gems}?`, 'Contratar', 'Mejor no');
          if (ok && E.buyBuilder()) { ctx.audio.sfx('buy'); ui.toast('Nueva constructora en el equipo', { icon: 'hammer', type: 'good' }); sig = ''; tick(); }
        }));
      }
      body.append(box2);
    }

    // ----- acciones -----
    const acts = ui.h('div.cx-actions');
    if (d.game === 'wardrobe' && !building) acts.append(btn('Equipaje', 'primary', 'dress', () => { m.close(); ctx.router.go('wardrobe'); }));
    if (d.panel && !building) {
      const isExp = d.panel === 'expedition';
      acts.append(btn(isExp ? 'Expedición' : 'Taller', 'primary', isExp ? 'map' : 'hammer', () => { m.close(); ctx.openPanel(d.panel); }));
    }
    // el auto del Equipaje vive en el Establo (era del Garaje, que se reconvirtió en Establo: DESIGN-CORE.md §5.3 y §9)
    if (b.id === 'establo' && !building) acts.append(btn('Esquife', 'sky', 'car', () => { m.close(); ctx.router.go('wardrobe', { tab: 'car' }); }));
    if (isCastle) acts.append(btn('Tu ciudad', 'gold', 'castle', () => { m.close(); ctx.openPanel('rank'); }));
    if (isMon) acts.append(btn('Obras', 'gold', 'monument', () => { m.close(); ctx.openPanel('works', { focus: d.id }); }));
    if (isHome) acts.append(btn('Entrar', 'primary', 'home', () => { m.close(); ctx.router.go('home'); }));
    if (isCastle) acts.append(btn('Equipaje', 'primary', 'dress', () => { m.close(); ctx.router.go('wardrobe'); }));
    acts.append(btn('Mover', 'ghost', 'move', () => { m.close(); S.startMove(b.uid); }));
    acts.append(btn('Rotar', 'ghost', 'rotate', () => { S.rotateBuilding(b.uid); }));
    if (E.canRemove(b)) acts.append(btn('Guardar', 'ghost', 'trash', async () => {
      const refund = Math.floor((d.cost.coins || 0) * 0.5);
      const ok = await askYesNo(S, 'Guardar', `¿Querés quitar ${ui.esc(d.name)}?${refund ? ` Te devolvemos ${icon('coin', 16)} ${refund}.` : ''}`, 'Quitar', 'No');
      if (ok) { S.removeBuilding(b.uid); m.close(); }
    }));
    body.append(acts);
    sig = signature();
    tick();
  }

  function tick() {
    if (!ctx.state.city.buildings.includes(b)) { m.close(); return; }
    const s2 = signature();
    if (s2 !== sig) { render(); return; }
    const now = Date.now();
    if (refs.busyTime && E.isBusy(b, now)) {
      const rem = E.remainingMs(b, now);
      refs.busyTime.textContent = E.fmtTime(rem / 1000);
      const bar = refs.busyBar.querySelector('i');
      if (bar) bar.style.width = Math.min(100, (1 - rem / refs.busyTotal) * 100).toFixed(1) + '%';
      const cost = E.skipCost(b, now);
      refs.skipBtn.innerHTML = icon('bolt', 20) + (cost ? `Terminar ya ${icon('gem', 18)}${cost}` : 'Terminar gratis');
    }
    if (refs.prodBar && refs.prodBar.isConnected) {
      const ps = E.producerStatus(b, now);
      const bar = refs.prodBar.querySelector('i');
      if (bar) bar.style.width = (ps.full ? 100 : ps.progress * 100).toFixed(1) + '%';
      refs.prodTxt.innerHTML = ps.full ? 'Lleno. Cobralo para que siga produciendo'
        : ps.siesta ? `Para cobrar: <b>${E.fmtNum(ps.amount)}</b> · la ciudad duerme la siesta: junta más lento (lleno en ${E.fmtTime(ps.fullInSec)})`
        : ps.ready ? `Para cobrar: <b>${E.fmtNum(ps.amount)}</b> · próxima tanda en ${E.fmtTime((1 - ps.progress) * ps.cycleSec)}`
        : `Próxima tanda en ${E.fmtTime((1 - ps.progress) * ps.cycleSec)}`;
    }
  }
  const iv = setInterval(tick, 500);
  render();
  return m;
}

// ======================================================================
// Expandir terreno (desde los carteles)
// ======================================================================
export function openExpand(S) {
  const { ctx } = S;
  const { ui, economy: E } = ctx;
  const ex = E.expansionStatus();
  if (!ex) { ui.toast('Tu terreno ya está al máximo', { icon: 'map' }); return null; }
  const bnd = E.landBounds();
  const body = ui.h('div.cx-info');
  const cv = document.createElement('canvas');
  cv.width = cv.height = MAP_SIZE;
  const g = cv.getContext('2d');
  g.fillStyle = '#79bb8c'; g.fillRect(0, 0, MAP_SIZE, MAP_SIZE);
  g.fillStyle = '#ffd166'; g.fillRect(bnd.min - 1, bnd.min - 1, bnd.side + 2, bnd.side + 2);
  g.fillStyle = '#a3e68b'; g.fillRect(bnd.min, bnd.min, bnd.side, bnd.side);
  for (const b of ctx.state.city.buildings) {
    const [w, d] = E.footprint(b.id, b.rot);
    g.fillStyle = b.id === 'castillo' ? '#7f9ee8' : E.def(b).cat === 'camino' ? '#ddd5c8' : '#ee8a5c';
    g.fillRect(b.x, b.z, w, d);
  }
  body.append(ui.h('div.cx-exp-map', {}, cv));
  body.append(ui.h('p.cx-desc.center', { html: `Tu terreno pasa de <b>${bnd.side}×${bnd.side}</b> a <b>${bnd.side + 2}×${bnd.side + 2}</b>: más lugar para casas, negocios y jardines.` }));
  const lvOk = ex.ok;
  const box = ui.h('div.cx-box');
  box.append(ui.h('div.line', { html: `<span>Costo</span><span class="cost">${ui.costHtml(ex.cost, 20)}</span>` }));
  if (!lvOk) box.append(ui.h('div.req', { html: icon('lock', 14) + ui.esc(ex.reason) }));
  body.append(box);
  const m = ui.modal({ title: 'Expandir', icon: 'map', content: body, className: 'cx-modal', onClose: () => S.untrackModal(m),
    actions: [{ label: 'Ahora no', cls: 'ghost' }, { html: `${icon('plus', 20)}Expandir`, label: 'Expandir', cls: 'mint', disabled: !lvOk, onClick: () => S.doExpand() ? undefined : false }] });
  S.trackModal(m);
  return m;
}
