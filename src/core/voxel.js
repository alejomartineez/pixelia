// Motor visual "3D pixel art": modelos de vóxeles + render a baja resolución escalado sin suavizado.
// Todos los módulos 3D deben usar esto para que el juego se vea coherente.
import * as THREE from 'three';

// ---------- Colores ----------
export function hexToInt(c) { return typeof c === 'number' ? c : parseInt(c.replace('#', ''), 16); }
/** Aclara (amt>0) u oscurece (amt<0) un color. amt en -1..1 */
export function shade(c, amt) {
  const n = hexToInt(c);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (amt >= 0) { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; }
  else { r *= 1 + amt; g *= 1 + amt; b *= 1 + amt; }
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
}

// ---------- Constructor de vóxeles ----------
const DIRS = [
  { n: [1, 0, 0], c: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]] },
  { n: [-1, 0, 0], c: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]] },
  { n: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] },
  { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
  { n: [0, 0, 1], c: [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]] },
  { n: [0, 0, -1], c: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]] },
];
const key = (x, y, z) => `${x},${y},${z}`;

/**
 * Grilla de vóxeles. Coordenadas enteras; y es "arriba".
 *   const v = new Voxels();
 *   v.box(0,0,0, 16,1,16, '#8fdc7a');  // x,y,z, ancho(x), alto(y), prof(z)
 *   v.set(3,1,3,'#ff7eb6');
 *   const mesh = v.toMesh({ scale: 1/8, center: 'xz' });
 */
