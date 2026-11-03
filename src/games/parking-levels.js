// Estacionamiento Real — niveles definidos por datos.
// Unidades: 1 = largo de un auto. Área centrada en el origen: x ∈ [-w/2, w/2], z ∈ [-d/2, d/2].
// Ángulos en grados: 180 = mirando hacia arriba de la pantalla (-Z), 0 = hacia abajo (+Z), 90 = derecha (+X), 270 = izquierda (-X).
//
// Nivel:
//   name, goal (texto del objetivo), tip (consejo corto), area [w, d], start [x, z, a]
//   spot   { x, z, a, w, l, flip }   lugar objetivo; a = rumbo con el que tiene que quedar el auto; flip = vale al revés también
//   stalls [{ x, z, a, w, l, style }] líneas pintadas ('u' = laterales + fondo hacia donde mira a, 'ends' = solo extremos)
//   cars   [{ x, z, a }]             autos estacionados (obstáculos)
//   cones  [[x, z]]                  conos (se caen al tocarlos, cuentan como toque)
//   walls  [{ x, z, w, d, a, kind }] paredes/cordones internos: kind 'curb' | 'garage' | 'planter'
//   par    segundos para 3 estrellas · limit segundos de tiempo total

const SW = 0.9, SL = 1.4;           // lugar estándar (ancho, largo)

/** Fila de lugares a lo largo de X. */
function rowX(x0, z, n, a, step = SW, w = SW, l = SL) {
  return Array.from({ length: n }, (_, i) => ({ x: +(x0 + i * step).toFixed(3), z, a, w, l, style: 'u' }));
}
/** Fila de lugares a lo largo de Z. */
function rowZ(x, z0, n, a, step = SW, w = SW, l = SL) {
  return Array.from({ length: n }, (_, i) => ({ x, z: +(z0 + i * step).toFixed(3), a, w, l, style: 'u' }));
}
/** Autos en los lugares indicados de una fila (idx = índices o 'all'). */
function park(stalls, idx = 'all', skip = []) {
  const list = idx === 'all' ? stalls.map((_, i) => i) : idx;
  return list.filter(i => !skip.includes(i)).map(i => ({ x: stalls[i].x, z: stalls[i].z, a: stalls[i].a }));
}
/** Lugar objetivo a partir de un stall. */
function spotOf(st, a = st.a, flip = true, w = st.w - 0.06, l = st.l - 0.06) {
  return { x: st.x, z: st.z, a, w, l, flip };
}
/** Pared de conos a lo largo de X entre x0 y x1. */
function coneLine(x0, x1, z, step = 0.42) {
  const out = [];
  const n = Math.max(1, Math.round(Math.abs(x1 - x0) / step));
  for (let i = 0; i <= n; i++) out.push([+(x0 + (x1 - x0) * i / n).toFixed(3), z]);
  return out;
}
function coneLineZ(x, z0, z1, step = 0.55) {
  const out = [];
  const n = Math.max(1, Math.round(Math.abs(z1 - z0) / step));
  for (let i = 0; i <= n; i++) out.push([x, +(z0 + (z1 - z0) * i / n).toFixed(3)]);
  return out;
}
/** Lugares en paralelo sobre un carril vertical (centro x), con los autos y el hueco objetivo. */
function parallelLane(x, gapZ, gapL, carsBefore, carsAfter, w = 0.8) {
  const stalls = [], cars = [];
  const slot = 1.22;
  stalls.push({ x, z: gapZ, a: 180, w, l: gapL, style: 'ends' });
  let z = gapZ - gapL / 2 - 0.03 - 0.5;
  for (let i = 0; i < carsBefore; i++) { cars.push({ x, z, a: 180 }); stalls.push({ x, z, a: 180, w, l: slot - 0.04, style: 'ends' }); z -= slot; }
  z = gapZ + gapL / 2 + 0.03 + 0.5;
  for (let i = 0; i < carsAfter; i++) { cars.push({ x, z, a: 180 }); stalls.push({ x, z, a: 180, w, l: slot - 0.04, style: 'ends' }); z += slot; }
  return { stalls, cars, spot: { x, z: gapZ, a: 180, w: w - 0.02, l: gapL - 0.04, flip: true } };
}
/** Garaje (3 paredes). `a` = rumbo de un auto que entra de frente (apunta al fondo). Centro interior (x,z), ancho interior w, profundidad d. */
function garage(x, z, a, w = 0.88, d = 1.5, t = 0.12) {
  const r = a * Math.PI / 180, fx = Math.sin(r), fz = Math.cos(r), rx = Math.cos(r), rz = -Math.sin(r);
  // las paredes laterales van a lo largo de a; el fondo queda hacia donde apunta a
  const side = (s) => ({ x: x + rx * s * (w / 2 + t / 2), z: z + rz * s * (w / 2 + t / 2), w: t, d, a, kind: 'garage' });
  const back = { x: x + fx * (d / 2 + t / 2), z: z + fz * (d / 2 + t / 2), w: w + t * 2, d: t, a, kind: 'garage' };
  return [side(1), side(-1), back];
}

