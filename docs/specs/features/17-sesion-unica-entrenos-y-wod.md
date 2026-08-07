# F17 · Sesión única: Entrenos legibles + WOD integrado con Hoy
**Estado**: completada · **Tamaño**: feature
**Fecha**: 2026-07-26 · **Origen**: uso real de Alex en Plan · Entrenos y «Analizar WOD
pegado». Captura en `docs/HANDOFF-features.md` §B3.

**Aprobada por Alex el 2026-07-26.**
**Completada por Alex el 2026-07-26 tras validación en uso real.**

## Motivación (caso real)

Plan · Entrenos se apartó del mockup aprobado:

- La sesión seleccionada se presenta como una tarjeta de gestión con texto corrido, lápiz,
  reasignación y borrado visibles, en vez de como una ficha legible de la sesión.
- El mockup muestra primero qué toca —nombre, duración y bloques— y relega «Editar sesión» y
  «Semana» a sheets.
- En Hoy, F-IA-5 analiza correctamente un WOD, pero «Usar como sesión de hoy» solo guarda
  `sessionLabel` y la media del rango de kcal. Pierde el WOD, duración, rango y comentario;
  tampoco crea/actualiza `training_sessions`, así que no aparece en Plan.
- Si el día ya tenía `sessionRef`, F-IA-5 no lo limpia ni actualiza. `dayContext` prioriza la
  sesión referenciada y Coach/Chat pueden seguir viendo la sesión importada anterior.

Decisión de Alex: **solo importa conservar una sesión por fecha, la definitiva/realizada**.
No se modelan dos entidades visibles «planificada» y «realizada».

## Alcance

### A · Ficha legible en Plan · Entrenos

- Conservar navegador de semana y los siete días.
- Tocar un día selecciona una única ficha de sesión con:
  - clave + duración;
  - nombre;
  - programa + semana + origen;
  - contenido completo dividido visualmente en bloques numerados;
  - acciones `Editar sesión` y `Semana`.
- La ficha es modo lectura. Editar campos, reasignar, borrar sesión y gestionar/borrar la
  semana viven en sheets, según 09 §6.
- `contenido` sigue siendo la fuente canónica. Una función pura de presentación lo divide
  por párrafos, saltos de línea o encabezados (`Fuerza:`, `CrossFit:`, `Accesorios:`).
  **Nunca elimina texto**; si no detecta estructura, muestra un único bloque completo.
- Un día vacío muestra `Añadir sesión`, no un formulario permanente.

### B · Crear una sesión desde Plan

- `Añadir sesión` abre un sheet con dos puertas dentro del mismo flujo:
  - **Pegar WOD · IA**: texto → analizar → vista previa editable.
  - **Manual**: nombre, tipo, contenido, duración y kcal mín./máx.
- La fecha llega preseleccionada desde el día tocado.
- Guardar crea la sesión dentro de la semana y asigna `days.sessionRef`, `sessionLabel` y
  `sessionKcal`; al visitar Hoy en esa fecha, aparece automáticamente.
- Si no existe plan para esa semana, se crea una semana de fuente `texto`, usando el programa
  vigente del perfil (fallback `Entreno manual`) y una etiqueta semanal derivada. No crea un
  segundo plan solapado.
- Solo puede haber **una sesión canónica por fecha**. Si ya existe, la acción es editar o
  sustituir, nunca añadir una segunda.

### C · F-IA-5 guarda la sesión, no un resumen suelto

- La vista previa conserva:
  - el WOD pegado **íntegro** como `contenido`;
  - nombre corto;
  - tipo;
  - duración;
  - kcal mín./máx.;
  - comentario de estimación.
- `Guardar como sesión de hoy` usa el mismo comando de persistencia que Plan:
  - con sesión asignada → actualiza esa misma `training_session`;
  - sin sesión asignada → crea una en la semana y la asigna;
  - sincroniza siempre los campos desnormalizados del día.
- Tras sustituir una sesión, toast `Sesión actualizada · Deshacer`; el undo restaura el
  snapshot anterior de sesión + día.
- La IA se ejecuta **solo al analizar**. Abrir/expandir la ficha no llama a la IA.

### D · La misma sesión en Hoy

- «Mi día» muestra la sesión asignada con nombre, tipo y duración.
- Tocar `Ver sesión` abre el mismo detalle reutilizable de Plan; no se crea otra tarjeta
  permanente en Hoy.
- Plan, Hoy, Historial y el contexto de Coach/Chat leen la misma `training_session`.

### E · Importación semanal fiel

- F-IA-10 deja de pedir `contenido resumido`: conserva todos los bloques relevantes del
  documento, fieles y ordenados, con saltos de línea entre bloques.
- La salida sigue guardándose en el campo `contenido`; no se añade un segundo modelo de
  bloques.
- Las sesiones históricas conservan exactamente lo ya guardado. No hay reanálisis ni
  backfill automático.

