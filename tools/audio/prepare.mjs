// Prepara los sonidos del juego (PLAN-QUIEBRE §K6): recorta, saca el silencio del principio, normaliza (ambiente cerca
// de −20 LUFS; instrumentos con una ganancia común por instrumento, así se respeta la dinámica entre notas; efectos al
// mismo pico), arma loops sin clic (fundido de la cola sobre la cabeza), pasa a mono los sueltos y codifica en AAC
// (.m4a). Deja assets/audio/manifest.json y assets/audio/LICENSES.md.
//
//   node tools/audio/prepare.mjs --src <carpeta de descargas> [--only piano] [--dry]
//
// La carpeta de descargas tiene una subcarpeta por archivo bajado (ver sources.mjs). Nada de esa carpeta se ejecuta:
// ffmpeg la lee pasándole las rutas como argumentos.
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync, statSync, readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SOURCES, ORIGINS } from './sources.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(ROOT, 'assets/audio');
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const SRC = arg('--src');
const ONLY = arg('--only');
const VOICE = arg('--voice');

const ff = (args, opts = {}) => {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostdin', '-y', ...args], { maxBuffer: 1 << 28, ...opts });
  if (r.status !== 0) throw new Error('ffmpeg: ' + String(r.stderr).slice(-800));
  return r;
};
const probeDur = (f) => Number(String(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).stdout).trim());

// sección del narrador en LICENSES.md (la arma --voice y también la pasada completa)
const NARRATOR_MD = (files) => '## Narrador\n- Autor: voz generada con Gemini TTS (Google) para Pixelia, con `tools/audio/narrate.mjs`\n' +
  '- Licencia: generada para el juego (no es CC0)\n- Archivos: ' + files.map(f => '`' + f + '`').join(', ') + '\n';
