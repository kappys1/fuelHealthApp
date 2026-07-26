# F16 · Comidas flexibles: contexto, adherencia e impacto
**Estado**: implementada (2026-07-26; validación 🖐 pendiente) · **Tamaño**: feature
**Fecha**: 2026-07-26 · **Origen**: uso real de Alex (25–26-jul) sobre
`feat/wellness-premium-v2`.

## Motivación (caso real)
Alex mantiene una **ventana flexible personal** —no prescrita explícitamente por Regenera y
sin condiciones formales— que suele abarcar la cena del sábado y el almuerzo/desayuno,
comida y merienda del domingo. Intenta que esas comidas encajen lo máximo posible y algunas,
como la merienda, pueden terminar siendo normales.

El 25-jul registró una pizza como cena flexible:

- **Antes de cenar**, el Coach no conocía la intención. Vio 992 kcal, 55 g de proteína y
  103 g de hidratos pendientes antes de un T6 y recomendó hidratos en la merienda más
  210 g de pollo/pavo en una cena que él suponía normal.
- **Después de registrarla**, el Gauge mostró correctamente 2.440/1.800 kcal (+640),
  119 P, 273 C y 94 F. La lectura actualizada del Coach no llamó malo al día, pero trató la
  pizza como algo a monitorizar con el nutricionista por su efecto sobre un peso puntual de
  91,4 kg y recomendó «equilibrar la semana» al día siguiente.
- **Adherencia** sigue contando el día como fuera de rango: hoy todo día Normal entra en el
  denominador y solo puntúa si queda dentro del ±10 % (`adherence.ts`). Por tanto, un simple
  chip o un cambio de tono del Coach no resolverían el problema completo.

Problema de producto: Fuelboard debe distinguir una comida flexible **deliberada** de una
desviación ordinaria, sin fingir que sus kcal desaparecen, sin convertirla en pauta del
nutricionista y sin permitir que quede invisible en el balance energético.

## Alcance

### 1. Marcador por momento
- Se puede marcar como flexible cualquiera de los momentos del plan:
  `almuerzo | comida | merienda | cena`. `extra` no se marca.
- El marcador pertenece a `fecha + momento`, no a cada entrada ni al día entero.
- Estados **derivados**, sin columna de estado:
  - **Flexible prevista**: existe marcador pero no hay ninguna entrada en ese momento.
  - **Flexible real**: existe marcador y hay ≥1 entrada con la misma `fecha + momento`.
- Añadir la primera entrada transforma prevista→real automáticamente. Borrar la última
  entrada transforma real→prevista. Desmarcar no borra ni modifica comidas.
- Varias flexibles reales en una fecha producen **un solo día flexible** para analítica,
  conservando la lista de momentos para UI/contexto.

### 2. Regla puente momento→día
- Un día con ≥1 flexible **real**:
  - queda fuera del numerador y denominador de **kcal en rango**;
  - conserva su proteína en el cálculo normal de `protOk`;
  - aparece contado explícitamente como `día flexible`, nunca oculto;
  - conserva el día ENTERO —todas sus entradas— en ingesta media/TDEE, Tendencia y
    peso/ma7.
- Una flexible solo **prevista** no afecta a adherencia ni analítica histórica.
- Flexible es un contexto separado, **NUNCA una fase**.

### 3. Contexto visual
- El Gauge mantiene las cifras y el delta numérico reales. No descuenta kcal ni adopta el
  modo de fase especial.
- Con flexible **real**, el veredicto y color pasan a neutro-informativo (azul): +640 sigue
  siendo +640, pero no se presenta visualmente como alerta/fallo. `gaugeVerdict` recibe el
  flag flexible real y devuelve este contexto/tone como fuente pura compartida por UI y
  Coach (el Coach lo recibe precalculado en servidor); el componente no inventa otra regla.
- Con prevista muestra contexto discreto: `Cena flexible prevista`.
- Con real añade: `Incluye cena flexible · total estimado`; si hay varias, lista los
  momentos de forma compacta.
- La gráfica de ingesta conserva la altura real de la barra. Su tooltip etiqueta los
  momentos flexibles; no reutiliza el borde de fases especiales.
- En **Progreso · Historial → Últimos días**, un día con flexible real muestra el chip
  `Flexible`; una prevista vacía no aparece en histórico.

