# Pixelia · Sonido y música

Diseño del paso 3c de El Quiebre ([docs/PLAN-QUIEBRE.md](docs/PLAN-QUIEBRE.md) §K). La música es **híbrida**: el juego
compone en vivo, por capas, con instrumentos grabados reales (piano, flauta, pizzicato de violines, timbales y coro) más
un colchón de cuerdas y un bajo hechos en código. El estilo es **folk melancólico**: cálido en la ciudad, misterioso
afuera, con silencios entre frases, y crece a coro y timbales solo en los momentos épicos. Todo corre sobre Web Audio
nativo, sin dependencias en tiempo de ejecución, y todos los sonidos son CC0.

## Arquitectura (`src/audio/`)
| Módulo | Qué hace |
|---|---|
| `mixer.js` | Buses general / música / ambiente / efectos / interfaz / voz, ducking, reverb por lugar, amortiguado, límite de voces y limitador final. |
| `sampler.js` | Carga los `.m4a` del manifest sin bloquear, los decodifica y los toca sueltos, en loop o como instrumento (ADSR, round-robin, `playbackRate`). |
| `synth.js` | Voces en código: cuerdas (`pad`), bajo profundo (`sub`), escobilla, coro con formantes, y el respaldo de cada instrumento mientras carga. |
| `pieces.js` | Solo datos: piezas, leitmotivs, capas del modo épico, alias de pistas viejas y stingers. |
| `composer.js` | Compositor adaptativo: programa compás por compás, capas por intensidad, cambios en el compás, frases con respiros y motivos. |
| `soundscape.js` | Paisaje sonoro: camas por lugar y clima, emisores sueltos en 3D, trueno con retraso, pasos por superficie. |
| `engine.js` | Junta todo sobre un `AudioContext` o un `OfflineAudioContext`; efectos con nombre (`SFX`) e intensidad por lugar. |

`src/core/audio.js` es la fachada del juego. Mantiene la API de siempre (`audio.sfx('coin')`, `audio.music('city')`,
`configure`, `unlock`, `setBackground`, `level`) y suma:
- `setScene({ place, night, weather, light, threat, population, indoor, danger })`: lo llaman `city-ambience.js` (cada
  segundo), `exp-ambience.js` (cada paso) y `main.js` al entrar a una escena (`enterScene`: Equipaje y el onboarding quedan
  en silencio de ambiente). Mi Casa, que ponía `home` e `indoor`, salió en La Travesía (paso 1c).
- `stinger(name)`, `intensity(x)`, `epic(on)`, `motif('quiebre')`, `step(superficie)`, `thunder()`, `dialog(on)`.
- `connect(bus)` (en `main.js`): `ambience:thunder` → trueno, `ambience:night` → noche, `story:page` → página,
  `story:element` → elemento, `reward:stickers` → hallazgo, `threat:announced` → amenaza, `town:rankup` → rango (o Época
  si `eraChanged`), `world:light` → la ciudad se enriquece.
- `debug()` para las pruebas, `credits()` para Ajustes → Partida.

El temporizador (cada 120 ms) programa 0,6 s hacia adelante. El compositor arma un compás entero cuando le toca, así que
un cambio de pieza o de intensidad cae siempre en el próximo compás.

## Mezcla
- **Buses.** Toman los volúmenes de Ajustes (`volMaster`, `volMusic`, `volSfx`, `volAmb`, `volUi`, `volVoice`; la fila
  "Voces" está en Ajustes → Sonido). Con los valores por defecto: general 0,7, música 0,62, ambiente 0,7, efectos 0,8,
  interfaz 0,6, voz 0,9. La música entra con +5 dB de ganancia fija.
- **Niveles medidos** (`render-audio.mjs` + `ffmpeg ebur128`, valores por defecto): la ciudad cerca de −20 LUFS, el
  épico y la tormenta cerca de −18 LUFS, la expedición cerca de −24 LUFS (escasa a propósito). Los picos quedan por
  debajo de −3 dBFS. El limitador (umbral −6 dB, techo −0,5 dBFS) solo actúa si se juntan muchos stingers.
- **Ducking.** Los stingers bajan la música mientras suenan (su `duck`, de 0,25 a 0,8). Hay ducking sostenido para el
  diálogo (`audio.dialog(true)`, 0,45) y para el modo épico.
