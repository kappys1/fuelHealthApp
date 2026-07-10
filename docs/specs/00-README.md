# Fuelboard — Paquete de especificaciones v1.0

App personal de nutrición y rendimiento para Alex: recomposición corporal (perder grasa manteniendo/ganando músculo), rendimiento en CrossFit y control de hinchazón/retención, integrando dieta pautada por nutricionista (Regenera), entrenamiento (The Progrm), Apple Health/Watch, báscula Xiaomi y análisis con IA (Claude API).

Este paquete es el resultado de un PoC funcional construido y validado en Claude Artifacts durante semanas de uso real. **Todo lo especificado aquí existe ya en el PoC o fue una decisión razonada durante su desarrollo** — no es una lista de deseos, es un producto probado que hay que reconstruir bien.

## Documentos

| Doc | Contenido | Léelo antes de… |
|---|---|---|
| `01-PRD.md` | Visión, usuario, principios de producto, requisitos funcionales completos con criterios de aceptación | Todo lo demás |
| `02-ARQUITECTURA.md` | Stack (Next.js + Vercel + Postgres), PWA, estructura, seguridad, variables de entorno | Escribir código |
| `03-DATOS.md` | Esquema de base de datos, métricas derivadas (fórmulas exactas), ingesta Apple Health (endpoint + CSV), migración desde el JSON del PoC | Crear el schema |
| `04-IA.md` | Las 8 funcionalidades de IA con sus prompts exactos (probados), esquemas JSON, selección de modelos y costes, pipeline de imagen | Implementar cualquier feature de IA |
| `05-DISENO.md` | Sistema de diseño (tokens claro/oscuro, tipografía, componentes, pantallas, estados) | Escribir cualquier UI |
| `06-PLAN-IMPLEMENTACION.md` | Fases de construcción para Claude Code, tareas, tests de aceptación | Empezar |
| `07-REFINAMIENTOS-PRO.md` | Comportamientos que hacen la app profesional (optimista, undo, añadido rápido universal, share target, degradación IA) — requisitos de v1, mapeados a fases | Cada fase |
| `08-PROMPTS-CLAUDE-CODE.md` | Los prompts exactos a pegar en Claude Code, sesión a sesión, más prompts de mantenimiento | Cada sesión |
| `09-FLUJOS-UX.md` | **Arquitectura de interacción: navegación de 4 pestañas, sheet único de añadir, flujos por momento de uso. SUSTITUYE la organización de pantallas implícita en el PRD** | Cualquier UI |

## Cómo usar esto con Claude Code (Opus 4.8)

1. Crea el repo vacío y copia esta carpeta a `docs/specs/`.
2. Primera sesión: pide a Claude Code que lea `00` a `09` completos y genere `CLAUDE.md` en la raíz resumiendo stack, convenciones y principios (sección "Principios" del PRD íntegra).
3. Ejecuta fase a fase según `06-PLAN-IMPLEMENTACION.md`. No mezcles fases: cada una termina con sus tests de aceptación en verde.
4. Ante cualquier ambigüedad, la fuente de verdad es el PRD; si el PRD calla, decide lo más simple y anótalo en `docs/DECISIONS.md`.

## Supuestos tomados (modificables)

- **Usuario único** (Alex). Auth simple: password + sesión con cookie (iron-session o Auth.js credentials). Sin registro público.
- **IA agnóstica de proveedor** (Vercel AI SDK): por defecto Anthropic (`claude-sonnet-4-6` visión/análisis, `claude-haiku-4-5-20251001` texto), cambiable a otro proveedor por env vars sin tocar features (ver 02 y 04). Requisitos del modelo elegido: visión multimodal, JSON fiable, streaming.
- **Idioma**: UI y prompts en español.
- **Zona horaria**: Europe/Madrid para el concepto de "día".
- **Coste objetivo IA**: <5 €/mes con uso diario (el mix Haiku/Sonnet del doc 04 lo cumple con margen).

## Datos existentes

El PoC exporta un JSON (`fuelboard-export-YYYY-MM-DD.json`) con `{ targets, logs, med, favs, templates, plan, lastExport }`. La migración de ese archivo a la nueva BD es un requisito de la Fase 1 (ver 03-DATOS §6). **No se puede perder ni un registro.**
