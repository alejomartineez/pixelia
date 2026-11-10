// Sprites 2D de personajes (paso 1d de La Travesía, docs/PLAN-TRAVESIA.md "Sprites 2D de personajes"). Arma cada
// sprite por capas desde el mismo `look` del avatar 3D (pueblo, contextura, piel, pelo, barba, ropa, sombrero, clase y
// arma), con las paletas y rampas de src/avatar/figure.js, así el 2D y el 3D son la misma persona. Estilo de la
// referencia del usuario (docs/ref/sprites-referencia.webp): figura de ~24 × 30 en un cuadro de 32 × 32, cabeza
// grande, contorno de tinta de 1 px, luz de la izquierda y 3–4 tonos por material. Las piezas están en
// sprite-parts.js (cabezas, pelo, barbas, sombreros, brazos, armas) y sprite-outfits.js (ropa).
//
//   spriteFrame(look, anim, i, opts)  → { w, h, px: Uint32Array (0 vacío, 0xRRGGBB | FILLED), clip, bad } (puro)
//   frameCanvas(look, anim, i, opts)  → canvas de un cuadro (opts.scale entero, opts.flip mira a la izquierda)
//   spriteSheet(look, opts)           → { canvas, fw, fh, scale, anims: { idle: { row, frames, fps } … } }
//   portrait(look, { sticker, full }) → canvas del busto (o del cuerpo entero) con borde de sticker opcional
//   drawFrame(ctx, sheet, anim, i, x, y) dibuja un cuadro de la hoja (sin suavizado)
// opts: { cls (clase de CLASS_KIT o rol), gear (arma que no está en el catálogo, ej. 'trabuco'), item ('caja', 'veta',
// 'carta', 'bolsa': lo que levanta o entrega en los gestos; 'nada': el gesto con la mano vacía) }.
import { paletteOf, classLook } from '../avatar/figure.js';
import { normalizeLook } from '../avatar/avatar.js';
import { ramp, mix, hexToInt } from '../avatar/avatar-kit.js';
import { CH, BODIES, HEADS, HAIR, BEARDS, HATS, ARMS, DIRS, WEAPONS, BODY_GEAR, ITEMS, FX } from './sprite-parts.js';
import { outfit2d } from './sprite-outfits.js';

export const FW = 32, FH = 32;
const GROUND = 30;
export const FILLED = 0x1000000;
export const ANIMS = {
  idle: { frames: 2, fps: 2 }, walk: { frames: 4, fps: 8 }, attack: { frames: 3, fps: 9 }, hurt: { frames: 1, fps: 2 },
  fall: { frames: 2, fps: 3 }, point: { frames: 2, fps: 3 }, lift: { frames: 2, fps: 3 }, give: { frames: 2, fps: 3 },
};
export const ANIM_IDS = Object.keys(ANIMS);
export const SPRITE_ITEMS = Object.keys(ITEMS);
// los enemigos con forma de persona (src/combat/enemy-models.js, PEOPLE): mismo look que el 3D
export const ENEMY_LOOKS = {
  grumete: { look: { type: 'zorro', build: 'esbelto', skin: 1, hair: 'corto', hairColor: 'negro', face: 'cicatriz', dress: 'cuero', dressColor: 'rojo', crown: 'bandana', acc: 'espada' } },
  tirador: { look: { type: 'zorro', build: 'recio', skin: 3, hair: 'cortito', hairColor: 'gris', face: 'ninguna', dress: 'abrigo', dressColor: 'verde', crown: 'galera', acc: 'ninguno' }, gear: 'trabuco' },
  capitana: { look: { type: 'zorro', build: 'esbelto', skin: 0, hair: 'trenzas', hairColor: 'blanco', face: 'parche', dress: 'abrigo', dressColor: 'fucsia', crown: 'galera', acc: 'espada' } },
  vaciado: { look: { type: 'vaciado', build: 'esbelto', skin: 0, hair: 'despeinado', hairColor: 'negro', face: 'cicatriz', dress: 'cuero', dressColor: 'negro', crown: 'ninguna', acc: 'ninguno' } },
};

const INK = 0x1a1614, INNER = 0x2c2226;
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
// se arma en un lienzo más grande (IW × IH, con el cuadro corrido OX, OY) y después se encaja en el de 32 × 32
const IW = 48, IH = 40, OX = 8, OY = 4;

