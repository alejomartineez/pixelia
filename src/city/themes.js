// Temas visuales de la ciudad. Cada jugador elige uno (state.city.theme) y se ve igual cuando lo visitan.
// No hay modelos nuevos por tema: los colores de los vóxeles se re-mapean al compilar la geometría
// (models.js guarda una caché por tema) y se cambian terreno, acantilados, cielo, luces y naturaleza.
//
//   THEMES, THEME_BY_ID, themeOf(id)        datos
//   mapColor(themeId, int) -> int           color de un vóxel en ese tema (cacheado)
//   themeHex(themeId, '#hex') -> '#hex'     igual, para colores CSS / canvas
//   currentThemeId(state)                   state.city.theme válido (con alias resueltos) o 'pueblo'
//
// Los modelos están pintados con la paleta "pueblo" (src/core/palette.js): ese tema no re-mapea nada.
// Las reglas de los demás temas usan "ranuras": 'pink' = el color principal (terracota) y 'lilac' = el
// secundario (azul pizarra), así cada tema decide en qué se convierten.

export const DEFAULT_THEME = 'pueblo';

// ---------- HSL ----------
function toHsl(n) {
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  let h = 0, s = 0;
  if (d > 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60; if (h < 0) h += 360;
  }
  return [h, Math.min(1, s), l, d];
}
function fromHsl(h, s, l) {
  h = ((h % 360) + 360) % 360; s = Math.max(0, Math.min(1, s)); l = Math.max(0, Math.min(1, l));
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return (Math.round((r + m) * 255) << 16) | (Math.round((g + m) * 255) << 8) | Math.round((b + m) * 255);
}
/** Familia del color: neutral (grises, blancos, tinta) o por tono. d = croma (0..1). */
function family(h, d, s = 0, l = 0) {
  if (d < 0.14) return 'neutral';
  // ranuras de la paleta: terracota (principal) y azul pizarra (secundario)
  if (s > 0.6 && ((h >= 12 && h < 24) || (h >= 24 && h < 32 && l > 0.85))) return 'pink';
  if (h >= 214 && h < 240 && s < 0.8) return 'lilac';
  if (h < 12 || h >= 350) return 'red';
  if (h < 38) return 'orange';
  if (h < 65) return 'gold';
  if (h < 150) return 'green';
  if (h < 185) return 'mint';
  if (h < 240) return 'sky';
  if (h < 300) return 'lilac';
  return 'pink';
}
const hex = (n) => '#' + n.toString(16).padStart(6, '0');
const int = (c) => (typeof c === 'number' ? c : parseInt(c.replace('#', ''), 16));
/** Corre el tono `h` hacia `to` una fracción k (por el camino corto). */
const towards = (h, to, k) => { let d = ((to - h + 540) % 360) - 180; return h + d * k; };

// Vidrios de las ventanas (models-kit C.glass*): algunos temas los "prenden".
const GLASS = ['#bfe8ff', '#93d0f2', '#ffffff'];

