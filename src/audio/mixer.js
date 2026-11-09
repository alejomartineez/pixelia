// Mezclador (PLAN-QUIEBRE §K1, DESIGN-AUDIO.md): buses general / música / ambiente / efectos / interfaz / voz, ducking de
// la música, reverb por lugar con respuestas de impulso generadas en código, filtro de "amortiguado" para el ambiente,
// límite de voces y un limitador al final para que el pico nunca pase 0 dBFS.
// Sirve igual para un AudioContext y para un OfflineAudioContext (los renders de prueba).

/** Perfiles de reverb: dur (s), decay (más alto = cae más rápido), wet (envío), damp (0..1, oscurece la cola). */
export const REVERBS = {
  open: { dur: 1.6, decay: 3.6, wet: 0.16, damp: 0.55 },
  interior: { dur: 0.9, decay: 6, wet: 0.12, damp: 0.6 },
  cave: { dur: 3.4, decay: 2.0, wet: 0.34, damp: 0.45 },
  mine: { dur: 2.4, decay: 2.6, wet: 0.28, damp: 0.5 },
  hall: { dur: 3.0, decay: 2.2, wet: 0.3, damp: 0.35 },
  under: { dur: 4.2, decay: 1.6, wet: 0.4, damp: 0.6 },
};

/** Respuesta de impulso estéreo: ruido que decae, con un pasabajos que se cierra a lo largo de la cola. */
export function makeImpulse(ac, { dur = 1.6, decay = 3.6, damp = 0.5 } = {}, seed = 7) {
  const sr = ac.sampleRate, len = Math.max(1, Math.floor(sr * dur));
  const buf = ac.createBuffer(2, len, sr);
  let s = seed >>> 0;
  const rnd = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 * 2 - 1; };
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const x = i / len;
      const env = Math.pow(1 - x, decay) * (i < sr * 0.004 ? i / (sr * 0.004) : 1);
      const a = 1 - damp * x * 0.92;            // coeficiente del pasabajos: la cola se oscurece
      lp = lp + a * (rnd() - lp);
      d[i] = lp * env;
    }
  }
  return buf;
}

