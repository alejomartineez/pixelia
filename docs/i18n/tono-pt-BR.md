# Tono · Português do Brasil (pt-BR)

Base común: [Guía de tono de DESIGN.md](../../DESIGN.md#guía-de-tono), [DESIGN-STORY.md §9](../../DESIGN-STORY.md) y el
[glosario](glosario.md). Se traduce el sentido, no el voseo.

## Voz
- **Cálido y sobrio**, portugués brasileño de uso común, sin regionalismos marcados (ni carioca ni gaúcho cerrado) y sin
  portugués europeo ("ecrã", "utilizador" no; "tela", "jogador" sí).
- **Sin diminutivos:** el portugués los usa mucho (casinha, presentinho, rapidinho): **acá no**. "Casa", "presente",
  "rápido". Solo si es la palabra normal del objeto ("calcinha" no aplica; "cafezinho" tampoco en interfaz).
- **Humor seco**: ironía suave del interior. Nada de "Eba!", "Oba!", "Uhuul!", "fofo".
- **Ausencias sin culpa:** "Enquanto você estava fora…", nunca "Sentimos sua falta!".

## Trato al jugador
- **você**, con verbos en 3.ª persona ("Abra o Diário de Bordo"). Nada de "tu" con
  verbo de 2.ª ni "o senhor".
- Imperativo en botones con el verbo solo: "Zarpar", "Construir", "Fechar".
- Neutro de género con sustantivos, como en es: "quem lidera", "o grupo", "a equipe", "as pessoas". Nunca "@", "x",
  "e" neutra ("todes") ni "amigos/as".

## Forma
- **Mayúsculas:** solo la primera palabra en botones y títulos ("Repetir travessia"), más los nombres propios y los
  sistemas del glosario ("o Diário de Bordo", "a Fenda").
- **Comillas:** “ ” en el texto; raya — para incisos.
- **Números:** `Intl.NumberFormat('pt-BR')` → 1.234,5. Porcentaje pegado: "92%". Tiempo: "3 min", "2 h", "há 1 dia".
- **Fechas:** `fmtDate` → "9 de nov. de 2026". No escribirlas a mano.
- **Plurales:** `one` y `other` (y `many` lo resuelve Intl si aparece). "{n} achado" / "{n} achados".
- **Largo orientativo de botón:** 16 caracteres; si no entra, el botón crece (nunca abreviar con punto).

## Ejemplos
| es | pt-BR |
|---|---|
| Mientras no estabas pasó la tormenta: salvaste el 92% | Enquanto você estava fora, a tempestade passou: você salvou 92% |
| El depósito de provisiones está lleno: salí de expedición | O depósito de provisões está cheio: saia em expedição |
| Sin grupo todavía: sale quien lidera. | Ainda sem grupo: quem lidera sai sozinho. |
| Todavía no hay armas. Salen de las peleas ganadas, y los jefes dejan siempre una. | Ainda não há armas. Elas saem das lutas vencidas, e os chefes sempre deixam uma. |
| Mejor no | Melhor não |
| El arroyo creció. Como todos los años, nadie movió el auto. | O riacho subiu. Como todo ano, ninguém tirou o carro. |
| La tierra se vació por dentro y se partió. *(épico)* | A terra se esvaziou por dentro e se partiu. |

**Evitar:** "Parabéns!!", "Que demais!", "galera", "mano", gírias de internet.
