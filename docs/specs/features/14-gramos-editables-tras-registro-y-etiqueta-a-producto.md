# F14 · Gramos editables tras registrar + la foto detecta etiqueta → producto
**Estado**: aprobada · **Tamaño**: feature
**Fecha**: 2026-07-25 · **Origen**: uso real de Alex (25-jul) sobre `feat/wellness-premium-v2`.
Fotografió la **etiqueta nutricional** de una bolsa de patatas con el botón **«Foto»** del sheet
Añadir (F-IA-1, analizador de platos): agarró la columna de la ración («25 g» → 130 kcal ·
1,7P/12,4C/8,8F) como si fuera un plato, y al editar la entrada **no puede tocar los gramos**.
Quejas literales: *«post registrar este tipo de eventos con etiquetas… normalmente añadir una
comida por ejemplo… luego no puedo modificar los gramos»* y *«no entiendo por qué no guarda los
gramos y si quiero modificarlo que se haga la referencia»*.

## Motivación (caso real)
Dos problemas distintos, y el primero es el que duele:

- **P2 · edición (prioritario).** Una entrada ya registrada NO se puede reescalar por gramos al
  editarla — solo deja tocar macros a pelo. Pasa con etiquetas y con comidas normales. El
  editor solo muestra el stepper **Cantidad** si la entrada guardó una *base por gramo*
  (`meal-row.tsx:165`, condición `scalable`); las metidas a mano / por «Describir» / algunas de
  foto no la tienen → sin base desde la que reescalar.
- **P1 · entrada (complemento).** La app YA sabe leer etiquetas y crear productos escalables —
  **Añadir → Nuevo producto → «Foto de la etiqueta»** (F-IA-11, `add-sheet.tsx:1636`
  `pickLabel`; prompt `labelReadPrompt` `prompts.ts:404`) — pero hay **dos puertas de foto
  confundibles** en el mismo sheet y la equivocada (analizador de platos) tiene éxito en
  silencio con una etiqueta. Falta el **puente** que te lleve sola a la puerta correcta
  reusando la foto que ya hiciste.

Alex confirmó (25-jul): Parte A **casos 1 y 2** (el 3 fuera por ahora) + Parte B.

---

## Parte A · Gramos editables tras registrar (P2 · casos 1 y 2) — Fase 1

### Alcance
- En `EditForm` (`meal-row.tsx:142`) calcular una **base efectiva**:
  - **Caso 1** — `entry.baseG` + `entry.base*` presentes → esa base (como hoy).
  - **Caso 2** — sin base pero `entry.grams != null && entry.grams > 0` → base = las macros
    ACTUALES de la entrada (`entry.kcal/prot/carb/fat`) a `baseG = entry.grams`. Mismo criterio
    que `backfillEntryGrams` (`macros.ts:145`) pero desde el campo `grams`, no desde el sufijo
    del nombre.
- `scalable` pasa a ser «hay base efectiva» → el stepper **Cantidad** aparece también en el
  caso 2. `onGrams` (`meal-row.tsx:172`) usa la base efectiva y reescala con `scaledForStore`
  (ya existe, sin cambios).
- **Al guardar**, persistir `grams` + la base efectiva (`baseG/baseKcal/baseProt/baseCarb/
  baseFat`) → la entrada queda **«sanada»**: la próxima vez es caso 1 nativo. El PATCH ya admite
  esos campos (`schemas.ts:52-54`); hoy el editor no los manda (`meal-row.tsx:233`) → añadirlos
  al patch **solo cuando se derivaron** (caso 2) o cuando ya existían (caso 1).
- **Caso 3** (sin base y sin gramos, p. ej. «cena a ojo, 700 kcal») → `scalable` false → solo
  macros, como hoy. **Fuera de alcance** (decisión de Alex «con 1 y 2 me vale por el momento»).

### Verificación durante la implementación (posible bug adyacente)
Comprobar por qué una entrada de **foto de comida** (F-IA-1) no siempre persiste `baseG` aunque
la IA devuelva `gramos` (`add-sheet.tsx:916`, tercer arg `r.it.base.gramos || null`). Si es un
bug, arreglarlo hace que esas entradas caigan directas en el **caso 1**; si no, caen en el
**caso 2** (también cubierto). La entrada concreta que motivó esto puede haber quedado sin
`grams` (caso 3) → se re-añade limpia por la Parte B; NO es objetivo migrar entradas viejas.

### Datos
Sin migración de BD: los campos `grams/baseG/base*` ya existen en `meal_entries`
(`schema.ts:207-212`). La base se deriva al vuelo y se persiste al guardar. Sin impacto en
export/restore ni `migrate:poc`.

### AC — Parte A
- **A1.** Entrada con base (plan/catálogo) → stepper **Cantidad** como hoy; reescala. ✅ (validado por Alex, 25-jul).
- **A2.** Entrada con gramos pero sin base (foto/estimación con cantidad) → al editar **aparece**
  el stepper Cantidad; cambiar gramos reescala macros proporcionalmente (25 g→50 g duplica). ✅ (validado por Alex, 25-jul).
