// Estacionamiento Express — física arcade pura (sin THREE, testeable en node).
// Convención de ángulos: a (radianes) = rumbo; el frente del auto apunta a (sin a, cos a) en XZ.
// a = 0 mira a +Z (abajo en pantalla), a = PI mira a -Z (arriba en pantalla).

export const CAR_HW = 0.3;       // medio ancho del auto (unidades de mundo)
export const CAR_HL = 0.5;       // medio largo
export const WHEELBASE = 0.62;   // distancia entre ejes (modelo bicicleta)
export const CONE_R = 0.12;      // radio de colisión de un cono
export const DEG = Math.PI / 180;

/** Normaliza un ángulo a (-PI, PI]. */
export function wrapAngle(a) {
  a = (a + Math.PI) % (Math.PI * 2);
  if (a < 0) a += Math.PI * 2;
  return a - Math.PI;
}

/** Crea el estado del auto a partir de las stats {speed, handling} (1..5). */
export function makeCar(stats = {}) {
  const sp = clamp(stats.speed ?? 3, 1, 5), hd = clamp(stats.handling ?? 3, 1, 5);
  return {
    x: 0, z: 0, a: 0, v: 0, steer: 0,
    maxF: 1.75 + sp * 0.22,          // velocidad máx hacia adelante
    maxR: 1.15 + sp * 0.08,          // velocidad máx marcha atrás
    accel: 2.2 + sp * 0.3,
    brake: 6.5,
    friction: 1.7,
    maxSteer: (28 + hd * 3) * DEG,   // ángulo de dirección máximo
    steerRate: 2.6 + hd * 0.45,      // rad/s al girar el volante
    steerBack: 4.5 + hd * 0.4,       // vuelve al centro al soltar
  };
}

export function placeCar(car, x, z, a) {
  car.x = x; car.z = z; car.a = a; car.v = 0; car.steer = 0;
}

/**
 * Integra un paso. input = { gas, rev, brake (bool), steer (-1 der .. +1 izq) }
 * steer positivo dobla a la izquierda del conductor (sentido antihorario visto desde arriba).
 */
export function stepCar(car, input, dt) {
  const { gas, rev, brake } = input;
  let v = car.v;
  if (brake) {
    v = approach(v, 0, car.brake * dt);
  } else if (gas && !rev) {
    if (v < -0.05) v = approach(v, 0, car.brake * dt);
    else v += car.accel * dt;
  } else if (rev && !gas) {
    if (v > 0.05) v = approach(v, 0, car.brake * dt);
    else v -= car.accel * 0.8 * dt;
  } else {
    v = approach(v, 0, car.friction * dt);
  }
  car.v = clamp(v, -car.maxR, car.maxF);

  const target = clamp(input.steer || 0, -1, 1) * car.maxSteer;
  const rate = target !== 0 && Math.sign(target) === Math.sign(car.steer) ? car.steerRate : car.steerBack;
  car.steer = approach(car.steer, target, rate * dt);

  car.a = wrapAngle(car.a + (car.v / WHEELBASE) * Math.tan(car.steer) * dt);
  car.x += Math.sin(car.a) * car.v * dt;
  car.z += Math.cos(car.a) * car.v * dt;
}

// ---------- Cajas orientadas ----------
/** Caja orientada: centro, medio ancho (lateral), medio largo (a lo largo del rumbo a). */
export function makeBox(x, z, hw, hl, a = 0) {
  const b = { x, z, hw, hl, a: 0, fx: 0, fz: 1, rx: 1, rz: 0 };
  setBox(b, x, z, a);
  return b;
}
export function setBox(b, x, z, a) {
  b.x = x; b.z = z; b.a = a;
  b.fx = Math.sin(a); b.fz = Math.cos(a);   // eje largo
  b.rx = Math.cos(a); b.rz = -Math.sin(a);  // eje ancho
  return b;
}
function radius(b, ax, az) {
  return b.hl * Math.abs(b.fx * ax + b.fz * az) + b.hw * Math.abs(b.rx * ax + b.rz * az);
}
/**
 * SAT entre dos cajas. Devuelve la profundidad de penetración (0 = no chocan)
 * y deja en out.nx/out.nz la normal para empujar A fuera de B.
 */
