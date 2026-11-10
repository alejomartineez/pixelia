// Escena `voyage`: prototipo jugable de la Travesía por nodos (PLAN-FOTO §A1). Sin arte: el mapa es DOM (botones y
// líneas SVG) y las tarjetas son texto. Las reglas están en voyage-rules.js; las peleas son las del combate táctico
// (router.go('combat', { battle, onEnd })) y al cerrar el resultado se vuelve acá.
//
//   ?scene=voyage            retoma la salida guardada o muestra la pantalla de zarpar
//   ?scene=voyage&seed=N     zarpa con esa semilla (si la salida guardada es otra, la reemplaza); &marea=1..3 fuerza la Marea
//   router.go('voyage', { resume: true }) / { seed }
//
// La salida vive en state.voyage.active (JSON). Al terminar, lo juntado se acredita en la ciudad (store.grant).
// Enganche con A3 (botín, árbol, reliquias): las armas que caen van al arsenal (state.arsenal) y la veta al árbol
// (state.tree) al ganar cada pelea; el panel "Equipo" compara y equipa, y el arma define las habilidades de la pelea.
// Para las pruebas: container.__voyage = { run, view, enter(id), choose(id), fight(), finishFight(res), leave(), start(seed) }.
import { t } from '../core/i18n.js';
import { esc } from '../core/ui.js';
import { MATERIAL_BY_ID } from '../core/data.js';
import { UNITS, ITEMS, ENCOUNTERS, ABILITIES, MAREA_MAX } from '../combat/combat-data.js';
import * as A from '../core/arsenal.js';
import * as L from '../core/loot.js';
import { treeInfo } from '../core/tree.js';
import * as C from '../combat/combat-rules.js';
import * as R from './voyage-rules.js';
import { VOY, RELICS as VOY_RELICS } from './voyage-data.js';

const STYLE = `
.scene-voyage { position:absolute; inset:0; overflow:auto; background:#14161b; color:#d9d4c7; font:16px/1.4 inherit; }
.vy { display:flex; flex-direction:column; min-height:100%; padding:16px 20px; gap:12px; box-sizing:border-box; }
.vy-top { display:flex; flex-wrap:wrap; align-items:baseline; gap:8px 20px; }
.vy-top h1 { margin:0; font-size:24px; color:#f0e6c8; }
.vy-top .sp { flex:1; }
.vy-main { display:flex; flex-wrap:wrap; gap:16px; flex:1; }
.vy-map { position:relative; flex:3 1 480px; min-height:520px; background:#1b1f27; border:2px solid #2c323d; }
.vy-map svg { position:absolute; inset:0; width:100%; height:100%; }
.vy-map line { stroke:#3a4250; stroke-width:2; vector-effect:non-scaling-stroke; }
.vy-map line.walk { stroke:#c9a45a; stroke-width:3; }
.vy-map line.open { stroke:#7d8a99; }
.vy-node { position:absolute; transform:translate(-50%,-50%); padding:6px 10px; border:2px solid #3a4250; background:#232832; color:#9aa3b0; font:inherit; font-size:14px; white-space:nowrap; cursor:default; }
.vy-node.can { border-color:#e8c36a; color:#f6edd2; background:#3a3324; cursor:pointer; }
.vy-node.can:hover, .vy-node.can:focus-visible { background:#55482b; outline:none; }
.vy-node.done { opacity:.45; }
.vy-node.here { border-color:#f6edd2; color:#fff; opacity:1; background:#2f3a4a; }
.vy-node.t-elite { border-style:double; border-width:4px; }
.vy-node.t-jefe { border-width:4px; font-size:16px; }
.vy-node.t-campamento { border-radius:14px; }
.vy-node.t-evento { border-style:dashed; }
.vy-side { flex:2 1 340px; display:flex; flex-direction:column; gap:12px; }
.vy-box { background:#1b1f27; border:2px solid #2c323d; padding:12px 14px; }
.vy-box h2 { margin:0 0 8px; font-size:17px; color:#f0e6c8; }
.vy-box p { margin:0 0 8px; }
.vy-sq { display:grid; grid-template-columns:auto 1fr auto; gap:4px 10px; align-items:center; }
.vy-bar { height:10px; background:#11131a; border:1px solid #3a4250; }
.vy-bar i { display:block; height:100%; background:#7fae6a; }
.vy-bar i.low { background:#c8643f; }
.vy-sq small, .vy-dim { color:#8a93a0; font-size:14px; }
.vy-tags { display:flex; flex-wrap:wrap; gap:6px; }
.vy-tag { border:1px solid #3a4250; padding:2px 8px; font-size:14px; }
.vy-tag.relic { border-color:#8a6fb0; color:#d6c6ee; }
.vy-opts { display:flex; flex-direction:column; gap:8px; }
.vy-btn { text-align:left; padding:10px 12px; border:2px solid #6b5a34; background:#2c2718; color:#f6edd2; font:inherit; cursor:pointer; }
.vy-btn:hover, .vy-btn:focus-visible { background:#453b22; outline:none; }
.vy-btn[disabled] { opacity:.4; cursor:not-allowed; }
.vy-btn small { display:block; color:#b9b09a; font-size:14px; }
.vy-btn.plain { border-color:#3a4250; background:#232832; color:#c5ccd6; }
.vy-btn.inline { display:inline-block; padding:6px 12px; }
.vy-log { color:#b9b09a; font-size:14px; margin:0; padding-left:18px; }
.vy-mareas { display:flex; flex-wrap:wrap; gap:8px; margin:0 0 10px; }
.vy-mareas .vy-btn { flex:1 1 160px; }
.vy-btn.on { border-color:#f6edd2; background:#55482b; }
.vy-row { display:flex; flex-wrap:wrap; gap:8px; }
.vy-gear { display:flex; flex-direction:column; gap:10px; }
.vy-who { border-top:1px solid #2c323d; padding-top:8px; }
.vy-who h3 { margin:0 0 4px; font-size:16px; color:#f0e6c8; }
.vy-who ul { margin:2px 0 6px; padding-left:18px; color:#b9b09a; font-size:14px; }
.vy-item { display:block; }
.vy-item b { font-weight:normal; }
.vy-up { color:#9fd08a; } .vy-down { color:#d98a6a; }
.vy-drop { border-left:3px solid #6b5a34; padding:2px 0 2px 10px; margin:0 0 8px; }
.vy-drop small { display:block; color:#b9b09a; font-size:14px; }
`;

