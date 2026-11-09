// Encaje de armas y armaduras (plan de La Travesía, paso 1a): que nada de lo que se sostiene ni de lo que se viste se
// meta en el cuerpo. Arma cada pueblo × contextura con cada clase, cada pieza de GEAR, cada ropa y algunas combinaciones
// (capa con mochila o catalejo) y, quieto (con la cabeza girada a cada lado) y en 4 cuadros de caminata, revisa sobre
// las grillas de vóxeles de cada parte (antes del mesh; avatar-kit.js las guarda con globalThis.__gearFit):
//   - que ningún vóxel de equipo o de armadura caiga dentro de un vóxel de cuerpo de otra parte (torso, brazos,
//     piernas, cabeza), ni tape cuerpo en su propia grilla;
//   - que ningún vóxel de equipo o de armadura baje del piso (y = 0);
//   - que el brazo quede en vóxel entero respecto del torso (armX).
// Un vóxel cuenta como adentro si su centro cae en una celda de cuerpo con un margen de 0,25 a cada lado (las partes
// giradas se cruzan en las aristas sin que se note).
// Corre en Chrome headless (SwiftShader), pero no dibuja: solo arma los modelos.
//   node test-gear-fit.mjs [--verbose]
import http from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';
import puppeteer from 'puppeteer-core';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const VERBOSE = process.argv.includes('--verbose');
let pass = 0, fail = 0;
const ok = (c, msg, extra) => { if (c) { pass++; if (VERBOSE) console.log('  ok  ', msg); } else { fail++; console.log('  MAL ', msg, extra !== undefined ? JSON.stringify(extra) : ''); } };

const PAGE = `<!doctype html><meta charset="utf-8"><link rel="icon" href="data:,"><script type="importmap">{ "imports": { "three": "/vendor/three.min.js" } }</script><body></body>`;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/__fit.html') { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(PAGE); return; }
  const f = join(ROOT, p);
  if (!f.startsWith(ROOT) || !existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); res.end('404'); return; }
  res.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  res.end(readFileSync(f));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push('PAGEERROR: ' + (e.stack || e.message)));
page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE.ERROR: ' + m.text()); });
await page.goto(`http://127.0.0.1:${server.address().port}/__fit.html`, { waitUntil: 'load' });

