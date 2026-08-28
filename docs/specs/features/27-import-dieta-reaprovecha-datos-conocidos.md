# F27 · Importar dieta sin perder correcciones conocidas
**Estado**: cerrada por Alex (2026-08-29) · AC 7 y 8 validados en móvil · AC 10 aceptado sin crear una versión duplicada de prueba · despliegue autorizado · **Tamaño**: feature (UI + contrato F-IA-11; sin migración)
**Fecha**: 2026-08-28 · **Origen**: uso real durante la importación de la nueva pauta;
capturado en `docs/HANDOFF-features.md` §B3

## Motivación (caso real)

Al importar una dieta, F-IA-9 vuelve a estimar desde cero todas las opciones. La vista
previa no recibe ni la dieta vigente ni `Mis productos`, aunque Alex ya puede haber
corregido esas cifras a mano o desde una etiqueta. Una nueva versión puede, por tanto,
degradar silenciosamente un dato conocido.

Caso real del 28-ago: la importación devuelve `Gazpacho · 200 g = 70 kcal`. La etiqueta
real de Gazpacho Lidl declara:

- por 100 ml: `37 kcal · 0,6P · 3C · 2,3G`;
- por ración de 200 ml: `75 kcal · 1,2P · 6C · 4,6G`.

Las versiones anteriores del Plan conservan 70 kcal, mientras `Mis productos` contiene
`Gazpacho Lidl` de fuente `etiqueta`, pero como `100 g · 37 kcal`. El sistema pierde hoy
tres piezas de conocimiento: no empareja `Gazpacho` con `Gazpacho Lidl`, el lector no
transporta `ml`, y guardar solo la columna por 100 produce 74 kcal al duplicarla en vez de
respetar las 75 kcal que el fabricante declara explícitamente para 200 ml.

Esto contradice el principio 3 (la fricción mata el sistema) y el principio 7 (los datos
son sagrados): Alex no debe reconstruir en cada cambio de pauta una corrección que la app
ya conoce o que puede leer una sola vez.

## Alcance

- La vista previa de F-IA-9 recibe la **dieta vigente** y `Mis productos` y reconcilia
  cada opción importada antes de mostrarla.
- Cada fila muestra un origen transitorio: `Etiqueta`, `Dieta anterior`, `Mis productos`,
  `Estimación IA` o `Editado`.
- Precedencia automática:
  1. producto de fuente `etiqueta` con coincidencia inequívoca;
  2. opción equivalente de la dieta anterior;
  3. salida de F-IA-9.
  Los productos `manual|estimado|legacy` quedan disponibles para elegir, pero no pisan
  automáticamente una opción de la dieta anterior.
- La opción anterior se empareja por nombre normalizado y, si está repetida, por el mismo
  momento de comida. Se copian kcal, macros, unidad y variantes. Si cambia la cantidad y
  ambas bases son escalables y compatibles, se reescala desde la base anterior con los
  helpers de `lib/macros`; nunca desde números ya redondeados.
- Un producto de etiqueta se puede proponer por nombre exacto normalizado o por una
  coincidencia de contención **única y segura** (`Gazpacho` → `Gazpacho Lidl`). Una
  coincidencia ambigua (`Pan` frente a varios panes) o con un producto dentro de una
  preparación compuesta nunca se aplica en silencio.
- Cada fila normal permite:
  - cambiar entre las fuentes disponibles;
  - elegir explícitamente otro elemento de `Mis productos`;
  - hacer una **Foto de etiqueta**;
  - editar nombre, grupo, cantidad, unidad, kcal y macros como hoy.
- Una Foto de etiqueta hace **una sola lectura** y desemboca en dos destinos revisables:
  1. corrige la fila de la dieta;
  2. ofrece `Actualizar/Guardar en Mis productos`, activado por defecto.
- Si la etiqueta trae una columna de ración que coincide con la cantidad pautada, se usa
  esa columna explícita, sin recalcularla desde la columna por 100. En el caso canónico,
  la fila y el producto quedan con base `200 ml · 75 kcal · 1,2P · 6C · 4,6G`.
- Si Alex edita después cualquier campo, el origen visible pasa a `Editado`; nada se
  guarda hasta confirmar `Crear versión de dieta`.
- Actualizar un producto afecta solo a usos futuros. No reescribe comidas registradas ni
  versiones históricas de dieta.

## NO-alcance

- No se reescriben retrospectivamente opciones de dietas anteriores ni entradas de días
  ya registrados (principio 7).
- No existe vínculo vivo producto↔opción: la nueva versión guarda una copia, como F19.
- No se hace fuzzy matching abierto ni se confía el cálculo al modelo. Las coincidencias
  ambiguas requieren elección de Alex.
- No se aplica una etiqueta de producto a una opción compuesta o con variantes. Las
  variantes solo se reaprovechan desde la opción equivalente de la dieta anterior; leer
  etiquetas por variante queda fuera hasta que exista un caso real.