function L(def) { return def; }

const lv = [];

// 1 — Entrar derecho a un lugar vacío
{
  const top = rowX(-1.8, -3.2, 5, 180);
  lv.push(L({
    name: 'Primer lugar', area: [6, 8], start: [0, 2.6, 180],
    goal: 'Manejá derechito y estacioná en el lugar que brilla.',
    tip: 'Mantené Acelerar y soltalo un poquito antes de llegar. Para frenar, tocá Reversa.',
    stalls: top, spot: spotOf(top[2]), cars: park(top, [0, 4]), cones: [], walls: [], par: 12, limit: 90,
  }));
}
// 2 — Entre dos autos
{
  const top = rowX(-2.25, -3.2, 6, 180);
  lv.push(L({
    name: 'Entre dos', area: [7, 8], start: [-1.2, 2.6, 180],
    goal: 'Metete entre los dos autos sin tocarlos.',
    tip: 'Doblá un poquito para alinearte antes de entrar.',
    stalls: top, spot: spotOf(top[4]), cars: park(top, [0, 2, 3, 5]), cones: [], walls: [], par: 14, limit: 90,
  }));
}
// 3 — Doblar a la izquierda
{
  const left = rowZ(-2.7, -2.7, 5, 270), right = rowZ(2.7, -2.7, 5, 90);
  lv.push(L({
    name: 'A la izquierda', area: [7, 9], start: [0.4, 3.4, 180],
    goal: 'Doblá a la izquierda y entrá al lugar libre.',
    tip: 'Abrite un poco hacia la derecha antes de doblar.',
    stalls: [...left, ...right], spot: spotOf(left[1]),
    cars: [...park(left, [0, 2, 3]), ...park(right, [0, 1, 3, 4])], cones: [], walls: [], par: 15, limit: 90,
  }));
}
// 4 — Pasillo de conos
{
  const top = rowX(-1.8, -3.7, 5, 180);
  const cones = [];
  for (let z = 2.2; z >= -2.21; z -= 0.55) cones.push([-0.82, +z.toFixed(2)], [0.82, +z.toFixed(2)]);
  lv.push(L({
    name: 'Pasillo de conos', area: [6, 9], start: [0, 3.6, 180],
    goal: 'Pasá por el pasillo sin voltear ningún cono.',
    tip: 'Si un cono se cae, cuenta como un toque.',
    stalls: top, spot: spotOf(top[2]), cars: park(top, [0, 1, 3]), cones, walls: [], par: 12, limit: 90,
  }));
}
// 5 — Doblar a la derecha
{
  const right = rowZ(2.7, -2.7, 6, 90), left = rowZ(-2.7, -2.7, 6, 270);
  lv.push(L({
    name: 'A la derecha', area: [7, 9], start: [-0.5, 3.6, 180],
    goal: 'Ahora doblá a la derecha, entre dos autos.',
    tip: 'Doblá cuando la trompa pase el auto de abajo.',
    stalls: [...right, ...left], spot: spotOf(right[2]),
    cars: [...park(right, [0, 1, 3, 5]), ...park(left, [0, 1, 2, 4, 5])], cones: [], walls: [], par: 15, limit: 90,
  }));
}
// 6 — Rodear la fila del medio
{
  const top = rowX(-3.15, -4.2, 8, 180), mid = rowX(-1.8, 0, 5, 180);
  lv.push(L({
    name: 'La vuelta', area: [9, 10], start: [-3.4, 3.8, 180],
    goal: 'Rodeá la fila del medio y estacioná arriba.',
    tip: 'Usá todo el pasillo para doblar tranqui.',
    stalls: [...top, ...mid], spot: spotOf(top[6]),
    cars: [...park(top, [0, 1, 2, 4, 5, 7]), ...park(mid)], cones: [], walls: [], par: 22, limit: 120,
  }));
}
// 7 — Primera marcha atrás
{
  const bottom = rowX(-1.8, 3.2, 5, 0), top = rowX(-1.8, -3.2, 5, 180);
  lv.push(L({
    name: 'Marcha atrás', area: [6, 8], start: [0, 0.2, 180],
    goal: '¡De culata! Retrocedé derecho: la trompa queda mirando para arriba.',
    tip: 'Mantené Reversa. La flecha del piso muestra para dónde mira la trompa.',
    stalls: [...bottom, ...top], spot: spotOf(bottom[2], 180, false),
    cars: [...park(bottom, [0, 1, 3]), ...park(top, [0, 1, 3, 4])], cones: [], walls: [], par: 10, limit: 90,
  }));
}
// 8 — Culata con giro
{
  const left = rowZ(-2.7, -2.7, 5, 270), right = rowZ(2.7, -2.7, 5, 90);
  lv.push(L({
    name: 'Culata con giro', area: [7, 9], start: [0.6, 3.4, 180],
    goal: 'Estacioná de culata en el lugar de la izquierda.',
    tip: 'Pasate del lugar, doblá a la derecha y retrocedé doblando a la izquierda.',
    stalls: [...left, ...right], spot: spotOf(left[2], 90, false),
    cars: [...park(left, [0, 1, 3]), ...park(right, [0, 2, 3, 4])], cones: [], walls: [], par: 22, limit: 120,
  }));
}
// 9 — Paralelo fácil
{
  const p = parallelLane(2.15, -1.0, 2.2, 2, 3);
  const left = rowZ(-2.3, -4.0, 9, 270);
  lv.push(L({
    name: 'Paralelo fácil', area: [6, 10], start: [0.3, 4.0, 180],
    goal: 'Estacioná en paralelo, pegadita al cordón.',
    tip: 'El hueco es grande: entrá en diagonal y enderezá.',
    stalls: [...p.stalls, ...left], spot: p.spot,
    cars: [...p.cars, ...park(left, [0, 1, 2, 4, 5, 7, 8])], cones: [],
    walls: [{ x: 2.775, z: 0, w: 0.45, d: 10, a: 0, kind: 'curb' }], par: 18, limit: 120,
  }));
}
// 10 — Zigzag
{
  const top = rowX(-1.8, -4.7, 5, 180);
  const cones = [...coneLine(-3, 0.5, 2.6), ...coneLine(-0.5, 3, 0), ...coneLine(-3, 0.5, -2.6)];
  lv.push(L({
    name: 'Zigzag', area: [6, 11], start: [-1.6, 4.6, 180],
    goal: 'Zigzagueá entre los conos y estacioná arriba.',
    tip: 'Andá despacio en las curvas: los conos se caen fácil.',
    stalls: top, spot: spotOf(top[3]), cars: park(top, [1, 2, 4]), cones, walls: [], par: 22, limit: 120,
  }));
}
// 11 — Garaje angosto
{
  const left = rowZ(-2.3, -4.0, 4, 270), right = rowZ(2.3, -4.0, 4, 90);
  lv.push(L({
    name: 'Garaje angosto', area: [6, 9], start: [-1.2, 3.4, 180],
    goal: 'Entrá de frente al garaje angosto. ¡Despacito!',
    tip: 'Alineate bien derechita antes de entrar.',
    stalls: [...left, ...right], spot: { x: 0, z: -3.72, a: 180, w: 0.84, l: 1.36, flip: false },
    cars: [...park(left), ...park(right, [0, 1, 3])],
    cones: [[-0.95, -2.55], [0.95, -2.55]], walls: garage(0, -3.75, 180), par: 15, limit: 90,
  }));
}
// 12 — Paralelo de verdad
{
  const p = parallelLane(2.4, -0.5, 1.8, 3, 3);
  const left = rowZ(-2.5, -4.5, 9, 270);
  lv.push(L({
    name: 'Paralelo de verdad', area: [6.5, 11], start: [0.5, 4.6, 180],
    goal: 'Paralelo entre dos autos, junto al cordón.',
    tip: 'Truco: pasate del hueco y entrá marcha atrás.',
    stalls: [...p.stalls, ...left], spot: p.spot,
    cars: [...p.cars, ...park(left, 'all', [3, 6])], cones: [],
    walls: [{ x: 3.025, z: 0, w: 0.45, d: 11, a: 0, kind: 'curb' }], par: 25, limit: 120,
  }));
}
// 13 — En diagonal
{
  const zs = [-3.0, -1.73, -0.46, 0.81, 2.08];
  const left = zs.map(z => ({ x: -2.6, z, a: 225, w: SW, l: SL, style: 'u' }));
  const right = zs.map(z => ({ x: 2.6, z, a: 135, w: SW, l: SL, style: 'u' }));
  lv.push(L({
    name: 'En diagonal', area: [7, 9], start: [0, 3.6, 180],
    goal: 'Los lugares están en diagonal: entrá en ángulo.',
    tip: 'Doblá a la izquierda apenas veas el lugar.',
    stalls: [...left, ...right], spot: spotOf(left[2]),
    cars: [...park(left, [0, 1, 3, 4]), ...park(right, [0, 2, 3, 4])], cones: [], walls: [], par: 15, limit: 90,
  }));
}
// 14 — Garaje de culata
{
  const right = rowZ(2.7, -2.7, 5, 90), below = rowZ(-2.7, 0.45, 3, 270);
  lv.push(L({
    name: 'Garaje de culata', area: [7, 9], start: [0.8, 3.4, 180],
    goal: 'Metete marcha atrás en el garaje: la trompa mirando para afuera.',
    tip: 'Pasate del garaje y retrocedé doblando a la izquierda.',
    stalls: [...right, ...below], spot: { x: -2.7, z: -1.0, a: 90, w: 0.84, l: 1.36, flip: false },
    cars: [...park(right), ...park(below, [1, 2])], cones: [], walls: garage(-2.7, -1.0, 270), par: 25, limit: 120,
  }));
}
// 15 — Laberinto de conos
{
  const right = rowZ(2.7, -4.5, 3, 90), left = rowZ(-2.7, -4.5, 3, 270);
  const cones = [...coneLine(-3.5, 0.9, 3.0), ...coneLine(-0.9, 3.5, 0.6), ...coneLine(-3.5, 0.9, -1.8)];
  lv.push(L({
    name: 'Laberinto', area: [7, 11], start: [-2.0, 4.6, 180],
    goal: 'Seguí el camino de conos hasta tu lugar.',
    tip: 'Mirá bien dónde está el hueco de cada fila.',
    stalls: [...right, ...left], spot: spotOf(right[1]),
    cars: [...park(right, [0, 2]), ...park(left)], cones, walls: [], par: 25, limit: 120,
  }));
}
// 16 — Lleno total
{
  const top = rowX(-3.15, -4.7, 8, 180), midA = rowX(-1.8, -1.1, 5, 180), midB = rowX(-1.8, 0.3, 5, 0), bot = rowX(-3.15, 4.7, 8, 0);
  lv.push(L({
    name: 'Lleno total', area: [8, 11], start: [3.1, 2.9, 180],
    goal: '¡Está lleno! Encontrá el único lugar libre.',
    tip: 'Subí por el costado y doblá en el pasillo de arriba.',
    stalls: [...top, ...midA, ...midB, ...bot], spot: spotOf(top[1], 180, true, 0.82),
    cars: [...park(top, 'all', [1]), ...park(midA), ...park(midB), ...park(bot)], cones: [], walls: [], par: 25, limit: 120,
  }));
}
// 17 — Paralelo apretado
{
  const p = parallelLane(2.4, -0.3, 1.6, 3, 3);
  const cones = coneLineZ(-0.3, -5.0, 5.0);
  const left = rowZ(-2.5, -4.5, 9, 270);
  lv.push(L({
    name: 'Paralelo apretado', area: [6.5, 11], start: [0.9, 4.6, 180],
    goal: 'Un paralelo bien apretado. ¡Vos podés!',
    tip: 'Pasate, retrocedé doblando y enderezá al final.',
    stalls: [...p.stalls, ...left], spot: p.spot,
    cars: [...p.cars, ...park(left)], cones,
    walls: [{ x: 3.025, z: 0, w: 0.45, d: 11, a: 0, kind: 'curb' }], par: 30, limit: 150,
  }));
}
// 18 — Gran final
{
  const p = parallelLane(2.65, -3.0, 1.7, 1, 2);
  const cones = [...coneLine(-3.5, 0.6, 3.8), ...coneLine(-0.6, 3.05, 1.4)];
  const left = rowZ(-2.7, -5.0, 4, 270);
  lv.push(L({
    name: 'Gran final', area: [7, 12], start: [-1.8, 5.2, 180],
    goal: 'El gran final: zigzag y paralelo. ¡A lucirse!',
    tip: 'Primero los conos, después el paralelo con calma.',
    stalls: [...p.stalls, ...left], spot: p.spot,
    cars: [...p.cars, ...park(left, [0, 1, 3])], cones,
    walls: [{ x: 3.275, z: 0, w: 0.45, d: 12, a: 0, kind: 'curb' }], par: 35, limit: 150,
  }));
}

export const LEVELS = lv;
export const LEVEL_COUNT = lv.length;
