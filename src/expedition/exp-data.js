// Expedición: constantes y tablas (DESIGN-CORE.md §2). Todo número de balance vive acá; lo calibra
// tools/sim-expedition.mjs contra las metas del §8. Puro: sin DOM ni three.js (se importa desde Node).

export const EXP = {
  kinds: {
    // base = casilla de abajo al centro; objDepth = [mín, máx] de profundidad del objetivo; validCost = el camino de la
    // base al objetivo tiene que costar como mucho esto (sin contar peligros)
    normal: { w: 7, h: 9, base: [3, 8], objDepth: [7, 8], objDepthZone: 0.5, validCost: 9, advancesZone: true, leftoverBack: true },
    corta: { w: 5, h: 6, base: [2, 5], objDepth: [4, 5], validCost: 6, prov: 12, cargoFactor: 0.5, barrier: false, advancesZone: false, leftoverBack: false },
  },
  provMax: [18, 21, 24, 27, 30],         // salida normal, por nivel de la Casa de Expediciones
  provMinNormal: 12,
  slots: [2, 2, 3, 3, 4],                // lugares en el grupo (con quien lidera) por nivel de la Casa
  morale: 8, moraleSanidad: 2,          // ánimo inicial (lleno) y extra con Sanidad
  tiredEvery: 5,                         // cada tantos pasos, −1 de ánimo ("el camino cansa")
  camp: 3, campSanidad: 2,               // descansar: +4 (+2 con Sanidad)
  botiquin: 3, atender: 2,
  vision: 1, visionExploracion: 2,
  mirador: 3, miradorExploracion3: 4,
  probMin: 10, probMax: 95, roleStep: 5, zonePenalty: 3, tierPenalty: 2,   // roleStep: +5 por nivel de rol sobre 1 (Fase 2)
  care: 10,                              // después de un fallo, la próxima decisión arriesgada: +10 "con cuidado" (a la vista)
  cargoBase: 6, cargoPerEstablo: 3, carreta: 4,
  ringAmount: [2, 2, 3],                 // materiales por casilla de recurso: cerca / medio / lejos
  ringHazard: [0.6, 1, 1.4],             // multiplicador de peligros por anillo
  ringRuin: [0.5, 1, 1.5],
  ruinPlano: [0.10, 0.25, 0.40],         // chance de plano en ruina revisada a fondo
  ruinFind: 0.6, ruinSmallFind: 0.2,
  findStars: [[1, 2], [1, 3], [2, 5]],   // estrellas de un hallazgo por anillo
  objectiveWeights: { lugar: 50, juntar: 25, aldea: 25 },
  juntarBase: { normal: 4, corta: 2 },   // N = base + ceil(zona / 2); el material es uno de los fuertes de la región (peso ≥ 30)
  // Imprevistos: al pisar por primera vez una casilla del anillo medio o lejano puede pasar algo chico (§2.5).
  // Es lo que hace que ir "al límite" sea un riesgo: el regreso se conoce, lo de allá lejos no.
  mishap: [0, 0.10, 0.25],
  mishaps: [
    { id: 'bolsa', text: 'Se rompió una bolsa de la vianda', prov: -1 },
    { id: 'vado', text: 'No había vado: hubo que buscar por dónde cruzar', prov: -1 },
    { id: 'ampolla', text: 'Una ampolla que no deja caminar tranquilo', morale: -1 },
    { id: 'niebla', text: 'Niebla cerrada: se perdieron un rato', prov: -1, morale: -1 },
  ],
  // Día y noche, y clima (PLAN-QUIEBRE §J3–J4). Se sale al alba y cada paso es una hora: si la salida se alarga, se hace
  // de noche (visión −1; el Farol la devuelve). Un frente de clima por salida a lo sumo, anunciado desde el principio.
  dawn: 6, hoursPerStep: 1,
  weather: {
    bosque: { p: 0.25, kinds: [['lluvia', 55], ['niebla', 45]] },
    sierras: { p: 0.35, kinds: [['niebla', 40], ['tormenta', 35], ['nieve', 25]] },
    banado: { p: 0.4, kinds: [['niebla', 55], ['lluvia', 30], ['tormenta', 15]] },
    cerro: { p: 0.35, kinds: [['ceniza', 55], ['tormenta', 45]] },
    costa: { p: 0.4, kinds: [['tormenta', 50], ['niebla', 50]] },
  },
  weatherFrom: [3, 8], weatherLen: [2, 4],   // el frente llega entre el paso 3 y el 8 y dura de 2 a 4 pasos
  // Enemigos (El Quiebre, paso 5; DESIGN-COMBAT.md §13): casillas `enemigo` en las bandas media y lejana de la salida
  // normal. Se tiran aparte, con su propia suerte, sobre las casillas vacías: los mapas de antes no cambian en lo demás.
  // chance: [medio, lejos] por casilla vacía; max: tope por mapa. La corta (tutorial y Expedición del día) no tiene.
  // fightProv: lo que cuesta la pelea en provisiones, además del paso. tiredMorale: con el ánimo en eso o menos, el grupo
  // arranca la pelea con tiredHp de vida menos. firstDepth: dónde cae la primera pelea (la guiada) del Bosque.
  enemy: { chance: [0.07, 0.13], max: 2, fightProv: 1, tiredMorale: 3, tiredHp: 2, firstDepth: [4, 5] },
  cargoStar: 1.0, moraleStar: 4,
  // Arma del camino (paso 2a, "cada salida deja algo"): una salida normal que vuelve con al menos minStars y en la que
  // ninguna pelea dejó un arma trae una con esta chance (rareza como la de una pelea común).
  weaponFind: { chance: 0.3, minStars: 1 },
  gemsAt3: 1, chestAt3: 0.10,          // cofre de madera en una salida de 3★ (Fase 5b: era 0,25; §8 ≤ 1,5 cofres por día)
  // Prototipo (Fase 1): sin ciudad. 3 roles fijos en nivel 1 y lo que daría una ciudad con Casa nivel 3 y Establo 3.
  prototype: { party: ['cazador', 'forjador', 'curandero'], level: 1, prov: 24, cargoMax: 15, equip: [] },
};

