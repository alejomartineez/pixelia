// Pruebas del motor de cinemáticas (PLAN-TRAVESIA §3a, src/cinema/):
//   - línea de tiempo en node (sin three ni DOM): curvas de cámara que pasan por cada punto, el travelling de dos
//     puntos igual al de antes, subtítulos de varias líneas, voz que estira el plano, eventos que se disparan una vez,
//     luz que funde y el reloj que pasa de plano;
//   - en Chrome headless: las poses mueven las partes del avatar (y con peso 0 no), la utilería va a la mano, la viñeta
//     del forcejeo se arma igual cada vez y el cristal cambia de mano, el reproductor (subtítulos, puntos, saltar,
//     viñeta 2D y carteles 3D) y audio.track / audio.voice sin grabaciones.
//   node test-cinema.mjs
import http from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, extname } from 'node:path';
import puppeteer from 'puppeteer-core';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (c, msg, extra) => { if (c) { pass++; console.log('  ok  ', msg); } else { fail++; console.log('  MAL ', msg, extra !== undefined ? JSON.stringify(extra).slice(0, 600) : ''); } };
const near = (a, b, e = 1e-6) => Math.abs(a - b) <= e;
const nearV = (a, b, e = 1e-6) => a.length === b.length && a.every((x, i) => near(x, b[i], e));

// ---------- línea de tiempo (node) ----------
console.log('\nLínea de tiempo');
const T = await import(pathToFileURL(join(ROOT, 'src/cinema/timeline.js')).href);
{
  const keys = [{ t: 0, v: [0, 0, 0] }, { t: 1, v: [2, 1, 0] }, { t: 3, v: [4, 0, 2] }, { t: 4, v: [5, 2, 2] }];
  ok(keys.every(k => nearV(T.sampleKeys(keys, k.t), k.v)), 'la curva pasa por cada punto');
  const a = T.sampleKeys(keys, 1.999), b = T.sampleKeys(keys, 2.001);
  ok(nearV(a, b, 0.01), 'la curva es continua entre tramos');
  ok(nearV(T.sampleKeys(keys, -1), [0, 0, 0]) && nearV(T.sampleKeys(keys, 9), [5, 2, 2]), 'antes y después queda quieta');
  // el travelling de siempre (intro.js): lerp con ease(t / dur)
  const cam = T.travel(8, [[0, 0, 0], [1, 1, 1]], [[8, 4, 0], [0, 0, 2]]);
  const ease = (u) => u * u * (3 - 2 * u);
  const same = [0, 1.3, 4, 6.6, 8, 9.4].every(t => { const c = T.camAt(cam, t); const u = ease(Math.min(1, t / 8)); return nearV(c.pos, [8 * u, 4 * u, 0], 1e-9) && nearV(c.look, [1 - u, 1 - u, 1 + u], 1e-9); });
  ok(same, 'un travelling de dos puntos da la misma cámara que la intro de antes');
  const multi = { curve: 'smooth', keys: [{ t: 0, pos: [0, 5, 10], look: [0, 0, 0], fov: 40 }, { t: 2, pos: [4, 3, 8], look: [1, 0, 0] }, { t: 5, pos: [6, 2, 2], look: [2, 1, 0], fov: 30 }] };
  ok(nearV(T.camAt(multi, 2).pos, [4, 3, 8]) && near(T.camAt(multi, 5).fov, 30) && near(T.camAt(multi, 0).fov, 40), 'cámara de varios puntos con su fov');
}
{
  const S = T.prepareShot({ dur: 3, subs: [{ at: 0.5, lines: ['Primera línea.', 'Segunda línea.'] }, { at: 2, text: 'Con voz.', voice: 'intro/01' }], events: [{ at: 1, sfx: 'select' }] },
    { voiceDur: (id) => (id === 'intro/01' ? 6 : null) });
  ok(near(S.subs[1].dur, 6.45) && S.dur >= 2 + 6.45, 'la voz grabada estira el subtítulo y el plano', { d: S.dur, s: S.subs[1] });
  ok(T.subAt(S, 1).text === 'Primera línea.\nSegunda línea.' && T.subAt(S, 1).lines.length === 2, 'subtítulo de dos líneas');
  ok(T.subAt(S, 3).text === 'Con voz.' && T.subAt(S, 0.2) === null, 'cada subtítulo en su tramo');
  ok(S.events.some(e => e.voice === 'intro/01' && e.at === 2), 'la voz entra como evento en su segundo');
  const noVoice = T.prepareShot({ dur: 1, subs: [{ at: 0, text: 'Una frase de seis palabras justas.' }] });
  ok(near(noVoice.subs[0].dur, T.readTime('Una frase de seis palabras justas.')) && noVoice.dur > 1, 'sin voz usa el tiempo de lectura');
  const L = T.lightAt({ sunI: 1, sky: 0x000000 }, [{ at: 1, dur: 2, to: { sunI: 3, sky: 0xffffff }, ease: 'linear' }], 2);
  ok(near(L.sunI, 2) && L.sky === 0x808080, 'la luz funde números y colores', L);
  const tl = T.createTimeline([{ dur: 1, events: [{ at: 0.5, n: 1 }] }, { dur: 1, hold: 0.5, events: [{ at: 0, n: 2 }] }]);
  let fired = [], changed = 0, done = false;
  for (let i = 0; i < 120 && !done; i++) { const r = tl.update(1 / 30); fired.push(...r.fired.map(e => e.n)); if (r.changed) changed++; done = r.done; }
  ok(fired.join(',') === '1,2' && changed === 1 && done, 'el reloj dispara cada evento una vez y pasa de plano', { fired, changed, done });
  ok(near(tl.total, 2.5 + 0.6 * 0, 0.7), 'duración total con la espera del último');
}

