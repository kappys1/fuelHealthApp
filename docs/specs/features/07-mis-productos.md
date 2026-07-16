# F07 · Mis productos (favoritos con etiqueta que reescalan)
**Estado**: propuesta · **Tamaño**: feature (migración + prompt IA nuevo + capa de sheet)
**Fecha**: 2026-07-16 · **Origen**: caso real 16-jul — Alex compara su día en MyFitnessPal
vs Fuelboard: 1.910 vs 1.664 kcal. Al abrirlo ítem a ítem, la diferencia es casi toda **una
entrada rota de MFP** (pollo 210 g con 97 g de proteína — imposible; ahí acierta Fuelboard)
**+ un corte de carne ambiguo** ("picada magra": 28 g grasa MFP vs 12 g nuestro). Los
genéricos (arroz, verduras, sandía) cuadran dentro del ruido. Alex: «estaría bien tener una
base de datos de productos que suelo comer, con su etiqueta, para no equivocarnos».

## Motivación (caso real)
Los favoritos de hoy son **una foto congelada de la estimación** del día que se guardaron
(no de la etiqueta), **no tienen `baseG` → no reescalan** (único tipo de entrada que no lo
hace), **no se pueden editar** y **no saben de dónde salieron**. Resultado: un producto que
Alex come a diario (tortitas Hacendado, picada Combino) arrastra para siempre un error viejo
y mete **ruido aleatorio** cada vez que se re-estima por otra vía.

La justificación NO es "precisión" pura — el sesgo constante lo absorbe la báscula
(principio 1). Es doble y más sólida:
- **Fricción** (principio 3): fijar los productos repetidos = un toque, sin re-estimar.
- **Ruido, no sesgo** (principio 2): re-estimar un producto conocido introduce varianza
  *aleatoria* (224 vs 238 kcal), y el principio 2 dice literal que **ese ruido la báscula NO
  lo absorbe**. Un producto fijado desde su etiqueta tiene **ruido cero para siempre**.

## Alcance (qué hace)
- Convierte el concepto **"favorito" en "producto"**: **un solo concepto**, editable,
  **agnóstico de comida**, con macros **por base de gramos** (`baseG`, típicamente 100 g de
  la etiqueta) que **reescalan** al añadirlo (reusa `scaleMacros`/`entryBaseFields` de F06).
- **Fuente del dato = la etiqueta del envase**: foto de la tabla nutricional → la IA la lee
  por 100 g → **Alex confirma/edita** → se fija (F-IA-11, fase 2). También **entrada manual**.
- **Catálogo editable** (buscar · ✎ · 🗑 · ＋ Nuevo) como **capa del sheet de Añadir**
  (`Ver todos →` y **pulsación larga en un chip** → editar ese producto).
- El ⭐ (pin) marca qué productos salen como **chips de acceso rápido** en el sheet.
- **Migración de los favoritos actuales** a productos (`source: legacy`, fijos, editables) —
  0 pérdidas; se "ascienden" re-fotografiando cuando se quiera (badge «antiguo»).
- **Editar un producto NO reescribe entradas ya registradas** (macros horneadas por día).

## NO-alcance (qué queda fuera y por qué)
- **NO** integración de bases de datos externas (USDA/BEDCA/OpenFoodFacts) como fuente de
  estimación. Motivo (discutido y cerrado 16-jul): USDA/BEDCA son **genéricos** (no tienen
  productos de marca; arreglan lo que ya funciona); OpenFoodFacts es **colaborativo** (la
  basura de MFP otra vez) y **editado en vivo** (reintroduce ruido → viola principio 2). La
  foto de la etiqueta es la **fuente autorizada** (valor declarado por el fabricante del
  producto exacto) y **le gana a las tres**.
- **NO** escáner de código de barras en esta feature → **backlog** (HANDOFF §B3): solo como
  *entrada más rápida* que prerrellena el formulario (nunca como verdad), a decidir **tras
  usar la foto de etiqueta** y medir si enfocar la tabla molesta (regla anti-optimización-
  sin-medición).
