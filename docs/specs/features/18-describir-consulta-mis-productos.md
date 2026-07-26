# F18 · Describir consulta «Mis productos»
**Estado**: IMPLEMENTADA (26-jul; typecheck + 401 tests verdes) · **AC1 🖐 pendiente del pulgar de Alex** (+ café ×3) · **Tamaño**: feature (prompt + schema + lógica pura, sin migración)
**Fecha**: 2026-07-26 · **Origen**: caso real 26-jul — «cafe con leche de almendra 0% lidl» en el flujo Describir estima de tablas (24 kcal genéricas) e ignora el producto guardado *Bebida de almendras Lidl 0%* (250 g = 40 kcal · 1,8P/0C/3,5F).

## Motivación (caso real)
El **16-jul** el chat tuvo este mismo problema con el gazpacho de Lidl y se resolvió con **F12**: se inyecta el catálogo «Mis productos» en el prompt y se fija la jerarquía *Mis productos → web citada → estimación*. La **búsqueda universal** del sheet también mira los productos (en local, `corpus.products`). Pero el flujo **Describir** (F-IA-4 «volcado del día», `day-dump`) nunca recibió el catálogo: su ruta construye contexto de plan + atleta y cero productos. Es el mismo agujero que F12 tapó en el chat, abierto en Describir. Resultado: al describir una comida que contiene un producto de marca guardado, la IA lo re-estima de tablas en vez de usar **los macros de Alex** (contradice P2 consistencia > exactitud y la queja literal «no tiene en cuenta el producto guardado»).

