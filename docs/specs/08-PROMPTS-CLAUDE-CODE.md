# 08 · Prompts para Claude Code (copiar y pegar) — v2, alineado con 09-FLUJOS-UX

Uno por sesión. No juntes fases. Entre prompt y prompt: revisa tú el resultado, pruébalo con el pulgar (los criterios de `09` §7 se validan cronómetro en mano), y commitea solo lo que funcione.

---

## Sesión 0 · Arranque (antes de escribir código)

> Lee TODOS los documentos de `docs/specs/` (00 a 09) de principio a fin. Ten en cuenta la jerarquía: `09-FLUJOS-UX.md` manda sobre la organización de pantallas implícita en el PRD (los requisitos F1-F8 del PRD siguen todos vigentes; el 09 define cómo se organizan y se usan). Después:
> 1. Genera un `CLAUDE.md` en la raíz con: stack y comandos, convenciones del repo, los 8 "Principios de producto" del `01-PRD.md` §3 ÍNTEGROS, y la regla de jerarquía 09>PRD en estructura.
> 2. Crea `docs/DECISIONS.md` vacío con formato fecha·decisión·motivo.
> 3. Dame un resumen de 10 líneas y dime si ves contradicciones entre documentos ANTES de tocar nada.
>
> Reglas permanentes: los prompts de IA de `04-IA.md` están probados y se usan TAL CUAL (solo interpolando variables). La capa de IA es agnóstica de proveedor vía Vercel AI SDK según `02-ARQUITECTURA.md`. Trabajamos fase a fase según `06-PLAN-IMPLEMENTACION.md`; nunca adelantes fases. Ante ambigüedad: lo más simple + nota en DECISIONS.md. `pnpm typecheck && pnpm test` en verde antes de cada commit.

## Fase 0 · Esqueleto

> Ejecuta la Fase 0 de `06-PLAN-IMPLEMENTACION.md` completa y nada más, con una corrección sobre el doc: la navegación es la de `09-FLUJOS-UX.md` §2 — **4 pestañas (Hoy · Plan · Progreso · Chat) + icono de Ajustes en el header** (no 5 pestañas). Proyecto Next.js 16 (create-next-app@latest, TS estricto, Turbopack por defecto), Tailwind 4 + shadcn/ui tematizado EXACTAMENTE con los tokens de `05-DISENO.md` §2 (ambos temas + toggle + auto; verifica programáticamente contraste AA ≥4.5:1 de cada par texto/fondo en AMBOS temas), Drizzle + Neon con el schema completo de `03-DATOS.md` §1, seed del plan Regenera de §5 (verifica: ~34 opciones con 4 macros cada una), auth de usuario único según `02-ARQUITECTURA.md`, placeholders en las 4 pestañas y Ajustes, y deploy a Vercel. Termina verificando los criterios de aceptación de la fase uno a uno.

*(Si la Fase 0 ya está hecha con 5 pestañas: «He añadido `09-FLUJOS-UX.md`, que sustituye la organización de pantallas del PRD. Aplica el cambio estructural: 4 pestañas (Hoy · Plan · Progreso · Chat) + Ajustes en el header, moviendo los placeholders. Verifica también los contrastes AA de ambos temas contra `05-DISENO.md` §2 y corrige los pares que fallen.»)*

## Fase 1 · Núcleo de registro

> Ejecuta la Fase 1 de `06-PLAN-IMPLEMENTACION.md`: pantalla Hoy completa SIN IA y pantalla Plan. La estructura y los flujos son los de `09-FLUJOS-UX.md`, que manda sobre el PRD: Hoy según §3 (FuelGauge → línea de estado → timeline de comidas con "+" por sección → tarjeta "Mi día" colapsada), el **sheet único de añadir** de §4 con sus capas de búsqueda universal, favoritos y "Del plan" (las capas de Foto y Describir-IA déjalas como accesos deshabilitados con "Fase 2"), los **check-ins guiados** de §5 (matinal y cierre del día) con todos los defaults inteligentes (sesión por día de semana configurable en Ajustes, peso precargado, chips de agua, comida por hora, secuencia de fases), y los flujos exprés de §5b que no dependan de IA. Los requisitos de detalle siguen siendo `01-PRD.md` F1, F2 (todo salvo IA) y F3, con los comportamientos de `07-REFINAMIENTOS-PRO.md` §1-§2 (autosave, UI optimista, undo en toast, steppers). El FuelGauge según `05-DISENO.md` §1 y §5 — es el elemento firma, dedícale cariño. Escribe primero los tests unitarios de `server/analytics/planDerived` y del escalado por gramos, luego la UI. Incluye el script de migración de `03-DATOS.md` §6; te pasaré mi `fuelboard-export-*.json` — debe ser idempotente y darme un resumen de conteos. Al terminar, verifica los criterios de la Fase 1 en `06` Y los de `09` §7 que apliquen sin IA (favoritos ≤3 toques, check-in ≤15 s, Hoy en ~1,5 pantallas).

