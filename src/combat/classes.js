// Clases, subclases y niveles (El Quiebre, paso 5b: M3 y L5 de docs/PLAN-QUIEBRE.md; DESIGN-COMBAT.md §14).
// Puro: sin DOM, sin store ni bus (se importa desde Node y desde combat-rules). El estado de la partida (experiencia,
// elecciones, subclase) lo maneja src/core/classes.js; la migración de los roles viejos, src/core/classes-migrate.js.
//
// - 6 clases base. Reemplazan a los 5 roles de la expedición (ROLE_CLASS) y suman al Guerrero.
// - Cada integrante tiene clase y nivel de clase (1..10, CLASS_XP). El nivel da vida y ataque, abre las habilidades del
//   grupo de 4 (POOL_UNLOCK: se eligen 2) y las pasivas (niveles 1, 5 y 9).
// - El líder tiene nivel 1..30 (LEADER). Su clase sube sola con ese nivel (LEADER.classLevel), y los niveles clave
//   abren espacios de habilidad (LEADER.slots). Con un elemento descubierto tiene la subclase de su clase con ese
//   elemento (SUBCLASSES): 2 habilidades y una pasiva. Sin clase elegida (partida vieja o nueva, antes de la segunda
//   parte del 5b), pelea como antes: Golpe y las habilidades del elemento (COMBAT.leader.slots).
import { COMBAT, UNITS, ABILITIES, ELEMENTS, CLASS_IDS } from './combat-data.js';

export { CLASS_IDS };
/** Rol viejo de la expedición → clase (la migración y quien reciba datos viejos). */
export const ROLE_CLASS = { exploracion: 'cazador', ingenieria: 'forjador', sanidad: 'curandero', guia: 'monje', recoleccion: 'saqueador' };
export const toClass = (id) => ROLE_CLASS[id] || id;

/**
 * Clases. basic: ataque básico. pool: las 4 habilidades elegibles (se abren con POOL_UNLOCK; las 2 primeras son el kit
 * por defecto). passives: { lv, id, name, text, ...efecto } con efecto hp | atk | mv | armor | flag (ver PASSIVE_FLAGS).
 */
