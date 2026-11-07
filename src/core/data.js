// Catálogos del juego: edificios, personalización, niveles, misiones.
// Todo lo que sea "balance" vive acá para poder ajustarlo en un solo lugar.

export const MAP_SIZE = 28;            // grilla total (tiles)
export const START_LAND = 12;          // lado del terreno inicial desbloqueado (centrado)
export const LAND_STEP = 2;            // cada expansión agrega 2 al lado (un anillo de 1 tile alrededor)
export const MAX_EXPANSIONS = 7;       // 12 -> 26
export const MAX_BUILDING_LEVEL = 5;
export const START_BUILDERS = 2;
export const MAX_BUILDERS = 4;
export const BUILDER_GEM_COST = [0, 0, 0, 60, 150]; // costo del constructor n (índice = total tras comprar)

// Paleta compartida (hex): vive en palette.js; usar estos colores en modelos y UI para coherencia
export { PALETTE } from './palette.js';

// ---------------- EDIFICIOS ----------------
// cat: 'especial' | 'casa' | 'ciclo' | 'negocio' | 'deco' | 'camino' | 'monumento' (estos se agregan desde MONUMENTS, más abajo)
// size: [w, d] en tiles. cost: {coins, gems}. time: segundos de construcción (nivel 1).
// pop: residentes que aporta (casas). popReq: población mínima para poder construirlo.
// prod: {coins|gems: cantidad por ciclo, cycle: segundos, cap: ciclos acumulables}
// happy: felicidad que aporta. xp: experiencia al terminar de construir.
// max: cantidad máxima (undefined = ilimitado). game: minijuego que abre al tocarlo.
// rank: rango de ciudad mínimo para construirlo. charm: Encanto (si falta, sale de la categoría: ver economy.charmBase).
export const BUILDINGS = [
  // --- Especiales ---
  { id: 'castillo', name: 'Municipalidad', cat: 'especial', size: [4, 4], unlock: 1, cost: { coins: 0 }, time: 0, max: 1,
    happy: 10, charm: 20, xp: 0, prod: { coins: 15, cycle: 60, cap: 8 }, desc: 'El corazón de la ciudad. Mejorala para dar bonus a toda la ciudad.' },
  { id: 'joyeria', name: 'Joyería', cat: 'especial', size: [2, 2], unlock: 1, cost: { coins: 150 }, time: 10, max: 1,
    happy: 3, xp: 15, game: 'match3', desc: 'Abre el minijuego Joyas Brillantes (combina 3).' },
  { id: 'torre_bloques', name: 'Torre de Bloques', cat: 'especial', size: [2, 2], unlock: 2, cost: { coins: 300 }, time: 20, max: 1,
    happy: 3, xp: 25, game: 'blocks', desc: 'Abre el minijuego Bloques Pixel.' },
  { id: 'garaje', name: 'Garaje', cat: 'especial', size: [3, 3], unlock: 3, cost: { coins: 600 }, time: 30, max: 1,
    happy: 4, xp: 40, game: 'parking', desc: 'Abre Estacionamiento Express y el taller para tunear tu auto.' },
  { id: 'pista', name: 'Pista de Manejo', cat: 'especial', size: [3, 3], unlock: 5, cost: { coins: 1200 }, time: 45, max: 1,
    happy: 5, xp: 60, game: 'driving', desc: 'Abre el minijuego Ruta Pixel (manejar).' },
  // Mi Casa: aparece sola al llegar a nivel 2 (economy.ensureHome). Su nivel es el de la casa por dentro (home/furniture.js).
  { id: 'mi_casa', name: 'Mi Casa', cat: 'especial', size: [2, 2], unlock: 1, cost: { coins: 0 }, time: 0, max: 1, auto: true,
    happy: 2, charm: 10, xp: 0, desc: 'Tu casa: entrá, decorala con muebles y ampliala.' },
  { id: 'boutique_real', name: 'Sastrería', cat: 'especial', size: [2, 2], unlock: 2, cost: { coins: 250 }, time: 15, max: 1,
    happy: 4, xp: 20, game: 'wardrobe', desc: 'Tu vestidor: ropa, peinados y sombreros.' },

  // --- Casas ---
  { id: 'casita', name: 'Casa', cat: 'casa', size: [2, 2], unlock: 1, cost: { coins: 100 }, time: 8,
    pop: 5, prod: { coins: 4, cycle: 45, cap: 6 }, xp: 10, desc: 'Una casa sencilla para 5 habitantes.' },
  { id: 'cabana', name: 'Cabaña', cat: 'casa', size: [2, 2], unlock: 2, cost: { coins: 260 }, time: 15,
    pop: 8, prod: { coins: 7, cycle: 60, cap: 6 }, xp: 18, desc: 'Madera, chimenea y un jardín que alguien riega.' },
  { id: 'chalet', name: 'Chalet', cat: 'casa', size: [2, 2], unlock: 4, cost: { coins: 600 }, time: 30,
    pop: 13, prod: { coins: 12, cycle: 75, cap: 6 }, xp: 30, desc: 'Dos pisos y balcón con vista a la plaza.' },
  { id: 'torre_cristal', name: 'Torre de Cristal', rank: 2, cat: 'casa', size: [2, 2], unlock: 7, cost: { coins: 1500 }, time: 60,
    pop: 22, prod: { coins: 22, cycle: 90, cap: 6 }, xp: 55, desc: 'Departamentos con vista para mucha gente.' },
  { id: 'mansion', name: 'Casona', rank: 3, cat: 'casa', size: [3, 3], unlock: 10, cost: { coins: 3500, gems: 5 }, time: 120,
    pop: 40, prod: { coins: 45, cycle: 120, cap: 6 }, xp: 100, desc: 'Patio con fuente, galería y un portón que rechina.' },

  // --- Negocios ---
  { id: 'panaderia', name: 'Panadería', cat: 'negocio', size: [2, 2], unlock: 1, cost: { coins: 150 }, time: 10, popReq: 5,
    prod: { coins: 20, cycle: 60, cap: 6 }, xp: 15, desc: 'Medialunas y pan del día. El de ayer, a mitad de precio.' },
  { id: 'heladeria', name: 'Heladería', cat: 'negocio', size: [2, 2], unlock: 2, cost: { coins: 350 }, time: 20, popReq: 12,
    prod: { coins: 35, cycle: 90, cap: 6 }, xp: 25, desc: 'Dulce de leche, chocolate y algún sabor raro que nadie pide.' },
  { id: 'floreria', name: 'Florería', cat: 'negocio', size: [2, 2], unlock: 3, cost: { coins: 550 }, time: 30, popReq: 20,
    prod: { coins: 50, cycle: 120, cap: 6 }, happy: 2, xp: 35, desc: 'Ramos para cada ocasión.' },
  { id: 'cafeteria', name: 'Café de la Esquina', cat: 'negocio', size: [2, 2], unlock: 4, cost: { coins: 800 }, time: 40, popReq: 30,
    prod: { coins: 70, cycle: 150, cap: 6 }, xp: 45, desc: 'Café, tostados y un gato que se cree el dueño.' },
  { id: 'salon', name: 'Peluquería', cat: 'negocio', size: [2, 2], unlock: 5, cost: { coins: 1100 }, time: 60, popReq: 40,
    prod: { coins: 95, cycle: 180, cap: 6 }, xp: 55, desc: 'Cortes, tinturas y las novedades del barrio.' },
  { id: 'pasteleria', name: 'Pastelería', cat: 'negocio', size: [2, 2], unlock: 6, cost: { coins: 1500 }, time: 75, popReq: 50,
    prod: { coins: 120, cycle: 200, cap: 6 }, xp: 65, desc: 'Tortas por encargo, con una semana de anticipación.' },
  { id: 'boutique', name: 'Tienda de Ropa', cat: 'negocio', size: [2, 2], unlock: 7, cost: { coins: 2000 }, time: 90, popReq: 65,
    prod: { coins: 160, cycle: 240, cap: 6 }, xp: 80, desc: 'Ropa, bolsos y zapatos. Probadores al fondo.' },
  { id: 'cine', name: 'Cine', rank: 3, cat: 'negocio', size: [3, 3], unlock: 9, cost: { coins: 3200 }, time: 120, popReq: 85,
    prod: { coins: 260, cycle: 300, cap: 6 }, happy: 4, xp: 110, desc: 'Estrenos, clásicos y pochoclo.' },
  { id: 'spa', name: 'Baños Termales', rank: 4, cat: 'negocio', size: [3, 3], unlock: 11, cost: { coins: 5000, gems: 5 }, time: 180, popReq: 110,
    prod: { coins: 380, cycle: 360, cap: 6 }, happy: 5, xp: 150, desc: 'Vapor, agua caliente y silencio.' },
  { id: 'rueda', name: 'Rueda de la Fortuna', rank: 5, cat: 'negocio', size: [3, 3], unlock: 13, cost: { coins: 8000, gems: 10 }, time: 240, popReq: 140,
    prod: { gems: 1, cycle: 1800, cap: 4 }, happy: 8, xp: 220, desc: 'Gira despacio y de vez en cuando deja una gema.' },
  { id: 'teatro', name: 'Teatro de la Ópera', rank: 5, cat: 'negocio', size: [3, 3], unlock: 15, cost: { coins: 12000, gems: 10 }, time: 300, popReq: 180,
    prod: { coins: 800, cycle: 600, cap: 6 }, happy: 6, xp: 300, desc: 'Funciones de gala. Se ruega apagar el celular.' },

  // --- Ciclo de la expedición (DESIGN-CORE.md §5.2; qué da cada nivel en CYCLE, más abajo) ---
  // prod.prov: provisiones por tanda en el nivel 1 (CYCLE[id].prov da el valor por nivel); van al depósito al cobrar.
  { id: 'casa_exp', name: 'Casa de Expediciones', cat: 'ciclo', size: [3, 3], unlock: 1, rank: 1, cost: { coins: 200 }, time: 20, max: 1,
    happy: 2, xp: 30, panel: 'expedition', desc: 'De acá sale el grupo. Cada nivel suma lugar, provisiones por salida y vista larga.' },
  { id: 'huerta', name: 'Huerta', cat: 'ciclo', size: [2, 2], unlock: 1, rank: 1, cost: { coins: 120 }, time: 10, max: 6,
    happy: 1, xp: 12, prod: { prov: 2, cycle: 2700, cap: 6 }, desc: 'Verdura para la vianda. La mejor Huerta entrena Recolección.' },
  { id: 'taller', name: 'Taller', cat: 'ciclo', size: [2, 2], unlock: 1, rank: 1, cost: { coins: 300, mats: { madera: 3 } }, time: 25, max: 1,
    happy: 1, xp: 30, panel: 'workshop', desc: 'Cuerdas, palas y faroles. Entrena Ingeniería.' },
  { id: 'establo', name: 'Establo', cat: 'ciclo', size: [3, 3], unlock: 2, rank: 1, cost: { coins: 600, mats: { madera: 4 } }, time: 40, max: 1,
    happy: 2, xp: 40, desc: 'Mulas que cargan sin quejarse. Más carga y Guía.' },
  { id: 'dispensario', name: 'Dispensario', cat: 'ciclo', size: [2, 2], unlock: 3, rank: 2, cost: { coins: 900, mats: { hierbas: 3 } }, time: 45, max: 1,
    happy: 2, xp: 45, desc: 'Vendas, té de hierbas y alguien que escucha. Entrena Sanidad.' },
  { id: 'tambo', name: 'Tambo', cat: 'ciclo', size: [3, 3], unlock: 3, rank: 2, cost: { coins: 900 }, time: 45, max: 3,
    happy: 1, xp: 40, prod: { prov: 5, cycle: 3600, cap: 4 }, desc: 'Leche y queso para el camino. Las vacas no opinan.' },
  { id: 'molino', name: 'Molino', cat: 'ciclo', size: [2, 2], unlock: 5, rank: 3, cost: { coins: 2400, mats: { piedra: 4 } }, time: 90, max: 3,
    happy: 2, xp: 70, prod: { prov: 8, cycle: 5400, cap: 3 }, desc: 'Harina para el pan de la vianda.' },
  { id: 'conservera', name: 'Conservera', cat: 'ciclo', size: [3, 3], unlock: 8, rank: 5, cost: { coins: 9000, mats: { mineral: 6 } }, time: 240, max: 2,
    happy: 1, xp: 150, prod: { prov: 15, cycle: 7200, cap: 2 }, desc: 'Frascos y latas que aguantan cualquier viaje.' },

  // --- Decoración ---
  { id: 'arbol', name: 'Árbol', cat: 'deco', size: [1, 1], unlock: 1, cost: { coins: 20 }, time: 0, happy: 1, xp: 2, desc: 'Sombra y pájaros.' },
  { id: 'arbusto', name: 'Arbusto con Flores', cat: 'deco', size: [1, 1], unlock: 1, cost: { coins: 25 }, time: 0, happy: 1, xp: 2, desc: 'Flores de estación.' },
  { id: 'farol', name: 'Farol', cat: 'deco', size: [1, 1], unlock: 2, cost: { coins: 40 }, time: 0, happy: 1, xp: 3, desc: 'Ilumina las noches.' },
  { id: 'banco', name: 'Banco', cat: 'deco', size: [1, 1], unlock: 2, cost: { coins: 50 }, time: 0, happy: 2, xp: 3, desc: 'Para sentarse a ver pasar a la gente.' },
  { id: 'cerezo', name: 'Cerezo', cat: 'deco', size: [1, 1], unlock: 3, cost: { coins: 90 }, time: 0, happy: 2, xp: 5, desc: 'Flores de cerezo todo el año.' },
  { id: 'fuente', name: 'Fuente de la Plaza', cat: 'deco', size: [2, 2], unlock: 3, cost: { coins: 300 }, time: 10, happy: 6, xp: 15, desc: 'Agua fresca en el medio de la plaza.' },
  { id: 'macetas', name: 'Macetas de Tulipanes', cat: 'deco', size: [1, 1], unlock: 4, cost: { coins: 70 }, time: 0, happy: 2, xp: 4, desc: 'Tulipanes de colores.' },
  { id: 'estatua', name: 'Estatua del Fundador', cat: 'deco', size: [2, 2], unlock: 6, cost: { coins: 900 }, time: 20, happy: 10, xp: 30, desc: 'Homenaje a quien fundó el pueblo. Sí, a vos.' },
  { id: 'glorieta', name: 'Glorieta', rank: 3, cat: 'deco', size: [2, 2], unlock: 8, cost: { coins: 1400 }, time: 30, happy: 12, xp: 40, desc: 'Ideal para picnics.' },
  { id: 'arco_rosas', name: 'Arco de Rosas', cat: 'deco', size: [1, 1], unlock: 9, cost: { coins: 500 }, time: 0, happy: 5, xp: 12, desc: 'Rosas trepadoras.' },
  { id: 'unicornio', name: 'Estatua del Unicornio', rank: 4, cat: 'deco', size: [2, 2], unlock: 12, cost: { gems: 15 }, time: 20, happy: 25, xp: 60, desc: 'Nadie sabe quién la encargó.' },
  { id: 'lago', name: 'Laguna de los Patos', rank: 4, cat: 'deco', size: [3, 3], unlock: 14, cost: { coins: 4000 }, time: 60, happy: 22, xp: 80, desc: 'Patos que nadan en círculos.' },

  // --- Caminos ---
  { id: 'camino', name: 'Camino de Piedra', cat: 'camino', size: [1, 1], unlock: 1, cost: { coins: 5 }, time: 0, xp: 0, desc: 'Conectá tu ciudad.' },
  { id: 'camino_rosa', name: 'Camino de Ladrillo', cat: 'camino', size: [1, 1], unlock: 3, cost: { coins: 12 }, time: 0, happy: 0, xp: 0, desc: 'Ladrillos rojizos, como los de antes.' },
  { id: 'camino_dorado', name: 'Camino Dorado', rank: 3, cat: 'camino', size: [1, 1], unlock: 8, cost: { coins: 30 }, time: 0, happy: 0, xp: 0, desc: 'Adoquines dorados, para la avenida principal.' },
];

