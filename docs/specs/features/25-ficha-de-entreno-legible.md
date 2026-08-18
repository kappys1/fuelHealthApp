# F25 · Ficha de entreno legible: el tercer nivel

**Estado**: **fases 1 y 2 implementadas y desplegadas** (18-ago) · **fase 3 pendiente**
(cableado en import, composer y «Reformatear»: hoy el endpoint existe y no lo llama nadie,
así que los marcadores solo se ponen a mano — gate 🖐 del AC 7). Derogación registrada en
DECISIONS #95. · **Tamaño**: feature (3 fases)
**Fecha**: 2026-08-18 · **Origen**: uso real de Alex (18-ago), captura de la sesión de
jueves — *«no se ve separado y se lee todo junto»*.

## Motivación (caso real)

Alex abre la sesión de halterofilia del jueves y el bloque `Weightlifting / Strength` sale
como **27 líneas al mismo peso visual**: el nombre del movimiento, la indicación, el
condicional de dolor, el esquema de rondas y el ejercicio siguiente, todo seguido.

No es un fallo de CSS. Es que **el dato tiene dos niveles y la sesión tiene tres**:

- El contrato canónico está escrito en el prompt de importación (`prompts.ts:438`):
  *«separa CADA bloque del siguiente con una LÍNEA EN BLANCO… y usa saltos de línea simples
  solo para las líneas de un mismo bloque»*, **«sin markdown»**. Nivel 1 = bloque,
  nivel 2 = línea. No hay más.
- El renderer cumple ese contrato al pie de la letra (`training-session-detail.tsx`):
  fila numerada por bloque, promoción de la primera línea a rótulo **solo** si está en el
  vocabulario de `SECTION_HEADINGS` (`Weightlifting / Strength` sí, por eso sale en azul),
  y el resto en un único `<p>` con `whitespace-pre-wrap`. Su propio comentario ya lo avisa:
  *«no se inventa una cabecera que el texto no tiene»*.
- La sesión real tiene: sección (`Weightlifting / Strength`) → grupo (`Power Clean`,
  `Power Jerk`, `Si aparece dolor >2/10`, `4 rounds`, `Strict Press`) → líneas.

El nivel del grupo no cabe en el formato, así que se aplana. Se lee mal justo en el momento
en que se usa: de pie en el box, con el móvil en la mano, entre serie y serie.

## Alcance

### 1. Un tercer nivel: el grupo

- Dentro de un bloque, una línea que sea **exactamente** `**Etiqueta**` (asteriscos dobles,
  nada más en la línea) marca el comienzo de un **grupo**. Todas las líneas siguientes
  pertenecen a ese grupo hasta el próximo marcador o el fin del bloque.
- Las líneas anteriores al primer marcador son la **entradilla** del bloque (en la captura:
  `Power Clean + Power Jerk`) y se pintan como hoy.
- Un bloque **sin marcadores se pinta exactamente igual que hoy**. Cero regresión visual en
  las sesiones ya guardadas.
- El parseo vive en `lib/training.ts` como función pura y testeada, junto a
  `splitTrainingContent`. No decide cortes de bloque: eso sigue siendo suyo.

### 2. Cómo se ve (mock aprobado: `exports/mock-ficha-entreno.html`)

- **Dos separadores con jerarquía distinta y deliberada**:
  - **Sección** → la línea a todo el ancho que ya existe (`divide-y divide-line`).
  - **Grupo** → una **regla corta y centrada** (del 14 % al 86 % del ancho, `--line-soft`),
    con 12 px de aire arriba y abajo. No llega a los bordes: se distingue de la de sección
    de un vistazo, sin leer.
- **Rótulo del grupo**: 11 px, semibold, mayúsculas, `letter-spacing .08em`,
  `--muted-foreground`. Atenuado a propósito — **no compite** con el azul del rótulo de
  sección, que sigue siendo el nivel superior.
- El primer grupo no lleva regla encima (la separa ya la entradilla).

### 3. El formateador (IA barata) y su red de seguridad

- Un paso de formato, **compartido por todas las entradas**, que recibe el `contenido` y
  devuelve **el mismo texto** con cero o más líneas envueltas en `**…**`.
- **Contrato mínimo a propósito**: el modelo solo decide *«esta línea es un rótulo de
  grupo»*. No reordena, no resume, no reescribe, no añade ni quita secciones. Es la
  pregunta más fácil de acertar y la única que se puede verificar barato.
- **Verificador determinista, en código, no confiado al modelo**: se quitan los `**` del
  resultado, se normaliza el espaciado de ambos textos y se comparan. **Si no coinciden,
  se descarta el formateo entero y se guarda el texto original.** En el peor caso te
  quedas exactamente como hoy; nunca pierdes un `4 × 4 al 80–90 %`.
- Modelo: `AI_MODEL_FORMAT`, con la misma cascada de fallback que ya usa `AI_MODEL_TITLE`
  (`env.ts:50`) → si no está definido, no rompe deploys.

### 4. Las dos entradas y las sesiones ya guardadas

