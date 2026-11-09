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
| **Vera, la cartógrafa** | Guía y voz del tutorial | La única que se quedó en la isla. Seca, práctica, con humor de barrio. Habla en los contactos y al cumplir el tutorial. Retrato: un busto 3D de su `look` en `CHARACTERS.cartografa` (el 16×16 queda de respaldo). **Su culpa (L2):** antes del Quiebre dibujó los mapas de las vetas para las Casas y, sin saberlo, les mostró dónde cavar. Se quedó porque quiere arreglar algo ("tengo algo que arreglar acá", en la llegada). En el Acto 1 solo hay pistas (un eco, la página 5, un silencio cuando se habla de mapas); se revela en el Acto 2. Es la **pista falsa del traidor**: todo apunta a ella y no es ella. |
| **Tadeo Ibarra, el último intendente** | Voz del diario | No aparece: se lo lee. Firmó permisos para la Cofradía y lo cuenta. Las Páginas del diario son el coleccionable de la historia. |
| **El narrador** | La cinemática y los momentos grandes | Sin retrato. Registro épico. |
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

| # | Capítulo | Arranca cuando | Qué pasa |
|---|---|---|---|
| 1 | Lo que quedó | partida nueva | La cinemática El Quiebre y la llegada con Vera. Primeras casas y la base. |
| 2 | El Bosque del Arroyo | t4 (Casa de Expediciones) | Primer combate, de tutorial: los lobos de ojos brillantes (misión `q_combate`, E5). |
| 3 | Las Sierras Bajas | rango 2 | Desde las sierras se ve el borde y las luces del Bajo Mundo. |
| 4 | El agua que respira | rango 3 | La bestia del Bañado espera en **la poza honda**, al fondo de la salida normal (jefe, `q_bestia`). |
| 5 | La mina sellada | rango 5 | En la mina vieja del Cerro del Hierro está el **Núcleo de Raíz**, con la primera elección de extracción (L1, `q_nucleo`). |
| 6 | Los faros apagados | rango 6 | La salida normal a la Costa va al **faro viejo**; al volver queda encendido (`story.flags.faro`, `q_faro`). |
| 7 | Velas en el cielo | `story.flags.faro` | 15 minutos después llega el dirigible de la capitana: el **abordaje** se pelea en la ciudad (jefe del acto, `q_abordaje`). |
| 8 | Las islas te vieron | `story.flags.capitana_vencida` | Cierre: el mapa con el sello de la Cofradía y el gancho al Acto 2. |

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
y dispara el contacto de los elementos). Los efectos de la Raíz ya están (paso 6a, abajo).

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

**Estado (paso 6a, rama `claude/raiz-grieta-6a-4dd18b`, sin mergear):** hecho y probado (`tools/test-raiz.mjs`, 60 ✔).
- **Dónde está el Núcleo.** Desde el rango 5, la salida normal al Cerro del Hierro tiene como objetivo "la mina sellada"
  (`placeMine` en `src/expedition/expedition.js`; no toca `exp-data` ni `exp-rules`). Al volver con el objetivo cumplido,
  `foundNucleo` (`src/core/raiz.js`) acredita `element: 'raiz'` y abre la elección; en la ciudad sale la escena épica
  `nucleo_1` + `nucleo_2` (galería honda, página 6) y después la pantalla de elección (`src/story/raiz-ui.js`), que la
  primera vez no se cierra sin elegir.
- **Volver a elegir.** En Expedición, con el Cerro elegido, "Volver a la mina" (`setRevisit`) manda la próxima salida a la
  galería; al volver se reabre la elección (se puede cerrar sin cambiar). Subir la extracción suma su Grieta; bajarla no
  la cose.
- **La Grieta** (`state.world.grieta`, `state.world.raiz`, completados en `raizState` sin subir la versión): sube sola
  (`syncGrieta`, idempotente), pega en las amenazas (`grietaPower`, `grietaExtra`; `threats.js` guarda `g` en cada
  aviso), se ve en la isla (`src/scenes/city-grieta.js`: fisuras naranjas que bajan por el acantilado y entran en el pasto,
  laten más con más Grieta y de noche; `?grieta=N` para capturas) y Vera la nota a los 25, 50 y 75 (`grieta_*`). Se cose
  con la obra de Raíz en la ficha del Invernadero (12 h, cara y cada vez más cara).
