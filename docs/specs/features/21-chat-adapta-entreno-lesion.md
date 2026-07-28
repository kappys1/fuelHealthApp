# F21 · El Chat lee y adapta tu entreno alrededor de una limitación (coach conversacional)
**Estado**: implementada (Fases 1+2, 2026-07-29; AC 1-5 🖐 pendientes del pulgar de Alex en producción) · **Tamaño**: feature (sin migración, sin pantalla; toca prompt congelado + contexto IA)
**Nota de implementación**: la ventana de la Fase 2 se fijó en la **semana del plan (lun-dom)** en vez de «hoy → fin de semana» (riesgo 2, marcado *Ajustable*): un caso real en validación pidió leer «la de ayer». Ver DECISIONS #88 y CHANGELOG v1.23.
**Fecha**: 2026-07-29 · **Origen**: caso real Alex (28-jul): preguntó por su lesión de hombro y pidió adaptar el entreno «viendo todo lo que tengo de la semana»; el chat respondió «no tengo los ejercicios exactos de tu Training 2 en el registro».

## Motivación (caso real)
Alex tiene una molestia de hombro derecho que arrastra. Le pidió al Chat que le leyera la
sesión del día y le adaptara el entreno para no forzar el hombro. El Chat solo pudo ver el
**título** («Training 2») y las notas, no los ejercicios — respondió literalmente que no
tenía el WOD «en el registro» y pidió que se lo pegara. **Pero el WOD sí está guardado**: al
importar la semana (F-IA-10) el contenido completo de cada sesión se persiste fiel y ordenado
en `training_sessions.contenido`, se carga en la vista del día… y se descarta al construir el
texto que ve la IA (el contexto solo emite `sesión {nombre} · {tipo} (~kcal)`). Es el patrón
ya conocido *«el calendario que el Coach no miraba»*: **problema de DATO, no de prompt** — la
palanca más barata y la primera (jerarquía dato > diseño > prompt > modelo, DECISIONS/lección 1).

Además del arreglo, Alex quiere una capacidad nueva: **hablar con el Chat como con un coach**
para adaptar su entreno alrededor de una limitación — no un volcado de la semana de golpe, sino
diálogo en el que **él decide**. Y con equilibrio **entre sesiones**: «si el lunes me metes
pierna porque descanso hombro, que el martes no me vuelvas a cargar pierna». No solo sustituir:
también movilidad, estiramientos, cardio, antagonistas que sí pueda, escalados.

## Alcance
- **El Chat ve el CONTENIDO de tu sesión** (los ejercicios, no solo el título) cuando el turno
  va de entreno/lesión/adaptación — vía **detección de intención** sobre el mensaje del turno.
- Ante una **limitación declarada en la conversación** («me duele el hombro, quiero descansarlo»),
  el Chat actúa como coach: propone **sustituciones** de los movimientos afectados, **movilidad,
  estiramientos, cardio, trabajo antagonista y escalados** apropiados.
- **Equilibrio entre sesiones** (Fase 2): cuando la adaptación abarca varios días/la semana, la
  IA razona sobre las sesiones reales importadas de la ventana y **distribuye la carga** (no
  apila el mismo grupo muscular en días consecutivos — el caso lunes/martes-pierna).
- **Conversacional e incremental**: no vuelca la semana entera sin pedirla; propone, deja que
  Alex lo lleve, ajusta. «Como hablar con un coach.»
- **Orientativo y de solo lectura**: aconseja; **no reescribe** la semana importada ni reclama
  registrar nada (Alex lo mete a mano si quiere).

## NO-alcance (y por qué)
- **NO escribe/guarda la semana adaptada** (decisión firme de Alex, 29-jul): su semana de
  The Progrm es la fuente de verdad y no se toca; mantiene el contrato de *asesor de solo
  lectura* del Chat (F05); mucho menor. Si tras uso real quiere «guárdame esta versión», es un
  fast-follow aparte (implicaría capa de adaptación, export/restore, undo).
- **NO campo de perfil «lesión/limitación»** (decisión de Alex, 29-jul): de momento se declara
  en la conversación. Consecuencia asumida: la limitación vive en el hilo; en un hilo nuevo se
  reafirma. El «estoy tocado hasta ~fecha y el Coach lo recuerda» es la jugada conectada del
  backlog **B3** (patrón «implantes muriendo en el hilo») → fast-follow natural, no ahora.