// ---------------- Paleta: las rampas del 3D, de a 4 tonos (luz, base, sombra, sombra honda) ----------------
const R4 = (c, up = 1, dn = -1.2) => [ramp(c, up), hexToInt(c), ramp(c, dn), ramp(c, dn * 2)];
function rampsOf(look) {
  const P = paletteOf(look);
  const t = look.type;
  const dark = 0x2a2220;
  const amber = t === 'orco' || t === 'zorro' || t === 'anuro';
  const eyeT = t === 'vaciado' ? ramp(P.vein, 1.6) : amber ? P.iris : dark;
  const eyeB = t === 'vaciado' ? P.vein : amber ? INK : dark;
  return {
    skin: [P.skinL, P.skin, P.skinD, P.skinDD],
    hair: [P.hairL, P.hair, P.hairD, P.hairDD],
    cloth: [P.clothL, P.cloth, P.clothD, P.clothDD],
    cloth2: R4(mix(P.cloth, P.linen, 0.45)),
    leather: [P.leatherL, P.leather, P.leatherD, ramp(P.leatherD, -1.2)],
    metal: [ramp(P.metal, 2.6, { hue: 3, warm: 45 }), ramp(P.metal, 1, { hue: 3, warm: 45 }), P.metalD, ramp(P.metalD, -1.2)],
    wood: R4(P.wood), trouser: R4(P.trouser, 1.2), brass: R4(P.brass, 1.4), linen: R4(P.linen, 0.8),
    fur: [P.furL, P.fur, P.furD, ramp(P.furD, -1.2)], straw: R4(P.straw), cream: R4(P.cream, 0.6), bone: R4(P.bone, 0.6),
    vein: [ramp(P.vein, 1.8), P.vein, P.veinD, ramp(P.veinD, -1)],
    boot: [P.bootL, P.boot, P.boot, P.boot],
    ink: [INK, INK, INK, INK], eyeT: [eyeT, eyeT, eyeT, eyeT], eyeB: [eyeB, eyeB, eyeB, eyeB],
    lip: [P.lip, P.lip, P.lip, P.lip], scar: [P.scar, P.scar, P.scar, P.scar], paint: [0x7a3428, 0x7a3428, 0x7a3428, 0x7a3428],
    stub: R4(mix(P.skin, P.hairD, 0.5)), fire: [0xf3d58a, 0xe0a040, 0xa85a26, 0xa85a26],
  };
}

// ---------------- Capas ----------------
const layer = () => ({ px: new Map(), clip: 0 });
function put(L, x, y, ch) {
  if (!ch || ch === '.' || ch === ' ') return;
  x += OX; y += OY;
  if (x < 0 || y < 0 || x >= IW || y >= IH) { L.clip++; return; }
  L.px.set(y * IW + x, ch);
}
function rows(L, rs, x, y, map) {
  for (let j = 0; j < rs.length; j++) for (let i = 0; i < rs[j].length; i++) {
    const c = rs[j][i];
    put(L, x + i, y + j, map && map[c] !== undefined ? map[c] : c);
  }
}
/** Ensancha una grilla repitiendo su columna del medio (los sombreros y pelos de 12 en un cráneo más ancho). */
function widen(rs, n) {
  if (n <= 0) return rs;
  const w = Math.max(...rs.map(r => r.length)), m = w >> 1;
  return rs.map(r => { r = r.padEnd(w, '.'); return r.slice(0, m) + r[m].repeat(n) + r.slice(m); });
}
const matOf = (L, i) => { const c = L.px.get(i); return c === undefined ? undefined : CH[c]?.[0]; };
function commit(buf, L, R, { sep = false, shade = true } = {}) {
  buf.clip += L.clip;
  if (sep) {
    const ring = [];
    for (const i of L.px.keys()) {
      const x = i % IW, y = (i / IW) | 0;
      for (const [dx, dy] of N4) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= IW || ny >= IH) continue;
        const j = ny * IW + nx;
        if (!L.px.has(j) && buf.px[j]) ring.push(j);
      }
    }
    for (const j of ring) buf.px[j] = INNER | FILLED;
  }
  for (const [i, ch] of L.px) {
    const def = CH[ch];
    if (!def) { buf.bad++; continue; }
    const [mat, tone] = def;
    let t = tone;
    if (shade && tone === 1) {
      const x = i % IW;
      const r = x < IW - 1 && matOf(L, i + 1) === mat, l = x > 0 && matOf(L, i - 1) === mat, d = matOf(L, i + IW) === mat;
      t = !r || !d ? 2 : !l ? 0 : 1;
    }
    buf.px[i] = (R[mat] ? R[mat][t] : 0xff00ff) | FILLED;
  }
}
function outline(buf) {
  const out = [];
  for (let i = 0; i < buf.px.length; i++) {
    const x = i % FW, y = (i / FW) | 0;
    if (buf.px[i]) { if (x === 0 || y === 0 || x === FW - 1 || y === FH - 1) buf.clip++; continue; }
    for (const [dx, dy] of N4) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < FW && ny < FH && buf.px[ny * FW + nx] && buf.px[ny * FW + nx] !== (INK | FILLED)) { out.push(i); break; }
    }
  }
  for (const i of out) buf.px[i] = INK | FILLED;
}

// ---------------- Look ----------------
const KIND = (acc) => WEAPONS[acc]?.kind || 'none';
/** El look listo para dibujar: normalizado, con la clase aplicada y el arma que mande opts.gear. */
export function prepareLook(look = {}, opts = {}) {
  let L = normalizeLook(look);
  if (opts.cls) L = classLook(L, opts.cls);
  if (opts.gear) L = { ...L, acc: opts.gear };
  return L;
}

