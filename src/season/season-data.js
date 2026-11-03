// Datos del Pase de Temporada y de los eventos rotativos (todo por datos: tocar acá para balancear).

// ---------- Calendario ----------
/** Época fija: lunes 2 de noviembre de 2026, 00:00 hora local. (mes 10 = noviembre) */
export const EPOCH = { y: 2026, m: 10, d: 2 };
export const SEASON_DAYS = 28;
export const MAX_TIER = 30;
export const BONUS_EVERY = 150;          // después del nivel 30: un cofre de madera cada 150 chispas

// ---------- Temas (rotan por índice de temporada) ----------
// accent: color principal, dark: sombra/borde, light: fondo suave, sky: degradé del encabezado
export const THEMES = [
  { id: 'primavera', name: 'Primavera Rosa', emoji: '🌸', accent: '#ff7eb6', dark: '#e0528f', light: '#ffe3f0', sky: ['#ffb8dc', '#ffe6f2'], phrase: 'Todo florece en Pixelia: ¡salí a juntar pétalos!' },
  { id: 'carnaval', name: 'Carnaval de Pixelia', emoji: '🎭', accent: '#b58cff', dark: '#8a5ee0', light: '#efe6ff', sky: ['#c9b0ff', '#f1e9ff'], phrase: 'Máscaras, papel picado y música en cada esquina.' },
  { id: 'noche', name: 'Noche Estrellada', emoji: '🌙', accent: '#7f8cff', dark: '#5562d6', light: '#e6e9ff', sky: ['#8e9bff', '#e3e6ff'], phrase: 'Pedile un deseo a cada estrella fugaz.' },
  { id: 'helado', name: 'Verano de Helado', emoji: '🍦', accent: '#3fd1a6', dark: '#2aa883', light: '#d9f8ee', sky: ['#8debd0', '#e3fbf3'], phrase: 'Calorcito, pileta y helado de frutilla.' },
  { id: 'bosque', name: 'Bosque Encantado', emoji: '🍄', accent: '#5cc46e', dark: '#3c9a50', light: '#e2f6e4', sky: ['#9fe0a8', '#eaf9ec'], phrase: 'Hongos que brillan y hadas escondidas entre los árboles.' },
  { id: 'cristal', name: 'Fiesta de Cristal', emoji: '💎', accent: '#4fb6f0', dark: '#2f8fcc', light: '#dff3ff', sky: ['#9fdcff', '#e8f7ff'], phrase: 'Todo brilla: lámparas, copas y vestidos de cristal.' },
  { id: 'otono', name: 'Dulce Otoño', emoji: '🍂', accent: '#ff9a62', dark: '#e0743a', light: '#ffeadc', sky: ['#ffc39e', '#fff0e4'], phrase: 'Hojas crujientes, chocolate caliente y mantita.' },
  { id: 'corazones', name: 'Reino de los Corazones', emoji: '💖', accent: '#ff5a7e', dark: '#d93a60', light: '#ffe1e8', sky: ['#ff9fb6', '#ffe8ee'], phrase: 'Una temporada para mimar a quienes más querés.' },
];

// ---------- Costo de cada nivel (chispas) ----------
// Los primeros niveles salen rápido para enganchar; después ≈ 1 nivel por día de juego normal.
export const TIER_COST = Array.from({ length: MAX_TIER }, (_, i) => (i === 0 ? 60 : i === 1 ? 90 : 120));