const t0 = Date.now();
const res = await page.evaluate(async () => {
  globalThis.__gearFit = true;
  const THREE = await import('three');
  const { avatarModel } = await import('/src/avatar/avatar.js');
  const { GEAR, CLASS_KIT, dimsOf } = await import('/src/avatar/figure.js');
  const { AVATAR_TYPES, DRESS_STYLES } = await import('/src/core/data.js');
  const S = 1 / 48, M = 0.25;
  const BODY = new Set(['torso', 'arm', 'leg', 'head']);
  const v = new THREE.Vector3(), u = new THREE.Vector3();
  const FRAMES = [
    ['quieto, cabeza a un lado', 0, 0, Math.PI], ['quieto, cabeza al otro', 0, 0, 3 * Math.PI],
    ['paso 1', Math.PI / 2, 1], ['paso 2', Math.PI, 1], ['paso 3', 3 * Math.PI / 2, 1], ['paso 4', 2 * Math.PI, 1],
  ];
  function check(model) {
    const found = [];
    for (const [frame, ph, w, tt] of FRAMES) {
      model.userData.setWalk(ph, w, tt ?? 1.3);
      model.userData.update(0, w > 0);
      model.updateMatrixWorld(true);
      const meshes = [];
      model.traverse(o => { if (o.isMesh && o.userData.fitPart && o.geometry?.userData.fit) meshes.push(o); });
      const bodies = meshes.filter(m => BODY.has(m.userData.fitPart)).map(m => ({ m, inv: m.matrixWorld.clone().invert(), cells: m.geometry.userData.fit.cells }));
      for (const pm of meshes) {
        const fp = pm.userData.fitPart, fit = pm.geometry.userData.fit, all = !BODY.has(fp);
        for (const [k, L] of fit.cells) {
          if (!all && L !== 'armor' && L !== 'gear') continue;
          const kind = all ? fp : L;
          const [x, y, z] = k.split(',').map(Number);
          v.set((x + 0.5) * S, (y + 0.5) * S, (z + 0.5) * S).applyMatrix4(pm.matrixWorld);
          if (v.y < 0.3 * S) found.push({ frame, kind, part: fp, what: 'bajo el piso', at: k });
          for (const b of bodies) {
            if (b.m === pm) continue;
            u.copy(v).applyMatrix4(b.inv).divideScalar(S);
            const cx = Math.floor(u.x), cy = Math.floor(u.y), cz = Math.floor(u.z);
            const fx = u.x - cx, fy = u.y - cy, fz = u.z - cz;
            if (fx < M || fx > 1 - M || fy < M || fy > 1 - M || fz < M || fz > 1 - M) continue;
            // el faldón gira con la pierna: la punta de arriba se mete bajo el cinturón, siempre hacia adentro del
            // torso (que la tapa); por los costados no sale porque gira en x
            if (b.m.userData.fitPart === 'torso' && pm.userData.skirt && cy <= 5) continue;
            if (b.cells.get(`${cx},${cy},${cz}`) === 'body') found.push({ frame, kind, part: fp, what: 'dentro de ' + b.m.userData.fitPart, at: k });
          }
        }
        // en la cabeza, la capucha tapa pelo a propósito: ahí solo cuenta lo que se mete en otra parte
        if (frame === FRAMES[0][0] && fp !== 'head') for (const c of fit.clash) found.push({ frame, kind: c.split(' ')[1], part: fp, what: 'tapa cuerpo en su grilla', at: c.split(' ')[0] });
      }
    }
    return found;
  }
  const cases = [];
  const base = (t, build) => ({ ...AVATAR_TYPES.find(a => a.id === t).look, type: t, build });
  for (const t of AVATAR_TYPES.map(a => a.id)) for (const build of ['recio', 'esbelto']) {
    const b = base(t, build), who = `${t} ${build}`;
    for (const cls of Object.keys(CLASS_KIT)) cases.push([`${who} · clase ${cls}`, b, { cls }]);
    for (const g of Object.keys(GEAR)) cases.push([`${who} · ${g}`, b, { gear: g }]);
    for (const d of DRESS_STYLES) cases.push([`${who} · ropa ${d.id}`, { ...b, dress: d.id, acc: 'ninguno' }, {}]);
    for (const g of ['mochila', 'catalejo']) cases.push([`${who} · capa de viaje con ${g}`, { ...b, dress: 'capa_viaje' }, { gear: g }]);
    cases.push([`${who} · capucha con pieles`, { ...b, dress: 'pieles', crown: 'capucha' }, {}]);
  }
  const out = [];
  for (const [label, look, opts] of cases) {
    const m = avatarModel(look, opts);
    const found = check(m);
    // agrupado por qué falla y dónde (con un ejemplo de celda)
    const groups = {};
    for (const f of found) { const g = `${f.kind} (${f.part}) ${f.what}`; (groups[g] ||= { n: 0, frames: new Set(), at: f.at }).n++; groups[g].frames.add(f.frame); }
    out.push({ label, look: m.userData.look.dress + '/' + m.userData.look.acc, problems: Object.entries(groups).map(([g, o]) => `${g}: ${o.n} vóxeles [${[...o.frames].join(', ')}] p. ej. ${o.at}`) });
  }
  const arms = [];
  for (const t of AVATAR_TYPES.map(a => a.id).concat('vaciado')) for (const build of ['recio', 'esbelto']) {
    const D = dimsOf(t, build);
    arms.push([`${t} ${build}`, D.armX - D.W / 2]);
  }
  return { out, arms };
});
console.log(`\nArmas y armaduras fuera del cuerpo (${res.out.length} modelos × 6 cuadros, ${Date.now() - t0} ms)`);
for (const c of res.out) ok(c.problems.length === 0, c.label, c.problems.length ? c.problems : undefined);
console.log('\nBrazo en vóxel entero');
for (const [who, dx] of res.arms) ok(Number.isInteger(dx), `${who}: armX − W/2 = ${dx}`);
await browser.close(); server.close();
if (errors.length) { fail++; console.log('\n=== ERRORES ===\n' + [...new Set(errors)].join('\n')); }
console.log(`\n${pass} ok, ${fail} mal`);
process.exit(fail ? 1 : 0);
