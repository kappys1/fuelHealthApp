# 03 · Datos, métricas e ingesta

## 1. Esquema (Drizzle/Postgres — nombres orientativos)

```
diet_versions      id · effective_from (date) · kcal_target · prot_target ·
                   carb_target · fat_target · note
plan_options       id · diet_version_id · meal (almuerzo|comida|merienda|cena) ·
                   grp (Verdura|Hidratos|Proteína|Grasa|Otros|Opción única) ·
                   name · base_g (int, null) · kcal · prot · carb · fat · sort
days               date (PK, 'YYYY-MM-DD' Europe/Madrid) · weight · water_l ·
                   body_fat_pct · session_label · session_kcal (int, null) ·
                   phase (normal|carga|competicion|recuperacion) ·
                   bloat (null|ninguna|leve|moderada|alta) · notes
meal_entries       id · date (FK days) · meal (…|extra) · name · kcal · prot ·
                   carb · fat · source (plan|foto|manual|ia|fav|plantilla) ·
                   photo_url (null) · created_at
health_metrics     date (PK) · steps · active_kcal · basal_kcal · hrv_ms ·
                   sleep_h · resting_hr · vo2max · water_l · weight ·
                   body_fat_pct · source (endpoint|csv) · updated_at
workouts           id · date · type · duration_min · avg_hr · active_kcal
med_measurements   id · date · fat_kg · muscle_kg · weight_kg
favorites          id · meal · name · kcal · prot · carb · fat  (unique meal+name)
day_templates      id · name (unique) · items jsonb [{meal,name,kcal,prot,carb,fat}]
chat_threads       id · title · created_at · updated_at
chat_messages      id · thread_id · role (user|assistant) · content · created_at
settings           key · value jsonb   (lastExport, prefs de tema, etc.)
```

Reglas:
- `days` y `health_metrics` separados a propósito: lo manual vs lo importado. La **vista efectiva** de un día fusiona con precedencia `health_metrics` > `days` para métricas solapadas (peso, agua, % grasa) — principio 6 del PRD.
- Redondeo: kcal enteras; macros a entero en UI (guardar con 1 decimal está bien).
- `diet_versions`: al editar objetivos o plan se crea versión nueva con `effective_from = hoy`; consultas históricas usan la versión vigente en cada fecha.

## 2. Enumeraciones fijas

- Sesiones predefinidas: `T1 · Halterofilia + WOD`, `T2 · Carrera + Gimnásticos`, `T3 · Fuerza + Gimnásticos`, `T4 · Aeróbico / Descanso activo`, `T5 · Halterofilia + WOD`, `T6 · Mash largo`, `Competición`, `Descanso` (+ etiquetas libres del analizador de WOD).
- Fases: `Normal` (null en BD), `Carga pre-competición`, `Competición`, `Recuperación post-competición`.
- Hinchazón: `Ninguna`, `Leve`, `Moderada`, `Alta`.

## 3. Métricas derivadas (funciones puras — fórmulas EXACTAS del PoC)

**Totales del día**: suma de `meal_entries` por fecha (kcal, P, C, F).

**ma7(d)**: media de pesos disponibles en la ventana `[d−6, d]` (solo días con peso). **Nuevo vs PoC**: excluir de la serie los pesos de días con `phase != normal` y de los 2 días siguientes a una fase `competicion` (rebote de glucógeno).

**Déficit real** (requiere ≥8 pesajes repartidos en ≥7 días):
```
kgSemana  = (ma7(último) − ma7(primero)) / díasEntreEllos × 7
deficitDía = round(−kgSemana × 7700 / 7)        // 7.700 kcal ≈ 1 kg
ingestaMedia = media(kcal de días con registro y phase == normal)
TDEE = ingestaMedia + deficitDía
```

**Adherencia (últimos 14 días con registro)**:
```
n        = días con kcal registradas
normalN  = de esos, con phase == normal
enRango  = normalN con |kcal − objetivo| / objetivo ≤ 0.10
protOk   = normalN con prot ≥ 0.90 × objetivoProt
```

**Objetivos derivados del plan** (F1.4): para cada comida — Almuerzo: media de sus opciones; Merienda: suma de todas; Comida/Cena: agrupar por `grp` y sumar la media de cada grupo. Acumular también `kmin/kmax` (mín/máx kcal por grupo) para el rango del día pautado.

**Escalado por gramos**: `factor = gramos / base_g`; aplica a kcal y los 3 macros. Igual en el desglose de foto (base = estimación original inmutable `_base`).

## 4. Ingesta Apple Health (Health Auto Export)

### 4.1 Endpoint `POST /api/health/ingest`

Auth `Bearer HEALTH_INGEST_TOKEN`. Acepta el JSON de las Automations de HAE (`{ data: { metrics: [ { name, units, data: [{date, qty}] } ] } }` — validar contra fixture real la primera vez; el formato de HAE puede variar por versión, hacer el parser tolerante). Upsert en `health_metrics` por fecha; convertir unidades igual que el CSV. Workouts (si llegan) a `workouts`. Responder `{ imported: n }`.

### 4.2 Parser CSV (respaldo)

Export de HAE con agregación diaria, **cabeceras en español**. Detección por substring (case-insensitive) sobre la cabecera:

| Campo destino | Substrings a buscar | Unidad |
|---|---|---|
| date | `date`, `fecha` (col. "Fecha/Hora", valor `YYYY-MM-DD hh:mm:ss` → `slice(0,10)`) | |
| weight | `peso (`, `weight (`, `body mass` (¡`peso (` con paréntesis para no colisionar con "Longitud del **Paso** al Caminar"!) | kg |
| body_fat_pct | `grasa corporal`, `body fat` | % |
| active_kcal | `energía activa`, `energia activa`, `active energy` | **kJ → ÷4,184** si la cabecera contiene `(kj)` |
| basal_kcal | `energía en reposo`, `energia en reposo`, `resting energy`, `basal` | ídem kJ |
| steps | `conteo de pasos`, `step count`, `steps (` | |
| water_l | `agua (`, `water (` | **mL → ÷1000** si `(ml)` |
| hrv_ms | `variabilidad`, `variability` | ms |
| sleep_h | `dormido]`, `asleep]` (col. "Análisis del Sueño [Dormido] (hr)") | h |
| resting_hr | `cardiaca en reposo`, `resting heart` | bpm |
| vo2max | `vo2` | |

Números con coma decimal → punto. Filas sin fecha `YYYY-MM-DD` se ignoran. Mensaje de resultado: nº filas + nº métricas detectadas + aviso "kJ convertidos a kcal".

Datos de referencia de Alex (jun-jul 2026, para tests de cordura): activas ~830 kcal/d, basales ~2.054, pasos ~13.300, HRV media 67 (rango 23-112), FC reposo 47, VO2max 50, TDEE Apple ~2.884. **Ojo**: su báscula Xiaomi no sincronizaba peso con Salud — el peso suele venir vacío del CSV y entra manual.

## 5. Plan semilla (Regenera, 1.800 kcal / 110 g prot) — valores del PoC

Formato: nombre · grupo · baseG · kcal/P/C/F.

**Almuerzo** (elegir 1): Tortitas de arroz x4 · única · — · 150/3/33/1 — Pan bimbo 3 reb.+mermelada s/a 25 g · única · — · 230/7/45/2,5 — Plátano 1 ud · única · — · 100/1/24/0,3 — Fruta · única · 100 g · 50/0,5/12/0,2.

**Comida** (1 por grupo): Verdura vapor/plancha/ensalada · Verdura · 100 · 35/2/5/0,5 — Gazpacho · Verdura · 200 · 70/2/8/3 — Arroz/quinoa/legumbre hervido · Hidratos · 150 · 195/5/40/1 — Patata/boniato/yuca/plátano macho · Hidratos · 200 · 170/4/38/0,3 — Pan · Hidratos · 70 · 185/6/36/1,5 — Ñoquis · Hidratos · 100 · 130/4/27/0,5 — Carne magra (pollo/pavo/ternera, crudo) · Proteína · 210 · 231/46/0/5 — Pescado blanco/marisco (crudo) · Proteína · 210 · 180/40/0/2 — Pescado azul (crudo) · Proteína · 210 · 380/42/0/24 — Huevos 4 uds · Proteína · — · 280/25/2/20 — AOVE · Grasa · 10 · 90/0/0/10 — Espresso+leche almendras 200 ml · Otros · — · 30/1/2/2.

**Merienda** (conjunto): Pan · 60 · 160/5/31/1,2 — Crema de cacahuete · 20 · 120/5/4/10 — Mermelada s/a · 10 · 8/0/2/0.

**Cena** (1 por grupo; raciones menores): Verdura · 150 · 50/3/7/0,8 — Gazpacho · 200 · 70/2/8/3 — Arroz/quinoa/legumbre · 120 · 156/4/32/0,8 — Patata/boniato · 180 · 155/3,5/34/0,3 — Pan · 60 · 160/5/31/1,2 — Ñoquis · 90 · 117/3,5/24/0,5 — proteínas y AOVE y café: iguales que Comida (cerdo también vale en carne magra de cena).

Favoritos reales conocidos (pre-cargar si no vienen en el JSON): Sandía · 100 g · 30/0,6/7/0,2 — Manzana 1 ud · 95/0,5/25/0,3 — Pan bimbo 1 reb.+mermelada s/a · 85/2,5/16/1 — Café + leche almendras zero 300 ml · 18/0,6/1/1.

## 6. Migración desde el JSON del PoC

Entrada: `fuelboard-export-YYYY-MM-DD.json` = `{ targets, logs, med, favs, templates, plan?, lastExport? }`.

- `targets` → `diet_versions` (versión 1, `effective_from` = fecha del registro más antiguo).
- `plan` (si existe) → `plan_options` de esa versión; opciones sin `carb/fat` se rellenan por `id` desde el plan semilla (misma migración que hizo el PoC); las de usuario sin match, a 0 con flag para revisar.
- `logs` (objeto fecha→día): `meals[]` → `meal_entries`; `weight/water/bodyFat/session/sessionKcal/mode/bloat/notes` → `days` (mapear `mode` a `phase`); `steps/activeKcal/basalKcal/hrv/sleep/restingHR/vo2max` → `health_metrics` con `source='csv'`.
- `med[]` → `med_measurements`. `favs` → `favorites`. `templates` → `day_templates`.
- Script idempotente (`pnpm migrate:poc <archivo>`), con resumen: nº días, entradas, MEDs, favoritos, plantillas. *(AC: re-ejecutarlo no duplica nada.)*

Contexto MED histórico que Alex meterá a mano (fechas aproximadas, confirmará): ciclo volumen sept-2025→ene-2026 (89,7→94,5 kg; grasa 7,71→10,77; músculo 51,54→52,13) y definición may→jul-2026 (96,2→91,7 kg; grasa 11,06→8,99; músculo 53,13→51,79). La app debe soportar entrada retroactiva sin fricción.
