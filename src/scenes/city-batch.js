// Dibujo instanciado de los edificios quietos: las partes estáticas (sin animación) de todos los
// edificios que comparten plantilla se dibujan con un solo InstancedMesh por geometría+material.
// Una ciudad grande pasa de ~1000 llamadas de dibujo a ~150 (clave en iPhone).
// Las mallas originales siguen en la escena en la capa 1: no se dibujan pero sirven para los toques (raycast).
import * as THREE from 'three';

export const HIDDEN_LAYER = 1;

export function createBatcher(scene) {
  const group = new THREE.Group();
  group.name = 'batches';
  scene.add(group);
  const batches = new Map(); // clave -> { mesh, cap }
  let dirty = true;

  /** entries: iterable de { root, live }. live = se anima o está oculto -> se dibuja suelto. */
  function rebuild(entries) {
    dirty = false;
    const lists = new Map();
    for (const e of entries) {
      const live = !!e.live;
      if (!live) e.root.updateMatrixWorld(true);
      e.root.traverse(o => {
        if (!o.isMesh || !o.userData.static || o.isInstancedMesh) return;
        if (live) { o.layers.set(0); return; }
        o.layers.set(HIDDEN_LAYER);
        const key = o.geometry.uuid + '|' + o.material.uuid + '|' + (o.castShadow ? 1 : 0) + (o.receiveShadow ? 1 : 0);
        let L = lists.get(key);
        if (!L) lists.set(key, L = { geo: o.geometry, mat: o.material, cast: o.castShadow, recv: o.receiveShadow, list: [] });
        L.list.push(o.matrixWorld);
      });
    }
    for (const [key, b] of batches) if (!lists.has(key)) { b.mesh.count = 0; b.mesh.visible = false; }
    for (const [key, L] of lists) {
      let b = batches.get(key);
      if (!b || b.cap < L.list.length) {
        if (b) { group.remove(b.mesh); b.mesh.dispose(); }
        const cap = Math.max(4, Math.ceil(L.list.length * 1.5));
        const mesh = new THREE.InstancedMesh(L.geo, L.mat, cap);
        mesh.castShadow = L.cast; mesh.receiveShadow = L.recv;
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        mesh.matrixAutoUpdate = false;
        b = { mesh, cap };
        batches.set(key, b);
        group.add(mesh);
      }
      const mesh = b.mesh;
      for (let i = 0; i < L.list.length; i++) mesh.setMatrixAt(i, L.list[i]);
      mesh.count = L.list.length;
      mesh.visible = true;
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  }

  return {
    group,
    markDirty() { dirty = true; },
    get dirty() { return dirty; },
    /** Reconstruye si hace falta (barato: solo copia matrices). */
    update(entries) { if (dirty) rebuild(entries); },
    /** Cantidad de lotes visibles (para depurar). */
    get count() { let n = 0; for (const b of batches.values()) if (b.mesh.visible) n++; return n; },
    dispose() {
      for (const b of batches.values()) b.mesh.dispose(); // las geometrías son de la caché de modelos: no se liberan
      batches.clear();
      scene.remove(group);
    },
  };
}