export function collideBoxes(A, B, out) {
  const dx = A.x - B.x, dz = A.z - B.z;
  let best = Infinity;
  for (let i = 0; i < 4; i++) {
    const src = i < 2 ? A : B;
    const ax = i % 2 === 0 ? src.fx : src.rx, az = i % 2 === 0 ? src.fz : src.rz;
    const d = dx * ax + dz * az;
    const o = radius(A, ax, az) + radius(B, ax, az) - Math.abs(d);
    if (o <= 0) return 0;
    if (o < best) { best = o; const s = d < 0 ? -1 : 1; out.nx = ax * s; out.nz = az * s; }
  }
  return best;
}
/** Círculo vs caja: devuelve penetración y normal (empuja el círculo fuera de la caja). */
export function circleVsBox(cx, cz, r, B, out) {
  const dx = cx - B.x, dz = cz - B.z;
  const lf = dx * B.fx + dz * B.fz, lr = dx * B.rx + dz * B.rz;
  const qf = clamp(lf, -B.hl, B.hl), qr = clamp(lr, -B.hw, B.hw);
  const px = B.x + B.fx * qf + B.rx * qr, pz = B.z + B.fz * qf + B.rz * qr;
  let nx = cx - px, nz = cz - pz;
  const d2 = nx * nx + nz * nz;
  if (d2 > r * r) return 0;
  const d = Math.sqrt(d2);
  if (d < 1e-6) { // centro adentro de la caja: empujar por el eje más corto
    const ef = B.hl - Math.abs(lf), er = B.hw - Math.abs(lr);
    if (ef < er) { const s = lf < 0 ? -1 : 1; out.nx = B.fx * s; out.nz = B.fz * s; return ef + r; }
    const s = lr < 0 ? -1 : 1; out.nx = B.rx * s; out.nz = B.rz * s; return er + r;
  }
  out.nx = nx / d; out.nz = nz / d;
  return r - d;
}

/** Esquinas del auto (8 números: x0,z0,x1,z1,...). */
export function boxCorners(b, out) {
  let k = 0;
  for (const sf of [1, -1]) for (const sr of [1, -1]) {
    out[k++] = b.x + b.fx * b.hl * sf + b.rx * b.hw * sr;
    out[k++] = b.z + b.fz * b.hl * sf + b.rz * b.hw * sr;
  }
  return out;
}

/**
 * ¿Está el auto (caja) dentro del lugar? spot = {x,z,w,l,a (rad), flip}
 * Devuelve { inside, aligned, angleOff (grados), fill (0..1 cuántas esquinas adentro) }
 */
const _corners = new Float64Array(8);
export function spotCheck(box, spot, res = {}, tol = 0.07, maxAngle = 20) {
  boxCorners(box, _corners);
  const fx = Math.sin(spot.a), fz = Math.cos(spot.a), rx = Math.cos(spot.a), rz = -Math.sin(spot.a);
  let n = 0;
  for (let i = 0; i < 8; i += 2) {
    const dx = _corners[i] - spot.x, dz = _corners[i + 1] - spot.z;
    const lf = dx * fx + dz * fz, lr = dx * rx + dz * rz;
    if (Math.abs(lf) <= spot.l / 2 + tol && Math.abs(lr) <= spot.w / 2 + tol) n++;
  }
  let off = Math.abs(wrapAngle(box.a - spot.a)) / DEG;
  if (spot.flip) off = Math.min(off, 180 - off);
  res.inside = n === 4;
  res.fill = n / 4;
  res.angleOff = off;
  res.aligned = off <= maxAngle;
  return res;
}

export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
export function approach(v, t, d) { return v < t ? Math.min(t, v + d) : Math.max(t, v - d); }
