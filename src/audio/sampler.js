// Sampler (PLAN-QUIEBRE §K2): carga los .m4a de assets/audio (manifest.json) sin bloquear el arranque, los decodifica
// con decodeAudioData y los toca: sueltos, en loop (las camas) o como instrumento (una muestra cada pocos semitonos,
// afinada con playbackRate, con ADSR y round-robin entre muestras vecinas). Todo pasa por el límite de voces del mezclador.

export const PRIO = { music: 1, amb: 2, sfx: 3, ui: 4, stinger: 5 };

export function createSampler(ac, mixer, { base = 'assets/audio/', fetcher = (u) => fetch(u) } = {}) {
  const buffers = new Map(), loading = new Map(), loops = new Map();
  let manifest = null, manifestP = null, failed = 0;

  function loadManifest() {
    if (!manifestP) manifestP = fetcher(base + 'manifest.json').then(r => r.ok ? r.json() : null).then(m => (manifest = m))
      .catch(() => (manifest = null));
    return manifestP;
  }
  /** Carga (una vez) los ids pedidos. No falla: lo que no carga queda sin muestra y suena la síntesis de respaldo. */
  async function load(ids) {
    const m = await loadManifest();
    if (!m) return;
    await Promise.all(ids.filter(id => m.files[id]).map(id => {
      if (buffers.has(id)) return null;
      if (!loading.has(id)) loading.set(id, fetcher(base + m.files[id].file)
        .then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
        .then(ab => new Promise((res, rej) => { const p = ac.decodeAudioData(ab, res, rej); if (p?.then) p.then(res, rej); }))
        .then(b => { buffers.set(id, b); prepLoop(id, b); })
        .catch(() => { failed++; }));
      return loading.get(id);
    }));
  }
  const idsWhere = (fn) => manifest ? Object.entries(manifest.files).filter(([id, f]) => fn(id, f)).map(([id]) => id) : [];
  /** Grupos: 'inst' (instrumentos), 'ui', 'sfx', 'act', 'amb' o un instrumento ('piano', 'flute'…). */
  async function loadGroup(g) {
    await loadManifest();
    return load(idsWhere((id, f) => f.cat === g || f.inst === g || id.startsWith(g + '/')));
  }

  // El AAC trae unos milisegundos de relleno al principio: el loop arranca donde empieza el sonido y dura lo que dice
  // el manifest (así el punto de loop que armó prepare.mjs queda exacto).
  function prepLoop(id, b) {
    const f = manifest?.files[id];
    if (!f?.loop) return;
    const d = b.getChannelData(0);
    let i = 0;
    while (i < d.length && i < b.sampleRate * 0.2 && Math.abs(d[i]) < 1e-4) i++;
    const start = i / b.sampleRate;
    loops.set(id, { start, end: Math.min(b.duration, start + f.loop) });
  }

  /**
   * Toca una muestra. o = { t (absoluto), out, gain, rate, loop, attack, release, dur (corte), prio, pan, panner, fadeIn }
   * Devuelve { src, gain, stop(t), end } o null si no hay muestra o el límite de voces no la deja.
   */
  function play(id, o = {}) {
    const b = buffers.get(id);
    if (!b) return null;
    const t = Math.max(ac.currentTime, o.t ?? ac.currentTime);
    const rate = o.rate ?? 1;
    const natural = o.loop ? Infinity : (b.duration - (o.offset || 0)) / rate;
    const end = Math.min(natural, o.dur != null ? o.dur + (o.release ?? 0.05) : Infinity);
    const src = ac.createBufferSource();
    src.buffer = b; src.playbackRate.value = rate;
    if (o.loop) { const L = loops.get(id); src.loop = true; if (L) { src.loopStart = L.start; src.loopEnd = L.end; } }
    const gn = ac.createGain();
    const peak = o.gain ?? 1, att = o.attack ?? 0.002;
    gn.gain.setValueAtTime(0, t);
    gn.gain.linearRampToValueAtTime(peak, t + att);
    if (o.decay && o.sustain != null) gn.gain.setTargetAtTime(peak * o.sustain, t + att, o.decay / 3);
    let last = src;
    last.connect(gn); last = gn;
    if (o.filter) { const f = ac.createBiquadFilter(); f.type = o.filter.type || 'lowpass'; f.frequency.value = o.filter.f; f.Q.value = o.filter.q ?? 0.7; last.connect(f); last = f; }
    if (o.panner) { last.connect(o.panner); last = o.panner; }
    else if (o.pan && ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = o.pan; last.connect(p); last = p; }
    last.connect(o.out || mixer.sfx);
    const stopAt = (when, rel = o.release ?? 0.05) => {
      const w = Math.max(when, t + att);
      if (gn.gain.cancelAndHoldAtTime) gn.gain.cancelAndHoldAtTime(w); else gn.gain.cancelScheduledValues(w);
      gn.gain.setTargetAtTime(0, w, Math.max(0.005, rel / 4));
      try { src.stop(w + rel + 0.02); } catch {}
    };
    const v = mixer.claim(t, t + (Number.isFinite(end) ? end : 1e9), o.prio ?? PRIO.sfx, (w) => stopAt(w, 0.03));
    if (!v) return null;
    src.start(t, o.offset || (o.loop && loops.get(id) ? loops.get(id).start : 0));
    if (Number.isFinite(end) && o.dur != null) stopAt(t + o.dur, o.release ?? 0.05);
    else if (Number.isFinite(end)) try { src.stop(t + end + 0.02); } catch {}
    return { src, gain: gn, end: t + end, stop: (w = ac.currentTime, rel) => { v.end = w; stopAt(w, rel); } };
  }

  // ---------- instrumentos ----------
  const rr = new Map();
  /** Muestra más cercana a la nota, alternando entre las dos más cercanas cuando están parejas (round-robin). */
  function pick(inst, note) {
    const list = manifest?.instruments?.[inst];
    if (!list?.length) return null;
    const ready = list.filter(s => buffers.has(s.id));
    if (!ready.length) return null;
    ready.sort((a, b) => Math.abs(a.note - note) - Math.abs(b.note - note));
    const c = ready.filter(s => Math.abs(s.note - note) <= Math.abs(ready[0].note - note) + 1.01).slice(0, 2);
    const k = (rr.get(inst) || 0) + 1; rr.set(inst, k);
    return c[k % c.length];
  }
  /** Toca una nota (MIDI) de un instrumento. o = { t, dur, vel 0..1, out, attack, release, prio, detune (cents) } */
  function note(inst, n, o = {}) {
    const s = pick(inst, n);
    if (!s) return null;
    const cents = (n - s.note) * 100 + (o.detune ?? 0);
    const vel = o.vel ?? 0.7;
    return play(s.id, { ...o, rate: Math.pow(2, cents / 1200), gain: (o.gain ?? 1) * (0.25 + 0.75 * vel * vel), prio: o.prio ?? PRIO.music });
  }
  const ready = (inst) => !!manifest?.instruments?.[inst]?.some(s => buffers.has(s.id));

  return {
    load, loadGroup, loadManifest, play, note, ready,
    has: (id) => buffers.has(id),
    get manifest() { return manifest; },
    get loaded() { return buffers.size; },
    get failed() { return failed; },
    loopOf: (id) => loops.get(id) || null,
    ids: (prefix) => idsWhere((id) => id.startsWith(prefix)),
  };
}
