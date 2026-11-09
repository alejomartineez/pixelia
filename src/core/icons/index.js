// Todos los íconos dibujados a mano, por familia (tools/icons.html los muestra así).
import res from './res.js';
import ui from './ui.js';
import hud from './hud.js';
import weather from './weather.js';
import land from './land.js';
import combat from './combat.js';
import meta from './meta.js';

export const FAMILIES = [
  { id: 'res', name: 'Recursos y monedas', icons: res },
  { id: 'ui', name: 'Acciones de interfaz', icons: ui },
  { id: 'hud', name: 'HUD, lugares y menú', icons: hud },
  { id: 'weather', name: 'Amenazas, clima y defensas', icons: weather },
  { id: 'land', name: 'Regiones, temporadas y herramientas', icons: land },
  { id: 'combat', name: 'Elementos, clases, armas y pueblos', icons: combat },
  { id: 'meta', name: 'Cofres, premios, pase y rangos', icons: meta },
];

/** id → { name, s16, s24, fam } */
export const SPRITES = {};
for (const f of FAMILIES) for (const [id, d] of Object.entries(f.icons)) SPRITES[id] = { ...d, fam: f.id };
