// Negocios de 3×3 con arte por época (DESIGN-CORE.md §4.2): Cine, Baños Termales, Rueda de la Fortuna y Teatro.
// Cada uno conserva su firma de siempre (marquesina con lamparitas, cúpula y pileta, la rueda, pórtico con telón) y la
// época cambia los materiales y las siluetas. Regla de niveles:
//   1 la sala base con el techo de la época · 2 anexo o galería (el lote se llena) · 3 un piso más y otro techo
//   4 el elemento vertical de la época y aberturas más grandes · 5 remate arriba y cerco o vereda de la época
import {
  P, C, shade, fbox, fset, pattern, STAR5, bush, smallTree, flowerBed, gable, hip, sparkle, wavingFlag, doorLamps,
  eraStyle, eraWall, eraRoof, eraOpening, eraVertical, eraFence, eraGround, eraCrown,
} from './models-kit.js';
import { ERA_PALETTES as EP } from '../core/palette.js';

const S = 1 / 8;
const ROOF_LOW = ['dos_aguas', 'dos_aguas', 'cuatro_aguas', 'plano', 'plano'];
const ROOF_HIGH = ['alto', 'alto', 'mansarda', 'diente', 'terraza'];

/**
 * Sala de 3×3: volumen macizo + techo de la época (bajo en 1–2, otro desde el 3). sp: { x0, x1, z0, z1, h: [alto por
 * época], up (lo que suma el nivel 3), axis, seed, roof: (L, e) => kind }. Devuelve { top, roofTop, kind }.
 */
function hall(m, L, era, sp) {
  const s = eraStyle(era), e = era - 1;
  const H = sp.h[e] + (L >= 3 ? (sp.up ?? s.FH) : 0);
  const top = eraWall(m, sp.x0, 1, sp.z0, sp.x1 - sp.x0 + 1, H, sp.z1 - sp.z0 + 1, era, { FH: sp.fh || s.FH, seed: sp.seed });
  const kind = sp.roof ? sp.roof(L, s.id) : (L >= 3 ? ROOF_HIGH : ROOF_LOW)[e];
  const roofTop = eraRoof(m, sp.x0, sp.x1, sp.z0, sp.z1, top, era, { kind, axis: sp.axis || 'x', oh: 1, dormers: false });
  return { top, roofTop, kind, H };
}

/** Ventanas de un piso a lo largo de una cara (paso fijo). */
function winRow(m, face, plane, u0, u1, y, era, o = {}) {
  const s = eraStyle(era);
  const w = s.id === 'hierro' ? (o.big ? 4 : 3) : s.id === 'vidrio' ? (o.big ? 5 : 4) : o.big ? 3 : 2;
  for (let u = u0; u + w - 1 <= u1; u += w + (o.gap ?? 3)) eraOpening(m, face, plane, u, y, era, 'ventana', { big: o.big });
}

/** Elemento vertical del nivel 4 sobre la sala (atrás a la derecha). Devuelve la y del tope. */
function vertical(m, era, x, z, top, roofTop) {
  const s = eraStyle(era);
  if (s.id === 'piedra') return eraVertical(m, x - 3, top, z, era, { w: 4, h: roofTop - top + 6 });
  if (s.id === 'hierro') return eraVertical(m, x - 3, roofTop, z, era, { w: 4, h: 3 });
  if (s.id === 'vidrio') return eraVertical(m, x - 1, roofTop, z + 1, era, { h: 9 });
  return eraVertical(m, x - 1, top - 1, z, era, { h: roofTop - top + (s.id === 'ladrillo' ? 8 : 4) });
}

