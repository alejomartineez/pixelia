// Viñetas 2D de "El Quiebre" (PLAN-TRAVESIA §3b): la acción entre personajes que en 3D sale dura. Se arman sobre el
// motor de src/cinema/pixel2d.js y se revisan cuadro a cuadro en tools/cinema.html (?v=orden&view=strip).
//   orden    · plano 4: el capataz enano le muestra a una noble que la veta se apaga; ella señala la mina: más hondo.
//   robo     · plano 5: el forcejeo frente al depósito, el cristal pasa a la mano del cómplice y la guardia los persigue.
//   caida    · plano 6: un enano cava, la tierra se parte, gente que cae; el enano queda colgado y un guardia lo saca.
//   cofradia · plano 9: tres de la Cofradía miran subir las islas desde un risco; dos se alarman, uno no, y se va.
// Los carteles que presentan a cada quien los pone intro.js (eventos `label` con `px`); acá se exportan los puntos.
import { defineVignette, skyBands, rooftops, halo, pixels, dither, crystalProp, depotNight } from './pixel2d.js';

const hex = (n) => '#' + (n & 0xffffff).toString(16).padStart(6, '0');
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ---------- elenco (looks de sprite2d; los mismos pueblos y ropas que el 3D) ----------
export const CAST = {
  noble: { type: 'humano', build: 'esbelto', skin: 0, hair: 'rodete', hairColor: 'rubio', face: 'ninguna', dress: 'vestido_noble', dressColor: 'rojo', crown: 'ninguna', acc: 'ninguno' },
  guardia: { type: 'humano', build: 'recio', skin: 2, hair: 'corto', hairColor: 'negro', face: 'ninguna', dress: 'tabardo', dressColor: 'rojo', crown: 'casco', acc: 'ninguno' },
  guardiaLanza: { type: 'humano', build: 'recio', skin: 3, hair: 'cortito', hairColor: 'negro', face: 'barba_corta', dress: 'tabardo', dressColor: 'rojo', crown: 'casco', acc: 'lanza' },
  guardiaFarol: { type: 'humano', build: 'recio', skin: 1, hair: 'cortito', hairColor: 'gris', face: 'cicatriz', dress: 'tabardo', dressColor: 'rojo', crown: 'casco', acc: 'farolito' },
  capataz: { type: 'enano', build: 'recio', skin: 1, hair: 'cortito', hairColor: 'pelirrojo', face: 'barba_larga', dress: 'minero', dressColor: 'durazno', crown: 'casco', acc: 'ninguno' },
  cavador: { type: 'enano', build: 'recio', skin: 3, hair: 'trenzas', hairColor: 'negro', face: 'barba_larga', dress: 'minero', dressColor: 'dorado', crown: 'vincha', acc: 'martillo' },
  ladrona: { type: 'zorro', build: 'esbelto', skin: 0, hair: 'coleta', hairColor: 'blanco', face: 'ninguna', dress: 'cuero', dressColor: 'negro', crown: 'capucha', acc: 'ninguno' },
  complice: { type: 'humano', build: 'esbelto', skin: 4, hair: 'despeinado', hairColor: 'castano', face: 'ninguna', dress: 'viajero', dressColor: 'verde', crown: 'gorra', acc: 'ninguno' },
  vecino: { type: 'humano', build: 'esbelto', skin: 2, hair: 'corto', hairColor: 'castano', face: 'ninguna', dress: 'jubon', dressColor: 'azul', crown: 'ninguna', acc: 'ninguno' },
  vecina: { type: 'anuro', build: 'recio', skin: 1, hair: 'ninguno', hairColor: 'negro', face: 'ninguna', dress: 'delantal', dressColor: 'menta', crown: 'ninguna', acc: 'ninguno' },
  vecinoZorro: { type: 'zorro', build: 'recio', skin: 2, hair: 'corto', hairColor: 'gris', face: 'ninguna', dress: 'viajero', dressColor: 'verde', crown: 'gorra', acc: 'ninguno' },
  cofrade1: { type: 'zorro', build: 'esbelto', skin: 1, hair: 'corto', hairColor: 'negro', face: 'ninguna', dress: 'abrigo', dressColor: 'negro', crown: 'capucha', acc: 'farolito' },
  cofrade2: { type: 'humano', build: 'recio', skin: 1, hair: 'corto', hairColor: 'gris', face: 'ninguna', dress: 'abrigo', dressColor: 'violeta', crown: 'capucha', acc: 'ninguno' },
  cofrade3: { type: 'humano', build: 'esbelto', skin: 3, hair: 'coleta', hairColor: 'negro', face: 'ninguna', dress: 'abrigo', dressColor: 'azul', crown: 'capucha', acc: 'ninguno' },
};

