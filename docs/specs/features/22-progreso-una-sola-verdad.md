# F22 · Progreso: una sola verdad (ventana canónica, cobertura declarada y gráfico honesto)

**Estado**: aprobada (Alex, 2026-08-03) · **Tamaño**: feature (4 fases)
**Fecha**: 2026-08-03 · **Origen**: conversación del 2026-08-03 — Alex vuelve de un fin de
semana comiendo libre y pregunta «¿me ha ensuciado las estadísticas? ¿falta ver algo?».
El diagnóstico destapó 3 bugs verificados en código, no un problema de redacción.

## Motivación (caso real)

Alex mira Progreso el lunes 3-ago y no consigue responder dos preguntas que sí importan
para la visita con Regenera:

1. **«¿La pauta funciona cuando la cumplo?»** — la respuesta está en pantalla
   (`Regular · 1806 kcal · 100 % objetivo`, es decir: clava 1800 en 16 de 22 días) pero
   enterrada al final, en 13 px, bajo un título que habla de otra cosa.
2. **«¿Cuánto me cuestan las salidas?»** — la app tiene el TDEE (2200) y las dos medias
   (1806 regular / 2442 flexible) y **no hace la resta**.

Y al verificar los números aparecieron tres defectos que hacen que la pantalla no sea
fiable ni siquiera para quien lee el código:

- **`tendencia.tsx:62`** es la única llamada a `computeDeficit` del repo que recibe una
  ventana recortada (`rangeRecords`). Chat (`chat/route.ts:213`), Coach
  (`coach/route.ts:124`) y Visita (`prepare-visit/route.ts:45`) usan el histórico completo.
  Default de pantalla: 90 d. **La cifra que manda tiene hoy dos valores distintos** según
  la superficie, y cambia al pulsar 14/30/90. Nada en la UI lo declara.
  El comentario de `context.ts:329` («mismas cifras que la pantalla») es falso, y
  `context.ts:425,429` etiqueta el dato como «(báscula, 7 d)» cuando no son 7 días.
- **`deficit.ts:70-73`** mide una secante entre `ma7(first)` y `ma7(last)`. Como `ma7At`
  promedia `[d−6, d]` *dentro de la serie recibida*, `ma7(first)` es **un peso crudo de una
  sola muestra** mientras `ma7(last)` sí está suavizado. Un extremo desviado 0,5 kg mueve
  el resultado ~0,15 kg/semana ≈ 165 kcal de TDEE (~7 %) — error del tamaño de la señal.
  El patrón correcto ya existe 13 líneas más abajo, en `tendencia.tsx:75-77`, para el
  gráfico.
- **`weight-chart.tsx:65-66,76-77`** — `connectNulls` + `dot={false}` + `type="monotone"`:
  los días sin pesaje se puentean con una recta indistinguible de un dato real. Con 19
  pesajes en 23 días hay 4 huecos; el tramo plano del 22 al 25-jul de la captura es casi
  con seguridad interpolación leída como «peso estable».

Y el patrón transversal: **la pantalla tiene seis ventanas temporales y el selector solo
manda sobre tres** (cifra que manda + 2 gráficos; Resumen 7/30 propio, Adherencia 14 fija,
Impacto flexible 28 fija, Racha sin ventana). Ahí está el «no se entiende».

## Alcance

**Fase 1 · Una sola verdad** (analítica pura, invisible)
- `computeDeficit` pasa a recibir el histórico completo **y** una ventana explícita: mide la
  pendiente solo dentro de la ventana, pero calcula `ma7(first)` con los 6 días previos
  reales (mismo patrón que el gráfico).
- **Ventana canónica de 30 días** para la cifra que manda, idéntica en pantalla, Chat,
  Coach y Visita. El selector 14/30/90/todo deja de afectarla.
- Fallback declarado: si en 30 d hay <8 pesajes o <7 días de span, se amplía a 90 d y la
  card lo dice («ventana ampliada a 90 d · pesajes insuficientes en 30 d»).
