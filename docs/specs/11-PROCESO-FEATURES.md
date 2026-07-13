# 11 · PROCESO-FEATURES — Cómo se hace una feature en Fuelboard (proceso iterativo)

> Este documento convierte el método con el que se construyó la v1 en un proceso que el
> agente ejecuta de forma autónoma con cada idea nueva. Es la respuesta estándar a
> «quiero la feature X». Jerarquía: CLAUDE.md (principios) > specs 00-10 > este proceso.
> El agente NUNCA implementa una feature sin pasar por las etapas 1-3.

## Roles

- **Alex** — product owner: aporta ideas, casos reales y decisiones; aprueba specs; valida
  con el pulgar. No escribe specs.
- **Agente** — analista + implementador: interroga, especifica, propone, implementa,
  valida, documenta. No decide alcance sin aprobación.

## El ciclo (6 etapas, en orden, sin saltarse ninguna)

### Etapa 0 · Captura
Toda idea entra en `docs/HANDOFF-features.md` §B3 con una línea (fecha + frase de Alex,
literal). Las ideas no se pierden ni se implementan en caliente.

### Etapa 1 · Intake (interrogatorio)
Antes de proponer nada, el agente hace SUS preguntas — máximo 7, elegidas de este banco
según aplique, en un solo mensaje:

1. **Caso real**: ¿qué pasó (o qué no pudiste hacer) que motiva esto? Cuéntalo como
   historia concreta, con fecha si existe (como el bug del Coach del domingo).
2. **Momento de uso**: ¿cuándo/dónde/con qué frecuencia lo usarías? (mapear a la tabla de
   09 §1; si no tiene momento de uso, sospechar de la feature).
3. **Hoy sin la feature**: ¿cómo lo resuelves ahora? ¿cuánto duele de 1 a 5?
4. **Datos**: ¿qué información nueva hay que guardar? ¿tiene historia/fechas?
5. **IA**: ¿necesita IA o es determinista? Si IA: ¿qué entrada, qué salida, qué pasa si
   falla?
6. **Éxito**: ¿cómo sabrás que funciona? (esto se convertirá en los AC).
7. **Alcance mínimo**: si solo pudiera hacerse un 30% de la idea, ¿cuál 30%?

### Etapa 2 · Clasificación de tamaño
Con las respuestas, el agente clasifica y lo dice explícitamente:

| Tamaño | Criterio | Camino |
|---|---|---|
| **Quick-fix** | Sin migración, sin prompt nuevo, <½ día | Mini-spec de 10 líneas en el propio hilo → aprobar → hacer |
| **Feature** | Migración y/o prompt nuevo y/o pantalla | Mini-spec formal (plantilla §Plantilla) en `docs/specs/features/NN-nombre.md` |
| **Proyecto** | Cambia arquitectura, multiusuario, o >1 semana | PARAR: proponer troceo o discusión aparte; no se especifica en este ciclo |

### Etapa 3 · Mini-spec + aprobación
El agente escribe la mini-spec (plantilla abajo) y la presenta con: resumen de 5 líneas,
los 2-3 puntos donde tomó una decisión discutible, y la pregunta «¿apruebo?». **No se
escribe código hasta el OK explícito de Alex.** Si Alex cambia algo, se edita la spec, no
se parchea después en código.

