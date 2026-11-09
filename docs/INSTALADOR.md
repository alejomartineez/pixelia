# Instalador del juego de PC: prueba como otra persona (2026-11-09)

Pregunta: ¿el juego de PC está listo para que lo instale alguien que no sea quien lo programó? **En Windows, sí.** En
Mac compila, abre y llega al onboarding en el runner de GitHub, pero falta probarlo en una Mac real. La actualización
automática no se pudo probar porque todavía no hay ningún release publicado.

Se probó la v48 de master y después la v49 de esta rama, que trae los arreglos de abajo. Las capturas están en
`shots/instalador/` (sin seguimiento en git). La prueba se puede repetir con [`tools/test-instalado.mjs`](../tools/test-instalado.mjs).

## Arreglado en esta rama (v49)
| Qué fallaba | Arreglo |
|---|---|
| `npm run desktop:build` armaba el `.exe` pero **terminaba con error**: «A public key has been found, but no private key». Sin la clave privada del actualizador en el entorno, cualquier build local fallaba al final. | `desktop:build` ahora usa `--config src-tauri/tauri.check.conf.json`, como el workflow manual: no arma los archivos del actualizador. Los firmados los arma solo el release, en Actions, con el secret. |
| **Mac: la ventana quedaba cortada a la izquierda.** En el monitor de 1024×768 del runner, la ventana ocupaba de x = −128 a 834. En macOS, `center()` justo después de `set_size()` todavía ve el tamaño anterior (1280) y centra eso. | `fit_to_monitor` (`desktop/src-tauri/src/lib.rs`) centra a mano con `set_position` en el área útil. Lo mismo `sizeWindow` en `src/core/desktop.js`, que se usa al elegir una resolución en Ajustes; `monitorInfo()` ahora devuelve también la posición del área útil. Ahora en Mac queda en (30, 61) con 963×615, y en Windows en (320, 112) con 1296×839, sobre un área útil de 1920×1025. |
| `Cargo.lock` seguía en 0.26.0. Cada build local lo cambiaba solo y dejaba un cambio sin commitear, que `release:check` frena. | `npm run bump` (`gen-sw-core.mjs`) ahora también sincroniza la versión de `pixelia` en `Cargo.lock`. |
| `test-desktop.mjs` decía `"entra": false` cuando la partida había quedado en pantalla completa, que es como abre. | Ahora dice `"modoGuardado"` y, si el modo no es ventana, pone `"entra": "no aplica"`. |
| El workflow manual de Mac solo capturaba el splash. | Ahora toca Enter (cinemática) y Esc (onboarding), y anota en `window.txt` la posición y el tamaño de la ventana. System Events tiene permiso en el runner. |

