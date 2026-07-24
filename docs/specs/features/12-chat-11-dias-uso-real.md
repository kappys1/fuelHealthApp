# F12 · Chat afinado con 11 días de uso real
**Estado**: implementada y validada (v1.14, 2026-07-25) · fases 1-4 con suite verde
(typecheck + 297 tests + build); **AC1/AC3/AC5 validados por Alex en móvil (25-jul)** ·
**Tamaño**: feature
**Fecha**: 2026-07-24 · **Origen**: export real de 39 hilos / 227 mensajes
(`exports/chat-conversations-2026-07-24.json`, 13–24 jul)

## Motivación (casos reales)
- **Producto de marca, 16-jul**: «Dame los macros del gazpacho del Lidl» recibió
  cifras de una variante de Open Food Facts como si fueran exactas; la etiqueta
  del brik decía 37 kcal · 0,6P/3C/2F por 100 ml.
- **Integridad del registro, 16-jul**: «olvida la cena que tengo registrada» recibió
  «Borro la cena que tenías registrada», aunque el chat no podía hacerlo.
- **Outlier del reloj, 22-jul**: HRV 194 frente a una base personal 50–80 se
  interpretó como «recuperación extrema» en vez de probable artefacto.
- **Doble envío, 21-jul**: «Como verías si cierro el día así?» se persistió dos
  veces, con `turnId` distintos y 19,2 s de separación; el primer turno quedó sin
  respuesta.
- Los títulos actuales son las primeras palabras del mensaje y los accesos rápidos
  no reflejan los cinco intents que dominan el export.

## Alcance
1. Afinar F-IA-8: producto comercial → consultar primero `Mis productos`; si no
   existe y se responde de memoria/conocimiento general, declararlo estimado y
   pedir etiqueta. Mantener la búsqueda web como segunda fuente, con su cita.
2. Mantener el chat en modo hipotético para el registro: «la ignoro para el
   cálculo; sigue guardada», nunca reclamar una mutación.
3. Tratar un dato del reloj muy fuera de la línea base personal como probable
   artefacto antes de extraer una interpretación fisiológica.
4. Tras una corrección explícita con etiqueta, ofrecer exactamente «¿Te lo guardo
   en Mis productos?». En el turno inmediatamente posterior, una confirmación
   explícita habilita la única acción de escritura del chat: crear o actualizar
   ese producto con `source:'etiqueta'`. Sin confirmación, no hay mutación.
5. Sustituir sugerencias por cinco intents reales: «Cómo voy hoy», «Cierra mi día»,
   «Reparte lo que me falta», «Qué meriendo/ceno para llegar» y «Macros de un
   producto».
6. Generar una sola vez el título del hilo con Flash-Lite: resumen de 4–6 palabras;
   fallback determinista si falla. Añadir backfill explícito y reversible para los
   hilos existentes.
7. Mantener fecha relativa en la lista y añadir «Continuar última conversación»
   como acceso primario cuando exista historial.
8. Deduplicar en servidor un segundo envío con ID nuevo cuando sea idéntico al
   último turno del mismo hilo y ese turno siga sin respuesta.

## NO-alcance
- Ninguna escritura de comidas, días, sesiones, notas, objetivos o pauta desde el
  chat. La única excepción es `products`, tras confirmación explícita.
- No foto-en-chat (F05 Fase 2), no base externa nueva y no cambios de modelo del
  chat.
- No reescritura retroactiva de entradas del día al guardar/actualizar un producto.
- No borrado automático de los dos mensajes históricos duplicados.

## Momento de uso
Pestaña Chat: consulta diaria («cómo voy / qué me falta / cómo cierro») y consulta
puntual de un producto comercial. El guardado aparece solo después de que Alex
aporte la etiqueta; no añade una pantalla ni una tarjeta a Hoy.

## Datos
- Sin schema ni migración nuevos. El catálogo `products` existente es contexto de
  lectura y destino de la escritura confirmada.
- El producto confirmado guarda nombre, base, unidad y macros; origen `etiqueta`,
  `pinned:false`. Si el nombre exacto ya existe, se actualiza; no toca entradas
  pasadas.