// ---------- pinceles propios ----------
/** Ladrillos/sillares de piedra en un rectángulo. */
function ashlar(g, x0, y0, W, H, { a = 0x3a3434, b = 0x433c3a, j = 0x221e1e, bw = 14, bh = 7, seed = 3 } = {}) {
  const r = rng(seed);
  for (let y = y0; y < y0 + H; y++) for (let x = x0; x < x0 + W; x++) {
    const row = Math.floor((y - y0) / bh), off = row % 2 ? bw / 2 : 0;
    const joint = (y - y0) % bh === 0 || (x - x0 + off) % bw === 0;
    g.fillStyle = hex(joint ? j : r() < 0.1 ? b : a);
    g.fillRect(x, y, 1, 1);
  }
}
/** Estandarte de una Casa (rojo con el rombo dorado). */
function banner(g, x, y, h = 30) {
  g.fillStyle = '#4a1a18'; g.fillRect(x, y, 14, h); g.fillStyle = '#7a2e2a'; g.fillRect(x + 1, y, 12, h - 2);
  g.fillStyle = '#4a1a18'; g.fillRect(x + 1, y + h - 2, 5, 2); g.fillRect(x + 8, y + h - 2, 5, 2);
  pixels(g, x + 4, y + Math.floor(h / 2) - 4, ['..b..', '.bbb.', 'bb.bb', '.bbb.', '..b..'], { b: 0xb8923e });
  g.fillStyle = '#b8923e'; g.fillRect(x - 1, y - 1, 16, 1);
}

