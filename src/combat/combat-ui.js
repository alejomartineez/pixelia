// Combate: interfaz DOM (DESIGN-COMBAT.md §11). Arriba, el encuentro, el objetivo y los desafíos; a la izquierda, el orden
// del turno; abajo, la ficha de la unidad elegida y la barra de acciones con atajos (1 a 9, Espacio, Tab, Esc); a la
// derecha, la ficha de lo que está bajo el mouse. Sobre el campo: la vida de cada unidad, el daño de las casillas marcadas
// y la vista previa del golpe. También el menú, la confirmación del fin de turno y la pantalla de resultado.
// No toca three.js: la escena le pasa la vista del motor (view) y dónde caen las cosas en la pantalla.
// Usa solo los tokens de la interfaz oscura (styles.css, plan §J6).
import { icon } from '../core/icons.js';
import { esc } from '../core/ui.js';
import { ENEMIES, UNITS, TILES, COMBOS, COMBAT } from './combat-data.js';
import { MATERIALS, MAT_IDS } from '../expedition/exp-data.js';
import { CHARACTERS } from '../story/story-data.js';
import { portrait } from '../story/story-ui.js';

const CSS = `
.scene-combat { position:absolute; inset:0; overflow:hidden; background:var(--page); user-select:none; -webkit-user-select:none; font-family:var(--font); color:var(--ink); }
.scene-combat .cb-stage { position:absolute; inset:0; touch-action:none; }
.scene-combat .cb-layer { position:absolute; inset:0; pointer-events:none; z-index:2; }
.scene-combat .cb-panel { background:var(--panel); border:2px solid var(--edge); border-radius:var(--radius); box-shadow:0 0 0 2px var(--metal) inset, 0 3px 0 var(--shade); }
.scene-combat .cb-top { position:absolute; z-index:4; top:calc(var(--safe-t) + 10px); left:50%; transform:translateX(-50%); display:flex; gap:8px; align-items:stretch; max-width:calc(100vw - 32px); }
.scene-combat .cb-goal { padding:6px 14px 7px; min-width:280px; display:flex; flex-direction:column; gap:2px; }
.scene-combat .cb-goal .n { font-size:13px; color:var(--gold-t); letter-spacing:.04em; text-transform:uppercase; }
.scene-combat .cb-goal .o { font-size:20px; line-height:1.05; }
.scene-combat .cb-goal .ch { display:flex; gap:10px; flex-wrap:wrap; font-size:14px; color:var(--ink-l); }
.scene-combat .cb-goal .ch span { display:inline-flex; align-items:center; gap:3px; }
.scene-combat .cb-goal .ch .ok { color:var(--mint-t); }
.scene-combat .cb-goal .extra { font-size:14px; color:var(--coral); }
.scene-combat .cb-turn { padding:6px 12px; display:flex; flex-direction:column; align-items:center; justify-content:center; min-width:92px; }
.scene-combat .cb-turn b { font-size:26px; line-height:1; }
.scene-combat .cb-turn small { font-size:13px; color:var(--ink-l); }
.scene-combat .cb-turn.enemy { background:var(--coral-l); }
.scene-combat .cb-menu { width:48px; display:grid; place-items:center; padding:0; cursor:pointer; color:var(--ink); }
.scene-combat .cb-menu:hover { background:var(--surface-hover); }

.scene-combat .cb-order { position:absolute; z-index:4; top:calc(var(--safe-t) + 10px); left:calc(var(--safe-l) + 12px); width:212px; padding:8px; display:flex; flex-direction:column; gap:3px; }
@media (min-width: 1280px) { .scene-combat .cb-order { width:250px; } }
.scene-combat .cb-order h4 { margin:2px 2px 2px; font-size:13px; font-weight:400; color:var(--gold-t); text-transform:uppercase; letter-spacing:.04em; }
.scene-combat .cb-order h4.e { color:var(--coral); margin-top:6px; }
.scene-combat .cb-o { display:flex; align-items:center; gap:6px; padding:3px 6px; border-radius:7px; font-size:16px; border:2px solid transparent; }
.scene-combat .cb-o.ally { cursor:pointer; }
.scene-combat .cb-o.ally:hover { background:var(--surface-hover); }
.scene-combat .cb-o.sel { border-color:var(--gold); background:var(--gold-l); }
.scene-combat .cb-o.done { opacity:.55; }
.scene-combat .cb-o .nm { flex:1; min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.scene-combat .cb-o .hp { font-size:14px; color:var(--ink-l); }
.scene-combat .cb-o .st { font-size:12px; color:var(--ink-ll); }
.scene-combat .cb-o .dot { width:8px; height:8px; border-radius:2px; flex:none; background:var(--second-t); }
.scene-combat .cb-o.enemy .dot { background:var(--coral); }
.scene-combat .cb-o.done .dot { background:var(--metal); }

.scene-combat .cb-bottom { position:absolute; z-index:4; left:0; right:0; bottom:calc(var(--safe-b) + 12px); display:flex; justify-content:center; align-items:flex-end; gap:10px; pointer-events:none; padding:0 12px; }
.scene-combat .cb-bottom > * { pointer-events:auto; }
.scene-combat .cb-card { width:250px; padding:8px 10px 9px; display:flex; flex-direction:column; gap:4px; font-size:15px; }
.scene-combat .cb-card .hd { display:flex; align-items:baseline; gap:6px; }
.scene-combat .cb-card .hd b { font-size:20px; line-height:1; flex:1; }
.scene-combat .cb-card .hd small { color:var(--ink-l); font-size:13px; }
.scene-combat .cb-card .bar { height:9px; background:var(--track); border:2px solid var(--edge); border-radius:4px; overflow:hidden; }
.scene-combat .cb-card .bar i { display:block; height:100%; background:var(--mint); }
.scene-combat .cb-card.enemy .bar i { background:var(--coral); }
.scene-combat .cb-card .nums { display:flex; gap:12px; color:var(--ink-l); font-size:14px; }
.scene-combat .cb-card .nums b { color:var(--ink); font-weight:400; }
.scene-combat .cb-card .tr { display:flex; flex-wrap:wrap; gap:4px; }
.scene-combat .cb-card .tr span { font-size:13px; padding:0 6px; border-radius:5px; background:var(--surface-2); border:1px solid var(--rule); }
.scene-combat .cb-card .tr span.bad { background:var(--coral-l); border-color:#7a3b36; color:#f2b2aa; }
.scene-combat .cb-card .tr span.good { background:var(--mint-l); border-color:var(--mint-d); color:var(--mint-t); }
.scene-combat .cb-card .tr span.gold { background:var(--gold-l); border-color:var(--gold-d); color:var(--gold-t); }
.scene-combat .cb-card .it { font-size:14px; color:#f2b2aa; }
.scene-combat .cb-card .tx { font-size:13px; color:var(--ink-l); line-height:1.2; }
.scene-combat .cb-hover { position:absolute; z-index:4; right:calc(var(--safe-r) + 12px); top:calc(var(--safe-t) + 10px); }
.scene-combat .cb-hover:empty { display:none; }
.scene-combat .cb-guide { position:absolute; z-index:6; right:calc(var(--safe-r) + 12px); bottom:calc(var(--safe-b) + 128px); width:min(360px, calc(100vw - 24px));
  display:grid; grid-template-columns:56px 1fr; gap:10px; padding:10px 12px; transition:opacity .25s, transform .25s; }
.scene-combat .cb-guide.gone { opacity:0; transform:translateY(8px); pointer-events:none; }
.scene-combat .cb-guide canvas { width:56px; height:56px; image-rendering:pixelated; border:2px solid var(--edge); border-radius:10px; background:var(--bg-d); }
.scene-combat .cb-guide .gw { font-size:15px; color:var(--gold-t); }
.scene-combat .cb-guide .gw small { color:var(--ink-l); }
.scene-combat .cb-guide p { margin:3px 0 6px; font-size:16px; line-height:1.3; }
.scene-combat .cb-guide .gf { display:flex; justify-content:flex-end; }

.scene-combat .cb-bar { display:flex; flex-direction:column; gap:6px; align-items:center; }
.scene-combat .cb-acts { display:flex; gap:6px; padding:6px; flex-wrap:wrap; justify-content:center; max-width:min(640px, calc(100vw - 560px)); min-width:300px; }
.scene-combat .cb-act { position:relative; min-width:86px; min-height:58px; padding:6px 10px 6px 24px; display:flex; flex-direction:column; align-items:flex-start; justify-content:center; gap:1px;
  background:var(--surface-2); color:var(--ink); border:2px solid var(--edge); border-radius:8px; box-shadow:inset 0 -3px 0 var(--track); font:inherit; font-size:16px; cursor:pointer; text-align:left; }
.scene-combat .cb-act:hover:not(:disabled) { background:var(--surface-hover); }
.scene-combat .cb-act.on { background:var(--gold-l); border-color:var(--gold); box-shadow:0 0 0 2px var(--gold-d) inset; }
.scene-combat .cb-act:disabled { opacity:.5; cursor:default; }
.scene-combat .cb-act kbd { position:absolute; left:5px; top:5px; font:inherit; font-size:13px; color:var(--gold-t); }
.scene-combat .cb-act small { font-size:12px; color:var(--ink-l); }
.scene-combat .cb-act.item { background:var(--wood-d); }
.scene-combat .cb-end { min-height:58px; padding:6px 16px; font-size:19px; display:flex; flex-direction:column; align-items:center; line-height:1; }
.scene-combat .cb-end small { font-size:12px; opacity:.85; margin-top:3px; }
.scene-combat .cb-keys { font-size:13px; color:var(--ink-l); background:var(--hud-glass); padding:1px 8px 2px; border-radius:6px; }
.scene-combat .cb-hint { min-height:22px; padding:3px 12px; font-size:16px; text-align:center; transition:opacity .25s; }
.scene-combat .cb-hint.gone { opacity:0; }

.scene-combat .cb-tag { position:absolute; transform:translate(-50%, -100%); display:flex; flex-direction:column; align-items:center; gap:1px; }
.scene-combat .cb-tag .hpb { width:38px; height:6px; background:var(--shade); border:1px solid var(--edge); border-radius:2px; overflow:hidden; }
.scene-combat .cb-tag .hpb i { display:block; height:100%; background:var(--mint); transition:width .25s; }
.scene-combat .cb-tag.enemy .hpb i { background:var(--coral); }
.scene-combat .cb-tag.boss .hpb { width:64px; height:8px; }
.scene-combat .cb-tag .n { font-size:13px; line-height:1; color:var(--ink); text-shadow:0 1px 0 var(--shade), 1px 0 0 var(--shade), -1px 0 0 var(--shade), 0 -1px 0 var(--shade); white-space:nowrap; }
.scene-combat .cb-tag .b { display:flex; gap:2px; }
.scene-combat .cb-tag .b span { font-size:11px; line-height:1; padding:1px 3px; border-radius:3px; background:var(--gold); color:var(--ink-dark); }
.scene-combat .cb-tag .b span.r { background:var(--sky); }
.scene-combat .cb-tag .b span.q { background:var(--metal); color:var(--ink); }
.scene-combat .cb-tag.sel .n { color:var(--gold-t); }
.scene-combat .cb-tag.hit .hpb { animation:cbhit .35s; }
@keyframes cbhit { 30% { transform:scale(1.25); } }
.scene-combat .cb-chip { position:absolute; transform:translate(-50%, -50%); font-size:17px; line-height:1; padding:2px 5px 3px; border-radius:5px; white-space:nowrap; }
.scene-combat .cb-chip.danger { background:#5a1d18; color:#ffd0c8; border:1px solid #ff7a6e; }
.scene-combat .cb-chip.incoming { background:var(--coral-l); color:var(--coral); border:1px dashed var(--coral); font-size:13px; }
.scene-combat .cb-chip.dmg { background:var(--ink); color:#8a1f18; border:2px solid #c94a40; font-size:18px; z-index:2; }
.scene-combat .cb-chip.heal { background:var(--mint); color:var(--ink-dark); border:2px solid var(--mint-d); font-size:18px; z-index:2; }
.hi-contrast .scene-combat .cb-chip.danger { background:#000; color:#fff1c2; border:2px solid #fff1c2; font-size:19px; }
.hi-contrast .scene-combat .cb-tag .n { color:#fff; }

.scene-combat .cb-float { position:absolute; transform:translate(-50%, -50%); font-size:22px; white-space:nowrap; pointer-events:none; animation:cbfloat 1.1s ease-out forwards;
  color:var(--ink); text-shadow:0 2px 0 var(--shade), 2px 0 0 var(--shade), -2px 0 0 var(--shade), 0 -2px 0 var(--shade); }
.scene-combat .cb-float.dmg { color:#ff8a7a; font-size:28px; }
.scene-combat .cb-float.heal { color:var(--mint-t); font-size:26px; }
.scene-combat .cb-float.mark { color:var(--gold-t); }
.scene-combat .cb-float.act { color:var(--sky-t); font-size:19px; }
@keyframes cbfloat { 0% { opacity:0; margin-top:6px; } 15% { opacity:1; } 70% { opacity:1; } 100% { opacity:0; margin-top:-34px; } }

.scene-combat .cb-banner { position:absolute; z-index:5; left:50%; top:30%; transform:translate(-50%, -50%); padding:10px 26px 12px; text-align:center; pointer-events:none;
  opacity:0; transition:opacity .2s, transform .2s; max-width:min(560px, 90vw); }
.scene-combat .cb-banner.show { opacity:1; transform:translate(-50%, -60%); }
.scene-combat .cb-banner b { display:block; font-size:30px; line-height:1.05; }
.scene-combat .cb-banner small { display:block; font-size:16px; color:var(--ink-l); margin-top:4px; }
.scene-combat .cb-banner.enemy b { color:var(--coral); }
.scene-combat .cb-banner.boss { background:var(--coral-l); }
.scene-combat .cb-banner.boss b { color:#f2b2aa; }
.scene-combat .cb-banner.combo b, .scene-combat .cb-banner.good b { color:var(--gold-t); }
.scene-combat .cb-banner.water b { color:var(--sky-t); }

.scene-combat .cb-modal { position:absolute; inset:0; z-index:10; display:grid; place-items:center; background:rgba(8,6,5,.62); }
.scene-combat .cb-dlg { width:min(480px, calc(100vw - 32px)); padding:16px 20px 18px; display:flex; flex-direction:column; gap:8px; text-align:center; }
.scene-combat .cb-dlg h2 { margin:0; font-size:32px; font-weight:400; line-height:1.05; }
.scene-combat .cb-dlg h2.win { color:var(--gold-t); }
.scene-combat .cb-dlg h2.lose { color:#f2b2aa; }
.scene-combat .cb-dlg p { margin:0; font-size:17px; color:var(--ink-l); line-height:1.25; }
.scene-combat .cb-dlg .btns { display:flex; flex-direction:column; gap:8px; margin-top:6px; }
.scene-combat .cb-dlg .btns .btn { min-height:50px; font-size:19px; }
.scene-combat .cb-dlg kbd { font:inherit; font-size:13px; opacity:.8; margin-left:6px; }
.scene-combat .cb-stars { display:flex; justify-content:center; gap:16px; margin:4px 0; }
.scene-combat .cb-star { display:flex; flex-direction:column; align-items:center; gap:2px; font-size:13px; color:var(--ink-ll); width:96px; opacity:.45; }
.scene-combat .cb-star.on { opacity:1; color:var(--gold-t); animation:cbstar .45s backwards; }
@keyframes cbstar { 0% { transform:scale(.3); opacity:0; } 70% { transform:scale(1.15); } }
.scene-combat .cb-loot { display:flex; justify-content:center; gap:12px; flex-wrap:wrap; font-size:20px; }
.scene-combat .cb-loot span { display:inline-flex; align-items:center; gap:4px; }
.scene-combat .cb-lesson { background:var(--surface-2); border-radius:8px; padding:6px 10px; font-size:16px; color:var(--ink); }
`;

