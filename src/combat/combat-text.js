// Textos del paso A2 (PLAN-FOTO): velocidad, estados, terreno y reacciones.
// El combate todavía no pasó por src/core/i18n.js (sus nombres y textos viven en combat-data.js y combat-ui.js, en
// español); lo nuevo queda junto acá, con claves, para que la pasada de idiomas (bloque 4b) sea mover este objeto a
// src/i18n/es.js y cambiar el import por el de core/i18n.js.
const TEXT = {
  'combat.keys.extra': 'Espacio: saltear la animación · +: velocidad',
  'combat.speed.tip': 'Velocidad de las animaciones: ×1, ×2 o ×3. Con Espacio se saltea lo que se está animando.',
  'combat.speed.label': 'Velocidad de las animaciones',
  'combat.status.wet': 'mojado',
  'combat.status.burn': 'quemado',
  'combat.trait.warded': 'Cubierto por el guardián: −1',
  'combat.trait.wardedShort': 'cubierto',
  'combat.trait.flies': 'Vuela',
  'combat.trait.cover': 'En el matorral: −1 de los tiros',
  'combat.ai.kite': 'Tira y se aleja',
  'combat.ai.guard': 'Cubre a los suyos',
  'combat.ai.summon': 'Invoca',
  'combat.ai.charge': 'Carga en línea',
  'combat.ai.heal': 'Cura a los suyos',
  'combat.intent.heal': 'Va a curar {n} al que tiene marcado.',
  'combat.tile.water': 'Cuesta 2 moverse. Quien esté acá queda mojado.',
  'combat.tile.flow': 'La corriente arrastra una casilla a quien se quede acá.',
  'combat.tile.cover': 'Cobertura: 1 menos de los tiros. Arde.',
  'combat.tile.fire': 'En llamas: quien se quede acá recibe {n} y queda quemado.',
  'combat.tile.bonfire': 'Fogata: arde toda la pelea. Quien se quede acá recibe {n} y queda quemado.',
  'combat.tile.steam': 'Vapor: no se puede apuntar de lejos hacia acá ni desde acá, y para los tiros.',
  'combat.fx.crash': 'Se estrelló',
  'combat.fx.fire': 'Fuego',
  'combat.fx.steam': 'Vapor',
  'combat.combo.vapor': 'Vapor',
  'combat.combo.descarga': 'Descarga',
  'combat.combo.incendio': 'Incendio',
  'combat.combo.fuego_salta': 'Fuego que salta',
  'combat.combo.brote': 'Brote',
  'combat.combo.despeje': 'Despeje',
  'combat.combo.estrellado': 'Se estrelló',
  'combat.combo.a_las_brasas': 'A las brasas',
};
export function t(key, vars) {
  const s = TEXT[key] ?? key;
  return vars ? s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m)) : s;
}
