# 09 · Flujos y arquitectura de interacción (SUSTITUYE la organización de pantallas del PRD)

El PRD define QUÉ hace la app (requisitos F1-F8: todos siguen vigentes). Este documento define CÓMO se organiza y se usa. Regla madre: **la app se diseña por momentos de uso, no por features**. Nadie quiere "la tarjeta de entrada manual"; quiere apuntar su comida en 15 segundos con una mano.

## 1. Momentos de uso reales (ordenar todo alrededor de esto)

| Momento | Frecuencia | Presupuesto de tiempo |
|---|---|---|
| Apuntar peso al levantarse | diario | 10 s |
| Registrar una comida | 3-5×/día | 15-30 s |
| «¿Cómo voy hoy / qué me queda?» | 1-2×/día | 10 s |
| Revisar tendencia / importar datos | semanal | 2-5 min |
| MED + preparar visita | mensual | 10 min |
| Cambiar dieta / competición | puntual | — |

## 2. Navegación: 4 pestañas + Ajustes

**Hoy · Plan · Progreso · Chat** (nav inferior) + icono de Ajustes en el header.

- **Progreso** fusiona Tendencia y MED como segmentos de una misma pantalla (`Tendencia | MED`), porque responden la misma pregunta («¿funciona?»). Preparar visita vive en el segmento MED. La tabla «Últimos días» vive al final de Tendencia.
- **Salud deja de ser pestaña**: import CSV, estado del endpoint («última sync hace 2 h ✓»), export/restore y tema son **Ajustes** — operaciones de mantenimiento, no destinos diarios.
- **Chat** es pestaña propia: es el destino conversacional de «pregúntale a tus datos».

## 3. Pantalla Hoy (rediseñada — task-first)

De arriba abajo, y NADA más:

1. **Header**: fecha navegable (‹ hoy ›) + racha de registro + Ajustes.
2. **FuelGauge** con sus 4 barras y la línea «Faltan…». En su esquina, icono ✨ que abre el **Coach en sheet** (ayer / hoy) — el coach ya no es tarjeta permanente.
3. **Línea de estado del día** (doc 07 §1): UNA acción contextual por hora («Falta el peso de hoy» → tap → sheet de peso). Desaparece cuando el día está al día.
4. **Timeline de comidas**: sección por comida (Almuerzo → Cena + Extra) con sus entradas y subtotal kcal; cada sección tiene su «+» que abre el sheet de añadir CON esa comida preseleccionada. Entradas: tap = editar en línea, ★, miniatura de foto, swipe/papelera = borrar con undo.
5. **Tarjeta «Mi día» colapsada**: una línea resumen («T3 · Fuerza + Gimnásticos · Normal · 92,1 kg») que expande a: peso, agua, % grasa, sesión (+ analizador de WOD pegado), fase, hinchazón, notas, línea «Del reloj». Colapsada por defecto una vez rellena.

Barra inferior de la pestaña Hoy: botón primario fijo **«+ Añadir comida»** (siempre alcanzable con el pulgar, además de los «+» por sección).

## 4. El sheet de añadir (el corazón de la app)

Un ÚNICO flujo de entrada en bottom-sheet por capas (nunca páginas nuevas):

**Capa 1 (se abre con teclado activo):**
- Selector de comida arriba (preseleccionada: por sección tocada, o por hora — <11 h almuerzo, 11-16 comida, 16-20 merienda, >20 cena).
- **Input de búsqueda universal** enfocado: busca en vivo (local, <50 ms) sobre favoritos + opciones del plan + últimas 50 entradas distintas. Resultado → tap añade (con gramos editables inline si tiene baseG).
- Fila de chips: 6 favoritos más usados.
- Tres accesos grandes: **📷 Foto** · **📋 Del plan** · **✍️ Describir (IA)**.

**Capas 2 (dentro del mismo sheet):**
- *Foto*: cámara/galería → aclaraciones → desglose editable → añadir junto/separado. (Todo F2.8 tal cual, pero dentro del sheet.)
- *Del plan*: la comida preseleccionada, grupos con opciones y gramos en vivo (F2.2).
- *Describir*: textarea; sirve para UNA comida o para el día entero — la IA ya asigna comida por item (F2.7 y F-IA-2/4 unificados en una sola puerta). Si el texto no tiene match local en la búsqueda de la capa 1, un toque lo manda aquí.

