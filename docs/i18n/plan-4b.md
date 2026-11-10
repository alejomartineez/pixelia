# Pixelia · Plan del paso 4b: extraer y traducir

Preparado en el 4b-0 (glosario, guías de tono, `tools/i18n-extract.mjs`, `tools/test-glossary.mjs`). El 4b arranca
**cuando el Bloque 3 esté integrado** (3b, 3c y 3d) y también el 2b y el 2c, para no traducir dos veces lo que cambia.

Material de base:
- [glosario.md](glosario.md): términos fijos en los 9 idiomas. Si un término cambia, se cambia ahí primero.
- `tono-<idioma>.md`: trato, registro, puntuación, números, plurales y largo de botones de cada idioma.
- [pendiente.md](pendiente.md): lo que falta, por carpeta y por idioma. Se regenera con `npm run i18n:extract` (desde
  `tools/`) al empezar y al cerrar cada sesión.

**Tamaño (medido el 2026-11-09, antes del Bloque 3):** 672 claves (~2.800 palabras) y unos 2.570 textos todavía escritos
en el código (~15.000 palabras). En total, unas **18.000 palabras por idioma**, más las líneas del narrador.

## 1. Fases

### 4b-1 · Pasar el texto a claves (sin traducir a los 6 idiomas nuevos)
Cada sesión toma una carpeta, pasa cada texto a `t()`/`tn()` con su clave en `es.js` y suma el archivo a `PASSED` de
`tools/test-i18n.mjs`. Como `test-i18n` exige completos los idiomas que ya tienen texto, **cada sesión escribe también
en y ja** para sus claves nuevas, siguiendo el glosario y las guías. Así, al cerrar el 4b-1, en y ja quedan completos.

| sesión | carpetas (ver pendiente.md) | textos aprox. |
|---|---|---|
| 4b-1a | `src/core` | 600 |
| 4b-1b | `src/scenes` | 390 |
| 4b-1c | `src/story`, `src/cinema` (guiones del narrador, ver §3) | 280 |
| 4b-1d | `src/combat`, `src/expedition` (o lo que quede de ella después del 2c) | 440 |
| 4b-1e | `src/online` | 330 |
| 4b-1f | `src/album`, `src/chests`, `src/season`, `src/threats`, `src/city`, `src/avatar`, `src/main.js` | 520 |

Reglas del 4b-1:
- **Claves por zona** (`story.`, `combat.`, `online.`…): cada sesión agrega su bloque **dentro de su zona**, con un
  comentario `// ── zona ──` arriba, en `es.js`, `en.js` y `ja.js`. Así las sesiones en paralelo no chocan al final
  del archivo. Nadie reordena ni reescribe lo que ya está.
- Los **datos** (`data.js`, `exp-data.js`, `story-data.js`) guardan claves y no textos: `building.<id>.name`,
  `building.<id>.desc`. La clave se arma con el id; el id no cambia.
- Las comparaciones contra texto en español (`can.reason === 'No te alcanza'` en `city-ui.js`, por ejemplo) pasan a
  códigos (`reason: 'poor'`) y el texto sale con `t()` al mostrarlo.
- Al cerrar: `npm run i18n:extract`, `node test-i18n.mjs --no-shots`, `node test-glossary.mjs` y las pruebas de la
  carpeta que se tocó.

### 4b-2 · Traducir: una sesión por idioma
Seis sesiones en paralelo, una por idioma nuevo (zh-CN, ru, pt-BR, de, fr, ko), cada una en su rama y **solo con su
`src/i18n/<idioma>.js`**: no chocan entre sí. Más una sesión de **revisión de en y ja**, que pasa el ojo sobre lo que
el 4b-1 tradujo apurado.

