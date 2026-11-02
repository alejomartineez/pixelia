// STUB temporal (lo reemplaza el agente de modelos). API definitiva en DESIGN.md.
import * as THREE from 'three';
import { Voxels } from '../core/voxel.js';
import { BUILDING_BY_ID } from '../core/data.js';
export const VOXELS_PER_TILE = 8;
export function buildingModel(id, level = 1) {
  const [w, d] = BUILDING_BY_ID[id].size;
  const v = new Voxels();
  const h = BUILDING_BY_ID[id].cat === 'camino' ? 1 : BUILDING_BY_ID[id].cat === 'deco' ? 6 : 10 + level * 2;
  v.box(1, 0, 1, w * 8 - 2, h, d * 8 - 2, '#ff7eb6');
  const g = new THREE.Group();
  g.add(v.toMesh({ scale: 1 / 8, center: 'xz' }));
  g.userData.height = h / 8;
  return g;
}
export function constructionModel(w, d) {
  const v = new Voxels(); v.walls(0, 0, 0, w * 8, 6, d * 8, '#d9a87a');
  const g = new THREE.Group(); g.add(v.toMesh({ scale: 1 / 8, center: 'xz' })); g.userData.height = 0.75; return g;
}
export function natureModel(kind = 'tree', seed = 0) {
  const v = new Voxels(); v.box(3, 0, 3, 2, 4, 2, '#b07a52'); v.sphere(4, 6, 4, 3, 3, 3, '#5fc46a');
  const g = new THREE.Group(); g.add(v.toMesh({ scale: 1 / 8, center: 'xz' })); return g;
}
export function cloudModel(seed = 0) {
  const v = new Voxels(); v.box(0, 0, 0, 12, 3, 6, '#ffffff');
  const g = new THREE.Group(); g.add(v.toMesh({ scale: 1 / 4, center: 'xyz', castShadow: false })); return g;
}
export async function thumbnail(id) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 96;
  const g = cv.getContext('2d'); g.fillStyle = '#ff7eb6'; g.fillRect(24, 24, 48, 48); return cv.toDataURL();
}
