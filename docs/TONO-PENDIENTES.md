# Tono: textos pendientes de reescribir

Claves de `src/i18n/es.js` que chocan con la guía nueva, **"refugio cálido, mundo oscuro"** (Guía de tono de
[DESIGN.md](../DESIGN.md); paso U1 de [PLAN-FOTO.md](PLAN-FOTO.md)). Es solo la lista con una propuesta: **ningún texto
se cambió todavía**. Revisado sobre `es.js` del 2026-11-10 (777 líneas). Al aplicar: cambiar `es.js`, repetir en los
otros 8 idiomas, `node subset-fonts.mjs` y `npm run bump`.

Orden: de lo que más choca a lo que menos.

## 1. Texto que choca de frente (cambiar ya, no depende de nada)

| Clave | Hoy | Propuesta | Por qué |
|---|---|---|---|
| `boot.tips` | Plantando árboles…\|Pintando techos…\|Aflojando las nubes…\|Barriendo las veredas…\|Regando las flores…\|Encendiendo los faroles…\|Horneando medialunas…\|Dándole cuerda al reloj…\|Revisando el mapa viejo…\|Atando los botes…\|Despertando al barrio…\|Afinando la calesita…\|Acomodando la plaza…\|Mirando qué hay debajo de las islas… | Encendiendo los faroles…\|Revisando el mapa viejo…\|Atando los botes…\|Contando lo que quedó…\|Cerrando el cerco…\|Juntando leña…\|Afilando lo que hay…\|Mirando qué hay debajo de las islas…\|Esperando que afloje la niebla…\|Anotando quién volvió… | Es lo primero que se lee y es puro pueblo alegre (flores, medialunas, calesita). Se conservan los cuatro que ya están en tono. |
| `ui.reward.title` | ¡Bien! | Botín | Califica y exclama. |
| `ui.reward.ok` | Genial | Guardar | Botón que festeja. |
| `hud.rank.ready` | ¡Ya podés subir a {rank}! | Rango {rank} disponible | Exclamación y entusiasmo. |
| `hud.quest.claim` | ¡Hacé clic para cobrar! | Cobrar | Exclamación; el cartel ya es un botón. |
| `city.float.level` | ¡Nivel {n}! | Nivel {n} | Exclamación. |
| `city.float.mastery` | ¡Maestría {n}! | Maestría {n} | Exclamación. |
| `city.info.monDone` | ¡Monumento terminado! | Monumento terminado | Exclamación; lo grande se marca con luz y sonido. |
| `settings.gfx.particlesHelp` | Confeti, polvo y brillos. | Chispas, polvo y ceniza. | El confeti sale del juego. |
| `settings.a11y.motionHelp` | …Con "Sí" no hay sacudones, confeti ni cosas volando. | …Con "Sí" no hay sacudones, destellos ni cosas volando. | Ídem. |
| `city.say.change` | Voy a cambiarme. | Me cambio y salgo. | Línea de vestidor; que suene a alguien que sale. |
| `city.prod.siesta` | …la ciudad duerme la siesta: junta más lento (lleno en {time}) | …la aldea está quieta: junta más lento (lleno en {time}) | Postal de pueblo. Además depende de un reloj (ver §3). |
| `city.look.plain.5` | borde dorado y estrella girando | borde de bronce y farol encendido | Adorno de feria. **Depende del modelo**: cambiarlo junto con la pieza (M2). |
| `city.look.plain.2` | cantero de flores | cantero | Menor; va con el modelo. |
| `city.land.desc` | …más lugar para casas, negocios y jardines. | …más tierra firme para construir. | "Jardines" y tono de catálogo. |
| `city.land.max` | Tu terreno ya es enorme ({size}) | Terreno al máximo ({size}) | Adjetivo grande; además duplica `city.land.atMax`. |
| `settings.acc.shareText` | Sumame en Pixelia. Mi código de amistad es {code} | Estoy en Pixelia. Mi código es {code} | "Amistad" en un juego que dice Contactos. |
| `settings.acc.yourCode` / `settings.acc.copyAria` | Tu código de amistad / Copiar código de amistad | Tu código de contacto / Copiar código de contacto | Ídem. |
| `settings.acc.codeCopied` | Código copiado. Pasáselo a tu gente | Código copiado | Sobra la segunda frase. |
| `settings.acc.noAccountText` / `settings.acc.offlineText` | …visitar las ciudades de tus contactos, mandarles regalos, intercambiar hallazgos… | …visitar las aldeas de tus contactos, mandarles provisiones, intercambiar hallazgos… | "Regalos" es de juego social; afuera se mandan cosas que sirven. Depende de qué quede del online. |

