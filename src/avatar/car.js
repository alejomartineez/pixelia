// STUB temporal (lo reemplaza el agente de avatar). API definitiva en DESIGN.md.
import * as THREE from 'three';
import { Voxels } from '../core/voxel.js';
import { OUTFIT_COLORS } from '../core/data.js';
export function carModel(car) {
  const col = (OUTFIT_COLORS.find(x => x.id === car.color) || OUTFIT_COLORS[0]).hex;
  const v = new Voxels();
  v.box(0, 1, 0, 8, 3, 16, col); v.box(1, 4, 5, 6, 2, 6, '#d4efff');
  const wheels = [];
  const g = new THREE.Group(); g.add(v.toMesh({ scale: 1 / 16, center: 'xz' }));
  g.userData.wheels = wheels; g.userData.size = { w: 0.5, l: 1, h: 0.4 };
  g.userData.update = () => {};
  return g;
}