- **Trayectoria**: el mismo cálculo aplicado a los **3 últimos meses naturales cerrados**
  (`jul −0,20 · jun −0,31 · may −0,15` kg/semana). Responde «¿lo estoy haciendo bien a
  largo plazo?» mostrando si el ritmo se mantiene, acelera o frena — que es la pregunta
  real, no «¿cuál es mi pendiente a 90 días?».
  - **Meses naturales cerrados, no bloques rodantes de 30 d**: un bloque rodante cambia
    cada día que pasa; «julio» es un hecho fijo, se compara consigo mismo mes a mes y es el
    idioma del nutricionista. El mes en curso no aparece en la trayectoria: ya es el
    titular.
  - Mismo gate por mes (≥8 pesajes, span ≥7 d). Un mes que no lo cumple se muestra `—`,
    nunca se estima. Sin 2 meses válidos, la línea entera se omite.
  - Sin solape con el titular ni entre bloques: cada pesaje pertenece a un único mes.
- `DeficitResult` expone la ventana usada (`windowDays`, `windowFrom`, `windowTo`,
  `widened: boolean`) para que UI e IA la puedan declarar sin recalcularla.
- La trayectoria se obtiene llamando la misma función una vez por mes: **una sola
  metodología**, cero fórmulas nuevas. Es lo que hace baratos los bloques mensuales y la
  razón de que la Fase 1 vaya primero.
- Corregir la etiqueta de `context.ts:425,429` a la ventana real y el comentario de
  `context.ts:329`.

**Fase 2 · Cada cifra declara su ventana y su cobertura**
- Cifra que manda: `BALANCE REAL · DESDE EL PESO · 30 d` en la cabecera.
- Adherencia: `100 % · 8 de 13 días juzgados` (usa `n` y `kcalN`, que ya se calculan). Si
  `specialN > 0`, añadirlo — hoy se calcula en `adherence.ts:70` y **no se usa en ninguna
  parte de la UI**.
- Resumen: `En rango normal` pasa de `3/3` a declarar también el registrado
  (`3 de 3 juzgados · 6 registrados`).
- `Objetivo vigente` declara el cambio de pauta cuando la ventana contiene más de un
  target (`Objetivo: 1800 hasta 12-ago · 1900 desde entonces`). El historial ya existe en
  `history.ts`.
- El selector de rango declara sobre qué manda: `Afecta a los gráficos`.

**Fase 3 · El gráfico deja de inventar**
- Línea de peso diario: fuera `connectNulls`, `type="linear"`, `dot` visible y pequeño en
  los pesajes reales.
- Línea ma7: conserva `connectNulls` y `monotone` (es una media, no una medición), y el
  `HowCalculated` lo declara.

**Fase 4 · Desdoble de ritmos** (la respuesta a las dos preguntas de la Motivación)
- La tarjeta *Impacto flexible* existente pasa de comparar kcal a comparar **ritmos**,
  reusando el TDEE de la cifra que manda:

  | | Ingesta media | vs TDEE | Ritmo |
  |---|---|---|---|
  | Días de pauta | 1806 | −394 kcal/día | −0,36 kg/semana |
  | Días flexibles | 2442 | +242 kcal/día | +0,22 kg/semana |
  | Real ponderado | 1979 | −220 kcal/día | −0,20 kg/semana |

- La última fila **debe cuadrar con el déficit de la cifra que manda** (comprobado a mano:
  (16×394 − 6×242)/22 = 220,5 ≈ 220). Para que cuadre siempre, `FLEXIBLE_IMPACT_WINDOW`
  pasa de 28 a 30 d, alineada con la ventana canónica.
- Copy sin causalidad: es contabilidad («descomposición de tu déficit medio»), no
  atribución. Se conserva el tono azul informativo de F16; vocabulario `cheat`/`trampa`
  sigue prohibido.

## NO-alcance

- **Cambiar la secante por regresión lineal** sobre los pesajes. Sería mejor estadística,
  pero `03-DATOS §3` fija la fórmula y cambiarla mueve todas las cifras históricas: es
  cambio de doctrina, no fix. Con el borde izquierdo arreglado (Fase 1) desaparece la mayor
  parte del error. → `HANDOFF §B3`, con condición de reapertura: si tras la MED de agosto
  la predicción falla contra los pliegues, es el primer sospechoso.
