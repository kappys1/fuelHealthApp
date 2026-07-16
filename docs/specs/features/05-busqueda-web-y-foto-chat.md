# F05 · Chat inteligente: criterio realista + comer fuera (web/foto)
**Estado**: aprobada (2026-07-16; Fase 0 desplegada · Fase 1 IMPLEMENTADA, pendiente de validación 🖐 en producción) · **Tamaño**: feature (3 fases — Fase 0 reconstruye el prompt congelado F-IA-8; Fase 1 añade `googleSearch` en la route + toggle global en Ajustes; Fase 2 añade foto-en-chat con UI)
**Fecha**: 2026-07-15 (F1/F2) · **Reencuadrada**: 2026-07-16 (se antepone la Fase 0)
**Origen**: HANDOFF §B3 (2026-07-15) — «hoy en La Tagliatella el Chat no pudo ayudarme con la carta» + sesión product-partner (2026-07-16) — «no es inteligente dándome soluciones y lo tengo que estar guiando yo».

> **Por qué esta spec creció.** F05 nació como «comer fuera con web/foto». Al evaluar el chat
> en uso real (16-jul) salió un problema más profundo y más frecuente: el prompt del chat está
> en un **parche-treadmill** (DECISIONS #54 → #56 → hoy), y cada parche crea el siguiente
> (el «puedes sumarlas» del #56 es lo que causa que apile arroz+boniato+pan). Además F05 estaba
> escrita sobre una **premisa falsa**: su párrafo se inserta «antes de "Observas y explicas…"»,
> frase que está en el prompt del **coach** (`prompts.ts:165`), NO en el del chat — el chat
> **no hereda los guardarraíles del coach**. Conclusión (product-partner): F05 necesita una
> **reconstrucción del prompt desde principios como Fase 0**, y las fases de web/foto se montan
> encima. Así se toca F-IA-8 **una sola vez** y el chat del día a día se arregla ya, sin esperar
> a la parte web.

## Motivación (casos reales)
- **Día a día (16-jul).** Alex se salta el desayuno y pide repartir los hidratos. El chat le
  propone **arroz + boniato + pan a la vez** (excesivo, no come así) y, al señalárselo,
  sobre-corrige a **480 g de arroz** (irreal) por «clavar» el macro exacto. También **fuga
  pseudociencia** («pierdes grasa, incluida la abdominal») y da **timing pre-entreno afirmando
  descanso** — ambos porque el chat no tiene los guardarraíles del coach. Alex: «teniendo la
  pauta de todo lo que puedo comer, no es inteligente dándome soluciones y lo tengo que estar
  guiando yo».
- **Comer fuera (15-jul, La Tagliatella).** El chat no conoce la carta (solo sus datos) y no
  puede ayudar; Alex acaba pasándole la foto de la carta a otra IA. Lo mismo en el súper con
  **productos de marca**.

## Acta de problemas del chat (lo que la Fase 0 debe resolver de raíz)
1. **No hereda los guardarraíles del coach** → fugó «grasa abdominal» (pseudociencia) y dio
   timing pre-entreno en día de descanso. *(bug de seguridad)*
2. **Anti-invención mal calibrado** → exigía macros de alimentos comunes en vez de aplicar la
   equivalencia obvia (macarrones ≈ su arroz). *(parcheado 16-jul, pendiente de desplegar/absorber aquí)*
3. **«Consúltalo con tu nutri» sobre-dispara** *(DECISIONS #54)*.
4. **«Puedes sumarlas» (#56) → apila fuentes** (arroz+boniato+pan) y raciones absurdas (480 g).
5. **Optimiza «clavar exacto» en vez de «acércate sin pasarte / realista»** — el núcleo.
6. **No distingue modos**: sobrio por defecto vs *clavar* (pre-competición / fin de día sin más
   comidas / se lo pides) vs *me he pasado → compensar a la baja*.
7. **No propone equivalencias ni menús fuera de pauta** que le interesen, ni se lo ofrece.
8. **Incoherencia de contexto** (afirma descanso mientras aconseja pre-entreno) e inventa
   detalles (la hora «19:30» no estaba en los datos).
9. **«Realista» incluye calidad de la fuente**, no solo la cifra (grasa buena: AOVE/aguacate/
   crema según encaje, no rellenar por rellenar).

## Alcance
### Fase 0 · Reconstrucción del prompt (sin infra)
Reescritura desde principios de `chatSystemPrompt` (F-IA-8), sincronizada a `04-IA.md`. El
prompt nuevo debe encodar, de forma **implícita** (no como lista de parches), este contrato de
comportamiento — cada punto es verificable en la batería de casos canónicos:

- **C1 · Objetivo = cuadrar el día con criterio realista, no clavar.** Por defecto propone
  combinaciones **sobrias** (raciones normales de la pauta) que se **acercan sin pasarse**;
  **dice la verdad del hueco** («con raciones normales te quedas sobre ~148 g; te faltarían
  ~20») y ofrece **una palanca** para cerrarlo si Alex quiere. Nada de raciones absurdas para
  clavar el número (P1/P2: la báscula es el juez, la estimación es contexto).
- **C2 · Opciones del plan = alternativas por comida.** Dentro de una comida propone **1-2
  fuentes de hidrato en ración normal**, no apila 3 almidones. «Sumar» opciones es para
  **proyectar el día** (cómo acabaría), no para amontonar fuentes en un plato. (Afinado del #56:
  se conserva «los macros del plan SÍ están, sumar/proyectar NO es inventar»; se **elimina** la
  lectura de que apilar es lo esperado.)
- **C3 · Modos que detecta** (sin necesidad de que Alex los nombre): día avanzado / última
  comida → compensar lo que falta; **fase especial** (pre-competición/carga) → «clavar» es
  legítimo; **se ha pasado** → cómo seguir comiendo **a la baja** sin pasarse en exceso (a Alex
  no le importa pasarse *un poco* si es sano y sacia). Si lo pide explícitamente, «clavar» vale.
- **C4 · No asume hechos; responde y luego pregunta.** Nunca inventa qué comió, su sesión ni
  sus gustos — eso lo **pregunta**. Pero usa **defaults sensatos** (comida por hora, ración
  base) y **solo pregunta cuando la respuesta cambia de verdad**. Cuando falte un dato, da algo
  útil ya **+ una pregunta** para afinar, en vez de bloquear («te propongo X; ¿o prefieres que
  te busque algo distinto?»). No fabrica detalles no presentes (horas, cantidades).
- **C5 · Anti-invención afinado** (absorbe el fix del 16-jul): el **conocimiento nutricional
  general** (equivalencias entre alimentos comunes, valores medios de tablas españolas) **NO es
  inventar**: úsalo **declarando la asunción** («asumiendo pasta cocida ≈ tu arroz hervido»).
  Inventar es **solo** afirmar qué comió Alex (comidas/cantidades de un día que no figura) o
  citar registros inexistentes.
- **C6 · Fuera de pauta (a + b + c).** (a) equivalencias directas a su plan; (b) sugerir
  comidas realistas **fuera de la pauta** que le cuadren los macros, **marcadas «fuera de tu
  pauta»**; (c) **ofrecérselo proactivamente** («¿te apetece algo distinto hoy?» o proponer él).
  Todo bajo P8: informa/sugiere, **no prescribe** cambios de pauta/objetivos.
- **C7 · Calidad de la fuente.** «Realista» incluye elegir buena fuente (grasa: AOVE/aguacate/
  crema; hidrato/proteína según encaje), no rellenar por rellenar.
- **C8 · Herencia de los guardarraíles del coach** (`prompts.ts:165`): **prohibida la
  pseudociencia** (nada de «grasa localizada» ni «grasa abdominal»); **no diagnóstico clínico**
  (relación a vigilar, no «causa»); **si la sesión de hoy es Descanso o no hay, NO asume
  entreno ni da timing pre/post**; **no sobre-atribución** nutrición↔marca (PRs). Se **unifica**
  la fuente: idealmente un bloque de guardarraíles compartido coach↔chat, para no volver a
  divergir.
- **C9 · Se conserva lo que YA funciona** (no regresión): persona (analista directo, #54),
  **brevedad** (2-4 frases / ~120 palabras salvo que pida lista), uso de macros del plan y de
  comidas registradas, memoria/equivalencia (fajitas del 13-jul), «consúltalo al nutri»
  reservado SOLO a cambios de pauta/objetivos o clínico (NUNCA para «¿qué meriendo con lo que
  me queda?»), español con cifras concretas.

### Fase 1 · Grounding web (la F05 original — se monta sobre el prompt reconstruido)
- **Herramienta `googleSearch` de Gemini** en la route del chat; disparo automático (Riesgos
  §1). Funda la respuesta en la web para cartas de restaurante **y** productos de marca.
- **Cita de fuente obligatoria en el texto** (nombre del sitio o URL) — es además la señal
  visible de que buscó.
- **Fallo elegante** si la web no tiene datos fiables: lo dice y, en su lugar, estima
  aproximado (marcado como estimación) o pregunta lo que falte (ya es C4/C5 del prompt nuevo).
- **Interruptor global en Ajustes (`chatWebSearch`, default ON).** ON → el chat puede usar
  internet (disparo automático); OFF → el chat vuelve al comportamiento de la Fase 0 (sin la
  tool `googleSearch` **y** sin el párrafo web en el prompt — ambos atados al mismo flag). Es un
  **freno de coste**, no un toggle por mensaje (ver Riesgos §2). Persiste en la tabla `settings`
  (key/value jsonb existente): **sin migración**, ya cubierto por export/restore.

### Fase 2 · Foto en el chat (la F05 original)
- Adjuntar imagen (etiqueta de producto / plato / carta) al composer del hilo; el chat la
  evalúa contra la dieta/objetivos del día. Foto **efímera, no se almacena**.

## NO-alcance
- **NO puente al registro** (decisión firme, protege P2): el chat es **asesor**. Las cifras de
  web/foto y las estimaciones son **orientativas para decidir**, NO un registro. Se apunta por
  el flujo normal (sheet de añadir). El **estimador** (F-IA-1/2/4, `temperature 0`, **sin web**)
  sigue siendo la única vía de logging.
- **NO** web/foto en Coach, Preparar-visita ni el estimador — frontera dura del principio 2.
  La Fase 0 SÍ toca la **redacción** heredada (guardarraíles compartidos), pero **no cambia el
  comportamiento** del coach ni sus AC.
- **NO** `urlContext`, `googleMaps`, ni «reservar/pedir». Solo `googleSearch` (+ foto en F2).
- **NO** chips de fuentes ni «Search Suggestions» de Google; la cita va **en el texto** (calca
  el streaming actual, sin reescribir el cliente).
- **NO** migración, ni cambios en export/restore/migrate:poc (todo vive en el texto del mensaje,
  que ya se persiste).
- **NO** se toca `temperature` (0.3), el resumen del hilo, ni los chips existentes del chat.
- **NO** es un rediseño de la UI del chat: la Fase 0 es solo texto de prompt + tests.

## Momento de uso (09 §1)
«Pregúntale a tus datos». La Fase 0 mejora el uso **diario** (cuadrar el día). Las Fases 1-2
amplían a **comer fuera / decidir un producto**, frecuencia baja (findes, compras puntuales).
No añade superficie permanente: vive en el chat (pestaña existente); la foto se adjunta en el
composer (Fase 2).

## Datos
Sin schema nuevo, sin migración, sin impacto en export/restore/migrate:poc en ninguna fase.
**Fase 1 añade el setting `chatWebSearch`** (bool, default `true`) en la tabla `settings`
(key/value jsonb existente, misma vía que `sessionByWeekday`/tema): sin migración; export/restore
ya lo cubre (vuelca la tabla entera). La
respuesta (incluida la cita de fuente) se persiste como texto del mensaje, igual que hoy. La
imagen de Fase 2 se envía en el cuerpo y se pasa a Gemini; **no se almacena** (foto efímera de
consulta, no un registro — a diferencia de F-IA-1).

## Flujo (09)
- **Fase 0**: sin UI. Reescritura de `chatSystemPrompt` + (recomendado) extracción de un bloque
  de guardarraíles compartido coach↔chat + sync a `04-IA.md` + batería de tests del builder.
- **Fase 1**: `googleSearch` en `streamText` de `POST /api/ai/chat`, **condicionado al setting
  `chatWebSearch`** (default ON); **un toggle en Ajustes** (09 §2, junto a tema/import/export)
  para encenderlo/apagarlo. El párrafo web del prompt y la tool se atan al mismo flag.
- **Fase 2**: botón de **adjuntar imagen** en el composer; cuerpo del chat acepta imagen
  opcional (base64); `streamText` recibe mensaje multimodal (bloque `file` + texto, patrón de
  `server/ai/client.ts:buildMessages`).

## IA
Modelo: `AI_MODEL_CHAT`. `temperature 0.3` y `thinkingLevel` sin cambios. Streaming de texto
(`toTextStreamResponse`) sin cambios. La herramienta de Fase 1 es `google.tools.googleSearch({})`
(provider-executed). La cita de fuente se obtiene **vía prompt**, no vía UI de
`groundingMetadata`.

**Prompt CONGELADO — reconstrucción completa (Fase 0), a sincronizar con `04-IA.md`.** El
contrato es C1-C9 de arriba. Borrador de trabajo (se **autora e itera en Etapa 4 contra la
batería**; no congelar la redacción exacta hasta que la batería pase):

> HOY es {today} ({weekday}). Eres el analista de rendimiento de Alex: directo y concreto, al
> grano, sin relleno. {atleta}
> Sobre TUS datos (dieta, registro, tendencia, medidas) respondes SOLO con lo proporcionado.
> **Anti-invención:** el conocimiento nutricional general (equivalencias entre alimentos
> comunes, valores medios de tablas españolas) NO es inventar — úsalo declarando la asunción
> («asumiendo pasta cocida ≈ tu arroz hervido»); a «voy a comer X, ¿cuánto añado?» responde a
> la primera con la equivalencia, no pidas los macros. Inventar es SOLO afirmar qué comió Alex
> (comidas/cantidades de un día que no figura) o citar registros inexistentes; tampoco fabriques
> horas ni cantidades que no estén en los datos.
> **Tu trabajo:** ayudarle a cuadrar el día con SU pauta con criterio REALISTA. Por defecto,
> combinaciones sobrias: 1-2 fuentes por comida en ración normal — las opciones de cada comida
> son ALTERNATIVAS, no las apiles (nada de arroz+boniato+pan juntos). Sumar/proyectar opciones
> para ver cómo acaba el día SÍ es tu trabajo; amontonar fuentes o inflar una ración a cantidades
> absurdas para clavar un número, NO. Di la verdad del hueco («te quedas sobre X, faltan Y») y da
> UNA palanca para cerrarlo si quiere; acércate sin pasarte, no claves. Elige buenas fuentes
> (grasa: AOVE/aguacate/crema según encaje), no rellenes por rellenar.
> **Modos:** si es fin del día / última comida, compensa lo que falta; en fase pre-competición o
> de carga, clavar es legítimo; si se ha pasado, dile cómo seguir a la baja sin pasarse en exceso
> (pasarse un poco no es problema si es sano y sacia). Si lo pide, clava.
> **No asumas hechos** (qué comió, su sesión, sus gustos): pregúntalos. Pero usa defaults
> sensatos y pregunta solo cuando cambie la respuesta: da algo útil ya + una pregunta para
> afinar, no bloquees.
> **Fuera de pauta:** puedes proponer equivalencias a su plan y también comidas realistas fuera
> de la pauta que le cuadren, marcándolas «fuera de tu pauta»; puedes ofrecérselo tú («¿te
> apetece algo distinto hoy?»). Sugieres, no prescribes.
> **Guardarraíles:** no prescribes cambios de dieta/objetivos ni suplementación (fuera de su
> perfil) — eso es de su nutricionista (puedes sugerir qué preguntarle); reserva «consúltalo con
> tu nutri» SOLO para cambios de pauta/objetivos o temas clínicos, NUNCA para «¿qué meriendo con
> lo que me queda?». No diagnostiques causas clínicas (relación a vigilar, no «causa»). Prohibida
> la pseudociencia (nada de «grasa localizada» ni «grasa abdominal»). No atribuyas causalidad
> nutrición↔marca (PRs): describe co-ocurrencias. Si la sesión de hoy es Descanso o no hay, NO
> asumas que va a entrenar ni des timing pre/post-entreno.
> Sé BREVE: 2-4 frases (~120 palabras), sin preámbulos; extiéndete solo si pide detalle o lista
> (p. ej. un menú). Español, con cifras concretas de sus datos.
>
> [+ secciones de contexto ya existentes: DIETA VIGENTE, TENDENCIA Y ADHERENCIA, MEDICIONES,
> ÚLTIMOS 30 DÍAS, MARCAS, COMIDAS POR ITEM, RESUMEN PREVIO.]

- **Delta Fase 1 (web)** — párrafo que se añade cuando entra `googleSearch` (redacción vigente
  tras la iteración 16-jul contra AC2; ver DECISIONS #63):
  > Cuando Alex pregunte por un plato de restaurante o un producto de marca concretos (sus
  > ingredientes, la carta o sus macros), BÚSCALO en la web y dale PRIMERO esos datos citando la
  > fuente (nombre del sitio o URL); solo después, y si encaja, ofrécele la equivalencia con su
  > pauta — no sustituyas el producto por una opción de su plan sin darle antes lo que pidió. Si
  > la web no da datos fiables, DILO y marca la cifra como estimación (o pídele la etiqueta);
  > NUNCA des macros concretos de un producto de fuera con seguridad sin citar la fuente o sin
  > marcarlos como estimación. Las fuentes colaborativas (p. ej. Open Food Facts) pueden traer
  > datos flojos: trátalas como orientativas y, si no encuentras la variante EXACTA que pide, dilo
  > y marca el dato como aproximado en lugar de pasar el de otra variante como si fuera el suyo.
  > Estas cifras de fuera son ORIENTATIVAS para decidir, NO un registro.
  >
  > _Iteración 16-jul (2 rondas en vivo): (1) draft permisivo → directiva (buscar+citar); (2) log
  > temporal de `sources` confirmó que `googleSearch` dispara (`sources≥1`); el residuo de error es
  > de la fuente (Google surfa Open Food Facts, floja) → nudge de honestidad. Log retirado. AC2
  > mecánico OK (busca+cita); la precisión la limita la web (P2: para cuadrar el día es ruido)._
- **Delta Fase 2 (foto)** — se añade cuando el cliente permita adjuntar imagen: «…de un
  producto, **y PUEDES analizar una foto que Alex adjunte (etiqueta, plato o carta)**.» y, en el
  fallo, «…o pide lo que falte **o que te adjunte una foto**.».

**Manejo de error**: errores del proveedor siempre visibles (`aiErrorResponse`). Si
`googleSearch` no devuelve resultados, el párrafo del prompt gobierna el fallo elegante.

**Coste/uso**: Fase 0 no cambia el coste. Fase 1: grounding a frecuencia baja, marginal
(<5 €/mes). Fase 2: visión puntual, marginal.

## Impacto en Coach/Chat/Visita
- **Chat**: cambia en las 3 fases.
- **Coach / Preparar-visita**: **sin cambio de comportamiento**. La Fase 0 puede **extraer** el
  bloque de guardarraíles a una fuente compartida; si se hace, el prompt del coach debe quedar
  **equivalente** (sus AC previos verdes). Nunca web/foto.
- **Estimador (F-IA-1/2/4)**: **sin cambios** (nunca web) — frontera dura del principio 2.

## AC
**Fase 0 (reconstrucción) — nuevos:**
0.1. **Reparto realista** (caso canónico nº 1): ante el estado del 16-jul (533/1800; faltan
  169 C / 45 P / 40 F) el chat propone una combinación **sobria** (1-2 fuentes por comida,
  raciones normales), **dice el hueco** y ofrece **una palanca**; NO apila arroz+boniato+pan ni
  propone raciones absurdas (480 g arroz). 🖐
0.2. **Equivalencia a la primera** (nº 2): «voy a comer macarrones, ¿cuánto añado?» → aplica la
  equivalencia con su pauta de arroz **declarando la asunción**, sin exigir macros. 🖐
0.3. **Pseudociencia bloqueada**: en ninguna respuesta aparece «grasa abdominal/localizada»;
  test del builder (el prompt contiene el guardarraíl) + revisión en vivo. 🖐
0.4. **Coherencia de sesión**: si la sesión de hoy es Descanso/no hay, no da timing pre/post ni
  asume entreno; si Alex dice que entrena, lo reconcilia (pregunta/ajusta), no se contradice. 🖐
0.5. **Responde y luego pregunta**: ante un dato faltante da algo útil + una pregunta; no
  bloquea con interrogatorio. 🖐
0.6. **Fuera de pauta**: propone equivalencias/menús fuera de pauta marcados «fuera de tu
  pauta» y puede ofrecerlo; nunca prescribe cambios de pauta/objetivos. 🖐
0.7. **No regresión de lo bueno**: brevedad (2-4 frases), macros del plan/registrados, memoria
  de equivalencias, «consúltalo al nutri» reservado — todos los **AC previos de F-IA-8**
  (`prompts.test.ts`) siguen verdes. Persona (#54) intacta.
0.8. Plantilla sincronizada en `04-IA.md`; `pnpm typecheck && pnpm test` en verde.

**Fase 1 (web) — gate de regresión: estos AC ya acordados deben seguir pasando:**
1. «Estoy en La Tagliatella con 844 kcal y 19 g de grasa restantes, ¿qué pido?» → busca en la
   web y sugiere platos de la carta que encajan, **citando la fuente**. 🖐
2. Producto de marca («¿macros del [producto] de [marca]?») → responde citando la fuente. 🖐
3. Restaurante sin macros publicados → lo dice y da estimación **marcada como estimación** (o
   pide ingredientes/ración). 🖐
4. La búsqueda web **no aparece** en Coach, Visita ni estimador (revisión + AC de esas features
   verdes).
5. `chatSystemPrompt` contiene el párrafo de comer-fuera (cita/estimación/no-registro) sobre el
   prompt reconstruido **cuando `chatWebSearch` está ON** — test del builder.
5b. **Toggle web (`chatWebSearch`, Ajustes, default ON):** con OFF el prompt del chat **no** lleva
   el párrafo web y la route **no** añade la tool `googleSearch` (comportamiento idéntico a la
   Fase 0); con ON, sí. Test del builder (párrafo condicionado al flag) + revisión de la route +
   el toggle funciona en vivo. 🖐
6. Sync `04-IA.md`; el café ×3 **no aplica** (el chat es asesor, no logging).
7. `pnpm typecheck && pnpm test && pnpm build` verde; deploy verificado. 🖐

**Fase 2 (foto) — gate de regresión:**
8. Adjuntar foto de **etiqueta de producto** → el chat la evalúa contra la dieta/objetivos. 🖐
9. Foto de **carta** o **plato** + pregunta → sugiere/valora con los mismos guardarraíles. 🖐
10. Enviar sin foto sigue igual (regresión); el cuerpo valida la imagen (tipo/tamaño) con Zod.

## Casos canónicos (batería de validación de la Fase 0)
Conversaciones reales que el prompt reconstruido debe pasar (se comparan a mano, 🖐):
1. **Reparto con hueco grande** (16-jul, desayuno saltado): sobrio + verdad del hueco + una
   palanca. NO arroz+boniato+pan, NO 480 g arroz.
2. **Equivalencia de alimento común**: «macarrones, ¿cuánto añado?» → equivalencia a la primera.
3. **Cena de wraps** (idea de Alex): 210 g pollo + 2 fajitas + verdura → nota que con las
   fajitas ya casi cubre hidratos (arroz mínimo) y redirige al hueco real (grasa, buena fuente).
4. **Comer fuera cualitativo** (sin web): «ceno fuera japonés, ¿qué pido con lo que me queda?»
   → guía cualitativa (prioriza proteína/verdura, modera arroz/postre), sin fingir gramos.
5. **Coherencia de descanso**: día de descanso + «¿me da energía para entrenar?» → reconcilia,
   no se contradice ni inventa timing.

## Riesgos / decisiones discutibles
1. **Reescritura completa del prompt congelado (Fase 0).** Riesgo de perder calidad ya
   acordada. **Mitigación (la red):** la batería de casos canónicos + los **AC de Fase 1/2 y
   los AC previos de F-IA-8 como gate de regresión** — la Fase 0 no se cierra hasta que todos
   verdes. Lo que se **preserva** son las decisiones/comportamientos; lo que se **reescribe** es
   la redacción (que F05 ya contemplaba tocar).
2. **Disparo automático de la web (Gemini decide cuándo buscar)** vs. toggle explícito.
   **Recomendado: automático** — la fricción mata el sistema (P3); la cita de fuente obligatoria
   es la señal visible de cuándo buscó. Reversible. **Matiz (16-jul, Alex):** el toggle POR
   MENSAJE se mantiene descartado (fricción, P3), pero SÍ hay un **interruptor global** en Ajustes
   (`chatWebSearch`, default ON) como **freno de coste** — mientras está ON, el disparo sigue
   siendo automático; OFF apaga la web por completo (vuelta a Fase 0). Anotar en `DECISIONS.md`.
3. **Cita en el texto (por prompt), no chips de `groundingMetadata`.** Mantiene el streaming de
   texto actual. Contra: no son enlaces clicables. Aceptable en app personal de un solo usuario.
   (Anotar en `DECISIONS.md`.)
4. **Guardarraíles compartidos coach↔chat.** Recomendado extraer a una fuente única para no
   volver a divergir (fue la causa raíz de los problemas 1 y 8). Si se hace, el coach debe
   quedar equivalente (sus AC verdes).

## Fases
- **Fase 0 · Reconstrucción del prompt** (esta sesión, prioritaria): reescribe
  `chatSystemPrompt`, unifica guardarraíles, sync `04-IA.md`, batería de tests del builder +
  casos canónicos. **Sin infra.** Despliega el fix diario ya. Se valida en uso real antes de F1.
- **Fase 1 · Web grounding** (IMPLEMENTADA 2026-07-16, DECISIONS #63): `googleSearch` en la
  route + párrafo de comer-fuera + cita de fuente, ambos atados al interruptor global
  `chatWebSearch` (Ajustes, default ON). Sobre el prompt de la Fase 0. Pendiente de
  validación 🖐 en producción (AC 1, 2, 3, 5b, 7).
- **Fase 2 · Foto en el chat**: cuerpo multimodal + botón de adjuntar. Tras validar F1 en uso.

## Prompt estándar de arranque (para Alex, copiar/pegar) — ver el bloque que te paso aparte.