### Etapa 4 · Implementación
Protocolo de siempre, sin excepciones:
- Fase a fase si la spec define más de una; tests de lógica ANTES que la UI.
- Prompts de IA: se congelan en la mini-spec Y se sincronizan a `04-IA.md`; cualquier
  cambio posterior de redacción re-valida los AC de esa feature (y el test de consistencia
  del café ×3 si toca features de estimación — comparar con DECISIONS #65).
- Decisiones no cubiertas → lo más simple + `DECISIONS.md`.
- Migraciones versionadas, 0 pérdidas (principio 7). `typecheck + test + build` en verde
  por commit. Commits pequeños.
- No adelantar trabajo de otras features aunque «ya que estamos».

### Etapa 5 · Validación
- El agente repasa los AC de la mini-spec uno a uno y reporta cuáles pasan.
- Los AC marcados 🖐 (de flujo/UX) los valida **Alex con el pulgar** en producción antes
  del cierre — el agente los deja explícitamente pendientes, nunca los da por buenos.
- Si la feature toca Hoy o el sheet: re-cronometrar los criterios de 09 §7 afectados.

### Etapa 6 · Cierre
- Añadir la feature a `docs/CHANGELOG-v1.md` (sección v1.x) con 3-5 líneas.
- Actualizar `HANDOFF-features.md`: mover de backlog a implementado.
- Si cambió flujos o diseño: sincronizar `09`/`05`. Deploy verificado.
- Preguntar a Alex: «¿algo del uso real de esta feature para el backlog?» (cerrar el bucle).

## Guardarraíles de alcance (cuándo decir NO o TODAVÍA NO)

El agente debe rechazar (argumentando) o aplazar una feature si:
- **No tiene momento de uso** claro en 09 §1, o añade una tarjeta permanente a Hoy (09 §6
  lo prohíbe: buscar su sheet/momento o no hacerla).
- **Compite con la simplicidad**: añade una segunda manera visible de hacer algo que ya
  tiene camino primario (la regla de «una manera primaria + atajos»).
- **Contradice un principio de CLAUDE.md** (los 9): p. ej. la IA prescribiendo dieta
  (principio 8) o una métrica de gasto que compita con el peso (principio 1).
- **Es optimización sin medición**: «hazlo más rápido/barato» sin número que lo justifique
  → primero medir, luego decidir.
- **Es producto, no herramienta**: multiusuario, público, monetización → conversación de
  proyecto aparte, no una feature.

## Plantilla de mini-spec (`docs/specs/features/NN-nombre.md`)

```markdown
# FNN · <Nombre>
**Estado**: propuesta | aprobada | implementada · **Tamaño**: quick-fix | feature
**Fecha**: · **Origen**: (línea de HANDOFF §B3 / caso real con fecha)

## Motivación (caso real)
## Alcance          (qué hace, en viñetas verificables)
## NO-alcance       (qué queda explícitamente fuera y por qué)
## Momento de uso   (cuándo/frecuencia — mapeado a 09 §1)
## Datos            (schema/settings; migración sí/no; impacto en export/restore y migrate:poc)
## Flujo            (dónde vive según 09: sheet/pestaña/ajustes; pasos)
## IA               (si aplica: prompt CONGELADO completo, modelo, esquema de salida,
                     manejo de error, coste estimado/uso)
## Impacto en Coach/Chat/Visita  (¿el contexto de IA debe conocer esto? ¿cómo?)
## AC               (numerados; marcar 🖐 los que valida Alex con el pulgar)
## Riesgos / decisiones discutibles  (2-3 máx, para la aprobación)
## Fases            (si >1 sesión)
```

## Prompt estándar de arranque (para Alex, copiar/pegar)

> Feature nueva: «<idea en una frase>». Ejecuta `docs/specs/11-PROCESO-FEATURES.md` desde
> la Etapa 1: hazme el intake, clasifica el tamaño, y prepárame la mini-spec para aprobar.
> No escribas código hasta mi OK.

Y para retomar una ya aprobada:

> Implementa `docs/specs/features/NN-nombre.md` (aprobada) según las Etapas 4-6 del
> proceso. Fase a fase, AC uno a uno, y déjame los 🖐 pendientes de mi validación.

## Nota final

Este proceso existe para proteger dos cosas que hicieron buena la v1: que **las specs se
escriben antes que el código**, y que **Alex decide con casos reales, no con hipótesis**.
Si alguna etapa estorba sistemáticamente, se cambia el proceso (editando este doc y
anotándolo en DECISIONS) — no se ignora.
