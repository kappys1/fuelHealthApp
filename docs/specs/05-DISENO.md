# 05 · Sistema de diseño

## 1. Concepto

Sujeto: **telemetría personal de combustible para un atleta-ingeniero**. La app se usa en tres contextos: cocina (registrar en 30 s con una mano), sofá (revisar tendencia), box/competición (consultar rápido entre WODs). No es una app de bienestar pastel ni un dashboard corporativo: es el **panel de instrumentos de un atleta** — legible, denso donde toca, con números como protagonistas.

Referencia estética: marcador de tiempos de competición + cuaderno de entrenamiento + **blueprint técnico** (Restyle v2). El PoC apuntaba a ese carácter (números tabulares + cobalto); el Restyle v2 lo reejecuta con una paleta azul precisa y tipografía Plus Jakarta Sans/Onest.

**Elemento firma: el FuelGauge.** La tarjeta de presupuesto del día como panel de combustible: cifra grande tabular estilo crono de competición, barra segmentada en 4 bloques (uno por comida del plan) que se van llenando, y el "restante" como cuenta atrás. Es lo primero al abrir la app y lo único con licencia para ser espectacular; todo lo demás, disciplinado. En fase Carga/Competición el gauge cambia a su variante informativa (azul, mensaje "esperado en esta fase") — el gauge nunca regaña por hacer lo correcto.

## 2. Temas (toggle claro/oscuro + auto por sistema)

