# F13 · Registro más rápido — añadir por momento + acciones de la entrada
**Estado**: implementada (Fase 1 validada 🖐; Fase 2 AC 4/5/6 pendientes 🖐) · **Tamaño**: feature
**Fecha**: 2026-07-25 · **Origen**: tres observaciones de uso real de Alex (25-jul), sobre
`feat/chat-f12`, con captura de la tarjeta «Comidas» a 0 entradas:
(1) «cada dos por tres estoy metiendo un producto [en descripción] y luego no lo puedo pasar
a Mis productos ni clonar algo a las comidas»; (2) «en vez de darle al más le doy al día para
expandir la sesión y luego me doy cuenta de que tengo que darle al +»; (3) «cuando no haya
nada, al expandir mostrar “no hay comidas todavía, toca para registrar…” y que se abra lo
mismo que el + con la comida ya preseleccionada».

## Motivación (caso real)
Tres fricciones del registro diario, todas del uso real:

1. **La fila del momento no deja añadir.** Hoy el ÚNICO acceso explícito para añadir es el
   FAB `+` flotante abajo-derecha (`hoy-client.tsx:278`). El instinto de Alex es tocar la
   fila del momento (es el sitio obvio para «añadir a la cena»), pero la fila **solo
   expande** (`meal-timeline.tsx:96`), y si el momento está **vacío** la sección expandida
   **no muestra nada** (`meal-timeline.tsx:142`, `open && rows.length > 0`): hueco muerto.
   Alex toca, no pasa nada, y tiene que ir a buscar el `+`.
2. **Una entrada registrada no se puede reaprovechar.** Cuando come lo mismo dos veces, o
   quiere repetir hoy algo concreto de un día pasado, no hay «duplicar»: toca re-teclear en
   la búsqueda de recientes, que además **pierde base/gramos/foto** (entra como `manual`
   fijo, `add-sheet.tsx:150-152`).
