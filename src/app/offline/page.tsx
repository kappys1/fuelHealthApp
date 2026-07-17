import { WifiOff } from "lucide-react";
import Link from "next/link";

/*
  Fallback offline (Serwist). Se muestra cuando una navegación falla sin red y la
  página no está en caché. La app registrada como PWA sigue funcionando: los datos
  ya cacheados se ven, y las entradas nuevas se encolan y se sincronizan al volver.
*/
export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
      <span className="inline-flex size-12 items-center justify-center rounded-full bg-surface-2 text-muted-foreground">
        <WifiOff className="size-6" aria-hidden />
      </span>
      <h1 className="text-lg font-semibold text-foreground">Sin conexión</h1>
      <p className="text-[14px] text-muted-foreground">
        No hay red ahora mismo. Lo que ya has visto sigue disponible, y lo que
        registres se guardará y se sincronizará en cuanto vuelvas a tener conexión.
      </p>
      <Link
        href="/hoy"
        className="mt-2 rounded-xl bg-primary px-4 py-2.5 text-[14px] font-semibold text-primary-foreground"
      >
        Volver a Hoy
      </Link>
    </main>
  );
}
