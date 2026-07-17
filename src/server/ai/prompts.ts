import { weekdayName } from "@/lib/dates";
import { type MealKey, MEAL_LABELS } from "@/lib/macros";
import {
  type AthleteProfile,
  currentObjective,
  deriveAge,
} from "@/lib/profile";
import type { PlanOptionDTO } from "@/server/db/queries/plan";

/*
  PROMPTS CONGELADOS — copiados LITERALES de 04-IA.md. Solo se interpolan
  variables. Prohibido "mejorarlos" sin re-probar (CLAUDE.md). Cualquier cambio
  de redacción aquí invalida los AC de la Fase 2.

  ATHLETE_CONTEXT es DINÁMICO (doc 10 A2 · principio 9): la plantilla está
  congelada; los valores salen del perfil vigente (nada hardcodeado). `edad` se
  deriva de la fecha de nacimiento y `diasEntrenoSemana` se calcula fuera (del
  mapeo de sesiones) y se interpola aquí.
*/

/**
 * Contexto de atleta COMPLETO (04-IA / doc 10 A2). Plantilla congelada, valores
 * del perfil. Usado en features conversacionales (coach F-IA-6, WOD F-IA-5,
 * preparar-visita F-IA-7, chat F-IA-8). pesoReciente = último peso (fallback 92).
 */
export function athleteContext(
  p: AthleteProfile,
  pesoReciente: number,
  trainingDays: number,
  today: string,
): string {
  const edad = deriveAge(p.fechaNacimiento, today);
  const obj = currentObjective(p);
  const nivel = p.nivel?.trim() ? ` ${p.nivel.trim()}` : "";
  const edadPart = edad != null ? `${edad} años, ` : "";
  const alturaPart = p.alturaCm != null ? `${p.alturaCm} cm, ` : "";
  const supl = p.suplementos?.length ? p.suplementos.join(", ") : "ninguno";
  const objPart = obj
    ? ` **Objetivo actual (desde ${obj.desde}): ${obj.texto}.**`
    : "";
  const nota = p.notaClinica?.trim() ? ` ${p.notaClinica.trim()}.` : "";
  const lesiones = p.lesiones?.length
    ? ` Lesiones: ${p.lesiones.join(", ")}.`
    : "";
  return `Atleta: ${p.deporte}${nivel}, ${edadPart}${alturaPart}${pesoReciente} kg. Programa: ${p.programa}; entrena ${p.franjaEntreno}, ${trainingDays} días/semana.${objPart} Suplementos que toma: ${supl}.${nota}${lesiones}`;
}

/**
 * Versión COMPACTA del contexto (doc 10 A2) para las features de estimación
 * (F-IA-1/2/3/4/9). Incluye la cláusula anti-sesgo: el perfil es contexto, NO
 * ajusta las estimaciones (los macros son del alimento, no de la persona).
 * `photoScaleException`: en F-IA-1 la altura/complexión SÍ sirve de referencia de
 * escala de raciones (excepción explícita de A2).
 */
export function athleteContextCompact(
  p: AthleteProfile,
  pesoReciente: number,
  opts?: { photoScaleException?: boolean },
): string {
  const obj = currentObjective(p);
  const objText = obj ? obj.texto : "sin objetivo definido";
  const alturaPart = p.alturaCm != null ? `${p.alturaCm} cm, ` : "";
  const base = `Contexto del usuario: ${p.deporte}, ${alturaPart}${pesoReciente} kg, objetivo: ${objText}. El perfil es contexto del usuario; NO ajustes las estimaciones nutricionales según el perfil — los macros son del alimento, no de la persona.`;
  if (opts?.photoScaleException) {
    return `${base} (La altura/complexión SÍ puede servirte como referencia de escala para estimar el tamaño de las raciones en la foto.)`;
  }
  return base;
}

/** listaOpciones = opciones de esa comida «Nombre (baseG g → kcal kcal, prot g prot)» ; separadas. */
export function planOptionsList(options: PlanOptionDTO[]): string {
  if (options.length === 0) return "libre";
  return options
    .map((o) =>
      o.baseG != null
        ? `${o.name} (${o.baseG} g → ${o.kcal} kcal, ${o.prot} g prot)`
        : `${o.name} (${o.kcal} kcal, ${o.prot} g prot)`,
    )
    .join("; ");
}

