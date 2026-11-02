// Sonido 100% sintetizado con WebAudio (no hay archivos de audio).
// audio.sfx('coin') | audio.music('city') | audio.music(null)
// En iPhone el audio se habilita con el primer toque (unlock en main.js).

let ctx = null, master = null, sfxGain = null, musicGain = null;
let settings = { music: true, sfx: true };
let currentSong = null, songTimer = null, songStep = 0, nextTime = 0;

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

// ---------- Música (secuenciador chiptune simple) ----------
// Cada canción: tempo (bpm), lead (semitonos por corchea, null = silencio), bass (por negra), chords opcional
const SONGS = {
  city: { bpm: 104, lead: [12, null, 16, 19, 21, null, 19, 16, 17, null, 21, 24, 23, null, 19, null, 12, null, 16, 19, 21, 19, 16, 14, 12, 14, 16, null, 12, null, null, null],
    bass: [0, 0, 5, 5, 9, 7, 0, 7].map(x => x - 12), wave: 'triangle' },
  game: { bpm: 132, lead: [19, 16, 12, 16, 19, 24, 21, 19, 17, 21, 24, 21, 19, 16, 14, 16, 19, 16, 12, 16, 19, 24, 26, 28, 26, 24, 21, 19, 21, 23, 24, null],
    bass: [0, 0, 5, 5, 7, 7, 0, 7].map(x => x - 12), wave: 'square' },
  drive: { bpm: 146, lead: [12, 12, 19, 12, 17, 12, 16, 14, 12, 12, 19, 12, 21, 19, 17, 16, 14, 14, 21, 14, 19, 14, 17, 16, 12, 16, 19, 24, 23, 21, 19, null],
    bass: [0, 0, 9, 9, 5, 5, 7, 7].map(x => x - 12), wave: 'square' },
  calm: { bpm: 84, lead: [16, null, 19, null, 23, null, 21, 19, 16, null, 14, null, 12, null, null, null, 17, null, 21, null, 24, null, 23, 21, 19, null, 16, null, 19, null, null, null],
    bass: [0, 9, 5, 7, 0, 9, 5, 7].map(x => x - 12), wave: 'triangle' },
};

function scheduleSong() {
  if (!ctx || !currentSong) return;
  const song = SONGS[currentSong];
  const eighth = 60 / song.bpm / 2;
  while (nextTime < ctx.currentTime + 0.25) {
    const i = songStep % song.lead.length;
    const n = song.lead[i];
    const t = nextTime - ctx.currentTime;
    if (n !== null) tone({ f: N(n), t, d: eighth * 0.9, v: 0.18, type: song.wave, out: musicGain });
    if (i % 2 === 0) {
      const b = song.bass[(i / 2) % song.bass.length];
      tone({ f: N(b), t, d: eighth * 1.8, v: 0.25, type: 'triangle', out: musicGain });
    }
    if (i % 4 === 2) noise({ t, d: 0.04, v: 0.05, hp: 6000, out: musicGain });
    nextTime += eighth;
    songStep++;
  }
}

export const audio = {
  unlock() {
    ensure();
    if (ctx?.state === 'suspended') ctx.resume();
    if (currentSong && !songTimer) audio.music(currentSong, true);
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
  /** Cambia la música: 'city' | 'game' | 'drive' | 'calm' | null */
  music(name, force = false) {
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
