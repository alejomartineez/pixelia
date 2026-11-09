// Set «Noche Estrellada» (id 'noche'). Familia: cosas del cielo y de la noche, cada una sola y entera, sin fondo de
// cielo pintado (el claro azulado de la carta hace de noche). Tonos: índigo y oro dominantes (frío del cielo, luz
// cálida), violeta de acento; hueso con sombra adentro para la luna llena.
import { M } from '../lib.mjs';

/** Estrella de cinco puntas: centro, radio de afuera, de adentro y giro (radianes). */
const estrella = (cx, cy, R, r, rot = 0) => Array.from({ length: 10 }, (_, i) => {
  const a = rot - Math.PI / 2 + i * Math.PI / 5, k = i % 2 ? r : R;
  return [cx + Math.cos(a) * k, cy + Math.sin(a) * k];
});

export default {
  id: 'noche', name: 'Noche Estrellada', light: '#dfe7f8',
  laminas: [
    ['hz-buho', 'Búho Desvelado', (g) => {
      g.rect(2, 26, 28, 3, 'uzz', { r: 1 });                                      // la rama
      const cuerpo = M().ellipse(16, 17, 9.5, 10.5).poly([[7, 9], [8, 3], [12, 8]]).poly([[25, 9], [24, 3], [20, 8]]);
      g.fill(cuerpo, 'madera', { tag: 'buho', shade: 2, sep: true });
      g.fill(M().ellipse(16, 21, 5.5, 6), 'hueso', { in: 'buho', tag: 'panza' });
      g.px('q', [14, 19], [18, 19], [16, 21], [14, 23], [18, 23], [16, 25]);
      g.curve([[8, 14], [8, 20], [11, 25]], 'z', { in: 'buho' }); g.curve([[24, 14], [24, 20], [21, 25]], 'z', { in: 'buho' });
      // la cara: dos discos y los ojos bien abiertos
      g.ellipse(12, 11, 4, 4, 'hueso', { sep: 'u' }); g.ellipse(20, 11, 4, 4, 'hueso', { sep: 'u' });
      g.ellipse(12, 11, 2.6, 2.6, 'oro'); g.ellipse(20, 11, 2.6, 2.6, 'oro');
      g.rect(12, 11, 2, 2, 'K'); g.rect(20, 11, 2, 2, 'K'); g.px('w', [11, 10], [19, 10]);
      g.poly([[15, 14], [17, 14], [16, 17]], 'brasa');
      g.px('y', [12, 27], [14, 27], [18, 27], [20, 27]);
    }],
    ['hz-farol-papel', 'Farol de Papel', (g) => {
      g.line(16, 1, 16, 3, 'h');
      g.ellipse(16, 16, 10.5, 10.5, 'oro', { tag: 'papel', shade: 2 });
      for (const rx of [3.5, 7]) g.ring(16, 16, rx, 10.5, 1, 'o', { in: 'papel' });
      for (const y of [8, 12, 16, 20, 24]) g.line(6, y, 26, y, 'y', { in: 'papel', flat: true });
      g.fill(M().ellipse(12, 12, 2.6, 4.5), 'Y', { in: 'papel', flat: true });
      g.rect(10, 3, 13, 3, 'madera', { r: 1, sep: true }); g.rect(10, 26, 13, 3, 'madera', { r: 1, sep: true });
      g.rect(15, 29, 3, 2, 'coral');
      g.px('w', [9, 10], [9, 11]);
    }],
    ['hz-luna-menguante', 'Luna Menguante', (g) => {
      const luna = M().ellipse(15, 16, 13, 13.5).cut.ellipse(22, 13, 11.5, 12.5);
      g.fill(luna, 'oro', { tag: 'luna', shade: 2 });
      g.ellipse(6, 18, 1.6, 1.6, 'o', { in: 'luna' }); g.ellipse(10, 25, 1.4, 1.2, 'o', { in: 'luna' });
      g.px('w', [5, 9], [6, 8]);
    }],
    ['hz-telescopio', 'Telescopio Curioso', (g) => {
      // el trípode
      g.line(15, 17, 7, 29, 'madera', { w: 2 }); g.line(16, 17, 16, 29, 'madera', { w: 2 }); g.line(17, 17, 25, 29, 'madera', { w: 2 });
      // el tubo, de más fino (ocular) a más ancho (lente), apuntando arriba
      const tubo = M().poly([[3, 20], [5, 23], [28, 9], [25, 3]]);
      g.fill(tubo, 'indigo', { tag: 'tubo', shade: 2, sep: true });
      g.line(9, 16, 11, 20, 'oro', { in: 'tubo', w: 2 }); g.line(22, 7, 25, 12, 'oro', { in: 'tubo', w: 2 });
      g.line(24, 4, 27, 9, 'a', { in: 'tubo', w: 2 });
      g.rect(14, 15, 4, 3, 'piedra', { sep: true });
      g.px('w', [12, 13], [13, 12]);
    }],
    ['hz-saturno', 'Saturno con Pollera', (g) => {
      const anillo = (front) => M().ring(16, 17, 14.5, 4.6, 2.2).cut.rect(0, front ? 0 : 17, 32, front ? 17 : 15);
      g.fill(anillo(false), 'violeta', { shade: 0 });
      g.ellipse(16, 15, 9.5, 9.5, 'brasa', { tag: 'planeta', shade: 2, sep: true });
      g.fill(M().ellipse(16, 17, 12, 3.5).cut.ellipse(16, 16, 12, 3), 'f', { in: 'planeta' });
      g.rect(6, 9, 20, 2, 'Y', { in: 'planeta' }); g.rect(6, 13, 20, 1, 'E', { in: 'planeta' }); g.rect(6, 19, 20, 1, 'f', { in: 'planeta' });
      g.fill(anillo(true), 'violeta', { sep: true });
      g.px('w', [11, 8], [12, 7]);
    }],
    ['hz-cometa', 'Cometa Apurado', (g) => {
      // la cola: tres estelas que se abren hacia atrás (arriba a la derecha)
      g.curve([[9, 23], [18, 11], [22, 2]], 'B', { w: 4, flat: true });
      g.curve([[9, 23], [20, 13], [29, 9]], 'B', { w: 4, flat: true });
      g.curve([[9, 23], [19, 12], [27, 3]], 'S', { w: 5, flat: true, sep: 'b' });
      g.curve([[9, 23], [19, 13], [25, 6]], 'P', { w: 2, flat: true });
      // la cabeza
      g.ellipse(9, 23, 6, 6, 'oro', { shade: 2, sep: 'b' });
      g.ellipse(8, 22, 3, 3, 'Y', { flat: true }); g.px('w', [6, 20], [7, 20], [6, 21]);
    }],
    ['hz-via-lactea', 'Vía Láctea', (g) => {
      const brazo = (a0) => Array.from({ length: 9 }, (_, i) => {
        const t = i / 8, r = 2 + t * 13, a = a0 + t * Math.PI * 1.35;
        return [16 + Math.cos(a) * r, 16 + Math.sin(a) * r * 0.75];
      });
      g.curve(brazo(0), 'violeta', { w: 4, tag: 'gal' }); g.curve(brazo(Math.PI), 'violeta', { w: 4, tag: 'gal' });
      g.curve(brazo(0).slice(0, 6), 'V', { w: 2, in: 'gal' }); g.curve(brazo(Math.PI).slice(0, 6), 'V', { w: 2, in: 'gal' });
      g.ellipse(16, 16, 5, 4, 'oro', { sep: 'j' });
      g.ellipse(15, 15, 2, 1.5, 'Y', { flat: true }); g.px('w', [14, 14]);
      const brillo = (x, y) => g.art(x - 1, y - 1, [' Y ', 'YwY', ' Y ']);
      brillo(5, 5); brillo(27, 26);
    }],
    ['hz-deseo', 'Deseo Fugaz', (g) => {
      // tres estelas hacia abajo a la izquierda
      g.line(3, 27, 16, 15, 'violeta', { w: 2 });
      g.line(4, 22, 15, 12, 'B', { w: 2, flat: true });
      g.line(9, 29, 19, 18, 'cielo', { w: 2 });
      g.poly(estrella(21, 11, 9.5, 4.2, 0.25), 'oro', { shade: 2, sep: true });
      g.px('w', [18, 9], [19, 8]);
    }],
    ['hz-luna-llena', 'Luna Llena de Pixelia', (g) => {
      g.ellipse(16, 13, 12, 12, 'hueso', { tag: 'luna', shade: 2 });
      g.ellipse(11, 10, 2.5, 2, 'p', { in: 'luna' }); g.ellipse(20, 8, 1.6, 1.4, 'p', { in: 'luna' }); g.ellipse(19, 16, 3, 2.4, 'p', { in: 'luna' });
      // los techos de la ciudad, delante
      const techos = M().rect(3, 23, 26, 7)
        .poly([[3, 23], [7, 18], [11, 23]]).rect(12, 16, 7, 8).poly([[11, 16], [15.5, 11], [20, 16]]).poly([[20, 23], [24.5, 19], [29, 23]]);
      g.fill(techos, 'indigo', { tag: 'casas', sep: true });
      g.rect(5, 24, 2, 2, 'y'); g.rect(14, 18, 2, 2, 'y'); g.rect(14, 23, 2, 2, 'y'); g.rect(23, 25, 2, 2, 'y');
      g.rect(9, 26, 2, 4, 'a');
    }],
  ],
};
