# F08 · Variantes de opción del plan (elegir la fuente al registrar)
**Estado**: implementada (Fase 1 · AC1/AC3 🖐 pendientes) · **Tamaño**: feature
**Fecha**: 2026-07-16 · **Origen**: idea Alex 16-jul — «al importar la dieta, líneas como
"Carne magra (pollo/pavo/ternera/cerdo)" se meten como un ítem con macros medias, pero cada
fuente tiene kcal/macros distintas; quiero poder ajustar según la que comí».

## Motivación (caso real)
La pauta de Regenera escribe un solo hueco intercambiable ("210 g de carne magra:
pollo/pavo/ternera/cerdo, en crudo"). El importador (F-IA-9) crea **una** fila con macros
medias estimadas, y al registrar desde el plan (`PlanOptionRow`) se copian esas medias comas
lo que comas. Alex lo comprobó registrando un día real: 210 g de pavo ≈ 225 kcal vs 210 g de
cerdo ≈ 305 kcal → **~80 kcal de swing en un solo ítem**, distinto cada día.

Esto es **ruido aleatorio, no sesgo constante**: la calibración por peso (principio 1) absorbe
un sesgo fijo, pero no el "hoy pollo / mañana ternera". Es justo el ruido que el principio 2
quiere evitar. Hay caso de precisión real, no teatro.

## Alcance
- **El plan sigue siendo espejo de la pauta** (principio 8): "carne magra" es **una** opción,
  no cuatro. La precisión se resuelve al **registrar**, no llenando el plan de filas.
- `plan_options` gana una columna `variants` (jsonb, **migración aditiva**): lista de
  `{ nombre, kcal, prot, carb, fat }`, macros **para los gramos pautados** (`base_g`) de la
  opción. Lista vacía = opción normal sin variantes (comportamiento de hoy, intacto).
- Los campos planos de la opción (`kcal/prot/carb/fat`) siguen existiendo y, cuando hay
  variantes, **valen los de la primera variante** (el default). Así el editor del plan muestra
  un número real y las filas sin variantes no cambian.
- **Importador (F-IA-9)**: detecta cuándo una opción agrupa alimentos intercambiables con
  macros materialmente distintas y rellena `variantes`; conserva el nombre tal cual la pauta.
- **Selector de variante al registrar** (`PlanOptionRow`, sheet de Hoy): si la opción tiene
  variantes, chips encima del stepper (p. ej. "Pollo · Pavo · Ternera · Cerdo"); al tocar,
  cambian las macros mostradas y las que se guardan. Los gramos siguen escalando (F06) desde
  la variante elegida. Default: la primera. Solo aparece en opciones con variantes.
- **export/restore** (`backup.ts`) y **`migrate:poc`** transportan el campo `variants` (los
  export del PoC no lo traen → default `[]`).

## NO-alcance
- **Foto / Describir / Volcado del día** NO llevan selector: ahí describes/fotografías el
  alimento concreto y la IA ya lo estima (el selector es solo del camino "añadir desde el
  plan").
- **Editar variantes a mano** en el editor del plan (sin reimportar) → **Fase 2, aplazable**.
  El importador es el camino principal; la vista previa del import ya es editable para
  corregir antes de crear la versión.
- **NO** se generan variantes para formas de cocinado/preparación ("verdura vapor/plancha/
  ensalada", "arroz hervido") ni cuando las macros son casi iguales.
- No se recuerda la última variante elegida (estado extra); a revisar con uso real.

## Momento de uso (09 §1)
Registrar comida desde el plan — momento "registro rápido del día", varias veces al día.
Vive en el bottom-sheet de añadir de Hoy (09 §6: creación/edición en sheet, no página).

## Datos
- **Migración aditiva**: `plan_options.variants` jsonb `not null default '[]'`. Sin pérdida
  (principio 7). Filas existentes → `[]` (opción normal).
- `base_g` no cambia: los gramos pautados son del hueco, comunes a todas las variantes; cada
  variante guarda sus macros a ese `base_g`. El escalado por gramos funciona igual que hoy.
- **export/restore**: añadir `variants` al mapeo de filas de `planOptions` (`backup.ts`
  ~L253) — round-trip completo. **`migrate:poc`**: `variants` opcional/default `[]`.

## Flujo
1. **Import** (bottom-sheet de Plan): foto/PDF → F-IA-9 devuelve opciones con `variantes` →
   vista previa editable (ya existe) → «Crear versión de dieta» persiste opciones + variantes.
2. **Registrar** (bottom-sheet de Hoy → «desde el plan»): la opción con variantes muestra
   chips; eliges fuente → macros de esa variante; ajustas gramos (escala F06) → «Añadir».
   La entrada se guarda con el nombre del hueco + la variante como sufijo o en el nombre
   (decidir lo más simple en implementación; anotar en DECISIONS si hay duda) y sus macros
   reales.

## IA (F-IA-9 · prompt CONGELADO — reemplaza el de `04-IA.md` §F-IA-9)
Modelo `AI_MODEL_VISION`, `temperature: 0`, máx 4 páginas, `max_tokens: 3000`.

> {ATHLETE_CONTEXT compacto} Eres un nutricionista. Esta imagen es la pauta dietética de un
> paciente. Extrae TODAS las comidas y sus opciones respetando la estructura: comidas
> (almuerzo/comida/merienda/cena), y en cada una las opciones con su grupo si existe
> (Verdura/Hidratos/Proteína/Grasa/Otros; si la comida es de opción única o conjunto, usa
> "Opción única"), el nombre, los gramos pautados (null si son unidades) y estima kcal,
> proteína, hidratos y grasa de cada ración con tablas de composición españolas. Si el nombre
> de una opción agrupa VARIOS alimentos intercambiables con macros por ración materialmente
> distintas (p. ej. "carne magra (pollo/pavo/ternera/cerdo)", "arroz/quinoa/legumbre",
> "patata/boniato/yuca"), conserva el nombre tal cual la pauta y añade además "variantes": una
> entrada por alimento, con su propio nombre y sus macros para esos MISMOS gramos pautados. NO
> generes variantes cuando lo enumerado son formas de cocinado o preparación ("vapor/plancha/
> ensalada", "hervido") ni cuando las macros son prácticamente iguales: en esos casos deja
> "variantes" como lista vacía. Extrae también, si aparecen, las kcal y proteína totales
> pautadas. Responde SOLO con JSON válido, sin markdown: {"kcal_totales": number|null,
> "proteina_total": number|null, "comidas": [{"comida": string, "opciones": [{"nombre":
> string, "grupo": string, "gramos": number|null, "kcal": number, "proteina_g": number,
> "carbohidratos_g": number, "grasa_g": number, "variantes": [{"nombre": string, "kcal":
> number, "proteina_g": number, "carbohidratos_g": number, "grasa_g": number}]}]}]}

- Sincronizar en `04-IA.md` §F-IA-9 **y** en la construcción del prompt de la route de
  diet-import. Validación con Zod (1 reintento). Coste: igual que hoy (una llamada por import,
  uso puntual; solo crecen ~unos tokens de salida).

## Impacto en Coach/Chat/Visita
Nulo. El plan sigue exponiendo el hueco ("carne magra"), que es como el Coach debe referirse a
él. Lo que comiste (variante concreta) ya vive en `meal_entries` con sus macros reales, que es
lo que consume el contexto de IA. No se tocan sus prompts.

## AC
1. Importar la pauta real de Regenera reconstruye "carne magra" como **una** opción con
   `variantes` = [pollo, pavo, ternera, cerdo], cada una con kcal/macros propias a los gramos
   pautados; "verdura (vapor/plancha/ensalada)" queda como **una** opción **sin** variantes.
2. Al registrar "carne magra" desde el plan, los chips dejan elegir la fuente; elegir "Ternera"
   guarda macros de ternera, no las medias; cambiar gramos escala desde la variante elegida (F06).
3. 🖐 Registrar un día real eligiendo variantes: las kcal/macros del día cuadran con lo comido
   (Alex valida con el pulgar el swing pollo↔cerdo).
4. `plan_options` sin variantes (filas viejas y opciones no agrupadas) se comportan **igual que
   hoy** (sin chips, sin regresión).
5. export → restore de una versión con variantes es round-trip idéntico; `migrate:poc` de un
   export sin variantes carga con `[]`.
6. `pnpm typecheck && pnpm test && pnpm build` en verde. Re-validar el AC de F-IA-9 en vivo (se
   tocó el prompt congelado); mantener `temperature: 0` (principio 2).

## Riesgos / decisiones discutibles
1. **La elección vive al registrar, no en el plan** — mantiene el plan legible y fiel a Regenera
   (principio 8). Coste: un tap más al añadir opciones con variantes. (Acordado con Alex.)
2. **Quién decide "esto es variante": el modelo**, con instrucción explícita. Riesgo de falso
   positivo/negativo → mitigado por la vista previa editable del import.
3. **Default = primera variante** (cero fricción si acierta, un tap si no). Se descarta
   "recordar la última" para v1.

## Fases
- **Fase 1** (entrega el valor entero): migración `variants` + importador que detecta y rellena
  + selector al registrar + export/restore/`migrate:poc`. Lógica y parsers testeados ANTES que
  la UI. Desplegar.
- **Fase 2** (aplazable): editar variantes a mano en el editor del plan sin reimportar.