- **Reverb por lugar.** Respuestas de impulso hechas en código (ruido que decae y se oscurece): `open` (ciudad,
  expedición, faros, combate), `interior` (pantallas tranquilas, pieza `calm`), `mine`, `cave`, `under` (Bajo Mundo) y `hall` (modo épico). Al
  cambiar, la cola baja, se cambia la respuesta y vuelve, así no hay clic.
- **Amortiguado.** Es un pasabajos sobre el ambiente con `indoor`: queda en 0,45, y con tormenta en 0,6.
- **Voces.** Hay 32 como máximo. Si no hay lugar, se corta la de menor prioridad con un fundido de 30 ms. El orden de
  prioridad es música < ambiente < efectos < interfaz < stingers.
- **Sin clics.** Todo entra y sale con rampas, y los loops de las camas tienen fundido de cola sobre cabeza. El AAC trae
  relleno al principio: el sampler arranca el loop donde empieza el sonido y lo hace durar lo que dice el manifest.
- **Segundo plano.** Lo maneja "Silenciar en segundo plano" de Ajustes, igual que antes.

## Mapeo por lugar
| Lugar | Pieza | Carácter | Camas |
|---|---|---|---|
| Ciudad | `city`: Sol mayor en 3/4, 72 bpm | Vals cálido de piano y pizzicato. Se enriquece con la luz de la isla (intensidad de 0,2 a 0,75). | Viento, mar, murmullo (crece con la población), pájaros. |
| Ciudad de noche | `city` con `night` | 62 bpm. La flauta reemplaza al piano, no hay pizzicato y hay más respiros. | Grillos, búho y un zumbido de faroles. |
| Pantallas tranquilas | `calm`: Fa mayor, 60 bpm | Piano y colchón, reverb de interior. | El afuera tapado. |
| Expedición cerca / medio | `expedition`: Re dórico, 86 bpm | Pizzicato que camina, flauta y escobilla. | Viento y bosque (pájaros de día). |
| Expedición lejos | `expedition_far`: Re eólico, 66 bpm | Dron, piano grave y flauta rara. Cambia sola al alejarse. | Viento fuerte y un fondo de cueva. |
| Amenaza | `threat`: La menor armónica, 84 bpm | Timbal que late y pizzicato grave. | Las del clima de la amenaza (agua, fuego, escarcha). |
| La mina sellada | `mine`: Do frigio, 56 bpm | Oscura, con piano grave y coro. | Cueva y goteo. |
| Costa de los Faros | `coast`: Mi eólico en 3/4 | Flauta sobre el mar. | Mar y viento. |
| Bajo Mundo | `under`: Si frigio, 50 bpm | Grave y disonante, con coro y timbal. | Cueva, lava y retumbo. |
| Combate | `battle`: Re menor armónica, 108 bpm | Timbal y pizzicato. Con el peligro entran escobilla, flauta y coro. | Viento. |
| Épico (intro, jefes, revelaciones) | `epic`: Re eólico, 70 bpm | Coro, timbales, dron, reverb de sala, y cita El Quiebre. | Ninguna. |

**Intensidad** (`sceneIntensity` en `engine.js`):
- En la ciudad sale de `state.world.light`.
- En la expedición sale de la banda.
- En el combate va de 0,35 a 0,95 según el peligro.
- De noche baja 0,1.
- `audio.intensity(x)` la fija a mano.

**Capas.** Cada capa tiene su umbral `at`. Prende con un fundido corto en el compás y apaga en un tercio de compás.

**Combate (paso 5).** El enganche ya está:
- `bus.emit('combat:music', { danger })` pone la pieza `battle` y el lugar `combat`.
- Se llama de nuevo cuando cambia el peligro. También sirve `audio.intensity(danger)`.
- `bus.emit('combat:end', { won })` tira el stinger de victoria o de derrota.
- `src/combat/` todavía no lo emite: lo suma la escena del combate.

## Leitmotivs
Están escritos en grados de la escala, así que suenan en el modo de cada pieza. Cada uno dura 8 pulsos.
- **La isla**: sube a la quinta, se mece y vuelve a casa. Ciudad, pantallas tranquilas y expedición cerca.
- **La cartógrafa**: una pregunta con puntillo que mira lejos y baja a la tercera. Expedición y costa.
- **El Quiebre**: quinta, sexta menor y la caída a la segunda bemol antes de la tónica. Expedición lejos, mina y Bajo
  Mundo, y sobre todo el modo épico, donde aparece en el 80 % de las frases.

La cinemática (paso 4) lo usa con `audio.music('epic')`, `audio.epic(true)` y `audio.motif('quiebre')`.

