// Escena `voyage`: prototipo jugable de la Travesía por nodos (PLAN-FOTO §A1). Sin arte: el mapa es DOM (botones y
// líneas SVG) y las tarjetas son texto. Las reglas están en voyage-rules.js; las peleas son las del combate táctico
// (router.go('combat', { battle, onEnd })) y al cerrar el resultado se vuelve acá.
//
//   ?scene=voyage            retoma la salida guardada o muestra la pantalla de zarpar
//   ?scene=voyage&seed=N     zarpa con esa semilla (si la salida guardada es otra, la reemplaza)
//   router.go('voyage', { resume: true }) / { seed }
//
// La salida vive en state.voyage.active (JSON). Al terminar, lo juntado se acredita en la ciudad (store.grant).
// Para las pruebas: container.__voyage = { run, view, enter(id), choose(id), fight(), finishFight(res), leave(), start(seed) }.
import { t } from '../core/i18n.js';
import { esc } from '../core/ui.js';
import { MATERIAL_BY_ID } from '../core/data.js';
import { UNITS, ITEMS, ENCOUNTERS } from '../combat/combat-data.js';
import * as C from '../combat/combat-rules.js';
import * as R from './voyage-rules.js';
import { VOY } from './voyage-data.js';

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
`;

const sign = (n) => (n > 0 ? '+' + n : '−' + Math.abs(n));
const whoName = (id) => (id === 'lider' ? t('voyage.who.lider') : UNITS[id]?.name || id);
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
  else if (fx.relic) out.push(t('voyage.fx.relic', { name: t(`voyage.relic.${fx.relic}.name`), text: t(`voyage.relic.${fx.relic}.text`) }));
  if (fx.nextFoe) out.push(t('voyage.fx.nextFoe', { n: pctOf(fx.nextFoe) }));
  if (fx.bossHp) out.push(t('voyage.fx.bossHp', { n: pctOf(fx.bossHp) }));
  return out.length ? out.join(' · ') : t('voyage.fx.none');
}

export default function create(ctx) {
  const { store } = ctx;
  let root = null, styleEl = null, alive = false, run = null, entering = false, lastEvents = [];

  const vstate = () => {
    const s = store.state;
    if (!s.voyage || typeof s.voyage !== 'object') s.voyage = {};
    s.voyage.runs ??= 0; s.voyage.wins ??= 0; s.voyage.active ??= null;
    return s.voyage;
  };
  const persist = () => { store.markDirty(); try { store.save(); } catch {} };

  function start(seed) {
    const v = vstate();
    run = R.newRun({ seed: (Number(seed) || (Date.now() % 1e9)) >>> 0 });
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
    const mats = r.haul?.mats || {};
    if (Object.keys(mats).length) { try { store.grant({ mats }, 'voyage'); } catch (e) { console.error('[voyage] acreditar', e); } }
    try { ctx.bus?.emit('voyage:finished', { outcome: r.outcome, seed: r.seed, nodes: r.path.length, fights: r.fights.length, mats }); } catch {}
    persist();
  }
  function after(out) {
    lastEvents = out.events || [];
    if (run.ended) credit(run);
    persist();
    if (alive) render();
    return out;
  }
  const enter = (id) => after(R.enter(run, id));
  const choose = (id) => after(R.choose(run, id));
  const skip = () => after(R.skip(run));
  const leave = () => after(R.leave(run));

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
    const out = R.endCombat(ref, res);
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
    const relics = run.relics.map(id => `<span class="vy-tag relic" title="${esc(t(`voyage.relic.${id}.text`))}">${esc(t(`voyage.relic.${id}.name`))}</span>`).join('');
    const items = run.items.map(id => `<span class="vy-tag">${esc(ITEMS[id]?.name || id)}</span>`).join('');
    const mats = matsText(run.loot.mats);
    return `<div class="vy-tags">${relics}${items}</div><p class="vy-dim" data-loot>${esc(mats ? t('voyage.loot', { list: mats }) : t('voyage.lootNone'))}</p>`;
  }
  function eventLine(e) {
    switch (e.type) {
      case 'heal': return e.n ? t('voyage.log.heal', { n: e.n }) : '';
      case 'hurt': return e.n ? t('voyage.log.hurt', { n: e.n }) : '';
      case 'mats': return t('voyage.log.mats', { list: matsText(e.mats) });
      case 'lost': return Object.keys(e.mats).length ? t('voyage.log.lost', { list: matsText(e.mats) }) : '';
      case 'relic': return t('voyage.log.relic', { name: t(`voyage.relic.${e.id}.name`) });
      case 'item': return t('voyage.log.item', { name: ITEMS[e.id]?.name || e.id });
      case 'revive': return t('voyage.log.revive');
      case 'combatEnd': return t('voyage.log.fight.' + (e.fight.outcome === 'win' ? 'win' : e.fight.outcome === 'lose' ? 'lose' : 'retreat'), { name: ENCOUNTERS[e.fight.enc]?.name || e.fight.enc, n: e.fight.turns });
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
        <p>${esc(t('voyage.end.stats', { nodes: s.nodes, fights: s.fights }))}</p><p>${esc(mats ? t('voyage.end.haul', { list: mats }) : t('voyage.end.haulNone'))}</p>${logHtml}
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
        <div class="vy-opts"><button class="vy-btn" data-a="fight">${esc(t(going ? 'voyage.fight.resume' : 'voyage.fight.go'))}</button><button class="vy-btn plain" data-a="leave">${esc(t('voyage.fight.retreat'))}</button></div></div>`;
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
    return `<div class="vy-box" data-card="recompensa"><h2>${esc(t('voyage.reward.title'))}</h2><p>${esc(t('voyage.reward.text'))}</p>${logHtml}
      <div class="vy-opts">${os.map(o => optBtn(o, o.id === 'reliquia' ? t(`voyage.relic.${o.relic}.name`) : t('voyage.reward.' + o.id), o.id === 'reliquia' ? t(`voyage.relic.${o.relic}.text`) : fxText(o.fx))).join('')}
      <button class="vy-btn plain" data-a="skip">${esc(t('voyage.reward.skip'))}</button></div></div>`;
  }
  function render() {
    if (!root) return;
    if (!run) {
      const v = vstate();
      root.innerHTML = `<div class="vy"><div class="vy-top"><h1>${esc(t('voyage.title'))}</h1><span class="vy-dim">${esc(t('voyage.proto'))}</span></div>
        <div class="vy-box" data-card="zarpar"><h2>${esc(t('voyage.dock.title'))}</h2><p>${esc(t('voyage.dock.text'))}</p>
        <p class="vy-dim">${esc(t('voyage.dock.count', { runs: v.runs, wins: v.wins }))}</p>
        <div class="vy-opts"><button class="vy-btn" data-a="sail">${esc(t('voyage.sail'))}</button><button class="vy-btn plain" data-a="city">${esc(t('voyage.toCity'))}</button></div></div></div>`;
      return;
    }
    root.innerHTML = `<div class="vy">
      <div class="vy-top"><h1>${esc(t('voyage.title'))}</h1><span class="vy-dim">${esc(t('voyage.island.' + run.island))} · ${esc(t('voyage.seed', { n: run.seed }))}</span><span class="sp"></span>
        ${run.ended || run.pending?.kind === 'combate' ? '' : `<button class="vy-btn plain inline" data-a="leave">${esc(t('voyage.leave'))}</button>`}</div>
      <div class="vy-main"><div class="vy-map">${mapHtml()}</div>
      <div class="vy-side"><div class="vy-box"><h2>${esc(t('voyage.squad.title'))}</h2><div class="vy-sq">${squadHtml()}</div></div>
        <div class="vy-box"><h2>${esc(t('voyage.pack.title'))}</h2>${packHtml()}</div>${cardHtml()}</div></div></div>`;
  }
  function onClick(ev) {
    const b = ev.target.closest('button');
    if (!b || b.disabled || !root.contains(b)) return;
    try { ctx.audio?.sfx?.('tap'); } catch {}
    if (b.dataset.node != null) { if (b.classList.contains('can')) enter(Number(b.dataset.node)); return; }
    if (b.dataset.opt) { choose(b.dataset.opt); return; }
    switch (b.dataset.a) {
      case 'fight': fight(); break;
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
      const seed = params.seed ?? (params.resume ? null : q.get('seed'));
      run = v.active && v.active.v === 1 ? v.active : null;
      if (run?.ended) { credit(run); if (!params.resume) { run = null; v.active = null; } }
      if (seed != null && seed !== '' && (!run || run.seed !== (Number(seed) >>> 0))) start(seed);
      lastEvents = params.events || [];
      // una pelea que ya terminó (se cerró el juego en la pantalla de resultado): se acredita sin volver a abrirla
      const b = run && R.activeBattle(run);
      if (b?.ended) { const out = R.endCombat(run, C.result(b)); lastEvents = out.events; if (run.ended) credit(run); persist(); }
      root.addEventListener('click', onClick);
      render();
      el.__voyage = {
        get run() { return run; },
        get view() { return run ? { pos: run.pos, pending: run.pending?.kind || null, ended: run.ended, outcome: run.outcome, choices: R.choices(run), options: R.options(run).map(o => o.id) } : null; },
        rules: R, combat: C, enter, choose, skip, fight, leave, start,
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
