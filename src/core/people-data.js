// La gente de la ciudad que trae una herramienta (El Quiebre, paso 5b segunda parte: L5 de docs/PLAN-QUIEBRE.md;
// DESIGN-COMBAT.md §15). Puro: sin store ni DOM (se importa desde Node). El estado y los eventos están en
// src/core/people.js.
//
// - Cada persona llega con una condición (desde el inicio, un rango o una zona explorada), dice 2 líneas y deja un dato
//   del mundo.
// - Vínculo 1..5: arranca en 1 al llegar y sube un nivel con cada encargo cumplido (4 por persona; algunos son de la
//   historia: una marca de story.flags).
// - Herramienta 0..5: llega en nivel 1 con la persona. Cada nivel de Vínculo deja subirla un nivel más, pagando
//   monedas y materiales de región en el Taller (TOOL_COST).
// - Efectos: en el combate, b.tools (COMBAT.catalejo, trapBonus, climb, healBonus y guard de combat-data); en la
//   expedición, TOOL_EXP (visión, bonos a las decisiones y ánimo).

/** Tipos de encargo: expedition (volver de N salidas, de una región si dice region), zone (explorar N zonas),
 *  combatWin (ganar N peleas), threat (aguantar N amenazas), deliver (entregar materiales: se paga al cumplirlo),
 *  flag (una marca de la historia). */
export const PEOPLE = {
  vera: {
    id: 'vera', name: 'Vera', title: 'cartógrafa', who: 'cartografa', tool: 'catalejo', arrive: { start: true },
    lines: [], fact: '',
    tasks: [
      { type: 'expedition', n: 2, text: 'Volvé de 2 salidas: quiere comparar tus notas con su mapa' },
      { type: 'zone', n: 1, text: 'Explorá una zona nueva para el mapa' },
      { type: 'deliver', mats: { mineral: 4 }, text: 'Traele 4 de mineral para pulir lentes nuevas' },
      { type: 'flag', flag: 'bestia_vencida', text: 'Vencé a la bestia del Bañado: quiere dibujar el bañado sin miedo' },
    ],
  },
  brigida: {
    id: 'brigida', name: 'Brígida', title: 'herrera', who: 'brigida', tool: 'martillo', arrive: { rank: 2 },
    lines: ['Me llamo Brígida. Hacía herraduras para un rey que ya no existe.', 'Si me dejan un rincón con fuego, les afilo hasta las palas.'],
    fact: 'En el continente viejo los reinos cobraban el hierro en sangre. Por eso tantos herreros se fueron con el Quiebre.',
    tasks: [
      { type: 'deliver', mats: { piedra: 5 }, text: 'Traele 5 de piedra para la fragua' },
      { type: 'combatWin', n: 2, text: 'Ganá 2 peleas: quiere ver cómo aguanta lo que forja' },
      { type: 'expedition', n: 1, region: 'cerro', text: 'Volvé de una salida al Cerro: busca una veta buena' },
      { type: 'deliver', mats: { mineral: 6 }, text: 'Traele 6 de mineral para un martillo de verdad' },
    ],
  },
  nahuel: {
    id: 'nahuel', name: 'Nahuel', title: 'subió del Bajo Mundo', who: 'nahuel', tool: 'cuerda', arrive: { zone: { region: 'bosque', n: 1 } },
    lines: ['Subí desde abajo, colgado de una cuerda que no sé quién ató.', 'Allá abajo hay gente. Y hay cosas que no son gente.'],
    fact: 'El Bajo Mundo no es un cuento: las raíces de la isla cuelgan hasta él.',
    tasks: [
      { type: 'expedition', n: 1, region: 'bosque', text: 'Volvé de una salida al Bosque: quiere ver por dónde subió' },
      { type: 'deliver', mats: { madera: 6 }, text: 'Traele 6 de madera para trenzar una cuerda nueva' },
      { type: 'zone', n: 2, text: 'Explorá 2 zonas: busca otro paso hacia abajo' },
      { type: 'combatWin', n: 3, text: 'Ganá 3 peleas: quiere saber si se puede quedar' },
    ],
  },
  olga: {
    id: 'olga', name: 'Olga', title: 'curandera', who: 'olga', tool: 'botiquin', arrive: { rank: 3 },
    lines: ['Olga. Curé en tres guerras y no gané ninguna.', 'Acá por lo menos se pelea por algo que se puede plantar.'],
    fact: 'Las hierbas del Bañado curan mejor después de una crecida: el agua baja la tierra de arriba.',
    tasks: [
      { type: 'deliver', mats: { hierbas: 4 }, text: 'Traele 4 de hierbas para el primer botiquín' },
      { type: 'threat', n: 1, text: 'Aguantá una amenaza: quiere ver cómo responde la ciudad' },
      { type: 'expedition', n: 3, text: 'Volvé de 3 salidas sin que nadie se quede atrás' },
      { type: 'deliver', mats: { hierbas: 8 }, text: 'Traele 8 de hierbas para un dispensario de verdad' },
    ],
  },
  ramiro: {
    id: 'ramiro', name: 'Ramiro Ochoa', title: 'ex guardia de las Casas', who: 'ramiro', tool: 'farol', arrive: { rank: 5 },
    lines: ['Ramiro Ochoa. Fui guardia de las Casas hasta que vi lo que cuidaba.', 'Ahora prefiero cuidar algo que valga la pena.'],
    fact: 'Las Casas sabían del Quiebre antes de que pasara. No todos sus guardias se enteraron a tiempo.',
    tasks: [
      { type: 'threat', n: 2, text: 'Aguantá 2 amenazas: quiere conocer las rondas de la ciudad' },
      { type: 'combatWin', n: 2, text: 'Ganá 2 peleas a su lado' },
      { type: 'deliver', mats: { mineral: 3, madera: 3 }, text: 'Traele 3 de mineral y 3 de madera para faroles nuevos' },
      { type: 'flag', flag: 'capitana_vencida', text: 'Vencé a la capitana: alguien de las Casas la manda' },
    ],
  },
};
export const PEOPLE_IDS = ['vera', 'brigida', 'nahuel', 'olga', 'ramiro'];
export const BOND_MAX = 5;
export const TOOL_MAX = 5;

