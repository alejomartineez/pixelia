// Fondo del combate (pasada visual): en vez del gris liso, un degradé con el color del bioma detrás de todo y un anillo de
// terreno lejano (monte, peñas, bañado o costa) que baja y se pierde en la bruma. Dos mallas y nada por cuadro más que
// acomodar el telón frente a la cámara, así que no cuesta FPS.
//
//   const bd = createBackdrop(scene)
//   bd.setRegion(region)          arma (o toma del caché) el terreno lejano y los colores del degradé
//   bd.update(camera, ambient)    cada cuadro: el telón queda detrás de todo; ambient es el color de fondo que deja el
//                                 ambiente (hora y clima, src/core/ambience-fx.js) y tiñe el degradé
//   bd.dispose()
import * as THREE from 'three';
import { Voxels, voxelMaterial, shade } from '../core/voxel.js';

// paleta lejana por región: cielo arriba, bruma en el horizonte, suelo abajo, y el terreno (cerca → lejos se va a la bruma)
const FAR = {
  bosque: { top: '#16201f', haze: '#3a5147', low: '#0d1310', land: ['#22361f', '#1d301c', '#284023'], tree: '#16251a', rock: '#34352f' },
  cerro: { top: '#18161d', haze: '#46434c', low: '#0f0e12', land: ['#332e29', '#2c2824', '#3a342e'], tree: '#28231f', rock: '#423c36' },
  banado: { top: '#121d20', haze: '#38534f', low: '#0b1416', land: ['#243322', '#1f2d1e', '#2a3a27'], water: ['#16303a', '#1a3640'], tree: '#2a2a1e', rock: '#33352f' },
  costa: { top: '#171d2a', haze: '#47536c', low: '#10141f', land: ['#40392c', '#3a3328', '#4a4133'], water: ['#1c2c44', '#22344d'], tree: '#33251a', rock: '#3c3c42' },
};
const VS = 1 / 4;              // vóxel del terreno lejano: más grueso, total está lejos y en la bruma
const R_IN = 14, R_OUT = 68;   // en vóxeles de VS: desde abajo de la isla (no queda hueco) hasta 17 casillas del centro
const cache = new Map();

const hash = (x, z) => { let h = (x * 374761393 + z * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
function noise(x, z) {   // ruido de valor suave, para lomas
  const xi = Math.floor(x), zi = Math.floor(z), fx = x - xi, fz = z - zi;
  const s = (t) => t * t * (3 - 2 * t);
  const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1);
  return a + (b - a) * s(fx) + (c - a) * s(fz) + (a - b - c + d) * s(fx) * s(fz);
}
const mix = (a, b, t) => { const A = new THREE.Color(a), B = new THREE.Color(b); return '#' + A.lerp(B, t).getHexString(); };

function farGeometry(region) {
  if (cache.has(region)) return cache.get(region);
  const F = FAR[region] || FAR.bosque;
  const v = new Voxels();
  for (let x = -R_OUT; x <= R_OUT; x++) for (let z = -R_OUT; z <= R_OUT; z++) {
    const d = Math.hypot(x, z);
    if (d < R_IN || d > R_OUT) continue;
    const k = Math.min(1, Math.max(0, (d - 22) / 30));    // 0 junto a la isla, 1 a 13 casillas (de ahí en más, bruma)
    const n = noise(x / 9, z / 9) * 0.7 + noise(x / 4, z / 4) * 0.3;
    const wet = F.water && n < (region === 'banado' ? 0.52 : 0.4);
    // el terreno baja hacia afuera (la isla queda arriba) y se va a la bruma
    let top = Math.round(-8 - k * 10 + n * 2.5);   // lomas suaves: con más relieve se vuelve una alfombra de cubos
    if (wet) top = Math.round(-8 - k * 10);
    const fog = Math.min(0.97, Math.pow(k, 0.8) * 0.8 + 0.2);
    const base = wet ? F.water[(x + z) & 1 ? 1 : 0] : F.land[hash(x >> 1, z >> 1) < 0.3 ? 1 : hash(x, z) < 0.15 ? 2 : 0];
    const col = mix(base, F.haze, fog);
    for (let y = top - 2; y <= top; y++) v.set(x, y, z, y === top ? col : mix(shade(base, -0.12), F.haze, fog));
    // siluetas: árboles, juncos o postes en la primera franja, peñas sueltas más allá
    if (!wet && d > 24 && k < 0.5 && hash(x * 3 + 7, z * 5 + 1) < 0.012) {
      const h = 3 + Math.floor(hash(x, z * 3) * 4);
      const tc = mix(F.tree, F.haze, fog * 0.9);
      for (let y = 1; y <= h; y++) v.set(x, top + y, z, tc);
      if (region !== 'costa') for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) v.set(x + dx, top + h - 1, z + dz, tc);
    } else if (!wet && hash(x * 7 + 3, z * 11) < 0.01) {
      const rc = mix(F.rock, F.haze, fog);
      v.box(x, top + 1, z, 2, 1 + Math.floor(hash(z, x) * 3), 2, rc);
    }
    if (wet && region === 'banado' && hash(x * 13, z * 7) < 0.05) for (let y = 1; y <= 2; y++) v.set(x, top + y, z, mix('#5c5733', F.haze, fog));
  }
  const geo = v.toGeometry({ scale: VS, ao: true, jitter: 0.01 });
  cache.set(region, geo);
  return geo;
}