- **Final del Acto 4:** `grietaLegacy()` devuelve la Grieta de hoy, el pico, la acumulada (Grieta × días), las obras y una
  lectura (`entera` ≤ 300, `remendada` ≤ 1.500, `partida`). El final lo escribe el Acto 4.
- **Efectos de la Raíz en la isla:** +0,1 de eficacia (fija desde el rebalanceo §8.z de DESIGN-CORE; antes × rinde) contra la sequía y la helada (`city.mods.eff` en
  `threat-rules`) y el **Invernadero de Raíz** (`data.js`, modelo en `src/city/models-raiz.js`: basalto, hierro negro,
  vidrio ahumado y una raíz con vetas que brillan; igual en todas las épocas). Da hierbas según la extracción.
- **Pistas del Acto 1:** p4 (abrir La mina sellada), p5 (zona del Bañado), p6 (el Núcleo), p7 (abrir Los faros apagados),
  p8 (zona de la Costa); `mina_camino` y `mina_mapas` (Vera habla de las marcas de agrimensor, se calla y cambia de
  tema: L2). Los ecos de noche (L6) quedan para cuando estén las siluetas del 4a.
- **Para integrar:** sumar `node test-raiz.mjs` al `npm test` y `"test:raiz": "node test-raiz.mjs"` en
  `tools/package.json`. Al mergear con el 4a (`state.js` v5) no hace falta tocar `defaultState`: los campos nuevos los
  arma `raizState`. Falta `npm run bump`.

**Estado (paso 6b, rama `claude/jefes-faro-6b`, sin mergear):** hecho y probado (`tools/test-act1.mjs`). Lógica en
`src/story/act1.js` (pura sobre `state`), ecos en `src/story/echoes.js` + `echo-fx.js`, la ciudad en
`src/scenes/city-act1.js` y los jefes low-poly en `src/combat/boss-models.js`.
- **La bestia del Bañado** espera en "la poza honda": una casilla `enemigo` con `boss: true` al fondo de la salida
  normal al Bañado (`placeBoss` en `expedition.js`, sobre casillas vacías), desde el rango 3 y hasta vencerla
  (`lairFor`). La salida emite `expedition:lair` y Vera avisa (`poza`: pelear en alto, no se la puede empujar). En el
  mapa se ve la poza negra con cuatro ojos. No se resuelve rápido.
- **Revancha:** `makeBattle` (`exp-rules.js`) arma la pelea de un jefe con `attempt = 1 + derrotas` (las de antes, que
  pasan en `mods.bossLosses`, y las de esa salida), hasta 3, como pide DESIGN-COMBAT §6. Perder la primera vez dispara
  `bestia_lost` / `abordaje_lost`; después, una línea suelta.
