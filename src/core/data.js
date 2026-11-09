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
// max: cantidad máxima (undefined = ilimitado). game: escena que abre al tocarlo (hoy solo el Equipaje).
// rank: rango de ciudad mínimo para construirlo. charm: Encanto (si falta, sale de la categoría: ver economy.charmBase).
// eraArt: el modelo tiene arte propio por época (models.js no le agrega adornos ni recoloreo; DESIGN-CORE.md §4.4).
export const BUILDINGS = [
  // --- Especiales ---
  { id: 'castillo', name: 'Municipalidad', cat: 'especial', size: [4, 4], unlock: 1, cost: { coins: 0 }, time: 0, max: 1,
    happy: 10, charm: 20, xp: 0, prod: { coins: 10, cycle: 300, cap: 8 }, eraArt: true, desc: 'El corazón de la ciudad. Mejorala para dar bonus a toda la ciudad.' },
  // Mi Casa: aparece sola al llegar a nivel 2 (economy.ensureHome). Su nivel es el de la casa por dentro (home/furniture.js).
  { id: 'mi_casa', name: 'Mi Casa', cat: 'especial', size: [2, 2], unlock: 1, cost: { coins: 0 }, time: 0, max: 1, auto: true, eraArt: true,
    happy: 2, charm: 10, xp: 0, desc: 'Tu casa: entrá, decorala con muebles y ampliala.' },
  { id: 'boutique_real', name: 'Sastrería', cat: 'especial', size: [2, 2], unlock: 2, cost: { coins: 250 }, time: 15, max: 1,
    happy: 4, xp: 20, game: 'wardrobe', desc: 'Ropa, peinados y sombreros: acá se arma tu Equipaje.' },

  // --- Casas ---
  { id: 'casita', name: 'Casa', cat: 'casa', size: [2, 2], unlock: 1, cost: { coins: 100 }, time: 8,
    pop: 5, prod: { coins: 4, cycle: 270, cap: 6 }, xp: 10, eraArt: true, desc: 'Una casa sencilla para 5 habitantes.' },
  { id: 'cabana', name: 'Cabaña', cat: 'casa', size: [2, 2], unlock: 2, cost: { coins: 260 }, time: 15,
    pop: 8, prod: { coins: 5, cycle: 300, cap: 6 }, xp: 18, eraArt: true, desc: 'Madera, chimenea y un jardín que alguien riega.' },
  { id: 'chalet', name: 'Chalet', cat: 'casa', size: [2, 2], unlock: 4, cost: { coins: 600 }, time: 30,
    pop: 13, prod: { coins: 8, cycle: 300, cap: 6 }, xp: 30, eraArt: true, desc: 'Dos pisos y balcón con vista a la plaza.' },
  { id: 'torre_cristal', name: 'Torre de Cristal', rank: 2, cat: 'casa', size: [2, 2], unlock: 7, cost: { coins: 1500 }, time: 60,
    pop: 22, prod: { coins: 7, cycle: 270, cap: 6 }, xp: 55, eraArt: true, desc: 'Departamentos con vista para mucha gente.' },
  { id: 'mansion', name: 'Casona', rank: 3, cat: 'casa', size: [3, 3], unlock: 10, cost: { coins: 3500, gems: 5 }, time: 120,
    pop: 40, prod: { coins: 8, cycle: 240, cap: 6 }, xp: 100, eraArt: true, desc: 'Patio con fuente, galería y un portón que rechina.' },

  // --- Negocios ---
  { id: 'panaderia', name: 'Panadería', cat: 'negocio', size: [2, 2], unlock: 1, cost: { coins: 150 }, time: 10, popReq: 5,
    prod: { coins: 15, cycle: 300, cap: 6 }, xp: 15, eraArt: true, desc: 'Medialunas y pan del día. El de ayer, a mitad de precio.' },
  { id: 'heladeria', name: 'Heladería', cat: 'negocio', size: [2, 2], unlock: 2, cost: { coins: 350 }, time: 20, popReq: 12,
    prod: { coins: 16, cycle: 270, cap: 6 }, xp: 25, eraArt: true, desc: 'Dulce de leche, chocolate y algún sabor raro que nadie pide.' },
  { id: 'floreria', name: 'Florería', cat: 'negocio', size: [2, 2], unlock: 3, cost: { coins: 550 }, time: 30, popReq: 20,
    prod: { coins: 15, cycle: 240, cap: 6 }, happy: 2, xp: 35, eraArt: true, desc: 'Ramos para cada ocasión.' },
  { id: 'cafeteria', name: 'Café de la Esquina', cat: 'negocio', size: [2, 2], unlock: 4, cost: { coins: 800 }, time: 40, popReq: 30,
    prod: { coins: 20, cycle: 300, cap: 6 }, xp: 45, eraArt: true, desc: 'Café, tostados y un gato que se cree el dueño.' },
  { id: 'salon', name: 'Peluquería', cat: 'negocio', size: [2, 2], unlock: 5, cost: { coins: 1100 }, time: 60, popReq: 40,
    prod: { coins: 26, cycle: 360, cap: 6 }, xp: 55, eraArt: true, desc: 'Cortes, tinturas y las novedades del barrio.' },
  { id: 'pasteleria', name: 'Pastelería', cat: 'negocio', size: [2, 2], unlock: 6, cost: { coins: 1500 }, time: 75, popReq: 50,
    prod: { coins: 24, cycle: 300, cap: 6 }, xp: 65, eraArt: true, desc: 'Tortas por encargo, con una semana de anticipación.' },
  { id: 'boutique', name: 'Tienda de Ropa', cat: 'negocio', size: [2, 2], unlock: 7, cost: { coins: 2000 }, time: 90, popReq: 65,
    prod: { coins: 26, cycle: 300, cap: 6 }, xp: 80, eraArt: true, desc: 'Ropa, bolsos y zapatos. Probadores al fondo.' },
  { id: 'cine', name: 'Cine', rank: 3, cat: 'negocio', size: [3, 3], unlock: 9, cost: { coins: 3200 }, time: 120, popReq: 85,
    prod: { coins: 20, cycle: 300, cap: 6 }, happy: 4, xp: 110, eraArt: true, desc: 'Estrenos, clásicos y pochoclo.' },
  { id: 'spa', name: 'Baños Termales', rank: 4, cat: 'negocio', size: [3, 3], unlock: 11, cost: { coins: 5000, gems: 5 }, time: 180, popReq: 110,
    prod: { coins: 28, cycle: 360, cap: 6 }, happy: 5, xp: 150, eraArt: true, desc: 'Vapor, agua caliente y silencio.' },
  { id: 'rueda', name: 'Rueda de la Fortuna', rank: 5, cat: 'negocio', size: [3, 3], unlock: 13, cost: { coins: 8000, gems: 10 }, time: 240, popReq: 140, max: 1,
    prod: { gems: 1, cycle: 21600, cap: 1 }, happy: 8, xp: 220, eraArt: true, desc: 'Gira despacio y de vez en cuando deja una gema.' },
  { id: 'teatro', name: 'Teatro de la Ópera', rank: 5, cat: 'negocio', size: [3, 3], unlock: 15, cost: { coins: 12000, gems: 10 }, time: 300, popReq: 180,
    prod: { coins: 55, cycle: 600, cap: 6 }, happy: 6, xp: 300, eraArt: true, desc: 'Funciones de gala. Se ruega apagar el celular.' },

  // --- Ciclo de la expedición (DESIGN-CORE.md §5.2; qué da cada nivel en CYCLE, más abajo) ---
  // prod.prov: provisiones por tanda en el nivel 1 (CYCLE[id].prov da el valor por nivel); van al depósito al cobrar.
  { id: 'casa_exp', name: 'Casa de Expediciones', cat: 'ciclo', size: [3, 3], unlock: 1, rank: 1, cost: { coins: 200 }, time: 20, max: 1,
    happy: 2, xp: 30, panel: 'expedition', eraArt: true, desc: 'De acá sale el grupo. Cada nivel suma lugar, provisiones por salida y vista larga.' },
  { id: 'huerta', name: 'Huerta', cat: 'ciclo', size: [2, 2], unlock: 1, rank: 1, cost: { coins: 120 }, time: 10, max: 6,
    happy: 1, xp: 12, prod: { prov: 2, cycle: 2700, cap: 6 }, eraArt: true, desc: 'Verdura para la vianda. La mejor Huerta entrena Recolección.' },
  { id: 'taller', name: 'Taller', cat: 'ciclo', size: [2, 2], unlock: 1, rank: 1, cost: { coins: 300, mats: { madera: 3 } }, time: 25, max: 1,
    happy: 1, xp: 30, panel: 'workshop', eraArt: true, desc: 'Cuerdas, palas y faroles. Entrena Ingeniería.' },
  { id: 'establo', name: 'Establo', cat: 'ciclo', size: [3, 3], unlock: 2, rank: 1, cost: { coins: 600, mats: { madera: 4 } }, time: 40, max: 1,
    happy: 2, xp: 40, eraArt: true, desc: 'Mulas que cargan sin quejarse. Más carga y Guía.' },
  { id: 'dispensario', name: 'Dispensario', cat: 'ciclo', size: [2, 2], unlock: 3, rank: 2, cost: { coins: 900, mats: { hierbas: 3 } }, time: 45, max: 1,
    happy: 2, xp: 45, eraArt: true, desc: 'Vendas, té de hierbas y alguien que escucha. Entrena Sanidad.' },
  { id: 'tambo', name: 'Tambo', cat: 'ciclo', size: [3, 3], unlock: 3, rank: 2, cost: { coins: 900 }, time: 45, max: 3,
    happy: 1, xp: 40, prod: { prov: 5, cycle: 3600, cap: 4 }, eraArt: true, desc: 'Leche y queso para el camino. Las vacas no opinan.' },
  { id: 'molino', name: 'Molino', cat: 'ciclo', size: [2, 2], unlock: 5, rank: 3, cost: { coins: 2400, mats: { piedra: 4 } }, time: 90, max: 3,
    happy: 2, xp: 70, prod: { prov: 8, cycle: 5400, cap: 3 }, eraArt: true, desc: 'Harina para el pan de la vianda.' },
  { id: 'conservera', name: 'Conservera', cat: 'ciclo', size: [3, 3], unlock: 8, rank: 5, cost: { coins: 9000, mats: { mineral: 6 } }, time: 240, max: 2,
    happy: 1, xp: 150, prod: { prov: 15, cycle: 7200, cap: 2 }, eraArt: true, desc: 'Frascos y latas que aguantan cualquier viaje.' },

  // --- Defensas contra las amenazas (DESIGN-CORE.md §3.3, §5.2; radio y efecto por nivel en DEFENSES, más abajo) ---
  // Cubren los edificios con algún tile a distancia ≤ radio. firstPlanos: planos que pide solo la primera.
  { id: 'dique', name: 'Dique', cat: 'defensa', size: [3, 1], unlock: 1, rank: 2, cost: { coins: 700, mats: { madera: 6 } }, time: 30, max: 4,
    happy: 1, xp: 40, eraArt: true, desc: 'Estacas y tierra apisonada contra el arroyo. Cubre de la crecida lo que tiene cerca.' },
  { id: 'granero', name: 'Granero', cat: 'defensa', size: [2, 2], unlock: 1, rank: 2, cost: { coins: 800, mats: { madera: 3 } }, time: 40, max: 2,
    happy: 1, xp: 45, eraArt: true, desc: 'Agua y grano guardados para la sequía. Además agranda el depósito de provisiones.' },
  { id: 'bomberos', name: 'Cuartel de Bomberos', cat: 'defensa', size: [2, 2], unlock: 1, rank: 3, cost: { coins: 2500, mats: { madera: 4 }, planos: 1 }, time: 90, max: 2,
    happy: 2, xp: 80, eraArt: true, desc: 'Campana, bomba de mano y gente que no duerme. Cubre del incendio a su alrededor.' },
  { id: 'pararrayos', name: 'Pararrayos', cat: 'defensa', size: [1, 1], unlock: 1, rank: 3, cost: { coins: 600, mats: { mineral: 2 } }, firstPlanos: 1, time: 20, max: 6,
    happy: 0, xp: 25, eraArt: true, desc: 'Una punta de hierro bien alta. Los rayos de la tormenta van ahí y no al techo de al lado.' },
  { id: 'refugio', name: 'Refugio', cat: 'defensa', size: [2, 2], unlock: 1, rank: 4, cost: { coins: 3500, mats: { madera: 6 } }, time: 120, max: 2,
    happy: 2, xp: 100, eraArt: true, desc: 'Estufa encendida, mantas y leña seca. Cubre de la helada a su alrededor.' },
  { id: 'hospital', name: 'Hospital', cat: 'defensa', size: [3, 3], unlock: 1, rank: 5, cost: { coins: 12000, mats: { mineral: 6, hierbas: 4 }, planos: 1 }, time: 240, max: 1,
    happy: 4, xp: 200, eraArt: true, desc: 'Ayuda contra cualquier amenaza en su radio y suma una cuadrilla en la defensa.' },

  // --- Decoración ---
  { id: 'arbol', name: 'Árbol', cat: 'deco', size: [1, 1], unlock: 1, cost: { coins: 20 }, time: 0, happy: 1, xp: 2, eraArt: true, desc: 'Sombra y pájaros.' },
  { id: 'arbusto', name: 'Arbusto con Flores', cat: 'deco', size: [1, 1], unlock: 1, cost: { coins: 25 }, time: 0, happy: 1, xp: 2, eraArt: true, desc: 'Flores de estación.' },
  { id: 'farol', name: 'Farol', cat: 'deco', size: [1, 1], unlock: 2, cost: { coins: 40 }, time: 0, happy: 1, xp: 3, eraArt: true, desc: 'Ilumina las noches.' },
  { id: 'banco', name: 'Banco', cat: 'deco', size: [1, 1], unlock: 2, cost: { coins: 50 }, time: 0, happy: 2, xp: 3, eraArt: true, desc: 'Para sentarse a ver pasar a la gente.' },
  { id: 'cerezo', name: 'Cerezo', cat: 'deco', size: [1, 1], unlock: 3, cost: { coins: 90 }, time: 0, happy: 2, xp: 5, eraArt: true, desc: 'Flores de cerezo todo el año.' },
  { id: 'fuente', name: 'Fuente de la Plaza', cat: 'deco', size: [2, 2], unlock: 3, cost: { coins: 300 }, time: 10, happy: 6, xp: 15, eraArt: true, desc: 'Agua fresca en el medio de la plaza.' },
  { id: 'macetas', name: 'Macetas de Tulipanes', cat: 'deco', size: [1, 1], unlock: 4, cost: { coins: 70 }, time: 0, happy: 2, xp: 4, eraArt: true, desc: 'Tulipanes de colores.' },
  { id: 'estatua', name: 'Estatua del Fundador', cat: 'deco', size: [2, 2], unlock: 6, cost: { coins: 900 }, time: 20, happy: 10, xp: 30, eraArt: true, desc: 'Homenaje a quien fundó el pueblo. Sí, a vos.' },
  { id: 'glorieta', name: 'Glorieta', rank: 3, cat: 'deco', size: [2, 2], unlock: 8, cost: { coins: 1400 }, time: 30, happy: 12, xp: 40, eraArt: true, desc: 'Ideal para picnics.' },
  { id: 'arco_rosas', name: 'Arco de Rosas', cat: 'deco', size: [1, 1], unlock: 9, cost: { coins: 500 }, time: 0, happy: 5, xp: 12, eraArt: true, desc: 'Rosas trepadoras.' },
  { id: 'unicornio', name: 'Estatua del Unicornio', rank: 4, cat: 'deco', size: [2, 2], unlock: 12, cost: { gems: 15 }, time: 20, happy: 25, xp: 60, eraArt: true, desc: 'Nadie sabe quién la encargó.' },
  { id: 'lago', name: 'Laguna de los Patos', rank: 4, cat: 'deco', size: [3, 3], unlock: 14, cost: { coins: 4000 }, time: 60, happy: 22, xp: 80, eraArt: true, desc: 'Patos que nadan en círculos.' },

  // --- Caminos ---
  { id: 'camino', name: 'Camino de Piedra', cat: 'camino', size: [1, 1], unlock: 1, cost: { coins: 5 }, time: 0, xp: 0, eraArt: true, desc: 'Conectá tu ciudad.' },
  { id: 'camino_rosa', name: 'Camino de Ladrillo', cat: 'camino', size: [1, 1], unlock: 3, cost: { coins: 12 }, time: 0, happy: 0, xp: 0, eraArt: true, desc: 'Ladrillos rojizos, como los de antes.' },
  { id: 'camino_dorado', name: 'Camino Dorado', rank: 3, cat: 'camino', size: [1, 1], unlock: 8, cost: { coins: 30 }, time: 0, happy: 0, xp: 0, eraArt: true, desc: 'Adoquines dorados, para la avenida principal.' },
];

