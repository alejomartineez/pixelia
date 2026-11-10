# Pixelia · Lo que falta traducir (generado)

Generado por `node tools/i18n-extract.mjs` el 2026-11-10. **No editar a mano**: se vuelve a generar. Sirve para repartir
el 4b por carpeta y por idioma (ver [plan-4b.md](plan-4b.md)).

- **Claves en es.js:** 672 (2.810 palabras).
- **Texto escrito directo en src/ sin t():** 2569 literales (estimación) en 108 archivos.
- **Archivos ya pasados a claves** (PASSED de test-i18n): 12.

## 1. Claves de es.js que faltan, por idioma

| idioma | tiene | faltan | palabras que faltan |
|---|---|---|---|
| en | 672 | 0 | 0 |
| zh-CN | 0 | 672 | 2.810 |
| ru | 0 | 672 | 2.810 |
| pt-BR | 0 | 672 | 2.810 |
| de | 0 | 672 | 2.810 |
| fr | 0 | 672 | 2.810 |
| ja | 672 | 0 | 0 |
| ko | 0 | 672 | 2.810 |

Por carpeta (la carpeta de src/ que usa la clave). Las columnas son las claves que faltan en cada idioma.

| carpeta | claves | en | zh-CN | ru | pt-BR | de | fr | ja | ko |
|---|---|---|---|---|---|---|---|---|---|
| (sin uso encontrado) | 8 | 0 | 8 | 8 | 8 | 8 | 8 | 0 | 8 |
| index.html | 5 | 0 | 5 | 5 | 5 | 5 | 5 | 0 | 5 |
| src | 6 | 0 | 6 | 6 | 6 | 6 | 6 | 0 | 6 |
| src/core | 193 | 0 | 193 | 193 | 193 | 193 | 193 | 0 | 193 |
| src/core + src/scenes | 23 | 0 | 23 | 23 | 23 | 23 | 23 | 0 | 23 |
| src/scenes | 437 | 0 | 437 | 437 | 437 | 437 | 437 | 0 | 437 |

Zonas de claves (el prefijo antes del primer punto) y qué idiomas las tienen completas:

| zona | claves | completa en |
|---|---|---|
| arsenal | 147 | en, ja |
| boot | 11 | en, ja |
| city | 154 | en, ja |
| common | 8 | en, ja |
| element | 1 | en, ja |
| gear | 1 | en, ja |
| hud | 43 | en, ja |
| power | 6 | en, ja |
| progress | 37 | en, ja |
| settings | 205 | en, ja |
| talents | 51 | en, ja |
| time | 4 | en, ja |
| ui | 4 | en, ja |

## 2. Texto escrito directo, por carpeta

Primero hay que pasarlo a claves en `es.js` (una sesión por carpeta, sin traducir); después cada idioma traduce las
claves nuevas. Palabras: estimación para calcular el trabajo de traducción.

| carpeta | archivos | literales | palabras |
|---|---|---|---|
| src | 1 | 26 | 262 |
| src/album | 3 | 171 | 548 |
| src/avatar | 1 | 10 | 16 |
| src/chests | 4 | 99 | 474 |
| src/cinema | 2 | 3 | 14 |
| src/city | 3 | 14 | 98 |
| src/combat | 5 | 263 | 1.759 |
| src/core | 36 | 604 | 2.656 |
| src/expedition | 7 | 177 | 1.061 |
| src/online | 9 | 331 | 1.902 |
| src/scenes | 21 | 384 | 2.152 |
| src/season | 6 | 100 | 550 |
| src/story | 5 | 278 | 2.899 |
| src/threats | 5 | 109 | 501 |
| **total** | 108 | 2569 | 14.892 |

### Por archivo

Con hasta tres ejemplos. "✔" = ya está en PASSED (lo que aparezca ahí es un nombre propio permitido o un falso
positivo de la estimación).

**src**

- `src/main.js`: 26 · `Ups, algo falló cargando` (l. 89) · `Muy pronto vas a poder jugar con más gente` (l. 122) · `Las cuentas online llegan muy pronto` (l. 127)

**src/album**

