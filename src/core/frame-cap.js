// Tope de cuadros por segundo para loops de requestAnimationFrame. Sin esto se dibuja a la frecuencia
// del monitor (144/165 Hz en muchas PC) y la GPU trabaja de más para un juego que con 60 se ve igual.

// ?fps=N fuerza el tope en todo el juego (?fps=0 = sin tope, para medir)
const m = typeof location !== 'undefined' ? /[?&]fps=(\d+)/.exec(location.search) : null;
export const FPS_PARAM = m ? +m[1] : null;

/**
 * Devuelve gate(t, fps?) → true si en este tick de rAF toca dibujar. Mantiene el promedio en `fps`
 * aunque el monitor no sea múltiplo (a 144 Hz alterna saltos de 2 y 3 ticks). fps 0/Infinity = siempre.
 */
export function frameCap(defaultFps = 60) {
  let next = 0;
  const gate = (t, fps = FPS_PARAM ?? defaultFps) => {
    if (!fps || fps === Infinity) { next = 0; return true; }
    const iv = 1000 / fps;
    // 2 ms de tolerancia por el temblor del rAF (si no, a 60 Hz se saltearía un cuadro de vez en cuando)
    if (next && t < next - 2) return false;
    next = next && t - next < iv ? next + iv : t + iv;
    return true;
  };
  gate.reset = () => { next = 0; };
  return gate;
}
