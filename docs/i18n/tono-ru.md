# Tono · Русский (ru)

Base común: [Guía de tono de DESIGN.md](../../DESIGN.md#guía-de-tono), [DESIGN-STORY.md §9](../../DESIGN-STORY.md) y el
[glosario](glosario.md). Se traduce el sentido, no el voseo.

## Voz
- **Тёплый и сдержанный**: ruso literario cotidiano, claro, sin calcos del inglés ("лут" → **добыча**, "скилл" →
  **умение**) ni jerga de juegos de móvil.
- **Sin diminutivos:** el ruso los usa muchísimo (домик, подарочек, городок, цветочки): **acá no**. "Дом", "подарок",
  "посад", "цветы". Es la regla que más cuesta: revisar cada sufijo -ик, -чик, -очк-, -еньк-.
- **Humor seco**: el ruso tiene una tradición enorme de ironía seca y plana; funciona muy bien. Sin "Ура!!", "Ой!",
  "Мимими".
- **Ausencias sin culpa:** "Пока тебя не было…", nunca "Мы скучали!".

## Trato al jugador
- **ты**, cercano, como la mayoría de los juegos de PC actuales y acorde con la voz de Vera. En botones, infinitivo o
  imperativo corto ("Отплыть", "Закрыть", "Строить"); elegir uno por pantalla y no mezclar.
- **Neutro de género:** el ruso marca género en el pasado del verbo ("ты спас / спасла"). Reformular para evitarlo:
  presente, impersonal o sustantivo ("Спасено 92 %", "Вернулись все"). Para personas: "тот, кто ведёт",
  "отряд", "люди", "жители". Nada de "(а)" entre paréntesis.

## Forma
- **Mayúsculas:** solo la primera palabra en botones y títulos ("Плыть снова"), más nombres propios y sistemas del
  glosario cuando son nombre propio ("Разлом", "Судовой журнал").
- **Comillas:** « » (y „ “ dentro de otras). Raya — con espacios.
- **Números:** `Intl.NumberFormat('ru')` → 1 234,5 (espacio fino). Porcentaje con espacio: "92 %". Tiempo: "3 мин",
  "2 ч", "1 день назад".
- **Fechas:** `fmtDate` → "9 нояб. 2026 г.". No escribirlas a mano.
- **Plurales:** **`one`, `few`, `many`, `other`** (1 находка, 2 находки, 5 находок, 1,5 находки). `test-i18n` exige
  las cuatro formas en cada plural. Las variables numéricas fuera de `tn()` no concuerdan: reformular ("Находки: 5").
- **Casos:** las variables con nombres ({name}, {island}) caen en una frase que pide caso. Poner la variable donde va
  en nominativo ("Остров: {island}") o con un sustantivo que la proteja ("на острове {island}").
- **Fuente:** cirílico de Fusion Pixel (`fonts/pixel-cyr.woff2`). Después de traducir, `node tools/subset-fonts.mjs`.
- **Largo orientativo de botón:** 14 caracteres (el ruso ocupa ~15–25 % más que el español; el botón crece).

## Ejemplos
| es | ru |
|---|---|
| Mientras no estabas pasó la tormenta: salvaste el 92% | Пока тебя не было, прошла буря: спасено 92 % |
| El depósito de provisiones está lleno: salí de expedición | Склад припасов полон: пора в экспедицию |
| Sin grupo todavía: sale quien lidera. | Отряда пока нет: тот, кто ведёт, идёт один. |
| Todavía no hay armas. Salen de las peleas ganadas, y los jefes dejan siempre una. | Оружия пока нет. Оно остаётся после выигранных боёв, а боссы всегда оставляют одно. |
| Mejor no | Лучше не надо |
| El arroyo creció. Como todos los años, nadie movió el auto. | Ручей разлился. Как каждый год, машину никто не отогнал. |
| La tierra se vació por dentro y se partió. *(épico)* | Земля опустела изнутри и раскололась. |

**Evitar:** diminutivos, "Круто!", "Молодец!", вы (salvo un personaje formal a propósito).