- `src/album/album-art.js`: 1 · `¡NUEVA!` (l. 177)
- `src/album/album-ui.js`: 47 · `Cofre de Madera` (l. 13) · `Cofre de Plata` (l. 13) · `Cofre de Oro` (l. 13)
- `src/album/album.js`: 123 · `Siesta en la Hamaca` (l. 19) · `Espejo de la Abuela` (l. 19) · `Vecina que Barre` (l. 19)

**src/avatar**

- `src/avatar/avatar-kit.js`: 10 · `Rosa viejo` (l. 66) · `Lavanda gris` (l. 66) · `Azul niebla` (l. 67)

**src/chests**

- `src/chests/chests-ui-common.js`: 11 · `¡Nueva!` (l. 48) · `Ya tenías todo: va en gemas` (l. 53) · `Monedas para tu ciudad` (l. 56)
- `src/chests/chests-ui-opening.js`: 9 · `Hacé clic en el cofre` (l. 66) · `Hacé clic para seguir ›` (l. 70) · `Saltar al resumen` (l. 72)
- `src/chests/chests-ui.js`: 36 · `No tenés ningún` (l. 26) · `Ese cofre no existe` (l. 26) · `Legendaria asegurada` (l. 52)
- `src/chests/chests.js`: 43 · `Común` (l. 12) · `Épica` (l. 14) · `Cofre de Madera` (l. 22)

**src/cinema**

- `src/cinema/narration.js`: 1 · `Antes del cielo hubo una sola tierra. Y por dentro` (l. 8)
- `src/cinema/poses.js`: 2 · `señalar` (l. 60) · `señalar` (l. 60)

**src/city**

- `src/city/models-kit.js`: 1 · `Vidrio y acero` (l. 435)
- `src/city/themes-ui.js`: 2 · `Elegí cómo se ve tu ciudad. Es gratis y lo cambiás` (l. 141) · `Estilo de tu ciudad` (l. 165)
- `src/city/themes.js`: 11 · `Pueblo Acogedor` (l. 66) · `Techos de teja, jardines verdes y cielo claro.` (l. 66) · `Otoño` (l. 83)

**src/combat**

- `src/combat/classes.js`: 48 · `Primera línea: aguanta y protege.` (l. 26) · `Abre paso por la fuerza.` (l. 26) · `Los del grupo que están a su lado reciben 1 menos.` (l. 29)
- `src/combat/combat-data.js`: 115 · `Agua baja` (l. 41) · `Lo alto` (l. 42) · `Árbol` (l. 43)
- `src/combat/combat-rules.js`: 26 · `La pelea terminó` (l. 317) · `No es tu turno` (l. 318) · `No se puede mover` (l. 319)
- `src/combat/combat-scene.js`: 26 · `Elegí a alguien del grupo (clic o Tab) y movelo a ` (l. 37) · `Después de moverse, cada uno actúa una vez. Con un` (l. 38) · `Cuando el grupo termine, Fin de turno (Espacio). D` (l. 39)
- `src/combat/combat-ui.js`: 48 · `desde acá` (l. 159) · `Quien lidera` (l. 170) · `En lo alto: +1 de daño` (l. 184)

**src/core**

