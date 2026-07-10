# 05 · Sistema de diseño

## 1. Concepto

Sujeto: **telemetría personal de combustible para un atleta-ingeniero**. La app se usa en tres contextos: cocina (registrar en 30 s con una mano), sofá (revisar tendencia), box/competición (consultar rápido entre WODs). No es una app de bienestar pastel ni un dashboard corporativo: es el **panel de instrumentos de un atleta** — legible, denso donde toca, con números como protagonistas.

Referencia estética: marcador de tiempos de competición + cuaderno de entrenamiento. El PoC ya apuntaba ahí (Barlow Condensed + números tabulares + cobalto); la v1 lo ejecuta con precisión.

**Elemento firma: el FuelGauge.** La tarjeta de presupuesto del día como panel de combustible: cifra grande tabular estilo crono de competición, barra segmentada en 4 bloques (uno por comida del plan) que se van llenando, y el "restante" como cuenta atrás. Es lo primero al abrir la app y lo único con licencia para ser espectacular; todo lo demás, disciplinado. En fase Carga/Competición el gauge cambia a su variante informativa (azul, mensaje "esperado en esta fase") — el gauge nunca regaña por hacer lo correcto.

## 2. Temas (toggle claro/oscuro + auto por sistema)

Tokens como CSS variables; Tailwind los consume. Nada de grises neutros puros: todo con matiz verde-frío (mundo de box de CrossFit, no de oficina).

| Token | Claro «Morning session» | Oscuro «Night comp» |
|---|---|---|
| `--bg` | `#F2F4EF` hueso frío | `#0F1613` verde-negro |
| `--surface` | `#FFFFFF` | `#18221D` |
| `--surface-2` (chips, filas) | `#EDEFEA` | `#1F2B25` |
| `--ink` | `#181F1B` | `#E8EDE8` |
| `--muted` | `#5D6862` | `#93A099` |
| `--line` | `#D9DED5` | `#2C3830` |
| `--primary` (kcal, acciones) | `#2247C9` cobalto | `#7B96FF` |
| `--protein` | `#1B8A50` | `#4CC98A` |
| `--carb` | `#B8860B` ámbar | `#E0B341` |
| `--fat` / alerta | `#E8590C` | `#F2894C` |
| `--phase` (info de fase) | `#2247C9` al 12% fondo | ídem |

Contraste AA mínimo en ambos temas. El color de macro es un **lenguaje fijo** en toda la app (barras, chips, gráficos): azul=kcal, verde=proteína, ámbar=hidratos, naranja=grasa.

## 3. Tipografía

- **Display / números**: `Barlow Semi Condensed` 600-700 (o Barlow Condensed para cifras XL del gauge). Uso restringido: gauge, títulos de tarjeta (uppercase, tracking 1.5px, 13px), cifras de Tendencia y nav.
- **Cuerpo**: `Instrument Sans` (400/500/600) — más carácter que Inter sin perder legibilidad. Fallback system-ui.
- **Datos tabulares**: `font-variant-numeric: tabular-nums` obligatorio en TODA cifra (clase utilitaria `.num`). Columnas de macros en formato compacto `231 kcal · 46P/0C/5F`, siempre enteros.
- Escala: 12 (metadatos) · 13 (datos secundarios) · 14 (cuerpo) · 16 (inputs móvil, evita zoom iOS) · 24/34/44 (cifras display).

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
