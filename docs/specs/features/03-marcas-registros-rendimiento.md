# F03 · Marcas (PRs / registros de rendimiento)
**Estado**: propuesta · **Tamaño**: feature
**Fecha**: 2026-07-13 · **Origen**: HANDOFF §B3 (idea de Alex, 2026-07-13) + caso real de The Progrm ("5×3 @ 85% RM").

## Motivación (caso real)
- Alex no tiene dónde apuntar sus marcas: hoy van en notas del móvil o de cabeza.
- The Progrm pauta porcentajes ("hazlo al 85%") y tests de RM. Sin el 1RM guardado, calcular el peso de
  trabajo es fricción **en cada sesión de fuerza**.
- Ritmo real declarado por Alex: **registra** una marca solo cuando el programa manda un test (1RM/5RM…) y
  hace ese ejercicio — no más; **consulta/calcula** con frecuencia (cada sesión con %).
- Además quiere ver la evolución de cada marca ("¿estoy mejorando o perdiendo?") y, de paso, poder
  preguntarle al Chat si algo se correlaciona con cómo comía.

## Alcance (Fase 1)
- Registro de marcas agnóstico de deporte: 1RM sentadilla (kg), Fran (tiempo), 5k/maratón (tiempo),
  natación, dominadas máximas (reps)… **nombre libre**, sin catálogo cerrado.
- Cada marca tiene un **tipo de medida** {peso / tiempo / reps / distancia} que fija la unidad y la
  **dirección de "mejor"** (en peso/reps/distancia, más es mejor; en tiempo, menos es mejor).
- **Añadir entrada** (bottom-sheet): nombre (autocompleta de marcas existentes), valor, fecha (default hoy,
  `lib/dates` Europe/Madrid), nota opcional.
- **Bloque "Marcas" en Plan · Entrenos**: lista de **todas** las marcas, cada una con su **última entrada**
  como titular (la **mejor** se ve en la gráfica del detalle); "＋ Marca" crea una nueva (aparece en la lista)
  y tap abre el detalle.
- **Sheet de detalle por marca** (único, dos entradas): gráfica de progresión + lista de todas las entradas
  (editar/borrar), indicador de si la última mejora, y la **calculadora de %**.
- **Calculadora de %** (solo marcas de tipo peso, determinista, cero IA): input de % (default 85) → "X % = Y kg",
  calculada sobre la **última** entrada (tu RM vigente).
- **Marcas vigentes en el contexto de IA** (Coach solo si aporta; Chat y Visita sí) → la correlación con
  nutrición se responde **bajo demanda en el Chat**, no en un gráfico automático.
- **Carril "Marcas" en Progreso · Historial** → tap abre el mismo sheet de detalle.

## NO-alcance
- **Veredicto automático** tipo "estás perdiendo fuerza": con marcas esporádicas y n=1 es ruido; lo mira el
  Chat si Alex pregunta (guardarraíl principios 1 y 8).
- **Gráfico automático de correlación** marca ↔ nutrición (misma razón; principio 2, anti-teatro de precisión).
- **Auto-resolver los "@85%"** que vengan escritos en la sesión importada (F-IA-10) contra las marcas →
  candidata a Fase 2, no ahora.
- **Catálogo cerrado de movimientos** (mataría lo agnóstico de deporte).

## Momento de uso (09 §1)
- **Registrar**: puntual (días de test). **Consultar/calcular %**: frecuente en bloques de fuerza
  (varias veces/semana). **Ver progresión**: semanal/puntual (Historial).
- Vive en **sheets** (crear/editar) + segmentos existentes (**Plan · Entrenos**, **Progreso · Historial**).
  **No añade ninguna tarjeta permanente a Hoy** (respeta 09 §6).

## Datos
- Tabla nueva `performance_marks`: `id`, `name`, `measure_type` (enum `weight|time|reps|distance`), `unit`,
  `created_at`.
- Tabla nueva `mark_entries`: `id`, `mark_id` (FK), `value` (numeric), `recorded_on` (date, día Europe/Madrid
  vía `lib/dates`), `note` (opc.), `created_at`.
