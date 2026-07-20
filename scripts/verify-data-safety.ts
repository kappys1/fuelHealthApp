import { createHash, randomUUID } from "node:crypto";
import { config } from "dotenv";
import { eq, inArray } from "drizzle-orm";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function canonical(data: Record<string, unknown[]>): string {
  const normalized = Object.entries(data)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([table, rows]) => [
      table,
      rows
        .map((row) => JSON.stringify(row))
        .sort((left, right) => left.localeCompare(right)),
    ]);
  return JSON.stringify(normalized);
}

async function main() {
  config({ path: ".env.local" });
  assert(
    process.env.VERIFY_ISOLATED_DB === "1",
    "Bloqueado: define VERIFY_ISOLATED_DB=1 solo para una rama Neon aislada.",
  );
  assert(process.env.DATABASE_URL, "DATABASE_URL no está configurada.");
  const databaseUrl = new URL(process.env.DATABASE_URL);
  assert(
    databaseUrl.hostname.endsWith(".neon.tech"),
    "Este gate solo admite una conexión Neon aislada.",
  );

  const [{ applyImport, exportAll, parseImport }, bloat, training, database] =
    await Promise.all([
      import("@/server/db/queries/backup"),
      import("@/server/db/queries/bloat"),
      import("@/server/db/queries/training"),
      import("@/server/db"),
    ]);

  const originalExport = await exportAll();
  const snapshot = parseImport(originalExport);
  const originalCanonical = canonical(originalExport.data);
  const evidence = {
    backupRollback: false,
    backupRoundTrip: false,
    bloatIdempotent: false,
    bloatChronology: false,
    trainingIdempotent: false,
    trainingOverlapGuard: false,
    trainingDeleteCleanup: false,
    restored: false,
    tables: Object.keys(originalExport.data).length,
    rows: Object.values(originalExport.data).reduce(
      (total, rows) => total + rows.length,
      0,
    ),
  };

  try {
    const invalid = structuredClone(snapshot);
    assert(invalid.products.length > 0, "Falta un producto para forzar el rollback.");
    invalid.products.push(structuredClone(invalid.products[0]!));
    let rejected = false;
    try {
      await applyImport(invalid);
    } catch {
      rejected = true;
    }
    assert(rejected, "El restore inválido no fue rechazado.");
    assert(
      canonical((await exportAll()).data) === originalCanonical,
      "El restore fallido alteró los datos.",
    );
    evidence.backupRollback = true;

    await applyImport(snapshot);
    assert(
      canonical((await exportAll()).data) === originalCanonical,
      "El round-trip de backup no fue exacto.",
    );
    evidence.backupRoundTrip = true;

    const probeDate = "2099-01-05";
    const probeTime = "03:17";
    const [firstMarker, secondMarker] = await Promise.all([
      bloat.createBloatEvent({
        date: probeDate,
        occurredAt: probeTime,
        severity: "leve",
      }),
      bloat.createBloatEvent({
        date: probeDate,
        occurredAt: probeTime,
        severity: "alta",
      }),
    ]);
    assert(firstMarker.id === secondMarker.id, "El marcador concurrente se duplicó.");
    const markers = await bloat.listBloatEvents(probeDate);
    assert(markers.length === 1, "El marcador natural no quedó único.");
    const updated = await bloat.updateBloatEvent(firstMarker.id, {
      severity: "moderada",
    });
    assert(updated?.severity === "moderada", "El marcador no se pudo actualizar.");
    const latestMarker = await bloat.createBloatEvent({
      date: probeDate,
      occurredAt: "20:17",
      severity: "alta",
    });
    const retroactiveMarker = await bloat.createBloatEvent({
      date: probeDate,
      occurredAt: "08:17",
      severity: "leve",
    });
    const [summary] = await database.db
      .select({ bloat: database.schema.days.bloat })
      .from(database.schema.days)
      .where(eq(database.schema.days.date, probeDate));
    assert(summary?.bloat === "alta", "El resumen no conserva el último marcador temporal.");
    evidence.bloatChronology = true;
    await Promise.all([
      bloat.deleteBloatEvent(firstMarker.id),
      bloat.deleteBloatEvent(latestMarker.id),
      bloat.deleteBloatEvent(retroactiveMarker.id),
    ]);
    assert(
      (await bloat.listBloatEvents(probeDate)).length === 0,
      "El marcador no se pudo eliminar.",
    );
    evidence.bloatIdempotent = true;

    const requestId = randomUUID();
    const plan = {
      programa: "Fuelboard verification",
      etiqueta: "Semana de seguridad",
      source: "texto" as const,
      validFrom: "2099-01-05",
      validTo: "2099-01-11",
      sessions: [
        {
          key: "verify-a",
          nombre: "Sesión A",
          tipo: "fuerza" as const,
          contenido: "Verificación transaccional",
          kcalMin: 200,
          kcalMax: 300,
          duracionMin: 45,
        },
        {
          key: "verify-b",
          nombre: "Sesión B",
          tipo: "metabolico" as const,
          contenido: "Verificación de replay",
          kcalMin: 300,
          kcalMax: 400,
          duracionMin: 30,
        },
      ],
    };
    const assignments = [
      { sessionIndex: 0, date: "2099-01-05" },
      { sessionIndex: 1, date: "2099-01-07" },
    ];
    const fingerprint = createHash("sha256")
      .update(JSON.stringify({ plan, assignments }))
      .digest("hex");
    const [firstPlan, secondPlan] = await Promise.all([
      training.createTrainingPlanAtomic(plan, assignments, requestId, fingerprint),
      training.createTrainingPlanAtomic(plan, assignments, requestId, fingerprint),
    ]);
    assert(firstPlan.plan.id === secondPlan.plan.id, "El replay creó dos planes.");
    assert(firstPlan.sessions.length === 2, "La semana quedó incompleta.");
    assert(firstPlan.assigned === 2, "Las asignaciones no fueron atómicas.");
    const replay = await training.createTrainingPlanAtomic(
      plan,
      assignments,
      requestId,
      fingerprint,
    );
    assert(replay.replayed && replay.plan.id === firstPlan.plan.id, "El replay no fue estable.");
    evidence.trainingIdempotent = true;
    let overlapRejected = false;
    const conflictingPlan = { ...plan, etiqueta: "Semana incompatible" };
    const conflictingFingerprint = createHash("sha256")
      .update(JSON.stringify({ plan: conflictingPlan, assignments }))
      .digest("hex");
    try {
      await training.createTrainingPlanAtomic(
        conflictingPlan,
        assignments,
        randomUUID(),
        conflictingFingerprint,
      );
    } catch (error) {
      overlapRejected = error instanceof training.TrainingPlanOverlapError;
    }
    assert(overlapRejected, "Se aceptó un segundo plan para la misma semana.");
    evidence.trainingOverlapGuard = true;
    await training.deleteTrainingPlan(firstPlan.plan.id);
    const clearedDays = await database.db
      .select({
        sessionRef: database.schema.days.sessionRef,
        sessionLabel: database.schema.days.sessionLabel,
        sessionKcal: database.schema.days.sessionKcal,
      })
      .from(database.schema.days)
      .where(inArray(database.schema.days.date, assignments.map((item) => item.date)));
    assert(
      clearedDays.every(
        (day) => day.sessionRef == null && day.sessionLabel == null && day.sessionKcal == null,
      ),
      "Borrar la semana dejó sesiones desnormalizadas en los días.",
    );
    evidence.trainingDeleteCleanup = true;
  } finally {
    await applyImport(snapshot);
    evidence.restored = canonical((await exportAll()).data) === originalCanonical;
  }

  assert(evidence.restored, "No se pudo restaurar el snapshot de verificación.");
  console.log(JSON.stringify(evidence));
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
