// Siluetas de los ecos de noche (L6; datos en echoes.js). Las figuras son la gente de siempre (avatarModel del 4a, con
// su pueblo y su contextura) pintadas de un celeste apagado y traslúcido: repiten en bucle (unos 6,5 s) un momento de
// antes del Quiebre, aparecen, hacen lo suyo y se desvanecen. Sin color ni cara: se leen como un recuerdo. Si el modelo
// de personas falla, queda una figura de bloques con la misma forma.
//   const fx = createEcho('mapa', { scale: 1 }); scene.add(fx.group); fx.update(t); fx.pick (malla para el clic); fx.dispose()
import * as THREE from 'three';
import { avatarModel, randomLook } from '../avatar/avatar.js';

export const ECHO_LOOP = 6.5;
const GHOST = '#a9dcf0';
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);

/**
 * Una persona del eco (≈ 0,8 × h de alto): el avatar con el material fantasma. userData: head, arms [izq, der] (pivote en
 * el hombro) y hands (grupos en la punta del brazo, en las unidades del eco, para colgar herramientas).
 * o: { h, wide, type (pueblo), build, seed }
 */
function figure(mat, o = {}) {
  try { return personFigure(mat, o); } catch (e) { console.warn('[eco] figura de bloques', e); return blockFigure(mat, o); }
}
function personFigure(mat, { h = 1, wide = 1, type = 'humano', build = null, seed = 1 } = {}) {
  const look = { ...randomLook(seed, { type }), build: build || (wide > 1.05 ? 'recio' : 'esbelto'), crown: 'ninguna', acc: 'ninguno' };
  const body = avatarModel(look);
  const P = body.userData.parts || {};
  if (!P.head || !P.armL || !P.armR) throw new Error('sin partes');
  body.traverse(m => { if (m.isMesh) { m.material = mat; m.castShadow = false; m.receiveShadow = false; m.renderOrder = 9; m.userData.shared = true; } });
  const k = (0.8 * h) / (body.userData.height || 1);
  // manos: grupos en la punta de cada brazo, con la escala del eco
  body.updateMatrixWorld(true);
  const hands = [P.armL, P.armR].map(arm => {
    const top = new THREE.Vector3().setFromMatrixPosition(arm.matrixWorld);
    const bb = new THREE.Box3().setFromObject(arm);
    const hold = new THREE.Group();
    hold.position.set(0, bb.min.y - top.y, 0);
    hold.scale.setScalar(1 / k);
    arm.add(hold);
    return hold;
  });
  body.scale.setScalar(k);
  const g = new THREE.Group();
  g.add(body);
  g.userData = { head: P.head, arms: [P.armL, P.armR], hands, height: 0.8 * h };
  return g;
}
/** Figura de bloques (si falla el avatar): piernas, torso, brazos con pivote en el hombro y cabeza. */
function blockFigure(mat, { h = 1, wide = 1 } = {}) {
  const g = new THREE.Group();
  const add = (geo, x, y, z, parent = g) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.renderOrder = 9; parent.add(m); return m; };
  const legH = 0.32 * h, bodyH = 0.3 * h;
  add(box(0.09, legH, 0.1), -0.06, legH / 2, 0);
  add(box(0.09, legH, 0.1), 0.06, legH / 2, 0);
  add(box(0.26 * wide, bodyH, 0.14), 0, legH + bodyH / 2, 0);
  const head = new THREE.Group(); head.position.set(0, legH + bodyH + 0.02, 0); g.add(head);
  add(box(0.15, 0.15, 0.15), 0, 0.08, 0, head);
  const arms = [-1, 1].map(s => {
    const a = new THREE.Group(); a.position.set(s * (0.15 * wide + 0.03), legH + bodyH - 0.02, 0); g.add(a);
    add(box(0.07, 0.26 * h, 0.08), 0, -0.13 * h, 0, a);
    return a;
  });
  const hands = arms.map(a => { const hd = new THREE.Group(); hd.position.y = -0.26 * h; a.add(hd); return hd; });
  g.userData = { head, arms, hands, height: legH + bodyH + 0.18 };
  return g;
}