// ---------------- MATERIALES Y MONUMENTOS ----------------
// Cada minijuego da su material (main.js finishGame: 1 por estrella, mínimo 1, +1 si ganaste). Con los materiales se
// construyen los monumentos, por etapas: el nivel del edificio es la etapa (1 = cimientos … N = terminado).
// cost.mats = { cristal: n, ... } (store.canAfford/spend/grant los entienden igual que monedas y gemas).
export const MATERIALS = [
  { id: 'cristal', name: 'Cristales', one: 'cristal', game: 'match3', icon: 'cristal', color: '#c08cff' },
  { id: 'ladrillo', name: 'Ladrillos', one: 'ladrillo', game: 'blocks', icon: 'ladrillo', color: '#e0764a' },
  { id: 'tuerca', name: 'Tuercas', one: 'tuerca', game: 'parking', icon: 'tuerca', color: '#a9b4c2' },
  { id: 'mapa', name: 'Mapas', one: 'mapa', game: 'driving', icon: 'mapa', color: '#e9c48a' },
];
// Materiales de región (DESIGN-CORE.md §5.1): los trae la expedición y viven en state.materials con estos ids.
// Los de minijuego de arriba quedan como están hasta la migración de la Fase 5.
export const REGION_MATERIALS = [
  { id: 'madera', name: 'Madera', one: 'madera', icon: '🪵', color: '#a8774a' },
  { id: 'piedra', name: 'Piedra', one: 'piedra', icon: '🪨', color: '#9b9286' },
  { id: 'mineral', name: 'Mineral', one: 'mineral', icon: '⛏️', color: '#7d8a99' },
  { id: 'hierbas', name: 'Hierbas', one: 'hierbas', icon: '🌿', color: '#6f8a4f' },
];
export const REGION_MAT_IDS = REGION_MATERIALS.map(m => m.id);
export const MATERIAL_BY_ID = Object.fromEntries([...MATERIALS, ...REGION_MATERIALS].map(m => [m.id, m]));
export const MATERIAL_BY_GAME = Object.fromEntries(MATERIALS.map(m => [m.game, m]));

