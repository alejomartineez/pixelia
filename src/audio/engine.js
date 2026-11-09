// Motor de audio (DESIGN-AUDIO.md): junta mezclador, sampler, síntesis, compositor y paisaje sonoro sobre un
// AudioContext (el juego) o un OfflineAudioContext (tools/test-audio.mjs y tools/render-audio.mjs).
// La fachada del juego es src/core/audio.js; acá vive lo que no depende de la página.
import { createMixer } from './mixer.js';
import { createSampler, PRIO } from './sampler.js';
import { createSynth } from './synth.js';
import { createComposer, makeRng } from './composer.js';
import { createSoundscape, PLACE_REVERB } from './soundscape.js';

// Efectos con nombre (los de siempre: audio.sfx('tap')): muestras (round-robin entre ids), un stinger chico, y la
// síntesis de antes como respaldo mientras las muestras cargan.
const N = (semi) => 440 * Math.pow(2, (semi - 9) / 12);
export const SFX = {
  tap: { ui: 1, s: [[['ui/click1', 'ui/kclick3'], 0.45]], fb: (y) => y.tone({ f: 880, d: 0.05, v: 0.15 }) },
  open: { ui: 1, s: [[['ui/open1'], 0.5], [['act/bookOpen'], 0.25]], fb: (y) => y.tone({ f: 520, f2: 780, d: 0.09, v: 0.12, type: 'triangle' }) },
  close: { ui: 1, s: [[['ui/close1'], 0.5]], fb: (y) => y.tone({ f: 700, f2: 450, d: 0.08, v: 0.1, type: 'triangle' }) },
  select: { ui: 1, s: [[['ui/select1', 'ui/select2'], 0.4]], fb: (y) => y.tone({ f: 740, d: 0.06, v: 0.14, type: 'triangle' }) },
  swoosh: { ui: 1, s: [[['act/cloth1', 'act/cloth3'], 0.4]], fb: (y) => y.burst({ d: 0.18, v: 0.15, hp: 1500 }) },
  coin: { s: [[['act/handleCoins2', 'act/handleCoins'], 0.55]], fb: (y) => { y.tone({ f: 988, d: 0.07, v: 0.2 }); y.tone({ f: 1319, t: 0.06, d: 0.16, v: 0.2 }); } },
  gem: { st: 'gema', fb: (y) => [0, 4, 7, 12].forEach((s, i) => y.tone({ f: N(24 + s), t: i * 0.05, d: 0.15, v: 0.16, type: 'triangle' })) },
  build: { s: [[['act/chop'], 0.55], [['sfx/anvil1', 'sfx/anvil2'], 0.35, 1, 0.14]], fb: (y) => { y.burst({ d: 0.08, v: 0.25, hp: 300 }); y.tone({ f: 220, d: 0.1, v: 0.2, t: 0.05 }); } },
  place: { s: [[['ui/drop2'], 0.5], [['act/dropLeather'], 0.4]], fb: (y) => y.tone({ f: 330, f2: 660, d: 0.12, v: 0.2, type: 'triangle' }) },
  done: { st: 'hecho', fb: (y) => [0, 4, 7].forEach((s, i) => y.tone({ f: N(12 + s), t: i * 0.08, d: 0.18, v: 0.2 })) },
  levelup: { st: 'nivel', fb: (y) => [0, 4, 7, 12].forEach((s, i) => y.tone({ f: N(12 + s), t: i * 0.09, d: 0.2, v: 0.2, type: 'triangle' })) },
  error: { s: [[['ui/error4'], 0.5]], fb: (y) => y.tone({ f: 200, f2: 140, d: 0.18, v: 0.2, type: 'sawtooth' }) },
  match: { s: [[['ui/pluck1'], 0.5]], fb: (y) => y.tone({ f: 660, f2: 990, d: 0.1, v: 0.18, type: 'triangle' }) },
  combo: { s: [[['ui/pluck1'], 0.5, 1.2]], fb: (y) => y.tone({ f: 660, f2: 990, d: 0.1, v: 0.18, type: 'triangle' }) },
  pop: { s: [[['ui/pluck1'], 0.5]], fb: (y) => y.tone({ f: 600, f2: 1200, d: 0.06, v: 0.18, type: 'sine' }) },
  clear: { s: [[['ui/glass1'], 0.45]], fb: (y) => y.burst({ d: 0.25, v: 0.18, hp: 2000 }) },
  star: { st: 'estrella', fb: (y) => { y.tone({ f: 1046, d: 0.1, v: 0.18 }); y.tone({ f: 1568, t: 0.08, d: 0.2, v: 0.18, type: 'triangle' }); } },
  win: { st: 'logro', fb: (y) => [0, 4, 7, 12, 16].forEach((s, i) => y.tone({ f: N(12 + s), t: i * 0.07, d: 0.25, v: 0.18 })) },
  lose: { st: 'tropiezo', fb: (y) => [7, 4, 0, -5].forEach((s, i) => y.tone({ f: N(12 + s), t: i * 0.15, d: 0.25, v: 0.18, type: 'triangle' })) },
  horn: { st: 'amenaza', fb: (y) => { y.tone({ f: 392, d: 0.18, v: 0.18, type: 'square' }); y.tone({ f: 494, d: 0.18, v: 0.12, type: 'square' }); } },
  crash: { s: [[['act/metalPot1'], 0.6], [['act/dropLeather'], 0.5]], fb: (y) => y.burst({ d: 0.3, v: 0.35, hp: 200 }) },
  bump: { s: [[['act/dropLeather'], 0.5]], fb: (y) => y.burst({ d: 0.08, v: 0.2, hp: 400 }) },
  buy: { s: [[['act/handleCoins'], 0.5], [['ui/confirmation2'], 0.3, 1, 0.08]], fb: (y) => { y.tone({ f: 784, d: 0.08, v: 0.18 }); y.tone({ f: 1175, t: 0.07, d: 0.08, v: 0.18 }); } },
  // acciones (J5): cosechar, reparar, la página del diario
  harvest: { s: [[['act/chop'], 0.4], [['act/cloth3'], 0.3, 1.1, 0.06]], fb: (y) => y.burst({ d: 0.1, v: 0.15, lp: 1500 }) },
  repair: { s: [[['sfx/anvil1', 'sfx/anvil2'], 0.4], [['act/metalClick'], 0.35, 1, 0.2]], fb: (y) => y.tone({ f: 300, d: 0.1, v: 0.2 }) },
  page: { s: [[['act/bookFlip1', 'act/bookFlip2'], 0.55]], fb: (y) => y.burst({ d: 0.2, v: 0.12, hp: 2500 }) },
  door: { s: [[['act/doorOpen1'], 0.45]], fb: (y) => y.burst({ d: 0.2, v: 0.12, lp: 600 }) },
  // un eco de noche aparece en el borde: vidrio bajo y lento, dos veces, como algo que se recuerda
  echo: { s: [[['ui/glass1'], 0.22, 0.5], [['ui/glass1'], 0.14, 0.67, 0.45]], fb: (y) => { y.tone({ f: 523, d: 0.6, v: 0.07, type: 'sine', attack: 0.08 }); y.tone({ f: 784, t: 0.45, d: 0.7, v: 0.05, type: 'sine', attack: 0.1 }); } },
};
export const UI_SFX = new Set(Object.entries(SFX).filter(([, d]) => d.ui).map(([k]) => k));
const SFX_IDS = [...new Set(Object.values(SFX).flatMap(d => (d.s || []).flatMap(x => x[0])))];

