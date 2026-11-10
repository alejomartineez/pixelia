# Tono · 日本語 (ja)

Base común: [Guía de tono de DESIGN.md](../../DESIGN.md#guía-de-tono), [DESIGN-STORY.md §9](../../DESIGN-STORY.md) y el
[glosario](glosario.md). Se traduce el sentido, no el voseo. Las claves del HUD, la ciudad, Construir, Ajustes y el
Arsenal ya están en japonés: **son la referencia de estilo** para el resto.

## Voz
- **温かく、落ち着いた**: japonés natural de juego de gestión para adultos. Nada de 〜だよ♪, ね！！ ni kaomoji; nada de
  katakana de moda innecesaria.
- **Sin infantilizar:** sin ちゃん/くん para objetos, sin onomatopeyas tiernas (ふわふわ, キラキラ en premios), sin
  かわいい. Kanji normales donde un adulto los lee (no todo en hiragana).
- **Humor seco**: frases planas y concretas (el japonés lo hace bien con 〜らしい, 〜のは毎年のことだ).
- **Ausencias sin culpa:** 留守の間に…, nunca 寂しかったです！.

## Registro
- **Interfaz (botones, ayudas, avisos):** です／ます para frases ("物資の倉庫がいっぱいです。"); **forma de diccionario**
  o sustantivo en botones y acciones ("閉じる", "建てる", "出航"). Ya está así en `ja.js`.
- **Jugador:** no se lo nombra; se omite el sujeto. Nada de あなた salvo que sea imprescindible.
- **Personajes:** cada quien tiene su registro, en forma llana (だ／である) si es su voz:
  - **Vera:** llana, seca, adulta, sin final femenino marcado (〜わ, 〜のよ no): "地図は嘘をつかない。人はつく。".
  - **El narrador (épico):** literario, である／〜た, frases cortas. Sin です／ます.
  - **Tadeo (diario):** llano y escrito, de registro.
- Neutro de género: "リーダー", "仲間", "隊員", "訪ねてきた人".

## Forma
- **Puntuación:** 、。「」（）！？ de ancho completo. Comillas 「」 (y 『』 para títulos de obras o dentro de otras).
  Puntos suspensivos ……. Dos puntos de ancho completo "：" en etiquetas (ya en uso: "ランク {n}：{name}").
- **Espacios:** no entre japonés y japonés. Entre etiqueta y número se acepta un espacio fino en el HUD ("魅力 {n}"), ya
  fijado en `ja.js`; dentro de una frase, sin espacio ("熟練度+25%").
- **Números:** `Intl.NumberFormat('ja')` → 1,234.5. Porcentaje pegado. Tiempo: "3分", "2時間", "1日前".
- **Fechas:** `fmtDate` → "2026/11/09" o "2026年11月9日". No escribirlas a mano.
- **Plurales:** solo `other`. Contadores: 個 (cosas), 人 (personas), 回 (veces), 本 (armas largas, opcional; con 個 basta).
- **Fuente:** Fusion Pixel 12px recortada (`fonts/pixel-ja.woff2`); después de traducir, `node tools/subset-fonts.mjs`.
- **Largo orientativo de botón:** 7 caracteres (cada uno ~2 latinos).

## Ejemplos
| es | ja |
|---|---|
| Mientras no estabas pasó la tormenta: salvaste el 92% | 留守の間に嵐が通り過ぎました。92%を守りました |
| El depósito de provisiones está lleno: salí de expedición | 物資の倉庫がいっぱいです。遠征に出ましょう *(ya en ja.js)* |
| Sin grupo todavía: sale quien lidera. | まだ編成がありません。リーダーだけで出発します。 *(ya en ja.js)* |
| Todavía no hay armas. Salen de las peleas ganadas, y los jefes dejan siempre una. | まだ武器がありません。勝った戦闘で手に入り、ボスは必ず1つ落とします。 *(ya en ja.js)* |
| Mejor no | やめておく *(ya en ja.js)* |
| El arroyo creció. Como todos los años, nadie movió el auto. | 小川があふれた。毎年のことだが、誰も車をどかさなかった。 |
| La tierra se vació por dentro y se partió. *(épico)* | 大地は内側から空になり、割れた。 |

**Pendiente del glosario:** "Travesía" va 航海 (no 旅, que quedó en dos textos de talentos: ver `KNOWN` en
`tools/test-glossary.mjs`).
