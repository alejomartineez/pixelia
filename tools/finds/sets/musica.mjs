// Set «Música» (id 'musica'). Familia: instrumentos y aparatos enteros, apoyados o en diagonal, cada uno con su silueta.
// Tonos: madera y brasa dominantes (cajas, cuerpos), oro para los metales y hueso para teclas, parches y botones.
// Tratamiento: piezas grandes en tono base con sombra ancha, detalles finos en tinta o madera oscura.
import { M } from '../lib.mjs';

/** Máscara de una forma dada en coordenadas propias (u a lo ancho, v a lo largo), girada y llevada al cuadro. */
function turned(test, { cx = 16, cy = 16, v0 = 0, a = 0 } = {}) {
  const c = Math.cos(a), s = Math.sin(a), m = M();
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    const dx = x - cx, dy = y - cy;
    const u = dx * c + dy * s, v = v0 - dx * s + dy * c;
    if (test(u, v)) m.set(x, y);
  }
  return m;
}
const inE = (u, v, cu, cv, ru, rv) => ((u - cu) / ru) ** 2 + ((v - cv) / rv) ** 2 <= 1;

export default {
  id: 'musica', name: 'Música', light: '#f8f0e4',
  laminas: [
    ['hz-tambor', 'Tambor Ruidoso', (g) => {
      g.fill(M().rect(5, 13, 22, 13).ellipse(16, 25.5, 11, 3.5), 'coral', { tag: 'caja', shade: 2 });
      g.fill(M().rect(5, 13, 22, 3), 'oro', { in: 'caja' });
      g.fill(M().ellipse(16, 25.5, 11, 3.5).cut.rect(0, 0, 32, 25), 'oro', { in: 'caja' });
      const zz = [[6, 16], [9, 24], [12, 16], [15, 25], [18, 16], [21, 25], [24, 16], [26, 23]];
      for (let i = 0; i + 1 < zz.length; i++) g.line(...zz[i], ...zz[i + 1], 'P', { in: 'caja' });
      g.ellipse(16, 12.5, 11, 3.5, 'hueso', { sep: 'o' });
      g.line(5, 3, 18, 10, 'madera', { w: 2 }); g.line(27, 3, 14, 10, 'madera', { w: 2 });
      g.px('O', [5, 2], [27, 2]);
    }],
    ['hz-radio', 'Radio de la Tía', (g) => {
      g.fill(M().rect(5, 12, 22, 16, 1).ellipse(15.5, 12, 10.6, 10).cut.rect(0, 28, 32, 4), 'madera', { tag: 'caja', shade: 2 });
      g.fill(M().rect(9, 11, 14, 8).ellipse(15.5, 11, 6.6, 6.6).cut.rect(0, 19, 32, 13), 'O', { tag: 'tela', sep: 'z' });
      for (const x of [11, 14, 17, 20]) g.rect(x, 4, 1, 15, 'u', { in: 'tela' });
      g.rect(10, 21, 12, 3, 'Y', { flat: true, sep: 'z' }); g.rect(15, 21, 1, 3, 'r');
      g.ellipse(9.5, 25, 1.6, 1.6, 'oro'); g.ellipse(21.5, 25, 1.6, 1.6, 'oro');
      g.rect(7, 28, 3, 2, 'z'); g.rect(22, 28, 3, 2, 'z');
    }],
    ['hz-auriculares', 'Auriculares Enredados', (g) => {
      g.curve([[6, 20], [8, 26], [14, 27], [12, 22], [9, 25], [13, 29], [19, 27], [17, 23], [15, 27], [21, 29], [26, 25], [26, 21]], 'z');
      g.fill(M().ring(15.5, 15, 12, 12, 2.5).cut.rect(0, 15, 32, 17), 'piedra', { shade: 1 });
      g.fill(M().rect(3, 11, 7, 11, 3), 'brasa', { shade: 2, sep: true });
      g.fill(M().rect(22, 11, 7, 11, 3), 'brasa', { shade: 2, sep: true });
      g.rect(8, 13, 2, 7, 'P'); g.rect(22, 13, 2, 7, 'P');
    }],
    ['hz-guitarra', 'Guitarra Fogonera', (g) => {
      const o = { cx: 15.5, cy: 16.5, v0: 19.5, a: Math.PI / 4 };
      const body = (u, v) => inE(u, v, 0, 22, 6, 5) || inE(u, v, 0, 30, 7.5, 6.5) || (Math.abs(u) <= 5 && v >= 22 && v <= 30);
      g.fill(turned((u, v) => v >= 0.5 && v <= 5.5 && Math.abs(u) <= 2.4, o), 'madera', { tag: 'mastil' });
      g.fill(turned((u, v) => v > 5 && v <= 19 && Math.abs(u) <= 1.6, o), 'u', { flat: true, sep: true });
      g.fill(turned(body, o), 'oro', { tag: 'cuerpo', shade: 2, sep: true });
      g.fill(turned((u, v) => inE(u, v, 0, 23, 2.6, 2.6), o), 'K', { flat: true, in: 'cuerpo' });
      g.fill(turned((u, v) => Math.abs(u) <= 3 && v >= 30 && v <= 31.2, o), 'z', { flat: true, in: 'cuerpo' });
      g.fill(turned((u, v) => Math.abs(u) <= 0.5 && v >= 0 && v <= 30, o), 'P', { flat: true, on: true });
    }],
    ['hz-piano', 'Piano Paciente', (g) => {
      g.rect(5, 6, 22, 12, 'madera', { shade: 2 });
      g.rect(8, 8, 16, 7, 'u', { flat: true });
      g.rect(12, 9, 8, 5, 'hueso', { flat: true, sep: 'z' });
      g.rect(13, 10, 6, 1, 'q'); g.rect(13, 12, 6, 1, 'q');
      g.rect(3, 4, 26, 2, 'madera');
      g.rect(2, 18, 28, 4, 'hueso', { tag: 'teclas', shade: 0 });
      for (let x = 3; x < 29; x += 2) g.rect(x, 18, 1, 4, 'q', { in: 'teclas' });
      for (const x of [4, 6, 10, 12, 14, 18, 20, 24, 26]) g.rect(x, 18, 1, 2, 'K');
      g.rect(2, 22, 28, 2, 'madera', { sep: true });
      g.rect(5, 24, 22, 5, 'madera');
      g.rect(3, 24, 3, 6, 'madera', { sep: true }); g.rect(26, 24, 3, 6, 'madera', { sep: true });
      g.px('y', [14, 28], [17, 28]);
    }],
    ['hz-violin', 'Violín Dramático', (g) => {
      const o = { cx: 12, cy: 16, v0: 16, a: 0 };
      // el arco, parado al lado: vara, cerdas y talón
      g.line(23, 28, 28, 3, 'madera', { w: 2 }); g.line(21, 25, 25, 5, 'P');
      g.rect(26, 2, 3, 2, 'z'); g.rect(21, 25, 4, 4, 'z', { sep: true }); g.px('y', [22, 27]);
      const body = (u, v) => (inE(u, v, 0, 15.5, 5.8, 5.2) || inE(u, v, 0, 25, 7, 5.6) || (Math.abs(u) <= 4.6 && v >= 15.5 && v <= 25))
        && !inE(u, v, -7.4, 20.3, 2.4, 2.3) && !inE(u, v, 7.4, 20.3, 2.4, 2.3);
      g.fill(turned((u, v) => inE(u, v, 0, 3, 2.4, 2.4) || (Math.abs(u) <= 1.1 && v > 3 && v <= 11) || (Math.abs(u) <= 2.6 && v >= 6.5 && v < 7.5) || (Math.abs(u) <= 2.6 && v >= 8.5 && v < 9.5), o), 'madera');
      g.px('z', [12, 3], [11, 3]);
      g.fill(turned(body, o), 'brasa', { tag: 'cuerpo', shade: 2, sep: true });
      g.fill(turned((u, v) => Math.abs(u) <= 1 && v >= 9 && v <= 20, o), 'z', { flat: true, sep: true });
      g.fill(turned((u, v) => (Math.abs(u + 3.5) <= 0.5 || Math.abs(u - 3.5) <= 0.5) && v >= 19 && v <= 23, o), 'f', { flat: true, in: 'cuerpo' });
      g.fill(turned((u, v) => Math.abs(u) <= 2.5 && v >= 23 && v < 24, o), 'Y', { flat: true, in: 'cuerpo' });
      g.fill(turned((u, v) => Math.abs(u) <= 1.6 - (v - 25) * 0.2 && v >= 25 && v <= 29, o), 'z', { flat: true, in: 'cuerpo' });
    }],
    ['hz-trompeta', 'Trompeta Mañanera', (g) => {
      g.fill(M().rect(7, 13, 16, 9, 3).cut.rect(9, 15, 12, 5, 1), 'oro', { tag: 'tubo' });
      g.fill(M().rect(3, 9, 20, 2).poly([[21, 10], [29, 4], [30, 4], [30, 16], [29, 16], [21, 11]]), 'oro', { shade: 2, sep: true, hi: [[24, 8]] });
      g.ellipse(29.5, 10, 0.8, 5.6, 'o', { flat: true });
      g.rect(1, 9, 2, 2, 'piedra');
      for (const x of [11, 14, 17]) { g.rect(x, 6, 2, 9, 'oro', { sep: true }); g.rect(x, 4, 2, 2, 'hueso', { sep: true }); }
    }],
    ['hz-bandoneon', 'Bandoneón Tanguero', (g) => {
      const fuelle = M().poly([[8, 9], [24, 9], [27, 26], [5, 26]]);
      g.fill(fuelle, 'piedra', { tag: 'fuelle', shade: 0, lite: 0 });
      for (let i = 0; i < 6; i++) { const t = 9 + i * 3.4; g.line(8 - (t - 9) * 0.18, t, 24 + (t - 9) * 0.18, t, 'P', { in: 'fuelle' }); g.line(8 - (t + 1.6 - 9) * 0.18, t + 1.6, 24 + (t + 1.6 - 9) * 0.18, t + 1.6, 'h', { in: 'fuelle' }); }
      g.poly([[2, 4], [9, 6], [7, 29], [1, 26]], 'madera', { sep: true, shade: 2 });
      g.poly([[23, 6], [30, 4], [30, 26], [25, 29]], 'madera', { sep: true, shade: 2 });
      for (const [x, y] of [[4, 9], [6, 12], [4, 15], [6, 18], [4, 21], [26, 9], [28, 12], [26, 15], [28, 18], [26, 21]]) g.px('P', [x, y]);
    }],
    ['hz-microfono', 'Micrófono de Estrella', (g) => {
      g.ellipse(16, 28, 9, 2.4, 'piedra', { shade: 2 });
      g.rect(15, 20, 2, 8, 'piedra');
      g.ring(16, 12, 9, 9, 2, 'oro');
      g.fill(M().rect(10, 2, 12, 19, 5), 'Ggh', { tag: 'capsula', shade: 2, sep: true });
      for (let y = 5; y < 19; y += 2) g.rect(11, y, 10, 1, 'h', { in: 'capsula' });
      g.rect(10, 11, 12, 2, 'oro', { in: 'capsula' });
      g.px('w', [12, 4], [13, 3]);
    }],
  ],
};