Cada sesión de idioma:
1. Lee el glosario, su `tono-<idioma>.md` y la Guía de tono de DESIGN.md.
2. Traduce por zona, de lo más visible a lo menos: `hud`, `boot`, `common`, `settings`, `city`, `build`, `voyage`,
   `squad`, `arsenal`, `progress`, `talents`, el resto de la interfaz y, al final, `story` y `narration` (lo más largo y
   lo que más pide cuidado).
3. Anota las dudas en `docs/i18n/dudas-<idioma>.md` (clave, duda, decisión tomada). Si una duda es del glosario, la
   resuelve la sesión que orquesta y se corrige el glosario para todos.
4. ru, zh-CN y ko: `node subset-fonts.mjs` al terminar (recorta Fusion Pixel a los caracteres usados).
5. Cierra con `node test-i18n.mjs` (con capturas), `node test-glossary.mjs` (que ya mira su idioma en cuanto tiene
   texto) y la tanda de capturas de §5.

**Corte por contexto:** a cada sesión le alcanza para una o dos zonas grandes. Al 40 % de contexto, commit WIP con las
zonas hechas y nota en el HANDOFF; la siguiente sigue por la zona que falta (la tabla de pendiente.md dice cuál).

### 4b-3 · Revisión por traducción inversa (10 %)
Para cada idioma, una sesión **distinta de la que tradujo** y sin ver el español:
1. Arma la muestra: el 10 % de las claves de cada zona, al azar con semilla fija (la misma para todos los idiomas, así se
   comparan), más **todas** las claves de `story.*` épicas y de los botones del HUD. Se suma un `--sample` a
   `tools/i18n-extract.mjs` que la escriba en `shots/i18n/retro/<idioma>.json`.
2. Traduce la muestra de vuelta al español.
3. Compara con `es.js` y clasifica cada clave: **igual** (mismo sentido), **matiz** (cambia el tono o el registro: se
   corrige si va contra la guía de tono) o **error** (cambia el sentido, falta algo o sobra algo: se corrige siempre).
4. Deja `docs/i18n/retro-<idioma>.md` con la tabla y las correcciones hechas.
5. **Umbral:** si en una zona los errores pasan el 3 % de la muestra, se revisa esa zona entera (no solo la muestra).

El cierre del Bloque 4 pide "la retrotraducción de muestra sin cambios de sentido pendientes" (PLAN-TRAVESIA).

## 2. Qué no se traduce
- Nombres puestos por quien juega, notas de visitas, nombres de contactos y códigos de amistad.
- El perfil online: guarda ids, así una visita se ve en el idioma de quien mira.
- Los avisos de consola para quien programa (`[i18n]`, `[settings]`).
- Las marcas: Pixelia, Dezings (glosario §9).

## 3. Las voces del narrador (es y en)
Hoy los guiones están escritos en `src/cinema/narration.js` (`{ id, text }`) y las grabaciones en
`assets/audio/voice/<id>.m4a`, hechas con `tools/audio/narrate.mjs` (Gemini TTS, voz Fenrir; la clave nunca se imprime
ni se copia, ver DESIGN-AUDIO.md).

- **Texto:** en el 4b-1c el texto pasa a claves `narration.<guion>.<id>`; `narration.js` guarda solo ids, tiempos y
  notas de dirección. Los subtítulos salen de `t()` en los 9 idiomas.
- **Audio:** se graba en **es y en**. Las grabaciones pasan a `assets/audio/voice/<idioma>/<id>.m4a`; `audio.voice(id)`
  busca la del idioma actual y, si no hay, la **inglesa** (más entendible que el español para quien juega en otro
  idioma), con el subtítulo en su idioma. Ajustes suma "Voz del narrador: idioma del juego / español / inglés / sin voz".
- **Dirección en inglés:** mismo perfil (grave, épica y misteriosa), con notas de dirección escritas en inglés para que
  el modelo no las lea en voz alta. `narrate.mjs --lang en` lee las claves de `en.js`.