export const CLASSES = {
  guerrero: {
    id: 'guerrero', name: 'Guerrero', basic: 'golpe', pool: ['tajo', 'guardia', 'embestida', 'aguante'],
    combat: 'Primera línea: aguanta y protege.', exp: 'Abre paso por la fuerza.',
    passives: [
      { lv: 1, id: 'coraza', name: 'Coraza', text: 'Recibe 1 menos de cada golpe.', armor: 1 },
      { lv: 5, id: 'protector', name: 'Protector', text: 'Los del grupo que están a su lado reciben 1 menos.', flag: 'guardAdj' },
      { lv: 9, id: 'temple', name: 'Temple', text: '+3 de vida.', hp: 3 },
    ],
  },
  cazador: {
    id: 'cazador', name: 'Cazador', basic: 'tiro', pool: ['marcar', 'tiro_pie', 'certero', 'lazo'],
    combat: 'A distancia y marcar.', exp: 'Ve más y evita peligros.',
    passives: [
      { lv: 1, id: 'rastreador', name: 'Rastreador', text: 'Se ve la intención de un enemigo más.', flag: 'intentPlus' },
      { lv: 5, id: 'ojo_fino', name: 'Ojo fino', text: 'Sus marcas hacen +1.', flag: 'markPlus' },
      { lv: 9, id: 'pulso', name: 'Pulso', text: '+1 de ataque.', atk: 1 },
    ],
  },
  forjador: {
    id: 'forjador', name: 'Forjador', basic: 'golpe', pool: ['trampa', 'barrera', 'remache', 'cepo'],
    combat: 'Barreras y trampas.', exp: 'Cruza ríos y despeja derrumbes.',
    passives: [
      { lv: 1, id: 'oficio', name: 'Oficio', text: 'El Martillo mejora sus trampas y barreras.', flag: 'smith' },
      { lv: 5, id: 'filo', name: 'Filo', text: 'Sus trampas hacen +1.', flag: 'trapPlus' },
      { lv: 9, id: 'obra', name: 'Obra firme', text: 'Sus barreras duran 1 turno más.', flag: 'wallPlus' },
    ],
  },
  curandero: {
    id: 'curandero', name: 'Curandero', basic: 'golpe', pool: ['curar', 'aliento', 'vendaje', 'resguardo'],
    combat: 'Curar y proteger.', exp: 'Más ánimo y mejor descanso.',
    passives: [
      { lv: 1, id: 'botica', name: 'Botica', text: 'El Botiquín de Olga mejora sus curas.', flag: 'medic' },
      { lv: 5, id: 'mano_firme', name: 'Mano firme', text: 'Sus curas dan +1.', flag: 'healPlus' },
      { lv: 9, id: 'entereza', name: 'Entereza', text: '+2 de vida.', hp: 2 },
    ],
  },
  monje: {
    id: 'monje', name: 'Monje', basic: 'golpe', pool: ['empujar', 'relevo', 'esquivar', 'salto'],
    combat: 'Movimiento, empujar y esquivar.', exp: 'Trepa y sigue el camino.',
    passives: [
      { lv: 1, id: 'paso_libre', name: 'Paso libre', text: 'No se traba al lado de un enemigo.', flag: 'noStuck' },
      { lv: 5, id: 'calma', name: 'Calma', text: '+2 de vida.', hp: 2 },
      { lv: 9, id: 'viento', name: 'Pies de viento', text: '+1 de movimiento.', mv: 1 },
    ],
  },
  saqueador: {
    id: 'saqueador', name: 'Saqueador', basic: 'golpe', pool: ['romper', 'robar', 'rapina', 'humo'],
    combat: 'Robar y romper.', exp: 'Junta más en cada recurso.',
    passives: [
      { lv: 1, id: 'bolsillo', name: 'Bolsillo hondo', text: 'Al ganar, 1 material más.', flag: 'lootWin' },
      { lv: 5, id: 'oportunista', name: 'Oportunista', text: 'Cada enemigo que liquida suma 1 de botín.', flag: 'lootKill' },
      { lv: 9, id: 'muñeca', name: 'Muñeca', text: '+1 de ataque.', atk: 1 },
    ],
  },
};
/** Banderas de las pasivas que lee el motor (combat-rules): */
export const PASSIVE_FLAGS = ['noStuck', 'medic', 'smith', 'guardAdj', 'markPlus', 'trapPlus', 'wallPlus', 'healPlus', 'lootKill', 'lootWin', 'intentPlus'];

// ---------- nivel de clase (integrantes) ----------
export const CLASS_MAX = 10;
/**
 * Experiencia total para llegar a cada nivel de clase (índice = nivel − 1). Paso 5b, cuarta parte: la curva de antes
 * (CLASS_XP_V1) dejaba a las clases de la ciudad en 10/10/9 en el rango 6; con esta quedan cerca de 5/4/3 al llegar a
 * la Costa y el 10 queda para los actos que vienen (DESIGN-COMBAT §14.2).
 */
