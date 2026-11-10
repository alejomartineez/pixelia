// Luz del render fotográfico (PLAN-FOTO R1, "Teardown liviano"). Vive detrás de createPixelRenderer({ photo: true }).
//
// 1. Volumen de la escena: una textura 3D RGBA8 con mipmaps en coordenadas de mundo. alfa = cuánto de la celda está
//    ocupado; rgb = la luz que sale de la celda (lo emisivo), premultiplicada por la ocupación y guardada como raíz
//    de (luz / RAD_MAX). Una celda mide `cell` unidades de mundo (1/8 = un vóxel de la ciudad, dos de un modelo de 16
//    por tile). Se arma en CPU desde grillas `Voxels` (add) o desde las mallas ya hechas (addObject: la cáscara).
// 2. Pase de luz a media resolución: un pre-pase dibuja profundidad y normales; con eso, por pixel, se marchan conos
//    en el volumen: uno fino hacia el sol (sombra con penumbra que se abre con la distancia), cinco anchos en la
//    semiesfera (oclusión ambiental, cielo y la luz de lo emisivo cercano) y uno por cada luz puntual (hasta 8).
//    Sale RGBA16F: rgb = luz que llega sin contar el sol, a = cuánto sol llega.
// 3. Los materiales fotográficos (material(kind)) leen ese resultado con un upsample bilateral (profundidad y normal)
//    y escriben luz lineal sin techo en el target HDR; el AgX la baja al final (voxel.js).
//
//   r.light.setBounds(min, max)                    caja del volumen en mundo (antes de agregar nada)
//   const id = r.light.add(voxels, matrix, { scale, emissive, fillBelow })
//   r.light.update(id, matrix) · r.light.remove(id)   rehace solo la zona tocada
//   r.light.adopt(object3D)                        cambia los materiales del juego por los fotográficos y suma las mallas al volumen
//   r.light.setEnv({ sunDir, sun, sky, ground, glow })   luz del ambiente (colores lineales ya con su intensidad)
//   r.light.setPoints([{ position, color, intensity, radius }])
import * as THREE from 'three';

export const RAD_MAX = 16;
const MAX_POINTS = 8;
/** Cuánto emiten los materiales que brillan: de día (base) y lo que suma la noche (glow 0..1). */
const EMIT = { glow: [0.4, 5], window: [0, 3.5] };
const WINDOW_COLOR = [1.0, 0.62, 0.26];

const QUAD_VS = `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

// Lo que comparten el pase de luz, la niebla y los materiales que reflejan: leer el volumen y marchar conos.
const VOL_GLSL = `
precision highp float; precision highp sampler3D;
uniform sampler3D tVol; uniform vec3 volMin; uniform vec3 volSize; uniform float cell;
uniform vec3 skyCol; uniform vec3 groundCol;

