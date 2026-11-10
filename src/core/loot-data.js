// Botín y construcción de personaje (PLAN-FOTO, paso A3): las tablas. Solo datos, sin i18n ni estado; el motor es
// src/core/loot.js y los textos están en src/i18n/es.js (loot.fx.<id>, relic.<id>.name y .text).
//
// Todo lo que cambia una pelea se escribe con los mismos EFECTOS (FX): los usan los rasgos de las armas, los nodos del
// árbol (src/core/tree-data.js) y las reliquias de salida. Un efecto con valor v es una de estas cosas:
//   stat      suma v a la vida, el ataque, la coraza o el movimiento
//   flag      suma v a una pasiva del combate (PASSIVE_FLAGS de src/combat/classes.js)
//   abil      cambia las habilidades que cumplen `match` (mod: plus, dmg, cd, range, heal, root, turns, cover, radius)
//   loot      mejora el botín (find, quality, veta y mastery van en puntos de porcentaje; mats en unidades)
//   affinity  +1 de daño con las habilidades de ese elemento
//   skill     presta una habilidad de más (el rasgo guarda cuál)
// pw: cuánto pesa cada punto de v en la fuerza del objeto (la misma escala que weaponPower de arsenal.js).

const ATTACKS = ['attack', 'push', 'disarm', 'root', 'mark'];
const SUPPORT = ['heal', 'healArea', 'cover', 'wall', 'trap', 'leap', 'swap', 'dazzle'];

export const FX = {
  filo: { abil: { basic: true }, mod: 'plus', pw: 40 },
  peso: { abil: { kind: ['attack'], cdMin: 1 }, mod: 'plus', pw: 22 },
  presteza: { abil: { kind: ATTACKS, cdMin: 2 }, mod: 'cd', sign: -1, pw: 28 },
  alcance: { abil: { kind: ['attack', 'root', 'mark'], ranged: true }, mod: 'range', pw: 22 },
  cepo: { abil: { kind: ['trap'] }, mod: 'dmg', pw: 12 },
  nudo: { abil: { kind: ['trap', 'root'] }, mod: 'root', pw: 12 },
  puntal: { abil: { kind: ['wall'] }, mod: 'turns', pw: 8 },
  venda: { abil: { kind: ['heal', 'healArea'] }, mod: 'heal', pw: 14 },
  amparo: { abil: { kind: ['cover'] }, mod: 'cover', pw: 14 },
  ronda: { abil: { kind: ['healArea', 'cover', 'dazzle'] }, mod: 'radius', pw: 12 },
  empuje: { abil: { kind: ['push'] }, mod: 'dmg', pw: 12 },
  calma: { abil: { kind: SUPPORT, cdMin: 2 }, mod: 'cd', sign: -1, pw: 18 },
  oficio: { abil: { cdMin: 2 }, mod: 'cd', sign: -1, pw: 30 },
  vida: { stat: 'hp', pw: 10 },
  ataque: { stat: 'atk', pw: 30 },
  coraza: { stat: 'armor', pw: 40 },
  paso: { stat: 'mv', pw: 25 },
  vigia: { flag: 'intentPlus', pw: 15 },
  marca: { flag: 'markPlus', pw: 15 },
  rapina: { flag: 'lootWin', pw: 15 },
  tala: { flag: 'lootKill', pw: 15 },
  hallazgo: { loot: 'find', pw: 2 },
  calidad: { loot: 'quality', pw: 2 },
  veta: { loot: 'veta', pw: 1 },
  temple: { loot: 'mastery', pw: 1 },
  acopio: { loot: 'mats', pw: 15 },
  afin_raiz: { affinity: 'raiz', pw: 20 },
  afin_marea: { affinity: 'marea', pw: 20 },
  afin_brasa: { affinity: 'brasa', pw: 20 },
  afin_cefiro: { affinity: 'cefiro', pw: 20 },
  tecnica: { skill: true, pw: 35 },
};
for (const [id, f] of Object.entries(FX)) f.id = id;
export const FX_IDS = Object.keys(FX);

