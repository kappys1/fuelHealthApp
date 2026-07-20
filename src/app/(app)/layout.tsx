import { redirect } from "next/navigation";
import { AppTopbar } from "@/components/app-topbar";
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
    <div className="mx-auto flex min-h-dvh w-full max-w-[560px] flex-col">
      {/* pt con safe-area: en PWA standalone (status bar translúcida) el contenido
          fluye bajo el reloj/notch; sin esto el wordmark lo pisa.
          `sticky top-0`: se queda arriba al scrollear el documento (más seguro en
          iOS que `fixed`); bg para que el contenido no se transparente por detrás. */}
      <AppTopbar />

      {/* Scroll de documento (modelo original, fiable en iOS): el wrapper crece con
          el contenido y la nav queda `fixed` sobre el viewport. El hilo de Chat se
          resuelve aparte con un panel fijo propio (ver chat-client.tsx), sin forzar
          a toda la app a un scroller anidado (rompía la nav fija en iOS). */}
      <main className="flex flex-1 flex-col px-4 pt-4 pb-24">{children}</main>

      <BottomNav />
      <Toaster />
      <OfflineSync />
    </div>
  );
}
