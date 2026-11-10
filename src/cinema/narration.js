// Guiones del narrador (PLAN-TRAVESIA §3a). Cada línea: { id, key, voice?, style? } → assets/audio/voice/<id>.m4a,
// grabada con `npm run narrate -- --script <guion>` (tools/audio/narrate.mjs). El texto es la clave `key` en español
// (src/i18n/es.js): el mismo que sale de subtítulo, así lo que se oye y lo que se lee no se separan. El motor
// (src/cinema/timeline.js) toca 'voice/<id>' por el bus de voz y estira el subtítulo a la duración real del audio.
// Sin audio grabado, el subtítulo usa su tiempo de lectura.
// voice: la voz de Gemini (por defecto la del narrador, Fenrir; la eligió el usuario). style: la dirección de actuación
// ('narrador' por defecto; 'vera' para la cartógrafa), en tools/audio/narrate.mjs.
import ES from '../i18n/es.js';

const VERA = { voice: 'Gacrux', style: 'vera' };
const n = (k, o = {}) => ({ id: 'intro/' + k, key: 'intro.line.' + k, ...o });

export const NARRATION = {
  // "El Quiebre" (src/scenes/intro.js, paso 3b): el narrador en los planos 1 a 9 y Vera en el 10 y el 11
  intro: [
    n('01'), n('02'), n('03'), n('04'), n('05'), n('06'), n('07'), n('08'), n('09'), n('10'), n('11'), n('12'),
    n('13', VERA), n('14', VERA), n('15', VERA), n('16', VERA),
  ],
};
for (const list of Object.values(NARRATION)) for (const l of list) if (!l.text) l.text = ES[l.key];

/** Línea por id ('intro/01'), o null. */
export function narrationLine(id) {
  for (const list of Object.values(NARRATION)) for (const l of list) if (l.id === id) return l;
  return null;
}