// =====================================================================================================================
// Plano 4 · la orden. Salón de la torre al atardecer: la noble en el estrado, un guardia con lanza. Entra el capataz con
// un cristal de veta que apenas brilla, lo levanta para mostrarlo; ella señala la boca de la mina; él baja la cabeza,
// guarda el cristal y baja por la escalera.
// =====================================================================================================================
export const ORDEN = { GROUND: 150, DAIS: 10, guard: 86, noble: 112, capataz: 196, pit: 250 };
defineVignette('orden', (v) => {
  const { GROUND, DAIS } = ORDEN;
  v.layer(0, (g, W, H) => skyBands(g, W, H, [0x1a1012, 0x2a1a1c, 0x3a2622]), { width: 320 });
  // pared del salón con ventanal (atardecer y las torres de las Casas afuera), estandartes y piso de tablas
  v.layer(1, (g, W, H) => {
    ashlar(g, 0, 40, W, GROUND - 40, { seed: 8 });
    // ventanal en arco
    const wx = 150, wy = 62, ww = 56, wh = 70;
    for (let y = wy; y < wy + wh; y++) for (let x = wx; x < wx + ww; x++) {
      const dx = x - (wx + ww / 2), arc = y < wy + ww / 2 && Math.hypot(dx, y - (wy + ww / 2)) > ww / 2;
      if (arc) continue;
      const u = (y - wy) / wh;
      g.fillStyle = hex(dither(x, y, u) ? 0xd88a5a : u < 0.5 ? 0x6a4a5a : 0xb86a4a);
      g.fillRect(x, y, 1, 1);
    }
    // torres de las Casas recortadas en el ventanal
    g.fillStyle = '#2a1c20';
    for (const [tx, th] of [[156, 40], [170, 54], [188, 34], [198, 46]]) { g.fillRect(tx, wy + wh - th, 8, th); for (let k = 0; k < 8; k += 3) g.fillRect(tx + k, wy + wh - th - 2, 2, 2); }
    g.fillStyle = '#7ad0e8'; g.fillRect(173, wy + wh - 46, 2, 2);   // la veta en lo alto de una torre
    // marco y parteluz
    g.fillStyle = '#1e1818'; g.fillRect(wx + ww / 2 - 1, wy + 8, 2, wh - 8); g.fillRect(wx, wy + 38, ww, 2);
    banner(g, 118, 66, 34); banner(g, 228, 66, 34);
    // estrado de piedra con dos escalones
    g.fillStyle = '#3a3030'; g.fillRect(60, GROUND - DAIS, 90, DAIS);
    g.fillStyle = '#4a3e3c'; g.fillRect(60, GROUND - DAIS, 90, 2);
    g.fillStyle = '#332a2a'; g.fillRect(150, GROUND - 5, 8, 5); g.fillStyle = '#4a3e3c'; g.fillRect(150, GROUND - 5, 8, 1);
    // alfombra roja sobre el estrado
    g.fillStyle = '#5a201e'; g.fillRect(80, GROUND - DAIS, 60, 1);
    // piso de tablas
    for (let y = GROUND; y < H; y++) for (let x = 0; x < W; x++) {
      const plank = Math.floor(y / 5) % 2, seam = y % 5 === 0 || (x + plank * 9) % 26 === 0;
      g.fillStyle = seam ? '#24180f' : (x + y) % 7 ? '#4a3420' : '#523a24';
      g.fillRect(x, y, 1, 1);
    }
    // boca de la mina en el piso: un hueco con escalera y luz de veta abajo
    g.fillStyle = '#0a0808'; g.fillRect(ORDEN.pit - 14, GROUND, 28, 12);
    g.fillStyle = '#5a4430'; g.fillRect(ORDEN.pit - 16, GROUND, 2, 12); g.fillRect(ORDEN.pit + 14, GROUND, 2, 12);
    for (let y = GROUND + 2; y < GROUND + 12; y += 3) { g.fillStyle = '#6a5038'; g.fillRect(ORDEN.pit - 6, y, 12, 1); }
    g.fillStyle = '#6a5038'; g.fillRect(ORDEN.pit - 7, GROUND, 1, 12); g.fillRect(ORDEN.pit + 6, GROUND, 1, 12);
  }, { width: 320, height: 180 });
  // la luz de veta que sube de la mina (titila)
  v.live((g, t) => halo(g, ORDEN.pit, GROUND + 4, 14, 0x3e8aa8, 0.55 + 0.15 * Math.sin(t * 3)));
  // borde del hueco por delante (tapa a quien baja)
  v.front(1, (g, W, H) => {
    for (let y = GROUND + 12; y < H; y++) for (let x = ORDEN.pit - 18; x < ORDEN.pit + 18; x++) {
      const plank = Math.floor(y / 5) % 2, seam = y % 5 === 0 || (x + plank * 9) % 26 === 0;
      g.fillStyle = seam ? '#24180f' : (x + y) % 7 ? '#4a3420' : '#523a24';
      g.fillRect(x, y, 1, 1);
    }
  }, { width: 320, height: 180 });

  const guard = v.actor(CAST.guardiaLanza, { x: ORDEN.guard, y: GROUND - DAIS + 1 });
  const noble = v.actor(CAST.noble, { x: ORDEN.noble, y: GROUND - DAIS + 1 });
  const boss = v.actor(CAST.capataz, { x: 330, y: GROUND + 1, flip: true });
  // el cristal que se apaga: un brillo que late cada vez más flojo sobre la mano en alto
  const lamp = { dim: 1 };
  v.at(0, () => { lamp.dim = 1; boss.opts = {}; });
  v.live((g, t) => {
    if (boss.anim !== 'lift') return;
    const k = Math.max(0.15, lamp.dim) * (0.7 + 0.3 * Math.abs(Math.sin(t * (6 + (1 - lamp.dim) * 10))));
    halo(g, Math.round(boss.x) - 11, GROUND - 19, 10, 0x5fb4d0, k);
  });

  v.cam.x = 166; v.cam.y = 112; v.cam.zoom = 2;
  // 0 s: entra el capataz por la derecha
  v.at(0, () => boss.play('walk'));
  v.tween(boss, { x: ORDEN.capataz }, { at: 0, dur: 2.2, ease: 'out' });
  v.tween(v.cam, { x: 144 }, { at: 0.4, dur: 2, ease: 'inOut' });
  // 2,3 s: levanta el cristal para mostrarlo; el brillo se va apagando
  v.at(2.3, () => { boss.opts = { item: 'veta' }; boss.play('lift', { loop: false, hold: 1 }); });
  v.tween(lamp, { dim: 0.15 }, { at: 2.6, dur: 3.2, ease: 'linear' });
  v.at(3.6, (vv) => vv.burst('polvo', ORDEN.capataz - 11, GROUND - 22, 6, { speed: 8, life: 1.4, color: 0x7a8890 }));
  v.at(4.8, (vv) => vv.burst('polvo', ORDEN.capataz - 11, GROUND - 22, 6, { speed: 8, life: 1.4, color: 0x7a8890 }));
  // 6,2 s: la noble señala la boca de la mina; la cámara se acerca a ella
  v.at(6.2, () => noble.play('point', { loop: false, hold: 1 }));
  v.tween(v.cam, { x: 142, y: 116 }, { at: 6.0, dur: 1, ease: 'inOut' });
  // 7,6 s: él baja el cristal, se da vuelta y va a la mina
  v.at(7.6, () => { boss.opts = {}; boss.play('idle'); });
  v.at(8.2, () => { boss.flip = false; boss.play('walk'); });
  v.tween(boss, { x: ORDEN.pit }, { at: 8.2, dur: 1.6, ease: 'inOut' });
  v.tween(v.cam, { x: 182 }, { at: 8.2, dur: 1.8, ease: 'inOut' });
  // 9,9 s: baja por la escalera (lo tapa el borde del hueco)
  v.at(9.9, () => boss.play('idle'));
  v.tween(boss, { y: GROUND + 34 }, { at: 9.9, dur: 1.6, ease: 'in' });
  v.at(10.4, () => noble.play('idle'));
}, { dur: 12, seed: 4 });

