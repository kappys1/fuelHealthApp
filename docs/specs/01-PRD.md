# 01 · PRD — Fuelboard

## 1. Visión

Una sola app que responda tres preguntas con datos, no sensaciones:

1. **¿Estoy comiendo lo pautado?** (adherencia al plan del nutricionista, con presupuesto diario flexible)
2. **¿Está funcionando?** (déficit/superávit REAL calculado desde el peso, no desde el reloj; evolución de composición corporal)
3. **¿Qué ajusto?** (coach IA diario, preparación de visitas al nutricionista con preguntas fundamentadas en datos)

## 2. Usuario y contexto (usar en todos los prompts de IA)

- Alex, 33 años (27/09/1992), 175 cm, ~91-94 kg, complexión fuerte, ~9-11% grasa según pliegues.
- CrossFit competitivo: The Progrm, 6 días/semana, entrena 19:30-21:30. Competiciones ocasionales de fin de semana (viernes-domingo) con 2-4 WODs/día.
- NEAT alto reciente: 12-13k pasos/día (antes <3k), corre 2-3 veces/semana. FC reposo ~47, VO2max ~50, HRV media ~67 ms.
- Suplementos: creatina 5 g/día, beta-alanina, citrulina. Toma agua de mar + limón (sodio: relevante para retención).
- Nutricionista: Regenera (Barcelona). Pauta actual: **1.800 kcal, 110 g proteína**, plan por opciones intercambiables. Mediciones mensuales por pliegues (los viernes/sábado): grasa kg, músculo kg, peso (autorreportado de su báscula en ayunas).
- Objetivo: bajar a ~90-91 kg definido para verano SIN perder músculo; historial de un ciclo volumen+definición ineficiente (sept 2025→jul 2026: +0,25 kg músculo, +1,3 kg grasa neto) que no quiere repetir.
- Suda mucho; el peso diario fluctúa fuerte con sodio/glucógeno/WODs.
- Sensible a hinchazón: la carga de hidratos pre-competición le "tapa" (sospechosos: fibra, sandía/FODMAP, sodio irregular).

## 3. Principios de producto (NO negociables — copiar a CLAUDE.md)

1. **La báscula es la fuente de verdad del gasto.** El déficit/TDEE real sale de la pendiente del peso (media móvil 7 días). Las kcal del Apple Watch (error 15-30% en fuerza/CrossFit) y las estimaciones de sesión son SOLO contexto y se presentan visualmente subordinadas. Una sola cifra manda.
2. **Consistencia > exactitud.** Un sesgo constante en las estimaciones lo absorbe la calibración por peso; el ruido aleatorio no. Por eso: `temperature: 0` en toda llamada IA, instrucción de asumir "la variante más común en España" ante ambigüedad, y macros SIN decimales en UI (teatro de precisión prohibido).
3. **La fricción mata el sistema.** Registrar un día completo debe costar <2 minutos. Todo camino de entrada rápida es prioritario: favoritos 1 toque, copiar ayer, plantillas, volcado de día por texto, foto.
4. **Fase ≠ sesión.** Qué entrenó (sesión) y el contexto nutricional del día (fase: Normal/Carga/Competición/Recuperación) son dimensiones independientes. Las fases especiales cambian el comportamiento: pasarse de kcal no es desviación, y esos días se excluyen de adherencia e ingesta media.
5. **Cada fuente se compara consigo misma.** Báscula propia vs báscula propia (mañana, ayunas); MED del nutricionista vs MED. Nunca cruzar valores absolutos entre fuentes.
6. **Datos reales > manuales.** Al importar de Apple Health, si hay valor para una fecha, machaca el manual; si no viene, se conserva el manual.
7. **Los datos son sagrados.** Export completo en 1 clic, import/restore, backups automáticos, migraciones versionadas. En el PoC el recordatorio salta a los 7 días sin export; en la app real el backup es automático (BD gestionada) pero el export sigue existiendo.
8. **El sistema informa, el nutricionista decide.** La IA nunca prescribe cambios de dieta; señala datos y genera preguntas para la consulta. Ajustes de kcal/proteína son conversaciones con Regenera, con la app como evidencia.

## 4. Requisitos funcionales

Notación: **[Fx.y]** requisito · _(AC)_ criterio de aceptación.

### F1 · Plan de dieta

