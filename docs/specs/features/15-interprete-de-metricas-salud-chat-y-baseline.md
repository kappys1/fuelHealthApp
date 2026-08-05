# F15 · Intérprete de tus métricas de salud (Chat on-demand + detalle del Baseline)
**Estado**: propuesta (pendiente de OK de Alex) · **Tamaño**: feature
**Fecha**: 2026-07-25 · **Origen**: conversación de producto con Alex (25-jul) sobre
`feat/wellness-premium-v2`. Idea recurrente («siempre me he preguntado si las métricas del
Apple Watch podrían interpretarse por la IA para tener contexto amplio»). Absorbe el ítem de
backlog **«Cierre semanal dominical en Tendencia»** (`07-REFINAMIENTOS-PRO §5`).

## Motivación (caso real)
Alex ingiere a diario un montón de métricas del Apple Watch (HRV, FC reposo, sueño, pasos,
VO2max, kcal, agua, y muchas más en `extra`) pero:
- **El Chat/Coach está casi ciego a ellas**: `context.ts` solo expone 4-5 (pasos, HRV, sueño)
  y **no lee `extra` en absoluto** (`context.ts:497-502`, `schema.ts:242-247`). No puedes
  preguntarle «¿cómo va mi VO2max este mes?» y que responda con tus datos.
- **Los Δ del Baseline no dicen "esto se sale de lo normal"**: la tarjeta «Baseline personal»
  (`today-context.tsx:420`) muestra el crudo + Δ vs media 30d (`healthBaseline.ts`), pero un
  −2987 en pasos o −12 ms de HRV no viene marcado como desviación relevante de TU patrón.
- **No existe un informe/análisis narrado** por periodo (día/semana/mes).

## Encuadre de producto (decisiones tomadas en la conversación)
- El «intérprete profesional de datos» que Alex describe **es el Chat** (ya cruza rendimiento,
  salud, recomposición y nutrición, 09 §2). No se crea un apartado nuevo que interprete todo
  → sería **camino duplicado** (09 §6) del Chat/Coach/Tendencia. El hogar es el Chat; la puerta
  visible es un **sheet** desde el Baseline (no pantalla nueva).
- **On-demand, no en cada carga**: instinto de Alex + lección 4 del proyecto (presupuesto de
  prompt). La IA solo mira las métricas cuando se le pregunta (Fase 1) o cuando se pide el
  informe (Fase 2c). Nunca se inflan el prompt del chat ni el del coach con métricas.
- **Anomalías, versión honesta**: se rechaza el disparo proactivo con veredicto médico
  (falsos positivos por ruido de sensor — cf. HRV 194 = artefacto, F12 AC3; falsos negativos =
  falsa tranquilidad; principio 8). Se acepta un **flag informativo, determinista, presente en
  el sheet cuando se abre**: «fuera de tu rango habitual», calculado en `server/analytics/`
  (lección 1: dato > diseño > prompt > modelo). La IA **no inventa la anomalía; solo la explica
  cuando preguntas**. La regla es el **principio 5** (desviación de TU propio baseline, nunca
  umbral clínico absoluto).

---

## Fase 1 · El Chat ve tus métricas on-demand (capa B)

### Alcance
- Nueva **tool** del Chat (patrón `webSearchTools()`, `chat/route.ts:180-310`), p. ej.
  `healthMetricsTool()`, que el modelo invoca **solo cuando el usuario pregunta por una
  métrica**. Entrada: nombre(s) de métrica + rango de fechas (o «últimos N días» / «este mes»).
  Salida: serie/agregado desde `health_metrics` **incluido `extra`** (`schema.ts:230-247`),
  con la unidad y el nº de días con dato.
- Recuperación en servidor (query pura, testeable): dado un rango, devuelve por métrica
  `{ valores por día, media, min, max, sampleCount, unidad }`. Reusa el criterio de
  elegibilidad de `healthBaseline.ts` (p. ej. sueño ≤0 no hunde la media).
- **Frontera dura (como F05 P2)**: la tool va **SOLO en el Chat**. Nunca en coach/visita/
  estimadores.
- Pequeño párrafo en el prompt del chat (CONGELADO) declarando la tool y cuándo usarla
  («si el usuario pregunta por una métrica de salud/Watch, consúltala con la tool; no
  inventes valores»). Sync a `04-IA.md` + re-validar los AC del chat + casos canónicos nuevos
  en `prompts.test.ts`.