## 2. Nombres de rasgos y talentos (botín: lo que más se va a leer al farmear)

| Clave | Hoy | Propuesta | Por qué |
|---|---|---|---|
| `arsenal.trait.botin.name` | Afortunada | Carroñera | "+1 material al ganar": no es suerte, es revisar lo que quedó. |
| `arsenal.trait.curas.name` | Bendita | Piadosa | Menor. "Bendita" suena a premio; vale dejarla si gusta. |
| `arsenal.trait.temple.name` | Dócil | Mansa | Menor; "dócil" es de mascota. |
| `talents.sup_animo.name` | Buen ánimo | Cabeza fría | Nombre alegre para un talento de aguante. |
| `talents.sup_botin.name` | Mochila llena | No se deja nada | Ídem. |
| `talents.of_hallazgo.name` | Buen ojo | Ojo de rapiña | Menor; se pisa con el paragon "Ojo de hallazgo". |
| `arsenal.frame.brillo` / `arsenal.frame.aura` | Brillo de veta / Aura del oficio | Veta viva / Marca del oficio | "Brillo" y "aura" son de cosmético alegre. |
| `arsenal.toast.found` | Encontraste: {name} | Botín: {name} | Menor; más seco y sirve para cualquier idioma. |
| `arsenal.toast.foundAuto` | {name}: se desarmó sola | {name}: desarmada | Menor. |

## 3. Términos de sistema (decisión del usuario antes de tocar; cambian muchas claves y los 9 idiomas)

| Término | Dónde | Propuesta | Nota |
|---|---|---|---|
| **ciudad** | 24 líneas (`settings.game.you`, `settings.game.cityName`, `city.act.city`, `hud.rank.aria`, `city.info.*`, `progress.nav.ciudad`…) | **aldea** | El plan y la guía dicen "aldea". En la porción vertical es una aldea mínima; "ciudad" puede volver como nombre de una época tardía. Decidir una sola vez y pasar todo junto. |
| **Felicidad / Feliz** | `hud.happy`, `hud.happy.tip`, `hud.fx.happy`, `hud.fx.happyAria`, `city.info.happy`, `city.info.castleDesc` | **Abrigo** ("+{n} de abrigo", "Abrigo al máximo", "Con abrigo, todo rinde hasta un 50 % más") | Es el choque de sistema más grande: mide cuán refugio es la aldea. Alternativa: "Calma". No usar "Ánimo": ya es el recurso de la Travesía. |
| **Encanto** | 7 líneas (`hud.rank.title*`, `city.chip.charm*`, `city.info.charm*`, `city.info.fxCharm`) | **Renombre** | "Encanto" es de pueblo lindo. "Renombre" dice lo mismo (cuánto pesa la aldea) sin ternura. |
| **Municipalidad** | `city.side.home`, `settings.game.flag`, `city.info.fxLook` | **el Fogón** (o "la Casa Común") | Suena a trámite de ciudad. El edificio central debería ser el fuego de la aldea. Va con el modelo (M2). |
| **Expedición** | 10 líneas (`hud.expedition`, `city.guide.expedition`, `city.info.inExpedition`, `city.info.mats*`, `power.help`, `settings.keys.cardsDo`…) | **Travesía** | No es de tono: lo cambia A1 al retirar la grilla. Hoy conviven "expedición", "salida" y "travesía". |
| **Constructoras, gemas, Terminar ya, Martillo Mágico** | 11 líneas (`hud.builders*`, `hud.gems*`, `city.builders.*`, `city.build.buildersBusy`, `city.info.skip*`, `city.info.noGems`, `city.info.hammer*`) | Se borran | Son los relojes de celular: salen con A4. No reescribir; si alguna queda, "Martillo Mágico" → "Martillo de obra". |
| **Pase de Temporada, Diarias, Cofres** | `hud.pass.*`, `hud.daily.*`, `hud.chests`, `ui.chest` | Revisar en A4 | Vocabulario de juego de celular. Si quedan: "Encargos" por "Diarias", "Botín" por "Cofres". |
| **Combo "deco"** | `hud.happy.tip` ("Árboles, plantas y deco la suben") | "lo que se cuida" o listar | "Deco" es jerga de city-builder casual. |

