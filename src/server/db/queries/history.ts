import { asc } from "drizzle-orm";
import type { GrpKey, MealKey } from "@/lib/macros";
import type { TrainingTipo } from "@/lib/training";
import type { MedDelta } from "@/server/analytics/medDeltas";
import { db, schema } from "@/server/db";
import { getAthleteProfile } from "./lookups";
import { listMed } from "./med";
import { listAllDietVersions, type PlanOptionDTO } from "./plan";
import { listAllTrainingPlans, type TrainingSessionDTO } from "./training";

/*
  Historial unificado (doc 10 B4): mezcla las 4 fuentes ya fechadas en un timeline
  de SOLO LECTURA (el pasado no se edita — son fotos congeladas; solo se edita lo
  actual). Cada entrada trae su detalle: la dieta sus opciones, el entreno sus
  sesiones (datos pequeños para un usuario único → se incluyen, sin lazy-load).
*/
export type HistorialKind = "objetivo" | "dieta" | "entreno" | "med";

interface HistBase {
  /** 'YYYY-MM-DD' — fecha del hito (para ordenar y mostrar). */
  date: string;
}
export interface HistObjetivo extends HistBase {
  kind: "objetivo";
  texto: string;
  pesoObjetivo: number | null;
}
export interface HistDieta extends HistBase {
  kind: "dieta";
  versionId: number;
  kcal: number;
  prot: number;
  carb: number | null;
  fat: number | null;
  note: string | null;
  options: PlanOptionDTO[];
}
export interface HistMed extends HistBase {
  kind: "med";
  fatKg: number | null;
  muscleKg: number | null;
  weightKg: number | null;
  delta: MedDelta;
}
export interface HistEntreno extends HistBase {
  kind: "entreno";
  planId: number;
  programa: string;
  etiqueta: string;
  validFrom: string;
  validTo: string | null;
  sessions: TrainingSessionDTO[];
}
export type HistorialEntry =
  | HistObjetivo
  | HistDieta
  | HistMed
  | HistEntreno;

export async function getHistorialData(): Promise<HistorialEntry[]> {
  const [meds, versions, plans, profile, optionRows, sessionRows] =
    await Promise.all([
      listMed(),
      listAllDietVersions(),
      listAllTrainingPlans(),
      getAthleteProfile(),
      db.select().from(schema.planOptions).orderBy(asc(schema.planOptions.sort)),
      db
        .select()
        .from(schema.trainingSessions)
        .orderBy(
          asc(schema.trainingSessions.sort),
          asc(schema.trainingSessions.id),
        ),
    ]);

  const optsByVersion = new Map<number, PlanOptionDTO[]>();
  for (const r of optionRows) {
    const list = optsByVersion.get(r.dietVersionId) ?? [];
    list.push({
      id: r.id,
      meal: r.meal as MealKey,
      grp: r.grp as GrpKey,
      name: r.name,
      baseG: r.baseG,
      kcal: r.kcal,
      prot: r.prot,
      carb: r.carb,
      fat: r.fat,
      variants: r.variants,
      sort: r.sort,
    });
    optsByVersion.set(r.dietVersionId, list);
  }

  const sessByPlan = new Map<number, TrainingSessionDTO[]>();
  for (const r of sessionRows) {
    const list = sessByPlan.get(r.planId) ?? [];
    list.push({
      id: r.id,
      planId: r.planId,
      key: r.key,
      nombre: r.nombre,
      tipo: r.tipo as TrainingTipo,
      contenido: r.contenido,
      kcalMin: r.kcalMin,
      kcalMax: r.kcalMax,
      duracionMin: r.duracionMin,
      sort: r.sort,
    });
    sessByPlan.set(r.planId, list);
  }

  const entries: HistorialEntry[] = [];
  for (const o of profile.objetivos) {
    entries.push({
      kind: "objetivo",
      date: o.desde,
      texto: o.texto,
      pesoObjetivo: o.pesoObjetivo ?? null,
    });
  }
  for (const v of versions) {
    entries.push({
      kind: "dieta",
      date: v.effectiveFrom,
      versionId: v.id,
      kcal: v.kcalTarget,
      prot: v.protTarget,
      carb: v.carbTarget,
      fat: v.fatTarget,
      note: v.note,
      options: optsByVersion.get(v.id) ?? [],
    });
  }
  for (const p of plans) {
    entries.push({
      kind: "entreno",
      date: p.validFrom,
      planId: p.id,
      programa: p.programa,
      etiqueta: p.etiqueta,
      validFrom: p.validFrom,
      validTo: p.validTo,
      sessions: sessByPlan.get(p.id) ?? [],
    });
  }
  for (const m of meds) {
    entries.push({
      kind: "med",
      date: m.date,
      fatKg: m.fatKg,
      muscleKg: m.muscleKg,
      weightKg: m.weightKg,
      delta: m.delta,
    });
  }

  // Orden cronológico inverso (lo más reciente arriba); estable por tipo.
  entries.sort((a, b) => b.date.localeCompare(a.date));
  return entries;
}