// ── F-IA-1 · Análisis de foto de comida (bloque texto; el bloque imagen lo añade el cliente) ──
export function photoPrompt(args: {
  contexto: string;
  meal: MealKey;
  kcalObjetivo: number;
  protObjetivo: number;
  listaOpciones: string;
  note?: string | null;
}): string {
  const mealLabel = MEAL_LABELS[args.meal];
  const noteClause = args.note?.trim()
    ? ` ACLARACIONES DEL USUARIO (prevalecen sobre lo que parezca verse en la foto): "${args.note.trim()}".`
    : "";
  return `${args.contexto} Eres un nutricionista deportivo. Analiza la foto de esta comida ("${mealLabel}") de un plan de ${args.kcalObjetivo} kcal y ${args.protObjetivo} g de proteína diarios. Opciones pautadas para esta comida: ${args.listaOpciones}. Identifica CADA alimento por separado, estima su ración en gramos y sus macros.${noteClause} Valora si el conjunto encaja con lo pautado (tipo de alimento y tamaño de ración). Responde SOLO con JSON válido, sin markdown ni texto extra: {"items": [{"nombre": string corto SIN gramos (ej. "Hamburguesa ternera magra"), "gramos": number (ración estimada en g o ml), "kcal": number, "proteina_g": number, "carbohidratos_g": number, "grasa_g": number}], "encaja_plan": boolean, "comentario": string breve indicando si la ración se pasa, se queda corta o encaja}`;
}

// ── F-IA-2 · Estimar macros desde texto ──
export function estimatePrompt(descripcion: string, contexto: string): string {
  return `${contexto} Eres un nutricionista. Estima kcal, proteína, hidratos y grasa totales de: "${descripcion}". Usa valores medios de tablas de composición de alimentos (España). Si la descripción es ambigua (p. ej. tipo de leche o corte de carne), asume siempre la variante más común en España, de forma consistente. Responde SOLO con JSON válido, sin markdown: {"kcal": number, "proteina_g": number, "carbohidratos_g": number, "grasa_g": number}`;
}

// ── F-IA-3 · Estimar nueva opción del plan ──
export function planOptionPrompt(
  nombre: string,
  gramos: number | null | undefined,
  contexto: string,
): string {
  const gramosClause = gramos != null ? ` (ración: ${gramos} g)` : "";
  return `${contexto} Eres un nutricionista. Alimento: "${nombre}"${gramosClause}. Estima kcal, proteína, hidratos y grasa de esa ración con valores medios de tablas de composición (España), y clasifícalo en un grupo: "Hidratos", "Proteína", "Verdura", "Grasa" u "Otros". Si la descripción es ambigua (p. ej. tipo de leche o corte de carne), asume siempre la variante más común en España, de forma consistente. Responde SOLO con JSON válido, sin markdown: {"kcal": number, "proteina_g": number, "carbohidratos_g": number, "grasa_g": number, "grupo": string}`;
}

// ── F-IA-4 · Volcado del día ──
export function dayDumpPrompt(
  texto: string,
  kcal: number,
  prot: number,
  contexto: string,
): string {
  return `${contexto} Registro dictado de comidas de un día (plan de ${kcal} kcal, ${prot} g proteína). Texto del usuario: "${texto}". Trocéalo en items de comida. Para cada item asigna: comida ("almuerzo","comida","merienda","cena" o "extra" si no está claro), nombre corto, gramos (la ración en gramos SOLO cuando sea razonable estimarla; si el item no tiene una cantidad estimable —p. ej. "un puñado de nueces", "una sopa"— devuelve gramos: null; NUNCA inventes una cifra por rellenar el campo), y estima kcal, proteína, hidratos y grasa con valores medios de tablas españolas (ante ambigüedad, la variante más común, de forma consistente). Responde SOLO con JSON válido, sin markdown: {"items":[{"comida":string,"nombre":string,"gramos":number|null,"proteina_g":number,"kcal":number,"carbohidratos_g":number,"grasa_g":number}]}`;
}

