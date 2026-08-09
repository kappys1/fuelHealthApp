# Conversación · 9-ago-2026 — «No es capaz de leer más allá del título»

> **Skill**: `fuelboard-product-partner` (Etapas 1-3 del doc 11)
> **Resultado**: `docs/specs/features/21-chat-adapta-entreno-lesion.md` — **aprobada por Alex**
> al final de esta conversación. Pendiente de implementación (Etapas 4-6, `fuelboard-implementer`).
> **Por qué se guarda**: la queja («la IA no sabe leer mi sesión») resultó ser un **bug de dato
> verificado en código** — el WOD sí está guardado y se descarta al construir el contexto — y la
> conversación contiene el razonamiento de por qué la feature es más grande que el bug: el valor
> no está en sustituir un ejercicio, sino en **reequilibrar la semana entre días**.
> **Nota de fechas**: ver §10 al final (discrepancia entre la fecha de sesión y la escrita en la spec).

---

## 1 · Alex

> Le he preguntado sobre una lesion que tengo y que me pudise adaptar el entreno viendo por
> ejemplo todo lo que tengo de semana y así ver como hacerlo... y no es capaz de leer mas allá
> del titulo:
>
> **Hoy tengo la sesion de entrenamiento**
> *Ahora · 4 mensajes*
>
> **[Alex]** Hoy tengo la sesion de entrenamiento la puedes leer?
>
> **[Chat]** Sí, la leo. Hoy has registrado la sesión "Training 2" por la tarde. En tus notas
> indicas que la lesión del hombro derecho no te ha dejado entrenar del todo, pero que lo has
> sacado adelante corriendo a buen ritmo y haciendo trabajo con gomas.
>
> Viendo tu registro, estás en 1715 kcal (129P / 196C / 41F). Ya has cubierto de sobra la
> proteína y los hidratos, y estás muy cerca de tu objetivo de 1800 kcal. No hace falta que
> añadas nada de grasa para rellenar; cierra el día así, vas perfecto para tu objetivo de
> definición. ¿Duda resuelta?
>
> **[Alex]** vale, dime un entreno que podría haber hecho. Es decir, lo que no me limite la
> lesion de hombro hacerlo y para lo que si, dame una alternativa
>
> **[Chat]** No tengo los ejercicios exactos de tu "Training 2" en el registro para darte las
> sustituciones precisas de hoy.
>
> Como norma general para proteger tu hombro derecho (y vigilando la molestia de tu rodilla
> izquierda), la estructura ideal es:
> - **Cardio**: Mantén la carrera que has hecho o suma BikeErg/Echo sin usar los brazos.
> - **Fuerza/Gimnásticos**: Cambia cualquier empuje (presses, burpees) o trabajo colgado
>   (dominadas, toes to bar) por trabajo de core (GHD sit-ups, hollow rocks) o tren inferior
>   que no exija posición de rack (zancadas con mancuernas a los lados o subidas al cajón).
>
> Si me pasas el WOD exacto que tenías programado, te doy las adaptaciones movimiento a
> movimiento.
>
> esto en el chat.
> estaría bien pdoer tener esto si se lo pido y asi que me de alternativas a los ejercicios e
> incluso hacerme una rutina equilibrada con lo que tengo y puedo hacer y cambiarlo por
> ejercicios con los que no puedo hacer y que no me reviente ya que me lo da equilibrado y
> pensando en el crossfit. como lo ves?

## 2 · Claude

*(Tras leer `HANDOFF-features.md`, `server/db/schema.ts` (`trainingPlans`/`trainingSessions`),
`server/ai/context.ts`, `server/ai/prompts.ts` y `server/db/queries/day.ts`.)*

### Lo que pasa de verdad no es lo que parece

**El chat no es que "no sepa leer" — es que le escondemos los ejercicios.** Cuando importas tu
semana (la función "Importar semana", F-IA-10), el WOD completo de cada sesión se guarda **fiel
y ordenado** en la base de datos (`trainingSessions.contenido`: todos los bloques, series, reps,
descansos, accesorios, sin resumir). Ese contenido incluso se carga en la vista del día. Pero
cuando construimos el texto que le pasamos al chat, soltamos solo esto:

```
sesión Training 2 · Metabólico (~450 kcal)
```

…y tiramos a la basura el `contenido`. El nombre y el tipo llegan; los ejercicios no. Por eso te
dijo literalmente "no tengo los ejercicios exactos de tu Training 2 en el registro" — **los tiene
en la BD, pero nadie se los pone delante.**

