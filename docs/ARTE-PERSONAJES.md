# Arte de personajes: caras, proporciones y color

Guía del paso 4a de El Quiebre (plan §M1 y §M2). Vale para la gente en vóxel de `src/avatar/figure.js`, que va a 1/48 de
unidad y mide de 40 a 55 vóxeles, vista con la cámara isométrica a media distancia sobre la interfaz oscura.

Sale de una investigación de juegos y foros de arte (fuentes al final). Las referencias son inspiración: no se copia
ningún personaje de otro juego. Donde una regla es deducción nuestra para esta escala y no la dice ninguna fuente, va
marcada con **(nuestra)**.

## 1. Lo que dicen los juegos y los foros

### Caras con pocos vóxeles
- **El ojo depende de la resolución.**
  - 1 × 1 alcanza en figuras de 8 a 16 px.
  - 2 × 1 o 1 × 2 empieza a dar expresión: el ojo de Mario son 2 píxeles apilados.
  - Desde 2 × 2 entran la pupila y el brillo, y recién en retratos de 48 px o más, el iris y el párpado.
  - Fuentes: [pixnote], [Derek Yu].
- **Sin pupila con blanco ni dientes en figuras chicas.** Se vuelven ruido y la cara queda caricaturesca o con ojos
  saltones. Los oscuros van casi solo a la pupila, y el ojo se marca por contraste con la piel, no con línea negra.
  Fuentes: [androidarts], [foro de Aseprite], [Pixel Joint].
- **Lo que se modela y lo que se pinta.**
  - En las caras low-poly, la geometría va al arco de las cejas, a los párpados y a las comisuras [Polycount].
  - Hytale pinta ojos y boca sobre cubos simples [Hytale 2025].
  - En vóxel (nuestra): se modela lo que tiene que hacer sombra (el ceño que sale 1, la nariz de 1 o 2, la barba y el
    bigote como masa) y se pintan el ojo, el párpado y la boca.
- **Medidas de una cara vóxel real**, de Shadows of Doubt [colepowered]:
  - cara de 5 de ancho;
  - ceja masculina de 5 y femenina de 3, que deja ver el pómulo;
  - nariz de 2 o de 1;
  - frente de 3 de alto;
  - la barba es una pieza aparte.
- **Dónde va cada cosa** [Slynyrd 17]:
  - los ojos, a mitad de la cabeza, separados por el ancho de un ojo;
  - la base de la nariz, a mitad de camino entre los ojos y el mentón;
  - la boca, del ancho entre las pupilas;
  - la oreja, de la ceja a la base de la nariz.
- **Gesto serio.**
  - Las cejas en V con ojos más chicos leen enojo; la ceja que sube adentro lee tristeza [pixnote].
  - Para serio sin enojo (nuestra): ceja recta, pegada al ojo y sin piel en el medio.
  - A esta escala, la boca es opcional [pixnote]: con barba no va.

### Proporciones
- **Cabezas de alto por tamaño** [pixnote]:
  - 16 px, de 2 a 3 cabezas;
  - 32 px, de 3 a 4;
  - 48 px o más, de 4 a 6, la proporción "realista".
- **El modelo de trabajo de Slynyrd** tiene 6 cabezas, "un toque del lado tierno" [Slynyrd 17].
- **En sprites chicos la cabeza crece** para que la cara se lea, pero no tanto como para que los brazos dejen de leerse
  [Slynyrd 22], [Derek Yu].
- **Veloren** estiró a sus personajes y les puso cuello para que entrara el detalle de armadura [Veloren].
- **La silueta se lee rellena de negro**, sin luz [TF2], [pixnote]:
  - el arma es parte de la silueta;
  - cada clase tiene su forma.
- **Se arma con la geometría más simple** y se suman piezas solo donde mejoran la silueta [Hytale 2025].
- **Para esta escala (nuestra):**
  - de 3,8 a 4,5 cabezas para un tono serio;
  - menos de 3,5 se ve infantil, y más de 5 hace que la cara no se lea a distancia de juego.

