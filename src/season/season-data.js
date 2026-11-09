// Datos del Pase de Temporada y de los eventos rotativos (todo por datos: tocar acá para balancear).

// ---------- Calendario ----------
/** Época fija: lunes 2 de noviembre de 2026, 00:00 hora local. (mes 10 = noviembre) */
export const EPOCH = { y: 2026, m: 10, d: 2 };
export const SEASON_DAYS = 28;
export const MAX_TIER = 30;
export const BONUS_EVERY = 600;          // después del nivel 30: un cofre de madera cada 600 chispas (Fase 5b: eran 150)

// ---------- Temas (rotan por índice de temporada) ----------
// accent: color principal, dark: sombra/borde, light: fondo suave, sky: degradé del encabezado
export const THEMES = [
  { id: 'primavera', name: 'Primavera en Flor', emoji: 'flower', accent: '#ee8a5c', dark: '#c8673d', light: '#f9f3e9', sky: ['#f6e2c0', '#faf4eb'], phrase: 'Florece todo, hasta lo que nadie plantó.' },
  { id: 'carnaval', name: 'Carnaval de Pixelia', emoji: 'mask', accent: '#7f9ee8', dark: '#5a78c4', light: '#faf4eb', sky: ['#aabeeb', '#fbf5ed'], phrase: 'Máscaras, papel picado y música en cada esquina.' },
  { id: 'noche', name: 'Noche Estrellada', emoji: 'moon', accent: '#7f8cff', dark: '#5562d6', light: '#faf4eb', sky: ['#8e9bff', '#f9f3e9'], phrase: 'Noches largas, cielo limpio y alguna estrella fugaz.' },
  { id: 'helado', name: 'Verano de Helado', emoji: 'icecream', accent: '#3fd1a6', dark: '#2aa883', light: '#d9f8ee', sky: ['#8debd0', '#e3fbf3'], phrase: 'Calor, pileta y helado de frutilla.' },
  { id: 'bosque', name: 'Bosque Encantado', emoji: 'mushroom', accent: '#5cc46e', dark: '#3c9a50', light: '#e2f6e4', sky: ['#9fe0a8', '#eaf9ec'], phrase: 'Hongos, luciérnagas y caminos que nadie marcó.' },
  { id: 'cristal', name: 'Feria de Inventos', emoji: 'lookout', accent: '#4fb6f0', dark: '#2f8fcc', light: '#dff3ff', sky: ['#9fdcff', '#e8f7ff'], phrase: 'Cohetes, robots y experimentos que brillan.' },
  { id: 'otono', name: 'Otoño', emoji: 'leaf', accent: '#ff9a62', dark: '#e0743a', light: '#ffeadc', sky: ['#ffc39e', '#fff0e4'], phrase: 'Hojas secas, chocolate caliente y una manta.' },
  { id: 'corazones', name: 'Temporada de Visitas', emoji: 'handshake', accent: '#c47a68', dark: '#a35a4b', light: '#f4e2db', sky: ['#e3bfb2', '#faf5ed'], phrase: 'Para pasar por la ciudad de alguien y dejar algo.' },
];

// ---------- Costo de cada nivel (chispas) ----------
// Los primeros niveles salen rápido para enganchar; después ≈ 1 nivel por día de juego normal.
// Fase 5b (tools/sim-economy.mjs): 60, 120, 180 y después 440 → nivel 30 ≈ día 23 con 2 ratos por día (§8).
export const TIER_COST = Array.from({ length: MAX_TIER }, (_, i) => (i === 0 ? 60 : i === 1 ? 120 : i === 2 ? 180 : 440));

