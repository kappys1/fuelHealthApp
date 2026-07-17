# F09 · Estimar macros de una variante con IA
**Estado**: cerrada (2026-07-17 · DECISIONS #68/#69; AC1 validado por Alex 🖐 con «Leche sin lactosa» y «leche de almendras 0%») · **Tamaño**: quick-fix
**Fecha**: 2026-07-17 · **Origen**: idea Alex 17-jul (tras validar F08 Fase 2) — añadió a
mano las variantes "leche de almendras" y "Leche sin lactosa" a "Espresso + opciones" y la
2ª quedó a 0/0/0/0 porque no sabía sus macros. «Me faltaría un botón de IA para que me diese
eso si no lo sé».

## Motivación (caso real)
Añadir una variante a mano (F08 Fase 2) exige teclear kcal/P/C/F que a veces no sabes. Una
variante a **0/0/0/0 no es "incompleta", es veneno**: si la eliges al registrar mete 0 kcal
en el día → ensucia el dato que manda todo (principio 1). Hoy la única salida es buscar los
macros fuera y teclearlos (fricción justo en el momento de uso; principio 3).

## Alcance
- Botón **✨ por variante** en `VariantsEditor` (`src/components/plan/variants-editor.tsx`),
  en la fila del nombre, junto a la papelera.
- Al tocar: `api.estimatePlanOption(variante.nombre, baseG)` (**F-IA-3**, ya existe) →
  rellena kcal/P/C/F de ESA variante (strings, mismo formato que el resto del editor).
- Aparece en los **dos** consumidores (vista previa del import y `OptionForm` del editor del
  plan) automáticamente, por ser el editor compartido.
- Guardas: deshabilitado si la variante no tiene nombre (toast, igual que el botón «Estimar
  macros y grupo con IA» de las opciones sin variantes); spinner por-variante mientras
  estima; error de IA visible (toast con el mensaje del proveedor).

## NO-alcance
- No estima el **nombre** de la variante (lo escribes tú).
- No autocompleta el **grupo** desde la variante: el grupo es del hueco (la opción), no de
  cada variante → del retorno de F-IA-3 se usan SOLO los macros, se ignora `grupo`.
- No re-estima en bloque todas las variantes de golpe (una por una, deliberado).

## Momento de uso (09 §1)
Editar el plan / importar la dieta — momento "lo que me pautan", uso puntual. Vive donde ya
vive la edición de variantes (bottom-sheet del import y editor inline de Plan); no añade
pantalla ni tarjeta (09 §6).

## Datos
Ninguno nuevo. Se pasa `baseG` (string→number; "" → `null` = ración) del consumidor al
`VariantsEditor`. Sin schema, sin migración, sin cambios en export/restore ni migrate:poc.

## Flujo
En el editor de variantes: nombras la variante → tocas ✨ → se rellenan sus 4 macros a los
gramos pautados de la opción → revisas → Guardar (F08 sin cambios).

## IA
Reusa **F-IA-3** (`estimatePlanOption`) **sin tocar el prompt** (solo interpolación de
nombre + gramos). `temperature: 0` y cláusula anti-sesgo ya presentes (DECISIONS #36). NO
re-valida el test de consistencia café ×3 (el prompt no cambia). Coste: 1 llamada por clic,
uso puntual → despreciable.

## Impacto en Coach/Chat/Visita
Nulo. Las variantes ya viajan igual; los macros estimados solo alimentan `meal_entries` al
registrar, como cualquier otro valor tecleado.

## AC
1. 🖐 Variante con nombre pero sin macros → ✨ → rellena kcal/P/C/F plausibles a los gramos
   pautados (Alex valida con el pulgar sobre "Leche sin lactosa").
2. Variante sin nombre → no llama a la IA, avisa (toast).
3. Funciona idéntico en la vista previa del import y en el editor del plan (`OptionForm`).
4. `pnpm typecheck && pnpm test && pnpm build` en verde.

## Riesgos / decisiones discutibles
1. **Placement = ✨ junto a la papelera** (fila del nombre), no un botón de texto bajo los
   macros: no roba ancho a los steppers 4-col en móvil y reusa el patrón de icono que Alex
   ya conoce. (Acordado con Alex.)
2. **El `VariantsEditor` compartido llama a `api` directamente** (ya es "use client"): evita
   threadear un callback de estimación desde cada consumidor; solo necesita el prop `baseG`.