export const CLASS_XP = [0, 200, 600, 1200, 2000, 3000, 4200, 5600, 7200, 9000];
/** La curva de antes del paso 5b, cuarta parte: los guardados que la usaban se pasan con remapClassXp. */
export const CLASS_XP_V1 = [0, 30, 80, 150, 240, 350, 480, 640, 830, 1050];
/** Versión de la curva (state.classes.curve). */
export const CLASS_CURVE = 2;
/** Experiencia de la curva vieja → la nueva, con el mismo nivel y lo mismo juntado dentro del nivel (nadie baja). */
export function remapClassXp(xp = 0) {
  const x = Math.max(0, Number(xp) || 0);
  let lv = 1;
  while (lv < CLASS_MAX && x >= CLASS_XP_V1[lv]) lv++;
  if (lv >= CLASS_MAX) return CLASS_XP[CLASS_MAX - 1] + (x - CLASS_XP_V1[CLASS_MAX - 1]);
  const f = (x - CLASS_XP_V1[lv - 1]) / (CLASS_XP_V1[lv] - CLASS_XP_V1[lv - 1]);
  return Math.round(CLASS_XP[lv - 1] + f * (CLASS_XP[lv] - CLASS_XP[lv - 1]));
}
/** Nivel de clase que abre cada habilidad del grupo de 4 (las 2 primeras vienen de entrada). */
export const POOL_UNLOCK = [1, 1, 3, 6];
/** Experiencia de clase: la pelea da su xp a cada integrante que peleó; la salida, `expedition` × la xp de la salida. */
export const CLASS_GAIN = { expedition: 1 };
/** Nivel de clase con esa experiencia (con tope: el edificio que la entrena deja llegar hasta 2 × su nivel). */
export function classLevelFromXp(xp = 0, cap = CLASS_MAX) {
  let lv = 1;
  while (lv < CLASS_MAX && (xp || 0) >= CLASS_XP[lv]) lv++;
  return Math.max(1, Math.min(lv, cap || 1));
}
/** { level, xp, into, need, max }: into = lo juntado en el nivel, need = lo que pide el nivel (0 en el tope). */
export function classXpInfo(xp = 0, cap = CLASS_MAX) {
  const level = classLevelFromXp(xp, cap);
  const max = level >= Math.min(CLASS_MAX, cap);
  const base = CLASS_XP[level - 1];
  return { level, xp, into: max ? 0 : xp - base, need: max ? 0 : CLASS_XP[level] - base, max };
}
/** Experiencia mínima para tener un nivel de clase (la migración la usa). */
export const classXpFor = (level) => CLASS_XP[Math.max(1, Math.min(CLASS_MAX, level | 0)) - 1];

// ---------- nivel del líder (L5) ----------
export const LEADER = {
  max: 30,
  /** Experiencia que pide pasar del nivel n al n + 1. */
  need: (n) => 100 + 50 * (n - 1),
  /** Nivel de clase del líder: sube solo con su nivel (1, 4, 7, … → 1, 2, 3, …; tope 10 en el 28). */
  classLevel: (lv) => Math.min(CLASS_MAX, 1 + Math.floor((Math.max(1, lv) - 1) / 3)),
  /** Niveles clave: abren espacios de habilidad. clase: habilidades de su clase; sub: de su subclase; subPassive. */
  slots: { clase: [6, 12], sub: [1, 5], subPassive: 8 },
  /** Niveles clave que quedan para los actos 2 a 4 (otro elemento y habilidades del equipo). */
  reserved: [15, 20, 25, 30],
  /** De dónde sale la experiencia. fight: la xp de la pelea entera; expedition: × la xp de la salida; threat: base + por %. */
  gain: { expedition: 0.5, threat: { base: 10, perPct: 0.1 } },
  /** Bonus chico por nivel en la expedición: +1 de ánimo máximo cada 10 niveles. */
  moraleEvery: 10,
  /**
   * Quien lidera y pega a distancia (el Cazador) recibe el ataque por nivel 6 niveles después: +1 en el 10 y +2 en el 16,
   * en vez del 4 y el 10. Pega seguro desde lejos, y con el ataque de los demás llegaba a 36 % del daño (DESIGN-COMBAT §8,
   * paso 5b cuarta parte).
   */
  rangedAtkDelay: 6,
};
/** Nivel del líder con la curva vieja (100 + 50 por nivel, tope 30): solo para la migración v7. */
export function leaderLevelV6(xp = 0) {
  let lv = 1, acc = 0;
  while (lv < LEADER.max && (xp || 0) >= acc + LEADER.need(lv)) { acc += LEADER.need(lv); lv++; }
  return lv;
}

// ---------- el Nivel (La Travesía, paso 2a) ----------
/**
 * Un solo Nivel de jugador (1..50). Sube con todo: la ciudad (store.addXp), las peleas, las salidas y las amenazas
 * (grantLeaderXp × NIVEL.fightRate). La curva es la del nivel de la ciudad de antes, así los rangos llegan igual.
 * El combate no usa el Nivel crudo: usa combatLevel(Nivel), la escala del líder de antes (LEADER, 1..30), para que cada
 * pelea del Acto 1 quede como estaba balanceada. Pasado el 50, la experiencia sigue juntando puntos de paragon.
 */
