INSERT INTO "settings" ("key", "value")
SELECT
  'trainingByWeekday',
  jsonb_build_object(
    '1', CASE WHEN lower(trim(coalesce(legacy.value->>'1', 'T1'))) IN ('', 'descanso') THEN 'descanso' ELSE 'tarde' END,
    '2', CASE WHEN lower(trim(coalesce(legacy.value->>'2', 'T2'))) IN ('', 'descanso') THEN 'descanso' ELSE 'tarde' END,
    '3', CASE WHEN lower(trim(coalesce(legacy.value->>'3', 'T3'))) IN ('', 'descanso') THEN 'descanso' ELSE 'tarde' END,
    '4', CASE WHEN lower(trim(coalesce(legacy.value->>'4', 'T4'))) IN ('', 'descanso') THEN 'descanso' ELSE 'tarde' END,
    '5', CASE WHEN lower(trim(coalesce(legacy.value->>'5', 'T5'))) IN ('', 'descanso') THEN 'descanso' ELSE 'tarde' END,
    '6', CASE WHEN lower(trim(coalesce(legacy.value->>'6', 'T6'))) IN ('', 'descanso') THEN 'descanso' ELSE 'tarde' END,
    '7', CASE WHEN lower(trim(coalesce(legacy.value->>'7', 'Descanso'))) IN ('', 'descanso') THEN 'descanso' ELSE 'tarde' END
  )
FROM (SELECT (SELECT "value" FROM "settings" WHERE "key" = 'sessionByWeekday') AS value) legacy
ON CONFLICT ("key") DO NOTHING;
--> statement-breakpoint
INSERT INTO "settings" ("key", "value")
VALUES ('trainingByWeekdayReviewed', 'false'::jsonb)
ON CONFLICT ("key") DO NOTHING;
--> statement-breakpoint
UPDATE "settings"
SET "value" = "value" - 'franjaEntreno'
WHERE "key" = 'athleteProfile'
  AND jsonb_typeof("value") = 'object';
--> statement-breakpoint
DELETE FROM "settings" WHERE "key" = 'sessionByWeekday';
