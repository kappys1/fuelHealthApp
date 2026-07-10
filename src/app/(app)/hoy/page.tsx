import { HoyClient } from "@/components/hoy/hoy-client";
import { dayKey, isDayKey } from "@/lib/dates";
import { getTodayPayload } from "@/server/db/queries/today";

// El día actual se renderiza en el servidor (RSC) para ver el gauge en <1 s (07 §2).
export const dynamic = "force-dynamic";

export default async function HoyPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const sp = await searchParams;
  const date = sp.date && isDayKey(sp.date) ? sp.date : dayKey();
  const initial = await getTodayPayload(date);

  return <HoyClient date={date} initial={initial} />;
}
