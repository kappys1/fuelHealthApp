# F01 · Coach fiable + puente al Chat
**Estado**: implementada (v1.3, desplegada; AC 🖐 pendientes de validación de Alex) · **Tamaño**: feature (3 fases; 2 quick-fix de prompt + 1 puente UI)
**Fecha**: 2026-07-13 · **Origen**: caso real 2026-07-13 (uso en el iPhone de Alex) + HANDOFF §B3

## Motivación (caso real)
El 13-jul Alex pregunta «¿cómo voy hoy?» en dos superficies y las dos fallan:
- **Chat**: responde un informe largo que afirma «hoy 18 de julio» y «sin datos del 14 al
  17» (días que no existen). **Raíz**: `chatSystemPrompt` (`server/ai/prompts.ts:162`) nunca
  declara qué día es hoy; con el último dato fechado el 13, el modelo alucina una fecha
  posterior. Envenena *cada* «¿cómo voy hoy?» del Chat.
- **Coach** (sheet ✨ del FuelGauge): sugiere «100 g crema de arroz» pre-entreno, que **no
  está en la dieta Regenera**. **Raíz**: `coachPrompt` pide «las comidas del plan que le
  quedan» pero **nunca recibe el plan** — el route (`api/ai/coach/route.ts:38`) ya carga
  `plan` pero solo usa `plan.targets`, ignorando `plan.optionsByMeal`. El Coach inventa
  comida con pinta de dieta.

Además, tras leer la sugerencia del Coach, Alex quiere **poder seguir/ajustar sobre ese
mismo contexto** («no tengo pavo, dame otra») sin repetir la pregunta.

## Alcance
**Fase 0 · Fecha en el prompt (quick-fix).**
- `chatSystemPrompt` empieza con una línea `HOY es {AAAA-MM-DD} ({día de la semana})`,
  interpolada desde `dayKey()` (Europe/Madrid, `lib/dates`) — nunca `toISOString().slice`.
- `coachPrompt` declara la fecha objetivo explícita por paridad (modo hoy = hoy; modo ayer =
  la fecha evaluada).
- `prepareVisitPrompt` (F-IA-7): misma línea de fecha por paridad (una línea, coste nulo).
- Sincronizar las plantillas modificadas a `04-IA.md`.

**Fase 1 · El Coach conoce el plan (quick-fix).**
- Pasar a `coachPrompt` un resumen de las opciones del plan de las comidas **que aún le
  quedan al día** (a partir de `plan.optionsByMeal`, ya cargado en el route; reutilizar
  `planOptionsList`/`planSummary` de `server/ai/context.ts`).
- El prompt prioriza esas opciones reales; si excepcionalmente sugiere algo fuera de la
  pauta, debe marcarlo explícito («fuera de tu pauta»). Por defecto: lo más limpio **dentro**
  de la dieta.
- Sincronizar a `04-IA.md`.

**Fase 2 · Puente Coach → Chat (A1).**
- Botón secundario **«Seguir en el chat →»** en el footer del sheet del Coach (junto a
  «Copiar»).
- Al tocarlo: se crea un hilo nuevo **sembrado** con (a) un mensaje de usuario
  `¿Cómo voy hoy?` (o `Analizar ayer` en modo ayer) y (b) el texto que el Coach acaba de
  mostrar como mensaje del **asistente**; se navega al Chat con ese hilo abierto y el input
  enfocado.
- El siguiente turno usa el contexto fresco normal del Chat (ya con fecha y plan correctos
  tras Fases 0-1). No hay llamada IA propia del puente: solo siembra mensajes.

## NO-alcance
- **No** convertir el sheet del Coach en un chat (rompería 09 §6: el Chat ya es el destino
  conversacional; «una manera primaria + atajos»). El Coach sigue siendo one-shot de 10 s.
- **No** arreglar el botón «Copiar» que no funciona → bug aparte, se reproduce por separado
  (anotado en HANDOFF §B3).
- **No** tocar chips `SUGGESTED`, temperatura (0.3), modelo ni el resumen del Chat.
- **No** hay migración ni schema nuevo.