export const NIVEL = {
  max: 50,
  /**
   * Experiencia que pide pasar del Nivel n al n + 1: la curva del nivel de la ciudad de antes del v7 (40·n^1,55 + 20)
   * con exponente 1,6 desde el balance del 2a (sim:economy): con la experiencia de las peleas sumada, el Nivel 18
   * llegaba el día 15–16 y el rango 5 antes del día 18. En total pide 7 % más hasta el Nivel 7, 13 % más hasta el 18
   * y 15 % más hasta el 26.
   */
  need: (n) => Math.round(40 * Math.pow(n, 1.6) + 20),
  /** Las peleas, salidas y amenazas daban xp en la escala chica del líder: se multiplica al pasar al Nivel. */
  fightRate: 2,
  /** Experiencia por punto de paragon pasado el Nivel 50. */
  paragonStep: 8000,
  /** Niveles que quedan para los actos 2 a 4 (otro elemento y habilidades del equipo). */
  reserved: [30, 36, 42, 48],
};
let nivelTable = null;
/** Experiencia total para llegar a un Nivel. */
export function leaderXpFor(level) {
  if (!nivelTable) { nivelTable = [0, 0]; for (let n = 1; n < NIVEL.max; n++) nivelTable.push(nivelTable[n] + NIVEL.need(n)); }
  return nivelTable[Math.max(1, Math.min(NIVEL.max, level | 0))];
}
export function leaderLevelFromXp(xp = 0) {
  let lv = 1;
  while (lv < NIVEL.max && (xp || 0) >= leaderXpFor(lv + 1)) lv++;
  return lv;
}
/** Puntos de paragon: uno cada NIVEL.paragonStep de experiencia pasado el Nivel 50. */
export const paragonPoints = (xp = 0) => Math.max(0, Math.floor(((xp || 0) - leaderXpFor(NIVEL.max)) / NIVEL.paragonStep));
/** Nivel de combate del líder (la escala de LEADER, 1..30) que corresponde a un Nivel: 4 → 1, 18 → 5, 32 → 9, 50 → 14. */
export const combatLevel = (nivel) => Math.max(1, Math.min(LEADER.max, Math.round(((nivel | 0 || 1) + 0.5) / 3.5)));
/** El Nivel más bajo con ese nivel de combate (para decir "abre en el Nivel N"). */
export function nivelFor(clv) {
  for (let n = 1; n <= NIVEL.max; n++) if (combatLevel(n) >= clv) return n;
  return NIVEL.max;
}
/** { level, xp, into, need, max, next, paragon, paragonInto, paragonNeed } — next: el próximo Nivel clave y lo que abre. */
export function leaderXpInfo(xp = 0) {
  const level = leaderLevelFromXp(xp);
  const max = level >= NIVEL.max;
  const base = leaderXpFor(level);
  const over = max ? Math.max(0, xp - base) : 0;
  return { level, xp, into: max ? 0 : xp - base, need: max ? 0 : NIVEL.need(level), max, next: nextKeyLevel(level),
    combat: combatLevel(level), paragon: paragonPoints(xp), paragonInto: over % NIVEL.paragonStep, paragonNeed: NIVEL.paragonStep };
}
/** Lo que da cada nivel del líder (combate): vida y ataque (COMBAT.leader) y lo que abre. */
export function leaderPerks(level) {
  const s = LEADER.slots;
  return {
    hp: COMBAT.leader.hp(level), atk: COMBAT.leader.atk(level), classLevel: LEADER.classLevel(level),
    classSlots: s.clase.filter(l => level >= l).length, subSlots: s.sub.filter(l => level >= l).length,
    subPassive: level >= s.subPassive, morale: Math.floor(level / LEADER.moraleEvery),
  };
}
/** Próximo Nivel clave (los espacios de LEADER.slots pasados a Nivel con nivelFor). */
function nextKeyLevel(level) {
  const keys = [...LEADER.slots.clase.map(l => [nivelFor(l), 'una habilidad de clase']), ...LEADER.slots.sub.map(l => [nivelFor(l), 'una habilidad de subclase']),
    [nivelFor(LEADER.slots.subPassive), 'la pasiva de la subclase'], ...NIVEL.reserved.map(l => [l, 'un espacio para los actos que vienen'])]
    .filter(([l]) => l > level).sort((a, b) => a[0] - b[0]);
  return keys.length ? { level: keys[0][0], text: keys[0][1] } : null;
}

