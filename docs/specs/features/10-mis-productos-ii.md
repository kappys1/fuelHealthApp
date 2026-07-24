# F10 · Mis productos II — crear como en el día (Manual · Foto · Describir) + añadir desde el catálogo
**Estado**: implementada · **Tamaño**: feature
**Fecha**: 2026-07-21 · **Origen**: idea Alex 21-jul (durante uso real de F07, sobre
`restyle-v2`). Dos cosas: (1) «poder describir el producto y que la IA me dé los macros y
los pueda modificar por si acaso — es una utilidad que me he dado cuenta»; (2) «si le doy a
uno de estos productos que también se pueda añadir, no solo editar y borrar».

## Motivación (caso real)
Dos fricciones del catálogo de productos (F07), vistas usándolo:

1. **Crear un producto solo se puede a mano o por foto de etiqueta.** Muchos productos no
   tienen etiqueta a mano (o Alex la sabe de memoria pero no los macros exactos): hoy toca
   buscarlos fuera y teclear. El add del **día** ya resuelve esto con tres métodos
   (`Foto · Del plan · Describir`, `add-sheet.tsx:496`); el editor de **producto** se quedó
   atrás con solo `Foto + manual`. Alex quiere la misma ergonomía: **describe → la IA
   estima → revisa/edita**. Y el ✨ que lo haría ya existe (F-IA-3, en el editor de
   variantes del Plan, F09) — solo falta traerlo al producto.
2. **En el catálogo (`ProductRow`) tocar un producto no hace nada**: solo ★ (fijar), ✏️
   (editar), 🗑️ (borrar). Para añadir un producto que **no** está fijado hay que fijarlo
   primero o buscarlo entre los chips de Hoy → fricción pura (principio 3) sobre el long
   tail de productos.

## Alcance
**A · Editor de producto con selector de método (mismo patrón que el día).**
- Arriba del editor (`ProductEditorLayer`, `add-sheet.tsx:1624`), un selector `BigAccess`
  reusando el patrón de `add-sheet.tsx:500`, adaptado a **crear producto**:
  **Foto · Describir · Manual** (cae «Del plan» — no aplica a crear un producto).
- **Manual**: formulario (lo de hoy) **+ ✨ inline** para estimar desde el nombre en
  cualquier momento (mismo botón/patrón que `VariantsEditor`, F09).
- **Foto**: F-IA-11 (`api.readLabel`, ya existe) lee la etiqueta → prerrellena el
  formulario → origen `etiqueta`. Se **re-presenta** como uno de los tres botones; sigue
  siendo **lector puro** (sin cambios).
- **Describir**: *(nuevo)* texto (nombre/descripción) + `baseG` → **F-IA-3**
  (`api.estimatePlanOption`, ya existe) → prerrellena el formulario → origen `estimado`.
- Los tres **desembocan en el mismo formulario, prerrelleno y editable** (la estimación es
  un borrador que revisas): el aviso «⚠️ Estos números se fijan y no se vuelven a estimar»
  se mantiene; nota «✨ La IA estimó · confírmalo» cuando aplica (paralela a la de etiqueta).

**B · Origen `estimado` (badge nueva).**
- Nuevo valor `estimado` en el enum `product_source` (`schema.ts:73`). Cuando el ✨ (Manual)
  o Describir rellenan → `source = "estimado"`; una foto posterior lo pisa a `etiqueta`; el
  manual puro sin ✨ sigue `manual`.
- `SOURCE_BADGE` (`add-sheet.tsx:1556`) y `ProductSourceIcon` (`add-sheet.tsx:536`) ganan
  `estimado` (icono ✨). De un vistazo en el catálogo se distingue ojímetro vs etiqueta
  fiable (honestidad, principio 2).

**C · Unidad como etiqueta (g / ml / unidad).**
- El producto gana una **unidad de visualización** (`unit`: `g` | `ml` | `ud`, default `g`).
  El campo «Base en gramos» y la etiqueta «(por X g)» pasan a usar la unidad elegida.
- **La cantidad sigue siendo un número que escala 1:1** (densidad ≈ 1): `scaleMacros`/
  `entryBaseFields` (F06) **no cambian**; solo cambian las etiquetas. `unit = ud` con
  `baseG` vacío = fijo por unidad (lo de hoy, solo que ahora se rotula «unidad»).

**D · Añadir desde el catálogo.**
- Tocar el cuerpo de la fila (`ProductRow`, `add-sheet.tsx:1562`) **añade** el producto:
  reusa `addProduct(p)` (`add-sheet.tsx:176`) → stepper si tiene `baseG`, 1-toque si es
  fijo; a la comida seleccionada arriba. ✏️🗑️★ siguen para gestionar (botones aparte, sin
  colisión de gesto).

## NO-alcance
- **NO** un flujo que enruta «una cosa» a producto/plan/dieta (la «trampa» que Alex
  descartó): cada sitio guarda en lo suyo; esto es **misma ergonomía**, no router de
  destino. Choca con 09 §6 («una decisión por sheet») y mezcla objetos distintos.
