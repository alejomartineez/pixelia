# Tono · English (en)

Base común: [Guía de tono de DESIGN.md](../../DESIGN.md#guía-de-tono), registro épico de
[DESIGN-STORY.md §9](../../DESIGN-STORY.md) y términos fijos del [glosario](glosario.md). Se traduce el **sentido**, no
el voseo ni el giro rioplatense literal.

## Voz
- **Cozy adulto:** cálido, sobrio, frases cortas. Piensa en la voz de un buen juego de gestión indie, no en un juego
  infantil ni en marketing. Nada de "Awesome!", "Yay!", "Oh no!", corazones ni "cute".
- **Humor seco**, de pueblo: subestimación británica y observación concreta funcionan mejor que el chiste.
- **Sin diminutivos** ni sus equivalentes: no "little", "tiny", "cozy little house", "-ie/-y" cariñosos ("doggy"). "Small"
  solo cuando informa tamaño.
- **Ausencias sin culpa:** "While you were away…", nunca "We missed you!" ni "Don't leave us!".
- **Exclamaciones:** una por pantalla como mucho. Los títulos de resultado describen: "Everyone came back", "Close".

## Trato al jugador
- **you**, directo y en segunda persona. Imperativo para acciones: "Head out", "Check the rank record".
- Neutro de género: "the leader", "whoever carries it", "people", "the party". **they/them** para personas sin género
  conocido. Nunca "guys", "he or she".
- Contracciones sí en los textos de personajes y ayudas ("you're", "don't"); en botones, sin contracciones.

## Forma
- **Mayúsculas:** botones y títulos en *Title Case* corto ("Set Sail", "Not Now"); frases y toasts en *sentence case*.
  Los sistemas del glosario van con mayúscula también dentro de la frase ("your Logbook", "the Rift").
- **Puntuación:** comillas curvas “ ” y apóstrofo ’ (ya en uso: "Your city’s rank"). Raya — sin espacios. Los dos
  puntos del original suelen quedar ("No party yet: the leader sets out alone.").
- **Números:** `Intl.NumberFormat('en')` → 1,234.5. El porcentaje va pegado: "92%" (la clave `common.pct` lo resuelve).
  Tiempo: "3 min", "2 h", "1 day ago".
- **Fechas:** `fmtDate` con `dateStyle: 'medium'` → "Nov 9, 2026". No escribir fechas a mano.
- **Plurales:** `one` y `other`. "{n} find" / "{n} finds".
- **Largo orientativo de botón:** 14 caracteres (el inglés suele quedar más corto que el español; no rellenar).

## Ejemplos (de `es.js` y de la guía)
| es | en |
|---|---|
| Mientras no estabas pasó la tormenta: salvaste el 92% | While you were away the storm went through: you saved 92% |
| El depósito de provisiones está lleno: salí de expedición | The supply storehouse is full: head out on an expedition |
| Sin grupo todavía: sale quien lidera. | No party yet: the leader sets out alone. |
| Todavía no hay armas. Salen de las peleas ganadas, y los jefes dejan siempre una. | No weapons yet. They come from fights you win, and bosses always leave one. |
| Mejor no | Better not |
| El arroyo creció. Como todos los años, nadie movió el auto. | The brook rose. Like every year, nobody moved the car. |
| La tierra se vació por dentro y se partió. *(épico)* | The land was hollowed out from within, and it broke. |

**Evitar:** "Oops!", "Uh-oh", "Woohoo", "Let's go!" en cada botón, "Epic!" fuera de la rareza.
