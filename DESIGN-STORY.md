# Pixelia · Historia: "El Quiebre"

Canon, actos, personajes, facciones, elementos y reglas de escritura. El plan completo está en
[docs/PLAN-QUIEBRE.md](docs/PLAN-QUIEBRE.md); el estado de cada paso, en [docs/HANDOFF-QUIEBRE.md](docs/HANDOFF-QUIEBRE.md).
Todo lo que sigue es borrador: el autor lo ajusta, y los textos viven en `src/story/story-data.js`.

## 1. El mundo
**Antes.** La tierra era un solo continente. Por dentro le corrían cuatro vetas:
- **Raíz** (tierra): sostiene y hace crecer.
- **Marea** (agua): ordena y arrastra.
- **Brasa** (fuego): forja y quema.
- **Céfiro** (aire): levanta y separa.

**El Quiebre.** Las Casas poderosas, que después serían los reinos, cavaron sin medida para acumular. Los de abajo
siguieron robando lo que quedaba para sobrevivir. Nadie paró. La tierra se vació por dentro y se partió:
- los pedazos con Céfiro subieron y hoy son las **islas flotantes**;
- lo demás quedó como el **Bajo Mundo**: volcanes de Brasa suelta, cavernas y aldeas de quienes no subieron.

No hay buenos puros: la avaricia de arriba y la persistencia de abajo rompieron lo mismo.

**Hoy.** Los elementos andan sueltos. Las **amenazas** de cada temporada (crecidas, incendios, tormentas, heladas) son el
elemento que se desborda: el sistema no cambia, pero queda atado al canon. Llegás a un fragmento en ruinas; la ciudad que
levantes es el refugio desde el que se sale a buscar respuestas.

## 2. Personajes
| Quién | Rol | Notas |
|---|---|---|
| **Vera, la cartógrafa** | Guía y voz del tutorial | La única que se quedó en la isla. Seca, práctica, con humor de barrio. Habla en los contactos y al cumplir el tutorial. Retrato 16×16 en `CHARACTERS.cartografa`. |
| **Tadeo Ibarra, el último intendente** | Voz del diario | No aparece: se lo lee. Firmó permisos para la Cofradía y lo cuenta. Las Páginas del diario son el coleccionable de la historia. |
| **El narrador** | Prólogo y momentos grandes | Sin retrato. Registro épico. |
| Tu personaje | Quien lidera | Elegido en el onboarding. Los elementos le dan habilidades de líder. |

## 3. Facciones (actos que siguen)
- **Piratas del cielo**: saquean desde dirigibles. Primer abordaje al cierre del Acto 1.
- **Los reinos**: las islas grandes de las Casas, con sus reyes.
- **La Cofradía de la Veta**: la mafia que trafica elementos entre los reinos y el Bajo Mundo.
- **Un traidor cercano**: se insinúa en la página 8 del diario ("no confíes en todo el que sonríe") y se revela en el Acto 4.

## 4. Actos
### Acto 1 · "Tu fragmento" (esta tanda)
Usa las cinco regiones actuales. Los capítulos se calculan solos (`ACTS` en `story-data.js`, `when(s)`): el último que se
cumple es el actual, y nunca vuelve atrás.

| # | Capítulo | Arranca cuando | Qué pasa (el detalle llega en el paso 6) |
|---|---|---|---|
| 1 | Lo que quedó | partida nueva | Prólogo: el Quiebre y la cartógrafa. Primeras casas y la base. |
| 2 | El Bosque del Arroyo | t4 (Casa de Expediciones) | Primer combate, de tutorial: los lobos de ojos brillantes. |
| 3 | Las Sierras Bajas | rango 2 | Desde las sierras se ve el borde y las luces del Bajo Mundo. |
| 4 | El agua que respira | rango 3 | Jefe del Bañado de los Juncos, despertado por la Marea suelta. |
| 5 | La mina sellada | rango 5 | En la mina vieja del Cerro del Hierro está el **Núcleo de Raíz**. |
| 6 | Los faros apagados | rango 6 | Reencender un faro de la costa: te volvés visible. |
| 7 | Velas en el cielo | `story.flags.faro` | Primer abordaje de piratas del cielo, jefe del acto. Gancho al Acto 2. |

**Decisión:** el plan ponía el Cerro antes que el Bañado; acá van en el orden en que se abren las regiones (el Bañado en
rango 3, el Cerro en rango 5), para que la historia no pida ir a un lugar todavía cerrado. Si se prefiere el orden del
plan, alcanza con cambiar los `when` y el rango de las regiones.

### Acto 2 · "Las islas vecinas"
Muelle de dirigibles, otras ciudades y la amenaza nueva "abordaje".