## NO-alcance

- No estados separados «planificada» / «realizada», comparativa de cumplimiento ni dos
  sesiones simultáneas por fecha.
- No llamada IA al abrir una sesión.
- No editor estructurado bloque a bloque: se edita el contenido completo en un textarea.
- No recuperar detalle que una importación histórica ya hubiera resumido.
- No tocar estimaciones del reloj ni convertir las kcal de sesión en fuente de verdad.

## Momento de uso

- **Planificar/revisar la semana**: Plan · Entrenos, semanal, 2–5 min (09 §1).
- **Registrar/corregir la sesión del día**: Hoy · Mi día, puntual, mediante el atajo
  F-IA-5 ya existente (09 §3 y §5).

## Datos

- **Sin migración**: se reutilizan `training_plans`, `training_sessions` y
  `days.sessionRef/sessionLabel/sessionKcal`.
- `contenido` guarda el texto íntegro; la división en bloques es derivada y no persistida.
- Nueva mutación atómica de sesión+asignación:
  - actualiza la sesión ya asignada o inserta una nueva;
  - crea el plan semanal manual solo si no existe;
  - actualiza el día en la misma operación lógica;
  - respeta las protecciones de solapamiento e idempotencia de importación existentes.
- Export/restore y `migrate:poc` no cambian: no hay campos nuevos.

## Flujo

### Desde Plan

`Entrenos` → tocar día → ficha o estado vacío → `Añadir sesión` → `Pegar WOD · IA | Manual`
→ vista previa/editable → `Guardar sesión` → ficha actualizada y disponible en Hoy.

### Desde Hoy

`Mi día` → `Analizar WOD pegado` → vista previa → `Guardar como sesión de hoy` → sustituye o
crea la sesión canónica → resumen de Hoy actualizado → `Ver sesión`.

### Sustitución

La propia vista previa avisa `Sustituirá «T2 Training 2»`. Guardar no abre otro diálogo:
toast con `Deshacer`.

## IA

### F-IA-5 · WOD

- Misma ruta, modelo, coste y `temperature: 0`.
- `wodPrompt()` añade `tipo`, enum exacto de entrenamiento. El texto pegado no necesita ser
  regenerado: se conserva directamente como `contenido`, evitando pérdida o invención.
- Salida:

```json
{
  "nombre": "string",
  "tipo": "fuerza|halterofilia|gimnasticos|metabolico|aerobico|mixto|descanso|otro",
  "duracion_min": 0,
  "kcal_min": 0,
  "kcal_max": 0,
  "comentario": "string"
}
```

- Cambio de prompt congelado: actualizar `prompts.ts` + esquema/tests y sincronizar
  `04-IA.md`; revalidar F-IA-5 y consistencia ×3 por tocar estimación.

### F-IA-10 · Importar semana

- Mantiene esquema y modelo; solo cambia el contrato de `contenido`: completo, fiel,
  ordenado y separado por bloques, no resumen.
- Actualizar `prompts.ts` + `prompts.test.ts` y sincronizar `04-IA.md`; revalidar el PDF real
  `TP1_Week_29.pdf` y el caso agnóstico de running. Consistencia ×3 de duración/kcal.

### Coste

Sin llamadas nuevas: una llamada al analizar/importar, cero al guardar o consultar.

## Impacto en Coach/Chat/Visita

- Corrige la incoherencia actual: `sessionRef` y los campos desnormalizados siempre apuntan a
  la misma sesión.
- Coach/Chat/Visita reciben nombre, tipo y kcal de la sesión definitiva por el contexto
  existente. No se añaden instrucciones a sus prompts.
- El contenido detallado no se inyecta automáticamente en cada prompt; queda disponible en
  Plan/Hoy. Incluirlo en Chat bajo demanda queda fuera de F17.

## AC

1. ✅ 🖐 Plan · Entrenos reproduce la jerarquía del mockup: selector semanal, días y ficha de
   lectura con nombre, metadatos y bloques; la edición no está desplegada permanentemente.
2. ✅ 🖐 Tocar un día vacío → `Añadir sesión` → Manual → guardar; la ficha aparece en ese día.
3. ✅ 🖐 Esa sesión aparece en Hoy al navegar a la misma fecha y `Ver sesión` abre el mismo
   detalle.
4. ✅ 🖐 Pegar un WOD desde Plan → analizar → guardar; conserva todo el texto y muestra
   nombre/tipo/duración/rango y bloques legibles.
5. ✅ 🖐 Pegar un WOD desde Hoy cuando ya había sesión → la sustituye; Plan y Hoy muestran la
   nueva y `Deshacer` restaura la anterior.
6. Con sesión importada + WOD sustituto, `dayContext` cita la sesión nueva, nunca el nombre
   antiguo referenciado.