const sign = (n) => (n > 0 ? '+' + n : '−' + Math.abs(n));
const whoName = (id) => (id === 'lider' ? t('voyage.who.lider') : UNITS[id]?.name || id);
/** Las reliquias salen de dos tablas (voyage-data.js y loot-data.js): cada una tiene su texto. */
const relicName = (id) => (VOY_RELICS[id] ? t(`voyage.relic.${id}.name`) : L.relicName(id));
const relicText = (id) => (VOY_RELICS[id] ? t(`voyage.relic.${id}.text`) : L.relicText(id));
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V'];
const rarColor = (w) => A.RARITIES[w?.rarity | 0]?.color || '#a39a8c';
const itemName = (w) => `<b style="color:${rarColor(w)}">${esc(A.weaponName(w))}</b>`;
const matName = (id) => MATERIAL_BY_ID[id]?.name || id;
const matsText = (mats) => Object.entries(mats || {}).filter(([, n]) => n > 0).map(([k, n]) => `${n} ${matName(k)}`).join(', ');
const pctOf = (x) => Math.round(Math.abs(x - 1) * 100);

/** Un efecto (voyage-data.js) dicho en una línea: lo que va a pasar si se elige. */
export function fxText(fx = {}) {
  const out = [];
  if (fx.healAll) out.push(fx.healAll <= 1 ? t('voyage.fx.healPct', { n: Math.round(fx.healAll * 100) }) : t('voyage.fx.heal', { n: fx.healAll }));
  if (fx.dmgAll) out.push(t('voyage.fx.dmgAll', { n: fx.dmgAll }));
  if (fx.dmgLeader) out.push(t('voyage.fx.dmgLeader', { n: fx.dmgLeader }));
  if (fx.maxHpAll) out.push(t('voyage.fx.maxHpAll', { n: sign(fx.maxHpAll) }));
  if (fx.maxHpLeader) out.push(t('voyage.fx.maxHpLeader', { n: sign(fx.maxHpLeader) }));
  if (fx.atkAll) out.push(t('voyage.fx.atkAll', { n: sign(fx.atkAll) }));
  if (fx.atkLeader) out.push(t('voyage.fx.atk', { n: sign(fx.atkLeader), who: whoName('lider') }));
  if (fx.atk) out.push(t('voyage.fx.atk', { n: sign(fx.atk.n), who: whoName(fx.atk.who) }));
  if (fx.armor) out.push(t('voyage.fx.armor', { n: sign(fx.armor.n), who: whoName(fx.armor.who) }));
  if (fx.mats && Object.keys(fx.mats).length) out.push(t('voyage.fx.mats', { list: matsText(fx.mats) }));
  if (fx.loseMats) out.push(fx.loseMats >= 1 ? t('voyage.fx.loseAll') : t('voyage.fx.losePct', { n: Math.round(fx.loseMats * 100) }));
  if (fx.useItem) out.push(t('voyage.fx.useItem', { name: ITEMS[fx.useItem]?.name || fx.useItem }));
  if (fx.item) out.push(t('voyage.fx.item', { name: ITEMS[fx.item]?.name || fx.item }));
  if (fx.relic === true) out.push(t('voyage.fx.relicAny'));
  else if (fx.relic) out.push(t('voyage.fx.relic', { name: relicName(fx.relic), text: relicText(fx.relic) }));
  if (fx.nextFoe) out.push(t('voyage.fx.nextFoe', { n: pctOf(fx.nextFoe) }));
  if (fx.bossHp) out.push(t('voyage.fx.bossHp', { n: pctOf(fx.bossHp) }));
  return out.length ? out.join(' · ') : t('voyage.fx.none');
}

