// Árbol de habilidades (PLAN-FOTO, paso A3): el motor. Puro: sin DOM, sin store ni bus (se importa desde Node).
// Los puntos salen de la veta que deja cada pelea (state.tree.xp): no se compran ni dependen del Nivel. Un nodo se toma
// si queda un punto y ya se tiene alguno de los que pide; el reinicio devuelve todos los puntos.
//
// state.tree = { v: 1, xp, nodes: [ids], resets }   (se completa solo: una partida vieja arranca con el árbol vacío)
import { TREE, TREE_IDS, TREE_NODES, TREE_NEED } from './tree-data.js';
import { ABILITIES } from '../combat/combat-data.js';
import { t } from './i18n.js';

export const TXT = {
  get noPoints() { return t('tree.noPoints'); }, get taken() { return t('tree.taken'); },
  get locked() { return t('tree.locked'); }, get unknown() { return t('tree.unknown'); },
};
/** El texto de un efecto ("+1 de daño a los golpes básicos"). Lo usan los rasgos, los nodos y las reliquias. */
export const fxText = (e) => t(`loot.fx.${e.id}`, { v: Math.abs(e.v), skill: e.skill ? ABILITIES[e.skill]?.name || e.skill : '' });
export const nodeName = (n) => (n.key ? t(`tree.key.${n.id}.name`) : t(`tree.branch.${n.branch}`));
export const nodeText = (n) => {
  if (n.key) return t(`tree.key.${n.id}.text`);
  const s = n.fx.map(fxText).join(' ');
  return n.who === 'lider' ? t('tree.onlyLeader', { text: s }) : s;
};

/** Completa state.tree (idempotente). */
export function treeState(state) {
  if (!state.tree || typeof state.tree !== 'object') state.tree = {};
  const s = state.tree;
  s.v = 1;
  s.xp = Math.max(0, Math.round(Number(s.xp) || 0));
  s.nodes = [...new Set((Array.isArray(s.nodes) ? s.nodes : []).filter(id => TREE[id]))];
  s.resets = Math.max(0, s.resets | 0);
  // un guardado tocado a mano no puede tener más nodos que puntos, ni nodos sueltos: se devuelve todo
  if (s.nodes.length > pointsFromXp(s.xp) || !connected(s.nodes)) s.nodes = [];
  return s;
}
/** ¿Cada nodo tiene su requisito dentro del conjunto? (se arma desde los arranques) */
function connected(nodes) {
  const have = new Set();
  let grew = true;
  while (grew) {
    grew = false;
    for (const id of nodes) {
      if (have.has(id)) continue;
      const n = TREE[id];
      if (!n.req.length || n.req.some(r => have.has(r))) { have.add(id); grew = true; }
    }
  }
  return have.size === nodes.length;
}
/** Puntos ganados con esa veta (tope: un punto por nodo). */
export function pointsFromXp(xp = 0) {
  let n = 0, left = xp || 0;
  while (n < TREE_IDS.length && left >= TREE_NEED(n)) { left -= TREE_NEED(n); n++; }
  return n;
}
/** { points, spent, free, into, need, max } */
export function treeInfo(state) {
  const s = treeState(state);
  const points = pointsFromXp(s.xp);
  let base = 0; for (let i = 0; i < points; i++) base += TREE_NEED(i);
  const max = points >= TREE_IDS.length;
  return { points, spent: s.nodes.length, free: points - s.nodes.length, into: max ? 0 : s.xp - base, need: max ? 0 : TREE_NEED(points), max };
}
export const hasNode = (state, id) => treeState(state).nodes.includes(id);
/** ¿Está a mano? (es un arranque o ya se tiene alguno de los que pide) */
export function reachableNode(state, id) {
  const n = TREE[id];
  if (!n) return false;
  const have = treeState(state).nodes;
  return !n.req.length || n.req.some(r => have.includes(r));
}
/** { ok, why } */
export function canTake(state, id) {
  if (!TREE[id]) return { ok: false, why: TXT.unknown };
  if (hasNode(state, id)) return { ok: false, why: TXT.taken };
  if (!reachableNode(state, id)) return { ok: false, why: TXT.locked };
  if (treeInfo(state).free < 1) return { ok: false, why: TXT.noPoints };
  return { ok: true };
}
export function takeNode(state, id) {
  const c = canTake(state, id);
  if (!c.ok) return c;
  treeState(state).nodes.push(id);
  return { ok: true, node: TREE[id] };
}
/** Reinicio: devuelve todos los puntos. → { ok, refunded } */
export function resetTree(state) {
  const s = treeState(state);
  const refunded = s.nodes.length;
  s.nodes = [];
  if (refunded) s.resets++;
  return { ok: refunded > 0, refunded };
}
/** Suma veta. → { from, to } si ganó puntos, o null. */
export function addTreeXp(state, xp) {
  const s = treeState(state);
  const n = Math.max(0, Math.round(xp || 0));
  if (!n) return null;
  const from = pointsFromXp(s.xp);
  s.xp += n;
  const to = pointsFromXp(s.xp);
  return to > from ? { from, to } : null;
}
/** Lo que da el árbol: { fx: [{ id, v, who }], rules: [..], loot: [..], keys: [ids] } (lo combina src/core/loot.js). */
export function treeEffects(state) {
  const out = { fx: [], rules: [], loot: [], keys: [] };
  for (const id of treeState(state).nodes) {
    const n = TREE[id];
    for (const f of n.fx) out.fx.push({ ...f, who: n.who });
    if (n.rules) out.rules.push(n.rules);
    if (n.loot) out.loot.push(n.loot);
    if (n.key) out.keys.push(id);
  }
  return out;
}
/** Para la pantalla: cada nodo con su estado ('taken' | 'open' | 'locked'). */
export function treeView(state) {
  const info = treeInfo(state);
  return { ...info, nodes: TREE_NODES.map(n => ({ ...n, state: hasNode(state, n.id) ? 'taken' : reachableNode(state, n.id) ? 'open' : 'locked', name: nodeName(n), text: nodeText(n) })) };
}