/** Anillo de una profundidad: 0 cerca (1–3), 1 medio (4–6), 2 lejos (7+). */
export const ringOf = (depth) => (depth <= 3 ? 0 : depth <= 6 ? 1 : 2);
export const RING_NAMES = ['cerca', 'medio', 'lejos'];

export const TERRAIN = {
  llano: { id: 'llano', name: 'Llano', cost: 1, guia: 1 },
  bosque: { id: 'bosque', name: 'Monte', cost: 1, guia: 1 },
  colina: { id: 'colina', name: 'Colina', cost: 2, guia: 1 },
  pantano: { id: 'pantano', name: 'Bañado', cost: 2, guia: 1 },
  roca: { id: 'roca', name: 'Roca', cost: 3, guia: 2 },
};
export const TERRAIN_IDS = ['llano', 'bosque', 'colina', 'pantano', 'roca'];

export const MATERIALS = {
  madera: { id: 'madera', name: 'madera', icon: 'wood' },
  piedra: { id: 'piedra', name: 'piedra', icon: 'stone' },
  mineral: { id: 'mineral', name: 'mineral', icon: 'ore' },
  hierbas: { id: 'hierbas', name: 'hierbas', icon: 'herbs' },
};
export const MAT_IDS = ['madera', 'piedra', 'mineral', 'hierbas'];

