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

**Lo que nadie cuenta (giro final, L4).** El Quiebre no fue un accidente. Las Casas sabían que el continente se iba a
partir y, con los mapas de las vetas, cavaron justo donde estaba el Céfiro para que **sus** tierras subieran y el resto
quedara abajo. Quien guarda ese secreto desde entonces es el traidor. Se revela en el Acto 4; antes solo hay pistas.

**Hoy.** Los elementos andan sueltos. Las **amenazas** de cada temporada (crecidas, incendios, tormentas, heladas) son el
elemento que se desborda: el sistema no cambia, pero queda atado al canon. Llegás a un fragmento en ruinas; la ciudad que
levantes es el refugio desde el que se sale a buscar respuestas.

## 2. Personajes
| Quién | Rol | Notas |
|---|---|---|
| **Vera, la cartógrafa** | Guía y voz del tutorial | La única que se quedó en la isla. Seca, práctica, con humor de barrio. Habla en los contactos y al cumplir el tutorial. Retrato: un busto 3D de su `look` en `CHARACTERS.cartografa` (el 16×16 queda de respaldo). **Su culpa (L2):** antes del Quiebre dibujó los mapas de las vetas para las Casas y, sin saberlo, les mostró dónde cavar. Se quedó porque quiere arreglar algo ("Tengo algo que arreglar", prólogo). En el Acto 1 solo hay pistas (un eco, la página 5, un silencio cuando se habla de mapas); se revela en el Acto 2. Es la **pista falsa del traidor**: todo apunta a ella y no es ella. |
| **Tadeo Ibarra, el último intendente** | Voz del diario | No aparece: se lo lee. Firmó permisos para la Cofradía y lo cuenta. Las Páginas del diario son el coleccionable de la historia. |
| **El narrador** | Prólogo y momentos grandes | Sin retrato. Registro épico. |
| Tu personaje | Quien lidera | Elegido en el onboarding. Los elementos le dan habilidades de líder. |

### Pueblos (paso 4a)
Cada quien es de un pueblo (`AVATAR_TYPES` en `data.js`), con complexión recia o esbelta. Cómo se dibujan está en
[docs/ARTE-PERSONAJES.md](docs/ARTE-PERSONAJES.md); las medidas, en `PEOPLE` de `src/avatar/figure.js`.

| Pueblo | Veta | Quiénes son | Cómo se ven |
|---|---|---|---|
| **Humanos** | ninguna | De las islas y los reinos: soldados, cartógrafos, desertores. | ~3,8 cabezas, ceja recta y gesto serio. |
| **Enanos de la Veta** | Raíz | Mineros del Cerro. Las Casas los hicieron cavar y no se olvidan. | Anchos y bajos, cejas tupidas, barba que se funde con el torso. |
| **Anuros del Bañado** | Marea | Guardianes del agua. Hablan poco y no se apuran. | Achaparrados, ojos arriba, boca de lado a lado, manchas en el lomo. |
| **Gente-zorro del Céfiro** | Céfiro | Viven entre dirigibles y riscos: muchos piratas, algunos mensajeros. | Hocico en escalones, orejas grandes y cola. |
| **Orcos de la Brasa** | Brasa | De los volcanes del Bajo Mundo. Los que más perdieron con el Quiebre. | Torso enorme, cabeza chica y adelantada, ojos de brasa y colmillos. |
| *Vaciados* (no se eligen) | — | Gente a la que la veta le comió algo por dentro. Aparecen en la mina. | Grises y encorvados, una grieta de veta que les baja por el pecho y ojos que brillan. |

Los piratas del cielo son gente-zorro; el jefe de la Brasa, el gólem de Raíz, la bestia del Bañado, los lobos y los
bichos de veta son criaturas en low-poly (`src/combat/enemy-models.js`). Brígida, la herrera, es enana.

## 3. Facciones (actos que siguen)
- **Piratas del cielo**: saquean desde dirigibles. Primer abordaje al cierre del Acto 1.
- **Los reinos**: las islas grandes de las Casas, con sus reyes.
- **La Cofradía de la Veta**: la mafia que trafica elementos entre los reinos y el Bajo Mundo.
- **Un traidor cercano**: guarda el secreto del giro final (L4). **Propuesta:** sale de la gente que llegó a tu ciudad
  (L5), para que la traición duela. Pistas: los "permisos" de la página 4, "Céfiro: lo sabe alguien que no lo dice", las
  páginas 6 a 8 ("vive entre la gente, sonríe y no lo dice") y, en los actos 2 y 3, ecos y diálogos. Vera es la pista
  falsa. Se revela en el Acto 4.

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
| 5 | La mina sellada | rango 5 | En la mina vieja del Cerro del Hierro está el **Núcleo de Raíz**, con la primera elección de extracción (L1). |
| 6 | Los faros apagados | rango 6 | Reencender un faro de la costa: te volvés visible. |
| 7 | Velas en el cielo | `story.flags.faro` | Primer abordaje de piratas del cielo, jefe del acto. Gancho al Acto 2. |

**Decisión:** el plan ponía el Cerro antes que el Bañado; acá van en el orden en que se abren las regiones (el Bañado en
rango 3, el Cerro en rango 5), para que la historia no pida ir a un lugar todavía cerrado. Si se prefiere el orden del
plan, alcanza con cambiar los `when` y el rango de las regiones.

### Acto 2 · "Las islas vecinas"
Muelle de dirigibles, otras ciudades y la amenaza nueva "abordaje". Se revela la culpa de Vera (L2).