- **NO en Coach/Visita/estimadores**: frontera dura, igual que la web-search de F05 — solo Chat.
- **NO diagnostica ni trata la lesión**: es terreno fisio/coach (ver guardarraíl en IA).

## Momento de uso (09 §1)
Pestaña **Chat** («pregúntale a tus datos»), en el momento de planificar el entreno del día o
la semana, o cuando algo duele. Frecuencia: puntual/semanal. **Sin superficie nueva** (respeta
09 §6: nada de pantalla ni tarjeta permanente).

## Datos
- **Sin migración.** El contenido de las sesiones ya existe (`training_sessions.contenido`,
  poblado por F-IA-10) y ya se lee en `DaySessionInfo` (`queries/day.ts`).
- Fase 2 necesita una lectura de **las sesiones de la semana del plan vigente** (hoy + días
  restantes de la semana del plan; ≤7 sesiones). La query de Plan·Entrenos ya recorre la
  semana → se reutiliza/adapta; no hay tabla nueva.
- **Sin impacto en export/restore ni `migrate:poc`** (no se crea ni cambia esquema).

## Flujo (dónde vive)
En la ruta del Chat (`src/app/api/ai/chat/route.ts`), que ya ensambla contexto fresco por
turno y dispone del texto del mensaje **antes** de construir el prompt:
1. `detectTrainingAdaptationIntent(message)` (función **pura y testeada**, recall generoso:
   entreno/sesión/ejercicio/WOD/lesión/dolor/duele/hombro/rodilla/adaptar/sustituir/escalar/
   movilidad/estiramiento/descansar-músculo…). Su lista de disparadores canónicos está cubierta
   por tests (lección 3: todo caso de comportamiento acaba en caso canónico).
2. Si dispara → se inyecta en el contexto el **contenido** de la(s) sesión(es) relevante(s)
   (Fase 1: la de hoy; Fase 2: la ventana de la semana). Si NO dispara → contexto y coste
   idénticos a hoy (nada de WOD en el prompt).
3. El bloque de comportamiento (abajo) se añade al prompt congelado del Chat.