- **Simulador contrafactual** («si de 3000 te reprimieras a 2500, la adherencia sería…»).
  Guardarraíl «producto disfrazado de feature» (doc 11) + principio 8. La Fase 4 ya da el
  90 % con datos reales: interpolar entre dos puntos medidos bate simular un Alex que no
  existió. → `HANDOFF §B3` con la forma honesta que sí tendría sentido: **el techo** («tu
  día flexible puede llegar a X kcal sin romper el déficit de la semana»).
- **Excluir de la ma7 los días posteriores a un flexible** (como hace `competicion`).
  Dejaría la muestra por debajo de los 8 pesajes y ocultaría subidas reales.
- **Tocar la fórmula de adherencia.** Mide bien; lo que falla es su rótulo.
- **Cambiar el criterio de marcado flexible de Alex.** Sus propios números lo validan: si
  dejara como Normal comidas que se salen de verdad, `Regular` saldría por encima de 1806
  y el 8/8 se rompería.
- **Desdoblar la cifra que manda en dos titulares.** Principio 1: una sola cifra manda. El
  desdoble vive abajo, donde vive el «por qué».
- Sin concepto de «día parcial» (`logged = n > 0`): descartado en la conversación — Alex
  registra completo, el infra-marcado era de flexibles, no de comidas.

## Momento de uso

**Progreso · Tendencia** (09 §1: momento de revisión, no de registro). Frecuencia real:
semanal + antes de cada visita a Regenera. No toca Hoy, no añade tarjeta permanente, no
crea sheet ni camino nuevo: **todas las superficies ya existen**.

## Datos

- **Sin migración. Sin cambios de schema.** Cero impacto en export/restore y en
  `migrate:poc`.
- Todo el dato nuevo es derivado de lo que ya se computa: `n`, `kcalN`, `specialN`
  (calculado y tirado hoy), `history.ts` para los targets de la ventana, y el TDEE.
- Cambio de firma en `computeDeficit` (histórico + ventana) y de constante en
  `FLEXIBLE_IMPACT_WINDOW` (28 → 30): actualizar sus 4 llamadas y sus tests.

## Flujo

Sin flujo nuevo. Se modifican, en su sitio actual: `TrendCard`, `KpiCard` de adherencia,
`SummaryCard`, `FlexibleImpactCard`, `WeightChart` y el selector de rango — todos en
`progreso/tendencia.tsx` + `charts/weight-chart.tsx`.

## IA

**Ningún prompt nuevo y ninguna redacción de `prompts.ts` cambia.** Solo se corrigen dos
etiquetas de dato en `server/ai/context.ts` (líneas 329, 425, 429) para que digan la
ventana real. Al ser dato que entra al prompt, se re-validan los AC de chat y coach
afectados por la línea de tendencia.

## Impacto en Coach / Chat / Visita

**Este es el punto que justifica la Fase 1.** Hoy las tres superficies reciben un déficit
calculado sobre el histórico completo mientras la pantalla muestra 90 d, y encima con la
etiqueta «7 d». Tras la Fase 1 las cuatro superficies comparten ventana canónica y la
etiqueta es verdadera. La Fase 4 no añade contexto nuevo a la IA: el desdoble es
aritmética que el Chat puede hacer desde `flexibleImpact`, que ya recibe.

La **trayectoria sí viaja al contexto**, pero solo a **Chat y Preparar visita** — una línea
de datos, sin instrucción nueva. Desbloquea respuestas que hoy son imposibles («vas más
lento que en junio», «llevas tres meses bajando»), y en la visita es literalmente el
material de la conversación con Regenera.
**Al Coach diario NO**: habla del día de hoy y de ayer; tres meses de pendiente no cambian
ninguna de sus respuestas y su prompt ya es largo (presupuesto de prompt, doc 11).

## AC

1. `computeDeficit` calcula `ma7(first)` usando los 6 días anteriores al borde de la
   ventana; test con fixture donde el borde tenía 1 sola muestra y ahora tiene 7.
2. La cifra que manda es idéntica en pantalla, Chat, Coach y Visita el mismo día; test que
   compara las 4 llamadas sobre el mismo fixture.
