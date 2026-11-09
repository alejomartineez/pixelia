// Expedición: interfaz DOM (DESIGN-CORE.md §2.10). Barra de arriba (provisiones, ánimo, carga, objetivo), botón Volver
// siempre visible, rótulos de costo sobre las casillas vecinas, hoja de decisión con % y costos, menú (Esc) y resultado.
// No toca three.js: la escena le pasa la vista del motor (view) y le dice dónde caen las casillas en pantalla.
import { icon } from '../core/icons.js';
import { esc } from '../core/ui.js';
import { WEATHER } from '../core/ambience.js';
import { MATERIALS, MAT_IDS, HAZARDS, REGIONS, CONTENT, OBJECTIVES, EXP, ROLES, ringOf } from './exp-data.js';
import { ENCOUNTERS, ENEMIES } from '../combat/combat-data.js';

/** "lobo de ojos brillantes" → "lobos de ojos brillantes", "grumete pirata" → "grumetes piratas". */
function pluralName(name) {
  let keep = false;
  return name.split(' ').map(w => { if (w === 'de') keep = true; return keep ? w : w + (/[aeiouáéó]$/.test(w) ? 's' : 'es'); }).join(' ');
}
/** Quiénes esperan en una casilla `enemigo`: "2 lobos de ojos brillantes y el lobo viejo · llega 1 más en el turno 4". */
export function foesText(enc) {
  const def = ENCOUNTERS[enc];
  if (!def) return '';
  const count = {};
  for (const t of def.enemies) count[t] = (count[t] || 0) + 1;
  const names = Object.entries(count).map(([t, n]) => {
    const nm = (ENEMIES[t]?.name || t).toLowerCase();
    return n === 1 ? (ENEMIES[t]?.boss ? nm : 'un ' + nm) : n + ' ' + pluralName(nm);
  });
  const list = names.length > 1 ? names.slice(0, -1).join(', ') + ' y ' + names[names.length - 1] : names[0];
  const more = (def.waves || []).reduce((a, w) => a + (w.kinds?.length || 0), 0);
  const obj = def.objective?.type === 'survive' ? ` · hay que aguantar ${def.objective.turns} turnos` : def.objective?.type === 'rescue' ? ' · hay que rescatar a alguien' : '';
  return `${list}${more ? (more === 1 ? ' · llega uno más durante la pelea' : ` · llegan ${more} más durante la pelea`) : ''}${obj}`;
}

export const ICONS = {
  prov: '🍞', morale: 'heart', cargo: '🎒', plano: '📜', find: '🏺', colono: '👪', home: 'home', step: '👣',
  objetivo: '🚩', ...Object.fromEntries(MAT_IDS.map(m => [m, MATERIALS[m].icon])),
};
const I = (k, s = 18) => icon(ICONS[k] || k, s);
const plural = (n, a, b) => `${n} ${n === 1 ? a : b}`;
export const provTxt = (n) => plural(n, 'provisión', 'provisiones');
export function matsHtml(mats, size = 18) {
  return MAT_IDS.filter(m => mats?.[m]).map(m => `<span class="ex-mat">${I(m, size)}${mats[m]}</span>`).join('');
}
export function objectiveText(o) {
  if (!o) return '';
  if (o.type === 'juntar') return OBJECTIVES.juntar.title(o);
  if (o.type === 'aldea') return OBJECTIVES.aldea.title(o);
  return OBJECTIVES.lugar.title(o);
}