// ---------------- RECURSOS DEL CICLO ----------------
// Provisiones (depósito con tope), planos, equipo, reservas y colonos (DESIGN-CORE.md §5.1). Íconos: emojis pixelados.
export const RESOURCES = {
  prov: { name: 'Provisiones', one: 'provisión', icon: '🍞' },
  planos: { name: 'Planos', one: 'plano', icon: '📜' },
  colonos: { name: 'Colonos', one: 'colono', icon: '👪' },
};
export const PROV_START = 30;
export const PROV_CAP_BASE = 40, PROV_CAP_PER_CASA = 20, PROV_CAP_PER_GRANERO = 40;   // tope del depósito
export const RESERVE_CAP = 10;

// Edificios del ciclo: qué da cada nivel (índice = nivel − 1). role = rol que entrena (nivel del rol = el del edificio).
//  slots: lugares del grupo con quien lidera · provMax: provisiones por salida normal · cargo: carga extra
//  equipSlots: equipo por salida · tiredMin: minutos de descanso tras un fracaso · prov: provisiones por tanda
//  up: costo extra de la mejora a ese nivel (materiales desde el nivel 3; la Casa pide planos en el 4 y el 5)
export const CYCLE = {
  casa_exp: { role: 'exploracion', slots: [2, 2, 3, 3, 4], provMax: [18, 21, 24, 27, 30],
    up: { 3: { mats: { madera: 4, piedra: 2 } }, 4: { mats: { piedra: 5, madera: 3 }, planos: 2 }, 5: { mats: { piedra: 6, mineral: 4 }, planos: 4 } } },
  taller: { role: 'ingenieria', equipSlots: [1, 1, 2, 2, 3],
    up: { 3: { mats: { madera: 4, mineral: 1 } }, 4: { mats: { mineral: 4, madera: 3 } }, 5: { mats: { mineral: 6, piedra: 3 } } } },
  establo: { role: 'guia', cargo: [3, 6, 9, 12, 15],
    up: { 3: { mats: { madera: 5 } }, 4: { mats: { madera: 6, hierbas: 3 } }, 5: { mats: { madera: 8, piedra: 4 } } } },
  dispensario: { role: 'sanidad', tiredMin: [100, 80, 60, 40, 20],
    up: { 3: { mats: { hierbas: 4 } }, 4: { mats: { hierbas: 6, madera: 2 } }, 5: { mats: { hierbas: 8, mineral: 2 } } } },
  huerta: { role: 'recoleccion', prov: [2, 3, 4, 5, 6],
    up: { 3: { mats: { madera: 2 } }, 4: { mats: { madera: 3, hierbas: 2 } }, 5: { mats: { madera: 4, hierbas: 3 } } } },
  tambo: { prov: [5, 7, 9, 11, 13], up: { 3: { mats: { madera: 3 } }, 4: { mats: { madera: 4, hierbas: 2 } }, 5: { mats: { madera: 5, piedra: 3 } } } },
  molino: { prov: [8, 11, 14, 17, 20], up: { 3: { mats: { piedra: 4 } }, 4: { mats: { piedra: 6, madera: 3 } }, 5: { mats: { piedra: 8, mineral: 3 } } } },
  conservera: { prov: [15, 19, 23, 27, 31], up: { 3: { mats: { mineral: 4 } }, 4: { mats: { mineral: 6, piedra: 3 } }, 5: { mats: { mineral: 8, piedra: 4 } } } },
};
export const ROLE_BUILDING = { exploracion: 'casa_exp', ingenieria: 'taller', guia: 'establo', sanidad: 'dispensario', recoleccion: 'huerta' };
export const TIRED_MIN_NONE = 120;   // descanso tras un fracaso sin Dispensario

// Taller: equipo (1 uso por salida) y reservas para las amenazas (desde el rango Caserío). Fabricar es al instante.
export const EQUIP_RECIPES = {
  cuerda: { cost: { coins: 60, mats: { madera: 3 } } },
  pala: { cost: { coins: 100, mats: { mineral: 2, madera: 1 } } },
  lona: { cost: { coins: 80, mats: { hierbas: 1, madera: 2 } } },
  farol: { cost: { coins: 80, mats: { mineral: 1, madera: 1 } } },
  botiquin: { cost: { coins: 60, mats: { hierbas: 3 } } },
  carreta: { cost: { coins: 250, mats: { madera: 6, mineral: 2 } }, establo: 2 },
};
export const EQUIP_IDS = Object.keys(EQUIP_RECIPES);
export const RESERVES = {
  arena: { name: 'Bolsas de arena', icon: '🧱', threat: 'crecida', cost: { coins: 40, mats: { piedra: 2 } } },
  tinajas: { name: 'Tinajas de agua', icon: '🏺', threat: 'sequia', cost: { coins: 40, mats: { piedra: 1, hierbas: 1 } } },
  baldes: { name: 'Baldes', icon: '🪣', threat: 'incendio', cost: { coins: 40, mats: { mineral: 1, madera: 1 } } },
  lonas: { name: 'Lonas', icon: '⛺', threat: 'tormenta', cost: { coins: 40, mats: { hierbas: 1, madera: 1 } } },
  lena: { name: 'Leña', icon: '🪵', threat: 'helada', cost: { coins: 20, mats: { madera: 2 } } },
};
export const RESERVE_IDS = Object.keys(RESERVES);
export const RESERVES_RANK = 2;
// Terreno: la expansión n (1..7) pide estas zonas exploradas en total (§2.9).
export const EXPANSION_ZONES = [1, 3, 5, 8, 11, 14, 18];

