# 02 · Arquitectura

## 1. Stack

| Capa             | Elección                                                                                     | Notas                                                                                                                                                                                                                                                               |
| ---------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Framework        | **Next.js 16 (App Router, TypeScript estricto)**                                             | Turbopack es el bundler por defecto en dev y build; Node.js ≥20; React 19.2. Crear con `create-next-app@latest`. Caching explícito (Cache Components es opt-in): no asumir el caching implícito de Next 14/15                                                       | Server Components por defecto; Client Components solo donde hay interacción |
| Hosting          | **Vercel**                                                                                   |                                                                                                                                                                                                                                                                     |
| BD               | **Postgres gestionado (Neon o Supabase)**                                                    | Solo Postgres; nada de features propietarias de Supabase para no acoplarse                                                                                                                                                                                          |
| ORM              | **Drizzle**                                                                                  | Migraciones versionadas en repo (`drizzle-kit`)                                                                                                                                                                                                                     |
| Auth             | **Auth.js (credentials) o iron-session**                                                     | Usuario único; password hasheado (argon2) en env/BD; sesión por cookie httpOnly; middleware protege todo salvo `/login` y `/api/health/ingest` (token propio)                                                                                                       |
| IA               | **Vercel AI SDK (`ai`)** con adaptador de proveedor, SOLO en servidor                        | Capa agnóstica: hoy `@ai-sdk/anthropic`, mañana `@ai-sdk/openai`/`@ai-sdk/google` cambiando env vars, sin tocar features. API keys en env; nunca llegan al cliente. Requisitos del modelo elegido: visión multimodal, salida JSON fiable y (para el chat) streaming |
| Estado cliente   | **TanStack Query** + estado local                                                            | Nada de Redux; la BD es la fuente de verdad                                                                                                                                                                                                                         |
| Estilos          | **Tailwind CSS 4 + CSS variables** para tokens (05-DISENO)                                   |                                                                                                                                                                                                                                                                     |
| Componentes UI   | **shadcn/ui** (Radix) para primitivas: Dialog, Select, Popover, Tabs, Sonner (toasts), Sheet | Tematizado con NUESTROS tokens (05-DISENO §2); los componentes firma (FuelGauge, MealRow, PhotoAnalyzer) son custom                                                                                                                                                 |
| Almacén de fotos | **Vercel Blob**                                                                              | Foto de cada análisis guardada junto a la entrada (F2.11); acceso solo con sesión vía redirect firmado                                                                                                                                                              |
| Gráficos         | **Recharts**                                                                                 | Ya validado en el PoC                                                                                                                                                                                                                                               |
| PWA              | **Serwist** (sucesor de next-pwa)                                                            | Manifest + SW; cola offline con IndexedDB (`idb`)                                                                                                                                                                                                                   |
| Validación       | **Zod** en todos los boundaries (API routes, respuestas IA, ingest)                          |                                                                                                                                                                                                                                                                     |
| Fechas           | **date-fns + date-fns-tz**                                                                   | "Día" = `Europe/Madrid`. PROHIBIDO `new Date().toISOString().slice(0,10)` para claves de día                                                                                                                                                                        |
| Tests            | **Vitest** (unidad: fórmulas, parsers) + **Playwright** (flujos críticos)                    |                                                                                                                                                                                                                                                                     |

## 2. Estructura de proyecto

```
src/
  app/
    (auth)/login/
    (app)/            # layout con nav inferior (5 pestañas)
      hoy/            # registro diario (pantalla principal)
      plan/
      salud/
      med/
      tendencia/
    api/
      ai/             # 1 route por feature de IA (04-IA)
        photo/  estimate/  plan-option/  day-dump/  wod/  coach/  visit/
      health/ingest/  # POST Health Auto Export (token)
      export/  import/
  server/
    db/ (schema.ts, queries/)
    ai/ (client.ts, prompts.ts, schemas.ts)   # prompts EXACTOS de 04-IA
    analytics/ (ma7.ts, deficit.ts, adherence.ts, planDerived.ts)  # puras, testeadas
    ingest/ (hae-csv.ts, hae-json.ts)          # parsers puros, testeados
  components/ (ui/, fuel-gauge/, meal-log/, photo-analyzer/, charts/)
  lib/ (dates.ts, macros.ts)
```

