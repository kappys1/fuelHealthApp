import { Skeleton } from "@/components/ui/skeleton";

// Skeleton con la forma real de la lista de hilos de Chat (07 §6): reserva la
// cabecera y varias filas para que no haya salto al llegar los hilos del RSC.
export default function ChatLoading() {
  return (
    <div className="space-y-6 pb-8" aria-label="Cargando conversaciones">
      <div className="flex items-end justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-8 w-20" />
        </div>
        <Skeleton className="h-11 w-24 rounded-xl" />
      </div>
      <div className="space-y-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="wellness-card flex min-h-[92px] items-center gap-3 p-4 ring-1 ring-line"
          >
            <Skeleton className="size-10 shrink-0 rounded-xl" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-3.5 w-4/5" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-2.5 w-2/5" />
            </div>
            <Skeleton className="size-11 shrink-0 rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  );
}
