// Prueba del sonido (PLAN-QUIEBRE §K, DESIGN-AUDIO.md), en Node y en Chrome headless (sin GPU).
//
//   node tools/test-audio.mjs
//
// Node: teoría (acordes, grados, alias de pistas), piezas, motivos y stingers bien formados, el manifest y los
// archivos (presupuesto, licencias CC0, créditos, LICENSES.md), y que assets/ entre al precache y al juego de PC.
// Chrome (OfflineAudioContext): 30 s de cada lugar sin silencio y con el pico debajo de 0 dBFS; todas las piezas
// programan notas (también con la síntesis de respaldo, sin muestras); capas por intensidad; la noche cambia la
// instrumentación; el límite de voces; stingers, trueno, pasos y loops. En el juego: el mezclador arranca con el primer
// clic, los buses siguen a Ajustes, la ciudad suena como ciudad y Mi Casa ya no está (paso 1c).
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { startHarness, renderScene, SCENES, ROOT } from './audio/harness.mjs';

let pass = 0, fail = 0;
const ok = (c, msg, extra) => { if (c) { pass++; console.log('  ✔', msg); } else { fail++; console.log('  ✘', msg, extra !== undefined ? JSON.stringify(extra) : ''); } };
const section = t => console.log('\n■', t);
const imp = (p) => import(pathToFileURL(join(ROOT, p)).href);

// =====================================================================
// Node
// =====================================================================
const C = await imp('src/audio/composer.js');
const P = await imp('src/audio/pieces.js');
const S = await imp('src/audio/soundscape.js');
const E = await imp('src/audio/engine.js');

section('Teoría y piezas');
{
  const city = P.PIECES.city;
  ok(JSON.stringify(C.chordOf(city, '1').tones) === JSON.stringify([55, 59, 62]), 'el I de la ciudad es Sol mayor (G B D)', C.chordOf(city, '1').tones);
  ok(JSON.stringify(C.chordOf(city, '6').tones) === JSON.stringify([64, 67, 71]), 'el vi es Mi menor');
  ok(JSON.stringify(C.chordOf(city, '5s4').tones) === '[62,67,69]', 'el 5s4 suspende la tercera (D G A)', C.chordOf(city, '5s4').tones);
  ok(C.chordOf(P.PIECES.calm, '17').tones.length === 4, 'el 17 suma la séptima');
  ok(C.degSemi('phrygian', 1) === 1 && C.degSemi('aeolian', 7) === 12 && C.degSemi('dorian', -1) === -2, 'los grados de cada modo (y bajo la tónica)');
  ok(C.resolvePiece('game') === 'calm' && C.resolvePiece('intro') === 'epic' && C.resolvePiece('nada') === null && C.resolvePiece(null) === null, 'los nombres viejos de pista caen en una pieza');
  const bad = [];
  const SAMPLED = ['piano', 'flute', 'pizz', 'timp', 'choir'], SYN = ['pad', 'sub', 'brush'];
  for (const [id, p] of Object.entries(P.PIECES)) {
    if (!P.MODES[p.mode]) bad.push(id + ': modo');
    if (!(p.meter === 3 || p.meter === 4)) bad.push(id + ': compás');
    for (const s of p.form) if (!p.sections[s]?.length) bad.push(id + ': sección ' + s);
    for (const sec of Object.values(p.sections)) for (const c of sec) if (!/^[1-7](7|s4|s2)?$/.test(c)) bad.push(id + ': acorde ' + c);
    for (const L of p.layers) {
      if (![...SAMPLED, ...SYN].includes(L.inst)) bad.push(id + ': inst ' + L.inst);
      if (L.pat && L.pat.length !== p.meter * 2) bad.push(`${id}: patrón ${L.role} de ${L.pat.length}`);
    }
    for (const m of p.motifs) if (!P.MOTIFS[m]) bad.push(id + ': motivo ' + m);
  }
  ok(!bad.length, `las ${Object.keys(P.PIECES).length} piezas están bien formadas`, bad);
  ok(['city', 'calm', 'expedition', 'expedition_far', 'threat', 'mine', 'coast', 'under', 'battle', 'epic'].every(k => P.PIECES[k]), 'hay pieza para cada lugar, el combate y el modo épico');
  ok(Object.values(P.MOTIFS).every(m => Math.abs(m.reduce((a, x) => a + x[1], 0) - 8) < 1e-9), 'los tres leitmotivs duran 8 pulsos');
  ok(P.MOTIFS.quiebre.some(x => x[2] === -1), 'El Quiebre cae a la segunda bemol');
  const need = ['hallazgo', 'pagina', 'elemento', 'rango', 'epoca', 'amenaza', 'victoria', 'derrota', 'nivel'];
  ok(need.every(k => P.STINGERS[k]?.notes.every(n => [...SAMPLED, 'pad'].includes(n[0]))), 'están los stingers del plan (hallazgo, página, elemento, rango, Época, amenaza, victoria, derrota, nivel)');
  ok(E.sceneIntensity({ place: 'city', light: 1 }) > E.sceneIntensity({ place: 'city', light: 0 }), 'la ciudad se enriquece cuando la isla se ilumina (J2)');
  ok(E.sceneIntensity({ place: 'exp:cerca' }) > E.sceneIntensity({ place: 'exp:lejos' }), 'afuera, más escasa cuanto más lejos');
  ok(E.sceneIntensity({ place: 'combat', danger: 1 }) > E.sceneIntensity({ place: 'combat', danger: 0 }) + 0.4, 'en combate sube con el peligro');
  ok(E.PLACE_PIECE['exp:lejos'] === 'expedition_far' && E.PLACE_PIECE.mina === 'mine' && E.PLACE_PIECE.bajo === 'under', 'cada lugar del ambiente tiene su pieza');
  const A = await imp('src/core/ambience.js');
  ok(Object.keys(A.PLACES).every(k => S.PLACE_BEDS[k]), 'cada lugar del ambiente (J1) tiene camas de sonido', Object.keys(A.PLACES).filter(k => !S.PLACE_BEDS[k]));
  ok(Object.keys(A.WEATHER).filter(k => k !== 'despejado' && k !== 'nublado').every(k => S.WEATHER_BEDS[k]), 'cada clima suena (lluvia, tormenta, niebla, nieve, ceniza, humo, helada, sequía)');
  ok(Object.values(E.SFX).every(d => d.fb || d.st), 'cada efecto tiene síntesis de respaldo o stinger');
}

