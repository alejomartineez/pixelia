// La Grieta que se ve (PLAN-QUIEBRE L1 + J5): fisuras que brillan en el borde de la isla de la ciudad. Bajan por el
// acantilado y entran un poco en el pasto; con más Grieta hay más, son más largas y laten más fuerte (y más de noche).
// Una sola malla instanciada, sin sombra y sin luz propia (material básico, como las vetas de los edificios).
// api = { ctx, r }. Lee state.world.grieta y se rehace con 'world:grieta'. ?grieta=N manda sobre el valor (capturas).
import * as THREE from 'three';
import { islandEdgeSpots } from './city-world.js';
import { isNightHour, cityHour } from '../core/ambience.js';
import { hash2 } from './city-common.js';

const qs = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
const Q_GRIETA = qs.has('grieta') ? Math.max(0, Math.min(100, Number(qs.get('grieta')) || 0)) : null;
const MAX = 900;
const GLOW = new THREE.Color('#ff8a1c'), HOT = new THREE.Color('#ffc65a'), DIM = new THREE.Color('#7a3208');

export function createCityGrieta({ ctx, r }) {
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mat = new THREE.MeshBasicMaterial({ color: GLOW.clone() });
  const mesh = new THREE.InstancedMesh(geo, mat, MAX);
  mesh.name = 'grieta';
  mesh.castShadow = false; mesh.receiveShadow = false;
  mesh.frustumCulled = false;
  mesh.count = 0;
  r.scene.add(mesh);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = new THREE.Vector3(), scl = new THREE.Vector3();
  let level = -1, t = 0;
  const value = () => (Q_GRIETA != null ? Q_GRIETA : Number(ctx.state.world?.grieta) || 0);

  function put(x, y, z, sx, sy, sz) {
    if (mesh.count >= MAX) return;
    pos.set(x, y, z); scl.set(sx, sy, sz);
    m4.compose(pos, q, scl);
    mesh.setMatrixAt(mesh.count++, m4);
  }
  /** Una fisura: baja zigzagueando por la cara del acantilado y entra en el pasto hacia adentro. */
  function crack(s, k, g) {
    const tx = -s.nz, tz = s.nx;                       // tangente al borde
    const out = 0.03;
    // por el acantilado
    const down = Math.min(s.depth * 0.95, 0.5 + s.depth * (0.25 + 0.7 * g / 100));
    let u = 0;
    for (let y = 0, j = 0; y < down; y += 0.12, j++) {
      u += (hash2(k, j, 5) - 0.5) * 0.14;
      u = Math.max(-0.4, Math.min(0.4, u));
      const w = 0.07 + 0.08 * (1 - y / down) * (g / 100);
      put(s.x + s.nx * out + tx * u, -y - 0.06, s.z + s.nz * out + tz * u, Math.abs(s.nx) ? 0.04 : w, 0.13, Math.abs(s.nz) ? 0.04 : w);
      // ramitas a los costados
      if (hash2(k, j, 11) < 0.12 * (g / 50)) for (let b = 1; b <= 2; b++) put(s.x + s.nx * out + tx * (u + b * 0.07), -y - 0.06 - b * 0.06, s.z + s.nz * out + tz * (u + b * 0.07), 0.05, 0.05, 0.05);
    }
    // por arriba, hacia adentro
    const inward = 0.25 + 1.5 * g / 100;
    let v = 0;
    for (let d = 0, j = 0; d < inward; d += 0.09, j++) {
      v += (hash2(k, j, 23) - 0.5) * 0.12;
      v = Math.max(-0.35, Math.min(0.35, v));
      const w = 0.1 + 0.06 * (1 - d / inward) * (g / 100);
      put(s.x - s.nx * d + tx * (u + v), 0.012, s.z - s.nz * d + tz * (u + v), w, 0.02, w);
    }
  }
  function rebuild(force = false) {
    const g = value();
    const band = g < 1 ? 0 : Math.ceil(g / 5) * 5;
    if (!force && band === level) return;
    level = band;
    mesh.count = 0;
    if (band > 0) {
      const n = Math.min(12, 2 + Math.floor(band / 9));
      islandEdgeSpots(n, 7).forEach((s, k) => crack(s, k, band));
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.visible = mesh.count > 0;
  }
  rebuild(true);
  const off = ctx.bus.on('world:grieta', () => rebuild());
  return {
    mesh,
    get level() { return level; },
    get count() { return mesh.count; },
    rebuild,
    update(dt) {
      if (!mesh.visible) return;
      t += dt;
      const night = isNightHour(cityHour()) ? 1 : 0;
      // laten: más rápido y más fuerte con más Grieta, y de noche se ven más
      const k = level / 100;
      const beat = 0.5 + 0.5 * Math.sin(t * (1.2 + 1.6 * k));
      const a = Math.min(1, 0.6 + 0.3 * night + 0.25 * k);
      mat.color.copy(DIM).lerp(GLOW, a).lerp(HOT, beat * (0.1 + 0.3 * k));
    },
    dispose() { off?.(); r.scene.remove(mesh); geo.dispose(); mat.dispose(); mesh.dispose?.(); },
  };
}