// ---------------- Poses de cada animación ----------------
function rigOf(anim, f, kind) {
  const r = { main: 'hold', off: 'down', wdir: 'up', eyes: 'open' };
  const set = (o) => Object.assign(r, o);
  if (anim === 'idle') { if (f === 1) set({ breath: 1 }); }
  // al caminar los brazos van al revés que las piernas: el de adelante sale y sube cuando pisa la pierna de atrás
  else if (anim === 'walk') set([{ lUp: 2, main: 'swing', off: 'back', offDY: -1 }, { bob: -1 }, { rUp: 2, main: 'back', off: 'swing', mainDY: -1 }, { bob: -1 }][f]);
  else if (anim === 'attack') {
    const A = {
      melee: [{ main: 'up', wdir: 'raise' }, { main: 'strike', wdir: 'strike', dx: 1 }, { main: 'hold', wdir: 'up' }],
      // la lanza sale de la mano hacia adelante: el asta nunca cruza el torso
      thrust: [{ main: 'back', wdir: 'fwd' }, { main: 'point', wdir: 'fwd', dx: 1 }, { wdir: 'fwd' }],
      bow: [{ main: 'point', bow: 'rest' }, { main: 'point', off: 'draw', bow: 'drawn' }, { main: 'point', bow: 'rest', fx: 'arrow' }],
      gun: [{ main: 'point', wdir: 'fwd' }, { main: 'point', wdir: 'fwd', fx: 'flash', dx: -1 }, { main: 'point', wdir: 'fwd', mainDY: -1, fx: 'smoke' }],
      cast: [{ main: 'up' }, { main: 'up', fx: 'glow' }, { main: 'hold' }],
      none: [{ main: 'hold' }, { main: 'point', dx: 1, noWeapon: true }, { main: 'hold' }],
    };
    set((A[kind] || A.none)[f]);
  } else if (anim === 'hurt') set({ main: 'out', off: 'out', dx: -1, hdx: -1, eyes: 'hurt' });
  else if (anim === 'fall') set(f === 0 ? { kneel: 2, hdy: 1, eyes: 'hurt', main: 'down' } : { lying: true, eyes: 'closed', main: 'down', noWeapon: true });
  else if (anim === 'point') set({ main: f ? 'point' : 'give', noWeapon: true });
  else if (anim === 'lift') set({ main: f ? 'up' : 'give', item: true, noWeapon: true });
  else if (anim === 'give') set({ main: f ? 'give' : 'hold', item: true, noWeapon: true, dx: f });
  if (kind === 'bow' && !r.bow && !r.noWeapon) set({ bow: 'rest' });
  return r;
}

// ---------------- Armado de un cuadro ----------------
function armCells(pose, B, O, sx, sy, dy = 0) {
  const A = ARMS[pose] || ARMS.down;
  let rs = A.rows.slice();
  let hy = A.hand[1];
  if (A.stretch !== undefined) {
    const d = B.arm - 7;
    if (d > 0) { rs.splice(A.stretch, 0, ...Array(d).fill(rs[A.stretch])); hy += d; }
    else if (d < 0) { rs.splice(A.stretch, -d); hy += d; }
  }
  const map = { a: O.sleeve, i: O.cuff, g: O.hand };
  const cells = [];
  rs.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] !== '.') cells.push([sx + A.x + i, sy + A.y + j + dy, map[row[i]] || row[i], row[i] === 'g']); });
  return { cells, hand: [sx + A.x + A.hand[0], sy + A.y + hy + dy] };
}
function drawWeapon(L, acc, dir, hx, hy, bow) {
  const W = WEAPONS[acc];
  if (!W) return;
  if (W.grid) {
    const g = W.kind === 'gun' && dir === 'up' ? W.up : W.grid;
    let gx = 0, gy = 0;
    g.forEach((r, j) => { const i = r.indexOf('+'); if (i >= 0) { gx = i; gy = j; } });
    // en los pueblos bajos el arco o el farol no entran entre el piso y la mano: suben lo justo
    const below = hy - gy + g.length - 1 - GROUND;
    if (below > 0) gy += below;
    if (W.kind === 'bow' && bow === 'drawn') {
      rows(L, g, hx - gx, hy - gy, { n: '.' });
      return { top: [hx - gx + 1, hy - gy], bot: [hx - gx + 1, hy - gy + g.length - 1] };
    }
    rows(L, g, hx - gx, hy - gy);
    return { tip: [hx - gx + (W.kind === 'gun' ? g[0].length : 1), hy - gy] };
  }
  const [dx, dy] = DIRS[dir] || DIRS.up;
  const px = dy === 0 ? 0 : 1, py = dy === 0 ? 1 : 0;   // al costado de la línea (para la hoja de 2)
  const room = (sx, sy) => { let n = 0, x = hx, y = hy; for (;;) { x += sx; y += sy; if (x < 0 || y < 1 || x > FW - 1 || y > GROUND) return n; n++; } };
  let x = hx, y = hy;
  // al frente (estocada) no se dibuja la contera: quedaría atravesando el cuerpo
  let backRoom = dir === 'fwd' ? 0 : room(-dx, -dy);
  for (const [c, n] of W.back || []) for (let k = 0; k < n && backRoom > 0; k++, backRoom--) { x -= dx; y -= dy; put(L, x, y, c); }
  // la cabeza del arma tiene que entrar entera en el cuadro: el asta se acorta lo que haga falta (el martillo en el
  // golpe perdía la cabeza contra el piso)
  const Hd = W.head?.[dir], margin = Hd ? Math.max(3, Hd.rows.length + Math.min(0, Hd.oy || 0) + 1) : 0;
  const total = W.shaft.reduce((a, [, n]) => a + n, 0), over = total - (room(dx, dy) - margin);
  const shaft = over > 0 ? W.shaft.map(([c, n], i) => [c, i === W.shaft.length - 1 ? Math.max(2, n - over) : n]) : W.shaft;
  x = hx - dx; y = hy - dy;
  for (const [c, n] of shaft) for (let k = 0; k < n; k++) {
    x += dx; y += dy;
    if (c === 'guard') { put(L, x, y, 'b'); put(L, x + px, y + py, '8'); put(L, x - px, y - py, 'B'); }
    else if (c === 'blade') { put(L, x, y, 'M'); if (!(W.tip && k === n - 1)) put(L, x + px, y + py, k % 4 === 3 ? '5' : 'm'); }
    else put(L, x, y, c);
  }
  const H = W.head?.[dir];
  if (H) rows(L, H.rows, x + (H.ox || 0), y + (H.oy || 0));
  return { tip: [x, y] };
}
function line(L, x0, y0, x1, y1, ch) {
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let e = dx + dy;
  for (;;) { put(L, x0, y0, ch); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } }
}

