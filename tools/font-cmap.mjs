// Lee qué caracteres tiene una fuente (tabla cmap) a mano; para .woff2 usa fontverter (devDependency de tools/). Lo usan subset-fonts.mjs y test-i18n.mjs.
import fontverter from 'fontverter';

/** Set de code points de un .ttf/.otf (formato 12 del cmap, o 4 si no hay). */
export function cmapOf(buf) {
  const num = buf.readUInt16BE(4);
  let cmapOff = 0;
  for (let i = 0; i < num; i++) {
    const rec = 12 + i * 16;
    if (buf.toString('latin1', rec, rec + 4) === 'cmap') cmapOff = buf.readUInt32BE(rec + 8);
  }
  const set = new Set();
  const n = buf.readUInt16BE(cmapOff + 2);
  for (let i = 0; i < n; i++) {
    const off = cmapOff + buf.readUInt32BE(cmapOff + 4 + i * 8 + 4);
    const fmt = buf.readUInt16BE(off);
    if (fmt === 12) {
      const groups = buf.readUInt32BE(off + 12);
      for (let g = 0; g < groups; g++) {
        const p = off + 16 + g * 12;
        const a = buf.readUInt32BE(p), b = buf.readUInt32BE(p + 4);
        for (let c = a; c <= b; c++) set.add(c);
      }
      return set;
    }
  }
  for (let i = 0; i < n; i++) {
    const off = cmapOff + buf.readUInt32BE(cmapOff + 4 + i * 8 + 4);
    if (buf.readUInt16BE(off) !== 4) continue;
    const seg = buf.readUInt16BE(off + 6) / 2;
    for (let s = 0; s < seg; s++) {
      const end = buf.readUInt16BE(off + 14 + s * 2), start = buf.readUInt16BE(off + 16 + seg * 2 + s * 2);
      for (let c = start; c <= end && c !== 0xffff; c++) set.add(c);
    }
  }
  return set;
}


/** Igual, para un .woff2 (lo descomprime con fontverter). */
export async function cmapOfFile(buf) {
  const sfnt = buf.toString('latin1', 0, 4) === 'wOF2' || buf.toString('latin1', 0, 4) === 'wOFF' ? await fontverter.convert(buf, 'sfnt') : buf;
  return cmapOf(Buffer.from(sfnt));
}