const ST4 = ['Cimientos', 'Paredes', 'Detalles', '¡Inauguración!'];
const ST5 = ['Cimientos', 'Estructura', 'Paredes', 'Detalles', '¡Inauguración!'];
const stg = (coins, mats, time, gems = 0) => ({ cost: gems ? { coins, gems, mats } : { coins, mats }, time });
// art: artículo del nombre ('el Faro', 'la Torre del Reloj') para armar frases.
// bonus.type: shopCoins (monedas de negocios) · happy (puntos de felicidad) · gameXp (XP de minijuegos)
//             pass (chispas del Pase por partida) · stickers (chance de figurita al ganar) · time (obras más rápidas)
export const MONUMENTS = {
  faro: {
    name: 'Faro', art: 'el', size: [3, 3], rank: 3, charm: 120, happy: 8, bonus: { type: 'shopCoins', value: 0.10 }, bonusIcon: 'coin',
    bonusText: '+10% de monedas en todos los negocios', desc: 'Ilumina el pueblo de noche. Terminado: +10% de monedas en todos los negocios.',
    stageNames: ST4, stages: [
      stg(1500, { ladrillo: 6, cristal: 4 }, 120), stg(2500, { ladrillo: 10, cristal: 6 }, 300),
      stg(4000, { ladrillo: 12, cristal: 10 }, 600), stg(6000, { ladrillo: 16, cristal: 12 }, 1200),
    ] },
  jardin: {
    name: 'Jardín Botánico', art: 'el', size: [4, 4], rank: 4, charm: 150, happy: 15, bonus: { type: 'happy', value: 0.25 }, bonusIcon: 'smile',
    bonusText: '+25% de felicidad en toda la ciudad', desc: 'Un invernadero gigante lleno de plantas. Terminado: +25% de felicidad.',
    stageNames: ST4, stages: [
      stg(3000, { cristal: 8, tuerca: 5 }, 300), stg(5000, { cristal: 12, tuerca: 8 }, 600),
      stg(8000, { cristal: 16, tuerca: 12 }, 1200), stg(12000, { cristal: 20, tuerca: 16 }, 1800, 5),
    ] },
  observatorio: {
    name: 'Observatorio', art: 'el', size: [3, 3], rank: 5, charm: 170, happy: 10, bonus: { type: 'gameXp', value: 0.25 }, bonusIcon: 'xp',
    bonusText: '+25% de XP en los minijuegos', desc: 'Para mirar las estrellas. Terminado: +25% de experiencia en cada partida.',
    stageNames: ST5, stages: [
      stg(6000, { cristal: 10, mapa: 6 }, 600), stg(9000, { cristal: 14, mapa: 10 }, 900), stg(13000, { cristal: 18, mapa: 14 }, 1500),
      stg(18000, { cristal: 22, mapa: 18 }, 2400), stg(24000, { cristal: 26, mapa: 22 }, 3600, 10),
    ] },
  estadio: {
    name: 'Estadio', art: 'el', size: [4, 4], rank: 5, charm: 190, happy: 14, bonus: { type: 'pass', value: 0.25 }, bonusIcon: 'sparkle',
    bonusText: '+25% de chispas del Pase por partida', desc: '¡Que empiece el partido! Terminado: +25% de chispas del Pase en cada partida.',
    stageNames: ST5, stages: [
      stg(7000, { ladrillo: 12, tuerca: 8 }, 600), stg(10000, { ladrillo: 16, tuerca: 12 }, 900), stg(14000, { ladrillo: 20, tuerca: 16 }, 1500),
      stg(19000, { ladrillo: 24, tuerca: 20 }, 2400), stg(26000, { ladrillo: 28, tuerca: 24 }, 3600, 10),
    ] },
  museo: {
    name: 'Museo', art: 'el', size: [4, 4], rank: 6, charm: 220, happy: 12, bonus: { type: 'stickers', value: 0.5 }, bonusIcon: '🃏',
    bonusText: '+50% de chance de figurita al ganar', desc: 'Historia, arte ¡y un dinosaurio! Terminado: más figuritas al ganar partidas.',
    stageNames: ST5, stages: [
      stg(15000, { mapa: 12, ladrillo: 10, cristal: 8 }, 1200), stg(22000, { mapa: 16, ladrillo: 14, cristal: 12 }, 1800),
      stg(30000, { mapa: 20, ladrillo: 18, cristal: 16 }, 2700), stg(40000, { mapa: 26, ladrillo: 22, cristal: 20 }, 3600),
      stg(52000, { mapa: 30, ladrillo: 28, cristal: 24 }, 5400, 15),
    ] },
  torre_reloj: {
    name: 'Torre del Reloj', art: 'la', size: [3, 3], rank: 7, charm: 260, happy: 12, bonus: { type: 'time', value: 0.10 }, bonusIcon: 'clock',
    bonusText: 'Obras y mejoras 10% más rápidas', desc: 'La más alta del pueblo, con campana. Terminada: todas las obras tardan 10% menos.',
    stageNames: ST5, stages: [
      stg(30000, { tuerca: 14, mapa: 12, ladrillo: 10, cristal: 10 }, 1800), stg(42000, { tuerca: 18, mapa: 16, ladrillo: 14, cristal: 14 }, 2700),
      stg(56000, { tuerca: 24, mapa: 20, ladrillo: 18, cristal: 18 }, 3600), stg(75000, { tuerca: 30, mapa: 26, ladrillo: 24, cristal: 24 }, 5400),
      stg(100000, { tuerca: 36, mapa: 32, ladrillo: 30, cristal: 30 }, 7200, 20),
    ] },
};
export const MONUMENT_IDS = Object.keys(MONUMENTS);
// los monumentos también son edificios (cat 'monumento', uno de cada uno); construirlos = pagar la etapa 1
for (const [id, mo] of Object.entries(MONUMENTS)) {
  BUILDINGS.push({ id, name: mo.name, cat: 'monumento', size: mo.size, unlock: 1, rank: mo.rank, cost: mo.stages[0].cost, time: mo.stages[0].time,
    max: 1, happy: mo.happy, charm: mo.charm, xp: 60, desc: mo.desc });
}

export const BUILDING_BY_ID = Object.fromEntries(BUILDINGS.map(b => [b.id, b]));
export const CATEGORIES = [
  { id: 'casa', name: 'Casas' },
  { id: 'ciclo', name: 'Expedición' },
  { id: 'negocio', name: 'Negocios' },
  { id: 'especial', name: 'Especiales' },
  { id: 'monumento', name: 'Monumentos' },
  { id: 'deco', name: 'Deco' },
  { id: 'camino', name: 'Caminos' },
];

// ---------------- RANGO DE LA CIUDAD ----------------
// look: qué estrena la Municipalidad a la vista en ese rango (models-special.js).
// El nivel de la Municipalidad (id 'castillo') ES el rango de la ciudad. Para subir de rango hay que cumplir un
// "expediente" (req) además de pagar la obra. Cada rango suma +8% de producción global y puede dar constructoras,
// más terreno (land = expansiones permitidas), edificios nuevos (BUILDINGS[].rank) y un premio al llegar.
// req: pop (población), happy (% de felicidad), charm (Encanto), shops (tipos de negocio distintos), monuments (terminados).
export const TOWN_RANKS = [
  { rank: 1, name: 'Aldea', emoji: '🏕️', land: 1 },
  { rank: 2, name: 'Caserío', emoji: '🏡', look: 'pórtico con columnas', land: 2, cost: { coins: 800, gems: 2 }, time: 60, reqLevel: 3,
    req: { pop: 12, happy: 30, charm: 40, shops: 1 }, reward: { gems: 5, chest: 'madera' } },
  { rank: 3, name: 'Pueblo', emoji: '🏘️', look: 'alas a los costados', land: 3, builders: 1, cost: { coins: 2500, gems: 5 }, time: 180, reqLevel: 7,
    req: { pop: 45, happy: 40, charm: 140, shops: 3 }, reward: { gems: 10, chest: 'plata' } },
  { rank: 4, name: 'Villa', emoji: '⛲', look: 'fuentes en la plaza', land: 4, cost: { coins: 6000, gems: 10 }, time: 420, reqLevel: 12,
    req: { pop: 90, happy: 45, charm: 300, shops: 5, monuments: 1 }, reward: { gems: 15, chest: 'oro' } },
  { rank: 5, name: 'Ciudad', emoji: '🏙️', look: 'cúpula dorada y banderines', land: 5, cost: { coins: 14000, gems: 20 }, time: 900, reqLevel: 20,
    req: { pop: 150, happy: 50, charm: 520, shops: 7, monuments: 2 }, reward: { gems: 25, chest: 'oro' } },
  { rank: 6, name: 'Gran Ciudad', emoji: '🌆', look: 'techo azul y torres doradas', land: 7, builders: 1, cost: { coins: 30000, gems: 30 }, time: 1800, reqLevel: 26,
    req: { pop: 220, happy: 55, charm: 800, shops: 9, monuments: 3 }, reward: { gems: 35, chest: 'oro' } },
  { rank: 7, name: 'Metrópolis', emoji: '🌃', look: 'mirador, alfombra roja y banderas gigantes', land: 7, cost: { coins: 60000, gems: 45 }, time: 3600, reqLevel: 31,
    req: { pop: 300, happy: 60, charm: 1150, shops: 10, monuments: 5 }, reward: { gems: 50, chest: 'real' } },
  { rank: 8, name: 'Capital', emoji: '🏛️', look: 'arco dorado y fuegos artificiales', land: 7, cost: { coins: 120000, gems: 60 }, time: 7200, reqLevel: 36,
    req: { pop: 400, happy: 65, charm: 1600, shops: 11, monuments: 6 }, reward: { gems: 80, chest: 'real' } },
];
export const RANK_REQ_LABELS = {
  pop: ['Población', 'people'], happy: ['Felicidad', 'smile'], charm: ['Encanto', 'sparkle'],
  shops: ['Tipos de negocio', 'shop'], monuments: ['Monumentos terminados', 'monument'],
};
// Compatibilidad: mejoras de la Municipalidad en el formato viejo (level = rango)
export const CASTLE_LEVELS = TOWN_RANKS.slice(1).map(r => ({ level: r.rank, cost: r.cost, time: r.time, reqLevel: r.reqLevel }));
export const CASTLE_BONUS_PER_LEVEL = 0.08; // +8% producción global por nivel extra de castillo

// ---------------- MINIJUEGOS ----------------
export const GAMES = [
  { id: 'match3', name: 'Joyas Brillantes', desc: 'Combiná 3 o más joyas iguales.', building: 'joyeria', unlock: 1, color: '#ff7eb6' },
  { id: 'blocks', name: 'Bloques Pixel', desc: 'Encajá bloques y completá filas.', building: 'torre_bloques', unlock: 2, color: '#b58cff' },
  { id: 'parking', name: 'Estacionamiento Express', desc: 'Estacioná tu auto sin chocar.', building: 'garaje', unlock: 3, color: '#6fe3c1' },
  { id: 'driving', name: 'Ruta Pixel', desc: 'Manejá por la ciudad juntando monedas y gemas.', building: 'pista', unlock: 5, color: '#8fd3ff' },
];
export const GAME_BY_ID = Object.fromEntries(GAMES.map(g => [g.id, g]));