export function createBackdrop(scene) {
  // telón: un plano enorme frente a la cámara, detrás de todo; el degradé va en coordenadas de pantalla, con trama 4×4
  // (pixel art) en vez de un degradé liso
  const uni = {
    cTop: { value: new THREE.Color() }, cHaze: { value: new THREE.Color() }, cLow: { value: new THREE.Color() },
    amb: { value: new THREE.Color(0x141a17) }, ambK: { value: 0.16 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms: uni, depthWrite: true, fog: false,
    vertexShader: /* glsl */`
      varying float vY;
      void main() { vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); vY = p.y / p.w; gl_Position = p; }`,
    fragmentShader: /* glsl */`
      uniform vec3 cTop; uniform vec3 cHaze; uniform vec3 cLow; uniform vec3 amb; uniform float ambK;
      varying float vY;
      float bayer(vec2 p) {
        vec2 q = mod(floor(p), 4.0);
        float i = q.x + q.y * 4.0;
        // 4×4 de Bayer en una tabla corta
        if (i < 1.0) return 0.0; if (i < 2.0) return 8.0; if (i < 3.0) return 2.0; if (i < 4.0) return 10.0;
        if (i < 5.0) return 12.0; if (i < 6.0) return 4.0; if (i < 7.0) return 14.0; if (i < 8.0) return 6.0;
        if (i < 9.0) return 3.0; if (i < 10.0) return 11.0; if (i < 11.0) return 1.0; if (i < 12.0) return 9.0;
        if (i < 13.0) return 15.0; if (i < 14.0) return 7.0; if (i < 15.0) return 13.0; return 5.0;
      }
      void main() {
        float t = clamp(vY * 0.5 + 0.5, 0.0, 1.0);
        // banda de bruma clara un poco arriba del centro (donde se pierde el terreno), cielo arriba y suelo abajo
        float steps = 14.0;
        float d = (bayer(gl_FragCoord.xy / 3.0) / 16.0 - 0.5) / steps;
        float tq = floor((t + d) * steps + 0.5) / steps;
        vec3 c = tq > 0.62 ? mix(cHaze, cTop, smoothstep(0.62, 1.0, tq)) : mix(cLow, cHaze, smoothstep(0.0, 0.62, tq));
        c = mix(c, amb, ambK);
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
  screen.frustumCulled = false; screen.renderOrder = -10; screen.scale.setScalar(600);
  scene.add(screen);
  const land = new THREE.Mesh(farGeometry('bosque'), voxelMaterial());
  land.receiveShadow = false; land.castShadow = false;
  scene.add(land);
  const dir = new THREE.Vector3();
  return {
    setRegion(region) {
      const F = FAR[region] || FAR.bosque;
      uni.cTop.value.set(F.top); uni.cHaze.value.set(F.haze); uni.cLow.value.set(F.low);
      land.geometry = farGeometry(region);
    },
    update(camera, ambient) {
      camera.getWorldDirection(dir);
      screen.position.copy(camera.position).addScaledVector(dir, 160);
      screen.quaternion.copy(camera.quaternion);
      if (ambient?.isColor) uni.amb.value.copy(ambient);
    },
    dispose() {
      scene.remove(screen, land);
      screen.geometry.dispose(); mat.dispose();   // el terreno lejano queda en el caché (es por región y se reusa)
    },
  };
}