7. Sin plan semanal, añadir desde Plan u Hoy crea una única semana manual y una sesión
   asignada; repetir no crea semanas solapadas ni sesiones dobles.
8. El formateador de contenido preserva el 100 % del texto en casos: encabezados, párrafos,
   líneas y fallback de un bloque; tests puros antes que UI.
9. F-IA-10 sobre `TP1_Week_29.pdf` conserva el detalle de todos los bloques y mantiene
   estables sesiones, tipos, duración y kcal en tres ejecuciones. **Cierre aceptado por
   Alex con Week 31 real y la consistencia previa de F-IA-10; el archivo Week 29 exacto no
   estuvo disponible y no se afirma una ejecución ×3 sobre él.**
10. Editar/reasignar/borrar sigue disponible en sheets; semanas pasadas conservan el modo de
    consulta actual.
11. Export/restore mantiene igualdad de filas; `pnpm typecheck && pnpm test && pnpm build`
    verdes.

## Riesgos / decisiones discutibles

1. **Una sesión sustituye a la planificada.** Se pierde la comparación plan vs realidad,
   deliberadamente: Alex solo necesita la sesión definitiva. El undo protege errores.
2. **Bloques derivados desde texto, sin JSONB.** Es la opción simple y evita migración/editor
   doble. El fallback conserva todo el texto aunque la presentación no pueda dividirlo.
3. **Tocar dos prompts de estimación.** No añade llamadas, pero obliga a revalidar F-IA-5 y
   F-IA-10. Se conserva el WOD original fuera de la generación para minimizar pérdida.

## Fases

- **Fase 1 · Lectura y gestión**: ficha del mockup, formateador puro, sheets de sesión/semana
  y `Añadir sesión` manual.
- **Fase 2 · Fuente única**: mutación atómica, sincronización Plan↔Hoy, detalle reutilizable,
  sustitución + undo y corrección de `sessionRef`.
- **Fase 3 · IA**: F-IA-5 (`tipo` + persistencia del WOD original) y F-IA-10 (contenido
  completo por bloques), tests/AC de consistencia y sync de `04-IA.md`.

Orden: el modelo canónico y sus tests antes de conectar las dos superficies; después UI y,
por último, cambios de prompts congelados.

## Resultado de implementación · 2026-07-26

- Fase 1: `d48af9f` — formateador puro byte-preserving, ficha reutilizable y gestión en
  sheets.
- Fase 2: `94f7cc4` — comando canónico transaccional, semana manual sin solape,
  creación/sustitución/undo y detalle compartido Plan↔Hoy↔Historial.
- Fase 3: contratos F-IA-5/F-IA-10, schemas/tests, contexto y sync de `04-IA.md`/`09`.
- Automatizado: AC6, AC7, AC8, AC10 y AC11 pasan (`typecheck` + 391 tests + build;
  export/restore sigue cubierto sin cambio de schema). Consistencia real ×3 pasa en WOD y
  running.
- Quick-fix de uso real (domingo 26-jul): Plan permite navegar a semanas futuras y el
  importador hereda la semana visible, en vez de recortarla a la actual. Cubierto por
  regresión pura con `2026-07-26 → 2026-07-27` y Playwright sin escrituras.
- Quick-fix de uso real (Week 31): el formateador prioriza párrafos completos sobre saltos
  simples. La fila T1 real pasa de fragmentarse en líneas a 6 bloques coherentes y conserva
  byte a byte el contenido; F-IA-10, modelo y sesiones guardadas permanecen intactos.
- Quick-fix de uso real (semana del 3-ago, sesión importada por IA): el texto de la IA
  llegaba con saltos SIMPLES y sin línea en blanco, así que el formateador caía en el
  corte por línea y la sesión se desmenuzaba en 21 filas de una línea. Ahora la prioridad
  es párrafos > encabezados de sección > líneas, el corte por línea es el último recurso
  y el vocabulario de encabezados cubre también los de The Progrm y los de la hoja del box
  (`Plyometrics`, `Weightlifting/Strength`, `Conditioning`, `Gymnastics`, `Accessory`,
  `WOD`…). Además, al cortar por línea ya no se parte una frase envuelta: si la línea
  siguiente arranca en minúscula es la continuación visual de la anterior (texto copiado
  de un PDF con los saltos del ajuste de página) y se queda en el mismo bloque.
  F-IA-10 pasa a exigir una LÍNEA EN BLANCO entre bloques y a unir las frases que el
  documento de origen partió en varios renglones. Verificado contra las filas reales: la
  sesión rota pasa de 21 a 4 bloques, el `Día 4` de 6 a 3, y las 6 sesiones del PDF de la
  Week 31 conservan exactamente los bloques que ya tenían.
- Cierre: Alex aprueba los AC 🖐 1–5 y da F17 por completada el 2026-07-26. Acepta la
  sustitución de evidencia de AC9 descrita arriba; no quedan AC pendientes.
