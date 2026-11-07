// Utilidades de UI compartidas por las pantallas sociales: avatar pixel, "hace 2 h", chips de premios,
// figuritas en miniatura, botones con espera y estilos inyectados (.soc-*).
import { esc, flyCurrency, toast } from '../core/ui.js';
import { icon } from '../core/icons.js';
import { fmtNum } from '../core/economy.js';
import { SKIN_TONES, HAIR_COLORS, OUTFIT_COLORS } from '../core/data.js';
import { ITEMS } from '../chests/chests.js';
import { stickerDef, renderStickerCard, RARITY_NAMES } from '../album/album.js';
import { chestIcon, packIcon } from '../season/season-ui-common.js';
import { SOCIAL_CSS } from './social-style.js';

// ---------- Estilos ----------
let users = 0;
export function useSocialStyle() {
  users++;
  if (!document.getElementById('social-style')) {
    const st = document.createElement('style');
    st.id = 'social-style';
    st.textContent = SOCIAL_CSS;
    document.head.append(st);
  }
  let released = false;
  return () => {
    if (released) return; released = true;
    if (--users <= 0) { users = 0; setTimeout(() => { if (!users) document.getElementById('social-style')?.remove(); }, 400); }
  };
}

// ---------- Tiempo ----------
/** "recién", "hace 5 min", "hace 2 h", "hace 3 días", "el 12/10". */
export function timeAgo(iso, now = Date.now()) {
  if (!iso) return 'hace mucho';
  const t = typeof iso === 'number' ? iso : Date.parse(iso);
  if (!isFinite(t)) return 'hace mucho';
  const s = Math.max(0, (now - t) / 1000);
  if (s < 120) return 'recién';
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
  const d = Math.floor(s / 86400);
  if (d < 7) return d === 1 ? 'ayer' : `hace ${d} días`;
  const dt = new Date(t);
  return `el ${dt.getDate()}/${dt.getMonth() + 1}`;
}
export const isOnlineNow = (iso, now = Date.now()) => !!iso && now - Date.parse(iso) < 5 * 60e3;
/** "2 d 4 h", "5 h", "20 min". */
export function fmtLeft(ms) {
  const m = Math.max(0, Math.floor(ms / 60e3));
  if (m < 60) return `${Math.max(1, m)} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h`;
  const d = Math.floor(h / 24);
  return `${d} d${h % 24 ? ` ${h % 24} h` : ''}`;
}