// ---------------- MATERIALES Y MONUMENTOS ----------------
// Los materiales de región los trae la expedición (DESIGN-CORE.md §5.1) y viven en state.materials con estos ids.
// Con ellos se construyen los monumentos, por etapas: el nivel del edificio es la etapa (1 = cimientos … N = terminado).
// cost.mats = { madera: n, ... } (store.canAfford/spend/grant los entienden igual que monedas y gemas).
export const REGION_MATERIALS = [
  { id: 'madera', name: 'Madera', one: 'madera', icon: '🪵', color: '#a8774a' },
  { id: 'piedra', name: 'Piedra', one: 'piedra', icon: '🪨', color: '#9b9286' },
  { id: 'mineral', name: 'Mineral', one: 'mineral', icon: '⛏️', color: '#7d8a99' },
  { id: 'hierbas', name: 'Hierbas', one: 'hierbas', icon: '🌿', color: '#6f8a4f' },
];
export const REGION_MAT_IDS = REGION_MATERIALS.map(m => m.id);
export const MATERIAL_BY_ID = Object.fromEntries(REGION_MATERIALS.map(m => [m.id, m]));

// ---------------- MIGRACIÓN v3 (DESIGN-CORE.md §7.2; la usa state.js) ----------------
// Materiales de los minijuegos retirados → materiales de región (1:1, se suman).
export const LEGACY_MATS = { cristal: 'mineral', ladrillo: 'piedra', tuerca: 'madera', mapa: 'hierbas' };
// Edificios de minijuego → edificios del ciclo (mismo tamaño: mismo uid, lugar, rotación y nivel; §5.3).
export const LEGACY_BUILDINGS = { joyeria: 'taller', torre_bloques: 'dispensario', garaje: 'establo', pista: 'casa_exp' };
// Potenciadores de minijuego (mochila de cofres) → equipo de expedición (1:1).
export const LEGACY_BOOSTERS = { m3_moves: 'cuerda', m3_bomb: 'pala', blk_bomb: 'pala', park_time: 'farol', drv_shield: 'lona' };

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
//  up: costo extra de la mejora a ese nivel (materiales desde el nivel 3; la Casa pide planos en el 4 y el 5;
//      era: época mínima de la ciudad para esa mejora, DESIGN-CORE.md §4.1)
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
  molino: { prov: [8, 11, 14, 17, 20], up: { 3: { mats: { piedra: 4 } }, 4: { mats: { piedra: 6, madera: 3 }, era: 3 }, 5: { mats: { piedra: 8, mineral: 3 }, era: 3 } } },
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
  // carreta: +4 de carga; desde la época Hierro (bigEra) la Carreta grande da +6 (bigCargo)
  carreta: { cost: { coins: 250, mats: { madera: 6, mineral: 2 } }, establo: 2, cargo: 4, bigEra: 4, bigCargo: 6 },
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
// Defensas (DESIGN-CORE.md §3.3, §5.2): contra qué amenaza (hospital: todas), radio por nivel y costo extra de la mejora
// (materiales desde el nivel 3). La eficacia por nivel (0,6 + 0,08 × nivel) y el resto de los números están en
// src/threats/threat-data.js.
export const DEFENSES = {
  dique: { threat: 'crecida', radius: [4, 4, 5, 5, 6], up: { 3: { mats: { madera: 4, piedra: 2 } }, 4: { mats: { piedra: 5, madera: 3 } }, 5: { mats: { piedra: 7, mineral: 2 } } } },
  granero: { threat: 'sequia', radius: [4, 4, 5, 5, 6], up: { 3: { mats: { madera: 4 } }, 4: { mats: { madera: 4, hierbas: 3 } }, 5: { mats: { madera: 5, piedra: 4 } } } },
  bomberos: { threat: 'incendio', radius: [5, 5, 6, 6, 7], up: { 3: { mats: { madera: 4, mineral: 1 } }, 4: { mats: { mineral: 4, madera: 3 } }, 5: { mats: { mineral: 6, piedra: 3 } } } },
  pararrayos: { threat: 'tormenta', radius: [3, 3, 4, 4, 5], up: { 3: { mats: { mineral: 2 } }, 4: { mats: { mineral: 3 } }, 5: { mats: { mineral: 4, piedra: 1 } } } },
  refugio: { threat: 'helada', radius: [4, 4, 5, 5, 6], up: { 3: { mats: { madera: 5 } }, 4: { mats: { madera: 6, hierbas: 2 } }, 5: { mats: { madera: 8, piedra: 3 } } } },
  hospital: { threat: '*', radius: [5, 5, 6, 6, 7], up: { 3: { mats: { hierbas: 4, mineral: 2 } }, 4: { mats: { hierbas: 6, mineral: 3 } }, 5: { mats: { hierbas: 8, mineral: 5 } } } },
};
export const DEFENSE_IDS = Object.keys(DEFENSES);