### IA
- **Modelo**: el del chat (`AI_MODEL_CHAT`/`AI_MODEL_COACH` según cableado actual), sin env
  nueva. `temperature` del chat (0.3) sin cambios. La tool es *provider/servidor-executed*: la
  IA pide datos, el servidor responde con números reales → la IA narra. No estima métricas.
- Guardarraíl heredado: métricas del Watch = **contexto con peso adecuado, nunca ganan a la
  báscula como verdad del gasto** (principio 1). Observación, no prescripción (principio 8).

### AC — Fase 1
- **F1.1.** «¿Cómo va mi VO2max este mes?» → el Chat responde con el valor real y su tendencia
  (dato de `extra`/columna), no inventado. 🖐
- **F1.2.** «¿Dormí peor los días de peor adherencia esta semana?» → cruza sueño con los días,
  responde con datos reales o dice que faltan. 🖐
- **F1.3.** Si no hay dato para el rango → lo dice, no rellena. 🖐
- **F1.4.** La métrica **no** aparece en el prompt del coach/visita (frontera dura). Cubierto
  por test del builder.
- **F1.5.** Regresión: `pnpm test` verde; casos canónicos nuevos en `prompts.test.ts`; resto
  del chat sin cambios de comportamiento.

---

## Fase 2 · Sheet de detalle desde «Baseline personal» (capa C1)

Tocar la tarjeta «Baseline personal» (`today-context.tsx:420`) abre un **bottom-sheet** con:

### 2a · Detalle de todas las métricas
- Métricas crudas + Δ vs tu media 30d de: las 4 actuales (HRV, FC reposo, sueño, pasos) **+
  VO2max, kcal activa/basal, agua** (columnas tipadas) **+ las de `extra`** (masa magra, tiempo
  de ejercicio, SpO2, etc.) que tengan dato.
- Reusa/extiende `healthBaseline.ts`: hoy `BASELINE_METRICS` son 4; ampliar el cálculo a las
  columnas tipadas + iterar `extra`. Sin migración (los datos ya están).

### 2b · Flag determinista «fuera de tu patrón»
- Extender `healthBaseline.ts` (función pura, **test antes que UI**) para calcular la
  **variabilidad** de cada métrica en la ventana de 30d (desviación típica) y un
  `deviation: 'normal' | 'alto' | 'bajo'` cuando `|delta| > k · std` (k documentado, default
  ~2; guard de `sampleCount` mínimo). Color semántico (ya usado en MED, `medDeltas`).
- **Dirección del "bien" solo en las métricas conocidas** (HRV↑ bien, FC reposo↑ mal, etc.);
  para métricas arbitrarias de `extra` se muestra el flag «fuera de rango» **sin** opinión de
  bueno/malo (no sabemos su dirección → honestidad, principio 8).
- Es **informativo y pasivo**: badge en el sheet al abrirlo. **NO** hay notificación proactiva
  ni veredicto médico. Ningún «ve al médico» automático.

### 2c · Informe / análisis narrado on-demand
- Botón **«Analizar»** con selector de periodo **día · semana · mes** → **una** llamada IA
  (cuando se pide, no en cada carga) que narra: qué se movió, qué está fuera de tu patrón, y
  cómo se relaciona con dieta/entreno/recomposición. **Prompt NUEVO y CONGELADO** en
  `server/ai/prompts.ts` (cubierto en `prompts.test.ts`), sync a `04-IA.md`.
- **Modelo**: `AI_MODEL_COACH` (narración, ya en uso), sin env nueva. `temperature: 0`.
- Guardarraíles en el prompt (van a AC): observación no prescripción (ppio 8); desviación de tu
  baseline no umbral clínico (ppio 5); el peso/báscula manda sobre kcal del Watch (ppio 1);
  nudge a un profesional **solo hedgeado y solo si el propio dato se sale mucho**, nunca alarma.
- El **«cierre semanal»** del backlog (07 §5) = este informe con periodo = semana. Queda
  absorbido; **no** se construye la tarjeta dominical automática de 07 §5 (se accede on-demand).

### 2d · Puente al Chat
- Enlace **«Pregúntale en el chat»** desde el sheet → abre el Chat (usa la tool de Fase 1 para
  responder con esas métricas). Reusa el patrón puente Coach→Chat (F01 Fase 2, opción A1).

### Datos
Sin migración de BD. Todo sale de `health_metrics` (columnas + `extra`) y `workouts`, que ya
existen. Sin impacto en export/restore ni `migrate:poc`. El flag y las medias se derivan al
vuelo (analytics puro); no se persiste `deviation` (señal calculada).