function figure(look, R, anim, f, opts) {
  const buf = { px: new Uint32Array(IW * IH), clip: 0, bad: 0 };
  const B = (BODIES[look.type] || BODIES.humano)[look.build === 'esbelto' ? 'esbelto' : 'recio'];
  const O = outfit2d(look.dress);
  const HD = HEADS[B.head];
  const kind = KIND(look.acc);
  const r = rigOf(anim, f, kind);
  const W = WEAPONS[look.acc];
  const showWeapon = W && !r.noWeapon && !r.lying;
  const dx = r.dx || 0, breath = r.breath || 0;
  // torso y piernas
  const torsoBottom = GROUND - B.lh + (r.kneel || 0) + (r.bob || 0);
  const tx0 = 16 - Math.floor(B.tw / 2) + dx, tx1 = tx0 + B.tw - 1, ty0 = torsoBottom - B.th + 1;
  const hw = HD.w, hh = HD.rows.length;
  const sx0 = 16 - Math.floor(hw / 2) + (B.hdx || 0) + dx + (r.hdx || 0);
  const sy1 = ty0 + B.hdy - 1 + breath + (r.hdy || 0), sy0 = sy1 - hh + 1;
  const hat = HATS[look.crown];
  const hairDef = HAIR[look.hair];
  const hideAll = hat && hat.hide === 'all';

  // --- atrás: capa, pelo largo, cola, mochila
  const back = layer();
  if (O.cape) {
    for (let y = ty0; y <= GROUND - 1; y++) for (let x = tx0 - 1; x <= tx1 + 1; x++) put(back, x, y, y === GROUND - 1 ? '3' : x === tx0 - 1 ? 'C' : O.cape);
  }
  if (hairDef?.back && !hideAll) rows(back, widen(hairDef.back, hw - 12), sx0 + hairDef.bx, sy0 + hairDef.by);
  if (B.tail) rows(back, ['qq....', 'sqs...', '.sss..', '..ssss', '...sss'], tx0 - 5, torsoBottom - 5);
  if (look.acc === 'mochila') rows(back, BODY_GEAR.mochila.back, tx0 + Math.floor(B.tw / 2) - 8, ty0 - 2);
  commit(buf, back, R);

  // --- piernas
  const legs = layer();
  const total = 2 * B.lw + B.gap, lx0 = 16 - Math.floor(total / 2) + dx;
  const legLen = GROUND - torsoBottom;
  for (const side of [0, 1]) {
    const x0 = side ? lx0 + B.lw + B.gap : lx0;
    const up = side ? r.rUp || 0 : r.lUp || 0;
    const L = Math.max(1, legLen - up);
    for (let y = 0; y < L; y++) for (let i = 0; i < B.lw; i++) put(legs, x0 + i, torsoBottom + 1 + y, O.leg(y, L));
    const fy = torsoBottom + L;
    if (B.feet === 'flipper') for (let i = -1; i <= B.lw; i++) put(legs, x0 + i + (side ? 1 : -1), fy, 's');
    else for (let k = 1; k <= (B.toe || 1); k++) put(legs, side ? x0 + B.lw - 1 + k : x0 - k, fy, O.leg(L - 1, L));
  }
  commit(buf, legs, R);

  // --- torso, falda y lo que va encima
  const body = layer();
  for (let y = 0; y < B.th; y++) for (let x = 0; x < B.tw; x++) {
    if (y === 0 && (x === 0 || x === B.tw - 1)) continue;
    put(body, tx0 + x, ty0 + y, O.torso(x, y, B.tw, B.th));
  }
  const skirtLen = Math.min(O.robe ? Math.max(1, legLen - 1) : O.hem || O.apron || 0, legLen - 1);
  for (let y = 0; y < skirtLen; y++) {
    const fl = O.robe ? Math.floor((y + 1) * (O.flare || 0)) : 0;
    const n = O.hemNarrow || 0;
    const w = B.tw + 2 * fl - 2 * n;
    for (let x = 0; x < w; x++) {
      const X = tx0 - fl + n + x;
      if (O.apron) { if (x < 2 || x > w - 3) continue; put(body, X, torsoBottom + 1 + y, y === skirtLen - 1 ? '4' : 'l'); continue; }
      if (O.split && Math.abs(x - (w - 1) / 2) < 1) continue;
      const ch = O.skirt ? O.skirt(x, y, w, skirtLen) : O.hemAlt && y % 2 ? O.hemAlt : O.hemCh || 'c';
      put(body, X, torsoBottom + 1 + y, ch);
    }
  }
  if (look.acc === 'bolso') for (let y = 0; y < B.th - 2; y++) { const t = y / (B.th - 3); put(body, tx1 - 1 - Math.round(t * (B.tw - 3)), ty0 + y, '4'); }
  if (look.acc === 'mochila') for (let y = 0; y < Math.min(4, B.th - 2); y++) { put(body, tx0 + 2, ty0 + y, '4'); put(body, tx1 - 2, ty0 + y, '4'); }
  if (look.acc === 'collar') { const cx = tx0 + Math.floor(B.tw / 2); put(body, cx, ty0 + 3, 'v'); put(body, cx, ty0 + 2, '4'); put(body, cx - 1, ty0 + 1, '4'); put(body, cx + 1, ty0 + 1, '4'); }
  commit(buf, body, R);
  if (look.acc === 'bolso') { const bag = layer(); rows(bag, BODY_GEAR.bolso.bag, tx0 - 2, torsoBottom - 2); commit(buf, bag, R, { sep: true }); }

  // --- brazo de atrás (en espejo) y escudo
  const sy = ty0 + breath;
  const offA = armCells(r.off, B, O, tx1, sy, r.offDY || 0);
  const mirror = (x) => tx0 + tx1 - x;
  const offL = layer();
  for (const [x, y, c] of offA.cells) put(offL, mirror(x), y, c);
  if (O.pads) rows(offL, ['.' + O.pads + O.pads + O.pads, O.pads.repeat(4)], tx0 - 2, sy - 1);
  commit(buf, offL, R, { sep: true });
  const offHand = [mirror(offA.hand[0]), offA.hand[1]];
  if (look.acc === 'escudo' && !r.lying) { const sh = layer(); rows(sh, WEAPONS.escudo.grid, offHand[0] - 4, Math.min(offHand[1] - 3, GROUND - WEAPONS.escudo.grid.length + 1)); commit(buf, sh, R, { sep: true }); }

  // el arma levantada para el golpe va detrás de la cabeza (si no, la cruza por encima del casco o de la cara)
  const behind = showWeapon && !W.off && W.kind === 'melee' && r.wdir === 'raise';
  if (behind) {
    const m = armCells(r.main, B, O, tx1, ty0 + breath, r.mainDY || 0);
    const wl = layer();
    drawWeapon(wl, look.acc, 'raise', m.hand[0] + (r.wdx || 0), m.hand[1], r.bow);
    commit(buf, wl, R, { sep: true });
  }

  // --- cabeza, cara, barba, pelo y sombrero
  const head = layer();
  HD.rows.forEach((w, y) => { const x0 = Math.floor((hw - w) / 2); for (let x = 0; x < w; x++) put(head, sx0 + x0 + x, sy0 + y, 's'); });
  for (const [x, y, c] of HD.px) if (!(c === '=' && HD.noBrow)) put(head, sx0 + x, sy0 + y, c);
  const eyes = HD.eyes;
  const eyeCh = r.eyes === 'closed' ? ['s', '0'] : r.eyes === 'hurt' ? ['0', 's'] : ['e', 'E'];
  for (const [x, y] of eyes) { put(head, sx0 + x, sy0 + y, eyeCh[0]); if (!HD.eye1) put(head, sx0 + x, sy0 + y + 1, eyeCh[1]); }
  if (r.eyes === 'hurt') { const [mx, my] = HD.mouth; put(head, sx0 + mx, sy0 + my, '0'); put(head, sx0 + mx + 1, sy0 + my, '0'); }
  // marcas de la cara
  const [e0, e1] = eyes;
  if (look.face === 'cicatriz') { put(head, sx0 + e0[0] - 1, sy0 + e0[1] + 2, 'z'); put(head, sx0 + e0[0], sy0 + e0[1] + 3, 'z'); put(head, sx0 + e0[0] - 2, sy0 + e0[1] + 1, 'z'); }
  if (look.face === 'cicatriz_ojo') for (const k of [-2, -1, 2, 3]) put(head, sx0 + e1[0], sy0 + e1[1] + k, 'z');
  if (look.face === 'pintura') for (const [x, y] of eyes) for (const k of [-1, 0, 1]) put(head, sx0 + x + k, sy0 + y + 2 + (HD.eye1 ? 0 : 1), '!');
  if (look.face === 'parche') { for (const [a, b] of [[0, 0], [1, 0], [0, 1], [1, 1], [-1, 0]]) put(head, sx0 + e1[0] + a, sy0 + e1[1] + b, 'k'); line(head, sx0 + e1[0] + 1, sy0 + e1[1] - 1, sx0 + e1[0] + 3, sy0 + e1[1] - 3, 'k'); line(head, sx0 + e1[0] - 1, sy0 + e1[1] - 1, sx0 + 1, sy0 + 2, 'k'); }
  commit(buf, head, R, { sep: true });
  const bd = BEARDS[look.face];
  if (bd) { const L = layer(); rows(L, bd.rows, sx0 - 1, sy0 + bd.oy); commit(buf, L, R); }
  if (hairDef && !hideAll) {
    const L = layer();
    const cut = hat && typeof hat.hide === 'number' ? hat.hide : null;
    const fr = widen(hairDef.front, hairDef === HAIR.lomo || hairDef === HAIR.cresta_piel ? 0 : hw - 12);
    fr.forEach((row, j) => { const y = j + hairDef.oy; if (cut !== null && y < cut) return; for (let i = 0; i < row.length; i++) put(L, sx0 + hairDef.ox + i, sy0 + y, row[i]); });
    commit(buf, L, R);
  }
  // orejas: por encima del sombrero (salvo capucha y cascos), así el zorro y el orco se leen con cualquier gorro
  const ears = () => {
    if (!HD.ears && !HD.earPx) return;
    const L = layer();
    if (HD.earPx) for (const [x, y, c] of HD.earPx) put(L, sx0 + x, sy0 + y, c);
    if (HD.ears) { const E = HD.ears; rows(L, E.l, sx0 + E.x, sy0 + E.y); rows(L, E.l.map(s => s.split('').reverse().join('')), sx0 + hw - E.l[0].length - E.x, sy0 + E.y); }
    commit(buf, L, R, { sep: !!hat });
  };
  if (!hat) ears();
  if (hat) {
    const L = layer(); rows(L, widen(hat.rows, hw - 12), sx0 + hat.ox, sy0 + hat.oy + (hat.hide === 'all' ? 0 : HD.hatDy || 0)); commit(buf, L, R, { sep: true });
    if (hat.hide !== 'all') ears();
    // los ojos saltones (anuro) van por encima de lo que lleve en la cabeza: si no, el sombrero le tapa la cara
    if (HD.eyesOver) {
      const E = layer();
      for (const [x, y, c] of HD.px) if (y < 0) put(E, sx0 + x, sy0 + y, c);
      for (const [x, y] of eyes) { put(E, sx0 + x, sy0 + y, eyeCh[0]); if (!HD.eye1) put(E, sx0 + x, sy0 + y + 1, eyeCh[1]); }
      commit(buf, E, R, { sep: true });
    }
  }
  if (look.acc === 'buho') { const L = layer(); rows(L, BODY_GEAR.buho.shoulder, tx0 - 3, ty0 - 5 + breath); commit(buf, L, R, { sep: true }); }

  // --- brazo de adelante, arma y lo que lleva en la mano
  const mainA = armCells(r.main, B, O, tx1, sy, r.mainDY || 0);
  const [hx, hy] = mainA.hand;
  const arm = layer();
  for (const [x, y, c] of mainA.cells) put(arm, x, y, c);
  if (O.pads) rows(arm, [O.pads + O.pads + O.pads + '.', O.pads.repeat(4)], tx1 - 1, sy - 1);
  commit(buf, arm, R, { sep: true });
  const fxL = layer();
  if (showWeapon && !WEAPONS[look.acc].off) {
    const wl = layer();
    const wdir = W.kind === 'gun' ? (r.wdir === 'fwd' ? 'fwd' : 'up') : r.wdir;
    const res = behind ? null : drawWeapon(wl, look.acc, wdir, hx + (r.wdx || 0), hy, r.bow);
    if (r.bow === 'drawn' && res?.top) {
      const [ox, oy] = offHand;
      line(wl, res.top[0], res.top[1], ox, oy, 'n'); line(wl, res.bot[0], res.bot[1], ox, oy, 'n');
      line(wl, ox, oy, hx + 1, oy, 'w'); put(wl, hx + 2, oy, 'M');
    }
    commit(buf, wl, R, { sep: true });
    // los dedos van encima del agarre
    const grip = layer();
    for (const [x, y, c, g] of mainA.cells) if (g && y === hy) put(grip, x, y, c);
    commit(buf, grip, R);
    if (r.fx === 'arrow') rows(fxL, FX.arrow, hx + 3, hy - 1);
    if (r.fx === 'flash' && res?.tip) rows(fxL, FX.flash, res.tip[0], res.tip[1] - 2);
    if (r.fx === 'smoke' && res?.tip) rows(fxL, FX.smoke, res.tip[0], res.tip[1] - 3);
    if (r.fx === 'glow' && res?.tip) rows(fxL, FX.glow, res.tip[0] - 2, res.tip[1] - 3);
  }
  if (r.item && opts.item !== 'nada') {   // opts.item 'nada': los brazos del gesto sin objeto (colgarse de un borde, tender la mano)
    const g = ITEMS[opts.item] || ITEMS.caja;
    const L = layer();
    // si el objeto queda a la altura de la cabeza, se corre afuera (sin soltarse de la mano) para no taparla
    const gw = g[0].length, top = hy - g.length;
    let ix = hx - (gw >> 1);
    if (top <= sy1 + 1) ix += Math.max(0, Math.min(gw >> 1, sx0 + hw + 1 - ix));
    rows(L, g, ix, top);
    commit(buf, L, R, { sep: true });
  }
  return { buf, fxL };
}