### 4. Adherencia transparente
- `computeAdherence` distingue:
  - días con registro;
  - días evaluables para kcal (fase Normal y sin flexible real);
  - días evaluables para proteína (todos los días en fase Normal, incluidos flexibles);
  - días flexibles reales;
  - fases especiales.
- `enRango` se calcula solo sobre los evaluables para kcal; `protOk` conserva los flexibles
  y solo excluye fases especiales, como hoy.
- La tarjeta mantiene el porcentaje principal sobre días evaluables para kcal y enseña
  ambos denominadores, p. ej.:
  `9/10 kcal · 12/12 proteína · 2 flexibles fuera de kcal`.
- Una flexible no cuenta como éxito ni fallo de kcal; su proteína sí cuenta.

### 5. KPI «Impacto flexible · 28 d»
- Vive en **Progreso · Tendencia**, como tarjeta informativa a ancho completo bajo
  `Consistencia`; nunca en Hoy.
- Propósito: comparar la ingesta media regular con la ingesta media en días flexibles para
  decidir, junto con Regenera, la programación futura de la dieta. Si la diferencia
  observada se mantiene alrededor de ±5–10 %, Alex puede ver que la flexibilidad no está
  alterando materialmente el promedio; si es mayor, el dato permite discutir tamaño,
  frecuencia o cómo incorporarla a la pauta. Fuelboard **muestra evidencia**, no toma esa
  decisión ni prescribe el ajuste.
- Solo aparece tras la primera flexible real.
- Ventana fija: hoy y los 27 días naturales anteriores.
- Conjuntos comparables:
  - `F`: días con registro, fase Normal, objetivo kcal válido y ≥1 flexible real.
  - `R`: días con registro, fase Normal, objetivo kcal válido y ninguna flexible real.
- Métricas puras:
  - `flexibleDays`, `flexibleMoments`, `regularDays`;
  - `flexibleMeanKcal` y `regularMeanKcal`;
  - porcentaje medio del objetivo histórico de cada grupo
    (`mean(kcal / objetivoVigente × 100)`);
  - `diferenciaObservadaKcal = flexibleMeanKcal − regularMeanKcal`;
  - `diferenciaObservadaPct = diferenciaObservadaKcal / regularMeanKcal × 100`.
- La UI principal muestra, siempre con `≈` y signo:

  ```text
  Impacto flexible · 28 d
  Regular       1.780 kcal · 99 % objetivo
  Con flexibles 1.940 kcal · 108 % objetivo
  Diferencia observada ≈ +160 kcal (+9 %)
  8 momentos · 4 días flexibles
  ```

- La comparación solo aparece con **≥3 días flexibles y ≥7 regulares**. Antes:
  `2 días flexibles registrados · todavía sin datos suficientes para comparar`.
- Es una diferencia **observada**, no causal. No usa colores de aprobado/fallo.
- `intakeMean`/TDEE y este KPI son vistas distintas con propósitos distintos:
  - `intakeMean` mezcla todos los días Normales, incluidos flexibles, porque reconstruye la
    verdad energética que acompaña a la pendiente del peso (principio 1);
  - el KPI separa F/R solo para describir el patrón y apoyar una decisión futura.
- Se elimina de v1 el cálculo abstracto `impacto del periodo ≈ +X kcal/día`: las dos medias,
  sus porcentajes de objetivo y la diferencia responden mejor a la pregunta de Alex.

## NO-alcance
- No llamar `cheat`, `trampa` ni `pautada`: la etiqueta de producto es **Flexible**.
- No contador, cuota, límite ni objetivo semanal de flexibles.
- No automatizar sábado/domingo ni auto-marcar por detectar pizza/restaurante.
- No descontar kcal, aplicar multiplicadores ni cambiar objetivos.
- No convertir flexible en `phase` ni excluir su ingesta/peso del TDEE o ma7.
- No compensaciones automáticas ni prescripción para el día siguiente: volver a la pauta
  habitual basta.
- El KPI de kcal F/R sí entra y es descriptivo. Lo que queda fuera de v1 son
  **correlaciones fisiológicas** de flexibles con peso, HRV, sueño o hinchazón; con pocas
  semanas producirían causalidad falsa. Puede reconsiderarse con uso real suficiente.
