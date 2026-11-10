# PLAYTEST 1: el prototipo con cubos (PLAN-FOTO, paso A5)

Guía para probar el farmeo con 3 a 5 personas **antes de ponerle arte**. La pregunta es una sola: ¿la vuelta
"zarpar → elegir camino → pelear → traer botín → zarpar de nuevo" engancha sin gráficos? Si no, se ajusta acá.

No se prueba: el arte (son cubos y texto), el render, la historia, la aldea ni el sonido. Si alguien opina de eso,
se anota al margen y se sigue.

## 1. Qué se prueba

| Parte | Dónde está | Qué tiene que pasar |
|---|---|---|
| **Travesía por nodos** | `?scene=voyage&seed=N` (o el botón "Travesía (prototipo)" de la aldea) | Se entiende el mapa sin explicación, se eligen caminos con intención y una salida dura de 10 a 15 minutos |
| **Combate para farmear** | Se entra desde un nodo Pelea, Élite o Jefe | Tablero 6×6, pelea común de 1 a 2 minutos, se usan ×2/×3 y la resolución automática cuando la pelea ya no aporta |
| **Botín y árbol** (paso A3) | Cuando A3 esté integrado | Una pieza con rasgos cambia cómo se juega la salida siguiente; se abre el árbol sin que nadie lo pida |

Lo que hay en la Travesía hoy (nombres como salen en pantalla):
- Nodos: **Pelea**, **Élite**, **Evento**, **Campamento** y **Jefe** (la Bestia del Bañado). Isla: Bosque del Arroyo.
- Grupo fijo: Líder, Cazador, Forjador y Curandero. La vida no se repone sola entre peleas.
- Tras cada pelea se elige 1 de 3 recompensas. Hay 5 eventos con la consecuencia a la vista, 6 reliquias y un
  campamento (descansar o entrenar).
- "Volver a la aldea con lo juntado" desde el mapa trae todo; caer o retirarse en una pelea, la mitad.

Controles del combate (decirlos solo si los piden; ver el guion):
- Clic en una casilla: mover o apuntar. **1 a 9**: habilidad de la barra. **Tab**: cambiar de unidad. **Enter**: confirmar.
- **Espacio**: terminar el turno; durante una animación, la saltea.
- **+** (o el botón de velocidad): pasa por ×1, ×2 y ×3.
- **Esc**: cancela la habilidad elegida o abre el menú (retirarse).

## 2. Antes de la sesión

### Lista previa (el día anterior)
- [ ] A3 integrado en master, o decidido que se prueba sin botín ni árbol (entonces se saltea el bloque 4 del guion y
      la pregunta 6).
- [ ] La Travesía usa los encuentros de farmeo en 6×6 (`FARM.arroyo`) y ofrece **Resolver** en la tarjeta de pelea
      para lo ya superado. **Al 2026-11-10 no es así en master**: la Travesía todavía llama a los encuentros de la
      historia y `autoResolve` no tiene botón. Si llega el día y sigue igual, la resolución automática no se prueba y
      el combate 6×6 se prueba aparte, con `?scene=combat&enc=arroyo_elite_manada&marea=1`.
- [ ] Jugar vos las dos semillas fijas de punta a punta y anotar tu tiempo. Si cambió el generador, elegir otras.
- [ ] `?reset` en cada máquina, para que nadie arranque con una salida a medias.

### Build o enlace
- **Recomendado: el `.exe`** (`npm run desktop:build`, desde `tools/`), en una PC con mouse. Es lo que se va a vender.
- A distancia: el enlace web `https://alejomartineez.github.io/pixelia/?scene=voyage&seed=21`, con la persona
  compartiendo pantalla y micrófono. Sirve, pero se pierde la cara.
- Idioma: español. Los textos `voyage.*` no están traducidos.

### Semillas fijas
Todas las personas juegan las mismas dos primeras salidas, así los tiempos se comparan.

