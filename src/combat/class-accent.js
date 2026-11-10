// Color de cada clase en el combate (pasada visual de legibilidad): aro en el piso y ropa (combat-scene.js), y el mismo
// color en la barra de vida y en la lista del turno (combat-ui.js). Se separan del azul del aro de estado, del dorado de
// "elegido" y del rojo enemigo. dress es el id de OUTFIT_COLORS (src/core/data.js); el líder conserva su look.
import { ROLE_CLASS } from './classes.js';

export const CLASS_ACCENT = {
  lider: { ring: 0xe07ac8, dress: null },   // el dorado queda para "elegido"
  saqueador: { ring: 0xe0764a, dress: 'rojo' },
  cazador: { ring: 0x8fd05e, dress: 'verde' },
  forjador: { ring: 0x5fb6f0, dress: 'celeste' },
  curandero: { ring: 0xf4ecd8, dress: 'blanco' },
  monje: { ring: 0xb79cf0, dress: 'lila' },
  guerrero: { ring: 0xc9cdd4, dress: 'negro' },
  cautivo: { ring: 0x8a8378, dress: null },
};
/** El acento de una unidad del grupo (u.type, u.cls); cls manda si viene (la clase con que se arma el modelo). */
export function accentOf(u, cls) {
  if (u.type === 'lider') return CLASS_ACCENT.lider;
  const k = cls || u.cls || u.type;
  return CLASS_ACCENT[k] || CLASS_ACCENT[ROLE_CLASS[k]] || CLASS_ACCENT.cautivo;
}
/** El color de la clase en CSS ('#rrggbb'), o '' para los enemigos. */
export function accentCss(u) {
  if (!u || u.side === 'enemy') return '';
  return '#' + accentOf(u).ring.toString(16).padStart(6, '0');
}
