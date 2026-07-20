import { Suspense } from "react";
import { redirect } from "next/navigation";
import { HoyClient } from "@/components/hoy/hoy-client";
import { selectedDay } from "@/lib/dates";
import { retry } from "@/lib/retry";
import { getTodayPayload } from "@/server/db/queries/today";

// El día actual se renderiza en el servidor (RSC) para ver el gauge en <1 s (07 §2).
export const dynamic = "force-dynamic";

export default async function HoyPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const sp = await searchParams;
  const date = selectedDay(sp.date);
  if (sp.date && sp.date !== date) redirect("/hoy");
  const initial = await retry(() => getTodayPayload(date));

  // HoyClient usa useSearchParams() (atajos ?add / ?checkin del manifest). Sin
  // este <Suspense> Next opta toda la ruta a CSR (react-doctor/nextjs-no-use-
  // search-params-without-suspense). El fallback es null: el gauge ya llega
  // renderizado en el servidor vía `initial`, la hidratación del cliente es
  // inmediata y no hay salto de layout.
  return (
    <Suspense fallback={null}>
      <HoyClient date={date} initial={initial} />
    </Suspense>
  );
}