## 3. Decisiones clave

1. **Toda llamada a la IA pasa por API routes propias.** El cliente envía payloads tipados; el servidor construye el prompt (plantillas en `server/ai/prompts.ts`), llama con `temperature: 0`, valida la respuesta con Zod (reintento 1 vez si el JSON no parsea) y devuelve tipado. Presupuesto de tokens y modelo por feature en 04-IA.
2. **Imágenes**: el cliente reduce a máx. 1024 px lado largo → JPEG 0.8 → base64 (FileReader + canvas, patrón del PoC). Si el navegador no decodifica (caso HEIC en desktop), fallback: enviar el archivo original al servidor y convertir con `sharp` (que sí lee HEIC) antes de llamar a la API. Límite subida 8 MB. En PWA iOS la cámara ya entrega JPEG. **La imagen reducida se sube a Vercel Blob al añadir la entrada** (no antes: si el usuario descarta el análisis, no se guarda nada) y su URL queda en `meal_entries.photo_url`; el acceso pasa por una route autenticada que redirige a URL firmada.
3. **Analítica en `server/analytics/` como funciones puras** con tests exhaustivos (fórmulas en 03-DATOS §3). Ni una fórmula en componentes.
4. **Parsers de ingesta como funciones puras** (`(texto|json) → HealthDay[]`) con fixtures reales de Health Auto Export en español (incluye kJ y mL) en los tests.
5. **Migraciones de datos SIEMPRE versionadas.** Lección del PoC: el plan guardado en formato v1 sin carb/fat rompió la UI de v2 hasta añadir migración al cargar.
6. **Errores IA siempre visibles** con el mensaje del proveedor + HTTP status (lección del PoC: los fallos silenciosos costaron días de diagnóstico).

## 4. Variables de entorno

```
DATABASE_URL=
AI_PROVIDER=anthropic        # anthropic | openai | google — decide el adaptador del AI SDK
AI_API_KEY=                  # key del proveedor elegido
AUTH_SECRET=
AUTH_PASSWORD_HASH=          # argon2 del password de Alex
HEALTH_INGEST_TOKEN=         # bearer para Health Auto Export
AI_MODEL_VISION=             # id de modelo multimodal del proveedor (p. ej. claude-sonnet-4-6)
AI_MODEL_TEXT=               # id de modelo barato para estimaciones de texto
AI_MODEL_COACH=              # id de modelo para coach/visita/chat
BLOB_READ_WRITE_TOKEN=       # Vercel Blob
```

## 5. Seguridad

- Middleware: sesión requerida en todo `(app)/*` y `api/*` salvo login e ingest.
- `/api/health/ingest`: `Authorization: Bearer HEALTH_INGEST_TOKEN`, rate-limit básico, payload máx. 1 MB, Zod estricto.
- Sin analytics de terceros. Los datos de salud no salen de Vercel/Neon + el proveedor de IA configurado (solo lo mínimo por request de IA).
- Cabeceras: CSP razonable, `X-Frame-Options: DENY`.

## 6. PWA

- `manifest.json`: name Fuelboard, display standalone, theme_color por tema, iconos 192/512 + maskable.
- SW (Serwist): precache del shell; runtime cache stale-while-revalidate para GET de datos; **cola offline** para POST de entradas de comida y datos de día (Background Sync o replay al reconectar); features IA con red obligatoria (botones deshabilitados offline con tooltip).
- iOS: probar instalación desde Safari; `viewport-fit=cover` y safe-areas (la nav inferior del PoC ya usa `env(safe-area-inset-bottom)` — mantener).