**La melodía.** Arma frases de 2 compases: camina por la escala y cae en tonos del acorde en el primer pulso y al cerrar.
Después de cada frase puede venir un respiro de 1 o 2 compases (`rest`: 0,4 en la ciudad, 0,6 lejos).

## Stingers
| Stinger | Evento |
|---|---|
| `hallazgo` | Al encontrar algo. |
| `pagina` | Página del diario. |
| `elemento` | Elemento descubierto. |
| `rango` / `epoca` | Subida de rango; `epoca` si cambia la Época. |
| `amenaza` | Aviso de amenaza. |
| `victoria` / `derrota` | Fin del combate. |
| `nivel` | Subida de nivel. Es el efecto `levelup`. |

Hay versiones más chicas para los efectos de siempre: `hecho` (`done`), `logro` (`win`), `tropiezo` (`lose`), `estrella`
y `gema`.

Los stingers suenan en la tonalidad de la pieza que esté sonando y van por el bus de efectos, así que no los apaga el
volumen de la música. Si un evento ya tocó su stinger, el efecto musical chico de la misma acción no se pisa encima
durante 1,5 s.

## Paisaje sonoro
- **Camas** (`PLACE_BEDS` y `WEATHER_BEDS` en `soundscape.js`): viento, mar, bosque, grillos, lluvia, fuego, cueva y
  pueblo. Entran con fundido y suben o bajan según el lugar, la hora y el clima.
- **Amenazas.** La crecida sube el mar y el incendio prende el fuego. La helada y la nieve crujen.
- **Emisores** (`EMITTERS`). Cada uno tiene probabilidad, intervalo al azar, ±tono y volumen, y una posición 3D alrededor
  de quien escucha (`PannerNode`):
  - pájaros de día, que no cantan con lluvia;
  - búho de noche;
  - yunque del Taller;
  - goteo en la mina, la cueva y lejos;
  - escarcha;
  - retumbo en el Bajo Mundo.
- **Trueno.** Llega 300 a 1200 ms después del relámpago (lo pone `ambience-fx`), más la distancia (d / 343 m/s). Cuanto
  más lejos, más oscuro y más bajo.
- **Pasos** (`audio.step`): `pasto`, `piedra`, `madera`, `arena`, `agua` y `nieve`, con filtro y tono por superficie
  sobre los pasos de Kenney.
  - En la expedición salen del terreno: llano y monte son pasto, colina y roca son piedra, y bañado es agua. Con nieve,
    nieve.
  - El combate los suma cuando tenga personaje que camine.
- **Acciones.**
  - `build`: hacha y yunque.
  - `harvest`: al cosechar, desde `city-ambience`.
  - `repair`: al reparar.
  - `page`, `door`.
- **Interfaz.** Clics, aperturas y errores de Kenney (madera y metal) por el bus de interfaz.

## Fuentes y archivos
- Lo que se tomó de cada descarga está en `tools/audio/sources.mjs`. Lo prepara
  `node tools/audio/prepare.mjs --src <descargas>`, con ffmpeg (instalado con winget). El proceso:
  - recorta y saca el silencio del principio;
  - en los instrumentos aplica una ganancia común por instrumento, que respeta la dinámica entre notas, y verifica la
    afinación (autocorrelación);
  - en las camas normaliza a −20 LUFS y arma el loop;
  - en los efectos normaliza el pico;
  - pasa a mono los sueltos;
  - codifica en AAC a 96 kbps (112 kbps estéreo para las camas).
- El resultado va a `assets/audio/` y suma unos 4,8 MB:
  - instrumentos: unos 1,7 MB;
  - camas: unos 2,8 MB;
  - efectos: unos 0,6 MB.
- `assets/audio/manifest.json` trae la duración, el loop, la categoría, la nota y los créditos.
- `assets/audio/LICENSES.md` anota el origen, el autor y la licencia de cada archivo.
- Las fuentes (todo CC0):
  - Upright Piano KW de FreePats;
  - VSCO 2 Community Edition: flauta, pizzicato de violines y timbales;
  - Kenney: Interface Sounds, UI SFX y RPG Audio;
  - 13 vistas previas de Freesound: viento, mar, bosque, grillos, lluvia, fuego, trueno, cueva, pueblo, búho, pájaros,
    yunque y coro.
