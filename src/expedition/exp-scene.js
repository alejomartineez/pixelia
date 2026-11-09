// Escena `expedition` (DESIGN-CORE.md §2.10): diorama vóxel de la grilla con niebla, el grupo caminando y las decisiones.
// Con la ciudad (Fase 2): la salida la arma expedition.js (startExpedition, desde el panel de Expedición) y al terminar
// se acredita enseguida (finishExpedition). La salida en curso se guarda en state.expedition.active y se retoma al volver
// a entrar (o al recargar). Sin Casa de Expediciones (o con &proto=1) queda la salida de práctica de la Fase 1: roles y
// provisiones fijos (EXP.prototype) y el botín solo se muestra.
//   router.go('expedition', { resume: true })        retoma la salida en curso (o arma una con region/kind si no hay)
//   ?scene=expedition                práctica (o la salida en curso) · &short=1 salida corta
//   &region=sierras&zone=2           otra región o zona · &new=1 descarta la salida guardada · &seed=123 semilla fija
// Casilla `enemigo` (DESIGN-COMBAT.md §13): Pelear pasa el control a la escena `combat` con la pelea guardada en
// state.expedition.active.battle; al cerrar el resultado vuelve acá (router.go('expedition', { resume, fight })) y se
// anima lo que dejó: el botín o la vuelta a la casilla anterior. Una salida guardada en medio de una pelea la retoma.
import { actionFor } from '../core/keys.js';
import * as THREE from 'three';
import { createPixelRenderer, addLights, setIsoCamera, disposeObject, shade } from '../core/voxel.js';
import { iconUrl } from '../core/icons.js';
import { voxelModel, natureModel } from '../city/models.js';
import { avatarModel, randomLook } from '../avatar/avatar.js';
import { EXP, REGIONS, MATERIALS, HAZARDS, CONTENT, ringOf } from './exp-data.js';
import { hashSeed } from './exp-gen.js';
import * as R from './exp-rules.js';
import { createExpAmbience } from './exp-ambience.js';
import { hasBase, startExpedition, finishExpedition, expeditionStatus, creditFight, combatState } from './expedition.js';
import { ENCOUNTERS, ENEMIES } from '../combat/combat-data.js';
import { expPlace, expEchoSpots } from '../core/ambience.js';
import { createEcho } from '../story/echo-fx.js';
import { createExpGuide, guidedRun } from './exp-guide.js';
import { expEcho, seeEcho } from '../story/echoes.js';
import { PAGE_BY_ID } from '../story/story-data.js';
import { icon as iconHtml } from '../core/icons.js';
import { injectStyle, buildDom, openDecision, openResult, openMenu, openConfirmFail, matsHtml, provTxt, ICONS } from './exp-ui.js';

// ---------------------------------------------------------------- arte de las casillas
const TOP_H = { llano: 2, bosque: 2, colina: 4, pantano: 2, roca: 3 };   // alto de la losa en vóxeles
const topY = (terrain) => (TOP_H[terrain] || 2) / 8;
const GRASS = { llano: ['#a9c27a', '#9fba70'], bosque: ['#8aae63', '#7fa35a'], colina: ['#b7c784', '#aabd78'], pantano: ['#93a86f', '#879c66'], roca: ['#a9a093', '#9c9386'] };
const DIRT = '#9a7a58', DIRT_D = '#86684b';
const WATER = '#7fb0bf', WATER_L = '#a8cdd6', WATER_D = '#6a9cab';