| Salida | Semilla | Mapa | Para qué |
|---|---|---|---|
| 1 | `21` | 5 filas, 3 entradas, 1 élite | Corta. Mide si el mapa se entiende solo |
| 2 | `9` | 6 filas, 2 entradas, 1 élite, 4 campamentos | Mide decisiones: élite o campamento |
| 3 en adelante | sin semilla ("Zarpar de nuevo") | al azar | Solo si la piden. Es el dato que más importa |

### Tiempo y lugar
- **30 a 40 minutos por persona**, de a una. No en grupo: se copian.
- Vos moderás y anotás. Si se puede, otra persona anota y vos solo mirás.
- Grabar pantalla y voz con permiso (OBS alcanza). Cronómetro a mano para las peleas.
- A quién invitar: gente que juegue en PC a algo con botín o por turnos. Al menos una persona que no te conozca tanto
  como para cuidarte. Nadie que haya visto el juego antes.

## 3. Guion del moderador

Regla general: **no explicar, no defender, no ayudar**. Si preguntan "¿qué hace esto?", la respuesta es "¿qué te
parece que hace?". Solo se interviene si la persona lleva 2 minutos trabada sin avanzar; se anota como traba y se
da la pista mínima.

No decir: "¿te gustó?", "¿está bueno?", "¿no te pareció lento?", "esto después va a tener…". No mencionar el ×2, la
resolución automática ni el árbol: parte de la prueba es ver si los encuentran.

**0. Entrada (2 min).** Decir, tal cual:
> "Es un prototipo sin gráficos: cubos y texto. No estoy probándote a vos, estoy probando el juego. Lo que no se
> entienda es un problema del juego. Pensá en voz alta mientras jugás. No te voy a contestar preguntas hasta el
> final, pero anotalas en voz alta. Podés cortar cuando quieras."

**1. Primera salida, semilla 21 (10 a 15 min).** Abrir la pantalla y callarse. No decir cuál es el objetivo.
Cronometrar cada pelea desde que aparece el tablero hasta la pantalla de resultado.

**2. Pausa corta (1 min).** Una sola pregunta: "Contame qué acaba de pasar." Anotar con sus palabras. No corregir.

**3. Segunda salida, semilla 9 (10 a 15 min).** Decir solo: "Hay otra salida preparada." Otra vez, callarse.

**4. Botín y árbol (5 min, si A3 está).** Al volver a la aldea no decir nada durante 30 segundos: ver si abre el
inventario o el árbol por su cuenta. Si no, decir: "Trajiste cosas. Fijate qué hay."

**5. El momento que importa.** Al terminar la segunda salida, decir: "Eso era lo que tenía preparado." Y **esperar
10 segundos en silencio**. Anotar qué hace: ¿toca "Zarpar de nuevo"?, ¿pregunta si puede seguir?, ¿suelta el mouse?
Si pide otra, dejarla jugar hasta el minuto 35.

**6. Cierre (5 min).** Las preguntas de la sección 5, en ese orden.

## 4. Qué observar y anotar

Con hora (minuto de la sesión) cada vez que se pueda.

**Tiempos**
- Duración de cada pelea y de cada salida. Meta: pelea común de 1 a 2 minutos, salida de 10 a 15.
- Tiempo desde que se abre la pantalla hasta el primer clic en un nodo.
- Tiempo en la tarjeta de recompensa (si elige en 2 segundos, no le importa; si tarda 20, hay decisión).

**Velocidad y resolución automática**
- ¿En qué pelea toca el ×2 o el ×3 por primera vez? ¿Lo encontró o hubo que decírselo?
- ¿Vuelve a ×1 alguna vez? ¿Cuándo (jefe, élite)?
- ¿Usa Espacio para saltear animaciones?
- ¿Usa la resolución automática? ¿En qué tipo de pelea y qué dice al usarla?
- Señal de alarma: usa ×3 o Resolver **en todas** las peleas desde el principio. Quiere el botín, no la pelea.

**Dónde se traba** (más de 20 segundos sin acción o una pregunta en voz alta)
- En el mapa: no ve qué nodos puede elegir, no distingue Élite de Pelea, no entiende que el Jefe está arriba.
- En el combate: no sabe mover, no encuentra las habilidades, no entiende la casilla que marca el enemigo, termina
  el turno sin querer con Espacio.
