// Panel "Expedición" (DESIGN-CORE.md §2.9, §2.3, §6.2): depósito de provisiones, salida en curso para retomar, mapa de
// región (las 5 regiones con candado por rango y sus 5 zonas con estrellas), grupo (un integrante por rol, con su nivel
// y la probabilidad que da), equipo del Taller y los botones Salir · zona N / Salida corta. La lógica vive en
// src/expedition/expedition.js; acá solo se muestra y se elige.
import { icon } from '../core/icons.js';
import { REGION_MATERIALS, RESOURCES } from '../core/data.js';
import { REGIONS, ROLES, ROLE_IDS, EQUIPMENT, MATERIALS as EXP_MATS } from '../expedition/exp-data.js';
import { openShell } from './panels-common.js';

const CSS = `
.pnl-ex .pnl-ex-sec { margin-top: 10px; }
.pnl-ex h4.pnl-ex-h { display: flex; align-items: center; gap: 6px; margin: 0 0 6px; font-size: 19px; }
.pnl-ex h4.pnl-ex-h small { margin-left: auto; font-size: 14px; color: var(--ink-l); font-weight: 700; }
.pnl-ex .pnl-ex-wallet { display: flex; flex-wrap: wrap; gap: 6px 12px; align-items: center; font-size: 18px; }
.pnl-ex .pnl-ex-wallet span { display: inline-flex; align-items: center; gap: 3px; font-variant-numeric: tabular-nums; }
.pnl-ex .pnl-ex-wallet .big { font-size: 22px; font-weight: 700; }
.pnl-ex .pnl-ex-tip { margin: 6px 0 0; font-size: 14px; color: var(--ink-l); display: flex; gap: 6px; align-items: flex-start; }
.pnl-ex .pnl-ex-active { display: flex; align-items: center; gap: 10px; background: var(--gold-l); }
.pnl-ex .pnl-ex-active span { flex: 1; min-width: 0; }
.pnl-ex .pnl-ex-regs { display: flex; flex-direction: column; gap: 6px; }
.pnl-ex .pnl-ex-reg { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 4px 8px; padding: 6px 8px; background: #fff;
  border: 2px solid var(--ink); border-radius: 12px; text-align: left; font: inherit; color: inherit; cursor: pointer; }
.pnl-ex .pnl-ex-reg.sel { background: var(--mint-l); box-shadow: inset 0 0 0 2px var(--mint-d); }
.pnl-ex .pnl-ex-reg.lock { background: var(--panel-2); color: var(--ink-l); cursor: default; }
.pnl-ex .pnl-ex-reg b { font-size: 17px; }
.pnl-ex .pnl-ex-reg small { font-size: 13px; color: var(--ink-l); display: inline-flex; gap: 3px; align-items: center; }
.pnl-ex .pnl-ex-zones { grid-column: 1 / -1; display: flex; align-items: center; gap: 0; }
.pnl-ex .pnl-ex-zone { display: flex; flex-direction: column; align-items: center; min-width: 38px; font-size: 12px; line-height: 1; }
.pnl-ex .pnl-ex-zone i { width: 24px; height: 24px; border-radius: 50%; border: 2px solid var(--ink); background: var(--panel-2); display: grid;
  place-items: center; font-style: normal; font-size: 13px; font-weight: 700; }
.pnl-ex .pnl-ex-zone.done i { background: var(--mint); }
.pnl-ex .pnl-ex-zone.next i { background: var(--gold); box-shadow: 0 0 0 3px var(--gold-l); }
.pnl-ex .pnl-ex-zone em { font-style: normal; color: var(--gold-d); letter-spacing: -1px; min-height: 12px; margin-top: 2px; }
.pnl-ex .pnl-ex-link { flex: 1; height: 3px; background: var(--ink-ll); margin: 0 -2px 14px; min-width: 6px; }
.pnl-ex .pnl-ex-link.done { background: var(--mint-d); }
.pnl-ex .pnl-ex-roles { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
@media (max-width: 420px) { .pnl-ex .pnl-ex-roles { grid-template-columns: 1fr; } }
.pnl-ex .pnl-ex-role { display: grid; grid-template-columns: auto 1fr; align-items: center; gap: 0 6px; padding: 6px 8px; background: #fff;
  border: 2px solid var(--ink); border-radius: 12px; font: inherit; color: inherit; text-align: left; cursor: pointer; }
.pnl-ex .pnl-ex-role.on { background: var(--mint-l); box-shadow: inset 0 0 0 2px var(--mint-d); }
.pnl-ex .pnl-ex-role.off { background: var(--panel-2); color: var(--ink-l); cursor: default; }
.pnl-ex .pnl-ex-role .ic { grid-row: span 2; }
.pnl-ex .pnl-ex-role b { font-size: 16px; }
.pnl-ex .pnl-ex-role small { font-size: 13px; color: var(--ink-l); }
.pnl-ex .pnl-ex-role.lead { cursor: default; background: var(--sky-l); }
.pnl-ex .pnl-ex-eq { display: flex; flex-wrap: wrap; gap: 6px; }
.pnl-ex .pnl-ex-eq button { display: inline-flex; align-items: center; gap: 4px; padding: 4px 8px; border: 2px solid var(--ink); border-radius: 10px;
  background: #fff; font: inherit; font-size: 15px; color: inherit; cursor: pointer; }
.pnl-ex .pnl-ex-eq button.on { background: var(--mint-l); box-shadow: inset 0 0 0 2px var(--mint-d); }
.pnl-ex .pnl-ex-sum { display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 17px; justify-content: center; margin: 10px 0 4px; }
.pnl-ex .pnl-ex-sum span { display: inline-flex; align-items: center; gap: 4px; }
.pnl-ex .pnl-ex-go { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 6px; }
.pnl-ex .pnl-ex-go .btn { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0; line-height: 1.05; min-height: 54px; }
.pnl-ex .pnl-ex-go .btn small { font-size: 13px; font-weight: 700; opacity: .85; }
.pnl-ex .pnl-ex-why { text-align: center; font-size: 14px; color: var(--coral); margin: 4px 0 0; min-height: 1em; }
`;
let styleEl = null;
function injectStyle() {
  if (styleEl?.isConnected) return;
  styleEl = document.createElement('style');
  styleEl.id = 'pnl-ex-style';
  styleEl.textContent = CSS;
  document.head.append(styleEl);
}