const plural = (n, a, b) => `${n} ${n === 1 ? a : b}`;
/** Sin Catalejo se ven los golpes de los 3 enemigos más cercanos (y siempre los del jefe): se avisa cuántos faltan. */
function hiddenLine(en) {
  const hid = en.filter(u => u.intent?.hidden).length;
  return hid ? `<div class="cb-o" data-tip="Con el Catalejo se ven los golpes de más enemigos." style="font-size:13px;color:var(--ink-ll)">${plural(hid, 'golpe no se ve', 'golpes no se ven')} desde acá</div>` : '';
}
const unitLabel = (u) => (u.side === 'ally' ? (u.type === 'lider' ? 'Líder' : u.name) : u.name);

/** Rasgos que se ven en la ficha (lo que cambia cómo se juega con esa unidad). */
function traits(u) {
  const out = [];
  if (u.side === 'ally') {
    if (u.captive && !u.freed) out.push(['bad', 'Atado']);
    if (u.stuck) out.push(['bad', 'Trabado: mueve 1 y no apunta lejos']);
    if (u.root) out.push(['bad', 'Frenado']);
    if (u.high) out.push(['good', 'En lo alto: +1 de daño']);
    if (u.acted) out.push(['', 'Ya actuó']);
    else if (u.moved) out.push(['', 'Ya se movió']);
  } else {
    const d = ENEMIES[u.type] || {};
    if (u.armor) out.push(['', `Coraza −${u.armor}`]);
    if (d.nip) out.push(['bad', `Acoso ${d.nip}`]);
    if (u.marked) out.push(['gold', `Marcado +${u.marked}`]);
    if (u.root) out.push(['good', 'Frenado']);
    if (u.heavy) out.push(['', 'No se lo puede empujar']);
    if (u.explode) out.push(['bad', 'Revienta al morir']);
    if (u.high) out.push(['bad', 'En lo alto']);
    if (u.boss) out.push(['bad', `Fase ${u.phase + 1}`]);
  }
  return out;
}
function cardHtml(u) {
  if (!u) return '';
  const role = u.side === 'ally' ? (UNITS[u.type]?.text || '') : (ENEMIES[u.type]?.text || '');
  const pct = Math.max(0, Math.min(100, (u.hp / u.maxHp) * 100));
  let intent = '';
  if (u.side === 'enemy') intent = u.intent?.hidden ? '<div class="it">Su golpe no se ve (el Catalejo muestra más).</div>'
    : u.intent ? `<div class="it">Va a pegar: ${esc(u.intent.name)} · ${u.intent.dmg}</div>` : '<div class="tx">Todavía no marcó su golpe.</div>';
  return `<div class="hd"><b>${esc(unitLabel(u))}</b><small>${u.hp}/${u.maxHp}</small></div>
    <div class="bar"><i style="width:${pct}%"></i></div>
    <div class="nums"><span>Mueve <b>${u.mv}</b></span>${u.atk ? `<span>Ataque <b>${u.atk}</b></span>` : ''}${u.armor ? `<span>Coraza <b>${u.armor}</b></span>` : ''}</div>
    ${intent}
    <div class="tr">${traits(u).map(([c, t]) => `<span class="${c}">${esc(t)}</span>`).join('')}</div>
    ${role ? `<div class="tx">${esc(role)}</div>` : ''}`;
}
function tileHtml(t, b) {
  const def = TILES[t.t] || {};
  const bits = [];
  if (t.t === 'agua') bits.push('Cuesta 2 moverse.');
  if (t.t === 'alto') {
    const lv = b ? (b.ropeItem ? 5 : Math.max(0, Math.min(5, b.tools?.cuerda || 0))) : 0;
    bits.push(`Subir cuesta ${COMBAT.climb[lv]}${lv ? ' (con la Cuerda)' : ''}. Desde acá se pega +1 y se tira más lejos.`);
  }
  if (t.t === 'roca') bits.push('No se pisa. Romper la parte.');
  if (t.t === 'arbol') bits.push('No se pisa.');
  if (t.exit) bits.push('Por acá se sale.');
  if (t.bridge) bits.push('La pasarela del dirigible: se puede cortar a golpes.');
  if (t.flood) bits.push('Inundada: cuesta 1 más y el agua tira.');
  if (t.floodNext) bits.push('El agua sube acá en el próximo turno enemigo.');
  if (t.wall) bits.push(`${t.rootWall ? 'Pared de raíz' : 'Barrera'}: ${plural(t.wall, 'turno', 'turnos')} más.`);
  if (t.trap) bits.push('Trampa: el enemigo que la pisa queda frenado.');
  if (t.incoming) bits.push(`Llega ${esc(ENEMIES[t.incoming]?.name.toLowerCase() || 'alguien')} en el próximo turno enemigo.`);
  const danger = t.danger ? `<div class="it">Marcada: el que esté acá recibe ${t.danger}.</div>` : '';
  return `<div class="hd"><b>${esc(def.name || t.t)}</b></div>${danger}${bits.map(s => `<div class="tx">${s}</div>`).join('')}`;
}

