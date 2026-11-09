// Set «Edificios» (id 'castillos'). Familia: piezas y construcciones de la ciudad, de frente o en tres cuartos, enteras
// y apoyadas. Tonos: brasa (ladrillo y tejas), piedra y madera de base; oro, índigo y hoja de acento.
// Tratamiento: volúmenes con cara clara arriba y oscura a la derecha, juntas y tablas marcadas con el tono oscuro.
import { M } from '../lib.mjs';

export default {
  id: 'castillos', name: 'Edificios', light: '#f9f1e6',
  laminas: [
    ['hz-ladrillo', 'Ladrillo con Onda', (g) => {
      // un ladrillo hueco en tres cuartos: la punta con los agujeros a la izquierda
      g.poly([[3, 12], [13, 16], [13, 26], [3, 22]], 'eef', { flat: false, tag: 'punta' });
      g.poly([[13, 16], [29, 10], [29, 20], [13, 26]], 'brasa', { tag: 'lado', sep: true });
      g.poly([[3, 12], [19, 6], [29, 10], [13, 16]], 'EEe', { tag: 'arriba', sep: true });
      for (const [x, y] of [[5, 15], [9, 17], [5, 19], [9, 21]]) g.rect(x, y, 2, 2, 'K', { in: 'punta' });
      g.line(13, 21, 29, 15, 'f', { in: 'lado' });
      // la mezcla que le quedó encima
      g.fill(M().ellipse(18, 10.5, 5.5, 1.6).ellipse(13, 12.5, 2.5, 1.2).rect(22, 11, 2, 3).rect(9, 13, 2, 3), 'hueso', { sep: 'q' });
    }],
    ['hz-llave', 'Llave Perdida', (g) => {
      // la etiqueta, colgada del ojo con un hilo
      g.curve([[12, 6], [7, 9], [6, 14]], 'q');
      g.poly([[3, 15], [9, 13], [11, 21], [5, 23]], 'hueso', { shade: 2 });
      g.ellipse(6, 16, 0.8, 0.8, 'K', { flat: true });
      // la llave, parada: ojo calado arriba, caña y paletón abajo
      g.ring(18, 8, 6.5, 6, 2.5, 'oro', { shade: 2, sep: true });
      g.ellipse(18, 8, 1.2, 1.2, 'oro');
      g.rect(16, 13, 4, 2, 'oro', { sep: true });
      g.rect(17, 15, 3, 15, 'oro');
      g.fill(M().rect(20, 21, 5, 3).rect(20, 25, 6, 4).rect(22, 24, 2, 1), 'oro', { sep: true });
    }],
    ['hz-vela', 'Vela Tembleque', (g) => {
      // el candelero de madera con su asa
      g.ring(25, 23, 3.5, 3.5, 1.6, 'madera');
      g.ellipse(15, 26.5, 12.5, 3.2, 'madera', { shade: 2 });
      g.ellipse(15, 25.5, 9, 1.8, 'O', { flat: true });
      // la vela, con la cera corrida
      g.fill(M().rect(10, 11, 10, 15).ellipse(13, 11, 2, 1.5), 'hueso', { tag: 'vela', shade: 2, sep: true });
      g.rect(10, 11, 10, 1, 'q', { in: 'vela' });
      g.fill(M().rect(17, 11, 2, 6).ellipse(18, 17, 1, 1.5).rect(11, 11, 2, 4), 'P', { in: 'vela' });
      g.line(15, 9, 15, 10, 'k');
      // la llama, doblada para un costado
      g.fill(M().ellipse(15.5, 5.5, 3, 3.2).poly([[13, 4], [18, 5], [20, 0.6]]), 'brasa', { tag: 'llama' });
      g.fill(M().ellipse(15.5, 6.2, 1.6, 2).line(16, 4, 18, 2, 1), 'Y', { in: 'llama' });
      g.px('w', [15, 6]);
    }],
    ['hz-puerta', 'Puerta que Rechina', (g) => {
      // marco de piedra en arco y la puerta entreabierta
      g.fill(M().rect(5, 9, 22, 20).ellipse(16, 10, 11, 9), 'piedra', { tag: 'marco' });
      g.px('h', [9, 5], [16, 2], [22, 5], [6, 15], [26, 15], [6, 22], [26, 22]);
      g.fill(M().rect(9, 11, 14, 18).ellipse(16, 11, 7, 6), 'K', { flat: true });
      g.fill(M().rect(9, 11, 11, 18).ellipse(16, 11, 7, 6).cut.rect(20, 0, 12, 32), 'madera', { tag: 'puerta', sep: true });
      for (const x of [12, 15, 18]) g.line(x, 6, x, 28, 'u', { in: 'puerta' });
      g.rect(9, 13, 9, 2, 'h', { in: 'puerta' }); g.rect(9, 23, 9, 2, 'h', { in: 'puerta' });
      g.px('G', [9, 13], [9, 23]);
      g.ring(18.5, 19, 1.6, 1.6, 1, 'o');
      g.rect(3, 29, 26, 1, 'g');
      g.rect(3, 28, 26, 2, 'piedra', { sep: true });
    }],
    ['hz-ventana', 'Ventana con Macetas', (g) => {
      // los postigos abiertos
      g.rect(2, 3, 7, 18, 'indigo', { tag: 'pi' }); g.rect(23, 3, 7, 18, 'indigo', { tag: 'pd' });
      for (let y = 6; y < 20; y += 3) { g.rect(3, y, 5, 1, 'a', { in: 'pi' }); g.rect(24, y, 5, 1, 'a', { in: 'pd' }); }
      g.rect(9, 2, 14, 19, 'hueso', { sep: true, shade: 2 });
      g.rect(11, 4, 10, 15, 'cielo', { tag: 'vidrio' });
      g.rect(15, 4, 2, 15, 'p'); g.rect(11, 10, 10, 2, 'p');
      g.px('w', [12, 5], [13, 5], [12, 6], [17, 12], [18, 12], [17, 13]);
      g.rect(5, 20, 22, 2, 'piedra', { sep: true });
      // las tres macetas con sus plantas
      for (const [x, fl] of [[8, 'Rr'], [16, 'Yy'], [24, 'Rr']]) {
        g.fill(M().ellipse(x - 2, 17, 2.6, 2.2).ellipse(x + 2, 17, 2.6, 2.2).ellipse(x, 14.5, 2.6, 2.4), 'hoja', { sep: true });
        for (const [a, b] of [[x - 3, 16], [x + 1, 13], [x + 2, 17]]) g.art(a, b, [fl[0] + fl[1], fl[1] + fl[1]]);
        g.poly([[x - 3, 22], [x + 3, 22], [x + 2, 29], [x - 2, 29]], 'brasa', { sep: true });
        g.rect(x - 3, 22, 7, 2, 'E', { flat: true });
      }
    }],
    ['hz-casa-arbol', 'Casa del Árbol', (g) => {
      g.fill(M().ellipse(16, 9, 14, 7.5).ellipse(6, 13, 4.5, 4).ellipse(26, 13, 4.5, 4), 'hoja', { shade: 2 });
      g.fill(M().rect(13, 18, 6, 12).poly([[10, 30], [13, 25], [19, 25], [22, 30]]), 'madera', { sep: true, tag: 'tronco' });
      g.line(17, 22, 17, 28, 'z', { in: 'tronco' });
      // la casita, con techo de tejas y una ventana
      g.rect(8, 18, 17, 2, 'u', { sep: true });
      g.rect(10, 11, 12, 7, 'madera', { tag: 'casa', sep: true });
      g.rect(10, 13, 12, 1, 'u', { in: 'casa' }); g.rect(10, 15, 12, 1, 'u', { in: 'casa' });
      g.rect(14, 12, 4, 4, 'K', { flat: true }); g.px('O', [16, 12], [16, 13], [16, 14], [16, 15]);
      g.poly([[7, 12], [16, 4], [25, 12]], 'brasa', { sep: true });
      // la escalera
      g.line(6, 20, 4, 30, 'O'); g.line(9, 20, 8, 30, 'O');
      for (const y of [22, 25, 28]) g.line(5, y, 8, y, 'u');
    }],
    ['hz-torre-vigia', 'Torre del Vigía', (g) => {
      g.line(16, 1, 16, 7, 'z');
      g.poly([[17, 1], [24, 2], [17, 5]], 'indigo');
      g.fill(M().rect(9, 6, 14, 6).cut.rect(11, 6, 2, 2).rect(15, 6, 2, 2).rect(19, 6, 2, 2), 'piedra', { tag: 'alm' });
      g.rect(9, 11, 14, 1, 'h');
      g.fill(M().poly([[10, 12], [22, 12], [24, 30], [8, 30]]), 'piedra', { tag: 'torre', sep: true, shade: 2 });
      for (const [y, o] of [[16, 0], [20, 2], [24, 0], [28, 2]]) {
        g.rect(8, y, 17, 1, 'g', { in: 'torre' });
        for (let x = 11 + o; x < 24; x += 4) g.rect(x, y - 3, 1, 3, 'g', { in: 'torre' });
      }
      g.rect(15, 14, 2, 5, 'K', { flat: true });
      g.fill(M().rect(13, 25, 6, 5).ellipse(16, 25, 3, 2.5), 'madera', { sep: true });
    }],
    ['hz-estadio', 'Estadio Lleno', (g) => {
      // la pared de afuera y, arriba, la tribuna llena por sectores de colores, en dos gradas
      g.fill(M().ellipse(16, 13, 14.5, 8.5).rect(1, 13, 30, 10).ellipse(16, 22, 14.5, 6), 'piedra', { tag: 'pared', shade: 2 });
      const alto = 'rbyerbye', bajo = 'RBYERBYE';
      for (let y = 4; y <= 22; y++) for (let x = 2; x <= 29; x++) {
        const ring = Math.hypot((x - 16) / 13.5, (y - 13) / 7.6);
        if (ring > 1) continue;
        const a = Math.atan2((y - 13) / 7.6, (x - 16) / 13.5), sec = Math.floor((a + Math.PI) / (2 * Math.PI) * 8 + 0.5) % 8;
        g.px(ring > 0.76 ? alto[sec] : ring > 0.66 ? 'g' : bajo[sec], [x, y]);
      }
      g.ellipse(16, 13, 7.5, 4, 'hoja', { sep: true, tag: 'cancha' });
      g.line(16, 10, 16, 16, 'L', { in: 'cancha' }); g.ring(16, 13, 1.6, 1.6, 1, 'L', { in: 'cancha' });
      // las banderas arriba de la tribuna
      for (const x of [6, 26]) { g.line(x, 1, x, 6, 'z'); g.poly([[x + 1, 1], [x + 4, 2], [x + 1, 3]], 'indigo'); }
      // los arcos de la entrada
      for (const x of [7, 13, 19, 25]) g.fill(M().rect(x - 1, 23, 3, 4).ellipse(x, 23, 1.5, 1), 'K', { flat: true });
    }],
    ['hz-municipalidad', 'La Municipalidad de Pixelia', (g) => {
      // el frontón y el cuerpo con columnas
      g.line(16, 1, 16, 5, 'z'); g.poly([[17, 1], [23, 2], [17, 4]], 'coral');
      g.poly([[2, 16], [16, 6], [30, 16]], 'brasa', { sep: true, tag: 'fronton', shade: 2 });
      // el reloj en el frontón
      g.ellipse(16, 12, 2.8, 2.8, 'hueso', { sep: true });
      g.px('k', [16, 10], [16, 11], [16, 12], [17, 12]);
      g.rect(3, 16, 26, 2, 'piedra', { sep: true });
      g.rect(4, 18, 24, 9, 'hueso', { tag: 'cuerpo', sep: true });
      for (const x of [6, 10, 20, 24]) g.rect(x, 18, 3, 9, 'PPp', { in: 'cuerpo', sep: 'q' });
      g.fill(M().rect(14, 21, 4, 6).ellipse(15.5, 21, 2, 1.6), 'madera', { sep: true });
      // la escalinata
      g.rect(2, 27, 28, 2, 'piedra', { sep: true }); g.rect(1, 29, 30, 1, 'piedra');
    }],
  ],
};
