import { Skeleton } from "@/components/ui/skeleton";

// Skeleton con la forma real de la lista de hilos de Chat (07 §6): reserva la
// cabecera y varias filas para que no haya salto al llegar los hilos del RSC.
export default function ChatLoading() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-9 w-20 rounded-lg" />
      </div>
      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        <div className="divide-y divide-line">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between px-4 py-3">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="size-4 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