### Colorimetría
- **De 3 a 5 tonos por rampa** y de 6 a 12 colores por personaje [pixnote], [Pixel Palette Swap]. El orco de
  Derek Yu tiene 3 verdes.
- **Cambio de matiz en la rampa:** la luz va hacia lo cálido (hasta unos 20° por paso) y la sombra hacia lo frío
  [Slynyrd 1], [androidarts].
- **La saturación es máxima en los medios** [Slynyrd 1]:
  - los claros pierden saturación;
  - los oscuros pueden seguir ricos.
- **Nada de sombra gris ni de negro o blanco puro** [Hytale 2025], [Trove]:
  - la sombra lleva color;
  - nada más oscuro que unos RGB 10,10,10;
  - las rampas no se terminan mezclando con negro [androidarts].
- **Rampa de piel** [androidarts], [Pixel Palette Swap]: la luz casi amarilla o durazno, el medio anaranjado, la sombra
  hacia el rojo o violeta y la sombra honda hacia un violeta frío.
- **Contra el barro:**
  - mover el matiz en vez de solo oscurecer;
  - un tono dominante con pocos acentos saturados [Pixel Palette Swap], [androidarts];
  - el entorno apagado con zonas chicas saturadas [TF2];
  - **mirar la captura en grises:** si los valores están bien, se lee igual [Derek Yu].

### Contorno y oclusión
- Las líneas de adentro van con el color de sombra, no con negro. El contorno negro fuerte embarra los colores de adentro
  [Derek Yu], [androidarts].
- La oclusión por vértice es de 4 niveles [0fps]. **(nuestra)**
  - El ceño tiene que tirarle sombra al ojo a propósito.
  - No hay que hundir toda la cara, porque la oclusión la oscurece entera.
  - La piel va un escalón más clara que el resto, así el contorno y la oclusión no la tapan.

## 2. Plantilla de cara (`buildHead` y `eyeVoxels`)

Cabeza humana de 10 × 12 × 10 (`hw`/`hh`/`hd` en `PEOPLE`). La cara mira a +Z, en la capa `fz`. Las filas cuentan
desde el mentón:

| Fila | Qué va | Volumen |
|---|---|---|
| `ey + 1` | ceño de lado a lado, con las cejas del color del pelo **justo encima del ojo** | sale 1 (`fz + 1`) |
| `ey − 1` a `ey` = 5 | ojo **negro de 2 × 2** (`EYE_INK`), sin blanco, bien marcado contra la piel (pedido del usuario: la ranura de 2 × 1 era muy chica); entre los ojos, el puente de la nariz | ojo al ras; malla aparte que parpadea con el pivote a su altura |
| 3 a 4 | nariz de 2 de ancho; la punta, en la fila 3 | sale 1 y la punta 2 |
| 1 | boca: una línea de 2 (`lip`), solo si no hay barba | pintada |
| 0 | mentón | sale 1 |

- **Separación:** el puente de la nariz, de 2 vóxeles, separa los ojos. En los orcos los ojos se abren uno más.
- **Gesto por pueblo:**
  - humanos: ceja recta, que da serio;
  - enanos y orcos: el extremo de afuera de la ceja sube uno, que da gesto duro;
  - enanos, además: cejas tupidas (2 filas), nariz de 4 de ancho y cara de 12.
- **Barba (`drawFace`)** como masa:
  - cubre la mandíbula y sale 2;
  - las patillas bajan por los costados;
  - el bigote es un alero aparte, más claro, que tapa la boca y cae en las puntas;
  - la parte larga se angosta de a poco y se adelanta;
  - lleva 3 tonos por altura (luz arriba, base y punta oscura);
  - los surcos, cada 3 columnas, van solo en las barbas largas y solo adelante.
