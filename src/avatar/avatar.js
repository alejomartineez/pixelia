// Modelo vóxel de la gente de El Quiebre: el personaje del jugador, la gente de la ciudad, el grupo de la expedición y
// las unidades del combate (plan §M1 y §M2). Vóxel detallado (1/48), proporciones robustas y caras serias; las piezas
// están en figure.js. Pueblos jugables: humano, enano, anuro, zorro y orco (data.js → AVATAR_TYPES); 'vaciado' solo
// lo usan los enemigos.
// API (la misma de siempre):
//   avatarModel(look, opts) -> THREE.Group  (altura ≈ 1 unidad en humanos, mira a +Z, base en y=0)
//     look = store.state.avatar = { type, skin, build, hair, hairColor, face, dress, dressColor, crown, acc }
//     group.userData.update(dt, moving)  — camina (piernas, brazos, capa, cola) o respira y parpadea
//     opts.seated: sin piernas ni falda, con la cadera a 4 × AVATAR_VOXEL (para manejar el auto)
//     opts.npc / opts.lowDetail: versión liviana (todo fusionado menos las piernas)
//     opts.gear: equipo fuera del catálogo (GEAR de figure.js, p. ej. 'trabuco')
//     opts.cls: clase (o rol de la expedición): cambia ropa, arma y casco (classLook, plan §M3)
//   randomLook(seed, opts) -> look válido determinista (opts.type: pueblo, opts.cls: clase)
//   normalizeLook(look) -> look completo y válido (traduce los looks viejos: chica/chico y las piezas de antes de v5)
import * as THREE from 'three';
import {
  AVATAR_TYPES, avatarType, fitsType, LEGACY_TYPES, LEGACY_ITEMS, V5_TYPES, v5Item,
  HAIR_COLORS, OUTFIT_COLORS, HAIR_STYLES, DRESS_STYLES, CROWNS, ACCESSORIES, FACES, BUILDS,
} from '../core/data.js';
import { S, AVATAR_VOXEL, cachedGeo, cacheGet, cacheSet, meshOf, pivot, lightMat } from './avatar-kit.js';
import {
  dimsOf, paletteOf, outfitOf, drawTorso, drawArm, drawLeg, drawSkirt, drawCape, drawTail, buildHead, eyeVoxels,
  hairSwings, hairShape, GEAR, classLook, CLASS_KIT, ROLE_CLASS,
} from './figure.js';

export { AVATAR_VOXEL, classLook, CLASS_KIT, ROLE_CLASS };

const NPC_TYPES = new Set(['vaciado']);
const listHas = (list, id) => list.some(i => i.id === id);

/** Completa/corrige un look: pueblo válido y piezas que le sirvan. Los looks viejos se traducen (v1, v4 y v5). */
export function normalizeLook(look = {}) {
  look = look && typeof look === 'object' ? look : {};
  let type = look.type === undefined ? 'humano' : LEGACY_TYPES[look.type] || look.type;
  let build = look.build;
  const legacy = !!V5_TYPES[type];
  if (legacy) { build = build || V5_TYPES[type].build; type = V5_TYPES[type].type; }
  const npc = NPC_TYPES.has(type);
  const t = avatarType(npc ? 'humano' : type);
  const fitT = t.id;
  const def = t.look;
  const old = (kind, id) => v5Item(kind, LEGACY_ITEMS[kind]?.[id] || id);
  const piece = (kind, list, id, d) => { const nid = old(kind, id); const it = list.find(i => i.id === nid); return it && fitsType(it, fitT) ? nid : d; };
  const color = (list, id, d) => (listHas(list, id) ? id : d);
  const skin = Number.isFinite(+look.skin) && look.skin !== null && look.skin !== ''
    ? Math.max(0, Math.min(5, Math.round(+look.skin))) : def.skin;
  // los looks de antes no tenían cara: sin barba, salvo la "Barba de sabio" que era un peinado
  const face = look.face ?? (look.hair === 'barba' ? 'barba_larga' : legacy || look.hair !== undefined ? 'ninguna' : def.face);
  return {
    type: npc ? type : t.id,
    skin,
    build: listHas(BUILDS, build) ? build : def.build,
    hair: piece('hair', HAIR_STYLES, look.hair, def.hair),
    hairColor: color(HAIR_COLORS, look.hairColor, def.hairColor),
    face: piece('face', FACES, face, 'ninguna'),
    dress: piece('dress', DRESS_STYLES, look.dress, def.dress),
    dressColor: color(OUTFIT_COLORS, look.dressColor, def.dressColor),
    crown: piece('crown', CROWNS, look.crown, def.crown),
    acc: piece('acc', ACCESSORIES, look.acc, def.acc),
  };
}