- **[F1.1]** El plan tiene comidas fijas: Almuerzo, Comida, Merienda, Cena (+ categoría "Extra / fuera de plan" solo para registro). Cada comida contiene opciones agrupadas por **grupo** (Verdura, Hidratos, Proteína, Grasa, Otros, u "Opción única"). Semántica: en Comida/Cena se elige UNA opción por grupo; en Almuerzo UNA opción; en Merienda se toma el conjunto.
- **[F1.2]** Cada opción: nombre, grupo, `baseG` (gramos pautados; null = unidades fijas como "4 huevos"), kcal, prot, carb, fat (para `baseG`). Plan semilla: el de Regenera actual (ver `03-DATOS §5`, tabla completa con valores).
- **[F1.3]** Opciones editables: crear (con estimación IA de macros+grupo desde nombre+gramos, ver 04-IA §F-IA-3), editar, borrar.
- **[F1.4]** Objetivos diarios editables: kcal, prot, carb, fat. kcal y prot vienen del nutricionista; carb y fat pueden **derivarse del propio plan** con un botón: día pautado medio = por comida, media de cada grupo (Almuerzo: media de opciones; Merienda: suma de todas), sumando también rango kcal min-max según elecciones. _(AC: con el plan semilla, el derivado da ~1.700-1.800 kcal medio y rango ~1.550-1.950.)_
- **[F1.5]** **Historial de dietas versionado** (nuevo vs PoC): al cambiar objetivos o plan se crea una versión con fecha de vigencia; los días pasados se evalúan contra la versión vigente entonces. _(AC: cambiar kcal hoy no altera la adherencia calculada de la semana pasada.)_
- **[F1.6]** **Importar dieta con IA**: subir foto o PDF de la pauta del nutricionista → la IA la convierte en comidas + opciones con grupo, gramos base y macros estimados (04-IA §F-IA-9) → vista previa editable → confirmar crea una nueva versión de dieta completa. Elimina el teclear la dieta a mano cuando Regenera la cambie. _(AC: con la foto real de la pauta actual, reconstruye las ~34 opciones con sus gramos.)_

### F2 · Registro diario de comidas

- **[F2.1]** Cada entrada: comida (almuerzo/comida/merienda/cena/extra), nombre, kcal, prot, carb, fat, origen (`plan|foto|manual|ia|fav|plantilla`).
- **[F2.2]** Añadir desde plan: lista por comida/grupo con **gramos editables que reescalan kcal/macros en vivo antes de añadir** (regla de tres sobre `baseG`).
- **[F2.3]** Entrada manual con 4 campos de macros + botón "Estimar macros con IA" desde la descripción (04-IA §F-IA-2).
- **[F2.4]** **Favoritos**: estrella en cualquier entrada la guarda como favorito (clave: comida+nombre); chips de 1 toque para añadir.
- **[F2.5]** **Copiar ayer**: duplica todas las entradas del día anterior.
- **[F2.6]** **Plantillas de día**: guardar el día actual con nombre; aplicar (añade, no reemplaza); borrar.
- **[F2.7]** **Volcado del día (IA)**: texto libre con todo lo comido → la IA lo trocea en entradas con comida asignada y macros; vista previa con total; "Añadir todo" (04-IA §F-IA-4).
- **[F2.8]** **Foto (IA)** — el flujo completo probado en el PoC (04-IA §F-IA-1):
  - selector de comida + campo **"Aclaraciones"** que PREVALECE sobre lo visual ("la leche es desnatada", "es jamón serrano");
  - resultado con **desglose por componente**: nombre sin gramos + campo de gramos editable (recalcula kcal/macros proporcionalmente en vivo, sin re-llamar a la IA; el input se ancla a los gramos base y no desaparece al vaciarlo) + macros; total sumado; veredicto encaja/no encaja con el plan + comentario;
  - **"Reanalizar la foto con las aclaraciones"** reutiliza la misma imagen sin resubir;
  - añadir **por separado** (1 entrada por componente, con gramos finales en el nombre) o **como 1 entrada** (suma).