// ---------- Premios por nivel ----------
// coins: BASE (se multiplica por rewardScale(nivel de jugadora)); gems; chest: tipo; stickers: {n, minStars};
// items: {id: cantidad} (objetos de la mochila, ver ITEMS de chests.js); equip: {id: cantidad} (equipo de expedición);
// cosmetic: true (prenda premium gratis); mats: {material: cantidad} (madera, piedra, mineral, hierbas);
// planos: planos de época (niveles 10, 20 y 30, DESIGN-CORE.md §5.1).
// special: true = nivel destacado (10/20/30).
export const TIERS = [
  /* 1 */ { coins: 150 },
  /* 2 */ { stickers: { n: 2 } },
  /* 3 */ { items: { hammer: 1 } },
  /* 4 */ { gems: 3 },
  /* 5 */ { coins: 250, mats: { madera: 4 } },
  /* 6 */ { coins: 300, mats: { piedra: 4 } },
  /* 7 */ { equip: { cuerda: 2 } },
  /* 8 */ { stickers: { n: 3 } },
  /* 9 */ { items: { potion_prod: 1 } },
  /* 10 */ { cosmetic: true, gems: 6, planos: 1, special: true },
  /* 11 */ { coins: 450, mats: { mineral: 5 } },
  /* 12 */ { stickers: { n: 2 }, mats: { hierbas: 4 } },
  /* 13 */ { items: { hourglass: 1 } },
  /* 14 */ { gems: 8, coins: 400 },
  /* 15 */ { chest: 'plata' },
  /* 16 */ { stickers: { n: 3, minStars: 2 } },
  /* 17 */ { equip: { pala: 1, farol: 1 } },
  /* 18 */ { coins: 650, mats: { madera: 6 } },
  /* 19 */ { items: { potion_happy: 1 } },
  /* 20 */ { cosmetic: true, chest: 'oro', planos: 1, special: true },
  /* 21 */ { gems: 6 },
  /* 22 */ { stickers: { n: 4 } },
  /* 23 */ { equip: { lona: 1, pala: 1 } },
  /* 24 */ { coins: 850, mats: { hierbas: 6, piedra: 6 } },
  /* 25 */ { coins: 900, mats: { mineral: 6 } },
  /* 26 */ { items: { potion_mega: 1 } },
  /* 27 */ { gems: 10, coins: 700 },
  /* 28 */ { stickers: { n: 5, minStars: 3 } },
  /* 29 */ { stickers: { n: 4, minStars: 3 }, mats: { piedra: 8 } },
  /* 30 */ { cosmetic: true, chest: 'real', planos: 1, special: true },
];
/** Gemas que se dan si ya tiene todas las prendas premium. */
export const COSMETIC_FALLBACK_GEMS = 40;

// ---------- Chispas por acción (DESIGN-RETENTION.md) ----------
export const POINTS = {
  dailyQuest: 40,        // misión diaria cobrada
  dailyBonus: 60,        // set del bonus diario (las 3)
  mainQuest: 50,         // misión principal cobrada
  expedition: 20,        // salida terminada (corta o normal; vuelta o fracaso: siempre avanza algo)
  perStar: 5,            // + por estrella de la salida
  zone: 30,              // zona explorada
  collect: 1,            // cobrar un edificio
  collectDailyMax: 30,   // tope diario por cobros
  built: 5,              // terminar construcción (no cuenta caminos)
  upgraded: 15,          // terminar mejora
  renovated: 15,         // terminar una renovación de época
  repaired: 5,           // reparar un edificio pagando (lo que arregla la vecindad no cuenta)
  helped: 20,            // ayudar/regalar a una amiga
  newSticker: 5,         // hallazgo nuevo
};