export const CONTENT_IDS = ['vacio', 'recurso', 'ruina', 'campamento', 'aldea', 'mirador', 'peligro', 'enemigo'];
export const CONTENT = {
  vacio: { name: 'Nada a la vista', icon: null },
  recurso: { name: 'Recurso', icon: null },        // usa el ícono del material
  ruina: { name: 'Ruina', icon: 'ruin', text: 'Restos de algo que fue importante para alguien.' },
  campamento: { name: 'Campamento', icon: 'camp', text: 'Un claro con fogón. Se puede descansar una vez.' },
  aldea: { name: 'Aldea', icon: 'village', text: 'Gente de la zona. Se puede hacer una cosa con ellos.' },
  mirador: { name: 'Mirador', icon: 'lookout', text: 'Desde arriba se ve lejos.' },
  peligro: { name: 'Peligro', icon: null },          // usa el ícono del peligro
  enemigo: { name: 'Enemigos', icon: 'fight', text: 'Algo se mueve más adelante. Para pasar por acá hay que pelear.' },   // sub = id del encuentro
  objetivo: { name: 'Objetivo', icon: 'flag' },
};

// Regiones (§2.5, §2.9). content: % por tipo (suma 100); mats/hazards/terrain: % dentro de cada grupo.
export const REGIONS = {
  bosque: {
    id: 'bosque', name: 'Bosque del Arroyo', tier: 1, rank: 1,
    barrier: { chance: 0.75, hazard: 'rio' },
    content: { vacio: 38, recurso: 24, ruina: 8, campamento: 2, aldea: 3, mirador: 3, peligro: 22 },
    mats: { madera: 50, piedra: 20, mineral: 0, hierbas: 30 },
    hazards: { rio: 40, derrumbe: 10, tormenta: 15, lobos: 35 },
    terrain: { llano: 35, bosque: 40, colina: 15, pantano: 5, roca: 5 },
    enemies: { bosque_claro: 55, bosque_manada: 45 },   // encuentros comunes (src/combat/combat-data.js), con su peso
    places: ['el aserradero abandonado', 'la casa del guardabosque', 'el puente de troncos', 'el vivero viejo', 'la capilla del monte'],
  },
  sierras: {
    id: 'sierras', name: 'Sierras Bajas', tier: 2, rank: 2,
    barrier: { chance: 0.6, hazard: 'derrumbe' },
    content: { vacio: 33, recurso: 24, ruina: 10, campamento: 2, aldea: 3, mirador: 5, peligro: 23 },
    mats: { madera: 15, piedra: 50, mineral: 35, hierbas: 0 },
    hazards: { rio: 10, derrumbe: 45, tormenta: 30, lobos: 15 },
    terrain: { llano: 30, bosque: 15, colina: 30, pantano: 5, roca: 20 },
    enemies: { bosque_manada: 60, cerro_veta: 40 },   // encuentros comunes (src/combat/combat-data.js), con su peso
    places: ['la mina vieja', 'la cantera cerrada', 'el puesto de arriba', 'la pirca larga', 'el refugio de pastores'],
  },
  banado: {
    id: 'banado', name: 'Bañado de los Juncos', tier: 3, rank: 3,
    barrier: { chance: 0.9, hazard: 'rio' },
    content: { vacio: 33, recurso: 24, ruina: 10, campamento: 2, aldea: 4, mirador: 2, peligro: 25 },
    mats: { madera: 35, piedra: 10, mineral: 0, hierbas: 55 },
    hazards: { rio: 50, derrumbe: 15, tormenta: 20, lobos: 15 },
    terrain: { llano: 30, bosque: 20, colina: 5, pantano: 40, roca: 5 },
    enemies: { banado_juncal: 65, bosque_manada: 35 },   // encuentros comunes (src/combat/combat-data.js), con su peso
    places: ['el muelle hundido', 'la casa sobre pilotes', 'el viejo arrozal', 'la balsa encallada', 'el faro del estero'],
  },
  cerro: {
    id: 'cerro', name: 'Cerro del Hierro', tier: 4, rank: 5,
    barrier: { chance: 0.6, hazard: 'derrumbe' },
    content: { vacio: 30, recurso: 26, ruina: 10, campamento: 2, aldea: 2, mirador: 4, peligro: 26 },
    mats: { madera: 10, piedra: 35, mineral: 55, hierbas: 0 },
    hazards: { rio: 10, derrumbe: 40, tormenta: 35, lobos: 15 },
    terrain: { llano: 25, bosque: 10, colina: 30, pantano: 5, roca: 30 },
    enemies: { cerro_veta: 55, cerro_rescate: 45 },   // encuentros comunes (src/combat/combat-data.js), con su peso
    places: ['la fundición vieja', 'el socavón norte', 'el polvorín', 'la estación del cable carril', 'la casa del capataz'],
  },
  costa: {
    id: 'costa', name: 'Costa de los Faros', tier: 5, rank: 6,
    barrier: { chance: 0.5, hazard: 'rio' },
    content: { vacio: 32, recurso: 20, ruina: 14, campamento: 2, aldea: 4, mirador: 4, peligro: 24 },
    mats: { madera: 25, piedra: 25, mineral: 25, hierbas: 25 },
    hazards: { rio: 25, derrumbe: 15, tormenta: 45, lobos: 15 },
    terrain: { llano: 45, bosque: 15, colina: 20, pantano: 10, roca: 10 },
    enemies: { costa_muelle: 100 },   // encuentros comunes (src/combat/combat-data.js), con su peso
    places: ['el faro apagado', 'la aduana vieja', 'el naufragio', 'la casa de botes', 'el salinar'],
  },
};
export const REGION_IDS = ['bosque', 'sierras', 'banado', 'cerro', 'costa'];