- **NO** escalado real por nº de unidades (2 fajitas = 2 × equivalencia en gramos): sigue
  **parked** (F06 NO-alcance #57, HANDOFF 17-jul). Aquí la unidad es **solo etiqueta**.
- **NO** se toca el prompt de F-IA-11 (lector puro) ni el de F-IA-3 (se reusa tal cual, solo
  interpolando nombre + `baseG`). No hay prompt nuevo → no aplica «prompts congelados».
- **NO** es «Describir que empareje el texto con tus productos» (backlog 16-jul, F-IA-4,
  medir primero) ni base de datos externa (OFF/USDA/BEDCA = ruido, NO-alcance F07).
- Describir de producto usa **F-IA-3** (una cosa, por base), **no** el day-dump F-IA-4
  (multi-ítem del día).

## Momento de uso (09 §1)
Momento «lo que como / mis productos» — bottom-sheet de Añadir (capa productos/editor). Uso
puntual (crear/editar un producto; añadir uno del long tail). No añade pantalla ni tarjeta
permanente a Hoy (09 §6).

## Datos
- **Migración 0014** (aditiva): valor `estimado` en el enum `product_source`. Sin backfill
  (los existentes conservan su origen).
- **Migración 0015** (aditiva): columna `products.unit` (`text`/enum `g|ml|ud`, `NOT NULL
  DEFAULT 'g'`). Backfill implícito por el default.
- **export/restore, `migrate:poc`, `db:seed`** transportan `unit` (default `g` si falta) y
  aceptan `source = "estimado"`. Datos sagrados (principio 7): 0 pérdidas.
- `ProductInput`/`ProductDTO` (`client-api.ts`, `lookups.ts`) ganan `unit` y el nuevo
  `source`.

## Flujo
- **Crear/editar** (capa `editor`): eliges método arriba → (Foto/Describir prerrellenan,
  Manual vacío + ✨) → revisas/editas en el mismo formulario → eliges unidad → Guardar.
- **Añadir desde catálogo** (capa `products`): buscas → tocas la fila → stepper/1-toque →
  «Añadir a {comida}». Sin salir a fijar primero.

## IA
- Reusa **F-IA-3** (`estimatePlanOption`) y **F-IA-11** (`readLabel`), **sin tocar prompts**
  (solo interpolación de nombre + `baseG`). `temperature: 0` ya presente. **No** se re-valida
  el test de consistencia café ×3 (ningún prompt cambia). Errores de IA visibles (toast con
  el mensaje del proveedor + spinner mientras estima/lee). Coste: 1 llamada por clic, uso
  puntual → despreciable (dentro del ~€1,6–1,9/mes actual).

## Impacto en Coach/Chat/Visita
Nulo/mínimo. Los productos alimentan `meal_entries` al registrar, como cualquier valor; el
contexto de IA ya los ve por ahí. `unit` es solo rótulo (los gramos/valores que viajan no
cambian). `estimado` es procedencia del producto, no del día.

## AC
1. 🖐 **Describir**: en el editor, método Describir → escribo «tortitas de avena y clara sin
   azúcar» + `baseG` → ✨/estimar → rellena kcal/P/C/F plausibles, editables; origen queda
   `estimado`. (Alex valida con el pulgar.)
2. 🖐 **✨ en Manual**: método Manual, escribo el nombre → ✨ inline → rellena macros; puedo
   corregir a mano antes de guardar.
3. **Foto** sigue igual (F-IA-11): lee etiqueta → prerrellena → origen `etiqueta`; sin
   conexión, deshabilitada con su aviso.
4. Badge/icono **`estimado`** (✨) aparece en el catálogo para productos así creados; foto
   posterior lo pisa a `etiqueta`; manual sin ✨ sigue `manual`.
5. 🖐 **Unidad**: creo un producto con `unit = ml` (p. ej. «Café + leche 300 ml») → el editor
   y la fila rotulan «ml», el stepper escala 1:1; `unit = ud` con base vacía = fijo por
   unidad y lo rotula «unidad».
6. 🖐 **Añadir desde catálogo**: en «Mis productos», toco la fila de un producto **no
   fijado** → se añade a la comida seleccionada (stepper si tiene base, 1-toque si es fijo)
   sin tener que fijarlo antes. ✏️🗑️★ siguen funcionando.
7. export → restore de una BD con productos `estimado` y con `unit` ≠ `g` → 0 pérdidas
   (round-trip exacto); `migrate:poc` y `db:seed` no rompen.
8. `pnpm typecheck && pnpm test && pnpm build` en verde (incluye tests de scaleMacros con
   `unit` y del round-trip export/restore del nuevo campo).

## Riesgos / decisiones discutibles
1. **`estimado` como 4º origen** (vs. reusar `manual`): elegido por Alex — la señal
   «esto lo adivinó la IA» es información real y barata (migración aditiva). Coste: 1
   migración + 2 entradas de UI.
2. **Unidad = solo etiqueta, no escala por unidad**: mantiene parked el NO-alcance #57;
   cubre el 95 % (líquidos densidad ≈ 1) sin reabrir la complejidad de F06. Si en uso real
   muerde el escalado por unidad de verdad, se reabre #57 aparte.
3. **Describir de producto = F-IA-3, no F-IA-4**: un producto es «una cosa por base», no un
   volcado multi-ítem; reusa exactamente lo de F09/Plan. El ✨ inline (Manual) y el método
   Describir comparten handler.

## Fases
1. **Catálogo tap-para-añadir** (Alcance D) — la más barata, quita fricción diaria, **sin
   migración**. Reusa `addProduct`.
2. **Describir + ✨ en Manual + selector Foto·Describir·Manual + badge `estimado`**
   (Alcance A·B) — migración **0014** (enum), reusa F-IA-3/F-IA-11 sin prompt nuevo.
3. **Unidad-etiqueta g/ml/ud** (Alcance C) — migración **0015** (`products.unit`) +
   export/restore/`migrate:poc`/`seed` + rótulos.