- **Import** (PDF / foto / texto) y **pegado a mano** en el composer pasan por el **mismo**
  formateador. Un solo camino, un solo contrato — la lección de F08 Fase 2.
- El resultado cae en la **vista previa editable que ya existe** en
  `training-session-composer.tsx` (textarea sobre `state.contenido`). Alex ve los `**`
  antes de guardar y puede quitarlos, moverlos o añadirlos a mano.
- Acción **«Reformatear»** en la ficha de una sesión ya guardada, para las semanas que ya
  están en la BD.
- El formateo **nunca bloquea**: si la IA falla, hay timeout, o no hay red, se guarda el
  texto plano y se avisa. Guardar una sesión no puede depender de que responda un modelo.

## NO-alcance

- **Un cuarto nivel** (sangrar `Power Clean` y `Power Jerk` bajo la pareja
  `Power Clean + Power Jerk`, dejando `Strict Press` un escalón por encima). Decidido con
  Alex el 18-ago: sube el riesgo de que la IA coloque mal la profundidad y el beneficio de
  lectura es marginal. El precio aceptado: `STRICT PRESS` y `POWER JERK` quedan al mismo
  peso visual aunque uno sea un ejercicio y el otro un movimiento dentro de una pareja.
- **Ampliar `SECTION_HEADINGS`** con `Power Clean`, `Original`, `Adaptado`, `Sustitución`…
  Es el treadmill de adivinar rótulos (mañana es `Parte A`, `Opción B`, `Escalado`) y los
  nombres de ejercicio son infinitos. Además `Power Clean` aparece en la misma sesión como
  rótulo *y* dentro de `Power Clean + Power Jerk`: el mismo texto significaría dos cosas.
- **Heurísticas del tipo «línea corta sin cifras = rótulo»**. Destacarían `4 rounds` y no
  `Adaptado`. La estructura la declara el origen, no la adivina el renderer.
- **Tocar el prompt congelado del import** (`prompts.ts:438`). El formateo es un paso
  aparte; la extracción sigue como está y no se re-validan sus AC.
- **Markdown completo en la ficha**. El `<Markdown>` de `components/ui/markdown.tsx` es
  para respuestas de IA; aquí el diseño es específico (rótulo atenuado + regla corta) y no
  queremos que un `#` o una tabla en el texto de una sesión pinten cosas raras.

## Momento de uso (09 §1)

**Antes y durante el entreno**, de pie, con el móvil. Frecuencia: 4-6 veces por semana, la
misma que abrir la sesión del día. No añade ningún paso al registro diario: el formateo
ocurre una vez, al importar o al pegar.

## Datos

- **Sin schema, sin migración.** El marcador viaja **dentro** de `training_sessions.contenido`
  (columna `text` que ya existe).
- **Export / restore**: sin cambios de forma. Los `**` viajan como parte del texto.
- **`migrate:poc`**: no aplica (el PoC no tiene plan de entrenamiento).
- **Invariante F17 intacta**: `splitTrainingContent` sigue cumpliendo
  `blocks.join("") === contenido`; los marcadores son caracteres del contenido como
  cualquier otro. Los tests de `training.test.ts` no cambian.
- **Deroga una decisión escrita** (`training-session-composer.tsx:117`): *«El contenido
  canónico es el input original, no texto regenerado por IA»*. Pasa a ser: **el contenido
  canónico puede llevar marcadores de estructura añadidos por IA, verificados carácter a
  carácter contra el original; ante cualquier discrepancia, gana el original.** Hay que
  actualizar ese comentario y anotarlo en `DECISIONS.md`.

## Flujo (09 §6)

1. **Import de semana** (Plan → importar): la vista previa ya existente muestra el contenido
   **ya formateado**. Alex edita si quiere y guarda.
2. **Pegado a mano** (composer de sesión): al salir del textarea o al pulsar
   **«Dar formato»**, el contenido se formatea y vuelve al mismo textarea. Editable.
3. **Sesión ya guardada** (ficha): acción **«Reformatear»** en el menú de la ficha.
4. **Lectura** (ficha de entreno): secciones numeradas, grupos separados por la regla corta.

Nada de esto es una pantalla nueva. Todo vive donde ya vive hoy.

## IA

- **Qué hace**: marcar rótulos de grupo. Nada más.
- **Modelo**: `AI_MODEL_FORMAT` (arranca en el más barato disponible del proveedor;
  cascada de fallback como `AI_MODEL_TITLE`). `temperature: 0`.
- **Salida**: `Output.object` con un único campo de texto (el contenido marcado), como el
  resto de `server/ai/`. 1 reintento si no parsea, y errores visibles.
- **Guardarraíl de fidelidad** (esto es lo que hace segura la feature): comparación
  determinista tras quitar los `**` y normalizar espaciado. Discrepancia → se tira el
  formateo, se guarda el original, y se registra que se descartó.
- **Coste**: ~6-8 sesiones por semana, ~1.500 tokens ida y vuelta cada una → del orden de
  50k tokens/mes en el modelo más barato del catálogo. Despreciable frente a los €1,6-1,9/mes
  actuales. **Se mide de verdad tras la primera semana y se anota**, no se da por bueno.