const CSS = `
.scene-expedition { position:absolute; inset:0; overflow:hidden; background:var(--rule); user-select:none; -webkit-user-select:none; }
.scene-expedition .ex-stage { position:absolute; inset:0; touch-action:none; }
.scene-expedition .ex-top { position:absolute; z-index:4; top:calc(var(--safe-t) + 8px); left:calc(var(--safe-l) + 8px); right:calc(var(--safe-r) + 8px);
  display:flex; flex-direction:column; gap:6px; pointer-events:none; align-items:center; }
.scene-expedition .ex-top > * { pointer-events:auto; }
.scene-expedition .ex-bar { display:flex; align-items:stretch; gap:6px; width:100%; max-width:560px; }
.scene-expedition .ex-stat { flex:1; min-width:0; display:flex; align-items:center; gap:4px; padding:4px 6px; background:var(--panel); border:var(--line) solid var(--edge);
  border-radius:14px; box-shadow:0 3px 0 var(--shade); transition:background .3s; }
.scene-expedition .ex-stat b { font-size:22px; line-height:1; }
.scene-expedition .ex-stat b small { font-size:14px; color:var(--ink-l); }
.scene-expedition .ex-stat span { display:flex; flex-direction:column; min-width:0; }
.scene-expedition .ex-stat em { font-style:normal; font-size:10px; color:var(--ink-l); font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.scene-expedition .ex-stat.low { background:var(--surface-2); }
.scene-expedition .ex-stat.full { background:var(--gold-l); }
.scene-expedition .ex-stat.bump { animation:exbump .35s; }
.scene-expedition .ex-stat.ex-clock { flex:1.15; }
.scene-expedition .ex-stat.ex-clock.night { background:color-mix(in srgb, var(--panel) 70%, #23305a); }
.scene-expedition .ex-stat.ex-clock.warn em { color:var(--gold-t); }
@keyframes exbump { 40% { transform:scale(1.08); } }
.scene-expedition .ex-menu { flex:none; width:46px; display:grid; place-items:center; padding:0; }
.scene-expedition .ex-goal { display:flex; align-items:center; gap:6px; max-width:560px; width:100%; padding:5px 10px; background:var(--panel); border:2px solid var(--edge);
  border-radius:12px; box-shadow:0 2px 0 var(--shade); font-size:15px; font-weight:700; }
.scene-expedition .ex-goal .t { flex:1; min-width:0; display:flex; flex-direction:column; }
.scene-expedition .ex-goal .t small { font-size:11px; color:var(--ink-l); }
.scene-expedition .ex-goal.done { background:var(--mint-l); }
.scene-expedition .ex-goal .extra { display:flex; gap:6px; font-size:15px; }
.scene-expedition .ex-mat { display:inline-flex; align-items:center; gap:2px; font-weight:700; }
.scene-expedition .ex-bottom { position:absolute; z-index:4; left:0; right:0; bottom:calc(var(--safe-b) + 12px); display:flex; flex-direction:column; align-items:center; gap:8px;
  pointer-events:none; padding:0 calc(var(--safe-r) + 10px) 0 calc(var(--safe-l) + 10px); }
.scene-expedition .ex-bottom > * { pointer-events:auto; }
.scene-expedition .ex-hint { max-width:min(92vw, 520px); padding:6px 12px; font-size:14px; font-weight:700; text-align:center; background:var(--panel); border:2px solid var(--edge);
  border-radius:12px; box-shadow:0 2px 0 var(--shade); transition:opacity .3s; pointer-events:none; }
.scene-expedition .ex-hint.gone { opacity:0; }
.scene-expedition .ex-row { display:flex; gap:8px; align-items:center; flex-wrap:wrap; justify-content:center; }
.scene-expedition .ex-home { min-height:56px; font-size:20px; padding:8px 22px; --bg:var(--second); --bg-d:var(--second-d); }
.scene-expedition .ex-home.danger { --bg:var(--coral); --bg-d:#d24d4d; }
.scene-expedition .ex-home small { font-size:14px; opacity:.9; }
.scene-expedition .ex-item { min-height:48px; padding:6px 12px; font-size:15px; }
.scene-expedition .ex-chips { position:absolute; inset:0; z-index:3; pointer-events:none; }
.scene-expedition .ex-chip { position:absolute; transform:translate(-50%, -50%); display:flex; align-items:center; gap:1px; min-width:38px; min-height:30px;
  justify-content:center; padding:1px 6px; border:2px solid var(--edge); border-radius:10px; background:var(--surface); box-shadow:0 2px 0 var(--shade);
  font:inherit; font-size:17px; font-weight:700; color:var(--ink); pointer-events:auto; cursor:pointer; }
.scene-expedition .ex-chip:active { transform:translate(-50%, -46%); box-shadow:0 1px 0 var(--shade); }
.scene-expedition .ex-chip.unsafe { background:#522b23; }
.scene-expedition .ex-chip.unsafe::after { content:'sin vuelta'; position:absolute; top:100%; left:50%; transform:translate(-50%, 2px); font-size:11px; white-space:nowrap;
  background:var(--coral); color:#fff; border:2px solid var(--edge); border-radius:8px; padding:0 5px; }
.scene-expedition .ex-chip.cant { background:var(--rule); color:var(--ink-l); opacity:.8; }
.scene-expedition .ex-chip.hz { background:var(--gold-l); }
.scene-expedition .ex-chip.hidden { display:none; }
.scene-expedition .ex-sheet { position:absolute; z-index:6; left:0; right:0; bottom:0; display:flex; justify-content:center; pointer-events:none;
  padding:0 calc(var(--safe-r) + 8px) calc(var(--safe-b) + 8px) calc(var(--safe-l) + 8px); }
.scene-expedition .ex-card { pointer-events:auto; width:100%; max-width:520px; background:var(--panel); border:var(--line) solid var(--edge); border-radius:20px;
  box-shadow:0 5px 0 var(--shade), 0 10px 30px rgba(8, 6, 5,.25); padding:12px; display:flex; flex-direction:column; gap:8px;
  transform:translateY(120%); transition:transform .28s cubic-bezier(.3,1.25,.6,1); max-height:72vh; overflow-y:auto; }
.scene-expedition .ex-card.in { transform:none; }
.scene-expedition .ex-card header { display:flex; align-items:center; gap:10px; }
.scene-expedition .ex-card header b { font-size:22px; line-height:1.1; display:block; }
.scene-expedition .ex-card header p { margin:2px 0 0; font-size:14px; color:var(--ink-l); }
.scene-expedition .ex-foes { display:flex; flex-direction:column; gap:3px; font-size:14px; color:var(--ink-l); margin:2px 0 4px; }
.scene-expedition .ex-foes span { display:flex; align-items:center; gap:6px; }
.scene-expedition .ex-foes .bad { color:#b5483f; font-weight:700; }
.scene-expedition .ex-opt { display:flex; align-items:center; gap:10px; width:100%; text-align:left; padding:8px 10px; background:var(--surface); border:var(--line) solid var(--edge);
  border-radius:14px; box-shadow:0 3px 0 var(--shade); font:inherit; color:inherit; cursor:pointer; }
.scene-expedition .ex-opt:active:not(:disabled) { transform:translateY(2px); box-shadow:0 1px 0 var(--shade); }
.scene-expedition .ex-opt:disabled { opacity:.55; cursor:default; }
.scene-expedition .ex-opt .k { flex:none; width:24px; height:24px; display:grid; place-items:center; font-size:13px; border:2px solid var(--edge); border-radius:7px; color:var(--ink-l); }
.scene-expedition .ex-opt .m { flex:1; min-width:0; display:flex; flex-direction:column; gap:1px; }
.scene-expedition .ex-opt .m b { font-size:19px; }
.scene-expedition .ex-opt .m span { font-size:13px; color:var(--ink-l); font-weight:700; display:flex; flex-wrap:wrap; gap:1px 10px; align-items:center; }
.scene-expedition .ex-opt .m span i { font-style:normal; display:inline-flex; align-items:center; gap:2px; }
.scene-expedition .ex-opt .m span.bad { color:#b5483f; }
.scene-expedition .ex-opt .m span.good { color:#2d8a6a; }
.scene-expedition .ex-opt .m small { font-size:11px; color:var(--ink-ll); }
.scene-expedition .ex-opt .p { flex:none; min-width:64px; text-align:center; font-size:28px; font-weight:700; line-height:1; }
.scene-expedition .ex-opt .p small { display:block; font-size:12px; color:var(--ink-l); }
.scene-expedition .ex-opt.sure .p { font-size:18px; color:#2d8a6a; }
.scene-expedition .ex-opt.fight .p { font-size:18px; color:var(--primary-t); }
.scene-expedition .ex-opt.risky .p { color:var(--primary-t); }
.scene-expedition .ex-back { align-self:center; }
.scene-expedition .ex-modal { position:absolute; inset:0; z-index:8; display:grid; place-items:center; background:rgba(8, 6, 5,.35); padding:16px; }
.scene-expedition .ex-modal .ex-card { transform:none; max-width:440px; max-height:90vh; align-items:stretch; text-align:center; animation:expop .3s cubic-bezier(.3,1.3,.6,1); }
@keyframes expop { from { transform:scale(.85); opacity:0; } }
.scene-expedition .ex-modal h2 { margin:0; font-size:28px; }
.scene-expedition .ex-modal p { margin:0; font-size:15px; color:var(--ink-l); }
.scene-expedition .ex-stars { display:flex; justify-content:center; gap:10px; }
.scene-expedition .ex-star { display:flex; flex-direction:column; align-items:center; gap:2px; font-size:12px; font-weight:700; color:var(--ink-l); width:84px; }
.scene-expedition .ex-star img { width:44px; height:44px; filter:grayscale(1) opacity(.35); }
.scene-expedition .ex-star.on img { filter:none; animation:exstar .45s cubic-bezier(.3,1.6,.6,1) backwards; }
.scene-expedition .ex-star.on { color:var(--ink); }
@keyframes exstar { from { transform:scale(0) rotate(-40deg); } }
.scene-expedition .ex-loot { display:flex; flex-wrap:wrap; justify-content:center; gap:8px 14px; padding:10px; background:var(--surface); border:2px solid var(--edge); border-radius:12px; font-size:20px; }
.scene-expedition .ex-loot .none { font-size:15px; color:var(--ink-l); }
.scene-expedition .ex-btns { display:flex; flex-direction:column; gap:8px; }
.scene-expedition .ex-note { font-size:12px !important; color:var(--ink-ll) !important; }
@media (min-width: 900px) {
  .scene-expedition .ex-sheet { justify-content:flex-end; align-items:flex-end; padding-right:calc(var(--safe-r) + 16px); padding-bottom:calc(var(--safe-b) + 16px); }
  .scene-expedition .ex-card { width:440px; }
  .scene-expedition .ex-bottom { align-items:flex-start; padding-left:16px; }
}
`;