Esto es idéntico a dos cazas que ya hicimos: *el calendario que el Coach no miraba* y *la info de
los implantes muriendo en el hilo del chat*. Y por eso la **jerarquía de arreglos manda**: esto es
un problema de **DATO**, no de prompt ni de modelo. Es la palanca más barata y la primera.

### Cómo lo veo (con opinión, no menú)

Tu idea son en realidad **tres cosas de tamaño muy distinto**:

1. **Que el chat LEA tu sesión** → el arreglo del dato. Pequeño. Alto valor. **Sí o sí.**
2. **Que te dé alternativas a ejercicios que no puedes hacer hoy** → sale casi gratis del punto 1
   + un permiso ligero en el prompt. **También.**
3. **Que te monte una rutina equilibrada desde cero pensada para CrossFit** → otra liga: es la IA
   *programando* tu entreno. Roza el principio 8 (el sistema informa, el experto decide) y, con
   lesión de por medio, es terreno fisio/coach. **Aplazaría**, y si se hace, siempre orientativo.

**Recomendación:** 1+2 ahora, 3 después. El 80% de tu frustración se resuelve con 1+2.

### Dos preguntas antes de escribir nada

**(a) ¿Tú importas tu semana de entreno, en la práctica?** Todo depende de que el `contenido`
exista. Si NO sueles importar, el problema real está más arriba (fricción de importar).

**(b) Tu lesión de hombro: ¿es de esta semana o la arrastras?** Ahora vive solo en las *notas* del
día — muere ahí (otra vez el patrón "implantes en el hilo", backlog B3). Si es recurrente, la
jugada grande sería que "lesión/limitación" fuese un dato del **perfil** que Coach y Chat conozcan
siempre. Si es puntual, con decírselo en el mensaje basta.

## 3 · Alex

> el 1 y el 2 esta claro.
> Pero es mas bien como puedo sustituir los ejercicios que me tocaria hacer durante X sesiones
> que le pida, por ejemplo una semana dado a mi limitacion o lesion.
> Por ejemplo que si durante la semana digo que me duele el hombro y voy a intentar no hacerlo
> reventar y lo quiero descansar... que me coja la semana y si me cambia ejercicios el lunes y me
> dice pon pierna, que el martes n me ponga pierna porque me va a sobrecargar... es mas bien
> buscar un equilibrio y que tmb sea capaz de decirme mobilidad con ejercicios, estiarmientos,
> cardio, otros ejercicios antagonicos que funcionen..., adaptaciones...
>
> a) si. siempre pongo toda la semana.
> b) es una lesion de esta seman y la llevo arrastrando pero quiero de momento adaptarlo y
> pedirselo o si un dia puntual me duele algo, que me lo pueda adaptar facil sin pensar o
> conversando con el.
>
> no se si me explico

## 4 · Claude

Sí, te explicas perfectamente. Y lo que describes **cambia el tamaño de la idea hacia arriba**,
en la parte que la hace valiosa:

No quieres solo "cámbiame este ejercicio por otro". Quieres que la IA **coja tu semana entera y la
reequilibre alrededor de una limitación**, razonando *entre días*: si el lunes te mete pierna
porque el hombro descansa, que el martes lo sepa y no te vuelva a cargar pierna. Y que la
adaptación no sea solo sustituir, sino **movilidad, estiramientos, cardio, antagonistas que sí
puedas, escalados**.

**Eso es exactamente lo que lo hace merecer la pena.** El "sustituye press de hombro por sentadilla
goblet" lo hace cualquier ChatGPT. El valor está en que lo haga **sobre tus sesiones reales
importadas** y **equilibrando la carga de la semana como un sistema**. Ese es el alma de la
feature — y va a ser el criterio de éxito escrito: tu ejemplo lunes/martes-pierna se convierte en
un **caso canónico** que la implementación tiene que pasar.

Con tus respuestas (a: siempre importas → el dato de las 7 sesiones existe siempre; b:
conversacional, sin perfil) el alcance queda limpio.

**Vive en el chat** (respeta 09 §6: nada de pantalla nueva). Dos fases:
- **Fase 1 · El día.** El chat ve la sesión de hoy con su contenido y adapta *ese* día.
- **Fase 2 · La semana con equilibrio.** Ve las 7 sesiones y distribuye carga entre días.

