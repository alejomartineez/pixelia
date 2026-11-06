// Genera los íconos PNG de la app (casita pixel-art sobre cielo y pasto) sin dependencias.
// node tools/make-icons.mjs
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'icons');
const COL = { k: [61, 47, 42], R: [238, 138, 92], r: [200, 103, 61], c: [253, 246, 227], s: [143, 211, 255], d: [138, 90, 58], y: [255, 209, 102], g: [127, 204, 112], G: [95, 170, 92] };
// 16x16 casita sobre el pasto
const ART = [
  '................',
  '................',
  '.......kk.......',
  '......kRrk......',
  '.....kRRrrk.....',
  '....kRRRrrrk....',
  '...kRRRRrrrrk...',
  '..kkkkkkkkkkkk..',
  '...kcsscddcck...',
  '...kcsscddcck...',
  '...kccccdycck...',
  '...kkkkkkkkkk...',
  'gggggggggggggggg',
  'GGGGGGGGGGGGGGGG',
  'GGGGGGGGGGGGGGGG',
  'GGGGGGGGGGGGGGGG',
];

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, pixelFn) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixelFn(x, y);
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

function make(size, name, padFrac = 0.12) {
  const pad = Math.round(size * padFrac);
  const cell = (size - pad * 2) / 16;
  const buf = png(size, (x, y) => {
    // fondo: cielo celeste que se aclara hacia abajo, con nubecitas
    const t = y / size;
    let bg = [Math.round(169 + 70 * t), Math.round(218 + 20 * t), Math.round(255 - 30 * t), 255];
    const sx = Math.floor(x / (size / 16)), sy = Math.floor(y / (size / 16));
    if ((sx === 2 && sy === 13) || (sx === 13 && sy === 2) || (sx === 12 && sy === 14) || (sx === 3 && sy === 1)) bg = [255, 255, 255, 255];
    if (y >= pad + 13 * cell) bg = [...COL.G, 255];   // el pasto llega hasta el borde
    const ax = Math.floor((x - pad) / cell), ay = Math.floor((y - pad) / cell) - 1;
    if (ax >= 0 && ax < 16 && ay >= 0 && ay < 16) {
      const ch = ART[ay][ax];
      if (ch !== '.') return [...COL[ch], 255];
    }
    return bg;
  });
  writeFileSync(join(OUT, name), buf);
}
make(192, 'icon-192.png');
make(512, 'icon-512.png');
make(180, 'apple-touch-icon.png');
make(512, 'icon-maskable-512.png', 0.2);
make(32, 'favicon-32.png', 0);   // sin margen: celdas de 2 px exactos, nítido en la pestaña
console.log('íconos generados en', OUT);