export function injectStyle() {
  const el = document.createElement('style');
  el.id = 'expedition-style';
  el.textContent = CSS;
  document.head.append(el);
  return el;
}

/** Arma el DOM fijo de la escena. handlers: { onHome, onMenu, onItem(id), onChip(x,y) } */
export function buildDom(root, handlers) {
  root.innerHTML = `
    <div class="ex-stage"></div>
    <div class="ex-chips"></div>
    <div class="ex-top">
      <div class="ex-bar">
        <button class="ex-stat ex-menu icon-btn" data-ex="menu" aria-label="Menú">${icon('pause', 22)}</button>
        <div class="ex-stat" data-ex="prov" data-tip-title="Provisiones" data-tip="Cada paso gasta según el terreno. Guardá lo que cuesta volver: si no alcanza, el grupo llega con la mitad de la carga.">${I('prov', 22)}<span><b>0</b><em>provisiones</em></span></div>
        <div class="ex-stat" data-ex="morale" data-tip-title="Ánimo" data-tip="Baja con los peligros. Si llega a cero, el grupo vuelve con la mitad de la carga. Un campamento lo recupera.">${I('morale', 22)}<span><b>0</b><em>ánimo</em></span></div>
 <div class="ex-stat ex-clock" data-ex="clock" data-tip-title="Hora y clima" data-tip=""><i class="exc-ic" style="display:contents">${icon('☀️', 22)}</i><span><b>06:00</b><em>despejado</em></span></div>
        <div class="ex-stat" data-ex="cargo" data-tip-title="Carga" data-tip="Lo que traés: materiales, planos y hallazgos. El Establo suma lugar. Volver con la carga llena da una estrella.">${I('cargo', 22)}<span><b>0</b><em>carga</em></span></div>
      </div>
      <div class="ex-goal" data-ex="goal"></div>
    </div>
    <div class="ex-bottom">
      <div class="ex-hint gone" data-ex="hint"></div>
      <div class="ex-row" data-ex="items"></div>
      <button class="btn ex-home" data-ex="home"></button>
    </div>
    <div class="ex-sheet" data-ex="sheet"></div>`;
  const $ = (k) => root.querySelector(`[data-ex="${k}"]`);
  $('home').onclick = () => handlers.onHome();
  $('menu').onclick = () => handlers.onMenu();
  const chips = root.querySelector('.ex-chips');
  const chipEls = [];
  let last = {};

  // hora y clima (PLAN-QUIEBRE §J3–J4): lo que pesa ahora y lo que viene, nunca de sorpresa
  function clock(c) {
    const e = $('clock');
    if (!c) { e.hidden = true; return; }
    const W = WEATHER[c.weather] || WEATHER.despejado;
    const ic = c.weather !== 'despejado' ? W.icon : c.night ? '🌙' : c.hour < 8 ? '🌅' : c.hour >= 18 ? '🌇' : '☀️';
    const f = c.forecast;
    const sub = c.weather !== 'despejado' ? `${W.name.toLowerCase()}${f?.left ? ` · ${f.left} ${f.left === 1 ? 'paso' : 'pasos'}` : ''}`
      : f && f.in > 0 && f.in <= 4 ? `${WEATHER[f.kind].name.toLowerCase()} en ${f.in}`
        : c.night ? (c.farol ? 'noche · farol' : 'noche · visión −1') : c.nightIn != null && c.nightIn <= 3 ? `noche en ${c.nightIn}` : 'despejado';
    e.querySelector('b').textContent = c.hourText;
    e.querySelector('em').textContent = sub;
    const box = e.querySelector('.exc-ic');
    if (box.dataset.ic !== ic) { box.dataset.ic = ic; box.innerHTML = icon(ic, 22); }
    e.classList.toggle('night', !!c.night);
    e.classList.toggle('warn', !!(c.vision < 0 || c.step > 0 || (f && f.in > 0 && f.in <= 2)));
    const tip = [...c.why];
    if (f && f.in > 0) tip.push(`Se viene ${WEATHER[f.kind].name.toLowerCase()} en ${f.in} ${f.in === 1 ? 'paso' : 'pasos'} y dura ${f.len}. ${WEATHER[f.kind].exp?.text || 'No cambia el camino.'}`);
    if (!c.night && c.nightIn != null) tip.push(`Cada paso es una hora. Se hace de noche en ${c.nightIn} ${c.nightIn === 1 ? 'paso' : 'pasos'}: visión −1${c.farol ? ', pero llevás el Farol' : ' si no llevás el Farol'}.`);
    e.dataset.tip = tip.join(' ') || 'Despejado.';
  }

  function bump(k) { const e = $(k); e.classList.remove('bump'); void e.offsetWidth; e.classList.add('bump'); }

  return {
    $,
    /** Refresca barra, objetivo, botón Volver y objetos. */
    update(v, meta) {
      const st = (k, html, cls = {}) => {
        const e = $(k);
        e.querySelector('b').innerHTML = html;
        for (const [c, on] of Object.entries(cls)) e.classList.toggle(c, !!on);
      };
      st('prov', `${v.prov}`, { low: v.prov < v.returnCost + 2 && !v.ended });
      st('morale', `${v.morale}<small>/${v.moraleMax}</small>`, { low: v.morale <= 3 });
      st('cargo', `${v.cargoN}<small>/${v.cargoMax}</small>`, { full: v.cargoN >= v.cargoMax });
      clock(v.cond);
      for (const k of ['prov', 'morale', 'cargo']) {
        const val = k === 'prov' ? v.prov : k === 'morale' ? v.morale : v.cargoN;
        if (last[k] !== undefined && last[k] !== val) bump(k);
        last[k] = val;
      }
      const g = $('goal');
      const o = v.objective;
      const have = o.type === 'juntar' ? ` · ${v.cargo[o.mat] || 0}/${o.n}` : '';
      const extra = [v.planos ? `<span class="ex-mat">${I('plano', 18)}${v.planos}</span>` : '', v.finds.length ? `<span class="ex-mat">${I('find', 18)}${v.finds.length}</span>` : '', v.colonos ? `<span class="ex-mat">${I('colono', 18)}${v.colonos}</span>` : ''].join('');
      g.innerHTML = `${o.done ? icon('check', 22) : I(o.type === 'juntar' ? o.mat : 'objetivo', 22)}<span class="t"><span>${esc(objectiveText(o))}${have}</span><small>${esc(meta.regionName)} · zona ${meta.zone} · ${meta.daily ? 'Expedición del día' : meta.kind === 'corta' ? 'salida corta' : 'salida'}</small></span><span class="extra">${extra}</span>`;
      g.classList.toggle('done', !!o.done);
      const hb = $('home');
      const atBase = v.pos[0] === v.base[0] && v.pos[1] === v.base[1];
      hb.classList.toggle('danger', !v.canReturn);
      hb.innerHTML = atBase ? `${icon('home', 24)} Terminar la salida`
        : v.canReturn ? `${icon('home', 24)} Volver · ${provTxt(v.returnCost)}`
          : `${icon('home', 24)} Volver <small>· faltan ${v.returnCost - v.prov}</small>`;
      hb.disabled = v.ended;
      // objetos y cosas que no entraron en la carga
      const it = $('items');
      it.innerHTML = '';
      for (const id of v.items) {
        const b = document.createElement('button');
        b.className = 'btn mint ex-item';
        b.innerHTML = id === 'botiquin' ? `${icon('🩹', 18)} Botiquín +${EXP.botiquin}` : `${icon('🩹', 18)} Atender +${EXP.atender}`;
        b.onclick = () => handlers.onItem(id);
        it.append(b);
      }
      const here = v.cells[v.pos[1] * v.w + v.pos[0]];
      if (here?.drops && v.cargoN >= v.cargoMax) {
        for (const m of MAT_IDS.filter(m => v.cargo[m] > 0 && !here.drops[m])) {
          const b = document.createElement('button');
          b.className = 'btn ghost ex-item';
          b.innerHTML = `Soltar 1 ${I(m, 18)}`;
          b.title = `Soltar 1 de ${MATERIALS[m].name} para llevar lo de acá`;
          b.onclick = () => handlers.onItem('soltar:' + m);
          it.append(b);
        }
      }
    },
    hint(text, ms = 0) {
      const e = $('hint');
      clearTimeout(this._ht);
      if (!text) { e.classList.add('gone'); return; }
      e.innerHTML = text; e.classList.remove('gone');
      if (ms) this._ht = setTimeout(() => e.classList.add('gone'), ms);
    },
    /** Rótulos de costo sobre las vecinas: list = [{x,y,sx,sy,cost,ok,safe,hz}] */
    chips(list) {
      while (chipEls.length < list.length) {
        const b = document.createElement('button');
        b.className = 'ex-chip';
        b.onclick = (e) => { e.stopPropagation(); if (b._xy) handlers.onChip(...b._xy); };
        chips.append(b); chipEls.push(b);
      }
      chipEls.forEach((b, i) => {
        const c = list[i];
        if (!c) { b.classList.add('hidden'); b._xy = null; return; }
        b.classList.remove('hidden');
        b._xy = [c.x, c.y];
        const key = `${c.cost}|${c.ok}|${c.safe}|${c.hz}`;
        if (b._key !== key) {
          b._key = key;
          b.innerHTML = `${c.cost}${I('prov', 15)}`;
          b.className = 'ex-chip' + (!c.ok ? ' cant' : !c.safe ? ' unsafe' : c.hz ? ' hz' : '');
          b.setAttribute('aria-label', `Avanzar: ${provTxt(c.cost)}${c.safe ? '' : ', sin vuelta'}`);
        }
        b.style.left = c.sx + 'px'; b.style.top = c.sy + 'px';
      });
    },
    clearChips() { this.chips([]); },
  };
}