section('Archivos, presupuesto y licencias');
const M = JSON.parse(readFileSync(join(ROOT, 'assets/audio/manifest.json'), 'utf8'));
{
  const files = Object.entries(M.files);
  const missing = files.filter(([, f]) => !existsSync(join(ROOT, 'assets/audio', f.file)));
  ok(files.length > 90 && !missing.length, `el manifest lista ${files.length} archivos y están todos`, missing.map(x => x[0]));
  ok(files.every(([, f]) => f.file.endsWith('.m4a')), 'todo es .m4a (AAC)');
  const size = (cat) => files.filter(([, f]) => f.cat === cat).reduce((a, [, f]) => a + statSync(join(ROOT, 'assets/audio', f.file)).size, 0) / 1048576;
  ok(size('inst') < 6, `instrumentos en ${size('inst').toFixed(2)} MB (≤ 6)`);
  ok(size('amb') < 10, `ambientes en ${size('amb').toFixed(2)} MB (≤ 10)`);
  ok(files.filter(([, f]) => f.loop).every(([, f]) => f.cat === 'amb' && f.loop > 10 && Math.abs(f.dur - f.loop) < 0.1), 'las camas tienen su loop marcado');
  ok(['piano', 'flute', 'pizz', 'timp', 'choir'].every(k => M.instruments[k]?.length), 'están los cinco instrumentos', Object.keys(M.instruments));
  const pn = M.instruments.piano.map(s => s.note);
  ok(pn.every((n, i) => !i || n - pn[i - 1] <= 5), 'el piano tiene una muestra cada pocos semitonos', pn);
  ok(M.credits.length >= 10 && M.credits.every(c => /CC0/.test(c.license) && c.author && c.author !== '?'), 'los créditos son todos CC0 y tienen autor', M.credits.length);
  const lic = readFileSync(join(ROOT, 'assets/audio/LICENSES.md'), 'utf8');
  ok(files.every(([, f]) => lic.includes(f.file)), 'LICENSES.md anota cada archivo con su origen');
  ok(!/sonniss/i.test(lic) && !/CC.BY|NC|ND/.test(lic.replace(/CC0/g, '')), 'no hay Sonniss ni licencias con atribución obligatoria, NC o ND');
  const sw = readFileSync(join(ROOT, 'sw.js'), 'utf8');
  ok(sw.includes('./assets/audio/manifest.json') && sw.includes('./assets/audio/inst/piano_C4.m4a'), 'assets/ entra al precache del service worker');
  ok(/'assets'/.test(readFileSync(join(ROOT, 'desktop/stage.mjs'), 'utf8')), 'assets/ entra al juego de PC (desktop/stage.mjs)');
}