*(Cuando te pida el JSON: «Ejecuta la migración con este archivo, enséñame el resumen de conteos, y verifica que los totales de 3 días al azar cuadran con el JSON original.»)*

## Fase 2 · IA

> Ejecuta la Fase 2: infraestructura de IA agnóstica de proveedor según `02-ARQUITECTURA.md` (Vercel AI SDK, adaptador por `AI_PROVIDER`, modelos por env var) y las features F-IA-1 a F-IA-5 de `04-IA.md`. Los prompts van LITERALES del documento, `temperature: 0`, validación Zod con 1 reintento de parseo, errores SIEMPRE visibles con mensaje del proveedor + HTTP status. Las features viven DENTRO del sheet de añadir según `09` §4: rellena las capas "Foto" (con aclaraciones, desglose con gramos editables anclados a `_base` que no se desmontan al vaciarlos, recálculo proporcional sin red, reanálisis con la misma imagen, Blob solo al añadir) y "Describir (IA)" (que acepta una comida o el día entero), conecta el fallback de la búsqueda universal a F-IA-2, y añade F-IA-3 en Plan y F-IA-5 en la sesión de "Mi día". Al terminar, verifica los AC de la Fase 2 en `06`.

## Fase 3 · Salud + Progreso

> Ejecuta la Fase 3 con la organización del doc `09` §2: la analítica y datos van en la pestaña **Progreso** (segmento Tendencia, con la tabla "Últimos días" al final) y las operaciones en **Ajustes** (import CSV, estado del endpoint con "última sync hace X", export/restore). Parser CSV de Health Auto Export según la tabla EXACTA de `03-DATOS.md` §4.2 (español, kJ→kcal, mL→L, colisión peso/paso) con tests sobre fixtures — te pasaré un CSV real. Endpoint `/api/health/ingest` con Bearer token. Analítica completa en `server/analytics/` con las fórmulas EXACTAS de §3 (ma7 excluyendo fases especiales +2 días post-competición, déficit, TDEE, adherencia solo días Normal) y tests con los valores de referencia de §4.2. TrendCard invertida como única tarjeta de máxima jerarquía, popovers "cómo se calcula" (F6.6) y selector de rango. Import con vista previa antes de aplicar (`07` §4).

## Fase 4 · MED + Coach + Chat + PWA

> Ejecuta la Fase 4: segmento **MED** dentro de Progreso (CRUD, difs con signo matemático correcto — siempre actual−anterior, el Excel del nutricionista los trae volteados —, gráfico doble eje, entrada retroactiva cómoda, y "Preparar visita" F-IA-7 ahí). Coach F-IA-6 tras el icono ✨ del FuelGauge, en sheet. Pestaña **Chat** completa (F-IA-8: hilos persistentes, streaming SSE, chips sugeridas, guardarraíles de no-prescripción). F-IA-9 importar dieta desde foto/PDF destacado en Plan, con vista previa editable → nueva versión. PWA completa: manifest con shortcuts ("Añadir comida" → sheet, "Peso de hoy" → check-in), Serwist, instalable iOS, cola offline de entradas con replay, share target hacia la capa de foto, botones IA deshabilitados offline con motivo. Modo competición de `07` §4 cuando fase = Competición. Probaré la instalación en mi iPhone: la cámara en el análisis de foto es EL criterio de aceptación de esta app.

## Fase 5 · Pulido

> Auditoría final en tres pasadas, dándome la lista de desviaciones ANTES de corregir: (1) diseño pantalla a pantalla contra `05-DISENO.md` y el checklist de `07` §6 — ninguna pantalla puede "parecer la demo de shadcn"; (2) flujos cronometrables contra `09` §7 completos; (3) calidad: Playwright de los 4 flujos críticos (registrar un día completo, foto de principio a fin, check-in matinal, import CSV), Lighthouse móvil con objetivo LCP <2 s, cero layout shift.

---

## Prompts de mantenimiento

**Bug**: «Bug en [pantalla]: [qué hice] → [qué pasó] → [qué esperaba]. Reprodúcelo primero (test si es lógica), explícame la causa en 2 líneas, y luego arréglalo sin tocar nada más.»

**Desviación de spec**: «Esto contradice `[doc] §[sección]`, que dice: "[cita]". Ajústalo a la spec; si crees que la spec está mal, argumenta primero y lo decidimos antes de cambiar código.»

**Revisión de fase**: «Antes de dar la Fase N por cerrada: repasa sus criterios de aceptación en `06` (y `09` §7 si toca UI) uno a uno y dime cuáles pasan, cuáles no, y qué falta.»

**Cambio de proveedor de IA**: «Cambia `AI_PROVIDER` y los `AI_MODEL_*` a [proveedor/modelos]. No toques los prompts. Después ejecuta los AC de la Fase 2 completos: la calidad del análisis de foto y la disciplina JSON varían entre modelos y hay que revalidarlos, no asumirlos.»

**Cambio de dieta (uso real)**: en la app → Plan → Importar dieta con la foto de la pauta nueva. Sin tocar código.