// Voz del narrador (PLAN-TRAVESIA §3a): `--voice <lista.json>` con [{ id: 'voice/intro/01', wav }] que arma
// narrate.mjs. Saca el silencio de las puntas, normaliza a −18 LUFS (la voz va adelante de la música), pasa a mono y a
// AAC, y suma cada una al manifest con categoría 'voice' y su duración real (los subtítulos se estiran a eso).
if (VOICE) {
  const list = JSON.parse(readFileSync(VOICE, 'utf8'));
  const mpath = join(OUT, 'manifest.json');
  const manifest = JSON.parse(readFileSync(mpath, 'utf8'));
  for (const { id, wav } of list) {
    const rel = id.replace(/^voice\//, '').replace(/[^a-zA-Z0-9_/-]/g, '_') + '.m4a';
    const out = join(OUT, 'voice', rel);
    mkdirSync(dirname(out), { recursive: true });
    const trim = 'silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.02';
    ff(['-i', wav, '-af', `${trim},areverse,${trim},areverse,afade=t=in:d=0.01,loudnorm=I=-18:TP=-1.5:LRA=11,alimiter=limit=0.9`,
      '-ac', '1', '-ar', '44100', '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', out]);
    const dur = probeDur(out);
    manifest.files[id] = { file: 'voice/' + rel, cat: 'voice', dur: Math.round(dur * 1000) / 1000, src: 'gemini' };
    console.log(`  ${id.padEnd(22)} ${(statSync(out).size / 1024).toFixed(0).padStart(4)} KB  ${dur.toFixed(2)} s`);
  }
  if (!manifest.credits.some(c => c.name === 'Narrador')) manifest.credits.push({ name: 'Narrador', author: 'Voz generada con Gemini TTS (Google)', license: 'Generada para Pixelia', url: '' });
  writeFileSync(mpath, JSON.stringify(manifest, null, 1));
  const lpath = join(OUT, 'LICENSES.md'), voiceFiles = Object.values(manifest.files).filter(f => f.cat === 'voice').map(f => f.file);
  const lic = readFileSync(lpath, 'utf8').replace(/\n## Narrador\n[\s\S]*?(?=\n## |$)/, '').trimEnd();
  writeFileSync(lpath, lic + '\n\n' + NARRATOR_MD(voiceFiles));
  process.exit(0);
}
if (!SRC || !existsSync(SRC)) { console.error('Falta --src <carpeta de descargas>'); process.exit(1); }

/** Cadena de filtros de recorte y limpieza (sin la ganancia). */
function baseChain(e) {
  const f = [];
  if (e.cat !== 'amb') f.push('silenceremove=start_periods=1:start_threshold=-55dB:start_silence=0.004');
  if (e.trim) f.push(`atrim=start=${e.cat === 'amb' ? e.trim[0] : 0}:duration=${e.trim[1] + (e.loop || 0)}`, 'asetpts=PTS-STARTPTS');
  if (e.cat !== 'amb') f.push('afade=t=in:d=0.004');
  if (e.fadeOut && e.trim) f.push(`afade=t=out:st=${Math.max(0, e.trim[1] - e.fadeOut)}:d=${e.fadeOut}:curve=qsin`);
  return f;
}
const input = (e) => {
  const p = join(SRC, e.src);
  if (!existsSync(p)) throw new Error('no está ' + p);
  // en ambientes el recorte inicial va como -ss (más rápido); en sueltos se hace después del silenceremove
  return e.cat === 'amb' ? ['-ss', String(e.trim[0]), '-i', p] : (e.trim && e.trim[0] ? ['-ss', String(e.trim[0]), '-i', p] : ['-i', p]);
};

/** Pico (dBFS) después de la cadena base. */
function peakDb(e) {
  const chain = baseChain(e).map(s => s.startsWith('atrim=start=') ? s.replace(/start=[\d.]+/, 'start=0') : s);
  const r = ff([...input(e), '-af', [...chain, 'volumedetect'].join(','), '-f', 'null', '-']);
  const m = /max_volume:\s*(-?[\d.]+) dB/.exec(String(r.stderr));
  return m ? Number(m[1]) : 0;
}

/** Afinación medida con autocorrelación (YIN simplificado) sobre un tramo del medio. Devuelve nota MIDI con decimales. */
function detectNote(e) {
  const r = ff([...input(e), '-af', 'silenceremove=start_periods=1:start_threshold=-50dB', '-ss', '0.25', '-t', '0.6', '-ac', '1', '-ar', '22050', '-f', 'f32le', '-']);
  const b = r.stdout, x = new Float32Array(b.buffer, b.byteOffset, Math.floor(b.length / 4));
  const sr = 22050, minLag = Math.floor(sr / 1500), maxLag = Math.floor(sr / 45), W = Math.min(4096, x.length - maxLag - 1);
  if (W < 512) return null;
  const d = new Float32Array(maxLag + 1);
  for (let lag = 1; lag <= maxLag; lag++) { let s = 0; for (let i = 0; i < W; i++) { const v = x[i] - x[i + lag]; s += v * v; } d[lag] = s; }
  // diferencia normalizada acumulada
  let run = 0; const dn = new Float32Array(maxLag + 1); dn[0] = 1;
  for (let lag = 1; lag <= maxLag; lag++) { run += d[lag]; dn[lag] = d[lag] * lag / (run || 1); }
  let best = -1;
  for (let lag = minLag; lag <= maxLag; lag++) if (dn[lag] < 0.15) { while (lag + 1 <= maxLag && dn[lag + 1] < dn[lag]) lag++; best = lag; break; }
  if (best < 0) { let m = Infinity; for (let lag = minLag; lag <= maxLag; lag++) if (dn[lag] < m) { m = dn[lag]; best = lag; } }
  const a = dn[best - 1] ?? dn[best], c = dn[best + 1] ?? dn[best], den = a - 2 * dn[best] + c;
  const lag = best + (den ? (a - c) / (2 * den) : 0);
  return 69 + 12 * Math.log2(sr / lag / 440);
}

function encode(e, gainDb, outFile) {
  const ch = e.cat === 'amb' ? 2 : 1, br = e.cat === 'amb' ? '112k' : '96k';
  let filter;
  if (e.cat === 'amb') {
    const L = e.trim[1], X = e.loop;
    const pre = `[0:a]aresample=44100,aformat=channel_layouts=stereo,loudnorm=I=-20:TP=-2:LRA=9,atrim=duration=${L + X},asetpts=PTS-STARTPTS,asplit=3[a][b][c]`;
    filter = `${pre};[a]atrim=0:${X},asetpts=PTS-STARTPTS,afade=t=in:d=${X}:curve=qsin[h];` +
      `[b]atrim=${L}:${L + X},asetpts=PTS-STARTPTS,afade=t=out:d=${X}:curve=qsin[t];[h][t]amix=inputs=2:normalize=0[x];` +
      `[c]atrim=${X}:${L},asetpts=PTS-STARTPTS[m];[x][m]concat=n=2:v=0:a=1,alimiter=limit=0.89[out]`;
    ff([...input(e), '-filter_complex', filter, '-map', '[out]', '-ac', String(ch), '-ar', '44100', '-c:a', 'aac', '-b:a', br, '-movflags', '+faststart', outFile]);
  } else {
    const chain = baseChain(e).map(s => s.startsWith('atrim=start=') ? s.replace(/start=[\d.]+/, 'start=0') : s);
    chain.push(`volume=${gainDb.toFixed(2)}dB`, 'alimiter=limit=0.94');
    ff([...input(e), '-af', chain.join(','), '-ac', String(ch), '-ar', '44100', '-c:a', 'aac', '-b:a', br, '-movflags', '+faststart', outFile]);
  }
}

const list = SOURCES.filter(e => !ONLY || e.id.startsWith(ONLY) || e.inst === ONLY);
const prevPath = join(OUT, 'manifest.json');
const manifest = existsSync(prevPath) && ONLY ? JSON.parse(readFileSync(prevPath, 'utf8')) : { files: {}, instruments: {} };
// la voz del narrador la arma narrate.mjs (--voice): una pasada completa no la borra
if (!ONLY && existsSync(prevPath)) for (const [id, f] of Object.entries(JSON.parse(readFileSync(prevPath, 'utf8')).files)) if (f.cat === 'voice') manifest.files[id] = f;

// ganancia por instrumento: el pico más alto de sus notas queda en −1,5 dBFS (respeta la dinámica entre notas)
const peaks = new Map();
for (const e of list) if (e.cat !== 'amb') peaks.set(e.id, peakDb(e));
const groupMax = new Map();
for (const e of list) if (e.cat === 'inst') groupMax.set(e.inst, Math.max(groupMax.get(e.inst) ?? -99, peaks.get(e.id)));

let total = 0;
for (const e of list) {
  const rel = e.id.replace('/', '_').replace(/[^a-zA-Z0-9_]/g, '') + '.m4a';
  const sub = e.cat === 'inst' ? 'inst' : e.cat === 'amb' ? 'amb' : 'sfx';
  mkdirSync(join(OUT, sub), { recursive: true });
  const out = join(OUT, sub, rel);
  const gain = e.cat === 'inst' ? -1.5 - groupMax.get(e.inst) : e.cat === 'sfx' ? -3 - peaks.get(e.id) : 0;
  let note = e.note;
  if (e.cat === 'inst') {
    const det = detectNote(e);
    if (note == null) note = det != null ? Math.round(det * 10) / 10 : 60;
    else if (det != null && Math.abs(((det - note) % 12 + 18) % 12 - 6) > 0.6 && e.inst !== 'timp')
      console.warn(`  ! ${e.id}: se esperaba ${note} y suena ${det.toFixed(2)}`);
  }
  encode(e, gain, out);
  const dur = probeDur(out), size = statSync(out).size;
  total += size;
  manifest.files[e.id] = { file: `${sub}/${rel}`, cat: e.cat, dur: Math.round(dur * 1000) / 1000, ...(e.loop ? { loop: e.trim[1] } : {}), ...(e.inst ? { inst: e.inst, note } : {}), src: e.src0 };
  console.log(`  ${e.id.padEnd(22)} ${(size / 1024).toFixed(0).padStart(4)} KB  ${dur.toFixed(2)} s${note != null && e.cat === 'inst' ? '  nota ' + note : ''}`);
}
manifest.instruments = {};
for (const [id, f] of Object.entries(manifest.files)) if (f.inst) (manifest.instruments[f.inst] ||= []).push({ id, note: f.note });
for (const k in manifest.instruments) manifest.instruments[k].sort((a, b) => a.note - b.note);
manifest.version = 1;
const by = {};
for (const [id, f] of Object.entries(manifest.files)) (by[f.src] ||= []).push(id);
// créditos para el juego (Ajustes → Partida)
manifest.credits = Object.keys(by).filter(k => k !== 'gemini').map(k => { const o = ORIGINS[k] || {}; return { name: o.name || k, author: o.author || '?', license: o.license || '?', url: o.url || '' }; });
if (by.gemini) manifest.credits.push({ name: 'Narrador', author: 'Voz generada con Gemini TTS (Google)', license: 'Generada para Pixelia', url: '' });
writeFileSync(prevPath, JSON.stringify(manifest, null, 1));

// LICENSES.md
let md = '# Sonidos de Pixelia: origen y licencias\n\nTodo es de uso libre y sin regalías (CC0 1.0, dominio público). No hace falta atribución, pero ' +
  'los créditos del juego (Ajustes → Partida → Créditos) nombran a cada autor igual. Lo genera `tools/audio/prepare.mjs` ' +
  'a partir de `tools/audio/sources.mjs`; los archivos se recortaron, normalizaron y pasaron a AAC (.m4a).\n\n' +
  'De Freesound se usaron las vistas previas en MP3 (`-hq`, se bajan sin cuenta); la licencia CC0 es la misma que la del original.\n\n';
for (const [k, ids] of Object.entries(by)) {
  if (k === 'gemini') continue;
  const o = ORIGINS[k] || { name: k, author: '?', url: '', license: '?' };
  md += `## ${o.name}\n- Autor: ${o.author}\n- Licencia: ${o.license}\n- Fuente: ${o.url}${o.file && o.file !== o.url ? `\n- Descarga: ${o.file}` : ''}\n- Archivos: ${ids.map(i => '`' + manifest.files[i].file + '`').join(', ')}\n\n`;
}
if (by.gemini) md += NARRATOR_MD(by.gemini.map(i => manifest.files[i].file));
writeFileSync(join(OUT, 'LICENSES.md'), md);
console.log(`\n${list.length} archivos · ${(total / 1048576).toFixed(2)} MB`);
