# RESTYLE-NOTES — Restyle v2 (rama `restyle-v2`)

Registro de **desviaciones conscientes** del mockup (`docs/mockups/fuelboard-redesign-concept-v2.html`)
durante el restyle. Alex las revisa **por lotes al cierre de cada fase**.

**Jerarquía de verdad** (regla central del restyle):
1. **Comportamiento y flujos** = código actual + `09-FLUJOS-UX.md`. CERO cambios de
   rutas, sheets, check-ins o navegación.
2. **Datos** = reales siempre. Nada simulado ni inventado. Toda métrica derivada nueva =
   función pura en `server/analytics/` con tests ANTES del componente, citando su fuente.
3. **Estética / tokens / layout / componentes** = el mockup como norte.
4. El mockup usa datos de ejemplo y **no es contrato pixel-perfect**: donde sea irreal,
   incompleto o quede peor con datos reales, hay licencia para mejorarlo **manteniendo su
   sistema de diseño** — y **cada desviación se anota aquí** (qué · por qué · captura si aplica).

Mejorar sí; derivar en silencio, no.

---

## F0 — Tokens, tipografía, radios/sombras, gate AA

### Sin desviaciones de paleta
La paleta azul completa del mockup (ambos temas) **pasa el gate de contraste AA sin un solo
ajuste** (`pnpm audit:contrast` verde: todos los pares de texto ≥4.5:1, rellenos ≥3:1). Es
estrictamente más accesible que la identidad verde anterior. Los hex se portaron 1:1.

### Desviaciones conscientes

| # | Qué | Por qué |
|---|---|---|
| F0-1 | **`--phase` se mantiene como tinte sutil (azul-info), NO como el morado sólido `#6747c7` del mockup.** El morado del mockup se conserva en `--special` y `--med-accent`. | `--phase` tiene un único consumidor hoy: el fondo del FuelGauge en fase especial (`fuel-gauge.tsx`). Debe ser un `background` sutil, y el principio de producto + F1 exigen «Carga azul-info que nunca regaña». Un morado sólido rompería el gauge y contradiría la doctrina. El morado sigue disponible como token para acentos (MED, chips de fase) en fases posteriores. |
| F0-2 | **`--line` (borde por defecto → `--border` de shadcn) mapea al `--line-soft` del mockup (`#dbe2e9`/`#303b49`).** El borde fuerte del mockup (`#728397`/`#748397`) se expone como `--line-strong`. | En la app `--line` es el borde omnipresente de tarjetas; el sutil del mockup es el que borda tarjetas. El fuerte se reserva para contornos de controles (icon-buttons, steppers) que lo pidan en fases siguientes. |
| F0-3 | **`--font-condensed` se conserva como alias de `--font-display` (Plus Jakarta Sans).** El nuevo sistema no tiene una fuente condensada dedicada (el mockup usa Plus Jakarta para cifras). | Varios componentes referencian `var(--font-condensed)` por estilo inline (gauge XL, login, tendencia). Mantener la variable evita tocar componentes en F0 (fase de solo-tokens) y ya resuelve a la tipografía correcta. |
| F0-4 | **Iconos PWA (`scripts/gen-icons.mjs` + PNGs de `public/icons/`) siguen con la paleta anterior; su regeneración se difiere al pulido de F4.** | Los iconos son binarios generados y su azul (`#3B82F6`) es cercano al nuevo `--primary`. Regenerarlos ahora no aporta a la validación de tokens/tema en pantalla (el foco de F0) y encaja mejor en el pulido final de marca (F4). `manifest.ts` (theme/background color) SÍ se actualizó a `#0e1319`. |

---

## F1 — Hoy (composición, entrenamiento, baseline, coach on-demand)

### Composición de Hoy: **Intermedio** (aprobada por Alex, 2026-07-19)
De arriba abajo: Header → **Tu estado hoy** (banner) → **FuelGauge de anillo** → **Coach** (tarjeta
compacta on-demand) → **Comidas** → **Entrenamiento** (línea) → **Baseline personal ▾** (plegado) →
**Contexto del reloj ▾** (plegado) → **Mi día** colapsada → botón fijo **+ Añadir comida**. Objetivo
~2 pantallas.

### Desviaciones conscientes

| # | Qué | Por qué |
|---|---|---|
| F1-1 | **Se conserva la navegación de la app (Hoy · Plan · Progreso · Chat + Ajustes), NO la del mockup (Hoy · Plan · Añadir · Progreso · Coach).** | La navegación es comportamiento (regla dura: cero cambios de nav). El «Coach» del mockup se reubica como tarjeta on-demand en Hoy (#71); «Añadir» sigue siendo el botón fijo `+`. |
| F1-2 | **Hoy incorpora secciones nuevas (Entrenamiento, Baseline personal, Contexto del reloj, tarjeta Coach) que 09 §3 («y NADA más») y §6 («nunca otra tarjeta permanente a Hoy») no contemplaban.** Evolución consciente de la composición de Hoy por el mockup + brief de F1. | El comportamiento (rutas, sheets, check-ins, nav) queda intacto; solo cambia la composición visual, que es el terreno del mockup (jerarquía §3). Baseline y Contexto van **plegados** para no inflar la pantalla. |
| F1-3 | **AC 09 §7 «Hoy cabe en ~1,5 pantallas»: con la composición Intermedia el día completo ocupa ~2 pantallas** (Baseline/Contexto plegados ayudan). | El mockup (norte) es más rico que la v1; se prioriza el norte manteniendo lo secundario plegado. AC 🖐 a validar por Alex con el pulgar en la preview. |
| F1-4 | **Coach on-demand cacheado en `settings` (key `coachCache`, jsonb) por `fecha+modo`, SIN migración de schema.** Cero llamada IA al abrir Hoy; la tarjeta muestra el último análisis + antigüedad + «Actualizar»; sin caché → CTA «Analizar mi día». | Lo más simple y aditivo (patrón `getSetting/setSetting` ya existente); no toca el prompt de F-IA-6 (intocado). Compatible con el código de `main` en la misma Neon (una key nueva en `settings`). |
| F1-5 | **Baseline personal = 4 KPIs del mockup (HRV, FC reposo, sueño, pasos) con delta vs media 30 d** vía `server/analytics/healthBaseline` (puro, testeado). Métrica sin dato hoy → «—»; ventana con <5 días → sin delta («necesito más días»). | «Cero métricas inventadas»: todo sale de `health_metrics` (HAE). El mockup pinta series perfectas; los datos reales tienen huecos y se resuelven con estados explícitos. |