// ---------------- Cuadros, hojas y retratos ----------------
const cache = new Map();
/** Vacía la caché de cuadros (los tests la usan para ver que el resultado sea determinista). */
export const clearSpriteCache = () => cache.clear();
const keyOf = (L, anim, f, o) => [L.type, L.build, L.skin, L.hair, L.hairColor, L.face, L.dress, L.dressColor, L.crown, L.acc, anim, f, o.item || ''].join('|');
/** Un cuadro como píxeles: { w, h, px, clip, bad }. Determinista: el mismo look da siempre los mismos píxeles. */
export function spriteFrame(lookIn, anim = 'idle', f = 0, opts = {}) {
  const look = opts.prepared ? lookIn : prepareLook(lookIn, opts);
  const k = keyOf(look, anim, f, opts);
  if (cache.has(k)) return cache.get(k);
  const R = rampsOf(look);
  const { buf, fxL } = figure(look, R, ANIMS[anim] ? anim : 'idle', f % (ANIMS[anim]?.frames || 1), opts);
  const fitted = fit(buf);
  let out = fitted;
  if (anim === 'fall' && f % 2 === 1) out = lay(fitted);
  fillPinholes(out);
  outline(out);
  fillPinholes(out, INK);
  // efectos (flecha, fogonazo, humo, destello): sin contorno, corridos igual que la figura; lo que no entra se corta
  let fxClip = fxL.clip;
  for (const [i, ch] of fxL.px) {
    const x = (i % IW) - OX + fitted.sx, y = ((i / IW) | 0) - OY;
    if (x < 0 || y < 0 || x >= FW || y >= FH) { fxClip++; continue; }
    const [mat, t] = CH[ch] || [];
    if (R[mat]) out.px[y * FW + x] = R[mat][t] | FILLED;
  }
  const res = { w: FW, h: FH, px: out.px, clip: out.clip, bad: out.bad, fxClip };
  if (cache.size > 4000) cache.clear();
  cache.set(k, res);
  return res;
}
// del lienzo grande al cuadro de 32 × 32: si un brazo o un arma se pasa de costado, la figura se corre lo justo
function fit(buf) {
  let x0 = IW, x1 = -1;
  for (let i = 0; i < buf.px.length; i++) if (buf.px[i]) { const x = i % IW; if (x < x0) x0 = x; if (x > x1) x1 = x; }
  let sx = 0;
  if (x1 - OX > FW - 2) sx = FW - 2 - (x1 - OX);
  if (x0 - OX + sx < 1) sx = 1 - (x0 - OX);
  const px = new Uint32Array(FW * FH);
  let clip = buf.clip;
  for (let i = 0; i < buf.px.length; i++) {
    if (!buf.px[i]) continue;
    const x = (i % IW) - OX + sx, y = ((i / IW) | 0) - OY;
    if (x < 1 || y < 1 || x > FW - 2 || y > FH - 2) { clip++; continue; }
    px[y * FW + x] = buf.px[i];
  }
  return { px, clip, bad: buf.bad, sx };
}
// un hueco de 1 o 2 píxeles encerrado (entre el brazo y el cuerpo) se lee como un error: va de tinta
function fillPinholes(buf, color = INNER) {
  const px = buf.px, seen = new Uint8Array(FW * FH);
  for (let i = 0; i < px.length; i++) {
    if (px[i] || seen[i]) continue;
    const st = [i], reg = []; let edge = false; seen[i] = 1;
    while (st.length) {
      const j = st.pop(); reg.push(j); const x = j % FW, y = (j / FW) | 0;
      if (!x || !y || x === FW - 1 || y === FH - 1) edge = true;
      for (const [dx, dy] of N4) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= FW || ny >= FH) continue; const k = ny * FW + nx; if (!px[k] && !seen[k]) { seen[k] = 1; st.push(k); } }
    }
    if (!edge && reg.length <= 2) for (const j of reg) px[j] = color | FILLED;
  }
}
// caído: el cuerpo gira un cuarto de vuelta (la cabeza a la izquierda) y queda apoyado en el piso
function lay(buf) {
  const px = new Uint32Array(FW * FH);
  let minX = FW, maxX = -1, maxY = -1;
  for (let i = 0; i < buf.px.length; i++) {
    if (!buf.px[i]) continue;
    const x = i % FW, y = (i / FW) | 0;
    const nx = y, ny = FW - 1 - x;
    px[ny * FW + nx] = buf.px[i];
    minX = Math.min(minX, nx); maxX = Math.max(maxX, nx); maxY = Math.max(maxY, ny);
  }
  const ox = Math.round((FW - (maxX - minX + 1)) / 2) - minX, oy = GROUND - maxY;
  const out = new Uint32Array(FW * FH);
  let clip = buf.clip;
  for (let i = 0; i < px.length; i++) {
    if (!px[i]) continue;
    const x = (i % FW) + ox, y = ((i / FW) | 0) + oy;
    if (x < 0 || y < 0 || x >= FW || y >= FH) { clip++; continue; }
    out[y * FW + x] = px[i];
  }
  return { px: out, clip, bad: buf.bad };
}

