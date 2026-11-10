# Tono · 简体中文 (zh-CN)

Base común: [Guía de tono de DESIGN.md](../../DESIGN.md#guía-de-tono), [DESIGN-STORY.md §9](../../DESIGN-STORY.md) y el
[glosario](glosario.md). Se traduce el sentido, no el voseo.

## Voz
- **温暖、克制**: chino de China continental, cotidiano y claro, como un buen juego indie de gestión. Nada de jerga de
  internet (yyds, 绝绝子), ni tono de juego de móvil con premios a gritos (恭喜您获得!!!).
- **Sin diminutivos ni infantilizar:** nada de reduplicaciones tiernas (房房, 小花花), ni 小 cariñoso ("小房子" como
  mimo → 房子), ni partículas que aniñan (哦~, 呀, 啦 en exceso). 小 solo cuando informa tamaño o es parte de la palabra (小艇, "esquife", y 小溪, "arroyo", son las palabras
  normales; ver glosario).
- **Humor seco**: frases planas, observación concreta. Sin emoticones ni ～.
- **Ausencias sin culpa:** "你不在的时候……", nunca "我们好想你!".

## Trato al jugador
- **你** (no 您): cercano, como la voz de Vera. 您 solo para un personaje formal a propósito.
- Botones con verbo corto: 关闭, 建造, 启航. Sin "请" en botones; en ayudas, con medida.
- Neutro de género: el chino ayuda (他/她 se evitan reformulando: "领队", "队伍", "大家", "来访的人"). No usar "TA".

## Forma
- **Puntuación de ancho completo:** ，。：；！？（） y comillas “ ” (no 「」, que es de ja/zh-TW). Puntos suspensivos
  …… (dos). Sin espacio antes ni después de la puntuación ni entre chino y números ("魅力 120" se acepta en etiquetas
  cortas, como ya hace el HUD de ja; en frases, sin espacio: "获得120魅力").
- **Números:** `Intl.NumberFormat('zh-CN')` → 1,234.5. Porcentaje pegado "92%". Tiempo: "3分钟", "2小时", "1天前".
- **Fechas:** `fmtDate` → "2026年11月9日". No escribirlas a mano.
- **Plurales:** solo `other` (Intl no tiene más). Contadores: 个, 件 (armas, objetos), 位 (personas, con respeto),
  座 (edificios, islas). Ejemplo: "发现物 {n}个".
- **Fuente:** Fusion Pixel 12px recortada (`fonts/pixel-zh-CN.woff2`). Después de traducir, `node tools/subset-fonts.mjs`.
  Revisar que no queden caracteres raros fuera del recorte (`test-i18n` lo marca).
- **Largo orientativo de botón:** 6 caracteres CJK (cada uno ocupa ~2 latinos; el alto de línea es mayor).

## Ejemplos
| es | zh-CN |
|---|---|
| Mientras no estabas pasó la tormenta: salvaste el 92% | 你不在的时候，风暴过去了：你保住了92% |
| El depósito de provisiones está lleno: salí de expedición | 补给仓库满了：出发远征吧 |
| Sin grupo todavía: sale quien lidera. | 还没有队伍：领队独自出发。 |
| Todavía no hay armas. Salen de las peleas ganadas, y los jefes dejan siempre una. | 还没有武器。打赢战斗就会掉落，首领每次都会留下一件。 |
| Mejor no | 还是算了 |
| El arroyo creció. Como todos los años, nadie movió el auto. | 小溪涨水了。和每年一样，没人去挪车。 |
| La tierra se vació por dentro y se partió. *(épico)* | 大地从内部被掏空，然后裂开了。 |

**Evitar:** 亲, 宝, 小可爱, ~, 哇塞, emojis, "史诗级" fuera de la rareza.