3. **Un producto que registra a menudo no se puede promover a «Mis productos».** El chat ya
   lo hace (F12, `product-save.ts`, DECISIONS #75), pero **desde el día no**. Alex mete el
   mismo producto una y otra vez por «Describir»/estimar y no puede fijarlo al catálogo para
   que la próxima sea 1 toque.

## Alcance
**A · Añadir por momento** (arregla obs 2 y 3).
- `MealTimeline` recibe `onAddMeal(meal: MealKey)` desde `hoy-client` — **`openAdd(meal)` ya
  existe** (`hoy-client.tsx:86`) y preselecciona la comida; solo hay que pasarlo.
- **Momento vacío + expandido** (`open && rows.length === 0`, hoy no renderiza nada): CTA
  «Aún no hay comidas aquí · Toca para registrar» que llama `onAddMeal(meal)` → abre el
  add-sheet con **esa comida preseleccionada**.
- **Momento con comidas**: pie «＋ Añadir a {Comida}» al final de la sección expandida
  (debajo del subtotal de macros, `meal-timeline.tsx:152`), misma acción `onAddMeal(meal)`.
- La fila-cabecera sigue expandiendo/colapsando (no se cambia su gesto); lo que gana premio
  es el **interior** de la sección, que es donde Alex ya mira tras expandir.

**B · Duplicar entrada** (cubre «clonar 1 y 2»: comer lo mismo dos veces + repetir de otro día).
- En el sheet de editar entrada (`meal-row.tsx`, `EditForm`), acción **«Duplicar»** que crea
  una entrada **idéntica**: copia TODOS los campos vía `EntryInput` — `name`, macros,
  `source`, `photoUrl`, `grams` y la **base inmutable** (`baseG/baseKcal/baseProt/baseCarb/
  baseFat`). Es el diferencial frente a recientes, que los pierde.
- **Día de hoy**: un botón «Duplicar» → duplica en el día visible (`todayState.addEntries`).
- **Día pasado** (`date !== dayKey()`): dos opciones — «Duplicar aquí» (al día visible) y
  **«Duplicar a hoy»** (resaltada, es lo más frecuente). «A hoy» escribe con
  `api.addEntries(dayKey(), [entry])` directo (el día de hoy no es la vista actual) + toast
  «Añadido a hoy».

**C · Guardar en Mis productos desde la entrada** (arregla obs 1, superficie del día de F12).
- En el mismo `EditForm`, acción **«Guardar en Mis productos»**.
- **Con base** (`entry.baseG != null` y base completa): producto que **reescala** —
  `baseG = entry.baseG`, `baseKcal/Prot/Carb/Fat = entry.base*` (los valores POR base, no los
  escalados de la entrada). Ej.: entrada «avena 150 g / 555 kcal» con base 100 g/370 → el
  producto se guarda 100 g/370, no 150 g/555.
- **Sin base** (one-off estimado/manual): producto **fijo** (`baseG = null`) con las macros
  actuales de la entrada.
- `source` derivado de la entrada: `ia`/`foto`/`estimado` → **`estimado`**; el resto →
  **`manual`**. `unit = "g"` (las entradas no guardan unidad; g cubre el 95 %, editable en el
  catálogo). `grupo = null`, `pinned = false`.
- **Dedup por nombre exacto** (misma regla que `saveConfirmedProduct`, `product-save.ts:126`):
  si ya existe un producto con ese nombre, **actualiza**; si no, **crea**. Toast «Guardado en
  Mis productos» con acción «Editar» que abre el add-sheet en el catálogo.

## NO-alcance
- **NO** un router «guardar esta cosa en producto/plan/dieta» (la «trampa» que Alex descartó
  en F10 NO-alcance): C guarda solo en Mis productos, una decisión por acción (09 §6).
- **NO** un navegador/histórico de entradas pasadas para «repetir de otro día»: se reusa la
  **navegación de fecha que ya existe** (`hoy-client.tsx:184`) — vas al día pasado, abres la
  entrada, «Duplicar a hoy». Sin pantalla nueva ni tarjeta permanente (09 §6).
- **NO** toca la búsqueda de recientes (`add-sheet.tsx:150`) ni «Copiar ayer» / plantillas
  (`quick-add-menu.tsx`): B es complementario (preserva base/gramos/foto; 1 toque desde la
  entrada), no un camino duplicado del día entero.
- **NO** cambia el gesto de la fila-cabecera (sigue expandir/colapsar): añadir vive en el
  interior de la sección, no pisa el toggle.
- **NO** hay IA: A/B/C son deterministas. No aplica «prompts congelados».
- **NO** hay `unit` en las entradas → C no puede inferir ml/ud; queda `g` (editable luego).

## Momento de uso (09 §1)
Momento «lo que como» — pestaña Hoy, tarjeta «Comidas» y su bottom-sheet de editar entrada.
Uso **diario y de alta frecuencia** (A: cada vez que registras; B/C: recurrente). No añade
pantalla ni tarjeta permanente a Hoy: A vive en el interior de la sección del timeline; B/C
en el sheet de editar entrada que ya se abre al tocar una comida (`meal-row.tsx:120`).

## Datos
- **Sin migración, sin schema nuevo.** A/B reusan `EntryInput` + `todayState.addEntries` /
  `api.addEntries`; C reusa `ProductInput` + `todayState.createProduct` (`api.updateProduct`
  para el update del dedup). Todos con cola offline ya integrada (`use-today.ts:45,253`).
- **export/restore, `migrate:poc`, `db:seed`**: intactos — no hay campos nuevos. Los
  productos creados por C viajan como cualquier producto F07/F10. Datos sagrados (principio 7).

## Flujo
- **A** (`meal-timeline.tsx`): expandes un momento → si vacío, CTA de registro; si tiene
  comidas, pie «＋ Añadir a {Comida}» → add-sheet con la comida preseleccionada.
- **B/C** (`meal-row.tsx` · `EditForm`): tocas una comida → sheet de editar → nueva fila de
  acciones junto a Cancelar/Guardar/Borrar: **Duplicar** (o «Duplicar aquí / a hoy» en día
  pasado) y **Guardar en Mis productos**. Ambas cierran el sheet tras actuar + toast.

## IA
Ninguna. Todo determinista. No se toca `server/ai/`. Sin coste IA nuevo.

## Impacto en Coach/Chat/Visita
Nulo. B produce `meal_entries` normales (ya en el contexto de IA). C crea productos que el
chat/coach ya ven por el catálogo (mismo camino que F07/F10/F12). No hay dato ni tipo nuevo.

## AC
1. 🖐 **Momento vacío**: expando «Cena» sin registros → veo «Aún no hay comidas aquí · Toca
   para registrar» → al tocar se abre el add-sheet con **Cena preseleccionada**.
2. 🖐 **Momento con comidas**: expando un momento con entradas → veo «＋ Añadir a {Comida}»
   bajo el subtotal → al tocar, add-sheet con esa comida preseleccionada.
3. **La fila-cabecera sigue expandiendo/colapsando** igual que hoy (el add vive en el
   interior; no hay regresión del toggle ni de «Expandir/Contraer» global).
4. 🖐 **Duplicar (hoy)**: en una entrada con gramos (p. ej. «tostada 40 g»), «Duplicar» crea
   otra idéntica en el mismo momento, **conservando gramos y base** (editable con stepper).
5. 🖐 **Duplicar a hoy (día pasado)**: navego a un día anterior, abro una entrada → «Duplicar
   a hoy» la añade al día de hoy (toast «Añadido a hoy»); «Duplicar aquí» la añade al día
   visible. Se conservan base/gramos/`photoUrl`.
6. 🖐 **Guardar en Mis productos (con base)**: entrada escalable «avena 150 g» (base 100 g/
   370 kcal) → «Guardar en Mis productos» crea un producto **100 g/370** (reescala), no
   150 g/555; aparece en el catálogo con `source` coherente y `pinned:false`.
7. **Guardar en Mis productos (sin base)**: entrada one-off sin base → crea producto **fijo**
   (`baseG null`) con las macros actuales.
8. **Dedup por nombre**: guardar dos veces el mismo nombre **no duplica** el producto
   (actualiza el existente), igual que `saveConfirmedProduct`.
9. export → restore tras crear productos con C → 0 pérdidas; `migrate:poc` y `db:seed` no
   rompen (sin campos nuevos, es verificación de no-regresión).
10. `pnpm typecheck && pnpm test && pnpm build` en verde (incluye un test puro de la
    derivación entrada→`ProductInput`: base vs. fijo, mapeo de `source`, dedup).

## Riesgos / decisiones discutibles
1. **«Duplicar a hoy» escribe fuera de la vista actual.** `todayState.addEntries` cierra
   sobre el `date` visible (`use-today.ts:45`); para escribir en hoy desde un día pasado se
   usa `api.addEntries(dayKey(), …)` directo (sin update optimista de una vista que no se ve)
   + `refetch` si vuelves a hoy. Nuance de implementación, no de producto.
2. **`unit` no viaja en la entrada** → C guarda `g` por defecto. Cubre el 95 % (F10 §C: la
   cantidad escala 1:1); si el producto era ml/ud, Alex lo corrige en el catálogo. Alternativa
   (inferir unidad) descartada: no hay dato de dónde sacarla.
3. **Solape consciente B↔recientes y C↔F12.** No son caminos duplicados: B preserva
   base/gramos/foto y es 1 toque desde la entrada (recientes teclea y pierde datos); C es la
   superficie del **día** de una capacidad que F12 solo tenía en el **chat**. Se acepta por
   valor claro (principio 3); si en uso real uno canibaliza al otro, se revisa.

## Fases
1. **Añadir por momento** (Alcance A) — la más barata y la que más pica a diario, **sin
   migración**, solo `meal-timeline.tsx` + pasar `onAddMeal` desde `hoy-client`. Reusa
   `openAdd`.
2. **Acciones de la entrada** (Alcance B·C) — en `meal-row.tsx` (`EditForm`): Duplicar +
   Guardar en Mis productos. Reusa `addEntries`/`createProduct`; test puro de la derivación
   entrada→producto antes de la UI.