## Momento de uso (09 §1)
«¿Cómo voy hoy / qué me queda?» (1-2×/día, 10 s) en el Coach → si quiere profundizar, el
puente lo lleva a «revisar / preguntarle a tus datos» en el Chat (sin límite de tiempo).
Conecta dos momentos de uso existentes sin duplicar caminos.

## Datos
Sin schema nuevo, sin migración. Reutiliza `createThread` / `addChatMessage`. Los mensajes
sembrados son mensajes de chat como cualquier otro (sin impacto adicional en export/restore
ni en `migrate:poc`).

## Flujo (09)
- Coach: sheet de Hoy (09 §3). Se le añade un 2º botón **de salida** (no una decisión de
  creación) → no rompe «una decisión por pantalla del sheet» (09 §6).
- Chat: pestaña (09 §2). Abre el hilo pre-sembrado con el input enfocado.
- Detalle de implementación (Etapa 4): crear hilo + sembrar 2 mensajes y navegar a
  `/chat` con ese `threadId` abierto; el `ChatClient` ya sabe abrir un hilo por id.

## IA
No hay prompt **nuevo**. Se modifican plantillas congeladas (F-IA-6, F-IA-8, y F-IA-7 por
paridad) solo por **interpolación de fecha** (Fase 0) y por **añadir al Coach el bloque de
opciones del plan que su propio prompt ya pedía** (Fase 1). Ambos cambios se congelan en
esta spec y se sincronizan a `04-IA.md`; se re-validan los AC de F-IA-6/F-IA-8. El test de
consistencia del café ×3 **no aplica** (no es feature de estimación). Coste: marginal (unas
líneas más de contexto en el Coach); el puente no añade llamadas IA.

## Impacto en Coach/Chat/Visita
Coach y Chat pasan a conocer la fecha real; el Coach pasa a conocer el plan. Preparar-visita
recibe la misma línea de fecha por paridad. Ninguna otra feature cambia de comportamiento.

## AC
1. En el Chat, «¿cómo voy hoy?» un 13-jul responde sobre el **13-jul** y **nunca** menciona
   una fecha distinta de hoy ni días futuros inexistentes. 🖐
2. El system prompt del Chat contiene la línea `HOY es {hoy}` (test del builder).
3. El Coach, con comidas del plan pendientes, sugiere **solo** opciones de la dieta vigente;
   no inventa alimentos fuera de plan (o los marca explícitamente como fuera de pauta). 🖐
4. El prompt del Coach incluye el resumen de opciones del plan pendientes (test del builder).
5. El sheet del Coach muestra «Seguir en el chat →»; al tocarlo se abre el Chat con un hilo
   nuevo cuyo primer mensaje de asistente es **exactamente** el texto del Coach que se veía,
   precedido del mensaje de usuario `¿Cómo voy hoy?` (o `Analizar ayer`). 🖐
6. En ese hilo, escribir «no tengo pavo, dame otra» produce una respuesta coherente con el
   día (fecha y plan correctos). 🖐
7. Las plantillas modificadas están sincronizadas en `04-IA.md`; los AC previos de
   F-IA-6/F-IA-8 siguen pasando.
8. `pnpm typecheck && pnpm test` en verde; deploy verificado.

## Riesgos / decisiones discutibles
1. **A1 guarda un texto del prompt del Coach como mensaje de «asistente» del Chat** (distinto
   prompt/temp por debajo). Es cosmético: solo display + continuidad; el razonamiento
   posterior lo hace el Chat con su contexto. → **Aceptado por Alex.**
2. **Se tocan prompts congelados.** Mitigado: Fase 0 es pura interpolación; Fase 1 añade un
   bloque de datos que el prompt **ya pedía**. Re-validar AC + sync a `04-IA.md` obligatorio.
3. **2º botón en el sheet del Coach**: es una salida secundaria (peso visual menor que
   «Copiar»), no una decisión de creación → no ensucia el momento de 10 s (09 §6).

## Fases
- **Fase 0** (fecha) y **Fase 1** (plan) son los bugs: van primero, son desplegables solas y
  devuelven la fiabilidad del Coach/Chat aunque no se haga el puente.
- **Fase 2** (puente A1) después.