/**
 * Rasgos al azar de las armas (de 1 a 4 según la rareza). w: peso en el sorteo. min: desde qué rareza sale. v: el valor
 * que puede tocar en cada Marea ([mín, máx] para la I, la II y la III). types: solo en esos tipos de arma.
 * skills (tecnica): la habilidad prestada, de otra arma.
 */
export const AFFIXES = {
  filo: { w: 8, min: 1, v: [[1, 1], [1, 1], [1, 2]] },
  peso: { w: 10, v: [[1, 1], [1, 2], [2, 3]] },
  presteza: { w: 6, min: 2, v: [[1, 1], [1, 1], [1, 1]] },
  alcance: { w: 7, v: [[1, 1], [1, 1], [1, 2]], types: ['arco'] },
  cepo: { w: 6, v: [[1, 1], [1, 2], [2, 3]], types: ['martillo'] },
  nudo: { w: 5, v: [[1, 1], [1, 1], [1, 2]], types: ['martillo', 'arco'] },
  puntal: { w: 5, v: [[1, 1], [1, 2], [2, 2]], types: ['martillo'] },
  venda: { w: 8, v: [[1, 1], [1, 2], [2, 3]], types: ['baston', 'escudo'] },
  amparo: { w: 7, v: [[1, 1], [1, 1], [1, 2]], types: ['espada', 'escudo', 'baston'] },
  ronda: { w: 4, min: 2, v: [[1, 1], [1, 1], [1, 1]], types: ['baston', 'escudo', 'espada'] },
  empuje: { w: 6, v: [[1, 1], [1, 2], [2, 3]], types: ['lanza', 'espada'] },
  calma: { w: 6, min: 1, v: [[1, 1], [1, 1], [1, 1]] },
  vida: { w: 12, v: [[1, 2], [2, 3], [3, 4]] },
  ataque: { w: 3, min: 3, v: [[1, 1], [1, 1], [1, 1]] },
  coraza: { w: 3, min: 3, v: [[1, 1], [1, 1], [1, 1]] },
  paso: { w: 4, min: 2, v: [[1, 1], [1, 1], [1, 1]] },
  vigia: { w: 5, v: [[1, 1], [1, 1], [1, 2]] },
  marca: { w: 5, v: [[1, 1], [1, 1], [1, 2]], types: ['arco', 'lanza'] },
  rapina: { w: 6, v: [[1, 1], [1, 1], [1, 2]] },
  tala: { w: 4, v: [[1, 1], [1, 1], [1, 1]], types: ['hacha'] },
  hallazgo: { w: 7, v: [[4, 6], [6, 9], [9, 12]] },
  calidad: { w: 5, min: 1, v: [[4, 6], [6, 9], [9, 12]] },
  veta: { w: 6, v: [[8, 12], [12, 18], [18, 25]] },
  temple: { w: 6, v: [[15, 25], [20, 30], [25, 40]] },
  afin_raiz: { w: 3, min: 2, v: [[1, 1], [1, 1], [1, 1]] },
  afin_marea: { w: 3, min: 2, v: [[1, 1], [1, 1], [1, 1]] },
  afin_brasa: { w: 3, min: 2, v: [[1, 1], [1, 1], [1, 1]] },
  afin_cefiro: { w: 3, min: 2, v: [[1, 1], [1, 1], [1, 1]] },
  tecnica: { w: 4, min: 2, v: [[1, 1], [1, 1], [1, 1]], skills: ['salto', 'aguante', 'humo', 'lazo', 'vendaje', 'relevo', 'marcar', 'esquivar'] },
};
for (const [id, a] of Object.entries(AFFIXES)) a.id = id;
export const AFFIX_IDS = Object.keys(AFFIXES);
/** Cuántos rasgos trae cada rareza (común … reliquia): [mín, máx]. */
export const AFFIX_COUNT = [[1, 1], [1, 2], [2, 3], [3, 4], [4, 4]];

/**
 * "Sos lo que llevás puesto": el arma define las habilidades activas. basic: el golpe de siempre. skills: las tres del
 * tipo, que abre la maestría (SKILL_AT); se llevan SKILL_SLOTS a la vez (state.arsenal.picks[quién] elige cuáles).
 */
