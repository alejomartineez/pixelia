// Pruebas de los sprites 2D de personajes (paso 1d de La Travesía, src/art/sprite2d.js). En Chrome headless, porque
// las paletas salen de src/avatar/figure.js (que trae three.js):
//   - todos los pueblos × contexturas × clases (y sin clase), cada animación cuadro a cuadro: nada fuera del cuadro,
//     ningún carácter sin material, sin agujeros de 1 o 2 píxeles adentro de la figura y la figura de una sola pieza
//     (salvo los golpes y disparos, que llevan efectos: flecha, fogonazo, humo, destello);
//   - cada pieza del catálogo en cada pueblo que la puede llevar (pelo, cara, ropa, cabeza y accesorio);
//   - 300 looks al azar (semilla fija) en todas las animaciones;
//   - un look da siempre los mismos píxeles (con la caché vaciada en el medio);
//   - la gente con nombre, los enemigos con forma de persona, la hoja de animaciones y el retrato con sticker.
//   node test-sprite2d.mjs
import http from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';
import puppeteer from 'puppeteer-core';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (c, msg, extra) => { if (c) { pass++; console.log('  ok  ', msg); } else { fail++; console.log('  MAL ', msg, extra !== undefined ? JSON.stringify(extra).slice(0, 700) : ''); } };
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp' };
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
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push('PAGEERROR: ' + (e.stack || e.message)));
page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE.ERROR: ' + m.text()); });
await page.goto(BASE + 'tools/sprites.html?view=none', { waitUntil: 'load' });
await page.waitForFunction('window.__ready === true', { timeout: 30000 });

