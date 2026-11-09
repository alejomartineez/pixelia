// Biblioteca de poses para las cinemáticas (PLAN-TRAVESIA §3a), sobre las partes del avatar (`userData.parts` de
// avatar.js: body, upper, head, armL, armR, legs…). Se aplican DESPUÉS de `userData.update(dt)` (que camina o respira):
// cada pose dice a qué ángulo va cada articulación y `applyPose` mezcla con lo que dejó el update según el peso w, así
// una pose entra y sale con suavidad (w de 0 a 1 y de vuelta).
//
//   applyPose(model, 'señalar', { w, t, side: 'R', look: 0.4 })   · poseNames · holdProp(model, prop, 'R') · dropProp
//   prop('cristal' | 'caja' | 'carta' | 'bolsa' | 'farol' | 'pala', { color })
//
// Convenciones del avatar: mira a +z; rotation.x negativa lleva el brazo (o la pierna) adelante; en rotation.z, afuera
// es + para el brazo derecho y − para el izquierdo. Las manos para la utilería son las de los ecos (story/echo-fx.js):
// un grupo en la punta del brazo, en las unidades del modelo.
import * as THREE from 'three';

const lerp = (a, b, u) => a + (b - a) * u;
const S = (side) => (side === 'L' ? -1 : 1);

/**
 * Cada pose: (u, o) → objetivos. u es el tiempo de la pose en segundos (o.t) para las que se mueven; o trae side
 * ('R' | 'L', el brazo que actúa), look (giro de la cabeza, rad) y p (avance 0..1 para caer y arrodillarse).
 * Claves: armR/armL { x, z }, upper { x, y }, head { x, y }, body { x, z, y (alto, en unidades del modelo) }, legs [x, x].
 */
const POSES = {
  // brazo extendido hacia adelante y un poco arriba; la cabeza acompaña
  señalar: (u, o) => ({ [arm(o)]: { x: -1.5, z: 0.08 * S(o.side) }, head: { x: -0.08, y: (o.look ?? 0) }, upper: { x: -0.04 } }),
  // las dos manos adelante y juntas, sosteniendo algo contra el pecho; el cuerpo un poco atrás por el peso
  cargar: () => ({ armR: { x: -0.95, z: -0.32 }, armL: { x: -0.95, z: 0.32 }, upper: { x: -0.1 }, head: { x: 0.12 } }),
  // inclinado adelante, brazos rectos al frente, empuje que late
  empujar: (u) => ({ armR: { x: -1.45, z: -0.12 }, armL: { x: -1.45, z: 0.12 }, upper: { x: 0.32 + Math.sin(u * 6) * 0.04 }, head: { x: -0.2 }, legs: [-0.45, 0.35] }),
  // forcejeo: golpes y tirones alternados, el cuerpo se balancea
  pelear: (u) => {
    const a = Math.sin(u * 9), b = Math.sin(u * 9 + Math.PI);
    return { armR: { x: -1.1 + a * 0.55, z: -0.18 }, armL: { x: -1.1 + b * 0.55, z: 0.18 }, upper: { x: 0.18, y: Math.sin(u * 4.5) * 0.25 },
      head: { x: -0.05, y: Math.sin(u * 4.5) * -0.15 }, body: { z: Math.sin(u * 4.5) * 0.06 }, legs: [-0.35, 0.3] };
  },
  // cae de espaldas: p 0..1 (0 parado, 1 en el piso); los brazos se abren
  caer: (u, o) => {
    const p = o.p ?? 1;
    return { body: { x: -1.45 * p * p, y: -0.05 * p }, armR: { x: -2.2 * p, z: 0.6 * p }, armL: { x: -2.2 * p, z: -0.6 * p }, head: { x: -0.3 * p }, legs: [-0.5 * p, -0.2 * p] };
  },
  // estira el brazo a agarrar algo (p 0..1: estirar → cerrar y traer)
  agarrar: (u, o) => {
    const p = o.p ?? 1, reach = p < 0.6 ? p / 0.6 : 1 - (p - 0.6) / 0.4 * 0.45;
    return { [arm(o)]: { x: -1.35 * reach, z: -0.1 * S(o.side) }, upper: { x: 0.22 * reach }, head: { x: 0.12 * reach } };
  },
  // ofrece algo con el brazo a media altura, la cabeza un poco baja
  entregar: (u, o) => ({ [arm(o)]: { x: -1.05, z: -0.06 * S(o.side) }, upper: { x: 0.1 }, head: { x: 0.1, y: o.look ?? 0 } }),
  // gira la cabeza (o.look, rad; + mira a su izquierda) y el torso acompaña un poco
  mirar: (u, o) => ({ head: { y: o.look ?? 0.6, x: o.up ?? 0 }, upper: { y: (o.look ?? 0.6) * 0.3 } }),
  // se arrodilla: una pierna adelante, la otra atrás, el cuerpo baja; p 0..1
  arrodillarse: (u, o) => {
    const p = o.p ?? 1;
    return { legs: [-1.25 * p, 1.05 * p], body: { y: -0.11 * p }, upper: { x: 0.25 * p }, head: { x: 0.3 * p }, armR: { x: -0.5 * p, z: -0.1 * p }, armL: { x: -0.2 * p } };
  },
};
function arm(o) { return o.side === 'L' ? 'armL' : 'armR'; }
export const poseNames = Object.keys(POSES);
// alias sin tilde (para escribir guiones con el teclado de cualquiera)
const ALIAS = { senalar: 'señalar', point: 'señalar', carry: 'cargar', push: 'empujar', fight: 'pelear', fall: 'caer', grab: 'agarrar', give: 'entregar', look: 'mirar', kneel: 'arrodillarse' };