- No recomendar automáticamente reducir tamaño/frecuencia de flexibles ni cambiar la
  pauta: el KPI prepara evidencia para Alex y Regenera (principio 8).
- No desglose KPI por Almuerzo/Comida/Merienda/Cena en v1. Primero medir si el agregado
  resulta útil.
- No modificar la dieta versionada ni presentar la rutina personal como indicación de
  Regenera.
- Copiar ayer, aplicar/guardar una plantilla, duplicar entradas y el volcado del día
  F-IA-4 copian **solo comidas**, nunca el marcador flexible: es una decisión de esa fecha.

## Momento de uso (09 §1)
- **Planificar una comida del día**: puntual, antes de pedir/cocinar; necesita que Coach y
  Chat ajusten sus recomendaciones desde ese momento.
- **Registrar una comida**: 3–5×/día; el marcado no añade un paso obligatorio al flujo.
- **Revisar tendencia**: semanal/mensual; ahí vive adherencia + KPI de 28 días.

## Datos
Nueva tabla aditiva `flexible_meals`:

```text
date       date FK → days.date ON DELETE CASCADE
meal       meal (almuerzo|comida|merienda|cena; extra rechazado)
created_at timestamptz
PK/UNIQUE  (date, meal)
```

- `date` es siempre la clave de día de **Europe/Madrid**, construida/validada mediante
  `lib/dates.ts`. Está prohibido derivarla con `toISOString().slice(0,10)`; la cena del
  sábado cerca de medianoche es el caso frontera central.
- La API hace upsert idempotente del día antes de marcar una comida vacía.
- No se persiste `prevista|real`: se deriva cruzando el marcador con `meal_entries`.
- `DailyRecord`/vista del día transportan los momentos previstos y reales de forma
  inequívoca; la analítica histórica usa solo los reales.
- Nueva migración versionada, aditiva y sin backfill: los días existentes parten sin
  marcadores.
- Export/restore incluye la tabla y valida `date`, `meal` y FK. `migrate:poc` acepta que el
  campo no exista y migra cero flexibles; los nuevos exports hacen round-trip sin pérdidas.
- Marcar/desmarcar funciona offline mediante operación idempotente en la cola; al reconectar
  hace replay sin duplicados.
- El hash de lectura guardada del Coach incluye los marcadores para marcarla stale al
  cambiar el contexto.

## Flujo y diseño (09 §6)
- Hogar: sección expandida del momento en la timeline de Hoy. No crea página, tarjeta
  permanente ni sheet.
- Dentro del panel expandido, antes de las entradas, acción secundaria con target táctil
  ≥44 px:
  - sin marcador: `○ Marcar como flexible`;
  - marcada sin entradas: chip azul suave `Flexible prevista`;
  - marcada con entradas: chip azul suave `Flexible`.
- La acción es visualmente secundaria al CTA `Añadir a {momento}`. Azul informativo, sin
  rojo/naranja, alertas ni iconografía de fase.
- La fila colapsada incluye el chip en su línea secundaria para que el contexto sea visible
  sin abrirla.
- Mutación optimista; marcar y desmarcar muestran toast con `Deshacer`.
- No hay confirmación destructiva: desmarcar no toca las entradas.

### Colisión con fases especiales
- Si el día ya está en Carga/Competición/Recuperación, no se ofrece crear un marcador:
  la fase tiene precedencia y ya define su tratamiento.
- Si se marca primero y después se cambia la fase, el dato no se borra. La UI muestra la
  fase como contexto principal y permite retirar el marcador existente; analítica y KPI
  clasifican el día solo como especial, no además como flexible.

## IA
Arreglo en jerarquía **dato > diseño > prompt > modelo**:

- Sin modelo nuevo ni llamada adicional.
- En primera instancia no se cambia la redacción congelada de prompts.
- El servidor añade un bloque determinista de contexto flexible:
  - prevista: decisión personal, kcal aún desconocidas; no intentar cerrar ese momento con
    opciones del plan;
  - real: kcal cuentan; contextualizar sin llamar fallo ni prescribir compensación.