/** Cúpula sobre un tambor: el tambor sube de y0 a yTop y la media esfera arranca arriba. Devuelve la y del tope. */
function dome(m, cx, cz, y0, yTop, r, era) {
  const v = m.v, s = eraStyle(era);
  v.cylinder(cx, y0, cz, r + 0.6, Math.max(1, yTop - y0 + 1), s.id === 'vidrio' ? s.light : s.trim);
  const cy = yTop + 1;
  const col = (x, y, z) => {
    const rib = Math.abs(x - cx) < 0.6 || Math.abs(z - cz) < 0.6;
    switch (s.id) {
      case 'madera': return rib ? EP.madera.post : (y % 2 ? EP.madera.thatch : EP.madera.thatchD);   // cúpula de paja
      case 'piedra': return rib ? s.trim : (y % 2 ? s.roof : s.roofD);
      case 'ladrillo': return rib ? s.trim : (y % 2 ? s.roof : s.roofD);
      case 'hierro': return rib ? s.joint : (y % 2 ? '#6f9a8a' : '#5f8878');   // chapa de cobre con pátina
      default: return rib ? s.trim : (y > cy + r * 0.6 ? C.glass : C.glassD);
    }
  };
  for (let i = Math.floor(cx - r); i <= Math.ceil(cx + r); i++) for (let k = Math.floor(cz - r); k <= Math.ceil(cz + r); k++)
    for (let j = 0; j <= Math.ceil(r); j++) {
      const dx = (i - cx) / r, dy = j / r, dz = (k - cz) / r;
      if (dx * dx + dy * dy + dz * dz <= 1) v.set(i, cy + j, k, col(i, cy + j, k));
    }
  return cy + Math.ceil(r);
}

/** Lamparitas que titilan de a dos grupos (A y B). pts: [[x, y, z, color]]. */
function blinking(m, pts, pivot) {
  const A = m.part('bulbA', pivot, { mat: 'light', cast: false }), B = m.part('bulbB', pivot, { mat: 'light', cast: false });
  pts.forEach(([x, y, z, c], i) => (i % 2 ? A : B).set(x, y, z, c));
  m.animate((parts, ph) => {
    const a = parts.bulbA[0], b = parts.bulbB[0]; let acc = ph, on = false;
    return (dt) => { acc += dt; if (acc > 0.45) { acc = 0; on = !on; a.visible = on; b.visible = !on; } };
  });
}