- **[F2.9]** **Edición en línea**: tocar cualquier entrada registrada abre formulario con descripción, comida (recategorizar), kcal y 3 macros; guardar/cancelar. Borrar con papelera.
- **[F2.10]** Presupuesto del día siempre visible: kcal consumidas/objetivo con "X restantes" o "+X", barra principal; barra de proteína; mini-barras de hidratos y grasa; línea resumen "Faltan: X kcal · Y g prot · Z g hidr · W g grasa" o "Objetivos cubiertos ✓". **Comportamiento por fase**: en Carga/Competición/Recuperación, el exceso se muestra en color informativo (no de error) con nota "superar el objetivo es esperado en esta fase; este día no cuenta como desviación".
- **[F2.11]** **Fotos guardadas**: al añadir entradas desde un análisis de foto, la imagen (ya reducida) se guarda en Vercel Blob y queda vinculada a la(s) entrada(s). En la lista, miniatura tocable que abre la foto completa; borrar la entrada borra el blob si ninguna otra entrada lo referencia. Valor: memoria visual de raciones («¿cuánto era 240 g de arroz?») y auditoría de estimaciones. _(AC: descartar un análisis sin añadir no guarda nada.)_

### F3 · Día (contexto no alimentario)

- **[F3.1]** Campos manuales: peso (kg, ayunas), agua (L), % grasa de báscula (bioimpedancia Xiaomi — mostrar solo tendencia mensual, es ruidosa), **hinchazón** (Ninguna/Leve/Moderada/Alta), **notas libres** (sensaciones, rendimiento, digestión — alimentan al coach y a la preparación de visita).
- **[F3.2]** **Sesión**: desplegable T1-T6 de The Progrm (T1 Halterofilia+WOD · T2 Carrera+Gimnásticos · T3 Fuerza+Gimnásticos · T4 Aeróbico/Descanso activo · T5 Halterofilia+WOD · T6 Mash largo), Competición, Descanso — más sesiones personalizadas: pegar el texto del training → IA estima etiqueta, duración y rango kcal (04-IA §F-IA-5); "usar como sesión de hoy" guarda etiqueta + kcal medias. El gasto de sesión es CONTEXTO (principio 1), se muestra en pequeño.
- **[F3.3]** **Fase del día**: Normal (default) / Carga pre-competición / Competición / Recuperación post-competición.
- **[F3.4]** Métricas del reloj (solo lectura, de la ingesta de Salud): pasos, kcal activas/basales, HRV, sueño, FC reposo, VO2max — línea informativa "Del reloj: …".

### F4 · Salud (Apple Health)

- **[F4.1]** **Endpoint REST** `POST /api/health/ingest` autenticado por token, compatible con las Automations de Health Auto Export (JSON). Upsert por fecha. (Detalle en 03-DATOS §4.)
- **[F4.2]** **Import CSV** de respaldo (formato Health Auto Export, agregación diaria): cabeceras EN ESPAÑOL, detección por substring case-insensitive; **kJ→kcal (÷4,184)** cuando la cabecera contiene "(kJ)"; **mL→L** para agua. Columnas y mapeo exacto en 03-DATOS §4.2. Precedencia: CSV/endpoint machaca manual si trae valor (principio 6).
- **[F4.3]** Import de **workouts** (CSV o endpoint): tipo, duración, FC media, kcal activas por sesión — para clasificar carga real y futuro modelo de coste por tipo de día.
- **[F4.4]** Vista "Últimos días": tabla de 2 líneas por día (fecha, peso, kcal ingeridas, sesión·fase / gasto reloj con activas desglosadas, pasos, HRV, sueño, hinchazón).
- **[F4.5]** **Export JSON completo** (mismo esquema que el PoC, ampliado) e **import/restore** desde ese JSON.

### F5 · MED (mediciones del nutricionista)

- **[F5.1]** Registro: fecha, grasa kg, músculo kg, peso kg. Editar/borrar.
- **[F5.2]** Historial con diferencias vs medición anterior, **con signo matemático correcto** (el Excel del dietista trae signos volteados — la app siempre calcula `actual − anterior`) y color semántico: grasa↓ verde, músculo↑ verde, etc.
- **[F5.3]** Gráfico de composición: peso y músculo en eje izquierdo, grasa en eje derecho.
- **[F5.4]** Contexto histórico: las MED se comparan solo entre sí (principio 5). Anotar en la UI que músculo por pliegues tiene ruido de hidratación/glucógeno; una medición mala cerca de carga/competición no es tendencia.

### F6 · Tendencia (analítica)