const mkCanvas = (w, h) => {
  if (typeof document !== 'undefined') { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  return new OffscreenCanvas(w, h);
};
function pxToCanvas(px, w, h, scale = 1, flip = false) {
  const c = mkCanvas(w * scale, h * scale);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w * scale, h * scale);
  const d = img.data;
  for (let y = 0; y < h * scale; y++) for (let x = 0; x < w * scale; x++) {
    let sx = Math.floor(x / scale); if (flip) sx = w - 1 - sx;
    const v = px[Math.floor(y / scale) * w + sx];
    if (!v) continue;
    const o = (y * w * scale + x) * 4;
    if (v >>> 24 === 1) { d[o] = (v >> 16) & 255; d[o + 1] = (v >> 8) & 255; d[o + 2] = v & 255; d[o + 3] = 255; }
    else { d[o] = (v >> 16) & 255; d[o + 1] = (v >> 8) & 255; d[o + 2] = v & 255; d[o + 3] = v >>> 24; }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}
/** Un cuadro en un canvas (escala entera, sin suavizado). */
export function frameCanvas(look, anim = 'idle', f = 0, opts = {}) {
  const s = spriteFrame(look, anim, f, opts);
  return pxToCanvas(s.px, FW, FH, Math.max(1, opts.scale | 0), !!opts.flip);
}
/** Hoja con todas las animaciones: una fila por animación, un cuadro de 32 × 32 por columna. */
export function spriteSheet(lookIn, opts = {}) {
  const look = prepareLook(lookIn, opts);
  const o = { ...opts, prepared: true };
  const scale = Math.max(1, opts.scale | 0);
  const cols = Math.max(...ANIM_IDS.map(a => ANIMS[a].frames));
  const px = new Uint32Array(cols * FW * ANIM_IDS.length * FH);
  const anims = {};
  ANIM_IDS.forEach((a, row) => {
    anims[a] = { row, frames: ANIMS[a].frames, fps: ANIMS[a].fps };
    for (let f = 0; f < ANIMS[a].frames; f++) {
      const s = spriteFrame(look, a, f, o);
      for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) px[(row * FH + y) * cols * FW + f * FW + x] = s.px[y * FW + x];
    }
  });
  return { canvas: pxToCanvas(px, cols * FW, ANIM_IDS.length * FH, scale, !!opts.flip), fw: FW * scale, fh: FH * scale, scale, anims, look };
}
/** Dibuja el cuadro i de una animación de la hoja en (x, y). */
export function drawFrame(ctx, sheet, anim, i, x, y, scale = 1) {
  const a = sheet.anims[anim] || sheet.anims.idle;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sheet.canvas, (i % a.frames) * sheet.fw, a.row * sheet.fh, sheet.fw, sheet.fh, x, y, sheet.fw * scale, sheet.fh * scale);
}