export class Voxels {
  constructor() { this.map = new Map(); }
  set(x, y, z, color) { if (color == null) this.map.delete(key(x, y, z)); else this.map.set(key(x, y, z), hexToInt(color)); return this; }
  get(x, y, z) { return this.map.get(key(x, y, z)); }
  has(x, y, z) { return this.map.has(key(x, y, z)); }
  remove(x, y, z) { this.map.delete(key(x, y, z)); return this; }
  /** Caja rellena. color puede ser función (x,y,z) => color|null */
  box(x, y, z, w, h, d, color) {
    for (let i = x; i < x + w; i++) for (let j = y; j < y + h; j++) for (let k = z; k < z + d; k++)
      this.set(i, j, k, typeof color === 'function' ? color(i, j, k) : color);
    return this;
  }
  /** Caja hueca (solo paredes, sin techo ni piso) */
  walls(x, y, z, w, h, d, color) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) for (let k = z; k < z + d; k++)
      if (i === x || i === x + w - 1 || k === z || k === z + d - 1) this.set(i, j, k, typeof color === 'function' ? color(i, j, k) : color);
    return this;
  }
  clear(x, y, z, w, h, d) { return this.box(x, y, z, w, h, d, null); }
  /** Esfera/elipsoide rellena centrada en (cx,cy,cz) */
  sphere(cx, cy, cz, rx, ry = rx, rz = rx, color) {
    for (let i = Math.floor(cx - rx); i <= Math.ceil(cx + rx); i++)
      for (let j = Math.floor(cy - ry); j <= Math.ceil(cy + ry); j++)
        for (let k = Math.floor(cz - rz); k <= Math.ceil(cz + rz); k++) {
          const dx = (i - cx) / rx, dy = (j - cy) / ry, dz = (k - cz) / rz;
          if (dx * dx + dy * dy + dz * dz <= 1) this.set(i, j, k, typeof color === 'function' ? color(i, j, k) : color);
        }
    return this;
  }
  /** Cilindro vertical (eje y) */
  cylinder(cx, y, cz, r, h, color) {
    for (let i = Math.floor(cx - r); i <= Math.ceil(cx + r); i++)
      for (let k = Math.floor(cz - r); k <= Math.ceil(cz + r); k++) {
        const dx = i - cx, dz = k - cz;
        if (dx * dx + dz * dz <= r * r) for (let j = y; j < y + h; j++) this.set(i, j, k, typeof color === 'function' ? color(i, j, k) : color);
      }
    return this;
  }
  /** Techo a dos aguas a lo largo de x */
  roofX(x, y, z, w, d, color, overhang = 0) {
    const half = Math.ceil(d / 2);
    for (let s = 0; s < half; s++)
      this.box(x - overhang, y + s, z + s, w + overhang * 2, 1, d - s * 2, typeof color === 'function' ? color : (s % 2 ? shade(color, -0.08) : color));
    return this;
  }
  /** Pirámide (techo de torre) */
  pyramid(x, y, z, w, d, color) {
    let s = 0;
    while (w - s * 2 > 0 && d - s * 2 > 0) { this.box(x + s, y + s, z + s, w - s * 2, 1, d - s * 2, color); s++; }
    return this;
  }
  /** Copia otra grilla con desplazamiento */
  merge(other, ox = 0, oy = 0, oz = 0) {
    for (const [k, c] of other.map) { const [x, y, z] = k.split(',').map(Number); this.map.set(key(x + ox, y + oy, z + oz), c); }
    return this;
  }
  bounds() {
    let mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
    for (const k of this.map.keys()) {
      const p = k.split(',').map(Number);
      for (let i = 0; i < 3; i++) { mn[i] = Math.min(mn[i], p[i]); mx[i] = Math.max(mx[i], p[i] + 1); }
    }
    return { min: mn, max: mx };
  }
  get size() { return this.map.size; }

  /**
   * Genera BufferGeometry con caras ocultas eliminadas y colores por vértice.
   * opts.scale: tamaño de un vóxel en unidades de mundo (ej 1/8 => 8 vóxeles por tile)
   * opts.center: 'xz' centra en x/z (base en y=0) | 'xyz' | false
   * opts.jitter: variación de brillo por vóxel (textura pixel), default 0.015 (con pixeles de render
   *   chicos, más variación se ve como estática)
   */
  toGeometry({ scale = 1, center = false, jitter = 0.015 } = {}) {
    const pos = [], nor = [], col = [], idx = [];
    let off = [0, 0, 0];
    if (center && this.map.size) {
      const b = this.bounds();
      off = [-(b.min[0] + b.max[0]) / 2, center === 'xyz' ? -(b.min[1] + b.max[1]) / 2 : -b.min[1], -(b.min[2] + b.max[2]) / 2];
    }
    const tmp = new THREE.Color();
    for (const [k, c] of this.map) {
      const [x, y, z] = k.split(',').map(Number);
      let h = (x * 73856093) ^ (y * 19349663) ^ (z * 83492791);
      h = ((h >>> 0) % 1000) / 1000;
      const cc = jitter ? shade(c, (h - 0.5) * 2 * jitter) : c;
      tmp.setHex(cc); // setHex ya convierte sRGB -> lineal
      for (const d of DIRS) {
        if (this.map.has(key(x + d.n[0], y + d.n[1], z + d.n[2]))) continue;
        const base = pos.length / 3;
        for (const v of d.c) {
          pos.push((x + v[0] + off[0]) * scale, (y + v[1] + off[1]) * scale, (z + v[2] + off[2]) * scale);
          nor.push(...d.n);
          col.push(tmp.r, tmp.g, tmp.b);
        }
        idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeBoundingSphere(); g.computeBoundingBox();
    return g;
  }
  toMesh(opts = {}) {
    const m = new THREE.Mesh(this.toGeometry(opts), opts.material || voxelMaterial());
    m.castShadow = opts.castShadow ?? true;
    m.receiveShadow = opts.receiveShadow ?? true;
    return m;
  }
}

let _mat = null, _matEmissive = null;
/** Material compartido de vóxeles (colores por vértice, sombreado plano). */
export function voxelMaterial() {
  return _mat || (_mat = new THREE.MeshLambertMaterial({ vertexColors: true }));
}
/** Variante que brilla un poco (ventanas, luces, gemas). */
export function glowMaterial() {
  return _matEmissive || (_matEmissive = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x332233 }));
}