/** Textos de "¿Cómo gano chispas?" */
export const POINT_SOURCES = [
  { ic: 'quest', text: 'Cobrar una misión diaria', pts: POINTS.dailyQuest },
  { ic: 'gift', text: 'Completar las 3 diarias (bonus)', pts: POINTS.dailyBonus },
  { ic: 'medal', text: 'Cobrar una misión principal', pts: POINTS.mainQuest },
  { ic: 'expedition', text: 'Terminar una expedición', pts: `${POINTS.expedition} +${POINTS.perStar}/★` },
  { ic: 'map', text: 'Explorar una zona', pts: POINTS.zone },
  { ic: 'bolt', text: 'Pasar una amenaza (más cuanto más salvás)', pts: '40–100' },
  { ic: 'up', text: 'Terminar una mejora', pts: POINTS.upgraded },
  { ic: 'up', text: 'Renovar un edificio a la época nueva', pts: POINTS.renovated },
  { ic: 'build', text: 'Reparar un edificio', pts: POINTS.repaired },
  { ic: 'people', text: 'Ayudar o hacerle un regalo a alguien', pts: POINTS.helped },
  { ic: 'build', text: 'Terminar una construcción', pts: POINTS.built },
  { ic: 'finding', text: 'Encontrar un hallazgo nuevo', pts: POINTS.newSticker },
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
// keys válidas de mult: production, chestDrop (cofre de las salidas de 3★), stickers (hallazgos al volver),
// expMats (materiales de todas las expediciones), region_<id> (materiales de las salidas a esa región)
export const EVENT_TEMPLATES = {
  doble_prod: { short: 'Producción ×2', title: 'Finde de Doble Producción', emoji: 'basket', color: '#ffd166', dark: '#e8a93a', days: [4, 6],
    desc: 'Todos tus negocios producen el doble. Conviene pasar a cobrar seguido.', mult: { production: 2 } },
  lluvia_cofres: { short: 'Cofres ×2', title: 'Lluvia de Cofres', emoji: 'chest', color: '#ff9a62', dark: '#e0743a', days: [3, 6],
    desc: 'Las salidas de 3★ tienen el doble de chances de traer un cofre.', mult: { chestDrop: 2 } },
  fiebre_figus: { short: 'Hallazgos ×2', title: 'Fin de semana de Hallazgos', emoji: 'pack', color: '#7f9ee8', dark: '#5a78c4', days: [3, 6],
    desc: 'Cada hallazgo que traés de una expedición viene con otro de regalo.', mult: { stickers: 2 } },
  // semanas de región (reemplazan a las de los minijuegos; los ids viejos quedan por compatibilidad de calendario)
  joyas: { short: 'Bosque ×1,5', title: 'Semana del Bosque del Arroyo', emoji: 'forest', color: '#8fbf6a', dark: '#5f8f3c', days: [0, 6],
    desc: 'Las salidas al Bosque del Arroyo traen 50% más de materiales toda la semana.', mult: { region_bosque: 1.5 } },
  bloques: { short: 'Sierras ×1,5', title: 'Semana de las Sierras Bajas', emoji: 'mountain', color: '#c9a77a', dark: '#9c7b4e', days: [0, 6],
    desc: 'Las salidas a las Sierras Bajas traen 50% más de materiales toda la semana.', mult: { region_sierras: 1.5 } },
  parking: { short: 'Bañado ×1,5', title: 'Semana del Bañado de los Juncos', emoji: 'marsh', color: '#6fbfb0', dark: '#3f8f80', days: [0, 6],
    desc: 'Las salidas al Bañado de los Juncos traen 50% más de materiales toda la semana.', mult: { region_banado: 1.5 } },
  paseo: { short: 'Expediciones ×1,25', title: 'Semana de Expediciones', emoji: 'expedition', color: '#ffb38a', dark: '#e0743a', days: [0, 6],
    desc: 'Todas las expediciones traen 25% más de materiales toda la semana.', mult: { expMats: 1.25 } },
  estrellas: { short: 'Meta de estrellas', title: 'Carrera de Estrellas', emoji: 'star', color: '#ffd166', dark: '#e8a93a', days: [0, 6],
    desc: 'Juntá estrellas en tus expediciones: hay 3 escalones con premio. Es una meta tuya, sin apuro.', mult: {},
    race: [
      { goal: 9, reward: { coins: 300, stickers: { n: 1 } } },
      { goal: 21, reward: { gems: 5, stickers: { n: 2 } } },
      { goal: 39, reward: { gems: 12, chest: 'plata' } },
    ] },
  dorada: { short: 'Todo ×1,25', title: 'Semana Dorada', emoji: 'trophy', color: '#ffd166', dark: '#e8a93a', days: [0, 6], golden: true,
    desc: 'Una vez por mes: expediciones con 25% más de materiales, producción ×1,25 y se pueden intercambiar hallazgos de 5★.',
    mult: { production: 1.25, expMats: 1.25 },
    flags: { trade5: true } },
};
for (const [id, t] of Object.entries(EVENT_TEMPLATES)) t.id = id;

/** Slot A: evento de semana entera (lun–dom). Cada 3 semanas toca la Carrera de Estrellas; las otras rotan
 *  entre estas semanas de región. La Semana Dorada lo reemplaza la primera semana ISO de cada mes. */
export const RACE_EVERY = 3;
export const WEEK_POOL = ['joyas', 'bloques', 'parking', 'paseo'];
/** Slot B: evento de fin de semana largo (jue/vie–dom). Sin repetidos. */
export const WEEKEND_POOL = ['doble_prod', 'lluvia_cofres', 'fiebre_figus'];