const ST4 = ['Cimientos', 'Paredes', 'Detalles', '¡Inauguración!'];
const ST5 = ['Cimientos', 'Estructura', 'Paredes', 'Detalles', '¡Inauguración!'];
const stg = (coins, mats, time, gems = 0) => ({ cost: gems ? { coins, gems, mats } : { coins, mats }, time });
// art: artículo del nombre ('el Faro', 'la Torre del Reloj') para armar frases.
// bonus.type (DESIGN-CORE.md §5.4, atados al ciclo): vision (casillas de visión en la expedición) · happy (puntos de felicidad)
//             threatWarn (días de aviso extra de las amenazas) · pass (chispas del Pase por expedición)
//             stickers (chance de un hallazgo más al volver) · time (obras más rápidas)
export const MONUMENTS = {
  faro: {
    name: 'Faro', art: 'el', size: [3, 3], rank: 3, charm: 120, happy: 8, bonus: { type: 'vision', value: 1 }, bonusIcon: '🧭',
    bonusText: '+1 de visión en todas las expediciones', desc: 'Ilumina el pueblo de noche y guía a quien sale. Terminado: se ve una casilla más lejos en cada expedición.',
    stageNames: ST4, stages: [
      stg(3000, { piedra: 14, mineral: 9 }, 120), stg(5000, { piedra: 23, mineral: 14 }, 300),
      stg(8000, { piedra: 28, mineral: 23 }, 600), stg(12000, { piedra: 37, mineral: 28 }, 1200),
    ] },
  jardin: {
    name: 'Jardín Botánico', art: 'el', size: [4, 4], rank: 4, charm: 150, happy: 15, bonus: { type: 'happy', value: 0.25 }, bonusIcon: 'smile',
    bonusText: '+25% de felicidad en toda la ciudad', desc: 'Un invernadero gigante lleno de plantas. Terminado: +25% de felicidad.',
    stageNames: ST4, stages: [
      stg(12000, { mineral: 22, madera: 14 }, 300), stg(20000, { mineral: 32, madera: 22 }, 600),
      stg(32000, { mineral: 43, madera: 32 }, 1200), stg(48000, { mineral: 54, madera: 43 }, 1800, 5),
    ] },
  observatorio: {
    name: 'Observatorio', art: 'el', size: [3, 3], rank: 5, charm: 170, happy: 10, bonus: { type: 'threatWarn', value: 2 }, bonusIcon: 'calendar',
    bonusText: 'Las amenazas se anuncian 2 días antes', desc: 'Para mirar las estrellas y el cielo que se viene. Terminado: cada amenaza se anuncia 2 días antes.',
    stageNames: ST5, stages: [
      stg(21000, { mineral: 25, hierbas: 15 }, 600), stg(31500, { mineral: 35, hierbas: 25 }, 900), stg(45500, { mineral: 45, hierbas: 35 }, 1500),
      stg(63000, { mineral: 55, hierbas: 45 }, 2400), stg(84000, { mineral: 65, hierbas: 55 }, 3600, 10),
    ] },
  estadio: {
    name: 'Estadio', art: 'el', size: [4, 4], rank: 5, charm: 190, happy: 14, bonus: { type: 'pass', value: 0.25 }, bonusIcon: 'sparkle',
    bonusText: '+25% de chispas del Pase en las expediciones', desc: '¡Que empiece el partido! Terminado: +25% de chispas del Pase en cada expedición.',
    stageNames: ST5, stages: [
      stg(21000, { piedra: 30, madera: 20 }, 600), stg(30000, { piedra: 40, madera: 30 }, 900), stg(42000, { piedra: 50, madera: 40 }, 1500),
      stg(57000, { piedra: 60, madera: 50 }, 2400), stg(78000, { piedra: 70, madera: 60 }, 3600, 10),
    ] },
  museo: {
    name: 'Museo', art: 'el', size: [4, 4], rank: 6, charm: 220, happy: 12, bonus: { type: 'stickers', value: 0.5 }, bonusIcon: '🃏',
    bonusText: '+50% de chance de un hallazgo más al volver', desc: 'Historia, arte ¡y un dinosaurio! Terminado: más hallazgos al volver de expedición.',
    stageNames: ST5, stages: [
      stg(45000, { hierbas: 42, piedra: 35, mineral: 28 }, 1200), stg(66000, { hierbas: 56, piedra: 49, mineral: 42 }, 1800),
      stg(90000, { hierbas: 70, piedra: 63, mineral: 56 }, 2700), stg(120000, { hierbas: 91, piedra: 77, mineral: 70 }, 3600),
      stg(156000, { hierbas: 105, piedra: 98, mineral: 84 }, 5400, 15),
    ] },
  torre_reloj: {
    name: 'Torre del Reloj', art: 'la', size: [3, 3], rank: 7, charm: 260, happy: 12, bonus: { type: 'time', value: 0.10 }, bonusIcon: 'clock',
    bonusText: 'Obras y mejoras 10% más rápidas', desc: 'La más alta del pueblo, con campana. Terminada: todas las obras tardan 10% menos.',
    stageNames: ST5, stages: [
      stg(90000, { madera: 63, hierbas: 54, piedra: 45, mineral: 45 }, 1800), stg(126000, { madera: 81, hierbas: 72, piedra: 63, mineral: 63 }, 2700),
      stg(168000, { madera: 108, hierbas: 90, piedra: 81, mineral: 81 }, 3600), stg(225000, { madera: 135, hierbas: 117, piedra: 108, mineral: 108 }, 5400),
      stg(300000, { madera: 162, hierbas: 144, piedra: 135, mineral: 135 }, 7200, 20),
    ] },
};
export const MONUMENT_IDS = Object.keys(MONUMENTS);
// los monumentos también son edificios (cat 'monumento', uno de cada uno); construirlos = pagar la etapa 1
for (const [id, mo] of Object.entries(MONUMENTS)) {
  BUILDINGS.push({ id, name: mo.name, cat: 'monumento', size: mo.size, unlock: 1, rank: mo.rank, cost: mo.stages[0].cost, time: mo.stages[0].time,
    max: 1, happy: mo.happy, charm: mo.charm, xp: 60, eraArt: true, desc: mo.desc });
}