// Escala de premios de minijuegos según nivel del jugador (para que sigan valiendo la pena)
export function rewardScale(playerLevel) { return 1 + (playerLevel - 1) * 0.15; }

// ---------------- NIVELES ----------------
export const MAX_LEVEL = 40;
export function xpForLevel(level) { // xp necesaria para pasar de `level` a `level+1`
  return Math.round(40 * Math.pow(level, 1.55) + 20);
}
export function levelUpReward(newLevel) {
  return { coins: 100 * newLevel, gems: 3 + Math.floor(newLevel / 3) };
}

// ---------------- PERSONALIZACIÓN DEL PERSONAJE ----------------
// Cada jugador elige su tipo de personaje (gratis y cambiable en el Vestidor). Cada pieza dice para qué
// tipos sirve (types). price: {coins|gems}, unlock: nivel. Los marcados free:true se tienen desde el inicio
// (cada tipo tiene al menos 2 piezas gratis por categoría, además de "Nada").
// En los animalitos: hair = diseño del pelaje, hairColor = color del pelaje (la piel no se usa).
export const AVATAR_FAMILIES = [
  { id: 'casual', name: 'Gente', emoji: '🧢' },
  { id: 'animal', name: 'Animales', emoji: '🐾' },
];
// look: look inicial al elegir el tipo (todo gratis)
export const AVATAR_TYPES = [
  { id: 'chica', name: 'Chica', family: 'casual', emoji: '👧', desc: 'Buzos, vestidos, jeans, gorras y zapatillas.',
    look: { skin: 2, hair: 'coleta', hairColor: 'pelirrojo', dress: 'buzo', dressColor: 'verde', crown: 'ninguna', acc: 'mochila' } },
  { id: 'chico', name: 'Chico', family: 'casual', emoji: '👦', desc: 'Remeras, camisas, jeans, gorras y mochila.',
    look: { skin: 3, hair: 'despeinado', hairColor: 'negro', dress: 'remera', dressColor: 'celeste', crown: 'gorra', acc: 'ninguno' } },
  { id: 'gatito', name: 'Gato', family: 'animal', emoji: '🐱', animal: true, desc: 'Orejas en punta, bigotes y cola.',
    look: { skin: 0, hair: 'pancita', hairColor: 'rubio', dress: 'pelito', dressColor: 'rosa', crown: 'ninguna', acc: 'ninguno' } },
  { id: 'zorrito', name: 'Zorro', family: 'animal', emoji: '🦊', animal: true, desc: 'Hocico fino y cola esponjosa.',
    look: { skin: 0, hair: 'pancita', hairColor: 'pelirrojo', dress: 'remerita', dressColor: 'celeste', crown: 'ninguna', acc: 'ninguno' } },
  { id: 'conejito', name: 'Conejo', family: 'animal', emoji: '🐰', animal: true, desc: 'Orejas largas y cola de pompón.',
    look: { skin: 0, hair: 'pancita', hairColor: 'blanco', dress: 'remerita', dressColor: 'rosa', crown: 'ninguna', acc: 'ninguno' } },
  { id: 'osito', name: 'Oso', family: 'animal', emoji: '🐻', animal: true, desc: 'Orejas redondas y panza clara.',
    look: { skin: 0, hair: 'pancita', hairColor: 'castano', dress: 'remerita', dressColor: 'rojo', crown: 'ninguna', acc: 'ninguno' } },
];
export const AVATAR_TYPE_BY_ID = Object.fromEntries(AVATAR_TYPES.map(t => [t.id, t]));
const HUMANS = ['chica', 'chico'];
const ANIMALS = ['gatito', 'zorrito', 'conejito', 'osito'];
const CASUAL = ['chica', 'chico'];

