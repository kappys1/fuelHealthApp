# Conversación · 3-ago-2026 — «¿Me ha ensuciado las estadísticas el fin de semana?»

> **Skill**: `fuelboard-product-partner` (Etapas 1-3 del doc 11)
> **Resultado**: `docs/specs/features/22-progreso-una-sola-verdad.md` — aprobada el 3-ago,
> cerrada el 5-ago (AC 10, 11, 12 y 13 validados; 10b pendiente hasta el 1-sep por falta de
> meses cerrados, no por falta de implementación).
> **Por qué se guarda**: la conversación destapó **3 bugs verificados en código** partiendo
> de una duda de uso, y contiene el razonamiento que la spec sólo resume. Incluye también
> un error mío corregido a media conversación, que es parte de lo aprendido.

---

## 1 · Alex

> Tengo una duda.
>
> Me he ido de fin de semana y la verdad que he comido lo que me ha dado la gana y lo que
> creo es que me ha ensuciado las estadisticas. Como lo ves? Faltaría ver algo o hacer de
> alguna manera que esto no lo ensucie? le puse comida flexible pro no se si es suficeinte

## 2 · Claude

*(Tras leer `flexible-meals.ts`, `adherence.ts`, `deficit.ts`, `ma7.ts`, `context.ts` y la
UI de Progreso.)*

Tu intuición es medio correcta: **has ensuciado algo, pero no lo que crees, y "flexible" no
protege lo que más importa.**

**Lo que hiciste bien y sí funcionó.** Marcar flexible saca el día del juicio de kcal de la
adherencia (`adherence.ts:44-46`). No cuentas como "fuera de rango" por comer 3.500 kcal un
sábado. Matiz: **la proteína sí se sigue juzgando** en días flexibles (`adherence.ts:47`),
deliberadamente — la proteína es suelo, no objetivo negociable.

**Lo que NO es suciedad.** Las kcal del finde entran íntegras en la ingesta media y en el
TDEE (`deficit.ts:66`, test en `deficit.test.ts:73`). Es correcto: si excluyeras esas kcal,
tu TDEE sería el de un Alex que no existe.

**Lo que SÍ se ha ensuciado — y flexible no lo toca: el peso.** La pendiente **no es una
regresión, es una secante** entre `ma7(primer pesaje)` y `ma7(último pesaje)`
(`deficit.ts:70-73`). El extremo derecho es hoy, inflado por agua y glucógeno → aplana la
pendiente del rango entero. Solo `competicion` protege el peso de los 2 días siguientes
(`ma7.ts:27-28`); flexible no, y hay un test que lo fija (`ma7.test.ts:68-82`).
**Se autocorrige en 5–10 días.** No hay datos dañados, hay una lectura contaminada.

⚠️ Si la MED de agosto es esta semana, muévela: pliegues sobre rebote de glucógeno es medir
agua.

**El riesgo silencioso.** No existe el concepto de "día registrado a medias":
`logged = (n entradas) > 0` (`trend.ts:149`). Un día con un café cuenta como día completo y
hunde la ingesta media. Esa contaminación no se autocorrige.

**Y falta algo, sí.** El fallo de producto real es que **has tenido que preguntármelo a mí
en vez de que la app te lo dijera**: la TrendCard se presenta como "La cifra que manda" y no
declara de qué está hecha; `adherence.specialN` se calcula y se tira; el gráfico puentea los
huecos con `connectNulls`; y si le preguntas al Chat, te repite la cifra contaminada con
autoridad (`context.ts:425`) — `grep retención|glucógeno|rebote` en `server/ai/` da **cero**.

**Preguntas:** ¿registraste el finde aunque fuera a ojo, o quedó a medias? ¿Te pesaste
sábado, domingo y hoy?

---

## 3 · Alex

> No lo he marcado todo el dia completo, solo esta a medias
>
> Yo lo que creo es que quizas tmb falta informacion y que sea entendible aqui:
> *[3 capturas de Progreso · Tendencia]*
>
> como lo harías porque tmb para mi es info real de cuanto acabo ingeriendo y tal para
> cuando vaya al nutricionista tener claro como nos estamos comprotando

**Datos de las capturas:**

