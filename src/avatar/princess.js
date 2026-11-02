// STUB temporal (lo reemplaza el agente de avatar). API definitiva en DESIGN.md.
import * as THREE from 'three';
import { Voxels } from '../core/voxel.js';
import { OUTFIT_COLORS, SKIN_TONES, HAIR_COLORS } from '../core/data.js';
export function princessModel(look) {
  const c = (list, id) => (list.find(x => x.id === id) || list[0]).hex;
  const v = new Voxels();
  v.box(2, 0, 2, 6, 9, 4, c(OUTFIT_COLORS, look.dressColor));
  v.box(3, 9, 2, 4, 4, 4, SKIN_TONES[look.skin] || SKIN_TONES[0]);
  v.box(3, 13, 2, 4, 1, 4, c(HAIR_COLORS, look.hairColor));
  const g = new THREE.Group(); const m = v.toMesh({ scale: 1 / 14, center: 'xz' }); g.add(m);
  g.userData.update = (dt, moving) => { m.position.y = moving ? Math.abs(Math.sin(performance.now() / 120)) * 0.04 : 0; };
  return g;
}
export function randomLook(seed = 0) {
  const r = (n) => { seed = (seed * 9301 + 49297) % 233280; return Math.floor(seed / 233280 * n); };
  return { skin: r(6), hair: 'largo', hairColor: HAIR_COLORS[r(HAIR_COLORS.length)].id, dress: 'clasico', dressColor: OUTFIT_COLORS[r(OUTFIT_COLORS.length)].id, crown: 'ninguna', acc: 'ninguno' };
}