3. Pulsar 14/30/90/todo **no** cambia kg/semana, déficit ni TDEE.
4. Con <8 pesajes en 30 d la ventana se amplía a 90 d y la card lo declara.
4b. La trayectoria muestra los 3 últimos meses naturales **cerrados**, nunca el mes en
    curso, con la misma metodología que el titular; un mes que no llega al gate sale `—` y
    con <2 meses válidos la línea se omite entera. Test con fixture a caballo entre dos
    meses.
5. La adherencia muestra días juzgados sobre días registrados; con `specialN > 0` lo añade.
6. El Resumen declara el cambio de objetivo cuando la ventana contiene dos targets.
7. `weight-chart` no dibuja segmento entre dos pesajes separados por un día sin dato; los
   pesajes reales llevan punto visible.
8. La fila «real ponderado» de la Fase 4 cuadra con el déficit de la cifra que manda
   (±2 kcal/día); test con el fixture de las capturas del 3-ago.
9. `pnpm typecheck && pnpm test && pnpm audit:contrast` en verde; AA en ambos temas.
10. 🖐 Alex mira Progreso y sabe, sin abrir ningún desplegable, **de cuántos días** habla
    cada cifra.
10b. 🖐 Alex responde «¿lo estoy haciendo bien a largo plazo?» leyendo la línea de
     Trayectoria, sin tocar el selector.
11. 🖐 El tramo plano del 22-25 jul se ve como hueco, no como peso estable.
12. 🖐 Alex puede decirle a Regenera, leyendo una sola tarjeta: «clavo la pauta 16 de 22
    días; los otros 6 me cuestan la mitad del progreso mensual».
13. 🖐 Preguntar al Chat por la tendencia devuelve la misma cifra que la pantalla.

## Riesgos / decisiones discutibles

1. **La cifra que manda deja de responder al selector, pero el largo plazo no se pierde:
   se muda a la línea de Trayectoria.** (Resuelto con Alex el 3-ago: su objeción fue «me
   gustaba saber si lo estoy haciendo bien a largo plazo, no solo a 30 días» — legítima, y
   la versión anterior de esta spec se la quitaba.) El titular sigue siendo uno —principio
   1, literal: «Una sola cifra manda»— y los meses quedan visualmente subordinados, igual
   que las kcal del Watch respecto al peso.
   *Alternativas descartadas:* (a) dejar que el selector mande y pasar esa ventana a la IA
   — la IA no tiene selector, la divergencia volvería; (b) ventanas acumulativas 30/90/todo
   — se solapan, así que al mejorar un mes la cifra de 90 d arrastra el promedio viejo y
   **parece contradecir** al titular; (c) balance total desde el inicio (`−3,2 kg desde el
   5-may`) — motivante pero no dice nada del ritmo actual; queda en `HANDOFF §B3` como
   posible añadido a *Preparar visita*, donde el marcador sí encaja.
2. **`FLEXIBLE_IMPACT_WINDOW` 28 → 30.** Los números del KPI existente cambiarán un poco
   sin que Alex haya hecho nada distinto. Es el precio de que la aritmética cuadre; se
   documenta en el `HowCalculated`.
3. **La Fase 1 no se ve.** Es la más importante y la única sin recompensa visual. Se hace
   primero igualmente: decorar una cifra inestable es decorar. Si hubiera que sacrificar
   una fase por tiempo, es la 3, no la 1.

## Fases

| # | Qué | Dónde | Visible |
|---|---|---|---|
| 1 | Ventana canónica + borde de la ma7 + trayectoria (cálculo) + etiquetas de IA | `deficit.ts`, `context.ts`, 4 llamadas | No |
| 2 | Ventana y cobertura declaradas en cada tarjeta + trayectoria (render) | `tendencia.tsx` | Sí |
| 3 | Gráfico de peso honesto | `weight-chart.tsx` | Sí |
| 4 | Desdoble de ritmos | `flexibleImpact.ts`, `tendencia.tsx` | Sí |

Orden obligatorio 1 → 2 → 3 → 4: las fases 2 y 4 declaran y descomponen la cifra que la
fase 1 estabiliza. La 3 es independiente y puede adelantarse si conviene.
