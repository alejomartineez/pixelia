// Calendario de amenazas (DESIGN-CORE.md §3.1). Puro: solo fechas. Temporadas de 28 días desde la época fija
// (EPOCH de season-data.js, lunes 2026-11-02, hora local). Mismo calendario para todo el mundo.
import { EPOCH, SEASON_DAYS } from '../season/season-data.js';
import {
  THREAT_DAYS, DAYS_BY_RANK, ORDER, THREAT_TYPES, OPEN_HOUR, WARN_DAYS, WARN_DAYS_OBSERVATORY, SIGNS_HOURS,
} from './threat-data.js';

const H = 3600e3;
/** 00:00 local del día n desde la época (igual que epochDay de season.js; respeta cambios de horario). */
const dayMs = (n, hour = 0) => new Date(EPOCH.y, EPOCH.m, EPOCH.d + n, hour).getTime();
/** Días calendario desde la época (igual que dayIndex de season.js). */
export function dayIndexAt(now) {
  const d = new Date(now);
  return Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - new Date(EPOCH.y, EPOCH.m, EPOCH.d)) / 864e5);
}
export const seasonOf = (now) => Math.max(0, Math.floor(dayIndexAt(now) / SEASON_DAYS));

/** Tipos abiertos para un rango (en el orden de ORDER). */
export const openTypes = (rank) => ORDER.filter(t => THREAT_TYPES[t].rank <= rank);
/** Tipo del turno i de la temporada s: ORDER[(s·4+i) % 5], o el siguiente abierto del orden. */
export function typeFor(s, i, rank) {
  const base = (s * 4 + i) % ORDER.length;
  for (let k = 0; k < ORDER.length; k++) {
    const t = ORDER[(base + k) % ORDER.length];
    if (THREAT_TYPES[t].rank <= rank) return t;
  }
  return null;
}

/** Arma la amenaza i de la temporada s (sin mirar si te toca). */
export function makeThreat(s, i, rank, { observatory = false } = {}) {
  const day = s * SEASON_DAYS + THREAT_DAYS[i];
  const start = dayMs(day, OPEN_HOUR), end = dayMs(day + 1);
  const warn = observatory ? WARN_DAYS_OBSERVATORY : WARN_DAYS;
  return { id: `${s}-${i}`, s, i, day, type: typeFor(s, i, rank), announce: dayMs(day - warn, OPEN_HOUR), signs: start - SIGNS_HOURS * H, start, end };
}
/** Amenazas de la temporada s que le tocan a un rango (2–3: días 12 y 26; 4–5: 5, 12 y 26; 6+: los 4). */
export function schedule(seasonIndex, rank, opts) {
  return DAYS_BY_RANK(rank).map(i => makeThreat(seasonIndex, i, rank, opts)).filter(t => t.type);
}
/** Próxima amenaza que todavía no terminó (esta temporada o la siguiente). */
export function nextThreat(now, rank, opts) {
  const s = seasonOf(now);
  for (const t of [...schedule(s, rank, opts), ...schedule(s + 1, rank, opts)]) if (t.end > now) return t;
  return null;
}
/** Amenazas que terminan en (a, b]. */
export function threatsBetween(a, b, rank, opts) {
  const out = [];
  for (let s = Math.max(0, seasonOf(a) - 1); s <= seasonOf(b); s++) for (const t of schedule(s, rank, opts)) if (t.end > a && t.end <= b) out.push(t);
  return out;
}
/** 'lejos' | 'aviso' | 'señales' | 'hoy' | 'pasada'. */
export function phase(t, now) {
  if (!t) return 'lejos';
  if (now < t.announce) return 'lejos';
  if (now < t.signs) return 'aviso';
  if (now < t.start) return 'señales';
  if (now < t.end) return 'hoy';
  return 'pasada';
}
/** Simulacro del tutorial: avisado ahora, llega ≥ 16 h después (al día siguiente) y se puede enfrentar ≥ 12 h. */
export function makeSim(announcedAt, delayH = 16, windowH = 12) {
  const start = announcedAt + delayH * H;
  const d = new Date(start);
  const midnight = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
  return { id: 'sim', s: -1, i: -1, day: dayIndexAt(start), type: 'crecida', announce: announcedAt, signs: Math.max(announcedAt, start - SIGNS_HOURS * H), start, end: Math.max(midnight, start + windowH * H) };
}
/** "en 4 días", "mañana", "hoy hasta las 23:59", "en 5 h". */
export function whenText(t, now) {
  const ph = phase(t, now);
  if (ph === 'hoy') return t.id === 'sim' ? 'hoy, hasta las ' + new Date(t.end - 60e3).toTimeString().slice(0, 5) : 'hoy, hasta las 23:59';
  if (ph === 'pasada') return 'ya pasó';
  const ms = t.start - now;
  if (ms < 20 * H) return `en ${Math.max(1, Math.round(ms / H))} h`;
  const days = dayIndexAt(t.start) - dayIndexAt(now);
  return days <= 1 ? 'mañana' : `en ${days} días`;
}
