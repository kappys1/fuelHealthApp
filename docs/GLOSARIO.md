# GLOSARIO.md — Términos con significado fijado

> Un término entra aquí cuando **tú y yo podemos entenderlo distinto** y esa diferencia
> cambiaría una cifra en pantalla. No es un diccionario de la app: es la lista de palabras
> que ya han causado (o van a causar) una lectura equivocada.
>
> Lección que lo motiva (F22, 3-ago): *«hay seis relojes y solo uno tiene manecillas
> visibles»*. Un término sin definición fija es otro reloj invisible.
>
> Estado: **FIJADO** = decidido, el código debe cumplirlo · **ABIERTO** = aún se decide.

---

## Episodio de hinchazón — **FIJADO** (2026-08-09)

**Un episodio es una fila de `bloat_events`**: una tupla `(fecha, hora, severidad)` con
severidad ∈ `{leve, moderada, alta}` (`schema.ts:179-192`). La hora es parte de la identidad
del episodio, no un adorno: dos molestias el mismo día a horas distintas son **dos**
episodios (lo garantiza `unique(date, occurred_at)`).

**`ninguna` no es un episodio.** El enum `bloatEnum` (`schema.ts:56`) incluye `ninguna` porque
lo comparte con el resumen legacy `days.bloat`, pero una fila de `bloat_events` con severidad
`ninguna` es una contradicción semántica: significaría «a las 21:30 no tuve hinchazón», que no
es un hecho sino la ausencia de uno. **Regla: nunca escribir `ninguna` en `bloat_events`.**
Hoy el schema lo permite — es un guardarraíl pendiente, no una invariante garantizada.

**Los tres denominadores, que NO son intercambiables:**

| Término | Definición | Cómo se calcula |
|---|---|---|
| **Episodio** | una molestia con hora y severidad | fila de `bloat_events` |
| **Día con hinchazón** | día con ≥1 episodio | días distintos presentes en `bloat_events` |
| **Día evaluado** | día en el que la pregunta se respondió | `days.bloat != null` **o** ≥1 episodio ese día |

**Un día sin respuesta NO es un día sin hinchazón.** `days.bloat = null` significa «no me lo
preguntaron o no contesté»; `days.bloat = 'ninguna'` significa «me lo preguntaron y no tuve».
Confundirlos infla el denominador y hace que la hinchazón parezca la mitad de frecuente de lo
que es. Es exactamente el fallo 5 de F22 («denominadores que encogen en silencio»), aplicado
al revés.

**Episodio en diferido** (aceptado por Alex, 2026-08-09). Un episodio contado *después* del
momento en que ocurrió —típicamente al responder por la mañana sobre la cena de ayer— se
escribe con la **fecha del día en que ocurrió** (ayer), **hora aproximada de la noche**, y
**marcado como aproximado**. Nunca con la fecha y hora del momento en que se cuenta: eso
crearía un pico falso a las 8:00 en la distribución horaria, que es justo lo que el
descriptivo quiere enseñar. La marca de aproximado es obligatoria — una hora inventada sin
declararse es el mismo pecado que las seis ventanas de F22.

**Consecuencia para cualquier cifra que se muestre:** una frecuencia de hinchazón se declara
siempre como **`E episodios · D días con hinchazón · de V días evaluados (de T días de
ventana)`**. Nunca `E / T`. El enunciado *«17 episodios en 33 días»* es ambiguo en los cuatro
sentidos anteriores y no debe aparecer en pantalla en esa forma.

---

## Día registrado — **ABIERTO** (pendiente de medición)

Hoy: `logged = (nº de entradas) > 0` (`trend.ts:149`). Un día con un café solo cuenta como día
completo y entra en la ingesta media con ~140 kcal.

Está ABIERTO porque la decisión depende de un dato que no tenemos: cuántos días así hay
realmente. Query que lo zanja: días con ≤2 entradas y <800 kcal en los últimos 60. Si salen
0-1, se fija la definición actual y se cierra. Si salen ≥5, la ingesta media está sesgada a la
baja y hay que separar «día con algún registro» de «día registrado».

No se implementa nada antes de esa cuenta (anti-optimización-sin-medición, doc 11).

---

## La cifra que manda — **FIJADO** (F22, 5-ago)