// ---------- cámara de cine (node; PLAN-FOTO §R2) ----------
console.log('\nCámara de cine');
const CAM = await import(pathToFileURL(join(ROOT, 'src/cinema/camera.js')).href);
{
  // 1 · lente
  const wide = CAM.resolveLens('wide'), tele = CAM.resolveLens('tele'), mac = CAM.resolveLens('macro');
  ok(near(CAM.fovOf(50), 26.99, 0.02) && wide.fov > CAM.resolveLens('normal').fov && CAM.resolveLens('normal').fov > tele.fov, 'la focal da el campo de visión: gran angular > normal > tele', [wide.fov, tele.fov]);
  ok(near(CAM.matchDolly(tele.fov, 42) * Math.tan(tele.fov * Math.PI / 360), Math.tan(21 * Math.PI / 180)), 'al cambiar de lente la cámara se corre y el sujeto queda del mismo tamaño');
  const open = CAM.dofOf(CAM.resolveLens({ preset: 'portrait', f: 2 }), 6), shut = CAM.dofOf(CAM.resolveLens({ preset: 'portrait', f: 11 }), 6);
  ok(open.range < shut.range && open.amt > shut.amt && open.focus === 6, 'más apertura, menos profundidad de campo', { open, shut });
  ok(CAM.dofOf(mac, 30).range < CAM.dofOf(CAM.resolveLens({ preset: 'macro', scale: 0.2 }), 30).range && CAM.dofOf(wide, 20).range > CAM.dofOf(tele, 20).range, 'el macro de maqueta enfoca más fino y el gran angular deja todo en foco');
  // 2 · cambio de foco
  const D = { a: 3, b: 9 }, fk = [{ t: 2, on: 'a' }, { t: 4, on: 'b' }], fa = (t) => CAM.focusAt(fk, t, (on) => D[on]);
  ok(fa(0) === 3 && fa(9) === 9 && near(fa(3), 6) && fa(2.5) < 4.5 && fa(3.5) > 7.5, 'el foco viaja de un sujeto al otro con curva suave', [fa(2.5), fa(3), fa(3.5)]);
  // 3 · cámara en mano
  const h1 = CAM.handheldAt(3.21, 1, 4), h2 = CAM.handheldAt(3.21, 1, 4), h3 = CAM.handheldAt(3.24, 1, 4);
  let big = 0, jump = 0, prev = null;
  for (let t = 0; t < 20; t += 1 / 30) { const o = CAM.handheldAt(t, 1, 2); big = Math.max(big, Math.abs(o.yaw), Math.abs(o.dx)); if (prev) jump = Math.max(jump, Math.abs(o.yaw - prev.yaw)); prev = o; }
  ok(h1.yaw === h2.yaw && Math.abs(h3.yaw - h1.yaw) < 0.002 && big > 0.004 && big < 0.04 && jump < big / 6, 'el temblor es coherente: mismo instante, mismo valor, y sin saltos de un cuadro al otro', { big, jump });
  const b0 = CAM.breathAt(1.05, 1), b1 = CAM.breathAt(3.15, 1);
  ok(Math.abs(b0.dy) < 0.02 && b0.dy * b1.dy < 0 && CAM.handheldAt(1, 0).dx === 0, 'la respiración sube y baja apenas; con intensidad 0 no hay temblor', [b0.dy, b1.dy]);
  ok(CAM.camTravel({ keys: [{ pos: [0, 0, 0], look: [0, 0, 1] }, { pos: [0.1, 0, 0], look: [0, 0, 1] }] }) < 0.8 && CAM.camTravel({ keys: [{ pos: [0, 0, 0], look: [0, 0, 1] }, { pos: [4, 0, 0], look: [0, 0, 1] }] }) > 0.8, 'se sabe qué plano es quieto');
  // 4 · tercios
  const pos = [3, 1.6, 8], subject = [-1, 0.9, 0.5], fov = 38, aspect = 16 / 9;
  const fl = CAM.frameThirds({ pos, subject, fov, aspect, third: 'left', line: 'top' });
  const pl = CAM.project(pos, fl.look, fov, aspect, subject);
  ok(near(pl[0], -1 / 3, 1e-3) && near(pl[1], CAM.SAFE / 3, 1e-3), 'el sujeto cae en el cruce del tercio izquierdo con la línea de arriba', pl);
  const gz = CAM.frameThirds({ pos, subject, fov, aspect, gaze: [1, 0, 0] }), gz2 = CAM.frameThirds({ pos, subject, fov, aspect, gaze: [-1, 0, 0] });
  ok(gz.nx < 0 && gz2.nx > 0, 'el aire queda hacia donde mira: mira a la derecha, va a la izquierda');
  // 5 · plano y contraplano
  const A = [0, 0, 0], B = [2, 0, 1], sr = CAM.shotReverse(A, B, { side: 1 }), sl = CAM.shotReverse(A, B, { side: -1 });
  const xa1 = CAM.project(sr.ab.pos, sr.ab.look, 40, aspect, [A[0], 0.85, A[2]])[0], xb1 = CAM.project(sr.ab.pos, sr.ab.look, 40, aspect, [B[0], 0.85, B[2]])[0];
  const xa2 = CAM.project(sr.ba.pos, sr.ba.look, 40, aspect, [A[0], 0.85, A[2]])[0], xb2 = CAM.project(sr.ba.pos, sr.ba.look, 40, aspect, [B[0], 0.85, B[2]])[0];
  ok(CAM.axisSide(A, B, sr.ab.pos) === CAM.axisSide(A, B, sr.ba.pos) && CAM.axisSide(A, B, sl.ab.pos) === -CAM.axisSide(A, B, sr.ab.pos), 'plano y contraplano quedan del mismo lado del eje');
  ok(Math.sign(xa1 - xb1) === Math.sign(xa2 - xb2), 'en los dos planos cada personaje queda del mismo lado de la pantalla', [xa1, xb1, xa2, xb2]);
  // 6 · fundido
  const bc = CAM.blendCam({ pos: [0, 0, 0], look: [0, 0, 1], fov: 30 }, { pos: [2, 4, 6], look: [1, 1, 1], fov: 50 }, 0.5);
  ok(nearV(bc.pos, [1, 2, 3]) && near(bc.fov, 40) && nearV(CAM.blendCam({ pos: [1, 1, 1], look: [0, 0, 0] }, { pos: [2, 2, 2], look: [0, 0, 0], fov: 42 }, 0).pos, [1, 1, 1]), 'el fundido de cámara pasa por el medio y arranca en la del juego');
  // 7 · luz de tres puntos
  const tp = CAM.threePoint({ pos: [0, 1, 10], subject: [0, 1, 0], keyI: 2 });
  ok(tp.key.pos[0] < 0 && tp.fill.pos[0] > 0 && tp.rim.pos[2] < 0 && tp.key.pos[1] > tp.fill.pos[1] && near(tp.fill.i, 0.6) && tp.rim.i > tp.fill.i, 'principal a un lado y arriba, relleno al otro y más débil, contra desde atrás', tp);
  // cortes dentro de un plano
  const segs = { segs: [{ from: 0, keys: [{ t: 0, pos: [0, 0, 0], look: [0, 0, 1] }] }, { from: 2, keys: [{ t: 2, pos: [9, 0, 0], look: [0, 0, 1] }] }] };
  ok(T.camAt(segs, 1.99).pos[0] === 0 && T.camAt(segs, 2).pos[0] === 9 && T.camSeg(segs, 3) === segs.segs[1], 'un plano puede cortar de cámara sin fundir');
}

