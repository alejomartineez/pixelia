// Paisaje sonoro (PLAN-QUIEBRE §K4, DESIGN-AUDIO.md): camas continuas con fundido y emisores sueltos con
// probabilidad, intervalo al azar y variación de tono y volumen, ubicados en 3D alrededor de quien escucha. Lo maneja
// el perfil de ambiente (src/core/ambience.js): lugar, hora, clima y amenaza. Además, el trueno después del relámpago,
// los pasos según la superficie y los sonidos de las acciones (construir, cosechar, reparar).
import { PRIO } from './sampler.js';

// Camas por lugar (0..1). De día / de noche; el clima suma encima.
export const PLACE_BEDS = {
  city: { day: { wind: 0.22, sea: 0.18, town: 0.4, forest: 0.18 }, night: { wind: 0.2, sea: 0.2, town: 0.12, crickets: 0.4 } },
  'exp:cerca': { day: { wind: 0.3, forest: 0.45 }, night: { wind: 0.3, crickets: 0.45 } },
  'exp:medio': { day: { wind: 0.45, forest: 0.2 }, night: { wind: 0.42, crickets: 0.25 } },
  'exp:lejos': { day: { wind: 0.62, cave: 0.14 }, night: { wind: 0.55, cave: 0.18 } },
  mina: { day: { cave: 0.7, wind: 0.08 }, night: { cave: 0.7, wind: 0.08 } },
  faros: { day: { sea: 0.8, wind: 0.45 }, night: { sea: 0.8, wind: 0.5 } },
  bajo: { day: { cave: 0.8, fire: 0.35 }, night: { cave: 0.8, fire: 0.35 } },
  combat: { day: { wind: 0.35 }, night: { wind: 0.35, crickets: 0.15 } },
  silent: { day: {}, night: {} },
};
// El clima (WEATHER de ambience.js, incluidos los de las amenazas): suma o cambia camas.
export const WEATHER_BEDS = {
  lluvia: { rain: 0.55, town: -0.15 },
  tormenta: { rain: 1, wind: 0.4, town: -0.3, forest: -0.3, crickets: -0.4 },
  niebla: { wind: -0.1, forest: -0.1 },
  nieve: { wind: 0.12, forest: -0.2, crickets: -0.4 },
  ceniza: { wind: 0.2, fire: 0.12, forest: -0.3 },
  humo: { fire: 0.5, wind: 0.1 },
  helada: { wind: 0.1, crickets: -0.4 },
  sequia: { wind: 0.25, forest: -0.15 },
};
// Reverb por lugar (mixer.REVERBS)
export const PLACE_REVERB = { city: 'open', 'exp:cerca': 'open', 'exp:medio': 'open', 'exp:lejos': 'open', mina: 'mine', faros: 'open', bajo: 'under', combat: 'open' };

// Emisores: ids (round-robin), cada cuánto [min, max] s, prob (de sonar cuando toca), tono ± y volumen,
// when: 'day' | 'night' | undefined, places, weather (solo con ese clima), dist [min, max] (metros en 3D).
export const EMITTERS = [
  { id: 'birds', ids: ['sfx/birds1', 'sfx/birds2'], every: [6, 16], prob: 0.75, pitch: 0.12, gain: [0.35, 0.6], when: 'day', places: ['city', 'exp:cerca', 'exp:medio', 'faros'], dry: true, dist: [6, 20] },
  { id: 'owl', ids: ['sfx/owl'], every: [18, 40], prob: 0.6, pitch: 0.06, gain: [0.3, 0.45], when: 'night', places: ['city', 'exp:cerca', 'exp:medio', 'exp:lejos'], dist: [12, 30] },
  { id: 'anvil', ids: ['sfx/anvil1', 'sfx/anvil2'], every: [14, 32], prob: 0.7, pitch: 0.05, gain: [0.18, 0.3], when: 'day', places: ['city'], dist: [8, 16] },
  { id: 'drip', synth: 'drip', every: [2, 7], prob: 0.8, pitch: 0.3, gain: [0.25, 0.45], places: ['mina', 'bajo', 'exp:lejos'], dist: [3, 14] },
  { id: 'frost', synth: 'frost', every: [1.5, 4], prob: 0.7, pitch: 0.4, gain: [0.2, 0.35], weather: ['helada', 'nieve'], dist: [2, 10] },
  { id: 'rumble', synth: 'rumble', every: [10, 22], prob: 0.6, pitch: 0.2, gain: [0.3, 0.5], places: ['bajo'], dist: [10, 30] },
];