- **[F6.1]** Serie de peso con **media móvil de 7 días** (ma7). Los pesos de días en fase Carga/Competición/Recuperación —y los **2 días siguientes a una Competición**— se **excluyen de la pendiente** (mejora vs PoC: el glucógeno de la carga distorsiona ~1-1,5 kg durante días, y el rebote tras competir persiste un par de días más).
- **[F6.2]** Tarjeta "Tu gasto y déficit reales · desde el peso" (jerarquía visual máxima): kg/semana (pendiente ma7), déficit kcal/día (`−kgSemana × 7700 ÷ 7`), TDEE real (`ingesta media días Normal + déficit`). Requiere ≥8 pesajes en ≥7 días; si no, estado vacío pidiendo pesaje diario en ayunas. Nota fija: "las kcal del reloj y las sesiones son contexto".
- **[F6.3]** Adherencia últimos 14 días: días registrados; días dentro de ±10% kcal y días con proteína ≥90% del objetivo — ambos SOLO sobre días en fase Normal.
- **[F6.4]** Gráficos: peso+ma7; barras de ingesta diaria con línea de referencia en el objetivo kcal.
- **[F6.5]** (Fase 4) Correlaciones hinchazón: frecuencia por alimento/etiqueta, por fase, vs sodio implícito y sueño. Empezar simple: lista de días con hinchazón ≥Moderada y qué se comió.
- **[F6.6]** **Métricas comprensibles**: toda cifra derivada lleva un icono de info que abre popover con: qué es, fórmula en lenguaje llano, y qué hacer con ella (p. ej. déficit real: «pendiente de tu peso medio de 7 días × 7.700 kcal/kg; esta es la cifra que manda — si es más agresiva de lo pautado, coméntalo con tu nutricionista»). Selector de rango temporal en Tendencia: 14 / 30 / 90 días / todo.

### F7 · IA transversal

- **[F7.1]** **Coach diario**: "Analizar ayer" (qué bien, qué mal, 1-2 acciones) y "¿Cómo voy hoy?" (kcal/prot restantes + sugerencia concreta con comidas del plan restantes + avisos: proteína baja, hidrato lejos del entreno de 19:30, poca agua). Contexto completo del día incluidas notas e hinchazón. (04-IA §F-IA-6.)
- **[F7.2]** **Preparar visita**: análisis de evolución con TODOS los datos (21 días de registros + historial MED + tendencia) y 4-6 preguntas concretas para el nutricionista, cada una anclada al dato que la motiva. (04-IA §F-IA-7.)
- **[F7.3]** Toda IA: errores visibles con mensaje concreto (nunca fallo silencioso), estados de carga, `temperature: 0`.
- **[F7.4]** **Chat sobre tus datos** (nueva pestaña o acceso desde Tendencia): conversación multi-turno con la IA que responde CON los datos del usuario como contexto (objetivos y plan vigente, últimos 30 días de registros, MEDs, tendencia y adherencia). Ejemplos reales de pregunta: «¿qué días de esta semana me pasé y por qué?», «¿cómo me sienta la carga comparada con la de la competición anterior?», «¿qué merienda me deja mejor la proteína del día?». Hilos persistentes con historial, chips de preguntas sugeridas, y los guardarraíles del principio 8 (observa y explica, no prescribe cambios de dieta; para eso, la visita). Spec completa en 04-IA §F-IA-8.

### F8 · PWA / plataforma

- **[F8.1]** PWA instalable (manifest + service worker): standalone, iconos, tema claro/oscuro. Cámara vía `<input type="file" accept="image/*" capture="environment">` (en PWA iOS abre cámara nativa y convierte HEIC→JPEG automáticamente).
- **[F8.2]** Registro offline: si no hay red, las entradas se encolan localmente (IndexedDB) y se sincronizan al volver. Las features IA requieren red (deshabilitadas offline con aviso).
- **[F8.3]** Selector de fecha para registrar días pasados. "Día" = fecha en Europe/Madrid (nunca `toISOString()` a pelo — bug conocido del PoC, usar utilidades con TZ).

## 5. Fuera de alcance v1

Multiusuario/social, notificaciones push, integración directa HealthKit nativa (la cubre Health Auto Export), base de datos de alimentos externa (OpenFoodFacts/BEDCA — candidata a v1.1 para los ~20 alimentos recurrentes, con IA como fallback), sodio/fibra como campos estructurados (v1.1), modelo predictivo de gasto por tipo de sesión.

## 6. Métricas de éxito

- Registrar un día completo típico (4 comidas conocidas) en <90 segundos.
- 0 datos perdidos en la migración desde el JSON del PoC.
- La predicción de déficit de Tendencia, comparada con la MED mensual del nutricionista, dentro de ±30% (validación agosto 2026).
- Coste IA mensual <5 € con uso diario.
