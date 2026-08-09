# Sesión · 3–9 ago 2026 — Validación de F22 y «el balance del día me decía +824»

> **Skills**: `fuelboard-implementer` (Etapas 4-6 del doc 11) en la Parte A ·
> `fuelboard-product-partner` (Etapas 1-3) en la Parte B.
> **Continúa** [`2026-08-03-f22-progreso-una-sola-verdad.md`](./2026-08-03-f22-progreso-una-sola-verdad.md),
> que acaba justo donde empieza ésta.
> **Resultado**: F22 implementada, validada y mergeada en `main` (`3b82e83`). La Parte B
> queda **abierta**: una conversación de producto que aún no ha producido spec.
> **Por qué se guarda**: la validación destapó dos enmiendas que la spec no había previsto, y
> un AC que parecía fallar y no fallaba. La Parte B contiene **dos correcciones de diagnóstico
> mías**, la segunda de las cuales tumba una regla que yo mismo había propuesto el día
> anterior. Eso es lo que hay que recordar, y la spec no lo va a contar.

---

# Parte A · F22: implementación, validación y cierre

## 1 · Alex

> hazlo en una rama aparte todo.
>
> Implementa `docs/specs/features/22-progreso-una-sola-verdad.md` (aprobada el 3-ago) según
> las Etapas 4-6 del doc 11. Fase a fase, AC uno a uno, y déjame los 🖐 pendientes.

*(El prompt traía anclaje ordenado —spec 22, `03-DATOS §3`, F16, principio 1—, los archivos
que toca con línea verificada, el orden de fases **con su porqué**, cinco reglas de la casa y
la trampa conocida: el gate `MIN_WEIGHINS=8` aplicado por mes va justo, un mes que no llega se
muestra `—` y **nunca** se estima. Reservó los AC 10, 10b, 11, 12 y 13 para su pulgar.)*

## 2 · Claude — las 4 fases

| Fase | Commit | Qué |
|---|---|---|
| 1 | `9cb95f7` | `computeDeficit(records, window)` + `computeCanonicalDeficit` (30 d, fallback declarado a 90) + `computeTrajectory` + helpers de mes en `lib/dates.ts` + etiquetas de `context.ts` |
| 2 | `63e1171` | Ventana y cobertura declaradas, trayectoria renderizada, `targetSpans`, «Afecta a los gráficos» |
| 3 | `02603b3` | Gráfico honesto |
| 4 | `bef9af2` | `computeFlexibleRhythms`, ventana 28 → 30, tarjeta de ritmos |

**Los helpers de mes NO usan `startOfMonth` de date-fns**: trabaja en la zona del sistema y con
el instante «mediodía UTC» de `lib/dates.ts` saltaría de mes justo en los bordes (día 1 y
último). La aritmética va sobre la clave `'YYYY-MM'`, que ya es la verdad.

**Dos hallazgos que corrigen la Motivación de la propia spec:**

1. **El tramo plano del 22-25 jul NO era interpolación.** La BD guarda **90,5 kg el 22, el 23 y
   el 24**. Son tres lecturas reales idénticas. El bug de `connectNulls` existía y está
   arreglado, pero *ese* tramo no lo causaba.
2. **La causa primera del hueco invisible estaba antes de Recharts.** El gráfico solo recibía
   días CON peso, así que el eje los pegaba uno detrás de otro y el hueco no existía como dato:
   **quitar `connectNulls` por sí solo no habría cambiado nada.** Por eso la serie pasó a emitir
   un punto por día natural con `weight: null`, y `weightChartSeries` salió del componente a
   `server/analytics/` (regla de la casa: ni una fórmula en componentes).

Verificado en el DOM sobre un hueco real: la línea de peso se parte en **dos subpaths**
(`M…L… M…L…`) y la ma7 sigue continua.

---

## 3 · Alex

> entonces que tenemos que hacer en verificacion?

## 4 · Claude — el guion

Cuatro AC validables y uno bloqueado:

| AC | Qué mirar |
|---|---|
| 10 | Saber de cuántos días habla cada cifra **sin abrir ningún desplegable** |
| 11 | Punto por pesaje real y línea cortada donde no hubo |
| 12 | La frase para Regenera leyendo **una sola tarjeta**, sin sumar de cabeza |
| 13 | El Chat devuelve la misma cifra que la pantalla |
| **10b** | 🖐 **BLOQUEADO**: su primer pesaje es del 8-jul, así que julio es el único mes cerrado que llega al gate (1 < 2 → línea omitida, correcto por spec). Vuelve el 1-sep. |

---

## 5 · Alex

> **AC10**: *[captura de la tarjeta]* Esto «La última fila es tu cifra que manda, descompuesta…
> Diferencia observada ≈ +643 kcal (+36 %)… Diferencia observada, no causal.» **no lo entiendo
> pporque esta ahí**
> **AC11**: *[captura del gráfico de peso]*
> **AC12**: **Se puede decir pero entonce como se lee?**
> **AC 13**: *[captura del Chat: −0,24 kg/semana, 261 kcal/día]*
>
> AC10b bloqueado okey. como lo ves?

## 6 · Claude — una falsa alarma y dos fallos reales

**AC13 · falsa alarma, y merece quedar escrita.** El Chat decía −0,24/261 y la pantalla
−0,20/220: exactamente el síntoma que F22 venía a eliminar. **No era divergencia: se pesó
(90,5 kg) entre la captura y la pregunta**, y la cifra se movió con el dato nuevo (19 → 20
pesajes). Recargada la pantalla: −0,24 / 261 / 2227, idéntico al Chat.

> **Regla operativa que sale de aquí:** comparar pantalla y Chat **siempre tras recargar**, y
> contrastar el nº de pesajes de la cabecera antes de cantar un bug. La cifra que manda es un
> dato vivo: cada pesaje la mueve ~40 kcal de TDEE.

**AC11 · pasa, y su captura lo prueba mejor que la mía.** El punto del 3-ago sale suelto porque
el 1 y el 2 no se pesó: la línea se corta de verdad.

**AC10 y AC12 · fallan, y por la misma causa.** Sobraba una línea heredada y faltaba la frase:

- `Diferencia observada ≈ +643 kcal (+36 %)` era un resto de F16. Con la tabla de ritmos
  delante repetía el mismo hecho **en otro marco** (cada grupo contra el otro, en vez de contra
  el gasto) y con un tercer porcentaje sobre la media regular. Ruido.
- Y al sobrar tapaba lo que faltaba: **la tabla daba los números pero no la frase.** Sus días
  de pauta corrían a −0,39 y su ritmo real era −0,24; esa resta —la respuesta a «¿cuánto me
  cuestan las salidas?»— había que hacerla de cabeza.

## 7 · Alex — elige

Sobre el cierre de la tarjeta: **«Ritmos + cuánto se llevan»**. Sobre el pie: **momentos sí,
coletilla "no causal" no**.

## 8 · Claude — las dos enmiendas (`b111b49`)

```
Real ponderado ×23   1966   −261   −0,24
─────────────────────────────────────────
Tus días de pauta corren a −0,39 kg/semana; con los 6 flexibles,
tu ritmo real es −0,24. Los flexibles se llevan el 39 % del ritmo.

8 momentos · 6 días flexibles · 17 de pauta.
```

`flexibleShare` es una **razón entre dos ritmos medidos**, no un contrafactual: no simula un
Alex que no existió (NO-alcance §2 de la spec), divide lo que pasó entre lo que pasó. Devuelve
`null` cuando no significa nada y `>1` → «todo ese ritmo».

## 9 · Alex

> que tengo que mirar? 1

## 10 · Claude — y las cifras ya habían vuelto a moverse

Dos días después, la misma tarjeta decía otra cosa: **21 pesajes, −0,25 kg/semana, 279 kcal,
TDEE 2.235** — y seguía cuadrando sola (`Real ponderado −279` = el déficit del titular). Es la
tercera vez en la sesión que las cifras se mueven bajo los pies, y de ahí sale la pregunta
siguiente.

## 11 · Alex

> me vale la tarjeta, **comitea y mergea y cerramos esta feature** y vamos a analizar lo
> siguiente

## 12 · Claude — cierre