// ---------- Avatar pixel ----------
// Carita 14×14 según el tipo de personaje: persona de pelo largo o corto (según el peinado) o animalito
// (orejas propias y hocico, pelaje = hairColor). Arriba se dibuja lo que lleve en la cabeza (corona, sombrero, gorra…).
const FACE_LONG = [
  '..............',
  '..............',
  '...hhhhhhhh...',
  '..hhhhhhhhhh..',
  '.hhhsssssshhh.',
  '.hhsssssssshh.',
  '.hhsksssskshh.',
  '.hhpssssssphh.',
  '.hhsssmmssshh.',
  '.hhhsssssshhh.',
  '.hhh.dddd.hhh.',
  '.hh.dddddd.hh.',
  '...dddddddd...',
  '..dddddddddd..',
];
const FACE_SHORT = [
  '..............',
  '..............',
  '....hhhhhh....',
  '...hhhhhhhh...',
  '..hhhhhhhhhh..',
  '..hssssssssh..',
  '..ssksssskss..',
  '..spssssssps..',
  '..ssssmmssss..',
  '...ssssssss...',
  '.....ssss.....',
  '...dddddddd...',
  '..dddddddddd..',
  '..dddddddddd..',
];
const BEARD = [[8, '..shhhmmhhhs..'], [9, '...hhhhhhhh...'], [10, '....hhhhhh....']];
// animalitos: f pelaje, e oreja por dentro, w hocico/pancita clarita, n nariz, k ojos, p cachetes
const FACE_ANIMAL = {
  gatito: [
    '..............',
    '..ff......ff..',
    '..fef....fef..',
    '..ffffffffff..',
    '.ffffffffffff.',
    '.ffffffffffff.',
    '.fffkffffkfff.',
    '.ffpffffffpff.',
    '.fffffwwfffff.',
    '.ffffwnnwffff.',
    '..ffffwwffff..',
    '....ffffff....',
    '...dddddddd...',
    '..dddddddddd..',
  ],
  zorrito: [
    '.f..........f.',
    '.ff........ff.',
    '.fef......fef.',
    '.ffffffffffff.',
    '.ffffffffffff.',
    '.ffffffffffff.',
    '.fffkffffkfff.',
    '.wffffffffffw.',
    '.wwwffffffwww.',
    '..wwwwnnwwww..',
    '...wwwwwwww...',
    '....wwwwww....',
    '...dddddddd...',
    '..dddddddddd..',
  ],
  conejito: [
    '...ff....ff...',
    '...fe....ef...',
    '...fe....ef...',
    '..ffffffffff..',
    '.ffffffffffff.',
    '.ffffffffffff.',
    '.fffkffffkfff.',
    '.ffpffffffpff.',
    '.fffffwwfffff.',
    '.fffffnnfffff.',
    '..ffffwwffff..',
    '....ffffff....',
    '...dddddddd...',
    '..dddddddddd..',
  ],
  osito: [
    '..............',
    '..fff....fff..',
    '..fef....fef..',
    '..ffffffffff..',
    '.ffffffffffff.',
    '.ffffffffffff.',
    '.fffkffffkfff.',
    '.ffffffffffff.',
    '.ffffwwwwffff.',
    '.fffwwnnwwfff.',
    '..ffwwwwwwff..',
    '....ffffff....',
    '...dddddddd...',
    '..dddddddddd..',
  ],
};
const LONG_HAIR = new Set(['largo', 'coleta', 'trenzas', 'rizos', 'colitas', 'ondas']);
// lo que va en la cabeza → forma (y color fijo, si no usa el de la ropa)
const HEADWEAR = {
  tiara: ['crown'], corona: ['crown'], estrella: ['crown'], corona_p: ['crown'], corona_rey: ['crown'], laurel: ['crown', '#9bd35a'],
  corona_cristal: ['crown', '#9ff0ff'],
  flores: ['flowers'], diadema: ['flowers', '#6cc35d'],
  'moño': ['bow', '#e392b0'], lacito: ['bow', '#e392b0'],
  sombrero_mago: ['wizard'], sombrero_luna: ['wizard', '#4f5bd6'], sombrero_estrellas: ['wizard', '#3b3f9e'],
  galera: ['tophat', '#3b2340'], gorrito: ['party'],
  gorra: ['cap'], gorro: ['beanie'], piluso: ['beanie', '#f2e2b8'], casco: ['beanie', '#b8bfd0'], capucha: ['beanie'],
};
// [fila, patrón] para personas (cabeza arriba en la fila 2) y para animalitos (entre las orejas)
const HW_HUMAN = {
  crown: [[0, '.....y..y.....'], [1, '....yyyyyy....']],
  flowers: [[1, '...gpgygpgyg..'], [2, '...gggggggg...']],
  bow: [[1, '.........b.b..'], [2, '.........bbb..'], [3, '..........b...']],
  wizard: [[0, '......tt......'], [1, '.....tttt.....'], [2, '....tttttt....'], [3, '...tttyttttt..'], [4, '.tttttttttttt.']],
  tophat: [[0, '....tttttt....'], [1, '....tttttt....'], [2, '....rrrrrr....'], [3, '..tttttttttt..']],
  party: [[0, '......y.......'], [1, '......t.......'], [2, '.....tyt......'], [3, '....tytyt.....']],
  cap: [[2, '....tttttt....'], [3, '...tttttttt...'], [4, '..tttttttttttt']],
  beanie: [[1, '.....tttt.....'], [2, '...tttttttt...'], [3, '..tttttttttt..'], [4, '..rrrrrrrrrr..']],
};
const HW_ANIMAL = {
  crown: [[1, '.....y..y.....'], [2, '.....yyyy.....']],
  flowers: [[2, '....gpgygp....']],
  bow: [[1, '.........bb.b.'], [2, '..........bbb.']],
  wizard: [[0, '......tt......'], [1, '.....tttt.....'], [2, '....ttyttt....'], [3, '...tttttttt...']],
  tophat: [[0, '.....tttt.....'], [1, '.....rrrr.....'], [2, '....tttttt....']],
  party: [[0, '......y.......'], [1, '......t.......'], [2, '.....tyt......']],
  cap: [[2, '....tttttt....'], [3, '...tttttttttt.']],
  beanie: [[2, '....tttttt....'], [3, '...rrrrrrrr...']],
};
const avatarCache = new Map();
const hexOf = (list, id, def) => list.find(c => c.id === id)?.hex || def;
function shade(hex, t) {
  const n = parseInt(hex.slice(1), 16);
  const f = c => Math.max(0, Math.min(255, Math.round(c * (1 - t))));
  return '#' + ((f(n >> 16 & 255) << 16) | (f(n >> 8 & 255) << 8) | f(n & 255)).toString(16).padStart(6, '0');
}
const lighten = (hex, t) => {
  const n = parseInt(hex.slice(1), 16);
  const f = c => Math.round(c + (255 - c) * t);
  return '#' + ((f(n >> 16 & 255) << 16) | (f(n >> 8 & 255) << 8) | f(n & 255)).toString(16).padStart(6, '0');
};
/** Carita pixel a partir del look del personaje (tipo, peinado, colores, cabeza). Sin look: colores según el nombre. */
export function avatarUrl(look, seed = '') {
  let l = look && typeof look === 'object' && Object.keys(look).length ? look : null;
  if (!l) {
    let hsh = 0; for (const ch of String(seed)) hsh = (hsh * 31 + ch.charCodeAt(0)) | 0;
    hsh = Math.abs(hsh);
    l = { skin: hsh % 4, hairColor: HAIR_COLORS[hsh % HAIR_COLORS.length].id, dressColor: OUTFIT_COLORS[(hsh >> 3) % 8].id, hair: hsh & 1 ? 'largo' : 'cortito', crown: 'ninguna' };
  }
  const animal = FACE_ANIMAL[l.type];
  const key = `${l.type || ''}|${l.hair || ''}|${l.skin}|${l.hairColor}|${l.dressColor}|${l.dress || ''}|${l.crown || ''}`;
  if (avatarCache.has(key)) return avatarCache.get(key);
  const skin = SKIN_TONES[l.skin | 0] || SKIN_TONES[0];
  const hair = hexOf(HAIR_COLORS, l.hairColor, '#7a4a2a');
  const dress = hexOf(OUTFIT_COLORS, l.dressColor, '#e392b0');
  const [hwKind, hwCol] = HEADWEAR[l.crown] || [];
  const hat = hwCol || shade(dress, 0.15);
  const pal = {
    h: hair, s: skin, k: '#3b2340', p: '#eaa9bf', m: '#c4678e', d: animal && l.dress === 'pelito' ? shade(hair, 0.12) : dress,
    f: hair, e: '#ffb3c8', w: l.type === 'zorrito' ? '#fff4ea' : lighten(hair, 0.55), n: '#3b2340',
    y: hwKind === 'crown' ? (hwCol || '#ffd166') : '#ffd166', g: hwCol || '#6cc35d', b: hwCol || '#e392b0',
    t: hat, r: hwKind === 'tophat' ? '#e392b0' : lighten(hat, 0.45),
  };
  if (hwKind === 'flowers') pal.p = '#eaa9bf';
  const rows = (animal || (LONG_HAIR.has(l.hair) || !l.hair ? FACE_LONG : FACE_SHORT)).slice();
  const over = (list) => { for (const [y, pat] of list) rows[y] = [...pat].map((ch, x) => (ch === '.' ? rows[y][x] : ch)).join(''); };
  if (!animal && l.hair === 'barba') over(BEARD);
  if (hwKind) over((animal ? HW_ANIMAL : HW_HUMAN)[hwKind]);
  let r = '';
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    const c = pal[ch];
    if (c) r += `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${c}"/>`;
  }));
  // brillo del pelo/pelaje (si no lo tapa un sombrero)
  if (!['wizard', 'tophat', 'cap', 'beanie'].includes(hwKind)) r += `<rect x="${animal ? 4 : 5}" y="${animal ? 4 : 3}" width="2" height="1" fill="${lighten(hair, 0.35)}" opacity=".7"/>`;
  const url = 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 14 14" shape-rendering="crispEdges">${r}</svg>`);
  avatarCache.set(key, url);
  return url;
}
export function avatarHtml(look, name = '', size = 48, cls = '') {
  return `<span class="soc-av ${cls}" style="--sz:${size}px"><img class="pi" src="${avatarUrl(look, name)}" width="${size - 8}" height="${size - 8}" alt="" draggable="false"></span>`;
}

