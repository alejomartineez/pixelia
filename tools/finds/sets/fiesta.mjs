// Set «Fiesta» (id 'fiesta'). Familia: cosas de cumpleaños y de fin de año, enteras y de frente o tres cuartos, llenando
// el cuadro. Tonos dominantes: coral y oro; violeta y menta de acento, hueso para papel y cartón. Rayas y flecos de
// colores como motivo que se repite; la persona va de busto, como los Vecinos.
import { M } from '../lib.mjs';

const PIEL = 'EEe';

/** Elipse girada (a en grados, a favor del reloj). */
function tilted(cx, cy, rx, ry, a) {
  const m = M(), c = Math.cos(a * Math.PI / 180), s = Math.sin(a * Math.PI / 180);
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    const dx = x - cx, dy = y - cy, u = dx * c + dy * s, v = -dx * s + dy * c;
    if ((u / rx) ** 2 + (v / ry) ** 2 <= 1) m.set(x, y);
  }
  return m;
}

export default {
  id: 'fiesta', name: 'Fiesta', light: '#ffdada',
  laminas: [
    ['hz-globo', 'Globo Escapista', (g) => {
      // el hilo, que se va flameando hacia abajo a la izquierda
      g.curve([[15, 23], [12, 25], [14, 27], [10, 29], [6, 27], [3, 29]], 'q');
      g.poly([[14, 21], [18, 22], [15, 25]], 'coral');                       // el nudo
      g.fill(tilted(19, 11.5, 8.5, 10, 25), 'coral', { shade: 2, hi: [[14, 6], [15, 5], [14, 7]] });
    }],
    ['hz-cotillon', 'Cotillón Ruidoso', (g) => {
      const cono = M().poly([[4, 25], [6, 27], [26, 14], [17, 5]]);
      g.fill(cono, 'oro', { tag: 'cono', shade: 2 });
      for (const t of [0.32, 0.52, 0.72]) {
        const ax = 5 + (21.5 - 5) * t, ay = 26 + (9.5 - 26) * t;
        g.line(ax - 7, ay - 7, ax + 7, ay + 7, 'coral', { in: 'cono', w: 2 });
      }
      g.line(17, 5, 26, 14, 'violeta', { w: 2 });                            // el borde
      // los flecos de papel, separados
      [[17, 4], [20, 7], [23, 10], [26, 13]].forEach(([x, y], i) => g.line(x + 1, y - 1, x + 3, y - 3, i % 2 ? 'menta' : 'coral', { w: 2 }));
      g.line(5, 26, 2, 29, 'hueso', { w: 2, sep: true });                    // la boquilla
    }],
    ['hz-gaseosa', 'Gaseosa sin Gas', (g) => {
      const botella = M().rect(13, 4, 5, 7).ellipse(15.5, 14, 6, 5).rect(10, 14, 12, 16, 2);
      g.fill(botella, 'Ssd', { tag: 'vidrio', shade: 2 });
      g.fill(M().rect(10, 19, 12, 11, 2), 'brasa', { in: 'vidrio', shade: 2 });   // quieta: ni una burbuja
      g.rect(11, 22, 10, 5, 'hueso', { tag: 'etiqueta', sep: 'f' });
      g.rect(11, 24, 10, 1, 'r', { in: 'etiqueta' });
      g.line(13, 6, 13, 9, 'w'); g.line(11, 13, 11, 16, 'w');
      g.rect(12, 3, 7, 1, 'h');                                              // la boca, sin tapa
      // la chapa, tirada al lado
      g.rect(23, 27, 7, 3, 'coral', { sep: true });
      g.px('.', [23, 27], [25, 27], [27, 27], [29, 27]);
      g.px('x', [24, 29], [26, 29], [28, 29]);
    }],
    ['hz-regalo', 'Regalo Misterioso', (g) => {
      // la caja, en tres cuartos
      g.poly([[19, 16], [27, 11], [27, 25], [19, 30]], 'i', { flat: true });
      g.rect(4, 16, 15, 14, 'V', { flat: true, tag: 'frente' });
      g.rect(4, 16, 15, 14, 'Vij', { tag: 'frente2', in: 'frente', lite: 0 });
      g.rect(10, 16, 3, 14, 'oro', { in: 'frente2' });
      g.line(23, 14, 23, 27, 'y', { w: 2, on: true });
      // la boca de la caja, con la luz que sale de adentro
      g.poly([[4, 16], [12, 11], [27, 11], [19, 16]], 'Y', { flat: true });
      g.poly([[7, 15], [13, 12], [23, 12], [17, 15]], 'w', { flat: true });
      // la tapa, levantada y torcida
      g.poly([[2, 6], [10, 1], [26, 3], [19, 8]], 'V', { flat: true, tag: 'tapa' });
      g.poly([[2, 6], [19, 8], [19, 11], [2, 9]], 'i', { flat: true, tag: 'tapa' });
      g.poly([[19, 8], [26, 3], [26, 6], [19, 11]], 'j', { flat: true, tag: 'tapa' });
      g.poly([[9, 7], [12, 7], [12, 10], [9, 10]], 'y', { flat: true });
      g.line(11, 6, 18, 2, 'y', { w: 2, in: 'tapa' });
      g.px('Y', [1, 13], [2, 13], [29, 8], [30, 7]);
    }],
    ['hz-pizza', 'Pizza de Muzza', (g) => {
      g.ellipse(16, 18, 14.5, 10, 'piedra', { shade: 2 });                  // la pizzera
      const pizza = M().ellipse(16, 17, 13, 8.6).cut.poly([[16, 17], [29, 13], [29, 26]]);
      g.fill(pizza, 'brasa', { tag: 'masa' });
      g.fill(M().ellipse(16, 17, 11, 7).cut.poly([[16, 17], [30, 12.5], [30, 26.5]]), 'oro', { tag: 'queso', in: 'masa', lite: 0 });
      g.line(16, 17, 5, 17, 'o', { in: 'queso' }); g.line(16, 17, 16, 10, 'o', { in: 'queso' });
      g.line(16, 17, 10, 23, 'o', { in: 'queso' });
      for (const [x, y] of [[11, 14], [20, 13], [8, 20], [16, 21], [13, 18]]) { g.rect(x, y, 2, 2, 'l', { flat: true }); g.px('v', [x + 1, y + 1]); g.px('L', [x, y]); }
      g.px('Y', [10, 12], [18, 15], [12, 22], [7, 16]);
    }],
    ['hz-pinata', 'Piñata Llena', (g) => {
      const cx = 16, cy = 15;
      g.line(16, 1, 16, 5, 'madera');
      const cs = ['oro', 'menta', 'violeta', 'oro', 'menta', 'violeta', 'oro'];
      const tips = [];
      for (let i = 0; i < 7; i++) {
        const a = -Math.PI / 2 + (i + 0.5) * 2 * Math.PI / 7 + Math.PI / 7 * 0, c = Math.cos(a), sn = Math.sin(a);
        const x = cx + c * 13, y = cy + sn * 12.5;
        tips.push([x, y]);
        const bx = cx + c * 5, by = cy + sn * 5;
        g.poly([[bx + sn * 3.2, by - c * 3.2], [x, y], [bx - sn * 3.2, by + c * 3.2]], cs[i], { sep: true });
      }
      g.fill(M().ellipse(cx, cy, 6.5, 6.5), 'coral', { sep: true, shade: 2, tag: 'bola' });
      g.rect(8, 12, 17, 2, 'Y', { in: 'bola', flat: true }); g.rect(8, 17, 17, 2, 'M', { in: 'bola', flat: true });
      // flecos de papel colgando de las puntas de abajo
      for (const [x, y] of tips.filter(([, y]) => y > cy)) {
        const X = Math.round(x), Y = Math.round(y);
        g.line(X - 1, Y + 1, X - 1, Math.min(30, Y + 3), 'r', { behind: true });
        g.line(X + 1, Y + 1, X + 1, Math.min(30, Y + 3), 'y', { behind: true });
      }
    }],
    ['hz-papel-picado', 'Lluvia de Papel Picado', (g) => {
      const cs = ['coral', 'oro', 'menta', 'violeta', 'cielo'];
      const ps = [
        [2, 8, 2, 3], [11, 2, 2, 3], [18, 4, 3, 2], [25, 2, 2, 3],
        [28, 3, 2, 2], [14, 8, 3, 2], [21, 9, 2, 3], [27, 8, 3, 2],
        [3, 14, 3, 2], [10, 13, 2, 3], [17, 14, 3, 2], [24, 14, 2, 3],
        [6, 19, 2, 3], [13, 19, 3, 2], [20, 20, 3, 2], [27, 19, 2, 3],
        [3, 25, 3, 2], [9, 25, 2, 3], [16, 25, 2, 3], [23, 25, 3, 2],
      ];
      ps.forEach(([x, y, w, h], i) => g.rect(x, y, w, h, cs[(i * 3) % cs.length], { flat: true }));
      g.px('Y', [18, 4], [3, 14], [17, 14]);
      // serpentinas que caen enruladas
      g.curve([[6, 2], [9, 4], [6, 7], [9, 10], [7, 12]], 'coral', { w: 2 });
      g.curve([[22, 13], [25, 16], [21, 18], [24, 21], [21, 24], [23, 28]], 'oro', { w: 2 });
      g.curve([[13, 22], [11, 25], [14, 27], [12, 29]], 'violeta', { w: 2 });
    }],
    ['hz-fuegos', 'Fuegos Artificiales', (g) => {
      // dos estallidos: rayos gruesos que se abren desde el centro y una chispa en cada punta
      const burst = (cx, cy, r0, r1, rt, n, ray, tip, off = 0) => {
        for (let i = 0; i < n; i++) {
          const a = (i + off) * 2 * Math.PI / n, c = Math.cos(a), s = Math.sin(a);
          g.line(cx + c * r0, cy + s * r0, cx + c * r1, cy + s * r1, ray, { w: 2 });
          g.ellipse(cx + c * rt, cy + s * rt, 1.1, 1.1, tip, { flat: true });
        }
      };
      burst(7.5, 23.5, 2, 4.2, 6, 6, 'menta', 'M', 0.5);
      burst(18.5, 12, 3.5, 8.5, 11, 12, 'oro', 'r');
      g.px('M', [7, 23], [8, 23], [7, 24], [8, 24]);
    }],
    ['hz-alma-fiesta', 'El Alma de la Fiesta', (g) => {
      const cx = 14, cy = 16;
      // el brazo en alto, con la copa
      g.line(23, 29, 26, 15, 'violeta', { w: 3 });
      g.ellipse(26.5, 13, 2, 2, PIEL);
      g.fill(M().rect(24, 3, 6, 4).ellipse(27, 6.5, 3, 2.5).line(27, 8, 27, 11, 1).rect(25, 11, 5, 1), 'Ssd', { tag: 'copa', sep: true });
      g.rect(25, 4, 4, 3, 'y', { in: 'copa', flat: true }); g.px('Y', [25, 4], [26, 4]);
      g.fill(M().ellipse(cx, 31, 11, 8.5).cut.rect(0, 31, 32, 1).rect(0, 0, 1, 32), 'violeta', { tag: 'shirt', sep: true });
      g.rect(cx - 1, cy + 7, 3, 3, PIEL[2], { flat: true });
      g.rect(cx - 6, cy - 7, 13, 15, PIEL, { r: 4, tag: 'head' });
      g.fill(M().rect(cx - 6, cy - 7, 13, 5, 3).rect(cx - 6, cy - 4, 2, 4).rect(cx + 5, cy - 4, 2, 4), 'z');   // pelo
      g.px('k', [cx - 3, cy + 1], [cx - 3, cy + 2], [cx + 3, cy + 1], [cx + 3, cy + 2]);
      g.px('R', [cx - 4, cy + 4], [cx + 4, cy + 4]);
      g.art(cx - 1, cy + 4, ['KKK', ' x ']);                                // la risa
      // el gorrito, torcido
      g.poly([[cx - 5, cy - 7], [cx + 3, cy - 8], [cx - 4, cy - 15]], 'oro', { tag: 'gorro', sep: true });
      g.line(cx - 4, cy - 9, cx + 1, cy - 9, 'r', { in: 'gorro' }); g.line(cx - 4, cy - 12, cx - 2, cy - 12, 'r', { in: 'gorro' });
      g.ellipse(cx - 4, cy - 14, 1.6, 1.6, 'menta');
      // la serpentina sobre los hombros
      g.curve([[4, 26], [8, 28], [11, 25], [15, 28], [19, 25], [22, 28]], 'oro', { w: 2, in: 'shirt' });
    }],
  ],
};
