import { ProgresoClient } from "@/components/progreso/progreso-client";
import { getTrendData } from "@/server/db/queries/trend";

// La serie diaria se calcula en el servidor (co-localizado con Neon); la analítica
// (pura) se recalcula en el cliente al cambiar el rango sin pedir datos de nuevo.
export const dynamic = "force-dynamic";

export default async function ProgresoPage() {
  const { records, currentTarget, today } = await getTrendData();
  return (
    <ProgresoClient records={records} currentTarget={currentTarget} today={today} />
  );
}