export const WEAPON_SKILLS = {
  espada: { basic: 'golpe', skills: ['tajo', 'guardia', 'embestida'] },
  hacha: { basic: 'golpe', skills: ['rapina', 'tajo', 'romper'] },
  arco: { basic: 'tiro', skills: ['marcar', 'certero', 'tiro_pie'] },
  baston: { basic: 'golpe', skills: ['curar', 'esquivar', 'aliento'] },
  martillo: { basic: 'golpe', skills: ['remache', 'cepo', 'barrera'] },
  lanza: { basic: 'golpe', skills: ['empujar', 'salto', 'relevo'] },
  escudo: { basic: 'golpe', skills: ['guardia', 'resguardo', 'aguante'] },
};
export const SKILL_AT = [1, 1, 4];
export const SKILL_SLOTS = 2;

/**
 * Botín por Marea (I, II y III; el índice 0 no se usa). odds: chances de rareza en %. drop: chance de que una pelea
 * común deje un arma. count: cuántas deja un élite o un jefe. veta: experiencia del árbol que da cada pelea.
 */
export const LOOT = {
  odds: {
    pelea: [null, [62, 27, 8, 2.5, 0.5], [45, 33, 16, 5, 1], [30, 34, 24, 9, 3]],
    elite: [null, [25, 40, 25, 8, 2], [12, 36, 34, 14, 4], [0, 30, 40, 22, 8]],
    jefe: [null, [0, 45, 38, 14, 3], [0, 30, 42, 22, 6], [0, 15, 40, 32, 13]],
  },
  drop: [null, 0.45, 0.55, 0.65],
  count: { elite: [null, 1, 1, 2], jefe: [null, 1, 2, 2] },
  veta: { pelea: [null, 10, 16, 24], elite: [null, 20, 32, 48], jefe: [null, 40, 64, 96] },
  starVeta: [0, 0.8, 1, 1.2],
  starDrop: [0, 0, 0.05, 0.1],
  luck: { after: 8, min: 2 },      // tras 8 peleas seguidas sin un arma rara o mejor, la próxima lo es
};

/**
 * Reliquias de salida: se ganan en la Travesía (una a elegir entre tres) y duran esa salida. Cambian reglas.
 * fx: efectos para todo el grupo. rules: reglas del combate (newBattle({ rules })). loot: reglas del botín.
 * skillCap: cuántas habilidades del arma lleva cada uno.
 */
export const RELICS = {
  brasa_guardada: { rules: { startCover: 2 } },
  cuerno_roto: { rules: { foeHp: 0.85 } },
  piedra_de_afilar: { fx: [{ id: 'filo', v: 1 }] },
  vela_negra: { rules: { foeAtk: 1 }, loot: { mareaPlus: 1 } },
  bolsa_sin_fondo: { loot: { stack: 1, stackMax: 5 } },
  ojo_de_vidrio: { fx: [{ id: 'vigia', v: 9 }] },
  hueso_de_suerte: { fx: [{ id: 'calidad', v: 25 }] },
  reloj_parado: { rules: { maxTurns: 2 } },
  un_solo_oficio: { fx: [{ id: 'oficio', v: 1 }], skillCap: 1 },
  sangre_vieja: { rules: { killHeal: 1 } },
  raiz_seca: { fx: [{ id: 'cepo', v: 1 }, { id: 'puntal', v: 1 }, { id: 'nudo', v: 1 }] },
  moneda_marcada: { loot: { eliteAsBoss: true } },
  farol_de_proa: { fx: [{ id: 'vida', v: 2 }] },
  diente_de_bestia: { fx: [{ id: 'marca', v: 2 }] },
  espejo_roto: { loot: { mirror: true } },
};
for (const [id, r] of Object.entries(RELICS)) r.id = id;
export const RELIC_IDS = Object.keys(RELICS);
/** Cuántas reliquias se ofrecen cada vez y cuántas se pueden llevar en una salida. */
export const RELIC_OFFER = 3;
export const RELIC_MAX = 6;
