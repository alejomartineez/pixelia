// Llegada a la ciudad: un solo modal "Mientras no estabas…" (DESIGN-CORE.md §3.5 y §6.2, Fase 5b) que junta lo que antes
// eran varios al arrancar: el regalo de bienvenida (después de días sin entrar), el aviso de que los minijuegos se
// retiraron (una vez, partidas de antes de la v3), las amenazas que se resolvieron solas, el premio del día con la racha y
// la función que se abre hoy (y la de mañana). main.js arma las partes; acá se dibujan y se cobran al cerrar.
import { icon } from '../core/icons.js';
import { rewardModal } from '../core/ui.js';
import { LOGIN_REWARDS } from '../core/data.js';

const STYLE = `
.arrival-modal .arr-sec { margin: 0 0 4px; font-size: 13px; font-weight: 700; letter-spacing: .02em; text-transform: uppercase; color: var(--ink-l); }
.arrival-modal .arr-days { display: flex; gap: 4px; justify-content: center; margin: 2px 0 6px; }
.arrival-modal .arr-day { width: 26px; height: 26px; display: grid; place-items: center; border: 2px solid var(--ink); border-radius: 8px; background: #fff; font-size: 12px; font-weight: 700; }
.arrival-modal .arr-day.past { background: var(--mint-l); }
.arrival-modal .arr-day.today { background: var(--gold); transform: translateY(-2px); box-shadow: 0 2px 0 var(--ink); }
.arrival-modal .arr-open { padding: 6px 10px; border: 2px solid var(--ink); border-radius: 12px; background: var(--gold-l); }
.arrival-modal .arr-next { color: var(--ink-l); font-size: 14px; }
`;
let styled = false;
function ensureStyle() {
  if (styled) return;
  styled = true;
  const el = document.createElement('style');
  el.textContent = STYLE;
  document.head.append(el);
}
const addTo = (total, r = {}) => {
  for (const k of ['coins', 'gems', 'xp', 'prov', 'planos']) if (r[k]) total[k] = (total[k] || 0) + r[k];
  for (const [k, v] of Object.entries(r.mats || {})) { total.mats = total.mats || {}; total.mats[k] = (total.mats[k] || 0) + v; }
};
const CHEST_NAME = { madera: 'Cofre de Madera', plata: 'Cofre de Plata', oro: 'Cofre de Oro', diamante: 'Cofre de Diamante' };

/**
 * parts: { welcome, v3Lines, v3Gems, threats: {lines, reward}, login, unlock, next, firstDay }
 * hooks: { claimWelcome(), claimLogin() } — se llaman al tocar el botón.
 */
export async function openArrival(ctx, parts, hooks = {}) {
  ensureStyle();
  const lines = [];
  const total = {};
  const sec = (txt) => lines.push(`<span class="arr-sec">${txt}</span>`);
  const { welcome, v3Lines, threats, login, unlock, next } = parts;

  if (welcome) {
    sec('Bienvenida de vuelta');
    const ch = welcome.chests ? ` y ${welcome.chests === 1 ? `un ${CHEST_NAME[welcome.chestType] || 'cofre'}` : `${welcome.chests} cofres`}` : '';
    lines.push(`${icon('gift', 20)} ${ctx.ui.esc(welcome.message)}${ch ? ` Te espera${welcome.chests > 1 ? 'n' : ''}${ch}.` : ''}`);
    addTo(total, welcome.reward);
  }
  if (v3Lines?.length) {
    sec('Los minijuegos se retiraron');
    lines.push('Pixelia ahora gira alrededor de las expediciones: salir, traer lo que hace falta y volver a la ciudad.');
    lines.push(...v3Lines);
    if (parts.v3Gems) addTo(total, { gems: parts.v3Gems });
  }
  if (threats?.lines?.length) {
    sec('En la ciudad');
    lines.push(...threats.lines);
    addTo(total, threats.reward);
  }
  if (login) {
    sec('Premio del día');
    const days = LOGIN_REWARDS.map((_, i) => `<span class="arr-day ${i + 1 < login.day ? 'past' : i + 1 === login.day ? 'today' : ''}">${i + 1}</span>`).join('');
    lines.push(`<span class="arr-days">${days}</span>`);
    const streak = login.streak > 1 ? `Racha de <b>${login.streak}</b> días.` : 'Día 1 de la racha.';
    const shield = login.shielded ? ' Ayer faltaste, pero la racha quedó en pausa en vez de cortarse.' : '';
    const chest = login.reward.chest ? ` Trae un ${CHEST_NAME[login.reward.chest] || 'cofre'}.` : '';
    lines.push(`${icon(login.streak > 1 ? 'fire' : 'calendar', 20)} ${streak}${shield}${chest}`);
    addTo(total, login.reward);
  }
  if (unlock) lines.push(`<span class="arr-open">${icon(unlock.icon || 'sparkle', 20)} Hoy se abre: <b>${ctx.ui.esc(unlock.name)}</b>.</span>`);
  if (next) lines.push(`<span class="arr-next">${icon('clock', 16)} ${next.when === 'mañana' ? `Mañana se abre: ${ctx.ui.esc(next.name)}.` : `${ctx.ui.esc(next.name[0].toUpperCase() + next.name.slice(1))} se abre ${next.when}.`}</span>`);

  const anyReward = Object.keys(total).length > 0;
  const val = await rewardModal({
    title: parts.firstDay ? 'Tu primer día' : 'Mientras no estabas…',
    lines,
    reward: total,
    buttons: [{ label: anyReward ? 'Cobrar' : 'Ver la ciudad', value: 'ok', cls: anyReward ? 'gold' : 'primary' }],
    className: 'arrival-modal' + (v3Lines?.length ? ' v3-notice' : ''),
  });
  try { if (welcome) hooks.claimWelcome?.(); } catch (e) { console.error(e); }
  try { if (login) hooks.claimLogin?.(); } catch (e) { console.error(e); }
  return val;
}