// ---------------------------------------------------------------- decisión
function fxLine(fx, run) {
  if (!fx) return '';
  const out = [];
  if (fx.morale) out.push(`${fx.morale > 0 ? '+' : '−'}${Math.abs(fx.morale)} ${I('morale', 13)}`);
  if (fx.prov) out.push(`${fx.prov > 0 ? '+' : '−'}${provTxt(Math.abs(fx.prov))}`);
  if (fx.loseMat) out.push('el agua se lleva 1 material');
  if (fx.mats) out.push(`+${matsHtml(fx.mats, 13)}`);
  if (fx.loot === 'full') out.push(`2 materiales · ${I('find', 13)} ${Math.round(EXP.ruinFind * 100)}% · ${I('plano', 13)} ${Math.round(EXP.ruinPlano[ringOf(run.depth)] * 100)}%`);
  if (fx.loot === 'small') out.push(`1 material · ${I('find', 13)} ${Math.round(EXP.ruinSmallFind * 100)}%`);
  if (fx.colonos) out.push(`+${fx.colonos} ${I('colono', 13)} gente para la ciudad`);
  if (fx.reveal) out.push(fx.reveal === 'area' ? 'te cuentan qué hay cerca' : 'te dicen dónde queda el objetivo');
  if (fx.give) out.push(`a cambio de ${fx.give} materiales`);
  return out.map(t => `<i>${t}</i>`).join('');
}