// borde de sticker: 2 px de blanco cálido y una sombra suave abajo (como la referencia)
const STICKER = 0xfbf7ef, SHADOW = 0x40302820;
function stickerize(px, w, h, m = 3) {
  const W = w + 2 * m, Hh = h + 2 * m;
  const src = new Uint32Array(W * Hh);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) src[(y + m) * W + x + m] = px[y * w + x];
  const white = new Uint8Array(W * Hh);
  for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
    if (!src[y * W + x]) continue;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      if (Math.abs(dx) + Math.abs(dy) > 3) continue;
      const X = x + dx, Y = y + dy;
      if (X >= 0 && Y >= 0 && X < W && Y < Hh) white[Y * W + X] = 1;
    }
  }
  const out = new Uint32Array(W * Hh);
  for (let i = 0; i < out.length; i++) {
    const x = i % W, y = (i / W) | 0;
    if (src[i]) out[i] = src[i];
    else if (white[i]) out[i] = STICKER | FILLED;
    else if (y > 0 && white[(y - 1) * W + x]) out[i] = SHADOW;
  }
  return { px: out, w: W, h: Hh };
}
/** Retrato: busto (cabeza y hombros, sin el arma) o cuerpo entero (full), con borde de sticker opcional. */
export function portrait(lookIn, opts = {}) {
  const look = prepareLook(lookIn, opts);
  const o = { ...opts, prepared: true };
  let s;
  if (opts.full) s = spriteFrame(look, 'idle', 0, o);
  else s = spriteFrame({ ...look, acc: WEAPONS[look.acc] && !WEAPONS[look.acc].off ? 'ninguno' : look.acc }, 'idle', 0, o);
  let x0 = FW, x1 = -1, y0 = FH, y1 = -1;
  for (let i = 0; i < s.px.length; i++) if (s.px[i]) { const x = i % FW, y = (i / FW) | 0; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  let w = x1 - x0 + 1, h = y1 - y0 + 1;
  if (!opts.full) { h = Math.min(h, 24); w = 24; x0 = 4; }
  let px = new Uint32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) px[y * w + x] = s.px[(y0 + y) * FW + x0 + x] || 0;
  if (opts.sticker) ({ px, w, h } = stickerize(px, w, h));
  return pxToCanvas(px, w, h, Math.max(1, opts.scale | 0), !!opts.flip);
}