// Clases de la expedición (paso 5b; antes, roles). building: el edificio que la trae (el nivel del edificio es su nivel
// de oficio, 1..5, el que usan las decisiones). El Guerrero llega con la Casa de Expediciones 2 (src/core/classes.js).
export const CLASSES = {
  cazador: { id: 'cazador', name: 'Cazador', building: 'casa_exp', icon: 'cls-cazador', text: 'Ve más lejos: visión 2.' },
  forjador: { id: 'forjador', name: 'Forjador', building: 'taller', icon: 'cls-forjador', text: 'Cruza ríos y despeja derrumbes.' },
  curandero: { id: 'curandero', name: 'Curandero', building: 'dispensario', icon: 'cls-curandero', text: 'Más ánimo y mejor descanso.' },
  saqueador: { id: 'saqueador', name: 'Saqueador', building: 'huerta', icon: 'cls-saqueador', text: 'Junta más en cada recurso.' },
  monje: { id: 'monje', name: 'Monje', building: 'establo', icon: 'cls-monje', text: 'Pasa mejor por colinas, bañados y roca.' },
  guerrero: { id: 'guerrero', name: 'Guerrero', building: 'casa_exp', minLevel: 2, icon: 'cls-guerrero', text: 'Abre paso por la fuerza: derrumbes y ríos.' },
};
export const CLASS_IDS = ['cazador', 'forjador', 'curandero', 'saqueador', 'monje', 'guerrero'];
/** @deprecated los roles pasaron a clases (paso 5b): quedan los nombres para quien todavía los importa. */
export const ROLES = CLASSES;
export const ROLE_IDS = CLASS_IDS;

export const EQUIPMENT = {
  cuerda: { id: 'cuerda', name: 'Cuerda', icon: 'rope', text: '+15 cruzar ríos, +10 trepar' },
  pala: { id: 'pala', name: 'Pala', icon: 'shovel', text: '+15 despejar, +10 revisar ruinas' },
  lona: { id: 'lona', name: 'Lona', icon: 'tarp', text: '+20 seguir con tormenta; esperar cuesta 1 menos' },
  farol: { id: 'farol', name: 'Farol', icon: 'lantern', text: 'Espantar con fuego sin gastar madera' },
  botiquin: { id: 'botiquin', name: 'Botiquín', icon: 'medkit', text: 'Una vez: +3 de ánimo' },
  carreta: { id: 'carreta', name: 'Carreta', icon: 'cart', text: '+4 de carga (+6 desde la época Hierro)' },
};