- En las tarjetas: no entiende un efecto ("−2 de vida a cada uno"), no entiende qué hace una reliquia.
- Al caer: ¿entiende que volvió con la mitad?

**Decisiones**
- ¿Qué camino elige y qué dice al elegir? ¿Va a la Élite o la esquiva?
- En el Campamento: ¿descansa o entrena? ¿Duda?
- ¿Vuelve a la aldea antes del jefe alguna vez?
- ¿Usa el terreno (matorral, lo alto, corriente) o las reacciones de elementos, o pega y nada más?

**Ganas**
- ¿Pide "una salida más"? ¿Con qué palabras?
- Frases textuales, buenas y malas. Sin resumir.
- Postura: se inclina hacia la pantalla, mira el celular, suspira en la tercera pelea.
- ¿Habla del botín que trajo o de la pelea que ganó? Lo que nombra es lo que le quedó.

## 5. Preguntas de cierre (8 como máximo)

En este orden. Abiertas; no sugerir respuestas ni completar frases.

1. ¿Cómo le contarías este juego a alguien que no lo vio?
2. ¿Cuál fue el momento en que más pensaste antes de hacer clic?
3. ¿Hubo algún momento en que quisiste que algo terminara más rápido? ¿Cuál?
4. ¿Qué fue lo que menos entendiste?
5. Cuando elegías el camino en el mapa, ¿qué mirabas?
6. De lo que trajiste, ¿hay algo que quieras usar en la próxima salida? ¿Qué y para qué? *(solo con A3)*
7. Si pudieras cambiar una sola cosa, ¿cuál sería?
8. Si te lo dejo instalado, ¿qué hacés ahora?

La 8 reemplaza a "¿lo jugarías?": la gente dice que sí por cortesía. Lo que cuenta es si describe una acción
concreta ("pruebo la élite con el otro camino") o una vaguedad ("lo miraría un rato").

## 6. Planilla por persona

Copiar una por persona en `docs/playtest-1/<nombre>.md` (o en papel).

```
Persona:                 Fecha:               Build / enlace:
Qué juega habitualmente:
A3 integrado: sí / no    Resolución automática disponible: sí / no

SALIDA 1 (semilla 21)    Empezó (min):        Terminó (min):       Resultado: jefe / cayó / volvió
  Primer clic en el mapa a los ___ s
  Pelea 1: ___ s  vel ×_  auto: sí/no     Pelea 2: ___ s  vel ×_  auto: sí/no
  Pelea 3: ___ s  vel ×_  auto: sí/no     Pelea 4: ___ s  vel ×_  auto: sí/no
  Pelea 5: ___ s  vel ×_  auto: sí/no
  Camino (tipos de nodo en orden):
  Trabas (minuto, dónde, cuánto duró, si hubo pista):

"Contame qué acaba de pasar":

SALIDA 2 (semilla 9)     Empezó (min):        Terminó (min):       Resultado: jefe / cayó / volvió
  Pelea 1: ___ s  vel ×_  auto: sí/no     Pelea 2: ___ s  vel ×_  auto: sí/no
  Pelea 3: ___ s  vel ×_  auto: sí/no     Pelea 4: ___ s  vel ×_  auto: sí/no
  Pelea 5: ___ s  vel ×_  auto: sí/no
  Camino:
  Trabas:

VELOCIDAD   Primer ×2 en: salida _ pelea _    Lo encontró solo: sí / no    Volvió a ×1: sí / no, cuándo:
AUTO        Primera vez en: salida _ pelea _  Qué dijo:
BOTÍN (A3)  Abrió inventario solo: sí / no    Abrió el árbol solo: sí / no   Cambió algo de lo que lleva: sí / no

EL MOMENTO  A los 10 s de "eso era lo que tenía preparado": zarpó de nuevo / preguntó si podía seguir /
            esperó / soltó el mouse
            Salidas extra jugadas: ___

FRASES TEXTUALES:

CIERRE  1:
        2:
        3:
        4:
        5:
        6:
        7:
        8:

SEÑALES (marcar)
  [ ] Pidió o empezó otra salida sin que se lo ofrezcan
  [ ] Pelea común promedio entre 60 y 120 s
  [ ] Dudó en al menos una decisión del mapa o del campamento
  [ ] Nombró una pieza, reliquia o rasgo por su nombre al cierre
  [ ] Contó el juego (pregunta 1) como "salir, pelear, traer"
  [ ] Sin trabas de más de 2 minutos
```