### Acto 3 · "El Bajo Mundo"
Bajar. Brasa y Marea. Las aldeas de los que no subieron, que no perdonan.

### Acto 4 · "Los reyes"
Las Casas, la Cofradía, la traición, Céfiro y el final.

## 5. Elementos
Cada uno da dos cosas (resuelve el pendiente de DESIGN-CORE §9):

| Elemento | Dónde | A la isla | A quien lidera |
|---|---|---|---|
| Raíz | la mina del Cerro (Acto 1) | resistencia a sequía y helada + Invernadero de Raíz | Enredar: frena y levanta una pared |
| Marea | el Bajo Mundo | menos daño por crecidas | Ola: empuja y apaga el fuego |
| Brasa | los volcanes de abajo | hornos más rápidos, menos daño por incendios | Ascua: quema el terreno |
| Céfiro | lo sabe alguien que no lo dice | la isla sube y se ve más lejos | Ráfaga: mueve a todo el grupo |

Se acreditan con `store.grant({ element: 'raiz' })` (emite `reward:element`; `story.js` lo anota en `state.story.elements`
y dispara el contacto de los elementos). Los efectos se aplican en el paso 6.

## 6. Páginas del diario
Ocho en el Acto 1 (`PAGES`). Se acreditan con `store.grant({ page: 'p3' })` o por su `trigger`:
p1 en el prólogo, p2 al explorar una zona del Bosque, p3 al subir a rango 2; el resto llega con el Acto 1 completo. Cada
página deja una pregunta abierta (los lobos, el bote de abajo, los permisos, el agua que respira, la galería sellada, el
faro, la llave).

## 7. Cómo funciona (código)
- `src/story/story-data.js`: personajes, actos, escenas, contactos, líneas de la cartógrafa (t1–t20), páginas, elementos
  y el Manual.
- `src/story/story.js`: `state.story = { v, seen, pages, elements, act, chapter, flags, read, veteran }` y
  `state.introSeen`. Disparadores por el bus (`unlock:<id>`, `built:<id>`, `rank:<n>`, `quest:<id>`, `zone:<región>`,
  `chapter:<id>`, `threat:announced`, `combat:first`, `element:first`, `story:city`, `story:veteran`). Cola de escenas
  que espera a la ciudad libre. **Cobro automático de t1–t20** con aviso y la línea de la cartógrafa.
- `src/story/story-ui.js`: hoja de diálogo (no bloquea), líneas sueltas y pantalla completa épica.
- `src/scenes/panels-story.js`: la Bitácora (J): Historia con "Qué sigue", Diario y Manual.
- Partidas viejas: reciben `state.story` sin subir la versión del guardado; lo que ya conocen queda visto y les llega un
  aviso corto que lleva al prólogo.

## 8. Guías del juego (lo esencial, sin guiar todo)
- Se guía cada sistema central **la primera vez que aparece**, con una sola hoja corta: los **siete primeros contactos**
  (la ciudad, la expedición, el combate, las amenazas, los elementos, el rango y las Épocas, el Taller). Cada uno sale una
  vez y queda para releer en la Bitácora.
- Lo demás se descubre jugando y queda en el **Manual**, por capítulos que se abren al llegar a cada sistema, con buscador.
- La **flecha guiada** señala lo que pide la misión actual (Construir, Expedición, la Huerta, el Taller, el rango, la
  amenaza, el cartel de terreno o la Bitácora) y se apaga cuando se abre lo que señalaba. Se apaga del todo en Ajustes →
  Juego → Pistas de la guía.

## 9. Reglas de escritura
- Rioplatense, sin diminutivos (Guía de tono de DESIGN.md).
- **La ciudad es cozy**: cálida, sobria, humor seco. **La historia puede ser épica**: el prólogo, los jefes, las
  revelaciones. Épico sin grandilocuencia: frases cortas, cosas concretas, nada de mayúsculas ni signos de más.
- Cada escena tiene de **1 a 4 líneas**, se puede saltear y **nunca bloquea** el juego. Las épicas van a pantalla
  completa y se saltean con Esc.
- La cartógrafa no explica botones: dice qué importa y por qué. El "cómo" está en la flecha y en el Manual.
- Nadie es bueno puro. Los de arriba cavaron; los de abajo robaron. El jugador hereda las dos cosas.
- Las preguntas abiertas se responden de a una, y cada respuesta abre otra.

## 10. Principios de diseño (plan §I)
- Cada decisión tiene un costo visible.
- Pocas reglas que se combinan.
- Ningún camino único gana siempre.
- Perder enseña: se ve por qué.
- Una partida corta siempre deja un avance.
- El ciclo se cierra: la historia pide explorar, explorar trae elementos y materiales, eso mejora la isla, la isla aguanta
  las amenazas y abre más historia.