### AC — Fase 2
- **F2.1.** Tocar «Baseline personal» abre el sheet con crudas + Δ de las 4 + VO2max + kcal +
  agua + las de `extra` con dato. 🖐
- **F2.2.** Una métrica muy desviada de tu media (más de k·std) muestra el badge «fuera de tu
  rango»; una dentro de rango, no. Función pura testeada. 🖐 + test
- **F2.3.** Métrica conocida (HRV/FC reposo) colorea dirección (mejor/peor); métrica de `extra`
  desconocida marca desviación **sin** juicio de bueno/malo. 🖐 + test
- **F2.4.** «Analizar» con periodo semana genera un informe narrado con tus datos reales;
  cambiar a mes cambia el periodo. Es **observación**, no da órdenes de dieta ni diagnostica. 🖐
- **F2.5.** El informe **no** empuja «ve al médico» salvo, como mucho, un matiz reactivo y
  hedgeado ante una desviación grande. Caso canónico en `prompts.test.ts`.
- **F2.6.** «Pregúntale en el chat» abre el Chat y responde sobre esas métricas (Fase 1).  🖐
- **F2.7.** Regresión: `pnpm test`/`typecheck`/`build` verdes; contraste AA del sheet.

---

## NO-alcance (C2 → backlog, medir/ingerir antes)
- **Cardio minuto a minuto**: `workouts` solo guarda `{tipo, duración, FC media, kcal}`
  (`schema.ts:255-262`); **no hay serie intra-entreno** (curva de pulso, ritmo, distancia,
  potencia). «Analizar un cardio con todas las métricas del momento» necesita **ingesta nueva**
  → fuera. Lo que sí entra: el entreno como contexto grueso del día.
- **Detección proactiva de anomalías médicas / notificación-alarma**: rechazada (ppio 8 +
  fiabilidad). Solo el flag pasivo determinista (2b) y el nudge reactivo hedgeado (2c).
- **«Optimización deportiva»** como motor aparte: sin caso con fecha; el Chat ya razona sobre
  ello con los datos (Fase 1).

## Momento de uso (09 §1)
**Progreso / consulta** — Alex entra a diario o cuando quiere ver algo (VO2max, pasos, kcal,
sueño) y poder preguntar. Frecuencia: recurrente.

## Flujo (09 §6)
Todo en **bottom-sheet** (detalle del Baseline) + el **Chat** existente. No se crea pantalla ni
tarjeta permanente nueva (la tarjeta «Baseline personal» ya existe; solo se hace tocable). Una
decisión por paso; el informe es una acción explícita on-demand.

## Impacto en Coach/Chat/Visita
- **Chat**: gana la tool de métricas (Fase 1) + puente de entrada desde el sheet. Prompt del
  chat CONGELADO → sync `04-IA.md` + re-validar AC del chat.
- **Coach/Visita**: sin cambios (frontera dura P2). No se les añaden métricas al contexto.
- **Informe**: prompt nuevo congelado, propio, aislado de los demás.

## Riesgos / decisiones discutibles
1. **Umbral del flag (k·std)**: elegir k y `sampleCount` mínimo es un juicio; se documenta en
   el código y se ajusta con uso real. Riesgo bajo (informativo, reversible).
2. **`extra` sin dirección de "bien"**: se muestra desviación sin juicio para métricas
   arbitrarias. Decisión honesta pero puede saber a poco en alguna métrica conocida que no
   modelemos → se pueden ir promoviendo métricas de `extra` a "conocidas" con el tiempo.
3. **Nudge médico reactivo**: aún hedgeado, es la parte más cerca del principio 8; el AC F2.5
   lo acota y el caso canónico lo fija.
4. **Coste IA**: 1 llamada por informe pedido + la tool solo cuando preguntas. Céntimos; nada
   en cada carga.

## Fases (orden de entrega)
- **Fase 1 · B** (chat on-demand): query pura + tool + párrafo de prompt + tests. Entrega el
  ~80% del valor sola. 1 sesión.
- **Fase 2 · C1** (sheet de detalle): 2a detalle → 2b flag determinista (lógica antes que UI) →
  2c informe IA on-demand → 2d puente al chat. 1-2 sesiones.

Regla: lógica pura testeada antes que UI en cada fase; prompts congelados → sync 04-IA +
re-validar AC; `pnpm typecheck && pnpm test` verde antes de cada commit; commits pequeños.
