// Láminas de Hallazgos: pasa los dibujos de tools/finds/sets/<set>.mjs a grillas de 32×32 (src/core/icons/finds/<set>.js)
// y arma una hoja PNG para mirarlas (shots/finds/<set>.png), sin navegador.
//   node tools/finds.mjs               → todos los sets
//   node tools/finds.mjs postres noche → solo esos
//   node tools/finds.mjs --check       → no escribe: falla si alguna grilla quedó distinta de su dibujo
// Hoja por set, 3×3 en el orden del archivo (el número es la posición): la lámina ×7 sobre el color claro del set, y al
// lado ×3 sobre claro, ×3 en grises, ×2 sobre claro (el tamaño real en la página del álbum), ×2 sobre el fondo oscuro
// de la interfaz y la silueta ×2 (así se ve la que falta).
import { readdirSync, writeFileSync, readFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { G, Img, gridPixels, N } from './finds/lib.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'tools/finds/sets'), OUT = join(ROOT, 'src/core/icons/finds'), SHOTS = join(ROOT, 'shots/finds');
const args = process.argv.slice(2), check = args.includes('--check');
const want = args.filter(a => !a.startsWith('--'));
const ids = (want.length ? want : readdirSync(SRC).filter(f => f.endsWith('.mjs')).map(f => f.slice(0, -4))).sort();
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
let bad = 0;

for (const id of ids) {
  const file = join(SRC, id + '.mjs');
  if (!existsSync(file)) { console.log(`${id}: no existe ${file}`); bad++; continue; }
  const set = (await import(pathToFileURL(file).href + '?t=' + Date.now())).default;
  if (set.id !== id) { console.log(`${id}: el id del set dice "${set.id}"`); bad++; }
  if (set.laminas.length !== 9) { console.log(`${id}: tiene ${set.laminas.length} láminas (van 9)`); bad++; }
  const done = [];
  for (const [lid, name, draw] of set.laminas) {
    const g = new G(lid);
    try { draw(g); } catch (e) { console.log(`  ${lid}: ERROR ${e.message}`); bad++; }
    const rows = g.rows();
    let n = 0, x0 = N, x1 = 0, y0 = N, y1 = 0; const tones = new Set();
    rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch !== '.') { n++; tones.add(ch); x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } }));
    const w = x1 - x0 + 1, h = y1 - y0 + 1, notes = [...g.warn];
    if (Math.max(w, h) < 24) notes.push(`chica: ocupa ${w}×${h} (que el lado largo llegue a 26–30)`);
    if (n < N * N * 0.16) notes.push(`casi vacía (${n} pixeles)`);
    if (tones.size < 4) notes.push(`pocos tonos (${tones.size})`);
    console.log(`  ${lid.padEnd(20)} ${String(w).padStart(2)}×${String(h).padEnd(2)} ${String(n).padStart(4)} px ${String(tones.size).padStart(2)} tonos${notes.length ? '  ! ' + notes.join(' · ') : ''}`);
    done.push({ id: lid, name, rows });
  }
  // grillas
  const js = `// Láminas de Hallazgos · set «${set.name}» (${id}). Grillas de 32×32 con la paleta de palette.js.\n`
    + `// GENERADO por tools/finds.mjs desde tools/finds/sets/${id}.mjs: se corrige allá y se vuelve a generar.\n`
    + `export default {\n` + done.map(d => `  '${d.id}': {\n    name: ${JSON.stringify(d.name)},\n    s32: [\n${d.rows.map(r => `      '${r}',`).join('\n')}\n    ],\n  },`).join('\n') + `\n};\n`;
  const outFile = join(OUT, id + '.js');
  if (check) {
    if (!existsSync(outFile) || readFileSync(outFile, 'utf8').replace(/\r\n/g, '\n') !== js) { console.log(`${id}: la grilla no coincide con el dibujo (correr node tools/finds.mjs ${id})`); bad++; }
    continue;
  }
  mkdirSync(OUT, { recursive: true });
  writeFileSync(outFile, js);
  // hoja
  const light = hex(set.light || '#ece4d6'), dark = [42, 37, 34], cw = 430, chh = 244, pad = 10;
  const img = new Img(pad + 3 * cw, pad + 3 * chh);
  done.forEach((d, i) => {
    const px = gridPixels(d.rows), x = pad + (i % 3) * cw, y = pad + Math.floor(i / 3) * chh;
    img.rect(x, y, 224, 224, light); img.sprite(px, x, y, 7);
    img.rect(x + 232, y, 96, 96, light); img.sprite(px, x + 232, y, 3);
    img.rect(x + 232, y + 104, 96, 96, [200, 200, 200]); img.sprite(px, x + 232, y + 104, 3, 'gray');
    img.rect(x + 336, y, 64, 64, light); img.sprite(px, x + 336, y, 2);
    img.rect(x + 336, y + 72, 64, 64, dark); img.sprite(px, x + 336, y + 72, 2);
    img.rect(x + 336, y + 144, 64, 64, light); img.sprite(px, x + 336, y + 144, 2, 'sil');
    img.num(i + 1, x + 236, y + 208);
  });
  mkdirSync(SHOTS, { recursive: true });
  writeFileSync(join(SHOTS, id + '.png'), img.png());
  console.log(`${id}: ${done.length} láminas → src/core/icons/finds/${id}.js · shots/finds/${id}.png`);
}
if (bad) { console.log(`\n${bad} problema(s)`); process.exit(1); }