export default function create(ctx) {
  const { store } = ctx;
  let root = null, styleEl = null, alive = false, run = null, entering = false, lastEvents = [], showGear = false;

  const vstate = () => R.voyageState(store.state);
  const env = () => ({ state: store.state });
  const persist = () => { store.markDirty(); try { store.save(); } catch {} };

  function start(seed, marea) {
    const v = vstate();
    run = R.newRun({ seed: (Number(seed) || (Date.now() % 1e9)) >>> 0, marea: marea || v.marea });
    v.active = run; v.runs++;
    lastEvents = [];
    persist();
    render();
    return run;
  }
  /** Acredita en la ciudad lo que trajo una salida terminada (una sola vez). */
  function credit(r) {
    if (!r.ended || r.credited) return;
    r.credited = true;
    const v = vstate();
    if (r.outcome === 'win') v.wins++;
    // la experiencia de las peleas ganadas sube el Nivel de la aldea (las armas y la veta ya se guardaron al ganar cada una)
    if (r.xp > 0) { try { store.addXp(Math.round(r.xp), 'voyage'); } catch (e) { console.error('[voyage] experiencia', e); } }
    const mats = r.haul?.mats || {};
    if (Object.keys(mats).length) { try { store.grant({ mats }, 'voyage'); } catch (e) { console.error('[voyage] acreditar', e); } }
    try { ctx.bus?.emit('voyage:finished', { outcome: r.outcome, seed: r.seed, nodes: r.path.length, fights: r.fights.length, mats, marea: r.marea || 1, items: (r.drops || []).length, veta: r.veta || 0 }); } catch {}
    persist();
  }
  function after(out) {
    lastEvents = out.events || [];
    if (run.ended) credit(run);
    persist();
    if (alive) render();
    return out;
  }
  const enter = (id) => after(R.enter(run, id, env()));
  const choose = (id) => after(R.choose(run, id));
  const skip = () => after(R.skip(run));
  const leave = () => after(R.leave(run, env()));
  /** Resolución automática de una pelea común ya ganada con tres estrellas en esta Marea (botín completo). */
  const auto = () => (run && R.canAuto(run, env()) ? after(R.autoFight(run, env())) : { ok: false });
  /** Equipa un arma del arsenal; si hay una pelea por empezar, se arma de nuevo con lo que quedó puesto. */
  function equip(who, uid) {
    const out = A.equipWeapon(store.state, who, Number(uid));
    if (out.ok && run) R.refreshBattle(run, env());
    persist();
    if (alive) render();
    return out;
  }
  function equipBest() {
    const out = L.equipBest(store.state, run ? run.party : VOY.party, null);
    if (run) R.refreshBattle(run, env());
    persist();
    if (alive) render();
    return out;
  }
  function setMarea(m) {
    const v = vstate();
    v.marea = Math.max(1, Math.min(v.mareaMax, m | 0));
    persist();
    if (alive) render();
    return v.marea;
  }
  const toTree = () => { persist(); ctx.router.go('tree', { back: 'voyage', backParams: { resume: true } }); };

  /** Pasa a la escena del combate con la pelea de la salida; al cerrar el resultado se acredita y se vuelve. */
  function fight() {
    if (!alive || entering || !run || run.pending?.kind !== 'combate') return false;
    const b = R.activeBattle(run), ref = run;
    if (!b || b.ended) { finishFight(ref, b ? C.result(b) : null); return true; }
    entering = true;
    persist();
    const node = R.nodeOf(run, run.pending.node);
    try { ctx.bus?.emit('voyage:combat', { enc: node.enc, type: node.type }); } catch {}
    Promise.resolve(ctx.router.go('combat', {
      battle: b, noRetry: true, voyage: true,
      onSave: () => persist(),
      onEnd: (res) => finishFight(ref, res),
    })).finally(() => { entering = false; });
    return true;
  }
  function finishFight(ref, res) {
    const out = R.endCombat(ref, res, [], env());
    if (ref.ended) credit(ref);
    persist();
    if (alive && run === ref && ctx.router.current === 'voyage') { lastEvents = out.events || []; render(); return; }
    ctx.router.go('voyage', { resume: true, events: out.events || [] });
  }

  // ---------- dibujo ----------
  const pos = (n, rows) => ({ x: ((n.col + 0.5) / n.n) * 100, y: 100 - ((n.row + 0.5) / rows) * 100 });
  function mapHtml() {
    const m = run.map, can = R.choices(run), walked = new Set(run.path);
    let lines = '', nodes = '';
    for (const n of m.nodes) {
      const a = pos(n, m.rows);
      for (const j of n.next) {
        const b = pos(m.nodes[j], m.rows);
        const i = run.path.indexOf(n.id);
        const cls = i >= 0 && run.path[i + 1] === j ? 'walk' : n.id === run.pos && can.includes(j) ? 'open' : '';
        lines += `<line class="${cls}" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"/>`;
      }
      const cls = ['vy-node', 't-' + n.type, can.includes(n.id) ? 'can' : '', n.id === run.pos ? 'here' : walked.has(n.id) ? 'done' : ''].join(' ');
      nodes += `<button class="${cls}" data-node="${n.id}" data-type="${n.type}" style="left:${a.x}%;top:${a.y}%" ${can.includes(n.id) ? '' : 'tabindex="-1"'}>${esc(t('voyage.node.' + n.type))}</button>`;
    }
    return `<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${lines}</svg>${nodes}`;
  }
  function squadHtml() {
    let h = '';
    for (const s of Object.values(run.squad)) {
      const f = Math.max(0, Math.min(1, s.hp / s.maxHp));
      const plus = [s.atk ? t('voyage.squad.atk', { n: sign(s.atk) }) : '', s.armor ? t('voyage.squad.armor', { n: sign(s.armor) }) : ''].filter(Boolean).join(' · ');
      h += `<span>${esc(whoName(s.id))}${plus ? ` <small>${esc(plus)}</small>` : ''}</span><span class="vy-bar"><i class="${f < 0.35 ? 'low' : ''}" style="width:${Math.round(f * 100)}%"></i></span><span data-hp="${s.id}">${s.hp > 0 ? `${s.hp}/${s.maxHp}` : esc(t('voyage.squad.down'))}</span>`;
    }
    return h;
  }
  function packHtml() {
    const relics = run.relics.map(id => `<span class="vy-tag relic" data-relic="${esc(id)}" title="${esc(relicText(id))}">${esc(relicName(id))}</span>`).join('');
    const items = run.items.map(id => `<span class="vy-tag">${esc(ITEMS[id]?.name || id)}</span>`).join('');
    const mats = matsText(run.loot.mats);
    const rl = run.relics.length ? `<ul class="vy-log">${run.relics.map(id => `<li>${esc(relicName(id))}: ${esc(relicText(id))}</li>`).join('')}</ul>` : '';
    return `<div class="vy-tags">${relics}${items}</div>${rl}<p class="vy-dim" data-loot>${esc(mats ? t('voyage.loot', { list: mats }) : t('voyage.lootNone'))}</p>
      <p class="vy-dim" data-drops>${esc(t('voyage.pack.drops', { n: run.drops?.length || 0, veta: run.veta || 0 }))}</p>`;
  }
  /** Ficha de un arma: nombre con el color de su rareza, fuerza y una línea por rasgo. */
  function itemHtml(w, cur) {
    const p = L.itemPower(w), d = cur ? p - L.itemPower(cur) : 0;
    const diff = cur && d ? ` <span class="${d > 0 ? 'vy-up' : 'vy-down'}">(${sign(d)})</span>` : '';
    const lines = L.itemLines(w);
    return `${itemName(w)} · ${esc(t('voyage.gear.power', { n: p }))}${diff}${w.tier ? ` · ${esc(t('voyage.marea.short', { n: ROMAN[w.tier] || w.tier }))}` : ''}<small>${esc(lines.length ? lines.join(' ') : t('voyage.gear.noAffix'))}</small>`;
  }
  /** El equipo: qué lleva cada uno, qué habilidades le da y con qué se puede cambiar (comparado por fuerza). */
  function gearHtml() {
    const st = store.state, party = run ? run.party : VOY.party;
    const Ld = L.loadout(st, { party, leaderCls: null, run });
    const a = A.arsenalState(st), fresh = new Set(run?.drops || []);
    const locked = run?.pending?.kind === 'combate' && R.activeBattle(run)?.turn > 1;
    let h = '';
    for (const who of ['lider', ...party]) {
      const cur = A.equippedOn(st, who);
      const skills = (Ld.skills[who] || []).map(id => ABILITIES[id]?.name || id).join(', ');
      const opts = a.items.filter(w => w.uid !== cur?.uid && A.canWield(who, w.type)).sort((x, y) => L.itemPower(y) - L.itemPower(x)).slice(0, 5);
      h += `<div class="vy-who" data-who="${who}"><h3>${esc(whoName(who))}</h3>
        <div class="vy-item" data-cur="${cur?.uid || ''}">${cur ? itemHtml(cur) : `<span class="vy-dim">${esc(t('arsenal.noWeapon'))}</span>`}</div>
        ${skills ? `<p class="vy-dim" data-skills>${esc(t('voyage.gear.skills', { list: skills }))}</p>` : ''}
        <div class="vy-opts">${opts.map(w => { const by = Object.entries(a.equipped).find(([, u]) => u === w.uid)?.[0];
          return `<button class="vy-btn plain" data-equip="${who}:${w.uid}" ${locked ? 'disabled' : ''}>${fresh.has(w.uid) ? `<span class="vy-up">${esc(t('voyage.gear.new'))}</span> ` : ''}${itemHtml(w, cur)}${by ? `<small>${esc(t('voyage.gear.heldBy', { who: whoName(by) }))}</small>` : ''}</button>`; }).join('')}</div></div>`;
    }
    return `<div class="vy-box" data-card="equipo"><h2>${esc(t('voyage.gear.title'))}</h2><p class="vy-dim">${esc(t(locked ? 'voyage.gear.locked' : 'voyage.gear.text'))}</p>
      <div class="vy-row"><button class="vy-btn plain inline" data-a="best" ${locked ? 'disabled' : ''}>${esc(t('voyage.gear.best'))}</button><button class="vy-btn plain inline" data-a="gear">${esc(t('voyage.gear.close'))}</button></div>
      <div class="vy-gear">${h}</div></div>`;
  }
  /** Botones de la aldea: equipo y árbol (con los puntos libres a la vista). */
  function toolsHtml() {
    const ti = treeInfo(store.state), n = A.arsenalState(store.state).items.length;
    return `<div class="vy-row"><button class="vy-btn plain inline" data-a="gear">${esc(t('voyage.gear.open', { n }))}</button>
      <button class="vy-btn plain inline" data-a="tree">${esc(ti.free > 0 ? t('voyage.tree.openFree', { n: ti.free }) : t('voyage.tree.open'))}</button></div>`;
  }
  /** Lo que cayó en la última pelea: cada arma con sus rasgos. */
  function dropsHtml() {
    const e = lastEvents.find(x => x.type === 'loot');
    if (!e) return '';
    const items = e.items.map(w => { const live = A.weaponByUid(store.state, w.uid) || w; return `<div class="vy-drop" data-drop="${w.uid}">${itemHtml(live)}</div>`; }).join('');
    return `${items}${e.items.length ? `<p class="vy-dim">${esc(t('voyage.drop.hint'))}</p>` : ''}`;
  }
  function eventLine(e) {
    switch (e.type) {
      case 'heal': return e.n ? t('voyage.log.heal', { n: e.n }) : '';
      case 'hurt': return e.n ? t('voyage.log.hurt', { n: e.n }) : '';
      case 'mats': return t('voyage.log.mats', { list: matsText(e.mats) });
      case 'lost': return Object.keys(e.mats).length ? t('voyage.log.lost', { list: matsText(e.mats) }) : '';
      case 'relic': return t('voyage.log.relic', { name: relicName(e.id) });
      case 'loot': return [e.items.length ? t('voyage.log.items', { list: e.items.map(w => A.weaponName(w)).join(', ') }) : '', e.veta ? t('voyage.log.veta', { n: e.veta }) : '', e.points ? t('voyage.log.point') : ''].filter(Boolean).join(' ');
      case 'mastery': return t('voyage.log.mastery', { weapon: A.WEAPON_TYPES[e.weapon]?.name || e.weapon, n: e.to });
      case 'item': return t('voyage.log.item', { name: ITEMS[e.id]?.name || e.id });
      case 'revive': return t('voyage.log.revive');
      case 'combatEnd': return t('voyage.log.fight.' + (e.fight.auto ? 'auto' : e.fight.outcome === 'win' ? 'win' : e.fight.outcome === 'lose' ? 'lose' : 'retreat'), { name: ENCOUNTERS[e.fight.enc]?.name || e.fight.enc, n: e.fight.turns });
      default: return '';
    }
  }
  const optBtn = (o, label, sub) => `<button class="vy-btn" data-opt="${esc(o.id)}" ${o.can ? '' : 'disabled'}>${esc(label)}<small>${esc(sub)}</small></button>`;
  function cardHtml() {
    const pd = run.pending;
    const log = lastEvents.map(eventLine).filter(Boolean);
    const logHtml = log.length ? `<ul class="vy-log">${log.map(l => `<li>${esc(l)}</li>`).join('')}</ul>` : '';
    if (run.ended) {
      const s = R.summary(run), mats = matsText(s.haul.mats);
      return `<div class="vy-box" data-card="fin"><h2>${esc(t('voyage.end.' + run.outcome + '.title'))}</h2><p>${esc(t('voyage.end.' + run.outcome + '.text'))}</p>
        <p>${esc(t('voyage.end.stats', { nodes: s.nodes, fights: s.fights }))}</p><p>${esc(mats ? t('voyage.end.haul', { list: mats }) : t('voyage.end.haulNone'))}</p>
        <p data-end-loot>${esc(t('voyage.end.loot', { marea: ROMAN[s.marea] || s.marea, items: s.items, veta: s.veta, xp: Math.round(s.xp) }))}</p>${logHtml}${dropsHtml()}${toolsHtml()}
        <div class="vy-opts"><button class="vy-btn" data-a="again">${esc(t('voyage.again'))}</button><button class="vy-btn plain" data-a="city">${esc(t('voyage.toCity'))}</button></div></div>`;
    }
    if (!pd) {
      return `<div class="vy-box" data-card="mapa"><h2>${esc(t(run.pos == null ? 'voyage.start.title' : 'voyage.next.title'))}</h2><p>${esc(t(run.pos == null ? 'voyage.start.text' : 'voyage.next.text'))}</p>${logHtml}</div>`;
    }
    if (pd.kind === 'combate') {
      const node = R.nodeOf(run, pd.node), enc = ENCOUNTERS[pd.enc], k = R.foeHpFor(run, node);
      const b = R.activeBattle(run), going = b && b.turn > 1;
      return `<div class="vy-box" data-card="combate"><h2>${esc(t('voyage.node.' + node.type))}: ${esc(enc.name)}</h2><p>${esc(enc.text || '')}</p>
        ${k !== 1 ? `<p class="vy-dim">${esc(t(k > 1 ? 'voyage.fight.harder' : 'voyage.fight.weaker', { n: pctOf(k) }))}</p>` : ''}
        <p class="vy-dim">${esc(t('voyage.fight.stakes'))}</p>${logHtml}
        <div class="vy-opts"><button class="vy-btn" data-a="fight">${esc(t(going ? 'voyage.fight.resume' : 'voyage.fight.go'))}</button>
        ${R.canAuto(run, env()) ? `<button class="vy-btn" data-a="auto">${esc(t('voyage.fight.auto'))}<small>${esc(t('voyage.fight.autoText'))}</small></button>` : ''}<button class="vy-btn plain" data-a="leave">${esc(t('voyage.fight.retreat'))}</button></div></div>`;
    }
    const os = R.options(run);
    if (pd.kind === 'evento') {
      return `<div class="vy-box" data-card="evento"><h2>${esc(t(`voyage.event.${pd.event}.title`))}</h2><p>${esc(t(`voyage.event.${pd.event}.text`))}</p>
        <div class="vy-opts">${os.map(o => optBtn(o, t(`voyage.event.${pd.event}.${o.id}`), (o.can ? '' : t('voyage.need.' + (o.need?.item ? 'item' : 'mats'), { name: ITEMS[o.need?.item]?.name || '', n: o.need?.mats || 0 }) + ' · ') + fxText(o.fx))).join('')}</div></div>`;
    }
    if (pd.kind === 'campamento') {
      return `<div class="vy-box" data-card="campamento"><h2>${esc(t('voyage.camp.title'))}</h2><p>${esc(t('voyage.camp.text'))}</p>
        <div class="vy-opts">${os.map(o => optBtn(o, t('voyage.camp.' + o.id), fxText(o.fx))).join('')}</div></div>`;
    }
    return `<div class="vy-box" data-card="recompensa"><h2>${esc(t('voyage.reward.title'))}</h2>${logHtml}${dropsHtml()}<p>${esc(t('voyage.reward.text'))}</p>
      <div class="vy-opts">${os.map(o => optBtn(o, o.id === 'reliquia' ? t('voyage.reward.relic', { name: relicName(o.relic) }) : t('voyage.reward.' + o.id), o.id === 'reliquia' ? relicText(o.relic) : fxText(o.fx))).join('')}
      <button class="vy-btn plain" data-a="skip">${esc(t('voyage.reward.skip'))}</button></div></div>`;
  }
  function render() {
    if (!root) return;
    if (!run) {
      const v = vstate();
      root.innerHTML = `<div class="vy"><div class="vy-top"><h1>${esc(t('voyage.title'))}</h1><span class="vy-dim">${esc(t('voyage.proto'))}</span></div>
        <div class="vy-box" data-card="zarpar"><h2>${esc(t('voyage.dock.title'))}</h2><p>${esc(t('voyage.dock.text'))}</p>
        <p class="vy-dim">${esc(t('voyage.dock.count', { runs: v.runs, wins: v.wins }))}</p>
        <h2>${esc(t('voyage.marea.title'))}</h2><p class="vy-dim">${esc(t('voyage.marea.text'))}</p>
        <div class="vy-mareas">${Array.from({ length: MAREA_MAX }, (_, i) => i + 1).map(m => `<button class="vy-btn ${m === v.marea ? 'on' : 'plain'}" data-marea="${m}" ${m > v.mareaMax ? 'disabled' : ''}>${esc(t('voyage.marea.name', { n: ROMAN[m] }))}<small>${esc(m > v.mareaMax ? t('voyage.marea.locked', { n: ROMAN[m - 1] }) : t('voyage.marea.m' + m))}</small></button>`).join('')}</div>
        ${toolsHtml()}
        <div class="vy-opts" style="margin-top:10px"><button class="vy-btn" data-a="sail">${esc(t('voyage.sail'))}</button><button class="vy-btn plain" data-a="city">${esc(t('voyage.toCity'))}</button></div></div>${showGear ? gearHtml() : ''}</div>`;
      return;
    }
    root.innerHTML = `<div class="vy">
      <div class="vy-top"><h1>${esc(t('voyage.title'))}</h1><span class="vy-dim" data-marea-now="${run.marea || 1}">${esc(t('voyage.island.' + run.island))} · ${esc(t('voyage.marea.name', { n: ROMAN[run.marea || 1] }))} · ${esc(t('voyage.seed', { n: run.seed }))}</span><span class="sp"></span>
        ${run.ended ? '' : toolsHtml()}
        ${run.ended || run.pending?.kind === 'combate' ? '' : `<button class="vy-btn plain inline" data-a="leave">${esc(t('voyage.leave'))}</button>`}</div>
      <div class="vy-main"><div class="vy-map">${mapHtml()}</div>
      <div class="vy-side"><div class="vy-box"><h2>${esc(t('voyage.squad.title'))}</h2><div class="vy-sq">${squadHtml()}</div></div>
        <div class="vy-box"><h2>${esc(t('voyage.pack.title'))}</h2>${packHtml()}</div>${cardHtml()}${showGear ? gearHtml() : ''}</div></div></div>`;
  }
  function onClick(ev) {
    const b = ev.target.closest('button');
    if (!b || b.disabled || !root.contains(b)) return;
    try { ctx.audio?.sfx?.('tap'); } catch {}
    if (b.dataset.node != null) { if (b.classList.contains('can')) enter(Number(b.dataset.node)); return; }
    if (b.dataset.opt) { choose(b.dataset.opt); return; }
    if (b.dataset.equip) { const [who, uid] = b.dataset.equip.split(':'); equip(who, uid); return; }
    if (b.dataset.marea) { setMarea(Number(b.dataset.marea)); return; }
    switch (b.dataset.a) {
      case 'fight': fight(); break;
      case 'auto': auto(); break;
      case 'gear': showGear = !showGear; render(); break;
      case 'best': equipBest(); break;
      case 'tree': toTree(); break;
      case 'skip': skip(); break;
      case 'leave': leave(); break;
      case 'sail': case 'again': start(); break;
      case 'city': if (run?.ended) { vstate().active = null; persist(); } ctx.router.go('city'); break;
    }
  }

  return {
    hud: false,
    music: 'expedition',
    async mount(el, params = {}) {
      root = el; alive = true;
      styleEl = document.createElement('style');
      styleEl.id = 'voyage-style';
      styleEl.textContent = STYLE;
      document.head.append(styleEl);
      const v = vstate();
      const q = new URLSearchParams(location.search);
      // la semilla de la URL vale una sola vez: al volver del árbol o de la ciudad no se zarpa de nuevo
      const urlSeed = window.__voyageSeedUsed === location.search ? null : q.get('seed');
      const seed = params.seed ?? (params.resume ? null : urlSeed);
      const qm = Number(params.marea ?? q.get('marea')) || 0;
      run = v.active && v.active.v === 1 ? v.active : null;
      if (run) { run.marea ??= 1; run.wins ??= 0; run.offers ??= 0; run.best ??= {}; run.drops ??= []; run.veta ??= 0; run.xp ??= 0; }   // salida guardada antes del botín
      if (run?.ended) { credit(run); if (!params.resume) { run = null; v.active = null; } }
      if (seed != null && seed !== '' && (!run || run.seed !== (Number(seed) >>> 0))) start(seed, qm ? Math.max(1, Math.min(MAREA_MAX, qm)) : null);
      if (seed != null && seed === urlSeed) window.__voyageSeedUsed = location.search;
      if (run && !run.ended && R.refreshBattle(run, env())) persist();   // se cambió el arma o el árbol antes de entrar a la pelea
      lastEvents = params.events || [];
      // una pelea que ya terminó (se cerró el juego en la pantalla de resultado): se acredita sin volver a abrirla
      const b = run && R.activeBattle(run);
      if (b?.ended) { const out = R.endCombat(run, C.result(b), [], env()); lastEvents = out.events; if (run.ended) credit(run); persist(); }
      root.addEventListener('click', onClick);
      render();
      el.__voyage = {
        get run() { return run; },
        get view() { return run ? { pos: run.pos, pending: run.pending?.kind || null, ended: run.ended, outcome: run.outcome, choices: R.choices(run), options: R.options(run).map(o => o.id) } : null; },
        rules: R, combat: C, enter, choose, skip, fight, leave, start, auto, equip, equipBest, setMarea, toTree,
        get gear() { return L.loadout(store.state, { party: run ? run.party : VOY.party, leaderCls: null, run }); },
        /** Cierra la pelea pendiente con un resultado (pruebas): como volver del combate. */
        finishFight: (res) => finishFight(run, res),
      };
      this.offLang = ctx.bus?.on?.('lang:changed', () => alive && render());
    },
    unmount() {
      alive = false;
      try { this.offLang?.(); } catch {}
      root?.removeEventListener('click', onClick);
      styleEl?.remove(); styleEl = null;
      if (run && !run.ended) persist();
      if (root) { delete root.__voyage; root.replaceChildren(); root = null; }
    },
  };
}
