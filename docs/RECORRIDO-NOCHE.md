# Recorrido como jugador nuevo (noche del 9/11)

Recorrí el juego completo como alguien que recién llega, a 1920×1080, con `node tools/recorrido.mjs`. El script juega
con la interfaz real hasta el primer combate. La bestia y el faro los adelanté tocando el guardado.

- **Recorrido:** logo, cinemática, personaje, clase, nombre, llegada con Vera, ciudad (t1 a t4), primera expedición
  guiada, primer combate guiado, la bestia del Bañado, el faro viejo, Bitácora (Historia, Progreso, Diario y Manual) y
  una noche con un eco.
- **Capturas:** las 55 están en `shots/recorrido/`, numeradas en orden, y `00-hoja.png` las muestra todas juntas.
  `shots/` no se sube al repo; para volver a sacarlas, `node tools/recorrido.mjs`. El script no forma parte de
  `npm test`.
- **Resultado:** 28 controles bien, 0 fallas y sin errores de consola en las dos pasadas.

## Arreglado en esta rama (`claude/recorrido-noche`)

1. **La llegada con Vera tenía el HUD encima.**
   - Detrás de Vera se veían la ficha, la misión y el riel. "Saltar (Esc)" se encimaba con el botón Bitácora, y la
     pista "Hacé clic en Construir para empezar" se leía debajo de "Hacé clic para seguir".
   - Ahora, mientras habla Vera, el HUD y la pista de la ciudad se ocultan (`body.st-seeing`, en `story-ui.js`).
     Vuelven al terminar.
2. **En la expedición guiada, la pista de Vera tapaba las opciones del imprevisto.** Las dos van abajo a la derecha,
   y la pista quedaba encima de la tarjeta. Ahora, con una tarjeta abierta, la pista va a la izquierda en pantalla
   ancha y arriba en pantalla angosta (`exp-guide.js`).
3. **En Construir, con mouse no se veían tres pestañas.** Monumentos, Deco y Caminos quedaban fuera del panel, a la
   derecha, sin barra para desplazarse. En pantalla ancha ahora van en dos renglones (`city-ui.js`).
4. **La lista del combate no resaltaba a quien elegías y cortaba los nombres.**
   - No resaltaba por un bug: una variable local tapaba la de la selección, en `combat-ui.js`.
   - Cortaba "Lobo de ojos bri…" y "Bestia del Bañ…". Desde 1280 px de ancho la lista mide 250 px y entran los
     nombres.

## Pendiente, por prioridad

### Alta
- **A. En el combate, la persona que juega se llama "Líder" y hay otro "Cazador".** Hecho en `claude/nombres-grupo`
  (DESIGN-COMBAT §16.6): "Irene · Cazador" y "Cazador de la ciudad". Es tema de la sesión de clases.
  - Irene eligió Cazador, pero la lista dice "Líder, Saqueador, Cazador, Forjador". El Cazador es alguien de la
    ciudad, y parece que el Cazador no fuera ella.
  - En Progreso pasa lo mismo: "Irene · Cazador" y, en El grupo, otro "Cazador".
  - Propuesta: mostrar "Irene" en el combate (hoy `unitLabel` de `combat-ui.js` fuerza "Líder" a propósito), y darle
    nombre propio o un rótulo distinto ("Cazador de la ciudad") a la gente del grupo.
- **B. A 1920×1080 la interfaz queda chica.** Es una decisión tuya.
  - Los paneles (Expedición, Construir, Bitácora, el onboarding) ocupan un tercio del ancho, con texto de 13 a 15 px y
    mucho espacio vacío alrededor.
  - Ya existe la escala de interfaz en Ajustes (80 % a 150 %, viene en 100 %).
  - Propuesta: que en el juego de PC arranque en 115 % o 125 % desde 1600 px de ancho. No lo cambié porque mueve
    todas las pantallas y conviene mirarlo en la ventana real.

### Media
- **C. (Resuelto en `claude/retoques-recorrido-96dd76`: con Vera guiando, el aviso de abajo dice solo la zona y el objetivo, `exp-scene.js`.) En la primera expedición hay dos instrucciones iguales a la vez.** Abajo a la izquierda dice "Hacé clic en una
  casilla vecina para avanzar", y Vera, a la derecha, dice lo mismo. Mientras habla Vera, la de abajo podría callarse.
- **D. (Resuelto en `claude/retoques-recorrido-96dd76`: las líneas sueltas de Vera esperan a la llegada, a las subidas de nivel y a cualquier aviso de premio; si el aviso sale con una hoja a la vista, la hoja se esconde y se pausa, y sigue al cerrarlo, `story-ui.js`, `story.js`, `main.js`.) Una línea de Vera queda congelada detrás de la subida de nivel.** La hoja de Vera empezó a escribirse ("P") y
  quedó trabada abajo a la izquierda, detrás del cartel "¡Nivel 3!". Parece roto. Mejor que espere a que se cierre el
  cartel. La captura es `43-ciudad-despues-pelea.png`.
