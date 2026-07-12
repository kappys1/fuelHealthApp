import { redirect } from "next/navigation";
import { AthleteProfileEditor } from "@/components/ajustes/athlete-profile-editor";
import { DataBackup } from "@/components/ajustes/data-backup";
import { HealthImport } from "@/components/ajustes/health-import";
import { SessionMapEditor } from "@/components/ajustes/session-map-editor";
import { ThemeToggle } from "@/components/theme-toggle";
import { dayKey } from "@/lib/dates";
import { trainingDaysPerWeek } from "@/lib/profile";
import { getSession } from "@/lib/session";
import { getHealthSyncView, type HealthSyncView } from "@/server/db/queries/health";
import {
  getAthleteProfile,
  getSessionByWeekday,
} from "@/server/db/queries/lookups";

export const dynamic = "force-dynamic";

function SyncStatus({ view }: { view: HealthSyncView }) {
  const label = view.source === "endpoint" ? "endpoint" : "CSV";
  return (
    <p className={`text-sm ${view.stale ? "text-destructive" : "text-foreground"}`}>
      Última sincronización: {view.ago} · {label} {view.stale ? "⚠" : "✓"}
      {view.stale ? " — revisa la Automation de HAE" : ""}
    </p>
  );
}

// Cerrar sesión (Server Action).
async function logout() {
  "use server";
  const session = await getSession();
  session.destroy();
  redirect("/login");
}

function Group({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <h2 className="px-1 text-[12px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </h2>
      {children}
    </div>
  );
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
      <h3 className="card-title text-muted-foreground">{title}</h3>
      <div className="mt-3">{children}</div>
    </div>
  );
}

export default async function AjustesPage() {
  const [sessionMap, sync, profile] = await Promise.all([
    getSessionByWeekday(),
    getHealthSyncView(),
    getAthleteProfile(),
  ]);
  const trainingDays = trainingDaysPerWeek(sessionMap);

  return (
    <section className="space-y-6">
      <h1 className="card-title text-muted-foreground">Ajustes</h1>

      <Group label="Atleta">
        <Row title="Perfil del atleta">
          <p className="mb-3 text-sm text-foreground">
            La IA usa este perfil en todas sus respuestas (nada va a fuego). La
            edad y los días de entreno se calculan solos.
          </p>
          <AthleteProfileEditor
            initial={profile}
            today={dayKey()}
            trainingDays={trainingDays}
          />
        </Row>
      </Group>

      <Group label="App">
        <Row title="Tema">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-foreground">
              Claro «Morning session», oscuro «Night comp» o automático.
            </p>
            <ThemeToggle />
          </div>
        </Row>

        <Row title="Sincronización de Salud">
          {sync ? (
            <SyncStatus view={sync} />
          ) : (
            <p className="text-sm text-muted-foreground">
              Sin sincronizaciones todavía. Configura una Automation de Health Auto
              Export que haga POST a{" "}
              <code className="rounded bg-surface-2 px-1 text-[12px]">
                /api/health/ingest
              </code>{" "}
              con el token <code className="text-[12px]">HEALTH_INGEST_TOKEN</code>.
            </p>
          )}
        </Row>

        <Row title="Importar CSV de Apple Health">
          <p className="mb-3 text-sm text-foreground">
            Respaldo del endpoint: sube el CSV de Health Auto Export. Verás una
            vista previa antes de aplicar.
          </p>
          <HealthImport />
        </Row>

        <Row title="Copia de seguridad">
          <p className="mb-3 text-sm text-foreground">
            Export completo en un clic; restaurar reemplaza todos los datos (con
            confirmación).
          </p>
          <DataBackup />
        </Row>

        <Row title="Sesión por día de la semana">
          <p className="mb-3 text-sm text-foreground">
            Mapeo The Progrm para precargar la sesión en el check-in matinal.
          </p>
          <SessionMapEditor initial={sessionMap} />
        </Row>
      </Group>

      <Group label="Cuenta">
        <div className="rounded-xl border border-line bg-surface p-4">
          <form action={logout}>
            <button
              type="submit"
              className="h-11 rounded-md border border-line bg-surface-2 px-4 text-sm text-foreground transition-colors hover:text-primary"
            >
              Cerrar sesión
            </button>
          </form>
        </div>
      </Group>
    </section>
  );
}