export const SKIN_TONES = ['#ffe0cc', '#f5c7a9', '#e8b08a', '#c98e66', '#a06c4a', '#6e4630'];
export const HAIR_COLORS = [
  { id: 'castano', hex: '#7a4a2a' }, { id: 'negro', hex: '#2b1d24' }, { id: 'rubio', hex: '#efcd7a' },
  { id: 'pelirrojo', hex: '#cf673e' }, { id: 'rosa', hex: '#e39cbf' }, { id: 'lila', hex: '#ab94d6' },
  { id: 'celeste', hex: '#8fc5e3' }, { id: 'menta', hex: '#80cbb0' }, { id: 'blanco', hex: '#f2eee8' }, { id: 'chocolate', hex: '#4a2c20' },
  { id: 'gris', hex: '#a9a2b0' },
];
export const OUTFIT_COLORS = [
  { id: 'rosa', hex: '#e392b0' }, { id: 'fucsia', hex: '#c4678e' }, { id: 'lila', hex: '#a993d6' }, { id: 'violeta', hex: '#7562b6' },
  { id: 'celeste', hex: '#9ccbe6' }, { id: 'azul', hex: '#5a7cc2' }, { id: 'menta', hex: '#80cbb0' }, { id: 'verde', hex: '#5fa86e' },
  { id: 'dorado', hex: '#f0c96e' }, { id: 'durazno', hex: '#efb592' }, { id: 'rojo', hex: '#cf5f5f' }, { id: 'blanco', hex: '#fbf6f1' }, { id: 'negro', hex: '#3b2f3a' },
];
export const HAIR_STYLES = [
  // personas
  { id: 'largo', name: 'Largo suelto', free: true, types: HUMANS },
  { id: 'coleta', name: 'Cola alta', free: true, types: HUMANS },
  { id: 'cortito', name: 'Corto clásico', free: true, types: HUMANS },
  { id: 'despeinado', name: 'Despeinado', free: true, types: HUMANS },
  { id: 'corto', name: 'Bob corto', price: { coins: 200 }, unlock: 1, types: HUMANS },
  { id: 'flequillo', name: 'Flequillo de costado', price: { coins: 250 }, unlock: 1, types: HUMANS },
  { id: 'rodete', name: 'Rodete', price: { coins: 350 }, unlock: 2, types: HUMANS },
  { id: 'jopo', name: 'Jopo', price: { coins: 450 }, unlock: 2, types: HUMANS },
  { id: 'trenzas', name: 'Dos trenzas', price: { coins: 500 }, unlock: 3, types: HUMANS },
  { id: 'barba', name: 'Barba de sabio', price: { coins: 600 }, unlock: 3, types: ['chico'] },
  { id: 'rizos', name: 'Rulos', price: { coins: 800 }, unlock: 5, types: HUMANS },
  { id: 'colitas', name: 'Dos colas', price: { coins: 1200 }, unlock: 7, types: HUMANS },
  { id: 'ondas', name: 'Ondas largas', price: { gems: 15 }, unlock: 9, types: HUMANS },
  // pelajes de animalitos
  { id: 'pancita', name: 'Panza clara', free: true, types: ANIMALS },
  { id: 'liso', name: 'Liso', free: true, types: ANIMALS },
  { id: 'medias', name: 'Patas blancas', price: { coins: 250 }, unlock: 1, types: ANIMALS },
  { id: 'manchas', name: 'Manchas', price: { coins: 400 }, unlock: 2, types: ANIMALS },
  { id: 'rayas', name: 'Rayas', price: { coins: 600 }, unlock: 4, types: ANIMALS },
  { id: 'brillitos', name: 'Pelaje con destellos', price: { gems: 12 }, unlock: 7, types: ANIMALS },
];
export const DRESS_STYLES = [
  // vestidos
  { id: 'clasico', name: 'Vestido clásico', free: true, types: ['chica'] },
  { id: 'corto', name: 'Vestido corto', free: true, types: CASUAL },
  { id: 'gala', name: 'Vestido de noche', price: { coins: 600 }, unlock: 2, types: ['chica'] },
  { id: 'overol', name: 'Overol', price: { coins: 400 }, unlock: 3, types: [...CASUAL, ...ANIMALS] },
  { id: 'sirena', name: 'Vestido largo', price: { coins: 1000 }, unlock: 5, types: CASUAL },
  { id: 'deportivo', name: 'Deportivo', price: { coins: 700 }, unlock: 4, types: ['chica'] },
  { id: 'capa', name: 'Vestido con capa', price: { gems: 20 }, unlock: 8, types: ['chica'] },
  { id: 'estrellas', name: 'Vestido de estrellas', price: { gems: 30 }, unlock: 12, types: CASUAL },
  // de gala
  { id: 'chaqueta', name: 'Chaqueta de gala', free: true, types: ['chico'] },
  { id: 'capa_real', name: 'Capa de gala', free: true, types: ['chico'] },
  { id: 'gala_p', name: 'Uniforme de gala', price: { coins: 600 }, unlock: 2, types: ['chico'] },
  { id: 'caballero', name: 'Armadura de caballero', price: { coins: 1000 }, unlock: 5, types: ['chico'] },
  { id: 'estrellas_p', name: 'Traje de estrellas', price: { gems: 30 }, unlock: 12, types: CASUAL },
  // casual
  { id: 'buzo', name: 'Buzo y jeans', free: true, types: [...CASUAL, ...ANIMALS] },
  { id: 'remera', name: 'Remera y jeans', free: true, types: CASUAL },
  { id: 'pollera', name: 'Remera y pollera', price: { coins: 300 }, unlock: 1, types: ['chica'] },
  { id: 'camisa', name: 'Camisa a cuadros', price: { coins: 450 }, unlock: 2, types: CASUAL },
  { id: 'campera', name: 'Campera de jean', price: { coins: 650 }, unlock: 3, types: CASUAL },
  { id: 'futbol', name: 'Equipo de fútbol', price: { coins: 800 }, unlock: 4, types: CASUAL },
  // disfraz de hada
  { id: 'petalos', name: 'Vestido de pétalos', free: true, types: CASUAL },
  { id: 'hojas', name: 'Vestido de hojas', free: true, types: CASUAL },
  { id: 'tutu', name: 'Tutú de danza', price: { coins: 600 }, unlock: 3, types: CASUAL },
  { id: 'mariposa', name: 'Vestido mariposa', price: { coins: 900 }, unlock: 5, types: CASUAL },
  // disfraz de mago
  { id: 'tunica', name: 'Túnica de mago', free: true, types: CASUAL },
  { id: 'aprendiz', name: 'Túnica de aprendiz', free: true, types: CASUAL },
  { id: 'tunica_capa', name: 'Túnica con capa', price: { coins: 700 }, unlock: 3, types: CASUAL },
  { id: 'lunar', name: 'Túnica lunar', price: { coins: 1000 }, unlock: 5, types: CASUAL },
  { id: 'archimago', name: 'Manto de archimago', price: { gems: 25 }, unlock: 9, types: CASUAL },
  // animalitos
  { id: 'pelito', name: 'Sin ropa', free: true, types: ANIMALS },
  { id: 'remerita', name: 'Remera', free: true, types: ANIMALS },
  { id: 'panuelo', name: 'Pañuelo', price: { coins: 200 }, unlock: 1, types: ANIMALS },
  { id: 'vestidito', name: 'Vestido', price: { coins: 450 }, unlock: 2, types: ANIMALS },
  { id: 'capita', name: 'Capa de héroe', price: { coins: 700 }, unlock: 4, types: ANIMALS },
  { id: 'frac', name: 'Chaleco y moño', price: { gems: 15 }, unlock: 6, types: ANIMALS },
];
// "Cabeza": gorras, gorros, sombreros y vinchas (el id de la categoría sigue siendo crown por compatibilidad)
export const CROWNS = [
  { id: 'ninguna', name: 'Nada', free: true, types: [...CASUAL, ...ANIMALS] },
  { id: 'flores', name: 'Guirnalda de flores', price: { coins: 400 }, unlock: 3, types: [...CASUAL, ...ANIMALS] },
  { id: 'moño', name: 'Moño', price: { coins: 300 }, unlock: 1, types: ['chica'] },
  { id: 'vincha', name: 'Vincha', free: true, types: ['chica'] },
  { id: 'orejitas', name: 'Orejas de gato', price: { coins: 900 }, unlock: 5, types: CASUAL },
  // aventura
  { id: 'laurel', name: 'Laurel dorado', free: true, types: CASUAL },
  { id: 'casco', name: 'Casco de caballero', price: { coins: 600 }, unlock: 3, types: ['chico'] },
  // casual
  { id: 'gorra', name: 'Gorra', free: true, types: [...CASUAL, ...ANIMALS] },
  { id: 'gorro', name: 'Gorro de lana', free: true, types: [...CASUAL, ...ANIMALS] },
  { id: 'auris', name: 'Auriculares', price: { coins: 500 }, unlock: 2, types: CASUAL },
  { id: 'piluso', name: 'Piluso', price: { coins: 400 }, unlock: 3, types: CASUAL },
  // disfraces
  { id: 'diadema', name: 'Diadema de hojas', free: true, types: CASUAL },
  { id: 'antenitas', name: 'Antenas', free: true, types: CASUAL },
  { id: 'sombrero_mago', name: 'Sombrero de mago', free: true, types: CASUAL },
  { id: 'capucha', name: 'Capucha', free: true, types: CASUAL },
  { id: 'sombrero_luna', name: 'Sombrero lunar', price: { coins: 700 }, unlock: 4, types: CASUAL },
  { id: 'sombrero_estrellas', name: 'Sombrero de estrellas', price: { gems: 15 }, unlock: 8, types: CASUAL },
  // animalitos
  { id: 'lacito', name: 'Lazo', free: true, types: ANIMALS },
  { id: 'gorrito', name: 'Gorro de fiesta', free: true, types: ANIMALS },
  { id: 'galera', name: 'Galera', price: { coins: 700 }, unlock: 5, types: [...CASUAL, ...ANIMALS] },
];
export const ACCESSORIES = [
  { id: 'ninguno', name: 'Nada', free: true, types: [...CASUAL, ...ANIMALS] },
  // lindos
  { id: 'collar', name: 'Collar de perlas', free: true, types: CASUAL },
  { id: 'ramo', name: 'Ramo de flores', free: true, types: CASUAL },
  { id: 'bolso', name: 'Cartera', price: { coins: 450 }, unlock: 2, types: ['chica', ...ANIMALS] },
  { id: 'anteojos', name: 'Anteojos de sol', price: { coins: 600 }, unlock: 4, types: [...CASUAL, ...ANIMALS] },
  { id: 'alas', name: 'Alas de tela', price: { gems: 20 }, unlock: 6, types: CASUAL },
  { id: 'gatito', name: 'Gato en brazos', price: { gems: 25 }, unlock: 8, types: HUMANS },
  // aventura
  { id: 'espada', name: 'Espada de madera', free: true, types: ['chico'] },
  { id: 'escudo', name: 'Escudo de madera', free: true, types: ['chico'] },
  // casual
  { id: 'mochila', name: 'Mochila', free: true, types: [...CASUAL, ...ANIMALS] },
  { id: 'pelota', name: 'Pelota', free: true, types: [...CASUAL, ...ANIMALS] },
  { id: 'globo', name: 'Globo', price: { coins: 350 }, unlock: 2, types: [...CASUAL, ...ANIMALS] },
  { id: 'patineta', name: 'Patineta', price: { coins: 700 }, unlock: 4, types: [...CASUAL, ...ANIMALS] },
  // disfraces
  { id: 'alas_hada', name: 'Alas de hada', free: true, types: CASUAL },
  { id: 'farolito', name: 'Frasco de luciérnagas', price: { coins: 500 }, unlock: 3, types: [...CASUAL, ...ANIMALS] },
  { id: 'alas_mariposa', name: 'Alas de mariposa', price: { coins: 900 }, unlock: 5, types: [...CASUAL, ...ANIMALS] },
  { id: 'baston', name: 'Bastón de mago', free: true, types: CASUAL },
  { id: 'libro', name: 'Libro de hechizos', free: true, types: CASUAL },
  { id: 'orbe', name: 'Bola de cristal', price: { coins: 600 }, unlock: 3, types: CASUAL },
  { id: 'buho', name: 'Búho mensajero', price: { gems: 20 }, unlock: 6, types: CASUAL },
];
/** Tipo de personaje (o el primero si el id no existe). */
export function avatarType(id) { return AVATAR_TYPE_BY_ID[id] || AVATAR_TYPES[0]; }
/** ¿La pieza sirve para ese tipo de personaje? (las piezas sin types son de personas, por compatibilidad) */
export function fitsType(item, type) { return !!item && (item.types ? item.types.includes(type) : HUMANS.includes(type)); }

// Tipos y piezas que ya no existen (la realeza se fue): saves viejos y perfiles de amistades se traducen así.
export const LEGACY_TYPES = { princesa: 'chica', principe: 'chico', hada: 'chica', mago: 'chico' };
export const LEGACY_ITEMS = {
  crown: { tiara: 'vincha', corona: 'galera', estrella: 'auris', corona_p: 'gorra', corona_rey: 'galera', corona_cristal: 'sombrero_estrellas' },
  acc: { varita: 'globo', cetro: 'patineta', varita_flor: 'ramo' },
  topper: { corona: 'corazon' },
};