// ---------- subclases del líder ----------
/** Una por clase y elemento. Acto 1: las 6 de Raíz. Las de Marea, Brasa y Céfiro están diseñadas en DESIGN-COMBAT §14. */
export const SUBCLASSES = {
  guardian_raiz: { id: 'guardian_raiz', name: 'Guardián de Raíz', cls: 'guerrero', element: 'raiz', abilities: ['abrazo_raiz', 'muro_raiz'],
    passive: { id: 'corteza', name: 'Corteza', text: '+3 de vida.', hp: 3 }, text: 'Sostiene la línea con raíces.' },
  acechador_raiz: { id: 'acechador_raiz', name: 'Acechador de Raíz', cls: 'cazador', element: 'raiz', abilities: ['espina', 'enredar'],
    passive: { id: 'ojos_raiz', name: 'Ojos de raíz', text: 'Se ve la intención de un enemigo más.', flag: 'intentPlus' }, text: 'Las raíces le avisan quién se mueve.' },
  tejedor_raiz: { id: 'tejedor_raiz', name: 'Tejedor de Raíz', cls: 'forjador', element: 'raiz', abilities: ['zarza', 'muro_raiz'],
    passive: { id: 'trenzado', name: 'Trenzado', text: 'Sus paredes duran 1 turno más.', flag: 'wallPlus' }, text: 'Teje el campo a su favor.' },
  herbolario_raiz: { id: 'herbolario_raiz', name: 'Herbolario de Raíz', cls: 'curandero', element: 'raiz', abilities: ['savia', 'enredar'],
    passive: { id: 'brotes', name: 'Brotes', text: 'Sus curas dan +1.', flag: 'healPlus' }, text: 'La savia cura y la raíz frena.' },
  caminante_raiz: { id: 'caminante_raiz', name: 'Caminante de Raíz', cls: 'monje', element: 'raiz', abilities: ['brote', 'enredar'],
    passive: { id: 'raiz_ligera', name: 'Raíz ligera', text: '+1 de movimiento.', mv: 1 }, text: 'Va y viene dejando raíces.' },
  furtivo_raiz: { id: 'furtivo_raiz', name: 'Furtivo de Raíz', cls: 'saqueador', element: 'raiz', abilities: ['zarpa_raiz', 'muro_raiz'],
    passive: { id: 'raiz_codiciosa', name: 'Raíz codiciosa', text: 'Al ganar, 1 material más.', flag: 'lootWin' }, text: 'Saca y se esconde detrás de la raíz.' },
};
export const SUBCLASS_IDS = Object.keys(SUBCLASSES);
export const subclassFor = (cls, element) => SUBCLASS_IDS.map(id => SUBCLASSES[id]).find(s => s.cls === cls && s.element === element) || null;
/** Subclases que puede usar un líder de esa clase con esos elementos. */
export const availableSubclasses = (cls, elements = []) => SUBCLASS_IDS.map(id => SUBCLASSES[id]).filter(s => s.cls === cls && elements.includes(s.element));
/** La subclase que vale: la elegida si se puede, si no la del primer elemento que tenga (o null). */
export function resolveSubclass(cls, sub, elements = []) {
  const av = availableSubclasses(cls, elements);
  return av.find(s => s.id === sub) || av[0] || null;
}