/**
 * Hoja de decisión. pending: run.pending (del motor); onChoose(optionId). Devuelve { close, choose(i) }.
 * Muestra el % grande, lo que cuesta, qué pasa si sale mal y de dónde sale el número.
 */
export function openDecision(root, pending, ctxInfo, onChoose) {
  const sheet = root.querySelector('[data-ex="sheet"]');
  sheet.innerHTML = '';
  const card = document.createElement('div');
  card.className = 'ex-card';
  card.setAttribute('role', 'dialog');
  let title, text, ic;
  if (pending.kind === 'peligro' || pending.kind === 'ruina') {
    const hz = HAZARDS[pending.hazard];
    title = hz.name; text = hz.text; ic = hz.icon;
  } else if (pending.kind === 'enemigo') {
    const def = ENCOUNTERS[pending.encounter];
    title = def?.name || CONTENT.enemigo.name; text = def?.text || CONTENT.enemigo.text; ic = CONTENT.enemigo.icon;
  } else if (pending.kind === 'campamento') {
    title = CONTENT.campamento.name; text = CONTENT.campamento.text; ic = CONTENT.campamento.icon;
  } else {
    title = pending.free ? 'La aldea perdida' : CONTENT.aldea.name;
    text = pending.free ? 'Llegaron. Se suman 2 personas y te dejan elegir una cosa más.' : CONTENT.aldea.text;
    ic = CONTENT.aldea.icon;
  }
  card.innerHTML = `<header>${icon(ic, 44)}<div><b>${esc(title)}</b><p>${esc(text)}</p></div></header>`;
  if (pending.kind === 'enemigo') {
    // quiénes esperan y quiénes pelean (con la escolta de la ciudad si el grupo es chico)
    const fp = ctxInfo.fightParty || [], own = ctxInfo.party || [];
    const who = ['Quien lidera', ...fp.map(r => (ROLES[r]?.name || r) + (own.includes(r) ? '' : ' (escolta)'))].join(', ');
    const tired = pending.options.find(o => o.fight)?.tired;
    card.insertAdjacentHTML('beforeend', `<div class="ex-foes"><span>${icon('⚔️', 16)} ${esc(foesText(pending.encounter))}.</span>
      <span>${icon('people', 16)} Pelean: ${esc(who)}.</span>${tired ? `<span class="bad">${I('morale', 14)} Con el ánimo tan bajo llegan cansados: ${EXP.enemy.tiredHp} de vida menos cada uno.</span>` : ''}</div>`);
  }
  const btns = [];
  pending.options.forEach((o, i) => {
    const b = document.createElement('button');
    b.className = 'ex-opt ' + (o.fight || o.quick ? 'fight' : o.sure ? 'sure' : 'risky');
    const lines = [];
    const stepTxt = pending.at === 'enter' ? pending.step : 0;
    const cost = stepTxt + (o.prov || 0);
    if (pending.at === 'enter') lines.push(`<span>Cuesta ${provTxt(cost)}${o.prov ? ` (${stepTxt} del paso + ${o.prov})` : ''}${o.mats ? ` y ${matsHtml(o.mats, 13)}` : ''}</span>`);
    const okL = fxLine(o.ok, ctxInfo);
    if (okL) lines.push(`<span class="good">${o.sure ? '' : 'Si sale bien: '}${okL}</span>`);
    const failL = fxLine(o.fail, ctxInfo);
    if (failL) lines.push(`<span class="bad">Si sale mal: ${failL}</span>`);
    if (!o.can && o.why) lines.push(`<span class="bad">${esc(o.why)}</span>`);
    if (!o.sure && o.detail) lines.push(`<small>${esc(o.detail)}</small>`);
    if (o.fight) {
      lines.push(`<span class="good">Si ganan: hasta ${matsHtml(o.win.mats, 13)} y el paso queda libre</span>`);
      lines.push(`<span class="bad">Si pierden: −${-o.lose.morale} ${I('morale', 13)} y vuelven a la casilla anterior. Retirarse: −${-o.retreat.morale} ${I('morale', 13)}</span>`);
    } else if (o.quick && o.can) lines.push('<small>Ya la ganaron: se resuelve sin jugarla, con menos botín.</small>');
    const pCol = pending.at !== 'enter' ? '' : o.fight || o.quick ? `<span class="p">${o.fight ? 'Pelea' : 'Rápido'}<small>${o.fight ? 'por turnos' : '1 estrella'}</small></span>`
      : `<span class="p">${o.sure ? 'Seguro' : `${o.p}%`}${o.sure ? '' : '<small>sale bien</small>'}</span>`;
    b.innerHTML = `<i class="k">${i + 1}</i><span class="m"><b>${esc(o.label)}</b>${lines.join('')}</span>${pCol}`;
    b.disabled = !o.can;
    b.onclick = () => onChoose(o.id);
    card.append(b);
    btns.push(b);
  });
  if (pending.at === 'enter') {
    const back = document.createElement('button');
    back.className = 'btn ghost small ex-back';
    back.innerHTML = `${icon('back', 16)} Retroceder (gratis)`;
    back.onclick = () => onChoose('retroceder');
    card.append(back);
  }
  sheet.append(card);
  requestAnimationFrame(() => card.classList.add('in'));
  return {
    el: card,
    close() { card.classList.remove('in'); setTimeout(() => card.remove(), 300); },
    choose(i) { const o = pending.options[i]; if (o && o.can) onChoose(o.id); },
  };
}