- **Gente-zorro:**
  - cabeza de 10 × 11, con la máscara crema en las mejillas y la quijada;
  - el hocico se afina en 3 escalones (6, 4 y 2 de ancho), así de frente se ven anillos y no un agujero;
  - nariz negra de 2 × 1 en la punta;
  - ceño naranja oscuro y una lágrima oscura del ojo al hocico;
  - el ojo es negro de 2 × 2, como el de todos;
  - orejas de 8 con el adentro oscuro y la punta negra.
- **Lo que va en la cabeza no tapa la cara:**
  - el pañuelo arranca en `ey + 3`, pegado al cráneo;
  - el nasal del casco baja solo hasta el ojo;
  - el parche es de 2 × 2.

## 3. Rampas de color (`ramp` en `avatar-kit.js`)

`ramp(color, k, opciones)` da el paso `k` de la rampa de un material:
- **Luz (`k > 0`):**
  - sube unos 8 % de luminosidad por paso;
  - el matiz gira hacia el ocre (48°);
  - baja un poco la saturación.
- **Sombra (`k < 0`):**
  - baja un 20 % de la luminosidad por paso, en proporción, así un carbón no se vuelve negro;
  - el matiz gira hacia el violeta frío (255°);
  - sube un poco la saturación.

**Piel (`paletteOf`)**: 4 tonos, más 2 para la cara.

| Tono | Paso | Para qué |
|---|---|---|
| `skinL` | +1 | luz |
| `skin` | 0 | base |
| `skinD` | −1 | sombra |
| `skinDD` | −2,4 | hendijas |
| `lid` | −2,4 mezclado 60 % con tinta | párpado y cuenca: oscuro y apagado. Con −1,6 salía rojo vivo y los ojos se veían colorados |
| `lip` | | boca, un poco más roja |

- La sombra gira hacia el **rojo** (350°), nunca al gris; en anuros y orcos, hacia el verde azulado (200°).
- La sombra de la piel **pierde** saturación al bajar (`sat: 0.16` por paso). Si la gana, las aletas y las mejillas
  salen anaranjadas y se leen como rubor.
- Las cejas van un poco más oscuras y apagadas que el pelo: un cobre vivo pegado al ojo parece un párpado colorado.
- Giro de 7° por paso.

**Tela y pelo:** sombra en −1,2, sombra honda en −2,2 y luz en +1,2, con 8° de giro por paso.

**Materiales fijos (`MAT`)**: cada uno es una rampa de 3 (sombra, base, luz), separados por valor y temperatura.

| Material | Base | Cómo se separa |
|---|---|---|
| cuero | `#5e3a28` | oscuro y cálido, rojizo |
| madera | `#6a5434` | más amarilla que el cuero |
| pantalón | `#423f44` | frío, gris violáceo |
| metal | `#6c7682` | acero azulado con la luz tibia |
| bota | `#2c2326` | casi negra pero con color |
| tinta | `#1a1614` | lo más oscuro que hay |

**Reglas de cada personaje:**
1. **La piel es lo más claro y cálido** cerca de la cara, un escalón arriba de la ropa.
2. **Un acento por personaje.** Pirata: el pañuelo óxido. Monje: la piedra de veta. Enano: el cobre de la barba y el bronce.
3. **La ropa contrasta con la piel en valor, no solo en matiz.** Al monje de piel cálida le va un hábito carbón con faja
   de lino. Si la ropa es roja, el pañuelo va carbón.
4. **Prueba en grises:** `&gray=1` en `tools/people.html`. Si la cara y la silueta no se separan en grises, se cambia el
   valor, no el matiz.

## 4. Proporciones por pueblo (`PEOPLE`)