- `src/core/achievements.js`: 6 · `Copa de la Municipalidad` (l. 8) · `Llevar la ciudad al rango Villa.` (l. 8) · `Maqueta del Faro` (l. 9)
- `src/core/ambience.js`: 15 · `Visión −1, y colinas, bañados y rocas cuestan 1 pr` (l. 45) · `La niebla tapa las casillas: visión −1.` (l. 47) · `La nieve frena: colinas, bañados y rocas cuestan 1` (l. 49)
- `src/core/arsenal.js` ✔: 1 · `leñador` (l. 50)
- `src/core/data.js`: 282 · `El corazón de la ciudad. Mejorala para dar bonus a` (l. 31) · `Sastrería` (l. 32) · `Ropa, peinados y sombreros: acá se arma tu Equipaj` (l. 33)
- `src/core/desktop.js`: 5 · `Hay una versión nueva` (l. 119) · `Pixelia ya está lista. Se baja, se instala y el ju` (l. 119) · `Más tarde` (l. 119)
- `src/core/economy.js`: 42 · `Fuera del terreno` (l. 45) · `Hay algo ahí` (l. 49) · `Ya está en la época actual` (l. 224)
- `src/core/hud.js` ✔: 1 · `señales` (l. 213)
- `src/core/i18n.js` ✔: 1 · `Español` (l. 17)
- `src/core/icons/combat.js`: 7 · `Raíz` (l. 7) · `Céfiro` (l. 151) · `Báculo` (l. 675)
- `src/core/icons/finds/autitos.js`: 9 · `Soga de Amarre` (l. 5) · `Canoa de Corteza` (l. 42) · `Brújula de Céfiro` (l. 79)
- `src/core/icons/finds/castillos.js`: 9 · `Ladrillo con Onda` (l. 5) · `Llave Perdida` (l. 42) · `Vela Tembleque` (l. 79)
- `src/core/icons/finds/fiesta.js`: 9 · `Globo Escapista` (l. 5) · `Cotillón Ruidoso` (l. 42) · `Gaseosa sin Gas` (l. 79)
- `src/core/icons/finds/flores.js`: 9 · `Margarita Me Quiere` (l. 5) · `Brote Valiente` (l. 42) · `Trébol (de Tres, Igual)` (l. 79)
- `src/core/icons/finds/index.js`: 5 · `Ropa de Viaje` (l. 19) · `Navegación` (l. 20) · `Fauna de la Isla` (l. 22)
- `src/core/icons/finds/joyas.js`: 9 · `Collar de Cuentas` (l. 5) · `Ojo Protector` (l. 42) · `Reloj de la Abuela` (l. 79)
- `src/core/icons/finds/mascotas.js`: 9 · `Erizo del Monte` (l. 5) · `Pez del Arroyo` (l. 42) · `Tortuga sin Apuro` (l. 79)
- `src/core/icons/finds/musica.js`: 9 · `Tambor Ruidoso` (l. 5) · `Radio de la Tía` (l. 42) · `Auriculares Enredados` (l. 79)
- `src/core/icons/finds/noche.js`: 9 · `Búho Desvelado` (l. 5) · `Farol de Papel` (l. 42) · `Luna Menguante` (l. 79)
- `src/core/icons/finds/playa.js`: 9 · `Caracol Chismoso` (l. 5) · `Cangrejo de Costado` (l. 42) · `Ojotas Perdidas` (l. 79)
- `src/core/icons/finds/postres.js`: 9 · `Galleta Robada` (l. 5) · `Caramelo de Miel` (l. 42) · `Dona Glaseada` (l. 79)
- `src/core/icons/finds/princesas.js`: 9 · `Siesta en la Hamaca` (l. 5) · `Espejo de la Abuela` (l. 42) · `Vecina que Barre` (l. 79)
- `src/core/icons/finds/vestidos.js`: 9 · `Medias Desparejas` (l. 5) · `Guantes de Cuero` (l. 42) · `Capelina de Verano` (l. 79)
- `src/core/icons/hud.js`: 3 · `Expedición` (l. 5) · `Bitácora` (l. 101) · `Tono de piel` (l. 960)
- `src/core/icons/index.js`: 3 · `Recursos y monedas` (l. 14) · `Acciones de interfaz` (l. 15) · `HUD, lugares y menú` (l. 16)
- `src/core/icons/land.js`: 3 · `Bañado` (l. 197) · `Otoño` (l. 677) · `Botiquín` (l. 1205)
- `src/core/icons/meta.js`: 7 · `Sobre de hallazgos` (l. 101) · `Reloj de arena` (l. 245) · `Poción` (l. 293)
- `src/core/icons/res.js`: 2 · `Corazón` (l. 532) · `Estrella apagada` (l. 627)
- `src/core/icons/ui.js`: 4 · `Información` (l. 669) · `Música` (l. 861) · `Sin conexión` (l. 1197)
- `src/core/icons/weather.js`: 3 · `Sequía` (l. 53) · `Bolsas de arena` (l. 773) · `Leña` (l. 917)
- `src/core/keys.js`: 25 · `Cámara y movimiento` (l. 6) · `Cámara y movimiento` (l. 7) · `Atrás` (l. 7)
- `src/core/people-data.js`: 38 · `cartógrafa` (l. 19) · `Volvé de 2 salidas: quiere comparar tus notas con ` (l. 22) · `Explorá una zona nueva para el mapa` (l. 23)
- `src/core/people.js`: 11 · `Llega con el rango` (l. 62) · `Llega cuando explores la primera zona del Bosque` (l. 63) · `Llega al explorar más` (l. 63)
- `src/core/quests.js`: 1 · `Recuerdo de los minijuegos` (l. 213)
- `src/core/raiz.js`: 26 · `Bonus chico: la Raíz rinde a media fuerza.` (l. 25) · `Lo cerramos y que duerma. Alguien tiene que ser el` (l. 26) · `Con medida` (l. 29)
- `src/core/state.js`: 2 · `Pixelín` (l. 77) · `Pixelín` (l. 155)
- `src/core/unlocks.js`: 3 · `la Expedición` (l. 25) · `mañana` (l. 78) · `mañana` (l. 79)