// ---------------------------------------------------------------- modales propios (resultado y menú)
function modalBox(root, html) {
  const wrap = document.createElement('div');
  wrap.className = 'ex-modal';
  wrap.innerHTML = `<div class="ex-card" role="dialog">${html}</div>`;
  root.append(wrap);
  return wrap;
}

/** "5 de madera, 1 de hierbas, un hallazgo y 2 personas que se suman a la ciudad" */
function lootWords(L) {
  const out = MAT_IDS.filter(m => L.mats[m]).map(m => `${L.mats[m]} de ${MATERIALS[m].name}`);
  if (L.planos) out.push(L.planos === 1 ? 'un plano' : `${L.planos} planos`);
  if (L.finds.length) out.push(L.finds.length === 1 ? 'un hallazgo' : `${L.finds.length} hallazgos`);
  if (L.colonos) out.push(`${L.colonos === 1 ? '1 persona que se suma' : `${L.colonos} personas que se suman`} a la ciudad`);
  return out.length > 1 ? out.slice(0, -1).join(', ') + ' y ' + out.at(-1) : out[0] || '';
}

/** Resultado final. res: result(run); info: { kind, regionName, zone, provLeft }. buttons: [{id, label, cls}] */
/** Lo que la salida cambió en la ciudad: zona explorada, región completa y cuánto falta para ampliar el terreno. */
function cityLines(res) {
  const out = [];
  if (res.zoneExplored) out.push(`${icon('🚩', 16)} La zona ${res.zone} de ${esc(res.regionName || '')} quedó explorada.`);
  if (res.regionDone) out.push(`${icon('star', 16)} ${esc(res.regionName || 'La región')}: las 5 zonas exploradas.`);
  if (res.recorrido) out.push('Recorrido por una región ya explorada: no avanza zonas.');
  if (res.zoneExplored || res.canExpand) {
    if (res.canExpand) out.push(`${icon('map', 16)} Ya se puede ampliar el terreno (desde la Municipalidad).`);
    else if (res.missingZones > 0) out.push(`${icon('map', 16)} ${res.missingZones === 1 ? 'Falta 1 zona' : `Faltan ${res.missingZones} zonas`} para ampliar el terreno.`);
  }
  if (res.daily) {
    const g = res.daily.prize?.gems || 0;
    out.push(`${icon('trophy', 16)} Expedición del día: <b>${res.daily.score}</b> de botín para el ranking de tus contactos${g ? ` · premio por participar: ${icon('gem', 14)} ${g}` : ''}.`);
  }
  out.push('<span class="ex-note">Lo que trajeron ya está en la ciudad.</span>');
  return out.map(t => `<p>${t}</p>`).join('');
}
export function openResult(root, res, info, onAction) {
  const reasonTitle = {
    volvio: res.starCount === 3 ? 'Salida completa' : res.objectiveDone ? 'Objetivo cumplido' : 'Volvieron todos',
    sin_provisiones: 'Sin provisiones para volver',
    sin_animo: 'Sin ánimo para seguir',
  }[res.reason] || 'Volvieron';
  const sub = res.reason === 'volvio'
    ? (res.objectiveDone ? `${esc(info.regionName)}, zona ${info.zone}.` : 'Esta vez no llegaron al objetivo.')
    : res.reason === 'sin_animo' ? 'El grupo pegó la vuelta antes de tiempo. Volvieron con la mitad de la carga; nada grave.'
      : 'Se quedaron sin provisiones a mitad de camino. Volvieron con la mitad de la carga; nada grave.';
  const labels = ['Objetivo', 'Carga llena', 'Todos bien'];
  const stars = res.stars.map((on, i) => `<div class="ex-star${on ? ' on' : ''}" style="animation-delay:${0.15 + i * 0.25}s">${icon('star', 44)}<span>${labels[i]}</span></div>`).join('');
  const L = res.loot;
  const items = [matsHtml(L.mats, 24), L.planos ? `<span class="ex-mat">${I('plano', 24)}${L.planos}</span>` : '',
    ...L.finds.map(f => `<span class="ex-mat">${I('find', 24)}<small>${'★'.repeat(f.stars)}</small></span>`),
    L.colonos ? `<span class="ex-mat">${I('colono', 24)}${L.colonos}</span>` : ''].join('');
  const back = info.city ? res.provBack || 0 : res.provLeft;
  const left = info.kind === 'corta' ? '' : res.reason === 'volvio' && back ? `<p>${back === 1 ? 'Sobró 1 provisión: vuelve' : `Sobraron ${back} provisiones: vuelven`} al depósito.</p>` : '';
  const extra = res.starCount === 3 ? `<p>${icon('gem', 16)} +${res.gems || 1} gema por las 3 estrellas${res.chest ? ' y un cofre de madera' : ''}.</p>` : '';
  const html = `<h2>${esc(reasonTitle)}</h2><p>${sub}</p><div class="ex-stars">${stars}</div>
    <b>Lo que trajeron</b><div class="ex-loot">${items || '<span class="none">Nada esta vez</span>'}</div>${lootWords(L) ? `<p>${lootWords(L)}</p>` : ''}${left}${extra}
    ${info.city ? cityLines(res) : '<p class="ex-note">Salida de práctica: lo que trajeron no llega a la ciudad.</p>'}
    <div class="ex-btns">${info.city ? `
      <button class="btn primary" data-a="city">${icon('home', 20)} A la ciudad</button>
      <button class="btn second" data-a="again">${icon('map', 20)} Preparar otra salida</button>` : `
      <button class="btn primary" data-a="again">${icon('map', 20)} Otra salida</button>
      <button class="btn second" data-a="short">${icon('🥪', 20)} Salida corta</button>
      <button class="btn ghost" data-a="city">${icon('home', 20)} A la ciudad</button>`}
    </div>`;
  const w = modalBox(root, html);
  w.querySelectorAll('[data-a]').forEach(b => { b.onclick = () => onAction(b.dataset.a); });
  return { el: w, close() { w.remove(); } };
}