// ---------- Premios por nivel ----------
// coins: BASE (se multiplica por rewardScale(nivel de jugadora)); gems; chest: tipo; stickers: {n, minStars};
// items: {id: cantidad} (potenciadores de la mochila, ver ITEMS de chests.js); cosmetic: true (prenda premium gratis).
// special: true = nivel destacado (10/20/30).
export const TIERS = [
  /* 1 */ { coins: 150 },
  /* 2 */ { stickers: { n: 2 } },
  /* 3 */ { items: { hammer: 1 } },
  /* 4 */ { gems: 5 },
  /* 5 */ { chest: 'madera' },
  /* 6 */ { coins: 300 },
  /* 7 */ { items: { m3_moves: 2 } },
  /* 8 */ { stickers: { n: 3 } },
  /* 9 */ { items: { potion_prod: 1 } },
  /* 10 */ { cosmetic: true, gems: 10, special: true },
  /* 11 */ { coins: 450 },
  /* 12 */ { chest: 'madera' },
  /* 13 */ { items: { hourglass: 1 } },
  /* 14 */ { gems: 8 },
  /* 15 */ { chest: 'plata' },
  /* 16 */ { stickers: { n: 3, minStars: 2 } },
  /* 17 */ { items: { blk_bomb: 1, park_time: 1 } },
  /* 18 */ { coins: 650 },
  /* 19 */ { items: { potion_happy: 1 } },
  /* 20 */ { cosmetic: true, chest: 'oro', special: true },
  /* 21 */ { gems: 10 },
  /* 22 */ { stickers: { n: 4 } },
  /* 23 */ { items: { drv_shield: 1, m3_bomb: 1 } },
  /* 24 */ { coins: 850 },
  /* 25 */ { chest: 'plata' },
  /* 26 */ { items: { potion_mega: 1 } },
  /* 27 */ { gems: 15 },
  /* 28 */ { stickers: { n: 5, minStars: 3 } },
  /* 29 */ { chest: 'oro' },
  /* 30 */ { cosmetic: true, chest: 'real', special: true },
];
/** Gemas que se dan si ya tiene todas las prendas premium. */
export const COSMETIC_FALLBACK_GEMS = 40;

// ---------- Chispas por acción (DESIGN-RETENTION.md) ----------
export const POINTS = {
  dailyQuest: 60,        // misión diaria cobrada
  dailyBonus: 100,       // set del bonus diario (las 3)
  mainQuest: 80,         // misión principal cobrada
  gameWin: 25,           // ganar minijuego
  perStar: 10,           // + por estrella
  gameTry: 5,            // partida no ganada (cozy: 2 minutos siempre avanzan algo). 0 para desactivar
  collect: 2,            // cobrar un edificio
  collectDailyMax: 60,   // tope diario por cobros
  built: 10,             // terminar construcción (no cuenta caminos)
  upgraded: 25,          // terminar mejora
  helped: 20,            // ayudar/regalar a una amiga
  newSticker: 5,         // figurita nueva
};

/** Textos de "¿Cómo gano chispas?" */
export const POINT_SOURCES = [
  { ic: 'quest', text: 'Cobrar una misión diaria', pts: POINTS.dailyQuest },
  { ic: 'gift', text: 'Completar las 3 diarias (bonus)', pts: POINTS.dailyBonus },
  { ic: 'crown', text: 'Cobrar una misión principal', pts: POINTS.mainQuest },
  { ic: 'games', text: 'Ganar un minijuego', pts: `${POINTS.gameWin} +${POINTS.perStar}/★` },
  { ic: 'up', text: 'Terminar una mejora', pts: POINTS.upgraded },
  { ic: 'people', text: 'Ayudar o hacerle un regalo a alguien', pts: POINTS.helped },
  { ic: 'build', text: 'Terminar una construcción', pts: POINTS.built },
  { ic: '🃏', text: 'Pegar una figurita nueva', pts: POINTS.newSticker },
  { ic: 'coin', text: `Cobrar un edificio (hasta ${POINTS.collectDailyMax} por día)`, pts: POINTS.collect },
];

// ---------- Bienvenida de vuelta ----------
export const WELCOME = {
  minDays: 2,
  coinsPerDay: 200,      // BASE × rewardScale
  maxDays: 7,            // tope de días que cuentan
  bigDays: 7,            // desde acá: 2 cofres de madera + gemas
  bigGems: 5,
};

