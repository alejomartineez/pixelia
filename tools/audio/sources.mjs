// Qué se toma de cada descarga y cómo se prepara (PLAN-QUIEBRE §K5–K6). Lo lee prepare.mjs.
// Las rutas son relativas a la carpeta de descargas (--src), con una subcarpeta por archivo bajado.
// cat: inst (instrumentos del sampler, mono) · amb (camas en loop, estéreo) · sfx (sueltos, mono)
// note: nota MIDI real (60 = Do central). VSCO numera las octavas una más abajo: su C4 suena C5.
// trim: [desde, duración] en segundos · loop: segundos del fundido del punto de loop (camas)

const PIANO_DIR = 'x_piano/UprightPianoKW-small-SFZ+FLAC-20190703/samples/';
const NAME = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
const midi = (n) => { const m = /^([A-G]#?)(-?\d)$/.exec(n); return 12 * (Number(m[2]) + 1) + NAME[m[1]]; };
const safe = (n) => n.replace('#', 's');

const inst = [];
for (const n of ['F#2', 'B2', 'D#3', 'F#3', 'A3', 'C4', 'D#4', 'F#4', 'A4', 'C5', 'D#5', 'F#5', 'A5', 'C6', 'D#6'])
  inst.push({ id: `piano/${safe(n)}`, inst: 'piano', note: midi(n), cat: 'inst', src: `${PIANO_DIR}${n}vH.flac`, trim: [0, 4.5], fadeOut: 0.8, src0: 'piano' });
for (const n of ['C3', 'E3', 'A3', 'C4', 'E4', 'A4', 'C5', 'E5', 'A5', 'C6'])
  inst.push({ id: `flute/${safe(n)}`, inst: 'flute', note: midi(n) + 12, cat: 'inst', src: `vsco_flute/LDFlute_susvib_${n}_v1_1.wav`, trim: [0, 4], fadeOut: 0.6, src0: 'vsco' });
for (const n of ['G2', 'A2', 'B2', 'D3', 'F#3', 'A3', 'C4', 'E4', 'G4', 'B4', 'D5'])
  inst.push({ id: `pizz/${safe(n)}`, inst: 'pizz', note: midi(n) + 12, cat: 'inst', src: `vsco_pizz/VlnEns_Pizz_${n}_v2_rr1.wav`, trim: [0, 1.6], fadeOut: 0.4, src0: 'vsco' });
// timbales: cinco parches, cada uno con su afinación (se mide al preparar)
for (let i = 1; i <= 5; i++)
  inst.push({ id: `timp/${i}`, inst: 'timp', note: null, cat: 'inst', src: `vsco_timp/Timpani${i}_Hit_v3_rr1_Sum.wav`, trim: [0, 4], fadeOut: 1.2, src0: 'vsco' });
// coro "aah": una sola nota, el sampler la afina (la nota se mide al preparar)
inst.push({ id: 'choir/aah', inst: 'choir', note: null, cat: 'inst', src: 'fs_choir/choir.mp3', trim: [0.05, 7.2], fadeOut: 1.5, src0: 'fs:211494' });

const amb = [
  { id: 'amb/wind', src: 'fs_wind/wind.mp3', trim: [2, 26], loop: 3, src0: 'fs:697217' },
  { id: 'amb/sea', src: 'fs_sea/sea.mp3', trim: [4, 28], loop: 4, src0: 'fs:531015' },
  { id: 'amb/forest', src: 'fs_forest/forest.mp3', trim: [6, 28], loop: 3, src0: 'fs:275690' },
  { id: 'amb/crickets', src: 'fs_crickets/crickets.mp3', trim: [10, 24], loop: 3, src0: 'fs:171823' },
  { id: 'amb/rain', src: 'fs_rain/rain.mp3', trim: [2, 24], loop: 3, src0: 'fs:242889' },
  { id: 'amb/fire', src: 'fs_fire/fire.mp3', trim: [1, 17], loop: 2.5, src0: 'fs:363092' },
  { id: 'amb/cave', src: 'fs_cave/cave.mp3', trim: [5, 28], loop: 4, src0: 'fs:38963' },
  { id: 'amb/town', src: 'fs_town/town.mp3', trim: [3, 28], loop: 3, src0: 'fs:578072' },
].map(e => ({ ...e, cat: 'amb' }));

const K = 'x_k_iface/Audio/', U = 'x_k_uisfx/', P = 'x_k_rpg/OGG/';
const sfx = [
  // sueltos del paisaje
  { id: 'sfx/thunder', src: 'fs_thunder/thunder.mp3', trim: [0, 6.1], fadeOut: 1.5, src0: 'fs:193170' },
  { id: 'sfx/owl', src: 'fs_owl/owl.mp3', trim: [0, 4.3], fadeOut: 0.5, src0: 'fs:465697' },
  { id: 'sfx/birds1', src: 'fs_birds/birds.mp3', trim: [0, 2.2], fadeOut: 0.3, src0: 'fs:182502' },
  { id: 'sfx/birds2', src: 'fs_birds/birds.mp3', trim: [2.2, 2.2], fadeOut: 0.3, src0: 'fs:182502' },
  { id: 'sfx/anvil1', src: 'fs_anvil/anvil.mp3', trim: [0, 1.6], fadeOut: 0.4, src0: 'fs:363169' },
  { id: 'sfx/anvil2', src: 'fs_anvil/anvil.mp3', trim: [5, 1.6], fadeOut: 0.4, src0: 'fs:363169' },
  // interfaz (madera y metal)
  ...['click_001', 'click_002', 'click_003', 'select_001', 'select_002', 'open_001', 'open_002', 'close_001', 'close_002',
    'error_004', 'error_006', 'confirmation_001', 'confirmation_002', 'drop_002', 'scroll_002', 'toggle_002', 'pluck_001', 'glass_001', 'tick_002']
    .map(n => ({ id: 'ui/' + n.replace(/_0+/, ''), src: K + n + '.ogg', src0: 'kenney:interface' })),
  ...['click3', 'switch7', 'switch22', 'rollover2'].map(n => ({ id: 'ui/k' + n, src: U + n + '.wav', src0: 'kenney:uisfx' })),
  // acciones (RPG)
  ...['footstep00', 'footstep01', 'footstep02', 'footstep03', 'footstep04', 'footstep05', 'bookFlip1', 'bookFlip2', 'bookOpen',
    'bookClose', 'cloth1', 'cloth3', 'creak1', 'creak2', 'chop', 'metalClick', 'metalLatch', 'handleCoins', 'handleCoins2',
    'doorOpen_1', 'doorClose_1', 'dropLeather', 'metalPot1', 'knifeSlice', 'drawKnife1']
    .map(n => ({ id: 'act/' + n.replace('_', ''), src: P + n + '.ogg', src0: 'kenney:rpg' })),
].map(e => ({ cat: 'sfx', ...e }));

export const SOURCES = [...inst, ...amb, ...sfx];

// origen, autor y licencia de cada descarga (LICENSES.md)
export const ORIGINS = {
  piano: { name: 'Upright Piano KW (small)', author: 'FreePats (Roberto y Gonzalo)', url: 'https://freepats.zenvoid.org/Piano/acoustic-grand-piano.html', file: 'https://freepats.zenvoid.org/Piano/UprightPianoKW/UprightPianoKW-small-SFZ+FLAC-20190703.7z', license: 'CC0 1.0' },
  vsco: { name: 'VSCO 2 Community Edition', author: 'Versilian Studios (Sam Gossner)', url: 'https://github.com/sgossner/VSCO-2-CE', file: 'https://raw.githubusercontent.com/sgossner/VSCO-2-CE/master/ (flauta susvib, pizzicato de violines v2 rr1, timbales Hit_v3_rr1)', license: 'CC0 1.0' },
  'kenney:interface': { name: 'Interface Sounds 1.0', author: 'Kenney', url: 'https://kenney.nl/assets/interface-sounds', file: 'https://opengameart.org/sites/default/files/kenney_interfaceSounds.zip', license: 'CC0 1.0' },
  'kenney:uisfx': { name: 'UI SFX Set', author: 'Kenney', url: 'https://kenney.nl', file: 'https://opengameart.org/sites/default/files/UI_SFX_Set.zip', license: 'CC0 1.0' },
  'kenney:rpg': { name: 'RPG Audio', author: 'Kenney', url: 'https://kenney.nl/assets/rpg-audio', file: 'https://opengameart.org/sites/default/files/RPGsounds_Kenney.zip', license: 'CC0 1.0' },
  'fs:697217': { name: 'Looping Gentle Wind Ambience on an Open Desert Plain', author: 'dhallcomposer', url: 'https://freesound.org/s/697217/', license: 'CC0 1.0' },
  'fs:531015': { name: 'Ocean Waves', author: 'Noted451', url: 'https://freesound.org/s/531015/', license: 'CC0 1.0' },
  'fs:275690': { name: 'Singing Birds', author: 'lorenzgillner', url: 'https://freesound.org/s/275690/', license: 'CC0 1.0' },
  'fs:171823': { name: 'crickets_creek', author: 'rhapsodize', url: 'https://freesound.org/s/171823/', license: 'CC0 1.0' },
  'fs:242889': { name: 'Rain from Indoors - Perfect loop', author: 'samesamesame', url: 'https://freesound.org/s/242889/', license: 'CC0 1.0' },
  'fs:363092': { name: 'Fire Crackle and Flames 002', author: 'TheWoodlandNomad', url: 'https://freesound.org/s/363092/', license: 'CC0 1.0' },
  'fs:193170': { name: 'thunder', author: 'netaj', url: 'https://freesound.org/s/193170/', license: 'CC0 1.0' },
  'fs:38963': { name: 'archi_soundscape_cavern3', author: 'ElanHickler', url: 'https://freesound.org/s/38963/', license: 'CC0 1.0' },
  'fs:578072': { name: 'medieval_village_atmosphere', author: 'ramonmineiro', url: 'https://freesound.org/s/578072/', license: 'CC0 1.0' },
  'fs:465697': { name: 'Owl Hoot', author: 'Breviceps', url: 'https://freesound.org/s/465697/', license: 'CC0 1.0' },
  'fs:182502': { name: 'Birds Chirping 02', author: 'swiftoid', url: 'https://freesound.org/s/182502/', license: 'CC0 1.0' },
  'fs:363169': { name: 'Hammering on Anvil', author: 'SamsterBirdies', url: 'https://freesound.org/s/363169/', license: 'CC0 1.0' },
  'fs:211494': { name: 'choir_aah', author: 'Diboz', url: 'https://freesound.org/s/211494/', license: 'CC0 1.0' },
};