> **Restyle v2 (2026-07-19):** rebrand consciente a la paleta azul **«Blueprint»** del mockup
> `docs/mockups/fuelboard-redesign-concept-v2.html`. Se **retira la identidad verde-fría/Barlow
> del PoC** (ver `DECISIONS.md` #71/#72 y `RESTYLE-NOTES.md`). Fuente de verdad de los hex:
> `src/app/globals.css`, reflejada 1:1 en `src/lib/contrast.ts` (gate AA).

Tokens como CSS variables; Tailwind los consume. Base fría azulada (blueprint técnico), sin grises neutros puros.

| Token | Claro «Blueprint day» | Oscuro «Blueprint night» |
|---|---|---|
| `--canvas` (fondo exterior columna) | `#E9EEF3` | `#090D12` |
| `--bg` | `#F6F8FA` | `#0E1319` |
| `--surface` | `#FFFFFF` | `#161C24` |
| `--surface-2` (chips, filas) | `#EEF2F6` | `#202936` |
| `--surface-strong` | `#E2E8EE` | `#2A3543` |
| `--ink` | `#142235` | `#F3F6FA` |
| `--muted` (texto atenuado) | `#566678` | `#ACB8C6` |
| `--line` (borde tarjeta) | `#DBE2E9` | `#303B49` |
| `--line-strong` (borde control) | `#728397` | `#748397` |
| `--primary` (kcal, acciones) | `#155DB8` | `#7EAEFF` |
| `--primary-strong` | `#0D4A93` | `#A9C9FF` |
| `--primary-soft` (fondo tenue) | `#E5EFFD` | `#1D304A` |
| `--protein` | `#087A55` | `#4AD29A` |
| `--carb` | `#946200` ámbar | `#F0C45A` |
| `--fat` / alerta | `#B84620` terracota | `#FF9566` |
| `--cobalt` (acento / foco) | `#3159D9` | `#89A1FF` |
| `--sleep` | `#6177D8` | `#93A5FF` |
| `--info` (fase / info) | `#2563C7` | `#7EAEFF` |
| `--special` / `--med-accent` (morado) | `#6747C7` | `#C2A7FF` |
| `--phase` (fondo fase especial) | `--info` @14% | `--info` @20% |
| `--destructive` (error como texto) | `#B84620` | `#FF9566` |

Contraste AA verificado en ambos temas (`pnpm audit:contrast`; gate en `pnpm test`): todos los pares
de texto ≥4.5:1, rellenos ≥3:1 — **sin un solo ajuste sobre los hex del mockup**. El color de macro es
un **lenguaje fijo** en toda la app (barras, chips, gráficos): azul=kcal, verde=proteína, ámbar=hidratos,
terracota=grasa. La **fase especial usa azul-info** (nunca rojo): el gauge no regaña por hacer lo correcto.

Radios: base 14px → **tarjetas 18px** (`radius-xl`), controles 12px (`radius-md`), píldoras 999px
(`radius-pill`). Sombras: `--card-shadow` (sutil, tarjetas) y `--shadow` (flotantes: sheets/diálogos).

## 3. Tipografía

- **Display / números**: `Plus Jakarta Sans` (500-700). Uso: cifra XL del gauge, títulos de tarjeta
  (uppercase, tracking 1.5px, 12-13px), cifras de Tendencia/KPIs y nav. Variable `--font-display`
  (`--font-condensed` es alias suyo — el nuevo sistema no tiene una condensada dedicada).
- **Cuerpo**: `Onest` (400/500/600/700) — geométrica cálida, muy legible en móvil. Fallback system-ui.
  Variable `--font-body`.
- **Datos tabulares**: `font-variant-numeric: tabular-nums` obligatorio en TODA cifra (clase utilitaria
  `.num`). Columnas de macros en formato compacto `231 kcal · 46P/0C/5F`, siempre enteros.
- Escala: 12 (metadatos) · 13 (datos secundarios) · 14-15 (cuerpo) · 16 (inputs móvil, evita zoom iOS) · 24/34/52 (cifras display).

## 4. Layout y navegación

- Mobile-first, contenedor máx 560 px centrado en desktop (la app es una columna; no inventar layout de escritorio en v1).
- **Nav inferior fija de 4 pestañas** (09-FLUJOS-UX §2): Hoy · Plan · Progreso · Chat, con Ajustes en el header. Estilo marcador: etiquetas condensed uppercase, activa con subrayado grueso `--primary`. Respetar `safe-area-inset-bottom`.
- Tarjetas: radio 12, borde 1px `--line`, padding 16, sin sombras (o mínimas en oscuro). Densidad: filas de lista a 40-44 px con separador `dashed`.
- Targets táctiles ≥44 px; inputs numéricos con `inputmode="decimal"`.

## 5. Componentes clave (specs de comportamiento)

Base: **shadcn/ui** para primitivas (Dialog, Select, Popover, Tabs, Sonner, Sheet), instaladas y tematizadas mapeando sus variables a los tokens de §2 — regla: si una pantalla parece la demo de shadcn, está mal tematizada. Los componentes de esta sección son custom.

- **MealRow con foto**: si la entrada tiene `photo_url`, miniatura 32 px redondeada antes del nombre; tap sobre la miniatura abre la foto en Dialog (el tap sobre el nombre sigue abriendo la edición).

- **FuelGauge**: descrito en §1. Debajo, barra de proteína + mini-barras C/F + línea «Faltan: …» sobre `--surface-2`.
- **MealRow** (comida registrada): ★ favorito (ámbar activo) · nombre (tap → edición en línea: descripción, comida, 4 macros, OK/Cancelar) · macros `.num` en `--muted` · papelera. Hint una sola línea sobre la lista: «Toca el nombre de una comida para editarla».
- **QuickAdd bar** (cabecera de registro): [Copiar ayer (n)] [Plantilla ▾ Aplicar] [chips de Favoritos]. Los favoritos como chips píldora con kcal.
- **PhotoAnalyzer**: selector comida + botón cámara (label nativo envolviendo `<input type=file capture>`) + campo Aclaraciones + [Reanalizar]; resultado como lista editable de items (input gramos 54 px) + Total en negrita + veredicto con fondo verde/naranja suave + dos botones de añadir. Estado de carga con spinner en el propio botón.
- **PhaseSelect + SessionSelect + BloatSelect** en una fila que envuelve; al elegir fase ≠ Normal, feedback inmediato en el FuelGauge.
- **TrendCard** («Tu gasto y déficit reales · desde el peso»): tarjeta invertida (fondo `--ink`, texto claro) — es la única tarjeta invertida de la app, marcando jerarquía; tres cifras display; nota fija de que el reloj es contexto.
- **Charts** (Recharts): línea de peso fina + ma7 gruesa `--primary`; barras de ingesta con ReferenceLine del objetivo en `--fat`; MED con doble eje. Tooltips con fondo `--surface`, sin gridlines agresivas.
- **Estados vacíos = instrucción**: p. ej. Tendencia sin datos → «Necesito ≥8 pesajes en al menos una semana para calcular tu déficit real. Pésate a diario en ayunas.» Errores IA: texto naranja con el motivo concreto y qué hacer.

## 6. Micro-interacciones y calidad

- Transiciones 150-200 ms solo en: llenado de barras del gauge, cambio de pestaña, aparición de resultados IA. Nada de parallax ni confetti; `prefers-reduced-motion` respetado.
- Recalculo en vivo (gramos) sin parpadeo: el input nunca se desmonta (lección PoC).
- Focus visible en teclado; labels reales en todos los inputs; modo oscuro sin blancos puros (#E8EDE8 máximo).
- Toasts breves para acciones sin cambio visual inmediato («Plantilla guardada», «31 días importados · kJ→kcal»).
- Copys: verbos activos y consistentes («Añadir», «Guardar», «Reanalizar»); los errores dicen qué pasó y qué hacer, sin disculpas vagas.
