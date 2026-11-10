# Tono · Français (fr)

Base común: [Guía de tono de DESIGN.md](../../DESIGN.md#guía-de-tono), [DESIGN-STORY.md §9](../../DESIGN-STORY.md) y el
[glosario](glosario.md). Se traduce el sentido, no el voseo.

## Voz
- **Chaleureux et sobre**: francés de Francia estándar, cotidiano, sin argot de internet ni québécois marcado.
- **Sin diminutivos:** nada de "-ette" cariñoso ("maisonnette", "petit cadeau" como mimo). "Maison", "cadeau". "Petit"
  solo cuando informa tamaño.
- **Humor seco**: el francés lo hace con ironía ligera y sobreentendidos; sin "Youpi !", "Trop mignon !", "Coucou".
- **Ausencias sin culpa:** "Pendant ton absence…", nunca "Tu nous as manqué !".

## Trato al jugador
- **tu**: es el uso de los juegos de gestión cozy y de PC actuales y combina con la voz cercana de Vera. Imperativo en
  botones con infinitivo ("Fermer", "Construire", "Appareiller"), como hace la interfaz francesa estándar.
- **Neutro de género con sustantivos**, sin punto medio de género ("joueur·euse" no): "la personne qui mène", "le
  groupe", "les gens", "l'équipe". Si no hay forma neutra, la genérica del oficio (glosario §8).

## Forma
- **Mayúsculas:** solo la primera palabra en botones y títulos ("Repartir", "Grande ville"), más los nombres propios y
  los sistemas del glosario ("le Journal de bord", "la Faille").
- **Espacios antes de signos dobles:** espacio fino insecable (U+202F) antes de `: ; ! ?` y dentro de las comillas
  « ». Escribirlo en el diccionario (no un espacio común, que puede partir la línea). `common.pct` lleva "92 %".
- **Comillas:** « » con espacios finos insecables; raya — para diálogos.
- **Números:** `Intl.NumberFormat('fr')` → 1 234,5 (espacio fino). Tiempo: "3 min", "2 h", "il y a 1 jour".
- **Fechas:** `fmtDate` → "9 nov. 2026". No escribirlas a mano.
- **Plurales:** `one` (0 y 1 son singular en francés: "0 trouvaille") y `other`; `many` lo resuelve Intl para números
  grandes, si aparece.
- **Elisión:** cuidado con las variables: "de {name}" puede pedir "d’" ("d’Olga"). Si la variable puede empezar con
  vocal, reformular ("Maîtrise : {name}") antes que dejar "de Olga".
- **Largo orientativo de botón:** 16 caracteres (el francés ocupa ~20 % más que el español).

## Ejemplos
| es | fr |
|---|---|
| Mientras no estabas pasó la tormenta: salvaste el 92% | Pendant ton absence, la tempête est passée : tu as sauvé 92 % |
| El depósito de provisiones está lleno: salí de expedición | Le dépôt de provisions est plein : pars en expédition |
| Sin grupo todavía: sale quien lidera. | Pas encore de groupe : la personne qui mène part seule. |
| Todavía no hay armas. Salen de las peleas ganadas, y los jefes dejan siempre una. | Pas encore d’armes. Elles viennent des combats gagnés, et les boss en laissent toujours une. |
| Mejor no | Plutôt pas |
| El arroyo creció. Como todos los años, nadie movió el auto. | Le ruisseau a monté. Comme chaque année, personne n’a déplacé la voiture. |
| La tierra se vació por dentro y se partió. *(épico)* | La terre s’est vidée de l’intérieur, puis s’est brisée. |

**Evitar:** "Bravo !!", "Génial !", "Oups", vous (salvo un personaje formal a propósito, p. ej. un emisario de las Casas).