// ---------- Render pixelado ----------
const screenDpr = () => Math.min(4, Math.max(1, (typeof devicePixelRatio === 'number' && devicePixelRatio) || 1));
/** Tamaño de pixel por defecto (px CSS): más fino en celular, un poco más grueso en PC. */
export function defaultPixelSize() {
  return Math.min(innerWidth, innerHeight) < 500 ? 1.5 : 2;
}
/**
 * Crea renderer + escena + cámara con look pixel art.
 * container: elemento donde se agrega el canvas (ocupa 100%).
 * opts.pixelSize: tamaño en px CSS de cada "pixel" del render. Default ≈1.5 en celular y ≈2 en PC.
 *   Se redondea a una cantidad ENTERA de pixeles físicos (según devicePixelRatio) para que todos los
 *   pixeles del render midan lo mismo en pantalla (sin columnas más anchas que otras).
 * opts.ortho: true = cámara ortográfica isométrica (ciudad); false = perspectiva (juegos de manejo)
 * opts.viewSize: alto visible del mundo para la ortográfica
 * opts.background: color de fondo (hex) o null para transparente
 * opts.shadows: sombras (default true)
 * opts.outline: contorno tinta de 1 pixel de render alrededor de las siluetas (saltos de profundidad).
 *   true | { strength (0..1, default 0.8), threshold (unidades de mundo, default 0.3 en ortográfica) }.
 *   Los transparentes que escriben profundidad (sprites, planos con alfa) también se contornean: usar depthWrite:false.
 */
export function createPixelRenderer(container, opts = {}) {
  const { ortho = true, viewSize = 14, background = 0xbfe9ff, shadows = true, fov = 50 } = opts;
  let pixelSize = opts.pixelSize || defaultPixelSize();
  let dev = 1, dpr = 1;
  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: background == null, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = shadows;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const canvas = renderer.domElement;
  canvas.className = 'pixel-canvas';
  // ?outline=1 / ?outline=0 en la URL lo fuerza en todas las escenas (para comparar)
  const forced = typeof location !== 'undefined' && /[?&]outline=([01])/.exec(location.search);
  const outlineOpt = forced ? forced[1] === '1' : opts.outline;
  let outline = outlineOpt ? createOutlinePass(renderer, outlineOpt) : null;
  container.append(canvas);

  const scene = new THREE.Scene();
  if (background != null) scene.background = new THREE.Color(background);

  let camera;
  if (ortho) {
    camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -200, 400);
    camera.userData.viewSize = viewSize;
  } else camera = new THREE.PerspectiveCamera(fov, 1, 0.1, 500);

  function resize() {
    const w = container.clientWidth || innerWidth, h = container.clientHeight || innerHeight;
    dpr = screenDpr();
    dev = Math.max(pixelSize >= 1.4 ? 2 : 1, Math.round(pixelSize * dpr - 0.01));
    // buffer = pixeles físicos / dev (entero): cada pixel de render ocupa dev×dev pixeles físicos
    const bw = Math.max(1, Math.round(w * dpr / dev)), bh = Math.max(1, Math.round(h * dpr / dev));
    renderer.setPixelRatio(1);
    renderer.setSize(bw, bh, false);
    outline?.setSize(bw, bh);
    canvas.style.width = '100%'; canvas.style.height = '100%';
    const aspect = bw / bh;
    if (camera.isOrthographicCamera) {
      const vs = camera.userData.viewSize;
      camera.left = -vs * aspect / 2; camera.right = vs * aspect / 2; camera.top = vs / 2; camera.bottom = -vs / 2;
    } else camera.aspect = aspect;
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  // si cambia el devicePixelRatio (zoom del navegador, otra pantalla) se recalcula
  let mq = null;
  const onDpr = () => { resize(); watchDpr(); };
  function watchDpr() {
    mq?.removeEventListener?.('change', onDpr);
    mq = typeof matchMedia === 'function' ? matchMedia(`(resolution: ${screenDpr()}dppx)`) : null;
    mq?.addEventListener?.('change', onDpr);
  }
  resize();
  watchDpr();

  let raf = 0, running = false, last = 0;
  const loops = new Set();
  function frame(t) {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (t - (last || t)) / 1000); last = t;
    for (const fn of loops) fn(dt, t / 1000);
    draw();
  }
  function draw() {
    if (outline) outline.render(scene, camera);
    else renderer.render(scene, camera);
  }

  return {
    THREE, renderer, scene, camera, canvas,
    /** Tamaño real (px CSS) de cada pixel del render, ya redondeado a pixeles físicos enteros. */
    get pixelSize() { return dev / dpr; },
    setPixelSize(n) { pixelSize = n; resize(); },
    /** Cambia el zoom de la ortográfica (alto visible en unidades de mundo) */
    setViewSize(vs) { camera.userData.viewSize = vs; resize(); },
    resize,
    /** Agrega función (dt, timeSec) llamada cada frame antes de renderizar. Devuelve función para quitarla. */
    onFrame(fn) { loops.add(fn); return () => loops.delete(fn); },
    start() { if (running) return; running = true; last = 0; raf = requestAnimationFrame(frame); },
    stop() { running = false; cancelAnimationFrame(raf); },
    render: draw,
    /** Prende/apaga el contorno tinta (true | {strength, threshold} | false). */
    setOutline(o) {
      outline?.dispose(); outline = null;
      if (o) { outline = createOutlinePass(renderer, o); resize(); }
    },
    get outline() { return !!outline; },
    /** Convierte coordenadas de pantalla (clientX/Y) a NDC */
    toNDC(clientX, clientY) {
      const r = canvas.getBoundingClientRect();
      return new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    },
    /** Punto del plano y=planeY bajo el puntero (o null) */
    pickGround(clientX, clientY, planeY = 0) {
      const ray = new THREE.Raycaster();
      ray.setFromCamera(this.toNDC(clientX, clientY), camera);
      const p = new THREE.Vector3();
      return ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -planeY), p) ? p : null;
    },
    /** Proyecta un punto del mundo a coordenadas de pantalla (px CSS) */
    toScreen(v3) {
      const p = v3.clone().project(camera);
      const r = canvas.getBoundingClientRect();
      return { x: r.left + (p.x + 1) / 2 * r.width, y: r.top + (1 - p.y) / 2 * r.height, visible: p.z < 1 };
    },
    dispose() {
      this.stop(); ro.disconnect(); loops.clear();
      mq?.removeEventListener?.('change', onDpr);
      outline?.dispose();
      disposeObject(scene);
      renderer.dispose();
      renderer.forceContextLoss?.();
      canvas.remove();
    },
  };
}