const ease = (k) => k * k * (3 - 2 * k);
/** Coreografías: arman la escena y devuelven update(p) con p en 0..1 a lo largo del bucle. */
const SCENES = {
  cavar(g, mat) {
    const a = figure(mat, { type: 'enano', build: 'recio', seed: 11 }), b = figure(mat, { h: 0.95, type: 'enano', build: 'esbelto', seed: 23 });
    a.position.set(-0.22, 0, 0); b.position.set(0.25, 0, 0.05); b.rotation.y = -0.6; a.rotation.y = 0.3;
    const pick = new THREE.Mesh(box(0.04, 0.04, 0.34), mat); pick.position.set(0, 0, 0.14); a.userData.hands[0].add(pick);
    const post = new THREE.Mesh(box(0.04, 0.6, 0.04), mat); post.position.set(0.02, 0.3, -0.3);
    const lamp = new THREE.Mesh(box(0.1, 0.1, 0.1), mat); lamp.position.set(0.02, 0.62, -0.3);
    g.add(a, b, post, lamp);
    return (p) => {
      const sw = p < 0.62 ? Math.sin(p * Math.PI * 7) : 0;
      a.userData.arms[0].rotation.x = -1.4 + sw * 0.9; a.userData.arms[1].rotation.x = -1.2 + sw * 0.8;
      a.userData.head.rotation.x = p > 0.62 ? 0.35 : 0.1;
      // el otro deja de cavar, mira el piso y le alcanza la pala
      b.userData.head.rotation.x = p > 0.35 && p < 0.6 ? 0.5 : 0;
      b.userData.arms[1].rotation.x = p > 0.6 ? -1.2 * ease(Math.min(1, (p - 0.6) / 0.15)) : 0;
    };
  },
  subir(g, mat) {
    const slab = new THREE.Mesh(box(0.9, 0.08, 0.6), mat); slab.position.set(-0.15, 0.04, 0);
    const fam = [figure(mat, { seed: 31, build: 'recio' }), figure(mat, { h: 0.92, wide: 0.9, seed: 37 }), figure(mat, { h: 0.6, wide: 0.75, seed: 41 })];
    fam.forEach((f, i) => { f.position.set(-0.45 + i * 0.27, 0.08, 0); slab.add(f); f.position.y = 0.04; });
    const other = figure(mat, { seed: 43 }); other.position.set(0.62, 0, 0.1); other.rotation.y = -1.2;
    g.add(slab, other);
    return (p) => {
      slab.position.y = 0.04 + ease(Math.min(1, p / 0.8)) * 0.45;
      for (const f of fam) f.userData.head.rotation.x = -0.45;
      other.userData.head.rotation.x = -0.3 - p * 0.3;
      other.userData.arms[1].rotation.z = p > 0.4 ? -2.4 : -2.4 * ease(p / 0.4);
    };
  },
  mapa(g, mat) {
    const table = new THREE.Mesh(box(0.5, 0.06, 0.34), mat); table.position.set(0, 0.36, 0);
    for (const [x, z] of [[-0.2, -0.13], [0.2, -0.13], [-0.2, 0.13], [0.2, 0.13]]) { const l = new THREE.Mesh(box(0.04, 0.34, 0.04), mat); l.position.set(x, 0.17, z); g.add(l); }
    const sheet = new THREE.Mesh(box(0.3, 0.012, 0.22), mat); sheet.position.set(0, 0.4, 0);
    const girl = figure(mat, { h: 0.78, wide: 0.85, seed: 53 }); girl.position.set(0, 0, -0.32);
    const lord = figure(mat, { h: 1.12, wide: 1.15, seed: 59 }); lord.position.set(0.42, 0, 0.12); lord.rotation.y = -1.9;
    g.add(table, sheet, girl, lord);
    return (p) => {
      girl.userData.arms[1].rotation.x = -1.1 + Math.sin(p * Math.PI * 9) * 0.12;
      girl.userData.arms[1].rotation.z = Math.sin(p * Math.PI * 5) * 0.12;
      girl.userData.head.rotation.x = 0.45;
      // el señor de la Casa señala un punto, siempre el mismo
      const k = p > 0.3 && p < 0.85 ? 1 : 0;
      lord.userData.arms[0].rotation.x = -1.35 * k;
      lord.userData.head.rotation.x = 0.3 * k;
      girl.userData.head.rotation.y = p > 0.55 && p < 0.75 ? 0.5 : 0;
    };
  },
  permiso(g, mat) {
    const table = new THREE.Mesh(box(0.42, 0.06, 0.3), mat); table.position.set(0, 0.34, 0);
    const clerk = figure(mat, { h: 0.82, seed: 61 }); clerk.position.set(0, 0, -0.3);
    const buyer = figure(mat, { h: 1.05, wide: 1.1, seed: 67 });
    const bag = new THREE.Mesh(box(0.1, 0.1, 0.1), mat);
    const post = new THREE.Mesh(box(0.04, 0.7, 0.04), mat); post.position.set(-0.36, 0.35, -0.2);
    const lamp = new THREE.Mesh(box(0.1, 0.1, 0.1), mat); lamp.position.set(-0.36, 0.72, -0.2);
    g.add(table, clerk, buyer, bag, post, lamp);
    return (p) => {
      clerk.userData.arms[1].rotation.x = -1.0 + Math.sin(p * Math.PI * 11) * 0.1;
      clerk.userData.head.rotation.x = 0.4;
      // el otro llega, deja la bolsa y se va
      const walk = p < 0.35 ? 1 - ease(p / 0.35) : p > 0.6 ? ease((p - 0.6) / 0.3) : 0;
      buyer.position.set(0.3 + walk * 0.7, 0, 0.32);
      buyer.rotation.y = p > 0.6 ? Math.PI / 2 : -Math.PI / 2;
      const left = p > 0.45;
      bag.position.set(left ? 0.1 : buyer.position.x - 0.12, left ? 0.42 : 0.38, left ? 0.04 : 0.32);
    };
  },
  farero(g, mat, lampMat) {
    const tower = new THREE.Mesh(box(0.22, 0.9, 0.22), mat); tower.position.set(-0.2, 0.45, -0.1);
    const lamp = new THREE.Mesh(box(0.3, 0.2, 0.3), lampMat); lamp.position.set(-0.2, 1.0, -0.1);
    const man = figure(mat, { seed: 71, build: 'recio' }); man.position.set(0.25, 0, 0.12); man.rotation.y = -0.7;
    g.add(tower, lamp, man);
    return (p) => {
      lampMat.opacity = mat.opacity * (p < 0.4 ? 1 : Math.max(0.1, 1 - (p - 0.4) / 0.15));
      man.userData.arms[0].rotation.x = p > 0.3 && p < 0.45 ? -1.6 : 0;
      man.userData.head.rotation.x = p > 0.5 ? -0.5 : 0;
    };
  },
};
export const ECHO_SCENES = Object.keys(SCENES);