| Captura | Contenido |
|---|---|
| 1 · Semanal (28 jul – 3 ago) | −0,2 kg/sem · déficit 220 · **TDEE 2200** · 19 pesajes en 23 días · ingesta media 1980. Resumen: 2035 kcal · 118 g prot · **6/7** registrados · **3/3** en rango · 7006 pasos · 5/6 proteína |
| 2 · Mensual (5 jul – 3 ago) | 2095 kcal · 118 g · **26/30** registrados · **14/16** en rango · 9206 pasos · 19/22 proteína · **objetivo vigente 1800** · 4 fases especiales. Consistencia: **Adherencia 100 %** (8/8 kcal · 11/13 proteína · 5 flexibles fuera de kcal) · racha 26 |
| 3 · Impacto flexible 28 d | Regular **1806 kcal · 100 % objetivo** · Con flexibles **2442 · 136 %** · diferencia +636 (+35 %) · 8 momentos · 6 días flexibles · 16 regulares. Gráfico de peso con **tramo plano 22–25 jul** |

## 4 · Claude

**Tus tres pantallas se contradicen entre sí, y la que grita más fuerte es la que miente.**

| Dónde | Qué dice |
|---|---|
| Consistencia | **Adherencia 100 %** |
| Resumen mensual | Ingesta media **2095** · Objetivo **1800** |

Eso es **+16 % por encima del objetivo, mostrado como 100 % de adherencia**. No es un bug:
`enRango / kcalN` = 8/8, pero `kcalN` son 8 días de 14 porque los flexibles salen del
denominador. **Los 5 días que te desviaron son exactamente los 5 que no se juzgan.**

Comprobado: (16×1806 + 6×2442)/22 = **1979 kcal**. TDEE 2200 − 1979 = 221 ≈ el déficit 220.
Los números son correctos; **la narrativa es falsa**.

**El incentivo perverso:** cuantos más días flexibles marcas, más sube tu adherencia.
Marcar flexible no solo te protege: te **borra del examen**. La fórmula no está mal pensada
(principio 4); lo que está mal es que un 100 % gigante lleve debajo, en gris de 10,5 px,
"5 flexibles fuera de kcal".

**El número honesto para el nutri:** con TDEE 2200 y objetivo 1800, tu déficit de diseño es
400 kcal/día → **0,36 kg/semana**. Tu ritmo real es **0,2**. Vas a poco más de la mitad de
velocidad de lo pautado. La app tiene los tres números y **no hace la resta en ningún sitio**.

**Preguntas:** ¿Qué te escuece más, el 100 % falso o no tener cifra para el nutri? ¿El finde
a medias fue "no pude apuntar" o "no supe qué poner"?

---

## 5 · Alex

> No, lo que me refiero que no marco dias enteros flexibles, solo comidas y que veo que se
> salen bastante de la pauta, si es algo distinto pero esta decente y tal, lo dejo como
> normal. **He marcado todos los dias completamente bien.**
>
> Luego también la pregunta será cuando suba de la dieta de calorias como se va a ver? osea
> si subo de kcals de 1800 a 1900 por ejemplo como se verá si estoy cumpliendo o no, porque
> hasta que la subia no lo cumplia y luego si
>
> 1. Lo que me escuece es que quizas si que es cierto que ingiero mas pero lo que tendríamso
> que tmb valorar es mientras que hago la dieta bien si estoy en esas kcal... entonces
> podríamos ver a cuanto se me va con los cheat meal, si es por eso que no adiero bien y no
> pierdo o no tengo el objetivo mas bien dicho y tal.. es para poder contrastar todas las
> posibilidades (en un futuro se podría hacer algo como si te reprimieras de 3000kcal a
> 2500kcal la aderencia hubiese sido tal tal ta... por ejemplo)
>
> 2. Esta todo apuntado. a medias decia que no pongo TODAS las comidas mal de flex.

## 6 · Claude

**Corrijo mi diagnóstico: no hay infra-registro, hay infra-marcado.** Si todo está apuntado,
tu TDEE 2200 es bueno — importa, porque es la cifra que le vas a enseñar a Regenera.

**Tu pregunta ya está respondida en tus datos, y es un SÍ.** `flexibleImpact.ts:56-58`
calcula el `% objetivo` día a día contra el objetivo *de ese día*. Por tanto:

> **Regular · 1806 kcal · 100 % objetivo** → **cuando haces la dieta, la clavas.** 16 de 28 días.

Es el dato más importante de las tres capturas y está al final de la pantalla, en 13 px,
bajo un título que habla de otra cosa. Y **tu criterio de marcado no está mal calibrado**:
si dejaras como Normal comidas que se salen de verdad, "Regular" saldría por encima de 1806
y el 8/8 se rompería. No lo cambies.

