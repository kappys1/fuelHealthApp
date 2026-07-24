import type { LucideIcon } from "lucide-react";
import {
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  DatabaseBackup,
  FileUp,
  Globe2,
  HeartPulse,
  LogOut,
  Palette,
  TriangleAlert,
  UserRound,
} from "lucide-react";
import { redirect } from "next/navigation";
import { AthleteProfileEditor } from "@/components/ajustes/athlete-profile-editor";
import { ChatWebSearchToggle } from "@/components/ajustes/chat-web-search-toggle";
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
  getChatWebSearch,
  getSessionByWeekday,
} from "@/server/db/queries/lookups";

export const dynamic = "force-dynamic";

function SyncStatus({ view }: { view: HealthSyncView }) {
  const source = view.source === "endpoint" ? "Health Auto Export" : "CSV";
  const Icon = view.stale ? TriangleAlert : CheckCircle2;
  return (
    <div
      className={`flex items-start gap-3 rounded-2xl p-4 ${
        view.stale ? "bg-destructive/8" : "bg-protein-soft"
      }`}
      role="status"
    >
      <span
        className={`flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface ${
          view.stale ? "text-destructive" : "text-protein"
        }`}
      >
        <Icon className="size-[18px]" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-foreground">
          Última sincronización {view.ago}
        </p>
        <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
          {source} · {view.imported} {view.imported === 1 ? "día" : "días"} en la
          última importación
        </p>
        {view.stale ? (
          <p className="mt-1 text-[12px] font-medium text-destructive">
            Revisa la automatización: lleva más de 48 h sin datos nuevos.
          </p>
        ) : null}
      </div>
    </div>
  );
}

async function logout() {
  "use server";
  const session = await getSession();
  session.destroy();
  redirect("/login");
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h2 className="ui-label px-1">{label}</h2>
      {children}
    </div>
  );
}

function SettingsCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="wellness-card p-5 ring-1 ring-line">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
          <Icon className="size-[18px]" aria-hidden />
        </span>
        <div className="min-w-0 flex-1 pt-0.5">
          <h3 className="text-[15px] font-semibold text-foreground">{title}</h3>
          {description ? (
            <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export default async function AjustesPage() {
  const [sessionMap, sync, profile, chatWebSearch] = await Promise.all([
    getSessionByWeekday(),
    getHealthSyncView(),
    getAthleteProfile(),
    getChatWebSearch(),
  ]);
  const trainingDays = trainingDaysPerWeek(sessionMap);

  return (
    <section className="space-y-8 pb-10">
      <header>
        <p className="ui-label">Tu app, tus datos</p>
        <h1 className="app-page-title mt-1">Ajustes</h1>
      </header>

      <Group label="Atleta">
        <SettingsCard
          icon={UserRound}
          title="Perfil del atleta"
          description="Contexto personal que usa el Coach para interpretar tus datos."
        >
          <div className="flex flex-wrap gap-2">
            {[profile.deporte, profile.nivel, `${trainingDays} días/semana`]
              .filter(Boolean)
              .map((value) => (
                <span
                  key={value}
                  className="inline-flex min-h-8 items-center rounded-full bg-surface-2 px-3 text-[12px] font-medium text-foreground"
                >
                  {value}
                </span>
              ))}
          </div>
          <details className="group mt-3">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between rounded-xl px-2 text-[13px] font-semibold text-primary hover:bg-primary-soft [&::-webkit-details-marker]:hidden">
              Editar perfil completo
              <ChevronDown
                className="size-4 transition-transform group-open:rotate-180"
                aria-hidden
              />
            </summary>
            <div className="mt-5 border-t border-line pt-5">
              <AthleteProfileEditor
                initial={profile}
                today={dayKey()}
                trainingDays={trainingDays}
              />
            </div>
          </details>
        </SettingsCard>
      </Group>

      <Group label="Preferencias">
        <div className="wellness-card divide-y divide-line overflow-hidden p-0 ring-1 ring-line">
          <section className="p-5">
            <div className="flex items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                <Palette className="size-[18px]" aria-hidden />
              </span>
              <div>
                <h3 className="text-[14px] font-semibold text-foreground">Tema</h3>
                <p className="mt-0.5 text-[12px] text-muted-foreground">
                  Elige la apariencia de la aplicación.
                </p>
              </div>
            </div>
            <div className="mt-4">
              <ThemeToggle />
            </div>
          </section>

          <section className="p-5">
            <div className="mb-3 flex items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                <Globe2 className="size-[18px]" aria-hidden />
              </span>
              <h3 className="text-[14px] font-semibold text-foreground">
                Búsqueda web en Chat
              </h3>
            </div>
            <ChatWebSearchToggle initial={chatWebSearch} />
          </section>
        </div>
      </Group>

      <Group label="Salud y datos">
        <SettingsCard
          icon={HeartPulse}
          title="Sincronización de Salud"
          description="Confianza y procedencia de la última importación recibida."
        >
          {sync ? (
            <SyncStatus view={sync} />
          ) : (
            <div className="rounded-2xl bg-surface-2 p-4">
              <p className="text-[13px] font-semibold text-foreground">
                Sin sincronizaciones todavía
              </p>
              <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                Configura Health Auto Export para enviar datos a{" "}
                <code className="rounded bg-surface px-1.5 py-0.5 text-[12px] text-foreground">
                  /api/health/ingest
                </code>
                .
              </p>
            </div>
          )}
        </SettingsCard>

        <SettingsCard
          icon={FileUp}
          title="Importar CSV de Apple Health"
          description="Comprueba el contenido del archivo antes de aplicar cambios."
        >
          <HealthImport />
        </SettingsCard>

        <SettingsCard
          icon={DatabaseBackup}
          title="Copia de seguridad"
          description="Exporta todos tus datos o restaura una copia con vista previa."
        >
          <DataBackup />
        </SettingsCard>
      </Group>

      <Group label="Entrenamiento">
        <SettingsCard
          icon={CalendarClock}
          title="Sesión por día de la semana"
          description="Este mapeo precarga la sesión en tu check-in matinal."
        >
          <SessionMapEditor initial={sessionMap} />
        </SettingsCard>
      </Group>

      <Group label="Cuenta">
        <div className="wellness-card p-3 ring-1 ring-line">
          <form action={logout}>
            <button
              type="submit"
              className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-[14px] font-semibold text-destructive transition-colors hover:bg-destructive/10"
            >
              <LogOut className="size-[18px]" aria-hidden />
              Cerrar sesión
            </button>
          </form>
        </div>
      </Group>
    </section>
  );
}
