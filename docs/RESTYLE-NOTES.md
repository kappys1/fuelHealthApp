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
