# RESTYLE v2 — Plan de lo que queda

Rama: **`restyle-v2`** (nunca `main`). Norte estético: `docs/mockups/fuelboard-redesign-concept-v2.html`.
Este documento es el plan vivo del trabajo **pendiente**. Lo hecho se resume abajo (§Estado);
las desviaciones conscientes se registran en `docs/RESTYLE-NOTES.md`; las decisiones en
`docs/DECISIONS.md` (#71/#72).

---

## 0. Reglas madre (no negociables)

1. **Jerarquía de verdad**: (1) comportamiento/flujos = código actual + `09-FLUJOS-UX.md`
   → **cero cambios de rutas, sheets, check-ins, navegación**; (2) **datos reales siempre**
   (nada simulado); (3) estética/tokens/layout = **el mockup**; (4) donde el mockup sea irreal
   o quede peor con datos reales, mejorar **manteniendo su sistema de diseño** y anotar en
   `RESTYLE-NOTES.md`.
2. **Cero métricas inventadas**: todo dato derivado nuevo = función pura en `server/analytics/`
   con tests ANTES del componente, citando su fuente. Si algo no se puede derivar de datos
   reales → **PARAR y avisar**.
3. **Migraciones**: solo aditivas y compatibles con `main` en la misma Neon. Hasta hoy: **cero
   migraciones de schema** (el coach on-demand cachea en `settings`). Avisar antes de crear
   ninguna.
4. **Prompts de IA intocados** (`server/ai/prompts.ts`).
5. **Verde antes de commitear**: `pnpm typecheck && pnpm test && pnpm lint`. `build` si se toca
   config/SW/fuentes.
6. **Coste = por API (pay-as-you-go)** → optimizar tokens (ver §Método y §Coste).

---

## 1. Método por superficie (repetir SIEMPRE)

Cada pantalla o flow se hace igual, para no volver a «inventar» estructura:

1. **Inspeccionar el mockup en vivo** (Live Server del usuario o `python3 -m http.server`
   sobre `docs/mockups/`): navegar la pantalla/flow real.
2. **Volcar la estructura real** con el navegador (DOM: clases, textos, `data-open-flow`) —
   NO reconstruir de memoria ni de capturas.
3. **Replicar** con el sistema de diseño (tokens F0, `flow-sheet`, `section-head`), preservando
   props y comportamiento del componente actual.
4. **Verificar renderizado de verdad** en un harness `/dev-gauge` temporal (whitelist en
   `proxy.ts`, se retira siempre al cerrar) en **ambos temas**. Para pantallas con datos, harness
   con fixtures o, si hace falta ver datos reales, pedir a Alex que entre a la preview.
5. **Anotar desviaciones** conscientes en `RESTYLE-NOTES.md`.
6. **Commit pequeño** con gates verdes.

**Ahorro de tokens (coste API):** verificar por **volcado de DOM** (texto, barato) salvo en las
pantallas firma; **capturas solo** donde el layout es el riesgo; **subagentes** para restyles
mecánicos (su contexto no cuenta contra el hilo principal); **no releer** ficheros grandes
enteros si basta un rango.

---

## 2. Estado (hecho) — para no repetir

- **F0 · Tokens/tipografía/gate AA** ✅ — paleta azul «Blueprint» ambos temas, Onest + Plus
  Jakarta Sans, radios 18px, sombras, `05-DISENO §2/§3` reescrito. Gate AA verde sin ajustes.
- **F1 · Hoy** ✅ (verificado en harness, ambos temas):
  - **Topbar compartido** (`AppTopbar`): badge «F» + eyebrow + en Hoy **navegación de día con
    calendario** (`HeaderDatePicker`) + racha 🔥 + toggle de tema + avatar.
  - **coach-welcome** arriba (saludo + última lectura cacheada + antigüedad + refrescar).
  - **FuelGauge de anillo** (kcal + proteína + hidratos, puntos de comida sobre el arco, rail
    de grasa, fase azul-info).
  - **Comidas** = section-head + meal-list **colapsable** (icono estado + nº + kcal + chevron).
  - **Hinchazón del día + Agua** inline (pills + chips + icono sliders → Mi día).
  - **Entrenamiento / Baseline personal / Contexto del reloj** con patrón **section-head**.
  - **Mi día = sheet `day-context`** (peso/%grasa/agua/fase/sesión/notas + WOD + flow-list de
    accesos: check-in matinal / peso exprés / cierre).
  - **Añadir comida**: **FAB flotante +** · add-sheet capa 1 (pills de destino + búsqueda +
    Fijados lista + «Otra forma»: Foto/Del plan/Describir/Manual) · sub-capas con título+subtítulo
    · nueva capa **Entrada manual**.
  - Backend F1: `healthBaseline` (media 30 d + delta, tests) + coach on-demand cacheado en
    `settings` (sin migración).
- **F2 · Progreso** 🟡 parcial — hecho: héroe de déficit (jerarquía máxima) + **ingesta apilada
  por contribución calórica** (`caloricContribution` puro + test) + sombras. **Falta lo de §3.**
- **F3** 🟡 solo palette+sombra (sin rediseño real). **Ver §4.**

---

## 3. F2 · Progreso a fondo (pendiente)

Inspeccionar el Progreso del mockup (héroe + KPIs + Resumen + gráficos + MED + marcas) y clavar:

- [ ] **Topbar/H1** de Progreso: «Lo que está cambiando» (el topbar ya existe; falta el H1 de
      pantalla si el mockup lo lleva).
- [ ] **Héroe «Métrica principal · Déficit real»** con **weigh-in rail** (puntos de pesajes,
      ej. 5/8) — el rail es dato real (nº de pesajes válidos en la ventana).
- [ ] **Resumen** con toggle **Semana | 30 días** + KPIs (adherencia %, peso actual, ingesta
      media, proteína media, pasos…). Toda cifra derivada = función pura + test.
- [ ] **Peso + ma7** con **marcadores de MED** (fechas de mediciones) y **huecos** bien resueltos
      (días sin pesaje no se interpolan de forma engañosa).
- [ ] **Ingesta apilada** (ya hecha) — revisar contra el mockup (leyenda, días especiales
      atenuados, línea de objetivo).
- [ ] **Última MED** con deltas (ya existe `medDeltas`) al tratamiento del mockup.
- [ ] **Marcas recientes** (row/push/dead…) al tratamiento del mockup.
- [ ] Segmentos **Tendencia | MED | Historial** al estilo del mockup.

**Nuevas métricas a verificar como puras + tests antes del componente:** media/percentil de
KPIs por ventana (Semana|30 d), nº de pesajes válidos para el rail, mapping de fechas MED a
posición en el gráfico de peso.

---

## 4. F3 · Pantallas restantes (rediseño real, no solo sombras)

Cada una: inspeccionar mockup → volcar DOM → replicar → verificar.

### 4.1 Plan (`Dieta | Entrenos`)
- [ ] Topbar «Tu plan actual» + **H1 «Dieta y entrenamiento»** + segmentos.
- [ ] **Importar dieta** destacada (foto/PDF).
- [ ] Resumen de macros 3-col («1.800 kcal · Vigente desde…» / Proteína / Hidratos derivados /
      Grasa derivada).
- [ ] **«Estructura del día»** con filas de comida + iconos + nº opciones + «Gestionar».
- [ ] **«Acciones del plan»** (Importar nueva dieta / Ver versiones).
- [ ] Segmento **Entrenos**: semana vigente, sesiones, kcal editable, reasignar día, borrar.

### 4.2 Chat
- [ ] Lista de hilos (30+), burbujas usuario/asistente, compositor, chips de sugerencia — al
      estilo del mockup. Streaming intacto.

### 4.3 MED (dentro de Progreso)
- [ ] Historial y evolución completos, gráfico de composición (doble eje), «Preparar visita»,
      entrada retroactiva.

### 4.4 Historial (dentro de Progreso)
- [ ] Timeline inverso (objetivos + dietas + semanas de entreno + MEDs), rango + filtros,
      inmutable, detalle en sheet.

### 4.5 Ajustes
- [ ] 3 grupos (Atleta / App / Cuenta), filas de setting al estilo del mockup.

---

## 5. Workflows / sheets (~47) — sistema `flow-sheet`

El mockup define ~47 flows (`data-open-flow`) con un **sistema de sheets propio**: `sheet-grabber`,
`sheet-head`, `flow-panel`, `flow-list`, `flow-callout`, `flow-field`, `flow-primary`/`flow-secondary`,
`flow-stat`, `flow-grid`, `flow-status-line`, `flow-section`.

- [ ] **Construir el `flow-sheet` compartido UNA vez** (componentes reutilizables) y aplicarlo a
      todos los sheets. Es la mayor palanca de coherencia y de ahorro.

**Ya alineados (Hoy):** add-sheet (home + sub-capas foto/plan/describir/manual/productos/editor),
Mi día (day-context), coach-welcome (tarjeta).

**Pendientes de alinear al `flow-sheet`** (funcionan, estilo v1):
- **Hoy:** check-in matinal, peso exprés, cierre del día, **CoachSheet** (el sheet del coach en sí),
  meal-tools, template-save. Repaso fino de las sub-capas de Añadir (foto/describir/del plan/editor).
- **Progreso:** deficit-info, mark-register/edit/delete, med-register/edit/delete, visit-prepare,
  history-diet, history-training, report.
- **Plan:** plan-tools, plan-targets, plan-meal-options, diet-import(+preview),
  training-import(+preview), training-session(+delete), training-week-tools(+delete).
- **Chat:** thread-manage.
- **Ajustes:** athlete-profile, objective-edit, supplement-add, health-import, backup-data(+restore),
  session-map, logout-confirm.

> Nota: todos existen ya funcionalmente. El restyle es aplicarles el `flow-sheet`; **no** cambiar
> su comportamiento.

---

## 6. F4 · Cierre

- [ ] **Estados**: vacíos (instructivos), errores de IA visibles (mensaje del proveedor + status),
      offline/cola de sync — al estilo del mockup.
- [ ] **Pulido 07 §6**: título de documento dinámico, inputs ≥16px sin zoom iOS, loadings sin CLS,
      `prefers-reduced-motion`, safe areas con la nav.
- [ ] **Skeletons** nuevos con las formas nuevas (Hoy/Progreso/Plan).
- [ ] **Playwright**: actualizar selectores que hayan cambiado; 4 flujos en verde contra la rama de
      test de Neon (registrar día, foto IA mockeada, check-in matinal, import CSV).
- [ ] **Lighthouse** móvil.
- [ ] **Iconos PWA** regenerados a la paleta nueva (`scripts/gen-icons.mjs` + PNGs) — RESTYLE-NOTES F0-4.
- [ ] **Cierre documental**: `CHANGELOG-restyle-v2.md`, `DECISIONS.md`, `HANDOFF`, sync de specs
      (04/05/09 si cambió prompt/diseño/flujo).

---

## 7. Checklist contractual (verificar al cierre de CADA fase)

Nada de esto se pierde: **racha 🔥**, **estado de sync**, **hinchazón en timeline y día**,
**Importar dieta**, **segmento Entrenos**, **chips de agua**, **steppers de gramos**, **undo**,
**autosave**, **edición en línea**, **favoritos**, **plantillas y copiar ayer**, **popovers «cómo se
calcula»**, **modo competición**, **PWA/share target/shortcuts**, **cola offline**.

**AC de flujo 🖐 (los valida Alex con el pulgar en la preview, nunca auto-aprobados):**
- Favoritos ≤3 toques.
- Check-in matinal ≤15 s.
- Hoy en ~1,5–2 pantallas (composición Intermedia).
- Look general en el iPhone, ambos temas.

---

## 8. Orden sugerido

1. **Sistema `flow-sheet` compartido** (§5) — se construye una vez, lo usan ~40 flows.
2. **Cerrar flows de Hoy** (check-in ×3 + CoachSheet) para dejar Hoy 100%.
3. **F2 Progreso a fondo** (§3).
4. **F3** por pantalla: Plan → Chat → MED/Historial → Ajustes (§4), cada una con sus flows.
5. **F4** cierre (§6) + checklist (§7).

Regla del usuario: **una fase por sesión o menos**; al cierre de cada fase → deploy de preview en
la rama, capturas de ambos temas, RESTYLE-NOTES de la fase, checklist contractual, y **OK de Alex
antes de avanzar**.

---

## 9. Coste (API pay-as-you-go, Opus 4.8)

Precios/1M: input $5 · output $25 · lectura caché $0,50 · escritura caché (5 min) $6,25.

Estimación del trabajo restante (rangos amplios, ±50%):
- **Máxima fidelidad** (verificar todo con capturas): **~$70–150**.
- **Equilibrio** (DOM-dump + capturas solo en firmas + subagentes + priorizar flows de alto uso):
  **~$40–90**.

Palancas de ahorro: menos capturas (volcado de DOM), subagentes para lo mecánico, priorizar
pantallas + flows de alto uso y dejar los raros (logout-confirm, backup-restore, report) en pasada
rápida documentada.

---

## 10. Higiene de la rama

- El harness `/dev-gauge` y su whitelist en `proxy.ts` son **temporales**: crear al verificar,
  **retirar siempre** antes de commitear/cerrar fase. (Hoy ya está retirado; `grep -c dev-gauge
  src/proxy.ts` debe dar 0.)
- No commitear ficheros ajenos al restyle que están sin trackear en el árbol
  (`HealthAutoExport-*.json`, `konsistent.json`, `next.config.ts` con el IP de dev local).
- Cada sesión futura: primero `git merge main` → `restyle-v2` antes de tocar nada.
