// Atajos de teclado reasignables (Ajustes → Controles). Se guardan en state.settings.keys como { acción: code }
// (KeyboardEvent.code, que no depende de la distribución del teclado: KeyW es la misma tecla en QWERTY y AZERTY).
// Las flechas, Esc y Enter no se reasignan: siempre funcionan.

export const KEY_ACTIONS = [
  { id: 'up', group: 'Cámara y movimiento', label: 'Adelante', def: 'KeyW' },
  { id: 'down', group: 'Cámara y movimiento', label: 'Atrás', def: 'KeyS' },
  { id: 'left', group: 'Cámara y movimiento', label: 'Izquierda', def: 'KeyA' },
  { id: 'right', group: 'Cámara y movimiento', label: 'Derecha', def: 'KeyD' },
  { id: 'rotL', group: 'Cámara y movimiento', label: 'Girar a la izquierda', def: 'KeyQ' },
  { id: 'rotR', group: 'Cámara y movimiento', label: 'Girar a la derecha', def: 'KeyE' },
  { id: 'zoomIn', group: 'Cámara y movimiento', label: 'Acercar', def: 'Equal' },
  { id: 'zoomOut', group: 'Cámara y movimiento', label: 'Alejar', def: 'Minus' },
  { id: 'build', group: 'Ciudad', label: 'Construir', def: 'KeyB' },
  { id: 'collect', group: 'Ciudad', label: 'Cobrar todo', def: 'KeyC' },
  { id: 'home', group: 'Ciudad', label: 'Ir a la Municipalidad', def: 'KeyH' },
  { id: 'themes', group: 'Ciudad', label: 'Estilo de la ciudad', def: 'KeyT' },
  { id: 'expedition', group: 'Ciudad', label: 'Expedición', def: 'KeyX' },
  { id: 'settings', group: 'General', label: 'Ajustes', def: 'KeyO' },
  { id: 'back', group: 'Expedición', label: 'Volver a la ciudad', def: 'KeyV' },
];
const BY_ID = Object.fromEntries(KEY_ACTIONS.map(a => [a.id, a]));
/** Teclas fijas que no se pueden asignar. */
export const RESERVED = new Set(['Escape', 'Enter', 'NumpadEnter', 'Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'F11', 'MetaLeft', 'MetaRight']);

let custom = {};
/** Lo llama settings.js cada vez que cambian los ajustes. */
export function setKeyMap(map) { custom = map && typeof map === 'object' ? map : {}; }

/** Tecla (code) asignada a una acción. */
export function codeFor(id) { return custom[id] || BY_ID[id]?.def || null; }

/** Acción que corresponde a un code (entre las ids dadas, o todas). */
export function actionFor(code, ids = null) {
  for (const a of ids ? ids.map(i => BY_ID[i]) : KEY_ACTIONS) if (a && codeFor(a.id) === code) return a.id;
  return null;
}

/** Nombre corto para mostrar una tecla: KeyW → W, Digit1 → 1, Equal → =, ShiftLeft → Shift. */
export function keyLabel(code) {
  if (!code) return '—';
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit\d$/.test(code)) return code.slice(5);
  if (/^Numpad\d$/.test(code)) return 'Num ' + code.slice(6);
  const named = { Equal: '=', Minus: '-', BracketLeft: '[', BracketRight: ']', Semicolon: 'Ñ', Quote: "'", Backquote: '`', Comma: ',', Period: '.', Slash: '/', Backslash: '\\',
    NumpadAdd: 'Num +', NumpadSubtract: 'Num -', ShiftLeft: 'Shift', ShiftRight: 'Shift der.', ControlLeft: 'Ctrl', ControlRight: 'Ctrl der.', AltLeft: 'Alt', AltRight: 'Alt Gr',
    Backspace: 'Borrar', Delete: 'Supr', Home: 'Inicio', End: 'Fin', PageUp: 'Re Pág', PageDown: 'Av Pág', Insert: 'Insert', CapsLock: 'Bloq Mayús' };
  return named[code] || code.replace(/^F(\d+)$/, 'F$1');
}

/**
 * Asigna code a la acción id. Si otra acción usaba esa tecla, se intercambian (nunca quedan dos con la misma).
 * Devuelve el mapa nuevo (para guardar en settings.keys) o null si la tecla está reservada.
 */
export function assignKey(map, id, code) {
  if (RESERVED.has(code) || !BY_ID[id]) return null;
  const next = { ...map };
  const prev = codeFor(id);
  const other = KEY_ACTIONS.find(a => a.id !== id && (next[a.id] || a.def) === code);
  next[id] = code;
  if (other) next[other.id] = prev;
  for (const a of KEY_ACTIONS) if (next[a.id] === a.def) delete next[a.id];
  return next;
}