## 7. Engancha o no engancha

Se cuenta por persona cuántas de las 6 señales de la planilla marcó, y se mira el grupo.

**Engancha** (se pasa al arte, paso 5 del plan):
- Al menos **3 de 5** personas (2 de 3, 3 de 4) pidieron o empezaron otra salida sin que se lo ofrezcan, **y**
- la pelea común promedio del grupo está entre 60 y 120 segundos, **y**
- nadie tuvo una traba de más de 2 minutos en el mapa.

**Dudoso** (una ronda de ajustes y se repite con 2 personas nuevas): se cumple la primera condición a medias
(2 de 5) o falla una de las otras dos.

**No engancha** (se rediseña antes de cualquier arte): 0 o 1 persona pide otra salida, o la mayoría resuelve todo
con ×3 o automático desde la segunda pelea.

### Qué se ajusta según lo que se vio

| Lo que se vio | Qué significa | Qué se toca |
|---|---|---|
| Peleas de más de 2 minutos | El combate es largo para farmear | Vida de los enemigos y cantidad por encuentro (`src/combat/combat-data.js`, `farmHp`); ×2 por defecto en peleas comunes |
| ×3 o automático en todo desde el principio | La pelea común no aporta decisiones | Menos peleas comunes y más élites y eventos (`VOY.weights` en `src/voyage/voyage-data.js`); arquetipos de enemigo más marcados |
| Nadie toca ×2 ni automático y se aburren | No los encuentran | Botón de velocidad más visible; ofrecer Resolver en la tarjeta de pelea con el botín a la vista |
| Eligen la recompensa en 2 segundos | Las recompensas son números sueltos | Más reliquias que cambien reglas, menos "+1 de ataque" (`REWARDS`, `RELICS`) |
| Todos van a la Élite, o nadie | La Élite está mal pagada o mal cobrada | `VOY.elite.hp`, premio de la élite (hoy siempre da reliquia) |
| Nadie duda en el mapa | Los caminos son equivalentes | Más diferencia entre ramas: una de riesgo con élites, una segura con campamentos (`voyage-gen.js`) |
| Se traban en el mapa | No se lee qué se puede elegir | Resaltar los nodos a mano, leyenda de tipos, flecha de avance |
| Se traban en el combate | Falta enseñar | Primera pelea guiada de tres pasos; mostrar el alcance al elegir habilidad |
| No miran el botín (A3) | El botín no se siente | Menos piezas y más distintas; mostrar la comparación al recibirla; que un rasgo cambie una habilidad, no un número |
| Abren el árbol y lo cierran | Demasiado de golpe | Mostrar solo el primer anillo; primer nodo clave a 2 o 3 puntos |
| Caen antes del jefe y no vuelven a zarpar | Perder duele de más | Subir `VOY.loseLoot` (hoy 0,5); dejar algo fijo por nodo pisado |
| Ganan siempre y sin daño | No hay tensión | Marea II desde la segunda salida; menos cura en `VOY.camp.heal` |
| Piden otra salida pero cuentan el juego como "elegís cosas" | Engancha el mapa, no el combate | Se sigue, con el combate en revisión: comparar tiempos por pelea entre personas |

Después de la ronda: resumen de una página en `docs/playtest-1/RESUMEN.md` (tabla de señales por persona, las tres
trabas más repetidas, las cinco frases textuales más claras y la decisión: arte, ajustes o rediseño), y una línea en
`docs/HANDOFF-FOTO.md`.
