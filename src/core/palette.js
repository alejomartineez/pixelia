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