function drawTile(m, terrain, variant, opts = {}) {
  const v = m.v, H = TOP_H[terrain] || 2;
  const [a, b] = GRASS[terrain] || GRASS.llano;
  for (let x = 0; x < 8; x++) for (let z = 0; z < 8; z++) {
    for (let y = 0; y < H - 1; y++) v.set(x, y, z, (x + y + z) % 3 ? DIRT : DIRT_D);
    const n = (x * 7 + z * 13 + variant * 5) % 11;
    v.set(x, H - 1, z, n < 3 ? b : a);
  }
  if (terrain === 'colina') {   // lomada: un escalón más en el medio
    for (let x = 1; x < 7; x++) for (let z = 1; z < 7; z++) if ((x - 3.5) ** 2 + (z - 3.5) ** 2 < 7) v.set(x, H, z, (x + z) % 4 ? a : shade(a, 0.06));
  }
  if (terrain === 'pantano') {   // charcos y juncos
    for (let x = 0; x < 8; x++) for (let z = 0; z < 8; z++) {
      const w = Math.sin(x * 0.9 + variant) + Math.cos(z * 1.1 + variant * 2);
      if (w > 0.55) v.set(x, H - 1, z, w > 1.2 ? WATER_L : WATER);
    }
    for (const [x, z] of [[1, 1], [6, 2], [2, 6], [5, 5]].slice(0, 3 + variant % 2)) { v.box(x, H, z, 1, 2 + (x % 2), 1, '#c2ad66'); v.set(x, H + 2 + (x % 2), z, '#8a6a3a'); }
  }
  if (terrain === 'roca') {   // piedras grandes
    const r = (x, z, h, c) => v.box(x, H, z, 2, h, 2, (xx, yy) => (yy === H + h - 1 ? shade(c, 0.1) : c));
    r(1, 1, 2, '#9b9286'); r(5, 2, 3, '#8c8375'); r(2, 5, 1, '#a49b8c'); if (variant % 2) r(5, 5, 2, '#9b9286');
  }
  if (opts.trail && !opts.river) {   // huella del camino: por acá se vuelve
    for (const [x, z] of [[3, 1], [4, 2], [3, 3], [4, 4], [3, 5], [4, 6]]) v.set(x, H - 1, z, (x + z) % 2 ? '#c9b48a' : '#bfa97e');
  }
  if (opts.river) {   // río que cruza la casilla de izquierda a derecha
    for (let x = 0; x < 8; x++) for (let z = 2; z < 6; z++) {
      for (let y = Math.max(0, H - 2); y < H; y++) v.set(x, y, z, y === H - 1 ? ((x + z * 3 + variant) % 5 === 0 ? WATER_L : WATER) : WATER_D);
      for (let y = H; y < H + 3; y++) v.remove?.(x, y, z);
    }
    if (opts.ford) for (const x of [1, 3, 5, 7]) v.box(x - 1, H - 1, 3 + (x % 3 === 0 ? 1 : 0), 2, 1, 2, '#b8ad9c');   // piedras del vado
  }
  m.height = H;
}
/** Manto de niebla: una losa baja con lomos redondeados; las casillas vecinas se juntan en un solo manto. */
function drawFog(m, variant, hint) {
  const v = m.v;
  const [top, mid, low] = hint ? ['#f6ecd2', '#eadcb6', '#dccca4'] : ['#f2f3ef', '#e2e6e3', '#cfd5d2'];
  for (let x = 0; x < 8; x++) for (let z = 0; z < 8; z++) {
    const bump = 2.2 + Math.sin(x * 0.8 + variant * 1.7) * 0.9 + Math.cos(z * 0.9 + variant * 2.3) * 0.9;
    const h = Math.max(1, Math.round(bump));
    for (let y = 0; y <= h; y++) v.set(x, y, z, y === h ? top : y >= h - 1 ? mid : low);
  }
  m.height = 4;
}
function drawBase(m) {   // carreta con lona y banderín: la base del grupo
  const v = m.v, y0 = 2;
  v.box(1, y0, 2, 6, 1, 4, '#8a5d36');
  v.box(1, y0 + 1, 2, 6, 2, 1, '#a8774a'); v.box(1, y0 + 1, 5, 6, 2, 1, '#a8774a');
  for (let x = 1; x < 7; x++) for (let y = 0; y < 3; y++) { v.set(x, y0 + 3 + y, 2 + y, '#efe3cc'); v.set(x, y0 + 3 + y, 5 - y, '#efe3cc'); }
  for (const x of [1, 6]) { v.box(x, y0 - 1, 1, 1, 2, 1, '#3f342c'); v.box(x, y0 - 1, 6, 1, 2, 1, '#3f342c'); }
  v.box(7, y0, 6, 1, 7, 1, '#7a5a3a'); v.box(6, y0 + 5, 6, 1, 2, 1, '#ee8a5c'); v.set(5, y0 + 6, 6, '#ee8a5c');
}
const PROPS = {
  ruina(m, y) { const v = m.v; const c = '#b8ad9c', d = '#9e9384';
    v.box(1, y, 1, 2, 5, 2, c); v.box(1, y + 5, 1, 2, 1, 1, d); v.box(5, y, 1, 2, 3, 2, c); v.box(2, y, 5, 4, 2, 1, d); v.box(5, y, 4, 1, 1, 1, c); v.box(3, y, 3, 1, 1, 1, '#6f8a4f'); },
  campamento(m, y) { const v = m.v;
    for (let i = 0; i < 4; i++) v.box(1 + i, y + i, 2, 6 - 2 * i, 1, 4, i % 2 ? '#c98a52' : '#d9a066');
    v.box(3, y, 2, 2, 2, 1, '#5a4632');
    v.box(5, y, 6, 2, 1, 1, '#7a5a3a'); m.light.set(5, y + 1, 6, '#ffb347'); m.light.set(6, y + 1, 6, '#ffd166'); m.light.set(6, y + 2, 6, '#ffb347'); },
  aldea(m, y) { const v = m.v;
    const house = (x, z, w, c, roof) => { v.box(x, y, z, w, 3, 3, c); for (let i = 0; i < 2; i++) v.box(x - (i ? 0 : 0), y + 3 + i, z + i, w, 1, 3 - 2 * i, roof); v.set(x + 1, y + 1, z + 3, '#5a4632'); };
    house(0, 1, 4, '#efe3cc', '#a8492f'); house(4, 4, 4, '#e6d8c3', '#7a5a3a'); v.set(1, y, 6, '#6f8a4f'); },
  mirador(m, y) { const v = m.v; const w = '#8a5d36';
    for (const [x, z] of [[2, 2], [5, 2], [2, 5], [5, 5]]) v.box(x, y, z, 1, 8, 1, w);
    v.box(1, y + 8, 1, 6, 1, 6, '#a8774a'); v.box(2, y + 11, 2, 4, 1, 4, '#a8492f'); v.box(3, y + 12, 3, 2, 1, 2, '#a8492f');
    for (const [x, z] of [[1, 1], [6, 1], [1, 6], [6, 6]]) v.box(x, y + 9, z, 1, 2, 1, w);
    for (let i = 0; i < 8; i += 2) v.set(4, y + i, 6, '#7a5a3a'); },
  objetivo(m, y) { const v = m.v;
    v.box(1, y, 2, 5, 4, 4, '#c9b89c'); v.box(1, y + 4, 2, 5, 1, 4, '#8c8375'); v.box(2, y + 5, 3, 3, 1, 2, '#8c8375'); v.box(3, y, 5, 1, 2, 1, '#5a4632');
    v.box(6, y, 6, 1, 11, 1, '#5a4632'); v.box(6, y + 8, 5, 1, 3, 1, '#ee8a5c'); v.box(6, y + 9, 4, 1, 2, 1, '#ee8a5c'); v.set(6, y + 11, 6, '#ffd166'); },
  derrumbe(m, y) { const v = m.v;
    const s = [[0, 1, 3, '#9b9286'], [2, 0, 4, '#8c8375'], [4, 2, 3, '#a49b8c'], [6, 1, 2, '#9b9286'], [1, 4, 2, '#8c8375'], [4, 5, 2, '#a49b8c'], [3, 3, 5, '#9b9286']];
    for (const [x, z, h, c] of s) v.box(x, y, z, 2, h, 2, (xx, yy) => (yy === y + h - 1 ? shade(c, 0.08) : c)); },
  tormenta(m, y) { const v = m.v;
    v.sphere(3.5, y + 11, 3.5, 3.6, 1.6, 3, (xx, yy) => (yy > y + 11 ? '#8d949a' : '#6f767c'));
    for (let i = 0; i < 6; i++) { const x = 1 + (i * 3) % 7, z = 1 + (i * 5) % 6; v.box(x, y + 3 + (i % 3), z, 1, 2, 1, '#a8cdd6'); }
    m.light.set(4, y + 8, 4, '#fff3a0'); m.light.set(3, y + 7, 4, '#fff3a0'); m.light.set(4, y + 6, 4, '#fff3a0'); },
  lobos(m, y) { const v = m.v;
    const wolf = (x, z, c) => { v.box(x, y + 1, z, 2, 2, 4, c); v.box(x, y + 2, z + 4, 2, 2, 2, c); v.set(x, y + 4, z + 4, c); v.set(x + 1, y + 4, z + 4, c);
      v.set(x, y, z, '#4a4a4a'); v.set(x + 1, y, z + 3, '#4a4a4a'); v.set(x, y + 2, z + 6, '#3b2340'); v.box(x, y + 2, z - 1, 1, 1, 1, c); };
    wolf(1, 0, '#8b8f94'); wolf(5, 1, '#6f747a'); },
  madera(m, y) { const v = m.v; for (let i = 0; i < 3; i++) v.box(1, y + (i === 2 ? 2 : 0), 1 + i * 2 - (i === 2 ? 3 : 0), 6, 2, 2, (xx) => (xx === 1 || xx === 6 ? '#d9b46a' : '#8a5d36')); },
  piedra(m, y) { const v = m.v; v.box(1, y, 1, 3, 2, 3, '#a49b8c'); v.box(4, y, 3, 3, 3, 3, '#9b9286'); v.box(2, y, 5, 2, 1, 2, '#8c8375'); },
  mineral(m, y) { const v = m.v; v.box(2, y, 2, 4, 3, 4, '#6f675c'); v.set(3, y + 3, 3, '#c7ccd1'); v.set(5, y + 2, 4, '#d98b4a'); v.set(2, y + 1, 5, '#c7ccd1'); v.set(4, y + 3, 5, '#d98b4a'); },
  hierbas(m, y) { const v = m.v; for (const [x, z] of [[1, 2], [4, 1], [2, 5], [5, 4], [6, 6]]) { v.box(x, y, z, 2, 2, 2, '#6f9a52'); v.set(x, y + 2, z, (x + z) % 2 ? '#e6d8c3' : '#c98a52'); } },
};
// casilla `enemigo`: lo que se ve de lejos según quién espera (lobos, bichos de veta, piratas)
PROPS.enemigo = function (m, y, enc) {
  const v = m.v, foes = ENCOUNTERS[enc]?.enemies || ['lobo'];
  const kind = foes.includes('bestia') ? 'bestia' : foes.includes('bicho') ? 'bicho' : foes.some(t => /grumete|tirador|capitana/.test(t)) ? 'pirata' : 'lobo';
  if (kind === 'bestia') {
    // la poza honda: agua negra, juncos y cuatro ojos que miran desde abajo
    v.box(0, y, 0, 8, 1, 8, (xx, yy, zz) => ((xx === 0 || xx === 7 || zz === 0 || zz === 7) ? '#3a3024' : '#16232a'));
    for (const [x, z, h] of [[0, 1, 4], [1, 7, 3], [7, 2, 5], [6, 7, 3], [0, 5, 3]]) v.box(x, y + 1, z, 1, h, 1, '#6f6a3a');
    for (const [x, z] of [[2, 4], [3, 4], [5, 4], [6, 4]]) m.light.set(x, y + 1, z, '#d8ff7a');
    return;
  }
  // estaca con trapo rojo: acá hay pelea
  v.box(6, y, 6, 1, 8, 1, '#5a4632'); v.box(6, y + 6, 5, 1, 2, 1, '#a8492f'); v.set(6, y + 7, 4, '#a8492f');
  if (kind === 'lobo') {
    const wolf = (x, z, c) => { v.box(x, y + 1, z, 2, 2, 4, c); v.box(x, y + 2, z + 4, 2, 2, 2, c); v.set(x, y + 4, z + 4, c); v.set(x + 1, y + 4, z + 4, c);
      v.set(x, y, z, '#3b3b3b'); v.set(x + 1, y, z + 3, '#3b3b3b'); v.box(x, y + 2, z - 1, 1, 1, 1, c); };
    wolf(0, 0, '#6f747a'); wolf(3, 2, '#585d63');
    m.light.set(0, y + 3, 6, '#ffd166'); m.light.set(3, y + 3, 7, '#ffd166');
  } else if (kind === 'bicho') {
    for (const [x, z] of [[0, 1], [3, 3], [1, 5]]) { v.box(x, y, z, 2, 2, 2, '#6f675c'); m.light.set(x, y + 2, z, '#8fd3ff'); }
  } else {
    v.box(1, y, 2, 2, 4, 2, '#3f342c'); v.box(1, y + 4, 2, 2, 2, 2, '#c99a72'); v.box(1, y + 6, 2, 2, 1, 2, '#a8492f');
    v.box(4, y, 3, 1, 5, 1, '#c7ccd1');
  }
};
// el faro viejo de la Costa (paso 6b): torre de piedra gastada, la linterna apagada (encendida si ya se cumplió)
PROPS.faro = function (m, y, sub) {
  const v = m.v, st = '#8f8a80', st_d = '#6f6a62', rust = '#7a4a32';
  v.box(1, y, 1, 6, 2, 6, st_d);
  for (let k = 0; k < 9; k++) { const w = k < 3 ? 4 : k < 6 ? 3 : 2, o = (8 - w) / 2; v.box(o, y + 2 + k, o, w, 1, w, (xx, yy) => ((yy + xx) % 5 === 0 ? st_d : k % 3 === 2 ? '#a8a296' : st)); }
  v.box(2, y + 11, 2, 4, 1, 4, rust);
  v.box(3, y + 12, 3, 2, 2, 2, sub === 'lit' ? '#ffd166' : '#3a3f45');
  if (sub === 'lit') { m.light.set(3, y + 13, 3, '#ffe9a8'); m.light.set(4, y + 12, 4, '#ffd166'); }
  v.box(3, y + 14, 3, 2, 1, 2, rust);
  v.box(4, y, 6, 1, 2, 1, '#3b2f26');
};
const PROP_KEY = (cell) => (cell.content === 'recurso' ? cell.sub : cell.content === 'peligro' ? cell.sub : cell.content === 'objetivo' && cell.faro ? 'faro' : cell.content);

