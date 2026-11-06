// Logo en pixel art como SVG (sin fuente ni imágenes): la casita de los íconos y la palabra "Pixelia".
// Lo usan el preloader de index.html (pegado inline, así se ve en el primer pintado) y tools/make-og.mjs.
//
//   node tools/make-logo.mjs            (imprime los dos <svg>)
//   node tools/make-logo.mjs --inject   (los reescribe en index.html entre <!--logo-crown-->…<!--/logo-crown--> y <!--logo-word-->…)
//
// Cada color es un único <path> de rectángulos (shape-rendering crispEdges): queda nítido a cualquier tamaño.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const INK = '#3d2f2a', SHADOW = '#c8673d', WHITE = '#fff', SHADE = '#f9f3e9';

// casita: misma grilla que tools/make-icons.mjs (filas 2..11, columnas 1..14). (Se sigue llamando CROWN/crownSvg
// porque index.html la marca como <!--logo-crown-->.)
const CROWN = [
  '......kk......',
  '.....kRrk.....',
  '....kRRrrk....',
  '...kRRRrrrk...',
  '..kRRRRrrrrk..',
  '.kkkkkkkkkkkk.',
  '..kcsscddcck..',
  '..kcsscddcck..',
  '..kccccdycck..',
  '..kkkkkkkkkk..',
];
const CROWN_COL = { k: INK, R: '#ee8a5c', r: '#c8673d', c: '#fdf6e3', s: '#8fd3ff', d: '#8a5a3a', y: '#ffd166' };

// letras de 10 filas; las minúsculas ocupan las filas 3..9
const X = (rows) => [...Array(10 - rows.length).fill(null), ...rows];
const GLYPHS = {
  P: ['######.', '#######', '##...##', '##...##', '#######', '######.', '##.....', '##.....', '##.....', '##.....'],
  i: ['##', '##', '..', '##', '##', '##', '##', '##', '##', '##'],
  x: X(['##...##', '##...##', '.##.##.', '..###..', '.##.##.', '##...##', '##...##']),
  e: X(['.#####.', '##...##', '##...##', '#######', '##.....', '##...##', '.#####.']),
  l: ['##.', '##.', '##.', '##.', '##.', '##.', '##.', '##.', '##.', '.##'],
  a: X(['.#####.', '.....##', '.######', '##...##', '##...##', '##..###', '.###.##']),
};

/** Rectángulos horizontales por color → un path "M x y h n v1 h-n z" por color. */
function pathOf(cells) {
  const rows = new Map();
  for (const [x, y] of cells) { if (!rows.has(y)) rows.set(y, []); rows.get(y).push(x); }
  let d = '';
  for (const [y, xs] of [...rows].sort((a, b) => a[0] - b[0])) {
    xs.sort((a, b) => a - b);
    for (let i = 0; i < xs.length;) {
      let j = i; while (j + 1 < xs.length && xs[j + 1] === xs[j] + 1) j++;
      d += `M${xs[i]} ${y}h${j - i + 1}v1h-${j - i + 1}z`;
      i = j + 1;
    }
  }
  return d;
}

export function crownSvg(attrs = '') {
  const by = {};
  CROWN.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.') (by[ch] ||= []).push([x, y]); }));
  const paths = Object.entries(by).map(([ch, cells]) => `<path fill="${CROWN_COL[ch]}" d="${pathOf(cells)}"/>`).join('');
  return `<svg ${attrs} viewBox="0 0 14 10" shape-rendering="crispEdges" aria-hidden="true">${paths}</svg>`;
}

export function wordSvg(text = 'Pixelia', attrs = '') {
  const fill = new Set();
  let ox = 1;
  for (const ch of text) {
    const g = GLYPHS[ch];
    g.forEach((row, y) => { if (row) [...row].forEach((c, x) => { if (c === '#') fill.add(`${ox + x},${y + 1}`); }); });
    ox += g.at(-1).length + 1;
  }
  const W = ox, H = 13;   // 1 de contorno arriba, 10 de letra, 1 de contorno, 1 de sombra
  const outline = new Set();
  for (const k of fill) {
    const [x, y] = k.split(',').map(Number);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) outline.add(`${x + dx},${y + dy}`);
  }
  const shadow = [...outline].map(k => { const [x, y] = k.split(',').map(Number); return `${x},${y + 1}`; });
  const cells = (set) => [...set].map(k => k.split(',').map(Number));
  const top = cells(fill).filter(([, y]) => y < 8), bottom = cells(fill).filter(([, y]) => y >= 8);
  return `<svg ${attrs} viewBox="0 0 ${W} ${H}" shape-rendering="crispEdges" role="img" aria-label="${text}">`
    + `<path fill="${SHADOW}" d="${pathOf(cells(new Set(shadow)))}"/>`
    + `<path fill="${INK}" d="${pathOf(cells(outline))}"/>`
    + `<path fill="${WHITE}" d="${pathOf(top)}"/>`
    + `<path fill="${SHADE}" d="${pathOf(bottom)}"/></svg>`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const blocks = { crown: crownSvg('class="boot-crown" width="112" height="80"'), word: wordSvg('Pixelia', 'class="boot-word" width="301" height="91"') };
  if (process.argv.includes('--inject')) {
    const file = join(dirname(fileURLToPath(import.meta.url)), '..', 'index.html');
    let html = readFileSync(file, 'utf8');
    for (const [k, svg] of Object.entries(blocks)) {
      const re = new RegExp(`(<!--logo-${k}-->)[\\s\\S]*?(<!--/logo-${k}-->)`);
      if (!re.test(html)) { console.error(`falta <!--logo-${k}--> … <!--/logo-${k}--> en index.html`); process.exit(1); }
      html = html.replace(re, `$1${svg}$2`);
    }
    writeFileSync(file, html);
    console.log('logo actualizado en index.html');
  } else console.log(blocks.crown + '\n' + blocks.word);
}