/** Arma la silueta de un eco. scale: tamaño en el mundo (1 ≈ una casilla). */
export function createEcho(sceneId, { scale = 1, opacity = 0.42 } = {}) {
  const mat = new THREE.MeshBasicMaterial({ color: GHOST, transparent: true, opacity: 0, depthWrite: false });
  const lampMat = new THREE.MeshBasicMaterial({ color: '#ffe3a0', transparent: true, opacity: 0, depthWrite: false });
  const group = new THREE.Group();
  const inner = new THREE.Group();
  group.add(inner);
  const step = (SCENES[sceneId] || SCENES.cavar)(inner, mat, lampMat);
  // halo en el piso: se ve de lejos y es lo que recibe el clic
  const halo = new THREE.Mesh(new THREE.CircleGeometry(0.62, 24), new THREE.MeshBasicMaterial({ color: GHOST, transparent: true, opacity: 0, depthWrite: false }));
  halo.rotation.x = -Math.PI / 2; halo.position.y = 0.02; halo.renderOrder = 8;
  group.add(halo);
  const pick = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 1.3, 10), new THREE.MeshBasicMaterial({ visible: false }));
  pick.position.y = 0.65;
  group.add(pick);
  group.scale.setScalar(scale);
  group.name = 'echo:' + sceneId;
  let fading = 0, gone = false, lastT = null;
  const api = {
    group, pick, sceneId,
    /** t en segundos. Devuelve false cuando terminó de irse (después de verlo). */
    update(t) {
      const p = ((t % ECHO_LOOP) + ECHO_LOOP) % ECHO_LOOP / ECHO_LOOP;
      step(p);
      const loopA = p < 0.12 ? p / 0.12 : p > 0.85 ? Math.max(0, 1 - (p - 0.85) / 0.15) : 1;
      // el desvanecido va con el reloj real (la ciudad limita el dt por cuadro: con pocos FPS tardaba demasiado)
      const now = performance.now() / 1000;
      const dt = lastT == null ? 0 : Math.max(0, Math.min(0.5, now - lastT));
      lastT = now;
      if (fading) fading = Math.max(0, fading - dt / 1.2);
      const k = gone ? 0 : api.leaving ? fading : 1;
      mat.opacity = opacity * (0.25 + 0.75 * loopA) * k;
      if (sceneId !== 'farero') lampMat.opacity = mat.opacity;
      halo.material.opacity = (0.12 + 0.06 * Math.sin(t * 2)) * k;
      inner.position.y = Math.sin(t * 1.3) * 0.015;
      if (fading === 0 && api.leaving) { gone = true; return false; }
      return true;
    },
    /** Después del clic: se desvanece. */
    leave() { if (!api.leaving) { api.leaving = true; fading = 1; } },
    leaving: false,
    dispose() {
      group.traverse(o => { if (o.isMesh && !o.userData.shared) o.geometry.dispose(); });
      mat.dispose(); lampMat.dispose(); halo.material.dispose(); pick.material.dispose();
      group.removeFromParent();
    },
  };
  return api;
}