| Pueblo | Alto total | Cabeza | Cabezas de alto | Silueta |
|---|---|---|---|---|
| Humano recio | ~52 | 12 + pelo | ~3,8 | hombros anchos, manos de 6 |
| Humano esbelto | ~52 | 12 + pelo | ~3,8 | angosto, piernas largas |
| Enano | ~41 | 12 | ~3 | ancho y bajo, la barba se funde con el torso, manos de 8 |
| Gente-zorro | ~44 + orejas | 11 | ~4 | piernas largas, orejas y cola que rompen el contorno |
| Orco | ~44 | 12 | ~3,5 | torso enorme, cabeza chica para los hombros, adelantada |
| Anuro | ~31 | 8, ancha | ~3,9 | achaparrado, ojos arriba, boca de lado a lado |

- Manos, botas y hombros van 1 o 2 vóxeles más grandes que lo real.
- El arma también es parte de la silueta.

**Para mirar:**
- La hoja de giro: `set=giro`.
- El primer plano: `set=caras&view=f|t|p`, con todas las cabezas a la misma altura.
- La prueba en grises: `&gray=1`.

Las muestras se pueden recolorear con `cd`, `cm` y `cf`.

## 5. Lectura del coordinador (sobre la segunda pasada) y cómo quedó

1. **Paleta.**
   - *El problema:* los tres iban de rojo y marrón y no se distinguían.
   - *Cómo quedó:* cada uno tiene su color dominante y su acento.
     - Pirata: índigo con el pañuelo óxido.
     - Monje: carbón con lino y la piedra de veta.
     - Enano: cuero con el cobre de la barba y el acero.
2. **Zorro irreconocible.**
   - *El problema:* el sombrero a rayas le tapaba la cabeza.
   - *Cómo quedó:* el pañuelo va pegado al cráneo y arriba del ceño. Lo primero que se lee son el hocico y las orejas.
3. **Brazos que flotan.**
   - *El problema:* quedaban separados del torso a la altura del hombro.
   - *Cómo quedó:* el pivote se mete 1 vóxel en el hombro (`armX`) y la pose en A baja de 0,22 a 0,14 rad.
4. **Monje sin identidad.**
   - *El problema:* tenía la cabeza grande y plana.
   - *Cómo quedó:*
     - el cráneo se redondea arriba;
     - lleva una faja de lino con nudo al costado y dos puntas;
     - cuentas de madera en V al cuello;
     - sandalias con tira;
     - mangas anchas.
5. **"Todavía se ve a Minecraft."**
   - *El problema:* faltaba carácter propio.
   - *Cómo quedó:* se sigue con la silueta exagerada (manos, botas y hombros grandes), materiales en bloques limpios de
     2 o 3 tonos sin ruido y caras con volumen. Cada personaje necesita **un distintivo de oficio** que se lea en la
     silueta o en el pecho: el arma, las cuentas, el parche.

## 6. Propagación al resto (después del OK de las muestras)

- **Orcos:**
  - la cabeza se hunde 1 (no 3) entre los hombros, así la cara queda arriba de la línea de los hombros;
  - el ceño sale 1 y la frente pesada va en la fila de arriba. Con 2 de vuelo, desde la cámara tapaba el ojo;
  - el ojo es negro de 2 × 2, como el de todos (el ámbar quedó descartado): a ese tamaño se lee sobre el verde;
  - nariz chata con las fosas oscuras, mandíbula que sale 2, boca de 6 y colmillos que suben por delante del labio.
- **Anuros:** las manchas del lomo van en parches limpios de 3 × 3, a mitad de camino entre la piel y el color de
  marcas. Las rayas negras de antes eran ruido.
- **Vaciados:**
  - una sola grieta de veta que baja en zigzag por el pecho, más clara arriba, y una línea corta en la pierna. Los
    puntos sueltos eran ruido;
  - pelo oscuro y ropa de cuero (carbón o ciruela), porque la ropa de mina gris se fundía con la piel gris.
- **Red de valor (`paletteOf`):** si la tela queda a menos de un escalón de luminosidad de la piel (0,1), baja de a
  pasos de rampa. Con piel muy oscura, sube. Cubre a la gente de la ciudad (`randomLook`) sin listas de combinaciones
  prohibidas.
