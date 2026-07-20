/*
  Auditoría de contraste WCAG 2.1 de los tokens de 05-DISENO §2 (ambos temas).
  Fuente única compartida por el CLI (scripts/audit-contrast.ts) y el test
  (src/lib/contrast.test.ts). Umbrales: texto normal ≥4.5:1 · relleno/UI ≥3:1.
  Debe reflejar EXACTAMENTE los hex de src/app/globals.css.
*/

export type TokenName =
  | "bg" | "surface" | "surface-2" | "ink" | "muted" | "line"
  | "primary" | "primary-fg" | "protein" | "carb" | "fat" | "phase"
  | "destructive" | "destructive-fg";

export const TOKENS: Record<"light" | "dark", Record<TokenName, string>> = {
  light: {
    bg: "#f6f8fa", surface: "#ffffff", "surface-2": "#eef2f6",
    ink: "#142235", muted: "#566678", line: "#728397",
    primary: "#155db8", "primary-fg": "#ffffff",
    protein: "#087a55", carb: "#946200", fat: "#b84620", phase: "#6747c7",
    destructive: "#b84620", "destructive-fg": "#ffffff",
  },
  dark: {
    bg: "#0e1319", surface: "#161c24", "surface-2": "#202936",
    ink: "#f3f6fa", muted: "#acb8c6", line: "#748397",
    primary: "#7eaeff", "primary-fg": "#0e1319",
    protein: "#4ad29a", carb: "#f0c45a", fat: "#ff9566", phase: "#c2a7ff",
    destructive: "#ff9566", "destructive-fg": "#0e1319",
  },
};

export type PairType = "text" | "large" | "ui";

// [fg, bg, etiqueta, tipo]
export const PAIRS: Array<[TokenName, TokenName, string, PairType]> = [
  ["ink", "bg", "texto principal / fondo", "text"],
  ["ink", "surface", "texto / tarjeta", "text"],
  ["ink", "surface-2", "texto / superficie-2 (chips)", "text"],
  ["muted", "bg", "texto atenuado / fondo", "text"],
  ["muted", "surface", "texto atenuado / tarjeta", "text"],
  ["muted", "surface-2", "texto atenuado / superficie-2", "text"],
  ["primary", "bg", "primario texto / fondo (nav activa)", "text"],
  ["primary", "surface", "primario texto / tarjeta", "text"],
  ["primary", "surface-2", "primario texto / superficie-2", "text"],
  ["primary-fg", "primary", "texto del botón primario", "text"],
  ["destructive", "surface", "error / tarjeta", "text"],
  ["destructive", "bg", "error / fondo", "text"],
  ["destructive-fg", "destructive", "texto sobre destructive", "text"],
  ["protein", "surface", "proteína texto / tarjeta", "text"],
  ["carb", "surface", "hidratos texto / tarjeta", "text"],
  ["fat", "surface", "grasa texto / tarjeta", "text"],
  ["phase", "surface", "fase texto / tarjeta", "text"],
  ["line", "surface", "borde / tarjeta", "ui"],
  ["line", "bg", "borde / fondo", "ui"],
  ["line", "surface-2", "borde / superficie-2", "ui"],
  ["primary", "surface", "primario relleno / tarjeta", "large"],
  ["protein", "surface", "proteína relleno / tarjeta", "large"],
  ["carb", "surface", "hidratos relleno / tarjeta", "large"],
  ["fat", "surface", "grasa relleno / tarjeta", "large"],
  ["phase", "surface", "fase relleno / tarjeta", "large"],
];

export const MIN: Record<PairType, number> = { text: 4.5, large: 3, ui: 3 };

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function luminance(hex: string): number {
  const h = hex.replace("#", "");
  return (
    0.2126 * channel(parseInt(h.slice(0, 2), 16)) +
    0.7152 * channel(parseInt(h.slice(2, 4), 16)) +
    0.0722 * channel(parseInt(h.slice(4, 6), 16))
  );
}

export function ratio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

export interface AuditRow {
  theme: "light" | "dark";
  label: string;
  type: PairType;
  ratio: number;
  min: number;
  ok: boolean;
  gating: boolean;
}

/** Evalúa todos los pares; `failures` cuenta solo los bloqueantes (texto/relleno). */
export function audit(): { rows: AuditRow[]; failures: number } {
  const rows: AuditRow[] = [];
  let failures = 0;
  for (const theme of ["light", "dark"] as const) {
    const t = TOKENS[theme];
    for (const [fg, bg, label, type] of PAIRS) {
      const r = ratio(t[fg], t[bg]);
      const min = MIN[type];
      const gating = true;
      const ok = r >= min;
      if (gating && !ok) failures++;
      rows.push({ theme, label, type, ratio: r, min, ok, gating });
    }
  }
  return { rows, failures };
}