/** "1 h 20 min" · "35 min" */
export function fmtRest(ms) {
  const m = Math.max(1, Math.ceil(ms / 60000));
  return m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}` : `${m} min`;
}

export function openExpedition(ctx, params = {}) {
  const { ui, audio, bus } = ctx;
  const X = ctx.expedition;
  const { h, esc } = ui;
  injectStyle();
  const sh = openShell(ctx, 'expedition', { title: 'Expedición', ic: 'map', sheet: true, className: 'pnl-md pnl-ex' });
  if (!sh) return;
  const fmt = ctx.economy.fmtNum;
  const st0 = X.expeditionStatus();
  let region = params.region && REGIONS[params.region] ? params.region : (ctx.state.expedition?.lastRegion || 'bosque');
  if (!st0.regions.find(r => r.id === region)?.open) region = 'bosque';
  let party = st0.party.slice();
  let equip = st0.equip.slice();

  function go(kind) {
    const st = X.expeditionStatus();
    const why = kind === 'daily' ? st.reasonDaily : kind === 'corta' ? st.reasonShort : st.reason;
    if (why) { audio.sfx('error'); ui.toast(why, { icon: 'info' }); return; }
    const res = kind === 'daily' ? X.startExpedition({ daily: true, party, equip }) : X.startExpedition({ region, kind, party, equip });
    if (res.error) { audio.sfx('error'); ui.toast(res.error, { icon: 'info' }); render(); return; }
    ctx.state.expedition.lastRegion = region;
    audio.sfx('tap');
    sh.close('go');
    ctx.router.go('expedition', { resume: true });
  }
  function resume() {
    audio.sfx('tap');
    sh.close('resume');
    ctx.router.go('expedition', { resume: true });
  }

  function walletCard(st) {
    const el = h('div.card');
    const mats = ctx.state.materials || {};
    el.append(h('h4.pnl-ex-h', { html: `${icon('bag', 20)}<span>En la ciudad</span>` }));
    el.append(h('div.pnl-ex-wallet', { html: `<span class="big" data-ex="prov">${icon(RESOURCES.prov.icon, 24)}${fmt(st.prov)}<small>/${fmt(st.provCap)}</small></span>`
      + REGION_MATERIALS.map(m => `<span title="${esc(m.name)}">${icon(m.icon, 20)}${fmt(mats[m.id] || 0)}</span>`).join('')
      + `<span title="Planos">${icon(RESOURCES.planos.icon, 20)}${fmt(ctx.state.planos || 0)}</span>` }));
    el.append(h('p.pnl-ex-tip', { html: `${icon('info', 16)}<span>Las provisiones salen de la Huerta y los otros productores. Una salida normal lleva hasta ${st.provMax}; lo que sobra vuelve.</span>` }));
    return el;
  }

  function regionsCard(st) {
    const el = h('div.card.pnl-ex-sec');
    const mapOpen = ctx.quests.mainDone?.('t11') || st.zones > 0;
    el.append(h('h4.pnl-ex-h', { html: `${icon('map', 20)}<span>${mapOpen ? 'Regiones' : 'Zonas'}</span><small>${st.zones} ${st.zones === 1 ? 'zona explorada' : 'zonas exploradas'}</small>` }));
    const list = h('div.pnl-ex-regs');
    for (const r of st.regions) {
      if (!mapOpen && r.id !== 'bosque') continue;
      const rg = REGIONS[r.id];
      const strong = Object.entries(rg.mats).filter(([, w]) => w >= 30).map(([m]) => icon(EXP_MATS[m].icon, 14)).join('');
      const btn = h('button.pnl-ex-reg' + (r.open ? '' : '.lock') + (r.id === region ? '.sel' : ''), { 'data-region': r.id });
      let right = r.open ? (r.done ? `<small>${icon('check', 14)} completa</small>` : `<small>Próxima: zona ${r.zone}</small>`)
        : `<small>${icon('lock', 14)} Rango ${esc(ctx.economy.rankName(r.rank))}</small>`;
      btn.innerHTML = `<span><b>${esc(r.name)}</b> <small>${strong}</small></span>${right}`;
      if (r.open) {
        const zs = h('div.pnl-ex-zones');
        for (let z = 1; z <= 5; z++) {
          const done = z <= r.explored, next = !r.done && z === r.zone;
          const n = r.stars[z] || 0;
          if (z > 1) zs.append(h('span.pnl-ex-link' + (z <= r.explored ? '.done' : '')));
          zs.append(h('span.pnl-ex-zone' + (done ? '.done' : next ? '.next' : ''), { html: `<i>${z}</i><em>${done ? '★'.repeat(n) : ''}</em>` }));
        }
        btn.append(zs);
        btn.onclick = () => { if (region !== r.id) { region = r.id; audio.sfx('tap'); render(); } };
      }
      list.append(btn);
    }
    el.append(list);
    const tip = [];
    if (st.expansion && st.expansion.missingZones > 0) tip.push(`${st.expansion.missingZones === 1 ? '1 zona más' : `${st.expansion.missingZones} zonas más`} para ampliar el terreno.`);
    else if (st.expansion?.ok) tip.push('Ya se puede ampliar el terreno desde la Municipalidad.');
    if (!mapOpen) tip.push('Las otras regiones aparecen al explorar la primera zona.');
    if (tip.length) el.append(h('p.pnl-ex-tip', { html: `${icon('info', 16)}<span>${tip.map(esc).join(' ')}</span>` }));
    return el;
  }

  function partyCard(st) {
    const el = h('div.card.pnl-ex-sec');
    const max = Math.max(0, st.partySlots - 1);
    el.append(h('h4.pnl-ex-h', { html: `${icon('people', 20)}<span>Grupo</span><small>${party.length}/${max} lugares + quien lidera</small>` }));
    const grid = h('div.pnl-ex-roles');
    grid.append(h('div.pnl-ex-role.lead', { html: `<span class="ic">${icon('🧑', 28)}</span><b>${esc(ctx.state.player.name)}</b><small>Lidera el grupo</small>` }));
    for (const id of ROLE_IDS) {
      const r = st.roles.find(x => x.id === id);
      const R = ROLES[id];
      if (!r) {
        const bname = ctx.data.BUILDING_BY_ID[R.building]?.name || '';
        grid.append(h('div.pnl-ex-role.off', { 'data-role': id, html: `<span class="ic">${icon(R.icon, 26)}</span><b>${esc(R.name)}</b><small>${icon('lock', 12)} Construí ${esc(bname)}</small>` }));
        continue;
      }
      const ch = X.roleChance(id, r.level);
      const on = party.includes(id);
      const line = r.tiredMs ? `Descansando: ${fmtRest(r.tiredMs)}` : ch ? `${esc(ch.text)} <span class="pnl-ex-p">${ch.p}%</span>` : esc(R.text);
      const btn = h('button.pnl-ex-role' + (on ? '.on' : '') + (r.tiredMs ? '.off' : ''), { 'data-role': id, 'aria-pressed': on ? 'true' : 'false',
        html: `<span class="ic">${icon(R.icon, 26)}</span><b>${esc(R.name)} ${r.level}</b><small>${line}</small>` });
      if (!r.tiredMs) btn.onclick = () => {
        if (on) party = party.filter(x => x !== id);
        else if (party.length < max) party = [...party, id];
        else if (max === 1) party = [id];
        else { audio.sfx('error'); ui.toast(`Entran ${max} en el grupo: mejorá la Casa de Expediciones para sumar lugar`, { icon: 'people' }); return; }
        audio.sfx('tap');
        render();
      };
      grid.append(btn);
    }
    el.append(grid);
    return el;
  }

  function equipCard(st) {
    const el = h('div.card.pnl-ex-sec');
    el.append(h('h4.pnl-ex-h', { html: `${icon('🪢', 20)}<span>Equipo</span><small>${equip.length}/${st.equipSlots} lugares</small>` }));
    const have = ctx.state.equipment || {};
    const ids = Object.keys(EQUIPMENT).filter(id => (have[id] || 0) > 0);
    if (!st.equipSlots) el.append(h('p.pnl-ex-tip', { html: `${icon('info', 16)}<span>Con el Taller se fabrica equipo: cuerdas, palas, faroles.</span>` }));
    else if (!ids.length) el.append(h('p.pnl-ex-tip', { html: `${icon('info', 16)}<span>No hay equipo hecho. Se fabrica en el Taller.</span>` }));
    else {
      const row = h('div.pnl-ex-eq');
      for (const id of ids) {
        const it = EQUIPMENT[id], on = equip.includes(id);
        const b = h('button' + (on ? '.on' : ''), { 'data-equip': id, title: X.equipText(id), html: `${icon(it.icon, 20)}${esc(it.name)} <small>×${have[id]}</small>` });
        b.onclick = () => {
          if (on) equip = equip.filter(x => x !== id);
          else if (equip.length < st.equipSlots) equip = [...equip, id];
          else if (st.equipSlots === 1) equip = [id];
          else { audio.sfx('error'); ui.toast(`Entran ${st.equipSlots} cosas: mejorá el Taller para llevar más`, { icon: 'info' }); return; }
          audio.sfx('tap');
          render();
        };
        row.append(b);
      }
      el.append(row);
    }
    if (st.equipSlots) {
      const w = h('button.btn.ghost.sm', { html: `${icon('hammer', 16)} Ir al Taller`, style: { marginTop: '6px' } });
      w.onclick = () => { audio.sfx('tap'); sh.close(); ctx.openPanel('workshop'); };
      el.append(w);
    }
    return el;
  }

  function render() {
    const st = X.expeditionStatus();
    // lo elegido puede dejar de valer (alguien quedó cansado, se gastó el equipo)
    const avail = st.roles.filter(r => !r.tiredMs).map(r => r.id);
    party = party.filter(id => avail.includes(id)).slice(0, Math.max(0, st.partySlots - 1));
    const have = ctx.state.equipment || {};
    equip = equip.filter(id => (have[id] || 0) > 0).slice(0, st.equipSlots);
    const body = sh.body;
    body.innerHTML = '';
    if (!st.hasBase) {
      body.append(h('div.card', { html: `<h4 class="pnl-ex-h">${icon('lock', 20)}<span>Falta la base</span></h4><p class="pnl-ex-tip">Construí la Casa de Expediciones (Construir → Expedición) para armar el primer grupo.</p>` }));
      return;
    }
    if (st.active) {
      const a = h('div.card.pnl-ex-active', { html: `${icon('🧭', 30)}<span><b>Salida en curso</b><br><small>${esc(st.active.name || '')}, ${st.active.kind === 'corta' ? 'salida corta' : `zona ${st.active.zone}`} · ${st.active.steps} pasos</small></span>` });
      const b = h('button.btn.primary', { 'data-ex-go': 'resume', html: `${icon('play', 18)} Retomar` });
      b.onclick = resume;
      a.append(b);
      body.append(a);
    }
    body.append(walletCard(st), regionsCard(st), partyCard(st), equipCard(st));
    const ri = st.regions.find(r => r.id === region);
    const cargo = X.cargoMax(equip);
    const morale = 8 + (party.includes('sanidad') ? 2 : 0);
    body.append(h('div.pnl-ex-sum', { html: `<span>${icon(RESOURCES.prov.icon, 18)}${st.provTake} provisiones</span><span>${icon('🎒', 18)}carga ${cargo}</span><span>${icon('heart', 18)}ánimo ${morale}</span>` }));
    const goRow = h('div.pnl-ex-go');
    const nb = h('button.btn.primary', { 'data-ex-go': 'normal', disabled: !st.canNormal, html: `<span>${icon('map', 18)} Salir</span><small>${ri?.done ? 'recorrido' : `zona ${ri?.zone || 1}`} · ${st.provTake} prov.</small>` });
    nb.onclick = () => go('normal');
    const cb = h('button.btn.second', { 'data-ex-go': 'corta', disabled: !st.canShort, html: `<span>${icon('🥪', 18)} Salida corta</span><small>${st.canShort ? 'gratis hoy' : st.active ? 'en curso' : 'mañana'}</small>` });
    cb.onclick = () => go('corta');
    goRow.append(nb, cb);
    body.append(goRow);
    // Expedición del día (Fase 7b): misma salida para todo el mundo, sin gastar provisiones; el botín va al ranking
    const d = st.daily;
    if (d && st.hasBase) {
      const db = h('button.btn.gold.pnl-ex-daily', { 'data-ex-go': 'daily', disabled: !st.canDaily, style: { width: '100%', marginTop: '8px' },
        html: `<span>${icon('trophy', 18)} Expedición del día</span><small>${esc(d.regionName || '')} · ${d.done ? (d.last ? `hecha: ${d.last.score} de botín` : 'en curso') : 'la misma para todo el mundo · sin provisiones'}</small>` });
      db.onclick = () => go('daily');
      body.append(db);
    }
    body.append(h('p.pnl-ex-why', {}, st.active ? 'Primero terminá la salida en curso.' : (st.reason || '')));
  }

  render();
  sh.every(15000, render);
  sh.on(bus, 'resources:changed', () => render());
  return sh.done;
}
