// Panel de eventos: activos (con tiempo restante y progreso) y próximos.
import { h, esc, modal } from '../core/ui.js';
import { icon } from '../core/icons.js';
import { bus } from '../core/bus.js';
import { fmtNum } from '../core/economy.js';
import { activeEvents, upcomingEvents } from './events.js';
import { seasonInfo, toMs, dayIndex } from './season.js';
import { useStyle, setTheme, partIcon, partLabel } from './season-ui-common.js';

const MULT_NAMES = {
  production: 'Producción', chestDrop: 'Cofres en minijuegos', stickers: 'Figuritas', match3Rewards: 'Joyas Brillantes',
  blocksRewards: 'Bloques Pixel', parkingRewards: 'Estacionamiento', drivingRewards: 'Ruta Pixel',
};
const DAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const fmtMult = (x) => '×' + String(Math.round(x * 100) / 100).replace('.', ',');

function rewardParts(r) {
  const out = [];
  if (r.coins) out.push({ kind: 'coins', amount: r.coins });
  if (r.gems) out.push({ kind: 'gems', amount: r.gems });
  if (r.chest) out.push({ kind: 'chest', type: r.chest, n: 1 });
  if (r.stickers) out.push({ kind: 'stickers', n: r.stickers.n, minStars: r.stickers.minStars || 1 });
  return out;
}
/** Premio compacto (ícono + número) para los escalones. */
function compact(p) {
  const n = p.kind === 'coins' || p.kind === 'gems' ? fmtNum(p.amount) : '×' + (p.n || 1);
  return `<span class="ssn-rw-i" title="${esc(partLabel(p))}">${partIcon(p, 22)}<b>${n}</b></span>`;
}
function startsLabel(e, t) {
  const d = dayIndex(e.startsAt) - dayIndex(t);
  if (d <= 0) return 'Empieza hoy';
  if (d === 1) return 'Empieza mañana';
  return `Empieza el ${DAYS[new Date(e.startsAt).getDay()]}`;
}

function eventCard(e) {
  const chips = Object.entries(e.mult).filter(([, v]) => v !== 1)
    .map(([k, v]) => `<span class="chip gold">${esc(MULT_NAMES[k] || k)} ${fmtMult(v)}</span>`);
  if (e.flags.trade5) chips.push(`<span class="chip second">${icon('star', 14)} Intercambio de figuritas 5★</span>`);
  let race = '';
  if (e.progress) {
    const p = e.progress;
    const pct = Math.min(1, p.cur / p.max) * 100;
    race = `<div class="ssn-race">
      <div class="row between"><b>${icon('star', 18)} ${fmtNum(p.cur)} estrellas</b><small class="muted">${p.complete ? '¡Completaste la carrera!' : `Próximo escalón: ${p.next}`}</small></div>
      <div class="ssn-race-bar"><i style="width:${pct.toFixed(1)}%"></i>
        ${p.tiers.map(tr => `<span class="ssn-race-mk" style="left:${(tr.goal / p.max * 100).toFixed(1)}%">${icon(tr.done ? 'star' : 'starOff', 24)}</span>`).join('')}</div>
      <div class="ssn-race-tiers">${p.tiers.map((tr, i) => `<div class="ssn-race-tier${tr.done ? ' done' : ''}">
        <b>${tr.done ? icon('check', 14) : ''}Escalón ${i + 1}</b><small>${tr.goal} estrellas</small>
        <span class="ssn-rw">${rewardParts(tr.reward).map(compact).join('')}</span></div>`).join('')}</div>
    </div>`;
  }
  return `<div class="ssn-ev" style="--ec:${e.color};--ecd:${e.dark}">
    <div class="ssn-ev-head"><div class="ssn-ev-ic">${icon(e.emoji, 40)}</div>
      <div class="col"><h3>${esc(e.title)}</h3><span class="ssn-clock">${icon('clock', 16)} Termina en <b>${e.endsIn}</b></span></div></div>
    <div class="ssn-ev-body"><p>${esc(e.description)}</p>${chips.length ? `<div class="row wrap">${chips.join('')}</div>` : ''}${race}</div>
  </div>`;
}

/** Panel de eventos activos + próximos. now opcional (pruebas). */
export function openEventsPanel(ctx, now) {
  const fixed = now != null;
  const T = () => (fixed ? toMs(now) : Date.now());
  const release = useStyle();
  const wrap = h('div.ssn-wrap');
  const offs = [];
  const m = modal({
    title: 'Eventos', icon: 'calendar', content: wrap, className: 'ssn ssn-events',
    onClose: () => { clearInterval(timer); offs.forEach(f => f()); release(); },
  });
  setTheme(m.el, seasonInfo(T()).theme);

  function render() {
    const t = T();
    const act = activeEvents(t);
    const soon = upcomingEvents(t, 3);
    let html = act.length ? act.map(eventCard).join('')
      : `<div class="ssn-empty">${icon('calendar', 48)}<h3>Ahora no hay eventos</h3><p class="muted">Ya viene uno: mirá abajo cuándo empieza.</p></div>`;
    if (soon.length) {
      html += `<div class="ssn-soon"><h4>Próximamente</h4>${soon.map(e => `<div class="ssn-soon-row">${icon(e.emoji, 28)}
        <span><b>${esc(e.title)}</b><br><small>${startsLabel(e, t)} · ${esc(e.short)}</small></span>
        <span class="chip">${icon('clock', 14)} ${e.startsIn}</span></div>`).join('')}</div>`;
    }
    html += `<p class="ssn-note">${icon('heart', 14)} Los eventos son un mimo extra: si un día no podés jugar, no te perdés nada importante.</p>`;
    wrap.innerHTML = html;
  }
  render();
  offs.push(bus.on('events:changed', render));
  const timer = setInterval(render, 30e3);
  return m;
}