export const BUILDING_BY_ID = Object.fromEntries(BUILDINGS.map(b => [b.id, b]));
export const CATEGORIES = [
  { id: 'casa', name: 'Casas' },
  { id: 'ciclo', name: 'Expedición' },
  { id: 'defensa', name: 'Defensas' },
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
// req: pop (población), happy (% de felicidad), charm (Encanto), shops (tipos de negocio distintos), monuments (terminados),
// planos (se gastan al empezar la obra; solo cuentan si la partida ya tiene state.planos: ver economy.rankStatus).
export const TOWN_RANKS = [
  { rank: 1, name: 'Aldea', emoji: '🏕️', land: 1 },
  { rank: 2, name: 'Caserío', emoji: '🏡', look: 'galería de troncos y campanario', land: 2, cost: { coins: 800, gems: 2 }, time: 60, reqLevel: 3,
    req: { pop: 12, happy: 30, charm: 40, shops: 1 }, reward: { gems: 3, chest: 'madera' } },
  { rank: 3, name: 'Pueblo', emoji: '🏘️', look: 'muros de piedra y torre del reloj', land: 3, builders: 1, cost: { coins: 2500, gems: 5 }, time: 180, reqLevel: 7,
    req: { pop: 120, happy: 40, charm: 650, shops: 4, planos: 3 }, reward: { gems: 5, chest: 'plata' } },
  { rank: 4, name: 'Villa', emoji: '⛲', look: 'soportales y fuentes en la plaza', land: 4, cost: { coins: 6000, gems: 10 }, time: 420, reqLevel: 12,
    req: { pop: 200, happy: 45, charm: 900, shops: 6, monuments: 1 }, reward: { gems: 8, chest: 'oro' } },
  { rank: 5, name: 'Ciudad', emoji: '🏙️', look: 'ladrillo, balcones y cúpula de tejas', land: 5, cost: { coins: 14000, gems: 20 }, time: 900, reqLevel: 18,
    req: { pop: 340, happy: 50, charm: 1350, shops: 8, monuments: 2, planos: 6 }, reward: { gems: 12, chest: 'oro' } },
  { rank: 6, name: 'Gran Ciudad', emoji: '🌆', look: 'cúpula de hierro y faroles a gas', land: 7, builders: 1, cost: { coins: 30000, gems: 30 }, time: 1800, reqLevel: 23,
    req: { pop: 460, happy: 52, charm: 1750, shops: 9, monuments: 3, planos: 10 }, reward: { gems: 18, chest: 'oro' } },
  { rank: 7, name: 'Metrópolis', emoji: '🌃', look: 'torre de hierro y banderas', land: 7, cost: { coins: 60000, gems: 45 }, time: 3600, reqLevel: 28,
    req: { pop: 580, happy: 60, charm: 2400, shops: 10, monuments: 5 }, reward: { gems: 25, chest: 'real' } },
  { rank: 8, name: 'Capital', emoji: '🏛️', look: 'torre de vidrio con terrazas verdes', land: 7, cost: { coins: 120000, gems: 60 }, time: 7200, reqLevel: 33,
    req: { pop: 700, happy: 65, charm: 2800, shops: 11, monuments: 6, planos: 15 }, reward: { gems: 40, chest: 'real' } },
];
export const RANK_REQ_LABELS = {
  pop: ['Población', 'people'], happy: ['Felicidad', 'smile'], charm: ['Encanto', 'sparkle'],
  shops: ['Tipos de negocio', 'shop'], monuments: ['Monumentos terminados', 'monument'], planos: ['Planos', '📜'],
};

// ---------------- ÉPOCAS (DESIGN-CORE.md §4) ----------------
// La ciudad cambia de época con el rango; cada edificio guarda la suya (b.era, 1 si falta) y se renueva a la actual.
// mats: material de región por tile del lote para renovar (economy.renovateInfo).
export const ERAS = [
  { era: 1, id: 'madera', name: 'Madera', ranks: [1, 2], planos: 0, mats: {} },
  { era: 2, id: 'piedra', name: 'Piedra', ranks: [3, 4], planos: 3, mats: { piedra: 1 } },
  { era: 3, id: 'ladrillo', name: 'Ladrillo', ranks: [5], planos: 6, mats: { piedra: 1, madera: 1 } },
  { era: 4, id: 'hierro', name: 'Hierro', ranks: [6, 7], planos: 10, mats: { mineral: 1, madera: 1 } },
  { era: 5, id: 'vidrio', name: 'Vidrio y acero', ranks: [8], planos: 15, mats: { mineral: 2 } },
];
export const ERA_BY_ID = Object.fromEntries(ERAS.map(e => [e.id, e]));
/** Época (1..5) de un rango de ciudad. */
export function eraOfRank(rank) {
  const r = Math.max(1, Math.min(TOWN_RANKS.length, Math.round(rank) || 1));
  return (ERAS.find(e => e.ranks.includes(r)) || ERAS[0]).era;
}
export const eraDef = (era) => ERAS[Math.max(1, Math.min(ERAS.length, Math.round(era) || 1)) - 1];
// Compatibilidad: mejoras de la Municipalidad en el formato viejo (level = rango)
export const CASTLE_LEVELS = TOWN_RANKS.slice(1).map(r => ({ level: r.rank, cost: r.cost, time: r.time, reqLevel: r.reqLevel }));
export const CASTLE_BONUS_PER_LEVEL = 0.08; // +8% producción global por nivel extra de castillo

// Escala de premios según nivel del jugador (para que sigan valiendo la pena)
export function rewardScale(playerLevel) { return 1 + (playerLevel - 1) * 0.15; }

// ---------------- NIVELES ----------------
export const MAX_LEVEL = 40;
export function xpForLevel(level) { // xp necesaria para pasar de `level` a `level+1`
  return Math.round(40 * Math.pow(level, 1.55) + 20);
}
export function levelUpReward(newLevel) {
  return { coins: 100 * newLevel, gems: 1 + Math.floor(newLevel / 8) };   // Fase 5b: eran 3 + nivel/3 (§8: 15–25 gemas por día)
}

// ---------------- PERSONALIZACIÓN DEL PERSONAJE ----------------
// El tipo de personaje es el pueblo (El Quiebre, plan §M2): humanos, enanos de la Veta, anuros del Bañado, gente-zorro
// del Céfiro y orcos de la Brasa. Gratis y cambiable en el Equipaje. Cada pieza dice para qué pueblos sirve (types).
// price: {coins|gems}, unlock: nivel. Los free:true se tienen desde el inicio. Estilo serio y terroso (plan §M1):
// los modelos están en src/avatar/ (figure-*.js). Las piezas de antes del guardado v5 se traducen con V5_ITEMS.
export const AVATAR_FAMILIES = [
  { id: 'pueblos', name: 'Pueblos', emoji: '🧭' },
];
// look: look inicial al elegir el pueblo (todo gratis). skins: tonos de piel (o pelaje) propios del pueblo.
export const AVATAR_TYPES = [
  { id: 'humano', name: 'Humano', family: 'pueblos', emoji: '🧭', element: null,
    desc: 'De las islas y los reinos. Hay de todo: soldados, cartógrafos, desertores.',
    skins: ['#e6c4a8', '#d9ac8a', '#c6936e', '#a87652', '#8a5c3e', '#5e3e2a'],
    look: { skin: 2, build: 'recio', hair: 'despeinado', hairColor: 'castano', face: 'barba_corta', dress: 'viajero', dressColor: 'verde', crown: 'ninguna', acc: 'mochila' } },
  { id: 'enano', name: 'Enano de la Veta', family: 'pueblos', emoji: '⛏️', element: 'raiz',
    desc: 'Mineros del Cerro. Las Casas los hicieron cavar: no se olvidan.',
    skins: ['#e2b89a', '#d29e7c', '#bb8462', '#9c6a4a', '#7e5238', '#5a3a28'],
    look: { skin: 1, build: 'recio', hair: 'cortito', hairColor: 'pelirrojo', face: 'barba_larga', dress: 'minero', dressColor: 'durazno', crown: 'ninguna', acc: 'ninguno' } },
  { id: 'anuro', name: 'Anuro del Bañado', family: 'pueblos', emoji: '🐸', element: 'marea',
    desc: 'Guardianes del agua. Hablan poco y no se apuran.',
    skins: ['#6f8450', '#5a7044', '#848650', '#4e6656', '#76684a', '#3e5446'],
    look: { skin: 0, build: 'recio', hair: 'lomo', hairColor: 'negro', face: 'ninguna', dress: 'pieles', dressColor: 'verde', crown: 'ninguna', acc: 'ninguno' } },
  { id: 'zorro', name: 'Gente-zorro del Céfiro', family: 'pueblos', emoji: '🦊', element: 'cefiro',
    desc: 'Viven entre dirigibles y riscos. Muchos piratas, algunos mensajeros.',
    skins: ['#a8643a', '#8e4e2c', '#857a6c', '#6a5e54', '#b89a74', '#3c3430'],
    look: { skin: 0, build: 'esbelto', hair: 'coleta', hairColor: 'blanco', face: 'ninguna', dress: 'abrigo', dressColor: 'azul', crown: 'ninguna', acc: 'ninguno' } },
  { id: 'orco', name: 'Orco de la Brasa', family: 'pueblos', emoji: '🔥', element: 'brasa',
    desc: 'De los volcanes del Bajo Mundo. Los que más perdieron con el Quiebre.',
    skins: ['#7a8658', '#68744c', '#86845e', '#5c6852', '#776a54', '#4c5642'],
    look: { skin: 0, build: 'recio', hair: 'jopo', hairColor: 'negro', face: 'cicatriz', dress: 'cuero', dressColor: 'rojo', crown: 'ninguna', acc: 'hacha' } },
];
export const AVATAR_TYPE_BY_ID = Object.fromEntries(AVATAR_TYPES.map(t => [t.id, t]));
// pueblos que no son jugables (enemigos y gente rara de ver): solo los usan los modelos (src/avatar/figure-*.js)
export const NPC_PEOPLES = ['vaciado'];
const ALL = ['humano', 'enano', 'anuro', 'zorro', 'orco'];
const HAIRY = ['humano', 'enano', 'zorro', 'orco'];
const BEARDED = ['humano', 'enano', 'orco'];

// Tonos de piel de antes (humanos): se mantienen como referencia de saves y perfiles viejos.
export const SKIN_TONES = AVATAR_TYPES[0].skins;
// Colores de pelo (en la gente-zorro, del pelo de la cabeza; en los anuros, de las marcas). Terrosos y apagados.
export const HAIR_COLORS = [
  { id: 'castano', hex: '#6a4430' }, { id: 'negro', hex: '#261c1a' }, { id: 'rubio', hex: '#b39a62' },
  { id: 'pelirrojo', hex: '#9a4e30' }, { id: 'rosa', hex: '#7a3e3a' }, { id: 'lila', hex: '#6a6670' },
  { id: 'celeste', hex: '#8a949a' }, { id: 'menta', hex: '#5c6a5a' }, { id: 'blanco', hex: '#d6d0c4' }, { id: 'chocolate', hex: '#3e2a20' },
  { id: 'gris', hex: '#8f8a86' },
];
// Colores de ropa: los ids son los de siempre (también los usan el auto y la bandera); la ropa los apaga (figure-kit.js).
export const OUTFIT_COLORS = [
  { id: 'rosa', hex: '#e392b0' }, { id: 'fucsia', hex: '#c4678e' }, { id: 'lila', hex: '#a993d6' }, { id: 'violeta', hex: '#7562b6' },
  { id: 'celeste', hex: '#9ccbe6' }, { id: 'azul', hex: '#5a7cc2' }, { id: 'menta', hex: '#80cbb0' }, { id: 'verde', hex: '#5fa86e' },
  { id: 'dorado', hex: '#f0c96e' }, { id: 'durazno', hex: '#efb592' }, { id: 'rojo', hex: '#cf5f5f' }, { id: 'blanco', hex: '#fbf6f1' }, { id: 'negro', hex: '#3b2f3a' },
];
// Complexión (no se compra: las dos son de todos)
export const BUILDS = [
  { id: 'recio', name: 'Recio', free: true, types: ALL },
  { id: 'esbelto', name: 'Esbelto', free: true, types: ALL },
];
export const HAIR_STYLES = [
  { id: 'rapado', name: 'Rapado', free: true, types: ALL },
  { id: 'cortito', name: 'Corto', free: true, types: HAIRY },
  { id: 'despeinado', name: 'Revuelto', free: true, types: HAIRY },
  { id: 'coleta', name: 'Cola atada', free: true, types: HAIRY },
  { id: 'largo', name: 'Largo suelto', free: true, types: HAIRY },
  { id: 'lomo', name: 'Lomo manchado', free: true, types: ['anuro'] },
  { id: 'cresta_piel', name: 'Cresta de piel', free: true, types: ['anuro'] },
  { id: 'corto', name: 'Melena corta', price: { coins: 200 }, unlock: 1, types: HAIRY },
  { id: 'flequillo', name: 'Flequillo de costado', price: { coins: 250 }, unlock: 1, types: ['humano', 'zorro'] },
  { id: 'rodete', name: 'Rodete', price: { coins: 350 }, unlock: 2, types: HAIRY },
  { id: 'jopo', name: 'Cresta', price: { coins: 450 }, unlock: 2, types: HAIRY },
  { id: 'trenzas', name: 'Dos trenzas', price: { coins: 500 }, unlock: 3, types: HAIRY },
  { id: 'rizos', name: 'Rulos', price: { coins: 800 }, unlock: 5, types: ['humano', 'enano'] },
  { id: 'colitas', name: 'Dos colas bajas', price: { coins: 1200 }, unlock: 7, types: ['humano', 'enano', 'zorro'] },
  { id: 'ondas', name: 'Ondas largas', price: { gems: 15 }, unlock: 9, types: ['humano', 'zorro'] },
];
// Cara: barbas, cicatrices y marcas (plan §M1: caras serias)
export const FACES = [
  { id: 'ninguna', name: 'Nada', free: true, types: ALL },
  { id: 'barba_corta', name: 'Barba corta', free: true, types: BEARDED },
  { id: 'barba_larga', name: 'Barba larga', free: true, types: BEARDED },
  { id: 'bigote', name: 'Bigote', free: true, types: BEARDED },
  { id: 'cicatriz', name: 'Cicatriz en la mejilla', free: true, types: ALL },
  { id: 'cicatriz_ojo', name: 'Ojo cruzado', price: { coins: 300 }, unlock: 1, types: ALL },
  { id: 'barba_trenzada', name: 'Barba trenzada', price: { coins: 400 }, unlock: 2, types: BEARDED },
  { id: 'pintura', name: 'Pintura de guerra', price: { coins: 500 }, unlock: 3, types: ALL },
  { id: 'parche', name: 'Parche', price: { coins: 600 }, unlock: 4, types: ALL },
];
export const DRESS_STYLES = [
  { id: 'viajero', name: 'Ropa de viajero', free: true, types: ALL },
  { id: 'jubon', name: 'Jubón y calzas', free: true, types: ALL },
  { id: 'vestido', name: 'Vestido de lana', free: true, types: ALL },
  { id: 'minero', name: 'Ropa de mina', free: true, types: ALL },
  { id: 'tunica', name: 'Túnica de mago', free: true, types: ALL },
  { id: 'habito', name: 'Hábito de monje', free: true, types: ALL },
  { id: 'delantal', name: 'Delantal de forja', price: { coins: 400 }, unlock: 1, types: ALL },
  { id: 'cuero', name: 'Coraza de cuero', price: { coins: 600 }, unlock: 2, types: ALL },
  { id: 'vestido_noble', name: 'Vestido de casa noble', price: { coins: 600 }, unlock: 2, types: ALL },
  { id: 'tabardo', name: 'Tabardo de guardia', price: { coins: 650 }, unlock: 3, types: ALL },
  { id: 'capa_viaje', name: 'Capa de viaje', price: { coins: 700 }, unlock: 3, types: ALL },
  { id: 'pieles', name: 'Pieles del norte', price: { coins: 800 }, unlock: 4, types: ALL },
  { id: 'abrigo', name: 'Abrigo de cielo', price: { coins: 900 }, unlock: 5, types: ALL },
  { id: 'cota', name: 'Cota de malla', price: { coins: 1000 }, unlock: 5, types: ALL },
  { id: 'placas', name: 'Armadura de placas', price: { gems: 25 }, unlock: 8, types: ALL },
  { id: 'archimago', name: 'Manto de archimago', price: { gems: 25 }, unlock: 9, types: ALL },
];
// "Cabeza": capuchas, gorros, sombreros y cascos (el id de la categoría sigue siendo crown por compatibilidad)
export const CROWNS = [
  { id: 'ninguna', name: 'Nada', free: true, types: ALL },
  { id: 'capucha', name: 'Capucha', free: true, types: ALL },
  { id: 'gorro', name: 'Gorro de lana', free: true, types: ALL },
  { id: 'vincha', name: 'Vincha de cuero', free: true, types: ALL },
  { id: 'gorra', name: 'Boina', free: true, types: ALL },
  { id: 'sombrero_mago', name: 'Sombrero de mago', free: true, types: ALL },
  { id: 'bandana', name: 'Pañuelo de cielo', price: { coins: 300 }, unlock: 1, types: ALL },
  { id: 'piluso', name: 'Sombrero de paja', price: { coins: 400 }, unlock: 3, types: ALL },
  { id: 'casco', name: 'Casco de hierro', price: { coins: 600 }, unlock: 3, types: ALL },
  { id: 'galera', name: 'Sombrero de ala ancha', price: { coins: 700 }, unlock: 5, types: ALL },
  { id: 'yelmo', name: 'Yelmo con cuernos', price: { gems: 15 }, unlock: 8, types: ALL },
];
export const ACCESSORIES = [
  { id: 'ninguno', name: 'Nada', free: true, types: ALL },
  { id: 'mochila', name: 'Mochila de viaje', free: true, types: ALL },
  { id: 'espada', name: 'Espada corta', free: true, types: ALL },
  { id: 'escudo', name: 'Escudo redondo', free: true, types: ALL },
  { id: 'baston', name: 'Bastón', free: true, types: ALL },
  { id: 'libro', name: 'Libro gastado', free: true, types: ALL },
  { id: 'collar', name: 'Amuleto de veta', free: true, types: ALL },
  { id: 'bolso', name: 'Bolso cruzado', price: { coins: 450 }, unlock: 2, types: ALL },
  { id: 'farolito', name: 'Farol', price: { coins: 500 }, unlock: 3, types: ALL },
  { id: 'hacha', name: 'Hacha', price: { coins: 600 }, unlock: 3, types: ALL },
  { id: 'orbe', name: 'Piedra de veta', price: { coins: 600 }, unlock: 3, types: ALL },
  { id: 'catalejo', name: 'Catalejo', price: { coins: 600 }, unlock: 4, types: ALL },
  { id: 'martillo', name: 'Martillo de forja', price: { coins: 700 }, unlock: 4, types: ALL },
  { id: 'lanza', name: 'Lanza', price: { coins: 800 }, unlock: 5, types: ALL },
  { id: 'arco', name: 'Arco', price: { coins: 800 }, unlock: 5, types: ALL },
  { id: 'buho', name: 'Cuervo mensajero', price: { gems: 20 }, unlock: 6, types: ALL },
];
/** Tipo de personaje (o el primero si el id no existe). */
export function avatarType(id) { return AVATAR_TYPE_BY_ID[id] || AVATAR_TYPES[0]; }
/** ¿La pieza sirve para ese pueblo? (las piezas sin types sirven para todos) */
export function fitsType(item, type) { return !!item && (item.types ? item.types.includes(type) : ALL.includes(type)); }

// Tipos y piezas que ya no existen: saves viejos y perfiles de amistades se traducen así (primero LEGACY_*, después V5_*).
export const LEGACY_TYPES = { princesa: 'chica', principe: 'chico', hada: 'chica', mago: 'chico', gatito: 'chica', conejito: 'chica', zorrito: 'chico', osito: 'chico' };
export const LEGACY_ITEMS = {
  crown: { tiara: 'vincha', corona: 'galera', estrella: 'auris', corona_p: 'gorra', corona_rey: 'galera', corona_cristal: 'sombrero_estrellas' },
  acc: { varita: 'globo', cetro: 'patineta', varita_flor: 'ramo' },
  topper: { corona: 'corazon' },
};
// v4 → v5 (plan §M, personajes serios): chica y chico pasan a ser humanos (esbelto y recio).
export const V5_TYPES = { chica: { type: 'humano', build: 'esbelto' }, chico: { type: 'humano', build: 'recio' } };
// Cada pieza vieja pasa a su equivalente: [id nuevo, lo que costaba]. migrateV5 (state.js) te da la nueva y, si ya la
// tenías o es gratis, te devuelve lo que pagaste por la vieja. Las que no figuran siguen con el mismo id.
export const V5_ITEMS = {
  hair: { barba: ['cortito', { coins: 600 }] },
  dress: {
    clasico: ['vestido'], corto: ['jubon'], gala: ['vestido_noble', { coins: 600 }], overol: ['delantal', { coins: 400 }],
    sirena: ['vestido_noble', { coins: 1000 }], deportivo: ['cuero', { coins: 700 }], capa: ['capa_viaje', { gems: 20 }],
    estrellas: ['archimago', { gems: 30 }], chaqueta: ['jubon'], capa_real: ['capa_viaje'], gala_p: ['tabardo', { coins: 600 }],
    caballero: ['cota', { coins: 1000 }], estrellas_p: ['placas', { gems: 30 }], buzo: ['viajero'], remera: ['viajero'],
    pollera: ['vestido', { coins: 300 }], camisa: ['jubon', { coins: 450 }], campera: ['cuero', { coins: 650 }],
    futbol: ['pieles', { coins: 800 }], petalos: ['vestido'], hojas: ['viajero'], mariposa: ['abrigo', { coins: 900 }],
    aprendiz: ['habito'], tunica_capa: ['capa_viaje', { coins: 700 }], lunar: ['tunica', { coins: 1000 }],
    archimago: ['archimago', { gems: 25 }],
  },
  crown: {
    flores: ['vincha', { coins: 400 }], 'moño': ['vincha', { coins: 300 }], laurel: ['vincha'], diadema: ['vincha'],
    auris: ['gorro', { coins: 500 }], sombrero_luna: ['sombrero_mago', { coins: 700 }], sombrero_estrellas: ['yelmo', { gems: 15 }],
    casco: ['casco', { coins: 600 }], piluso: ['piluso', { coins: 400 }], galera: ['galera', { coins: 700 }],
  },
  acc: {
    ramo: ['ninguno'], pelota: ['ninguno'], anteojos: ['catalejo', { coins: 600 }], alas: ['lanza', { gems: 20 }],
    gatito: ['buho', { gems: 25 }], globo: ['farolito', { coins: 350 }], patineta: ['hacha', { coins: 700 }],
    alas_mariposa: ['arco', { coins: 900 }], bolso: ['bolso', { coins: 450 }], farolito: ['farolito', { coins: 500 }],
    orbe: ['orbe', { coins: 600 }], buho: ['buho', { gems: 20 }],
  },
};
/** Id nuevo de una pieza vieja (o el mismo si no cambió). */
export const v5Item = (kind, id) => V5_ITEMS[kind]?.[id]?.[0] ?? id;
// v3 → v4 (plan §J7, fuera lo tierno): piezas que se retiraron con su precio. migrateV4 (state.js) devuelve lo que
// costaba lo que tenías comprado (monedas o gemas, lo mismo que pagaste); lo gratis solo se va.
export const RETIRED_ITEMS = {
  hair: { pancita: null, liso: null, medias: { coins: 250 }, manchas: { coins: 400 }, rayas: { coins: 600 }, brillitos: { gems: 12 } },
  dress: { pelito: null, remerita: null, panuelo: { coins: 200 }, vestidito: { coins: 450 }, capita: { coins: 700 }, frac: { gems: 15 }, tutu: { coins: 600 } },
  crown: { orejitas: { coins: 900 }, antenitas: null, lacito: null, gorrito: null },
  acc: { alas_hada: null },
};

// ---------------- PERSONALIZACIÓN AUTO ----------------
// stats: speed / handling 1..5 (de cuando el auto se manejaba en los minijuegos; hoy solo se muestran en el Equipaje)
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
  hair: HAIR_STYLES, dress: DRESS_STYLES, crown: CROWNS, acc: ACCESSORIES, face: FACES, build: BUILDS,
  body: CAR_BODIES, wheels: CAR_WHEELS, topper: CAR_TOPPERS,
};