/**
 * Post-proceso de contorno: renderiza la escena a un target con profundidad y pinta de tinta los pixeles
 * de fondo pegados a algo bastante más cerca (el contorno queda AFUERA de la silueta, como en los íconos).
 * En perspectiva el umbral crece con la distancia para no rayar el piso lejano en ángulo rasante.
 */
function createOutlinePass(renderer, o) {
  const cfg = typeof o === 'object' ? o : {};
  const rt = new THREE.WebGLRenderTarget(1, 1, {
    type: THREE.HalfFloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true,
  });
  rt.depthTexture = new THREE.DepthTexture(1, 1);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      tColor: { value: rt.texture }, tDepth: { value: rt.depthTexture }, texel: { value: new THREE.Vector2(1, 1) },
      near: { value: 0.1 }, far: { value: 100 }, ink: { value: new THREE.Color(0x3b2340) },
      strength: { value: cfg.strength ?? 0.8 }, thrAbs: { value: 0.3 }, thrLin: { value: 0 }, thrSq: { value: 0 },
    },
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: `
      #include <packing>
      uniform sampler2D tColor; uniform sampler2D tDepth; uniform vec2 texel;
      uniform float near; uniform float far; uniform vec3 ink; uniform float strength;
      uniform float thrAbs; uniform float thrLin; uniform float thrSq;
      varying vec2 vUv;
      float dist(vec2 uv) {
        float d = texture2D(tDepth, uv).x;
        #ifdef ORTHO
        return -orthographicDepthToViewZ(d, near, far);
        #else
        return -perspectiveDepthToViewZ(d, near, far);
        #endif
      }
      void main() {
        vec4 c = texture2D(tColor, vUv);
        float dc = dist(vUv);
        float dn = min(min(dist(vUv + vec2(texel.x, 0.0)), dist(vUv - vec2(texel.x, 0.0))),
                       min(dist(vUv + vec2(0.0, texel.y)), dist(vUv - vec2(0.0, texel.y))));
        if (dc - dn > thrAbs + dc * thrLin + dc * dc * thrSq)
          c = c.a > 0.0 ? vec4(mix(c.rgb, ink, strength), 1.0) : vec4(ink, 1.0);
        gl_FragColor = c;
        #include <colorspace_fragment>
      }`,
    depthTest: false, depthWrite: false,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  quad.frustumCulled = false;
  const postScene = new THREE.Scene(); postScene.add(quad);
  const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  let ortho = null;
  return {
    setSize(w, h) { rt.setSize(w, h); mat.uniforms.texel.value.set(1 / w, 1 / h); },
    render(scene, camera) {
      if (ortho !== !!camera.isOrthographicCamera) {
        ortho = !!camera.isOrthographicCamera;
        mat.defines = ortho ? { ORTHO: '' } : {};
        mat.needsUpdate = true;
        const u = mat.uniforms;
        if (ortho) { u.thrAbs.value = cfg.threshold ?? 0.3; u.thrLin.value = 0; u.thrSq.value = 0; }
        else { u.thrAbs.value = cfg.threshold ?? 0.15; u.thrLin.value = 0.03; u.thrSq.value = 0.0015; }
      }
      mat.uniforms.near.value = camera.near; mat.uniforms.far.value = camera.far;
      const prev = renderer.getRenderTarget();
      renderer.setRenderTarget(rt);
      renderer.render(scene, camera);
      renderer.setRenderTarget(prev);
      renderer.render(postScene, postCam);
    },
    dispose() { rt.depthTexture.dispose(); rt.dispose(); quad.geometry.dispose(); mat.dispose(); },
  };
}

