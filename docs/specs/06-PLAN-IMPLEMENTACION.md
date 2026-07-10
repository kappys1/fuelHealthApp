# 06 · Plan de implementación (para Claude Code / Opus 4.8)

Reglas de trabajo: una fase por sesión (o menos); cada fase acaba con sus tests de aceptación en verde y deploy a Vercel funcionando; commits pequeños; `pnpm typecheck && pnpm test` antes de cada commit; decisiones no cubiertas por las specs → lo más simple + nota en `docs/DECISIONS.md`. Generar `CLAUDE.md` en la primera sesión con: stack, comandos, convenciones y los 8 Principios del PRD §3 íntegros.

## Fase 0 · Esqueleto (½ día)

Next.js 16 (Turbopack por defecto, Node ≥20) + TS estricto + Tailwind 4 + shadcn/ui tematizado con los tokens de 05-DISENO (claro/oscuro + toggle) · Drizzle + Neon con el schema completo de 03-DATOS §1 y seed del plan Regenera (§5) · Auth usuario único (login password, sesión cookie, middleware) · Layout con nav inferior de 4 pestañas (Hoy · Plan · Progreso · Chat, 09-FLUJOS-UX §2) + Ajustes en header, con placeholders · Deploy Vercel.

**AC**: login funciona; sin sesión todo redirige a /login; los dos temas renderizan; seed carga las ~34 opciones del plan con sus 4 macros.

## Fase 1 · Núcleo de registro (1-2 días)

Estructura y flujos según `09-FLUJOS-UX.md` (manda sobre el PRD): Hoy §3, sheet único de añadir §4 (capas de IA como accesos deshabilitados hasta Fase 2), check-ins guiados §5 con defaults inteligentes, flujos exprés §5b sin IA. Pantalla **Hoy** completa sin IA: FuelGauge (kcal + proteína + mini-barras C/F + línea «Faltan…» + comportamiento por fase) · tarjeta Día (peso, agua, %grasa, sesión, fase, hinchazón, notas, línea «Del reloj») · Comidas registradas (agrupadas, edición en línea, borrar, favoritos ★) · Añadir del plan (grupos, gramos con reescalado en vivo) · QuickAdd (copiar ayer, plantillas guardar/aplicar/borrar, chips favoritos) · Entrada manual (4 macros, sin IA aún) · selector de fecha (Europe/Madrid) · Pantalla **Plan**: objetivos editables (versionando `diet_versions`), derivados del plan con botón, CRUD de opciones (sin IA aún).

**Script de migración del JSON del PoC** (03-DATOS §6) y ejecutarlo con el export real de Alex.

**AC**: registrar un día típico desde plan+favoritos en <90 s; los totales cuadran con los del PoC para los mismos datos; migración idempotente sin pérdidas (contar registros antes/después); tests unitarios de escalado por gramos y derivados del plan.

## Fase 2 · IA (1-2 días)

Infra `server/ai/` (cliente, prompts EXACTOS de 04-IA, schemas Zod, reintento de parseo, errores visibles) · F-IA-2 estimar texto · F-IA-3 opción de plan · F-IA-4 volcado del día · F-IA-1 **foto completa** (pipeline imagen + HEIC sharp fallback + aclaraciones + desglose con gramos editables anclados a `_base` + reanalizar + añadir junto/separado + **subida a Blob al añadir** + miniaturas en MealRow) · F-IA-5 analizar WOD.

**AC**: «200 ml café con leche desnatada» estima consistente en 3 llamadas seguidas (temp 0); foto de plato compuesto devuelve ≥3 items con gramos; editar gramos recalcula sin llamada a red; reanalizar con «es jamón serrano» cambia el item; descartar análisis no crea blob; error de API se muestra con status.

## Fase 3 · Salud + Tendencia (1 día)

Parser CSV HAE español con fixtures reales (kJ→kcal, mL→L, colisión «peso/paso») · endpoint `/api/health/ingest` con token (probar con una Automation real de HAE) · precedencia importado>manual · tabla Últimos días · export JSON completo + import/restore · **Analítica**: ma7 con exclusión de fases especiales (+2 días post-competición), déficit/TDEE, adherencia 14d — todo en `server/analytics` con tests sobre los números de referencia de 03-DATOS §4.2 · pestaña **Progreso** segmento Tendencia (TrendCard invertida, adherencia, 2 gráficos, tabla Últimos días) y operaciones en **Ajustes** (import, estado sync, export/restore).

**AC**: importar el CSV real de Alex da 31 filas / 10 métricas / aviso kJ; con sus pesos reales la tendencia reproduce ~los valores del PoC; días de Carga no cuentan en ingesta media ni adherencia.

## Fase 4 · MED + Coach + Chat + PWA (1-2 días)

Segmento MED en Progreso (CRUD, difs con signo correcto y colores, gráfico doble eje, entrada retroactiva cómoda para el histórico 2025-2026) · F-IA-6 coach (ayer/hoy) · F-IA-7 preparar visita · **F-IA-8 chat sobre tus datos** (hilos, streaming SSE, chips sugeridas, guardarraíles) · **F-IA-9 importar dieta desde foto/PDF** (vista previa editable → nueva versión) · **popovers "cómo se calcula"** en toda métrica derivada + selector de rango en Tendencia · PWA: manifest, Serwist, instalable iOS, cola offline de entradas (IndexedDB + replay), botones IA deshabilitados offline.

**AC**: instalable en el iPhone de Alex con cámara nativa funcionando en el análisis de foto (¡la razón de ser de esta app: la IA por fin funciona en el móvil!); modo avión → registrar comida → volver online → sincroniza; preparar visita genera preguntas que citan datos reales; el chat responde «¿cuánto pesaba hace dos semanas?» con el dato real y rechaza prescribir dieta; la foto de la pauta Regenera reconstruye el plan completo en vista previa.

## Fase 5 · Pulido y validación (continuo)

Revisión de diseño contra 05-DISENO pantalla a pantalla (¿parece shadcn de fábrica? → retematizar) · rendimiento (LCP <2 s en móvil) · Playwright de los 3 flujos críticos (registrar día, foto completa, import CSV) · uso real hasta la MED de agosto: la validación final es comparar la predicción de Tendencia con los pliegues del nutricionista.

## Backlog v1.1 (NO hacer en v1)

Base de datos de alimentos (OpenFoodFacts/BEDCA) para recurrentes con IA de fallback · sodio y fibra estructurados + correlaciones de hinchazón automáticas · workouts por sesión → modelo de coste por tipo de día · import del XML nativo de Salud · passkeys · recordatorio de pesaje (notificación local PWA).