**src/expedition**

- `src/expedition/exp-ambience.js`: 3 · `Se hizo de noche. El Farol alumbra el camino.` (l. 46) · `Se hizo de noche: visión −1. Con el Farol del Tall` (l. 46) · `Pasó la .` (l. 48)
- `src/expedition/exp-data.js`: 57 · `Se rompió una bolsa de la vianda` (l. 35) · `No había vado: hubo que buscar por dónde cruzar` (l. 36) · `Una ampolla que no deja caminar tranquilo` (l. 37)
- `src/expedition/exp-guide.js`: 7 · `Desde la base, hacé clic en una casilla vecina par` (l. 12) · `Lo que juntás va a la carga, arriba a la derecha. ` (l. 13) · `Un imprevisto. Cada opción dice lo que cuesta y qu` (l. 14)
- `src/expedition/exp-rules.js`: 16 · `De noche: el Farol alumbra el camino.` (l. 99) · `De noche: visión −1 (el Farol la devuelve).` (l. 99) · `región` (l. 166)
- `src/expedition/exp-scene.js`: 24 · `No se pudo salir` (l. 215) · `Hacé clic en una casilla vecina para avanzar. El n` (l. 579) · `En rojo: si das ese paso, no te alcanza para volve` (l. 580)
- `src/expedition/exp-ui.js`: 36 · `${more ? (more === 1 ? ' · llega uno más durante l` (l. 28) · `provisión` (l. 37) · `0 provisiones 0 ánimo 06:00 despejado 0 carga` (l. 160)
- `src/expedition/expedition.js`: 34 · `Primero construí la Casa de Expediciones` (l. 149) · `Hay una salida en curso` (l. 150) · `Hacen falta provisiones para salir (hay )` (l. 151)

**src/online**

- `src/online/net-mock.js`: 76 · `Solo podés hacer eso con tus contactos` (l. 77) · `Los datos del regalo no son válidos` (l. 88) · `Ese paquete es demasiado grande` (l. 89)
- `src/online/net.js`: 30 · `Modo sin conexión` (l. 12) · `Tenés que iniciar sesión para jugar online` (l. 13) · `Llave de casa` (l. 22)
- `src/online/social-account.js`: 36 · `Tu cuenta` (l. 22) · `Jugar online, ¡muy pronto! El modo online se activ` (l. 38) · `Modo simulado (para pruebas) Simula el servidor en` (l. 43)
- `src/online/social-common.js`: 4 · `recién` (l. 36) · `hace días` (l. 40) · `moño` (l. 164)
- `src/online/social-mail.js`: 51 · `Un hallazgo` (l. 29) · `Objeto de la mochila` (l. 33) · `Para terminar una obra` (l. 35)
- `src/online/social-trade.js`: 39 · `¿Con quién?` (l. 29) · `Buscando tus contactos…` (l. 32) · `Todavía no tenés contactos` (l. 36)
- `src/online/social-ui.js`: 37 · `Buzón` (l. 23) · `Tu cuenta` (l. 45) · `¿Cómo funciona?` (l. 115)
- `src/online/social-week.js`: 36 · `¡ a tus cofres!` (l. 22) · `¡ hallazgos nuevos en tu colección!` (l. 23) · `Armando el podio…` (l. 37)
- `src/online/social.js`: 22 · `Estrellas de expedición` (l. 48) · `Salidas de la semana` (l. 49) · `Botín de las Expediciones del día` (l. 50)