Spec marcada como cerrada, hallazgo del gasto anotado en `HANDOFF §B3`, gate completo en verde
y merge a `main` (`3b82e83`). Los 9 commits quedan **sin empujar**: `main` local por delante de
`origin/main`, y en este repo empujar significa desplegar a la app que usa en el móvil.

---

# Parte B · El balance del reloj *(abierta)*

> *Cronológicamente la primera pregunta de esta parte llega **antes** del merge (turno 11); se
> agrupa aquí porque es la semilla de toda la conversación de producto.*

## 13 · Alex

> vlae una cosa que me dice es que us 2235 pero esto lo calcula tmb a partir del basal y de los
> ejercicios? porque si que es cierto que **hay dias que hago ejercicio sin el reloj y no cuenta
> lo que yo le pongo**, esto es verdad?

## 14 · Claude — no, y sí

**El 2.235 no toca el reloj para nada**: `TDEE = ingesta media + déficit`, y el déficit solo de
la pendiente de la báscula. Principio 1 en su forma literal — por eso un día sin reloj no lo
ensucia.

**Pero la queja es cierta, y afecta a otro número.** `energyBalance.ts` calcula el *Balance
estimado del día*, y su regla anti-doble-conteo descarta `sessionKcal` siempre que exista
`activeKcal`. Medido: **17 de 17 días con sesión la descartan.**

## 15 · Alex — el pivote

> si lo que acaba de salir

*(A partir de aquí la sesión cambia de skill: de `fuelboard-implementer` a
`fuelboard-product-partner`. Una queja de uso real se piensa antes de tocar código.)*

## 16 · Claude — corrección nº 1

**Ese número no lo escribe Alex.** Sale del plan de entreno: punto medio de `kcalMin/kcalMax`
de la sesión asignada (`lib/training.ts:150`). No hay ningún campo donde teclearlo.

Así que **no es «manual vs Health» (principio 6)**, como le había dicho: es «estimación del plan
vs medición del reloj», y el principio 1 subordina **las dos** («las kcal del Apple Watch **y
las estimaciones de sesión** son SOLO contexto»).

Mirando sus últimas sesiones, el dato se parte solo:

| | Plan | Reloj | |
|---|---|---|---|
| 28-jul Training 2 | 525 | **858** | reloj puesto ✓ |
| 29-jul Training 3 | 800 | **868** | reloj puesto ✓ |
| 30-jul Training 4 | 600 | **751** | reloj puesto ✓ |
| 1-ago Sesión Acuática | **1.400** | 461 | al agua sin reloj |
| 3-ago CrossFit completa | **650** | 110 | sin reloj |
| 4-ago Halterofilia Dirty DT | **750** | 252 | sin reloj |

## 17 · Alex — el caso real, en dos intentos

> 1 no entiendo que qieres decir.
> 2. basicamente **se me rompio el reloj** y ponia el entreno y me seguia poniendo donde el
> reloj como **+XXX kcals de mas**

*(Y treinta segundos después, corrigiéndose él mismo:)*

> perdon **se me rompio el mobil** y no tenia sincronización con el reloj y el nuevo movil.

El «+XXX kcals de más» es el síntoma exacto: **el gasto infravalorado inflaba el balance**, así
que el día parecía un superávit que no existió. Y el matiz que él corrige —móvil, no reloj— es
el que cambia el diagnóstico entero.

*(La pregunta que no entendió era mía y estaba mal formulada: le pregunté «¿qué decides con el
Balance del día?» cuando lo que quería saber era si ese número le hace hacer algo distinto.)*

## 18 · Claude — corrección nº 2, la que lo cambia todo

No era entrenar sin reloj: era **una migración de móvil que degradó todo el pipeline de Health**.

| | basal | activas | pasos |
|---|---|---|---|
| habitual jul | ~2.100 | 400-1.000 | ~9.000 |
| 1-ago | **1.171** | 461 | 11.577 |
| 2-ago | **956** | — | 1.517 |
| 3-ago | 1.727 | 110 | 3.098 |
| 4-ago | **959** | 252 | 2.475 |

Y con eso, lo que la tarjeta le dijo:

| | La tarjeta dijo | Con mi regla del turno 14 | Realidad (basal sano + sesión) |
|---|---|---|---|
| 1-ago | **+824** | −115 | ≈ **−1.044** |
| 4-ago | **+486** | −12 | ≈ **−1.153** |
| 5-ago (en vivo) | **+1.486** | +1.495 | ≈ −465 |