## IA
- **Función**: `chatSystemPrompt(...)` en `server/ai/prompts.ts` (prompt CONGELADO) — se añade
  un bloque de comportamiento; se sincroniza la **doctrina** a `04-IA.md` y se re-validan los
  AC del Chat (DECISIONS #70). **Modelo**: el del Chat (`AI_MODEL_COACH`), sin cambio.
  **temperature 0.3** (excepción documentada del Chat; adecuada, algo de variedad en las
  alternativas de ejercicio es buena). **Sin café ×3** (no se toca ningún estimador).
- **Salida**: texto en streaming (sin esquema; como el Chat actual).
- **Nuevo bloque de comportamiento** (redacción final al implementar, en `prompts.ts`), que
  **declara sus interacciones** con el contrato existente (lección 4 · presupuesto de prompt):
  - *Leer el entreno real*: usa el CONTENIDO de la sesión que se te da; no inventes un WOD.
    Si un día no tiene sesión importada, **dilo** (reutiliza la postura anti-invención de F02).
  - *Adaptar ante limitación*: si el atleta declara una molestia/lesión/deseo de descansar un
    grupo, propón sustituciones de los movimientos afectados y añade, cuando aporte, movilidad,
    estiramientos, cardio sin implicar la zona, trabajo antagonista y escalados.
  - *Equilibrio entre sesiones* (Fase 2): al adaptar varios días, mira las sesiones de la
    ventana como un conjunto y **reparte la carga**; no apiles el mismo grupo muscular en días
    consecutivos.
  - *Coach conversacional*: dialoga; **no vuelques la semana entera** salvo que la pida; propón
    y deja que decida. (Excepción acotada a «sé breve»: las respuestas de adaptación pueden ser
    algo más estructuradas, pero incrementales, no un volcado.)
  - *Solo lectura*: no reclames registrar ni afirmes haber modificado el entreno; si quiere
    conservarlo, que lo introduzca él (compatible con el contrato de asesor de F05).
  - *Guardarraíl de seguridad*: la adaptación es **orientativa**; para una lesión real o que
    persiste, sugiere contrastar con fisio/coach; **no diagnostica ni prescribe tratamiento**.
    (Interacción con principio 8: aquí es ENTRENO, no dieta; el guardarraíl cubre el flanco
    médico sin castrar la utilidad.)
- **Coste**: solo en turnos con intención de entreno se añaden ≤7 contenidos de sesión
  (cientos de tokens a ~1–2k). Uso puntual → margen holgado sobre el ~€2/mes actual.

## Impacto en Coach/Chat/Visita
- **Chat**: es el objeto de la feature (contexto + comportamiento nuevos, condicionales).
- **Coach**: se beneficia gratis del arreglo de dato **si** se decide emitir también el
  contenido de la sesión de hoy en `dayContext` — **fuera de alcance de F21** (Coach es
  proactivo/breve; meterle el WOD completo es otra discusión). F21 se limita al Chat.
- **Visita/estimadores**: sin cambios (frontera dura).

## AC (numerados; 🖐 = valida Alex con el pulgar)
1. 🖐 «¿Puedes leer mi sesión de hoy?» → el Chat **lista los ejercicios reales** del contenido,
   no solo el título. (El bug de origen queda muerto.)
2. 🖐 «Me duele el hombro, adáptame hoy» → propone sustituciones de los movimientos que cargan
   hombro + alternativa antagonista/movilidad, orientativo.
3. 🖐 **Equilibrio (el alma)**: «esta semana quiero descansar el hombro» → al adaptar varios
   días, **no apila pierna lunes y martes** (ni el mismo grupo en días consecutivos); reparte.
4. 🖐 **Coach conversacional**: no vuelca la semana sin pedirla; propone y deja que Alex decida,
   ajustando en el diálogo.
5. 🖐 **Solo lectura**: nunca afirma haber modificado/guardado el entreno; si Alex quiere
   conservarlo, le dice que lo meta a mano.
6. Un día **sin sesión importada** → dice que no la tiene; **no inventa** un WOD.
7. **Seguridad**: la adaptación se presenta como orientativa; ante lesión real/persistente
   sugiere fisio/coach; no diagnostica ni prescribe tratamiento.
8. Turno **sin** relación con entreno (p. ej. sobre comida) → la detección **no** dispara: sin
   contenido de sesiones en el prompt; comportamiento y coste idénticos a hoy.
9. `detectTrainingAdaptationIntent` cubierta por tests (disparadores canónicos + no-disparo).
10. Batería de regresión del Chat en verde + re-validación de los casos canónicos de F05
    (se tocó el prompt congelado). Sync de doctrina a `04-IA.md`.

## Riesgos / decisiones discutibles (para la aprobación)
1. **Detección de intención vs. determinismo del bug de origen.** Se eligió on-demand (deseo de
   Alex, decisión 3) en lugar de meter la sesión de hoy siempre. Mitigación: recall generoso +
   tests de disparo (AC 9) para que «léeme la sesión» dispare siempre. Riesgo residual: un
   falso negativo raro; aceptable y testeable.
2. **Ventana de «la semana» (Fase 2).** Propuesto: sesiones del plan vigente desde hoy hasta el
   fin de la semana del plan (≤7). Acota coste y da material para el equilibrio. Ajustable.
3. **Presupuesto de prompt (lección 4).** El contrato del Chat ya es largo y en tensión; se
   añade un bloque más. Se declara cada interacción (arriba). Vigilar: si el bloque no sostiene
   el comportamiento, no es el prompt — es señal de partir la superficie o subir de modelo.

## Fases
- **Fase 1 · Leer y adaptar el DÍA.** Detección de intención + contenido de la sesión de hoy en
  el contexto del Chat + bloque de comportamiento (sustituciones, movilidad, antagonistas,
  escalados; orientativo; solo lectura; anti-invención). Cubre AC 1, 2, 5, 6, 7, 8, 9. **Mata el
  bug de origen y resuelve el «hoy me duele, adáptame» de inmediato.**
- **Fase 2 · Adaptar la SEMANA con equilibrio.** Lectura de la ventana de la semana bajo
  intención + comportamiento de reparto entre sesiones + postura de coach conversacional/
  incremental. Cubre AC 3, 4. **La parte ambiciosa (el alma).**
