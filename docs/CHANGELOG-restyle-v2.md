# CHANGELOG — Restyle v2 (rama `restyle-v2`)

Rebrand visual completo sobre la v1, en la rama `restyle-v2` (nunca en `main`). Norte estético:
`docs/mockups/fuelboard-redesign-concept-v2.html`. Regla madre = **jerarquía de verdad**
(comportamiento/flujos = código + `09-FLUJOS-UX`; datos reales siempre; estética = mockup;
desviaciones conscientes en `docs/RESTYLE-NOTES.md`). Decisiones: `DECISIONS.md` #71/#72.

**Cero cambios de comportamiento**: rutas, sheets, check-ins y navegación intactos. Migraciones
solo aditivas y compatibles con `main` en la misma Neon (de hecho: cero migraciones de schema;
el coach on-demand cachea en `settings`).

---

## F0 · Tokens + tipografía + gate AA — ✅ desplegado
Paleta azul «Blueprint» de ambos temas portada 1:1 del mockup a `globals.css` + `contrast.ts`
(gate) + `layout.tsx` (fuentes + themeColor) + `manifest.ts`. Tipografía **Onest** (cuerpo) +
**Plus Jakarta Sans** (display/cifras) sustituyen Barlow/Instrument. Radios (cards 18px) y sombras
como tokens. `05-DISENO §2/§3` reescrito (rebrand consciente). **Gate AA verde en ambos temas SIN
un solo ajuste** (`pnpm audit:contrast`).

## F1 · Hoy completo — ✅ verificado (harness, ambos temas)
- **FuelGauge de anillo**: 3 anillos SVG (kcal grande con **puntos de comida sobre el arco** +
  proteína + hidratos) + rail de grasa + línea de estado. Fase especial = anillo azul-info.
  Veredicto sigue en `gaugeVerdict` (fuente única UI↔coach).
- **Coach on-demand** (#71): tarjeta con el último análisis cacheado + antigüedad + «Actualizar»;
  sin caché → «Analizar mi día». **Cero IA al abrir Hoy.** Caché en `settings.coachCache`
  (sin migración). Prompt F-IA-6 intocado.
- **Baseline personal ▾**: HRV / FC reposo / sueño / pasos con delta vs media 30 d
  (`server/analytics/healthBaseline`, puro + tests). Huecos: «sin dato hoy» / «necesito más días».
- **Entrenamiento** (línea, gasto ±25%) y **Contexto del reloj ▾** (balance ingesta−gasto).
- Composición **Intermedia** (estado → gauge → coach → comidas → entreno → baseline ▾ → reloj ▾ →
  Mi día), aprobada por Alex.

## F2 · Progreso — ✅ verificado (harness, ambos temas)
- **Héroe de déficit** de jerarquía máxima (cifra kcal/día a 52px, «esta cifra manda»).
- **Ingesta apilada por contribución calórica** (P×4/C×4/F×9, `caloricContribution` puro + test;
  días especiales atenuados, línea de objetivo, leyenda).
- Sombras en todas las tarjetas.

## F3 · Plan · Chat · MED · Historial · Ajustes — 🟡 pasada de restyle
Heredan paleta/tipografía/radios de F0; se añadió la sombra de tarjeta. **No** rediseño profundo
pantalla-a-pantalla (ver RESTYLE-NOTES F3): on-brand y coherente, pulido fino diferible.

## F4 · Cierre — 🟡 parcial
Build de producción verde (fuentes + SW), `typecheck` + **204 tests** verdes, harness temporal
retirado, docs al día. **Pendiente**: `pnpm test:e2e` contra la rama de test de Neon, Lighthouse
móvil, regeneración de iconos PWA. (Ver RESTYLE-NOTES F4.)

---

**AC de flujo 🖐 a validar por Alex con el pulgar en la preview** (no auto-aprobados):
favoritos ≤3 toques, check-in matinal ≤15 s, **Hoy ~2 pantallas** (Intermedio), y el look general
en su iPhone en ambos temas.
