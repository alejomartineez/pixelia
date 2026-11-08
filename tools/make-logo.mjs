// Logo en pixel art como SVG (sin fuente ni imágenes): la casita de los íconos y la palabra "Pixelia", y el logo del
// estudio, Dezings (cubo vóxel + DEZINGS letra por letra), que se ve antes del splash.
// Lo usan el preloader de index.html (pegado inline, así se ve en el primer pintado) y tools/make-og.mjs.
//
//   node tools/make-logo.mjs            (imprime los <svg>)
//   node tools/make-logo.mjs --inject   (los reescribe en index.html entre <!--logo-crown-->…<!--/logo-crown-->,
//                                        <!--logo-word-->… y <!--logo-studio-->…)
// El logo del estudio pinta con variables CSS (--st-top, --st-left, --st-right, --st-ink, --st-face, --st-face2,
// --st-shadow, --st-glow): los colores de cada variante están en el CSS de #studio en index.html.
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
  // mayúsculas del logo del estudio
  D: ['######.', '#######', '##...##', '##...##', '##...##', '##...##', '##...##', '##...##', '#######', '######.'],
  E: ['#######', '#######', '##.....', '##.....', '######.', '######.', '##.....', '##.....', '#######', '#######'],
  Z: ['#######', '#######', '....###', '...###.', '..###..', '.###...', '###....', '##.....', '#######', '#######'],
  I: ['######', '######', '..##..', '..##..', '..##..', '..##..', '..##..', '..##..', '######', '######'],
  N: ['##...##', '###..##', '###..##', '####.##', '##.####', '##..###', '##..###', '##...##', '##...##', '##...##'],
  G: ['.#####.', '#######', '##...##', '##.....', '##.....', '##.####', '##.####', '##...##', '#######', '.#####.'],
  S: ['.######', '#######', '##.....', '##.....', '######.', '.######', '.....##', '.....##', '#######', '######.'],
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

// ---------- Logo del estudio: Dezings ----------
const cellsOf = (set) => [...set].map(k => k.split(',').map(Number));
const vpath = (v, cells) => `<path style="fill:var(${v})" d="${pathOf(cells)}"/>`;

/** Cubo vóxel isométrico (2:1) de 18×18: cara de arriba, izquierda y derecha, borde tinta y un filo de luz. */
export function studioCubeSvg(attrs = '') {
  const W = 18, side = 9, by = { top: [], left: [], right: [], rim: [] }, all = new Set();
  for (let x = 0; x < W; x++) {
    const dx = x < W / 2 ? W / 2 - 1 - x : x - W / 2;          // 0 en el centro, 8 en los bordes
    const t0 = Math.floor(dx / 2), t1 = 8 - Math.floor(dx / 2);  // cara de arriba
    for (let y = t0; y <= t1 + side; y++) {
      all.add(`${x},${y}`);
      if (y < t1) by.top.push([x, y]);
      else if (y === t1) by.rim.push([x, y]);
      else (x < W / 2 ? by.left : by.right).push([x, y]);
    }
  }
  const ink = cellsOf(all).filter(([x, y]) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => !all.has(`${x + a},${y + b}`)));
  const inkSet = new Set(ink.map(c => c.join(',')));
  const keep = (arr) => arr.filter(c => !inkSet.has(c.join(',')));
  // arista vertical del frente (entre izquierda y derecha) un tono más oscuro
  const edge = keep(by.left).filter(([x]) => x === W / 2 - 1);
  const H = Math.max(...cellsOf(all).map(([, y]) => y)) + 1;
  return `<svg ${attrs} viewBox="0 0 ${W} ${H}" shape-rendering="crispEdges" aria-hidden="true">`
    + vpath('--st-top', keep(by.top)) + vpath('--st-glow', keep(by.rim)) + vpath('--st-left', keep(by.left).filter(([x]) => x !== W / 2 - 1))
    + vpath('--st-right', keep(by.right)) + vpath('--st-right', edge) + vpath('--st-ink', ink) + '</svg>';
}

/** Una letra del logo: cara clara (con media cara más oscura abajo), contorno tinta y sombra de 2 de alto. */
export function studioLetterSvg(ch, attrs = '') {
  const g = GLYPHS[ch], fill = new Set();
  g.forEach((row, y) => [...row].forEach((c, x) => { if (c === '#') fill.add(`${x + 1},${y + 1}`); }));
  const outline = new Set();
  for (const k of fill) { const [x, y] = k.split(',').map(Number); for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) outline.add(`${x + a},${y + b}`); }
  const W = g[0].length + 2, H = 14;
  // huecos encerrados (el ojo de la D, la G…): tinta, así no se ve el fondo ni la sombra a través
  const outside = new Set(), stack = [[-1, -1]];
  while (stack.length) {
    const [x, y] = stack.pop(), k = `${x},${y}`;
    if (x < -1 || y < -1 || x > W || y > H || outside.has(k) || outline.has(k)) continue;
    outside.add(k);
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  for (let x = 0; x < W; x++) for (let y = 0; y < H; y++) { const k = `${x},${y}`; if (!outside.has(k) && !fill.has(k)) outline.add(k); }
  // sombra: 2 filas debajo de lo más bajo de cada columna (nada se asoma por adentro de la letra)
  const shadow = new Set(), low = {};
  for (const k of outline) { const [x, y] = k.split(',').map(Number); low[x] = Math.max(low[x] ?? -1, y); }
  for (const [x, y] of Object.entries(low)) { shadow.add(`${x},${y + 1}`); shadow.add(`${x},${y + 2}`); }
  const f = cellsOf(fill);
  return `<svg ${attrs} viewBox="0 0 ${W} ${H}" shape-rendering="crispEdges" aria-hidden="true">`
    + vpath('--st-shadow', cellsOf(shadow)) + vpath('--st-ink', cellsOf(outline))
    + vpath('--st-face', f.filter(([, y]) => y < 7)) + vpath('--st-face2', f.filter(([, y]) => y >= 7)) + '</svg>';
}

/** Lo que va entre <!--logo-studio--> y <!--/logo-studio--> en index.html. */
export function studioHtml(word = 'DEZINGS') {
  const letters = [...word].map((ch, i) => `<span class="st-l" style="--i:${i}">${studioLetterSvg(ch)}</span>`).join('');
  return `<span class="st-cube">${studioCubeSvg()}</span><span class="st-word" role="img" aria-label="Dezings">${letters}</span>`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const blocks = { crown: crownSvg('class="boot-crown" width="112" height="80"'), word: wordSvg('Pixelia', 'class="boot-word" width="301" height="91"'), studio: studioHtml() };
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
  } else console.log(Object.values(blocks).join('\n'));
}
