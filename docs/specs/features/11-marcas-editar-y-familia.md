# F11 · Editar marca (nombre + familia) + selector de familia visible
**Estado**: aprobada · **Tamaño**: feature (pequeña)
**Fecha**: 2026-07-21 · **Origen**: uso real de Alex en la pantalla de Marcas (Progreso · Historial / Plan · Entrenos)

## Motivación (caso real)
Alex entra al detalle de una marca y **no puede corregir el nombre ni la familia** — el
sheet de detalle (`mark-detail-sheet.tsx`) solo edita las *entradas*, nunca la marca. Además
la **familia no se ve** en ningún sitio del detalle (viaja en el `MarkDTO` y se ignora). Y al
crear una marca, el autocompletado de familias es un `<datalist>` nativo, **invisible en
Safari iOS** → duplica "Snatch" / "snatch" / "Snatches".

## Alcance
**A · Editar nombre + familia desde el detalle**
- `updateMark(id, { name?, family? })` en `src/server/db/queries/marks.ts` (molde de `updateMarkEntry`).
- `markPatchZ` en `src/lib/schemas.ts`: `name` string `.min(1).max(120)` opcional; `family` `.string().max(60).nullable().optional()`.
- `PATCH /api/marks/[id]/route.ts` (añadir junto al `DELETE` existente): auth + `parseBody(markPatchZ)` + `retry(updateMark)`.
- `api.updateMark(id, patch)` en `src/lib/client-api.ts`.
- `updateMark` en `src/components/marks/use-marks.ts`: **optimista con revert** (calcado de `updateEntry`) + `router.refresh()`.
- UI en `mark-detail-sheet.tsx`: lápiz junto al título → despliega inline input de nombre + selector de familia (C). Guardar optimista + toast; nombre vacío → error, no guarda.

**B · Chip de familia en el detalle**
- Bajo el título del detalle, chip con la familia si `mark.family` existe. Trivial (el dato ya llega).

**C · Selector de familia con chips visibles (componente reutilizable)**
- Nuevo componente (p. ej. `src/components/marks/family-picker.tsx`): input de texto libre + fila de **chips tocables** de las familias existentes (tocar rellena; escribir crea nueva).
- Reemplaza el `<datalist>` de familia en `mark-register-sheet.tsx` (crear) y se reusa en el editor del detalle (A).
- Helper puro `canonicalizeFamily(input, existing)` en `src/lib/marks.ts`: si lo tecleado coincide *case-insensitive* con una familia existente, adopta su grafía (mata el split "Snatch"/"snatch"). **Es la lógica testeable de la feature.**

## NO-alcance
- **No se edita el tipo de medida (`measureType`) ni la unidad.** Cambiar peso→tiempo
  invalidaría todas las entradas (valores guardados como kg vs segundos: 115 se leería
  "1:55"). Corregir el tipo se hace borrando y recreando (caso raro). Decisión firme.
- Sin combobox/Popover: chips visibles es más móvil, más barato y resuelve el "ver las familias".
- Sin fusionar/renombrar familias en bloque (no hay caso real todavía).

## Momento de uso
Mantenimiento puntual de PRs (09 §1 · gestión, baja frecuencia): corregir un nombre/familia
mal escritos, o etiquetar bien al crear. No es flujo diario; vive en el sheet de detalle y en
el sheet de crear. No añade nada a Hoy.

## Datos
- `performance_marks.family` (text, nullable) **ya existe**; `markCreateZ` ya valida `family.max(60)`.
- **Sin migración de BD.** No cambia export/restore ni `migrate:poc` (la columna ya viajaba); editar solo muta strings existentes.

## Flujo (dónde vive según 09)
- Sheet de detalle de marca (§6, bottom-sheet): lápiz junto al título revela edición inline; chip de familia visible bajo el título.
- Sheet de crear marca (§6): el `FamilyPicker` sustituye al `<datalist>`.

## IA
No aplica. Feature 100 % determinista, cero llamadas a la IA.

## Impacto en Coach/Chat/Visita
Ninguno nuevo. El contexto de IA ya incluye las marcas con su familia (`server/ai/context.ts`);
editar solo cambia el texto que ya se pasaba. Sin cambio de prompt.

## AC
1. Editar el nombre desde el detalle → cambia al instante (optimista) y persiste tras recargar. 🖐
2. Nombre vacío al guardar → error visible, no persiste, revert.
3. Editar la familia → persiste; el chip (B) refleja el nuevo valor; vaciarla la quita. 🖐
4. Chip de familia visible en el detalle **solo** si hay familia.
5. En crear y en editar: las familias existentes aparecen como **chips tocables**; tocar uno rellena; texto nuevo crea familia nueva; el `<datalist>` de familia desaparece. 🖐
6. Teclear "snatch" existiendo "Snatch" → se guarda como "Snatch" (`canonicalizeFamily`, con test unitario).
7. Sin migración de BD; export/restore y contexto IA sin cambios.
8. `pnpm typecheck && pnpm test` en verde; test de `canonicalizeFamily` escrito **antes** que la UI.

## Riesgos / decisiones discutibles
- **Editar solo nombre+familia, no tipo/unidad** (evita invalidar entradas). — decidido con Alex, 21-jul.
- **Chips visibles en vez de combobox/`<datalist>`** (el datalist nativo es invisible en Safari iOS; los chips resuelven "ver las familias" con un toque). — decidido con Alex, 21-jul.
- `canonicalizeFamily` es la única lógica pura; el resto es CRUD + UI espejo de patrones existentes (`updateEntry`, `deleteMark`).

## Fases
Una sola sesión. Orden sugerido (lógica antes que UI):
1. `canonicalizeFamily` + su test.
2. Backend: `updateMark` query → `markPatchZ` → `PATCH` route → `api.updateMark` → `updateMark` en `use-marks`.
3. `FamilyPicker` (chips + input) y reuso en `mark-register-sheet` (sustituye datalist).
4. Edición inline + chip de familia en `mark-detail-sheet`, cableada a `updateMark`.
5. AC uno a uno; dejar los 🖐 pendientes del pulgar de Alex.