/**
 * Aplica una pose al modelo. o = { w (peso 0..1), t (s desde que empezó), side, look, up, p }. La altura del cuerpo
 * (body.y) se suma a la posición que dejó el update, en las unidades del modelo (≈ alto 1).
 */
export function applyPose(model, name, o = {}) {
  const P = model?.userData?.parts;
  const fn = POSES[name] || POSES[ALIAS[name]];
  if (!P || !fn) return false;
  const w = Math.max(0, Math.min(1, o.w ?? 1));
  if (w <= 0) return true;
  const T = fn(o.t || 0, o);
  const H = model.userData.height || 1;
  const set = (obj, tgt, keys) => { if (!obj || !tgt) return; for (const k of keys) if (tgt[k] != null) obj.rotation[k] = lerp(obj.rotation[k], tgt[k], w); };
  set(P.armR, T.armR, ['x', 'z']);
  set(P.armL, T.armL, ['x', 'z']);
  set(P.upper, T.upper, ['x', 'y']);
  set(P.head, T.head, ['x', 'y']);
  if (T.body && P.body) {
    set(P.body, T.body, ['x', 'z']);
    // body.y es la base del cuerpo: el update lo mueve unos milímetros al respirar o caminar
    if (T.body.y != null) P.body.position.y += T.body.y * H * w / (model.scale.y || 1);
  }
  if (T.legs && P.legs) P.legs.forEach((l, i) => { if (T.legs[i] != null) l.rotation.x = lerp(l.rotation.x, T.legs[i], w); });
  return true;
}

/** Mezcla de entrada y salida para una pose que dura [t0, t1] con fundidos de `fade` segundos. */
export function poseWeight(t, t0, t1, fade = 0.35) {
  if (t < t0 || t > t1) return 0;
  return Math.min(1, (t - t0) / fade, (t1 - t) / fade);
}