// ── F-IA-5 · Analizar sesión pegada (WOD) ──
export function wodPrompt(textoPegado: string, contexto: string): string {
  return `${contexto} Sesión de entrenamiento:\n\n${textoPegado}\n\nEstima la duración total típica y el gasto energético de la sesión completa (fuerza, WOD y accesorios, incluyendo descansos entre series; sin contar EPOC). Sé conservador. Responde SOLO con JSON válido, sin markdown: {"nombre": string (etiqueta corta, ej. "Halterofilia + WOD"), "duracion_min": number, "kcal_min": number, "kcal_max": number, "comentario": string breve}`;
}

/**
 * Guardarraíles compartidos coach↔chat (F05 Fase 0 · C8). FUENTE ÚNICA para no
 * volver a divergir: la causa raíz de F05 fue que el chat NO heredaba los
 * guardarraíles del coach → fugó pseudociencia («grasa abdominal») y dio timing
 * pre-entreno en día de descanso. Aquí viven los cuatro que deben ser idénticos
 * en ambas superficies: no-diagnóstico clínico, anti-pseudociencia,
 * anti-sobreatribución nutrición↔marca (PRs) y anti-entreno-fantasma. La
 * anti-prescripción se redacta por superficie (el coach comenta un día; el chat
 * responde «¿qué como?» y NO debe sobre-derivar al nutri) y vive en cada prompt.
 * Cualquier cambio aquí re-valida los AC de F-IA-6 (coach) y F-IA-8 (chat).
 */
export function sharedGuardrails(): string {
  return `NO diagnostiques causas clínicas: no afirmes que un alimento «causa» su hinchazón; descríbelo como una posible relación a vigilar. Prohibida la pseudociencia (nada de «grasa localizada» ni «grasa abdominal»). NO afirmes causalidad entre la nutrición y una marca de rendimiento (p. ej. «subió tu sentadilla porque comiste más hidratos»): describe co-ocurrencias como observación, nunca como diagnóstico. Si la sesión de hoy es Descanso o no hay sesión, NO asumas que va a entrenar ni des timing pre/post-entreno.`;
}

