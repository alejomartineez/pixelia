# Láminas de Hallazgos

Las 108 láminas (12 sets × 9) son ilustraciones de **32×32** con la paleta de `src/core/icons/palette.js`. El juego lee
grillas de texto (`src/core/icons/finds/<set>.js`); esas grillas **se generan** desde los dibujos de
`tools/finds/sets/<set>.mjs` con el lápiz de `tools/finds/lib.mjs`. Se corrige el dibujo y se vuelve a generar: la grilla
no se toca a mano.

```bash
node tools/finds.mjs postres      # genera src/core/icons/finds/postres.js y la hoja shots/finds/postres.png
node tools/finds.mjs --check      # falla si alguna grilla quedó distinta de su dibujo
```

La hoja muestra las 9 láminas del set en 3×3, en el orden del archivo. Por lámina: ×7 sobre el color claro del set, y al
lado ×3 sobre claro, ×3 en grises, **×2 sobre claro (el tamaño real en la página del álbum)**, ×2 sobre el fondo oscuro
de la interfaz y la silueta ×2 (así se ve la lámina que falta).

## Reglas de lectura (las mismas de los íconos, DESIGN.md)
- **Se entiende qué objeto es a tamaño real** (la ×2 de la hoja), sin leer el nombre. Si un detalle no se lee, se
  agranda, se simplifica o se saca.
- **Silueta legible en negro** y distinta de las otras 8 del set.
- **Prueba de grises:** las piezas se separan por valor, no solo por color.
- **Una idea por lámina.** Un objeto (o un personaje con un atributo), no una escena. Sin texto ni letras.
- **Nada copiado del emoji equivalente:** otra vista, otra pose u otra versión del objeto.
- **Nada sobrepuesto:** las piezas no se tapan mal ni se pegan entre sí; lo que va adelante se separa con `sep`.
- **El mismo trazo y la misma luz:** luz arriba a la izquierda. El lápiz pone solo el tono claro en los bordes de arriba
  y de la izquierda de cada pieza y el oscuro en los de abajo y de la derecha; el contorno exterior de tinta lo agrega
  el juego (y la hoja). No pintes contornos a mano.
- **Una familia por set:** los mismos dos o tres tonos dominantes, el mismo encuadre y el mismo tratamiento en las 9.
- La lámina **llena el cuadro**: el lado largo ocupa 26–30 pixeles, centrada. La fila y la columna de afuera (0 y 31)
  van vacías.
- Tres tonos por material. Sin degradés, sin tramas y sin pixeles sueltos de ruido.
- Las piezas grandes van en tono base o claro. Los tonos oscuros son para sombra y detalle (una mancha grande oscura
  se pierde sobre el fondo oscuro de la interfaz). Una pieza muy clara (hueso) sobre el fondo claro de la carta se
  sostiene por el contorno de tinta: que tenga sombra adentro.

## Paleta
Rampas (claro · base · oscuro): `oro` Yyo · `brasa` Eef · `coral` Rrx · `menta` Mmn · `hoja` Llv · `cielo` Ssd ·
`indigo` Bba · `violeta` Vij · `hueso` Ppq · `piedra` Ggh · `madera` Ouz. Además `k` tinta, `K` sombra profunda (huecos,
bocas; usar poco) y `w` brillo puntual (1 a 3 pixeles, arriba a la izquierda).

Una rampa se pasa por nombre (`'oro'`), como tres caracteres propios (`'PpG'`, `'EEe'` para piel sin borde claro) o como
un solo carácter para pintar plano (`'r'`). `'.'` borra.

## El lápiz
Coordenadas: `x` hacia la derecha y `y` hacia abajo, de 0 a 31; se dibuja en 1..30. El dibujo de una lámina es una
función `(g) => { ... }`; lo que se pinta después tapa lo anterior.

```js
import { M } from '../lib.mjs';

g.rect(x, y, w, h, rampa, o)            // o.r redondea las esquinas
g.ellipse(cx, cy, rx, ry, rampa, o)     // radios con decimales: 4.5 da un diámetro de 10
g.ring(cx, cy, rx, ry, grosor, rampa, o)
g.poly([[x, y], ...], rampa, o)
g.line(x0, y0, x1, y1, rampa, o)        // o.w = grosor
g.curve([[x, y], ...], rampa, o)        // trazo suave que pasa por los puntos; o.w = grosor
g.px('k', [x, y], [x, y])               // pixeles sueltos
g.art(x, y, ['..kk..', 'kPPk'], o)      // pedazo a mano: ' ' no toca, '.' borra
g.fill(mascara, rampa, o)               // una pieza armada con varias formas y una sola luz
```

Una pieza hecha de varias formas se arma como máscara, para que la luz y la sombra la recorran entera y no queden
costuras: `M().rect(6, 11, 17, 6).ellipse(14, 16, 8.5, 8.5).cut.rect(0, 0, 32, 11)`. Después de `.cut` las formas restan;
`.add` vuelve a sumar. La máscara tiene `rect`, `ellipse`, `ring`, `poly`, `line(x0, y0, x1, y1, w)`, `curve(pts, w)`,
`set(x, y)` y `mask(otra)`.

Opciones `o` de cualquier forma:
- `tag: 'taza'` le pone nombre a la pieza · `in: 'taza'` (o una lista) pinta solo encima de esa pieza: franjas, dibujos,
  reflejos que no se salen.
- `on: true` solo sobre lo ya pintado · `behind: true` solo donde está vacío (queda detrás).
- `sep: true` deja una línea de tinta donde la pieza toca otra ya pintada (`sep: 'q'` usa ese tono, más suave).
- `flat: true` sin luz ni sombra · `lite: 2` / `shade: 2` ensanchan el borde claro o el oscuro (en piezas grandes y
  redondas, `shade: 2` da volumen); `0` los saca.
- `hi: [[x, y]]` brillos `w` encima.

`tools/finds.mjs` avisa si algo se sale del borde, si la lámina quedó chica, casi vacía o con pocos tonos.

## Cómo se trabaja un set
1. Leer `sets/princesas.mjs` (el set de referencia) y mirar su hoja.
2. Decidir la familia del set (tonos, encuadre) y anotarla en el comentario de arriba del archivo.
3. Dibujar las 9, generar, **mirar la hoja** y corregir. Tres vueltas como mínimo. En cada vuelta, por lámina:
   ¿se entiende a ×2?, ¿la silueta se distingue de las otras?, ¿en grises se separan las piezas?, ¿hay algo pegado,
   tapado o que parezca otra cosa (un cuello que parece barba, un vapor que parece orejas)?
4. Las que sigan flojas se replantean: otra vista u otro objeto que diga lo mismo, no más detalle encima.
