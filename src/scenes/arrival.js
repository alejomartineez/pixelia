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
.arrival-modal .arr-day { width: 26px; height: 26px; display: grid; place-items: center; border: 2px solid var(--edge); border-radius: 8px; background: var(--surface); font-size: 12px; font-weight: 700; }
.arrival-modal .arr-day.past { background: var(--mint-l); }
.arrival-modal .arr-day.today { background: var(--gold); transform: translateY(-2px); box-shadow: 0 2px 0 var(--shade); }
.arrival-modal .arr-open { padding: 6px 10px; border: 2px solid var(--edge); border-radius: 12px; background: var(--gold-l); }
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
 * parts: { welcome, v3Lines, v3Gems, v4Lines, v4Reward, threats: {lines, reward}, login, unlock, next, firstDay, light }
 * light: la app siguió abierta (pasó la medianoche, volviste de una expedición): avisos cortos en vez del modal.
 * hooks: { claimWelcome(), claimLogin() } — se llaman al tocar el botón.
 */
export async function openArrival(ctx, parts, hooks = {}) {
  if (parts.light) return openLight(ctx, parts, hooks);
  ensureStyle();
  const lines = [];
  const total = {};
  const sec = (txt) => lines.push(`<span class="arr-sec">${txt}</span>`);
  const { welcome, v3Lines, v4Lines, threats, login, unlock, next } = parts;

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
  if (v4Lines?.length) {
    sec('La isla cambió');
    lines.push('Pixelia se pone más seria: la isla tiene una historia por contar y la ciudad se prepara para eso.');
    lines.push(...v4Lines);
    if (parts.v4Reward) addTo(total, parts.v4Reward);
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
    className: 'arrival-modal' + (v3Lines?.length || v4Lines?.length ? ' v3-notice' : ''),
  });
  try { if (welcome) hooks.claimWelcome?.(); } catch (e) { console.error(e); }
  try { if (login) hooks.claimLogin?.(); } catch (e) { console.error(e); }
  return val;
}

/** Aviso liviano con la app abierta: el premio del día se cobra solo y cada novedad sale en un aviso corto. */
function openLight(ctx, parts, hooks = {}) {
  const { threats, login, unlock } = parts;
  if (parts.firstDay && login) login.first = true;
  const plain = (html) => { const d = document.createElement('div'); d.innerHTML = html; return d.textContent.replace(/\s+/g, ' ').trim(); };
  if (login) {
    try { hooks.claimLogin?.(); } catch (e) { console.error(e); }
    const r = login.reward || {};
    const got = [r.coins && `${ctx.economy.fmtNum(r.coins)} monedas`, r.gems && `${r.gems} gemas`, r.chest && (CHEST_NAME[r.chest] || 'un cofre')].filter(Boolean).join(', ');
    const streak = login.streak > 1 ? `racha de ${login.streak} días` : 'día 1 de la racha';
    ctx.ui.toast(`${login.first ? 'Premio de tu primer día' : `Empezó un día nuevo (${streak})`}${got ? `: ${got}` : ''}`, { icon: login.streak > 1 ? 'fire' : 'calendar', type: 'good' });
  }
  for (const l of threats?.lines || []) ctx.ui.toast(plain(l), { icon: 'info' });
  if (unlock) ctx.ui.toast(`Hoy se abre: ${unlock.name}`, { icon: unlock.icon || 'sparkle', type: 'good' });
  // primer día (sin el modal: plan §E7): lo que se abre mañana también se cuenta
  if (parts.firstDay && parts.next?.when === 'mañana') setTimeout(() => ctx.ui.toast(`Mañana se abre: ${parts.next.name}`, { icon: parts.next.icon || 'clock' }), 900);
  return Promise.resolve('ok');
}
