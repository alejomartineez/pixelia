// Aplica el ambiente (src/core/ambience.js) a una escena 3D: luces, cielo, corrección de color y niebla del pase final
// (voxel.js setGrade), ventanas de noche (setNightGlow), partículas del clima y relámpagos.
// Las partículas siguen Ajustes → Gráficos → Partículas (graphics().particles); con "reducir movimiento" no cae nada
// ni hay relámpagos (queda el color del clima).
//
//   const amb = createAmbience(r, { lights, sky: container | null, place, fog: { near, far }, base })
//   amb.set({ hour, weather, place, region, light })   cuando cambie algo (los valores se acercan solos, sin saltos)
//   amb.update(dt, center)                              cada cuadro; center = punto del mundo alrededor del que llueve
import * as THREE from 'three';
import { graphics, setNightGlow } from './voxel.js';
import { reducedMotion } from './ui.js';
import { resolveLook, mixHex, skyCss } from './ambience.js';

const MAX = 480;
const lerp = (a, b, t) => a + (b - a) * t;

export function createAmbience(r, opts = {}) {
  const { lights } = opts;
  const skyEl = opts.sky || null;               // con un elemento, el cielo es CSS detrás del canvas (la ciudad)
  const fogNF = opts.fog || { near: 50, far: 90 };
  let base = opts.base || {};
  const want = { hour: 12, weather: 'despejado', place: opts.place || 'city', region: null, light: 1, frost: 0 };
  let cur = null, target = null, retarget = 0, skyStr = '', flashT = 0, nextFlash = 4 + Math.random() * 5, gone = false;
  const area = { x: 12, z: 12, top: 10 };

  // ---------- partículas del clima ----------
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, depthWrite: false });
  const mesh = new THREE.InstancedMesh(geo, mat, MAX);
  mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = false; mesh.renderOrder = 7; mesh.count = 0;
  r.scene.add(mesh);
  const P = Array.from({ length: MAX }, () => ({ x: 0, y: 0, z: 0, v: 1, ph: Math.random() * 6.28 }));
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3(), eu = new THREE.Euler();
  let kind = null, seeded = false;
  const KINDS = {
    rain: { color: '#cfdcea', opacity: 0.62, size: [0.045, 0.55, 0.045], fall: 13, up: false },
    snow: { color: '#f4f8ff', opacity: 0.85, size: [0.07, 0.07, 0.07], fall: 1.3, up: false, drift: 0.5 },
    ash: { color: '#8a8580', opacity: 0.8, size: [0.06, 0.03, 0.06], fall: 0.9, up: false, drift: 0.7 },
    ember: { color: '#ff9a4a', opacity: 0.9, size: [0.05, 0.05, 0.05], fall: -1.1, up: true, drift: 0.6 },
    dust: { color: '#d9c08a', opacity: 0.55, size: [0.05, 0.05, 0.05], fall: 0.2, up: false, drift: 1.4 },
  };
  function seed(i, k, c, top = false) {
    const p = P[i];
    p.x = c.x + (Math.random() * 2 - 1) * area.x;
    p.z = c.z + (Math.random() * 2 - 1) * area.z;
    p.y = k.up ? Math.random() * 1.5 : top ? area.top * (0.7 + Math.random() * 0.3) : Math.random() * area.top;
    p.v = 0.75 + Math.random() * 0.5;
  }
  function particles(dt, look, c) {
    const fx = look.fx;
    const n = fx && !reducedMotion() ? Math.min(MAX, Math.round(MAX * Math.min(1, fx.rate) * Math.min(1.5, graphics().particles ?? 1) * 0.8)) : 0;
    if (!n) { mesh.count = 0; kind = null; return; }
    const k = KINDS[fx.kind] || KINDS.rain;
    if (kind !== fx.kind) { kind = fx.kind; seeded = false; mat.color.set(k.color); mat.opacity = k.opacity; }
    if (!seeded) { for (let i = 0; i < MAX; i++) seed(i, k, c); seeded = true; }
    const wind = (fx.wind || 0) * 2.2;
    // la lluvia cae inclinada por el viento
    eu.set(0, 0, k.fall > 4 ? -Math.atan2(wind, k.fall) : 0); q.setFromEuler(eu);
    sc.set(k.size[0], k.size[1], k.size[2]);
    for (let i = 0; i < n; i++) {
      const p = P[i];
      p.y -= k.fall * p.v * dt;
      p.x += (wind + (k.drift ? Math.sin(p.ph + p.y * 1.7) * k.drift : 0)) * dt;
      if (k.up ? p.y > area.top * 0.8 : p.y < 0) seed(i, k, c, true);
      if (Math.abs(p.x - c.x) > area.x * 1.15 || Math.abs(p.z - c.z) > area.z * 1.15) seed(i, k, c, !k.up);
      ps.set(p.x, p.y, p.z);
      if (!k.fall || k.fall < 4) { eu.set(p.ph + p.y, p.ph * 2 + p.y, 0); q.setFromEuler(eu); }
      m4.compose(ps, q, sc);
      mesh.setMatrixAt(i, m4);
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
  }

  // ---------- mezcla y aplicación ----------
  function compute() {
    return resolveLook({ base, place: want.place, hour: want.hour, weather: want.weather, light: want.light, region: want.region, frost: want.frost });
  }
  function ease(a, b, t) {
    a.sky = a.sky.length === b.sky.length ? a.sky.map(([c, p], i) => [mixHex(c, b.sky[i][0], t), b.sky[i][1]]) : b.sky;
    for (const k of ['stars', 'hemiI', 'sunI', 'sunTurn', 'sat', 'glow', 'frost']) a[k] = lerp(a[k], b[k], t);
    for (const k of ['hemiSky', 'hemiGround', 'sun']) a[k] = mixHex(a[k], b[k], t);
    a.tint = a.tint.map((v, i) => lerp(v, b.tint[i], t));
    a.fog = { amt: lerp(a.fog.amt, b.fog.amt, t), color: mixHex(a.fog.color, b.fog.color, t) };
    Object.assign(a, { fx: b.fx, flash: b.flash, phase: b.phase, night: b.night, weather: b.weather, place: b.place, veins: b.veins });
  }
  function apply(look, flash) {
    if (lights) {
      lights.hemi.color.set(look.hemiSky); lights.hemi.groundColor.set(look.hemiGround);
      lights.hemi.intensity = look.hemiI * (1 + flash * 2.2);
      lights.sun.color.set(look.sun); lights.sun.intensity = look.sunI * (1 + flash * 0.6);
      // el sol gira un poco con la hora (las dos paredes que se ven siguen con tonos distintos)
      const s = lights.sun, b0 = s.userData.base || (s.userData.base = s.position.clone());
      const turn = Math.max(-1, Math.min(1, look.sunTurn)) * (look.night ? 0 : 0.32);
      const cs = Math.cos(turn), sn = Math.sin(turn);
      s.position.set(b0.x * cs - b0.z * sn, b0.y * (look.night ? 1 : 0.86 + 0.14 * (1 - Math.abs(look.sunTurn))), b0.x * sn + b0.z * cs);
    }
    const g = 1 + flash * 0.5;
    // de noche las luces brillan más (bloom)
    r.setGrade({ sat: look.sat, tint: look.tint.map(v => v * g), bloomBoost: (look.glow || 0) * 1.6, fog: { amt: look.fog.amt, color: look.fog.color, near: fogNF.near, far: fogNF.far } });
    setNightGlow(look.glow);
    if (skyEl) {
      const css = skyCss(look.sky);
      if (css !== skyStr) { skyStr = css; skyEl.style.setProperty('--cx-sky', css); skyEl.style.setProperty('--cx-stars', look.stars.toFixed(2)); }
    } else if (r.scene.background?.isColor) {
      const bg = mixHex(look.sky[look.sky.length - 1][0], look.fog.color, Math.min(1, look.fog.amt * 1.4));
      r.scene.background.set(bg);
    }
  }

  const api = {
    /** Cambia lo que se quiere ver; el cambio se acerca en unos segundos (salvo `now: true`). */
    set(o = {}, { now = false } = {}) {
      for (const k of Object.keys(want)) if (o[k] !== undefined && o[k] !== null) want[k] = o[k];
      if (o.weather === null) want.weather = 'despejado';
      retarget = 0;
      if (now || !cur) { cur = compute(); target = cur; apply(cur, 0); }
    },
    setBase(b) { base = b || {}; retarget = 0; },
    /** Alto y ancho del área donde cae el clima (unidades de mundo). */
    setArea(x, z, top = 10) { area.x = x; area.z = z; area.top = top; seeded = false; },
    get want() { return { ...want }; },
    get look() { return cur; },
    get particles() { return mesh.count; },
    update(dt, center = { x: 0, z: 0 }) {
      if (gone) return;
      if (!cur) api.set({}, { now: true });
      retarget -= dt;
      if (retarget <= 0) { retarget = 0.25; target = compute(); }
      ease(cur, target, Math.min(1, dt * 1.6));
      // relámpagos (nunca con reducir movimiento)
      let fl = 0;
      if (cur.flash && !reducedMotion()) {
        nextFlash -= dt;
        if (nextFlash <= 0) { nextFlash = 5 + Math.random() * 8; flashT = 0.32; opts.onThunder?.(); }
      }
      if (flashT > 0) { flashT -= dt; fl = Math.max(0, flashT / 0.32) * (flashT > 0.2 || flashT < 0.1 ? 1 : 0.35); }
      apply(cur, fl);
      particles(dt, cur, center);
    },
    dispose() {
      gone = true;
      r.scene.remove(mesh); geo.dispose(); mat.dispose(); mesh.dispose?.();
      setNightGlow(0);
      r.setGrade(null);
    },
  };
  return api;
}
