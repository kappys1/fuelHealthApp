/**
 * Placeholder de sección para la Fase 0: título de sección + instrucción del
 * estado vacío. Sin lógica; cada pantalla se implementa en su fase.
 */
export function SectionPlaceholder({
  title,
  phase,
  children,
}: {
  title: string;
  phase: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h1 className="card-title text-muted-foreground">{title}</h1>
      <div className="mt-3 rounded-xl border border-dashed border-line bg-surface-2 p-6">
        <p className="text-sm text-foreground">{children}</p>
        <p className="mt-2 text-[12px] text-muted-foreground">Llega en {phase}.</p>
      </div>
    </section>
  );
}