**Falta un paso de aritmética, y cierra exacto:**

| | Ingesta media | vs TDEE 2200 | Ritmo |
|---|---|---|---|
| Días de pauta (16) | 1806 | −394 kcal/día | **−0,36 kg/semana** |
| Días flexibles (6) | 2442 | **+242 kcal/día** | +0,22 kg/semana |
| Real ponderado (22) | 1979 | −220 kcal/día | **−0,20 kg/semana** |

(16 × 394 − 6 × 242) / 22 = **220,5** — exactamente el déficit de la TrendCard.

- ¿La pauta funciona? **Sí**: a tu ritmo de días regulares perderías 0,36 kg/semana.
- ¿Es por los flexibles? **Sí**: 6 días de 22 se comen el **45 %** de tu progreso. No restan
  menos: son un **superávit** de 242 kcal.

**Sobre el 1800 → 1900:** ya está bien resuelto. Cada día se juzga contra su objetivo
vigente (`adherence.ts:52`, `progressSummary.ts:76`, `flexibleImpact.ts:54`). El hueco:
`tendencia.tsx:389` muestra "Objetivo vigente" en singular cuando la ventana puede contener
dos pautas. Y la lectura incómoda: **subir el objetivo sube la adherencia sin que mejores**
— con ±10 %, 1800 da [1620–1980] y 1900 da [1710–2090]. Por eso el **`% objetivo` es la
métrica comparable entre pautas**, no las kcal absolutas.

**Tu contrafactual: no.** Guardarraíl "producto disfrazado de feature" + principio 8. La
tabla de arriba ya da el 90 % con datos reales. → `HANDOFF §B3` en su forma honesta: **el
techo** ("tu día flexible puede llegar a X kcal sin romper el déficit de la semana").

---

## 7 · Alex

> crees que se podría mejorar de una mejor manera par que fuese mas entendible? osea mejor
> de lo que ya está ahora mismo?? Que fallos puede tener y corregirlos y tal?

## 8 · Claude — los tres bugs

**Fallo 1 · La cifra que manda cambia según el selector, y el Chat te da otra.**
`tendencia.tsx:62` es la **única** llamada a `computeDeficit` del repo con ventana recortada.
Chat (`:213`), Coach (`:124`) y Visita (`:45`) usan el histórico completo; el default de
pantalla es 90 d. Además `context.ts:329` afirma "mismas cifras que la pantalla" (falso) y
`context.ts:425` etiqueta el dato como "(báscula, **7 d**)" cuando no son 7 días.

> **Y aquí mi culpa:** mi tabla de ritmos mezcló el TDEE de la captura (ventana 30 d) con
> las medias de `flexibleImpact` (ventana **28 d** fija). Cuadró a 220,5 vs 220 **por
> suerte**, porque 28 ≈ 30. En 90 d habría estado mal y ninguno lo habríamos notado.
> **Si yo me equivoco de ventana leyendo el código, tú no tienes ninguna posibilidad.**

**Fallo 2 · El arranque de la pendiente está sin suavizar.** `ma7(first)` es un peso crudo
de una muestra; `ma7(last)` sí está suavizado. Un extremo desviado 0,5 kg mueve ~0,15
kg/semana ≈ 165 kcal de TDEE (~7 %) — **error del tamaño de la señal**. El patrón correcto
está 13 líneas más abajo, en `tendencia.tsx:75-77`.

**Fallo 3 · El gráfico dibuja datos que no existen.** `connectNulls` + `dot={false}` +
`monotone`. **El tramo plano del 22-25 jul de tu captura es casi seguro interpolación**:
has estado leyendo "peso estable 3 días" donde el dato es "no me pesé".

**Fallo 4 · Seis ventanas, y el selector solo manda sobre tres.**

| Tarjeta | Ventana | ¿La controla el selector? |
|---|---|---|
| Cifra que manda | rango (default 90 d) | ✅ |
| Los 2 gráficos | rango | ✅ |
| Resumen | 7/30 propio | ❌ |
| Adherencia | 14 d fijo | ❌ |
| Impacto flexible | 28 d fijo | ❌ |
| Racha | sin ventana | ❌ |

> Ahí está tu "no es entendible": **no es redacción, es que hay seis relojes y solo uno
> tiene manecillas visibles.**

**Fallo 5 · Denominadores que encogen en silencio.** "En rango normal 3/3" se lee como
pleno y significa "de 6 registrados juzgué 3".