// ======================= CINE =======================
// Firma: marquesina con lamparitas, cartel vertical rojo con estrella, afiches y alfombra roja; carrito de pochoclos.
function cine(m, L, o = {}) {
  const era = o.era || 1, v = m.v, s = eraStyle(era), e = s.id;
  eraGround(m, era);
  const x0 = 2, x1 = 18, z0 = 2, z1 = 13;
  const { top, roofTop, kind } = hall(m, L, era, { x0, x1, z0, z1, h: [11, 12, 12, 12, 10], up: 5, axis: 'x', seed: 9, fh: e === 'vidrio' ? 5 : 6 });
  let peak = roofTop;
  // Madera y Piedra: fachada alta al frente que tapa el techo (la "pantalla" del pueblo)
  if (e === 'madera' || e === 'piedra') {
    const fh = roofTop - top + 2;
    for (let x = x0; x <= x1; x++) {
      const mid = Math.abs(x - (x0 + x1) / 2), hh = fh - (mid > 6 ? 2 : mid > 3 ? 1 : 0);
      for (let j = 0; j < hh; j++) v.set(x, top + j, z1 + 1, j === hh - 1 ? s.trim : (e === 'madera' ? (j % 3 === 0 ? s.wallD : s.wall) : (Math.floor((x + j) / 2) % 3 ? s.wall : s.wallD)));
    }
    peak = Math.max(peak, top + fh);
  }
  // entrada vidriada
  const ew = L >= 4 ? 8 : 6, eu = 10 - ew / 2;
  fbox(v, 'pz', z1, eu, 2, ew, 6, 0, (i, j) => (i === 0 || i === ew - 1 || j === 5 ? s.trim : j === 4 ? C.glass : (i % 2 ? C.glassD : C.glass)));
  // afiches enmarcados a los costados
  for (const [u, c1, c2] of [[3, P.clay, C.yellow], [14, P.sky, P.clay]]) {
    fbox(v, 'pz', z1, u, 3, 3, 5, 0, e === 'vidrio' ? s.trim : s.frame);
    fbox(v, 'pz', z1, u + 1, 4, 1, 3, 0, c1); fset(v, 'pz', z1, u + 1, 5, 0, c2);
    if (e === 'vidrio' || e === 'hierro') fbox(m.light, 'pz', z1, u + 1, 4, 1, 3, 1, c1);
  }
  // marquesina con lamparitas que titilan
  const mx0 = 5, mx1 = 15, my = 9;
  const mc = e === 'madera' ? s.wallD : e === 'vidrio' ? s.light : s.trim;
  v.box(mx0, my, z1 + 1, mx1 - mx0 + 1, 3, 3, mc);
  v.box(mx0, my + 1, z1 + 4, mx1 - mx0 + 1, 1, 1, e === 'hierro' ? s.accent : P.clay);
  for (let x = mx0 + 2; x <= mx1 - 2; x++) fset(v, 'pz', z1 + 3, x, my + 1, 1, x % 3 === 0 ? P.ink : P.inkL);
  const pts = [];
  for (let x = mx0; x <= mx1; x++) { pts.push([x, my + 3, z1 + 3, C.yellow]); pts.push([x, my - 1, z1 + 3, '#fff3b0']); }
  blinking(m, pts, [10, my, 17]);
  // cartel vertical rojo con estrella (la firma: se ve de lejos)
  const sx = 9, sTop = Math.max(top + 7, peak + 3);
  v.box(sx, my + 3, z1 + 1, 2, sTop - my - 3, 1, P.clay);
  for (let y = my + 4; y < sTop; y += 2) { m.light.set(sx, y, z1 + 2, C.yellow); m.light.set(sx + 1, y + 1, z1 + 2, '#ffffff'); }
  pattern(v, 'pz', z1 + 1, sx - 1, sTop, STAR5, e === 'hierro' || e === 'vidrio' ? C.yellow : P.gold);
  peak = Math.max(peak, sTop + 5);
  // ventanas a los costados
  for (let f = 0; f < (L >= 3 ? 2 : 1); f++) winRow(m, 'px', x1, z0 + 2, z1 - 2, 4 + f * 6, era, { big: L >= 4 });
  // alfombra roja hasta la vereda, con postes
  for (let z = z1 + 1; z <= 23; z++) for (let x = 7; x <= 12; x++) v.set(x, 0, z, x === 7 || x === 12 ? s.trim : P.clay);
  for (const x of [6, 13]) for (const z of [17, 20]) { v.box(x, 1, z, 1, 2, 1, s.trim); v.set(x, 3, z, e === 'madera' ? s.wallD : P.goldL); }
  // carrito de pochoclos
  v.box(15, 1, 18, 4, 3, 3, (x, y) => (y === 1 ? P.ink : (x + y) % 2 ? C.red : '#ffffff'));
  for (let j = 0; j < 3; j++) v.cylinder(16.5, 4 + j, 19, 1.3 + j * 0.2, 1, (x, y, z) => ((x + z) % 2 ? C.red : '#ffffff'));
  v.sphere(16.5, 7.5, 19, 1.8, 1.2, 1.8, (x, y, z) => ((x + y + z) % 3 === 0 ? C.yellow : '#fffbe6'));
  // nivel 2: anexo de la boletería y la confitería al costado derecho
  if (L >= 2) {
    const at = eraWall(m, 19, 1, 5, 4, 8, 8, era, { FH: s.FH, seed: 4 });
    eraRoof(m, 19, 22, 5, 12, at, era, { kind: 'plano', oh: 0 });
    eraOpening(m, 'pz', 12, 20, 2, era, 'puerta', { w: 2, h: 4, color: P.clayD });
    eraOpening(m, 'px', 22, 7, 4, era, 'ventana');
    bush(v, 21, 1, 15, 1.2, C.leaf, [P.clay], 3); bush(v, 2, 1, 21, 1.3, C.leaf, [C.yellow], 5);
  }
  // nivel 4: elemento vertical y faroles en la puerta
  if (L >= 4) { peak = Math.max(peak, vertical(m, era, x1 - 1, z0 + 1, top, roofTop)); doorLamps(m, 'pz', z1, eu - 1, eu + ew, 3); }
  // nivel 5: remate y cerco
  if (L >= 5) {
    const flat = kind === 'plano' || kind === 'terraza' || kind === 'mansarda' || kind === 'diente';
    peak = Math.max(peak, eraCrown(m, 13, flat ? roofTop : roofTop + 1, 7, era, { flag: P.clay, w: 7, sign: P.clay }));
    eraFence(m, era, { gaps: [6, 7, 8, 9, 10, 11, 12, 13] });
    sparkle(m, 5, top + 3, 16, '#ffffff');
  }
  m.height = peak + 1;
}