- **Ganarle a la bestia:** `bestia_1` + `bestia_2` a pantalla completa (la Madre del Agua de los Anuros: "no la matamos,
  la dormimos"), la página 9 (`reward.page` pasó de p3, que ya da el rango 2, a p9) y `flags.bestia_vencida`.
- **El faro viejo:** desde el rango 6, la salida normal a la Costa lo tiene de objetivo (`placeLugar`, la misma regla que la
  mina). Vera avisa antes (`faro_camino`, con otro "…" sobre los mapas: L2). Al volver con el objetivo cumplido,
  `lightFaro` pone `flags.faro`, emite `story:flag` (la luz de la isla sube) y `story:faro`: `faro_1` + `faro_2`
  (el haz, las luces que contestan, "ya saben que estamos"). En el mapa, torre de piedra con la linterna apagada.
- **El abordaje** (`state.story.abordaje = { at, arrived, tries, won }`): llega `ABORDAJE.delayMs` (15 min) después del
  faro. Al llegar, `abordaje_1` + `abordaje_2` a pantalla completa; en la ciudad queda el dirigible amarrado al borde,
  un botón arriba ("Abordaje: defendé el borde") y la tarjeta con quién defiende y qué pasa si se pierde. La pelea
  (`costa_capitana`) es en la ciudad: el líder y las 3 clases de nivel más alto (cansadas o no: es tu casa), los
  consumibles del depósito (se gastan solo si se usan), la hora y el clima de la isla. Sin "Reintentar" adentro
  (`noRetry`): la revancha se pide desde la tarjeta. **Decisión:** perder no cuesta nada guardado (tono cozy); los piratas
  siguen en el borde hasta que se los vence. Ganar: botín al depósito, página 8 (La llave), `flags.capitana_vencida`,
  `acto1_1`–`acto1_3` (el mapa con el sello de la Cofradía, "alguien les dijo dónde buscar" y el fin del Acto 1) y el
  capítulo 8, "Las islas te vieron". `?abordaje=1` trae el dirigible ya.
- **Los jefes en low-poly** (`bossModel(type, { phase })`, mismo contrato que `enemyModel`): la bestia (lomo de barro y
  musgo, juncos, cuatro ojos y vetas de Marea que en la fase 2 se encienden junto con la boca) y la capitana, gente-zorro
  del Céfiro (M2: saco rojo oscuro con dorado, tricornio con pluma, brazo de bronce con la pistola, sable que alza en la
  fase 2). Desde el 6c usan el kit facetado del 4a (`src/avatar/lowpoly.js`) y hay **una sola bestia**:
  `enemyModel('bestia')` devuelve la de `boss-models.js` (la low-poly duplicada de `enemy-models.js` se sacó).
- **E5** (cadena de `MAIN_QUESTS`, seguida por id): `q_combate` después de t5 (se cobra sola), `q_bestia` después de
  m21 (rango 4), `q_nucleo` después de m24 (rango 5), `q_faro` y `q_abordaje` después de m26 (rango 6). Tipos nuevos en
  `quests.js` (`combat` con `enc` opcional, `element`, `flag`), todos absolutos: una partida que ya lo hizo los cumple
  al llegar, sin migrar nada. Botones y pistas en `panels-common` y `panels-quests`; la flecha guía a Expedición.
- **Ecos de noche (L6):** cinco, de a uno y una sola vez (`state.story.echoes`). Ciudad: en el borde de la isla
  (`islandEdgeSpots`, un paso hacia adentro), solo de noche. Expedición: en una ruina ya pisada, de noche en el reloj de la
  salida. Clic: la línea en una tarjeta y, el de la mesa del archivo, la página 10. Se listan en el Diario de la
  Bitácora y tienen capítulo en el Manual. `?echo=1` los muestra de día (capturas). Para que se los encuentre sin que
  pierdan el misterio, el de la ciudad tiene una columna de luz tenue con motas (`beacon` de `createEcho`) y suena un
  vidrio bajo al aparecer (`sfx('echo')`). El primero lleva una marca ("Algo se mueve en el borde") que lleva la cámara
  hasta él, y con un eco a la vista la cámara puede llegar hasta el borde de la isla.

  | Eco | Dónde | Desde | Qué se ve | Siembra |
  |---|---|---|---|---|
  | Los que cavaban | ciudad | Bosque | dos mineros; uno para, el otro le devuelve la pala: "Una más" | el Quiebre |
  | Los que subieron | ciudad | Sierras | una familia sobre la tierra que sube; del otro lado alguien se queda abajo | el Quiebre |
  | La mesa del archivo | ciudad | Cerro | una muchacha dibuja un mapa; un señor de una Casa marca siempre el mismo punto (p10) | L2 |
  | Los permisos | expedición | Cerro | un hombre firma sin leer; otro deja una bolsa que suena a piedra | L4 |
  | El farero | expedición (Costa) | Costa | un farero apaga la lámpara mirando al cielo: le pagaron | L4 |

  Desde el 6c las figuras son la gente del 4a (`avatarModel`, con su pueblo: los mineros son enanos de la Veta) con un
  material fantasma celeste y traslúcido; si el modelo falla, queda la figura de bloques. Las herramientas (el pico) se
  cuelgan de `hands`, un grupo en la punta de cada brazo con la escala del eco.
- **Pruebas:** `tools/test-act1.mjs` (72 ✔; `--shots` deja 11 capturas en `shots/act1/`). Se adaptaron `test-raiz`
  (p8 sin disparador), `test-story` y `test-e2e` (la primera pelea entre t5 y t6). `sim:economy`: 22 ✔ · 0 ✘ (la
  Raíz sigue en 2,2 % de ventaja).
- **Para integrar:** sumar `node test-act1.mjs` al `npm test` y `"test:act1": "node test-act1.mjs"` en
  `tools/package.json`. (Hecho en la integración v39.)

**Estado (paso 6c, rama `claude/guia-ecos-6c`, sin mergear):**
- **E6, la primera expedición guiada** (`src/expedition/exp-guide.js`): la salida corta del tutorial (`TUTORIAL_SEED`)
  trae a Vera en un panel abajo a la derecha, con retrato y "Entendido", como la primera pelea. Siete pistas de un solo
  uso (`state.tutorial.expTips`): moverse y lo que cuesta, lo que se junta va a la carga, un imprevisto (retroceder es
  gratis), el paso sin vuelta (rojo), la bandera del objetivo, objetivo cumplido y cómo volver, la carga llena. Las que no
  salieron en la corta pueden salir en las dos primeras normales; nunca en la Expedición del día. Mientras va guiada, las
  pistas viejas de abajo (`tips` de `exp-scene`) no se repiten.
- **Ecos con las figuras del 4a** y **una sola bestia** (ver arriba).
- **El dirigible a la vista:** se amarra en el borde de adelante a la izquierda (abajo a la izquierda en pantalla, donde no
  hay tarjetas del HUD). Al abrir la tarjeta, la cámara vuela hasta ahí; mientras está amarrado, el tope de la cámara se
  corre 7 casillas (`act1.limitBonus` en el `limit` de `createCameraCtl`).
- **Pruebas:** `test-act1.mjs` suma E6, la bestia única, el dirigible sin nada encima y los ecos con avatar.

## 6. Páginas del diario
Diez en el Acto 1 (`PAGES`). Se acreditan con `store.grant({ page: 'p3' })` o por su `trigger`:
p1 en la llegada con Vera, p2 al explorar una zona del Bosque, p3 al subir a rango 2, p4 al abrir La mina sellada, p5 al explorar
una zona del Bañado, p6 con el Núcleo de Raíz, p7 al abrir Los faros apagados, p8 al ganar el abordaje (la capitana),
p9 al vencer a la bestia del Bañado (la Madre del Agua de los Anuros) y p10 con el eco de la mesa del archivo (L2). Cada
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

**Hecho en el paso 6b** (cinco ecos; ver el Estado del paso 6b en §5). **Cuándo se hace:** 3b deja la noche y los lugares para los ecos; 5b hace L5; 6 hace L1 con el Núcleo de Raíz, las pistas
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
- `src/story/story-ui.js`: hoja de diálogo (no bloquea), líneas sueltas y pantalla completa épica. Con `see` (la
  llegada) la pantalla completa deja ver la ciudad detrás y el texto va abajo.
- `src/scenes/intro.js`: la cinemática **El Quiebre** (plan §B y §M4), seis planos en vóxel de 7,5 a 9,5 s con un
  subtítulo de una línea cada uno (`INTRO_LINES`):
  1. el continente con las cuatro vetas latiendo en el corte;
  2. las torres de las Casas, con enanos de la Veta empujando vagonetas de cristal, una noble en el balcón y la veta que
     sube por la grúa;
  3. de noche, un humano, una persona-zorro y otro humano roban cristales y la guardia los persigue con faroles;
  4. la tierra se agrieta y se abre sobre la Brasa;
  5. desde abajo, orcos de la Brasa y un vaciado miran subir los pedazos con Céfiro entre las nubes;
  6. tu fragmento en ruinas al atardecer, un esquife que llega y el título.
  Es lo primero de una partida nueva (`main.js`: sin `onboarded` ni `introSeen`). Clic, Enter o Espacio pasan de plano;
  Esc o Saltar la terminan. Al terminar marca `introSeen` y sigue el onboarding. Se vuelve a ver desde la Bitácora
  (`story.playIntro()`, `{replay: 1, back: 'city'}`): ahí el esquife lo lleva tu personaje. `?scene=intro&shot=N` abre
  un plano (para capturas; `window.__pixelia.intro` tiene `go`, `seek`, `next` y `skip`).
- **La llegada** (`llegada`, reemplaza al prólogo de texto `prologo_1`/`prologo_2`): `playPrologue()` la pasa entre el
  nombre y el estilo de la ciudad. Cuatro líneas de Vera con un gancho y la página 1. Las partidas viejas reciben el
  aviso `veterano` con el botón "Ver El Quiebre".
- `src/scenes/panels-story.js`: la Bitácora (J): Historia con "Qué sigue", Diario y Manual.
- Partidas viejas: reciben `state.story` sin subir la versión del guardado; lo que ya conocen queda visto y les llega un
  aviso corto que lleva a la cinemática.

## 8. Guías del juego (lo esencial, sin guiar todo)
- Se guía cada sistema central **la primera vez que aparece**, con una sola hoja corta: los **siete primeros contactos**
  (la ciudad, la expedición, el combate, las amenazas, los elementos, el rango y las Épocas, el Taller). Cada uno sale una
  vez y queda para releer en la Bitácora.
- Lo demás se descubre jugando y queda en el **Manual**, por capítulos que se abren al llegar a cada sistema, con buscador.
- La **primera expedición** va con Vera (E6, `exp-guide.js`): siete pistas de un solo uso, en el momento en que sirven.
- La **flecha guiada** señala lo que pide la misión actual (Construir, Expedición, la Huerta, el Taller, el rango, la
  amenaza, el cartel de terreno o la Bitácora) y se apaga cuando se abre lo que señalaba. Se apaga del todo en Ajustes →
  Juego → Pistas de la guía.

## 9. Reglas de escritura
- Rioplatense, sin diminutivos (Guía de tono de DESIGN.md).
- **La ciudad es cozy**: cálida, sobria, humor seco. **La historia puede ser épica**: la cinemática, los jefes, las
  revelaciones. Épico sin grandilocuencia: frases cortas, cosas concretas, nada de mayúsculas ni signos de más.
- Cada escena tiene de **1 a 4 líneas**, se puede saltear y **nunca bloquea** el juego. Las épicas van a pantalla
  completa y se saltean con Esc.
- La cartógrafa no explica botones: dice qué importa y por qué. El "cómo" está en la flecha y en el Manual.
- Vera no habla de cómo se hicieron los mapas viejos: cuando sale el tema, cambia de tema o se calla (L2). Nada de lo que
  diga en el Acto 1 puede confirmar ni descartar su culpa.
- Ningún texto antes del Acto 4 dice que el Quiebre fue a propósito ni quién es el traidor: solo preguntas.
- Nadie es bueno puro. Los de arriba cavaron; los de abajo robaron. El jugador hereda las dos cosas.
- Las preguntas abiertas se responden de a una, y cada respuesta abre otra.
- **Que den ganas de leer** (plan §M4): cada línea tiene que empujar a la siguiente con una pregunta, una amenaza o
  algo personal. Si una línea se puede saltear sin perder nada, sobra.
- **Nada de explicar el lore de entrada.** La historia del mundo está en la cinemática (imágenes que se entienden
  solas), el diario y los ecos; los diálogos dan ganchos, no lecciones.
- **Se muestra, no se cuenta.** Si una imagen lo dice, el texto no lo repite.

## 10. Principios de diseño (plan §I)
- Cada decisión tiene un costo visible.
- Pocas reglas que se combinan.
- Ningún camino único gana siempre.
- Perder enseña: se ve por qué.
- Una partida corta siempre deja un avance.
- El ciclo se cierra: la historia pide explorar, explorar trae elementos y materiales, eso mejora la isla, la isla aguanta
  las amenazas y abre más historia.