- No se añade base de datos externa, código de barras ni búsqueda web.
- No se intenta hacer que una única base lineal reproduzca dos columnas de etiqueta que
  el fabricante ha redondeado por separado. Cuando coincide la ración pautada, gana esa
  ración explícita; en otro caso se usa la base por 100.

## Momento de uso

`Plan → Dieta → Importar dieta → vista previa`, el flujo puntual de **cambio de dieta** de
09 §1 y §5b. La selección de fuente y la etiqueta viven dentro del sheet existente; no
añaden pantalla, pestaña ni tarjeta permanente a Hoy (09 §6).

## Datos

- **Sin migración.** `plan_options` y `products` ya guardan cantidad/base, unidad y
  kcal/macros; la base de un producto puede ser 200 ml, no tiene que ser 100.
- El origen de una fila es estado efímero de la vista previa y no se persiste.
- La versión confirmada sigue viajando por `dietVersionCreateZ` / `createDietVersionFull`;
  el payload del import debe transportar `unit`, ya soportado por `optionZ`.
- Crear/actualizar el producto usa el CRUD existente y conserva `source:'etiqueta'`.
- Export/restore y `migrate:poc` no cambian: las filas finales ya recorren sus estructuras
  actuales. Verificar por regresión que la unidad y la base elegidas siguen apareciendo en
  el export.

## Flujo

1. Alex selecciona foto/PDF y ejecuta `Analizar con IA`, como hoy.
2. Al recibir F-IA-9, una función pura reconcilia cada opción con la dieta vigente y los
   productos. La vista previa muestra ya la mejor fuente inequívoca y su origen.
3. En una fila, `Cambiar origen` permite volver a la estimación, usar la dieta anterior,
   elegir un producto o abrir `Foto de etiqueta`.
4. `Foto de etiqueta` abre el selector nativo, lee la tabla y muestra los valores elegidos
   dentro de la misma fila. Si hay columna de ración igual a la pauta, queda preseleccionada.
5. La fila muestra `Actualizar Gazpacho Lidl en Mis productos` —o `Guardar…` si es nuevo—,
   activado por defecto y desactivable antes de confirmar la lectura.
6. Alex puede editar cualquier campo. `Crear versión de dieta` persiste la versión completa
   y, si lo aceptó, crea/actualiza el producto sin una segunda llamada a la IA.

Si la lectura de etiqueta falla, el error del proveedor sigue visible y la fila conserva
su valor anterior. Offline, la acción se muestra deshabilitada con motivo, como el lector
actual.

## IA

### F-IA-9 · Importar dieta

No cambia prompt, esquema, modelo ni coste. La reconciliación ocurre después de la salida
actual, con datos locales y lógica determinista. Así se evita pedir al modelo que decida
qué dato histórico debe ganar.

### F-IA-11 · Leer etiqueta

Se amplía `labelReadPrompt()` y `labelReadZ` para leer, **sin recalcular**:

- `unidad: 'g'|'ml'|'ud'`;
- la base principal por 100 (o la única base disponible), compatible con los campos
  actuales;
- `racion` opcional con cantidad, unidad y kcal/P/C/G cuando la etiqueta imprime una
  columna explícita de ración.

El modelo solo transcribe columnas. Una función pura elige la base: ración explícita si
coincide con la cantidad/unidad de la fila; base principal en otro caso. Los valores
ausentes siguen siendo `null`; nunca se estiman ni se obtienen multiplicando dentro del
prompt.

Modelo, temperatura y coste no cambian. Al tocar un prompt congelado se sincroniza
`docs/specs/04-IA.md` por cambio de esquema/AC y se revalida F-IA-11 con la etiqueta real
del gazpacho ×3. No aplica el café ×3: es lectura, no estimación.

## Impacto en Coach/Chat/Visita

No hay campos de contexto ni prompts nuevos. Las tres superficies ya leen las opciones
guardadas del Plan y las entradas horneadas del día; heredarán datos mejores por la vía
existente. El catálogo sigue sin ser un vínculo vivo con el Plan.

## AC

1. La vista previa recibe dieta vigente y productos; una fila sin coincidencias conserva
   byte a byte los valores de F-IA-9 y muestra `Estimación IA`.
2. Una opción con nombre normalizado idéntico en la misma comida reutiliza kcal, macros,
   unidad y variantes de la dieta anterior.
3. Si la opción anterior pasa, por ejemplo, de 200 a 250 ml, sus macros se reescalan desde
   su base con `scaledForStore`; volver a 200 reproduce los valores originales sin deriva.
4. Un producto `etiqueta` con match único y seguro gana a la dieta anterior. Dos candidatos
   o una preparación compuesta no aplican ninguno automáticamente.
5. Productos `manual|estimado|legacy` se pueden elegir, pero no pisan automáticamente la
   dieta anterior.