- **E. (Resuelto en `claude/recorrido-ajustes`: el nivel 3 abre 6 cosas y el expediente; ver DESIGN-CORE §8.z.) La subida al nivel 3 desbloquea 11 cosas de golpe.** Florería, Dispensario, Tambo, cerezo, fuente, camino,
  expediente, peinado y tres prendas: es mucho para leer a la vez. Es ritmo de desbloqueos, así que va para la sesión
  de la Raíz (economía).
- **F. (Resuelto en `claude/recorrido-ajustes`: el turno 1 no marca agua y Vera explica la franja la primera vez; DESIGN-COMBAT §8.) En la pelea de la bestia, casi todo el lado del grupo arranca rayado en rojo, con "−1" en cada casilla.**
  Antes de entender las casillas marcadas se lee como ruido. Una línea de Vera la primera vez, o marcar menos en el
  turno 1, ayudaría. Va para la sesión de clases (combate).

### Baja
- **G. (Resuelto en `claude/retoques-recorrido-96dd76`: el eco de la ciudad tiene una columna de luz tenue con motas que suben y un sonido de vidrio bajo al aparecer; el primero lleva una marca, "Algo se mueve en el borde", que queda en el borde de la pantalla si el eco está fuera de cuadro y lleva la cámara hasta él. Con un eco a la vista la cámara puede llegar hasta el borde de la isla, `echo-fx.js`, `city-act1.js`, `audio/engine.js`.) El eco de noche cuesta encontrarlo.** Sale en el borde de la isla, pálido y con lluvia. Aun con la cámara
  encima queda cerca del borde de la pantalla. Un brillo suave o una línea de Vera la primera noche ayudarían.
- **H. (Resuelto en `claude/retoques-recorrido-96dd76`: desde 1200 px de ancho el panel mide el 36 % de la ventana (entre 500 y 720 px), las muestras de color pasan a 48 px y bajan de renglón, y crecen las tarjetas y los textos. Ya no cambia de ancho entre un paso y otro, `onboarding.js`.) Personaje y clase a 1920×1080:** el panel de la derecha es angosto y las muestras de color son chicas. Se
  resuelve junto con B.
- **I. (Revisado: no es un error, no se cambió.) Cinemática:** a 16:9 se ve bien. En el plano 2 la torre se corta arriba (es a propósito, para que se vea
  alta). Los seis subtítulos entran en una línea.

### Segunda pasada (retoques C, D, G, H e I)
- `node tools/recorrido.mjs`: 30 controles bien, 0 fallas y sin errores de consola, con 56 capturas. La nueva es
  `54-noche-eco-marca.png`, el primer eco con su marca.
- **Visto en las capturas:**
  - En `26` queda una sola instrucción, la de Vera.
  - En `43` el cartel de nivel sale sin nada detrás.
  - En `09` y `11` el panel mide 690 px en los dos pasos.
  - En `55` el eco queda centrado, con su brillo.
- **Juego de PC al 115 %:** lo miré con una ventana de 1670×939 a 1,15 (es lo que ve el WebView a 1920×1080). El panel
  mide 691 px en pantalla y las muestras, 55 px.
- **Arreglado (rama `claude/retoques-interfaz`):** con el cartel de nivel abierto, los avisos "Misión cumplida" y "Pase
  de Temporada" se ponían encima del título "Subiste de nivel". Ahora `ui.toast` los guarda mientras hay un cartel de
  premio (`.reward-modal`) y los muestra de a uno cuando se cierra.

### Economía
En este recorrido no vi nada raro de economía. La salida corta gratis llegó a tiempo, la Huerta dio las 4 provisiones
y el Taller pidió 3 de madera después de la primera salida. Lo único es el punto E.

## Juego de PC (`npm run desktop:dev`)
- **Cómo lo corrí.** El puerto 5173 lo tenía el servidor de otra sesión: con `desktop:dev` la ventana habría cargado
  ese código. Por eso armé la app de prueba con el juego de esta rama adentro (`node stage.mjs` y
  `cargo build --features tauri/custom-protocol`).
  - La abrí con un perfil de WebView2 aparte (`WEBVIEW2_USER_DATA_FOLDER`), para no tocar el guardado real.
  - Duró 15,6 s, en una sola corrida, y la cerré al final.
- **GPU:** como mucho 35 °C, 50 W y 41 % de uso, con `nvidia-smi` cada segundo. Lejos del corte de 70 °C / 100 W.
- **Qué se vio:**
  - Arranca como app de escritorio: `tauri.localhost` y `__TAURI__`, en una ventana de 1280×800.
  - Aparece el logo de Dezings animado, después el splash y, con un clic, la cinemática.
  - El navegador llama a `requestAnimationFrame` a la frecuencia del monitor (178 por segundo), pero el juego dibuja
    con su tope de 60 (`frame-cap.js`).
  - Las capturas son `pc-1-logo.png` a `pc-4-cinematica-2.png`, en `shots/recorrido/`.
- **Arreglado:** en la ventana de 16:10 el continente del primer plano se cortaba a los costados. La cinemática estaba
  encuadrada para 16:9. Ahora, en ventanas más angostas, la cámara se aleja en proporción, hasta 1,5 veces como mucho
  (`intro.js`). A 16:9 no cambia nada.
- **No probé** el instalador `.exe` ni la pantalla completa. Tampoco el resto del recorrido dentro de la ventana: la
  cinemática y lo que sigue ya están en el recorrido headless.
