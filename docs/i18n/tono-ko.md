# Tono · 한국어 (ko)

Base común: [Guía de tono de DESIGN.md](../../DESIGN.md#guía-de-tono), [DESIGN-STORY.md §9](../../DESIGN-STORY.md) y el
[glosario](glosario.md). Se traduce el sentido, no el voseo. Como referencia de estilo, mirar también `ja.js` (mismo
nivel de formalidad en la interfaz).

## Voz
- **따뜻하고 차분하게**: coreano estándar de Seúl, natural, como un juego de gestión indie para adultos. Nada de jerga
  de internet (ㅋㅋ, 대박, 짱), emoticones ni ~요♡.
- **Sin infantilizar:** sin terminaciones tiernas (~용, ~당), sin onomatopeyas lindas en premios, sin 귀여운.
- **Humor seco**: frases cortas y planas.
- **Ausencias sin culpa:** "자리를 비운 동안…", nunca "보고 싶었어요!".

## Registro
- **Interfaz (ayudas, avisos):** **해요체** (cortés informal, ~해요 / ~했어요): "보급 창고가 가득 찼어요." Es el estándar
  de los juegos actuales y combina con la voz cálida. Nada de 합쇼체 rígido (~합니다) salvo en textos legales o del
  sistema (Ajustes → cuenta, privacidad).
- **Botones:** sustantivo o verbo en forma de diccionario corta: "닫기", "건설", "출항". Sin ~하세요 en botones.
- **Jugador:** se omite el sujeto; nunca 너 ni 당신.
- **Personajes:** Vera en 반말 seco y adulto (~야, ~지) cuando habla en escenas: es su voz de barrio. El narrador épico
  en 해라체 literario (~했다, ~이다), frases cortas.
- Neutro de género: "리더", "대원", "일행", "찾아온 사람".

## Forma
- **Puntuación:** la latina (, . ! ? : " "), con espacio después de coma y punto. Comillas “ ” (o 「」 no).
  Puntos suspensivos ….
- **Espaciado (띄어쓰기):** obligatorio entre palabras; revisarlo, porque cambia el sentido. Partículas pegadas a la
  palabra o a la variable ("{name}의 숙련도").
- **Partículas con variables:** 이/가, 을/를, 은/는, 과/와 cambian según la última sílaba. Con una variable, reformular
  para no depender de ella ("{island} 섬으로", "{name}: 숙련 {n}") o usar la forma doble 을(를) **solo** si no hay otra.
- **Números:** `Intl.NumberFormat('ko')` → 1,234.5. Porcentaje pegado. Tiempo: "3분", "2시간", "1일 전".
- **Fechas:** `fmtDate` → "2026. 11. 9.". No escribirlas a mano.
- **Plurales:** solo `other`. Contadores: 개 (cosas), 명 (personas), 번 (veces), 자루 (armas, opcional).
- **Fuente:** Fusion Pixel 12px recortada (`fonts/pixel-ko.woff2`; Galmuri como alternativa si falta algún hangul).
  Después de traducir, `node tools/subset-fonts.mjs`.
- **Largo orientativo de botón:** 7 sílabas.

## Ejemplos
| es | ko |
|---|---|
| Mientras no estabas pasó la tormenta: salvaste el 92% | 자리를 비운 동안 폭풍이 지나갔어요. 92%를 지켜 냈어요 |
| El depósito de provisiones está lleno: salí de expedición | 보급 창고가 가득 찼어요. 원정을 떠나세요 |
| Sin grupo todavía: sale quien lidera. | 아직 일행이 없어요. 리더 혼자 출발해요. |
| Todavía no hay armas. Salen de las peleas ganadas, y los jefes dejan siempre una. | 아직 무기가 없어요. 이긴 전투에서 얻을 수 있고, 보스는 항상 하나를 남겨요. |
| Mejor no | 그만두기 |
| El arroyo creció. Como todos los años, nadie movió el auto. | 시냇물이 불었다. 해마다 그렇듯, 아무도 차를 빼지 않았다. |
| La tierra se vació por dentro y se partió. *(épico)* | 대지는 속부터 비워졌고, 갈라졌다. |

**Evitar:** 축하드립니다!!!, 짱, ~용, 반말 en la interfaz.