/** Luces estándar del juego: cielo pastel + sol cálido con sombras. Devuelve { hemi, sun }. */
export function addLights(scene, { shadowSize = 30, shadowRes = 1024 } = {}) {
  const hemi = new THREE.HemisphereLight(0xffffff, 0xcdb8f0, 1.5);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff3e6, 2.0);
  sun.position.set(12, 22, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(shadowRes, shadowRes);
  const s = shadowSize / 2;
  Object.assign(sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 1, far: 80 });
  sun.shadow.bias = -0.0015;
  sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target);
  return { hemi, sun };
}

/** Coloca una cámara ortográfica en vista isométrica mirando a `target`. angle en radianes alrededor de Y. */
export function setIsoCamera(camera, target = new THREE.Vector3(), angle = Math.PI / 4, dist = 60, pitch = 0.62) {
  camera.position.set(target.x + Math.sin(angle) * dist * Math.cos(pitch), target.y + Math.sin(pitch) * dist, target.z + Math.cos(angle) * dist * Math.cos(pitch));
  camera.lookAt(target);
}

/** Libera geometrías/materiales/texturas de un objeto (no toca los materiales compartidos). */
export function disposeObject(obj) {
  obj.traverse?.(o => {
    o.geometry?.dispose?.();
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) {
      if (m === _mat || m === _matEmissive) continue;
      for (const v of Object.values(m)) if (v && v.isTexture) v.dispose();
      m.dispose?.();
    }
  });
}

/** Sprite de texto/ícono pixelado que mira a cámara (para burbujas sobre edificios). */
export function makeBillboard(drawFn, w = 32, h = 32, worldHeight = 1) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  drawFn(cv.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(cv);
  tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false }));
  sp.scale.set(worldHeight * w / h, worldHeight, 1);
  sp.renderOrder = 10;
  sp.userData.redraw = (fn) => { fn(cv.getContext('2d'), w, h); tex.needsUpdate = true; };
  return sp;
}

/** Carga una imagen (dataURL) en un sprite pixelado. */
export function imageSprite(url, worldHeight = 1) {
  const tex = new THREE.TextureLoader().load(url);
  tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false }));
  sp.scale.set(worldHeight, worldHeight, 1);
  sp.renderOrder = 10;
  return sp;
}