## Windows: qué se probó (todo anduvo)
PC del usuario: Windows 11, monitor de 1920×1080 al 100 % y WebView2 de Edge 157. Se instaló con el `.exe` de NSIS
(`Pixelia_0.4x.0_x64-setup.exe`, 7,6 MB) en modo silencioso (`/S`), por usuario y sin pedir permisos de administrador.
- **Instalación.** Queda en `%LOCALAPPDATA%\Pixelia\` (`pixelia.exe` y `uninstall.exe`), con acceso en el menú Inicio.
  En *Aplicaciones instaladas* figura «Pixelia», de Dezings, con su versión y su ícono. La partida se guarda aparte, en
  `%LOCALAPPDATA%\com.dezings.pixelia\EBWebView` (localStorage de WebView2).
- **Primera apertura, con la partida limpia.** El orden es el esperado:
  1. logo de Dezings animado;
  2. splash con «Hacé clic para jugar»;
  3. cinemática con «Saltar (Esc)»;
  4. onboarding: personaje, clase, nombre y ciudad;
  5. llegada de Vera;
  6. estilo de la ciudad;
  7. la ciudad, con el premio del primer día y Vera presentándola.

  Capturas `nueva-*.png`. Un clic durante el logo de Dezings no hace nada; hay que esperar el splash.
- **Escala de interfaz.** Arranca en **115 %**: `devicePixelRatio` da 1,15 y Ajustes → Pantalla muestra 115 %.
- **Pantalla.**
  - F11 pasa a pantalla completa y vuelve, y Ajustes recuerda «Ventana».
  - Los tres botones de Ajustes → Pantalla funcionan: Ventana, Pantalla completa y Sin bordes (1920×1080 sin
    decoración).
  - Al cerrar en pantalla completa, la próxima vez abre en pantalla completa.
  - En ventana, abre con 1280×800 de área de juego, centrada y dentro del área útil.
- **La partida sobrevive.** Se cerró siempre como con la X (WM_CLOSE, `taskkill` sin `/F`), nunca matando el proceso.
  - **Cerrar y reabrir:** abre directo en la ciudad, con el nombre y la ciudad. Hasta un cambio guardado un instante
    antes de cerrar seguía ahí.
  - **Instalar encima** (el mismo setup otra vez, sin desinstalar): la partida sigue.
  - **Desinstalar y volver a instalar:** el desinstalador silencioso borra `%LOCALAPPDATA%\Pixelia`, el registro y el
    acceso directo, pero **deja la partida**. Al reinstalar, todo sigue: partida, modo de ventana y escala.
- **Online.**
  - Con el mock (`index.html?mock=1&mockuser=ana&scene=city`) entra la sesión de ana, con su código de amistad, y el
    panel de Contactos anda. El mock usa su propio guardado, `pixelia.save.v1.mock.ana`, así que no toca la partida real.
  - Desde la app, el Supabase real responde 200 en `/auth/v1/health`. No se crearon cuentas.
- **`node tools/test-desktop.mjs`** pasa: Tauri, updater cargado, sin service worker, localStorage, la ciudad,
  Supabase 200, la ventana entra en el monitor, sin bordes, pantalla completa, de vuelta a ventana y zoom 125 → 100.
- **GPU.** Todas las corridas duraron entre 15 y 30 s, de a una, con tope de 60 FPS. Como máximo, 35 °C y 48 W.

## Mac (runner `macos-latest` de GitHub, sin Mac propia)
Corridas manuales: [42639278678](https://github.com/alejomartineez/pixelia/actions/runs/42639278678), con master v48, y
[42641820168](https://github.com/alejomartineez/pixelia/actions/runs/42641820168), con esta rama v49. Las dos terminaron
bien, y también el `win-check`, que sube el setup de Windows como artefacto.
- Compila y abre: el `.app` arranca y el splash llega a «Hacé clic para jugar».
- Enter abre la cinemática, con textos y la barra de progreso, y Esc la salta y pasa al onboarding. Las miniaturas de
  personajes se ven bien.
- Con el arreglo, la ventana entra entera en la pantalla de 1024×768.
- **Falta confirmarlo en una Mac real.** En el runner quedan vacías las vistas 3D grandes: el fondo de la cinemática y
  la vista previa del personaje en el onboarding. Lo más probable es que la VM no tenga GPU, porque las miniaturas
  salen. Hay que verlo con una Mac.
- No se probó:
  - el `.dmg` universal (Intel + Apple Silicon): lo arma solo el job de release;
  - Gatekeeper con un archivo bajado de internet (el README explica clic derecho → Abrir y `xattr -cr`);
  - la pantalla completa con el botón verde.

## `npm run release:check`
En esta rama da dos avisos esperables: la rama no es master, y tiene un commit que master todavía no tiene. Todo lo
demás pasa:
- `sw.js`, `desktop/package.json`, `tauri.conf.json` y `Cargo.toml` dicen 0.49.0;
- `tauri.conf.json` tiene la clave pública del actualizador;
- el workflow escucha los tags `v*`;
- el tag v49 no existe.

**En GitHub no hay ningún tag ni release.** No se corrió `npm run release`, no se crearon tags y no se publicó nada:
eso lo decide el usuario.

## Qué falta
- **Actualización automática: sin probar.** Necesita un release publicado con `latest.json`. Hasta que exista, la app
  busca `releases/latest/download/latest.json`, recibe un 404 y no muestra nada; queda un `console.warn`, no se ve un
  error. Para probarla: publicar un release vN, instalar ese, publicar uno vN+1 y abrir la vN; tiene que ofrecer
  «Hay una versión nueva». Antes de eso, el link «último release» del README no lleva a nada.
- **Instalador interactivo: sin probar.** Se instaló siempre en modo silencioso. Falta probar:
  - las pantallas del asistente en español;
  - el acceso directo en el escritorio: en modo silencioso no se crea, y hay que ver si el asistente lo ofrece;
  - el aviso de SmartScreen, «Windows protegió su PC». No aparece con un archivo compilado en la misma PC; aparece con
    uno bajado de internet.
- **El desinstalador interactivo de Tauri tiene una casilla para borrar los datos de la app**, que también borra la
  partida. Convendría avisarlo en el README: «si desinstalás, no marques *Borrar datos* si querés conservar la
  partida».
- **WebView2:** Windows 10 y 11 ya lo traen. El instalador usa el bootstrapper de Tauri, así que en una PC sin WebView2
  necesita internet al instalar. No se probó en una PC así.
- **Idea, no es una falla:** en Mac la barra de título queda blanca (apariencia clara) sobre un juego oscuro. Con
  `"theme": "Dark"` en la ventana de `tauri.conf.json` quedaría oscura en Windows y en Mac. No se tocó: es una decisión
  de diseño.

## Del juego, para la sesión de interfaz (no se tocó: `src/scenes/`, `src/story/`)
- Ajustes → Pantalla: el panel tiene mucho espacio vacío abajo, sobre todo en pantalla completa a 1920×1080
  (`reabrir-4-modo-borderless.png`).
- En la ciudad, el primer día, el aviso «Premio de tu primer día» tapa uno de los carteles «1 zona», y la flecha de
  «Hacé clic en Construir» queda pegada a la tarjeta de Vera (`nueva-7-ciudad.png`, 1280×800 al 115 %).
- El nombre de la ciudad tiene tope de 16 letras («Puerto Instalador» quedó «Puerto Instalado»). Está bien, pero no hay
  contador ni aviso.

## Cómo quedó la PC
- Pixelia quedó desinstalado, como estaba antes de la prueba.
- El perfil de WebView2 que había (de pruebas del 8/11) se movió aparte durante la prueba y después se restauró en
  `%LOCALAPPDATA%\com.dezings.pixelia`.
- Los perfiles de prueba quedaron en `%LOCALAPPDATA%\com.dezings.pixelia.prueba1` y `.prueba2`. Se pueden borrar a
  mano.
- El setup v49 está en `desktop/src-tauri/target/release/bundle/nsis/`.
