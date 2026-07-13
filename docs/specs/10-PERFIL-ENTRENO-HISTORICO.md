# 10 · Perfil de atleta, plan de entrenamiento e histórico unificado (v1.1 → v1.2)

> Extiende el paquete de specs 00-09 y el brief `BACKLOG-coach-perfil-entreno.md` (cuyo
> diagnóstico con `archivo:línea` sigue vigente y esta spec absorbe). Visión: **Fuelboard
> deja de asumir CrossFit/The Progrm** — cualquier deportista con su dieta, su programación
> y sus objetivos cambiantes. Sigue siendo app de usuario único; la generalización es del
> MODELO DE DATOS y los PROMPTS, no del producto.

## Principio nuevo (añadir a CLAUDE.md como principio 9)

**9. La IA habla con el atleta de hoy.** Ningún dato personal, deportivo ni de objetivos va
hardcodeado en prompts o código: todo sale del perfil vigente y del calendario real. El
objetivo es un estado con fecha, no una constante — y su historial es parte de los datos.

---

## Fase A (v1.1) · Perfil de atleta + Coach consciente del calendario

### A1 · Perfil de atleta (setting `athleteProfile`, jsonb — sin migración)

Campos:

```
fechaNacimiento (date → la edad se DERIVA, nunca se guarda)
alturaCm · sexo?
deporte (texto libre, ej. "CrossFit") · nivel (ej. "avanzado, competitivo")
programa (ej. "The Progrm 1") · franjaEntreno (ej. "19:30-21:30")
suplementos: string[]           (hoy: creatina, beta-alanina, citrulina)
notaClinica (ej. "le cuesta la grasa abdominal baja")
lesiones?: string[]             (informativo para el coach)
objetivos: [{ desde: date, texto, pesoObjetivo? }]   // HISTORIAL, orden cronológico
```

- **Objetivo vigente** = último por `desde`. El historial se conserva siempre (nunca se
  edita el pasado; cambiar de objetivo = añadir entrada nueva).
- **Precarga** con los valores hoy hardcodeados (perfil de Alex + objetivo actual
  "recomposición: perder grasa manteniendo músculo, definición para verano", desde ~mayo-2026).
- **UI**: tarjeta "Perfil del atleta" en Ajustes (junto al mapeo de sesiones): campos
  simples, suplementos y lesiones como chips, y sección "Objetivo" con el vigente destacado +
  botón "Cambiar objetivo" (añade entrada fechada) + historial plegado debajo.
- `diasEntrenoSemana` NO se guarda: se **deriva** del mapeo `sessionByWeekday` (nº de días
  ≠ Descanso). Una sola fuente de verdad.

### A2 · `ATHLETE_CONTEXT` dinámico (plantilla congelada, valores interpolados)

Sustituye a la constante en `prompts.ts` y a `04-IA.md` §contexto. Plantilla:

> Atleta: {deporte} {nivel}, {edad} años, {alturaCm} cm, {pesoReciente} kg. Programa:
> {programa}; entrena {franjaEntreno}, {diasEntrenoSemana} días/semana. **Objetivo actual
> (desde {fecha}): {objetivo}.** Suplementos que toma: {suplementos | "ninguno"}.
> {notaClinica?} {lesiones?}

Versión **compacta** para features de estimación (F-IA-1/2/3/4/9):

> Contexto del usuario: {deporte}, {alturaCm} cm, {pesoReciente} kg, objetivo: {objetivo}.
> El perfil es contexto del usuario; NO ajustes las estimaciones nutricionales según el
> perfil — los macros son del alimento, no de la persona.

(En F-IA-1 foto, la altura/complexión SÍ puede usarse como referencia de escala de raciones;
mantener esa excepción explícita en el prompt de foto.)

### A3 · Guardarraíles del Coach (F-IA-6) — añadir al prompt, sincronizar 04-IA

1. **Anti-suplementación** (paridad con el Chat): «Observas y explicas; NO prescribes
   suplementación. Si sugieres suplementos, SOLO los de su perfil; nada fuera de esa lista.
   Prioriza comida real y las comidas del plan que le quedan.»
2. **Anti-entreno-fantasma**: «Si la sesión de hoy es Descanso o no hay sesión, NO asumas
   que va a entrenar ni des timing pre/post-entreno.»

### A4 · El Coach (y Chat/Visita) miran el calendario

- El route del Coach lee `sessionByWeekday`; `dayContext()` sin `sessionLabel` registrado
  emite: `Sesión: sin registrar (según tu calendario semanal, hoy toca: {X}).`
- Mismo tratamiento en el contexto del Chat (F-IA-8) y Preparar visita (F-IA-7) para el
  día en curso.

### AC de la Fase A

- `athleteContext` sin ningún dato hardcodeado; editar el perfil en Ajustes cambia la
  respuesta del Coach/Chat en la siguiente llamada.