Déficit y TDEE derivados de la pendiente de `ma7` del peso, **ventana canónica de 30 días**,
con ensanchado declarado a 90 d si no llega a 8 pesajes o 7 días de span (`deficit.ts`,
`context.ts:324-326`). Ya no responde al selector de rango de la pantalla.

Cualquier otra cifra de la app que hable de déficit es **contexto subordinado** (principio 1),
y debe declarar su propia ventana al lado. Las ventanas vivas y distintas que existen a día de
hoy: Resumen 7/30 propio · Adherencia 14 d · Impacto flexible 30 d · Racha sin ventana.

---

## Lesión vigente / cerrada — **FIJADO** (F26 Fase 1, 2026-08-18)

Una lesión es un **episodio**, no un estado del atleta: `{ zona, capacidad, desde, revisarEl,
cerradaEl? }`. **Vigente** = sin `cerradaEl`; es la única que entra en el contexto de IA.
**Cerrada** = con `cerradaEl`; sale del contexto y se queda en el Historial. **Cerrar no es
borrar** — quitar la lesión al curarte destruye que estuviste lesionado, que es justo el dato
que Regenera querrá ver en la visita.

**Vencida** = vigente y `revisarEl <= hoy`. No hay fecha de fin, hay fecha de **revisión**: las
lesiones se difuminan, no terminan un día. El cierre casi nunca es exacto, así que se marca
`cierreAproximado` — misma obligación que el **episodio en diferido** de arriba.

**Lo que la IA necesita no es la zona, es la capacidad.** `Lesiones: hombro derecho` obliga al
modelo a suponer y, suponiendo sobre una lesión, **sobre-frena**. Por eso `capacidad` es texto
libre con lo que SÍ y lo que NO, y es lo que se interpola en `ATHLETE_CONTEXT`.

**Lesión declarada ≠ sesión adaptada.** Declararla no adapta ningún entreno por sí sola; como
mucho hace que la app pregunte. Adaptar es un acto explícito (F26 Fase 2).

---

## Comida flexible — **FIJADO** (#78, F16)

Marcador `(fecha, momento)`. **No es una fase** y **no es una exención energética**: sus kcal
cuentan íntegras en ingesta media, TDEE, peso y ma7. Lo único que hace es sacar el día del
juicio de **kcal** de la adherencia; **la proteína se sigue juzgando** (`adherence.ts:47`),
porque la proteína es suelo, no objetivo negociable.

Un día con ≥1 momento marcado que contenga ≥1 entrada es **flexible real**. Un momento marcado
y vacío es **flexible prevista** y NO excluye el día de nada.

---

## Techo del día flexible — **ABIERTO** (aparcado hasta después de septiembre)

Cifra propuesta en la conversación del 3-ago: *«tu día flexible puede llegar a ≈X kcal sin
romper el déficit de la semana»*. Es un **presupuesto informativo**, no una prescripción
(principio 8): dice cuánto cabe, no qué comer ni que debas comerlo.

Cuando se retome hay que fijar antes: la ventana de la semana (natural vs rodante) y si el
techo se calcula contra el déficit **de diseño** (objetivo vigente vs TDEE) o contra el
**realizado**. Son cifras distintas y la elección cambia el número.

---

## Modo competición — **ABIERTO** (ver conversación del 9-ago)

Hoy «competición» es un **valor de `days.phase`** con comportamiento real ya implementado:
FuelGauge neutro, chips de repostaje, exclusión de adherencia e ingesta media, protección de
`ma7` del día y los **2 siguientes** (`ma7.ts:25-28`), y una línea de contexto para la IA
(`context.ts:427`).

Lo que **no** existe hoy y suele confundirse con lo anterior: planificar la fase por adelantado
en una fecha futura, y una pauta específica para la noche previa. Fijar el término cuando se
decida el alcance para el 11-sep.

**Criterio de repostaje en competición ≠ pauta de competición.** Una **pauta** son números
(kcal y macros) y vive en `diet_versions`. Un **criterio** son reglas de decisión sin números
y no tiene hogar estructurado en el modelo actual. El criterio vigente —Regenera, ago-26,
texto literal y trazabilidad en `DECISIONS.md` **#90**— es el segundo, y por eso **no** genera
una versión de dieta. Confundirlos llevaría a inventar objetivos numéricos que el
nutricionista nunca pautó.
