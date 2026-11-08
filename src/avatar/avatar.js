// Modelo vóxel del personaje del jugador (y de las vecinas), estilo chibi tierno: cabeza grande, ojitos con brillo
// en alta resolución, cachetes rosados. Tipos: chica, chico y animalitos (gatito, zorrito, conejito, osito), cada uno
// con su ropa y accesorios (ver data.js → AVATAR_TYPES). Los tipos viejos (princesa, príncipe, hada, mago) se traducen.
// API:
//   avatarModel(look, opts) -> THREE.Group  (altura ≈ 1 unidad, mira a +Z, base en y=0)
//     look = store.state.avatar = { type, skin, hair, hairColor, dress, dressColor, crown, acc }
//     group.userData.update(dt, moving)  — camina (piernas/brazos/rebote) o idle (respira, parpadea, mueve la cola)
//     opts.seated: true  -> sin piernas ni falda, brazos al frente (para manejar el auto)
//     opts.npc / opts.lowDetail: versión liviana para la gente que pasea (3 mallas: cuerpo fusionado + 2 piernas)
//   randomLook(seed) -> look válido determinista (gente que pasea, NPC)
//   normalizeLook(look) -> look completo y válido para su tipo (looks viejos: ver LEGACY_TYPES/LEGACY_ITEMS)
// Las geometrías se cachean por pieza+colores: crear muchos personajes es barato.
import * as THREE from 'three';
import {
  AVATAR_TYPES, avatarType, fitsType, LEGACY_TYPES, LEGACY_ITEMS, SKIN_TONES, HAIR_COLORS, OUTFIT_COLORS, HAIR_STYLES, DRESS_STYLES, CROWNS, ACCESSORIES,
} from '../core/data.js';
import {
  S, AVATAR_VOXEL, cachedGeo, cacheGet, cacheSet, meshOf, pivot, hairPal, hairHex, outfitHex, furPal, paintFur,
} from './avatar-kit.js';
import {
  HAIR, buildHead, eyesGeo, faceGeo, eyeStyle, eyeColor, ANIMAL_HEAD, buildAnimalHead, animalEars, buildTail,
} from './avatar-heads.js';
import { DRESS, dressPal, buildArm, buildCapeC, FUR_MARK } from './avatar-outfits.js';
import {
  CROWN_BUILD, HATS, buildWand, buildBag, buildGlasses, buildWing, buildCat, buildNecklace, buildBouquet, buildSword,
  buildShield, buildScepter, buildBackpack, buildBall, buildBalloon, buildSkateboard, buildFlowerWand, buildLantern,
  buildBook, buildOrb, buildStaff, buildOwl, buildButterflyWing, buildTintWing,
} from './avatar-props.js';

export { AVATAR_VOXEL };

/** Completa/corrige un look: tipo válido (default chica; los de realeza se traducen) y piezas que sirvan para ese tipo. */
export function normalizeLook(look = {}) {
  look = look && typeof look === 'object' ? look : {};
  const t = avatarType(LEGACY_TYPES[look.type] || (look.type === undefined ? 'chica' : look.type));
  const old = (kind, id) => LEGACY_ITEMS[kind]?.[id] || id;
  const def = t.look;
  const piece = (list, id, d) => { const it = list.find(i => i.id === id); return it && fitsType(it, t.id) ? id : d; };
  const color = (list, id, d) => (list.some(i => i.id === id) ? id : d);
  const skin = Number.isFinite(+look.skin) && look.skin !== null && look.skin !== ''
    ? Math.max(0, Math.min(SKIN_TONES.length - 1, Math.round(+look.skin))) : def.skin;
  return {
    type: t.id,
    skin,
    hair: piece(HAIR_STYLES, look.hair, def.hair),
    hairColor: color(HAIR_COLORS, look.hairColor, def.hairColor),
    dress: piece(DRESS_STYLES, look.dress, def.dress),
    dressColor: color(OUTFIT_COLORS, look.dressColor, def.dressColor),
    crown: piece(CROWNS, old('crown', look.crown), def.crown),
    acc: piece(ACCESSORIES, old('acc', look.acc), def.acc),
  };
}