// ---------------- MISIONES ----------------
// Tipos de objetivo (goal.type) — se alimentan desde eventos del bus en quests.js:
//  build {id?}           terminar de construir (cualquiera o un id)
//  upgrade {id?}         terminar una mejora
//  collect               monedas recolectadas de edificios (suma)
//  earn                  monedas ganadas de cualquier fuente (suma)
//  customize             cambios en el Equipaje (personaje o auto)
//  buy                   compras en el Equipaje
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
//  threat                amenazas pasadas, jugadas o automáticas, simulacro incluido (absoluto: stats.threats)
// Las misiones se siguen por id (state.quests.done), así una fase puede sumar misiones en el medio de la cadena sin
// correr las demás (t15–t17 son de la Fase 3, Amenazas). La cadena vieja de minijuegos (m1–m15) se reemplazó por el
// tutorial del ciclo (DESIGN-CORE.md §6.1); lo ya cobrado no se repite (quests.js, OLD_MAIN).
export const MAIN_QUESTS = [
  { id: 't1', title: 'Primera casa', text: 'Construí una Casa para la primera gente del pueblo.', goal: { type: 'build', id: 'casita', count: 1 }, reward: { coins: 100, xp: 20 } },
  { id: 't2', title: 'Algo para comer', text: 'Construí una Huerta: da las provisiones para salir a explorar.', goal: { type: 'build', id: 'huerta', count: 1 }, reward: { coins: 80, xp: 20 } },
  { id: 't3', title: 'Primera cosecha', text: 'Hacé clic en la Huerta y juntá 4 provisiones.', goal: { type: 'prov', count: 4 }, reward: { coins: 60, xp: 15 } },
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
  { id: 't14', title: 'De Aldea a Caserío', text: 'Cumplí el expediente y subí la ciudad al rango Caserío.', goal: { type: 'castle', count: 2 }, reward: { gems: 5, xp: 80 } },
  // Amenazas (Fase 3, DESIGN-CORE.md §3 y §6.1): al llegar a Caserío se avisa un simulacro de crecida para el día siguiente
  { id: 't15', title: 'Se viene el agua', text: 'Construí un Dique cerca del arroyo: mañana llega un simulacro de crecida.', goal: { type: 'build', id: 'dique', count: 1 }, reward: { coins: 200, xp: 60, mats: { piedra: 4 } } },
  { id: 't16', title: 'Bolsas de arena', text: 'Fabricá 2 bolsas de arena en el Taller.', goal: { type: 'craft', id: 'arena', count: 2 }, reward: { gems: 3, xp: 50 } },
  { id: 't17', title: 'Primera prueba', text: 'Pasá el simulacro de crecida, jugándolo o dejando que se resuelva solo.', goal: { type: 'threat', count: 1 }, reward: { gems: 5, xp: 80, mats: { piedra: 2, madera: 2 } } },
  { id: 't18', title: 'Tres estrellas', text: 'Hacé una salida con las 3 estrellas.', goal: { type: 'expedition', minStars: 3, count: 1 }, reward: { gems: 5, xp: 80, chest: 'plata' } },
  { id: 't19', title: 'Hacia las sierras', text: 'Explorá una zona de las Sierras Bajas.', goal: { type: 'zone', region: 'sierras', count: 1 }, reward: { gems: 5, xp: 100 } },
  { id: 't20', title: 'Época de Piedra', text: 'Subí la ciudad al rango Pueblo.', goal: { type: 'castle', count: 3 }, reward: { gems: 6, xp: 150, chest: 'plata' } },
  { id: 'm16', title: 'Ciudad feliz', text: 'Llegá a 40 de felicidad.', goal: { type: 'happy', count: 40 }, reward: { gems: 2, xp: 100 } },
  { id: 'm17', title: 'Gran ciudad', text: 'Llegá a 60 de población.', goal: { type: 'pop', count: 60 }, reward: { coins: 1000, xp: 120 } },
  { id: 'm18', title: 'Mejora todo', text: 'Mejorá 5 edificios.', goal: { type: 'upgrade', count: 5 }, reward: { gems: 3, xp: 150 } },
  { id: 'm19', title: 'Al cine', text: 'Construí el Cine.', goal: { type: 'build', id: 'cine', count: 1 }, reward: { gems: 3, xp: 200 } },
  { id: 'm20', title: 'Leyenda de Pixelia', text: 'Llegá al nivel 12.', goal: { type: 'level', count: 12 }, reward: { gems: 5, xp: 0, chest: 'oro' } },
  { id: 'm21', title: 'Una Villa hecha y derecha', text: 'Subí la ciudad al rango Villa.', goal: { type: 'castle', count: 4 }, reward: { gems: 7, xp: 300 } },
  { id: 'm22', title: 'Gran Metrópolis', text: 'Llegá a 150 de población.', goal: { type: 'pop', count: 150 }, reward: { gems: 8, xp: 400 } },
  { id: 'm23', title: 'Un pueblo encantador', text: 'Llegá a 300 de Encanto (deco variada y edificios mejorados).', goal: { type: 'charm', count: 300 }, reward: { gems: 4, xp: 300 } },
  { id: 'm24', title: '¡Ya somos Ciudad!', text: 'Subí la Municipalidad al rango Ciudad.', goal: { type: 'castle', count: 5 }, reward: { gems: 8, xp: 500, chest: 'oro' } },
  { id: 'm25', title: 'Encanto puro', text: 'Llegá a 600 de Encanto.', goal: { type: 'charm', count: 600 }, reward: { gems: 5, xp: 600 } },
  { id: 'm26', title: 'Gran Ciudad', text: 'Subí la Municipalidad al rango Gran Ciudad.', goal: { type: 'castle', count: 6 }, reward: { gems: 10, xp: 800, chest: 'oro' } },
  { id: 'm27', title: 'Luces de Metrópolis', text: 'Subí la Municipalidad al rango Metrópolis.', goal: { type: 'castle', count: 7 }, reward: { gems: 13, xp: 1000, chest: 'real' } },
  { id: 'm28', title: 'Capital de Pixelia', text: 'Llevá tu ciudad al rango Capital.', goal: { type: 'castle', count: 8 }, reward: { gems: 20, xp: 1500, chest: 'real' } },
];