- **Pintura de guerra:** una franja de ocre rojo bajo los ojos, de oreja a oreja, y dos rayas en las mejillas (en
  verdes, hueso). Las manchas oscuras bajo el ojo se leían como otro par de ojos.
- **Cota de malla:** bandas de 3 filas en vez de damero, que a distancia de juego es ruido.
- **Pañuelo:** va carbón solo si la ropa es roja de verdad (matiz < 16° o > 340° y saturación > 0,3). La arcilla ya no
  cuenta como roja.
- **Low-poly (`lowpoly.js`):** cada cara toma un paso de la rampa según hacia dónde mira. Las de arriba van un paso de
  luz y las de abajo uno de sombra. Así cada material tiene 3 tonos con cambio de matiz. Las paletas de
  `enemy-models.js` subieron de valor para separarse del piso de la grilla:
  - lobos con el lomo oscuro y el vientre y la quijada claros;
  - gólem de piedra clara con liquen;
  - bicho con el borde del caparazón;
  - bestia de musgo más vivo.
- **Galería:**
  - `set=caras&who=pueblos` (o `set=giro&who=pueblos`) muestra cada pueblo, recio y esbelto, y un Vaciado;
  - `pick=orco,anuro` filtra;
  - `set=autos` sienta a un conductor de cada pueblo.

## Fuentes
- [Veloren]: https://book.veloren.net/contributors/artists/voxel-models.html (escala de los modelos vóxel)
- [Hytale 2025]: https://hytale.com/news/2025/12/an-introduction-to-making-models-for-hytale (geometría simple, sombras
  con color, sin negro ni blanco puros)
- [Hytale 2019]: https://hytale.com/news/2019/2/customizing-your-character-in-hytale
- [Slynyrd 1]: https://www.slynyrd.com/blog/2018/1/10/pixelblog-1-color-palettes (rampas y cambio de matiz)
- [Slynyrd 17]: https://www.slynyrd.com/blog/2019/5/21/pixelblog-17-human-anatomy (proporciones y rasgos de la cara)
- [Slynyrd 22]: https://www.slynyrd.com/blog/2019/10/21/pixelblog-22-top-down-character-sprites
- [Derek Yu]: https://www.derekyu.com/makegames/pixelart.html (contorno selectivo, prueba en grises, ojo de 2 píxeles)
- [androidarts]: https://www.androidarts.com/pixtut/pixelart.htm (sin pupila ni dientes en chico, rampa de piel)
- [pixnote]: https://pixnote.net/en/learn/character (ojo y cabezas por tamaño, expresiones, colores por personaje)
- [colepowered]: https://colepowered.com/?p=35199 (caras vóxel de Shadows of Doubt)
- [Trove]: https://trovesaurus.com/page=5624 (guía de estilo de Trove: oscuro mínimo, colores sólidos, acentos)
- [Pixel Palette Swap]: https://pixelpaletteswap.pages.dev/guides/color-theory-for-pixel-art.html (tonos por rampa y
  rampa de piel)
- [TF2]: https://wiki.teamfortress.com/wiki/Illustrative_Rendering_in_Team_Fortress_2 (silueta y entorno apagado)
- [0fps]: https://0fps.net/2013/07/03/ambient-occlusion-for-minecraft-like-worlds/ (oclusión por vértice)
- [Pixel Joint]: https://pixeljoint.com/forum/forum_posts.asp?TID=26667 (ojos de 2 píxeles y contraste)
- [foro de Aseprite]: https://community.aseprite.org/t/my-start-in-pixel-art-first-character/10328
- [Polycount]: https://polycount.com/discussion/comment/2308308 (geometría para ceño y párpados)

No se encontraron reglas publicadas de Cube World, Teardown, Minecraft Dungeons ni Vintage Story. Los tutoriales de
Saint11 no se pudieron abrir.