export function openMenu(root, v, onAction) {
  const html = `<h2>Expedición</h2><p>La salida queda guardada: podés seguirla después.</p>
    <div class="ex-btns">
      <button class="btn mint" data-a="resume">${icon('play', 20)} Seguir explorando</button>
      <button class="btn second" data-a="home"${v.ended ? ' disabled' : ''}>${icon('home', 20)} ${v.canReturn ? `Volver · ${provTxt(v.returnCost)}` : `Volver (faltan ${v.returnCost - v.prov})`}</button>
      <button class="btn ghost" data-a="city">${icon('back', 20)} Dejar para después</button>
    </div>`;
  const w = modalBox(root, html);
  w.addEventListener('click', (e) => { if (e.target === w) onAction('resume'); });
  w.querySelectorAll('[data-a]').forEach(b => { b.onclick = () => onAction(b.dataset.a); });
  return { el: w, close() { w.remove(); } };
}

/** Confirmación al volver sin provisiones suficientes (es fracaso). */
export function openConfirmFail(root, v, onAction) {
  const html = `<h2>No alcanza para volver</h2><p>El regreso cuesta ${provTxt(v.returnCost)} y ${v.prov === 1 ? "queda 1" : `quedan ${v.prov}`}. Si vuelven igual, traen la mitad de la carga.</p>
    <div class="ex-btns">
      <button class="btn primary" data-a="go">Volver igual</button>
      <button class="btn ghost" data-a="cancel">Mejor no</button>
    </div>`;
  const w = modalBox(root, html);
  w.querySelectorAll('[data-a]').forEach(b => { b.onclick = () => onAction(b.dataset.a); });
  return { el: w, close() { w.remove(); } };
}

export { REGIONS };
