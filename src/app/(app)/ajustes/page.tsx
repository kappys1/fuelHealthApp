import { redirect } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { getSession } from "@/lib/session";

// Cerrar sesión (Server Action).
async function logout() {
  "use server";
  const session = await getSession();
  session.destroy();
  redirect("/login");
}

function Row({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <h2 className="card-title text-muted-foreground">{title}</h2>
      <div className="mt-3">{children}</div>
    </div>
  );
}

export default function AjustesPage() {
  return (
    <section className="space-y-4">
      <h1 className="card-title text-muted-foreground">Ajustes</h1>

      <Row title="Tema">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-foreground">
            Claro «Morning session», oscuro «Night comp» o automático.
          </p>
          <ThemeToggle />
        </div>
      </Row>

      <Row title="Datos">
        <p className="text-sm text-foreground">
          Importar CSV de Apple Health, exportar y restaurar copia.
        </p>
        <p className="mt-2 text-[12px] text-muted-foreground">Llega en la Fase 3.</p>
      </Row>

      <Row title="Sincronización de Salud">
        <p className="text-sm text-foreground">
          Estado del endpoint de Health Auto Export («última sync hace X»).
        </p>
        <p className="mt-2 text-[12px] text-muted-foreground">Llega en la Fase 3.</p>
      </Row>

      <Row title="Sesión por día de la semana">
        <p className="text-sm text-foreground">
          Mapeo The Progrm (L→T1 … D→Descanso) para precargar la sesión en el
          check-in.
        </p>
        <p className="mt-2 text-[12px] text-muted-foreground">Llega en la Fase 1.</p>
      </Row>

      <Row title="Cuenta">
        <form action={logout}>
          <button
            type="submit"
            className="h-10 rounded-md border border-line bg-surface-2 px-4 text-sm text-foreground transition-colors hover:text-primary"
          >
            Cerrar sesión
          </button>
        </form>
      </Row>
    </section>
  );
}
