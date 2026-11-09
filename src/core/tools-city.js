// Las herramientas de la gente de la ciudad, en la ciudad (plan L5; paso 7, DESIGN-COMBAT.md §15.3). Puro: lee
// state.people directo (sin importar people.js, que importa economy.js) para que economy.js y las amenazas lo usen sin
// ciclos.
//   - Martillo (Brígida): las obras salen más baratas. −2 % de monedas por nivel (hasta −10 %) al construir y al mejorar
//     edificios de la ciudad. No toca el expediente de la Municipalidad, Mi Casa ni los monumentos.
//   - Farol de guardia (Ramiro): más preparación contra las amenazas. +4 puntos por nivel (hasta +20) sobre la
//     preparación de cobertura y reservas, sin pasar de 100.
// Los números se balancearon con sim:economy (DESIGN-CORE §8): ver "Herramientas en la ciudad" en el reporte.
export const TOOL_CITY = {
  martillo: { owner: 'brigida', discount: 0.02 },
  farol: { owner: 'ramiro', prep: 0.04 },
};
const MAX = 5;

/** Nivel de una herramienta en la partida (0 si su dueño no llegó). */
export function cityToolLevel(state, tool) {
  const t = TOOL_CITY[tool];
  const o = t && state?.people?.list?.[t.owner];
  return o && o.arrived ? Math.max(0, Math.min(MAX, o.tool | 0)) : 0;
}
/** Multiplicador de monedas de las obras (1 sin Martillo, 0,90 con el Martillo en 5). */
export const buildCoinMult = (state) => 1 - TOOL_CITY.martillo.discount * cityToolLevel(state, 'martillo');
/** Preparación extra contra las amenazas (0 a 0,20). */
export const threatPrepBonus = (state) => TOOL_CITY.farol.prep * cityToolLevel(state, 'farol');