**Me corrijo a mí mismo:** mi propuesta del turno anterior estaba bien pensada y **mal
priorizada** — poner una tarjeta precisa encima de una cifra que se mueve es decorar. Orden
correcto: **1** una sola verdad (bugs) → **2** declarar ventana y cobertura → **3** gráfico
honesto → **4** desdoble de ritmos.

---

## 9 · Alex

> dale

## 10 · Claude

Escrita `docs/specs/features/22-progreso-una-sola-verdad.md`. Tres decisiones discutibles
presentadas para aprobación: (1) la cifra que manda se fija en 30 d y deja de responder al
selector; (2) `FLEXIBLE_IMPACT_WINDOW` 28 → 30 para que la aritmética cuadre; (3) la Fase 1
no se ve pero va primero.

---

## 11 · Alex

> 1. la verdad que me gustaba saber si estaba haciendolo bien a largo plazo no solo a 30 dias.
> 2. me parece perfecto para estandarizar.
> 3. oki

## 12 · Claude — la objeción que mejoró la spec

**Mi decisión era demasiado restrictiva: te quité una pregunta legítima para arreglar otra.**
Se puede tener ambas — un titular (30 d) + trayectoria subordinada, igual que las kcal del
Watch son contexto subordinado al peso (principio 1).

Tres formas de enseñar el largo plazo, no equivalentes. **Alex elige bloques consecutivos:**

```
BALANCE REAL · DESDE EL PESO · 30 d
  −0,2        220         2200
  kg/semana   kcal/día    TDEE real
  ─────────────────────────────────
  Trayectoria
  jul −0,20 · jun −0,31 · may −0,15
```

**Descartadas, con su porqué:** las acumulativas 30/90/todo **se solapan** (al mejorar un
mes, la de 90 d arrastra el promedio viejo y *parece contradecir* al titular); el balance
total (`−3,2 kg desde el 5-may`) es motivante pero no dice nada del ritmo actual → va a
`HANDOFF §B3` para *Preparar visita*, donde un marcador así sí encaja.

**Cuatro refinamientos añadidos al escribirlo:**
1. **Meses naturales cerrados, no bloques rodantes** — un bloque rodante cambia cada día;
   "julio" es un hecho fijo y es el idioma del nutricionista.
2. El mes en curso no aparece: ya es el titular. Cero solape.
3. Mismo gate por mes (≥8 pesajes, span ≥7 d); un mes que no llega sale `—`, nunca se
   estima; con <2 meses válidos se omite la línea.
4. **Una sola metodología**: la misma función llamada tres veces. Cero fórmulas nuevas — y
   ésa es la razón de que la Fase 1 vaya primero.

**Decisión tomada de oficio:** la trayectoria viaja al contexto de **Chat y Preparar visita**,
pero **no al Coach** — habla de hoy y de ayer, tres meses de pendiente no cambian ninguna de
sus respuestas y su prompt ya es largo (presupuesto de prompt, doc 11).

---

## Cierre

Spec aprobada el 3-ago, implementada y validada el 5-ago. AC 10, 11, 12 y 13 con el pulgar
de Alex; **10b pendiente hasta el 1-sep** por falta de meses naturales cerrados.

**Lo que esta conversación deja como método:**

- Una duda de uso ("¿me he ensuciado las estadísticas?") escondía **3 bugs de código**. El
  intake no debe aceptar la primera formulación del problema.
- **Verificar antes de opinar** cambió el diagnóstico dos veces: primero por el infra-marcado
  (no infra-registro), después por la mezcla de ventanas en mi propia tabla.
- El error de ventanas es la prueba del problema que la feature arregla: **si el analista se
  equivoca leyendo el código, el usuario no tiene ninguna posibilidad**.
- La objeción de Alex al punto 1 mejoró la spec. Un "no" del product owner sobre una decisión
  discutible es la etapa funcionando, no un contratiempo.

**Pendiente en `HANDOFF §B3`:** el techo del día flexible · el balance total para *Preparar
visita* · regresión lineal en vez de secante (reabrir solo si la MED de agosto falla contra
los pliegues).

**Continúa en** [`2026-08-05-validacion-f22-y-balance-del-reloj.md`](./2026-08-05-validacion-f22-y-balance-del-reloj.md):
implementación de las 4 fases, la validación con el pulgar (y las dos enmiendas que no estaban
previstas), y la conversación de producto que salió de ahí sobre el *Balance del día*.