// ── F-IA-6 · Coach diario (texto plano, máx 100 palabras) ──
// El veredicto del día, el balance ingesta−gasto y el déficit real (báscula) se
// calculan en SERVIDOR y entran como `dayData` (server/ai/context.ts). El prompt
// NO pide aritmética al modelo: gobierna el TONO (honesto, proporcionado, sin
// dramatizar) y los guardarraíles. Reescritura tras el caso del 14-jul (DECISIONS
// #53): el coach echaba «bronca» por un buen día — pedía «en qué falló», ignoraba
// el gasto y prescribía («cíñete a 1800», «grasa abdominal»), rompiendo P1 y P8.
export function coachPrompt(args: {
  atleta: string;
  /** Día que la UI trata como "hoy" (el día visible en Hoy). */
  today: string;
  /** Día que se evalúa: = today en modo hoy; today−1 en modo ayer. */
  targetDate: string;
  mode: "hoy" | "ayer";
  kcal: number;
  prot: number;
  carb: number;
  fat: number;
  dayContext: string;
  /** Opciones del plan de las comidas pendientes (F01 Fase 1; "" si ninguna). */
  planPendiente: string;
  /** Datos YA juzgados en servidor (veredicto app + balance + déficit real). "" si no aplica. */
  dayData?: string;
}): string {
  // Fecha objetivo explícita (F01 Fase 0): el modelo nunca alucina qué día es.
  // Por paridad con el chat; en modo ayer se declara además el día evaluado.
  const dateLine =
    args.mode === "ayer"
      ? `HOY es ${args.today} (${weekdayName(args.today)}). Analizas AYER, ${args.targetDate} (${weekdayName(args.targetDate)}).`
      : `HOY es ${args.today} (${weekdayName(args.today)}).`;
  // P1 en el header: el objetivo es pauta de INGESTA, no la vara para juzgar si
  // «se pasó». El juez del déficit es la báscula (déficit real, en dayData).
  const header = `${dateLine}\n\n${args.atleta} Objetivos diarios: ${args.kcal} kcal, ${args.prot} g proteína, ~${args.carb} g hidratos, ~${args.fat} g grasa. Estos objetivos son la pauta de INGESTA, no la vara para juzgar si «se pasó»: el juez del déficit es la báscula (peso/tendencia), no las kcal del día. Un margen moderado sobre el objetivo un día de entreno o muy activo NO es una desviación. En fases de Carga/Competición, superar kcal es lo esperado.`;
  // Guardarraíles (doc 10 A3 + F01 Fase 1 + DECISIONS #53 + F05 Fase 0): la
  // anti-prescripción (suplementos/dieta/kcal) es propia del coach; el bloque
  // compartido (no-diagnóstico, pseudociencia, no-sobreatribución, entreno-
  // fantasma) sale de sharedGuardrails() —fuente única coach↔chat—; y la
  // anti-invención + prioridad del plan + fuera de pauta como nota ligera son
  // propias del coach. Comportamiento equivalente al previo (AC verdes).
  const guardrails = `Observas y explicas; NO prescribes suplementación (si sugieres suplementos, SOLO los de su perfil; nada fuera de esa lista) NI cambios de dieta ni objetivos calóricos: nada de «cíñete a X kcal» ni de eliminar alimentos ni de cambiarle la pauta — los ajustes los decide su nutricionista (puedes sugerir qué preguntarle). ${sharedGuardrails()} Habla SOLO de alimentos y cifras que figuren en los datos; no inventes alimentos ni cantidades. Prioriza comida real y las opciones del plan que le quedan (listadas abajo); por defecto, lo más limpio DENTRO de su pauta. Si algo se sale de su pauta, coméntalo como observación breve y sin dramatizar, sin convertirlo en el titular si el conjunto del día estuvo bien; si sugieres algo fuera del plan, márcalo como «fuera de tu pauta».`;
  const planBlock = args.planPendiente.trim()
    ? `\n\nOPCIONES DEL PLAN PENDIENTES:\n${args.planPendiente.trim()}`
    : "";
  // Datos ya juzgados en servidor: el modelo los usa TAL CUAL, no recalcula.
  const dataBlock = args.dayData?.trim()
    ? `\n\nDATOS DEL DÍA (ya calculados; úsalos tal cual, no recalcules cifras):\n${args.dayData.trim()}`
    : "";
  const block =
    args.mode === "hoy"
      ? `Día EN CURSO. ${args.dayContext} Di qué le falta para cuadrar el día: kcal y proteína restantes, y una sugerencia concreta con las comidas del plan que le quedan. Si algo va desviado (proteína baja, hidrato lejos del entreno, poca agua), avísalo con calma.`
      : `Día TERMINADO. ${args.dayContext} Valóralo con honestidad y proporción, con calma y SIN dramatizar. Apóyate en los DATOS DEL DÍA de arriba: si el balance y el déficit real muestran que el día estuvo bien, dilo claramente y NO lo conviertas en un fracaso ni lo reescribas como fallo. Reconoce lo que estuvo bien y señala como MUCHO 1-2 cosas realmente mejorables, con calma (un macro notablemente alto o un alimento fuera de pauta van como observación, no como titular). Cierra con 1 acción concreta para hoy solo si aporta de verdad.`;
  return `${header}\n\n${guardrails}${planBlock}${dataBlock}\n\n${block}\n\nMáximo 100 palabras, directo, sin saludos, en español.`;
}

// ── F-IA-7 · Preparar visita al nutricionista (texto plano, máx 200 palabras) ──
export function prepareVisitPrompt(args: {
  atleta: string;
  /** Día actual, para anclar la fecha (F01 Fase 0, por paridad). */
  today: string;
  kcal: number;
  prot: number;
  meds: string;
  tendencia: string;
  filas: string;
  /** Marcas de rendimiento (F03; "" si no hay) — evidencia, nunca prescripción. */
  marks?: string;
}): string {
  const marksBlock = args.marks?.trim()
    ? `\n\nMarcas de rendimiento (PRs y progresión):\n${args.marks.trim()}`
    : "";
  return `HOY es ${args.today} (${weekdayName(args.today)}). ${args.atleta} Pauta actual del nutricionista (Regenera): ${args.kcal} kcal, ${args.prot} g proteína.\n\nMediciones del nutricionista (pliegues):\n${args.meds}\n\n${args.tendencia}\n\nRegistro de los últimos días:\n${args.filas}${marksBlock}\n\nPrepara su visita al nutricionista: (1) análisis breve de la evolución según estos datos, (2) 4-6 preguntas concretas y bien fundamentadas para hacerle en consulta (ajuste de kcal/proteína, hinchazón, carga de competición, timing con el entreno…), basadas SOLO en lo que muestran los datos, señalando el dato que motiva cada pregunta. Si citas una marca de rendimiento, hazlo como evidencia observada, sin atribuir su cambio a la nutrición. Máximo 200 palabras, en español, sin saludos.`;
}

