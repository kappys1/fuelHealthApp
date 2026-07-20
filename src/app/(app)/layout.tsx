import { Settings } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BottomNav } from "@/components/bottom-nav";
import { OfflineSync } from "@/components/offline-sync";
import { Toaster } from "@/components/ui/sonner";
import { getSession } from "@/lib/session";

// La función corría por defecto en iad1 (Washington) → cada query a Neon
// (eu-central-1, Frankfurt) cruzaba el Atlántico. La fijamos en fra1 para
// co-localizarla con la BD. Medido: /hoy ~0,45 s (iad1) → ver DECISIONS.
export const preferredRegion = "fra1";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Verificación AUTORITATIVA de sesión (el proxy solo hace la optimista).
  const session = await getSession();
  if (!session.authenticated) redirect("/login");

  return (
    <div className="relative mx-auto flex min-h-dvh w-full max-w-[560px] flex-col bg-background sm:shadow-float">
      {/* pt con safe-area: en PWA standalone (status bar translúcida) el contenido
          fluye bajo el reloj/notch; sin esto el wordmark lo pisa.
          `sticky top-0`: se queda arriba al scrollear el documento (más seguro en
          iOS que `fixed`); bg para que el contenido no se transparente por detrás. */}
      <header
        data-app-header
        className="sticky top-0 z-30 flex min-h-16 items-center justify-between bg-background/95 px-[18px] pb-2 backdrop-blur-xl"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.5rem)" }}
      >
        <Link
          href="/hoy"
          className="flex min-h-11 min-w-0 items-center gap-2.5 text-foreground"
        >
          <span
            className="grid size-8 shrink-0 place-items-center rounded-lg bg-foreground font-display text-lg font-bold leading-none text-background"
            aria-hidden
          >
            F
          </span>
          <span className="min-w-0 leading-tight">
            <span className="block text-[11px] font-bold uppercase text-muted-foreground">
              Fuelboard
            </span>
            <span className="block truncate font-display text-[15px] font-semibold">
              Tu panel
            </span>
          </span>
        </Link>
        {/* Ajustes: icono en el header (no es pestaña) — 09-FLUJOS-UX §2 */}
        <Link
          href="/ajustes"
          aria-label="Ajustes"
          className="app-icon-button focus-visible:ring-3 focus-visible:ring-ring/35 focus-visible:outline-none"
        >
          <Settings className="size-[18px]" strokeWidth={1.8} aria-hidden />
        </Link>
      </header>

      {/* Scroll de documento (modelo original, fiable en iOS): el wrapper crece con
          el contenido y la nav queda `fixed` sobre el viewport. El hilo de Chat se
          resuelve aparte con un panel fijo propio (ver chat-client.tsx), sin forzar
          a toda la app a un scroller anidado (rompía la nav fija en iOS). */}
      <main className="flex flex-1 flex-col px-[18px] pt-4 pb-[calc(var(--nav-h)+24px)]">
        {children}
      </main>

      <BottomNav />
      <Toaster />
      <OfflineSync />
    </div>
  );
}