**src/scenes**

- `src/scenes/arrival.js`: 26 · `Cofre de Madera` (l. 30) · `Cofre de Plata` (l. 30) · `Cofre de Oro` (l. 30)
- `src/scenes/city-act1.js`: 11 · `Algo se mueve en el borde` (l. 85) · `Página nueva del diario: .` (l. 123) · `Queda anotado en el Diario de la Bitácora.` (l. 123)
- `src/scenes/city-common.js`: 10 · `¿Todo bien?` (l. 45) · `Qué día, eh.` (l. 45) · `Acá ando.` (l. 45)
- `src/scenes/city-place.js`: 22 · `No queda lugar libre. Ampliá el terreno` (l. 197) · `Atajo: mantené apretado un edificio para levantarl` (l. 213) · `Atajo: mantené el dedo sobre un edificio para leva` (l. 213)
- `src/scenes/city-ui.js` ✔: 5 · `Constructoras ocupadas` (l. 277) · `Constructoras ocupadas` (l. 355) · `No te alcanza` (l. 638)
- `src/scenes/city-visit.js`: 34 · `Linda ciudad. Me quedo a vivir.` (l. 73) · `Pasé a saludar.` (l. 73) · `Te copio la plaza, avisame si molesta.` (l. 73)
- `src/scenes/class-pick.js`: 25 · `Va adelante y aguanta los golpes por el resto.` (l. 20) · `Pega de lejos, marca al enemigo y ve antes los pel` (l. 21) · `Levanta barreras, arma trampas y abre camino donde` (l. 22)
- `src/scenes/install-card.js`: 5 · `Ahora no` (l. 94) · `Llevate Pixelia a tu inicio Se abre a pantalla com` (l. 101) · `Instalar Pixelia` (l. 102)
- `src/scenes/intro.js`: 7 · `Antes del cielo hubo una sola tierra. Y por dentro` (l. 23) · `Las Casas la cavaron para tener más. Siempre un po` (l. 24) · `Los de abajo robaban lo que quedaba. Alguien tenía` (l. 25)
- `src/scenes/onboarding.js`: 27 · `Simón` (l. 19) · `Villa del Lago` (l. 22) · `Puerto Sereno` (l. 22)
- `src/scenes/panels-common.js`: 9 · `Sí` (l. 251) · `Expedición` (l. 372) · `Ver ciudad` (l. 383)
- `src/scenes/panels-expedition.js`: 20 · `Expedición` (l. 81) · `En la ciudad` (l. 110) · `La salida normal al Cerro va a la mina: en el fond` (l. 127)
- `src/scenes/panels-progress.js`: 20 · `población` (l. 142) · `La ciudad` (l. 321) · `Para falta:` (l. 325)
- `src/scenes/panels-quests.js`: 34 · `Completaste todas las misiones Sos oficialmente la` (l. 83) · `Misión de Premio` (l. 92) · `Cobrar premio` (l. 101)
- `src/scenes/panels-rank.js`: 28 · `expansiones más` (l. 19) · `Una expansión más` (l. 19) · `+ % de producción` (l. 21)
- `src/scenes/panels-rewards.js`: 29 · `Premio diario` (l. 28) · `Hasta mañana` (l. 30) · `Abrir regalo` (l. 30)
- `src/scenes/panels-settings.js` ✔: 2 · `Pixelín` (l. 162) · `Esc Enter 1 – 4` (l. 240)
- `src/scenes/panels-story.js`: 26 · `Bitácora` (l. 91) · `Acto · · Capítulo` (l. 122) · `Qué sigue` (l. 125)
- `src/scenes/panels-works.js`: 21 · `Construí la Casa de Expediciones para salir a busc` (l. 24) · `Tus materiales` (l. 33) · `Sale más en` (l. 41)
- `src/scenes/panels-workshop.js`: 6 · `Hace falta el Taller` (l. 52) · `Faltan materiales` (l. 61) · `Faltan materiales: los trae la expedición` (l. 61)
- `src/scenes/wardrobe.js`: 17 · `Castaño` (l. 21) · `Color de marcas` (l. 34) · `Color de pelo` (l. 34)