## 4. Menores (pasada final, sin apuro)

| Clave | Hoy | Propuesta |
|---|---|---|
| `settings.preset.toast` / `settings.gfx.presetAuto` | Ajustamos los gráficos a tu compu… / …medimos tu compu y elegimos uno. | Gráficos ajustados a tu equipo ({preset}). Se cambia en Ajustes. / Sin elegir: se mide tu equipo en el primer rato y se elige uno. |
| `settings.stats.title` | Ayudanos a mejorar | Estadísticas de uso |
| `settings.reset.q2Cancel` / `common.betterNot` | Me arrepentí / Mejor no | Cancelar (o dejar "Mejor no": es seco y sirve) |
| `settings.gfx.outlineHelp` | La línea oscura alrededor de cada cosa: es parte del estilo del juego. | Revisar con R1: el render fotográfico puede no llevar contorno. |
| `city.act.refund` | Te devolvemos {coins}. | Se devuelven {coins}. |
| `boot.fail.title` / `settings.backup.noGame` / `settings.acc.loadFail` | No pudimos abrir Pixelia / No encontramos una partida ahí / Por ahora no pudimos cargar lo online… | Pixelia no abrió / Ahí no hay una partida / Lo online no cargó… (la guía pide interfaz sin "nosotros") |
| `city.info.poor` | No te alcanza todavía | No alcanza |
| `city.toast.provFull` | El depósito de provisiones está lleno: salí de expedición | Depósito de provisiones lleno |
| `settings.game.dayNightHelp` | Un día dura unos 20 minutos. Apagado, la ciudad queda siempre de día… | Revisar: con el tono nuevo, "siempre de día" apaga el plano modelo (la aldea de noche). |

## Ya están en tono (no tocar; sirven de modelo)
`boot.sub`, `boot.opening`, `intro.line.*`, `intro.label.*`, `arsenal.tech.*`, casi todo `talents.*`, `city.raiz.*`
("La raíz está cosiendo"), `arsenal.empty`, `progress.*`.

## Fuera de `es.js` (seguimiento, no es parte de U1)
- Textos todavía escritos en el código (expedición, amenazas, tutorial, historia, hallazgos, edificios): `es.js` tiene
  solo una parte del juego. Cuando pasen a `t()`, aplicar la guía en el mismo paso.
- Documentos que siguen diciendo "cozy": `DESIGN-RETENTION.md` (principios), `DESIGN-STORY.md` (§ "La ciudad es cozy" y
  "perder no cuesta nada"), `docs/i18n/tono-*.md` y `docs/i18n/plan-4b.md` (guías por idioma), `docs/PLAN-TRAVESIA.md`.
  Los históricos (`PLAN-QUIEBRE`, `HANDOFF-QUIEBRE`, `RESEARCH-retention`) pueden quedar como están.
- El resto de la cabecera de `DESIGN.md` (PWA para iPhone, ratos de 2 a 10 minutos, gemas) contradice el plan; U1 solo
  cambió la frase del tono.
- Sonido: `DESIGN-AUDIO.md` debería tomar la regla de festejos (sin fanfarria; luz, sonido grave y silencio).