- Título: se actualiza `chat_threads.title`; script de backfill con `--dry` por
  defecto operativo documentado.
- Export/restore/migrate:poc ya transportan ambos objetos; no cambian.

## Flujo
1. Alex pregunta por una marca → el chat mira `Mis productos`; si está, usa ese
   dato. Si no, web citada o estimación/declaración de memoria + petición de etiqueta.
2. Alex corrige con la etiqueta → el chat repite producto/base/macros y pregunta
   «¿Te lo guardo en Mis productos?».
3. Solo si el siguiente mensaje confirma de forma explícita se expone la tool y se
   crea/actualiza; el chat confirma el resultado. Cualquier otro turno vuelve a
   solo lectura.
4. Al abrir Chat con historial, el CTA principal continúa el hilo más reciente;
   debajo quedan los cinco intents y la lista completa.

## IA
- F-IA-8 conserva `AI_MODEL_CHAT`, temperatura 0,3, web y streaming.
- Títulos: nueva `AI_MODEL_TITLE=gemini-3.5-flash-lite`, temperatura 0,
  `thinkingLevel:"low"`, una llamada por hilo, salida de texto saneada a 4–6 palabras.
- Acción local determinista `saveProductFromConfirmedLabel`: el servidor extrae la
  ficha exacta que el asistente mostró y solo la ejecuta si el turno inmediatamente
  posterior confirma. Se mantiene el stream de texto actual; el modelo no puede
  auto-concederse la confirmación ni cambiar los números después del «sí».
- Coste incremental: títulos, ~3–4 llamadas Flash-Lite/día al ritmo del export;
  productos, solo cuando Alex confirma. Marginal, muy por debajo de 5 €/mes.

## Impacto en Coach/Chat/Visita
- Chat: contexto de `Mis productos`, prompt y tool confirmada.
- Coach: hereda el guardarraíl compartido de outliers del reloj; el resto no cambia.
- Visita: sin cambios.

## AC
1. Caso Lidl 16-jul: antes de dar macros consulta `Mis productos`; si no existe,
   no presenta memoria/otra variante como etiqueta exacta y pide la etiqueta. 🖐
2. Caso cena 16-jul: responde en modo hipotético («ignorándola para el cálculo…»);
   nunca «borro tu cena».
3. Caso HRV 22-jul: 194 vs base 50–80 se trata primero como probable artefacto;
   nunca como «recuperación extrema». 🖐
4. Corrección de etiqueta → ofrece guardar; sin «sí/guárdalo» inmediatamente
   después, no hay escritura.
5. Confirmación explícita → crea/actualiza el producto exacto como `etiqueta`,
   sin tocar ninguna otra tabla ni entradas pasadas. 🖐
6. Los cinco intents reales aparecen tanto al abrir la pestaña como en hilo vacío.
7. Hilo nuevo recibe título IA de 4–6 palabras con Flash-Lite; fallo deja fallback.
   El backfill ofrece dry-run y no escribe por defecto.
8. Lista muestra fecha relativa y CTA primario «Continuar última conversación».
9. Repro del 21-jul: dos requests de texto idéntico, mismo hilo, IDs distintos y
   primera respuesta pendiente → una sola fila user/una sola generación. Repetir la
   pregunta después de una respuesta completa sigue permitido.
10. Todos los casos anteriores y los canónicos opuestos quedan en regresión;
    `pnpm typecheck && pnpm test && pnpm build` verdes.

## Riesgos / decisiones discutibles
1. **Confirmación conversacional, no modal**: el servidor exige turno inmediatamente
   posterior + afirmación explícita y solo entonces expone la tool. Menos fricción,
   misma garantía de consentimiento.
2. **Deduplicación semántica mínima**: solo texto idéntico + último turno pendiente;
   no bloquea repetir una pregunta ya contestada.
3. **Título en cierre del primer turno**: se intenta tras persistir la respuesta; si
   Flash-Lite falla, el chat no falla y conserva el recorte determinista.

## Fases
1. Prompt, contexto de productos y batería canónica.
2. Tool de producto con confirmación determinista.
3. Títulos, intents, continuidad y fecha relativa.
4. Doble envío: repro → hipótesis → fix → regresión.