// =====================================================================
// Temas
// =====================================================================
// fam[familia](h, s, l) -> [h, s, l]  (sin regla = igual)
// exact: { '#hex': '#hex' } gana sobre fam
// snow: nieve en las caras de arriba expuestas (y >= 2)
// litWindows: los vidrios pasan a la capa sin luz (brillan de noche)
export const THEMES = [
  {
    id: 'pueblo', name: 'Pueblo Acogedor', emoji: '🏡', desc: 'Techos de teja, jardines verdes y cielo claro.',
    identity: true,
    swatch: ['#ee8a5c', '#7f9ee8', '#5fc46a', '#ffd166'],
    sky: 'linear-gradient(180deg, #a9daff 0%, #cdeaff 36%, #eef6f0 70%, #fdf0d4 100%)', stars: 0.4,
    lights: { sky: 0xffffff, ground: 0xd6c8a6, hemi: 1.15, sun: 0xfff1de, sunI: 2.48 },
    ground: { inA: '#a3e68b', inB: '#97dc80', outA: '#7cbb84', outB: '#74b37d', tuftIn: '#82cc70', tuftOut: '#5f9e6c',
      lightIn: '#b9f0a0', lightOut: '#8cc894', rim: '#d2f7b8', shadowOut: '#5d9a6a', lip: '#a6dca4',
      flowers: ['#ffffff', '#f28ca0', '#ffd166', '#9fb6f0', '#ee8a5c'] },
    cliff: { top: '#79c47e', grass: '#69b572', dirt: '#e7bd92',
      bands: [['#e2b58c', '#d8a77f'], ['#cf9a74', '#c48e6c'], ['#b98a6a', '#ad8062'], ['#9c7f6a', '#927563'], ['#86705f', '#7c6758']],
      gems: ['#ffd166', '#a5e1ff'], isletTop: '#9bdc8a' },
    cloud: ['#ffffff', '#f7f9ff', '#e6ecf4'],
    nature: [['tree', 0.3], ['pine', 0.2], ['bush', 0.18], ['flowers', 0.16], ['rock', 0.1], ['mushroom', 0.06]],
    fam: {},
  },
  {
    // Reemplaza a "Dulce Pastel" (id viejo 'pastel' → alias, ver THEME_ALIASES): ocres, terracotas apagadas y árboles rojizos.
    id: 'otono', name: 'Otoño', emoji: '🍂', desc: 'Ocres, terracotas apagadas y árboles rojizos.',
    swatch: ['#b8704a', '#c9923f', '#9a3f2c', '#8e9460'],
    sky: 'linear-gradient(180deg, #b9c9d0 0%, #d6d8cf 36%, #ead8bd 70%, #efcfa4 100%)', stars: 0.3,
    lights: { sky: 0xfff4e6, ground: 0xb89a70, hemi: 1.08, sun: 0xffe2bc, sunI: 2.36 },
    ground: { inA: '#b3b46c', inB: '#a9ab64', outA: '#8f955f', outB: '#888e59', tuftIn: '#a0a25c', tuftOut: '#73784f',
      lightIn: '#c6c47f', lightOut: '#a1a46c', rim: '#d9cf9c', shadowOut: '#686e4b', lip: '#b6ae7a',
      flowers: ['#f1e2c4', '#b8553a', '#d9a23e', '#9a3f2c', '#efe0bf'] },
    cliff: { top: '#979a5e', grass: '#868a54', dirt: '#c09468',
      bands: [['#b98c64', '#ae825c'], ['#a07454', '#956b4e'], ['#86654e', '#7c5d48'], ['#6d5646', '#654f41'], ['#57483d', '#4f4238']],
      gems: ['#d9a23e', '#b8553a'], isletTop: '#a5a865' },
    cloud: ['#fffaf2', '#f3ebdf', '#e0d6c8'],
    nature: [['tree', 0.36], ['bush', 0.2], ['pine', 0.12], ['flowers', 0.12], ['rock', 0.12], ['mushroom', 0.08]],
    fam: {
      pink: (h, s, l) => [16, s * 0.62, l * 0.86],            // techos: terracota apagada
      lilac: (h, s, l) => [205, s * 0.32, l * 0.78],          // segundo color: pizarra gris
      red: (h, s, l) => [8, s * 0.62, l * 0.82],
      orange: (h, s, l) => [24, s * 0.68, l * 0.86],
      gold: (h, s, l) => [38, s * 0.78, l * 0.9],             // ocre
      // follaje: lo oscuro se vuelve rojizo, lo medio naranja tostado y lo claro (pasto) verde oliva
      green: (h, s, l) => (l > 0.64 ? [60, 0.3, l * 0.9] : l > 0.5 ? [24, 0.55, l * 0.9] : [8, 0.5, l * 0.95]),
      mint: (h, s, l) => [78, s * 0.3, l * 0.84],
      sky: (h, s, l) => [204, s * 0.45, l * 0.94],
      neutral: (h, s, l) => (l > 0.9 ? [36, 0.32, l * 0.95] : l > 0.3 ? [30, Math.max(s, 0.08), l * 0.95] : [h, s, l]),
    },
  },
  {
    id: 'moderna', name: 'Ciudad Moderna', emoji: '🏙️', desc: 'Vidrio, grises cálidos y toques turquesa.',
    swatch: ['#d9d2c8', '#5c6b7a', '#2ec4b6', '#9fd8e8'],
    sky: 'linear-gradient(180deg, #cfe6f2 0%, #e4eef2 40%, #f2ece4 75%, #e9e2d8 100%)', stars: 0,
    lights: { sky: 0xffffff, ground: 0xc9c2b8, hemi: 1.11, sun: 0xfff6ea, sunI: 2.56 },
    ground: { inA: '#a8d49a', inB: '#9ecb90', outA: '#8eb39a', outB: '#87ac93', tuftIn: '#8fc283', tuftOut: '#76998a',
      lightIn: '#bfe2b0', lightOut: '#a3c4ac', rim: '#e8e2d8', shadowOut: '#6f8f80', lip: '#d8d1c6',
      flowers: ['#ffffff', '#2ec4b6', '#f2c14e', '#e8e2d8', '#ffffff'] },
    cliff: { top: '#86b88e', grass: '#7aa982', dirt: '#cfc6b8',
      bands: [['#cfc6b8', '#c4bbac'], ['#b8afa2', '#ada496'], ['#9e9890', '#948e86'], ['#86848a', '#7d7b82'], ['#6e6f78', '#666770']],
      gems: ['#2ec4b6', '#9fd8e8'], isletTop: '#a2cf96' },
    cloud: ['#ffffff', '#f4f6f8', '#e2e7ec'],
    nature: [['roundtree', 0.34], ['hedge', 0.24], ['bush', 0.14], ['flowers', 0.12], ['rock', 0.1], ['pine', 0.06]],
    fam: {
      pink: (h, s, l) => (l > 0.72 ? [32, 0.14, Math.min(0.9, l * 1.04)] : l > 0.64 ? [210, 0.12, l * 0.5] : [176, 0.62, l * 0.82]),
      red: (h, s, l) => [176, 0.55, l * 0.8],
      lilac: (h, s, l) => [212, s * 0.2, l * 0.62],
      mint: (h, s, l) => [176, Math.min(1, s * 1.05), l * 0.9],
      sky: (h, s, l) => [196, s * 0.75, l],
      gold: (h, s, l) => [42, s * 0.75, l * 0.96],
      orange: (h, s, l) => [26, s * 0.45, l * 0.78],
      green: (h, s, l) => [128, s * 0.62, l * 0.9],
      neutral: (h, s, l) => (l > 0.9 ? [36, 0.18, l * 0.97] : l > 0.3 ? [30, 0.07, l * 0.96] : [220, 0.18, l]),
    },
  },
  {
    id: 'bosque', name: 'Bosque', emoji: '🍄', desc: 'Maderas, verdes profundos, hongos y faroles cálidos.',
    swatch: ['#8a5a3a', '#2f6b45', '#c8423a', '#ffc861'],
    sky: 'linear-gradient(180deg, #8fb7a5 0%, #b9d4b5 38%, #e6dfb8 72%, #f2d7a6 100%)', stars: 0.35,
    lights: { sky: 0xfff3d6, ground: 0x6f8f5a, hemi: 1.04, sun: 0xffe2b0, sunI: 2.32 },
    ground: { inA: '#6fae5c', inB: '#67a556', outA: '#4f8a52', outB: '#4a824d', tuftIn: '#5b9a4c', tuftOut: '#3d6f42',
      lightIn: '#86c26e', lightOut: '#5f9a5c', rim: '#a5cf86', shadowOut: '#355f3b', lip: '#6d9a5e',
      flowers: ['#fff2c8', '#e0533f', '#ffc861', '#b98be0', '#fff2c8'] },
    cliff: { top: '#4f8a52', grass: '#3f7346', dirt: '#9a6a44',
      bands: [['#8a5e3e', '#7f5638'], ['#735037', '#6a4932'], ['#5f4a3c', '#574437'], ['#4c4640', '#46403a'], ['#3e3a3a', '#383434']],
      gems: ['#ffc861', '#9be0b0'], isletTop: '#5f9e55' },
    cloud: ['#ffffff', '#f6f4ec', '#e2e6d8'],
    nature: [['pine', 0.3], ['tree', 0.2], ['glowshroom', 0.16], ['mushroom', 0.12], ['bush', 0.12], ['rock', 0.1]],
    exact: { '#bfe8ff': '#ffe7a3', '#93d0f2': '#f5c062' },
    fam: {
      pink: (h, s, l) => (l > 0.8 ? [40, 0.5, l * 0.93] : l > 0.62 ? [26, 0.44, l * 0.7] : [4, 0.62, l * 0.82]),
      red: (h, s, l) => [3, 0.68, l * 0.82],
      lilac: (h, s, l) => [282, s * 0.42, l * 0.7],
      mint: (h, s, l) => [104, s * 0.5, l * 0.72],
      sky: (h, s, l) => [170, s * 0.4, l * 0.78],
      gold: (h, s, l) => [36, Math.min(1, s * 1.05), l],
      orange: (h, s, l) => [24, s * 0.95, l * 0.8],
      green: (h, s, l) => [130, s * 0.6, l * 0.66],
      neutral: (h, s, l) => (l > 0.9 ? [44, 0.42, l * 0.93] : l > 0.3 ? [84, 0.1, l * 0.8] : [20, 0.25, l]),
    },
  },
  {
    id: 'playa', name: 'Playa Tropical', emoji: '🏝️', desc: 'Arena, mar turquesa y palmeras.',
    swatch: ['#f3dca4', '#22c2c9', '#ff8a6b', '#3fb55a'],
    sky: 'linear-gradient(180deg, #7fd6f5 0%, #aee6f6 40%, #dff6f2 72%, #fff1cf 100%)', stars: 0,
    lights: { sky: 0xffffff, ground: 0xe8d6a8, hemi: 1.18, sun: 0xfff1d6, sunI: 2.62 },
    ground: { inA: '#f2dda6', inB: '#ecd59c', outA: '#8fd17a', outB: '#86c872', tuftIn: '#e3c98c', tuftOut: '#6fb563',
      lightIn: '#fbecc4', lightOut: '#a8e08e', rim: '#fff6dc', shadowOut: '#d9bf86', lip: '#ffffff',
      flowers: ['#ffffff', '#ff8a6b', '#ffd34d', '#22c2c9', '#ff6fa0'] },
    cliff: { top: '#f2dda6', grass: '#e8cf92', dirt: '#e0c084',
      bands: [['#5fd6d6', '#48cccf'], ['#e6c88e', '#dcbd83'], ['#d2b07a', '#c8a672'], ['#b99a6e', '#ae9068'], ['#9c8466', '#927b60']],
      gems: ['#ff8a6b', '#ffffff'], isletTop: '#f2dda6' },
    cloud: ['#ffffff', '#f8fcff', '#e6f4fa'],
    nature: [['palm', 0.42], ['bush', 0.18], ['flowers', 0.14], ['rock', 0.14], ['tree', 0.12]],
    fam: {
      pink: (h, s, l) => (l > 0.8 ? [42, 0.62, Math.max(l, 0.82)] : l > 0.7 ? [14, 0.92, 0.76] : [8, 0.8, l * 0.95]),
      red: (h, s, l) => [8, Math.min(1, s), l],
      lilac: (h, s, l) => [183, s * 0.85, l * 0.92],
      mint: (h, s, l) => [174, Math.min(1, s * 1.05), l],
      sky: (h, s, l) => [186, Math.min(1, s * 1.1), l],
      gold: (h, s, l) => [47, s, l],
      orange: (h, s, l) => [32, s * 0.7, Math.min(0.8, l * 1.12)],
      green: (h, s, l) => [108, s, l * 0.95],
      neutral: (h, s, l) => (l > 0.9 ? [42, s * 0.6, l] : l > 0.3 ? [38, 0.3, l] : [200, 0.3, l]),
    },
  },
  {
    id: 'invierno', name: 'Invierno Nevado', emoji: '⛄', desc: 'Nieve en los techos, azules helados y luces.',
    swatch: ['#f4f8ff', '#9cc6f0', '#3d5a8c', '#d8433f'],
    sky: 'linear-gradient(180deg, #b8cdea 0%, #d6e3f4 40%, #eef3fb 75%, #ffffff 100%)', stars: 0.7,
    lights: { sky: 0xf4f8ff, ground: 0xb9c8e6, hemi: 1.15, sun: 0xf2f6ff, sunI: 2.32 },
    ground: { inA: '#e4ecf8', inB: '#dae4f3', outA: '#cfdaeb', outB: '#c8d4e7', tuftIn: '#cbd8ec', tuftOut: '#b8c7de',
      lightIn: '#f7faff', lightOut: '#e2eaf6', rim: '#ffffff', shadowOut: '#a9bad4', lip: '#f4f8ff',
      flowers: ['#ffffff', '#d8433f', '#9cc6f0', '#ffffff', '#c7e0f7'] },
    cliff: { top: '#f4f8ff', grass: '#e2ebf7', dirt: '#a9b8cf',
      bands: [['#a9b8cf', '#9fafc8'], ['#8f9fbb', '#8697b4'], ['#7a87a6', '#727f9f'], ['#656f91', '#5e688a'], ['#525a7c', '#4b5375']],
      gems: ['#bfe8ff', '#ffffff'], isletTop: '#f4f8ff' },
    cloud: ['#ffffff', '#f2f6fc', '#dce5f2'],
    nature: [['pine', 0.42], ['snowman', 0.1], ['tree', 0.16], ['bush', 0.12], ['rock', 0.14], ['flowers', 0.06]],
    snow: ['#ffffff', '#eef4fc'], snowAmount: 0.78,
    exact: { '#bfe8ff': '#ffe7a3', '#93d0f2': '#f2c46a' },
    fam: {
      pink: (h, s, l) => (l >= 0.7 ? [212, 0.3, 0.64] : [352, 0.62, l * 0.8]),
      red: (h, s, l) => [354, 0.66, l * 0.85],
      lilac: (h, s, l) => [226, s * 0.55, l * 0.66],
      mint: (h, s, l) => [190, s * 0.6, l],
      sky: (h, s, l) => [204, s * 0.7, Math.min(0.95, l * 1.04)],
      gold: (h, s, l) => [44, s, l],
      orange: (h, s, l) => [22, s * 0.75, l * 0.78],
      green: (h, s, l) => (l > 0.64 ? [206, 0.4, 0.93] : [152, s * 0.45, l * 0.68]),
      neutral: (h, s, l) => (l > 0.9 ? [212, Math.max(s, 0.3), l * 0.88] : l > 0.3 ? [214, 0.18, l * 0.86] : [224, 0.3, l]),
    },
  },
  {
    id: 'noche', name: 'Luces de Noche', emoji: '🌙', desc: 'Azules profundos, estrellas y ventanas encendidas.',
    swatch: ['#1e2450', '#4d4fa0', '#ffd166', '#8fb4ff'],
    sky: 'linear-gradient(180deg, #0e1233 0%, #1f2458 40%, #3a3478 75%, #5a3f86 100%)', stars: 1,
    dark: true, // aro de luz bajo el personaje (city-life.js), que si no se pierde contra el piso
    lights: { sky: 0xa8b8ff, ground: 0x3a3060, hemi: 0.85, sun: 0xc4d0ff, sunI: 1.4 },
    ground: { inA: '#4f7f74', inB: '#4a786e', outA: '#3a5d63', outB: '#36585e', tuftIn: '#456f68', tuftOut: '#2f4c55',
      lightIn: '#5f9184', lightOut: '#456a6e', rim: '#7aa79a', shadowOut: '#283f4a', lip: '#5c7d84',
      flowers: ['#fff3c4', '#ff9ccb', '#ffd166', '#cdb5ff', '#a5e1ff'] },
    cliff: { top: '#3f6b66', grass: '#36605e', dirt: '#6d5a78',
      bands: [['#5f5079', '#584a72'], ['#4f466e', '#494167'], ['#413d63', '#3b385c'], ['#353457', '#302f50'], ['#2a2a4a', '#262644']],
      gems: ['#ffd166', '#a5e1ff'], isletTop: '#467a70' },
    cloud: ['#8c93c4', '#7980b4', '#5f6599'],
    nature: [['pine', 0.3], ['tree', 0.28], ['bush', 0.14], ['flowers', 0.12], ['lamp', 0.06], ['rock', 0.1]],
    litWindows: '#ffd77a',
    exact: { '#bfe8ff': '#ffe49a', '#93d0f2': '#ffc75a' },
    fam: {
      gold: (h, s, l) => [h, s, l * 0.96],
      pink: (h, s, l) => [towards(h, 262, 0.5), s * 0.7, l * 0.7],
      // ladrillo, tejas y maderas de las épocas: pardos bajo la luna (con la regla general se iban a fucsia)
      orange: (h, s, l) => [towards(h, 250, 0.06), s * 0.62, l * 0.72],
      neutral: (h, s, l) => (l > 0.9 ? [228, 0.35, l * 0.8] : [towards(h, 240, 0.5), Math.max(s, 0.12), l * 0.72]),
      _: (h, s, l) => [towards(h, 245, 0.28), s * 0.85, l * 0.74],
    },
  },
];

