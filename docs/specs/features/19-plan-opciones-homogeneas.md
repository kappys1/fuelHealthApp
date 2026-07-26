# F19 · El editor de opciones del Plan, homogéneo con el resto
**Estado**: Fase 1 IMPLEMENTADA y VALIDADA (26-jul) · Fase 2 aprobada y pendiente · **Tamaño**: feature (IA + UI + migración en Fase 2) · 2 fases
**Fecha**: 2026-07-26 · **Origen**: caso real 26-jul (continuación de F18) — al crear la opción de plan «Café con leche con almendras 0%», el ✨ «Estimar macros y grupo con IA» estimó de tablas (250 g = 32 kcal · 1P/1C/3F) e ignoró el producto guardado *Bebida de almendras Lidl 0%* (250 g = 40 kcal · 1,8P/0C/3,5F). Reabre el aparcado HANDOFF §B3 item *a* («Describir/productos en las opciones del plan», Alex «lo dejo así y ya veremos», 22-jul), ahora con driver real.

## Motivación (caso real)
F18 tapó el agujero de «Mis productos» en **Describir** (registrar el día). Pero el **Plan** —donde Alex define las opciones que luego registra de un toque— sigue siendo de segunda clase frente al resto de la app: su ✨ (F-IA-3) **no conoce el catálogo** y su editor solo tiene **Manual + ✨**, mientras que el **editor de productos ya tiene Foto · Describir · Manual y unidad `g/ml/ud`** (DECISIONS #72, F10). El insight de Alex: el Plan **no es solo la pauta de Regenera, es su menú operativo recurrente** — las cosas que toma a diario (su café, su merienda) quiere **dejarlas puestas UNA vez** como opción lista, para registrar sin IA repetida ni ir al día a copiar-pegar (P3, la fricción mata el sistema). Hoy, sembrar un producto recurrente en el Plan obliga a re-estimar con IA (que además ignora su etiqueta guardada) o a teclear los macros a mano.

## Alcance (qué hace, en viñetas verificables)
**Fase 1 · El ✨ conoce «Mis productos» (sin migración).**
- La ruta `plan-option` (F-IA-3) carga el catálogo (`listProducts`) y lo inyecta en `planOptionPrompt` como sección **MIS PRODUCTOS** (formato reutilizado de `productsContext`, como F12/F18), solo si hay productos.
- El prompt hace el **reconocimiento semántico** (no el cálculo): si la opción se corresponde con un producto de MIS PRODUCTOS —aunque el texto lo describa de otra forma o el producto forme parte de la preparación, p. ej. la bebida de marca dentro de un café— devuelve en un campo nuevo `producto` el **nombre canónico EXACTO** tal como figura en el catálogo; si no reconoce ninguno, `producto: null` y estima de tablas como hoy. «Exacto» se exige en la **salida canónica**, no en el texto escrito por Alex.
- **El servidor calcula los macros** (diseño B, determinista, reúso de la maquinaria de F18): para la opción con `producto` que empareje por nombre canónico exacto (trim + case-insensitive) con un producto real, el servidor sustituye kcal/macros y, si existe, el **grupo** por los del producto, escalados a los `gramos` que trae la petición desde su base guardada:
  - `baseG != null` y `gramos != null` → factor `gramos/baseG`; macros = base × factor.
  - `baseG != null` y `gramos == null` → ración base (macros = base).
  - `baseG == null` (producto fijo) → macros = base tal cual.
  - Redondeo con los helpers de `lib/macros` (`roundKcal`, `roundMacroStore`).
- Si `producto` no empareja (o es null), la opción se queda **tal como la estimó el modelo** (sin match forzado).
- El **nombre de la opción NO cambia** (lo pone Alex en el editor). Si el producto emparejado tiene `grupo`, prevalece sobre el estimado; si `producto.grupo == null`, se conserva el `grupo` estimado por el modelo (una opción del Plan nunca queda sin grupo).

**Fase 2 · Unidad + sembrar desde «Mis productos».**
- Columna `unit` `g|ml|ud` en `plan_options` (migración aditiva, `not null default 'g'`, mismo patrón que `products.unit` de #72): rótulo de `baseG` y de los steppers, **escala 1:1** (no afecta al reescalado, F06 intacto). La unidad acompaña a la opción en todas sus superficies: listado/editor de Plan, búsqueda universal y «Del plan» en Hoy, Historial y contexto textual de Coach/Chat/Visita. Una opción `ml`/`ud` deja de mentir mostrando `g`.
- Selector **«Mis productos»** explícito en el editor de opciones **sin variantes**: eliges un producto → se **siembra** la opción (**copia**, no vínculo) con sus macros, `unit`, `baseG` y, si existe, `grupo`; si el producto no tiene grupo, se conserva el grupo actual (en una opción nueva, «Opción única»). El nombre toma por defecto el del producto y sigue editable. Puesto una vez, se queda.
- `unit` viaja por el ciclo completo de `plan_options`: DTO/schemas/API, alta/edición, copia al cambiar objetivos (`createVersionWithTargets`), creación de una dieta importada (`createDietVersionFull`, default `g`), Historial, export/restore, `migrate:poc` y `seed`. Round-trip conserva el valor; datos anteriores a F19 y el PoC caen a `g`. 0 pérdidas.

## NO-alcance (qué queda explícitamente fuera y por qué)
- **Foto por-opción**: la dieta entra por **foto → import (F-IA-9, ya existe)** para el grueso; una foto para una sola opción es redundante.
- **Describir por-opción** (textarea «describe la opción»): redundante con el ✨, que ya estima desde el nombre y ahora conoce los productos. Aparcado del parked item *a*; revisitar si se echa de menos en uso real.
- **Variante desde un producto** (un hueco con variantes donde una es un producto guardado): las variantes (F08) quedan **intactas**. Una opción con variantes no tiene una «base» independiente —sus campos planos son la primera variante—, por lo que **no muestra el selector «Mis productos»**; las variantes se siguen añadiendo/estimando con el editor de F08/F09 («Añadir variantes · elegir fuente al registrar» + ✨ por variante). Aparcado, medir necesidad.
- **Vínculo vivo producto↔opción**: es **copia**, no relación persistida (coherente con #67: editar una opción no reescribe lo ya registrado; editar un producto no debe cambiar el plan por sorpresa).
- **Escalado por nº de unidades** (2 fajitas = 2×): reabre el NO-alcance deliberado de F06 (#57). Fuera.
- **Persistir la unidad en `meal_entries`**: F19 modela la unidad de la **opción del Plan** y corrige sus superficies hasta el momento de añadirla; no añade `unit` al registro diario ni cambia la maquinaria de cantidad de F06. Si el rótulo del registro ya horneado muerde en uso real, requiere caso y spec propia.

## Momento de uso (09 §1)
Configuración del Plan (baja frecuencia, alta duración del efecto): se hace una vez y rinde cada día al registrar «Del plan» de un toque. No es un camino del día a día — por eso prioriza **hacerlo bien y dejarlo puesto** sobre la inmediatez.

## Datos (schema/settings; migración; export/restore; migrate:poc)
- **Fase 1: sin migración.** El campo `producto` es efímero (salida de IA, no se guarda); `planOptionAiZ` gana `producto: z.string().nullable().default(null)`.
- **Fase 2: migración aditiva** `plan_options.unit` (`product_unit` enum ya existe, `not null default 'g'`). Arrastra `PlanOptionDTO`, schemas/input/API, CRUD, copia de versión al cambiar objetivos, dieta importada, Historial, **export/restore round-trip + `migrate:poc` + `seed`**. El round-trip conserva `g|ml|ud`; entradas previas y PoC usan default `g`. 0 pérdidas.

## Flujo (dónde vive según 09)
Editor de opciones del Plan (`plan-client.tsx` · `OptionForm`), tal como está hoy (inline en la pestaña Plan). Fase 1 no cambia la UI (mejora la calidad del ✨). Fase 2 carga el catálogo junto al contexto de Plan y añade al editor: (a) selector de unidad junto a la base (como el editor de producto); (b) en opciones sin variantes, un camino **«Mis productos»** que siembra los campos. Si no hay productos, el camino se omite; si la opción tiene variantes, tampoco aparece. `unit` rotula además la fila del Plan y los steppers de búsqueda universal/«Del plan» en Hoy, y se representa correctamente en Historial y los resúmenes de contexto IA. Las variantes (F08/F09) y su editor no cambian.

## IA (prompt, modelo, esquema, error, coste)
- **Modelo/pensamiento:** sin cambios — F-IA-3 `kind: "text"`, `task: "estimate"` (Gemini, thinking low, `temperature 0`), `maxOutputTokens: 2048`.
- **Prompt CONGELADO** (`planOptionPrompt`): la redacción exacta la fija el implementer y la cubre `prompts.test.ts`. Debe (a) interpolar la sección MIS PRODUCTOS con `productsContext(products)` solo si no está vacía; (b) instruir reconocimiento semántico aunque el texto describa el producto de otra forma o dentro de una preparación, devolviendo su **nombre canónico EXACTO** en `producto`, o `producto: null` si no reconoce ninguno; (c) explicitar «no recalcules los macros de un producto: solo identifícalo»; (d) añadir `"producto": string|null` al JSON de salida. Regla de la casa: tras editar → re-validar AC de F-IA-3 (+ café ×3, DECISIONS #65) y sincronizar `04-IA.md` solo si cambió esquema/modelo/coste/AC/doctrina (DECISIONS #70). **El añadido es análogo a F18** (mismo contrato de reconocimiento semántico + nombre canónico exacto).
- **Esquema de salida:** `planOptionAiZ` con el campo `producto` añadido.
- **Lógica pura:** reúso de `applyProductMatches` (F18, `server/ai/product-match.ts`) adaptado a opción única — o un helper hermano si la forma difiere (una opción, no lista; sin `gramos` en la salida → se escala a los `gramos` de la petición). Ni una fórmula en la ruta ni en el componente.
- **Error:** sin cambios (la carga del catálogo entra en el `Promise.all`/secuencia con `retry`; falla de BD → `serverError`, falla de IA → `aiErrorResponse`).
- **Coste:** despreciable (catálogo = pocas líneas, mismo que F12/F18; Gemini Flash).

## Impacto en Coach/Chat/Visita
- **Chat/Coach/Visita:** sin cambio de comportamiento, prompt ni llamada. Ya conocen el plan (planSummary/planOptionsList con macros por opción, #56); esos formateadores pasan a rotular la ración con `unit` en vez de asumir `g`. Sembrar mejor una opción mejora el dato que ya consumen.

## AC (numerados; 🖐 = valida Alex con el pulgar)
**Fase 1**
1. Con *Bebida de almendras Lidl 0%* guardado (250 g = 40 kcal · 1,8P/0C/3,5F), crear una opción de plan llamada «Café con leche con almendras 0%» y pulsar ✨ → el modelo reconoce semánticamente la bebida aunque el texto no sea idéntico, devuelve el nombre canónico exacto y el servidor aplica macros **escaladas desde la base del producto** (a 250 g: 40 kcal · 2P/0C/4F redondeado en UI; grupo del producto), no la estimación genérica de 32 kcal. **Caso canónico de regresión** en `prompts.test.ts` / test de lógica. 🖐 **Validado por Alex el 26-jul** (entrada real sin `%`: «Café con leche con almendras 0»).
2. Una opción que **no se corresponde semánticamente** con ningún producto se sigue estimando de tablas como hoy (sin match forzado). Caso en test.
3. Catálogo vacío → el prompt omite la sección MIS PRODUCTOS y el ✨ se comporta exactamente como antes. Caso en test (espejo de `productsContext([])`).
4. Producto fijo (`baseG == null`) que empareja → macros base tal cual. Caso en test.
5. `producto` devuelto que no existe en el catálogo (nombre inexacto) → se ignora, estima del modelo. Caso en test.
6. Producto emparejado con `grupo == null` → conserva el grupo estimado por el modelo; nunca devuelve una opción sin grupo. Caso en test.

**Cierre Fase 1 (26-jul):** AC1 aprobado por Alex tras corregir candidatos solapados
(bebida Lidl específica frente al café genérico guardado); casos directo y contrario 3/3,
café F-IA-3 ×3 = 70/70/70, `pnpm typecheck` + 427 tests verdes. Sin migración/env/backfill.

**Fase 2**
7. El editor muestra selector `g/ml/ud`; una opción `ml/ud` rotula con esa unidad (no `g`) el listado/editor de Plan y los steppers de búsqueda universal/«Del plan» en Hoy. Historial y los contextos de IA tampoco asumen `g`. Escala 1:1 (F06 intacto). 🖐
8. En una opción sin variantes, «Mis productos» la siembra (macros, unidad, baseG y grupo si existe; nombre = producto, editable) — **copia**: editar luego el producto NO cambia la opción. Producto sin grupo conserva el grupo actual. Caso en test + 🖐.
9. Una opción con variantes no muestra «Mis productos»; sus variantes y campos planos permanecen intactos y se siguen gestionando con F08/F09. Caso en test + 🖐.
10. Round-trip export→restore conserva una opción `ml/ud`; un export anterior a F19 y `migrate:poc` producen `unit: "g"`. Casos en `backup.test.ts`/mapeo PoC.
11. Cambiar objetivos copia las opciones a la nueva versión conservando `unit`; una dieta nueva importada sin unidad usa `g`. Caso en test.

**Ambas**
12. `pnpm typecheck && pnpm test` en verde; AC de F-IA-3 re-validados tras tocar el prompt (+ café ×3, DECISIONS #65).

## Riesgos / decisiones discutibles
1. **Sobre-emparejamiento (ley del péndulo).** El modelo puede reconocer semánticamente una mención distinta, pero el servidor solo acepta el **nombre canónico exacto** devuelto y presente en el catálogo. Un canónico inventado/inexacto no empareja (AC5).
2. **Reconocimiento del modelo vs. cálculo del servidor.** Diseño B a propósito (idéntico a F18): el modelo reconoce «Bebida de almendras Lidl» dentro de «Café con leche…» y devuelve el canónico exacto; el servidor valida ese canónico y calcula (P2 + determinismo). El modelo puede rellenar kcal/macros pero el servidor los **sobrescribe** en la opción emparejada.
3. **Unidad = migración por un rótulo.** Justificada porque al sembrar productos `ml`/`ud` en el Plan la unidad deja de ser cosmética (una opción de bebida en `g` mentiría). Aditiva y trillada (patrón #72). Si Fase 2 se pospusiera, Fase 1 ya resuelve el caso disparador sin migración.
4. **Copia, no vínculo.** Predecible y coherente con #67/#7; el coste es que actualizar un producto no propaga al Plan (aceptable: el Plan se edita poco y a mano).

## Fases
- **Fase 1 — ✨ product-aware (sin migración):** (1) `producto` en `planOptionAiZ` + lógica pura de match (reúso F18) con tests; (2) `planOptionPrompt` sección + instrucción + `prompts.test.ts`; (3) cablear ruta `plan-option` (cargar catálogo + aplicar match); (4) typecheck + test + re-validar AC F-IA-3 (café ×3). Cierra el caso disparador.
- **Fase 2 — Unidad + sembrar desde productos (migración):** (1) migración `plan_options.unit` + propagación por DTO/schemas/API, CRUD, copia de versión, dieta importada, Historial, export/restore/migrate:poc/seed con tests; (2) formateadores y consumidores de la opción (Plan, búsqueda/«Del plan», contexto IA) usan `unit`; (3) UI del editor (selector unidad + «Mis productos» solo sin variantes, con fallback de grupo); (4) typecheck + test + AC 🖐.