// ======================= BAÑOS TERMALES =======================
// Firma: cúpula sobre la sala, pileta humeante con burbujas y reposeras.
function spa(m, L, o = {}) {
  const era = o.era || 1, v = m.v, s = eraStyle(era), e = s.id;
  eraGround(m, era);
  const x0 = 2, x1 = 21, z0 = 2, z1 = 9;
  const { top, roofTop } = hall(m, L, era, { x0, x1, z0, z1, h: [8, 9, 9, 9, 8], up: e === 'vidrio' ? 5 : 6, axis: 'x', seed: 21 });
  // puerta y ventanas del frente
  eraOpening(m, 'pz', z1, 10, 1, era, 'puerta', { w: 4, h: 5, color: P.mintD });
  for (let f = 0; f < (L >= 3 ? 2 : 1); f++) {
    const wy = 3 + f * (e === 'vidrio' ? 5 : 6);
    winRow(m, 'pz', z1, 3, 8, wy, era, { big: L >= 4, gap: 2 }); winRow(m, 'pz', z1, 15, 20, wy, era, { big: L >= 4, gap: 2 });
    winRow(m, 'px', x1, z0 + 2, z1 - 1, wy, era, {});
  }
  // cúpula (la firma), más grande desde el nivel 3
  const dr = L >= 3 ? 5 : 4;
  let peak = dome(m, 11.5, 5.5, top, roofTop, dr, era);
  v.box(11, peak + 1, 5, 2, 2, 1, s.trim);
  // pileta humeante con borde de la época
  const pcx = 11.5, pcz = 17, rx = L >= 2 ? 9 : 7, rz = 4.4;
  for (let x = 1; x <= 22; x++) for (let z = 12; z <= 22; z++) {
    const dx = (x - pcx) / rx, dz = (z - pcz) / rz, d = dx * dx + dz * dz;
    if (d > 1) continue;
    if (d > 0.62) { v.set(x, 1, z, e === 'madera' ? s.wallD : s.trim); if ((x + z) % 2 === 0) v.set(x, 2, z, e === 'madera' ? s.wall : s.base); }
    else { v.set(x, 1, z, (x + z) % 3 === 0 ? C.waterL : C.water); v.set(x, 0, z, C.waterD); }
  }
  for (let i = 0; i < 6; i++) {
    const bx = 7 + (i * 5) % 10, bz = 15 + (i * 3) % 4;
    const p = m.part('bubble', [bx + 0.5, 2.5, bz + 0.5], { cast: false });
    const r = i % 2 ? 1 : 1.4;
    p.sphere(bx, 2, bz, r, r, r, (x, y) => (y > 2 ? '#ffffff' : '#d4f4ff'));
  }
  m.animate((parts, ph) => {
    const arr = parts.bubble, base = arr.map(q => q.position.clone());
    return (dt, t) => {
      for (let i = 0; i < arr.length; i++) {
        const k = ((t + ph) * 0.33 + i / arr.length) % 1, q = arr[i];
        q.position.set(base[i].x + Math.sin((t + i) * 2) * 0.05, base[i].y + k * 1.6, base[i].z);
        q.scale.setScalar(k < 0.85 ? 0.3 + k * 0.8 : (1 - k) * 6);
      }
    };
  });
  // reposeras con toallas
  for (const [x, c] of [[1, P.clay], [21, P.slate]]) { v.box(x, 1, 12, 2, 1, 4, e === 'madera' ? s.wall : '#ffffff'); v.box(x, 2, 12, 2, 1, 3, c); v.box(x, 2, 12, 2, 2, 1, c); }
  // nivel 2: galería con columnas al frente (sombra para salir del agua)
  if (L >= 2) {
    const gy = Math.min(top - 1, 7);
    for (const x of [3, 7, 16, 20]) v.box(x, 1, z1 + 2, 1, gy, 1, e === 'madera' ? s.trim : e === 'hierro' ? s.trim : s.light === s.trim ? s.trim : '#ffffff');
    for (let x = x0; x <= x1; x++) for (let z = z1 + 1; z <= z1 + 2; z++) v.set(x, gy + 1, z, e === 'madera' ? s.roof : e === 'vidrio' ? s.light : s.trim);
    smallTree(v, 22, 1, 22, 4, 1.5, C.leaf, 8, [P.clay]);
  }
  // nivel 4: elemento vertical (en Madera es la chimenea de la caldera, con vapor)
  if (L >= 4) { peak = Math.max(peak, vertical(m, era, x1 - 1, z0 + 1, top, roofTop)); doorLamps(m, 'pz', z1, 9, 14, 3); }
  // nivel 5: linterna arriba de la cúpula y cerco
  if (L >= 5) {
    v.box(11, peak + 1, 5, 2, 3, 2, s.trim); m.light.set(11, peak + 4, 5, '#fff3cf'); m.light.set(12, peak + 4, 6, '#fff3cf');
    v.box(11, peak + 5, 5, 2, 1, 2, e === 'vidrio' ? s.trim : s.roofD); peak += 6;
    eraFence(m, era, { gaps: [] });
    sparkle(m, 5, 4, 20, '#ffffff');
  }
  m.height = peak + 2;
}

