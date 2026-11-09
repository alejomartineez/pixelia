// Set «Tesoros» (id 'joyas'). Familia: joyas y cosas guardadas, enteras y de frente o apenas de costado.
// Tonos: oro dominante (metal) con cielo (piedras, vidrio) y coral o índigo de acento en telas y cuentas.
// Tratamiento: metal con sombra ancha y un brillo arriba a la izquierda; las piedras, facetadas en tres tonos.
import { M } from '../lib.mjs';

/** Cristal: prisma de ancho 2·hw de (x0, y0) (la base) a (x1, y1), con punta. */
function prism(x0, y0, x1, y1, hw) {
  const L = Math.hypot(x1 - x0, y1 - y0), ux = (x1 - x0) / L, uy = (y1 - y0) / L, px = -uy * hw, py = ux * hw;
  const t = hw * 1.4;
  return [[x0 + px, y0 + py], [x1 + px, y1 + py], [x1 + ux * t, y1 + uy * t], [x1 - px, y1 - py], [x0 - px, y0 - py]];
}
const rot = (pts, cx, cy, a) => pts.map(([x, y]) => [cx + (x - cx) * Math.cos(a) - (y - cy) * Math.sin(a), cy + (x - cx) * Math.sin(a) + (y - cy) * Math.cos(a)]);