// ---------------- PERSONALIZACIÓN AUTO ----------------
// stats: speed / handling 1..5 (los usan los minijuegos de manejo)
export const CAR_BODIES = [
  { id: 'convertible', name: 'Convertible', free: true, speed: 3, handling: 3 },
  { id: 'mini', name: 'Mini', price: { coins: 600 }, unlock: 3, speed: 2, handling: 5 },
  { id: 'jeep', name: 'Jeep safari', price: { coins: 1200 }, unlock: 5, speed: 3, handling: 4 },
  { id: 'deportivo', name: 'Deportivo', price: { coins: 2500 }, unlock: 7, speed: 5, handling: 3 },
  { id: 'limusina', name: 'Limusina', price: { gems: 25 }, unlock: 9, speed: 4, handling: 2 },
  { id: 'carruaje', name: 'Calabaza rodante', price: { gems: 40 }, unlock: 12, speed: 4, handling: 4 },
];
export const CAR_WHEELS = [
  { id: 'clasica', name: 'Clásicas', free: true },
  { id: 'dorada', name: 'Doradas', price: { coins: 400 }, unlock: 3 },
  { id: 'estrella', name: 'Estrella', price: { coins: 700 }, unlock: 5 },
  { id: 'flor', name: 'Flor', price: { gems: 8 }, unlock: 6 },
];
export const CAR_TOPPERS = [
  { id: 'ninguno', name: 'Nada', free: true },
  { id: 'moño', name: 'Moño', price: { coins: 300 }, unlock: 3 },
  { id: 'corazon', name: 'Corazón', price: { coins: 600 }, unlock: 4 },
  { id: 'alas', name: 'Alerón', price: { gems: 15 }, unlock: 8 },
];

export const CUSTOM_CATALOG = {
  hair: HAIR_STYLES, dress: DRESS_STYLES, crown: CROWNS, acc: ACCESSORIES,
  body: CAR_BODIES, wheels: CAR_WHEELS, topper: CAR_TOPPERS,
};

// ---------------- MISIONES ----------------
// Tipos de objetivo (goal.type) — se alimentan desde eventos del bus en quests.js:
//  build {id?}           terminar de construir (cualquiera o un id)
//  upgrade {id?}         terminar una mejora
//  collect               monedas recolectadas de edificios (suma)
//  earn                  monedas ganadas de cualquier fuente (suma)
//  play {game?}          partidas jugadas de un minijuego
//  stars {game?}         estrellas obtenidas en minijuegos (suma)
//  score {game}          puntaje en UNA partida >= count (count es el puntaje)
//  customize             cambios en vestidor/garaje
//  buy                   compras en vestidor/garaje
//  level                 llegar a nivel count (absoluto)
//  pop                   población >= count (absoluto)
//  happy                 felicidad total >= count (absoluto)
//  charm                 Encanto de la ciudad >= count (absoluto)
//  castle                rango de la ciudad (nivel de la Municipalidad) >= count (absoluto)
//  expand                expansiones de terreno (absoluto)
//  expedition {kind?, region?, equip?, minStars?}   salidas terminadas (las que cumplen el filtro)
//  zone {region?}        zonas exploradas (absoluto: en esa región o en total)
//  expStars              estrellas de expedición (suma) · expFar: casillas lejanas pisadas (suma)
//  prov                  provisiones cobradas de los productores (suma)
//  craft {id?}           cosas fabricadas en el Taller (suma)
// Las misiones se siguen por id (state.quests.done), así una fase puede sumar misiones en el medio de la cadena sin
// correr las demás (t15–t17 son de la Fase 3, Amenazas). La cadena vieja de minijuegos (m1–m15) se reemplazó por el
// tutorial del ciclo (DESIGN-CORE.md §6.1); lo ya cobrado no se repite (quests.js, OLD_MAIN).
export const MAIN_QUESTS = [
  { id: 't1', title: 'Primera casa', text: 'Construí una Casa para la primera gente del pueblo.', goal: { type: 'build', id: 'casita', count: 1 }, reward: { coins: 100, xp: 20 } },
  { id: 't2', title: 'Algo para comer', text: 'Construí una Huerta: da las provisiones para salir a explorar.', goal: { type: 'build', id: 'huerta', count: 1 }, reward: { coins: 80, xp: 20 } },
  { id: 't3', title: 'Primera cosecha', text: 'Tocá la Huerta y juntá 4 provisiones.', goal: { type: 'prov', count: 4 }, reward: { coins: 60, xp: 15 } },
  { id: 't4', title: 'Base de operaciones', text: 'Construí la Casa de Expediciones.', goal: { type: 'build', id: 'casa_exp', count: 1 }, reward: { gems: 2, xp: 30 } },
  { id: 't5', title: 'Primera salida', text: 'Hacé la salida corta al Bosque del Arroyo (botón Expedición).', goal: { type: 'expedition', kind: 'corta', region: 'bosque', count: 1 }, reward: { coins: 100, xp: 30, mats: { madera: 3 } } },
  { id: 't6', title: 'Con lo que trajiste', text: 'Construí el Taller: pide 3 de madera.', goal: { type: 'build', id: 'taller', count: 1 }, reward: { coins: 60, xp: 30, mats: { madera: 3 } } },
  { id: 't7', title: 'Bien equipados', text: 'Fabricá una Cuerda en el Taller.', goal: { type: 'craft', id: 'cuerda', count: 1 }, reward: { coins: 100, xp: 25 } },
  { id: 't8', title: 'Más gente', text: 'Llegá a 15 de población.', goal: { type: 'pop', count: 15 }, reward: { coins: 200, xp: 40 } },
  { id: 't9', title: 'Pan del día', text: 'Construí la Panadería.', goal: { type: 'build', id: 'panaderia', count: 1 }, reward: { coins: 150, xp: 30 } },
  { id: 't10', title: 'Salida en serio', text: 'Hacé una salida normal llevando la Cuerda.', goal: { type: 'expedition', kind: 'normal', equip: 'cuerda', count: 1 }, reward: { gems: 3, xp: 40, chest: 'madera' } },
  { id: 't11', title: 'Zona explorada', text: 'Cumplí el objetivo de la zona 1 del Bosque del Arroyo.', goal: { type: 'zone', region: 'bosque', count: 1 }, reward: { gems: 3, xp: 50, prov: 10 } },
  { id: 't12', title: 'Más terreno', text: 'Ampliá la ciudad: el terreno se gana explorando.', goal: { type: 'expand', count: 1 }, reward: { gems: 5, xp: 60 } },
  { id: 't13', title: 'Animales de carga', text: 'Construí el Establo: más carga y alguien que conoce el camino.', goal: { type: 'build', id: 'establo', count: 1 }, reward: { coins: 300, xp: 60 } },
  { id: 't14', title: 'De Aldea a Caserío', text: 'Cumplí el expediente y subí la ciudad al rango Caserío.', goal: { type: 'castle', count: 2 }, reward: { gems: 8, xp: 80 } },
  { id: 't18', title: 'Tres estrellas', text: 'Hacé una salida con las 3 estrellas.', goal: { type: 'expedition', minStars: 3, count: 1 }, reward: { gems: 5, xp: 80, chest: 'plata' } },
  { id: 't19', title: 'Hacia las sierras', text: 'Explorá una zona de las Sierras Bajas.', goal: { type: 'zone', region: 'sierras', count: 1 }, reward: { gems: 8, xp: 100 } },
  { id: 't20', title: 'Época de Piedra', text: 'Subí la ciudad al rango Pueblo.', goal: { type: 'castle', count: 3 }, reward: { gems: 10, xp: 150, chest: 'plata' } },
  { id: 'm16', title: 'Ciudad feliz', text: 'Llegá a 40 de felicidad.', goal: { type: 'happy', count: 40 }, reward: { gems: 8, xp: 100 } },
  { id: 'm17', title: 'Gran ciudad', text: 'Llegá a 60 de población.', goal: { type: 'pop', count: 60 }, reward: { coins: 1000, xp: 120 } },
  { id: 'm18', title: 'Mejora todo', text: 'Mejorá 5 edificios.', goal: { type: 'upgrade', count: 5 }, reward: { gems: 10, xp: 150, chest: 'oro' } },
  { id: 'm19', title: 'Al cine', text: 'Construí el Cine.', goal: { type: 'build', id: 'cine', count: 1 }, reward: { gems: 10, xp: 200 } },
  { id: 'm20', title: 'Leyenda de Pixelia', text: 'Llegá al nivel 12.', goal: { type: 'level', count: 12 }, reward: { gems: 20, xp: 0, chest: 'oro' } },
  { id: 'm21', title: 'Una Villa hecha y derecha', text: 'Subí la ciudad al rango Villa.', goal: { type: 'castle', count: 4 }, reward: { gems: 25, xp: 300 } },
  { id: 'm22', title: 'Gran Metrópolis', text: 'Llegá a 150 de población.', goal: { type: 'pop', count: 150 }, reward: { gems: 30, xp: 400, chest: 'real' } },
  { id: 'm23', title: 'Un pueblo encantador', text: 'Llegá a 300 de Encanto (deco variada y edificios mejorados).', goal: { type: 'charm', count: 300 }, reward: { gems: 15, xp: 300 } },
  { id: 'm24', title: '¡Ya somos Ciudad!', text: 'Subí la Municipalidad al rango Ciudad.', goal: { type: 'castle', count: 5 }, reward: { gems: 30, xp: 500, chest: 'oro' } },
  { id: 'm25', title: 'Encanto puro', text: 'Llegá a 600 de Encanto.', goal: { type: 'charm', count: 600 }, reward: { gems: 20, xp: 600 } },
  { id: 'm26', title: 'Gran Ciudad', text: 'Subí la Municipalidad al rango Gran Ciudad.', goal: { type: 'castle', count: 6 }, reward: { gems: 40, xp: 800, chest: 'oro' } },
  { id: 'm27', title: 'Luces de Metrópolis', text: 'Subí la Municipalidad al rango Metrópolis.', goal: { type: 'castle', count: 7 }, reward: { gems: 50, xp: 1000, chest: 'real' } },
  { id: 'm28', title: 'Capital de Pixelia', text: 'Llevá tu ciudad al rango Capital.', goal: { type: 'castle', count: 8 }, reward: { gems: 80, xp: 1500, chest: 'real' } },
];