/** Intensidad musical según el lugar (J2: la ciudad se enriquece con la luz; afuera, más escasa cuanto más lejos). */
export function sceneIntensity({ place = 'city', light = 1, night = false, danger = 0 } = {}) {
  const base = {
    city: 0.2 + 0.55 * light, 'exp:cerca': 0.5, 'exp:medio': 0.38, 'exp:lejos': 0.26, mina: 0.35, faros: 0.4, bajo: 0.4,
    home: 0.35, combat: 0.35 + 0.6 * danger, threat: 0.45 + 0.5 * danger,
  }[place] ?? 0.4;
  return Math.max(0, Math.min(1, base - (night && place !== 'combat' ? 0.1 : 0)));
}
// pieza según el lugar (PLACES[...].music de ambience.js, con los nombres del compositor)
export const PLACE_PIECE = { city: 'city', 'exp:cerca': 'expedition', 'exp:medio': 'expedition', 'exp:lejos': 'expedition_far', mina: 'mine', faros: 'coast', bajo: 'under', home: 'calm', combat: 'battle' };

export function createEngine(ac, { base = 'assets/audio/', fetcher, seed = 7, maxVoices = 32 } = {}) {
  const mixer = createMixer(ac, { maxVoices });
  const sampler = createSampler(ac, mixer, { base, ...(fetcher ? { fetcher } : {}) });
  const synth = createSynth(ac, mixer);
  const composer = createComposer({ ac, mixer, sampler, synth, seed });
  const soundscape = createSoundscape({ ac, mixer, sampler, synth, rng: makeRng(seed * 31 + 3) });
  const rr = new Map();
  let scene = { place: 'city', light: 1, night: false, weather: 'despejado' };

  function sfx(name, arg) {
    const d = SFX[name];
    if (!d) return false;
    const out = d.ui ? mixer.ui : mixer.sfx;
    if (d.st && sampler.ready('piano')) return composer.stinger(d.st);
    let played = false;
    for (const [ids, gain, rate = 1, delay = 0] of d.s || []) {
      const k = (rr.get(name) || 0) + 1; rr.set(name, k);
      const id = ids[k % ids.length];
      const r = name === 'combo' ? rate * (1 + Math.min(6, arg || 1) * 0.06) : rate;
      if (sampler.play(id, { t: ac.currentTime + delay, gain, rate: r * (0.97 + Math.random() * 0.06), out, prio: d.ui ? PRIO.ui : PRIO.sfx })) played = true;
    }
    if (!played) {
      const y = { tone: (o) => synth.tone({ ...o, out }), burst: (o) => synth.burst({ ...o, out }) };
      d.fb?.(y, arg);
    }
    return true;
  }

  return {
    ac, mixer, sampler, synth, composer, soundscape, sfx,
    /** Carga lo esencial (interfaz, efectos e instrumentos) sin bloquear. */
    async preload(groups = ['ui', 'sfx', 'act', 'inst']) {
      await sampler.loadManifest();
      await sampler.load(SFX_IDS);
      for (const g of groups) await sampler.loadGroup(g);
    },
    /**
     * El lugar de ahora (lo llaman city-ambience, exp-ambience, home, combate): { place, light, night, weather, threat,
     * population, indoor, danger }. Mueve el paisaje sonoro, la reverb, la intensidad y, si la pieza sigue al lugar,
     * la pieza.
     */
    setScene(s = {}, { now = false, follow = true } = {}) {
      scene = { ...scene, ...s };
      soundscape.set({ place: scene.place, night: !!scene.night, weather: scene.weather || 'despejado', threat: scene.threat || null,
        population: scene.population ?? 0.5, indoor: !!scene.indoor }, { now });
      composer.setNight(!!scene.night);
      composer.setIntensity(scene.intensity ?? sceneIntensity(scene));
      const piece = composer.state.piece;
      // la expedición cambia de pieza al alejarse (cerca → lejos) y vuelve al acercarse
      if (follow && piece && PLACE_PIECE[scene.place] && ['expedition', 'expedition_far'].includes(piece) && ['expedition', 'expedition_far'].includes(PLACE_PIECE[scene.place]))
        composer.play(PLACE_PIECE[scene.place]);
      mixer.setReverb(composer.state.epic ? 'hall' : PLACE_REVERB[scene.place] || 'open');
    },
    get scene() { return { ...scene }; },
    /** Programa música y emisores hasta `until` (tiempo real: el temporizador; offline: una vez hasta el final). */
    tick(until) { composer.tick(until); soundscape.tick(until); },
  };
}