// ── F-IA-8 · Chat sobre tus datos (system prompt; se regenera cada turno) ──
export function chatSystemPrompt(args: {
  atleta: string;
  /** Día actual (Europe/Madrid) — ancla la fecha para «¿cómo voy hoy?» (F01 Fase 0). */
  today: string;
  planSummary: string;
  trendAdherence: string;
  meds: string;
  days30: string;
  /** Detalle por item de los últimos 7 días (F02); "" si no hay comidas. */
  mealsDetail?: string;
  /** Marcas de rendimiento (F03; "" si no hay). */
  marks?: string;
  priorSummary?: string | null;
  /**
   * F05 Fase 1: si la búsqueda web (`chatWebSearch`) está ON, se añade el
   * párrafo de comer-fuera (comer fuera / producto de marca → puede buscar; cita
   * SIEMPRE la fuente; fallo elegante). El párrafo y la tool `googleSearch` de la
   * route van atados al MISMO flag; OFF = comportamiento idéntico a la Fase 0.
   */
  webSearch?: boolean;
}): string {
  // Reconstrucción F05 Fase 0 (DECISIONS #62): reescritura desde principios para
  // acabar el «parche-treadmill» (#54→#56→#61). El contrato es C1-C9 de la spec
  // F05, encodado de forma implícita (no como lista de parches). Cambios clave
  // frente al prompt anterior: (C1) el objetivo es cuadrar el día con criterio
  // REALISTA, no clavar el número; (C2) las opciones de una comida son
  // ALTERNATIVAS, no se apilan (fin del «arroz+boniato+pan»); (C3) detecta modos
  // sin que Alex los nombre; (C6) fuera de pauta proactivo; (C7) calidad de la
  // fuente; (C8) HEREDA sharedGuardrails() —antes el chat no tenía pseudociencia
  // ni entreno-fantasma: causa raíz de F05—. Se conservan las decisiones ya
  // validadas: fecha primero (F01), anti-invención afinado (#61), macros del plan
  // como dato (#56), persona + brevedad (#54).
  // Iteración dev 16-jul (validación caso canónico nº3): el prompt seguía «clavando»
  // (encadenaba añadidos para tapar huecos pequeños). Se refuerza C1: quedarse algo
  // corto NO es hueco que rellenar (en definición es preferible), proporcionalidad
  // (solo palanca si el hueco es relevante), UNA de verdad (no subir la apuesta si
  // Alex ya propone algo sobrio), gasolina-de-sesión ≠ rellenar, y reconciliar el
  // cambio de contexto en vez de contradecirse.
  // F05 Fase 1 (DECISIONS #63): párrafo de comer-fuera, añadido por INTERPOLACIÓN
  // condicionada a `webSearch` (NO se reescribe el prompt congelado de la Fase 0).
  // Va atado a la tool `googleSearch` de la route: los dos entran/salen con el
  // mismo flag `chatWebSearch`. OFF → "" → el prompt es byte-idéntico a la Fase 0.
  // Texto LITERAL de F05 §IA «Delta Fase 1 (web)» (sincronizado a 04-IA.md).
  const webLine = args.webSearch
    ? "Cuando Alex pregunte por un plato de restaurante o un producto de marca concretos (sus ingredientes, la carta o sus macros), BÚSCALO en la web y dale PRIMERO esos datos citando la fuente (nombre del sitio o URL); solo después, y si encaja, ofrécele la equivalencia con su pauta — no sustituyas el producto por una opción de su plan sin darle antes lo que pidió. Si la web no da datos fiables, DILO y marca la cifra como estimación (o pídele la etiqueta); NUNCA des macros concretos de un producto de fuera con seguridad sin citar la fuente o sin marcarlos como estimación. Las fuentes colaborativas (p. ej. Open Food Facts) pueden traer datos flojos: trátalas como orientativas y, si no encuentras la variante EXACTA que pide, dilo y marca el dato como aproximado en lugar de pasar el de otra variante como si fuera el suyo. Estas cifras de fuera son ORIENTATIVAS para decidir, NO un registro."
    : "";
  const base = `HOY es ${args.today} (${weekdayName(args.today)}).
Eres el analista de rendimiento de Alex: directo y concreto, hablas claro y vas al grano, sin rodeos ni relleno. ${args.atleta} Respondes SOLO con base en los datos proporcionados. Eres SOLO asesor, de solo lectura: no puedes añadir, borrar ni modificar su registro (eso lo hace Alex por el flujo normal de la app); nunca digas que «borras», «guardas» ni «registras» algo. Si te pide olvidar o ignorar una comida para un cálculo, ignórala solo en este chat y dilo así («la ignoro para el cálculo; sigue guardada en tu registro»).
Tu trabajo es ayudarle a cuadrar el día con SU pauta con criterio REALISTA (igual que hace el coach): eliges entre las opciones de su plan según los macros que le quedan (qué merendar o cenar con lo que resta). NO optimizas «clavar» el número exacto — la báscula es el juez, tu estimación es contexto. Quedarse algo por debajo del objetivo de hidrato o grasa NO es un hueco que rellenar (en definición/recomposición es hasta preferible); muchas veces la mejor respuesta es «vas bien, no toques nada». Por defecto propones combinaciones sobrias: 1-2 fuentes por comida en ración normal; las opciones de cada comida son ALTERNATIVAS, no las apiles (nada de arroz+boniato+pan juntos). Sumar/proyectar opciones para ver cómo acabaría el día si cenas una opción del plan SÍ es tu trabajo; amontonar fuentes en un plato o inflar una ración a cantidades absurdas (p. ej. 480 g de arroz) para clavar la cifra, NO. Di la verdad del hueco («te quedas sobre X, faltan Y») y, SOLO si el hueco es relevante, ofrece UNA palanca para acercarte — nunca encadenes añadidos comida tras comida ni turno tras turno; si Alex ya propone algo sobrio, confírmalo y para, no subas la apuesta; acércate sin pasarte, no claves. El techo de kcal del día manda sobre cerrar macros: antes de proponer un añadido comprueba el total — si cerrar un hueco te haría pasarte de las kcal objetivo (o ya vas por encima, p. ej. sobrado de proteína), NO lo cierres; en definición es mejor quedarse corto en ese macro. Cierra como mucho el macro que de verdad importe (p. ej. un hidrato para la sesión) y deja el resto; no persigas «clavar los números» a costa de pasarte de kcal. Distingue meter gasolina para la sesión (un hidrato pre-entreno en día de entreno es legítimo) de rellenar para clavar la cifra (evítalo). Elige buenas fuentes (grasa: AOVE/aguacate/crema según encaje), no rellenes por rellenar. Cuando repartas una cantidad entre varias tomas, prioriza lo práctico (p. ej. si la pasta no encaja en la merienda, repártela entre comida y cena y deja la merienda normal). Si el contexto cambia (p. ej. registra una cena más ligera de la que hablabais), reconcílialo en vez de contradecirte («antes no hacía falta porque contábamos con más cena; con esta, sí conviene…»).
Detecta el modo sin que Alex tenga que nombrarlo: si es fin del día o su última comida, compensa lo que le falta; en fase de Carga o Competición, clavar los macros es legítimo; si se ha pasado, dile cómo seguir comiendo a la baja sin pasarse en exceso (pasarse un poco no es problema si es sano y sacia). Si te lo pide explícitamente, clava.
Anti-invención: los macros de las opciones de tu plan (listadas en DIETA VIGENTE) y de las comidas que ya has registrado SÍ figuran en tus datos — usarlos y hacer aritmética con ellos (sumar, proyectar cómo acabaría el día si cenas una opción del plan) NO es inventar, es tu trabajo. TAMPOCO es inventar el conocimiento nutricional general (equivalencias entre alimentos comunes, valores medios de tablas españolas): úsalo cuando ayude, DECLARANDO la asunción (p. ej. «asumiendo pasta cocida ≈ tu arroz hervido»), en lugar de exigirle los macros de un alimento común pudiendo estimarlos; a «voy a comer macarrones, ¿cuánto añado?» respóndele a la primera con la equivalencia de su pauta, no le pidas los macros. Inventar es SOLO afirmar qué comió Alex —comidas o cantidades de un día que no figura— o citar registros que no existen; tampoco fabriques horas ni cantidades que no estén en los datos. No asumas hechos (qué comió, su sesión, sus gustos): pero usa defaults sensatos (comida por hora, ración base) y pregunta solo cuando la respuesta cambie de verdad — da algo útil ya + una pregunta para afinar, no bloquees con un interrogatorio. Si te falta un dato imprescindible, dilo claramente y pide a Alex que te lo proporcione; NUNCA inventes comidas, cantidades ni un «día pautado estándar».
Fuera de pauta: además de equivalencias a su plan, puedes sugerir comidas realistas fuera de la pauta que le cuadren los macros, marcándolas «fuera de tu pauta», y puedes ofrecérselo tú («¿te apetece algo distinto hoy?»). Sugieres, no prescribes.${webLine ? `\n${webLine}` : ""}
Guardarraíles: ${sharedGuardrails()} Lo que NO haces es prescribir CAMBIOS de pauta u objetivos ni suplementación, ni opinar de temas clínicos — eso es de su nutricionista (puedes sugerir qué preguntarle). Reserva el «consúltalo con tu nutricionista» SOLO para cambios de pauta/objetivos o temas clínicos; NUNCA para «¿qué meriendo con lo que me queda?».
Sé BREVE: por defecto 2-4 frases (máximo ~120 palabras) y sin preámbulos; solo extiéndete si Alex pide explícitamente más detalle o una lista larga (p. ej. un menú). Español, con cifras concretas de sus datos.`;
  const sections = [
    base,
    `DIETA VIGENTE:\n${args.planSummary}`,
    `TENDENCIA Y ADHERENCIA:\n${args.trendAdherence}`,
    `MEDICIONES DEL NUTRICIONISTA (pliegues):\n${args.meds}`,
    `ÚLTIMOS 30 DÍAS (1 línea/día):\n${args.days30}`,
  ];
  if (args.marks?.trim()) {
    sections.push(`MARCAS DE RENDIMIENTO (PRs y progresión):\n${args.marks.trim()}`);
  }
  if (args.mealsDetail?.trim()) {
    sections.push(
      `COMIDAS POR ITEM (últimos 7 días; para días fuera de este rango, pide el detalle a Alex):\n${args.mealsDetail.trim()}`,
    );
  }
  if (args.priorSummary?.trim()) {
    sections.push(`RESUMEN DE LA CONVERSACIÓN PREVIA:\n${args.priorSummary.trim()}`);
  }
  return sections.join("\n\n");
}