**Al añadir**: el sheet muestra el nuevo total del día 1,5 s («1.240 / 1.800 · +231») con «Añadir otra» — el gauge se ve actualizar detrás. Cerrar con swipe.

**Copiar ayer / plantillas**: menú «⋯» en el header del timeline (no ocupan pantalla; se usan 1×/día como mucho).

## 5. Introducir el día: check-ins guiados, no formularios

El contexto del día NO se rellena en un formulario: se captura en dos micro-rituales guiados de preguntas de una en una (sheet por pasos, botones grandes, avance automático), más defaults que ya saben la respuesta. La tarjeta «Mi día» colapsada queda solo como acceso de corrección posterior.

**Check-in matinal** (lo dispara la línea de estado por la mañana, o el shortcut «Peso de hoy»):
1. **Peso**: stepper grande precargado con el último peso (±0,1 con botones, o teclear). Un pulgar.
2. **¿Cómo amaneces?** → hinchazón en 4 botones grandes (Ninguna/Leve/Moderada/Alta).
3. **Sesión de hoy** → YA precargada por día de la semana (ver defaults) — solo confirmar o cambiar.
Listo en ≤15 segundos. Cada paso es saltable; guardar en cada paso (si lo abandona a medias, no pierde nada).

**Cierre del día** (línea de estado a partir de ~21:30, tras el entreno):
1. ¿Falta alguna comida? (si el timeline tiene huecos, atajo al sheet de añadir).
2. Notas del día (placeholder rotatorio: «¿Cómo fue el WOD? ¿Digestión? ¿Energía?») — **con dictado**: el usuario registra por voz habitualmente; textarea con el micro del teclado siempre viable, y el botón «Describir (IA)» acepta lenguaje hablado sin estructura.
3. Confirmación con el resumen del día («1.790 / 1.800 ✓ · 112 g prot ✓») y la racha. El ritual de cierre ES el generador de la racha.

**Defaults inteligentes (regla: la app nunca pregunta lo que puede saber):**
- **Sesión por día de la semana**: mapeo configurable en Ajustes (L→T1, M→T2, X→T3, J→T4, V→T5, S→T6, D→Descanso, editable — The Progrm es semanal). El check-in solo pide confirmar.
- **Peso**: precargado con el último; **agua**: chips +250 ml / +500 ml / botella (750), no un campo de litros; **comida del sheet**: por hora; **gramos**: baseG; **fase**: Normal salvo que ayer fuera Carga/Competición (entonces sugiere la siguiente lógica: Carga→Competición→Recuperación→Normal).
- Todo default es un valor propuesto visible y cambiable en un toque — nunca un valor oculto.

## 5b. Flujos exprés

- **Peso matinal**: estado del día → tap → sheet con SOLO el campo de peso (teclado decimal abierto) + hinchazón opcional → guardar. 10 s. (Shortcut del manifest «Peso de hoy» abre directamente este sheet.)
- **Foto desde galería**: Compartir → Fuelboard (share target) → sheet de foto ya cargado.
- **Competición** (fase = Competición): en Hoy aparece la fila de repostaje rápido (doc 07 §4) sobre el timeline; el gauge en modo informativo.
- **Cambio de dieta**: Plan → «Importar dieta (foto/PDF)» destacado arriba → vista previa → nueva versión.

## 6. Reglas de interacción globales

- Bottom-sheets para TODO flujo de creación/edición (shadcn Sheet/Drawer); páginas solo para las 4 pestañas.
- Máximo una decisión por pantalla del sheet; defaults inteligentes en todo (comida por hora, gramos = baseG, fecha = hoy).
- Optimista + undo + autosave (doc 07) aplican en cada flujo de este documento.
- Cualquier feature del PRD sin sitio explícito aquí: buscarle el momento de uso y proponer ubicación en `DECISIONS.md` — nunca añadir otra tarjeta permanente a Hoy.

## 7. Criterios de aceptación del rediseño

- Registrar una comida de favoritos: ≤3 toques desde abrir la app.
- Check-in matinal completo (peso + hinchazón + confirmar sesión): ≤15 s, un pulgar.
- Cerrar el día con notas dictadas: ≤30 s.
- Hoy con el día completo cabe en ~1,5 pantallas de iPhone (nada de scroll infinito de tarjetas).
- Un usuario nuevo entiende cómo añadir una comida sin explicación (el «+» es el único CTA primario visible).
- La app nunca pide un dato que puede proponer (sesión del día, comida por hora, peso anterior): siempre hay default visible.
