// Sonido 100% sintetizado con WebAudio (no hay archivos de audio).
// audio.sfx('coin') | audio.music('city') | audio.music(null)
// En iPhone el audio se habilita con el primer toque (unlock en main.js).

let ctx = null, master = null, sfxGain = null, musicGain = null;
let settings = { music: true, sfx: true };
let currentSong = null, songTimer = null, songStep = 0, nextTime = 0, unlocking = null;

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = 0.7; master.connect(ctx.destination);
  sfxGain = ctx.createGain(); sfxGain.gain.value = settings.sfx ? 0.55 : 0; sfxGain.connect(master);
  musicGain = ctx.createGain(); musicGain.gain.value = settings.music ? 0.22 : 0; musicGain.connect(master);
  return ctx;
}

function tone({ f = 440, f2, t = 0, d = 0.12, type = 'square', v = 0.3, out, attack = 0.005 }) {
  if (!ctx) return;
  const t0 = ctx.currentTime + t;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t0);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + d);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(v, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
  o.connect(g); g.connect(out || sfxGain);
  o.start(t0); o.stop(t0 + d + 0.02);
}
function noise({ t = 0, d = 0.15, v = 0.2, hp = 800, out }) {
  if (!ctx) return;
  const t0 = ctx.currentTime + t;
  const len = Math.ceil(ctx.sampleRate * d);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource(); src.buffer = buf;
  const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp;
  const g = ctx.createGain(); g.gain.value = v;
  src.connect(f); f.connect(g); g.connect(out || sfxGain);
  src.start(t0);
}
const N = (semi) => 440 * Math.pow(2, (semi - 9) / 12); // semitonos desde C4=0

const SFX = {
  tap: () => tone({ f: 880, d: 0.05, v: 0.15 }),
  open: () => { tone({ f: 520, f2: 780, d: 0.09, v: 0.12, type: 'triangle' }); },
  close: () => tone({ f: 700, f2: 450, d: 0.08, v: 0.1, type: 'triangle' }),
  coin: () => { tone({ f: 988, d: 0.07, v: 0.2 }); tone({ f: 1319, t: 0.06, d: 0.16, v: 0.2 }); },
  gem: () => { [0, 4, 7, 12].forEach((s, i) => tone({ f: N(24 + s), t: i * 0.05, d: 0.15, v: 0.16, type: 'triangle' })); },
  build: () => { noise({ d: 0.08, v: 0.25, hp: 300 }); tone({ f: 220, d: 0.1, v: 0.2, t: 0.05 }); noise({ t: 0.15, d: 0.08, v: 0.25, hp: 300 }); },
  place: () => { tone({ f: 330, f2: 660, d: 0.12, v: 0.2, type: 'triangle' }); noise({ d: 0.06, v: 0.12, hp: 1200 }); },
  done: () => { [0, 4, 7].forEach((s, i) => tone({ f: N(12 + s), t: i * 0.08, d: 0.18, v: 0.2 })); },
  levelup: () => { [0, 4, 7, 12, 7, 12, 16].forEach((s, i) => tone({ f: N(12 + s), t: i * 0.09, d: 0.2, v: 0.2, type: i % 2 ? 'square' : 'triangle' })); },
  error: () => { tone({ f: 200, f2: 140, d: 0.18, v: 0.2, type: 'sawtooth' }); },
  match: () => tone({ f: 660, f2: 990, d: 0.1, v: 0.18, type: 'triangle' }),
  combo: (n = 1) => { const b = 12 + Math.min(12, n * 2); [0, 4, 7].forEach((s, i) => tone({ f: N(b + s), t: i * 0.04, d: 0.12, v: 0.15 })); },
  pop: () => { tone({ f: 600, f2: 1200, d: 0.06, v: 0.18, type: 'sine' }); },
  clear: () => { noise({ d: 0.25, v: 0.18, hp: 2000 }); tone({ f: 523, f2: 1046, d: 0.25, v: 0.15, type: 'triangle' }); },
  swoosh: () => noise({ d: 0.18, v: 0.15, hp: 1500 }),
  star: () => { tone({ f: 1046, d: 0.1, v: 0.18 }); tone({ f: 1568, t: 0.08, d: 0.2, v: 0.18, type: 'triangle' }); },
  win: () => { [0, 4, 7, 12, 16, 19, 24].forEach((s, i) => tone({ f: N(12 + s), t: i * 0.07, d: 0.25, v: 0.18 })); },
  lose: () => { [7, 4, 0, -5].forEach((s, i) => tone({ f: N(12 + s), t: i * 0.15, d: 0.25, v: 0.18, type: 'triangle' })); },
  horn: () => { tone({ f: 392, d: 0.18, v: 0.18, type: 'square' }); tone({ f: 494, d: 0.18, v: 0.12, type: 'square' }); },
  crash: () => { noise({ d: 0.3, v: 0.35, hp: 200 }); tone({ f: 120, f2: 60, d: 0.3, v: 0.25, type: 'sawtooth' }); },
  bump: () => { noise({ d: 0.08, v: 0.2, hp: 400 }); tone({ f: 160, f2: 90, d: 0.1, v: 0.2 }); },
  select: () => tone({ f: 740, d: 0.06, v: 0.14, type: 'triangle' }),
  buy: () => { tone({ f: 784, d: 0.08, v: 0.18 }); tone({ f: 1175, t: 0.07, d: 0.08, v: 0.18 }); tone({ f: 1568, t: 0.14, d: 0.2, v: 0.18, type: 'triangle' }); },
};