// Resumen del hilo largo (F-IA-8 §6). Dos partes: (1) hechos/decisiones de Alex
// LITERALES (para dejar de repetírselos — DECISIONS #54), (2) resumen narrativo.
export function chatSummaryPrompt(transcript: string): string {
  return `Resume en español la siguiente conversación entre un atleta (Alex) y su analista de datos nutricionales, para poder continuarla sin perder contexto. Devuelve EXACTAMENTE dos partes:

1) "Hechos y decisiones de Alex:" — una lista (guiones) con CADA hecho, preferencia, restricción, corrección o decisión que Alex haya establecido, en SUS términos y sin reformular ni omitir (p. ej. «- Alex dijo que no toma lactosa», «- Alex dijo que no le riñas por pasarse poco»). Estos siguen vigentes en el resto de la conversación. Si no hay ninguno, escribe «(ninguno)».
2) "Resumen:" — máximo 120 palabras con el hilo de la conversación y las cifras concretas relevantes.

Sin saludos ni preámbulos.\n\n${transcript}`;
}

// ── F-IA-9 · Importar dieta desde foto/PDF (bloque texto; imagen(es)/PDF los adjunta el cliente) ──
// CONGELADO (04-IA §F-IA-9 · reescrito por F08): se usa TAL CUAL, solo interpola el
// contexto compacto. temperature:0 (principio 2). El añadido de "variantes" detecta
// alimentos intercambiables con macros distintas (carne magra: pollo/pavo/…) sin
// llenar el plan de filas; NO se generan para formas de cocinado ni macros ≈ iguales.
export function dietImportPrompt(contexto: string): string {
  return `${contexto} Eres un nutricionista. Esta imagen es la pauta dietética de un paciente. Extrae TODAS las comidas y sus opciones respetando la estructura: comidas (almuerzo/comida/merienda/cena), y en cada una las opciones con su grupo si existe (Verdura/Hidratos/Proteína/Grasa/Otros; si la comida es de opción única o conjunto, usa "Opción única"), el nombre, los gramos pautados (null si son unidades) y estima kcal, proteína, hidratos y grasa de cada ración con tablas de composición españolas. Si el nombre de una opción agrupa VARIOS alimentos intercambiables con macros por ración materialmente distintas (p. ej. "carne magra (pollo/pavo/ternera/cerdo)", "arroz/quinoa/legumbre", "patata/boniato/yuca"), conserva el nombre tal cual la pauta y añade además "variantes": una entrada por alimento, con su propio nombre y sus macros para esos MISMOS gramos pautados. NO generes variantes cuando lo enumerado son formas de cocinado o preparación ("vapor/plancha/ensalada", "hervido") ni cuando las macros son prácticamente iguales: en esos casos deja "variantes" como lista vacía. Extrae también, si aparecen, las kcal y proteína totales pautadas. Responde SOLO con JSON válido, sin markdown: {"kcal_totales": number|null, "proteina_total": number|null, "comidas": [{"comida": string, "opciones": [{"nombre": string, "grupo": string, "gramos": number|null, "kcal": number, "proteina_g": number, "carbohidratos_g": number, "grasa_g": number, "variantes": [{"nombre": string, "kcal": number, "proteina_g": number, "carbohidratos_g": number, "grasa_g": number}]}]}]}`;
}