/** Ids viejos que ya no están en la lista: los guardados (y las ciudades que se visitan) los siguen teniendo. */
export const THEME_ALIASES = { pastel: 'otono' };
export const THEME_BY_ID = Object.fromEntries(THEMES.map(t => [t.id, t]));
for (const [old, to] of Object.entries(THEME_ALIASES)) Object.defineProperty(THEME_BY_ID, old, { value: THEME_BY_ID[to], enumerable: false });
export const themeOf = (id) => THEME_BY_ID[id] || THEME_BY_ID[DEFAULT_THEME];
export const currentThemeId = (state) => {
  const id = THEME_ALIASES[state?.city?.theme] || state?.city?.theme;
  return THEME_BY_ID[id] ? id : DEFAULT_THEME;
};

// ---------- Mapeo de colores (cacheado por tema) ----------
const caches = new Map();
for (const t of THEMES) {
  if (t.exact) t._exact = new Map(Object.entries(t.exact).map(([a, b]) => [int(a), int(b)]));
  t._glass = new Set(GLASS.slice(0, 2).map(int));
}
export function mapColor(themeId, c) {
  const t = themeOf(themeId);
  if (t.identity) return int(c);
  const n = int(c);
  let cache = caches.get(t.id);
  if (!cache) caches.set(t.id, cache = new Map());
  let out = cache.get(n);
  if (out !== undefined) return out;
  if (t._exact?.has(n)) out = t._exact.get(n);
  else {
    const [h, s, l, d] = toHsl(n);
    const f = t.fam[family(h, d, s, l)] || t.fam._;
    out = f ? fromHsl(...f(h, s, l)) : n;
  }
  cache.set(n, out);
  return out;
}
export const themeHex = (themeId, c) => hex(mapColor(themeId, c));
/** ¿Es vidrio de ventana? (para prenderlas en temas de noche) */
export const isGlass = (themeId, c) => themeOf(themeId)._glass.has(int(c));
