// Ecos de noche (plan L6; paso 6b, DESIGN-STORY.md §5). De noche, en el borde de la isla y en las ruinas ya pisadas de la
// expedición, aparecen siluetas traslúcidas que repiten unos segundos un momento de antes del Quiebre. Al hacer clic dan
// una línea (y alguno, una página del diario). Cada eco sale una sola vez y queda en la Bitácora. Misteriosos, no de miedo.
// Algunos siembran la culpa de Vera (L2) y el giro del final (L4).
//   ECHOES · echoState(s) · cityEcho(s) · expEcho(s, region) · seeEcho(id, s)
// state.story.echoes = { [id]: ms } (se completa solo en partidas viejas). El dibujo está en echo-fx.js.
import { bus } from '../core/bus.js';
import { store } from '../core/state.js';
import { ACTS, PAGE_BY_ID } from './story-data.js';

const S = () => store.state;
/**
 * where: 'city' (borde de la isla, spot = índice de cityEchoSpots) o 'exp' (una ruina pisada; region opcional).
 * chapter: desde qué capítulo del Acto 1 puede salir. scene: la coreografía de echo-fx.js. page: la que deja (opcional).
 */
export const ECHOES = [
  {
    id: 'e_cavar', where: 'city', spot: 0, chapter: 'bosque', scene: 'cavar', title: 'Los que cavaban',
    line: 'Dos mineros cavan a la luz de un farol. Uno se para y mira el piso. El otro le devuelve la pala: "Una más". No quedaba más.',
  },
  {
    id: 'e_subir', where: 'city', spot: 1, chapter: 'sierras', scene: 'subir', title: 'Los que subieron',
    line: 'Una familia mira cómo la tierra se levanta bajo sus pies. Del otro lado de la grieta, alguien se queda abajo y levanta la mano.',
  },
  {
    id: 'e_mapa', where: 'city', spot: 2, chapter: 'cerro', scene: 'mapa', title: 'La mesa del archivo', page: 'p10',
    line: 'Una muchacha dibuja un mapa con letra prolija. Un señor con el sello de una Casa le marca un punto con el dedo, siempre el mismo.',
  },
  {
    id: 'e_permiso', where: 'exp', chapter: 'cerro', scene: 'permiso', title: 'Los permisos',
    line: 'Bajo un farol, un hombre firma papeles sin leerlos. Otro le deja una bolsa que suena a piedra y se va sin saludar.',
  },
  {
    id: 'e_farero', where: 'exp', region: 'costa', chapter: 'costa', scene: 'farero', title: 'El farero',
    line: 'Un farero apaga la lámpara y se queda mirando el cielo. Alguien le pagó para que no la prendiera más.',
  },
];
export const ECHO_BY_ID = Object.fromEntries(ECHOES.map(e => [e.id, e]));

export function echoState(s = S()) {
  if (!s.story || typeof s.story !== 'object') s.story = {};
  if (!s.story.echoes || typeof s.story.echoes !== 'object') s.story.echoes = {};
  return s.story.echoes;
}
const CH = ACTS[0].chapters.map(c => c.id);
/** ¿La historia ya llegó a ese capítulo? */
function reached(s, ch) {
  const cur = CH.indexOf(s.story?.chapter || 'prologo');
  return CH.indexOf(ch) <= Math.max(0, cur);
}
const free = (s, e) => !echoState(s)[e.id] && reached(s, e.chapter);
/** El eco que toca en la ciudad esta noche (uno a la vez, el primero que falta), o null. */
export function cityEcho(s = S()) {
  return ECHOES.find(e => e.where === 'city' && free(s, e)) || null;
}
/** El eco que puede aparecer en una ruina de la expedición en esa región, o null. */
export function expEcho(s = S(), region = null) {
  return ECHOES.find(e => e.where === 'exp' && (!e.region || e.region === region) && free(s, e)) || null;
}
/** Se vio un eco (clic): queda anotado, deja su página y emite 'echo:seen'. Devuelve el eco o null si ya estaba. */
export function seeEcho(id, s = S(), now = Date.now()) {
  const e = ECHO_BY_ID[id];
  const st = echoState(s);
  if (!e || st[id]) return null;
  st[id] = now;
  if (e.page && PAGE_BY_ID[e.page] && !s.story?.pages?.[e.page]) store.grant({ page: e.page }, 'story');
  store.markDirty();
  bus.emit('echo:seen', { id, where: e.where, page: e.page || null });
  return e;
}
/** Los ecos vistos, en orden (para la Bitácora). */
export function seenEchoes(s = S()) {
  const st = echoState(s);
  return ECHOES.filter(e => st[e.id]).sort((a, b) => st[a.id] - st[b.id]);
}