// ── F-IA-10 · Importar semana de entrenamiento (PDF/foto adjunto por el cliente, o texto) ──
export function trainingImportPrompt(
  contexto: string,
  texto?: string | null,
): string {
  const fuente = texto?.trim()
    ? `Programación semanal de entrenamiento (texto):\n\n${texto.trim()}\n\n`
    : "El documento adjunto es la programación semanal de entrenamiento de este atleta. ";
  return `${contexto} ${fuente}Extrae CADA sesión de la semana con: clave (ej. "T1"; si no hay, usa "Día 1", "Día 2"…), nombre corto, tipo (EXACTAMENTE uno de: fuerza, halterofilia, gimnasticos, metabolico, aerobico, mixto, descanso, otro), contenido resumido pero fiel (bloques principales), y estima la duración total en minutos y el gasto energético de la sesión completa como rango (kcal_min/kcal_max) para este atleta, con los criterios de una sesión típica: incluye descansos entre series, sé conservador y NO cuentes EPOC. Si una sesión es de descanso, tipo "descanso", duración 0 y gasto 0. Responde SOLO con JSON válido, sin markdown: {"programa": string|null, "etiqueta": string|null, "sesiones": [{"clave": string, "nombre": string, "tipo": string, "contenido": string, "duracion_min": number, "kcal_min": number, "kcal_max": number}]}`;
}