- **NO** entrada en Ajustes en el MVP: la edición vive en el momento de uso (sheet). Se
  añade un acceso "en frío" en Ajustes **solo si** Alex echa de menos el repaso en bloque.
- **NO** reescritura retroactiva de días pasados al editar un producto (principio 7).

## Momento de uso (09 §1)
Alta frecuencia, **dentro del registro de comida** (no en frío): al añadir una comida y ver
que un producto está mal → se edita ahí mismo; al comprar algo nuevo → ＋ Nuevo desde el
sheet. Por eso la casa es el **sheet de Añadir** (09 §6: toda edición es sheet, no página),
no Ajustes.

## Datos
- **Nueva tabla `products`** (evoluciona `favorites`):
  `id`, `name` (unique), `baseG int|null` (base de las macros; `null`/0 = fijo, sin stepper),
  `baseKcal int`, `baseProt real`, `baseCarb real`, `baseFat real`, `grupo grpKey|null`,
  `source` enum `'etiqueta'|'manual'|'legacy'`, `pinned boolean` (chip de acceso rápido),
  `createdAt`, `updatedAt`.
- **Migración versionada** (0 pérdidas, principio 7):
  1. crear `products` (+ enum `product_source`);
  2. copiar cada `favorites` → `products` con `source:'legacy'`, `baseG:null` (fijo),
     `pinned:true` (siguen saliendo como chips), `grupo:null`;
  3. **colisión de nombre** (favoritos eran únicos por `(meal,name)` → el mismo nombre puede
     estar en 2 comidas): dedupe por `name`, conservar el más reciente (mayor `id`), anotar
     descartes en el log de la migración;
  4. `favorites` queda **deprecada** (se elimina tras verificar en prod; no se lee ya).
- **Export/restore**: añadir `products` al dump y al restore (y `migrate:poc` si el PoC trae
  favoritos). Actualizar `lookups.ts` (`listFavorites`→`listProducts` + `FavoriteDTO`).

## Flujo (dónde vive según 09)
- **Sheet de Añadir → HomeLayer**: la sección "Favoritos" pasa a **"Mis productos"** (chips
  de los `pinned`, agnósticos de comida). Tocar chip → **capa stepper** (gramos, reescala,
  patrón F06) → Añadir a {comida actual}.
- **`Ver todos →`** (y pulsación larga en chip) → **capa "Mis productos"**: lista editable
  (buscar · ✎ · 🗑 · ⭐ pin) + **＋ Nuevo producto**.
- **＋ Nuevo producto** → capa editor: `📷 Foto de la etiqueta` (fase 2, F-IA-11) **o** a
  mano → formulario (nombre, base_g, kcal/P/C/G por base, grupo) con aviso «estos números se
  fijan» → Guardar.
- Mockup de referencia: `docs/mockups/mis-productos.html`.

## IA (fase 2)
**F-IA-11 · Leer etiqueta nutricional de un producto** — `POST /api/ai/label-read`,
body `{ files:[{base64,mediaType}] }` (foto/HEIC→JPEG; reusa infra de visión F-IA-1/9).
Modelo de visión (`AI_MODEL`), determinismo por proveedor (Anthropic `temperature:0`; Gemini
`thinkingLevel` según 04-IA §config), Zod + 1 reintento, **errores IA visibles**. Es una
**LECTURA, no una estimación** (disciplina distinta: null si no figura, jamás inventar).
Prompt **CONGELADO** (a añadir a `04-IA.md` como F-IA-11, se usa TAL CUAL, solo interpolando):

> {ATHLETE_CONTEXT compacto} Eres un nutricionista. Esta imagen es la ETIQUETA / tabla de
> información nutricional de UN producto envasado. Extrae el nombre comercial del producto
> (corto, con marca si se ve; ej. "Tortitas integrales Hacendado") y sus valores TAL COMO
> FIGURAN en la etiqueta, SIN recalcular: la base sobre la que se expresan ("por 100 g", "por
> 100 ml" o "por ración/unidad"), los gramos de esa base (100 si es por 100 g/ml; la ración
> en g si solo la da por ración; null si es por unidad sin peso), y kcal, proteína, hidratos
> y grasa de esa base. Clasifícalo en un grupo: "Hidratos", "Proteína", "Verdura", "Grasa" u
> "Otros". Si un valor NO aparece en la etiqueta, devuelve null (NUNCA lo inventes ni lo
> estimes). Responde SOLO con JSON válido, sin markdown: {"nombre": string, "base_g":
> number|null, "kcal": number|null, "proteina_g": number|null, "carbohidratos_g":
> number|null, "grasa_g": number|null, "grupo": string}