// ---------- utilería en las manos ----------
/** Grupo en la punta del brazo ('R' | 'L'), en las unidades del modelo. Lo arma una vez (como los ecos). */
export function handOf(model, side = 'R') {
  const P = model.userData.parts;
  const armObj = side === 'L' ? P?.armL : P?.armR;
  if (!armObj) return null;
  const key = '__hand' + side;
  if (armObj.userData[key]) return armObj.userData[key];
  // la punta del brazo en reposo: se mide con el brazo derecho (sin la rotación de ahora)
  const rx = armObj.rotation.x, rz = armObj.rotation.z;
  armObj.rotation.set(0, 0, 0);
  model.updateMatrixWorld(true);
  const top = new THREE.Vector3().setFromMatrixPosition(armObj.matrixWorld);
  let minY = Infinity;
  armObj.traverse(m => {
    if (!m.isMesh || m.userData.fitPart === 'gear') return;
    m.geometry.computeBoundingBox?.();
    const bb = new THREE.Box3().copy(m.geometry.boundingBox).applyMatrix4(m.matrixWorld);
    minY = Math.min(minY, bb.min.y);
  });
  armObj.rotation.set(rx, 0, rz);
  const hold = new THREE.Group();
  const ws = new THREE.Vector3(); armObj.getWorldScale(ws);
  hold.position.set(0, Number.isFinite(minY) ? (minY - top.y) / (ws.y || 1) : -0.3, 0);
  hold.scale.setScalar(1 / (ws.y || 1));    // la utilería se arma en unidades del mundo
  armObj.add(hold);
  armObj.userData[key] = hold;
  return hold;
}
/** Pone un objeto en la mano (lo saca de donde estaba). Devuelve el objeto. */
export function holdProp(model, obj, side = 'R') {
  const h = handOf(model, side);
  if (!h || !obj) return obj;
  h.add(obj);
  obj.position.set(0, -0.02, 0.05);
  return obj;
}
/** Suelta el objeto en la escena, en el lugar del mundo donde estaba. */
export function dropProp(obj, parent) {
  if (!obj?.parent || !parent) return obj;
  obj.updateMatrixWorld(true);
  const m = obj.matrixWorld.clone();
  parent.updateMatrixWorld(true);
  obj.parent.remove(obj);
  parent.add(obj);
  m.premultiply(new THREE.Matrix4().copy(parent.matrixWorld).invert());
  m.decompose(obj.position, obj.quaternion, obj.scale);
  return obj;
}

// utilería de bloques, en unidades del mundo (el alto de una persona es ≈ 0,9)
const PROP_GEO = new Map();
const geo = (w, h, d) => { const k = `${w}|${h}|${d}`; if (!PROP_GEO.has(k)) PROP_GEO.set(k, new THREE.BoxGeometry(w, h, d)); return PROP_GEO.get(k); };
const MATS = new Map();
const mat = (hex, basic = false) => { const k = hex + (basic ? 'b' : ''); if (!MATS.has(k)) MATS.set(k, basic ? new THREE.MeshBasicMaterial({ color: hex }) : new THREE.MeshLambertMaterial({ color: hex })); return MATS.get(k); };
const part = (g, w, h, d, hex, x = 0, y = 0, z = 0, basic = false) => { const m = new THREE.Mesh(geo(w, h, d), mat(hex, basic)); m.position.set(x, y, z); g.add(m); return m; };

/** Objetos de mano para las cinemáticas. El cristal brilla (material sin luz) para leerse de noche. */
export function prop(kind, { color } = {}) {
  const g = new THREE.Group();
  g.name = 'prop:' + kind;
  switch (kind) {
    case 'cristal': part(g, 0.07, 0.12, 0.07, color ?? 0xd4ecf2, 0, -0.06, 0, true); part(g, 0.04, 0.05, 0.04, 0xffffff, 0, 0.02, 0, true); break;
    case 'caja': part(g, 0.2, 0.15, 0.16, 0x6b4f33, 0, -0.08, 0.06); part(g, 0.21, 0.02, 0.17, 0x3e2e20, 0, -0.02, 0.06); break;
    case 'carta': part(g, 0.1, 0.13, 0.012, 0xe8dcc0, 0, -0.07, 0.03); part(g, 0.03, 0.03, 0.014, 0x9a2e2a, 0, -0.07, 0.035); break;
    case 'bolsa': part(g, 0.12, 0.13, 0.1, 0x8a6a44, 0, -0.1, 0); part(g, 0.04, 0.04, 0.04, 0x5a4430, 0, -0.02, 0); break;
    case 'farol': part(g, 0.02, 0.06, 0.02, 0x2a2420, 0, -0.03, 0); part(g, 0.07, 0.09, 0.07, 0xffc070, 0, -0.1, 0, true); break;
    case 'pala': part(g, 0.025, 0.42, 0.025, 0x5a4430, 0, -0.05, 0.06); part(g, 0.09, 0.11, 0.02, 0x8a8f96, 0, -0.3, 0.06); break;
    default: part(g, 0.08, 0.08, 0.08, color ?? 0xcccccc, 0, -0.05, 0);
  }
  return g;
}