// ---------- kits ----------
/** Habilidades del grupo de 4 abiertas con ese nivel de clase. */
export const unlockedPool = (cls, level) => (CLASSES[cls]?.pool || []).filter((_, i) => level >= POOL_UNLOCK[i]);
/** Las 2 activas elegidas (válidas y abiertas); completa con las primeras del grupo. n: cuántas entran. */
export function validPicks(cls, level, picks = [], n = 2) {
  const open = unlockedPool(cls, level);
  const out = [...new Set((picks || []).filter(id => open.includes(id)))].slice(0, n);
  for (const id of open) { if (out.length >= n) break; if (!out.includes(id)) out.push(id); }
  return out;
}
export const classPassives = (cls, level) => (CLASSES[cls]?.passives || []).filter(p => level >= p.lv);
function applyPassives(kit, list) {
  for (const p of list) {
    kit.hp += p.hp || 0; kit.atk += p.atk || 0; kit.mv += p.mv || 0; kit.armor += p.armor || 0;
    if (p.flag) kit.flags[p.flag] = (kit.flags[p.flag] || 0) + 1;
    kit.passives.push(p.id);
  }
  return kit;
}
/** Kit de un integrante: { cls, level, hp, mv, atk, armor, abilities, flags, passives }. */
export function memberKit(cls, level = 1, picks = []) {
  const C = CLASSES[cls], U = UNITS[cls];
  if (!C || !U) return null;
  const lv = Math.max(1, Math.min(CLASS_MAX, level | 0 || 1));
  const kit = {
    cls, level: lv, hp: U.hp + Math.floor((lv - 1) / COMBAT.classLevel.hpEvery), mv: U.mv,
    atk: U.atk + Math.floor((lv - 1) / COMBAT.classLevel.atkEvery), armor: 0,
    abilities: [C.basic, ...validPicks(cls, lv, picks)], flags: {}, passives: [],
  };
  return applyPassives(kit, classPassives(cls, lv));
}
/**
 * Kit del líder: { cls, sub, level, classLevel, hp, mv, atk, armor, abilities, flags, passives }.
 * Sin clase: Golpe y las habilidades del elemento por COMBAT.leader.slots (como antes del 5b).
 */
export function leaderKit({ cls = null, sub = null, level = 1, picks = [], element = null, elements = null } = {}) {
  const lv = Math.max(1, Math.min(LEADER.max, level | 0 || 1));
  const els = elements || (element ? [element] : []);
  const L = UNITS.lider;
  const perks = leaderPerks(lv);
  const base = { cls: null, sub: null, level: lv, classLevel: 0, hp: L.hp + perks.hp, mv: L.mv, atk: L.atk + perks.atk, armor: 0, abilities: ['golpe'], flags: {}, passives: [] };
  if (!CLASSES[cls]) {
    const el = els.find(id => ELEMENTS[id]);
    if (el) base.abilities.push(...ELEMENTS[el].abilities.slice(0, COMBAT.leader.slots.filter(s => lv >= s).length));
    return base;
  }
  const C = CLASSES[cls], U = UNITS[cls];
  const cl = perks.classLevel;
  const atkUp = ABILITIES[C.basic]?.ranged ? COMBAT.leader.atk(Math.max(1, lv - LEADER.rangedAtkDelay)) : perks.atk;
  const kit = { ...base, cls, classLevel: cl, hp: base.hp + (U.hp - 10), mv: U.mv, atk: Math.max(2, U.atk) + atkUp, abilities: [C.basic, ...validPicks(cls, cl, picks, perks.classSlots)] };
  applyPassives(kit, classPassives(cls, cl));
  const S = resolveSubclass(cls, sub, els);
  if (S) {
    kit.sub = S.id;
    for (const id of S.abilities.slice(0, perks.subSlots)) if (!kit.abilities.includes(id)) kit.abilities.push(id);
    if (perks.subPassive) applyPassives(kit, [S.passive]);
  }
  return kit;
}
/** Todas las habilidades que usa el sistema de clases existen en ABILITIES (lo chequean los tests). */
export function missingAbilities() {
  const ids = [...Object.values(CLASSES).flatMap(c => [c.basic, ...c.pool]), ...Object.values(SUBCLASSES).flatMap(s => s.abilities)];
  return ids.filter(id => !ABILITIES[id]);
}