**Tres decisiones a cerrar (con recomendación):**
1. **Solo consejo — NO reescribe tu semana importada.** Tu semana de The Progrm es la fuente de
   verdad; mantiene el chat como asesor de solo lectura; mucho más pequeño. → recomiendo esto.
2. **La limitación se declara en la conversación, no en el perfil (aún).** Matiz honesto: en un
   hilo nuevo se lo repites. Para v1 me vale; el "recuérdalo" es el fast-follow de B3.
3. **Coste/presupuesto de prompt.** Meter las 7 sesiones en *cada* turno lo infla (y el prompt del
   chat ya es un contrato largo en tensión: "sé breve" pelea con "dame la semana adaptada").
   Recomiendo cargarlas **solo cuando el turno va de adaptar entreno** (chip o detección).

Guardarraíl no negociable: la adaptación es **orientativa** ("contrástalo con tu fisio/coach"),
puede escalar/sustituir/proponer movilidad, pero **no diagnostica ni trata** la lesión.

**Tamaño: M.** Sin migración, sin escrituras, sin pantalla nueva.

## 5 · Alex

> Si, pero que decida el, que no sea todo de golpe... que pueda hablar con el como si fuese un
> coach vamos.
>
> 1. No, no quiero que lo haga y en todo caso ya lo hare yo metiendolo manualemnte.
> 2. si, en el chat. de momento nada de perfil
> 3. esto no puede ser on demand si se necesita? con deteccion de intencion. si, no siempre.
>
> así lo ves?

## 6 · Claude

Sí, y ese matiz —**"que decida él, que no sea todo de golpe, hablar con él como un coach"**— es
importante y, de hecho, te *simplifica* el problema: no es "genérame la semana entera de un tirón",
es **diálogo**. Eso además mata la tensión con "sé breve": al ser conversacional e incremental,
cada turno es corto. Encaja como un guante en el chat.

Confirmado:
1. **Solo consejo, no escribe** — tú lo metes a mano. ✅
2. **Chat, nada de perfil (aún).** ✅
3. **On-demand por detección de intención, no siempre.** ✅ (mejor que el chip: cero fricción, no
   tienes que acordarte de pulsar nada)

*(Tras leer `docs/specs/11-PROCESO-FEATURES.md` y `src/app/api/ai/chat/route.ts`.)*

El encaje técnico es limpio: la ruta ya ensambla contexto fresco por turno y tiene el texto del
mensaje **antes** de construir el prompt → la detección de intención cabe ahí sin tocar el flujo.

**→ Escrita `docs/specs/features/21-chat-adapta-entreno-lesion.md`** (y capturada en HANDOFF §B3).

**Resumen (5 líneas):** el WOD ya está guardado pero el contexto del Chat solo emite
`título · tipo · kcal` y tira los ejercicios → por eso "no puede leer más allá del título".
Arreglo de dato + coach conversacional que adapta ante una limitación (sustituciones, movilidad,
antagonistas, escalados) con **equilibrio entre sesiones**. On-demand por detección de intención,
solo lectura, sin campo de perfil. Feature, 2 fases, sin migración.

**Las 3 decisiones que tomé y quiero que ratifiques:**
1. **Fase 1 = leer y adaptar el DÍA; Fase 2 = la SEMANA con equilibrio.** La 1 mata el bug de
   origen ya; la 2 es el alma y es donde está el trabajo.
2. **La detección de intención gobierna también leer la sesión de hoy** (no la meto siempre). Fiel
   a tu "on-demand", blindado con recall generoso + tests de disparo (AC 9).
3. **Ventana de "la semana" = sesiones del plan vigente de hoy a fin de semana del plan** (≤7).

## 7 · Alex

> aprobado

## 8 · Claude

Aprobada. Spec marcada como **aprobada (Alex, 2026-07-29)**. Entregado el **prompt de arranque a
medida** para la sesión de implementación (`fuelboard-implementer`) — reproducido en §9.

---

## 9 · Prompt de arranque entregado (para la sesión de implementación)