const SURFACE = {
  pasto: { filter: { type: 'lowpass', f: 1800 }, gain: 0.45, rate: 1 },
  piedra: { filter: { type: 'highpass', f: 320 }, gain: 0.55, rate: 1.12 },
  madera: { gain: 0.6, rate: 1 },
  arena: { filter: { type: 'lowpass', f: 1100 }, gain: 0.5, rate: 0.85, grit: true },
  agua: { filter: { type: 'lowpass', f: 900 }, gain: 0.4, rate: 0.8, splash: true },
  nieve: { filter: { type: 'lowpass', f: 900 }, gain: 0.45, rate: 0.9, grit: true },
};
export const SURFACES = Object.keys(SURFACE);
const STEPS = ['act/footstep00', 'act/footstep01', 'act/footstep02', 'act/footstep03', 'act/footstep04', 'act/footstep05'];
const BED_IDS = ['wind', 'sea', 'forest', 'crickets', 'rain', 'fire', 'cave', 'town'];

export function createSoundscape({ ac, mixer, sampler, synth, rng = Math.random }) {
  const beds = new Map();         // nombre → { gain, src, target }
  const next = new Map();         // emisor → próximo instante
  let cur = { place: 'silent', night: false, weather: 'despejado', population: 0.5, indoor: false };
  let hum = null;
  const rr = new Map(), failed = new Set();
  const stats = { emitted: 0, thunders: 0, steps: 0 };

  function bedTargets(s) {
    const prof = PLACE_BEDS[s.place] || PLACE_BEDS.silent;
    const t = { ...(s.night ? prof.night : prof.day) };
    for (const [k, v] of Object.entries(WEATHER_BEDS[s.weather] || {})) t[k] = Math.max(0, (t[k] || 0) + v);
    if (t.town != null && s.place === 'city') t.town *= 0.5 + 0.8 * Math.min(1, s.population ?? 0.5);   // crece con la población
    if (s.threat === 'crecida') t.sea = Math.max(t.sea || 0, 0.7);                                          // el agua que sube
    if (s.threat === 'incendio') t.fire = Math.max(t.fire || 0, 0.55);
    for (const k of Object.keys(t)) if (!(t[k] > 0.001)) delete t[k];
    return t;
  }
  function setBed(name, v, at, tc = 1.2) {
    let b = beds.get(name);
    if (!b && v > 0) {
      const id = 'amb/' + name;
      if (failed.has(id)) return;
      if (!sampler.has(id)) {
        // se pide una vez; si no carga (sin red, recarga a mitad de camino) la cama queda callada: sin reintentos en
        // cadena, que con una promesa ya rechazada trababan la página
        beds.set(name, { waiting: true, target: v });
        sampler.load([id]).then(() => {
          if (!beds.get(name)?.waiting) return;
          beds.delete(name);
          if (sampler.has(id)) setBed(name, bedTargets(cur)[name] || 0, ac.currentTime, 2); else failed.add(id);
        });
        return;
      }
      const g = ac.createGain(); g.gain.value = 0; g.connect(mixer.amb);
      const h = sampler.play(id, { loop: true, out: g, prio: PRIO.amb, gain: 1, offset: undefined });
      if (!h) { g.disconnect(); return; }
      b = { gain: g, h, target: 0 };
      beds.set(name, b);
    }
    if (!b || b.waiting) { if (b) b.target = v; return; }
    b.target = v;
    b.gain.gain.cancelScheduledValues(at);
    b.gain.gain.setTargetAtTime(v, at, tc);
    if (v <= 0) {
      const old = b;
      const stopAt = at + tc * 5;
      if (typeof setTimeout === 'function' && ac.constructor?.name !== 'OfflineAudioContext') setTimeout(() => { if (beds.get(name) === old && old.target <= 0) { old.h.stop(ac.currentTime, 0.1); old.gain.disconnect(); beds.delete(name); } }, (stopAt - ac.currentTime) * 1000);
    }
  }

  function apply(at = ac.currentTime, tc = 1.2) {
    const t = bedTargets(cur);
    for (const k of BED_IDS) if ((t[k] || 0) > 0 || beds.has(k)) setBed(k, t[k] || 0, at, tc);
    mixer.setReverb?.(PLACE_REVERB[cur.place] || 'open', at);
    // adentro (indoor) el afuera se escucha tapado; la tormenta desde adentro más todavía
    mixer.setMuffle?.(cur.indoor ? (cur.weather === 'tormenta' ? 0.6 : 0.45) : 0, at);
    // los faroles de noche zumban apenas (ciudad)
    const wantHum = cur.place === 'city' && cur.night;
    if (wantHum && !hum) { hum = synth.noiseBed({ out: mixer.amb, hum: 100, type: 'lowpass', f: 300, lfo: 0.2, depth: 0.15 }); hum.gain.gain.setTargetAtTime(0.012, at, 2); }
    else if (!wantHum && hum) { hum.stop(at); hum = null; }
  }

  function panner(dist) {
    const p = ac.createPanner();
    p.panningModel = 'equalpower'; p.distanceModel = 'inverse'; p.refDistance = 4; p.rolloffFactor = 0.9; p.maxDistance = 200;
    const a = rng() * Math.PI * 2, d = dist[0] + rng() * (dist[1] - dist[0]);
    const x = Math.cos(a) * d, z = Math.sin(a) * d, y = 1 + rng() * 3;
    if (p.positionX) { p.positionX.value = x; p.positionY.value = y; p.positionZ.value = z; } else p.setPosition(x, y, z);
    return p;
  }
  function emit(E, t) {
    const gain = E.gain[0] + rng() * (E.gain[1] - E.gain[0]);
    const rate = 1 + (rng() * 2 - 1) * (E.pitch || 0);
    if (E.synth) { synthEmit(E.synth, t, gain, rate, panner(E.dist || [4, 12])); stats.emitted++; return true; }
    const k = (rr.get(E.id) || 0) + 1; rr.set(E.id, k);
    const id = E.ids[k % E.ids.length];
    if (!sampler.has(id)) { sampler.load(E.ids); return false; }
    const h = sampler.play(id, { t, gain, rate, out: mixer.amb, prio: PRIO.amb, panner: E.dist ? panner(E.dist) : null });
    if (h) stats.emitted++;
    return !!h;
  }
  function synthEmit(kind, t, gain, rate, pan) {
    const g = ac.createGain(); g.gain.value = 0; g.connect(pan); pan.connect(mixer.amb);
    if (!mixer.claim(t, t + 1.5, PRIO.amb, () => {})) return;
    if (kind === 'drip') {
      const o = ac.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(1300 * rate, t); o.frequency.exponentialRampToValueAtTime(2600 * rate, t + 0.05);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.25 * gain, t + 0.004); g.gain.setTargetAtTime(0, t + 0.01, 0.03);
      o.connect(g); o.start(t); o.stop(t + 0.3);
    } else {
      const s = ac.createBufferSource(); s.buffer = synth.noise();
      const f = ac.createBiquadFilter();
      if (kind === 'frost') { f.type = 'highpass'; f.frequency.value = 3500 * rate; g.gain.setValueAtTime(0.18 * gain, t); g.gain.setTargetAtTime(0, t + 0.005, 0.012); s.playbackRate.value = 1.5; }
      else { f.type = 'lowpass'; f.frequency.value = 90 * rate; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(1.6 * gain, t + 0.4); g.gain.setTargetAtTime(0, t + 0.6, 0.35); }
      s.connect(f); f.connect(g); s.start(t, rng()); s.stop(t + 1.5);
    }
  }

  return {
    /** Lugar, hora y clima: { place, night, weather, population (0..1), threat, indoor }. Cambia con fundido. */
    set(s = {}, { now = false } = {}) {
      const prev = cur;
      cur = { ...cur, ...s };
      const changed = ['place', 'night', 'weather', 'population', 'threat', 'indoor'].some(k => prev[k] !== cur[k]);
      if (changed || now) apply(ac.currentTime, now ? 0.05 : 1.2);
      // emisores del lugar nuevo: el primero llega pronto, después según su intervalo
      if (prev.place !== cur.place || now) next.clear();
    },
    get state() { return { ...cur, beds: Object.fromEntries([...beds].map(([k, b]) => [k, Math.round((b.target || 0) * 100) / 100])) }; },
    /** Programa los emisores hasta `until`. */
    tick(until) {
      for (const E of EMITTERS) {
        const okPlace = !E.places || E.places.includes(cur.place);
        const okTime = !E.when || (E.when === 'night') === !!cur.night;
        const okWeather = !E.weather || E.weather.includes(cur.weather);
        const wet = E.dry && (cur.weather === 'lluvia' || cur.weather === 'tormenta');
        if (!okPlace || !okTime || !okWeather || wet) { next.delete(E.id); continue; }
        if (!next.has(E.id)) next.set(E.id, ac.currentTime + 1 + rng() * E.every[0]);
        let guard = 0;
        while (next.get(E.id) < until && guard++ < 16) {
          const t = Math.max(ac.currentTime, next.get(E.id));
          if (rng() < E.prob) emit(E, t);
          next.set(E.id, t + E.every[0] + rng() * (E.every[1] - E.every[0]));
        }
      }
    },
    /** Trueno: llega después del relámpago con un retraso según la distancia (y suena más lejano y más oscuro). */
    thunder({ distance } = {}) {
      const d = distance ?? 300 + rng() * 1700;               // metros
      const t = ac.currentTime + Math.max(0, d / 343 - 0.8);  // el relámpago ya se vio hace un ratito
      const far = Math.min(1, d / 2000);
      stats.thunders++;
      sampler.load(['sfx/thunder']);
      return !!sampler.play('sfx/thunder', { t, gain: 0.95 - far * 0.5, rate: 0.92 - far * 0.12 + rng() * 0.08, out: mixer.amb, prio: PRIO.sfx,
        filter: { type: 'lowpass', f: 4200 - far * 3300 } });
    },
    /** Paso según la superficie: pasto, piedra, madera, arena, agua, nieve. */
    step(surface = 'pasto', { gain = 1, pan = 0 } = {}) {
      const S = SURFACE[surface] || SURFACE.pasto;
      const k = (rr.get('step') || 0) + 1 + Math.floor(rng() * 2); rr.set('step', k);
      const id = STEPS[k % STEPS.length];
      if (!sampler.has(id)) sampler.load(STEPS);
      const h = sampler.play(id, { gain: S.gain * gain, rate: S.rate * (0.94 + rng() * 0.12), filter: S.filter, pan, prio: PRIO.sfx });
      if (S.grit) synth.burst({ d: 0.07, v: 0.04 * gain, hp: 2500 });
      if (S.splash) synth.burst({ d: 0.18, v: 0.07 * gain, lp: 1200 });
      stats.steps++;
      return !!h;
    },
    stop() { for (const k of [...beds.keys()]) setBed(k, 0, ac.currentTime, 0.5); if (hum) { hum.stop(); hum = null; } next.clear(); },
    stats,
  };
}
