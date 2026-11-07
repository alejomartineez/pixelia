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
  probMin: 10, probMax: 95, roleStep: 3, zonePenalty: 3, tierPenalty: 2,
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
  cargoStar: 1.0, moraleStar: 4,
  gemsAt3: 1, chestAt3: 0.25,
  // Prototipo (Fase 1): sin ciudad. 3 roles fijos en nivel 1 y lo que daría una ciudad con Casa nivel 3 y Establo 3.
  prototype: { party: ['exploracion', 'ingenieria', 'sanidad'], level: 1, prov: 24, cargoMax: 15, equip: [] },
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
  madera: { id: 'madera', name: 'madera', icon: '🪵' },
  piedra: { id: 'piedra', name: 'piedra', icon: '🪨' },
  mineral: { id: 'mineral', name: 'mineral', icon: '⛏️' },
  hierbas: { id: 'hierbas', name: 'hierbas', icon: '🌿' },
};
export const MAT_IDS = ['madera', 'piedra', 'mineral', 'hierbas'];

export const CONTENT_IDS = ['vacio', 'recurso', 'ruina', 'campamento', 'aldea', 'mirador', 'peligro'];
export const CONTENT = {
  vacio: { name: 'Nada a la vista', icon: null },
  recurso: { name: 'Recurso', icon: null },        // usa el ícono del material
  ruina: { name: 'Ruina', icon: '🏚️', text: 'Restos de algo que fue importante para alguien.' },
  campamento: { name: 'Campamento', icon: '⛺', text: 'Un claro con fogón. Se puede descansar una vez.' },
  aldea: { name: 'Aldea', icon: '🏘️', text: 'Gente de la zona. Se puede hacer una cosa con ellos.' },
  mirador: { name: 'Mirador', icon: '🔭', text: 'Desde arriba se ve lejos.' },
  peligro: { name: 'Peligro', icon: null },          // usa el ícono del peligro
  objetivo: { name: 'Objetivo', icon: '🚩' },
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
    places: ['el aserradero abandonado', 'la casa del guardabosque', 'el puente de troncos', 'el vivero viejo', 'la capilla del monte'],
  },
  sierras: {
    id: 'sierras', name: 'Sierras Bajas', tier: 2, rank: 2,
    barrier: { chance: 0.6, hazard: 'derrumbe' },
    content: { vacio: 33, recurso: 24, ruina: 10, campamento: 2, aldea: 3, mirador: 5, peligro: 23 },
    mats: { madera: 15, piedra: 50, mineral: 35, hierbas: 0 },
    hazards: { rio: 10, derrumbe: 45, tormenta: 30, lobos: 15 },
    terrain: { llano: 30, bosque: 15, colina: 30, pantano: 5, roca: 20 },
    places: ['la mina vieja', 'la cantera cerrada', 'el puesto de arriba', 'la pirca larga', 'el refugio de pastores'],
  },
  banado: {
    id: 'banado', name: 'Bañado de los Juncos', tier: 3, rank: 3,
    barrier: { chance: 0.9, hazard: 'rio' },
    content: { vacio: 33, recurso: 24, ruina: 10, campamento: 2, aldea: 4, mirador: 2, peligro: 25 },
    mats: { madera: 35, piedra: 10, mineral: 0, hierbas: 55 },
    hazards: { rio: 50, derrumbe: 15, tormenta: 20, lobos: 15 },
    terrain: { llano: 30, bosque: 20, colina: 5, pantano: 40, roca: 5 },
    places: ['el muelle hundido', 'la casa sobre pilotes', 'el viejo arrozal', 'la balsa encallada', 'el faro del estero'],
  },
  cerro: {
    id: 'cerro', name: 'Cerro del Hierro', tier: 4, rank: 5,
    barrier: { chance: 0.6, hazard: 'derrumbe' },
    content: { vacio: 30, recurso: 26, ruina: 10, campamento: 2, aldea: 2, mirador: 4, peligro: 26 },
    mats: { madera: 10, piedra: 35, mineral: 55, hierbas: 0 },
    hazards: { rio: 10, derrumbe: 40, tormenta: 35, lobos: 15 },
    terrain: { llano: 25, bosque: 10, colina: 30, pantano: 5, roca: 30 },
    places: ['la fundición vieja', 'el socavón norte', 'el polvorín', 'la estación del cable carril', 'la casa del capataz'],
  },
  costa: {
    id: 'costa', name: 'Costa de los Faros', tier: 5, rank: 6,
    barrier: { chance: 0.5, hazard: 'rio' },
    content: { vacio: 32, recurso: 20, ruina: 14, campamento: 2, aldea: 4, mirador: 4, peligro: 24 },
    mats: { madera: 25, piedra: 25, mineral: 25, hierbas: 25 },
    hazards: { rio: 25, derrumbe: 15, tormenta: 45, lobos: 15 },
    terrain: { llano: 45, bosque: 15, colina: 20, pantano: 10, roca: 10 },
    places: ['el faro apagado', 'la aduana vieja', 'el naufragio', 'la casa de botes', 'el salinar'],
  },
};
export const REGION_IDS = ['bosque', 'sierras', 'banado', 'cerro', 'costa'];

