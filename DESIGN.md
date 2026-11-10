# Pixelia · Tu ciudad, tu estilo — documento de diseño y contratos

PWA (HTML + ES modules, **sin build**) para iPhone **y PC**. Juego de construir ciudad (estilo city-builder casual) donde la
ciudad es la base para salir de **expedición** y aguantar las **amenazas** de cada temporada. Los minijuegos se retiraron en la
Fase 5 (guardado v3); el ciclo nuevo (Expedición, Amenazas, Épocas, recursos, tutorial y migración) está en [DESIGN-CORE.md](DESIGN-CORE.md).
Estética: **3D vóxel nítido** (modelos de vóxeles dibujados a alta resolución con antialias, oclusión ambiental y contorno tinta) + **UI oscura** pixel art (pizarra y madera oscura, bordes de metal gastado, texto claro, acentos dorado y azul Dezings ; ver **Interfaz oscura**). Desde El Quiebre ([docs/PLAN-QUIEBRE.md](docs/PLAN-QUIEBRE.md) §J) el mundo es más oscuro y serio; la ciudad sigue siendo el refugio cálido.
Público: **adultos que juegan ratos cortos, en el celu y en la PC** (2 a 10 minutos, varias veces por día), solos o con su gente.
Neutro de género: cada quien elige su personaje y los textos no suponen quién juega. El tono es **refugio cálido, mundo
oscuro**: la aldea es la única luz en un mundo roto y la voz es sobria y seca (ver **Guía de tono**; el rumbo actual, juego de
PC de farmeo con Travesía por nodos, está en [docs/PLAN-FOTO.md](docs/PLAN-FOTO.md)). Tiene que ser **claro,
con decisiones que pesan y metas que se ven** (cada rato avanza algo, el progreso se nota de lejos), nunca frustrante
(sin energía artificial: el límite son las provisiones que produce tu ciudad, con una salida corta gratis por día; sin
muros de pago; las gemas se ganan jugando; nunca se pierde nada para siempre).
Idioma: **español rioplatense** (vos, tocá, construí). Nada de marcas o personajes de juegos existentes: todo original.

## Guía de tono
**Refugio cálido, mundo oscuro** (PLAN-FOTO, paso U1; reemplaza a "cozy adulto"). El mundo se partió y lo que quedó
afuera es frío, callado y peligroso. La aldea es la única luz: adentro hay fuego, pan y gente; afuera, no. Todo texto,
color y sonido responde a esa frontera. Ante la duda: ¿lo diría alguien que volvió de afuera, cansado, sin ganas de
adornar nada?

Vale para todo texto nuevo. Lo que ya está escrito y choca se lista en [docs/TONO-PENDIENTES.md](docs/TONO-PENDIENTES.md).

### La voz
- **Sobria y seca.** Frases cortas, hechos, números. Se dice lo que pasó y lo que cuesta; no se califica ni se
  festeja. "Volvieron tres", no "¡Qué gran salida!".
- **Español rioplatense** (vos, tocá, construí), sin lunfardo de postal ni chistes de barrio.
- **Sin diminutivos** en ningún sistema, botón, recurso ni nombre. Solo cuando son la palabra normal del objeto
  ("bombilla", "martillo").
- **Cálido por lo que se hace, no por lo que se dice.** El calor está en el fuego prendido, en que alguien guardó un
  plato, en que Vera espera en el muelle. Nunca en adjetivos ("lindo", "hermoso", "acogedor") ni en mimos.
- **El humor queda, pero es de trinchera:** seco, corto, de gente cansada. Una línea cada tanto, nunca en un cartel de
  interfaz. "El puente aguantó. El que lo hizo, no tanto."
- **La oscuridad no se explica ni se exagera.** Nada de "terrible", "maldito", "siniestro", "ancestral" ni mayúsculas
  de más. Se nombra lo que hay: "la veta les comió algo por dentro". Sin gore gratuito: la muerte se dice, no se describe.
- **Sin exclamaciones** en la interfaz. En diálogo, solo cuando alguien grita de verdad.
- **Neutro de género con sustantivos**, no con "@", "x" ni "e": gente, el grupo, contactos, quien lidera.
- **Ausencias sin culpa y sin relojes.** El juego no reclama ni apura: nada de "¡Te extrañamos!", "¡Apurate!" ni
  "Volvé en 2 h". Si pasó algo mientras no estabas, se informa: "Pasó la tormenta. Se salvó el 92 %".
- **Números a la vista:** "Cruzar el arroyo · 70 %", "Élite · Fuerza 140". Los textos de ayuda dicen qué hace algo,
  no lo venden.

### Palabras
| Usar | Evitar |
|---|---|
| aldea, refugio, adentro, el fuego, el cerco | ciudad feliz, barrio, pueblo lindo, hogar dulce hogar |
| afuera, la niebla, lo que quedó, lo de abajo | aventura, paseo, mundo mágico, tierras misteriosas |
| volver, aguantar, traer, alcanzar, quedar, faltar | disfrutar, divertirse, descubrir maravillas, coleccionar |
| botín, lo que se trajo, pieza, resto | premio, regalo, sorpresa, tesoro (salvo que sea un tesoro) |
| cayó, no volvió, quedó afuera | fue derrotado, se desmayó, "¡Oh, no!" |
| gente, el grupo, quien lidera | amigos, vecinitos, héroes, campeones |
| cobrar, guardar, seguir, zarpar | ¡Genial!, ¡Bien!, ¡Listo!, ¡Dale! |
| abrigo, calma, temple, oficio | felicidad, alegría, encanto, magia |
| nombres por lo que son y de dónde vienen (Bestia del Bañado, Hacha rara) | nombres tiernos, épicos de más o con adjetivo grande (Destructor Infernal) |