vec4 vol(vec3 p, float lod) {
  vec3 u = (p - volMin) / volSize;
  if (any(lessThan(u, vec3(0.0))) || any(greaterThan(u, vec3(1.0)))) return vec4(0.0);
  return textureLod(tVol, u, lod);
}
// cuánto falta para salir de la caja del volumen
float exitT(vec3 o, vec3 d) {
  vec3 dd = mix(d, vec3(1e-5), lessThan(abs(d), vec3(1e-5)));
  vec3 a = (volMin - o) / dd, b = (volMin + volSize - o) / dd;
  vec3 m = max(a, b);
  return min(m.x, min(m.y, m.z));
}
// Cono fino: cuánta luz pasa de o hacia d hasta maxT. El cono se abre con la distancia (lee mipmaps más altos),
// así la sombra es dura al pie y blanda lejos.
float shadowCone(vec3 o, vec3 d, float maxT, float ap) {
  maxT = min(maxT, exitT(o, d));
  float t = cell * 0.5, T = 1.0;
  for (int i = 0; i < 72; i++) {
    if (t >= maxT) break;
    float diam = max(cell, ap * t);
    float lod = log2(diam / cell);
    float a = vol(o + d * t, lod).a;
    // de cerca, borde nítido; de lejos, las paredes finas (cáscaras) pesan como paredes y no como niebla
    a = mix(smoothstep(0.2, 0.8, a), min(1.0, a * exp2(lod * 0.7)), clamp(lod, 0.0, 1.0));
    T *= clamp(1.0 - a, 0.0, 1.0);
    if (T < 0.02) return 0.0;
    t += diam * 0.75;
  }
  return T;
}
vec3 skyAt(vec3 d) { return mix(groundCol, skyCol, smoothstep(-0.6, 0.15, d.y)); }
// la luz que sale de una celda (emitida + rebote horneado): el rgb va premultiplicado por la ocupación y como raíz
vec3 radiance(vec4 s) { return s.rgb * s.rgb * (${RAD_MAX.toFixed(1)} / max(s.a, 0.06)); }
`;

const LIGHT_FS = VOL_GLSL + `
uniform sampler2D tDepth; uniform sampler2D tNormal;
uniform mat4 invProj; uniform mat4 camWorld;
uniform vec3 sunDir; uniform float sunOn; uniform float sunAp;
uniform float giGain; uniform float aoPow;
uniform vec4 pPos[${MAX_POINTS}]; uniform vec3 pCol[${MAX_POINTS}]; uniform int pCount;
varying vec2 vUv;
// Cono ancho: junta la luz de lo emisivo que encuentra y, con lo que queda libre, la del cielo.
vec3 gather(vec3 o, vec3 d, out float open) {
  float ex = exitT(o, d);
  // T mezcla dos cuentas: el producto (lo que tapa de frente) y el mínimo (una pared rasante tapa medio cono una
  // sola vez, no en cada paso): sin eso, los rincones y el pie de las paredes quedan negros.
  float t = cell * 1.2, T = 1.0, Tp = 1.0, Tm = 1.0;
  vec3 acc = vec3(0.0);
  for (int i = 0; i < 13; i++) {
    if (t >= ex) break;
    float diam = max(cell, t * 0.8);
    float lod = log2(diam / cell);
    vec4 s = vol(o + d * t, lod);
    float k = exp2(lod * 0.5);
    acc += T * s.rgb * s.rgb * (${(RAD_MAX * 0.64).toFixed(2)} * giGain) * min(k, 4.0);
    float free = clamp(1.0 - s.a * mix(1.0, k, 0.25), 0.0, 1.0);
    Tp *= pow(free, 0.64); Tm = min(Tm, free);
    T = mix(Tm, Tp, 0.3);
    if (T < 0.02) { T = 0.0; break; }
    t += diam * 0.44;
  }
  open = T;
  return acc;
}
void main() {
  float depth = texture2D(tDepth, vUv).x;
  if (depth >= 0.99999) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
  vec4 v = invProj * vec4(vUv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
  vec3 P = (camWorld * vec4(v.xyz / v.w, 1.0)).xyz;
  vec3 N = normalize(mat3(camWorld) * (texture2D(tNormal, vUv).xyz * 2.0 - 1.0));
  vec3 o = P + N * cell * 0.75;
  // si el punto de partida cae dentro de un sólido (caras tapadas por el relleno, uniones), se saca hacia afuera
  float ins = vol(o, 0.0).a;
  if (ins > 0.6) { o += N * cell; ins = vol(o, 0.0).a; if (ins > 0.6) { o += N * cell; ins = vol(o, 0.0).a; } }

  float sun = 0.0;
  if (sunOn > 0.0 && dot(N, sunDir) > 0.0) sun = shadowCone(o, sunDir, 60.0, sunAp);

  vec3 t1 = normalize(cross(N, abs(N.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
  vec3 t2 = cross(N, t1);
  vec3 E = vec3(0.0);
  float open, ao = 0.0;
  vec3 d;
  d = N; E += 0.25 * gather(o, d, open); ao += 0.25 * open; vec3 skyL = 0.25 * open * skyAt(d);
  d = normalize(N * 0.707 + t1 * 0.707); vec3 g = gather(o, d, open); E += 0.1875 * g; ao += 0.1875 * open; skyL += 0.1875 * open * skyAt(d);
  d = normalize(N * 0.707 - t1 * 0.707); g = gather(o, d, open); E += 0.1875 * g; ao += 0.1875 * open; skyL += 0.1875 * open * skyAt(d);
  d = normalize(N * 0.707 + t2 * 0.707); g = gather(o, d, open); E += 0.1875 * g; ao += 0.1875 * open; skyL += 0.1875 * open * skyAt(d);
  d = normalize(N * 0.707 - t2 * 0.707); g = gather(o, d, open); E += 0.1875 * g; ao += 0.1875 * open; skyL += 0.1875 * open * skyAt(d);
  // la oclusión se aprieta un poco (aoPow > 1): los rincones cierran más, como en una maqueta
  E += skyL * pow(max(ao, 1e-3), aoPow - 1.0);
  // piso de luz para lo que sigue enterrado: una franja negra pura se lee como un error, no como sombra
  if (ins > 0.6) E = max(E, skyAt(N) * 0.1);
  // y para las ranuras de un vóxel de ancho, donde los cinco conos chocan enseguida con la pared de enfrente
  E += skyAt(N) * (0.24 * (1.0 - ao));

  for (int i = 0; i < ${MAX_POINTS}; i++) {
    if (i >= pCount) break;
    vec3 L = pPos[i].xyz - P;
    float dist = length(L), r = pPos[i].w;
    if (dist >= r) continue;
    L /= dist;
    float ndl = dot(N, L);
    if (ndl <= 0.0) continue;
    float fall = 1.0 - dist / r;
    float att = fall * fall / (1.0 + dist * dist * 1.5);
    E += pCol[i] * (ndl * att * shadowCone(o, L, dist - cell * 6.5, 0.22));
  }
  // nada de NaN: un solo texel roto se contagia a los vecinos en el upsample
  if (!(sun >= 0.0)) sun = 0.0;
  if (!(E.r >= 0.0 && E.g >= 0.0 && E.b >= 0.0)) E = vec3(0.0);
  gl_FragColor = vec4(min(E, vec3(64.0)), min(sun, 1.0));
}`;

const MAT_VS = `
varying vec3 vCol; varying vec3 vN; varying float vViewZ; varying vec3 vWorld;
void main() {
  vCol = color;
  vec4 wp = vec4(position, 1.0);
  vec3 n = normal;
  #ifdef USE_INSTANCING
  wp = instanceMatrix * wp; n = mat3(instanceMatrix) * n;
  #endif
  wp = modelMatrix * wp;
  vN = normalize(mat3(modelMatrix) * n);
  vWorld = wp.xyz;
  vec4 mv = viewMatrix * wp;
  vViewZ = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;

// Niebla volumétrica (media resolución): marcha del ojo a la superficie dentro de la caja del volumen. La niebla es
// más densa abajo (fogP: densidad, altura base, caída con la altura) y junta sol con sombra, cielo, luces puntuales y
// lo que brilla cerca. Sale rgb = luz que suma la niebla, a = cuánto deja pasar.
const FOG_FS = VOL_GLSL + `
uniform sampler2D tDepth; uniform mat4 invProj; uniform mat4 camWorld;
uniform vec3 sunDir; uniform vec3 sunCol; uniform vec3 fogP; uniform float frame; uniform float fogGlow;
uniform vec4 pPos[${MAX_POINTS}]; uniform vec3 pCol[${MAX_POINTS}]; uniform int pCount;
varying vec2 vUv;
vec3 world(float z) { vec4 v = invProj * vec4(vUv * 2.0 - 1.0, z, 1.0); return (camWorld * vec4(v.xyz / v.w, 1.0)).xyz; }
float sunLite(vec3 p) {
  float t = cell * 1.5, T = 1.0;
  for (int i = 0; i < 6; i++) {
    float lod = log2(max(1.0, 0.45 * t / cell));
    T *= 1.0 - min(1.0, vol(p + sunDir * t, lod).a * 1.6);
    t *= 1.8;
  }
  return T;
}
void main() {
  float depth = texture2D(tDepth, vUv).x;
  vec3 A = world(-1.0), B = world(min(depth, 0.99999) * 2.0 - 1.0);
  vec3 d = B - A; float len = length(d); d /= len;
  vec3 dd = mix(d, vec3(1e-5), lessThan(abs(d), vec3(1e-5)));
  vec3 ta = (volMin - A) / dd, tb = (volMin + volSize - A) / dd;
  vec3 mn = min(ta, tb), mx = max(ta, tb);
  float t0 = max(max(mn.x, max(mn.y, mn.z)), 0.0), t1 = min(min(mx.x, min(mx.y, mx.z)), len);
  if (t1 <= t0 || fogP.x <= 0.0) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
  float dt = (t1 - t0) / 10.0;
  float jit = fract(52.9829189 * fract(dot(gl_FragCoord.xy + frame * 5.588, vec2(0.06711056, 0.00583715))));
  vec3 acc = vec3(0.0); float T = 1.0;
  for (int i = 0; i < 10; i++) {
    vec3 p = A + d * (t0 + (float(i) + jit) * dt);
    float dens = fogP.x * exp(-max(p.y - fogP.y, 0.0) * fogP.z);
    if (dens < 1e-4) continue;
    vec3 Lg = skyAt(vec3(0.0, 1.0, 0.0)) * 0.35;
    if (sunCol.r + sunCol.g + sunCol.b > 1e-4) Lg += sunCol * (0.3 * sunLite(p));
    Lg += radiance(vol(p, 2.0)) * vol(p, 2.0).a * fogGlow;
    for (int k = 0; k < ${MAX_POINTS}; k++) {
      if (k >= pCount) break;
      float dist = distance(pPos[k].xyz, p), r = pPos[k].w;
      if (dist >= r) continue;
      float fall = 1.0 - dist / r;
      Lg += pCol[k] * (0.5 * fall * fall / (1.0 + dist * dist * 1.5));
    }
    float st = 1.0 - exp(-dens * dt);
    acc += T * st * Lg; T *= 1.0 - st;
  }
  if (!(acc.r >= 0.0 && acc.g >= 0.0 && acc.b >= 0.0)) acc = vec3(0.0);
  gl_FragColor = vec4(min(acc, vec3(32.0)), T);
}`;

const MAT_FS = `
#ifdef REFLECT
${VOL_GLSL}
uniform float f0; uniform float metalTint; uniform float ripple; uniform float time; uniform vec3 bgCol;
// cono fino por el reflejo: junta lo que brilla (y el rebote horneado) y, con lo que queda libre, el cielo
vec3 reflCone(vec3 o, vec3 d, float ap) {
  float ex = exitT(o, d), t = cell, T = 1.0;
  vec3 acc = vec3(0.0);
  for (int i = 0; i < 28; i++) {
    if (t >= ex) break;
    float diam = max(cell, ap * t), lod = log2(diam / cell);
    vec4 s = vol(o + d * t, lod);
    float a = min(1.0, s.a * (1.0 + lod));
    acc += T * a * radiance(s); T *= 1.0 - a;
    if (T < 0.03) { T = 0.0; break; }
    t += diam * 0.7;
  }
  return acc + T * bgCol * smoothstep(-0.2, 0.1, d.y);
}
#endif
varying vec3 vWorld;
uniform sampler2D tLight; uniform sampler2D tGN; uniform sampler2D tGD;
uniform vec2 halfSize; uniform vec2 fullSize; uniform float camNear; uniform float camFar;
uniform vec3 sunDir; uniform vec3 sunCol;
uniform int debugView; uniform float emit; uniform vec3 emitCol; uniform float emitTint; uniform float opacity;
varying vec3 vCol; varying vec3 vN; varying float vViewZ;
float viewZ(float d) {
  return isOrthographic ? camNear + d * (camFar - camNear) : camNear * camFar / (camFar - d * (camFar - camNear));
}
void main() {
  vec3 N = normalize(vN);
  vec3 vn = normalize(mat3(viewMatrix) * N);
  // upsample bilateral del pase de luz (media resolución): pesan los vecinos de la misma superficie
  vec2 p = gl_FragCoord.xy / fullSize * halfSize - 0.5;
  ivec2 b = ivec2(floor(p)); vec2 f = fract(p);
  ivec2 hi = ivec2(halfSize) - 1;
  vec4 acc = vec4(0.0); float ws = 0.0;
  for (int j = 0; j < 2; j++) for (int i = 0; i < 2; i++) {
    ivec2 q = clamp(b + ivec2(i, j), ivec2(0), hi);
    float z = viewZ(texelFetch(tGD, q, 0).x);
    vec3 n = texelFetch(tGN, q, 0).xyz * 2.0 - 1.0;
    float w = (i == 0 ? 1.0 - f.x : f.x) * (j == 0 ? 1.0 - f.y : f.y) + 0.02;
    w *= exp(-abs(z - vViewZ) * 10.0) * pow(max(dot(n, vn), 0.0), 8.0);
    w += 1e-5;
    acc += texelFetch(tLight, q, 0) * w; ws += w;
  }
  acc /= ws;
  float ndl = max(dot(N, sunDir), 0.0);
  vec3 lit = vCol * (sunCol * (ndl * acc.a) + acc.rgb);
  float alpha = opacity;
  #ifdef REFLECT
  // agua, metal y vidrio: reflejo de la escena (el volumen) y del cielo, con Fresnel, y el brillo del sol
  vec3 V = normalize(isOrthographic ? vec3(viewMatrix[0][2], viewMatrix[1][2], viewMatrix[2][2]) : cameraPosition - vWorld);
  vec3 Nr = N;
  #ifdef WATER
  // el agua no está en el pre-pase: calcula su propia luz. Las ondas van por vóxel, para que siga siendo pixel art
  vec2 g = floor(vWorld.xz * 8.0 + 0.5) / 8.0;
  Nr = normalize(N + ripple * vec3(sin(g.x * 5.1 + time * 1.3) + sin(g.y * 3.3 + g.x * 2.0 + time * 0.9), 0.0, cos(g.y * 4.7 - time * 1.1) + sin(g.x * 2.9 - time * 0.7)));
  float sv = ndl > 0.0 && sunCol.r + sunCol.g + sunCol.b > 1e-4 ? shadowCone(vWorld + N * cell, sunDir, 30.0, 0.1) : 0.0;
  lit = vCol * (sunCol * (ndl * sv) + skyCol * 0.5);
  #else
  float sv = acc.a;
  #endif
  vec3 R = reflect(-V, Nr);
  if (dot(R, N) < 0.02) R = normalize(R + N * (0.02 - dot(R, N)));
  float fr = f0 + (1.0 - f0) * pow(1.0 - max(dot(Nr, V), 0.0), 5.0);
  vec3 refl = reflCone(vWorld + N * cell * 1.5, R, 0.06) * mix(vec3(1.0), vCol, metalTint);
  refl += sunCol * (sv * 6.0 * pow(max(dot(R, sunDir), 0.0), 240.0));
  lit = lit * (1.0 - fr) * (1.0 - metalTint * 0.7) + refl * fr;
  alpha = mix(opacity, 1.0, fr);
  #endif
  lit += mix(vCol, emitCol, emitTint) * emit;
  // vistas de diagnóstico (r.light.debug = 1 sol · 2 luz sin sol · 3 normal · 4 color)
  if (debugView == 1) lit = vec3(acc.a); else if (debugView == 2) lit = acc.rgb; else if (debugView == 3) lit = N * 0.5 + 0.5; else if (debugView == 4) lit = vCol;
  gl_FragColor = vec4(lit, alpha);
}`;

/** Cómo refleja cada material: f0 = reflejo de frente, tint = cuánto tiñe el reflejo (metal), ripple = ondas. */
const REFLECT = { water: { f0: 0.03, tint: 0, ripple: 0.035 }, metal: { f0: 0.6, tint: 1 }, glass: { f0: 0.08, tint: 0 }, window: { f0: 0.06, tint: 0 } };

export function createVoxelLight(renderer, opts = {}) {
  const cell = opts.cell ?? 1 / 8;
  const classify = opts.classify || (() => null);
  // ---------- volumen ----------
  const min = new THREE.Vector3(-8, -2, -8), size = new THREE.Vector3(16, 6, 16);
  let nx = 1, ny = 1, nz = 1, cov = null, alb = null, emi = null, data = null, tex = null;
  const entries = new Map();
  let seq = 0, dirty = null, glow = 0, builtGlow = 0;
  const stats = { cells: 0, entries: 0, builds: 0, buildMs: 0, splats: 0, bakes: 0, bakeMs: 0 };
  const uVol = { value: null };
  function alloc() {
    nx = Math.max(1, Math.ceil(size.x / cell - 1e-6)); ny = Math.max(1, Math.ceil(size.y / cell - 1e-6)); nz = Math.max(1, Math.ceil(size.z / cell - 1e-6));
    size.set(nx * cell, ny * cell, nz * cell);
    const n = nx * ny * nz;
    cov = new Float32Array(n); alb = new Float32Array(n * 3); emi = new Float32Array(n * 3);
    data = new Uint8Array(n * 4);
    tex?.dispose();
    tex = new THREE.Data3DTexture(data, nx, ny, nz);
    tex.format = THREE.RGBAFormat; tex.type = THREE.UnsignedByteType;
    tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter;
    tex.wrapS = tex.wrapT = tex.wrapR = THREE.ClampToEdgeWrapping;
    tex.generateMipmaps = true; tex.unpackAlignment = 1;
    uVol.value = tex;
    stats.cells = n;
    dirty = fullBox();
  }
  const fullBox = () => [0, 0, 0, nx - 1, ny - 1, nz - 1];
  const grow = (b, c) => b ? [Math.min(b[0], c[0]), Math.min(b[1], c[1]), Math.min(b[2], c[2]), Math.max(b[3], c[3]), Math.max(b[4], c[4]), Math.max(b[5], c[5])] : c.slice();
  const touch = (a, b) => a && b && a[0] <= b[3] && b[0] <= a[3] && a[1] <= b[4] && b[1] <= a[4] && a[2] <= b[5] && b[2] <= a[5];

  // un punto del mundo con peso w (fracción de celda) entra al volumen; clip = zona que se está rehaciendo
  let clip = null, ebox = null;
  function splat(x, y, z, w, r, g, b, e, fillBelow) {
    const ix = Math.floor((x - min.x) / cell), iy = Math.floor((y - min.y) / cell), iz = Math.floor((z - min.z) / cell);
    if (ix < 0 || iy < 0 || iz < 0 || ix >= nx || iy >= ny || iz >= nz) return;
    const y0 = fillBelow ? 0 : iy;
    if (ebox) { if (ix < ebox[0]) ebox[0] = ix; if (y0 < ebox[1]) ebox[1] = y0; if (iz < ebox[2]) ebox[2] = iz; if (ix > ebox[3]) ebox[3] = ix; if (iy > ebox[4]) ebox[4] = iy; if (iz > ebox[5]) ebox[5] = iz; }
    if (ix < clip[0] || iz < clip[2] || ix > clip[3] || iz > clip[5]) return;
    stats.splats++;
    for (let j = iy; j >= y0; j--) {
      if (j < clip[1] || j > clip[4]) continue;
      const i = ix + nx * (j + ny * iz), ww = j === iy ? w : 1;
      cov[i] += ww; alb[i * 3] += r * ww; alb[i * 3 + 1] += g * ww; alb[i * 3 + 2] += b * ww;
      if (e && j === iy) { emi[i * 3] += r * e * ww; emi[i * 3 + 1] += g * e * ww; emi[i * 3 + 2] += b * e * ww; }
    }
  }
  const v3 = new THREE.Vector3(), va = new THREE.Vector3(), vb = new THREE.Vector3(), vc = new THREE.Vector3(), vn = new THREE.Vector3(), nm = new THREE.Matrix3();
  const LIN = new Float32Array(256);
  for (let i = 0; i < 256; i++) { const c = i / 255; LIN[i] = c < 0.04045 ? c * 0.0773993808 : Math.pow(c * 0.9478672986 + 0.0521327014, 2.4); }
  const emitOf = (kind) => { const k = EMIT[kind]; return k ? k[0] + k[1] * glow : 0; };
  function splatEntry(en) {
    ebox = [1e9, 1e9, 1e9, -1e9, -1e9, -1e9];
    if (en.type === 'grid') {
      const d = en.data, m = en.matrix, s = en.scale;
      const ws = s * Math.cbrt(Math.abs(m.determinant()));         // tamaño de un vóxel en el mundo
      const k = Math.max(1, Math.ceil(ws / cell - 0.01)), w = Math.pow(ws / k / cell, 3);
      for (let i = 0; i < d.length; i += 4) {
        const c = d[i + 3], r = LIN[(c >> 16) & 255], g = LIN[(c >> 8) & 255], b = LIN[c & 255];
        for (let a = 0; a < k; a++) for (let bq = 0; bq < k; bq++) for (let cq = 0; cq < k; cq++) {
          v3.set((d[i] + (a + 0.5) / k) * s, (d[i + 1] + (bq + 0.5) / k) * s, (d[i + 2] + (cq + 0.5) / k) * s).applyMatrix4(m);
          splat(v3.x, v3.y, v3.z, w, r, g, b, en.emissive, en.fillBelow && bq === 0);
        }
      }
    } else {
      // malla: se muestrea la cáscara, cada cara corrida media celda hacia adentro
      const mesh = en.mesh, geo = mesh.geometry, pos = geo.attributes.position, col = geo.attributes.color, nor = geo.attributes.normal;
      if (!pos) { en.box = null; return; }
      const idx = geo.index, m = mesh.matrixWorld, n = idx ? idx.count : pos.count, h = cell * 0.5;
      nm.getNormalMatrix(m);
      const e = emitOf(en.kind), warm = en.kind === 'window';
      for (let t = 0; t < n; t += 3) {
        const ia = idx ? idx.getX(t) : t, ib = idx ? idx.getX(t + 1) : t + 1, ic = idx ? idx.getX(t + 2) : t + 2;
        va.fromBufferAttribute(pos, ia).applyMatrix4(m); vb.fromBufferAttribute(pos, ib).applyMatrix4(m); vc.fromBufferAttribute(pos, ic).applyMatrix4(m);
        if (nor) vn.fromBufferAttribute(nor, ia).applyMatrix3(nm).normalize(); else vn.set(0, 0, 0);
        let r = 0.5, g = 0.5, b = 0.5;
        if (col) { r = (col.getX(ia) + col.getX(ib) + col.getX(ic)) / 3; g = (col.getY(ia) + col.getY(ib) + col.getY(ic)) / 3; b = (col.getZ(ia) + col.getZ(ib) + col.getZ(ic)) / 3; }
        if (warm) { r = WINDOW_COLOR[0]; g = WINDOW_COLOR[1]; b = WINDOW_COLOR[2]; }
        vb.sub(va); vc.sub(va);
        const l1 = vb.length(), l2 = vc.length();
        const nu = Math.max(1, Math.ceil(l1 / h)), nv = Math.max(1, Math.ceil(l2 / h));
        const w = (l1 / nu) * (l2 / nv) / (cell * cell);
        const ox = va.x - vn.x * h * 0.9, oy = va.y - vn.y * h * 0.9, oz = va.z - vn.z * h * 0.9;
        for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
          const u = (i + 0.5) / nu, v = (j + 0.5) / nv;
          if (u + v > 1) continue;
          splat(ox + vb.x * u + vc.x * v, oy + vb.y * u + vc.y * v, oz + vb.z * u + vc.z * v, w, r, g, b, e, false);
        }
      }
    }
    en.box = ebox[0] <= ebox[3] ? ebox : null;
    ebox = null;
  }
  function rebuild() {
    if (!cov) alloc();
    if (!dirty) return;
    const t0 = performance.now();
    const c = clip = [Math.max(0, dirty[0]), Math.max(0, dirty[1]), Math.max(0, dirty[2]), Math.min(nx - 1, dirty[3]), Math.min(ny - 1, dirty[4]), Math.min(nz - 1, dirty[5])];
    for (let z = c[2]; z <= c[5]; z++) for (let y = c[1]; y <= c[4]; y++) {
      const a = c[0] + nx * (y + ny * z), b = a + (c[3] - c[0]) + 1;
      cov.fill(0, a, b); alb.fill(0, a * 3, b * 3); emi.fill(0, a * 3, b * 3);
    }
    // se vuelven a volcar las entradas que tocan la zona (las nuevas todavía no tienen caja)
    for (const en of entries.values()) if (!en.box || en.fresh || touch(en.box, c)) { en.fresh = false; splatEntry(en); }
    dirty = null; clip = null; builtGlow = glow;
    stats.builds++; stats.buildMs = performance.now() - t0; stats.entries = entries.size;
    bakeDirty = true;
  }
  // Rebote difuso (hito 4): a cada celda de superficie se le hornea en CPU la luz que devuelve (sol con sombra y
  // algo de cielo, por su color), sumada a lo que emite. Los conos del pase de luz, la niebla y los reflejos leen
  // ese rgb, así que el rebote sale gratis en GPU. Se rehace todo el volumen cuando cambia la escena o el sol.
  const baked = { dir: new THREE.Vector3(), sun: new THREE.Color(), sky: new THREE.Color(), t: -1e9 };
  let bakeDirty = true, bounce = opts.bounce ?? 0.7;
  function sunVis(x, y, z, dx, dy, dz) {
    let T = 1;
    for (let s = 0; s < 96; s++) {
      x += dx; y += dy; z += dz;
      const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
      if (ix < 0 || iy < 0 || iz < 0 || ix >= nx || iy >= ny || iz >= nz) break;
      const c = cov[ix + nx * (iy + ny * iz)];
      if (c > 0) { T *= 1 - Math.min(1, c); if (T < 0.05) return 0; }
    }
    return T;
  }
  function bake() {
    const t0 = performance.now();
    const sd = env.sunDir, S = env.sun, K = env.sky, G = env.ground, sunOn = S.r + S.g + S.b > 1e-4;
    const FREE = 0.3, sxy = nx * ny;
    for (let z = 0, i = 0; z < nz; z++) for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++, i++) {
      const o = i * 4, w = cov[i];
      if (w <= 0) { data[o] = data[o + 1] = data[o + 2] = data[o + 3] = 0; continue; }
      const a = Math.min(1, w), k = a / w / RAD_MAX;
      let r = emi[i * 3], g = emi[i * 3 + 1], b = emi[i * 3 + 2];
      if (bounce > 0 && w > FREE) {
        // normal de la celda: hacia los vecinos libres
        const fx = (x === nx - 1 || cov[i + 1] < FREE ? 1 : 0) - (x === 0 || cov[i - 1] < FREE ? 1 : 0);
        const fy = (y === ny - 1 || cov[i + nx] < FREE ? 1 : 0) - (y === 0 || cov[i - nx] < FREE ? 1 : 0);
        const fz = (z === nz - 1 || cov[i + sxy] < FREE ? 1 : 0) - (z === 0 || cov[i - sxy] < FREE ? 1 : 0);
        const l = Math.hypot(fx, fy, fz);
        if (l > 0) {
          const n0 = fx / l, n1 = fy / l, n2 = fz / l;
          const ndl = n0 * sd.x + n1 * sd.y + n2 * sd.z;
          const sv = sunOn && ndl > 0 ? ndl * sunVis(x + 0.5 + fx, y + 0.5 + fy, z + 0.5 + fz, sd.x, sd.y, sd.z) : 0;
          const up = 0.5 + 0.5 * n1, sk = 0.3 * bounce, sb = sv * bounce;
          r += alb[i * 3] * (S.r * sb + (K.r * up + G.r * (1 - up)) * sk);
          g += alb[i * 3 + 1] * (S.g * sb + (K.g * up + G.g * (1 - up)) * sk);
          b += alb[i * 3 + 2] * (S.b * sb + (K.b * up + G.b * (1 - up)) * sk);
        }
      }
      data[o] = Math.min(255, Math.sqrt(r * k) * 255 + 0.5);
      data[o + 1] = Math.min(255, Math.sqrt(g * k) * 255 + 0.5);
      data[o + 2] = Math.min(255, Math.sqrt(b * k) * 255 + 0.5);
      data[o + 3] = a * 255 + 0.5;
    }
    tex.needsUpdate = true;
    bakeDirty = false;
    baked.dir.copy(sd); baked.sun.copy(S); baked.sky.copy(K); baked.t = t0;
    stats.bakes++; stats.bakeMs = performance.now() - t0;
  }
  const far = (a, b) => Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b) > 0.04 * (a.r + a.g + a.b + b.r + b.g + b.b) + 1e-4;
  // caja (en celdas) que va a ocupar una entrada, estimada desde su caja local: para saber qué zona rehacer
  const bb = new THREE.Box3();
  function estimate(en) {
    if (!cov) return null;
    if (en.type === 'grid') bb.copy(en.local).applyMatrix4(en.matrix);
    else {
      const g = en.mesh.geometry;
      if (!g.boundingBox) g.computeBoundingBox();
      bb.copy(g.boundingBox).applyMatrix4(en.mesh.matrixWorld);
    }
    const c = (v, m) => Math.floor((v - m) / cell);
    return [c(bb.min.x, min.x) - 1, en.fillBelow ? 0 : c(bb.min.y, min.y) - 1, c(bb.min.z, min.z) - 1, c(bb.max.x, min.x) + 1, c(bb.max.y, min.y) + 1, c(bb.max.z, min.z) + 1];
  }
  const mark = (en) => {
    if (en.box) dirty = grow(dirty, en.box);
    const e = estimate(en);
    if (e) dirty = grow(dirty, e);
    en.fresh = true;
  };

  // ---------- pre-pase y pase de luz ----------
  const gRT = new THREE.WebGLRenderTarget(1, 1, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true });
  gRT.depthTexture = new THREE.DepthTexture(1, 1); gRT.depthTexture.type = THREE.UnsignedIntType;
  const lRT = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false });
  const normalMat = new THREE.MeshNormalMaterial();
  const env = { sunDir: new THREE.Vector3(0.4, 0.8, 0.3).normalize(), sun: new THREE.Color(2, 1.9, 1.7), sky: new THREE.Color(0.4, 0.5, 0.7), ground: new THREE.Color(0.1, 0.09, 0.08) };
  const pPos = Array.from({ length: MAX_POINTS }, () => new THREE.Vector4()), pCol = Array.from({ length: MAX_POINTS }, () => new THREE.Vector3());
  const lightMat = new THREE.ShaderMaterial({
    uniforms: {
      tDepth: { value: gRT.depthTexture }, tNormal: { value: gRT.texture }, tVol: uVol,
      invProj: { value: new THREE.Matrix4() }, camWorld: { value: new THREE.Matrix4() },
      volMin: { value: min }, volSize: { value: size }, cell: { value: cell },
      sunDir: { value: env.sunDir }, sunOn: { value: 1 }, sunAp: { value: opts.sunAperture ?? 0.07 },
      skyCol: { value: env.sky }, groundCol: { value: env.ground }, giGain: { value: 1 }, aoPow: { value: 1.3 },
      pPos: { value: pPos }, pCol: { value: pCol }, pCount: { value: 0 },
    },
    vertexShader: QUAD_VS, fragmentShader: LIGHT_FS, depthTest: false, depthWrite: false, blending: THREE.NoBlending,
  });
  const fRT = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false });
  const lu = lightMat.uniforms;
  const fogMat = new THREE.ShaderMaterial({
    uniforms: {
      tDepth: lu.tDepth, tVol: uVol, invProj: lu.invProj, camWorld: lu.camWorld, volMin: lu.volMin, volSize: lu.volSize, cell: lu.cell,
      sunDir: lu.sunDir, sunCol: { value: env.sun }, skyCol: lu.skyCol, groundCol: lu.groundCol,
      fogP: { value: new THREE.Vector3(0, 0, 1) }, frame: { value: 0 }, fogGlow: { value: 0.6 },
      pPos: lu.pPos, pCol: lu.pCol, pCount: lu.pCount,
    },
    vertexShader: QUAD_VS, fragmentShader: FOG_FS, depthTest: false, depthWrite: false, blending: THREE.NoBlending,
  });
  let fogOn = false, frame = 0, clock = null;
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), lightMat); quad.frustumCulled = false;
  const qScene = new THREE.Scene(); qScene.add(quad);
  const qCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  // ---------- materiales ----------
  const shared = {
    tLight: { value: lRT.texture }, tGN: { value: gRT.texture }, tGD: { value: gRT.depthTexture },
    halfSize: { value: new THREE.Vector2(1, 1) }, fullSize: { value: new THREE.Vector2(1, 1) },
    camNear: { value: 0.1 }, camFar: { value: 100 }, sunDir: { value: env.sunDir }, sunCol: { value: env.sun }, debugView: { value: 0 },
    tVol: uVol, volMin: lu.volMin, volSize: lu.volSize, cell: lu.cell, skyCol: lu.skyCol, groundCol: lu.groundCol,
    time: { value: 0 }, bgCol: { value: new THREE.Color(0.5, 0.6, 0.8) },
  };
  const mats = new Map();
  /**
   * Material fotográfico: 'solid' | 'glow' (luces) | 'window' (se prende de noche y de día refleja) | 'water' |
   * 'metal' | 'glass'. Los cuatro últimos reflejan la escena y el cielo (REFLECT).
   */
  function material(kind = 'solid', o = {}) {
    const key = kind + (o.opacity != null ? ':' + o.opacity : '');
    if (mats.has(key)) return mats.get(key);
    const transparent = kind === 'water' || (o.opacity != null && o.opacity < 1);
    const rf = REFLECT[kind];
    const m = new THREE.ShaderMaterial({
      defines: rf ? { REFLECT: '', ...(kind === 'water' ? { WATER: '' } : {}) } : {},
      uniforms: {
        ...shared, f0: { value: rf?.f0 ?? 0.04 }, metalTint: { value: rf?.tint ?? 0 }, ripple: { value: rf?.ripple ?? 0 }, emit: { value: emitOf(kind) }, emitCol: { value: new THREE.Vector3(...WINDOW_COLOR) },
        emitTint: { value: kind === 'window' ? 1 : 0 }, opacity: { value: o.opacity ?? (kind === 'water' ? 0.82 : 1) },
      },
      vertexShader: MAT_VS, fragmentShader: MAT_FS, vertexColors: true, transparent, depthWrite: !transparent,
    });
    m.userData.photoKind = kind;
    mats.set(key, m);
    return m;
  }
  const hidden = [];
  const tmpColor = new THREE.Color();
  const api = {
    cell, stats, material,
    get texture() { return tex; },
    /**
     * Material por vóxel: de los flags de un material de MagicaVoxel (vox-loader.js: emissive, metal, glass, water,
     * rough) al tipo de material fotográfico. Uso: vox.split(m => L.kindOf(m) === 'metal') y una malla por tipo.
     */
    kindOf(m) { return !m ? 'solid' : m.emissive > 0 ? 'glow' : m.water ? 'water' : m.glass ? 'glass' : m.metal > 0.5 && (m.rough ?? 1) < 0.7 ? 'metal' : 'solid'; },
    /** Reloj de las ondas del agua (segundos). null = el del sistema; un número lo deja quieto (capturas). */
    set time(v) { clock = v; },
    get fogTexture() { return fRT.texture; },
    get fogOn() { return fogOn; },
    get debug() { return shared.debugView.value; }, set debug(v) { shared.debugView.value = v | 0; },
    get bounds() { return { min: min.clone(), size: size.clone(), dims: [nx, ny, nz] }; },
    /** Caja del volumen en coordenadas de mundo. Tira lo armado: llamarla antes de agregar. */
    setBounds(mn, mx) {
      min.set(Math.floor(mn.x / cell) * cell, Math.floor(mn.y / cell) * cell, Math.floor(mn.z / cell) * cell);
      size.set(mx.x - min.x, mx.y - min.y, mx.z - min.z);
      alloc();
      for (const en of entries.values()) { en.box = null; en.fresh = true; }
    },
    /**
     * Suma una grilla al volumen. voxels: `Voxels` o Int32Array empaquetado [x, y, z, color, ...]; matrix: de la grilla
     * al mundo (sin la escala del vóxel, que va en o.scale). o.emissive: cuánta luz da (0 = nada).
     * o.fillBelow: rellena hacia abajo hasta el fondo del volumen (terreno hecho solo de cáscara). Devuelve un id.
     */
    add(voxels, matrix, o = {}) {
      let d = voxels;
      if (voxels && voxels.map instanceof Map) {
        d = new Int32Array(voxels.map.size * 4);
        let i = 0;
        for (const [k, c] of voxels.map) { const a = k.indexOf(','), b = k.indexOf(',', a + 1); d[i++] = +k.slice(0, a); d[i++] = +k.slice(a + 1, b); d[i++] = +k.slice(b + 1); d[i++] = c; }
      }
      const sc = o.scale ?? 1, local = new THREE.Box3();
      for (let i = 0; i < d.length; i += 4) { v3.set(d[i] * sc, d[i + 1] * sc, d[i + 2] * sc); local.expandByPoint(v3); }
      local.max.addScalar(sc);
      const en = { type: 'grid', data: d, local, matrix: (matrix || new THREE.Matrix4()).clone(), scale: sc, emissive: o.emissive || 0, fillBelow: !!o.fillBelow, box: null, fresh: true };
      entries.set(++seq, en); mark(en);
      return seq;
    },
    /** Suma las mallas de un objeto (su cáscara, con los colores por vértice). kind: 'solid' | 'glow' | 'window'. */
    addMesh(mesh, kind = 'solid') {
      mesh.updateWorldMatrix(true, false);
      const en = { type: 'mesh', mesh, kind, box: null, fresh: true };
      entries.set(++seq, en); mark(en);
      return seq;
    },
    /** Mueve una entrada (grilla: matriz nueva; malla: relee su matrixWorld). Solo se rehace la zona vieja y la nueva. */
    update(id, matrix) {
      const en = entries.get(id); if (!en) return;
      if (en.box) dirty = grow(dirty, en.box);
      if (en.type === 'grid' && matrix) en.matrix.copy(matrix);
      else if (en.mesh) en.mesh.updateWorldMatrix(true, false);
      mark(en);
    },
    remove(id) {
      const en = entries.get(id); if (!en) return;
      entries.delete(id);
      if (en.box) dirty = grow(dirty, en.box);
    },
    /**
     * Cambia los materiales del juego (voxelMaterial, glowMaterial, windowMaterial) por los fotográficos en todo el
     * objeto y suma sus mallas al volumen (o.volume: false = solo materiales). Devuelve los ids del volumen.
     */
    adopt(root, o = {}) {
      root.updateMatrixWorld(true);
      const ids = [];
      root.traverse(m => {
        if (!m.isMesh || m.isInstancedMesh || !m.material || Array.isArray(m.material)) return;
        const kind = m.material.userData?.photoKind || classify(m.material);
        if (!kind) return;
        if (!m.material.userData?.photoKind) m.material = material(kind);
        if (o.volume !== false && kind !== 'water' && !m.userData.noVolume) ids.push(api.addMesh(m, kind));
      });
      return ids;
    },
    /** Luz del ambiente. sun, sky y ground: THREE.Color lineales ya multiplicados por su intensidad. glow: noche 0..1. */
    setEnv(e = {}) {
      if (e.sunDir) env.sunDir.copy(e.sunDir).normalize();
      if (e.sun) env.sun.copy(e.sun);
      if (e.sky) env.sky.copy(e.sky);
      if (e.ground) env.ground.copy(e.ground);
      if (e.sunAperture != null) lightMat.uniforms.sunAp.value = e.sunAperture;
      if (e.giGain != null) lightMat.uniforms.giGain.value = e.giGain;
      if (e.aoPow != null) lightMat.uniforms.aoPow.value = e.aoPow;
      if (e.bounce != null && e.bounce !== bounce) { bounce = e.bounce; bakeDirty = true; }
      // niebla volumétrica: { density (por unidad de mundo; 0 = sin niebla), height (y donde empieza a aflojar), falloff, glow }
      if (e.fog !== undefined) {
        const f = e.fog || {};
        fogMat.uniforms.fogP.value.set(f.density || 0, f.height ?? 0, f.falloff ?? 1);
        if (f.glow != null) fogMat.uniforms.fogGlow.value = f.glow;
        fogOn = (f.density || 0) > 0;
      }
      if (e.glow != null) {
        glow = Math.max(0, Math.min(1, e.glow));
        for (const m of mats.values()) m.uniforms.emit.value = emitOf(m.userData.photoKind);
        // lo emisivo del volumen se rehace cuando la noche cambió lo suficiente
        if (Math.abs(glow - builtGlow) > 0.04) for (const en of entries.values()) if (en.type === 'mesh' && EMIT[en.kind]) mark(en);
      }
      lightMat.uniforms.sunOn.value = env.sun.r + env.sun.g + env.sun.b > 1e-4 ? 1 : 0;
      // el rebote se vuelve a hornear si el sol o el cielo cambiaron (a lo sumo dos veces por segundo)
      if (!bakeDirty && bounce > 0 && performance.now() - baked.t > 500 && (baked.dir.dot(env.sunDir) < 0.9995 || far(baked.sun, env.sun) || far(baked.sky, env.sky))) bakeDirty = true;
    },
    /** Luces puntuales con sombra (hasta 8): [{ position: Vector3 (mundo), color, intensity, radius }]. */
    setPoints(list = []) {
      const n = Math.min(MAX_POINTS, list.length);
      for (let i = 0; i < n; i++) {
        const p = list[i];
        pPos[i].set(p.position.x, p.position.y, p.position.z, p.radius ?? 4);
        tmpColor.set(p.color ?? 0xffffff);
        pCol[i].set(tmpColor.r, tmpColor.g, tmpColor.b).multiplyScalar(p.intensity ?? 1);
      }
      lightMat.uniforms.pCount.value = n;
    },
    setSize(w, h) {
      const hw = Math.max(1, Math.ceil(w / 2)), hh = Math.max(1, Math.ceil(h / 2));
      gRT.setSize(hw, hh); lRT.setSize(hw, hh); fRT.setSize(hw, hh);
      shared.halfSize.value.set(hw, hh); shared.fullSize.value.set(w, h);
    },
    /** Antes del dibujo principal: rehace el volumen si hace falta, pre-pase de profundidad y normales, y pase de luz. */
    prepare(scene, camera) {
      rebuild();
      if (bakeDirty && cov) bake();
      frame++;
      shared.time.value = clock ?? performance.now() / 1000;
      if (scene.background?.isColor) shared.bgCol.value.copy(scene.background); else shared.bgCol.value.copy(env.sky);
      const prevRT = renderer.getRenderTarget(), bg = scene.background, ov = scene.overrideMaterial, sh = renderer.shadowMap.autoUpdate;
      hidden.length = 0;
      scene.traverse(o => {
        if (!o.visible) return;
        const m = Array.isArray(o.material) ? o.material[0] : o.material;
        if (o.isSprite || o.isPoints || o.isLine || (o.isMesh && m && (m.transparent || m.depthWrite === false || o.userData.noLight))) { o.visible = false; hidden.push(o); }
      });
      scene.background = null; scene.overrideMaterial = normalMat; renderer.shadowMap.autoUpdate = false;
      renderer.getClearColor(tmpColor); const ca = renderer.getClearAlpha();
      renderer.setRenderTarget(gRT);
      renderer.setClearColor(0x000000, 0);
      renderer.clear();
      renderer.render(scene, camera);
      renderer.setClearColor(tmpColor, ca);
      scene.background = bg; scene.overrideMaterial = ov; renderer.shadowMap.autoUpdate = sh;
      for (const o of hidden) o.visible = true;
      const u = lightMat.uniforms;
      u.invProj.value.copy(camera.projectionMatrixInverse); u.camWorld.value.copy(camera.matrixWorld);
      shared.camNear.value = camera.near; shared.camFar.value = camera.far;
      renderer.setRenderTarget(lRT);
      renderer.render(qScene, qCam);
      if (fogOn) { fogMat.uniforms.frame.value = frame % 64; quad.material = fogMat; renderer.setRenderTarget(fRT); renderer.render(qScene, qCam); quad.material = lightMat; }
      renderer.setRenderTarget(prevRT);
    },
    dispose() {
      tex?.dispose(); gRT.depthTexture.dispose(); gRT.dispose(); lRT.dispose(); fRT.dispose(); fogMat.dispose(); normalMat.dispose(); lightMat.dispose(); quad.geometry.dispose();
      for (const m of mats.values()) m.dispose();
      mats.clear(); entries.clear();
    },
  };
  return api;
}