// Pool de misiones diarias (se eligen 3 por día con semilla de la fecha). needs: edificio que tiene que existir.
export const DAILY_POOL = [
  { id: 'd_collect', title: 'Recolectá monedas', goal: { type: 'collect', count: 300 }, reward: { coins: 150, xp: 20 }, scale: true },
  { id: 'd_earn', title: 'Ganá monedas', goal: { type: 'earn', count: 800 }, reward: { gems: 2, xp: 25 }, scale: true },
  { id: 'd_match3', title: 'Jugá Joyas Brillantes 2 veces', goal: { type: 'play', game: 'match3', count: 2 }, reward: { coins: 120, xp: 20, mats: { cristal: 3 } }, needs: 'joyeria' },
  { id: 'd_blocks', title: 'Jugá Bloques Pixel 2 veces', goal: { type: 'play', game: 'blocks', count: 2 }, reward: { coins: 120, xp: 20, mats: { ladrillo: 3 } }, minLevel: 2, needs: 'torre_bloques' },
  { id: 'd_parking', title: 'Estacioná 3 veces', goal: { type: 'play', game: 'parking', count: 3 }, reward: { gems: 2, xp: 25, mats: { tuerca: 4 } }, minLevel: 3, needs: 'garaje' },
  { id: 'd_driving', title: 'Salí a pasear 2 veces', goal: { type: 'play', game: 'driving', count: 2 }, reward: { gems: 2, xp: 25, mats: { mapa: 3 } }, minLevel: 5, needs: 'pista' },
  { id: 'd_build', title: 'Construí 3 cosas', goal: { type: 'build', count: 3 }, reward: { coins: 200, xp: 25 } },
  { id: 'd_upgrade', title: 'Mejorá un edificio', goal: { type: 'upgrade', count: 1 }, reward: { gems: 2, xp: 30 }, minLevel: 3 },
  { id: 'd_customize', title: 'Cambiá tu look', goal: { type: 'customize', count: 1 }, reward: { coins: 100, xp: 15 }, minLevel: 2 },
  // expedición (DESIGN-CORE.md §6.1)
  { id: 'd_exp2', title: 'Hacé 2 salidas', goal: { type: 'expedition', count: 2 }, reward: { coins: 150, xp: 25, prov: 6 }, needs: 'casa_exp' },
  { id: 'd_prov', title: 'Juntá 20 provisiones', goal: { type: 'prov', count: 20 }, reward: { gems: 2, xp: 20 }, needs: 'huerta' },
  { id: 'd_expstars', title: 'Conseguí 4 estrellas en expediciones', goal: { type: 'expStars', count: 4 }, reward: { gems: 3, xp: 30 }, needs: 'casa_exp' },
  { id: 'd_craft', title: 'Fabricá 2 cosas en el Taller', goal: { type: 'craft', count: 2 }, reward: { coins: 150, xp: 25, mats: { madera: 2 } }, needs: 'taller' },
  { id: 'd_far', title: 'Explorá una casilla lejana', goal: { type: 'expFar', count: 1 }, reward: { gems: 2, xp: 25 }, needs: 'casa_exp' },
];
export const DAILY_BONUS_ALL = { gems: 3, xp: 50, chest: 'plata' }; // por completar las 3 (el cofre trae 3 figuritas)

// Recompensa por login diario (racha de 7 días, después se repite). El día 7 trae Cofre de Plata.
// La racha perdona: 1 escudo por semana (season.streakWithShield) pausa la racha si faltás un día.
export const LOGIN_REWARDS = [
  { coins: 150 }, { coins: 250 }, { gems: 3 }, { coins: 400 }, { gems: 5 }, { coins: 700 }, { gems: 10, coins: 500, chest: 'plata' },
];

// Logros con niveles (tiers). stat: clave de state.stats
export const ACHIEVEMENTS = [
  { id: 'a_coins', name: 'Bolsillo Lleno', desc: 'Ganá {n} monedas en total', stat: 'coinsEarned', tiers: [1000, 10000, 50000, 200000, 1000000], reward: [3, 5, 10, 15, 25] },
  { id: 'a_build', name: 'Manos a la Obra', desc: 'Construí {n} cosas', stat: 'built', tiers: [5, 20, 50, 120, 250], reward: [3, 5, 8, 12, 20] },
  { id: 'a_upgrade', name: 'Siempre mejor', desc: 'Mejorá {n} veces', stat: 'upgrades', tiers: [3, 10, 25, 60, 120], reward: [3, 5, 8, 12, 20] },
  { id: 'a_match3', name: 'Ojo de Joya', desc: 'Pasá {n} niveles de Joyas', stat: 'match3Wins', tiers: [3, 10, 25, 50, 100], reward: [3, 5, 8, 12, 20] },
  { id: 'a_blocks', name: 'Rompebloques', desc: 'Limpiá {n} líneas en Bloques', stat: 'blocksLines', tiers: [20, 100, 400, 1000, 3000], reward: [3, 5, 8, 12, 20] },
  { id: 'a_parking', name: 'Estaciona perfecto', desc: 'Estacioná {n} veces', stat: 'parkingWins', tiers: [3, 10, 25, 50, 100], reward: [3, 5, 8, 12, 20] },
  { id: 'a_driving', name: 'Al Volante', desc: 'Manejá {n} metros en total', stat: 'drivingMeters', tiers: [2000, 10000, 40000, 100000, 300000], reward: [3, 5, 8, 12, 20] },
  { id: 'a_fashion', name: 'Ropero Lleno', desc: 'Comprá {n} prendas o partes', stat: 'bought', tiers: [2, 6, 12, 20, 30], reward: [3, 5, 8, 12, 20] },
  { id: 'a_streak', name: 'Fiel a Pixelia', desc: 'Entrá {n} días seguidos', stat: 'bestStreak', tiers: [2, 5, 7, 14, 30], reward: [3, 5, 8, 12, 25] },
  { id: 'a_chests', name: 'Cazatesoros', desc: 'Abrí {n} cofres', stat: 'chestsOpened', tiers: [3, 15, 40, 100, 250], reward: [3, 5, 8, 12, 20] },
  { id: 'a_stickers', name: 'Coleccionista', desc: 'Conseguí {n} figuritas distintas', stat: 'stickersNew', tiers: [10, 30, 60, 90, 108], reward: [3, 5, 10, 15, 30] },
  { id: 'a_rank', name: 'Intendencia', desc: 'Llevá tu ciudad al rango {n}', stat: 'rankBest', tiers: [2, 3, 5, 7, 8], reward: [3, 6, 10, 20, 30] },
  { id: 'a_charm', name: 'Ciudad Encantadora', desc: 'Llegá a {n} de Encanto', stat: 'charmBest', tiers: [100, 300, 600, 1000, 1500], reward: [3, 6, 10, 15, 25] },
  { id: 'a_season', name: 'Estrella de Temporada', desc: 'Llegá al nivel {n} del Pase', stat: 'seasonLevelBest', tiers: [5, 10, 20, 30], reward: [3, 6, 10, 20] },
];