// ---------- Recursos ----------
export function itemIcon(id, size = 22) { return icon(ITEMS[id]?.icon || 'gift', size); }
export function itemName(id) { return ITEMS[id]?.name || id; }
/** Chips de un payload {coins, gems, xp, items, stickers, chests, minutes}. */
export function payloadChips(p = {}, size = 18) {
  if (!p || typeof p !== 'object') return '';
  const out = [];
  if (p.coins) out.push(`<span class="soc-chip">${icon('coin', size)}${fmtNum(p.coins)}</span>`);
  if (p.gems) out.push(`<span class="soc-chip">${icon('gem', size)}${fmtNum(p.gems)}</span>`);
  if (p.xp) out.push(`<span class="soc-chip">${icon('xp', size)}${fmtNum(p.xp)}</span>`);
  for (const [id, n] of Object.entries(p.items || {})) out.push(`<span class="soc-chip" title="${esc(itemName(id))}">${itemIcon(id, size)}${n > 1 ? '×' + n : ''}<em>${esc(itemName(id))}</em></span>`);
  for (const [t, n] of Object.entries(p.chests || {})) out.push(`<span class="soc-chip">${chestIcon(t, size + 4)}${n > 1 ? '×' + n : ''}</span>`);
  if (p.stickers && !p.stickers.n) for (const [id, n] of Object.entries(p.stickers)) {
    if (typeof n !== 'number') continue;
    const d = stickerDef(id);
    out.push(`<span class="soc-chip">${icon(d?.emoji || '🃏', size)}${n > 1 ? '×' + n : ''}<em>${esc(d?.name || 'Figurita')} ${'★'.repeat(d?.stars || 0)}</em></span>`);
  }
  if (p.stickers?.n) out.push(`<span class="soc-chip">${packIcon(size + 4)}×${p.stickers.n}<em>figuritas</em></span>`);
  if (p.minutes) out.push(`<span class="soc-chip">${icon('⏳', size)}-${p.minutes} min</span>`);
  return out.join('');
}
/** Carta de figurita en miniatura (owned por defecto). */
export function stickerCard(id, opts = {}) {
  const d = stickerDef(id);
  const el = renderStickerCard(d, { showCount: false, ...opts });
  el.classList.add('soc-stk');
  return el;
}
export const starsTxt = n => '★'.repeat(n);
export const rarityName = n => RARITY_NAMES[n] || '';

