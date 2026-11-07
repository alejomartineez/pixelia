// Paleta única de Pixelia ("pueblo acogedor", cozy adulto): cálida y apagada, verde y cielo; el rosa (berry) es un
// acento puntual (alguna flor), no un color de sistema.
// La usan los modelos vóxel (models-kit P), la UI (los mismos valores están como variables en styles.css),
// los íconos y los temas. Si cambiás un color acá, cambialo también en :root de styles.css.

export const INK = '#3d2f2a';        // tinta café: contornos, texto
export const INK_L = '#6e5a4f';
export const INK_LL = '#a2917f';

export const PALETTE = {
  // terracota: techos, toldos, botón principal
  clay: '#dc8a60', clayD: '#b66a46', clayL: '#f3d8c6',
  // azul pizarra: segundo color (XP, botones secundarios)
  slate: '#8499c4', slateD: '#5f74a3', slateL: '#dce3f0',
  mint: '#80cbb0', mintD: '#4fa287', mintL: '#cfece0',
  sky: '#9ccbe6', skyD: '#5f9dc4', skyL: '#dbecf5',
  gold: '#f0c96e', goldD: '#cf9e45', goldL: '#f7ebc9',
  berry: '#d98f9c', berryD: '#b56b7a', berryL: '#f2dade',   // acento rosado puntual (alguna flor), nunca de sistema
  peach: '#efb592', coral: '#e2766c', cream: '#fbf5e6',
  white: '#ffffff', ink: INK, inkL: INK_L,
  grass: '#9ccf82', grassD: '#7bb566', grassL: '#bfe2a8',
  dirt: '#d4a77d', stone: '#dcd4c7', stoneD: '#aa9f8e',
  wood: '#a87a56', woodD: '#86593c', water: '#8ccbe8', leaf: '#68b36c', leafD: '#478f53',
};

// Paletas de época (DESIGN-CORE.md §4.2): pocos colores, apagados y cálidos, uno por material.
// Las usa la capa de época de models-kit.js (ERA_STYLE). Los pares claro/oscuro se separan al menos 28 en algún
// canal para que la limpieza de tonos de models.js no los junte.
export const ERA_PALETTES = {
  madera: { plank: '#a8774a', plankD: '#86592f', joint: '#5e3f24', thatch: '#d9b46a', thatchD: '#b8913f', shingle: '#7a5a3a',
    stone: '#9b9286', stoneD: '#7b7266', moss: '#6f8a4f', post: '#6e4a2c', light: '#e9d6b0' },
  piedra: { stone: '#a49b8c', stoneD: '#857b6c', stoneL: '#c4bba9', joint: '#6f675c', slate: '#5d6878', slateD: '#47505e',
    beam: '#5a4632', light: '#e4dccb' },
  ladrillo: { brick: '#b5603f', brickD: '#94492e', joint: '#e6d8c3', tile: '#a8492f', tileD: '#86361f', frame: '#3f5e4a',
    cream: '#efe3cc', creamD: '#d5c4a4', iron: '#3b3634' },
  hierro: { iron: '#6b7077', ironD: '#50555b', rust: '#9a5a3a', black: '#2f2b2a', sheet: '#8d949a', sheetD: '#6f767d',
    lamp: '#f2c45a', brick: '#8f5a44', light: '#d6d2c8' },
  vidrio: { steel: '#c7ccd1', steelD: '#9aa1a8', glass: '#8fc1d0', glassD: '#6aa3b8', white: '#f2f0ea', terrace: '#79a35a',
    terraceD: '#5c8545', panel: '#3e5a7a', light: '#ffffff' },
};