> Implementa `docs/specs/features/21-chat-adapta-entreno-lesion.md` (**aprobada**) según las
> Etapas 4-6 del proceso (`docs/specs/11-PROCESO-FEATURES.md`). **Fase a fase, AC uno a uno**, y
> déjame los 🖐 pendientes de mi validación.
>
> **Anclaje (léelo antes de tocar código):**
> - `docs/specs/features/21-chat-adapta-entreno-lesion.md` — la spec. Fuente de verdad del alcance y los AC.
> - `src/app/api/ai/chat/route.ts` — ensamblado de contexto del Chat. El texto del turno (`message`)
>   está disponible **antes** de construir el prompt → ahí engancha `detectTrainingAdaptationIntent(message)`.
>   Fíjate en cómo se inyectan hoy los bloques (`chatSystemPrompt({...})`, `days30`, `mealsDetail`, `marks`, `products`).
> - `src/server/ai/context.ts` (~606-620) — el punto EXACTO del bug de origen: emite
>   `sesión {nombre} · {tipo} (~kcal)` y **descarta `contenido`**. El arreglo de la Fase 1 sale de aquí.
> - `src/server/db/queries/day.ts` (`DaySessionInfo`, ~199) — confirma que `session.contenido` ya se
>   carga en el DayView; no hay que tocar la query para la Fase 1.
> - `src/server/db/queries/training.ts` — Fase 2: lectura de las sesiones de la semana del plan
>   vigente (reutiliza/adapta la query de Plan·Entrenos; **no crees tabla**).
> - `src/server/ai/prompts.ts` (`chatSystemPrompt`) + `prompts.test.ts` — prompt **CONGELADO**; el
>   bloque de comportamiento nuevo va aquí, con sus interacciones declaradas (lección 4).
>
> **Orden de fases (con su porqué):**
> - **Fase 1 · Leer y adaptar el DÍA** primero: detección de intención (función **pura y testeada**,
>   recall generoso, AC 9) + `contenido` de la sesión de hoy en el contexto + bloque de comportamiento
>   (sustituciones, movilidad, antagonistas, escalados; orientativo; solo lectura; anti-invención).
>   **Mata el bug de origen.** Cubre AC 1,2,5,6,7,8,9.
> - **Fase 2 · Adaptar la SEMANA con equilibrio** después: lectura de la ventana bajo intención +
>   reparto de carga entre sesiones (caso lunes/martes-pierna) + postura de coach conversacional/
>   incremental. Es el alma. Cubre AC 3,4.
>
> **Reglas de la casa que aplican aquí (solo estas):**
> - **Prompt congelado**: editar `prompts.ts` → re-validar los AC del Chat + los **casos canónicos de
>   F05** → **sync de doctrina a `04-IA.md`** (DECISIONS #70). **temperature 0.3** (excepción del Chat).
>   **Sin café ×3** (no se toca ningún estimador).
> - **Tests de lógica antes que UI**: `detectTrainingAdaptationIntent` es pura → batería de
>   disparadores canónicos y de no-disparo antes de cablearla.
> - **Sin migración**: sin impacto en export/restore ni `migrate:poc` (verifícalo, no lo asumas).
> - **`typecheck + test` en verde antes de cada commit; commits pequeños.**
> - **Errores de IA siempre visibles**; toda llamada por la API route.
>
> **AC que valida Alex con el pulgar (🖐):** 1 (léeme la sesión → ejercicios reales), 2 (adáptame hoy
> por el hombro), 3 (equilibrio semana, no apila pierna lunes/martes), 4 (coach conversacional, no
> vuelca la semana), 5 (solo lectura, no afirma haber guardado).

---

## 10 · Nota de fechas (a resolver)

Durante la sesión el sistema reportó primero **9-ago-2026** y luego **29-jul-2026**. Escribí la spec
y la entrada de HANDOFF con **29-jul** y el caso real como **28-jul**. Dado que los últimos commits
del repo son del **5-ago** y la sesión arrancó el **9-ago**, lo más probable es que las fechas
correctas sean **9-ago** (spec/aprobación) y **8-ago** (caso real del chat). Pendiente de que Alex
confirme para corregir los tres sitios: cabecera de la spec, campo *Origen* y la línea de
`HANDOFF-features.md` §B3.

## 11 · Hilos abiertos

- **Fast-follow natural**: que la limitación deje de vivir en el hilo y el Coach la recuerde
  («estoy tocado hasta ~fecha») — conecta con la idea 💡 de B3 *«Registrar en el día los eventos que
  cuentas en el chat»* (patrón «implantes muriendo en el hilo»).
- **Aplazado explícitamente**: que la IA genere una rutina desde cero (la "3" de §2). Roza el
  principio 8; se retomará solo si el uso real de F21 lo pide.
- **Fuera de F21**: emitir también el contenido de la sesión en `dayContext` para el **Coach**
  (es proactivo y breve; meterle el WOD completo es otra discusión).