// ---------- Música (secuenciador chiptune con forma A/B) ----------
// Cada canción tiene secciones de 4 compases (8 corcheas por compás = 32 pasos) con su propia progresión de acordes,
// y una forma (A A2 B A2 = 128 pasos) para que no se repita el mismo loop corto. Sobre el acorde de cada compás
// suenan un colchón suave (pad) y el bajo; la melodía va nota por corchea (null = silencio: la nota anterior se
// sostiene hasta 4 corcheas, más ligado y tranquilo).
// Opciones: bpm, wave (melodía), hat (platillo suave), bass: 'half' (en 1 y 3) | 'eighths' (todas las corcheas, manejo)
// | 'pulse' (pulso corto y grave, tensión), heart (latido grave en el 1), lv/bv/pv (volumen de melodía/bajo/pad).
const _ = null;
const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const QUAL = { '': [0, 4, 7], m: [0, 3, 7], 7: [0, 4, 7, 10], m7: [0, 3, 7, 10], maj7: [0, 4, 7, 11], sus2: [0, 2, 7], sus4: [0, 5, 7], dim: [0, 3, 6] };
function chord(name) {
  const m = /^([A-G])([#b]?)(.*)$/.exec(name);
  const root = (NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + 12) % 12;
  return { root, tones: (QUAL[m[3]] || QUAL['']).map(x => x + root) };
}
const SONG_DEFS = {
  // ciudad: Do mayor, tranquila
  city: { bpm: 92, wave: 'triangle', hat: true, form: ['A', 'A2', 'B', 'A2'], sections: {
    A: { chords: ['C', 'Am', 'F', 'G'], lead: [16, _, 19, _, 21, 19, 16, _, 12, _, 16, _, 19, _, 16, 14, 12, _, 14, 16, 17, _, 16, _, 14, _, _, 11, 14, _, _, _] },
    A2: { chords: ['C', 'Em', 'F', 'G'], lead: [16, _, 19, _, 21, 24, 23, _, 19, _, 16, _, 19, _, 23, 21, 21, _, 19, 17, 16, _, 14, _, 14, _, 12, _, 11, _, _, _] },
    B: { chords: ['F', 'G', 'Em', 'Am'], lead: [24, _, _, 21, 24, _, 26, _, 23, _, 19, _, _, _, 21, 23, 24, _, 23, 19, 16, _, 19, _, 21, _, _, _, 16, _, 19, _] },
  } },
  // casa y pantallas tranquilas: Fa mayor, lenta y espaciada
  calm: { bpm: 70, wave: 'triangle', pv: 0.06, form: ['A', 'A2', 'B', 'A2'], sections: {
    A: { chords: ['Fmaj7', 'Am7', 'Bbmaj7', 'C'], lead: [17, _, _, _, 21, _, 19, _, 16, _, _, _, 12, _, _, _, 14, _, 17, _, 21, _, _, 19, 16, _, _, _, _, _, _, _] },
    A2: { chords: ['Fmaj7', 'Dm7', 'Gm7', 'C'], lead: [17, _, _, _, 21, _, 24, _, 21, _, _, _, 17, _, _, _, 19, _, 17, _, 14, _, _, _, 12, _, _, _, _, _, _, _] },
    B: { chords: ['Dm7', 'Bbmaj7', 'Gm7', 'C'], lead: [21, _, _, 24, _, _, 26, _, 24, _, _, _, 21, _, _, _, 22, _, 21, _, 19, _, 17, _, 16, _, _, _, 19, _, _, _] },
  } },
  // minijuegos: Sol mayor, con más pulso
  game: { bpm: 112, wave: 'square', hat: true, lv: 0.11, form: ['A', 'A2', 'B', 'A2'], sections: {
    A: { chords: ['G', 'Em', 'C', 'D'], lead: [19, _, 23, _, 26, _, 23, _, 19, _, 23, 26, 28, _, 26, _, 24, _, 23, _, 21, _, 19, _, 21, _, _, _, 18, _, 21, _] },
    A2: { chords: ['G', 'Em', 'C', 'D'], lead: [19, _, 23, _, 26, _, 31, _, 28, _, 26, _, 23, _, _, _, 24, _, 26, _, 28, _, 24, _, 26, _, _, _, 19, _, _, _] },
    B: { chords: ['C', 'D', 'Bm', 'Em'], lead: [28, _, _, 26, 24, _, 26, _, 26, _, _, 24, 21, _, 18, _, 23, _, _, 21, 19, _, 18, _, 16, _, 19, _, 23, _, _, _] },
  } },
  // manejar: La menor, bajo en corcheas
  drive: { bpm: 132, wave: 'square', hat: true, bass: 'eighths', lv: 0.11, form: ['A', 'A2', 'B', 'A2'], sections: {
    A: { chords: ['Am', 'F', 'C', 'G'], lead: [21, _, 21, 24, _, 21, 19, _, 17, _, 17, 21, _, 17, 16, _, 16, _, 19, _, 24, _, 23, _, 19, _, _, _, 14, _, _, _] },
    A2: { chords: ['Am', 'F', 'C', 'E'], lead: [21, _, 21, 24, _, 21, 26, _, 24, _, 21, _, 17, _, 21, _, 19, _, 16, _, 19, _, 24, _, 23, _, _, _, 20, _, _, _] },
    B: { chords: ['F', 'G', 'Em', 'Am'], lead: [24, _, _, _, 21, _, 24, 26, 26, _, _, _, 23, _, 19, _, 19, _, 23, _, 28, _, 26, _, 24, _, _, _, 21, _, _, _] },
  } },
  // expedición: Re dórico, curiosidad (frases que suben como pregunta y bajan como respuesta)
  expedition: { bpm: 96, wave: 'triangle', hat: true, form: ['A', 'A2', 'B', 'A2'], sections: {
    A: { chords: ['Dm7', 'G', 'Dm7', 'Am7'], lead: [14, _, 17, _, 21, _, _, 19, 23, _, 21, _, 19, _, _, _, 14, _, 17, _, 21, _, 24, _, 21, _, _, 19, 16, _, _, _] },
    A2: { chords: ['Dm7', 'G', 'Bbmaj7', 'C'], lead: [14, _, 17, _, 21, _, _, 19, 23, _, 26, _, 23, _, _, _, 22, _, 21, _, 17, _, 14, _, 16, _, 19, _, _, _, _, _] },
    B: { chords: ['Bbmaj7', 'C', 'Dm7', 'Asus4'], lead: [26, _, _, 24, 22, _, _, _, 24, _, _, 26, 28, _, _, _, 26, _, 24, 21, 17, _, _, _, 21, _, _, _, 26, _, _, _] },
  } },
  // amenaza: La menor, tensión contenida (pulso grave, latido, melodía baja y con aire)
  threat: { bpm: 84, wave: 'square', bass: 'pulse', heart: true, lv: 0.09, pv: 0.035, form: ['A', 'A2', 'B', 'A2'], sections: {
    A: { chords: ['Am', 'Am', 'F', 'E'], lead: [_, _, _, _, 9, _, _, _, 12, _, _, _, 11, _, 9, _, _, _, _, _, 5, _, 9, _, 8, _, _, _, _, _, _, _] },
    A2: { chords: ['Am', 'Am', 'Dm', 'E'], lead: [_, _, _, _, 9, _, 12, _, 16, _, _, _, 15, _, 12, _, 14, _, _, _, 12, _, 9, _, 11, _, _, _, 8, _, _, _] },
    B: { chords: ['F', 'E', 'Dm', 'E'], lead: [17, _, _, _, 16, _, _, _, 16, _, _, _, _, _, _, _, 14, _, _, _, 12, _, _, _, 11, _, _, _, _, _, _, _] },
  } },
};
/** Arma la canción en pasos (corcheas): nota, duración (en corcheas) y acorde de cada paso. */
function compileSong(def) {
  const lead = [], chords = [];
  for (const id of def.form) {
    const sec = def.sections[id];
    if (sec.lead.length !== sec.chords.length * 8) throw new Error('música: la sección ' + id + ' no cierra (' + sec.lead.length + ' pasos)');
    lead.push(...sec.lead);
    for (const c of sec.chords) { const ch = chord(c); for (let k = 0; k < 8; k++) chords.push(ch); }
  }
  const len = lead.map((n, i) => {
    if (n === null) return 0;
    let k = 1;
    while (k < 4 && lead[(i + k) % lead.length] === null) k++;
    return k;
  });
  return { ...def, lead, len, chords, steps: lead.length, lv: def.lv ?? 0.13, bv: def.bv ?? 0.2, pv: def.pv ?? 0.045, bass: def.bass || 'half' };
}
const SONGS = Object.fromEntries(Object.entries(SONG_DEFS).map(([id, d]) => [id, compileSong(d)]));

function scheduleSong() {
  if (!ctx || !currentSong) return;
  const song = SONGS[currentSong];
  if (!song) return;
  const eighth = 60 / song.bpm / 2;
  while (nextTime < ctx.currentTime + 0.25) {
    const i = songStep % song.steps, beat = i % 8;
    const t = nextTime - ctx.currentTime;
    const n = song.lead[i], ch = song.chords[i];
    if (n !== null) tone({ f: N(n), t, d: eighth * song.len[i] * 0.92, v: song.lv, type: song.wave, out: musicGain, attack: 0.012 });
    // pad: el acorde del compás, entra suave
    if (beat === 0) for (const x of ch.tones) tone({ f: N(x - 12), t, d: eighth * 7.8, v: song.pv, type: 'sine', out: musicGain, attack: 0.35 });
    // bajo
    const root = ch.root - 12;
    if (song.bass === 'eighths') tone({ f: N(root - (i % 2 ? 0 : 12)), t, d: eighth * 0.85, v: song.bv * 0.8, type: 'triangle', out: musicGain });
    else if (song.bass === 'pulse') tone({ f: N(root - 12), t, d: eighth * 0.6, v: song.bv * (beat % 2 ? 0.55 : 0.9), type: 'triangle', out: musicGain });
    else if (beat === 0 || beat === 4) tone({ f: N(beat === 4 && (i >> 3) % 2 ? root + 7 : root), t, d: eighth * 3.5, v: song.bv, type: 'triangle', out: musicGain });
    if (song.hat && beat % 4 === 2) noise({ t, d: 0.03, v: 0.035, hp: 7000, out: musicGain });
    if (song.heart && (beat === 0 || beat === 1)) tone({ f: 64, f2: 42, t, d: 0.16, v: beat === 0 ? 0.32 : 0.2, type: 'sine', out: musicGain });
    nextTime += eighth;
    songStep++;
  }
}

export const audio = {
  unlock() {
    if (!ensure()) return;
    const startSong = () => { if (currentSong && !songTimer && ctx.state === 'running') audio.music(currentSong, true); };
    // resume() es asíncrono: la música recién puede arrancar cuando el contexto pasa a 'running'
    // (en iOS el estado también puede ser 'interrupted' tras una llamada o al volver de segundo plano)
    if (ctx.state !== 'running') {
      if (!unlocking) {
        // iOS a veces necesita "tocar" el contexto con un sonido mudo dentro del gesto
        try { const b = ctx.createBuffer(1, 1, 22050), s = ctx.createBufferSource(); s.buffer = b; s.connect(ctx.destination); s.start(0); } catch {}
        unlocking = ctx.resume().catch(() => {}).then(() => { unlocking = null; startSong(); });
      }
    } else startSong();
  },
  configure(s) {
    settings = { ...settings, ...s };
    if (ctx) {
      sfxGain.gain.value = settings.sfx ? 0.55 : 0;
      musicGain.gain.value = settings.music ? 0.22 : 0;
    }
  },
  sfx(name, arg) {
    if (!settings.sfx) return;
    if (!ensure() || ctx.state !== 'running') return;
    try { SFX[name]?.(arg); } catch {}
  },
  /** Cambia la música: 'city' | 'calm' | 'game' | 'drive' | 'expedition' | 'threat' | null (nombre desconocido = silencio) */
  music(name, force = false) {
    if (name && !SONGS[name]) name = null;
    if (name === currentSong && !force && songTimer) return;
    currentSong = name;
    clearInterval(songTimer); songTimer = null;
    if (!name || !ensure() || ctx.state !== 'running') return;
    songStep = 0; nextTime = ctx.currentTime + 0.05;
    songTimer = setInterval(scheduleSong, 90);
  },
  get songs() { return Object.keys(SONGS); },
};

document.addEventListener('visibilitychange', () => {
  if (!ctx) return;
  if (document.hidden) ctx.suspend(); else ctx.resume();
});