// equipo que no va cuando maneja (estorba en el auto)
const NOT_SEATED = new Set(['lanza', 'baston', 'escudo', 'arco', 'mochila', 'farolito', 'hacha', 'martillo', 'espada', 'libro', 'orbe']);
const lookKey = (l) => [l.type, l.build, l.skin, l.hair, l.hairColor, l.face, l.dress, l.dressColor, l.crown, l.acc].join('|');

// =====================================================================
//                                 MODELO
// =====================================================================
export function avatarModel(lookIn = {}, opts = {}) {
  let look = normalizeLook(lookIn);
  if (opts.cls) look = normalizeLook({ ...classLook(look, opts.cls), type: look.type });
  if ((opts.npc || opts.lowDetail) && !opts.seated) return lowDetailModel(look, opts);
  const seated = !!opts.seated;
  const D = dimsOf(look.type, look.build), P = paletteOf(look), o = outfitOf(look.dress);
  // opts.gear: equipo que no está en el catálogo (el trabuco de los piratas)
  const acc = opts.gear || (seated && NOT_SEATED.has(look.acc) ? 'ninguno' : look.acc);
  const gear = GEAR[acc] || null;
  const K = `${look.type}|${look.build}|${look.skin}|${look.dress}|${look.dressColor}`;
  const hipY = seated ? 4 * AVATAR_VOXEL / S : D.legH;
  const hd = Math.floor(D.D / 2);
  const long = !!hairShape(look.hair).long;

  const root = new THREE.Group();
  root.name = 'avatar';
  const body = new THREE.Group();
  root.add(body);
  const upper = pivot(0, hipY, 0);   // todo lo que va de la cadera para arriba (se inclina con la joroba de cada pueblo)
  body.add(upper);

  const torso = meshOf(cachedGeo(`t|${K}|${acc}|${look.hairColor}`, (v) => drawTorso(v, look, D, P, gear)));
  upper.add(torso);

  // piernas y faldón
  const legs = [];
  if (!seated) {
    const legGeo = cachedGeo(`l|${K}`, (v) => drawLeg(v, look, D, P));
    for (const s of [-1, 1]) {
      const pv = pivot(s * D.hip, hipY, 0);
      const m = meshOf(legGeo);
      if (s < 0) m.scale.x = -1;
      pv.add(m); body.add(pv); legs.push(pv);
    }
  }
  let skirt = null;
  if (!seated && o.skirt) {
    const g = cachedGeo(`k|${K}`, (v) => drawSkirt(v, look, D, P));
    if (g) { skirt = pivot(0, hipY, 0); skirt.add(meshOf(g)); body.add(skirt); }
  }

  // brazos (el izquierdo es el mismo espejado)
  const armGeo = cachedGeo(`a|${K}`, (v) => drawArm(v, look, D, P));
  const arms = [];
  for (const s of [-1, 1]) {
    const pv = pivot(s * D.armX, D.H - 2, 0);
    const m = meshOf(armGeo);
    if (s < 0) m.scale.x = -1;
    pv.add(m); upper.add(pv); arms.push(pv);
  }
  const [armL, armR] = arms;
  const pose = { lx: 0, rx: 0, lz: -0.22, rz: 0.22, swing: 1 };   // pose en A: brazos separados del cuerpo
  if (seated) Object.assign(pose, { lx: -1.15, rx: -1.15, lz: 0.12, rz: -0.12, swing: 0 });
  else if (gear?.pose) Object.assign(pose, gear.pose);
  const glow = [];
  if (gear?.hand) armR.add(meshOf(cachedGeo(`gh|${acc}|${look.type}|${look.build}`, (v) => gear.hand(v, D, P))));
  if (gear?.off) armL.add(meshOf(cachedGeo(`go|${acc}|${look.type}|${look.build}`, (v) => gear.off(v, D, P))));
  if (gear?.light) { const m = meshOf(cachedGeo(`gl|${acc}|${look.type}|${look.build}`, (v) => gear.light(v, D, P)), lightMat()); m.castShadow = false; armR.add(m); glow.push(m); }
  if (gear?.offLight) { const m = meshOf(cachedGeo(`gk|${acc}|${look.type}|${look.build}`, (v) => gear.offLight(v, D, P)), lightMat()); m.castShadow = false; armL.add(m); glow.push(m); }

  // cabeza, ojos y pelo que se balancea
  const head = pivot(0, D.H + D.neck - D.headY, D.headZ);
  upper.add(head);
  head.add(meshOf(cachedGeo(`h|${lookKey(look)}`, (v) => buildHead(v, look, D, P))));
  const eyeList = eyeVoxels(look, D, P);
  // la malla de los ojos tiene el pivote a la altura de los ojos: al parpadear se cierran en el lugar
  const eyeY = eyeList.length ? Math.min(...eyeList.map(e => e[1])) : 0;
  const eyes = meshOf(cachedGeo(`e2|${look.type}|${look.build}|${look.face}|${look.skin}`, (v) => { for (const [x, y, z, c] of eyeList) v.set(x, y - eyeY, z, c); }),
    look.type === 'vaciado' ? lightMat() : undefined);
  eyes.position.y = eyeY * S;
  eyes.castShadow = false;
  head.add(eyes);
  const swings = [];
  hairSwings(look, D, P).forEach((sw, i) => {
    const g = cachedGeo(`s|${look.type}|${look.build}|${look.hair}|${look.hairColor}|${i}`, sw.build);
    if (!g) return;
    const pv = pivot(...sw.at);
    const m = meshOf(g);
    if (sw.mirror) m.scale.x = -1;
    pv.add(m); head.add(pv);
    swings.push({ pv, amp: sw.sway });
  });

  // capa y cola
  let cape = null;
  if (o.cape) {
    cape = pivot(0, D.H - 1, -hd - (long ? 2 : 0) - (acc === 'mochila' ? 4 : 0));
    cape.add(meshOf(cachedGeo(`c|${K}`, (v) => drawCape(v, look, D, P))));
    upper.add(cape);
  }
  let tail = null;
  if (look.type === 'zorro' && !seated) {
    tail = pivot(0, hipY + 2, -hd - (o.skirt && o.skirt.long ? 2 : 0));
    tail.add(meshOf(cachedGeo(`tail|${look.skin}`, (v) => drawTail(v, look, D, P))));
    body.add(tail);
  }

  armL.rotation.set(pose.lx, 0, pose.lz);
  armR.rotation.set(pose.rx, 0, pose.rz);
  upper.rotation.x = D.hunch;

  root.updateMatrixWorld(true);
  const bb = new THREE.Box3().setFromObject(root);
  const height = bb.max.y;
  if (opts.scale) root.scale.setScalar(opts.scale);

  // ---------------- animación ----------------
  let t = Math.random() * 10, walk = 0, phase = 0;
  let blinkIn = 1.5 + Math.random() * 3, blinkLeft = 0;
  const legAmp = o.skirt?.long ? 0.32 : 0.7;
  const headY = head.position.y;
  root.userData.look = look;
  root.userData.height = height * (opts.scale || 1);
  root.userData.parts = { body, upper, torso, head, eyes, armL, armR, legs, skirt, cape, swings, tail, glow };
  root.userData.update = (dt = 0.016, moving = false) => {
    dt = Math.min(dt, 0.1);
    t += dt;
    walk += ((moving ? 1 : 0) - walk) * Math.min(1, dt * 9);
    if (walk > 0.01) phase += dt * 10;
    const sw = Math.sin(phase) * walk;
    const idle = 1 - walk;
    const breath = Math.sin(t * 2.2);
    for (let i = 0; i < legs.length; i++) legs[i].rotation.x = (i ? -sw : sw) * legAmp;
    armL.rotation.x = pose.lx - sw * 0.6 * pose.swing * (gear?.off ? 0.4 : 1);
    armR.rotation.x = pose.rx + sw * 0.6 * pose.swing * (gear?.still || gear?.hand ? 0.35 : 1);
    armL.rotation.z = pose.lz - breath * 0.03 * idle * pose.swing;
    armR.rotation.z = pose.rz + breath * 0.03 * idle * pose.swing;
    body.position.y = Math.abs(Math.sin(phase)) * 0.03 * walk + (seated ? 0 : breath * 0.003 * idle);
    body.rotation.z = Math.sin(phase) * 0.03 * walk;
    upper.rotation.x = D.hunch + 0.05 * walk;
    torso.scale.y = 1 + breath * 0.01 * idle;
    head.position.y = headY + breath * 0.004 * idle;
    head.rotation.y = Math.sin(t * 0.5) * 0.12 * idle;
    head.rotation.x = Math.sin(t * 0.7 + 1) * 0.025 * idle;
    for (const s of swings) {
      s.pv.rotation.x = 0.1 * walk + Math.sin(phase * 2) * 0.1 * walk * s.amp + Math.sin(t * 1.7) * 0.03 * idle;
      s.pv.rotation.z = (Math.sin(phase) * 0.14 * walk + Math.sin(t * 1.3) * 0.04 * idle) * s.amp;
    }
    if (skirt) skirt.rotation.x = Math.sin(phase) * 0.04 * walk;
    if (tail) { tail.rotation.y = Math.sin(t * (moving ? 7 : 2.4)) * (0.22 + walk * 0.15); tail.rotation.x = -0.15 + Math.sin(t * 1.4) * 0.05; }
    if (cape) cape.rotation.x = 0.06 + walk * 0.3 + Math.sin(t * 2.6 + phase) * (0.025 + walk * 0.05);
    for (const g of glow) g.scale.setScalar(1 + Math.sin(t * 5.3) * 0.03);
    blinkIn -= dt;
    if (blinkIn <= 0) { blinkLeft = 0.12; blinkIn = 2.5 + Math.random() * 3.5; }
    if (blinkLeft > 0) blinkLeft -= dt;
    eyes.scale.y = blinkLeft > 0 ? 0.2 : 1;
  };
  root.userData.update(0, false);
  return root;
}