// Pool de misiones diarias (se eligen 3 por día con semilla de la fecha). needs: edificio que tiene que existir.
export const DAILY_POOL = [
  { id: 'd_collect', title: 'Recolectá monedas', goal: { type: 'collect', count: 300 }, reward: { coins: 150, xp: 20 }, scale: true },
  { id: 'd_earn', title: 'Ganá monedas', goal: { type: 'earn', count: 800 }, reward: { gems: 2, xp: 25 }, scale: true },
  { id: 'd_build', title: 'Construí 3 cosas', goal: { type: 'build', count: 3 }, reward: { coins: 200, xp: 25 } },
  { id: 'd_upgrade', title: 'Mejorá un edificio', goal: { type: 'upgrade', count: 1 }, reward: { gems: 2, xp: 30 }, minLevel: 3 },
  { id: 'd_customize', title: 'Cambiá tu look', goal: { type: 'customize', count: 1 }, reward: { coins: 100, xp: 15 }, minLevel: 2 },
  // expedición (DESIGN-CORE.md §6.1)
  { id: 'd_exp2', title: 'Hacé 2 salidas', goal: { type: 'expedition', count: 2 }, reward: { coins: 150, xp: 25, prov: 6 }, needs: 'casa_exp' },
  { id: 'd_prov', title: 'Juntá 20 provisiones', goal: { type: 'prov', count: 20 }, reward: { gems: 2, xp: 20 }, needs: 'huerta' },
  { id: 'd_expstars', title: 'Conseguí 4 estrellas en expediciones', goal: { type: 'expStars', count: 4 }, reward: { gems: 3, xp: 30 }, needs: 'casa_exp' },
  { id: 'd_craft', title: 'Fabricá 2 cosas en el Taller', goal: { type: 'craft', count: 2 }, reward: { coins: 150, xp: 25, mats: { madera: 2 } }, needs: 'taller' },
  { id: 'd_far', title: 'Explorá una casilla lejana', goal: { type: 'expFar', count: 1 }, reward: { gems: 2, xp: 25 }, needs: 'casa_exp' },
  // amenazas: solo si hay algún edificio dañado, y entonces sale siempre (quests.js ensureDaily)
  { id: 'd_repair', title: 'Repará un edificio', goal: { type: 'repair', count: 1 }, reward: { coins: 120, xp: 25, mats: { piedra: 1 } }, needs: 'damaged' },
];
// por completar las 3. Sin cofre desde la Fase 5b (DESIGN-CORE.md §8: ≤ 1,5 cofres por día; era uno de plata por día)
export const DAILY_BONUS_ALL = { gems: 1, xp: 50, stickers: 1 };