// ======================= RUEDA DE LA FORTUNA =======================
// Firma: la rueda que gira con sus góndolas. Crece con el nivel; la época cambia la estructura (madera, piedra,
// hierro forjado, hierro remachado, acero blanco con cápsulas de vidrio).
function rueda(m, L, o = {}) {
  const era = o.era || 1, v = m.v, s = eraStyle(era), e = s.id;
  eraGround(m, era);
  const R = [7, 8, 9, 10, 10][L - 1], cx = 12, cy = R + 6, zw = 11;
  const legC = e === 'madera' ? EP.madera.post : e === 'piedra' ? EP.piedra.beam : e === 'ladrillo' ? s.frame : e === 'hierro' ? s.trim : s.light;
  const legC2 = e === 'madera' ? s.wall : e === 'piedra' ? s.wall : e === 'ladrillo' ? s.accent : e === 'hierro' ? s.joint : s.trim;
  // plataforma de la época
  eraWall(m, 4, 1, 7, 16, 1, 10, era, { noBase: true, cap: false });
  for (let x = 4; x < 20; x++) for (let z = 7; z < 17; z++) v.set(x, 1, z, (x + z) % 2 ? s.base : s.trim);
  // Piedra: pedestales de sillar bajo las patas
  // soportes en A (dos caras)
  for (const z of [8, 15]) {
    for (let k = 0; k <= 1; k++) {
      const fx = k ? cx + R - 1 : cx - R, steps = cy - 2;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps, x = Math.round(fx + ((k ? cx : cx - 1) - fx) * t), y = 2 + i;
        v.set(x, y, z, legC); v.set(x + (k ? -1 : 1), y, z, i % 3 === 0 ? legC2 : legC);
      }
      if (e === 'piedra') v.box(fx - 1, 1, z, 3, 3, 1, (xx, yy) => (yy === 3 ? s.trim : s.wall));
    }
    v.box(cx - 1, cy - 1, z, 2, 2, 1, legC2);
  }
  v.box(cx - 1, cy - 1, 8, 2, 2, 8, legC); // eje
  // rueda (parte giratoria): aro de la época con un anillo de color (la firma)
  const wheel = m.part('wheel', [cx, cy, zw + 1]);
  const rim = [P.clay, P.slate, P.sky, P.mint, C.yellow, P.peach];
  const spoke = e === 'madera' ? s.wall : e === 'piedra' ? EP.piedra.beam : e === 'vidrio' ? s.light : e === 'hierro' ? s.trim : s.frame;
  for (let i = cx - R - 1; i <= cx + R; i++) for (let j = cy - R - 1; j <= cy + R; j++) {
    const dx = i + 0.5 - cx, dy = j + 0.5 - cy, d = Math.hypot(dx, dy);
    if (Math.abs(d - R) < 0.62) {
      const a = (Math.atan2(dy, dx) + Math.PI) / (Math.PI * 2);
      wheel.set(i, j, zw + 1, rim[Math.floor(a * 12) % rim.length]);     // aro de colores (la firma)
      wheel.set(i, j, zw, spoke);                                          // aro de atrás: el material de la época
    }
  }
  const NS = e === 'hierro' || e === 'vidrio' ? 12 : 8;
  for (let k = 0; k < NS; k++) {
    const a = k / NS * Math.PI * 2;
    for (let r = 1.5; r < R - 0.5; r += 0.5) wheel.set(Math.floor(cx + Math.cos(a) * r), Math.floor(cy + Math.sin(a) * r), zw, spoke);
  }
  wheel.box(cx - 1, cy - 1, zw - 1, 2, 2, 4, P.clay);
  // góndolas (siempre derechas): canasto de madera, cabina de hierro o cápsula de vidrio
  const NG = L >= 3 ? 8 : 6;
  const gcol = [P.clay, P.mint, P.slate, P.sky, C.yellow, P.peach, P.clayD, P.mintD];
  for (let k = 0; k < NG; k++) {
    const g = m.part('gondola', [cx, 6, zw + 1]);
    const c = gcol[k];
    g.set(cx, 5, zw + 1, P.inkL); g.set(cx, 6, zw + 1, P.inkL);
    if (e === 'vidrio') g.box(cx - 1, 2, zw + 1, 3, 3, 2, (x, y) => (y === 2 ? c : y === 4 ? s.light : C.glass));   // cápsula
    else {
      const body = e === 'madera' ? s.wall : c;
      g.box(cx - 1, 2, zw + 1, 3, 2, 2, (x, y) => (y === 2 ? s.trim : e === 'madera' ? body : (x === cx ? C.glass : body)));
      g.box(cx - 1, 4, zw + 1, 3, 1, 2, e === 'madera' ? c : shade(c, 0.35));
    }
  }
  m.animate((parts, ph) => {
    const w = parts.wheel, gs = parts.gondola;
    const px = w[0].position.x, py = w[0].position.y, pz = gs[0].position.z;
    const RR = R * S;
    return (dt, t) => {
      const a = (t + ph) * 0.32;
      for (const q of w) q.rotation.z = a;
      for (let i = 0; i < gs.length; i++) {
        const th = a + i / gs.length * Math.PI * 2;
        gs[i].position.set(px + Math.cos(th) * RR, py + Math.sin(th) * RR - S, pz);
        gs[i].rotation.z = Math.sin((t + i) * 1.3) * 0.06;
      }
    };
  });
  let peak = cy + R + 2;
  // camino de entrada y vallas de la época
  for (let z = 17; z <= 23; z++) for (let x = 6; x <= 10; x++) v.set(x, 0, z, (x + z) % 2 ? s.path : shade(s.path, -0.1));
  for (let x = 4; x <= 12; x++) { v.set(x, 2, 19, legC); if (x % 2 === 0) v.set(x, 1, 19, legC); }
  // boletería: casilla de la época (desde el 1) y, en el 2, la confitería y los banderines
  const bt = eraWall(m, 15, 1, 18, 5, 5, 4, era, { seed: 2 });
  eraRoof(m, 15, 19, 18, 21, bt, era, { kind: e === 'madera' ? 'paja' : e === 'piedra' ? 'dos_aguas' : 'plano', axis: 'x', oh: 1 });
  eraOpening(m, 'pz', 21, 16, 3, era, 'ventana');
  if (L >= 2) {
    for (let x = 2; x <= 21; x++) v.set(x, 7, 23, ['#ee8a5c', '#ffd166', '#8fd3ff', '#6fe3c1'][x % 4]);
    v.box(2, 1, 23, 1, 7, 1, legC); v.box(21, 1, 23, 1, 7, 1, legC);
    bush(v, 2, 1, 4, 1.5, C.leaf, [P.clay], 4); bush(v, 21, 1, 4, 1.5, C.leaf, [C.yellow], 5);
  }
  if (L >= 3) flowerBed(v, 1, 1, 17, 3, 3, 31, { colors: [P.clay, '#ffffff', C.yellow] });
  // nivel 4: elemento vertical de la época al fondo (torre, chimenea, tanque o antena)
  if (L >= 4) {
    if (e === 'piedra') peak = Math.max(peak, eraVertical(m, 19, 1, 1, era, { w: 4, h: 12 }));
    else if (e === 'hierro') peak = Math.max(peak, eraVertical(m, 19, 1, 1, era, { w: 4, h: 9 }));
    else if (e === 'vidrio') peak = Math.max(peak, eraVertical(m, 21, 1, 2, era, { h: 16 }));
    else peak = Math.max(peak, eraVertical(m, 20, 1, 2, era, { h: e === 'ladrillo' ? 16 : 10 }));
  }
  // nivel 5: lamparitas en el aro (giran con la rueda) y cerco
  if (L >= 5) {
    const bulbs = m.part('wheel', [cx, cy, zw + 1], { mat: 'light', cast: false });
    for (let k = 0; k < 16; k++) { const a = (k + 0.5) / 16 * Math.PI * 2; bulbs.set(Math.floor(cx + Math.cos(a) * (R + 0.9)), Math.floor(cy + Math.sin(a) * (R + 0.9)), zw + 1, k % 2 ? '#ffffff' : C.yellow); }
    eraFence(m, era, { gaps: [5, 6, 7, 8, 9, 10, 11] });
    sparkle(m, 4, 10, 20, '#ffffff');
  }
  m.height = peak + 1;
}

