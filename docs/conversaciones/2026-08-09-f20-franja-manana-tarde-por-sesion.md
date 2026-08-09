# Conversación · F20: franja mañana/tarde por sesión

**Fecha de archivo:** 2026-08-09  
**Tema:** implementación, migración, validación y despliegue de F20  
**Nota:** transcripción limpia de los mensajes visibles. Se omiten instrucciones internas y
logs mecánicos de herramientas, manteniendo las decisiones, errores, validaciones y acciones
relevantes.

---

## Transcripción

### Usuario

Implementa `docs/specs/features/20-franja-manana-tarde-por-sesion.md` (aprobada) según las
Etapas 4–6 del proceso `docs/specs/11-PROCESO-FEATURES.md`.

Fase a fase, en orden (0 → 1 → 2), sin adelantar. Tests de lógica en verde antes que UI;
`pnpm typecheck && pnpm test` en verde por commit; commits pequeños.

Por qué este orden: la Fase 0 asienta el dato (setting de franja/día + columna
`training_sessions.franja` + migraciones) sin el cual la IA no tiene qué leer; la Fase 1 es
el valor (arregla el bug de la gasolina del sábado) y ya resuelve el problema con el horario
estable de Alex; la Fase 2 (override al importar) es la guinda para los días que se mueven.

Anclaje quirúrgico — lee solo esto y verifica que sigue vigente:

- Dato/patrón (Fase 0): `src/lib/macros.ts` (`SessionByWeekday`,
  `DEFAULT_SESSION_BY_WEEKDAY`), `src/lib/profile.ts` (`trainingDaysPerWeek`, campo
  `franjaEntreno`), `src/server/db/queries/lookups.ts` (`getSessionByWeekday`,
  `SESSION_MAP_KEY`), `src/components/ajustes/session-map-editor.tsx` +
  `src/app/api/settings/session-map/route.ts`, `src/server/db/schema.ts`
  (`trainingSessions` ~línea 413), export/restore (`src/server/db/products-map.ts` y la ruta
  de export/import) + `migrate:poc`. Editor de perfil:
  `src/components/ajustes/athlete-profile-editor.tsx` (input `franjaEntreno` a retirar).
- Contexto IA (Fase 1): `src/server/ai/prompts.ts` (`athleteContext` línea ~47 — prompt
  CONGELADO; y el prompt del Coach, cláusula de gasolina ~línea 315-336),
  `src/server/ai/athlete.ts` (`getAthleteContexts`, `trainingDaysPerWeek`),
  `src/server/ai/context.ts` (`dayLines` ~114, línea de sesión sin registrar ~570),
  `src/app/api/ai/coach/route.ts` (~88, usa `targetDate`),
  `src/server/ai/prompts.test.ts`. Verifica con grep que nadie más que `prompts.ts:47` lee
  `franjaEntreno`.
- Import (Fase 2): `src/components/plan/training-import.tsx` y
  `src/components/plan/training-week.tsx` (asignación de sesiones → fecha + selector de
  franja). Check-in: `src/components/hoy/checkins.tsx` (`sessionChoices` ~352,
  `defaultSession`) y `src/server/db/queries/today.ts` (~120).

Reglas de la casa pertinentes:

1. Prompts congelados → editar `prompts.ts` + `prompts.test.ts`, re-validar los AC de la
   feature, y sync a `04-IA.md` SOLO si cambia esquema/modelo/coste/AC/doctrina. F19 no toca
   estimación numérica → no requiere café ×3.
2. Migraciones versionadas y datos sagrados: la conversión de la setting antigua debe ser
   idempotente y sin pérdida de días; export/restore y `migrate:poc` actualizados; test de
   migración obligatorio.
3. Fechas siempre por `lib/dates` (`isoWeekday`/`dayKey`) — nunca `toISOString().slice`.
4. Analítica/lógica en funciones puras testeadas (`trainingDaysPerWeek` adaptado a la forma
   nueva; resolución franja = sesión → si null, patrón[weekday]).
5. Zod en los boundaries para los enums de franja (`mañana|tarde|descanso` en setting;
   `mañana|tarde|null` en sesión).

Los AC 🖐 que valido yo (Alex) en dev/prod, no los cierres tú: AC 1 (pantalla Ajustes
reformada), AC 4 (franja al importar + ficha), AC 5 y AC 6 (casos canónicos de la gasolina:
sábado mañana → desayuno/antes; martes tarde → comida/merienda). Estos dos van además a la
batería de regresión de `prompts.test`.

Empieza por la Fase 0: primero migración + tests de lógica, luego la pantalla. Déjame los 🖐
pendientes al final de cada fase.

### Asistente

Implementación F20 terminada por fases, con commits separados:

- `804a5f3` — Fase 0: dato, migraciones, resolver, backup/restore.
- `582be35` — Fase 1: Ajustes, contexto IA y gasolina del Coach.
- `9be268b` — Fase 2: override por sesión en importar/crear/editar/reasignar.
- `d10a4c1` — cierre documental.

Puertas finales:

- `pnpm typecheck` ✅
- `pnpm test` ✅ — 418/418
- ESLint de archivos modificados ✅
- React Doctor: 88/100, sin regresiones de F20.

AC automatizados pasan: migraciones, resolución de franja, persistencia, boundaries Zod,
compatibilidad histórica, Coach/Chat/Visita, export/restore y documentación.

Pendientes 🖐 para tu validación:

- Ajustes: siete franjas, persistencia y retirada del aviso.
- Importación/edición: precarga, override y ficha `· mañana/tarde`.
- Check-in real en ≤15 segundos.
- Coach: sábado mañana → desayuno/antes.
- Coach: martes tarde → comida/merienda sin aumentar macros.

Deploy requiere ejecutar `drizzle/0017_sad_scorpion.sql` y
`drizzle/0018_f20_training_weekday_cutover.sql`. No necesita variables ni backfill
adicional. No he desplegado.

La spec queda como “implementada · validación 🖐 pendiente”. Los cambios previos ajenos a
F20 permanecen intactos.

¿Algo del uso real de esta feature que quieras dejar ya apuntado para el backlog?

### Usuario

#### Error Type

Runtime Error

#### Error Message

```text
Failed query: select "id", "plan_id", "key", "nombre", "tipo", "contenido", "kcal_min",
"kcal_max", "duracion_min", "franja", "sort" from "training_sessions" where
"training_sessions"."plan_id" = $1 order by "training_sessions"."sort" asc,
"training_sessions"."id" asc
params: 3

at NeonHttpPreparedQuery.queryWithCache (...)
at NeonHttpPreparedQuery.execute (...)
at getTrainingWeekView (src/server/db/queries/training.ts:389:21)
at retry (src/lib/retry.ts:15:14)
at PlanPage (src/app/(app)/plan/page.tsx:28:49)

Next.js version: 16.2.10 (Turbopack)
```

### Asistente

Diagnóstico confirmado: la base configurada en `.env.local` solo tiene migraciones hasta
`0016`. Falta la columna `training_sessions.franja`, por eso PostgreSQL devuelve `42703`.

La solución es ejecutar `pnpm db:migrate`, que aplicará `0017` y `0018`. Como modifica la
base Neon y convierte settings, no lo he ejecutado todavía.

¿Quieres que aplique ahora las migraciones contra el `DATABASE_URL` configurado?

### Usuario

Repite el mismo error de columna `franja` inexistente.

### Asistente

Es el mismo error: la base sigue sin `training_sessions.franja`. Reiniciar Next no lo
resolverá.

Necesito confirmación para modificar Neon: responde **«sí, migra»** y ejecutaré
`pnpm db:migrate` contra el `DATABASE_URL` actual.

### Usuario

si, migra

### Asistente

Migraciones `0017` y `0018` aplicadas correctamente.

Verificado:

- Columna `training_sessions.franja` presente.
- Ledger actualizado hasta `0018`.
- Settings nuevas creadas y antigua retirada.
- La consulta que fallaba ahora devuelve 7 sesiones.

Recarga Plan; el error ya debería desaparecer.

### Usuario

ya he visto toda la validacion. entonces si ya tengo lo de mañana y tarde donde la semana,
para que lo tengo en ajuestes?

### Asistente

Sirve como plantilla, no como segundo calendario:

- Ajustes: tu horario habitual. Se configura una vez: L–V tarde, sábado mañana, domingo
  descanso.
- Semana: la verdad de esa sesión concreta. Si un martes excepcionalmente entrenas por la
  mañana, lo cambias solo ahí.
- Al importar una semana, Ajustes precarga las franjas para que no tengas que elegirlas
  todas manualmente.
- Si existe franja en la sesión semanal, siempre manda sobre Ajustes.

Dicho eso, tu duda revela un problema de diseño: Ajustes parece otro sitio que debes
mantener. Yo conservaría el dato, pero lo mostraría plegado como:

> Horario habitual · L–V tarde · S mañana · D descanso  
> Se usa solo para precargar nuevas sesiones. `Editar`

Así queda claro que el trabajo diario se hace en la semana y Ajustes solo define defaults.
¿Te encaja ese cambio?

### Usuario

okey perfecto todo ok  
subelo

### Asistente

Subido y desplegado en producción.

- URL: <https://fuelboard-ten.vercel.app>
- Estado: `READY`
- Commit: `d10a4c1`
- GitHub: `main` sincronizada
- Región: `fra1`
- Smoke test: login `200`, raíz redirige correctamente a login
- Logs en vivo: sin errores

Los cambios locales ajenos a F20 siguen intactos y sin subir.

---

## Estado técnico final

- Feature: F20, franjas mañana/tarde por sesión.
- Rama: `main`.
- Último commit desplegado: `d10a4c1`.
- Migraciones aplicadas en Neon: `0017` y `0018`.
- Producción: `READY`.
- Tests: 418/418.
- Typecheck: verde.
- La franja habitual de Ajustes funciona como default.
- La franja explícita de la sesión semanal tiene precedencia.
- Ajustes podría mejorarse visualmente en el futuro mostrando un resumen plegado que aclare
  que solo define valores por defecto.