export const ROLES = {
  exploracion: { id: 'exploracion', name: 'Exploración', building: 'casa_exp', icon: '🧭', text: 'Ve más lejos: visión 2.' },
  ingenieria: { id: 'ingenieria', name: 'Ingeniería', building: 'taller', icon: '🔧', text: 'Cruza ríos y despeja derrumbes.' },
  sanidad: { id: 'sanidad', name: 'Sanidad', building: 'dispensario', icon: '🩹', text: 'Más ánimo y mejor descanso.' },
  recoleccion: { id: 'recoleccion', name: 'Recolección', building: 'huerta', icon: '🧺', text: 'Junta más en cada recurso.' },
  guia: { id: 'guia', name: 'Guía', building: 'establo', icon: '🐴', text: 'Pasa mejor por colinas, bañados y roca.' },
};
export const ROLE_IDS = ['exploracion', 'ingenieria', 'sanidad', 'recoleccion', 'guia'];

export const EQUIPMENT = {
  cuerda: { id: 'cuerda', name: 'Cuerda', icon: '🪢', text: '+15 cruzar ríos, +10 trepar' },
  pala: { id: 'pala', name: 'Pala', icon: '🪏', text: '+15 despejar, +10 revisar ruinas' },
  lona: { id: 'lona', name: 'Lona', icon: '⛺', text: '+20 seguir con tormenta; esperar cuesta 1 menos' },
  farol: { id: 'farol', name: 'Farol', icon: '🏮', text: 'Espantar con fuego sin gastar madera' },
  botiquin: { id: 'botiquin', name: 'Botiquín', icon: '🩹', text: 'Una vez: +3 de ánimo' },
  carreta: { id: 'carreta', name: 'Carreta', icon: '🛒', text: '+4 de carga' },
};

// Peligros y ruinas (§2.6). Cada opción: base (100 = seguro), rol {id: bono}, equip {id: bono}, cost (se paga al elegir),
// ok / fail (efectos). Efectos: morale, prov, mats {id:n}, loseMat (n al azar), loot ('full' | 'small').
export const HAZARDS = {
  rio: {
    id: 'rio', name: 'Río crecido', icon: '🌊', text: 'El agua viene alta y marrón.',
    options: [
      { id: 'cruzar', label: 'Cruzar', base: 50, role: { ingenieria: 25 }, equip: { cuerda: 15 },
        fail: { morale: -2, prov: -1, loseMat: 1 }, failText: 'El agua se llevó algo' },
      { id: 'rodear', label: 'Rodear', base: 100, cost: { prov: 2 }, guiaProv: -1, okText: 'Dieron la vuelta larga' },
    ],
  },
  derrumbe: {
    id: 'derrumbe', name: 'Derrumbe', icon: '⛰️', text: 'Piedras sueltas tapan el paso.',
    options: [
      { id: 'despejar', label: 'Despejar', base: 45, role: { ingenieria: 30 }, equip: { pala: 15 },
        ok: { mats: { piedra: 1 } }, fail: { morale: -2, prov: -2 }, failText: 'Mucho esfuerzo y poco avance' },
      { id: 'trepar', label: 'Trepar', base: 60, role: { guia: 20 }, equip: { cuerda: 10 },
        fail: { morale: -2, prov: -1 }, failText: 'Raspones y un susto' },
    ],
  },
  tormenta: {
    id: 'tormenta', name: 'Tormenta', icon: '⛈️', text: 'Se larga fuerte y no se ve nada.',
    options: [
      { id: 'seguir', label: 'Seguir igual', base: 55, role: { guia: 20 }, equip: { lona: 20 },
        fail: { morale: -2, prov: -2 }, failText: 'Empapados y con la vianda mojada' },
      { id: 'esperar', label: 'Esperar', base: 100, cost: { prov: 2 }, lonaProv: -1, okText: 'Esperaron a que pase' },
    ],
  },
  lobos: {
    id: 'lobos', name: 'Lobos', icon: '🐺', text: 'Una manada cruza más adelante.',
    options: [
      { id: 'silencio', label: 'Pasar en silencio', base: 50, role: { exploracion: 25 },
        fail: { morale: -3, prov: -2 }, failText: 'Los vieron y hubo que correr' },
      { id: 'fuego', label: 'Espantar con fuego', base: 85, needs: 'fuego',
        fail: { morale: -2 }, failText: 'No se fueron del todo' },
    ],
  },
  ruina: {
    id: 'ruina', name: 'Ruina', icon: '🏚️', text: 'Restos viejos. Puede haber algo adentro.',
    options: [
      { id: 'revisar', label: 'Revisar a fondo', base: 70, role: { exploracion: 15 }, equip: { pala: 10 },
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