// =====================================================================================================================
// Plano 5 · el robo. De noche frente al depósito: la ladrona sale con un cristal, el guardia le corta el paso y
// forcejean; ella lo empuja y el cristal vuela a las manos del cómplice; los dos corren y dos guardias los persiguen.
// =====================================================================================================================
export const ROBO = { GROUND: 150 };
defineVignette('robo', (v) => {
  const GROUND = ROBO.GROUND;
  depotNight(v, GROUND);
  const thief = v.actor(CAST.ladrona, { x: 130, y: GROUND + 2, opts: { item: 'veta' } });
  const mate = v.actor(CAST.complice, { x: 74, y: GROUND + 2 });
  const guard = v.actor(CAST.guardia, { x: 340, y: GROUND + 2, flip: true });
  const guard2 = v.actor(CAST.guardiaFarol, { x: 380, y: GROUND + 2, flip: true });
  const crystal = crystalProp(v, 158, GROUND - 14);
  crystal.visible = false; crystal.z = 40;
  // el farol del segundo guardia ilumina el empedrado mientras corre
  v.live((g) => { if (guard2.x < 330) halo(g, Math.round(guard2.x) - 8, GROUND - 14, 16, 0x9a6a30, 0.7); });

  v.cam.x = 120; v.cam.y = 118; v.cam.zoom = 2;
  v.at(0, () => { thief.opts = { item: 'veta' }; mate.opts = {}; });
  // 0 s: sale con el cristal en alto; el cómplice la espera
  v.at(0, () => thief.play('lift', { loop: false, hold: 1 }));
  // 1,4 s: llega el guardia por la derecha y la señala
  v.at(1.4, () => guard.play('walk'));
  v.tween(guard, { x: 214 }, { at: 1.4, dur: 1.6, ease: 'out' });
  v.tween(v.cam, { x: 170 }, { at: 1.4, dur: 1.6, ease: 'inOut' });
  v.at(3.0, () => guard.play('point', { loop: false, hold: 1 }));
  // 3,4 s: ella avanza; se cruzan; el cómplice se acerca por detrás
  v.at(3.4, () => { thief.opts = {}; thief.play('walk'); crystal.visible = true; crystal.x = thief.x + 12; crystal.y = GROUND - 15; });
  v.tween(thief, { x: 172 }, { at: 3.4, dur: 0.7, ease: 'out' });
  v.tween(crystal, { x: 184 }, { at: 3.4, dur: 0.7, ease: 'out' });
  v.tween(guard, { x: 196 }, { at: 3.5, dur: 0.6, ease: 'out' });
  v.at(3.4, () => mate.play('walk'));
  v.tween(mate, { x: 118 }, { at: 3.4, dur: 1.4, ease: 'out' });
  v.at(4.8, () => mate.play('idle'));
  v.tween(v.cam, { x: 170, y: 124, zoom: 3 }, { at: 3.5, dur: 0.6, ease: 'inOut' });
  // 4,1–5,6 s: el tironeo (los dos con el brazo estirado sobre el cristal, a 24 px)
  v.at(4.1, () => { thief.play('point', { loop: false, hold: 1 }); guard.play('point', { loop: false, hold: 1 }); });
  [[4.3, -4], [4.65, 5], [5.0, -4], [5.35, 3]].forEach(([at, d], i) => {
    const base = [172, 196, 184];
    v.tween(thief, { x: base[0] + d }, { at, dur: 0.25, ease: 'inOut' });
    v.tween(guard, { x: base[1] + d }, { at, dur: 0.25, ease: 'inOut' });
    v.tween(crystal, { x: base[2] + d, y: GROUND - 15 - (i % 2) }, { at, dur: 0.25, ease: 'inOut' });
    v.at(at + 0.2, (vv) => { vv.shake(1); vv.burst('chispa', base[2] + d, GROUND - 17, 4, { speed: 30, life: 0.4 }); });
  });
  // 5,8 s: ella lo empuja; el guardia trastabilla; el cristal vuela hacia atrás, por encima, al cómplice
  v.at(5.8, (vv) => { thief.play('attack', { loop: false, hold: 2 }); guard.play('hurt'); vv.shake(3); vv.burst('brillo', 186, GROUND - 18, 10, { speed: 30, life: 0.8 }); });
  v.tween(guard, { x: 214 }, { at: 5.85, dur: 0.4, ease: 'out' });
  v.tween(v.cam, { x: 150, y: 118, zoom: 2 }, { at: 5.9, dur: 0.7, ease: 'inOut' });
  v.tween(crystal, { x: 150, y: GROUND - 58 }, { at: 5.9, dur: 0.4, ease: 'out' });
  v.tween(crystal, { x: 122, y: GROUND - 32 }, { at: 6.3, dur: 0.4, ease: 'in' });
  v.at(6.35, () => mate.play('lift', { loop: false, hold: 1 }));
  // 6,7 s: lo atrapa (el cristal pasa a su mano) y salen corriendo a la izquierda
  v.at(6.7, (vv) => { crystal.visible = false; mate.opts = { item: 'veta' }; vv.burst('brillo', 118, GROUND - 34, 8, { speed: 14, life: 0.6 }); });
  v.at(7.2, () => { mate.opts = {}; mate.flip = true; mate.play('walk'); thief.flip = true; thief.play('walk'); });
  v.tween(mate, { x: -30 }, { at: 7.2, dur: 2.2, ease: 'linear' });
  v.tween(thief, { x: -10 }, { at: 7.3, dur: 2.4, ease: 'linear' });
  // 7,4 s: el guardia se repone y, con otro que trae farol, los persiguen
  v.at(7.4, () => { guard.play('walk'); guard2.play('walk'); });
  v.tween(guard, { x: 20 }, { at: 7.5, dur: 2.8, ease: 'linear' });
  v.tween(guard2, { x: 48 }, { at: 7.4, dur: 3.0, ease: 'linear' });
  v.tween(v.cam, { x: 92 }, { at: 7.4, dur: 2.4, ease: 'inOut' });
}, { dur: 10.6, seed: 13 });