- **El prompt exacto se escribe en `server/ai/prompts.ts`** (fuente de verdad de la
  redacción, DECISIONS #70) y se cubre con `prompts.test.ts`. Como es un prompt **nuevo**,
  no re-valida AC de ninguna feature existente.

## Impacto en Coach / Chat / Visita

**Sí, y es el punto fácil de olvidar.** `context.ts:228-236` (F21) mete el `contenido` de
cada sesión de la semana **tal cual** en el prompt del Chat: *«Sesiones de esta semana
(contenido real; úsalo, no inventes)»*. Si no se hace nada, los `**` se cuelan en el
contexto de IA.

Decisión: **los marcadores se quitan al construir el contexto de IA.** El Chat debe seguir
recibiendo exactamente el mismo texto que recibe hoy — así el comportamiento de F21 (el Chat
que adapta el entreno ante una limitación) no cambia ni hay que re-validarlo.

## AC

**Fase 1 — el nivel y su pintura (sin IA)**

1. Un bloque **sin** marcadores se pinta byte-idéntico a como se pinta hoy (test de
   regresión sobre el contenido real de la sesión del 18-ago).
2. `**Etiqueta**` en línea propia abre un grupo; las líneas siguientes le pertenecen hasta
   el próximo marcador o el fin del bloque. Función pura, testeada.
3. `**Etiqueta**` **a mitad de línea NO** abre grupo (se pinta como texto). Solo la línea
   completa cuenta — mismo criterio que `isTrainingHeadingLine`.
4. Las líneas previas al primer marcador se pintan como entradilla del bloque.
5. La regla de grupo es corta y centrada; la de sección sigue a todo el ancho. Contraste AA
   en ambos temas (`pnpm audit:contrast` en verde).
6. `splitTrainingContent` sigue cumpliendo `blocks.join("") === contenido`; suite de
   `training.test.ts` verde sin tocarla.
7. 🖐 **Alex abre la sesión del jueves con los marcadores puestos a mano y confirma que se
   lee como el mock.**

**Fase 2 — el formateador y su red**

8. El formateador devuelve el mismo texto con marcadores; el verificador confirma
   equivalencia tras quitar `**` y normalizar espaciado.
9. Si el modelo altera, omite o añade contenido, **se descarta el formateo y se guarda el
   original** (test con una respuesta manipulada a propósito).
10. Si la IA falla, va lenta o no hay red, se guarda el texto plano y se avisa. Guardar
    nunca se bloquea.
11. El caso canónico de regresión es la sesión del 18-ago: los grupos esperados son
    `Power Clean`, `Power Jerk`, `Si aparece dolor >2/10`, `4 rounds`, `Strict Press`.
12. El contexto de IA (`context.ts`) recibe el contenido **sin** marcadores; los AC de F21
    siguen verdes.

**Fase 3 — cableado**

13. Import (PDF/foto/texto) entrega el contenido ya formateado a la vista previa editable.
14. El pegado a mano ofrece el formateo y el resultado cae en el mismo textarea, editable.
15. 🖐 **Alex importa la semana real siguiente y confirma que las sesiones salen bien
    agrupadas sin tocar nada.**
16. «Reformatear» funciona sobre una sesión ya guardada y es idempotente (reformatear dos
    veces no duplica marcadores).
17. 🖐 **Alex reformatea las sesiones de la semana en curso y confirma que ninguna perdió
    información.**

## Riesgos / decisiones discutibles

1. **Se deroga «el contenido canónico es el input original».** Es el riesgo de fondo: el
   texto guardado deja de ser literalmente lo que Alex pegó. Mitigación: la mutación
   permitida es de **un solo tipo** (envolver una línea en `**`), y está verificada
   carácter a carácter por código. Si algún día el formateo empieza a fallar, el fallback
   ya es el comportamiento actual.
2. **Los `**` se ven al editar.** El textarea del composer mostrará los marcadores. Se
   acepta: es el precio de que la estructura viva en el texto y no en una tabla nueva, y
   permite corregirla a mano sin volver a llamar a la IA. Alternativa descartada: guardar
   la estructura en JSON aparte (rompe edición, export y la invariante F17).
3. **La IA elige los grupos, y ahí no hay verdad objetiva.** El verificador garantiza que no
   se pierde información, **no** que el reparto sea el mejor. Si el reparto sale malo con
   uso real, la palanca es el prompt — y el caso canónico del AC 11 es la vara de medir.

## Fases

| Fase | Qué | Por qué en este orden |
|---|---|---|
| **1** | Parseo de grupos (puro, testeado) + pintura en la ficha | Lógica antes que UI, y **valor visible sin gastar un euro de IA**: con marcadores a mano ya se lee bien. Si la Fase 1 no convence, no se construye lo demás. |
| **2** | Formateador IA + verificador de fidelidad + `AI_MODEL_FORMAT` + limpieza de marcadores en `context.ts` | La red de seguridad se construye **con** el formateador, nunca después. |
| **3** | Cableado en import y pegado a mano + acción «Reformatear» | Lo último: solo se enchufa a los caminos reales cuando el paso es seguro y está probado. |
