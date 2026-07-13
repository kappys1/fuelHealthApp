# F02 · El Chat conoce lo que has comido (detalle por item + anti-invención)
**Estado**: implementada (v1.4, desplegada; AC 🖐 pendientes de validación de Alex) · **Tamaño**: feature pequeña (builder de contexto + query + plantilla F-IA-8)
**Fecha**: 2026-07-13 · **Origen**: uso real 2026-07-13 tras F01 (Alex, vía puente Coach→Chat)

## Motivación (caso real)
El 13-jul Alex cruza el puente Coach→Chat y pregunta sobre su merienda «en base a lo que he
merendado hoy». El Chat responde «los datos de hoy no detallan qué alimentos específicos has
consumido»… y acto seguido **se inventa** «tu cena pautada estándar suma ~580 kcal» y se pone
a restar sobre ese dato inexistente. Dos fallos:
- **Datos**: el `chatSystemPrompt` recibe los últimos 30 días como **una línea de totales por
  día** (`dayLines`/`days30`), sin el desglose por comida/item. El Coach sí lo tiene
  (`dayContext`) → asimetría: al llegar del puente, el Chat «sabe menos» de hoy que el Coach.
- **Comportamiento**: cuando le falta un dato, en vez de decirlo limpio, inventa cifras y
  divaga (viola principios 2 y 8).

## Alcance
1. **Guardarraíl anti-invención** (pieza central, `chatSystemPrompt`, F-IA-8): si le piden un
   detalle que no figura en los datos, lo dice claramente y pide a Alex que se lo proporcione;
   **NUNCA** inventa comidas, cantidades ni un «día pautado estándar», ni calcula sobre datos
   que no tiene. Sincronizar a `04-IA.md`.
2. **Detalle por item de los últimos 7 días** (rolling, incluye hoy) en el contexto del Chat:
   por cada día, sus comidas (`[comida] nombre: kcal (P/C/F)`), con el mismo grano que el
   Coach. Los días 8-30 se quedan como línea de totales (como ahora). Nueva query de rango
   (`mealEntriesInRange`, **una** query) + builder puro `recentMealsDetail`.

## NO-alcance
- **No** ampliar el detalle a 14/30 días ni a «la semana pasada completa» (8-14 d atrás): se
  empieza en 7 días rolling; el guardarraíl anti-invención hace la ampliación **reversible y
  medible por uso** (si el Chat dice «no tengo el martes» a menudo, se amplía entonces).
- **No** tocar el Coach (ya ve el día) ni Preparar-visita (va de tendencia; 21 días de items
  sería carísimo, principio 2).
- **No** hay schema, migración, ni cambios en export/restore/migrate:poc (solo lectura).
- **No** se toca temperatura (0.3), modelo, chips ni el resumen del hilo.

## Momento de uso (09 §1)
«Pregúntale a tus datos» profundizando sobre el día/semana en curso (Chat), típicamente tras
el puente del Coach. Sin límite de tiempo. No añade superficie nueva.

## Datos
Sin schema nuevo. `mealEntriesInRange(from, to)`: una query sobre `meal_entries` filtrando por
rango de `date` (comparación lexicográfica de claves 'YYYY-MM-DD'), ordenada por date+created.
`from = shiftDayKey(today, -6)`, `to = today` (7 días). Sin impacto en export/restore ni migrate.

## Flujo (09)
Sin UI nueva. Todo ocurre en el ensamblado del contexto del Chat (server), que ya se regenera
fresco por turno (F-IA-8).

## IA
No hay prompt **nuevo**. Se modifica la plantilla congelada F-IA-8 (`chatSystemPrompt`) por:
(a) el guardarraíl anti-invención, y (b) una sección nueva `COMIDAS POR ITEM (últimos 7 días)`
con el detalle. Se congela aquí y se sincroniza a `04-IA.md`; se re-validan los AC de F-IA-8.
El test de consistencia del café ×3 **no aplica** (no es feature de estimación). Coste:
+~1 día de detalle × 7 ≈ marginal-moderado, dentro del objetivo (<5 €/mes).

## Impacto en Coach/Chat/Visita
Solo el Chat cambia (más contexto + guardarraíl). Coach y Visita, sin cambios.

## AC
1. En el Chat, «¿qué he merendado hoy?» responde con los **alimentos reales** registrados hoy
   (no solo el total de kcal). 🖐
2. Preguntar por un día **sin datos** (p. ej. hace 10 días) → el Chat dice que no lo tiene y
   pide que Alex se lo proporcione; **no inventa** comidas ni cifras. 🖐
3. El `chatSystemPrompt` contiene el guardarraíl anti-invención (test del builder).
4. El `chatSystemPrompt` incluye la sección de detalle por item cuando hay comidas recientes
   (test del builder); `recentMealsDetail` agrupa por día (hoy primero) con los items.
5. Plantilla sincronizada en `04-IA.md`; AC previos de F-IA-8 siguen pasando.
6. `pnpm typecheck && pnpm test` en verde; deploy verificado. 🖐

## Riesgos / decisiones discutibles
1. **Se toca la plantilla congelada F-IA-8.** Mitigado: cambio acotado (guardarraíl + sección
   de datos que el momento de uso ya pedía); re-validar AC + sync obligatorio.
2. **Coste de contexto** (7 días de items). Aceptado: acotado a 7 días; el resto sigue en
   totales. El guardarraíl permite empezar corto y ampliar solo si el uso lo pide.
3. **7 días rolling vs semana ISO**: rolling (más simple y predecible). Decidido con Alex.

## Fases
Una sola fase (builder + query + plantilla + tests). Tests de lógica antes que nada.
