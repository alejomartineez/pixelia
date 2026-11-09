// Migración de los roles de la expedición a las clases (El Quiebre, paso 5b; DESIGN-COMBAT.md §14.8). Pura: trabaja
// sobre el save crudo (antes de deepFill) y no usa store ni bus. La llama migrate() de src/core/state.js en cada carga;
// corre una sola vez (state.classes.v), sin depender de la versión del guardado.
//
// 1. Cada integrante queda con la clase de su rol (ROLE_CLASS) y con la experiencia del nivel de clase que equivale al
//    nivel de su edificio (2 × nivel − 1): en combate pega y aguanta lo mismo que antes.
// 2. El líder junta la experiencia que ya tenía: la de las peleas (state.combat.xp), más la de las salidas y las
//    amenazas que ya hizo. Su clase queda sin elegir: la elige la primera vez que abre la ciudad (segunda parte del 5b).
// 3. Una salida o una pelea guardadas a medias pasan sus roles a clases (el grupo, la escolta, los niveles y las
//    unidades de la pelea, con sus pasivas de nivel 1).
import { ROLE_CLASS, toClass, classXpFor, LEADER, CLASS_IDS, CLASS_CURVE } from '../combat/classes.js';

const BUILDING = { cazador: 'casa_exp', forjador: 'taller', monje: 'establo', curandero: 'dispensario', saqueador: 'huerta', guerrero: 'casa_exp' };
const BUILDING_MIN = { guerrero: 2 };
/** Lo que vale cada salida y cada amenaza que ya se hizo, para el nivel del líder (aprox. a lo que dan hoy). */
export const MIGRATE_XP = { expedition: 30, threat: 20 };
/** Pasivas de nivel 1 que una unidad vieja de la pelea tenía como regla del rol. */
const OLD_FLAGS = { monje: { noStuck: 1 }, curandero: { medic: 1 }, forjador: { smith: 1 } };

const mapKeys = (o) => (o && typeof o === 'object' ? Object.fromEntries(Object.entries(o).map(([k, v]) => [toClass(k), v])) : o);
const mapList = (a) => (Array.isArray(a) ? [...new Set(a.map(toClass))] : a);

function buildingLevel(s, id) {
  let lv = 0;
  for (const b of s.city?.buildings || []) if (b && b.id === id) lv = Math.max(lv, b.level || 1);
  return lv;
}

/** Pasa una pelea guardada (combat-rules) de roles a clases. */
export function migrateBattle(b) {
  if (!b || typeof b !== 'object' || !Array.isArray(b.units)) return b;
  for (const u of b.units) {
    if (u.side !== 'ally' || !ROLE_CLASS[u.type]) continue;
    u.type = ROLE_CLASS[u.type];
    u.cls = u.type;
    u.f = { ...(OLD_FLAGS[u.type] || {}), ...(u.f || {}) };
  }
  if (b.stats) { b.stats.dmg = mapKeys(b.stats.dmg) || {}; b.stats.kills = mapKeys(b.stats.kills) || {}; }
  for (const t of b.traps || []) t.by = toClass(t.by);
  for (const w of b.walls || []) w.by = toClass(w.by);
  return b;
}
/** Pasa una salida guardada (exp-rules) de roles a clases. */
export function migrateRun(run) {
  if (!run || typeof run !== 'object') return run;
  run.party = mapList(run.party) || [];
  if (run.roleLevel && !run.tier) run.tier = mapKeys(run.roleLevel);
  delete run.roleLevel;
  if (run.mods && typeof run.mods === 'object') {
    if (run.mods.roleLevel && !run.mods.tier) run.mods.tier = mapKeys(run.mods.roleLevel);
    delete run.mods.roleLevel;
    if (run.mods.escort) run.mods.escort = mapList(run.mods.escort);
  }
  if (run.battle) migrateBattle(run.battle);
  return run;
}

/** Idempotente: si state.classes ya existe, no hace nada. Devuelve el save. */
export function migrateClasses(s) {
  if (!s || typeof s !== 'object' || (s.classes && s.classes.v >= 1)) return s;
  const members = {};
  for (const cls of CLASS_IDS) {
    const tier = Math.max(0, buildingLevel(s, BUILDING[cls]) - ((BUILDING_MIN[cls] || 1) - 1));
    members[cls] = { xp: tier ? classXpFor(2 * Math.min(5, tier) - 1) : 0, picks: [] };
  }
  const st = s.stats || {};
  const xp = Math.max(0, Number(s.combat?.xp) || 0) + MIGRATE_XP.expedition * Math.max(0, st.expeditions || 0) + MIGRATE_XP.threat * Math.max(0, st.threats || 0);
  s.classes = { v: 1, curve: CLASS_CURVE, leader: { cls: null, sub: null, xp: Math.round(xp), picks: [] }, members, migrated: { from: 'roles', at: Date.now(), maxLevel: LEADER.max } };
  const e = s.expedition;
  if (e && typeof e === 'object') {
    if (Array.isArray(e.party)) e.party = mapList(e.party);
    if (e.tired && typeof e.tired === 'object') e.tired = mapKeys(e.tired);
    if (e.active) migrateRun(e.active);
  }
  return s;
}
