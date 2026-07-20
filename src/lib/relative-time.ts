const DATE_FORMATTER = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "short",
});

export function relativeDate(value: string, nowValue: string): string {
  const date = new Date(value);
  const now = new Date(nowValue);
  if (!Number.isFinite(date.getTime()) || !Number.isFinite(now.getTime())) {
    return "Fecha desconocida";
  }
  const diffMs = Math.max(0, now.getTime() - date.getTime());
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "Ahora";
  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Ayer";
  if (days < 7) return `Hace ${days} d`;
  return DATE_FORMATTER.format(date).replace(".", "");
}
