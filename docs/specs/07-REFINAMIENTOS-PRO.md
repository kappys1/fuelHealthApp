# 07 · Refinamientos profesionales (adenda funcional)

Lo que separa una app profesional de un PoC portado no son más features: es el comportamiento. Estos refinamientos son REQUISITOS de v1 salvo los marcados (v1.1). Cada uno indica la fase del plan 06 donde encaja.

## 1. La app nunca pregunta lo que puede saber (Fase 1)

- **Estado del día guiado**: bajo el FuelGauge, una línea de contexto según la hora (Europe/Madrid): mañana sin peso → «Falta el peso de hoy»; 15:30 sin comida → «Sin registro de la comida»; noche → «Cierra el día: ¿hinchazón y notas?». Un solo mensaje, el más relevante, tocable (lleva al campo). Nunca más de uno.
- **Autosave silencioso**: los campos del Día (peso, agua, notas, selects) guardan con debounce 600 ms; indicador sutil «Guardado ✓» que se desvanece. CERO botones de guardar fuera de formularios de creación/edición.

## 2. Instantánea o nada (Fases 1-2)

- **UI optimista**: toda mutación (añadir/editar/borrar entrada, favorito, campos de día) actualiza la UI al instante con TanStack Query y revierte con toast de error si el servidor falla. El gauge se mueve al soltar el dedo, no al volver la red.
- **Undo, no confirmaciones**: borrar una entrada NO pide confirmación; muestra toast «Eliminada · Deshacer» (6 s). Excepciones que sí confirman: borrar opción del plan, plantilla, MED, restore de import.
- **Carga**: skeletons con la forma real de cada tarjeta (nunca spinner a pantalla completa); el día actual llega renderizado del servidor (RSC) — abrir la app y ver tu gauge en <1 s percibido.

## 3. Añadir comida en segundos, siempre (Fase 2)

- **Añadido rápido universal**: un único input arriba de Hoy («Añadir comida…») que busca instantáneamente en local sobre favoritos + opciones del plan + últimas 50 entradas distintas; flecha/Enter añade a la comida que toca por hora. Si no hay match, el mismo texto se manda a F-IA-2 con un toque. Este input es el camino del 80% de los registros — las tarjetas de plan/foto/manual quedan para el 20%.
- **Steppers en gramos**: inputs numéricos con −/+ (paso = 10 g), `inputmode="decimal"`, selección total al enfocar. Editar 150→180 g son dos toques, no teclear.
- **Share Target (PWA)**: la app se registra como destino de compartir imágenes — desde la galería del iPhone, Compartir → Fuelboard → se abre el análisis de foto con la imagen cargada. Convierte el análisis en un gesto del sistema. (Fase 4; en iOS requiere PWA instalada, degradar sin romper si el navegador no lo soporta.)
- **Accesos directos del manifest**: «Añadir comida», «Peso de hoy» (long-press del icono).

## 4. Confianza operativa (Fases 3-4)

- **Salud con estado visible**: en Ajustes, «Última sincronización: hace 2 h · endpoint ✓» (o «hace 6 días ⚠ — revisa la Automation de HAE»). El usuario nunca debe dudar de si sus datos están entrando.
- **Degradación elegante de IA**: si el proveedor de IA falla o no hay red, TODA la app sigue funcionando; los botones IA se deshabilitan con motivo («Sin conexión» / «IA no disponible: {error}») y la entrada manual queda siempre a un toque. Reintento automático 1 vez con backoff en errores 5xx/timeouts.
- **Import con vista previa**: CSV y restore de JSON muestran resumen («31 días, 10 métricas, 3 días machacan valores manuales») ANTES de aplicar, con confirmar/cancelar.
- **Modo competición** (cuando fase = Competición): el gauge se simplifica (sin regañinas, sin «faltan»), y aparece una fila de chips de repostaje rápido — Plátano · Zumo 200 ml · Bebida deportiva 500 ml · Gel — de un toque, pensados para registrar entre WODs con las pulsaciones a 160.

## 5. La app te cuenta cosas, no solo las guarda (Fase 4 / v1.1)

- **Cierre semanal** (domingo, en Tendencia): tarjeta generada localmente (sin IA): adherencia de la semana, delta de ma7, mejor y peor día, racha de registro. Con botón opcional «Análisis del coach» (F-IA-6 con contexto semanal).
- **Insights de hinchazón** (v1.1): «3 de los 4 días con hinchazón ≥Moderada incluían sandía» — correlaciones simples por co-ocurrencia, presentadas como observación, nunca como diagnóstico.

## 6. Detalles que delatan (todas las fases — checklist de QA)

- Números siempre tabulares y enteros; los totales SIEMPRE cuadran con la suma visible (redondear al final, no por item).
- Pull-to-refresh en móvil; scroll restaurado al volver a una pestaña.
- Teclado correcto por campo (decimal/texto); el foco no salta al re-renderizar (bug clásico ya sufrido en el PoC con el input de gramos).
- Textos de error dicen qué pasó y qué hacer; vacíos que invitan a la acción (05-DISENO §5).
- Título del documento dinámico: «1.240 / 1.800 · Fuelboard» (se ve en el multitarea).
- Cero layout shift al cargar datos (reservar alto de tarjetas).