- `pendingPlanOptions` omite los momentos marcados (previstos o reales).
- La directriz de cierre conserva una recomendación útil para otro momento —p. ej. hidratos
  en merienda pre-T6—, pero no usa la cena flexible para cerrar macros del plan.
- Si los casos canónicos demuestran que el modelo ignora el dato, se para y se enmienda la
  spec antes de tocar `prompts.ts` (con protocolo de congelados).
- Coste incremental: 0 llamadas; solo unas líneas de contexto cuando aplica, impacto
  despreciable frente al presupuesto mensual.

## Impacto en Coach/Chat/Visita

### Coach
- Ve previstas y reales del día analizado.
- El marcador participa en `coachContextHash`.
- Caso **antes de la pizza**: puede conservar la gasolina pre-T6, pero no recomendar
  pollo/pavo para una cena ya marcada flexible ni intentar rellenar todo el hueco.
- Caso **después de la pizza**: reconoce el contexto, mantiene 2.440 kcal/119P/273C/94F,
  no atribuye un peso puntual a la pizza y no propone «equilibrar/compensar» al día
  siguiente.

### Chat
- En el día en curso ve previstas y reales.
- En histórico, `dayLines` y el detalle por comidas etiquetan solo flexibles reales.
- `trendAndAdherence` incluye días evaluables + flexibles aparte y, con muestra suficiente,
  el KPI precalculado. El modelo narra; no calcula la comparación.

### Preparar visita
- Recibe flexibles reales en las líneas de 30 días.
- Con muestra suficiente recibe frecuencia + diferencia observada del KPI como evidencia
  para formular una pregunta si aporta; no afirma causalidad ni lo convierte siempre en
  tema de consulta.

## Criterios de aceptación

### Dato y ciclo de vida
1. 🖐 Expando un momento vacío, pulso `Marcar como flexible` y veo `Flexible prevista` en el
   panel y la fila colapsada; persiste tras recargar.
2. 🖐 Añado la primera entrada a ese momento y pasa a `Flexible` sin otra decisión.
3. 🖐 Borro la última entrada y vuelve a `Flexible prevista`; el día deja de estar excluido
   de adherencia.
4. 🖐 Desmarco una flexible con entradas: las entradas permanecen intactas y el toast permite
   deshacer.
5. El API rechaza `extra`, es idempotente y no duplica `(date, meal)`.
6. 🖐 En fase especial no puedo crear una flexible nueva; si cambio la fase después, la fase
   prevalece sin borrar el marcador.

### Analítica y visualización
7. Un día Normal con flexible prevista vacía sigue en adherencia; con flexible real queda
   fuera del numerador/denominador de kcal, suma `flexibleN +1` y conserva su proteína en
   `protOk` y su denominador.
8. Dos momentos flexibles reales el mismo día suman un solo día flexible y dos momentos.
9. La tarjeta de adherencia muestra denominadores separados: los días flexibles quedan
   aparte para kcal, pero su proteína cuenta como éxito o fallo normal.
10. Regresión pura: una flexible real con `phase == null` conserva el 100 % de sus kcal en
    `intakeMean`/TDEE y su peso en ma7. Esa media energética combinada es deliberadamente
    distinta de las medias F/R del KPI. `computeDeficit`/`eligibleWeightSeries` no filtran
    por flexible.
11. 🖐 El Gauge mantiene 2.440/1.800 y +640 para el caso pizza, añadiendo el contexto
    `Incluye cena flexible`; `gaugeVerdict` conoce el flag y devuelve tono
    neutro-informativo azul, sin estado de alerta y sin activar modo de fase.
12. La barra de Tendencia mantiene su altura real y el tooltip identifica `Cena flexible`.
13. `computeFlexibleImpact` pasa fixtures a mano, incluye objetivos históricos y no mezcla
    fases especiales.
14. 🖐 Con <3 días flexibles o <7 regulares, el KPI enseña conteos sin comparación; al llegar
    al umbral muestra las dos medias, porcentaje de objetivo y diferencia kcal/% con `≈`,
    signo y tamaños de muestra; no muestra el antiguo `impacto del periodo`.
15. 🖐 En Progreso · Historial → Últimos días, una flexible real pasada muestra el chip
    `Flexible`; una prevista vacía no aparece.

