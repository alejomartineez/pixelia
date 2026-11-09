// Compositor adaptativo (PLAN-QUIEBRE §K3, DESIGN-AUDIO.md). Reemplaza al secuenciador chiptune de src/core/audio.js.
// Cada lugar tiene una pieza (pieces.js): escala, tempo, progresiones y capas. La intensidad (0..1) suma o saca capas
// (capas verticales) y los cambios de pieza caen en el límite de compás (resecuenciado horizontal). La melodía arma
// frases con respiros y a veces cita un leitmotiv (la isla, la cartógrafa, El Quiebre). Los stingers son frases cortas
// atadas a eventos y bajan la música mientras suenan. Programa compás por compás con anticipación: sirve igual en
// tiempo real (un temporizador llama a tick) que para renderizar con OfflineAudioContext (tick hasta el final).
import { PIECES, MODES, MOTIFS, EPIC_LAYERS, ALIAS, STINGERS } from './pieces.js';
import { PRIO } from './sampler.js';

const SAMPLED = new Set(['piano', 'flute', 'pizz', 'timp', 'choir']);
const FALLBACK = { piano: 'pluck', pizz: 'pluck', flute: 'breath', timp: 'drum', choir: 'choir' };
// envolventes por instrumento: ataque, cola y duración mínima (el piano y el pizzicato suenan solos hasta apagarse)
const ENV = { piano: { a: 0.003, r: 0.5, min: 1.4 }, pizz: { a: 0.002, r: 0.3, min: 1 }, flute: { a: 0.07, r: 0.3, min: 0 },
  timp: { a: 0.002, r: 0.8, min: 2 }, choir: { a: 0.9, r: 1.4, min: 0 } };
// células rítmicas (pulsos) por compás
const CELLS = {
  3: [[1, 1, 1], [2, 1], [1, 2], [1.5, 0.5, 1], [1, 0.5, 0.5, 1]],
  4: [[1, 1, 2], [2, 1, 1], [1.5, 0.5, 2], [1, 1, 1, 1], [0.5, 0.5, 1, 2], [3, 1]],
};
const END_CELLS = { 3: [[3], [2, 1], [1, 2]], 4: [[4], [2, 2], [1, 3]] };

export function makeRng(seed = 1) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const resolvePiece = (id) => (id && (PIECES[id] ? id : PIECES[ALIAS[id]] ? ALIAS[id] : null)) || null;

/** Semitonos de un grado (0 = tónica) de la escala, con octavas. */
export function degSemi(mode, d) {
  const sc = MODES[mode] || MODES.ionian;
  return sc[((d % 7) + 7) % 7] + 12 * Math.floor(d / 7);
}
/** Acorde de un compás: "1", "67" (con séptima), "5s4" (suspendido). tones = 3 o 4 notas; arp = [raíz, 3ª, 5ª, 8ª o 7ª]. */
export function chordOf(piece, spec) {
  const deg = Number(spec[0]) - 1, rest = spec.slice(1);
  const sev = rest.includes('7'), s4 = rest.includes('s4'), s2 = rest.includes('s2');
  const idx = s4 ? [deg, deg + 3, deg + 4] : s2 ? [deg, deg + 1, deg + 4] : [deg, deg + 2, deg + 4];
  if (sev) idx.push(deg + 6);
  const tones = idx.map(d => piece.root + degSemi(piece.mode, d));
  const arp = [tones[0], tones[1], tones[2], sev ? tones[3] : tones[0] + 12];
  return { spec, deg, root: tones[0], tones, arp };
}
const fold = (n, lo, hi) => { while (n < lo) n += 12; while (n > hi) n -= 12; return n; };

