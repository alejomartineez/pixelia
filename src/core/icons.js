// Íconos pixel-art. Los principales están dibujados a mano (mapas de pixeles);
// el resto se generan "pixelando" un emoji: se dibuja chiquito, se binariza el alfa y se le pone contorno.
// Uso: icon('coin') -> '<img class="pi" ...>'  |  iconUrl('gem') -> dataURL

const C = {
  k: '#3b2340', y: '#ffd166', Y: '#e8a93a', w: '#ffffff', p: '#ff7eb6', P: '#e0528f',
  s: '#8fd3ff', S: '#4fa8e0', l: '#b58cff', L: '#8a5ee0', m: '#6fe3c1', M: '#3cbf9a', c: '#fff4e6', g: '#d8d2e6', G: '#a99fbf',
};

const MAPS = {
  coin: [
    '....kkkk....',
    '..kkyyyykk..',
    '.kyywwyyyYk.',
    '.kywyyyyyYk.',
    'kyyyyYYyyyYk',
    'kywyyYyyyyYk',
    'kyyyyYyyyyYk',
    'kyyyyYYyyyYk',
    '.kyyyyyyyYk.',
    '.kYyyyyyYYk.',
    '..kkYYYYkk..',
    '....kkkk....',
  ],
  gem: [
    '............',
    '...kkkkkk...',
    '..kswwssSk..',
    '.kswwsssSSk.',
    'kkkkkkkkkkkk',
    'kSswwsssSSSk',
    '.kSswssSSSk.',
    '..kSssssSk..',
    '...kSssSk...',
    '....kSSk....',
    '.....kk.....',
    '............',
  ],
  star: [
    '.....kk.....',
    '....kyyk....',
    '....kywk....',
    'kkkkkywykkkk',
    'kyyyywyyyyYk',
    '.kyyyyyyyYk.',
    '..kyyyyyYk..',
    '..kyyyyyYk..',
    '.kyyYkkYyYk.',
    '.kyYk..kYYk.',
    'kYYk....kYYk',
    'kkk......kkk',
  ],
  starOff: [
    '.....kk.....',
    '....kggk....',
    '....kgwk....',
    'kkkkkgwgkkkk',
    'kggggwggggGk',
    '.kggggggggk.',
    '..kgggggGk..',
    '..kgggggGk..',
    '.kggGkkGgGk.',
    '.kgGk..kGGk.',
    'kGGk....kGGk',
    'kkk......kkk',
  ],
  heart: [
    '............',
    '.kkk....kkk.',
    'kpppk..kpppk',
    'kpwppkkppppk',
    'kpwpppppppPk',
    'kppppppppPPk',
    '.kppppppPPk.',
    '..kpppppPk..',
    '...kpppPk...',
    '....kpPk....',
    '.....kk.....',
    '............',
  ],
  crown: [
    '............',
    '.k...kk...k.',
    'kyk.kyyk.kyk',
    'kyykyyyykyyk',
    'kyyyyyyyyyyk',
    'kywyyyyyyyYk',
    'kyypyysyypYk',
    'kyyyyyyyyyYk',
    'kYYYYYYYYYYk',
    '.kkkkkkkkkk.',
    '............',
    '............',
  ],
  xp: [
    '.....kk.....',
    '....kllk....',
    '....kllk....',
    '...klwllk...',
    'kkkklwlllkkk',
    'kllllllllLLk',
    'kkkkllllLkkk',
    '...kllllk...',
    '....kLLk....',
    '....kLLk....',
    '.....kk.....',
    '............',
  ],
};

const EMOJI = {
  people: '👭', smile: '😊', clock: '⏰', lock: '🔒', hammer: '🔨', gear: '⚙️', quest: '📜', games: '🎮',
  dress: '👗', car: '🚗', home: '🏠', map: '🗺️', check: '✅', close: '❌', music: '🎵', sound: '🔊', mute: '🔇',
  gift: '🎁', trophy: '🏆', calendar: '📅', plus: '➕', rotate: '🔄', move: '✋', trash: '🗑️', up: '⬆️', shop: '🛍️',
  castle: '🏰', build: '🏗️', bag: '👜', cake: '🍰', flower: '🌸', sparkle: '✨', rocket: '🚀', fire: '🔥', bolt: '⚡',
  play: '▶️', pause: '⏸️', back: '⬅️', info: 'ℹ️', camera: '📷', save: '💾', palette: '🎨', key: '🔑', ice: '🍦',
  diamond: '💎', ring: '💍', ribbon: '🎀', wand: '🪄', bear: '🧸', paw: '🐾', sun: '☀️', moon: '🌙',
};

const cache = new Map();

function mapToUrl(rows) {
  const n = rows.length;
  let rects = '';
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch !== '.') rects += `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${C[ch]}"/>`;
  }));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges">${rects}</svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

function emojiToUrl(em, size = 18) {
  const pad = 1, full = size + pad * 2;
  const cv = document.createElement('canvas');
  cv.width = cv.height = full;
  const g = cv.getContext('2d', { willReadFrequently: true });
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `${Math.round(size * 0.92)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
  g.fillText(em, full / 2, full / 2 + size * 0.06);
  const img = g.getImageData(0, 0, full, full);
  const d = img.data;
  const solid = new Uint8Array(full * full);
  for (let i = 0; i < full * full; i++) {
    const a = d[i * 4 + 3];
    if (a > 110) {
      solid[i] = 1;
      // des-premultiplicar y saturar un poquito para look pixel-art
      const f = 255 / a;
      for (let c = 0; c < 3; c++) d[i * 4 + c] = Math.min(255, Math.round(d[i * 4 + c] * Math.min(f, 1.6)));
      d[i * 4 + 3] = 255;
    } else d[i * 4 + 3] = 0;
  }
  // contorno de 1px color tinta
  for (let y = 0; y < full; y++) for (let x = 0; x < full; x++) {
    const i = y * full + x;
    if (solid[i]) continue;
    const near = (x > 0 && solid[i - 1]) || (x < full - 1 && solid[i + 1]) || (y > 0 && solid[i - full]) || (y < full - 1 && solid[i + full]);
    if (near) { d[i * 4] = 59; d[i * 4 + 1] = 35; d[i * 4 + 2] = 64; d[i * 4 + 3] = 255; }
  }
  g.putImageData(img, 0, 0);
  return cv.toDataURL();
}

/** dataURL del ícono. name: clave de MAPS/EMOJI o directamente un emoji. */
export function iconUrl(name) {
  if (cache.has(name)) return cache.get(name);
  let url;
  if (MAPS[name]) url = mapToUrl(MAPS[name]);
  else url = emojiToUrl(EMOJI[name] || name);
  cache.set(name, url);
  return url;
}
/** HTML de un ícono. size en px (múltiplo de 12 queda más nítido). */
export function icon(name, size = 20, cls = '') {
  return `<img class="pi ${cls}" src="${iconUrl(name)}" width="${size}" height="${size}" alt="" draggable="false">`;
}
export const ICON_NAMES = [...Object.keys(MAPS), ...Object.keys(EMOJI)];