### IA
16. 🖐 **Canónico pre-cena (25-jul)**: 992 kcal/55P/103C pendientes, T6 en ~4,6 h y Cena
    flexible prevista → puede sugerir una merienda pre-WOD útil, pero NO propone pollo/pavo
    ni opciones del plan para la cena y NO intenta cerrar todo el hueco.
17. 🖐 **Canónico post-cena**: 2.440 kcal/119P/273C/94F, pizza en Cena flexible → la
    contextualiza sin causalidad con el peso puntual, sin «consúltalo con tu nutricionista»
    por una sola comida y sin compensación al día siguiente.
18. Caso contrario del péndulo: una cena NO marcada conserva el comportamiento actual del
    Coach y sí puede proponer una opción del plan cuando la directriz lo pide.
19. Chat conoce prevista/real en el día actual; en histórico y Preparar visita solo afirma
    flexible cuando hubo marcador + entrada.
20. No aumenta el número de llamadas IA ni cambia modelo/temperatura.

### Integridad y regresión
21. La fecha del marcador usa `lib/dates.ts`: una cena del sábado alrededor de medianoche
    conserva la fecha local Europe/Madrid; test de frontera y ausencia de
    `toISOString().slice(0,10)` en este camino.
22. Marcar/desmarcar offline actualiza optimistamente y converge tras replay sin duplicados.
23. Export→restore conserva todos los marcadores; un export antiguo sin la tabla restaura
    cero flexibles sin error.
24. Copiar ayer, plantilla, duplicar entrada y F-IA-4 no crean ni trasladan marcadores
    flexibles; solo copian sus entradas.
25. Hoy no gana tarjeta permanente y el CTA de añadir conserva la jerarquía; el control
    flexible cumple target táctil ≥44 px y no aumenta los toques del registro normal.
26. El chip/tono azul flexible pasa AA en temas claro y oscuro; `pnpm audit:contrast` es
    gate junto a `pnpm typecheck && pnpm test && pnpm build`. Lógica pura antes que UI.

## Riesgos / decisiones discutibles
1. **Excluir de kcal-en-rango una rutina no prescrita** puede inflar el porcentaje si se
   abusa. Mitigación elegida: no cuenta como éxito, se muestra `flexibleN` explícitamente,
   la proteína sigue contando y el KPI devuelve su impacto energético. No hay límite ni
   juicio moral.
2. **Comparación con pocos datos**: una pizza dominaría el resultado. Mitigación: mínimo
   3 días flexibles + 7 regulares, tamaños visibles y `≈`.
3. **Contrafactual del KPI**: la diferencia flexible↔regular es observada, no prueba cuánto
   «causó» la flexible. Se muestran los porcentajes de los objetivos históricos y se prohíbe
   lenguaje causal.
4. **Prevista en v1** aumenta el alcance, pero es imprescindible: sin ella no se resuelve la
   recomendación errónea anterior a la cena. La intención vacía nunca altera adherencia.

## Fases
- **Fase 1 · Dato + ciclo de vida**: migración, queries/API, estado derivado,
  export/restore/`migrate:poc`, offline e integración optimista en la timeline.
- **Fase 2 · Lectura cuantitativa**: adherencia, regresión TDEE/ma7, Gauge, gráfica y
  `computeFlexibleImpact` + tarjeta de 28 días.
- **Fase 3 · Contexto IA**: directriz determinista, opciones pendientes, hash del Coach,
  Chat/Visita y casos canónicos.

Orden: el dato existe antes de consumirlo; analítica pura antes que UI; IA recibe resultados
precalculados. Cada fase termina con `pnpm typecheck && pnpm test` en verde y validación de
sus AC antes de avanzar.

## Implementación

- Fase 1: `c958fe6` · dato, migración `0016`, API/ciclo de vida, export/restore,
  `migrate:poc`, offline y timeline.
- Fase 2: `327a7c9` · adherencia, regresiones TDEE/ma7, Gauge, Tendencia, Historial y KPI.
- Fase 3: `10824d1` · contexto determinista de Coach/Chat/Visita, hash y casos canónicos.
- Gate automatizado: `pnpm typecheck`, 373 tests, React Doctor 100/100. El cierre de
  producción conserva pendientes los AC 🖐 1, 2, 3, 4, 6, 11, 14, 15, 16 y 17.
