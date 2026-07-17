# Fuelboard · Pack de skills v2 (traspaso 2026-07-17)

Cuatro skills que codifican el criterio del proyecto para que sobreviva a cualquier cambio
de modelo. Cada una cubre un rol; juntas cubren el ciclo de vida completo.

## Instalación

Copiar cada carpeta a `.claude/skills/` del repo (la de `fuelboard-product-partner`
**reemplaza** a la existente — es la v2). Resultado:

```
.claude/skills/
  fuelboard-product-partner/SKILL.md   ← v2 (reemplaza)
  fuelboard-implementer/SKILL.md       ← nueva
  fuelboard-ai-tuner/SKILL.md          ← nueva
  fuelboard-analyst/SKILL.md           ← nueva
  react-doctor/                        ← se conserva tal cual
```

Después, añadir a `CLAUDE.md` (sección Convenciones) esta línea para que cualquier sesión
sepa que existen y cuál toca:

> **Skills del repo** (`.claude/skills/`): pensar/refinar ideas → `fuelboard-product-partner`
> · ejecutar specs aprobadas, fases y quick-fixes → `fuelboard-implementer` · conversaciones
> de la IA que fueron mal / afinar prompts-contexto-modelos → `fuelboard-ai-tuner` · leer
> MED/Tendencia y preparar visitas → `fuelboard-analyst`. Ante duda de cuál: el partner.

## Mapa de roles (quién hace qué)

| Momento | Skill | Entrada típica | Salida |
|---|---|---|---|
| "Quiero pensar en… / me molesta que…" | product-partner | idea/queja/caso real | mini-spec aprobada + prompt de traspaso |
| "Implementa la spec / Fase N / quick-fix" | implementer | spec aprobada | fases con AC ✅/🖐, cierre documental, informe de deploy |
| "Mira lo que me ha dicho el coach/chat" | ai-tuner | conversación literal | causa raíz archivo:línea, arreglo al nivel correcto, caso canónico |
| "MED nueva / ¿cómo voy? / visita" | analyst | datos/MED/tendencia | lectura con veredicto + preguntas para Regenera |

Fronteras: el partner no escribe código; el implementer no decide alcance; el tuner no hace
features nuevas de IA (las deriva al partner); el analyst no toca código.

## Qué hay nuevo en la v2 del product-partner

Las lecciones post-lanzamiento que la v1 no tenía, destiladas del historial real
(DECISIONS #47-65, features 01-09): la **jerarquía de arreglos dato>diseño>prompt>modelo**,
la **ley del péndulo de guardarraíles** (2 oscilaciones = reconstrucción por contrato, no
otro parche), **todo arreglo termina en caso canónico**, el **presupuesto de prompt**
(instrucción nueva declara con cuál interactúa), y el **criterio práctico > matemático**.
Además conserva la línea que añadió Alex ("crítico y con opinión, no un escriba") y las
referencias cruzadas a las otras tres skills.

## Deuda documental detectada en la auditoría (para una sesión de mantenimiento)

1. **`CLAUDE.md` dice "hoy `@ai-sdk/anthropic`" en la fila de IA** — el proveedor real es
   Google/Gemini. Corregir (es la clase de dato que confunde a una sesión nueva).
2. **`04-IA.md` (195 líneas) vs `prompts.ts` (328)**: la spec quedó por detrás de los
   prompts reales (contrato C1-C9 del chat, F-IA-10/11, sharedGuardrails). Decidir una
   dirección y escribirla en CLAUDE.md: o `prompts.ts` pasa a ser la fuente de verdad de la
   REDACCIÓN (y 04-IA guarda solo modelos/esquemas/costes/AC), o se re-sincroniza 04-IA
   entera. Recomendación: la primera — el archivo con tests y comentarios de decisión ya ES
   el documento vivo; mantener dos copias literales invita a divergencia.
3. **El doc 11 §Etapa 4** puede ahora delegar su protocolo en la skill implementer (una
   línea: "la sesión de implementación usa fuelboard-implementer") para no mantener el
   mismo texto en dos sitios.
