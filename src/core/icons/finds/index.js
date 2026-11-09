// Láminas de Hallazgos (32×32), una familia por set. Las grillas se generan con tools/finds.mjs desde
// tools/finds/sets/<set>.mjs (ver tools/finds/README.md): se corrige el dibujo, no la grilla.
// El orden es el de los sets en src/album/album.js.
import princesas from './princesas.js';
import vestidos from './vestidos.js';
import autitos from './autitos.js';
import postres from './postres.js';
import mascotas from './mascotas.js';
import flores from './flores.js';
import castillos from './castillos.js';
import joyas from './joyas.js';
import musica from './musica.js';
import playa from './playa.js';
import noche from './noche.js';
import fiesta from './fiesta.js';

export const FIND_SETS = [
  { id: 'princesas', name: 'Vecinos', icons: princesas },
  { id: 'vestidos', name: 'Ropa de Viaje', icons: vestidos },
  { id: 'autitos', name: 'Navegación', icons: autitos },
  { id: 'postres', name: 'Postres', icons: postres },
  { id: 'mascotas', name: 'Fauna de la Isla', icons: mascotas },
  { id: 'flores', name: 'Flores', icons: flores },
  { id: 'castillos', name: 'Edificios', icons: castillos },
  { id: 'joyas', name: 'Tesoros', icons: joyas },
  { id: 'musica', name: 'Música', icons: musica },
  { id: 'playa', name: 'Costa', icons: playa },
  { id: 'noche', name: 'Noche Estrellada', icons: noche },
  { id: 'fiesta', name: 'Fiesta', icons: fiesta },
];