export function buildCombatUi(root, ctx, h) {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.append(style);
  root.classList.add('scene-combat');
  root.innerHTML = `
    <div class="cb-stage"></div>
    <div class="cb-layer"><div class="cb-chips"></div><div class="cb-tags"></div><div class="cb-prev"></div><div class="cb-fx"></div></div>
    <div class="cb-top"><div class="cb-goal cb-panel"></div><div class="cb-turn cb-panel"></div>
      <button class="cb-menu cb-panel" data-tip="Menú: retirarse o ajustes" aria-label="Menú">${icon('gear', 22)}</button></div>
    <div class="cb-order cb-panel"></div>
    <div class="cb-hover"></div>
    <div class="cb-bottom">
      <div class="cb-card cb-sel cb-panel"></div>
      <div class="cb-bar"><div class="cb-hint cb-panel gone"></div><div class="cb-acts cb-panel"></div>
        <div class="cb-keys">Clic: elegir y mover · 1–9: habilidades · Tab: siguiente · Q/E: girar · Esc: menú</div></div>
      <button class="btn second cb-end">Fin de turno<small>Espacio</small></button>
    </div>
    <div class="cb-banner cb-panel"></div>
    <div class="cb-guide cb-panel gone" role="status"></div>`;
  const $ = (s) => root.querySelector(s);
  const goal = $('.cb-goal'), turnEl = $('.cb-turn'), order = $('.cb-order'), selCard = $('.cb-sel'), hoverEl = $('.cb-hover');
  const acts = $('.cb-acts'), hintEl = $('.cb-hint'), endBtn = $('.cb-end'), banner = $('.cb-banner');
  const chipsEl = $('.cb-chips'), tagsEl = $('.cb-tags'), prevEl = $('.cb-prev'), fx = $('.cb-fx');
  $('.cb-menu').onclick = () => h.onMenu();
  endBtn.onclick = () => h.onEnd();
  let barIds = [];
  let last = null;
  const off = () => { const r = root.getBoundingClientRect(); return [r.left, r.top]; };

  function update(v, st) {
    last = { v, st };
    // arriba: encuentro, objetivo, desafíos
    const extra = [];
    if (v.bridge && !v.bridge.cut) extra.push(`Pasarela: ${v.bridge.hp}/${v.bridge.max}`);
    if (v.bridge?.cut) extra.push('Pasarela cortada');
    if (v.incoming.length) extra.push(`Llegan en el próximo turno enemigo: ${v.incoming.map(s => ENEMIES[s.kind]?.name.toLowerCase()).join(', ')}`);
    let objText = v.objective.text;
    const boss = v.units.find(u => u.boss);
    if (boss && v.objective.type === 'defeat') objText = 'Vencé a la ' + (boss.name.startsWith('La ') ? boss.name.slice(3) : boss.name[0].toLowerCase() + boss.name.slice(1));
    goal.innerHTML = `<span class="n">${esc(v.name)}${v.kind === 'jefe' ? ' · jefe' : ''}</span><span class="o">${esc(objText)}</span>
      <span class="ch">${v.challenges.map(c => `<span class="${c.done ? 'ok' : ''}" data-tip="${esc(c.text)}" data-tip-title="Desafío">${icon(c.done ? 'star' : 'starOff', 14)}${esc(c.name)}</span>`).join('')}</span>
      ${extra.length ? `<span class="extra">${esc(extra.join(' · '))}</span>` : ''}`;
    const enemyPhase = v.phase === 'enemy';
    turnEl.classList.toggle('enemy', enemyPhase);
    turnEl.innerHTML = `<small>Turno</small><b>${v.turn}</b><small>de ${v.maxTurns}</small>`;
    turnEl.dataset.tip = `Si se llega al turno ${v.maxTurns}, se hace de noche y hay que replegarse.`;
    // orden del turno
    const al = v.units.filter(u => u.side === 'ally'), en = v.units.filter(u => u.side === 'enemy');
    order.innerHTML = `<h4>${enemyPhase ? 'Ya jugó el grupo' : 'Juega el grupo'}</h4>${al.map(u => {
      const done = u.acted || (u.captive && !u.freed);
      const tag = u.captive && !u.freed ? 'atado' : u.acted ? 'listo' : u.moved ? 'se movió' : '';
      return `<div class="cb-o ally${done ? ' done' : ''}${u.id === st.sel ? ' sel' : ''}" data-id="${u.id}"><i class="dot"></i><span class="nm">${esc(unitLabel(u))}</span><span class="st">${tag}</span><span class="hp">${u.hp}/${u.maxHp}</span></div>`;
    }).join('')}<h4 class="e">${enemyPhase ? 'Juegan los enemigos' : 'Después, en orden'}</h4>${hiddenLine(en)}${en.map(u =>
      `<div class="cb-o enemy" data-hover="${u.id}"><i class="dot"></i><span class="nm">${esc(u.name)}</span><span class="st">${u.intent?.hidden ? '?' : u.intent ? '−' + u.intent.dmg : ''}</span><span class="hp">${u.hp}/${u.maxHp}</span></div>`).join('') || '<div class="cb-o"><span class="nm">Ninguno en pie</span></div>'}`;
    order.querySelectorAll('.cb-o.ally').forEach(el => { el.onclick = () => h.onSelect(el.dataset.id); });
    // ficha de la unidad elegida
    const su = v.units.find(u => u.id === st.sel);
    selCard.innerHTML = su ? cardHtml(su) : '<div class="tx">Elegí a alguien del grupo.</div>';
    // barra de acciones
    const abil = su ? su.abilities : [];
    const order2 = [...abil.filter(a => !a.item), ...abil.filter(a => a.item)];
    barIds = order2.map(a => a.id);
    const canActNow = su && !su.acted && !st.busy && v.phase === 'player' && !v.ended;
    acts.innerHTML = order2.length ? order2.map((a, i) => `<button class="cb-act${a.item ? ' item' : ''}${st.mode === 'ability' && st.ability === a.id ? ' on' : ''}" data-id="${a.id}"
      ${!canActNow || !a.ready ? 'disabled' : ''} data-tip="${esc(a.text || '')}" data-tip-title="${esc(a.name)}"><kbd>${i + 1}</kbd>${esc(a.name)}<small>${a.item ? 'un uso' : a.ready ? 'lista' : `falta${a.cd > 1 ? 'n' : ''} ${a.cd}`}</small></button>`).join('')
      : '<div class="tx" style="padding:10px">Sin acciones</div>';
    acts.querySelectorAll('.cb-act').forEach(b => { b.onclick = () => h.onAbility(b.dataset.id); });
    endBtn.disabled = !v.canEnd || st.busy;
  }

  function unitTags(list) {
    const [ox, oy] = off();
    const keep = new Set();
    for (const u of list) {
      keep.add(u.id);
      let el = tagsEl.querySelector(`[data-id="${u.id}"]`);
      if (!el) { el = document.createElement('div'); el.dataset.id = u.id; tagsEl.append(el); }
      const pct = Math.max(0, Math.min(100, (u.hp / u.maxHp) * 100));
      const badges = [u.marked ? `<span>+${u.marked}</span>` : '', u.root ? '<span class="r">frenado</span>' : '', u.intent?.hidden ? '<span class="q">?</span>' : ''].join('');
      const html = `<span class="n">${u.boss ? esc(u.name) : ''}</span><div class="hpb"><i style="width:${pct}%"></i></div><div class="b">${badges}</div>`;
      if (el.dataset.html !== html) { el.innerHTML = html; el.dataset.html = html; }
      el.className = `cb-tag ${u.side}${u.boss ? ' boss' : ''}${u.sel ? ' sel' : ''}`;
      el.style.left = (u.sx - ox) + 'px'; el.style.top = (u.sy - oy) + 'px';
    }
    for (const el of [...tagsEl.children]) if (!keep.has(el.dataset.id)) el.remove();
  }
  function chips(container, list) {
    const [ox, oy] = off();
    const html = list.map(c => `<div class="cb-chip ${c.cls}" style="left:${Math.round(c.sx - ox)}px;top:${Math.round(c.sy - oy)}px">${esc(c.text)}</div>`).join('');
    if (container.dataset.html !== html) { container.innerHTML = html; container.dataset.html = html; }
  }
  function float(sx, sy, html, cls = '') {
    const [ox, oy] = off();
    const el = document.createElement('div');
    el.className = 'cb-float ' + cls;
    el.innerHTML = html;
    el.style.left = (sx - ox) + 'px'; el.style.top = (sy - oy) + 'px';
    fx.append(el);
    setTimeout(() => el.remove(), 1150);
  }
  let bannerT = 0;
  function showBanner(title, sub = '', cls = '', ms = 1100) {
    banner.className = `cb-banner cb-panel ${cls}`;
    banner.innerHTML = `<b>${esc(title)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}`;
    requestAnimationFrame(() => banner.classList.add('show'));
    clearTimeout(bannerT);
    bannerT = setTimeout(() => banner.classList.remove('show'), ms);
  }
  let hintT = 0;
  function hint(text, ms = 3200) {
    hintEl.textContent = text;
    hintEl.classList.remove('gone');
    clearTimeout(hintT);
    hintT = setTimeout(() => hintEl.classList.add('gone'), ms);
  }

  // ---------- diálogos ----------
  // la primera pelea, guiada (plan §E6): una línea de Vera por vez, de un solo uso (la escena decide cuándo)
  const guideEl = $('.cb-guide');
  function guide(text, who = 'cartografa') {
    if (!text) { guideEl.classList.add('gone'); return; }
    const ch = CHARACTERS[who] || {};
    guideEl.innerHTML = `<div class="gp"></div><div><div class="gw">${esc(ch.name || '')}${ch.title ? ` <small>· ${esc(ch.title)}</small>` : ''}</div>
      <p>${esc(text)}</p><div class="gf"><button class="btn ghost small" data-a="ok">Entendido</button></div></div>`;
    const face = portrait(who);
    if (face) guideEl.querySelector('.gp').append(face);
    guideEl.querySelector('[data-a="ok"]').onclick = () => guideEl.classList.add('gone');
    guideEl.classList.remove('gone');
  }
  function dialog(html, cls = '') {
    const w = document.createElement('div');
    w.className = 'cb-modal';
    w.innerHTML = `<div class="cb-dlg cb-panel ${cls}" role="dialog">${html}</div>`;
    root.append(w);
    return w;
  }
  function confirmEnd(names, cb) {
    const who = names.length === 1 ? `A ${esc(names[0])} le quedan acciones.` : `A ${esc(names.slice(0, -1).join(', '))} y ${esc(names[names.length - 1])} les quedan acciones.`;
    const w = dialog(`<h2>¿Terminar el turno?</h2><p>${who}</p>
      <div class="btns"><button class="btn second" data-a="yes">Terminar el turno<kbd>Espacio</kbd></button><button class="btn ghost" data-a="no">Seguir jugando<kbd>Esc</kbd></button></div>
      <p style="font-size:13px">Se puede apagar en Ajustes → Juego.</p>`);
    let done = false;
    const close = (ok) => { if (done) return; done = true; w.remove(); cb(ok); };
    w.querySelector('[data-a="yes"]').onclick = () => close(true);
    w.querySelector('[data-a="no"]').onclick = () => close(false);
    w.addEventListener('click', (e) => { if (e.target === w) close(false); });
    return { el: w, space: true, ok: () => close(true), cancel: () => close(false), close: () => { if (!done) { done = true; w.remove(); } } };
  }
  function openMenu(info, onAction) {
    const w = dialog(`<h2>Pausa</h2><p>La pelea queda como está.</p>
      <div class="btns"><button class="btn mint" data-a="resume">${icon('play', 20)} Seguir peleando</button>
      ${info.canRetreat ? `<button class="btn primary" data-a="retreat">${icon('back', 20)} Retirarse</button>` : ''}
      ${ctx.openPanel ? `<button class="btn ghost" data-a="settings">${icon('gear', 20)} Ajustes</button>` : ''}
      ${info.test ? `<button class="btn ghost" data-a="city">${icon('home', 20)} Volver a la ciudad</button>` : ''}</div>`);
    let done = false;
    const close = (a) => { if (done) return; done = true; w.remove(); onAction(a); };
    w.querySelectorAll('[data-a]').forEach(b => {
      b.onclick = () => {
        if (b.dataset.a !== 'retreat') return close(b.dataset.a);
        const box = w.querySelector('.cb-dlg');
        box.innerHTML = `<h2>¿Retirarse?</h2><p>El grupo vuelve entero. Se llevan el 20 % de la experiencia, sin botín, y el ánimo baja 1.</p>
          <div class="btns"><button class="btn primary" data-a="yes">Retirarse</button><button class="btn ghost" data-a="no">Mejor no</button></div>`;
        box.querySelector('[data-a="yes"]').onclick = () => close('retreat');
        box.querySelector('[data-a="no"]').onclick = () => close('resume');
      };
    });
    w.addEventListener('click', (e) => { if (e.target === w) close('resume'); });
    return { el: w, ok: () => w.querySelector('.btn')?.click(), cancel: () => close('resume'), close: () => { if (!done) { done = true; w.remove(); } } };
  }
  const REASON = {
    derrota: 'No quedó ninguno en pie.', jefe: 'Cayó el jefe. Los que quedaban huyen.', aguante: 'Aguantaron hasta que pasó la balsa.',
    rescate: 'El minero salió a salvo.', lider: 'Cayó el líder y el grupo se repliega.', cautivo: 'Al minero lo alcanzaron. El grupo se repliega.',
    noche: 'Se hizo de noche y hubo que replegarse.', retirada: 'El grupo se retiró a tiempo.',
  };
  const LESSON = {
    lider: 'Cuidá al líder: que no termine el turno en una casilla marcada.',
    cautivo: 'Los bichos van por el minero apenas lo desatás: cubrilo antes con barreras o con el grupo.',
    noche: 'Se fue el tiempo: buscá combos y no esperes a que vengan.',
  };
  function openResult(res, info, onAction) {
    const win = res.outcome === 'win', lose = res.outcome === 'lose';
    const title = win ? 'Victoria' : lose ? 'Derrota' : 'Retirada';
    const labels = ['Victoria', ...res.challenges.map(c => c.name)];
    const doneArr = [win, ...res.challenges.map(c => c.done)];
    const stars = labels.slice(0, 3).map((l, i) => `<div class="cb-star${doneArr[i] ? ' on' : ''}" style="animation-delay:${0.15 + i * 0.25}s">${icon(doneArr[i] ? 'star' : 'starOff', 40)}<span>${esc(l)}</span></div>`).join('');
    const mats = MAT_IDS.filter(m => res.loot.mats[m]).map(m => `<span>${icon(MATERIALS[m].icon, 22)}${res.loot.mats[m]} de ${esc(MATERIALS[m].name)}</span>`).join('');
    const combos = res.combos.length ? `<p>Combos: ${res.combos.map(c => esc(COMBOS[c]?.name || c)).join(', ')}.</p>` : '';
    const lesson = lose && LESSON[res.reason] ? `<div class="cb-lesson">${esc(LESSON[res.reason])}</div>` : '';
    const rev = lose && info.boss ? `<p>Revancha: en el próximo intento el grupo arranca con +5 de vida y ${esc(info.bossName?.toLowerCase() || 'el jefe')} con menos.</p>` : '';
    const morale = res.morale ? `<p>El ánimo de la expedición baja ${-res.morale}.</p>` : '';
    const btns = win
      ? `<button class="btn gold" data-a="go">${icon('play', 20)} Seguir</button>`
      : `${lose && !info.noRetry ? `<button class="btn second" data-a="retry">${icon('rotate', 20)} ${info.boss ? 'Revancha' : 'Reintentar'}</button>` : ''}
         <button class="btn ghost" data-a="go">${icon('back', 20)} Volver</button>`;
    const w = dialog(`<h2 class="${win ? 'win' : 'lose'}">${title}</h2><p>${esc(REASON[res.reason] || '')} ${res.turns ? esc(plural(res.turns, 'turno', 'turnos')) + '.' : ''}</p>
      ${win ? `<div class="cb-stars">${stars}</div>` : ''}
      ${mats ? `<div class="cb-loot">${mats}</div>` : ''}
      <p>${icon('xp', 16)} +${res.xp} de experiencia${win ? '' : ' (una parte de lo que valía la pelea)'}.</p>
      ${combos}${morale}${lesson}${rev}
      <div class="btns">${btns}</div>`, 'cb-result');
    let done = false;
    const close = (a) => { if (done) return; done = true; w.remove(); onAction(a); };
    w.querySelectorAll('[data-a]').forEach(b => { b.onclick = () => close(b.dataset.a); });
    return { el: w, result: true, ok: () => w.querySelector('.btn')?.click(), cancel: () => {}, close: () => { if (!done) { done = true; w.remove(); } } };
  }

  return {
    update,
    unitTags,
    tileChips: (list) => chips(chipsEl, list),
    preview: (list) => chips(prevEl, list),
    hoverCard(u, tile) {
      if (u) hoverEl.innerHTML = `<div class="cb-card cb-panel ${u.side}">${cardHtml(u)}</div>`;
      else if (tile) hoverEl.innerHTML = `<div class="cb-card cb-panel">${tileHtml(tile, last?.st?.battle)}</div>`;
      else hoverEl.innerHTML = '';
    },
    banner: showBanner,
    float,
    hint,
    guide,
    get guideOpen() { return !guideEl.classList.contains('gone'); },
    pulseHp(id) { const el = tagsEl.querySelector(`[data-id="${id}"]`); if (el) { el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit'); } },
    confirmEnd,
    openMenu,
    openResult,
    barIds: () => barIds.slice(),
    insets() {
      const H = root.clientHeight || innerHeight, W = root.clientWidth || innerWidth;
      const top = $('.cb-top').getBoundingClientRect(), rb = root.getBoundingClientRect();
      const bottom = $('.cb-bottom').getBoundingClientRect();
      const ord = order.getBoundingClientRect();
      const wide = W >= 1100;
      return { top: top.bottom - rb.top + 8, bottom: H - (bottom.top - rb.top) + 8, left: wide ? ord.right - rb.left + 8 : 0, right: wide ? 240 : 0 };
    },
    destroy() { clearTimeout(bannerT); clearTimeout(hintT); style.remove(); },
  };
}