- **Migración drizzle versionada** (principio 7). **Export/restore**: añadir ambas tablas al volcado y al
  restore. **`migrate:poc`**: el PoC no tiene marcas → no-op documentado.
- "Mejor" y "última" se **derivan en lectura** según `measure_type` (no se guardan → sin desincronización).

## Flujo (09)
1. **Plan · Entrenos** → sección **"Marcas"**: lista de marcas (mejor/última) + "＋ Marca".
2. "＋" / añadir entrada → **bottom-sheet de registro** (nombre, valor, fecha=hoy, nota).
3. Tap en una marca → **bottom-sheet de detalle**: gráfica + entradas (editar/borrar con undo) + calculadora %.
4. **Progreso · Historial** → carril **"Marcas"** → tap → **el mismo** sheet de detalle.

## IA
- **Sin prompt nuevo ni feature IA nueva.** Se añaden al contexto (`server/ai/context.ts`, bloque de
  `ATHLETE_CONTEXT` o adyacente) las marcas con su **última entrada + progresión reciente** (últimas N
  entradas, no solo el valor actual) para que el Chat pueda hablar de **progresión** bajo demanda =
  interpolar variables (permitido, principio 9).
- **Guardarraíl anti-sobreatribución** en el Chat (al estilo del anti-invención de F02): "no afirmes causalidad
  entre nutrición y una marca; señala co-ocurrencia como observación, no diagnóstico" (principio 8). Re-validar
  que el Chat sigue sin prescribir.
- **Coste**: marginal (unas líneas de contexto; sin llamadas nuevas).

## Impacto en Coach/Chat/Visita
- **Chat**: puede responder "¿cómo comía cuando hice mi PR de X?" con el detalle que ya tiene.
- **Visita**: "Preparar visita" puede citar la evolución de marcas como **evidencia** (nunca prescripción).
- **Coach diario**: propuesta = **NO** meter las marcas a diario (ruido); solo Chat/Visita. (decisión discutible)

## AC
1. Puedo crear una marca con nombre libre y tipo de medida; queda guardada.
2. Puedo añadir entradas fechadas a una marca; la fecha default es **hoy** (Europe/Madrid vía `lib/dates`).
3. 🖐 El sheet de detalle muestra gráfica de progresión + todas las entradas, e indica si la última **mejora**
   según el tipo (peso/reps/distancia ↑ mejor; tiempo ↓ mejor).
4. 🖐 La calculadora da X % de una marca de peso correctamente (85 % de 110 = **93,5 kg**).
5. Editar/borrar entrada es **optimista con undo**; borrar una marca entera **sí pide confirmación** (07).
6. **Export** incluye marcas + entradas; **restore** las recupera sin pérdida (principio 7).
7. 🖐 El Chat responde a preguntas de **progresión** y de **correlación** citando datos reales (histórico de
   entradas incluido) **sin afirmar causalidad**.
8. 🖐 Las marcas aparecen como **carril en el Historial** y abren el sheet de detalle.
9. Nada nuevo permanente en **Hoy**; `pnpm typecheck && pnpm test` en verde.

## Riesgos / decisiones discutibles
1. **Identidad por nombre libre**: "Sentadilla 1RM" y "Sentadilla 5RM" son **dos marcas distintas**, no un
   movimiento con esquema de reps. Es lo más simple y agnóstico; a cambio, la calculadora de % la aplicas a la
   marca que elijas (85 % de un 5RM no es estándar — responsabilidad de Alex). **Recomiendo aceptarlo.**
2. **Marcas en el Coach diario**: propongo **no** incluirlas (ruido diario) y sí en Chat/Visita.
3. **Valor titular = última entrada** (decidido por Alex): la lista y la calculadora usan la **última**; la
   **mejor** se ve en la gráfica del detalle. Todo **derivado en lectura** (sin desincronización).

## Fases
- **Fase 1** (esta): todo el Alcance de arriba.
- **Fase 2** (futura, no ahora): auto-resolver los "@85 %" de la sesión importada (F-IA-10) contra las marcas.