// accesorios que se sostienen con las dos manos (brazos al frente)
const TWO_HANDS = new Set(['gatito', 'ramo', 'orbe']);
// accesorios que no van cuando maneja (estorban en el auto)
const NOT_SEATED = new Set(['gatito', 'ramo', 'orbe', 'mochila', 'pelota', 'patineta', 'farolito', 'libro', 'baston']);

// =====================================================================
//                                 MODELO
// =====================================================================
export function avatarModel(lookIn = {}, opts = {}) {
  const look = normalizeLook(lookIn);
  if ((opts.npc || opts.lowDetail) && !opts.seated) return lowDetailModel(look, opts);
  const seated = !!opts.seated;
  const type = look.type;
  const animal = !!avatarType(type).animal;
  const p = dressPal(look, animal);
  const f = animal ? furPal(look) : null;
  const hairDef = animal ? ANIMAL_HEAD : (HAIR[look.hair] || HAIR.largo);
  const dress = DRESS[look.dress] || DRESS.clasico;
  const ck = `${look.dressColor}|${animal ? `a|${look.hair}|${look.hairColor}` : look.skin}`;
  const dc = look.dressColor;
  // geometría del cuerpo: en animalitos lo "de piel" se repinta con el pelaje
  const bodyGeo = (key, part, build) => cachedGeo(key, (v) => { build(v); if (animal) paintFur(v, FUR_MARK, f, part); });

  const root = new THREE.Group();
  root.name = 'avatar';
  const body = new THREE.Group();
  root.add(body);

  // --- torso
  const torso = meshOf(bodyGeo(`t|${look.dress}|${ck}|${seated ? 1 : 0}`, 'torso', (v) => dress.torso(v, p, seated)));
  body.add(torso);

  // --- piernas
  const legs = [];
  if (!seated) {
    const legGeo = bodyGeo(`l|${look.dress}|${ck}`, 'leg', (v) => dress.leg(v, p));
    for (const s of [-1, 1]) {
      const pv = pivot(s, 4, 0);
      const m = meshOf(legGeo);
      if (s < 0) m.scale.x = -1;
      pv.add(m); body.add(pv); legs.push(pv);
    }
  }

  // --- brazos
  const armGeo = bodyGeo(`a|${look.dress}|${ck}`, 'arm', (v) => buildArm(v, dress.arm, p));
  const arms = [];
  for (const s of [-1, 1]) {
    const pv = pivot(s * 4, 10, 0);
    const m = meshOf(armGeo);
    if (s < 0) m.scale.x = -1;
    pv.add(m); body.add(pv); arms.push(pv);
  }
  const [armL, armR] = arms;
  const pose = { lx: 0, rx: 0, lz: -0.12, rz: 0.12, swing: 1 };
  if (seated) Object.assign(pose, { lx: -1.15, rx: -1.15, lz: 0.12, rz: -0.12, swing: 0 });

  // --- cabeza
  const isHat = HATS.has(look.crown);
  const head = pivot(0, 10, 0);
  body.add(head);
  const headGeo = animal
    ? cachedGeo(`ha|${type}|${look.hair}|${look.hairColor}`, (v) => buildAnimalHead(v, look, type))
    : cachedGeo(`h|${look.skin}|${look.hair}|${look.hairColor}|${isHat ? 1 : 0}`, (v) => buildHead(v, look, isHat));
  head.add(meshOf(headGeo));
  // cara fina (boca, cachetes, cejas / hocico): capa delgada sobre la cara
  const face = meshOf(faceGeo(look, type, animal));
  face.position.set(0, 0, 5 * S);
  face.scale.z = 0.4;
  face.castShadow = false;
  head.add(face);
  const eyes = meshOf(eyesGeo(eyeStyle(type, animal), eyeColor(type)));
  eyes.position.set(0, 4.5 * S, 5 * S);
  eyes.scale.z = 0.5;
  eyes.castShadow = false;
  head.add(eyes);

  // pelo que se balancea (colitas, trenzas) u orejas de animalito
  const swings = [];
  const swingDefs = animal ? animalEars(type) : (hairDef.swings || []);
  swingDefs.forEach((sw, i) => {
    const key = animal ? `ear|${type}|${look.hair}|${look.hairColor}` : `s|${look.hair}|${look.hairColor}|${i}`;
    const g = cachedGeo(key, (v) => sw.build(v, animal ? f : hairPal(hairHex(look.hairColor))));
    if (!g) return;
    const pv = pivot(sw.at[0], sw.at[1], sw.at[2]);
    const m = meshOf(g);
    if (sw.mirror) m.scale.x = -1;
    pv.add(m); head.add(pv);
    swings.push({ pv, amp: sw.sway, side: sw.mirror ? 1 : -1, ear: animal });
  });

  // cola
  let tail = null;
  if (animal && !seated) {
    tail = pivot(0, 5, -3);
    tail.add(meshOf(cachedGeo(`tail|${type}|${look.hair}|${look.hairColor}`, (v) => buildTail(v, type, f))));
    body.add(tail);
  }

  // corona / gorro / sombrero
  if (look.crown !== 'ninguna' && CROWN_BUILD[look.crown]) {
    const g = cachedGeo(`c|${look.crown}|${dc}|${look.hairColor}`, (v) => CROWN_BUILD[look.crown](v, outfitHex(dc), hairHex(look.hairColor)));
    if (g) {
      const m = meshOf(g);
      // la corona de flores y el laurel rodean la cabeza: no se corren hacia adelante (si no, sobresalen de la frente)
      const around = isHat || look.crown === 'flores' || look.crown === 'laurel';
      m.position.set(0, (isHat ? 0 : hairDef.top - 12) * S, (around ? 0 : hairDef.crownZ || 0) * S);
      head.add(m);
    }
  }

  // capa
  let cape = null;
  if (dress.cape) {
    const cc = typeof dress.cape === 'function' ? dress.cape(p) : dress.cape;
    // con pelo largo la capa va por fuera del pelo (si no, el pelo la tapa entera)
    cape = pivot(0, 9.5, hairDef.long ? -6 : -2);
    cape.add(meshOf(cachedGeo(`cape|${look.dress}|${dc}|${hairDef.long ? 1 : 0}`, (v) => buildCapeC(v, cc, !!hairDef.long))));
    body.add(cape);
  }

  // accesorios
  const wings = [];
  let cat = null, balloon = null, owl = null;
  const acc = seated && NOT_SEATED.has(look.acc) ? 'ninguno' : look.acc;
  const inHand = (arm, key, build, mirror = false) => {
    const m = meshOf(cachedGeo(key, build));
    if (mirror) m.scale.x = -1;
    arm.add(m);
    return m;
  };
  const raise = () => { if (!seated) Object.assign(pose, { rx: -0.55, rz: 0.05 }); };
  const onBody = (key, build) => { const m = meshOf(cachedGeo(key, build)); body.add(m); return m; };
  const addWings = (g, spread = 0.3) => {
    const z = (hairDef.long ? -7.3 : -2.3) - (cape ? 2 : 0); // detrás de la capa
    for (const s of [-1, 1]) {
      const pv = pivot(s * 0.5, 6.5, z);
      const m = meshOf(g);
      m.castShadow = false;
      if (s < 0) m.scale.x = -1;
      pv.add(m); body.add(pv); wings.push({ pv, s, spread });
    }
  };
  switch (acc) {
    case 'varita': inHand(armR, 'x|varita', buildWand); raise(); break;
    case 'varita_flor': inHand(armR, 'x|varita_flor', buildFlowerWand); raise(); break;
    case 'espada': inHand(armR, 'x|espada', buildSword); raise(); break;
    case 'cetro': inHand(armR, 'x|cetro', buildScepter); raise(); break;
    case 'farolito': inHand(armR, 'x|farolito', buildLantern); break;
    case 'baston': inHand(armR, 'x|baston', buildStaff); if (!seated) pose.rz = 0.04; break;
    case 'bolso': inHand(armL, `x|bolso|${dc}`, (v) => buildBag(v, p), true); if (!seated) pose.lz = -0.28; break;
    case 'escudo': inHand(armL, `x|escudo|${dc}`, (v) => buildShield(v, outfitHex(dc)), true); if (!seated) pose.lz = -0.2; break;
    case 'pelota': inHand(armL, 'x|pelota', buildBall, true); pose.lz = -0.3; break;
    case 'patineta': inHand(armL, `x|patineta|${dc}`, (v) => buildSkateboard(v, outfitHex(dc)), true); pose.lz = -0.24; break;
    case 'libro': inHand(armL, 'x|libro', buildBook, true); Object.assign(pose, { lx: -0.75, lz: 0.1 }); break;
    case 'anteojos': {
      const m = meshOf(cachedGeo('x|anteojos', buildGlasses));
      m.position.z = (animal ? 6 : 5) * S;
      m.scale.z = 0.6;
      head.add(m);
      eyes.visible = false;
      break;
    }
    case 'alas': addWings(cachedGeo('x|ala', buildWing)); break;
    case 'alas_hada': addWings(cachedGeo(`x|alas_hada|${dc}`, (v) => buildTintWing(v, outfitHex(dc)))); break;
    case 'alas_mariposa': addWings(cachedGeo(`x|mariposa|${dc}`, (v) => buildButterflyWing(v, outfitHex(dc))), 0.45); break;
    case 'gatito': cat = new THREE.Group(); cat.add(meshOf(cachedGeo('x|gatito', buildCat))); body.add(cat); break;
    case 'ramo': cat = new THREE.Group(); cat.add(meshOf(cachedGeo(`x|ramo|${dc}`, (v) => buildBouquet(v, outfitHex(dc))))); body.add(cat); break;
    case 'orbe': cat = new THREE.Group(); cat.add(meshOf(cachedGeo('x|orbe', buildOrb))); body.add(cat); break;
    case 'collar': onBody('x|collar', buildNecklace); break;
    case 'mochila': onBody(`x|mochila|${dc}|${hairDef.long ? 1 : 0}`, (v) => buildBackpack(v, outfitHex(dc), hairDef.long ? -3 : 0)); break;
    case 'buho': owl = new THREE.Group(); owl.add(meshOf(cachedGeo('x|buho', buildOwl))); body.add(owl); break;
  }
  if (TWO_HANDS.has(acc)) Object.assign(pose, { lx: -0.95, rx: -0.95, lz: 0.32, rz: -0.32, swing: 0 });

  // pose base
  armL.rotation.set(pose.lx, 0, pose.lz);
  armR.rotation.set(pose.rx, 0, pose.rz);

  // altura real (para burbujas/nombres arriba de la cabeza); el globo no cuenta
  root.updateMatrixWorld(true);
  const bb = new THREE.Box3().setFromObject(root);
  const height = Math.max(bb.max.y, (21 + (hairDef.top - 12)) * S);

  if (acc === 'globo') {
    balloon = pivot(5.6, 5, 0.6);
    const m = meshOf(cachedGeo(`x|globo|${dc}`, (v) => buildBalloon(v, outfitHex(dc))));
    m.castShadow = !seated;
    balloon.add(m);
    body.add(balloon);
  }

  if (opts.scale) root.scale.setScalar(opts.scale);

  // ---------------- animación ----------------
  let t = Math.random() * 10, walk = 0, phase = 0;
  let blinkIn = 1.5 + Math.random() * 3, blinkLeft = 0, doubleBlink = false;
  const eyeY = eyes.scale.y;
  root.userData.look = look;
  root.userData.height = height * (opts.scale || 1);
  root.userData.parts = { body, torso, head, eyes, face, armL, armR, legs, cape, wings, swings, cat, tail, balloon, owl };
  root.userData.update = (dt = 0.016, moving = false) => {
    dt = Math.min(dt, 0.1);
    t += dt;
    walk += ((moving ? 1 : 0) - walk) * Math.min(1, dt * 9);
    if (walk > 0.01) phase += dt * 11;
    const sw = Math.sin(phase) * walk;
    const idle = 1 - walk;
    const breath = Math.sin(t * 2.4);

    for (let i = 0; i < legs.length; i++) legs[i].rotation.x = (i ? -sw : sw) * 0.75;
    const wave = (acc === 'varita' || acc === 'varita_flor' || acc === 'cetro') ? Math.sin(t * 3) * 0.08 * idle : 0;
    armL.rotation.x = pose.lx - sw * 0.7 * pose.swing;
    armR.rotation.x = pose.rx + sw * 0.7 * pose.swing + wave;
    armL.rotation.z = pose.lz - breath * 0.035 * idle * pose.swing;
    armR.rotation.z = pose.rz + breath * 0.035 * idle * pose.swing;

    body.position.y = Math.abs(Math.sin(phase)) * 0.045 * walk + (seated ? 0 : breath * 0.004 * idle);
    body.rotation.z = Math.sin(phase) * 0.04 * walk;
    torso.scale.y = 1 + breath * 0.012 * idle;
    head.position.y = 10 * S + breath * 0.005 * idle;
    head.rotation.z = Math.sin(t * 0.9) * 0.05 * idle;
    head.rotation.x = Math.sin(t * 0.7 + 1) * 0.03 * idle;

    for (const s of swings) {
      if (s.ear) { // orejas: se inclinan un poco hacia afuera y se mueven al caminar
        s.pv.rotation.z = s.side * (0.12 + Math.sin(phase * 2) * 0.1 * walk * s.amp) + Math.sin(t * 1.9 + s.side) * 0.04 * idle * s.amp;
        s.pv.rotation.x = -0.1 * walk * s.amp;
        continue;
      }
      s.pv.rotation.x = 0.12 * walk + Math.sin(phase * 2) * 0.12 * walk * s.amp + Math.sin(t * 1.7) * 0.04 * idle;
      s.pv.rotation.z = (Math.sin(phase) * 0.18 * walk + Math.sin(t * 1.3) * 0.05 * idle) * s.amp;
    }
    if (tail) { tail.rotation.y = Math.sin(t * (moving ? 9 : 3.2)) * (0.25 + walk * 0.2); tail.rotation.x = -0.1 + Math.sin(t * 1.6) * 0.06; }
    if (cape) cape.rotation.x = 0.08 + walk * 0.35 + Math.sin(t * 3 + phase) * (0.03 + walk * 0.06);
    for (const w of wings) w.pv.rotation.y = w.s * (w.spread + Math.sin(t * (moving ? 14 : 4.5)) * (moving ? 0.35 : 0.18));
    if (cat) cat.position.y = Math.max(0, Math.sin(t * 2.2)) * 0.008;
    if (owl) owl.position.y = Math.max(0, Math.sin(t * 1.4)) * 0.01;
    if (balloon) { balloon.rotation.z = Math.sin(t * 1.3) * 0.12 - walk * 0.15; balloon.rotation.x = Math.sin(t * 0.9) * 0.08 + walk * 0.2; }

    // parpadeo
    blinkIn -= dt;
    if (blinkIn <= 0) {
      blinkLeft = 0.12;
      if (doubleBlink) { doubleBlink = false; blinkIn = 2.2 + Math.random() * 3.2; }
      else { doubleBlink = Math.random() < 0.25; blinkIn = doubleBlink ? 0.25 : 2.2 + Math.random() * 3.2; }
    }
    if (blinkLeft > 0) blinkLeft -= dt;
    eyes.scale.y = blinkLeft > 0 ? eyeY * 0.18 : eyeY;
  };
  root.userData.update(0, false);
  return root;
}

