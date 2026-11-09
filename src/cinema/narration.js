// Guiones del narrador (PLAN-TRAVESIA §3a). Cada línea: { id, text } → assets/audio/voice/<id>.m4a, grabada con
// `node tools/audio/narrate.mjs --script <guion> --voice <voz>`. El motor (src/cinema/timeline.js) toca 'voice/<id>'
// por el bus de voz y estira el subtítulo a la duración real del audio. Sin audio grabado, el subtítulo usa su tiempo.
// Los textos de "El Quiebre" nuevos los escribe el paso 3b (DESIGN-STORY §7); por ahora va la línea de apertura de
// siempre, que sirve para elegir la voz.
export const NARRATION = {
  intro: [
    { id: 'intro/01', text: 'Antes del cielo hubo una sola tierra. Y por dentro, estaba viva.' },
  ],
};

/** Línea por id ('intro/01'), o null. */
export function narrationLine(id) {
  for (const list of Object.values(NARRATION)) for (const l of list) if (l.id === id) return l;
  return null;
}
