# Tono · Deutsch (de)

Base común: [Guía de tono de DESIGN.md](../../DESIGN.md#guía-de-tono), [DESIGN-STORY.md §9](../../DESIGN-STORY.md) y el
[glosario](glosario.md). Se traduce el sentido, no el voseo.

## Voz
- **Warm und nüchtern**: alemán cotidiano, claro, sin jerga de marketing ni anglicismos innecesarios ("Loot" sí se
  entiende en juegos, pero va **Beute**; "Skill" → **Fähigkeit**).
- **Sin diminutivos:** nada de "-chen" ni "-lein" cariñosos ("Häuschen", "Geschenkchen"): "Haus", "Geschenk". Solo si es la
  palabra normal ("Mädchen" no aplica: igual se evita como público supuesto).
- **Humor seco**, de pueblo: el alemán lo hace muy bien con frases cortas y planas.
- **Ausencias sin culpa:** "Während du weg warst…", nunca "Wir haben dich vermisst!".
- **Exclamaciones:** una por pantalla como mucho; el alemán las tolera menos que el español.

## Trato al jugador
- **du**, con minúscula (norma actual), como la mayoría de los juegos de PC. Imperativo en botones: "Ablegen",
  "Schließen", "Bauen".
- **Neutro de género con sustantivos**, sin asterisco ni dos puntos de género (sin "Spieler*innen", "Bürger:innen"):
  "wer anführt", "die Gruppe", "die Leute", "die Bewohnerschaft". Si no hay forma neutra, la genérica del oficio
  (glosario §8).

## Forma
- **Mayúsculas:** las del idioma (todo sustantivo). Botones: solo lo que pida la gramática ("Erneut ablegen").
- **Comillas:** „ “ (abajo y arriba). Raya – con espacios (Halbgeviertstrich).
- **Números:** `Intl.NumberFormat('de')` → 1.234,5. Porcentaje con espacio fino: "92 %" (lo resuelve `common.pct`).
  Tiempo: "3 Min.", "2 Std.", "vor 1 Tag".
- **Fechas:** `fmtDate` → "09.11.2026" o "9. Nov. 2026". No escribirlas a mano.
- **Plurales:** `one` y `other`. "{n} Fundstück" / "{n} Fundstücke".
- **Palabras compuestas:** el alemán arma palabras de 20 letras (Leuchtturmküste, Vorratslager). La interfaz ya crece
  (prueba `?pseudo=1`), pero en botones preferir el verbo solo y no el sustantivo compuesto. Si una compuesta queda
  muy larga, se puede partir con guion ("Wurzel-Arbeit") **solo** si el idioma lo admite.
- **Largo orientativo de botón:** 16 caracteres (el alemán ocupa ~30 % más: la interfaz no corta, pero el botón crece).

## Ejemplos
| es | de |
|---|---|
| Mientras no estabas pasó la tormenta: salvaste el 92% | Während du weg warst, zog der Sturm durch: Du hast 92 % gerettet |
| El depósito de provisiones está lleno: salí de expedición | Das Vorratslager ist voll: Brich zu einer Expedition auf |
| Sin grupo todavía: sale quien lidera. | Noch keine Gruppe: Wer anführt, zieht allein los. |
| Todavía no hay armas. Salen de las peleas ganadas, y los jefes dejan siempre una. | Noch keine Waffen. Sie stammen aus gewonnenen Kämpfen, und Bosse lassen immer eine zurück. |
| Mejor no | Lieber nicht |
| El arroyo creció. Como todos los años, nadie movió el auto. | Der Bach ist gestiegen. Wie jedes Jahr hat niemand das Auto weggefahren. |
| La tierra se vació por dentro y se partió. *(épico)* | Das Land wurde von innen ausgehöhlt und brach. |

**Evitar:** "Super!", "Juhu!", "Hammer!", "Leute, …", Sie (salvo un personaje que hable formal a propósito).
