// Banco de pruebas de audio en Chrome headless (lo usan tools/test-audio.mjs y tools/render-audio.mjs).
// Sirve el repo, abre una página en blanco y renderiza escenas con OfflineAudioContext usando el mismo motor del juego
// (src/audio/engine.js). Con suspend() del contexto offline avanza de a 1 s, como el temporizador en tiempo real,
// así se pueden cambiar el lugar, la intensidad o tirar stingers y truenos en medio del render.
import http from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.m4a': 'audio/mp4' };

export async function startHarness({ blank = true } = {}) {
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p === '/__blank') { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end('<!doctype html><meta charset="utf-8"><title>audio</title>'); return; }
    if (p.endsWith('/')) p += 'index.html';
    const f = join(ROOT, p);
    if (!f.startsWith(ROOT) || !existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); res.end('404'); return; }
    res.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(readFileSync(f));
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const BASE = `http://127.0.0.1:${server.address().port}/`;
  const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new',
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + (e.stack || e.message)));
  page.on('console', m => { if (m.type() === 'error' && !/supabase|Failed to load resource/i.test(m.text())) errors.push('CONSOLE.ERROR: ' + m.text()); });
  if (blank) await page.goto(BASE + '__blank', { waitUntil: 'load' });
  return { page, browser, BASE, errors, async close() { await browser.close(); server.close(); } };
}

/**
 * Renderiza una escena. spec = { dur, piece, scene, intensity, epic, seed, levels, events: [[t, kind, arg]], wav }
 * events: 'stinger' nombre · 'thunder' distancia · 'scene' {…} · 'intensity' x · 'piece' id · 'step' superficie · 'sfx' nombre
 * Devuelve estadísticas (pico, RMS, tramos en silencio, notas, voces) y, con wav, las muestras en Int16 (base64).
 */
export function renderScene(page, spec) {
  return page.evaluate(async (spec) => {
    const { createEngine } = await import('/src/audio/engine.js');
    const sr = spec.sr || 44100, dur = spec.dur || 30;
    const oac = new OfflineAudioContext(2, Math.ceil(sr * dur), sr);
    const eng = createEngine(oac, { base: '/assets/audio/', seed: spec.seed || 7, maxVoices: spec.maxVoices || 32 });
    eng.mixer.setLevels(spec.levels || { master: 0.7, music: 0.62, amb: 0.7, sfx: 0.8, ui: 0.6, voice: 0.9 });
    if (spec.samples !== false) { await eng.preload(); await eng.sampler.loadGroup('amb'); }
    eng.setScene(spec.scene || { place: 'city' }, { now: true, follow: false });
    if (spec.epic) eng.composer.setEpic(true);
    if (spec.piece !== null) eng.composer.play(spec.piece || 'city');
    if (spec.intensity != null) eng.composer.setIntensity(spec.intensity);
    const evs = (spec.events || []).slice().sort((a, b) => a[0] - b[0]);
    const log = [];
    const doEv = ([t, kind, arg]) => {
      if (kind === 'stinger') log.push([t, kind, eng.composer.stinger(arg, { t })]);
      else if (kind === 'thunder') log.push([t, kind, eng.soundscape.thunder({ distance: arg })]);
      else if (kind === 'scene') eng.setScene(arg);
      else if (kind === 'intensity') eng.composer.setIntensity(arg);
      else if (kind === 'piece') eng.composer.play(arg);
      else if (kind === 'step') log.push([t, kind, eng.soundscape.step(arg)]);
      else if (kind === 'sfx') log.push([t, kind, eng.sfx(arg)]);
      else if (kind === 'epic') eng.composer.setEpic(arg);
    };
    // avanza de a un segundo, como el temporizador del juego
    const stepS = 1;
    while (evs.length && evs[0][0] <= 0) doEv(evs.shift());
    eng.tick(stepS + 0.6);
    for (let t = stepS; t < dur; t += stepS) {
      oac.suspend(t).then(() => {
        while (evs.length && evs[0][0] <= t + 1e-6) doEv(evs.shift());
        eng.tick(Math.min(dur, t + stepS + 0.6));
        oac.resume();
      });
    }
    const buf = await oac.startRendering();
    const L = buf.getChannelData(0), R = buf.getChannelData(1);
    let peak = 0, sum = 0, silentWin = 0, wins = 0;
    const W = sr / 2;
    for (let i = 0; i < L.length; i += W) {
      let s = 0;
      for (let j = i; j < Math.min(L.length, i + W); j++) { const a = Math.abs(L[j]), b = Math.abs(R[j]); if (a > peak) peak = a; if (b > peak) peak = b; s += L[j] * L[j] + R[j] * R[j]; }
      sum += s; wins++;
      if (Math.sqrt(s / (2 * W)) < 1e-4) silentWin++;
    }
    const rms = Math.sqrt(sum / (2 * L.length));
    const out = { peak, peakDb: 20 * Math.log10(peak || 1e-9), rms, rmsDb: 20 * Math.log10(rms || 1e-9), silentFrac: silentWin / wins,
      music: eng.composer.state, stats: eng.composer.stats, scape: eng.soundscape.state, scapeStats: eng.soundscape.stats,
      voices: eng.mixer.voiceStats, loaded: eng.sampler.loaded, failed: eng.sampler.failed, reverb: eng.mixer.reverb, log };
    if (spec.wav) {
      const n = L.length, i16 = new Int16Array(n * 2);
      for (let i = 0; i < n; i++) { i16[2 * i] = Math.max(-1, Math.min(1, L[i])) * 32767; i16[2 * i + 1] = Math.max(-1, Math.min(1, R[i])) * 32767; }
      const u8 = new Uint8Array(i16.buffer);
      let bin = '';
      for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
      out.pcm = btoa(bin); out.sr = sr;
    }
    return out;
  }, spec);
}