> **Mi regla no le habría salvado.** Yo estaba discutiendo qué hacer con las kcal activas
> mientras **el número podrido era el basal**. Me equivoqué de variable.

Dos cosas más: la tarjeta se llama «orientativo **±25 %**» y erró **1.900 kcal con el signo
cambiado**. Y su indicador de sincronización decía **✓ en verde** mientras tanto, porque los
datos sí llegaban — solo que a medias. Mintió por partida doble.

La tercera fila también importa: **hoy, con todo sano, seguiría exagerando cada mañana**, porque
el basal del día en curso siempre es parcial.

## 19 · Alex

> **la miro por encima pero si que da como cosa** ver que te dice que estas por encima... no se

## 20 · Claude — la propuesta *(pendiente de OK)*

Sin valor de decisión, con coste emocional. Y cuando el número está mal, el coste te lo cobra
igual, por nada.

**Argumento que lo cierra — duplicidad.** Ya existe un número que le dice si se ha pasado: el
**FuelGauge** (`2.440/1.800 · +640`), bien calculado, contra el objetivo de Regenera, y con el
tono que F16 le dio. La tarjeta del reloj es un **segundo** «te has pasado», peor fundamentado,
compitiendo con el primero → camino duplicado (doc 11).

**Y el fallo de diseño que produce la sensación:**

> La tarjeta compara un dato **exacto** (lo que comió, registrado comida a comida) con uno
> **podrido** (el gasto, ±25 % en el mejor día y 1.900 de error en el peor) y presenta la resta
> como veredicto de una cifra grande. **Una resta no puede ser más fiable que su peor operando.**

**Propuesta**: que la tarjeta **deje de emitir veredicto** — magnitud y estado de sincronización
sí, número grande con signo no; y que **calle cuando los datos estén incompletos** en vez de
rellenar el hueco. No quitar la tarjeta: el estado de sincronización es justo lo que le habría
avisado del lío del móvil, si supiera detectar datos parciales.

Fuera de alcance, anotado: la precedencia sesión/reloj (muerta) y la etiqueta «kcal activas» de
la tarjeta de Entrenamiento, que miente los días que enseña la estimación del plan
(`today-context.tsx:330`) — ésa entra como AC de una línea.

---

## Cierre

**Parte A cerrada**: F22 en `main`, AC 10-13 validados, 10b el 1-sep.
**Parte B abierta**: esperando OK para la mini-spec (tamaño quick-fix grande; sin migración, sin
tocar prompts).

**Pendientes vivos**: AC10b el 1-sep · `main` **sin push** (9 commits) · la MED de agosto como
examen de la predicción (−0,25 kg/semana), con la regresión lineal anotada en `HANDOFF §B3`
como primer sospechoso si falla contra los pliegues.

**Lo que esta sesión deja como método:**

1. **Un AC que «falla» puede ser un dato vivo, no un bug.** La divergencia Chat/pantalla del
   AC13 era un pesaje que entró entre medias. Recargar antes de acusar.
2. **Verificar antes de opinar cambió el diagnóstico dos veces en la Parte B** — y la segunda
   tumbó una regla que yo ya había propuesto. Un número medido mata una hipótesis razonable:
   la tabla «con mi regla» existe precisamente para dejar constancia de que no habría servido.
3. **Las dos objeciones de la validación eran la misma causa.** «No entiendo por qué está ahí»
   y «¿cómo se lee?» no eran dos problemas: sobraba una línea y faltaba una frase.
4. **Un número sin valor de decisión pero con coste emocional es un pasivo**, no una función.
   «La miro por encima… pero da cosa» es un motivo legítimo para quitar algo.
5. **El índice de CodeGraph estaba obsoleto**: devolvió `mi-dia-card.tsx` y `hoy-extras.tsx`,
   que ya no existen en el repo. Un índice no es la verdad; el disco sí.
6. La Motivación de una spec aprobada **puede contener un error de hecho** (el tramo plano del
   22-25 jul) y aun así llevar a los arreglos correctos. Verificar al implementar, y corregir
   la spec hacia atrás.
