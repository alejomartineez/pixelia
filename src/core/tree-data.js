// Árbol de habilidades (PLAN-FOTO, paso A3): los datos. La porción vertical trae un tercio del árbol: 27 nodos en tres
// ramas (Filo, Guardia y Rastro) y 3 nodos clave que cambian reglas. El motor es src/core/tree.js; los efectos son los
// FX de src/core/loot-data.js y valen para todo el grupo (who: 'lider' = solo el líder).
//
// Cada nodo: { id, branch, x, y (lugar en la pantalla, en casillas), req: [ids] (alcanza con tener UNO; vacío = arranque
// de la rama), fx: [{ id, v }], who, key (nodo clave), rules (reglas del combate), loot (reglas del botín) }.

/** Una rama con la misma forma: 1 → (2 | 3) → 4 → (5 | 6) → 7 → (8, clave). c: la columna del centro. */
function branch(id, c, fx, key) {
  const n = (i) => `${id}${i}`;
  const at = [[c, 0], [c - 1, 1], [c + 1, 1], [c, 2], [c - 1, 3], [c + 1, 3], [c, 4], [c - 1, 5]];
  const req = [[], [n(1)], [n(1)], [n(2), n(3)], [n(4)], [n(4)], [n(5), n(6)], [n(7)]];
  const out = fx.map((f, i) => ({ id: n(i + 1), branch: id, x: at[i][0], y: at[i][1], req: req[i], fx: [{ id: f[0], v: f[1] }], who: f[2] || 'all' }));
  out.push({ branch: id, x: c + 1, y: 5, req: [n(7)], key: true, fx: [], who: 'all', ...key });
  return out;
}

export const TREE_BRANCHES = ['filo', 'guardia', 'rastro'];
export const TREE_NODES = [
  ...branch('filo', 1, [
    ['peso', 1], ['marca', 1], ['alcance', 1], ['presteza', 1], ['empuje', 1], ['cepo', 1], ['filo', 1], ['ataque', 1, 'lider'],
  ], { id: 'juramento', fx: [{ id: 'ataque', v: 1 }], rules: { noHeal: true } }),
  ...branch('guardia', 5, [
    ['vida', 1], ['venda', 1], ['amparo', 1], ['vida', 2], ['calma', 1], ['puntal', 1], ['ronda', 1], ['coraza', 1, 'lider'],
  ], { id: 'fila_cerrada', fx: [{ id: 'paso', v: -1 }], rules: { closeRank: 1 } }),
  ...branch('rastro', 9, [
    ['hallazgo', 5], ['veta', 10], ['rapina', 1], ['calidad', 5], ['temple', 20], ['vigia', 1], ['hallazgo', 8], ['acopio', 1],
  ], { id: 'marea_adentro', rules: { foeHp: 1.25 }, loot: { sure: true, quality: 20 } }),
];
export const TREE = Object.fromEntries(TREE_NODES.map(n => [n.id, n]));
export const TREE_IDS = TREE_NODES.map(n => n.id);
export const TREE_KEYS = TREE_NODES.filter(n => n.key).map(n => n.id);
/** Tamaño de la grilla de la pantalla. */
export const TREE_SIZE = { w: 11, h: 6 };
/** Experiencia de veta que pide cada punto: el primero 30 y cada uno 12 más que el anterior. */
export const TREE_NEED = (n) => 30 + 12 * n;
