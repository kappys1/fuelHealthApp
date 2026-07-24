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
    <main className="flex min-h-dvh items-center justify-center bg-canvas px-5 py-10">
      <section className="wellness-card w-full max-w-sm p-5 text-center">
        <span className="mx-auto inline-flex size-12 items-center justify-center rounded-2xl bg-primary-soft text-primary">
          <WifiOff className="size-6" aria-hidden />
        </span>
        <h1 className="mt-4 font-display text-lg font-semibold text-foreground">
          Sin conexión
        </h1>
        <p className="mt-2 text-[14px] text-muted-foreground">
          Lo que ya has consultado sigue disponible. Los registros pendientes se
          sincronizarán automáticamente cuando vuelva la conexión.
        </p>
        <Link
          href="/hoy"
          className="mt-5 inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-5 text-[14px] font-semibold text-primary-foreground transition-colors hover:bg-primary-strong"
        >
          Volver a Hoy
        </Link>
      </section>
    </main>
  );
}