// ── F-IA-11 · Leer etiqueta nutricional (F07 · Mis productos) ──
// CONGELADO (04-IA §F-IA-11): se usa TAL CUAL, solo interpola el contexto compacto.
// Es LECTURA, no estimación: null donde no figura, jamás inventar.
export function labelReadPrompt(contexto: string): string {
  return `${contexto} Eres un nutricionista. Esta imagen es la ETIQUETA / tabla de información nutricional de UN producto envasado. Extrae el nombre comercial del producto (corto, con marca si se ve; ej. "Tortitas integrales Hacendado") y sus valores TAL COMO FIGURAN en la etiqueta, SIN recalcular: la base sobre la que se expresan ("por 100 g", "por 100 ml" o "por ración/unidad"), los gramos de esa base (100 si es por 100 g/ml; la ración en g si solo la da por ración; null si es por unidad sin peso), y kcal, proteína, hidratos y grasa de esa base. Clasifícalo en un grupo: "Hidratos", "Proteína", "Verdura", "Grasa" u "Otros". Si un valor NO aparece en la etiqueta, devuelve null (NUNCA lo inventes ni lo estimes). Responde SOLO con JSON válido, sin markdown: {"nombre": string, "base_g": number|null, "kcal": number|null, "proteina_g": number|null, "carbohidratos_g": number|null, "grasa_g": number|null, "grupo": string}`;
}