// =====================================================================
//                    VERSIÓN LIVIANA (vecinas de la ciudad)
// Todas las piezas quietas (torso, cabeza, cara, pelo/orejas, corona, brazos, capa, cola, accesorios) se fusionan
// en UNA geometría (cacheada por look); solo las piernas siguen sueltas para caminar. ~12 mallas -> 3.
// =====================================================================
/** Fusiona mallas (con sus matrices de mundo) en una geometría con position/normal/color. */
function mergeMeshes(meshes) {
  const pos = [], nor = [], col = [], idx = [];
  const v = new THREE.Vector3(), n = new THREE.Vector3(), nm = new THREE.Matrix3();
  for (const o of meshes) {
    const g = o.geometry;
    const P = g?.attributes.position, N = g?.attributes.normal, C = g?.attributes.color;
    if (!P || !N) continue;
    const m = o.matrixWorld;
    nm.getNormalMatrix(m);
    const base = pos.length / 3;
    for (let i = 0; i < P.count; i++) {
      v.fromBufferAttribute(P, i).applyMatrix4(m);
      n.fromBufferAttribute(N, i).applyMatrix3(nm).normalize();
      pos.push(v.x, v.y, v.z); nor.push(n.x, n.y, n.z);
      if (C) col.push(C.getX(i), C.getY(i), C.getZ(i)); else col.push(1, 1, 1);
    }
    // con escala negativa (piezas espejadas) hay que dar vuelta los triángulos
    const flip = m.determinant() < 0;
    const I = g.index;
    const cnt = I ? I.count : P.count;
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
  const key = 'npc|' + [look.type, look.skin, look.hair, look.hairColor, look.dress, look.dressColor, look.crown, look.acc].join('|');
  let merged = cacheGet(key);
  let height = cacheGet(key + '|h');
  if (!merged) {
    // se arma una vez el personaje completo en pose neutra y se "hornea" todo menos las piernas
    const full = avatarModel(look, {});
    const P = full.userData.parts;
    P.body.position.set(0, 0, 0); P.body.rotation.set(0, 0, 0);
    P.torso.scale.set(1, 1, 1);
    P.head.position.set(0, 10 * S, 0); P.head.rotation.set(0, 0, 0);
    P.eyes.scale.y = 1;
    for (const sw of P.swings) sw.pv.rotation.set(sw.ear ? 0 : 0.04, 0, sw.ear ? sw.side * 0.12 : 0);
    for (const w of P.wings) w.pv.rotation.y = w.s * w.spread;
    if (P.cape) P.cape.rotation.x = 0.1;
    if (P.tail) P.tail.rotation.set(-0.1, 0.2, 0);
    if (P.balloon) P.balloon.rotation.set(0, 0, 0);
    if (P.cat) P.cat.position.y = 0;
    if (P.owl) P.owl.position.y = 0;
    full.updateMatrixWorld(true);
    const legMeshes = new Set();
    for (const pv of P.legs) pv.traverse(o => { if (o.isMesh) legMeshes.add(o); });
    const list = [];
    full.traverse(o => { if (o.isMesh && o.visible && !legMeshes.has(o)) list.push(o); });
    merged = mergeMeshes(list);
    height = full.userData.height;
    cacheSet(key, merged);
    cacheSet(key + '|h', height);
  }
  const animal = !!avatarType(look.type).animal;
  const p = dressPal(look, animal);
  const dress = DRESS[look.dress] || DRESS.clasico;
  const ck = `${look.dressColor}|${animal ? `a|${look.hair}|${look.hairColor}` : look.skin}`;
  const f = animal ? furPal(look) : null;
  const legGeo = cachedGeo(`l|${look.dress}|${ck}`, (v) => { dress.leg(v, p); if (animal) paintFur(v, FUR_MARK, f, 'leg'); });

  const root = new THREE.Group();
  root.name = 'avatar-npc';
  const body = new THREE.Group();
  root.add(body);
  const main = meshOf(merged);
  body.add(main);
  const legs = [];
  if (legGeo) for (const s of [-1, 1]) {
    const pv = pivot(s, 4, 0);
    const m = meshOf(legGeo);
    m.castShadow = false;
    if (s < 0) m.scale.x = -1;
    pv.add(m); body.add(pv); legs.push(pv);
  }
  if (opts.scale) root.scale.setScalar(opts.scale);

  let t = Math.random() * 10, walk = 0, phase = 0;
  root.userData.look = look;
  root.userData.lowDetail = true;
  root.userData.height = height * (opts.scale || 1);
  root.userData.parts = { body, torso: main, legs };
  root.userData.update = (dt = 0.016, moving = false) => {
    dt = Math.min(dt, 0.1);
    t += dt;
    walk += ((moving ? 1 : 0) - walk) * Math.min(1, dt * 9);
    if (walk > 0.01) phase += dt * 11;
    const sw = Math.sin(phase) * walk;
    const idle = 1 - walk;
    for (let i = 0; i < legs.length; i++) legs[i].rotation.x = (i ? -sw : sw) * 0.75;
    body.position.y = Math.abs(Math.sin(phase)) * 0.045 * walk + Math.sin(t * 2.4) * 0.004 * idle;
    body.rotation.z = Math.sin(phase) * 0.04 * walk + Math.sin(t * 0.9) * 0.015 * idle;
  };
  root.userData.update(0, false);
  return root;
}

// ---------------- Looks aleatorios (vecinas) ----------------
function rng(seed) {
  let a = (seed | 0) ^ 0x9e3779b9;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const HAIR_NATURAL = ['castano', 'negro', 'rubio', 'pelirrojo', 'chocolate'];
// ropa de la gente que pasea: colores sobrios casi siempre (los vivos quedan para quien los elige)
const CLOTHES_SOBER = ['azul', 'verde', 'celeste', 'durazno', 'blanco', 'negro', 'dorado', 'rojo', 'violeta'];
/** Look aleatorio válido y determinista (misma semilla = mismo look). Solo personas (plan §J7). */
export function randomLook(seed = 0) {
  const r = rng(Math.floor(seed * 7919) + 17);
  const pick = (list) => list[Math.floor(r() * list.length) % list.length];
  r(); // la tirada que antes elegía entre gente y animales: se conserva para que los vecinos sigan iguales
  const t = pick(AVATAR_TYPES.filter(x => !x.animal));
  const fit = (list) => list.filter(i => fitsType(i, t.id));
  const skin = Math.floor(r() * SKIN_TONES.length) % SKIN_TONES.length;
  const hair = pick(fit(HAIR_STYLES)).id;
  let hairColor = pick(HAIR_COLORS).id;
  if (hairColor === 'gris' || r() < 0.8) hairColor = pick(HAIR_NATURAL); // canas solo si las elige el jugador
  const dress = pick(fit(DRESS_STYLES)).id;
  const dressColor = r() < 0.85 ? pick(CLOTHES_SOBER) : pick(OUTFIT_COLORS).id;
  const crowns = fit(CROWNS).filter(i => i.id !== 'ninguna');
  const crown = r() < 0.45 || !crowns.length ? 'ninguna' : pick(crowns).id;
  const accs = fit(ACCESSORIES).filter(i => i.id !== 'ninguno');
  const acc = r() < 0.5 || !accs.length ? 'ninguno' : pick(accs).id;
  return { type: t.id, skin, hair, hairColor, dress, dressColor, crown, acc };
}
