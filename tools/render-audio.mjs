// Deja fragmentos .wav para escuchar la música y el ambiente (PLAN-QUIEBRE §K7) en shots/audio/.
//
//   node tools/render-audio.mjs [--dur 30] [--only ciudad-dia,combate]
//
// Usa el mismo motor del juego con OfflineAudioContext en Chrome headless (no carga la GPU).
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { startHarness, renderScene, wavBuffer, SCENES, ROOT } from './audio/harness.mjs';

const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const DUR = Number(arg('--dur') || 30);
const ONLY = arg('--only')?.split(',');
const OUT = join(ROOT, 'shots/audio');
mkdirSync(OUT, { recursive: true });

const h = await startHarness();
try {
  for (const [name, spec] of Object.entries(SCENES)) {
    if (ONLY && !ONLY.includes(name)) continue;
    const t0 = Date.now();
    const r = await renderScene(h.page, { ...spec, dur: DUR, wav: true });
    writeFileSync(join(OUT, name + '.wav'), wavBuffer(r.pcm, r.sr));
    console.log(`  ${name.padEnd(18)} pico ${r.peakDb.toFixed(1)} dBFS · RMS ${r.rmsDb.toFixed(1)} dB · ${r.stats.notes} notas · capas ${r.music.layers?.join(' ') || '-'} · camas ${JSON.stringify(r.scape.beds)} · ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  }
  if (h.errors.length) console.log(h.errors.join('\n'));
  console.log(`\nListo: ${OUT}`);
} finally { await h.close(); }
