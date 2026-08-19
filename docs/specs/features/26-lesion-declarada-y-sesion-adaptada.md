# F26 · Lesión declarada y sesión adaptada del día
**Estado**: **CERRADA (2026-08-19)**. Aprobada el 18-ago y **las tres fases implementadas y
desplegadas** en 18-19 de agosto (migración **0021** aplicada a Neon antes del código). AC 4-5,
9-11, 16-17 cerrados con tests; **AC 6-7-8, 12, 13 y 14 usados y validados por Alex en producción**
(el 14 se rehízo tras su feedback, #101); **AC15 (equilibrio entre días) es el único sin verificar
en vivo** — necesita dos días de la semana con uno adaptado; el mecanismo está cubierto por tests
del contexto. Siete correcciones posteriores al despliegue, todas nacidas de su uso real
(DECISIONS **#99–#102**). **Tamaño**:
**feature** (migración aditiva
en `days` + prompt congelado + superficies nuevas en sheet) · **Fecha**: 2026-08-18
**Origen**: conversación con Alex (18-ago) que arrancó como «quiero un apartado de lesiones» y
acabó en otro sitio. Caso real vivo: **hombro derecho tocado desde el 28-jul** (el mismo que
originó F21) y **todavía activo hoy**.

## Motivación (caso real)

Tres hechos verificados en el código durante la conversación, que reencuadran la petición:

1. **El «apartado de lesiones» ya existe y no sirve.** `athleteProfile.lesiones: string[]`
   (`lib/profile.ts:39`), chips en Ajustes (`athlete-profile-editor.tsx:251`), y ya llega a
   toda la IA vía `athleteContext` (`prompts.ts:42-47`, repartido en `ai/athlete.ts:47`).
   Falla por dos motivos estructurales:
   - **Dice la zona, no la capacidad.** `Lesiones: hombro derecho` obliga al modelo a suponer,
     y cuando un LLM supone sobre una lesión **sobre-frena** (ley del péndulo aplicada al dato).
     Lo que el coach necesita es *«NO: nada por encima de cabeza, press, kipping. SÍ: tirón
     horizontal, peso muerto, todo de pierna»*.
   - **Es destructivo.** Al curarte quitas el chip y desaparece que estuviste lesionado. Es lo
     contrario de `objetivos[]`, en el mismo archivo: historial fechado que nunca se edita.
     Además Alex declara (18-ago): **«ahora mismo ni me acuerdo de quitarla»** — cualquier
     diseño que dependa de que él cierre la lesión está muerto antes de empezar.
2. **«Subir el entreno y hablarlo» ya está hecho**: F21 (cerrada 29-jul, AC 1-5 validados en
   producción). El Chat lee `training_sessions.contenido` bajo detección de intención y adapta
   con equilibrio entre sesiones.
3. **F21 predijo esta conversación.** Su NO-alcance del 29-jul: *«el "estoy tocado hasta ~fecha
   y el Coach lo recuerda" es la jugada conectada del backlog B3 (patrón «implantes muriendo en
   el hilo») → fast-follow natural, no ahora»*. Tres semanas después Alex ha vuelto solo al
   mismo punto. Uso real, no brainstorming.

**Lo que falta**, por tanto, no es un apartado: es (a) que la limitación se exprese como
**capacidad** y sobreviva al hilo, y (b) que la adaptación sea un **artefacto guardado** en vez
de texto que muere en el chat.

### La idea que aporta Alex y que fija la arquitectura

> «Si hoy tengo sesión de lesión porque le he dado al botón, el chat responde sobre eso. Si
> mañana no le digo nada, aunque se marque lesión, el chat ve la sesión normal y como mucho me
> preguntará si estoy lesionado.»

**Adaptar es un acto explícito, nunca un estado automático.** La lesión declarada NO adapta
nada por sí sola; como mucho hace que la app pregunte. Esto neutraliza el riesgo del punto 1
(la lesión eterna): aunque Alex no la cierre jamás, no le arruina un solo entreno.

Y resuelve de paso la preocupación original («si adapto en el chat no queda trazabilidad»): la
sesión adaptada, guardada con su motivo y su fecha, **es** la traza.

## Alcance

**Nomenclatura**: no es «sesión de lesión» sino **sesión adaptada + motivo**. El motivo puede
ser una lesión, una sobrecarga, haber dormido mal o tener 40 minutos. La lesión activa solo
**prerrellena** el motivo. (Término para el GLOSARIO al cerrar.)

- **La lesión es un episodio fechado con capacidad**, no un chip: `zona`, `capacidad` (texto
  libre: qué puede y qué no), `desde`, `revisarEl`, `cerradaEl?`. Se cierra poniendo fecha,
  **nunca borrando**.
- **No se declara fecha de fin, se declara fecha de revisión** (14 días por defecto, confirmado
  por Alex). Al vencer, la app pregunta **una vez**: sigue igual · va mejor · ya está. Es más
  honesto que un `hasta`: las lesiones se difuminan, no terminan un día — y no depende de que
  Alex se acuerde.
- **La lesión vigente entra en el contexto de IA** con su capacidad completa; **la cerrada sale
  del contexto** (nada de escalar por un hombro curado en marzo) **y entra en el Historial**.
- **Botón «Adaptar sesión»** en la ficha del día: motivo (prerrellenado si hay lesión vigente,
  editable) → generación IA → **composer prerrellenado y editable** → guardar.
- **La ficha del día muestra las dos**: la planificada (del plan, inmutable) y la adaptada.
- **El Chat es consciente de la adaptada**: si existe, habla sobre ESA; si no y se la pides, la
  genera y ofrece **una acción explícita para guardarla** (patrón «Guardar en Mis productos»);
  si hay lesión vigente sin adaptar, **como mucho pregunta una vez**.
- **El equilibrio entre sesiones de F21 usa lo realizado**: para cada día de la ventana,
  adaptada si existe, planificada si no.
- **Editar la adaptada a mano**: sí, y por el mismo sitio. **Una sola puerta de guardado** (el
  composer) con tres orígenes: botón de la ficha, Chat, o manual en blanco. Nunca se guarda
  nada sin verlo antes.

## NO-alcance (y por qué)

- **NO se toca `training_sessions.contenido`.** El plan de The Progrm es la fuente de verdad y
  sigue intacto; la adaptación vive en el día. Mantiene el «no» firme del 29-jul y permite
  distinguir «cambió el programa» de «cambié yo por el hombro».
- **NO se recalculan las kcal de la sesión adaptada.** Verificado: `sessionKcal` va **solo** al
  contexto de IA, emitido como `(~620 kcal, contexto ±25%)` (`context.ts:711`); no aparece en
  `server/analytics/`, ni en el FuelGauge, ni en el objetivo del día, ni en el déficit, ni en la
  adherencia. Afinar una cifra autodeclarada aproximada que no entra en ningún cálculo es teatro
  de precisión (principio 2) y el sesgo lo absorbe la báscula (principio 1). Además el modelo ya
  recibe el **contenido real** de la adaptada, así que no le despista.
- **NO hay capa de «semana adaptada» en paralelo.** Adaptar «toda la semana» son N días
  escritos. Una estructura paralela traería export/restore, undo y la pregunta fea de quién es
  la verdad para el Chat: producto disfrazado de feature (guardarraíl doc 11).
- **NO dos versiones adaptadas del mismo día.** Regenerar **pisa** con toast de deshacer
  (convención de la casa). Decisión tomada por defecto ante la ausencia de un caso creíble.
- **NO tarjeta permanente en Hoy** (09 §6). La revisión de lesión es un paso condicional dentro
  del check-in matinal que ya existe.
- **NO en Coach/Visita/estimadores** más allá del contexto de atleta que ya reciben. La
  generación y el diálogo de adaptación son frontera dura del Chat + el botón (igual que la
  web-search de F05).
- **NO diagnostica ni trata**: se hereda el guardarraíl de seguridad de F21.
- **NO el Chat declarando la lesión por su cuenta** («me duele el hombro» → ¿la guardo?). Es la
  💡 de los implantes (B3, 15-jul). Fast-follow natural una vez exista el dato con fechas.

## Momento de uso (09 §1)

- **Declarar/revisar la lesión**: Ajustes → Perfil del atleta (donde ya vive), y la revisión
  vencida aparece en el **check-in matinal**. Frecuencia: rara (cuando algo empieza a doler) +
  una confirmación cada 14 días mientras dure.
- **Adaptar la sesión**: ficha del día o Chat, en el momento de ir al box. Frecuencia: puntual,
  solo los días que hace falta.
- **Consultar la adaptada**: ficha del día. Sin superficie nueva permanente.

## Datos

**Fase 1 — sin migración de BD** (`athleteProfile` es un setting jsonb):

```ts
interface Lesion {
  id: string;             // estable, para editar/cerrar sin ambigüedad
  zona: string;           // "hombro derecho"
  descripcion?: string;   // "manguito rotador, dx del fisio" (opcional)
  capacidad: string;      // TEXTO LIBRE — qué SÍ y qué NO. El campo que importa.
  desde: string | null;   // 'YYYY-MM-DD'; null en los chips migrados (no se inventa)
  revisarEl: string;      // 'YYYY-MM-DD' (desde + 14 por defecto)
  cerradaEl?: string | null;      // cerrar = poner fecha, NUNCA borrar
  cierreAproximado?: boolean;     // la fecha de cierre casi siempre lo es
}
```

- **Vigente** = `cerradaEl == null`. **Vencida** = vigente && `revisarEl <= hoy` (enmienda de
  implementación, DECISIONS #98: con `<` la revisión llegaría el día 15, no el 14 del AC3, y el
  chip migrado —`revisarEl = hoy`— no aparecería vencido hoy como pide el punto siguiente).
- **Capacidad en texto libre, no checkboxes de movimientos**: el consumidor es un LLM y Alex lo
  escribe mejor en dos líneas que cualquier taxonomía.
- **Migración del valor viejo sin pérdida**: el normalizador de `settings-map.ts:82-86` convierte
  cada `string` en `{ zona: <string>, capacidad: "", desde: null, revisarEl: hoy }` → aparece
  vencida y la primera revisión pide la capacidad. 0 pérdidas. Implementado en **dos** puertas
  (#98): ahí (restore + `migrate:poc`) **y** en `getAthleteProfile()`, porque la fila que hay hoy
  en la BD sigue guardando `string[]` hasta que Alex guarde el perfil. Ids **deterministas**
  (`legacy-N`): con ids aleatorios, la lectura que pinta el check-in y la que atiende la
  respuesta no coincidirían y la revisión no encontraría la lesión.
- **Cierre aproximado**: se marca como tal, igual que el episodio de hinchazón en diferido
  (GLOSARIO) — una fecha inventada sin declararse es el mismo pecado.

**Fase 2 — migración aditiva** en `days`:

```
adapted_session  text          -- contenido de la sesión adaptada
adapted_reason   text          -- motivo ("hombro derecho", "sobrecarga", "solo 40 min")
adapted_at       timestamptz   -- cuándo se generó/guardó
```

- **Impacto**: export/restore y `migrate:poc` transportan los tres campos. `days` ya es la tabla
  del día y esto es 1:1 con ella → columnas, no tabla nueva.

**Fase 3**: sin datos nuevos.

## Flujo (dónde vive)

**Fase 1**
1. Ajustes → *Perfil del atleta* → la sección «Suplementos y lesiones» parte en dos: suplementos
   siguen como chips; **lesiones pasan a lista de episodios** con su editor (zona, capacidad,
   desde, revisión) y las cerradas plegadas debajo.
2. Progreso → **Historial** (doc 10 B4): entrada nueva `kind: "lesion"`, `date = desde`, con
   `cerradaEl` si la tiene. Solo lectura, como el resto del timeline. Una lesión **sin `desde`**
   (chip migrado) se queda fuera hasta que Alex le ponga fecha: un timeline se ordena por fecha
   y no se le inventa una (#98).
3. **Check-in matinal** (`components/hoy/checkins.tsx`, `CheckinMatinal`): paso extra **solo si
   hay lesión vencida** → *sigue igual* (+14 d) · *va mejor* (reescribir capacidad, +14 d) ·
   *ya está* (cerrar con hoy, marcado aproximado). No aparece ningún otro día. Con **varias**
   vencidas pregunta por **una, la más atrasada** (una decisión por pantalla, 09 §6); el resto,
   en los siguientes check-ins o de golpe en Ajustes.

**Fase 2**
4. Ficha del día (`components/training/training-session-detail.tsx`) → botón **«Adaptar sesión»**.
5. Sheet: **motivo** (texto libre, prerrellenado con la **zona** de la lesión vigente si la hay —
   enmienda #99: la capacidad son dos frases y esto es un campo de una línea; la capacidad viaja
   al prompt desde el servidor) → ✨ generar.
6. La salida cae en un **textarea editable** de la misma hoja, con el formateador de F25
   (`formatOrKeep`) aplicado. Alex revisa, toca lo que quiera, guarda.
   **Enmienda #99**: la hoja es `components/training/adapted-session-sheet.tsx`, NO
   `TrainingSessionComposer` — aquel guarda en `training_sessions`, justo lo que el NO-alcance
   prohíbe y el AC9 testea. Guardar con el texto vacío **quita** la adaptada.
7. Guardar escribe `days.adapted*`. Si ya había una, **pisa con toast de deshacer**. Regenerar
   parte SIEMPRE de la planificada, nunca de la adaptada anterior (#99).
8. La ficha pasa a mostrar **planificada + adaptada**, con la planificada marcada como «del plan».

**Fase 3**
9. `src/app/api/ai/chat/route.ts`: el contexto que ya se ensambla por turno añade, bajo la
   detección de intención existente (`detectTrainingAdaptationIntent`), la sesión **adaptada** del
   día si existe, y el flag de lesión vigente sin adaptar.
10. Bajo una respuesta del Chat cuya intención disparó, la **app pinta** una acción. **El modelo no
    guarda ni dice que guarda** (ni menciona la interfaz).
    **Enmienda #101, con evidencia de uso el mismo día**: la acción NO es «Guardar como sesión
    adaptada de hoy» prerrellenando el editor con el texto de la respuesta. **El Chat conversa, no
    produce sesiones**: su respuesta es consejo en prosa, y pegarlo en `adapted_session` mete prosa
    donde va un entreno. La acción es **«Adaptar la sesión de hoy»** y abre la misma hoja con el
    **motivo en las palabras de Alex** (su último mensaje que disparó la intención, editable) y el
    contenido vacío → la sesión la produce el ✨ del paso 5, que ya sale con la estructura del plan.

## IA

**Fase 2 · `adaptSessionPrompt(...)`** (función nueva en `server/ai/prompts.ts`, congelada al
cerrar, cubierta por `prompts.test.ts`):
- **Modelo**: `AI_MODEL_COACH`. **`temperature: 0`** (regla de la casa; no necesita la excepción
  0.3 del Chat: es una generación única que Alex revisa y edita antes de guardar).
- **Entrada**: contenido de la sesión planificada + motivo + capacidad de la lesión vigente +
  contexto de atleta.
- **Salida**: **texto plano** con el formato de `contenido` (luego pasa por `formatOrKeep`, F25).
  Sin esquema: es exactamente la forma que ya maneja el composer.
- **Sin café ×3** (no se toca ningún estimador).

**Fase 3 · bloque en `chatSystemPrompt(...)`** (prompt CONGELADO — sync de doctrina a `04-IA.md`
y re-validación de AC según DECISIONS #70). Declara sus interacciones (lección 4 · presupuesto
de prompt):
- *La adaptada manda*: si hoy hay sesión adaptada, es la sesión de hoy; la planificada es
  referencia. (Interactúa con el «lee el entreno real» de F21.)
- *Preguntar, no adaptar*: si hay lesión vigente y hoy **no** hay adaptada, puedes preguntar
  **una vez** si sigue afectando — nunca adaptar por tu cuenta. **La condición viene dada en el
  contexto, no se deduce**: dato > prompt, para que no sea un ruego que se olvida en el turno 12.
- *Equilibrio sobre lo realizado*: al repartir carga, cada día vale por su adaptada si existe.
- *Solo lectura, matizada*: sigues sin modificar ni guardar nada; existe una acción de la app que
  Alex pulsa. **No afirmes haber guardado.**
- **Coste**: sin cambio material. Solo bajo intención se añade el contenido de la adaptada (que
  sustituye, no suma, al de la planificada) + una línea de flag.

## Impacto en Coach/Chat/Visita

- **Chat**: objeto de la Fase 3 (contexto + comportamiento nuevos, condicionales).
- **Coach**: recibe **gratis** la lesión vigente (Fase 1) porque ya consume `athleteContext`. No
  se le mete la sesión adaptada: es proactivo y breve, frontera dura como en F21.
- **Preparar visita**: recibe **gratis** la lesión vigente por la misma vía. Útil de verdad —
  «he entrenado tocado del hombro desde el 28-jul» es contexto que Regenera querrá.
- **Estimadores** (`athleteContextCompact`): sin cambio. Una lesión no altera los macros de un
  alimento.

## AC (numerados; 🖐 = valida Alex con el pulgar)

**Fase 1**
1. 🖐 Declaro el hombro con su capacidad («NO por encima de cabeza…; SÍ pierna, tirón
   horizontal») y el Chat, en un **hilo nuevo sin contarle nada**, la conoce y no me pide que se
   la repita.
2. 🖐 Cerrar una lesión **no la borra**: desaparece del contexto de IA y aparece en el Historial
   con sus fechas.
3. 🖐 A los 14 días, el check-in matinal me pregunta **una vez** por la lesión vencida; los demás
   días no aparece nada.
4. Los chips viejos se convierten en episodios **sin pérdida** (test del normalizador).
5. El cierre se marca como **aproximado** cuando no es del día.

**Fase 2**
6. 🖐 **VALIDADO (18-ago, 2ª pasada)**. «Adaptar sesión» con el motivo prerrellenado por la lesión
   vigente → me da una sesión coherente con mi capacidad, y **la puedo editar antes de guardar**.
   *La 1ª pasada FALLÓ por sobre-frenado (DECISIONS #100); con la regla incondicional «ante la
   duda, mantén» y un motivo operativo, Alex lo da por bueno y confirma que además edita a mano
   lo que quiere añadir.*
7. 🖐 **VALIDADO**. Puedo escribir un motivo que **no** sea una lesión («sobrecarga»,
   «solo 40 min») y funciona igual.
8. 🖐 La ficha del día muestra **las dos**, y la planificada se ve claramente como la del plan.
   **Ampliado en implementación (18-ago, lo pilló Alex en 10 segundos)**: la ficha del día no es
   solo la de Hoy — **Plan · Entrenos también es una vista por día** (tiene selector de día), y
   allí la adaptada no aparecía: la app contaba **dos verdades según la pestaña**, justo lo que
   F22 vino a matar. Ahora sale en las dos, con la misma tarjeta. En Plan es **solo lectura**
   («Ver en Hoy»): se adapta y se edita donde vive el día.
9. `training_sessions.contenido` **no cambia** tras adaptar (test).
10. Regenerar **pisa** con toast de deshacer; deshacer restaura la anterior.
11. Export/restore y `migrate:poc` transportan `adapted_session/reason/at` (test).

**Fase 3**
12. 🖐 **Verificado en vivo (18-ago)**, pendiente del pulgar. Con adaptada guardada hoy → el Chat
    habla de **esa** sesión, no de la planificada. *Hilo nuevo, «¿qué entreno tengo hoy?» →
    «Hoy tienes una sesión adaptada por la molestia del hombro derecho…» con el contenido de la
    adaptada.*
13. 🖐 **Verificado en vivo**. Sin adaptada y con lesión vigente → **como mucho pregunta una vez**
    si sigue afectando; no adapta solo. *Presentó la sesión del plan tal cual y cerró con «¿Te
    sigue limitando el hombro derecho o la rodilla para proponerte adaptaciones, o vas a probarlo
    tal cual?».*
14. 🖐 **Reabierto y rehecho el 18-ago tras probarlo Alex (#101)**. Le pido la adaptación al Chat →
    me la da (en prosa, y está bien que sea prosa) y aparece **«Adaptar la sesión de hoy»**, que
    abre el editor con **mi motivo** ya escrito y editable; el ✨ genera la sesión de verdad. El
    Chat **no afirma** haber guardado nada ni habla de la interfaz *(comprobado sobre la respuesta
    real contra una lista de frases prohibidas)*.
15. 🖐 **Equilibrio (el alma de F21, ahora honesto)**: lunes planificado hombros → adapto a
    pierna → el martes el Chat **no me mete pierna otra vez**.
16. ✅ Turno sin relación con entreno → no dispara: contexto y coste idénticos a hoy. *Todo lo
    nuevo vive DENTRO del bloque que ya se añadía bajo intención, así que lo garantiza el mismo
    mecanismo de F21: test de prompt byte-idéntico sin `trainingContext`.*
17. ✅ Batería de regresión de **F21 y F05** en verde con el AC5 de F21 reescrito. Sync de doctrina
    a `04-IA.md`. *El AC5 pasa a «no guarda ni afirma haber guardado; la app ofrece una acción que
    Alex pulsa» y se retira la coletilla «dile que la meta él por el flujo normal», que era falsa
    desde la Fase 2. El texto del Chat no cambia de naturaleza: sigue sin emitir ningún comando —
    el botón lo pinta la app (patrón F14·B).*

## Riesgos / decisiones discutibles (para la aprobación)

1. **Se reescribe un AC ya validado en producción.** F21 AC5 decía «nunca afirma haber
   modificado/guardado el entreno». Pasa a «nunca guarda ni afirma haber guardado; la app puede
   ofrecer una acción que Alex pulsa». **Mitigación**: la acción la pinta la app, no la emite el
   modelo (patrón F14·B, `meal-row.tsx:358`) → el texto del Chat sigue siendo el de siempre.
   Aun así, es prompt congelado: re-validación completa de F21 + F05.
2. **Presupuesto de prompt (lección 4).** El contrato del Chat ya es largo y en tensión, y le
   añadimos la capa «adaptada vs planificada». Se declaran las interacciones arriba. **Señal de
   alarma**: si el bloque no sostiene el comportamiento tras un ajuste, no es el prompt — es
   partir la superficie o subir de modelo. No parchear dos veces (ley del péndulo).
3. **La lesión que no se cierra jamás.** Mitigado por diseño (no adapta sola) y por la revisión a
   14 días. Riesgo residual: una lesión fantasma en el contexto de IA si Alex ignora la revisión
   muchas veces. **Aceptado**: el coste es una línea de contexto, no un entreno arruinado.

## Fases

- **Fase 1 · La lesión como episodio con capacidad.** Perfil, contexto de IA, Historial, revisión
  en el check-in. Cubre AC 1-5. **Sin migración de BD.** Barata, no depende de nada, y le da el
  motivo prerrellenado a la Fase 2.
- **Fase 2 · La sesión adaptada del día.** Botón, generación, composer editable, guardado, ficha
  con las dos. Cubre AC 6-11. **Migración aditiva.** Sirve sola, sin tocar el Chat.
- **Fase 3 · El Chat consciente.** Contexto de la adaptada, pregunta condicionada, acción de
  guardado, equilibrio sobre lo realizado. Cubre AC 12-17. **Es la que tiene el riesgo de
  prompt**; llega con las otras dos ya en producción.
  **Evidencia de uso real que la justifica (18-ago)**: Alex escribió *«…el HSW por qué lo
  cambio?»* **dentro del campo de motivo**. El botón devuelve una sesión, no una conversación, así
  que la pregunta se quedó sin responder y la sustitución sin justificar. No es un fallo de la
  Fase 2 —esa superficie es de un solo tiro a propósito—, es exactamente el hueco que llena el
  Chat. Cuando se implemente, mirar si la acción «Guardar como sesión adaptada» debe poder
  llegar también **desde una pregunta sobre una adaptada ya guardada** («¿por qué me quitaste
  X?» → responde y ofrece regenerar), y no solo desde una propuesta nueva.

---

## Cierre (2026-08-19)

**Desplegada entera.** Requisitos de deploy consumidos: migración **0021** (aditiva:
`days.adapted_session/reason/at`), aplicada a Neon **antes** del código — sin ella `Hoy` revienta.
Sin variables de entorno nuevas. Feature de IA nueva: **F-IA-12** (`adaptSessionPrompt`,
`AI_MODEL_COACH`, texto plano, `ADAPT_SESSION_MAX_OUTPUT_TOKENS = 8192`).

### Lo que enseñó implementarla

Siete correcciones después de desplegar, **todas** salidas de los tres primeros usos de Alex y
**ninguna** de la revisión previa. Cuatro comparten la misma forma y por eso la lección es una:

| # | Se reutilizó / decidió… | …por lo que parecía | Lo que de verdad era |
|---|---|---|---|
| #99 | `TrainingSessionComposer` | «un editor de sesión» | escribía en `training_sessions`, prohibido por la propia feature |
| #100 | «no recortes lo que la capacidad permite **explícitamente**» | una regla | dependía de que Alex hubiera escrito bien un campo |
| #101 | `detectTrainingAdaptationIntent` | «esto va de entreno» | «inyecta contexto, que es barato equivocarse» (recall generoso a propósito) |
| #102·1 | «bloques separados por una línea en blanco» | una descripción del formato | una orden de **insertar** separadores que el original no tiene |

**Antes de reutilizar una pieza, mirar para qué se diseñó, no a qué se parece.** Y, en las reglas
de comportamiento de un prompt: **una regla que depende de que el usuario haya rellenado bien un
campo solo protege a quien no la necesita**.

Dos más, del mismo día: el techo de tokens hay que dimensionarlo por el **tamaño de la salida que
pide el prompt** (cuarta vez con esa piedra, #48/#52/#59 → #100), y una restricción de producto
inventada sobre la marcha («el día vive en Hoy», #102·3) que el propio diseño de la pantalla
desmentía.

### Queda pendiente

- **AC15 🖐** (equilibrio entre días): adaptar un día a pierna y preguntarle al Chat al siguiente.
- 💡 **Preguntar sobre una adaptada ya guardada** («¿por qué me quitaste X?» → responde y ofrece
  regenerar). Salió de que Alex escribió esa pregunta **dentro del campo de motivo** de la Fase 2.
- La **capacidad** del perfil sigue siendo descriptiva, no operativa. No es un fallo del código:
  con una capacidad SÍ/NO el generador mantiene lo permitido (verificado en vivo). Es la palanca
  que más mejora el resultado y depende del dato, no del prompt.