// Peligros y ruinas (§2.6). Cada opción: base (100 = seguro), role {clase: bono}, equip {id: bono}, cost (se paga al elegir),
// ok / fail (efectos). Efectos: morale, prov, mats {id:n}, loseMat (n al azar), loot ('full' | 'small').
export const HAZARDS = {
  rio: {
    id: 'rio', name: 'Río crecido', icon: 'flood', text: 'El agua viene alta y marrón.',
    options: [
      { id: 'cruzar', label: 'Cruzar', base: 50, role: { forjador: 25, guerrero: 10 }, equip: { cuerda: 15 },
        fail: { morale: -2, prov: -1, loseMat: 1 }, failText: 'El agua se llevó algo' },
      { id: 'rodear', label: 'Rodear', base: 100, cost: { prov: 2 }, guiaProv: -1, okText: 'Dieron la vuelta larga' },
    ],
  },
  derrumbe: {
    id: 'derrumbe', name: 'Derrumbe', icon: 'rockfall', text: 'Piedras sueltas tapan el paso.',
    options: [
      { id: 'despejar', label: 'Despejar', base: 45, role: { forjador: 30, guerrero: 20 }, equip: { pala: 15 },
        ok: { mats: { piedra: 1 } }, fail: { morale: -2, prov: -2 }, failText: 'Mucho esfuerzo y poco avance' },
      { id: 'trepar', label: 'Trepar', base: 60, role: { monje: 20 }, equip: { cuerda: 10 },
        fail: { morale: -2, prov: -1 }, failText: 'Raspones y un susto' },
    ],
  },
  tormenta: {
    id: 'tormenta', name: 'Tormenta', icon: 'storm', text: 'Se larga fuerte y no se ve nada.',
    options: [
      { id: 'seguir', label: 'Seguir igual', base: 55, role: { monje: 20 }, equip: { lona: 20 },
        fail: { morale: -2, prov: -2 }, failText: 'Empapados y con la vianda mojada' },
      { id: 'esperar', label: 'Esperar', base: 100, cost: { prov: 2 }, lonaProv: -1, okText: 'Esperaron a que pase' },
    ],
  },
  lobos: {
    id: 'lobos', name: 'Lobos', icon: 'wolf', text: 'Una manada cruza más adelante.',
    options: [
      { id: 'silencio', label: 'Pasar en silencio', base: 50, role: { cazador: 25 },
        fail: { morale: -3, prov: -2 }, failText: 'Los vieron y hubo que correr' },
      { id: 'fuego', label: 'Espantar con fuego', base: 85, needs: 'fuego',
        fail: { morale: -2 }, failText: 'No se fueron del todo' },
    ],
  },
  ruina: {
    id: 'ruina', name: 'Ruina', icon: 'ruin', text: 'Restos viejos. Puede haber algo adentro.',
    options: [
      { id: 'revisar', label: 'Revisar a fondo', base: 70, role: { cazador: 15 }, equip: { pala: 10 },
        ok: { loot: 'full' }, fail: { morale: -2, prov: -1, loot: 'small' }, failText: 'Se vino abajo una pared' },
      { id: 'mirar', label: 'Mirar por arriba', base: 100, ok: { loot: 'small' } },
    ],
  },
};
export const HAZARD_IDS = ['rio', 'derrumbe', 'tormenta', 'lobos'];

export const OBJECTIVES = {
  lugar: { id: 'lugar', title: (o) => `Encontrá ${o.name}`, short: 'Encontrar el lugar' },
  juntar: { id: 'juntar', title: (o) => `Traé ${o.n} de ${MATERIALS[o.mat].name}`, short: 'Juntar material' },
  aldea: { id: 'aldea', title: () => 'Llegá a la aldea perdida', short: 'Llegar a la aldea' },
};

/** Puntaje simple de un botín (lo usan el simulador y el resultado para comparar). */
export function lootValue(loot, starCount = 0) {
  const mats = Object.values(loot.mats || {}).reduce((a, n) => a + n, 0);
  return mats + 4 * (loot.planos || 0) + 1.5 * (loot.finds || []).reduce((a, f) => a + 0.5 + f.stars * 0.5, 0) + 2 * (loot.colonos || 0) + 2 * starCount;
}
