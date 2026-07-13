/*
  Parser CSV de Health Auto Export (respaldo, 03-DATOS §4.2) — función PURA.

  Export de HAE con agregación diaria y cabeceras EN ESPAÑOL. Detección de columna
  por substring (case-insensitive, sin acentos). Conversiones:
    · energía activa/basal en (kJ) → kcal (÷4,184)
    · agua en (mL) → L (÷1000)
  Cuidado con la colisión «peso (»/«paso» (ver normalize.ts). Números con coma
  decimal → punto. Filas sin fecha 'YYYY-MM-DD' se ignoran.

  El delimitador se autodetecta: el CSV español de HAE usa «;» porque los números
  llevan coma decimal (con «,» como delimitador sería inparseable).
*/
import {
  canonicalize,
  detectDateColumn,
  detectField,
  extractDayKey,
  type HealthDay,
  type HealthField,
  headerIsKj,
  headerIsMl,
  mergeHealthDay,
  normalizeKey,
  parseNumberEs,
  sanitizeSleepH,
} from "./normalize";

export interface CsvParseResult {
  /** Días parseados (fusionados por fecha, orden de aparición). */
  days: HealthDay[];
  /** Nº de filas de datos con fecha válida. */
  rows: number;
  /** Métricas (campos) detectadas en las cabeceras. */
  fields: HealthField[];
  /** true si alguna columna de energía venía en kJ (aviso «kJ→kcal»). */
  hadKj: boolean;
  /** true si el agua venía en mL. */
  hadMl: boolean;
}

interface ColumnMap {
  dateIdx: number | null;
  cols: { idx: number; field: HealthField; isKj: boolean; isMl: boolean }[];
}

/** Detecta el delimitador dominante de la cabecera (« ; » preferido en ES). */
function detectDelimiter(headerLine: string): string {
  const semis = (headerLine.match(/;/g) ?? []).length;
  const commas = (headerLine.match(/,/g) ?? []).length;
  const tabs = (headerLine.match(/\t/g) ?? []).length;
  if (tabs > semis && tabs > commas) return "\t";
  return semis >= commas ? ";" : ",";
}

/** Trocea una línea CSV respetando comillas dobles. */
function splitLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQuotes = false;
      } else cur += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delim) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function buildColumnMap(headers: string[]): ColumnMap {
  let dateIdx: number | null = null;
  const cols: ColumnMap["cols"] = [];
  const usedFields = new Set<HealthField>();
  headers.forEach((h, idx) => {
    const norm = normalizeKey(h);
    if (dateIdx == null && detectDateColumn(norm)) {
      dateIdx = idx;
      return;
    }
    const field = detectField(norm);
    if (field && !usedFields.has(field)) {
      usedFields.add(field);
      cols.push({ idx, field, isKj: headerIsKj(norm), isMl: headerIsMl(norm) });
    }
  });
  return { dateIdx, cols };
}

export function parseHaeCsv(text: string): CsvParseResult {
  // Quita BOM y separa en líneas no vacías.
  const clean = text.replace(/^\uFEFF/, "");
  const lines = clean.split(/\r?\n/).filter((l) => l.trim() !== "");
  const headerLine = lines[0];
  if (!headerLine) {
    return { days: [], rows: 0, fields: [], hadKj: false, hadMl: false };
  }

  const delim = detectDelimiter(headerLine);
  const headers = splitLine(headerLine, delim);
  const map = buildColumnMap(headers);

  const byDate = new Map<string, HealthDay>();
  const order: string[] = [];
  let rows = 0;
  let hadKj = false;
  let hadMl = false;

  for (let li = 1; li < lines.length; li++) {
    const line = lines[li];
    if (line == null) continue;
    const cells = splitLine(line, delim);
    const rawDate = map.dateIdx != null ? (cells[map.dateIdx] ?? "") : "";
    const date = extractDayKey(rawDate);
    if (!date) continue; // filas sin fecha válida → ignoradas
    rows++;

    const day: HealthDay = { date };
    for (const col of map.cols) {
      const value = parseNumberEs(cells[col.idx]);
      if (value == null) continue;
      if (col.isKj) hadKj = true;
      if (col.isMl) hadMl = true;
      const canon = canonicalize(col.field, value, {
        isKj: col.isKj,
        isMl: col.isMl,
      });
      // Sueño: descarta totales imposibles (>16 h) → 0. Ver sanitizeSleepH.
      day[col.field] = col.field === "sleepH" ? sanitizeSleepH(canon) : canon;
    }

    const prev = byDate.get(date);
    if (prev) byDate.set(date, mergeHealthDay(prev, day));
    else {
      byDate.set(date, day);
      order.push(date);
    }
  }

  return {
    days: order.map((d) => byDate.get(d) as HealthDay),
    rows,
    fields: map.cols.map((c) => c.field),
    hadKj,
    hadMl,
  };
}