// Recompensa por login diario (racha de 7 días, después se repite). El día 7 trae Cofre de Plata.
// La racha perdona: 1 escudo por semana (season.streakWithShield) pausa la racha si faltás un día.
export const LOGIN_REWARDS = [
  { coins: 150 }, { coins: 250 }, { gems: 2 }, { coins: 400 }, { gems: 3 }, { coins: 700 }, { gems: 6, coins: 500, chest: 'plata' },
];

// Logros con niveles (tiers). stat: clave de state.stats. retired: logro de los minijuegos retirados: lo ganado se
// muestra como "Recuerdo" y no suma más (DESIGN-CORE.md §7.2.9).
export const ACHIEVEMENTS = [
  { id: 'a_coins', name: 'Bolsillo Lleno', desc: 'Ganá {n} monedas en total', stat: 'coinsEarned', tiers: [1000, 10000, 50000, 200000, 1000000], reward: [1, 1, 3, 4, 6] },
  { id: 'a_build', name: 'Manos a la Obra', desc: 'Construí {n} cosas', stat: 'built', tiers: [5, 20, 50, 120, 250], reward: [1, 1, 2, 3, 5] },
  { id: 'a_upgrade', name: 'Siempre mejor', desc: 'Mejorá {n} veces', stat: 'upgrades', tiers: [3, 10, 25, 60, 120], reward: [1, 1, 2, 3, 5] },
  { id: 'a_match3', name: 'Ojo de Joya', desc: 'Pasá {n} niveles de Joyas', stat: 'match3Wins', tiers: [3, 10, 25, 50, 100], reward: [3, 5, 8, 12, 20], retired: true },
  { id: 'a_blocks', name: 'Rompebloques', desc: 'Limpiá {n} líneas en Bloques', stat: 'blocksLines', tiers: [20, 100, 400, 1000, 3000], reward: [3, 5, 8, 12, 20], retired: true },
  { id: 'a_parking', name: 'Estaciona perfecto', desc: 'Estacioná {n} veces', stat: 'parkingWins', tiers: [3, 10, 25, 50, 100], reward: [3, 5, 8, 12, 20], retired: true },
  { id: 'a_driving', name: 'Al Volante', desc: 'Manejá {n} metros en total', stat: 'drivingMeters', tiers: [2000, 10000, 40000, 100000, 300000], reward: [3, 5, 8, 12, 20], retired: true },
  { id: 'a_fashion', name: 'Ropero Lleno', desc: 'Comprá {n} prendas o partes', stat: 'bought', tiers: [2, 6, 12, 20, 30], reward: [1, 1, 2, 3, 5] },
  { id: 'a_streak', name: 'Fiel a Pixelia', desc: 'Entrá {n} días seguidos', stat: 'bestStreak', tiers: [2, 5, 7, 14, 30], reward: [1, 1, 2, 3, 6] },
  { id: 'a_chests', name: 'Cazatesoros', desc: 'Abrí {n} cofres', stat: 'chestsOpened', tiers: [3, 15, 40, 100, 250], reward: [1, 1, 2, 3, 5] },
  { id: 'a_stickers', name: 'Coleccionista', desc: 'Conseguí {n} hallazgos distintos', stat: 'stickersNew', tiers: [10, 30, 60, 90, 108], reward: [1, 1, 3, 4, 8] },
  { id: 'a_rank', name: 'Intendencia', desc: 'Llevá tu ciudad al rango {n}', stat: 'rankBest', tiers: [2, 3, 5, 7, 8], reward: [1, 2, 3, 5, 8] },
  { id: 'a_charm', name: 'Ciudad Encantadora', desc: 'Llegá a {n} de Encanto', stat: 'charmBest', tiers: [100, 300, 600, 1000, 1500], reward: [1, 2, 3, 4, 6] },
  { id: 'a_season', name: 'Estrella de Temporada', desc: 'Llegá al nivel {n} del Pase', stat: 'seasonLevelBest', tiers: [5, 10, 20, 30], reward: [1, 2, 3, 5] },
];