const r = await page.evaluate(async () => {
  const S = await import('/src/art/sprite2d.js');
  const D = await import('/src/core/data.js');
  const F = await import('/src/avatar/figure.js');
  const ST = await import('/src/story/story-data.js');
  const W = S.FW, H = S.FH;
  function check(fr, fx) {
    const px = fr.px, seen = new Uint8Array(W * H);
    let holes = 0;
    // agujeros: regiones vacías que no tocan el borde, de 1 o 2 píxeles (las grandes, como el hueco del arco, valen)
    for (let i = 0; i < px.length; i++) {
      if (px[i] || seen[i]) continue;
      const st = [i]; let n = 0, edge = false; seen[i] = 1;
      while (st.length) {
        const j = st.pop(); n++; const x = j % W, y = (j / W) | 0;
        if (!x || !y || x === W - 1 || y === H - 1) edge = true;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const k = ny * W + nx; if (!px[k] && !seen[k]) { seen[k] = 1; st.push(k); } }
      }
      if (!edge && n <= 2) holes++;
    }
    // piezas sueltas (8 vecinos)
    let parts = 0; const s2 = new Uint8Array(W * H);
    for (let i = 0; i < px.length; i++) {
      if (!px[i] || s2[i]) continue; parts++;
      const st = [i]; s2[i] = 1;
      while (st.length) {
        const j = st.pop(); const x = j % W, y = (j / W) | 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const k = ny * W + nx; if (px[k] && !s2[k]) { s2[k] = 1; st.push(k); } }
      }
    }
    let filled = 0; for (const v of px) if (v) filled++;
    // los efectos (chispas del destello) pueden dejar huecos: en esos cuadros solo se mira la figura
    return { clip: fr.clip, bad: fr.bad, holes: fx ? 0 : holes, parts, filled, okParts: fx || parts === 1 };
  }
  const isBad = (c) => c.clip || c.bad || c.holes || !c.okParts || c.filled < 120;
  const out = { grid: { n: 0, bad: [] }, catalogo: { n: 0, bad: [] }, azar: { n: 0, bad: [] } };
  const run = (bucket, look, opts, label) => {
    for (const a of S.ANIM_IDS) for (let f = 0; f < S.ANIMS[a].frames; f++) {
      const c = check(S.spriteFrame(look, a, f, opts), a === 'attack');
      bucket.n++;
      if (isBad(c) && bucket.bad.length < 12) bucket.bad.push({ label, a, f, ...c });
    }
  };
  const PEOPLES = [...D.AVATAR_TYPES.map(t => t.id), 'vaciado'];
  const base = (t) => ({ ...(D.AVATAR_TYPES.find(a => a.id === t) || D.AVATAR_TYPES[0]).look, type: t });
  for (const t of PEOPLES) for (const b of ['recio', 'esbelto']) for (const cls of [null, ...Object.keys(F.CLASS_KIT)]) {
    run(out.grid, { ...base(t), build: b }, cls ? { cls, item: 'veta' } : {}, `${t}/${b}/${cls}`);
  }
  const KINDS = { hair: D.HAIR_STYLES, face: D.FACES, dress: D.DRESS_STYLES, crown: D.CROWNS, acc: D.ACCESSORIES };
  for (const t of D.AVATAR_TYPES.map(a => a.id)) for (const [k, list] of Object.entries(KINDS)) for (const it of list) {
    if (!D.fitsType(it, t)) continue;
    for (const b of ['recio', 'esbelto']) {
      const look = { ...base(t), build: b, [k]: it.id };
      for (const [a, f] of [['idle', 0], ['attack', 0], ['attack', 1], ['walk', 2], ['hurt', 0], ['fall', 1], ['lift', 1]]) {
        const c = check(S.spriteFrame(look, a, f), a === 'attack'); out.catalogo.n++;
        if (isBad(c) && out.catalogo.bad.length < 12) out.catalogo.bad.push({ t, b, k, id: it.id, a, f, ...c });
      }
    }
  }
  let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const pick = (l) => l[Math.floor(rnd() * l.length)];
  const looks = [];
  for (let i = 0; i < 300; i++) {
    const t = pick(D.AVATAR_TYPES).id;
    const fit = (l) => pick(l.filter(it => D.fitsType(it, t))).id;
    looks.push({ type: t, build: pick(['recio', 'esbelto']), skin: Math.floor(rnd() * 6), hair: fit(D.HAIR_STYLES), hairColor: pick(D.HAIR_COLORS).id, face: fit(D.FACES), dress: fit(D.DRESS_STYLES), dressColor: pick(D.OUTFIT_COLORS).id, crown: fit(D.CROWNS), acc: fit(D.ACCESSORIES) });
  }
  looks.forEach((l, i) => run(out.azar, l, { item: S.SPRITE_ITEMS[i % S.SPRITE_ITEMS.length] }, JSON.stringify(l)));
  const sig = () => { let h = 0; for (const l of looks.slice(0, 40)) for (const a of S.ANIM_IDS) { const fr = S.spriteFrame(l, a, 1); for (const v of fr.px) h = (Math.imul(h, 31) + v) | 0; } return h; };
  const h1 = sig(); S.clearSpriteCache(); const h2 = sig();
  const a0 = S.spriteFrame(looks[0], 'idle', 0), a1 = S.spriteFrame(looks[1], 'idle', 0);
  const diff = a0.px.some((v, i) => v !== a1.px[i]);
  const named = Object.values(ST.CHARACTERS).filter(c => c.look).map(c => ({ id: c.id, look: c.look }));
  const enemies = Object.entries(S.ENEMY_LOOKS).map(([id, e]) => ({ id, look: e.look, gear: e.gear }));
  const namedBad = [];
  for (const n of [...named, ...enemies]) { const c = check(S.spriteFrame(n.look, 'idle', 0, { gear: n.gear })); if (c.clip || c.bad || c.holes || c.parts !== 1) namedBad.push({ id: n.id, ...c }); }
  const tir = S.spriteFrame(S.ENEMY_LOOKS.tirador.look, 'idle', 0, { gear: 'trabuco' });
  const tir0 = S.spriteFrame(S.ENEMY_LOOKS.tirador.look, 'idle', 0);
  const sheet = S.spriteSheet(named[0].look, { scale: 2 });
  const p1 = S.portrait(named[0].look), p2 = S.portrait(named[0].look, { sticker: true, scale: 3 }), p3 = S.portrait(named[0].look, { full: true, sticker: true });
  const d = p2.getContext('2d').getImageData(0, 0, p2.width, p2.height).data;
  let white = 0, any = 0; for (let i = 0; i < d.length; i += 4) { if (d[i + 3]) any++; if (d[i] === 0xfb && d[i + 1] === 0xf7 && d[i + 3] === 255) white++; }
  // escalado entero sin suavizado: cada bloque de 3 × 3 es de un solo color
  let blocks = true;
  for (let y = 0; y < p2.height; y += 3) for (let x = 0; x < p2.width; x += 3) {
    const o = (y * p2.width + x) * 4;
    for (const [ax, by] of [[1, 0], [2, 2], [0, 1]]) { const q = ((y + by) * p2.width + x + ax) * 4; if (d[o] !== d[q] || d[o + 3] !== d[q + 3]) blocks = false; }
  }
  // prueba de silueta: cada clase cambia la forma en negro (el arma y la cabeza dicen el oficio)
  const sil = (o) => Array.from(S.spriteFrame(base('humano'), 'idle', 0, o).px, v => (v ? 1 : 0)).join('');
  const sils = new Set(Object.keys(F.CLASS_KIT).map(c => sil({ cls: c })));
  return { out, h1, h2, diff, namedBad, nNamed: named.length + enemies.length, gunDiff: tir.px.some((v, i) => v !== tir0.px[i]),
    sheet: { w: sheet.canvas.width, h: sheet.canvas.height, fw: sheet.fw, anims: Object.keys(sheet.anims).length, walk: sheet.anims.walk.frames },
    p1: [p1.width, p1.height], p2: [p2.width, p2.height], p3: [p3.width, p3.height], white, any, blocks, sils: sils.size, nClass: Object.keys(F.CLASS_KIT).length };
});

