// Amenazas de temporada (DESIGN-CORE.md §3): todos los números en un solo lugar para calibrarlos con tools/sim-threats.mjs.
// Puro (sin DOM, three.js ni store): lo usan threat-rules, threat-calendar y la simulación en Node.
import { DEFENSES, RESERVES } from '../core/data.js';

// ---------- Calendario (§3.1) ----------
export const THREAT_DAYS = [5, 12, 19, 26];            // días de la temporada (0 = lunes); todos sábados
export const DAYS_BY_RANK = (rank) => (rank >= 6 ? [0, 1, 2, 3] : rank >= 4 ? [0, 1, 3] : rank >= 2 ? [1, 3] : []);   // índices de THREAT_DAYS
// La Grieta (src/core/raiz.js, L1) suma amenazas: primero los sábados que le falten al rango y después los miércoles
// (índices 4 y 5 de ALL_DAYS, días 9 y 23). grietaExtra(g) dice cuántas.
export const EXTRA_DAYS = [9, 23];
export const ALL_DAYS = [...THREAT_DAYS, ...EXTRA_DAYS];
const EXTRA_ORDER = [2, 0, 1, 3, 4, 5];
/** Índices de ALL_DAYS que le tocan a un rango con `extra` amenazas más por la Grieta (en orden de fecha). */
export function daysFor(rank, extra = 0) {
  const base = DAYS_BY_RANK(rank);
  if (!base.length || !(extra > 0)) return base;
  const out = base.slice();
  for (const i of EXTRA_ORDER) { if (out.length >= base.length + extra) break; if (!out.includes(i)) out.push(i); }
  return out.sort((a, b) => ALL_DAYS[a] - ALL_DAYS[b]);
}
export const ORDER = ['crecida', 'incendio', 'tormenta', 'sequia', 'helada'];
export const OPEN_HOUR = 8;                              // de 08:00 a 23:59 se puede enfrentar
export const WARN_DAYS = 4;                              // aviso 4 días antes a las 08:00 (6 con el Observatorio)
export const WARN_DAYS_OBSERVATORY = 6;
export const SIGNS_HOURS = 48;                           // últimas 48 h: señales en la ciudad
export const MIN_RANK = 2;                               // hace falta rango Caserío al momento del aviso
export const SIM_DELAY_H = 16;                           // el simulacro llega ≥ 16 h después del aviso, al día siguiente
export const SIM_WINDOW_H = 12;                          // y se puede enfrentar al menos 12 h
export const AUTO_REPAIR_H = 72;                         // a las 72 h la vecindad lo arregla sola
export const RESULTS_KEEP = 12;
export const LATE_DAYS = 3;                              // amenazas sin aviso visto: se resuelven si pasaron hace ≤ 3 días

// ---------- Tipos (§3.2) ----------
// rank: abre en ese rango · edge: de dónde viene ('px' arroyo, 'nz' monte/norte, 'all' bordes) · defense · reserve ·
// repair: material de reparación · eraBonus: [época mínima, +eficacia] · damagedLook: cómo se ve el daño
export const THREAT_TYPES = {
  crecida: { id: 'crecida', name: 'Crecida del arroyo', short: 'Crecida', icon: 'flood', rank: 2, edge: 'px', defense: 'dique', reserve: 'arena',
    repair: 'piedra', eraBonus: [2, 0.1], verb: 'el agua', past: 'Pasó la crecida', look: 'barro',
    risk: 'Las casas y negocios a 4 casillas o menos del arroyo.', sign: 'El arroyo viene alto y turbio.' },
  sequia: { id: 'sequia', name: 'Sequía', short: 'Sequía', icon: 'drought', rank: 2, edge: 'all', defense: 'granero', reserve: 'tinajas',
    repair: 'hierbas', eraBonus: null, verb: 'la sequía', past: 'Pasó la sequía', look: 'polvo',
    risk: 'Los productores de provisiones: huertas, tambos, molinos.', sign: 'Hace días que no llueve y el pasto amarillea.' },
  incendio: { id: 'incendio', name: 'Incendio de monte', short: 'Incendio', icon: 'fire', rank: 3, edge: 'nz', defense: 'bomberos', reserve: 'baldes',
    repair: 'madera', eraBonus: [2, 0.3], verb: 'el fuego', past: 'Se apagó el incendio', look: 'humo',
    risk: 'Lo que es de madera, primero lo que está cerca del monte.', sign: 'Se ve humo detrás del monte.' },
  tormenta: { id: 'tormenta', name: 'Tormenta eléctrica', short: 'Tormenta', icon: 'storm', rank: 3, edge: null, defense: 'pararrayos', reserve: 'lonas',
    repair: 'mineral', eraBonus: [4, 0.2], verb: 'los rayos', past: 'Pasó la tormenta', look: 'lona',
    risk: 'Los edificios más altos.', sign: 'El cielo se carga y sopla un viento raro.' },
  helada: { id: 'helada', name: 'Helada', short: 'Helada', icon: 'frost', rank: 4, edge: 'nz', defense: 'refugio', reserve: 'lena',
    repair: 'madera', eraBonus: [3, 0.2], verb: 'la escarcha', past: 'Pasó la helada', look: 'escarcha',
    risk: 'Casas y productores; la escarcha baja por los caminos desde el norte.', sign: 'Amanece con escarcha en los techos.' },
};
export const SIM = { id: 'sim', type: 'crecida', f: 1, name: 'Simulacro de crecida' };