export default {
  id: 'joyas', name: 'Tesoros', light: '#d2f4f7',
  laminas: [
    ['hz-collar', 'Collar de Cuentas', (g) => {
      const cx = 16, cy = 12, rx = 12, ry = 11;
      g.ring(cx, cy, rx + 0.5, ry + 0.5, 1, 'g', { flat: true });                  // el hilo
      for (let i = 0; i < 9; i++) {
        const a = (-14 + i * 26) * Math.PI / 180;
        if (i === 4) continue;
        const bx = Math.round(cx + rx * Math.cos(a)), by = Math.round(cy + ry * Math.sin(a));
        g.fill(M().rect(bx - 2, by - 2, 5, 5, 1), i % 2 ? 'coral' : 'oro', { sep: true, hi: [[bx - 1, by - 1]] });
      }
      g.rect(15, 22, 3, 2, 'oro');                                                // el engarce
      g.poly([[16, 24], [20, 27], [16, 30], [12, 27]], 'cielo', { sep: true, hi: [[15, 26]] });
    }],
    ['hz-ojo', 'Ojo Protector', (g) => {
      const mano = M().rect(10, 12, 12, 14, 3)
        .rect(10, 6, 3, 9, 1).rect(14, 3, 4, 12, 1).rect(19, 6, 3, 9, 1)
        .poly([[10, 15], [6, 11], [5, 13], [6, 19], [10, 23]])
        .poly([[22, 15], [26, 11], [27, 13], [26, 19], [22, 23]]);
      g.fill(mano, 'oro', { tag: 'mano', shade: 2 });
      g.rect(13, 6, 1, 7, 'o', { in: 'mano' }); g.rect(18, 6, 1, 7, 'o', { in: 'mano' });
      g.rect(11, 26, 10, 3, 'cielo', { sep: true });
      g.fill(M().ellipse(16, 19, 5.5, 3.4), 'hueso', { sep: true, tag: 'ojo' });
      g.ellipse(16, 19, 2.6, 2.6, 'Ssd', { in: 'ojo' });
      g.rect(15, 18, 2, 2, 'a', { flat: true });
    }],
    ['hz-reloj', 'Reloj de la Abuela', (g) => {
      g.curve([[17, 4], [23, 2], [28, 6], [28, 12], [25, 16]], 'y');               // la cadena
      g.px('Y', [21, 3], [25, 3], [27, 7], [28, 11], [26, 15]);
      g.ring(15, 4, 2.6, 2.2, 1, 'oro');
      g.rect(13, 6, 5, 3, 'oro', { r: 1 });
      g.ellipse(15.5, 18.5, 11, 11, 'oro', { shade: 2, sep: true, hi: [[9, 12], [10, 11]] });
      g.ellipse(15.5, 18.5, 8, 8, 'hueso', { tag: 'cara', sep: 'o' });
      g.px('q', [15, 11], [16, 11], [15, 26], [16, 26], [8, 18], [8, 19], [23, 18], [23, 19]);
      g.line(15, 18, 15, 13, 'k'); g.line(15, 18, 19, 20, 'k');
      g.px('r', [15, 18]);
    }],
    ['hz-anillo', 'Anillo de Compromiso', (g) => {
      g.fill(M().rect(5, 8, 22, 10).ellipse(15.5, 9, 10.6, 6).cut.rect(0, 18, 32, 14), 'indigo', { tag: 'tapa' });  // la tapa abierta
      g.fill(M().rect(8, 10, 16, 8).ellipse(15.5, 10, 7.6, 4.4).cut.rect(0, 18, 32, 14), 'hueso', { flat: true, in: 'tapa' });
      g.ring(16, 17, 5.5, 6, 1.6, 'oro', { sep: true, hi: [[11, 15]] });         // el anillo
      g.poly([[13, 7], [19, 7], [20, 8], [16, 12], [12, 8]], 'cielo', { sep: true, hi: [[14, 8]] });
      g.rect(4, 20, 24, 9, 'indigo', { r: 2, sep: true, shade: 2 });              // la caja
      g.rect(7, 20, 18, 2, 'a', { flat: true });
    }],
    ['hz-campana', 'Campana de Bronce', (g) => {
      g.rect(14, 2, 4, 6, 'madera', { r: 1 });
      g.rect(12, 7, 8, 2, 'oro');
      const bell = M().ellipse(16, 15, 7, 6).rect(9, 15, 14, 6).poly([[9, 19], [23, 19], [27, 25], [5, 25]]).ellipse(16, 25, 11, 2.5);
      g.ellipse(16, 27.5, 2, 2, 'piedra');
      g.fill(bell, 'oro', { tag: 'bell', shade: 2, sep: true, hi: [[12, 12], [11, 13]] });
      g.rect(6, 21, 20, 1, 'o', { in: 'bell' });
    }],
    ['hz-bola-cristal', 'Bola de Cristal Chusma', (g) => {
      g.ellipse(15.5, 12.5, 10, 10, 'cielo', { tag: 'bola', shade: 2 });
      g.curve([[10, 15], [14, 11], [18, 15], [22, 10]], 'V', { in: 'bola', w: 2 });
      g.curve([[11, 18], [16, 17], [20, 19]], 'i', { in: 'bola' });
      g.line(10, 9, 13, 6, 'w', { in: 'bola', w: 2 });
      g.poly([[8, 20], [24, 20], [21, 24], [11, 24]], 'oro', { sep: true });
      g.rect(6, 24, 20, 5, 'madera', { r: 1, sep: true });
    }],
    ['hz-cristal', 'Cristal Celeste', (g) => {
      g.poly(prism(10, 25, 5, 12, 2), 'cielo', { sep: 'd' });
      g.poly(prism(22, 25, 27, 12, 2), 'cielo', { sep: 'd' });
      g.poly(prism(16, 25, 16, 6, 3), 'cielo', { sep: 'd', hi: [[14, 8]] });
      g.poly(prism(9, 27, 4, 20, 1.5), 'cielo', { sep: 'd' });
      g.poly(prism(23, 27, 28, 20, 1.5), 'cielo', { sep: 'd' });
      g.fill(M().ellipse(16, 26.6, 13, 3).ellipse(9, 26, 5, 3.4).ellipse(23, 26.5, 5, 3), 'piedra', { sep: true });
      g.px('h', [13, 28], [20, 27]);
    }],
    ['hz-copa', 'Copa de Oro', (g) => {
      g.fill(M().ellipse(16, 6, 10, 11).cut.rect(0, 0, 32, 6), 'oro', { tag: 'copa', shade: 2, hi: [[8, 8], [8, 9]] });
      g.ellipse(16, 6, 9.6, 1.8, 'o', { flat: true });
      g.rect(7, 10, 18, 2, 'y', { in: 'copa' });
      g.px('r', [11, 10], [11, 11], [20, 10], [20, 11]); g.px('s', [15, 10], [16, 10], [15, 11], [16, 11]);
      g.rect(14, 17, 4, 8, 'oro', { sep: true });
      g.ellipse(16, 20, 3, 1.5, 'oro');
      g.fill(M().ellipse(16, 26.6, 9, 2.8).rect(12, 24, 8, 3), 'oro', { shade: 2, sep: true });
    }],
    ['hz-diamante', 'Diamante Legendario', (g) => {
      g.fill(M().rect(3, 20, 26, 10, 3), 'coral', { tag: 'cojin', shade: 2 });
      g.px('y', [3, 20], [28, 20], [3, 29], [28, 29]);
      const a = -0.25, c = [16, 13];
      const top = rot([[10, 4], [22, 4], [27, 9], [5, 9]], ...c, a);
      const bot = rot([[5, 9], [27, 9], [16, 23]], ...c, a);
      g.fill(M().poly(top).poly(bot), 'cielo', { tag: 'dia', sep: true });
      g.poly(top, 'S', { flat: true, in: 'dia' });
      const [p0, p1] = rot([[13, 4], [19, 4]], ...c, a);
      const [q0, q1, q2] = rot([[10, 9], [16, 9], [22, 9]], ...c, a), tip = rot([[16, 23]], ...c, a)[0];
      g.line(...p0, ...q0, 's', { in: 'dia' }); g.line(...p1, ...q2, 's', { in: 'dia' });
      g.line(...q0, ...tip, 's', { in: 'dia' }); g.line(...q2, ...tip, 'd', { in: 'dia' }); g.line(...q1, ...tip, 'S', { in: 'dia' });
      g.px('w', [10, 7], [11, 7], [24, 3]);
    }],
  ],
};