/** Herramientas: nombre, a quién pertenece y qué hace en cada lugar (los textos de la pestaña Progreso). */
export const TOOLS = {
  catalejo: { id: 'catalejo', name: 'Catalejo', mat: 'mineral', combat: 'más intenciones a la vista', exp: 've más lejos y mejora "pasar en silencio" y "revisar"' },
  martillo: { id: 'martillo', name: 'Martillo', mat: 'mineral', combat: 'las trampas del forjador pegan más', exp: 'mejora "despejar"' },
  cuerda: { id: 'cuerda', name: 'Cuerda', mat: 'madera', combat: 'subir a lo alto cuesta menos', exp: 'mejora "cruzar" y "trepar"' },
  botiquin: { id: 'botiquin', name: 'Botiquín', mat: 'hierbas', combat: 'el curandero cura más', exp: 'más ánimo en la salida' },
  farol: { id: 'farol', name: 'Farol de guardia', mat: 'madera', combat: 'quien está al lado del líder recibe menos', exp: 'mejora "seguir con tormenta"' },
};
export const TOOL_IDS = ['catalejo', 'martillo', 'cuerda', 'botiquin', 'farol'];
/** Costo de subir una herramienta al nivel `to` (2..5): monedas y el material de región de esa herramienta. */
export const toolCost = (tool, to) => ({ coins: 60 * to, mats: { [TOOLS[tool]?.mat || 'madera']: to + 1 } });

/**
 * Efectos en la expedición, por nivel (exp-rules los lee de mods.tools):
 *  vision: casillas de visión extra desde ese nivel · opt: bono por nivel a una opción de decisión (id de HAZARDS) ·
 *  morale: ánimo máximo extra = ⌊nivel / 2⌋.
 */
export const TOOL_EXP = {
  catalejo: { vision: 3, opt: { silencio: 3, revisar: 3 } },
  martillo: { opt: { despejar: 4 } },
  cuerda: { opt: { cruzar: 3, trepar: 4 } },
  botiquin: { morale: true },
  farol: { opt: { seguir: 3 } },
};
/** Bono de las herramientas a una opción (0 si no aplica). */
export function toolOptionBonus(tools = {}, optId) {
  let n = 0;
  for (const [id, lv] of Object.entries(tools || {})) n += (TOOL_EXP[id]?.opt?.[optId] || 0) * Math.max(0, Math.min(TOOL_MAX, lv | 0));
  return n;
}
export const toolVision = (tools = {}) => ((tools?.catalejo | 0) >= TOOL_EXP.catalejo.vision ? 1 : 0);
export const toolMorale = (tools = {}) => Math.floor(Math.max(0, Math.min(TOOL_MAX, tools?.botiquin | 0)) / 2);