- **A3.** Tras guardar una entrada del caso 2, **reabrirla** muestra el stepper directamente
  (quedó sanada → caso 1). ✅ (validado por Alex, 25-jul).
- **A4.** Entrada sin gramos (caso 3) → sigue **solo-macros**, sin stepper. ✅ (validado por Alex, 25-jul).
- **A5.** Regresión: los totales del día cuadran con la suma visible tras reescalar; `pnpm test`
  verde. Test de lógica de la base efectiva (función pura) antes que la UI. ✅

---

## Parte B · La foto de comida LEE la etiqueta (una lectura, dos destinos) — Fase 2

> **Enmienda 2026-07-25** (feedback de uso real de Alex sobre la 1ª implementación): el diseño
> original *ocultaba* las filas al detectar etiqueta (`items: []`) y forzaba una **2ª llamada** a
> la IA para leerla como producto. Alex: *«una etiqueta, al igual que es una comida, ya me da la
> info para introducirla directamente… en este análisis debería hacer exactamente lo mismo y
> luego, si le digo como producto, sería pasar esos macros y no reanalizar»*. La Parte A ya hace
> escalable una entrada con gramos, así que registrar la ración de una etiqueta como comida ya
> «funciona bien». Reescrito abajo: **una sola lectura sirve para añadir como comida Y para
> guardar como producto sin re-llamar a la IA.**

### Alcance
- **Lectura en F-IA-1** (prompt CONGELADO, ver §IA): si la imagen es una etiqueta, la IA la
  **lee** (no la vacía): devuelve `es_etiqueta: true`, en `items` **la ración** que indica la
  etiqueta (nombre + `gramos` + macros de esa ración, tal cual) y en `producto` los valores
  **por 100 g** (`base_g:100` + macros por 100 g). Comida real → `es_etiqueta:false`,
  `producto:null`, análisis normal. `photoResultZ` gana `es_etiqueta:
  z.boolean().nullable().default(false)` y `producto: photoProductoZ.nullable().default(null)`
  (defensivos: ausentes = comportamiento de hoy). Sync a `04-IA.md`.
- **UI en `PhotoLayer`**: las filas se muestran **siempre** (también para una etiqueta) → se
  puede **añadir como comida** directamente, y son **escalables** por la Parte A. Cuando
  `es_etiqueta && producto`, además una **afordance fina** sobre los botones de añadir:
  *«📷 Es una etiqueta. Puedes añadirla como comida o guardarla como producto (por 100 g).»* +
  botón **«Guardar producto»**.
- **Guardar como producto SIN 2ª llamada**: «Guardar producto» abre **Nuevo producto**
  **prerelleno con `result.producto`** (nombre + por 100 g, `baseG=100`, `source:'etiqueta'`,
  aviso «La IA leyó la etiqueta»). Reusa los macros ya leídos; **no reanaliza**. `openEditor`
  acepta un `prefill` de datos (antes: una imagen para auto-leer); `ProductEditorLayer` recibe
  `initialFields` y arranca en `method="manual"` con el formulario relleno. **Nada se auto-guarda.**
- **Sin escape hatch**: al mostrar siempre las filas, un falso positivo ya no bloquea (se añade
  como comida igual). Se retira el enlace «No, es comida» (confundía y ya no aporta).

### IA (F-IA-1 · prompt CONGELADO — la redacción manda: `server/ai/prompts.ts`)
- **Modelo** y **`temperature: 0`**: sin cambios. La lectura de la etiqueta va **dentro** de
  `photoPrompt` (una sola llamada); F-IA-11 (`labelReadPrompt`) sigue existiendo para la puerta
  manual «Nuevo producto → Foto de la etiqueta».
- **`photoPrompt` (`prompts.ts:107`)** — texto CONGELADO del `return` (cubierto en
  `prompts.test.ts`):

  > `${args.contexto} Eres un nutricionista deportivo. Analiza la foto de esta comida ("${mealLabel}") ${planContext} Identifica CADA alimento por separado, estima su ración en gramos y sus macros. Pero si la imagen es una ETIQUETA o tabla de información nutricional de un producto envasado (con valores de energía y macros impresos «por 100 g» y/o «por ración»), LÉELA en vez de estimar: devuelve "es_etiqueta": true; en "items" UN item con la ración que indique la etiqueta (nombre del producto, "gramos" = la ración en g —o 100 si la etiqueta no da ración— y kcal/macros de ESA ración tal como figuran); y en "producto" los valores POR 100 g de la etiqueta ("base_g": 100 y kcal/macros por 100 g), leídos tal cual, sin estimar. En cualquier otro caso (comida real en un plato, en la mano, en un envase abierto, etc.) devuelve "es_etiqueta": false, "producto": null y analízala con normalidad.${noteClause} ${verdict} Responde SOLO con JSON válido, sin markdown ni texto extra: {"items": [{"nombre": string corto SIN gramos (ej. "Hamburguesa ternera magra"), "gramos": number (ración estimada en g o ml), "kcal": number, "proteina_g": number, "carbohidratos_g": number, "grasa_g": number}], "es_etiqueta": boolean, "producto": {"nombre": string, "base_g": number, "kcal": number, "proteina_g": number, "carbohidratos_g": number, "grasa_g": number}|null, "encaja_plan": boolean|null, "comentario": string breve}`

