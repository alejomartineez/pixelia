// Narrador de las cinemáticas (PLAN-TRAVESIA §3a) con Gemini TTS: voz grave, épica y misteriosa, que entusiasme, en
// español rioplatense sobrio. Pide cada línea a la API, la guarda como .wav (PCM 16 bits, 24 kHz, mono) y la pasa a
// .m4a con `prepare.mjs --voice` en assets/audio/voice/ (categoría 'voice' del manifest).
//
//   node tools/audio/narrate.mjs --samples [--voices Charon,Algenib,Fenrir] [--text "…"]
//        → muestras de una línea en shots/voice/ para elegir la voz (no toca assets/)
//   node tools/audio/narrate.mjs --script intro [--voice Fenrir] [--only intro/01] [--model …]
//        → graba las líneas de NARRATION[script] (src/cinema/narration.js) en assets/audio/voice/
//   node tools/audio/narrate.mjs --models     → lista los modelos con TTS que ofrece la cuenta
//
// La clave: process.env.GEMINI_API_KEY y, si no está, SOLO la línea GEMINI_API_KEY= del .env de SignBoox. Nunca se
// imprime, no se guarda en ningún archivo y viaja únicamente en el encabezado x-goog-api-key a la API de Gemini
// (nunca en la URL). Cualquier texto de error que vuelva de la API se limpia antes de mostrarse.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const ENV_FILE = 'C:\\cursor-laburo\\signboox-remotion\\.env';
const API = 'https://generativelanguage.googleapis.com/v1beta';
// la voz que eligió el usuario (2026-11-09, entre Charon, Algenib y Fenrir)
export const VOICE = 'Fenrir';
const MODELS = ['gemini-3.8-flash-tts', 'gemini-2.5-pro-preview-tts', 'gemini-3.1-flash-tts-preview', 'gemini-2.5-flash-preview-tts'];
const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const has = (k) => process.argv.includes(k);

// Dirección de actuación. Con una frase suelta delante ("Narrá con voz grave: …") el modelo la lee en voz alta; con
// este formato de notas de dirección (perfil, escena, notas, TRANSCRIPT) lee solo lo que va después de TRANSCRIPT.
export const STYLE = `# AUDIO PROFILE: El Narrador
Narrador de una saga épica de fantasía. Voz grave y profunda, de hombre mayor.

## THE SCENE
Comienzo de una crónica antigua, de noche, frente al fuego. Lo que cuenta es enorme y está por empezar.

### DIRECTOR'S NOTES
Estilo: misterioso y solemne, con una emoción contenida que entusiasma. Nada de tono publicitario.
Ritmo: pausado, con silencios breves en los puntos.
Acento: español rioplatense sobrio y natural (Buenos Aires), sin exagerar.

#### TRANSCRIPT
`;

function apiKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY.trim();
  if (!existsSync(ENV_FILE)) throw new Error('No hay GEMINI_API_KEY en el entorno ni en el .env de SignBoox.');
  const line = readFileSync(ENV_FILE, 'utf8').split(/\r?\n/).find(l => /^\s*(export\s+)?GEMINI_API_KEY\s*=/.test(l));
  if (!line) throw new Error('El .env de SignBoox no tiene la línea GEMINI_API_KEY.');
  return line.slice(line.indexOf('=') + 1).trim().replace(/^['"]|['"]$/g, '');
}
let KEY = null;
const key = () => (KEY ??= apiKey());
/** Saca la clave de cualquier texto antes de mostrarlo. */
const clean = (s) => { let t = String(s); if (KEY) t = t.split(KEY).join('[clave]'); return t.replace(/AIza[0-9A-Za-z_-]{20,}/g, '[clave]').slice(0, 600); };

async function call(path, body) {
  const r = await fetch(`${API}/${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { 'x-goog-api-key': key(), 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const txt = await r.text();
  if (!r.ok) { const e = new Error(`API ${r.status}: ${clean(txt)}`); e.status = r.status; throw e; }
  return JSON.parse(txt);
}

/** PCM 16 bits mono → .wav */
function wav(pcm, rate = 24000) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8); h.write('fmt ', 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

/** Una línea → Buffer .wav. Prueba los modelos en orden hasta que uno responda. */
export async function speak(text, { voice = VOICE, model = null, style = STYLE } = {}) {
  const models = model ? [model] : MODELS;
  let last = null;
  for (const m of models) {
    for (let tries = 0; tries < 3; tries++) {
      try {
        const j = await call(`models/${m}:generateContent`, {
          contents: [{ parts: [{ text: `${style}\n${text}` }] }],
          generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } } },
        });
        const part = j.candidates?.[0]?.content?.parts?.find(p => p.inlineData?.data);
        if (!part) throw new Error('la respuesta no trajo audio');
        const rate = Number(/rate=(\d+)/.exec(part.inlineData.mimeType || '')?.[1] || 24000);
        return { wav: wav(Buffer.from(part.inlineData.data, 'base64'), rate), model: m, rate };
      } catch (e) {
        last = e;
        if (e.status === 404 || e.status === 400) break;            // modelo que no existe o no acepta esto: el siguiente
        if (e.status === 429 || e.status >= 500) { await new Promise(r => setTimeout(r, 4000 * (tries + 1))); continue; }
        break;
      }
    }
  }
  throw last || new Error('sin modelos');
}

/** Control: le pide a un modelo de texto que transcriba el audio y avisa si dice palabras de más (la dirección leída). */
const words = (t) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zñ0-9 ]+/g, ' ').split(/\s+/).filter(Boolean);
export async function check(wavBuf, text) {
  try {
    const j = await call('models/gemini-3.8-flash:generateContent', { contents: [{ parts: [
      { inline_data: { mime_type: 'audio/wav', data: wavBuf.toString('base64') } },
      { text: 'Transcribí exactamente lo que se dice en este audio, palabra por palabra. Solo la transcripción.' }] }] });
    const heard = j.candidates?.[0]?.content?.parts?.map(p => p.text || '').join(' ') || '';
    const extra = words(heard).length - words(text).length;
    return { ok: Math.abs(extra) <= 2, heard: heard.trim(), extra };
  } catch (e) { return { ok: true, heard: '', skipped: clean(e.message) }; }
}
/** speak + check, con un reintento si leyó de más. */
async function speakChecked(text, o) {
  let r = await speak(text, o), c = await check(r.wav, text);
  if (!c.ok) { console.warn(`  ! leyó de más (${c.extra} palabras), reintento`); r = await speak(text, o); c = await check(r.wav, text); }
  if (!c.ok) console.warn(`  ! sigue distinto: "${c.heard}"`);
  return r;
}

const ffmpeg = (args) => {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostdin', '-y', ...args]);
  if (r.status !== 0) throw new Error('ffmpeg: ' + String(r.stderr).slice(-400));
};
const slug = (s) => s.replace(/[^a-zA-Z0-9_-]+/g, '_');

async function samples() {
  const voices = (arg('--voices') || 'Charon,Algenib,Fenrir').split(',').map(s => s.trim()).filter(Boolean);
  const { NARRATION } = await import(pathToFileURL(join(ROOT, 'src/cinema/narration.js')).href);
  const text = arg('--text') || NARRATION.intro[0].text;
  const out = join(ROOT, 'shots/voice');
  mkdirSync(out, { recursive: true });
  for (const v of voices) {
    const { wav: w, model } = await speakChecked(text, { voice: v, model: arg('--model') });
    const f = join(out, `muestra-${slug(v)}.wav`);
    writeFileSync(f, w);
    // .m4a para mandar (el mismo proceso que el juego: pico parejo y AAC)
    ffmpeg(['-i', f, '-af', 'silenceremove=start_periods=1:start_threshold=-50dB,loudnorm=I=-18:TP=-1.5', '-ac', '1', '-ar', '44100', '-c:a', 'aac', '-b:a', '128k', f.replace(/\.wav$/, '.m4a')]);
    console.log(`  ${v.padEnd(10)} ${model}  → shots/voice/muestra-${slug(v)}.m4a`);
  }
}

async function record() {
  const name = arg('--script'), voice = arg('--voice', VOICE), only = arg('--only');
  const { NARRATION } = await import(pathToFileURL(join(ROOT, 'src/cinema/narration.js')).href);
  const lines = NARRATION[name];
  if (!lines) throw new Error(`No hay guion "${name}" en src/cinema/narration.js`);
  const tmp = join(ROOT, 'shots/voice/wav');
  mkdirSync(tmp, { recursive: true });
  const done = [];
  for (const l of lines) {
    if (only && l.id !== only) continue;
    const { wav: w, model } = await speakChecked(l.text, { voice: l.voice || voice, model: arg('--model') });
    const f = join(tmp, slug(l.id) + '.wav');
    writeFileSync(f, w);
    done.push({ id: 'voice/' + l.id.replace(/^voice\//, ''), wav: f });
    console.log(`  ${l.id.padEnd(14)} ${model}`);
  }
  // .wav → .m4a en assets/audio/voice/ y entrada en el manifest
  const list = join(tmp, 'list.json');
  writeFileSync(list, JSON.stringify(done));
  const r = spawnSync(process.execPath, [join(ROOT, 'tools/audio/prepare.mjs'), '--voice', list], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error('prepare.mjs --voice falló');
}

async function models() {
  const j = await call('models?pageSize=200');
  for (const m of j.models || []) if (/tts|audio/i.test(m.name)) console.log('  ' + m.name.replace('models/', ''));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const job = has('--models') ? models : has('--samples') ? samples : has('--script') ? record : null;
  if (!job) { console.log('Uso: --samples | --script <id> --voice <voz> | --models'); process.exit(1); }
  job().catch(e => { console.error('✗', clean(e.message || e)); process.exit(1); });
}
