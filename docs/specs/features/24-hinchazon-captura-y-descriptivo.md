# F24 · Hinchazón: captura sin momento y descriptivo honesto

**Estado**: **aprobada**, pendiente de implementar · **Tamaño**: feature (3 fases)
**Fecha**: 2026-08-09 · **Origen**: sesión de grilling del 2026-08-09. Salió de auditar qué
datos recoge la app y no lee nadie.

## Motivación

**1 · Llevas meses pagando fricción por un dato que no se lee en ningún sitio.**

- `day-status-line.tsx:54` pincha cada noche a las 21h: *«Cierra el día: ¿hinchazón y notas?»*.
- Hay una tabla dedicada, `bloat_events` (`schema.ts:179-192`), con **hora real y severidad**
  — no es solo el resumen legacy `days.bloat`.
- Uso total del dato: **dos líneas de prompt** (`context.ts:106` y `:727`), que lo escupen
  como un hecho suelto del día.
- En `src/server/analytics/`: **cero**. En `src/components/progreso/`: **cero**.

**2 · Es uno de los tres objetivos declarados de la app y ninguna de las 23 features lo toca.**
`CLAUDE.md`, primera línea: *«recomposición corporal, rendimiento en CrossFit y control de
hinchazón/retención»*.

**3 · Es un requisito del nutricionista, no una idea nuestra.** El criterio de repostaje que
Regenera pautó para la competición (DECISIONS #90, ago-26) incluye literalmente *«cosas que me
sienten bien y no pesadas»*. Cuando el 12-sep Alex le pregunte al Chat qué comer entre heats,
**la app no puede responder a esa parte**: recoge hinchazón a diario y no la analiza. La
procedencia importa — no es una feature que nos apetezca, es una pregunta del profesional que
el sistema no sabe contestar.

**4 · Y el dato que hay está infra-registrado, por una razón concreta.** Alex, 9-ago:

> *No es que a las 21h esté lejos del móvil: es que **no tengo un momento**. La registro
> cuando me acuerdo, si me acuerdo.*

Eso descarta la solución obvia (mover la pregunta de las 21h a las 8h): cambiaría un momento
que no existe por otro que tampoco. La solución es **engancharla a momentos que ya existen**.

## Definiciones (fijadas en `docs/GLOSARIO.md`)

No se implementa nada sin esto, porque cambia todas las cifras:

- **Episodio** = fila de `bloat_events` = `(fecha, hora, severidad ∈ {leve, moderada, alta})`.
  La hora es parte de la identidad: dos molestias el mismo día a horas distintas son dos.
- **`ninguna` NO es un episodio** y no debe escribirse nunca en `bloat_events`.
- **Día con hinchazón** = día con ≥1 episodio.
- **Día evaluado** = `days.bloat != null` **o** ≥1 episodio. Un día sin respuesta **no** es un
  día sin hinchazón.
- **Episodio en diferido** = contado después del momento en que ocurrió → se escribe con la
  **fecha del día en que ocurrió**, **hora aproximada de la noche** y **marcado como aproximado**.

## Alcance

### Fase 1 · Captura sin momento (dato + red matinal)

**Migración aditiva**: columna `aproximado boolean NOT NULL DEFAULT false` en `bloat_events`.
Es la única migración de esta tanda.

**Red matinal**: el check-in matinal —que Alex ya hace a diario por el peso— gana **una
pregunta por AYER**, de un toque: *«¿Cómo sentó ayer?»* con cuatro respuestas. El destino de
cada una **no es el mismo**, y esa asimetría es lo que hace que la Fase 2 sirva de algo:

| Respuesta | Escribe |
|---|---|
| **Ninguna** | `days.bloat = 'ninguna'` en **ayer** → marca el día como **evaluado** |
| **Leve / Moderada / Alta** | **episodio en diferido** en ayer: hora aproximada de la noche, `aproximado = true` |

**Regla anti-doble-pregunta**: si ayer ya quedó evaluado (respondido a las 21h o ya tiene
episodios), el matinal **no** vuelve a preguntar.

**La pregunta de las 21h se queda**, para quien conteste en el momento: da hora real y
`aproximado = false`, que es dato mejor. El matinal es la **red**, no el sustituto.

**Honestidad sobre la red**: el check-in matinal no es diario del todo — 19 pesajes en 23 días
(~83 %). La red tiene un 17 % de agujeros y por eso el descriptivo declara `V días evaluados`
en vez de fingir cobertura total.

### Fase 2 · Descriptivo en Progreso (analítica pura, cero correlaciones)

Función pura y testeada en `server/analytics/` (ni una fórmula en componentes) + bloque en
**Progreso**. Contenido:

- **Frecuencia**, siempre en la forma canónica: `E episodios · D días con hinchazón · de V
  evaluados (de T días de ventana)`. **Nunca `E / T`.**
- **Distribución horaria** de los episodios (es lo único que la tabla `bloat_events` aporta
  sobre el resumen legacy, y la razón de que exista).
- **Reparto por severidad**.
- Los episodios **aproximados** se cuentan y se **declaran** como tales; no se mezclan
  silenciosamente con los de hora real en la distribución horaria.
- Umbral de muestra: por debajo de un mínimo de días evaluados, muestra conteos y **no**
  distribución (mismo patrón que el umbral 3+7 del KPI flexible, #78).

### Fase 3 · Captura desde el Chat (segunda escritura confirmada)

Cuando Alex cuenta en conversación que se hinchó, el Chat puede **ofrecer** registrarlo, y solo
escribe **tras confirmación explícita**, con el patrón ya establecido en F12/#75 (única
escritura del chat, determinista en servidor, el modelo no se auto-concede el sí). Sería la
**segunda** escritura confirmada del Chat.

## No-alcance (deliberado)

- **Correlaciones automáticas comida ↔ hinchazón.** Con el tamaño de muestra real y comidas
  que se repiten, la co-ocurrencia es ruido. Ya estaba escrito en `HANDOFF §B2` («observación
  — no diagnóstico») y Alex lo confirmó el 9-ago: *«cero correlaciones, tenías razón»*.
- **Atribuir peso, HRV o rendimiento a la hinchazón.** Prohibido por #78/#79.
- **Sodio y fibra estructurados.** Es la puerta a las correlaciones; queda en `HANDOFF §B2`.
- **Diagnóstico de ningún tipo.** Principio 8: el sistema informa, el nutricionista decide.

## Riesgos

- **La FK de `bloat_events.date` apunta a `days.date`**: escribir un episodio en diferido
  exige que la fila de ayer exista. Normalmente existirá (hay comidas registradas), pero el
  caso de un día sin fila debe crearla o fallar de forma visible, nunca en silencio.
- **Guardarraíl pendiente**: hoy el schema permite `severity = 'ninguna'` en `bloat_events`
  porque el enum se comparte con `days.bloat`. La Fase 1 no debe escribirlo; si se decide
  garantizarlo en BD, es un check constraint aparte.

## Criterios de aceptación

1. 🖐 En el check-in matinal aparece la pregunta por ayer y se responde en **un toque**.
2. 🖐 Responder «Ninguna» deja ayer como **evaluado** y **no** crea ningún episodio.
3. 🖐 Responder «Moderada» crea un episodio en **ayer**, con hora de la noche y marcado como
   aproximado — no con la fecha y hora de esta mañana.
4. Si ayer ya se respondió a las 21h, el matinal no vuelve a preguntar (test).
5. 🖐 Progreso muestra la frecuencia en la forma canónica, con los cuatro números, y no
   muestra `E / T`.
6. La distribución horaria distingue episodios de hora real de los aproximados.
7. Por debajo del umbral de muestra, se muestran conteos sin distribución.
8. 🖐 (Fase 3) El Chat ofrece registrar y **solo** escribe tras confirmación explícita; sin
   confirmación no toca la BD.
9. Regresión: `pnpm typecheck && pnpm test` verdes; migración aplicada sin pérdidas;
   export/restore transportan la columna nueva.