// ======================= TEATRO =======================
// Firma: arco con telón rojo, pórtico con columnas y frontón, cúpula atrás.
function teatro(m, L, o = {}) {
  const era = o.era || 1, v = m.v, s = eraStyle(era), e = s.id;
  eraGround(m, era);
  const x0 = 2, x1 = 21, z0 = 2, z1 = 12;
  const { top, roofTop } = hall(m, L, era, { x0, x1, z0, z1, h: [11, 12, 12, 12, 10], up: 5, axis: 'x', seed: 17 });
  let peak = roofTop;
  // arco central con telón rojo
  const ax0 = 9, ax1 = 14, ay0 = 2, ay1 = 9;
  for (let x = ax0; x <= ax1; x++) for (let y = ay0; y <= ay1; y++) { v.remove(x, y, z1); v.set(x, y, z1 - 1, (x - ax0) % 2 ? '#b8324f' : '#d9456a'); }
  for (let x = ax0; x <= ax1; x++) v.set(x, ay1, z1, P.gold);
  for (let x = ax0 - 1; x <= ax1 + 1; x++) v.set(x, ay1 + 1, z1, s.trim);
  for (const x of [ax0 - 1, ax1 + 1]) v.box(x, ay0, z1, 1, ay1 - ay0 + 1, 1, s.trim);
  // ventanas a los costados del arco y en el lado derecho
  for (let f = 0; f < (L >= 3 ? 2 : 1); f++) {
    const wy = 4 + f * 6;
    eraOpening(m, 'pz', z1, 4, wy, era, 'ventana', { big: L >= 4 }); eraOpening(m, 'pz', z1, 17, wy, era, 'ventana', { big: L >= 4 });
    winRow(m, 'px', x1, z0 + 2, z1 - 2, wy, era, {});
  }
  // cúpula atrás (más grande desde el nivel 3)
  const dr = L >= 3 ? 5 : 3.5;
  peak = Math.max(peak, dome(m, 11.5, 6, top, roofTop, dr, era));
  v.box(11, peak + 1, 6, 1, 2, 1, s.trim); v.set(11, peak + 3, 6, e === 'vidrio' || e === 'hierro' ? s.accent : P.gold); peak += 3;
  // nivel 1: escalinata y frontón chico sobre el arco · nivel 2: pórtico con columnas y frontón ancho
  for (let x = 8; x <= 15; x++) v.set(x, 1, z1 + 1, s.trim);
  if (L < 2) {
    if (e === 'hierro' || e === 'vidrio') v.box(ax0 - 2, ay1 + 2, z1 + 1, ax1 - ax0 + 5, 1, 2, s.trim);
    else gable(v, 'z', ax0 - 2, ax1 + 2, z1 + 1, z1 + 1, ay1 + 2, s.roof, { wall: s.trim, oh: 0, trim: s.trim, ridge: s.roofD });
  } else {
    const pz0 = z1 + 1, pz1 = z1 + 4, ch = 9;
    v.box(x0, 1, pz0, x1 - x0 + 1, 1, 4, s.trim);
    v.box(x0 + 1, 1, pz1 + 1, x1 - x0 - 1, 1, 2, e === 'madera' ? s.wallD : s.base);
    const colC = e === 'madera' ? EP.madera.post : e === 'hierro' ? s.trim : e === 'vidrio' ? s.light : '#f4efe6';
    const cols = e === 'hierro' || e === 'vidrio' ? [3, 7, 11, 12, 16, 20] : [3, 6, 9, 14, 17, 20];
    for (const x of cols) { v.box(x, 2, pz1, 1, ch, 1, colC); if (e !== 'vidrio' && e !== 'hierro') { v.set(x, 2, pz1, s.base); v.set(x, ch + 1, pz1, s.trim); } }
    v.box(x0, ch + 2, pz0, x1 - x0 + 1, 1, 4, e === 'madera' ? s.wallD : s.trim);
    if (e === 'hierro' || e === 'vidrio') {
      // marquesina recta con letras luminosas
      for (let x = x0; x <= x1; x++) for (let z = pz0; z <= pz1 + 1; z++) v.set(x, ch + 3, z, z === pz1 + 1 ? s.accent : (e === 'vidrio' ? C.glass : s.sheet));
      for (let x = 6; x <= 17; x++) if (x % 2 === 0) m.light.set(x, ch + 4, pz1 + 1, '#fff3cf');
    } else {
      const pt = gable(v, 'z', x0, x1, pz0, pz1, ch + 3, s.roof, { wall: e === 'madera' ? s.wall : s.trim, oh: 0, trim: s.roofD, ridge: s.roofD, stripes: false });
      pattern(v, 'pz', pz1, 9, ch + 4, ['.ww..pp.', 'wkkw.pkp', '.ww..pp.'], { w: '#ffffff', k: P.ink, p: P.clay });
      peak = Math.max(peak, pt);
    }
    // estandartes
    for (const x of [4, 18]) { v.box(x, 4, z1 + 1, 2, 5, 1, P.clay); v.set(x, 3, z1 + 1, P.gold); v.set(x + 1, 3, z1 + 1, P.gold); }
  }
  // faroles de la escalinata
  for (const x of [1, 22]) { v.box(x, 1, 19, 1, 5, 1, e === 'madera' ? EP.madera.post : P.ink); m.light.set(x, 6, 19, C.yellow); v.set(x, 7, 19, e === 'madera' ? EP.madera.post : P.ink); }
  bush(v, 2, 1, 22, 1.2, C.leafD, [C.red], 2);
  if (L >= 2) bush(v, 21, 1, 22, 1.2, C.leafD, [C.red], 21);
  // nivel 4: elemento vertical y faroles en la puerta
  if (L >= 4) { peak = Math.max(peak, vertical(m, era, x1 - 1, z0, top, roofTop)); doorLamps(m, 'pz', z1, ax0 - 1, ax1 + 1, 2); }
  // nivel 5: bandera sobre la cúpula y cerco
  if (L >= 5) {
    v.box(11, peak, 6, 1, 6, 1, e === 'madera' ? EP.madera.post : '#ffffff');
    wavingFlag(m, 11, peak + 3, 6, 4, 3, P.clay); peak += 7;
    eraFence(m, era, { gaps: [8, 9, 10, 11, 12, 13, 14, 15] });
    sparkle(m, 5, top + 4, 15, '#ffffff'); sparkle(m, 19, top + 2, 15, P.goldL);
  }
  m.height = peak + 1;
}

export const BIG_SHOP_BUILDERS = { cine, spa, rueda, teatro };