export function createComposer({ ac, mixer, sampler, synth, seed = 7 }) {
  const rnd = makeRng(seed);
  let cur = null, pending = undefined, userI = null, night = false, epic = false, forced = null;
  const stats = { notes: 0, bars: 0, phrases: 0, motifs: 0, rests: 0, stingers: 0, byRole: {} };

  function effective(def) {
    const n = night && def.night ? def.night : {};
    const layers = epic ? [...def.layers, ...EPIC_LAYERS.filter(e => !def.layers.some(l => l.role === e.role && l.inst === e.inst))] : def.layers;
    return { ...def, ...n, base: def.base + (n.base || 0), layers };
  }
  function intensityOf(P) {
    const i = userI != null ? userI + (night && P.night?.base ? P.night.base : 0) : P.base;
    return Math.max(0, Math.min(1, epic ? Math.max(i, 0.9) : i));
  }
  function chordAt(def, bar) {
    const seq = def._seq || (def._seq = def.form.flatMap(s => def.sections[s]));
    return chordOf(def, seq[((bar % seq.length) + seq.length) % seq.length]);
  }

  function playInst(inst, n, t, dur, vel, out, extra = {}) {
    stats.notes++;
    if (SAMPLED.has(inst)) {
      const e = ENV[inst];
      const h = sampler.note(inst, n, { t, dur: Math.max(dur, e.min), vel, out, attack: extra.attack ?? e.a, release: extra.release ?? e.r, prio: extra.prio ?? PRIO.music, detune: (rnd() - 0.5) * 6 });
      if (h) return h;
      inst = FALLBACK[inst];
    }
    return synth.voices[inst]?.(n, t, dur, { vel, out, ...extra });
  }

  function newState(id, t) {
    const def = PIECES[id];
    const layers = effective(def).layers.map(L => {
      const gain = ac.createGain(); gain.gain.value = 0; gain.connect(mixer.music);
      return { L, gain, on: false, phraseEnd: 0, lastPhrase: false };
    });
    if (mixer.setReverb && def.reverb) mixer.setReverb(epic ? 'hall' : def.reverb, t);
    return { id, def, layers, bar: 0, nextBar: t };
  }
  function syncLayers() {
    // capas del modo épico: se crean al prenderlo
    if (!cur) return;
    for (const L of effective(cur.def).layers) if (!cur.layers.some(s => s.L === L)) {
      const gain = ac.createGain(); gain.gain.value = 0; gain.connect(mixer.music);
      cur.layers.push({ L, gain, on: false, phraseEnd: 0, lastPhrase: false });
    }
  }
  function fadeOut(state, t, tc = 0.5) {
    for (const s of state.layers) { s.gain.gain.cancelScheduledValues(t); s.gain.gain.setTargetAtTime(0, t, tc); }
    if (typeof setTimeout === 'function' && !(ac instanceof (globalThis.OfflineAudioContext || function () {}))) setTimeout(() => state.layers.forEach(s => { try { s.gain.disconnect(); } catch {} }), 8000);
  }

  function scheduleBar() {
    let t = cur.nextBar;
    if (pending !== undefined) {
      const next = pending; pending = undefined;
      fadeOut(cur, t, 0.6);
      if (!next) { cur = null; return; }
      cur = newState(next, t);
    }
    const def = cur.def, P = effective(def);
    const beat = 60 / P.bpm, barDur = beat * P.meter, eighth = beat / 2, steps = P.meter * 2;
    const I = intensityOf(P);
    const ch = chordAt(def, cur.bar);
    stats.bars++;
    for (const s of cur.layers) {
      const L = s.L;
      const want = P.layers.includes(L) && L.at <= I + 1e-6 && (!L.epic || epic) && (L.night === undefined || L.night === night);
      if (want !== s.on) {
        s.on = want;
        s.gain.gain.cancelScheduledValues(t);
        s.gain.gain.setTargetAtTime(want ? L.vol * (def.gain ?? 1) : 0, t, want ? 0.05 : barDur / 3);
        if (want) s.phraseEnd = cur.bar;          // la melodía arranca su frase en este compás
      }
      if (!want) continue;
      const out = s.gain, o = L.oct || 0;
      stats.byRole[L.role] = (stats.byRole[L.role] || 0) + 1;
      switch (L.role) {
        case 'pad':
          for (const n of ch.tones.slice(0, 3)) playInst(L.inst, n + o, t, barDur * 0.98, 0.55, out, { attack: 0.6, release: 1.2 });
          break;
        case 'drone':
          if (cur.bar % 2 === 0) for (const n of [ch.root, ch.root + 7]) playInst(L.inst, n + o, t, barDur * 2, 0.6, out, { attack: 1.2, release: 1.6 });
          break;
        case 'choir':
          for (const n of ch.tones.slice(0, 3)) playInst(L.inst, fold(n + o, 50, 64), t, barDur * 1.02, 0.55, out);
          break;
        case 'bass': case 'arp': {
          const pat = L.pat || [0];
          for (let k = 0; k < steps; k++) {
            const ix = pat[k % pat.length];
            if (ix == null) continue;
            let len = 1; while (k + len < steps && pat[(k + len) % pat.length] == null && len < 4) len++;
            const n = (L.role === 'bass' ? [ch.root, ch.tones[1], ch.tones[2], ch.root + 12] : ch.arp)[ix % 4] + o;
            const vel = (L.role === 'bass' ? 0.65 : 0.5) * (k === 0 ? 1.1 : 0.9 + rnd() * 0.15);
            playInst(L.inst, n, t + k * eighth, eighth * len * 0.95, vel, out);
          }
          break;
        }
        case 'perc': {
          const pat = L.pat || [1];
          for (let k = 0; k < steps; k++) {
            const v = pat[k % pat.length];
            if (!v) continue;
            const n = L.inst === 'timp' ? fold(ch.root, 36, 47) : 60;
            playInst(L.inst, n, t + k * eighth, eighth, v, out);
          }
          break;
        }
        case 'melody':
          if (cur.bar >= s.phraseEnd) phrase(s, P, t, beat);
          break;
      }
    }
    cur.bar++;
    cur.nextBar = t + barDur;
  }

  /** Frase de melodía: un respiro, un leitmotiv o una frase nueva que camina por la escala y cae en los tonos del acorde. */
  function phrase(s, P, t, beat) {
    const L = s.L, bar0 = cur.bar, base = P.root + (L.oct || 0);
    if (s.lastPhrase && rnd() < P.rest) {
      const n = rnd() < 0.5 ? 1 : 2;
      s.phraseEnd = bar0 + n; s.lastPhrase = false; stats.rests++;
      return;
    }
    stats.phrases++;
    const notes = [];
    let name = forced && P.motifs.includes(forced) ? forced : forced && MOTIFS[forced] ? forced : null;
    if (!name && P.motifs.length && rnd() < P.motifP) name = P.motifs[Math.floor(rnd() * P.motifs.length)];
    let bars;
    if (name) {
      forced = null; stats.motifs++;
      let b = 0;
      for (const [d, len, alt = 0] of MOTIFS[name]) { notes.push({ at: b, n: base + degSemi(P.mode, d) + alt, len }); b += len; }
      bars = Math.ceil(b / P.meter - 1e-6);
    } else {
      bars = 2;
      let deg = [0, 2, 4][Math.floor(rnd() * 3)];
      for (let k = 0; k < bars; k++) {
        const cells = k === bars - 1 ? END_CELLS[P.meter] || END_CELLS[4] : CELLS[P.meter] || CELLS[4];
        const cell = cells[Math.floor(rnd() * cells.length)];
        const ch = chordAt(cur.def, bar0 + k);
        let b = 0;
        cell.forEach((len, j) => {
          const step = [-2, -1, -1, 1, 1, 2, 0][Math.floor(rnd() * 7)];
          deg = Math.max(-2, Math.min(9, deg + step));
          let n = base + degSemi(P.mode, deg);
          // en el primer pulso y al cerrar, la nota cae en un tono del acorde
          if (j === 0 || (k === bars - 1 && j === cell.length - 1)) {
            const cand = ch.tones.flatMap(x => [x - 12, x, x + 12, x + 24]);
            n = cand.reduce((a, c) => Math.abs(c - n) < Math.abs(a - n) ? c : a, cand[0]);
          }
          notes.push({ at: k * P.meter + b, n, len });
          b += len;
        });
      }
    }
    for (const x of notes) playInst(L.inst, x.n, t + x.at * beat, x.len * beat * 0.95, 0.55 + rnd() * 0.15, s.gain);
    s.phraseEnd = bar0 + bars; s.lastPhrase = true;
  }

  return {
    /** Programa la música hasta el instante `until` (segundos del contexto). */
    tick(until) {
      let guard = 0;
      while (cur && cur.nextBar < until && guard++ < 64) scheduleBar();
    },
    /** Cambia de pieza en el próximo compás (o arranca ya si no suena nada). null = silencio con fundido. */
    play(id, { now = false } = {}) {
      const p = resolvePiece(id);
      if (!cur) { if (p) cur = newState(p, ac.currentTime + 0.08); pending = undefined; return p; }
      if (p === cur.id && pending === undefined) return p;
      if (now) { fadeOut(cur, ac.currentTime, 0.3); cur = p ? newState(p, ac.currentTime + 0.05) : null; pending = undefined; return p; }
      pending = p;
      return p;
    },
    stop() { if (cur) fadeOut(cur, ac.currentTime, 0.4); cur = null; pending = undefined; },
    setIntensity(x) { userI = x == null ? null : Math.max(0, Math.min(1, x)); },
    setNight(b) { night = !!b; },
    setEpic(b) { epic = !!b; syncLayers(); if (cur?.def.reverb) mixer.setReverb?.(epic ? 'hall' : cur.def.reverb); mixer.duckHold?.('epic', null); },
    /** Pide un leitmotiv para la próxima frase (revelaciones, la cartógrafa en escena). */
    motif(name) { if (MOTIFS[name]) forced = name; },
    /** Stinger: frase corta atada a un evento, por el bus de efectos; baja la música mientras suena. */
    stinger(name, { t } = {}) {
      const S = STINGERS[name];
      if (!S) return false;
      stats.stingers++;
      const t0 = t ?? ac.currentTime + 0.02, root = cur ? cur.def.root + 12 : 60;
      let end = t0;
      for (const [inst, semi, at, dur, vel = 0.7] of S.notes) {
        playInst(inst, root + semi, t0 + at, dur, vel, mixer.sfx, { prio: PRIO.stinger });
        end = Math.max(end, t0 + at + dur);
      }
      for (const [id, at, gain] of S.s || []) sampler.play(id, { t: t0 + at, gain, out: mixer.sfx, prio: PRIO.stinger });
      mixer.duck(S.duck ?? 0.5, end - t0 + 0.3, t0);
      return true;
    },
    get state() {
      if (!cur) return { piece: null, pending: pending ?? null, night, epic, notes: stats.notes };
      const P = effective(cur.def);
      return { piece: cur.id, pending: pending ?? null, bar: cur.bar, bpm: P.bpm, intensity: intensityOf(P), night, epic,
        layers: cur.layers.filter(s => s.on).map(s => `${s.L.role}:${s.L.inst}`), notes: stats.notes };
    },
    stats,
    chordAt: (id, bar) => chordAt(PIECES[resolvePiece(id)], bar),
  };
}