## Alcance (qué hace, en viñetas verificables)
- La ruta `day-dump` carga el catálogo (`listProducts`) y lo inyecta en el prompt como sección **MIS PRODUCTOS** (formato reutilizado de `productsContext`, F12), solo si hay productos.
- El prompt instruye al modelo a **identificar** (no recalcular) coincidencias: si un item del texto coincide con un producto de MIS PRODUCTOS —aunque el texto lo describa distinto, p. ej. una bebida de marca dentro de un café— devuelve en un campo nuevo `producto` el **nombre EXACTO** de ese producto; si no coincide con ninguno, `producto: null` y estima de tablas como hoy.
- **El servidor calcula los macros** (diseño B, determinista): para cada item con `producto` que empareje por nombre exacto (trim + case-insensitive) con un producto real del catálogo, una función pura recalcula macros desde la base guardada (el `nombre` del item se **conserva** — la preparación que describió el modelo; el nombre canónico viaja en `producto`. Enmienda 26-jul, DECISIONS #82):
  - `baseG != null` y `gramos != null` → factor `gramos/baseG`; kcal/macros = base × factor.
  - `baseG != null` y `gramos == null` → usa una ración base (`gramos = baseG`), macros = base.
  - `baseG == null` (producto fijo) → macros = base tal cual; `gramos = null`.
  - Redondeo con los helpers de `lib/macros` (`roundKcal`, `roundMacroStore` a 1 decimal), como el resto del guardado.
- Si `producto` no empareja con ningún nombre real (o es null), el item se queda **tal como lo estimó el modelo** (sin match forzado).

## NO-alcance (qué queda explícitamente fuera y por qué)
- **F-IA-2 `estimate`** (fallback de la búsqueda universal): `estimateZ` devuelve macros planos **sin gramos**, así que el reescalado determinista sería ambiguo, y la búsqueda local del sheet ya empareja productos para el caso común. Sin caso real con fecha que muestre la caja de búsqueda ignorando un producto → fuera (guardarraíl doc 11: no optimizar sin medición). Revisitar si aparece.
- **Foto / etiqueta** (F-IA-1/F-IA-11): ya tienen su propio camino de producto; no se tocan.
- **Vincular el item a un `productId`** en el registro (relación persistida): fuera. El match es efímero (solo mejora los macros al crear); el registro sigue siendo una entrada normal editable. Sin cambio de datos persistidos.

## Momento de uso (09 §1)
Registro rápido del día — el camino de **Describir** (una comida o el día entero por texto/voz). Frecuencia alta; es de los caminos de menor fricción (P3). No añade pantallas ni pasos: el usuario no ve el mecanismo, solo obtiene sus macros.

## Datos (schema/settings; migración; export/restore; migrate:poc)
- **Sin migración.** No hay cambios en tablas persistidas. El campo `producto` es efímero (salida de IA, no se guarda).
- **Schema de IA:** `dayDumpItemZ` gana `producto: z.string().nullable()` (`src/server/ai/schemas.ts`).
- **Export/restore y migrate:poc:** sin impacto (no cambia lo que se persiste).

## Flujo (dónde vive según 09)
Bottom-sheet de añadir → capa **Describir** (`add-sheet.tsx`, layer `describe`). Sin cambios de UI: mismo botón «Reinterpretar», misma lista de items previa a «Añadir por separado / como una». Cambia solo la calidad de los macros de los items que emparejan con un producto guardado (el nombre del item se conserva; el canónico va en `producto`).

## IA (prompt, modelo, esquema, error, coste)
- **Modelo/pensamiento:** sin cambios — `kind: "vision"`, `task: "estimate"` (Gemini, thinking low, `temperature 0`), `maxOutputTokens: 2500`.
- **Prompt CONGELADO** (`dayDumpPrompt` en `prompts.ts`): la redacción exacta la fija el implementer y la cubre `prompts.test.ts`. Debe (a) interpolar la sección MIS PRODUCTOS con `productsContext(products)` solo si no está vacía; (b) instruir identificación por nombre EXACTO + `producto: null` si no hay match; (c) explicitar «no recalcules los macros de un producto de Mis productos: solo identifícalo»; (d) añadir `"producto": string|null` al JSON de salida. Regla de la casa: prompt congelado → tras editar, re-validar AC de F-IA-4 (+ café ×3, DECISIONS #65) y sincronizar `04-IA.md` solo si cambió esquema/modelo/coste/AC/doctrina (DECISIONS #70).
- **Esquema de salida:** `dayDumpZ` con el item extendido (arriba).
- **Lógica pura:** nueva función testeada (p. ej. `src/server/ai/product-match.ts`, `applyProductMatches(items, products)`), invocada por la ruta `day-dump` tras `runStructured`. Ni una fórmula en la ruta ni en el componente.
- **Error:** sin cambios (mismo `aiErrorResponse` / `serverError`; la carga del catálogo entra en el `Promise.all` con `retry`, y si falla → `serverError`).
- **Coste:** despreciable. El catálogo son unas pocas líneas (mismo texto que ya inyecta el chat en F12); Gemini Flash.

## Impacto en Coach/Chat/Visita
- **Chat:** ya lo hace (F12) — esta feature alinea Describir con esa doctrina.
- **Coach/Visita:** sin cambios (no trocean items descritos).

## AC (numerados; 🖐 = valida Alex con el pulgar)
1. Con *Bebida de almendras Lidl 0%* guardado (250 g = 40 kcal · 1,8P/0C/3,5F), Describir «cafe con leche de almendra 0% lidl» produce un item **con el nombre de la preparación** (p. ej. «Café con leche de almendras») cuyos macros están **escalados desde la base del producto** (no la estimación genérica de 24 kcal), con el canónico en `producto`. **Caso canónico de regresión** en `prompts.test.ts` / `product-match.test.ts` (lección 3). 🖐 *(Validado en producción el 26-jul: el ajuste del nombre = preparación salió de este pulgar.)*
2. Un item descrito que **no** coincide con ningún producto guardado se sigue estimando de tablas como hoy (sin match forzado). Caso en test.
3. Catálogo vacío → el prompt omite la sección MIS PRODUCTOS y el flujo se comporta exactamente como antes (espejo del test de `productsContext([])` de F12). Caso en test.
4. Producto fijo (`baseG == null`) que empareja → item con sus macros base y `gramos: null` (sin stepper). Caso en test.
5. `producto` devuelto por el modelo que **no** existe en el catálogo (nombre inventado / no exacto) → se ignora, el item queda con la estimación del modelo. Caso en test.
6. `pnpm typecheck && pnpm test` en verde; AC de F-IA-4 re-validados tras tocar el prompt.

## Riesgos / decisiones discutibles
1. **Sobre-emparejamiento (ley del péndulo).** Mitigado con match por **nombre exacto** (el modelo recibe el catálogo con los nombres literales y se le pide devolverlos tal cual); un nombre no-exacto no empareja (AC5). Evita arrastrar el producto equivocado.
2. **Match del modelo vs. servidor.** Diseño B a propósito: el modelo hace el **reconocimiento semántico** (qué producto es, aun en un café compuesto); el servidor hace la **aritmética** (exacta, consistente, P2 + lección 1 dato/determinismo). El modelo puede rellenar kcal/macros en el schema pero el servidor los **sobrescribe** en los items emparejados.
3. **Alcance ceñido a day-dump.** `estimate` queda fuera (ver NO-alcance); si molesta en uso real, mini-spec aparte.

## Fases
Una sesión. Orden sugerido: (1) schema `producto` + función pura `applyProductMatches` con sus tests; (2) prompt `dayDumpPrompt` (sección + instrucción) + `prompts.test.ts`; (3) cablear la ruta `day-dump` (cargar catálogo + aplicar match); (4) typecheck + test + re-validar AC F-IA-4 (café ×3).