**src/season**

- `src/season/events-ui.js`: 18 · `Producción` (l. 11) · `Cofres de las salidas de 3★` (l. 11) · `Materiales de expedición` (l. 11)
- `src/season/events.js`: 2 · `★ ¡Completa!` (l. 82) · `Carrera de Estrellas: ¡escalón logrado!` (l. 163)
- `src/season/season-data.js`: 48 · `Primavera en Flor` (l. 13) · `Florece todo, hasta lo que nadie plantó.` (l. 13) · `Carnaval de Pixelia` (l. 14)
- `src/season/season-ui-common.js`: 1 · `.modal.ssn { isolation: isolate; --a: var(--primar` (l. 91)
- `src/season/season-ui.js`: 22 · `¡ !` (l. 25) · `Pase de Temporada` (l. 39) · `Temporada · día de 28 Termina en ¿Cómo gano chispa` (l. 47)
- `src/season/season.js`: 9 · `Ya tenés todas las prendas premium` (l. 123) · `Cofre de Madera` (l. 200) · `¡Pase de Temporada: nivel ! Pasá a cobrar` (l. 307)

**src/story**

- `src/story/echoes.js`: 10 · `Los que cavaban` (l. 18) · `Dos mineros cavan a la luz de un farol. Uno se par` (l. 19) · `Los que subieron` (l. 22)
- `src/story/raiz-ui.js`: 10 · `+ por día${E.cap < 100 ?` (l. 49) · `La Grieta no sube` (l. 50) · `amenaza más por temporada` (l. 54)
- `src/story/story-data.js`: 250 · `la cartógrafa` (l. 14) · `Brígida` (l. 37) · `el que subió del Bajo Mundo` (l. 41)
- `src/story/story-ui.js`: 3 · `Diálogo` (l. 195) · `Después` (l. 218) · `Hacé clic para seguir` (l. 311)
- `src/story/story.js`: 5 · `Página nueva del diario:` (l. 110) · `Otra vez abajo. Cada vuelta se cansa más: la próxi` (l. 187) · `Siguen en el borde. Cortá la pasarela primero y qu` (l. 188)

**src/threats**

- `src/threats/threat-calendar.js`: 4 · `señales` (l. 61) · `ya pasó` (l. 76) · `mañana` (l. 80)
- `src/threats/threat-data.js`: 22 · `Crecida del arroyo` (l. 37) · `Pasó la crecida` (l. 38) · `Las casas y negocios a 4 casillas o menos del arro` (l. 39)
- `src/threats/threat-scene.js`: 21 · `Se viene : . Hacé clic en el aviso de arriba para ` (l. 83) · `señales` (l. 91) · `señales` (l. 108)
- `src/threats/threat-ui.js`: 53 · `días` (l. 57) · `1 día y h` (l. 57) · `Amenaza de la temporada` (l. 70)
- `src/threats/threats.js`: 9 · `Un contacto` (l. 67) · `Esa amenaza no es hoy` (l. 331) · `Todavía no llegó` (l. 332)

## 3. Claves de es.js que no se encontraron en el código

Pueden armarse con un prefijo que la herramienta no ve (una variable) o haber quedado sin uso. Revisar antes de
borrar.

`common.pct` · `arsenal.gender.espada` · `arsenal.gender.hacha` · `arsenal.gender.arco` · `arsenal.gender.baston` · `arsenal.gender.martillo` · `arsenal.gender.lanza` · `arsenal.gender.escudo`