// ---------------------------------------------------------------- escena
export default function create(ctx) {
  const { store, ui, audio, bus } = ctx;
  let root, r, dom, styleEl, run = null, meta = null;
  const offs = [];
  let alive = false, busy = false, card = null, modal = null;
  const world = new THREE.Group();
  const cellObjs = [];         // por casilla: { tile, prop, badge, fog, key }
  const texCache = new Map();  // emoji -> SpriteMaterial
  let party = [];              // [{ obj, off:[dx,dz] }]
  let partyPos = new THREE.Vector3();
  const highlight = [];
  let hintGroup = null;
  const camState = { angle: 0.14, pitch: 0.95, view: 12, target: new THREE.Vector3() };
  const anims = new Set();     // tweens: { t, dur, fn(k), done }
  let shownTips = {};
  let expAmb = null;           // ambiente: hora, clima, niebla por distancia, polvo y huellas (exp-ambience.js)
  let guide = null;            // la primera expedición guiada (plan §E6, exp-guide.js)
  let echo = null;             // eco de noche en una ruina ya pisada (L6, paso 6b): { fx, id, x, y }

  const music = audio.songs?.includes?.('expedition') ? 'expedition' : 'calm';

  // ---------- estado guardado ----------
  function expState() {
    const s = store.state;
    if (!s.expedition || typeof s.expedition !== 'object') s.expedition = {};
    const e = s.expedition;
    e.attempts = e.attempts || {};
    if (e.active === undefined) e.active = null;
    return e;
  }
  /** Salida de la ciudad (no de práctica): se acredita en la ciudad. */
  const cityRun = () => !!run?.city;
  function persist() {
    const e = expState();
    // peleas que terminaron sin pasar por la escena del combate (la resolución rápida): se acreditan acá
    if (run) for (const f of run.fights || []) if (!f.credited) { try { creditFight(run, f); } catch (err) { console.error('[expedition] pelea', err); } }
    // la salida de la ciudad se acredita apenas termina (aunque la app se cierre antes de ver el resultado)
    if (run && run.ended && cityRun() && !run.city.summary) { try { finishExpedition(run); } catch (err) { console.error('[expedition] acreditar', err); } }
    e.active = run && !run.ended ? run : null;
    store.markDirty();
    try { store.save(); } catch {}
  }
  function newRun(p) {
    const e = expState();
    // con la ciudad: si hay Casa de Expediciones y no se pidió práctica, la arma expedition.js
    if (!p.proto && hasBase()) {
      const kind = p.short === '1' || p.short === true || p.kind === 'corta' ? 'corta' : 'normal';
      const res = startExpedition({ region: p.region, kind, party: p.party || null, equip: p.equip || null, daily: p.daily === '1' || p.daily === true });
      if (res.run) return res.run;
      ui.toast(res.error || 'No se pudo salir', { icon: 'info' });
      return null;
    }
    const region = REGIONS[p.region] ? p.region : 'bosque';
    const zone = Math.max(1, Math.min(5, Number(p.zone) || 1));
    const kind = p.short === '1' || p.short === true || p.kind === 'corta' ? 'corta' : 'normal';
    const attempt = (e.attempts[region] = (e.attempts[region] || 0) + 1);
    const seed = p.seed != null && p.seed !== '' ? Number(p.seed) >>> 0 : hashSeed(region, zone, attempt, store.state.created || 0, kind);
    const P = EXP.prototype;
    const nr = R.newRun({
      region, zone, kind, seed, party: P.party.slice(), equip: P.equip.slice(),
      prov: kind === 'corta' ? EXP.kinds.corta.prov : P.prov,
      mods: { tier: Object.fromEntries(P.party.map(id => [id, P.level])), cargoMax: P.cargoMax },
    });
    // ?hour=21 en una práctica: la salida arranca a esa hora (capturas y pruebas de la noche, PLAN-QUIEBRE §J3)
    const qh = new URLSearchParams(location.search).get('hour');
    if (qh != null && nr.clock) nr.clock.start = Math.max(0, Math.min(23.9, Number(qh) || 0));
    bus.emit('expedition:started', { region, zone, kind, party: nr.party, equip: nr.equip, prov: nr.prov, prototype: true });   // práctica
    return nr;
  }

  // ---------- coordenadas ----------
  const cellPos = (x, y) => new THREE.Vector3(x - (run.w - 1) / 2, 0, y - (run.h - 1) / 2);
  const cellTop = (x, y) => { const c = run.cells[y * run.w + x]; return c.seen ? topY(c.terrain) : 1 / 8; };
  function screenOf(x, y, lift = 0.4) {
    const p = cellPos(x, y); p.y = cellTop(x, y) + lift;
    return r.toScreen(p);
  }

  // ---------- sprites de ícono ----------
  function badgeMat(emoji) {
    let m = texCache.get(emoji);
    if (!m) {
      const tex = new THREE.TextureLoader().load(iconUrl(emoji, 64));
      tex.colorSpace = THREE.SRGBColorSpace; tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter;
      m = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false });
      texCache.set(emoji, m);
    }
    return m;
  }
  function badge(emoji, size = 0.46) {
    const sp = new THREE.Sprite(badgeMat(emoji));
    sp.scale.set(size, size, 1);
    sp.renderOrder = 10;
    sp.userData.keepMat = true;
    return sp;
  }

  // ---------- casillas ----------
  function cellEmoji(c) {
    if (!c.seen || c.done) return null;
    if (c.content === 'recurso') return MATERIALS[c.sub]?.icon;
    if (c.content === 'peligro') return HAZARDS[c.sub]?.icon;
    if (c.content === 'enemigo') return CONTENT.enemigo.icon;
    if (c.content === 'objetivo') return 'flag';
    return CONTENT[c.content]?.icon || null;
  }
  function clearCellObj(o) {
    for (const k of ['tile', 'prop', 'badge', 'fog', 'nat', 'drop']) if (o[k]) { world.remove(o[k]); if (k === 'fog' || k === 'nat') {} o[k] = null; }
  }
  /** Rearma la casilla i según el estado del motor. reveal = animar la niebla que se abre. */
  function buildCell(i, reveal = false) {
    const c = run.cells[i], x = i % run.w, y = (i / run.w) | 0;
    const o = cellObjs[i] || (cellObjs[i] = {});
    const isBase = x === run.base[0] && y === run.base[1];
    const river = c.seen && ((c.content === 'peligro' && c.sub === 'rio') || (c.band === 'rio'));
    const ford = river && c.band === 'rio' && c.content === 'vacio';
    const key = c.seen ? `${c.terrain}|${river ? 'r' : ''}${ford ? 'f' : ''}|${c.done ? 'd' : ''}|${c.visited ? 'v' : ''}|${cellEmoji(c) || ''}|${c.drops ? 'k' : ''}` : 'fog' + (inHint(x, y) ? 'h' : '');
    if (o.key === key) return;
    const wasFog = !!o.key?.startsWith('fog');
    o.key = key;
    const pos = cellPos(x, y);
    const oldFog = o.fog; o.fog = null;
    clearCellObj(o);
    if (!c.seen) {
      if (oldFog) world.remove(oldFog);
      const hint = inHint(x, y);
      o.key = 'fog' + (hint ? 'h' : '');
      const fv = (x * 5 + y * 3) % 4;
      o.fog = voxelModel(`exp:fog:${fv}:${hint ? 'h' : ''}`, 8, 8, (m) => drawFog(m, fv, hint));
      o.fog.position.copy(pos);
      world.add(o.fog);
      return;
    }
    const variant = (x * 3 + y * 5) % 3;
    const trail = c.visited && !isBase;
    o.tile = voxelModel(`exp:t:${c.terrain}:${variant}:${river ? 'r' : ''}${ford ? 'f' : ''}${trail ? 't' : ''}`, 8, 8, (m) => drawTile(m, c.terrain, variant, { river, ford, trail }));
    o.tile.position.copy(pos);
    world.add(o.tile);
    const ty = topY(c.terrain);
    if (c.terrain === 'bosque' && !river) {
      const n = new THREE.Group();
      const t1 = natureModel(variant === 1 ? 'pine' : 'tree', x * 11 + y * 7);
      t1.scale.setScalar(0.5); t1.position.set(-0.24, 0, -0.22); n.add(t1);
      if (c.content === 'vacio' || c.done) { const t2 = natureModel('tree', x * 5 + y * 3 + 1); t2.scale.setScalar(0.42); t2.position.set(0.26, 0, 0.2); n.add(t2); }
      n.position.set(pos.x, ty, pos.z);
      o.nat = n; world.add(n);
    }
    if (isBase) {
      o.prop = voxelModel('exp:base', 8, 8, drawBase);
      o.prop.scale.setScalar(0.6);
      o.prop.position.set(pos.x - 0.28, ty - 1.2 / 8, pos.z - 0.25);
      world.add(o.prop);
    } else {
      const pk = PROP_KEY(c);
      const showProp = pk && PROPS[pk] && !(c.done && (c.content === 'recurso' || c.content === 'peligro' || c.content === 'enemigo')) && pk !== 'rio';
      if (showProp) {
        const sub = pk === 'enemigo' ? c.sub : pk === 'faro' && c.done ? 'lit' : '';
        o.prop = voxelModel(`exp:p:${pk}${sub ? ':' + sub : ''}`, 8, 8, (m) => PROPS[pk](m, 0, sub));
        // el objeto va hacia el fondo de la casilla: adelante queda lugar para el grupo
        o.prop.position.set(pos.x - 0.12, ty, pos.z - 0.16);
        o.prop.scale.setScalar(0.72);
        if (c.done) o.prop.traverse(m => { if (m.isMesh) m.userData.static = true; });
        world.add(o.prop);
      }
    }
    const em = cellEmoji(c);
    if (em) {
      o.badge = badge(em);
      o.badge.position.set(pos.x, ty + (c.content === 'mirador' || c.content === 'objetivo' ? 1.45 : 1.0), pos.z);
      o.badge.userData.baseY = o.badge.position.y;
      o.badge.userData.phase = i * 0.7;
      world.add(o.badge);
    }
    if (c.drops) {
      const mats = Object.keys(c.drops);
      o.drop = badge(MATERIALS[mats[0]]?.icon || 'crate', 0.32);
      o.drop.position.set(pos.x + 0.3, ty + 0.35, pos.z + 0.3);
      world.add(o.drop);
    }
    if (reveal && (wasFog || oldFog)) {
      // la losa sube y la nube se va
      const t = o.tile, sy = { v: 0 };
      t.scale.set(1, 0.01, 1);
      tween(380, (k) => { sy.v = k; t.scale.set(1, Math.max(0.01, easeBack(k)), 1); if (o.prop) o.prop.scale.setScalar((isBase ? 0.6 : 0.72) * Math.max(0.01, k)); if (o.nat) o.nat.scale.setScalar(Math.max(0.01, k)); });
    }
    if (oldFog) {
      // la niebla se levanta y se deshace
      const cl = oldFog;
      world.add(cl);
      if (reveal) tween(480, (k) => { cl.position.y = k * 0.6; cl.scale.set(1 - k * 0.5, Math.max(0.02, 1 - k), 1 - k * 0.5); }, () => { world.remove(cl); });
      else world.remove(cl);
    }
  }
  function inHint(x, y) {
    const o = run.objective;
    if (!o || o.done || o.type === 'juntar' || !o.hint) return false;
    if (o.known) return x === o.cell[0] && y === o.cell[1];
    return Math.abs(x - o.hint[0]) <= 1 && Math.abs(y - o.hint[1]) <= 1;
  }
  function buildAll() {
    for (let i = 0; i < run.cells.length; i++) buildCell(i, false);
    buildHintArea();
  }
  function buildHintArea() {
    if (hintGroup) { world.remove(hintGroup); hintGroup.traverse(o => { if (o.isMesh) o.geometry.dispose(); }); hintGroup = null; }
    const v = R.view(run);
    const o = v.objective;
    if (o.done || o.type === 'juntar') return;
    hintGroup = new THREE.Group();
    const mat = hintMat;
    const cells = o.cell ? [o.cell] : [];
    if (!o.cell && o.hint) for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      const x = o.hint[0] + dx, y = o.hint[1] + dy;
      if (x >= 0 && y >= 0 && x < run.w && y < run.h) cells.push([x, y]);
    }
    for (const [x, y] of cells) {
      if (!run.cells[y * run.w + x].seen) continue;   // en la niebla, el manto ya viene dorado
      const g = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 0.92), mat);
      g.rotation.x = -Math.PI / 2;
      const p = cellPos(x, y);
      g.position.set(p.x, cellTop(x, y) + (run.cells[y * run.w + x].seen ? 0.02 : 0.06), p.z);
      g.renderOrder = 4;
      hintGroup.add(g);
    }
    if (!o.cell && o.hint) {
      const p = cellPos(o.hint[0], o.hint[1]);
      const fl = badge('flag', 0.5);
      fl.position.set(p.x, 1.05, p.z); fl.renderOrder = 11;
      hintGroup.add(fl);
    }
    world.add(hintGroup);
  }

  // ---------- grupo ----------
  function buildParty() {
    for (const p of party) { world.remove(p.obj); }
    party = [];
    // con el equipo de su clase (paso 5b, tercera parte): quien lidera y cada integrante (run.party son clases)
    const lead = avatarModel(store.state.avatar, { player: true, cls: run.mods?.leader?.cls || store.state.classes?.leader?.cls || null });
    lead.scale.setScalar(0.62);
    party.push({ obj: lead, off: [0, 0.08], delay: 0 });
    const offs2 = [[-0.26, 0.3], [0.26, 0.3], [0, 0.38]];
    run.party.forEach((role, k) => {
      const f = avatarModel(randomLook(hashSeed('exp', role, store.state.created || 1) % 9973), { npc: true, cls: role });
      f.scale.setScalar(0.48);
      party.push({ obj: f, off: offs2[k] || [0, 0.3], delay: 0.06 * (k + 1) });
    });
    for (const p of party) world.add(p.obj);
    ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2; ring.renderOrder = 6;
    world.add(ring);
    placeParty(run.pos[0], run.pos[1], 0);
  }
  function placeParty(x, y, faceY) {
    const p = cellPos(x, y); p.y = cellTop(x, y);
    partyPos.copy(p);
    ring?.position.set(p.x, p.y + 0.02, p.z + 0.12);
    for (const m of party) {
      const off = rotOff(m.off, faceY);
      m.obj.position.set(p.x + off[0], p.y, p.z + off[1]);
      m.obj.rotation.y = faceY;
    }
  }
  const ringGeo = new THREE.RingGeometry(0.34, 0.44, 28);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xfff3c2, transparent: true, opacity: 0.85, depthWrite: false });
  let ring = null;
  const rotOff = ([dx, dz], a) => [dx * Math.cos(a) + dz * Math.sin(a), -dx * Math.sin(a) + dz * Math.cos(a)];
  function walkParty(fx, fy, tx, ty, dur = 340) {
    const a = cellPos(fx, fy); a.y = cellTop(fx, fy);
    const b = cellPos(tx, ty); b.y = cellTop(tx, ty);
    const face = Math.atan2(b.x - a.x, b.z - a.z);
    return new Promise(res => {
      let done = 0;
      party.forEach(m => {
        const off = rotOff(m.off, face);
        const from = m.obj.position.clone();
        const to = new THREE.Vector3(b.x + off[0], b.y, b.z + off[1]);
        m.obj.rotation.y = face;
        m.walking = true;
        if (m === party[0] && ring) { const r0 = ring.position.clone(), r1 = new THREE.Vector3(b.x, b.y + 0.02, b.z + 0.12); tween(dur, (k) => ring.position.lerpVectors(r0, r1, k)); }
        setTimeout(() => tween(dur, (k) => {
          m.obj.position.lerpVectors(from, to, k);
          m.obj.position.y = from.y + (to.y - from.y) * k + Math.sin(k * Math.PI) * 0.16;
        }, () => { m.walking = false; if (++done === party.length) res(); }), m.delay * 1000);
      });
      partyPos.copy(b);
    });
  }

  // ---------- resaltado de vecinas ----------
  const hlMats = {
    ok: new THREE.MeshBasicMaterial({ color: 0x6fe3c1, transparent: true, opacity: 0.42, depthWrite: false }),
    unsafe: new THREE.MeshBasicMaterial({ color: 0xff6f6f, transparent: true, opacity: 0.42, depthWrite: false }),
    cant: new THREE.MeshBasicMaterial({ color: 0x8c8375, transparent: true, opacity: 0.3, depthWrite: false }),
  };
  const hlGeo = new THREE.PlaneGeometry(0.9, 0.9);
  const hintMat = new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.3, depthWrite: false });
  function refreshHighlights(v) {
    for (const h of highlight) world.remove(h);
    highlight.length = 0;
    if (busy || v.ended || v.pending || modal) return;
    for (const m of v.moves) {
      const mesh = new THREE.Mesh(hlGeo, !m.ok ? hlMats.cant : !m.safe ? hlMats.unsafe : hlMats.ok);
      mesh.rotation.x = -Math.PI / 2;
      const p = cellPos(m.x, m.y);
      mesh.position.set(p.x, cellTop(m.x, m.y) + 0.03, p.z);
      mesh.renderOrder = 5;
      world.add(mesh); highlight.push(mesh);
    }
  }
  function updateChips() {
    if (!run || !dom) return;
    const v = lastView;
    if (!v || busy || v.ended || v.pending || modal) { dom.clearChips(); return; }
    dom.chips(v.moves.map(m => {
      const s = screenOf(m.x, m.y, 0.55);
      const c = run.cells[m.y * run.w + m.x];
      return { x: m.x, y: m.y, sx: s.x, sy: s.y, cost: m.cost, ok: m.ok, safe: m.safe, hz: !c.done && (c.content === 'peligro' || c.content === 'ruina' || c.content === 'enemigo') };
    }));
  }

  // ---------- cámara ----------
  /** Encuadra la grilla en el espacio libre (entre la barra de arriba y lo de abajo). extraBottom = px tapados (tarjeta). */
  function fitCamera(extraBottom = 0, animate = false) {
    if (!r || !root) return;
    const stage = root.querySelector('.ex-stage');
    const W = stage.clientWidth || innerWidth, H = stage.clientHeight || innerHeight;
    const tgt = new THREE.Vector3(0, 0.3, 0);
    setIsoCamera(r.camera, tgt, camState.angle, 60, camState.pitch);
    r.camera.updateMatrixWorld(true);
    const inv = r.camera.matrixWorldInverse, v3 = new THREE.Vector3();
    let mnx = Infinity, mxx = -Infinity, mny = Infinity, mxy = -Infinity;
    for (let i = 0; i < 8; i++) {
      v3.set(i & 1 ? run.w / 2 : -run.w / 2, i & 2 ? 1.1 : -0.1, i & 4 ? run.h / 2 : -run.h / 2).applyMatrix4(inv);
      mnx = Math.min(mnx, v3.x); mxx = Math.max(mxx, v3.x); mny = Math.min(mny, v3.y); mxy = Math.max(mxy, v3.y);
    }
    const gw = mxx - mnx, gh = mxy - mny;
    const top = root.querySelector('.ex-top').getBoundingClientRect();
    const bot = root.querySelector('.ex-bottom').getBoundingClientRect();
    const wide = innerWidth >= 900;
    const tPx = top.bottom + 6;
    let bPx = wide ? 24 : Math.max(24, H - bot.top + 8 + 20);
    let view;
    if (extraBottom && !wide) {
      // con la tarjeta abierta: mismo zoom, la grilla sube para que se vea la fila del grupo
      view = camState.baseView || camState.view;
      bPx = extraBottom + 8;
    } else {
      const freeH = Math.max(160, H - tPx - bPx), freeW = W - 16;
      view = Math.max(gh * H / freeH, gw * H / freeW) * 1.04;
      camState.baseView = view;
    }
    const up = new THREE.Vector3().setFromMatrixColumn(r.camera.matrixWorld, 1);
    const right = new THREE.Vector3().setFromMatrixColumn(r.camera.matrixWorld, 0);
    const cy = (mny + mxy) / 2, cx = (mnx + mxx) / 2;
    let shiftPx = (tPx - bPx) / 2;
    if (extraBottom && !wide && run) {
      // que la casilla del grupo quede justo arriba de la tarjeta
      const pp = cellPos(run.pos[0], run.pos[1]).applyMatrix4(inv);
      const want = H - bPx - 46;                         // px desde arriba donde la queremos
      const nowPx = H / 2 - (pp.y - cy) * H / view;      // dónde caería sin correr
      shiftPx = Math.max(shiftPx, nowPx - want);
    }
    tgt.addScaledVector(up, cy + shiftPx * view / H).addScaledVector(right, cx);
    const from = camState.target.clone(), fromView = camState.view;
    camState.target.copy(tgt); camState.view = view;
    if (!animate || !camState.ready) {
      camState.ready = true;
      setIsoCamera(r.camera, tgt, camState.angle, 60, camState.pitch);
      r.setViewSize(view);
      return;
    }
    tween(260, (k) => {
      const e = 1 - (1 - k) * (1 - k);
      const t = from.clone().lerp(tgt, e);
      setIsoCamera(r.camera, t, camState.angle, 60, camState.pitch);
      r.setViewSize(fromView + (view - fromView) * e);
    });
  }

  // ---------- tweens ----------
  const easeBack = (k) => { const c = 1.6; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };
  function tween(ms, fn, done) { const a = { t: 0, dur: ms / 1000, fn, done }; anims.add(a); fn(0); return a; }
  const wait = (ms) => new Promise(res => setTimeout(res, ms));

  // ---------- vista y refresco ----------
  let lastView = null;
  function refresh() {
    if (!run) return;
    lastView = R.view(run);
    dom.update(lastView, meta);
    refreshHighlights(lastView);
    updateChips();
    tips(lastView);
    const say = expAmb?.sync(run);
    if (say && !lastView.ended) dom.hint(say, 6500);
  }
  function tips(v) {
    if (v.ended || v.pending || busy) return;
    const unsafe = v.moves.some(m => m.ok && !m.safe);
    // la primera salida, con Vera (pistas de un solo uso); si va guiada, no se repiten abajo
    if (guide?.active) {
      if (v.steps === 0) guide.on('start');
      else if (unsafe && guide.on('unsafe')) {}
      else if (v.objective?.cell && !v.objective.done && guide.on('objSeen')) {}
      else if (v.cargoMax && v.cargoN >= v.cargoMax) guide.on('cargoFull');
      shownTips.start = true; if (unsafe) shownTips.unsafe = true;
    }
    let t = null;
    if (!shownTips.start && v.steps === 0) { t = 'Hacé clic en una casilla vecina para avanzar. El número es lo que cuesta en provisiones.'; shownTips.start = true; }
    else if (unsafe && !shownTips.unsafe) { t = `En rojo: si das ese paso, no te alcanza para volver. ${'Volver'} siempre dice cuánto cuesta.`; shownTips.unsafe = true; }
    else if (!shownTips.far && run.cells[run.pos[1] * run.w + run.pos[0]].depth >= 7) { t = 'Lejos hay más para juntar, y también imprevistos.'; shownTips.far = true; }
    if (t) dom.hint(t, 6000);
  }
  function at(x, y) { return screenOf(x, y, 0.7); }
  function partyScreen() { const p = partyPos.clone(); p.y += 0.9; return r.toScreen(p); }
  function float(sx, sy, html) { ui.floatText(sx, sy, html); }

  // ---------- eventos del motor (animados en orden) ----------
  async function playEvents(events) {
    busy = true;
    dom.clearChips();
    refreshHighlights(lastView || R.view(run));
    let revealed = false;
    for (const e of events) {
      if (!alive) return;
      switch (e.type) {
        case 'step': {
          audio.sfx(e.cost >= 2 ? 'bump' : 'tap');
          buildCell(e.from[1] * run.w + e.from[0]);
          await walkParty(e.from[0], e.from[1], e.x, e.y, e.cost >= 3 ? 460 : e.cost >= 2 ? 400 : 330);
          expAmb?.step(e.from, [e.x, e.y]);
          buildCell(e.y * run.w + e.x);
          break;
        }
        case 'reveal': {
          for (const [x, y] of e.cells) buildCell(y * run.w + x, true);
          if (!revealed) audio.sfx('swoosh');
          revealed = true;
          buildHintArea();
          await wait(120);
          break;
        }
        case 'loot': {
          guide?.on('loot');
          const p = partyScreen();
          const parts = [];
          if (e.mats && Object.keys(e.mats).length) parts.push('+' + matsHtml(e.mats, 22));
          if (e.colonos) parts.push(`+${e.colonos} ${ui.icon(ICONS.colono, 22)}`);
          if (parts.length) { float(p.x, p.y, parts.join(' ')); audio.sfx('coin'); }
          if (e.find) { await wait(250); float(p.x, p.y - 30, `${ui.icon(ICONS.find, 22)} Hallazgo ${'★'.repeat(e.find.stars)}`); audio.sfx('star'); }
          if (e.plano) { await wait(250); float(p.x, p.y - 56, `${ui.icon(ICONS.plano, 22)} Un plano`); audio.sfx('star'); }
          if (e.left) dom.hint(`No entra todo en la carga: ${matsHtml(e.left, 16)} queda en esta casilla. Podés soltar algo para llevarlo.`, 6000);
          buildCell(run.pos[1] * run.w + run.pos[0]);
          await wait(220);
          break;
        }
        case 'lose': case 'spend': {
          const p = partyScreen();
          float(p.x, p.y, '−' + matsHtml(e.mats, 22));
          await wait(200);
          break;
        }
        case 'drop': buildCell(run.pos[1] * run.w + run.pos[0]); break;
        case 'morale': {
          const p = partyScreen();
          float(p.x + 30, p.y + 10, `${e.delta > 0 ? '+' : '−'}${Math.abs(e.delta)} ${ui.icon('heart', 20)}`);
          if (e.reason === 'cansancio') dom.hint('El camino cansa: −1 de ánimo.', 3000);
          if (e.delta < 0) audio.sfx('bump');
          await wait(180);
          break;
        }
        case 'prov': {
          const p = partyScreen();
          float(p.x - 30, p.y + 10, `${e.delta > 0 ? '+' : '−'}${Math.abs(e.delta)} ${ui.icon(ICONS.prov, 20)}`);
          await wait(180);
          break;
        }
        case 'mishap': dom.hint(`${ui.icon('info', 16)} ${ui.esc(e.text)}.`, 4500); audio.sfx('bump'); await wait(300); break;
        case 'mirador': dom.hint('Desde el mirador se ve lejos.', 3500); audio.sfx('open'); break;
        case 'outcome': {
          const p = partyScreen();
          if (e.outcome === 'ok') { float(p.x, p.y - 20, e.p >= 100 ? (e.text || 'Listo') : 'Salió bien'); audio.sfx(e.p >= 100 ? 'tap' : 'select'); }
          else { float(p.x, p.y - 20, 'Salió mal'); audio.sfx('error'); if (e.text) dom.hint(ui.esc(e.text) + '.', 3500); }
          bus.emit('expedition:decision', { region: run.region, hazard: e.hazard, option: e.option, p: e.p, outcome: e.outcome, ...(cityRun() ? {} : { prototype: true }) });
          buildCell(run.pos[1] * run.w + run.pos[0]);
          await wait(350);
          break;
        }
        case 'camp': audio.sfx('done'); buildCell(e.y * run.w + e.x); break;
        case 'hint': for (let i = 0; i < run.cells.length; i++) buildCell(i); buildHintArea(); dom.hint(e.cell ? 'Te marcaron en el mapa dónde queda.' : 'Te contaron qué hay cerca.', 4000); audio.sfx('open'); break;
        case 'objective': {
          for (let i = 0; i < run.cells.length; i++) buildCell(i);
          buildHintArea();
          audio.sfx('win');
          ui.confetti?.(90);
          const p = partyScreen();
          float(p.x, p.y - 40, `${ui.icon('star', 26)} Objetivo cumplido`);
          if (!guide?.on('objDone')) dom.hint(e.objective === 'aldea' ? 'Llegaron a la aldea perdida: se suman 2 personas.' : `Encontraron ${ui.esc(e.name)}. ¿Seguís o volvés?`, 6000);
          await wait(700);
          break;
        }
        case 'combat': break;     // la pelea la abre enterCombat al final
        case 'combatQuick': {
          const p = partyScreen();
          float(p.x, p.y - 30, `${ui.icon('star', 22)} Resuelto rápido`);
          audio.sfx('select');
          await wait(250);
          break;
        }
        case 'combatEnd': {
          const f = e.fight, name = ENCOUNTERS[f.enc]?.name || 'La pelea';
          if (f.outcome === 'win') dom.hint(f.quick ? `${ui.esc(name)}: resuelto sin pelear. Menos botín, pero no cuesta nada más.` : `${ui.esc(name)}: ganaron. El botín va a la carga.`, 5000);
          else dom.hint(f.outcome === 'lose' ? `${ui.esc(name)}: perdieron. Vuelven a la casilla anterior y el ánimo baja.` : `Se retiraron de ${ui.esc(name.toLowerCase())}. Los enemigos siguen ahí.`, 5500);
          buildCell(run.pos[1] * run.w + run.pos[0]);
          await wait(200);
          break;
        }
        case 'pushBack': {
          placeParty(e.from[0], e.from[1], 0);
          buildCell(e.from[1] * run.w + e.from[0]);
          await walkParty(e.from[0], e.from[1], e.x, e.y, 420);
          buildCell(e.y * run.w + e.x);
          break;
        }
        case 'decision': break;   // la abre showPending al final
        case 'end': break;
        default: break;
      }
    }
    busy = false;
    persist();
    refresh();
    if (run.ended) { queued = null; await wait(450); showResult(); return; }
    if (run.pending?.kind === 'combate') { queued = null; await wait(250); enterCombat(); return; }
    if (run.pending) { queued = null; showPending(); return; }
    if (queued) { const q = queued; queued = null; tryMove(run.pos[0] + q[0], run.pos[1] + q[1]); }
  }

  // ---------- acciones ----------
  function tryMove(x, y) {
    if (busy || !run || run.ended || run.pending || modal) return;
    const v = lastView || R.view(run);
    const mv = v.moves.find(m => m.x === x && m.y === y);
    if (!mv) return;
    if (!mv.ok) { audio.sfx('error'); dom.hint(`No alcanzan las provisiones para ese paso (${provTxt(mv.cost)}).`, 3000); return; }
    const res = R.move(run, x, y);
    if (!res.ok) { audio.sfx('error'); return; }
    persist();
    playEvents(res.events);
  }
  function showPending() {
    const pd = run.pending;
    if (!pd || card) return;
    audio.sfx('open');
    dom.clearChips();
    const depth = run.cells[pd.y * run.w + pd.x].depth;
    const fightInfo = pd.kind === 'enemigo' ? { fightParty: R.fightParty(run), party: run.party.slice() } : {};
    if (pd.kind === 'peligro' || pd.kind === 'ruina') guide?.on('hazard');
    const cardRef = card = openDecision(root, pd, { depth, ...fightInfo }, (id) => {
      if (!card || busy) return;
      const c = card; card = null;
      const res = R.choose(run, id);
      if (!res.ok) { card = c; audio.sfx('error'); if (res.why) dom.hint(ui.esc(res.why), 3000); return; }
      c.close();
      fitCamera(0, true);
      if (id === 'retroceder') audio.sfx('close');
      persist();
      playEvents(res.events);
    });
    setTimeout(() => { if (card === cardRef && alive) fitCamera(cardRef.el.offsetHeight, true); }, 30);
  }
  // ---------- combate (DESIGN-COMBAT.md §13) ----------
  /** Pasa el control a la escena combat con la pelea guardada; al cerrar el resultado vuelve acá con lo que dejó. */
  let entering = false;
  function enterCombat() {
    if (!alive || entering || !run || run.pending?.kind !== 'combate') return;
    const b = R.activeBattle(run);
    const runRef = run;
    // pelea rota o ya terminada (se cerró el juego en la pantalla de resultado): se acredita sin volver a abrirla
    if (!b || b.ended) { finishFight(runRef, null); return; }
    entering = true;
    persist();
    const pd = run.pending;
    const c = R.conditions(run), here = run.cells[pd.y * run.w + pd.x];
    let first = false;
    try { first = !combatState().fights; } catch {}
    bus.emit('expedition:combat', { region: run.region, enc: pd.encounter, guided: !!pd.guided || first });
    Promise.resolve(ctx.router.go('combat', {
      battle: b, expedition: true, guided: !!pd.guided || first,
      conditions: { hour: c.hour, night: c.night, weather: c.weather, place: expPlace(ringOf(here?.depth || 0)) },
      // la pelea es el mismo objeto que state.expedition.active.battle: alcanza con guardar
      onSave: () => { store.markDirty(); try { store.save(); } catch {} },
      onEnd: (res) => finishFight(runRef, res),
    })).finally(() => { entering = false; });
  }
  /** Cierra la pelea en el motor, la acredita en la ciudad y vuelve a la expedición animando lo que dejó. */
  function finishFight(runRef, res) {
    const out = R.endCombat(runRef, res);
    if (out.ok) { try { creditFight(runRef, out.fight); } catch (err) { console.error('[expedition] pelea', err); } }
    const e = expState();
    if (runRef.ended && runRef.city && !runRef.city.summary) { try { finishExpedition(runRef); } catch (err) { console.error('[expedition] acreditar', err); } }
    e.active = runRef.ended ? null : runRef;
    store.markDirty();
    try { store.save(); } catch {}
    if (alive && run === runRef) { playEvents(out.events || []); return; }
    ctx.router.go('expedition', { resume: true, fightEvents: out.events || [], endedRun: runRef.ended ? runRef : null });
  }

  function goHome(force = false) {
    if (busy || !run || run.ended) return;
    const v = R.view(run);
    if (!v.canReturn && !force) {
      modal = openConfirmFail(root, v, (a) => { modal.close(); modal = null; if (a === 'go') goHome(true); else refresh(); });
      refresh();
      return;
    }
    if (card) { card.close(); card = null; }
    const res = R.goHome(run);
    audio.sfx(res.result.reason === 'volvio' ? 'done' : 'lose');
    persist();
    playEvents(res.events);
  }
  function showResult() {
    if (modal) { modal.close(); modal = null; }
    const e = expState();
    let res, info = { kind: run.kind, regionName: meta.regionName, zone: run.zone };
    if (cityRun()) {
      persist();
      res = run.city.summary || finishExpedition(run);
      const st = expeditionStatus();
      info = { ...info, city: true, canShort: st.canShort, canNormal: st.canNormal };
    } else {
      res = R.result(run);
      e.last = res; e.active = null; persist();
      bus.emit('expedition:finished', { region: run.region, zone: run.zone, kind: run.kind, stars: res.starCount, loot: res.loot, reason: res.reason, steps: res.steps, objectiveDone: res.objectiveDone, prototype: true });
    }
    dom.clearChips();
    dom.hint(null);
    modal = openResult(root, res, info, (a) => {
      if (a === 'city') { audio.sfx('close'); ctx.router.go('city'); return; }
      if (info.city && a === 'again') { audio.sfx('tap'); Promise.resolve(ctx.router.go('city')).then(() => ctx.openPanel('expedition')); return; }
      modal.close(); modal = null;
      audio.sfx('tap');
      start({ ...params, short: a === 'short' ? '1' : '', kind: a === 'short' ? 'corta' : 'normal', seed: null, new: '1' });
    });
    res.stars.forEach((on, i) => { if (on) setTimeout(() => alive && audio.sfx('star'), 300 + i * 250); });
    // festejo grande: región explorada completa (Guía de tono)
    if (res.regionDone) setTimeout(() => { if (alive) { ui.confetti?.(); audio.sfx('win'); } }, 600);
  }
  function openEscMenu() {
    if (modal || busy) return;
    audio.sfx('open');
    const v = R.view(run);
    modal = openMenu(root, v, (a) => {
      modal.close(); modal = null;
      if (a === 'home') { goHome(); return; }
      if (a === 'city') { audio.sfx('close'); persist(); ctx.router.go('city'); return; }
      refresh();
    });
    refresh();
  }
  function useItem(id) {
    if (busy || !run) return;
    const res = R.useItem(run, id);
    if (!res.ok) { audio.sfx('error'); return; }
    audio.sfx('pop');
    persist();
    playEvents(res.events);
  }

  // ---------- entrada ----------
  const raycastPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.25);
  function cellAtScreen(cx, cy) {
    const ray = new THREE.Raycaster();
    ray.setFromCamera(r.toNDC(cx, cy), r.camera);
    // probar alturas de losa de la más alta a la más baja: la primera que caiga en una casilla de esa altura gana
    for (const hy of [0.5, 0.375, 0.25]) {
      raycastPlane.constant = -hy;
      const p = new THREE.Vector3();
      if (!ray.ray.intersectPlane(raycastPlane, p)) continue;
      const x = Math.round(p.x + (run.w - 1) / 2), y = Math.round(p.z + (run.h - 1) / 2);
      if (x < 0 || y < 0 || x >= run.w || y >= run.h) continue;
      if (Math.abs(cellTop(x, y) - hy) < 0.01 || hy === 0.25) return [x, y];
    }
    return null;
  }
  let down = null, queued = null;
  function onDown(e) { down = { x: e.clientX, y: e.clientY, t: performance.now() }; }
  // ---------- ecos de noche (L6) ----------
  const echoQ = new URLSearchParams(location.search).get('echo') === '1';
  function syncEcho(t) {
    if (!run || run.prototype) return;
    let want = null;
    try {
      const night = echoQ || R.conditions(run).night;
      const e = night ? expEcho(store.state, run.region) : null;
      const spots = e ? expEchoSpots(run) : [];
      if (e && spots.length) { const sp = spots[hashSeed(e.id, run.seed) % spots.length]; want = { e, x: sp.x, y: sp.y }; }
    } catch {}
    if (echo && !echo.fx.leaving && (!want || want.e.id !== echo.id)) echo.fx.leave();
    if (!echo && want) {
      const fx = createEcho(want.e.scene, { scale: 0.72 });
      const p = cellPos(want.x, want.y);
      fx.group.position.set(p.x + 0.18, cellTop(want.x, want.y), p.z + 0.2);
      fx.group.rotation.y = 0.6;
      world.add(fx.group);
      echo = { fx, id: want.e.id, x: want.x, y: want.y };
    }
    if (echo && echo.fx.update(t) === false) { echo.fx.dispose(); echo = null; }
  }
  function hitEcho(x, y) {
    if (!echo || echo.fx.leaving || !r) return false;
    const s = screenOf(echo.x, echo.y, 0.35);
    return (s.x - x) ** 2 + (s.y - y) ** 2 < 40 * 40;
  }
  function openEcho() {
    const e = seeEcho(echo.id);
    echo.fx.leave();
    if (!e) return;
    audio.sfx('page');
    const page = e.page ? PAGE_BY_ID[e.page] : null;
    const wrap = ui.h('div.ec-card');
    wrap.append(ui.h('p', { html: `<i>${ui.esc(e.line)}</i>` }));
    wrap.append(ui.h('p.ec-note', { html: page ? `${iconHtml('quest', 16)} Página nueva del diario: <b>${ui.esc(page.title)}</b>.` : `${iconHtml('quest', 16)} Queda anotado en el Diario de la Bitácora.` }));
    ui.modal({ title: e.title, icon: 'moon', content: wrap, className: 'ec-modal' });
  }
  function onUp(e) {
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    down = null;
    if (moved > 12 || modal || card) return;
    if (hitEcho(e.clientX, e.clientY)) { openEcho(); return; }
    const c = cellAtScreen(e.clientX, e.clientY);
    if (c) tryMove(c[0], c[1]);
  }
  function onKey(e) {
    if (!alive || !run) return;
    const k = e.key;
    // flechas fijas; WASD (o lo que se reasignó en Ajustes → Controles) por code
    const mv = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' }[k] || (e.ctrlKey || e.metaKey ? null : actionFor(e.code, ['up', 'down', 'left', 'right']));
    const arrow = mv ? { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[mv] : null;
    if (busy) { if (arrow && !card && !modal) { queued = arrow; e.preventDefault(); } return; }   // la flecha espera a que termine el paso
    if (k === 'Escape') {
      e.preventDefault();
      if (card && run.pending?.at === 'enter') { const c = card; card = null; const res = R.choose(run, 'retroceder'); c.close(); fitCamera(0, true); audio.sfx('close'); persist(); playEvents(res.events); return; }
      if (card) return;
      if (modal) { modal.el.querySelector('[data-a="resume"], [data-a="cancel"]')?.click(); return; }
      openEscMenu();
      return;
    }
    if (card && /^[1-4]$/.test(k)) { e.preventDefault(); card.choose(Number(k) - 1); return; }
    if (modal) { if (k === 'Enter') { modal.el.querySelector('.btn.primary, .btn.mint')?.click(); e.preventDefault(); } return; }
    const dir = arrow;
    if (dir && run && !card) { e.preventDefault(); tryMove(run.pos[0] + dir[0], run.pos[1] + dir[1]); return; }
    if ((actionFor(e.code, ['back']) || k === 'Backspace') && !card) { e.preventDefault(); goHome(); }
  }

  // ---------- armado ----------
  let params = {};
  function start(p) {
    const e = expState();
    if ((p.new === '1' || p.new === true) && !(e.active && e.active.city)) e.active = null;   // la de la ciudad no se descarta
    run = p.endedRun || (e.active && !e.active.ended && e.active.v === 1 ? e.active : newRun(p));
    if (!run) { setTimeout(() => alive && ctx.router.go('city'), 0); return; }
    persist();
    const RG = REGIONS[run.region];
    meta = { regionName: RG.name, zone: run.zone, kind: run.kind, daily: run.city?.daily || null };
    // limpiar el diorama anterior
    for (const o of cellObjs) if (o) { clearCellObj(o); }
    cellObjs.length = 0;
    world.clear();
    expAmb?.reset();
    shownTips = {};
    buildAll();
    buildParty();
    buildGround();
    fitCamera();
    refresh();
    if (p.fightEvents?.length) { const evs = p.fightEvents; p.fightEvents = null; params.fightEvents = null; params.endedRun = null; setTimeout(() => alive && playEvents(evs), 350); return; }
    if (run.ended) { setTimeout(() => alive && showResult(), 350); return; }
    if (run.pending?.kind === 'combate') { setTimeout(() => alive && enterCombat(), 400); return; }
    if (run.pending) showPending();
    // con Vera guiando, la instrucción la da ella: abajo queda solo la zona y el objetivo (sin repetir "hacé clic…")
    if (run.steps === 0) dom.hint(`${ui.esc(meta.regionName)}: ${ui.esc(dom.$('goal').querySelector('.t span').textContent)}.${guidedRun(run, store.state) ? '' : ' Hacé clic en una casilla vecina para avanzar.'}`, 7000);
  }
  function buildGround() {
    // isla de tierra bajo la grilla y algo de monte alrededor (el diorama no flota en el vacío)
    const W = run.w * 8, D = run.h * 8;
    const g = voxelModel(`exp:ground:${run.w}x${run.h}`, W + 4, D + 4, (m) => {
      const v = m.v;
      for (let x = 0; x < W + 4; x++) for (let z = 0; z < D + 4; z++) {
        const edge = x < 2 || z < 2 || x >= W + 2 || z >= D + 2;
        for (let y = 0; y < 3; y++) v.set(x, y, z, y === 2 ? (edge ? '#9fb478' : DIRT) : (x + z + y) % 3 ? DIRT : DIRT_D);
      }
    });
    g.position.set(0, -3 / 8, 0);
    world.add(g);
    for (let i = 0; i < 18; i++) {
      const side = i % 4, t = ((i * 37) % 100) / 100;
      const x = side === 0 ? -run.w / 2 - 0.8 : side === 1 ? run.w / 2 + 0.8 : (t - 0.5) * (run.w + 1);
      const z = side === 2 ? -run.h / 2 - 0.8 : side === 3 ? run.h / 2 + 0.9 : (t - 0.5) * (run.h + 1);
      const kind = REGIONS[run.region].tier >= 2 && i % 3 === 0 ? 'rock' : i % 2 ? 'pine' : 'tree';
      const n = natureModel(kind, i);
      n.scale.setScalar(0.55 + ((i * 13) % 5) / 20);
      n.position.set(x, -1 / 8, z);
      world.add(n);
    }
  }

  return {
    hud: false,
    music,
    async mount(container, p = {}) {
      alive = true;
      params = { ...(p || {}) };
      const qs = new URLSearchParams(location.search);
      for (const k of ['short', 'region', 'zone', 'seed', 'new', 'proto']) if (params[k] == null && qs.has(k)) params[k] = qs.get(k);
      root = container;
      styleEl = injectStyle();
      dom = buildDom(root, { onHome: () => goHome(), onMenu: () => openEscMenu(), onItem: useItem, onChip: tryMove });
      const stage = root.querySelector('.ex-stage');
      r = createPixelRenderer(stage, { ortho: true, viewSize: 12, background: 0xd9e4dc, outline: true, idleFps: 30 });
      const lights = addLights(r.scene, { shadowSize: 16, shadowRes: 1024 });
      lights.sun.position.set(6, 18, 10);
      r.scene.add(world);
      expAmb = createExpAmbience({ ctx, r, lights, world, cellPos: (x, y) => cellPos(x, y), cellTop: (x, y) => cellTop(x, y) });
      start(params);
      if (!run) return;   // no se pudo salir: vuelve a la ciudad
      guide = createExpGuide({ root, store, run });
      if (lastView) tips(lastView);
      r.onFrame((dt, t) => {
        for (const a of [...anims]) {
          a.t += dt;
          const k = Math.min(1, a.t / a.dur);
          a.fn(k);
          if (k >= 1) { anims.delete(a); a.done?.(); }
        }
        for (const m of party) m.obj.userData.update?.(dt, !!m.walking);
        for (const o of cellObjs) {
          if (o?.badge) o.badge.position.y = o.badge.userData.baseY + Math.sin(t * 2 + o.badge.userData.phase) * 0.04;
          o?.prop?.userData.update?.(dt, t);
        }
        updateChips();
        expAmb?.update(dt, partyPos);
        syncEcho(t);
      });
      r.start();
      stage.addEventListener('pointerdown', onDown);
      stage.addEventListener('pointerup', onUp);
      addEventListener('keydown', onKey);
      const onResize = () => { fitCamera(); updateChips(); };
      addEventListener('resize', onResize);
      offs.push(() => removeEventListener('keydown', onKey), () => removeEventListener('resize', onResize));
      // para las pruebas (tools/test-expedition.mjs)
      container.__exp = {
        get view() { return run ? R.view(run) : null; },
        get run() { return run ? JSON.parse(JSON.stringify(run)) : null; },
        get busy() { return busy; },
        get card() { return !!card; },
        get modal() { return !!modal; },
        get looks() { return party.map(p => p.obj?.userData?.look || null); },   // tools/test-class-look.mjs
        cellScreen(x, y) { return r ? screenOf(x, y, 0.3) : null; },
        // para las pruebas (tools/test-cycle.mjs): los mismos caminos que el toque, el teclado y el botón Volver
        move(x, y) { tryMove(x, y); },
        raw() { return run; },
        choose(i) { card?.choose(i); },
        home(force = false) { goHome(force); },
        // ambiente (PLAN-QUIEBRE §J3–J4): hora, noche, clima y pronóstico; ruinas para los ecos (L6)
        get cond() { return run ? R.conditions(run) : null; },
        get look() { return expAmb?.amb.look || null; },
        echoSpots() { return run ? expAmb?.echoSpots(run) || [] : []; },
        get guide() { return guide ? { active: guide.active, text: guide.text } : null; },
        get echo() { return echo ? { id: echo.id, x: echo.x, y: echo.y, leaving: echo.fx.leaving } : null; },
      };
    },
    unmount() {
      alive = false;
      for (const off of offs.splice(0)) { try { off(); } catch {} }
      if (run && !run.ended) persist();
      anims.clear();
      if (card) { card = null; }
      if (modal) { modal.close(); modal = null; }
      expAmb?.dispose(); expAmb = null;
      echo?.fx.dispose(); echo = null;
      guide?.dispose(); guide = null;
      if (r) { r.stop(); r.dispose(); r = null; }
      for (const m of texCache.values()) { m.map?.dispose(); m.dispose(); }
      texCache.clear();
      for (const m of Object.values(hlMats)) m.dispose();
      hintMat.dispose(); ringGeo.dispose(); ringMat.dispose(); ring = null;
      hlGeo.dispose();
      cellObjs.length = 0; party = []; highlight.length = 0; hintGroup = null;
      styleEl?.remove(); styleEl = null;
      root?.replaceChildren(); root = null; dom = null;
    },
  };
}
