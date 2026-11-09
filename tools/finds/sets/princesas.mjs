// Set «Vecinos» (id 'princesas'). Familia: gente y cosas del barrio. Las personas van de busto, de frente, con la
// misma cara (ojos de 1×2, boca corta) y un atributo que dice quién es; las cosas, enteras y apoyadas.
// Tonos: brasa y hueso con madera; índigo y coral de acento.
import { M } from '../lib.mjs';

const PIEL = 'EEe', PIEL2 = 'OOu';
/** Busto de frente: hombros hasta el borde de abajo, cuello corto y cabeza con cara. */
function bust(g, { cx = 16, cy = 13, skin = PIEL, shirt = 'indigo', mouth = true } = {}) {
  g.fill(M().ellipse(cx, 31, 11.5, 8.5).cut.rect(0, 31, 32, 1).rect(0, 0, 1, 32).rect(31, 0, 1, 32), shirt, { tag: 'shirt' });
  g.rect(cx - 1, cy + 7, 3, 3, skin[2], { flat: true });
  g.rect(cx - 6, cy - 7, 13, 15, skin, { r: 4, tag: 'head' });
  g.px('k', [cx - 3, cy + 1], [cx - 3, cy + 2], [cx + 3, cy + 1], [cx + 3, cy + 2]);
  g.px('R', [cx - 4, cy + 4], [cx + 4, cy + 4]);
  if (mouth) g.px('f', [cx - 1, cy + 5], [cx, cy + 5], [cx + 1, cy + 5]);
}