// ---------- en el navegador ----------
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.m4a': 'audio/mp4' };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const f = join(ROOT, p);
  if (!f.startsWith(ROOT) || !existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); res.end('404'); return; }
  res.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  res.end(readFileSync(f));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}/`;
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });
const errors = [];
page.on('pageerror', e => errors.push('PAGEERROR: ' + (e.stack || e.message)));
page.on('console', m => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errors.push('CONSOLE.ERROR: ' + m.text()); });
await page.goto(BASE + 'tools/cinema.html?v=forcejeo&t=0&k=1', { waitUntil: 'load' });
await page.waitForFunction('window.__ready === true', { timeout: 30000 });

console.log('\nPoses y utilería');
const poses = await page.evaluate(async () => {
  const THREE = await import('three');
  const { avatarModel } = await import('/src/avatar/avatar.js');
  const P = await import('/src/cinema/poses.js');
  const look = { type: 'humano', build: 'recio', skin: 2, hair: 'corto', hairColor: 'negro', face: 'ninguna', dress: 'tabardo', dressColor: 'rojo', crown: 'ninguna', acc: 'ninguno' };
  const snap = (m) => { const p = m.userData.parts; return [p.armR.rotation.x, p.armR.rotation.z, p.armL.rotation.x, p.armL.rotation.z, p.upper.rotation.x, p.upper.rotation.y, p.head.rotation.x, p.head.rotation.y, p.body.rotation.x, p.body.position.y, ...p.legs.map(l => l.rotation.x)].map(v => +v.toFixed(4)); };
  const out = {};
  for (const name of P.poseNames) {
    const m = avatarModel(look);
    m.userData.update(0.016, false);
    const a = snap(m);
    P.applyPose(m, name, { w: 0, t: 0.5 });
    const z = snap(m);
    P.applyPose(m, name, { w: 1, t: 0.5, p: 1, look: 0.6 });
    const b = snap(m);
    out[name] = { zero: a.join() === z.join(), moved: a.some((v, i) => Math.abs(v - b[i]) > 0.05), b };
  }
  // pose a mitad: entre el reposo y la pose entera
  const m = avatarModel(look); m.userData.update(0.016, false);
  const r0 = m.userData.parts.armR.rotation.x;
  P.applyPose(m, 'señalar', { w: 0.5 });
  const half = m.userData.parts.armR.rotation.x;
  const alias = P.applyPose(m, 'point', { w: 1 });
  const weight = [P.poseWeight(0, 1, 3), P.poseWeight(2, 1, 3), P.poseWeight(1.1, 1, 3, 0.2)];
  // utilería en la mano
  const crystal = P.prop('cristal');
  P.holdProp(m, crystal, 'R');
  const hand = P.handOf(m, 'R');
  m.updateMatrixWorld(true);
  const wp = new THREE.Vector3(); crystal.getWorldPosition(wp);
  const armTop = new THREE.Vector3().setFromMatrixPosition(m.userData.parts.armR.matrixWorld);
  const scene = new THREE.Group(); scene.add(m);
  P.dropProp(crystal, scene);
  const wp2 = new THREE.Vector3(); crystal.getWorldPosition(wp2);
  const kinds = ['cristal', 'caja', 'carta', 'bolsa', 'farol', 'pala'].every(k => P.prop(k).children.length > 0);
  // la caja entre las dos manos: a la misma distancia de una y de la otra
  const mc = avatarModel(look); mc.userData.update(0.016, false);
  const box = P.prop('caja'); P.holdBoth(mc, box, 'cargar'); P.applyPose(mc, 'cargar', { w: 1 }); mc.updateMatrixWorld(true);
  const bp = new THREE.Vector3(), hr = new THREE.Vector3(), hl = new THREE.Vector3();
  box.getWorldPosition(bp); P.handOf(mc, 'R').getWorldPosition(hr); P.handOf(mc, 'L').getWorldPosition(hl);
  const both = Math.abs(bp.distanceTo(hr) - bp.distanceTo(hl)) < 0.03 && bp.distanceTo(hr) < 0.25;
  // de rodillas: los pies tocan el piso (el punto más bajo del cuerpo queda en y ≈ 0)
  const mk = avatarModel(look); mk.userData.update(0.016, false); P.applyPose(mk, 'arrodillarse', { w: 1, p: 1 }); mk.updateMatrixWorld(true);
  const kneelLow = new THREE.Box3().setFromObject(mk).min.y;
  return { both, kneelLow, dbg: [wp.toArray(), armTop.toArray()], out, names: P.poseNames, r0, half, alias, weight, inHand: crystal.parent === scene && hand.children.length === 0, below: wp.distanceTo(armTop) > 0.15, kept: wp.distanceTo(wp2) < 1e-4, kinds };
});
const want = ['señalar', 'cargar', 'empujar', 'pelear', 'caer', 'agarrar', 'entregar', 'mirar', 'arrodillarse'];
ok(want.every(n => poses.names.includes(n)), 'están las nueve poses del plan', poses.names);
for (const n of want) ok(poses.out[n]?.zero && poses.out[n]?.moved, `pose "${n}": con peso 0 no toca nada y con peso 1 se mueve`, poses.out[n]);
ok(poses.half < poses.r0 && poses.half > -1.5, 'con peso 0,5 queda a mitad de camino', poses);
ok(poses.alias, 'acepta los nombres sin tilde o en inglés');
ok(poses.weight[0] === 0 && poses.weight[1] === 1 && poses.weight[2] > 0 && poses.weight[2] < 1, 'peso de entrada y salida de una pose');
ok(poses.below && poses.kept && poses.inHand, 'la utilería va a la punta del brazo y al soltarla queda donde estaba', poses.dbg);
ok(poses.kinds, 'utilería: cristal, caja, carta, bolsa, farol y pala');
ok(poses.both, 'cargar: la caja queda entre las dos manos');
ok(Math.abs(poses.kneelLow) < 0.04, 'de rodillas: apoya en el piso, ni flota ni lo atraviesa', poses.kneelLow);

console.log('\nViñeta 2D: el forcejeo');
const vin = await page.evaluate(async () => {
  const { createVignette, VIGNETTES, W2D, H2D } = await import('/src/cinema/pixel2d.js');
  const v = createVignette('forcejeo');
  const hash = () => { const d = v.canvas.getContext('2d').getImageData(0, 0, v.w, v.h).data; let h = 2166136261; for (let i = 0; i < d.length; i += 3) h = Math.imul(h ^ d[i], 16777619); return h >>> 0; };
  const colors = () => { const d = v.canvas.getContext('2d').getImageData(0, 0, v.w, v.h).data; const s = new Set(); for (let i = 0; i < d.length; i += 4) s.add((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]); return s.size; };
  const at = (t) => { v.seek(t); v.draw(); return { st: v.state, h: hash() }; };
  const a = at(3.3), b = at(3.3), c = at(1.0);
  const s0 = at(0).st, s25 = at(2.6).st, s6 = at(6.2).st;
  v.cam.shake = 0;
  // la cámara: zoom entero y nítido (sin suavizado)
  const zooms = []; for (let t = 0; t <= v.dur; t += 0.25) { v.seek(t); zooms.push(v.cam.zoom); }
  const ctx = v.canvas.getContext('2d');
  // varias viñetas pueden convivir sin pisarse
  const w2 = createVignette('forcejeo'); w2.seek(3.3); w2.draw();
  const h2 = (() => { const d = w2.canvas.getContext('2d').getImageData(0, 0, 320, 180).data; let h = 2166136261; for (let i = 0; i < d.length; i += 3) h = Math.imul(h ^ d[i], 16777619); return h >>> 0; })();
  v.seek(3.3); v.draw();
  return { w: v.canvas.width, h: v.canvas.height, W2D, H2D, ids: Object.keys(VIGNETTES), same: a.h === b.h, differs: a.h !== c.h, s0, s25, s6, zoomMax: Math.max(...zooms), zoomInts: zooms.every(z => Number.isFinite(z)), smoothing: ctx.imageSmoothingEnabled, colors: colors(), other: h2 === hash(), dur: v.dur };
});
ok(vin.w === 320 && vin.h === 180 && vin.ids.includes('forcejeo'), 'canvas de 320 × 180 y la viñeta registrada');
ok(vin.same && vin.differs, 'el mismo instante da los mismos píxeles (seek determinista) y otro instante, otros', vin);
ok(vin.other, 'dos viñetas iguales en paralelo dan lo mismo');
ok(!vin.smoothing, 'sin suavizado');
ok(vin.colors > 24 && vin.colors < 400, 'paleta acotada (pixel art, no degradés)', vin.colors);
const thief0 = vin.s0.actors[0], guard0 = vin.s0.actors[1];
ok(thief0.anim === 'lift' && !thief0.flip && guard0.flip && guard0.anim === 'walk', 'arranca: alza el cristal, el guardia llega caminando de frente', vin.s0.actors);
ok(vin.s25.props[0].visible && Math.abs(vin.s25.props[0].x - vin.s25.actors[0].x) < 20, 'el cristal está con quien lo robó', vin.s25);
ok(!vin.s6.props[0].visible && vin.s6.actors[0].anim === 'fall' && vin.s6.actors[1].anim === 'lift', 'el cristal cambió de mano y quien robaba cayó', vin.s6);
ok(vin.zoomMax >= 3, 'la cámara se acerca a 3× en el forcejeo', vin.zoomMax);

console.log('\nReproductor con cámara de cine');
const cc = await page.evaluate(async () => {
  const THREE = await import('three');
  const { createCinema } = await import('/src/cinema/player.js');
  const { shotReverse, SAFE } = await import('/src/cinema/camera.js');
  const { h } = await import('/src/core/ui.js');
  const box = document.createElement('div'); box.style.cssText = 'position:fixed;inset:0;'; document.body.append(box);
  const camera = new THREE.PerspectiveCamera(42, 16 / 9, 0.1, 100);
  camera.position.set(20, 20, 20); camera.lookAt(0, 0, 0);
  const scene = new THREE.Scene(), sun = new THREE.DirectionalLight(0xffffff, 2); scene.add(sun, sun.target);
  const dof = [];
  const r = { camera, scene, setPost: (p) => { if (p?.dof) dof.push(p.dof); } };
  const who = new THREE.Object3D(); who.position.set(1, 0, 0); scene.add(who);
  const far = [0, 1, -12], A = [0, 0, 0], B = [2, 0, 0], SR = shotReverse(A, B);
  const cin = createCinema({ ui: { h }, audio: {} }, box, {
    r, prefix: 'cc', lights: { sun }, guides: true, camIn: true, camOut: true,
    shots: [
      { dur: 4, lens: 'portrait', handheld: 0.5, cam: { keys: [{ t: 0, pos: [0, 1, 6], look: [0, 1, 0] }, { t: 4, pos: [1, 1, 6], look: [0, 1, 0] }] },
        frame: { subject: { of: () => who, off: [0, 0.9, 0] }, third: 'auto', gaze: [1, 0, 0], line: 'top' },
        focus: [{ t: 2, on: { of: () => who, off: [0, 0.9, 0] } }, { t: 3, on: far }], rig: { subject: [1, 0.9, 0] } },
      { dur: 4, lens: { preset: 'normal', match: false }, cam: { segs: [
        { from: 0, keys: [{ t: 0, pos: SR.ab.pos, look: SR.ab.look }], rig: { subject: B } },
        { from: 2, keys: [{ t: 2, pos: SR.ba.pos, look: SR.ba.look }] }] } },
    ],
  });
  const step = (s) => { for (let i = 0; i < Math.round(s * 30); i++) cin.frame(1 / 30, 0); };
  const ndc = (p) => { camera.updateMatrixWorld(); return new THREE.Vector3(...p).project(camera).toArray().map(v => +v.toFixed(3)); };
  cin.frame(1e-4, 0);
  const start = camera.position.toArray().map(v => +v.toFixed(1)), fov0 = +camera.fov.toFixed(1);
  step(1.8);
  const fovLens = +camera.fov.toFixed(2), at18 = ndc([1, 0.9, 0]), d18 = dof.at(-1), roll = Math.abs(camera.rotation.z) > 1e-5;
  const rig = { key: sun.position.toArray(), fill: scene.children.filter(o => o.isDirectionalLight && o !== sun).map(l => +l.intensity.toFixed(2)) };
  const mark = box.querySelector('.cc-guides b').style.display, info = box.querySelector('.cc-guides span').textContent;
  step(1.5);
  const d33 = dof.at(-1);
  const p0 = camera.position.clone(); cin.seek(1.0); const pA = camera.position.toArray(); cin.seek(1.0); const same = camera.position.toArray().every((v, i) => Math.abs(v - pA[i]) < 1e-9); void p0;
  cin.go(1); step(1);
  const sideA = camera.position.z, fillOn = scene.children.filter(o => o.isDirectionalLight && o !== sun).some(l => l.intensity > 0);
  step(1.2);
  const sideB = camera.position.z, fillOff = scene.children.filter(o => o.isDirectionalLight && o !== sun).every(l => l.intensity === 0), fovN = +camera.fov.toFixed(1);
  step(1.75);
  const back = camera.position.toArray().map(v => +v.toFixed(0));
  cin.dispose();
  const left = scene.children.filter(o => o.isDirectionalLight).length;
  box.remove();
  return { start, fov0, fovLens, at18, d18, d33, roll, rig, mark, info, same, sideA, sideB, fillOn, fillOff, fovN, back, left, SAFE };
});
ok(nearV(cc.start, [20, 20, 20], 0.11) && cc.fov0 === 42, 'fundido de cámara: el primer cuadro es la cámara del juego', cc);
ok(near(cc.fovLens, 26.99, 0.05) && cc.roll, 'el lente del plano pone su campo de visión y la cámara en mano inclina apenas', cc);
ok(Math.abs(cc.at18[0] + 1 / 3) < 0.02 && Math.abs(cc.at18[1] - cc.SAFE / 3) < 0.02, 'el sujeto queda en su tercio aunque la cámara viaje y tiemble', cc.at18);
ok(cc.d18.focus < 11 && cc.d33.focus > 15 && cc.d18.range > 0 && cc.d18.amt > 0, 'el foco arranca en el sujeto y pasa al fondo; la profundidad sale del lente', [cc.d18, cc.d33]);
ok(cc.rig.fill.length === 2 && cc.rig.fill.every(i => i > 0) && cc.rig.key[1] > 5, 'luz de tres puntos: el sol de principal y dos luces más prendidas', cc.rig);
ok(cc.mark === 'block' && /50 mm/.test(cc.info) && /f\/2\.8/.test(cc.info), 'modo de revisión: marca del sujeto y datos del lente', cc.info);
ok(cc.same, 'el mismo segundo del plano da la misma cámara (temblor determinista)');
ok(Math.sign(cc.sideA) === Math.sign(cc.sideB) && cc.fillOn && cc.fillOff && cc.fovN === 37.8, 'contraplano del mismo lado del eje; cada tramo con su luz', cc);
ok(nearV(cc.back, [20, 20, 20], 1.01) && cc.left === 1, 'al final la cámara vuelve a la del juego y las luces de la escena se van', cc);

console.log('\nReproductor, carteles y audio');
const pl = await page.evaluate(async () => {
  const THREE = await import('three');
  const { createCinema } = await import('/src/cinema/player.js');
  const { createVignette } = await import('/src/cinema/pixel2d.js');
  const { h } = await import('/src/core/ui.js');
  const { audio } = await import('/src/core/audio.js');
  const box = document.createElement('div'); box.style.cssText = 'position:fixed;inset:0;'; document.body.append(box);
  const camera = new THREE.PerspectiveCamera(42, 16 / 9, 0.1, 100);
  const r = { camera, scene: new THREE.Scene() };
  const set = new THREE.Group(); let updates = 0; set.userData.update = () => { updates++; };
  const sfx = [];
  const fakeAudio = { sfx: (n) => sfx.push(n), stinger: (n) => sfx.push('st:' + n), voiceDur: () => null, voice: () => null };
  let finished = null;
  const cin = createCinema({ ui: { h }, audio: fakeAudio }, box, {
    r, prefix: 'tc', title: 'Prueba',
    shots: [
      { set, dur: 2, cam: { keys: [{ t: 0, pos: [0, 2, 8], look: [0, 0, 0] }, { t: 1, pos: [3, 2, 6], look: [0, 1, 0] }, { t: 2, pos: [5, 1, 4], look: [1, 1, 0] }] },
        subs: [{ at: 0.3, lines: ['La Veta corría por dentro.', 'Y estaba viva.'] }],
        events: [{ at: 0.5, label: { id: 'veta', pos: [0, 0, 0], name: 'La Veta', line: 'la sangre del continente', dur: 3 } }, { at: 0.6, stinger: 'pagina' }, { at: 0.7, shake: 0.1 }] },
      { vignette: () => createVignette('forcejeo'), dur: 1.5, subs: [{ at: 0, text: 'Hubo quien robó para comer.' }] },
    ],
    onFinish: (how) => { finished = how; },
  });
  const q = (s) => box.querySelector('.tc-' + s);
  const step = (s) => { for (let i = 0; i < s * 30; i++) cin.frame(1 / 30, i / 30); };
  step(0.9);
  const sub1 = q('sub').innerText, subOn = q('sub').classList.contains('on'), lab = cin.labels.live, camAt1 = camera.position.toArray().map(v => +v.toFixed(2));
  step(4.2);
  const shot2 = cin.shot, is2d = q('root').classList.contains('is-2d'), cv = q('stage2d').querySelector('canvas'), sub2 = q('sub').textContent;
  const dots = [...box.querySelectorAll('.tc-dots i')].map(i => i.classList.contains('on'));
  // la segunda vez, el cartel de La Veta ya no se presenta
  const again = cin.labels.introduce('veta', new THREE.Vector3(), 'La Veta', '');
  cin.next();
  const fin = finished;
  cin.dispose();
  // audio: pista y voz sin grabaciones no rompen nada
  const tr = await audio.track('no-existe', { fallback: null });
  const vd = audio.voiceDur('intro/01');
  const vo = audio.voice('intro/01');
  return { sub1, subOn, lab, camAt1, updates, shot2, is2d, cv: cv ? [cv.width, cv.height] : null, sub2, dots, again, fin, sfx, removed: !box.querySelector('.tc-root'), tr, vd, vo, trackId: audio.trackId };
});
ok(pl.sub1 === 'La Veta corría por dentro.\nY estaba viva.' && pl.subOn, 'subtítulo de dos líneas a la vista', pl.sub1);
ok(pl.lab.length === 1 && pl.lab[0].name === 'La Veta' && pl.lab[0].on, 'el cartel 3D presenta La Veta en su lugar', pl.lab);
ok(pl.again === null, 'lo ya presentado no se vuelve a presentar');
ok(pl.camAt1.some(v => v !== 0) && pl.updates > 20, 'la cámara sigue la curva y el decorado se actualiza', pl);
ok(pl.sfx.includes('st:pagina'), 'el stinger del guion suena', pl.sfx);
ok(pl.shot2 === 1 && pl.is2d && pl.cv?.[0] === 320 && pl.sub2 === 'Hubo quien robó para comer.', 'pasa sola a la viñeta 2D con su subtítulo', pl);
ok(pl.dots.join() === 'true,true', 'los puntos marcan el avance');
ok(pl.fin === 'done' && pl.removed, 'al terminar avisa y se desarma', pl);
ok(pl.tr === false && pl.trackId === null, 'audio.track de una pista que no está: no suena y no traba', pl);
ok(pl.vd === null || typeof pl.vd === 'number', 'audio.voiceDur responde (null sin manifest cargado)');
ok(pl.vo === null, 'audio.voice sin audio habilitado no suena (el subtítulo sigue con su tiempo)');

// la línea grabada suena por el bus de voz y baja la música (con el audio habilitado)
// (en una página aparte con la URL en la raíz, como el juego: el sampler pide assets/audio/ relativo)
const page2 = await browser.newPage();
page2.on('pageerror', e => errors.push('PAGEERROR: ' + (e.stack || e.message)));
await page2.goto(BASE + 'tools/cinema.html?v=forcejeo&t=0&k=1', { waitUntil: 'load' });
await page2.waitForFunction('window.__ready === true', { timeout: 30000 });
const vz = await page2.evaluate(async () => {
  history.replaceState(null, '', '/');
  const { audio } = await import('/src/core/audio.js');
  audio.unlock();
  for (let i = 0; i < 50 && audio.debug().ctx !== 'running'; i++) await new Promise(r => setTimeout(r, 100));
  await audio.prepareVoice(['intro/01']);
  const dur = audio.voiceDur('intro/01');
  const v = audio.voice('intro/01');
  await new Promise(r => setTimeout(r, 400));
  const ducked = audio.engine.mixer.ducked;
  v?.stop();
  return { ctx: audio.debug().ctx, dur, played: !!v, vdur: v?.dur, ducked };
});
if (vz.ctx === 'running') {
  ok(vz.dur > 3 && vz.played && Math.abs(vz.vdur - vz.dur) < 0.3, 'la línea de apertura grabada suena con su duración real', vz);
  ok(vz.ducked < 0.6, 'mientras habla el narrador la música baja', vz);
} else console.log('  (sin audio en este Chrome: no se prueba la voz grabada)', vz.ctx);

// ---------- el narrador: la clave nunca se escribe en el repo ----------
console.log('\nNarrador');
const narr = readFileSync(join(ROOT, 'tools/audio/narrate.mjs'), 'utf8');
ok(/x-goog-api-key/.test(narr) && !/[?&]key=/.test(narr), 'la clave viaja en el encabezado, nunca en la URL');
ok(!/AIza[0-9A-Za-z_-]{20,}/.test(narr) && !/console\.log\([^)]*KEY/.test(narr), 'el script no tiene la clave ni la imprime');
const N = await import(pathToFileURL(join(ROOT, 'src/cinema/narration.js')).href);
ok(N.NARRATION.intro.length >= 1 && N.narrationLine('intro/01')?.text.startsWith('Antes del cielo'), 'guion del narrador con la línea de apertura');

// ---------- El Quiebre (paso 3b): guion, voces, idiomas y viñetas ----------
console.log('\nEl Quiebre: guion, voces y viñetas');
const DICT = {};
for (const l of ['es', 'en', 'ja']) DICT[l] = (await import(pathToFileURL(join(ROOT, `src/i18n/${l}.js`)).href)).default;
const MAN = JSON.parse(readFileSync(join(ROOT, 'assets/audio/manifest.json'), 'utf8'));
const lines = N.NARRATION.intro;
ok(lines.length === 16 && lines.every(l => l.key && DICT.es[l.key] === l.text), 'las 16 líneas salen de es.js (lo que se oye es lo que se lee)', lines.length);
ok(lines.every(l => DICT.en[l.key] && DICT.ja[l.key]), 'cada línea tiene inglés y japonés');
ok(lines.every(l => MAN.files['voice/' + l.id]?.dur > 1 && existsSync(join(ROOT, 'assets/audio', MAN.files['voice/' + l.id].file))), 'cada línea tiene su .m4a con duración en el manifest');
ok(lines.filter(l => l.style === 'vera').map(l => l.id).join() === 'intro/13,intro/14,intro/15,intro/16', 'Vera dice las cuatro últimas; el narrador, el resto');
const labelKeys = Object.keys(DICT.es).filter(k => k.startsWith('intro.label.') || k === 'intro.title' || k === 'cinema.skip');
ok(labelKeys.length >= 30 && labelKeys.every(k => DICT.en[k] && DICT.ja[k]), 'carteles, título y "Saltar" en es, en y ja', labelKeys.filter(k => !DICT.en[k] || !DICT.ja[k]));
const vq = await page.evaluate(async () => {
  const { createVignette, VIGNETTES } = await import('/src/cinema/pixel2d.js');
  const VI = await import('/src/cinema/vignettes-intro.js');
  const hash = (v) => { const d = v.canvas.getContext('2d').getImageData(0, 0, v.canvas.width, v.canvas.height).data; let h = 0; for (let i = 0; i < d.length; i += 7) h = (h * 31 + d[i]) | 0; return h; };
  const at = (id, s) => { const v = createVignette(id); v.seek(s); v.draw(); return { st: v.state, h: hash(v) }; };
  const det = ['orden', 'robo', 'caida', 'cofradia'].map(id => { const a = at(id, 5.3), b = at(id, 5.3); return a.h === b.h; });
  // nadie se pisa: entre dos personajes de pie en el mismo piso, al menos 14 px (cuerpos de ~14 px)
  const close = [];
  for (const id of ['orden', 'robo', 'caida', 'cofradia']) {
    const v = createVignette(id);
    for (let s = 0; s <= v.dur; s += 0.25) {
      v.seek(s);
      const A = v.state.actors.filter(a => a.anim !== 'fall' && a.x > -20 && a.x < 420);
      for (let i = 0; i < A.length; i++) for (let j = i + 1; j < A.length; j++) if (Math.abs(A[i].y - A[j].y) < 4 && Math.abs(A[i].x - A[j].x) < 14) close.push(`${id}@${s}`);
    }
  }
  return {
    ids: Object.keys(VIGNETTES), det, close,
    orden7: at('orden', 7).st, orden12: at('orden', 11.9).st,
    robo69: at('robo', 6.9).st, robo10: at('robo', 10).st,
    caida9: at('caida', 9).st, caida108: at('caida', 10.8).st, caida15: at('caida', 15).st,
    cof5: at('cofradia', 5).st, cof11: at('cofradia', 11).st,
    G: { orden: VI.ORDEN.GROUND, caida: VI.CAIDA.GROUND },
  };
});
ok(['orden', 'robo', 'caida', 'cofradia'].every(id => vq.ids.includes(id)) && vq.det.every(Boolean), 'las cuatro viñetas están y se arman igual cada vez', vq);
ok(vq.close.length === 0, 'en las viñetas nadie se pisa con nadie', vq.close.slice(0, 8));
ok(vq.orden7.actors[1].anim === 'point' && vq.orden12.actors[2].y > vq.G.orden + 20, 'la orden: la noble señala la mina y el capataz baja', [vq.orden7.actors[1], vq.orden12.actors[2]]);
ok(!vq.robo69.props[0].visible && vq.robo69.actors[1].anim === 'lift' && vq.robo10.actors[2].flip && vq.robo10.actors[2].x < 120, 'el robo: el cristal pasa al cómplice y la guardia persigue', [vq.robo69, vq.robo10.actors]);
ok(vq.caida9.actors[2].y > vq.G.caida + 40 && vq.caida108.actors[0].y > vq.G.caida + 10 && vq.caida15.actors[0].y === vq.G.caida + 1, 'el Quiebre: la vecina cae, el enano queda colgado y el guardia lo saca', [vq.caida9.actors[2], vq.caida108.actors[0], vq.caida15.actors[0]]);
ok(vq.cof5.actors[2].anim === 'point' && vq.cof11.actors[1].x < vq.cof11.actors[0].x - 40, 'la Cofradía: uno señala; el que no se sorprende se va', vq.cof11.actors);

ok(errors.length === 0, 'sin errores de consola', errors);
await browser.close(); server.close();
console.log(`\n${pass} ok, ${fail} mal`);
process.exit(fail ? 1 : 0);