// =====================================================================
// Chrome
// =====================================================================
const h = await startHarness();
try {
  section('30 s de cada lugar (OfflineAudioContext)');
  for (const [name, spec] of Object.entries(SCENES)) {
    const r = await renderScene(h.page, { ...spec, dur: 30 });
    ok(r.silentFrac < 0.05 && r.rmsDb > -45 && r.peak < 0.999 && r.failed === 0 && r.stats.notes > 15,
      `${name}: suena (RMS ${r.rmsDb.toFixed(1)} dB), el pico queda en ${r.peakDb.toFixed(1)} dBFS y programa ${r.stats.notes} notas`,
      { silent: r.silentFrac, peak: r.peak, failed: r.failed, loaded: r.loaded });
    if (name === 'ciudad-dia') {
      ok(r.loaded > 90, `se cargaron y decodificaron ${r.loaded} muestras .m4a`);
      ok(r.log.some(x => x[1] === 'stinger' && x[2]) && r.stats.stingers === 1, 'el stinger del hallazgo suena');
      ok(r.stats.rests > 0 && r.stats.phrases > 0, `la melodía respira (${r.stats.phrases} frases, ${r.stats.rests} respiros)`);
      ok(r.scape.beds.town > 0 && r.scape.beds.wind > 0 && r.reverb === 'open', 'en la ciudad: murmullo, viento y reverb abierta');
      ok(r.scapeStats.emitted > 0, `los emisores sueltos suenan (${r.scapeStats.emitted})`);
    }
    if (name === 'ciudad-noche') ok(r.music.layers.includes('melody:flute') && !r.music.layers.includes('arp:pizz') && r.scape.beds.crickets > 0 && r.music.bpm < P.PIECES.city.bpm,
      'de noche: flauta en vez de piano, sin pizzicato, más lenta y con grillos', r.music);
    if (name === 'ciudad-tormenta') ok(r.scape.beds.rain >= 1 && r.scape.beds.wind > 0.5 && r.scapeStats.thunders === 2 && r.log.every(x => x[2]), 'la tormenta trae lluvia fuerte, viento y truenos', r.scape.beds);
    if (name === 'expedicion-cerca') ok(r.scapeStats.steps === 4 && r.log.every(x => x[2]), 'los pasos suenan según la superficie');
    if (name === 'combate') ok(r.music.layers.includes('choir:choir') && r.music.layers.includes('perc:brush'), 'en combate, con el peligro alto, entran la escobilla y el coro', r.music.layers);
    if (name === 'epico') ok(r.music.epic && r.reverb === 'hall' && r.stats.motifs > 0, `el modo épico usa sala, coro y cita El Quiebre (${r.stats.motifs} motivos)`, r.music);
    if (name === 'mina') ok(r.reverb === 'mine' && r.scape.beds.cave > 0.5, 'la mina tiene reverb de mina y zumbido de cueva');
    if (name === 'tranquila') ok(r.reverb === 'interior' && r.scape.beds.rain > 0 && !r.scape.beds.fire, 'pantalla tranquila: reverb de interior, la lluvia afuera y sin el fuego de Mi Casa', { reverb: r.reverb, beds: r.scape.beds });
  }

  section('Compositor');
  {
    const bad = [];
    for (const id of Object.keys(P.PIECES)) {
      const r = await renderScene(h.page, { piece: id, dur: 12, samples: false, scene: { place: 'silent' } });
      if (!(r.stats.notes > 8 && r.rmsDb > -55 && r.peak < 0.999)) bad.push([id, r.stats.notes, r.rmsDb.toFixed(1)]);
    }
    ok(!bad.length, 'todas las piezas suenan también sin muestras (síntesis de respaldo)', bad);
    const lo = await renderScene(h.page, { piece: 'battle', dur: 8, intensity: 0.05, scene: { place: 'silent' } });
    const hi = await renderScene(h.page, { piece: 'battle', dur: 8, intensity: 1, scene: { place: 'silent' } });
    ok(lo.music.layers.length <= 2 && hi.music.layers.length >= 7 && hi.stats.notes > lo.stats.notes * 1.5, `la intensidad suma capas (${lo.music.layers.length} → ${hi.music.layers.length})`, [lo.music.layers, hi.music.layers]);
    const sw = await renderScene(h.page, { piece: 'expedition', dur: 14, scene: { place: 'exp:cerca' }, events: [[6, 'scene', { place: 'exp:lejos' }]] });
    ok(sw.music.piece === 'expedition_far' && sw.scape.beds.wind > 0.5, 'al alejarse, la expedición cambia de pieza en el compás y sube el viento', sw.music);
    const v = await renderScene(h.page, { piece: 'battle', dur: 10, intensity: 1, maxVoices: 8, scene: { place: 'silent' } });
    ok(v.voices.peak <= 8 && (v.voices.stolen + v.voices.rejected) > 0, `el límite de voces se respeta (pico ${v.voices.peak} de 8; ${v.voices.stolen} cortadas, ${v.voices.rejected} sin lugar)`);
    const v32 = await renderScene(h.page, { ...SCENES.combate, dur: 30 });
    ok(v32.voices.peak <= 32, `con 32 voces, el combate no pasa el límite (pico ${v32.voices.peak})`);
    const st = await renderScene(h.page, { piece: 'city', dur: 10, scene: { place: 'city' }, events: Object.keys(P.STINGERS).map((k, i) => [1 + i * 0.5, 'stinger', k]) });
    ok(st.log.every(x => x[2]) && st.stats.stingers === Object.keys(P.STINGERS).length && st.peak < 0.999, `los ${Object.keys(P.STINGERS).length} stingers suenan juntos sin saturar (pico ${st.peakDb.toFixed(1)} dBFS)`);
    const fx = await renderScene(h.page, { piece: null, dur: 6, scene: { place: 'silent' }, events: Object.keys(E.SFX).map((k, i) => [0.5 + i * 0.15, 'sfx', k]) });
    ok(fx.log.every(x => x[2]) && fx.rmsDb > -60 && fx.peak < 0.999, `los ${Object.keys(E.SFX).length} efectos con nombre suenan`);
    const loops = await h.page.evaluate(async () => {
      const { createEngine } = await import('/src/audio/engine.js');
      const oac = new OfflineAudioContext(2, 44100, 44100);
      const e = createEngine(oac, { base: '/assets/audio/' });
      await e.sampler.loadGroup('amb');
      return e.sampler.ids('amb/').map(id => ({ id, l: e.sampler.loopOf(id), want: e.sampler.manifest.files[id].loop }));
    });
    ok(loops.length === 8 && loops.every(x => x.l && x.l.start < 0.08 && Math.abs((x.l.end - x.l.start) - x.want) < 0.02), 'las camas hacen loop justo donde lo armó prepare.mjs (sin el relleno del AAC)', loops);
  }
    const noNet = await h.page.evaluate(async () => {
      const { createEngine } = await import('/src/audio/engine.js');
      const ac = new AudioContext();
      let calls = 0;
      const real = (u) => fetch(u);
      const e = createEngine(ac, { base: '/assets/audio/', fetcher: (u) => { if (u.includes('/amb_')) { calls++; return Promise.reject(new Error('sin red')); } return real(u); } });
      e.setScene({ place: 'city', weather: 'tormenta' }, { now: true });
      const t0 = performance.now();
      await new Promise(r => setTimeout(r, 600));
      const late = performance.now() - t0;
      e.setScene({ place: 'exp:lejos' });
      await new Promise(r => setTimeout(r, 300));
      await ac.close();
      return { calls, late };
    });
    ok(noNet.calls <= 8 && noNet.late < 2000, `si una cama no carga no se reintenta en cadena (${noNet.calls} pedidos; la página sigue respondiendo)`, noNet);
  if (h.errors.length) ok(false, 'sin errores en la página del banco', h.errors.slice(0, 5));

  // ------------------------------------------------------------------
  section('En el juego');
  {
    const page = await h.browser.newPage();
    page.on('pageerror', e => h.errors.push('PAGEERROR: ' + (e.stack || e.message)));
    page.on('console', m => { if (m.type() === 'error' && !/supabase|Failed to load resource/i.test(m.text())) h.errors.push('CONSOLE.ERROR: ' + m.text()); });
    await page.setRequestInterception(true);
    page.on('request', r => (/supabase\.co/.test(r.url()) ? r.abort() : r.continue()));
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const waitFor = async (code, ms = 20000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (await page.evaluate(code)) return true; } catch {} await sleep(150); } return false; };
    const dbg = () => page.evaluate(async () => (await import('/src/core/audio.js')).audio.debug());
    await page.goto(`${h.BASE}?scene=city&nosplash&nosw&reset&cheat=5&weather=despejado&hour=12`, { waitUntil: 'load' });
    ok(await waitFor(`window.__pixelia?.ctx.router.current === 'city'`, 30000), 'la ciudad abre');
    await page.mouse.click(5, 5);
    ok(await waitFor(`import('/src/core/audio.js').then(m => m.audio.debug().ctx === 'running')`, 8000), 'el mezclador arranca con el primer clic');
    await sleep(2500);
    let d = await dbg();
    ok(d.music.piece === 'city' && d.music.notes > 0, 'suena la pieza de la ciudad', d.music);
    ok(d.scene.place === 'city' && !d.scene.night && d.scape.beds.town > 0, 'el paisaje sonoro sigue al ambiente de la ciudad', d.scape);
    ok(Math.abs(d.levels.music - 0.62) < 0.02 && Math.abs(d.levels.amb - 0.7) < 0.02 && d.levels.voice > 0, 'los buses arrancan con los volúmenes de Ajustes', d.levels);
    await page.evaluate(() => window.__pixelia.ctx.setSetting({ volMusic: 0, volAmb: 0.3, volVoice: 0.5 }));
    await sleep(400);
    d = await dbg();
    ok(d.levels.music < 0.005 && Math.abs(d.levels.amb - 0.35) < 0.02 && Math.abs(d.levels.voice - 0.45) < 0.02, 'cambiar Ajustes mueve los buses en vivo (música, ambiente y voces)', d.levels);
    await page.evaluate(() => window.__pixelia.ctx.setSetting({ volMusic: 0.7, volAmb: 0.6, volVoice: 1 }));
    const s0 = d.music.notes;
    await page.evaluate(() => { window.__pixelia.bus.emit('story:page', { id: 'x' }); });
    await sleep(300);
    d = await dbg();
    ok(d.music.notes > s0, 'una página del diario tira su stinger');
    await page.evaluate(() => window.__pixelia.bus.emit('ambience:night', { place: 'city', night: true }));
    await sleep(200);
    d = await dbg();
    ok(d.scene.night === true && d.music.night === true, 'al anochecer cambia la música y el paisaje');
    await page.evaluate(() => { window.__pixelia.ctx.openPanel('settings', { tab: 'sound' }); });
    const panel = await waitFor(`document.body.innerText.includes('Voces')`, 6000);
    await page.keyboard.press('Escape');
    ok(panel, 'Ajustes → Sonido tiene la fila Voces');
    ok(await page.evaluate(() => { const s = window.__pixelia.store.state; return !s.home && !s.city.buildings.some(b => b.id === 'mi_casa'); }), 'sin Mi Casa: ni estado ni edificio');
    const cr = await page.evaluate(async () => (await import('/src/core/audio.js')).audio.credits());
    ok(cr.length >= 10, 'los créditos de los sonidos se leen para Ajustes → Partida');
    const errs = h.errors.filter(e => !/AudioContext was not allowed/i.test(e));
    ok(!errs.length, 'sin errores en la página', errs.slice(0, 5));
  }
} finally { await h.close(); }

console.log(`\n${pass} ✔ · ${fail} ✘`);
process.exit(fail ? 1 : 0);