export default {
  id: 'princesas', name: 'Vecinos', light: '#fde9d8',
  laminas: [
    ['hz-hamaca', 'Siesta en la Hamaca', (g) => {
      g.rect(2, 4, 2, 26, 'madera'); g.rect(28, 4, 2, 26, 'madera');
      // el que duerme: cuerpo, pies a la derecha y el sombrero sobre la cara
      g.fill(M().ellipse(15, 11, 8, 3).cut.rect(0, 11, 32, 21), 'indigo');
      g.rect(20, 6, 2, 5, PIEL); g.rect(23, 7, 2, 4, PIEL);
      g.ellipse(9, 9, 2.6, 2.4, PIEL);
      g.ellipse(9.5, 8.6, 5, 1.7, 'oro'); g.ellipse(9.5, 6.6, 2.8, 2.4, 'oro'); g.rect(7, 7, 6, 1, 'r');
      // la tela, con dos franjas que siguen la panza
      const tela = M().ellipse(15.5, 10, 11, 12).cut.rect(0, 0, 32, 11);
      g.fill(tela, 'hueso', { tag: 'tela', shade: 2 });
      g.fill(M().ring(15.5, 10, 8.6, 9.2, 1.6), 'r', { in: 'tela' });
      g.fill(M().ring(15.5, 10, 4.6, 5, 1.4), 'r', { in: 'tela' });
      g.px('q', [4, 10], [27, 10], [4, 11], [27, 11]);
    }],
    ['hz-espejo', 'Espejo de la Abuela', (g) => {
      g.rect(15, 21, 3, 9, 'oro'); g.ellipse(16, 29, 2.6, 1.6, 'oro');
      g.ellipse(16, 12, 10, 10.5, 'oro', { shade: 2 });
      g.ellipse(16, 1.8, 2.2, 1.2, 'oro');
      g.ellipse(16, 12, 7, 7.6, 'Ssd', { tag: 'vidrio', sep: 'o' });
      g.line(11, 13, 16, 7, 'w', { in: 'vidrio', w: 2 });
      g.line(15, 16, 19, 11, 'w', { in: 'vidrio' });
      g.px('Y', [6, 12], [26, 12]); g.px('r', [16, 22], [16, 2]);
    }],
    ['hz-escoba', 'Vecina que Barre', (g) => {
      bust(g, { cx: 12, cy: 14, shirt: 'menta' });
      g.rect(9, 23, 7, 8, 'hueso', { in: 'shirt' });
      // pañuelo en la cabeza, con el nudo arriba
      g.fill(M().rect(5, 5, 15, 18, 5).cut.ellipse(12, 15.5, 4.8, 5), 'coral', { tag: 'pan' });
      g.px('R', [8, 8], [12, 7], [16, 8], [6, 13], [18, 13]);
      // la escoba, parada al lado
      g.rect(25, 11, 2, 20, 'madera');
      g.poly([[22, 2], [29, 2], [28, 10], [23, 10]], 'oro');
      g.px('o', [24, 4], [24, 6], [24, 8], [26, 3], [26, 5], [26, 7], [26, 9]);
      g.rect(23, 10, 6, 2, 'coral');
    }],
    ['hz-carta', 'Carta sin Firmar', (g) => {
      g.poly([[3, 15], [16, 4], [28, 15]], 'p', { flat: true });           // solapa abierta, detrás
      g.rect(7, 3, 18, 20, 'P', { flat: true, sep: 'q' });                  // la hoja
      g.rect(9, 6, 10, 1, 'g'); g.rect(9, 9, 14, 1, 'g'); g.rect(9, 12, 12, 1, 'g');
      g.rect(3, 15, 26, 15, 'hueso', { tag: 'sobre' });                     // el sobre, adelante
      g.line(3, 15, 16, 24, 'q', { in: 'sobre' }); g.line(28, 15, 16, 24, 'q', { in: 'sobre' });
      g.line(3, 29, 11, 21, 'p', { in: 'sobre' }); g.line(28, 29, 21, 21, 'p', { in: 'sobre' });
      g.ellipse(16, 24, 2.6, 2.6, 'coral');
    }],
    ['hz-te', 'Té con Masitas', (g) => {
      g.ellipse(15, 26, 13.5, 3.6, 'hueso', { shade: 2 });                  // el plato
      g.ring(23.5, 16, 4.5, 4.5, 2, 'hueso');                               // el asa
      g.fill(M().rect(6, 11, 17, 6).ellipse(14, 16, 8.5, 8.5).cut.rect(0, 0, 32, 11), 'hueso', { tag: 'taza', shade: 2, sep: 'q' });
      g.rect(6, 15, 17, 2, 'b', { in: 'taza' }); g.px('B', [8, 15], [12, 15], [16, 15], [20, 15]);
      g.ellipse(14, 11.5, 7.6, 1.8, 'e', { flat: true }); g.rect(8, 11, 8, 1, 'E');
      g.ellipse(25.5, 24.5, 3.4, 2.4, 'oro', { sep: 'q' }); g.px('z', [24, 24], [27, 25], [26, 23]);  // la masita
      g.curve([[14, 8], [12, 6], [15, 4], [13, 2]], 'P');                     // vapor
    }],
    ['hz-cartero', 'Cartero Puntual', (g) => {
      bust(g, { shirt: 'indigo' });
      g.poly([[13, 23], [19, 23], [16, 27]], 'P', { flat: true });
      g.line(22, 23, 13, 29, 'madera', { w: 2, in: 'shirt' });              // la correa del bolso
      g.rect(9, 9, 1, 4, 'z'); g.rect(22, 9, 1, 4, 'z');                     // patillas
      g.fill(M().ellipse(16, 6.5, 7.6, 5).cut.rect(0, 8, 32, 24), 'indigo'); // la gorra
      g.rect(9, 7, 15, 2, 'a'); g.fill(M().ellipse(16, 9, 8, 2.2).cut.rect(0, 0, 32, 9), 'K');
      g.px('Y', [16, 3], [15, 4], [16, 4], [17, 4]); g.px('y', [16, 5]);
      g.rect(21, 24, 8, 6, 'hueso', { sep: true });                          // la carta en la mano
      g.line(21, 24, 25, 27, 'q'); g.line(28, 24, 25, 27, 'q');
    }],
    ['hz-panadero', 'Panadero Madrugador', (g) => {
      bust(g, { cy: 14, shirt: 'hueso', mouth: false });
      g.poly([[13, 24], [19, 24], [16, 27]], 'coral');                       // pañuelo al cuello
      g.px('z', [13, 19], [14, 18], [15, 18], [17, 18], [18, 18], [19, 19], [16, 18]);  // bigote
      // el gorro alto
      g.fill(M().ellipse(11.5, 4.5, 3.4, 3).ellipse(16, 3.6, 4, 3).ellipse(20.5, 4.5, 3.4, 3).rect(10, 5, 13, 5), 'hueso', { shade: 2 });
      g.rect(10, 9, 13, 1, 'q');
      // el pan bajo el brazo
      g.line(21, 29, 28, 18, 'oro', { w: 4, sep: true });
      g.px('o', [23, 26], [24, 25], [25, 23], [26, 22], [27, 20], [28, 19]);
    }],
    ['hz-bailarina', 'Bailarina de la Plaza', (g) => {
      g.line(13, 11, 9, 4, 'E', { w: 2 }); g.line(19, 11, 25, 15, 'E', { w: 2 });   // brazos
      g.px('E', [14, 27], [14, 28], [18, 27], [19, 28], [20, 28]); g.px('x', [13, 29], [14, 29], [21, 29], [22, 28]);
      const pollera = M().poly([[13, 16], [19, 16], [28, 24], [25, 27], [16, 25], [7, 27], [4, 23]]);
      g.fill(pollera, 'coral', { tag: 'pollera', shade: 2 });
      g.curve([[6, 23], [11, 22], [16, 23], [21, 22], [26, 23]], 'R', { in: 'pollera' });
      g.curve([[10, 19], [16, 20], [22, 19]], 'x', { in: 'pollera' });
      g.poly([[13, 10], [19, 10], [18, 16], [14, 16]], 'baa');                // corpiño
      g.ellipse(16, 6, 3.2, 3.4, PIEL);
      g.fill(M().ellipse(16, 4.6, 3.4, 2.4).cut.rect(0, 6, 32, 20).ellipse(19, 2.6, 2, 1.6), 'z');
      g.px('r', [13, 3], [12, 3], [13, 2]); g.px('k', [15, 7], [17, 7]);
    }],
    ['hz-vecinos', 'Los Vecinos de Pixelia', (g) => {
      const cara = (cx, cy) => { g.px('k', [cx - 2, cy + 1], [cx + 2, cy + 1]); g.px('f', [cx - 1, cy + 3], [cx, cy + 3], [cx + 1, cy + 3]); };
      // atrás, el del medio
      g.fill(M().rect(10, 15, 13, 16, 3).cut.rect(0, 31, 32, 1), 'menta');
      g.ellipse(16, 9.5, 4.6, 5, PIEL); cara(16, 9);
      g.fill(M().ellipse(16, 8, 5, 4.4).cut.rect(0, 8, 32, 24), 'z');
      // adelante, a los costados
      g.fill(M().ellipse(8, 31, 7, 10).cut.rect(0, 31, 32, 1).rect(0, 0, 1, 32), 'coral', { sep: true });
      g.ellipse(8.5, 16.5, 4.4, 4.8, PIEL2, { sep: true }); cara(8, 16);
      g.fill(M().ellipse(8.5, 15, 4.8, 4).cut.rect(0, 15, 32, 20).ellipse(8.5, 10.6, 2, 1.6), 'Ggh');
      g.fill(M().ellipse(24, 31, 7, 10).cut.rect(0, 31, 32, 1).rect(31, 0, 1, 32), 'indigo', { sep: true });
      g.ellipse(23.5, 16.5, 4.4, 4.8, PIEL, { sep: true }); cara(24, 16);
      g.fill(M().ellipse(23.5, 15, 4.8, 4).cut.rect(0, 15, 32, 20), 'oro');
    }],
  ],
};