// ---------- Eventos rotativos ----------
// days: [desde, hasta] con 0 = lunes … 6 = domingo (hora local). mult: multiplicadores que lee eventMult(key).
// keys válidas de mult: production, chestDrop, stickers, match3Rewards, blocksRewards, parkingRewards, drivingRewards
export const EVENT_TEMPLATES = {
  doble_prod: { short: 'Producción ×2', title: 'Finde de Doble Producción', emoji: '🧺', color: '#ffd166', dark: '#e8a93a', days: [4, 6],
    desc: 'Todos tus negocios producen el doble. ¡Ideal para pasar a cobrar seguido!', mult: { production: 2 } },
  lluvia_cofres: { short: 'Cofres ×2', title: 'Lluvia de Cofres', emoji: '🎁', color: '#ff9a62', dark: '#e0743a', days: [3, 6],
    desc: 'Ganar minijuegos da el doble de chances de cofre.', mult: { chestDrop: 2 } },
  fiebre_figus: { short: 'Figuritas ×2', title: 'Fiebre de Figuritas', emoji: '🃏', color: '#b58cff', dark: '#8a5ee0', days: [3, 6],
    desc: 'Doble chance de figuritas en minijuegos y cofres.', mult: { stickers: 2 } },
  joyas: { short: 'Joyas Reales ×1,5', title: 'Semana de Joyas', emoji: '💎', color: '#8fd3ff', dark: '#4fa8e0', days: [0, 6],
    desc: 'Joyas Reales da premios ×1,5 toda la semana.', mult: { match3Rewards: 1.5 } },
  bloques: { short: 'Bloques ×1,5', title: 'Semana de Bloques Mágicos', emoji: '🧩', color: '#6fe3c1', dark: '#3cbf9a', days: [0, 6],
    desc: 'Bloques Mágicos da premios ×1,5 toda la semana.', mult: { blocksRewards: 1.5 } },
  parking: { short: 'Estacionamiento ×1,5', title: 'Semana del Estacionamiento', emoji: '🅿️', color: '#ff7eb6', dark: '#e0528f', days: [0, 6],
    desc: 'Estacionamiento Real da premios ×1,5 toda la semana.', mult: { parkingRewards: 1.5 } },
  paseo: { short: 'Paseo Real ×1,5', title: 'Semana del Paseo Real', emoji: '🚗', color: '#ffb38a', dark: '#e0743a', days: [0, 6],
    desc: 'Paseo Real da premios ×1,5 toda la semana.', mult: { drivingRewards: 1.5 } },
  estrellas: { short: 'Meta de estrellas', title: 'Carrera de Estrellas', emoji: '⭐', color: '#ffd166', dark: '#e8a93a', days: [0, 6],
    desc: 'Juntá estrellas en cualquier minijuego: hay 3 escalones con premio. ¡Es una meta tuya, sin apuro!', mult: {},
    race: [
      { goal: 9, reward: { coins: 300, stickers: { n: 1 } } },
      { goal: 21, reward: { gems: 8, chest: 'madera' } },
      { goal: 39, reward: { gems: 12, chest: 'plata' } },
    ] },
  dorada: { short: 'Todo ×1,25', title: 'Semana Dorada', emoji: '👑', color: '#ffd166', dark: '#e8a93a', days: [0, 6], golden: true,
    desc: 'Una vez por mes: todos los minijuegos dan ×1,25, producción ×1,25 y se pueden intercambiar figuritas de 5★.',
    mult: { production: 1.25, match3Rewards: 1.25, blocksRewards: 1.25, parkingRewards: 1.25, drivingRewards: 1.25 },
    flags: { trade5: true } },
};
for (const [id, t] of Object.entries(EVENT_TEMPLATES)) t.id = id;

/** Slot A: evento de semana entera (lun–dom). Cada 3 semanas toca la Carrera de Estrellas; las otras rotan
 *  entre estas semanas de minijuego. La Semana Dorada lo reemplaza la primera semana ISO de cada mes. */
export const RACE_EVERY = 3;
export const WEEK_POOL = ['joyas', 'bloques', 'parking', 'paseo'];
/** Slot B: evento de fin de semana largo (jue/vie–dom). Sin repetidos. */
export const WEEKEND_POOL = ['doble_prod', 'lluvia_cofres', 'fiebre_figus'];
