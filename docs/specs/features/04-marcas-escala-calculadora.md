# F04 · Marcas a escala + calculadora doble (%) + familia
**Estado**: implementada · **Tamaño**: feature
**Fecha**: 2026-07-14 · **Origen**: validación de F03 en prod (2026-07-14) + conversación de producto con Alex ese día.

## Motivación (caso real)
- Tras validar F03, Alex confirma que las marcas **escalan a 20-40**: no solo 1RM de un ejercicio,
  sino variantes (muscle/power/squat snatch), varias rep-max (1RM/2RM/3RM), pesos muertos,
  y benchmarks de tiempo/distancia (mejor 5k, 10k, Fran). La **tira horizontal** del Historial y
  la lista plana de Plan **no aguantan** ese volumen: scroll lateral infinito, imposible encontrar.
- En la calculadora de %, Alex quiere ver el resultado **sobre su última (vigente) Y sobre su récord**
  a la vez: «así veo, según cómo me siento, si estoy más cerca de una o de otra». (Supera la decisión
  de F03 de mostrar solo la última; no es un toggle con modo, son las dos cifras juntas.)

## Alcance
- **Calculadora de % con doble referencia** (solo marcas de peso, determinista, cero IA): el input de %
  (default 85) muestra el resultado **sobre la ÚLTIMA (vigente, primario)** y **sobre el RÉCORD (secundario)**.
  Si última === récord (una sola entrada, o la última ya es el récord), se muestra **una sola línea**.
  La última sigue siendo la cifra destacada (protege contra programar sobre un récord viejo).
- **Buscador de marcas en Plan · Entrenos**: filtro en vivo por nombre (cliente, <50 ms, sobre las marcas
  ya cargadas). Escala a cualquier número: escribes «snatch» y ves sus variantes al instante.
- **Campo «familia» OPCIONAL al crear una marca**: texto libre con autocompletado de familias existentes
  (ej. «Snatch», «Squat», «Carrera»). Se **captura ahora** para no re-tocar todas las marcas el día que
  añadamos filtro/agrupación por familia. **No se construye el filtro por familia todavía** (el buscador basta).
- **Historial · carril de Marcas rediseñado**: muestra solo las **marcas actualizadas más recientemente**
  (últimas ~4-5 por fecha de su última entrada) + **«ver todas →»** que navega a **Plan · Entrenos**
  (`/plan?tab=entrenos`), patrón «ir al actual» de Dieta/Entreno. Deja de intentar mostrar todas en la tira.
- **Arquitectura**: Plan · Entrenos = hogar de gestión (lista completa + buscador + crear/registrar);
  Progreso · Historial = consulta rápida (recientes + enlace). Sheet de detalle único, compartido.

## NO-alcance
- **Filtro/agrupación por familia**: solo se CAPTURA el dato; el filtro es futuro (candidato cuando el
  buscador se quede corto). No se construye UI de agrupación ahora.
- **Agrupación por tipo de medida** (Peso/Tiempo/Reps/Distancia): descartada por ahora — el buscador basta
  (decisión de Alex).
- **Toggle récord/última**: descartado a favor de mostrar **ambas cifras** (sin modo que gestionar).
- **Auto-resolver «@85%»** de la sesión importada (F-IA-10) contra las marcas: sigue siendo **Fase 2 de F03**,
  aparcada (Alex: «de momento no sube»).
- **Matriz movimiento × rep-scheme**: se mantiene el modelo de F03 (marcas independientes por nombre libre;
  «Muscle Snatch 1RM» y «Power Snatch 1RM» son dos marcas). La familia es una etiqueta, no una reestructuración.

## Momento de uso (09 §1)
- **Calcular %**: frecuente, en sesión de fuerza (varias veces/semana) → calculadora doble.
- **Buscar una marca entre muchas**: cuando el volumen crezca (semanal/puntual) → buscador en Plan.
- **Ver progresión / consulta rápida**: Historial (recientes + ver todas).
- Todo en **Plan · Entrenos** (gestión) y **Progreso · Historial** (consulta). **Nada nuevo en Hoy** (09 §6).

## Datos
- `performance_marks.family text` (**nullable**) → **migración 0005 aditiva** (0 pérdidas, reversible con DROP COLUMN).
- **Export/restore**: `family` entra solo en el export (select *) y hay que mapearla en el restore (`s(r.family)`).
- **`migrate:poc`**: sigue no-op (el PoC no tiene marcas).
- Buscador, «recientes» y récord/última se **derivan en lectura** (cliente/`lib/marks`), sin datos nuevos.

## Flujo (09)
1. **Plan · Entrenos → bloque «Marcas»**: buscador arriba (filtra en vivo) + lista + «＋ Marca».
   El sheet de registro añade un campo **Familia (opcional)** con autocompletado.
2. **Sheet de detalle**: calculadora de % muestra las dos referencias (última / récord) cuando difieren.
3. **Progreso · Historial → carril «Marcas»**: recientes (~4-5) + **«ver todas →»** → `/plan?tab=entrenos`.

## IA
- **Sin cambios.** El contexto de marcas (F03: última + récord + progresión) ya existe en Chat/Visita.
  `family` NO entra en el prompt por ahora (no aporta a las preguntas actuales; se puede añadir gratis si
  algún día ayuda). Guardarraíl anti-sobreatribución intacto.

## Impacto en Coach/Chat/Visita
- Ninguno nuevo. (El Coach sigue sin marcas; Chat/Visita ya las conocen desde F03.)

## AC
1. 🖐 La calculadora muestra el % **sobre la última y sobre el récord** cuando difieren (ej.: última 103 → 85 % = 87,55;
   si el récord fuera 110, también 85 % = 93,5); si coinciden, una sola línea. La última es la cifra destacada.
2. 🖐 En Plan · Entrenos puedo **buscar marcas por nombre** y la lista filtra en vivo.
3. Al crear una marca puedo asignarle una **familia opcional** (autocompletada de las existentes); se guarda.
4. 🖐 El **Historial** muestra las marcas recientes + **«ver todas →»** que lleva a Plan · Entrenos.
5. **Export** incluye `family`; **restore** la recupera; `migrate:poc` sigue no-op (principio 7).
6. Nada nuevo permanente en **Hoy**; `pnpm typecheck && pnpm test` en verde.

## Riesgos / decisiones discutibles
1. **Familia como dato «durmiente»** (se captura pero aún no se filtra): se acepta para no re-etiquetar 30 marcas
   cuando añadamos el filtro. **Recomiendo aceptarlo** (coste: un campo opcional en el registro).
2. **Calculadora doble** podría invitar a programar sobre un récord viejo (justo lo que F03 quería evitar):
   se mitiga con **jerarquía visual** — la última («vigente») grande y primaria; el récord, secundario y etiquetado.
3. **«Ver todas» navega a Plan** en vez de abrir la lista en un sheet: coherente con 09 (Plan = gestión) y con el
   «ir al actual →» de Dieta/Entreno. Recomiendo esta vía (un solo hogar para la lista larga).

## Fases
Una sola sesión. Orden sugerido (lógica/sin-migración primero): (1) calculadora doble (sin migración),
(2) buscador en Plan, (3) familia opcional + migración 0005 + export/restore, (4) Historial recientes + «ver todas».