// =====================================================================================================================
// Plano 6 · el Quiebre. Pueblo al atardecer: un enano golpea el suelo con el martillo y un guardia le marca dónde; cada
// golpe hace temblar más. La tierra se parte justo ahí: una vecina cae, otro vecino resbala y cae. Un guardia se asoma,
// el borde cede y queda colgado; el mismo enano le da la mano y lo saca.
// =====================================================================================================================
export const CAIDA = { GROUND: 140, CX: 160, MAXW: 28 };
defineVignette('caida', (v) => {
  const { GROUND, CX, MAXW } = CAIDA;
  const crack = { w: 0, glow: 0 };
  // cielo rojizo y tierra lejana
  v.layer(0, (g, W, H) => {
    skyBands(g, W, H, [0x1c1418, 0x3a1e1c, 0x6a3020, 0x9a4a28, 0xb86a3a]);
    const r = rng(5);
    for (let i = 0; i < 30; i++) { g.fillStyle = '#4a2a22'; g.fillRect(Math.floor(r() * W), 20 + Math.floor(r() * 40), 3 + Math.floor(r() * 6), 1); }
  }, { width: 320 });
  v.layer(0.3, (g, W, H) => {
    g.fillStyle = '#3a2220';
    for (let x = 0; x < W; x++) { const h = 18 + Math.round(Math.sin(x * 0.03) * 8 + Math.sin(x * 0.11) * 3); g.fillRect(x, 112 - h, 1, h + 40); }
  }, { width: 440, height: 200 });
  v.layer(0.6, (g, W, H) => rooftops(g, W, H, { base: GROUND - 2, color: 0x2a1a1a, lit: 0xd08040, seed: 17, min: 10, max: 26, windows: 0.04 }), { width: 520, height: 200 });
  // el suelo de atrás (detrás de los actores): una franja de tierra hasta el pie
  v.layer(1, (g, W, H) => {
    for (let y = GROUND - 6; y <= GROUND + 1; y++) for (let x = 0; x < W; x++) { g.fillStyle = (x * 7 + y * 3) % 11 ? '#4a3626' : '#56402c'; g.fillRect(x, y, 1, 1); }
  }, { width: 320, height: 180 });
  // la grieta: hueco negro con la Brasa abajo; detrás de los actores
  v.live((g, t) => {
    if (crack.w < 1) return;
    for (let y = GROUND - 4; y < 180; y++) {
      const half = crackHalf(y, crack.w, GROUND);
      const glowU = Math.max(0, (y - GROUND - 10) / 30);
      for (let x = Math.floor(CX - half); x <= Math.ceil(CX + half); x++) {
        g.fillStyle = dither(x, y, glowU * crack.glow) ? (dither(x + 1, y, 0.5 + 0.3 * Math.sin(t * 6 + x)) ? '#e8703a' : '#a8401e') : '#0c0808';
        g.fillRect(x, y, 1, 1);
      }
    }
  });
  // el suelo de adelante (tapa a quien cae), con el hueco de la grieta
  v.live((g) => {
    for (let y = GROUND + 2; y < 180; y++) {
      const half = crack.w < 1 ? -1 : crackHalf(y, crack.w, GROUND);
      for (let x = 0; x < 320; x++) {
        if (half >= 0 && x >= CX - half && x <= CX + half) continue;
        const edge = half >= 0 && (Math.abs(x - (CX - half)) < 2 || Math.abs(x - (CX + half)) < 2);
        g.fillStyle = edge ? (y < GROUND + 6 ? '#2a1c14' : '#b0502a') : y < GROUND + 4 ? '#6a5038' : (x * 5 + y * 3) % 13 ? '#4a3626' : '#3e2c1e';
        g.fillRect(x, y, 1, 1);
      }
    }
  }, { front: true });

  const digger = v.actor(CAST.cavador, { x: 194, y: GROUND + 1, flip: true });
  const boss = v.actor(CAST.guardia, { x: 232, y: GROUND + 1, flip: true });
  const fallA = v.actor(CAST.vecina, { x: CX, y: GROUND + 1 });
  const fallB = v.actor(CAST.vecino, { x: 124, y: GROUND + 1 });
  const watch = v.actor(CAST.vecinoZorro, { x: 92, y: GROUND + 1 });

  v.cam.x = 164; v.cam.y = 124; v.cam.zoom = 2;
  v.at(0, () => { crack.w = 0; crack.glow = 0; digger.look = CAST.cavador; digger.opts = {}; boss.opts = {}; });
  // 0–5 s: el enano golpea el suelo; el guardia señala; cada golpe tiembla más
  v.at(0.2, () => boss.play('point', { loop: false, hold: 1 }));
  [0.6, 1.6, 2.6, 3.5, 4.3, 5.0].forEach((at, i) => {
    v.at(at, (vv) => { digger.play('attack', { loop: false, hold: 2 }); });
    v.at(at + 0.3, (vv) => { vv.shake(1 + i * 0.5); vv.burst('polvo', 178, GROUND, 4 + i * 2, { speed: 16, life: 0.8 }); });
  });
  // 5,6 s: la tierra se parte donde golpeaba; el enano salta para atrás
  v.at(5.6, (vv) => { vv.shake(4); vv.burst('polvo', CX, GROUND, 24, { speed: 30, spread: Math.PI, life: 1.2 }); digger.play('hurt'); boss.play('hurt'); fallA.play('hurt'); fallB.play('hurt'); watch.play('hurt'); });
  v.tween(crack, { w: MAXW, glow: 1 }, { at: 5.6, dur: 1.6, ease: 'out' });
  v.tween(digger, { x: 210 }, { at: 5.7, dur: 0.5, ease: 'out' });
  v.tween(boss, { x: 240 }, { at: 5.7, dur: 0.5, ease: 'out' });
  v.at(6.0, (vv) => vv.burst('chispa', CX, GROUND + 20, 14, { speed: 50, life: 0.9 }));
  // 6,2 s: la vecina cae en la grieta
  v.at(6.2, () => fallA.play('fall', { loop: false, hold: 1 }));
  v.tween(fallA, { y: GROUND + 70 }, { at: 6.3, dur: 1.2, ease: 'in' });
  // 7,4 s: el vecino de la izquierda resbala hacia el borde y cae
  v.at(7.4, () => fallB.play('fall', { loop: false, hold: 1 }));
  v.tween(fallB, { x: CX - 3 }, { at: 7.4, dur: 0.5, ease: 'in' });
  v.tween(fallB, { y: GROUND + 70 }, { at: 7.8, dur: 1.2, ease: 'in' });
  v.at(7.6, () => watch.play('point', { loop: false, hold: 1 }));
  // 9 s: el enano se asoma a mirar a los que cayeron; el borde cede y queda colgado (suelta el martillo, que cae)
  v.at(9.0, () => digger.play('walk'));
  v.tween(digger, { x: CX + MAXW / 2 + 9 }, { at: 9.0, dur: 0.8, ease: 'out' });
  v.at(9.9, (vv) => { digger.look = { ...CAST.cavador, acc: 'ninguno' }; digger.play('hurt'); vv.shake(2); vv.burst('polvo', CX + MAXW / 2 + 2, GROUND, 10, { speed: 18, life: 0.9 }); });
  v.tween(digger, { x: CX + MAXW / 2 - 2, y: GROUND + 18 }, { at: 10.0, dur: 0.35, ease: 'in' });
  v.at(10.35, () => { digger.opts = { item: 'nada' }; digger.play('lift', { loop: false, hold: 1 }); });
  v.tween(v.cam, { x: 192, y: 122 }, { at: 10.2, dur: 0.9, ease: 'inOut' });
  // 10,6 s: el guardia que le marcaba dónde cavar corre y le da la mano
  v.at(10.6, () => boss.play('walk'));
  v.tween(boss, { x: CX + MAXW / 2 + 20 }, { at: 10.6, dur: 0.9, ease: 'out' });
  v.at(11.6, () => { boss.opts = { item: 'nada' }; boss.play('point', { loop: false, hold: 1 }); });
  // 12,2 s: lo saca: el enano sube al borde y los dos se apartan de la grieta
  v.tween(digger, { y: GROUND + 1, x: CX + MAXW / 2 + 6 }, { at: 12.2, dur: 0.8, ease: 'out' });
  v.tween(boss, { x: CX + MAXW / 2 + 30 }, { at: 12.2, dur: 0.8, ease: 'out' });
  v.at(13.0, () => { boss.opts = {}; digger.opts = {}; boss.play('idle'); digger.play('idle'); });
  v.at(13.4, () => { boss.flip = false; digger.flip = false; boss.play('walk'); digger.play('walk'); });
  v.tween(digger, { x: CX + MAXW / 2 + 20 }, { at: 13.4, dur: 0.8, ease: 'out' });
  v.tween(boss, { x: CX + MAXW / 2 + 42 }, { at: 13.4, dur: 0.8, ease: 'out' });
  v.at(14.2, () => { boss.flip = true; digger.flip = true; boss.play('idle'); digger.play('idle'); });
  v.tween(v.cam, { x: 176, y: 124 }, { at: 13.6, dur: 1.4, ease: 'inOut' });
}, { dur: 16, seed: 21 });
/** Medio ancho de la grieta a la altura y: se abre hacia abajo con bordes mordidos. */
function crackHalf(y, w, GROUND) {
  const d = y - GROUND;
  const jag = ((Math.imul(y | 0, 2654435761) >>> 28) % 3) - 1;
  return Math.max(0, w / 2 * Math.min(1, 0.55 + d / 40) + jag);
}

