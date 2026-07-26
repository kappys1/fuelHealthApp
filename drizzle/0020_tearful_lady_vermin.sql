ALTER TABLE "meal_entries" ADD COLUMN "unit" "product_unit" DEFAULT 'g' NOT NULL;
--> statement-breakpoint
-- F19 enmienda: recuperar la unidad de entradas de catálogo con match inequívoco.
UPDATE "meal_entries" AS e
SET "unit" = p."unit"
FROM "products" AS p
WHERE e."source" = 'fav'
  AND lower(trim(e."name")) = lower(trim(p."name"))
  AND e."base_g" IS NOT DISTINCT FROM p."base_g";
--> statement-breakpoint
-- Las versiones duplican opciones; solo backfilleamos si todas las coincidencias
-- históricas del mismo nombre/base comparten unidad.
WITH matches AS (
  SELECT
    e."id",
    min(po."unit"::text)::product_unit AS "unit"
  FROM "meal_entries" AS e
  INNER JOIN "plan_options" AS po
    ON lower(trim(e."name")) = lower(trim(po."name"))
    AND e."base_g" IS NOT DISTINCT FROM po."base_g"
  WHERE e."source" = 'plan'
  GROUP BY e."id"
  HAVING count(DISTINCT po."unit") = 1
)
UPDATE "meal_entries" AS e
SET "unit" = matches."unit"
FROM matches
WHERE e."id" = matches."id";