export function createMixer(ac, { maxVoices = 32 } = {}) {
  const g = (v = 1) => { const n = ac.createGain(); n.gain.value = v; return n; };
  const limiter = ac.createDynamicsCompressor();
  limiter.threshold.value = -6; limiter.knee.value = 4; limiter.ratio.value = 14;
  limiter.attack.value = 0.002; limiter.release.value = 0.22;
  const ceiling = g(0.94);                      // un poco de aire debajo de 0 dBFS
  const master = g(0);
  master.connect(limiter); limiter.connect(ceiling); ceiling.connect(ac.destination);

  const music = g(0), musicDuck = g(1), musicIn = g(1.8);   // +5 dB: la música queda cerca de −16 LUFS con el deslizador al máximo
  musicIn.connect(musicDuck); musicDuck.connect(music); music.connect(master);
  const amb = g(0), ambIn = g(1), muffle = ac.createBiquadFilter();
  muffle.type = 'lowpass'; muffle.frequency.value = 20000; muffle.Q.value = 0.5;
  ambIn.connect(muffle); muffle.connect(amb); amb.connect(master);
  const sfx = g(0), ui = g(0), voice = g(0);
  sfx.connect(master); ui.connect(master); voice.connect(master);

  // reverb: envíos desde música, ambiente y efectos; la cola entra al general
  const verbIn = g(1), conv = ac.createConvolver(), verbOut = g(0);
  conv.normalize = true;
  verbIn.connect(conv); conv.connect(verbOut); verbOut.connect(master);
  const sends = { music: g(0.9), amb: g(0.35), sfx: g(0.6) };
  musicDuck.connect(sends.music); ambIn.connect(sends.amb); sfx.connect(sends.sfx);
  for (const s of Object.values(sends)) s.connect(verbIn);
  let reverbName = null;

  const ramp = (p, v, tc = 0.03, at = ac.currentTime) => { p.cancelScheduledValues(at); p.setTargetAtTime(v, at, tc); };

  // ---------- ducking ----------
  const holds = new Map();                       // pedidos sostenidos (diálogo, épico): clave → nivel
  let duckUntil = 0, duckLevel = 1;
  function applyDuck(at = ac.currentTime) {
    let lv = 1;
    for (const v of holds.values()) lv = Math.min(lv, v);
    const transient = at < duckUntil ? duckLevel : 1;
    ramp(musicDuck.gain, Math.min(lv, transient), 0.12, at);
  }

  // ---------- voces ----------
  // cada voz: { start, end, prio, stop(t) }. Si en el instante de arranque ya hay maxVoices sonando, se corta la de
  // menor prioridad (la más vieja) con un fundido corto, o no se toca la nueva si todas valen más.
  const voices = [];
  let stolen = 0, rejected = 0, peakVoices = 0;
  function claim(start, end, prio, stop) {
    for (let i = voices.length - 1; i >= 0; i--) if (voices[i].end <= ac.currentTime) voices.splice(i, 1);
    // el compositor programa compases enteros por adelantado: hay que mirar todo el tramo [start, end), no solo el
    // arranque. Se cuenta en cada punto donde empieza una voz dentro del tramo.
    for (let guard = 0; guard < 8; guard++) {
      const over = voices.filter(v => v.start < end && v.end > start);
      if (over.length < maxVoices) break;
      let worst = null, worstN = 0;
      for (const p of [start, ...over.map(v => v.start).filter(x => x > start)]) {
        let n = 1;
        for (const v of over) if (v.start <= p && v.end > p) n++;
        if (n > worstN) { worstN = n; worst = p; }
      }
      if (worstN <= maxVoices) break;
      let victim = null;
      for (const v of over) if (v.start <= worst && v.end > worst && (!victim || v.prio < victim.prio || (v.prio === victim.prio && v.start < victim.start))) victim = v;
      if (!victim || victim.prio > prio) { rejected++; return false; }
      const cut = Math.max(victim.start, start);
      try { victim.stop(cut); } catch {}
      victim.end = cut;
      if (victim.end <= victim.start) voices.splice(voices.indexOf(victim), 1);
      stolen++;
    }
    const v = { start, end, prio, stop };
    voices.push(v);
    for (const p of [start, ...voices.filter(x => x.start > start && x.start < end).map(x => x.start)]) {
      let n = 0;
      for (const x of voices) if (x.start <= p && x.end > p) n++;
      if (n > peakVoices) peakVoices = n;
    }
    return v;
  }

  return {
    ac, master, music: musicIn, amb: ambIn, sfx, ui, voice, maxVoices,
    buses: { master, music, amb, sfx, ui, voice },
    /** Volúmenes finales (0..1) de cada bus, con fundido (nada de clics). */
    setLevels(lv) {
      for (const k of ['master', 'music', 'amb', 'sfx', 'ui', 'voice']) if (typeof lv[k] === 'number') ramp(this.buses[k].gain, lv[k]);
    },
    levels() { return Object.fromEntries(Object.entries(this.buses).map(([k, n]) => [k, n.gain.value])); },
    /** Baja la música un rato (stingers): nivel 0..1, hold en segundos. */
    duck(level = 0.4, hold = 1.2, at = ac.currentTime) {
      duckLevel = level; duckUntil = at + hold;
      applyDuck(at);
      ramp(musicDuck.gain, 1, 0.5, at + hold);
      if (holds.size) applyDuckLater(at + hold + 0.01);
    },
    /** Ducking sostenido (diálogo, momentos épicos): duckHold('dialog', 0.5) … duckHold('dialog', null). */
    duckHold(key, level) {
      if (level == null) holds.delete(key); else holds.set(key, level);
      applyDuck();
    },
    get ducked() { return musicDuck.gain.value; },
    /** Reverb del lugar (open, interior, cave, mine, hall, under), con fundido para cambiar la respuesta sin clic. */
    setReverb(name, at = ac.currentTime) {
      const p = REVERBS[name] || REVERBS.open;
      if (name === reverbName) return;
      const first = reverbName == null;
      reverbName = name;
      if (first) { conv.buffer = makeImpulse(ac, p); ramp(verbOut.gain, p.wet * 2.2, 0.3, at); return; }
      ramp(verbOut.gain, 0, 0.08, at);
      const swap = () => { conv.buffer = makeImpulse(ac, p); ramp(verbOut.gain, p.wet * 2.2, 0.4); };
      if (typeof setTimeout === 'function' && ac instanceof (globalThis.AudioContext || Object)) setTimeout(swap, 350); else swap();
    },
    get reverb() { return reverbName; },
    /** Amortiguado del ambiente (un interior: la tormenta vista desde adentro): 0 = abierto, 1 = muy tapado. */
    setMuffle(amount = 0, at = ac.currentTime) {
      const f = amount <= 0 ? 20000 : 20000 * Math.pow(500 / 20000, Math.min(1, amount));
      muffle.frequency.cancelScheduledValues(at);
      muffle.frequency.setTargetAtTime(f, at, 0.4);
    },
    claim,
    get voiceStats() { return { active: voices.filter(v => v.end > ac.currentTime).length, stolen, rejected, peak: peakVoices, max: maxVoices }; },
  };
  function applyDuckLater(at) { if (typeof setTimeout === 'function') setTimeout(() => applyDuck(), Math.max(0, (at - ac.currentTime) * 1000)); }
}
