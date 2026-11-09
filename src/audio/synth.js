// Voces sintetizadas (la parte "en código" de la música híbrida, DESIGN-AUDIO.md): el colchón de cuerdas, el bajo
// profundo, el coro de respaldo con formantes y los golpes graves. También son el respaldo de los instrumentos mientras
// las muestras cargan (o si no cargan), así nunca hay silencio por un archivo que falta.
import { PRIO } from './sampler.js';

export const mtof = (n) => 440 * Math.pow(2, (n - 69) / 12);

export function createSynth(ac, mixer) {
  let noiseBuf = null;
  const noise = () => {
    if (noiseBuf) return noiseBuf;
    const len = ac.sampleRate * 2, b = ac.createBuffer(1, len, ac.sampleRate), d = b.getChannelData(0);
    let s = 12345;
    for (let i = 0; i < len; i++) { s = (s * 1103515245 + 12345) >>> 0; d[i] = (s / 2147483648) - 1; }
    return (noiseBuf = b);
  };

  /** Envolvente con ataque, sostén y cola; registra la voz. Devuelve el GainNode o null si no hay lugar. */
  function env(t, dur, peak, attack, release, prio) {
    const g = ac.createGain();
    const end = t + dur + release;
    if (!mixer.claim(t, end, prio, (w) => { g.gain.cancelScheduledValues(w); g.gain.setTargetAtTime(0, w, 0.01); })) return null;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.setValueAtTime(peak, t + Math.max(attack, dur));
    g.gain.setTargetAtTime(0, t + Math.max(attack, dur), release / 4);
    return { g, end };
  }
  function osc(type, f, t, end, out, detune = 0) {
    const o = ac.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = detune;
    o.connect(out); o.start(t); o.stop(end + 0.05);
    return o;
  }

  const voices = {
    /** Cuerdas sintéticas: dos sierras desafinadas con pasabajos que respira. */
    pad(n, t, dur, { vel = 0.6, out, attack = 0.8, release = 1.2, bright = 1 } = {}) {
      const e = env(t, dur, 0.06 * vel, attack, release, PRIO.music); if (!e) return;
      const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 0.6;
      f.frequency.setValueAtTime(500 * bright, t); f.frequency.linearRampToValueAtTime(1300 * bright, t + attack + dur * 0.5);
      f.connect(e.g); e.g.connect(out || mixer.music);
      osc('sawtooth', mtof(n), t, e.end, f, -7); osc('sawtooth', mtof(n), t, e.end, f, 7);
    },
    /** Bajo profundo (sostiene al bajo de piano o de pizzicato). */
    sub(n, t, dur, { vel = 0.6, out, release = 0.4 } = {}) {
      const e = env(t, dur, 0.18 * vel, 0.02, release, PRIO.music); if (!e) return;
      e.g.connect(out || mixer.music); osc('sine', mtof(n), t, e.end, e.g);
    },
    /** Respaldo del piano y del pizzicato: triángulo con caída rápida. */
    pluck(n, t, dur, { vel = 0.6, out, release = 0.5 } = {}) {
      const e = env(t, Math.min(dur, 0.25), 0.11 * vel, 0.004, release, PRIO.music); if (!e) return;
      e.g.connect(out || mixer.music); osc('triangle', mtof(n), t, e.end, e.g); osc('sine', mtof(n + 12), t, e.end, e.g);
    },
    /** Respaldo de la flauta: seno con un poco de soplo. */
    breath(n, t, dur, { vel = 0.6, out, attack = 0.08, release = 0.3 } = {}) {
      const e = env(t, dur, 0.08 * vel, attack, release, PRIO.music); if (!e) return;
      e.g.connect(out || mixer.music);
      const o = osc('sine', mtof(n), t, e.end, e.g);
      const lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = 5; lg.gain.value = 4;
      lfo.connect(lg); lg.connect(o.detune); lfo.start(t); lfo.stop(e.end + 0.05);
    },
    /** Coro "aah" con formantes (respaldo del coro grabado y voces de relleno en el épico). */
    choir(n, t, dur, { vel = 0.6, out, attack = 1.2, release = 1.6 } = {}) {
      const e = env(t, dur, 0.05 * vel, attack, release, PRIO.music); if (!e) return;
      e.g.connect(out || mixer.music);
      for (const [fq, q, gv] of [[700, 6, 1], [1150, 8, 0.6], [2600, 10, 0.25]]) {
        const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = fq; bp.Q.value = q;
        const gg = ac.createGain(); gg.gain.value = gv; bp.connect(gg); gg.connect(e.g);
        osc('sawtooth', mtof(n), t, e.end, bp, -5); osc('sawtooth', mtof(n), t, e.end, bp, 6);
      }
    },
    /** Golpe grave (respaldo del timbal). */
    drum(n, t, dur, { vel = 0.7, out } = {}) {
      const e = env(t, 0.05, 0.5 * vel, 0.003, 0.6, PRIO.music); if (!e) return;
      e.g.connect(out || mixer.music);
      const o = ac.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(mtof(n) * 1.6, t); o.frequency.exponentialRampToValueAtTime(mtof(n), t + 0.12);
      o.connect(e.g); o.start(t); o.stop(e.end + 0.05);
    },
    /** Escobilla: ruido corto y agudo. */
    brush(n, t, dur, { vel = 0.5, out } = {}) {
      const e = env(t, 0.02, 0.05 * vel, 0.002, 0.08, PRIO.music); if (!e) return;
      const s = ac.createBufferSource(); s.buffer = noise();
      const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 6000;
      s.connect(hp); hp.connect(e.g); e.g.connect(out || mixer.music);
      s.start(t, Math.random() * 1.5); s.stop(e.end + 0.02);
    },
  };

  /** Tono suelto para efectos (lo de antes de src/core/audio.js). */
  function tone({ f = 440, f2, t = 0, d = 0.12, type = 'square', v = 0.3, out, attack = 0.005 }) {
    const t0 = ac.currentTime + t;
    if (!mixer.claim(t0, t0 + d + 0.02, PRIO.sfx, () => {})) return;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t0);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + d);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(v, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    o.connect(g); g.connect(out || mixer.sfx);
    o.start(t0); o.stop(t0 + d + 0.02);
  }
  function burst({ t = 0, d = 0.15, v = 0.2, hp = 800, lp = 0, out }) {
    const t0 = ac.currentTime + t;
    if (!mixer.claim(t0, t0 + d, PRIO.sfx, () => {})) return;
    const src = ac.createBufferSource(); src.buffer = noise();
    const f = ac.createBiquadFilter(); f.type = lp ? 'lowpass' : 'highpass'; f.frequency.value = lp || hp;
    const g = ac.createGain();
    g.gain.setValueAtTime(v, t0); g.gain.linearRampToValueAtTime(0, t0 + d);
    src.connect(f); f.connect(g); g.connect(out || mixer.sfx);
    src.start(t0, Math.random()); src.stop(t0 + d + 0.02);
  }
  /** Cama de ruido (viento sintético, zumbido de faroles, retumbo): devuelve { gain, stop() }. */
  function noiseBed({ out, type = 'lowpass', f = 400, q = 0.7, lfo = 0.08, depth = 0.4, hum = 0 } = {}) {
    const g = ac.createGain(); g.gain.value = 0;
    const lv = ac.createGain(); lv.gain.value = 1;
    let src;
    if (hum) { src = ac.createOscillator(); src.type = 'triangle'; src.frequency.value = hum; }
    else { src = ac.createBufferSource(); src.buffer = noise(); src.loop = true; }
    const flt = ac.createBiquadFilter(); flt.type = type; flt.frequency.value = f; flt.Q.value = q;
    const l = ac.createOscillator(), lg = ac.createGain(); l.frequency.value = lfo; lg.gain.value = depth;
    l.connect(lg); lg.connect(lv.gain);
    src.connect(flt); flt.connect(lv); lv.connect(g); g.connect(out || mixer.amb);
    src.start(); l.start();
    return { gain: g, stop(at = ac.currentTime) { g.gain.setTargetAtTime(0, at, 0.3); try { src.stop(at + 2); l.stop(at + 2); } catch {} } };
  }

  return { voices, tone, burst, noiseBed, noise };
}