- **Esquema**: `photoResultZ` + `es_etiqueta: z.boolean().nullable().default(false)` +
  `producto: photoProductoZ.nullable().default(null)` (`photoProductoZ` = nombre + base_g +
  kcal/proteina_g/carbohidratos_g/grasa_g).
- **Coste**: **1 sola llamada** F-IA-1 en todos los casos (leer la etiqueta o analizar comida).
  «Guardar como producto» reusa los valores ya leídos → **sin 2ª llamada**. (La puerta manual
  «Nuevo producto → Foto de la etiqueta» sigue siendo su propia llamada F-IA-11.)

### AC — Parte B (enmienda)
- **B1.** Foto de una **etiqueta** (p. ej. la bolsa de patatas) → `es_etiqueta: true`, `items`
  con la ración e `producto` con los valores por 100 g; la UI muestra las **filas** (añadibles
  como comida, escalables) + la afordance **«Guardar producto»**. ✅ (validado por Alex, 25-jul).
- **B2.** Foto de un **plato real** → `es_etiqueta: false`, `producto: null`; comportamiento
  actual intacto. ✅ (validado por Alex, 25-jul).
- **B3.** «Guardar producto» abre **Nuevo producto** **prerelleno por 100 g** (`baseG=100`,
  `source:'etiqueta'`, aviso «La IA leyó la etiqueta») **sin re-llamar a la IA**. ✅ (validado por
  Alex, 25-jul).
- **B4.** Tras guardar ese producto y añadirlo al día, la entrada es **escalable** (stepper
  Cantidad al editar; reescala). Igualmente, **añadir la etiqueta como comida** desde las filas
  produce una entrada escalable. ✅ (validado por Alex, 25-jul).
- **B5.** *(Retirado en la enmienda: ya no hay escape hatch; las filas se muestran siempre.)*
- **B6.** Regresión: `pnpm test` verde, con 2 casos canónicos nuevos en `prompts.test.ts`
  (etiqueta → `true`/`[]`; plato → `false`) y el resto de F-IA-1 sin cambios.

---

## NO-alcance (global)
- **Caso 3** de la Parte A (entradas sin gramos): siguen solo-macros. Por ahora.
- **No fusionar las dos puertas de foto**: «Foto» (plato) y «Foto de la etiqueta» siguen
  separadas; la Parte B solo pone el puente al equivocarte.
- **No migrar entradas viejas** ni persistir `es_etiqueta` en BD (señal transitoria).

## Momento de uso (09 §1)
**Registrar** — sheet Añadir de Hoy y su editor de entrada. Frecuencia: recurrente (Alex
registra productos de marca con etiqueta y ajusta cantidades a posteriori).

## Flujo (09 §6)
Todo dentro del **bottom-sheet Añadir** y su sheet de **editar entrada**; no se crea pantalla ni
tarjeta nueva. Parte B reusa la capa Nuevo producto existente. Una decisión por paso.

## Impacto en Coach/Chat/Visita
Ninguno directo. Parte A ajusta macros/gramos de una entrada (el contexto de IA ya lee las
entradas del día). Parte B produce un producto que fluye a Mis productos → contexto por el
camino de F07 (`context.ts`), ya existente. No añade instrucciones a prompts de coach/chat/visita.

## Riesgos / decisiones discutibles
1. **Base efectiva desde macros actuales (caso 2)**: el reescalado es **lineal** desde la
   cantidad registrada. Para una etiqueta es exacto (los 25 g vienen de la etiqueta, no de un
   ojo). Para una estimación de plato es una aproximación razonable (doblar gramos ≈ doblar
   macros). Asumido.
2. **Doble llamada IA** en la Parte B por la puerta equivocada. Céntimos; solo ese caso.
3. **Detección de etiqueta**: `temperature:0` + distinción visual clara → falsos raros. Falso
   positivo → escape hatch; falso negativo → degrada al comportamiento de hoy, no empeora.

## Fases
- **Fase 1 · Parte A** (tu dolor): base efectiva + stepper + sanado al guardar + tests. 1 sesión.
- **Fase 2 · Parte B** (complemento): `es_etiqueta` + prompt + `prompts.test.ts` → banner →
  passthrough. 1 sesión.

Orden: lógica antes que UI en cada fase; `pnpm typecheck && pnpm test` verde antes de cada commit.
