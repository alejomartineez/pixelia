// Worker de mallas (módulo ES, sin build): recibe una grilla empaquetada y devuelve los arreglos de la malla.
// Lo usa Voxels.toGeometryAsync de voxel.js; si el worker no anda, la malla se arma en el hilo principal.
import { meshPacked } from './voxel-mesh.js';

self.onmessage = (e) => {
  const { id, data, opts } = e.data;
  try {
    const r = meshPacked(data, opts);
    self.postMessage({ id, r }, [r.position.buffer, r.normal.buffer, r.color.buffer, r.index.buffer]);
  } catch (err) {
    self.postMessage({ id, error: String(err && err.message || err) });
  }
};
