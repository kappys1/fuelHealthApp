import { ProgresoClient } from "@/components/progreso/progreso-client";
import { isDayKey } from "@/lib/dates";
import { retry } from "@/lib/retry";
import { getHistorialData } from "@/server/db/queries/history";
import { listMarksWithEntries } from "@/server/db/queries/marks";
import { listMed } from "@/server/db/queries/med";
import { getTrendData } from "@/server/db/queries/trend";

// La serie diaria se calcula en el servidor (co-localizado con Neon); la analítica
// (pura) se recalcula en el cliente al cambiar el rango sin pedir datos de nuevo.
export const dynamic = "force-dynamic";

export default async function ProgresoPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    range?: string;
    summary?: string;
    historyRange?: string;
    historyType?: string;
    from?: string;
    to?: string;
  }>;
}) {
  const params = await searchParams;
  const initialSegment =
    params.tab === "med" || params.tab === "historial" ? params.tab : "tendencia";
  const initialRange =
    params.range === "14" ||
    params.range === "30" ||
    params.range === "todo"
      ? params.range
      : "90";
  const initialSummary = params.summary === "30" ? 30 : 7;
  const initialHistoryRange =
    params.historyRange === "3m" ||
    params.historyRange === "6m" ||
    params.historyRange === "year" ||
    params.historyRange === "custom"
      ? params.historyRange
      : "all";
  const initialHistoryType =
    params.historyType === "objetivo" ||
    params.historyType === "dieta" ||
    params.historyType === "entreno" ||
    params.historyType === "med"
      ? params.historyType
      : "all";
  const initialHistoryFrom = params.from && isDayKey(params.from) ? params.from : "";
  const initialHistoryTo = params.to && isDayKey(params.to) ? params.to : "";
  const [{ records, currentTarget, today }, med, historial, marks] =
    await retry(() =>
      Promise.all([
        getTrendData(),
        listMed(),
        getHistorialData(),
        listMarksWithEntries(),
      ]),
    );
  return (
    <ProgresoClient
      records={records}
      currentTarget={currentTarget}
      today={today}
      med={med}
      historial={historial}
      marks={marks}
      initialSegment={initialSegment}
      initialRange={initialRange}
      initialSummary={initialSummary}
      initialHistoryRange={initialHistoryRange}
      initialHistoryType={initialHistoryType}
      initialHistoryFrom={initialHistoryFrom}
      initialHistoryTo={initialHistoryTo}
    />
  );
}
