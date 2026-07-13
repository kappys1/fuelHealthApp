import { ProgresoClient } from "@/components/progreso/progreso-client";
import { getHistorialData } from "@/server/db/queries/history";
import { listMed } from "@/server/db/queries/med";
import { getTrendData } from "@/server/db/queries/trend";

// La serie diaria se calcula en el servidor (co-localizado con Neon); la analítica
// (pura) se recalcula en el cliente al cambiar el rango sin pedir datos de nuevo.
export const dynamic = "force-dynamic";

export default async function ProgresoPage() {
  const [{ records, currentTarget, today }, med, historial] = await Promise.all([
    getTrendData(),
    listMed(),
    getHistorialData(),
  ]);
  return (
    <ProgresoClient
      records={records}
      currentTarget={currentTarget}
      today={today}
      med={med}
      historial={historial}
    />
  );
}