// ---------- Botones ----------
/** Corre fn deshabilitando el botón mientras espera. Si fn devuelve {error}, muestra un toast. */
export async function busy(btn, fn) {
  if (btn?.dataset.busy) return null;
  if (btn) { btn.dataset.busy = '1'; btn.disabled = true; btn.classList.add('soc-busy'); }
  try {
    const r = await fn();
    if (r?.error) toast(r.error, { icon: 'info', type: 'bad' });
    return r;
  } catch (e) {
    console.error('[social]', e);
    toast('Algo salió mal. Probá de nuevo en un rato.', { icon: 'info', type: 'bad' });
    return { error: String(e) };
  } finally {
    if (btn?.isConnected) { delete btn.dataset.busy; btn.disabled = false; btn.classList.remove('soc-busy'); }
  }
}
/** Vuela monedas/gemas desde un elemento hacia el HUD. */
export function flyFrom(el, got = {}) {
  const r = el?.getBoundingClientRect?.();
  const x = r ? r.left + r.width / 2 : innerWidth / 2, y = r ? r.top + r.height / 2 : innerHeight / 2;
  if (got.coins) flyCurrency(x, y, 'coins', Math.min(10, 4 + Math.round(Math.log10(got.coins + 1) * 2)));
  if (got.gems) setTimeout(() => flyCurrency(x, y, 'gems', Math.min(8, 3 + Math.round(got.gems / 5))), 120);
}

// ---------- Bloques HTML ----------
export const loadingHtml = (txt = 'Cargando…') => `<div class="soc-loading"><span class="soc-dots"><i></i><i></i><i></i></span>${esc(txt)}</div>`;
export function emptyHtml(ic, title, text = '') {
  return `<div class="soc-empty">${icon(ic, 44)}<b>${esc(title)}</b>${text ? `<p>${text}</p>` : ''}</div>`;
}
/** Barra de amistad: nivel actual, días y lo que falta para el próximo. */
export function friendshipHtml(f) {
  const fl = f.friendship;
  const days = f.days || 0;
  const pct = Math.round(fl.progress * 100);
  const hearts = '<span class="soc-hearts">' + Array.from({ length: 5 }, (_, i) => `<i class="${i <= fl.index ? 'on' : ''}"></i>`).join('') + '</span>';
  return `<div class="soc-fl lv${fl.index}">
    <div class="soc-fl-top">${hearts}<b>${esc(fl.name)}</b><small>${fl.next != null ? `${days}/${fl.next} días` : `${days} días · nivel máximo`}</small></div>
    <div class="soc-fl-bar"><i style="width:${pct}%"></i></div>
  </div>`;
}