// =====================================================================================================================
// Plano 9 · la Cofradía. De noche, desde un risco lejano: los pedazos con Céfiro suben a lo lejos. Tres de la Cofradía
// miran; dos se alarman (uno señala, otro levanta el farol); el del medio no se mueve, se da vuelta y se va.
// =====================================================================================================================
export const COFRADIA = { GROUND: 132 };
defineVignette('cofradia', (v) => {
  const GROUND = COFRADIA.GROUND;
  v.layer(0, (g, W, H) => {
    skyBands(g, W, H, [0x05060c, 0x0a0c1a, 0x141a30, 0x1e2440, 0x2a2a44]);
    const r = rng(19);
    for (let i = 0; i < 90; i++) { g.fillStyle = r() < 0.25 ? '#cfd8ee' : '#5a6684'; g.fillRect(Math.floor(r() * W), Math.floor(r() * H * 0.7), 1, 1); }
  }, { width: 320 });
  // islas que suben a lo lejos, con un cristal de Céfiro debajo de cada una; el continente roto abajo
  const isles = [[200, 128, 18, 0], [236, 140, 11, 0.6], [172, 150, 8, 1.3], [262, 118, 7, 2.0]];
  v.live((g, t) => {
    for (const [x0, y0, R, d] of isles) {
      const y = Math.round(y0 - Math.max(0, t - d) * 4.2), x = x0;
      halo(g, x, y + R / 2 + 3, R, 0x5fb4d0, 0.5);
      for (let j = 0; j < R; j++) {
        const half = Math.round(R * (1 - j / R) ** 0.9);
        g.fillStyle = j === 0 ? '#3a4a2a' : j < 2 ? '#3a2e24' : '#26222a';
        g.fillRect(x - half, y + j, half * 2 + 1, 1);
      }
      g.fillStyle = '#bfefff'; g.fillRect(x - 1, y + R - 2, 2, 2);
    }
    // la tierra que quedó abajo
    g.fillStyle = '#140e10';
    for (let x = 140; x < 360; x++) { const h = 10 + Math.round(Math.sin(x * 0.07) * 4 + Math.sin(x * 0.19) * 2); g.fillRect(x, 168 - h, 1, h + 12); }
    halo(g, 230, 170, 26, 0xa8401e, 0.6);
  });
  // risco del primer plano (a la izquierda) donde están parados
  v.layer(1, (g, W, H) => {
    for (let x = 0; x < W; x++) {
      const top = x < 130 ? GROUND : GROUND + Math.round((x - 130) ** 1.5 / 4);
      for (let y = top; y < H; y++) { g.fillStyle = y === top ? '#3a3640' : (x * 3 + y * 7) % 9 ? '#1e1c24' : '#262430'; g.fillRect(x, y, 1, 1); }
    }
  }, { width: 320, height: 180 });

  const c1 = v.actor(CAST.cofrade1, { x: 90, y: GROUND + 1 });
  const c2 = v.actor(CAST.cofrade2, { x: 62, y: GROUND + 1 });
  const c3 = v.actor(CAST.cofrade3, { x: 114, y: GROUND + 1 });
  v.live((g) => halo(g, Math.round(c1.x) + 7, GROUND - 10, 8, 0x9a6a30, 0.5), { front: false });

  v.cam.x = 160; v.cam.y = 90; v.cam.zoom = 1;
  // 0–3 s: las islas suben; la cámara baja al risco y se acerca
  v.tween(v.cam, { x: 130, y: 100, zoom: 2 }, { at: 2.6, dur: 1.2, ease: 'inOut' });
  // 4,5 s: uno señala las islas, otro levanta el farol
  v.at(4.5, () => c3.play('point', { loop: false, hold: 1 }));
  v.at(5.2, () => c1.play('hurt'));
  // 7 s: el del medio no se mueve; se da vuelta y se va solo, sin apuro
  v.at(7.0, () => { c2.flip = true; });
  v.at(7.6, () => c2.play('walk'));
  v.tween(c2, { x: -20 }, { at: 7.6, dur: 3.6, ease: 'linear' });
  v.at(8.6, () => c3.play('idle'));
  v.tween(v.cam, { x: 112 }, { at: 7.6, dur: 3.4, ease: 'inOut' });
}, { dur: 11.5, seed: 31 });