console.log('\nTodas las combinaciones');
for (const [k, b] of Object.entries(r.out)) ok(b.n > 0 && b.bad.length === 0, `${k}: ${b.n} cuadros sin piezas fuera del cuadro, sin huecos y de una sola pieza`, b.bad);
console.log('\nDeterminismo y variedad');
ok(r.h1 === r.h2, 'el mismo look da los mismos píxeles (con la caché vaciada)', [r.h1, r.h2]);
ok(r.diff, 'dos looks distintos dan sprites distintos');
ok(r.sils === r.nClass, `cada clase tiene su silueta (${r.sils} de ${r.nClass})`);
console.log('\nGente con nombre, enemigos, hoja y retratos');
ok(r.namedBad.length === 0 && r.nNamed >= 9, `${r.nNamed} personas con nombre y enemigos arman bien`, r.namedBad);
ok(r.gunDiff, 'opts.gear pone un arma que no está en el catálogo (el trabuco del tirador)');
ok(r.sheet.anims === 8 && r.sheet.walk === 4 && r.sheet.fw === 64 && r.sheet.w === 4 * 64 && r.sheet.h === 8 * 64, 'la hoja trae 8 animaciones y 4 cuadros de caminar, a escala 2', r.sheet);
ok(r.p1[0] === 24 && r.p1[1] <= 24 && r.p2[0] === (24 + 6) * 3, 'el retrato es un busto de 24 de ancho y el sticker suma el borde', [r.p1, r.p2]);
ok(r.white > 100 && r.any > r.white, 'el sticker tiene su borde blanco', [r.white, r.any]);
ok(r.blocks, 'el escalado es entero y sin suavizado');
ok(r.p3[1] > r.p2[1] / 3, 'el retrato de cuerpo entero es más alto que el busto', r.p3);
ok(errors.length === 0, 'sin errores en la página', errors.slice(0, 5));
await browser.close(); server.close();
console.log(`\n${pass} ok, ${fail} mal`);
process.exit(fail ? 1 : 0);