Coste: uso puntual (crear/actualizar producto), volumen bajo → despreciable (< céntimos/mes).

## Impacto en Coach/Chat/Visita
**Ninguno en su contexto.** Las entradas del día ya llevan sus macros horneadas; el Coach/
Chat/Visita leen entradas, no productos. El catálogo de productos NO entra en sus prompts (no
lo necesitan). Blast radius de IA acotado → sin regresión de guardarraíles.

## AC
1. Un producto con `baseG` reescala al añadirlo (80 g de un producto de 100 g = 0,8× sus
   macros; test de lógica sobre `scaleMacros`/`entryBaseFields`).
2. Producto con `baseG:null` se añade fijo (sin stepper), como hoy.
3. La migración `favorites→products` no pierde ninguna fila; colisiones de nombre dedupeadas
   y logueadas (test de la migración con fixture de favoritos en 2 comidas).
4. Export incluye `products`; restore los recrea idénticos (test de round-trip).
5. Editar un producto **no** cambia las macros de entradas ya registradas en días pasados.
6. ✅ (🖐 validado por Alex en prod, 2026-07-16) En el sheet, "Mis productos" muestra los
   `pinned` agnósticos de comida; tocar → stepper → Añadir a la comida en curso.
7. ✅ (🖐 validado por Alex en prod, 2026-07-16) `Ver todos →` / pulsación larga abre el
   catálogo editable (✎ · 🗑 · ⭐ · ＋ Nuevo). (Undo del borrado = banner inline, DECISIONS #64.)
8. 🖐 (fase 2) ＋ Nuevo → foto de etiqueta → la IA rellena el formulario → Alex confirma/edita
   → se guarda con `source:'etiqueta'`.
9. (fase 2) F-IA-11: leer una etiqueta real ×3 da lectura consistente y **null donde el dato
   no figura** (no inventa); su AC propio validado antes del cierre (regla CLAUDE.md al
   añadir prompt). El café ×3 (DECISIONS #65) **no aplica** (no toca prompts de estimación).

## Riesgos / decisiones discutibles
- **Colisión de la migración** (mismo nombre en 2 comidas): se dedupe por nombre y se
  conserva el más reciente. Alternativa (mantener ambos con sufijo) = más ruido; descartada.
- **Productos por unidad** (tortitas, huevos): `base_g` puede ser los gramos de la ración
  típica (editable) o `null` (fijo por unidad). La IA devuelve `null` si la etiqueta es por
  unidad; Alex ajusta en el confirm.
- **Calidad OCR de la etiqueta**: el paso de **confirmar es obligatorio** (aviso «estos
  números se fijan»); F-IA-11 nunca guarda sin revisión.

## Fases
- **Fase 0 · Datos** (devuelve la base sagrada): tabla `products` + migración de favoritos +
  export/restore + `migrate:poc`. Tests de migración y round-trip. Sin UI aún. Deploy.
- **Fase 1 · Uso** (devuelve editar + reescalar + no re-guardar): sheet usa productos
  (chips agnósticos + stepper), capa "Mis productos" editable (CRUD + pin), entrada manual.
  Deploy.
- **Fase 2 · Foto** (devuelve el flujo C): F-IA-11 (nuevo prompt en 04-IA.md) → editor
  prerrellenado. Re-validar AC 9. Deploy.
- **Backlog** (HANDOFF §B3): escáner de código de barras como entrada rápida (medir primero).

## Prompt estándar de arranque (para Alex, copiar/pegar)
> Implementa `docs/specs/features/07-mis-productos.md` (aprobada) según las Etapas 4-6 del
> proceso. Fase a fase (0→1→2), AC uno a uno, y déjame los 🖐 pendientes de validar con el
> pulgar en producción.