- **Tiempos:** la línea en inglés suele ser más corta; si alguna queda más larga que su plano, se ajusta el texto (no el
  plano) hasta que entre. `test-cinema` revisa que ninguna voz pase el largo de su plano en es y en.
- `sw.js`: las voces de cada idioma entran en el bump solo como opcionales (se bajan al elegir el idioma), para no
  inflar la primera carga.

## 4. Tienda e instalador
- **Instalador de Windows (NSIS):** `desktop/src-tauri/tauri.conf.json` hoy tiene `"languages": ["Spanish"]`. Pasa a
  `["Spanish", "English", "SimpChinese", "Russian", "PortugueseBR", "German", "French", "Japanese", "Korean"]` con
  `"displayLanguageSelector": true`; los textos propios del instalador (si se agregan) van por `customLanguageFiles`.
  Probar el `.exe` con `node test-desktop.mjs` y a mano en un Windows en inglés.
- **Mac:** `CFBundleLocalizations` con los 9 idiomas en el `Info.plist` que arma Tauri, para que el sistema muestre el
  nombre bien y elija el idioma del juego.
- **`shortDescription`** ("Pixelia, un juego de Dezings") y el texto de "Acerca de": por idioma, desde el glosario.
- **Tienda** (Steam o la que se elija) y **web** (`index.html`, `manifest.webmanifest`, la imagen OG): un archivo por
  idioma en `docs/i18n/tienda/<idioma>.md` con nombre, descripción corta (≤ 300 caracteres), descripción larga,
  características en viñetas y textos alternativos de las capturas. Los escribe la sesión de cada idioma al final,
  con el tono de su guía: sin superlativos ni "¡El mejor juego cozy!".
- **Notas de versión** de GitHub (`npm run release`): en es y en.

## 5. Capturas por idioma
- **Recorrido:** el mismo recorrido de capturas (`tools/recorrido.mjs` y las capturas de `test-i18n`) con `?lang=<idioma>`,
  en `shots/i18n/<idioma>/`: menú de inicio, HUD, Construir, una ficha, Ajustes, mapa de islas, Cuartel, Arsenal,
  combate, Bitácora, una cinemática con subtítulos y "Mientras no estabas…".
- **Automático:** `test-i18n` mide `scrollWidth > clientWidth` en botones, pestañas y tarjetas. En el 4b se suman las
  pantallas nuevas (mapa, Cuartel, travesía, combate) y se corre en los 9 idiomas, más `?pseudo=1`.
- **A ojo:** una persona (o la sesión) revisa cada captura: texto cortado, cuadraditos (falta glifo), texto encimado,
  saltos de línea feos en CJK, comillas y espacios del idioma. Se anota en `docs/i18n/capturas-<idioma>.md`.
- **GPU:** las capturas se sacan de a un idioma por vez, con 60 FPS de tope y pausas cortas (la placa se calienta).

## 6. Orden y sesiones
| paso | qué | sesiones | depende de |
|---|---|---|---|
| 4b-1a…f | pasar el texto a claves, con en y ja | 6, en paralelo por carpeta | Bloque 3, 2b y 2c integrados |
| 4b-2 | traducir zh-CN, ru, pt-BR, de, fr, ko; revisar en y ja | 7, en paralelo por idioma | 4b-1 integrado |
| 4b-3 | traducción inversa del 10 % | 1 por idioma (otra sesión) | 4b-2 de ese idioma |
| 4b-4 | voces en en, instalador, tienda, capturas finales | 1 o 2 | 4b-2 |
| cierre | `test-i18n` sin excepciones, `npm test` entero, bump, `desktop:build` + `test-desktop` | la que orquesta | todo |

**Al cerrar el 4b:** `PASSED` cubre todo `src/` (o la sección 2 de `test-i18n` pasa a mirar todo `src/` con una lista
de nombres propios permitidos), `KNOWN` de `test-glossary` vacío, capturas de los 9 idiomas revisadas y las
retrotraducciones sin errores pendientes.