### Acto 3 · "El Bajo Mundo"
Bajar. Brasa y Marea. Las aldeas de los que no subieron, que no perdonan.

### Acto 4 · "Los reyes"
Las Casas, la Cofradía, la traición, Céfiro y el final. Se revela el giro (L4). El final cambia según la Grieta
acumulada (L1).

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

### Elegir cuánto sacar: la Grieta (L1)
Al encontrar un elemento (el Núcleo de Raíz en el Acto 1) se elige cuánto sacarle. Vos también podés repetir el Quiebre.

| Opción | Lo que da | Lo que cuesta |
|---|---|---|
| Sellar | un bonus chico | nada: la isla queda estable |
| Con medida | el bonus normal | poco |
| Exprimir | el doble de bonus | sube la **Grieta** |

- **La Grieta** (`state.world.grieta`, 0 a 100): las amenazas pegan más fuerte y llegan más seguido, la isla muestra
  grietas que brillan (J5) y la cartógrafa lo nota.
- Se repara, lento y caro, con obras de la Raíz; más adelante se puede volver a elegir en el mismo lugar. Ninguna decisión
  es para siempre.
- El final del Acto 4 cambia según la Grieta acumulada.
- Balance: `sim:economy` corre las tres opciones; a los 60 días ninguna saca más de un 15 % de ventaja neta contando las
  pérdidas por amenazas.

## 6. Páginas del diario
Ocho en el Acto 1 (`PAGES`). Se acreditan con `store.grant({ page: 'p3' })` o por su `trigger`:
p1 en el prólogo, p2 al explorar una zona del Bosque, p3 al subir a rango 2; el resto llega con el Acto 1 completo. Cada
página deja una pregunta abierta (los lobos, el bote de abajo, los permisos, el agua que respira, la galería sellada, el
faro, la llave). Las páginas 5 a 8 siembran L2 y L4 sin decirlo: p5, los mapas del archivo con "una letra prolija que no
era la mía" (Vera); p6, las Casas cavaban siguiendo una línea, siempre debajo de sus tierras; p7, "no todos los que
subieron lo hicieron por suerte"; p8, alguien que sabe por qué subieron "vive entre la gente, sonríe y no lo dice".

### Personas de la ciudad, Vínculo y herramientas (L5)
A medida que crece la población llegan personas con nombre (solo personas: J7). Cada una dice 2 líneas al llegar y trae un
dato del mundo. Tienen **Vínculo** de 1 a 5, que sube con sus encargos chicos (van a la cadena de misiones) y con la
historia; cada nivel abre un nivel de su **herramienta**, que mejora a la vez la ciudad, la expedición y el combate. Mejorar
la herramienta cuesta materiales de región y pasa por el Taller. Borrador (los nombres se pueden cambiar):

| Quién | Llega | Herramienta | Qué mejora |
|---|---|---|---|
| Vera, cartógrafa | desde el inicio | Catalejo | ve más lejos en la niebla y, con más niveles, qué hay en cada casilla; en combate muestra las intenciones de más enemigos |
| Brígida, herrera que escapó de un reino | rango 2 | Martillo | obras más baratas; las trampas de ingeniería pegan más |
| Nahuel, subió del Bajo Mundo colgado de una cuerda | Bosque explorado | Cuerda | atajos en la expedición; en combate trepa a lo alto (clave contra la bestia del Bañado) |
| Olga, curandera | rango 3 | Botiquín | más ánimo en la expedición; la sanidad cura más |
| Ramiro Ochoa, ex guardia de las Casas | rango 5 | Farol de guardia | más preparación contra las amenazas; en combate protege |

- **Nivel del líder** (1 a 30): sube con la experiencia de expediciones, combates y amenazas aguantadas. Cada nivel da un
  bonus chico; los clave abren espacios de habilidad, que salen de los elementos y del equipo.
- **Pestaña Progreso** de la Bitácora: rango y Época, nivel del líder, Vínculos y herramientas, elementos, Grieta y páginas,
  cada fila con lo que falta para el próximo nivel.
- Ninguna herramienta es obligatoria para ganar una pelea común. Las curvas van en DESIGN-CORE §8 y `sim:economy`.

### Ecos de noche (L6)
De noche (J3), en algunas ruinas de la ciudad y de la expedición aparecen siluetas vóxel traslúcidas que repiten de 5 a 8 s
un momento de antes del Quiebre. Al hacer clic dan una línea o una página; salen una sola vez y quedan en la Bitácora.
Misteriosos, no dan miedo. Algunos siembran L2 y L4 (por ejemplo, Vera joven dibujando un mapa para un señor de una Casa).

**Cuándo se hace:** 3b deja la noche y los lugares para los ecos; 5b hace L5; 6 hace L1 con el Núcleo de Raíz, las pistas
de L2 y L4 y los primeros ecos; 7 balancea L1 y L5.

**Base lista (3b, `src/core/ambience.js`):** la noche va de 20 a 6 (`isNightHour`; la ciudad emite `ambience:night`). Los
lugares salen de `cityEchoSpots(lado)` (tres puntos en el borde de la isla; `window.__pixelia.city.ambience.echoSpots()`)
y de `expEchoSpots(run)` (ruinas ya pisadas, solo de noche: `__exp.echoSpots()`). `ECHO_RULES` dice cuántos por lugar.

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
- Vera no habla de cómo se hicieron los mapas viejos: cuando sale el tema, cambia de tema o se calla (L2). Nada de lo que
  diga en el Acto 1 puede confirmar ni descartar su culpa.
- Ningún texto antes del Acto 4 dice que el Quiebre fue a propósito ni quién es el traidor: solo preguntas.
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