// ---------- Preparación (§3.3) ----------
export const AT_RISK_BASE = 3;                           // enRiesgo = min(candidatos, 3 + f)
export const FLOOD_DIST = 4;                             // crecida: a ≤ 4 tiles del arroyo
export const EFF_BASE = 0.6, EFF_PER_LEVEL = 0.08;       // eficacia de una defensa de nivel L
export const HOSPITAL_BONUS = 0.1;
export const PREP_W_COVER = 0.5, PREP_W_RESERVES = 0.5;   // antes 0,6 y 0,4 (rebalanceo con varias semillas, DESIGN-CORE §8.z)
export const effOf = (level) => Math.min(1, EFF_BASE + EFF_PER_LEVEL * Math.max(1, level || 1));
export const defenseRadius = (id, level = 1) => { const t = DEFENSES[id]?.radius; return t ? t[Math.max(1, Math.min(t.length, level || 1)) - 1] : 0; };
export const reserveFor = (type) => THREAT_TYPES[type]?.reserve;
export const reserveDef = (type) => RESERVES[reserveFor(type)];

// ---------- Escena de defensa (§3.4) ----------
export const turnsFor = (f) => 5 + Math.ceil(f / 2);
export const fociFor = (f) => 1 + Math.floor(f / 3);
export const crewsFor = (colonos = 0, hospital = false) => Math.min(6, 2 + Math.floor((colonos || 0) / 5) + (hospital ? 1 : 0));
export const MAX_LEVEL = 3;                              // nivel de amenaza por tile
export const HIT_LEVEL = 2;                              // golpea con nivel ≥ 2 sobre el lote
export const HITS_TO_DAMAGE = 2;
export const SPREAD_FROM = 2;                            // un tile se extiende desde el nivel 2
export const START_LEVEL = 2;                            // los focos arrancan en nivel 2
// Entrada continua: cada turno la amenaza vuelve a entrar por su borde en `inflowFor(f)` tiles (el agua sigue bajando
// del arroyo, el fuego del monte…), en nivel INFLOW_LEVEL. Una reserva sobre el borde la frena ahí para siempre.
export const inflowFor = (f) => 2 + Math.floor(f / 2);
export const INFLOW_LEVEL = 2;

// ---------- Resolución automática (§3.5) ----------
export const AUTO = { base: 40, perPrep: 60, min: 30, max: 95 };   // base 35 → 40 (rebalanceo con varias semillas, DESIGN-CORE §8.z)

// ---------- Premios (§3.7) ----------
export function rewardFor(pct, f) {
  if (pct >= 90) return { gems: 10, coins: 200 * f, mats: 6, planoChance: pct >= 100 ? 1 : 0.5, chest: 'plata' };
  if (pct >= 75) return { gems: 6, coins: 150 * f, mats: 4, planoChance: 0.25 };
  if (pct >= 50) return { gems: 4, coins: 100 * f, mats: 2, planoChance: 0 };
  return { gems: 2, coins: 0, mats: 0, planoChance: 0 };
}
export const sparksFor = (pct) => 40 + Math.round(0.6 * pct);
export const PERFECT_TITLE = 'Sin un rasguño';

// ---------- Reparación (§3.6) ----------
export const repairCost = (baseCoins, level, type) => ({
  coins: Math.max(50, Math.round(0.15 * (baseCoins || 0) * Math.max(1, level || 1))),
  mats: { [THREAT_TYPES[type]?.repair || 'madera']: 1 + Math.floor(Math.max(1, level || 1) / 2) },
});