Giros que sirven: la frase partida en dos ("Esto es lo que quedó. Y ahora es tuyo."), el sujeto tácito ("Faltan
materiales"), el pasado simple para lo que ya no tiene arreglo ("Nadie paró"). Giros que no: preguntas retóricas,
segunda persona entusiasta ("¡Vas muy bien!"), primera del plural de empresa ("¡Te preparamos algo!").

### Antes y después
Textos reales de `src/i18n/es.js` (todavía sin cambiar; la lista completa está en `docs/TONO-PENDIENTES.md`):

| Clave | Antes | Después |
|---|---|---|
| `boot.tips` | Plantando árboles… · Regando las flores… · Horneando medialunas… · Afinando la calesita… | Encendiendo los faroles… · Revisando el mapa viejo… · Atando los botes… · Contando lo que quedó… |
| `ui.reward.title` / `ui.reward.ok` | ¡Bien! / Genial | Botín / Guardar |
| `hud.rank.ready` | ¡Ya podés subir a {rank}! | Rango {rank} disponible |
| `hud.quest.claim` | ¡Hacé clic para cobrar! | Cobrar |
| `hud.happy` y `hud.happy.tip` | Felicidad · "Árboles, plantas y deco la suben. Con la ciudad feliz todo produce hasta un 50 % más." | Abrigo · "Lo dan los árboles, los faroles y lo que se cuida. Con abrigo, todo rinde hasta un 50 % más." |
| `city.float.level` / `city.info.monDone` | ¡Nivel {n}! / ¡Monumento terminado! | Nivel {n} / Monumento terminado |
| `settings.gfx.particlesHelp` | Confeti, polvo y brillos. | Chispas, polvo y ceniza. |
| `arsenal.trait.botin.name` | Afortunada | Carroñera |
| `talents.sup_botin.name` / `talents.sup_animo.name` | Mochila llena / Buen ánimo | No se deja nada / Cabeza fría |
| `settings.acc.shareText` | Sumame en Pixelia. Mi código de amistad es {code} | Estoy en Pixelia. Mi código es {code} |

Ya están en tono y sirven de modelo: `boot.sub` ("Reconstruí lo que quedó"), todas las `intro.line.*`, las
`intro.label.*.line` ("roban para comer", "lo que no subió") y los textos de técnicas y rasgos ("+1 de coraza.").

### Quién habla y cómo
- **Narrador** (cinemáticas, prólogo, cierre de isla): pasado simple, frases de una sola idea, sin adjetivos grandes
  ni signos. Cuenta sin tomar partido: los de arriba y los de abajo tienen sus razones. "Nadie paró. Ni los de arriba
  ni los de abajo. Hasta que la tierra se partió."
- **Guías** (Vera y quienes se sumen; DESIGN-STORY.md): presente, práctico, pocas palabras. Dan una indicación y un
  motivo, no un tutorial con entusiasmo. Se permiten una línea de humor seco o de cuidado, nunca las dos juntas.
  "Despacio. El golpe fue fuerte." No dicen "¡Muy bien!"; a lo sumo, "Sirve".
- **Enemigos y jefes:** casi no hablan. Se los conoce por el nombre (qué son y de dónde: "Orcos de la Brasa", "Bestia
  del Bañado"), por una línea de cartel ("la veta les comió algo por dentro") y por lo que hacen en el tablero. Nada de
  monólogos de villano ni amenazas en mayúsculas. Los que hablan (las Casas, la Cofradía) son corteses y fríos: la
  amenaza está en lo que ofrecen. La intención de un enemigo se escribe como dato: "Carga en línea · 4 de daño".
- **Carteles de interfaz** (botones, avisos, ayudas): verbo en infinitivo o imperativo y número. Sin exclamaciones, sin
  emojis, sin "nosotros". Los errores dicen qué falta: "Faltan 3 de madera". Los títulos de resultado describen:
  "Volvieron todos", "Isla despejada", "Cayó el grupo".
- **Descripciones de botín:** el nombre es tipo, rareza y origen ("Hacha rara, afín a la Raíz"). Los rasgos son un
  nombre de una palabra y un efecto con número ("Templada · +1 de coraza"). Si lleva una línea de ambiente, es una sola,
  dice de quién fue o dónde estaba, y no promete poder: "Estaba clavada en la puerta de un depósito. Del lado de adentro."
- **La aldea** (vecinos, carteles de edificios): es el único lugar donde la voz afloja. Se habla de comida, de arreglos
  y del tiempo. Sigue sobria: alivio, no ternura. "Hay pan. Hoy alcanzó para todos."

### Premios y festejos
- **Sin confeti ni fanfarria.** Lo chico (cobrar, subir de nivel, un material) lleva un sonido y un número. Lo grande
  (jefe caído, pieza de reliquia, cambio de época, monumento) se marca con **luz**: un destello cálido, la cámara que se
  queda un segundo y un sonido grave. El silencio antes también cuenta.
- El botín raro se siente por el color de la rareza y el sonido, no por el texto. El cartel sigue diciendo "Hacha épica".

### Color
- **Cálidos solo adentro y en lo que da luz.** Ámbar, naranja de fuego y dorado son de la aldea y de las fuentes de
  luz: fogatas, faroles, ventanas, brasas, la forja, un campamento en la Travesía. Si algo es cálido, emite luz o está
  iluminado por algo que la emite.
- **Afuera, fríos y desaturados:** azules pizarra, verdes grises, pardos apagados, niebla. **Negros profundos**: la
  sombra llega a negro y la luz cae rápido (PLAN-FOTO, R1). Ningún color saturado en el terreno ni en la vegetación.
- **La aldea de noche es el plano modelo:** un grupo de ventanas ámbar en un cuadro casi negro.
- **Los elementos tienen su color pero apagado** afuera (Raíz verde musgo, Marea azul acero, Brasa rojo óxido, Céfiro
  gris claro) y solo se encienden cuando actúan: un golpe, una veta viva, una reacción.
- **El rojo saturado es peligro o sangre** y nada más: la casilla que marca el enemigo, la vida baja. No decora.
- **Interfaz:** paneles oscuros y neutros (ver **Interfaz oscura**). El dorado es el acento cálido y sigue la misma
  regla: marca lo que "da luz" en la pantalla (la acción principal, lo recién ganado, lo seleccionado). Los colores de
  rareza y de elemento son información, se usan en bordes y nombres, nunca en fondos enteros. El azul Dezings queda
  para la marca y los enlaces.
- **Los temas y trajes** no rompen la regla: afuera se ven con la luz de afuera.

### Idiomas y registro
- **Idiomas** (La Travesía 4a): el español rioplatense es el texto fuente, en `src/i18n/es.js`. Todo texto nuevo va por
  `t()` con su clave (`hud.zarpar`, `building.<id>.name`); nada de texto escrito en el código. Las traducciones siguen
  esta guía en su idioma: sobrio y seco, sin diminutivos ni infantilizar, y se traduce el sentido, no el voseo. La
  interfaz no fija anchos para el texto: botones, pestañas y tarjetas crecen o bajan de línea. Fuentes: Jersey 10 para
  el latín y Fusion Pixel 12px (OFL) para el cirílico y el CJK, recortada por `tools/subset-fonts.mjs`.
- **Registro épico** (El Quiebre, [DESIGN-STORY.md](DESIGN-STORY.md)): ya no es una excepción, es la misma voz con más
  peso. Frases cortas y concretas: "La tierra se vació por dentro y se partió", no "¡El cataclismo más terrible de la
  historia!".

### Reemplazos ya hechos (siguen valiendo)

| Antes | Ahora |
|---|---|
| regalitos | regalos |
| brillitos (moneda del álbum) | recortes |
| Amigas (pestaña y botón) | Contactos |
| niveles de amistad Conocidas → Amigas → Compinches → Íntimas → Inseparables | Saludo → Mate → Asado → Llave de casa → Familia |
| "¡Divino!" (combo de Joyas) | "Combo" |
| tema Dulce Pastel | Otoño (o Puerto) |
| Panadería Dulce, Café Gatito, Tienda Brillo | Panadería, Café, Tienda |
| Casita, Banquito, florcitas, pajaritos | Casa, Banco, flores, pájaros |
| figuritas / Álbum | Hallazgos |
| "¡Te extrañamos!" | "Mientras no estabas…" |
| tipo de personaje por defecto Chica, "animalitos" | Gente (desde la v4, solo personas: los animales se migran a una persona) |
| Vestidor, "boutique rosa" | Equipaje, la Sastrería (madera oscura, cuero y bronce) |
| Ciudad Moderna, Playa Tropical, Bosque, Invierno Nevado | Ceniza, Bruma, Musgo, Escarcha (más Ocaso) |
| Pollito Pío, Unicornia Mimosa, Autitos, Mascotas | Pato del Bañado, Ciervo Blanco, Vehículos, Fauna de la Isla |

## Estructura

```
index.html  styles.css  manifest.webmanifest  sw.js
vendor/three.min.js        (import * as THREE from 'three'  — vía importmap)
fonts/ icons/
src/main.js                arranque, router, ctx, endGame
src/core/                  NO MODIFICAR salvo el dueño del núcleo
  bus.js       eventos
  state.js     store: estado + guardado + monedas/xp/compras
  data.js      catálogos y balance (edificios, ropa, piezas del esquife, misiones, logros)
  economy.js   reglas de ciudad (construir, producir, mejorar, expandir, formatos)
  quests.js    misiones, diarias, logros, login
  ui.js        h(), modal, toast, rewardModal, floatText, flyCurrency, confetti, costHtml, progressHtml
  icons.js     icon(name,size) / iconUrl(name)
  audio.js     audio.sfx(name) / audio.music(name)
  voxel.js     Voxels, createPixelRenderer, addLights, setIsoCamera, makeBillboard, imageSprite, shade, disposeObject
  hud.js       HUD de la ciudad en 3 capas (Hoy · Temporada · Largo plazo; ≤ 14 controles, ≤ 4 globitos)
  unlocks.js   apertura escalonada de funciones (DESIGN-CORE.md §6.2)
src/city/models.js         modelos vóxel de edificios/naturaleza  (agente Modelos)
src/scenes/city.js         escena ciudad                          (agente Ciudad)
src/avatar/avatar*.js      modelo del personaje (todos los tipos)  (agente Avatar)
src/city/themes*.js        temas de ciudad + selector             (agente Ciudad)
src/scenes/onboarding.js   primera partida: personaje, nombre, ciudad, tema
src/avatar/skiff.js        modelo del esquife (car.js lo reexporta) (agente Avatar)
src/scenes/wardrobe.js     vestidor + esquife                     (agente Avatar)
src/scenes/panels.js       misiones, ajustes, login, nivel, obras    (agente Paneles)
src/expedition/            Expedición: exp-data, exp-gen, exp-rules, exp-scene, exp-ui, expedition (DESIGN-CORE.md §2)
src/threats/               Amenazas de temporada (DESIGN-CORE.md §3)
tools/smoke.mjs            prueba headless con capturas
```

> **Minijuegos retirados (Fase 5).** Joyas Brillantes, Bloques Pixel, Estacionamiento Express y Ruta Pixel se sacaron del
> código: sus edificios pasaron a Taller, Dispensario, Establo y Casa de Expediciones, los materiales a los de región, los
> potenciadores a equipo y el Álbum a **Hallazgos** (mismos ids). La migración del guardado (v3) está en `state.js` y en
> DESIGN-CORE.md §7.2. Quién toca qué archivo en cada fase: DESIGN-CORE.md §10.

Cada agente es dueño **solo** de sus archivos (puede crear archivos nuevos dentro de su carpeta con prefijo propio, p.ej. `src/expedition/exp-ui.js`). Si necesita un cambio en `src/core/*`, `main.js`, `styles.css` o `index.html`, **no lo hace**: lo reporta en `coreRequests`. Puede agregar CSS propio inyectando un `<style>` desde su módulo (con selectores prefijados por la clase de su escena, p.ej. `.scene-expedition ...`), y quitarlo en `unmount`.

## Contrato de escena

```js
// default export: fábrica que recibe ctx y devuelve la instancia
export default function create(ctx) {
  return {
    hud: false,            // false oculta el HUD de la ciudad (la expedición y el vestidor lo ocultan)
    music: 'game',         // 'city' | 'game' | 'calm' | 'expedition' | 'threat' | null
    async mount(container, params) {},  // container: div.scene-root.scene-<id> a pantalla completa
    unmount() {},          // liberar TODO: renderer.dispose(), listeners de window/document, timers, bus.on(...) (guardar el unsubscribe), estilos inyectados
  };
}
```
`ctx` = `{ store, state, bus, ui, audio, data, economy, quests, router, hud, home, expedition, threats, openPanel, chests, album, season, events, net, … }`
- `ctx.router.go(id, params)` — ids: `city`, `wardrobe`, `onboarding`, `home`, `expedition`.
- `ctx.openPanel(name, params)` → panels.js (`quests`, `settings`, `login`, `levelup`, `help`, `rank`, `works`, `expedition`, `workshop`).
- `ctx.router.go('expedition', { region, kind, resume })` — escena de la Expedición (DESIGN-CORE.md §2.11); no usa `endGame`.
- Imports directos permitidos: `import { store } from '../core/state.js'`, etc. Rutas relativas.

## Plataformas: iPhone y PC (obligatorio)
- Usar **Pointer Events** (`pointerdown/move/up`) para todo, funcionan con touch y mouse. `touch-action: none` en áreas de juego. Para arrastres usar `setPointerCapture`.
- **Teclado en PC**: Esc = salir/cancelar; en la expedición y los tableros el mouse alcanza.
- Layout: celular vertical (390×844 con notch: respetar `var(--safe-t)` / `var(--safe-b)`), PC apaisado (1366×800): centrar tableros con tamaño máximo, no estirar. iPad también.
- La ciudad en PC: rueda = zoom, arrastrar = mover cámara.
- Sin hover-only: todo debe funcionar con toques.
- Rendimiento: iPhone 12+ a 60fps. Reusar geometrías/materiales, nada de crear objetos por frame en loops calientes.

## Estilo visual
- Paleta única en `src/core/palette.js` (`PALETTE`, re-exportada por `data.js`) y variables CSS en `styles.css` (`--primary` terracota, `--second` azul pizarra, `--mint`, `--sky`, `--gold`, `--ink`...; clases `.btn.primary` / `.btn.second`). Contorno tinta café `#3d2f2a`. Nada de realeza: sin coronas, castillos ni princesas (la Municipalidad es el centro de la ciudad).
- 3D: usar SIEMPRE `createPixelRenderer` + `addLights` + `Voxels` de `voxel.js` (material compartido). 1 tile de ciudad = 1 unidad de mundo; edificios con **8 vóxeles por tile** (`scale: 1/8`).
- 2D (íconos, tableros): canvas a baja resolución con `image-rendering: pixelated`, sprites pixel-art dibujados por código, con "volumen" (claro arriba-izquierda, sombra abajo-derecha) para que combine con lo 3D.
- Fuente: `var(--font)` (Pixelify).
- **Íconos** (`icons.js`, grillas en `src/core/icons/*.js`, galería `tools/icons.html`): `icon(id, tamaño)` /
  `iconUrl(id)` con ids dibujados a mano (`coin`, `gem`, `expedition`, `journal`, `flood`, `el-raiz`, `rank3`…).
  Cada ícono tiene una grilla de **16×16** (HUD, botones) y otra de **24×24** (paneles, premios) con la paleta oscura de
  `icons/palette.js` (rampas claro · base · oscuro sacadas de los tokens); el contorno de tinta se agrega solo y se
  muestran con bloques enteros. Reglas de lectura, para cada ícono nuevo:
  - **silueta legible a 16 px en negro** (la galería tiene la prueba de silueta);
  - **prueba de grises**: las piezas se separan por valor, no solo por color;
  - **una idea por ícono**, sin escenas;
  - **nada de copiar el emoji equivalente**: la metáfora sale de este mundo (islas flotantes, vetas, esquife);
  - **el mismo trazo y la misma luz** en toda la familia: luz arriba a la izquierda, tres tonos por material, brillo
    de 1 a 3 pixeles; las piezas grandes en tonos base o claros, para que se lean sobre la interfaz oscura.
  Los emojis no se usan como íconos ni como texto: si un id no está dibujado, `drawEmoji` lo muestra como último
  recurso con un aviso en consola, y `tools/test-icons.mjs` (en `npm test`) falla. `icons/legacy.js` traduce los
  emojis de partidas y mensajes viejos. Teñir un ícono: `registerTint(id, base, { carácter: '#hex' })` (los cofres
  por rareza); canvases propios (miniaturas 3D): `registerIcon`.
  - **Láminas de Hallazgos** (`hz-…`, `icons/finds/`): 108 ilustraciones de **32×32**, una familia por set (mismos
    tonos y encuadre en las 9), con las mismas reglas de lectura medidas a tamaño real en la carta del álbum. Las grillas
    se generan con `tools/finds.mjs` desde los dibujos de `tools/finds/sets/` (lápiz con la luz automática,
    `tools/finds/README.md`): se corrige el dibujo, nunca la grilla. `test-icons` falla si no coinciden.
- Clases CSS listas: `.btn` (+ `.pink .lilac .mint .sky .gold .ghost .small .block`), `.icon-btn`, `.panel`, `.card` (+ `.locked .selected`), `.row .col .grid .grid.tight`, `.chip`, `.badge`, `.progress` (+ `.xp .pink .gold`), `.tabs .tab .tab.active`, `.swatches .swatch`, `.scroll`, `.game-bar` (+ `.game-stat` con `<small>` y `<b>`, `.game-title`, `.spacer`), `.game-bg`, `.game-bg.pattern`, `.game-help`.
- Feedback claro: sonido (`audio.sfx`), partículas, `ui.floatText`, `ui.flyCurrency`, rebotes. Confeti y fanfarria solo en los
  momentos grandes de la Guía de tono (cambio de época, monumento, amenaza superada, región completa).

## Interfaz oscura (El Quiebre, §J6)
Todo color de la interfaz sale de los tokens de `:root` en `styles.css`; las pantallas nuevas no ponen colores fijos.
- **Superficies**: `--page` (fondo), `--panel`/`--panel-2` (madera oscura), `--surface`/`--surface-2`/`--surface-hover`
  (pizarra), `--rule` (divisores), `--track` (rieles y barras vacías), `--wood`/`--wood-d` (cabecera de los modales, con
  el título en dorado).
- **Bordes y sombras**: `--edge` (contorno casi negro, como el contorno tinta del 3D), `--metal`/`--metal-l` (marco de
  metal gastado de los modales), `--shade` (sombra dura).
- **Texto**: `--ink` (claro), `--ink-l`, `--ink-ll` (secundario, AA sobre `--surface-2`), `--ink-dark` (sobre rellenos
  claros: dorado, menta, cielo).
- **Acentos**: cada color tiene base (relleno de botón), `-d` (sombra del botón), `-l` (fondo teñido oscuro) y `-t`
  (texto sobre oscuro). `--second` y `--accent` son el azul Dezings `#3d55b8`; `--gold` es el dorado.
- Los colores claros que vienen de datos (temporadas, rarezas, sets de Hallazgos) se oscurecen al usarlos con
  `color-mix(in srgb, <color> N%, #1d1916)`. Contraste mínimo AA (4,5:1 en texto chico, 3:1 en botones de 18 px en
  negrita).
- El 3D de las escenas de interfaz (Equipaje, onboarding) usa fondo `0x1d1916`; la Sastrería se re-mapea a madera, cuero
  y bronce con `tailor()` de `wardrobe-stage.js`.
- Las láminas de los Hallazgos (`album-art.js`) son ilustración y conservan sus colores.

## Ambiente: lugar, luz, día y noche, clima (El Quiebre, §J1–J5)
- **`src/core/ambience.js`** (puro, también corre en Node): `PLACES` (ciudad, expedición cerca / media / lejos, mina,
  faros, Bajo Mundo), `WEATHER` (despejado, nublado, lluvia, tormenta, niebla, nieve, ceniza y los de las amenazas: humo,
  helada, sequía), `resolveLook({ base, place, hour, weather, light, region })` → cielo, luces, saturación, tono, niebla,
  brillo de ventanas, partículas. Reloj de la ciudad `cityHour()` (20 min reales por día), `cityWeather()` (casi siempre
  lindo: es el refugio), `lightFor(state, rank)` y `initWorldLight` (main.js) para `state.world.light`.
- **`src/core/ambience-fx.js`** lo aplica a una escena: luces, cielo CSS (ciudad) o fondo (expedición), `r.setGrade` de
  `voxel.js` (saturación, tono y niebla por profundidad en el pase final, que queda aunque no haya contorno),
  `setNightGlow` (los vidrios van a su capa con `windowMaterial()`; `models.js` los separa al compilar), lluvia, nieve,
  ceniza, brasas y polvo (`graphics().particles`; nada con reducir movimiento) y relámpagos (`ambience:thunder` para el 3c).
- **Ciudad** (`src/scenes/city-ambience.js`): hora y clima del día, el clima de la amenaza en sus 48 h de señales
  (`decor.weather`, `THREAT_WEATHER`), humo de chimeneas (más al atardecer, de noche y con frío), la casa nueva prende la
  chimenea, la cosecha suelta hojas, la reparación limpia. Ajustes → Juego → "Día y noche en la ciudad".
- **Expedición** (`exp-ambience.js`; reglas en `exp-rules.js` `conditions`): se sale al alba (6:00) y cada paso es una hora;
  desde las 20 la visión baja 1 (el Farol la devuelve). Un frente de clima por salida a lo sumo, con su propia suerte (no
  cambia mapas ni peligros) y anunciado: tormenta (visión −1 y +1 provisión en colina, bañado y roca; la Lona lo evita), niebla y
  ceniza (visión −1), nieve (+1 en terreno difícil). Chip de hora y clima en la barra, aviso al cambiar, niebla y color según el anillo, polvo y huellas.
- **Para lo que viene**: el combate pide `combatConditions(cond)`; los ecos de noche (L6) usan `cityEchoSpots` /
  `expEchoSpots`, `ambience:night` y `__exp.echoSpots()`. Pruebas y capturas: `?hour=21.5` y `?weather=tormenta`.

## Personajes, temas y contorno
- **Personajes** (`data.js` → `AVATAR_TYPES`, paso 4a de El Quiebre): el tipo es el **pueblo** (humano, enano, anuro, gente-zorro, orco; los Vaciados no se eligen), con complexión recia o esbelta (`build`) y una cara (`face`: barbas, cicatrices, parche, pintura). Chica y chico pasan a humano esbelto y recio en el guardado v5 (`migrateV5`). Estilo **mezcla**: la gente en vóxel detallado a 1/48 (`src/avatar/figure.js` arma las piezas y `avatar.js` el modelo) y las criaturas en low-poly facetado (`lowpoly.js`). **Las reglas de arte (caras, proporciones, rampas de color y prueba en grises) están en [docs/ARTE-PERSONAJES.md](docs/ARTE-PERSONAJES.md)**; la galería para revisarlas es `tools/people.html`. La primera partida (`onboarding.js`) arranca con un pueblo al azar; después se cambia en el Equipaje o en Ajustes → "Cambiar personaje". Cada pieza de `CUSTOM_CATALOG` puede tener `types` y se filtra con `fitsType(item, type)` en tienda, cofres, Pase y subida de nivel.
- **Estilos de ciudad** (`city/themes.js`): Pueblo Acogedor (por defecto, sin re-mapeo), Otoño, Musgo, Ceniza (pizarra y brasas, ventanas encendidas), Bruma (la costa de los faros), Ocaso (ventanas encendidas), Escarcha y Luces de Noche (`dark: true`, aro claro bajo el personaje). Los ids viejos quedan como alias (`THEME_ALIASES`: pastel → otono, moderna → ceniza, playa → bruma, bosque → musgo, invierno → escarcha) y la v4 los cambia en el guardado. No hay modelos por tema: los colores de vóxel se re-mapean (`mapColor`; las reglas usan "ranuras": `pink` = terracota principal, `lilac` = azul pizarra) y cambian terreno, cielo, luces y naturaleza. Se guarda en `state.city.theme`, se elige gratis con `openThemePicker(ctx)` (botón paleta en la ciudad, Ajustes y onboarding), emite `city:theme` y se ve en las visitas.
- **Vóxel nítido** (desde nov 2026; antes el 3D se dibujaba a ~480 px y se agrandaba pixelado, y los bordes diagonales hacían serrucho): el "pixel" del arte es el **vóxel**, no el pixel de pantalla. `createPixelRenderer` dibuja a **2 pixeles de render por px CSS** (en PC es supersampleo 2×2; en celu, casi nativo) con **MSAA 4×** y el canvas al 100% suavizado (`.voxel-canvas`, nunca `pixelated`). Tope de 4,6 M pixeles de render; si los cuadros vienen lentos (<42 fps) baja solo a 1,5× y 1,2×. `settings.lowQuality` (o `?quality=low`) arranca en ≤1,5× sin MSAA; `?quality=high` apaga el ajuste automático (capturas).
- **Oclusión ambiental por vértice**: `Voxels.toGeometry` oscurece cada esquina según sus 3 vecinos (rincones, aleros, pie de las paredes) — es lo que da volumen y lectura. `{ ao: false }` la apaga. Pisos con variación en manchas de 2×2 y contraste bajo.
- **Contorno tinta**: `createPixelRenderer({ outline: true })` pinta ≈1 px CSS de tinta `#3b2340` por fuera de las siluetas (saltos de profundidad), con borde suavizado (`?outline=0|1` lo fuerza para comparar). Las miniaturas offscreen (edificios, personajes, temas, cofres) se dibujan a **3×** con antialias y `outlineCanvas(canvas, ancho)` de `voxel.js`; se muestran achicadas sin `pixelated`.
- **2D sigue siendo pixel art**: íconos de `icons.js` (grillas de 16 y 24 dibujadas a mano, bloques enteros), tableros de Joyas/Bloques, cielo de Ruta Pixel y burbujas `makeBillboard` conservan `pixelated`: la UI y los sprites son pixel art, el mundo 3D es vóxel nítido.

## Regla de modelos (PLAN-FOTO, paso M1)
Vale para todo modelo nuevo de la porción vertical: kits modulares en `.vox` de MagicaVoxel, ensamblados por código y
vistos con el render fotográfico (`createPixelRenderer({ photo: true })`). Los modelos hechos en código
(`src/city/models*.js`, 8 vóxeles por tile) siguen como están hasta que el kit los reemplace; no se mezclan las dos
densidades en una misma escena.

### Densidad
- **16 vóxeles por tile** (`scale: 1/16`) en todo el kit: terreno, módulos de edificio, árboles, utilería, enemigos comunes.
- **32 vóxeles por tile** (`scale: 1/32`) en las **piezas protagonistas**: las que la cámara de cine encuadra de cerca
  o las que el jugador mira durante minutos (ver la lista del kit).
- Nada intermedio ni mezclado en una pieza: una pieza es de 16 o de 32. Un módulo de 32 se apoya sobre uno de 16
  porque los dos miden en tiles.
- El volumen de luz tiene celdas de 1/8 de tile (dos vóxeles de 16, cuatro de 32): un detalle más fino que una celda
  se ve, pero no da sombra ni rebote propios. Lo que tiene que proyectar sombra (un alero, una viga, un brazo) mide al
  menos 2 vóxeles de 16 o 4 de 32.

### Escalas de referencia
1 tile = 1 unidad de mundo. Medidas en vóxeles de 16 (en una pieza de 32, el doble).

| Pieza | Alto | Ancho × fondo | Nota |
|---|---|---|---|
| Persona | 16 (1 tile) | 6 × 4 | Cabeza de 5 de alto: proporción de maqueta, no realista. La gente del juego ya mide ≈1 unidad (`avatar.js`) |
| Puerta | 20 | 10 de vano | La persona pasa con 4 de aire arriba |
| Ventana | 8 | 6 | Antepecho a 8 del piso: a la altura de los ojos |
| Piso de un edificio | 24 | — | De piso a cielorraso; el segundo piso arranca en 24 |
| Casa de Madera | 40 a la cumbrera | 32 × 32 (2 × 2 tiles) | Pared de 24 y techo a dos aguas de 16 |
| Árbol | 40 a 56 | copa de 24 a 32 | Siempre más alto que una casa: el bosque tapa |
| Arbusto, roca chica | 6 a 10 | 8 a 12 | No tapa a una persona |
| Farol | 24 | 4 | La luz queda arriba de la cabeza |
| Enemigo común | 12 a 20 | hasta 16 × 16 | Entra en una casilla del tablero |
| La Bestia | 40 a 48 | 32 × 48 (2 × 3 tiles) | Tres personas de alto |

Regla de proporción: **una persona al lado de cualquier pieza tiene que dar la escala a simple vista**. Cada pieza
nueva se captura con una persona parada al lado en `tools/lookdev.html`.

### Paleta
Sigue la sección **Color** de la Guía de tono; acá va lo que cambia al modelar.
- **Cálidos solo en la aldea y en lo que da luz.** Ámbar, naranja y dorado se usan en vóxeles emisivos (ventana
  encendida, brasa, farol, veta viva) y en los materiales de la aldea que esa luz toca (madera, paja, tela, pan).
  Fuera del cerco, ningún vóxel cálido que no emita.
- **Afuera, fríos y desaturados:** saturación HSV de 35 % como máximo en terreno, vegetación, roca y ruinas. Verdes
  hacia el gris azulado, pardos hacia el gris. Los enemigos, lo mismo; su elemento es un acento chico (ojos, veta,
  lomo) que se enciende al actuar.
- **Tonos por material: 3** (claro, base, oscuro). **4 en piezas protagonistas** (se suma un medio tono). Un modelo
  usa 5 materiales como máximo: 15 colores, 20 en protagonistas. Si hace falta otro tono, sobra un material.
- **Sin sombrear hacia negro.** El tono oscuro de un material baja el valor un 25 a 30 % y corre el matiz hacia el
  azul; nunca por debajo de 12 % de valor. El negro lo pone el render (sombra y oclusión): si el modelo ya viene
  oscuro, la luz no tiene de dónde agarrarse. Tampoco blanco puro: 90 % de valor como máximo.
- **Sin luz pintada.** Nada de degradés de arriba hacia abajo, sombras bajo los aleros ni brillos dibujados: el
  motor calcula sol, oclusión y rebote. Los tres tonos son para **variar el material** (tablas distintas, vetas,
  desgaste), no para simular luz.
- **Rojo saturado:** solo sangre o peligro. Ninguna flor, bandera ni techo rojo.
- **Prueba de grises:** la captura en blanco y negro tiene que separar las piezas por valor.

### Forma
- **Silueta primero.** La pieza se reconoce en negro pleno, a la distancia de juego (cámara isométrica) y a 64 px de
  alto. Si dos piezas del kit se confunden en silueta, una se rehace.
- **Nada de ruido al azar.** Ni vóxeles sueltos de otro tono salpicados ni superficies "picadas". La variación va en
  **grupos con sentido**: una tabla entera más clara, una hilada de piedras, una mancha de musgo de 3 × 2 en la base.
  El motor ya mueve un poco cada vóxel (`jitter`); a mano no se agrega más.
- **Detalle donde mira la cámara.** El frente (+Z) y la cara de arriba llevan el trabajo; el fondo y lo que queda
  bajo el alero, planos. En piezas de aldea, el detalle se concentra entre 8 y 24 de alto (la franja de la persona).
- **Biseles de 1 vóxel** en esquinas de pilares, bordes de techo, zócalos y dinteles: rompen el cubo y agarran luz.
  No en todo: una pared lisa con marco biselado se lee mejor que una pared toda trabajada.
- **Espesores reales:** pared de 2, techo de 2 con alero de 2 a 3, viga de 2 × 2, tabla de 1. Nada de láminas de 1
  vóxel en paredes: el volumen de luz las atraviesa.
- **Macizo por dentro.** Los modelos no son cáscaras huecas: el relleno evita fugas de luz y el mallado une las caras.
  Hueco solo donde la cámara entra (un interior).
- **Asimetría chica.** Un poste torcido, una teja que falta, un lado más gastado. Una por pieza, no cinco.
- **Módulos que encastran:** las piezas modulares miden múltiplos de 8 vóxeles en planta y sus bordes de unión son
  planos, sin detalle que sobresalga.

### Materiales del motor
El lector (`src/core/vox-loader.js`) saca del `.vox` un material por índice de paleta: `{ emissive, metal, glass,
water, rough }`. El motor (`r.light.kindOf(material)` en `src/core/voxel-light.js`) lo pasa a uno de seis tipos:

| Tipo | En MagicaVoxel (pestaña Matter) | Qué hace | Para qué |
|---|---|---|---|
| `solid` | Diffuse (por defecto) | Luz de sol con sombra, oclusión y rebote | Casi todo |
| `glow` | Emit (`emissive` = emit × 2^flux) | Emite al volumen de luz y da halo | Brasas, llama, veta viva, ojos |
| `metal` | Metal con metal > 0,5 y roughness < 0,7 | Refleja la escena y el cielo, brillo del sol | Herrajes, filos, campana |
| `glass` | Glass | Refleja con Fresnel | Frascos, vidrio apagado |
| `water` | Glass con IOR 1,33 | Reflejo, ondas por vóxel y luz propia; no entra al volumen | Arroyo, charcos, bañado |
| `window` | No sale del archivo: lo asigna el código | Se prende de noche (cálido) y de día refleja | Ventanas de la aldea |

- Hoy cada tipo es **una malla aparte** (`vox.split`), así que un modelo usa `solid` y, como mucho, dos tipos más.
- `rough` solo decide si un metal refleja; no hay rugosidad continua ni mapa de normales. Un metal gastado (roughness
  ≥ 0,7) se dibuja como `solid`.
- Los reflejos leen el volumen a 1/8 de tile: son manchas de color, no espejos. No diseñar nada que dependa de un
  reflejo nítido.
- La fuerza de lo emisivo se regula en el archivo (emit y flux), no con un color más claro. Emisivos chicos y pocos:
  una ventana, una brasa. Un modelo entero emisivo aplana la escena.
- Para marcar un material sin abrir MagicaVoxel: `loadVox(url, { materials: { índice: { water: true } } })`.

**Índices reservados de la paleta** (iguales en todos los archivos, así el código no adivina):

| Índice | Uso |
|---|---|
| 1 a 240 | Colores `solid` del modelo |
| 241 a 244 | `glow`: llama, brasa, veta fría, veta cálida |
| 245 | `window` (el código lo pasa a ventana) |
| 246 | `water` |
| 247 | `glass` |
| 248 a 250 | `metal`: hierro, bronce, acero |
| 251 a 255 | Libres |

### Archivos `.vox`
- **Carpeta:** `assets/models/`, con una subcarpeta por kit: `madera/`, `bosque/`, `enemigos/`, `jefes/`,
  `quiebre/`, `comun/`. El archivo de trabajo con varias piezas juntas no va al repo; se exporta una pieza por archivo.
- **Nombre:** `<pieza>[-<variante>][-<parte>].vox`, en minúsculas, sin acentos ni espacios, con guiones. Variantes con
  letra (`pared-a`, `pared-b`); partes animables con nombre (`bestia-cabeza`, `bestia-cola`). Ejemplos:
  `madera/pared-ventana-a.vox`, `bosque/arbol-alto-b.vox`, `enemigos/jabali.vox`.
- **Orientación:** en MagicaVoxel z es arriba y **el frente mira a −y** (hacia la cámara por defecto). El lector lo
  gira a y arriba y frente a **+Z**, que es el frente de todos los modelos del juego. No se espeja.
- **Pivote:** el lector lleva la esquina mínima a (0, 0, 0) y la base a y = 0; el código centra con
  `toMesh({ center: 'xz' })`. Entonces: **la pieza se apoya en el piso del archivo y su caja es su huella**. Un
  módulo de 1 × 1 tile ocupa 16 × 16 en planta aunque el dibujo no llegue al borde (un vóxel de esquina en la capa de
  base fija la caja). Una parte animable gira alrededor del centro de su caja en la base; si necesita otro eje (una
  mandíbula, una puerta), se anota en la tabla del kit en código.
- **Tamaño máximo:** 126 por lado y por archivo. Módulo de kit: hasta 32 × 32 en planta y 64 de alto. Pieza
  protagonista: hasta 126 × 126 × 126; si no entra, se parte en partes.
- **Un modelo por archivo**, sin escena con varios objetos salvo que sean partes de la misma pieza ya ubicadas.
- **Paleta:** la del archivo, con los índices reservados de arriba. Los colores que no se usan se borran.
- **Revisión:** cada pieza nueva pasa por `npm run test:vox` y por una captura en `tools/lookdev.html` a las 15 h y
  a las 22.5 h, con una persona al lado.

### Kit de la porción vertical
**P** = protagonista: 32 vóxeles por tile, hecha a mano por una persona en MagicaVoxel. El resto, 16 vóxeles por
tile, lo hace Claude con revisión por capturas. Hoja de referencias en `docs/ref/`.

**Aldea, época Madera** (`madera/`)

| Pieza | Variantes | |
|---|---|---|
| Pared lisa, pared con ventana, pared con puerta, esquina | 2 de cada una | |
| Techo a dos aguas: tramo, remate, cumbrera, alero; chimenea | 2 de tramo | |
| Piso de tablas, escalón, zócalo de piedra | 1 | |
| Cerco: tramo, poste, portón | 1 | |
| Casa armada con el kit (prueba de encastre) | 2 | |
| **Municipalidad de Madera** (el centro de la aldea) | 1 | **P** |
| **Fogón central** (la luz del plano modelo de noche) | 1 | **P** |
| **Muelle y esquife amarrado** (de donde se zarpa) | 1 | **P** |
| Taller, depósito y panadería: fachada propia sobre el kit | 1 de cada uno | |
| Farol de poste, farol de pared | 1 | |
| Utilería: barril, cajón, leñera, carro, banco, tendedero, pozo | 1 de cada uno | |

**Isla: Bosque del Arroyo** (`bosque/`)

| Pieza | Variantes | |
|---|---|---|
| Terreno: pasto, tierra, barro, roca, orilla, borde de isla (acantilado) | 2 de cada uno | |
| Arroyo: tramo recto, curva, vado, cascada chica | 1 | |
| Árbol alto, árbol joven, pino, tronco caído, tocón | 3, 2, 2, 1, 1 | |
| Matorral (cobertura del tablero), helechos, juncos, hongos | 2 de cada uno | |
| Roca grande (bloquea), roca rompible, piedras sueltas | 2, 1, 1 | |
| Ruinas: muro roto, arco, columna caída, losa | 2, 1, 1, 1 | |
| Veta: afloramiento apagado y vivo (emisivo) | 1 de cada uno | |
| Puente de troncos, pasarela, cartel viejo | 1 | |
| **Árbol viejo del claro** (hito de la isla, fondo de las peleas) | 1 | **P** |
| **Campamento de la Travesía** (carpa, fogata; la única luz cálida de afuera) | 1 | **P** |
| **Altar de la veta** (evento y decisión de historia) | 1 | **P** |
| Nodos del mapa: marca de pelea, élite, evento, campamento, jefe | 1 de cada uno | |

**Enemigos** (`enemigos/`; uno por archivo, con partes si se animan)

| Pieza | |
|---|---|
| Lobo de ojos brillantes, Hondero del monte, Guardián de corteza, Nido de larvas, Larva, Jabalí de colmillo, Hongo hinchado, Musgo viejo, Ascua errante, Sapo de marea, Cuervo de céfiro, Bicho de veta | |
| **Lobo viejo** (élite: La manada del lobo viejo) | **P** |
| **La colmena** (élite: el nido grande y su entorno) | **P** |

**Jefe** (`jefes/`)

| Pieza | |
|---|---|
| **Bestia del Bañado**: cuerpo, cabeza, mandíbula, patas y cola como partes (hoy en código, `src/combat/boss-models.js`) | **P** |
| **Arena del Bañado**: agua baja, juncal, islotes | **P** |

**El Quiebre y la llegada** (`quiebre/`)

| Pieza | |
|---|---|
| Decorados de fondo: borde partido, puente cortado, casas caídas | |
| **La grieta con la veta a la vista** (plano central de la cinemática) | **P** |
| **El esquife en vuelo** (llegada) | **P** |

**Gente:** el personaje, Vera y los vecinos siguen con el sistema de piezas a 1/48 de `src/avatar/figure.js`
(reglas en [docs/ARTE-PERSONAJES.md](docs/ARTE-PERSONAJES.md)); no pasan a `.vox` en la porción.

Total: unas 95 piezas de kit y **12 protagonistas**. Orden sugerido para las de mano: Bestia, fogón, árbol viejo,
Municipalidad, muelle y esquife; el resto después de la segunda prueba con jugadores.

## Sonidos disponibles
`audio.sfx(name)`: tap, open, close, coin, gem, build, place, done, levelup, error, match, combo(n), pop, clear, swoosh, star, win, lose, horn, crash, bump, select, buy.
`audio.music(name)`: city, game, drive, calm, null. (El router pone la música de la escena según `music`.)

## Estado (store.state) — ver `defaultState()` en state.js
- `coins, gems, player{name,cityName,level,xp}`
- `onboarded`, `avatar{type, skin(index), hair, hairColor(id), dress, dressColor(id), crown, acc}` (`state.princess` = alias viejo, no enumerable), `avatarLooks{[type]: look}`, `city.theme`; `car{body, color(id de OUTFIT_COLORS), wheels, topper}`; `owned{hair:[],dress:[],...}`
- `city{buildings:[{uid,id,x,z,rot,level,buildEnd,upgradeEnd,lastCollect}], nextUid, expansions, flagColor, camera, rankPerks{builders}}` (`rankPerks`: constructoras ya regaladas por rango, para no darlas dos veces)
- `materials{madera, piedra, mineral, hierbas}`: materiales de región (expedición; monumentos, obras, equipo). Ver DESIGN-CORE.md §5.
- `achievements{id: ms}`: Logros cumplidos (`src/core/achievements.js`; se ven al final del Diario de la Bitácora) · `city.charmBonus`: Encanto fijo que dejó Mi Casa al irse (guardado v6) · `v6{had, coins, gems, mats, charm, charmBonus, shown}`: lo que hizo la migración v6 (el aviso «Mi Casa cerró sus puertas» sale una vez). Mi Casa (`home{…}`, edificio `mi_casa`) se retiró en el paso 1c de La Travesía.
- `games{…}`: solo en partidas de antes de la v3 (progreso de los minijuegos retirados, guardado y sin uso) · `v3{gems, finds, conv, refund, placeExp, shown}`: lo que hizo la migración v3 (el aviso "Los minijuegos se retiraron" sale una vez).
- `stats{}` (usar `store.inc(key,n)` / `store.setMax`): `match3Wins`, `blocksLines`, `parkingWins`, `drivingMeters`, `rankBest`, `charmBest` alimentan logros; `matsEarned` cuenta materiales ganados.
- `tutorial{}` flags libres. `settings{music,sfx,lowQuality}`.
- Mutar estado solo vía store/economy cuando exista función; si se toca a mano, llamar `store.markDirty()`.

## Eventos (bus)
`currency:changed, coins:earned, gems:earned, xp:changed, level:up{level,reward}, building:placed{b}, building:built{b}, building:upgradeStarted{b}, building:upgraded{b,level}, building:moved{b}, building:removed{b}, production:collected{b,amount,currency}, city:expanded, builders:changed, minigame:finished{game,score,stars,won}, customize:changed, item:bought, quests:changed, scene:changed{id}, stats:changed, hud:build{focus?}, city:flag{color,hex}, town:rankup{rank,def,era,eraChanged}, era:changed{era,from}, building:renovated{b,era,from}, city:focus{uid}, city:place{id}, city:placing{active}, materials:changed{materials,delta,reason}, achievement:new{ids}` (`hud:build` lo emite el botón Construir del HUD; la ciudad abre el menú; `focus` = id de edificio a resaltar. `town:rankup` sale al terminar la mejora de la Municipalidad: la ciudad abre el panel `rank` en modo festejo. `city:focus` abre la ficha de un edificio desde otro panel; `city:place` arranca la colocación de un edificio (lo usa el panel de Obras); `city:placing {active:false}` sale al terminar de colocar: las subidas de nivel ganadas mientras tanto se muestran recién ahí, para no tapar la barra de Colocar).

## API de modelos (contratos entre agentes)

### src/city/models.js (agente Modelos)
```js
export const VOXELS_PER_TILE = 8;
export function buildingModel(id, level = 1, opts = {}) // -> THREE.Group
```
- Origen: **centro del footprint, base en y=0**. Ocupa `size[0]` tiles en X y `size[1]` en Z (rot 0). El frente (puerta) mira a **+Z**. La ciudad rota el grupo `rot * 90°` alrededor de Y.
- `group.userData.height` = altura en unidades de mundo (para ubicar burbujas arriba).
- `group.userData.update?.(dt, t)` animaciones opcionales (agua de la fuente, rueda girando, banderas, humo de chimenea, patitos). La ciudad llama esto cada frame.
- Mayor `level` = más detalle visible (piso extra, adornos dorados, banderas, flores). Cada mejora tiene que **notarse de lejos**.
  Cada nivel cambia la estructura y cada época el material y la paleta (`b.era`, `eraWall/eraRoof/...`, `def.eraArt`;
  DESIGN-CORE.md §4). Con arte por época (Fase 4, terminada): Municipalidad (`models-town.js`), casas (`eraHouse`),
  negocios (`models-shops.js`, `models-shops3.js`), edificios del ciclo (`models-cycle.js`), defensas
  (`models-defense.js`, usa `cycleBody` y `eraTower` de `models-cycle.js`), deco y caminos (`models-deco.js`, materiales
  en `DS[era]`) y la base de los monumentos (`eraBase` en `models-monuments.js`).
  Deco, caminos y monumentos no se renuevan: la escena les pasa la época de la ciudad (`drawEra` en `city.js`;
  en las visitas, la del rango del dueño). Árbol, arbusto, cerezo y unicornio valen 1 siempre (comparten caché).
  `upgradeDressing` ya no existe; el respaldo (`eraRecolor`) queda para los especiales de minijuego.
  `eraWall` arma volúmenes macizos (una cáscara hueca duplicaría los triángulos). El arte por época no pasa por
  `calmColors`: sus juntas e hiladas son a propósito.
- Municipalidad (id `castillo`): 8 niveles, uno por rango (`TOWN_RANKS[].look` dice qué estrena: pórtico, alas, fuentes, cúpula
  dorada, techo azul con torrecitas, mirador con alfombra roja, arco dorado con fuegos artificiales). `buildingModel` admite nivel 8 solo para ella.
- Monumentos (`cat:'monumento'`, `models-monuments.js`): un modelo por etapa. Cada builder dibuja el monumento **terminado**;
  `staged` lo recorta a la altura de la etapa (≈10% / 35% / 60%…) y le suma andamio al frente y a la derecha, lona, grúa con el
  material colgando, pilas de los materiales que usa, cinta y un cartel con una pelotita por etapa (doradas las hechas).
  Terminado: borde dorado, brillitos y lo animado (haz del Faro, telescopio, agujas y campana de la Torre, banderas).
  Ojo: la capa y=0 del lote queda tapada por la base del lote en la ciudad; los detalles del piso van en y≥1.
- Caminos (`cat:'camino'`): baldosa plana de 1 vóxel de alto que cubre el tile entero.
- Cachear geometrías por `id+level` (clonar el grupo / reusar geometry).
```js
export function constructionModel(w, d)    // andamio + cinta + cajas para obra/mejora, origen centro, base y=0
export function natureModel(kind, seed)     // 'tree' | 'pine' | 'bush' | 'rock' | 'flowers' | 'mushroom' — decoración fuera del terreno
export function cloudModel(seed)            // nube vóxel (sin sombra)
export function thumbnail(id, level = 1, era = 1, theme) // -> Promise<dataURL> ícono del edificio (render offscreen, cacheado). También (id, level, theme, era).
```

### src/avatar/avatar.js (agente Avatar)
```js
export function avatarModel(look, opts = {}) // -> THREE.Group, altura total ≈ 1 unidad, mira a +Z, base en y=0
// group.userData.update(dt, moving:boolean)   — caminar (piernas/brazos/rebote) o idle (respira, parpadea)
export function randomLook(seed, opts)        // look aleatorio válido (gente de la ciudad); opts.type: pueblo, opts.cls: clase
// opts de avatarModel: cls (viste por clase o rol, ROLE_CLASS), gear (equipo fuera del catálogo), seated, npc, scale
```
### src/avatar/skiff.js (agente Avatar): el esquife volador (plan §M5, ex auto)
```js
export function skiffModel(car, opts = {})  // -> THREE.Group, eslora ≈ 1,5–1,9 en Z, proa a +Z, flota a SKIFF_FLOAT sobre y=0
// car = state.car = { body: casco, color: pintura, wheels: aparejo (vela o globo), topper: proa } (claves de antes)
// opts.driver: look sentado en el banco de popa · userData.sail: el aparejo (miniatura) · userData.size = {w, l, h}
// userData.update(dt, speed, steer): se mece, escora al doblar, la vela flamea y el cristal de Céfiro late
export function carStats(car)             // {speed, handling} 1..5 desde CAR_BODIES
export function normalizeCar(car)         // corrige ids y traduce los del auto de antes (V5_CAR)
```
`car.js` reexporta todo como `carModel`. Vóxel de 1/24, madera en 4 tonos, la pintura sale de `clothHex` y el cristal
de abajo va con `lightMat`. En la ciudad (`city-life.js`) amarra al muelle del Establo (un poste con soga y dos tablas)
y cada 40 a 80 s da una vuelta a la isla por fuera del borde, a la altura de los techos. En el Equipaje, el escenario
es el muelle de amarre de noche (`buildDock` en `wardrobe-stage.js`). Galería: `tools/people.html?set=esquifes`
(`part=casco|vela|proa`, `driver=1`).
Usar colores de `data.js` (`OUTFIT_COLORS`, `HAIR_COLORS` y los `skins` de cada pueblo); la ropa los apaga con `clothHex` y las rampas salen de `ramp` (`avatar-kit.js`).

## Economía (resumen)
- Casas dan **población**; negocios requieren población mínima (`popReq`) y producen monedas por ciclo con tope (`cap` ciclos) → hay que volver a cobrar.
- Deco da **felicidad** → bonus de producción hasta +50%. Mejorar la Municipalidad → +8% global por nivel.
- **Rango de la ciudad** = nivel de la Municipalidad (`TOWN_RANKS` en data.js: Aldea → Caserío → Pueblo → Villa → Ciudad → Gran Ciudad → Metrópolis → Capital).
  Subir pide un **expediente** (`req`: población, felicidad %, Encanto, tipos de negocio distintos) + nivel de jugador (`reqLevel`) + monedas/gemas y obra.
  Cada rango da `reward` (gemas y cofre), terreno (`land` = cuántas expansiones permite; `expansionStatus()` pide nivel **y** rango),
  constructoras de regalo (`builders`, en los rangos 3 y 6; no cuentan para el tope de compra) y desbloquea los edificios con `rank`.
  API en economy.js: `townRank`, `rankDef`, `rankStatus` (reqs, allOk, levelOk, stars), `syncRank` (en cada `tick`).
  UI: chip de rango y época en el HUD (brilla con "!" si se puede subir) → panel `rank` (`panels-rank.js`), ficha de la Municipalidad con el expediente.
- **Encanto** (`charmInfo`/`cityCharm`): qué tan linda y variada está la ciudad. Cada edificio terminado suma `charm` (o un valor por categoría,
  ver `charmBase`) × (1 + 0,25 por nivel extra); cada copia repetida del mismo edificio vale ×0,85 de la anterior; la variedad multiplica
  +2% por tipo distinto (tope ×1,5). Se muestra en estrellas (0–5) respecto del Encanto que pide el próximo rango. `charmGain(id)` = cuánto sumaría otra copia.
- Balance (`SIM_DAYS=120 node tools/sim-economy.mjs .`, con monumentos y materiales): jugando 4 ratos por día, rango 2 el día 1, rango 5 ≈ día 12
  y rango 8 ≈ día 51; con 2 ratos por día (`SIM_DAYS=150 node tools/sim-economy.mjs . new 1 9,20`), 2 / 20 / 95. Las monedas sobran: el ritmo
  lo marcan `reqLevel`, la población (terreno), el Encanto (variedad) y los monumentos (materiales). La sim reacomoda la ciudad si un monumento no entra.
- **Materiales y monumentos**: los materiales son los de región (madera, piedra, mineral, hierbas: `REGION_MATERIALS` en
  data.js) y los trae la expedición (cada región tiene los suyos, DESIGN-CORE.md §2.9); también salen en diarias, amenazas, en la
  "Bolsa de materiales" de los cofres (elige lo que más te falta; antes del rango Pueblo da monedas) y en algunos niveles del Pase
  (`mats` en `TIERS`). Los de los minijuegos retirados se migraron 1:1 (cristal→mineral, ladrillo→piedra, tuerca→madera,
  mapa→hierbas) junto con los costos de `MONUMENTS`.
  `store.canAfford/spend/grant` entienden `cost.mats`/`reward.mats` (`{madera: n, ...}`); `costHtml` los dibuja.
  `MONUMENTS` (Faro, Jardín Botánico, Observatorio, Estadio, Museo, Torre del Reloj) también son edificios `cat:'monumento'`, `max:1`:
  el **nivel es la etapa** (4 o 5). Construir paga la etapa 1; cada etapa siguiente es una mejora (`upgradeInfo` → `stages[nivel]`,
  con materiales + monedas + obra con constructora). Encanto = `charm` × etapas hechas / N. Terminado da un bonus permanente
  (`monuments.js` → `monumentBonus(type)`): Faro +10% monedas de negocios, Jardín +25% felicidad, Observatorio +25% XP de partidas,
  Estadio +25% chispas por partida, Museo +50% de chance de figurita, Torre del Reloj obras −10% (`stageTime`).
  Se desbloquean por rango (3, 4, 5, 5, 6, 7) y los rangos 4–8 piden 1, 2, 3, 5 y 6 terminados (`req.monuments`).
  UI: botón **Obras** en el riel del HUD (desde el rango Pueblo; el globito cuenta las etapas que ya se pueden empezar) → panel `works`
  (`panels-works.js`): materiales con "Jugar", cada monumento con su etapa, lo que pide la próxima y el bonus. Al terminar una partida
  dice cuánto falta de ese material para la próxima etapa (`materialHint`). La ficha del monumento muestra "Etapa N de M" y "Avanzar obra".
- **Mi Casa** se retiró (La Travesía, paso 1c): la ciudad es el puerto desde donde se sale de travesía. El guardado v6
  (`migrateV6` en `state.js`) saca el edificio `mi_casa` y deja libre la parcela, devuelve lo pagado por las ampliaciones y los
  muebles comprados, y pasa el Encanto que daban la casa y su Confort a `city.charmBonus` (`economy.settleV6Charm`, la primera
  vez que se pide el Encanto) para que nadie baje de rango. Los trofeos pasan a **Logros** (`src/core/achievements.js`), al final
  del Diario de la Bitácora. En partidas nuevas la Municipalidad da 35 de Encanto (antes 20 + la casa). Los perfiles viejos
  que traen `city.home` se ignoran.
- Constructoras limitadas (2, se compran más con gemas). Obras con tiempo; se aceleran con gemas (≤5s gratis).
- Recursos del ciclo: provisiones, materiales de región, planos, equipo, reservas y colonos (DESIGN-CORE.md §5); la expedición
  no da monedas (sí experiencia: 10 + 5 por ★, con el Observatorio). Misiones principales guían, diarias dan hábito, logros a largo plazo, premio diario de login con racha.

## Pruebas
```
node tools/smoke.mjs --scene <id> [--device iphone|desktop|ipad] [--cheat 15] [--wait ms] [--steps pasos.json] [--shot ruta.png] [--eval js]
```
Captura en Chrome headless, imprime errores de consola y sale con código 1 si hubo. **Guardar capturas en tu carpeta del scratchpad, no en el proyecto.** Mirá las capturas (Read del png) para juzgar cómo se ve. `window.__pixelia` expone `{ctx, store, bus, economy, quests, data}` para pasos `eval`.
URL params: `?scene=id`, `?cheat=nivel` (+100k monedas, +1000 gemas), `?reset`, `?nosplash`.

Suites de punta a punta (todas con `--out carpeta` para las capturas; salen con 1 si algo falla):
```
node tools/test-e2e.mjs      jugadora nueva sin cheat en iPhone: splash → onboarding con toques reales (Osito, color de ropa, nombre y ciudad tipeados, estilo Bosque; verifica el guardado) → modal de llegada (premio del día, «Mañana se abre») → tutorial t1–t10 → nivel → cofre → potenciador viejo → equipo → «Hoy se abre: el Pase» → Pase/Hallazgos/Cofres/Eventos (desde el Pase); revisa los globitos del HUD (≤ 4) y los controles (≤ 14); al final recarga y confirma que no repite el onboarding
node tools/test-migration.mjs guardado v2 armado a mano (minijuegos jugados, álbum a medias, materiales viejos, monumento a medias, potenciadores) → v3 sin pérdidas; segunda carga igual; Joyería + Taller; sin Pista; importCode; partida nueva; v5 → v6 (Mi Casa sale: devoluciones, bono de Encanto, Logros)
node tools/test-visit.mjs    ana y bea (mock): amistad por código, regalito, visita (like, notita, ayudar obra) → buzón → la obra se acelera; pedido "Acelerá mi obra"
node tools/test-social.mjs   UI social completa (intercambios con escrow, ranking, Obra en Equipo, cuenta, conflicto)
node tools/test-rank.mjs     rango y Encanto (mock + cheat): chip del HUD → panel con expediente → Mejorar → festejo, constructora de regalo, ficha, menú, perfil público visto por una amistad
node tools/test-works.mjs    monumentos (mock + cheat): rango Pueblo → botón Obras → materiales de región con «Salir» a la expedición → panel Obras → Construir y colocar el Faro → etapas → bonus de negocios y expediente; capturas de cada etapa
node tools/test-mock.mjs     API de net.js con dos pestañas     ·     node tools/test-sql.mjs   schema.sql en PGlite
node tools/test-stress.mjs   recorre escenas + paneles N veces (--rounds 3) y mide fugas (WebGL, listeners, bus, intervalos)
node tools/gen-sw-core.mjs   regenera CORE de sw.js con todos los .js reales (--bump sube VERSION, --check solo verifica)
```