// =====================================================================
//                    VERSIÓN LIVIANA (gente de la ciudad)
// Lo quieto se fusiona en UNA geometría por look; las piernas siguen sueltas para caminar.
// =====================================================================
function mergeMeshes(meshes) {
  const pos = [], nor = [], col = [], idx = [];
  const v = new THREE.Vector3(), n = new THREE.Vector3(), nm = new THREE.Matrix3();
  for (const o of meshes) {
    const g = o.geometry;
    const Pa = g?.attributes.position, N = g?.attributes.normal, C = g?.attributes.color;
    if (!Pa || !N) continue;
    const m = o.matrixWorld;
    nm.getNormalMatrix(m);
    const base = pos.length / 3;
    for (let i = 0; i < Pa.count; i++) {
      v.fromBufferAttribute(Pa, i).applyMatrix4(m);
      n.fromBufferAttribute(N, i).applyMatrix3(nm).normalize();
      pos.push(v.x, v.y, v.z); nor.push(n.x, n.y, n.z);
      if (C) col.push(C.getX(i), C.getY(i), C.getZ(i)); else col.push(1, 1, 1);
    }
    const flip = m.determinant() < 0;
    const I = g.index;
    const cnt = I ? I.count : Pa.count;
    for (let i = 0; i + 2 < cnt; i += 3) {
      const a = I ? I.getX(i) : i, b = I ? I.getX(i + 1) : i + 1, c = I ? I.getX(i + 2) : i + 2;
      if (flip) idx.push(base + a, base + c, base + b); else idx.push(base + a, base + b, base + c);
    }
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  out.setIndex(pos.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
  out.computeBoundingSphere(); out.computeBoundingBox();
  return out;
}

function lowDetailModel(look, opts = {}) {
  const key = 'npc|' + lookKey(look);
  let merged = cacheGet(key);
  let height = cacheGet(key + '|h');
  const D = dimsOf(look.type, look.build), P = paletteOf(look);
  if (!merged) {
    const full = avatarModel(look, {});
    const Pt = full.userData.parts;
    Pt.body.position.set(0, 0, 0); Pt.body.rotation.set(0, 0, 0);
    Pt.torso.scale.set(1, 1, 1);
    Pt.head.rotation.set(0, 0, 0);
    Pt.eyes.scale.y = 1;
    for (const s of Pt.swings) s.pv.rotation.set(0.04, 0, 0);
    if (Pt.cape) Pt.cape.rotation.x = 0.08;
    if (Pt.tail) Pt.tail.rotation.set(-0.15, 0.2, 0);
    for (const g of Pt.glow) g.scale.setScalar(1);
    full.updateMatrixWorld(true);
    const legMeshes = new Set();
    for (const pv of Pt.legs) pv.traverse(o => { if (o.isMesh) legMeshes.add(o); });
    const list = [];
    full.traverse(o => { if (o.isMesh && o.visible && !legMeshes.has(o)) list.push(o); });
    merged = mergeMeshes(list);
    height = full.userData.height;
    cacheSet(key, merged);
    cacheSet(key + '|h', height);
  }
  const legGeo = cachedGeo(`l|${look.type}|${look.build}|${look.skin}|${look.dress}|${look.dressColor}`, (v) => drawLeg(v, look, D, P));
  const root = new THREE.Group();
  root.name = 'avatar-npc';
  const body = new THREE.Group();
  root.add(body);
  const main = meshOf(merged);
  body.add(main);
  const legs = [];
  for (const s of [-1, 1]) {
    const pv = pivot(s * D.hip, D.legH, 0);
    const m = meshOf(legGeo);
    m.castShadow = false;
    if (s < 0) m.scale.x = -1;
    pv.add(m); body.add(pv); legs.push(pv);
  }
  if (opts.scale) root.scale.setScalar(opts.scale);
  const legAmp = outfitOf(look.dress).skirt?.long ? 0.32 : 0.7;
  let t = Math.random() * 10, walk = 0, phase = 0;
  root.userData.look = look;
  root.userData.lowDetail = true;
  root.userData.height = height * (opts.scale || 1);
  root.userData.parts = { body, torso: main, legs };
  root.userData.update = (dt = 0.016, moving = false) => {
    dt = Math.min(dt, 0.1);
    t += dt;
    walk += ((moving ? 1 : 0) - walk) * Math.min(1, dt * 9);
    if (walk > 0.01) phase += dt * 10;
    const sw = Math.sin(phase) * walk;
    const idle = 1 - walk;
    for (let i = 0; i < legs.length; i++) legs[i].rotation.x = (i ? -sw : sw) * legAmp;
    body.position.y = Math.abs(Math.sin(phase)) * 0.03 * walk + Math.sin(t * 2.2) * 0.003 * idle;
    body.rotation.z = Math.sin(phase) * 0.03 * walk + Math.sin(t * 0.9) * 0.01 * idle;
  };
  root.userData.update(0, false);
  return root;
}

// ---------------- Looks aleatorios (gente de la ciudad, el grupo y las unidades) ----------------
function rng(seed) {
  let a = (seed | 0) ^ 0x9e3779b9;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// cuántos de cada pueblo se ven por la isla (los humanos son mayoría)
const PEOPLE_MIX = [['humano', 0.5], ['enano', 0.15], ['zorro', 0.13], ['anuro', 0.11], ['orco', 0.11]];
const HAIR_NATURAL = ['castano', 'negro', 'rubio', 'pelirrojo', 'chocolate', 'gris'];
const CLOTHES_SOBER = ['verde', 'azul', 'durazno', 'rojo', 'negro', 'blanco', 'dorado', 'celeste', 'violeta', 'fucsia'];
const COMMON_DRESS = ['viajero', 'jubon', 'vestido', 'minero', 'delantal', 'cuero', 'habito', 'tabardo', 'abrigo', 'pieles', 'capa_viaje', 'tunica'];
const COMMON_HATS = ['capucha', 'gorro', 'vincha', 'gorra', 'bandana', 'piluso', 'galera'];
const COMMON_ACC = ['mochila', 'bolso', 'baston', 'libro', 'farolito', 'catalejo', 'collar'];
/** Look aleatorio válido y determinista (misma semilla = mismo look). opts.type fija el pueblo y opts.cls la clase. */
export function randomLook(seed = 0, opts = {}) {
  const r = rng(Math.floor(seed * 7919) + 17);
  const pick = (list) => list[Math.floor(r() * list.length) % list.length];
  let type = opts.type;
  if (!type) { let u = r(); type = PEOPLE_MIX.find(([, w]) => (u -= w) < 0)?.[0] || 'humano'; }
  const fitT = NPC_TYPES.has(type) ? 'humano' : type;
  const fit = (list) => list.filter(i => fitsType(i, fitT));
  const ids = (list) => new Set(fit(list).map(i => i.id));
  const okDress = ids(DRESS_STYLES), okHat = ids(CROWNS), okAcc = ids(ACCESSORIES);
  const look = {
    type,
    build: r() < 0.5 ? 'recio' : 'esbelto',
    skin: Math.floor(r() * 6) % 6,
    hair: pick(fit(HAIR_STYLES)).id,
    hairColor: pick(HAIR_NATURAL),
    face: r() < 0.4 ? 'ninguna' : pick(fit(FACES)).id,
    dress: pick(COMMON_DRESS.filter(id => okDress.has(id))),
    dressColor: pick(CLOTHES_SOBER),
    crown: r() < 0.55 ? 'ninguna' : pick(COMMON_HATS.filter(id => okHat.has(id))),
    acc: r() < 0.55 ? 'ninguno' : pick(COMMON_ACC.filter(id => okAcc.has(id))),
  };
  if (type === 'vaciado') Object.assign(look, { dress: 'minero', hairColor: 'gris', crown: r() < 0.5 ? 'ninguna' : 'capucha', acc: 'ninguno', face: r() < 0.5 ? 'cicatriz' : 'ninguna' });
  return opts.cls ? classLook(look, opts.cls) : look;
}

/** Pueblos jugables (para el Equipaje, el onboarding y la historia). */
export const PLAYABLE_PEOPLES = AVATAR_TYPES.map(t => t.id);