/** WAV estéreo de 16 bits. */
export function wavBuffer(pcmB64, sr) {
  const data = Buffer.from(pcmB64, 'base64');
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8); h.write('fmt ', 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(2, 22); h.writeUInt32LE(sr, 24); h.writeUInt32LE(sr * 4, 28);
  h.writeUInt16LE(4, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

/** Las escenas que se escuchan (render-audio) y se prueban (test-audio). */
export const SCENES = {
  'ciudad-dia': { piece: 'city', scene: { place: 'city', light: 0.8, night: false, weather: 'despejado', population: 0.6 }, events: [[12, 'stinger', 'hallazgo'], [22, 'sfx', 'coin']] },
  'ciudad-noche': { piece: 'city', scene: { place: 'city', light: 0.8, night: true, weather: 'despejado', population: 0.6 } },
  'ciudad-tormenta': { piece: 'city', scene: { place: 'city', light: 0.5, night: false, weather: 'tormenta', population: 0.6 }, events: [[6, 'thunder', 500], [18, 'thunder', 1600]] },
  'expedicion-cerca': { piece: 'expedition', scene: { place: 'exp:cerca', light: 0.8, weather: 'despejado' }, events: [[4, 'step', 'pasto'], [4.3, 'step', 'pasto'], [9, 'step', 'piedra'], [9.3, 'step', 'piedra']] },
  'expedicion-lejos': { piece: 'expedition_far', scene: { place: 'exp:lejos', light: 0.8, weather: 'niebla' } },
  'combate': { piece: 'battle', scene: { place: 'combat', danger: 0.3 }, events: [[10, 'intensity', 0.6], [18, 'intensity', 0.95], [27, 'stinger', 'victoria']] },
  'epico': { piece: 'epic', epic: true, scene: { place: 'silent' } },
  'mina': { piece: 'mine', scene: { place: 'mina' } },
  'mi-casa': { piece: 'calm', scene: { place: 'home', indoor: true, weather: 'lluvia' } },
};