6. La etiqueta real de Gazpacho Lidl se lee como `unidad: ml`, base por 100 =
   `37 kcal · 0,6P · 3C · 2,3G` y ración explícita de 200 ml =
   `75 kcal · 1,2P · 6C · 4,6G`; ningún valor se calcula por duplicación.
7. Para la fila `Gazpacho · 200`, la selección de etiqueta usa la ración de 200 ml y deja
   la fila en `75 kcal · 1,2P · 6C · 4,6G`, origen `Etiqueta`. **✅ Validado por Alex en móvil (2026-08-28).**
8. La misma lectura ofrece actualizar `Gazpacho Lidl` por defecto; al aceptarlo, el producto
   queda `baseG:200`, `unit:'ml'`, macros de la ración y `source:'etiqueta'`. Añadirlo luego
   con 200 ml produce 75 kcal. **✅ Validado por Alex en móvil (2026-08-28).**
9. Desactivar `Actualizar/Guardar en Mis productos` corrige solo la fila importada; el
   catálogo queda intacto.
10. Editar un campo después de aplicar cualquier fuente mantiene el valor editado, cambia
    el origen a `Editado` y se persiste al crear la versión. **✅ Cierre aceptado por Alex
    (2026-08-29) sin crear otra versión artificial solo para probarlo.**
11. Elegir `Estimación IA` restaura los valores originales de F-IA-9; elegir después otra
    fuente vuelve a aplicar una copia limpia de esa fuente.
12. Una opción con variantes puede reaprovechar todas las variantes desde la dieta anterior,
    pero no ofrece aplicación automática de un producto/etiqueta sobre el conjunto.
13. Crear la nueva versión conserva `unit`, base, macros y variantes reconciliadas. Las
    dietas anteriores y las entradas ya registradas no cambian.
14. Fallo de F-IA-11 visible y no destructivo; offline, Foto de etiqueta está deshabilitada
    con motivo.
15. F-IA-11 pasa la etiqueta real ×3 con la misma lectura estructural; F-IA-9 mantiene sus
    AC actuales sin revalidación de prompt.
16. `pnpm typecheck && pnpm test && pnpm build` en verde. Los tests puros cubren
    normalización, precedencia, ambigüedad, escalado, selección de ración y variantes.

## Riesgos / decisiones discutibles

1. **Etiqueta > dieta anterior.** El caso real demuestra que la corrección recordada no
   quedó materializada en el Plan, mientras el catálogo sí conserva su procedencia. Solo
   una coincidencia inequívoca de fuente `etiqueta` puede ganar automáticamente.
2. **Ración explícita > multiplicar la columna por 100.** Las etiquetas redondean columnas
   de forma independiente; una única base lineal no reproduce ambas. Se prioriza la cifra
   impresa para la cantidad que Alex realmente tiene pautada y usa habitualmente.
3. **Match semántico muy conservador y determinista.** Resuelve `Gazpacho` ↔
   `Gazpacho Lidl`, pero ante dos panes no elige. Es preferible un toque de confirmación a
   contaminar una dieta completa con un producto parecido.

## Fases

- **Fase 1 · Reaprovechar lo conocido:** función pura de reconciliación + tests; pasar
  dieta vigente/productos a `DietImport`; origen visible, selector de fuente, unidad en
  filas y payload. Entrega copia/reescala desde dieta anterior y catálogo sin tocar IA.
- **Fase 2 · Etiqueta, una lectura y dos destinos:** ampliar F-IA-11 con unidad+ración;
  selector de foto por fila; selección pura de base; crear/actualizar producto opcional;
  sincronizar 04-IA y validar la etiqueta del gazpacho ×3.

## Evidencia de implementación (2026-08-28)

- **Fase 1 cerrada antes de Fase 2:** reconciliación y selector de fuentes cubiertos por
  tests puros; `typecheck`, 52 archivos/680 tests y `build` verdes. F-IA-9 y todos los
  prompts permanecieron intactos durante esta fase.
- **Fase 2 cerrada:** F-IA-11 transporta unidad y ración impresa; la misma lectura corrige
  la fila y puede crear/actualizar el producto. Sin schema de BD, migración, backfill ni
  cambios retroactivos.
- **Etiqueta canónica real ×3:** las tres lecturas fueron byte-idénticas y devolvieron
  `100 ml = 37 kcal · 0,6P · 3C · 2,3G` y
  `200 ml = 75 kcal · 1,2P · 6C · 4,6G`; nunca 74. `IMG_8049.jpg` sigue local y no se
  versiona. No aplica café ×3 porque F-IA-11 transcribe, no estima.
- **Gate final:** `pnpm typecheck && pnpm test && pnpm build` verde con 53 archivos y
  689 tests. Alex validó en el flujo móvil los AC 7 y 8 y aceptó cerrar el AC 10 sin
  crear otra versión artificial; feature cerrada y despliegue autorizado el 2026-08-29.
