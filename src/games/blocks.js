// STUB temporal — será reemplazado.
import * as THREE from 'three';
import { createPixelRenderer, addLights, Voxels, setIsoCamera } from '../core/voxel.js';
export default function create(ctx) {
  let r;
  return {
    mount(el) {
      r = createPixelRenderer(el, { viewSize: 10 });
      addLights(r.scene);
      const v = new Voxels();
      v.box(0, 0, 0, 16, 1, 16, '#8fdc7a');
      v.box(4, 1, 4, 8, 6, 8, '#ff7eb6');
      v.roofX(3, 7, 3, 10, 10, '#b58cff');
      r.scene.add(v.toMesh({ scale: 1 / 4, center: 'xz' }));
      setIsoCamera(r.camera);
      r.start();
    },
    unmount() { r?.dispose(); },
  };
}
