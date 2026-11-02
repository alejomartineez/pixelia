// Paseo Real — cielo pixelado 2D detrás del 3D: degradé en franjas, sol, nubes y siluetas lejanas por bioma.
import { BIOMES } from './driving-world.js';

const hexRgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const css = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

const RGB = BIOMES.map(b => ({ top: hexRgb(b.skyTop), bot: hexRgb(b.skyBot), sun: hexRgb(b.sun) }));

export class Sky {
  constructor(container) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'drv-sky';
    container.append(this.canvas);
    this.g = this.canvas.getContext('2d');
    this.W = 2; this.H = 2;
    this.clouds = Array.from({ length: 7 }, (_, i) => ({ x: Math.random(), y: 0.08 + (i % 4) * 0.075 + Math.random() * 0.04, s: 0.7 + Math.random() * 0.7, v: 0.004 + Math.random() * 0.006 }));
  }
  resize(w, h, px) {
    const W = Math.max(2, Math.ceil(w / px)), H = Math.max(2, Math.ceil(h / px));
    if (W === this.W && H === this.H) return;
    this.W = this.canvas.width = W; this.H = this.canvas.height = H;
  }
  /**
   * a, b: índices de bioma; t: mezcla 0..1 hacia b; hy: altura del horizonte (0..1 de la pantalla);
   * shift: corrimiento horizontal (px de pantalla reales / px) por la curva; time: segundos.
   */
  draw(a, b, t, hy, shift, time, dt) {
    const { g, W, H } = this;
    const hyPx = Math.round(Math.min(0.95, Math.max(0.12, hy)) * H);
    const top = mix(RGB[a].top, RGB[b].top, t), bot = mix(RGB[a].bot, RGB[b].bot, t);
    // franjas del degradé con una fila tramada entre franja y franja
    const bands = 9;
    const bandH = hyPx / bands;
    for (let i = 0; i < bands; i++) {
      const y0 = Math.floor(i * bandH), y1 = Math.floor((i + 1) * bandH);
      const k = Math.pow(i / (bands - 1), 1.3);
      g.fillStyle = css(mix(top, bot, k));
      g.fillRect(0, y0, W, y1 - y0 + 1);
      if (i < bands - 1) {
        g.fillStyle = css(mix(top, bot, Math.pow((i + 1) / (bands - 1), 1.3)));
        for (let x = (i % 2); x < W; x += 2) g.fillRect(x, y1 - 1, 1, 1);
      }
    }
    g.fillStyle = css(bot);
    g.fillRect(0, hyPx, W, H - hyPx);

    // sol
    const sun = mix(RGB[a].sun, RGB[b].sun, t);
    const beachA = BIOMES[a].id === 'playa' ? 1 - t : 0, beachB = BIOMES[b].id === 'playa' ? t : 0;
    const beach = beachA + beachB;
    const sx = Math.round(W * 0.74 + shift * 0.15), sr = Math.max(4, Math.round(Math.min(W, H) * 0.06));
    const sy = Math.round(hyPx * (0.3 + beach * 0.55));
    g.fillStyle = css(sun, 0.35); this.disc(sx, sy, sr + 3);
    g.fillStyle = css(beach > 0.5 ? [255, 190, 140] : sun); this.disc(sx, sy, sr);
    if (beach > 0.5) { g.fillStyle = css(mix(top, bot, 0.7)); for (let i = 1; i < 4; i++) g.fillRect(sx - sr, sy + i * 2 + 1, sr * 2 + 1, 1); }

    // nubes
    for (const c of this.clouds) {
      c.x += c.v * dt * 0.3;
      if (c.x > 1.2) c.x = -0.2;
      const cx = Math.round(((c.x * (W + 60)) - 30 + shift * 0.3) % (W + 60));
      this.cloud(cx, Math.round(c.y * hyPx * 1.6), c.s);
    }

    // siluetas lejanas (bioma actual y el que viene, mezclados)
    this.backdrop(a, hyPx, shift, 1 - t);
    if (t > 0.01 && b !== a) this.backdrop(b, hyPx, shift, t);
  }
  disc(cx, cy, r) {
    for (let y = -r; y <= r; y++) { const w = Math.floor(Math.sqrt(r * r - y * y)); this.g.fillRect(cx - w, cy + y, w * 2 + 1, 1); }
  }
  cloud(x, y, s) {
    const g = this.g;
    const w = Math.round(22 * s), h = Math.round(6 * s);
    g.fillStyle = 'rgba(255,255,255,.95)';
    g.fillRect(x, y, w, h);
    g.fillRect(x + Math.round(4 * s), y - Math.round(3 * s), Math.round(9 * s), Math.round(3 * s));
    g.fillRect(x + Math.round(11 * s), y - Math.round(5 * s), Math.round(7 * s), Math.round(5 * s));
    g.fillStyle = 'rgba(232,222,255,.9)';
    g.fillRect(x + 1, y + h - 1, w - 2, 1);
  }
  hills(hy, off, amp, base, f1, f2, color, alpha) {
    const g = this.g;
    g.fillStyle = css(color, alpha);
    for (let x = 0; x < this.W; x++) {
      const X = x + off;
      const hh = Math.round(base + amp * (Math.sin(X * f1) * 0.6 + Math.sin(X * f2 + 1.7) * 0.4));
      if (hh > 0) g.fillRect(x, hy - hh, 1, hh + 1);
    }
  }
  castle(x, hy, s, wall, roof, alpha) {
    const g = this.g;
    const u = Math.max(1, Math.round(s));
    const body = [[x, hy - 8 * u, 14 * u, 8 * u], [x - 2 * u, hy - 12 * u, 4 * u, 12 * u], [x + 12 * u, hy - 12 * u, 4 * u, 12 * u], [x + 5 * u, hy - 15 * u, 4 * u, 15 * u]];
    g.fillStyle = css([170, 150, 215], alpha);
    for (const [bx, by, bw, bh] of body) g.fillRect(bx - 1, by - 1, bw + 2, bh + 1);
    g.fillStyle = css(wall, alpha);
    for (const [bx, by, bw, bh] of body) g.fillRect(bx, by, bw, bh);
    g.fillStyle = css([215, 200, 245], alpha);
    for (const [bx, by, bw, bh] of body) g.fillRect(bx + bw - u, by, u, bh);
    g.fillStyle = css(roof, alpha);
    for (const [tx, ty, tw] of [[x - 2 * u, hy - 12 * u, 4 * u], [x + 12 * u, hy - 12 * u, 4 * u], [x + 5 * u, hy - 15 * u, 4 * u]]) {
      for (let i = 0; i < tw / 2 + 1; i++) g.fillRect(tx + i, ty - (tw / 2 + 1) + i, Math.max(1, tw - i * 2), 1);
      g.fillRect(tx + tw / 2 - 0.5, ty - tw - 2 * u, 1, 2 * u);
    }
    g.fillStyle = css([255, 255, 255], alpha * 0.8);
    g.fillRect(x + 6 * u, hy - 5 * u, 2 * u, 3 * u);
  }
  backdrop(bi, hy, shift, alpha) {
    if (alpha <= 0.01) return;
    const id = BIOMES[bi].id, W = this.W;
    const off = -shift * 0.5;
    if (id === 'ciudad') {
      this.hills(hy, off * 0.6, 5, 9, 0.035, 0.09, [214, 198, 242], alpha);
      const span = W + 120;
      for (let i = 0; i < 3; i++) {
        const x = Math.round((((i * 0.37 + 0.1) * span + off * 0.8) % span + span) % span) - 60;
        this.castle(x, hy - 2, i === 1 ? 1.4 : 1, [240, 230, 255], i % 2 ? [181, 140, 255] : [255, 126, 182], alpha);
      }
      this.hills(hy, off, 2, 4, 0.06, 0.15, [190, 228, 170], alpha);
    } else if (id === 'flores') {
      // arcoíris en el cielo
      const g = this.g, cx = Math.round(W * 0.3 + off * 0.3), r0 = Math.round(Math.min(W, hy * 2) * 0.32);
      const cols = [[255, 111, 143], [255, 179, 71], [255, 209, 102], [111, 227, 193], [143, 211, 255], [181, 140, 255]];
      cols.forEach((c, i) => {
        g.fillStyle = css(c, alpha * 0.55);
        const r = r0 - i * 2;
        for (let y = 0; y <= r; y++) { const w = Math.floor(Math.sqrt(r * r - y * y)), wi = Math.floor(Math.sqrt(Math.max(0, (r - 2) * (r - 2) - y * y))); g.fillRect(cx - w, hy - y, w - wi, 1); g.fillRect(cx + wi, hy - y, w - wi + 1, 1); }
      });
      this.hills(hy, off * 0.5, 6, 9, 0.03, 0.07, [170, 225, 150], alpha);
      this.hills(hy, off, 3, 4, 0.05, 0.13, [140, 214, 120], alpha);
    } else if (id === 'playa') {
      const g = this.g;
      g.fillStyle = css([120, 205, 245], alpha);
      g.fillRect(0, hy - 2, W, 3);
      g.fillStyle = css([255, 255, 255], alpha * 0.7);
      for (let x = 0; x < W; x += 7) g.fillRect((x + Math.round(off)) % W, hy - 1, 3, 1);
      // islita con palmera
      const ix = Math.round(((W * 0.18 + off * 0.7) % (W + 40) + W + 40) % (W + 40)) - 20;
      g.fillStyle = css([247, 215, 154], alpha); g.fillRect(ix, hy - 3, 18, 2); g.fillRect(ix + 3, hy - 4, 12, 1);
      g.fillStyle = css([176, 122, 82], alpha); g.fillRect(ix + 8, hy - 11, 1, 7);
      g.fillStyle = css([95, 196, 106], alpha); g.fillRect(ix + 4, hy - 12, 9, 1); g.fillRect(ix + 6, hy - 13, 5, 1); g.fillRect(ix + 3, hy - 11, 2, 1); g.fillRect(ix + 12, hy - 11, 2, 1);
    } else if (id === 'cerezos') {
      const g = this.g;
      const mx = Math.round(W * 0.6 + off * 0.4), mh = Math.round(Math.min(hy * 0.55, 40));
      for (let y = 0; y < mh; y++) {
        const w = Math.round((mh - y) * 1.5);
        g.fillStyle = css(y > mh * 0.72 ? [255, 255, 255] : [200, 186, 240], alpha);
        g.fillRect(mx - w, hy - y, w * 2, 1);
      }
      this.hills(hy, off * 0.7, 3, 5, 0.05, 0.11, [255, 194, 220], alpha);
      this.hills(hy, off, 2, 3, 0.09, 0.21, [255, 170, 205], alpha);
    }
  }
  dispose() { this.canvas.remove(); }
}