- Coach en día mapeado Descanso sin check-in → no asume entreno ni da timing.
- Coach nunca recomienda un suplemento fuera de la lista del perfil (test: perfil sin whey).
- Cambiar de objetivo crea entrada nueva fechada; el Coach cita el objetivo vigente; el
  historial se conserva y es visible en Ajustes.
- Test de consistencia (DECISIONS #65, café ×3) re-ejecutado tras tocar prompts: cifras
  estables (si se mueven → parar y revisar antes de commit).
- `04-IA.md` sincronizado (plantillas nuevas + guardarraíles); decisiones en DECISIONS.

---

## Fase B (v1.2) · F-IA-10 Plan de entrenamiento importable + histórico unificado

### B1 · Modelo de datos (migración)

```
training_plans   id · imported_at · programa · etiqueta (ej. "Week 29") ·
                 valid_from (date) · valid_to (date, null=abierta) · source (pdf|foto|texto)
training_sessions id · plan_id · key (ej. "T1") · nombre · tipo
                 (fuerza|halterofilia|gimnásticos|metabólico|aeróbico|mixto|descanso|otro) ·
                 contenido (texto) · kcal_min · kcal_max · duracion_min
days.session_ref  (nullable FK → training_sessions)   // además de sessionLabel/sessionKcal
```

`tipo` es genérico (cualquier deporte); `key/nombre` libres (T1-T6 en The Progrm, "Series
umbral" en un plan de running, "Técnica" en natación).

### B2 · F-IA-10 «Importar semana de entrenamiento» (prompt nuevo congelado → 04-IA)

- Entrada: PDF/foto/texto de la programación semanal (reutiliza la infra de F-IA-9: PDF
  nativo, `maxOutputTokens` alto, Zod + 1 reintento, vista previa editable).
- Prompt (esqueleto a congelar en 04-IA): «Este documento es la programación semanal de
  entrenamiento de un atleta de {deporte} ({programa}). Extrae CADA sesión: clave/nombre,
  tipo (…enum…), contenido resumido fiel, y estima duración y gasto energético
  (kcal_min/kcal_max) para un atleta de {pesoReciente} kg (criterios de F-IA-5, conservador,
  sin EPOC). JSON: {"sesiones":[…]}» — agnóstico de deporte.
- **Flujo (bottom-sheet, 09 §6)**: subir → vista previa editable de sesiones → **asignar
  cada sesión a una fecha** de la semana (drag o selects) marcando descansos explícitos →
  confirmar crea el plan con `valid_from/to` y rellena `days.session_ref/-Label/-Kcal` de
  los días asignados (sin pisar días ya registrados manualmente).

### B3 · Integración

- **Dropdown de sesión** (check-in y "Mi día"): primero las sesiones del plan vigente para
  esa fecha (con su nombre real), luego Competición/Descanso, luego la lista genérica
  `SESSIONS` como fallback si no hay plan importado.
- **Coach/Chat/Visita**: el contexto del día incluye la sesión real asignada (nombre, tipo,
  gasto estimado) — muere de raíz el problema del descanso y el gasto es de la sesión real.
- Absorbe el ítem de backlog «workouts → modelo de coste por tipo de día».

### B4 · Histórico unificado (Progreso → nuevo segmento «Historial»)

Timeline de solo lectura, orden cronológico inverso, mezclando cuatro fuentes ya fechadas:
cambios de **objetivo** (perfil), versiones de **dieta** (`diet_versions.effective_from`),
semanas de **entrenamiento** (`training_plans.valid_from`) y **MEDs**. Cada entrada: fecha,
tipo (icono/color), resumen de una línea, expandible al detalle. Es la vista "cómo he
llegado hasta aquí" — y en la visita al nutricionista, el contexto de un vistazo.

### AC de la Fase B

- Importar `TP1_Week_29.pdf` (gitignorado, copyright) → 6 sesiones con tipo y gasto; T4
  asignable como descanso.
- El día con T4=descanso: el Coach no asume entreno. El día con T1: cita halterofilia y su
  gasto estimado.
- El dropdown de sesión muestra las sesiones reales de la semana importada.
- Historial muestra intercaladas: la dieta de junio, las semanas importadas, el cambio de
  objetivo y las MEDs.
- Un plan de OTRO deporte en texto (fixture inventado de running: series, rodaje, descanso)
  se importa sin tocar código — prueba de agnosticismo.

---

## Orden y disciplina

Fase A y Fase B son sesiones/fases separadas (A no requiere migración; B sí). Protocolo de
siempre: prompts nuevos/modificados congelados en `04-IA.md`, flujos en `09` si cambian,
decisiones en DECISIONS, tests+typecheck en verde, commits pequeños, AC uno a uno al cierre.