- Sonniss no se usa: el repo es público y su licencia prohíbe redistribuir los sonidos sueltos.
- Lo que falta y necesita una descarga nueva aprobada por el usuario:
  - cuerdas sostenidas, cello y arpa de VSCO (hoy el colchón es sintético);
  - Impact Sounds de Kenney, para pasos de verdad por superficie;
  - originales de Freesound en calidad completa.
- `assets/` entra al precache de `sw.js` (`gen-sw-core.mjs`) y al juego de PC (`desktop/stage.mjs`).

## Pistas grabadas y narrador (La Travesía, paso 3a)
- **`audio.track(id, { loop, fade, fallback })`** toca `track/<id>` del manifest (`.m4a`, categoría `music`) por el bus
  de música, en loop, y frena la música compuesta mientras suena. Se baja durante el splash junto con lo demás.
  `audio.track(null)` la corta con fundido y `audio.music(…)` vuelve a la compuesta. Si la pista todavía no existe,
  devuelve `false` y toca el `fallback` (si se pasa). Así la música de Suno entra sin tocar código: se convierte con
  `prepare.mjs` y se suma al manifest como `track/intro`.
- **Narrador.** `tools/audio/narrate.mjs` pide cada línea de `src/cinema/narration.js` a Gemini TTS
  (`gemini-3.8-flash-tts`, con respaldo en los 2.5) con notas de dirección: voz grave, épica y misteriosa, que
  entusiasme, en rioplatense sobrio.
  - Una indicación suelta delante del texto el modelo la lee en voz alta; el formato de perfil, escena, notas y
    `TRANSCRIPT`, no. Por las dudas, cada toma se transcribe con `gemini-3.8-flash` y se repite si dice de más.
  - La voz es **Fenrir** (la eligió el usuario). `--samples` deja muestras en `shots/voice/`; `--script intro` graba en
    `assets/audio/voice/` con `prepare.mjs --voice`: recorta silencios, normaliza a −18 LUFS, mono, AAC 96 kbps y
    entrada `voice/<id>` (categoría `voice`, con su duración) en el manifest.
  - **El Quiebre (3b):** 16 líneas (`intro/01`–`16`, ≈115 s). El texto de cada una es su clave `intro.line.NN` de
    `src/i18n/es.js`, así lo que se oye es lo que se lee. El narrador dice de la 01 a la 12; **Vera** (voz **Gacrux**,
    dirección `VERA_STYLE`: mujer mayor, seca y práctica, rioplatense) dice de la 13 a la 16. En `narration.js` cada
    línea puede llevar `voice` y `style`; `--skip intro/01` saltea las ya grabadas. En inglés o japonés la voz sigue en
    español y el subtítulo va traducido.
  - La clave sale de `GEMINI_API_KEY` (entorno o la línea del `.env` de SignBoox) y va solo en el encabezado
    `x-goog-api-key`; nunca se imprime ni se guarda.
- **`audio.voice(id)`** toca `voice/<id>` por el bus de voz (`volVoice`) y baja la música a 0,35 mientras habla.
  `audio.voiceDur(id)` y `audio.prepareVoice(ids)` le dan al motor de cinemáticas la duración real para estirar los
  subtítulos. Sin grabación (o sin audio habilitado) devuelve `null` y el subtítulo usa su tiempo de lectura.

## Pruebas y escucha
- `node tools/test-audio.mjs` (está en `npm test`). Prueba:
  - la teoría y que las piezas estén bien formadas;
  - el manifest, el presupuesto y las licencias;
  - 30 s de cada lugar renderizados con `OfflineAudioContext`: que no sean silencio y que el pico quede por debajo de
    0 dBFS;
  - todas las piezas con síntesis de respaldo;
  - las capas por intensidad;
  - la noche;
  - el cambio de pieza al alejarse;
  - el límite de voces;
  - los stingers, los efectos, los truenos, los pasos y los loops;
  - en el juego: que el mezclador arranque con el clic, que los buses sigan a Ajustes, la página del diario, la noche y
    que Mi Casa ya no está (ni estado ni edificio).
- `node tools/render-audio.mjs [--dur 30] [--only ciudad-dia]` deja `.wav` en `shots/audio/` para escuchar:
  - ciudad de día, de noche y con tormenta;
  - expedición cerca y lejos;
  - combate;
  - épico;
  - mina;
  - una pantalla tranquila (`calm`, adentro y con lluvia).
- `tools/audio/harness.mjs` es el banco común. Avanza el render de a 1 s con `suspend()`, como el temporizador real, y
  acepta eventos a mitad del render.
- Ninguna de estas pruebas usa la GPU: corren en Chrome headless.
